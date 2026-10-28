// Offline release-contract red team; NO Cloudflare, R2, D1 or Firebase access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 FENCE_CONTRACT_518,MEDIA_TARGETS_518,assessSharedWriterCutover518,
 assessLegacyMediaMutation518,
} from '../cloudflare/media-worker/src/catalogSharedWriterRolloutGate518.js';
import {
 classifyCatalogAuthority518,decideCatalogWriterAuthority518,
} from '../cloudflare/media-worker/src/catalogAuthorityPolicy518.js';

const worker=readFileSync('cloudflare/media-worker/src/index.js','utf8');
assert.match(worker,/import \{ FENCE_CONTRACT_518 \} from '\.\/catalogSharedWriterRolloutGate518\.js'/);
assert.match(worker,/catalogWriterFence518:\s*\{/);
assert.match(worker,/sourceInstalled: true/);
assert.match(worker,/canonicalEnabled: isCanonicalCatalogAuthority518\(env\)/);
const cfg=JSON.parse(readFileSync('cloudflare/media-worker/wrangler.jsonc','utf8'));
const allVars=[cfg.vars,cfg.env.test.vars,cfg.env.production.vars];
assert.ok(allVars.every(x=>x.SORIDRAW_SHARED_CATALOG_V1==='1'
 &&x.SORIDRAW_CANONICAL_CATALOG_518==null),
 'all three shared R2 environments must keep canonical cutover OFF');
const approved=Object.fromEntries(MEDIA_TARGETS_518.map((t,i)=>{
 const d=String(i+1);
 return [t.stage,d.repeat(8)+'-'+d.repeat(4)+'-4'+d.repeat(3)
    +'-8'+d.repeat(3)+'-'+d.repeat(12)];
}));
const mkWorker=t=>({
 stage:t.stage,script:t.script,mediaBucket:t.media,
 catalogBucket:'soridraw-user-catalog',sharedFlag:'1',canonicalFlag:null,
 activeVersions:[{versionId:approved[t.stage],percentage:100}],
 health:{fenceContract:FENCE_CONTRACT_518,sourceInstalled:true,
  canonicalEnabled:false},
});
const beforeMs=1_800_000_000_000;
const snapshots=[
 {atMs:beforeMs,workers:MEDIA_TARGETS_518.map(mkWorker)},
 {atMs:beforeMs+600_000,workers:MEDIA_TARGETS_518.map(mkWorker)},
];
const retiredOldFlights=MEDIA_TARGETS_518.map(x=>({
 stage:x.stage,versionId:approved[x.stage],
 source:'INDEPENDENT_RELEASE_AUDIT',outcome:'VERIFIED',
 checkedAtMs:beforeMs+600_000,
}));
const input=()=>structuredClone({snapshots,approvedVersions:approved,
 rollbackVersions:{...approved},retiredOldFlights,nowMs:beforeMs+600_000});
const check=(modify,expected)=>{
 const sample=input();
 modify(sample);
 const status=assessSharedWriterCutover518(sample);
 assert.equal(status.pass,false,expected);
 assert.match(status.code,expected);
 assert.equal(status.canEnableCanonical,false);
};
const certified=assessSharedWriterCutover518(input());
assert.equal(certified.code,'THREE_WORKER_FENCE_PREFLIGHT_PASS');
assert.equal(certified.pass,true);
assert.equal(certified.canEnableCanonical,false);
assert.match(certified.require,/EXPLICIT_DIRECTOR_DEPLOY_APPROVAL/);
check(x=>{x.snapshots[1].workers[1].health.sourceInstalled=false},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[1].workers[2].health.fenceContract='old'},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[1].workers[0].activeVersions.push({
 versionId:x.approvedVersions.preview,percentage:0})},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[0].workers[2].activeVersions[0].percentage=99.9},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[1].workers[1].catalogBucket='other'},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[1].workers[1].sharedFlag='0'},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[1].workers[1].canonicalFlag='ENABLED_AFTER_SHARED_ROLLOUT'},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[1].workers[1].health.canonicalEnabled=true},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[1].workers[0].activeVersions[0].versionId=
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},/HOLD_LEGACY_WRITER/);
check(x=>{x.approvedVersions.test='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
 /HOLD_LEGACY_WRITER/);
check(x=>{x.snapshots[0].workers.pop()},/HOLD_MISSING_WORKER/);
check(x=>{x.snapshots[1].atMs=x.snapshots[0].atMs+599999},
 /HOLD_OLD_WORKER_DRAIN_WINDOW/);
check(x=>{x.nowMs=x.snapshots[1].atMs+120001},
 /HOLD_OLD_WORKER_DRAIN_WINDOW/);
check(x=>{x.retiredOldFlights=[]},/HOLD_OLD_INFLIGHT/);
check(x=>{x.retiredOldFlights[0].outcome='ASSUMED_FROM_100_PERCENT'},
 /HOLD_OLD_INFLIGHT/);
check(x=>{x.rollbackVersions.production='ffffffff-ffff-4fff-8fff-ffffffffffff'},
 /HOLD_UNFENCED_ROLLBACK/);
check(x=>{delete x.rollbackVersions.test},/HOLD_UNFENCED_ROLLBACK/);
// Real current Cloudflare screenshot evidence: 100% traffic and shared
// R2 are NOT sufficient to claim installed 518 source or drained old flights.
const oldWorker=input();
oldWorker.snapshots[0].workers.forEach(w=>{delete w.health;});
oldWorker.snapshots[1].workers.forEach(w=>{delete w.health;});
assert.equal(assessSharedWriterCutover518(oldWorker).pass,false);
// Existing un-migrated older browsers still apply deltas while the switch
// stays OFF; protected owner must reject legacy browser delta and rebuild.
const legacy={kind:'musicNote',headRevision:100};
const protectedOwner={...legacy,canonicalAuthority518:true,
 sourceLedger518:{deleted:{state:'removed'}}};
assert.equal(classifyCatalogAuthority518(legacy,'musicNote').code,
 'LEGACY_UNFENCED');
assert.equal(decideCatalogWriterAuthority518({
 kind:'musicNote',head:legacy,operation:'legacy-delta',
}).code,'LEGACY_ALLOWED_WHILE_NOT_MIGRATED');
for(const operation of ['legacy-delta','bootstrap','rebuild','seed-legacy']){
 assert.match(decideCatalogWriterAuthority518({
  kind:'musicNote',head:protectedOwner,operation,
 }).code,/^DENY_/);
}
// The existing release controller must enforce the three-Worker barrier
// before upload, activation AND restoring a previous version.
const releases=readFileSync('.deploy/release-media-worker-runtime.mjs','utf8');
assert.match(releases,/assessLegacyMediaMutation518/);
const boundary=releases.indexOf("if (['upload', 'activate', 'restore'].includes(action))");
assert.ok(boundary>0);
const restoreDispatch=releases.indexOf("if (action === 'restore') {");
const uploadDispatch=releases.indexOf("if (action === 'upload') {");
assert.ok(boundary<restoreDispatch&&boundary<uploadDispatch);
assert.match(releases,/Object.values\(TARGETS\)\.map/);
assert.match(releases,/workers\/scripts\/\$\{worker\}\/settings/);
const valid={action:'restore',sourceCanonicalFlag:null,
 liveCanonicalFlags:[null,null,null]};
for(const action of ['upload','activate','restore']){
 assert.equal(assessLegacyMediaMutation518({...valid,action}).pass,true);
 for(let i=0;i<3;i++){
  const flags=[null,null,null];flags[i]='ENABLED_AFTER_SHARED_ROLLOUT';
  assert.equal(assessLegacyMediaMutation518({
   ...valid,action,liveCanonicalFlags:flags,
  }).pass,false);
 }
 for(const sourceCanonicalFlag of [
  'ENABLED_AFTER_SHARED_ROLLOUT','OFF','UNKNOWN_SECRET',
 ]){
  assert.equal(assessLegacyMediaMutation518({
   ...valid,action,sourceCanonicalFlag,
  }).pass,false);
 }
}
for(const liveCanonicalFlags of [
 [],[null],[null,null],[null,null,null,null],
 [null,null,'UNKNOWN_SECRET'],[null,'OFF',null],
]){
 assert.equal(assessLegacyMediaMutation518({
  ...valid,liveCanonicalFlags,
 }).pass,false);
}
assert.equal(assessLegacyMediaMutation518({
 ...valid,action:'dry-run',
}).pass,false);
console.log('APP518_RELEASE_CONTROLLER_ALL_THREE_LIVE_FLAGS_BEFORE_MUTATION=PASS');
console.log('APP518_LEGACY_UPLOAD_ACTIVATE_RESTORE_STOP_AFTER_CANONICAL=PASS');

console.log('APP518_THREE_IMMUTABLE_WORKER_VERSIONS_REQUIRED=PASS');
console.log('APP518_TRAFFIC_SPLIT_OLD_TEST_PROD_WORKER_DENIED=PASS');
console.log('APP518_SHARED_R2_BINDINGS_AND_CANONICAL_OFF_REQUIRED=PASS');
console.log('APP518_OLD_INFLIGHT_AND_ROLLBACK_FENCE_REQUIRED=PASS');
console.log('APP518_OLD_BROWSER_PRE_CUTOVER_AND_PROTECTED_HEAD_CAS=PASS');
console.log('APP518_ROLLOUT_PREFLIGHT_NEVER_AUTHORIZES_DEPLOYMENT=PASS');
