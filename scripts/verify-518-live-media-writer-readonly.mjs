import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
// app518 explicit one-shot READ-ONLY evidence collector.
// Cloudflare API GET deployments/settings and media GET /health ONLY.
// Never requests R2 keys, Firestore/D1, secrets, deployments or mutations.
// Usage: node scripts/verify-518-live-media-writer-readonly.mjs --live
// Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in env.
// CI: node scripts/verify-518-live-media-writer-readonly.mjs --self-test
import assert from 'node:assert/strict';
import {
 FENCE_CONTRACT_518,MEDIA_TARGETS_518,
} from '../cloudflare/media-worker/src/catalogSharedWriterRolloutGate518.js';
const getValue=(rows,name,type)=>{
 const row=rows.find(x=>x?.name===name&&x?.type===type);
 return row?.text??row?.value??null;
};
const bucket=(rows,name)=>{
 const row=rows.find(x=>x?.name===name&&x?.type==='r2_bucket');
 return row?.bucket_name??row?.bucket??null;
};
export const captureMediaWriterSnapshot518=async({
 request,accountId,token,atMs,
}={})=>{
 if(typeof request!=='function'||!accountId||!token
   ||!Number.isSafeInteger(atMs)||atMs<1)
   throw Error('HOLD_READONLY_CLOUDFLARE_AUTH');
 const root='https://api.cloudflare.com/client/v4/accounts/'
  +encodeURIComponent(accountId)+'/workers/scripts/';
 const workers=[];
 for(const target of MEDIA_TARGETS_518){
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  const read=async suffix=>{
   const response=await request(root+target.script+suffix,{method:'GET',headers});
   if(!response.ok)throw Error('HOLD_CLOUDFLARE_HTTP');
   const json=await response.json();
   if(json?.success!==true)throw Error('HOLD_CLOUDFLARE_RESPONSE');
   return json.result;
  };
  const [deployments,settings]=await Promise.all([
   read('/deployments'),read('/settings'),
  ]);
  const versions=(deployments?.deployments?.[0]?.versions||[]).filter(x=>
   Number(x?.percentage||0)>0).map(x=>({
    versionId:String(x.version_id||''),percentage:Number(x.percentage),
   }));
  const bindings=Array.isArray(settings?.bindings)?settings.bindings:[];
  // No duplicate/missing/secret-shaped bindings can masquerade as the
  // canonical switch being absent or as the correct shared R2 bucket.
  for(const [name,type] of [
   ['MEDIA','r2_bucket'],['CATALOG','r2_bucket'],
   ['SORIDRAW_SHARED_CATALOG_V1','plain_text'],
  ]){
   const matches=bindings.filter(x=>x?.name===name);
   if(matches.length!==1||matches[0]?.type!==type)
    throw Error('HOLD_CLOUDFLARE_AMBIGUOUS_BINDING_'+name);
  }
  const canonicalPresent=bindings.some(x=>x?.name==='SORIDRAW_CANONICAL_CATALOG_518');
  const base='https://'+target.script+'.andrawing1212.workers.dev';
  const origin=target.stage==='preview'?'https://preview.soridraw.com'
    :target.stage==='test'?'https://test.soridraw.com'
    :'https://soridraw.com';
  const healthResponse=await request(base+'/health?writer_fence_probe=518',{
   method:'GET',headers:{Origin:origin,'Cache-Control':'no-cache'},
  });
  if(!healthResponse.ok)throw Error('HOLD_CLOUDFLARE_HEALTH_HTTP');
  const health=await healthResponse.json();
  workers.push({
   stage:target.stage,script:target.script,
   mediaBucket:bucket(bindings,'MEDIA'),catalogBucket:bucket(bindings,'CATALOG'),
   sharedFlag:getValue(bindings,'SORIDRAW_SHARED_CATALOG_V1','plain_text'),
   canonicalFlag:canonicalPresent?'PRESENT':null,
   activeVersions:versions,
   health:health?.catalogWriterFence518??null,
  });
 }
 return {atMs,workers};
};
const selfTest=async()=>{
 const ids=['11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'];
 const fake=async(url,opts)=>{
  assert.equal(opts.method,'GET');
  const target=MEDIA_TARGETS_518.find(x=>url.includes(x.script));
  assert.ok(target);const n=MEDIA_TARGETS_518.indexOf(target);
  if(url.endsWith('/deployments'))return {
   ok:true,async json(){return {success:true,result:{deployments:[{
    versions:[{version_id:ids[n],percentage:100}],
   }]}};},
  };
  if(url.endsWith('/settings'))return {
   ok:true,async json(){return {success:true,result:{bindings:[
    {type:'r2_bucket',name:'MEDIA',bucket_name:target.media},
    {type:'r2_bucket',name:'CATALOG',bucket_name:'soridraw-user-catalog'},
    {type:'plain_text',name:'SORIDRAW_SHARED_CATALOG_V1',text:'1'},
    {type:'secret_text',name:'MEDIA_SIGNING_SECRET',text:'NEVER_SHOW'},
   ]}};},
  };
  assert.ok(url.includes('/health?writer_fence_probe=518'));
  assert.ok(opts.headers.Origin);
  return {ok:true,async json(){return {ok:true,catalogWriterFence518:{
   fenceContract:FENCE_CONTRACT_518,sourceInstalled:true,
   canonicalEnabled:false,
  }};}};
 };
 const snapshot=await captureMediaWriterSnapshot518({
  request:fake,accountId:'test-account',token:'test-token',atMs:100,
 });
 assert.equal(snapshot.workers.length,3);
 assert.deepEqual(snapshot.workers.map(x=>x.activeVersions[0].versionId),ids);
 assert.ok(snapshot.workers.every(x=>x.catalogBucket==='soridraw-user-catalog'
  &&x.canonicalFlag===null));
 assert.ok(!JSON.stringify(snapshot).includes('NEVER_SHOW'));
 assert.ok(!JSON.stringify(snapshot).includes('test-token'));
 console.log('APP518_LIVE_COLLECTOR_GET_ONLY_THREE_WORKERS=PASS');
 console.log('APP518_LIVE_COLLECTOR_NO_SECRETS_NO_R2_DATA=PASS');
};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
if(process.argv.includes('--self-test')){
 await selfTest();
}else if(process.argv.includes('--live')){
 const snap=await captureMediaWriterSnapshot518({
  request:fetch,
  accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
  token:process.env.CLOUDFLARE_API_TOKEN,
  atMs:Date.now(),
 });
 console.log(JSON.stringify({status:'OBSERVATION_ONLY_NOT_DEPLOY_APPROVAL',
  snapshot:snap},null,2));
}else{
 console.error('Use --self-test (offline) or --live (GET-only)');
 process.exitCode=2;
}

}
