'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({ log: true });

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化 FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        await ffmpeg.load();
        setFfmpegLoaded(true);
      } catch (error) {
        console.error('Failed to load FFmpeg:', error);
      }
    };
    loadFFmpeg();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const extractAudio = async (file: File): Promise<Uint8Array> => {
    // 将文件写入 FFmpeg 虚拟文件系统
    ffmpeg.FS('writeFile', 'input', await fetchFile(file));
    
    // 提取音频为 WAV 格式
    await ffmpeg.run('-i', 'input', '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'output.wav');
    
    // 读取转换后的音频
    const data = ffmpeg.FS('readFile', 'output.wav');
    
    // 清理文件系统
    ffmpeg.FS('unlink', 'input');
    ffmpeg.FS('unlink', 'output.wav');
    
    return data;
  };

  const handleUpload = async () => {
    if (!selectedFile || !ffmpegLoaded) return;

    try {
      setLoading(true);
      
      // 如果是视频文件，先提取音频
      let audioData;
      if (selectedFile.type.startsWith('video/')) {
        audioData = await extractAudio(selectedFile);
      } else {
        audioData = new Uint8Array(await selectedFile.arrayBuffer());
      }

      // 发送请求
      const response = await fetch('https://api-inference.huggingface.co/models/Ce-creater/whisper', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/wav',
          'Accept': 'application/json'
        },
        body: audioData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data) && data[0]?.text) {
        setResult(data[0].text);
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

  if (!ffmpegLoaded) {
    return <div>正在加载处理组件...</div>;
  }

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