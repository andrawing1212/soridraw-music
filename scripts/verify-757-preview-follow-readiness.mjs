import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessApp757CanaryReadiness,summarizeOwnerRules}
 from './app757-preview-follow-readiness.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const required=[
 ['DB','d1'],['PROFILE_MEDIA','r2_bucket'],
 ['OWNER_FOLLOW_RECOVERY_557','durable_object_namespace'],
 ['OWNER_FOLLOW_RESERVATION_SERVICE_600','service'],
 ['SORIDRAW_OWNER_FOLLOW_CANARY_UID_574','plain_text'],
 ['SORIDRAW_OWNER_FOLLOW_HMAC_539','secret_text'],
 ['SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','secret_text']
];
const worker={name:'soridraw-explore-preview',activeVersion:'cfd40718-6ab5-4133-bdb2-fa69332d6810',
 trafficPercent:100,pinnedBindingsVerified:true,schedulesVerified:true,
 bindings:required.map(([name,type])=>({name,type})).concat([
  {name:'SORIDRAW_ENVIRONMENT',type:'plain_text',plainHash:hash('preview')}
 ])};
const names=['enrollOwnerFollow544Candidate','verifyOwnerFollowEpoch547Candidate',
 'publishExploreOwnerFollower542'];
const funcs=Object.fromEntries(names.map(n=>[n,{status:'ACTIVE'}]));
const validRule={'rules':{'.read':false,'.write':false,
 ownerFollowerSync532:{$uid:{'.read':'auth != null && auth.uid === $uid',
 '.write':false}}}};
const proof=summarizeOwnerRules(validRule);
assert.deepEqual(proof,{rulesNodePresent:true,ownerReadOnly:true,clientWriteBlocked:true});
assert.equal(summarizeOwnerRules({rules:{'.read':true,'.write':false,
 ownerFollowerSync532:validRule.rules.ownerFollowerSync532}}).clientWriteBlocked,false);
assert.equal(summarizeOwnerRules({rules:{'.read':false,'.write':false,
 ownerFollowerSync532:{$uid:{'.read':'auth != null && auth.uid === $uid || true',
 '.write':false}}}}).ownerReadOnly,false);
assert.deepEqual(summarizeOwnerRules({rules:{'.read':false,'.write':false}}),
 {rulesNodePresent:false,ownerReadOnly:false,clientWriteBlocked:false});
const sample={worker,functions:funcs,rtDb:{status:'READ',singleInstance:true,...proof},
 gitRulesNode:true,sourceHeadPinned:true};
const ready=assessApp757CanaryReadiness(sample);
assert.equal(ready.status,'HOLD');
assert.equal(ready.blockers.length,1);
assert.equal(ready.blockers[0],'CANARY_REAL_PROOF_AND_ROLLBACK_NOT_COMPLETE');
assert.equal(ready.productionTouched,false);
assert.equal(ready.testTouched,false);
assert.equal(ready.sharedUserDataReads,0);
assert.equal(ready.previewBackendMutationAllowed,false);
assert.equal(ready.externalWrites,0);
for(const x of [
 {worker:{...worker,pinnedBindingsVerified:false},marker:'PREVIEW_ACTIVE_BINDINGS_NOT_PINNED'},
 {worker:{...worker,bindings:worker.bindings.filter(b=>b.name!=='OWNER_FOLLOW_RESERVATION_SERVICE_600')},
 marker:'PREVIEW_BINDING_MISSING_OWNER_FOLLOW_RESERVATION_SERVICE_600'},
 {worker:{...worker,bindings:worker.bindings.map(b=>b.name==='SORIDRAW_ENVIRONMENT'
  ?{...b,plainHash:hash('production')}:b)},marker:'PREVIEW_ENVIRONMENT_IDENTITY_UNVERIFIED'},
 {functions:{...funcs,publishExploreOwnerFollower542:{status:'NOT_DEPLOYED'}},
 marker:'FUNCTION_NOT_ACTIVE_OR_UNVERIFIED_publishExploreOwnerFollower542'},
 {rtDb:{status:'UNREADABLE',singleInstance:false,...summarizeOwnerRules(null)},
 marker:'SHARED_RTDB_ACTIVE_RULES_NOT_READ'},
 {rtDb:{status:'READ',singleInstance:true,...summarizeOwnerRules(null)},
 marker:'RTDB_OWNER_FOLLOW_PATH_NOT_PROVEN'},
 {gitRulesNode:false,marker:'PREVIEW_GIT_RULES_PATH_NOT_PRESENT'},
 {sourceHeadPinned:false,marker:'PREVIEW_SOURCE_NOT_PINNED'},
 ]) {
 const {marker,...patch}=x;
 const r=assessApp757CanaryReadiness({...sample,...patch});
 assert(r.blockers.includes(marker),'expected blocker '+marker);
 assert.equal(r.previewBackendMutationAllowed,false);
}
console.log('APP757_READONLY_RESOURCE_STATUS_AND_OWNER_RULE_FENCES=PASS');
console.log('APP757_NO_AUTOMATIC_PREVIEW_BACKEND_DEPLOY_OR_DATA_ACCESS=PASS');
console.log('APP757_CANARY_REAL_ROLLBACK_PROOF_REQUIRED_HOLD=PASS');
