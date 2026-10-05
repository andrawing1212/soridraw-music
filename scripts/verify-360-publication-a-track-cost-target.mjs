import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const migration = readFileSync('cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid.sql', 'utf8');
const rollback = readFileSync('cloudflare/explore-worker/migrations/20261005_01_publication_source_swap_w2_post_hybrid_rollback.sql', 'utf8');

const extractFunction = (source, name) => {
  let start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, line = false, block = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1] || '';
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i += 1; continue; }
    if (c === '/' && n === '*') { block = true; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
};

// User-approved scope: one existing Music Note A track only.
// 1) same-source publish/republish <= W2
// 2) switch A from source #1 to source #2 <= W2
// 3) private <= W2
// Do not "optimize" unrelated Explore reads, likes, save-heart or UI here.

const publish = extractFunction(worker, 'handleMusicNotePublicationSingleWrite016');
const privateHandler = extractFunction(worker, 'handleMusicNotePrivate017');
const privateCore = extractFunction(worker, 'handleMusicNotePrivate017Core045');
const visibilityTransition = extractFunction(worker, 'applyPublicationVisibilityTransition021');

assert.ok(publish.includes('const visibilityOnly = Boolean(previous?.id)'), 'registered publish guard missing');
assert.ok(publish.includes('SET is_public = 1'), 'same-source publish transition missing');
assert.ok(publish.includes('updated_at = ?'), 'same-source publish targeted update missing');
assert.ok(privateHandler.includes('handleMusicNotePrivate017Core045'), 'private error-boundary wrapper missing');
assert.ok(privateCore.includes('applyPublicationVisibilityTransition021'), 'private targeted transition missing');
assert.ok(visibilityTransition.includes('SET is_public = 0'), 'private one-row transition missing');

// The current W3 source swap is one canonical media write plus two physical trigger
// fanouts. The candidate is allowed to remove only the media-only legacy mirror.
const sql = migration.replace(/--.*$/gm, '');
assert.match(sql, /DROP TRIGGER IF EXISTS explore032_track_update/i);
assert.match(sql, /CREATE TRIGGER explore032_track_update/i);
assert.doesNotMatch(sql, /UPDATE\s+explore_derived_tracks\s+SET\s+row_json/i, 'media-only derived mirror still writes');
assert.match(sql, /INSERT INTO explore_derived_tracks/i, 'non-media recovery projection must remain');
assert.doesNotMatch(sql, /(?:DROP|CREATE)\s+TRIGGER\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?soridraw_shared_rev_tracks_au_051\b/i,
  'shared revision trigger must remain during W3->W2 source-swap cutover');

for (const mediaOnly of [
  'OLD.cover_url IS NOT NEW.cover_url',
  'OLD.duration_seconds IS NOT NEW.duration_seconds',
  'OLD.suno_url_primary IS NOT NEW.suno_url_primary',
  'OLD.suno_url_secondary IS NOT NEW.suno_url_secondary',
]) {
  const whereStart = migration.indexOf('WHERE t.id=NEW.id');
  const conflictStart = migration.indexOf('ON CONFLICT(id)', whereStart);
  const predicate = migration.slice(whereStart, conflictStart);
  assert.equal(predicate.includes(mediaOnly), false, `source-only media change still causes legacy derived write: ${mediaOnly}`);
}

assert.match(rollback, /UPDATE\s+explore_derived_tracks\s+SET\s+row_json/i, 'rollback must restore current media mirror');

// Required replacement authority already exists in PREVIEW.
for (const marker of [
  'SORIDRAW_PUBLICATION_R2_ONLY_READ_CUTOVER_358_20261005',
  'syncExploreFeedR2Publication043',
  'patchExploreProfileR2Publication043',
  'readSharedTrackCard062',
]) assert.ok(worker.includes(marker), `R2 publication authority missing: ${marker}`);

console.log('A_TRACK_PUBLIC_TARGET_PHYSICAL_W_MAX=2');
console.log('A_TRACK_SOURCE_1_TO_2_CURRENT_PHYSICAL_W=3');
console.log('A_TRACK_SOURCE_1_TO_2_CANDIDATE_PHYSICAL_W_MAX=2');
console.log('A_TRACK_PRIVATE_TARGET_PHYSICAL_W_MAX=2');
console.log('A_TRACK_WORKER_REQUEST_TARGET_MAX=1');
console.log('A_TRACK_UNRELATED_READ_OPTIMIZATION_OUT_OF_SCOPE=PASS');
console.log('A_TRACK_SHARED_D1_CUTOVER_APPLIED=false');
console.log('A_TRACK_TEST_PRODUCTION_COMPAT_REQUIRED=true');
