/**
 * app518 server-only atomic source candidate. UNWIRED / RELEASE HOLD.
 * No HTTP export, listener, client call, Worker call, Cloudflare binding or migration.
 * Never pass a client-supplied releaseApproved flag to this function.
 *
 * A Firestore transaction commits exact favorite + immutable first owner +
 * durable source outbox together. The outbox document's server updateTime is
 * the post-commit source clock, INCLUDING for hard deletes. No post-success
 * hook or Firestore trigger is a substitute for this atomic transaction.
 * Legacy documents without trusted first-owner proof HOLD: this candidate
 * does not adopt old IDs or change old clients' direct-write behavior.
 */
import {createHash} from 'node:crypto';

type RecordValue=Record<string,unknown>;
type DocRef={path:string};
type Snapshot={exists:boolean;data():RecordValue|undefined};
type Transaction={
 get(ref:DocRef):Promise<Snapshot>;
 create(ref:DocRef,data:RecordValue):void;
 set(ref:DocRef,data:RecordValue):void;
 delete(ref:DocRef):void;
};
type Store={
 collection(name:string):{doc(id:string):DocRef};
 runTransaction<T>(callback:(tx:Transaction)=>Promise<T>):Promise<T>;
};
export type App518AtomicIntent='create'|'save'|'delete';
export type App518AtomicCandidateResult={
 code:string;documentId?:string;outboxId?:string;
 sourceWrites:number;outboxWrites:number;ownerWrites:number;
};
const valid=(x:unknown,max=240):x is string=>typeof x==='string'
 &&x.length>0&&x.length<=max&&x!=='.'&&x!=='..'&&!/[\\/]/.test(x);
const digest=(parts:unknown[])=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const stable=(value:unknown):unknown=>{
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object'){
  const obj=value as RecordValue,out:RecordValue={};
  for(const k of Object.keys(obj).sort())out[k]=stable(obj[k]);
  return out;
 }
 return value;
};
const result=(code:string,documentId?:string,outboxId?:string,
 sourceWrites=0,outboxWrites=0,ownerWrites=0):App518AtomicCandidateResult=>({
 code,...(documentId?{documentId}:{}),...(outboxId?{outboxId}:{}),
 sourceWrites,outboxWrites,ownerWrites,
});
export const app518CandidateDocumentId=(uid:string,mutationId:string)=>
 'a518_'+digest(['app518-new',uid,mutationId]).slice(0,48);

