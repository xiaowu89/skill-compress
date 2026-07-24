---
name: image-compress
description: Automated image compression workflow using server-side smart compression. Supports local paths, folders, and URLs with CDN output and compression ratio reporting. Use when compressing images, reducing file size, or optimizing photos.
license: MIT
compatibility: Requires nodejs and nx-mcp-server with NX_API_KEY configured
metadata:
  author: xiaowu89
  version: 1.0.2
  tags: image-compress, compression, optimization, media
---

# Image Compression

Compress images using the nx-mcp-server remote compression service.

## ⚠️ Decision Flow (READ FIRST)

```
MCP tool available?
  ├─ YES → Use it. Done.
  └─ NO  → Check .mcp.json exists with nx-mcp-compress?
              ├─ NO  → Guide user to create .mcp.json (see Setup below).
              │         TELL USER TO RESTART Claude Code. STOP HERE.
              │         Do NOT proceed to curl. Wait for user to restart.
              └─ YES → User confirms they restarted but MCP still unavailable?
                        ├─ NO  → Tell user to restart first. STOP.
                        └─ YES → Use curl fallback (see bottom of this file).
```

**Never skip "restart" step. Never use curl before user confirms they restarted.**

## Compression Workflow

### Step 1: Collect Images

- **Folder path**: use `ls` to list all `png/jpg/jpeg/webp/bmp/tga` files
- **Single file path**: convert to dataUrl
- **Remote URL**: pass as-is

Report total count to user. Skip files > 5MB: "File too large."

### Step 2: Compress (use MCP)

Call `nx-mcp-compress` → `nx_compress`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `urls` | `string[]` | One of urls/files | — | HTTP URL or dataUrl |
| `files` | `string[]` | One of urls/files | — | dataUrl format |
| `quality` | `integer` | No | `90` | 1-100 |
| `output` | `string` | No | — | `"overwrite"` or directory path |

### Step 3: Summarize

| File | Original | Compressed | Ratio | CDN URL |
|------|----------|------------|-------|---------|

---

## Setup (.mcp.json)

If MCP tool is unavailable and `.mcp.json` doesn't exist with `nx-mcp-compress`, create this file in the project directory:

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

Then **tell the user: "Please restart Claude Code to load the MCP server, then try again."** Stop here. Do not attempt curl.

**No API Key?** Contact WeChat `zhjian_2026`.

---

## Curl Fallback

**Only use this after ALL of the following are true:**
1. .mcp.json exists with correct config
2. User has restarted Claude Code
3. MCP tool is still unavailable after restart

### Convert local files to base64 (use Python, not bash)

Bash has command-line length limits on Windows. Use Python:

```bash
python -c "import base64;b64=base64.b64encode(open('FILE_PATH','rb').read()).decode();print(b64)"
```

Prepend `data:image/<mime>;base64,` (mime: `jpeg` for jpg, else use extension).

### MCP via curl — 3 steps, exact order, one session

```bash
NX_KEY="<from .mcp.json env.NX_API_KEY>"
MCP="https://mcp.api-inference.modelscope.net/da691d14ea0d46/mcp"
FILES='["data:image/jpeg;base64,..."]'

# 1. Initialize, capture session ID
SID=$(curl -s -i -X POST "$MCP" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"claude-code","version":"1.0"}}}' | grep -i "mcp-session-id" | tr -d '\r' | awk -F': ' '{print $2}')

# 2. Send initialized (REQUIRED — skip = "Invalid request parameters")
curl -s -X POST "$MCP" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "Mcp-Session-Id: $SID" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3. Compress — apiKey in arguments, NOT headers (headers = MISSING_API_KEY)
curl -s -X POST "$MCP" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "Mcp-Session-Id: $SID" -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"nx_compress\",\"arguments\":{\"files\":$FILES,\"quality\":90,\"apiKey\":\"$NX_KEY\"}}}"
```

---

## Response Fields

- `originalSize` / `compressedSize` — bytes
- `ratio` — e.g. "87.4%"
- `compressedUrl` — CDN URL

## Error Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `MISSING_API_KEY` | apiKey in headers instead of arguments | Put apiKey inside `arguments` object |
| `Invalid request parameters` | Skipped step 2 (initialized notification) | Run step 2 before step 3 |
| MCP tool not found | .mcp.json missing or not restarted | Create config → restart → retry |
