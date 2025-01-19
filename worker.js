export default {
  async fetch(request, env) {
    try {
      // 定义通用的 CORS 头部
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'true'
      };

      // 处理 CORS 预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders
        });
      }

      // 处理不同类型的请求
      if (request.method === 'POST') {
        const url = new URL(request.url);
        const path = url.pathname;

        try {
          let response;
          if (path === '/transcribe') {
            response = await handleTranscribe(request, env);
          } else if (path === '/translate') {
            response = await handleTranslate(request, env);
          } else {
            response = new Response(JSON.stringify({
              error: '无效的请求路径',
              path: path,
              timestamp: new Date().toISOString()
            }), { 
              status: 404,
              headers: {
                'Content-Type': 'application/json'
              }
            });
          }

          // 为所有响应添加 CORS 头部
          const newHeaders = new Headers(response.headers);
          Object.entries(corsHeaders).forEach(([key, value]) => {
            newHeaders.set(key, value);
          });

          return new Response(response.body, {
            status: response.status,
            headers: newHeaders
          });
        } catch (error) {
          console.error('请求处理错误:', error);
          return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString(),
            stack: error.stack,
            path: path
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }

      return new Response(JSON.stringify({
        error: '只支持 POST 请求',
        method: request.method,
        timestamp: new Date().toISOString()
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('全局错误:', error);
      return new Response(JSON.stringify({
        error: '服务器内部错误',
        message: error.message,
        timestamp: new Date().toISOString(),
        stack: error.stack
      }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
  }
}

async function handleTranscribe(request, env) {
  let file;
  let audioData;  // 声明在外面
  try {
    const formData = await request.formData();
    file = formData.get('file');
    
    // 添加详细日志
    console.log('文件信息:', {
      name: file.name,
      type: file.type,
      size: file.size,
      source: file.name.includes('VID_') ? '手机' : '电脑'  // 根据文件名判断来源
    });

    audioData = await file.arrayBuffer();  // 使用已声明的变量
    console.log('文件二进制大小:', audioData.byteLength);

    // 记录前 100 个字节的十六进制，用于分析文件头
    const header = new Uint8Array(audioData.slice(0, 100));
    console.log('文件头:', Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '));

    if (!file) {
      return new Response(JSON.stringify({
        error: '未找到文件',
        timestamp: new Date().toISOString()
      }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('开始处理文件:', file.name, 'size:', file.size);

    // 根据文件扩展名设置正确的 Content-Type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let contentType = 'audio/mpeg';  // 默认类型
    
    switch (fileExtension) {
      case 'mp4':
        contentType = 'audio/mp4';
        break;
      case 'mp3':
        contentType = 'audio/mpeg';
        break;
      case 'wav':
        contentType = 'audio/wav';
        break;
      case 'm4a':
        contentType = 'audio/mp4';
        break;
      default:
        console.log('未知的文件类型:', fileExtension);
    }

    // 添加重试机制调用 Whisper API
    const MAX_RETRIES = 3;
    let retries = 0;
    let transcribeResult;
    
    while (retries < MAX_RETRIES) {
      try {
        const transcribeResponse = await fetch(
          'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.HF_TOKEN}`,
              'Content-Type': contentType
            },
            body: audioData
          }
        );

        console.log('Whisper API 响应状态:', transcribeResponse.status);
        
        // 如果模型正在加载，返回 503 状态码和预估时间
        if (transcribeResponse.status === 503) {
          const errorData = await transcribeResponse.json();
          if (errorData.error?.includes('currently loading')) {
            retries++;
            const waitTime = Math.min(errorData.estimated_time * 1000 || 10000, 30000);
            console.log(`模型加载中，等待 ${waitTime/1000} 秒后重试(${retries}/${MAX_RETRIES})...`);
            
            // 返回 503 状态和预估时间给客户端
            return new Response(JSON.stringify({
              error: '模型加载中',
              estimated_time: errorData.estimated_time,
              retry_count: retries,
              max_retries: MAX_RETRIES
            }), {
              status: 503,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': Math.ceil(waitTime / 1000).toString()
              }
            });
          }
        }

        transcribeResult = await transcribeResponse.json();
        console.log('Whisper API 响应内容:', JSON.stringify(transcribeResult));

        if (!transcribeResponse.ok) {
          throw new Error(`转录失败: ${transcribeResponse.status} - ${JSON.stringify(transcribeResult)}`);
        }

        break; // 成功获取结果，跳出循环
      } catch (error) {
        console.error(`转录尝试 ${retries + 1}/${MAX_RETRIES} 失败:`, error);
        if (retries === MAX_RETRIES - 1) throw error;
        retries++;
        // 等待时间递增
        await new Promise(resolve => setTimeout(resolve, 5000 * retries));
      }
    }

    const englishText = transcribeResult.text;
    if (!englishText) {
      throw new Error('转录结果为空');
    }

    // 检查是否为英文文本
    const isEnglish = /^[A-Za-z\s\d.,!?'"()-]+$/.test(englishText.trim());
    if (!isEnglish) {
      throw new Error('转录结果不是英文，请确保输入英文音频');
    }

    // 分割英文句子
    const sentences = englishText
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim())
      .map((text, index) => ({
        id: index + 1,
        original: text,
        translation: null
      }));

    return new Response(JSON.stringify({
      sentences,
      metadata: {
        totalSentences: sentences.length,
        fileType: contentType,
        fileName: file.name,
        fileSize: file.size,
        retryCount: retries
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('转录请求处理错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      details: {
        fileName: file?.name,
        fileSize: file?.size,
        stack: error.stack
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}

async function handleTranslate(request, env) {
  try {
    const { text, id } = await request.json();
    
    if (!text) {
      return new Response('未提供要翻译的文本', { status: 400 });
    }

    // 构建翻译请求
    const translatePayload = {
      model: 'Qwen/Qwen2-VL-72B-Instruct',
      messages: [
        {
          role: 'system',
          content: [{
            type: 'text',
            text: `你是一个专业的翻译助手。请将以下英文文本翻译成中文，遵循以下规则：
1. 保持原文的语气和风格
2. 确保翻译准确、自然
3. 专业术语使用标准中文翻译
4. 只返回翻译结果，不要包含原文或其他内容`
          }]
        },
        {
          role: 'user',
          content: [{
            type: 'text',
            text: text
          }]
        }
      ],
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 1024,
      frequency_penalty: 0.5,
      stream: false
    };

    const translateResponse = await fetch('https://api.siliconflow.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(translatePayload)
    });

    if (!translateResponse.ok) {
      throw new Error(`翻译失败: ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json();
    const translation = translateResult.choices?.[0]?.message?.content?.trim();

    if (!translation) {
      throw new Error('翻译结果为空');
    }

    return new Response(JSON.stringify({
      id,
      translation,
      usage: translateResult.usage
    }), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('翻译请求处理错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
} 