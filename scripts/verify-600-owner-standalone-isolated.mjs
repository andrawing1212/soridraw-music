// APP600 in-memory-only isolated Worker+DO tests. No remote dependencies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  APP600_OWNER_WORKER_COMPILED_OPEN, handleOwnerWorker600,
  createOwnerDoService600, replayThroughService600,
} from '../cloudflare/owner-follow-worker/worker.mjs';

const candidate = JSON.parse(readFileSync(
  new URL('../cloudflare/owner-follow-worker/wrangler.candidate.jsonc', import.meta.url), 'utf8'));
assert.equal(candidate.name, 'soridraw-owner-follow-preview-candidate');
assert.equal(candidate.workers_dev, false);
assert.deepEqual(candidate.triggers?.crons, []);
assert.deepEqual(candidate.migrations, [{tag: 'owner600_v1',
  new_sqlite_classes: ['OwnerFollowerStandalone600']}]);
assert.deepEqual(candidate.durable_objects.bindings,
  [{name: 'OWNER_FOLLOW_DO_600', class_name: 'OwnerFollowerStandalone600'}]);
assert.deepEqual(Object.keys(candidate.vars), ['SORIDRAW_ENVIRONMENT']);
for (const forbidden of ['d1_databases', 'r2_buckets', 'services', 'routes',
  'secrets', 'route', 'zone_id', 'keep_vars'])
  assert.equal(candidate[forbidden], undefined, forbidden);
assert.equal(APP600_OWNER_WORKER_COMPILED_OPEN, false);
console.log('APP600_SEPARATE_WORKER_CONFIG_INERT_NO_SHARED_BINDINGS=PASS');

let clock = 1810000000000, writes = 0, alarms = 0, outbound = 0;
const secret = 'standalone600_local-only-test-secret_1234567890';
const env = {
  SORIDRAW_ENVIRONMENT: 'preview', SORIDRAW_OWNER_DO_STANDALONE_600: '1',
  SORIDRAW_OWNER_FOLLOW_W2_PUSH_555: '1',
  SORIDRAW_OWNER_DO_BRIDGE_SECRET_600: secret,
};
const memory = new Map(); let scheduled = null;
const storage = {
  async get(k) { return structuredClone(memory.get(k)); },
  async put(k, v) { writes++; memory.set(k, structuredClone(v)); },
  async delete(k) { writes++; memory.delete(k); },
  async getAlarm() { return scheduled; },
  async setAlarm(at) { alarms++; scheduled = at; },
};
const state = {storage};
const deliveredEvents = [];
let replayStatus = () => ({status: 200, body: {status: 'delivered', deliveredRevision: 22}});
env.OWNER_FOLLOW_CANONICAL_REPLAY_600 = {
  async fetch(req) {
    outbound++;
    assert.equal(new URL(req.url).hostname, 'owner-follow.internal');
    assert.equal(new URL(req.url).pathname, '/owner-follow/replay557-internal');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.get('X-Soridraw-Owner-Bridge-600'), secret);
    const ticket = await req.json();
    deliveredEvents.push(ticket);
    const result = replayStatus(ticket);
    return Response.json(result.body, {status: result.status});
  },
};
const doService = createOwnerDoService600({state, env, enabled: true,
  now: () => clock});
const doNames = [];
env.OWNER_FOLLOW_DO_600 = {
  idFromName(name) { doNames.push(name); return name; },
  get() { return {fetch: request => doService.fetch(request)}; },
};
const url = 'https://owner-follow.internal/internal/owner-follow/reserve600';
const make = (operationId = 'op_1234567890abcdef', extras = {}) => ({
  ownerUid: 'A', actorUid: 'B', operationId,
  cutoverToken: 'synthetic-cutover', authEpoch: 'a'.repeat(32),
  desired: true, beforeFollowing: false, expectedRevision: 0, priorR2Revision: 20,
  ...extras,
});
const call = (ticket, {key = secret, enabled = true, method = 'POST', path = url,
  json = null} = {}) => handleOwnerWorker600(new Request(path, {
  method, headers: {['X-Soridraw-Owner-Bridge-600']: key},
  ...(method !== 'POST' ? {} : {body: json ?? JSON.stringify(ticket)}),
}), env, {enabled});
const runAlarm = async () => {
  if (scheduled !== null) clock = Math.max(clock, scheduled);
  scheduled = null;
  return doService.alarm();
};

const baseline = writes;
assert.equal((await handleOwnerWorker600(new Request(url, {method: 'POST',
  headers: {'X-Soridraw-Owner-Bridge-600': secret},body: JSON.stringify(make())}), env)).status, 503);
