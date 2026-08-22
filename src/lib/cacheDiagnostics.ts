export type CacheDiagnosticDomain = 'sectionCustom' | 'googleGeminiApiKey' | 'recentSongs' | 'musicNote' | 'library';
export type CacheDiagnosticMode = 'IDLE' | 'CACHE' | 'SYNC' | 'ERROR';

export type CacheDiagnosticState = {
  mode: CacheDiagnosticMode;
  reads: number;
  updatedAt: number;
};

export const CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY = 'soridraw_cache_diagnostics_enabled_v1';
export const CACHE_DIAGNOSTICS_TOGGLE_EVENT = 'soridraw:cache-diagnostics-toggle';
export const CACHE_DIAGNOSTICS_UPDATE_EVENT = 'soridraw:cache-diagnostics-update';
const CACHE_DIAGNOSTICS_STATE_STORAGE_BASE = 'soridraw_cache_diagnostics_state_v1';

const stateKey = (domain: CacheDiagnosticDomain) => `${CACHE_DIAGNOSTICS_STATE_STORAGE_BASE}_${domain}`;

export function readCacheDiagnosticsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setCacheDiagnosticsEnabled(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CACHE_DIAGNOSTICS_TOGGLE_EVENT, { detail: { enabled } }));
  }
}

export function readCacheDiagnostic(domain: CacheDiagnosticDomain): CacheDiagnosticState {
  const fallback: CacheDiagnosticState = { mode: 'IDLE', reads: 0, updatedAt: 0 };
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(stateKey(domain));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const mode: CacheDiagnosticMode = ['IDLE', 'CACHE', 'SYNC', 'ERROR'].includes(parsed?.mode) ? parsed.mode : 'IDLE';
    const reads = Number(parsed?.reads || 0);
    const updatedAt = Number(parsed?.updatedAt || 0);
    return {
      mode,
      reads: Number.isFinite(reads) && reads >= 0 ? Math.floor(reads) : 0,
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
): void {
  const next: CacheDiagnosticState = {
    mode,
    reads: Number.isFinite(reads) && reads >= 0 ? Math.floor(reads) : 0,
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
