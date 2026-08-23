export type CacheDiagnosticDomain = 'sectionCustom' | 'googleGeminiApiKey' | 'recentSongs' | 'musicNote' | 'library';
export type CacheDiagnosticMode = 'IDLE' | 'CACHE' | 'SYNC' | 'ERROR';

export type CacheDiagnosticState = {
  mode: CacheDiagnosticMode;
  reads: number;
  writes: number;
  cacheHits: number;
  lastReads: number;
  lastWrites: number;
  updatedAt: number;
};

export const CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY = 'soridraw_cache_diagnostics_enabled_v1';
export const CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY = 'soridraw_cache_diagnostics_owner_uid_v1';
export const CACHE_DIAGNOSTICS_TOGGLE_EVENT = 'soridraw:cache-diagnostics-toggle';
export const CACHE_DIAGNOSTICS_UPDATE_EVENT = 'soridraw:cache-diagnostics-update';
const CACHE_DIAGNOSTICS_STATE_STORAGE_BASE = 'soridraw_cache_diagnostics_state_v1';

const CACHE_DIAGNOSTIC_DOMAINS: CacheDiagnosticDomain[] = ['sectionCustom', 'googleGeminiApiKey', 'recentSongs', 'musicNote', 'library'];
const stateKey = (domain: CacheDiagnosticDomain) => `${CACHE_DIAGNOSTICS_STATE_STORAGE_BASE}_${domain}`;

const makeEmptyState = (updatedAt = 0): CacheDiagnosticState => ({
  mode: 'IDLE',
  reads: 0,
  writes: 0,
  cacheHits: 0,
  lastReads: 0,
  lastWrites: 0,
  updatedAt,
});

export function readCacheDiagnosticsEnabled(uid?: string | null): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY) !== 'true') return false;
    if (uid === undefined) return true;
    if (!uid) return false;
    return localStorage.getItem(CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY) === uid;
  } catch {
    return false;
  }
}

export function readCacheDiagnosticsGloballyEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function readCacheDiagnosticsOwnerUid(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

export function resetCacheDiagnostics(): void {
  if (typeof sessionStorage !== 'undefined') {
    for (const domain of CACHE_DIAGNOSTIC_DOMAINS) {
      try {
        sessionStorage.removeItem(stateKey(domain));
      } catch {}
    }
  }
  if (typeof window !== 'undefined') {
    for (const domain of CACHE_DIAGNOSTIC_DOMAINS) {
      const state = makeEmptyState(Date.now());
      window.dispatchEvent(new CustomEvent(CACHE_DIAGNOSTICS_UPDATE_EVENT, { detail: { domain, state } }));
    }
  }
}

export function setCacheDiagnosticsEnabled(enabled: boolean, ownerUid?: string | null): void {
  if (typeof localStorage !== 'undefined') {
    try {
      const wasEnabled = localStorage.getItem(CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY) === 'true';
      localStorage.setItem(CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
      if (enabled && ownerUid) {
        localStorage.setItem(CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY, ownerUid);
      } else if (!enabled) {
        localStorage.removeItem(CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY);
      }
      if (enabled && !wasEnabled) resetCacheDiagnostics();
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CACHE_DIAGNOSTICS_TOGGLE_EVENT, { detail: { enabled, ownerUid: ownerUid || null } }));
  }
}

export function readCacheDiagnostic(domain: CacheDiagnosticDomain): CacheDiagnosticState {
  const fallback = makeEmptyState();
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(stateKey(domain));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const mode: CacheDiagnosticMode = ['IDLE', 'CACHE', 'SYNC', 'ERROR'].includes(parsed?.mode) ? parsed.mode : 'IDLE';
    const reads = Number(parsed?.reads || 0);
    const writes = Number(parsed?.writes || 0);
    const cacheHits = Number(parsed?.cacheHits || 0);
    const lastReads = Number(parsed?.lastReads ?? parsed?.reads ?? 0);
    const lastWrites = Number(parsed?.lastWrites ?? 0);
    const updatedAt = Number(parsed?.updatedAt || 0);
    return {
      mode,
      reads: Number.isFinite(reads) && reads >= 0 ? Math.floor(reads) : 0,
      writes: Number.isFinite(writes) && writes >= 0 ? Math.floor(writes) : 0,
      cacheHits: Number.isFinite(cacheHits) && cacheHits >= 0 ? Math.floor(cacheHits) : 0,
      lastReads: Number.isFinite(lastReads) && lastReads >= 0 ? Math.floor(lastReads) : 0,
      lastWrites: Number.isFinite(lastWrites) && lastWrites >= 0 ? Math.floor(lastWrites) : 0,
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    };
  } catch {
    return fallback;
  }
}

export function markCacheDiagnostic(
  domain: CacheDiagnosticDomain,
  mode: CacheDiagnosticMode,
  reads = 0,
  writes = 0,
): void {
  const previous = readCacheDiagnostic(domain);
  const normalizedReads = Number.isFinite(reads) && reads >= 0 ? Math.floor(reads) : 0;
  const normalizedWrites = Number.isFinite(writes) && writes >= 0 ? Math.floor(writes) : 0;
  const next: CacheDiagnosticState = {
    mode,
    reads: previous.reads + (mode === 'SYNC' ? normalizedReads : 0),
    writes: previous.writes + (mode === 'SYNC' ? normalizedWrites : 0),
    cacheHits: previous.cacheHits + (mode === 'CACHE' ? 1 : 0),
    lastReads: normalizedReads,
    lastWrites: normalizedWrites,
    updatedAt: Date.now(),
  };
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(stateKey(domain), JSON.stringify(next));
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CACHE_DIAGNOSTICS_UPDATE_EVENT, { detail: { domain, state: next } }));
  }
}

export function markCacheDiagnosticWrite(domain: CacheDiagnosticDomain, writes = 1): void {
  markCacheDiagnostic(domain, 'SYNC', 0, writes);
}
