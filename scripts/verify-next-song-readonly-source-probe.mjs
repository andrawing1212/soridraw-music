import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const original = readFileSync('src/lib/nextSongOriginalProbe.ts','utf8');
const { code } = await transform(original,{loader:'ts',format:'esm',target:'es2022'});
const mod = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const {summarizeOriginalInputPresence:inspect,findNextSongOriginalInRecent:match} = mod;
const fixture={
  appliedKeywords:{userInput:'',manualCommandCleared:true},
  requestPayload:{appliedKeywords:{lyricDraft:'MY SECRET ORIGINAL VERSE',isLyricMode:true},
    commandInput:'MY SECRET ORIGINAL COMMAND',customStyleInput:'MY CUSTOM STYLE'},
  prompt:'GENERATED FIVE LINE PROMPT',lyrics:'GENERATED FINAL LYRICS',
};
const report=inspect(fixture);
assert(report.present.includes('requestPayload.commandInput'));
assert(report.present.includes('requestPayload.appliedKeywords.lyricDraft'));
assert(report.present.includes('requestPayload.customStyleInput'));
assert(report.empty.includes('appliedKeywords.userInput'));
assert(report.empty.includes('appliedKeywords.manualCommandCleared'));
assert(!JSON.stringify(report).includes('MY SECRET'));
assert.deepEqual(inspect({prompt:'GENERATED',lyrics:'FINAL'}),{present:[],empty:[]});
const sel={uid:'owner-a',origin:'musicNote',stableSongId:'stable-a',taskId:'job-a'};
assert.equal(match({songs:[{soridrawSongId:'stable-a',requestPayload:{userInput:'hello'}}]},sel).status,'matched');
assert.equal(match({songs:[{taskId:'job-a'},{taskId:'job-a'}]},sel).status,'ambiguous');
assert.equal(match({songs:[{taskId:'job-a'}]},sel).status,'task-candidate');
assert.equal(match({songs:[]},sel).status,'not-matched');
assert.equal(match({songs:'invalid'},sel).status,'invalid');
const bridge=readFileSync('src/lib/nextSongPendingBridge.ts','utf8');
const note=readFileSync('src/pages/FavoritesPage.tsx','utf8');
const lib=readFileSync('src/pages/SunoLibraryPage.tsx','utf8');
const player=readFileSync('src/components/GlobalPlayer.tsx','utf8');
const overlay=readFileSync('src/components/CacheDiagnosticsOverlayImpl.tsx','utf8');
const panel=readFileSync('src/components/NextSongOriginalReadOnlyDiagnostic.tsx','utf8');
assert(!bridge.includes('stageNextSongOriginalProbeSelection'));
for(const [source,origin] of [[note,'musicNote'],[lib,'library'],[player,'player']]){
  assert(source.includes("origin: '"+origin+"'"));
}
assert(overlay.includes('<NextSongOriginalReadOnlyDiagnostic />'));
assert(panel.includes('getDocFromServer(doc(db, segments[0], ...segments.slice(1)))'));
assert(panel.includes('readNextSongOriginalProbeSelection(currentUid) === selected'));
assert(!panel.includes('setDoc(') && !panel.includes('updateDoc(') && !panel.includes('deleteDoc('));
assert(!panel.includes('getDocsFromServer(') && !panel.includes('getDocs('));
assert(!panel.includes('useEffect(() => { void inspect()'));
assert(panel.includes('readCount += 1'));
console.log('NEXT_SONG_EXPLICIT_LAST_CLICK_READ_ONLY_SOURCE_PROBE=PASS');
console.log('NEXT_SONG_DIAGNOSTIC_UID_SCOPE_R4_W0_NO_TEXT_EXPOSURE=PASS');
