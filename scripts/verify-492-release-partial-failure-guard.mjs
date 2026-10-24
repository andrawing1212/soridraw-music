// app492 — isolated fault-injection for the exact promotion activation blocks.
// No Cloudflare/Firebase/GitHub writes; all remote operations are stubbed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const controller=readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
const worker=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const media=readFileSync('.deploy/release-media-worker-runtime.mjs','utf8');
const stages=[
  ['test-worker', '$RUNNER_TEMP/test-worker-mutated', 'RELEASE_WORKER_VERSION="$version" node .deploy/release-worker-runtime.mjs test activate'],
  ['test-media', '$RUNNER_TEMP/test-media-worker-mutated', 'RELEASE_MEDIA_WORKER_VERSION="$media_version" node .deploy/release-media-worker-runtime.mjs test activate'],
  ['test-hosting', '$RUNNER_TEMP/test-hosting-mutated', 'npx --yes firebase-tools@latest deploy --only hosting'],
  ['test-branch', '$RUNNER_TEMP/test-branch-mutated', 'git push origin "$(cat "$RUNNER_TEMP/main-promoted"):refs/heads/main"'],
  ['production-worker', '$RUNNER_TEMP/production-worker-mutated', 'RELEASE_WORKER_VERSION="$version" EXPECTED_WORKER_BUNDLE_SHA256='],
  ['production-media', '$RUNNER_TEMP/production-media-worker-mutated', 'RELEASE_MEDIA_WORKER_VERSION="$media_version" EXPECTED_MEDIA_WORKER_BUNDLE_SHA256='],
  ['production-hosting', '$RUNNER_TEMP/production-hosting-mutated', 'npx --yes firebase-tools@latest hosting:clone'],
  ['production-branch', '$RUNNER_TEMP/production-branch-mutated', 'git push origin "$(cat "$RUNNER_TEMP/production-promoted"):refs/heads/production"'],
];
for(const [name,flag,command] of stages) {
  const marker='printf true > "'+flag+'"';
  const found=[...controller.matchAll(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))];
  assert.equal(found.length,1,name+' mutation marker must appear exactly once');
  const start=controller.indexOf(marker), end=controller.indexOf(command,start);
  assert.ok(end>start && end-start<250,
    name+' must mark mutation before, not after, external call');
}
assert.doesNotMatch(controller, /node \.deploy\/release-worker-runtime\.mjs test activate; printf true/,
  'late test marker must remain forbidden');
assert.doesNotMatch(controller, /node \.deploy\/release-media-worker-runtime\.mjs production activate; printf true/,
  'late production media marker must remain forbidden');

