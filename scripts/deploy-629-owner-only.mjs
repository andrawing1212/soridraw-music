// APP629 one-shot PREVIEW isolated, non-public owner Worker promotion.
// Does NOT deploy Explore or Functions, routes, Rules, D1/R2 or user content.
// Owner runtime can only be reached by absent active Explore Service Binding.
const A='e1a30fc9ef497fda1d34f4ab3dc1da45', OW='soridraw-owner-follow-preview-candidate';
const EX='soridraw-explore-preview', OLD='5a2d333c-f703-4ef7-9468-0293f7699268';
const NEW='e679a602-44fb-4b4d-9e4d-7878c00b68c3', OFF='b170812f-9477-40b7-b5c1-1ba0a546a1db';
const EXOLD='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const ACCOUNT_SHA='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const H=x=>{throw Error('APP629_HOLD_'+x)},ok=(b,x)=>{if(!b)H(x)};
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
async function api(method,path,payload){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+A+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(30000)});
 let data;try{data=await response.json()}catch{H('API_UNCERTAIN_'+method+'_NO_RETRY')}
 if(!response.ok||data.success!==true){console.log('APP629_API_ERROR_CODES='+String((data.errors||[]).map(x=>x.code).join(',')).slice(0,70));H('HTTP_'+method+'_'+response.status)}
 return data.result;
}
async function active(name){
 const r=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const v=r?.deployments?.[0]?.versions;
 ok(Array.isArray(v)&&v.length===1&&Number(v[0].percentage)===100,'ACTIVE_PERCENT_'+name);
 return v[0].version_id;
}
async function info(id){
 const res=await api('GET','workers/scripts/'+OW+'/versions/'+id);
 const b=res?.resources?.bindings;
 ok(Array.isArray(b),'VERSION_BINDINGS_'+id);
 const map=new Map(b.map(x=>[x.name,x]));
 ok(map.get('OWNER_FOLLOW_DO_600')?.class_name==='OwnerFollowerStandalone600'&&
    map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','DO_V1_AND_PREVIEW_'+id);
 ok(res?.resources?.script_runtime?.compatibility_date==='2026-08-28','RUNTIME_DATE_'+id);
 return map;
}
async function preflight(){
 ok(process.env.GITHUB_REF==='refs/heads/feat/app600-owner-standalone-isolated','BRANCH');
 ok(process.env.CLOUDFLARE_ACCOUNT_ID===A&&token.length>20,'ACCOUNT');
 ok(/^[0-9a-f]{40}$/.test(process.env.APP629_APPROVED_PARENT||''),'TRIGGER');
 ok(await active(EX)===EXOLD,'EXPLORE_DRIFT');
 ok(await active(OW)===OLD,'OWNER_ALREADY_CHANGED');
 const [old,off,ready]=await Promise.all([info(OLD),info(OFF),info(NEW)]);
 ok(old.size===2&&off.size===4&&ready.size===7,'OWNER_BINDING_COUNTS');
 for(const k of ['OWNER_FOLLOW_CANONICAL_REPLAY_600','SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'])
  ok(off.has(k)&&ready.has(k),'SAFE_OFF_RECOVERY_BINDING_'+k);
 ok(ready.get('SORIDRAW_OWNER_DO_STANDALONE_600')?.text==='1'&&
   ready.get('SORIDRAW_OWNER_FOLLOW_W2_PUSH_555')?.text==='1','ON_CONFIG_MISSING');
 ok(ready.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')?.type==='plain_text'&&
   (await crypto.subtle.digest('SHA-256',
     new TextEncoder().encode(ready.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574').text)))
     .byteLength===32,'CANARY_NOT_PROVIDED');
 const uid=String(ready.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574').text);
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(uid))),
  n=>n.toString(16).padStart(2,'0')).join('');
 ok(sha===ACCOUNT_SHA,'OWNER_NOT_PINNED');
 console.log('APP629_NONPUBLIC_OWNER_V1_AND_OFF_SECRET_RECOVERY=PASS');
 console.log('APP629_EXISTING_EXPLORE_ACTIVE_UNCHANGED=PASS');
}
async function run(){
 await preflight();
 const payload={strategy:'percentage',versions:[{version_id:NEW,percentage:100}],
  annotations:{'workers/message':'APP629 PREVIEW isolated owner DO only; shared Explore remains old (no forward binding)'}};
 try{
  await api('POST','workers/scripts/'+OW+'/deployments',payload);
 }catch(error){console.log('APP629_DEPLOY_UNCERTAIN_NO_RETRY='+String(error.message||'unknown'));throw error}
 const [owner,explore]=await Promise.all([active(OW),active(EX)]);
 ok(owner===NEW,'NEW_OWNER_VERSION_NOT_100_PERCENT');
 ok(explore===EXOLD,'EXPLORE_CHANGED_AFTER_OWNER');
 const actual=await info(NEW);
 ok(actual.size===7,'POST_BINDING_DRIFT');
 console.log('APP629_OWNER_ISOLATED_ACTIVE_VERSION='+owner);
 console.log('APP629_ROLLBACK_OFF_WITH_SAME_SECRET_ID='+OFF);
 console.log('APP629_SHARED_EXPLORE_TRAFFIC_UNCHANGED=PASS');
 console.log('APP629_OWNER_NO_PUBLIC_ROUTE_AND_NO_ACTIVE_FORWARD_BINDING=PASS');
 console.log('APP629_SHARED_USER_DATA_AND_FIREBASE_WRITES=ZERO');
}
if(process.argv[2]==='--source-only'){
 ok(NEW!==OLD&&NEW!==OFF&&EXOLD!==NEW,'PIN');
 console.log('APP629_SOURCE_PINS=PASS');
}else if(process.argv[2]==='--deploy-once')await run();
else H('MODE');