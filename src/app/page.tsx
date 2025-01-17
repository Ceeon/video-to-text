'use client';

import React, { useRef, useState } from 'react';

interface Sentence {
  id: number;
  original: string;
  translation: string | null;
}

interface TranscribeResponse {
  sentences: Sentence[];
  metadata: {
    totalSentences: number;
  };
}

interface TranslateResponse {
  id: number;
  translation: string;
  usage: any;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [metadata, setMetadata] = useState<{ totalSentences: number; totalTokens: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [currentTranslationIndex, setCurrentTranslationIndex] = useState<number>(-1);
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
      setCurrentTranslationIndex(-1);
    }
  };

  const translateSentence = async (sentence: Sentence) => {
    try {
      setCurrentTranslationIndex(sentence.id);
      const response = await fetch('https://royal-queen-2868.zhongce-xie.workers.dev/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sentence.original,
          id: sentence.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`翻译失败: ${response.status}`);
      }

      const result: TranslateResponse = await response.json();
      
      setSentences(prev => prev.map(s => 
        s.id === result.id 
          ? { ...s, translation: result.translation }
          : s
      ));

      setMetadata(prev => ({
        totalSentences: prev?.totalSentences || 0,
        totalTokens: (prev?.totalTokens || 0) + (result.usage?.total_tokens || 0),
      }));

      return true;
    } catch (error) {
      console.error('翻译句子失败:', error);
      return false;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请先选择文件');
      return;
    }

    setLoading(true);
    setError('');
    console.log('开始上传文件:', selectedFile.name, 'size:', selectedFile.size);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('发送转录请求...');
      const response = await fetch('https://royal-queen-2868.zhongce-xie.workers.dev/transcribe', {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      console.log('服务器响应:', response.status, responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
      }

      let data: TranscribeResponse;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON 解析错误:', e);
        throw new Error('服务器返回的数据格式无效');
      }
      
      if (data.sentences && data.sentences.length > 0) {
        console.log('转录成功，开始翻译...');
        setSentences(data.sentences);
        setMetadata({
          totalSentences: data.metadata.totalSentences,
          totalTokens: 0,
        });

        // 开始逐句翻译
        setTranslating(true);
        for (const sentence of data.sentences) {
          console.log(`翻译第 ${sentence.id} 句:`, sentence.original);
          const success = await translateSentence(sentence);
          if (!success) {
            setError('部分句子翻译失败，请重试');
            break;
          }
          // 添加延迟以避免 API 限制
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setTranslating(false);
      } else {
        throw new Error('未获取到有效的转录结果');
      }
    } catch (error) {
      console.error('处理失败:', error);
      setError(error instanceof Error ? error.message : '处理文件时出错');
      setSentences([]);
      setMetadata(null);
    } finally {
      setLoading(false);
      setTranslating(false);
      setCurrentTranslationIndex(-1);
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
            {loading ? '转录中...' : '转换'}
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
            <p>Token 使用: {metadata.totalTokens}</p>
            {translating && (
              <p className="text-blue-600">
                正在翻译第 {currentTranslationIndex} 句，共 {metadata.totalSentences} 句
              </p>
            )}
          </div>
        )}

        {sentences.length > 0 && (
          <div className="border rounded overflow-hidden">
            <div className="grid grid-cols-2 divide-x">
              <div className="p-4 bg-gray-50">
                <h2 className="font-semibold mb-4">原文</h2>
                <div className="space-y-4">
                  {sentences.map((sentence) => (
                    <div 
                      key={`original-${sentence.id}`}
                      className={`p-3 bg-white rounded shadow-sm hover:shadow transition-shadow ${
                        currentTranslationIndex === sentence.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      {sentence.original}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-blue-50">
                <h2 className="font-semibold mb-4">中文翻译</h2>
                <div className="space-y-4">
                  {sentences.map((sentence) => (
                    <div 
                      key={`translation-${sentence.id}`}
                      className={`p-3 bg-white rounded shadow-sm hover:shadow transition-shadow ${
                        currentTranslationIndex === sentence.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      {sentence.translation || (
                        <span className="text-gray-400">
                          {currentTranslationIndex >= sentence.id ? '翻译中...' : '等待翻译'}
                        </span>
                      )}
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