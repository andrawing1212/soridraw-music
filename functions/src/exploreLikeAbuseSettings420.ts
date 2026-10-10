import type { Database } from 'firebase-admin/database';

// Server-owned Master configuration; only READ from a cold/warm Function
// after a real click, never on page navigation. No user-controlled settings.
export type LikeAbuseSettings420 = {
  warningPerMinute: number;
  limitPerMinute: number;
  suspensionMinutes: number;
  version?: number;
  updatedAt?: number;
  updatedBy?: string;
};
export const DEFAULT_LIKE_ABUSE_SETTINGS_420: LikeAbuseSettings420 = {
  warningPerMinute: 30,
  limitPerMinute: 40,
  suspensionMinutes: 120,
};
export const LIKE_ABUSE_SETTINGS_PATH_420 = 'privateLikeSettings420/current';
const CACHE_TTL_MS_420 = 60_000;
let cached: { value: LikeAbuseSettings420; expiresAt: number } | null = null;

export const validateLikeAbuseSettings420 = (value: unknown): LikeAbuseSettings420 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_LIKE_ABUSE_SETTINGS');
  }
  const raw = value as Partial<LikeAbuseSettings420>;
  if (!Number.isInteger(Number(raw.warningPerMinute)) ||
      Number(raw.warningPerMinute) < 5 || Number(raw.warningPerMinute) > 100 ||
      !Number.isInteger(Number(raw.limitPerMinute)) ||
      Number(raw.limitPerMinute) <= Number(raw.warningPerMinute) ||
      Number(raw.limitPerMinute) > 200 ||
      !Number.isInteger(Number(raw.suspensionMinutes)) ||
      Number(raw.suspensionMinutes) < 15 || Number(raw.suspensionMinutes) > 1440) {
    throw new Error('INVALID_LIKE_ABUSE_SETTINGS');
  }
  return {
    warningPerMinute: Number(raw.warningPerMinute),
    limitPerMinute: Number(raw.limitPerMinute),
    suspensionMinutes: Number(raw.suspensionMinutes),
  };
};

// Fail closed for unexpected persisted config corruption rather than a
// broad automatic disable of all likes. The defaults remain bounded/safe.
export const readLikeAbuseSettings420 = async (
  database: Database,
  nowMs = Date.now(),
): Promise<LikeAbuseSettings420> => {
  if (cached && cached.expiresAt > nowMs) return cached.value;
  const snapshot = await database.ref(LIKE_ABUSE_SETTINGS_PATH_420).get();
  const raw = snapshot.val();
  const value = raw == null
    ? DEFAULT_LIKE_ABUSE_SETTINGS_420
    : validateLikeAbuseSettings420(raw);
  cached = { value, expiresAt: nowMs + CACHE_TTL_MS_420 };
  return value;
};

export const overrideCachedLikeAbuseSettings420 = (
  settings: LikeAbuseSettings420,
): void => {
  cached = { value: settings, expiresAt: Date.now() + CACHE_TTL_MS_420 };
};
