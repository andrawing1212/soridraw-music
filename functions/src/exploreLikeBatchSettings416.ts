import type { Database } from 'firebase-admin/database';

// Stage416 independent Master policy for PRIVATE acceptance and PUBLIC release.
// No normal user's page entry or like click needs to read this RTDB node.
export const LIKE_BATCH_TIMING_PATH_416 = 'likeBatchTiming416/current';
export const DEFAULT_LIKE_BATCH_TIMING_416 = {
  privateMinutes: 5,
  publicMinutes: 5,
} as const;
export type LikeBatchTiming416 = {
  privateMinutes: number;
  publicMinutes: number;
};
export const validLikeBatchMinutes416 = (value: unknown): value is number =>
  typeof value === 'number' && [1,3,5,10,20].includes(value);
export const parseLikeBatchTiming416 = (value: unknown): LikeBatchTiming416 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('416_INVALID_MASTER_TIMING');
  }
  const raw = value as Partial<LikeBatchTiming416>;
  if (!validLikeBatchMinutes416(raw.privateMinutes) ||
      !validLikeBatchMinutes416(raw.publicMinutes)) {
    throw new Error('416_INVALID_MASTER_TIMING');
  }
  return { privateMinutes: raw.privateMinutes, publicMinutes: raw.publicMinutes };
};
export type LikeBatchSettingsSnapshot416 = LikeBatchTiming416 & {
  version: number;
  updatedAtMs: number;
};
export const readLikeBatchTiming416 = async (
  database: Database, timingPath = LIKE_BATCH_TIMING_PATH_416,
): Promise<LikeBatchSettingsSnapshot416> => {
  const snapshot = await database.ref(timingPath).get();
  const raw = snapshot.val();
  if (raw == null) return { ...DEFAULT_LIKE_BATCH_TIMING_416, version: 0, updatedAtMs: 0 };
  const timing = parseLikeBatchTiming416(raw);
  const revision = Number(raw.version || 0);
  const updated = Number(raw.updatedAtMs || 0);
  if (!Number.isSafeInteger(revision) || revision < 0 ||
      !Number.isSafeInteger(updated) || updated < 0) throw new Error('416_CORRUPT_MASTER_REVISION');
  return { ...timing, version: revision, updatedAtMs: updated };
};
export const changeLikeBatchTiming416 = async (
  database: Database, masterUid: string, timing: LikeBatchTiming416,
  expectedVersion: number, nowMs = Date.now(),
  timingPath = LIKE_BATCH_TIMING_PATH_416,
): Promise<LikeBatchSettingsSnapshot416> => {
  const validated = parseLikeBatchTiming416(timing);
  if (!masterUid || masterUid.length > 128 ||
      !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0) throw new Error('416_INVALID_MASTER_WRITE');
  const outcome = await database.ref(timingPath).transaction((raw: unknown) => {
    const current = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown> : {};
    const version = Number(current.version || 0);
    if (!Number.isSafeInteger(version) || version !== expectedVersion ||
        version >= Number.MAX_SAFE_INTEGER) return;
    if (raw != null) parseLikeBatchTiming416(raw);
    if (current.privateMinutes === validated.privateMinutes &&
        current.publicMinutes === validated.publicMinutes) return;
    const log = Array.isArray(current.audit) ? current.audit : [];
    return {
      ...validated, version: version + 1, updatedAtMs: nowMs, updatedBy: masterUid,
      audit: [...log.slice(-9), {
        at: nowMs, masterUid,
        previous: raw == null ? DEFAULT_LIKE_BATCH_TIMING_416 : {
          privateMinutes: current.privateMinutes, publicMinutes: current.publicMinutes,
        },
        next: validated,
      }],
    };
  }, undefined, false);
  if (!outcome.committed) throw new Error('416_MASTER_VERSION_CONFLICT_OR_UNCHANGED');
  const value = outcome.snapshot.val();
  const saved = parseLikeBatchTiming416(value);
  return { ...saved, version: Number(value.version), updatedAtMs: Number(value.updatedAtMs) };
};
