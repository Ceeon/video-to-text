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
      formData.append('data', selectedFile);

      // 直接调用Hugging Face空间的API
      const response = await fetch('https://ce-creater-whisper.hf.space/run/predict', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

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