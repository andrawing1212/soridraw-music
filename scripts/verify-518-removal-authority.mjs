import assert from 'node:assert/strict';
import {assessCanonicalRemoval518} from '../cloudflare/media-worker/src/catalogRemovalAuthority518.js';
const uid='uid-owner',documentId='song-a';
const source={exists:true,uid,documentId,updatedAtMs:1793152800000,
 updateTime:'2026-10-28T02:00:00.000000003Z',saved:false,favoriteRemoved:true};
const plan=canonical=>assessCanonicalRemoval518({
 uid,documentId,canonical,serverVerified:true});
const soft=plan(source);
assert.equal(soft.code,'SOFT_REMOVAL_VERIFIED');
assert.ok(soft.sourceVersionNs?.length===21);
assert.equal(soft.allowR2Write,false,'gate alone is not a verified R2 CAS');
for(const unsafe of [null,{exists:false},undefined]){
 const denied=plan(unsafe);
 assert.equal(denied.code,'HOLD_HARD_DELETE_NO_COMMIT_VERSION');
 assert.equal(denied.allowR2Write,false);
}
// Older pre-delete document version cannot masquerade as the delete commit.
assert.equal(plan({...source,exists:false,beforeUpdateTime:source.updateTime}).code,
 'HOLD_HARD_DELETE_NO_COMMIT_VERSION');
assert.equal(plan({...source,uid:'other'}).code,'DENY_OWNER_OR_DOCUMENT_MISMATCH');
assert.equal(plan({...source,updateTime:''}).code,'DENY_NO_SERVER_VERSION');
assert.equal(plan({...source,saved:true,favoriteRemoved:false}).code,'NOT_REMOVED');
assert.equal(assessCanonicalRemoval518({
 uid,documentId,canonical:source,serverVerified:false}).code,'DENY_UNVERIFIED_REMOVAL');
console.log('APP518_SOFT_TOMBSTONE_LATEST_SERVER_UPDATE_TIME=PASS');
console.log('APP518_LEGACY_HARD_DELETE_NO_INVENTED_COMMIT_VERSION=PASS');
console.log('APP518_CROSS_OWNER_REMOVE_FAIL_CLOSED=PASS');
console.log('APP518_HARD_DELETE_SOURCE_ONLY_NO_R2_WRITES=PASS');
