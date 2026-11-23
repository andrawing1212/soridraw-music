import assert from 'node:assert/strict';
import {
 APP786_OWNER_CONNECTIONS,APP786_REQUIRED_EVIDENCE,
 APP786_PRODUCTION_OWNER_CONNECTIONS_COMPILED_OPEN,
 assessApp786InactiveOwnerConnections,
} from './app786-production-owner-connections.mjs';
const old=[
 ['DB','d1'],['EXPLORE_LIKE_BATCH_SCHEDULER','durable_object_namespace'],
 ['EXPLORE_MIRROR_PREVIEW','service'],['EXPLORE_MIRROR_TEST','service'],
 ['EXPLORE_MIRROR_TOKEN','secret_text'],['LIKE_RATE_LIMITER','ratelimit'],
 ['PROFILE_MEDIA','r2_bucket'],['SORIDRAW_ENVIRONMENT','plain_text'],
 ['SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378','plain_text'],
 ['SORIDRAW_PUBLICATION_R2_ONLY_READ_V1','plain_text'],
 ['SORIDRAW_R2_CATALOG_V1','plain_text'],
 ['SORIDRAW_R2_HYBRID_READ_V1','plain_text']
];
const pOnly=['BOOTSTRAP_TOKEN','ENV_NAME','EXPLORE_CACHE','PROD_BASE',
 'RATE_DB','SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019',
 'SORIDRAW_NOTIFICATION_RETENTION_013','SORIDRAW_NOTIFICATION_SCHEMA_READY_013',
 'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET','SORIDRAW_PRIVATE_FINAL416_ENDPOINT',
 'SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT','SORIDRAW_PUBLIC_RELEASE416_ENDPOINT',
 'TARGET_BASE'];
assert.equal(APP786_PRODUCTION_OWNER_CONNECTIONS_COMPILED_OPEN,false);
assert.deepEqual(Object.fromEntries(Object.entries(APP786_OWNER_CONNECTIONS)
 .map(([k,x])=>[k,x.length])),{canonicalDurability:8,ownerDelivery:4,
  audienceAndLegacy:6});
assert.equal(new Set(Object.values(APP786_OWNER_CONNECTIONS)
 .flatMap(x=>x.map(y=>y[0]))).size,18);
const toBinding=([name,type])=>({name,type,
 // Sensitive fields are included intentionally: output MUST NOT contain them.
 secret_value:'MUST_NEVER_LEAK_APP786_SECRET',id:'MUST_NOT_LEAK_ACCOUNT_ID'});
const oldAll=old.map(toBinding);
const shared=oldAll.filter(x=>!['EXPLORE_MIRROR_PREVIEW','EXPLORE_MIRROR_TEST'].includes(x.name));
const expected=Object.values(APP786_OWNER_CONNECTIONS).flat().map(toBinding);
const preview=[...shared,...expected,...pOnly.map(n=>toBinding([n,'plain_text']))];
assert.equal(preview.length,41);
const args={previewBindings:preview,productionBindings:oldAll,
 candidateBindings:oldAll};
const x=assessApp786InactiveOwnerConnections(args);
assert.equal(x.status,'HOLD_NO_LIVE_FOLLOW_ENABLE');
assert.equal(x.productionOriginalBindings,12);
assert.equal(x.missingFollowConnections,18);
assert.equal(x.missingOtherConnections,13);
assert.equal(x.allOriginalProdBindingsPreserved,true);
assert.equal(x.originalLegacyPreviewAndTestServicePreserved,true);
assert.equal(x.zeroTrafficCandidateAllowed,true);
for(const k of ['productionReleaseAuthorized','backendDeployAuthorized',
 'additionalBindingWritesAuthorized','prodTrafficTransitionAuthorized',
 'hasActualProductionFunctionConnection','hasActualProductionOwnerDoConnection']){
 assert.equal(x[k],false,k);
}
assert.deepEqual(Object.fromEntries(Object.entries(x.evidenceGroups)
 .map(([k,v])=>[k,v.count])),{canonicalDurability:8,ownerDelivery:4,
  audienceAndLegacy:6});
for(const [k,v] of Object.entries(x.evidenceGroups)){
 assert.deepEqual(v.proofStillMissing,APP786_REQUIRED_EVIDENCE[k]);
}
assert(!JSON.stringify(x).includes('MUST_NEVER_LEAK_APP786_SECRET'));
assert(!JSON.stringify(x).includes('MUST_NOT_LEAK_ACCOUNT_ID'));
const mustFail=(options,code)=>assert.throws(
 ()=>assessApp786InactiveOwnerConnections({...args,...options}),
 new RegExp('APP786_INACTIVE_OWNER_CONNECTION_HOLD_'+code));
mustFail({compiledOpen:true},'OWNER_FEATURE_MUST_REMAIN_OFF');
mustFail({candidateBindings:[...oldAll.slice(1)]},'ACTIVE_BINDING_COUNT_NAME_OR_SHAPE_CHANGED');
mustFail({candidateBindings:[...oldAll.slice(1),expected[0]]},
 'ACTIVE_LEGACY_PRODUCTION_BINDING_DRIFT');
mustFail({candidateBindings:[...oldAll.slice(0,-1),expected[0]]},
 'ACTIVE_LEGACY_PRODUCTION_BINDING_DRIFT');
mustFail({productionBindings:[...oldAll.slice(1),expected[0]]},
 'ACTIVE_LEGACY_PRODUCTION_BINDING_DRIFT');
mustFail({previewBindings:preview.map(v=>v.name===expected[0].name?
 {...v,type:'plain_text'}:v)},
 'PREVIEW_FOLLOW_CONNECTION_SOURCE_OR_TYPE_DRIFT');
mustFail({previewBindings:[...preview,expected[0]]},
 'ACTIVE_BINDING_COUNT_NAME_OR_SHAPE_CHANGED');
console.log('APP786_PRODUCTION_FOLLOW_BINDING_EXACT_8_4_6_AND_BASELINE_12=PASS');
console.log('APP786_PRODUCTION_SECRET_VALUES_NEVER_SERIALIZED=PASS');
console.log('APP786_UNPROVEN_DO_AUTH_FUNCTION_HISTORY_AND_LEGACY_HOLD=PASS');
console.log('APP786_ZERO_TRAFFIC_OFF_ONLY_CAN_STAGE_NOT_ACTIVATE=PASS');
console.log('APP786_LIVE_BINDING_PROOF_AND_PRODUCTION_ACTIVATION=NOT_TESTED_HOLD');
