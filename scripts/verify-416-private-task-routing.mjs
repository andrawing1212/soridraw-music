import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const src=readFileSync('functions/src/exploreLikePrivateTask416.ts','utf8');
const output=ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017,
}}).outputText;
const exports={};let triggered=0,dispatched=0,queueCalls=[];
const uuid='00000000-0000-4000-8000-000000000001';
const fakeTaskQueue={enqueue:async(task,opt)=>{
 queueCalls.push({task,opt});if(queueCalls.length===2){
   const err=new Error('duplicate');err.code='functions/task-already-exists';throw err;
 }}};
const context={
 module:{exports},exports,process:{env:{}},String,Number,Date,Error,
 require:id=>{
 if(id==='node:crypto')return {createHash:()=>( {update:function(x){this.x=x;return this},
 digest:function(){return 'a'.repeat(64)}})};
 if(id==='firebase-admin/functions')return {getFunctions:()=>({taskQueue:()=>fakeTaskQueue})};
 if(id==='firebase-admin/database')return {getDatabase:()=>({})};
 if(id==='firebase-functions/v2/database')return {onValueCreated:(_o,fn)=>{
   triggered++;return fn;}};
 if(id==='firebase-functions/v2/tasks')return {onTaskDispatched:(_o,fn)=>{
   dispatched++;return fn;}};
 if(id==='firebase-functions/params')return {defineSecret:()=>({value:()=>''})};
 if(id==='./exploreLikePrivateDeadline416')return {
   scheduleInitialPrivateWindow416:async(q,t,w)=>{
     await q.enqueue(t,{scheduleTime:new Date(w.lastClickAtMs+w.minutes*60000)});
   },
   dispatchPrivateWindowTask416:async()=>{throw Error('task must be inactive');},
 };
 throw Error('unknown import '+id);
 }};
vm.runInNewContext(output,context,{timeout:1500});
const {stage416SchedulePrivateWindowCandidate:schedule,
 stage416SettlePrivateWindowCandidate:settle}=exports;
assert.equal(triggered,1);assert.equal(dispatched,1);
const event={params:{uid:'uid-A'},data:{val:()=>({
 id:uuid,lastClickAtMs:1_700_000_000_000,minutes:5})}};
await schedule(event);
assert.equal(queueCalls.length,1);
assert.equal(queueCalls[0].opt.scheduleTime.getTime(),1_700_000_300_000);
assert.equal(queueCalls[0].task.uid,'uid-A');
await schedule(event);
assert.equal(queueCalls.length,2);
assert.equal(queueCalls[0].opt.id,queueCalls[1].opt.id,
 'same window creation retry must use identical Cloud Tasks ID');
assert.match(queueCalls[0].opt.id,/^s416-[a-f0-9]{64}$/);
await assert.rejects(settle({data:{uid:'uid-A',windowId:uuid}}),/BINDING_MISSING/);
assert.doesNotMatch(readFileSync('functions/src/index.ts','utf8'),
 /stage416SchedulePrivateWindowCandidate|stage416SettlePrivateWindowCandidate/);
console.log('STAGE416_RTD_B_NEW_WINDOW_ONLY_CLOUD_TASK_ENQUEUE=PASS');
console.log('STAGE416_TASK_IDEMPOTENCE_AND_FAIL_CLOSED_BINDINGS=PASS');
console.log('STAGE416_TASK_TRIGGERS_NOT_DEPLOYED=PASS');
