// Node 22 source-only regression: no cloud connection, secrets, deploy, or data writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {APP518_QA_MIGRATIONS,buildQaD1SchemaPlan518} from './qaD1Plan518.mjs';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {
 QA518,QA518_LIMITS,admitQa518,assertQaProof518,qaBootstrapPlan518,
 seedEmptyQa518,cleanupQaR2518,createQaMeter518,buildAttestedQa518Handler,
} from './qaGate518.mjs';
import {isValidCatalogJournal} from '../../../cloudflare/media-worker/src/catalogJournal.js';

const nowMs=Date.parse('2026-11-23T00:00:00Z');
const runId='45090001234';
const d1Id='11111111-1111-4111-8111-111111111111';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const publicKeyPem=publicKey.export({type:'spki',format:'pem'});
const trustHash=createHash('sha256').update(publicKeyPem).digest('hex');
const observation={
 cloudflare:{
  accountId:QA518.accountId,workersPlan:'free',r2Plan:'paid',
  workers:[{
   name:QA518.originalWorker,activeVersion:QA518.originalVersion,
   trafficPercent:100,d1Bindings:[],r2Bindings:[],routes:[],crons:[],
  }],
  d1:[{name:QA518.d1Name,id:d1Id}],r2:[{name:QA518.r2Name}],
 },
 firebase:{
  projectId:QA518.firebaseProject,projectNumber:QA518.firebaseNumber,
  database:'(default)',location:'asia-northeast3',edition:'STANDARD',
  rulesSha256:QA518.rulesHash,
 },
 billing:{currency:'KRW',monthlyAlert:5000},
};
const clone=x=>structuredClone(x);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const claim={
 purpose:'SORIDRAW_APP518_ISOLATED_QA_ONE_SONG_V1',
 repository:QA518.repository,candidateSha:QA518.candidateSha,
 runId,qaAccountId:QA518.accountId,
 firebaseProject:QA518.firebaseProject,firebaseNumber:QA518.firebaseNumber,
 d1Id,d1Name:QA518.d1Name,r2Name:QA518.r2Name,
 pilot:{uid:'qa518-'+runId+'-owner',documentId:'qa518-'+runId+'-song'},
 limits:QA518_LIMITS,checkedAtMs:nowMs-5000,expiresAtMs:nowMs+300000,
 observationSha256:hash(observation),
};
const makeSigned=payload=>{
 const text=JSON.stringify(payload);
 return {payload:text,signature:sign(null,Buffer.from(text),privateKey).toString('base64')};
};
const args={publicKeyPem,trustedPublicKeySha256:trustHash,observed:observation,
 nowMs,runId,expectedD1Id:d1Id};
const admit=(overrides={})=>admitQa518({
 ...args,signed:makeSigned(claim),...overrides,
});
const rejection=(fn,code)=>{
 assert.throws(fn,e=>e?.message===code,'expected '+code);
};
const proof=admit();
assert.equal(proof.pilot.uid,'qa518-'+runId+'-owner');
assertQaProof518(proof,nowMs);
console.log('APP518_QA_SIGNED_INDEPENDENT_ONE_SONG_SCOPE=PASS');

rejection(()=>admit({trustedPublicKeySha256:'0'.repeat(64)}),
 'HOLD_QA_INDEPENDENT_KEY_NOT_PINNED');
rejection(()=>admit({signed:{...makeSigned(claim),signature:'a'.repeat(88)}}),
 'HOLD_QA_AUDITOR_SIGNATURE_INVALID');
rejection(()=>admit({runId:'other'}),'HOLD_QA_RUN_OR_D1_NOT_PINNED');
rejection(()=>admit({expectedD1Id:'not-a-real-d1-uuid'}),
 'HOLD_QA_RUN_OR_D1_NOT_PINNED');
const changed=(property,value)=>{
 const c=clone(claim);c[property]=value;
 return makeSigned(c);
};
rejection(()=>admit({signed:changed('qaAccountId','e1a30fc9ef497fda1d34f4ab3dc1da45')}),
 'HOLD_QA_EVIDENCE_SCOPE_OR_EXPIRY');
