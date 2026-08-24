import React, { useCallback, useEffect, useRef, useState } from 'react';
import { functions, httpsCallable } from '../firebase';
import {
  CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY,
  CACHE_DIAGNOSTICS_TOGGLE_EVENT,
  CACHE_DIAGNOSTICS_UPDATE_EVENT,
  FIRESTORE_ACTUAL_UPDATE_EVENT,
  readCacheDiagnostic,
  readCacheDiagnosticsGloballyEnabled,
  readFirestoreActual,
  resetCacheDiagnostics,
  type CacheDiagnosticDomain,
  type CacheDiagnosticState,
  type FirestoreActualState,
} from '../lib/cacheDiagnostics';

const rows: Array<{ domain: CacheDiagnosticDomain; label: string }> = [
  { domain: 'sectionCustom', label: '섹션' },
  { domain: 'googleGeminiApiKey', label: 'API Key' },
  { domain: 'recentSongs', label: '최근곡' },
  { domain: 'musicNote', label: '뮤직노트' },
  { domain: 'library', label: '라이브러리' },
];

const PANEL_POSITION_STORAGE_KEY = 'soridraw_cache_live_position_v2';
const PANEL_COLLAPSED_STORAGE_KEY = 'soridraw_cache_live_collapsed_v1';
const PANEL_MARGIN = 8;
const PANEL_DEFAULT_WIDTH = 278;
const CLOUD_REFRESH_MS = 60_000;
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
  return `서버 ${server}(읽기 ${state.reads},쓰기 ${state.writes}) · 캐시 ${state.cacheHits}`;
};

const formatActualUsage = (state: FirestoreActualState) => {
  const server = state.reads + state.writes;
  return `브라우저 SDK ${server}(읽기 ${state.reads},쓰기 ${state.writes}) · 캐시 ${state.cacheHits}`;
};

const formatNumber = (value: number | undefined) => new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.floor(Number(value || 0))));

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

