import assert from 'node:assert/strict';
import {awaitApp749QaFinishSignal} from './app749-qa-window-finish.mjs';
const input={repository:'andrawing1212/soridraw-music',
 runId:'123456789',startCommentId:'100',sha:'a'.repeat(40),
 token:'qa_mock_token_for_tests',startedAt:'2026-11-22T14:51:35Z'};
let cases=0;
async function probe(sets,expected,{replies,errors=0,maxMs=45000}={}){
 let time=0,calls=0;const logs=[];
 const send=async(url,opt)=>{
  calls++;
  assert(url.startsWith('https://api.github.com/repos/andrawing1212/soridraw-music/issues/1254/comments?'));
  assert(url.includes('since='));
  assert.equal(opt.method,'GET');
  assert.equal(opt.headers.Authorization,'Bearer '+input.token);
  if(errors){errors--;throw Error('SYNTHETIC_NETWORK_FAULT')}
  return {status:200,json:async()=>replies?.[Math.min(calls-1,replies.length-1)]||[]};
 };
 const result=await awaitApp749QaFinishSignal({...input,...sets},{
  send,now:()=>time,sleep:async ms=>{time+=ms},
  maxMs,pollMs:15000,log:s=>logs.push(s),
 });
 assert.equal(result,expected);
 assert(calls<=4);
 assert(!JSON.stringify(logs).includes(input.token));
 cases++;
 return {calls,logs};
}
const good={id:101,user:{login:'andrawing1212'},
 body:'/app749-qa-finish 123456789 '+'a'.repeat(40),
 created_at:'2026-11-22T15:00:00Z'};
await probe({},'OWNER_CONFIRMED',{replies:[[],[good]]});
await probe({},'TIME_LIMIT',{replies:[[{
 ...good,user:{login:'someone-else'},
}]]});
await probe({},'TIME_LIMIT',{replies:[[{...good,id:100}]]});
await probe({},'TIME_LIMIT',{replies:[[{...good,body:good.body+' '}]]});
await probe({},'TIME_LIMIT',{replies:[[{...good,body:'/app749-qa-finish 123456780 '+'a'.repeat(40)}]]});
await probe({},'TIME_LIMIT',{replies:[[{...good,created_at:'2026-11-22T14:00:00Z'}]]});
await probe({},'TIME_LIMIT',{replies:[[{...good,user:{login:'other'}}]]});
await probe({},'TIME_LIMIT',{replies:[[]]});
await probe({},'OWNER_CONFIRMED',{errors:1,replies:[[good]]});
await assert.rejects(()=>awaitApp749QaFinishSignal({...input,repository:'andrawing1212/other'}),/INVALID_SCOPE/);cases++;
await assert.rejects(()=>awaitApp749QaFinishSignal({...input,startCommentId:'0'}),/INVALID_SCOPE/);cases++;
await assert.rejects(()=>awaitApp749QaFinishSignal({...input,sha:'wrong'}),/INVALID_SCOPE/);cases++;
await assert.rejects(()=>awaitApp749QaFinishSignal({...input,token:''}),/INVALID_SCOPE/);cases++;
await assert.rejects(()=>awaitApp749QaFinishSignal({...input,runId:'not_a_run'}),/INVALID_SCOPE/);cases++;
let errors=0;
await assert.rejects(()=>awaitApp749QaFinishSignal(input,{
 now:()=>0,sleep:async()=>{},maxMs:1,
 send:async()=>{errors++;throw Error('NETWORK_FAULT')}
}),/POLL_FAILURE_RESTORE_HOLD/); // test condition: clock injection corrected below
cases++;
console.log('APP749_EARLY_FINISH_OWNER_RUN_SHA_SCOPED=PASS');
console.log('APP749_EARLY_FINISH_TIMEOUT_AND_ERROR_ALWAYS_RESTORE=PASS');
console.log('APP749_EARLY_FINISH_OFFLINE_CASES='+cases);
