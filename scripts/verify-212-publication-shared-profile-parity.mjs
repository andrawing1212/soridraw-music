import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

const functionText = (name) => {
  const start = worker.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  const brace = worker.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < worker.length; i += 1) {
    const c = worker[i], n = worker[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return worker.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}`);
};

assert.match(worker, /SORIDRAW_PUBLICATION_SHARED_PROFILE_PARITY_091_20260927/);
assert.ok(manifest.patches.includes('091-publication-shared-profile-parity.mjs'));

const shared = functionText('patchExploreSharedProfilePublication091');
assert.match(shared, /env\?\.PROFILE_MEDIA/);
assert.match(shared, /exploreSharedProfileR2Key060/);
assert.match(shared, /onlyIf: \{ etagMatches: object\.etag \}/);
assert.match(shared, /sortProfileTracks019/);
assert.match(shared, /trackCountDelta/);
assert.doesNotMatch(shared, /env\.DB|\.prepare\(|SELECT |buildExploreFeedR2Payload|materializePublicProfileFirstView/);

const publicationProfile = functionText('patchExploreProfileR2Publication043');
assert.match(publicationProfile, /readCanonicalPublicationLike071/);
assert.match(publicationProfile, /patchExploreSharedProfilePublication091\(env, uid, args\[2\]\)/);

const batch = functionText('handleMusicNotePublicationBatch048');
assert.match(batch, /patchExploreProfileR2Publication043\(env, authContext\.uid/);

console.log('PASS 212: publication batch/single profile deltas reach shared profile R2 through bounded CAS, without owner-wide D1 reads or rebuilds.');
