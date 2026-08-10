import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getLastSplitPerfBenchmarkSummary,
  getLastSplitPerfResult,
  isSplitPerfDiagnosticsEnabled,
  publishSplitPerfBenchmarkSummary,
  readSplitPerfToolVisibility,
  setSplitPerfDiagnosticsEnabled,
  SPLIT_PERF_BENCHMARK_REQUEST_EVENT,
  SPLIT_PERF_BENCHMARK_STATUS_EVENT,
  SPLIT_PERF_TOOL_VISIBILITY_EVENT,
  subscribeSplitPerfBenchmarkSummary,
  subscribeSplitPerfResult,
  type SplitPerfBenchmarkSummary,
  type SplitPerfResult,
} from './splitPerfDiagnostics';

const format = (value: number | null, suffix = '') => value === null ? '-' : `${value}${suffix}`;

type PerfProbeProfileId =
  | 'baseline'
  | 'effects-off'
  | 'media-off'
  | 'list-paint-off'
  | 'container-off'
  | 'area-list-off'
  | 'area-builder-off'
  | 'area-result-off'
  | 'area-both-off';
type PerfProbeRow = {
  id: PerfProbeProfileId;
  label: string;
  summary: SplitPerfBenchmarkSummary;
  fps: number;
  p95: number;
  renderPerSecond: number;
};

const PERF_RENDER_PROBE_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'baseline', label: '기준' },
  { id: 'effects-off', label: '효과 OFF' },
  { id: 'media-off', label: '이미지 OFF' },
  { id: 'list-paint-off', label: '리스트 Paint OFF' },
  { id: 'container-off', label: 'Container Query OFF' },
];

const PERF_AREA_PROBE_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'baseline', label: '기준' },
  { id: 'area-list-off', label: '현재 리스트 전체 OFF' },
  { id: 'area-builder-off', label: '왼쪽 pane 전체 OFF' },
  { id: 'area-result-off', label: '오른쪽 pane 전체 OFF' },
  { id: 'area-both-off', label: '좌우 콘텐츠 전체 OFF' },
];

const setPerfProbeProfile = (profile: PerfProbeProfileId) => {
  const root = document.documentElement;
  if (profile === 'baseline') delete root.dataset.soridrawPerfProbe;
  else root.dataset.soridrawPerfProbe = profile;
};

const getBrowserRenderPerSecond = (result: SplitPerfResult) => {
  const durationSeconds = Math.max(0.001, result.durationMs / 1000);
  const browserRender = result.hotspots.find((item) => item.label.startsWith('브라우저 렌더/레이아웃/페인트'))?.totalMs || 0;
  return Number((browserRender / durationSeconds).toFixed(1));
};


type PerfEnvironmentSnapshot = {
  createdAt: number;
  mode: string;
  prod: boolean;
  host: string;
  origin: string;
  viewport: string;
  dpr: number;
  idleHz: number | null;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  connection: string;
  saveData: boolean | null;
  swController: boolean;
  swRegistrations: number;
  cacheNames: number | null;
  scriptCount: number;
  scriptTransferKb: number;
  scriptDecodedKb: number;
  cssCount: number;
  cssTransferKb: number;
  cssRules: number | null;
  fontStatus: string;
  fontCount: number | null;
  assetMode: 'prod-bundle' | 'dev-modules' | 'unknown';
  buildProfile: string;
  cssMinifyMode: string;
};

const roundKb = (bytes: number) => Number((bytes / 1024).toFixed(1));

