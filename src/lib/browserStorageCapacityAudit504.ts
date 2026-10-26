/**
 * app504 – manual-only, read-only, browser storage capacity inventory.
 *
 * NEVER emit key names, IDs, tokens, values or song text.
 * The UTF-16 estimate is NOT browser-accounted quota usage.
 * This module never deletes/migrates/writes keys or performs server requests.
 */
export type StorageBucket504 =
  | '보존 주의: 저장 대기·초안'
  | '영속 캐시 묶음'
  | '최근곡 관련'
  | 'Music Note 관련'
  | 'Library 관련'
  | '기타·분류되지 않음';

export type StorageBucketTotal504 = {
  label: StorageBucket504;
  items: number;
  approxBytes: number;
};

export type StorageAreaAudit504 = {
  available: boolean;
  items: number;
  approxBytes: number;
  buckets: StorageBucketTotal504[];
};

export type BrowserStorageAudit504 = {
  local: StorageAreaAudit504;
  session: StorageAreaAudit504;
  browserUsageBytes: number | null;
  browserQuotaBytes: number | null;
  persisted: boolean | null;
};

const storageBucket504 = (key: string): StorageBucket504 => {
  const lowered = key.toLowerCase();
  if (/pending|outbox|draft|unsaved|studio_heart/.test(lowered)) return '보존 주의: 저장 대기·초안';
  if (key.startsWith('soridraw_cache_envelope_v1:')) return '영속 캐시 묶음';
  if (lowered.includes('recent')) return '최근곡 관련';
  if (lowered.includes('musicnote') || lowered.includes('music_note') || lowered.includes('favorite')) return 'Music Note 관련';
  if (lowered.includes('library') || lowered.includes('playlist')) return 'Library 관련';
  return '기타·분류되지 않음';
};

const auditArea504 = (area: 'localStorage' | 'sessionStorage'): StorageAreaAudit504 => {
  const unavailable: StorageAreaAudit504 = {
    available: false, items: 0, approxBytes: 0, buckets: [],
  };
  if (typeof window === 'undefined') return unavailable;
  try {
    const storage = window[area];
    if (!storage) return unavailable;
    const map = new Map<StorageBucket504, StorageBucketTotal504>();
    let items = 0;
    let approxBytes = 0;
    const count = storage.length;
    for (let index = 0; index < count; index += 1) {
      const key = storage.key(index);
      if (key === null) continue;
      const value = storage.getItem(key);
      if (value === null) continue;
      // Approximate code-unit bytes, never print, parse or transmit stored values.
      const bytes = (key.length + value.length) * 2;
      const label = storageBucket504(key);
      const entry = map.get(label) || { label, items: 0, approxBytes: 0 };
      entry.items += 1;
      entry.approxBytes += bytes;
      map.set(label, entry);
      items += 1;
      approxBytes += bytes;
    }
    return {
      available: true,
      items,
      approxBytes,
      buckets: Array.from(map.values()).sort((a, b) => b.approxBytes - a.approxBytes),
    };
  } catch {
    return unavailable;
  }
};

const boundedNumber504 = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Call only after an explicit Admin / CACHE LIVE click. */
export const inspectBrowserStorageCapacity504 = async (): Promise<BrowserStorageAudit504> => {
  const local = auditArea504('localStorage');
  const session = auditArea504('sessionStorage');
  let browserUsageBytes: number | null = null;
  let browserQuotaBytes: number | null = null;
  let persisted: boolean | null = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const info = await navigator.storage.estimate();
      browserUsageBytes = boundedNumber504(info.usage);
      browserQuotaBytes = boundedNumber504(info.quota);
    }
  } catch {
    // Restricted contexts can deny the estimator; do not infer zero usage.
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch {
    // No automatic persist permission request or quota-changing operations.
  }
  return { local, session, browserUsageBytes, browserQuotaBytes, persisted };
};
