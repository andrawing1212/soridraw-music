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
let writerResult421 = { object: { etag: 'rev0' }, payload: { data: { items: [] } }, memberIds: [] };
let writerDetail421 = { ok: false, clone: () => ({ json: async () => ({}) }) };
let writerPutCount421 = 0;
const writer421 = vm.runInNewContext(
  workerSource.slice(writerStart421, writerEnd421) + '\nwriteCuratedSnapshot307;',
  {
    curatedBucket307: (env) => env?.bucket || null,
    curatedObjectKey307: (env) => env?.CURATED_SHARED_V421 === '1'
      ? 'internal/explore/shared-curated-v421/soridraw-40.json'
      : 'internal/explore/curated-v307/soridraw-40.json',
    readCuratedObject307: async (_req, env) => env?.readSnapshot ? env.readSnapshot() : writerResult421,
    baseWorker: { fetch: async (req) => typeof writerDetail421 === 'function' ? writerDetail421(req) : writerDetail421 },
    clearCuratedEdge307: async () => {},
    SORIDRAW_CURATED_COLLECTION_307: 'soridraw',
    SORIDRAW_CURATED_R2_KEY_307: 'internal/explore/curated-v307/soridraw-40.json',
    URL, Request,
  },
);
const bucket421 = { put: async () => { writerPutCount421++; return { etag: 'rev1' }; } };
// Targeted shared D1 membership source (only real curator actions query it).
const canonicalMembers421 = new Set(['test-song', 'new-a', 'new-b']);
const canonicalDB421 = {
  prepare: (sql) => {
    assert.match(sql, /FROM curated_picks/);
    assert.match(sql, /track_id=\?/);
    return { bind: (_collection, id) => ({
      first: async () => canonicalMembers421.has(id) ? { track_id: id } : null,
    }) };
  },
};
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
  writer421(request421, { bucket: bucket421, DB: canonicalDB421 }, {}, 'test-song', true, 'master'),
  /CURATED_R2_SNAPSHOT_UNAVAILABLE_421/,
);
writerResult421 = { object: { etag: 'rev0' }, payload: { data: { items: [] } }, memberIds: [] };
await assert.rejects(
  writer421(request421, { bucket: bucket421, DB: canonicalDB421 }, {}, 'test-song', true, 'master'),
  /CURATED_TRACK_DETAIL_UNAVAILABLE_421/,
);
assert.equal(writerPutCount421, 0, 'unresolvable track must not publish a phantom R2 snapshot');
writerDetail421 = {
  ok: true,
  clone: () => ({ json: async () => ({ data: { track: { id: 'test-song', title: 'Selected' } } }) }),
};
await writer421(request421, { bucket: bucket421, DB: canonicalDB421 }, {}, 'test-song', true, 'master');
assert.equal(writerPutCount421, 1, 'valid targeted recommendation must update one R2 object');
console.log('APP421_CURATED_FALSE_SUCCESS_R2_FAILURE_BLOCKED=PASS');


