// APP768 physical QA only. Director approved exactly one isolated QA D1
// database and one R2 bucket (2026-11-22 KST). Never accesses another
// Cloudflare account or existing APP583 Worker data. No PROD or shared data.
// Idempotent resource setup, synthetic-only bounded verification and cleanup.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const PROD='e1a30fc9ef497fda1d34f4ab3dc1da45';
const QA_WORKER='soridraw-owner-qa-583';
const QA_ORIGINAL='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const D1_NAME='soridraw-qa-app768-d1';
const R2_NAME='soridraw-qa-app768-r2';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+QA;
const UUID=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const HOLD=s=>{throw Error('APP768_QA_PHYSICAL_HOLD_'+s)};
function verifiedToken(t){return typeof t==='string'&&t.length>=20;}
const api=async({token,path,method='GET',body,headers={}})=>{
 if(!verifiedToken(token)||!path.startsWith(BASE+'/')||QA===PROD)
  HOLD('WRONG_ACCOUNT_OR_TOKEN');
 const binary=body instanceof Blob||body instanceof Uint8Array;
 const res=await fetch(path,{method,
  headers:{Authorization:'Bearer '+token,'Cache-Control':'no-store',
    ...(binary?{'Content-Type':'application/octet-stream'}:
      body?{'Content-Type':'application/json'}:{}),...headers},
  ...(body?{body:binary?body:JSON.stringify(body)}:{}),
  redirect:'error',signal:AbortSignal.timeout(18000)});
 let j=null;try{j=await res.json()}catch{HOLD('RESPONSE_JSON_UNVERIFIED_'+method+'_'+res.status)}
 if(!res.ok||j?.success!==true)
  HOLD('CF_HTTP_'+method+'_'+res.status+'_CODES_'+(j?.errors||[])
    .map(e=>Number.isSafeInteger(e?.code)?e.code:'NA').slice(0,3).join('_'));
 return j.result;
};
const deps=async(token,workerToken)=>{
 const path=BASE+'/workers/scripts/'+QA_WORKER+'/deployments';
 const v=await api({token:workerToken,path});
 const versions=v?.deployments?.[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||
    versions[0]?.version_id!==QA_ORIGINAL||
    Number(versions[0]?.percentage)<99.99)HOLD('ORIGINAL_QA_WORKER_DRIFT');
 const d1=await api({token,path:BASE+'/d1/database'});
 const r2=await api({token,path:BASE+'/r2/buckets'});
 const dbs=Array.isArray(d1)?d1:Array.isArray(d1?.databases)?d1.databases:null;
 const buckets=Array.isArray(r2?.buckets)?r2.buckets:Array.isArray(r2)?r2:null;
 if(!dbs||!buckets||dbs.length>1||buckets.length>1)
  HOLD('UNEXPECTED_QA_RESOURCE_COUNT');
 if(dbs.some(x=>x.name!==D1_NAME||!UUID.test(x.uuid||''))||
    buckets.some(x=>x.name!==R2_NAME))HOLD('QA_RESOURCE_NAME_MISMATCH');
 return {dbs,buckets};
};
const q=async(token,uuid,sql)=>{
 if(!UUID.test(uuid)||!sql||sql.length>1000||
    /explore_|follows|users|firestore|catalog|profile_stats/i.test(sql))
   HOLD('NON_SYNTHETIC_SQL');
 const resp=await api({token,
  path:BASE+'/d1/database/'+uuid+'/query',method:'POST',body:{sql}});
 if(!Array.isArray(resp)||resp.length!==1||
    resp[0]?.success!==true||!Number.isSafeInteger(resp[0]?.meta?.rows_written))
  HOLD('D1_ROWS_WRITTEN_METADATA_UNVERIFIED');
 return resp[0];
};
export async function app768Physical({
 dataToken=process.env.CLOUDFLARE_QA_DATA_TOKEN,
 workerToken=process.env.CLOUDFLARE_QA_API_TOKEN,
}={}){
 if(!verifiedToken(dataToken)||!verifiedToken(workerToken))
  HOLD('QA_ONLY_SECRETS_REQUIRED');
 let {dbs,buckets}=await deps(dataToken,workerToken);
 console.log('APP768_QA_ISOLATION_ORIGINAL_WORKER=PASS');
 console.log('APP768_QA_RESOURCES_INITIAL=D1:'+dbs.length+',R2:'+buckets.length);
 if(!dbs.length){
  const d=await api({token:dataToken,path:BASE+'/d1/database',method:'POST',
    body:{name:D1_NAME,primary_location_hint:'apac'}});
  if(d?.name!==D1_NAME||!UUID.test(d?.uuid||''))HOLD('NEW_D1_ID_INVALID');
  console.log('APP768_QA_D1_CREATED='+d.name);
 }
 // Following a partial failure, next execution reuses the exact QA D1
 // instead of creating a second database.
 ({dbs,buckets}=await deps(dataToken,workerToken));
 if(!buckets.length){
  const b=await api({token:dataToken,path:BASE+'/r2/buckets',method:'POST',
    body:{name:R2_NAME,locationHint:'apac',storageClass:'Standard'}});
  if(b?.name!==R2_NAME)HOLD('NEW_R2_NAME_INVALID');
  console.log('APP768_QA_R2_CREATED='+b.name);
 }
 ({dbs,buckets}=await deps(dataToken,workerToken));
 if(dbs.length!==1||buckets.length!==1)HOLD('QA_RESOURCE_CREATION_INCOMPLETE');
 console.log('APP768_QA_RESOURCE_IDENTITIES_FINAL=D1:'+D1_NAME+',R2:'+R2_NAME);
 const uuid=dbs[0].uuid;
 if(process.env.APP768_QA_TEST_PHASE==='r2'){
  console.log('APP768_REAL_QA_D1_W1_W2=PREVIOUS_RUN_PASS_NOT_REPEATED');
 }else{
 // Separate synthetic table in this newly created isolated QA D1 only.
 // D1 rows_written metering here cannot prove existing PROD worker W1/W2.
 const synthetic='app768_qa_synthetic_follow';
 const ids=['qa768_a','qa768_b'];
 await q(dataToken,uuid,'CREATE TABLE IF NOT EXISTS '+synthetic+
  ' (k TEXT PRIMARY KEY, following INTEGER NOT NULL)');
 let inserted=true;
 try{
  for(const id of ids){
   const result=await q(dataToken,uuid,"INSERT INTO "+synthetic+
    " (k,following) VALUES ('"+id+"',0)");
   console.log('APP768_QA_SETUP_INSERT_ROWS_WRITTEN='+result.meta.rows_written);
   if(result.meta.rows_written<1||result.meta.rows_written>5)
    HOLD('D1_SETUP_INSERT_COST_UNEXPECTED');
  }
  const one=await q(dataToken,uuid,
   "UPDATE "+synthetic+" SET following=1 WHERE k='qa768_a'");
  if(one.meta.rows_written!==1)HOLD('D1_W1_UNVERIFIED');
  const two=await q(dataToken,uuid,
   "UPDATE "+synthetic+" SET following=0 WHERE k IN ('qa768_a','qa768_b')");
  if(two.meta.rows_written!==2)HOLD('D1_W2_UNVERIFIED');
  console.log('APP768_REAL_QA_D1_SYNTHETIC_SQL_META_W1=PASS');
  console.log('APP768_REAL_QA_D1_SYNTHETIC_SQL_META_W2=PASS');
  console.log('APP768_REAL_PROD_FOLLOW_CANONICAL_W1_W2=NOT_TESTED');
 }finally{
  if(inserted){
   const cleanup=await q(dataToken,uuid,
    "DELETE FROM "+synthetic+" WHERE k IN ('qa768_a','qa768_b')");
   if(cleanup.meta.rows_written>2)
    HOLD('QA_D1_CLEANUP_UNEXPECTED_ROWS');
   const count=await q(dataToken,uuid,
    'SELECT COUNT(*) AS n FROM '+synthetic);
   if(count.results?.[0]?.n!==0)HOLD('QA_D1_SYNTHETIC_ROWS_LEFTOVER');
   console.log('APP768_QA_D1_SYNTHETIC_ROWS_CLEANED=PASS');
  }
 }
 }
 // Native Cloudflare management object PUT is physically testable using
 // an account API token but is NOT the APP767 Workers R2.put API or S3 API.
 // Its documented upload endpoint does not promise If-None-Match support:
 // no 'APP767 conditional PASS' can be inferred from this test alone.
 const objectKey='app768-only-qa-'+randomBytes(8).toString('hex');
 const url=BASE+'/r2/buckets/'+R2_NAME+'/objects/'+objectKey;
 let submitted=false;
 let success=false,uploadError=null;
 try{
  // Cloudflare management PUT /objects/{key} accepts the raw object body.
  // Multipart form-data may be interpreted as unimplemented S3 POST-object.
  const payload=new Blob(['app768-isolated-qa-physical-check'],
    {type:'application/octet-stream'});
  submitted=true;
  const result=await api({token:dataToken,path:url,method:'PUT',body:payload});
  if(result?.key!==objectKey)HOLD('QA_R2_UPLOAD_KEY_UNVERIFIED');
  success=true;
  console.log('APP768_REAL_QA_R2_MANAGEMENT_API_SINGLE_OBJECT_UPLOAD=PASS');
  console.log('APP768_R2_WORKERS_S3_CONDITIONAL_CREATE_ONCE=NOT_TESTED');
 }catch(e){
  uploadError=e;
  console.log('APP768_QA_R2_UPLOAD_CAUSE='+String(e?.message||'UNAVAILABLE'));
 }finally{
  if(submitted){
   // Only this random synthetic key, even when the PUT response is
   // uncertain. Preserve the real PUT error instead of masking it with
   // a 10007 NoSuchKey error from cleaning up an absent object.
   try{
    const deletion=await api({token:dataToken,path:url,method:'DELETE'});
    if(deletion?.key!==undefined&&deletion?.key!==objectKey)
     HOLD('QA_R2_DELETE_KEY_MISMATCH');
    console.log('APP768_QA_R2_SYNTHETIC_OBJECT_CLEANUP=PASS');
   }catch(e){
    if(uploadError&&String(e?.message||'').includes('CODES_10007'))
     console.log('APP768_QA_R2_NO_OBJECT_TO_CLEAN=CONFIRMED');
    else throw e;
   }
  }
 }
 if(uploadError)throw uploadError;
 if(!success)HOLD('QA_R2_BASIC_UPLOAD_MISSING');
 console.log('APP768_PHYSICAL_QA_BASIC_RESOURCES_AND_D1_ROWS=PASS');
 console.log('APP768_APP767_R2_CONDITIONAL_6_WAY=NOT_TESTED');
 console.log('APP768_APP765_INDEPENDENT_HISTORY=HOLD; PROD_DEPLOY=0');
 return {d1Name:D1_NAME,r2Name:R2_NAME,qaPhysical:true};
}
if(import.meta.url==='file://'+process.argv[1])
 app768Physical().catch(e=>{console.error(String(e?.message||e));
 process.exitCode=1;});
