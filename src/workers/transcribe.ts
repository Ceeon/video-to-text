/// <reference types="@cloudflare/workers-types" />
import { client } from '@gradio/client';

export interface Env {
  // 如果需要环境变量可以在这里定义
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 处理 CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // 只接受 POST 请求
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      // 获取上传的文件
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file) {
        return new Response('No file uploaded', { status: 400 });
      }

      // 调用 Hugging Face 的 API
      const app = await client("Ce-creater/whisper");
      const result = await app.predict(0, [file]);

      // 返回结果
      return new Response(JSON.stringify({ 
        text: result.data[0] 
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
}; 