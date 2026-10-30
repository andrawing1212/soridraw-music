// app518 isolated legacy Explore release safety: no live API, deploy, DB or R2.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const start=source.indexOf('async function assertNoLegacyExploreBudgetDowngrade518()');
const end=source.indexOf('\nawait assertNoLegacyExploreBudgetDowngrade518();',start);
assert.ok(start>0&&end>start,'preflight must precede legacy mutation');
const fixture=source.slice(start,end)+'\nreturn assertNoLegacyExploreBudgetDowngrade518;';
const expected=['soridraw-explore-api','soridraw-explore-test','soridraw-explore-preview'];
const prepare=({action='upload',flags={},deny=null}={})=>{
 const calls=[];
 const cfGet=async url=>{
  calls.push(url);
  if(deny===url.split('/').at(-2))throw Error('HTTP_403');
  const name=url.split('/').at(-2);
  return {bindings:[{name:'DB',type:'d1',database_id:'shared'},...(flags[name]||[])]};
 };
 const fn=new Function('cfGet','apiBase','action',fixture)(cfGet,
  'https://api.cloudflare.com/client/v4/accounts/account',action);
 return {fn,calls};
};
for(const action of ['upload','activate','restore']){
 const test=prepare({action});
 await test.fn();
 assert.equal(test.calls.length,3);
 assert.deepEqual(test.calls.map(url=>url.split('/').at(-2)),expected);
 for(const name of expected){
  for(const marker of ['SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518',
   'SORIDRAW_APP518_RELEASE_FENCES_VERIFIED']){
   const blocked=prepare({action,flags:{[name]:[{name:marker,type:'plain_text',text:'ENFORCE'}]}});
   await assert.rejects(blocked.fn(),/HOLD_518_LEGACY_EXPLORE_ROLLBACK_REOPENS_D1_BYPASS/);
  }
 }
}
for(const action of ['verify','dry-run']){
 const test=prepare({action});
 await test.fn();assert.equal(test.calls.length,0);
}
for(const action of ['upload','activate','restore']){
 const test=prepare({action,deny:'soridraw-explore-test'});
 await assert.rejects(test.fn(),/HTTP_403/);
}
assert.match(source,/await assertNoLegacyExploreBudgetDowngrade518\(\);\s*await makeConfig\(\)/);
console.log('APP518_LEGACY_EXPLORE_UPLOAD_ACTIVATE_RESTORE_FENCE=PASS');
console.log('APP518_NO_MUTATION_READONLY_VERIFY_NO_EXTRA_CALLS=PASS');
