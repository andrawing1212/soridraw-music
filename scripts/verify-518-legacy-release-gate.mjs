// app518 isolated legacy Explore release safety: no live API, deploy, DB or R2.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const start=source.indexOf('async function assertNoLegacyExploreBudgetDowngrade518()');
const end=source.indexOf('\nawait assertNoLegacyExploreBudgetDowngrade518();',start);
assert.ok(start>0&&end>start,'preflight must precede legacy mutation');
const fixture='let protectedRestorePreflight518=false;\n'+source.slice(start,end)+
 '\nreturn {preflight:assertNoLegacyExploreBudgetDowngrade518,protected:()=>protectedRestorePreflight518};';
const expected=['soridraw-explore-api','soridraw-explore-test','soridraw-explore-preview'];
const markers=['SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518',
 'SORIDRAW_APP518_RELEASE_FENCES_VERIFIED'];
const version='deadbeef-1111-4111-8111-123456789abc';
const prepare=({action='upload',flags={},deny=null,trust='ok',rollbackVersion=version}={})=>{
 const calls=[],commands=[];
 const cfGet=async url=>{
  calls.push(url);
  const name=url.split('/').at(-2);
  if(deny===name)throw Error('HTTP_403');
  return {bindings:[{name:'DB',type:'d1',database_id:'shared'},...(flags[name]||[])]};
 };
 const run=(command,args,cwd)=>{
  commands.push({command,args,cwd});
  if(trust!=='ok')throw Error('HOLD_518_AUDITOR_TRUST_SECRET_NOT_PINNED');
 };
 const fakeProcess={execPath:'/node',env:{RELEASE_WORKER_VERSION:rollbackVersion}};
 const loaded=new Function('cfGet','apiBase','action','run','target','ROOT','process',fixture)(
  cfGet,'https://api.cloudflare.com/client/v4/accounts/account',action,run,
  {worker:'soridraw-explore-test'},'/repo',fakeProcess);
 return {...loaded,calls,commands};
};
for(const action of ['upload','activate','restore']){
 const test=prepare({action});
 await test.preflight();
 assert.equal(test.calls.length,3);
 assert.deepEqual(test.calls.map(url=>url.split('/').at(-2)),expected);
 assert.equal(test.commands.length,0,'unprotected release unchanged');
 for(const name of expected){
  for(const marker of markers){
   const protectedEnv=prepare({action,
    flags:{[name]:[{name:marker,type:'plain_text',text:'ENFORCE'}]}});
   if(action==='restore'){
    await protectedEnv.preflight();
    assert.equal(protectedEnv.protected(),true);
    assert.equal(protectedEnv.commands.length,1);
    assert.deepEqual(protectedEnv.commands[0].args,[
     'scripts/verify-518-account-release-preflight.mjs',
     '--pre-restore','soridraw-explore-test',version]);
    const noTrust=prepare({action,trust:'missing',
     flags:{[name]:[{name:marker,type:'plain_text',text:'ENFORCE'}]}});
    await assert.rejects(noTrust.preflight(),/HOLD_518_AUDITOR_TRUST_SECRET_NOT_PINNED/);
    const wrongTarget=prepare({action,rollbackVersion:'',
     flags:{[name]:[{name:marker,type:'plain_text',text:'ENFORCE'}]}});
    await assert.rejects(wrongTarget.preflight(),/HOLD_518_PROTECTED_ROLLBACK_TARGET_MISSING/);
   }else{
    await assert.rejects(protectedEnv.preflight(),
     /HOLD_518_LEGACY_EXPLORE_ROLLBACK_REOPENS_D1_BYPASS/);
    assert.equal(protectedEnv.commands.length,0);
   }
  }
 }
}
for(const action of ['verify','dry-run']){
 const test=prepare({action});
 await test.preflight();
 assert.equal(test.calls.length,0);
 assert.equal(test.commands.length,0);
}
for(const action of ['upload','activate','restore']){
 const test=prepare({action,deny:'soridraw-explore-test'});
 await assert.rejects(test.preflight(),/HTTP_403/);
}
assert.match(source,/await assertNoLegacyExploreBudgetDowngrade518\(\);\s*await makeConfig\(\)/);
assert.match(source,/--post-restore',target.worker,version/);
console.log('APP518_LEGACY_UPLOAD_ACTIVATE_NO_PROTECTED_DOWNGRADE=PASS');
console.log('APP518_PROTECTED_RESTORE_INDEPENDENT_TRUST_REQUIRED=PASS');
console.log('APP518_NO_MUTATION_READONLY_VERIFY_NO_EXTRA_CALLS=PASS');
