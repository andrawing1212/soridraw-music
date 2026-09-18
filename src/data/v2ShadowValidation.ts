/*
 * SORIDRAW Backend V2 Step 2-D shadow-write / validation scaffold.
 *
 * SOURCE-ONLY SAFETY CONTRACT
 * - No Firebase SDK import.
 * - No network import/call.
 * - No write/delete executor exists in this module.
 * - V1 remains authoritative and Backend V2 runtime gates remain disabled.
 * - This file can only build dry-run plans and validate payload preservation.
 */

import {
  BACKEND_V2_RUNTIME_MODE,
  BACKEND_V2_SAFETY_GATES,
  assertBackendV2MutationDisabled,
  v2UserDataPaths,
} from './userDataRepository';
import {
  V2_SONG_MIGRATION_PROVENANCE_FIELDS,
  V2_SONG_REQUIRED_METADATA_FIELDS,
  V2_SONG_SCHEMA_VERSION,
} from './v2Schema';

export const BACKEND_V2_SHADOW_WRITE_RUNTIME_ENABLED = false as const;
export const BACKEND_V2_BACKFILL_RUNTIME_ENABLED = false as const;
export const BACKEND_V2_V1_DELETE_RUNTIME_ENABLED = false as const;

export type OpaqueRecord = Record<string, unknown>;

export type SongIdentityEvidence = {
  explicitCanonicalId?: {
    sourceId: string;
    targetId: string;
  };
  trustedProviderIdentity?: {
    sourceProvider: string;
    sourceTrackId: string;
    targetProvider: string;
    targetTrackId: string;
  };
  trustedLegacyKey?: {
    sourceKey: string;
    targetKey: string;
    corroboratedStableIdentity: boolean;
  };
};

export type SongIdentityDecision = {
  sameRecord: boolean;
  rule:
    | 'explicit-canonical-id'
    | 'trusted-provider-identity'
    | 'trusted-legacy-key-with-corroboration'
    | 'no-trusted-match';
};

export type V2SongDryRunCandidate = {
  uid: string;
  targetSongId: string;
  sourcePayload: OpaqueRecord;
  musicNote: boolean;
  recentVisible: boolean;
  v2UpdatedAtMs: number;
  legacyRecentIndex?: number;
  legacyFavoriteId?: string;
  legacyFavoriteKey?: string;
  identityEvidence?: SongIdentityEvidence;
  existingTarget?: OpaqueRecord | null;
};

export type SongPayloadValidation = {
  valid: boolean;
  missingSourceFields: string[];
  changedSourceFields: string[];
  metadataErrors: string[];
};

export type V2SongDryRunAction =
  | 'would-create'
  | 'would-update-trusted'
  | 'no-op-trusted'
  | 'conflict-preserve-both';

export type V2SongDryRunPlan = {
  dryRun: true;
  executable: false;
  writePerformed: false;
  uid: string;
  targetSongId: string;
  targetPath: string;
  action: V2SongDryRunAction;
  reason: string;
  identityDecision: SongIdentityDecision;
  payload: OpaqueRecord;
  payloadValidation: SongPayloadValidation;
};

export type V2SongDryRunBatch = {
  dryRun: true;
  executable: false;
  writeOperations: 0;
  plans: V2SongDryRunPlan[];
  duplicateTargetIds: string[];
  summary: {
    total: number;
    wouldCreate: number;
    wouldUpdateTrusted: number;
    noOpTrusted: number;
    conflicts: number;
  };
};

const RESERVED_V2_FIELDS = new Set<string>([
  ...V2_SONG_REQUIRED_METADATA_FIELDS,
  ...V2_SONG_MIGRATION_PROVENANCE_FIELDS,
]);

const requireSegment = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.includes('/')) {
    throw new Error(`[Backend V2 Step 2-D] invalid ${label}`);
  }
  return normalized;
};

const normalizeText = (value: unknown): string => String(value || '').trim();

const isNonNegativeInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 0
);

const normalizeOptionalString = (value: unknown): string | undefined => {
  const normalized = normalizeText(value);
  return normalized || undefined;
};

const normalizeComparable = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return { __dateMs: value.getTime() };
  if (Array.isArray(value)) return value.map((entry) => normalizeComparable(entry, seen));
  if (typeof value !== 'object') return String(value);

  const objectValue = value as Record<string, unknown>;
  if (typeof (objectValue as any).toMillis === 'function') {
    try {
      return { __timestampMs: Number((objectValue as any).toMillis()) };
    } catch {
      return { __timestampMs: null };
    }
  }

  if (seen.has(objectValue)) return '[Circular]';
  seen.add(objectValue);

  const output: Record<string, unknown> = {};
  Object.keys(objectValue).sort().forEach((key) => {
    output[key] = normalizeComparable(objectValue[key], seen);
  });
  return output;
};

const equivalent = (left: unknown, right: unknown): boolean => {
  try {
    return JSON.stringify(normalizeComparable(left)) === JSON.stringify(normalizeComparable(right));
  } catch {
    return Object.is(left, right);
  }
};

