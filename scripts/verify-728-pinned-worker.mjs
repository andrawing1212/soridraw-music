import assert from 'node:assert/strict';
import { readWorker } from './app728-direct-preflight.mjs';

const id = '350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const name = 'soridraw-explore-preview';
const baseline = [
  { name: 'DB', type: 'd1', id: 'shared-d1' },
  { name: 'PROFILE_MEDIA', type: 'r2_bucket', bucket_name: 'shared-profile' },
  { name: 'SECRET', type: 'secret_text' },
  { name: 'SORIDRAW_ENVIRONMENT', type: 'plain_text', text: 'preview' },
  { name: 'EXPLORE_LIKE_BATCH_SCHEDULER', type: 'durable_object_namespace', class_name: 'ExploreLikeBatchScheduler103' },
];
function fakeServer({ pinned = baseline, live = baseline, failPinned = false, schedules = [{ cron: '37 * * * *' }] } = {}) {
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' });
    const result = String(url).endsWith('/settings')
      ? { bindings: live, compatibility_date: '2026-08-28' }
      : String(url).endsWith('/deployments')
        ? { deployments: [{ versions: [{ percentage: 100, version_id: id }] }] }
        : String(url).endsWith('/schedules')
          ? { schedules }
          : String(url).endsWith(`/versions/${id}`)
            ? { bindings: pinned }
            : null;
    assert(result, `unknown request: ${url}`);
    return { ok: !failPinned || !String(url).includes('/versions/'), status: failPinned && String(url).includes('/versions/') ? 403 : 200,
      json: async () => ({ success: true, result }) };
  };
  return requests;
}
const oldFetch = globalThis.fetch;
try {
  const calls = fakeServer();
  const normal = await readWorker(name, 'synthetic-test-only-token');
  assert.equal(normal.activeVersion, id);
  assert.equal(normal.pinnedBindingsVerified, true);
  assert.equal(normal.schedulesVerified, true);
  assert.equal(normal.bindings.length, 5);
  assert(calls.every(c => c.method === 'GET'));
  assert(calls.some(c => c.url.endsWith(`/versions/${id}`)));
  assert(!calls.some(c => c.url.includes('latest')));

  const changed = baseline.map(x => ({ ...x })); changed[0].id = 'wrong';
  fakeServer({ pinned: changed });
  assert.equal((await readWorker(name, 'synthetic-test-only-token')).pinnedBindingsVerified, false);
  fakeServer({ pinned: baseline.filter(x => x.name !== 'SECRET') });
  assert.equal((await readWorker(name, 'synthetic-test-only-token')).pinnedBindingsVerified, false);
  fakeServer({ pinned: baseline.map(x => x.name === 'SORIDRAW_ENVIRONMENT' ? { ...x, text: 'production' } : x) });
  assert.equal((await readWorker(name, 'synthetic-test-only-token')).pinnedBindingsVerified, false);
  fakeServer({ failPinned: true });
  assert.equal((await readWorker(name, 'synthetic-test-only-token')).pinnedBindingsVerified, false);
  fakeServer({ schedules: null });
  assert.equal((await readWorker(name, 'synthetic-test-only-token')).schedulesVerified, false);
  console.log('APP728_PINNED_LIVE_BINDINGS_SYNTHETIC=PASS (exact version, GET only, drift and missing metadata HOLD)');
} finally {
  globalThis.fetch = oldFetch;
}
