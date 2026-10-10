// Dormant Stage420 atomic Firestore ledger execution (in-memory only).
// Demonstrates 257+ exact replay W0 and bounded per-mutation document size.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
let code=stripTypeScriptTypes(readFileSync(
  'functions/src/exploreLikeAtomicLedgerCandidate420.ts','utf8'),{mode:'strip'})
  .replace(/^import\s+.*?from\s+'[^']+';\s*$/gm,'')
  .replaceAll('export const ','const ');
assert.doesNotMatch(code,/^import\s/m);
code+='\nmodule.exports={approveLikeWithAtomicLedgerCandidate420,readLikeOperationTime420};';
const module={exports:{}};
vm.runInNewContext(code,{module,createHash,Number,Math,Date,Error},
  {timeout:1500});
const {approveLikeWithAtomicLedgerCandidate420:approve,
  readLikeOperationTime420:readTime}=module.exports;
const day=24*60*60_000;
const base=1_800_000_000_000;
const v7=(id,t=base)=>{
  const hex=t.toString(16).padStart(12,'0');
  return hex.slice(0,8)+'-'+hex.slice(8)+'-7aaa-8bbb-'+String(id).padStart(12,'0');
};
assert.equal(readTime(v7(1)),base);
assert.equal(readTime('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),null);
const docs=new Map();let writes=0,reads=0,created=0;
let maxRateBytes=0,maxReceiptBytes=0;
const clone=x=>x==null?x:structuredClone(x);
const ref=(path)=>({
  path,
  collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)}),
});
const store={
  collection:name=>({doc:id=>ref(name+'/'+id)}),
  runTransaction:async callback=>{
    const staged=[];
    const tx={
      get:async doc=>{
        reads++;
        const found=docs.get(doc.path);
        return{exists:found!==undefined,data:()=>clone(found)};
      },
      set:(doc,val)=>staged.push(['set',doc.path,clone(val)]),
      create:(doc,val)=>{
        assert.equal(docs.has(doc.path),false,'no overwrite of existing op receipt');
        staged.push(['create',doc.path,clone(val)]);
      },
    };
    const out=await callback(tx);
    for(const [type,path,val] of staged){
      docs.set(path,val);writes++;
      const size=Buffer.byteLength(JSON.stringify(val));
      if(type==='set') maxRateBytes=Math.max(maxRateBytes,size);
      else{created++;maxReceiptBytes=Math.max(maxReceiptBytes,size);}
    }
    return out;
  },
};
const policy={warningPerMinute:30,limitPerMinute:40,suspensionMinutes:120};
const mk=i=>({trackId:'track-'+i,ownerUid:'owner',liked:i%2===0,
  operationId:v7(i,base+i*65_000)});
for(let i=1;i<=1000;i++){
  const op=mk(i);
  const result=await approve(store,'uid-1',op,base+i*65_000,policy);
  assert.equal(result.allowed,true);
  assert.equal(result.duplicate,false);
}
assert.equal(created,1000);
const first=mk(1);
const beforeReplayWrite=writes;
const duplicate=await approve(store,'uid-1',first,base+1001*65_000,policy);
assert.equal(duplicate.allowed,true);
assert.equal(duplicate.duplicate,true);
assert.equal(writes,beforeReplayWrite,'1001st operation cannot redo an old click');
const changed=await approve(store,'uid-1',{...first,liked:!first.liked},
  base+1002*65_000,policy);
assert.equal(changed.allowed,false);
assert.equal(writes,beforeReplayWrite);
await assert.rejects(approve(store,'uid-1',first,base+31*day,policy),
  /420_ATOMIC_LEDGER_EXPIRED_FAIL_CLOSED/);
await assert.rejects(approve(store,'uid-1',{
  ...mk(1002),operationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
},base+1002*65_000,policy),/420_ATOMIC_LEDGER_REQUEST_INVALID/);
const stampOld=v7(7001,base);
await assert.rejects(approve(store,'uid-1',{...mk(7001),operationId:stampOld},
  base+8*day,policy),/420_ATOMIC_LEDGER_EXPIRED_FAIL_CLOSED|420_ATOMIC_LEDGER_REQUEST_INVALID/)
  .catch(async error=>{
    // New first send older than 7d denies WITHOUT writing a new receipt.
    const result=await approve(store,'uid-1',{...mk(7001),operationId:stampOld},
      base+8*day,policy);
    assert.equal(result.allowed,false);
  });
assert.equal(writes,beforeReplayWrite);
assert(maxRateBytes<1000,'account counter is bounded, no 256-item journal payload');
assert(maxReceiptBytes<1000,'one independent operation has bounded footprint');
assert.equal(docs.size,1001,'one small account doc + 1000 independent receipts');
console.log('STAGE420_ATOMIC_LEDGER_1000_UNIQUE_APPROVALS=PASS');
console.log('STAGE420_ATOMIC_LEDGER_1001ST_EXACT_REPLAY_W0=PASS');
console.log('STAGE420_ATOMIC_LEDGER_TAMPER_AND_EXPIRED_FAIL_CLOSED=PASS');
console.log('STAGE420_ATOMIC_LEDGER_MAX_RATE_DOC_BYTES='+maxRateBytes);
console.log('STAGE420_ATOMIC_LEDGER_MAX_RECEIPT_DOC_BYTES='+maxReceiptBytes);
console.log('STAGE420_FIRESTORE_FIRST_ACCEPT=2_READ_2_WRITE_THEORETICAL');
console.log('STAGE420_FIRESTORE_DUPLICATE=1_READ_0_WRITE_THEORETICAL');
console.log('STAGE420_LIVE_BILLING_AND_RTDB_DELIVERY=NOT_VERIFIED');
console.log('STAGE420_ATOMIC_LEDGER_CUTOVER=OFF');
