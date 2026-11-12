'use strict';
// APP583 QA one-pair live proof, no real-user or production access.
// This is a synthetic Worker→DO→Function→SG RTDB transport proof,
// not a production follow mutation.
const {readFileSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
const {homedir}=require('node:os');
const {join}=require('node:path');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getDatabase}=require('firebase-admin/database');
const QA='soridraw-app',NUM='1083981050742';
const DB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const WORKER='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const CONFIG=join(homedir(),'.soridraw-qa-583-worker-config.json');
const cmd=(...args)=>execFileSync('gcloud',args,{
 encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim();
const hold=(m)=>{throw Error('APP583_QA_LIVE_HOLD_'+m)};
(async()=>{
 if(process.argv.slice(2).join(' ')!=='--qa-only')hold('EXPLICIT_OPT_IN');
 if(process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_TOKEN)
  hold('CREDENTIAL_OVERRIDE');
 if(cmd('config','get-value','project')!==QA||
    cmd('projects','describe',QA,'--format=value(projectNumber)')!==NUM)
  hold('PROJECT_IDENTITY');
 const cfg=JSON.parse(readFileSync(CONFIG,'utf8'));
 if(cfg.projectId!==QA||cfg.projectNumber!==NUM||
    cfg.ownerUid===cfg.actorUid||!/^[0-9a-f]{32}$/.test(cfg.authEpoch)||
    !/^[0-9a-f]{64}$/.test(cfg.probeToken))
  hold('QA_CONFIGURATION');
 const credential={async getAccessToken(){return {
  access_token:cmd('auth','print-access-token'),expires_in:300}}};
 const app=initializeApp({projectId:QA,databaseURL:DB,credential},
  'soridraw-owner-follow-qa578');
 try{
  const auth=getAuth(app);
  const [a,b]=await Promise.all([
   auth.getUserByEmail('testa@example.com'),
   auth.getUserByEmail('testb@example.com'),
  ]);
  if(a.uid!==cfg.ownerUid||b.uid!==cfg.actorUid||
     a.customClaims?.soridrawFollowEpoch532!==cfg.authEpoch)
   hold('OWNER_CLAIM_CHANGED');
  const request=async(method,path)=>{
   const response=await fetch(WORKER+path,{method,
    headers:{'X-Owner583-Token':cfg.probeToken},
    signal:AbortSignal.timeout(15000)});
   const data=await response.json().catch(()=>null);
   if(!response.ok||!data?.ok)hold('WORKER_'+response.status+'_'+String(data?.error||''));
   return data;
  };
  const baseline=await request('GET','/qa583/status');
  if(baseline.pending||baseline.following)
   hold('EXISTING_PENDING_OR_ALREADY_FOLLOWING');
  const ref=getDatabase(app,DB).ref('ownerFollowerSync532/'+a.uid);
  const awaitMarker=(min,expected)=>{
   let onData,timeout;
   const promise=new Promise((resolve,reject)=>{
    timeout=setTimeout(()=>{ref.off('value',onData);
     reject(Error('QA_RECEIPT_TIMEOUT'));},20000);
    onData=s=>{
     const v=s.val();
     if(v?.authEpoch===cfg.authEpoch&&v?.version>=min&&
        v?.followerCount===expected){
      clearTimeout(timeout);ref.off('value',onData);resolve(v);
     }
    };
    ref.on('value',onData,error=>{clearTimeout(timeout);
     ref.off('value',onData);reject(error)});
   });
   return promise;
  };
  const measure=async(method,expected)=>{
   const previous=await request('GET','/qa583/status');
   const observe=awaitMarker(previous.version+1,expected);
   const started=Date.now();
   const queued=await request(method,'/qa583/follow');
   if(!queued.changed||queued.version!==previous.version+1)
    hold('NOT_A_NEW_TRANSITION');
   const actual=await observe;
   return {revision:actual.version,count:actual.followerCount,
    latencyMs:Date.now()-started};
  };
  const follow=await measure('PUT',1);
  const unfollow=await measure('DELETE',0);
  console.log('APP583_QA_LIVE_FOLLOW_UNFOLLOW_RTDB_PASS');
  console.log('FOLLOW_LATENCY_MS='+follow.latencyMs);
  console.log('UNFOLLOW_LATENCY_MS='+unfollow.latencyMs);
  console.log('QA_OWNER_VERSION='+unfollow.revision);
  console.log('NO_CANONICAL_D1_R2_OR_PRODUCTION_REQUESTS');
 }finally{await deleteApp(app)}
})().catch(e=>{console.error(String(e?.message||e));process.exitCode=1});
