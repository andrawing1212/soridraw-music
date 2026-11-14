import assert from 'node:assert/strict';
import {edgeCommitId663,composePublicFollowPair663,
 normalizePublicFollowSignal663,reconcilePublicFollowSignal663 as merge}
 from './lib/follow-profile-canonical-663.mjs';
const input={cutoverToken:'cutover',actorUid:'A',targetUid:'B',
 operationId:'operation_1234567890',at:1700000000000,
 actor:{generation:'a'.repeat(32),revision:101,followerCount:7,
 followingCount:4,public:true,exact:true,pending:0},
 target:{generation:'b'.repeat(32),revision:218,followerCount:9,
 followingCount:2,public:true,exact:true,pending:0}};
const pair=composePublicFollowPair663(input);
assert.ok(pair);assert.equal(pair.actor.commitId,pair.target.commitId);
assert.equal(pair.actor.followingCount,4);assert.equal(pair.target.followerCount,9);
assert.equal(pair.actor.revision,101);assert.equal(pair.target.revision,218);
assert.equal(pair.commitId,edgeCommitId663(input));
assert.equal(merge(null,pair.actor).status,'apply');
assert.equal(merge(pair.actor,pair.actor).status,'duplicate');
assert.equal(merge({...pair.actor,revision:102},pair.actor).status,'stale');
assert.equal(merge(pair.actor,{...pair.actor,followerCount:99}).status,'same-revision-conflict');
assert.equal(merge(pair.actor,{...pair.actor,generation:'f'.repeat(32)}).status,'generation-hold');
assert.equal(merge(pair.actor,pair.target).status,'wrong-subject');
assert.equal(merge(pair.actor,{...pair.actor,revision:102}).status,'apply');
assert.equal(composePublicFollowPair663({...input,actor:{...input.actor,pending:1}}),null);
assert.equal(composePublicFollowPair663({...input,target:{...input.target,exact:false}}),null);
assert.equal(composePublicFollowPair663({...input,actor:{...input.actor,public:false}}),null);
assert.equal(composePublicFollowPair663({...input,actor:{...input.actor,followingCount:null}}),null);
assert.equal(normalizePublicFollowSignal663({...pair.actor,actorUid:'secret'}),null);
assert.equal(normalizePublicFollowSignal663({...pair.actor,authEpoch:'secret'}),null);
assert.equal(normalizePublicFollowSignal663({...pair.actor,rows:[{uid:'A'}]}),null);
assert.equal(composePublicFollowPair663({...input,operationId:'short'}),null);
console.log('APP663_SAME_COMMIT_ID_DISTINCT_SUBJECT_REVISIONS=PASS');
console.log('APP663_OLDER_DUPLICATE_CONFLICT_EPOCH_SAFE=PASS');
console.log('APP663_PRIVATE_UNSETTLED_AND_PII_EXCLUSION=PASS');
