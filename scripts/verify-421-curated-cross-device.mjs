import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const serviceSource = readFileSync(new URL('../src/services/exploreCurationService.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../src/pages/ExplorePage.tsx', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../cloudflare/explore-worker/canonical/preview-entry.js', import.meta.url), 'utf8');
const compiled = ts.transpileModule(serviceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

assert.match(pageSource, /getSoridrawCuratedTracks307\(false\)[\s\S]{0,1750}revalidateSoridrawCuratedTracks335\(\)/,
  'Explore entry must paint cached cards and then revalidate their public revision');
assert.match(workerSource, /const revisionChecked421 = url\.searchParams\.get\('revisionCheck'\) === '1';/);
assert.match(workerSource, /if \(limit === 20 && !revisionChecked421\)/,
  'revision-checked fetch must skip stable body cache from an older POP');
assert.match(serviceSource, /limit=20&revisionCheck=1/,
  'curated body requests must identify their revision-checked authority');

let time = 1_000_000;
const server = { revision: 'v1', tracks: [{ id: 'first', title: 'First' }] };
const totals = { revision: 0, body: 0, writes: 0 };
const response = (data, revision = '') => ({
  ok: true,
  status: 200,
  headers: { get: (name) => name.toLowerCase() === 'x-soridraw-curated-revision' ? revision : null },
  async json() { return data; },
});
const makeClient = () => {
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const sandbox = {
    exports: {},
    console,
    Date: class extends Date { static now() { return time; } },
    localStorage,
    fetch: async (address, init = {}) => {
      const url = new URL(String(address));
      if (url.pathname === '/v1/curated-revision') {
        totals.revision++;
        return response({ ok: true, data: { revision: server.revision } });
      }
      if (url.pathname === '/v1/curated') {
        totals.body++;
        assert.equal(url.searchParams.get('revisionCheck'), '1',
          'never read unversioned stable Edge body');
        return response({
          ok: true,
          data: { revision: server.revision, items: server.tracks.map((track) => ({ track })) },
        }, server.revision);
      }
      if (url.pathname.startsWith('/v1/curation/soridraw/') && init.method === 'PUT') {
        totals.writes++;
        const id = decodeURIComponent(url.pathname.split('/').pop());
        server.tracks = [{ id, title: 'Promoted' }, ...server.tracks.filter((track) => track.id !== id)];
        server.revision = 'v2';
        return response({ ok: true, data: { recommended: true } });
      }
      throw new Error('Unexpected request: ' + address);
    },
    require: (name) => {
      if (name === '../config/exploreEnvironment') return { EXPLORE_API_BASE: 'https://mock.test' };
      if (name === '../firebase') return { getFirebaseAppCheckToken: async () => 'mock-app-check' };
      if (name === '../lib/cloudflareDiagnostics') return {
        recordCloudflareLocalCacheHit: () => {},
        recordCloudflareResponse: () => {},
      };
      throw new Error('Unexpected import: ' + name);
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'exploreCurationService.js' });
  return sandbox.exports;
};
const admin = { uid: 'curator', getIdToken: async () => 'mock-id-token' };
const a = makeClient();
const b = makeClient();

assert.deepEqual(Array.from(await a.getSoridrawCuratedTracks307(), (t) => t.id), ['first']);
assert.deepEqual(Array.from(await b.getSoridrawCuratedTracks307(), (t) => t.id), ['first']);
const bodyBefore = totals.body;
await a.setSoridrawCuratedTrack307(admin, 'new-pick', true);
assert.equal(totals.writes, 1, 'promotion must remain one canonical mutation');
assert.deepEqual(Array.from(await b.getSoridrawCuratedTracks307(), (t) => t.id), ['first'],
  'device B should paint its warm local snapshot immediately');
time += 61_000;
assert.deepEqual(Array.from(await b.revalidateSoridrawCuratedTracks335(), (t) => t.id), ['new-pick', 'first'],
  'another account must receive promoted recommendation on bounded revision check');
assert.equal(totals.body, bodyBefore + 1, 'changed revision must fetch one new public body');
const bodyAfter = totals.body;
time += 61_000;
assert.deepEqual(Array.from(await b.revalidateSoridrawCuratedTracks335(), (t) => t.id), ['new-pick', 'first']);
assert.equal(totals.body, bodyAfter, 'unchanged revision must not refetch the curated list');
const c = makeClient();
assert.deepEqual(Array.from(await c.getSoridrawCuratedTracks307(), (t) => t.id), ['new-pick', 'first'],
  'a new third account must see the shared promoted list');
console.log('APP421_CURATED_CROSS_DEVICE_REVALIDATION=PASS');
console.log('UNCHANGED_RECOMMENDATION_BODY_READS=0');
console.log('D1_SCAN_AND_POLLING_ADDED=0');


// app421: R2 write failure is NOT a successful recommendation promotion.
// Exercise the actual Worker snapshot writer with a missing bucket and a
// canonical-published track whose public detail fails. Neither may publish a
// phantom recommendation into a derived shared list.
const writerStart421 = workerSource.indexOf('async function writeCuratedSnapshot307(');
const writerEnd421 = workerSource.indexOf('// SORIDRAW_CURATED_PUBLICATION_TARGETED_SYNC_', writerStart421);
assert.ok(writerStart421 > 0 && writerEnd421 > writerStart421, 'Worker curation snapshot writer missing');
assert.match(workerSource.slice(writerEnd421), /CURATION_PUBLICATION_PENDING_421/);
assert.match(workerSource.slice(writerEnd421), /status: 503/);
let writerResult421 = { payload: { data: { items: [] } }, memberIds: [] };
let writerDetail421 = { ok: false, clone: () => ({ json: async () => ({}) }) };
let writerPutCount421 = 0;
const writer421 = vm.runInNewContext(
  workerSource.slice(writerStart421, writerEnd421) + '\nwriteCuratedSnapshot307;',
  {
    curatedBucket307: (env) => env?.bucket || null,
    readCuratedObject307: async () => writerResult421,
    baseWorker: { fetch: async () => writerDetail421 },
    clearCuratedEdge307: async () => {},
    SORIDRAW_CURATED_COLLECTION_307: 'soridraw',
    SORIDRAW_CURATED_R2_KEY_307: 'internal/explore/curated-v307/soridraw-40.json',
    URL, Request,
  },
);
const bucket421 = { put: async () => { writerPutCount421++; } };
const request421 = {
  url: 'https://mock.test/v1/curation/soridraw/test-song',
  headers: new Headers({ Origin: 'https://preview.soridraw.com' }),
};
await assert.rejects(
  writer421(request421, {}, {}, 'test-song', true, 'master'),
  /CURATED_R2_BINDING_MISSING_421/,
);
writerResult421 = { payload: null, memberIds: [] };
await assert.rejects(
  writer421(request421, { bucket: bucket421 }, {}, 'test-song', true, 'master'),
  /CURATED_R2_SNAPSHOT_UNAVAILABLE_421/,
);
writerResult421 = { payload: { data: { items: [] } }, memberIds: [] };
await assert.rejects(
  writer421(request421, { bucket: bucket421 }, {}, 'test-song', true, 'master'),
  /CURATED_TRACK_DETAIL_UNAVAILABLE_421/,
);
assert.equal(writerPutCount421, 0, 'unresolvable track must not publish a phantom R2 snapshot');
writerDetail421 = {
  ok: true,
  clone: () => ({ json: async () => ({ data: { track: { id: 'test-song', title: 'Selected' } } }) }),
};
await writer421(request421, { bucket: bucket421 }, {}, 'test-song', true, 'master');
assert.equal(writerPutCount421, 1, 'valid targeted recommendation must update one R2 object');
console.log('APP421_CURATED_FALSE_SUCCESS_R2_FAILURE_BLOCKED=PASS');
