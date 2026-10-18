import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const page = readFileSync('src/pages/ExplorePage.tsx','utf8');
const rules = JSON.parse(readFileSync('database.rules.json','utf8'));
const patch101 = readFileSync('cloudflare/explore-worker/patches/101-publication-live-convergence.mjs','utf8');
const wrangler = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
const releaseRuntime = readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const releaseWorkflow = readFileSync('.github/workflows/publication-signal-preview-release-431.yml','utf8');

assert.equal(rules?.rules?.publicSync?.explorePublication?.['.write'], false);
assert.equal(rules?.rules?.publicSync?.explorePublication?.['.read'], 'auth != null');
assert.doesNotMatch(client, /runTransaction|publishExplorePublicPublicationInvalidation429|mergeExplorePublicPublicationSignal429/);
assert.doesNotMatch(publication, /publishExplorePublicPublicationInvalidation429|publicationStateUpdatedAt429|proofAt429/);

const liveStart=page.indexOf('// app431: server-issued cross-account public changes');
const liveEnd=page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004',liveStart);
assert.ok(liveStart>=0&&liveEnd>liveStart);
const live=page.slice(liveStart,liveEnd);
assert.match(live,/isExplorePublicPublicationSignalRelevant429/);
assert.match(live,/publicLikeVisibleTracksRef192\.current/);
assert.match(live,/MIN_PUBLICATION_REFRESH_MS_430 = 30_000/);
assert.match(live,/feedRevisionRequestedUrlRef\.current = requestUrl/);
assert.doesNotMatch(live,/visibleOwnerUids430|representedFeedOwner430|setInterval\s*\(/);

assert.match(patch101,/SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_431_20261019/);
assert.match(patch101,/writeAndPublishPublicationState431/);
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
assert.match(releaseWorkflow,/test "\$\{\{ inputs\.audit_result \}\}" = PASS/);
assert.match(releaseWorkflow,/--only "functions:\$FUNCTION_NAME"/);
assert.match(releaseWorkflow,/431_ONLY_APPROVED_FUNCTION_CHANGED=PASS/);

// Execute the pure HMAC/Admin-RTDB core with a tiny in-memory transaction.
const transpiled=ts.transpileModule(coreTs,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText;
const mod={exports:{}};
new Function('require','module','exports',transpiled)(requireForVm,mod,mod.exports);
const publish=mod.exports.publishPublicationRelease431;
assert.equal(typeof publish,'function');

let state=null;
const fakeDb={
  ref:(path)=>({
    transaction:async(update)=>{
      const next=update(state===null?null:structuredClone(state));
      if(next===undefined)return {committed:false,snapshot:{val:()=>state}};
      state=structuredClone(next);
      return {committed:true,snapshot:{val:()=>state}};
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
assert.equal(state.actorUid,'publication-server-431');
assert.equal(state.rows[0].trackId,claim.trackId);
assert.equal(state.rows[0].at,claim.stateUpdatedAt);
const duplicate=await publish(fakeDb,raw,sig,secret,now+10);
assert.equal(duplicate.status,'DUPLICATE');
assert.equal(duplicate.signalChanged,false);
await assert.rejects(()=>publish(fakeDb,raw,'0'.repeat(64),secret,now),/BAD_SIGNATURE/);
const badClaim={...claim,trackId:'music_note_somebodyElse_source1'};
const badRaw=JSON.stringify(badClaim);
const badSig=createHmac('sha256',secret).update(badRaw,'utf8').digest('hex');
await assert.rejects(()=>publish(fakeDb,badRaw,badSig,secret,now),/BAD_CLAIM/);

// Materialize patch100 + patch101 against the canonical Worker fixture.
const temp=mkdtempSync(join(tmpdir(),'soridraw-app431-'));
try{
  copyFileSync('cloudflare/explore-worker/canonical/preview-worker.js',join(temp,'worker.js'));
  for(const name of ['100-music-note-next-song-legacy-parity.mjs','101-publication-live-convergence.mjs']){
    const result=spawnSync(process.execPath,[resolve('cloudflare/explore-worker/patches',name)],{
      encoding:'utf8',env:{...process.env,SORIDRAW_REMOTE_WORKER_DIR:temp},
    });
    assert.equal(result.status,0,result.stderr||result.stdout);
  }
  const worker=readFileSync(join(temp,'worker.js'),'utf8');
  assert.match(worker,/SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_431_20261019/);
  assert.match(worker,/writeAndPublishPublicationState431/);
  assert.match(worker,/X-Soridraw-431-Publication-Signature/);
  assert.doesNotMatch(worker,/publicationStateUpdatedAt429/);
}finally{rmSync(temp,{recursive:true,force:true});}

console.log('APP431_BROWSER_PUBLICATION_SIGNAL_WRITE_FALSE=PASS');
console.log('APP431_HMAC_SERVER_ISSUER_AND_OWNER_BINDING=PASS');
console.log('APP431_DUPLICATE_IDEMPOTENCY=PASS');
console.log('APP431_UNRELATED_VIEWER_IMMEDIATE_R2_ZERO=PASS');
console.log('APP431_ENVIRONMENT_ENDPOINT_SEPARATION=PASS');
console.log('APP431_EXACT_ONE_FUNCTION_RELEASE_GUARD=PASS');
