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
  let file;
  let requestContentType;
  try {
    console.log('开始解析请求...');
    requestContentType = request.headers.get('content-type') || '';
    console.log('请求 Content-Type:', requestContentType);

    let formData;
    try {
      formData = await request.formData();
      console.log('FormData 解析成功');
    } catch (formError) {
      console.error('解析 formData 失败:', formError);
      
      // 如果是 multipart/form-data 格式，尝试直接读取 body
      if (requestContentType.includes('multipart/form-data')) {
        const arrayBuffer = await request.arrayBuffer();
        console.log('获取到原始数据，大小:', arrayBuffer.byteLength);
        
        // 检查设备类型和请求信息
        const userAgent = request.headers.get('user-agent') || '';
        const isAndroid = userAgent.toLowerCase().includes('android');
        const isIOS = userAgent.toLowerCase().includes('iphone');
        console.log('设备信息:', {
          userAgent,
          isAndroid,
          isIOS,
          originalContentType: requestContentType
        });

        try {
          // 创建新的 FormData
          formData = new FormData();
          
          // 根据设备类型设置不同的 content type
          let blobType = requestContentType;
          if (isAndroid) {
            blobType = 'video/mp4'; // Android 可能是视频格式
          } else if (isIOS) {
            blobType = 'video/quicktime'; // iOS 通常是 MOV 格式
          }
          
          const blob = new Blob([arrayBuffer], { type: blobType });
          const fileName = isIOS ? 'recording.mov' : 'recording.mp4';
          formData.append('file', blob, fileName);
          console.log('已创建新的 FormData:', {
            deviceType: isAndroid ? 'Android' : isIOS ? 'iOS' : 'Other',
            blobType,
            fileName
          });
        } catch (blobError) {
          console.error('创建 Blob 失败:', blobError);
          throw new Error('处理移动端文件失败: ' + blobError.message);
        }
      } else {
        throw formError;
      }
    }

    file = formData.get('file');
    console.log('文件获取状态:', file ? '成功' : '失败');
    
    if (!file) {
      return new Response(JSON.stringify({
        error: '未找到文件',
        timestamp: new Date().toISOString(),
        details: {
          contentType: requestContentType,
          formDataKeys: Array.from(formData.keys())
        }
      }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    console.log('开始处理文件:', {
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
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件大小超过限制：${(file.size / 1024 / 1024).toFixed(2)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // 获取文件的二进制数据
    let audioData;
    try {
      audioData = await file.arrayBuffer();
      console.log('文件读取完成, 大小:', audioData.byteLength, '字节');
    } catch (error) {
      console.error('读取文件数据失败:', error);
      throw new Error('读取文件数据失败: ' + error.message);
    }

    // 调用 Whisper API 进行音频转录（带重试机制）
    console.log('准备发送 Whisper API 请求...');
    let transcribeResponse;
    let transcribeResult;
    let retryCount = 0;
    const maxRetries = 5;
    const initialRetryDelay = 2000; // 2秒

    while (retryCount < maxRetries) {
      try {
        // 针对移动端特殊处理请求头
        const headers = {
          'Authorization': `Bearer ${env.HF_TOKEN}`,
          'Content-Type': mediaContentType,  // 使用文件实际的媒体类型
          'Accept': 'application/json'
        };

        console.log('发送请求到 Whisper API，请求头:', headers);
        
        // 使用分块方式转换 Base64
        function arrayBufferToBase64(buffer) {
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const chunkSize = 1024; // 每次处理 1KB
          
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            chunk.forEach(b => binary += String.fromCharCode(b));
          }
          
          return btoa(binary);
        }
        
        const base64Audio = arrayBufferToBase64(audioData);
        console.log('音频数据已转换为 Base64，长度:', base64Audio.length);
        
        transcribeResponse = await fetch(
          'https://api-inference.huggingface.co/models/Ce-creater/whisper',  // 使用你的模型
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.HF_TOKEN}`,
              'Content-Type': mediaContentType
            },
            body: audioData  // 直接发送二进制数据
          }
        );

        console.log('Whisper API 响应状态:', transcribeResponse.status);
        console.log('Whisper API 响应头:', JSON.stringify(Object.fromEntries(transcribeResponse.headers)));
        
        const responseText = await transcribeResponse.text();
        console.log('Whisper API 原始响应:', responseText);

        // 检查响应是否以 "payload" 开头
        if (responseText.startsWith('payload')) {
          throw new Error('API 返回了无效格式的响应，可能是文件格式问题');
        }

        try {
          // 确保响应是有效的 JSON
          if (!responseText.trim()) {
            throw new Error('响应为空');
          }
          
          // 尝试解析 JSON
          try {
            transcribeResult = JSON.parse(responseText);
          } catch (jsonError) {
            console.error('JSON 解析失败，原始响应:', responseText);
            // 如果是移动端上传的视频，提供更具体的错误信息
            if (file.type.includes('video')) {
              throw new Error('视频文件处理失败，请尝试提取音频后重试');
            } else {
              throw new Error('响应格式错误: ' + jsonError.message);
            }
          }
          
          console.log('Whisper API 解析后的响应:', transcribeResult);

          // 如果不是 503 错误，跳出重试循环
          if (transcribeResponse.status !== 503) {
            break;
          }

          // 如果是 503 错误，等待后重试
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = initialRetryDelay * Math.pow(2, retryCount - 1);
            console.log(`模型正在加载，${delay/1000}秒后重试 (${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error('处理 Whisper API 响应失败:', error);
          throw new Error('处理响应失败: ' + error.message);
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
      details: file ? {
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