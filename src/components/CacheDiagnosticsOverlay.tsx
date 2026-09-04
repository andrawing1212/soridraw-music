import React, { useCallback, useEffect, useRef, useState } from 'react';
import { auth, functions, httpsCallable } from '../firebase';
import {
  CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY,
  CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY,
  CACHE_DIAGNOSTICS_TOGGLE_EVENT,
  CACHE_DIAGNOSTICS_UPDATE_EVENT,
  FIRESTORE_ACTUAL_UPDATE_EVENT,
  readCacheDiagnostic,
  readCacheDiagnosticsEnabled,
  readFirestoreActual,
  resetCacheDiagnostics,
  type CacheDiagnosticDomain,
  type CacheDiagnosticState,
  type FirestoreActualState,
} from '../lib/cacheDiagnostics';
import {
  CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT,
  readCloudflareDiagnostics,
  resetCloudflareDiagnostics,
  type CloudflareDiagnosticState,
} from '../lib/cloudflareDiagnostics';
import { USER_PROFILE_CACHE_EVENT, readUserProfileCache } from '../lib/userProfileCache';
import { hasAdminPermission } from '../constants/adminPermissions';

const SORIDRAW_PROFILE_REVISION_DIAGNOSTICS_1000 = true;
const SORIDRAW_CACHE_LIVE_CLOUDFLARE_MOBILE_DOCK_977 = true;

const SORIDRAW_932_REFRESH_ROOT_WRITE_AND_SECTION_ROUTE_GATE = true;
const rows: Array<{ domain: CacheDiagnosticDomain; label: string }> = [
  { domain: 'sectionCustom', label: '섹션' },
  { domain: 'googleGeminiApiKey', label: 'API Key' },
  { domain: 'recentSongs', label: '최근곡' },
  { domain: 'musicNote', label: '뮤직노트' },
  { domain: 'library', label: '라이브러리' },
];

// SORIDRAW_928_CACHE_LIVE_OPAQUE
const PANEL_POSITION_STORAGE_KEY = 'soridraw_cache_live_position_v2';
const PANEL_COLLAPSED_STORAGE_KEY = 'soridraw_cache_live_collapsed_v1';
const PANEL_DOCKED_STORAGE_KEY = 'soridraw_cache_live_docked_v1';
const PANEL_MOBILE_BREAKPOINT = 767;
const PANEL_MARGIN = 8;
const PANEL_DEFAULT_WIDTH = 380;
const CLOUD_WINDOW_MINUTES = 10;

type PanelPosition = { x: number; y: number };
type UsageCounts = { reads: number; writes: number; deletes?: number; realtimeReads?: number };
type FirestoreServerUsage = {
  ok: boolean;
  source: 'cloud-monitoring';
  projectId: string;
  fetchedAt: number;
  sampledThroughMs: number;
  lagHintMs: number;
  dayStartMs: number;
  windowMinutes: number;
  documentOps: {
    today: UsageCounts;
    recent: UsageCounts;
  };
  billableUnits: {
    today: UsageCounts;
    recent: UsageCounts;
  };
};

const readAllStates = (): Record<CacheDiagnosticDomain, CacheDiagnosticState> => ({
  sectionCustom: readCacheDiagnostic('sectionCustom'),
  googleGeminiApiKey: readCacheDiagnostic('googleGeminiApiKey'),
  recentSongs: readCacheDiagnostic('recentSongs'),
  musicNote: readCacheDiagnostic('musicNote'),
  library: readCacheDiagnostic('library'),
});

const formatServerUsage = (state: Pick<CacheDiagnosticState, 'reads' | 'writes' | 'cacheHits'>) => {
  const server = state.reads + state.writes;
  return `서버 ${server}(읽기 ${state.reads},쓰기 ${state.writes}) · 캐시HIT ${state.cacheHits}`;
};

const formatActualUsage = (state: FirestoreActualState) => {
  const server = state.reads + state.writes;
  return `브라우저 SDK ${server}(읽기 ${state.reads},쓰기 ${state.writes}) · 캐시HIT ${state.cacheHits}`;
};

const formatNumber = (value: number | undefined) => new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(Number(value || 0))));

