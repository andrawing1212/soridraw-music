import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {applyPrivateRtdbClick416 as click,hashTrackIdForRtdb416 as hash}
 from '../src/services/exploreLikePrivateRtdbWindow416.mjs';
const require=createRequire(import.meta.url);
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const s=readFileSync('functions/src/'+file+'.ts','utf8');
 const output=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};cache.set(file,module.exports);
 vm.runInNewContext(output,{module,exports:module.exports,URL,Date,Object,Number,
  Error,console,require:id=>id.startsWith('./')?load(id.slice(2)):require(id),
  fetch:()=>{throw Error('network not allowed')}},{timeout:2200});
 return module.exports;
}
const {dispatchPrivateWindowTask416:dispatch,scheduleInitialPrivateWindow416:initial}
  =load('exploreLikePrivateDeadline416');
const task={uid:'same-uid',windowId:'00000000-0000-4000-8000-000000000001'};
const now=1_700_000_000_000;
const planned=[];
const queue={enqueue:async(a,o)=>{planned.push({task:a,at:o.scheduleTime.getTime()});}};
const scheduled=await initial(queue,task,{lastClickAtMs:now,minutes:5});
assert.equal(scheduled,now+300_000);
assert.deepEqual(planned.map(x=>x.at),[now+300_000]);
let state=null,reads=0,writes=0,sends=0;
const db={ref:()=>({
 transaction:async fn=>{
  reads++;const n=fn(state);
  if(n===undefined)return {committed:false,snapshot:{val:()=>state}};
  state=n;writes++;return {committed:true,snapshot:{val:()=>state}};
 },
 get:async()=>{reads++;return {val:()=>state};},
})};
async function push(seq,track,at){
 const row={trackId:track,trackKey:await hash(track),
 liked:true,deviceId:'00000000-0000-4000-8000-000000000009',
 operationId:'00000000-0000-4000-8000-'+String(seq).padStart(12,'0'),
 deviceSequence:seq};
 state=click(state,row,at,5);
}
await push(1,'song-a',now);
await push(2,'song-b',now+60_000);
const later=await dispatch(db,queue,task,'https://preview.soridraw.com/v1/internal/private-like-handoff-416',
 'strict-secret-over-thirty-two-characters',now+300_000);
assert.equal(later.status,'RESCHEDULED');
assert.equal(later.atMs,now+361_000,
 'NOT_DUE reschedule must use a fresh task ID after deadline');
assert.equal(planned.length,2,'two clicks still just 1 initial task and 1 deferred task');
assert.equal(writes,0,'early task must not seal RTDB');
// One millisecond early delivery previously attempted to enqueue the original
// scheduleTime, colliding with the still-running Cloud Task ID. The existing
// taskQueue adapter treats ALREADY_EXISTS as success, so the window is lost.
state=null;planned.length=0;
await push(1,'song-one-ms-early',now);
await initial(queue,task,{lastClickAtMs:now,minutes:5});
const early=await dispatch(db,queue,task,
 'https://preview.soridraw.com/v1/internal/private-like-handoff-416',
 'strict-secret-over-thirty-two-characters',now+300_000-1);
assert.equal(early.status,'RESCHEDULED');
assert.equal(early.atMs,now+301_000);
assert.notEqual(planned[0].at,planned[1].at,
 'new retry ID must not equal currently executing initial task ID');
// Restore the original window for remaining unchanged regression scenarios.
state=null;
await push(1,'song-a',now);
await push(2,'song-b',now+60_000);
const newerTask={uid:task.uid,windowId:'00000000-0000-4000-8000-000000000099'};
assert.equal((await dispatch(db,queue,newerTask,'url','secret',now+360_000)).status,'STALE');
assert.equal(planned.length,2,'stale task must not reschedule');
const secret='strict-secret-over-thirty-two-characters';
const endpoint='https://preview.soridraw.com/v1/internal/private-like-handoff-416';
const http=async(_url,req)=>{
 sends++;const seal=JSON.parse(req.body);
 assert.equal(seal.version,2);
 assert.equal(seal.rows.length,2);
 return {ok:true,json:async()=>({ok:true,data:{queued:true,canonicalD1:'settled',
  canonicalProof:'atomic-drain-batch-418',personalLikeSnapshot:'changed-track-r2',
  finalReceipt:'PUBLISHED',version:seal.version,
  batchIds:['l069_'+String(seal.sealedAtMs).padStart(13,'0')+'_'+'a'.repeat(64)]}})};
};
// A new UID window cannot be dropped merely because an older frozen seal
// has not yet received its exact Worker acknowledgement.
const blockedLater={uid:task.uid,windowId:'00000000-0000-4000-8000-000000000099'};
const earlierSealed={id:task.windowId,version:1,closedAtMs:now,
 rows:[{trackId:'song-a',liked:true,operationId:task.windowId}]};
const previousState=state;
state={...state,sealed:earlierSealed,window:{
 id:blockedLater.windowId,minutes:5,openedAtMs:now,lastClickAtMs:now,revision:3,
},pending:{songc:{trackId:'song-c',liked:true,operationId:blockedLater.windowId,
 deviceId:'00000000-0000-4000-8000-000000000009',deviceSequence:3,version:3}}};
const blocked=await dispatch(db,queue,blockedLater,endpoint,secret,now+300_000,http);
assert.equal(blocked.status,'RESCHEDULED','newer task stays alive while older ACK is unconfirmed');
assert.equal(blocked.atMs,now+360_000);
assert.equal(state.sealed.id,task.windowId);
state=previousState;
const done=await dispatch(db,queue,task,endpoint,secret,now+360_000,http);
assert.equal(done.status,'DELIVERED');
assert.equal(sends,1);
assert.equal(state.sealed,null);
assert.equal(state.window,null);
const replay=await dispatch(db,queue,task,endpoint,secret,now+360_100,http);
assert.equal(replay.status,'EMPTY','finished old task must not produce another request');
assert.equal(sends,1);
state=null;reads=0;writes=0;planned.length=0;
const beforeReads=reads;
for(let n=1;n<=80;n++)await push(n,'song-'+n,now+n);
assert.equal(planned.length,0,'clicks do not schedule per-click tasks');
assert.equal(reads,beforeReads,'clicks do not trigger scheduler reads');
console.log('STAGE416_DEADLINE_INITIAL_ONE_TASK_LATEST_CLICK_RESCHEDULE=PASS');
console.log('STAGE416_DEADLINE_STALE_TASK_NO_WRITE_POST_SETTLE_EMPTY=PASS');
console.log('STAGE416_DEADLINE_80_CLICK_NO_PER_CLICK_TASK_OR_READ=PASS');
console.log('STAGE416_EARLY_DEADLINE_RETRY_UNIQUE_TASK_ID=PASS');