export const assertStep2DScaffoldInert = (): void => {
  assertBackendV2MutationDisabled();
  if (BACKEND_V2_RUNTIME_MODE !== 'v1-only') {
    throw new Error('[Backend V2 Step 2-D] runtime must remain v1-only');
  }
  if (
    BACKEND_V2_SAFETY_GATES.shadowWriteToV2
    || BACKEND_V2_SAFETY_GATES.writeToV2
    || BACKEND_V2_SAFETY_GATES.migrateOnRead
    || BACKEND_V2_SAFETY_GATES.deleteV1
    || BACKEND_V2_SHADOW_WRITE_RUNTIME_ENABLED
    || BACKEND_V2_BACKFILL_RUNTIME_ENABLED
    || BACKEND_V2_V1_DELETE_RUNTIME_ENABLED
  ) {
    throw new Error('[Backend V2 Step 2-D] mutation/backfill/delete gate must stay disabled');
  }
};

export const evaluateSongIdentity = (
  evidence: SongIdentityEvidence | undefined,
): SongIdentityDecision => {
  const explicit = evidence?.explicitCanonicalId;
  if (
    explicit
    && normalizeText(explicit.sourceId)
    && normalizeText(explicit.sourceId) === normalizeText(explicit.targetId)
  ) {
    return { sameRecord: true, rule: 'explicit-canonical-id' };
  }

  const provider = evidence?.trustedProviderIdentity;
  if (
    provider
    && normalizeText(provider.sourceProvider)
    && normalizeText(provider.sourceProvider) === normalizeText(provider.targetProvider)
    && normalizeText(provider.sourceTrackId)
    && normalizeText(provider.sourceTrackId) === normalizeText(provider.targetTrackId)
  ) {
    return { sameRecord: true, rule: 'trusted-provider-identity' };
  }

  const legacy = evidence?.trustedLegacyKey;
  if (
    legacy
    && legacy.corroboratedStableIdentity === true
    && normalizeText(legacy.sourceKey)
    && normalizeText(legacy.sourceKey) === normalizeText(legacy.targetKey)
  ) {
    return { sameRecord: true, rule: 'trusted-legacy-key-with-corroboration' };
  }

  return { sameRecord: false, rule: 'no-trusted-match' };
};

export const buildV2SongPayload = (
  candidate: Pick<
    V2SongDryRunCandidate,
    | 'sourcePayload'
    | 'musicNote'
    | 'recentVisible'
    | 'v2UpdatedAtMs'
    | 'legacyRecentIndex'
    | 'legacyFavoriteId'
    | 'legacyFavoriteKey'
  >,
): OpaqueRecord => {
  if (!candidate.sourcePayload || typeof candidate.sourcePayload !== 'object' || Array.isArray(candidate.sourcePayload)) {
    throw new Error('[Backend V2 Step 2-D] sourcePayload must be an object');
  }
  if (!isNonNegativeInteger(candidate.v2UpdatedAtMs)) {
    throw new Error('[Backend V2 Step 2-D] v2UpdatedAtMs must be a non-negative integer');
  }

  const payload: OpaqueRecord = {
    ...candidate.sourcePayload,
    schemaVersion: V2_SONG_SCHEMA_VERSION,
    musicNote: candidate.musicNote === true,
    recentVisible: candidate.recentVisible === true,
    v2UpdatedAtMs: candidate.v2UpdatedAtMs,
  };

  if (candidate.legacyRecentIndex !== undefined) {
    if (!Number.isInteger(candidate.legacyRecentIndex)) {
      throw new Error('[Backend V2 Step 2-D] legacyRecentIndex must be an integer when present');
    }
    payload.legacyRecentIndex = candidate.legacyRecentIndex;
  } else {
    delete payload.legacyRecentIndex;
  }

  const favoriteId = normalizeOptionalString(candidate.legacyFavoriteId);
  if (favoriteId) payload.legacyFavoriteId = favoriteId;
  else delete payload.legacyFavoriteId;

  const favoriteKey = normalizeOptionalString(candidate.legacyFavoriteKey);
  if (favoriteKey) payload.legacyFavoriteKey = favoriteKey;
  else delete payload.legacyFavoriteKey;

  return payload;
};