assert.equal((await call(make(), {enabled: false})).status, 503);
assert.equal(writes, baseline);
console.log('APP600_COMPILED_OFF_NO_DO_WRITE=PASS');

assert.equal((await call(make(), {key: 'wrong'})).status, 403);
assert.equal((await call(make(), {method: 'GET'})).status, 404);
assert.equal((await call(make(), {path: 'https://owner-follow.internal/public/follow'})).status, 404);
assert.equal((await call(make(), {json: '{bad'})).status, 400);
assert.equal((await call(make(), {json: 'x'.repeat(1025)})).status, 413);
assert.equal((await call(make(), {json: JSON.stringify({...make(), ownerUid: '../../A'})})).status, 400);
assert.equal(writes, baseline);
console.log('APP600_PRIVATE_BOUNDARY_BAD_SECRET_ROUTE_PAYLOAD_NO_WRITE=PASS');

const first = await call(make());
assert.equal(first.status, 200);
assert.equal((await first.json()).status, 'reserved');
assert.deepEqual(doNames, ['A']);
assert.equal(writes, 1);
assert.equal(alarms, 1);
const duplicate = await call(make());
assert.equal((await duplicate.json()).status, 'already-reserved');
assert.equal(writes, 1);
assert.equal(alarms, 1);
assert.equal((await call(make('op_1234567890abcdef', {expectedRevision: 2}))).status, 503);
assert.equal(writes, 1);
assert.equal((await call(make('op_234567890abcdef', {authEpoch: 'b'.repeat(32)}))).status, 503);
assert.equal(writes, 1);
assert.equal((await call(make('op_34567890abcdef12', {desired: false}))).status, 503);
assert.equal(writes, 1);
console.log('APP600_DURABLE_RESERVATION_DEDUPE_GENERATION_GUARD=PASS');

let result = await runAlarm();
assert.equal(result.status, 'delivered');
assert.equal(memory.has('pending'), false);
assert.equal(deliveredEvents.length, 1);
assert.equal(outbound, 1);
assert.equal(deliveredEvents[0].operationId, 'op_1234567890abcdef');
console.log('APP600_ALARM_SERVICE_BINDING_DELIVERY_ACK=PASS');

let attempt = 0;
replayStatus = () => ++attempt === 1
  ? {status: 200, body: {ok: true}} :
    attempt === 2 ? {status: 503, body: {status: 'delivered'}} :
      {status: 200, body: {status: 'delivered', deliveredRevision: 23}};
assert.equal((await call(make('op_4567890abcdef123', {expectedRevision: 1}))).status, 200);
assert.equal((await runAlarm()).status, 'retry-scheduled');
assert.equal(memory.get('pending').entries[0].attempts, 1);
const restarted = createOwnerDoService600({state, env, enabled: true, now: () => clock});
clock = Math.max(clock, scheduled); scheduled = null;
assert.equal((await restarted.alarm()).status, 'retry-scheduled');
assert.equal(memory.get('pending').entries[0].attempts, 2);
clock = Math.max(clock, scheduled); scheduled = null;
assert.equal((await restarted.alarm()).status, 'delivered');
assert.equal(memory.has('pending'), false);
console.log('APP600_UNKNOWN_ACK_TRANSIENT_RESTART_RETRY_PRESERVES_TICKET=PASS');

replayStatus = () => ({status: 409, body: {status: 'rejected-generation'}});
assert.equal((await call(make('op_567890abcdef1234', {expectedRevision: 2}))).status, 200);
assert.equal((await runAlarm()).status, 'rejected-generation');
assert.equal(memory.has('pending'), false);
console.log('APP600_AUTH_EPOCH_TERMINAL_REJECTION=PASS');

delete env.OWNER_FOLLOW_CANONICAL_REPLAY_600;
assert.equal((await call(make('op_67890abcdef12345', {expectedRevision: 3}))).status, 200);
const before = outbound;
assert.equal((await runAlarm()).status, 'retry-scheduled');
assert.equal(outbound, before);
assert.equal(memory.get('pending').entries[0].attempts, 1);
console.log('APP600_MISSING_CALLBACK_FAIL_CLOSED_NO_EXTERNAL_FETCH=PASS');

assert.deepEqual(await replayThroughService600({reservation: make(), env}), {status: 'relay-failed'});
const old = env.SORIDRAW_ENVIRONMENT;
env.SORIDRAW_ENVIRONMENT = 'production';
const persisted = writes;
assert.equal((await call(make('op_7890abcdef123456'))).status, 503);
assert.equal((await doService.alarm()).status, 'disabled');
assert.equal(writes, persisted);
env.SORIDRAW_ENVIRONMENT = old;
console.log('APP600_PRODUCTION_ISOLATION_NO_MUTATION=PASS');
