// app518 SOURCE ONLY. Independent, signed, immutable account-wide D1
// writer-coverage preflight. No Cloudflare mutation/API calls or user data.
// A successful signature NEVER substitutes for current live version/binding
// inspection. Legacy migration-inspect must actually lose SOURCE_DB first.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createPublicKey,verify,generateKeyPairSync,sign} from 'node:crypto';

const NAMES=Object.freeze([
 'soridraw-explore-api','soridraw-explore-preview',
 'soridraw-explore-test','soridraw-explore-migration-inspect',
 'soridraw-media','soridraw-media-preview','soridraw-media-test',
]);
const MIGRATION='soridraw-explore-migration-inspect';
const SHARED_DB='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const RATE_PREVIEW='aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f';
const RATE_TEST='31817dbd-d06e-415e-9bc0-5553b0f5dc43';
const KNOWN_DBS=new Set([SHARED_DB,RATE_PREVIEW,RATE_TEST]);
const sha64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const sha40=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const deny=code=>({pass:false,code});
const digest=s=>createHash('sha256').update(s).digest('hex');
const fresh=(t,now)=>Number.isSafeInteger(t)&&t>0&&t<=now&&now-t<=120000;
const ref=x=>typeof x==='string'&&x.length>=15&&x.length<=240;
export const assessAccountD1Cutover518=({
 signed,publicKeyPem,pinnedPublicKeySha256,releaseSha,live,nowMs,
}={})=>{
 if(!sha40(releaseSha)||!Number.isSafeInteger(nowMs)||nowMs<=0)
  return deny('HOLD_518_BAD_RELEASE_ID');
 if(!publicKeyPem||!sha64(pinnedPublicKeySha256)
   ||digest(publicKeyPem)!==pinnedPublicKeySha256)
  return deny('HOLD_518_UNPINNED_INDEPENDENT_AUDITOR');
 let evidence;
 try{
  if(typeof signed?.payload!=='string'||typeof signed?.signature!=='string'
   ||signed.payload.length>60000||!/^[A-Za-z0-9+/]+={0,2}$/.test(signed.signature))
   throw Error('INVALID_SIGNATURE');
  const key=createPublicKey(publicKeyPem);
  if(!verify(null,Buffer.from(signed.payload),key,Buffer.from(signed.signature,'base64')))
   throw Error('INVALID_SIGNATURE');
  evidence=JSON.parse(signed.payload);
 }catch{return deny('HOLD_518_SIGNED_ACCOUNT_EVIDENCE_INVALID');}
 if(evidence?.purpose!=='APP518_ACCOUNT_D1_ALL_WRITER_CUTOVER'
  ||evidence?.releaseSha!==releaseSha||!fresh(evidence?.checkedAtMs,nowMs))
  return deny('HOLD_518_ACCOUNT_PROOF_EXPIRED_OR_WRONG_RELEASE');
 // Not just Worker binding metadata: external direct Cloudflare D1 API calls
 // bypass Worker code. A separately scoped token/account-permissions audit MUST
 // show all D1-Edit credentials removed or disabled during protected operation.
 const external=evidence.externalD1Access;
 if(external?.source!=='INDEPENDENT_CLOUDFLARE_ACCOUNT_AND_USER_TOKEN_AUDIT'
  ||external?.accountTokensEnumerated!==true
  ||external?.userTokensEnumerated!==true
  ||external?.serviceAccountsEnumerated!==true
  ||external?.allDirectD1EditGrantsDisabled!==true
  ||external?.unmanagedExternalWriters===0!==true
  ||!fresh(external?.checkedAtMs,nowMs)||!ref(external?.evidenceRef))
  return deny('HOLD_518_EXTERNAL_D1_API_WRITER_NOT_REVOKED');
 if(!Array.isArray(live?.workers)||live.workers.length!==NAMES.length
  ||!Array.isArray(evidence?.workers)||evidence.workers.length!==NAMES.length)
  return deny('HOLD_518_ACCOUNT_WORKER_INVENTORY_INCOMPLETE');
 if(live.workers.some(x=>!NAMES.includes(x.name))
  ||evidence.workers.some(x=>!NAMES.includes(x.name))
  ||new Set(live.workers.map(x=>x.name)).size!==NAMES.length
  ||new Set(evidence.workers.map(x=>x.name)).size!==NAMES.length)
  return deny('HOLD_518_UNKNOWN_OR_DUPLICATE_WORKER');
 if(evidence.ledger?.dbId!==SHARED_DB
  ||evidence.ledger?.table!=='music_note_catalog_daily_budget_518'
  ||evidence.ledger?.atomicReservationVerified!==true
  ||!ref(evidence.ledger?.schemaEvidenceRef))
  return deny('HOLD_518_SHARED_LEDGER_NOT_PROVEN');
 // Future app518 outbox may be a new, independent D1 database. Do not hardcode
 // an impossible three-DB maximum; require EVERY additional UUID in the
 // independently signed inventory and compare with live account enumeration.
 const additions=evidence.additionalD1Databases??[];
 if(!Array.isArray(additions)||additions.length>4
  ||additions.some(d=>!uuid(d?.id)||KNOWN_DBS.has(d.id)||!ref(d?.schemaEvidenceRef))
  ||new Set(additions.map(d=>d.id)).size!==additions.length)
  return deny('HOLD_518_EXTRA_D1_DATABASES_UNATTESTED');
 const allowedDbIds=new Set([...KNOWN_DBS,...additions.map(x=>x.id)]);
 const expectedDbIds=new Set(live.databaseIds||[]);
 if(expectedDbIds.size!==allowedDbIds.size
  ||[...expectedDbIds].some(id=>!allowedDbIds.has(id)))
  return deny('HOLD_518_ACCOUNT_D1_DATABASE_INVENTORY_CHANGED');
 for(const name of NAMES){
  const current=live.workers.find(x=>x.name===name);
  const audited=evidence.workers.find(x=>x.name===name);
  const active=current?.active;
  if(!Array.isArray(active)||active.length!==1
   ||!uuid(active[0]?.versionId)||Number(active[0]?.trafficPercent)!==100
   ||audited?.activeVersionId!==active[0].versionId
   ||!sha64(current?.codeSha256)
   ||audited?.bundleSha256!==current.codeSha256
   ||!sha64(audited?.bundleSha256)
   ||!ref(audited?.sourceAuditRef)||!ref(audited?.drainedOldFlightsRef)
   ||!uuid(audited?.rollbackVersionId)
   ||audited.rollbackVersionId!==audited.activeVersionId
   ||audited?.rollbackBudgetAware!==true)
   return deny('HOLD_518_LEGACY_VERSION_OR_ROLLBACK_UNVERIFIED_'+name);
  const d1=current?.d1Bindings;
  if(!Array.isArray(d1)||d1.some(b=>!allowedDbIds.has(b.databaseId))
   ||new Set(d1.map(b=>b.binding)).size!==d1.length)
   return deny('HOLD_518_D1_BINDINGS_UNKNOWN_'+name);
  if(name===MIGRATION){
   // A read-only JS source is not enough while SOURCE_DB remains writable.
   if(d1.length||current?.indirectBindings?.length
    ||audited?.state!=='RETIRED_NO_D1_BINDING'
    ||audited?.budgetAware!==false)
    return deny('HOLD_518_MIGRATION_INSPECT_SOURCE_DB_STILL_BOUND');
  }else{
   if(audited?.budgetAware!==true
    ||audited?.accountLedgerDbId!==SHARED_DB
    ||audited?.sourceApprovedAfterIndependentAudit!==true)
    return deny('HOLD_518_LEGACY_WRITER_NOT_ON_SHARED_LEDGER_'+name);
  }
  const approvedD1=audited?.d1Bindings;
  if(!Array.isArray(approvedD1)
    ||JSON.stringify([...approvedD1].sort((a,b)=>a.binding.localeCompare(b.binding)))!==
       JSON.stringify([...d1].sort((a,b)=>a.binding.localeCompare(b.binding))))
   return deny('HOLD_518_D1_BINDING_VERSION_DRIFT_'+name);
 }
 // No env flag (even VERIFIED) can override a missing live snapshot/signature.
 return {pass:true,code:'ACCOUNT_D1_SIGNED_COVERAGE_PREFLIGHT_PASS',
  canEnableCanonical:false,require:'EXPLICIT_DIRECTOR_DEPLOY_AND_INDEPENDENT_RELEASE_APPROVAL'};
};