const getCloudflarePathLabel = (path: string) => {
  if (path === '/v1/feed') return '피드';
  if (path === '/v1/me/likes') return '좋아요 상태';
  if (path === '/v1/me/following-bundle') return '팔로우 상태 묶음';
  if (path === '/v1/me/publications') return '뮤직노트 공개상태';
  if (path === '/v1/me/music-note-publications-bundle') return '뮤직노트 공개상태';
  if (path === '/v1/tracks/:id/like') return '좋아요 변경';
  if (path === '/v1/tracks/:id/visibility') return '공개상태 변경';
  if (path === '/v1/profiles/:id/first-view') return '공개프로필';
  return path || '기타';
};

const readInitialPosition = (): PanelPosition => {
  if (typeof window === 'undefined') return { x: 12, y: 84 };
  try {
    const raw = window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const x = Number(parsed?.x);
      const y = Number(parsed?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
  } catch {}
  return {
    x: Math.max(PANEL_MARGIN, window.innerWidth - PANEL_DEFAULT_WIDTH - 12),
    y: 84,
  };
};

const readInitialCollapsed = () => {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY) === 'true'; } catch { return false; }
};

const readInitialDocked = () => {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(PANEL_DOCKED_STORAGE_KEY) === 'true'; } catch { return false; }
};

const getTodayStartMs = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
};

const getCallableErrorMessage = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  if (code.includes('not-found')) return 'Cloud 서버 지표 Function이 아직 배포되지 않았습니다.';
  if (code.includes('permission-denied')) return message || 'Cloud Monitoring 조회 권한이 필요합니다.';
  if (code.includes('unauthenticated')) return '관리자 로그인이 필요합니다.';
  return message || 'Cloud 서버 지표를 불러오지 못했습니다.';
};

const SORIDRAW_925_CACHE_LIVE_LARGE_SOURCE_TRACE = true;

