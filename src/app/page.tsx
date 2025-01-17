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
        throw new Error(`Translation failed: ${response.status}`);
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
      console.error('Failed to translate sentence:', error);
      return false;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');
    console.log('Starting file upload:', selectedFile.name, 'size:', selectedFile.size);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('Sending transcription request...');
      const response = await fetch('https://royal-queen-2868.zhongce-xie.workers.dev/transcribe', {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      console.log('Server response:', response.status, responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
      }

      let data: TranscribeResponse;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON parsing error:', e);
        throw new Error('Invalid server response format');
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
            setError('Some sentences failed to translate, please retry');
            break;
          }
          // Add delay to avoid API limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setTranslating(false);
      } else {
        throw new Error('No valid transcription results received');
      }
    } catch (error) {
      console.error('Processing failed:', error);
      setError(error instanceof Error ? error.message : 'Error processing file');
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
      <h1 className="text-2xl font-bold mb-4">Audio/Video to Text</h1>
      <div className="space-y-6">
        <div className="flex gap-4 items-center">
          <label className="relative cursor-pointer">
            <span className="inline-block px-4 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
              {selectedFile ? selectedFile.name : 'Choose File'}
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
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
          >
            {loading ? 'Processing...' : 'Convert'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600" role="alert">
            {error}
          </div>
        )}

        {metadata && (
          <div className="p-4 bg-gray-50 border rounded">
            <h2 className="font-semibold mb-2">Processing Information</h2>
            <p>Total Sentences: {metadata.totalSentences}</p>
            <p>Token Usage: {metadata.totalTokens}</p>
            {translating && (
              <p className="text-blue-600">
                Translating sentence {currentTranslationIndex} of {metadata.totalSentences}
              </p>
            )}
          </div>
        )}

        {sentences.length > 0 && (
          <div className="border rounded overflow-hidden">
            <div className="grid grid-cols-2 divide-x">
              <div className="p-4 bg-gray-50">
                <h2 className="font-semibold mb-4">Original Text</h2>
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
                <h2 className="font-semibold mb-4">Chinese Translation</h2>
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
                          {currentTranslationIndex >= sentence.id ? 'Translating...' : 'Waiting for translation'}
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