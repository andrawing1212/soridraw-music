import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// SORIDRAW_LIKE_D1_CUTOVER_CONTROLLER_174_20260922
//
// Manual release-controller only. No workflow calls mutation actions.
// This script does NOT apply migrations and does NOT write the final R2 cutover
// marker. It only transitions the one shared-D1 system control row after
// re-verifying the exact active PREVIEW/TEST/PRODUCTION Worker source.

const clean = (value) => String(value || '').trim();
const sha256 = (value) => createHash('sha256').update(String(value || '')).digest('hex');
const validSha = (value) => /^[0-9a-f]{64}$/i.test(clean(value));
const quote = (value) => "'" + String(value || '').replaceAll("'", "''") + "'";
const REQUIRED_MARKERS = [
  'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921',
  'SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922',
  'SORIDRAW_LIKE_D1_ATOMIC_CUTOVER_FENCE_174_20260922',
];

function parseCli(args) {
  let action = 'observe';
  let config = '';
  let approvedWorkerSha256 = clean(process.env.SORIDRAW_APPROVED_WORKER_SHA256_174 || '').toLowerCase();
  let confirm = '';
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--action') action = clean(args[++index]);
    else if (value === '--config') config = clean(args[++index]);
    else if (value === '--approved-worker-sha256') approvedWorkerSha256 = clean(args[++index]).toLowerCase();
    else if (value === '--confirm') confirm = clean(args[++index]);
    else throw new Error('174 controller: unknown argument ' + value);
  }
  if (!['observe', 'begin-draining', 'reopen', 'freeze'].includes(action)) {
    throw new Error('174 controller: unsupported action');
  }
  if (!config) throw new Error('174 controller: --config is required');
  if (action !== 'observe' && !validSha(approvedWorkerSha256)) {
    throw new Error('174 controller: exact approved Worker sha256 is required for mutation action');
  }
  if (['begin-draining', 'freeze'].includes(action) && confirm !== 'MANUAL_174_WRITE_APPROVED') {
    throw new Error('174 controller: explicit MANUAL_174_WRITE_APPROVED confirmation is required');
  }
  if (action === 'reopen' && confirm !== 'MANUAL_174_REOPEN_APPROVED') {
    throw new Error('174 controller: explicit MANUAL_174_REOPEN_APPROVED confirmation is required');
  }
  return { action, config: resolve(config), approvedWorkerSha256, confirm };
}

function wrangler(config, sql) {
  const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(process.execPath, [
    cli, 'd1', 'execute', 'DB', '--remote', '--command', sql, '--json', '--config', config,
  ], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error('174 controller D1 command failed: ' + (result.error?.message || result.stderr || result.status));
  }
  let parsed;
  try { parsed = JSON.parse(String(result.stdout || '')); }
  catch { throw new Error('174 controller: invalid D1 JSON'); }
  if (!Array.isArray(parsed) || parsed.some((row) => row?.success !== true || !Array.isArray(row?.results))) {
    throw new Error('174 controller: D1 command unsuccessful');
  }
  return parsed.flatMap((row) => row.results || []);
}

function observe(config) {
  const rows = wrangler(config,
    'SELECT id,phase,epoch,approved_worker_sha256,drain_token_hash,phase_changed_at,frozen_at ' +
    'FROM explore_like_cutover_control_174 WHERE id = 1 LIMIT 1'
  );
  if (rows.length !== 1) throw new Error('174 controller: control row missing');
  return rows[0];
}

async function cfGet(url) {
  const token = clean(process.env.CLOUDFLARE_API_TOKEN);
  if (!token) throw new Error('174 controller: CLOUDFLARE_API_TOKEN is required');
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error('174 controller: Cloudflare read failed HTTP ' + response.status);
  }
  return payload?.result ?? payload;
}

async function verifyExactWorkers(approvedSha) {
  if (!validSha(approvedSha)) throw new Error('174 controller: invalid approved sha');
  const account = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  if (!account) throw new Error('174 controller: CLOUDFLARE_ACCOUNT_ID is required');
  const workers = {
    preview: clean(process.env.PREVIEW_WORKER || 'soridraw-explore-preview'),
    test: clean(process.env.TEST_WORKER || 'soridraw-explore-test'),
    production: clean(process.env.PRODUCTION_WORKER || 'soridraw-explore-api'),
  };
  const verified = {};
  for (const [stage, worker] of Object.entries(workers)) {
    const base = 'https://api.cloudflare.com/client/v4/accounts/' + account;
    const deployments = await cfGet(base + '/workers/scripts/' + encodeURIComponent(worker) + '/deployments');
    const deployment = (deployments?.deployments || deployments || [])[0];
    const active = [...(deployment?.versions || [])]
      .sort((a, b) => Number(b?.percentage || 0) - Number(a?.percentage || 0))[0];
    if (!active?.version_id || Number(active?.percentage || 0) < 99.99) {
      throw new Error('174 controller: ' + stage + ' does not have one fully active Worker');
    }
    const version = await cfGet(
      base + '/workers/workers/' + encodeURIComponent(worker) +
      '/versions/' + encodeURIComponent(active.version_id) + '?include=modules'
    );
    const modules = Array.isArray(version?.modules) ? version.modules : [];
    const main = modules.find((item) => item?.name === (version?.main_module || modules[0]?.name)) || modules[0];
    if (!main?.content_base64) throw new Error('174 controller: ' + stage + ' source missing');
    const source = Buffer.from(main.content_base64, 'base64').toString('utf8');
    const actualSha = sha256(source);
    if (actualSha !== approvedSha) {
      throw new Error('174 controller: ' + stage + ' active source is not exact approved 174 source');
    }
    for (const marker of REQUIRED_MARKERS) {
      if (!source.includes(marker)) throw new Error('174 controller: ' + stage + ' missing ' + marker);
    }
    verified[stage] = { versionId: String(active.version_id), sha256: actualSha };
  }
  return verified;
}

