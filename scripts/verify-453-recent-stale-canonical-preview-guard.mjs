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
