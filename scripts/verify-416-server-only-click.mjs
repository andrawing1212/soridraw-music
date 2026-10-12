import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('functions/src/exploreLikePrivateServerClick416.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.CommonJS}}).outputText;
const exported={};const crypto=await import('node:crypto');
vm.runInNewContext(output,{module:{exports:exported},exports:exported,
  require:(id)=>id==='node:crypto'?crypto:(()=>{throw Error('unapproved import '+id)})(),
  Object,Array,Number,Date,Error},{timeout:2000});
const record=exported.recordUserPrivateClick416;
const deviceA='00000000-0000-4000-8000-000000000001';
const deviceB='00000000-0000-4000-8000-000000000002';
const op=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let writes=0,reads=0,state=null,usedPath='';
const db={ref:path=>({transaction:async fn=>{
  usedPath=path;reads++;
  const updated=fn(state);
  if(updated===undefined)return {committed:false,snapshot:{val:()=>state}};
  state=updated;writes++;
  return {committed:true,snapshot:{val:()=>state}};
}})};
const now=1_000_000;
const take=async(dev,seq,track,liked,at,master=5)=>record(db,'test-uid',{
 trackId:track,liked,operationId:op(dev===deviceB?seq+300:seq),
 deviceId:dev,deviceSequence:seq},master,at);
const a=await take(deviceA,1,'track-a',true,now);
assert.equal(a.accepted,true);
assert.equal(usedPath,'privateLikeBatch416/test-uid','Admin-only sibling, no userSync');
assert.equal(a.deadlineAtMs,now+300_000);
assert.equal((await take(deviceB,1,'track-b',true,now+1000,1)).accepted,true);
assert.equal(state.window.minutes,5,'active Master period immutable');
assert.equal((await take(deviceA,1,'track-a',true,now+2000)).reason,'STALE_OR_DUPLICATE');
assert.equal(writes,2,'duplicate must write zero');
const exactReplay=await take(deviceA,1,'track-a',true,now+2000);
assert.equal(exactReplay.accepted,true);
assert.equal(exactReplay.reason,'DUPLICATE_CONFIRMED');
assert.equal(writes,2,'exact replay W0');
const wrongReplay=await take(deviceA,1,'track-a',false,now+2000);
assert.equal(wrongReplay.accepted,false);
assert.equal(wrongReplay.reason,'STALE_OR_DUPLICATE');
assert.equal(writes,2);
const expire=await take(deviceA,2,'track-a',false,now+301_000,3);
assert.equal(expire.reason,'PRIOR_WINDOW_NEEDS_SEAL');
assert.equal(writes,2,'expired window must not absorb a new click');
assert.equal(state.version,2);
assert.equal(state.deviceSeq[deviceA],1);
state={...state,window:null,pending:null,
  sealed:{id:state.window.id,version:state.window.revision,rows:[]}};
const next=await take(deviceA,2,'track-a',false,now+301_100,3);
assert.equal(next.accepted,true);
assert.equal(state.window.minutes,3,'Master applies to fresh window only');
assert.equal(state.sealed.version,2,'older sealed proof preserved');
const noProof=await take(deviceA,1,'track-a',true,now+301_200);
assert.equal(noProof.accepted,false,'old operation cannot override newer click');

assert.equal(Object.keys(state.pending).length,1);
state=null;reads=0;writes=0;
for(let i=1;i<=80;i++)assert.equal((await take(deviceA,i,'song-'+i,true,now+i)).accepted,true);
assert.equal(Object.keys(state.pending).length,80,'no last-50 truncation');
assert.equal(writes,80);
const before=writes;
const stale=await take(deviceA,2,'song-2',false,now+200);
assert.equal(stale.accepted,false);assert.equal(writes,before);
const a2=await take(deviceB,1,'song-1',false,now+150,5);
assert.equal(a2.accepted,true);
assert.equal(state.pending[crypto.createHash('sha256').update('song-1').digest('hex')].liked,false);
const client=readFileSync('src/services/exploreLikePrivateRtdbTransport416.ts','utf8');
assert.match(client,/STAGE416_SHARED_RTDB_BATCH_ACTIVE=false/);
assert.match(client,/httpsCallable/);
assert.doesNotMatch(client,/runTransaction|databaseRef|serverTimestamp/);
const seal=readFileSync('functions/src/exploreLikePrivateSeal416.ts','utf8');
assert.doesNotMatch(seal,/database.ref\('userSync'/);
assert.match(seal,/database.ref\('privateLikeBatch416\/'\+uid\)/);
console.log('STAGE416_SERVER_ONLY_UID_CLICK_80_TRACKS_NO_D1_AND_OLD_SIGNAL_OFF=PASS');
console.log('STAGE416_SERVER_AUTH_CLOCK_DEVICE_DEDUP_AND_MASTER_WINDOW=PASS');
console.log('STAGE416_EXPIRED_WINDOW_FAILS_CLOSED_UNTIL_SEAL=PASS');