// Actual extracted R2 writer, two concurrent curator requests, forced to read
// the same old snapshot before either conditional put resolves.
const deferred421 = () => {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
};
const initial421 = {
  schemaVersion: 1, memberIds: ['first'], payload: {
    ok: true, data: { items: [{ track: { id: 'first' }, curation: {} }] },
  },
};
const fakeR2State421 = { etag: 'e0', stored: initial421, reads: 0, writes: 0, conflicts: 0, totalPut: 0 };
const bothAtPut421 = deferred421();
const concurrentBucket421 = {
  async get() {
    const etag = fakeR2State421.etag;
    const json = JSON.stringify(fakeR2State421.stored);
    fakeR2State421.reads++;
    return { etag, text: async () => json };
  },
  async put(_key, body, opts) {
    const thisPut = ++fakeR2State421.totalPut;
    if (thisPut === 1) await bothAtPut421.promise;
    if (thisPut === 2) bothAtPut421.resolve();
    assert.ok(opts?.onlyIf?.etagMatches, 'R2 update must be conditional on the read ETag');
    if (opts.onlyIf.etagMatches !== fakeR2State421.etag) {
      fakeR2State421.conflicts++;
      return null;
    }
    fakeR2State421.stored = JSON.parse(body);
    fakeR2State421.etag = 'e' + (++fakeR2State421.writes);
    return { etag: fakeR2State421.etag };
  },
};
writerDetail421 = (req) => {
  const id = decodeURIComponent(new URL(req.url).pathname.split('/').pop());
  return { ok: true, clone: () => ({ json: async () => ({ data: { track: { id } } }) }) };
};
const concurrentEnv421 = {
  bucket: concurrentBucket421,
  DB: canonicalDB421,
  readSnapshot: async () => {
    const object = await concurrentBucket421.get();
    const data = JSON.parse(await object.text());
    return { object, payload: data.payload, memberIds: data.memberIds };
  },
};
await Promise.all([
  writer421(request421, concurrentEnv421, {}, 'new-a', true, 'master'),
  writer421(request421, concurrentEnv421, {}, 'new-b', true, 'master'),
]);
assert.deepEqual(
  fakeR2State421.stored.memberIds.slice().sort(),
  ['first', 'new-a', 'new-b'],
  'simultaneous promotions must preserve both canonical memberships',
);
assert.equal(fakeR2State421.conflicts, 1, 'one conflicting old revision must be rejected');
assert.equal(fakeR2State421.writes, 2, 'each accepted promotion updates exactly one R2 snapshot');
console.log('APP421_CURATED_SIMULTANEOUS_PROMOTIONS_CAS=PASS');


// app421: the older bounded cold bootstrap was an unconditional PUT. An
// arriving curator may create a newer public recommendation before the
// bootstrap finishes its 40-member DB materialization. The cold request
// MUST return that newer R2 object, rather than writing stale membership.
const coldAt421 = workerSource.indexOf('async function materializeCuratedR2FromBase307(');
const coldEnd421 = workerSource.indexOf('async function readCuratedObject307(', coldAt421);
assert.ok(coldAt421 > 0 && coldEnd421 > coldAt421);
const concurrentWinner421 = {
  schemaVersion: 1,
  memberIds: ['promoted-later', 'first'],
  payload: { ok: true, data: { collection: 'soridraw', items: [
    { track: { id: 'promoted-later' } }, { track: { id: 'first' } },
  ] } },
};
let coldPut421 = 0;
const coldBucket421 = {
  async put(_key, _body, options) {
    coldPut421++;
    const header = options?.onlyIf?.get('If-None-Match');
    assert.equal(header, '*', 'cold bootstrap must use If-None-Match * to prevent overwrite');
    // A separate authenticated curation operation won before the cold write.
    return null;
  },
  async get() {
    return {
      etag: 'winner-etag',
      text: async () => JSON.stringify(concurrentWinner421),
    };
  },
};
const coldDB421 = {
  prepare(sql) {
    assert.match(sql, /FROM curated_picks/, 'cold boot can query only curated membership');
    assert.match(sql, /LIMIT 40/, 'cold boot membership must be bounded');
    return {
      bind: () => ({
        all: async () => ({ results: [{
          track_id: 'first',
          curator_uid: 'owner',
          curator_role: 'master',
          sort_order: 0,
          starts_at: null,
          ends_at: null,
        }] }),
      }),
    };
  },
};
const cold421 = vm.runInNewContext(
  workerSource.slice(coldAt421, coldEnd421) + '\nmaterializeCuratedR2FromBase307;',
  {
    curatedBucket307: (env) => env?.bucket || null,
    curatedObjectKey307: (env) => env?.CURATED_SHARED_V421 === '1'
      ? 'internal/explore/shared-curated-v421/soridraw-40.json'
      : 'internal/explore/curated-v307/soridraw-40.json',
    baseWorker: { fetch: async () => ({
      ok: true,
      headers: { get: () => '0' },
      clone: () => ({ json: async () => ({ data: { track: { id: 'first' } } }) }),
    }) },
    clearCuratedEdge307: async () => { throw new Error('losing bootstrap must not clear winner cache'); },
    SORIDRAW_CURATED_COLLECTION_307: 'soridraw',
    SORIDRAW_CURATED_R2_KEY_307: 'internal/explore/curated-v307/soridraw-40.json',
    Date, URL, Request, Headers, console,
  },
);
const coldResult421 = await cold421(request421, { bucket: coldBucket421, DB: coldDB421 }, {});
assert.equal(coldPut421, 1);
assert.deepEqual(Array.from(coldResult421.memberIds), ['promoted-later', 'first']);
assert.deepEqual(Array.from(coldResult421.payload.data.items, (x) => x.track.id), ['promoted-later', 'first']);
assert.equal(coldResult421.source, 'R2-CURATED-CONCURRENT-COLD-421');
console.log('APP421_CURATED_COLD_BOOTSTRAP_CAS=PASS');


