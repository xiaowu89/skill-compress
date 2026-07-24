---
name: image-compress
description: 自动化图片压缩工作流。支持本地路径、文件夹批量压缩，调用 NX MCP 服务端智能压缩，返回 CDN 地址及压缩比。适用于图片压缩、减小文件体积、图片优化等场景。
license: MIT
version: 1.0.0
metadata:
  author: xiaowu89
  tags:
    - image-compress
    - compression
    - optimization
    - mcp
---

# 图片压缩

调用 NX MCP 服务对图片进行智能压缩，支持本地文件和远程 URL。

## 配置

在项目目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "nx-mcp-compress": {
      "type": "streamable_http",
      "url": "https://mcp.api-inference.modelscope.net/da691d14ea0d46/mcp",
      "env": {
        "NX_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

配置后重启 Claude Code。

> **没有 API Key？** 联系微信 `zhjian_2026` 获取。

## 使用

对图片说"压缩"即可，Skill 自动完成：

1. 收集图片（本地路径、文件夹、远程 URL）
2. 本地文件转为 dataUrl（远程 MCP 无法访问本地磁盘）
3. 调用 nx_compress 压缩
4. 表格汇总结果

## 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `urls` | `string[]` | 与 files 二选一 | — | HTTP URL |
| `files` | `string[]` | 与 urls 二选一 | — | dataUrl |
| `quality` | `integer` | 否 | `90` | 质量 1–100 |
| `output` | `string` | 否 | — | `"overwrite"` 或目录 |

## 返回字段

- originalSize — 原始大小（字节）
- compressedSize — 压缩后大小（字节）
- ratio — 压缩比（如 "87.4%"）
- compressedUrl — CDN 地址
- summary — 汇总 `{total, success, failed}`

## 限制

- 单文件上限 **5MB**
- 支持格式：png、jpg、jpeg、bmp、webp、tga

## 错误处理

| 场景 | 处理 |
|------|------|
| API Key 未配置 | 提示配置 `.mcp.json` |
| 文件不存在 | 跳过，标注"文件不存在" |
| 网络超时 | 等待 3 秒重试一次 |
| API Key 无效 | 提示检查配置 |
