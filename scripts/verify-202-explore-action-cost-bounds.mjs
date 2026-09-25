import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const actionService = readFileSync('src/services/exploreTrackActionService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const playlistService = readFileSync('src/services/playlistService.ts', 'utf8');

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

assert.match(actionService, /method: 'GET'/, 'Explore action helper must use read-only GET routes');
assert.match(actionService, /soridraw:explore:disliked:v1:/, 'dislike storage must stay account scoped');
const dislikeStart = actionService.indexOf('export const markExploreTrackDisliked');
assert.ok(dislikeStart >= 0, 'local dislike writer must exist');
const dislikeBody = actionService.slice(dislikeStart);
assert.match(dislikeBody, /window\.localStorage\.setItem/, 'dislike must persist locally');
assert.doesNotMatch(dislikeBody, /\bfetch\s*\(/, 'dislike must not add a server call');

assert.match(page, /let nextSong = track\.shareBundle\?\.nextSong/, 'next-song apply must use feed/share cache first');
assert.match(page, /if \(!nextSong \|\| Object\.keys\(nextSong\)\.length === 0\) \{\s*const source = await getExploreTrackApplySource/s,
  'server apply-source read must be fallback-only');
assert.match(page, /if \(user\.uid === track\.ownerUid\)[\s\S]*?else \{[\s\S]*?getExploreTrackSaveAccess/s,
  'owner folder save must avoid the follower permission read while other users are checked');

const insertStart = playlistService.indexOf('const resolvePlaylistInsertOrder');
const insertEnd = playlistService.indexOf('export const getPrimaryNormalPlaylist', insertStart);
assert.ok(insertStart >= 0 && insertEnd > insertStart, 'bounded playlist insert helper must exist');
const insertOrder = playlistService.slice(insertStart, insertEnd);
assert.match(insertOrder, /where\('sourceId', '==', sourceId\), limit\(8\)/,
  'playlist duplicate detection must stay bounded');
assert.match(insertOrder, /orderBy\('order', 'desc'\), limit\(1\)/,
  'playlist order lookup must stay one-row bounded');
assert.doesNotMatch(insertOrder, /getDocs\(itemsRef\)/,
  'playlist insert must never scan the whole destination folder');

console.log('APP202_EXPLORE_ACTION_WORKER_ROUTES=PASS');
console.log('APP202_EXPLORE_ACTION_READ_BOUNDS=PASS');
console.log('APP202_EXPLORE_DISLIKE_ZERO_SERVER_WRITE=PASS');
console.log('APP202_PLAYLIST_INSERT_BOUNDED=PASS');