// Same-track opposite action interleaving: canonical D1 accepted a REMOVE
// after another curator had requested PROMOTE. A delayed promote writer
// must reconcile canonical D1 and may not re-add the removed song to R2.
const oppositeR2421 = {
  etag: 'same0', memberIds: ['test-song'],
  payload: { ok: true, data: { items: [{ track: { id: 'test-song' } }] } },
  gets: 0, writes: 0,
};
const oppositeBucket421 = {
  async get() {
    oppositeR2421.gets++;
    return {
      etag: oppositeR2421.etag,
      text: async () => JSON.stringify({
        schemaVersion: 1,
        memberIds: oppositeR2421.memberIds,
        payload: oppositeR2421.payload,
      }),
    };
  },
  async put(_key, body, options) {
    assert.equal(options.onlyIf.etagMatches, oppositeR2421.etag);
    const next = JSON.parse(body);
    oppositeR2421.memberIds = next.memberIds;
    oppositeR2421.payload = next.payload;
    oppositeR2421.etag = 'same' + (++oppositeR2421.writes);
    return { etag: oppositeR2421.etag };
  },
};
const oppositeEnv421 = {
  bucket: oppositeBucket421,
  DB: canonicalDB421,
  readSnapshot: async () => {
    const object = await oppositeBucket421.get();
    const row = JSON.parse(await object.text());
    return { object, payload: row.payload, memberIds: row.memberIds };
  },
};
canonicalMembers421.delete('test-song'); // B's canonical D1 DELETE wins
const delayedPromote421 = await writer421(
  request421, oppositeEnv421, {}, 'test-song', true, 'master',
);
assert.equal(delayedPromote421.recommended, false, 'stale A promote must report canonical B remove');
assert.deepEqual(Array.from(oppositeR2421.memberIds), [],
  'later canonical remove wins even if older promote R2 writer executes last');
assert.equal(oppositeR2421.writes, 1);
canonicalMembers421.add('test-song'); // A's canonical D1 PROMOTE now wins
const delayedRemove421 = await writer421(
  request421, oppositeEnv421, {}, 'test-song', false, 'master',
);
assert.equal(delayedRemove421.recommended, true, 'stale B remove must report newer canonical A promote');
assert.deepEqual(Array.from(oppositeR2421.memberIds), ['test-song']);
assert.equal(oppositeR2421.writes, 2);
console.log('APP421_CURATED_SAME_TRACK_OPPOSITE_CANONICAL_AUTHORITY=PASS');


