// APP518 exact one-song Firestore API transport test, QA ONLY.
// No browser, no Cloudflare, no Functions, no triggers, no collection scan.
// Hard delete here is a transport test only: APP518 server delete-receipt
// and R2/D1 end-to-end behavior are NOT covered.
const PROJECT='soridraw-app';
const NUMBER='1083981050742';
const ROOT='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents';
const MAX_WRITES=4,MAX_REQUESTS=12;
const fail=(code)=>{throw new Error(code)};
const validTime=t=>typeof t==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(t);
const asFields=(uid,runId,title)=>({
  uid:{stringValue:uid},qaRunId:{stringValue:runId},
  qaOnly:{booleanValue:true},saved:{booleanValue:true},
  title:{stringValue:title},
});
const safeFields=(obj,uid,runId)=>obj?.fields?.uid?.stringValue===uid
 &&obj.fields.qaRunId?.stringValue===runId
 &&obj.fields.qaOnly?.booleanValue===true;
const ensure=(doc,uid,runId,id,expectedTitle)=>{
 if(doc?.name!==ROOT.slice('https://firestore.googleapis.com/v1/'.length)+'/favorites/'+id
  ||!safeFields(doc,uid,runId)
  ||doc.fields.saved?.booleanValue!==true
  ||doc.fields.title?.stringValue!==expectedTitle||!validTime(doc.updateTime))
  fail('HOLD_QA_FIRESTORE_DOCUMENT_CONTRACT');
};
export async function runQa518FirestoreOneSong({
  runId,token,request=fetch,projectNumber=NUMBER,
}={}){
 if(!/^[0-9]{8,20}$/.test(String(runId||''))||projectNumber!==NUMBER
  ||typeof token!=='string'||token.length<20
  ||typeof request!=='function')fail('HOLD_QA_FIRESTORE_IDENTITY');
 const id='qa518-'+runId+'-song',uid='qa518-'+runId+'-owner';
 const name='projects/'+PROJECT+'/databases/(default)/documents/favorites/'+id;
 const resource=ROOT+'/favorites/'+id;
 const collection=ROOT+'/favorites?documentId='+encodeURIComponent(id);
 let requests=0,writes=0,owned=false,stage='UNSTARTED',cleanup=false;
 const call=async(method,url,body)=>{
   if(++requests>MAX_REQUESTS)fail('HOLD_QA_FIRESTORE_REQUEST_CAP');
   if(![collection,resource].includes(url.split('&currentDocument.updateTime=')[0]))
     fail('HOLD_QA_FIRESTORE_FOREIGN_URL');
   if(!['GET','POST','DELETE'].includes(method))fail('HOLD_QA_FIRESTORE_METHOD');
   if(method!=='GET'&&++writes>MAX_WRITES)fail('HOLD_QA_FIRESTORE_WRITE_CAP');
   const response=await request(url,{
      method,redirect:'error',headers:{
       Authorization:'Bearer '+token,Accept:'application/json',
       ...(body?{'Content-Type':'application/json'}:{}),
      },...(body?{body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(20000),
   });
   if(!response||typeof response.status!=='number')
     fail('HOLD_QA_FIRESTORE_RESPONSE_UNAVAILABLE');
   let parsed=null;
   if(response.status!==204){try{parsed=await response.json();}catch{}}
   return {status:response.status,body:parsed};
 };
 const get=async()=>call('GET',resource);
 const create=async(title)=>{
   const response=await call('POST',collection,{fields:asFields(uid,String(runId),title)});
   if(response.status!==200)fail('HOLD_QA_FIRESTORE_CREATE_HTTP_'+response.status);
   ensure(response.body,uid,String(runId),id,title);
   owned=true;
   return response.body;
 };
 const deleteExact=async(doc)=>{
   if(!safeFields(doc,uid,String(runId))||!validTime(doc.updateTime))
     fail('HOLD_QA_UNOWNED_FIRESTORE_DELETE');
   const url=resource+'?currentDocument.updateTime='+encodeURIComponent(doc.updateTime);
   // Explicitly no retry: on an ambiguous HTTP error the synthetic row is
   // preserved and reported for a manual, exact-ID operator investigation.
   const response=await call('DELETE',url);
   if(![200,204].includes(response.status))
     fail('HOLD_QA_FIRESTORE_DELETE_HTTP_'+response.status);
   owned=false;
 };
 try{
   stage='ASSERT_UNIQUE_QA_DOCUMENT_ABSENT';
   const initial=await get();
   if(initial.status!==404)fail('HOLD_QA_FIRESTORE_PILOT_ALREADY_EXISTS');
   stage='CREATE_ONE_QA_FAVORITE';
   const created=await create('APP518 QA synthetic saved');
   stage='HARD_DELETE_QA_FAVORITE';
   await deleteExact(created);
   const gone=await get();
   if(gone.status!==404)fail('HOLD_QA_FIRESTORE_HARD_DELETE_UNCONFIRMED');
   stage='RECREATE_SAME_QA_FAVORITE';
   const restored=await create('APP518 QA synthetic restored');
   if(!(restored.createTime>created.createTime))
     fail('HOLD_QA_FIRESTORE_RESTORE_GENERATION_NOT_NEWER');
   stage='EXACT_PILOT_READ';
   const observed=await get();
   if(observed.status!==200)fail('HOLD_QA_FIRESTORE_RESTORED_GET');
   ensure(observed.body,uid,String(runId),id,'APP518 QA synthetic restored');
   stage='NORMAL_CLEANUP';
   await deleteExact(observed.body);
   stage='FINAL_ABSENCE_VERIFY';
   const final=await get();
   if(final.status!==404)fail('HOLD_QA_FIRESTORE_FINAL_ABSENCE');
   cleanup=true;
   return {code:'APP518_QA_FIRESTORE_ONE_SONG_CREATE_DELETE_RESAVE_CLEANED_PASS',
    uid,id,writes,requests,cloudflareMutations:0,deleteReceipts:0};
 }catch(error){
   const reason=String(error?.message||'HOLD_UNKNOWN').slice(0,90);
   // The only allowed compensating action is a CAS delete of this run-owned
   // synthetic document. NEVER delete a row that predates this invocation.
   if(owned&&writes<MAX_WRITES){
     try{
       stage='SAFE_COMPENSATING_CLEANUP';
       const current=await get();
       if(current.status===200&&safeFields(current.body,uid,String(runId))){
         await deleteExact(current.body);
         cleanup=(await get()).status===404;
       }else if(current.status===404){owned=false;cleanup=true;}
     }catch{cleanup=false;}
   }
   return {code:'HOLD_APP518_QA_FIRESTORE_ONE_SONG',reason,stage,
     uid,id,writes,requests,cleanupConfirmed:cleanup,
     cloudflareMutations:0,deleteReceipts:0};
 }
}
async function live(){
 const token=process.env.APP518_QA_FIRESTORE_BEARER;
 const res=await runQa518FirestoreOneSong({
  runId:process.env.GITHUB_RUN_ID,token,
  projectNumber:process.env.APP518_QA_PROJECT_NUMBER,
 });
 if(res.code!=='APP518_QA_FIRESTORE_ONE_SONG_CREATE_DELETE_RESAVE_CLEANED_PASS'
   ||res.writes!==4||!res.id.startsWith('qa518-')){
   console.log(JSON.stringify(res));
   process.exitCode=1;return;
 }
 console.log(JSON.stringify(res));
 console.log('APP518_QA_REAL_FIRESTORE_CREATE_HARD_DELETE_RESAVE_FINAL_ABSENCE=PASS');
 console.log('APP518_QA_D1_R2_FIREBASE_FUNCTION_E2E=NOT_TESTED; CLOUD_DATA_EXCEPT_SYNTHETIC=UNCHANGED');
}
if(process.argv[1]?.endsWith('/qa/app518/live/firestore-one-song518.mjs')){
 if(process.argv[2]!=='--live-one-song')fail('HOLD_QA_FIRESTORE_MODE');
 live().catch(e=>{console.log('APP518_QA_HOLD_'+String(e?.message||e).slice(0,100));process.exitCode=1});
}
