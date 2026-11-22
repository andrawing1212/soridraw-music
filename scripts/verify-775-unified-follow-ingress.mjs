// APP775 off-only ingress unit tests. Never runs shared Worker/DO/D1/R2.
import assert from 'node:assert/strict';
import {APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN,
 assessApp775UnifiedFollowIngress} from './app775-unified-follow-ingress.mjs';
import {webcrypto} from 'node:crypto';
const initialFetch=globalThis.fetch;
const initialCrypto=globalThis.crypto;
globalThis.fetch=()=>{throw Error('APP775_ZERO_NETWORK_ONLY')};
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const token='qa775_new_epoch_cutover_token_00001';
const actorUid='qa775Actor',ownerUid='qa775Owner';
const authEpoch='a'.repeat(32),ownerAuthEpoch='b'.repeat(32);
const expectedRevision=17;
const canonicalId=async desired=>{
 const bytes=new TextEncoder().encode(JSON.stringify([
  token,actorUid,ownerUid,expectedRevision,desired,
 ]));
 const h=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return 'owner_follow_579_'+[...h].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const id=await canonicalId(true);
const base={
 enabled:true,scope:'APP775_OFFLINE_SYNTHETIC_ONLY',method:'PUT',
 ownerUid,body:'{}',
 verifiedActor:{source:'SIGNED_FIREBASE_AUTH_APP_CHECK_775',
  verified:true,firebaseProjectId:'soridraw-app-866a5',
  uid:actorUid,authEpoch},
 ownerEnrollment:{source:'TRUSTED_OWNER_ENROLLMENT_775',
  verified:true,ownerUid,enrolled:true,ownerAuthEpoch,
  ownerDeletionAndUidReuseReviewed:true},
 cutover:{source:'SERVER_COMPLETE_WRITER_CUTOVER_775',verified:true,
  token,completeBeforeFirstAcceptedOperation:true,
  everyActiveWriterCovered:true,everyLegacyWriterCovered:true,
  noLegacyBypassToCanonical:true,fullOwnerDoPitrCannotBypass:true,
  authDeletionLifecycleReviewed:true,previewTestProdCompatibilityReviewed:true},
 serverIdentity:{source:'TRUSTED_EXACT_SERVER_PAIR_IDENTITY_775',
  verified:true,ownerUid,actorUid,authEpoch,ownerAuthEpoch,
  cutoverToken:token,expectedRevision,canonicalOperationId:id,
  serverIssuedOrVerified:true},
 pair:{source:'TRUSTED_EXACT_PAIR_REVISION_775',verified:true,
  ownerUid,actorUid,authEpoch,ownerAuthEpoch,
  revision:expectedRevision,following:false},
 pendingFence:{source:'INDEPENDENT_PAIR_PENDING_FENCE_775',
  verified:true,independentOfOwnerDo:true,ownerUid,actorUid,authEpoch,
  canonicalOperationId:id,noEarlierPendingOperation:true,
  noLaterWriterBypass:true,allLegacyWritersCovered:true,
  fullOwnerDoPitrProtected:true},
};
const clone=()=>structuredClone(base);
function noMutation(o){
 for(const k of ['legacyCanonicalModified','routeToLiveCanonical',
 'canonicalD1WriteAuthorized','doReservationAuthorized',
 'r2AdmissionAuthorized','retryAuthorized','relayAuthorized',
 'activeRuntimeConnected','productionDeployAuthorized'])
  assert.equal(o[k],false,'no operation must be authorized: '+k);
}
let cases=0;
async function mustHold(label,fn,reason){
 const x=clone();fn(x);
 const out=await assessApp775UnifiedFollowIngress(x);
 assert.equal(out.status,'HOLD',label);
 if(reason)assert.equal(out.reason,reason,label);
 noMutation(out);cases++;
}
async function shape(label,fn,kind,changed=true){
 const x=clone();fn(x);
 const out=await assessApp775UnifiedFollowIngress(x);
 assert.equal(out.status,'OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY',label);
 assert.equal(out.envelopeKind,kind,label);
 assert.equal(out.admissionRequiredIfConnected,changed,label);
 noMutation(out);cases++;
}
try{
 assert.equal(APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN,false);
 const disabled=await assessApp775UnifiedFollowIngress({...clone(),enabled:false});
 assert.equal(disabled.status,'OFF_LEGACY_UNCHANGED');
 noMutation(disabled);cases++;
 await shape('legacy empty',x=>{x.body=''},'legacy');
 await shape('legacy object',x=>{x.body='{}'},'legacy');
 await shape('ordered same server id',x=>{x.body=JSON.stringify({
  followOperationId:id,followExpectedRevision:expectedRevision,
 })},'ordered');
 await shape('legacy same-state no mutation',x=>{x.pair.following=true},'legacy',false);
 await shape('ordered same-state',x=>{x.pair.following=true;x.body=JSON.stringify({
  followOperationId:id,followExpectedRevision:expectedRevision,
 })},'ordered',false);
 const unfollowId=await canonicalId(false);
 await shape('legacy unfollow stable ID',x=>{x.method='DELETE';x.pair.following=true;x.serverIdentity.canonicalOperationId=unfollowId;x.pendingFence.canonicalOperationId=unfollowId},'legacy');
 await mustHold('enabled in other scope',x=>{x.scope='production'},
  'OFFLINE_SCOPE_REQUIRED');
 await mustHold('missing scope',x=>{delete x.scope});
 await mustHold('unsupported method',x=>{x.method='POST'});
 await mustHold('invalid owner',x=>{x.ownerUid='bad/uid'});
 await mustHold('client sent malformed JSON',x=>{x.body='{'});
 await mustHold('client partial ordered ID',x=>{x.body='{"followOperationId":"partial"}'});
 await mustHold('client supplied extra key',x=>{x.body=JSON.stringify({
  followOperationId:id,followExpectedRevision:17,unexpected:1})});
 await mustHold('oversized body',x=>{x.body=' '.repeat(513)});
 await mustHold('missing verified auth',x=>{delete x.verifiedActor});
 await mustHold('spoofed Firebase project',x=>{x.verifiedActor.firebaseProjectId='wrong'});
 await mustHold('self following',x=>{x.verifiedActor.uid=ownerUid});
 await mustHold('actor auth generation stale',x=>{x.verifiedActor.authEpoch='f'.repeat(32)});
 await mustHold('owner not enrolled',x=>{x.ownerEnrollment.enrolled=false});
 await mustHold('owner deletion policy unknown',x=>{x.ownerEnrollment.ownerDeletionAndUidReuseReviewed=false});
 await mustHold('owner epoch changed',x=>{x.ownerEnrollment.ownerAuthEpoch='c'.repeat(32)});
 await mustHold('missing cutover',x=>{delete x.cutover});
 await mustHold('cutover incomplete',x=>{x.cutover.completeBeforeFirstAcceptedOperation=false});
 await mustHold('current writer bypass',x=>{x.cutover.everyActiveWriterCovered=false});
 await mustHold('legacy writer bypass',x=>{x.cutover.everyLegacyWriterCovered=false});
 await mustHold('existing direct canonical bypass',x=>{x.cutover.noLegacyBypassToCanonical=false});
 await mustHold('DO rollback can bypass',x=>{x.cutover.fullOwnerDoPitrCannotBypass=false});
 await mustHold('client compatibility unreviewed',x=>{x.cutover.previewTestProdCompatibilityReviewed=false});
 await mustHold('missing server op id',x=>{delete x.serverIdentity});
 await mustHold('operation id client forged',x=>{x.serverIdentity.serverIssuedOrVerified=false});
 await mustHold('different exact revision',x=>{x.serverIdentity.expectedRevision=18});
 await mustHold('generation mismatch',x=>{x.serverIdentity.authEpoch='f'.repeat(32)});
 await mustHold('missing exact pair',x=>{delete x.pair});
 await mustHold('stale pair revision',x=>{x.pair.revision=16});
 await mustHold('unverified pair',x=>{x.pair.verified=false});
 await mustHold('pending fence absent',x=>{delete x.pendingFence});
 await mustHold('pending predecessor',x=>{x.pendingFence.noEarlierPendingOperation=false});
 await mustHold('subsequent writer can overwrite',x=>{x.pendingFence.noLaterWriterBypass=false});
 await mustHold('legacy fence gap',x=>{x.pendingFence.allLegacyWritersCovered=false});
 await mustHold('DO PITR gap',x=>{x.pendingFence.fullOwnerDoPitrProtected=false});
 await mustHold('fence tied to DO',x=>{x.pendingFence.independentOfOwnerDo=false});
 await mustHold('ordered ID mismatch',x=>{x.body=JSON.stringify({
  followOperationId:'otherCanonicalOperationId1234',
  followExpectedRevision:expectedRevision,
 })});
 await mustHold('ordered revision mismatch',x=>{x.body=JSON.stringify({
  followOperationId:id,followExpectedRevision:18,
 })});
 await mustHold('legacy identity different',x=>{x.serverIdentity.canonicalOperationId='notTheLegacyStableOperation123'});
 // Concurrent identical legacy requests compute the same stable candidate
 // ID but can never directly call canonical, R2 or D1.
 const both=await Promise.all(Array.from({length:2},
  ()=>assessApp775UnifiedFollowIngress(clone())));
 assert.equal(both.length,2);
 assert.equal(both[0].operationId,both[1].operationId);
 for(const item of both){noMutation(item);assert.equal(
  item.status,'OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY')}
 cases++;
 console.log('APP775_SOURCE_ONLY_OFF_DEFAULT=PASS');
 console.log('APP775_LEGACY_AND_ORDERED_COMMON_SERVER_IDENTITY_SHAPES=PASS');
 console.log('APP775_OLD_WRITER_AUTH_PITR_PENDING_FENCE_FAIL_CLOSED=PASS');
 console.log('APP775_CONCURRENT_LEGACY_SAME_ID_NO_CANONICAL_WRITES=PASS');
 console.log('APP775_OFFLINE_CASES='+cases+'; REAL_CLOUDFLARE_CALLS=0');
 console.log('APP775_REAL_UNIFIED_INGRESS_RUNTIME=OFF_NOT_TESTED');
}finally{
 globalThis.fetch=initialFetch;
 if(!initialCrypto)delete globalThis.crypto;
}
