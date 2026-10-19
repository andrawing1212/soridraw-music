import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const requireForVm = createRequire(import.meta.url);
const coreTs = readFileSync('functions/src/explorePublicationRelease431.ts','utf8');
const endpoint = readFileSync('functions/src/explorePublicationReleaseEndpoint431.ts','utf8');
const index = readFileSync('functions/src/index.ts','utf8');
const client = readFileSync('src/services/explorePublicPublicationSyncService.ts','utf8');
const publication = readFileSync('src/services/explorePublicationService.ts','utf8');
const rules = JSON.parse(readFileSync('database.rules.json','utf8'));
const patch101 = readFileSync('cloudflare/explore-worker/patches/101-publication-live-convergence.mjs','utf8');
const wrangler = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
const releaseRuntime = readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const releaseWorkflow = readFileSync('.github/workflows/publication-signal-preview-release-431.yml','utf8');

assert.equal(rules?.rules?.publicSync?.explorePublication?.['.write'], false);
assert.equal(rules?.rules?.publicSync?.explorePublication?.['.read'], 'auth != null');
assert.equal(rules?.rules?.publicSync?.explorePublicationProfiles?.$ownerKey?.['.write'], false);
assert.doesNotMatch(client, /runTransaction|publishExplorePublicPublicationInvalidation429|mergeExplorePublicPublicationSignal429/);
assert.doesNotMatch(publication, /publishExplorePublicPublicationInvalidation429|publicationStateUpdatedAt429|proofAt429/);

assert.match(patch101,/SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_432_20261019/);
assert.match(patch101,/writeAndPublishPublicationState431/);
assert.match(patch101,/publicationLiveCard432/);
assert.match(patch101,/handlePublicationLiveCard432/);
assert.match(patch101,/caches\.default\.match\(edgeKey\)/);
assert.match(patch101,/SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT/);
assert.match(patch101,/SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET/);
assert.match(patch101,/X-Soridraw-431-Publication-Signature/);
assert.match(patch101,/await requireExploreAuth\(request\.clone\(\)\)/);
assert.doesNotMatch(patch101,/publicationStateUpdatedAt429/);

assert.match(endpoint,/defineSecret\('SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET'\)/);
assert.match(endpoint,/publicationRelease431Candidate/);
assert.match(endpoint,/publicationRelease431Test/);
assert.match(endpoint,/publicationRelease431Production/);
assert.match(index,/publicationRelease431Candidate/);
assert.equal(wrangler?.vars?.SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT,
  'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicationRelease431Candidate');
