import assert from 'node:assert/strict';
import {PUBLIC_FOLLOW_PROFILE_RULE_667} from './lib/public-follow-rules-667.mjs';

// Regression for Firebase RTDB Rules PUT HTTP 400:
// "No such method/property 'numChildren'". Only documented rule functions.
const root=PUBLIC_FOLLOW_PROFILE_RULE_667['$uid'];
const required=['profileUid','generation','revision','followerCount',
 'followingCount','public','commitId','at'];
assert.equal(root['.validate'],
 "newData.hasChildren(['profileUid','generation','revision','followerCount','followingCount','public','commitId','at'])");
assert.equal(root['$other']['.validate'],false);
assert.equal(root['.write'],false);
assert.equal(root['.read'],"auth != null && data.child('public').val() === true");
for(const key of required)assert.equal(typeof root[key]['.validate'],'string');
assert.doesNotMatch(JSON.stringify(PUBLIC_FOLLOW_PROFILE_RULE_667),/numChildren\s*\(/);
console.log('C_PROFILE_RULES_VALIDATOR_SUPPORTED_METHODS_AND_EXACT_CHILDREN=PASS');
