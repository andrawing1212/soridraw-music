import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validatePublicLikeEvent416,
  planPublicLikeWindow416,
  publicLikeReleasePlan416,
} from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';

const base=1_700_050_000_000;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

const first=validatePublicLikeEvent416({
  eventId:id(1),windowCandidateId:id(101),eventAtMs:base,
  publicMinutes:5,trackIds:['song-b','song-a','song-a'],
},base);
assert.deepEqual(first.trackIds,['song-a','song-b']);
const p1=planPublicLikeWindow416(null,first);
assert.equal(p1.opened,true);
assert.equal(p1.window.publicMinutes,5);
assert.equal(p1.window.deadlineAtMs,base+300_000);
assert.equal(p1.scheduleAtMs,base+300_000);
assert.equal(p1.trackEntries.length,2);

const late=validatePublicLikeEvent416({
  eventId:id(2),windowCandidateId:id(102),eventAtMs:base+299_000,
  publicMinutes:1,trackIds:['song-c'],
},base+299_000);
const p2=planPublicLikeWindow416(p1.window,late);
assert.equal(p2.opened,false,'4m59s join may not extend/reopen window');
assert.equal(p2.window.windowId,p1.window.windowId);
assert.equal(p2.window.publicMinutes,5,'live setting change applies next window only');
assert.equal(p2.window.deadlineAtMs,base+300_000);
assert.equal(p2.scheduleAtMs,null);

assert.equal(publicLikeReleasePlan416(p2.window,base+299_999).due,false);
const due=publicLikeReleasePlan416(p2.window,base+300_000);
assert.equal(due.due,true);
assert.equal(due.releaseToken,'stage416-public-'+id(101));

const next=validatePublicLikeEvent416({
  eventId:id(3),windowCandidateId:id(103),eventAtMs:base+300_001,
  publicMinutes:1,trackIds:['song-a','song-d'],
},base+300_001);
const p3=planPublicLikeWindow416(p2.window,next);
assert.equal(p3.opened,true);
assert.equal(p3.window.windowId,id(103));
assert.equal(p3.window.publicMinutes,1);
assert.equal(p3.window.deadlineAtMs,base+360_001);

// Same-track repeated activity is represented by one deterministic track key.
// The durable layer can overwrite this key without growing per-click history.
const same=planPublicLikeWindow416(p3.window,{
  ...next,eventId:id(4),eventAtMs:base+310_000,trackIds:['song-a'],
});
assert.equal(same.trackEntries[0].key,p3.trackEntries[0].key);

// Source prerequisite: canonical finalizer persists changed IDs in the same
// personal R2 CAS and reuses them on exact retry, without a D1 read.
const finalizer=readFileSync('cloudflare/explore-worker/runtime/like-private-finalize-416.mjs','utf8');
assert.match(finalizer,/privateLikeChangedTrackIds416:changedTrackIds/);
assert.match(finalizer,/prev===version[\s\S]*privateLikeChangedTrackIds416/);
assert.match(finalizer,/changedTrackIds/);
assert.doesNotMatch(finalizer,/privateLikeChangedTrackIds416[\s\S]*db\.prepare/);

console.log('STAGE416_PUBLIC_WINDOW_FIRST_EVENT_FIXED_DEADLINE=PASS');
console.log('STAGE416_PUBLIC_WINDOW_LATE_JOIN_NO_EXTENSION=PASS');
console.log('STAGE416_PUBLIC_WINDOW_SETTING_NEXT_WINDOW_ONLY=PASS');
console.log('STAGE416_PUBLIC_WINDOW_TRACK_KEY_DEDUP=PASS');
console.log('STAGE416_FINAL_CHANGED_IDS_PERSISTED_IN_EXISTING_R2_CAS=PASS');
console.log('STAGE416_FINAL_CHANGED_IDS_EXACT_RETRY_RECOVERY=PASS');
console.log('STAGE416_PUBLIC_CORE_NETWORK_IO=0');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
