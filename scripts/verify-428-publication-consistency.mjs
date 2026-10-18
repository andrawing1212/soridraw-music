import assert from 'node:assert/strict';
import fs from 'node:fs';

const publication = fs.readFileSync('src/services/explorePublicationService.ts', 'utf8');
const favorites = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const title = fs.readFileSync('src/lib/exploreTitleDisplay.ts', 'utf8');

function functionRange(source, name) {
  const needles = [`export const ${name} =`, `const ${name} =`, `function ${name}(`, `async function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (comment === 'line') { if (ch === '\n') comment = ''; continue; }
    if (comment === 'block') { if (ch === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; continue; }
    if (ch === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (ch === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} did not terminate`);
}

const overlay = functionRange(publication, 'overlayPendingPublicationStates');
assert.match(overlay, /pending\.baseState/);
assert.doesNotMatch(overlay, /next\[pending\.sourceId\] = \{ \.\.\.pending\.desiredState \}/,
  'pending desired state must not be painted as confirmed');

const queue = functionRange(publication, 'queuePublicationMutation');
assert.match(queue, /persistPublicationOutbox/);
assert.match(queue, /return \{ \.\.\.baseState \}/);
assert.doesNotMatch(queue, /patchPublicationStateBySourceId/,
  'queueing retry intent must not mutate confirmed publication cache');

const flush = functionRange(publication, 'flushPendingExplorePublicationsForPageExit');
assert.match(flush, /states\[pending\.sourceId\] = \{ \.\.\.pending\.baseState \}/,
  'failed row must restore confirmed base');
assert.match(flush, /states\[pending\.sourceId\] = \{ \.\.\.confirmed \}/,
  'successful row must persist only confirmed server state');
assert.match(flush, /if \(confirmed\.status === 'private'\)/);
assert.doesNotMatch(flush, /visibleState/,
  'pending desired state must not drive Feed/Profile cache mutation');

const refresh = functionRange(publication, 'refreshExploreMusicNotePublicationContent428');
assert.match(refresh, /\/v1\/publications/);
assert.match(refresh, /sourceType: 'music_note'/);
assert.match(refresh, /upsertExploreFeedSessionCacheRow/);
assert.match(refresh, /upsertExplorePublicProfileFirstViewTrack/);
for (const forbidden of ['getDocs(', 'collection(', 'collectionGroup(', 'writeBatch(']) {
  assert.ok(!refresh.includes(forbidden), `public metadata refresh must remain exact-item: ${forbidden}`);
}

const detailFlush = functionRange(favorites, 'flushFavoriteDetailPendingPatch');
assert.match(detailFlush, /await updateFavorite\(pending\.songId, pending\.updates\)[\s\S]*refreshExploreMusicNotePublicationContent428/,
  'public metadata refresh must happen only after canonical Music Note settlement');
assert.match(detailFlush, /publicationState\.status === 'public' && publicationState\.registered/);
assert.match(detailFlush, /Public Music Note metadata refresh deferred/,
  'derived Explore failure must not roll back canonical Music Note save');

assert.match(title, /stripExploreWrappingQuotes/);
assert.doesNotMatch(title, /updateDoc|setDoc|fetch\(/,
  'title normalization must remain display-only');

console.log('APP428_PUBLICATION_PENDING_CONFIRMED_SEPARATION=PASS');
console.log('APP428_PUBLICATION_FAILED_ROW_BASE_STATE=PASS');
console.log('APP428_PUBLIC_METADATA_EXACT_TRACK_REFRESH=PASS');
console.log('APP428_MUSIC_NOTE_CANONICAL_SAVE_FIRST=PASS');
console.log('APP428_TITLE_DISPLAY_ONLY=PASS');
