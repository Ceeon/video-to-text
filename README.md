# 音视频转文字应用

一个基于 Cloudflare Worker 的音视频转文字应用，支持英文音频转录和中文翻译。

## 技术架构

### 前端 (Next.js + TypeScript)
- 使用 Next.js 13+ App Router
- TypeScript 类型安全
- Tailwind CSS 样式
- 实时状态管理和进度显示

### 后端 (Cloudflare Worker)
- 处理音频转录和文本翻译
- 支持多种音频格式
- 错误处理和日志记录
- CORS 和缓存控制

### API 集成
1. Whisper API (音频转录)
   - 模型：openai/whisper-large-v3
   - 支持格式：MP3, MP4, WAV, M4A

2. Silicon Flow API (中文翻译)
   - 模型：Qwen/QVQ-72B-Preview
   - 参数优化：temperature=0.2, top_p=0.9

## 实现细节

### 1. 音频处理流程
```javascript
// 1. 文件类型检测
const fileExtension = file.name.split('.').pop()?.toLowerCase();
let contentType = 'audio/mpeg';  // 默认类型

switch (fileExtension) {
  case 'mp4': contentType = 'audio/mp4'; break;
  case 'mp3': contentType = 'audio/mpeg'; break;
  case 'wav': contentType = 'audio/wav'; break;
  case 'm4a': contentType = 'audio/mp4'; break;
}

// 2. 二进制数据处理
const audioData = await file.arrayBuffer();

// 3. API 调用
const response = await fetch(
  'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.HF_TOKEN}`,
      'Content-Type': contentType
    },
    body: audioData
  }
);
```

### 2. 文本处理流程
```javascript
// 1. 英文文本验证
const isEnglish = /^[A-Za-z\s\d.,!?'"()-]+$/.test(englishText.trim());

// 2. 句子分割
const sentences = englishText
  .split(/(?<=[.!?])\s+/)
  .filter(s => s.trim())
  .map((text, index) => ({
    id: index + 1,
    original: text,
    translation: null
  }));
```

### 3. 翻译流程
```javascript
// 1. 翻译请求配置
const translatePayload = {
  model: 'Qwen/Qwen2-VL-72B-Instruct',
  messages: [
    {
      role: 'system',
      content: [{
        type: 'text',
        text: '翻译规则...'
      }]
    },
    {
      role: 'user',
      content: [{ type: 'text', text: text }]
    }
  ],
  temperature: 0.2,
  top_p: 0.9,
  max_tokens: 1024,
  frequency_penalty: 0.5
};

// 2. 逐句翻译
for (const sentence of sentences) {
  const result = await translate(sentence);
  // 添加延迟避免 API 限制
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## 错误处理

### 1. 文件验证
- 检查文件是否存在
- 验证文件类型
- 记录文件大小和名称

### 2. API 错误处理
```javascript
if (!response.ok) {
  throw new Error(`API 错误: ${response.status}`);
}

// 详细错误信息
return new Response(JSON.stringify({ 
  error: error.message,
  timestamp: new Date().toISOString(),
  details: {
    fileName: file?.name,
    fileSize: file?.size,
    stack: error.stack
  }
}), { status: 500 });
```

### 3. 翻译验证
- 检查翻译结果是否为空
- 验证翻译格式
- 记录 Token 使用情况

## 性能优化

1. **缓存控制**
   ```javascript
   headers: {
     'Cache-Control': 'no-cache'
   }
   ```

2. **并发控制**
   - 使用延迟避免 API 限制
   - 单句翻译失败不影响整体

3. **状态管理**
   - 实时更新翻译进度
   - 显示处理信息
   - Token 使用统计

## 环境配置

### 1. Worker 环境变量
```bash
# Hugging Face API Token
wrangler secret put HF_TOKEN

# Silicon Flow API Token
wrangler secret put SF_TOKEN
```

### 2. 开发环境
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 部署 Worker
npx wrangler deploy worker.js
```

## 使用限制

1. **文件大小**
   - 建议不超过 25MB
   - 支持常见音频格式

2. **API 限制**
   - Whisper API: 根据账户额度
   - Silicon Flow API: 需要控制请求频率

3. **翻译质量**
   - 仅支持英文到中文
   - 专业术语可能需要人工校对

## 后续优化

1. **功能增强**
   - [ ] 支持更多音频格式
   - [ ] 添加字幕导出功能
   - [ ] 支持更多语言对

2. **性能优化**
   - [ ] 添加文件压缩
   - [ ] 实现并发翻译
   - [ ] 优化错误重试机制

3. **用户体验**
   - [ ] 添加进度条
   - [ ] 支持翻译编辑
   - [ ] 添加历史记录
