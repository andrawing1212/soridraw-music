import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');

for (const token of [
  'SORIDRAW_PUBLIC_PROFILE_WARM_EDGE_ZERO_READ_063_20260917',
  'handlePublicProfileFirstViewWithEdgeCacheCore063',
  'NOT_MODIFIED_EDGE_063',
  'FULL_EDGE_063',
]) {
  assert.ok(worker.includes(token), `063 missing: ${token}`);
}

function functionBody(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
}

const outer = functionBody(worker, 'handlePublicProfileFirstViewWithEdgeCache');
assert.match(outer, /const cached = await cache\.match\(key\)/);
assert.match(outer, /withExploreZeroUsageOnEdgeHit/);
assert.match(outer, /return await handlePublicProfileFirstViewWithEdgeCacheCore063\(/);
for (const forbidden of [
  'env.DB.prepare',
  'readPublicProfileFirstViewRow',
  'readMaterializedSharedProfile060',
  'materializePublicProfileFirstView',
]) {
  assert.ok(!outer.includes(forbidden), `063 outer warm handler must not contain ${forbidden}`);
}

const cachedIndex = outer.indexOf('const cached = await cache.match(key)');
const directIndex = outer.indexOf('withExploreZeroUsageOnEdgeHit', cachedIndex);
const coreIndex = outer.lastIndexOf('return await handlePublicProfileFirstViewWithEdgeCacheCore063(');
assert.ok(cachedIndex >= 0 && directIndex > cachedIndex && coreIndex > directIndex, '063 must return Edge hit before core fallback');

console.log('VERIFY_063_PUBLIC_PROFILE_WARM_EDGE_ZERO_READ=PASS');
console.log('Invariant: positive public-profile Edge hit returns before shared/materialized/D1 fallback layers.');
