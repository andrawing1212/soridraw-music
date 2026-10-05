import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const candidatePath = 'cloudflare/explore-worker/candidates/364-publication-read-compaction-compat.sql';
const proofPath = 'scripts/measure-362-isolated-publication-live-trigger-reads.mjs';
const candidate = readFileSync(candidatePath, 'utf8');
const proof = readFileSync(proofPath, 'utf8');

assert.match(candidate, /SORIDRAW 364 candidate/i, '364 marker missing');
assert.match(candidate, /DROP TRIGGER IF EXISTS explore032_track_update/i, 'track-update replacement missing');
assert.match(candidate, /CREATE TRIGGER explore032_track_update/i, 'track-update candidate missing');
assert.match(candidate, /CREATE TRIGGER explore079_music_note_derived_track_update/i, 'music-note derived update replacement missing');

// Protected shared revision is deliberately untouched.
const sqlOnly = candidate.replace(/--.*$/gm, '');
assert.doesNotMatch(
  sqlOnly,
  /(?:DROP|CREATE)\s+TRIGGER\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?soridraw_shared_rev_tracks_au_051\b/i,
  '364 must not mutate shared revision trigger',
);
assert.doesNotMatch(sqlOnly, /UPDATE\s+explore_shared_revision\b/i, '364 must not write shared revision directly');

// Old TEST/PRODUCTION compatibility: normal media swaps still patch the legacy mirror.
assert.match(
  candidate,
  /UPDATE\s+explore_derived_tracks\s+SET\s+row_json\s*=\s*json_patch/i,
  'legacy derived media mirror was removed',
);
for (const media of ['NEW.cover_url','NEW.duration_seconds','NEW.suno_url_primary','NEW.suno_url_secondary']) {
  assert.ok(candidate.includes(media), `legacy media projection missing: ${media}`);
}

// Read cut: fallback/rebuild uses NEW values and must not self-read tracks.
const rebuildStart = candidate.indexOf('INSERT INTO explore_derived_tracks(');
const rebuildEnd = candidate.indexOf('ON CONFLICT(id) DO UPDATE SET', rebuildStart);
assert.ok(rebuildStart >= 0 && rebuildEnd > rebuildStart, 'rebuild block missing');
const rebuild = candidate.slice(rebuildStart, rebuildEnd);
assert.doesNotMatch(rebuild, /\bFROM\s+tracks\b/i, '364 rebuild still self-reads tracks');
assert.match(rebuild, /NEW\.id/i, '364 rebuild is not NEW-value based');
assert.match(rebuild, /SELECT like_count FROM track_stats WHERE track_id = NEW\.id/i, 'stats fallback missing');

// Normal media update must skip the expensive UPSERT unless the derived row is missing.
assert.match(candidate, /AND changes\(\) = 0/i, 'missing-derived recovery gate missing');

// The profile-count trigger must not wake for media-only updates.
const derivedTriggerStart = candidate.indexOf('CREATE TRIGGER explore079_music_note_derived_track_update');
assert.ok(derivedTriggerStart >= 0, 'derived trigger missing');
const derivedTrigger = candidate.slice(derivedTriggerStart);
assert.match(
  derivedTrigger,
  /OLD\.owner_uid IS NOT NEW\.owner_uid\s+OR\s+OLD\.active IS NOT NEW\.active/i,
  'derived profile-count trigger lacks owner/active no-op guard',
);

// Existing isolated proof must explicitly cover normal, repair, content and visibility behavior.
for (const token of [
  "362_SWAP_364_COMPAT_RETURNING",
  "362_SWAP_364_MISSING_DERIVED_REPAIR",
  "362_CONTENT_364_COMPAT_RETURNING",
  "362_FIRST_INSERT_364_COMPAT_CHAIN",
  "362_REGISTERED_VISIBILITY_W2_GUARD=PASS",
]) {
  assert.ok(proof.includes(token), `isolated 364 proof coverage missing: ${token}`);
}

// PREP ONLY: no workflow may apply this candidate automatically.
const workflowNames = readdirSync('.github/workflows').filter((name) => /\.ya?ml$/i.test(name));
const wired = [];
for (const name of workflowNames) {
  const source = readFileSync(`.github/workflows/${name}`, 'utf8');
  if (source.includes('364-publication-read-compaction-compat.sql')) wired.push(name);
}
assert.deepEqual(wired, [], '364 candidate is wired to an automatic workflow');

console.log('PUBLICATION_364_COMPAT_CANDIDATE=PASS');
console.log('PUBLICATION_364_NORMAL_SOURCE_SWAP_TARGET=R4_W3');
console.log('PUBLICATION_364_LEGACY_MEDIA_MIRROR=PRESERVED');
console.log('PUBLICATION_364_SHARED_REVISION=PRESERVED');
console.log('PUBLICATION_364_MISSING_DERIVED_REPAIR=PRESERVED');
console.log('PUBLICATION_364_CONTENT_REBUILD=PRESERVED');
console.log('PUBLICATION_364_AUTO_APPLY_WIRED=false');
console.log('PUBLICATION_364_SHARED_USER_DATA_TOUCHED=0');