rejection(()=>admit({signed:changed('candidateSha','0'.repeat(40))}),
 'HOLD_QA_EVIDENCE_SCOPE_OR_EXPIRY');
rejection(()=>admit({signed:changed('checkedAtMs',nowMs-180000)}),
 'HOLD_QA_EVIDENCE_SCOPE_OR_EXPIRY');
rejection(()=>admit({signed:changed('expiresAtMs',nowMs-1000)}),
 'HOLD_QA_EVIDENCE_SCOPE_OR_EXPIRY');
const altered=clone(observation);altered.cloudflare.workers.push({
 name:'untrusted-second-writer',activeVersion:'unknown',trafficPercent:100,
 d1Bindings:['DB'],r2Bindings:[],routes:[],crons:[],
});
rejection(()=>admit({observed:altered}),
 'HOLD_QA_ACCOUNT_WRITER_INVENTORY_INCOMPLETE');
const wrongDb=clone(observation);wrongDb.cloudflare.d1[0].id=
 '22222222-2222-4222-8222-222222222222';
rejection(()=>admit({observed:wrongDb}),'HOLD_QA_SIGNED_LIVE_OBSERVATION_MISMATCH');
const badRules=clone(observation);badRules.firebase.rulesSha256='0'.repeat(64);
rejection(()=>admit({observed:badRules}),'HOLD_QA_FIRESTORE_OR_RULES_CHANGED');
const badAccount=clone(observation);badAccount.cloudflare.accountId='e1a30fc9ef497fda1d34f4ab3dc1da45';
rejection(()=>admit({observed:badAccount}),'HOLD_QA_ACCOUNT_OR_PROJECT_MISMATCH');
rejection(()=>assertQaProof518({runId,pilot:claim.pilot,expiresAtMs:claim.expiresAtMs},nowMs),
 'HOLD_QA_NONTRANSFERABLE_PROOF_OR_EXPIRED');
rejection(()=>assertQaProof518(proof,claim.expiresAtMs),
 'HOLD_QA_NONTRANSFERABLE_PROOF_OR_EXPIRED');
console.log('APP518_QA_UNTRUSTED_WRITER_PROJECT_EXPIRY_AND_KEY_DENIED=PASS');

const plan=qaBootstrapPlan518({proof,nowMs});
assert.equal(plan.baseKey,'catalog/v5/'+proof.pilot.uid+'/musicNote/base-1.json');
assert.equal(plan.headKey,'catalog/v5/'+proof.pilot.uid+'/musicNote/journal.json');
assert.equal(plan.head.canonicalAuthority518,true);
assert.equal(plan.head.itemCount,0);
assert.equal(plan.base.itemCount,0);
assert.equal(isValidCatalogJournal(plan.head,'musicNote'),true);
class FakeR2{
 constructor(){this.objects=new Map();this.sequence=0;this.writes=0;this.deletes=[];this.failHead=false;}
 async get(key){return this.objects.get(key)||null;}
 async put(key,body,options={}){
  if(options?.onlyIf?.etagDoesNotMatch==='*' && this.objects.has(key))return null;
  if(this.failHead&&key.endsWith('/journal.json'))throw Error('TRANSIENT_R2_FAILURE');
  const obj={text:async()=>body,customMetadata:options.customMetadata,
   etag:'etag-'+(++this.sequence)};
  this.objects.set(key,obj);this.writes++;return obj;
 }
 async delete(key){this.deletes.push(key);this.objects.delete(key);}
}
const bucket=new FakeR2();
const seeded=await seedEmptyQa518({proof,bucket,nowMs});
assert.equal(seeded.code,'QA518_EMPTY_R2_SEEDED');
assert.equal(bucket.writes,2);
assert.equal(JSON.parse(await (await bucket.get(plan.headKey)).text()).canonicalAuthority518,true);
await assert.rejects(()=>seedEmptyQa518({proof,bucket,nowMs}),
 /HOLD_QA_R2_PILOT_PREFIX_NOT_EMPTY/);
