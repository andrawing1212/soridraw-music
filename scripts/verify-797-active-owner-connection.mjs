// Real pinned deployed precommit, reserve, owner DO and replay proof code,
// run with synthetic resources only. No requests to shared data or Firebase.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
export async function verifyActiveOwnerConnection797(folder){
 const load=n=>import(pathToFileURL(join(folder,n)).href);
 const [compose,pre,service,owner,proof]=await Promise.all([
  load('production-follow-797.mjs'),load('app607/owner-follow-precommit-557.mjs'),
  load('app605/owner-follow-service-601.mjs'),load('owner-live.mjs'),
  load('app605/owner-follow-commit-proof-557.mjs')]);
 const actor='syntheticActor797',target='syntheticOwner797',epoch='a'.repeat(32),token='synthetic-cutover797',secret='test-only-not-a-live-credential_797'.repeat(2);
 const manifest={relationMode:'overlay348',writeMode:'active',profileCountsR2Exact:true,crashConsistentWriter354:true,orderedClientRequests354:true,oneWayAuthority348:true,legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true,cutoverToken:token};
 const mkey='internal/explore/follow-cutover-v348/active.json',ikey='internal/explore/follow-intents-v354/'+[token,actor,target].map(encodeURIComponent).join('/')+'.json',pkey='internal/explore/shared-profile-v113/'+target+'.json';
 const records=new Map([[mkey,manifest],[pkey,{revision:12,body:{data:{profile:{uid:target,followerCount:0}}},followSync354:{token,exact:true,pending:{}}}]]);
 const media={get:async k=>records.has(k)?{text:async()=>JSON.stringify(records.get(k))}:null};
 let following=false,writes=0,relayAttempts=0,proofChecks=0,storageWrites=0;
 let failRelay=true;
 const stores=new Map(),instances=new Map();
 const flags={SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',SORIDRAW_OWNER_DO_STANDALONE_600:'1',SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607:'1',SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607:'1',SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680:'1',SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:secret};
 const preview={...flags,SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',PROFILE_MEDIA:media,
 OWNER_FOLLOW_CANONICAL_REPLAY_600:{fetch:async req=>{
  assert.equal(new URL(req.url).pathname,'/owner-follow/replay557-internal');
  assert.equal(req.headers.get('X-Soridraw-Owner-Bridge-600'),secret);
  const reservation=await req.json();
  proofChecks++;
  const result=await proof.verifyOwnerFollowCommitProof557({reservation,env:preview});
  if(!result.committed)return Response.json({status:'retry-required'},{status:503});
  relayAttempts++;
  if(failRelay)return Response.json({status:'retry-required'},{status:503});
  return Response.json({ok:true,status:'delivered',deliveredRevision:records.get(pkey).revision});
 }}};
 function state(uid){
  if(!stores.has(uid)){
   const data=new Map();let alarm=null;
   stores.set(uid,{storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>{storageWrites++;data.set(k,structuredClone(v))},delete:async k=>{storageWrites++;data.delete(k)},getAlarm:async()=>alarm,setAlarm:async t=>{alarm=t}},data});
  }
  return stores.get(uid);
 }
 preview.OWNER_FOLLOW_DO_600={idFromName:uid=>uid,get(uid){if(!instances.has(uid))instances.set(uid,new owner.OwnerFollowerStandalone600(state(uid),preview));return instances.get(uid)}};
 const prod={...flags,SORIDRAW_ENVIRONMENT:'production',SORIDRAW_OWNER_FOLLOW_PRODUCTION_797:'1',PROFILE_MEDIA:media,
  OWNER_FOLLOW_RESERVATION_SERVICE_600:{fetch:r=>owner.default.fetch(r,preview)},
  DB:{prepare(sql){assert.match(sql,/SELECT/);return {bind(){return {first:async()=>({epoch,baseline:following?1:0,override_following:null,is_public:1})}}}}}};
 const canonical={async fetch(req,e){
  assert.equal(e,prod);
  const raw=await req.clone().text(),payload=raw?JSON.parse(raw):{};
  const desired=req.method==='PUT';
  if(desired===following)return Response.json({ok:true,data:{duplicate:true}});
  // Actual durable reservation MUST exist before a changed writer is called.
  const queue=state(target).data.get('pending');
  assert.equal(queue?.entries?.length,1);
  assert.equal(queue.entries[0].operationId,payload.followOperationId);
  assert.equal(queue.entries[0].desired,desired);
  assert.equal(queue.entries[0].expectedRevision,payload.followExpectedRevision);
  // The actual proof function must reject pre-commit synthetic state.
  assert.equal((await proof.verifyOwnerFollowCommitProof557({env:preview,reservation:queue.entries[0]})).committed,false);
  following=desired;writes++;
  records.set(ikey,{token,actor,target,id:payload.followOperationId,expectedRevision:payload.followExpectedRevision,revision:12+writes,following,settled:true});
  records.set(pkey,{revision:12+writes,body:{data:{profile:{uid:target,followerCount:Number(following)}}},followSync354:{token,exact:true,pending:{}}});
  return Response.json({ok:true,data:{duplicate:false}});
 }};
 const wrapper=compose.composeProductionFollow797(canonical,{authenticate:async()=>({ok:true,uid:actor}),precommit:pre.runOwnerFollowPrecommit557,reserve:service.reserveOwnerFollowViaService601});
 const req=method=>new Request('https://prod.example/v1/profiles/'+target+'/follow',{method,headers:{Origin:'https://soridraw.com'},body:'{}'});
 assert.equal((await wrapper.fetch(req('PUT'),prod,{})).status,200);
 assert.equal(writes,1);assert.equal(state(target).data.get('pending').entries.length,1);
 const before=writes;
 // Run the actual active DO alarm. Force a simulated receiver 503; retain
 // the receipt, reconstruct the DO on the same storage, then retry.
 const first=await instances.get(target).alarm();
 assert.equal(first.status,'retry-scheduled');
 assert.equal(writes,before);assert.equal(state(target).data.get('pending').entries.length,1);
 const pending=state(target).data.get('pending');
 pending.entries[0].nextAttemptAt=0;
 state(target).data.set('pending',pending);failRelay=false;
 const restarted=new owner.OwnerFollowerStandalone600(state(target),preview);
 assert.equal((await restarted.alarm()).status,'delivered');
 assert.equal(state(target).data.has('pending'),false);assert.equal(writes,before);
 assert.equal((await wrapper.fetch(req('DELETE'),prod,{})).status,200);
 assert.equal(writes,2);
 assert.equal((await instances.get(target).alarm()).status,'delivered');
 assert.equal(writes,2);assert.equal(state(target).data.has('pending'),false);
 const beforeNoop=storageWrites;
 assert.equal((await wrapper.fetch(req('DELETE'),prod,{})).status,200);
 assert.equal(writes,2);assert.equal(storageWrites,beforeNoop);
 assert.equal(proofChecks,3);assert.equal(relayAttempts,3);
 console.log('APP797_REAL_PINNED_PRECOMMIT_RESERVE_OWNER_ALARM_PROOF_SYNTHETIC_FOLLOW_UNFOLLOW_RETRY=PASS;CANONICAL_FIXTURE_WRITES=2;REPLAY_WRITES=0;REAL_USER_WRITES=0');
}
