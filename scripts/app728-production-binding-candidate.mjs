import { createHash } from 'node:crypto';

// APP728: SOURCE-ONLY planning. This module cannot upload, activate or deploy anything.
// Existing production bindings are inherited from its exact active version, never from
// PREVIEW, TEST or a mutable "latest" version. New bindings are review items only.
const REQUIRED = Object.freeze({
  DB: 'd1',
  PROFILE_MEDIA: 'r2_bucket',
  EXPLORE_LIKE_BATCH_SCHEDULER: 'durable_object_namespace',
  LIKE_RATE_LIMITER: 'ratelimit',
  SORIDRAW_ENVIRONMENT: 'plain_text',
});
const PROD_ONLY = new Set(['EXPLORE_MIRROR_PREVIEW', 'EXPLORE_MIRROR_TEST']);
const OWNER_FOLLOW = new Set([
  'OWNER_FOLLOW_RESERVATION_SERVICE_600',
  'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600',
  'SORIDRAW_OWNER_DO_STANDALONE_600',
  'SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547',
  'SORIDRAW_OWNER_FOLLOW_BIND_544',
  'SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607',
  'SORIDRAW_OWNER_FOLLOW_CANARY_UID_574',
  'SORIDRAW_OWNER_FOLLOW_ENDPOINT_539',
  'SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544',
  'SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653',
  'SORIDRAW_OWNER_FOLLOW_HMAC_539',
  'SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607',
  'SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653',
  'SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',
  'SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669',
  'SORIDRAW_PUBLIC_FOLLOW_READY_669',
  'SORIDRAW_PUBLIC_FOLLOW_SCOPE_669',
  'SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680',
]);
const NOTIFICATION = new Set([
  'SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019',
  'SORIDRAW_NOTIFICATION_RETENTION_013',
  'SORIDRAW_NOTIFICATION_SCHEMA_READY_013',
]);
const COST = new Set(['RATE_DB', 'EXPLORE_CACHE']);
const IDENTIFIERS = new Set(['BOOTSTRAP_TOKEN', 'ENV_NAME', 'PROD_BASE', 'TARGET_BASE']);
const RELEASE = new Set([
  'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET', 'SORIDRAW_PRIVATE_FINAL416_ENDPOINT',
  'SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT', 'SORIDRAW_PUBLIC_RELEASE416_ENDPOINT',
]);
const SUPPORTED_TYPES = new Set([
  'plain_text', 'secret_text', 'd1', 'r2_bucket', 'service',
  'ratelimit', 'durable_object_namespace',
]);
const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
const isSha = (value) => /^[0-9a-f]{40}$/i.test(String(value || ''));
const get = (record) => Array.isArray(record?.bindings) ? record.bindings : [];
const map = (rows) => new Map(rows.map(b => [b.name, b]));
const isValidName = (s) => /^[A-Z][A-Z0-9_]{1,127}$/.test(String(s || ''));

export function classifyMissingBinding(name) {
  if (OWNER_FOLLOW.has(name)) return 'follow';
  if (NOTIFICATION.has(name)) return 'notification';
  if (COST.has(name)) return 'cache-cost';
  if (IDENTIFIERS.has(name)) return 'environment-identity';
  if (RELEASE.has(name)) return 'release-endpoint';
  return 'unclassified';
}

