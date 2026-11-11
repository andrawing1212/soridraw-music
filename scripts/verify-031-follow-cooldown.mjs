// Regression for real PREVIEW discrepancy: actor shows unfollowed while
// canonical overlay is still following after server cooldown/rate rejection.
// Offline only; no Firebase/Cloudflare requests or canonical writes.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const source=readFileSync('src/services/exploreFollowBatchService380.ts','utf8');
const js=stripTypeScriptTypes(source,{mode:'strip'});
const originalNow=Date.now;
const origTimeout=globalThis.setTimeout,origClear=globalThis.clearTimeout;
const origStorage=globalThis.localStorage;
let clock=Date.now(), timer=0;
const store=new Map();
Date.now=()=>clock;
globalThis.setTimeout=()=>++timer;
globalThis.clearTimeout=()=>{};
globalThis.localStorage={
 getItem:k=>store.has(k)?store.get(k):null,
 setItem:(k,v)=>store.set(k,String(v)),
 removeItem:k=>store.delete(k)
};
try{
 const m=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));
 const key=(a,b)=>JSON.stringify([a,b]);
 const seed=(viewerUid,targetUid,base,desired)=>({
  viewerUid,targetUid,
  baseFollowing:base,desiredFollowing:desired,
  baseTargetFollowerCount:2,baseTargetFollowingCount:2,baseActorFollowingCount:2,
  targetProfile:{uid:targetUid,handle:'owner',nickname:'owner',avatarUrl:''},
  initialDelayMs:0,restoredUpdatedAt:clock-31_000
 });
 let calls=0,delayNotices=[],errors=[],settlements=[];
 const rateError=()=>Object.assign(Error('Server cooldown'),{code:'RATE_LIMITED',retryAfterMs:60_000});
 const q=seed('actor','owner',true,false);
 m.queueExploreFollowFinalState380({...q,
  commit:async()=>{calls++;throw rateError()},
  onBusy:()=>{},onDeferred:delay=>delayNotices.push(delay),
  onSettled:x=>settlements.push(x),
  onError:e=>errors.push(e)
 });
 await m.flushExploreFollowPair380(key('actor','owner'));
 assert.equal(calls,1);
 assert.deepEqual(delayNotices,[60_000],'FIRST_COOLDOWN_MUST_BE_VISIBLE');
 assert.deepEqual(errors,[]);
 let pending=m.readPendingExploreFollowIntents380('actor');
 assert.equal(pending.length,1);
 assert.equal(pending[0].suspended,false,'FIRST_COOLDOWN_MUST_NOT_PERMANENTLY_SUSPEND');
 assert.equal(pending[0].retryUsed,true);
 assert.equal(pending[0].desiredFollowing,false);
 clock+=60_001;
 await m.flushExploreFollowPair380(key('actor','owner'));
 assert.equal(calls,2,'AT_MOST_ONE_RETRY');
 assert.equal(errors.length,1,'EXHAUSTED_COOLDOWN_MUST_NOTIFY');
 assert.equal(errors[0].baseFollowing,true,'REVERT_TO_LAST_KNOWN_BASE');
 assert.equal(errors[0].desiredFollowing,false);
 assert.match(errors[0].error.message,/저장하지 못했습니다/);
 assert.equal(m.readPendingExploreFollowIntents380('actor').length,0,
  'MUST_NOT_PERSIST_FALSE_UNFOLLOW_INDEFINITELY');
 assert.deepEqual(settlements,[]);
 clock+=3600_000;
 await m.flushExploreFollowPair380(key('actor','owner'));
 assert.equal(calls,2,'NO_BACKGROUND_RETRY_STORM');

 // Old releases could persist suspended=true indefinitely. On next app
 // resume they must deliver the visible failure/rollback without server I/O.
 let oldCommit=0,oldErrors=[];
 const stale=seed('legacy-actor','legacy-owner',true,false);
 m.queueExploreFollowFinalState380({...stale,
  restoredSuspended:true,restoredRetryUsed:true,
  commit:async()=>{oldCommit++;return {isFollowing:false,followerCount:1,followingCount:2}},
  onError:e=>oldErrors.push(e),onSettled:()=>{},onBusy:()=>{}
 });
 assert.equal(oldCommit,0,'LEGACY_STALLED_RECORD_MUST_NOT_AUTO_WRITE');
 assert.equal(oldErrors.length,1,'LEGACY_STALLED_RECORD_MUST_ROLLBACK');
 assert.equal(oldErrors[0].baseFollowing,true);
 assert.equal(m.readPendingExploreFollowIntents380('legacy-actor').length,0);

 // Final state returns to original before the trailing 8s timer: W0.
 let noOpCalls=0;
 m.queueExploreFollowFinalState380({...seed('noop','owner',true,false),
  commit:async()=>{noOpCalls++;throw Error('must not write')},
  onError:e=>{throw Error('unexpected '+e.error)},onSettled:()=>{},onBusy:()=>{}
 });
 m.queueExploreFollowFinalState380({...seed('noop','owner',true,true),
  restoredUpdatedAt:undefined,
  commit:async()=>{noOpCalls++;throw Error('must not write')},
  onError:e=>{throw Error('unexpected '+e.error)},onSettled:()=>{},onBusy:()=>{}
 });
 clock+=8_001;
 await m.flushExploreFollowPair380(key('noop','owner'));
 assert.equal(noOpCalls,0);
 assert.equal(m.readPendingExploreFollowIntents380('noop').length,0);
