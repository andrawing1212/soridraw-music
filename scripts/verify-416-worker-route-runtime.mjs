// Execute the EXACT disabled Stage416 HTTP handler with realistic Request /
// Response and authenticated account claims. No live bindings or network IO.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(src,/const STAGE416_SHARED_D1_INTAKE_ACTIVE = false;/);
assert.match(src,/if\(STAGE416_SHARED_D1_INTAKE_ACTIVE&&[\s\S]*?handlePrivateLikeRoute416\(request,env,ctx,url\);/);
const start=src.indexOf('// Stage416: AUTHENTICATED real shared-D1 route candidate; HARD OFF');
const end=src.indexOf('\nexport default {\n  async scheduled',start);
if(start<0||end<0||end<start)throw Error('416_WORKER_ROUTE_NOT_FOUND');
let acceptedUid='',clicks=0,commits=0,schedules=0,failSchedule=false,invalid=false,hasPermission=true;
const sandbox={
  Request, Response, Headers, URL, Date, console,
  STAGE420_SIGNED_LEGACY_INTAKE_OPEN:false, STAGE426_COMPILED_OPEN:false,
  like426Headers:(req)=>new Headers({'Content-Type':'application/json',
    'Access-Control-Allow-Origin':req.headers.get('Origin')||'https://preview.soridraw.com'}),
  validateExploreAuth307:async(req)=>{
    if(!hasPermission)return {ok:false,response:new Response(JSON.stringify({ok:false}),{status:401})};
    return {ok:true,uid:'server-authenticated-uid'};
  },
  registerPrivateClick416:async(db,uid,body,now,minutes)=>{
    acceptedUid=uid;clicks++;
    assert.equal(minutes,5);
    if(invalid)throw Error('416_BAD_CLICK');
    assert.equal(body.trackId,'songA');
    assert.equal(body.uid,undefined,'client cannot control authenticated UID');
    return {accepted:true,version:4,deadlineAt:now+300_000};
  },
  commitPrivateWindow416:async(db,uid,now)=>{
    acceptedUid=uid;commits++;
    return {committed:true,batchIds:['l069_test'],results:[{trackId:'songA',
      liked:true,operationId:'some-uuid',status:'legacy-queued'}]};
  },
  scheduleExploreLikeAggregate103:async()=>{
    schedules++;
    if(failSchedule)throw Error('SCHEDULER_FAILED');
  },
  module:{exports:{}},
};
vm.runInNewContext(src.slice(start,end)+'\nmodule.exports={handlePrivateLikeRoute416};',sandbox,{timeout:2000});
const handler=sandbox.module.exports.handlePrivateLikeRoute416;
const baseUrl='https://preview.soridraw.com';
const env={DB:{prepare:()=>{},batch:()=>{}},STAGE416_PRIVATE_CANONICAL_MINUTES:'5',
  LIKE_RATE_LIMITER:{limit:async()=>({success:true})}};
const req=(route,headers={})=>new Request(baseUrl+route,{method:'POST',
  headers:{Origin:baseUrl,Authorization:'Bearer redacted',
    'X-Soridraw-Private-Clock':'416',...headers},
  body:JSON.stringify({trackId:'songA',liked:true,operationId:'op'})});
const clickRoute='/v1/me/likes/private-click-416';
let a=await handler(req(clickRoute),env,{},new URL(baseUrl+clickRoute));
assert.equal(a.status,200);
assert.equal((await a.json()).data.version,4);
assert.equal(clicks,1);
assert.equal(acceptedUid,'server-authenticated-uid');
const batchRoute='/v1/me/likes/batch';
a=await handler(req(batchRoute),env,{},new URL(baseUrl+batchRoute));
assert.equal(a.status,200);
assert.equal((await a.json()).data.queued,true);
assert.equal(commits,1);assert.equal(schedules,1);
assert.equal(acceptedUid,'server-authenticated-uid');
a=await handler(req(batchRoute,{'X-Soridraw-Private-Clock':'old'}),env,{},new URL(baseUrl+batchRoute));
assert.equal(a.status,409,'older unguarded client cannot bypass the new authority when enabled');
assert.equal(commits,1);
hasPermission=false;
a=await handler(req(clickRoute),env,{},new URL(baseUrl+clickRoute));
assert.equal(a.status,401);assert.equal(clicks,1);
hasPermission=true;
a=await handler(req(clickRoute),{...env,STAGE416_PRIVATE_CANONICAL_MINUTES:''},{},new URL(baseUrl+clickRoute));
assert.equal(a.status,503,'missing central timing contract is fail closed');
a=await handler(req(clickRoute),{...env,LIKE_RATE_LIMITER:{limit:async()=>({success:false})}},{},new URL(baseUrl+clickRoute));
assert.equal(a.status,429,'per-click rate guard required');
invalid=true;
a=await handler(req(clickRoute),env,{},new URL(baseUrl+clickRoute));
assert.equal(a.status,400);
invalid=false;failSchedule=true;
a=await handler(req(batchRoute),env,{},new URL(baseUrl+batchRoute));
assert.equal(a.status,503);
assert.equal((await a.json()).data.queued,true,'scheduler failure must report durable queued state');
console.log('STAGE416_WORKER_AUTH_ROUTE_LEGACY_REJECT_AND_RATE_LIMIT=PASS');
console.log('STAGE416_WORKER_CANONICAL_SCHEDULER_PARTIAL_FAILURE=PASS');
console.log('STAGE416_WORKER_STILL_COMPILED_OFF=PASS');
