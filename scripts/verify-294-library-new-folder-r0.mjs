import fs from 'node:fs';
import assert from 'node:assert/strict';

const service = fs.readFileSync('src/services/playlistService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

const start = service.indexOf('export const createPlaylist = async');
const end = service.indexOf('export const renamePlaylist = async', start);
assert.ok(start >= 0 && end > start, 'createPlaylist block not found');

const block = service.slice(start, end);
assert.match(block, /writeLibraryPlaylistItemsCache\(uid, newDocRef\.id, \[\], syncVersion\)/);
assert.ok(!block.includes('getDocs('), 'playlist creation must not add a server read');
assert.ok(block.indexOf('await batch.commit()') < block.indexOf('writeLibraryPlaylistItemsCache(uid, newDocRef.id, [], syncVersion)'),
  'empty items cache must be seeded only after canonical create succeeds');
assert.ok(Number(version.version) >= 294, 'app294 R0 regression must remain enabled in later builds');

console.log('APP294_LIBRARY_NEW_FOLDER_EMPTY_CACHE_R0=PASS');
