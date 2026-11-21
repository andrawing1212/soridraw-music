// APP728 - produce a SOURCE-ONLY code candidate from the exact active PROD Worker.
// GET only. Keep the original production module byte-for-byte; feature sources are
// placed in a quarantined review directory, never imported into the entrypoint.
// This is NOT a production deployment, Worker upload, binding change, or feature enable.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync} from 'node:fs';
import {join,resolve,relative,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { buildApp729ProductionIntegrationEntry } from './app729-production-follow-entry.mjs';

const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const PROD_NAME='soridraw-explore-api';
const PROD_ACTIVE='af81502a-298d-4ec6-bc2a-0c529d6dc29e';
const PROD_MAIN_SHA='f95ccb6225a668b8d26ea2d5e126d8269f63fca98be08b54ea092061be14de78';
const PROD_DB='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const PROD_PROFILE_R2='soridraw-profile-media';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{40}$/;
const LIVE_BINDINGS=Object.freeze({
 DB:'d1', EXPLORE_LIKE_BATCH_SCHEDULER:'durable_object_namespace',
 EXPLORE_MIRROR_PREVIEW:'service', EXPLORE_MIRROR_TEST:'service',
 EXPLORE_MIRROR_TOKEN:'secret_text', LIKE_RATE_LIMITER:'ratelimit',
 PROFILE_MEDIA:'r2_bucket', SORIDRAW_ENVIRONMENT:'plain_text',
 SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378:'plain_text',
 SORIDRAW_PUBLICATION_R2_ONLY_READ_V1:'plain_text',
 SORIDRAW_R2_CATALOG_V1:'plain_text',SORIDRAW_R2_HYBRID_READ_V1:'plain_text',
});
const ROOT='cloudflare/explore-worker/runtime';
export const APP728_QUARANTINED_SOURCE_FILES=Object.freeze([
 'owner-follow-postcommit-555.mjs',
 'owner-follow-http-539.mjs',
 'owner-follow-outbox-529.mjs',
 'owner-follow-auth-epoch-532.mjs',
 'owner-follow-qa-boundary-577.mjs',
 'owner-follow-commit-proof-557.mjs',
 'owner-follow-precommit-557.mjs',
 'owner-follow-recovery-556.mjs',
 'public-follow-dual-ack-671.mjs',
 'public-follow-http-669.mjs',
 'public-follow-proven-pair-669.mjs',
 'owner-follow-target-scope-659.mjs',
]);
const sha256=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>a===b;
const forbidden='OwnerFollowerRecovery557';
const isSource=(value)=>typeof value==='string' && value.length>0;
function fail(code){throw Error('APP728_CANDIDATE_'+code)}
export function verifyApp728ProductionBaseline({sourceSha,lockedPreviewSha,activeVersion,mainModule,settings,code,modules}){
 if(!SHA.test(sourceSha)||sourceSha!==lockedPreviewSha)fail('PREVIEW_SHA_UNVERIFIED');
 if(!UUID.test(activeVersion)||activeVersion!==PROD_ACTIVE)fail('PRODUCTION_ACTIVE_VERSION_DRIFT');
 if(!Array.isArray(modules)||modules.length!==1||
    modules[0]?.name!==mainModule||typeof mainModule!=='string'||
    !/^[A-Za-z0-9_.-]+\.m?js$/.test(mainModule))fail('PRODUCTION_MODULE_SHAPE_DRIFT');
 if(!Buffer.isBuffer(code)||sha256(code)!==PROD_MAIN_SHA)fail('PRODUCTION_CODE_SHA_DRIFT');
 const bindings=Array.isArray(settings?.bindings)?settings.bindings:[];
 if(bindings.length!==12||new Set(bindings.map(b=>b.name)).size!==12)fail('PRODUCTION_BINDING_COUNT_DRIFT');
 const b=new Map(bindings.map(x=>[x.name,x]));
 for(const [name,type] of Object.entries(LIVE_BINDINGS)){
   if(b.get(name)?.type!==type)fail('PRODUCTION_BINDING_SHAPE_DRIFT');
 }
 if(String(b.get('DB')?.id||b.get('DB')?.database_id||'')!==PROD_DB||
    String(b.get('PROFILE_MEDIA')?.bucket_name||b.get('PROFILE_MEDIA')?.bucket||'')!==PROD_PROFILE_R2)
   fail('SHARED_CANONICAL_TARGET_DRIFT');
 if(bindings.some(x=>String(x.name||'').includes(forbidden)||String(x.class_name||'').includes(forbidden)))
   fail('NEW_DURABLE_OBJECT_NOT_ALLOWED');
 return {pinned:activeVersion,mainCodeSha256:PROD_MAIN_SHA,originalBindingsPreserved:12};
}

export function selectApp728QuarantinedSources(sourceFiles) {
 const allowed=new Set(APP728_QUARANTINED_SOURCE_FILES);
 const list=[];
 for(const name of allowed){
   const text=sourceFiles?.[name];
   if(!isSource(text)||Buffer.byteLength(text,'utf8')>300_000)fail('MISSING_OR_INVALID_SOURCE_'+name);
   const matches=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)];
   for(const [,ref] of matches){
     const resolved=resolve('/quarantine',name,'..',ref);
     const child=relative('/quarantine',resolved).split(sep).join('/');
     if(child.startsWith('../')||!allowed.has(child))fail('IMPORT_ESCAPES_REVIEW_BUNDLE');
   }
   if(text.includes('wrangler deploy')||text.includes('firebase deploy'))fail('MUTATION_COMMAND_IN_REVIEW_SOURCE');
   list.push({name,sha256:sha256(text),bytes:Buffer.byteLength(text,'utf8'),text});
 }
 if(!sourceFiles['owner-follow-postcommit-555.mjs'].includes('APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN=false')||
    !sourceFiles['public-follow-dual-ack-671.mjs'].includes('APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=false')||
    !sourceFiles['owner-follow-target-scope-659.mjs'].includes("env?.SORIDRAW_ENVIRONMENT!=='preview'"))
   fail('PREVIEW_COMPILE_OFF_GATES_CHANGED');
 if(Object.keys(sourceFiles).some(name=>!allowed.has(name)))fail('UNAPPROVED_SOURCE_MODULE');
 return list;
}

