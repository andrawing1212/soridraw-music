// APP518 isolated QA admission and one-song resource lifecycle (SOURCE ONLY).
// No HTTP client, credentials, deployment, SQL mutation, or app hook here.
// Verified proof is a non-serializable in-process capability, never an env flag.
import {createHash,createPublicKey,verify} from 'node:crypto';
import {createEmptyCatalogJournal,isValidCatalogJournal}
  from '../../../cloudflare/media-worker/src/catalogJournal.js';

export const QA518=Object.freeze({
  repository:'andrawing1212/soridraw-music',
  candidateSha:'864f796da24413309567198c9de502b13cdedd50',
  firebaseProject:'soridraw-app',
  firebaseNumber:'1083981050742',
  accountId:'b60fcd62c679c64db19f0b0e0c2f3429',
  d1Name:'soridraw-qa-app768-d1',
  r2Name:'soridraw-qa-app768-r2',
  originalWorker:'soridraw-owner-qa-583',
  originalVersion:'4ed70845-6a4b-4a80-9c51-ed95d0becc38',
  rulesHash:'ecf30f940747dcc3c5ba4993093e9a11ac9fc5df7e14b2a1512d2446923d84eb',
});
export const QA518_LIMITS=Object.freeze({
  firestoreWrites:6, d1RowsWritten:96, r2Writes:8, r2Reads:32,
  httpRequests:18, runtimeMs:120000,
});
const sha=data=>createHash('sha256').update(data).digest('hex');
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validUuid=s=>typeof s==='string'&&
 /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const validRun=s=>/^[0-9]{8,20}$/.test(String(s||''));
