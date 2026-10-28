import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const worker = fs.readFileSync('cloudflare/media-worker/src/index.js', 'utf8');
const engine = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const ui = fs.readFileSync('src/components/StudioHeartSingleDocDiagnostic.tsx', 'utf8');
const workerStart = "    if (request.method === 'GET' && route.action === 'inspect-exact') {";
const workerEnd = "    if (request.method === 'GET' && route.action === 'base') {";
const a = worker.indexOf(workerStart), b = worker.indexOf(workerEnd, a);
assert.ok(a >= 0 && b > a, 'isolated manual route must exist before ordinary Catalog GET');
const route = worker.slice(a, b);
assert.match(worker, /delta\|bootstrap\|inspect-exact/);
assert.match(worker.slice(worker.indexOf('const handleCatalog ='),a), /requireClientIdentity\(request, env\)/);
assert.doesNotMatch(route, /getCatalogState\(|seedSharedCatalog|bootstrapSharedCatalog|putCatalog|buildCanonicalCatalog|fetch\(|\.put\(|\.delete\(/);
assert.match(worker, /route\.action === 'inspect-exact'\) \{[\s\S]*?CATALOG_INSPECT_UNDETERMINED/);
assert.match(route, /readStrictCatalogStateForInspection\(env\.CATALOG, identity\.uid, 'musicNote'\)/);
assert.match(route, /text\(item\?\.id\) === exactId/);

let reads = 0, writes = 0, legacyReads = 0;
const mock = {
  env: { SORIDRAW_SHARED_CATALOG_V1: '1', CATALOG: { get: () => {}, put: () => { writes++; } },
    MEDIA: { get: () => { legacyReads++; }, put: () => { writes++; } } },
  readStrictCatalogStateForInspection: async (_bucket, uid, kind) => {
    assert.equal(uid, 'owner'); assert.equal(kind, 'musicNote'); reads++;
    return { head: { headRevision: 90 } };
  },
  materializeCatalogState: () => ({
    items: [{ id: 'right-doc', firestoreId: 'wrong-alias' }, { id: 'another', firestoreId: 'right-doc' }],
    revision: 90, itemCount: 2,
  }),
};
const scope = { URL, text: value => typeof value === 'string' ? value.trim() : '',
  isSharedCatalogEnabled: env => env.SORIDRAW_SHARED_CATALOG_V1 === '1',
  readStrictCatalogStateForInspection: (...args) => mock.readStrictCatalogStateForInspection(...args),
  materializeCatalogState: (...args) => mock.materializeCatalogState(...args),
  jsonResponse: (body, status) => ({ status, body }),
};
const code = `async function inspect(request, env, url, identity) {
  const route = {kind:'musicNote',action:'inspect-exact'};
  const origin = '';
  ${route}
  return {status:500,body:{ok:false}};
}
inspect;`;
const inspect = runInNewContext(code, scope);
const request = { method: 'GET' };
const url = id => new URL('https://localhost/v1/catalog/musicNote/inspect-exact?documentId='+encodeURIComponent(id));
{
  const result = await inspect(request, mock.env, url('right-doc'), {uid:'owner'});
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(result.body)), {
    ok:true, materialized:true, membership:true,revision:90,itemCount:2,
  });
  assert.equal(reads, 1);
  assert.equal(writes, 0); assert.equal(legacyReads, 0);
  assert.equal(JSON.stringify(result.body).includes('wrong-alias'), false);
  console.log('APP517_R2_EXACT_CANONICAL_ID_READ_ONLY=PASS');
}
{
  const result = await inspect(request, mock.env, url('missing-doc'), {uid:'owner'});
  assert.equal(result.body.membership, false);
  assert.equal(result.body.itemCount, 2);
  console.log('APP517_R2_MISSING_ID_NOT_AUTO_REPAIRED=PASS');
}
{
  mock.readStrictCatalogStateForInspection = async () => { reads++; return null; };
  const result = await inspect(request, mock.env, url('right-doc'), {uid:'owner'});
  assert.equal(result.status, 200);
  assert.equal(result.body.membership, null);
  assert.equal(result.body.materialized, false);
  assert.equal(writes, 0); assert.equal(legacyReads, 0);
  console.log('APP517_MISSING_SHARED_R2_NO_LEGACY_SEED_OR_WRITE=PASS');
}
{
  const before = reads;
  const result = await inspect(request, mock.env, url('bad/id'), {uid:'owner'});
  assert.equal(result.status, 400);
  assert.equal(reads,before);
  const other = await inspect(request, {...mock.env, SORIDRAW_SHARED_CATALOG_V1:'0'}, url('right-doc'), {uid:'owner'});
  assert.equal(other.status,503);
  assert.equal(reads,before);
  console.log('APP517_INVALID_ID_AND_UNSHARED_MODE_FAIL_CLOSED=PASS');
}
const start = engine.indexOf('export type ExactSharedCatalogMembership517');
const end = engine.indexOf('export const readCatalogSnapshotCacheFirst',start);
assert.ok(start>=0&&end>start);
const source = ts.transpileModule(engine.slice(start,end),{
  fileName:'userDataEngine.app517.ts',compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  },
}).outputText;
let clientFetches=0, localWrites=0;
const auth={currentUser:{uid:'owner'}};
let serverResponse={ok:true,materialized:true,membership:true,revision:90,itemCount:2};
const exports={};
runInNewContext(source,{exports,auth,authenticatedHeaders:async()=>({'Authorization':'Bearer fake','X-Firebase-AppCheck':'mock'}),
  isPreviewCatalogEnabled:()=>true,resolveCatalogEndpoint:()=> 'https://mock.example',
  fetch:async (uri,options)=>{clientFetches++;
    assert.match(uri,/\/v1\/catalog\/musicNote\/inspect-exact\?documentId=/);
    assert.equal(options.method,'GET');
    return {ok:true,json:async()=>serverResponse};},
  writeCatalogSnapshotToLocalCache:()=>{localWrites++},
});
assert.equal(clientFetches,0,'must never read on module import');
assert.equal((await exports.inspectExactSharedMusicNoteCatalog517('owner','right-doc')).membership,true);
assert.equal(clientFetches,1);assert.equal(localWrites,0);
serverResponse={ok:true,materialized:false,membership:null,revision:0,itemCount:null};
assert.equal((await exports.inspectExactSharedMusicNoteCatalog517('owner','right-doc')).membership,null);
auth.currentUser={uid:'different'};
await assert.rejects(()=>exports.inspectExactSharedMusicNoteCatalog517('owner','right-doc'));
assert.equal(clientFetches,2);assert.equal(localWrites,0);
assert.match(ui,/onClick=\{\(\) => void inspectShared\(\)\}/);
assert.match(ui,/report\.ownerMatchesSignedInUser !== true/);
assert.doesNotMatch(ui,/publishRemoteCatalogDelta|reconcileExactMusicNoteCatalog|repairSingleExactMusicNoteCatalog/);
console.log('APP517_MANUAL_ONLY_NO_CLIENT_CACHE_OR_R2_WRITES=PASS');

{
  // Audit P2: execute the REAL strict R2 reader and route together. The old
  // reader swallowed corrupted JSON into null and reported HTTP 200/missing.
  const start = worker.indexOf('const readStrictCatalogObjectForInspection =');
  const end = worker.indexOf('const readCatalogStateFromBucket =', start);
  assert.ok(start > 0 && end > start, 'strict reader extracted from Worker');
  const strictReader = worker.slice(start, end);
  const valid = value => Boolean(value && value.kind === 'musicNote'
    && Number.isInteger(value.revision) && value.revision > 0
    && Array.isArray(value.items) && value.itemCount === value.items.length);
  const journalValid = value => Boolean(value && value.kind === 'musicNote'
    && Number.isInteger(value.baseRevision) && value.baseRevision > 0
    && Number.isInteger(value.baseItemCount) && value.baseItemCount >= 0
    && typeof value.baseKey === 'string' && value.baseKey.length > 0);
  let getCount = 0, putCount = 0, mediaGetCount = 0;
  let objects = new Map();
  const bucket = {
    get: async key => {
      getCount++;
      const data = objects.get(key);
      if (data instanceof Error) throw data;
      if (data === undefined) return null;
      return { text: async () => {
        if (data === 'THROW_BODY_READ') throw new Error('R2_BODY_READ_FAILED');
        return String(data);
      }};
    },
    put: async () => { putCount++; throw new Error('WRITES_FORBIDDEN'); },
  };
  const strictContext = {
    URL,
    text: value => typeof value === 'string' ? value.trim() : '',
    catalogJournalKey: () => 'journal',
    catalogObjectKey: () => 'base',
    isValidCatalogJournal: journalValid,
    validateCatalogPayload: valid,
    createEmptyCatalogJournal: ({kind,baseKey,baseRevision,itemCount}) => ({
      kind, baseKey, baseRevision, baseItemCount: itemCount, headRevision:baseRevision,
    }),
    readStrictCatalogStateForInspection: undefined,
    materializeCatalogState: state => ({
      items: state.base.items, revision: state.head.headRevision,
      itemCount: state.base.itemCount,
    }),
    isSharedCatalogEnabled: env => env.SORIDRAW_SHARED_CATALOG_V1 === '1',
    jsonResponse: (body, status) => ({status,body}),
  };
  const strictModule = runInNewContext(
    `(() => {${strictReader}
    const actualRoute = async (request, env, url, identity) => {
      const route = { kind:'musicNote', action:'inspect-exact' };
      const origin = '';
      try {
        ${route}
      } catch (e) {
        return { status:503, body:{ok:false,code:'CATALOG_INSPECT_UNDETERMINED'} };
      }
    };
    return actualRoute;
    })()`,
    strictContext,
  );
  const diag = () => strictModule(
    {method:'GET'}, {SORIDRAW_SHARED_CATALOG_V1:'1', CATALOG:bucket,
      MEDIA:{get: async()=>{mediaGetCount++;throw Error('LEGACY_READ_FORBIDDEN');}}},
    new URL('https://local/v1/catalog/musicNote/inspect-exact?documentId=right-doc'),
    {uid:'owner'}
  );
  const base = JSON.stringify({
    kind:'musicNote',revision:90,itemCount:2,items:[
      {id:'right-doc',firestoreId:'wrong-alias'},{id:'second',firestoreId:'right-doc'},
    ],
  });
  objects.set('base',base);
  let result = await diag();
  assert.equal(result.status,200);assert.equal(result.body.membership,true);
  assert.equal(getCount,2);assert.equal(putCount,0);assert.equal(mediaGetCount,0);
  objects.clear();
  result = await diag();
  assert.equal(result.status,200);assert.equal(result.body.materialized,false);
  assert.equal(result.body.membership,null);
  for (const failure of [
    'THROW_BODY_READ', '{not-json', JSON.stringify({kind:'musicNote',revision:90,
      itemCount:99,items:[]}), new Error('R2_GET_FAILED'),
  ]) {
    objects.clear();objects.set('base',failure);
    result = await diag();
    assert.equal(result.status,503,'R2 malformed/unreadable base cannot report absence');
    assert.equal(result.body.code,'CATALOG_INSPECT_UNDETERMINED');
    assert.equal(putCount,0);assert.equal(mediaGetCount,0);
  }
  for (const failure of [
    'THROW_BODY_READ','{not-json',JSON.stringify({kind:'musicNote',baseKey:''}),
    new Error('R2_JOURNAL_GET_FAILED'),
  ]) {
    objects.clear();objects.set('journal',failure);
    result = await diag();
    assert.equal(result.status,503,'R2 invalid/unreadable journal cannot fall back');
    assert.equal(putCount,0);
  }
  objects.clear();
  objects.set('journal',JSON.stringify({
    kind:'musicNote',baseKey:'compacted',baseRevision:90,baseItemCount:2,
  }));
  result = await diag();
  assert.equal(result.status,503,'valid journal with absent base is not absence');
  objects.set('compacted',base);
  result = await diag();
  assert.equal(result.status,200);assert.equal(result.body.membership,true);
  objects.set('compacted','THROW_BODY_READ');
  result = await diag();
  assert.equal(result.status,503,'referenced base read failure not absence');
  assert.equal(putCount,0);assert.equal(mediaGetCount,0);
  console.log('APP517_AUDIT_P2_REAL_READER_BODY_JSON_VALIDATION_AND_JOURNAL_FAIL_CLOSED=PASS');
}
{
  const workflow=fs.readFileSync('.github/workflows/cloudflare-media-r2-preview-deploy.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/^  push:/m);
  assert.match(workflow,/ref: \$\{\{ inputs\.commit_sha \}\}/);
  assert.match(workflow,/APPROVED_SHA/);
  assert.match(workflow,/git merge-base --is-ancestor/);
  assert.match(workflow,/DEPLOY_PREVIEW_MEDIA/);
  assert.doesNotMatch(workflow,/r2 bucket create|r2 object put|wrangler secret put/);
  const checked = 'node scripts/verify-356-shared-private-catalog-authority.mjs';
  const preflight = workflow.indexOf('Preflight shared Catalog authority compatibility (no deployment)');
  const deploy = workflow.indexOf('Deploy preview media Worker with R2 binding');
  assert.ok(preflight >= 0 && deploy > preflight, 'Catalog check must run BEFORE deployment');
  assert.ok(workflow.indexOf(checked, preflight) > preflight
    && workflow.indexOf(checked, preflight) < deploy,
    'legacy Catalog static guard must be a pre-deploy release gate');
  assert.ok(workflow.indexOf(checked, deploy) > deploy,
    'retain post-deploy Catalog guard too');
  const legacyGuard = fs.readFileSync('scripts/verify-356-shared-private-catalog-authority.mjs','utf8');
  assert.ok(legacyGuard.includes('delta|bootstrap|inspect-exact'), 'known exact new route must remain whitelisted');
  assert.match(legacyGuard, /catalog bootstrap route missing/);
  console.log('APP517_LEGACY_CATALOG_PREDEPLOY_AND_POSTDEPLOY_GATES=PASS');
  console.log('APP517_NO_AUTODEPLOY_EXACT_SHA_MANUAL_NO_R2_SMOKE_WRITES=PASS');
}
