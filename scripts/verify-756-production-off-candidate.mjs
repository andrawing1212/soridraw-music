// APP756: actual assembled, source-only production OFF candidate regression.
// Offline synthetic canonical module; Cloudflare active version fingerprint is
// pinned by APP728 before any REAL candidate can be constructed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeApp728CandidateToTemp} from './app728-production-source-candidate.mjs';
import {buildApp729ProductionIntegrationEntry} from './app729-production-follow-entry.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const original=Buffer.from([
 'export default {',
 ' marker: "SYNTHETIC_PRODUCTION_CANONICAL_UNCHANGED",',
 ' async fetch(request){return new Response("original:"+new URL(request.url).pathname,{status:207})},',
 ' scheduled(){return "original-scheduled"},',
 ' alarm(){return "original-alarm"},',
 '};',
 ''].join('\n'),'utf8');
const manifest={
 kind:'APP728_PRESERVED_PRODUCTION_CODE_REVIEW',
 status:'HOLD',executable:false,uploadAllowed:false,deployAllowed:false,
 activeVersion:'af81502a-298d-4ec6-bc2a-0c529d6dc29e',
 baselineMainSha256:sha(original),unchangedProductionMain:true,
 existingBindingsProtected:12,addedBindings:0,addedDurableObjectClasses:0,
 addedMigrations:0,newRoutes:0,quarantinedModules:[],
 releaseBlockers:['SERVER_AUTH_DURABLE_RECEIPT_AND_RECEIVER_NOT_PROVEN'],
};
const candidate=()=>({unchangedMain:Buffer.from(original),review:[],
 manifest:structuredClone(manifest)});
