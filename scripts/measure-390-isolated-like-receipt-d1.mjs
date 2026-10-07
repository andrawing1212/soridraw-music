// 390: isolated remote D1 proof for bounded like acceptance receipts.
// NEVER binds to the shared user database. Creates one synthetic D1 database
// per CI run and deletes it in finally + an always() workflow cleanup step.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { prove390 } from './lib/like-receipt-390-fixture.mjs';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const run = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
if (!/^[a-f0-9]{32}$/.test(account || '') || !token || !/^\d+$/.test(run || '') || !/^\d+$/.test(attempt)) {
  throw Error('390 requires CI token, account and numeric GitHub run/attempt');
}
const name = 'soridraw-like-receipt-390-' + run + '-' + attempt;
const record = join(process.env.RUNNER_TEMP || '/tmp', 'soridraw-390-temp-d1.json');
const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/d1/database';
const fail = (message) => { throw Error('390 ' + message); };

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
  console.log('390_EPHEMERAL_D1_DELETED=PASS');
}
if (process.argv[2] === 'cleanup') {
  await cleanup();
} else {
  let created = false;
  try {
    const db = await api('POST', '', { name, primary_location_hint: 'apac' });
    if (db?.name !== name || !/^[a-f0-9-]{36}$/.test(db.uuid || '')) fail('created DB metadata mismatch');
    await writeFile(record, JSON.stringify({ name, uuid: db.uuid }), { flag: 'wx', mode: 0o600 });
    created = true;
    console.log('390_EPHEMERAL_D1_CREATED=' + name);
    async function query(sql, params = []) {
      const rows = await api('POST', '/' + db.uuid + '/query', { sql, params });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.success !== true) fail('query did not return one success');
      return rows[0];
    }
    await prove390(query, { remote: true });
    console.log('390_SHARED_DATA_WRITES=0');
    console.log('390_DEPLOYMENTS=0');
  } finally { if (created) await cleanup(); }
}
