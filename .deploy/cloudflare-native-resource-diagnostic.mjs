import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WORKER_DIR = join(ROOT, 'cloudflare', 'explore-worker');
const OUT = join(ROOT, '.tmp-cloudflare-native-diagnostic');
mkdirSync(OUT, { recursive: true });

const run = (args) => {
  const r = spawnSync('npx', ['wrangler', ...args], {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`wrangler ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').slice(-4000)}`);
  return String(r.stdout || '').trim();
};
const parse = (text) => {
  try { return JSON.parse(text); } catch {}
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((n) => n >= 0);
  if (!starts.length) throw new Error('JSON output not found');
  return JSON.parse(text.slice(Math.min(...starts)));
};

const d1Raw = parse(run(['d1', 'list', '--json']));
const d1Rows = Array.isArray(d1Raw) ? d1Raw : (d1Raw?.result || []);
const d1 = d1Rows.map((row) => ({
  name: String(row?.name || ''),
  id: String(row?.uuid || row?.id || row?.database_id || ''),
})).filter((row) => row.name);

let r2 = [];
try {
  const r2Raw = parse(run(['r2', 'bucket', 'list', '--json']));
  const rows = Array.isArray(r2Raw) ? r2Raw : (r2Raw?.result || r2Raw?.buckets || []);
  r2 = rows.map((row) => ({ name: String(row?.name || row?.bucket_name || '') })).filter((row) => row.name);
} catch (error) {
  r2 = [{ name: `R2_LIST_ERROR:${String(error?.message || error).slice(0, 240)}` }];
}

const payload = {
  ok: true,
  workersCi: String(process.env.WORKERS_CI || ''),
  branch: String(process.env.WORKERS_CI_BRANCH || ''),
  commitSha: String(process.env.WORKERS_CI_COMMIT_SHA || process.env.COMMIT_SHA || ''),
  d1: d1.filter((row) => row.name.startsWith('soridraw-explore')),
  r2: r2.filter((row) => row.name.startsWith('soridraw-') || row.name.startsWith('R2_LIST_ERROR:')),
};

const main = join(OUT, 'worker.js');
writeFileSync(main, `const payload=${JSON.stringify(payload)}; export default { async fetch(){ return Response.json(payload); } };\n`, 'utf8');
const config = join(OUT, 'wrangler.jsonc');
writeFileSync(config, JSON.stringify({
  name: 'soridraw-explore-ci-diagnostic',
  main: './worker.js',
  compatibility_date: '2026-08-28',
  workers_dev: true,
}, null, 2) + '\n', 'utf8');
run(['deploy', '--config', config]);
console.log('SORIDRAW_CLOUDFLARE_NATIVE_DIAGNOSTIC_DEPLOYED=true');
