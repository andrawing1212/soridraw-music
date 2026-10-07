import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { schema390 } from './lib/like-receipt-390-fixture.mjs';

const temp = mkdtempSync(join(tmpdir(), 'social380-'));
try {
  copyFileSync('cloudflare/explore-worker/canonical/preview-worker.js', join(temp, 'worker.js'));
  for (const patch of ['097-follow-abuse-guard', '098-like-abuse-guard']) {
    execFileSync(process.execPath, ['cloudflare/explore-worker/patches/' + patch + '.mjs'], {
      env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: temp },
    });
  }
  const source = readFileSync(join(temp, 'worker.js'), 'utf8');
  for (const patch of ['097-follow-abuse-guard', '098-like-abuse-guard']) {
    execFileSync(process.execPath, ['cloudflare/explore-worker/patches/' + patch + '.mjs'], {
      env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: temp },
    });
  }
  assert.equal(readFileSync(join(temp, 'worker.js'), 'utf8'), source);
  execFileSync(process.execPath, ['--check', join(temp, 'worker.js')]);
  const ast = ts.createSourceFile('worker.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = ['socialAbusePolicy380', 'socialAbuseUnavailable380', 'socialAbuseLimited380',
    'consumeSocialAbuse380', 'enforceFollowEdgeRateLimit355', 'enforceExploreLikeBatchEdgeRateLimit054',
    'handleFollowOverlay354', 'handleLikeBatch034', 'handleLikeD1Core',
    'likeReceiptError390', 'likeReceiptDigest390', 'prepareLikeReceipt390', 'readLikeReceipt390', 'acceptLikeReceipt390'];
  const functions = ast.statements.filter(ts.isFunctionDeclaration).filter(n => names.includes(n.name?.text));
  assert.equal(functions.length, names.length);
  const canonical = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
  const baselineAst = ts.createSourceFile('baseline.js', canonical, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const baselineFunctions = new Map(baselineAst.statements.filter(ts.isFunctionDeclaration).map(n => [n.name?.text, n.getText(baselineAst)]));
  const generatedFunctions = new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n => [n.name?.text, n.getText(ast)]));
  const changed = new Set(['enforceFollowEdgeRateLimit355', 'handleFollowOverlay354',
    'handleLikeBatch034', 'handleLikeD1Core', 'enforceExploreLikeBatchEdgeRateLimit054']);
  for (const [name, text] of baselineFunctions) if (!changed.has(name)) {
    assert.equal(generatedFunctions.get(name), text, 'frozen Worker function changed: ' + name);
  }
  // Run the exact frozen queue intake against isolated SQLite. total_changes
  // is fixture row work, never a claim about remote D1 billing/index writes.
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE explore_like_batches_069(batch_id TEXT PRIMARY KEY, user_uid TEXT,
    created_at INTEGER, mutation_count INTEGER, mutations_json TEXT);
    CREATE TABLE explore_like_cutover_control_174(id INTEGER PRIMARY KEY, phase TEXT);
    INSERT INTO explore_like_cutover_control_174 VALUES(1, 'open');`);
  const db = { prepare: sql => ({ sql, params: [], bind: (...params) => ({ sql, params }) }),
    batch: async statements => statements.map(({ sql, params }) => {
      if (/^\s*SELECT/.test(sql)) return { success: true, results: sqlite.prepare(sql).all(...params) };
      const result = sqlite.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(result.changes) } };
    }),
  };
  const queueContext = vm.createContext({ crypto: webcrypto, TextEncoder, Date,
    readLikeCutoverState162: async () => ({ mode: 'legacy' }),
    isMissingLikeCutoverControl174: () => false,
  });
  vm.runInContext(['exploreLikeW1Batch040', 'enqueueExploreLikeBatch035', 'isMissingExploreLikeQueue069040']
    .map(name => generatedFunctions.get(name)).join('\n'), queueContext);
  const beforeQueue = sqlite.prepare('SELECT total_changes() AS n').get().n;
  for (const [n, liked] of [true, false].entries()) {
    await queueContext.enqueueExploreLikeBatch035({ DB: db }, 'fixture', [{ trackId: 't', liked, mutationAt: 1000 + n }], 1000 + n);
  }
  assert.equal(sqlite.prepare('SELECT total_changes() AS n').get().n - beforeQueue, 2);
  sqlite.close();
  let now = 1_800_000_000_000;
  let d1 = 0, r2Deltas = 0;
  const receiptDb = new DatabaseSync(':memory:');
  receiptDb.exec(readFileSync('cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql', 'utf8'));
  receiptDb.exec("CREATE TABLE explore_like_cutover_control_174(id INTEGER PRIMARY KEY,phase TEXT); INSERT INTO explore_like_cutover_control_174 VALUES(1,'open');");
  for (const sql of schema390()) receiptDb.exec(sql);
  const prepared = (sql, params = []) => ({ bind: (...values) => prepared(sql, values),
    async first() { d1++; return receiptDb.prepare(sql).get(...params) || null; },
    async all() { d1++; return { success: true, results: receiptDb.prepare(sql).all(...params) }; },
  });
  const queueCount = () => receiptDb.prepare('SELECT count(*) n FROM explore_like_batches_069').get().n;
  const writes = () => receiptDb.prepare('SELECT total_changes() n').get().n;
  const context = vm.createContext({ Date: { now: () => now }, console, crypto: webcrypto, TextEncoder,
    throwApi: (code, message, status, headers) => { throw Object.assign(new Error(message), { code, status, headers }); },
    EXPLORE_LIKE_BATCH_MAX_034: 50,
    requireExploreAuth: async () => ({ uid: 'actor' }), clampExploreSocialCount: Number,
    json: (body, status) => ({ body, status }),
    assertLegacyLikeIntakeOpen165: async () => {},
    syncExploreLikeR2AfterBatch074: async () => { r2Deltas++; return { ok: true }; },
  });
  vm.runInContext(functions.map(n => n.getText(ast)).join('\n'), context);
  const bucket = () => {
    const rows = new Map(); let reads = 0, writes = 0, conflicts = 0, seq = 0;
    return { rows, failGet: false, failPut: false, contest: false,
      get reads() { return reads; }, get writes() { return writes; }, get conflicts() { return conflicts; },
      async get(key) { reads++; if (this.failGet) throw Error('offline');
        const row = rows.get(key); return row ? { etag: row.etag, text: async () => row.body } : null; },
      async put(key, body, options) { if (this.failPut) throw Error('offline');
        const prior = rows.get(key); const condition = options?.onlyIf;
        assert.ok(condition, 'guard must use conditional writes');
        if (this.contest || (prior ? condition.etagMatches !== prior.etag : condition.etagDoesNotMatch !== '*')) {
          conflicts++; return null;
        }
        writes++; const etag = String(++seq); rows.set(key, { etag, body }); return { etag };
      },
    };
  };
  const environment = (r2 = bucket()) => ({ SORIDRAW_ENVIRONMENT: 'preview', PROFILE_MEDIA: r2,
    LIKE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: { prepare: prepared },
  });
  const intent = (target, desired = true, operation = 1) => ({ target, desired, operationId: 'operation_' + String(operation).padStart(16, '0') });
  const consume = (env, domain, rows) => context.consumeSocialAbuse380(env, 'actor', domain, rows);
  const reject = async (task, code, retry = null) => {
    const before = d1;
    let rejection;
    await assert.rejects(task, e => {
      rejection = e;
      return e.code === code && (retry === null || Number(e.headers?.['Retry-After']) === retry);
    });
    assert.equal(d1, before, 'rejection must be D1 R0/W0');
    return rejection;
  };
  for (const domain of ['follow', 'like']) {
    const env = environment(); const policy = context.socialAbusePolicy380(domain);
    for (let level = 0; level < 4; level++) {
      await consume(env, domain, [intent('pair', level % 2 === 0, level + 1)]);
      const saved = JSON.parse([...env.PROFILE_MEDIA.rows.values()][0].body);
      assert.equal(saved.pairs[0].level, level);
      await reject(() => consume(env, domain, [intent('pair', level % 2 !== 0, level + 2)]), 'RATE_LIMITED', policy.cooldowns[level] / 1000);
      now += policy.cooldowns[level];
    }
    now += policy.quietMs;
    await consume(env, domain, [intent('pair', true, 10)]);
    assert.equal(JSON.parse([...env.PROFILE_MEDIA.rows.values()][0].body).pairs[0].level, 0);
    const before = env.PROFILE_MEDIA.writes;
    if (domain === 'follow') {
      await consume(env, domain, [intent('pair', true, 10)]);
      await consume(env, domain, [intent('pair', true, 11)]);
    } else {
      await consume(env, domain, [intent('pair', true, 10)]);
      await reject(() => consume(env, domain, [intent('pair', true, 11)]), 'RATE_LIMITED');
    }
    assert.equal(env.PROFILE_MEDIA.writes, before, 'same desired and replay spend no extra receipt');
    await reject(() => consume(env, domain, [intent('pair', false, 10)]), 'SOCIAL_OPERATION_CONFLICT');

    const capped = environment();
    for (let n = 0; n < policy.dayLimit; n++) {
      if (n && n % policy.windowLimit === 0) now += 600_001;
      await consume(capped, domain, [intent('target' + n, true, n)]);
      if ((n + 1) % policy.windowLimit === 0 && n + 1 < policy.dayLimit) {
        await reject(() => consume(capped, domain, [intent('blocked', true, 9999)]), 'RATE_LIMITED', 600);
      }
    }
    now += 600_001;
    await reject(() => consume(capped, domain, [intent('day-blocked', true, 9999)]), 'RATE_LIMITED');
    assert.equal(JSON.parse([...capped.PROFILE_MEDIA.rows.values()][0].body).events.length, policy.dayLimit);
    now += 86_400_001;
    await consume(capped, domain, [intent('next-day', true, 999)]);
    assert.equal(JSON.parse([...capped.PROFILE_MEDIA.rows.values()][0].body).events.length, 1);
  }
  const staleReplay = environment();
  await consume(staleReplay, 'like', [intent('t', true, 1)]);
  now += 30_000;
  await consume(staleReplay, 'like', [intent('t', false, 2)]);
  now += 60_000;
  const replayWrites = staleReplay.PROFILE_MEDIA.writes;
  await consume(staleReplay, 'like', [intent('t', true, 1)]);
  assert.equal(d1, 0, 'R2 never acknowledges or writes intake');
  assert.equal(staleReplay.PROFILE_MEDIA.writes, replayWrites);
  const shared = bucket();
  for (const name of ['preview', 'test', 'production']) for (const domain of ['follow', 'like']) {
    await consume({ ...environment(shared), SORIDRAW_ENVIRONMENT: name }, domain, [intent('target')]);
  }
  assert.equal(shared.rows.size, 6);
  assert.ok([...shared.rows.keys()].every(key => /^internal\/explore\/abuse\/(preview|test|production)\/(follow|like)\/actor.json$/.test(key)));
  await reject(() => consume({ ...environment(), SORIDRAW_ENVIRONMENT: '' }, 'like', [intent('t')]), 'RATE_LIMIT_UNAVAILABLE');
  await consume({ ...environment(), SORIDRAW_ENVIRONMENT: '', ENV_NAME: 'test' }, 'like', [intent('t')]);
  const concurrent = environment();
  await Promise.all(Array.from({ length: 6 }, (_, n) => consume(concurrent, 'like', [intent('concurrent' + n, true, n)])));
  const concurrentState = JSON.parse([...concurrent.PROFILE_MEDIA.rows.values()][0].body);
  assert.equal(concurrentState.events.length, 6);
  assert.equal(concurrentState.pairs.length, 6);
  assert.ok(concurrent.PROFILE_MEDIA.conflicts > 0);
  for (const fault of ['failGet', 'failPut', 'contest']) {
    const env = environment(); env.PROFILE_MEDIA[fault] = true;
    await reject(() => consume(env, 'like', [intent('t')]), 'RATE_LIMIT_UNAVAILABLE');
    assert.ok(env.PROFILE_MEDIA.reads <= 6);
  }
  const corrupt = environment(); await consume(corrupt, 'like', [intent('t')]);
  const key = [...corrupt.PROFILE_MEDIA.rows.keys()][0];
  corrupt.PROFILE_MEDIA.rows.set(key, { etag: 'bad', body: '{"schemaVersion":380,"events":[],"pairs":[{}]}' });
  await reject(() => consume(corrupt, 'like', [intent('other', true, 99)]), 'RATE_LIMIT_UNAVAILABLE');

  const request = mutations => ({ json: async () => ({ mutations }) });
  const likeRow = (trackId, liked = true, operation = 1) => ({ trackId, liked, operationId: intent(trackId, liked, operation).operationId, expectedRevision: 0, mutationAt: now });
  const batchEnv = environment();
  const exactRows = [likeRow('a'), likeRow('b', true, 2)];
  const beforeNew = writes();
  const accepted = await context.handleLikeBatch034(request([likeRow('a', false), ...exactRows]), batchEnv, {});
  assert.equal(accepted.body.data.results[0].liked, true);
  assert.equal(writes() - beforeNew, 2, 'receipt + queue atomic fixture writes');
  assert.equal(queueCount(), 1);
  assert.equal(JSON.parse([...batchEnv.PROFILE_MEDIA.rows.values()][0].body).events.length, 2);
  const beforeReplay = writes();
  const replayAck = await context.handleLikeBatch034(request([...exactRows].reverse()), batchEnv, {});
  assert.equal(replayAck.status, 200);
  assert.equal(replayAck.body.data.acceptanceReplay390, true);
  assert.equal(replayAck.body.data.results, undefined, 'receipt never supplies membership/count/revision');
  assert.equal(writes(), beforeReplay);
  assert.equal(queueCount(), 1);
  assert.equal(r2Deltas, 1, 'old replay never republishes a personal R2 delta');
  receiptDb.exec('DELETE FROM explore_like_batches_069');
  const afterProcessor = writes();
  await context.handleLikeBatch034(request(exactRows), batchEnv, {});
  assert.equal(writes(), afterProcessor);
  assert.equal(queueCount(), 0);
  // R2 reservation before a failed queue transaction cannot become success.
  now += 600_001;
  const crashRows = [likeRow('crash', true, 99)];
  receiptDb.exec("UPDATE explore_like_cutover_control_174 SET phase='closed'");
  await assert.rejects(() => context.handleLikeBatch034(request(crashRows), batchEnv, {}), /LIKE_RECEIPT_FENCE_CLOSED/);
  receiptDb.exec("UPDATE explore_like_cutover_control_174 SET phase='open'");
  const beforeRetry = writes();
  const retry = await context.handleLikeBatch034(request(crashRows), batchEnv, {});
  assert.equal(retry.body.data.acceptanceReplay390, undefined);
  assert.equal(writes() - beforeRetry, 2, 'reservation-only crash recovers as actual new acceptance');
  // app160/app164 stable batch fields remain supported; only the old direct
  // endpoint is refresh-required. No normal batch is forced onto that endpoint.
  const compatible = await context.handleLikeBatch034(request([{
    trackId: 'supported-client', liked: true, baseLiked: false, mutationAt: now,
    operationId: '00000000-0000-4000-8000-000000000164', expectedRevision: 0,
  }]), batchEnv, {});
  assert.equal(compatible.status, 200);
  assert.equal(compatible.body.data.results[0].status, 'legacy-queued');
  assert.equal(compatible.body.data.personalLikeProtocol, 'w1-queue-changed-track-188');

  for (const env of [{ ...environment(), LIKE_RATE_LIMITER: null },
    { ...environment(), LIKE_RATE_LIMITER: { limit: async () => { throw Error('offline'); } } }]) {
    await reject(() => context.handleLikeBatch034(request([likeRow('a')]), env, {}), 'RATE_LIMIT_UNAVAILABLE');
    await reject(() => context.enforceFollowEdgeRateLimit355(env, 'actor', 'target', true, intent('t').operationId), 'RATE_LIMIT_UNAVAILABLE');
  }
  await reject(() => context.handleLikeBatch034(request([likeRow('a', true, 1), { trackId: 'bad', liked: true }]), environment(), {}), 'INVALID_SOCIAL_INTENT');
  await reject(() => context.handleLikeBatch034(request(Array.from({ length: 51 }, (_, n) => likeRow('t' + n))), environment(), {}), 'TOO_MANY_LIKES');
  for (const payload of [null, {}, { followOperationId: intent('t').operationId, followExpectedRevision: -1 }]) {
    const env = environment();
    await reject(() => context.handleFollowOverlay354({ json: async () => payload }, env, {}, 'actor', 'target', true, {}), 'FOLLOW_ORDER_REQUIRED');
    assert.equal(env.PROFILE_MEDIA.writes, 0);
  }
  await reject(() => context.handleLikeD1Core({}, environment(), {}, 'target', true), 'LIKE_CLIENT_REFRESH_REQUIRED');
  receiptDb.close();
  const manifest = readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8');
  assert.doesNotMatch(manifest, /097-follow-abuse|098-like-abuse/);
  console.log('APP380_FROZEN_WORKER_FUNCTIONS_EXACT_AND_SQLITE_LIKE_INTAKE_W1_EACH=PASS');
  console.log('APP380_SOCIAL_RUNTIME_POLICIES_CAPS_ISOLATION_CAS_FAILURES=PASS');
  console.log('APP380_HTTP_REJECTION_D1_R0_W0_AND_RECEIPT_INTAKE=PASS');
  console.log('APP380_LIKE_REPLAY_W0_ACCEPTANCE_ONLY_ACK=PASS');
  console.log('APP380_RESERVATION_CRASH_RETRY_AND_PROCESSED_QUEUE_REPLAY=PASS');
  console.log('APP380_CANDIDATE_PATCH_IDEMPOTENCE_NO_RELEASE_REGISTRATION=PASS');
  if (process.argv.includes('--release')) {
    // Successful replay is necessary but not sufficient: execute client ordering
    // and transaction proofs too. Live/Work gates remain separate from this suite.
    execFileSync(process.execPath, ['scripts/verify-390-like-acceptance-receipt.mjs'], { stdio: 'inherit' });
    execFileSync(process.execPath, ['scripts/verify-391-like-replay-ordering.mjs'], { stdio: 'inherit' });
    console.log('APP380_RELEASE_SOURCE_REPLAY_BLOCKER_CLEARED=PASS');
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
