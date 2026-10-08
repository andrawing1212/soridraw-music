import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const source = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const ast = ts.createSourceFile('worker.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = [
  'readFollowCutoverControl348', 'readFollowCutoverState348', 'followIntentKey354', 'readFollowIntent354',
  'readFollowProfile354', 'saveFollowProfile354', 'registerFollowPending354',
  'repairFollowProfile354', 'completeFollowIntent354', 'orchestrateFollowOverlay354',
  'handleFollowOverlay354', 'readFollowStateSnapshot354', 'mutateFollowOverlayRelation350', 'readEffectiveFollowMembership348',
  'patchSharedProfileFollowDelta352', 'readExactEffectiveFollowCounts351',
  'handleFollow', 'handleFollowR2Core', 'handleFollowState',
  'invalidateFollowProfiles355', 'enforceFollowEdgeRateLimit355',
];
const functions = new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n => [n.name?.text, n.getText(ast)]));
const baseline = execFileSync('git',['show','9709c6f2ef06d40d6c780f07ec856c4a917449f6:cloudflare/explore-worker/canonical/preview-worker.js'],{ encoding: 'utf8',maxBuffer: 8*1024*1024 });
const baselineAst = ts.createSourceFile('baseline.js',baseline,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const allowed = new Set(['readFollowCutoverState348','handleFollowR2Core','handleFollow',
  'adjustExploreFollowCountersDelta','syncExploreFollowingR2AfterMutation',
  'mutateFollowOverlayRelation350','patchSharedProfileFollowDelta352','handleFollowState',
  // The independent audit explicitly requires these existing follow consumers.
  'patchPublicProfileBundle245','writeExploreSharedProfile060','handlePublicProfile',
  'readSharedProfileConnection348','handlePublicProfileFirstViewWithEdgeCache',
  'handleMyFollowingR2Bundle','handleFollowerSaveAccess','handleMySocialSnapshot042',
  'handleProfileConnections','handleMyFollowing',
  // App380: only these two like functions are intentionally changed by 098;
  // 388 --release + 392/393 independently prove their safety.
  'handleLikeBatch034','enforceExploreLikeBatchEdgeRateLimit054']);
const publication358Wrapped = new Map([
  ['handleFeedWithEdgeCache', 'handleFeedWithEdgeCacheCore358'],
  ['handleProfileTracks', 'handleProfileTracksCore358'],
  ['handleGenreTracks', 'handleGenreTracksCore358'],
]);
const normalizePublication361ForFollowAudit = (text, name) => {
  if (!['handleMusicNotePublicationSingleWrite016','handleMusicNotePublicationBatch048'].includes(name)) return text;
  assert.ok(source.includes('SORIDRAW_PUBLICATION_D1_READ_COMPACTION_361_20261005'),
    'app361 marker missing while follow audit normalizes publication');

  if (name === 'handleMusicNotePublicationSingleWrite016') {
    const start = text.indexOf('  let previous = null;\n  let publicationR2ProvedNew361 = false;');
    const end = text.indexOf('  const resolvedOptions = {', start);
    assert.ok(start >= 0 && end > start, 'app361 first-public read block missing');
    const normalized = text.slice(0, start)
      + '  const previous = await publicationReadState016(env, authContext.uid, source.id);\n'
      + text.slice(end);
    assert.ok(normalized.includes('const previous = await publicationReadState016(env, authContext.uid, source.id);'),
      'app361 first-public normalization failed');
    return normalized;
  }

  const gate361 = `          const inlineMediaFast361 = mutation.refreshSourceMedia && mutation.sourceMedia
            ? mutation.sourceMedia
            : null;
          if (mutation.refreshSourceContent || (mutation.refreshSourceMedia && !inlineMediaFast361)) {`;
  assert.equal(text.split(gate361).length - 1, 1, 'app361 inline-media gate missing');
  let normalized = text.replace(gate361,
    `          if (mutation.refreshSourceContent || mutation.refreshSourceMedia) {`);

  const media361 = `          if (inlineMediaFast361) {
            const mediaColumns = [
              ['cover_url', String(inlineMediaFast361.coverUrl || '')],
              ['duration_seconds', inlineMediaFast361.durationSeconds == null ? null : Number(inlineMediaFast361.durationSeconds)],
              ['suno_url_primary', String(inlineMediaFast361.sunoUrlPrimary || '')],
              ['suno_url_secondary', inlineMediaFast361.sunoUrlSecondary ? String(inlineMediaFast361.sunoUrlSecondary) : null],
            ];
            for (const [column, value] of mediaColumns) {
              sets.push(\`\${column}=?\`);
              values.push(value);
              guards.push(\`\${column} IS NOT ?\`);
              guardValues.push(value);
            }
          }
`;
  assert.equal(normalized.split(media361).length - 1, 1, 'app361 media UPDATE block missing');
  normalized = normalized.replace(media361, '');
  assert.equal(normalized.includes('inlineMediaFast361'), false, 'app361 batch normalization incomplete');
  return normalized;
};

const normalizePublication365ForFollowAudit = (text, name) => {
  if (name !== 'readCanonicalPublicationLike071') return text;
  assert.ok(source.includes('SORIDRAW_PUBLICATION_CANONICAL_LIKE_REQUEST_CACHE_365_20261006'),
    'app365 marker missing while follow audit normalizes publication canonical-like reader');
  for (const required of [
    'canonicalPublicationLikeRequestCache365.get(env)',
    'if (requestCache.has(id)) return requestCache.get(id)',
    'requestCache.set(id, pending)',
    'requestCache.delete(id)',
  ]) assert.ok(text.includes(required), 'app365 canonical-like cache invariant missing: ' + required);

  return `async function readCanonicalPublicationLike071(env, trackId) {
  const id = String(trackId || '').trim();
  if (!id || !env?.DB) throw new Error('[071] invalid canonical track');
  const row = await env.DB.prepare(
    "SELECT COALESCE(s.like_count,0) AS like_count FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=? AND t.is_public=1 AND t.status='published' LIMIT 1"
  ).bind(id).first();
  if (!row) throw new Error('[071] canonical public track unavailable');
  const count = Number(row.like_count);
  if (!Number.isFinite(count) || count < 0) throw new Error('[071] invalid canonical like count');
  return Math.floor(count);
}`;
};

for (const node of baselineAst.statements.filter(ts.isFunctionDeclaration)) {
  const wrappedCore = publication358Wrapped.get(node.name?.text || '');
  if (wrappedCore) {
    const coreText = functions.get(wrappedCore);
    assert.ok(coreText, 'app358 frozen core missing: ' + wrappedCore);
    const normalizedCore = coreText
      .replace(`function ${wrappedCore}(`, `function ${node.name?.text}(`)
      .replaceAll('\r\n','\n');
    assert.equal(
      normalizedCore,
      node.getText(baselineAst).replaceAll('\r\n','\n'),
      'app358 OFF-path changed follow-audited function: ' + node.name?.text,
    );
    continue;
  }
  if (node.name?.text === 'handleExploreRequest') {
    assert.equal(functions.get(node.name.text).replace('handlePublicProfile(decodeURIComponent(segments[2]), env, cors, request)',
      'handlePublicProfile(decodeURIComponent(segments[2]), env, cors)').replaceAll('\r\n','\n'),node.getText(baselineAst).replaceAll('\r\n','\n'));
    continue;
  }
  if (!allowed.has(node.name?.text)) {
    let currentText = normalizePublication365ForFollowAudit(
      normalizePublication361ForFollowAudit(functions.get(node.name?.text) || '', node.name?.text || ''),
      node.name?.text || '',
    ).replaceAll('\r\n','\n');
    if (node.name?.text === 'handleLikeD1Core') {
      // 098 intentionally inserts one early refresh-required guard to retire
      // unsafe old direct likes. The old d1only guard later in this function
      // must remain byte-identical to the historical baseline.
      assert.ok(source.includes('SORIDRAW_LIKE_ABUSE_GUARD_390_20261008'),
        'app380 like patch marker required');
      const insertedGuard = "  const authContext = await requireExploreAuth(request);\n"
        + "  throwApi('LIKE_CLIENT_REFRESH_REQUIRED', '좋아요 저장 방식을 업데이트했습니다. 새로고침 후 다시 시도해 주세요.', 409);\n";
      const initialLine = "  const authContext = await requireExploreAuth(request);\n";
      assert.equal(currentText.split(insertedGuard).length, 2,
        'app380 direct-like guard missing or duplicated');
      currentText = currentText.replace(insertedGuard, initialLine);
    }
    assert.equal(currentText,node.getText(baselineAst).replaceAll('\r\n','\n'),'unrelated function changed: ' + node.name?.text);
  }
}
for (const name of ['handleFollowR2Core','handleFollow','handleFollowState']) {
  const currentFunction354 = name === 'handleFollowR2Core'
    ? functions.get(name).replace(
        ',\n    actorFollowingCount: clampExploreSocialCount(stats?.follower?.following_count)',
        '',
      )
    : functions.get(name);
  const a = ts.createSourceFile('a.js',currentFunction354,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS).statements[0].body.statements;
  const b = baselineAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).body.statements;
  // Overlay branch and wrapper guard are the only changes to legacy flow.
  const text = node => ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified,node,node.getSourceFile()).replaceAll('\r\n','\n');
  const legacy = nodes => nodes.filter(n => {
    if (ts.isIfStatement(n) &&
        (n.expression.getText().includes('mode === "overlay348"') || n.expression.getText().includes('X-Soridraw-Follow-Protocol'))) return false;
    if (ts.isTryStatement(n) && n.getText().includes('syncExactSharedFollowing347')) return false;
    return true;
  }).map(text);
  assert.deepEqual(legacy(a),legacy(b),'legacy path changed: ' + name);
}
for (const name of names) assert.ok(functions.has(name), 'missing ' + name);
const code = names.map(n => functions.get(n)).join('\n');
const cutover = { mode: 'overlay348', cutoverToken: 'isolated-354', readOnly: false, source: 'fixture' };
const id = n => 'operation_' + String(n).padStart(16, '0');

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));
    CREATE TABLE profile_stats(uid TEXT PRIMARY KEY,follower_count INTEGER,following_count INTEGER,updated_at INTEGER);
    INSERT INTO follows VALUES('actor','legacy',1);
    INSERT INTO profile_stats VALUES('actor',0,1,1),('target',0,0,1),('legacy',1,0,1),('other',0,0,1);
    CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,is_public INTEGER);
    INSERT INTO public_profiles VALUES('target',1),('legacy',1),('other',1);`);
  db.exec(readFileSync('cloudflare/explore-worker/candidates/348-follow-overlay.sql', 'utf8'));
  const records = new Map();
  let sequence = 0, writes = 0, reads = 0, changed = 0, putAttempts = 0;
  let bucketHook = null, dbHook = null, now = 1000;
  const bucket = {
    async get(key) {
      reads++;
      const row = records.get(key);
      return row ? { etag: row.etag, customMetadata: {}, text: async () => row.body } : null;
    },
    async put(key, body, opts = {}) {
      putAttempts++;
      if (bucketHook) await bucketHook('before', key, JSON.parse(body));
      const row = records.get(key);
      if (opts.onlyIf?.etagMatches && row?.etag !== opts.onlyIf.etagMatches) return null;
      if (opts.onlyIf?.etagDoesNotMatch === '*' && row) return null;
      const etag = 'e' + (++sequence);
      records.set(key, { body, etag }); writes++;
      if (bucketHook) await bucketHook('after', key, JSON.parse(body));
      return { etag };
    },
  };
  for (const [uid, followerCount, followingCount] of [['actor',0,1],['target',0,0],['legacy',1,0],['other',0,0]]) {
    records.set('profiles/' + uid, { etag: 'e' + (++sequence), body: JSON.stringify({
      revision: 1, body: { data: { profile: { uid, followerCount, followingCount, nickname: uid } } },
      followSync354: { token: cutover.cutoverToken, exact: true, pending: {} },
    }) });
  }
  const prepare = (sql, params = []) => ({
    bind(...p) { return prepare(sql, p); },
    async first() { return db.prepare(sql).get(...params) || null; },
    async all() { return { results: db.prepare(sql).all(...params) }; },
    async run() {
      if (dbHook) await dbHook('before', sql, params);
      const out = db.prepare(sql).run(...params);
      changed += Number(out.changes);
      if (dbHook) await dbHook('after', sql, params);
      return { meta: { changes: Number(out.changes) } };
    },
  });
  const env = { PROFILE_MEDIA: bucket, LIKE_RATE_LIMITER: { limit: async () => ({ success: true }) }, DB: { prepare, batch: async stmts => {
    db.exec('BEGIN');
    try { const out = []; for (const s of stmts) out.push(await s.all()); db.exec('COMMIT'); return out; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  } } };
  const ctx = {
    console, JSON, Number, String, Boolean, Object, Math, crypto, Response, Request, URL, Set,
    Date: { now: () => ++now },
    EXPLORE_FOLLOW_CUTOVER_KEY_348: 'manifest', RATE_LIMITS: { follow: 120 }, RATE_LIMIT_WINDOW_MS: 600000,
    exploreSharedProfileR2Key060: uid => 'profiles/' + uid,
    validExploreProfileR2Bundle020: b => Boolean(b?.body?.data?.profile),
    readExploreSharedProfileByUid247: async (_, uid) => JSON.parse(records.get('profiles/' + uid)?.body || 'null'),
    clampExploreSocialCount: x => Math.max(0, Math.floor(Number(x || 0))),
    throwApi: (code, message, status) => { throw Object.assign(new Error(message), { code, status }); },
    requireExploreAuth: async () => ({ uid: 'actor' }),
    enforceUserRateLimit: async () => {},
    invalidatePublicProfileFirstViewEdgeCache: async () => {},
    syncExploreFollowingR2AfterMutation: async () => { throw Error('overlay touched legacy sync'); },
    json: (value, status, headers) => new Response(JSON.stringify(value), { status, headers }),
  };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const call = (actor, target, follow, n, rev = 0) => ctx.orchestrateFollowOverlay354(env, actor, target, follow, id(n), rev, cutover);
  const profile = uid => JSON.parse(records.get('profiles/' + uid).body);
  const relation = (actor, target) => Number(db.prepare(`SELECT COALESCE(
    (SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?),
    EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?)) AS n`).get(actor,target,actor,target).n);
  return { ctx, env, db, records, call, profile, relation,
    hooks: (b = null, d = null) => { bucketHook = b; dbHook = d; },
    metrics: () => ({ writes, reads, changed, putAttempts }) };
}

const f = fixture();
let r = await f.call('actor','target',true,1);
assert.equal(f.profile('actor').body.data.profile.followingCount,2);
assert.equal(f.profile('target').body.data.profile.followerCount,1);
const after = f.metrics().changed;
assert.equal((await f.call('actor','target',true,1)).duplicate,true);
assert.equal(f.metrics().changed,after);
await assert.rejects(f.call('actor','target',false,1), { code: 'FOLLOW_OPERATION_CONFLICT' });
const old = JSON.parse(f.records.get(f.ctx.followIntentKey354(cutover.cutoverToken,'actor','target')).body);
r = await f.call('actor','target',false,2,r.revision);
await assert.rejects(f.call('actor','target',true,3,0), { code: 'FOLLOW_REVISION_CONFLICT' });
await f.ctx.mutateFollowOverlayRelation350(f.env,'actor','target',true,old.revision,cutover,old);
assert.equal(f.relation('actor','target'),0,'suspended old writer resurrected deleted edge');
assert.equal(f.profile('actor').body.data.profile.followingCount,1);
assert.equal(f.profile('target').body.data.profile.followerCount,0);
assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM follows').get().n,1);
const legacy = fixture();
const off = await legacy.call('actor','legacy',false,4);
const oldOff = JSON.parse(legacy.records.get(legacy.ctx.followIntentKey354(cutover.cutoverToken,'actor','legacy')).body);
await legacy.call('actor','legacy',true,5,off.revision);
await legacy.ctx.mutateFollowOverlayRelation350(legacy.env,'actor','legacy',false,oldOff.revision,cutover,oldOff);
assert.equal(legacy.relation('actor','legacy'),1);
assert.equal(legacy.profile('legacy').body.data.profile.followerCount,1);
assert.equal(legacy.profile('actor').body.data.profile.followingCount,1);
for (let n = 0; n < 4; n++) {
  const same = fixture();
  const results = await Promise.allSettled([same.call('actor','target',true,60+n),same.call('actor','target',false,70+n)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length,1);
  const winner = results.find(r => r.status === 'fulfilled').value;
  assert.equal(same.relation('actor','target'),Number(winner.following));
  assert.equal(same.profile('target').body.data.profile.followerCount,Number(winner.following));
}

// Every persisted write boundary, including a lost response after a successful
// put/run, is a crash point. A new VM/Worker must finish from durable stores.
for (let boundary = 1; boundary <= 8; boundary++) {
  const g = fixture(); let seen = 0, crashed = false;
  const stop = () => { if (++seen === boundary) { crashed = true; throw Error('simulated_worker_termination'); } };
  g.hooks(async phase => { if (phase === 'after') stop(); }, async phase => { if (phase === 'after') stop(); });
  try { await g.call('actor','target',true,10); } catch (e) { assert.match(e.message,/simulated_worker_termination/); }
  g.hooks();
  // Exercise actual GET follow-state recovery, then retry the same operation.
  g.ctx.readFollowCutoverState348 = async () => cutover;
  await g.ctx.handleFollowState({},g.env,{},'target');
  await g.call('actor','target',true,10);
  assert.equal(g.relation('actor','target'),1,'crash boundary ' + boundary);
  assert.equal(g.profile('actor').body.data.profile.followingCount,2);
  assert.equal(g.profile('target').body.data.profile.followerCount,1);
  for (const uid of ['actor','target']) assert.equal(Object.keys(g.profile(uid).followSync354.pending).length,0);
  assert.ok(crashed || boundary > seen);
}

// Before-write failures must never commit an unmarked relation or lose intent.
for (const key of ['profiles/actor','profiles/target']) {
  const g = fixture();
  g.hooks(async (phase,k) => { if (phase === 'before' && k === key) throw Error('r2_unavailable'); });
  await assert.rejects(g.call('actor','target',true,20), /r2_unavailable/);
  assert.equal(g.relation('actor','target'),0);
  g.hooks(); await g.call('actor','target',true,20);
  assert.equal(g.profile('target').body.data.profile.followerCount,1);
}

// Different actors hitting one target: deterministic overlap of registrations,
// relation writes and exact snapshots; no lost increments or stale overwrite.
for (const order of [0,1,2]) {
  const g = fixture();
  let resumed; const release = new Promise(resolve => { resumed = resolve; });
  let blocked; const entered = new Promise(resolve => { blocked = resolve; });
  let once = false;
  g.hooks(async (phase,key,bundle) => {
    if (!once && phase === 'before' && key === 'profiles/target' &&
        bundle.body.data.profile.followerCount === 1) {
      once = true; blocked(); await release;
    }
  });
  const a = g.call('actor','target',true,30 + order);
  await entered;
  await g.call('other','target',true,40 + order);
  resumed(); await a;
  assert.equal(g.profile('target').body.data.profile.followerCount,2);
  assert.equal(g.relation('actor','target'),1);
  assert.equal(g.relation('other','target'),1);
}

// Real HTTP writer wrapper branches before legacy sync; old clients cannot
// mutate the overlay without an explicit ordered operation contract.
const g = fixture(); g.ctx.readFollowCutoverState348 = async () => cutover;
await assert.rejects(g.ctx.handleFollow({ json: async () => ({}) },g.env,{},'target',true), { code: 'FOLLOW_ORDER_REQUIRED' });
assert.equal(g.metrics().changed,0);
const response = await g.ctx.handleFollow({ json: async () => ({ followOperationId: id(50),followExpectedRevision: 0 }) },g.env,{},'target',true);
assert.equal(response.status,200); assert.equal(response.headers.get('X-Soridraw-Follow-Protocol'),'354');
assert.equal((await response.json()).data.following,true);
const absent = fixture();
assert.equal((await absent.ctx.readFollowCutoverState348(absent.env)).mode,'legacy');
assert.equal(absent.metrics().writes,0);
const readonly = fixture();
readonly.ctx.readFollowCutoverState348 = async () => ({ ...cutover, readOnly: true, source: 'fixture-readonly' });
await assert.rejects(readonly.ctx.handleFollow({ json: async () => ({}) },readonly.env,{},'target',true), { code: 'FOLLOW_OVERLAY_READONLY' });
assert.equal(readonly.metrics().changed,0);

const client = {};
vm.createContext(client);
const clientSource = readFileSync('src/services/exploreFollowOrdering354.ts','utf8').replace('export const','const');
vm.runInContext(ts.transpileModule(clientSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nglobalThis.client354 = requestOrderedExploreFollow354;',client);
client.crypto = crypto;
let legacyCalls = [];
const legacyRequest = async (path, init) => { legacyCalls.push([path,init]); return { data: { following: true } }; };
await Promise.all([client.client354('legacy-viewer','target',true,legacyRequest),client.client354('legacy-viewer','target',false,legacyRequest)]);
assert.equal(legacyCalls.length,2); assert.equal(legacyCalls[0][1].body,undefined);
assert.equal(legacyCalls[1][1].body,undefined);
let revision = 0, lost = true, orderedCalls = [], ids = new Map();
const orderedRequest = async (path,init) => {
  orderedCalls.push([path,init]);
  if (path.endsWith('follow-state')) return { data: { followProtocol: 354,followRevision: revision } };
  if (!init.body) throw Object.assign(Error('ordered required'),{ code:'FOLLOW_ORDER_REQUIRED' });
  const operation = JSON.parse(init.body);
  if (!ids.has(operation.followOperationId)) {
    assert.equal(operation.followExpectedRevision,revision);
    ids.set(operation.followOperationId,++revision);
    if (lost) { lost = false; throw Error('response lost after commit'); }
  }
  return { data: { revision: ids.get(operation.followOperationId) } };
};
await assert.rejects(client.client354('overlay-viewer','target',true,orderedRequest), /response lost/);
await client.client354('overlay-viewer','target',true,orderedRequest);
assert.equal(revision,1,'uncertain retry created a second operation');
assert.equal(JSON.parse(orderedCalls[2][1].body).followOperationId,JSON.parse(orderedCalls[3][1].body).followOperationId);
await Promise.all([client.client354('overlay-viewer','target',false,orderedRequest),client.client354('overlay-viewer','target',true,orderedRequest)]);
assert.equal(revision,3);
const conflict = async () => { throw Object.assign(Error('conflict'),{ code:'FOLLOW_REVISION_CONFLICT' }); };
await assert.rejects(client.client354('overlay-viewer','target',false,conflict), { code:'FOLLOW_REVISION_CONFLICT' });
console.log('FOLLOW354_ACTUAL_FUNCTION_CRASH_REPLAY_AND_EXACT_RECOVERY=PASS');
console.log('FOLLOW354_SUSPENDED_WRITER_DUPLICATE_REVERSE_AND_SHARED_TARGET=PASS');
console.log('FOLLOW354_ACTUAL_HTTP_FLOW_LEGACY_SYNC_BYPASS=PASS');
console.log('FOLLOW354_UNRELATED_FUNCTIONS_AND_LEGACY_PATH_UNCHANGED=PASS');
console.log('FOLLOW354_CLIENT_LEGACY_ONE_REQUEST_ORDERED_QUEUE_STABLE_RETRY=PASS');
console.log('FOLLOW354_SHARED_DB_DEPLOYMENT_USER_DATA_CHANGES=0');

export { fixture, functions, cutover, id };
