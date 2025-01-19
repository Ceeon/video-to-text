export default {
  async fetch(request, env) {
    try {
      console.log('收到请求:', request.method, request.url);
      console.log('请求头:', JSON.stringify(Object.fromEntries(request.headers)));

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
        console.log('请求路径:', path);

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
  let formData;
  let audioData;
  let file;
  
  try {
    console.log('开始解析请求...');
    const requestContentType = request.headers.get('content-type') || '';
    console.log('请求 Content-Type:', requestContentType);

    // 尝试使用 formData
    try {
      formData = await request.formData();
      console.log('FormData 解析成功');
      file = formData.get('file');
      if (!file) {
        throw new Error('FormData 中未找到文件');
      }
      audioData = await file.arrayBuffer();
    } catch (formError) {
      console.error('解析 formData 失败:', formError);
      
      // 如果是 multipart/form-data，需要手动解析
      if (requestContentType.includes('multipart/form-data')) {
        console.log('尝试手动解析 multipart/form-data...');
        const rawData = await request.arrayBuffer();
        const boundary = requestContentType.match(/boundary=([^;]+)/)?.[1];
        
        if (!boundary) {
          throw new Error('未找到 boundary 信息');
        }

        // 将数据转换为字符串以查找文件内容的起始和结束位置
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(rawData);
        
        // 查找文件内容的起始和结束位置
        const fileStart = content.indexOf('\r\n\r\n') + 4;
        const fileEnd = content.lastIndexOf(`\r\n--${boundary}--`);
        
        if (fileStart === -1 || fileEnd === -1) {
          throw new Error('无法定位文件内容');
        }

        // 提取文件内容
        audioData = rawData.slice(fileStart, fileEnd);
        
        // 从头信息中提取文件名
        const contentDisposition = content.match(/filename="([^"]+)"/);
        const fileName = contentDisposition ? contentDisposition[1] : 'recording.mp4';
        
        file = {
          name: fileName,
          size: audioData.byteLength,
          type: 'video/mp4'
        };
        
        console.log('手动解析成功:', {
          fileName,
          fileSize: audioData.byteLength,
          boundary
        });
      } else {
        throw new Error('不支持的请求格式');
      }
    }

    if (!audioData) {
      return new Response(JSON.stringify({
        error: '未能获取文件数据',
        timestamp: new Date().toISOString(),
        details: {
          contentType: requestContentType,
          formDataAvailable: !!formData
        }
      }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    console.log('文件信息:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // 根据文件扩展名设置正确的 Content-Type
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    let mediaContentType = 'audio/mpeg';  // 默认类型
    
    // 支持的音视频格式映射
    const mediaTypes = {
      // 视频格式
      'mp4': 'audio/mp4',
      'mov': 'audio/mp4',
      'avi': 'audio/x-wav',
      'wmv': 'audio/x-wav',
      'flv': 'audio/mp4',
      'mkv': 'audio/mp4',
      'webm': 'audio/webm',
      '3gp': 'audio/mp4',
      
      // 音频格式
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'wma': 'audio/x-wav',
      'flac': 'audio/x-flac',
      'opus': 'audio/opus'
    };

    // 检查是否是支持的格式
    if (!mediaTypes[fileExtension]) {
      throw new Error(`不支持的文件格式：${fileExtension}。支持的格式包括：${Object.keys(mediaTypes).join(', ')}`);
    }

    mediaContentType = mediaTypes[fileExtension];
    console.log('文件类型:', fileExtension, '-> Content-Type:', mediaContentType);

    // 检查文件大小限制
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件过大：${(file.size / 1024 / 1024).toFixed(2)}MB，超过限制 ${MAX_FILE_SIZE / 1024 / 1024}MB。请上传更小的文件或剪辑音频。`);
    }

    // 调用 Whisper API 进行音频转录
    console.log('准备发送 Whisper API 请求...');
    let transcribeResponse;
    let transcribeResult;
    let retryCount = 0;
    const maxRetries = 3;
    const initialRetryDelay = 1000; // 1秒

    while (retryCount < maxRetries) {
      try {
        // 使用标准的 Whisper API 音频格式
        const headers = {
          'Authorization': `Bearer ${env.HF_TOKEN}`,
          'Content-Type': 'audio/x-wav',  // Whisper API 推荐的格式
        };

        console.log('发送请求到 Whisper API:', {
          fileSize: file.size,
          fileName: file.name,
          requestId: Date.now()
        });

        // 创建音频数据
        const audioBlob = new Blob([audioData], { type: 'audio/x-wav' });
        const audioArrayBuffer = await audioBlob.arrayBuffer();

        transcribeResponse = await fetch(
          'https://api-inference.huggingface.co/models/Ce-creator/whisper',  // 使用我们自己的模型
          {
            method: 'POST',
            headers: headers,
            body: audioArrayBuffer
          }
        );

        console.log('Whisper API 响应状态:', transcribeResponse.status);
        
        // 检查响应状态
        if (!transcribeResponse.ok) {
          const errorText = await transcribeResponse.text();
          console.error('API 错误响应:', {
            status: transcribeResponse.status,
            text: errorText,
            requestId: Date.now()
          });
          
          // 针对不同错误类型给出具体提示
          if (transcribeResponse.status === 400) {
            throw new Error('音频处理失败，请确保文件完整且未损坏');
          } else if (transcribeResponse.status === 413) {
            throw new Error('文件太大，请上传更小的文件或剪辑音频（最大支持10MB）');
          } else if (transcribeResponse.status === 503) {
            throw new Error('服务暂时不可用，请稍后重试');
          } else if (transcribeResponse.status === 429) {
            throw new Error('请求过于频繁，请稍后重试');
          } else {
            throw new Error(`API 错误: ${transcribeResponse.status} - ${errorText}`);
          }
        }

        // 获取响应
        const responseText = await transcribeResponse.text();
        console.log('API 原始响应:', responseText);

        try {
          transcribeResult = JSON.parse(responseText);
          console.log('解析后的响应:', transcribeResult);

          // 检查响应格式
          if (!transcribeResult || typeof transcribeResult !== 'object') {
            throw new Error('响应格式不正确');
          }

          // 如果响应成功，跳出重试循环
          break;
        } catch (jsonError) {
          console.error('JSON 解析失败:', jsonError);
          throw new Error('响应解析失败，请重试');
        }
      } catch (error) {
        console.error('调用 Whisper API 失败:', error);
        throw new Error('API 调用失败: ' + error.message);
      }
    }

    // 检查最终响应状态
    if (!transcribeResponse.ok) {
      if (transcribeResponse.status === 503) {
        throw new Error('模型加载超时，请稍后重试');
      }
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

    console.log('转录完成, 共', sentences.length, '个句子');

    return new Response(JSON.stringify({
      sentences,
      metadata: {
        totalSentences: sentences.length,
        fileType: mediaContentType,
        fileName: file.name,
        fileSize: file.size
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
      details: audioData ? {
        fileName: file.name,
        fileSize: file.size,
        stack: error.stack
      } : {
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
  // Implementation of handleTranslate function
}