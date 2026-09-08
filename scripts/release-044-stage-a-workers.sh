#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?}"
: "${CLOUDFLARE_ACCOUNT_ID:?}"
: "${RUNNER_TEMP:?}"

cd cloudflare/explore-worker
npm install --no-audit --no-fund --package-lock=false wrangler@4.102.0
rm -rf .release044 && mkdir -p .release044/{preview,test,production,common}

node <<'NODE'
const fs=require('fs'),crypto=require('crypto');
const A=process.env.CLOUDFLARE_ACCOUNT_ID,T=process.env.CLOUDFLARE_API_TOKEN;
const targets={
  preview:{worker:'soridraw-explore-preview',dbName:'soridraw-explore-preview-db',dbId:'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f',r2:'soridraw-profile-media-preview'},
  test:{worker:'soridraw-explore-test',dbName:'soridraw-explore-test-db',dbId:'31817dbd-d06e-415e-9bc0-5553b0f5dc43',r2:'soridraw-profile-media-test'},
  production:{worker:'soridraw-explore-api',dbName:'soridraw-explore-db',dbId:'217ef5b1-5d80-4f7c-afc7-9e07eb05c06b',r2:'soridraw-profile-media'}
};
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
async function g(u){const r=await fetch(u,{headers:{Authorization:`Bearer ${T}`,Accept:'application/json'}}),x=await r.json();if(!r.ok||x.success===false)throw Error('CF '+r.status+' '+JSON.stringify(x).slice(0,800));return x.result||x}
async function active(worker){
  const b=`https://api.cloudflare.com/client/v4/accounts/${A}/workers/scripts/${worker}`;
  const ds=await g(b+'/deployments');
  const deployments=[...(ds.deployments||ds||[])].sort((a,b)=>Date.parse(b.created_on||0)-Date.parse(a.created_on||0));
  const d=deployments[0];
  const a=[...(d?.versions||[])].sort((x,y)=>Number(y.percentage)-Number(x.percentage))[0];
  if(!a?.version_id||Number(a.percentage||0)<99.99)throw Error('single active version missing '+worker);
  const v=await g(`https://api.cloudflare.com/client/v4/accounts/${A}/workers/workers/${worker}/versions/${a.version_id}?include=modules`),mods=v.modules||[],m=mods.find(x=>x.name===(v.main_module||mods[0]?.name))||mods[0];
  if(!m?.content_base64)throw Error('module missing '+worker);
  const source=Buffer.from(m.content_base64,'base64').toString('utf8');
  const settings=await g(b+'/settings');
  return {version:a.version_id,source,settings};
}
(async()=>{
  let commonSha='';
  for(const [name,t] of Object.entries(targets)){
    const a=await active(t.worker),dir='.release044/'+name;
    fs.writeFileSync(dir+'/original.js',a.source);
    fs.writeFileSync(dir+'/before.txt',a.version);
    const sha=h(a.source);
    console.log(`WORKER_BEFORE_${name.toUpperCase()}=${a.version} SHA=${sha}`);
    if(!commonSha)commonSha=sha; else if(sha!==commonSha)throw Error('active Worker sources differ before 044');
    const c={name:t.worker,main:'./worker.js',compatibility_date:String(a.settings.compatibility_date||'2026-09-04').slice(0,10),workers_dev:true,keep_vars:true,d1_databases:[{binding:'DB',database_name:t.dbName,database_id:t.dbId}],r2_buckets:[{binding:'PROFILE_MEDIA',bucket_name:t.r2}],observability:a.settings.observability&&typeof a.settings.observability==='object'?{enabled:a.settings.observability.enabled!==false}:{enabled:true}};
    if(Array.isArray(a.settings.compatibility_flags)&&a.settings.compatibility_flags.length)c.compatibility_flags=a.settings.compatibility_flags;
    fs.writeFileSync(dir+'/wrangler.jsonc',JSON.stringify(c,null,2));
  }
  fs.copyFileSync('.release044/preview/original.js','.release044/common/worker.js');
  console.log('WORKER_SOURCE_PARITY_BEFORE_044=PASS');
})().catch(e=>{console.error(e);process.exit(1)});
NODE

