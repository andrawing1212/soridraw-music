import assert from 'node:assert/strict';
import { buildApp728ProductionBindingCandidate, classifyMissingBinding } from './app728-production-binding-candidate.mjs';

const fixedSha = 'a'.repeat(40);
const previewActive = 'cfd40718-6ab5-4133-bdb2-fa69332d6810';
const productionActive = 'af81502a-298d-4ec6-bc2a-0c529d6dc29e';
const shared = [
  ['DB','d1'], ['EXPLORE_LIKE_BATCH_SCHEDULER','durable_object_namespace'],
  ['EXPLORE_MIRROR_TOKEN','secret_text'], ['LIKE_RATE_LIMITER','ratelimit'],
  ['PROFILE_MEDIA','r2_bucket'], ['SORIDRAW_ENVIRONMENT','plain_text'],
  ['SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378','plain_text'],
  ['SORIDRAW_PUBLICATION_R2_ONLY_READ_V1','plain_text'],
  ['SORIDRAW_R2_CATALOG_V1','plain_text'], ['SORIDRAW_R2_HYBRID_READ_V1','plain_text'],
];
const extra = [
  ['BOOTSTRAP_TOKEN','plain_text'],['ENV_NAME','plain_text'],
  ['EXPLORE_CACHE','r2_bucket'],['OWNER_FOLLOW_RESERVATION_SERVICE_600','service'],
  ['PROD_BASE','plain_text'],['RATE_DB','d1'],
  ['SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019','plain_text'],
  ['SORIDRAW_NOTIFICATION_RETENTION_013','plain_text'],
  ['SORIDRAW_NOTIFICATION_SCHEMA_READY_013','plain_text'],
  ['SORIDRAW_OWNER_DO_BRIDGE_SECRET_600','secret_text'],
  ['SORIDRAW_OWNER_DO_STANDALONE_600','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_BIND_544','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_CANARY_UID_574','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_ENDPOINT_539','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','secret_text'],
  ['SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_HMAC_539','secret_text'],
  ['SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653','plain_text'],
  ['SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','plain_text'],
  ['SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET','secret_text'],
  ['SORIDRAW_PRIVATE_FINAL416_ENDPOINT','plain_text'],
  ['SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_READY_669','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_SCOPE_669','plain_text'],
  ['SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680','plain_text'],
  ['SORIDRAW_PUBLIC_RELEASE416_ENDPOINT','plain_text'],
  ['TARGET_BASE','plain_text'],
];
const prodOnly = [
  ['EXPLORE_MIRROR_PREVIEW','service'], ['EXPLORE_MIRROR_TEST','service'],
];
const cast = ([name,type]) => ({
  name, type,
  ...(name === 'DB' ? { id:'canonical-shared-d1' } : {}),
  ...(name === 'PROFILE_MEDIA' ? { bucket:'soridraw-profile-media' } : {}),
  ...(type === 'secret_text' ? { secret:'HIDDEN_SECRET_SHOULD_NOT_BE_COPIED' } : {}),
});
const snapshot = () => ({
  sourceSha:fixedSha, lockedPreviewSha:fixedSha,
  sourceCanonical: {
    d1_databases:[{binding:'DB',database_id:'canonical-shared-d1'}],
    r2_buckets:[{binding:'PROFILE_MEDIA',bucket_name:'soridraw-profile-media'}],
    migrations:[{tag:'v1',new_sqlite_classes:['ExploreLikeBatchScheduler103']}],
    durable_objects:{bindings:[{name:'EXPLORE_LIKE_BATCH_SCHEDULER',class_name:'ExploreLikeBatchScheduler103'}]},
  },
  preview:{ name:'soridraw-explore-preview', activeVersion:previewActive,
    pinnedBindingsVerified:true, schedulesVerified:true, trafficPercent:100,
    schedules:[{cron:'37 * * * *'}],bindings:[...shared,...extra].map(cast) },
  production:{ name:'soridraw-explore-api', activeVersion:productionActive,
    pinnedBindingsVerified:true, schedulesVerified:true,trafficPercent:100,
    schedules:[],bindings:[...shared,...prodOnly].map(cast) },
});

