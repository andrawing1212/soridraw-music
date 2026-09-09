import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const requiredTables = ['explore_derived_state', 'explore_derived_changes', 'explore_derived_tracks', 'explore_derived_profiles'];
const migration = readFileSync(new URL('../migrations/20260910_01_explore_derived_state.sql', import.meta.url), 'utf8');
export const requiredTriggers = [...migration.matchAll(/CREATE TRIGGER IF NOT EXISTS (explore032_\w+)/g)].map(match => match[1]);
if (!requiredTriggers.length) throw new Error('D1 preflight: required trigger manifest is empty');
const schemaSql = `SELECT type,name FROM sqlite_schema WHERE type IN ('table','trigger') AND name IN (${[...requiredTables,...requiredTriggers].map(name => "'"+name+"'").join(',')})`;
const seedSql = 'SELECT seeded FROM explore_derived_state WHERE id=1';

function runWrangler(args, capture = false) {
  // Use Node directly: SQL stays a single argument on Windows as well as Linux.
  const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
  const result = spawnSync(process.execPath, [cli,...args], {
    encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', env: process.env,
  });
  if (result.error || result.status !== 0) throw new Error(`Worker ${capture ? 'D1 preflight query' : 'deploy'} failed: ${result.error?.message || result.stderr || result.status}`);
  return result.stdout;
}

export function assertDerivedD1Ready(configPath, run = runWrangler) {
  const config = resolve(configPath);
  const query = sql => {
    const raw = run(['d1','execute','DB','--remote','--config',config,'--command',sql,'--json'],true);
    let response;
    try { response = JSON.parse(raw); } catch { throw new Error('D1 preflight: invalid query response'); }
    if (!Array.isArray(response) || response.length !== 1 || response[0]?.success !== true || !Array.isArray(response[0].results))
      throw new Error('D1 preflight: unsuccessful query response');
    return response[0].results;
  };
  const schema = query(schemaSql);
  const missing = [...requiredTables.filter(name => !schema.some(row => row.type==='table' && row.name===name)),
    ...requiredTriggers.filter(name => !schema.some(row => row.type==='trigger' && row.name===name))];
  if (missing.length) throw new Error('D1 preflight: missing '+missing.join(', '));
  const state = query(seedSql);
  if (state.length !== 1 || state[0].seeded !== 1) throw new Error('D1 preflight: seeded must equal 1');
}

export function deployWithDerivedPreflight(configPath, run = runWrangler) {
  const config = resolve(configPath);
  assertDerivedD1Ready(config,run);
  return run(['deploy','--strict','--config',config]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--config') throw new Error('Usage: derived-deploy-preflight.mjs --config <prepared config>');
  deployWithDerivedPreflight(args[1]);
}
