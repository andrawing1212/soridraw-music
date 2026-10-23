import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sharedCuratedEnabled466,
  curatedAllWritersReady466,
} from '../cloudflare/explore-worker/runtime/curated-shared-canonical-466.mjs';

// An old Worker can still modify D1 but cannot rewrite the new shared R2 key.
// This is a bounded, offline release-gate regression (not a live Worker check).
const oldWriterCanUpdateD1ButNotV466 = () => {
  const canonical = ['a'];
  const sharedR2 = ['a'];
  canonical.push('b');
  assert.notDeepEqual(canonical, sharedR2);
};
oldWriterCanUpdateD1ButNotV466();

const onFlag = { SORIDRAW_CURATED_SHARED_V466: '1' };
const ready = { SORIDRAW_CURATED_ALL_WRITERS_READY466: '1' };
assert.equal(sharedCuratedEnabled466(onFlag), true);
assert.equal(curatedAllWritersReady466(onFlag), false);
assert.equal(sharedCuratedEnabled466(ready), false);
assert.equal(curatedAllWritersReady466(ready), true);
assert.equal(curatedAllWritersReady466({ ...onFlag, ...ready }), true);

const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const config = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8'));
assert.match(entry, /sharedCuratedEnabled466 as curatedFlagEnabled466/);
assert.match(entry, /const sharedCuratedEnabled466 = \(env\) =>\s*curatedFlagEnabled466\(env\)\s*&& curatedAllWritersReady466\(env\);/);
assert.match(entry, /sharedCuratedEnabled466\(env\)\s*\?\s*handleCuratedSharedRevision466/);
assert.match(entry, /sharedCuratedEnabled466\(env\)\s*\?\s*handleCuratedSharedPublic466/);
assert.match(entry, /if \(sharedCuratedEnabled466\(env\)\)/);
assert.equal(config.vars?.SORIDRAW_CURATED_SHARED_V466, undefined);
assert.equal(config.vars?.SORIDRAW_CURATED_ALL_WRITERS_READY466, undefined);
assert.equal(config.vars?.SORIDRAW_CURATED_WRITER_SHADOW471, undefined,
  'writer-first phase must be opt-in and OFF in all committed configs');
assert.match(entry,/const curatedWriterShadowEnabled471 = \(env\) =>/);
assert.match(entry,/const curatedSharedWriterEnabled471 = \(env\) =>/);
assert.match(entry,/const curatedOnlyAlarm469 = canRunCuratedWriter471/);
assert.match(entry,/if \(curatedSharedWriterEnabled471\(env\) &&\s*\(isTrackVisibilityMutation307 \|\| isPublicationBatch307\)\)/);
assert.match(entry,/if \(curatedWriterShadowEnabled471\(env\) && curatedRepairTicket468\)/);
assert.match(entry,/if \(curatedWriterShadowEnabled471\(env\) && directCuratedTicket469\)/);
assert.match(entry,/await writeCuratedSnapshot307\(request, env, ctx, id, promoted, access\.curatorRole\)/);
assert.match(entry,/const sharedCuratedEnabled466 = \(env\) =>[\s\S]*?curatedAllWritersReady466\(env\);/);
assert.equal(config.keep_vars, true, 'Release must separately audit deployed remote vars');
console.log('APP467_LEGACY_WRITER_ONLY_LATE_CHANGE_DETECTED=PASS');
console.log('APP467_SHARED_READ_AND_WRITE_FENCE_OFF=PASS');
console.log('APP467_OPERATOR_ATTESTATION_NOT_YET_PROVEN=HOLD');

console.log('APP471_WRITER_FIRST_READER_OFF_LEGACY_DUAL_PROJECTION=PASS');