export const commitApp518AtomicFavoriteCandidate=async({
 db,authenticatedUid,uid,documentId,mutationId,intent,favorite,
 serverTimestamp,releaseApproved=false,
}:{
 db:Store;authenticatedUid:string;uid:string;documentId?:string;
 mutationId:string;intent:App518AtomicIntent;favorite?:RecordValue;
 /** Trusted Firestore FieldValue.serverTimestamp(), supplied by server adapter. */
 serverTimestamp:()=>unknown;
 /** Must come from server-controlled, separately approved rollout gate. */
 releaseApproved?:boolean;
}):Promise<App518AtomicCandidateResult>=>{
 if(releaseApproved!==true)return result('HOLD_APP518_ATOMIC_SOURCE_UNWIRED');
 if(!valid(uid,128)||authenticatedUid!==uid||!valid(mutationId,128)
   ||typeof serverTimestamp!=='function'
   ||!['create','save','delete'].includes(intent))return result('DENY_ARGUMENTS');
 if(intent==='create'&&documentId!==undefined)return result('DENY_CLIENT_SELECTED_NEW_ID');
 const id=intent==='create'?app518CandidateDocumentId(uid,mutationId):documentId;
 if(!valid(id))return result('DENY_DOCUMENT_ID');
 if(intent!=='delete'){
  if(!favorite||typeof favorite!=='object'||Array.isArray(favorite)
   ||Object.keys(favorite).some(k=>k==='__proto__'||k==='constructor'||k==='prototype')
   ||(favorite.uid!==undefined&&favorite.uid!==uid)
   ||(favorite.ownerUid!==undefined&&favorite.ownerUid!==uid)
   ||(favorite.id!==undefined&&favorite.id!==id))return result('DENY_FAVORITE_PAYLOAD');
 }
 // No song content in the outbox: source document ID, owner, intent, digest,
 // and server timestamp only. Live delivery must exact-read and verify source.
 const payload=intent==='delete'?null:stable(favorite);
 const fingerprint=digest([intent,uid,id,payload]);
 const ownerKey=digest(['owner',id]);
 const outboxId=digest(['mutation',uid,id,mutationId]);
 const ownerRef=db.collection('server_music_note_owners_518').doc(ownerKey);
 const favoriteRef=db.collection('favorites').doc(id);
 const outboxRef=db.collection('server_music_note_source_outbox_518').doc(outboxId);
 return db.runTransaction(async tx=>{
  // ALL reads before writes: transaction handles races/optimistic retries.
  const [ownerDoc,sourceDoc,outboxDoc]=await Promise.all([
   tx.get(ownerRef),tx.get(favoriteRef),tx.get(outboxRef),
  ]);
  const owner=ownerDoc.data();
  if(ownerDoc.exists&&(
   owner?.uid!==uid||owner?.documentId!==id||owner?.immutable!==true))
   return result('DENY_FIRST_OWNER_MISMATCH',id,outboxId);
  if(sourceDoc.exists&&sourceDoc.data()?.uid!==uid)
   return result('DENY_SOURCE_OWNER_MISMATCH',id,outboxId);
  if(outboxDoc.exists){
   const existing=outboxDoc.data();
   if(existing?.uid!==uid||existing?.documentId!==id
    ||existing?.mutationId!==mutationId||existing?.intent!==intent
    ||existing?.payloadFingerprint!==fingerprint)
    return result('DENY_MUTATION_ID_REUSE',id,outboxId);
   const current=sourceDoc.data();
   const superseded=owner?.latestMutationId!==mutationId
     ||(sourceDoc.exists
       ?current?.app518SourceMutationId!==mutationId
       :intent!=='delete');
   return result(superseded?'ALREADY_RECORDED_SUPERSEDED':'ALREADY_RECORDED',id,outboxId);
  }
  if(!ownerDoc.exists){
   if(intent!=='create'||sourceDoc.exists)
    return result('HOLD_LEGACY_FIRST_OWNER_UNPROVEN',id,outboxId);
  }
  if(intent==='create'&&(sourceDoc.exists||ownerDoc.exists))
   return result('HOLD_CREATE_ID_ALREADY_ALLOCATED',id,outboxId);
  if(intent==='delete'&&!sourceDoc.exists)
   return result('NOOP_ALREADY_ABSENT',id,outboxId);
  const stamp=serverTimestamp();
  if(stamp==null)return result('DENY_SERVER_TIMESTAMP',id,outboxId);
  // One Firestore commit: a failed or conflicting transaction writes nothing.
  if(!ownerDoc.exists)tx.create(ownerRef,{
   uid,documentId:id,immutable:true,firstMutationId:mutationId,
   createdAt:stamp,latestMutationId:mutationId,latestIntent:intent,
   latestCommittedAt:stamp,
  });
  else tx.set(ownerRef,{
   ...owner,uid,documentId:id,immutable:true,
   latestMutationId:mutationId,latestIntent:intent,latestCommittedAt:stamp,
  });
  if(intent==='delete')tx.delete(favoriteRef);
  else tx.set(favoriteRef,{
   ...favorite,uid,id,app518SourceMutationId:mutationId,
   app518SourceCommittedAt:stamp,
  });
  tx.create(outboxRef,{
   uid,documentId:id,mutationId,intent,
   desiredState:intent==='delete'?'removed':'saved',
   payloadFingerprint:fingerprint,
   ownerDocumentId:ownerKey,sourceCommitAt:stamp,
   deliveryState:'PENDING',
  });
  return result('SOURCE_AND_OUTBOX_COMMITTED',id,outboxId,
   1,1,1);
 });
};