export const validateV2SongPayloadPreservation = (
  sourcePayload: OpaqueRecord,
  targetPayload: OpaqueRecord,
): SongPayloadValidation => {
  const missingSourceFields: string[] = [];
  const changedSourceFields: string[] = [];
  const metadataErrors: string[] = [];

  Object.keys(sourcePayload).forEach((key) => {
    if (RESERVED_V2_FIELDS.has(key)) return;
    if (!(key in targetPayload)) {
      missingSourceFields.push(key);
      return;
    }
    if (!equivalent(sourcePayload[key], targetPayload[key])) {
      changedSourceFields.push(key);
    }
  });

  if (targetPayload.schemaVersion !== V2_SONG_SCHEMA_VERSION) metadataErrors.push('schemaVersion');
  if (typeof targetPayload.musicNote !== 'boolean') metadataErrors.push('musicNote');
  if (typeof targetPayload.recentVisible !== 'boolean') metadataErrors.push('recentVisible');
  if (!isNonNegativeInteger(targetPayload.v2UpdatedAtMs)) metadataErrors.push('v2UpdatedAtMs');

  if (targetPayload.legacyRecentIndex !== undefined && !Number.isInteger(targetPayload.legacyRecentIndex)) {
    metadataErrors.push('legacyRecentIndex');
  }
  if (targetPayload.legacyFavoriteId !== undefined && typeof targetPayload.legacyFavoriteId !== 'string') {
    metadataErrors.push('legacyFavoriteId');
  }
  if (targetPayload.legacyFavoriteKey !== undefined && typeof targetPayload.legacyFavoriteKey !== 'string') {
    metadataErrors.push('legacyFavoriteKey');
  }

  return {
    valid: missingSourceFields.length === 0 && changedSourceFields.length === 0 && metadataErrors.length === 0,
    missingSourceFields,
    changedSourceFields,
    metadataErrors,
  };
};

export const buildV2SongDryRunPlan = (candidate: V2SongDryRunCandidate): V2SongDryRunPlan => {
  assertStep2DScaffoldInert();
  const uid = requireSegment(candidate.uid, 'uid');
  const targetSongId = requireSegment(candidate.targetSongId, 'targetSongId');
  const targetPath = v2UserDataPaths.song(uid, targetSongId).join('/');
  const payload = buildV2SongPayload(candidate);
  const payloadValidation = validateV2SongPayloadPreservation(candidate.sourcePayload, payload);
  const identityDecision = evaluateSongIdentity(candidate.identityEvidence);

  if (!payloadValidation.valid) {
    return {
      dryRun: true,
      executable: false,
      writePerformed: false,
      uid,
      targetSongId,
      targetPath,
      action: 'conflict-preserve-both',
      reason: 'planned V2 payload does not preserve the complete V1 source payload safely',
      identityDecision,
      payload,
      payloadValidation,
    };
  }

  if (!candidate.existingTarget) {
    return {
      dryRun: true,
      executable: false,
      writePerformed: false,
      uid,
      targetSongId,
      targetPath,
      action: 'would-create',
      reason: 'target is absent; dry-run only, no Firestore write performed',
      identityDecision,
      payload,
      payloadValidation,
    };
  }

  if (!identityDecision.sameRecord) {
    return {
      dryRun: true,
      executable: false,
      writePerformed: false,
      uid,
      targetSongId,
      targetPath,
      action: 'conflict-preserve-both',
      reason: 'existing target cannot be proven to be the same record by trusted identity evidence',
      identityDecision,
      payload,
      payloadValidation,
    };
  }

  const existingValidation = validateV2SongPayloadPreservation(candidate.sourcePayload, candidate.existingTarget);
  const sameAsPlanned = equivalent(candidate.existingTarget, payload);

  return {
    dryRun: true,
    executable: false,
    writePerformed: false,
    uid,
    targetSongId,
    targetPath,
    action: sameAsPlanned && existingValidation.valid ? 'no-op-trusted' : 'would-update-trusted',
    reason: sameAsPlanned && existingValidation.valid
      ? 'trusted existing target already matches the planned V2 payload'
      : 'trusted existing target differs; later approved migration may update only after validation',
    identityDecision,
    payload,
    payloadValidation,
  };
};

export const buildV2SongDryRunBatch = (
  candidates: V2SongDryRunCandidate[],
): V2SongDryRunBatch => {
  assertStep2DScaffoldInert();
  const targetCounts = new Map<string, number>();
  candidates.forEach((candidate) => {
    const key = `${requireSegment(candidate.uid, 'uid')}::${requireSegment(candidate.targetSongId, 'targetSongId')}`;
    targetCounts.set(key, (targetCounts.get(key) || 0) + 1);
  });

  const duplicateTargetIds = Array.from(targetCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
  const duplicateSet = new Set(duplicateTargetIds);

  const plans = candidates.map((candidate) => {
    const key = `${requireSegment(candidate.uid, 'uid')}::${requireSegment(candidate.targetSongId, 'targetSongId')}`;
    const plan = buildV2SongDryRunPlan(candidate);
    if (!duplicateSet.has(key)) return plan;
    return {
      ...plan,
      action: 'conflict-preserve-both' as const,
      reason: 'duplicate target ID appears more than once in the same dry-run batch; never collapse silently',
    };
  });

  return {
    dryRun: true,
    executable: false,
    writeOperations: 0,
    plans,
    duplicateTargetIds,
    summary: {
      total: plans.length,
      wouldCreate: plans.filter((plan) => plan.action === 'would-create').length,
      wouldUpdateTrusted: plans.filter((plan) => plan.action === 'would-update-trusted').length,
      noOpTrusted: plans.filter((plan) => plan.action === 'no-op-trusted').length,
      conflicts: plans.filter((plan) => plan.action === 'conflict-preserve-both').length,
    },
  };
};
