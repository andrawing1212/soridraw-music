// app518 DORMANT signed independent 3-Worker cutover evidence gate.
// READ-ONLY: Cloudflare deployments/settings and GET /health. No release,
// database, bucket or user mutation. Missing independent proof => HOLD.
// Independent auditor must provide a fresh 10-minute two-snapshot attestation,
// audited immutable versions, guarded rollback versions and old-flight proof.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createPublicKey,verify,generateKeyPairSync,sign} from 'node:crypto';
import {captureMediaWriterSnapshot518} from './verify-518-live-media-writer-readonly.mjs';
import {assessSharedWriterCutover518,MEDIA_TARGETS_518}
 from '../cloudflare/media-worker/src/catalogSharedWriterRolloutGate518.js';

const SHA=/^[a-f0-9]{40}$/;
const id=/^[a-f0-9-]{36}$/i;
const fail=code=>{throw Error(code);};
const digest=s=>createHash('sha256').update(s).digest('hex');
const proofRef=x=>typeof x==='string'&&x.trim().length>=12&&x.length<=240;
const rollbackHold=code=>({pass:false,code});
// This validates REAL Cloudflare GET responses after rollback; no health
// marker or single-version label alone may assert full rollback safety.
export const verifyRollbackState518=({stage,approvedVersion,settings,deployments,health}={})=>{
 const stageKey=typeof stage==='string'?stage.toLowerCase():'';
 const t=MEDIA_TARGETS_518.find(x=>x.stage===stageKey);
 if(!t||!id.test(approvedVersion))return rollbackHold('HOLD_ROLLBACK_TARGET_INVALID');
 if(settings?.success!==true||deployments?.success!==true||!Array.isArray(settings.result?.bindings))
  return rollbackHold('HOLD_ROLLBACK_CONTROL_PLANE_UNVERIFIED');
 const rows=settings.result.bindings;
 const exactly=(name,type)=>{
  const hits=rows.filter(x=>x?.name===name);
  return hits.length===1&&hits[0].type===type?hits[0]:null;
 };
 const media=exactly('MEDIA','r2_bucket'),catalog=exactly('CATALOG','r2_bucket'),shared=exactly('SORIDRAW_SHARED_CATALOG_V1','plain_text');
 if(!media||!catalog||!shared||rows.some(x=>x?.name==='SORIDRAW_CANONICAL_CATALOG_518'))
  return rollbackHold('HOLD_ROLLBACK_BINDINGS_AMBIGUOUS_OR_CANONICAL');
 if((media.bucket_name??media.bucket)!==t.media||(catalog.bucket_name??catalog.bucket)!=='soridraw-user-catalog'
  ||(shared.text??shared.value)!=='1')
  return rollbackHold('HOLD_ROLLBACK_R2_OR_SHARED_FLAG_MISMATCH');
 const active=deployments.result?.deployments?.[0]?.versions;
 if(!Array.isArray(active)||active.length!==1||active[0]?.version_id!==approvedVersion
  ||Number(active[0]?.percentage)!==100)
  return rollbackHold('HOLD_ROLLBACK_VERSION_OR_TRAFFIC_MISMATCH');
 const fence=health?.catalogWriterFence518;
 if(health?.ok!==true||health?.r2Binding!==true||health?.catalogBinding!==true
  ||health?.catalogAuthorityMode!=='shared-catalog'
  ||fence?.fenceContract!=='app518-music-note-fence-v1'
  ||fence?.sourceInstalled!==true||fence?.canonicalEnabled!==false)
  return rollbackHold('HOLD_ROLLBACK_HEALTH_OR_FENCE_MISMATCH');
 return {pass:true,code:'APP518_ROLLBACK_FULL_CONTRACT_PASS'};
};
const sameWorker=(actual,signed)=>{
 const keys=['stage','script','mediaBucket','catalogBucket','sharedFlag','canonicalFlag'];
 return keys.every(k=>actual?.[k]===signed?.[k])
  &&JSON.stringify(actual?.activeVersions)===JSON.stringify(signed?.activeVersions)
  &&JSON.stringify(actual?.health)===JSON.stringify(signed?.health);
};