// app421: PREVIEW, TEST, PRODUCTION all have a shared PROFILE_MEDIA binding
// but their EXPLORE_CACHE is intentionally environment-local. The flag is
// *disabled by default*; an explicit all-stage change selects one new R2 key
// which cannot overlap the existing PRODUCTION v307 derived object.
const sharedHelpersAt421 = workerSource.indexOf('// app421: opt-in versioned shared curation snapshot');
const sharedHelpersEnd421 = workerSource.indexOf('const curatedRevision307', sharedHelpersAt421);
assert.ok(sharedHelpersAt421 > 0 && sharedHelpersEnd421 > sharedHelpersAt421);
const sharedHelpers421 = vm.runInNewContext(
  "const SORIDRAW_CURATED_R2_KEY_307 = 'internal/explore/curated-v307/soridraw-40.json';\n" +
  workerSource.slice(sharedHelpersAt421, sharedHelpersEnd421) +
  '\n({ curatedBucket307, curatedObjectKey307, curatedSharedEnabled421 });',
);
const commonR2421 = { name: 'SHARED_PROFILE_MEDIA' };
const envs421 = ['PREVIEW', 'TEST', 'PRODUCTION'].map((name) => ({
  name, EXPLORE_CACHE: { name: name + '_DERIVED' }, PROFILE_MEDIA: commonR2421,
}));
assert.equal(sharedHelpers421.curatedSharedEnabled421(envs421[0]), false);
for (const env of envs421) {
  assert.equal(sharedHelpers421.curatedBucket307(env), env.EXPLORE_CACHE,
    'default release must preserve all legacy environment cache bindings');
  assert.equal(sharedHelpers421.curatedObjectKey307(env),
    'internal/explore/curated-v307/soridraw-40.json',
    'old active PRODUCTION key must remain unchanged');
}
const oldObject421 = { value: 'current production release untouched' };
const storage421 = new Map([['internal/explore/curated-v307/soridraw-40.json', oldObject421]]);
for (const env of envs421) {
  env.CURATED_SHARED_V421 = '1';
  assert.equal(sharedHelpers421.curatedBucket307(env), commonR2421,
    'explicitly enabled releases must read identical shared PROFILE_MEDIA');
  const key = sharedHelpers421.curatedObjectKey307(env);
  assert.equal(key, 'internal/explore/shared-curated-v421/soridraw-40.json');
  storage421.set(key, { revision: 421, members: ['example-song'] });
}
assert.equal(storage421.get('internal/explore/curated-v307/soridraw-40.json'), oldObject421,
  'staged opt-in must not overwrite legacy production R2');
assert.deepEqual(storage421.get(sharedHelpers421.curatedObjectKey307(envs421[2])),
  { revision: 421, members: ['example-song'] });
assert.equal(sharedHelpers421.curatedBucket307({ CURATED_SHARED_V421: '1' }), null,
  'shared flag must fail closed if canonical PROFILE_MEDIA binding missing');
console.log('APP421_SHARED_CURATED_STAGED_BINDING_PARITY=PASS');
console.log('APP421_LEGACY_PRODUCTION_R2_UNTOUCHED=PASS');


// app421: fail closed when a shared R2 projection is damaged. A read-side
// repair may NOT unconditionally delete a key another stage is writing.
const readAt421 = workerSource.indexOf('async function readCuratedObject307(');
const readEnd421 = workerSource.indexOf('async function handleCuratedRevision307(', readAt421);
assert.ok(readAt421 > 0 && readEnd421 > readAt421);
let sharedDeletes421 = 0;
let sharedColdBuilds421 = 0;
const damagedSharedBucket421 = {
  get: async () => ({ etag: 'damaged', text: async () => '{invalid json' }),
  delete: async () => { sharedDeletes421++; },
};
const reader421 = vm.runInNewContext(
  workerSource.slice(readAt421, readEnd421) + '\nreadCuratedObject307;',
  {
    curatedBucket307: (env) => env.bucket,
    curatedObjectKey307: (env) => env.CURATED_SHARED_V421 === '1'
      ? 'internal/explore/shared-curated-v421/soridraw-40.json'
      : 'internal/explore/curated-v307/soridraw-40.json',
    curatedSharedEnabled421: (env) => env.CURATED_SHARED_V421 === '1',
    materializeCuratedR2FromBase307: async () => {
      sharedColdBuilds421++;
      return { object: null, payload: null, memberIds: [], d1Read: 0, source: 'unexpected' };
    },
    SORIDRAW_CURATED_R2_KEY_307: 'internal/explore/curated-v307/soridraw-40.json',
  },
);
const damagedResult421 = await reader421(request421, {
  CURATED_SHARED_V421: '1', bucket: damagedSharedBucket421,
}, {});
assert.equal(damagedResult421.source, 'SHARED-CURATED-CORRUPT-FAIL-CLOSED-421');
assert.equal(damagedResult421.payload, null);
assert.equal(damagedResult421.d1Read, 0);
assert.equal(sharedDeletes421, 0, 'damaged shared reader cannot delete a concurrent writer');
assert.equal(sharedColdBuilds421, 0, 'damaged shared reader cannot rebuild the full list');
console.log('APP421_SHARED_CURATED_CORRUPT_NO_DELETE=PASS');


