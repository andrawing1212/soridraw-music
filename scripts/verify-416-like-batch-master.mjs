// Stage416 Master 2-clock configuration: isolated Admin RTDB emulator.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
let code = stripTypeScriptTypes(
  readFileSync('functions/src/exploreLikeBatchSettings416.ts','utf8'),
  {mode:'strip'},
).replace(/^import.*;\s*$/gm,'').replaceAll('export const ', 'const ');
code+='\nmodule.exports={parseLikeBatchTiming416,readLikeBatchTiming416,changeLikeBatchTiming416};';
const module={exports:{}};
vm.runInNewContext(code,{module,Number,Array,Date,Error},{timeout:1000});
const {parseLikeBatchTiming416:parse,readLikeBatchTiming416:read,changeLikeBatchTiming416:change}=module.exports;
for(const invalid of [{privateMinutes:0,publicMinutes:5},{privateMinutes:5,publicMinutes:2},
 {privateMinutes:'5',publicMinutes:5},{privateMinutes:5,publicMinutes:30},{}]){
  assert.throws(()=>parse(invalid));
}
let store=null,readCount=0,writes=0;
const db={ref:(path)=>{
  assert.equal(path,'likeBatchTiming416/current');
  return {
    get:async()=>{readCount++;return {val:()=>store}},
    transaction:async(run)=>{
      const result=run(store);
      if(result===undefined)return {committed:false,snapshot:{val:()=>store}};
      store=result;writes++;
      return {committed:true,snapshot:{val:()=>store}};
    },
  };
}};
const initial=await read(db);
assert.deepEqual([initial.privateMinutes,initial.publicMinutes,initial.version],[5,5,0]);
assert.equal(readCount,1);
const update=await change(db,'master-user',{privateMinutes:1,publicMinutes:20},0,100_000);
assert.equal(update.version,1);assert.equal(update.privateMinutes,1);assert.equal(update.publicMinutes,20);
assert.equal(store.audit.length,1);assert.equal(writes,1);
await assert.rejects(change(db,'other-master',{privateMinutes:3,publicMinutes:20},0,110_000),/CONFLICT/);
assert.equal(writes,1,'stale Master cannot overwrite other Master settings');
await assert.rejects(change(db,'master-user',{privateMinutes:1,publicMinutes:20},1,120_000),/UNCHANGED/);
assert.equal(writes,1,'no-change Master save W0');
const v2=await change(db,'master-user',{privateMinutes:10,publicMinutes:3},1,130_000);
assert.equal(v2.version,2);assert.equal(writes,2);
for(let n=3;n<=14;n++){
  const value=n%2?{privateMinutes:1,publicMinutes:5}:{privateMinutes:5,publicMinutes:10};
  await change(db,'master-user',value,n-1,130_000+n*1000);
}
assert.equal(store.audit.length,10,'server Master audit remains bounded');
const fn=readFileSync('functions/src/index.ts','utf8');
for(const name of ['masterGetLikeBatchTiming416','masterSetLikeBatchTiming416'])
  assert.match(fn,new RegExp('export const '+name+' = makeMaster'));
for(const suffix of ['Test','Production'])
  for(const name of ['masterGetLikeBatchTiming416','masterSetLikeBatchTiming416'])
    assert.match(fn,new RegExp('export const '+name+suffix+' = makeMaster'));
assert.match(fn,/const \{ requesterUid \} = await requireMasterCaller\(request\)/);
assert.match(fn,/effectiveForNewWindows: true/);
console.log('STAGE416_MASTER_TWO_INDEPENDENT_MINUTE_SETTINGS=PASS');
console.log('STAGE416_MASTER_VERSION_CONFLICT_AND_NOOP_W0=PASS');
console.log('STAGE416_SERVER_AUTH_GUARD_AND_BOUND_AUDIT_SOURCE=PASS');
const appVersion=Number(JSON.parse(readFileSync('public/app-version.json','utf8')).version);
const page=readFileSync('src/pages/AdminAppSettingsPage.tsx','utf8');
const panel=readFileSync('src/components/Stage416LikeBatchMasterPanel.tsx','utf8');
if(appVersion>=400){
  assert.match(page,/STAGE416_LIKE_BATCH_MASTER_PANEL_ACTIVE = true/,
    'app400 must expose the Master timing panel after backend activation');
}else{
  assert.match(page,/STAGE416_LIKE_BATCH_MASTER_PANEL_ACTIVE = false/,
    'user-confirmed app399 UI must remain unchanged before completed cutover');
}
assert.match(panel,/privateMinutes/);
assert.match(panel,/publicMinutes/);
assert.doesNotMatch(panel,/개인 최종상태 서버 저장/);
assert.match(panel,/모든 사용자 공개숫자 공동 집계/);
assert.match(panel,/privateMinutes: base\.privateMinutes/);
assert.match(panel,/expectedVersion: base\.version/);
assert.match(panel,/const latest = await getLatest\(\)/);
assert.match(panel,/normalizeStaffRole\(readUserProfileCache\(uid\)\) === 'master'/);
console.log(appVersion>=400
  ? 'STAGE416_MASTER_PUBLIC_CONTROL_APP400_ACTIVE_PRIVATE_BACKEND_RETAINED=PASS'
  : 'STAGE416_MASTER_PUBLIC_CONTROL_OFF_UNTIL_RELEASE=PASS');
const wf=readFileSync('.github/workflows/preview-public-like-config448-release.yml','utf8');
assert.match(wf,/masterGetLikeBatchTiming416\|masterSetLikeBatchTiming416/);
assert.match(wf,/if: steps\.source\.outputs\.preflight != 'true'/);
assert.match(wf,/LIVE_MASTER_FUNCTION=/);
assert.match(wf,/MASTER_EXACT_EXPORT_DRIFT/);
assert.match(wf,/if\(snap\.data\(\)\?\.staffRole!=="master"\)/);
assert.match(wf,/admin\.database\(\),uid,input,version,Date\.now\(\),timingPath/);
assert.match(wf,/--only "functions:\$target_fn"/);
console.log('STAGE416_MASTER_READONLY_PREFLIGHT_AND_SINGLE_FUNCTION_RELEASE=PASS');
console.log('STAGE416_BACKEND_CONFIG_DEPLOY=NOT_RUN');
