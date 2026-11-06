import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const compiled=await transform(readFileSync('src/lib/studioHeartHandoffPayload.ts','utf8'),{loader:'ts',format:'esm'});
const { buildStudioHeartHandoffSongJson } = await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const song={
  title:'Custom Korean title',koreanTitle:'한국어 제목',englishTitle:'English Title',
  lyrics:{korean:'완전한 가사',english:'Complete lyrics'},
  prompt:'full music prompt',
  appliedKeywords:{lyricsByLanguage:{korean:'완전한 가사',english:'Complete lyrics'},userInput:'original user input'},
  situationSummary:'scene context',userInput:'original user input',
  favoriteFirestoreId:'song-id',musicNoteFavoriteId:'song-id',
  soridrawSongId:'soridraw-test',recentSongSyncKey:'song-key',
  audioUrl:'https://example.invalid/audio.mp3',
  sunoShareUrl:'https://example.invalid/share',
  sourceType:'suno_track',sourceTrackId:'owned-track',sourceTaskId:'task-proof',ownerUid:'test-owner',
  unrelatedUiDebugTrace:'z'.repeat(30000),
};
const json=buildStudioHeartHandoffSongJson(song);
assert.ok(json.length<=24000,'existing RTDB Rules unchanged');
const parsed=JSON.parse(json);
for(const field of ['title','lyrics','prompt','appliedKeywords','userInput','situationSummary',
  'soridrawSongId','favoriteFirestoreId','recentSongSyncKey','audioUrl','sunoShareUrl',
  'sourceType','sourceTrackId','sourceTaskId','ownerUid'])
  assert.deepEqual(parsed[field],song[field],'canonical field preserved: '+field);
assert.equal(parsed.unrelatedUiDebugTrace,undefined,'oversized UI diagnostics are not sent');
const normal={title:'unchanged',lyrics:{korean:'k',english:'e'},prompt:'p',appliedKeywords:{},someLegacyField:42};
assert.equal(buildStudioHeartHandoffSongJson(normal),JSON.stringify(normal),
  'existing normal JSON payload remains bit-for-bit compatible');
assert.throws(()=>buildStudioHeartHandoffSongJson({...song,prompt:'x'.repeat(40000)}),
  /STUDIO_HEART_HANDOFF_SONG_TOO_LARGE/,'never truncate real user content');
const app=readFileSync('src/App.tsx','utf8');
assert.match(app,/if \(!receipt\) \{[\s\S]{0,320}showToast\('기기 간 저장 인계를 확인하지 못했습니다/);
console.log('STUDIO_HEART_FAST_CLOSE_CANONICAL_RECEIPT_COMPACT_COMPAT=PASS');
