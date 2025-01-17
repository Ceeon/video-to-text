export interface Env {
  HF_TOKEN: string;
}

export async function onRequest(
  context: { request: Request; env: Env }
) {
  // 处理 CORS
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const formData = await context.request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ error: '未找到文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 调用 Hugging Face API
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${context.env.HF_TOKEN}`
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
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('转录失败:', error);
    return new Response(JSON.stringify({ error: '转录失败' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
} 