const OLD='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function activationBlock(source){
  const key='let deployAttempted = false;';
  const i=source.lastIndexOf(key);
  assert.ok(i>0,'missing attempted-before-deploy guard');
  const code=source.slice(i).trim();
  assert.match(code,/deployAttempted = true;\s*run\(process\.execPath/);
  assert.doesNotMatch(code,/deployed = true;/);
  assert.match(code,/ROLLBACK_UNVERIFIED_MANUAL_HOLD/);
  return code;
}
async function simulate(source,type,scenario){
  const isWorker=type==='worker';
  const state={active:OLD,restoreCalls:0,runCalls:0,logs:[],schedules:[{cron:'0 0 1 1 *'}]};
  const ctx={
    process:{env:{RELEASE_WORKER_VERSION:NEW,RELEASE_MEDIA_WORKER_VERSION:NEW}},
    mode:'test',WRANGLER:'wrangler',CONFIG_PATH:'config',WORKER_DIR:'fixture',apiBase:'https://mock.api.invalid',target:{worker:'fixture'},
    console:{log:x=>state.logs.push(x),error:x=>state.logs.push(x)},
    AggregateError,Error,JSON,String,
    activeVersion:async()=>state.active,
    readSchedules:async()=>[...state.schedules],
    waitForActiveVersion:async(expected)=>{
      if(state.active!==expected)throw Error('ACTIVE_VERSION_NOT_SETTLED');
      return state.active;
    },
    run:()=>{
      state.runCalls++;
      if(scenario!=='cliFailsBeforeChange')state.active=NEW;
      if(scenario!=='success')throw Error('SIMULATED_CLI_NONZERO');
    },
    restore:async()=>{
      state.restoreCalls++;
      if(scenario==='restoreFails')throw Error('SIMULATED_RESTORE_FAILURE');
      state.active=OLD;
    },
    cfPut:async()=>{},sleep:async()=>{},smoke:async()=>{},
  };
  const prelude=isWorker
    ? 'const before=await activeVersion();const schedulesBefore=await readSchedules();'
    : 'const before=await activeVersion();';
  let failure=null;
  try{
    await vm.runInNewContext('(async()=>{'+prelude+activationBlock(source)+'})()',ctx,{timeout:1000});
  }catch(err){failure=err;}
  if(scenario==='success'){
    assert.equal(failure,null,type+' normal activation');
    assert.equal(state.active,NEW);
    assert.equal(state.restoreCalls,0);
  }else if(scenario==='restoreFails'){
    assert.ok(failure && String(failure.message).includes('ROLLBACK_UNVERIFIED_MANUAL_HOLD'));
    assert.equal(state.active,NEW);
    assert.equal(state.restoreCalls,1);
  }else{
    assert.ok(failure && String(failure.message).includes('SIMULATED_CLI_NONZERO'));
    assert.equal(state.active,OLD,'partial failure must leave exact original active');
    // Even if the first remote GET shows the old version, restore again:
    // a failed CLI may have queued a delayed remote activation.
    assert.equal(state.restoreCalls,1,'every failed deploy attempt requires verified restore');
    assert.ok(state.logs.some(x=>String(x).includes(isWorker
      ? 'WORKER_FAILURE_OLD_VERSION_AND_CRON_VERIFIED=PASS'
      : 'MEDIA_WORKER_FAILURE_OLD_VERSION_VERIFIED=PASS')));
  }
  assert.equal(state.runCalls,1,'only one simulated mutation call');
}
for(const [type,source] of [['worker',worker],['media',media]]){
  for(const caseName of ['success','cliFailsBeforeChange','cliFailsAfterChange','restoreFails'])
    await simulate(source,type,caseName);
}
// app493: the exact existing Hosting release is the only acceptable rollback.
// The rollback must use site@oldVersion -> sameSite:live, not rebuild old source.
const restoredController=readFileSync('.github/workflows/soridraw-release-promotion.yml','utf8');
for (const stage of ['soridraw-test','soridraw']){
  assert.ok(restoredController.includes('restore_hosting '+stage+' "$RUNNER_TEMP/'),
    stage+' must be restored using the exact saved Hosting version');
}
const first=restoredController.indexOf('          restore_hosting(){');
const last=restoredController.indexOf('\n          if [ "${{ steps.request.outputs.mode }}" = test ]; then',first);
assert.ok(first>0&&last>first,'missing exact Hosting rollback helper');
const helper=restoredController.slice(first,last);
assert.ok(helper.includes('hosting:clone "$site@$version_id" "$site:live"'));
assert.ok(helper.includes('HOSTING_EXACT_PREVIOUS_VERSION_AND_INDEX=PASS'));
assert.ok(helper.includes('HOSTING_PREVIOUS_VERSION_OR_BYTES_UNVERIFIED'));
assert.ok(helper.includes('sha256sum'));
assert.ok(!helper.includes('npm run build')&&!helper.includes(' deploy --only hosting'),
  'rollback must not rebuild an older source tree');
assert.ok(!restoredController.includes('hosting-rollback"; git worktree add'),
  'old re-build based Hosting rollback must be removed');
assert.ok(restoredController.includes('RELEASE_ROLLBACK_INCOMPLETE_MANUAL_HOLD=FAIL'));
assert.ok(restoredController.includes('printf true > "$RUNNER_TEMP/test-release-mutated"\n          gh release create'),
  'partial GitHub release publish must be rollback-safe');
