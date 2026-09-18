import { readCacheDiagnosticsGloballyEnabled } from './cacheDiagnostics';

export type CatalogRuntimeDiagnosticKind = 'musicNote' | 'library';
export type CatalogRuntimeDiagnosticStage = 'IDLE' | 'START' | 'AUTH' | 'REQUEST' | 'HTTP' | 'SNAPSHOT' | 'ACCEPTED' | 'ERROR';
export type CatalogRuntimeDiagnosticState = {
  stage: CatalogRuntimeDiagnosticStage;
  attempt: number;
  httpStatus: number;
  remoteItemCount: number;
  revision: number;
  errorCode: string;
  updatedAt: number;
};
export const CATALOG_RUNTIME_DIAGNOSTICS_UPDATE_EVENT = 'soridraw:catalog-runtime-diagnostics-update';
const STORAGE_BASE = 'soridraw_catalog_runtime_diagnostics_v1';
const kinds: CatalogRuntimeDiagnosticKind[] = ['musicNote', 'library'];
const storageKey = (kind: CatalogRuntimeDiagnosticKind) => `${STORAGE_BASE}_${kind}`;
const emptyState = (): CatalogRuntimeDiagnosticState => ({ stage: 'IDLE', attempt: 0, httpStatus: 0, remoteItemCount: 0, revision: 0, errorCode: '', updatedAt: 0 });
const cleanError = (value: unknown) => String(value || '')
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
  .replace(/[A-Za-z0-9_-]{80,}/g, '[redacted]')
  .slice(0, 180);

export function readCatalogRuntimeDiagnostic(kind: CatalogRuntimeDiagnosticKind): CatalogRuntimeDiagnosticState {
  const fallback = emptyState();
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(storageKey(kind));
    if (!raw) return fallback;
    const value = JSON.parse(raw) || {};
    const allowedStages: CatalogRuntimeDiagnosticStage[] = ['IDLE', 'START', 'AUTH', 'REQUEST', 'HTTP', 'SNAPSHOT', 'ACCEPTED', 'ERROR'];
    const numberValue = (input: unknown) => {
      const n = Number(input || 0);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    };
    return {
      stage: allowedStages.includes(value.stage) ? value.stage : 'IDLE',
      attempt: numberValue(value.attempt),
      httpStatus: numberValue(value.httpStatus),
      remoteItemCount: numberValue(value.remoteItemCount),
      revision: numberValue(value.revision),
      errorCode: cleanError(value.errorCode),
      updatedAt: numberValue(value.updatedAt),
    };
  } catch {
    return fallback;
  }
}

export function markCatalogRuntimeDiagnostic(kind: CatalogRuntimeDiagnosticKind, patch: Partial<CatalogRuntimeDiagnosticState>): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;
  const previous = readCatalogRuntimeDiagnostic(kind);
  const next: CatalogRuntimeDiagnosticState = {
    ...previous,
    ...patch,
    errorCode: patch.errorCode === undefined ? previous.errorCode : cleanError(patch.errorCode),
    updatedAt: Date.now(),
  };
  try { sessionStorage.setItem(storageKey(kind), JSON.stringify(next)); } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CATALOG_RUNTIME_DIAGNOSTICS_UPDATE_EVENT, { detail: { kind, state: next } }));
  }
}

export function resetCatalogRuntimeDiagnostics(): void {
  for (const kind of kinds) {
    try { sessionStorage.removeItem(storageKey(kind)); } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CATALOG_RUNTIME_DIAGNOSTICS_UPDATE_EVENT, { detail: { kind, state: emptyState() } }));
    }
  }
}
