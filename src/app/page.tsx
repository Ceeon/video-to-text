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

      // 创建FormData对象
      const formData = new FormData();
      formData.append('file', selectedFile);

      // 调用我们的API端点
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

      if (data.data) {
        setResult(data.data);
      } else if (data.error) {
        setResult(data.error);
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