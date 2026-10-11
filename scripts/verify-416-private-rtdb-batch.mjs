import assert from 'node:assert/strict';
import {
  applyPrivateRtdbClick416 as click,
  sealPrivateRtdbWindow416 as seal,
  acknowledgePrivateRtdbSeal416 as ack,
  hashTrackIdForRtdb416 as hash
} from '../src/services/exploreLikePrivateRtdbWindow416.mjs';
const deviceA='00000000-0000-4000-8000-000000000001';
const deviceB='00000000-0000-4000-8000-000000000002';
const op=i=>'11111111-1111-4111-8111-'+String(i).padStart(12,'0');
const now=1_000_000;
const add=async(state,dev,seq,track,liked,at,period=5)=>{
 const row={trackId:track,trackKey:await hash(track),liked,operationId:op(seq+(dev===deviceB?500:0)),
  deviceId:dev,deviceSequence:seq};
 return click(state,row,at,period);
};
let s=await add(null,deviceA,1,'song-a',true,now,5);
assert.equal(s.version,1);assert.equal(s.window.minutes,5);
s=await add(s,deviceB,1,'song-b',true,now+1_000,1);
assert.equal(s.version,2);assert.equal(s.window.minutes,5,'Master period locked to active window');
assert.equal(s.window.lastClickAtMs,now+1_000);
const beforeDuplicate=s;
const duplicate=await add(s,deviceB,1,'song-b',true,now+2_000);
assert.equal(duplicate,null,'already-seen device counter rejects any replay');
assert.equal(s,beforeDuplicate);
assert.equal(seal(s,now+300_000).reason,'NOT_DUE');
assert.equal(seal(s,now+301_000).committed,true);
const sealed=seal(s,now+301_000);
assert.equal(sealed.value.sealed.rows.length,2);
s=sealed.value;
assert.equal(s.window,null);
assert.equal(s.pending && Object.keys(s.pending).length,0);
assert.equal(await add(s,deviceA,1,'song-a',true,now+301_001),null,
  'settled old device operation replay cannot open a fresh window');
s=await add(s,deviceA,2,'song-a',false,now+301_002,3);
assert.equal(s.window.minutes,3,'changed Master period applies only to new window');
assert.equal(seal(s,now+500_000).reason,'PRIOR_SEAL_UNACKNOWLEDGED');
assert.equal(ack(s,op(999),2),null,'stale/wrong ACK cannot erase frozen or pending data');
const completed=ack(s,sealed.value.sealed.id,sealed.value.sealed.version);
assert(completed);
assert.equal(completed.sealed,undefined);
assert.equal(completed.pending[await hash('song-a')].liked,false);
let many=null;
for(let n=1;n<=80;n++)many=await add(many,deviceA,n,'song-'+n,true,now+n);
assert.equal(many.version,80);
assert.equal(Object.keys(many.pending).length,80,'no last-50 history loss');
const all=seal(many,now+300_300);
assert.equal(all.committed,true);
assert.equal(all.value.sealed.rows.length,80);
assert.deepEqual(all.value.sealed.rows.map(x=>x.trackId).slice(0,2),['song-1','song-10']);
assert.equal((await add(many,deviceA,2,'song-2',false,now+1)),null);
assert.equal(Object.keys(many.deviceSeq).length,1);
let capped=null;
for(let n=1;n<=256;n++)capped=await add(capped,deviceA,n,'limit-'+n,true,now+n);
await assert.rejects(add(capped,deviceA,257,'overflow',true,now+257),/416_RTDB_BATCH_FULL/);
assert.equal(Object.keys(capped.pending).length,256,'overflow must fail, NEVER silently truncate');
assert.equal(seal(capped,now+400_000).committed,true);
assert.notEqual(await hash('same'),await hash('different'));
console.log('STAGE416_RTDB_REUSE_NO_D1_PER_CLICK_80_AND_256_TRACKS=PASS');
console.log('STAGE416_RTDB_DEVICE_REPLAY_MASTER_SEAL_ACK=PASS');
console.log('STAGE416_RTDB_CANDIDATE_OFF_NO_DEPLOY=PASS');