const base=buildApp728ProductionBindingCandidate(snapshot());
assert.equal(base.status,'HOLD');
assert.equal(base.executable,false);
assert.equal(base.serverMutations,0);
assert.equal(base.testEnvironmentTouched,false);
assert.deepEqual(base.proposedNewBindings,[]);
assert.deepEqual(base.namesOnlySummary.previewCount,41);
assert.deepEqual(base.namesOnlySummary.productionCount,12);
assert.deepEqual(base.namesOnlySummary.shared,10);
assert.deepEqual(base.namesOnlySummary.previewOnly,31);
assert.deepEqual(base.namesOnlySummary.productionOnly,2);
assert.equal(base.immutableProductionBaseline.existingBindingCount,12);
assert(base.immutableProductionBaseline.inheritedBindings.every(b => b.version_id===productionActive&&b.type==='inherit'));
assert(base.immutableProductionBaseline.inheritedBindings.every(b => b.version_id!==previewActive));
assert(base.productionOnlyPreserved.includes('EXPLORE_MIRROR_TEST'));
assert(base.productionOnlyPreserved.includes('EXPLORE_MIRROR_PREVIEW'));
assert(!JSON.stringify(base).includes('HIDDEN_SECRET_SHOULD_NOT_BE_COPIED'));
assert.equal(base.candidateDigest, buildApp728ProductionBindingCandidate(snapshot()).candidateDigest);
assert.equal(extra.filter(([name])=>classifyMissingBinding(name)==='follow').length,18);
assert.equal(extra.filter(([name])=>classifyMissingBinding(name)==='notification').length,3);
assert.equal(extra.filter(([name])=>classifyMissingBinding(name)==='cache-cost').length,2);
assert.equal(extra.filter(([name])=>classifyMissingBinding(name)==='environment-identity').length,4);
assert.equal(extra.filter(([name])=>classifyMissingBinding(name)==='release-endpoint').length,4);

const requested=snapshot();requested.requestedProductionNames=['RATE_DB','EXPLORE_CACHE'];
const plan=buildApp728ProductionBindingCandidate(requested);
assert.equal(plan.proposedNewBindings.length,0);
assert(plan.reviewRequired.find(x=>x.name==='RATE_DB')?.requested);
assert(plan.blockers.includes('REQUESTED_NEW_BINDINGS_REQUIRE_SEPARATE_APPROVAL_AND_PROOF'));
const canary=snapshot();canary.requestedProductionNames=['SORIDRAW_OWNER_FOLLOW_CANARY_UID_574'];
assert(buildApp728ProductionBindingCandidate(canary).blockers.includes('UNSAFE_BINDING_REQUEST_SORIDRAW_OWNER_FOLLOW_CANARY_UID_574'));
const unknown=snapshot();unknown.requestedProductionNames=['MISSING_NEW_SERVICE'];
assert(buildApp728ProductionBindingCandidate(unknown).blockers.includes('REQUEST_NOT_A_MISSING_PREVIEW_BINDING'));
const noMirror=snapshot();noMirror.production.bindings=noMirror.production.bindings.filter(x=>x.name!=='EXPLORE_MIRROR_TEST');
assert(buildApp728ProductionBindingCandidate(noMirror).blockers.includes('PRODUCTION_LEGACY_SERVICE_MISSING_EXPLORE_MIRROR_TEST'));
const diffDB=snapshot();diffDB.production.bindings.find(x=>x.name==='DB').id='WRONG';
assert(buildApp728ProductionBindingCandidate(diffDB).blockers.includes('SHARED_CANONICAL_IDENTITY_DRIFT_DB'));
const lostPin=snapshot();lostPin.production.pinnedBindingsVerified=false;
assert.equal(buildApp728ProductionBindingCandidate(lostPin).immutableProductionBaseline,null);
const duplicate=snapshot();duplicate.production.bindings.push({...duplicate.production.bindings[0]});
assert(buildApp728ProductionBindingCandidate(duplicate).blockers.includes('PRODUCTION_BINDING_LIST_INVALID'));
const migration=snapshot();migration.preview.hasUnexpectedMigration=true;
assert(buildApp728ProductionBindingCandidate(migration).blockers.includes('PREVIEW_UNRELEASED_DO_MIGRATION'));
const sourceV2=snapshot();sourceV2.sourceCanonical.migrations.push({tag:'v2',new_sqlite_classes:['OwnerFollowerRecovery557']});
sourceV2.sourceCanonical.durable_objects.bindings.push({name:'OWNER_FOLLOW_RECOVERY_557',class_name:'OwnerFollowerRecovery557'});
assert(buildApp728ProductionBindingCandidate(sourceV2).blockers.includes('SOURCE_HAS_UNRELEASED_DO_MIGRATION'));
const wrongCanonical=snapshot();wrongCanonical.sourceCanonical.d1_databases[0].database_id='wrong';
assert(buildApp728ProductionBindingCandidate(wrongCanonical).blockers.includes('SOURCE_CANONICAL_DATA_TARGET_MISMATCH'));
const missingSource=snapshot();delete missingSource.sourceCanonical;
assert(buildApp728ProductionBindingCandidate(missingSource).blockers.includes('SOURCE_CANONICAL_CONTRACT_UNVERIFIED'));
const badSha=snapshot();badSha.lockedPreviewSha='b'.repeat(40);
assert(buildApp728ProductionBindingCandidate(badSha).blockers.includes('SOURCE_NOT_LOCKED'));
console.log('APP728_PRODUCTION_BINDING_CANDIDATE=PASS (41/12 actual-name fixture, 13 protective scenarios)');
