import assert from 'node:assert/strict';
import {PUBLIC_FOLLOW_PROFILE_RULE_667,PREVIOUS_PUBLIC_FOLLOW_PROFILE_RULE_667,
 makeAdditivePublicFollowRules667} from './lib/public-follow-rules-667.mjs';

// Regression for Firebase RTDB Rules PUT HTTP 400:
// "No such method/property 'numChildren'". Only documented rule functions.
const root=PUBLIC_FOLLOW_PROFILE_RULE_667['$uid'];
const required=['profileUid','generation','revision','followerCount',
 'followingCount','public','commitId','at'];
assert.equal(root['.validate'],
 "newData.hasChildren(['profileUid','generation','revision','followerCount','followingCount','public','commitId','at'])");
assert.equal(root['$other']['.validate'],false);
assert.equal(root['.write'],false);
assert.equal(root['.read'],
 "auth != null && (!data.exists() || data.child('public').val() === true)");
assert.equal(PREVIOUS_PUBLIC_FOLLOW_PROFILE_RULE_667['$uid']['.read'],
 "auth != null && data.child('public').val() === true");
const baseline={rules:{'.read':false,'.write':false,ownerFollowerSync532:{'.read':false},
 publicSync:{'.read':false,'.write':false,explorePublicationProfiles:{'.read':false},
 exploreFollowProfiles667:PREVIOUS_PUBLIC_FOLLOW_PROFILE_RULE_667}}};
const update=makeAdditivePublicFollowRules667(baseline);
assert.equal(update.mode,'UPDATE_EXACT_CHILD_READ');
assert.equal(update.candidate.rules.publicSync.exploreFollowProfiles667['$uid']['.read'],root['.read']);
const restored=structuredClone(update.candidate);
restored.rules.publicSync.exploreFollowProfiles667=PREVIOUS_PUBLIC_FOLLOW_PROFILE_RULE_667;
assert.deepEqual(restored,baseline);
assert.equal(makeAdditivePublicFollowRules667(update.candidate).mode,'ALREADY_EXACT');
const altered=structuredClone(baseline);
altered.rules.publicSync.exploreFollowProfiles667['$uid']['.write']=true;
assert.throws(()=>makeAdditivePublicFollowRules667(altered),/667_EXISTING_RULE_CONFLICT/);
for(const key of required)assert.equal(typeof root[key]['.validate'],'string');
assert.doesNotMatch(JSON.stringify(PUBLIC_FOLLOW_PROFILE_RULE_667),/numChildren\s*\(/);
console.log('C_PROFILE_RULES_VALIDATOR_SUPPORTED_METHODS_AND_EXACT_CHILDREN=PASS');
