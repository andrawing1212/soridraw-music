import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const fail = (message) => { throw new Error('[364-cutover] ' + message); };
if (process.env.GITHUB_ACTIONS !== 'true') fail('GitHub Actions only');
if (process.env.GITHUB_REF !== 'refs/heads/preview') fail('preview branch only');
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) fail('Cloudflare credentials missing');

const root = process.cwd();
const workerDir = join(root, 'cloudflare/explore-worker');
const triggerPath = join(root, '.deploy/shared-d1-364.trigger');
const triggerText = readFileSync(triggerPath, 'utf8');
const trigger = Object.fromEntries(
  triggerText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const i = line.indexOf('=');
    return i > 0 ? [line.slice(0, i), line.slice(i + 1)] : [line, ''];
  }),
);

if (trigger.user_approved !== 'true') fail('explicit user approval missing');
for (const key of ['product_code_target','candidate','candidate_blob','rollback','rollback_blob','verifier','verifier_blob']) {
  if (!trigger[key]) fail('trigger field missing: ' + key);
}
if (!/^[0-9a-f]{40}$/.test(trigger.product_code_target)) fail('invalid product_code_target');
for (const key of ['candidate_blob','rollback_blob','verifier_blob']) {
  if (!/^[0-9a-f]{40}$/.test(trigger[key])) fail('invalid blob: ' + key);
}
if (!/^cloudflare\/explore-worker\/candidates\/[A-Za-z0-9_.-]+\.sql$/.test(trigger.candidate)) fail('invalid candidate path');
if (!/^cloudflare\/explore-worker\/candidates\/[A-Za-z0-9_.-]+\.sql$/.test(trigger.rollback)) fail('invalid rollback path');
if (!/^scripts\/[A-Za-z0-9_./-]+\.mjs$/.test(trigger.verifier)) fail('invalid verifier path');
if ([trigger.candidate, trigger.rollback, trigger.verifier].some((x) => x.includes('..'))) fail('path traversal');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, {
  cwd: opts.cwd || root,
  encoding: 'utf8',
  stdio: opts.stdio || ['ignore','pipe','pipe'],
  env: { ...process.env, ...(opts.env || {}) },
  maxBuffer: 16 * 1024 * 1024,
});

run('git', ['fetch','origin','preview','main','production','--no-tags']);
run('git', ['merge-base','--is-ancestor',trigger.product_code_target,'origin/preview']);
const mainBefore = run('git', ['rev-parse','origin/main']).trim();
const productionBefore = run('git', ['rev-parse','origin/production']).trim();

for (const [pathKey, blobKey] of [['candidate','candidate_blob'],['rollback','rollback_blob'],['verifier','verifier_blob']]) {
  const got = run('git', ['hash-object', trigger[pathKey]]).trim();
  if (got !== trigger[blobKey]) fail(pathKey + ' blob mismatch');
}

run(process.execPath, [trigger.verifier], { stdio: 'inherit' });

const stripComments = (s) => s.replace(/--.*$/gm, ' ');
const candidateText = readFileSync(resolve(root, trigger.candidate), 'utf8');
const rollbackText = readFileSync(resolve(root, trigger.rollback), 'utf8');
const allowed = new Set(['explore032_track_update','explore079_music_note_derived_track_update']);

for (const [label, raw] of [['candidate', candidateText], ['rollback', rollbackText]]) {
  const sql = stripComments(raw);
  const drops = [...sql.matchAll(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/gi)].map((m) => m[1]);
  const creates = [...sql.matchAll(/CREATE\s+TRIGGER\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi)].map((m) => m[1]);
  if (drops.length !== 2 || creates.length !== 2) fail(label + ' must contain exactly two DROP and two CREATE trigger statements');
  if (new Set(drops).size !== 2 || new Set(creates).size !== 2) fail(label + ' duplicate target trigger');
  for (const name of [...drops, ...creates]) if (!allowed.has(name)) fail(label + ' unexpected trigger ' + name);
  const forbidden = [
    /DROP\s+(?:TABLE|INDEX|VIEW)/i,
    /ALTER\s+TABLE/i,
    /CREATE\s+(?:TABLE|INDEX|VIEW)/i,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+tracks\b/i,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+likes\b/i,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+track_stats\b/i,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+explore_shared_revision\b/i,
  ];
  for (const re of forbidden) if (re.test(sql)) fail(label + ' contains forbidden mutation: ' + re);
}
console.log('364_STATIC_TRIGGER_ONLY_SAFETY=PASS');
console.log('364_USER_ROW_MUTATION_SQL=0');

