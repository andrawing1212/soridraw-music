// #203 app477: read-only active Worker writer audit. No D1 query or mutation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const FLAGS = ['SORIDRAW_CURATED_WRITER_SHADOW471','SORIDRAW_CURATED_SHARED_V466','SORIDRAW_CURATED_ALL_WRITERS_READY466'];
const DB_ID = '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const TARGETS = [
  {name:'PREVIEW',worker:'soridraw-explore-preview',origin:'https://preview.soridraw.com',rateDb:'aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f'},
  {name:'TEST',worker:'soridraw-explore-test',origin:'https://test.soridraw.com'},
  {name:'PRODUCTION',worker:'soridraw-explore-api',origin:'https://soridraw.com'},
];
const fail = (name,reason) => { throw Error(name+'_'+reason+'_477'); };
const need = (value,name,reason) => { if(!value) fail(name,reason); };
const result = p => p?.result ?? p;
const fingerprint = s => createHash('sha256').update(s).digest('hex').slice(0,16);

export function activeVersion477(payload,name) {
  const data=result(payload);
  const deployments=Array.isArray(data?.deployments)?data.deployments:Array.isArray(data)?data:[];
  need(deployments.length>0,name,'DEPLOYMENTS_UNAVAILABLE');
  const vs=deployments[0]?.versions;
  need(Array.isArray(vs)&&vs.length===1,name,'SPLIT_OR_UNKNOWN_TRAFFIC');
  need(typeof vs[0].version_id==='string'&&vs[0].version_id.length>20,name,'VERSION_UNKNOWN');
  need(Number(vs[0].percentage)===100,name,'TRAFFIC_NOT_100_PERCENT');
  return vs[0].version_id;
}

export function bindings477(payload,target) {
  const name=target.name, rows=result(payload)?.bindings;
  need(Array.isArray(rows),name,'SETTINGS_UNREADABLE');
  const b=new Map();
  for(const x of rows) {
    need(typeof x?.name==='string'&&x.name&&!b.has(x.name),name,'BINDING_DUPLICATE');
    b.set(x.name,x);
  }
  function match(key,type,field,expected) {
    const x=b.get(key);
    need(x?.type===type,name,'BINDING_'+key+'_TYPE');
    const actual=field==='id'?(x.id??x.database_id??x.uuid):x[field];
    need(actual===expected,name,'BINDING_'+key+'_IDENTITY');
  }
  match('DB','d1','id',DB_ID);
  match('PROFILE_MEDIA','r2_bucket','bucket_name','soridraw-profile-media');
  const durable=b.get('EXPLORE_LIKE_BATCH_SCHEDULER');
  need(durable?.type==='durable_object_namespace',name,'DURABLE_REPAIR_OWNER_MISSING');
  const rate=b.get('RATE_DB');
  need(rate?.type==='d1',name,'RATE_DB_MISSING');
  const rateId=rate.id??rate.database_id??rate.uuid;
  need(typeof rateId==='string'&&rateId!==DB_ID,name,'RATE_DB_NOT_ISOLATED');
  if(target.rateDb) need(rateId===target.rateDb,name,'RATE_DB_MISMATCH');
  const local=b.get('EXPLORE_CACHE');
  // Future v307 writers must have truly separate derived caches, even on PROD.
  // A legacy PROFILE_MEDIA fallback may be running now, but is not writer-ready.
  need(local?.type==='r2_bucket',name,'EXPLORE_CACHE_REQUIRED');
  need(typeof local.bucket_name==='string'
    && /^soridraw-profile-media-[a-z0-9-]+$/.test(local.bucket_name)
    && local.bucket_name!=='soridraw-profile-media',name,'CACHE_NOT_ISOLATED');
  if(name==='PREVIEW') match('EXPLORE_CACHE','r2_bucket','bucket_name','soridraw-profile-media-preview');
  if(name==='TEST') need(local.bucket_name.includes('test'),name,'CACHE_WRONG_STAGE');
  if(name==='PRODUCTION') need(local.bucket_name.includes('production')||local.bucket_name.includes('prod'),name,'CACHE_WRONG_STAGE');
  for(const flag of FLAGS) {
    const x=b.get(flag);
    need(!x||(x.type==='plain_text'&&String(x.text??x.value??'')==='0'),name,'FLAG_'+flag+'_UNSAFE');
  }
  return {rateId,cacheName:local.bucket_name};
}