export function createApp728PreservedSourceCandidate({baseline,featureSources,sourceSha,lockedPreviewSha}){
 const check=verifyApp728ProductionBaseline({...baseline,sourceSha,lockedPreviewSha});
 const review=selectApp728QuarantinedSources(featureSources);
 if([...review].some(x=>x.name.includes('do-557')||x.text.includes('new_sqlite_classes')))
   fail('NEW_DO_MIGRATION_CANDIDATE');
 const manifest={
   kind:'APP728_PRESERVED_PRODUCTION_CODE_REVIEW',
   status:'HOLD', executable:false, uploadAllowed:false, deployAllowed:false,
   sourceSha, productionWorker:PROD_NAME,
   activeVersion:check.pinned, baselineMainModule:baseline.mainModule,
   baselineMainSha256:check.mainCodeSha256, existingBindingsProtected:12,
   unchangedProductionMain:true, importedFeatureModules:0,
   integratedFollowSignalSeam:true, productionFollowSignalCompiledOpen:false,
   addedBindings:0,
   addedDurableObjectClasses:0, addedMigrations:0, newRoutes:0,
   quarantinedModules:review.map(({name,sha256,bytes})=>({name,sha256,bytes})),
   forbiddenActions:['DEPLOY','UPLOAD','ACTIVATE','TEST_ACCESS','DATA_WRITE','BINDING_ADD','MIGRATION'],
   releaseBlockers:[
     'NO_ACTIVE_PRODUCTION_FOLLOW_BRIDGE',
     'PREVIEW_ONLY_FEATURE_GATES',
     'SERVER_AUTH_DURABLE_RECEIPT_AND_RECEIVER_NOT_PROVEN',
     'PRODUCTION_AUTH_DO_FUNCTIONS_RUNTIME_DEPENDENCIES_NOT_CONNECTED',
     'ROLLBACK_AND_PC_MOBILE_NOT_PROVEN',
   ],
 };
 return {manifest,unchangedMain:baseline.code,review};
}
async function get(url,token,fetcher=fetch){
 const resp=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token,'Accept':'application/json'}});
 if(!resp.ok)fail('CLOUDFLARE_GET_HTTP_'+resp.status);
 const j=await resp.json();
 if(j?.success===false||!j?.result)fail('CLOUDFLARE_GET_RESPONSE');
 return j.result;
}
function oneActive(result){
 const v=result?.deployments?.[0]?.versions;
 if(!Array.isArray(v)||v.length!==1||Number(v[0]?.percentage)<99.99||
    !UUID.test(String(v[0]?.version_id||'')))fail('NOT_EXACT_ACTIVE_VERSION');
 return v[0].version_id;
}
export async function readPinnedProductionCode728(token,fetcher=fetch){
 if(!token)fail('AUTH_MISSING');
 const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
 const depUrl=root+'/workers/scripts/'+PROD_NAME+'/deployments';
 const version=oneActive(await get(depUrl,token,fetcher));
 if(version!==PROD_ACTIVE)fail('PROD_VERSION_CHANGED_SINCE_AUDIT');
 const [settings,v]=await Promise.all([
   get(root+'/workers/scripts/'+PROD_NAME+'/settings',token,fetcher),
   get(root+'/workers/workers/'+PROD_NAME+'/versions/'+version+'?include=modules',token,fetcher),
 ]);
 if(v.id&&v.id!==version)fail('VERSION_BODY_DRIFT');
 if(!Array.isArray(v.modules)||v.modules.length!==1||!v.modules[0]?.content_base64)
   fail('PROD_SINGLE_MODULE_UNVERIFIED');
 const encoded=v.modules[0].content_base64;
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
   fail('PROD_BASE64_INVALID');
 const code=Buffer.from(encoded,'base64');
 if(sha256(code)!==PROD_MAIN_SHA)fail('PROD_CODE_DRIFT');
 if(oneActive(await get(depUrl,token,fetcher))!==version)fail('ACTIVE_CHANGED_DURING_GET');
 return {activeVersion:version,mainModule:v.main_module,code,modules:v.modules,settings};
}
function checkSyntax(path) {
 const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8',timeout:120_000});
 if(r.status!==0)fail('SYNTAX_CHECK_FAILED');
}
export function writeApp728CandidateToTemp(candidate,tempRoot){
 const root=resolve(tempRoot||'');
 const temp=resolve(process.env.RUNNER_TEMP||'');
 if(!temp||!root.startsWith(temp+sep)||root===temp)fail('RUNNER_TEMP_ONLY');
 const dir=mkdtempSync(join(root,'app728-prod-src-'));
 const outMain=join(dir,'production-main.mjs');
 mkdirSync(join(dir,'quarantined'),{recursive:true});
 writeFileSync(outMain,candidate.unchangedMain);
 if(sha256(readFileSync(outMain))!==candidate.manifest.baselineMainSha256)
   fail('PRODUCTION_MAIN_NOT_PRESERVED');
 checkSyntax(outMain);
 for(const x of candidate.review){
   const dest=join(dir,'quarantined',x.name);
   writeFileSync(dest,x.text,'utf8');
   if(sha256(readFileSync(dest))!==x.sha256)fail('QUARANTINED_CODE_DRIFT');
   checkSyntax(dest);
 }
 const entry=buildApp729ProductionIntegrationEntry();
 const entryPath=join(dir,'production-follow-entry.mjs');
 const adapterSource=readFileSync(resolve('scripts/app729-production-follow-adapter.mjs'),'utf8');
 const lifecycleSource=readFileSync(resolve('scripts/app730-source-only-follow-bridge.mjs'),'utf8');
 const productionBridgeSource=readFileSync(resolve('scripts/app743-production-follow-bridge.mjs'),'utf8');
 const compositionSource=readFileSync(resolve('scripts/app753-production-follow-composition.mjs'),'utf8');
 const principalSource=readFileSync(resolve('scripts/app754-production-firebase-principal.mjs'),'utf8');
 const ownerReceiptSource=readFileSync(resolve('scripts/app755-production-owner-receipt.mjs'),'utf8');
 const backendSource=readFileSync(resolve('scripts/app755-production-follow-backend.mjs'),'utf8');
 const ownerAlarmSource=readFileSync(resolve('scripts/app759-production-owner-alarm.mjs'),'utf8');
 if(!adapterSource.includes('APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN = false'))
   fail('INTEGRATION_COMPILE_OFF_REQUIRED');
 if(!productionBridgeSource.includes('APP743_PRODUCTION_FOLLOW_COMPILED_OPEN=false'))
   fail('PRODUCTION_BRIDGE_MUST_REMAIN_OFF');
 if(!compositionSource.includes('APP753_PRODUCTION_FOLLOW_COMPILED_OPEN=false')||
    !compositionSource.includes('PRODUCTION_DEPENDENCIES_UNVERIFIED'))
   fail('PRODUCTION_COMPOSITION_MUST_REMAIN_OFF');
 if(!principalSource.includes('APP754_PRODUCTION_PRINCIPAL_COMPILED_OPEN=false')||
    !principalSource.includes("const PROJECT='soridraw-app-866a5'")||
    !principalSource.includes("const NUMBER='91309780603'"))
   fail('PRODUCTION_SIGNED_PRINCIPAL_MUST_REMAIN_PINNED_OFF');
 if(!ownerReceiptSource.includes('APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN=false')||
    !ownerReceiptSource.includes('OWNER_STORAGE_UNVERIFIED')||
    !backendSource.includes('APP755_PRODUCTION_BACKEND_COMPILED_OPEN=false')||
    !backendSource.includes('VERIFIED_RUNTIME_COMPONENTS_MISSING')||
    !ownerAlarmSource.includes('APP759_PRODUCTION_OWNER_ALARM_COMPILED_OPEN=false')||
    !ownerAlarmSource.includes('VERIFIED_OWNER_DO_AND_PROOF_REQUIRED'))
   fail('PRODUCTION_OWNER_DO_AND_RELAY_MUST_REMAIN_OFF');
 mkdirSync(join(dir,'integration'),{recursive:true});
 const adapterPath=join(dir,'integration','app729-production-follow-adapter.mjs');
 const lifecyclePath=join(dir,'integration','app730-source-only-follow-bridge.mjs');
 const productionBridgePath=join(dir,'integration','app743-production-follow-bridge.mjs');
 const compositionPath=join(dir,'integration','app753-production-follow-composition.mjs');
 const principalPath=join(dir,'integration','app754-production-firebase-principal.mjs');
 const ownerReceiptPath=join(dir,'integration','app755-production-owner-receipt.mjs');
 const backendPath=join(dir,'integration','app755-production-follow-backend.mjs');
 const alarmPath=join(dir,'integration','app759-production-owner-alarm.mjs');
 if(!lifecycleSource.includes('APP730_PRODUCTION_RELAY_ENABLED = false'))
   fail('DURABLE_RELAY_COMPILE_OFF_REQUIRED');
 writeFileSync(adapterPath,adapterSource);
 writeFileSync(lifecyclePath,lifecycleSource);
 writeFileSync(productionBridgePath,productionBridgeSource);
 writeFileSync(compositionPath,compositionSource);
 writeFileSync(principalPath,principalSource);
 writeFileSync(ownerReceiptPath,ownerReceiptSource);
 writeFileSync(backendPath,backendSource);
 writeFileSync(alarmPath,ownerAlarmSource);
 writeFileSync(entryPath,entry.code);
 if(sha256(readFileSync(entryPath))!==entry.sha256)
   fail('INTEGRATION_ENTRY_DRIFT');
 checkSyntax(adapterPath);
 checkSyntax(lifecyclePath);
 checkSyntax(productionBridgePath);
 checkSyntax(compositionPath);
 checkSyntax(principalPath);
 checkSyntax(ownerReceiptPath);
 checkSyntax(backendPath);
 checkSyntax(alarmPath);
 checkSyntax(entryPath);
 candidate.manifest.integration={
   entrypoint:'production-follow-entry.mjs',
   entrypointSha256:entry.sha256,
   app755OwnerReceiptSha256:sha256(readFileSync(ownerReceiptPath)),
   app755BackendSha256:sha256(readFileSync(backendPath)),
   app759AlarmSha256:sha256(readFileSync(alarmPath)),
   app755SourceFilesCopiedExactly:
     sha256(readFileSync(ownerReceiptPath))===sha256(ownerReceiptSource)&&
     sha256(readFileSync(backendPath))===sha256(backendSource),
   app759OwnerAlarmSourceExactlyCopied:sha256(readFileSync(alarmPath))===
     sha256(ownerAlarmSource),
   originalMainUntouched:true,
   existingProductionBindingCount:12,
   runtimeEnabled:false,
   deployable:false,
   integrationReadyForProduction:false,
   sourceOnlyPrecommitAndDurableReplayPresent:true,
   productionBridgeSourceOnlyAndNotActivated:true,
   productionBridgeImplementationDependenciesInjected:false,
   productionFollowCompositionPresent:true,
   productionFollowCompositionEnabled:false,
   productionSignedPrincipalSourcePresent:true,
   productionSignedPrincipalNoCredentialsOrLiveCalls:true,
   productionOwnerDoReceiptSourceOnly:true,
   productionOwnerAlarmReplaySourceOnly:true,
   productionOwnerDoBindingAndMigrationAdded:false,
   productionFunction542SenderUnconnected:true,
   // A source-only review bundle is NEVER an approved deployable worker.
   activeWorkerRuntimeParityNotVerified:true,
   productionDeployAuthorized:false,
 };
 if(!candidate.manifest.integration.app755SourceFilesCopiedExactly||
    !candidate.manifest.integration.app759OwnerAlarmSourceExactlyCopied)
   fail('APP755_759_REVIEW_SOURCE_NOT_IDENTICAL');
 writeFileSync(join(dir,'review-manifest.json'),JSON.stringify(candidate.manifest,null,2)+'\n');
 return {outputDirectory:dir,manifest:candidate.manifest};
}
async function main(){
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'').trim();
 const sourceDir=resolve(String(process.env.APP728_SOURCE_DIR||''));
 const sourceSha=String(process.env.APP728_SOURCE_SHA||'');
 const lockedPreviewSha=String(process.env.APP728_LOCKED_PREVIEW_SHA||'');
 if(!token||!sourceSha||!lockedPreviewSha||!existsSync(sourceDir))fail('INPUTS_MISSING');
 const files=Object.fromEntries(APP728_QUARANTINED_SOURCE_FILES.map(name=>{
   const p=join(sourceDir,ROOT,name);
   if(!existsSync(p))fail('SOURCE_FILE_MISSING');
   return [name,readFileSync(p,'utf8')];
 }));
 const baseline=await readPinnedProductionCode728(token);
 const candidate=createApp728PreservedSourceCandidate({
   baseline,featureSources:files,sourceSha,lockedPreviewSha,
 });
 const target=join(resolve(String(process.env.RUNNER_TEMP||'')),'app728-code-candidates');
 mkdirSync(target,{recursive:true});
 const result=writeApp728CandidateToTemp(candidate,target);
 // Only hashes/counts and HOLD; never include original Worker source or secrets.
 console.log(JSON.stringify({
   kind:result.manifest.kind,status:result.manifest.status,
   originalWorkerUnchanged:result.manifest.unchangedProductionMain,
   baselineMainSha256:result.manifest.baselineMainSha256,
   sourceOnlyCandidateFiles:result.manifest.quarantinedModules.length,
   bindingsProtected:result.manifest.existingBindingsProtected,
   integrationSeamWiredOff:result.manifest.integratedFollowSignalSeam,
   productionFollowSignalCompiledOpen:false,
   app755SourceFilesCopiedExactly:result.manifest.integration.app755SourceFilesCopiedExactly,
   app755OwnerReceiptSha256:result.manifest.integration.app755OwnerReceiptSha256,
   app755BackendSha256:result.manifest.integration.app755BackendSha256,
   activeWorkerRuntimeParityNotVerified:true,
   featureWiredToProduction:false,deployAllowed:false,
   sharedDataReads:0,workerMutations:0,testEnvironmentQueried:false,
 },null,2));
 if(process.env.GITHUB_STEP_SUMMARY){
   const {appendFileSync}=await import('node:fs');
   appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## APP728 preserved production Worker SOURCE-ONLY candidate: HOLD\n\n' +
    'Main code bytes preserved; +'+result.manifest.quarantinedModules.length+
    ' quarantined source-only modules. No Worker upload, no source log, no TEST, no data access.\n');
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error('APP728_PRODUCTION_SOURCE_CANDIDATE_ERROR:',String(e.message||e));process.exitCode=2});
}