const work = join(workerDir, '.shared-d1-364');
mkdirSync(work, { recursive: true });
const config = join(work, 'wrangler.jsonc');
writeFileSync(config, JSON.stringify({
  name: 'soridraw-shared-d1-364-maintenance',
  main: './placeholder.js',
  compatibility_date: '2026-09-11',
  d1_databases: [{
    binding: 'DB',
    database_name: 'soridraw-explore-db',
    database_id: '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b',
  }],
}, null, 2));

const wrangler = join(workerDir, 'node_modules/wrangler/bin/wrangler.js');
const w = (args, stdio = ['ignore','pipe','pipe']) => run(process.execPath, [wrangler, ...args], { cwd: workerDir, stdio });
run(process.execPath, ['--input-type=module','-e',"import('./scripts/derived-deploy-preflight.mjs').then(m=>m.assertDerivedBaseD1Ready('.shared-d1-364/wrangler.jsonc'))"], { cwd: workerDir, stdio: 'inherit' });
console.log('364_SHARED_D1_BASE_PREFLIGHT=PASS');

const query = (sql) => {
  const raw = w(['d1','execute','DB','--remote','--config',config,'--command',sql,'--json']);
  const parsed = JSON.parse(raw);
  return parsed.flatMap((x) => x && Array.isArray(x.results) ? x.results : []);
};
const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/;+$/, '').toLowerCase();
const triggerDdl = (sql, name) => {
  const m = stripComments(sql).match(new RegExp('CREATE\\s+TRIGGER\\s+' + name + '[\\s\\S]*?END\\s*;', 'i'));
  if (!m) fail('DDL missing trigger ' + name);
  return m[0];
};
const liveTriggers = () => query("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name");

const before = liveTriggers();
const beforeMap = new Map(before.map((x) => [String(x.name), norm(x.sql)]));
for (const name of allowed) {
  if (!beforeMap.has(name)) fail('live trigger missing ' + name);
  if (beforeMap.get(name) !== norm(triggerDdl(rollbackText, name))) fail('live trigger differs from exact rollback baseline: ' + name);
}
const sharedRevisionBefore = beforeMap.get('soridraw_shared_rev_tracks_au_051');
if (!sharedRevisionBefore) fail('shared revision trigger missing');
console.log('364_LIVE_BASELINE_MATCH_ROLLBACK=PASS');

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
async function cfGet(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok || body.success === false) fail('Cloudflare API ' + response.status + ' ' + JSON.stringify(body).slice(0, 500));
  return body.result ?? body;
}
async function activeVersion(name) {
  const payload = await cfGet('https://api.cloudflare.com/client/v4/accounts/' + account + '/workers/scripts/' + name + '/deployments');
  const deployment = (payload.deployments || payload || [])[0];
  const version = [...(deployment && deployment.versions ? deployment.versions : [])].sort((a,b) => Number(b.percentage || 0) - Number(a.percentage || 0))[0];
  if (!version || !version.version_id || Number(version.percentage || 0) < 99.99) fail('no single active Worker version for ' + name);
  return String(version.version_id);
}
const workers = {
  preview: 'soridraw-explore-preview',
  test: 'soridraw-explore-test',
  production: 'soridraw-explore-api',
};
const workerBefore = {};
for (const [key, name] of Object.entries(workers)) {
  workerBefore[key] = await activeVersion(name);
  console.log('364_' + key.toUpperCase() + '_WORKER_BEFORE=' + workerBefore[key]);
}

let applied = false;
async function exactRollback() {
  console.log('364_ROLLBACK_START');
  w(['d1','execute','DB','--remote','--config',config,'--file',resolve(root, trigger.rollback),'--yes'], 'inherit');
  const rolled = liveTriggers();
  const rolledMap = new Map(rolled.map((x) => [String(x.name), norm(x.sql)]));
  if (rolledMap.size !== beforeMap.size) fail('rollback trigger count mismatch');
  for (const [name, ddl] of beforeMap) if (rolledMap.get(name) !== ddl) fail('rollback mismatch ' + name);
  console.log('364_EXACT_ROLLBACK_VERIFIED=PASS');
}

