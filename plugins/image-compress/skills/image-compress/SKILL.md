---
name: image-compress
description: Automated image compression workflow using server-side smart compression. Supports local paths, folders, and URLs with CDN output and compression ratio reporting. Use when compressing images, reducing file size, or optimizing photos.
license: MIT
compatibility: Requires nodejs and nx-mcp-server with NX_API_KEY configured
metadata:
  author: xiaowu89
  version: 1.0.0
  tags: image-compress, compression, optimization, media
---

# Image Compression

Compress images using the nx-mcp-server remote compression service.

## Compression Workflow

### Step 1: Collect Images

Determine image source:
- **Folder path** (e.g. `E:/images/`): use `ls` to list all `png/jpg/jpeg/webp/bmp/tga` files
- **Single file path**: convert to dataUrl directly
- **Remote URL**: pass as-is in `urls` parameter

Report total count to user before proceeding.

### Step 2: Convert Local Files to dataUrl

Remote MCP cannot access local disk. Use this Python script for reliable base64 conversion (avoid shell command-line length limits on Windows):

```python
import sys, base64, os
path = sys.argv[1]
with open(path, 'rb') as f:
    data = base64.b64encode(f.read()).decode()
ext = os.path.splitext(path)[1].lower().lstrip('.')
mime = 'jpeg' if ext == 'jpg' else ext
print(f'data:image/{mime};base64,{data[:50]}...')  # preview only, pass full value to MCP
```

> Single file limit: **5MB**. Files over 5MB: tell user "File too large, compression not supported for files over 5MB".

### Step 3: Compress

**ALWAYS use MCP tool first.** Call `nx-mcp-compress` → `nx_compress`.

Only if MCP tool is confirmed unavailable (not just returning errors), use the Python fallback script at `scripts/compress_fallback.py`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `urls` | `string[]` | One of urls/files | — | HTTP URL or dataUrl |
| `files` | `string[]` | One of urls/files | — | dataUrl format |
| `quality` | `integer` | No | `90` | 1-100 |
| `output` | `string` | No | — | `"overwrite"` or directory path |
| `apiKey` | `string` | Yes | — | From `.mcp.json` env.NX_API_KEY |

### Step 4: Summarize

Display results as a table:

| File | Original | Compressed | Ratio | CDN URL |
|------|----------|------------|-------|---------|

## Response Fields

- `originalSize` — bytes before compression
- `compressedSize` — bytes after compression
- `ratio` — e.g. "87.4%"
- `compressedUrl` — CDN URL of compressed image
- `summary` — `{total, success, failed}`

## First-Time Setup

The skill auto-detects MCP configuration. If `nx_compress` tool is unavailable:

1. Create `.mcp.json` in project directory (NOT `settings.json`):
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

2. Restart Claude Code after adding.
3. **No API Key?** Contact WeChat `zhjian_2026` to get one.

## Error Handling

| Error | Action |
|-------|--------|
| `MISSING_API_KEY` or `API_AUTH_FAILED` | Check `.mcp.json` env.NX_API_KEY |
| `FILE_NOT_FOUND` | Skip file, mark "not found" in table |
| `DOWNLOAD_FAILED` | Mark ❌, continue with others |
| `REQUEST_TIMEOUT` | Retry once after 3 seconds |

## Limits

- Single file max **5MB**
- Supported formats: png, jpg, jpeg, bmp, webp, tga
