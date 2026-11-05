import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const loadTs=async p=>import('data:text/javascript;base64,'+Buffer.from((await transform(readFileSync(p,'utf8'),{loader:'ts',format:'esm'})).code).toString('base64'));
const {computeStudioHeartSettleDelay,nextStudioHeartHandoffRecoveryAttempt,studioHeartHandoffRecoveryDelay}=await loadTs('src/lib/studioHeartBatch.ts');
const {admitStudioHeartClick}=await loadTs('src/lib/studioHeartClickGuard.ts');
assert.equal(computeStudioHeartSettleDelay({updatedAtMs:1000,firstQueuedAtMs:1000},1000),5000);
assert.equal(computeStudioHeartSettleDelay({updatedAtMs:5000,firstQueuedAtMs:1000},5000),5000);
assert.equal(computeStudioHeartSettleDelay({updatedAtMs:14000,firstQueuedAtMs:1000},14000),2000);
assert.equal(computeStudioHeartSettleDelay({updatedAtMs:15800,firstQueuedAtMs:1000},15800),200);
assert.equal(computeStudioHeartSettleDelay({updatedAtMs:17000,firstQueuedAtMs:1000},17000),1);
assert.equal(computeStudioHeartSettleDelay({updatedAtMs:4000,firstQueuedAtMs:1000},7000),2000);
let remoteAttempt=null;
for(let n=0;n<3;n++){
  remoteAttempt=nextStudioHeartHandoffRecoveryAttempt(remoteAttempt,11,1000+n*60000);
  assert.equal(remoteAttempt.attempts,n+1);
  assert.equal(remoteAttempt.retryAfterMs,61000+n*60000);
}
assert.equal(nextStudioHeartHandoffRecoveryAttempt(remoteAttempt,11,190000),null,'bounded remote retries');
assert.equal(nextStudioHeartHandoffRecoveryAttempt(remoteAttempt,12,190000).attempts,1,'new click reopens recovery');
const waiting={version:19,attempts:1,retryAfterMs:61000};
assert.equal(studioHeartHandoffRecoveryDelay(waiting,{seq:19,desiredSaved:true},{seq:19,desiredSaved:true},1200),59800,
  'failed claim must retry without another RTDB child event');
assert.equal(studioHeartHandoffRecoveryDelay(waiting,{seq:19,desiredSaved:true},{seq:19,desiredSaved:true},62000),500,
  'expired cooldown allows prompt retry');
assert.equal(studioHeartHandoffRecoveryDelay(waiting,{seq:20,desiredSaved:false},{seq:19,desiredSaved:true},1200),null,
  'a later opposing click blocks the stale retry');
assert.equal(studioHeartHandoffRecoveryDelay({...waiting,attempts:3},{seq:19,desiredSaved:true},{seq:19,desiredSaved:true},1200),null,
  'retry remains bounded without runaway Firestore requests');
assert.equal(studioHeartHandoffRecoveryDelay(waiting,null,{seq:19,desiredSaved:true},1200),null,
  'removed server receipt is not replayed');
const recoverSource=readFileSync('src/App.tsx','utf8').split('// Account-private child events carry durable requests')[1].split('const updateFavorite = async')[0];
assert.match(recoverSource,/latestReceipts\.set\(id, receipt\)/);
assert.match(recoverSource,/if \(!settled && !closed && retryDelay !== null\)/);
assert.match(recoverSource,/window\.addEventListener\('online', onReconnected\)/);
assert.match(recoverSource,/window\.removeEventListener\('online', onReconnected\)/);
console.log('STUDIO_HEART_HANDOFF_FAILED_CLAIM_RETRY_AND_RECONNECT=PASS');
const uid='abuse-test';
for(let n=0;n<5;n++)assert.equal(admitStudioHeartClick(uid,'song-a',10000+n*200).allowed,true);
const firstBlock=admitStudioHeartClick(uid,'song-a',11000);
assert.equal(firstBlock.allowed,false);assert.equal(firstBlock.retryAfterMs,20000);
assert.equal(admitStudioHeartClick(uid,'song-a',12500).notify,false,'do not spam popup');
assert.equal(admitStudioHeartClick(uid,'song-b',12500).allowed,true,'other song not blocked');
let blocked=false;
for(let n=0;n<30;n++){if(!admitStudioHeartClick(uid,'slow-macro',50000+n*3000).allowed){blocked=true;break;}}
assert.equal(blocked,true,'slow macro blocked by 30s/5m window');
const app=readFileSync('src/App.tsx','utf8');
assert.match(app,/const STUDIO_HEART_BATCH_MS = 5_000/);
assert.match(app,/const STUDIO_HEART_MAX_WAIT_MS = 15_000/);
assert.match(app,/firstQueuedAtMs: existing\?\.firstQueuedAtMs \|\| existing\?\.updatedAtMs \|\| now/);
assert.match(app,/computeStudioHeartSettleDelay\(pending, Date\.now\(\), STUDIO_HEART_BATCH_MS, STUDIO_HEART_MAX_WAIT_MS\)/);
assert.match(app,/admitStudioHeartClick\(user\.uid, clickIdentity\)/);
console.log('STUDIO_HEART_5S_TRAILING_AND_15S_MAX_WAIT=PASS');
console.log('STUDIO_HEART_MULTI_WINDOW_CLICK_GUARD=PASS');
console.log('STUDIO_HEART_OTHER_SONGS_UNBLOCKED=PASS');
