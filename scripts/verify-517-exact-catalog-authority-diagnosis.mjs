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
assert.match(route, /readCatalogStateFromBucket\(env\.CATALOG, identity\.uid, 'musicNote'\)/);
assert.match(route, /text\(item\?\.id\) === exactId/);

let reads = 0, writes = 0, legacyReads = 0;
const mock = {
  env: { SORIDRAW_SHARED_CATALOG_V1: '1', CATALOG: { get: () => {}, put: () => { writes++; } },
    MEDIA: { get: () => { legacyReads++; }, put: () => { writes++; } } },
  readCatalogStateFromBucket: async (_bucket, uid, kind) => {
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
  readCatalogStateFromBucket: (...args) => mock.readCatalogStateFromBucket(...args),
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
  mock.readCatalogStateFromBucket = async () => { reads++; return null; };
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
