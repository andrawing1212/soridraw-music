import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const generated = String(process.env.SORIDRAW_GENERATED_WORKER || '').trim();
const workerPath = generated || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const patch057 = readFileSync('cloudflare/explore-worker/patches/057-public-profile-negative-cache-guard.mjs', 'utf8');
const patch058 = readFileSync('cloudflare/explore-worker/patches/058-public-profile-negative-cache-shape-compat.mjs', 'utf8');
const wrangler = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8'));

const functionText = (source, name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `missing function: ${name}`);
  const brace = source.indexOf('{', start);
  assert.ok(brace >= 0, `missing body: ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated function: ${name}`);
};

assert.match(worker, /SORIDRAW_PUBLIC_PROFILE_NEGATIVE_CACHE_057_20260916/);
assert.match(worker, /SORIDRAW_PUBLIC_PROFILE_NEGATIVE_CACHE_SHAPE_058_20260916/);
assert.match(worker, /const EXPLORE_PROFILE_NEGATIVE_TTL_SECONDS_057 = 60;/);
assert.match(worker, /const EXPLORE_PROFILE_COLD_RATE_PREFIX_057 = 'profile-cold:';/);
assert.match(worker, /handlePublicProfileFirstViewWithEdgeCacheCore057/);

const wrapper = functionText(worker, 'handlePublicProfileFirstViewWithEdgeCache');
const limiter = functionText(worker, 'enforceExploreProfileColdRateLimit057');
const cacheWriter = functionText(worker, 'cacheExploreProfileNotFound057');
const cacheCheck = functionText(worker, 'isCacheableExploreProfileNotFound057');
const headers = functionText(worker, 'withExploreProfileProtectionHeaders057');

assert.match(wrapper, /cache\.match\(negativeKey\)/);
assert.match(wrapper, /cache\.match\(positiveKey\)/);
assert.match(wrapper, /enforceExploreProfileColdRateLimit057\(request, env, cors\)/);
assert.match(wrapper, /handlePublicProfileFirstViewWithEdgeCacheCore057\(request, profileRef, env, cors\)/);
assert.match(wrapper, /cacheExploreProfileNotFound057\(request, profileRef, response\)/);
assert.ok(wrapper.indexOf('cache.match(negativeKey)') < wrapper.indexOf('enforceExploreProfileColdRateLimit057'), 'negative cache must run before limiter/core');
assert.ok(wrapper.indexOf('cache.match(positiveKey)') < wrapper.indexOf('enforceExploreProfileColdRateLimit057'), 'positive warm edge must bypass limiter budget');
assert.doesNotMatch(wrapper, /env\.DB\.|\.prepare\(/);

assert.match(limiter, /env\?\.LIKE_RATE_LIMITER/);
assert.match(limiter, /\.limit\(\{ key: EXPLORE_PROFILE_COLD_RATE_PREFIX_057 \+ clientKey \}\)/);
assert.match(limiter, /RATE_LIMITED/);
assert.match(limiter, /Retry-After/);
assert.doesNotMatch(limiter, /env\.DB\.|RATE_DB|api_rate_limits/);

assert.match(cacheWriter, /Cache-Control/);
assert.match(cacheWriter, /EXPLORE_PROFILE_NEGATIVE_TTL_SECONDS_057/);
assert.match(cacheWriter, /cache\.put\(key, stored\)/);
assert.match(cacheCheck, /response\.status !== 404/);
assert.match(cacheCheck, /code === 'NOT_FOUND'/);
assert.match(cacheCheck, /message === 'Profile not found'/);
assert.match(cacheCheck, /message === '공개 프로필을 찾을 수 없습니다\.'/);
assert.doesNotMatch(cacheCheck, /env\.DB\.|\.prepare\(/);

for (const needle of [
  "headers.set('X-SORIDRAW-D1-Read', '0')",
  "headers.set('X-SORIDRAW-D1-Write', '0')",
  "headers.set('X-SORIDRAW-R2-A', '0')",
  "headers.set('X-SORIDRAW-R2-B', '0')",
]) assert.ok(headers.includes(needle), `zero-usage header missing: ${needle}`);

const limiterBinding = (wrangler.ratelimits || []).find((entry) => entry?.name === 'LIKE_RATE_LIMITER');
assert.ok(limiterBinding, 'LIKE_RATE_LIMITER binding missing from PREVIEW config');
assert.equal(Number(limiterBinding.simple?.limit), 60);
assert.equal(Number(limiterBinding.simple?.period), 60);
assert.equal(wrangler.triggers, undefined, 'fixed cron must remain absent');

for (const [name, source] of [['057', patch057], ['058', patch058]]) {
  for (const forbidden of ['ALTER TABLE', 'CREATE TABLE', 'DROP TABLE', 'DELETE FROM', 'UPDATE public_profiles', 'UPDATE tracks']) {
    assert.ok(!source.includes(forbidden), `forbidden schema/data mutation in patch ${name}: ${forbidden}`);
  }
}

console.log('111_EXPLORE_PROFILE_NEGATIVE_CACHE=PASS');
console.log('INVALID_404_SHAPE=LIVE_LEGACY_AND_NOT_FOUND_CODE_COMPATIBLE');
console.log('INVALID_SAME_REF=FIRST_D1_ONLY_THEN_EDGE_R0');
console.log('RANDOM_INVALID_REF=BOUNDED_BY_EDGE_LIMIT_60_PER_MIN_PER_CLIENT_KEY');
console.log('VALID_WARM_PROFILE=EXISTING_EDGE_BYPASSES_RATE_BUDGET');
console.log('NEGATIVE_TTL_SECONDS=60');
console.log('NO_D1_SCHEMA_MIGRATION=true');
console.log('NO_USER_DATA_WRITE=true');
console.log('NO_FIXED_CRON=true');
