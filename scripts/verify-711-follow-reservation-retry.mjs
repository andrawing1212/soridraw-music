import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {patchOwner660} from './lib/owner-follow-general660.mjs';
import {patchReservationRetry711,hash711,ACTIVE_OWNER_SHA711} from './lib/follow-reservation-retry-711.mjs';
import {createOwnerFollowRecovery556 as canonical} from '../cloudflare/explore-worker/runtime/owner-follow-recovery-556.mjs';
const baseline=patchOwner660(readFileSync('scripts/fixtures/owner-follow660/worker.mjs','utf8').replaceAll('\r\n','\n'));
assert.equal(hash711(baseline),ACTIVE_OWNER_SHA711);
const load=source=>{
 const context=vm.createContext({Response,Request,URL,TextEncoder,crypto});
 vm.runInContext(source.slice(0,source.lastIndexOf('export {')),context);
 return context.createOwnerFollowRecovery556;
};
const original=load(baseline),patched=load(patchReservationRetry711(baseline));
assert.throws(()=>patchReservationRetry711(baseline+' '),/DRIFT/);
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1'};
const ticket={ownerUid:'target',actorUid:'actor',operationId:'operation_123456789',
 authEpoch:'0'.repeat(32),cutoverToken:'cutover',expectedRevision:7,
 desired:false,beforeFollowing:true,priorR2Revision:100};
function harness(make,deliver=async()=>({status:'intent-not-matching'})){
 let pending,at=1000,due=null,writes=0,alarms=0;
 const storage={get:async()=>structuredClone(pending),put:async(k,v)=>{writes++;pending=structuredClone(v)},
  delete:async()=>{writes++;pending=undefined},getAlarm:async()=>due,
  setAlarm:async value=>{alarms++;due=value}};
 return {node:make({state:{storage},env,enabled:true,now:()=>at,deliver}),
  advance:()=>{at=Math.max(at,due||at);due=null},
  counts:()=>({writes,alarms}),pending:()=>pending,storage};
}
// Exact active code reproduces the live operation-conflict from a profile
// revision advance, despite an unchanged pair revision and operation identity.
const old=harness(original);
assert.equal((await old.node.reserve(ticket)).status,'reserved');
assert.equal((await old.node.reserve({...ticket,priorR2Revision:120})).status,'operation-conflict');
console.log('APP711 live source operation-conflict reproduction: PASS');
for(const [name,make] of [['source',canonical],['active-bundle',patched]]){
 let committed=false,deliveries=0;
 const h=harness(make,async({reservation})=>{
  assert.equal(reservation.priorR2Revision,100,'original proof floor retained');
  if(!committed)return {status:'intent-not-matching'};
  deliveries++;return {status:'delivered'};
 });
 assert.equal((await h.node.reserve(ticket)).status,'reserved');
 const cost=h.counts();
 for(let n=0;n<6;n++)assert.equal((await h.node.reserve({...ticket,priorR2Revision:120+n})).status,'already-reserved');
 assert.deepEqual(h.counts(),cost,'reload/duplicate retry has zero storage writes or alarm writes');
 assert.equal(h.pending().entries.length,1);
 for(const change of [{priorR2Revision:99},{expectedRevision:8},{cutoverToken:'other'},
  {desired:true,beforeFollowing:false}])
  assert.equal((await h.node.reserve({...ticket,...change})).status,'operation-conflict');
 assert.equal((await h.node.reserve({...ticket,authEpoch:'1'.repeat(32)})).status,'generation-held');
 // A rejected canonical attempt remains reserved and eventually held.
 for(let i=0;i<8;i++){h.advance();await h.node.alarm()}
 assert.equal(h.pending().entries[0].dead,true);
 const first=h.pending().entries[0].generation;
 assert.equal((await h.node.reserve({...ticket,priorR2Revision:130})).status,'reserved');
 assert.equal(h.pending().entries.length,1);
 assert.equal(h.pending().entries[0].dead,false);
 assert(h.pending().entries[0].generation>first);
 assert.equal(h.pending().entries[0].priorR2Revision,100);
 committed=true;h.advance();assert.equal((await h.node.alarm()).status,'delivered');
 assert.equal(deliveries,1);assert.equal(h.pending(),undefined);
 assert.equal((await h.node.alarm()).status,'empty');
 // Queue bound stays enforced; an exact retry never allocates another slot.
 const q=harness(make);
 for(let i=0;i<24;i++)await q.node.reserve({...ticket,operationId:'operation_123456789_'+i});
 assert.equal((await q.node.reserve({...ticket,operationId:'operation_123456789_24'})).status,'owner-queue-full');
 assert.equal((await q.node.reserve({...ticket,operationId:'operation_123456789_0',priorR2Revision:120})).status,'already-reserved');
 assert.equal(q.pending().entries.length,24);
 // No ACK if a revived ticket cannot durably schedule delivery.
 const f=harness(make);await f.node.reserve(ticket);
 for(let i=0;i<8;i++){f.advance();await f.node.alarm()}
 const schedule=f.storage.setAlarm;
 f.storage.setAlarm=async()=>{throw Error('storage failed')};
 await assert.rejects(f.node.reserve({...ticket,priorR2Revision:120}),/storage failed/);
 await assert.rejects(f.node.reserve({...ticket,priorR2Revision:120}),/storage failed/);
 f.storage.setAlarm=schedule;
 assert.equal((await f.node.reserve({...ticket,priorR2Revision:120})).status,'already-reserved');
 // A late result from the previous delivery generation cannot consume a
 // ticket revived by the user's explicit retry.
 let finish,start,firstDelivery=true;
 const started=new Promise(resolve=>{start=resolve});
 const late=harness(make,async()=>{
  if(firstDelivery){firstDelivery=false;start();return new Promise(resolve=>{finish=resolve})}
  return {status:'intent-not-matching'};
 });
 await late.node.reserve(ticket);
 const seeded=late.pending();seeded.entries[0].attempts=7;
 await late.storage.put('pending',seeded);late.advance();
 const inFlight=late.node.alarm();await started;
 await late.node.alarm();assert.equal(late.pending().entries[0].dead,true);
 await late.node.reserve({...ticket,priorR2Revision:120});
 const revived=late.pending().entries[0].generation;
 finish({status:'delivered'});
 assert.equal((await inFlight).status,'newer-reservation-preserved');
 assert.equal(late.pending().entries[0].generation,revived);
 assert.equal(late.pending().entries[0].dead,false);
 console.log('APP711 '+name+': reload, duplicate, collision, held retry, delivery, bounded queue, fail-closed: PASS');
}
