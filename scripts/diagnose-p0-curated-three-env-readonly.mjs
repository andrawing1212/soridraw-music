// P0: read-only comparison of bounded shared curated D1 membership and 3 public API views.
// No user IDs, raw track IDs, titles, tokens, data modification, or deployment.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const sites = [
  { name:'PREVIEW', base:'https://soridraw-explore-preview.andrawing1212.workers.dev', origin:'https://preview.soridraw.com' },
  { name:'TEST', base:'https://soridraw-explore-test.andrawing1212.workers.dev', origin:'https://test.soridraw.com' },
  { name:'PRODUCTION', base:'https://soridraw-explore-api.andrawing1212.workers.dev', origin:'https://soridraw.com' },
];
const fingerprint = (ids) => crypto.createHash('sha256').update(JSON.stringify(ids)).digest('hex').slice(0,14);
const difference = (a,b) => a.filter((id) => !new Set(b).has(id));
function compare(a,b) {
  return { missing:difference(a,b).length, extra:difference(b,a).length, order:JSON.stringify(a)===JSON.stringify(b) };
}
if (process.argv.includes('--self-test')) {
  assert.deepEqual(compare(['x','y'],['x','y']),{missing:0,extra:0,order:true});
  assert.deepEqual(compare(['x','y'],['y','x']),{missing:0,extra:0,order:false});
  assert.deepEqual(compare(['x','y'],['x','z']),{missing:1,extra:1,order:false});
  console.log('P0_CURATED_COMPARE_SELF_TEST=PASS');
  process.exit(0);
}
async function publicGet(site,route) {
  const response=await fetch(site.base+route,{
    method:'GET',headers:{Accept:'application/json',Origin:site.origin},
    signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(site.name+' public '+route.split('?')[0]+' HTTP '+response.status);
  const json=await response.json();
  if (json?.ok!==true) throw Error(site.name+' invalid public response');
  return {json,headers:response.headers};
}
async function publicSnapshot(site) {
  // HEAD-style revision first: if R2 is absent do NOT fetch the body,
  // which could trigger an automatic R2 derived-cache bootstrap.
  const signal=await publicGet(site,'/v1/curated-revision?collection=soridraw');
  const rev=String(signal.json?.data?.revision||'').trim();
  if (signal.json?.data?.exists!==true || !rev)
    throw Error(site.name+' R2 unavailable: skipped possible lazy bootstrap');
  const result=await publicGet(site,'/v1/curated?collection=soridraw&limit=20');
  const items=result.json?.data?.items;
  if (!Array.isArray(items)||items.length>20) throw Error(site.name+' invalid curated count');
  const ids=items.map((x)=>String(x?.track?.id||'').trim());
  if (ids.some((x)=>!x)||new Set(ids).size!==ids.length) throw Error(site.name+' invalid/duplicate curated IDs');
  const bodyRev=String(result.json?.data?.revision||result.headers.get('x-soridraw-curated-revision')||'').trim();
  if (bodyRev && bodyRev!==rev) throw Error(site.name+' revision changed during probe; no false PASS');
  const writes=result.headers.get('x-soridraw-d1-write');
  if (writes!==null&&Number(writes)!==0) throw Error(site.name+' public endpoint reported unexpected D1 write');
  const source=String(result.headers.get('x-soridraw-curated-source')||'unreported').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
  console.log(site.name+'_CURATED count='+ids.length+' fingerprint='+fingerprint(ids)+' revisionFingerprint='+fingerprint([rev])+' source='+source);
  return ids;
}
async function canonicalSnapshot() {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID||'';
  const token=process.env.CLOUDFLARE_API_TOKEN||'';
  if (!account||!token) throw Error('missing configured read-only Cloudflare access');
  const config=JSON.parse(fs.readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
  const db=(config.d1_databases||[]).find((x)=>x.binding==='DB');
  assert.equal(db?.database_name,'soridraw-explore-db');
  assert.match(String(db.database_id||''),/^[a-f0-9-]{36}$/i);
  const now=Date.now();
  // Bounded SELECT only; no full Feed, no profiles, no user private data.
  const sql="SELECT cp.track_id AS track_id,t.is_public AS is_public,t.status AS status "+
   "FROM curated_picks cp LEFT JOIN tracks t ON t.id=cp.track_id "+
   "WHERE cp.collection_key=? AND (cp.starts_at IS NULL OR cp.starts_at<=?) "+
   "AND (cp.ends_at IS NULL OR cp.ends_at>?) "+
   "ORDER BY cp.sort_order ASC,cp.updated_at DESC,cp.track_id ASC LIMIT 40";
  assert.match(sql,/^SELECT /);
  assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE)\b/i);
  // Cloudflare REST D1 query endpoint requires HTTP POST even for SELECT.
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+
   '/d1/database/'+db.database_id+'/query',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({sql,params:['soridraw',now,now]}),signal:AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error('canonical D1 SELECT HTTP '+response.status);
  const json=await response.json();
  if (json?.success!==true) throw Error('canonical D1 SELECT reported failure');
  const rows=json?.result?.[0]?.results;
  if (!Array.isArray(rows)||rows.length>40) throw Error('invalid bounded D1 result');
  const ids=rows.filter((r)=>Number(r.is_public)===1&&String(r.status||'').toLowerCase()==='published')
    .map((r)=>String(r.track_id||'').trim()).filter(Boolean).slice(0,20);
  if (new Set(ids).size!==ids.length) throw Error('duplicate canonical curated IDs');
  console.log('SHARED_CANONICAL_D1_READONLY rows='+rows.length+' visible20='+ids.length+' fingerprint='+fingerprint(ids));
  return ids;
}
async function main() {
  const canonical=await canonicalSnapshot();
  const views=[];
  for (const site of sites) views.push({name:site.name,ids:await publicSnapshot(site)});
  let fail=false;
  for (const view of views) {
    const result=compare(canonical,view.ids);
    const pass=result.missing===0&&result.extra===0&&result.order;
    console.log(view.name+'_VS_CANONICAL='+(pass?'PASS':'FAIL')+' missing='+result.missing+
      ' extra='+result.extra+' order='+(result.order?'MATCH':'DRIFT'));
    if(!pass)fail=true;
  }
  for (let i=1;i<views.length;i++) {
    const result=compare(views[0].ids,views[i].ids);
    const pass=result.missing===0&&result.extra===0&&result.order;
    console.log('PREVIEW_VS_'+views[i].name+'='+(pass?'PASS':'FAIL')+
      ' missing='+result.missing+' extra='+result.extra+' order='+(result.order?'MATCH':'DRIFT'));
    if(!pass)fail=true;
  }
  console.log('CANONICAL_WRITES=0 DATA_MIGRATION=0 FIREBASE_IO=0 WORKER_DEPLOY=0');
  console.log('P0_CURATED_THREE_ENV_PARITY='+(fail?'FAIL':'PASS'));
  if(fail)process.exitCode=1;
}
main().catch((error)=>{
  // Error messages must never include response payload, bearer credentials, or track IDs.
  const safe=String(error?.message||'unknown').replace(/[^A-Za-z0-9_ .-]/g,'').slice(0,140);
  console.error('P0_CURATED_THREE_ENV_PARITY=UNVERIFIED reason='+safe);
  process.exitCode=2;
});