// Signature is over the raw, separately audited JSON payload string. The
// trusted auditor key's SHA-256 fingerprint must be pinned externally to this
// release controller; an arbitrary self-proclaimed auditor is never enough.
export const verifySignedCutoverEvidence518=({
 signed,publicKeyPem,pinnedKeySha256,releaseSha,nowMs,current,
}={})=>{
 if(!SHA.test(String(releaseSha||''))||!Number.isSafeInteger(nowMs)||nowMs<=0)
  return {pass:false,code:'HOLD_CUTOVER_BAD_RELEASE_ID'};
 if(!publicKeyPem||!signed||!pinnedKeySha256
  ||!/^[0-9a-f]{64}$/.test(pinnedKeySha256))
  return {pass:false,code:'HOLD_INDEPENDENT_CUTOVER_AUDIT_MISSING'};
 const keyHash=digest(publicKeyPem);
 if(keyHash!==pinnedKeySha256)
  return {pass:false,code:'HOLD_INDEPENDENT_AUDITOR_KEY_UNPINNED'};
 let payload;
 try{
  if(typeof signed.payload!=='string'||typeof signed.signature!=='string'
   ||!/^[-A-Za-z0-9+/=]+$/.test(signed.signature))throw Error('bad');
  const key=createPublicKey(publicKeyPem);
  if(!verify(null,Buffer.from(signed.payload),key,Buffer.from(signed.signature,'base64')))
   throw Error('not signed');
  payload=JSON.parse(signed.payload);
 }catch{return {pass:false,code:'HOLD_INDEPENDENT_CUTOVER_SIGNATURE_INVALID'};}
 if(payload?.releaseSha!==releaseSha
  ||payload?.purpose!=='APP518_THREE_MEDIA_FENCED_CUTOVER'
  ||!Array.isArray(payload.snapshots)||payload.snapshots.length!==2)
  return {pass:false,code:'HOLD_INDEPENDENT_CUTOVER_RELEASE_DRIFT'};
 // No trust inferred from the current GET: the signer's independent proof
 // must cover immutable IDs, drained flights, and safe rollback versions.
 const result=assessSharedWriterCutover518({
  snapshots:payload.snapshots,
  approvedVersions:payload.approvedVersions,
  rollbackVersions:payload.rollbackVersions,
  retiredOldFlights:payload.retiredOldFlights,nowMs,
 });
 if(!result.pass)return result;
 // The retired pre-fence Worker must be a different, specifically audited
 // immutable Cloudflare version, not the new fenced version whose traffic is
 // already 100%. The independent signer MUST inspect real deployment history
 // and request logs; text or 10-minute health polling alone is not proof.
 const predecessors=payload.predecessorWriters518;
 if(!Array.isArray(predecessors)||predecessors.length!==3
  ||!Array.isArray(payload.retiredOldFlights)||payload.retiredOldFlights.length!==3)
  return {pass:false,code:'HOLD_PREDECESSOR_VERSION_AUDIT_MISSING'};
 const beforeMs=payload.snapshots[0]?.atMs,afterMs=payload.snapshots[1]?.atMs;
 for(const t of MEDIA_TARGETS_518){
  const records=predecessors.filter(x=>x?.stage===t.stage);
  const flights=payload.retiredOldFlights.filter(x=>x?.stage===t.stage);
  if(records.length!==1||flights.length!==1)
   return {pass:false,code:'HOLD_PREDECESSOR_STAGE_AMBIGUOUS_'+t.stage.toUpperCase()};
  const old=records[0],flight=flights[0],newVersion=payload.approvedVersions?.[t.stage];
  if(old.script!==t.script||!id.test(old.versionId)||!id.test(newVersion)
   ||old.versionId===newVersion||old.replacedByVersionId!==newVersion
   ||old.source!=='INDEPENDENT_CLOUDFLARE_DEPLOYMENT_AUDIT'
   ||!proofRef(old.deploymentEvidenceRef)
   ||!Number.isSafeInteger(old.replacedAtMs)||old.replacedAtMs<=0
   ||old.replacedAtMs>beforeMs)
   return {pass:false,code:'HOLD_PREDECESSOR_VERSION_UNBOUND_'+t.stage.toUpperCase()};
  if(flight.retiredVersionId!==old.versionId||flight.versionId!==newVersion
   ||flight.replacedByVersionId!==newVersion
   ||flight.verificationMethod!=='INDEPENDENT_REQUEST_DRAIN_AUDIT'
   ||!proofRef(flight.requestDrainEvidenceRef)
   ||!Number.isSafeInteger(flight.drainedAtMs)
   ||flight.drainedAtMs<beforeMs||flight.drainedAtMs>flight.checkedAtMs
   ||flight.checkedAtMs<beforeMs+600000||flight.checkedAtMs>afterMs)
   return {pass:false,code:'HOLD_OLD_INFLIGHT_VERSION_UNBOUND_'+t.stage.toUpperCase()};
 }
 if(!Array.isArray(current?.workers)||current.workers.length!==3)
  return {pass:false,code:'HOLD_CUTOVER_CURRENT_LIVE_MISSING'};
 for(const target of MEDIA_TARGETS_518){
  const audited=payload.snapshots[1].workers.find(w=>w.stage===target.stage);
  const live=current.workers.find(w=>w.stage===target.stage);
  if(!sameWorker(live,audited)||!id.test(payload.approvedVersions?.[target.stage])
    ||payload.rollbackVersions?.[target.stage]!==payload.approvedVersions[target.stage])
   return {pass:false,code:'HOLD_CUTOVER_LIVE_DRIFT_'+target.stage.toUpperCase()};
 }
 return {pass:true,code:'SIGNED_THREE_WORKER_PREFLIGHT_PASS',
  versions:payload.approvedVersions};
};

