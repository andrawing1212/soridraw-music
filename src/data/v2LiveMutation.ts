/*
 * SORIDRAW Backend V2 live-mutation contract — Step 2-A4a.
 *
 * SAFETY CONTRACT
 * - Pure/source-only. No Firebase SDK, IndexedDB, network or UI dependency.
 * - Runtime mirroring remains disabled.
 * - New live songs use a provider-neutral immutable SORIDRAW ID.
 * - Historical `v1r_` positional IDs are migration provenance only and are never
 *   accepted as a live mutation target.
 * - Historical `v1f_` favorite-path IDs may be targeted only when an exact legacy
 *   favorite destination is already known.
 * - Mutation envelopes contain identity/version metadata only, never creative
 *   payloads, provider API keys, secrets or browser-returned credentials.
 */

export const BACKEND_V2_LIVE_MIRROR_RUNTIME_ENABLED = false as const;
export const SORIDRAW_SONG_ID_FIELD = 'soridrawSongId' as const;
export const V2_MIRROR_MUTATION_ID_FIELD = 'v2MutationId' as const;

export const SORIDRAW_SONG_ID_PREFIX = 'sd_' as const;
export const LEGACY_V2_FAVORITE_ID_PREFIX = 'v1f_' as const;

const SORIDRAW_SONG_ID_PATTERN = /^sd_[a-f0-9]{32}$/;
const LEGACY_V2_FAVORITE_ID_PATTERN = /^v1f_[a-f0-9]{32}$/;
const LEGACY_V2_RECENT_ID_PATTERN = /^v1r_[a-f0-9]{32}$/;

export type SoridrawSongId = string & { readonly __soridrawSongIdBrand: unique symbol };
export type V2LiveMirrorTargetKind = 'soridraw' | 'legacyFavorite';
export type V2LiveMirrorSource = 'recent' | 'musicNote';
export type V2LiveMirrorOperation =
  | 'upsert'
  | 'recent-hide'
  | 'music-note-save'
  | 'music-note-unsave'
  | 'soft-remove';

export type V2MirrorVersion = {
  sourceUpdatedAtMs: number;
  mutationId: string;
};

export type V2MirrorConflictDecision = 'apply' | 'duplicate' | 'stale';

export type V2MirrorMutationEnvelope = {
  mutationId: string;
  uid: string;
  targetKind: V2LiveMirrorTargetKind;
  targetSongId: string;
  source: V2LiveMirrorSource;
  operation: V2LiveMirrorOperation;
  sourceUpdatedAtMs: number;
  enqueuedAtMs: number;
};

export const BACKEND_V2_MIRROR_RETRY_POLICY = Object.freeze({
  maxAttempts: 6,
  baseDelayMs: 5_000,
  maxDelayMs: 300_000,
});

const requireSegment = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.includes('/')) {
    throw new Error(`[Backend V2 live mutation] invalid ${label}`);
  }
  return normalized;
};

const requireNonNegativeInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`[Backend V2 live mutation] invalid ${label}`);
  }
  return value;
};

export const isSoridrawSongId = (value: unknown): value is SoridrawSongId => (
  typeof value === 'string' && SORIDRAW_SONG_ID_PATTERN.test(value)
);

export const normalizeSoridrawSongId = (value: string): SoridrawSongId => {
  const normalized = String(value || '').trim();
  if (!isSoridrawSongId(normalized)) {
    throw new Error('[Backend V2 live mutation] invalid soridrawSongId');
  }
  return normalized as SoridrawSongId;
};

export const createSoridrawSongId = (
  uuidFactory: () => string = () => {
    const randomUuid = globalThis.crypto?.randomUUID;
    if (typeof randomUuid !== 'function') {
      throw new Error('[Backend V2 live mutation] crypto.randomUUID unavailable');
    }
    return randomUuid.call(globalThis.crypto);
  },
): SoridrawSongId => {
  const compactUuid = String(uuidFactory() || '').trim().toLowerCase().replace(/-/g, '');
  if (!/^[a-f0-9]{32}$/.test(compactUuid)) {
    throw new Error('[Backend V2 live mutation] UUID factory returned an invalid value');
  }
  return normalizeSoridrawSongId(`${SORIDRAW_SONG_ID_PREFIX}${compactUuid}`);
};

export const isLegacyV2FavoriteTargetId = (value: unknown): value is string => (
  typeof value === 'string' && LEGACY_V2_FAVORITE_ID_PATTERN.test(value)
);

export const isLegacyV2RecentPositionalId = (value: unknown): value is string => (
  typeof value === 'string' && LEGACY_V2_RECENT_ID_PATTERN.test(value)
);

