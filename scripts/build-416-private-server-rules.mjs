// Stage416: additive SERVER-ONLY private click/settlement authority.
// DO NOT edit or deploy database.rules.json from this script.
// Existing userSync clients continue working unchanged on all environments.
export const buildStage416ServerRulesCandidate=(source)=>{
 if(!source?.rules||typeof source.rules!=='object'||Array.isArray(source.rules))
  throw Error('416_INVALID_RULES_SOURCE');
 if(Object.hasOwn(source.rules,'privateLikeBatch416'))
  throw Error('416_RULES_EXISTING_NODE_REVIEW_REQUIRED');
 const out=structuredClone(source);
 out.rules.privateLikeBatch416={
  '.read':false,'.write':false,
  '$uid':{'.read':false,'.write':false},
 };
 // A separate very small canonical receipt; never expose pending, seal,
 // device counter or server batch contents. Admin writes; own UID reads only.
 if(Object.hasOwn(source.rules,'privateLikeFinal416'))
  throw Error('416_FINAL_RECEIPT_NODE_REVIEW_REQUIRED');
 out.rules.privateLikeFinal416={
  '.read':false,'.write':false,
  '$uid':{
   '.read':'auth != null && auth.uid === $uid',
   '.write':false,
  },
 };
 return out;
};
