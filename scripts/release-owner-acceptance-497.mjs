// app497: verification of a distinct, owner-authorized TEST acceptance.
// TEST_AUTO_CHECKED is never itself authorization to promote to PRODUCTION.
// This module performs no network requests, deployments, or data mutations.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ACCEPTANCE_SCHEMA = 1;

const isSha = (v, bytes) =>
  typeof v === 'string' && new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;

const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(
    Object.keys(v).sort().map(k => [k, canonical(v[k])]),
  );
  return v;
};
export const canonicalJSON = v => JSON.stringify(canonical(v));
export const sha256 = v => createHash('sha256').update(v).digest('hex');

export function assertPendingManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || manifest.schema !== 5 ||
      manifest.state !== 'TEST_AUTO_CHECKED')
    throw Error('OWNER_ACCEPTANCE_REQUIRES_PENDING_AUTOMATED_TEST_MANIFEST');
  for (const k of ['tag', 'sourcePreviewSha', 'sourcePreviewTree', 'promotedMainSha',
    'mainTree', 'distIndexSha256', 'testWorkerBundleSha256', 'testWorkerCodeSha256',
    'testWorkerVersionId', 'testMediaWorkerBundleSha256', 'testMediaWorkerCodeSha256',
    'testMediaWorkerVersionId', 'browserUpgradeContractSha256',
    'controllerIdentity', 'productionEnvironmentContract',
    'workflowRunId', 'appVersion', 'testHosting']) {
    if (manifest[k] === null || manifest[k] === undefined || manifest[k] === '')
      throw Error(`OWNER_ACCEPTANCE_PENDING_MISSING_${k}`);
  }
  if (!/^soridraw-test-v[0-9]+-[0-9a-f]{12}$/.test(manifest.tag) ||
      !isSha(manifest.sourcePreviewSha, 20) ||
      manifest.tag !== `soridraw-test-v${manifest.appVersion}-${manifest.sourcePreviewSha.slice(0, 12)}` ||
      !isSha(manifest.sourcePreviewTree, 20) ||
      !isSha(manifest.promotedMainSha, 20) ||
      !isSha(manifest.mainTree, 20) ||
      !isSha(manifest.distIndexSha256, 32))
    throw Error('OWNER_ACCEPTANCE_INVALID_PENDING_IDENTITY');
  if (manifest.testHosting.site !== 'soridraw-test' ||
      !isText(manifest.testHosting.release) || !isText(manifest.testHosting.version))
    throw Error('OWNER_ACCEPTANCE_INVALID_HOSTING_IDENTITY');
  for (const k of ['testWorkerBundleSha256','testWorkerCodeSha256',
    'testMediaWorkerBundleSha256','testMediaWorkerCodeSha256',
    'browserUpgradeContractSha256']) {
    if (!isSha(manifest[k],32)) throw Error(`OWNER_ACCEPTANCE_INVALID_${k}`);
  }
  if (!manifest.controllerIdentity || Object.values(manifest.controllerIdentity).some(v=>!isSha(v,32)))
    throw Error('OWNER_ACCEPTANCE_INVALID_CONTROLLER_IDENTITY');
  if (!isSha(manifest.productionEnvironmentContract?.sha256,32))
    throw Error('OWNER_ACCEPTANCE_INVALID_PRODUCTION_CONTRACT');
  // A hardcoded manifest parity status is not a substitute for real evidence.
  if (manifest.parity?.status === 'PASS' && !isText(manifest.parity?.evidenceSha256))
    throw Error('OWNER_ACCEPTANCE_HARDCODED_PARITY_FORBIDDEN');
}

function requireDeviceProof(device, name) {
  if (!device || typeof device !== 'object') throw Error(`OWNER_ACCEPTANCE_${name}_MISSING`);
  for (const k of ['signedIn','reusedCache','emptyCache','musicNote','library',
    'likes','follow','publication','profile','nextSong']) {
    if (device[k] !== true) throw Error(`OWNER_ACCEPTANCE_${name}_${k}_NOT_VERIFIED`);
  }
  if (!isText(device.evidenceRef) || !isText(device.checkedAt))
    throw Error(`OWNER_ACCEPTANCE_${name}_EVIDENCE_MISSING`);
  if (!Number.isFinite(Date.parse(device.checkedAt)))
    throw Error(`OWNER_ACCEPTANCE_${name}_INVALID_DATE`);
}

