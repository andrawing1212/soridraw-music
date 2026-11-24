import assert from 'node:assert/strict';
import {mayListenToProductionOwner797,mayListenToPublicFollowHost797,mayListenToPreviewOwnerGeneral659,captureOwnerFollowCanaryOptIn634} from '../src/lib/ownerFollowCanaryTab634';
import {ownerFollowScope653,isProductionOwnerEnrollmentOrigin797,isPreviewOwnerEnrollmentOrigin653} from '../functions/src/ownerFollowScope653';
const env={SORIDRAW_OWNER_FOLLOW_READY_608:'1',SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',SORIDRAW_OWNER_FOLLOW_PRODUCTION_ENROLL_797:'1'};
assert(mayListenToProductionOwner797('soridraw.com','owner'));
assert(mayListenToPreviewOwnerGeneral659('preview.soridraw.com','owner',true));
assert(mayListenToPublicFollowHost797('preview.soridraw.com'));
assert(mayListenToPublicFollowHost797('soridraw.com'));
assert(!mayListenToProductionOwner797('soridraw.com','bad/owner'));
for(const h of ['test.soridraw.com','evil.soridraw.com','soridraw.com.evil','localhost']){
 assert(!mayListenToPublicFollowHost797(h));assert(!mayListenToProductionOwner797(h,'owner'));
 assert(!isProductionOwnerEnrollmentOrigin797('https://'+h,env));
}
assert(!captureOwnerFollowCanaryOptIn634('soridraw.com','?ownerFollowCanary=1',null));
assert(isPreviewOwnerEnrollmentOrigin653('https://preview.soridraw.com'));
assert(isProductionOwnerEnrollmentOrigin797('https://soridraw.com',env));
assert(!isProductionOwnerEnrollmentOrigin797('https://soridraw.com',{...env,SORIDRAW_OWNER_FOLLOW_PRODUCTION_ENROLL_797:'0'}));
assert(ownerFollowScope653(env,true).general);
assert(!ownerFollowScope653(env,false).enabled);
console.log('APP797_PRODUCTION_HOST_AND_EXPLICIT_ENROLLMENT_SCOPE=PASS');
