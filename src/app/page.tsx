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
      console.log('开始处理文件:', selectedFile.name);

      // 将文件转换为 FormData
      const formData = new FormData();
      formData.append('file', selectedFile);

      // 发送请求到 Hugging Face Space
      const response = await fetch('https://ce-creater-whisper.hf.space/run/predict', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API 响应:', data);

      if (data && data.data && data.data[0]) {
        setResult(data.data[0]);
      } else {
        console.error('无效的响应格式:', data);
        setResult('无法识别文件内容');
      }
    } catch (error) {
      console.error('处理错误:', error);
      setResult(`处理文件时出错: ${error.message}`);
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