assert.equal(bucket.writes,2,'restart must not overwrite existing QA bootstrap');
const inspect=()=>({originalWorkerVersion:QA518.originalVersion,tempWorkerAbsent:true,
 pilotD1Rows:0,otherQaR2Writers:0});
await assert.rejects(()=>cleanupQaR2518({proof,bucket,nowMs,inspect:()=>({
 ...inspect(),tempWorkerAbsent:false,
})}),/HOLD_QA_CLEANUP_WRITER_OR_D1_UNCONFIRMED/);
await assert.rejects(()=>cleanupQaR2518({proof,bucket,nowMs,inspect:()=>({
 ...inspect(),pilotD1Rows:1,
})}),/HOLD_QA_CLEANUP_WRITER_OR_D1_UNCONFIRMED/);
const headRef=bucket.objects.get(plan.headKey);
bucket.objects.set(plan.headKey,{...headRef,customMetadata:{
 ...headRef.customMetadata,uid:'foreign-owner',
}});
await assert.rejects(()=>cleanupQaR2518({proof,bucket,nowMs,inspect}),
 /HOLD_QA_R2_FOREIGN_OBJECT_NO_DELETE/);
assert.equal(bucket.deletes.length,0);
bucket.objects.set(plan.headKey,headRef);
const result=await cleanupQaR2518({proof,bucket,nowMs,inspect});
assert.equal(result.code,'QA518_ONLY_TWO_PILOT_KEYS_REMOVED');
assert.deepEqual(new Set(bucket.deletes),new Set([plan.baseKey,plan.headKey]));
assert.equal(bucket.objects.size,0);
const partial=new FakeR2();partial.failHead=true;
await assert.rejects(()=>seedEmptyQa518({proof,bucket:partial,nowMs}),/TRANSIENT_R2_FAILURE/);
assert.equal(partial.objects.has(plan.baseKey),true);
partial.failHead=false;
await assert.rejects(()=>seedEmptyQa518({proof,bucket:partial,nowMs}),
 /HOLD_QA_R2_PILOT_PREFIX_NOT_EMPTY/);
await cleanupQaR2518({proof,bucket:partial,nowMs,inspect});
console.log('APP518_QA_R2_CREATE_ONLY_EMPTY_HEAD_BASE_AND_EXACT_CLEANUP=PASS');

let clock=nowMs;
const meter=createQaMeter518(proof,{now:()=>clock});
meter.reserve('firestoreWrites',QA518_LIMITS.firestoreWrites);
rejection(()=>meter.reserve('firestoreWrites',1),'HOLD_QA_OPERATION_BUDGET_EXCEEDED');
meter.reserve('d1RowsWritten',QA518_LIMITS.d1RowsWritten);
rejection(()=>meter.reserve('d1RowsWritten',1),'HOLD_QA_OPERATION_BUDGET_EXCEEDED');
meter.reserve('r2Writes',QA518_LIMITS.r2Writes);
rejection(()=>meter.reserve('r2Writes',1),'HOLD_QA_OPERATION_BUDGET_EXCEEDED');
assert.equal(meter.snapshot().firestoreWrites,4);
clock=nowMs+QA518_LIMITS.runtimeMs+1;
rejection(()=>meter.reserve('r2Reads',1),'HOLD_QA_WALL_CLOCK_BUDGET_EXCEEDED');
console.log('APP518_QA_ACCOUNT_WRITE_BUDGET_AND_TIMEOUT_FAIL_CLOSED=PASS');

