// Exercise the exact cloud fixture before uploading. No credentials or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.argv[2],'package.json'));
const {Miniflare}=require('miniflare');
const adapter=readFileSync('scripts/full-release-shared-like-scheduler.mjs','utf8');
const worker=readFileSync('scripts/full-release-handoff-qa-worker.mjs','utf8').replace("import {legacySchedulerClass} from './adapter.mjs';",adapter);
const mf=new Miniflare({modules:true,script:worker,compatibilityDate:'2026-06-17',cf:false,bindings:{QA_ACCESS:'local-only',SORIDRAW_ENVIRONMENT:'production'},durableObjects:{EXPLORE_LIKE_BATCH_SCHEDULER:{className:'Legacy',useSQLite:true},RELEASE_SHARED_LIKE_SCHEDULER:{className:'Shared',useSQLite:true}},outboundService:()=>new Response('BLOCKED',{status:503})});
try{
 const call=async(command,body,access='local-only')=>{
  const r=await mf.dispatchFetch('http://localhost/qa',{method:'POST',headers:{'X-QA-Access':access,'X-QA-Command':command},...(body===undefined?{}:{body})});
  return {status:r.status,route:r.headers.get('X-SORIDRAW-QA-Route'),data:await r.json().catch(()=>null)};
 };
 assert.equal((await call('legacy/state',undefined,'bad')).status,403);
 assert.equal((await call('legacy/state')).route,'legacy');
 assert.equal((await call('shared/state')).route,'shared');
 assert.equal((await call('shared/mode','fail')).status,200);
 assert.equal((await call('legacy/seed',JSON.stringify({marker:100,alarm:false}))).status,200);
 assert.equal((await call('legacy/invoke')).status,503);
 assert.equal((await call('legacy/state')).data.marker,100);
 assert.equal((await call('shared/mode','settled')).status,200);
 assert.equal((await call('legacy/invoke')).status,200);
 assert.equal((await call('legacy/state')).data.marker,null);
 assert.equal((await call('shared/state')).data.writes,1);
 console.log('EXACT_PHYSICAL_FIXTURE_ROUTING_LOCAL=PASS');
}finally{await mf.dispose()}