export const assertV2LiveMirrorTarget = (
  targetKind: V2LiveMirrorTargetKind,
  targetSongIdInput: string,
): string => {
  const targetSongId = requireSegment(targetSongIdInput, 'targetSongId');
  if (isLegacyV2RecentPositionalId(targetSongId)) {
    throw new Error('[Backend V2 live mutation] positional v1r IDs are forbidden for live mirroring');
  }
  if (targetKind === 'soridraw') {
    return normalizeSoridrawSongId(targetSongId);
  }
  if (targetKind === 'legacyFavorite' && isLegacyV2FavoriteTargetId(targetSongId)) {
    return targetSongId;
  }
  throw new Error('[Backend V2 live mutation] target kind/id mismatch');
};

export const makeV2MirrorMutationId = (input: {
  uid: string;
  targetKind: V2LiveMirrorTargetKind;
  targetSongId: string;
  source: V2LiveMirrorSource;
  operation: V2LiveMirrorOperation;
  sourceUpdatedAtMs: number;
}): string => {
  const uid = requireSegment(input.uid, 'uid');
  const targetSongId = assertV2LiveMirrorTarget(input.targetKind, input.targetSongId);
  const sourceUpdatedAtMs = requireNonNegativeInteger(input.sourceUpdatedAtMs, 'sourceUpdatedAtMs');
  return [
    'v2m1',
    encodeURIComponent(uid),
    input.targetKind,
    targetSongId,
    input.source,
    input.operation,
    String(sourceUpdatedAtMs),
  ].join('::');
};

export const createV2MirrorMutationEnvelope = (input: {
  uid: string;
  targetKind: V2LiveMirrorTargetKind;
  targetSongId: string;
  source: V2LiveMirrorSource;
  operation: V2LiveMirrorOperation;
  sourceUpdatedAtMs: number;
  enqueuedAtMs?: number;
}): V2MirrorMutationEnvelope => {
  const uid = requireSegment(input.uid, 'uid');
  const targetSongId = assertV2LiveMirrorTarget(input.targetKind, input.targetSongId);
  const sourceUpdatedAtMs = requireNonNegativeInteger(input.sourceUpdatedAtMs, 'sourceUpdatedAtMs');
  const enqueuedAtMs = requireNonNegativeInteger(input.enqueuedAtMs ?? Date.now(), 'enqueuedAtMs');
  const mutationId = makeV2MirrorMutationId({
    uid,
    targetKind: input.targetKind,
    targetSongId,
    source: input.source,
    operation: input.operation,
    sourceUpdatedAtMs,
  });
  return Object.freeze({
    mutationId,
    uid,
    targetKind: input.targetKind,
    targetSongId,
    source: input.source,
    operation: input.operation,
    sourceUpdatedAtMs,
    enqueuedAtMs,
  });
};

export const compareV2MirrorVersion = (
  incoming: V2MirrorVersion,
  current?: V2MirrorVersion | null,
): V2MirrorConflictDecision => {
  const incomingAt = requireNonNegativeInteger(incoming.sourceUpdatedAtMs, 'incoming sourceUpdatedAtMs');
  const incomingMutationId = requireSegment(incoming.mutationId, 'incoming mutationId');
  if (!current) return 'apply';

  const currentAt = requireNonNegativeInteger(current.sourceUpdatedAtMs, 'current sourceUpdatedAtMs');
  const currentMutationId = requireSegment(current.mutationId, 'current mutationId');
  if (incomingAt > currentAt) return 'apply';
  if (incomingAt < currentAt) return 'stale';
  if (incomingMutationId === currentMutationId) return 'duplicate';

  // Same-millisecond multi-device events use the immutable mutation ID as a stable
  // tie-breaker. The later approved executor must persist both v2UpdatedAtMs and
  // v2MutationId so every device reaches the same winner deterministically.
  return incomingMutationId > currentMutationId ? 'apply' : 'stale';
};

export const getV2MirrorRetryDelayMs = (attemptNumberInput: number): number => {
  const attemptNumber = requireNonNegativeInteger(attemptNumberInput, 'attemptNumber');
  const exponent = Math.max(0, attemptNumber - 1);
  const raw = BACKEND_V2_MIRROR_RETRY_POLICY.baseDelayMs * (2 ** exponent);
  return Math.min(raw, BACKEND_V2_MIRROR_RETRY_POLICY.maxDelayMs);
};

export const isV2MirrorRetryExhausted = (attemptCountInput: number): boolean => {
  const attemptCount = requireNonNegativeInteger(attemptCountInput, 'attemptCount');
  return attemptCount >= BACKEND_V2_MIRROR_RETRY_POLICY.maxAttempts;
};
