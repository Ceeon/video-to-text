# Video to Text

一个使用 Whisper 模型将视频/音频转换为文字的 Web 应用。

## 技术栈

- Next.js 15.1.4
- React
- TypeScript
- Gradio Client

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 部署说明

### Cloudflare Pages 部署配置

1. 构建命令：`npm run build`
2. 输出目录：`.next`
3. Node.js 版本：20.x

### 已知问题及解决方案

1. Gradio Client 构建错误

```
Module build failed: UnhandledSchemeError: Reading from "node:buffer" is not handled by plugins
Module not found: Can't resolve 'net'
Module not found: Can't resolve 'tls'
```

解决方案：

a) 使用原生 fetch API 替代 Gradio Client：
```typescript
const response = await fetch('API_ENDPOINT', {
  method: 'POST',
  body: formData
});
```

b) 或添加 Node.js 兼容性标志：
1. 创建 `.cloudflare/pages.json` 文件
2. 添加以下内容：
```json
{
  "functions": {
    "compatibility_flags": ["nodejs_compat"]
  }
}
```

2. Tailwind CSS 警告

```
warn - No utility classes were detected in your source files
```

解决方案：
- 检查 `tailwind.config.js` 中的 content 配置
- 确保包含了所有使用 Tailwind 类的文件路径

## API 文档

### Whisper 语音转文字 API

接口说明：
- 端点：`Ce-creater/whisper`
- 方法：POST
- 参数：音频文件（支持多种格式）

使用示例：
```typescript
const app = await client("Ce-creater/whisper");
const result = await app.predict("/predict", [audioFile]);
```

## 贡献指南

1. Fork 本仓库
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT
