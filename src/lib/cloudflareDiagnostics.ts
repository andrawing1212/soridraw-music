import { readCacheDiagnosticsGloballyEnabled } from './cacheDiagnostics';

export type CloudflarePathDiagnosticState = {
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  r2ClassA: number;
  r2ClassB: number;
  meteredResponses: number;
  unmeteredResponses: number;
};

export type CloudflareDiagnosticState = {
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  r2ClassA: number;
  r2ClassB: number;
  meteredResponses: number;
  unmeteredResponses: number;
  lastPath: string;
  paths: Record<string, CloudflarePathDiagnosticState>;
  updatedAt: number;
};

export const CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT = 'soridraw:cloudflare-diagnostics-update';
const CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY = 'soridraw_cloudflare_diagnostics_v1';
const MAX_PATH_GROUPS = 24;

const emptyPathState = (): CloudflarePathDiagnosticState => ({
  workerRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  r2ClassA: 0,
  r2ClassB: 0,
  meteredResponses: 0,
  unmeteredResponses: 0,
});

const emptyState = (updatedAt = 0): CloudflareDiagnosticState => ({
  workerRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  r2ClassA: 0,
  r2ClassB: 0,
  meteredResponses: 0,
  unmeteredResponses: 0,
  lastPath: '',
  paths: {},
  updatedAt,
});

const normalizeCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizeDiagnosticPath = (value: string) => {
  let pathname = String(value || '').trim();
  if (!pathname) return '';
  try {
    if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
  } catch {}
  pathname = pathname.split('?')[0] || '';
  if (/^\/v1\/tracks\/[^/]+\/like$/.test(pathname)) return '/v1/tracks/:id/like';
  if (/^\/v1\/tracks\/[^/]+\/visibility$/.test(pathname)) return '/v1/tracks/:id/visibility';
  return pathname.slice(0, 120);
};

const readStoredPaths = (value: unknown): Record<string, CloudflarePathDiagnosticState> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, any>)
    .slice(0, MAX_PATH_GROUPS)
    .reduce<Record<string, CloudflarePathDiagnosticState>>((acc, [path, state]) => {
      const normalizedPath = normalizeDiagnosticPath(path);
      if (!normalizedPath) return acc;
      acc[normalizedPath] = {
        workerRequests: normalizeCount(state?.workerRequests),
        d1RowsRead: normalizeCount(state?.d1RowsRead),
        d1RowsWritten: normalizeCount(state?.d1RowsWritten),
        r2ClassA: normalizeCount(state?.r2ClassA),
        r2ClassB: normalizeCount(state?.r2ClassB),
        meteredResponses: normalizeCount(state?.meteredResponses),
        unmeteredResponses: normalizeCount(state?.unmeteredResponses),
      };
      return acc;
    }, {});
};

export function readCloudflareDiagnostics(): CloudflareDiagnosticState {
  const fallback = emptyState();
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      workerRequests: normalizeCount(parsed?.workerRequests),
      d1RowsRead: normalizeCount(parsed?.d1RowsRead),
      d1RowsWritten: normalizeCount(parsed?.d1RowsWritten),
      r2ClassA: normalizeCount(parsed?.r2ClassA),
      r2ClassB: normalizeCount(parsed?.r2ClassB),
      meteredResponses: normalizeCount(parsed?.meteredResponses),
      unmeteredResponses: normalizeCount(parsed?.unmeteredResponses),
      lastPath: String(parsed?.lastPath || ''),
      paths: readStoredPaths(parsed?.paths),
      updatedAt: normalizeCount(parsed?.updatedAt),
    };
  } catch {
    return fallback;
  }
}

const writeCloudflareDiagnostics = (next: CloudflareDiagnosticState) => {
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, { detail: next }));
  }
};

export function resetCloudflareDiagnostics(): void {
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.removeItem(CLOUDFLARE_DIAGNOSTICS_STORAGE_KEY); } catch {}
  }
  writeCloudflareDiagnostics(emptyState(Date.now()));
}

const readUsageHeader = (response: Response, name: string) => normalizeCount(response.headers.get(name));

export function recordCloudflareResponse(response: Response, path = ''): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;

  const previous = readCloudflareDiagnostics();
  const diagnosticsVersion = String(response.headers.get('X-SORIDRAW-CF-Diagnostics') || '').trim();
  const metered = Boolean(diagnosticsVersion);
  const workerRequests = readUsageHeader(response, 'X-SORIDRAW-CF-Worker') || 1;
  const d1RowsRead = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Read') : 0;
  const d1RowsWritten = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Write') : 0;
  const r2ClassA = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-A') : 0;
  const r2ClassB = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-B') : 0;
  const resolvedPath = normalizeDiagnosticPath(path || (() => {
    try { return new URL(response.url).pathname; } catch { return ''; }
  })()) || '기타';
  const previousPath = previous.paths[resolvedPath] || emptyPathState();

  writeCloudflareDiagnostics({
    workerRequests: previous.workerRequests + workerRequests,
    d1RowsRead: previous.d1RowsRead + d1RowsRead,
    d1RowsWritten: previous.d1RowsWritten + d1RowsWritten,
    r2ClassA: previous.r2ClassA + r2ClassA,
    r2ClassB: previous.r2ClassB + r2ClassB,
    meteredResponses: previous.meteredResponses + (metered ? 1 : 0),
    unmeteredResponses: previous.unmeteredResponses + (metered ? 0 : 1),
    lastPath: resolvedPath,
    paths: {
      ...previous.paths,
      [resolvedPath]: {
        workerRequests: previousPath.workerRequests + workerRequests,
        d1RowsRead: previousPath.d1RowsRead + d1RowsRead,
        d1RowsWritten: previousPath.d1RowsWritten + d1RowsWritten,
        r2ClassA: previousPath.r2ClassA + r2ClassA,
        r2ClassB: previousPath.r2ClassB + r2ClassB,
        meteredResponses: previousPath.meteredResponses + (metered ? 1 : 0),
        unmeteredResponses: previousPath.unmeteredResponses + (metered ? 0 : 1),
      },
    },
    updatedAt: Date.now(),
  });
}
