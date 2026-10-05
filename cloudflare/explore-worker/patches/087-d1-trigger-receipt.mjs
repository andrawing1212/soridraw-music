import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[087/187] Worker directory missing');
const workerPath = join(dir,'worker.js');
let source = readFileSync(workerPath,'utf8');
const marker = 'SORIDRAW_D1_TRIGGER_RECEIPT_187_20260922';
if (source.includes(marker)) { console.log('[087/187] already applied'); process.exit(0); }

function functionRange(name) {
  const start=source.indexOf('async function '+name+'(');
  if(start<0) throw new Error('[087/187] function missing: '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,comment='';
  for(let i=brace;i<source.length;i+=1){
    const c=source[i],n=source[i+1];
    if(comment==='line'){ if(c==='\n') comment=''; continue; }
    if(comment==='block'){ if(c==='*'&&n==='/'){comment='';i+=1;} continue; }
    if(quote){ if(escaped) escaped=false; else if(c==='\\') escaped=true; else if(c===quote) quote=''; continue; }
    if(c==='/'&&n==='/'){comment='line';i+=1;continue;}
    if(c==='/'&&n==='*'){comment='block';i+=1;continue;}
    if(c==="'"||c==='"'||c==='\`'){quote=c;continue;}
    if(c==='{') depth+=1;
    if(c==='}'&&--depth===0) return {start,end:i+1,text:source.slice(start,i+1)};
  }
  throw new Error('[087/187] unterminated function: '+name);
}

const range=functionRange('adjustExploreLikeCounterDelta');
const old='result[0].meta.changes < 0 || result[0].meta.changes > 1 ||';
if(!range.text.includes(old)) throw new Error('[087/187] legacy trigger-blind receipt guard missing');
let next=range.text.replace(old,'result[0].meta.changes < 0 ||');
next=next.replace(
  "async function adjustExploreLikeCounterDelta(env, trackId, userUid, shouldLike, now) {",
  "async function adjustExploreLikeCounterDelta(env, trackId, userUid, shouldLike, now) {\n  // "+marker+"\n  // D1 meta.changes includes AFTER-trigger side effects; live relation mutations report 2."
);
if(!next.includes(marker)||next.includes('result[0].meta.changes > 1')) {
  throw new Error('[087/187] receipt upgrade did not materialize');
}
source=source.slice(0,range.start)+next+source.slice(range.end);
writeFileSync(workerPath,source,'utf8');
console.log('[087/187] trigger-inclusive D1 receipts accepted; committed relation changes no longer fail as HTTP 500.');
