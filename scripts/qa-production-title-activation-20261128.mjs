// Exact one-component transaction derived from the previous approved
// full-production-backend-activation.mjs path and QA #46126307819.
// This branch's workflow runs OFFLINE ONLY. There is no live entry point.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {patchCuratedDirectPublication} from './lib/patch-curated-direct-publication-deployed-20261128.mjs';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
export const TARGET='soridraw-explore-api',PRE='soridraw-explore-preview';
export const PINS=Object.freeze({
 [TARGET]:'9257b708-4b76-43fe-9c87-3abe0fb071b7',
 [PRE]:'0c437089-d431-4ab4-b872-27029c906048',
 'soridraw-owner-follow-preview-candidate':'c71d7c12-ace4-4405-ab1a-d8c651c90559',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869'
});
export const APPROVAL='ACTIVATE_PRODUCTION_TITLE_WORKER_20261128';
export const CANDIDATE_HASHES=Object.freeze({
  "app605/owner-follow-auth-epoch-532.mjs": "16c5475d578e862bd24000e860188c24a9abf5d6412a027642345d2f8d920cac",
  "app605/owner-follow-commit-proof-557.mjs": "35cc3e1d667aa590f5b104964385705c86693fe5f7c110d287e2923b7509d508",
  "app605/owner-follow-http-539.mjs": "4fe5e77c7786b9acff289dc6dcecac105989f52aaabb67b83d22ff1255aaa8e9",
  "app605/owner-follow-outbox-529.mjs": "adfde3a8db099bbca7a2cf42f72ec94f5ea1be77ffc6992da878440cfac94631",
  "app605/owner-follow-postcommit-555.mjs": "1040400326f1e43d12e3a248616146cfa80c303d7e2a2711eaa2b24092db72df",
  "app605/owner-follow-qa-boundary-577.mjs": "d412949a70caaaa536cdc898ca32e1b438d0fe75d62707822beb7911bff87b40",
  "app605/owner-follow-service-601.mjs": "11eba83263755bd819778ce9085ce66681b9414915155209aad010c2c0eb02b7",
  "app605/public-follow-dual-ack-671.mjs": "60a5599cf4d3d3f294a47d41fc74d9325ae92c28911c867af7f313c9d131969b",
  "app605/public-follow-http-669.mjs": "64518224529c809b9ee46b3db97bec88e6722bab18f38010430f15c4763b7e77",
  "app605/public-follow-proven-pair-669.mjs": "71c9b2015b04939c7b3d30acbcf18df0c652c2d1207d258998871b195f61e6e1",
  "app607/owner-follow-precommit-557.mjs": "d20cd68063167a55e48bd55fd6564532376083d78fd9f948a8d627610f673095",
  "entry.mjs": "77a115467f34a80dfbe8b11aa9f186d561dddc7796035d4add96b9293f2749b1",
  "production-follow-797.mjs": "8c30881bad3f7cab96eca95a5d907041b5e33df3a3b30e025a762b8a63f9c160",
  "production-main.mjs": "a1671fa71c1314ff018cb2baa0d6c334b87fdebc0673f69757993f5c57defc7c",
  "release-shared-like-scheduler.mjs": "e6a8da734db817bfb127399a35ba6f3790cfef8c9b67a57b44ab6feb724ed23a"
});
const OLD_CORE='3e40fefc09f976c560b38b83d9698bd5f36c096e7779258993b702733faa0a48';
const PRE_CORE='bfc1f195228e8fbcb6ed12270315c06b9d58d61c29e860de3f4c1eadda95316c';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error('TITLE_ACTIVATION_HOLD_'+m)};
const moduleBytes=m=>Buffer.from(m.content_base64,'base64');
const moduleMap=s=>new Map(s.modules.map(m=>[m.name,m]));
const activeExact=(a,v)=>a?.version===v&&typeof a?.deployment==='string'&&a.deployment.length>0;
function checkModuleHashes(modules,expected){
 need(Array.isArray(modules)&&modules.length===Object.keys(expected).length&&new Set(modules.map(m=>m.name)).size===modules.length,'MODULE_INVENTORY');
 for(const m of modules)need(typeof m.content_base64==='string'&&sha(moduleBytes(m))===expected[m.name],'MODULE_HASH_'+m.name);
}
export function prepareTitleUpload({old,preview}){
 need(old?.id===PINS[TARGET]&&preview?.id===PINS[PRE],'SOURCE_PIN');
 const oldHashes={...CANDIDATE_HASHES,'production-main.mjs':OLD_CORE};
 checkModuleHashes(old.modules,oldHashes);
 const pre=moduleMap(preview).get('preview-entry.mjs');
 need(pre&&sha(moduleBytes(pre))===PRE_CORE,'PREVIEW_CORE_PIN');
 const before=moduleMap(old).get('production-main.mjs');
 const fixed=patchCuratedDirectPublication(moduleBytes(before).toString('utf8'));
 need(sha(fixed)===CANDIDATE_HASHES['production-main.mjs'],'EXACT_PREVIOUS_QA_CANDIDATE_HASH');
 need(old.bindings?.length===27&&new Set(old.bindings.map(b=>b.name)).size===27&&old.runtime?.compatibility_date,'BINDING_RUNTIME_PIN');
 const modules=old.modules.map(m=>({name:m.name,content_type:m.content_type||'application/javascript+module',content_base64:m.name==='production-main.mjs'?Buffer.from(fixed).toString('base64'):m.content_base64}));
 checkModuleHashes(modules,CANDIDATE_HASHES);
 return {main_module:'entry.mjs',compatibility_date:old.runtime.compatibility_date,compatibility_flags:old.runtime.compatibility_flags||[],
  bindings:old.bindings.map(b=>({name:b.name,type:'inherit',version_id:old.id})),modules,
  annotations:{'workers/tag':'production-title-20261128','workers/message':'Exact previously QA-tested title-only candidate; preserve all bindings'}};
}
export function verifyInactiveTitleCandidate({old,candidate,id}){
 need(uuid.test(id)&&id!==old.id&&candidate?.id===id,'INACTIVE_ID');
 checkModuleHashes(candidate.modules,CANDIDATE_HASHES);
 const sorted=a=>[...a].sort((x,y)=>x.name.localeCompare(y.name));
 need(isDeepStrictEqual(sorted(candidate.bindings),sorted(old.bindings)),'INHERITED_BINDING_DRIFT');
 need(sameStagedWorkerRuntime660(old.runtime,candidate.runtime),'INHERITED_RUNTIME_DRIFT');
 return true;
}
// Inject transport for isolated test only. Live adapters MUST implement exact
// pinned GETs, inactive upload only, scoped deployment, and read-only smoke.
// Never approve by merging a file; caller must have separate director approval.
export async function executeTitleActivation({api,approval,build=prepareTitleUpload,verify=verifyInactiveTitleCandidate}={}){
 need(approval===APPROVAL,'DIRECTOR_APPROVAL_REQUIRED');
 const baseline=await api.readActivePins();
 for(const [name,version] of Object.entries(PINS))need(activeExact(baseline[name],version),'ACTIVE_PIN_'+name);
 const same=async(overrides={})=>{
  const observed=await api.readActivePins();
  for(const [name,row] of Object.entries(baseline))need(isDeepStrictEqual(observed[name],overrides[name]||row),'CONCURRENT_DEPLOYMENT_'+name);
  return observed;
 };
 const [old,preview]=await Promise.all([api.snapshot(TARGET,PINS[TARGET]),api.snapshot(PRE,PINS[PRE])]);
 const payload=build({old,preview});
 await same();
 const id=await api.uploadInactive(TARGET,payload);
 need(uuid.test(id)&&id!==PINS[TARGET],'UPLOAD_ID');
 const candidate=await api.snapshot(TARGET,id);
 need(verify({old,candidate,id})===true,'INACTIVE_READBACK');
 await same();
 let owned=null;
 try{
  const ack=await api.deploy(TARGET,id);
  need(activeExact(ack,id)&&ack.deployment!==baseline[TARGET].deployment,'DEPLOY_ACK');
  owned=ack;
  await api.awaitActive(TARGET,owned);
  await same({[TARGET]:owned});
  need(await api.smokeReadOnly()===true,'POSTFLIGHT');
  await same({[TARGET]:owned});
  return {status:'TITLE_WORKER_ACTIVE',version:id,rollback:PINS[TARGET],hostingChanged:false,otherWorkersChanged:false};
 }catch(error){
  // No acknowledged deployment identity = never guess, never overwrite a
  // possibly concurrent release. Candidate may be inactive; report HOLD.
  if(!owned)throw Error('TITLE_ACTIVATION_MANUAL_HOLD_UNACKNOWLEDGED_DEPLOYMENT');
  const current=(await api.readActivePins())[TARGET];
  if(isDeepStrictEqual(current,baseline[TARGET]))throw Error('TITLE_ACTIVATION_HOLD_ORIGINAL_ACTIVE');
  if(!isDeepStrictEqual(current,owned))throw Error('TITLE_ACTIVATION_MANUAL_HOLD_CONCURRENT_DEPLOYMENT');
  try{
   const restored=await api.deploy(TARGET,PINS[TARGET]);
   need(activeExact(restored,PINS[TARGET]),'ROLLBACK_ACK');
   await api.awaitActive(TARGET,restored);
   await same({[TARGET]:restored});
  }catch{throw Error('TITLE_ACTIVATION_MANUAL_HOLD_ROLLBACK_UNCONFIRMED')}
  throw Error('TITLE_ACTIVATION_ROLLBACK_PASS_AFTER_'+String(error?.message||'FAIL').replace(/[^A-Za-z0-9_]/g,'_').slice(0,100));
 }
}
