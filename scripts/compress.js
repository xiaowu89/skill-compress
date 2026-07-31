#!/usr/bin/env node
// @version 1.2.0
// ===== 图片压缩脚本 =====
// 用法:
//   node compress.js <目录路径> [--key=xxx] [--channel=xxx] [--quality=90] [--output=输出目录]
//   node compress.js <单张图片路径> [--key=xxx] ...
//
// API Key 优先级: --key 参数 > NX_API_KEY 环境变量
// 模式: 全部 HTTP URL → JSON 请求；含本地文件 → FormData 请求
// 分批: ≤20 张 1 批，>20 张均分多批并发

const fs=require('fs'),path=require('path');

// ===== 读取 .env 文件 =====
function loadEnv(){
  const cwd=process.cwd();
  const envFile=path.join(cwd,'.env');
  if(!fs.existsSync(envFile)) return;
  const lines=fs.readFileSync(envFile,'utf-8').split(/\r?\n/);
  for(const line of lines){
    const trimmed=line.trim();
    if(!trimmed||trimmed.startsWith('#')) continue;
    const idx=trimmed.indexOf('=');
    if(idx===-1) continue;
    const key=trimmed.slice(0,idx).trim();
    const val=trimmed.slice(idx+1).trim().replace(/^["']|["']$/g,'');
    if(!process.env[key]) process.env[key]=val;
  }
}
loadEnv();

// ===== 参数解析 =====
const args=process.argv.slice(2);
if(args.length===0||args.includes('-h')||args.includes('--help')){
  console.log('用法: node compress.js <图片目录|单张图片路径> [--key=API_KEY] [--channel=github] [--quality=90] [--output=输出目录] [--urls=url1,url2]');
  console.log('API Key 优先级: --key 参数 > NX_API_KEY 环境变量 > .env 文件');
  process.exit(args.length===0?1:0);
}

let apiKey='';
let channel='';
let inputPath='';
let urlList=[];
let quality=90;
let outputDir='';
for(const arg of args){
  if(arg.startsWith('--key=')){apiKey=arg.slice(6)}
  else if(arg.startsWith('--channel=')){channel=arg.slice(10)}
  else if(arg.startsWith('--urls=')){urlList=arg.slice(7).split(',').filter(Boolean)}
  else if(arg.startsWith('--quality=')){quality=parseInt(arg.slice(10))||90}
  else if(arg.startsWith('--output=')){outputDir=arg.slice(9)}
  else if(!arg.startsWith('--')){inputPath=arg}
}
apiKey=apiKey||process.env.NX_API_KEY||'';
channel=channel||'github';
if(quality<1||quality>100) quality=90;

if(!inputPath&&urlList.length===0){console.log('请提供图片目录/文件路径，或通过 --urls= 传入');process.exit(0);}
if(!apiKey) console.warn('⚠️ NX_API_KEY 未设置，API 可能返回认证错误\n');

if(inputPath) inputPath=path.resolve(inputPath.replace(/\\/g,'/'));

const API_URL='https://ai.nxtici.com/v1/nx/compressImage';
const MAX_SIZE=30*1024*1024;// 30MB，直连 HTTP 无 MCP 限制
const exts=['.png','.jpg','.jpeg','.webp','.bmp','.tga'];

// ===== 主流程 =====
async function main(){
  const localRecords=[];
  const urlRecords=[];
  const totalTasks=[];

  // 阶段 1：验证 Key（先探路，避免大批量请求全部失败）
  let testFile=null;
  if(inputPath){
    const stat=fs.statSync(inputPath);
    if(stat.isFile()){
      const sz=fs.statSync(inputPath).size;
      if(sz<=MAX_SIZE) testFile={path:inputPath,name:path.basename(inputPath),size:sz};
    }else{
      const files=fs.readdirSync(inputPath).filter(f=>exts.includes(path.extname(f).toLowerCase()));
      for(const f of files){
        const fp=path.join(inputPath,f),sz=fs.statSync(fp).size;
        if(sz<=MAX_SIZE){testFile={path:fp,name:f,size:sz};break}
      }
    }
  }
  // Key 验证：仅本地文件模式预先验证（URL 模式首请求自然验证）
  if(testFile){
    try{
      const ext=testFile.name.split('.').pop().toLowerCase();
      const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
      const buf=fs.readFileSync(testFile.path);
      const fd=new FormData();
      fd.append('files',new Blob([buf],{type:`image/${mime}`}),testFile.name);
      fd.append('quality',String(quality));
      const res=await fetch(API_URL,{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'authChannel':channel},body:fd});
      const data=await res.json();
      if(data.code!==0){console.log(`❌ Key 验证失败: ${data.message||'未知错误'}`);console.log('请检查 NX_API_KEY 是否正确后重试');process.exit(0)}
      console.log('Key 验证通过');
    }catch(e){console.log(`❌ Key 验证失败: ${e.message}`);process.exit(0)}
  }

  // 阶段 2：本地文件扫描（如需要）
  if(inputPath){
    const stat=fs.statSync(inputPath);
    const isFile=stat.isFile();
    const PIC_DIR=isFile?path.dirname(inputPath):inputPath;
    const SINGLE_FILE=isFile?path.basename(inputPath):'';

    let imgs;
    if(SINGLE_FILE){
      const ext=path.extname(SINGLE_FILE).toLowerCase();
      if(!exts.includes(ext)){console.error(`不支持的文件格式: ${ext}`);process.exit(1);}
      imgs=[SINGLE_FILE];
    }else{
      imgs=fs.readdirSync(PIC_DIR).filter(f=>exts.includes(path.extname(f).toLowerCase())).sort();
    }

    const origTotal=imgs.reduce((s,f)=>s+fs.statSync(path.join(PIC_DIR,f)).size,0);
    let skipCount=0;
    for(const f of imgs){
      const fp=path.join(PIC_DIR,f),osz=fs.statSync(fp).size;
      if(osz>MAX_SIZE){
        localRecords.push({name:f,origKb:osz,error:'超过30MB限制'});
        skipCount++;
        console.log(`  ${f} ${(osz/1024).toFixed(0)}KB ⚠️ 超过30MB跳过`);
      }else{
        const ext=f.split('.').pop().toLowerCase();
        const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
        const buf=fs.readFileSync(fp);
        localRecords.push({name:f,origKb:osz,buffer:buf,mime:`image/${mime}`});
      }
    }
    const valid=localRecords.filter(r=>r.buffer);
    console.log(`文件 ${imgs.length} 张${urlList.length>0?` + URL ${urlList.length} 个`:''}，总 ${(origTotal/1024).toFixed(0)}KB，可压缩 ${valid.length} 张，跳过 ${skipCount} 张`);
  }else if(urlList.length>0){
    console.log(`URL ${urlList.length} 个（无本地文件）`);
  }

  // 无有效文件且无 URL → 退出
  const pending=localRecords.filter(r=>r.buffer);
  if(pending.length===0&&urlList.length===0){
    console.log('未找到可压缩的图片');
    process.exit(0);
  }

  // 阶段 3：并发压缩（单文件单请求，并发池 5）
  console.time('压缩');

  // 3a：本地文件 —— 单文件单请求，并发池 5
  if(pending.length>0){
    const LIMIT=5;
    let idx=0;
    const running=new Set();
    while(idx<pending.length||running.size>0){
      while(running.size<LIMIT&&idx<pending.length){
        const r=pending[idx];const i=idx;
        const p=(async()=>{
          try{
            const fd=new FormData();
            fd.append('files',new Blob([r.buffer],{type:r.mime}),r.name);
            fd.append('quality',String(quality));
            const res=await fetch(API_URL,{
              method:'POST',
              headers:{'Authorization':`Bearer ${apiKey}`,'authChannel':channel},
              body:fd,
            });
            const data=await res.json();
            if(data.code!==0){
              r.apiError=data.message||'API错误';
              console.log(`  [${i+1}/${pending.length}] ${r.name} ⚠️ ${r.apiError}`);
            }else{
              const items=data.data&&data.data.items||[];
              const item=items[0]||{};
              if(item.error){r.apiError=item.error;console.log(`  [${i+1}/${pending.length}] ${r.name} ❌ ${item.error}`)}
              else{
                r.compUrl=item.compressed_url||item.compressedUrl;
                r.compSize=item.compressed_size||item.compressedSize;
                r.ratio=item.ratio;
                console.log(`  [${i+1}/${pending.length}] ${r.name} ${(r.origKb/1024).toFixed(0)}KB→${(r.compSize/1024).toFixed(0)}KB (${r.ratio})`);
              }
            }
          }catch(e){
            r.apiError=e.message;
            console.log(`  [${i+1}/${pending.length}] ${r.name} ❌ ${e.message}`);
          }
        })().then(()=>running.delete(p));
        running.add(p);idx++;
      }
      if(running.size>0) await Promise.race(running);
    }
  }

  // 2b：URL 独立请求（FormData 模式，urls 字段传 JSON 字符串）
  if(urlList.length>0){
    totalTasks.push((async()=>{
      try{
        const fd=new FormData();
        fd.append('urls',JSON.stringify(urlList));
        fd.append('quality',String(quality));
        const res=await fetch(API_URL,{
          method:'POST',
          headers:{'Authorization':`Bearer ${apiKey}`,'authChannel':channel},
          body:fd,
        });
        const data=await res.json();
        if(data.code!==0){
          console.log(`  [urls] ⚠️ ${data.message||'API错误'}`);
          for(const u of urlList){urlRecords.push({name:u.split('/').pop().split('?')[0],origKb:0,isUrl:true,apiError:data.message||'API错误'})}
        }else{
          const items=data.data&&data.data.items||[];
          for(const item of items){
            const name=(item.original_url||item.originalUrl||'').split('/').pop().split('?')[0]||'?';
            if(item.error){
              urlRecords.push({name,origKb:0,isUrl:true,apiError:item.error});
            }else{
              urlRecords.push({
                name,origKb:0,isUrl:true,
                compUrl:item.compressed_url||item.compressedUrl,
                compSize:item.compressed_size||item.compressedSize,
                ratio:item.ratio,
              });
              console.log(`  [url] ${name} ${item.ratio} ${item.compressed_url||item.compressedUrl||''}`);
            }
          }
        }
      }catch(e){
        console.log(`  [urls] ❌ ${e.message}`);
        for(const u of urlList){urlRecords.push({name:u.split('/').pop().split('?')[0],origKb:0,isUrl:true,apiError:e.message})}
      }
    })());
  }

  await Promise.all(totalTasks);
  console.timeEnd('压缩');

  // 阶段 3：下载到本地（如指定 --output）
  if(outputDir&&(localRecords.some(r=>r.compUrl)||urlRecords.some(r=>r.compUrl))){
    if(!fs.existsSync(outputDir)) fs.mkdirSync(outputDir,{recursive:true});
    console.log(`\n下载到 ${outputDir}:`);
    const dlRecords=[...localRecords,...urlRecords];
    for(const r of dlRecords){
      if(!r.compUrl) continue;
      const outName=r.name||r.compUrl.split('/').pop().split('?')[0];
      const outPath=path.join(outputDir,outName);
      try{
        const dl=await fetch(r.compUrl);
        if(!dl.ok) throw new Error(`HTTP ${dl.status}`);
        const buf=Buffer.from(await dl.arrayBuffer());
        fs.writeFileSync(outPath,buf);
        console.log(`  ✅ ${outName} (${(buf.length/1024).toFixed(0)}KB)`);
      }catch(e){
        console.log(`  ❌ ${outName}: ${e.message}`);
      }
    }
  }

  // 输出表格
  const allRecords=[...localRecords,...urlRecords];
  let passCount=0,failCount=0,totalSaved=0;
  console.log('\n'+'='.repeat(100));
  console.log(`${'文件'.padEnd(36)} ${'原始'.padStart(7)} ${'压缩后'.padStart(7)} ${'压缩率'.padStart(7)} ${'结果'.padStart(4)} 地址`);
  console.log('-'.repeat(100));
  let cdnIdx=0;
  for(const r of allRecords){
    const oszS=r.origKb>0?(r.origKb/1024).toFixed(1)+'KB':(r.isUrl?'URL':'—');
    if(r.compUrl){
      cdnIdx++;
      const cszS=r.compSize?((r.compSize/1024).toFixed(1)+'KB'):'—';
      console.log(`${r.name.padEnd(36)} ${oszS.padStart(7)} ${cszS.padStart(7)} ${(r.ratio||'?').padStart(7)} ${'✅'.padStart(4)} [#${cdnIdx}]`);
      passCount++;
      if(r.origKb>0&&r.compSize) totalSaved+=r.origKb-r.compSize;
    }else if(r.apiError||r.error){
      console.log(`${r.name.padEnd(36)} ${oszS.padStart(7)} ${'—'.padStart(7)} ${'—'.padStart(7)} ${'❌'.padStart(4)} ${r.apiError||r.error}`);
      failCount++;
    }
  }
  const total=allRecords.length;
  console.log(`\n📊 ${total} 张 | ✅ ${passCount} 成功 | ❌ ${failCount} 失败 | 共节省 ${(totalSaved/1024).toFixed(0)}KB`);
  // CDN 地址清单
  const cdnList=allRecords.filter(r=>r.compUrl);
  if(cdnList.length>0){
    console.log(`\n📎 CDN 地址列表:`);
    let n=0;
    for(const r of cdnList){n++;console.log(`  [#${n}] ${r.name} → ${r.compUrl}`)}
  }
}

main().catch(e=>{console.error(e.message);process.exit(1);});
