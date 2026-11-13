// APP572 OFF-only PREVIEW Durable Object registration integrity.
// Checks source configuration and abstains from remote Cloudflare/Firebase IO.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='cloudflare/explore-worker/';
const config=JSON.parse(readFileSync(root+'canonical/wrangler.preview.jsonc','utf8'));
assert.equal(config.name,'soridraw-explore-preview');
const bindings=config.durable_objects?.bindings||[];
assert.deepEqual(bindings.map(x=>x.name).sort(),
 ['EXPLORE_LIKE_BATCH_SCHEDULER','OWNER_FOLLOW_RECOVERY_557'].sort());
assert.deepEqual(bindings.map(x=>x.class_name).sort(),
 ['ExploreLikeBatchScheduler103','OwnerFollowerRecovery557'].sort());
assert.equal(config.migrations?.length,2);
assert.deepEqual(config.migrations?.[0],{tag:'v1',new_sqlite_classes:['ExploreLikeBatchScheduler103']});
assert.deepEqual(config.migrations?.[1],{tag:'v2',new_sqlite_classes:['OwnerFollowerRecovery557']});
for(const banned of ['SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','SORIDRAW_OWNER_FOLLOW_BIND_544',
 'SORIDRAW_OWNER_FOLLOW_OVERLAY_551','SORIDRAW_OWNER_FOLLOW_PUSH_532',
 'SORIDRAW_OWNER_FOLLOW_CANARY_UID_574']){
 assert.equal(config.vars?.[banned],undefined,banned+'_MUST_STAY_OFF');
}
const entry=readFileSync(root+'canonical/preview-entry.js','utf8');
assert.ok(entry.includes("export {OwnerFollowerRecovery557} from '../runtime/owner-follow-do-557.mjs';"));
assert.ok(entry.includes("APP557_OWNER_PRECOMMIT_COMPILED_OPEN &&"));
assert.ok(entry.includes('const ownerFollowCanaryRoute574='));
assert.ok(entry.includes('APP557_OWNER_PRECOMMIT_COMPILED_OPEN &&\n       APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN &&\n       ownerFollowCanaryRoute574 &&'));
assert.ok(readFileSync(root+'runtime/owner-follow-service-601.mjs','utf8')
 .includes('export const APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN=false;'));
assert.ok(entry.includes('APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN &&\n       ownerFollowCanaryRoute574 &&'));
assert.equal(entry.includes("'/owner-follow/reserve557'"),false,
 'DO_INTERNAL_ENDPOINT_MUST_NOT_BE_PUBLIC');
for(const [file,flag] of [
 ['runtime/owner-follow-precommit-557.mjs','APP557_OWNER_PRECOMMIT_COMPILED_OPEN'],
 ['runtime/owner-follow-recovery-556.mjs','OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN'],
 ['runtime/owner-follow-do-557.mjs','APP564_OWNER_FOLLOW_DO_BRIDGE_COMPILED_OPEN']
]){
 const source=readFileSync(root+file,'utf8');
 assert.ok(source.includes('export const '+flag+'=false;'),flag+'_MUST_REMAIN_OFF');
}
console.log('APP572_PREVIEW_DO_BOUND_AND_INERT_OFF=PASS');
console.log('APP574_NO_CANARY_CONFIG_MEANS_CANONICAL_WRITER_ONLY=PASS');
console.log('APP572_LIKE_SCHEDULER_MIGRATION_V1_UNCHANGED=PASS');
console.log('APP572_SHARED_D1_FIREBASE_AND_PRODUCTION_UNTOUCHED=PASS');