const fakeEnv={
 FIREBASE_PROJECT_ID:QA518.firebaseProject,
 FIREBASE_PROJECT_NUMBER:QA518.firebaseNumber,
 SORIDRAW_APP518_QA_ACCOUNT_ID_518:QA518.accountId,
 SORIDRAW_APP518_PILOT_UID:proof.pilot.uid,
 SORIDRAW_APP518_PILOT_FAVORITE_ID:proof.pilot.documentId,
 SORIDRAW_APP518_QA_RELEASE_518:'APPROVED_ISOLATED_ONE_SONG',
 SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT',
 SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'VERIFIED',
 SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518:'VERIFIED',
};
let factoryInvoked=0;
const candidateFactory=({trustedIsolatedQaProof,env})=>{
 factoryInvoked++;assert.equal(trustedIsolatedQaProof,true);
 assert.equal(env.SORIDRAW_APP518_PILOT_UID,proof.pilot.uid);
 return {enabled:true};
};
const baseConfig={proof,nowMs,candidateFactory,env:fakeEnv,
 sourceFetcher:()=>{},clock:()=>nowMs};
rejection(()=>buildAttestedQa518Handler({...baseConfig,proof:{...proof}}),
 'HOLD_QA_NONTRANSFERABLE_PROOF_OR_EXPIRED');
rejection(()=>buildAttestedQa518Handler({...baseConfig,env:{
 ...fakeEnv,SORIDRAW_APP518_QA_ACCOUNT_ID_518:'e1a30fc9ef497fda1d34f4ab3dc1da45',
}}),'HOLD_QA_ATTESTED_HANDLER_SCOPE');
rejection(()=>buildAttestedQa518Handler({...baseConfig,env:{
 ...fakeEnv,SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'0',
}}),'HOLD_QA_ATTESTED_HANDLER_SCOPE');
assert.equal(factoryInvoked,0);
assert.equal(buildAttestedQa518Handler(baseConfig).enabled,true);
assert.equal(factoryInvoked,1);
console.log('APP518_QA_CANDIDATE_HANDLER_ONLY_VIA_ATTESTED_BRIDGE=PASS');
console.log('APP518_QA_SOURCE_ONLY_CLOUD_MUTATIONS=0; LIVE_E2E=NOT_TESTED');


const candidateDirectory=process.env.APP518_PINNED_CANDIDATE_DIR;
assert.ok(candidateDirectory,'APP518_PINNED_CANDIDATE_DIR_REQUIRED');
const migrationFiles=Object.fromEntries(APP518_QA_MIGRATIONS.map(name=>
 [name,readFileSync(join(candidateDirectory,'cloudflare/media-worker/migrations',name),'utf8')]));
const exactSchema=buildQaD1SchemaPlan518({
 proof,nowMs,files:migrationFiles,existingTableNames:['app768_qa_synthetic_follow'],
});
assert.equal(exactSchema.d1Id,d1Id);
assert.equal(exactSchema.cloudMutations,0);
assert.equal(exactSchema.statements.length,7);
assert.equal(exactSchema.tableNames.length,5);
assert.equal(exactSchema.indexNames.length,2);
rejection(()=>buildQaD1SchemaPlan518({
 proof,nowMs,files:migrationFiles,existingTableNames:['music_note_catalog_outbox_518'],
}),'HOLD_QA_D1_MIGRATION_ALREADY_OR_PARTIALLY_PRESENT');
const corruptSchema={...migrationFiles,[APP518_QA_MIGRATIONS[0]]:
 migrationFiles[APP518_QA_MIGRATIONS[0]]+'; DROP TABLE app768_qa_synthetic_follow;'};
rejection(()=>buildQaD1SchemaPlan518({
 proof,nowMs,files:corruptSchema,existingTableNames:[],
}),'HOLD_QA_D1_MUTATING_OR_UNKNOWN_SQL');
const missingSchema={...migrationFiles};
delete missingSchema[APP518_QA_MIGRATIONS[0]];
rejection(()=>buildQaD1SchemaPlan518({
 proof,nowMs,files:missingSchema,existingTableNames:[],
}),'HOLD_QA_D1_SCHEMA_INPUT');
console.log('APP518_QA_PINNED_MIGRATIONS_EXACT_SEVEN_DDL_STATEMENTS=PASS');
console.log('APP518_QA_PARTIAL_SCHEMA_FOREIGN_DDL_AND_NONQA_D1_HOLD=PASS');
