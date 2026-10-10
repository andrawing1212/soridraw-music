// Stage420 source-only actual helper execution; memory RTDB, no live reads.
// Recover ONLY an exact, recent and server-approved first click from 50 rows.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
let gateSource = stripTypeScriptTypes(
  readFileSync('functions/src/exploreLikeAbuseGate420.ts','utf8'),{mode:'strip'})
  .replace(/^import\s+.*?from\s+'[^']+';\s*$/gm,'')
  .replaceAll('export const ','const ');
gateSource += '\\nmodule.exports={digestApprovedLikeCommand420,matchesApprovedLikeReceipt420};';
const gateModule={exports:{}};
vm.runInNewContext(gateSource,{module:gateModule,Number,Date,Error,Math,createHash},
  {timeout:1000});
const {digestApprovedLikeCommand420,matchesApprovedLikeReceipt420}=gateModule.exports;
const src=stripTypeScriptTypes(
  readFileSync('functions/src/exploreLikeApprovalRecovery420.ts','utf8'),{mode:'strip'})
  .replace(/^import\s+.*?from\s+'[^']+';\s*$/gm,'')
  .replaceAll('export const ','const ');
assert.doesNotMatch(src,/^import\s/m);
const module={exports:{}};
vm.runInNewContext(src+
  '\nmodule.exports={hasExactRecentApprovedLike420,LIKE_APPROVAL_RECOVERY_MAX_AGE_MS_420};',
  {module,Number,Date,Error,Array,matchesApprovedLikeReceipt420},{timeout:1000});
const {hasExactRecentApprovedLike420:lookup,
  LIKE_APPROVAL_RECOVERY_MAX_AGE_MS_420:maximumAge}=module.exports;
const operation={trackId:'song-7',ownerUid:'owner-8',liked:true,
  operationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'};
const uid='uid-a',at=1_000_000_000;
let rows=[{...operation,at,version:10,status:'pending'}];
let journal={ at, digest:digestApprovedLikeCommand420(operation) };
let reads=0;
let writes=0;
const db={ref:path=>{
 const journalPath='privateLikeSync420/uid-a/approvalJournal420/'+operation.operationId;
 const fallbackPath='privateLikeSync420/uid-a/display/results';
 assert.ok(path===journalPath || path===fallbackPath,
   'only the exact operation or bounded legacy 50-row display may be read');
 return {get:async()=>{reads++;return{val:()=>path===journalPath?journal:rows}} ,
   transaction:async()=>{writes++;throw Error('NO_WRITES')},
   set:async()=>{writes++;throw Error('NO_WRITES')}};
}};
assert.equal(await lookup(db,uid,operation,at+1000),true);
assert.equal(reads,1);assert.equal(writes,0);
for(const mutation of [
 {...operation,operationId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'},
 {...operation,ownerUid:'other-owner'},
 {...operation,trackId:'other-track'},
 {...operation,liked:false},
]) assert.equal(await lookup(db,uid,mutation,at+1000),false);
journal=null;
rows=[{...operation,at,version:10,status:'rejected'}];
assert.equal(await lookup(db,uid,operation,at+1000),false);
journal={at,digest:digestApprovedLikeCommand420(operation)};
rows=[{...operation,at,version:10,status:'pending'}];
assert.equal(await lookup(db,uid,operation,at+24*60*60_000+1),false,
  'old retained records are not unlimited approval proofs');
assert.equal(await lookup(db,uid,operation,at-1),false,
  'future events are not approval evidence');
rows=Array.from({length:51},(_,i)=>({...operation,at,version:i+1,status:'pending'}));
assert.equal(await lookup(db,uid,operation,at+1000),true,
  'exact server journal survives display eviction independent of UI history');
journal=null;
assert.equal(await lookup(db,uid,operation,at+1000),false,
  'legacy 51-row unbounded fallback still fails closed');
rows=Array.from({length:50},(_,i)=>({
 ...operation,operationId:'aaaaaaaa-aaaa-4aaa-aaaa-'+String(i+1).padStart(12,'0'),
 at,version:i+1,status:'pending',
}));
assert.equal(await lookup(db,uid,operation,at+1000),false,
  'first operation evicted after 51 clicks stays unconfirmed');
assert.equal(writes,0,'exact proof lookup MUST NOT perform a new rate transaction');
journal={at,digest:digestApprovedLikeCommand420(operation)};
assert.equal(await lookup(db,uid,operation,at+1000),true,
  'oldest still-approved command survives visible 50-event eviction');
await assert.rejects(lookup(db,'uid.a',operation,at+1000),/420_APPROVAL_RECOVERY_INVALID/);
const fn=readFileSync('functions/src/index.ts','utf8');
const begin=fn.indexOf('export const recoverExploreLikePermit420 = onCall(');
const end=fn.indexOf('// Stage420 Master-only administrative recovery.',begin);
assert.ok(begin>=0 && end>begin);
const callable=fn.slice(begin,end);
assert.match(callable,/request\.auth\?\.uid/);
assert.match(callable,/hasExactRecentApprovedLike420/);
assert.match(callable,/issueLikePermit420/);
assert.match(callable,/permission-denied/);
assert.doesNotMatch(callable,/publishGuardedLikeSignal420|\.transaction\(/);
assert.match(readFileSync('src/services/exploreLikeService.ts','utf8'),
  /EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false/);
assert.match(readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8'),
  /const STAGE426_COMPILED_OPEN = false/);
console.log('STAGE420_RECENT_EXACT_ACK_LOSS_LOOKUP=PASS');
console.log('STAGE420_ATOMIC_JOURNAL_EXACT_51PLUS_RECOVERY=PASS');
console.log('STAGE420_READONLY_BOUNDED_50_NO_QUOTA_WRITE=PASS');
console.log('STAGE420_EVICTED_MISMATCH_EXPIRED_FAIL_CLOSED=PASS');
console.log('STAGE420_SHARED_DATA_AND_CUTOVER_UNCHANGED=PASS');
