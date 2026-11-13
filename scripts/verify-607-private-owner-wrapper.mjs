// APP607: prepare exact ACTIVE Explore Worker for a private owner-follow
// named entrypoint; no Cloudflare mutation. Output lives in ephemeral CI temp.
// Only existing canonical validation is reused; do NOT reimplement Auth307.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
const ROOT=join(process.env.RUNNER_TEMP||'/no-app607-test','app605');
const OUT=join(process.env.RUNNER_TEMP||'/no-app607-test','app607');
const PARTS=[
 'owner-follow-service-601.mjs',
 'owner-follow-postcommit-555.mjs',
 'owner-follow-commit-proof-557.mjs',
 'owner-follow-qa-boundary-577.mjs',
 'owner-follow-http-539.mjs',
 'owner-follow-outbox-529.mjs',
 'owner-follow-auth-epoch-532.mjs',
];
const REPO_ROOT=new URL('../cloudflare/explore-worker/',import.meta.url);
const sha=v=>createHash('sha256').update(v).digest('hex');
const need=(ok,why)=>{if(!ok)throw Error('APP607_HOLD_'+why)};
const load=file=>readFileSync(new URL(file,REPO_ROOT));
const loadText=file=>load(file).toString('utf8');
function sourceSafety(){
 const src=loadText('experiments/owner-follow-entry-607.mjs');
 const service=loadText('runtime/owner-follow-service-601.mjs');
 need(src.includes("import {WorkerEntrypoint} from 'cloudflare:workers';"),
  'PRIVATE_ENTRYPOINT_NOT_EXPLICIT');
 need(src.includes('export class OwnerFollowReplayEntrypoint607 extends WorkerEntrypoint'),
  'NAMED_PRIVATE_SERVICE_MISSING');
 need(!src.includes("url.pathname==='/owner-follow/replay557-internal'"),
  'UNSAFE_PUBLIC_SERVICE_ROUTE');
 need(src.includes('export {ExploreLikeBatchScheduler103};'),'LIKE_DO_REEXPORT_MISSING');
 need(src.includes('original.fetch.call(original'),'CANONICAL_FALLBACK_MISSING');
 need(src.includes('runOwnerFollowPrecommit557'),'DURABLE_RESERVATION_FIRST_MISSING');
 need(src.includes('APP607_SOURCE_WRAPPER_PRESENT=true;'),'BRIDGE_NOT_COMPILED');
 need(src.includes('SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607'),'RECEIVER_GATE_MISSING');
 need(src.includes('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574'),'OWNER_ISOLATION_MISSING');
 need(src.includes('SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607'),'EXPLICIT_PREVIEW_BRIDGE_GATE_MISSING');
 need(service.includes('allowedCanaryUid=null'),'PRIVATE_REPLAY_CANARY_GUARD_MISSING');
 need(service.includes('parsed.value.ownerUid!==allowedCanaryUid'),'PRIVATE_REPLAY_OWNER_FENCE_MISSING');
 need(loadText('runtime/owner-follow-precommit-557.mjs').includes(
  'export async function runOwnerFollowPrecommit557'),
  'EXISTING_PRECOMMIT_NOT_PRESENT');
 // Keep caller and receiver independent of D1/RTDB/Firebase secrets at
 // compilation time. The server token and service bindings must be injected.
 need(!src.includes('BEGIN PRIVATE KEY'),'SECRET_IN_SOURCE');
 return src;
}
function prepare(){
 sourceSafety();
 const previous=join(ROOT,'candidate','preview-entry.js');
 const original=join(ROOT,'baseline','preview-entry.js');
 const proof=JSON.parse(readFileSync(join(ROOT,'candidate-proof.json'),'utf8'));
 const base=readFileSync(original),staged=readFileSync(previous);
 need(base.length===2440556,'LIVE_SOURCE_BYTES_DRIFT');
 need(staged.subarray(0,base.length).equals(base),'APP605_PREFIX_CHANGED');
 need(sha(base)===proof.sourceSha,'APP605_SOURCE_HASH_DRIFT');
 need(sha(staged)===proof.candidateSha,'APP605_CANDIDATE_HASH_DRIFT');
 const text=staged.toString('utf8');
 need(text.includes('async function validateExploreAuth307('),
  'ACTIVE_AUTH307_NOT_FOUND');
 need(text.includes('ExploreLikeBatchScheduler103'),
  'ACTIVE_LIKE_DO_CLASS_NOT_PRESENT');
 // The exact export shape is verified by the local workerd namespace test,
 // not by matching one source formatting pattern.
 // The active module's default-export syntax is established by real workerd
 // execution of the baseline, not a source formatting predicate.
 need(!text.includes('export {validateExploreAuth307};'),'ALREADY_AUTH_EXPORTED');
 const append=Buffer.from('\n// APP607: expose the exact deployed Auth307 helper to the private wrapper.\nexport {validateExploreAuth307};\n','utf8');
 const authExported=Buffer.concat([staged,append]);
 need(authExported.subarray(0,base.length).equals(base),
  'ACTIVE_SOURCE_BYTES_CHANGED');
 // APP605’s seven-module closure is retained, with exactly one updated
 // APP601 service module that adds a fail-closed canary check.
 mkdirSync(OUT,{recursive:true});mkdirSync(join(OUT,'app605'),{recursive:true});
 mkdirSync(join(OUT,'app607'),{recursive:true});
 writeFileSync(join(OUT,'preview-entry.mjs'),authExported,{mode:0o600});
 const main=load('experiments/owner-follow-entry-607.mjs');
 writeFileSync(join(OUT,'owner-follow-entry-607.mjs'),main,{mode:0o600});
 for(const path of PARTS){
  const source=load('runtime/'+path);
  writeFileSync(join(OUT,'app605',path),source,{mode:0o600});
 }
 const precommit=load('runtime/owner-follow-precommit-557.mjs');
 writeFileSync(join(OUT,'app607','owner-follow-precommit-557.mjs'),
  precommit,{mode:0o600});
 const all=[
  ['owner-follow-entry-607.mjs',main],
  ['preview-entry.mjs',authExported],
  ...PARTS.map(path=>['app605/'+path,load('runtime/'+path)]),
  ['app607/owner-follow-precommit-557.mjs',precommit],
 ];
 need(all.length===10,'MODULE_COUNT_DRIFT');
 const emitted=all.map(([name,buf])=>({
  name,content_base64:buf.toString('base64'),content_type:'application/javascript+module',
  sha256:sha(buf),bytes:buf.length,
 }));
 // No runtime import from the active module may escape the APP607 package;
 // only Cloudflare's built-in entrypoint module is an external import.
 const nameSet=new Set(emitted.map(x=>x.name));
 for(const item of emitted){
  const raw=Buffer.from(item.content_base64,'base64').toString('utf8');
  for(const match of raw.matchAll(/(?:from\s*)?['"](\.[^'"]+)['"]/g)){
   const path=match[1];
   if(!path.startsWith('./')&&!path.startsWith('../'))continue;
   // Import-scanning is for source files written in the repo. Baseline
   // compiled code may include strings that are not import specifiers.
   if(item.name==='preview-entry.mjs')continue;
   const resolved=join(dirname(item.name),path).replaceAll('\\','/');
   need(nameSet.has(resolved),'UNRESOLVED_IMPORT_'+item.name);
  }
 }
 const safety={
  main:'owner-follow-entry-607.mjs',
  originalSha256:sha(base),originalBytes:base.length,
  modifiedOriginalSha256:sha(authExported),
  moduleCount:emitted.length,
  moduleProof:emitted.map(({name,sha256,bytes})=>({name,sha256,bytes})),
  sourcePrefixExact:true,
  sourceActiveVersion:'350ce33d-ec83-49d0-a4ae-c25d2d90f59e',
  compatibilityDate:'2026-08-28',
  existingLikeDoV1:true,
  additionalDoClasses:0,
  serviceBindingConfigured:false,
  receiverAndCanaryFlagsConfigured:false,
  trafficUpload:'NOT_PERFORMED',
 };
 writeFileSync(join(OUT,'candidate-proof.json'),
  JSON.stringify(safety,null,2)+'\n',{mode:0o600});
 console.log('APP607_EXACT_ACTIVE_CODE_PREFIX_HASH=PASS');
 console.log('APP607_AUTH307_REEXPORT_ONLY=PASS');
 console.log('APP607_PRIVATE_NAMED_RPC_AND_LIKE_DO_EXPORT=PASS');
 console.log('APP607_COMPLETE_TEN_MODULE_IMPORT_GRAPH=PASS');
 console.log('APP607_NO_REMOTE_UPLOAD_OR_DEPLOY=PASS');
}
if(process.argv[2]==='--self-test'){
 sourceSafety();
 console.log('APP607_CANARY_RECEIVER_FLAGS_AND_REPLAY_FENCE=PASS');
}else if(process.argv[2]==='--prepare'){
 prepare();
}else throw Error('APP607_INVALID_MODE');
