import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '没有找到文件' },
        { status: 400 }
      );
    }

    // 保存文件到临时目录
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempPath = join('/tmp', file.name);
    await writeFile(tempPath, buffer);

    // 执行Python命令
    const command = `python3 -c "
from gradio_client import Client;
client = Client('Ce-creater/whisper');
result = client.predict('${tempPath}', api_name='/predict');
print(result)
"`;

    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('Python error:', stderr);
      return NextResponse.json(
        { error: '处理失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: stdout.trim() });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
} 