export function assertAcceptanceEvidence(evidence, pendingManifest, ownerLogin) {
  if (!isText(ownerLogin)) throw Error('OWNER_ACCEPTANCE_OWNER_ID_REQUIRED');
  if (!evidence || evidence.schema !== ACCEPTANCE_SCHEMA ||
      evidence.state !== 'TEST_VERIFIED' || evidence.ownerLogin !== ownerLogin)
    throw Error('OWNER_ACCEPTANCE_NOT_AUTHORIZED_OR_UNVERIFIED');
  if (evidence.releaseTag !== pendingManifest.tag ||
      evidence.sourcePreviewSha !== pendingManifest.sourcePreviewSha ||
      evidence.sourcePreviewTree !== pendingManifest.sourcePreviewTree ||
      evidence.promotedMainSha !== pendingManifest.promotedMainSha ||
      evidence.distIndexSha256 !== pendingManifest.distIndexSha256 ||
      evidence.testHosting?.release !== pendingManifest.testHosting?.release ||
      evidence.testHosting?.version !== pendingManifest.testHosting?.version ||
      evidence.testWorkerVersionId !== pendingManifest.testWorkerVersionId ||
      evidence.testWorkerBundleSha256 !== pendingManifest.testWorkerBundleSha256 ||
      evidence.testMediaWorkerVersionId !== pendingManifest.testMediaWorkerVersionId ||
      evidence.testMediaWorkerBundleSha256 !== pendingManifest.testMediaWorkerBundleSha256 ||
      evidence.workflowRunId !== pendingManifest.workflowRunId)
    throw Error('OWNER_ACCEPTANCE_SOURCE_OR_ARTIFACT_DRIFT');
  if (evidence.pendingManifestSha256 !== sha256(canonicalJSON(pendingManifest)))
    throw Error('OWNER_ACCEPTANCE_PENDING_MANIFEST_TAMPERED');
  if (!isText(evidence.ownerAuthorizedAt) ||
      !Number.isFinite(Date.parse(evidence.ownerAuthorizedAt)) ||
      !isText(evidence.ownerApprovalRef))
    throw Error('OWNER_ACCEPTANCE_APPROVAL_PROOF_REQUIRED');
  requireDeviceProof(evidence.devices?.pc, 'PC');
  requireDeviceProof(evidence.devices?.mobile, 'MOBILE');
  if (!evidence.parity || evidence.parity.measured !== true ||
      evidence.parity.previews !== 'PASS' || evidence.parity.test !== 'PASS' ||
      evidence.parity.productionReadOnly !== 'PASS' ||
      !isSha(evidence.parity.evidenceSha256, 32) ||
      !isText(evidence.parity.evidenceRef))
    throw Error('OWNER_ACCEPTANCE_MEASURED_3ENV_PARITY_REQUIRED');
  if (evidence.sharedUserOriginalsUnchanged !== true ||
      evidence.stage416Off !== true || evidence.readerOff !== true ||
      evidence.noUserDataCopy !== true)
    throw Error('OWNER_ACCEPTANCE_SHARED_DATA_OR_FLAGS_UNVERIFIED');
}

function signingPayload(record) {
  const { signature, ...payload } = record;
  return canonicalJSON(payload);
}
function getKey(key) {
  if (typeof key !== 'string' || Buffer.byteLength(key) < 32)
    throw Error('OWNER_ACCEPTANCE_SIGNATURE_KEY_UNAVAILABLE');
  return key;
}

export function signOwnerAcceptance(evidence, pendingManifest, ownerLogin, key) {
  assertPendingManifest(pendingManifest);
  assertAcceptanceEvidence(evidence, pendingManifest, ownerLogin);
  const approved = { ...evidence, signature: { algorithm: 'HMAC-SHA256', value: '' } };
  approved.signature.value = createHmac('sha256', getKey(key)).update(signingPayload(approved)).digest('hex');
  return approved;
}

export function verifyOwnerAcceptance(record, pendingManifest, ownerLogin, key) {
  assertPendingManifest(pendingManifest);
  assertAcceptanceEvidence(record, pendingManifest, ownerLogin);
  const signature = record?.signature;
  if (signature?.algorithm !== 'HMAC-SHA256' || !isSha(signature?.value,32))
    throw Error('OWNER_ACCEPTANCE_SIGNATURE_MISSING');
  const expected = createHmac('sha256', getKey(key)).update(signingPayload(record)).digest();
  const actual = Buffer.from(signature.value,'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual,expected))
    throw Error('OWNER_ACCEPTANCE_SIGNATURE_INVALID_OR_TAMPERED');
  return true;
}
