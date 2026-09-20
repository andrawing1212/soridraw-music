import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path=process.env.SORIDRAW_GENERATED_WORKER;
assert.ok(path,'Only use an isolated generated Worker');
const source=readFileSync(path,'utf8');
assert.match(source,/SORIDRAW_LIKE_CANONICAL_SETTLEMENT_GATE_076_20260920/);
const start=source.indexOf('async function handleMyLikeConfirmed075(');
const end=source.indexOf('async function handleMyLikeStatesD1Core(',start);
assert.ok(start>0&&end>start);
const helper=source.slice(start,end);
assert.match(helper,/WHERE q\.user_uid = \?/);
assert.match(helper,/explore_like_user_queue_075 q/);
assert.match(helper,/explore_like_user_queue_state_075 s ON s\.id = 1/);
assert.match(helper,/LIMIT 1/);
assert.match(helper,/PERSONAL_LIKE_STILL_PROCESSING/);
assert.match(helper,/PERSONAL_LIKE_SETTLEMENT_UNAVAILABLE/);
assert.doesNotMatch(helper,/UPDATE |INSERT |DELETE FROM|env\.PROFILE_MEDIA|caches\.default/);
let reads=0,auths=0,queries=0,mode='settled';
const fail=(code,message,status)=>{const err=new Error(message);Object.assign(err,{code,status});throw err;};
const handler=new Function('throwApi','handleMyLikeStatesD1Core','requireExploreAuth',helper+'return handleMyLikeConfirmed075;')(
  fail,
  async()=>{reads++;return {ok:true,data:{likedTrackIds:['song']}};},
  async()=>{auths++;return {uid:'test-account'};},
);
const env={DB:{prepare:(sql)=>{
  queries++;
  assert.match(sql,/WHERE q\.user_uid = \?/);
  assert.doesNotMatch(sql,/LIKE '%|FROM likes|FROM tracks/);
  return {bind:(uid)=>{
    assert.equal(uid,'test-account');
    return {first:async()=>{
      if(mode==='error')throw Error('D1 unavailable');
      return mode==='pending'?{pending:1}:null;
    }};
  }};
}}};
const url=(ids)=>new URL('https://unit.test/v1/me/likes-confirmed?trackIds='+encodeURIComponent(ids));
mode='pending';
await assert.rejects(()=>handler({},url('song'),env,{}),e=>e.code==='PERSONAL_LIKE_STILL_PROCESSING'&&e.status===409);
assert.equal(reads,0,'never read premature canonical membership');
mode='error';
await assert.rejects(()=>handler({},url('song'),env,{}),e=>e.code==='PERSONAL_LIKE_SETTLEMENT_UNAVAILABLE'&&e.status===503);
assert.equal(reads,0,'fail-closed on settlement read failure');
mode='settled';
const result=await handler({},url('song'),env,{});
assert.equal(result.ok,true);
assert.equal(reads,1,'only one canonical read after active queue settled');
const beforeQueries=queries;
await assert.rejects(()=>handler({},url(Array.from({length:21},(_,i)=>'song-'+i).join(',')),env,{}),e=>e.code==='INVALID_CONFIRMATION_IDS'&&e.status===400);
assert.equal(queries,beforeQueries,'invalid input rejected before querying queue');
assert.equal(auths,3,'auth only for valid bounded requests');
console.log('076_PENDING_075_QUEUE_PREVENTS_PREMATURE_CANONICAL_READ=PASS');
console.log('076_QUEUE_ERROR_FAIL_CLOSED=PASS');
console.log('076_UID_INDEXED_SETTLED_BOUNDED_READ=PASS');
console.log('076_OLD_069_LEGACY_QUEUES=NOT_COVERED');
console.log('076_NO_LIVE_DATA_OR_DEPLOY=PASS');
