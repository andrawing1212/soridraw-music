// APP728: GET-only active Worker code provenance. Never log raw Worker source,
// decoded modules, credentials, or any value from Cloudflare responses.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ACCOUNT = 'e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKERS = Object.freeze({
  previewExplore: 'soridraw-explore-preview',
  productionExplore: 'soridraw-explore-api',
  previewMedia: 'soridraw-media-preview',
  productionMedia: 'soridraw-media',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
const SOURCE_FILES = {
  previewExplore: 'cloudflare/explore-worker/canonical/preview-entry.js',
  productionExplore: 'cloudflare/explore-worker/canonical/preview-entry.js',
  previewMedia: 'cloudflare/media-worker/src/index.js',
  productionMedia: 'cloudflare/media-worker/src/index.js',
};
const markers = Object.freeze({
  followMutation: ['follow', '/v1/profiles/'],
  ownerFollowBridge600: ['SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'],
  publicFollow669: ['SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669'],
  ownerFollowSourceOnly557: ['OwnerFollowerRecovery557'],
  notificationInbox019: ['SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019'],
  privateLikeHandoff416: ['SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET'],
  privateLikeFinal416: ['SORIDRAW_PRIVATE_FINAL416_ENDPOINT'],
  exploreCache: ['EXPLORE_CACHE'],
  rateDB: ['RATE_DB'],
  productionMirror: ['EXPLORE_MIRROR_PREVIEW','EXPLORE_MIRROR_TEST'],
  likeScheduler: ['EXPLORE_LIKE_BATCH_SCHEDULER'],
  mediaCatalog: ['CATALOG', 'MEDIA'],
});
const hex = b => createHash('sha256').update(b).digest('hex');
const nameOK = s => typeof s === 'string' && s.length > 0 && s.length <= 256 && /^[A-Za-z0-9_./-]+$/.test(s);
const getActive = result => {
  const deployments = result?.deployments;
  if (!Array.isArray(deployments) || !Array.isArray(deployments[0]?.versions)) throw Error('ACTIVE_DEPLOYMENT_SHAPE_UNVERIFIED');
  const active = deployments[0].versions.filter(x => Number(x.percentage) >= 99.99);
  if (active.length !== 1 || !UUID.test(String(active[0].version_id || '')) ||
      deployments[0].versions.length !== 1) throw Error('ACTIVE_100_PERCENT_VERSION_UNVERIFIED');
  return active[0].version_id;
};
const authenticatedGET = async (url, token, fetcher) => {
  const resp = await fetcher(url, {
    method: 'GET', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!resp.ok) throw Error('WORKER_CODE_GET_UNAVAILABLE_HTTP_' + resp.status);
  const envelope = await resp.json();
  if (envelope?.success === false || !envelope?.result) throw Error('WORKER_CODE_GET_INVALID_RESPONSE');
  return envelope.result;
};

export function analyzePinnedVersionModules(version) {
  const modules = version?.modules;
  if (!Array.isArray(modules) || !modules.length || modules.length > 128)
    throw Error('ACTIVE_MODULE_LIST_UNVERIFIED');
  const main = version?.main_module;
  if (!nameOK(main)) throw Error('ACTIVE_MAIN_MODULE_UNVERIFIED');
  const names = new Set();
  let bytes = 0;
  const rows = modules.map(m => {
    if (!nameOK(m?.name) || names.has(m.name) || typeof m.content_base64 !== 'string' ||
        m.content_base64.length < 4 || m.content_base64.length > 48_000_000 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(m.content_base64)) {
      throw Error('ACTIVE_MODULE_CONTENT_UNVERIFIED');
    }
    names.add(m.name);
    const body = Buffer.from(m.content_base64, 'base64');
    if (!body.length || Buffer.from(body.toString('base64'), 'base64').length !== body.length) {
      throw Error('ACTIVE_MODULE_BYTES_UNVERIFIED');
    }
    bytes += body.length;
    if (bytes > 48_000_000) throw Error('ACTIVE_MODULES_TOO_LARGE');
    return { name: m.name, digest: hex(body), size: body.length, body };
  });
  const selected = rows.find(x => x.name === main);
  if (!selected) throw Error('ACTIVE_MAIN_MODULE_NOT_FOUND');
  const combined = rows.map(({name,digest,size}) => ({ name, digest, size }))
    .sort((a,b)=>a.name.localeCompare(b.name,'en'));
  const search = rows.map(x => x.body.toString('utf8')).join('\n');
  const found = Object.fromEntries(Object.entries(markers).map(([key, terms]) =>
    [key, terms.every(needle => search.includes(needle))]));
  return {
    mainCodeSha256: selected.digest,
    allModuleCodeSha256: hex(JSON.stringify(combined)),
    moduleCount: rows.length,
    moduleBytes: bytes,
    evidenceOnlyMarkers: found,
    // Presence of marker is NOT proof of reachable code, feature activation,
    // canonical data commit, secret correctness or production feature parity.
    codeVisibility: 'ACTIVE_MODULE_BYTES_READ_HASHED_IN_MEMORY',
    featureActivationVerified: false,
  };
}

export async function readActiveCode(name, token, fetcher = fetch) {
  if (!Object.values(WORKERS).includes(name) || !token) throw Error('WORKER_OR_TOKEN_NOT_ALLOWED');
  const root = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT;
  const deploymentsUrl = root + '/workers/scripts/' + name + '/deployments';
  const first = getActive(await authenticatedGET(deploymentsUrl, token, fetcher));
  const versionURL = root + '/workers/workers/' + name + '/versions/' + first + '?include=modules';
  const result = await authenticatedGET(versionURL, token, fetcher);
  if (result.id && result.id !== first) throw Error('PINNED_VERSION_ID_RESPONSE_DRIFT');
  const fingerprint = analyzePinnedVersionModules(result);
  const last = getActive(await authenticatedGET(deploymentsUrl, token, fetcher));
  if (first !== last) throw Error('ACTIVE_WORKER_CHANGED_DURING_READ');
  return { name, activeVersion: first, ...fingerprint };
}

export function produceApp728CodeProvenanceReport(workers, sourceHashes, exactPreviewSha, lockedPreviewSha) {
  const blockers = [];
  if (!SHA.test(String(exactPreviewSha || '')) || exactPreviewSha !== lockedPreviewSha) blockers.push('SOURCE_SHA_NOT_LOCKED');
  for (const [key,name] of Object.entries(WORKERS)) {
    const item = workers?.[key];
    if (item?.name !== name || !UUID.test(String(item?.activeVersion || '')) ||
      !/^[0-9a-f]{64}$/.test(String(item?.allModuleCodeSha256 || ''))) {
      blockers.push('ACTIVE_CODE_NOT_PROVEN_' + key);
    }
  }
  const p = workers?.previewExplore, d = workers?.productionExplore;
  const pm = workers?.previewMedia, dm = workers?.productionMedia;
  if (p?.allModuleCodeSha256 === d?.allModuleCodeSha256)
    blockers.push('EXPLORE_CODE_SAME_BYTES_STILL_NOT_BACKEND_PARITY_PROOF');
  if (pm?.allModuleCodeSha256 === dm?.allModuleCodeSha256)
    blockers.push('MEDIA_CODE_SAME_BYTES_STILL_NOT_RESOURCE_PARITY_PROOF');
  blockers.push('STAGED_CANDIDATE_CODE_PARITY_NOT_PROVEN');
  blockers.push('PRODUCTION_FEATURE_AUTH_AND_ROLLBACK_NOT_PROVEN');

  const report = {
    code: 'APP728_ACTIVE_CODE_PROVENANCE_GET_ONLY',
    collectionStatus: blockers.some(s=>s.startsWith('ACTIVE_CODE_NOT_PROVEN')||s==='SOURCE_SHA_NOT_LOCKED') ? 'UNVERIFIED':'PASS',
    releaseStatus: 'HOLD',
    executable: false,
    sharedDataReads: 0, mutations: 0, testEnvironmentQueried: false,
    sourceSha: SHA.test(String(exactPreviewSha || '')) ? exactPreviewSha : null,
    workers: Object.fromEntries(Object.entries(WORKERS).map(([key]) => {
      const x=workers?.[key];
      return [key, x ? {
        activeVersion: x.activeVersion, mainCodeSha256: x.mainCodeSha256,
        allModuleCodeSha256: x.allModuleCodeSha256, moduleCount: x.moduleCount, moduleBytes: x.moduleBytes,
        sourceMainExactByteMatch: sourceHashes?.[key] === x.mainCodeSha256,
        sourceHashAvailable: Boolean(sourceHashes?.[key]),
        evidenceOnlyMarkers: x.evidenceOnlyMarkers,
        featureActivationVerified: false,
      } : null];
    })),
    comparisons: {
      exploreExactBytes: p && d ? p.allModuleCodeSha256 === d.allModuleCodeSha256 : null,
      mediaExactBytes: pm && dm ? pm.allModuleCodeSha256 === dm.allModuleCodeSha256 : null,
      exactBuildOrActualBehaviorParityProven: false,
    },
    blockers,
  };
  return report;
}

async function main() {
  const sourceDir = String(process.env.APP728_SOURCE_DIR || '').trim();
  const sourceSha = String(process.env.APP728_SOURCE_SHA || '').trim();
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!sourceDir || !token || !sourceSha) throw Error('MISSING_EXPLICIT_READ_ONLY_INPUTS');
  const lockedPreviewSha = String(process.env.APP728_LOCKED_PREVIEW_SHA || '').trim();
  const sourceHashes = Object.fromEntries(Object.entries(SOURCE_FILES).map(([key,path]) => {
    const p = join(resolve(sourceDir),path);
    return [key, existsSync(p) ? hex(readFileSync(p)) : null];
  }));
  const list = await Promise.all(Object.entries(WORKERS).map(async ([key,name])=>[key,await readActiveCode(name,token)]));
  const report = produceApp728CodeProvenanceReport(Object.fromEntries(list),sourceHashes,sourceSha,lockedPreviewSha);
  // Absolutely no source bytes or live plaintext variable contents in logs.
  console.log(JSON.stringify(report,null,2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const {appendFileSync} = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '## APP728 active Worker source provenance: GET-only, release HOLD\n\n' +
      'Metadata capture: ' + report.collectionStatus + ', LIVE versions: 4, mutations: 0\n\n' +
      'Raw source and secrets not output; feature markers are **presence only**, not activation proof.\n');
  }
  if (report.collectionStatus !== 'PASS') process.exitCode=2;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e=>{console.error('APP728_SOURCE_PROVENANCE_ERROR:',String(e.message||e));process.exitCode=2});
}
