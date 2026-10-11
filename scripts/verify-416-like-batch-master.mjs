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
  assert.match(fn,new RegExp('export const '+name+' = onCall'));
assert.match(fn,/const \{ requesterUid \} = await requireMasterCaller\(request\)/);
assert.match(fn,/effectiveForNewWindows: true/);
console.log('STAGE416_MASTER_TWO_INDEPENDENT_MINUTE_SETTINGS=PASS');
console.log('STAGE416_MASTER_VERSION_CONFLICT_AND_NOOP_W0=PASS');
console.log('STAGE416_SERVER_AUTH_GUARD_AND_BOUND_AUDIT_SOURCE=PASS');
const page=readFileSync('src/pages/AdminAppSettingsPage.tsx','utf8');
const panel=readFileSync('src/components/Stage416LikeBatchMasterPanel.tsx','utf8');
assert.match(page,/STAGE416_LIKE_BATCH_MASTER_PANEL_ACTIVE = false/,
  'user-confirmed app399 UI must remain unchanged before completed cutover');
assert.match(panel,/privateMinutes/);
assert.match(panel,/publicMinutes/);
assert.match(panel,/expectedVersion: loaded.version/);
assert.match(panel,/normalizeStaffRole\(readUserProfileCache\(uid\)\) === 'master'/);
console.log('STAGE416_MASTER_TWO_INDEPENDENT_CONTROLS_OFF_UNTIL_RELEASE=PASS');
console.log('STAGE416_BACKEND_CONFIG_DEPLOY=NOT_RUN');