const test=()=>{
 const releaseSha='a'.repeat(40);
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const pem=publicKey.export({format:'pem',type:'spki'}).toString();
 const keyHash=digest(pem);
 const nowMs=1800000700000;
 const approvedVersions=Object.fromEntries(MEDIA_TARGETS_518.map((x,i)=>[
  x.stage,String(i+1).repeat(8)+'-'+String(i+1).repeat(4)
   +'-4'+String(i+1).repeat(3)+'-8'+String(i+1).repeat(3)
   +'-'+String(i+1).repeat(12)]));
 const makeWorker=x=>({stage:x.stage,script:x.script,mediaBucket:x.media,
  catalogBucket:'soridraw-user-catalog',sharedFlag:'1',canonicalFlag:null,
  activeVersions:[{versionId:approvedVersions[x.stage],percentage:100}],
  health:{fenceContract:'app518-music-note-fence-v1',sourceInstalled:true,canonicalEnabled:false}});
 const before=nowMs-610000,after=nowMs-10000;
 const payload=()=>({purpose:'APP518_THREE_MEDIA_FENCED_CUTOVER',releaseSha,
  snapshots:[{atMs:before,workers:MEDIA_TARGETS_518.map(makeWorker)},
   {atMs:after,workers:MEDIA_TARGETS_518.map(makeWorker)}],
  approvedVersions,rollbackVersions:{...approvedVersions},
  predecessorWriters518:MEDIA_TARGETS_518.map((x,i)=>({
   stage:x.stage,script:x.script,
   versionId:String(i+4).repeat(8)+'-'+String(i+4).repeat(4)+'-4'+String(i+4).repeat(3)+'-8'+String(i+4).repeat(3)+'-'+String(i+4).repeat(12),
   replacedByVersionId:approvedVersions[x.stage],replacedAtMs:before-30000,
   source:'INDEPENDENT_CLOUDFLARE_DEPLOYMENT_AUDIT',deploymentEvidenceRef:'cloudflare-deployment-audit/'+x.stage,
  })),
  retiredOldFlights:MEDIA_TARGETS_518.map((x,i)=>({stage:x.stage,
   versionId:approvedVersions[x.stage],replacedByVersionId:approvedVersions[x.stage],
   retiredVersionId:String(i+4).repeat(8)+'-'+String(i+4).repeat(4)+'-4'+String(i+4).repeat(3)+'-8'+String(i+4).repeat(3)+'-'+String(i+4).repeat(12),
   source:'INDEPENDENT_RELEASE_AUDIT',outcome:'VERIFIED',
   verificationMethod:'INDEPENDENT_REQUEST_DRAIN_AUDIT',requestDrainEvidenceRef:'request-log-audit/'+x.stage,
   drainedAtMs:before+599000,checkedAtMs:before+600000}))});
 const seal=p=>{const data=JSON.stringify(p);return {
  payload:data,signature:sign(null,Buffer.from(data),privateKey).toString('base64')}};
 const current={workers:MEDIA_TARGETS_518.map(makeWorker)};
 const go=(p=payload(),over={})=>verifySignedCutoverEvidence518({
  signed:seal(p),publicKeyPem:pem,pinnedKeySha256:keyHash,releaseSha,nowMs,current,...over});
 assert.equal(go().pass,true);
 assert.equal(go(payload(),{pinnedKeySha256:'0'.repeat(64)}).pass,false);
 assert.equal(go(payload(),{signed:{...seal(payload()),signature:'AAAA'}}).pass,false);
 assert.equal(go(payload(),{signed:null}).pass,false);
 let p=payload();p.snapshots[0].atMs=after-599999;
 assert.match(go(p).code,/HOLD_OLD_WORKER_DRAIN_WINDOW/);
 p=payload();p.retiredOldFlights=[];
 assert.equal(go(p).code,'HOLD_OLD_INFLIGHT_UNVERIFIED');
 p=payload();delete p.predecessorWriters518;
 assert.match(go(p).code,/HOLD_PREDECESSOR_VERSION_AUDIT_MISSING/);
 p=payload();p.predecessorWriters518[0].versionId=approvedVersions.preview;
 assert.match(go(p).code,/HOLD_PREDECESSOR_VERSION_UNBOUND_PREVIEW/);
 p=payload();p.predecessorWriters518[0].versionId=p.predecessorWriters518[1].versionId;
 assert.match(go(p).code,/HOLD_OLD_INFLIGHT_VERSION_UNBOUND_PREVIEW/);
 p=payload();p.retiredOldFlights[1].retiredVersionId=p.predecessorWriters518[0].versionId;
 assert.match(go(p).code,/HOLD_OLD_INFLIGHT_VERSION_UNBOUND_TEST/);
 p=payload();p.retiredOldFlights[2].requestDrainEvidenceRef='';
 assert.match(go(p).code,/HOLD_OLD_INFLIGHT_VERSION_UNBOUND_PRODUCTION/);
 p=payload();p.retiredOldFlights[0].drainedAtMs=before-1;
 assert.match(go(p).code,/HOLD_OLD_INFLIGHT_VERSION_UNBOUND_PREVIEW/);
 p=payload();p.retiredOldFlights[0].checkedAtMs=before+599999;
 assert.match(go(p).code,/HOLD_OLD_INFLIGHT_VERSION_UNBOUND_PREVIEW/);
 p=payload();p.predecessorWriters518[1].replacedAtMs=after;
 assert.match(go(p).code,/HOLD_PREDECESSOR_VERSION_UNBOUND_TEST/);
 p=payload();p.rollbackVersions.preview='f'.repeat(8)+'-ffff-4fff-8fff-ffffffffffff';
 assert.match(go(p).code,/HOLD_UNFENCED_ROLLBACK/);
 p=payload();p.snapshots[1].workers[2].activeVersions[0].versionId='ffffffff-ffff-4fff-8fff-ffffffffffff';
 assert.match(go(p).code,/HOLD_LEGACY_WRITER/);
 const drift=structuredClone(current);
 drift.workers[1].sharedFlag='0';
 assert.match(go(payload(),{current:drift}).code,/HOLD_CUTOVER_LIVE_DRIFT/);
 const changed=structuredClone(current);
 changed.workers[0].health.canonicalEnabled=true;
 assert.match(go(payload(),{current:changed}).code,/HOLD_CUTOVER_LIVE_DRIFT/);
 assert.match(go(payload(),{releaseSha:'b'.repeat(40)}).code,/HOLD_INDEPENDENT_CUTOVER_RELEASE_DRIFT/);
 console.log('APP518_SIGNED_INDEPENDENT_THREE_WORKER_CUTOVER_PREFLIGHT=PASS');
 const rbStage='test',rbVersion=approvedVersions[rbStage];
 const goodRollback=()=>({stage:rbStage,approvedVersion:rbVersion,
  settings:{success:true,result:{bindings:[
   {name:'MEDIA',type:'r2_bucket',bucket_name:'soridraw-media-test'},
   {name:'CATALOG',type:'r2_bucket',bucket_name:'soridraw-user-catalog'},
   {name:'SORIDRAW_SHARED_CATALOG_V1',type:'plain_text',text:'1'},
  ]}},deployments:{success:true,result:{deployments:[{versions:[
   {version_id:rbVersion,percentage:100},
  ]}]}},health:{ok:true,r2Binding:true,catalogBinding:true,
   catalogAuthorityMode:'shared-catalog',catalogWriterFence518:{
    fenceContract:'app518-music-note-fence-v1',sourceInstalled:true,canonicalEnabled:false}}});
 const checkRollback=fn=>{const r=goodRollback();fn(r);assert.equal(verifyRollbackState518(r).pass,false);};
 assert.equal(verifyRollbackState518(goodRollback()).pass,true);
 for(const upper of ['PREVIEW','TEST','PRODUCTION']){
  const rollback=goodRollback();
  rollback.stage=upper;
  const target=MEDIA_TARGETS_518.find(x=>x.stage===upper.toLowerCase());
  rollback.approvedVersion=approvedVersions[target.stage];
  rollback.settings.result.bindings[0].bucket_name=target.media;
  rollback.deployments.result.deployments[0].versions[0].version_id=rollback.approvedVersion;
  assert.equal(verifyRollbackState518(rollback).pass,true);
 }
 checkRollback(r=>{r.settings.result.bindings[0].bucket_name='other';});
 checkRollback(r=>{r.settings.result.bindings[1].bucket_name='wrong';});
 checkRollback(r=>{r.settings.result.bindings[2].text='0';});
 checkRollback(r=>{r.settings.result.bindings.push({...r.settings.result.bindings[1]});});
 checkRollback(r=>{r.settings.result.bindings.push({name:'SORIDRAW_CANONICAL_CATALOG_518',type:'secret_text'});});
 checkRollback(r=>{r.deployments.result.deployments[0].versions[0].percentage=99.9;});
 checkRollback(r=>{r.deployments.result.deployments[0].versions.push({version_id:'f'.repeat(8)+'-ffff-4fff-8fff-ffffffffffff',percentage:0});});
 checkRollback(r=>{r.health.catalogWriterFence518.sourceInstalled=false;});
 checkRollback(r=>{r.health.catalogWriterFence518.canonicalEnabled=true;});
 checkRollback(r=>{r.health.catalogWriterFence518.fenceContract='unverified';});
 checkRollback(r=>{r.health.catalogAuthorityMode='legacy-media';});
 checkRollback(r=>{r.health.catalogBinding=false;});
 const workflow=readFileSync(new URL('../.github/workflows/cloudflare-media-shared-catalog-cutover.yml',import.meta.url),'utf8');
 assert.match(workflow,/verify-518-cutover-signed-evidence\.mjs --rollback-check "\$stage" "\$expected_version"/);
 assert.match(workflow,/--argjson settings "\$settings" --argjson deployments "\$deployments" --argjson health "\$health"/);
 for(const [worker,stage] of [['soridraw-media-preview','PREVIEW'],['soridraw-media-test','TEST'],['soridraw-media','PRODUCTION']]){
  assert.ok(workflow.includes('check_legacy '+worker+' https://'+worker+'.andrawing1212.workers.dev '+stage));
 }
 console.log('APP518_OLD_PREDECESSOR_VERSION_BOUND_TO_DRAIN_PROOF=PASS');
 console.log('APP518_ROLLBACK_BINDINGS_R2_CANONICAL_FULL_FENCE_DENY=PASS');
 console.log('APP518_CUTOVER_10MIN_OLD_FLIGHTS_ROLLBACK_AND_LIVE_DRIFT_DENY=PASS');
};
if(process.argv.includes('--self-test'))test();
else if(process.argv.includes('--rollback-check')){
 let result;
 try{
  const input=JSON.parse(readFileSync(0,'utf8'));
  result=verifyRollbackState518({...input,stage:process.argv[3],approvedVersion:process.argv[4]});
 }catch{result=rollbackHold('HOLD_ROLLBACK_CONTROL_PLANE_UNVERIFIED');}
 console.log(result.code);
 if(!result.pass)process.exitCode=2;
}else if(process.argv.includes('--live')){
 const releaseSha=process.env.APP518_RELEASE_SHA_518;
 const publicKeyPem=process.env.APP518_AUDITOR_PUBLIC_KEY_PEM_518;
 const pinnedKeySha256=process.env.APP518_AUDITOR_KEY_SHA256_518;
 const raw=process.env.APP518_SIGNED_AUDIT_REPORT_JSON_518;
 // Fail before even requesting live API unless independently signed
 // evidence and a separately pinned auditor key are available.
 if(!raw||!publicKeyPem||!pinnedKeySha256)
  fail('HOLD_INDEPENDENT_CUTOVER_AUDIT_MISSING');
 let signed;
 try{signed=JSON.parse(raw)}catch{fail('HOLD_INDEPENDENT_CUTOVER_AUDIT_MALFORMED');}
 const current=await captureMediaWriterSnapshot518({
  request:fetch,accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
  token:process.env.CLOUDFLARE_API_TOKEN,atMs:Date.now(),
 });
 const answer=verifySignedCutoverEvidence518({
  signed,publicKeyPem,pinnedKeySha256,releaseSha,nowMs:Date.now(),current,
 });
 if(!answer.pass)fail(answer.code);
 // Only nonsecret exact version IDs cross into subsequent guarded steps.
 for(const target of MEDIA_TARGETS_518){
  const name=target.stage.toUpperCase();
  process.stdout.write(name+'_AUDITED_BEFORE='+answer.versions[target.stage]+'\n');
 }
 console.log('APP518_CUTOVER_THREE_WORKER_SIGNED_PROOF_LIVE=PASS');
}else if(import.meta.url===new URL('file:'+process.argv[1]).href){
 console.error('Use --self-test or --live');
 process.exitCode=2;
}
