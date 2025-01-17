import { NextResponse } from 'next/server';
import { client } from '@gradio/client';

export const maxDuration = 300; // 设置最大执行时间为 5 分钟

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 创建 Gradio 客户端
    const app = await client("Ce-creater/whisper");
    
    // 调用预测
    const result = await app.predict(0, [file]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe file' },
      { status: 500 }
    );
  }
} 