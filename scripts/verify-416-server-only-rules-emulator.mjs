import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {buildStage416ServerRulesCandidate as build} from './build-416-private-server-rules.mjs';
// Firebase emulator only: no live credentials, reads or DB mutations.
const source=JSON.parse(readFileSync('database.rules.json','utf8'));
const candidate=build(source);
assert.equal(JSON.stringify(source.rules.userSync),JSON.stringify(candidate.rules.userSync),
 'all existing userSync old clients must have unchanged rule source');
assert.equal(candidate.rules.privateLikeBatch416['.write'],false);
const env=await initializeTestEnvironment({
 projectId:'demo-soridraw-stage420-rules',
 database:{host:'127.0.0.1',port:9000,rules:JSON.stringify(candidate)},
});
try{
 const owner=env.authenticatedContext('uid-A').database();
 const other=env.authenticatedContext('uid-B').database();
 const anon=env.unauthenticatedContext().database();
 const protectedRoot='privateLikeBatch416/uid-A';
 const payload={version:1,pending:{trackA:{liked:true}},deviceSeq:{A:1}};
 await assertFails(owner.ref(protectedRoot).set(payload));
 await assertFails(owner.ref(protectedRoot+'/version').set(3));
 await assertFails(owner.ref(protectedRoot).remove());
 await assertFails(owner.ref('privateLikeBatch416').set({ 'uid-A':payload }));
 await assertFails(other.ref(protectedRoot).set(payload));
 await assertFails(anon.ref(protectedRoot).set(payload));
 await env.withSecurityRulesDisabled(async admin=>{
   await admin.database().ref(protectedRoot).set({
     version:3,window:{id:'00000000-0000-4000-8000-000000000001',
       lastClickAtMs:123456,minutes:5},
     sealed:{rows:[{trackId:'private-song',liked:true}]},
   });
 });
 await assertFails(owner.ref(protectedRoot).get());
 await assertFails(other.ref(protectedRoot).get());
 await assertFails(anon.ref(protectedRoot).get());
 await assertFails(owner.ref(protectedRoot+'/sealed').remove());
 await assertFails(owner.ref(protectedRoot+'/sealed/rows/0/liked').set(false));
 // Sibling structure preserves full old-client semantics.
 const oldSignal={version:1,results:[{trackId:'song',ownerUid:'uid-A',
   liked:true,operationId:'00000000-0000-4000-8000-000000000001',
   version:1,at:Date.now(),status:'pending'}]};
 await assertSucceeds(owner.ref('userSync/uid-A/exploreLikeIntent416').set(oldSignal));
 await assertSucceeds(owner.ref('userSync/uid-A/exploreLikeIntent416').remove());
 await assertSucceeds(owner.ref('userSync/uid-A/exploreLike').remove());
 await assertSucceeds(owner.ref('userSync/uid-A/exploreFollow').remove());
 await assertSucceeds(owner.ref('userSync/uid-A/musicNote').remove());
 await assertFails(other.ref('userSync/uid-A/exploreLike').remove());
 await assertFails(owner.ref('userSync/uid-A/exploreLikeBatch416').set(payload));
 console.log('STAGE416_SERVER_ONLY_ROOT_CLIENT_WRITE_AND_DELETE_DENIED=PASS');
 console.log('STAGE416_SERVER_ONLY_ROOT_PRIVATE_READ_DENIED=PASS');
 console.log('STAGE416_OLD_416_INTENT_FOLLOW_MUSIC_NOTE_RULES_UNCHANGED=PASS');
 console.log('STAGE416_SHARED_LIVE_RULES_NOT_DEPLOYED=PASS');
}finally{await env.cleanup();}
