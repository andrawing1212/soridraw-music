import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const path = 'cloudflare/explore-worker/canonical/preview-worker.js';
const source = readFileSync(path, 'utf8');

for (const marker of [
  'SORIDRAW_FOLLOW_EXACT_COUNT_AUTHORITY_347_20261004',
  'SORIDRAW_FOLLOW_EXACT_COUNT_GUARD_347_20261004',
]) assert.ok(source.includes(marker), 'missing ' + marker);

function functionText(name, prefix = 'async function ') {
  const start = source.indexOf(prefix + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, line = false, block = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}
const normalFunctionText = (name) => functionText(name, 'function ');

const code = [
  normalFunctionText('normalizeSharedFollowingState347'),
  functionText('syncExactSharedFollowing347'),
  functionText('writeSharedFollowing061'),
].join('\n');

class FakeObject {
  constructor(record) { this.record = record; this.etag = record.etag; }
  async text() { return this.record.body; }
}
class FakeBucket {
  constructor() { this.map = new Map(); this.seq = 0; }
  async get(key) {
    const row = this.map.get(key);
    return row ? new FakeObject(row) : null;
  }
  async put(key, body, options = {}) {
    const existing = this.map.get(key);
    const onlyIf = options.onlyIf || null;
    if (onlyIf?.etagMatches && existing?.etag !== onlyIf.etagMatches) return null;
    if (onlyIf?.etagDoesNotMatch === '*' && existing) return null;
    const etag = 'e' + (++this.seq);
    this.map.set(key, { body: String(body), etag, options });
    return { etag };
  }
  value(key) {
    const row = this.map.get(key);
    return row ? JSON.parse(row.body) : null;
  }
}

const bucket = new FakeBucket();
const keyOf = (uid) => 'following/' + uid;
const context = {
  console, JSON, Set, Map, Number, String, Boolean, Date,
  exploreSharedFollowingKey061: keyOf,
  readSharedSocialJson061: async (env, key) => {
    const obj = await env.PROFILE_MEDIA.get(key);
    if (!obj) return null;
    try { return JSON.parse(await obj.text()); } catch { return null; }
  },
};
vm.createContext(context);
vm.runInContext(code, context);
const sync = context.syncExactSharedFollowing347;
const writeLegacy = context.writeSharedFollowing061;
assert.equal(typeof sync, 'function');

const env = { PROFILE_MEDIA: bucket };
assert.equal(await sync(env, 'a', 'b', true, { following_count: 1, updated_at: 100 }, 1), true);
let state = bucket.value(keyOf('a'));
assert.equal(state.schemaVersion, 2);
assert.equal(state.exactFollowingCount347, 1);
assert.equal(state.followRevision347, 100);
assert.equal(state.canonicalCountComplete347, true);
assert.equal(state.membershipComplete347, true);
assert.deepEqual(state.followingUids, ['b']);

assert.equal(await sync(env, 'a', 'c', true, { following_count: 2, updated_at: 101 }, 1), true);
state = bucket.value(keyOf('a'));
assert.equal(state.exactFollowingCount347, 2);
assert.equal(state.followRevision347, 101);
assert.equal(state.membershipComplete347, true);
assert.deepEqual(new Set(state.followingUids), new Set(['b', 'c']));

assert.equal(await sync(env, 'a', 'b', false, { following_count: 0, updated_at: 100 }, -1), true);
state = bucket.value(keyOf('a'));
assert.equal(state.exactFollowingCount347, 2);
assert.equal(state.followRevision347, 101);
assert.deepEqual(new Set(state.followingUids), new Set(['b', 'c']));

assert.equal(await sync(env, 'a', 'b', false, { following_count: 1, updated_at: 102 }, -1), true);
state = bucket.value(keyOf('a'));
assert.equal(state.exactFollowingCount347, 1);
assert.equal(state.followRevision347, 102);
assert.equal(state.membershipComplete347, true);
assert.deepEqual(state.followingUids, ['c']);

const many = Array.from({ length: 5000 }, (_, i) => 'u' + i);
await bucket.put(keyOf('x'), JSON.stringify({ schemaVersion: 1, uid: 'x', followingUids: many, updatedAt: 1 }));
assert.equal(await sync(env, 'x', 'overflow', true, { following_count: 5001, updated_at: 200 }, 1), true);
state = bucket.value(keyOf('x'));
assert.equal(state.exactFollowingCount347, 5001);
assert.equal(state.canonicalCountComplete347, true);
assert.equal(state.membershipComplete347, false);
assert.equal(state.followingUids.length, 5000);

const before = JSON.stringify(state);
assert.equal(await writeLegacy(env, 'x', new Set(['wrong'])), false);
assert.equal(JSON.stringify(bucket.value(keyOf('x'))), before);

const adjust = functionText('adjustExploreFollowCountersDelta');
assert.doesNotMatch(adjust, /SORIDRAW_FOLLOW_COMBINED_COUNTERS_345/);
assert.doesNotMatch(adjust, /updated_at = MAX\(profile_stats\.updated_at \+ 1, excluded\.updated_at\)/);
assert.doesNotMatch(adjust, /updated_at = MAX\(updated_at \+ 1, \?\)/);

const fast = functionText('syncExploreFollowingR2AfterMutation');
assert.doesNotMatch(fast, /source: 'shared-347'/);

const core = functionText('handleFollowR2Core');
assert.match(core, /const followCutover348 = await readFollowCutoverState348\(env\)/);
assert.match(core, /followCutover348\.mode === "overlay348"[\s\S]*?handleFollowOverlay354/);
assert.doesNotMatch(core, /syncExactSharedFollowing347/);

console.log('FOLLOW347_EXACT_COUNT_MONOTONIC=PASS');
console.log('FOLLOW347_STALE_REVISION_NO_ROLLBACK=PASS');
console.log('FOLLOW347_TRUNCATED_MEMBERSHIP_NOT_FALSE_COMPLETE=PASS');
console.log('FOLLOW347_LEGACY_WRITER_FENCED=PASS');
console.log('FOLLOW347_LEGACY_SHARED_FASTPATH_REMOVED=PASS');
console.log('FOLLOW347_D1_AUTHORITY_HELPER_PRESERVED=PASS');
console.log('FOLLOW347_LEGACY_MUTATION_DEFERRED_TO_WORKER341_PARITY_GATE');
