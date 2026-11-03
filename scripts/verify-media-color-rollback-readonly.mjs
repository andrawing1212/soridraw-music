// Read-only preflight for a color-compatible shared Media Worker rollback.
// This tool never deploys, rolls back, uploads, or changes user/catalog data.
// It requires independently attested source SHA + Cloudflare script etag for
// each candidate version. A source SHA alone cannot prove deployed byte identity.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const targets = {
  preview: { worker: 'soridraw-media-preview', media: 'soridraw-media-preview' },
  test: { worker: 'soridraw-media-test', media: 'soridraw-media-test' },
  production: { worker: 'soridraw-media', media: 'soridraw-media' },
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha40 = /^[a-f0-9]{40}$/i;
const scriptHash = /^[a-f0-9]{32,128}$/i;

export const sourceProtectsLibraryColors = (source) => {
  const start = source.indexOf('const LIBRARY_CATALOG_FIELDS');
  const stop = source.indexOf('];', start);
  const section = start >= 0 && stop > start ? source.slice(start, stop + 2) : '';
  return section.includes("'colorTags'") && section.includes("'favoriteColorTags'")
    && source.includes('const preserveExistingLibrarySwatches')
    && source.includes('existingLibraryColorRowsForDelta')
    && source.includes('!Object.prototype.hasOwnProperty.call(incoming, key)')
    && source.includes('!sanitizedDeletedIds.has(id)');
};

export const assessMediaColorRollback = (plan, observations, source) => {
  const errors = [];
  if (!plan || typeof plan !== 'object' || !plan.accountId || !plan.rollbackSourceSha
    || !sha40.test(plan.rollbackSourceSha) || !sourceProtectsLibraryColors(source)) {
    errors.push('ROLLBACK_SOURCE_UNATTESTED_OR_UNSAFE');
  }
  const entries = plan?.environments || {};
  const identitySet = new Set();
  for (const [stage, target] of Object.entries(targets)) {
    const approved = entries[stage];
    const observed = observations?.[stage];
    if (!approved || !observed) {
      errors.push(stage + ':MISSING_VERSION_EVIDENCE');
      continue;
    }
    if (approved.worker !== target.worker || observed.worker !== target.worker
      || observed.accountId !== plan.accountId) {
      errors.push(stage + ':ACCOUNT_OR_WORKER_MISMATCH');
    }
    const active = observed.activeVersions;
    if (!Array.isArray(active) || active.length !== 1
      || Number(active[0]?.percentage) !== 100
      || active[0].versionId !== approved.activeVersionId) {
      errors.push(stage + ':ACTIVE_VERSION_OR_TRAFFIC_DRIFT');
    }
    if (!uuid.test(approved.rollbackVersionId || '')
      || !uuid.test(approved.activeVersionId || '')
      || approved.rollbackVersionId === approved.activeVersionId) {
      errors.push(stage + ':ROLLBACK_VERSION_UNPINNED');
    }
    if (!scriptHash.test(approved.rollbackScriptEtag || '')
      || observed.rollbackVersionId !== approved.rollbackVersionId
      || observed.rollbackScriptEtag !== approved.rollbackScriptEtag) {
      errors.push(stage + ':ROLLBACK_ARTIFACT_ETAG_UNVERIFIED');
    }
    if (observed.catalogBucket !== 'soridraw-user-catalog'
      || observed.mediaBucket !== target.media
      || observed.sharedCatalogFlag !== '1') {
      errors.push(stage + ':CATALOG_BINDING_OR_FLAG_DRIFT');
    }
    // The declaration must correspond to an independently code-reviewed
    // uploaded fallback; it is NOT enough for a version to merely exist.
    if (approved.attestedSourceSha !== plan.rollbackSourceSha) {
      errors.push(stage + ':ROLLBACK_SOURCE_ATTESTATION_MISMATCH');
    }
    identitySet.add(approved.attestedSourceSha);
  }
  if (identitySet.size !== 1) errors.push('FALLBACK_SOURCE_DRIFT_ACROSS_ENVIRONMENTS');
  return { ready: errors.length === 0, errors };
};

