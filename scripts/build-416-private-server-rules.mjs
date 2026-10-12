// Stage416: additive SERVER-ONLY private click/settlement authority.
// DO NOT edit or deploy database.rules.json from this script.
// Existing userSync clients continue working unchanged on all environments.
const batchRules416={
 '.read':false,'.write':false,
 '$uid':{'.read':false,'.write':false},
};
const finalRules416={
 '.read':false,'.write':false,
 '$uid':{
  '.read':'auth != null && auth.uid === $uid',
  '.write':false,
 },
};
const stable416=(value)=>{
 if(Array.isArray(value))return value.map(stable416);
 if(value&&typeof value==='object')
  return Object.fromEntries(Object.keys(value).sort().map(
   key=>[key,stable416(value[key])]));
 return value;
};
const exact416=(actual,expected)=>
 JSON.stringify(stable416(actual))===JSON.stringify(stable416(expected));

export const buildStage416ServerRulesCandidate=(source)=>{
 if(!source?.rules||typeof source.rules!=='object'||Array.isArray(source.rules))
  throw Error('416_INVALID_RULES_SOURCE');
 const hasBatch=Object.hasOwn(source.rules,'privateLikeBatch416');
 const hasFinal=Object.hasOwn(source.rules,'privateLikeFinal416');
 if(hasBatch||hasFinal){
  if(!hasBatch||!hasFinal)
   throw Error('416_RULES_PARTIAL_EXISTING_NODE_REVIEW_REQUIRED');
  if(!exact416(source.rules.privateLikeBatch416,batchRules416)||
     !exact416(source.rules.privateLikeFinal416,finalRules416))
   throw Error('416_RULES_EXISTING_NODE_REVIEW_REQUIRED');
  // The release candidate may already contain the exact additive nodes.
  // Treat an exact match as an idempotent no-op; never rewrite unknown rules.
  return structuredClone(source);
 }
 const out=structuredClone(source);
 out.rules.privateLikeBatch416=structuredClone(batchRules416);
 // A separate very small canonical receipt; never expose pending, seal,
 // device counter or server batch contents. Admin writes; own UID reads only.
 out.rules.privateLikeFinal416=structuredClone(finalRules416);
 return out;
};