SORIDRAW_REMOTE_WORKER_DIR="$PWD/.release044/common" node "$RUNNER_TEMP/028-explore-like-o1.mjs"
node --check .release044/common/worker.js
node <<'NODE'
const fs=require('fs'),s=fs.readFileSync('.release044/common/worker.js','utf8');
function f(n){let p=s.indexOf('async function '+n+'(');if(p<0)p=s.indexOf('function '+n+'(');if(p<0)throw Error('missing '+n);const b=s.indexOf('{',p);let d=0,q=null,e=false;for(let i=b;i<s.length;i++){const c=s[i];if(q){if(e){e=false;continue}if(c==='\\'){e=true;continue}if(c===q)q=null;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return s.slice(p,i+1)}throw Error('unterminated '+n)}
const rate=f('enforceUserRateLimit'),like=f('adjustExploreLikeCounterDelta'),core=f('handleLikeD1Core');
if(!rate.includes('RETURNING count')||/SELECT\s+count\s+FROM\s+api_rate_limits/i.test(rate))throw Error('rate limit not reduced');
if(!like.includes('RETURNING like_count')||like.includes('env.DB.batch'))throw Error('like counter not reduced');
if(!core.includes('getPublicTrackForWrite')||!core.includes('patchExploreFirstViewLikeCount'))throw Error('like safety/profile sync lost');
console.log('WORKER_PATCH_044_STATIC=PASS');
NODE
for env in preview test production; do cp .release044/common/worker.js ".release044/$env/worker.js"; done

deployed=''
rollback(){
  st=$?
  if [ "$st" -ne 0 ]; then
    echo 'WORKER_044_ROLLBACK=START'
    for env in $deployed; do
      cp ".release044/$env/original.js" ".release044/$env/worker.js"
      npx wrangler deploy --strict --config ".release044/$env/wrangler.jsonc" || true
    done
  fi
  exit "$st"
}
trap rollback EXIT
for env in preview test production; do
  npx wrangler deploy --strict --config ".release044/$env/wrangler.jsonc"
  deployed="$deployed $env"
done
sleep 8

node <<'NODE'
const crypto=require('crypto'),A=process.env.CLOUDFLARE_ACCOUNT_ID,T=process.env.CLOUDFLARE_API_TOKEN;
const names={preview:'soridraw-explore-preview',test:'soridraw-explore-test',production:'soridraw-explore-api'};
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function g(u){const r=await fetch(u,{headers:{Authorization:`Bearer ${T}`,Accept:'application/json'}}),x=await r.json();if(!r.ok||x.success===false)throw Error('CF '+r.status);return x.result||x}
async function newestSource(n){
  const b=`https://api.cloudflare.com/client/v4/accounts/${A}/workers/scripts/${n}`;
  const ds=await g(b+'/deployments');
  const deployments=[...(ds.deployments||ds||[])].sort((a,b)=>Date.parse(b.created_on||0)-Date.parse(a.created_on||0));
  const d=deployments[0],a=[...(d?.versions||[])].sort((x,y)=>Number(y.percentage)-Number(x.percentage))[0];
  if(!a?.version_id) throw Error('version missing '+n);
  const v=await g(`https://api.cloudflare.com/client/v4/accounts/${A}/workers/workers/${n}/versions/${a.version_id}?include=modules`),mods=v.modules||[],m=mods.find(x=>x.name===(v.main_module||mods[0]?.name))||mods[0];
  return {version:a.version_id,source:Buffer.from(m.content_base64,'base64').toString('utf8')};
}
(async()=>{
  let commonSha='';
  for(const [env,n] of Object.entries(names)){
    let a=null;
    for(let i=0;i<10;i++){
      a=await newestSource(n);
      if(a.source.includes('RETURNING count')&&a.source.includes('RETURNING like_count')) break;
      await delay(2000);
    }
    if(!a?.source.includes('RETURNING count')||!a.source.includes('RETURNING like_count')) throw Error('044 RETURNING runtime missing '+env);
    if(/SELECT\s+count\s+FROM\s+api_rate_limits/i.test(a.source)) throw Error('old rate SELECT remains '+env);
    const sha=h(a.source);
    if(!commonSha)commonSha=sha; else if(sha!==commonSha)throw Error('Worker source parity lost '+env);
    console.log(`WORKER_AFTER_${env.toUpperCase()}=${a.version} SHA=${sha}`);
  }
  console.log('WORKER_SOURCE_PARITY_AFTER_044=PASS');
})().catch(e=>{console.error(e);process.exit(1)});
NODE

for spec in \
  'preview|https://soridraw-explore-preview.andrawing1212.workers.dev|https://preview.soridraw.com' \
  'test|https://soridraw-explore-test.andrawing1212.workers.dev|https://test.soridraw.com' \
  'production|https://soridraw-explore-api.andrawing1212.workers.dev|https://soridraw.com'; do
  IFS='|' read -r env base origin <<< "$spec"
  curl -fsS -D "$RUNNER_TEMP/${env}-rev.head" -H "Origin: $origin" "$base/v1/feed-revision?sort=latest" -o "$RUNNER_TEMP/${env}-rev.json"
  grep -qi '^x-soridraw-d1-read-queries: 0' "$RUNNER_TEMP/${env}-rev.head"
  grep -qi '^x-soridraw-d1-write-queries: 0' "$RUNNER_TEMP/${env}-rev.head"
  curl -fsS -H "Origin: $origin" "$base/v1/feed?sort=latest&limit=40" -o "$RUNNER_TEMP/${env}-feed.json"
  grep -q '"ok":true' "$RUNNER_TEMP/${env}-feed.json"
done
trap - EXIT
echo 'WORKERS_044_DEPLOY_AND_SMOKE=PASS'
