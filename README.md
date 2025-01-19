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

# CORS 配置更新说明

## 更新内容 (2024-03-21)

### CORS 问题修复
修复了跨域请求访问限制的问题，主要更改包括：

1. 添加了完整的 CORS 头部配置：
   ```javascript
   {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
     'Access-Control-Max-Age': '86400',
     'Access-Control-Allow-Credentials': 'true'
   }
   ```

2. 统一了错误处理和响应格式：
   - 所有响应都包含必要的 CORS 头部
   - 错误响应包含详细信息和时间戳
   - 预检请求（OPTIONS）得到正确处理

3. 改进了响应处理流程：
   - 使用统一的响应处理方式
   - 确保所有类型的响应都包含必要的 CORS 头部

### 如何验证
1. 检查预检请求（OPTIONS）是否返回正确的 CORS 头部
2. 验证跨域 POST 请求是否能正常工作
3. 确认错误响应是否包含正确的 CORS 头部

### 注意事项
- 如果仍然遇到 CORS 问题，请检查客户端请求是否包含正确的 `Content-Type` 和 `Authorization` 头部
- 确保客户端代码正确处理预检请求
- 如果使用了自定义域名，可能需要在 Cloudflare 中配置相应的 CORS 规则

# 错误处理改进说明

## 更新内容 (2024-03-21)

### 错误处理优化
改进了文件处理和错误响应机制，主要更改包括：

1. 文件处理错误：
   ```javascript
   {
     error: '未找到文件',
     timestamp: '2024-03-21T08:00:00.000Z'
   }
   ```

2. 服务器错误响应：
   ```javascript
   {
     error: error.message,
     timestamp: '2024-03-21T08:00:00.000Z',
     details: {
       fileName: '文件名（如果存在）',
       fileSize: '文件大小（如果存在）',
       stack: '错误堆栈'
     }
   }
   ```

3. 错误处理改进：
   - 统一了错误响应格式
   - 添加了详细的错误信息
   - 改进了空值处理
   - 添加了时间戳

### 如何验证
1. 上传空文件或不上传文件：应返回 400 错误
2. 上传错误格式文件：应返回详细错误信息
3. 服务器错误：应返回完整的错误详情

### 注意事项
- 所有错误响应都包含 timestamp 字段
- 文件相关信息仅在文件存在时包含
- 错误堆栈信息帮助调试
- 所有响应都是标准的 JSON 格式

# API 重试机制更新说明

## 更新内容 (2024-03-21)

### Whisper API 重试机制
添加了对 Whisper API 503 错误（模型加载中）的智能重试机制：

1. 重试配置：
   ```javascript
   {
     maxRetries: 5,           // 最大重试次数
     initialRetryDelay: 2000, // 初始延迟（毫秒）
     retryStrategy: '指数退避' // 重试策略
   }
   ```

2. 重试策略：
   - 初次失败后等待 2 秒
   - 之后每次失败将等待时间翻倍
   - 最多重试 5 次
   - 总等待时间最长约 62 秒

3. 错误处理：
   - 503 错误：自动重试
   - 其他错误：立即返回错误信息
   - 超过重试次数：返回超时错误

### 使用说明
1. 首次请求如果返回 503，系统会自动重试
2. 每次重试会显示剩余重试次数和等待时间
3. 如果模型仍未加载完成，建议等待几分钟后再试

### 错误响应示例
```javascript
// 重试超时
{
  error: '模型加载超时，请稍后重试',
  timestamp: '2024-03-21T08:00:00.000Z',
  details: {
    retryCount: 5,
    totalWaitTime: '62秒'
  }
}
```

### 注意事项
- 重试机制仅针对 503 错误（模型加载中）
- 其他错误会立即返回，不会重试
- 重试过程中请勿刷新页面
- 如果频繁遇到超时，可能是服务器负载过高

# 支持的媒体格式

## 音视频格式支持说明
所有视频和音频文件在发送到 Whisper API 时都会被转换为相应的音频格式。

## 视频格式
- MP4 -> audio/mp4
- MOV -> audio/mp4
- AVI -> audio/x-wav
- WMV -> audio/x-wav
- FLV -> audio/mp4
- MKV -> audio/mp4
- WebM -> audio/webm
- 3GP -> audio/mp4

## 音频格式
- MP3 -> audio/mpeg
- WAV -> audio/wav
- M4A -> audio/mp4
- AAC -> audio/aac
- OGG -> audio/ogg
- WMA -> audio/x-wav
- FLAC -> audio/x-flac
- OPUS -> audio/opus

## 格式转换说明
1. 视频文件：
   - 所有视频格式会被提取音轨
   - 转换为 Whisper API 支持的音频格式
   - 保持原始音频质量

2. 音频文件：
   - 直接使用原始格式
   - 如果格式不兼容，会自动转换

## 文件限制
- 最大文件大小：25MB
- 建议时长：不超过 10 分钟
- 建议比特率：
  - 音频：128-320kbps
  - 视频音轨：128-256kbps

## 最佳实践
1. 视频文件：
   - 优先使用 MP4 格式
   - 确保音轨质量良好
   - 避免使用过于复杂的编码

2. 音频文件：
   - 优先使用 MP3 或 M4A 格式
   - 使用标准编码
   - 避免使用无损格式（如 FLAC）

3. 转换建议：
   - 如果遇到格式问题，建议先转换为 MP4（视频）或 MP3（音频）
   - 使用 FFmpeg 进行格式转换：
     ```bash
     # 视频转换为 MP4
     ffmpeg -i input.mov -c:v copy -c:a aac output.mp4

     # 音频转换为 MP3
     ffmpeg -i input.wma -c:a libmp3lame -q:a 2 output.mp3
     ```

## 注意事项
1. 文件质量：
   - 确保音频清晰，背景噪音小
   - 视频画面质量不影响转写
   - 人声部分要清晰可辨

2. 格式选择：
   - 优先选择常见格式
   - 避免使用过于冷门的编解码器
   - 如有问题，先转换为推荐格式

3. 性能考虑：
   - 大文件建议压缩或分段
   - 复杂格式可能需要更长处理时间
   - 建议预处理后再上传
