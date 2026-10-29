// Offline server-only Firestore transaction simulation. NO Firebase credentials/IO.
const assert=require('node:assert/strict');
const {commitApp518AtomicFavoriteCandidate:commit,
 app518CandidateDocumentId:idFor}=require('../lib/app518AtomicFavoriteWriteCandidate.js');
const docs=new Map();let writes=0,clock=1000,failNext=null;
const clone=x=>x===undefined?undefined:structuredClone(x);
const ref=(coll,id)=>({path:coll+'/'+id});
const db={
 collection(coll){return{doc(id){return ref(coll,id);}};},
 async runTransaction(fn){
  for(let n=0;n<8;n++){
   const readVersions=new Map(),ops=[];
   const tx={
    async get(key){const row=docs.get(key.path);readVersions.set(key.path,row?.v||0);
     return {exists:!!row,data:()=>clone(row?.data)};},
    create(key,value){ops.push(['create',key.path,clone(value)]);},
    set(key,value){ops.push(['set',key.path,clone(value)]);},
    delete(key){ops.push(['delete',key.path]);},
   };
   const result=await fn(tx);
   if([...readVersions].some(([p,v])=>(docs.get(p)?.v||0)!==v))continue;
   if(failNext){const reason=failNext;failNext=null;throw Error(reason);}
   // Validate all writes before committing anything.
   const next=new Map(docs);
   for(const [op,path,val] of ops){
    const previous=next.get(path);
    if(op==='create'&&previous)throw Error('already exists: '+path);
    if(op==='delete')next.delete(path);
    else next.set(path,{v:(previous?.v||0)+1,data:val,commitNs:String(++clock)});
   }
   docs.clear();for(const [p,v] of next)docs.set(p,v);
   writes+=ops.length;
   return result;
  }
  throw Error('too many conflicts');
 },
};
const request={db,authenticatedUid:'uid-A',uid:'uid-A',
 mutationId:'mutation-one',intent:'create',favorite:{title:'Song A',genre:'Indie',lyrics:{korean:'기존 한글',english:'original English'},appliedKeywords:{lyricsByLanguage:{ko:'원본',en:'English'},mood:'calm'}},
 serverTimestamp:()=>({firestoreServerTimestamp:true}),releaseApproved:true};
