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

- **Folder path**: use `ls` to list all `png/jpg/jpeg/webp/bmp/tga` files
- **Single file path**: convert to dataUrl
- **Remote URL**: pass as-is in `urls` parameter

Report total count and file sizes to user. If any file exceeds 5MB, warn user: "File too large, compression not supported for files over 5MB."

### Step 2: Compress — MCP First

**Always try MCP tool first.** Call `nx-mcp-compress` → `nx_compress`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `urls` | `string[]` | One of urls/files | — | HTTP URL or dataUrl |
| `files` | `string[]` | One of urls/files | — | dataUrl format |
| `quality` | `integer` | No | `90` | 1-100 |
| `output` | `string` | No | — | `"overwrite"` or directory path |

### Step 3: Summarize

Display results as a table:

| File | Original | Compressed | Ratio | CDN URL |
|------|----------|------------|-------|---------|

---

## First-Time Setup (MCP unavailable)

If `nx_compress` tool is not found, guide user through configuration:

1. Ask user to create `.mcp.json` in project directory with this content:
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

2. **Tell user to restart Claude Code** after adding the file.
3. **No API Key?** Contact WeChat `zhjian_2026` to get one.
4. After restart, retry MCP tool first. If still unavailable, use the curl fallback below.

---

## Curl Fallback (only after restart + MCP still unavailable)

**Only use this when MCP is confirmed unavailable after restart.** Follow every step exactly — do not skip or reorder.

### Convert local files (Python, not bash)

Bash has length limits on Windows for base64 data. Use Python:

```bash
python -c "
import base64, sys
with open('FILE_PATH', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
print(b64)
"
```

Then prepend `data:image/<mime>;base64,` to the output. MIME: `jpeg` for jpg, else use the file extension.

### Call MCP via curl (3 steps, must follow order)

API Key goes **inside arguments**, not in HTTP headers. Do all 3 steps with the same session:

```bash
NX_KEY="从 .mcp.json 中 env.NX_API_KEY 读取"
MCP_URL="https://mcp.api-inference.modelscope.net/da691d14ea0d46/mcp"
FILES_JSON='["data:image/jpeg;base64,..."]'

# Step 1: Initialize — extract SESSION_ID from response header
SESSION=$(curl -s -i -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"claude-code","version":"1.0"}}}' \
  | grep -i "mcp-session-id" | tr -d '\r' | awk -F': ' '{print $2}')

# Step 2: Send initialized notification (REQUIRED — skip causes "Invalid request parameters")
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# Step 3: Call nx_compress — apiKey goes in arguments, NOT headers
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"nx_compress\",\"arguments\":{\"files\":$FILES_JSON,\"quality\":90,\"apiKey\":\"$NX_KEY\"}}}"
```

**Rules:**
- Never put API Key in HTTP headers (causes `MISSING_API_KEY`)
- Never skip step 2 (causes `Invalid request parameters`)
- Use Python for base64, not bash inline
- All 3 steps share one session
- `$NX_KEY` and `$FILES_JSON` must be single-quoted or properly escaped

---

## Response Fields

- `originalSize` — bytes before compression
- `compressedSize` — bytes after compression
- `ratio` — compression ratio (e.g. "87.4%")
- `compressedUrl` — CDN URL of compressed image

## Error Handling

| Scenario | Action |
|----------|--------|
| MCP tool unavailable | Guide user to create .mcp.json → restart → retry |
| MCP still unavailable after restart | Use curl fallback |
| `MISSING_API_KEY` | Check `.mcp.json` env.NX_API_KEY |
| `API_AUTH_FAILED` | Verify API Key is correct |
| File > 5MB | Skip, tell user "too large" |
| `FILE_NOT_FOUND` | Skip, mark "not found" |
| `REQUEST_TIMEOUT` | Retry once after 3 seconds |

## Limits

- Single file max **5MB**
- Supported formats: png, jpg, jpeg, bmp, webp, tga
