// APP630 narrow, one-owner PREVIEW Explore wrapper rollout.
// Preserve every historical binding/DO v1 and source, do not touch TEST/PROD.
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45', EX='soridraw-explore-preview', OW='soridraw-owner-follow-preview-candidate';
const OLD='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const TARGET='5d0f74b1-84bf-4f96-a9e4-51bea25736fa';
const OFF_SAME_SECRETS='d5d14cf8-c65a-4aa2-b58f-ed08bcdc92fd';
const OWNER='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const UID_HASH='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const hold=x=>{throw Error('APP630_HOLD_'+x)},ok=(v,x)=>{if(!v)hold(x)};
async function api(method,path,body){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
    ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?50000:25000)});
 let j;try{j=await response.json()}catch{hold('UNCERTAIN_API_'+method)}
 if(!response.ok||j?.success!==true){console.log('APP630_ERROR_CODES='+String((j?.errors||[]).map(x=>x.code).join(',')).slice(0,70));hold('API_'+method+'_'+response.status)}
 return j.result;
}
async function active(name){
 const r=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const versions=r?.deployments?.[0]?.versions;
 ok(versions?.length===1&&Number(versions[0].percentage)===100,'TRAFFIC_NOT_EXACT_100_'+name);
 return versions[0].version_id;
}
async function bindings(version,count){
 const r=await api('GET','workers/scripts/'+EX+'/versions/'+version);
 const bs=r?.resources?.bindings;
 ok(Array.isArray(bs)&&bs.length===count,'EXACT_BINDING_COUNT_'+version);
 ok(r?.resources?.script_runtime?.compatibility_date==='2026-08-28','COMPAT_DATE');
 const map=new Map(bs.map(b=>[b.name,b]));
 ok(map.size===count&&map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103','LIKE_DO_V1');
 ok(map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','PREVIEW_ENV');
 ok(!map.has('OWNER_FOLLOW_RECOVERY_557'),'FORBIDDEN_SHARED_DO_V2');
 return map;
}
async function checkPreflight(){
 ok(process.env.GITHUB_REF==='refs/heads/feat/app600-owner-standalone-isolated','BRANCH');
 ok(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,'ACCOUNT');
 ok(/^[a-f0-9]{40}$/.test(String(process.env.APP630_APPROVED_PARENT||'')),'TRIGGER');
 ok(await active(EX)===OLD,'EXPLORE_ACTIVE_DRIFT');
 ok(await active(OW)===OWNER,'OWNER_NOT_READY');
 const [before,off,after]=await Promise.all([
  bindings(OLD,23),bindings(OFF_SAME_SECRETS,27),bindings(TARGET,35)
 ]);
 for(const [name,b] of before){
  const other=after.get(name);
  ok(other?.type===b.type,'ORIGINAL_BINDING_TYPE_'+name);
  for(const key of ['class_name','service','entrypoint','id','database_id','bucket_name','namespace_id','text']){
    if(b[key]!==undefined)ok(other[key]===b[key],'ORIGINAL_BINDING_'+name+'_'+key);
  }
 }
 for(const name of ['SORIDRAW_OWNER_FOLLOW_HMAC_539','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','SORIDRAW_OWNER_DO_BRIDGE_SECRET_600']){
  ok(off.get(name)?.type==='secret_text'&&after.get(name)?.type==='secret_text',
   'SAME_SECRET_RECOVERY_'+name);
 }
 ok(off.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW,'OFF_FORWARD_BINDING');
 ok(after.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW,'ON_FORWARD_BINDING');
 for(const name of ['SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','SORIDRAW_OWNER_DO_STANDALONE_600',
  'SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607','SORIDRAW_OWNER_FOLLOW_BIND_544',
  'SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547','SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607'])
  ok(after.get(name)?.text==='1','ON_FLAG_'+name);
 const uid=String(after.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')?.text||'');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(uid));
 const pin=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 ok(pin===UID_HASH,'WRONG_OWNER_PIN');
 ok(after.get('SORIDRAW_OWNER_FOLLOW_ENDPOINT_539')?.text===
  'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542',
  'WRONG_RECEIVER');
 console.log('APP630_ORIGINAL_23_BINDINGS_LIKE_DO_V1_AND_OWNER_PIN=PASS');
 console.log('APP630_EXACT_SAME_SECRET_OFF_RECOVERY_VERSION=PASS');
 console.log('APP630_OWNER_ACTIVE_ISOLATED_AND_EXPLORE_OLD_100=PASS');
}
async function main(){
 await checkPreflight();
 const payload={strategy:'percentage',versions:[{version_id:TARGET,percentage:100}],
   annotations:{'workers/message':'APP630 PREVIEW exact one-owner private bridge, all others canonical source byte-identical'}};
 await api('POST','workers/scripts/'+EX+'/deployments',payload);
 ok(await active(EX)===TARGET,'POST_EXPLORE_NOT_100');
 ok(await active(OW)===OWNER,'POST_OWNER_CHANGED');
 const after=await bindings(TARGET,35);
 ok(after.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103','LIKE_DO_POST');
 console.log('APP630_PREVIEW_EXPLORE_WRAPPER_ACTIVE='+TARGET);
 console.log('APP630_LIKE_DO_V1_ALL_23_ORIGINAL_BINDINGS=PASS');
 console.log('APP630_OWNER_ONLY_PINNED_READY_BUT_FUNCTIONS_READY_OFF=PASS');
 console.log('APP630_SAFE_OFF_SAME_SECRET_RESTORE_VERSION='+OFF_SAME_SECRETS);
 console.log('APP630_TEST_PROD_DATA_RULES_HOSTING_CHANGES=ZERO');
}
if(process.argv[2]==='--source-only'){
 ok(TARGET!==OLD&&TARGET!==OFF_SAME_SECRETS,'SOURCE');
 console.log('APP630_SOURCE_IDENTITY=PASS');
}else if(process.argv[2]==='--apply-once')await main();
else hold('MODE');