import fs from 'node:fs';

const client = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const worker = fs.readFileSync('cloudflare/media-worker/src/index.js', 'utf8');
const favorites = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));
const required = [
  'noteFolderId', 'myNoteFolderId', 'favoriteFolderId',
  'sharedNoteFolderId', 'sharedNoteFolder', 'noteSharedFolderId',
  'sharedNoteShareId', 'isSharedMusicNote', 'sharedReadOnly', 'sourceType', 'originalFavoriteId',
];
const clientBlock = client.slice(client.indexOf('const MUSIC_NOTE_SUMMARY_KEYS'), client.indexOf('const LIBRARY_SUMMARY_KEYS'));
const workerBlock = worker.slice(worker.indexOf('const MUSIC_NOTE_CATALOG_FIELDS'), worker.indexOf('const LIBRARY_CATALOG_FIELDS'));
for (const key of required) {
  if (!clientBlock.includes(`'${key}'`)) throw new Error(`client missing ${key}`);
  if (!workerBlock.includes(`'${key}'`)) throw new Error(`worker missing ${key}`);
}
const filterSignals = [
  'song.noteFolderId || song.myNoteFolderId || song.favoriteFolderId || song.folderId',
  'song.sharedNoteFolderId || song.sharedNoteFolder || song.noteSharedFolderId',
  'song?.sharedReadOnly',
  'song?.isSharedMusicNote',
  "song?.sourceType === 'shared_music_note'",
  'song?.sharedNoteShareId',
];
for (const signal of filterSignals) if (!favorites.includes(signal)) throw new Error(`FavoritesPage filter contract changed: ${signal}`);
if (!client.includes('MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 = 6')) throw new Error('Music Note local cache generation not isolated');
if (!client.includes("kind === 'musicNote' ? MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 : CATALOG_LOCAL_CACHE_GENERATION")) throw new Error('per-kind local generation missing');
if (!worker.includes("MUSIC_NOTE_CATALOG_STORAGE_GENERATION_050 = 'v5'")) throw new Error('Music Note R2 generation missing');
if (!worker.includes("kind === 'musicNote' ? MUSIC_NOTE_CATALOG_STORAGE_GENERATION_050 : 'v4'")) throw new Error('Library R2 generation must remain v4');
if (version.version !== '050') throw new Error('version must be 050');
console.log('VERIFY_050_MUSICNOTE_FOLDER_CATALOG_RECOVERY=PASS');
console.log('MY_NOTE_CLASSIFICATION_FIELDS=PASS');
console.log('SHARED_NOTE_CLASSIFICATION_FIELDS=PASS');
console.log('MUSICNOTE_ONLY_LOCAL_CACHE_INVALIDATION=PASS');
console.log('MUSICNOTE_ONLY_R2_REBUILD_NAMESPACE=PASS');
console.log('LIBRARY_CATALOG_UNCHANGED=PASS');
console.log('FAVORITES_PAGE_FILTER_LOGIC_UNCHANGED=PASS');
