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

      // 分割英文句子
      const englishSentences = englishText
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim());

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
4. 保持句子的一一对应关系
5. 每个句子单独成行，用 "===" 分隔英文和中文`
            }]
          },
          {
            role: 'user',
            content: [{
              type: 'text',
              text: englishSentences.map(s => `${s}\n=== `).join('\n\n')
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

      // 处理翻译结果
      const translationText = translateResult.choices?.[0]?.message?.content;
      if (!translationText) {
        throw new Error('翻译结果为空');
      }

      // 解析翻译结果
      const translationPairs = translationText
        .split('\n\n')
        .filter(pair => pair.includes('==='))
        .map(pair => {
          const [en, zh] = pair.split('===').map(s => s.trim());
          return { original: en, translation: zh };
        });

      // 验证结果
      if (translationPairs.length === 0) {
        throw new Error('翻译结果解析失败');
      }

      // 返回对齐的结果
      const response = {
        sentences: translationPairs,
        metadata: {
          totalSentences: translationPairs.length,
          usage: translateResult.usage
        }
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