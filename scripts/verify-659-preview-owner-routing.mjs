import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerFollowTargetInScope659 as allowed} from '../cloudflare/explore-worker/runtime/owner-follow-target-scope-659.mjs';
const C='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const path=u=>'/v1/profiles/'+u+'/follow';
const canary={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:C};
const general={...canary,SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',
 SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only',
 SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607:'1',SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607:'1'};
assert.equal(allowed(canary,path(C)),true);
assert.equal(allowed(canary,path('B')),false);
assert.equal(allowed(general,path('B')),true);
for(const flag of ['SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653',
 'SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653',
 'SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607',
 'SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607']){
 const x={...general};delete x[flag];
 assert.equal(allowed(x,path('B')),false,'missing_'+flag);
 assert.equal(allowed(x,path(C)),true);
}
for(const t of ['production','test',''])
 assert.equal(allowed({...general,SORIDRAW_ENVIRONMENT:t},path('B')),false);
for(const bad of ['/v1/profiles/B/follow/','/v1/profiles/B/likes',
 '/v1/profiles/B%2FC/follow','/v1/profiles//follow'])
 assert.equal(allowed(general,bad),false);
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const client=readFileSync('src/services/exploreOwnerFollowerSync542.ts','utf8');
assert.match(entry,/ownerFollowTargetInScope659\(env,url\.pathname\)/);
assert.match(client,/APP659_GENERAL_PREVIEW_OWNERS_ENABLED=false/);
assert.match(client,/new WeakMap/);
console.log('APP659_GENERAL_OWNER_PREVIEW_SCOPE_NO_POLL_NO_WIDE_ROUTE=PASS');
