import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createApp783QaSettledHistory,APP783_QA_SETTLED_HISTORY_COMPILED_OPEN}
 from './app783-qa-immutable-settled-history.mjs';
assert.equal(APP783_QA_SETTLED_HISTORY_COMPILED_OPEN,false);
assert.equal(createApp783QaSettledHistory(),null);
assert.throws(()=>createApp783QaSettledHistory({enabled:true}));
const op={ownerUid:'qa783Owner',actorUid:'qa783Actor',
 authEpoch:'a'.repeat(32),cutoverToken:'qa783SyntheticCutover0123456789',
 canonicalOperationId:'qa783OperationCanonical123456',expectedRevision:7,desired:true};
const hash=createHash('sha256').update(JSON.stringify([op.cutoverToken,
 op.ownerUid,op.actorUid,op.authEpoch,op.canonicalOperationId])).digest('hex');
const admitted={kind:'APP767_ADMISSION_NOT_CANONICAL_COMMIT',...op};
const admission={status:'ADMISSION_ONLY_NOT_D1_COMMIT',keyDigest:hash,
 productionDeployAuthorized:false,requiresCanonicalCommitProof:true,
 d1AdditionalRowsWritten:0};
const maps=new Map([['internal/qa767/owner-follow-admissions/'+hash,admitted]]);
let puts=0,proofs=0;
const bucket={
 async get(k){const v=maps.get(k);return v===undefined?null:{text:async()=>JSON.stringify(v)}},
 async put(k,body,opts){puts++;
  assert.deepEqual(opts.onlyIf,{etagDoesNotMatch:'*'});
  if(maps.has(k))return null;
  maps.set(k,JSON.parse(body));return {etag:'qa-etag'};
 },
};
const exactProof={source:'QA783_EXACT_D1_R2_SETTLED',verified:true,
 changed:true,canonicalD1Committed:true,r2ProjectionSettled:true,
 ownerEpochVerified:true,...op,committedRevision:8,
 d1OperationId:op.canonicalOperationId,r2OperationId:op.canonicalOperationId};
let proofValue=exactProof;
const engine=createApp783QaSettledHistory({enabled:true,
 scope:'APP783_ISOLATED_SYNTHETIC_QA',bucket,
 verifySettledCanonical:async()=>{proofs++;return proofValue}});
const arg=()=>({env:{SORIDRAW_ENVIRONMENT:'isolated-qa'},operation:op,admission});
assert.equal((await engine.settle({...arg(),env:{SORIDRAW_ENVIRONMENT:'production'}})).status,'HOLD');
assert.equal(proofs,0);assert.equal(puts,0);
for(const a of [
 {...arg(),admission:{...admission,keyDigest:'f'.repeat(64)}},
 {...arg(),admission:{...admission,d1AdditionalRowsWritten:1}},
 {...arg(),operation:{...op,ownerUid:'differentOwner'}},
]){assert.equal((await engine.settle(a)).status,'HOLD')}
assert.equal(proofs,0);assert.equal(puts,0);
proofValue={...exactProof,d1OperationId:'wrongOperationId123456'};
assert.equal((await engine.settle(arg())).reason,'EXACT_D1_R2_COMMIT_UNVERIFIED');
assert.equal(puts,0);
proofValue=exactProof;
const first=await engine.settle(arg());
assert.equal(first.status,'QA_IMMUTABLE_SETTLED_ONLY');
assert.equal(first.additionalD1RowsWritten,0);
assert.equal(first.productionDeployAuthorized,false);
assert.equal(first.automaticRecoveryAuthorized,false);
assert.equal(puts,1);
const repeat=await engine.settle(arg());
assert.equal(repeat.status,'EXACT_QA_SETTLED_REPLAY_READ_ONLY');
assert.equal(puts,1);assert.equal(proofs,3);
const receiptKey='internal/qa783/owner-follow-settled/'+hash;
const original=maps.get(receiptKey);
maps.set(receiptKey,{...original,committedRevision:999});
const conflicting=await engine.settle(arg());
assert.equal(conflicting.status,'HOLD');
assert.equal(conflicting.reason,'REPLAY_EXACT_CANONICAL_REVISION_MISMATCH');
maps.set(receiptKey,{...original,ownerUid:'differentOwner'});
assert.equal((await engine.settle(arg())).reason,'SETTLED_RECEIPT_CONFLICT');
maps.delete(receiptKey);
bucket.put=async()=>{puts++;throw Error('uncertain after write')};
assert.equal((await engine.settle(arg())).reason,'SETTLED_WRITE_OUTCOME_UNKNOWN');
assert.equal(puts,2);
console.log('APP783_QA_IMMUTABLE_SETTLED_OPERATION_ONLY=PASS');
console.log('APP783_QA_REPLAY_ZERO_ADDITIONAL_WRITES_AND_503_HOLD=PASS');
console.log('APP783_REAL_QA_D1_R2_AND_GLOBAL_CUTOVER=NOT_TESTED');
