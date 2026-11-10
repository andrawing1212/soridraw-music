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
 const initial=fixture();
 await assertSucceeds(owner.ref(base).set({version:1,slots:{'0':initial}}));
 await assertSucceeds(slot(0).set({
   ...initial,status:'claimed',claimToken:'claim-A',claimedUntilMs:Date.now()+30000,
 }));
 // Preserve the original click time across claim/release; only a new click
 // may change immutable receipt details and must increment seq.
 await assertFails(slot(0).set({...initial,desiredSaved:true}));
 await assertFails(slot(0).set({...initial,documentId:'song-2',seq:2}));
 const version2={...initial,seq:2,desiredSaved:true,songJson:'{"title":"A"}'};
 await assertSucceeds(slot(0).set(version2));
 await assertFails(slot(0).set({...version2,desiredSaved:false}));
 await assertFails(slot(0).set({...version2,documentId:'other-song',seq:3}));
 await assertFails(slot(0).set(fixture('song-1',{seq:1})));
 await assertFails(slot(0).set(fixture('song-1',{seq:3,unexpected:true})));
 await assertFails(slot(0).set(fixture('song-1',{seq:3,status:'completed'})));
 await assertFails(slot(0).set(fixture('song-1',{seq:3,songJson:'가'.repeat(24001)})));
 for(let i=1;i<20;i++) await assertSucceeds(slot(i).set(fixture('song-'+(i+1))));
 await assertFails(slot(20).set(fixture('song-21')));
 await assertFails(slot('evil').set(fixture('song-21')));
 // Two signed-in devices for the same UID race for one receipt: only one
 // transaction may claim it; a later-click version must survive stale ACK.
 const ownerB=env.authenticatedContext('uid-A').database();
 const refA=owner.ref(base+'/slots/0');
 const refB=ownerB.ref(base+'/slots/0');
 const pending={...version2,seq:10,updatedAtMs:Date.now()-7_000,
   status:'pending',claimToken:'',claimedUntilMs:0};
 await assertSucceeds(refA.set(pending));
 // Real receivers have active child listeners. Keep a value listener active
 // on each isolated client so RTDB transactions see the subscribed receipt.
 const observe=reference=>new Promise(resolve=>{
   const handler=snapshot=>{
     if(snapshot.val()?.seq===10 && snapshot.val()?.status==='pending')
       resolve(handler);
   };
   reference.on('value',handler);
 });
 const [watchA,watchB]=await Promise.all([observe(refA),observe(refB)]);
 const claimSeen=[];
 const claim=(reference,token)=>reference.transaction((current)=>{
   claimSeen.push({device:token,status:current?.status||'missing'});
   if(!current || current.status!=='pending') return;
   return {...current,status:'claimed',claimToken:token,
     claimedUntilMs:Date.now()+30_000};
 },undefined,false);
 const [claimA,claimB]=await Promise.all([claim(refA,'device-A-claim'),claim(refB,'device-B-claim')]);
 console.log('STUDIO_HEART_CLAIM_EMULATOR_TRACE='+JSON.stringify({claimSeen,
   winnerA:claimA.committed,winnerB:claimB.committed}));
 assert.equal(Number(claimA.committed)+Number(claimB.committed),1,'one winning claimant');
 const winningToken=claimA.committed?'device-A-claim':'device-B-claim';
 const claimed=(await refA.get()).val();
 assert.equal(claimed.claimToken,winningToken);
 const newer={...claimed,seq:11,desiredSaved:false,
   updatedAtMs:claimed.updatedAtMs+1000};
 await assertSucceeds(refB.set(newer));
 const staleAck=await refA.transaction(current=>
   current?.seq===10 && current.claimToken===winningToken?null:undefined,
   undefined,false);
 assert.equal(staleAck.committed,false,'stale ACK cannot delete newer intent');
 assert.equal((await refB.get()).val().seq,11);
 const releaseOld=await refA.transaction(current=>
   current?.claimToken===winningToken && current.status==='claimed'
     ? {...current,status:'pending',claimToken:'',claimedUntilMs:0}:undefined,
   undefined,false);
 assert.equal(releaseOld.committed,true,'old writer releases new version without deleting it');
 // The other client must receive the released lease before attempting its
 // next transaction; the emulator delivers that value asynchronously.
 await new Promise((resolve,reject)=>{
   let timer;
   const handle=snapshot=>{
     const state=snapshot.val();
     if(state?.seq!==11 || state?.status!=='pending') return;
     clearTimeout(timer);
     refB.off('value',handle);
     resolve();
   };
   timer=setTimeout(()=>{
     refB.off('value',handle);
     reject(new Error('NEW_VERSION_RELEASE_NOT_VISIBLE_ON_OTHER_DEVICE'));
   },5000);
   refB.on('value',handle);
 });
 const newClaim=await claim(refB,'device-B-new-claim');
 assert.equal(newClaim.committed,true,'other device can take latest version');
 assert.equal(newClaim.snapshot.val().seq,11);
 refA.off('value',watchA);
 refB.off('value',watchB);
 console.log('STUDIO_HEART_TWO_DEVICE_CLAIM_SINGLE_WINNER_AND_STALE_ACK_FENCE=PASS');
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
