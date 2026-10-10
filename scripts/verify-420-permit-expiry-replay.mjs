// Source-only risk audit. Real Firebase/Cloudflare/identity/data are never touched.
import assert from 'node:assert/strict';
import { randomBytes, createHmac, createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { verifyLikeGuardPermit420, acceptGuardedLikeBatch420 } from '../cloudflare/explore-worker/runtime/like-guard-permit-420.mjs';

const load=(path,names,more={})=>{
  let src=stripTypeScriptTypes(readFileSync(path,'utf8'),{mode:'strip'})
    .replace(/^import .*?;\s*$/gm,'').replaceAll('export const ','const ');
  src+='\nmodule.exports={'+names.join(',')+'};';
  const m={exports:{}};
  vm.runInNewContext(src,{module:m,Buffer,Number,Date,Error,Math,createHmac,createHash,...more},{timeout:2000});
  return m.exports;
};
const policy={warningPerMinute:30,limitPerMinute:40,suspensionMinutes:120};
const {issueLikePermit420:issue,LIKE_PERMIT_TTL_MS_420:ttl}=load(
  'functions/src/exploreLikePermit420.ts',['issueLikePermit420','LIKE_PERMIT_TTL_MS_420']);
const {publishGuardedLikeSignal420:publish}=load(
  'functions/src/exploreLikeAbuseGate420.ts',['publishGuardedLikeSignal420'],
  {DEFAULT_LIKE_ABUSE_SETTINGS_420:policy});
const store=new Map();let writes=0;
const db={ref:p=>({transaction:async fn=>{
  const prior=store.get(p)??null;
  const copy=prior===null?null:JSON.parse(JSON.stringify(prior));
  const updated=fn(copy);
  if(updated===undefined)return {committed:false,snapshot:{val:()=>copy}};
  writes++;store.set(p,JSON.parse(JSON.stringify(updated)));
  return {committed:true,snapshot:{val:()=>updated}};
}})};
const base=60_000*1000;
const mk=i=>({uid:'uid-a',trackId:'track-'+i,ownerUid:'artist',
  liked:i%2===0,operationId:'aaaaaaaa-aaaa-4aaa-aaaa-'+String(i).padStart(12,'0')});
const pub=(uid,act,at)=>publish(db,uid,{
  trackId:act.trackId,ownerUid:act.ownerUid,liked:act.liked,operationId:act.operationId
},at,policy);
const key=randomBytes(32).toString('base64url');
const check=(token,act,at)=>verifyLikeGuardPermit420({
  permit:token,authenticatedUid:act.uid,mutation:act,
  secretBase64Url:key,nowMs:at,subtle:webcrypto.subtle});
const first=mk(1),at=base+1000;
assert.equal((await pub(first.uid,first,at)).allowed,true);
const old=issue(first,at,key);
assert.equal((await check(old,first,at+1000)).operationId,first.operationId);
await assert.rejects(check(old,first,at+ttl),/420_GUARD_PERMIT_DENIED/);
let canonical=0;
await assert.rejects(acceptGuardedLikeBatch420({
  authenticatedUid:first.uid,body:{mutations:[{...first,guardPermit420:old}]},
  secretBase64Url:key,nowMs:at+ttl,subtle:webcrypto.subtle,
  acceptCanonical:()=>{canonical++}
}),/420_GUARD_PERMIT_DENIED/);
assert.equal(canonical,0);
const priorWrites=writes;
const reissue=await pub(first.uid,first,at+ttl+1000);
assert.equal(reissue.allowed,true);
assert.equal(reissue.duplicate,true);
assert.equal(writes,priorWrites,'within the bounded history same exact ID is RTDB W0');
const fresh=issue(first,at+ttl+1000,key);
assert.equal((await check(fresh,first,at+ttl+2000)).operationId,first.operationId);
console.log('STAGE420_15M_EXPIRED_WORKER_REJECTS_BEFORE_CANONICAL=PASS');
console.log('STAGE420_WITHIN_50_SAME_OPERATION_REISSUE_RTDB_W0=PASS');
const crowded='uid-crowded';
for(let i=0;i<51;i++){
  const act=mk(i+101);
  const time=base+(i<31?1000+i*100:60_000+(i-31)*100);
  assert.equal((await pub(crowded,act,time)).allowed,true);
}
const root=store.get('privateLikeSync420/'+crowded);
assert.equal(root.display.results.length,50);
assert.equal(root.display.results.some(x=>x.operationId===mk(101).operationId),false);
const beforeEvictedReplay=writes;
const replay=await pub(crowded,mk(101),base+ttl+60_000);
assert.equal(replay.allowed,true);
assert.equal(replay.duplicate,true,'atomic approval journal survives 51st display eviction');
assert.equal(writes,beforeEvictedReplay,'old approved operation must not increase RTDB writes');
console.log('STAGE420_OFFLINE_51_EVENT_EVICTED_REPLAY_RTDB_W0=PASS');
console.log('STAGE420_OLD_CLIENT_AND_LIVE_CUTOVER=HOLD');
