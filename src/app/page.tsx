'use client';

import React, { useRef, useState } from 'react';

interface TranslationPair {
  original: string;
  translation: string;
}

interface TranslationResponse {
  sentences: TranslationPair[];
  metadata: {
    totalSentences: number;
    usage: any;
  };
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sentences, setSentences] = useState<TranslationPair[]>([]);
  const [metadata, setMetadata] = useState<{ totalSentences: number; usage: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('选择的文件:', file.name);
      setSelectedFile(file);
      setSentences([]);
      setMetadata(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请先选择文件');
      return;
    }

    setLoading(true);
    setError('');
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

      const data: TranslationResponse = await response.json();
      console.log('处理结果:', data);
      
      if (data.sentences && data.sentences.length > 0) {
        setSentences(data.sentences);
        setMetadata(data.metadata);
      } else {
        throw new Error('未获取到有效的翻译结果');
      }
    } catch (error) {
      console.error('处理失败:', error);
      setError(error instanceof Error ? error.message : '处理文件时出错');
      setSentences([]);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">音视频转文字</h1>
      <div className="space-y-6">
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
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
          >
            {loading ? '处理中...' : '转换'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600" role="alert">
            {error}
          </div>
        )}

        {metadata && (
          <div className="p-4 bg-gray-50 border rounded">
            <h2 className="font-semibold mb-2">处理信息</h2>
            <p>总句数: {metadata.totalSentences}</p>
            <p>Token 使用: {metadata.usage?.total_tokens || 0}</p>
          </div>
        )}

        {sentences.length > 0 && (
          <div className="border rounded overflow-hidden">
            <div className="grid grid-cols-2 divide-x">
              <div className="p-4 bg-gray-50">
                <h2 className="font-semibold mb-4">原文</h2>
                <div className="space-y-4">
                  {sentences.map((pair, index) => (
                    <div 
                      key={`original-${index}`}
                      className="p-3 bg-white rounded shadow-sm hover:shadow transition-shadow"
                    >
                      {pair.original}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-blue-50">
                <h2 className="font-semibold mb-4">中文翻译</h2>
                <div className="space-y-4">
                  {sentences.map((pair, index) => (
                    <div 
                      key={`translation-${index}`}
                      className="p-3 bg-white rounded shadow-sm hover:shadow transition-shadow"
                    >
                      {pair.translation}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 