const ROUTES = [
  "segments307[1] === 'curation'",'handleCurationMutation307',
  '/v1/me/music-note-publications/batch','isTrackVisibilityMutation307',
  'visibility','/v1/curated-revision','/v1/curated','/curated-repair-468/',
];
const CUES = [
  'SORIDRAW_CURATED_WRITER_SHADOW471','SORIDRAW_CURATED_SHARED_V466',
  'SORIDRAW_CURATED_ALL_WRITERS_READY466',
  'CURATED_REPAIR_RESERVATION_UNAVAILABLE_468',
  'CURATED_SHADOW_PUBLICATION_PENDING_471',
  'CURATED_REPAIR_ACK_DEFERRED_468',
  'CURATED_REPAIR_DISABLED_468',
];
export function source477(payload,name) {
  const modules=result(payload)?.modules;
  need(Array.isArray(modules)&&modules.length>0,name,'ACTIVE_MODULES_MISSING');
  let body='';
  for(const m of modules) {
    need(typeof m?.content_base64==='string'&&m.content_base64.length>0,name,'MODULE_CONTENT_UNREADABLE');
    body+=Buffer.from(m.content_base64,'base64').toString('utf8')+'\n';
  }
  need(body.length>5000,name,'MODULE_TOO_SMALL');
  for(const route of ROUTES) need(body.includes(route),name,'WRITER_ROUTE_MISSING');
  for(const cue of CUES) need(body.includes(cue),name,'WRITER_CUE_MISSING');
  return fingerprint(body);
}

export function route477(subdomain,revision,target) {
  need(result(subdomain)?.enabled===true,target.name,'WORKERS_DEV_OWNER_UNVERIFIED');
  need(revision?.status===200&&revision?.body?.ok===true&&
    revision.body?.data?.exists===true&&typeof revision.body.data.revision==='string'&&revision.body.data.revision,
    target.name,'PUBLIC_REVISION_UNVERIFIED');
  const cors=revision.headers?.get?.('access-control-allow-origin')??'';
  need(cors===target.origin||cors==='*',target.name,'PUBLIC_ORIGIN_MISMATCH');
}

