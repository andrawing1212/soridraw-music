// APP713 ingress guard. Network/durable backend is mocked; no user data.
import assert from 'node:assert/strict';
import {handleAuthenticatedFollowClick713 as run,
 APP713_FOLLOW_CLICK_INGRESS_COMPILED_OPEN as FLAG}
 from '../cloudflare/explore-worker/runtime/owner-follow-click-ingress-713.mjs';
assert.equal(FLAG,false);
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_FOLLOW_SERVER_CLICK_713:'1',
 SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',
 SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',
 SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:'safe_mock_bridge_capability_xxxxxxxxx',
};
const responses=[];
env.OWNER_FOLLOW_RESERVATION_SERVICE_600={fetch:async req=>{
 const forwarded=await req.json();responses.push({path:new URL(req.url).pathname,
  headers:req.headers,forwarded});
 return Response.json({ok:true,status:'accepted',generation:'click713_operation_1',dueAt:123500});
}};
const url='https://soridraw-explore-preview.andrawing1212.workers.dev/v1/profiles/owner/follow-click-713';
const request=(following=true,extras={})=>new Request(url,{method:'POST',
 headers:{Origin:'https://preview.soridraw.com','Content-Type':'application/json'},
 body:JSON.stringify({following,deviceId:'device0001',sequence:1,
   actorUid:'forged_account',...extras})});
const scopedRun=options=>run({preAuthLimiter:()=>{},...options});
const auth=async()=>({ok:true,uid:'real_actor'});
assert.equal((await scopedRun({request:request(),env,authenticate:auth})).status,503);
const okay=await scopedRun({request:request(),env,authenticate:auth,enabled:true});
assert.equal(okay.status,202);
const data=await okay.json();assert.equal(data.status,'durably-accepted');
assert.equal(responses.length,1);
assert.equal(responses[0].path,'/internal/owner-follow/click713');
assert.deepEqual(responses[0].forwarded,{
 actorUid:'real_actor',ownerUid:'owner',desired:true,
 deviceId:'device0001',sequence:1});
assert.equal(responses[0].headers.get('X-Soridraw-Owner-Bridge-600'),
 env.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600);
assert.equal(okay.headers.get('Access-Control-Allow-Origin'),'https://preview.soridraw.com');
assert.equal(okay.headers.get('Cache-Control'),'private,no-store');
const preflight=await scopedRun({request:new Request(url,{method:'OPTIONS',
 headers:{Origin:'https://preview.soridraw.com'}}),env,authenticate:auth,enabled:true});
assert.equal(preflight.status,204);
assert.equal(responses.length,1,'OPTIONS cannot issue durable mutation');
const denied=await scopedRun({request:new Request(url,{method:'OPTIONS',
 headers:{Origin:'https://untrusted.example'}}),env,authenticate:auth,enabled:true});
assert.equal(denied.status,403);
assert.equal((await scopedRun({request:request(),env,authenticate:async()=>({ok:false}),enabled:true})).status,401);
assert.equal((await scopedRun({request:request(),env,authenticate:async()=>({ok:true,uid:'owner'}),enabled:true})).status,400);
assert.equal((await scopedRun({request:request(true,{deviceId:'x'}),env,authenticate:auth,enabled:true})).status,400);
assert.equal((await scopedRun({request:request(true,{following:3}),env,authenticate:auth,enabled:true})).status,400);
assert.equal(responses.length,1,'invalid/unauthorized receives no DO request');
assert.equal((await run({request:request(),env,authenticate:auth,enabled:true})).status,503,
 'missing existing rate guard must fail closed');
assert.equal((await run({request:request(),env,authenticate:auth,enabled:true,
 preAuthLimiter:()=>{throw Error('limited')}})).status,429,
 'legacy pre-auth burst gate must protect new click endpoint');
env.OWNER_FOLLOW_RESERVATION_SERVICE_600.fetch=async()=>Response.json(
 {ok:false,status:'unavailable'},{status:503});
assert.equal((await scopedRun({request:request(),env,authenticate:auth,enabled:true})).status,503);
assert.equal((await scopedRun({request:request(),env:{...env,SORIDRAW_ENVIRONMENT:'production'},
 authenticate:auth,enabled:true})).status,503);
console.log('APP713_SERVER_VERIFIED_ACTOR_PRIVATE_DO_DURABLE_ACK_ONLY=PASS');
console.log('APP713_INGRESS_CORS_APP_CHECK_AND_FAIL_CLOSED=PASS');
