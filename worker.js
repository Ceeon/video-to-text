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

      // 调用 Hugging Face API
      const response = await fetch(
        'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.HF_TOKEN}`
          },
          body: file
        }
      );

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const result = await response.json();

      return new Response(JSON.stringify(result), {
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