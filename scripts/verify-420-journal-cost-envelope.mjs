// Stage416/420 cost & retention audit: executes the actual dormant server gate
// on an in-memory Firebase transaction mock. Never accesses live user data.
// This is an envelope estimate of serialized payload, NOT billed RTDB usage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

let source=stripTypeScriptTypes(readFileSync('functions/src/exploreLikeAbuseGate420.ts','utf8'),{mode:'strip'})
  .replace(/^import\s+.*?from\s+'[^']+';\s*$/gm,'').replaceAll('export const ','const ');
assert.doesNotMatch(source,/^import\s/m);
source+='\nmodule.exports={publishGuardedLikeSignal420,MAX_APPROVAL_JOURNAL_420,APPROVAL_JOURNAL_TTL_MS_420};';
const module={exports:{}};
vm.runInNewContext(source,{module,console,createHash,Number,Math,Date,Error,Object},
  {timeout:2500});
const {publishGuardedLikeSignal420:publish,MAX_APPROVAL_JOURNAL_420:cap,
  APPROVAL_JOURNAL_TTL_MS_420:ttl}=module.exports;
assert.equal(cap,256);assert.equal(ttl,24*60*60_000);
const store=new Map();
const bytes=obj=>Buffer.byteLength(JSON.stringify(obj??null),'utf8');
let billedReadEnvelope=0,writeEnvelope=0,commits=0,attempts=0;
const serializedWrites=[];
const db={ref:path=>({transaction:async updater=>{
  assert.equal(path,'privateLikeSync420/cost-user');
  const original=store.get(path)??null;
  const before=original===null?null:structuredClone(original);
  billedReadEnvelope+=bytes(before);attempts++;
  const proposed=updater(before);
  if(proposed===undefined)return{committed:false,snapshot:{val:()=>original}};
  store.set(path,structuredClone(proposed));commits++;
  writeEnvelope+=bytes(proposed);
  serializedWrites.push(bytes(proposed));
  return{committed:true,snapshot:{val:()=>proposed}};
}})};
const uid='cost-user',base=1_000_000_000;
const mk=i=>({trackId:'track-'+i,ownerUid:'owner-user',liked:i%2===0,
  operationId:'aaaaaaaa-aaaa-4aaa-aaaa-'+String(i).padStart(12,'0')});
const policy={warningPerMinute:30,limitPerMinute:40,suspensionMinutes:120};
const sizes=new Map();
for(let i=1;i<=260;i++){
  const r=await publish(db,uid,mk(i),base+i*65_000,policy);
  assert.equal(r.allowed,true,'one action/minute must not hit the rate limit');
  const root=store.get('privateLikeSync420/'+uid);
  assert(root.display.results.length<=50,'UI event buffer cannot grow');
  assert(Object.keys(root.approvalJournal420||{}).length<=cap,'journal cannot grow');
  if([1,5,20,50,100,256,260].includes(i))sizes.set(i,bytes(root));
}
const root=store.get('privateLikeSync420/'+uid);
assert.equal(Object.keys(root.approvalJournal420).length,256);
assert.equal(root.approvalJournal420[mk(1).operationId],undefined);
assert(root.approvalJournal420[mk(5).operationId],'last 256 receipts retained');
const beforeDuplicate=commits;
const confirmed=await publish(db,uid,mk(5),base+261*65_000,policy);
assert.equal(confirmed.allowed,true);assert.equal(confirmed.duplicate,true);
assert.equal(commits,beforeDuplicate,'retained approval replay W0');
const mismatched=await publish(db,uid,{...mk(5),liked:!mk(5).liked},
  base+262*65_000,policy);
assert.equal(mismatched.allowed,false);assert.equal(commits,beforeDuplicate);
// Bounded retention cannot establish the original approval after eviction.
// Never claim unlimited replay safety; this legacy Callable remains dormant.
const evicted=await publish(db,uid,mk(1),base+263*65_000,policy);
assert.equal(evicted.allowed,true);assert.equal(evicted.duplicate,false,
  'detect and document 257+ older-ID replay gap, do not silently mark fixed');
assert.equal(commits,beforeDuplicate+1);
const s=Object.fromEntries(sizes);
const kB=n=>(n/1024).toFixed(1);
// Distinct workload envelopes: new/low activity is not the same as a
// saturated 256-receipt account. Never advertise this as observed billing.
const monthlyGiB=(dailyUsers,actionsPerUser)=>(
  serializedWrites.slice(0,actionsPerUser).reduce((a,b)=>a+b,0) *
  dailyUsers * 30/(1024**3)
).toFixed(2);
const saturatedGiB=(dailyUsers,actionsPerDay)=>(
  (serializedWrites.slice(200,260).reduce((a,b)=>a+b,0)/60) *
  dailyUsers * actionsPerDay * 30/(1024**3)
).toFixed(2);
console.log('STAGE420_JOURNAL_SERIALIZED_BYTES_BY_COUNT='+JSON.stringify(s));
console.log('STAGE420_JOURNAL_AT_256_KIB='+kB(s[256]));
console.log('STAGE420_ROOT_TRANSACTION_READ_ENVELOPE_BYTES='+billedReadEnvelope);
console.log('STAGE420_ROOT_TRANSACTION_WRITE_ENVELOPE_BYTES='+writeEnvelope);
console.log('STAGE420_APPROVAL_JOURNAL_MAX_256=PASS');
console.log('STAGE420_JOURNAL_RETAINED_REPLAY_W0_AND_MISMATCH_DENIED=PASS');
console.log('STAGE420_257TH_OLD_REPLAY_AFTER_EVICTION=RISK_CONFIRMED');
console.log('STAGE420_100K_DAU_5_DAILY_NEW_ACCOUNT_ACTIONS_GIB_MONTH_MODEL='+
  monthlyGiB(100000,5));
console.log('STAGE420_100K_DAU_20_DAILY_NEW_ACCOUNT_ACTIONS_GIB_MONTH_MODEL='+
  monthlyGiB(100000,20));
console.log('STAGE420_100K_DAU_5_DAILY_SATURATED_ACCOUNT_ACTIONS_GIB_MONTH_MODEL='+
  saturatedGiB(100000,5));
console.log('STAGE420_ESTIMATE_IS_NOT_LIVE_FIREBASE_BILLING=true');
console.log('STAGE420_CUTOVER_RELEASE_GATE=HOLD');
assert.match(readFileSync('src/services/exploreLikeService.ts','utf8'),
  /EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false/);
assert.match(readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8'),
  /const STAGE426_COMPILED_OPEN = false/);
