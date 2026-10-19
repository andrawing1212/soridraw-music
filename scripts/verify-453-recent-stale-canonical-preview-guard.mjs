import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real guard with two-device historical states, not a duplicate.
const code = fs.readFileSync('src/lib/recentSongCanonicalPreviewGuard453.ts','utf8');
const transpiled = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const sandbox={exports:{}};
vm.runInNewContext(transpiled,sandbox);
const protect=sandbox.exports.protectRecentCanonicalSnapshotFromPreview453;
assert.equal(typeof protect,'function');
const songId=(s)=>s.id;
const oldA={id:'A',title:'Old A',lyrics:{korean:'old lyrics'},appliedKeywords:{lyricsByLanguage:{ko:'old lyrics'}}};
const newestA={...oldA,title:'Edited A',lyrics:{korean:'new lyrics'},appliedKeywords:{lyricsByLanguage:{ko:'new lyrics'}},__recentSongEditPreview:true};
const changedB={id:'B',title:'New B',lyrics:{korean:'B'}};
const stale=protect([oldA,changedB],[newestA],songId);
assert.equal(stale.hasUnsettledPreview,true,'server old value not safe to settle');
assert.equal(stale.songs[0].title,'Edited A','unsettled PC title must not roll back on mobile');
assert.equal(stale.songs[0].lyrics.korean,'new lyrics','unsettled lyrics must not roll back');
assert.equal(stale.songs[1].title,'New B','unrelated changed B must still be recovered');

// Work audit counterexample: pending text MUST NOT copy stale nontext fields.
const authoritativeA = {
  ...oldA,
  favoriteFirestoreId: 'server-saved-doc',
  musicNoteFavoriteId: 'server-saved-doc',
  isPublic: true,
  isLocked: true,
  audioUrl: 'https://server.example/new-audio',
  sunoCoverUrl: 'https://server.example/current-art.png',
  appliedKeywords: {
    lyricsByLanguage: { ko: 'old lyrics' },
    generationBatchId: 'current-batch',
    preset: 'server-only-setting',
  },
};
const oldLocalDraft = {
  ...newestA,
  favoriteFirestoreId: 'stale-local-doc',
  musicNoteFavoriteId: 'stale-local-doc',
  isPublic: false,
  isLocked: false,
  audioUrl: 'https://cache.example/outdated-audio',
  sunoCoverUrl: 'https://cache.example/outdated-art.png',
  appliedKeywords: { lyricsByLanguage: { ko: 'new lyrics' }, generationBatchId: 'old-batch' },
};
const protectedA=protect([authoritativeA, changedB],[oldLocalDraft],songId);
assert.equal(protectedA.hasUnsettledPreview, true);
assert.equal(protectedA.songs[0].title,'Edited A');
assert.equal(protectedA.songs[0].lyrics.korean,'new lyrics');
assert.equal(protectedA.songs[0].favoriteFirestoreId,'server-saved-doc');
assert.equal(protectedA.songs[0].musicNoteFavoriteId,'server-saved-doc');
assert.equal(protectedA.songs[0].isPublic,true);
assert.equal(protectedA.songs[0].isLocked,true);
assert.equal(protectedA.songs[0].audioUrl,'https://server.example/new-audio');
assert.equal(protectedA.songs[0].sunoCoverUrl,'https://server.example/current-art.png');
assert.equal(protectedA.songs[0].appliedKeywords.generationBatchId,'current-batch');
assert.equal(protectedA.songs[0].appliedKeywords.preset,'server-only-setting');
assert.equal(protectedA.songs[0].appliedKeywords.lyricsByLanguage.ko,'new lyrics');
assert.equal(protectedA.songs[1].title,'New B');
const newerServer = { ...authoritativeA, updatedAtMs: 2000, title:'Later canonical edit' };
const olderPreview = { ...oldLocalDraft, updatedAtMs: 1000 };
const winner = protect([newerServer],[olderPreview],songId);
assert.equal(winner.songs[0].title,'Later canonical edit');
assert.equal(winner.hasUnsettledPreview,false,'older pending preview cannot overwrite newer canonical');

const settled=protect([{...newestA,__recentSongEditPreview:undefined},changedB],[newestA],songId);
assert.equal(settled.hasUnsettledPreview,false,'exact canonical settle is recognized');
assert.equal(settled.songs[0].__recentSongEditPreview,undefined,'canonical row owns final value');
const onlyLocal=protect([changedB],[newestA],songId);
assert.equal(onlyLocal.hasUnsettledPreview,true);
assert.equal(onlyLocal.songs.length,2,'remote aggregate may not delete the only pending copy');
const ordinary=protect([oldA,changedB],[oldA],songId);
assert.equal(ordinary.hasUnsettledPreview,false,'warm healthy cache must remain unchanged');

const app=fs.readFileSync('src/App.tsx','utf8');
const sync=fs.readFileSync('src/services/userDomainSyncService.ts','utf8');
assert.match(app,/protectRecentCanonicalSnapshotFromPreview453\([\s\S]{0,180}currentCache\?\.history/);
assert.match(app,/history: visibleServerHistory453/);
assert.match(app,/applyRecentSongsState\(visibleServerHistory453/);
assert.match(app,/!protectedRecent453\.hasUnsettledPreview\) \{\s*acknowledgeRecentGeneratedSongs/);
assert.match(app,/cachedSuccessfully && readSignalVersion > 0 && !protectedRecent453\.hasUnsettledPreview/);
assert.match(app,/if \(isEditPreview\) \{[\s\S]{0,600}return;/);
assert.doesNotMatch(sync,/if \(initialRetained\) rememberRecentSongsPendingSignalVersion\(uid, signal.version\)/,
  'RTDB draft must never become canonical revision before Firestore batch');
console.log('APP453_REMOTE_UNSETTLED_TITLE_LYRICS_DO_NOT_ROLL_BACK=PASS');
console.log('APP453_OTHER_CANONICAL_SONGS_STILL_RECOVER=PASS');
console.log('APP453_SIGNAL_ACK_WAIT_UNTIL_CANONICAL_SETTLED=PASS');
console.log('APP453_DRAFT_PREVIEW_READ_ZERO=PASS');