export function buildApp728ProductionBindingCandidate(input) {
  const reasons = [];
  const hold = (code) => { if (!reasons.includes(code)) reasons.push(code); };
  const p = input?.preview || {}, d = input?.production || {};
  const pBindings = get(p), dBindings = get(d);
  const pm = map(pBindings), dm = map(dBindings);
  const all = [...new Set([...pm.keys(), ...dm.keys()])].sort();

  if (!isSha(input?.sourceSha) || input.sourceSha !== input.lockedPreviewSha) hold('SOURCE_NOT_LOCKED');
  if (p.name !== 'soridraw-explore-preview' || d.name !== 'soridraw-explore-api') hold('WORKER_NAME_DRIFT');
  for (const [stage, w, values] of [['PREVIEW', p, pBindings], ['PRODUCTION', d, dBindings]]) {
    if (!uuid(w.activeVersion) || Number(w.trafficPercent) < 99.99 ||
      w.pinnedBindingsVerified !== true || w.schedulesVerified !== true) {
      hold(stage + '_ACTIVE_VERSION_OR_PIN_UNVERIFIED');
    }
    if (!values.length || values.some(b => !isValidName(b.name) || !SUPPORTED_TYPES.has(b.type)) ||
      new Set(values.map(b => b.name)).size !== values.length) hold(stage + '_BINDING_LIST_INVALID');
    if (w.hasUnexpectedMigration || values.some(b => /OwnerFollowerRecovery557/.test(b.class_name || b.name))) {
      hold(stage + '_UNRELEASED_DO_MIGRATION');
    }
  }
  // The source PREVIEW Wrangler is not the live production configuration.
  // A new DO class/migration cannot be silently inherited or auto-deployed.
  const canonical = input?.sourceCanonical;
  const migrations = canonical?.migrations;
  const declared = canonical?.durable_objects?.bindings;
  if (!Array.isArray(migrations) || !Array.isArray(declared)) {
    hold('SOURCE_CANONICAL_CONTRACT_UNVERIFIED');
  } else {
    if (migrations.some(m => m.tag !== 'v1' ||
      (m.new_sqlite_classes || []).some(c => c !== 'ExploreLikeBatchScheduler103')) ||
      declared.some(b => b.class_name === 'OwnerFollowerRecovery557')) {
      hold('SOURCE_HAS_UNRELEASED_DO_MIGRATION');
    }
    const canonicalDB = (canonical.d1_databases || []).find(b => b.binding === 'DB');
    const canonicalMedia = (canonical.r2_buckets || []).find(b => b.binding === 'PROFILE_MEDIA');
    for (const worker of [p, d]) {
      const liveDB = get(worker).find(b => b.name === 'DB');
      const liveMedia = get(worker).find(b => b.name === 'PROFILE_MEDIA');
      if (!canonicalDB?.database_id || liveDB?.id !== canonicalDB.database_id ||
        canonicalMedia?.bucket_name !== 'soridraw-profile-media' ||
        liveMedia?.bucket !== canonicalMedia.bucket_name) {
        hold('SOURCE_CANONICAL_DATA_TARGET_MISMATCH');
      }
    }
  }
  for (const [name, type] of Object.entries(REQUIRED)) {
    if (dm.get(name)?.type !== type) hold('PRODUCTION_REQUIRED_BINDING_MISSING_' + name);
  }
  // The canonical user database and media R2 are SHARED. Missing identity is HOLD,
  // including an unexpected fallback to a differently provisioned bucket.
  for (const [name, field] of [['DB', 'id'], ['PROFILE_MEDIA', 'bucket']]) {
    const a = pm.get(name), b = dm.get(name);
    if (!a?.[field] || a[field] !== b?.[field]) hold('SHARED_CANONICAL_IDENTITY_DRIFT_' + name);
  }
  for (const name of PROD_ONLY) if (!dm.has(name)) hold('PRODUCTION_LEGACY_SERVICE_MISSING_' + name);

  // Preserve the entire active PROD binding shape, including both production-only
  // service bindings. Do not serialize values, target IDs, secret hashes or tokens.
  const baseline = uuid(d.activeVersion) && d.pinnedBindingsVerified === true &&
    d.schedulesVerified === true && dBindings.length &&
    new Set(dBindings.map(b => b.name)).size === dBindings.length
    ? {
      activeVersion: d.activeVersion,
      existingBindingCount: dBindings.length,
      bindingNameTypeDigest: sha256(dBindings.map(b => [b.name, b.type]).sort((a,b) => a[0].localeCompare(b[0]))),
      inheritedBindings: dBindings.map(b => ({ name: b.name, type: 'inherit', version_id: d.activeVersion }))
        .sort((a,b) => a.name.localeCompare(b.name)),
      schedulesDigest: sha256(d.schedules || []),
    } : null;
  if (!baseline) hold('IMMUTABLE_PRODUCTION_BASELINE_MISSING');

  const forbidden = [];
  const review = [];
  const approvedNames = new Set(Array.isArray(input?.requestedProductionNames) ? input.requestedProductionNames : []);
  if (approvedNames.size !== (input?.requestedProductionNames || []).length) hold('DUPLICATE_REQUEST');
  for (const name of approvedNames) {
    if (!pm.has(name) || dm.has(name)) hold('REQUEST_NOT_A_MISSING_PREVIEW_BINDING');
  }
  for (const name of all) {
    if (pm.has(name) && !dm.has(name)) {
      const b = pm.get(name);
      const group = classifyMissingBinding(name);
      const previewOnly = /(?:_PREVIEW(?:_|$)|_CANARY(?:_|$)|^BOOTSTRAP_TOKEN$|^TARGET_BASE$|^PROD_BASE$)/.test(name);
      const requested = approvedNames.has(name);
      const item = { name, type: b.type, group, requested, action: 'DO_NOT_APPLY',
        needsProductionSpecificEvidence: true, needsSeparateSharedBackendApproval: true };
      if (group === 'unclassified' || previewOnly) {
        item.reason = group === 'unclassified' ? 'UNCLASSIFIED_BINDING' : 'PREVIEW_OR_CANARY_SPECIFIC';
        forbidden.push(item);
        if (requested) hold('UNSAFE_BINDING_REQUEST_' + name);
      } else {
        item.reason = b.type === 'secret_text' ? 'PRODUCTION_SECRET_REQUIRED_NO_COPY'
          : group === 'cache-cost' ? 'PRODUCTION_ISOLATED_COST_RESOURCE_AND_NO_FALLBACK_PROOF_REQUIRED'
          : 'PRODUCTION_SOURCE_AND_TARGET_COMPATIBILITY_UNVERIFIED';
        review.push(item);
      }
    }
  }

  // An additional binding may be added to the FUTURE candidate only following
  // separately authenticated approval, reviewed source usage, verified target
  // identity and inactive-version parity. The read-only candidate never does so.
  if (approvedNames.size) hold('REQUESTED_NEW_BINDINGS_REQUIRE_SEPARATE_APPROVAL_AND_PROOF');
  const protectedMissing = [...PROD_ONLY].filter(n => !dm.has(n));
  if (protectedMissing.length) hold('LEGACY_BINDINGS_NOT_PRESERVED');

  const out = {
    kind: 'APP728_PRODUCTION_BINDING_CANDIDATE',
    status: 'HOLD',
    executable: false,
    serverMutations: 0,
    testEnvironmentTouched: false,
    scope: 'SOURCE_ONLY_NEVER_DEPLOY',
    sourceSha: isSha(input?.sourceSha) ? input.sourceSha : null,
    productionActiveVersion: d.activeVersion || null,
    immutableProductionBaseline: baseline,
    proposedNewBindings: [],
    reviewRequired: review,
    excludedFromCopy: forbidden,
    productionOnlyPreserved: [...PROD_ONLY].filter(n=>dm.has(n)).sort(),
    namesOnlySummary: {
      previewCount: pBindings.length,
      productionCount: dBindings.length,
      shared: all.filter(n=>pm.has(n)&&dm.has(n)).length,
      previewOnly: review.length+forbidden.length,
      productionOnly: all.filter(n=>dm.has(n)&&!pm.has(n)).length,
      manualReviewCount: review.length,
      excludedCount: forbidden.length,
    },
    blockers: reasons,
    remainingChecks: [
      'source and active Worker code identity, including exact compiled/DO migrations',
      'required production feature set and explicit credentials/bindings separately approved',
      'new production resources and no shared canonical fallback, plus billing bounds',
      'zero-traffic version and all bindings parity after authorized upload',
      'real rollback, user PC/mobile, authenticated follow/likes/Music Note/Library acceptance',
    ],
  };
  out.candidateDigest = sha256({
    sourceSha: out.sourceSha, baseline: out.immutableProductionBaseline,
    review: out.reviewRequired, excluded: out.excludedFromCopy, blockers: out.blockers,
  });
  return out;
}