// APP566 — isolate the actual follow-only R2 guard; no Worker, Firebase or shared writes.
{
 const actualGuard566=readFileSync('cloudflare/explore-worker/candidates/social-abuse-380.js','utf8');
 const clock566={now:100_000};
 const records566=new Map();let writes566=0;
 const fakeR2566={
   get:async key=>{const item=records566.get(key);return item?{etag:item.etag,text:async()=>item.body}:null;},
   put:async(key,body,options)=>{const item=records566.get(key);
     if(options?.onlyIf?.etagMatches && options.onlyIf.etagMatches!==item?.etag)return null;
     if(options?.onlyIf?.etagDoesNotMatch==='*' && item)return null;
     const etag='E'+(++writes566);records566.set(key,{etag,body});return {etag};}
 };
 const guard566=vm.createContext({Date:{now:()=>clock566.now},throwApi:(code,message,status,headers)=>{
   throw Object.assign(Error(message),{code,status,headers});}});
 vm.runInContext(actualGuard566+'\n;globalThis.testGuard566={policy:socialAbusePolicy380,consume:consumeSocialAbuse380};',guard566);
 const policy566=guard566.testGuard566;
 const env566={SORIDRAW_ENVIRONMENT:'preview',PROFILE_MEDIA:fakeR2566};
 const op566=n=>'operation_'+String(n).padStart(16,'0');
 for(let n=0;n<4;n++){
   await policy566.consume(env566,'actor','follow',[{target:'owner',desired:n%2===0,operationId:op566(n+1)}]);
   clock566.now+=1000;
 }
 assert.equal(writes566,4,'NORMAL_FOLLOW_UNFOLLOW_REFOLLOW_NO_30S_LOCK');
 await assert.rejects(
   policy566.consume(env566,'actor','follow',[{target:'owner',desired:true,operationId:op566(5)}]),
   {code:'RATE_LIMITED'});
 assert.equal(writes566,4,'FIFTH_RAPID_OP_BLOCKED_W0');
 clock566.now+=31_000;
 await policy566.consume(env566,'actor','follow',[{target:'owner',desired:true,operationId:op566(5)}]);
 assert.equal(writes566,5,'COOLDOWN_30S_ONLY');
 const oldAt566=clock566.now-5_000,oldId566=op566(800);
 records566.set('internal/explore/abuse/preview/follow/legacy.json',{etag:'L',
   body:JSON.stringify({schemaVersion:380,events:[oldAt566],
     operations:[{target:'owner',desired:true,operationId:oldId566,at:oldAt566}],
     pairs:[{target:'owner',desired:true,operationId:oldId566,
       at:oldAt566,level:0,nextAllowedAt:oldAt566+30_000}]})});
 await policy566.consume(env566,'legacy','follow',[{target:'owner',desired:false,operationId:op566(801)}]);
 assert.equal(writes566,6,'LEGACY_R2_RECEIPT_REUSED_NO_DATA_RESET');
 assert.equal(JSON.stringify(policy566.policy('like')),
   JSON.stringify({windowLimit:120,dayLimit:600,cooldowns:[30_000,60_000,300_000,1_800_000],
     quietMs:21_600_000,pairMax:600}),'LIKE_POLICY_EXACT_UNCHANGED');
 console.log('FOLLOW_566_NORMAL_SWITCH_AND_LEGACY_RECEIPT_ONLY=PASS');
}

 // APP566: test the exact 2MB canonical Worker composition, not only the
 // unattached guard source. The byte-identical prefix protects all non-follow
 // routes (likes, public songs, notifications, auth and legacy follow code).
 const {composeFollowGuard566}=await import('../cloudflare/explore-worker/candidates/compose-follow-guard-566.mjs');
 const frozen566=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
 const expected566=readFileSync('cloudflare/explore-worker/canonical/source-sha256.txt','utf8').trim();
 const guardSource566=readFileSync('cloudflare/explore-worker/candidates/social-abuse-380.js','utf8');
 const compiled566=composeFollowGuard566(frozen566,guardSource566,expected566);
 const marker566='// SORIDRAW_SOCIAL_ABUSE_STATE_380_20261008';
 const index566=frozen566.indexOf(marker566);
 assert.ok(index566>0,'PINNED_WORKER_HAS_GUARD_SUFFIX');
 assert.equal(compiled566.slice(0,index566),frozen566.slice(0,index566),
   'EVERY_PREEXISTING_WORKER_BYTE_STAYS_IDENTICAL');
 assert.match(compiled566.slice(index566),/LEGACY_FOLLOW_COOLDOWNS_380/);
 assert.match(compiled566.slice(index566),/cooldowns: \[0, 0, 0, 30_000\]/);
 assert.doesNotMatch(compiled566.slice(index566),/cooldowns: \[30_000, 120_000, 600_000, 3_600_000\]/);
 await assert.rejects(async()=>composeFollowGuard566(frozen566+' ',guardSource566,expected566),
   /FROZEN_CANONICAL_SHA_MISMATCH_HOLD/);
 const {spawnSync}=await import('node:child_process');
 const checked566=spawnSync(process.execPath,['--check','--input-type=module'],
   {input:compiled566,encoding:'utf8',maxBuffer:4*1024*1024});
 assert.equal(checked566.status,0,checked566.stderr||'CANDIDATE_SYNTAX_INVALID');
 console.log('FOLLOW_566_COMPILED_WORKER_FOLLOW_ONLY_SUFFIX_AND_SYNTAX=PASS');
 console.log('FOLLOW_031_FIRST_RATE_LIMIT_SHOWS_PENDING_AND_SINGLE_RETRY=PASS');
 console.log('FOLLOW_031_EXHAUSTED_RATE_LIMIT_RESTORES_BASE_AND_ALERTS=PASS');
 console.log('FOLLOW_031_LEGACY_SUSPENDED_UNFOLLOW_REPAIRED_W0=PASS');
 console.log('FOLLOW_031_RETURN_TO_BASE_W0=PASS');
}finally{
 Date.now=originalNow;
 globalThis.setTimeout=origTimeout;globalThis.clearTimeout=origClear;
 if(origStorage===undefined)delete globalThis.localStorage;
 else globalThis.localStorage=origStorage;
}
