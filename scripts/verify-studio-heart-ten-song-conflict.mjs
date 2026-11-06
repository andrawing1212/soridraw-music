import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transform } from 'esbuild';

const loadTs = async (path) => {
  const result = await transform(fs.readFileSync(path, 'utf8'), { loader:'ts', format:'esm' });
  return import('data:text/javascript;base64,' + Buffer.from(result.code).toString('base64'));
};
const { writeStudioHeartPendingIntentChecked, listStudioHeartPendingIntents, readStudioHeartPendingIntent } =
  await loadTs('src/lib/studioHeartBatch.ts');
const { canRetireStudioHeartPendingFromCanonical, isStudioHeartRemoteSuperseded,
  rebaseStudioHeartPendingAfterCommit, canStudioHeartReceiptTakeOverOlderLocal } =
  await loadTs('src/lib/studioHeartConflictRecovery.ts');
const store = new Map();
globalThis.localStorage = {
  getItem:(k)=>store.get(k) ?? null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:(k)=>store.delete(k),
};
const uid='fixture-uid';
const intent=(n)=>({
  schemaVersion:1,uid,documentId:'song-'+n,identityKey:'stable-'+n,
  baselineSaved:false,desiredSaved:true,baselineFavorite:null,
  song:{title:'song '+n},updatedAtMs:100+n,signalVersion:1000+n,
  pendingRemotePreviewVersion:0,pendingRemotePreviewSaved:null,retryCount:0,
});
for (let n=0;n<10;n++) assert.equal(writeStudioHeartPendingIntentChecked(intent(n)),'stored');
assert.equal(listStudioHeartPendingIntents(uid).length,10,'ten independent songs retained');
assert.equal(new Set(listStudioHeartPendingIntents(uid).map(x=>x.documentId)).size,10);
for (let n=0;n<10;n++) {
  const p=readStudioHeartPendingIntent(uid,'song-'+n);
  assert.ok(p && !isStudioHeartRemoteSuperseded(p));
  assert.equal(canRetireStudioHeartPendingFromCanonical(p,1200+n,true),true);
}
const before=intent(0);
const remoteUnsave={...before,pendingRemotePreviewVersion:1500,pendingRemotePreviewSaved:false};
assert.equal(isStudioHeartRemoteSuperseded(remoteUnsave),true);
assert.equal(canRetireStudioHeartPendingFromCanonical(remoteUnsave,1400,true),false,'old canonical cannot clear newer preview');
assert.equal(canRetireStudioHeartPendingFromCanonical(remoteUnsave,1600,true),false,'newer version but wrong action cannot clear');
assert.equal(canRetireStudioHeartPendingFromCanonical(remoteUnsave,1600,false),true,'matching new canonical settles');
assert.equal(canRetireStudioHeartPendingFromCanonical({...remoteUnsave,pendingRemotePreviewSaved:null},1600,false),false,'unknown direction remains pending after reload');
assert.equal(canRetireStudioHeartPendingFromCanonical({...remoteUnsave,pendingRemotePreviewSaved:null},1600,false,{version:1500,desiredSaved:false}),true,'same-session receipt works for legacy outbox');
assert.equal(canRetireStudioHeartPendingFromCanonical({...remoteUnsave,pendingRemotePreviewSaved:null},1600,false,{version:1499,desiredSaved:false}),false,'unrelated preview cannot settle');
const clickedAgain={...before,updatedAtMs:2000,desiredSaved:false};
const rebased=rebaseStudioHeartPendingAfterCommit(clickedAgain,before,{id:'song-0',saved:true});
assert.equal(rebased.baselineSaved,true,'in-flight first save is new canonical starting state');
assert.equal(rebased.desiredSaved,false,'newer unsave remains pending');
assert.notEqual(rebased.baselineSaved,rebased.desiredSaved,'unsave requires an actual canonical write, not W0');
assert.equal(rebased.updatedAtMs,2000,'new click is not replaced by older in-flight completion');
const oldAcked={...intent(1),documentId:'song-1',handoffSeq:100};
const newerRemote={documentId:'song-1',seq:101,originDeviceId:'device-A'};
assert.equal(canStudioHeartReceiptTakeOverOlderLocal(oldAcked,newerRemote,'device-B'),true,
  'B may settle a newer ACKed A receipt despite its own older outbox');
assert.equal(canStudioHeartReceiptTakeOverOlderLocal({...oldAcked,handoffSeq:0},newerRemote,'device-B'),false,
  'do not erase an unACKed fresh local click');
assert.equal(canStudioHeartReceiptTakeOverOlderLocal(oldAcked,{...newerRemote,seq:100},'device-B'),false,
  'equal/stale remote cannot retire outbox');
assert.equal(canStudioHeartReceiptTakeOverOlderLocal(oldAcked,{...newerRemote,documentId:'other'},'device-B'),false,
  'other song cannot retire outbox');
assert.equal(canStudioHeartReceiptTakeOverOlderLocal(oldAcked,newerRemote,'device-A'),false,
  'same-device outbox has its own settlement path');
console.log('STUDIO_HEART_REMOTE_NEWER_RECEIPT_OLDER_LOCAL_OUTBOX_FENCE=PASS');
const app=fs.readFileSync('src/App.tsx','utf8');
assert.match(app,/studioHeartCommitInFlightRef\.current\.has\(safeDocumentId\)/);
assert.match(app,/studioHeartCommitInFlightRef\.current\.add\(safeDocumentId\)/);
assert.match(app,/studioHeartCommitInFlightRef\.current\.delete\(safeDocumentId\)/);
assert.match(app,/studioHeartConflictRecheckOnceRef\.current\.has\(safeDocumentId\)/);
assert.match(app,/canRetireStudioHeartPendingFromCanonical\(pending, remoteVersion, remoteSaved, preview\)/);
assert.match(app,/rebaseStudioHeartPendingAfterCommit\(current, intent, confirmedFavorite\)/);
assert.match(app,/pendingRemotePreviewSaved: null/);
assert.match(app,/Math\.max\(Date\.now\(\), \(existing\?\.updatedAtMs \|\| 0\) \+ 1\)/);
assert.match(app,/if \(localPending && !takeoverOlderLocal\) return/);
assert.match(app,/if \(takeoverOlderLocal && studioHeartCommitInFlightRef\.current\.has\(documentId\)\)/);
assert.match(app,/if \(takeoverOlderLocal && canStudioHeartReceiptTakeOverOlderLocal\(/);
assert.match(app,/removeStudioHeartPendingIntent\(uid, documentId\)/);
assert.match(app,/if \(!closed && newest && \(newest\.seq !== version \|\| newest\.desiredSaved !== desiredSaved\)\) \{\s*receive\(newest\)/,
  'an in-flight older claim must not swallow a later opposite receipt');
assert.match(app,/if \(actualSaved === desiredSaved\) \{[\s\S]*?mergeFavoritePages\(\[serverFavorite\], withoutOlder\)/,
  'B must reflect already-settled canonical membership without a redundant Firestore write');
console.log('STUDIO_HEART_10_INDEPENDENT_OUTBOX=PASS');
console.log('STUDIO_HEART_REMOTE_PREVIEW_CANONICAL_ACK_GUARD=PASS');
console.log('STUDIO_HEART_SAME_SONG_INFLIGHT_REBASE=PASS');
console.log('STUDIO_HEART_BOUNDED_CONFLICT_RECHECK=PASS');
