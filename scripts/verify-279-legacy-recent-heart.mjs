import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const store = fs.readFileSync('src/hooks/useFavoritesStore.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 279);

const keyStart = app.indexOf('  const getRecentSongGenerationSyncKey = (song: any): string => {');
const keyEnd = app.indexOf('  const getFavoriteComparableText', keyStart);
assert.ok(keyStart >= 0 && keyEnd > keyStart, 'recent generation identity block missing');
const keyBlock = app.slice(keyStart, keyEnd);

assert.match(keyBlock, /generationBatchId/);
assert.match(keyBlock, /generationIndex/);
assert.match(keyBlock, /return `generation:\$\{generationBatchId\}:\$\{generationIndex\}`/);

const generationPos = keyBlock.indexOf('const generationKey = getRecentSongGenerationSyncKey(song)');
const stablePos = keyBlock.indexOf('const stableSongId = getLiveSoridrawSongId(song)');
assert.ok(generationPos >= 0 && stablePos > generationPos, 'generation identity must outrank device-local soridrawSongId');

assert.match(app, /favoriteGenerationKey && songGenerationKey && favoriteGenerationKey === songGenerationKey/);
assert.match(app, /recentSongSyncKey: recentSongSyncKey \|\| buildRecentSongSyncKey\(song\) \|\| existingFav\.recentSongSyncKey/);
assert.match(app, /const deterministicRecentIdentity = recentSongSyncKey \|\| buildRecentSongSyncKey\(song\) \|\| favoriteSoridrawSongId \|\| ''/);
assert.match(app, /buildRecentFavoriteDocumentId\(user\.uid, deterministicRecentIdentity\)/);

assert.match(store, /const getRecentGenerationSyncKey/);
assert.match(store, /map\.set\(\`recent:\$\{generationKey\}\`, fav\)/);
assert.match(store, /generationKey && statusMap\.has\(\`recent:\$\{generationKey\}\`\)/);

const receiveStart = app.indexOf('// app277 — normal changed-item UI state rides the tiny RTDB signal.');
const receiveEnd = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', receiveStart);
assert.ok(receiveStart >= 0 && receiveEnd > receiveStart, 'zero-read receiver missing');
const receive = app.slice(receiveStart, receiveEnd);
assert.doesNotMatch(receive, /getDoc\(|getDocs\(|query\(|collection\(/);
assert.match(receive, /publishDerived: false/);

const toggleStart = app.indexOf('  const toggleFavorite = async (song: SongResult');
const updateStart = app.indexOf('  const updateFavorite = async', toggleStart);
assert.ok(toggleStart >= 0 && updateStart > toggleStart, 'favorite toggle block missing');
const toggle = app.slice(toggleStart, updateStart);
assert.doesNotMatch(toggle, /favoriteSyncSignalUpdatedAt|users\/\{uid\}/);
assert.match(toggle, /queueMusicNoteFavoriteCountDelta/);

console.log('APP279_LEGACY_RECENT_GENERATION_IDENTITY=PASS');
console.log('APP279_CROSS_DEVICE_DETERMINISTIC_FAVORITE_DOC=PASS');
console.log('APP279_REMOTE_RECEIVER_FIRESTORE_R0_W0=PASS');
console.log('APP279_NO_EXTRA_SYNC_CANONICAL_WRITE=PASS');
