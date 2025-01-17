export default {
  async fetch(request, env) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
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

      // 调用 Hugging Face API 进行音频转录
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

      if (!transcribeResponse.ok) {
        throw new Error(`转录失败: ${transcribeResponse.status}`);
      }

      const transcribeResult = await transcribeResponse.json();
      const englishText = transcribeResult.text || '';

      // 调用硅基流动 API 进行翻译
      const translateResponse = await fetch('https://api.siliconflow.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'Qwen/QVQ-72B-Preview',
          messages: [
            {
              role: 'system',
              content: [{ type: 'text', text: '你是一个专业的翻译助手，请将以下英文文本翻译成中文，保持原文的语气和风格。' }]
            },
            {
              role: 'user',
              content: [{ type: 'text', text: englishText }]
            }
          ],
          temperature: 0.3, // 降低随机性，使翻译更准确
          max_tokens: 2048
        })
      });

      if (!translateResponse.ok) {
        throw new Error(`翻译失败: ${translateResponse.status}`);
      }

      const translateResult = await translateResponse.json();
      const chineseText = translateResult.choices[0]?.message?.content || '';

      // 返回转录和翻译结果
      return new Response(JSON.stringify({
        original: englishText,
        translation: chineseText
      }), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('处理请求时出错:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
  }
} 