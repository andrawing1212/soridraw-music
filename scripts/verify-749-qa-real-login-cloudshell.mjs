import assert from 'node:assert/strict';
import {readQa749Config,checkQa749Credentials,runQa749}
 from './app749-qa-real-login-cloudshell.mjs';
const now=1800000000000,sec=now/1000;
const cfg={projectId:'soridraw-app',projectNumber:'1083981050742',
 ownerUid:'qaOwnerA',actorUid:'qaActorB',authEpoch:'a'.repeat(32),
 probeToken:'b'.repeat(64)};
const mk=p=>Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'qa-test'})).toString('base64url')+'.'+
 Buffer.from(JSON.stringify(p)).toString('base64url')+'.'+'a'.repeat(120);
const auth=uid=>mk({sub:uid,iss:'https://securetoken.google.com/soridraw-app',
 aud:'soridraw-app',iat:sec-50,exp:sec+600,auth_time:sec-100});
const appId='1:1083981050742:web:aabbcc';
const creds={actorIdToken:auth(cfg.actorUid),ownerIdToken:auth(cfg.ownerUid),
 appCheckToken:mk({iss:'https://firebaseappcheck.googleapis.com/1083981050742',
 aud:['projects/1083981050742','projects/soridraw-app'],sub:appId,
 iat:sec-50,exp:sec+600}),qaAppId:appId};
assert.deepEqual(readQa749Config({wrapping:[JSON.stringify(cfg)]}),cfg);
assert(checkQa749Credentials(cfg,creds,now));
assert.throws(()=>checkQa749Credentials({...cfg,projectId:'soridraw-app-866a5'},creds,now),/QA_CONFIG/);
assert.throws(()=>checkQa749Credentials(cfg,{...creds,ownerIdToken:creds.actorIdToken},now),/IDENTITIES/);
assert.throws(()=>checkQa749Credentials(cfg,{...creds,appCheckToken:'fake'},now),/TOKEN_FORMAT/);
assert.throws(()=>checkQa749Credentials(cfg,creds,now+900000),/NOT_READY/);
let writes=0;
function session({oldWorker=false,badBaseline=false,stale=false}={}){
 let version=10,count=badBaseline?1:0;
 const results=[];
 const send=async(url,opts)=>{
  assert(url.startsWith('https://soridraw-owner-qa-583.soridraw-qa.workers.dev/')||
   url.startsWith('https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app/'));
  if(url.includes('firebasedatabase'))return {status:200,json:async()=>({
   version:stale&&version===11?10:version,
   followerCount:stale&&version===11?0:count,authEpoch:cfg.authEpoch})};
  assert(url.includes('/qa730/verified/'));
  const actor=opts.headers.Authorization==='Bearer '+creds.actorIdToken;
  const owner=opts.headers.Authorization==='Bearer '+creds.ownerIdToken;
  assert(actor||owner);
  assert.equal(opts.headers['X-Firebase-AppCheck'],creds.appCheckToken);
  if(oldWorker)return {status:403,json:async()=>({ok:false})};
  if(opts.method==='GET')return {status:200,json:async()=>({
   ok:true,qaFirebaseAuthAppCheckVerified:true,syntheticOnly:true,
   version,followerCount:count,following:count===1,pending:false,hold:false})};
  assert(actor);
  assert(['PUT','DELETE'].includes(opts.method));
  writes++;version++;count=opts.method==='PUT'?1:0;results.push(opts.method);
  return {status:200,json:async()=>({
   ok:true,qaFirebaseAuthAppCheckVerified:true,syntheticOnly:true,
   changed:true,version})};
 };
 return {send,results};
}
const good=session(),lines=[];
const result=await runQa749({config:cfg,creds,rtdbToken:'test-oauth-token-'+'x'.repeat(35),
 send:good.send,now:()=>now,delay:async()=>{},polls:2,report:x=>lines.push(x)});
assert.equal(result.status,'PASS');
assert.deepEqual([result.followVersion,result.unfollowVersion,result.finalFollowerCount],[11,12,0]);
assert.deepEqual(good.results,['PUT','DELETE']);
assert(lines.includes('APP749_QA_UNFOLLOW_RTDB_AND_TWO_SESSIONS=PASS'));
const before=writes;
await assert.rejects(()=>runQa749({config:cfg,creds,rtdbToken:'x'.repeat(40),
 send:session({oldWorker:true}).send,now:()=>now}),/REAL_SIGNED_GATE_NOT_ACTIVE/);
assert.equal(writes,before);
await assert.rejects(()=>runQa749({config:cfg,creds,rtdbToken:'x'.repeat(40),
 send:session({badBaseline:true}).send,now:()=>now}),/QA_BASELINE_NOT_ZERO/);
assert.equal(writes,before);
const stalled=session({stale:true});
await assert.rejects(()=>runQa749({config:cfg,creds,rtdbToken:'x'.repeat(40),
 send:stalled.send,now:()=>now,polls:2,delay:async()=>{}}),/FOLLOW_NOT_SETTLED/);
assert.deepEqual(stalled.results,['PUT']);
console.log('APP749_QA_RUNNER_PINNED_AUTH_PREFLIGHT=PASS');
console.log('APP749_QA_RUNNER_FOLLOW_UNFOLLOW_EXACT_TWO_MUTATIONS=PASS');
console.log('APP749_QA_RUNNER_INACTIVE_OR_DIRTY_QA_FAIL_CLOSED=PASS');
console.log('APP749_QA_REAL_FIREBASE_TOKENS_AND_PC_MOBILE=NOT_RUN');