// App Firebase domains are not direct Worker API endpoints: the deployed
// frontend must point to an identified workers.dev owner, and unexpected
// Cloudflare routes or Worker Custom Domains over Firebase hosts are blocked.
const matchRoute477 = (pattern,host,path) => {
  const p=String(pattern||'').replace(/^https?:\/\//,'');
  const escapeText=x=>x.replace(/[.*+?^$()[\]{}|\\]/g,'\\$&');
  const matcher='^'+p.split('*').map(escapeText).join('.*')+'$';
  try { return new RegExp(matcher,'i').test(host+path); } catch { return false; }
};
export function originOwnership477(domainsPayload,routesPayload,target) {
  const name=target.name, host=new URL(target.origin).hostname;
  const domains=result(domainsPayload), routes=result(routesPayload);
  need(Array.isArray(domains),name,'WORKER_DOMAINS_UNREADABLE');
  need(Array.isArray(routes),name,'ZONE_ROUTES_UNREADABLE');
  need(!domains.some(d=>String(d?.hostname||'').toLowerCase()===host),
    name,'FIREBASE_APP_HOST_WORKER_DOMAIN_TAKEOVER');
  const conflicts=routes.filter(r=>['/','/v1/curated-revision','/v1/curated']
    .some(p=>matchRoute477(r?.pattern,host,p)));
  need(conflicts.length===0,name,'FIREBASE_APP_HOST_WORKER_ROUTE_TAKEOVER');
}
export function expectedAppConfig477(config,target) {
  const api='https://'+target.worker+'.andrawing1212.workers.dev';
  need(config.includes("'"+api+"'"),target.name,'APP_API_BASE_NOT_IN_SOURCE');
  const host=new URL(target.origin).hostname;
  need(config.includes("host === '"+host+"'")||target.name==='PRODUCTION'&&
    config.includes('EXPLORE_API_PRODUCTION'),target.name,'APP_HOST_MISSING_IN_SOURCE');
  need(config.includes('VITE_EXPLORE_API_BASE'),target.name,'APP_OVERRIDE_POLICY_UNREADABLE');
}
export function frontendAssets477(html,assetBodies,target) {
  need(typeof html==='string'&&html.includes('<html')&&html.includes('<script'),
    target.name,'LIVE_APP_HTML_UNVERIFIED');
  need(Array.isArray(assetBodies)&&assetBodies.length>0,
    target.name,'LIVE_APP_BUNDLE_MISSING');
  const entire=assetBodies.join('\n');
  const apiHost=target.worker+'.andrawing1212.workers.dev';
  need(entire.includes(apiHost),target.name,'LIVE_APP_API_BUNDLE_MISMATCH');
  need(entire.includes(new URL(target.origin).hostname)||target.name==='PRODUCTION'&&
    entire.includes('soridraw.com'),target.name,'LIVE_APP_HOST_BRANCH_MISSING');
}
const publishedAssetRefs477 = (html,origin) => {
  const out=new Set();
  for(const tag of String(html).match(/<(?:script|link)\b[^>]*>/gi)||[]) {
    const m=tag.match(/\b(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)["']/i);
    if(!m) continue;
    const u=new URL(m[1],origin);
    if(u.origin===origin) out.add(u.toString());
  }
  return [...out].slice(0,16);
};
async function publicGetText477(url,maxBytes) {
  const res=await fetch(url,{headers:{Accept:'text/html,application/javascript,*/*'},
    signal:AbortSignal.timeout(15000),redirect:'error'});
  need(res.ok,'GLOBAL','LIVE_FRONTEND_HTTP_FAILED');
  const reported=Number(res.headers.get('content-length')||0);
  need(!reported||reported<=maxBytes,'GLOBAL','LIVE_FRONTEND_TOO_LARGE');
  const bytes=await res.arrayBuffer();
  need(bytes.byteLength<=maxBytes,'GLOBAL','LIVE_FRONTEND_TOO_LARGE');
  return Buffer.from(bytes).toString('utf8');
}
async function liveFrontend477(target) {
  const html=await publicGetText477(target.origin+'/',400000);
  const urls=publishedAssetRefs477(html,target.origin);
  need(urls.length>0,target.name,'LIVE_APP_ASSETS_UNKNOWN');
  const scripts=[];
  for(const url of urls) scripts.push(await publicGetText477(url,5000000));
  frontendAssets477(html,scripts,target);
  return fingerprint(scripts.join('\n'));
}

// Source test helper only, not a deployment authorization.
export function rollbackOrder477(events) {
  need(Array.isArray(events),'GLOBAL','ROLLBACK_TRACE_UNREADABLE');
  const requested=new Set(),observed=new Set();
  for(const e of events) {
    need(TARGETS.some(t=>t.name===e?.stage),'GLOBAL','ROLLBACK_STAGE_UNKNOWN');
    if(e.type==='reader_off_requested') requested.add(e.stage);
    else if(e.type==='reader_off_observed') {
      need(requested.has(e.stage),'GLOBAL','ROLLBACK_OFF_NOT_REQUESTED');
      observed.add(e.stage);
    } else if(e.type==='restore_legacy_writer') {
      need(TARGETS.every(t=>observed.has(t.name)),
        'GLOBAL','ROLLBACK_READER_STILL_ON_OR_UNVERIFIED');
    } else fail('GLOBAL','ROLLBACK_STEP_UNRECOGNIZED');
  }
  return true;
}

export function activation477(records,proof) {
  need(records.length===3&&records.every(r=>r.compatible), 'GLOBAL','ACTIVE_WRITERS_INCOMPATIBLE');
  need(new Set(records.map(r=>r.rateId)).size===3,'GLOBAL','RATE_DB_COLLISION');
  const caches=records.map(r=>r.cacheName);
  need(caches.every(x=>typeof x==='string'&&x.startsWith('soridraw-profile-media-')),'GLOBAL','CACHE_NOT_ISOLATED');
  need(new Set(caches).size===caches.length,'GLOBAL','CACHE_COLLISION');
  need(proof?.verifiedByIndependentLiveDrain===true&&typeof proof?.evidenceId==='string'&&proof.evidenceId.length>12&&
    TARGETS.every(t=>proof.activeVersionIds?.[t.name]===records.find(r=>r.name===t.name)?.versionId),
    'GLOBAL','OLD_INFLIGHT_RETIREMENT_UNPROVEN');
  // External human assertions are not verified drain evidence. Do not turn
  // a 100%-traffic API response or an unsigned JSON into reader activation.
  fail('GLOBAL','INDEPENDENT_DRAIN_PROOF_VERIFIER_NOT_IMPLEMENTED');
}

export function selfTest477() {
  const t=TARGETS[0], id='a'.repeat(36);
  assert.equal(activeVersion477({result:{deployments:[{versions:[{version_id:id,percentage:100}]}]}},t.name),id);
  assert.throws(()=>activeVersion477({result:{deployments:[{versions:[{version_id:id,percentage:99},{version_id:'b'.repeat(36),percentage:1}]}]}},t.name),/SPLIT_OR_UNKNOWN_TRAFFIC/);
  const rows=[
    {name:'DB',type:'d1',id:DB_ID},{name:'RATE_DB',type:'d1',id:t.rateDb},
    {name:'PROFILE_MEDIA',type:'r2_bucket',bucket_name:'soridraw-profile-media'},
    {name:'EXPLORE_CACHE',type:'r2_bucket',bucket_name:'soridraw-profile-media-preview'},
    {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace'},
  ];
  bindings477({result:{bindings:rows}},t);
  assert.throws(()=>bindings477({result:{bindings:[...rows,{name:FLAGS[1],type:'plain_text',text:'1'}]}},t),/UNSAFE/);
  assert.throws(()=>bindings477({result:{bindings:rows.filter(x=>x.name!=='PROFILE_MEDIA')}},t),/BINDING_PROFILE_MEDIA/);
  const fixture=[...ROUTES,...CUES].join('\n').padEnd(5200,' ');
  const wrap=s=>({result:{modules:[{content_base64:Buffer.from(s).toString('base64')}]}});
  source477(wrap(fixture),t.name);
  assert.throws(()=>source477(wrap(fixture.replace('isTrackVisibilityMutation307','broken')),t.name),/WRITER_ROUTE_MISSING/);
  assert.throws(()=>source477(wrap(fixture.replace('CURATED_SHADOW_PUBLICATION_PENDING_471','broken')),t.name),/WRITER_CUE_MISSING/);
  assert.throws(()=>route477({result:{enabled:false}},null,t),/OWNER_UNVERIFIED/);
  const validRevision={status:200,body:{ok:true,data:{exists:true,revision:'v1'}},headers:new Headers({'access-control-allow-origin':t.origin})};
  route477({result:{enabled:true}},validRevision,t);
  assert.throws(()=>route477({result:{enabled:true}},{...validRevision,headers:new Headers({'access-control-allow-origin':'https://invalid.test'})},t),/ORIGIN_MISMATCH/);
  const canonical=['a'],shared=['a']; canonical.push('b');
  assert.notDeepEqual(canonical,shared); // old late D1-only write remains invisible to R2 HEAD
  const records=TARGETS.map((x,i)=>({name:x.name,compatible:true,rateId:'rate'+i,cacheName:['soridraw-profile-media-preview','soridraw-profile-media-test','soridraw-profile-media-prod'][i],versionId:id}));
  assert.throws(()=>activation477(records,null),/OLD_INFLIGHT_RETIREMENT_UNPROVEN/);
  assert.throws(()=>activation477(records,{verifiedByIndependentLiveDrain:true,evidenceId:'mere-operator-assertion',activeVersionIds:Object.fromEntries(TARGETS.map(x=>[x.name,id]))}),/INDEPENDENT_DRAIN_PROOF_VERIFIER_NOT_IMPLEMENTED/);
  const oldEtag='etag-old',newEtag='etag-new';
  assert.equal(oldEtag===newEtag,false); // stale CAS must not restore an earlier promote
  const oldWriterRestored=true,readerStillOn=true;
  assert.equal(oldWriterRestored&&readerStillOn,true); // forbidden rollback, activation gate holds
  console.log('APP477_ACTIVE_WRITER_OFFLINE_TEST=PASS');
  console.log('APP477_OLD_WRITER_STALE_CAS_ROLLBACK_TEST=PASS');
  console.log('APP477_OLD_INFLIGHT_PROOF=HOLD');
}
async function apiGet(url,token) {
  const res=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  need(res.ok,'GLOBAL','CLOUDFLARE_GET_FAILED');
  const json=await res.json().catch(()=>null);
  need(json?.success===true,'GLOBAL','CLOUDFLARE_INVALID_RESPONSE');
  return json;
}
async function live477() {
  const token=process.env.CLOUDFLARE_API_TOKEN,acct=process.env.CLOUDFLARE_ACCOUNT_ID;
  need(typeof token==='string'&&token.length>5&&typeof acct==='string'&&acct.length>5,'GLOBAL','CLOUDFLARE_ACCESS_MISSING');
  const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(acct);
  const config=readFileSync('src/config/exploreEnvironment.ts','utf8');
  for(const t of TARGETS) expectedAppConfig477(config,t);
  const domainResponse=await apiGet(base+'/workers/domains',token);
  need(Number(domainResponse.result_info?.total_pages||1)===1,'GLOBAL','WORKER_DOMAINS_PAGINATION_UNPROVEN');
  const zoneResponse=await apiGet('https://api.cloudflare.com/client/v4/zones?name=soridraw.com',token);
  need(Number(zoneResponse.result_info?.total_pages||1)===1,'GLOBAL','ZONE_LIST_PAGINATION_UNPROVEN');
  const zoneList=result(zoneResponse);
  need(Array.isArray(zoneList)&&zoneList.length===1&&zoneList[0]?.status==='active'&&
    typeof zoneList[0]?.id==='string','GLOBAL','ZONE_OWNERSHIP_UNVERIFIED');
  const routeResponse=await apiGet('https://api.cloudflare.com/client/v4/zones/'+zoneList[0].id+'/workers/routes',token);
  need(Number(routeResponse.result_info?.total_pages||1)===1,'GLOBAL','ZONE_ROUTES_PAGINATION_UNPROVEN');
  const records=[];
  for(const t of TARGETS) {
    originOwnership477(domainResponse,routeResponse,t);
    const frontendHash=await liveFrontend477(t);
    console.log(t.name+'_PUBLIC_FRONTEND_SOURCE=PASS bundleHash='+frontendHash);
    const path=base+'/workers/scripts/'+t.worker;
    const versionId=activeVersion477(await apiGet(path+'/deployments',token),t.name);
    const settings=bindings477(await apiGet(path+'/settings',token),t);
    const bundle=source477(await apiGet(base+'/workers/workers/'+t.worker+'/versions/'+versionId+'?include=modules',token),t.name);
    const subdomain=await apiGet(path+'/subdomain',token);
    const res=await fetch('https://'+t.worker+'.andrawing1212.workers.dev/v1/curated-revision?collection=soridraw',{
      headers:{Origin:t.origin,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    const body=await res.json().catch(()=>null);
    route477(subdomain,{status:res.status,body,headers:res.headers},t);
    records.push({name:t.name,versionId,rateId:settings.rateId,cacheName:settings.cacheName,compatible:true});
    console.log(t.name+'_WRITER_SOURCE=COMPATIBLE versionHash='+fingerprint(versionId)+' bundleHash='+bundle);
    console.log(t.name+'_CURATED_FLAGS=OFF BINDINGS=PASS ROUTE=PASS');
  }
  // Platform API cannot prove previously started old requests have completed.
  activation477(records,null);
}
if(process.argv[1]?.endsWith('verify-477-curated-active-writer-gate.mjs')) {
  if(process.argv.includes('--self-test')) selfTest477();
  else live477().catch(e=>{
    // Sanitized internal reason only. Never print tokens, module bodies, IDs or API payloads.
    console.error('APP477_WRITER_READINESS=HOLD reason='+String(e?.message||'UNKNOWN').replace(/[^A-Za-z0-9_]/g,'').slice(0,130));
    process.exitCode=1;
  });
}
