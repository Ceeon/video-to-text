'use client';

import React, { useRef, useState } from 'react';

interface Sentence {
  id: number;
  original: string;
  translation: string | null;
}

interface TranscribeMetadata {
  totalSentences: number;
  fileType: string;
  fileName: string;
  fileSize: number;
}

interface TranscribeResponse {
  sentences: Sentence[];
  metadata: TranscribeMetadata;
}

interface TranslateResponse {
  id: number;
  translation: string;
  usage: {
    total_tokens: number;
    completion_tokens: number;
    prompt_tokens: number;
  };
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
      console.log('Selected file:', file.name);
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
      
      // 添加重试机制
      const MAX_RETRIES = 3;
      let retries = 0;
      
      while (retries < MAX_RETRIES) {
        try {
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

          return true;
        } catch (error) {
          retries++;
          if (retries === MAX_RETRIES) throw error;
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      return false;
    } catch (error) {
      console.error('翻译句子失败:', error);
      return false;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请选择文件');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // 添加文件类型检查
      const supportedTypes = [
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav',
        'audio/aac', 'audio/ogg', 'audio/webm', 'audio/x-m4a',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
      ];
      
      if (!supportedTypes.includes(selectedFile.type)) {
        throw new Error(`不支持的文件类型: ${selectedFile.type}`);
      }

      // 添加文件大小检查
      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
      if (selectedFile.size > MAX_FILE_SIZE) {
        throw new Error(`文件大小超过限制: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB > 25MB`);
      }

      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('Sending transcription request...');
      // 添加重试机制
      const MAX_RETRIES = 5;  // 最多重试5次
      let retries = 0;
      
      while (retries < MAX_RETRIES) {
        try {
          const response = await fetch('https://royal-queen-2868.zhongce-xie.workers.dev/transcribe', {
            method: 'POST',
            headers: {
              'Accept': 'application/json'
            },
            body: formData,
          });

      const responseText = await response.text();
      console.log('Server response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body: responseText.slice(0, 1000) // 只记录前 1000 个字符
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
      }

      let data: TranscribeResponse;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON parsing error:', e);
        throw new Error('服务器返回了无效的数据格式');
      }
      
      if (data.sentences && data.sentences.length > 0) {
        console.log('Transcription successful, starting translation...');
        setSentences(data.sentences);
        setMetadata({
          totalSentences: data.metadata.totalSentences,
          totalTokens: 0,
        });

        // Start sentence-by-sentence translation
        setTranslating(true);
        for (const sentence of data.sentences) {
          console.log(`Translating sentence ${sentence.id}:`, sentence.original);
          const success = await translateSentence(sentence);
          if (!success) {
            setError('部分句子翻译失败，请重试');
            break;
          }
          // Add delay to avoid API limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setTranslating(false);
      } else {
        throw new Error('未能识别出任何句子，请检查音频是否清晰');
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
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">
          Audio/Video to Rednote
          <span className="block text-sm text-pink-500 font-normal mt-2">Convert your audio/video to bilingual text ✨</span>
        </h1>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <label className="relative cursor-pointer">
              <span className="inline-block px-6 py-3 bg-white border-2 border-pink-200 text-pink-600 rounded-full hover:bg-pink-50 hover:border-pink-300 transition-all shadow-sm">
                {selectedFile ? (
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a2 2 0 012-2h8a2 2 0 012 2v2h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-2H2a2 2 0 01-2-2V7a2 2 0 012-2h2V3zm2 2v2h8V5H6zm10 4H4v6h12V9z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate max-w-xs">{selectedFile.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Choose File
                  </div>
                )}
              </span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*,video/*"
                aria-label="Select audio or video file"
                className="hidden"
              />
            </label>
            <button 
              onClick={handleUpload} 
              disabled={!selectedFile || loading}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full disabled:opacity-50 hover:from-pink-600 hover:to-rose-600 transition-all shadow-md flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  Convert
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-center" role="alert">
              {error}
            </div>
          )}

          {metadata && (
            <div className="p-6 bg-white border border-pink-100 rounded-lg shadow-sm">
              <h2 className="font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Processing Information
              </h2>
              <div className="space-y-2 text-gray-600">
                <p>Total Sentences: {metadata.totalSentences}</p>
                <p>Token Usage: {metadata.totalTokens}</p>
                {translating && (
                  <p className="text-pink-600 font-medium">
                    Translating sentence {currentTranslationIndex} of {metadata.totalSentences}
                  </p>
                )}
              </div>
            </div>
          )}

          {sentences.length > 0 && (
            <div className="border border-pink-100 rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-pink-100">
                <div className="p-6">
                  <h2 className="font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Original Text
                  </h2>
                  <div className="space-y-4">
                    {sentences.map((sentence) => (
                      <div 
                        key={`original-${sentence.id}`}
                        className={`p-4 bg-gray-50 rounded-lg hover:shadow-md transition-all ${
                          currentTranslationIndex === sentence.id ? 'ring-2 ring-pink-500' : ''
                        }`}
                      >
                        {sentence.original}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-br from-pink-50 to-white">
                  <h2 className="font-semibold mb-4 text-gray-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    Chinese Translation
                  </h2>
                  <div className="space-y-4">
                    {sentences.map((sentence) => (
                      <div 
                        key={`translation-${sentence.id}`}
                        className={`p-4 bg-white rounded-lg hover:shadow-md transition-all ${
                          currentTranslationIndex === sentence.id ? 'ring-2 ring-pink-500' : ''
                        }`}
                      >
                        {sentence.translation || (
                          <span className="text-gray-400 flex items-center gap-2">
                            {currentTranslationIndex >= sentence.id ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Translating...
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                </svg>
                                Waiting for translation
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Section */}
          <div className="mt-12 pt-8 border-t border-pink-100">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Development Team</h2>
              <div className="space-y-6 max-w-sm mx-auto">
                <div className="p-4 bg-white rounded-lg shadow-sm border border-pink-100">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-800">Product & Development</h3>
                  <div className="flex flex-col items-center gap-2 mt-2">
                    <a 
                      href="https://x.com/chengfeng240928"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      @chengfeng240928
                    </a>
                    <a 
                      href="https://x.com/Doooougie"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      @Doooougie
                    </a>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg shadow-sm border border-pink-100">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-800">Mentor</h3>
                  <a 
                    href="https://x.com/PMbackttfuture"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    @PMbackttfuture
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-pink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>正在处理中...</span>
              <span className="text-sm text-gray-500">模型加载可能需要一些时间，请耐心等待</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 