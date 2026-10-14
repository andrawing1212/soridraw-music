import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const config={
 environment:'preview',
 workerEndpoint:'https://soridraw-explore-preview.andrawing1212.workers.dev/v1/internal/private-like-handoff-416',
 publicReleaseTaskName:'stage416ReleasePublicWindowCandidate',
};
const enqueues=[];
const queue={enqueue:async(task,opts)=>{
 if(enqueues.some(x=>x.opts.id===opts.id)){
   const error=new Error('already');error.code='functions/task-already-exists';throw error;
 }
 enqueues.push({task,opts});
}};
const source=readFileSync('functions/src/exploreLikePublicTask416.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,URL,Date,JSON,Object,Array,Number,Set,Map,Error,Buffer,
 require:ref=>{
   if(ref==='node:crypto')return require(ref);
   if(ref==='firebase-admin/functions')return {getFunctions:()=>({taskQueue:()=>queue})};
   if(ref==='firebase-functions/v2/tasks')return {onTaskDispatched:(_opts,handler)=>handler};
   if(ref==='firebase-functions/params')return {defineSecret:()=>({value:()=>'x'.repeat(40)})};
   if(ref==='./exploreLikeEnvironment416')return {STAGE416_ENVIRONMENTS:{
     preview:config,
     test:{...config,environment:'test',publicReleaseTaskName:'stage416ReleasePublicWindowTest'},
     production:{...config,environment:'production',publicReleaseTaskName:'stage416ReleasePublicWindowProduction'},
   }};
   throw Error('unexpected dependency '+ref);
 },
 fetch:async()=>({ok:true,json:async()=>({ok:true,data:{status:'EMPTY'}})}),
},{timeout:2500});
const schedule=mod.exports.schedulePublicLikeRelease416;
const base=1_700_100_000_000;
const windowId='00000000-0000-4000-8000-000000000001';
await schedule(config,windowId,base+300_000,base);
await schedule(config,windowId,base+300_000,base+1000);
assert.equal(enqueues.length,1,'exact public release task retry is enqueue W0');
assert.equal(enqueues[0].task.deadlineAtMs,base+300_000);
assert.equal(enqueues[0].opts.scheduleTime.getTime(),base+300_000);
assert.match(enqueues[0].opts.id,/^s416-public-[0-9a-f]{64}$/);

const finalEndpoint=readFileSync('functions/src/exploreLikePrivateFinalEndpoint416.ts','utf8');
const regAt=finalEndpoint.indexOf('const registration=await deliverPublicLikeWindow416');
const taskAt=finalEndpoint.indexOf('await schedulePublicLikeRelease416',regAt);
const checkpointAt=finalEndpoint.indexOf('await markPublicWindowRegistered416',regAt);
const ackAt=finalEndpoint.indexOf('await ackPublicLikeWindow416',regAt);
assert(regAt>=0&&taskAt>regAt&&checkpointAt>taskAt&&ackAt>checkpointAt,
 'register -> deterministic task -> Firebase checkpoint -> Worker ACK ordering');
assert.match(finalEndpoint,/registration\.opened\|\|registration\.duplicate/);
assert.match(finalEndpoint,/STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/const STAGE416_PUBLIC_RELEASE_ROUTE='\/v1\/internal\/public-like-release-416'/);
assert.match(entry,/X-Soridraw-416-Public-Task-Signature/);
assert.match(entry,/expectedWindowId:String\(body\?\.windowId\|\|''\)/);
assert.match(entry,/SORIDRAW_PUBLIC_RELEASE416_ENDPOINT/);
assert.match(entry,/const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);

const releaseCore=readFileSync('cloudflare/explore-worker/runtime/public-like-release-416.mjs','utf8');
assert.match(releaseCore,/status:'STALE_TASK'/);
const staleAt=releaseCore.indexOf("status:'STALE_TASK'");
const projectionAt=releaseCore.indexOf('const projectionResult=await materialize');
assert.ok(staleAt>=0&&projectionAt>staleAt,
 'stale task must stop before D1/R2 projection');

