// #203 app489: one-shot PREVIEW Writer postflight, strictly GET-only.
// No mutations, authenticated user sessions, cache repair, deploy or flag changes.
// Desktop/mobile browsers intercept curation API before any Worker D1/R2 read.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activeVersion477, bindings477, source477, route477,
  expectedAppConfig477, browserRuntimeApi477,
} from './verify-477-curated-active-writer-gate.mjs';

const EXPECTED_VERSION='2960d485-fe66-4136-9f84-41ce3e0d4b58';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const TARGET={
  name:'PREVIEW',worker:'soridraw-explore-preview',
  origin:'https://preview.soridraw.com',
  rateDb:'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f',
};
const FLAGS=[
  'SORIDRAW_CURATED_WRITER_SHADOW471',
  'SORIDRAW_CURATED_SHARED_V466',
  'SORIDRAW_CURATED_ALL_WRITERS_READY466',
];
const demand=(ok,reason)=>{if(!ok)throw Error('APP489_'+reason+'_HOLD');};
export function version489(version){
  demand(version===EXPECTED_VERSION,'UNEXPECTED_ACTIVE_PREVIEW_VERSION');
  return true;
}
export function flags489(payload){
  const settings=payload?.result?.bindings;
  demand(Array.isArray(settings),'SETTINGS_UNAVAILABLE');
  const by=new Map();
  for(const binding of settings){
    demand(typeof binding?.name==='string' && binding.name && !by.has(binding.name),'DUPLICATE_BINDING');
    by.set(binding.name,binding);
  }
  for(const name of FLAGS){
    const x=by.get(name);
    demand(!x || x.type==='plain_text' && String(x.text??x.value??'')==='0',
      'READER_OR_SHADOW_FLAG_NOT_OFF');
  }
  return true;
}
function selfTest(){
  assert.equal(version489(EXPECTED_VERSION),true);
  assert.throws(()=>version489('86470d9a-0051-47e7-8ced-f319913f5b58'),/UNEXPECTED_ACTIVE_PREVIEW_VERSION/);
  assert.equal(flags489({result:{bindings:[]}}),true);
  assert.equal(flags489({result:{bindings:[{name:FLAGS[0],type:'plain_text',text:'0'}]}}),true);
  assert.throws(()=>flags489({result:{bindings:[{name:FLAGS[1],type:'plain_text',text:'1'}]}}),/READER_OR_SHADOW_FLAG_NOT_OFF/);
  assert.throws(()=>flags489({result:{bindings:[{name:FLAGS[0],type:'plain_text',text:'0'},{name:FLAGS[0],type:'plain_text',text:'0'}]}}),/DUPLICATE_BINDING/);
  assert.throws(()=>flags489({}),/SETTINGS_UNAVAILABLE/);
  console.log('APP489_VERSION_AND_READER_OFF_NEGATIVE_FIXTURES=PASS');
}
async function live(){
  const token=process.env.CLOUDFLARE_API_TOKEN;
  demand(typeof token==='string'&&token.length>10,'CLOUDFLARE_TOKEN_MISSING');
  demand(!process.env.CLOUDFLARE_ACCOUNT_ID||process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,
    'CLOUDFLARE_ACCOUNT_MISMATCH');
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
  const get=async path=>{
    const res=await fetch(root+path,{method:'GET',headers,signal:AbortSignal.timeout(15000)});
    demand(res.ok,'CLOUDFLARE_HTTP_'+res.status);
    const body=await res.json().catch(()=>null);
    demand(body?.success===true && body.result!=null,'CLOUDFLARE_RESPONSE_UNKNOWN');
    return body;
  };
  expectedAppConfig477(readFileSync('src/config/exploreEnvironment.ts','utf8'),TARGET);
  const worker='/workers/scripts/'+TARGET.worker;
  const active=activeVersion477(await get(worker+'/deployments'),TARGET.name);
  version489(active);
  const remoteSettings=await get(worker+'/settings');
  flags489(remoteSettings);
  bindings477(remoteSettings,TARGET);
  const moduleHash=source477(
    await get('/workers/workers/'+TARGET.worker+'/versions/'+active+'?include=modules'),TARGET.name);
  console.log('APP489_ACTIVE_PREVIEW_WRITER_100_PERCENT_AND_MODULE_ROUTES=PASS bundleHash='+moduleHash);
  console.log('APP489_LIVE_PREVIEW_READER_SHADOW_READY_OFF_AND_BINDINGS=PASS');
  const subdomain=await get(worker+'/subdomain');
  const revision=await fetch('https://'+TARGET.worker+'.andrawing1212.workers.dev/v1/curated-revision?collection=soridraw',{
    method:'GET',headers:{Origin:TARGET.origin,Accept:'application/json'},
    signal:AbortSignal.timeout(15000),
  });
  route477(subdomain,{
    status:revision.status,headers:revision.headers,
    body:await revision.json().catch(()=>null),
  },TARGET);
  console.log('APP489_PREVIEW_PUBLIC_REVISION_GET_ROUTE=PASS');
  for(const [label,viewport] of [
    ['PC',{width:1280,height:800}],
    ['MOBILE',{width:390,height:844}],
  ]){
    const observed=await browserRuntimeApi477(TARGET,viewport);
    demand(observed.observed>0,'BROWSER_'+label+'_RUNTIME_API_NOT_OBSERVED');
    console.log('APP489_PREVIEW_'+label+'_REAL_BROWSER_SELECTED_API=PASS observed='+observed.observed);
  }
  console.log('APP489_READONLY=PASS NO_CANONICAL_WRITE NO_FLAG_UPDATE NO_DEPLOY');
}
if(process.argv.includes('--self-test')) selfTest();
else live().catch(error=>{
  // Sanitized reasons only. Never log token, response body, module source or user data.
  console.error(String(error?.message||'APP489_UNKNOWN_HOLD').replace(/[^A-Za-z0-9_]/g,'').slice(0,150));
  process.exitCode=1;
});
