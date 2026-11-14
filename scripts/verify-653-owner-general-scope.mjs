// APP653: PREVIEW general-owner receiver/enrollment scope is gated OFF
// unless explicit source and server env are both ON. This pure test has no
// Firebase/Cloudflare network, Auth modifications, D1 or RTDB writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {ownerFollowScope653,isPreviewOwnerEnrollmentOrigin653}=
 require('../functions/src/ownerFollowScope653.ts');
const canary='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const base={SORIDRAW_OWNER_FOLLOW_READY_608:'1',
 SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:canary};
assert.deepEqual(ownerFollowScope653(base,false),
 {enabled:false,canaryUid:'',general:false});
assert.deepEqual(ownerFollowScope653({...base,SORIDRAW_OWNER_FOLLOW_READY_608:'0'},true),
 {enabled:false,canaryUid:'',general:false});
assert.deepEqual(ownerFollowScope653(base,true),
 {enabled:true,canaryUid:canary,general:false});
assert.deepEqual(ownerFollowScope653({...base,SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1'},true),
 {enabled:true,canaryUid:canary,general:false});
assert.deepEqual(ownerFollowScope653({...base,SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',
 SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only'},true),
 {enabled:true,canaryUid:undefined,general:true});
assert.equal(isPreviewOwnerEnrollmentOrigin653('https://preview.soridraw.com'),true);
for(const origin of ['https://soridraw.com','https://test.soridraw.com','https://foo.example',null])
 assert.equal(isPreviewOwnerEnrollmentOrigin653(origin),false);
for(const p of ['exploreOwnerFollowerWebhook542','ownerFollowEnrollment544','ownerFollowAuthProof547']){
 const s=require('node:fs').readFileSync('functions/src/'+p+'.ts','utf8');
 assert.match(s,/ownerFollowScope653\(process\.env/);
 assert.match(s,/canaryUid:scope\.canaryUid|scope\.canaryUid!==undefined|allowedUid:scope\.canaryUid/);
}
assert.match(require('node:fs').readFileSync('functions/src/ownerFollowEnrollment544.ts','utf8'),
 /enforceAppCheck:true/);
console.log('APP653_PREVIEW_GENERAL_OWNER_EXPLICIT_ENV_AND_SAME_ACCOUNT_ENROLLMENT=PASS');
console.log('APP653_DEFAULT_CANARY_ONLY_COMPILATION_OFF_AND_OTHER_HOSTS_DENIED=PASS');
