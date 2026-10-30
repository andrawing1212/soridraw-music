// app518 READ ONLY guarded-release evidence entrypoint.
// Called by the REAL legacy Explore release controller before and after a
// director-approved protected restore. No user data or Cloudflare mutations.
// The pinned independent-auditor trust hash comes ONLY from release-operator
// protected GitHub secrets, never from a signed payload or CLI argument.
import {createHash,createPublicKey,verify} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assessAccountD1Cutover518}
 from './verify-518-account-d1-cutover.mjs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const API='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const NAMES=['soridraw-explore-api','soridraw-explore-preview',
 'soridraw-explore-test','soridraw-explore-migration-inspect',
 'soridraw-media','soridraw-media-preview','soridraw-media-test'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const deny=code=>{throw Error(code)};
const validId=id=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id||'');
const validName=name=>NAMES.includes(name);
const digestModules=data=>{
 const modules=data?.result?.modules;
 if(!Array.isArray(modules)||modules.length<1||modules.length>128)
  deny('HOLD_518_LIVE_CODE_MODULES_UNKNOWN');
 const seen=new Set(),sorted=[],hash=createHash('sha256');
 for(const m of modules){
  if(!m?.name||seen.has(m.name)||typeof m.content_base64!=='string'
   ||m.content_base64.length>24*1024*1024)
   deny('HOLD_518_LIVE_CODE_MODULE_INVALID');
  seen.add(m.name);
  const bytes=Buffer.from(m.content_base64,'base64');
  if(!bytes.length||bytes.toString('base64')!==m.content_base64)
   deny('HOLD_518_LIVE_CODE_BYTES_INVALID');
  sorted.push({name:m.name,type:m.content_type,bytes});
 }
 hash.update('soridraw-worker-version-modules-v1\0');
 for(const m of sorted.sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  hash.update(m.name+'\0'+m.type+'\0'+m.bytes.length+'\0');
  hash.update(m.bytes);hash.update('\0');
 }
 return hash.digest('hex');
};
const bindings=raw=>{
 if(!Array.isArray(raw))deny('HOLD_518_LIVE_VERSION_BINDINGS_UNKNOWN');
 const d1=raw.filter(x=>x?.type==='d1').map(x=>({
  binding:x.name,databaseId:x.database_id,
 }));
 if(d1.some(x=>!x.binding||!validId(x.databaseId)))
  deny('HOLD_518_BAD_D1_ID');
 const indirect=raw.filter(x=>['durable_object_namespace','dispatch_namespace','service']
  .includes(x.type)).map(x=>({name:x.name,type:x.type}));
 return {d1,indirect};
};
// Every GET is restricted to known account and scripts, with no request body.
// No tokens, module content, worker settings or raw responses in stdout.
export const observeLiveAccount518=async({request,token,rollbackVersionIds=[]}={})=>{
 if(typeof request!=='function'||typeof token!=='string'||token.length<8)
  deny('HOLD_518_READONLY_CREDENTIALS_MISSING');
 const get=async path=>{
  if(!(path==='/workers/scripts'
   ||path.startsWith('/workers/scripts/')
   ||path.startsWith('/workers/workers/')
   ||path.startsWith('/d1/database?per_page=100&page=')))
   deny('HOLD_518_DISALLOWED_READONLY_URL');
  const response=await request(API+path,{method:'GET',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:AbortSignal.timeout(20000)});
  if(!response?.ok)deny('HOLD_518_ACCOUNT_READ_API_UNAVAILABLE');
  const data=await response.json();
  if(data?.success!==true)deny('HOLD_518_ACCOUNT_READ_API_DENIED');
  return data;
 };
 const scripts=await get('/workers/scripts');
 const names=scripts.result?.map(x=>x.id);
 if(!Array.isArray(names)||names.length!==NAMES.length
  ||names.some(x=>!validName(x))||new Set(names).size!==NAMES.length)
  deny('HOLD_518_ACCOUNT_SCRIPT_INVENTORY_MISMATCH');
 const databaseIds=[];
 for(let page=1;page<=10;page++){
  const data=await get('/d1/database?per_page=100&page='+page);
  if(!Array.isArray(data.result))deny('HOLD_518_D1_INVENTORY_UNAVAILABLE');
  for(const item of data.result)databaseIds.push(item.uuid);
  if(data.result.length<100)break;
  if(page===10)deny('HOLD_518_D1_INVENTORY_TRUNCATED');
 }
 if(new Set(databaseIds).size!==databaseIds.length)
  deny('HOLD_518_D1_INVENTORY_DUPLICATE');
 const versions=[];
 const observeVersion=async(name,id)=>{
  if(!validName(name)||!validId(id))deny('HOLD_518_VERSION_ID_INVALID');
  const [metadata,content]=await Promise.all([
   get('/workers/scripts/'+name+'/versions/'+id),
   get('/workers/workers/'+name+'/versions/'+id+'?include=modules'),
  ]);
  if(content?.result?.id!==id)deny('HOLD_518_CODE_VERSION_MISMATCH');
  const meta=bindings(metadata.result?.resources?.bindings);
  return {codeSha256:digestModules(content),d1Bindings:meta.d1,
   indirectBindings:meta.indirect};
 };
 const workers=[],rollbackVersions=[];
 for(const name of NAMES){
  const [deploy,settings]=await Promise.all([
   get('/workers/scripts/'+name+'/deployments'),
   get('/workers/scripts/'+name+'/settings'),
  ]);
  const active=deploy.result?.deployments?.[0]?.versions;
  if(!Array.isArray(active)||active.length!==1||Number(active[0]?.percentage)!==100)
   deny('HOLD_518_TRAFFIC_SPLIT_OR_MISSING_'+name);
  const id=active[0].version_id;
  const meta=await observeVersion(name,id);
  const current=bindings(settings.result?.bindings);
  const normalize=d1=>JSON.stringify([...d1].sort((a,b)=>a.binding.localeCompare(b.binding)));
  if(normalize(meta.d1Bindings)!==normalize(current.d1))
   deny('HOLD_518_ACTIVE_D1_SETTINGS_DRIFT_'+name);
  workers.push({name,active:[{versionId:id,trafficPercent:100}],
   codeSha256:meta.codeSha256,d1Bindings:meta.d1Bindings,
   indirectBindings:meta.indirectBindings});
  const rb=rollbackVersionIds.find(x=>x.name===name);
  if(!rb||!validId(rb.versionId))deny('HOLD_518_ROLLBACK_VERSION_NOT_SIGNED_'+name);
  const previous=rb.versionId===id?meta:await observeVersion(name,rb.versionId);
  rollbackVersions.push({name,versionId:rb.versionId,...previous});
 }
 // Re-read deployment identities after code reads to fail on concurrent release.
 for(const x of workers){
  const deploy=await get('/workers/scripts/'+x.name+'/deployments');
  const current=deploy.result?.deployments?.[0]?.versions;
  if(!Array.isArray(current)||current.length!==1
   ||current[0].version_id!==x.active[0].versionId
   ||Number(current[0].percentage)!==100)
   deny('HOLD_518_LIVE_VERSION_DRIFT_'+x.name);
 }
 return {workers,rollbackVersions,databaseIds};
};
export const verifyTrustedReleaseProof518=({signed,publicKeyPem,trustedHash,
 releaseSha,live,nowMs,restoreWorker,restoreVersion}={})=>{
 if(!/^[a-f0-9]{64}$/.test(trustedHash||'')
  ||sha(publicKeyPem||'')!==trustedHash)
  return {pass:false,code:'HOLD_518_AUDITOR_TRUST_SECRET_NOT_PINNED'};
 const answer=assessAccountD1Cutover518({signed,publicKeyPem,
  pinnedPublicKeySha256:trustedHash,releaseSha,live,nowMs});
 if(!answer.pass)return answer;
 if(!validName(restoreWorker)||!validId(restoreVersion))
  return {pass:false,code:'HOLD_518_PROTECTED_RESTORE_TARGET_INVALID'};
 const proof=JSON.parse(signed.payload);
 const target=proof.workers.find(x=>x.name===restoreWorker);
 if(target?.rollbackVersionId!==restoreVersion
   ||target?.rollbackBudgetAware!==true)
  return {pass:false,code:'HOLD_518_TARGET_NOT_SIGNED_BUDGET_SAFE'};
 return {pass:true,code:'APP518_PROTECTED_RESTORE_PREFLIGHT_PASS'};
};
export const verifyRestoredExact518=({signed,publicKeyPem,trustedHash,releaseSha,
 nowMs,restoreWorker,restoreVersion,observed}={})=>{
 // After restore, confirm the exact independently authorized artifact is now
 // 100% active with the same D1 bindings. No second arbitrary key is trusted.
 if(!validName(restoreWorker)||!validId(restoreVersion)
  ||sha(publicKeyPem||'')!==trustedHash
  ||!/^[a-f0-9]{64}$/.test(trustedHash||''))
  return {pass:false,code:'HOLD_518_RESTORED_TRUST_MISSING'};
 let evidence;
 try{
  if(!verify(null,Buffer.from(signed.payload),createPublicKey(publicKeyPem),
    Buffer.from(signed.signature,'base64')))throw Error('SIGNATURE_BAD');
  evidence=JSON.parse(signed.payload);
 }catch{return {pass:false,code:'HOLD_518_RESTORED_SIGNATURE_INVALID'};}
 const worker=evidence.workers?.find(x=>x.name===restoreWorker);
 const normalize=d1=>JSON.stringify([...d1].sort((a,b)=>a.binding.localeCompare(b.binding)));
 if(evidence.purpose!=='APP518_ACCOUNT_D1_ALL_WRITER_CUTOVER'
   ||evidence.releaseSha!==releaseSha
   ||Math.abs(nowMs-evidence.checkedAtMs)>120000
   ||worker?.rollbackVersionId!==restoreVersion
   ||worker?.rollbackBudgetAware!==true
   ||worker?.rollbackCodeSha256!==observed?.codeSha256
   ||!Array.isArray(observed?.d1Bindings)
   ||!Array.isArray(worker?.rollbackD1Bindings)
   ||normalize(observed.d1Bindings)!==normalize(worker.rollbackD1Bindings)
   ||observed?.activeVersionId!==restoreVersion
   ||observed?.trafficPercent!==100)
  return {pass:false,code:'HOLD_518_RESTORED_CODE_OR_BINDINGS_DRIFT'};
 return {pass:true,code:'APP518_PROTECTED_RESTORE_POSTCHECK_PASS'};
};
const live=async()=>{
 const restoreWorker=process.argv[3],restoreVersion=process.argv[4];
 if(!validName(restoreWorker)||!validId(restoreVersion))
  deny('HOLD_518_BAD_RESTORE_TARGET');
 const signed=JSON.parse(process.env.APP518_SIGNED_ACCOUNT_PROOF_518||'null');
 const publicKeyPem=process.env.APP518_AUDITOR_PUBLIC_KEY_PEM_518;
 const trustedHash=process.env.APP518_TRUSTED_AUDITOR_KEY_SHA256_518;
 if(!signed||!publicKeyPem||!/^[a-f0-9]{64}$/.test(trustedHash||''))
  deny('HOLD_518_PROTECTED_AUDIT_SECRETS_MISSING');
 const releaseSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const nowMs=Date.now(),token=process.env.CLOUDFLARE_API_TOKEN;
 const source=JSON.parse(signed.payload);
 if(!Array.isArray(source.workers)||source.workers.length!==NAMES.length)
  deny('HOLD_518_SIGNED_ROLLBACK_INVENTORY_MISSING');
 const rollbackVersionIds=source.workers.map(x=>({name:x.name,versionId:x.rollbackVersionId}));
 const mode=process.argv[2];
 if(mode==='--pre-restore'){
  const liveSnapshot=await observeLiveAccount518({request:fetch,token,rollbackVersionIds});
  const result=verifyTrustedReleaseProof518({signed,publicKeyPem,trustedHash,
   releaseSha,live:liveSnapshot,nowMs,restoreWorker,restoreVersion});
  if(!result.pass)deny(result.code);
  console.log('APP518_PROTECTED_RESTORE_INDEPENDENT_TRUST_AND_LIVE_PROOF=PASS');
 }else if(mode==='--post-restore'){
  // The signature has been checked against a separately pinned trust hash.
  // Query the exact restored immutable worker content and serving deployment.
  const data=await observeLiveAccount518({request:fetch,token,rollbackVersionIds});
  const worker=data.workers.find(w=>w.name===restoreWorker);
  const observed={...worker,activeVersionId:worker?.active?.[0]?.versionId,
   trafficPercent:worker?.active?.[0]?.trafficPercent};
  const result=verifyRestoredExact518({signed,publicKeyPem,trustedHash,
   releaseSha,nowMs,restoreWorker,restoreVersion,observed});
  if(!result.pass)deny(result.code);
  console.log('APP518_PROTECTED_RESTORE_POSTCHECK=PASS');
 }else deny('HOLD_518_UNSUPPORTED_RELEASE_AUDIT_ACTION');
};
if(['--pre-restore','--post-restore'].includes(process.argv[2])){
 try{await live()}catch(e){
  console.error(String(e?.message||e).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,90));
  process.exitCode=2;
 }
}
