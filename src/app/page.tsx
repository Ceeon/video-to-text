'use client';

import React, { useRef, useState } from 'react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalText, setOriginalText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
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
      console.log('处理结果:', data);
      setOriginalText(data.original || '转录失败');
      setTranslatedText(data.translation || '翻译失败');
    } catch (error) {
      console.error('处理失败:', error);
      setOriginalText('');
      setTranslatedText('处理文件时出错');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">音视频转文字</h1>
      <div className="space-y-4">
        <div className="flex gap-4 items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*,video/*"
            aria-label="选择音频或视频文件"
            className="border p-2 rounded"
          />
          <button 
            onClick={handleUpload} 
            disabled={!selectedFile || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            {loading ? '处理中...' : '转换'}
          </button>
        </div>
        {(originalText || translatedText) && (
          <div className="space-y-4" role="alert">
            {originalText && (
              <div className="border p-4 rounded">
                <h3 className="font-bold mb-2">原文:</h3>
                <p className="whitespace-pre-wrap">{originalText}</p>
              </div>
            )}
            {translatedText && (
              <div className="border p-4 rounded">
                <h3 className="font-bold mb-2">中文翻译:</h3>
                <p className="whitespace-pre-wrap">{translatedText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
} 