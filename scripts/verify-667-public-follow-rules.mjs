import assert from 'node:assert/strict';
import {makeAdditivePublicFollowRules667,PUBLIC_FOLLOW_PROFILE_RULE_667} from './lib/public-follow-rules-667.mjs';
const live={rules:{'.read':false,'.write':false,
 ownerFollowerSync532:{$uid:{'.read':"auth.uid === $uid",'.write':false}},
 publicSync:{explorePublicationProfiles:{$ownerKey:{'.read':'auth != null','.write':false}},
 exploreLike:{'.write':false},navigationVisibility:{'.write':false},'$other':{'.validate':false}},
 userSync:{$uid:{'.read':"auth.uid === $uid"}}}};
const original=JSON.stringify(live);
const {candidate,mode}=makeAdditivePublicFollowRules667(live);
assert.equal(mode,'ADD_EXACT_ONE_CHILD');
assert.equal(JSON.stringify(live),original);
const proposed=candidate.rules.publicSync.exploreFollowProfiles667;
assert.deepEqual(proposed,PUBLIC_FOLLOW_PROFILE_RULE_667);
assert.equal(proposed.$uid['.write'],false);
assert.match(proposed.$uid['.read'],/auth != null/);
assert.match(proposed.$uid['.read'],/public/);
assert.equal(candidate.rules['.read'],false);
assert.equal(candidate.rules['.write'],false);
assert.deepEqual(candidate.rules.ownerFollowerSync532,live.rules.ownerFollowerSync532);
assert.deepEqual(candidate.rules.userSync,live.rules.userSync);
assert.deepEqual(candidate.rules.publicSync.exploreLike,live.rules.publicSync.exploreLike);
assert.equal(makeAdditivePublicFollowRules667(candidate).mode,'ALREADY_EXACT');
const conflict=structuredClone(candidate);
conflict.rules.publicSync.exploreFollowProfiles667.$uid['.write']=true;
assert.throws(()=>makeAdditivePublicFollowRules667(conflict),/RULE_CONFLICT/);
for(const bad of [
 {...live,rules:{...live.rules,'.read':true}},
 {...live,rules:{...live.rules,'.write':true}},
 {...live,rules:{...live.rules,publicSync:{}}},
 {...live,rules:{...live.rules,ownerFollowerSync532:undefined}},
 ]){
 assert.throws(()=>makeAdditivePublicFollowRules667(bad),/BOUNDARY_UNVERIFIED/);
}
console.log('APP667_SHARED_LIVE_RULES_ADDITIVE_ONLY=PASS');
console.log('APP667_OWNER_PRIVATE_AND_OTHER_ACLS_PRESERVED=PASS');
console.log('APP667_AUTH_PUBLIC_ONLY_READ_AND_NO_CLIENT_WRITE=PASS');