const estimateIdleRefreshHz = async () => new Promise<number | null>((resolve) => {
  const samples: number[] = [];
  let last = 0;
  const deadline = performance.now() + 900;
  const tick = (ts: number) => {
    if (last > 0) {
      const delta = ts - last;
      if (delta > 2 && delta < 80) samples.push(delta);
    }
    last = ts;
    if (samples.length >= 42 || performance.now() >= deadline) {
      if (samples.length < 6) {
        resolve(null);
        return;
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 0;
      resolve(median > 0 ? Number((1000 / median).toFixed(1)) : null);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const collectPerfEnvironmentSnapshot = async (): Promise<PerfEnvironmentSnapshot> => {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const scripts = resources.filter((entry) => entry.initiatorType === 'script' || /\.(?:m?js)(?:\?|$)/i.test(entry.name));
  const styles = resources.filter((entry) => entry.initiatorType === 'css' || /\.css(?:\?|$)/i.test(entry.name));
  const localScripts = scripts.filter((entry) => {
    try { return new URL(entry.name, location.href).origin === location.origin; } catch { return false; }
  });
  const viteEnv = (import.meta as ImportMeta & { env?: { MODE?: string; PROD?: boolean } }).env;
  const prodBundle = localScripts.some((entry) => /\/assets\/[^/]+-[A-Za-z0-9_-]+\.js(?:\?|$)/.test(entry.name));
  const devModules = localScripts.some((entry) => /\/src\/.+\.(?:tsx?|jsx?)(?:\?|$)/.test(entry.name)) || viteEnv?.PROD === false;

  let cssRules: number | null = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    try { cssRules += sheet.cssRules?.length || 0; } catch { cssRules = null; break; }
  }

  let swRegistrations = 0;
  if ('serviceWorker' in navigator) {
    try { swRegistrations = (await navigator.serviceWorker.getRegistrations()).length; } catch { /* optional */ }
  }

  let cacheNames: number | null = null;
  if ('caches' in window) {
    try { cacheNames = (await caches.keys()).length; } catch { /* optional */ }
  }

  const fonts = 'fonts' in document ? document.fonts : null;
  const connection = nav.connection;
  const connectionLabel = connection
    ? `${connection.effectiveType || '-'} · ${connection.downlink ?? '-'}Mbps · ${connection.rtt ?? '-'}ms`
    : '미지원';

  return {
    createdAt: Date.now(),
    mode: viteEnv?.MODE || (prodBundle ? 'production' : devModules ? 'development' : 'unknown'),
    prod: viteEnv?.PROD ?? prodBundle,
    host: location.host,
    origin: location.origin,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    dpr: Number(window.devicePixelRatio.toFixed(2)),
    idleHz: await estimateIdleRefreshHz(),
    hardwareConcurrency: Number.isFinite(nav.hardwareConcurrency) ? nav.hardwareConcurrency : null,
    deviceMemoryGb: Number.isFinite(nav.deviceMemory) ? nav.deviceMemory! : null,
    connection: connectionLabel,
    saveData: typeof connection?.saveData === 'boolean' ? connection.saveData : null,
    swController: Boolean(navigator.serviceWorker?.controller),
    swRegistrations,
    cacheNames,
    scriptCount: localScripts.length,
    scriptTransferKb: roundKb(localScripts.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
    scriptDecodedKb: roundKb(localScripts.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0)),
    cssCount: styles.length,
    cssTransferKb: roundKb(styles.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
    cssRules,
    fontStatus: fonts?.status || '미지원',
    fontCount: fonts ? fonts.size : null,
    assetMode: prodBundle ? 'prod-bundle' : devModules ? 'dev-modules' : 'unknown',
    buildProfile: '587 · PROD CSS minify A/B',
    cssMinifyMode: (viteEnv?.PROD ?? prodBundle) ? 'OFF (진단)' : 'DEV · 비적용',
  };
};

export default function SplitPerformanceDiagnostics({ isAdmin = false }: { isAdmin?: boolean }) {
  const [visible, setVisible] = useState(readSplitPerfToolVisibility());
  const [enabled, setEnabled] = useState(isSplitPerfDiagnosticsEnabled());
  const [result, setResult] = useState<SplitPerfResult | null>(getLastSplitPerfResult());
  const [benchmarkSummary, setBenchmarkSummary] = useState<SplitPerfBenchmarkSummary | null>(getLastSplitPerfBenchmarkSummary());
  const [collapsed, setCollapsed] = useState(false);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkMessage, setBenchmarkMessage] = useState('');
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeKind, setProbeKind] = useState<'render' | 'area'>('render');
  const [probeRows, setProbeRows] = useState<PerfProbeRow[]>([]);
  const [environment, setEnvironment] = useState<PerfEnvironmentSnapshot | null>(null);
  const [environmentRunning, setEnvironmentRunning] = useState(false);

  const probeRunningRef = useRef(false);
  const probeProfilesRef = useRef(PERF_RENDER_PROBE_PROFILES);
  const probeIndexRef = useRef(0);
  const probeHandledSummaryAtRef = useRef(0);
  const probeRowsRef = useRef<PerfProbeRow[]>([]);
  const probeBaselineRef = useRef<SplitPerfBenchmarkSummary | null>(null);
  const probeStartTimerRef = useRef<number | null>(null);

  useEffect(() => subscribeSplitPerfResult(setResult), []);
  useEffect(() => subscribeSplitPerfBenchmarkSummary(setBenchmarkSummary), []);

  const stopProbe = (restoreBaseline = true) => {
    probeRunningRef.current = false;
    setProbeRunning(false);
    setPerfProbeProfile('baseline');
    if (probeStartTimerRef.current !== null) {
      window.clearTimeout(probeStartTimerRef.current);
      probeStartTimerRef.current = null;
    }
    if (restoreBaseline && probeBaselineRef.current) {
      const baseline = probeBaselineRef.current;
      window.setTimeout(() => publishSplitPerfBenchmarkSummary(baseline.sets), 0);
    }
  };

  useEffect(() => () => {
    probeRunningRef.current = false;
    setPerfProbeProfile('baseline');
    if (probeStartTimerRef.current !== null) window.clearTimeout(probeStartTimerRef.current);
  }, []);

  useEffect(() => {
    const handleVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      const next = typeof detail?.enabled === 'boolean' ? detail.enabled : readSplitPerfToolVisibility();
      setVisible(next);
      if (!next) {
        stopProbe(false);
        setSplitPerfDiagnosticsEnabled(false);
        setEnabled(false);
        setBenchmarkRunning(false);
      } else {
        setSplitPerfDiagnosticsEnabled(true);
        setEnabled(true);
      }
    };
    window.addEventListener(SPLIT_PERF_TOOL_VISIBILITY_EVENT, handleVisibility as EventListener);
    return () => window.removeEventListener(SPLIT_PERF_TOOL_VISIBILITY_EVENT, handleVisibility as EventListener);
  }, []);

  useEffect(() => {
    const handleBenchmarkStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: 'running' | 'done' | 'error'; message?: string }>).detail;
      if (detail?.state === 'running') setBenchmarkRunning(true);
      if (detail?.state === 'done' || detail?.state === 'error') setBenchmarkRunning(false);
      if (detail?.message && !probeRunningRef.current) setBenchmarkMessage(detail.message);
      if (detail?.state === 'error' && probeRunningRef.current) {
        stopProbe(true);
        setBenchmarkMessage(`병목 스캔 중단 · ${detail.message || '자동 테스트 오류'}`);
      }
    };
    window.addEventListener(SPLIT_PERF_BENCHMARK_STATUS_EVENT, handleBenchmarkStatus as EventListener);
    return () => window.removeEventListener(SPLIT_PERF_BENCHMARK_STATUS_EVENT, handleBenchmarkStatus as EventListener);
  }, []);

  useEffect(() => {
    if (!benchmarkSummary || !probeRunningRef.current) return;
    if (benchmarkSummary.createdAt === probeHandledSummaryAtRef.current) return;
    probeHandledSummaryAtRef.current = benchmarkSummary.createdAt;

    const profiles = probeProfilesRef.current;
    const profile = profiles[probeIndexRef.current];
    if (!profile) return;
    const median = benchmarkSummary.median;
    const row: PerfProbeRow = {
      id: profile.id,
      label: profile.label,
      summary: benchmarkSummary,
      fps: median.estimatedFps,
      p95: median.p95FrameMs,
      renderPerSecond: getBrowserRenderPerSecond(median),
    };
    probeRowsRef.current = [...probeRowsRef.current, row];
    setProbeRows(probeRowsRef.current);
    if (profile.id === 'baseline') probeBaselineRef.current = benchmarkSummary;

    const nextIndex = probeIndexRef.current + 1;
    if (nextIndex >= profiles.length) {
      stopProbe(true);
      setBenchmarkMessage(probeKind === 'area'
        ? '영역 스캔 완료 · 렌더 비용이 크게 떨어지는 영역이 실제 병목 후보입니다.'
        : '렌더 스캔 완료 · 기준 대비 렌더 비용 감소폭이 큰 항목을 우선 확인하세요.');
      return;
    }

    probeIndexRef.current = nextIndex;
    const nextProfile = profiles[nextIndex];
    setPerfProbeProfile(nextProfile.id);
    setBenchmarkMessage(`${probeKind === 'area' ? '영역 스캔' : '렌더 스캔'} ${nextIndex + 1}/${profiles.length} · ${nextProfile.label}`);
    probeStartTimerRef.current = window.setTimeout(() => {
      probeStartTimerRef.current = null;
      if (!probeRunningRef.current) return;
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
    }, 420);
  }, [benchmarkSummary, probeKind]);

  useEffect(() => {
    if (!isAdmin || !visible) {
      setSplitPerfDiagnosticsEnabled(false);
      setEnabled(false);
      return;
    }
    setSplitPerfDiagnosticsEnabled(true);
    setEnabled(true);
  }, [isAdmin, visible]);

  const displayResult = benchmarkSummary?.median || result;

  const verdict = useMemo(() => {
    if (!displayResult) return '자동 테스트 권장';
    if (displayResult.estimatedFps >= 55 && displayResult.p95FrameMs <= 20) return '매우 양호';
    if (displayResult.estimatedFps >= 45 && displayResult.p95FrameMs <= 28) return '양호';
    if (displayResult.longTaskCount > 0 || displayResult.p95FrameMs >= 34) return '병목 있음';
    return '추가 최적화 필요';
  }, [displayResult]);

  const derived = useMemo(() => {
    if (!displayResult) return null;
    const frameSamples = Math.max(1, displayResult.rafFrames - 1);
    const durationSeconds = Math.max(0.001, displayResult.durationMs / 1000);
    const browserRender = displayResult.hotspots.find((item) => item.label.startsWith('브라우저 렌더/레이아웃/페인트'))?.totalMs || 0;
    return {
      over50Ratio: Number(((displayResult.over50ms / frameSamples) * 100).toFixed(1)),
      longTaskPerSecond: Number((displayResult.longTaskTotalMs / durationSeconds).toFixed(1)),
      browserRenderPerSecond: Number((browserRender / durationSeconds).toFixed(1)),
    };
  }, [displayResult]);

  const probeBaselineRender = probeRows.find((row) => row.id === 'baseline')?.renderPerSecond ?? null;

  const toggleEnabled = () => {
    const next = !enabled;
    if (!next) stopProbe(true);
    setSplitPerfDiagnosticsEnabled(next);
    setEnabled(next);
  };

  const ensureBenchmarkReady = () => {
    if (!enabled) {
      setSplitPerfDiagnosticsEnabled(true);
      setEnabled(true);
    }
    if (window.location.pathname !== '/studio') {
      setBenchmarkMessage('스튜디오의 분할 화면에서 자동 테스트를 실행하세요.');
      return false;
    }
    return true;
  };

  const runBenchmark = () => {
    if (!ensureBenchmarkReady()) return;
    setPerfProbeProfile('baseline');
    setBenchmarkRunning(true);
    setBenchmarkMessage('워밍업 후 같은 조건을 3세트 측정해 중앙값으로 판정합니다.');
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
  };

  const runProbeScan = (kind: 'render' | 'area') => {
    if (!ensureBenchmarkReady()) return;
    if (benchmarkRunning || probeRunningRef.current) return;
    const profiles = kind === 'area' ? PERF_AREA_PROBE_PROFILES : PERF_RENDER_PROBE_PROFILES;
    probeProfilesRef.current = profiles;
    probeRowsRef.current = [];
    probeBaselineRef.current = null;
    probeIndexRef.current = 0;
    probeHandledSummaryAtRef.current = 0;
    setProbeKind(kind);
    setProbeRows([]);
    probeRunningRef.current = true;
    setProbeRunning(true);
    setPerfProbeProfile(profiles[0].id);
    setBenchmarkMessage(`${kind === 'area' ? '영역 스캔' : '렌더 스캔'} 1/${profiles.length} · ${profiles[0].label} · 약 1분`);
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
  };

  const runEnvironmentDiagnostics = async () => {
    if (environmentRunning) return;
    setEnvironmentRunning(true);
    setBenchmarkMessage('실행 환경 진단 중 · idle rAF 주사율과 번들/PWA 상태를 확인합니다.');
    try {
      const snapshot = await collectPerfEnvironmentSnapshot();
      setEnvironment(snapshot);
      setBenchmarkMessage(`환경 진단 완료 · ${snapshot.prod ? 'PROD' : 'DEV'} / ${snapshot.assetMode} / CSS minify ${snapshot.cssMinifyMode} / idle ${snapshot.idleHz ?? '-'}Hz`);
    } catch (error) {
      setBenchmarkMessage(`환경 진단 실패 · ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setEnvironmentRunning(false);
    }
  };

  const copyEnvironmentReport = async () => {
    if (!environment) return;
    const report = [
      `SORIDRAW PERF ENV ${new Date(environment.createdAt).toISOString()}`,
      `host=${environment.host}`,
      `mode=${environment.mode} prod=${environment.prod} assetMode=${environment.assetMode}`,
      `buildProfile=${environment.buildProfile} cssMinify=${environment.cssMinifyMode}`,
      `viewport=${environment.viewport} DPR=${environment.dpr} idleHz=${environment.idleHz ?? '-'}`,
      `CPU=${environment.hardwareConcurrency ?? '-'} memoryGB=${environment.deviceMemoryGb ?? '-'}`,
      `SW controller=${environment.swController} registrations=${environment.swRegistrations} cacheNames=${environment.cacheNames ?? '-'}`,
      `JS local=${environment.scriptCount} transferKB=${environment.scriptTransferKb} decodedKB=${environment.scriptDecodedKb}`,
      `CSS=${environment.cssCount} transferKB=${environment.cssTransferKb} rules=${environment.cssRules ?? '-'}`,
      `fonts=${environment.fontStatus}/${environment.fontCount ?? '-'} connection=${environment.connection} saveData=${environment.saveData ?? '-'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      setBenchmarkMessage('환경 진단서 복사 완료');
    } catch {
      setBenchmarkMessage('환경 진단서 복사 실패 · 브라우저 클립보드 권한을 확인하세요.');
    }
  };

  if (!isAdmin || !visible) return null;

  return (
    <aside className={`soridraw-split-perf-panel${collapsed ? ' is-collapsed' : ''}`} aria-label="분할 성능 진단">
      <div className="soridraw-split-perf-head">
        <button type="button" onClick={toggleEnabled} className={enabled ? 'is-on' : ''}>
          PERF {enabled ? 'ON' : 'OFF'}
        </button>
        <strong>{probeRunning ? `${probeKind === 'area' ? '영역' : '렌더'} 스캔 중` : verdict}</strong>
        <button type="button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? '진단 펼치기' : '진단 접기'}>
          {collapsed ? '＋' : '－'}
        </button>
      </div>
      {!collapsed && (
        <div className="soridraw-split-perf-body">
          <div className="soridraw-split-perf-benchmark-row">
            <button type="button" onClick={runBenchmark} disabled={benchmarkRunning || probeRunning || !enabled}>
              {benchmarkRunning && !probeRunning ? '자동 테스트 중…' : '자동 테스트'}
            </button>
            <button type="button" className="is-secondary" onClick={() => runProbeScan('render')} disabled={benchmarkRunning || probeRunning || !enabled}>
              {probeRunning && probeKind === 'render' ? '렌더 스캔 중…' : '렌더 스캔'}
            </button>
            <button type="button" className="is-secondary" onClick={() => runProbeScan('area')} disabled={benchmarkRunning || probeRunning || !enabled}>
              {probeRunning && probeKind === 'area' ? '영역 스캔 중…' : '영역 스캔'}
            </button>
            <button type="button" className="is-secondary" onClick={runEnvironmentDiagnostics} disabled={environmentRunning || benchmarkRunning || probeRunning}>
              {environmentRunning ? '환경 진단 중…' : '환경 진단'}
            </button>
            <span>자동: 동일 DOM 3세트 · 렌더/영역 A/B · 환경: DEV/PROD·번들·PWA·idle Hz</span>
          </div>
          {benchmarkMessage && <p className="soridraw-split-perf-benchmark-message">{benchmarkMessage}</p>}
          {!displayResult ? (
            <p>자동 테스트를 누르면 사람 손 오차 없이 같은 거리와 같은 시간으로 분할 성능을 측정합니다.</p>
          ) : (
            <>
              <div className="soridraw-split-perf-columns">
                <section className="soridraw-split-perf-column is-summary">
                  <div className="soridraw-split-perf-source">
                    <span>{displayResult.host}</span>
                    <span>{displayResult.workspaceView}</span>
                    <span>{displayResult.viewport} · DPR {displayResult.dpr}</span>
                  </div>
                  {benchmarkSummary && (
                    <div className="soridraw-split-perf-set-strip">
                      <strong>3세트 중앙값</strong>
                      {benchmarkSummary.sets.map((set, index) => (
                        <span key={`${set.createdAt}-${index}`}>#{index + 1} {set.estimatedFps}fps · P95 {set.p95FrameMs}ms</span>
                      ))}
                    </div>
                  )}
                  <div className="soridraw-split-perf-grid is-metrics">
                    <span>측정 시간</span><b>{(displayResult.durationMs / 1000).toFixed(2)}s</b>
                    <span>추정 FPS</span><b>{displayResult.estimatedFps}</b>
                    <span>평균 프레임</span><b>{displayResult.avgFrameMs}ms</b>
                    <span>P95 / 최악</span><b>{displayResult.p95FrameMs} / {displayResult.maxFrameMs}ms</b>
                    <span>&gt;20 / &gt;34 / &gt;50ms</span><b>{displayResult.over20ms} / {displayResult.over34ms} / {displayResult.over50ms}</b>
                    <span>&gt;50ms 비율</span><b>{derived?.over50Ratio ?? 0}%</b>
                    <span>Long Task</span><b>{displayResult.longTaskCount}회 · {displayResult.longTaskTotalMs}ms</b>
                    <span>Long Task /초</span><b>{derived?.longTaskPerSecond ?? 0}ms/s</b>
                    <span>렌더 비JS /초</span><b>{derived?.browserRenderPerSecond ?? 0}ms/s</b>
                    <span>LoAF</span><b>{displayResult.loafSupported ? `${displayResult.loafCount}회 · ${displayResult.loafTotalMs}ms` : '미지원'}</b>
                    <span>LoAF blocking</span><b>{displayResult.loafSupported ? `${displayResult.loafBlockingTotalMs}ms` : '-'}</b>
                    <span>강제 Style/Layout</span><b>{displayResult.loafSupported ? `${displayResult.forcedStyleLayoutTotalMs} / max ${displayResult.forcedStyleLayoutMaxMs}ms` : '-'}</b>
                    <span>느린 입력 이벤트</span><b>{displayResult.eventTimingSupported ? `${displayResult.slowEventCount}회 · max ${displayResult.slowEventMaxMs}ms` : '미지원'}</b>
                    <span>입력 지연 평균/최대</span><b>{displayResult.eventTimingSupported ? `${displayResult.inputDelayAvgMs}/${displayResult.inputDelayMaxMs}ms` : '-'}</b>
                    <span>JS flush 평균/최대</span><b>{displayResult.flushAvgMs}/{displayResult.flushMaxMs}ms</b>
                    <span>실제 폭 반영 / 선만</span><b>{displayResult.contentCommitCount} / {displayResult.dividerOnlyCount}</b>
                    <span>apply 평균/최대</span><b>{displayResult.applyAvgMs}/{displayResult.applyMaxMs}ms</b>
                    <span>DOM 전체</span><b>{displayResult.domNodes.toLocaleString()}</b>
                    <span>좌/우 DOM</span><b>{displayResult.builderNodes.toLocaleString()} / {displayResult.resultNodes.toLocaleString()}</b>
                    <span>JS Heap</span><b>{format(displayResult.heapMb, 'MB')}</b>
                  </div>
                </section>

                <section className="soridraw-split-perf-column is-detail-column">
                  {environment && (
                    <details open className="soridraw-split-perf-env-details">
                      <summary>실행 환경 — DEV/PROD 차이 진단</summary>
                      <div className="soridraw-split-perf-env-strip">
                        <span><i>Build</i><b>{environment.prod ? 'PROD' : 'DEV'} · {environment.assetMode}</b></span>
                        <span><i>Build Test</i><b>{environment.buildProfile}</b></span>
                        <span><i>CSS minify</i><b>{environment.cssMinifyMode}</b></span>
                        <span><i>Idle Hz</i><b>{environment.idleHz ?? '-'}Hz</b></span>
                        <span><i>SW / Cache</i><b>{environment.swController ? 'CTRL' : '없음'} · {environment.swRegistrations}/{environment.cacheNames ?? '-'}</b></span>
                        <span><i>JS</i><b>{environment.scriptCount}개 · {environment.scriptDecodedKb}KB</b></span>
                        <span><i>CSS</i><b>{environment.cssCount}개 · rules {environment.cssRules ?? '-'}</b></span>
                        <span><i>CPU / RAM</i><b>{environment.hardwareConcurrency ?? '-'}T · {environment.deviceMemoryGb ?? '-'}GB</b></span>
                        <span><i>Viewport</i><b>{environment.viewport} · DPR {environment.dpr}</b></span>
                        <span><i>Network</i><b>{environment.connection}</b></span>
                      </div>
                      <div className="soridraw-split-perf-env-actions">
                        <span>{environment.host}</span>
                        <button type="button" onClick={copyEnvironmentReport}>진단서 복사</button>
                      </div>
                    </details>
                  )}
                  {probeRows.length > 0 && (
                    <details open>
                      <summary>{probeKind === 'area' ? '영역 이진 A/B — 기준 대비 렌더 비용' : '렌더 A/B — 기준 대비 렌더 비용'}</summary>
                      <div className="soridraw-split-perf-probe-grid">
                        {probeRows.map((row) => {
                          const delta = probeBaselineRender && row.id !== 'baseline'
                            ? Number((((row.renderPerSecond - probeBaselineRender) / probeBaselineRender) * 100).toFixed(1))
                            : 0;
                          return (
                            <div className="soridraw-split-perf-probe-row" key={row.id}>
                              <span>{row.label}</span>
                              <b>{row.renderPerSecond}ms/s</b>
                              <i className={delta < 0 ? 'is-better' : delta > 0 ? 'is-worse' : ''}>{row.id === 'baseline' ? '기준' : `${delta > 0 ? '+' : ''}${delta}%`}</i>
                              <em>{row.fps}fps · P95 {row.p95}ms</em>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  <details open>
                    <summary>영역 부담 — DOM 규모</summary>
                    <div className="soridraw-split-perf-grid is-detail">
                      <span>뮤직노트 상단/필터</span><b>{displayResult.regionNodes.musicNoteControls.toLocaleString()}</b>
                      <span>뮤직노트 리스트</span><b>{displayResult.regionNodes.musicNoteList.toLocaleString()}</b>
                      <span>라이브러리 상단/필터</span><b>{displayResult.regionNodes.libraryControls.toLocaleString()}</b>
                      <span>라이브러리 리스트</span><b>{displayResult.regionNodes.libraryList.toLocaleString()}</b>
                      <span>Studio 외부 UI</span><b>{displayResult.regionNodes.externalStudioUi.toLocaleString()}</b>
                      <span>기타 DOM</span><b>{displayResult.regionNodes.other.toLocaleString()}</b>
                    </div>
                  </details>

                  <details open>
                    <summary>병목 TOP — 누가 시간을 쓰는지</summary>
                    {displayResult.loafSupported ? (
                      displayResult.hotspots.length ? (
                        <div className="soridraw-split-perf-hotspots">
                          {displayResult.hotspots.slice(0, 5).map((item, index) => (
                            <div className="soridraw-split-perf-hotspot" key={`${item.label}-${index}`}>
                              <span><i>{index + 1}</i>{item.label}</span>
                              <b>{item.totalMs}ms · {item.count}회</b>
                              {item.forcedStyleLayoutMs > 0 && <em>forced layout {item.forcedStyleLayoutMs}ms</em>}
                            </div>
                          ))}
                        </div>
                      ) : <p>이번 드래그에서는 LoAF 스크립트 귀속 정보가 잡히지 않았습니다.</p>
                    ) : <p>이 Chrome에서는 Long Animation Frames API가 지원되지 않습니다.</p>}
                  </details>

                  <details open>
                    <summary>Lite V2 내부 단계</summary>
                    <div className="soridraw-split-perf-grid is-detail">
                      <span>폭/분할선 write</span><b>{displayResult.layoutWriteAvgMs}ms</b>
                      <span>반응형 판정</span><b>{displayResult.responsiveAvgMs}ms</b>
                      <span>외부 UI 동기화</span><b>{displayResult.externalAvgMs}ms</b>
                      <span>dataset/ARIA</span><b>{displayResult.miscAvgMs}ms</b>
                    </div>
                  </details>
                </section>
              </div>
              <p className="soridraw-split-perf-note is-compact">587: PROD 전용 CSS minify OFF A/B 빌드입니다. DEV는 기존과 동일하고, 테스트앱(PROD)만 CSS 축소를 끈 상태로 동일 자동 벤치마크를 비교해 production CSS 출력이 렌더 병목에 영향을 주는지 분리합니다.</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
