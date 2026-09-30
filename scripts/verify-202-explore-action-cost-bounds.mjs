import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const actionService = readFileSync('src/services/exploreTrackActionService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const sharedNoteService = readFileSync('src/services/exploreSharedNoteService.ts', 'utf8');

function functionRange(source, name) {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} body did not terminate`);
}

assert.match(worker, /segments\[3\] === "apply-source"[\s\S]{0,400}handleTrackApplySource/,
  'deployed canonical Worker source must route apply-source');
assert.match(worker, /segments\[3\] === "save-access"[\s\S]{0,400}handleFollowerSaveAccess/,
  'deployed canonical Worker source must route save-access');

const apply = functionRange(worker, 'handleTrackApplySource');
assert.match(apply, /WHERE id = \? AND is_public = 1 AND status = 'published'/,
  'apply-source must target one public track');
assert.match(apply, /LIMIT 1/, 'apply-source track lookup must stay bounded');
assert.match(apply, /allow_next_song_apply/, 'apply-source must enforce owner permission');
assert.match(apply, /readPublicShareBundle015\(row\)/, 'apply-source must reuse the bounded public share bundle');
assert.ok((apply.match(/env\.DB\.prepare/g) || []).length <= 2,
  'apply-source must use at most one track lookup plus one bounded legacy tag fallback');
assert.doesNotMatch(apply, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i,
  'apply-source must remain read-only');

const save = functionRange(worker, 'handleFollowerSaveAccess');
assert.match(save, /WHERE id = \? AND is_public = 1 AND status = 'published'/,
  'save-access must target one public track');
assert.match(save, /WHERE follower_uid = \? AND following_uid = \?/,
  'save-access must check only the requesting follower relationship');
assert.ok((save.match(/LIMIT 1/g) || []).length >= 2,
  'save-access track and follow lookups must both stay bounded');
assert.equal((save.match(/env\.DB\.prepare/g) || []).length, 2,
  'save-access must stay at exactly two bounded D1 lookups');
assert.doesNotMatch(save, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i,
  'save-access must remain read-only');
assert.match(save, /SORIDRAW_FOLLOWER_SAVE_LINK_SHARE_PARITY_269_20261001/,
  'save-access must preserve the app269 follower-save/link-share parity contract');
assert.match(save, /duration_seconds[\s\S]*?lyrics[\s\S]*?style[\s\S]*?prompt[\s\S]*?share_schema_version[\s\S]*?share_payload_json/,
  'the existing bounded track lookup must return the reusable Music Note detail and keyword payload');
assert.match(save, /JSON\.parse\(String\(track\.share_payload_json \|\| ""\)\)[\s\S]*?selectedKeywords[\s\S]*?nextSong/,
  'authorized follower save must decode the already-stored public share bundle without another D1 read');
assert.match(save, /saveSource: allowed \?[\s\S]*?durationSeconds:[\s\S]*?lyrics:[\s\S]*?style:[\s\S]*?prompt:[\s\S]*?shareBundle: saveShareBundle/,
  'authorized saveSource must carry detail plus next-song recipe to the client');

assert.match(actionService, /method: 'GET'/, 'Explore action helper must use read-only GET routes');
assert.match(actionService, /soridraw:explore:disliked:v1:/, 'dislike storage must stay account scoped');
const dislikeStart = actionService.indexOf('export const markExploreTrackDisliked');
assert.ok(dislikeStart >= 0, 'local dislike writer must exist');
const dislikeBody = actionService.slice(dislikeStart);
assert.match(dislikeBody, /window\.localStorage\.setItem/, 'dislike must persist locally');
assert.doesNotMatch(dislikeBody, /\bfetch\s*\(/, 'dislike must not add a server call');

const feedNextSongIndex = page.indexOf('track.shareBundle?.nextSong');
const localLegacyFallbackIndex = page.indexOf('buildExploreLegacyApplyKeywords({');
const workerApplyFallbackIndex = page.indexOf('const source = await getExploreTrackApplySource(user, track.id)');
assert.ok(feedNextSongIndex >= 0, 'next-song apply must inspect the feed/share cache first');
assert.ok(localLegacyFallbackIndex > feedNextSongIndex,
  'legacy public keyword fallback must run only after checking the feed/share nextSong cache');
assert.ok(workerApplyFallbackIndex > localLegacyFallbackIndex,
  'server apply-source read must remain after both cache and local public-keyword fallbacks');
assert.match(page, /if \(user\.uid !== track\.ownerUid\)[\s\S]*?getExploreTrackSaveAccess/s,
  'owner shared-note save must avoid the follower permission read while other users are checked');
assert.match(page, /const saveSource = access\.saveSource;[\s\S]*?setMoreTrack\(\(current\)[\s\S]*?lyrics: saveSource\.lyrics[\s\S]*?prompt: saveSource\.prompt[\s\S]*?shareBundle: saveSource\.shareBundle/,
  'authorized follower save must retain the server-provided full save snapshot through folder selection');
assert.doesNotMatch(page, /addPlaylistItem|getPlaylistsByType|ensureDefaultPlaylists/,
  'Explore must not re-enter the experimental Library path');

assert.match(sharedNoteService, /readCachedStructure\(uid\)/, 'shared-note folder lookup must use the existing Music Note local structure cache first');
assert.match(sharedNoteService, /getDoc\(doc\(db, 'user_structures', uid\)\)/,
  'shared-note folder cache miss must use one bounded structure document read');
assert.doesNotMatch(sharedNoteService, /getDocs\(|collectionGroup\(/,
  'shared-note action must never scan a Firestore collection');
assert.match(sharedNoteService, /setDoc\(doc\(db, 'favorites', documentId\), payload, \{ merge: true \}\)/,
  'shared-note save must write one deterministic Music Note document');
assert.match(sharedNoteService, /operation: 'shared-note-save'/,
  'shared-note save must stay inside the existing Music Note mutation boundary');
assert.match(sharedNoteService, /documentIds: \[documentId\]/,
  'shared-note mutation must identify only the changed document');
assert.match(sharedNoteService, /appliedKeywords: \{[\s\S]*?genre: \[\][\s\S]*?instrumentSound: \[\][\s\S]*?\.\.\.\(nextSong as Record<string, unknown>\)/,
  'follower-save copy must persist the same reusable next-song keyword recipe as a Music Note shared copy');
assert.match(sharedNoteService, /lyrics,[\s\S]*?prompt: track\.prompt \|\| ''[\s\S]*?userInput: String\(\(nextSong as any\)\.userInput \|\| ''\)/,
  'follower-save copy must persist lyrics, prompt, and command input for read-only detail/apply parity');

console.log('APP202_EXPLORE_ACTION_WORKER_ROUTES=PASS');
console.log('APP202_EXPLORE_ACTION_READ_BOUNDS=PASS');
console.log('APP202_EXPLORE_DISLIKE_ZERO_SERVER_WRITE=PASS');
console.log('APP202_SHARED_NOTE_CACHE_FIRST=PASS');
console.log('APP202_SHARED_NOTE_SINGLE_DOCUMENT_WRITE=PASS');
console.log('APP269_FOLLOWER_SAVE_LINK_SHARE_PARITY=PASS');
console.log('APP202_LIBRARY_PATH_UNUSED=PASS');
