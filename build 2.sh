#!/bin/bash

# 删除现有的 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 安装依赖
npm install --legacy-peer-deps

# 构建项目
npm run build 