import React, { useEffect, useState } from 'react';
import {
  CACHE_DIAGNOSTICS_TOGGLE_EVENT,
  CACHE_DIAGNOSTICS_UPDATE_EVENT,
  readCacheDiagnostic,
  readCacheDiagnosticsEnabled,
  type CacheDiagnosticDomain,
  type CacheDiagnosticState,
} from '../lib/cacheDiagnostics';

export default function CacheDiagnosticBadge({
  domain,
  readLabel = '읽기',
  className = '',
}: {
  domain: CacheDiagnosticDomain;
  readLabel?: string;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(() => readCacheDiagnosticsEnabled());
  const [state, setState] = useState<CacheDiagnosticState>(() => readCacheDiagnostic(domain));

  useEffect(() => {
    setState(readCacheDiagnostic(domain));

    const onToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setEnabled(typeof detail?.enabled === 'boolean' ? detail.enabled : readCacheDiagnosticsEnabled());
    };
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ domain?: CacheDiagnosticDomain; state?: CacheDiagnosticState }>).detail;
      if (detail?.domain !== domain) return;
      setState(detail.state || readCacheDiagnostic(domain));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'soridraw_cache_diagnostics_enabled_v1') {
        setEnabled(readCacheDiagnosticsEnabled());
      }
    };

    window.addEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
    window.addEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CACHE_DIAGNOSTICS_TOGGLE_EVENT, onToggle as EventListener);
      window.removeEventListener(CACHE_DIAGNOSTICS_UPDATE_EVENT, onUpdate as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [domain]);

  if (!enabled) return null;

  const text = state.mode === 'IDLE'
    ? `WAIT · ${readLabel} 0`
    : state.mode === 'ERROR'
      ? `ERROR · ${readLabel} ${state.reads}`
      : `${state.mode} · ${readLabel} ${state.reads}`;

  return (
    <span
      className={`inline-flex select-none items-center text-[10px] font-black tracking-[0.08em] text-[var(--text-secondary)]/55 ${className}`}
      title="관리자 캐시 진단 · 이 표시는 서버 요청을 발생시키지 않습니다."
      aria-label={`캐시 진단 ${text}`}
    >
      {text}
    </span>
  );
}
