// Shared owner-follow candidate contract; source-only and OFF.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

assert.deepEqual(process.argv.slice(2), ['--source-only'],
  'APP585_EXPLICIT_SOURCE_ONLY_REQUIRED');
const read=p=>readFileSync(p,'utf8');
const original=JSON.parse(read('database.rules.json')).rules;
const proposed=JSON.parse(read('scripts/emulator/app550.additive.database.rules.json')).rules;
const isolated=JSON.parse(read('scripts/emulator/app533.database.rules.json')).rules;
assert.equal(JSON.parse(read('firebase.json')).database.rules,'database.rules.json');
assert.equal(original['.read'],false);
assert.equal(original['.write'],false);
assert.equal(Object.hasOwn(original,'ownerFollowerSync532'),false);
assert.deepEqual(Object.keys(proposed).sort(),
  [...Object.keys(original),'ownerFollowerSync532'].sort());
for(const [k,v] of Object.entries(original))
  assert.deepEqual(proposed[k],v,'APP585_ORIGINAL_RULE_CHANGED_'+k);
assert.deepEqual(proposed.ownerFollowerSync532,isolated.ownerFollowerSync532);
const owner=proposed.ownerFollowerSync532?.$uid;
assert.equal(owner?.['.write'],false);
for(const guard of ['auth.uid === $uid','soridrawFollowEpoch532',
  "data.child('authEpoch')",'!data.exists()'])
  assert.ok(owner['.read'].includes(guard),'OWNER_GUARD_MISSING_'+guard);
console.log('APP585_ONLY_OWNER_PRIVATE_RULE_ADDED=PASS');

const sql=read('cloudflare/explore-worker/candidates/570-owner-follow-do-epoch-minimal-off.sql')
  .replace(/--.*$/gm,'').trim();
const ddl=sql.split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(ddl.length,2);
assert.match(ddl[0],/^ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_epoch_532\s+TEXT NOT NULL DEFAULT ''$/i);
assert.match(ddl[1],/^ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_created_at_ms_544\s+INTEGER NOT NULL DEFAULT 0$/i);
assert.doesNotMatch(sql,/\b(CHECK|TRIGGER|INDEX|UPDATE|INSERT|DELETE|CREATE|DROP)\b/i);
console.log('APP585_TWO_DORMANT_D1_COLUMNS_NO_BACKFILL=PASS');

const config=JSON.parse(read('cloudflare/explore-worker/canonical/wrangler.preview.jsonc'));
assert.equal(config.name,'soridraw-explore-preview');
assert.deepEqual(config.triggers?.crons,['37 * * * *']);
assert.deepEqual(config.durable_objects?.bindings,[
  {name:'EXPLORE_LIKE_BATCH_SCHEDULER',class_name:'ExploreLikeBatchScheduler103'},
  {name:'OWNER_FOLLOW_RECOVERY_557',class_name:'OwnerFollowerRecovery557'}
]);
assert.deepEqual(config.migrations,[
  {tag:'v1',new_sqlite_classes:['ExploreLikeBatchScheduler103']},
  {tag:'v2',new_sqlite_classes:['OwnerFollowerRecovery557']}
]);
for(const key of [
 'SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','SORIDRAW_OWNER_FOLLOW_BIND_544',
 'SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547','SORIDRAW_OWNER_FOLLOW_PUSH_532',
 'SORIDRAW_OWNER_FOLLOW_CANARY_UID_574','SORIDRAW_OWNER_FOLLOW_ENDPOINT_539'
])assert.equal(config.vars?.[key],undefined,'APP585_LIVE_VARIABLE_'+key);
const entry=read('cloudflare/explore-worker/canonical/preview-entry.js');
assert.ok(entry.includes("export {OwnerFollowerRecovery557} from '../runtime/owner-follow-do-557.mjs';"));
assert.ok(entry.includes('APP557_OWNER_PRECOMMIT_COMPILED_OPEN &&'));
assert.ok(entry.includes('APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN &&'));
const off=(path,name)=>assert.match(read(path),
 new RegExp('export const '+name+'\\s*=\\s*false\\s*;'),
 'APP585_COMPILED_GATE_OPEN_'+name);
