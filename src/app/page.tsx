'use client';

import React, { useRef, useState } from 'react';

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

      // 将文件转换为 base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]); // 移除 "data:audio/wav;base64," 前缀
        };
        reader.readAsDataURL(selectedFile);
      });

      // 发送请求
      const response = await fetch('https://ce-creater-whisper.hf.space/run/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fn_index: 0,
          data: [base64],
          session_hash: Math.random().toString(36).substring(7)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.data && data.data[0]) {
        setResult(data.data[0]);
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