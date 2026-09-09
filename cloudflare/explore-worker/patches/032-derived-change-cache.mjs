import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const marker='SORIDRAW_DERIVED_CHANGE_CACHE_032';
const root=process.env.SORIDRAW_REMOTE_WORKER_DIR;
if(!root) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path=join(root,'worker.js');
let source=readFileSync(path,'utf8').replaceAll('\r\n','\n');
if(!source.includes(marker) && !source.includes('async function derivedNext032(')) {
 const runtime=readFileSync(new URL('../runtime/derived-cache.js',import.meta.url),'utf8');
 for(const [,name] of runtime.matchAll(/^async function (\w+)\(/gm)) {
  const start=source.indexOf(`async function ${name}(`);
  if(start<0) continue;
  let depth=0,quote='',escape=false,comment='',end=-1;
  for(let i=source.indexOf('{',start);i<source.length;i++) {
   const c=source[i],next=source[i+1];
   if(comment==='line'){if(c==='\n')comment='';continue;}
   if(comment==='block'){if(c==='*'&&next==='/'){comment='';i++;}continue;}
   if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}
   if(c==='/'&&next==='/'){comment='line';i++;continue;}
   if(c==='/'&&next==='*'){comment='block';i++;continue;}
   if('"\'`'.includes(c)){quote=c;continue;}
   if(c==='{')depth++;
   if(c==='}'&&--depth===0){end=i+1;break;}
  }
  if(end<0)throw new Error('Unterminated function '+name);
  source=source.slice(0,start)+source.slice(end);
 }
 for(const name of ['mutateExploreR2Cache052','mapTrackRow','encodeCursor','exploreCacheBucket031'])
  if(!source.includes(`function ${name}(`))throw new Error('Required runtime missing '+name);
 source+=`\n// ${marker}\n${runtime}\n`;
 writeFileSync(path,source);
}
console.log('[032] Trigger projections and environment-local CAS cursors replace request-time full rebuilds.');
