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
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response('未找到文件', { status: 400 });
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

    // 获取文件的二进制数据
    const audioData = await file.arrayBuffer();

    // 调用 Whisper API 进行音频转录
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
    const transcribeResult = await transcribeResponse.json();
    console.log('Whisper API 响应内容:', JSON.stringify(transcribeResult));

    if (!transcribeResponse.ok) {
      throw new Error(`转录失败: ${transcribeResponse.status} - ${JSON.stringify(transcribeResult)}`);
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
        fileSize: file.size
      }
    }), {
      headers: {
        'Access-Control-Allow-Origin': '*',
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
        'Access-Control-Allow-Origin': '*',
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