const runRoot=mkdtempSync(join(tmpdir(),'soridraw-app756-'));
const originalEnv=process.env.RUNNER_TEMP;
process.env.RUNNER_TEMP=runRoot;
try{
 const target=join(runRoot,'review');
 mkdirSync(target,{recursive:true});
 const built=writeApp728CandidateToTemp(candidate(),target);
 assert.equal(built.manifest.kind,manifest.kind);
 assert.equal(built.manifest.status,'HOLD');
 assert.equal(built.manifest.deployAllowed,false);
 assert.equal(built.manifest.uploadAllowed,false);
 assert.equal(built.manifest.executable,false);
 assert.equal(built.manifest.existingBindingsProtected,12);
 assert.equal(built.manifest.integration.runtimeEnabled,false);
 assert.equal(built.manifest.integration.deployable,false);
 assert.equal(built.manifest.integration.originalMainUntouched,true);
 assert.equal(built.manifest.integration.productionOwnerDoReceiptSourceOnly,true);
 assert.equal(built.manifest.integration.productionOwnerDoBindingAndMigrationAdded,false);
 assert.equal(built.manifest.integration.productionFunction542SenderUnconnected,true);
 assert.equal(built.manifest.integration.app755SourceFilesCopiedExactly,true);
 assert.equal(built.manifest.integration.app759OwnerAlarmSourceExactlyCopied,true);
 assert.equal(built.manifest.integration.app761OwnerDoRuntimeSourceExactlyCopied,true);
 assert.equal(built.manifest.integration.productionOwnerRuntimeCompositionSourceOnly,true);
 assert.equal(built.manifest.integration.productionOwnerAlarmReplaySourceOnly,true);
 assert.equal(built.manifest.integration.activeWorkerRuntimeParityNotVerified,true);
 assert.equal(built.manifest.integration.productionDeployAuthorized,false);
 assert.equal(built.manifest.integration.productionBridgeImplementationDependenciesInjected,false);
 const entry=buildApp729ProductionIntegrationEntry();
 assert.equal(built.manifest.integration.entrypointSha256,entry.sha256);
 assert.equal(sha(readFileSync(join(built.outputDirectory,'production-main.mjs'))),sha(original));
 assert.equal(readFileSync(join(built.outputDirectory,'production-main.mjs')).equals(original),true);
 assert.equal(sha(readFileSync(join(built.outputDirectory,'production-follow-entry.mjs'))),entry.sha256);
 const parsed=JSON.parse(readFileSync(join(built.outputDirectory,'review-manifest.json'),'utf8'));
 assert.deepEqual(parsed,built.manifest);
 const [base,assembled]=await Promise.all([
   import(pathToFileURL(join(built.outputDirectory,'production-main.mjs')).href),
   import(pathToFileURL(join(built.outputDirectory,'production-follow-entry.mjs')).href),
 ]);
 assert.strictEqual(assembled.default,base.default,
   'OFF candidate must export EXACT same original Worker object reference');
 assert.strictEqual(assembled.default.fetch,base.default.fetch);
 assert.strictEqual(assembled.default.scheduled,base.default.scheduled);
 assert.strictEqual(assembled.default.alarm,base.default.alarm);
 const response=await assembled.default.fetch(new Request('https://soridraw.com/v1/profiles/synthetic/follow'));
 assert.equal(response.status,207);
 assert.equal(await response.text(),'original:/v1/profiles/synthetic/follow');
 assert.equal(assembled.default.scheduled(),'original-scheduled');
 assert.equal(assembled.default.alarm(),'original-alarm');
 const backendSource=readFileSync(join(built.outputDirectory,'integration','app755-production-follow-backend.mjs'),'utf8');
 const receiptSource=readFileSync(join(built.outputDirectory,'integration','app755-production-owner-receipt.mjs'),'utf8');
 const alarmSource=readFileSync(join(built.outputDirectory,'integration','app759-production-owner-alarm.mjs'),'utf8');
 const ownerDoRuntimeSource=readFileSync(join(built.outputDirectory,'integration','app761-production-owner-do-runtime.mjs'),'utf8');
 assert(backendSource.includes('APP755_PRODUCTION_BACKEND_COMPILED_OPEN=false'));
 assert(receiptSource.includes('APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN=false'));
 assert(alarmSource.includes('APP759_PRODUCTION_OWNER_ALARM_COMPILED_OPEN=false'));
 assert(ownerDoRuntimeSource.includes('APP761_PRODUCTION_OWNER_DO_RUNTIME_COMPILED_OPEN=false'));
 assert.equal(built.manifest.integration.app761OwnerDoRuntimeSha256,sha(ownerDoRuntimeSource));
 assert.equal(built.manifest.integration.app759AlarmSha256,sha(alarmSource));
 assert.equal(built.manifest.integration.app755BackendSha256,sha(backendSource));
 assert.equal(built.manifest.integration.app755OwnerReceiptSha256,sha(receiptSource));
 assert.equal(existsSync(join(built.outputDirectory,'wrangler.toml')),false);
 assert.equal(existsSync(join(built.outputDirectory,'migrations')),false);
 assert.equal(existsSync(join(built.outputDirectory,'.deploy')),false);
 const bad=candidate();bad.unchangedMain[1]^=1;
 assert.throws(()=>writeApp728CandidateToTemp(bad,target),/PRODUCTION_MAIN_NOT_PRESERVED/);
 assert.throws(()=>writeApp728CandidateToTemp(candidate(),runRoot),
   /RUNNER_TEMP_ONLY/);
 console.log('APP756_ASSEMBLED_PRODUCTION_OFF_ENTRY_EXACT_WORKER_EXPORT_AND_FETCH=PASS');
 console.log('APP756_APP755_RECEIPT_AND_BACKEND_INCLUDED_OFF_NO_BINDINGS=PASS');
 console.log('APP756_ORIGINAL_SOURCE_HASH_MANIFEST_HOLD_AND_RUNNER_TEMP_GUARDS=PASS');
 console.log('APP756_REAL_ACTIVE_WORKER_BYTES_AND_HOSTING_DEPLOY=NOT_RUN');
}finally{
 if(originalEnv===undefined)delete process.env.RUNNER_TEMP;
 else process.env.RUNNER_TEMP=originalEnv;
 rmSync(runRoot,{recursive:true,force:true});
}
