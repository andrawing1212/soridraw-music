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

const displaySource = readFileSync('src/lib/studioHeartVisibleSaved.ts','utf8');
const displayCode = (await transform(displaySource, { loader: 'ts', format: 'esm' })).code;
const { resolveStudioHeartVisibleSaved } =
  await import('data:text/javascript;base64,'+Buffer.from(displayCode).toString('base64'));
const heart = (overrides = {}) => resolveStudioHeartVisibleSaved({
  catalogVerified: false, musicNoteMembership: false, recentHeartSaved: true, ...overrides,
});
// Reproduced update mismatch: an old confirmed saved heart survived while
// the verified same-UID Music Note list no longer contained that exact doc.
assert.equal(heart(), true, 'unverified/withheld Catalog never erases known Recent state');
assert.equal(heart({catalogVerified:true}), false,
  'a verified complete Music Note membership beats stale persisted saved=true');
assert.equal(heart({catalogVerified:true,acceptedServerSaved:true}), true,
  'latest server-accepted SAVE beats a stale verified Music Note list on B initial entry');
assert.equal(heart({catalogVerified:true,musicNoteMembership:true,acceptedServerSaved:false}), false,
  'latest server-accepted UNSAVE beats a stale Catalog SAVE on B initial entry');
assert.equal(heart({catalogVerified:true,musicNoteMembership:true,recentHeartSaved:false}), true,
  'verified saved Membership beats stale persisted saved=false');
assert.equal(heart({catalogVerified:true,pending:{
  desiredSaved:true,signalVersion:3,pendingRemotePreviewVersion:0,
}}), true, 'new local save outranks older canonical list');
assert.equal(heart({catalogVerified:true,musicNoteMembership:true,pending:{
  desiredSaved:false,signalVersion:3,pendingRemotePreviewVersion:0,
}}), false, 'new local unsave outranks older canonical list');
assert.equal(heart({catalogVerified:true,pending:{
  desiredSaved:true,signalVersion:3,pendingRemotePreviewVersion:4,
},preview:{desiredSaved:false,version:4}}), false,
  'explicitly newer remote preview outranks older local pending');
assert.equal(heart({catalogVerified:true,pending:{
  desiredSaved:true,signalVersion:3,pendingRemotePreviewVersion:0,
},preview:{desiredSaved:false,version:4}}), true,
  'newer local click reset must not be reversed by stale remote preview');
assert.equal(heart({catalogVerified:false,recentHeartSaved:null,legacyUnsaved:true}),false,
  'legacy recent unsaved marker survives until Catalog becomes verified');
const savedFn = app.slice(app.indexOf('  const isSongFavorited = useCallback('),
  app.indexOf('  const getFavoriteTitleFingerprint =', app.indexOf('  const isSongFavorited = useCallback(')));
assert.match(savedFn,/linkedFavoriteId\s*\?\s*statusMap\.has\(linkedFavoriteId\)/,
  'exact linked Music Note doc is the heart lookup');
assert.match(savedFn,/resolveStudioHeartVisibleSaved\(/);
assert.match(savedFn,/studioHeartAcceptedReceiptsRef\.current\.get\(/);
assert.match(savedFn,/acceptedServerSaved,/);
assert.match(app,/if \(canStudioHeartReceiptTakeOverOlderLocal\(\s*intent, accepted \|\| null, studioHeartHandoffDeviceId\(\),\s*\)\) continue;/);
console.log('STUDIO_HEART_SERVER_ACCEPTED_ORDER_WINS_WITHOUT_REPLACING_PENDING=PASS');
assert.match(savedFn,/gate\.catalogSourceVerified/);
assert.match(savedFn,/listStudioHeartPendingIntents\(uid\)/);
assert.doesNotMatch(savedFn,/\b(getDoc|getDocs|setDoc|updateDoc|fetch)\s*\(/);
assert.match(app,/gate\.catalogSourceVerified = isFullMusicNoteCatalog && \(/);
console.log('STUDIO_HEART_VERIFIED_MUSIC_NOTE_VISIBLE_MEMBERSHIP_AGREEMENT=PASS');
console.log('STUDIO_HEART_PENDING_AND_REMOTE_PREVIEW_PRIORITY_PRESERVED=PASS');
console.log('STUDIO_HEART_RESTART_NO_EXTRA_SERVER_IO=PASS');
console.log('STUDIO_HEART_EXACT_RECENT_LINK_ONLY=PASS');
console.log('STUDIO_HEART_NEWER_LOCAL_REMOTE_PREVIEW_PROTECTED=PASS');
console.log('STUDIO_HEART_CROSS_DEVICE_HANDOFF_CANONICAL_RECENT_AUTHORITY=PASS');
