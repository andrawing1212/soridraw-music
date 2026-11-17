// APP713 whole private chain: click/Auth -> owner service -> isolated pair DO
// -> alarm -> private canonical + APP711 precommit (injected fixture).
// No user accounts, shared D1/R2, Cloudflare deployment or network requests.
import assert from 'node:assert/strict';
import {handleAuthenticatedFollowClick713}
 from '../cloudflare/explore-worker/runtime/owner-follow-click-ingress-713.mjs';
import {routeOwnerFollowClickService713,createOwnerClickDoService713}
 from '../cloudflare/explore-worker/runtime/owner-follow-click-service-713.mjs';
import {routeTrustedFollowCanonical713}
 from '../cloudflare/explore-worker/runtime/owner-follow-click-canonical-entry-713.mjs';
let time=10_000,alarmAt=null;
const rows=new Map(),clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
let activeTx=null;
const storage={
 async get(k){return clone(rows.get(k))},
 async setAlarm(at){if(activeTx)activeTx.alarm=at;else alarmAt=at},
 async getAlarm(){return activeTx?activeTx.alarm:alarmAt},
 async delete(k){rows.delete(k)},
 async transaction(fn){
  if(activeTx)throw Error('nested transaction forbidden');
  const snapshot=new Map([...rows].map(([k,v])=>[k,clone(v)]));
  activeTx={alarm:alarmAt};
  try{
   const data=await fn({
    get:async k=>clone(snapshot.get(k)),
    put:async(k,v)=>snapshot.set(k,clone(v)),
    delete:async k=>snapshot.delete(k),
   });
   rows.clear();for(const [k,v] of snapshot)rows.set(k,v);
   alarmAt=activeTx.alarm;return data;
  }finally{activeTx=null}
 },
};
const secret='test_owner_click_secret_000000000000000000000000';
const common={
 SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_FOLLOW_SERVER_CLICK_713:'1',
 SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',
 SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',
 SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:secret,
};
let canonicalFollowing=false,revision=0,operationSeq=0,writes=0,reservations=0;
let intent=null;
const ownerEnv={...common};
const exploreEnv={...common};
const deps={
 readCutover:async()=>({mode:'overlay348',cutoverToken:'approved-test-cutover',readOnly:false}),
 readIntent:async()=>({value:intent}),
 readMembership:async()=>({mode:'overlay348',following:canonicalFollowing}),
 reserve:async()=>{reservations++;return {ok:true,status:'reserved',generation:1}},
 runPrecommit:async({request,authenticate,reserve,callCanonical})=>{
  assert.equal((await authenticate()).uid,'real_actor');
  const op=await request.clone().json();
  const reserved=await reserve({ownerUid:'owner',actorUid:'real_actor',
   operationId:op.followOperationId,expectedRevision:op.followExpectedRevision});
  assert.equal(reserved.ok,true);
  return callCanonical(request);
 },
 callCanonical:async({request,actorUid,ownerUid,desired})=>{
  assert.equal(actorUid,'real_actor');assert.equal(ownerUid,'owner');
  const op=await request.json();
  assert.equal(op.followExpectedRevision,revision);
  canonicalFollowing=desired;revision++;writes++;
  intent={actor:'real_actor',target:'owner',following:desired,
   id:op.followOperationId,expectedRevision:op.followExpectedRevision,
   revision,settled:true};
  return Response.json({ok:true,data:{uid:'owner',following:desired,
   revision,duplicate:false}});
 },
};
ownerEnv.OWNER_FOLLOW_CANONICAL_REPLAY_600={fetch:request=>
 routeTrustedFollowCanonical713({request,env:exploreEnv,
  enabled:true,...deps})};
const doService=createOwnerClickDoService713({
 state:{storage},env:ownerEnv,enabled:true,now:()=>time,
 makeOperationId:()=>('server_operation_'+(++operationSeq).toString().padStart(20,'0')),
});
const ids=[];
ownerEnv.OWNER_FOLLOW_DO_600={
 idFromName:name=>{ids.push(name);return name},
 get:()=>({fetch:request=>doService.fetch(request)}),
};
exploreEnv.OWNER_FOLLOW_RESERVATION_SERVICE_600={fetch:request=>
 routeOwnerFollowClickService713({request,env:ownerEnv,enabled:true})};
const targetUrl='https://example.invalid/v1/profiles/owner/follow-click-713';
const click=(following,sequence,deviceId='device0001',origin='https://preview.soridraw.com')=>
 new Request(targetUrl,{method:'POST',headers:{Origin:origin,
 'Content-Type':'application/json'},body:JSON.stringify({
 following,deviceId,sequence,actorUid:'forged_actor'})});
const accept=(following,sequence,deviceId)=>
 handleAuthenticatedFollowClick713({request:click(following,sequence,deviceId),
  env:exploreEnv,authenticate:async()=>({ok:true,uid:'real_actor'}),
  enabled:true});
const first=await accept(true,1);
assert.equal(first.status,202,'server must durably ACK before app closes');
assert.match(ids[0],/^app713:pair:real_actor:owner$/);
const ack=await first.json();
assert.equal(ack.status,'durably-accepted');
assert.equal(writes,0);
assert.equal(reservations,0);
time+=5000;
const settled=await doService.alarm();
assert.equal(settled.status,'committed');
assert.equal(canonicalFollowing,true);
assert.equal(writes,1);
assert.equal(reservations,1,'APP711 reserved before canonical write');
// No browser open: the server alone did the write and owner reservation.
assert.equal(rows.size,1,'bounded per-pair receipt is retained');

// Follow -> unfollow -> follow within one first-click 5-second window:
// final state true (the pre-window canonical true) must do W0.
const unfollow=await accept(false,2);assert.equal(unfollow.status,202);
time+=900;
const refollow=await accept(true,3);assert.equal(refollow.status,202);
assert.equal((await refollow.json()).dueAt,(await unfollow.json()).dueAt);
time+=4100;
assert.equal((await doService.alarm()).status,'noop');
assert.equal(writes,1,'no extra D1/R2 canonical writes');
assert.equal(reservations,1,'no APP711 alarm for net-zero');
// Cross-device last arrival wins inside same fixed window.
assert.equal((await accept(false,1,'device0002')).status,202);
time+=500;
assert.equal((await accept(false,4)).status,202);
time+=4500;
assert.equal((await doService.alarm()).status,'committed');
assert.equal(canonicalFollowing,false);
assert.equal(writes,2);
assert.equal(reservations,2);

// Client cannot forge the actor, and direct DO is not a public API.
assert.equal((await handleAuthenticatedFollowClick713({
 request:click(true,5,'device0001','https://untrusted.invalid'),
 env:exploreEnv,authenticate:async()=>({ok:true,uid:'real_actor'}),enabled:true,
})).status,403);
assert.equal((await doService.fetch(new Request(
 'https://owner-follow.internal/internal/owner-follow/click713',
 {method:'POST',body:JSON.stringify({actorUid:'real_actor',ownerUid:'owner',
 desired:true,deviceId:'device0001',sequence:5})}))).status,403);
assert.equal(writes,2);
console.log('APP713_CLICK_DURABLE_DO_ALARM_INTERNAL_CANONICAL_2ACCOUNTS=PASS');
console.log('APP713_5S_NETZERO_W0_APP711_BEFORE_COMMIT=PASS');
console.log('APP713_PRIVATE_PAIR_DO_CAPABILITY_AUTH_ACTOR_FENCE=PASS');
