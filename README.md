# image-compress

自动化图片压缩 Skill，调用 NX MCP 服务端智能压缩，支持本地文件转换后上传，返回 CDN 地址及压缩比。

## 安装

```bash
git clone https://github.com/xiaowu89/skill-compress.git /tmp/sc && \
cp -r /tmp/sc/plugins/image-compress/skills/image-compress/ ~/.claude/skills/ && \
rm -rf /tmp/sc
```

## 配置

在当前项目目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "nx-mcp-compress": {
      "type": "streamable_http",
      "url": "https://mcp.api-inference.modelscope.net/da691d14ea0d46/mcp",
      "env": {
        "NX_API_KEY": "你的API Key"
      }
    }
  }
}
```

> 没有 API Key？联系微信 xiaowu89 获取。

## 使用

`/image-compress 帮我压缩 E:/images/photo.png`

## 限制

- 远程 MCP 单张限制 **5MB**
- 支持格式：png、jpg、jpeg、bmp、webp、tga

## License

MIT
