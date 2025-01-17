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
      console.log('选择的文件:', file.name);
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      console.log('请先选择文件');
      return;
    }

    setLoading(true);
    console.log('开始上传文件...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('https://royal-queen-2868.zhongce-xie.workers.dev', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('转录结果:', data);
      setResult(data.text || '转录失败');
    } catch (error) {
      console.error('上传错误:', error);
      setResult('处理文件时出错');
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
          aria-label="选择音频或视频文件"
        />
        <button onClick={handleUpload} disabled={!selectedFile || loading}>
          {loading ? '处理中...' : '转换'}
        </button>
      </div>
      {result && (
        <div role="alert">
          <h3>转录结果:</h3>
          <p>{result}</p>
        </div>
      )}
    </main>
  );
} 