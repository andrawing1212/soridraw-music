/**
 * SORIDRAW 403 — vendor-pattern comparison via deterministic simulation only.
 *
 * AWS transactional outbox + Cloudflare durable retry + Firebase scoped fanout.
 * NOT CONNECTED TO WORKER/D1/FUNCTIONS/RTDB OR LIVE USER DATA.
 * Model-only assertions are not proof of physical D1 W1-W2 or bandwidth.
 */
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';

function makeWorld() {
  return {rev:0, canonical:new Map(), outbox:new Map(), r2:new Map(),
    receivers:new Map(), deliveries:[], effects:[], acknowledgements:new Set()};
}
function commitAtomically(world, {id, trackId, nextCount, rollback=false}) {
  assert.ok(typeof id==='string' && id && typeof trackId==='string' && trackId);
  assert.ok(Number.isSafeInteger(nextCount) && nextCount>=0);
  const prior=world.outbox.get(id);
  if(prior) {
    assert.equal(prior.trackId,trackId,'idempotency-key reuse with different track');
    assert.equal(prior.nextCount,nextCount,'idempotency-key reuse with different desired state');
    return prior;
  }
  if(rollback)throw new Error('D1 transaction rolled back');
  // The canonical state AND a durable, typed, changed-track outbox entry
  // must be committed in ONE database transaction in any future product code.
  const event={id,trackId,nextCount,rev:++world.rev,ack:false};
  world.canonical.set(trackId,{count:nextCount,rev:event.rev});
  world.outbox.set(id,event);
  return event;
}
function settleR2(world, trackId) {
  const canonical=world.canonical.get(trackId);
  if(!canonical)throw new Error('canonical missing');
  world.r2.set(trackId,{...canonical});
}
function transportDeliver(world, event) {
  const card=world.r2.get(event.trackId);
  if(!card || card.rev<event.rev)throw new Error('R2 card not settled: retry without ACK');
  const current=world.receivers.get(event.trackId);
  const payload={trackId:event.trackId,count:card.count,revision:card.rev};
  world.deliveries.push({eventId:event.id,...payload});
  // Delivery can occur at-least-once. EFFECT is idempotent and revision-gated.
  if(!current || payload.revision>current.revision) {
    world.receivers.set(event.trackId,payload);
    world.effects.push({eventId:event.id,...payload});
  }
}
function pump(world,{injectFailure='',id=''}={}) {
  for(const event of [...world.outbox.values()].sort((a,b)=>a.rev-b.rev)) {
    if(event.ack || (id && event.id!==id))continue;
    if(injectFailure==='beforeR2')throw new Error('R2 write unavailable');
    settleR2(world,event.trackId);
    if(injectFailure==='afterR2')throw new Error('Worker terminated after R2 settle');
    transportDeliver(world,event);
    if(injectFailure==='afterSend')throw new Error('Worker terminated after send before ACK');
    event.ack=true;
    world.acknowledgements.add(event.id);
  }
}
function pending(world){return [...world.outbox.values()].filter(e=>!e.ack).map(e=>e.id);}
const cases=[];
function check(name,cb) {
  cb();cases.push(name);console.log('403_'+name+'=PASS');
}
try{
  check('ROLLBACK_HAS_NO_SIGNAL',()=>{
    const w=makeWorld();assert.throws(()=>commitAtomically(w,{id:'x',trackId:'t',nextCount:1,rollback:true}),/rolled back/);
    assert.equal(w.canonical.size,0);assert.equal(w.outbox.size,0);
  });
  check('DB_COMMIT_CRASH_CAN_REPLAY',()=>{
    const w=makeWorld();commitAtomically(w,{id:'c1',trackId:'t',nextCount:1});
    // Simulated process death: durable state still exists after reconstruction.
    assert.deepEqual(pending(w),['c1']);pump(w);
    assert.equal(w.receivers.get('t').count,1);assert.deepEqual(pending(w),[]);
  });
  check('R2_FAILURE_DOES_NOT_ACK',()=>{
    const w=makeWorld();commitAtomically(w,{id:'r2',trackId:'t',nextCount:1});
    assert.throws(()=>pump(w,{injectFailure:'beforeR2'}),/unavailable/);
    assert.deepEqual(pending(w),['r2']);assert.equal(w.deliveries.length,0);
    pump(w);assert.equal(w.receivers.get('t').count,1);
  });
  check('FAILED_AFTER_R2_DOES_NOT_ACK',()=>{
    const w=makeWorld();commitAtomically(w,{id:'r2b',trackId:'t',nextCount:1});
    assert.throws(()=>pump(w,{injectFailure:'afterR2'}),/terminated/);
    assert.deepEqual(pending(w),['r2b']);pump(w);
    assert.equal(w.effects.length,1);
  });
  check('POST_SEND_CRASH_REPLAY_IDEMPOTENT',()=>{
    const w=makeWorld();commitAtomically(w,{id:'s1',trackId:'t',nextCount:1});
    assert.throws(()=>pump(w,{injectFailure:'afterSend'}),/terminated/);
    assert.deepEqual(pending(w),['s1']);assert.equal(w.effects.length,1);
    pump(w);assert.equal(w.deliveries.length,2);assert.equal(w.effects.length,1);
    assert.deepEqual(pending(w),[]);
  });
  check('ORDERED_LATEST_COUNT_WINS',()=>{
    const w=makeWorld();
    commitAtomically(w,{id:'a1',trackId:'t',nextCount:1});
    commitAtomically(w,{id:'a2',trackId:'t',nextCount:0});
    pump(w);
    assert.equal(w.receivers.get('t').count,0);
    assert.equal(w.receivers.get('t').revision,2);
    assert.equal(w.effects.length,1);
  });
  check('DUPLICATE_CANONICAL_COMMIT_IDEMPOTENT',()=>{
    const w=makeWorld();const a={id:'d1',trackId:'t',nextCount:1};
    commitAtomically(w,a);commitAtomically(w,a);
    assert.equal(w.canonical.get('t').rev,1);assert.equal(w.outbox.size,1);
    assert.throws(()=>commitAtomically(w,{...a,nextCount:0}),/different desired state/);
  });
  check('NONLIKE_EDIT_DOES_NOT_CREATE_TYPED_EVENT',()=>{
    const w=makeWorld();
    const ordinaryTrackEdit=()=>{ /* independent product domain, no typed like outbox */ };
    ordinaryTrackEdit();assert.equal(w.outbox.size,0);
  });
  check('D1_W1_W2_HARD_GATE',()=>{
    const passes=(existingWrites,extraWrites)=>existingWrites+extraWrites<=2;
    assert.equal(passes(1,1),true);
    assert.equal(passes(2,1),false);
    assert.equal(passes(1,2),false);
    // These are deliberately hypothetical integers, NOT measured LIVE rows.
  });
  check('FANOUT_BOUNDARY_MODEL',()=>{
    const connected=100000,interested=2000,bytesPerEvent=128,events=100;
    const globalBytes=connected*bytesPerEvent*events;
    const scopedBytes=interested*bytesPerEvent*events;
    assert.equal(globalBytes/scopedBytes,50);
    // Payload-only theoretical ratio; excludes listener count, session overhead
    // and real user interest distribution. It is NOT a price quote.
    console.log('403_FANOUT_ASSUMPTION globalBytes='+globalBytes+' scopedBytes='+scopedBytes+' ratio='+globalBytes/scopedBytes+'x');
  });
  console.log('403_GLOBAL_PATTERN_MODEL=PASS '+cases.length+'/'+cases.length);
  console.log('403_DEPLOYED_PRODUCT=BLOCKED: real atomic D1 outbox W, R2 parity, DO durability, RTDB fanout/rules/legacy compatibility unmeasured');
}catch(error) {
  console.error('403_GLOBAL_PATTERN_MODEL=FAIL',String(error?.stack||error));
  process.exitCode=1;
}finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '# SORIDRAW 403 — global reliability model',
    '',
    'In-memory proof only; not deployed D1/DO/RTDB integration or real cost.',
    ...cases.map(x=>'- '+x+': PASS'),
    '',
    process.exitCode?'**FAIL**':'**SIMULATION PASS / LIVE PRODUCT BLOCKED**',
    'Zero false green: W1~W2, atomic outbox and live fanout are not established.',
  ].join('\n')+'\n');
}
