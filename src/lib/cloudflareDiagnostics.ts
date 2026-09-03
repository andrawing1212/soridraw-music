import { readCacheDiagnosticsGloballyEnabled } from './cacheDiagnostics';

export type CloudflarePathDiagnosticState = {
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  r2ClassA: number;
  r2ClassB: number;
  meteredResponses: number;
  unmeteredResponses: number;
  localCacheHits: number;
  revisionChecks: number;
  notModifiedResponses: number;
  fullResponses: number;
  responseBytes: number;
  lastStatus: number;
  lastDurationMs: number;
  lastOutcome: string;
  lastEdgeCache: string;
};

export type CloudflareDiagnosticState = {
  workerRequests: number;
  d1RowsRead: number;
  d1RowsWritten: number;
  r2ClassA: number;
  r2ClassB: number;
  meteredResponses: number;
  unmeteredResponses: number;
  localCacheHits: number;
  revisionChecks: number;
  notModifiedResponses: number;
  fullResponses: number;
  responseBytes: number;
  lastPath: string;
  paths: Record<string, CloudflarePathDiagnosticState>;
  updatedAt: number;
};

export type CloudflareResponseDiagnosticMeta = {
  conditional?: boolean;
  responseBytes?: number;
  durationMs?: number;
  outcome?: string;
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
  localCacheHits: 0,
  revisionChecks: 0,
  notModifiedResponses: 0,
  fullResponses: 0,
  responseBytes: 0,
  lastStatus: 0,
  lastDurationMs: 0,
  lastOutcome: '',
  lastEdgeCache: '',
});