const capability=new WeakSet();
const fail=code=>{throw new Error(code);};
const pureObject=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const stable=(o)=>JSON.stringify(o);
const getPilot=runId=>({
  uid:'qa518-'+runId+'-owner',
  documentId:'qa518-'+runId+'-song',
});
const assertObserved=observed=>{
  const o=observed;
  if(!pureObject(o) || !pureObject(o.cloudflare) || !pureObject(o.firebase)
    ||!pureObject(o.billing))fail('HOLD_QA_OBSERVATION_MISSING');
  const c=o.cloudflare,f=o.firebase,b=o.billing;
  if(c.accountId!==QA518.accountId||f.projectId!==QA518.firebaseProject
    ||f.projectNumber!==QA518.firebaseNumber)
    fail('HOLD_QA_ACCOUNT_OR_PROJECT_MISMATCH');
  if(!Array.isArray(c.workers)||c.workers.length!==1)
    fail('HOLD_QA_ACCOUNT_WRITER_INVENTORY_INCOMPLETE');
  const worker=c.workers[0];
  if(worker.name!==QA518.originalWorker||worker.activeVersion!==QA518.originalVersion
    ||worker.trafficPercent!==100
    ||!exact(worker.d1Bindings,[])||!exact(worker.r2Bindings,[])
    ||!exact(worker.routes,[])||!exact(worker.crons,[]))
    fail('HOLD_QA_ORIGINAL_WORKER_WRITES_OR_VERSION_UNKNOWN');
  if(!Array.isArray(c.d1)||c.d1.length!==1||
    c.d1[0].name!==QA518.d1Name||!validUuid(c.d1[0].id))
    fail('HOLD_QA_D1_INVENTORY_UNVERIFIED');
  if(!Array.isArray(c.r2)||c.r2.length!==1||c.r2[0].name!==QA518.r2Name)
    fail('HOLD_QA_R2_INVENTORY_UNVERIFIED');
  if(c.workersPlan!=='free'||c.r2Plan!=='paid')
    fail('HOLD_QA_BILLING_PLAN_UNVERIFIED');
  if(f.database!=='(default)'||f.location!=='asia-northeast3'
    ||f.edition!=='STANDARD'||f.rulesSha256!==QA518.rulesHash)
    fail('HOLD_QA_FIRESTORE_OR_RULES_CHANGED');
  if(b.currency!=='KRW'||b.monthlyAlert!==5000)
    fail('HOLD_QA_BUDGET_ALERT_UNVERIFIED');
};
export function admitQa518({signed,publicKeyPem,trustedPublicKeySha256,
  observed,nowMs=Date.now(),runId,expectedD1Id}={}){
  if(typeof publicKeyPem!=='string'||typeof trustedPublicKeySha256!=='string'
    ||!(/^[a-f0-9]{64}$/.test(trustedPublicKeySha256))
    ||sha(publicKeyPem)!==trustedPublicKeySha256)
    fail('HOLD_QA_INDEPENDENT_KEY_NOT_PINNED');
  if(!validRun(runId)||!validUuid(expectedD1Id))
    fail('HOLD_QA_RUN_OR_D1_NOT_PINNED');
  if(!pureObject(signed)||typeof signed.payload!=='string'
    ||typeof signed.signature!=='string'
    ||signed.payload.length>8192||!/^[A-Za-z0-9+/]+={0,2}$/.test(signed.signature))
    fail('HOLD_QA_SIGNED_EVIDENCE_MISSING');
  let ok=false;
  try{ok=verify(null,Buffer.from(signed.payload,'utf8'),
    createPublicKey(publicKeyPem),Buffer.from(signed.signature,'base64'));}
  catch{fail('HOLD_QA_AUDITOR_SIGNATURE_INVALID');}
  if(!ok)fail('HOLD_QA_AUDITOR_SIGNATURE_INVALID');
  let claim;
  try{claim=JSON.parse(signed.payload);}
  catch{fail('HOLD_QA_EVIDENCE_JSON_INVALID');}
  if(!Number.isSafeInteger(nowMs)||!pureObject(claim)
    ||claim.purpose!=='SORIDRAW_APP518_ISOLATED_QA_ONE_SONG_V1'
    ||claim.repository!==QA518.repository||claim.candidateSha!==QA518.candidateSha
    ||claim.runId!==String(runId)
    ||claim.qaAccountId!==QA518.accountId
    ||claim.firebaseProject!==QA518.firebaseProject
    ||claim.firebaseNumber!==QA518.firebaseNumber
    ||claim.d1Id!==expectedD1Id
    ||claim.d1Name!==QA518.d1Name||claim.r2Name!==QA518.r2Name
    ||!exact(claim.pilot,getPilot(runId))
    ||!exact(claim.limits,QA518_LIMITS)
    ||!Number.isSafeInteger(claim.checkedAtMs)
    ||!Number.isSafeInteger(claim.expiresAtMs)
    ||claim.checkedAtMs>nowMs||nowMs-claim.checkedAtMs>120000
    ||claim.expiresAtMs<=nowMs||claim.expiresAtMs-nowMs>600000)
    fail('HOLD_QA_EVIDENCE_SCOPE_OR_EXPIRY');
  assertObserved(observed);
  if(observed.cloudflare.d1[0].id!==expectedD1Id
    ||claim.observationSha256!==sha(stable(observed)))
    fail('HOLD_QA_SIGNED_LIVE_OBSERVATION_MISMATCH');
  const proof=Object.freeze({runId:String(runId),d1Id:expectedD1Id,
    pilot:Object.freeze(getPilot(runId)),expiresAtMs:claim.expiresAtMs});
  capability.add(proof);
  return proof;
}
export function assertQaProof518(proof,nowMs=Date.now()){
  if(!pureObject(proof)||!capability.has(proof)
    ||!Number.isSafeInteger(nowMs)||nowMs>=proof.expiresAtMs)
    fail('HOLD_QA_NONTRANSFERABLE_PROOF_OR_EXPIRED');
  return proof;
}
export function qaBootstrapPlan518({proof,nowMs=Date.now()}={}){
  assertQaProof518(proof,nowMs);
  const uid=proof.pilot.uid;
  const prefix='catalog/v5/'+encodeURIComponent(uid)+'/musicNote/';
  const baseKey=prefix+'base-1.json';
  const headKey=prefix+'journal.json';
  const base={schemaVersion:4,authority:'server',kind:'musicNote',
    complete:true,ownerUid:uid,revision:1,itemCount:0,items:[]};
  const head={...createEmptyCatalogJournal({
    kind:'musicNote',baseKey,baseRevision:1,itemCount:0,now:nowMs,
  }),canonicalAuthority518:true};
  if(!isValidCatalogJournal(head,'musicNote'))
    fail('HOLD_QA_INITIAL_JOURNAL_INVALID');
  return Object.freeze({uid,prefix,headKey,baseKey,
    base:Object.freeze(base),head:Object.freeze(head)});
}
// Two exact R2 create-only PUTs. A partial seed is a HOLD, never an overwrite.
// The cleanup below is allowed only after the unique QA Worker is absent.
export async function seedEmptyQa518({proof,bucket,nowMs=Date.now()}={}){
  const plan=qaBootstrapPlan518({proof,nowMs});
  if(!bucket?.get||!bucket?.put)fail('HOLD_QA_R2_BUCKET_ADAPTER');
  const existing=await Promise.all([bucket.get(plan.baseKey),bucket.get(plan.headKey)]);
  if(existing.some(Boolean))fail('HOLD_QA_R2_PILOT_PREFIX_NOT_EMPTY');
  const base=await bucket.put(plan.baseKey,JSON.stringify(plan.base),{
    onlyIf:{etagDoesNotMatch:'*'},customMetadata:{uid:plan.uid,kind:'musicNote'}});
  if(!base?.etag)fail('HOLD_QA_R2_BASE_CREATE_UNCONFIRMED');
  const head=await bucket.put(plan.headKey,JSON.stringify(plan.head),{
    onlyIf:{etagDoesNotMatch:'*'},
    customMetadata:{uid:plan.uid,kind:'musicNote',baseRevision:'1',
      revision:'1',itemCount:'0',deltaCount:'0',authority:'server'},
  });
  if(!head?.etag)fail('HOLD_QA_R2_HEAD_CREATE_UNCONFIRMED');
  return {code:'QA518_EMPTY_R2_SEEDED',headKey:plan.headKey,baseKey:plan.baseKey};
}
// After the exact temp Worker is verified absent AND pilot-scoped D1 rows
// are confirmed removed, only these two names can be deleted.
// Cloudflare R2 deletes have no CAS; never call while a writer might be active.
export async function cleanupQaR2518({proof,bucket,inspect,nowMs=Date.now()}={}){
  const plan=qaBootstrapPlan518({proof,nowMs});
  if(!bucket?.get||!bucket?.delete||typeof inspect!=='function')
    fail('HOLD_QA_CLEANUP_ADAPTER');
  const state=await inspect();
  if(state?.originalWorkerVersion!==QA518.originalVersion
    ||state?.tempWorkerAbsent!==true||state?.pilotD1Rows!==0
    ||state?.otherQaR2Writers!==0)
    fail('HOLD_QA_CLEANUP_WRITER_OR_D1_UNCONFIRMED');
  const head=await bucket.get(plan.headKey);
  const base=await bucket.get(plan.baseKey);
  for(const item of [head,base]){
    if(item&& (item.customMetadata?.uid!==plan.uid
      ||item.customMetadata?.kind!=='musicNote'))
      fail('HOLD_QA_R2_FOREIGN_OBJECT_NO_DELETE');
  }
  if(head)await bucket.delete(plan.headKey);
  if(base)await bucket.delete(plan.baseKey);
  if(await bucket.get(plan.headKey)||await bucket.get(plan.baseKey))
    fail('HOLD_QA_R2_CLEANUP_NOT_CONFIRMED');
  return {code:'QA518_ONLY_TWO_PILOT_KEYS_REMOVED',keysChecked:2};
}
export function createQaMeter518(proof,{now=Date.now}={}){
  assertQaProof518(proof,now());
  const counts=Object.fromEntries(Object.keys(QA518_LIMITS)
    .filter(x=>x!=='runtimeMs').map(x=>[x,0]));
  const started=now();
  return Object.freeze({
    reserve(category,count=1){
      assertQaProof518(proof,now());
      if(now()-started>QA518_LIMITS.runtimeMs)
        fail('HOLD_QA_WALL_CLOCK_BUDGET_EXCEEDED');
      if(!(category in counts)||!Number.isSafeInteger(count)||count<1
        ||counts[category]+count>QA518_LIMITS[category])
        fail('HOLD_QA_OPERATION_BUDGET_EXCEEDED');
      counts[category]+=count; // failed attempts still spend budget
      return counts[category];
    },
    snapshot(){return Object.freeze({...counts});},
  });
}
// This is the ONLY source-only bridge from an independently checked
// signed QA proof to PR #528's in-memory trusted factory. Does NOT deploy,
// install triggers, or activate its default (intentionally OFF) Worker export.
// The caller must stage the exact candidate SHA and pass its factory explicitly.
export function buildAttestedQa518Handler({
  proof,nowMs=Date.now(),candidateFactory,env,sourceFetcher,clock,
}={}){
  assertQaProof518(proof,nowMs);
  if(typeof candidateFactory!=='function'||typeof sourceFetcher!=='function'
    ||typeof clock!=='function'
    ||env?.FIREBASE_PROJECT_ID!==QA518.firebaseProject
    ||env?.FIREBASE_PROJECT_NUMBER!==QA518.firebaseNumber
    ||env?.SORIDRAW_APP518_QA_ACCOUNT_ID_518!==QA518.accountId
    ||env?.SORIDRAW_APP518_PILOT_UID!==proof.pilot.uid
    ||env?.SORIDRAW_APP518_PILOT_FAVORITE_ID!==proof.pilot.documentId
    ||env?.SORIDRAW_APP518_QA_RELEASE_518!=='APPROVED_ISOLATED_ONE_SONG'
    ||env?.SORIDRAW_CANONICAL_CATALOG_518!=='ENABLED_AFTER_SHARED_ROLLOUT'
    ||env?.SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518!=='VERIFIED'
    ||env?.SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518!=='VERIFIED')
    fail('HOLD_QA_ATTESTED_HANDLER_SCOPE');
  // Signed independent inventory proves there are no other D1 writers in
  // this isolated account. These flags must NOT be used for shared accounts.
  return candidateFactory({env,trustedIsolatedQaProof:true,sourceFetcher,clock});
}
