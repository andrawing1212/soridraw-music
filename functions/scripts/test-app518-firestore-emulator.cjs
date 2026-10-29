// Real firebase-admin SDK and isolated Firestore emulator; NEVER live Firebase.
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const {createHash}=require('node:crypto');
const {commitApp518AtomicFavoriteCandidate:commit,
 app518CandidateDocumentId:idFor}=require('../lib/app518AtomicFavoriteWriteCandidate.js');
const host=String(process.env.FIRESTORE_EMULATOR_HOST||'');
const project='demo-app518-atomic';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)
 ||(process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==project)
 ||(process.env.GOOGLE_CLOUD_PROJECT&&process.env.GOOGLE_CLOUD_PROJECT!==project)){
 throw Error('REFUSE_NONLOCAL_FIRESTORE_OR_NONDEMO_PROJECT');
}
const app=admin.initializeApp({projectId:project});
const db=admin.firestore(app);
const stamp=()=>admin.firestore.FieldValue.serverTimestamp();
const uid='emulator-owner-A',base={db,authenticatedUid:uid,uid,releaseApproved:true,
 serverTimestamp:stamp};
const run=(details)=>commit({...base,...details});
const ownerKey=id=>createHash('sha256').update(JSON.stringify(['owner',id])).digest('hex');
const owner=id=>db.collection('server_music_note_owners_518').doc(ownerKey(id));
const outbox=x=>db.collection('server_music_note_source_outbox_518').doc(x.outboxId);
const song=id=>db.collection('favorites').doc(id);
const id=idFor(uid,'emu-create-one');
const check=(x,code)=>assert.equal(x.code,code,JSON.stringify(x));
const write=async()=>{
 let x=await run({mutationId:'off-does-not-write',intent:'create',
  favorite:{title:'OFF'},releaseApproved:false});
 check(x,'HOLD_APP518_ATOMIC_SOURCE_UNWIRED');
 assert.equal((await song(idFor(uid,'off-does-not-write')).get()).exists,false);
 const creation={mutationId:'emu-create-one',intent:'create',
  favorite:{title:'A',genre:'Indie',lyrics:{korean:'기존 가사',english:'Old English'},
   appliedKeywords:{lyricsByLanguage:{ko:'원본',en:'Old'},mood:'calm'}}};
 x=await run(creation);check(x,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal(x.sourceWrites+x.outboxWrites+x.ownerWrites,3);
 assert.equal((await song(id).get()).data().title,'A');
 assert.equal((await owner(id).get()).data().firstMutationId,'emu-create-one');
 assert.equal((await outbox(x).get()).data().deliveryState,'PENDING');
 assert.equal((await outbox(x).get()).updateTime.toMillis() > 0,true);
 x=await run(creation);check(x,'ALREADY_RECORDED');
 const edit={mutationId:'emu-edit-two',intent:'save',documentId:id,
  expectedLastMutationId:'emu-create-one',
  favorite:{title:'B',lyrics:{english:'New English'},
   appliedKeywords:{lyricsByLanguage:{en:'New'}}}};
 x=await run(edit);check(x,'SOURCE_AND_OUTBOX_COMMITTED');
 let current=(await song(id).get()).data();
 assert.equal(current.title,'B');assert.equal(current.genre,'Indie');
 assert.deepEqual(current.lyrics,{korean:'기존 가사',english:'New English'});
 assert.deepEqual(current.appliedKeywords,
  {lyricsByLanguage:{ko:'원본',en:'New'},mood:'calm'});
 x=await run({mutationId:'never-seen-stale-edit',intent:'save',documentId:id,
  expectedLastMutationId:'emu-create-one',favorite:{title:'Zombie'}});
 check(x,'HOLD_STALE_SOURCE_GENERATION');
 assert.equal((await song(id).get()).data().title,'B');
 const deletion={mutationId:'emu-delete-three',intent:'delete',
  documentId:id,expectedLastMutationId:'emu-edit-two'};
 x=await run(deletion);check(x,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal((await song(id).get()).exists,false);
 assert.equal((await outbox(x).get()).data().desiredState,'removed');
 x=await run({mutationId:'never-seen-old-save',intent:'save',documentId:id,
  expectedLastMutationId:'emu-edit-two',favorite:{title:'Zombie'}});
 check(x,'HOLD_STALE_SOURCE_GENERATION');
 assert.equal((await song(id).get()).exists,false);
 const restoration={mutationId:'emu-restore-four',intent:'restore',documentId:id,
  expectedLastMutationId:'emu-delete-three',
  favorite:{title:'Recovered',saved:true,lyrics:{korean:'복구',english:'Restored'}}};
 x=await run(restoration);check(x,'SOURCE_AND_OUTBOX_COMMITTED');
 x=await run({mutationId:'never-seen-old-delete',intent:'delete',documentId:id,
  expectedLastMutationId:'emu-delete-three'});
 check(x,'HOLD_STALE_SOURCE_GENERATION');
 assert.equal((await song(id).get()).data().title,'Recovered');
 x=await run({mutationId:'emu-delete-five',intent:'delete',documentId:id,
  expectedLastMutationId:'emu-restore-four'});
 check(x,'SOURCE_AND_OUTBOX_COMMITTED');
 check(await run(deletion),'ALREADY_RECORDED_SUPERSEDED');
 const alien=await commit({...base,authenticatedUid:'emulator-owner-B',uid:'emulator-owner-B',
  mutationId:'alien',intent:'save',documentId:id,expectedLastMutationId:'emu-delete-five',
  favorite:{title:'Foreign'}});
 check(alien,'DENY_FIRST_OWNER_MISMATCH');
 assert.equal((await owner(id).get()).data().uid,uid);
 assert.equal((await song(id).get()).exists,false);
 const softId=idFor(uid,'soft-new');
 x=await run({mutationId:'soft-new',intent:'create',
  favorite:{title:'Soft',saved:true}});
 check(x,'SOURCE_AND_OUTBOX_COMMITTED');
 const soft=await run({mutationId:'soft-remove',intent:'save',documentId:softId,
  expectedLastMutationId:'soft-new',favorite:{saved:false}});
 check(soft,'SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal((await outbox(soft).get()).data().desiredState,'removed');
 // Actual Admin SDK transaction: reject after all writes have been staged.
 const aborted={collection:n=>db.collection(n),
  runTransaction:fn=>db.runTransaction(async tx=>{
   await fn(tx);throw Error('INJECTED_FAILURE_AFTER_ALL_STAGED_WRITES');
  })};
 const abortId=idFor(uid,'aborted-create');
 await assert.rejects(commit({...base,db:aborted,mutationId:'aborted-create',
  intent:'create',favorite:{title:'Not committed'}}),
  /INJECTED_FAILURE_AFTER_ALL_STAGED_WRITES/);
 assert.equal((await song(abortId).get()).exists,false);
 assert.equal((await owner(abortId).get()).exists,false);
 // Both requests read the same generation. Only one can settle.
 const p='parallel-'+Date.now();
 const both=await Promise.all([
  run({mutationId:p+'-A',intent:'save',documentId:softId,
   expectedLastMutationId:'soft-remove',favorite:{title:'A'}}),
  run({mutationId:p+'-B',intent:'save',documentId:softId,
   expectedLastMutationId:'soft-remove',favorite:{title:'B'}}),
 ]);
 assert.deepEqual(both.map(x=>x.code).sort(),
  ['SOURCE_AND_OUTBOX_COMMITTED','HOLD_STALE_SOURCE_GENERATION'].sort());
 const winner=both.find(x=>x.code==='SOURCE_AND_OUTBOX_COMMITTED');
 assert.equal((await owner(softId).get()).data().latestMutationId,
  (await outbox(winner).get()).data().mutationId);
 console.log('APP518_REAL_FIRESTORE_SDK_ATOMIC_CREATION_AND_REPLAY=PASS');
 console.log('APP518_REAL_FIRESTORE_SDK_STALE_FIRST_ARRIVAL=PASS');
 console.log('APP518_REAL_FIRESTORE_SDK_SAVE_DELETE_RESTORE_DELETE=PASS');
 console.log('APP518_REAL_FIRESTORE_SDK_NESTED_LYRICS_PRESERVED=PASS');
 console.log('APP518_REAL_FIRESTORE_SDK_SOFT_REMOVE_OUTBOX_PARITY=PASS');
 console.log('APP518_REAL_FIRESTORE_SDK_FAILURE_ROLLS_BACK_ALL=PASS');
 console.log('APP518_REAL_FIRESTORE_SDK_CONCURRENT_MUTATIONS_SERIALIZED=PASS');
};
const verify=async()=>{
 assert.equal((await owner(id).get()).data().latestMutationId,'emu-delete-five');
 assert.equal((await song(id).get()).exists,false);
 assert.equal((await song(idFor(uid,'aborted-create')).get()).exists,false);
 const old=await run({mutationId:'never-seen-stale-after-restart',intent:'save',
  documentId:id,expectedLastMutationId:'emu-restore-four',
  favorite:{title:'Late-after-restart'}});
 check(old,'HOLD_STALE_SOURCE_GENERATION');
 assert.equal((await song(id).get()).exists,false);
 console.log('APP518_REAL_FIRESTORE_SDK_RESTART_PERSISTENCE_AND_NO_RESURRECTION=PASS');
};
(async()=>{
 if(process.argv[2]==='write')await write();
 else if(process.argv[2]==='verify')await verify();
 else throw Error('usage: node test-app518-firestore-emulator.cjs write|verify');
})().then(()=>app.delete()).catch(e=>{console.error(e);process.exitCode=1;});
