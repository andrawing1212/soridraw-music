import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const loadTs=async p=>import('data:text/javascript;base64,'+Buffer.from((await transform(readFileSync(p,'utf8'),{loader:'ts',format:'esm'})).code).toString('base64'));
const {computeStudioHeartSettleDelay,nextStudioHeartHandoffRecoveryAttempt,studioHeartHandoffRecoveryDelay}=await loadTs('src/lib/studioHeartBatch.ts');
const {nextStudioHeartServerAcceptedSeq}=await loadTs('src/lib/studioHeartServerAcceptedOrder.ts');
const {admitStudioHeartClick,recordStudioHeartAcceptedClick}=await loadTs('src/lib/studioHeartClickGuard.ts');
assert.equal(nextStudioHeartServerAcceptedSeq(0,0,1000),1001);
assert.equal(nextStudioHeartServerAcceptedSeq(5100,0,900),5101,
  'a new song after the old slot was removed must follow persistent root order');
assert.equal(nextStudioHeartServerAcceptedSeq(5000,7000,3000),7001,
  'prior same-song seq beats a skewed client clock and root');
assert.equal(nextStudioHeartServerAcceptedSeq(5100,0,9000),9001,
  'current clock can advance the global server-accepted sequence');
assert.throws(()=>nextStudioHeartServerAcceptedSeq(Number.MAX_SAFE_INTEGER,0,1),
  /STUDIO_HEART_SERVER_SEQUENCE_EXHAUSTED/);
const handoffService=readFileSync('src/services/studioHeartHandoff.ts','utf8');
assert.match(handoffService,/const seq = nextStudioHeartServerAcceptedSeq\(/);
assert.match(handoffService,/return \{ version: seq, slots \}/);
console.log('STUDIO_HEART_UID_WIDE_SERVER_ACCEPTED_SEQUENCE_AFTER_SLOT_REMOVAL=PASS');
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
assert.match(recoverSource,/studioHeartAcceptedReceiptsRef\.current\.set\(id, receipt\)/);
assert.match(recoverSource,/applyRemoteStudioHeartPreview\(uid, source, id, receipt\.desiredSaved, presentationVersion\)/);
assert.match(recoverSource,/clearRemoteStudioHeartPreviewFromCanonical\(uid, \[id\]\)/);
assert.match(recoverSource,/previousServerReceipt\.seq > receipt\.seq/);
console.log('STUDIO_HEART_RETAINED_ACCEPTED_RECEIPT_INITIAL_MEMBERSHIP=PASS');
assert.match(recoverSource,/if \(!settled && !closed && retryDelay !== null\)/);
assert.match(recoverSource,/window\.addEventListener\('online', onReconnected\)/);
assert.match(recoverSource,/window\.removeEventListener\('online', onReconnected\)/);
console.log('STUDIO_HEART_HANDOFF_FAILED_CLAIM_RETRY_AND_RECONNECT=PASS');
const uid='abuse-test';
for(let n=0;n<6;n++)assert.equal(admitStudioHeartClick(uid,'song-a',10000+n*200).allowed,true);
const firstBlock=admitStudioHeartClick(uid,'song-a',11200);
assert.equal(firstBlock.allowed,false);assert.equal(firstBlock.retryAfterMs,10000);
assert.equal(firstBlock.notify,true,'show exactly one blocking alert');
assert.equal(admitStudioHeartClick(uid,'song-a',12500).notify,false,'do not spam blocking alerts');
assert.equal(admitStudioHeartClick(uid,'song-b',12500).allowed,true,'another song stays usable');
// The Studio handler uses a preflight check, and records only after the
// visible/save action was accepted. Ignored/failed clicks never consume quota.
for(let n=0;n<30;n++)assert.equal(
  admitStudioHeartClick(uid,'failed-clicks',30000+n*100,false).allowed,true,
  'a rejected/ignored save cannot count toward the click threshold');
for(let n=0;n<6;n++){
  const at=35000+n*200;
  assert.equal(admitStudioHeartClick(uid,'accepted-clicks',at,false).allowed,true);
  recordStudioHeartAcceptedClick(uid,'accepted-clicks',at);
}
assert.equal(admitStudioHeartClick(uid,'accepted-clicks',36400,false).retryAfterMs,10000);
// Spread clicks past the five-second burst, but within thirty seconds.
for(let n=0;n<19;n++)assert.equal(admitStudioHeartClick(uid,'medium-clicks',100000+n*1000).allowed,true);
assert.equal(admitStudioHeartClick(uid,'medium-clicks',119000).retryAfterMs,60000);
// Spread clicks past both shorter windows: only 5-minute threshold fires.
for(let n=0;n<49;n++)assert.equal(admitStudioHeartClick(uid,'long-clicks',200000+n*5500).allowed,true);
assert.equal(admitStudioHeartClick(uid,'long-clicks',200000+49*5500).retryAfterMs,600000);
assert.equal(admitStudioHeartClick(uid,'song-a',25000).allowed,true,'10-second block expires');

const app=readFileSync('src/App.tsx','utf8');
assert.match(app,/const STUDIO_HEART_BATCH_MS = 5_000/);
assert.match(app,/const STUDIO_HEART_MAX_WAIT_MS = 15_000/);
assert.match(app,/firstQueuedAtMs: existing\?\.firstQueuedAtMs \|\| existing\?\.updatedAtMs \|\| now/);
assert.match(app,/computeStudioHeartSettleDelay\(pending, Date\.now\(\), STUDIO_HEART_BATCH_MS, STUDIO_HEART_MAX_WAIT_MS\)/);
assert.match(app,/admitStudioHeartClick\(user\.uid, clickIdentity, favoriteToggleStartedAt, false\)/);
assert.match(app,/recordStudioHeartAcceptedClick\(user\.uid, clickIdentity, favoriteToggleStartedAt\)/);
assert.match(app,/window\.alert\('저장에 문제가 있다면\\n관리자에게 문의하세요\.'\)/);
console.log('STUDIO_HEART_5S_TRAILING_AND_15S_MAX_WAIT=PASS');
console.log('STUDIO_HEART_MULTI_WINDOW_CLICK_GUARD=PASS');
console.log('STUDIO_HEART_OTHER_SONGS_UNBLOCKED=PASS');