try {
  w(['d1','execute','DB','--remote','--config',config,'--file',resolve(root, trigger.candidate),'--yes'], 'inherit');
  applied = true;

  const after = liveTriggers();
  const afterMap = new Map(after.map((x) => [String(x.name), norm(x.sql)]));
  if (afterMap.size !== beforeMap.size) fail('trigger count changed');
  for (const [name, ddl] of beforeMap) {
    if (allowed.has(name)) continue;
    if (afterMap.get(name) !== ddl) fail('unrelated trigger changed: ' + name);
  }
  const trackTrigger = String(after.find((x) => x.name === 'explore032_track_update')?.sql || '');
  const profileTrigger = String(after.find((x) => x.name === 'explore079_music_note_derived_track_update')?.sql || '');
  const trackNorm = norm(trackTrigger);
  const profileNorm = norm(profileTrigger);
  for (const token of [
    'updateexplore_derived_trackssetrow_json=json_patch',
    'new.cover_url',
    'new.duration_seconds',
    'new.suno_url_primary',
    'new.suno_url_secondary',
    'selectlike_countfromtrack_statswheretrack_id=new.id',
    'andchanges()=0',
  ]) if (!trackNorm.includes(token)) fail('track trigger semantic postflight missing: ' + token);
  if (trackNorm.includes('fromtrackst')) fail('track trigger still self-reads tracks');
  for (const token of [
    "coalesce(json_extract(old.row_json,'$.source_type'),'')='music_note'",
    "coalesce(json_extract(new.row_json,'$.source_type'),'')='music_note'",
    'old.owner_uidisnotnew.owner_uidorold.activeisnotnew.active',
    'onconflict(uid)donothing',
  ]) if (!profileNorm.includes(token)) fail('profile trigger semantic postflight missing: ' + token);

  if (afterMap.get('soridraw_shared_rev_tracks_au_051') !== sharedRevisionBefore) fail('shared revision trigger changed');

  console.log('364_TARGET_TRIGGER_SEMANTICS=PASS');
  console.log('364_ONLY_TWO_APPROVED_TRIGGERS_CHANGED=PASS');
  console.log('364_SHARED_REVISION_UNCHANGED=PASS');
  console.log('364_USER_ROWS_TOUCHED=0_BY_DDL_CONTRACT');

  run(process.execPath, ['--input-type=module','-e',"import('./scripts/derived-deploy-preflight.mjs').then(m=>m.assertDerivedBaseD1Ready('.shared-d1-364/wrangler.jsonc'))"], { cwd: workerDir, stdio: 'inherit' });

  const smokes = [
    ['preview','https://soridraw-explore-preview.andrawing1212.workers.dev','https://preview.soridraw.com'],
    ['test','https://soridraw-explore-test.andrawing1212.workers.dev','https://test.soridraw.com'],
    ['production','https://soridraw-explore-api.andrawing1212.workers.dev','https://soridraw.com'],
  ];
  for (const [name, base, origin] of smokes) {
    const response = await fetch(base + '/v1/feed?sort=latest&limit=1', { headers: { Origin: origin }, signal: AbortSignal.timeout(30000) });
    if (response.status !== 200) fail(name + ' feed smoke HTTP ' + response.status);
    console.log('364_' + name.toUpperCase() + '_FEED_SMOKE=PASS');
  }

  for (const [key, name] of Object.entries(workers)) {
    const now = await activeVersion(name);
    if (now !== workerBefore[key]) fail(key + ' Worker changed during D1-only cutover');
  }
  console.log('364_ALL_WORKER_VERSIONS_UNCHANGED=PASS');

  run('git', ['fetch','origin','main','production','--no-tags']);
  const mainAfter = run('git', ['rev-parse','origin/main']).trim();
  const productionAfter = run('git', ['rev-parse','origin/production']).trim();
  if (mainAfter !== mainBefore || productionAfter !== productionBefore) fail('protected refs changed during cutover');
  console.log('364_MAIN_PRODUCTION_REFS_UNCHANGED=PASS');
  console.log('364_SHARED_D1_TRIGGER_CUTOVER=PASS');
} catch (error) {
  if (applied) {
    try { await exactRollback(); }
    catch (rollbackError) {
      console.error(rollbackError);
      throw new Error(String(error && error.message || error) + ' ; ROLLBACK ALSO FAILED: ' + String(rollbackError && rollbackError.message || rollbackError));
    }
  }
  throw error;
}
