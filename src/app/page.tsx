'use client';

import React, { useRef, useState } from 'react';
import { client } from '@gradio/client';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      console.log('Starting file upload...');

      // 创建app实例
      const app = await client("Ce-creater/whisper");
      console.log('Client created:', app);

      // 将File对象转换为Blob
      const fileBlob = new Blob([await selectedFile.arrayBuffer()], { type: selectedFile.type });
      console.log('File converted to blob:', fileBlob);

      // 使用API文档中的方式调用
      const result = await app.predict(0, [fileBlob]);
      console.log('Prediction result:', result);

      if (result && result.data && result.data[0]) {
        setResult(result.data[0]);
      } else {
        setResult('无法识别文件内容');
      }
    } catch (error) {
      console.error('Error:', error);
      setResult('处理文件时出错，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="audio/*,video/*"
          style={{ display: 'none' }}
        />
        <button onClick={handleFileClick}>
          选择文件
        </button>
        {selectedFile && (
          <button onClick={handleUpload} disabled={loading}>
            {loading ? '处理中...' : '转换'}
          </button>
        )}
      </div>
      {result && (
        <div>
          <h3>转换结果：</h3>
          <p>{result}</p>
        </div>
      )}
    </main>
  );
} 