// app421 late public/private publication signal must NOT overwrite newer D1
// canonical visibility for a promoted member. Exercise real extracted Worker
// sync, not only text regexes or a curated response mock.
const pubStart421 = workerSource.indexOf('async function syncCuratedPublicationResults307(');
const pubEnd421 = workerSource.indexOf('async function handleCurationMutation307(', pubStart421);
assert.ok(pubStart421 > 0 && pubEnd421 > pubStart421);
let canonicalVisibility421 = false;
let pubD1Reads421 = 0;
let pubDetailReads421 = 0;
const pubStore421 = {
  etag: 'visibility0',
  stored: {
    schemaVersion: 1, collection: 'soridraw', memberIds: ['test-song'],
    payload: { ok: true, data: { collection: 'soridraw', items: [
      { track: { id: 'test-song', updatedAt: 100 }, curation: {} },
    ] } },
  },
  writes: 0,
};
const pubBucket421 = {
  async get() {
    const etag = pubStore421.etag;
    const body = JSON.stringify(pubStore421.stored);
    return { etag, text: async () => body };
  },
  async put(_key, body, opts) {
    assert.equal(opts.onlyIf.etagMatches, pubStore421.etag,
      'publication snapshot must retain conditional version check');
    pubStore421.stored = JSON.parse(body);
    pubStore421.etag = 'visibility' + (++pubStore421.writes);
    return { etag: pubStore421.etag };
  },
};
const syncPublication421 = vm.runInNewContext(
  workerSource.slice(pubStart421, pubEnd421) + '\nsyncCuratedPublicationResults307;',
  {
    curatedBucket307: (env) => env.bucket,
    curatedObjectKey307: () => 'internal/explore/shared-curated-v421/soridraw-40.json',
    SORIDRAW_CURATED_COLLECTION_307: 'soridraw',
    SORIDRAW_CURATED_R2_KEY_307: 'internal/explore/curated-v307/soridraw-40.json',
    baseWorker: {
      fetch: async () => {
        pubDetailReads421++;
        return { ok: true, clone: () => ({
          json: async () => ({ data: { track: { id: 'test-song', updatedAt: 56789 } } }),
        }) };
      },
    },
    clearCuratedEdge307: async () => {},
    URL, Request, Date, console,
  },
);
const pubEnv421 = {
  bucket: pubBucket421,
  DB: { prepare(sql) {
    assert.match(sql, /FROM tracks WHERE id=\? LIMIT 1/);
    return { bind: (id) => ({
      first: async () => {
        assert.equal(id, 'test-song');
        pubD1Reads421++;
        return { is_public: canonicalVisibility421 ? 1 : 0,
          status: 'published', updated_at: 56789 };
      },
    }) };
  } },
};
const snapshotIds421 = () => pubStore421.stored.payload.data.items.map((x) => x.track.id);
const pubRequest421 = {
  url: 'https://mock.test/v1/me/music-note-publications/batch',
  headers: new Headers({ Origin: 'https://preview.soridraw.com' }),
};
await syncPublication421(pubRequest421, pubEnv421, {}, [
  { ok: true, trackId: 'test-song', status: 'public',
    snapshotItem: { id: 'test-song', updatedAt: 100 } },
]);
assert.deepEqual(snapshotIds421(), [],
  'late PUBLIC result must not resurrect a canonically private curated song');
assert.equal(pubD1Reads421, 1, 'only exact curated ID is checked on real mutation');
assert.equal(pubDetailReads421, 0, 'canonical private state needs no detail reread');
canonicalVisibility421 = true;
await syncPublication421(pubRequest421, pubEnv421, {}, [
  { ok: true, trackId: 'test-song', status: 'private', snapshotItem: null },
]);
assert.deepEqual(snapshotIds421(), ['test-song'],
  'late PRIVATE result must not hide a canonically republished song');
assert.equal(pubD1Reads421, 2);
assert.equal(pubDetailReads421, 1,
  'canonical public song resolves only its own current detail');
assert.equal(pubStore421.stored.payload.data.items[0].track.updatedAt, 56789);
console.log('APP421_PUBLICATION_LATE_SIGNAL_CANONICAL=PASS');
console.log('APP421_PUBLICATION_CANONICAL_READS_ONLY_ON_MUTATION=PASS');
