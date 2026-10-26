#!/usr/bin/env node
import assert from 'node:assert/strict';
import { canonicalJSON, sha256, signOwnerAcceptance, verifyOwnerAcceptance } from './release-owner-acceptance-497.mjs';
const sha20='a'.repeat(40), sha20b='b'.repeat(40), sha32='c'.repeat(64), sha32b='d'.repeat(64);
const pending={
  schema:5,state:'TEST_AUTO_CHECKED',tag:'soridraw-test-v468-aaaaaaaaaaaa',appVersion:468,
  sourcePreviewSha:sha20,sourcePreviewTree:sha20b,promotedMainSha:sha20b,mainTree:sha20,
  distIndexSha256:sha32,
  testHosting:{site:'soridraw-test',channel:'live',release:'sites/soridraw-test/channels/live/releases/0001',version:'sites/soridraw-test/versions/0001',verified:true},
  testWorkerBundleSha256:sha32,testWorkerCodeSha256:sha32b,testWorkerVersionId:'11111111-1111-1111-1111-111111111111',
  testMediaWorkerBundleSha256:sha32,testMediaWorkerCodeSha256:sha32b,testMediaWorkerVersionId:'22222222-2222-2222-2222-222222222222',
  browserUpgradeContractSha256:sha32,
  controllerIdentity:{workflowSha256:sha32,workerRuntimeSha256:sha32,mediaWorkerRuntimeSha256:sha32,controllerVerifierSha256:sha32},
  productionEnvironmentContract:{policy:'soridraw-production-first-2026-10-06',sha256:sha32},
  parity:{reference:'PREVIEW',status:'PENDING_OWNER_ACCEPTANCE'},
  workflowRunId:'123456789',testAutoCheckedAt:'2026-10-25T08:10:00Z',
};
const makeDevice=()=>({
 signedIn:true,reusedCache:true,emptyCache:true,musicNote:true,library:true,likes:true,
 follow:true,publication:true,profile:true,nextSong:true,
 evidenceRef:'https://github.com/andrawing1212/soridraw-music/issues/76#issuecomment-123',
 checkedAt:'2026-10-25T08:20:00Z',
});
const acceptance={
 schema:1,state:'TEST_VERIFIED',ownerLogin:'andrawing1212',ownerAuthorizedAt:'2026-10-25T08:25:00Z',
 ownerApprovalRef:'https://github.com/andrawing1212/soridraw-music/issues/76#issuecomment-124',
 releaseTag:pending.tag,sourcePreviewSha:pending.sourcePreviewSha,sourcePreviewTree:pending.sourcePreviewTree,
 promotedMainSha:pending.promotedMainSha,distIndexSha256:pending.distIndexSha256,testHosting:pending.testHosting,
 testWorkerVersionId:pending.testWorkerVersionId,testWorkerBundleSha256:pending.testWorkerBundleSha256,
 testMediaWorkerVersionId:pending.testMediaWorkerVersionId,testMediaWorkerBundleSha256:pending.testMediaWorkerBundleSha256,
 workflowRunId:pending.workflowRunId,pendingManifestSha256:sha256(canonicalJSON(pending)),
 devices:{pc:makeDevice(),mobile:makeDevice()},
 parity:{measured:true,previews:'PASS',test:'PASS',productionReadOnly:'PASS',evidenceSha256:sha32,
   evidenceRef:'https://github.com/andrawing1212/soridraw-music/actions/runs/100'},
 sharedUserOriginalsUnchanged:true,stage416Off:true,readerOff:true,noUserDataCopy:true,
};
const owner='andrawing1212',key='app497-fixture-fake-hmac-key-32-bytes-long-not-a-secret';
const clone=x=>structuredClone(x);
const signed=signOwnerAcceptance(acceptance,pending,owner,key);
assert.equal(verifyOwnerAcceptance(signed,pending,owner,key),true);
assert.deepEqual(JSON.parse(canonicalJSON({z:3,a:1})),{a:1,z:3});
const reject=(label,fn)=>assert.throws(fn,undefined,label);
reject('unsigned',()=>verifyOwnerAcceptance(acceptance,pending,owner,key));
reject('short signing key',()=>signOwnerAcceptance(acceptance,pending,owner,'short'));
reject('wrong key',()=>verifyOwnerAcceptance(signed,pending,owner,'a different 32-byte long fixture signing key'));
reject('wrong owner',()=>verifyOwnerAcceptance(signed,pending,'differentOwner',key));
for(const [name,mutate] of [
 ['altered source SHA',m=>{m.sourcePreviewSha='f'.repeat(40)}],
 ['altered main SHA',m=>{m.promotedMainSha='f'.repeat(40)}],
 ['altered Hosting',m=>{m.testHosting.version='other-version'}],
 ['altered Worker',m=>{m.testWorkerVersionId='other-version'}],
 ['altered Media Worker',m=>{m.testMediaWorkerBundleSha256='f'.repeat(64)}],
 ['altered CI run',m=>{m.workflowRunId='other-run'}],
 ['altered manifest hash',m=>{m.pendingManifestSha256='e'.repeat(64)}],
 ['PC signed out',m=>{m.devices.pc.signedIn=false}],
 ['mobile signed out',m=>{m.devices.mobile.signedIn=false}],
 ['old cache unverified',m=>{m.devices.mobile.reusedCache=false}],
 ['new cache unverified',m=>{m.devices.mobile.emptyCache=false}],
 ['Music Note unverified',m=>{m.devices.pc.musicNote=false}],
 ['next song unverified',m=>{m.devices.mobile.nextSong=false}],
 ['originals changed',m=>{m.sharedUserOriginalsUnchanged=false}],
 ['copied data',m=>{m.noUserDataCopy=false}],
 ['Reader activated',m=>{m.readerOff=false}],
 ['Stage416 activated',m=>{m.stage416Off=false}],
 ['3-env parity absent',m=>{m.parity.measured=false}],
 ['parity evidence absent',m=>{m.parity.evidenceRef=''}],
 ['owner reference absent',m=>{m.ownerApprovalRef=''}],
 ['owner date malformed',m=>{m.ownerAuthorizedAt='n/a'}],
 ['missing signature',m=>{m.signature=undefined}],
 ['forged signature',m=>{m.signature.value='e'.repeat(64)}],
]){const changed=clone(signed);mutate(changed);reject(name,()=>verifyOwnerAcceptance(changed,pending,owner,key));}
for(const [name,mutate] of [
 ['automatic record not separately accepted',m=>{m.state='TEST_VERIFIED'}],
 ['legacy schema',m=>{m.schema=4}],
 ['app version changed',m=>{m.appVersion=467}],
 ['Hosting changed',m=>{m.testHosting.release='old-release'}],
 ['Worker bundle changed',m=>{m.testWorkerBundleSha256='f'.repeat(64)}],
 ['hardcoded parity PASS',m=>{m.parity.status='PASS'}],
]){const changed=clone(pending);mutate(changed);reject(name,()=>verifyOwnerAcceptance(signed,changed,owner,key));}
console.log('APP497_OWNER_ACCEPTANCE_SIGNATURE_AND_IDENTITY=PASS');
console.log('APP497_NEGATIVE_FORGED_MISSING_STALE_APPROVAL_AND_PARITY=PASS');
console.log('APP497_AUTOMATED_TEST_ALONE_CANNOT_AUTHORIZE_PRODUCTION=PASS');
