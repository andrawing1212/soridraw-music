import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const rules = JSON.parse(readFileSync('database.rules.json','utf8'));
const uidRules = rules.rules.userSync.$uid;
const receiptRules = uidRules.studioHeartHandoffs;
assert.equal(uidRules['.write'], 'auth != null && auth.uid === $uid');
assert.equal(receiptRules?.['.validate'], 'newData.numChildren() <= 20');
assert.equal(receiptRules?.$documentId?.$other?.['.validate'], false);
const old = structuredClone(rules);
delete old.rules.userSync.$uid.studioHeartHandoffs;
const oldSource = JSON.stringify(old,null,2)+'\n';
const hash = createHash('sha1').update('blob '+Buffer.byteLength(oldSource)+'\0'+oldSource).digest('hex');
assert.equal(hash,'fbb2dedd44158010fb8a25d26061320775877fca',
  'existing shared RTDB rules changed outside the one approved subtree');

const fixture=(documentId='song-1',overrides={})=>({
  documentId,seq:1,desiredSaved:false,originDeviceId:'device-A',updatedAtMs:Date.now(),
  status:'pending',claimToken:'',claimedUntilMs:0,songJson:'',...overrides,
});
const env=await initializeTestEnvironment({
  projectId:'demo-soridraw-studio-heart-handoff',
  database:{host:'127.0.0.1',port:9000,rules:JSON.stringify(rules)},
});
try {
  const owner=env.authenticatedContext('uid-A').database();
  const other=env.authenticatedContext('uid-B').database();
  const anon=env.unauthenticatedContext().database();
  const base='userSync/uid-A/studioHeartHandoffs';
  const path=id=>owner.ref(base+'/'+id);
  await assertFails(anon.ref(base).get());
  await assertFails(other.ref(base).get());
  await assertFails(other.ref(base+'/song-1').set(fixture()));
  await assertFails(anon.ref(base+'/song-1').set(fixture()));
  await assertSucceeds(path('song-1').set(fixture()));
  await assertSucceeds(path('song-1').set(fixture('song-1',{
    status:'claimed',claimToken:'claim-A',claimedUntilMs:Date.now()+30000,
  })));
  await assertSucceeds(path('song-1').set(fixture('song-1',{
    seq:2,desiredSaved:true,songJson:'{"title":"A"}',
  })));
  await assertFails(path('song-1').set(fixture('song-1',{seq:1})));
  await assertFails(path('song-1').set(fixture('other',{seq:3})));
  await assertFails(path('song-1').set(fixture('song-1',{seq:3,unexpected:true})));
  await assertFails(path('song-1').set(fixture('song-1',{seq:3,status:'completed'})));
  await assertFails(path('song-1').set(fixture('song-1',{seq:3,songJson:'가'.repeat(24001)})));
  for(let n=2;n<=20;n++) await assertSucceeds(path('song-'+n).set(fixture('song-'+n)));
  await assertFails(path('song-21').set(fixture('song-21')));
  await assertSucceeds(path('song-1').remove());
  await assertSucceeds(path('song-21').set(fixture('song-21')));
  await assertSucceeds(owner.ref('userSync/uid-A/musicNote').set({
    version:101,at:Date.now(),originDeviceId:'existing',operation:'heart-preview-unsave',
    affectedCount:1,truncated:false,documentIds:['song-1'],itemJson:'{"id":"song-1"}',
  }));
  await assertSucceeds(owner.ref('userSync/uid-A/recentSongs').remove());
  await assertFails(owner.ref('userSync/uid-A/unrecognizedNewNode').set({x:1}));
  console.log('STUDIO_HEART_RTDB_RULES_EXACT_ONE_SUBTREE_ADDITIVE=PASS');
  console.log('STUDIO_HEART_RTDB_UID_ISOLATION_TYPE_CAP_20_SONGS=PASS');
  console.log('STUDIO_HEART_RTDB_LEGACY_SIGNAL_COMPAT=PASS');
  console.log('SHARED_RTDB_LIVE_PUT=NOT_RUN');
} finally { await env.cleanup(); }