const endpoint=readFileSync('functions/src/exploreLikePublicReleaseEndpoint416.ts','utf8');
assert.match(endpoint,/X-Soridraw-416-Public-Release-Signature/);
assert.match(endpoint,/config\.publicReleaseMarkerRoot/);
const index=readFileSync('functions/src/index.ts','utf8');
assert.match(index,/export \{ stage416ReleasePublicWindowCandidate \} from "\.\/exploreLikePublicTask416"/);
assert.match(index,/export \{ publicLikeRelease416Candidate \} from "\.\/exploreLikePublicReleaseEndpoint416"/);
assert.doesNotMatch(index,/export \{ stage416ReleasePublicWindowTest/);
assert.doesNotMatch(index,/export \{ publicLikeRelease416Test/);
assert.match(source,/export const STAGE416_PUBLIC_RELEASE_TASK_ACTIVE=false/);
const taskDisabledAt=source.indexOf('if(!STAGE416_PUBLIC_RELEASE_TASK_ACTIVE)');
const taskRequestAt=source.indexOf('const task=validTask416(request.data');
assert.ok(taskDisabledAt>=0&&taskRequestAt>taskDisabledAt,
 'exported public task must be HARD OFF before claim/network handling');
await assert.rejects(mod.exports.stage416ReleasePublicWindowCandidate({data:{
 windowId,deadlineAtMs:base+300_000,
}}),/416_PUBLIC_RELEASE_TASK_DISABLED/);
assert.match(endpoint,/export const STAGE416_PUBLIC_RELEASE_ENDPOINT_ACTIVE=false/);
const publicEndpointDisabledAt=endpoint.indexOf('if(!STAGE416_PUBLIC_RELEASE_ENDPOINT_ACTIVE)');
const publishAt=endpoint.indexOf('const data=await publishPublicLikeRelease416(');
assert.ok(publicEndpointDisabledAt>=0&&publishAt>publicEndpointDisabledAt,
 'exported public receipt must reject before shared RTDB publication');
// Independently execute the real transpiled HTTP handler with network/data
// adapters that throw if reached. An inactive endpoint must return 503 only.
const receiptOutput=ts.transpileModule(endpoint,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const receiptModule={exports:{}};
let receiptDbCalls=0,receiptPublishCalls=0;
vm.runInNewContext(receiptOutput,{module:receiptModule,exports:receiptModule.exports,
 Buffer,JSON,Object,String,Date,Error,
 require:ref=>{
   if(ref==='firebase-functions/v2/https')return {
     onRequest:(_options,handler)=>handler};
   if(ref==='firebase-functions/params')return {
     defineSecret:()=>({value:()=>'x'.repeat(40)})};
   if(ref==='firebase-admin/database')return {
     getDatabase:()=>{receiptDbCalls++;throw Error('UNEXPECTED_SHARED_RTDB_IO')}};
   if(ref==='./exploreLikePublicRelease416')return {
     publishPublicLikeRelease416:()=>{receiptPublishCalls++;throw Error('UNEXPECTED_PUBLISH_IO')}};
   if(ref==='./exploreLikeEnvironment416')return {
     STAGE416_ENVIRONMENTS:{preview:config,test:config,production:config}};
   throw Error('unexpected public endpoint dependency '+ref);
 }
},{timeout:2500});
let receiptStatus=0,receiptPayload=null;
const receiptRes={
 status(code){receiptStatus=code;return this;},
 json(body){receiptPayload=body;return this;},
};
await receiptModule.exports.publicLikeRelease416Candidate({
 method:'POST',rawBody:Buffer.from('{}'),header:()=>''},receiptRes);
assert.equal(receiptStatus,503);
assert.equal(receiptPayload?.error?.code,'416_PUBLIC_RELEASE_DISABLED');
assert.equal(receiptDbCalls,0);
assert.equal(receiptPublishCalls,0);
console.log('STAGE416_PUBLIC_TASK_DETERMINISTIC_RETRY_W0=PASS');
console.log('STAGE416_PUBLIC_REGISTER_TASK_CHECKPOINT_ACK_ORDER=PASS');
console.log('STAGE416_PUBLIC_STALE_TASK_BEFORE_D1_R2=PASS');
console.log('STAGE416_PUBLIC_EXPORTED_ENDPOINTS_HARD_OFF_NO_SHARED_IO=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
