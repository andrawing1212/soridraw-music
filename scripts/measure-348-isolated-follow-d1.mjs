// 348: isolated remote D1 proof for the no-backfill follow overlay candidate.
// NEVER binds to the shared user database. Creates one synthetic D1 database
// per CI run and deletes it in finally + an always() workflow cleanup step.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (!/^[a-f0-9]{32}$/.test(account || '') || !token || !/^\d+$/.test(run || '') || !/^\d+$/.test(attempt)) {
  throw Error('348 requires CI token, account and numeric GitHub run/attempt');
}
const name = 'soridraw-follow-cost-348-' + run + '-' + attempt;
const record = join(process.env.RUNNER_TEMP || '/tmp', 'soridraw-348-temp-d1.json');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/d1/database';
const fail = (message) => { throw Error('348 ' + message); };

async function api(method, suffix, body) {
  const response = await fetch(base + suffix, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  let answer;
  try { answer = await response.json(); } catch { fail('API returned non-JSON HTTP ' + response.status); }
  if (!response.ok || answer?.success !== true) {
    const errors = (answer?.errors || []).map(x => x.code + ':' + x.message).join('; ');
    fail(method + ' HTTP ' + response.status + ' ' + errors.slice(0, 400));
  }
  return answer.result;
}
async function ensureOwned(dbId) {
  if (!/^[a-f0-9-]{36}$/.test(dbId)) fail('invalid temp DB UUID');
  const db = await api('GET', '/' + dbId);
  if (db?.name !== name) fail('DB ownership mismatch: refusing deletion');
}
async function cleanup() {
  let state;
  try { state = JSON.parse(await readFile(record, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (state?.name !== name) fail('cleanup record name mismatch');
  await ensureOwned(state.uuid);
  await api('DELETE', '/' + state.uuid);
  await unlink(record);
  console.log('348_EPHEMERAL_D1_DELETED=PASS');
}
if (process.argv[2] === 'cleanup') {
  await cleanup();
} else {
  execFileSync(process.execPath, ['scripts/verify-354-follow-orchestration.mjs'], { stdio: 'inherit' });
  let created = false;
  try {
    const db = await api('POST', '', { name, primary_location_hint: 'apac' });
    if (db?.name !== name || !/^[a-f0-9-]{36}$/.test(db.uuid || '')) fail('created DB metadata mismatch');
    await writeFile(record, JSON.stringify({ name, uuid: db.uuid }), { flag: 'wx', mode: 0o600 });
    created = true;
    console.log('348_EPHEMERAL_D1_CREATED=' + name);

    async function query(sql, params = []) {
      const rows = await api('POST', '/' + db.uuid + '/query', { sql, params });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.success !== true) fail('query did not return one success');
      return rows[0];
    }
    const ddl = query;

    // Immutable legacy baseline: mirrors the current live follow shape enough to
    // prove we never have to rewrite/backfill it at cutover.
    await ddl("CREATE TABLE follows (" +
      "follower_uid TEXT NOT NULL, following_uid TEXT NOT NULL, created_at INTEGER NOT NULL," +
      "PRIMARY KEY(follower_uid,following_uid), CHECK(follower_uid<>following_uid))");
    await ddl("CREATE INDEX idx_follows_legacy_348_follower_created ON follows(follower_uid,created_at DESC,following_uid)");
    await ddl("CREATE INDEX idx_follows_legacy_348_following_created ON follows(following_uid,created_at DESC,follower_uid)");
    await ddl("INSERT INTO follows(follower_uid,following_uid,created_at) VALUES" +
      "('actor','legacy-target',100),('other','legacy-target',101),('actor','legacy-two',102)");

    // Candidate hot path: one WITHOUT ROWID sparse override row. Forward lookup
    // uses the PK prefix; reverse discovery and exact-count recovery share one
    // full reverse index so both active and negative deltas remain indexed.
    await ddl("CREATE TABLE explore_follow_overrides_348 (" +
      "follower_uid TEXT NOT NULL, following_uid TEXT NOT NULL," +
      "following INTEGER NOT NULL CHECK(following IN(0,1))," +
      "baseline_following INTEGER NOT NULL CHECK(baseline_following IN(0,1))," +
      "updated_at INTEGER NOT NULL, mutation_id TEXT NOT NULL," +
      "PRIMARY KEY(follower_uid,following_uid)) WITHOUT ROWID");
    await ddl("CREATE INDEX idx_explore_follow_overrides_348_reverse " +
      "ON explore_follow_overrides_348(following_uid,follower_uid)");

    const q = (value) => "'" + String(value).replaceAll("'", "''") + "'";
    const effectiveSql = (actor, target) =>
      "COALESCE((SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=" + q(actor) +
      " AND following_uid=" + q(target) + ")," +
      " EXISTS(SELECT 1 FROM follows WHERE follower_uid=" + q(actor) +
      " AND following_uid=" + q(target) + "))";

    // Execute the actual candidate helper, not a hand-written lookalike or
    // synthetic W0 shortcut. Only this freshly created DB is bound to it.
    const worker = await readFile('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
    const ast = ts.createSourceFile('worker.js',worker,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'mutateFollowOverlayRelation350');
    if (!node) fail('actual fenced writer missing');
    const context = { console, crypto, Math, String, Boolean, Number };
    vm.createContext(context); vm.runInContext(node.getText(ast),context);
    let mutationResults = [];
    const prepare = (sql, params = []) => ({
      bind(...values) { return prepare(sql,values); },
      async run() { const result = await query(sql,params); mutationResults.push(result); return result; },
    });
    const isolatedEnv = { DB: { prepare } };
    const cutover = { mode: 'overlay348', cutoverToken: 'isolated-354-' + run };
    async function mutate(actor, target, desired, at, expectedEffective = desired) {
      mutationResults = [];
      await context.mutateFollowOverlayRelation350(isolatedEnv,actor,target,Boolean(desired),at,cutover,{
        actor,target,following:Boolean(desired),revision:at,token:cutover.cutoverToken,id:'isolated_operation_' + at,
      });
      if (mutationResults.length !== 1) fail('actual fenced writer issued unexpected query count');
      const out = mutationResults[0];
      const final = await query("SELECT " + effectiveSql(actor, target) + " AS following");
      if (Number(final.results?.[0]?.following || 0) !== Number(expectedEffective)) fail('effective relation mismatch');
      const written = Number(out.meta?.rows_written || 0);
      const read = Number(out.meta?.rows_read || 0);
      const changes = Number(out.meta?.changes || 0);
      console.log('348_REMOTE_' + actor.toUpperCase().replaceAll('-','_') + '_' +
        target.toUpperCase().replaceAll('-','_') + '_' + (desired ? 'FOLLOW' : 'UNFOLLOW') +
        '=rows_written:' + written + ',rows_read:' + read + ',changes:' + changes +
        ',queryW:1');
      return { written, read, changes };
    }

    // New edge and legacy edge must both stay W1-W2 physically; duplicates W0.
    const seq = [];
    seq.push(await mutate('actor','new-target',true,200));
    seq.push(await mutate('actor','new-target',true,201));
    seq.push(await mutate('actor','new-target',false,202));
    seq.push(await mutate('actor','new-target',false,203));
    seq.push(await mutate('actor','legacy-target',false,204));
    seq.push(await mutate('actor','legacy-target',false,205));
    seq.push(await mutate('actor','legacy-target',true,206));
    seq.push(await mutate('actor','legacy-target',true,207));
    if (seq.some((row, i) => row.written > (i % 2 === 0 ? 2 : 0))) {
      fail('overlay write exceeded W2/W0 contract: ' + seq.map(x => x.written).join(','));
    }
    if (seq.filter((_,i)=>i%2===1).some(row => row.written !== 0)) fail('duplicate mutation billed writes');

    const baselineCount = await query("SELECT COUNT(*) AS n FROM follows");
    if (Number(baselineCount.results?.[0]?.n) !== 3) fail('legacy baseline mutated');
    const sparse = await query("SELECT COUNT(*) AS n FROM explore_follow_overrides_348");
    if (Number(sparse.results?.[0]?.n) !== 2) fail('touched-edge ordering fences were deleted');
    const fenceWrites = await mutate('actor','new-target',true,200,false);
    if (fenceWrites.written !== 0) fail('suspended old request wrote after return to baseline');

    // Recreate representative post-cutover overrides to verify both pagination directions.
    await query("INSERT INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id) VALUES" +
      "('actor','new-target',1,0,300,'m1'),('actor','legacy-target',0,1,301,'m2'),('new-follower','legacy-target',1,0,302,'m3') " +
      "ON CONFLICT(follower_uid,following_uid) DO UPDATE SET following=excluded.following,updated_at=excluded.updated_at,mutation_id=excluded.mutation_id");
    const forwardSql =
      "SELECT following_uid,followed_at FROM (" +
      "SELECT l.following_uid,l.created_at AS followed_at FROM follows l " +
      "WHERE l.follower_uid='actor' AND NOT EXISTS(" +
      "SELECT 1 FROM explore_follow_overrides_348 o WHERE o.follower_uid=l.follower_uid AND o.following_uid=l.following_uid) " +
      "UNION ALL SELECT o.following_uid,o.updated_at AS followed_at FROM explore_follow_overrides_348 o " +
      "WHERE o.follower_uid='actor' AND o.following=1) ORDER BY followed_at DESC,following_uid DESC LIMIT 50";
    const reverseSql =
      "SELECT follower_uid,followed_at FROM (" +
      "SELECT l.follower_uid,l.created_at AS followed_at FROM follows l " +
      "WHERE l.following_uid='legacy-target' AND NOT EXISTS(" +
      "SELECT 1 FROM explore_follow_overrides_348 o WHERE o.follower_uid=l.follower_uid AND o.following_uid=l.following_uid) " +
      "UNION ALL SELECT o.follower_uid,o.updated_at AS followed_at FROM explore_follow_overrides_348 o " +
      "INDEXED BY idx_explore_follow_overrides_348_reverse " +
      "WHERE o.following_uid='legacy-target' AND o.following=1) ORDER BY followed_at DESC,follower_uid DESC LIMIT 50";
    for (const [label,sql] of [['FORWARD',forwardSql],['REVERSE',reverseSql]]) {
      const plan = await query('EXPLAIN QUERY PLAN ' + sql);
      const detail = String(plan.results?.map(x => x.detail).join(' | ') || '');
      if (/SCAN follows\b/i.test(detail) || /SCAN explore_follow_overrides_348\b/i.test(detail)) {
        fail(label + ' effective list contains a whole-table scan: ' + detail);
      }
      if (!/SEARCH/i.test(detail)) fail(label + ' effective list lacks indexed search: ' + detail);
      const rows = await query(sql);
      console.log('348_' + label + '_INDEX_PLAN=PASS ' + detail.replace(/\s+/g,' ').slice(0,900));
      console.log('348_' + label + '_ROWS_READ=' + Number(rows.meta?.rows_read || 0));
    }

    // A targeted pair lookup is the normal mutation/read repair primitive.
    const pairPlan = await query("EXPLAIN QUERY PLAN SELECT COALESCE(" +
      "(SELECT following FROM explore_follow_overrides_348 WHERE follower_uid='actor' AND following_uid='new-target')," +
      "EXISTS(SELECT 1 FROM follows WHERE follower_uid='actor' AND following_uid='new-target'))");
    const pairDetail = String(pairPlan.results?.map(x => x.detail).join(' | ') || '');
    if (/SCAN (?:follows|explore_follow_overrides_348)\b/i.test(pairDetail)) fail('pair lookup scanned table');
    console.log('348_PAIR_INDEX_PLAN=PASS ' + pairDetail.replace(/\s+/g,' ').slice(0,700));
    console.log('348_NO_BACKFILL_SPARSE_FOLLOW_OVERLAY_W2_W0=PASS');
    console.log('348_LEGACY_FOLLOWS_IMMUTABLE=PASS');
    console.log('348_SHARED_USER_DATA_TOUCHED=0');
    console.log('354_ACTUAL_FENCED_WRITER_REMOTE_BILLING=PASS');

    // Synthetic HTTP namespace: separate from relation samples above; no live
    // Worker, R2 bucket, RATE_DB, or shared user resource is bound or written.
    await ddl("CREATE TABLE profile_stats(uid TEXT PRIMARY KEY,follower_count INTEGER,following_count INTEGER,updated_at INTEGER)");
    await ddl("CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,is_public INTEGER)");
    await ddl("INSERT INTO follows VALUES('http-actor','http-legacy',1)");
    await ddl("INSERT INTO profile_stats VALUES('http-actor',0,1,1),('http-target',0,0,1)");
    await ddl("INSERT INTO public_profiles VALUES('http-target',1)");
    const { measureHttp355 } = await import('./verify-355-follow-audit-repairs.mjs');
    await measureHttp355(query, 'http-');
    console.log('355_HTTP_ACTUAL_HANDLER_REMOTE_DB_W2_RATE_DB_W0_R2_FIXTURE=PASS');
  } finally {
    if (created) await cleanup();
  }
}
