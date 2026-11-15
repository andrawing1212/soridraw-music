// APP667 — prepare one additive, *inactive* public follow RTDB rule.
// The checked-in Rules JSON is NOT identical to the LIVE shared Rules.
// Call this only on an authorized GET of the live rules, never by replacing
// that live document with repository database.rules.json.
const validation667="newData.hasChildren(['profileUid','generation','revision','followerCount','followingCount','public','commitId','at']) && newData.numChildren() === 8";
export const PUBLIC_FOLLOW_PROFILE_RULE_667={
 '$uid':{
  '.read':"auth != null && data.child('public').val() === true",
  '.write':false,
  '.validate':validation667,
  'profileUid':{'.validate':"newData.isString() && newData.val() === $uid && newData.val().matches(/^[A-Za-z0-9_-]{1,128}$/)"},
  'generation':{'.validate':"newData.isString() && newData.val().matches(/^[a-f0-9]{32}$/)"},
  'revision':{'.validate':"newData.isNumber() && newData.val() > 0 && newData.val() <= 9007199254740991"},
  'followerCount':{'.validate':"newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000"},
  'followingCount':{'.validate':"newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000"},
  'public':{'.validate':"newData.isBoolean() && newData.val() === true"},
  'commitId':{'.validate':"newData.isString() && newData.val().matches(/^[a-f0-9]{64}$/)"},
  'at':{'.validate':"newData.isNumber() && newData.val() > 0 && newData.val() <= 9007199254740991"},
  '$other':{'.validate':false}
 }
};
const json=v=>JSON.stringify(v);
const deniesGrant=v=>v===undefined||v===null||v===false;
// Any inherited grant overrides a stricter descendant in RTDB Rules.
const inheritedGrantUnsafe=(rules)=>{
 for(const parent of [rules,rules?.publicSync]){
  if(!parent||typeof parent!=='object')return true;
  if(!deniesGrant(parent['.read'])||!deniesGrant(parent['.write']))return true;
  for(const [key,child] of Object.entries(parent)){
   if(key.startsWith('
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const makeAdditivePublicFollowRules667=(live)=>{
 if(!isPlain(live)||!isPlain(live.rules)||!isPlain(live.rules.publicSync)||
    live.rules['.read']!==false||live.rules['.write']!==false||
    !isPlain(live.rules.ownerFollowerSync532)||
    !isPlain(live.rules.publicSync.explorePublicationProfiles)||
    inheritedGrantUnsafe(live.rules))
  throw Error('667_LIVE_RULES_BOUNDARY_UNVERIFIED');
 const current=live.rules.publicSync.exploreFollowProfiles667;
 if(current!==undefined&&json(current)!==json(PUBLIC_FOLLOW_PROFILE_RULE_667))
  throw Error('667_EXISTING_RULE_CONFLICT');
 const candidate=JSON.parse(JSON.stringify(live));
 candidate.rules.publicSync.exploreFollowProfiles667=
  JSON.parse(json(PUBLIC_FOLLOW_PROFILE_RULE_667));
 // Reconstruct the old document from the candidate to prove no parent/unrelated
 // ACL, owner-private path, or publicSync sibling was modified or deleted.
 const restored=JSON.parse(JSON.stringify(candidate));
 if(current===undefined)delete restored.rules.publicSync.exploreFollowProfiles667;
 else restored.rules.publicSync.exploreFollowProfiles667=current;
 if(json(restored)!==json(live))throw Error('667_UNRELATED_ACL_DRIFT');
 return {candidate,mode:current===undefined?'ADD_EXACT_ONE_CHILD':'ALREADY_EXACT'};
};
)&&child&&typeof child==='object'&&
      (!deniesGrant(child['.read'])||!deniesGrant(child['.write'])))
     return true;
  }
 }
 return false;
};
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const makeAdditivePublicFollowRules667=(live)=>{
 if(!isPlain(live)||!isPlain(live.rules)||!isPlain(live.rules.publicSync)||
    live.rules['.read']!==false||live.rules['.write']!==false||
    !isPlain(live.rules.ownerFollowerSync532)||
    !isPlain(live.rules.publicSync.explorePublicationProfiles))
  throw Error('667_LIVE_RULES_BOUNDARY_UNVERIFIED');
 const current=live.rules.publicSync.exploreFollowProfiles667;
 if(current!==undefined&&json(current)!==json(PUBLIC_FOLLOW_PROFILE_RULE_667))
  throw Error('667_EXISTING_RULE_CONFLICT');
 const candidate=JSON.parse(JSON.stringify(live));
 candidate.rules.publicSync.exploreFollowProfiles667=
  JSON.parse(json(PUBLIC_FOLLOW_PROFILE_RULE_667));
 // Reconstruct the old document from the candidate to prove no parent/unrelated
 // ACL, owner-private path, or publicSync sibling was modified or deleted.
 const restored=JSON.parse(JSON.stringify(candidate));
 if(current===undefined)delete restored.rules.publicSync.exploreFollowProfiles667;
 else restored.rules.publicSync.exploreFollowProfiles667=current;
 if(json(restored)!==json(live))throw Error('667_UNRELATED_ACL_DRIFT');
 return {candidate,mode:current===undefined?'ADD_EXACT_ONE_CHILD':'ALREADY_EXACT'};
};
