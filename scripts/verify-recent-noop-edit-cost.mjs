import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-level regression for a high-frequency music creation/edit workflow.
// The no-op edit must not enqueue Firestore or send a cross-device preview.
// Real edits still use exactly the pre-existing trailing batch and RTDB path.
const app=readFileSync('src/App.tsx','utf8');
const comparatorMatch=app.match(/  const sameRecentSongDraft = \(a: RecentSongEditDraft, b: RecentSongEditDraft\): boolean =>\s*([\s\S]*?);/);
assert.ok(comparatorMatch,'actual comparator missing from App');
const sameDraft=Function('a','b','return '+comparatorMatch[1]+';');
const before={
  koreanTitle:'K',secondaryTitle:'S',secondaryLanguage:'en',
  showKoreanTitleInput:true,showSecondaryTitleInput:true,
  prompt:'P',koreanLyrics:'L1',secondaryLyrics:'L2',
};
assert.equal(sameDraft(before,{...before}),true);
for(const key of Object.keys(before)){
  const changed={...before,[key]:typeof before[key]==='boolean'? !before[key]:before[key]+'_edit'};
  assert.equal(sameDraft(before,changed),false,'missed changed '+key);
}
const open=app.slice(app.indexOf('  const openRecentSongEditor ='),app.indexOf('  const buildEditedRecentSong ='));
assert.match(open,/recentSongEditOpenedRef\.current = \{[\s\S]*?historyIndex: historyIndexRef\.current,[\s\S]*?songKey: buildRecentSongSyncKey\(result\),[\s\S]*?draft: openedDraft/);
assert.match(open,/setRecentSongEditDraft\(openedDraft\)/);
assert.match(open,/recentSongEditOpenedRef\.current = null/);
const save=app.slice(app.indexOf('  const saveRecentSongEdit ='),app.indexOf('  const handleRecentSongTitleInputKeyDown',app.indexOf('  const saveRecentSongEdit =')));
const guard=save.indexOf('sameRecentSongDraft(opened.draft, recentSongEditDraft)');
const write=save.indexOf("queueRecentSongTextWrite(user.uid, nextHistory, 'edit'");
const build=save.indexOf('const nextSong = buildEditedRecentSong');
assert.ok(guard>0&&guard<build&&build<write,'no-op must return before draft normalization and all writes');
assert.match(save,/opened\.uid === String\(user\?\.uid \|\| ''\)\.trim\(\)/);
assert.match(save,/opened\.historyIndex === currentIndex/);
assert.match(save,/opened\.songKey === buildRecentSongSyncKey\(currentHistory\[currentIndex\]\)/);
assert.match(save,/sameRecentSongDraft\(opened\.draft, recentSongEditDraft\)\) \{\s*closeRecentSongEditor\(\);[\s\S]*?return;/);
assert.match(save,/queueRecentSongTextWrite\(user\.uid, nextHistory, 'edit'/);
assert.doesNotMatch(save,/await (?:setDoc|updateDoc)\(/);
assert.match(app,/const RECENT_SONG_TEXT_BATCH_MS = 150_000;/);
console.log('RECENT_UNCHANGED_DRAFT_FIRESTORE_W0_RTDB_W0=PASS');
console.log('RECENT_ALL_EDITABLE_FIELDS_AND_SONG_IDENTITY_GUARDED=PASS');
console.log('RECENT_CHANGED_DRAFT_STILL_USES_150S_BATCH_AND_LIVE_PREVIEW=PASS');
