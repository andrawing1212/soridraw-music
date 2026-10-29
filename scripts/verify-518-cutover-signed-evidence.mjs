// app518 DORMANT signed independent 3-Worker cutover evidence gate.
// READ-ONLY: Cloudflare deployments/settings and GET /health. No release,
// database, bucket or user mutation. Missing independent proof => HOLD.
// Independent auditor must provide a fresh 10-minute two-snapshot attestation,
// audited immutable versions, guarded rollback versions and old-flight proof.
import assert from 'node:assert/strict';
import {createHash,createPublicKey,verify,generateKeyPairSync,sign} from 'node:crypto';
import {captureMediaWriterSnapshot518} from './verify-518-live-media-writer-readonly.mjs';
import {assessSharedWriterCutover518,MEDIA_TARGETS_518}
 from '../cloudflare/media-worker/src/catalogSharedWriterRolloutGate518.js';

const SHA=/^[a-f0-9]{40}$/;
const id=/^[a-f0-9-]{36}$/i;
const fail=code=>{throw Error(code);};
const digest=s=>createHash('sha256').update(s).digest('hex');
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
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
  retiredOldFlights:MEDIA_TARGETS_518.map(x=>({stage:x.stage,
   versionId:approvedVersions[x.stage],source:'INDEPENDENT_RELEASE_AUDIT',
   outcome:'VERIFIED',checkedAtMs:before+600000}))});
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
 console.log('APP518_CUTOVER_10MIN_OLD_FLIGHTS_ROLLBACK_AND_LIVE_DRIFT_DENY=PASS');
};
if(process.argv.includes('--self-test'))test();
else if(process.argv.includes('--live')){
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
