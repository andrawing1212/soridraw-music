// APP567: source-scoped live read-only PREVIEW owner follower compatibility.
// Uses an ephemeral Google OAuth access token from GitHub Actions; no user rows,
// Firebase Auth user reads/writes, Functions invocation, RTDB data or deployments.
import assert from 'node:assert/strict';

const PROJECT='soridraw-app-866a5';
const RTDB='https://soridraw-app-866a5-default-rtdb.firebaseio.com/.settings/rules.json';
const API='https://cloudfunctions.googleapis.com/v2/projects/'+PROJECT+'/locations/asia-northeast3/functions/';
const FUNCTIONS=['publishExploreOwnerFollower542','enrollOwnerFollow544Candidate'];

export async function inspectOwnerFollowFirebase567({token,fetcher=fetch}={}){
 assert.ok(typeof token==='string'&&token.length>20,'APP567_NO_OAUTH_TOKEN_HOLD');
 const read=async(url,label)=>{
   const res=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
   if(res.status===404)return {status:404,json:null};
   if(!res.ok)throw Error('APP567_'+label+'_READONLY_GET_FAILED_HTTP_'+res.status);
   const json=await res.json();
   return {status:res.status,json};
 };
 const {status:rulesStatus,json:rulesData}=await read(RTDB,'RULES');
 const rules=rulesData?.rules;
 const owner=rules?.ownerFollowerSync532?.$uid;
 const protectedRead=typeof owner?.['.read']==='string'&&
   owner['.read'].includes('auth.uid === $uid')&&
   owner['.read'].includes('soridrawFollowEpoch532')&&
   owner['.read'].includes('data.child(\'authEpoch\')');
 const ownerWriteDenied=owner?.['.write']===false;
 const rootDenied=rules?.['.read']===false&&rules?.['.write']===false;
 const statuses=[];
 for(const name of FUNCTIONS){
   const {status,json}=await read(API+name,'FUNCTION_'+name);
   statuses.push({name,status,state:status===200?String(json?.state||'UNKNOWN'):'ABSENT'});
 }
 const ready=rulesStatus===200&&protectedRead&&ownerWriteDenied&&rootDenied&&
   statuses.every(x=>x.state==='ACTIVE');
 return {project:PROJECT,rtDbRulesPresent:rulesStatus===200,
   ownerPrivateEpochRead:Boolean(protectedRead),ownerClientWriteDenied:Boolean(ownerWriteDenied),
   existingRootDenied:Boolean(rootDenied),functions:statuses,
   status:ready?'RULES_FUNCTIONS_PRESENT_RECHECK_AUTH_DO_D1_COST':'NO_GO_BACKEND_NOT_READY'};
}

if(process.argv.includes('--self-test')){
 const token='012345678901234567890123456789';
 const matches=[];
 const fake=async(url,init)=>{
   assert.equal(init.method,'GET');assert.match(init.headers.Authorization,/^Bearer /);
   matches.push(url);
   if(url===RTDB)return {status:200,ok:true,json:async()=>({rules:{'.read':false,'.write':false,
    ownerFollowerSync532:{$uid:{'.read':"auth != null && auth.uid === $uid && auth.token.soridrawFollowEpoch532 != null && auth.token.soridrawFollowEpoch532 === data.child('authEpoch').val()",'.write':false}}}})};
   return {status:404,ok:false};
 };
 const summary=await inspectOwnerFollowFirebase567({token,fetcher:fake});
 assert.equal(summary.status,'NO_GO_BACKEND_NOT_READY');
 assert.equal(summary.ownerPrivateEpochRead,true);
 assert.equal(summary.ownerClientWriteDenied,true);
 assert.equal(matches.length,3);
 console.log('FOLLOW_567_FIREBASE_READONLY_GET_AND_NO_GO_HOLD=PASS');
}else if(process.argv.includes('--live')){
 const summary=await inspectOwnerFollowFirebase567({token:process.env.FIREBASE_READONLY_ACCESS_TOKEN});
 console.log('FOLLOW_567_FIREBASE_METADATA='+JSON.stringify(summary));
 console.log('FOLLOW_567_RELEASE_GUARD='+summary.status);
}else{
 throw Error('APP567_EXPLICIT_SELF_TEST_OR_LIVE_REQUIRED');
}
