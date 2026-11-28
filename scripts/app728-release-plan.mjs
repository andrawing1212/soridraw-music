import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const versionId = (site, name) => {
  const prefix = `sites/${site}/versions/`;
  const value = String(name || '');
  const id = value.startsWith(prefix) ? value.slice(prefix.length) : '';
  return /^[a-zA-Z0-9_-]{4,128}$/.test(id) ? id : null;
};
const isVersion = (value) => /^[0-9a-f-]{36}$/i.test(String(value || ''));
const getBindings = (w) => (Array.isArray(w?.bindings) ? w.bindings : []);
const key = (v) => `${v.name}:${v.type}`;

// Cloudflare beta Worker Versions API supports binding inheritance pinned to an
// explicit version ID. This outputs a candidate metadata PLAN, not an API call.
export function planExactBindingInheritance(worker) {
  if (!isVersion(worker?.activeVersion) || !worker?.pinnedBindingsVerified) return null;
  const bindings = getBindings(worker);
  if (!bindings.length || bindings.some(v => !v.name || !v.type)) return null;
  const labels = bindings.map(key);
  if (new Set(labels).size !== labels.length) return null;
  return {
    activeVersion: worker.activeVersion,
    bindingCount: bindings.length,
    labelFingerprint: sha256(labels.sort()),
    bindingPlan: bindings.map(v => ({ name: v.name, type: 'inherit', version_id: worker.activeVersion })),
  };
}

export function buildApp728DirectReleasePlan(input) {
  const reasons = [];
  const hold = (code) => reasons.push(code);
  const workers = input.workers || {};
  const prevHostingVersion = versionId('soridraw-preview', input.previewHosting?.version);
  const prodHostingVersion = versionId('soridraw', input.productionHosting?.version);
  if (!prevHostingVersion || !prodHostingVersion) hold('HOSTING_VERSION_IDENTITY_UNVERIFIED');
  if (!/^[0-9a-f]{40}$/.test(String(input.sourceSha || '')) || input.sourceSha !== input.lockedPreviewSha) hold('IMMUTABLE_SOURCE_SHA_UNVERIFIED');
  if (!/^[0-9a-f]{64}$/.test(String(input.distDigest || ''))) hold('EXACT_DIST_ARTIFACT_NOT_FROZEN');

  const preserved = {};
  const old = {};
  for (const name of ['previewExplore', 'productionExplore', 'previewMedia', 'productionMedia']) {
    const worker = workers[name];
    const inheritance = planExactBindingInheritance(worker);
    if (!inheritance) hold(`LIVE_PINNED_BINDING_INHERITANCE_UNPROVEN_${name}`);
    if (!worker || !isVersion(worker.activeVersion) || Number(worker.trafficPercent) < 99.99) hold(`LIVE_ACTIVE_VERSION_UNVERIFIED_${name}`);
    if (!worker?.schedulesVerified) hold(`LIVE_SCHEDULE_SNAPSHOT_UNVERIFIED_${name}`);
    if (worker?.hasUnexpectedMigration || getBindings(worker).some(x => /OwnerFollowerRecovery557/.test(String(x.class_name || x.name)))) hold(`LIVE_UNSAFE_DO_MIGRATION_${name}`);
    preserved[name] = inheritance ? {
      sourceVersionId: inheritance.activeVersion,
      bindingCount: inheritance.bindingCount,
      namesAndTypesSha256: inheritance.labelFingerprint,
      // The actual inherit descriptors stay in-memory for a later VERIFIED staging tool;
      // no secret values are part of this representation.
      descriptors: inheritance.bindingPlan,
    } : null;
    old[name] = {
      activeVersion: worker?.activeVersion || null,
      scheduleFingerprint: worker?.schedulesVerified ? sha256(worker.schedules || []) : null,
    };
  }

  // These items can only be established by a separate, actual inactive upload,
  // verification, rollback rehearsal, and real PC/mobile user acceptance.
  // The read-only workflow intentionally provides no way to override them.
  hold('NEW_WORKER_CODE_IDENTITY_NOT_VERIFIED');
  hold('INACTIVE_UPLOAD_AND_EXACT_BINDING_PARITY_NOT_VERIFIED');
  hold('BROWSER_AND_BACKEND_COMPATIBILITY_NOT_VERIFIED');
  hold('ROLLBACK_REHEARSAL_NOT_VERIFIED');

  const plan = {
    kind: 'APP728_IMMUTABLE_DIRECT_RELEASE_PLAN',
    status: 'HOLD',
    executable: false,
    runOnlyAfterSeparateApproval: true,
    testEnvironmentTouched: false,
    forbiddenActions: ['TEST_CHANGE', 'SHARED_DATA_MIGRATION', 'SHARED_RULES_EDIT', 'CACHE_RESET', 'UNPINNED_WORKER_UPLOAD'],
    source: { previewSha: input.sourceSha || null, distDigest: input.distDigest || null,
      hostingSite: 'soridraw-preview', hostingVersion: prevHostingVersion },
    before: {
      hostingSite: 'soridraw', hostingVersion: prodHostingVersion,
      workers: old,
    },
    immutableRollbackTargets: {
      hosting: prodHostingVersion ? { sourceSite: 'soridraw', sourceVersion: prodHostingVersion, targetSite: 'soridraw', targetChannel: 'live' } : null,
      workerExplore: old.productionExplore,
      workerMedia: old.productionMedia,
    },
    proposedPromotion: {
      hosting: prevHostingVersion ? { sourceSite: 'soridraw-preview', sourceVersion: prevHostingVersion, targetSite: 'soridraw', targetChannel: 'live' } : null,
      workerBindingInheritance: { productionExplore: preserved.productionExplore, productionMedia: preserved.productionMedia },
      order: [
        'lock immutable source, build and preview Hosting version',
        'check actual production active pinned versions, code, compatibility, all bindings and schedules',
        'create migration-free new inactive Worker versions by inheriting from pinned ACTIVE version, never latest',
        'verify every post-upload binding, immutable code hash, DO class and rollback target BEFORE activation',
        'activate code with bounded smoke, cross-account/PC-mobile parity and no data writes beyond real user actions',
        'clone exact preview Hosting VERSION to production only after backend parity',
        'verify production app, rollback source, and safeguard against concurrent version changes',
      ],
    },
    blockerCodes: [...new Set(reasons)],
  };
  // An exact, deterministic roll-forward / rollback snapshot fingerprint. It
  // does not claim user-facing success or authorize side effects.
  plan.planFingerprintSha256 = sha256({ source: plan.source, before: plan.before, proposedPromotion: plan.proposedPromotion });
  return plan;
}
