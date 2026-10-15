// Regression for the Stage416 Master 5-minute public hold.
// Never leak signed Master changed tracks via legacy 191 repair while the
// ordinary 075 aggregate must remain enabled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const match=src.match(/async runAggregate194\(\) \{([\s\S]*?)\n  \}\n\n  \/\/ SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_JOIN_RACE/);
assert.ok(match,'runAggregate194 body present');
const body=match[1];
assert.match(body,/await baseWorker\.scheduled\(/,'ordinary aggregate preserved');
assert.match(body,/await repairSharedPublicLikeCounts191\(this\.env\)/,
  'bounded ordinary recovery must remain active');
assert.match(src,/await repairSharedPublicLikeCounts191\(env\)/,
  'predeploy drain must use protected 191 recovery');
assert.match(src,/const repair191 = await repairSharedPublicLikeCounts191\(env, \{ oneTime: true \}\)/,
  'one-time repair must use the compensated public count');
assert.match(src,/explore_like_public_hold_446/, 'signed Master hold masked in repair');

async function simulate(publicWindowActive416, stage416Changed416) {
  const calls=[];
  const fakeBase={scheduled:async()=>{calls.push('ordinary-aggregate');
    return {stage416Changed416,changedTrackIds416:stage416Changed416?['master-track']:[]};}};
  const context={
    STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE:publicWindowActive416,
    PUBLIC_LIKE_WINDOW_KEY_416:'public-window',
    baseWorker:fakeBase,
    repairSharedPublicLikeCounts191:async()=>{calls.push('legacy-repair');},
    joinPublicLikeChangedTracks416:async()=>{calls.push('join-held-track');},
    stagePublicLikeOpenPayload416:async()=>{calls.push('stage-held-track');},
    Date,Proxy,Reflect,Set,String,Boolean,Number,Error,
  };
  const cls=vm.runInNewContext('(class Sim {async runAggregate194(){'+body+'\n}})',context);
  const instance=new cls();
  instance.ctx={storage:{get:async()=>({windowId:'window1',publicMinutes:5})}};
  instance.env={};
  await instance.runAggregate194();
  return calls;
}
const held=await simulate(true,true);
assert.deepEqual(held,['ordinary-aggregate','join-held-track'],
  'Master changed track held; ordinary aggregate still executes; 191 cannot leak');
const ordinaryDuringHold=await simulate(true,false);
assert.deepEqual(ordinaryDuringHold,['ordinary-aggregate','legacy-repair'],
  'ordinary R2 repair must continue through a Master window without leaking held delta');
const ordinaryWithoutHold=await simulate(false,false);
assert.deepEqual(ordinaryWithoutHold,['ordinary-aggregate','legacy-repair'],
  'disabled Stage416 retains original 191 behavior');
console.log('STAGE416_191_MASTER_WINDOW_MIXED_GATE=PASS');
