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

    // 调用 Worker API
    const workerResponse = await fetch('https://royal-queen-2868.zhongce-xie.workers.dev', {
      method: 'POST',
      body: formData,
    });

    if (!workerResponse.ok) {
      throw new Error(`Worker API 请求失败: ${workerResponse.status}`);
    }

    const result = await workerResponse.json();

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('处理请求失败:', error);
    return new Response(JSON.stringify({ error: '处理请求失败' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
} 