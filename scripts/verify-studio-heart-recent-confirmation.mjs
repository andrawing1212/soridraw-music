import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/lib/studioHeartRecentConfirmation.ts','utf8');
const code = (await transform(source, { loader: 'ts', format: 'esm' })).code;
const { canProjectStudioHeartCanonicalToRecent, matchStudioHeartCanonicalRecentSongs } =
  await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

const match = (a,b) => a.recentSongSyncKey && a.recentSongSyncKey === b.recentSongSyncKey;
const recent=[
 { id:'recent-a', favoriteFirestoreId:'favorite-A', recentSongSyncKey:'same-generation' },
 { id:'recent-other', favoriteFirestoreId:'favorite-B', recentSongSyncKey:'same-generation' },
 { id:'recent-legacy', recentSongSyncKey:'legacy-77' },
 { id:'recent-unrelated', recentSongSyncKey:'other-generation' },
];
const canonical={ recentSongSyncKey:'legacy-77' };
assert.deepEqual(matchStudioHeartCanonicalRecentSongs(recent,'favorite-A',canonical,match).map(x=>x.id),
  ['recent-a','recent-legacy'],'exact link and verified identity only');
assert.deepEqual(matchStudioHeartCanonicalRecentSongs(recent,'favorite-A',null,match).map(x=>x.id),
  ['recent-a'],'canonical missing source cannot match arbitrary unlinked songs');
assert.deepEqual(matchStudioHeartCanonicalRecentSongs(recent,'',canonical,match),[]);
assert.equal(canProjectStudioHeartCanonicalToRecent('favorite-A',false,null,null),true);
assert.equal(canProjectStudioHeartCanonicalToRecent('favorite-A',false,{desiredSaved:true},null),false,
  'newer local pending save must not be repainted as an old unsave');
assert.equal(canProjectStudioHeartCanonicalToRecent('favorite-A',false,null,{desiredSaved:true}),false,
  'newer cross-device preview must win until confirmed');
assert.equal(canProjectStudioHeartCanonicalToRecent('favorite-A',false,{desiredSaved:false},null),true);
const app=readFileSync('src/App.tsx','utf8');
assert.match(app,/const confirmStudioHeartRecentFromCanonical = \(/);
assert.match(app,/rememberRecentHeartAuthority\(uid, recentSong, desiredSaved, documentId, confirmationVersion, true\)/);
assert.match(app,/confirmStudioHeartRecentFromCanonical\(uid, safeDocumentId, intent\.desiredSaved, intent\.song \|\| serverFavorite\)/);
assert.match(app,/confirmStudioHeartRecentFromCanonical\(uid, documentId, desiredSaved, settledRecentSource\)/);
assert.match(app,/if \(settled\) \{\s*\/\/ The receipt is now canonical\.[\s\S]{0,1900}confirmStudioHeartRecentFromCanonical/,
  'recent heart authority is updated only after the exact receipt settles canonically');
console.log('STUDIO_HEART_EXACT_RECENT_LINK_ONLY=PASS');
console.log('STUDIO_HEART_NEWER_LOCAL_REMOTE_PREVIEW_PROTECTED=PASS');
console.log('STUDIO_HEART_CROSS_DEVICE_HANDOFF_CANONICAL_RECENT_AUTHORITY=PASS');
