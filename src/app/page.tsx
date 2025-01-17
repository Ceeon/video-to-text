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
      const app = await client("https://ce-creater-whisper.hf.space/");
      const result = await app.predict(1, [
        selectedFile,  // 上传音频文件
      ]);
      
      if (result?.data) {
        setResult(result.data);
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
          aria-label="选择文件"
        />
        <button onClick={handleFileClick}>
          选择文件
        </button>
        {selectedFile && (
          <div>
            <p>已选择: {selectedFile.name}</p>
            <button onClick={handleUpload} disabled={loading}>
              {loading ? '处理中...' : '转换'}
            </button>
          </div>
        )}
        {result && (
          <div role="alert">
            <h3>转换结果:</h3>
            <p>{result}</p>
          </div>
        )}
      </div>
    </main>
  );
} 