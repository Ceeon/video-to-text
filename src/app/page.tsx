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
      console.log('开始处理文件:', selectedFile.name);

      // 创建 Gradio 客户端
      const app = await client("Ce-creater/whisper");
      console.log('Gradio 客户端创建成功');

      // 将文件转换为 blob
      const fileBlob = new Blob([await selectedFile.arrayBuffer()], { type: selectedFile.type });
      
      // 调用预测 API
      console.log('开始调用预测');
      const result = await app.predict(0, [
        fileBlob, // blob 格式的文件
      ]);
      console.log('预测结果:', result);

      if (result && result.data && result.data[0]) {
        setResult(result.data[0]);
      } else {
        console.error('无效的结果格式:', result);
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