export default function CacheDiagnosticsOverlay({ isAdmin }: { isAdmin: boolean }) {
  const [enabled, setEnabled] = useState(() => readCacheDiagnosticsGloballyEnabled());
  const [states, setStates] = useState<Record<CacheDiagnosticDomain, CacheDiagnosticState>>(() => readAllStates());
  const [actual, setActual] = useState<FirestoreActualState>(() => readFirestoreActual());
  const [position, setPosition] = useState<PanelPosition>(() => readInitialPosition());
  const [collapsed, setCollapsed] = useState(() => readInitialCollapsed());
  const [serverUsage, setServerUsage] = useState<FirestoreServerUsage | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
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
    if (!isAdmin || !enabled || serverLoading) return;
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
      setServerLoading(false);
    }
  }, [enabled, isAdmin, serverLoading]);

  useEffect(() => {
    const syncEnabled = () => setEnabled(readCacheDiagnosticsGloballyEnabled());
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
    const onStorage = (event: StorageEvent) => {
      if (event.key === CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY) syncEnabled();
    };

    syncEnabled();
    setStates(readAllStates());
    setActual(readFirestoreActual());
    window.addEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
    window.addEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
    window.addEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
      window.removeEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
      window.removeEventListener(FIRESTORE_ACTUAL_UPDATE_EVENT, onActualUpdate as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!isAdmin || !enabled || collapsed) return;
    void loadServerUsage();
    const timer = window.setInterval(() => {
      void loadServerUsage();
    }, CLOUD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [collapsed, enabled, isAdmin, loadServerUsage]);

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
    const onResize = () => {
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
    const next = clampPosition(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
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

  if (!isAdmin || !enabled) return null;

  const todayOps = serverUsage?.documentOps?.today;
  const recentOps = serverUsage?.documentOps?.recent;
  const recentBillable = serverUsage?.billableUnits?.recent;
  const sampledThrough = serverUsage?.sampledThroughMs
    ? new Date(serverUsage.sampledThroughMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      ref={panelRef}
      className="fixed z-[9998] w-[278px] max-w-[calc(100vw-16px)] rounded-2xl bg-black/80 px-3 py-2.5 text-white/85 shadow-2xl backdrop-blur-md"
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
            <span className="text-[11px] font-black tracking-[0.08em] text-white/90">CACHE LIVE</span>
            <span className="text-[8px] font-bold text-white/30">드래그 이동</span>
          </div>
          {collapsed ? (
            <div className="mt-0.5 truncate text-[8px] font-bold text-white/55">
              SDK 읽기 {formatNumber(actual.reads)} · Cloud 읽기 {serverUsage ? formatNumber(todayOps?.reads) : '—'}
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
              className="border-0 bg-white/[0.06] px-2 py-1 text-[9px] font-black text-white/55 outline-none transition hover:bg-white/[0.10] hover:text-white/80 disabled:opacity-40"
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
            className="border-0 bg-white/[0.06] px-2 py-1 text-[9px] font-black text-white/55 outline-none transition hover:bg-white/[0.10] hover:text-white/80"
          >
            {collapsed ? '펼침' : '접기'}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="space-y-0.5">
            <div className="whitespace-nowrap text-[9px] font-bold text-white/66">{formatActualUsage(actual)}</div>
            {serverUsage ? (
              <>
                <div className="whitespace-nowrap text-[9px] font-bold text-[#9fc7ff]">
                  Cloud 오늘 · 읽기 {formatNumber(todayOps?.reads)} · 쓰기 {formatNumber(todayOps?.writes)} · 삭제 {formatNumber(todayOps?.deletes)}
                </div>
                <div className="whitespace-nowrap text-[8px] font-bold text-[#9fc7ff]/75">
                  Cloud {serverUsage.windowMinutes}분 · 읽기 {formatNumber(recentOps?.reads)} · 쓰기 {formatNumber(recentOps?.writes)} · 삭제 {formatNumber(recentOps?.deletes)}
                </div>
                <div className="whitespace-nowrap text-[8px] font-bold text-white/42">
                  과금단위 {serverUsage.windowMinutes}분 · 읽기 {formatNumber(recentBillable?.reads)} · 실시간 {formatNumber(recentBillable?.realtimeReads)} · 쓰기 {formatNumber(recentBillable?.writes)}
                </div>
                <div className="whitespace-nowrap text-[7px] font-bold text-white/28">
                  Cloud Monitoring · 최대 약 4분 지연{sampledThrough ? ` · 최근표본 ${sampledThrough}` : ''}
                </div>
              </>
            ) : (
              <div className="whitespace-nowrap text-[8px] font-bold text-white/35">
                {serverLoading ? 'Cloud 서버 지표 불러오는 중…' : serverError || 'Cloud 서버 지표 대기'}
              </div>
            )}
            {serverError && serverUsage ? (
              <div className="text-[7px] font-bold leading-3 text-[#ff9d9d]/80">{serverError}</div>
            ) : null}
            <div className="whitespace-nowrap text-[7px] font-bold text-white/25">위=프로젝트 Cloud / SDK · 아래=기능별 참고값</div>
          </div>

          <div className="mt-2 space-y-1">
            {rows.map(({ domain, label }) => {
              const state = states[domain];
              const modeLabel = state.mode === 'IDLE' ? 'WAIT' : state.mode;
              return (
                <div key={domain} className="grid grid-cols-[50px_38px_1fr] items-center gap-1 text-[8px] font-bold leading-5 sm:grid-cols-[58px_42px_1fr] sm:text-[9px]">
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
                setStates(readAllStates());
                setActual(readFirestoreActual());
              }}
              className="border-0 bg-white/[0.06] px-2 py-1 text-[9px] font-black text-white/55 outline-none transition hover:bg-white/[0.10] hover:text-white/80"
            >
              SDK 초기화
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