(async()=>{
 let x=await commit({...request,releaseApproved:false});
 assert.equal(x.code,'HOLD_APP518_ATOMIC_SOURCE_UNWIRED');assert.equal(writes,0);
 x=await commit({...request,authenticatedUid:'attacker'});
 assert.equal(x.code,'DENY_ARGUMENTS');assert.equal(writes,0);
 x=await commit({...request,documentId:'client-controlled'});
 assert.equal(x.code,'DENY_CLIENT_SELECTED_NEW_ID');assert.equal(writes,0);
 x=await commit(request);
 const id=idFor('uid-A','mutation-one');
 assert.equal(x.code,'SOURCE_AND_OUTBOX_COMMITTED');assert.equal(x.documentId,id);
 assert.deepEqual([x.sourceWrites,x.outboxWrites,x.ownerWrites],[1,1,1]);
 assert.equal(writes,3);assert.equal(docs.get('favorites/'+id).data.uid,'uid-A');
 const ownerPath=[...docs.keys()].find(k=>k.startsWith('server_music_note_owners_518/'));
 assert.equal(docs.get(ownerPath).data.firstMutationId,'mutation-one');
 const outboxPath='server_music_note_source_outbox_518/'+x.outboxId;
 assert.equal(docs.get(outboxPath).data.deliveryState,'PENDING');
 assert.ok(!JSON.stringify(docs.get(outboxPath).data).includes('Song A'),
  'no song content in outbox');
 x=await commit(request);assert.equal(x.code,'ALREADY_RECORDED');assert.equal(writes,3);
 x=await commit({...request,favorite:{title:'DIFFERENT'}});
 assert.equal(x.code,'DENY_MUTATION_ID_REUSE');assert.equal(writes,3);
 x=await commit({...request,intent:'save',mutationId:'mutation-two',documentId:id,
 expectedLastMutationId:'mutation-one',
 favorite:{title:'Edited',lyrics:{english:'edited English'},appliedKeywords:{lyricsByLanguage:{en:'edited'}}}});
 assert.equal(x.code,'SOURCE_AND_OUTBOX_COMMITTED');assert.equal(writes,6);
 assert.equal(docs.get('favorites/'+id).data.title,'Edited');
 assert.equal(docs.get('favorites/'+id).data.genre,'Indie');
 assert.deepEqual(docs.get('favorites/'+id).data.lyrics,
  {korean:'기존 한글',english:'edited English'});
 assert.deepEqual(docs.get('favorites/'+id).data.appliedKeywords,
  {lyricsByLanguage:{ko:'원본',en:'edited'},mood:'calm'});
 x=await commit({...request,intent:'save',mutationId:'unseen-old-title',
  documentId:id,expectedLastMutationId:'mutation-one',favorite:{title:'Stale'}});
 assert.equal(x.code,'HOLD_STALE_SOURCE_GENERATION');assert.equal(writes,6);
 x=await commit(request);assert.equal(x.code,'ALREADY_RECORDED_SUPERSEDED');
 x=await commit({...request,intent:'delete',mutationId:'mutation-three',
 documentId:id,favorite:undefined,expectedLastMutationId:'mutation-two'});
 assert.equal(x.code,'SOURCE_AND_OUTBOX_COMMITTED');assert.equal(writes,9);
 assert.ok(!docs.has('favorites/'+id));
 assert.equal(docs.get(ownerPath).data.latestMutationId,'mutation-three');
 const staleDelete={...request,intent:'delete',mutationId:'mutation-three',
 documentId:id,favorite:undefined,expectedLastMutationId:'mutation-two'};
 x=await commit(staleDelete);assert.equal(x.code,'ALREADY_RECORDED');assert.equal(writes,9);
 x=await commit({...request,intent:'save',mutationId:'never-sent-old-save',
  documentId:id,expectedLastMutationId:'mutation-two',favorite:{title:'Zombie'}});
 assert.equal(x.code,'HOLD_STALE_SOURCE_GENERATION');assert.equal(writes,9);
 x=await commit({...request,intent:'save',mutationId:'mutation-four',
 documentId:id,expectedLastMutationId:'mutation-three',favorite:{title:'No implicit restore'}});
 assert.equal(x.code,'HOLD_EXPLICIT_RESTORE_REQUIRED');assert.equal(writes,9);
 x=await commit({...request,intent:'restore',mutationId:'mutation-four',
 documentId:id,expectedLastMutationId:'mutation-three',
 favorite:{title:'Resaved',lyrics:{korean:'restore ko',english:'restore en'},saved:true}});
 assert.equal(x.code,'SOURCE_AND_OUTBOX_COMMITTED');assert.equal(writes,12);
 x=await commit(staleDelete);assert.equal(x.code,'ALREADY_RECORDED_SUPERSEDED');
 x=await commit({...request,intent:'delete',mutationId:'unseen-old-delete',
  documentId:id,expectedLastMutationId:'mutation-three',favorite:undefined});
 assert.equal(x.code,'HOLD_STALE_SOURCE_GENERATION');assert.equal(writes,12);
 x=await commit({...request,intent:'delete',mutationId:'mutation-five',
 documentId:id,favorite:undefined,expectedLastMutationId:'mutation-four'});
 assert.equal(x.code,'SOURCE_AND_OUTBOX_COMMITTED');assert.equal(writes,15);
 x=await commit(staleDelete);assert.equal(x.code,'ALREADY_RECORDED_SUPERSEDED');
 x=await commit({...request,authenticatedUid:'uid-B',uid:'uid-B',
 intent:'save',documentId:id,mutationId:'B-takeover',favorite:{title:'Bad'}});
 assert.equal(x.code,'DENY_FIRST_OWNER_MISMATCH');assert.equal(writes,15);
 x=await commit({...request,intent:'save',documentId:'legacy-id',
 mutationId:'legacy-unknown',favorite:{title:'Legacy'}});
 assert.equal(x.code,'HOLD_LEGACY_FIRST_OWNER_UNPROVEN');assert.equal(writes,15);
 // A failed source/outbox/owner commit must not write ANY of the three.
 const fresh={...request,mutationId:'new-on-failure'};
 failNext='SIMULATED_FIRESTORE_OUTAGE';
 await assert.rejects(commit(fresh),/SIMULATED_FIRESTORE_OUTAGE/);
 assert.equal(writes,15);
 assert.ok(!docs.has('favorites/'+idFor('uid-A','new-on-failure')));
 x=await commit(fresh);assert.equal(x.code,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal(writes,18);
 // Soft-removal state in the canonical row must match its durable outbox.
 const freshId=idFor('uid-A','new-on-failure');
 const soft=await commit({...request,intent:'save',mutationId:'soft-remove',documentId:freshId,
  expectedLastMutationId:'new-on-failure',favorite:{saved:false}});
 assert.equal(soft.code,'SOURCE_AND_OUTBOX_COMMITTED');assert.equal(writes,21);
 assert.equal(docs.get('favorites/'+freshId).data.saved,false);
 assert.equal(docs.get('server_music_note_source_outbox_518/'+soft.outboxId).data.desiredState,'removed');
 // Parallel attempts with identical ID: only one transaction commits.
 const next={...request,mutationId:'parallel-unique'};
 const values=await Promise.all([commit(next),commit(next)]);
 assert.deepEqual(values.map(y=>y.code).sort(),
  ['ALREADY_RECORDED','SOURCE_AND_OUTBOX_COMMITTED'].sort());
 assert.equal(writes,24);
 assert.equal(docs.get(ownerPath).data.uid,'uid-A');
 assert.ok([...docs.values()].every(x=>typeof x.commitNs==='string'));
 console.log('APP518_SERVER_ATOMIC_FAVORITE_OWNER_OUTBOX_OFF_W0=PASS');
 console.log('APP518_SERVER_ATOMIC_FAVORITE_CREATE_REPLAY_W0=PASS');
 console.log('APP518_SERVER_ATOMIC_FAVORITE_SOURCE_OUTBOX_ALL_OR_NOTHING=PASS');
 console.log('APP518_SERVER_ATOMIC_FAVORITE_DELETE_SAVE_DELETE_STALE_REPLAY_W0=PASS');
 console.log('APP518_SERVER_ATOMIC_FAVORITE_CROSS_OWNER_RECREATE_DENY=PASS');
 console.log('APP518_SERVER_ATOMIC_FAVORITE_LEGACY_ID_UNPROVEN_HOLD=PASS');
 console.log('APP518_SERVER_ATOMIC_FAVORITE_CONCURRENT_MUTATION_IDEMPOTENT=PASS');
 console.log('APP518_SERVER_ATOMIC_FAVORITE_NO_LIVE_IO=PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
