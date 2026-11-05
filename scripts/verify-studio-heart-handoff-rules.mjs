import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const rules=JSON.parse(readFileSync('database.rules.json','utf8'));
const uid=rules.rules.userSync.$uid;
const inbox=uid.studioHeartHandoffs;
assert.equal(uid['.write'],'auth != null && auth.uid === $uid');
assert.equal(inbox?.['.validate'],"newData.hasChild('version')");
assert.match(inbox?.slots?.$slot?.['.validate']||'',/\$slot\.matches/);
assert.equal(inbox?.slots?.$slot?.$other?.['.validate'],false);
const old=structuredClone(rules);
delete old.rules.userSync.$uid.studioHeartHandoffs;
const oldSource=JSON.stringify(old,null,2)+'\n';
const hash=createHash('sha1').update('blob '+Buffer.byteLength(oldSource)+'\0'+oldSource).digest('hex');
assert.equal(hash,'fbb2dedd44158010fb8a25d26061320775877fca',
  'all old shared RTDB rules MUST be unchanged');
const fixture=(documentId='song-1',overrides={})=>({
  documentId,seq:1,desiredSaved:false,originDeviceId:'device-A',updatedAtMs:Date.now(),
  status:'pending',claimToken:'',claimedUntilMs:0,songJson:'',...overrides,
});
const env=await initializeTestEnvironment({
  projectId:'demo-soridraw-studio-heart-handoff',
  database:{host:'127.0.0.1',port:9000,rules:JSON.stringify(rules)},
});
try{
 const owner=env.authenticatedContext('uid-A').database();
 const other=env.authenticatedContext('uid-B').database();
 const anon=env.unauthenticatedContext().database();
 const base='userSync/uid-A/studioHeartHandoffs';
 const slot=i=>owner.ref(base+'/slots/'+i);
 await assertFails(anon.ref(base).get());
 await assertFails(other.ref(base).get());
 await assertFails(other.ref(base+'/slots/0').set(fixture()));
 await assertFails(anon.ref(base+'/slots/0').set(fixture()));
 await assertSucceeds(owner.ref(base).set({version:1,slots:{'0':fixture()}}));
 await assertSucceeds(slot(0).set(fixture('song-1',{
   status:'claimed',claimToken:'claim-A',claimedUntilMs:Date.now()+30000,
 })));
 await assertSucceeds(slot(0).set(fixture('song-1',{
   seq:2,desiredSaved:true,songJson:'{"title":"A"}',
 })));
 await assertFails(slot(0).set(fixture('song-1',{seq:1})));
 await assertFails(slot(0).set(fixture('song-1',{seq:3,unexpected:true})));
 await assertFails(slot(0).set(fixture('song-1',{seq:3,status:'completed'})));
 await assertFails(slot(0).set(fixture('song-1',{seq:3,songJson:'가'.repeat(24001)})));
 for(let i=1;i<20;i++) await assertSucceeds(slot(i).set(fixture('song-'+(i+1))));
 await assertFails(slot(20).set(fixture('song-21')));
 await assertFails(slot('evil').set(fixture('song-21')));
 await assertSucceeds(slot(0).remove());
 await assertSucceeds(slot(0).set(fixture('song-21')));
 await assertSucceeds(owner.ref('userSync/uid-A/musicNote').set({
   version:101,at:Date.now(),originDeviceId:'existing',
   operation:'heart-preview-unsave',affectedCount:1,truncated:false,
   documentIds:['song-1'],itemJson:'{"id":"song-1"}',
 }));
 await assertSucceeds(owner.ref('userSync/uid-A/recentSongs').remove());
 await assertFails(owner.ref('userSync/uid-A/unauthorizedNewNode').set({x:1}));
 console.log('STUDIO_HEART_RTD_B_EXACT_ONE_SUBTREE_AND_LEGACY_SIGNAL=PASS');
 console.log('STUDIO_HEART_RTD_B_OWNER_ONLY_20_HARD_SLOTS_AND_24KB_LIMIT=PASS');
 console.log('SHARED_RTD_B_RULES_DEPLOY=NOT_RUN');
}finally{await env.cleanup();}
