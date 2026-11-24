// Exact deployed production bundle, synthetic local R2 only. No cloud credentials.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {preparePublicLikeManifest416} from '../cloudflare/explore-worker/runtime/public-like-manifest-416.mjs';
const [dir,install,mode]=process.argv.slice(2);
assert(['before','after'].includes(mode));
const {Miniflare}=createRequire(resolve(install,'package.json'))('miniflare');
writeFileSync(join(dir,'qa-entry.mjs'),`
import worker from './entry.mjs';
export {ExploreLikeBatchScheduler103} from './entry.mjs';
export class Shared {async fetch(){return new Response('QA_BLOCKED',{status:503})}}
export default worker;
`);
const mf=new Miniflare({modules:true,modulesRoot:dir,scriptPath:join(dir,'qa-entry.mjs'),compatibilityDate:'2026-08-06',cf:false,
 bindings:{SORIDRAW_ENVIRONMENT:'production',SORIDRAW_OWNER_FOLLOW_PRODUCTION_797:'1',SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019:'1',SORIDRAW_NOTIFICATION_SCHEMA_READY_013:'1',SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET:'local-test-only-never-live-secret'},
 durableObjects:{EXPLORE_LIKE_BATCH_SCHEDULER:{className:'ExploreLikeBatchScheduler103',useSQLite:true},RELEASE_SHARED_LIKE_SCHEDULER:{className:'Shared',useSQLite:true}},
 r2Buckets:['PROFILE_MEDIA'],outboundService:()=>new Response('LOCAL_ONLY',{status:503})});
try{
 const path='http://localhost/v1/public-like-release-manifest-416',origin='https://soridraw.com';
 const request=(body,method='POST')=>mf.dispatchFetch(path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
 const bad=await request({});
 if(mode==='before'){assert.equal(bad.status,404);console.log('PROD_EXACT_MANIFEST_OLD_GUARD_404_REPRODUCED=PASS');}
 else{
  assert.equal(bad.status,400);assert.equal((await bad.json()).error.code,'416_PUBLIC_MANIFEST_REQUEST_INVALID');
  const opt=await request(null,'OPTIONS');assert.equal(opt.status,204);assert.equal(opt.headers.get('Access-Control-Allow-Origin'),origin);
  const r2=await mf.getR2Bucket('PROFILE_MEDIA');
  const rows=Array.from({length:300},(_,i)=>({trackId:'qa-'+String(i).padStart(4,'0'),ownerUid:'qa-owner'}));
  const result=await preparePublicLikeManifest416(r2,rows,'00000000-0000-4000-8000-000000000777',Date.now());
  assert.equal(result.inlineRows.length,256);assert.equal(result.manifest416.count,300);
  const good=await request({...result.manifest416,trackIds:['qa-0299','qa-0000','not-found']});
  assert.equal(good.status,200,(await good.clone().text()).slice(0,200));
  assert.equal(good.headers.get('X-SORIDRAW-D1-Read'),'0');assert.equal(good.headers.get('X-SORIDRAW-D1-Write'),'0');assert.equal(good.headers.get('Access-Control-Allow-Origin'),origin);
  const j=await good.json();assert.deepEqual(j.data.rows.map(x=>x.trackId),['qa-0000','qa-0299']);
  const retry=await request({...result.manifest416,trackIds:['qa-0299']});assert.equal(retry.status,200);assert.equal((await retry.json()).data.rows[0].trackId,'qa-0299');
  console.log('PROD_EXACT_COMMON_448_MANIFEST_300_TRACKS_D1_R0_W0=PASS;LOCAL_R2_ONLY;DEPLOYED_COMPAT_DATE_NOT_CLAIMED');
 }
}finally{await mf.dispose()}