const emptyState = (updatedAt = 0): CloudflareDiagnosticState => ({
  workerRequests: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  r2ClassA: 0,
  r2ClassB: 0,
  meteredResponses: 0,
  unmeteredResponses: 0,
  localCacheHits: 0,
  revisionChecks: 0,
  notModifiedResponses: 0,
  fullResponses: 0,
  responseBytes: 0,
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
  if (/^\/v1\/profiles\/[^/]+\/first-view$/.test(pathname)) return '/v1/profiles/:id/first-view';
  if (/^\/v1\/profiles\/[^/]+\/follow-state$/.test(pathname)) return '팔로우 상태 확인';
  if (/^\/v1\/profiles\/[^/]+\/follow$/.test(pathname)) return '팔로우 변경';
  if (/^\/v1\/profiles\/[^/]+\/tracks$/.test(pathname)) return '공개프로필 곡';
  if (/^\/v1\/profiles\/[^/]+$/.test(pathname)) return '공개프로필 정보';
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
        localCacheHits: normalizeCount(state?.localCacheHits),
        revisionChecks: normalizeCount(state?.revisionChecks),
        notModifiedResponses: normalizeCount(state?.notModifiedResponses),
        fullResponses: normalizeCount(state?.fullResponses),
        responseBytes: normalizeCount(state?.responseBytes),
        lastStatus: normalizeCount(state?.lastStatus),
        lastDurationMs: normalizeCount(state?.lastDurationMs),
        lastOutcome: String(state?.lastOutcome || '').slice(0, 96),
        lastEdgeCache: String(state?.lastEdgeCache || '').slice(0, 24),
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
      localCacheHits: normalizeCount(parsed?.localCacheHits),
      revisionChecks: normalizeCount(parsed?.revisionChecks),
      notModifiedResponses: normalizeCount(parsed?.notModifiedResponses),
      fullResponses: normalizeCount(parsed?.fullResponses),
      responseBytes: normalizeCount(parsed?.responseBytes),
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

export function recordCloudflareLocalCacheHit(path: string, outcome = 'LOCAL CACHE HIT'): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;
  const previous = readCloudflareDiagnostics();
  const resolvedPath = normalizeDiagnosticPath(path) || '기타';
  const previousPath = previous.paths[resolvedPath] || emptyPathState();
  writeCloudflareDiagnostics({
    ...previous,
    localCacheHits: previous.localCacheHits + 1,
    lastPath: resolvedPath,
    paths: {
      ...previous.paths,
      [resolvedPath]: {
        ...previousPath,
        localCacheHits: previousPath.localCacheHits + 1,
        lastStatus: 0,
        lastDurationMs: 0,
        lastOutcome: String(outcome || 'LOCAL CACHE HIT').slice(0, 96),
        lastEdgeCache: 'LOCAL',
      },
    },
    updatedAt: Date.now(),
  });
}

export function recordCloudflareResponse(
  response: Response,
  path = '',
  meta: CloudflareResponseDiagnosticMeta = {},
): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;

  const previous = readCloudflareDiagnostics();
  const diagnosticsVersion = String(response.headers.get('X-SORIDRAW-CF-Diagnostics') || '').trim();
  const metered = Boolean(diagnosticsVersion);
  const workerRequests = readUsageHeader(response, 'X-SORIDRAW-CF-Worker') || 1;
  const d1RowsRead = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Read') : 0;
  const d1RowsWritten = metered ? readUsageHeader(response, 'X-SORIDRAW-D1-Write') : 0;
  const r2ClassA = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-A') : 0;
  const r2ClassB = metered ? readUsageHeader(response, 'X-SORIDRAW-R2-B') : 0;
  const conditional = Boolean(meta.conditional);
  const notModified = response.status === 304;
  const fullResponse = response.status >= 200 && response.status < 300 && response.status !== 204;
  const responseBytes = normalizeCount(meta.responseBytes);
  const durationMs = normalizeCount(meta.durationMs);
  const edgeCache = String(response.headers.get('X-SORIDRAW-Profile-Edge-Cache') || '').trim().toUpperCase();
  const outcome = String(meta.outcome || (notModified ? 'REV 304' : fullResponse ? `FULL ${response.status}` : `HTTP ${response.status}`)).slice(0, 96);
  const resolvedPath = normalizeDiagnosticPath(path || (() => {
    try { return new URL(response.url).pathname; } catch { return ''; }
  })()) || '기타';
  const previousPath = previous.paths[resolvedPath] || emptyPathState();

  writeCloudflareDiagnostics({
    ...previous,
    workerRequests: previous.workerRequests + workerRequests,
    d1RowsRead: previous.d1RowsRead + d1RowsRead,
    d1RowsWritten: previous.d1RowsWritten + d1RowsWritten,
    r2ClassA: previous.r2ClassA + r2ClassA,
    r2ClassB: previous.r2ClassB + r2ClassB,
    meteredResponses: previous.meteredResponses + (metered ? 1 : 0),
    unmeteredResponses: previous.unmeteredResponses + (metered ? 0 : 1),
    revisionChecks: previous.revisionChecks + (conditional ? 1 : 0),
    notModifiedResponses: previous.notModifiedResponses + (notModified ? 1 : 0),
    fullResponses: previous.fullResponses + (fullResponse ? 1 : 0),
    responseBytes: previous.responseBytes + responseBytes,
    lastPath: resolvedPath,
    paths: {
      ...previous.paths,
      [resolvedPath]: {
        ...previousPath,
        workerRequests: previousPath.workerRequests + workerRequests,
        d1RowsRead: previousPath.d1RowsRead + d1RowsRead,
        d1RowsWritten: previousPath.d1RowsWritten + d1RowsWritten,
        r2ClassA: previousPath.r2ClassA + r2ClassA,
        r2ClassB: previousPath.r2ClassB + r2ClassB,
        meteredResponses: previousPath.meteredResponses + (metered ? 1 : 0),
        unmeteredResponses: previousPath.unmeteredResponses + (metered ? 0 : 1),
        revisionChecks: previousPath.revisionChecks + (conditional ? 1 : 0),
        notModifiedResponses: previousPath.notModifiedResponses + (notModified ? 1 : 0),
        fullResponses: previousPath.fullResponses + (fullResponse ? 1 : 0),
        responseBytes: previousPath.responseBytes + responseBytes,
        lastStatus: response.status,
        lastDurationMs: durationMs,
        lastOutcome: outcome,
        lastEdgeCache: edgeCache,
      },
    },
    updatedAt: Date.now(),
  });
}
