import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 registerPublicLikeEventStorage416,
 PUBLIC_LIKE_WINDOW_KEY_416,
} from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';

const base=1_700_060_000_000;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const map=new Map(),writes=[];
const storage={
 async get(key){return map.get(key);},
 async put(entries,value){
   if(typeof entries==='string'){map.set(entries,value);writes.push([entries]);return;}
   const keys=Object.keys(entries);for(const k of keys)map.set(k,structuredClone(entries[k]));
   writes.push(keys.sort());
 },
};
const first={eventId:id(1),windowCandidateId:id(101),eventAtMs:base,
 publicMinutes:5,trackIds:['song-a','song-b']};
const a=await registerPublicLikeEventStorage416(storage,first,base);
assert.equal(a.registered,true);assert.equal(a.opened,true);assert.equal(a.duplicate,false);
assert.equal(a.deadlineAtMs,base+300_000);assert.equal(writes.length,1);
assert.equal(map.get(PUBLIC_LIKE_WINDOW_KEY_416).publicMinutes,5);

const retry=await registerPublicLikeEventStorage416(storage,{...first,publicMinutes:1},base+1000);
assert.equal(retry.duplicate,true,'same event retry ignores later setting drift');
assert.equal(writes.length,1,'duplicate registration W0');

const late={eventId:id(2),windowCandidateId:id(102),eventAtMs:base+299_000,
 publicMinutes:1,trackIds:['song-a','song-c']};
const b=await registerPublicLikeEventStorage416(storage,late,base+299_000);
assert.equal(b.opened,false);assert.equal(b.deadlineAtMs,base+300_000);
assert.equal(map.get(PUBLIC_LIKE_WINDOW_KEY_416).publicMinutes,5);
assert.equal(map.get('stage416/public/window/'+id(101)+'/track/song-a').eventAtMs,base+299_000);

const overdue={eventId:id(3),windowCandidateId:id(103),eventAtMs:base+300_001,
 publicMinutes:1,trackIds:['song-d']};
const beforeDueWrites=writes.length;
const due=await registerPublicLikeEventStorage416(storage,overdue,base+300_001);
assert.equal(due.registered,false);assert.equal(due.needsRelease,true);
assert.equal(writes.length,beforeDueWrites,'due unreleased window refuses overwrite W0');

// Simulate later release clearing only current window; next setting opens fresh.
map.delete(PUBLIC_LIKE_WINDOW_KEY_416);
const c=await registerPublicLikeEventStorage416(storage,overdue,base+300_001);
assert.equal(c.opened,true);assert.equal(c.publicMinutes,1);
assert.equal(c.deadlineAtMs,base+360_001);

await assert.rejects(registerPublicLikeEventStorage416(storage,{
 ...overdue,eventId:id(4),trackIds:['x'.repeat(513)],
},base+300_001),/416_PUBLIC_BAD_TRACK/);

const fn=readFileSync('functions/src/exploreLikePublicWindowRegister416.ts','utf8');
assert.match(fn,/X-Soridraw-416-Public-Signature/);
assert.match(fn,/createHmac\('sha256'/);
assert.match(fn,/public-like-window-416/);

const endpoint=readFileSync('functions/src/exploreLikePrivateFinalEndpoint416.ts','utf8');
assert.match(endpoint,/STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);
assert.match(endpoint,/readLikeBatchTimingAt416\(database,config\.timingPath\)/);
assert.match(endpoint,/data\.changedTrackIds\.length/);

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(worker,/const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);
assert.match(worker,/url\.pathname===STAGE416_PUBLIC_WINDOW_ROUTE/);
assert.match(worker,/registerPublicLikeEventStorage416\(this\.ctx\.storage/);
assert.doesNotMatch(worker,/STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=true/);

const finalPublisher=readFileSync('functions/src/exploreLikePrivateFinal416.ts','utf8');
assert.match(finalPublisher,/!deferPublic416&&result\.snapshot\.val\(\)\?\.publicNotified416!==true/);
assert.match(finalPublisher,/changedTrackIds/);

console.log('STAGE416_PUBLIC_REGISTER_FIRST_EVENT_FIXED_WINDOW=PASS');
console.log('STAGE416_PUBLIC_REGISTER_DUPLICATE_W0_SETTING_DRIFT_SAFE=PASS');
console.log('STAGE416_PUBLIC_REGISTER_LATE_JOIN_NO_DEADLINE_EXTENSION=PASS');
console.log('STAGE416_PUBLIC_REGISTER_DUE_WINDOW_FAILS_CLOSED_W0=PASS');
console.log('STAGE416_PUBLIC_REGISTER_SIGNED_INTERNAL_ROUTE=PASS');
console.log('STAGE416_PUBLIC_REGISTER_HARD_OFF_CURRENT_RUNTIME=PASS');
console.log('STAGE416_IMMEDIATE_PUBLIC_PATH_PRESERVED_WHILE_FLAG_OFF=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