export default function CacheDiagnosticsOverlay({ isAdmin }: { isAdmin: boolean }) {
  const [, setAccessRevision] = useState(0);
  const currentUid = String(auth.currentUser?.uid || '');
  const canUseDiagnostics = isAdmin || hasAdminPermission(readUserProfileCache(currentUid), 'appSettings');
  const [enabled, setEnabled] = useState(() => readCacheDiagnosticsEnabled(auth.currentUser?.uid));
  const [states, setStates] = useState<Record<CacheDiagnosticDomain, CacheDiagnosticState>>(() => readAllStates());
  const [actual, setActual] = useState<FirestoreActualState>(() => readFirestoreActual());
  const [position, setPosition] = useState<PanelPosition>(() => readInitialPosition());
  const [collapsed, setCollapsed] = useState(() => readInitialCollapsed());
  const [docked, setDocked] = useState(() => readInitialDocked());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= PANEL_MOBILE_BREAKPOINT);
  const [cloudflare, setCloudflare] = useState<CloudflareDiagnosticState>(() => readCloudflareDiagnostics());
  const [serverUsage, setServerUsage] = useState<FirestoreServerUsage | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const serverLoadingRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const clampPosition = useCallback((x: number, y: number): PanelPosition => {
    if (typeof window === 'undefined') return { x, y };
    const rect = panelRef.current?.getBoundingClientRect();
    const width = Math.min(rect?.width || PANEL_DEFAULT_WIDTH, Math.max(1, window.innerWidth - PANEL_MARGIN * 2));
    const height = Math.min(rect?.height || 52, Math.max(1, window.innerHeight - PANEL_MARGIN * 2));
    return {
      x: Math.min(Math.max(PANEL_MARGIN, x), Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)),
      y: Math.min(Math.max(PANEL_MARGIN, y), Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN)),
    };
  }, []);

  const persistPosition = useCallback((next: PanelPosition) => {
    try { window.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const loadServerUsage = useCallback(async () => {
    if (!canUseDiagnostics || !enabled || serverLoadingRef.current) return;
    serverLoadingRef.current = true;
    setServerLoading(true);
    setServerError('');
    try {
      const callable = httpsCallable(functions, 'getFirestoreServerUsage');
      const response: any = await callable({
        dayStartMs: getTodayStartMs(),
        windowMinutes: CLOUD_WINDOW_MINUTES,
      });
      const data = response?.data as FirestoreServerUsage | undefined;
      if (!data?.ok) throw new Error('Cloud Monitoring 응답이 올바르지 않습니다.');
      setServerUsage(data);
    } catch (error: any) {
      console.warn('[CACHE LIVE] Cloud server usage unavailable:', error);
      setServerError(getCallableErrorMessage(error));
    } finally {
      serverLoadingRef.current = false;
      setServerLoading(false);
    }
  }, [canUseDiagnostics, enabled]);

  useEffect(() => {
    const syncEnabled = () => setEnabled(readCacheDiagnosticsEnabled(auth.currentUser?.uid));
    const onToggle = () => {
      syncEnabled();
      setStates(readAllStates());
      setActual(readFirestoreActual());
    };
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ domain?: CacheDiagnosticDomain; state?: CacheDiagnosticState }>).detail;
      if (!detail?.domain || !detail.state) return;
      setStates((prev) => ({ ...prev, [detail.domain as CacheDiagnosticDomain]: detail.state as CacheDiagnosticState }));
    };
    const onActualUpdate = (event: Event) => {
      const detail = (event as CustomEvent<FirestoreActualState>).detail;
      if (!detail) return;
      setActual(detail);
    };
    const onCloudflareUpdate = (event: Event) => {
      const detail = (event as CustomEvent<CloudflareDiagnosticState>).detail;
      if (!detail) return;
      setCloudflare(detail);
    };
    const onProfileCache = () => {
      setAccessRevision((value) => value + 1);
      syncEnabled();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY || event.key === CACHE_DIAGNOSTICS_OWNER_UID_STORAGE_KEY) syncEnabled();
    };

    syncEnabled();
    setStates(readAllStates());
    setActual(readFirestoreActual());
    setCloudflare(readCloudflareDiagnostics());
    window.addEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
    window.addEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
    window.addEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);
    window.addEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);
    window.addEventListener(USER_PROFILE_CACHE_EVENT, onProfileCache as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
      window.removeEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
      window.removeEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);
      window.removeEventListener(CLOUDFLARE_DIAGNOSTICS_UPDATE_EVENT, onCloudflareUpdate as EventListener);
      window.removeEventListener(USER_PROFILE_CACHE_EVENT, onProfileCache as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false'); } catch {}
    const frame = window.requestAnimationFrame(() => {
      setPosition((prev) => {
        const next = clampPosition(prev.x, prev.y);
        persistPosition(next);
        return next;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [clampPosition, collapsed, persistPosition]);

  useEffect(() => {
    try { window.localStorage.setItem(PANEL_DOCKED_STORAGE_KEY, docked ? 'true' : 'false'); } catch {}
  }, [docked]);

  useEffect(() => {
    const onResize = () => {
      const nextMobile = window.innerWidth <= PANEL_MOBILE_BREAKPOINT;
      setIsMobile(nextMobile);
      if (!nextMobile) setDocked(false);
      setPosition((prev) => {
        const next = clampPosition(prev.x, prev.y);
        persistPosition(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPosition, persistPosition]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (isMobile && collapsed && !docked && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 42) {
        dragRef.current = null;
        setDocked(true);
      }
      return;
    }

    const next = clampPosition(
      drag.originX + deltaX,
      drag.originY + deltaY,
    );
    setPosition(next);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    const next = clampPosition(position.x, position.y);
    setPosition(next);
    persistPosition(next);
  };

  if (!canUseDiagnostics || !enabled) return null;

  const todayOps = serverUsage?.documentOps?.today;
  const recentOps = serverUsage?.documentOps?.recent;
  const recentBillable = serverUsage?.billableUnits?.recent;
  const sampledThrough = serverUsage?.sampledThroughMs
    ? new Date(serverUsage.sampledThroughMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const topReadSources = Object.entries(actual.readSources || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 6);
  const topWriteSources = Object.entries(actual.writeSources || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 4);
  const cloudflareMetered = cloudflare.meteredResponses > 0;
  const cloudflarePathEntries = Object.entries(cloudflare.paths || {})
    .filter(([, state]) => state.localCacheHits > 0 || state.workerRequests > 0 || state.d1RowsRead > 0 || state.d1RowsWritten > 0)
    .sort((a, b) => {
      const aScore = a[1].localCacheHits + a[1].d1RowsRead + a[1].d1RowsWritten + a[1].workerRequests;
      const bScore = b[1].localCacheHits + b[1].d1RowsRead + b[1].d1RowsWritten + b[1].workerRequests;
      return bScore - aScore;
    })
    .slice(0, 5);
  const hasR2Usage = cloudflare.r2ClassA > 0 || cloudflare.r2ClassB > 0;

  if (docked && isMobile) {
    return (
      <button
        type="button"
        title="CACHE LIVE 소형 패널 펼치기"
        aria-label="CACHE LIVE 소형 패널 펼치기"
        onClick={() => setDocked(false)}
        className="fixed bottom-[18px] right-2 z-[9998] grid h-11 w-11 place-items-center rounded-full border-0 bg-black/80 p-0 text-white/80 shadow-2xl outline-none backdrop-blur-md transition hover:bg-black/90 hover:text-white"
      >
        <span className="text-[10px] font-black tracking-[-0.02em]">CACHE</span>
        <span className="absolute bottom-[5px] right-[6px] min-w-[12px] rounded-full bg-white/10 px-1 text-[9px] font-black tabular-nums text-white/60">{formatNumber(cloudflare.workerRequests)}</span>
      </button>
    );
  }


  return (
    <div
      ref={panelRef}
      className="fixed z-[9998] w-[380px] max-w-[calc(100vw-16px)] rounded-2xl bg-black px-4 py-3.5 text-white/85 shadow-2xl"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={`${collapsed ? 'mb-0' : 'mb-2'} flex touch-none select-none items-center justify-between gap-2 cursor-grab active:cursor-grabbing`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-black tracking-[0.08em] text-white/90">CACHE LIVE</span>
            <span className="text-[11px] font-bold text-white/40">드래그 이동</span>
          </div>
          {collapsed ? (
            <div className="mt-1 truncate text-[11px] font-bold text-white/60">
              SDK 읽기 {formatNumber(actual.reads)} · CF {formatNumber(cloudflare.workerRequests)} · Cloud 읽기 {serverUsage ? formatNumber(todayOps?.reads) : '—'}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!collapsed ? (
            <button
              type="button"
              title="Cloud 서버 지표 새로고침"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void loadServerUsage()}
              className="border-0 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-black text-white/60 outline-none transition hover:bg-white/[0.10] hover:text-white/80 disabled:opacity-40"
              disabled={serverLoading}
            >
              {serverLoading ? '…' : '↻'}
            </button>
          ) : null}
          <button
            type="button"
            title={collapsed ? '펼치기' : '접기'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setCollapsed((prev) => !prev)}
            className="border-0 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-black text-white/60 outline-none transition hover:bg-white/[0.10] hover:text-white/80"
          >
            {collapsed ? '펼침' : '접기'}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="space-y-0.5">
            <div className="whitespace-nowrap text-[12px] font-bold text-white/76">{formatActualUsage(actual)}</div>
            <div className="whitespace-nowrap text-[12px] font-bold text-[#c6b5ff]">
              Cloudflare 앱 · LOCAL {formatNumber(cloudflare.localCacheHits)} · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}
            </div>
            {cloudflarePathEntries.length > 0 ? (
              <div className="mt-1 space-y-0.5 rounded-lg bg-[#c6b5ff]/[0.055] px-2 py-1.5">
                <div className="mb-0.5 text-[10px] font-black tracking-[0.04em] text-[#c6b5ff]/70">CLOUDFLARE 발생처</div>
                {cloudflarePathEntries.map(([path, state]) => (
                  <div key={path} className="space-y-0.5">
                    <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-[#c6b5ff]/82">
                      <span className="truncate">{getCloudflarePathLabel(path)}</span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums">LOCAL {formatNumber(state.localCacheHits)} · Worker {formatNumber(state.workerRequests)} · D1 읽기 {formatNumber(state.d1RowsRead)} · 쓰기 {formatNumber(state.d1RowsWritten)}</span>
                    </div>
                    {state.lastOutcome ? (
                      <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] font-bold text-[#c6b5ff]/58">
                        <span className="truncate">마지막 · {state.lastOutcome}{state.lastEdgeCache ? ` · ${state.lastEdgeCache}` : ''}</span>
                        <span className="shrink-0 whitespace-nowrap tabular-nums">검증 {formatNumber(state.revisionChecks)} · 304 {formatNumber(state.notModifiedResponses)} · 200 {formatNumber(state.fullResponses)} · {formatNumber(state.lastDurationMs)}ms</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {hasR2Usage ? (
              <div className="whitespace-nowrap text-[10px] font-bold text-[#c6b5ff]/72">
                R2 · Class A {formatNumber(cloudflare.r2ClassA)} · Class B {formatNumber(cloudflare.r2ClassB)}
              </div>
            ) : null}
            {cloudflare.unmeteredResponses > 0 ? (
              <div className="whitespace-nowrap text-[10px] font-bold text-[#c6b5ff]/55">
                계측 전 응답 {formatNumber(cloudflare.unmeteredResponses)} · 초기화 권장
              </div>
            ) : null}
            {topWriteSources.length > 0 ? (
              <div className="mt-1 rounded-lg bg-white/[0.025] px-2 py-1.5">
                <div className="mb-0.5 text-[10px] font-black tracking-[0.05em] text-white/42">SDK WRITE 발생처</div>
                <div className="space-y-0.5">
                  {topWriteSources.map(([source, count]) => (
                    <div key={`write-${source}`} className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-white/60">
                      <span className="truncate">{source}</span>
                      <span className="shrink-0 tabular-nums text-white/78">{formatNumber(Number(count))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {topReadSources.length > 0 ? (
              <div className="mt-1.5 rounded-xl bg-white/[0.035] px-2.5 py-2">
                <div className="mb-1 text-[10px] font-black tracking-[0.05em] text-white/45">SDK READ 발생처</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {topReadSources.map(([source, count]) => (
                    <div key={source} className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-white/62">
                      <span className="truncate">{source}</span>
                      <span className="shrink-0 tabular-nums text-white/82">{formatNumber(Number(count))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {serverUsage ? (
              <>
                <div className="whitespace-nowrap text-[12px] font-bold text-[#9fc7ff]">
                  Cloud 오늘 · 읽기 {formatNumber(todayOps?.reads)} · 쓰기 {formatNumber(todayOps?.writes)} · 삭제 {formatNumber(todayOps?.deletes)}
                </div>
                <div className="whitespace-nowrap text-[11px] font-bold text-[#9fc7ff]/78">
                  Cloud {serverUsage.windowMinutes}분 · 읽기 {formatNumber(recentOps?.reads)} · 쓰기 {formatNumber(recentOps?.writes)} · 삭제 {formatNumber(recentOps?.deletes)}
                </div>
                <div className="whitespace-nowrap text-[10px] font-bold text-white/48">
                  과금단위 {serverUsage.windowMinutes}분 · 읽기 {formatNumber(recentBillable?.reads)} · 실시간 {formatNumber(recentBillable?.realtimeReads)} · 쓰기 {formatNumber(recentBillable?.writes)}
                </div>
                <div className="whitespace-nowrap text-[10px] font-bold text-white/38">
                  Cloud Monitoring · 최대 약 4분 지연{sampledThrough ? ` · 최근표본 ${sampledThrough}` : ''}
                </div>
              </>
            ) : (
              <div className="whitespace-nowrap text-[10px] font-bold text-white/42">
                {serverLoading ? 'Cloud 서버 지표 불러오는 중…' : serverError || 'Cloud 서버 지표 대기'}
              </div>
            )}
            {serverError && serverUsage ? (
              <div className="text-[10px] font-bold leading-4 text-[#ff9d9d]/85">{serverError}</div>
            ) : null}
          </div>

          <div className="mt-2 space-y-1">
            {rows.map(({ domain, label }) => {
              const state = states[domain];
              const modeLabel = state.mode === 'IDLE' ? 'WAIT' : state.mode;
              return (
                <div key={domain} className="grid grid-cols-[70px_48px_1fr] items-center gap-1 text-[11px] font-bold leading-6 sm:grid-cols-[76px_52px_1fr] sm:text-[12px]">
                  <span className="truncate text-white/66">{label}</span>
                  <span className={state.mode === 'SYNC' ? 'text-[#ffbf66]' : state.mode === 'CACHE' ? 'text-[#9fddb9]' : 'text-white/34'}>{modeLabel}</span>
                  <span className="whitespace-nowrap text-right tabular-nums text-white/58">{formatServerUsage(state)}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                resetCacheDiagnostics();
                resetCloudflareDiagnostics();
                setStates(readAllStates());
                setActual(readFirestoreActual());
                setCloudflare(readCloudflareDiagnostics());
              }}
              className="border-0 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-black text-white/60 outline-none transition hover:bg-white/[0.10] hover:text-white/80"
            >
              진단 초기화
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
