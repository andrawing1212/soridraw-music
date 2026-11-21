import assert from 'node:assert/strict';
import {assessApp758ProductionFollow} from './app758-production-owner-follow-readonly.mjs';
const prod={
 name:'soridraw-explore-api',
 activeVersion:'af81502a-298d-4ec6-bc2a-0c529d6dc29e',
 trafficPercent:100,pinnedBindingsVerified:true,schedulesVerified:true,schedules:[],
 bindings:[
  {name:'DB',type:'d1'},
  {name:'PROFILE_MEDIA',type:'r2_bucket'},
  {name:'EXPLORE_MIRROR_PREVIEW',type:'service'},
  {name:'EXPLORE_MIRROR_TEST',type:'service'},
 ],
};
const owner={
 name:'soridraw-owner-follow-preview-candidate',
 activeVersion:'1e987bc3-36d3-4bb0-861f-4df17f536592',
 trafficPercent:100,pinnedBindingsVerified:false,
 pinnedBindingMismatchPaths:[
  'settings:SORIDRAW_FOLLOW_CANARY_UID_713:plain_text',
  'settings:SORIDRAW_FOLLOW_SERVER_CLICK_713:plain_text',
 ],
 bindings:[{name:'OWNER_FOLLOW_DO_600',type:'durable_object_namespace',
  class_name:'OwnerFollowerStandalone600'}],
};
const names=['enrollOwnerFollow544Candidate','verifyOwnerFollowEpoch547Candidate',
 'publishExploreOwnerFollower542'];
const funcs=Object.fromEntries(names.map(name=>[name,{
 state:'ACTIVE',updatedAt:'2026-11-14T16:07:19Z',
 sourceIdentityHash:'f'.repeat(64),previewOnly:true,generalPreviewEnabled:true,
}]));
const input={production:prod,previewOwner:owner,functions:funcs,
 productionSourceSha:'a'.repeat(40),previewSourceSha:'b'.repeat(40)};
const result=assessApp758ProductionFollow(input);
assert.equal(result.status,'HOLD');
assert.equal(result.deployAuthorized,false);
assert.equal(result.externalWrites,0);
assert.equal(result.userDataReads,0);
assert.equal(result.productionExplore.activeVersion,prod.activeVersion);
assert(result.productionExplore.legacyServiceBindingsPreserved);
assert.deepEqual(result.previewOwnerReference.pinningMismatchPaths,owner.pinnedBindingMismatchPaths);
assert(result.blockers.includes('PRODUCTION_OWNER_SERVICE_ROUTE_NOT_PRESENT'));
assert(result.blockers.includes('PRODUCTION_FUNCTIONS_SHARED_PREVIEW_BOUNDARY_REQUIRES_SAFE_PARITY_PLAN'));
assert.equal(result.immutableBefore.functionRevisions.length,3);
assert.equal(result.immutableBefore.physicalRollbackRehearsalCompleted,false);
assert(!JSON.stringify(result).includes('SECRET123'));
assert.equal(assessApp758ProductionFollow(input).immutableBefore.productionExploreBindingLabelsSha256,
 result.immutableBefore.productionExploreBindingLabelsSha256);
const changedEnv=structuredClone(input);
changedEnv.functions[names[0]].previewOnly=false;
assert(assessApp758ProductionFollow(changedEnv).blockers.includes(
 'SHARED_FUNCTION_EXISTING_PREVIEW_SCOPE_UNVERIFIED_'+names[0]));
const changedFn=structuredClone(input);
changedFn.functions[names[1]].sourceIdentityHash=null;
assert(assessApp758ProductionFollow(changedFn).blockers.includes(
 'SHARED_FUNCTION_BUILD_PIN_MISSING_'+names[1]));
const droppedLegacy=structuredClone(input);
droppedLegacy.production.bindings=droppedLegacy.production.bindings.filter(
 b=>b.name!=='EXPLORE_MIRROR_TEST');
assert(assessApp758ProductionFollow(droppedLegacy).blockers.includes(
 'PRODUCTION_LEGACY_SERVICE_BINDING_NOT_PRESERVED'));
const changedActive=structuredClone(input);
changedActive.production.trafficPercent=10;
assert(assessApp758ProductionFollow(changedActive).blockers.includes(
 'PRODUCTION_ACTIVE_EXPLORE_NOT_PINNED'));
const newOwner=structuredClone(input);
newOwner.previewOwner.bindings=[];
assert(assessApp758ProductionFollow(newOwner).blockers.includes(
 'PREVIEW_OWNER_REFERENCE_IDENTITY_UNPROVEN'));
assert(!result.nextSafeWork.some(x=>/DEPLOY_NOW|AUTO_COPY/.test(x)));
console.log('APP758_PRODUCTION_FOLLOW_IMMUTABLE_ROLLBACK_PREP=PASS; PROD_DEPLOY=0');