const selfTest=()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const pem=publicKey.export({format:'pem',type:'spki'}).toString();
 const releaseSha='a'.repeat(40),nowMs=1793400000000;
 const versions=NAMES.map((_,i)=>String(i+1).repeat(8)+'-'+String(i+1).repeat(4)+'-4'+String(i+1).repeat(3)+'-8'+String(i+1).repeat(3)+'-'+String(i+1).repeat(12));
 const ids={ 'soridraw-explore-api':[{binding:'DB',databaseId:SHARED_DB}],
  'soridraw-explore-preview':[{binding:'DB',databaseId:SHARED_DB},{binding:'RATE_DB',databaseId:RATE_PREVIEW}],
  'soridraw-explore-test':[{binding:'DB',databaseId:SHARED_DB},{binding:'RATE_DB',databaseId:RATE_TEST}]};
 const live={databaseIds:[...KNOWN_DBS],workers:NAMES.map((name,i)=>({
  name,active:[{versionId:versions[i],trafficPercent:100}],
  codeSha256:'b'.repeat(64),
  d1Bindings:ids[name]||[],indirectBindings:[],
 }))};
 const evidence={purpose:'APP518_ACCOUNT_D1_ALL_WRITER_CUTOVER',releaseSha,
  checkedAtMs:nowMs-1200,
  ledger:{dbId:SHARED_DB,table:'music_note_catalog_daily_budget_518',
   atomicReservationVerified:true,schemaEvidenceRef:'independent-ledger-schema-001'},
  externalD1Access:{source:'INDEPENDENT_CLOUDFLARE_ACCOUNT_AND_USER_TOKEN_AUDIT',
   checkedAtMs:nowMs-1000,accountTokensEnumerated:true,userTokensEnumerated:true,
   serviceAccountsEnumerated:true,allDirectD1EditGrantsDisabled:true,
   unmanagedExternalWriters:0,evidenceRef:'independent-token-scope-audit-001'},
  workers:live.workers.map(w=>({
   name:w.name,activeVersionId:w.active[0].versionId,
   rollbackVersionId:w.active[0].versionId,rollbackBudgetAware:true,
   bundleSha256:'b'.repeat(64),budgetAware:w.name!==MIGRATION,
   state:w.name===MIGRATION?'RETIRED_NO_D1_BINDING':'BUDGET_AWARE',
   accountLedgerDbId:SHARED_DB,sourceApprovedAfterIndependentAudit:true,
   sourceAuditRef:'independent-source-digest-evidence-001',
   drainedOldFlightsRef:'independent-old-flight-drain-001',
   d1Bindings:w.d1Bindings,
  }))};
 const signPayload=()=>{const payload=JSON.stringify(evidence);
  return {payload,signature:sign(null,Buffer.from(payload),privateKey).toString('base64')};};
 const args=()=>({signed:signPayload(),publicKeyPem:pem,
  pinnedPublicKeySha256:digest(pem),releaseSha,live,nowMs});
 const pass=assessAccountD1Cutover518(args());
 assert.equal(pass.pass,true);
 assert.equal(pass.canEnableCanonical,false);
 const fail=(label,change,expected)=>{change();const actual=assessAccountD1Cutover518(args());
  assert.equal(actual.code,expected,label);};
 fail('migration SOURCE_DB',()=>live.workers.find(w=>w.name===MIGRATION).d1Bindings=[{binding:'SOURCE_DB',databaseId:SHARED_DB}],
  'HOLD_518_MIGRATION_INSPECT_SOURCE_DB_STILL_BOUND');
 live.workers.find(w=>w.name===MIGRATION).d1Bindings=[];
 fail('untrusted token',()=>evidence.externalD1Access.allDirectD1EditGrantsDisabled=false,
  'HOLD_518_EXTERNAL_D1_API_WRITER_NOT_REVOKED');
 evidence.externalD1Access.allDirectD1EditGrantsDisabled=true;
 fail('unknown worker',()=>live.workers[6].name='unrecognized-worker',
  'HOLD_518_UNKNOWN_OR_DUPLICATE_WORKER');
 live.workers[6].name=NAMES[6];
 fail('live code SHA drift',()=>live.workers[0].codeSha256='c'.repeat(64),
  'HOLD_518_LEGACY_VERSION_OR_ROLLBACK_UNVERIFIED_'+NAMES[0]);
 live.workers[0].codeSha256='b'.repeat(64);
 fail('unfenced old rollback',()=>evidence.workers[1].rollbackBudgetAware=false,
  'HOLD_518_LEGACY_VERSION_OR_ROLLBACK_UNVERIFIED_'+NAMES[1]);
 evidence.workers[1].rollbackBudgetAware=true;
 fail('budget omission',()=>evidence.workers[0].budgetAware=false,
  'HOLD_518_LEGACY_WRITER_NOT_ON_SHARED_LEDGER_'+NAMES[0]);
 evidence.workers[0].budgetAware=true;
 const tampered=args();tampered.signed.signature='!'+tampered.signed.signature.slice(1);
 assert.equal(assessAccountD1Cutover518(tampered).pass,false);
 const missing={...args(),live:null};
 assert.equal(assessAccountD1Cutover518(missing).pass,false);
 assert.equal(assessAccountD1Cutover518({...args(),nowMs:nowMs+200000}).pass,false);
 const config=JSON.parse(readFileSync(
  'cloudflare/explore-worker/wrangler.migration-inspect-retire-518.jsonc','utf8'));
 const retired=readFileSync('cloudflare/explore-worker/migration-inspect-retire-518.mjs','utf8');
 assert.equal(config.name,MIGRATION);
 assert.equal(config.keep_vars,false);
 assert.deepEqual(config.d1_databases,[]);
 assert.deepEqual(config.r2_buckets,[]);
 assert.deepEqual(config.services,[]);
 assert.deepEqual(config.durable_objects.bindings,[]);
 assert.deepEqual(config.triggers.crons,[]);
 assert.equal(retired.includes('env.DB'),false);
 assert.equal(retired.includes('env.SOURCE_DB'),false);
 assert.equal(retired.includes('.prepare('),false);
 assert.equal(retired.includes('.batch('),false);
 assert.match(retired,/status:410/);
 console.log('APP518_MIGRATION_RETIRE_SOURCE_NO_D1_BINDING=PASS');
 console.log('APP518_MIGRATION_D1_BINDING_RETIREMENT_REQUIRED=PASS');
 console.log('APP518_EXTERNAL_D1_API_TOKENS_FAIL_CLOSED=PASS');
 console.log('APP518_ALL_SEVEN_WORKER_VERSIONS_D1_DATABASES_ROLLBACK=PASS');
 console.log('APP518_SIGNED_ACCOUNT_COVERAGE_CANNOT_AUTHORIZE_DEPLOY=PASS');
};
if(process.argv.includes('--self-test'))selfTest();