function beginDraining(config, approvedSha) {
  const rawToken = clean(process.env.SORIDRAW_LIKE_DRAIN_TOKEN_174 || '');
  if (rawToken.length < 24) throw new Error('174 controller: SORIDRAW_LIKE_DRAIN_TOKEN_174 is required');
  const tokenHash = sha256(rawToken);
  const now = Date.now();
  const rows = wrangler(config,
    'UPDATE explore_like_cutover_control_174 ' +
    "SET phase='draining',epoch=epoch+1,approved_worker_sha256=" + quote(approvedSha) +
    ',drain_token_hash=' + quote(tokenHash) +
    ',phase_changed_at=' + now + ',frozen_at=0 ' +
    "WHERE id=1 AND phase='open' " +
    'RETURNING id,phase,epoch,approved_worker_sha256,drain_token_hash,phase_changed_at,frozen_at'
  );
  if (rows.length !== 1 || rows[0]?.phase !== 'draining') {
    throw new Error('174 controller: begin-draining did not transition exactly one row');
  }
  return rows[0];
}

function reopen(config, approvedSha) {
  const now = Date.now();
  const rows = wrangler(config,
    'UPDATE explore_like_cutover_control_174 ' +
    "SET phase='open',epoch=epoch+1,approved_worker_sha256='',drain_token_hash=''," +
    'phase_changed_at=' + now + ',frozen_at=0 ' +
    "WHERE id=1 AND phase='draining' AND approved_worker_sha256=" + quote(approvedSha) + ' ' +
    'RETURNING id,phase,epoch,phase_changed_at'
  );
  if (rows.length !== 1 || rows[0]?.phase !== 'open') {
    throw new Error('174 controller: reopen is allowed only from matching draining state');
  }
  return rows[0];
}

function freeze(config, approvedSha) {
  const now = Date.now();
  // The D1 transition_guard trigger is the authority for queue-empty and
  // processor-idle. If either invariant is false, this UPDATE aborts atomically.
  const rows = wrangler(config,
    'UPDATE explore_like_cutover_control_174 ' +
    "SET phase='frozen',epoch=epoch+1,phase_changed_at=" + now + ',frozen_at=' + now + ' ' +
    "WHERE id=1 AND phase='draining' AND approved_worker_sha256=" + quote(approvedSha) + ' ' +
    'RETURNING id,phase,epoch,approved_worker_sha256,drain_token_hash,phase_changed_at,frozen_at'
  );
  if (rows.length !== 1 || rows[0]?.phase !== 'frozen') {
    throw new Error('174 controller: freeze did not transition exactly one row');
  }
  return rows[0];
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.action === 'observe') {
    const row = observe(options.config);
    console.log('174_CONTROL_OBSERVE=' + JSON.stringify({
      id: row.id,
      phase: row.phase,
      epoch: row.epoch,
      approvedWorkerSha256: row.approved_worker_sha256,
      phaseChangedAt: row.phase_changed_at,
      frozenAt: row.frozen_at,
      drainTokenHashPresent: validSha(row.drain_token_hash),
    }));
    return;
  }

  const workers = await verifyExactWorkers(options.approvedWorkerSha256);
  let row;
  if (options.action === 'begin-draining') row = beginDraining(options.config, options.approvedWorkerSha256);
  else if (options.action === 'reopen') row = reopen(options.config, options.approvedWorkerSha256);
  else row = freeze(options.config, options.approvedWorkerSha256);

  console.log('174_CONTROL_ACTION=' + options.action.toUpperCase().replaceAll('-', '_'));
  console.log('174_CONTROL_PHASE=' + row.phase);
  console.log('174_CONTROL_EPOCH=' + row.epoch);
  console.log('174_CONTROL_APPROVED_SHA=' + options.approvedWorkerSha256);
  console.log('174_CONTROL_WORKERS=' + JSON.stringify(
    Object.fromEntries(Object.entries(workers).map(([stage, value]) => [stage, value.versionId]))
  ));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(String(error?.message || error));
    process.exit(1);
  });
}
