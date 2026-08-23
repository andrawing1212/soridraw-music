import React, { useEffect, useMemo, useState } from 'react';
import {
  CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY,
  CACHE_DIAGNOSTICS_TOGGLE_EVENT,
  CACHE_DIAGNOSTICS_UPDATE_EVENT,
  readCacheDiagnostic,
  readCacheDiagnosticsGloballyEnabled,
  resetCacheDiagnostics,
  type CacheDiagnosticDomain,
  type CacheDiagnosticState,
} from '../lib/cacheDiagnostics';

const rows: Array<{ domain: CacheDiagnosticDomain; label: string }> = [
  { domain: 'sectionCustom', label: '섹션' },
  { domain: 'googleGeminiApiKey', label: 'API Key' },
  { domain: 'recentSongs', label: '최근곡' },
  { domain: 'musicNote', label: '뮤직노트' },
  { domain: 'library', label: '라이브러리' },
];

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

export default function CacheDiagnosticsOverlay({ isAdmin }: { isAdmin: boolean }) {
  // Visibility is a device-local admin preference. Do not wait for Firebase auth
  // hydration to decide whether it is enabled; isAdmin alone gates the UI.
  const [enabled, setEnabled] = useState(() => readCacheDiagnosticsGloballyEnabled());
  const [states, setStates] = useState<Record<CacheDiagnosticDomain, CacheDiagnosticState>>(() => readAllStates());

  useEffect(() => {
    const syncEnabled = () => setEnabled(readCacheDiagnosticsGloballyEnabled());
    const onToggle = () => {
      syncEnabled();
      setStates(readAllStates());
    };
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ domain?: CacheDiagnosticDomain; state?: CacheDiagnosticState }>).detail;
      if (!detail?.domain || !detail.state) return;
      setStates((prev) => ({ ...prev, [detail.domain as CacheDiagnosticDomain]: detail.state as CacheDiagnosticState }));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CACHE_DIAGNOSTICS_ENABLED_STORAGE_KEY) syncEnabled();
    };

    syncEnabled();
    setStates(readAllStates());
    window.addEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
    window.addEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
      window.removeEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    const state = states[row.domain];
    acc.reads += state.reads;
    acc.writes += state.writes;
    acc.cacheHits += state.cacheHits;
    return acc;
  }, { reads: 0, writes: 0, cacheHits: 0 }), [states]);

  if (!isAdmin || !enabled) return null;

  return (
    <div className="fixed right-3 top-[84px] z-[9998] w-[278px] max-w-[calc(100vw-24px)] rounded-2xl bg-black/80 px-3 py-2.5 text-white/85 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-black tracking-[0.08em] text-white/90">CACHE LIVE</div>
          <div className="mt-0.5 whitespace-nowrap text-[9px] font-bold text-white/42">{formatServerUsage(totals)}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            resetCacheDiagnostics();
            setStates(readAllStates());
          }}
          className="rounded-lg bg-white/[0.06] px-2 py-1 text-[9px] font-black text-white/55 transition hover:bg-white/[0.10] hover:text-white/80"
        >
          초기화
        </button>
      </div>

      <div className="space-y-1">
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
    </div>
  );
}