const checkLiveReadOnly = async (plan) => {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '');
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '');
  if (!/^[0-9a-f]{32}$/i.test(accountId) || accountId !== plan.accountId || !token) {
    throw new Error('READ_ONLY_CLOUDFLARE_ACCOUNT_AND_TOKEN_REQUIRED');
  }
  const root = 'https://api.cloudflare.com/client/v4/accounts/' + accountId;
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  async function get(path) {
    const response = await fetch(root + path, { method: 'GET', headers, redirect: 'error' });
    if (!response.ok) throw new Error('CLOUDFLARE_READ_FAILED_HTTP_' + response.status);
    const json = await response.json();
    if (!json?.success) throw new Error('CLOUDFLARE_READ_FAILED');
    return json.result;
  }
  const observations = {};
  for (const [stage, { worker }] of Object.entries(targets)) {
    const w = encodeURIComponent(worker);
    const [deployments, details, settings] = await Promise.all([
      get('/workers/scripts/' + w + '/deployments'),
      get('/workers/scripts/' + w + '/versions/' + plan.environments[stage].rollbackVersionId),
      get('/workers/scripts/' + w + '/settings'),
    ]);
    const current = (deployments?.deployments || deployments || [])[0];
    const bindings = Array.isArray(settings?.bindings) ? settings.bindings : [];
    const r2 = (name) => bindings.find(b => b?.name === name && b?.type === 'r2_bucket');
    const plain = (name) => bindings.find(b => b?.name === name && b?.type === 'plain_text');
    const activeVersions = (current?.versions || []).map(v => ({
      versionId: v.version_id, percentage: Number(v.percentage),
    }));
    observations[stage] = {
      worker, accountId,
      activeVersions,
      rollbackVersionId: details?.id,
      rollbackScriptEtag: details?.resources?.script?.etag,
      catalogBucket: r2('CATALOG')?.bucket_name || r2('CATALOG')?.bucket,
      mediaBucket: r2('MEDIA')?.bucket_name || r2('MEDIA')?.bucket,
      sharedCatalogFlag: String(plain('SORIDRAW_SHARED_CATALOG_V1')?.text
        ?? plain('SORIDRAW_SHARED_CATALOG_V1')?.value ?? ''),
    };
  }
  return observations;
};

// One bounded read-only snapshot of all currently active Media Workers.
// No release manifest or historical source-code assumption is needed here.
const reportLiveMediaWorkerVersions = async () => {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!/^[0-9a-f]{32}$/i.test(accountId) || !token) {
    throw new Error('LIVE_MEDIA_READ_ONLY_CREDENTIALS_UNAVAILABLE');
  }
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  const root = 'https://api.cloudflare.com/client/v4/accounts/' + accountId;
  const get = async (path) => {
    const response = await fetch(root + path, { method: 'GET', headers, redirect: 'error' });
    if (!response.ok) throw new Error('LIVE_MEDIA_READ_ONLY_HTTP_' + response.status);
    const payload = await response.json();
    if (!payload?.success) throw new Error('LIVE_MEDIA_READ_ONLY_RESPONSE_UNAVAILABLE');
    return payload.result;
  };
  const summaries = {};
  for (const [stage, target] of Object.entries(targets)) {
    const name = encodeURIComponent(target.worker);
    const [deployments, settings] = await Promise.all([
      get('/workers/scripts/' + name + '/deployments?per_page=4'),
      get('/workers/scripts/' + name + '/settings'),
    ]);
    const first = (deployments?.deployments || [])[0];
    const versions = first?.versions;
    if (!Array.isArray(versions) || versions.length !== 1
      || Number(versions[0].percentage) !== 100 || !uuid.test(versions[0].version_id)) {
      throw new Error(stage + ':ACTIVE_MEDIA_VERSION_UNCERTAIN_OR_TRAFFIC_SPLIT');
    }
    const bindings = settings?.bindings || [];
    const binding = (key, type) => bindings.find(v => v?.name === key && v?.type === type);
    const catalog = binding('CATALOG', 'r2_bucket');
    const media = binding('MEDIA', 'r2_bucket');
    const shared = binding('SORIDRAW_SHARED_CATALOG_V1', 'plain_text');
    const summary = {
      worker: target.worker,
      activeVersionId: versions[0].version_id,
      activePercent: versions[0].percentage,
      activeDeploymentTime: first?.created_on || 'unknown',
      catalog: catalog?.bucket_name ?? catalog?.bucket ?? 'unknown',
      media: media?.bucket_name ?? media?.bucket ?? 'unknown',
      sharedCatalogFlag: String(shared?.text ?? shared?.value ?? 'unknown'),
      previousDeploymentVersionIds: (deployments?.deployments || []).slice(1, 4)
        .flatMap(d => (d?.versions || []).map(v => v.version_id)),
    };
    summaries[stage] = summary;
    console.log('READ_ONLY_MEDIA_' + stage.toUpperCase() + '=' + JSON.stringify(summary));
  }
  const safe = Object.entries(summaries).every(([stage, item]) => (
    item.catalog === 'soridraw-user-catalog'
    && item.media === targets[stage].media && item.sharedCatalogFlag === '1'
  ));
  if (!safe) throw new Error('LIVE_MEDIA_SHARED_CATALOG_OR_BINDINGS_DRIFT');
  console.log('LIVE_MEDIA_CURRENT_DEPLOYMENTS_READ_ONLY=PASS');
  console.log('LIVE_MEDIA_COLOR_COMPATIBLE_ROLLBACK=NOT_ATTESTED');
};

