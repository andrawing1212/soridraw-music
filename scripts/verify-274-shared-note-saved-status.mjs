import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const service = fs.readFileSync('src/services/exploreSharedNoteService.ts', 'utf8');
const css = fs.readFileSync('src/components/explore/exploreSocial.css', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '274');

assert.match(page, /getExploreSharedNoteSavedFolderLocal274/);
assert.match(page, /setSharedNoteSavedFolderId274\(savedFolder\?\.folderId \|\| null\)/);
assert.match(page, /const isSavedHere274 = sharedNoteSavedFolderId274 === folder\.id/);
assert.match(page, /disabled=\{moreActionBusy === 'sharedNote' \|\| isSavedHere274\}/);
assert.match(page, /저장됨/);
assert.match(page, /if \(sharedNoteSavedFolderId274 === folder\.id\)[\s\S]*?return;/);

const helperStart = service.indexOf('export const getExploreSharedNoteSavedFolderLocal274');
const helperEnd = service.indexOf('\nexport const saveExploreTrackToSharedNote', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
const helper = service.slice(helperStart, helperEnd);
assert.match(helper, /favoritesStore\.getFavorites\(\)/);
assert.match(helper, /localStorage\.getItem/);
assert.doesNotMatch(helper, /getDoc\(/);
assert.doesNotMatch(helper, /fetch\(/);
assert.doesNotMatch(helper, /readCatalog|loadCatalog|D1|Firestore/);

assert.match(css, /soridraw-explore-more-folder-saved/);
assert.match(css, /button\.is-saved:disabled/);

console.log('APP274_SHARED_NOTE_SAVED_STATUS_LOCAL_ONLY=PASS');
console.log('APP274_SHARED_NOTE_SAME_FOLDER_NO_WRITE=PASS');
console.log('APP274_SHARED_NOTE_STATUS_EXTRA_SERVER_READ=0');