assert.match(releaseRuntime,/publicationRelease431Test/);
assert.match(releaseRuntime,/publicationRelease431Production/);
assert.match(releaseWorkflow,/audit_result/);
assert.match(releaseWorkflow,/workflow_dispatch:/);
assert.match(releaseWorkflow,/push:\s*\n\s*branches:\s*\[preview\]\s*\n\s*paths:\s*\n\s*- '\.deploy\/publication-signal-preview-release-431\.trigger'/);
assert.match(releaseWorkflow,/MANUAL_TARGET_SHA: \$\{\{ inputs\.target_sha \}\}/);
assert.match(releaseWorkflow,/MANUAL_AUDIT_RESULT: \$\{\{ inputs\.audit_result \}\}/);
assert.match(releaseWorkflow,/test "\$GITHUB_EVENT_NAME" = 'workflow_dispatch'/);
assert.match(releaseWorkflow,/test "\$audit" = PASS/);
assert.match(releaseWorkflow,/test "\$release" = 'app434'/);
assert.match(releaseWorkflow,/test "\$target" = '8eb3264f1c7abaf36a59026248a61c6700e3b9a0'/);
assert.match(releaseWorkflow,/ref: \$\{\{ steps\.source\.outputs\.sha \}\}/);
assert.match(releaseWorkflow,/test "\$\(git rev-parse HEAD\)" = "\$\{\{ steps\.source\.outputs\.sha \}\}"/);
assert.match(releaseWorkflow,/--only "functions:\$FUNCTION_NAME"/);
assert.match(releaseWorkflow,/431_ONLY_APPROVED_FUNCTION_CHANGED=PASS/);
assert.match(releaseWorkflow,/Build isolated exact Candidate Function package/);
assert.match(releaseWorkflow,/explorePublicationReleaseEndpoint431 explorePublicationRelease431/);
assert.match(releaseWorkflow,/cmp "functions\/lib\/\$module\.js" "\$stage_dir\/lib\/\$module\.js"/);
assert.match(releaseWorkflow,/431_EXACT_AUDITED_FUNCTION_ISOLATION=PASS/);
assert.match(releaseWorkflow,/431_UNRELATED_STAGE420_SECRETS_EXCLUDED=PASS/);
assert.match(releaseWorkflow,/--config preview\.publication431\.firebase\.json/);
assert.doesNotMatch(releaseWorkflow,/--config firebase\.json\s+--only "functions:/);

// Execute the pure HMAC/Admin-RTDB core with per-path in-memory transactions.
const transpiled=ts.transpileModule(coreTs,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText;
const mod={exports:{}};
new Function('require','module','exports',transpiled)(requireForVm,mod,mod.exports);
const publish=mod.exports.publishPublicationRelease431;
assert.equal(typeof publish,'function');

const states=new Map();
const fakeDb={
  ref:(path)=>({
    transaction:async(update)=>{
      const current=states.has(path)?structuredClone(states.get(path)):null;
      const next=update(current);
      if(next===undefined)return {committed:false,snapshot:{val:()=>states.get(path)??null}};
      states.set(path,structuredClone(next));
      return {committed:true,snapshot:{val:()=>states.get(path)}};
    },
  }),
};
const secret='431-test-secret-abcdefghijklmnopqrstuvwxyz-0123456789';
const now=Date.now();
const claim={schemaVersion:1,
  trackId:'music_note_ownerA_source1',ownerUid:'ownerA',status:'public',
  stateUpdatedAt:now-100,signedAtMs:now};
const raw=JSON.stringify(claim);
const sig=createHmac('sha256',secret).update(raw,'utf8').digest('hex');
const first=await publish(fakeDb,raw,sig,secret,now);
assert.equal(first.status,'PUBLISHED');
assert.equal(first.signalChanged,true);
const feed=states.get('publicSync/explorePublication');
const profile=states.get('publicSync/explorePublicationProfiles/'+encodeURIComponent('ownerA'));
assert.equal(feed.actorUid,'publication-server-431');
assert.equal(feed.rows.length,1);
assert.equal(feed.rows[0].trackId,claim.trackId);
assert.equal(feed.rows[0].at,claim.stateUpdatedAt);
assert.equal(feed.rows[0].status,'public');
assert.equal(profile.rows[0].trackId,claim.trackId);
const duplicate=await publish(fakeDb,raw,sig,secret,now+10);
assert.equal(duplicate.status,'DUPLICATE');
assert.equal(duplicate.signalChanged,false);
await assert.rejects(()=>publish(fakeDb,raw,'0'.repeat(64),secret,now),/BAD_SIGNATURE/);
const badClaim={...claim,trackId:'music_note_somebodyElse_source1'};
const badRaw=JSON.stringify(badClaim);
const badSig=createHmac('sha256',secret).update(badRaw,'utf8').digest('hex');
await assert.rejects(()=>publish(fakeDb,badRaw,badSig,secret,now),/BAD_CLAIM/);
// Materialize patch100 + patch101 against the canonical Worker fixture.
const temp=mkdtempSync(join(tmpdir(),'soridraw-app432-'));
try{
  copyFileSync('cloudflare/explore-worker/canonical/preview-worker.js',join(temp,'worker.js'));
  for(const name of ['100-music-note-next-song-legacy-parity.mjs','101-publication-live-convergence.mjs']){
    const result=spawnSync(process.execPath,[resolve('cloudflare/explore-worker/patches',name)],{
      encoding:'utf8',env:{...process.env,SORIDRAW_REMOTE_WORKER_DIR:temp},
    });
    assert.equal(result.status,0,result.stderr||result.stdout);
  }
  const worker=readFileSync(join(temp,'worker.js'),'utf8');
  assert.match(worker,/SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_432_20261019/);
  assert.match(worker,/writeAndPublishPublicationState431/);
  assert.match(worker,/publicationLiveCard432/);
  assert.match(worker,/handlePublicationLiveCard432/);
  assert.match(worker,/caches\.default\.match\(edgeKey\)/);
  assert.match(worker,/X-Soridraw-431-Publication-Signature/);
  assert.doesNotMatch(worker,/publicationStateUpdatedAt429/);
}finally{rmSync(temp,{recursive:true,force:true});}

console.log('APP431_BROWSER_PUBLICATION_SIGNAL_WRITE_FALSE=PASS');
console.log('APP431_HMAC_SERVER_ISSUER_AND_OWNER_BINDING=PASS');
console.log('APP431_DUPLICATE_IDEMPOTENCY=PASS');
console.log('APP431_ENVIRONMENT_ENDPOINT_SEPARATION=PASS');
console.log('APP431_EXACT_ONE_FUNCTION_RELEASE_GUARD=PASS');
