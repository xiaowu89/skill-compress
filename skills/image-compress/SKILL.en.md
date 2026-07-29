---
name: image-compress
description: Server-side smart image compression workflow. Supports batch/single-file compression, auto-skips over 5MB files, returns CDN URL and compression ratio. Use when compressing images, reducing file size, or optimizing photos.
license: MIT
compatibility: Requires Node.js >= 18 and nx-mcp-server with NX_API_KEY configured
metadata:
  author: xiaowu89
  version: 1.1.0
  tags:
    - image-compress
    - compression
    - optimization
    - cdn
---

# Image Compression

Compress images using the nx-mcp-server remote compression service.

## Configuration

Create `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "nx-mcp-compress": {
      "type": "url",
      "url": "https://mcp.api-inference.modelscope.net/4378d43d3e7d4c/mcp",
      "env": {
        "NX_API_KEY": "Your API Key"
      }
    }
  }
}
```

Search order: project root -> user home directory. Extract `url` -> `MCP_URL`, `env.NX_API_KEY` -> `API_KEY`.

Skill connects directly to MCP endpoint, **no Claude Code restart required**.

> **No API Key?** Contact WeChat `zhjian_2026` to get one.

## Compression Workflow

### Step 1: Check Configuration

```bash
cat .mcp.json 2>/dev/null || cat ~/.mcp.json 2>/dev/null
```

- Found -> Record `url` and `NX_API_KEY`, continue to Step 2
- Not found -> Ask user if they have an API Key:
  - **Has Key**: Create `~/.mcp.json` in user home (works for both global and project installs)
  - **No Key**: Tell user to contact WeChat `zhjian_2026` to get one

> WARNING: Do not proceed without config.

### Step 2: Run Compression (Single Bash Call, Zero Files)

Replace `PIC_DIR`, `MCP_URL`, `API_KEY`, `QUALITY`, then feed heredoc to node via stdin:

