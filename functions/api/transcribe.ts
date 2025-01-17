import { client } from '@gradio/client';

export async function onRequest(context: any) {
  try {
    const formData = await context.request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }), 
        { status: 400 }
      );
    }

    // 创建 Gradio 客户端
    const app = await client("Ce-creater/whisper");
    
    // 调用预测
    const result = await app.predict(0, [file]);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to transcribe file' }),
      { status: 500 }
    );
  }
} 