for(const [path,flag] of [
 ['owner-follow-precommit-557.mjs','APP557_OWNER_PRECOMMIT_COMPILED_OPEN'],
 ['owner-follow-postcommit-555.mjs','APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN'],
 ['owner-follow-recovery-556.mjs','OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN'],
 ['owner-follow-do-557.mjs','APP564_OWNER_FOLLOW_DO_BRIDGE_COMPILED_OPEN'],
 ['owner-follow-http-539.mjs','APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN'],
 ['owner-follow-enrollment-544.mjs','APP544_OWNER_EPOCH_BIND_COMPILED_OPEN'],
 ['owner-follow-current-auth-547.mjs','OWNER_FOLLOW_AUTH_PROOF_547_COMPILED_OPEN']
])off('cloudflare/explore-worker/runtime/'+path,flag);
// APP614: Compile the explicit PREVIEW canary, but the server READY_608
// environment gate is still absent, and no Cloudflare routes are active.
const canaryOn=(path,flag)=>assert.match(read(path),
 new RegExp('export const '+flag+'\\s*=\\s*true\\s*;'),
 'APP614_CANARY_COMPILED_GATE_NOT_READY_'+flag);
for(const flag of ['EXPLORE_OWNER_FOLLOW_REALTIME_542_ENABLED',
 'APP575_OWNER_CANARY_BOOTSTRAP_ENABLED'])
 canaryOn('src/services/exploreOwnerFollowerSync542.ts',flag);
for(const [path,flag] of [
 ['exploreOwnerFollowerWebhook542.ts','APP542_OWNER_HTTP_COMPILED_OPEN'],
 ['ownerFollowEnrollment544.ts','APP544_ENROLLMENT_COMPILED_OPEN'],
 ['ownerFollowAuthProof547.ts','APP547_AUTH_PROOF_COMPILED_OPEN']
])canaryOn('functions/src/'+path,flag);
for(const path of ['exploreOwnerFollowerWebhook542.ts',
 'ownerFollowEnrollment544.ts','ownerFollowAuthProof547.ts']){
 const code=read('functions/src/'+path);
 assert.ok(code.includes("process.env.SORIDRAW_OWNER_FOLLOW_READY_608!=='1'"),
  'APP614_SERVER_READY_GATE_MISSING');
 assert.ok(code.includes('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')&&
  code.includes('APP608_CANARY_SHA256'),'APP614_PINNED_OWNER_GATE_MISSING');
}
const clientCanary=read('src/services/exploreOwnerFollowerSync542.ts');
assert.ok(clientCanary.includes('!isApp608OwnerCanaryVisible(uid)'),
 'APP591_PREVIEW_EXPLICIT_CANARY_GATE_MISSING');
assert.ok(clientCanary.indexOf('!isApp608OwnerCanaryVisible(uid)')<
 clientCanary.indexOf('const principal=auth.currentUser'),
 'APP591_CANARY_GATE_MUST_PRECEDE_AUTH_READ');
assert.ok(clientCanary.includes("typeof window==='undefined'?'':window.location.hostname.toLowerCase()"),
 'APP591_PREVIEW_HOST_REQUIRED');
assert.ok(clientCanary.includes("typeof window==='undefined'?'':window.location.search"),
 'APP591_EXPLICIT_URL_REQUIRED');
console.log('APP591_PREVIEW_EXPLICIT_CANARY_BEFORE_AUTH=PASS');
const index=read('functions/src/index.ts');
assert.ok(index.includes('databaseURL: "https://soridraw-app-866a5-default-rtdb.firebaseio.com"'));
for(const fn of ['publishExploreOwnerFollower542',
 'enrollOwnerFollow544Candidate','verifyOwnerFollowEpoch547Candidate'])
 assert.ok(index.includes('export {'+fn+'} from '),'APP585_FUNCTION_EXPORT_MISSING_'+fn);
const qa=read('functions/qa577/src/index.ts');
assert.ok(qa.includes("initializeApp({projectId:'soridraw-app',databaseURL:plan.databaseURL}"));
assert.doesNotMatch(qa,/from ['"].*\.\.\/\.\.\/src\/index/);
const sender=read('cloudflare/explore-worker/runtime/owner-follow-http-539.mjs');
assert.ok(sender.includes(
 'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542'));
console.log('APP614_CLIENT_FUNCTIONS_SOURCE_ON_SERVER_RUNTIME_HELD=PASS');
console.log('APP585_QA_AND_SHARED_PROJECTS_SEPARATE=PASS');
console.log('APP585_SOURCE_CANDIDATE_VALID=PASS');
console.log('APP585_SHARED_RELEASE=NO_GO_REQUIRES_LIVE_VERIFICATION_APPROVAL');
