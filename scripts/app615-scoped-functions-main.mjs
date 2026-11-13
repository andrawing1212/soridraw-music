// APP615: narrow, ephemeral Firebase CLI source only for exactly three
// already installed owner-follow functions. Never edit unrelated exports/secrets.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const names=[
 'publishExploreOwnerFollower542',
 'enrollOwnerFollow544Candidate',
 'verifyOwnerFollowEpoch547Candidate',
];
const source=[
 ['exploreOwnerFollowerWebhook542.ts','APP542_OWNER_HTTP_COMPILED_OPEN'],
 ['ownerFollowEnrollment544.ts','APP544_ENROLLMENT_COMPILED_OPEN'],
 ['ownerFollowAuthProof547.ts','APP547_AUTH_PROOF_COMPILED_OPEN'],
];
const canary='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
for(const [name,flag] of source){
 const text=readFileSync('functions/src/'+name,'utf8');
 assert.ok(text.includes('export const '+flag+'=true;'),name);
 assert.ok(text.includes("process.env.SORIDRAW_OWNER_FOLLOW_READY_608!=='1'"),name);
 assert.ok(text.includes("process.env.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574"),name);
 assert.ok(text.includes(canary),name);
}
const original=JSON.parse(readFileSync('functions/package.json','utf8'));
assert.equal(original.main,'lib/securedIndex.js');
const entry=`'use strict';
const {initializeApp,getApps}=require('firebase-admin/app');
if(getApps().length!==0)throw Error('APP615_UNEXPECTED_EXISTING_ADMIN');
initializeApp({databaseURL:'https://soridraw-app-866a5-default-rtdb.firebaseio.com'});
const entries={
 publishExploreOwnerFollower542:require('./exploreOwnerFollowerWebhook542').publishExploreOwnerFollower542,
 enrollOwnerFollow544Candidate:require('./ownerFollowEnrollment544').enrollOwnerFollow544Candidate,
 verifyOwnerFollowEpoch547Candidate:require('./ownerFollowAuthProof547').verifyOwnerFollowEpoch547Candidate,
};
const expected=['enrollOwnerFollow544Candidate','publishExploreOwnerFollower542','verifyOwnerFollowEpoch547Candidate'];
if(JSON.stringify(Object.keys(entries).sort())!==JSON.stringify(expected)||
 Object.values(entries).some(v=>typeof v!=='function'))throw Error('APP615_NOT_EXACT_THREE');
module.exports=entries;
`;
writeFileSync('functions/lib/ownerFollowOnlyEntry615.js',entry,{mode:0o600});
original.main='lib/ownerFollowOnlyEntry615.js';
writeFileSync('functions/package.json',JSON.stringify(original,null,2)+'\n',{mode:0o600});
console.log('APP615_SOURCE_ONLY_THREE_OWNER_FUNCTIONS_NO_OTHER_SECRETS=PASS');