const runSelfTest = () => {
  const source = readFileSync('cloudflare/media-worker/src/index.js', 'utf8');
  assert.ok(sourceProtectsLibraryColors(source));
  assert.equal(sourceProtectsLibraryColors(source.replace("'favoriteColorTags'", "'notColor'")), false);
  const ids = ['11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'];
  const fallbackIds = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
  const attestedSource = '6'.repeat(40);
  const etag = 'a'.repeat(64);
  const accountId = 'd'.repeat(32);
  const plan = {
    accountId, rollbackSourceSha: attestedSource, environments: {},
  };
  const observations = {};
  Object.entries(targets).forEach(([stage,t],i) => {
    plan.environments[stage] = {
      worker: t.worker, activeVersionId: ids[i], rollbackVersionId: fallbackIds[i],
      rollbackScriptEtag: etag, attestedSourceSha: attestedSource,
    };
    observations[stage] = {
      worker: t.worker, accountId,
      activeVersions: [{versionId:ids[i],percentage:100}],
      rollbackVersionId:fallbackIds[i],rollbackScriptEtag:etag,
      catalogBucket:'soridraw-user-catalog',mediaBucket:t.media,sharedCatalogFlag:'1',
    };
  });
  assert.equal(assessMediaColorRollback(plan, observations, source).ready, true);
  observations.preview.activeVersions[0].percentage = 99;
  assert.equal(assessMediaColorRollback(plan, observations, source).ready, false);
  observations.preview.activeVersions[0].percentage = 100;
  observations.production.rollbackScriptEtag = 'b'.repeat(64);
  assert.equal(assessMediaColorRollback(plan, observations, source).ready, false);
  observations.production.rollbackScriptEtag = etag;
  plan.environments.test.attestedSourceSha = '7'.repeat(40);
  assert.equal(assessMediaColorRollback(plan, observations, source).ready, false);
  // No live requests or writes in the self-test.
  console.log('MEDIA_COLOR_ROLLBACK_READ_ONLY_PREFLIGHT_SELF_TEST=PASS');
};

if (process.argv[1]?.endsWith('verify-media-color-rollback-readonly.mjs')) {
  if (process.argv[2] === '--self-test') {
    runSelfTest();
  } else if (process.argv[2] === '--live-versions') {
    await reportLiveMediaWorkerVersions();
  } else {
    const file = process.argv[2];
    if (!file) throw new Error('USAGE: node scripts/verify-media-color-rollback-readonly.mjs <attested-manifest.json>');
    const plan = JSON.parse(readFileSync(file, 'utf8'));
    const source = execFileSync('git', ['show',
      plan.rollbackSourceSha + ':cloudflare/media-worker/src/index.js'],
      { encoding:'utf8', maxBuffer:8 * 1024 * 1024 });
    const observations = await checkLiveReadOnly(plan);
    const result = assessMediaColorRollback(plan, observations, source);
    console.log('MEDIA_COLOR_ROLLBACK_PREFLIGHT=' + (result.ready ? 'READY_FOR_INDEPENDENT_RELEASE_REVIEW' : 'HOLD'));
    for (const error of result.errors) console.log('HOLD=' + error);
    if (!result.ready) process.exitCode = 2;
    // Even READY does not authorize upload, activation, restore or data writes.
  }
}
