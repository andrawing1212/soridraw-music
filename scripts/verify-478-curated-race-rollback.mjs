// #203 app478 deterministic source-only safety model for app477 release barrier.
// No network, user data, D1/R2, worker deploy, or real flag changes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activation477, bindings477, expectedAppConfig477, frontendAssets477,
  originOwnership477, rollbackOrder477,
} from './verify-477-curated-active-writer-gate.mjs';

const stages=[
  {name:'PREVIEW',origin:'https://preview.soridraw.com',worker:'soridraw-explore-preview',cache:'soridraw-profile-media-preview'},
  {name:'TEST',origin:'https://test.soridraw.com',worker:'soridraw-explore-test',cache:'soridraw-profile-media-test'},
  {name:'PRODUCTION',origin:'https://soridraw.com',worker:'soridraw-explore-api',cache:'soridraw-profile-media-prod'},
];
const dbId='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
function mockBindings(stage) {
  return {result:{bindings:[
    {name:'DB',type:'d1',id:dbId},
    {name:'RATE_DB',type:'d1',id:'isolated-'+stage.name},
    {name:'PROFILE_MEDIA',type:'r2_bucket',bucket_name:'soridraw-profile-media'},
    {name:'EXPLORE_CACHE',type:'r2_bucket',bucket_name:stage.cache},
    {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace'},
  ]}};
}
const config=readFileSync('src/config/exploreEnvironment.ts','utf8');
for(const stage of stages) {
  expectedAppConfig477(config,stage);
  const bindings=mockBindings(stage);
  const actual=bindings477(bindings,stage);
  assert.equal(actual.cacheName,stage.cache);
  assert.throws(()=>bindings477({result:{bindings:bindings.result.bindings.filter(x=>x.name!=='EXPLORE_CACHE')}},stage),
    /EXPLORE_CACHE_REQUIRED/);
  assert.throws(()=>bindings477({result:{bindings:bindings.result.bindings.map(x=>x.name==='EXPLORE_CACHE'
    ? {...x,bucket_name:'soridraw-profile-media'}:x)}},stage),/CACHE_NOT_ISOLATED/);
  const docs={result:[]},routes={result:[]};
  originOwnership477(docs,routes,stage);
  assert.throws(()=>originOwnership477({result:[{hostname:new URL(stage.origin).hostname,service:'foreign'}]},routes,stage),
    /FIREBASE_APP_HOST_WORKER_DOMAIN_TAKEOVER/);
  assert.throws(()=>originOwnership477(docs,{result:[{pattern:new URL(stage.origin).hostname+'/*',script:'foreign'}]},stage),
    /FIREBASE_APP_HOST_WORKER_ROUTE_TAKEOVER/);
  const html='<html><script type="module" src="/assets/index.js"></script></html>';
  const js='const host="'+new URL(stage.origin).hostname+'";let api="https://'+stage.worker+'.andrawing1212.workers.dev";';
  frontendAssets477(html,[js],stage);
  assert.throws(()=>frontendAssets477(html,[js.replace(stage.worker,'foreign-worker')],stage),
    /LIVE_APP_API_BUNDLE_MISMATCH/);
}
const collision=stages.map((s,i)=>({name:s.name,compatible:true,rateId:'rate'+i,cacheName:i===2?stages[1].cache:s.cache,versionId:'v'+i}));
assert.throws(()=>activation477(collision,null),/CACHE_COLLISION/);
const noCache=collision.map((s,i)=>i===1?{...s,cacheName:'PROFILE_MEDIA_FALLBACK'}:s);
assert.throws(()=>activation477(noCache,null),/CACHE_NOT_ISOLATED/);

// The scenario operates on mutable canonical and derived stores. In particular,
// the old in-flight writer is a deferred operation that COMMITS after a new
// reconciliation; checking strings for inequality is not enough.
class CuratedWorld {
  constructor() {
    this.db=new Map([['a',{picked:true,visible:true}],['b',{picked:false,visible:true}]]);
    this.shared={etag:1,items:this.project()};
    this.legacy=new Map(stages.map(s=>[s.name,{etag:1,items:this.project()}]));
    this.calls={d1Reads:0,r2Writes:0};
    this.readerFlags=new Map(stages.map(s=>[s.name,false]));
    this.pending=null;
    this.generation=0;
  }
  project() {
    return [...this.db].filter(([,v])=>v.picked&&v.visible).map(([id])=>id);
  }
  oldRequest(trackId,changes) {
    return () => { this.db.set(trackId,{...this.db.get(trackId),...changes}); };
    // Deliberately no shared-R2 mutation: app377 legacy writer behavior.
  }
  reconcile() {
    this.calls.d1Reads++;
    const oldTag=this.shared.etag;
    const updated=this.project();
    return this.casShared(oldTag,updated);
  }
  casShared(expected,items) {
    if(expected!==this.shared.etag)return false;
    this.shared={etag:this.shared.etag+1,items:[...items]};
    this.calls.r2Writes++;
    return true;
  }
  legacyWarm(stage) {
    const before={...this.calls};
    const items=[...this.legacy.get(stage).items];
    assert.deepEqual(this.calls,before,'warm v307 entry must not read D1 or write R2');
    return items;
  }
  share(stage) {
    if(!this.readerFlags.get(stage)) throw Error('V466_READER_OFF');
    return [...this.shared.items];
  }
  reserve(trackId) {
    const ticket={trackId,generation:++this.generation,confirmed:false};
    this.pending=ticket;
    return ticket;
  }
  confirm(generation) {
    if(this.pending?.generation!==generation)return false;
    this.pending.confirmed=true;
    return true;
  }
  ack(generation) {
    if(this.pending?.generation!==generation||!this.pending.confirmed)return false;
    this.pending=null;
    return true;
  }
}
const world=new CuratedWorld();
const readsBefore={...world.calls};
for(const s of stages) assert.deepEqual(world.legacyWarm(s.name),['a']);
assert.deepEqual(world.calls,readsBefore);
const latePromotion=world.oldRequest('b',{picked:true});
assert.equal(world.reconcile(),true);
latePromotion();  // Old code commits to canonical D1 *after* R2 reconciliation.
assert.deepEqual(world.project(),['a','b']);
assert.deepEqual(world.shared.items,['a']);
for(const s of stages) assert.throws(()=>world.share(s.name),/V466_READER_OFF/);
assert.equal(world.reconcile(),true);
assert.deepEqual(world.shared.items,['a','b']);
const lateVisibility=world.oldRequest('a',{visible:false});
lateVisibility();
assert.deepEqual(world.project(),['b']);
assert.deepEqual(world.shared.items,['a','b']);
const lateRemoval=world.oldRequest('b',{picked:false});
lateRemoval();
assert.deepEqual(world.project(),[]);
assert.deepEqual(world.shared.items,['a','b']); // Missing member/removal not reflected.
const oldSharedTag=world.shared.etag;
const earlierItems=['a','b'];
assert.equal(world.reconcile(),true);
assert.deepEqual(world.shared.items,[]);
assert.equal(world.casShared(oldSharedTag,earlierItems),false,'stale CAS must not resurrect a removed track');
assert.deepEqual(world.shared.items,[]);

// Concurrent reservation: an earlier ACK cannot erase newer pending work.
// A 503/detail failure must keep the reservation rather than claiming complete.
const first=world.reserve('a');
assert.equal(world.ack(first.generation),false,'unconfirmed repair cannot be ACKed');
const second=world.reserve('b');
assert.equal(world.confirm(first.generation),false);
assert.equal(world.ack(first.generation),false);
assert.equal(world.pending.generation,second.generation);
assert.equal(world.confirm(second.generation),true);
assert.equal(world.ack(second.generation),true);
assert.equal(world.pending,null);

// Rollback order is checked across ALL environments, not just the target.
const allOff=[...stages.map(s=>({type:'reader_off_requested',stage:s.name})),
  ...stages.map(s=>({type:'reader_off_observed',stage:s.name}))];
assert.throws(()=>rollbackOrder477([{type:'restore_legacy_writer',stage:'TEST'},...allOff]),
  /ROLLBACK_READER_STILL_ON_OR_UNVERIFIED/);
assert.throws(()=>rollbackOrder477([
  {type:'reader_off_requested',stage:'TEST'},
  {type:'reader_off_observed',stage:'TEST'},
  {type:'restore_legacy_writer',stage:'TEST'},
]),/ROLLBACK_READER_STILL_ON_OR_UNVERIFIED/);
assert.equal(rollbackOrder477([...allOff,{type:'restore_legacy_writer',stage:'TEST'}]),true);
// Passing this ordered model does NOT certify remote OFF; activation stays HOLD.
const healthy=stages.map((s,i)=>({name:s.name,compatible:true,rateId:'rate'+i,cacheName:s.cache,versionId:'v'+i}));
assert.throws(()=>activation477(healthy,null),/OLD_INFLIGHT_RETIREMENT_UNPROVEN/);
assert.throws(()=>activation477(healthy,{
  verifiedByIndependentLiveDrain:true,evidenceId:'unverified-operator-claim',
  activeVersionIds:Object.fromEntries(healthy.map(s=>[s.name,s.versionId])),
}),/INDEPENDENT_DRAIN_PROOF_VERIFIER_NOT_IMPLEMENTED/);

console.log('APP478_LIVE_ORIGIN_OWNERSHIP_AND_ISOLATED_R2_FIXTURES=PASS');
console.log('APP478_DEFERRED_OLD_D1_WRITER_VISIBILITY_REMOVAL=PASS');
console.log('APP478_CAS_RESERVATION_AND_ROLLBACK_ORDER=PASS');
console.log('APP478_LIVE_DRAIN_ATTESTATION=HOLD');
