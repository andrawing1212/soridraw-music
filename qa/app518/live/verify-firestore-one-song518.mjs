import assert from 'node:assert/strict';
import {runQa518FirestoreOneSong} from './firestore-one-song518.mjs';
const runId='45090001234';
const project='soridraw-app';
const id='qa518-'+runId+'-song',uid='qa518-'+runId+'-owner';
const root='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents';
const path='projects/'+project+'/databases/(default)/documents/favorites/'+id;
const response=(status,doc)=>({status,json:async()=>doc});
const token='q'.repeat(40);
let doc=null,sequence=0,writes=0,reads=0;
const nextTime=()=>'2026-11-23T00:00:0'+(++sequence)+'.123456789Z';
const fake=async (url,init)=>{
 const parsed=new URL(url);
 assert.equal(parsed.origin,'https://firestore.googleapis.com');
 assert.equal(init.headers.Authorization,'Bearer '+token);
 assert.ok(parsed.pathname.endsWith('/documents/favorites')
   ||parsed.pathname.endsWith('/documents/favorites/'+id));
 const qs=parsed.searchParams;
 switch(init.method){
  case 'GET':reads++;return response(doc?200:404,doc);
  case 'POST':{
   writes++;
   assert.equal(qs.get('documentId'),id);
   if(doc)return response(409,{});
   const data=JSON.parse(init.body);
   assert.equal(data.fields.uid.stringValue,uid);
   assert.equal(data.fields.qaRunId.stringValue,runId);
   const time=nextTime();
   doc={name:path,fields:data.fields,createTime:time,updateTime:time};
   return response(200,structuredClone(doc));
  }
  case 'DELETE':{
   writes++;
   assert.equal(qs.get('currentDocument.updateTime'),doc?.updateTime);
   doc=null;
   return response(200,{});
  }
 }
 throw Error('UNEXPECTED_METHOD');
};
const done=await runQa518FirestoreOneSong({runId,token,request:fake});
assert.equal(done.code,'APP518_QA_FIRESTORE_ONE_SONG_CREATE_DELETE_RESAVE_CLEANED_PASS');
assert.equal(done.writes,4);
assert.equal(done.requests,8);
assert.equal(writes,4);
assert.equal(reads,4);
assert.equal(doc,null);
let unexpected=0;
const blocked=await runQa518FirestoreOneSong({runId,token,request:async(url,req)=>{
 unexpected++;if(req.method!=='GET')throw Error('MUST_NOT_MUTATE');
 return response(200,{name:path,fields:{
  uid:{stringValue:'other'},qaRunId:{stringValue:'other'},qaOnly:{booleanValue:false},
 }});
}});
assert.equal(unexpected,1);
assert.equal(blocked.code,'HOLD_APP518_QA_FIRESTORE_ONE_SONG');
assert.equal(blocked.reason,'HOLD_QA_FIRESTORE_PILOT_ALREADY_EXISTS');
assert.equal(blocked.writes,0);
assert.equal(blocked.cleanupConfirmed,false);
await assert.rejects(()=>runQa518FirestoreOneSong({
 runId,token,projectNumber:'91309780603',request:fake,
}),/HOLD_QA_FIRESTORE_IDENTITY/);
console.log('APP518_QA_FIRESTORE_EXACT_ONE_SONG_CREATE_HARD_DELETE_RESAVE_CLEANUP=PASS');
console.log('APP518_QA_FOREIGN_DOCUMENT_AND_OPERATING_PROJECT_MUTATION_DENIED=PASS');
console.log('APP518_QA_SOURCE_ONLY_W4_R4_REQUESTS8=PASS; CLOUD_MUTATIONS=0');
