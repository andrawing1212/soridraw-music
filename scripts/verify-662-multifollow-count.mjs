import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveFollowCounts662 as settle,shouldApplyActorFollowSignal662 as gate}
 from '../src/services/exploreFollowCountAuthority662.ts';
const input={previousFollowing:false,following:true,baseFollowerCount:1,
 baseFollowingCount:4,baseActorFollowingCount:1};
assert.deepEqual(settle({...input}),{followerCount:2,followingCount:4,actorFollowingCount:2});
assert.deepEqual(settle({...input,canonical:{
 followerCount:5,followingCount:9,actorFollowingCount:3,
 countVerified661:true,actorCountVerified662:true,
}}),{followerCount:5,followingCount:9,actorFollowingCount:3},
 '1:N confirmed values override stale 1:1 delta');
assert.deepEqual(settle({...input,canonical:{
 followerCount:0,followingCount:0,actorFollowingCount:0,
 countVerified661:true,actorCountVerified662:true,
}}),{followerCount:0,followingCount:0,actorFollowingCount:0},
 'a verified zero is distinct from missing values');
assert.deepEqual(settle({...input,canonical:{
 followerCount:0,followingCount:0,actorFollowingCount:0,
 countVerified661:false,actorCountVerified662:false,
}}),{followerCount:2,followingCount:4,actorFollowingCount:2},
 'unverified/missing ACK does not erase counts');
assert.deepEqual(settle({
 previousFollowing:true,following:false,baseFollowerCount:2,
 baseFollowingCount:0,baseActorFollowingCount:3,
 canonical:{followerCount:4,followingCount:7,actorFollowingCount:2,
 countVerified661:true,actorCountVerified662:true}
}),{followerCount:4,followingCount:7,actorFollowingCount:2},
 'real multi-follower unfollow does not decrement stale target number');
assert.equal(gate(99,100),false);
assert.equal(gate(100,100),false);
assert.equal(gate(101,100),true);
assert.equal(gate(101,0),true);
const client=readFileSync('src/pages/ExplorePage.tsx','utf8');
const social=readFileSync('src/services/exploreSocialService.ts','utf8');
assert.match(client,/resolveFollowCounts662\(/);
assert.match(client,/paint\(confirmed\.isFollowing, true, confirmed\)/);
assert.match(client,/resolvedSignalActorFollowing379 = signal377\.actorFollowingCount/);
assert.match(client,/resolvedSignalTargetFollower379 = signal377\.targetFollowerCount/);
assert.match(client,/shouldApplyActorFollowSignal662\(signal377\.at,ownRequest662\.at\)/);
assert.match(client,/latestActorSignal662Ref/);
assert.match(social,/actorCountVerified662: row\?\.followProtocol===354 && row\?\.canonicalCounts662===true/);
console.log('APP662_CANONICAL_1_TO_N_FOLLOW_COUNTS_BEAT_STALE_DELTA=PASS');
console.log('APP662_SIGNED_TARGET_AND_ACTOR_ACK_ZERO_AND_DEFERRED_BOUNDARY=PASS');
console.log('APP662_RETAINED_SAME_ACCOUNT_SIGNAL_ORDERING=PASS');