```bash
NODE_PATH=$(npm root -g) node << 'COMPRESSEOF'
const fs=require('fs'),path=require('path');
let PIC_DIR='<absolute image directory path>';
const SINGLE_FILE='<single file path, empty to compress entire directory>';
const MCP_URL='<MCP service URL from .mcp.json>';
const API_KEY='<NX_API_KEY from .mcp.json>';
const QUALITY=90;
(async()=>{
const exts=['.png','.jpg','.jpeg','.webp','.bmp','.tga'];
let imgs;
if(SINGLE_FILE){imgs=[path.basename(SINGLE_FILE)];PIC_DIR=path.dirname(SINGLE_FILE)}
else{imgs=fs.readdirSync(PIC_DIR).filter(f=>exts.includes(path.extname(f).toLowerCase())).sort()}
const origTotal=imgs.reduce((s,f)=>s+fs.statSync(path.join(PIC_DIR,f)).size,0);
console.log(`Total ${imgs.length} images, ${(origTotal/1024).toFixed(0)}KB`);
const maxSize=5*1024*1024;
const records=[];let skip=0;
for(let i=0;i<imgs.length;i++){const f=imgs[i],fp=path.join(PIC_DIR,f),osz=fs.statSync(fp).size;
if(osz>maxSize){records.push({name:f,origKb:osz,compKb:0,compUrl:null,ratio:null,error:'over 5MB limit'});skip++;console.log(`  [${i+1}/${imgs.length}] ${f} ${(osz/1024).toFixed(0)}KB WARNING over 5MB, skipped`);continue}
const buf=fs.readFileSync(fp);const ext=path.extname(f).toLowerCase().slice(1);
const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
records.push({name:f,origKb:osz,compKb:0,compUrl:null,ratio:null,dataUrl:'data:'+mime+';base64,'+buf.toString('base64')});}
console.log(`compressible: ${records.length-skip}, skipped: ${skip}`);
console.time('compression');
const H={'Content-Type':'application/json','Accept':'application/json, text/event-stream'};
const r1=await fetch(MCP_URL,{method:'POST',headers:H,body:JSON.stringify({jsonrpc:'2.0',id:'1',method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'cc',version:'1'}}})});
H['Mcp-Session-Id']=r1.headers.get('Mcp-Session-Id');console.log('MCP: init');
await fetch(MCP_URL,{method:'POST',headers:H,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});console.log('MCP: notified');
let totalSaved=0,pass=0,fail=0;
for(let i=0;i<records.length;i++){const r=records[i];
if(r.error){fail++;continue}
try{
const r3=await fetch(MCP_URL,{method:'POST',headers:H,body:JSON.stringify({jsonrpc:'2.0',id:'3',method:'tools/call',params:{name:'nx_compress',arguments:{files:[r.dataUrl],quality:QUALITY,apiKey:API_KEY}}})});
const raw=await r3.json();
if(!raw.result){r.error='MCP error: '+(raw.error?.message||'unknown');fail++;console.log(`  [${i+1}/${imgs.length}] ${r.name} FAIL ${r.error}`);continue}
const inner=JSON.parse(raw.result.content[0].text);
if(inner.error){r.error=inner.code+': '+inner.error;fail++;console.log(`  [${i+1}/${imgs.length}] ${r.name} FAIL ${r.error}`);continue}
const it=inner.items[0];
if(it.error){r.error=it.error;fail++;console.log(`  [${i+1}/${imgs.length}] ${r.name} FAIL ${it.error}`);}
else{r.compKb=it.compressedSize/1024;r.ratio=it.ratio;r.compUrl=it.compressedUrl;totalSaved+=it.originalSize-it.compressedSize;pass++;console.log(`  [${i+1}/${imgs.length}] ${r.name} ${(r.origKb/1024).toFixed(0)}KB->${(r.compKb).toFixed(0)}KB (${r.ratio})`)}
}catch(e){r.error=e.message;fail++;console.log(`  [${i+1}/${imgs.length}] ${r.name} FAIL ${e.message}`)}
}
console.timeEnd('compression');
console.log('\n'+'='.repeat(100));
console.log(`${'File'.padEnd(40)} ${'Original'.padStart(8)} ${'Compressed'.padStart(8)} ${'Ratio'.padStart(8)} ${'Result'.padStart(6)}`);
console.log('-'.repeat(100));
for(const r of records){const oszS=(r.origKb/1024).toFixed(1)+'KB';
if(r.compUrl){const cszS=(r.compKb).toFixed(1)+'KB';console.log(`${r.name.padEnd(40)} ${oszS.padStart(8)} ${cszS.padStart(8)} ${(r.ratio||'?').padStart(8)} ${'OK'.padStart(6)} ${r.compUrl}`)}
else{console.log(`${r.name.padEnd(40)} ${oszS.padStart(8)} ${'—'.padStart(8)} ${'—'.padStart(8)} ${'FAIL'.padStart(6)}`)}}
console.log(`\nTotal: ${records.length} | OK: ${pass} | FAIL: ${fail} | Saved: ${(totalSaved/1024).toFixed(0)}KB`);
})();
COMPRESSEOF
```

Compression params: `quality` default 90 (1-100), no local sharp needed, server-side compression.

### Suggestions

- OK: Compressed CDN URL ready to use
- WARNING: Over 5MB, exceeds server limit, handle manually
- FAIL: Retry once

---

## Response Fields Reference

| Field | Type | Description |
|------|------|------|
| `originalSize` | `number` | original size (bytes) |
| `compressedSize` | `number` | compressed size (bytes) |
| `ratio` | `string` | compression ratio, e.g. `"71.5%"` |
| `compressedUrl` | `string` | CDN URL |

## Common Errors Reference

| Error | Cause | Solution |
|------|------|------|
| `MISSING_API_KEY` | Missing `apiKey` | Must be provided |
| `API_AUTH_FAILED` | Invalid API Key | Check Key in `.mcp.json` |
| `-32602 Invalid request parameters` | Missing `notifications/initialized` | Must follow 3 steps: init -> notified -> call |
| `406 Not Acceptable` | Missing `Accept` header | Include both `application/json` and `text/event-stream` |
| File over 5MB skipped | Server-side limit | Tell user to handle manually |

## Prohibited Actions

- DO NOT compress locally (server-side compression, no need for local sharp)
- DO NOT pass `output` parameter (does not exist)
- DO NOT omit `apiKey` parameter
- DO NOT skip `notifications/initialized` step
- DO NOT write any temp files (heredoc directly to stdin, pure memory execution)
- DO NOT split into multiple Bash calls (one `node << 'COMPRESSEOF'` handles all)
- DO NOT use backslash paths, always use forward slashes (`d:/path`)
