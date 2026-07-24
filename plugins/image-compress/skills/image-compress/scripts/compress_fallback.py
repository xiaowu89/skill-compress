"""
MCP fallback: direct HTTP call to nx-mcp-compress.
Use ONLY when the MCP tool is confirmed unavailable.
Handles Windows encoding, MCP protocol (session init), and large base64 files.
Usage:
  python scripts/compress_fallback.py --api-key KEY [--files data:...] [--urls https://...] [--quality 90]
"""
import sys, os, json, base64, urllib.request, urllib.error

# Fix Windows GBK encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MCP_URL = "https://mcp.api-inference.modelscope.net/da691d14ea0d46/mcp"

def mcp_request(session_id, method, params=None, request_id=1):
    """Send a JSON-RPC request to the MCP server."""
    body = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params:
        body["params"] = params
    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps(body).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": session_id,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.read().decode('utf-8')

def get_session():
    """Initialize MCP session and return session ID."""
    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "claude-code", "version": "1.0"},
            },
        }).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        session_id = resp.headers.get("Mcp-Session-Id", "")
        if not session_id:
            # Try reading response body for session info
            body = resp.read().decode('utf-8')
            data = json.loads(body)
            session_id = data.get("result", {}).get("sessionId", "")
        return session_id

def compress(api_key, files=None, urls=None, quality=90, output=None):
    """Compress images via MCP HTTP API. Returns parsed result."""
    # Step 1: Initialize
    session_id = get_session()
    if not session_id:
        return {"error": "Failed to get MCP session ID"}

    # Step 2: Send initialized notification
    mcp_request(session_id, "notifications/initialized")

    # Step 3: Build arguments (apiKey goes in arguments, not header)
    args = {"quality": quality, "apiKey": api_key}
    if files:
        args["files"] = files if isinstance(files, list) else [files]
    if urls:
        args["urls"] = urls if isinstance(urls, list) else [urls]
    if output:
        args["output"] = output

    # Step 4: Call tool
    response = mcp_request(session_id, "tools/call", {
        "name": "nx_compress",
        "arguments": args,
    }, request_id=2)

    data = json.loads(response)
    if "error" in data:
        return {"error": data["error"].get("message", str(data["error"]))}
    return data.get("result", data)

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--files", nargs="*", default=[])
    parser.add_argument("--urls", nargs="*", default=[])
    parser.add_argument("--quality", type=int, default=90)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    result = compress(args.api_key, files=args.files, urls=args.urls,
                      quality=args.quality, output=args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