// Exercise the real, extracted Hosting rollback Bash function with local
// curl/jq/npx mocks. No HTTP, Firebase, Worker or GitHub connections occur.
const hostingHarness=mkdtempSync(join(tmpdir(),'app492-hosting-'));
try {
  const old='sites/soridraw-test/versions/old12345';
  const latest='sites/soridraw-test/versions/new67890';
  const html='<html><body>Original TEST release</body></html>';
  const backup=join(hostingHarness,'before.tsv');
  const previousHash=join(hostingHarness,'before.sha');
  const flag=join(hostingHarness,'mutated');
  writeFileSync(backup,'previous-release\t'+old+'\n');
  writeFileSync(previousHash,createHash('sha256').update(html).digest('hex')+'\n');
  writeFileSync(flag,'true');
  const mockHelper=helper.replaceAll(String.fromCharCode(36)+'{{ steps.auth.outputs.access_token }}','MOCK_TOKEN');
  for(const scenario of [
    ['unchanged',old,0,0],
    ['clone_ok',latest,0,1],
    ['cli_nonzero_after_remote_change',latest,0,1],
    ['cli_nonzero_before_remote_change',latest,1,1],
    ['wrong_index',latest,1,1],
  ]) {
    const [name,initial,expectedExit,expectedClones]=scenario;
    const bash=[
      'set -o pipefail',
      'CURRENT_VERSION="$INITIAL_VERSION"; export CURRENT_VERSION',
      'CLONES=0',
      'curl() { case "$*" in *firebasehosting.googleapis.com*) printf "%s" "{}";; *soridraw-test.web.app/*) if [ "$CASE" = wrong_index ]; then printf "WRONG_INDEX"; else printf "%s" "$EXPECTED_HTML"; fi ;; *) return 42;; esac; }',
      'jq() { cat >/dev/null; printf "%s\\n" "$CURRENT_VERSION"; }',
      'npx() { CLONES=$((CLONES+1)); case "$*" in *"hosting:clone soridraw-test@old12345 soridraw-test:live"*) ;; *) return 42;; esac; case "$CASE" in cli_nonzero_before_remote_change) return 81;; *) CURRENT_VERSION="$OLD_VERSION"; export CURRENT_VERSION;; esac; [ "$CASE" = cli_nonzero_after_remote_change ] && return 82; return 0; }',
      'sleep() { :; }',
      mockHelper,
      'restore_hosting soridraw-test "$BACKUP" "$HASH" "$FLAG"',
      'rc=$?',
      'printf "RESULT=%s CLONES=%s\\n" "$rc" "$CLONES"',
    ].join('\n');
    const proc=spawnSync('bash',['-c',bash],{
      env:{...process.env,CASE:name,INITIAL_VERSION:initial,OLD_VERSION:old,EXPECTED_HTML:html,BACKUP:backup,HASH:previousHash,FLAG:flag,FIREBASE_PROJECT:'mock-local'},
      encoding:'utf8',timeout:12000,
    });
    assert.equal(proc.status,0,name+' mock bash crashed: '+proc.stderr);
    const found=proc.stdout.match(/RESULT=(\d+) CLONES=(\d+)/);
    assert.ok(found,name+' missing result: '+proc.stdout+' stderr='+proc.stderr);
    assert.equal(Number(found[1])===0,expectedExit===0,name+' status: '+proc.stdout);
    assert.equal(Number(found[2]),expectedClones,name+' clone calls');
    if(expectedExit===0) assert.match(proc.stdout,/HOSTING_EXACT_PREVIOUS_VERSION_AND_INDEX=PASS/);
    else assert.doesNotMatch(proc.stdout,/HOSTING_EXACT_PREVIOUS_VERSION_AND_INDEX=PASS/);
  }
} finally { rmSync(hostingHarness,{recursive:true,force:true}); }
console.log('APP493_ACTUAL_BASH_HOSTING_ROLLBACK_MOCK_5_CASES=PASS');
console.log('APP493_EXACT_PREVIOUS_HOSTING_VERSION_RESTORE_AND_FAIL_CLOSED=PASS');
console.log('APP493_NO_HOSTING_REBUILD_AND_PARTIAL_RELEASE_MARKER=PASS');
console.log('APP492_PRE_MUTATION_MARKERS_8_OF_8=PASS');
console.log('APP492_WORKER_AND_MEDIA_CLI_PARTIAL_FAILURE_ROLLBACK_8_SCENARIOS=PASS');
console.log('APP492_UNPROVEN_ROLLBACK_FAIL_CLOSED=PASS');
console.log('APP492_REMOTE_WRITES=0');
