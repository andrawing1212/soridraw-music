import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

const functionText = (name) => {
  const needles = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const needle of needles) { start = worker.indexOf(needle); if (start >= 0) break; }
  assert.ok(start >= 0, 'missing function ' + name);
  const brace = worker.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < worker.length; i += 1) {
    const c = worker[i], n = worker[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return worker.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
};

const p068 = manifest.patches.indexOf('068-w2-profile-search-projection.mjs');
const p069 = manifest.patches.indexOf('069-w2-profile-pagination.mjs');
assert.equal(p069, p068 + 1, '069 must layer directly after 068');

for (const required of [
  'SORIDRAW_W2_PROFILE_PAGINATION_069_20260919',
  'handleProfileTracksCore069',
  'readLegacyProfileCandidates069',
  'readW2ProfileCandidates069',
  'w2ProfileState069',
]) assert.ok(worker.includes(required), 'generated Worker missing ' + required);

const outer = functionText('handleProfileTracks');
assert.match(outer, /readExploreSharedProfile060/);
assert.match(outer, /validExploreProfileR2Bundle020/);
assert.match(outer, /shared\.body\.data\.items/);
assert.match(outer, /readLegacyProfileCandidates069/);
assert.match(outer, /readW2ProfileCandidates069/);
assert.match(outer, /nextW2ProfileState069/);

const legacy = functionText('readLegacyProfileCandidates069');
assert.match(legacy, /INDEXED BY idx_tracks_owner_profile_order/);
assert.match(legacy, /t\.owner_uid=\?/);
assert.match(legacy, /publication_storage_version <> 1/);
assert.match(legacy, /ORDER BY t\.profile_pinned DESC,t\.published_at DESC,t\.id DESC/);
assert.doesNotMatch(legacy, /SELECT\s+\*\s+FROM\s+tracks/i);

for (const name of ['listW2ProfilePage069', 'readW2ProfileCandidates069', 'initializeW2ProfileState069']) {
  const block = functionText(name);
  assert.doesNotMatch(block, /env\.DB|\.prepare\(/, name + ' must remain R2-only');
}
const reader = functionText('readW2ProfileCandidates069');
assert.match(reader, /readSharedTrackCard062/);
assert.match(reader, /w2ProfileRankKey068/);

const bootstrap = functionText('bootstrapPublicationProfileR2068');
assert.match(bootstrap, /trackCount:\s*0/);
const profileMutation = functionText('patchExploreProfileR2Publication043');
assert.match(profileMutation, /trackCountDelta/);
assert.match(profileMutation, /trackCount/);

console.log('APP125_PUBLIC_PROFILE_FIRST_PAGE=SHARED_R2_FIRST');
console.log('APP125_PUBLIC_PROFILE_PAGE2=LEGACY_INDEXED_D1_PLUS_W2_R2');
console.log('APP125_PUBLIC_PROFILE_W2_READER_D1=0');
console.log('APP125_PUBLIC_PROFILE_TRACK_COUNT=R2_DELTA');
console.log('APP125_SHARED_D1_EXECUTION=NOT_RUN');
