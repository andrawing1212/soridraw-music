import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const configs={
 preview:{environment:'preview',batchRoot:'privateLikeBatch416',timingPath:'likeBatchTiming416/current',taskTarget:'stage416SettlePrivateWindowCandidate',workerEndpoint:'https://soridraw-explore-preview.andrawing1212.workers.dev/v1/internal/private-like-handoff-416'},
 test:{environment:'test',batchRoot:'privateLikeBatch416Test',timingPath:'likeBatchTiming416/test/current',taskTarget:'stage416SettlePrivateWindowTest416',workerEndpoint:'https://soridraw-explore-test.andrawing1212.workers.dev/v1/internal/private-like-handoff-416'},
 production:{environment:'production',batchRoot:'privateLikeBatch416Production',timingPath:'likeBatchTiming416/production/current',taskTarget:'stage416SettlePrivateWindowProduction416',workerEndpoint:'https://soridraw-explore-api.andrawing1212.workers.dev/v1/internal/private-like-handoff-416'},
};
const taskSource=readFileSync('functions/src/exploreLikePrivateTask416.ts','utf8');
const output=ts.transpileModule(taskSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};const triggers=[];const dispatchers=[];const enqueues=[];const deliveries=[];
const context={module:{exports},exports,process:{env:{}},String,Number,Date,Error,fetch:async()=>{},console,
 require:id=>{
  if(id==='node:crypto')return {createHash};
  if(id==='firebase-admin/functions')return {getFunctions:()=>({taskQueue:target=>({enqueue:async(data,options)=>enqueues.push({target,data,options})})})};
  if(id==='firebase-admin/database')return {getDatabase:()=>({})};
  if(id==='firebase-functions/v2/database')return {onValueCreated:(options,handler)=>{triggers.push({options,handler});return handler;}};
  if(id==='firebase-functions/v2/tasks')return {onTaskDispatched:(options,handler)=>{dispatchers.push({options,handler});return handler;}};
  if(id==='firebase-functions/params')return {defineSecret:()=>({value:()=> 'secret'})};
  if(id==='./exploreLikeEnvironment416')return {STAGE416_ENVIRONMENTS:configs};
  if(id==='./exploreLikePrivateDeadline416')return {
   scheduleInitialPrivateWindow416:async(queue,task,window)=>queue.enqueue(task,{scheduleTime:new Date(window.lastClickAtMs+window.minutes*60000)}),
   dispatchPrivateWindowTask416:async(_db,_queue,task,endpoint,_secret,_now,_http,root)=>{deliveries.push({task,endpoint,root});return {status:'DELIVERED'};},
  };
  throw Error('unexpected import '+id);
 }};
vm.runInNewContext(output,context,{timeout:2000});
assert.deepEqual(triggers.map(row=>row.options.ref),[
 'privateLikeBatch416/{uid}/window','privateLikeBatch416Test/{uid}/window','privateLikeBatch416Production/{uid}/window',
]);
const uuid='00000000-0000-4000-8000-000000000001';
for(const [index,trigger] of triggers.entries())await trigger.handler({params:{uid:'u'+index},data:{val:()=>({id:uuid,lastClickAtMs:1000,minutes:5})}});
assert.deepEqual(enqueues.map(row=>row.target),Object.values(configs).map(row=>row.taskTarget));
for(const [index,dispatcher] of dispatchers.entries())await dispatcher.handler({data:{uid:'u'+index,windowId:uuid}});
assert.deepEqual(deliveries.map(row=>row.root),Object.values(configs).map(row=>row.batchRoot));
assert.deepEqual(deliveries.map(row=>row.endpoint),Object.values(configs).map(row=>row.workerEndpoint));
assert(!deliveries.slice(1).some(row=>row.endpoint.includes('preview')),'TEST/PRODUCTION must never use PREVIEW fallback');

const clientSource=readFileSync('src/services/stage416Environment416.ts','utf8');
const clientOutput=ts.transpileModule(clientSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const clientExports={};vm.runInNewContext(clientOutput,{module:{exports:clientExports},exports:clientExports,String,window:undefined});
assert.equal(clientExports.getStage416CallableName416('preview.soridraw.com'),'recordPrivateLike416');
assert.equal(clientExports.getStage416CallableName416('test.soridraw.com'),'recordPrivateLikeTest416');
assert.equal(clientExports.getStage416CallableName416('soridraw.com'),'recordPrivateLikeProduction416');

const settings=readFileSync('functions/src/exploreLikeBatchSettings416.ts','utf8');
assert.match(settings,/database\.ref\(timingPath\)/);
assert.equal(new Set(Object.values(configs).map(row=>row.timingPath)).size,3);
const transport=readFileSync('src/services/exploreLikePrivateRtdbTransport416.ts','utf8');
const likeService=readFileSync('src/services/exploreLikeService.ts','utf8');
assert.match(transport,/STAGE416_SHARED_RTDB_BATCH_ACTIVE=false/);
assert.match(likeService,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
console.log('STAGE416_PREVIEW_LEGACY_IDENTITY_COMPATIBLE=PASS');
console.log('STAGE416_TEST_PRODUCTION_ROOT_TASK_ENDPOINT_ISOLATION=PASS');
console.log('STAGE416_CROSS_ENV_EVENT_TASK_LEAKAGE_ZERO=PASS');
console.log('STAGE416_CALLABLE_HOST_SELECTION=PASS');
console.log('STAGE416_TIMING_CONFIG_ISOLATION=PASS');
console.log('STAGE416_GENERAL_CLIENT_FLAGS_OFF=PASS');
