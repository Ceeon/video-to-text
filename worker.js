export default {
  async fetch(request, env) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // 只接受 POST 请求
    if (request.method !== 'POST') {
      return new Response('只支持 POST 请求', { status: 405 });
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file) {
        return new Response('未找到文件', { status: 400 });
      }

      console.log('开始处理文件:', file.name, 'size:', file.size);

      // 调用 Whisper API 进行音频转录
      const transcribeResponse = await fetch(
        'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.HF_TOKEN}`
          },
          body: file
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

      console.log('转录文本:', englishText);

      // 调用硅基流动 API 进行翻译
      const translatePayload = {
        model: 'Qwen/Qwen2-VL-72B-Instruct',
        messages: [
          {
            role: 'system',
            content: [{
              type: 'text',
              text: '你是一个专业的翻译助手。请将以下英文文本翻译成中文，保持原文的语气和风格，确保翻译准确、自然。如果遇到专业术语，请使用对应的标准中文翻译。'
            }]
          },
          {
            role: 'user',
            content: [{
              type: 'text',
              text: `请将以下文本翻译成中文：\n\n${englishText}`
            }]
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 4096,
        frequency_penalty: 0.5,
        stream: false
      };

      console.log('发送翻译请求:', JSON.stringify(translatePayload));

      const translateResponse = await fetch('https://api.siliconflow.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(translatePayload)
      });

      console.log('翻译 API 响应状态:', translateResponse.status);
      const translateResult = await translateResponse.json();
      console.log('翻译 API 响应内容:', JSON.stringify(translateResult));

      if (!translateResponse.ok) {
        throw new Error(`翻译失败: ${translateResponse.status} - ${JSON.stringify(translateResult)}`);
      }

      const chineseText = translateResult.choices?.[0]?.message?.content;
      if (!chineseText) {
        throw new Error('翻译结果为空');
      }

      console.log('翻译文本:', chineseText);

      // 返回转录和翻译结果
      const response = {
        original: englishText,
        translation: chineseText,
        usage: translateResult.usage
      };

      console.log('返回结果:', JSON.stringify(response));

      return new Response(JSON.stringify(response), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    } catch (error) {
      console.error('处理请求时出错:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
        stack: error.stack
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
} 