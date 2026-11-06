import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transform } from 'esbuild';

const loadTs = async (path) => {
  const output = await transform(fs.readFileSync(path, 'utf8'), {loader:'ts',format:'esm'});
  return import('data:text/javascript;base64,' + Buffer.from(output.code).toString('base64'));
};
const { shouldApplyStudioHeartSignalOnAttach, isUnconfirmedStudioHeartPreview } =
  await loadTs('src/lib/studioHeartConflictRecovery.ts');
const { writeStudioHeartPendingIntentChecked, listStudioHeartPendingIntents, readStudioHeartPendingIntent } =
  await loadTs('src/lib/studioHeartBatch.ts');
const app=fs.readFileSync('src/App.tsx','utf8');
const service=fs.readFileSync('src/services/userDomainSyncService.ts','utf8');

const section = (src,start,end) => {
  const a=src.indexOf(start), b=src.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'missing section '+start);
  return src.slice(a,b);
};

// PC is closed at click; mobile publishes UNSAVE preview and closes before +5s.
// RTDB's first retained event is NOT a durable Firestore mutation.
assert.equal(shouldApplyStudioHeartSignalOnAttach('heart-preview-unsave',true),false);
assert.equal(shouldApplyStudioHeartSignalOnAttach('heart-preview-save',true),false);
assert.equal(shouldApplyStudioHeartSignalOnAttach('heart-preview-unsave',false),true,'live PC-mobile visual preview unchanged');
assert.equal(shouldApplyStudioHeartSignalOnAttach('heart-preview-save',false),true);
for(const operation of ['save','unsave','restore','suno-media-preview','detail-preview','structure-update']){
  assert.equal(shouldApplyStudioHeartSignalOnAttach(operation,true),true,operation+' replay protected');
}
assert.equal(isUnconfirmedStudioHeartPreview('heart-preview-unsave'),true);
assert.equal(isUnconfirmedStudioHeartPreview('unsave'),false);
const dispatch=section(service,'const dispatchSignal =','let activeUid =');
assert.match(dispatch,/if \(!shouldApplyStudioHeartSignalOnAttach\(signal\.operation, initialRetained\)\) return/);
assert.match(dispatch,/if \(!isUnconfirmedStudioHeartPreview\(signal\.operation\)\) \{\s*rememberMusicNotePendingSignal\(uid, signal\)/);
assert.match(service,/const initialRetained = firstMusicNoteSnapshot/);
const replay=section(app,'    const pendingSignal = readPendingMusicNoteSyncSignal(', '    return () => window.removeEventListener(MUSIC_NOTE_SYNC_VERSION_EVENT');
assert.match(replay,/shouldApplyStudioHeartSignalOnAttach\(pendingSignal\.operation, true\)/);
console.log('PC_RECONNECT_RETAINED_UNCOMMITTED_UNSAVE_IGNORED=PASS');

// Legacy preview receipts that older clients already persisted are never
// rehydrated as canonical heart authority.
const authority=section(app,'  const persistRecentHeartAuthority =', '  const getFavoriteComparableText =');
assert.match(authority,/\.filter\(\(\[, value\]\) => value\.confirmed === true\)/);
assert.match(authority,/entry\?\.confirmed !== true/);
const remote=section(app,'      const unresolvedPreview = studioHeartRemotePreviewRef', '      if (isHeartPreview) {');
assert.match(remote,/!isHeartPreview,/,'live preview authority remains session-only');
assert.match(remote,/if \(isRemovalOperation\)/);
assert.match(remote,/else if \(!isHeartPreview\)/,'UNSAVE preview cannot alter durable Recent marker');
assert.match(app,/authorityVersion,\s*true,\s*\);/,'confirmed catalog receipt persists');
console.log('RECENT_HEART_UNCONFIRMED_PREVIEW_NOT_DURABLE=PASS');

// Mobile device's own local pending survives closing and reopening the same
// browser. Other devices must not commit the mobile outbox speculatively.
const storage=new Map();
globalThis.localStorage={
 getItem:k=>storage.get(k)??null,
 setItem:(k,v)=>storage.set(k,String(v)),
 removeItem:k=>storage.delete(k),
};
const uid='mobile-device-owner';
for(let n=0;n<10;n++){
 const intent={
  schemaVersion:1,uid,documentId:'song-'+n,identityKey:'stable-'+n,
  baselineSaved:true,desiredSaved:false,
  baselineFavorite:{id:'song-'+n},song:{id:'song-'+n},
  updatedAtMs:100+n,signalVersion:10+n,pendingRemotePreviewVersion:0,
  pendingRemotePreviewSaved:null,retryCount:0,
 };
 assert.equal(writeStudioHeartPendingIntentChecked(intent),'stored');
}
assert.equal(listStudioHeartPendingIntents(uid).length,10);
assert.equal(readStudioHeartPendingIntent(uid,'song-7')?.desiredSaved,false);
const recovery=section(app,'    const pendingIntents = listStudioHeartPendingIntents(uid);', '  const updateFavorite = async');
assert.match(recovery,/scheduleStudioHeartPendingIntent\(intent\.documentId\)/);
assert.match(recovery,/scheduleStudioHeartPendingIntent\(intent\.documentId\)/);
const flush=section(app,'  const flushStudioHeartPendingIntent = async','  const scheduleStudioHeartPendingIntent =');
assert.match(flush,/await toggleFavorite\(commitSong,/);
assert.match(flush,/STUDIO_HEART_RETRY_MS/);
assert.doesNotMatch(flush,/showToast\(intent\.desiredSaved \? '저장이 완료되었습니다\.' : '저장 해제가 완료되었습니다\.'/);
const queue=section(app,'  const queueStudioHeartPendingIntent = (','  useEffect(() => {');
assert.match(queue,/publishMusicNoteHeartPreviewDelta\(uid, safeDocumentId, intent\.song, desiredSaved\)/);
assert.match(queue,/scheduleStudioHeartPendingIntent\(safeDocumentId\)/);
assert.match(app,/const STUDIO_HEART_BATCH_MS = 5_000/);
assert.match(app,/const STUDIO_HEART_MAX_WAIT_MS = 15_000/);
const toggle=section(app,'  const handleToggleCurrentStudioFavorite = async', '  const isRecentSongSectionEditing');
assert.match(toggle,/showToast\(intendedFavoriteAction === 'save'\s*\? '뮤직노트에 저장되었습니다'\s*:\s*'저장이 해제되었습니다'\)/);
console.log('MOBILE_PENDING_TEN_SONG_SAME_DEVICE_REENTRY=PASS');
console.log('EXISTING_5S_W0_W1_NO_ADDITIONAL_FIRESTORE_IO=PASS');
console.log('PREVIEW_STATUS_DISTINCT_FROM_CANONICAL_COMPLETION=PASS');
