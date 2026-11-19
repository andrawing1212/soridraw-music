import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp728DirectReleasePlan } from './app728-release-plan.mjs';

const ACCOUNT = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKERS = Object.freeze({
  previewExplore: 'soridraw-explore-preview',
  productionExplore: 'soridraw-explore-api',
  previewMedia: 'soridraw-media-preview',
  productionMedia: 'soridraw-media',
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isSha = (value) => /^[0-9a-f]{40}$/.test(String(value || ''));
function hashDist(root) {
  const entries = [];
  function collect(dir, prefix = '') {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      if (statSync(path).isDirectory()) collect(path, relative);
      else if (statSync(path).isFile()) entries.push([relative, sha256(readFileSync(path))]);
    }
  }
  collect(root);
  if (!entries.some(([name]) => name === 'index.html')) throw new Error('APP728 exact dist index missing');
  return sha256(JSON.stringify(entries));
}
const binding = (worker, name) => (worker?.bindings || []).find((item) => item.name === name);
const bindNames = (worker) => (worker?.bindings || []).map(({ name, type }) => `${name}:${type}`).sort();

// Fail closed: this is a read-only eligibility report, never a release approval.
export function assessApp728(facts) {
  const blockers = [];
  const hold = (code) => blockers.push(code);
  if (!isSha(facts.sourceSha) || facts.sourceSha !== facts.lockedPreviewSha) hold('SOURCE_SHA_NOT_LOCKED');
  if (!/^\d+$/.test(String(facts.sourceVersion || ''))) hold('SOURCE_VERSION_MISSING');
  if (!facts.previewHosting?.release || !facts.productionHosting?.release) hold('HOSTING_RELEASE_UNKNOWN');
  if (!facts.previewIndexHash || facts.previewIndexHash !== facts.builtIndexHash) hold('PREVIEW_BUILD_ARTIFACT_MISMATCH');
  if (String(facts.previewAppVersion) !== String(facts.sourceVersion)) hold('PREVIEW_APP_VERSION_MISMATCH');
  if (!facts.productionIndexHash) hold('PRODUCTION_HOSTING_SNAPSHOT_MISSING');

  const migrationTags = facts.canonical?.migrations?.map((x) => x.tag) || [];
  const classes = facts.canonical?.durable_objects?.bindings?.map((x) => x.class_name) || [];
  if (migrationTags.some((tag) => tag !== 'v1') || classes.includes('OwnerFollowerRecovery557')) {
    hold('UNRELEASED_OWNER_DO_V2_MIGRATION');
  }
  if (!classes.includes('ExploreLikeBatchScheduler103')) hold('LIKE_DO_CONTRACT_MISSING');

  for (const key of Object.keys(WORKERS)) {
    const worker = facts.workers?.[key];
    if (!worker || worker.name !== WORKERS[key] || !worker.activeVersion || worker.trafficPercent !== 100) {
      hold(`ACTIVE_WORKER_UNVERIFIED_${key}`);
    }
  }
  const p = facts.workers?.previewExplore;
  const d = facts.workers?.productionExplore;
  const pm = facts.workers?.previewMedia;
  const dm = facts.workers?.productionMedia;
  if (JSON.stringify(bindNames(p)) !== JSON.stringify(bindNames(d))) hold('EXPLORE_BINDING_SHAPE_DRIFT');
  for (const [key, worker] of [['previewExplore', p], ['productionExplore', d]]) {
    const db = binding(worker, 'DB');
    const media = binding(worker, 'PROFILE_MEDIA');
    if (db?.type !== 'd1' || !db.id || media?.type !== 'r2_bucket' || media.bucket !== 'soridraw-profile-media') {
      hold(`SHARED_CANONICAL_BINDING_MISMATCH_${key}`);
    }
  }
  if (binding(p, 'DB')?.id !== binding(d, 'DB')?.id) hold('SHARED_D1_ID_DRIFT');
  for (const [key, worker, expectedMedia] of [
    ['previewMedia', pm, 'soridraw-media-preview'],
    ['productionMedia', dm, 'soridraw-media'],
  ]) {
    if (binding(worker, 'CATALOG')?.type !== 'r2_bucket' || binding(worker, 'CATALOG')?.bucket !== 'soridraw-user-catalog' ||
      binding(worker, 'MEDIA')?.type !== 'r2_bucket' || binding(worker, 'MEDIA')?.bucket !== expectedMedia) {
      hold(`MEDIA_CATALOG_BINDING_MISMATCH_${key}`);
    }
  }
  if (p?.compatibilityDate !== d?.compatibilityDate) hold('EXPLORE_RUNTIME_DATE_DRIFT');
  // Full immutable code/binding identity and exercised restoration are NOT established by metadata GETs.
  // A later deployment controller must enforce those gates before an actual PRODUCTION mutation.
  hold('PREVIEW_PRODUCTION_BUNDLE_IDENTITY_NOT_PROVEN');
  hold('PRODUCTION_ROLLBACK_NOT_PROVEN');
  return { status: 'HOLD', blockers: [...new Set(blockers)] };
}

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required input: ${name}`);
  return value;
}
async function getJson(url, headers = {}) {
  const result = await fetch(url, { headers: { ...headers, 'Cache-Control': 'no-cache' } });
  if (!result.ok) throw new Error(`Read-only metadata unavailable: ${new URL(url).hostname}, HTTP ${result.status}`);
  return result.json();
}
export async function readWorker(name, token) {
  const root = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${name}`;
  const headers = { Authorization: `Bearer ${token}` };
  const [settingsResult, deploymentsResult] = await Promise.all([
    getJson(`${root}/settings`, headers),
    getJson(`${root}/deployments`, headers),
  ]);
  if (settingsResult.success === false || deploymentsResult.success === false) throw new Error(`Worker metadata denied: ${name}`);
  const settings = settingsResult.result || settingsResult;
  const deployments = deploymentsResult.result || deploymentsResult;
  const versions = deployments.deployments?.[0]?.versions || [];
  const active = versions.filter((v) => Number(v.percentage) >= 99.99);
  const activeVersion = active.length === 1 ? String(active[0].version_id || '') : '';
  const bindingInfo = (rows) => rows.map((v) => ({
    name: String(v.name || ''), type: String(v.type || ''),
    id: v.type === 'd1' ? String(v.id || v.database_id || '') : undefined,
    bucket: v.type === 'r2_bucket' ? String(v.bucket_name || v.bucket || '') : undefined,
    class_name: v.type === 'durable_object_namespace' ? String(v.class_name || '') : undefined,
    namespace_id: v.type === 'ratelimit' ? String(v.namespace_id || '') : undefined,
    service: v.type === 'service' ? String(v.service || v.service_name || '') : undefined,
    serviceEnvironment: v.type === 'service' ? String(v.environment || '') : undefined,
    plainHash: v.type === 'plain_text' && (v.text !== undefined || v.value !== undefined)
      ? sha256(Buffer.from(String(v.text ?? v.value ?? ''))) : undefined,
  }));
  const bindings = bindingInfo(Array.isArray(settings.bindings) ? settings.bindings : []);
  let pinnedBindingsVerified = false;
  let schedulesVerified = false;
  let schedules = [];
  let hasUnexpectedMigration = false;
  if (/^[0-9a-f-]{36}$/i.test(activeVersion)) {
    // Cloudflare beta Workers Versions API: inspect the ACTIVE version rather
    // than accidentally inheriting bindings from the newest inactive upload.
    try {
      const versionResult = await getJson(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/workers/${name}/versions/${activeVersion}`,
        headers,
      );
      if (versionResult.success === false) throw new Error('pinned-version access denied');
      const version = versionResult.result || versionResult;
      const rows = [version.bindings, version.resources?.bindings, version.metadata?.bindings, version.settings?.bindings]
        .find((value) => Array.isArray(value));
      if (rows && rows.length) {
        const pinned = bindingInfo(rows);
        const labels = (items) => items.map((v) => `${v.name}:${v.type}`).sort();
        pinnedBindingsVerified = JSON.stringify(labels(bindings)) === JSON.stringify(labels(pinned));
        if (pinnedBindingsVerified) {
          for (const original of bindings) {
            const actual = pinned.find((item) => item.name === original.name && item.type === original.type);
            // If typed identity is absent from either response, DO NOT treat the
            // pinned version as verified. A name/type match is insufficient.
            for (const prop of ['id', 'bucket', 'class_name', 'namespace_id', 'service', 'serviceEnvironment', 'plainHash']) {
              const left = original[prop];
              const right = actual[prop];
              if (left !== right) pinnedBindingsVerified = false;
            }
          }
        }
        hasUnexpectedMigration = pinned.some(x => /OwnerFollowerRecovery557/.test(x.class_name || x.name));
      }
    } catch {
      // Unsupported GET response or missing permission is HOLD, never a fallback
      // to mutable `latest` bindings or a reason to bypass version proof.
      pinnedBindingsVerified = false;
    }
  }
  try {
    const schedulesResult = await getJson(`${root}/schedules`, headers);
    if (schedulesResult.success === false) throw new Error('schedule read denied');
    const data = schedulesResult.result || schedulesResult;
    const list = Array.isArray(data) ? data : data?.schedules;
    if (!Array.isArray(list)) throw new Error('schedule structure unknown');
    schedules = list.map(x => ({ cron: String(x.cron || '') })).sort((a, b) => a.cron.localeCompare(b.cron));
    schedulesVerified = schedules.every(x => x.cron.length > 0);
  } catch {
    schedulesVerified = false;
  }
  return {
    name, activeVersion, trafficPercent: active.length === 1 ? Number(active[0].percentage) : 0,
    compatibilityDate: String(settings.compatibility_date || '').slice(0, 10),
    bindings, pinnedBindingsVerified, schedulesVerified, schedules, hasUnexpectedMigration,
  };
}
async function readHosting(site, token) {
  const payload = await getJson(`https://firebasehosting.googleapis.com/v1beta1/sites/${site}/channels/live/releases?pageSize=1`,
    { Authorization: `Bearer ${token}` });
  const entry = payload.releases?.[0];
  return { release: String(entry?.name || ''), version: String(entry?.version?.name || '') };
}
async function shaSiteIndex(url) {
  const resp = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'error' });
  if (resp.status !== 200) throw new Error(`Hosting index unavailable: ${new URL(url).hostname}, HTTP ${resp.status}`);
  return sha256(Buffer.from(await resp.arrayBuffer()));
}
async function versionFromSite(url) {
  const payload = await getJson(url);
  return String(payload?.version || '');
}
async function main() {
  const dir = resolve(requireEnv('APP728_SOURCE_DIR'));
  const sourceSha = requireEnv('APP728_SOURCE_SHA');
  const lockedPreviewSha = requireEnv('APP728_LOCKED_PREVIEW_SHA');
  const cfToken = requireEnv('CLOUDFLARE_API_TOKEN');
  const fbToken = requireEnv('FIREBASE_ACCESS_TOKEN');
  const canonical = JSON.parse(readFileSync(join(dir, 'cloudflare/explore-worker/canonical/wrangler.preview.jsonc'), 'utf8'));
  const sourceVersion = JSON.parse(readFileSync(join(dir, 'public/app-version.json'), 'utf8')).version;
  const builtIndexHash = sha256(readFileSync(join(dir, 'dist/index.html')));
  const distDigest = hashDist(join(dir, 'dist'));
  const [workerEntries, previewHosting, productionHosting, previewIndexHash, productionIndexHash, previewAppVersion] = await Promise.all([
    Promise.all(Object.entries(WORKERS).map(async ([key, name]) => [key, await readWorker(name, cfToken)])),
    readHosting('soridraw-preview', fbToken),
    readHosting('soridraw', fbToken),
    shaSiteIndex('https://soridraw-preview.web.app/'),
    shaSiteIndex('https://soridraw.web.app/'),
    versionFromSite('https://soridraw-preview.web.app/app-version.json'),
  ]);
  const workers = Object.fromEntries(workerEntries);
  const result = assessApp728({ sourceSha, lockedPreviewSha, sourceVersion, canonical, workers,
    previewHosting, productionHosting, previewIndexHash, productionIndexHash, builtIndexHash, previewAppVersion });
  const plan = buildApp728DirectReleasePlan({ sourceSha, lockedPreviewSha, distDigest, previewHosting, productionHosting, workers });
  const blockerCodes = [...new Set([...result.blockers, ...plan.blockerCodes])];
  const report = {
    code: 'APP728_READ_ONLY_PREFLIGHT', status: 'HOLD', sourceSha,
    planFingerprintSha256: plan.planFingerprintSha256,
    immutableRollbackTargets: plan.immutableRollbackTargets,
    proposedHostingVersion: plan.proposedPromotion.hosting,
    releaseExecutionEnabled: false,
    sourceVersion, previewHosting, productionHosting,
    versions: Object.fromEntries(Object.entries(workers).map(([key, value]) =>
      [key, { activeVersion: value.activeVersion, bindingCount: value.bindings.length, pinnedBindingsVerified: value.pinnedBindingsVerified, schedulesVerified: value.schedulesVerified }])),
    blockers: blockerCodes,
    testEnvironmentAccessed: false,
    mutationOperations: 0,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## APP728 direct release (READ ONLY): HOLD\n\n` +
      blockerCodes.map((x) => `- ${x}`).join('\n') + '\n\nTEST unchanged; no production changes.\n');
  }
  process.exitCode = 2; // expected HOLD, never false-green
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`APP728_PREFLIGHT_ERROR: ${String(error.message || error)}`);
    process.exitCode = 2;
  });
}
