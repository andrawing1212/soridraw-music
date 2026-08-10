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
  SPLIT_PERF_INPUT_MODE_EVENT,
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
  | 'area-both-off'
  | 'layout-css-var'
  | 'layout-direct'
  | 'musicnote-transition-off'
  | 'musicnote-row-paint-off'
  | 'musicnote-content-visibility-off'
  | 'musicnote-region-contain-off'
  | 'musicnote-responsive-freeze';
type PerfProbeRow = {
  id: PerfProbeProfileId;
  label: string;
  summary: SplitPerfBenchmarkSummary;
  fps: number;
  p95: number;
  renderPerSecond: number;
};

type ManualInputRow = {
  mode: 'react' | 'native';
  result: SplitPerfResult;
};

const PERF_RENDER_PROBE_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'baseline', label: '기준' },
  { id: 'effects-off', label: '효과 OFF' },
  { id: 'media-off', label: '이미지 OFF' },
  { id: 'list-paint-off', label: '리스트 Paint OFF' },
  { id: 'container-off', label: 'Container Query OFF' },
];

const PERF_LAYOUT_PROBE_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'layout-css-var', label: 'CSS 변수 좌표' },
  { id: 'layout-direct', label: '직접 pane 좌표' },
];

const PERF_AREA_PROBE_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'baseline', label: '기준' },
  { id: 'area-list-off', label: '현재 리스트 전체 OFF' },
  { id: 'area-builder-off', label: '왼쪽 pane 전체 OFF' },
  { id: 'area-result-off', label: '오른쪽 pane 전체 OFF' },
  { id: 'area-both-off', label: '좌우 콘텐츠 전체 OFF' },
];

const PERF_MUSICNOTE_RESIDUAL_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'baseline', label: '기준' },
  { id: 'musicnote-transition-off', label: '전환효과 전체 OFF' },
  { id: 'musicnote-row-paint-off', label: '카드 내부 Paint OFF' },
  { id: 'musicnote-content-visibility-off', label: '오프스크린 최적화 OFF' },
  { id: 'musicnote-region-contain-off', label: '영역 contain OFF' },
  { id: 'musicnote-responsive-freeze', label: '반응형 판정 고정' },
];

const setPerfProbeProfile = (profile: PerfProbeProfileId) => {
  const root = document.documentElement;
  if (profile === 'baseline' || profile === 'layout-css-var' || profile === 'layout-direct') delete root.dataset.soridrawPerfProbe;
  else root.dataset.soridrawPerfProbe = profile;
};

const getPerfProbeLayoutMode = (profile: PerfProbeProfileId): 'css-var' | 'direct' =>
  profile === 'layout-css-var' ? 'css-var' : 'direct';

const getBrowserRenderPerSecond = (result: SplitPerfResult) => {
  const durationSeconds = Math.max(0.001, result.durationMs / 1000);
  const browserRender = result.hotspots.find((item) => item.label.startsWith('브라우저 렌더/레이아웃/페인트'))?.totalMs || 0;
  return Number((browserRender / durationSeconds).toFixed(1));
};


type PerfStyleCostCounts = {
  scanned: number;
  contain: number;
  layoutContain: number;
  paintContain: number;
  contentVisibility: number;
  containerType: number;
  transform: number;
  filter: number;
  backdropFilter: number;
  boxShadow: number;
  transition: number;
  willChange: number;
  fixed: number;
  sticky: number;
  overflowClipOrScroll: number;
};

type PerfStyleTargetSnapshot = {
  label: string;
  selector: string;
  found: boolean;
  width: number | null;
  height: number | null;
  display: string;
  position: string;
  overflow: string;
  contain: string;
  contentVisibility: string;
  containerType: string;
  containerName: string;
  transform: string;
  filter: string;
  backdropFilter: string;
  boxShadow: string;
  transition: string;
  willChange: string;
};

type PerfStylesheetSnapshot = {
  index: number;
  source: string;
  local: boolean;
  rules: number | null;
};

type PerfComputedStyleDiagnostics = {
  costs: PerfStyleCostCounts;
  targets: PerfStyleTargetSnapshot[];
  stylesheets: PerfStylesheetSnapshot[];
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
  jsMinifyMode: string;
  computedStyles: PerfComputedStyleDiagnostics;
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

const compactStyleValue = (value: string, maxLength = 64) => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '-';
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1)}…`;
};

const hasNonZeroTransition = (style: CSSStyleDeclaration) => {
  const durations = String(style.transitionDuration || '')
    .split(',')
    .map((value) => Number.parseFloat(value) || 0);
  const delays = String(style.transitionDelay || '')
    .split(',')
    .map((value) => Number.parseFloat(value) || 0);
  return durations.some((value) => value > 0) || delays.some((value) => value > 0);
};

const collectComputedStyleDiagnostics = (): PerfComputedStyleDiagnostics => {
  const workspace = document.querySelector('.soridraw-lite-studio-split-workspace');
  const nodes = workspace ? [workspace, ...Array.from(workspace.querySelectorAll('*'))] : [];
  const costs: PerfStyleCostCounts = {
    scanned: nodes.length,
    contain: 0,
    layoutContain: 0,
    paintContain: 0,
    contentVisibility: 0,
    containerType: 0,
    transform: 0,
    filter: 0,
    backdropFilter: 0,
    boxShadow: 0,
    transition: 0,
    willChange: 0,
    fixed: 0,
    sticky: 0,
    overflowClipOrScroll: 0,
  };

  for (const node of nodes) {
    const style = getComputedStyle(node);
    const contain = String(style.contain || 'none');
    const backdrop = String((style as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter || 'none');
    if (contain !== 'none') costs.contain += 1;
    if (/layout|strict|content/.test(contain)) costs.layoutContain += 1;
    if (/paint|strict|content/.test(contain)) costs.paintContain += 1;
    if (String(style.contentVisibility || 'visible') !== 'visible') costs.contentVisibility += 1;
    if (String(style.containerType || 'normal') !== 'normal') costs.containerType += 1;
    if (String(style.transform || 'none') !== 'none') costs.transform += 1;
    if (String(style.filter || 'none') !== 'none') costs.filter += 1;
    if (backdrop !== 'none') costs.backdropFilter += 1;
    if (String(style.boxShadow || 'none') !== 'none') costs.boxShadow += 1;
    if (hasNonZeroTransition(style)) costs.transition += 1;
    if (String(style.willChange || 'auto') !== 'auto') costs.willChange += 1;
    if (style.position === 'fixed') costs.fixed += 1;
    if (style.position === 'sticky') costs.sticky += 1;
    if ([style.overflowX, style.overflowY].some((value) => ['auto', 'scroll', 'hidden', 'clip'].includes(value))) {
      costs.overflowClipOrScroll += 1;
    }
  }

  const targetConfigs: Array<{ label: string; selector: string }> = [
    { label: 'workspace', selector: '.soridraw-lite-studio-split-workspace' },
    { label: 'builder-pane', selector: '.soridraw-lite-studio-split-workspace > .soridraw-studio-builder-pane' },
    { label: 'result-pane', selector: '.soridraw-lite-studio-split-workspace > .soridraw-studio-result-pane' },
    { label: 'musicnote-page', selector: '.soridraw-musicnote-page-shell' },
    { label: 'musicnote-top', selector: '.soridraw-musicnote-region-top' },
    { label: 'musicnote-list', selector: '.soridraw-musicnote-list-start-divider' },
    { label: 'musicnote-card', selector: '.soridraw-musicnote-song-card' },
    { label: 'library-page', selector: '.soridraw-library-theme' },
    { label: 'library-top', selector: '.soridraw-library-region-top' },
    { label: 'library-list', selector: '.soridraw-library-list-start-divider' },
    { label: 'library-row', selector: '.soridraw-library-playlist-row, .soridraw-library-workspace-track-row' },
  ];
  const targets: PerfStyleTargetSnapshot[] = targetConfigs.map(({ label, selector }): PerfStyleTargetSnapshot => {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (!element) {
      return {
        label, selector, found: false, width: null, height: null,
        display: '-', position: '-', overflow: '-', contain: '-', contentVisibility: '-',
        containerType: '-', containerName: '-', transform: '-', filter: '-', backdropFilter: '-',
        boxShadow: '-', transition: '-', willChange: '-',
      };
    }
    const style = getComputedStyle(element);
    const backdrop = String((style as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter || 'none');
    return {
      label,
      selector,
      found: true,
      width: element.offsetWidth,
      height: element.offsetHeight,
      display: compactStyleValue(style.display),
      position: compactStyleValue(style.position),
      overflow: `${compactStyleValue(style.overflowX, 24)}/${compactStyleValue(style.overflowY, 24)}`,
      contain: compactStyleValue(style.contain),
      contentVisibility: compactStyleValue(style.contentVisibility),
      containerType: compactStyleValue(style.containerType),
      containerName: compactStyleValue(style.containerName),
      transform: compactStyleValue(style.transform),
      filter: compactStyleValue(style.filter),
      backdropFilter: compactStyleValue(backdrop),
      boxShadow: compactStyleValue(style.boxShadow),
      transition: hasNonZeroTransition(style)
        ? compactStyleValue(`${style.transitionProperty} ${style.transitionDuration}`, 72)
        : 'none',
      willChange: compactStyleValue(style.willChange),
    };
  });

  const stylesheets: PerfStylesheetSnapshot[] = Array.from(document.styleSheets).map((sheet, index) => {
    const owner = sheet.ownerNode as HTMLElement | null;
    const devId = owner?.getAttribute?.('data-vite-dev-id');
    let source = sheet.href || devId || `[inline:${owner?.tagName?.toLowerCase() || 'style'}]`;
    try {
      if (sheet.href) {
        const url = new URL(sheet.href, location.href);
        source = url.origin === location.origin ? `${url.pathname}${url.search}` : url.href;
      } else if (devId) {
        source = `dev:${devId.split('/').slice(-3).join('/')}`;
      }
    } catch { /* diagnostics only */ }
    let rules: number | null = null;
    try { rules = sheet.cssRules?.length ?? 0; } catch { rules = null; }
    let local = true;
    if (sheet.href) {
      try { local = new URL(sheet.href, location.href).origin === location.origin; } catch { local = false; }
    }
    return { index, source, local, rules };
  });

  return { costs, targets, stylesheets };
};

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
    buildProfile: '593 · real pointer pipeline A/B + manual drag recorder',
    cssMinifyMode: (viteEnv?.PROD ?? prodBundle) ? 'ON (정상)' : 'DEV · 비적용',
    jsMinifyMode: (viteEnv?.PROD ?? prodBundle) ? 'ON (정상)' : 'DEV · 비적용',
    computedStyles: collectComputedStyleDiagnostics(),
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
  const [probeKind, setProbeKind] = useState<'render' | 'area' | 'layout' | 'musicnote'>('render');
  const [probeRows, setProbeRows] = useState<PerfProbeRow[]>([]);
  const [renderProbeRows, setRenderProbeRows] = useState<PerfProbeRow[]>([]);
  const [areaProbeRows, setAreaProbeRows] = useState<PerfProbeRow[]>([]);
  const [layoutProbeRows, setLayoutProbeRows] = useState<PerfProbeRow[]>([]);
  const [musicNoteProbeRows, setMusicNoteProbeRows] = useState<PerfProbeRow[]>([]);
  const [environment, setEnvironment] = useState<PerfEnvironmentSnapshot | null>(null);
  const [environmentRunning, setEnvironmentRunning] = useState(false);
  const [manualInputRunning, setManualInputRunning] = useState(false);
  const [manualInputRows, setManualInputRows] = useState<ManualInputRow[]>([]);

  const probeRunningRef = useRef(false);
  const probeProfilesRef = useRef(PERF_RENDER_PROBE_PROFILES);
  const probeIndexRef = useRef(0);
  const probeHandledSummaryAtRef = useRef(0);
  const probeRowsRef = useRef<PerfProbeRow[]>([]);
  const probeBaselineRef = useRef<SplitPerfBenchmarkSummary | null>(null);
  const probeStartTimerRef = useRef<number | null>(null);
  const manualInputRunningRef = useRef(false);
  const manualInputPhaseRef = useRef<'react' | 'native'>('react');
  const manualInputHandledAtRef = useRef(0);

  useEffect(() => subscribeSplitPerfResult(setResult), []);
  useEffect(() => subscribeSplitPerfBenchmarkSummary(setBenchmarkSummary), []);

  useEffect(() => {
    if (!result || !manualInputRunningRef.current) return;
    if (result.createdAt === manualInputHandledAtRef.current || result.benchmarkSurface !== null) return;
    if (result.workspaceView !== 'music-note') return;
    const expectedMode = manualInputPhaseRef.current;
    if (result.inputMode !== expectedMode) return;
    if (result.durationMs < 1800) {
      manualInputHandledAtRef.current = result.createdAt;
      setBenchmarkMessage(`${expectedMode === 'react' ? 'React' : 'Native'} 입력 기록이 너무 짧습니다 · 분할바를 3~5초 정도 계속 움직인 뒤 놓으세요.`);
      return;
    }

    manualInputHandledAtRef.current = result.createdAt;
    setManualInputRows((current) => [...current.filter((row) => row.mode !== expectedMode), { mode: expectedMode, result }]);
    if (expectedMode === 'react') {
      manualInputPhaseRef.current = 'native';
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_INPUT_MODE_EVENT, { detail: { mode: 'native' } }));
      setBenchmarkMessage('실사용 입력 A/B 2/2 · Native 입력입니다. 같은 느낌으로 분할바를 3~5초 계속 움직인 뒤 놓으세요.');
      return;
    }

    manualInputRunningRef.current = false;
    setManualInputRunning(false);
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_INPUT_MODE_EVENT, { detail: { mode: 'react' } }));
    setBenchmarkMessage('실사용 입력 A/B 완료 · 실제 마우스 입력 경로의 React vs Native 차이를 기록했습니다.');
  }, [result]);

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
    manualInputRunningRef.current = false;
    setPerfProbeProfile('baseline');
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_INPUT_MODE_EVENT, { detail: { mode: 'react' } }));
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
    const nextRows = [...probeRowsRef.current, row];
    probeRowsRef.current = nextRows;
    setProbeRows(nextRows);
    if (probeKind === 'render') setRenderProbeRows(nextRows);
    else if (probeKind === 'area') setAreaProbeRows(nextRows);
    else if (probeKind === 'layout') setLayoutProbeRows(nextRows);
    else setMusicNoteProbeRows(nextRows);
    if (probeIndexRef.current === 0) probeBaselineRef.current = benchmarkSummary;

    const nextIndex = probeIndexRef.current + 1;
    if (nextIndex >= profiles.length) {
      stopProbe(true);
      setBenchmarkMessage(probeKind === 'area'
        ? '영역 스캔 완료 · 렌더 비용이 크게 떨어지는 영역이 실제 병목 후보입니다.'
        : probeKind === 'layout'
          ? '좌표 A/B 완료 · 같은 1400×900 표면에서 CSS 변수와 직접 좌표를 비교했습니다.'
          : probeKind === 'musicnote'
            ? '뮤직노트 정밀 스캔 완료 · 끊김을 가장 크게 줄인 항목만 실제 최적화 후보로 사용합니다.'
            : '렌더 스캔 완료 · 기준 대비 렌더 비용 감소폭이 큰 항목을 우선 확인하세요.');
      return;
    }

    probeIndexRef.current = nextIndex;
    const nextProfile = profiles[nextIndex];
    setPerfProbeProfile(nextProfile.id);
    setBenchmarkMessage(`${probeKind === 'area' ? '영역 스캔' : probeKind === 'layout' ? '좌표 A/B' : probeKind === 'musicnote' ? '뮤직노트 정밀' : '렌더 스캔'} ${nextIndex + 1}/${profiles.length} · ${nextProfile.label}`);
    probeStartTimerRef.current = window.setTimeout(() => {
      probeStartTimerRef.current = null;
      if (!probeRunningRef.current) return;
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT, { detail: { layoutMode: getPerfProbeLayoutMode(nextProfile.id) } }));
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

  const runManualInputAB = () => {
    if (!ensureBenchmarkReady()) return;
    if (benchmarkRunning || probeRunningRef.current || manualInputRunningRef.current) return;
    if (!document.querySelector('.soridraw-musicnote-page-shell')) {
      setBenchmarkMessage('실사용 입력 A/B는 뮤직노트가 열린 분할 화면에서 실행하세요.');
      return;
    }
    manualInputRunningRef.current = true;
    manualInputPhaseRef.current = 'react';
    manualInputHandledAtRef.current = 0;
    setManualInputRows([]);
    setManualInputRunning(true);
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_INPUT_MODE_EVENT, { detail: { mode: 'react' } }));
    setBenchmarkMessage('실사용 입력 A/B 1/2 · 현재 React 입력입니다. 분할바를 평소처럼 3~5초 계속 움직인 뒤 놓으세요.');
  };

  const runProbeScan = (kind: 'render' | 'area' | 'layout' | 'musicnote') => {
    if (!ensureBenchmarkReady()) return;
    if (benchmarkRunning || probeRunningRef.current) return;
    if (kind === 'musicnote' && !document.querySelector('.soridraw-musicnote-page-shell')) {
      setBenchmarkMessage('뮤직노트 정밀 스캔은 뮤직노트가 열린 분할 화면에서 실행하세요.');
      return;
    }
    const profiles = kind === 'area'
      ? PERF_AREA_PROBE_PROFILES
      : kind === 'layout'
        ? PERF_LAYOUT_PROBE_PROFILES
        : kind === 'musicnote'
          ? PERF_MUSICNOTE_RESIDUAL_PROFILES
          : PERF_RENDER_PROBE_PROFILES;
    probeProfilesRef.current = profiles;
    probeRowsRef.current = [];
    probeBaselineRef.current = null;
    probeIndexRef.current = 0;
    probeHandledSummaryAtRef.current = 0;
    setProbeKind(kind);
    setProbeRows([]);
    if (kind === 'render') setRenderProbeRows([]);
    else if (kind === 'area') setAreaProbeRows([]);
    else if (kind === 'layout') setLayoutProbeRows([]);
    else setMusicNoteProbeRows([]);
    probeRunningRef.current = true;
    setProbeRunning(true);
    setPerfProbeProfile(profiles[0].id);
    setBenchmarkMessage(`${kind === 'area' ? '영역 스캔' : kind === 'layout' ? '좌표 A/B' : kind === 'musicnote' ? '뮤직노트 정밀' : '렌더 스캔'} 1/${profiles.length} · ${profiles[0].label}`);
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT, { detail: { layoutMode: getPerfProbeLayoutMode(profiles[0].id) } }));
  };

  const runEnvironmentDiagnostics = async () => {
    if (environmentRunning) return;
    setEnvironmentRunning(true);
    setBenchmarkMessage('실행 환경 진단 중 · idle Hz + PROD/DEV computed style/cascade를 비교할 준비를 합니다.');
    try {
      const snapshot = await collectPerfEnvironmentSnapshot();
      setEnvironment(snapshot);
      setBenchmarkMessage(`환경 진단 완료 · ${snapshot.prod ? 'PROD' : 'DEV'} / ${snapshot.assetMode} / style ${snapshot.computedStyles.costs.scanned} nodes / idle ${snapshot.idleHz ?? '-'}Hz`);
    } catch (error) {
      setBenchmarkMessage(`환경 진단 실패 · ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setEnvironmentRunning(false);
    }
  };

  const buildEnvironmentReportLines = (snapshot: PerfEnvironmentSnapshot) => {
    const style = snapshot.computedStyles;
    return [
      `SORIDRAW PERF ENV ${new Date(snapshot.createdAt).toISOString()}`,
      `host=${snapshot.host}`,
      `mode=${snapshot.mode} prod=${snapshot.prod} assetMode=${snapshot.assetMode}`,
      `buildProfile=${snapshot.buildProfile} jsMinify=${snapshot.jsMinifyMode} cssMinify=${snapshot.cssMinifyMode}`,
      `viewport=${snapshot.viewport} DPR=${snapshot.dpr} idleHz=${snapshot.idleHz ?? '-'}`,
      `CPU=${snapshot.hardwareConcurrency ?? '-'} memoryGB=${snapshot.deviceMemoryGb ?? '-'}`,
      `SW controller=${snapshot.swController} registrations=${snapshot.swRegistrations} cacheNames=${snapshot.cacheNames ?? '-'}`,
      `JS local=${snapshot.scriptCount} transferKB=${snapshot.scriptTransferKb} decodedKB=${snapshot.scriptDecodedKb}`,
      `CSS=${snapshot.cssCount} transferKB=${snapshot.cssTransferKb} rules=${snapshot.cssRules ?? '-'}`,
      `fonts=${snapshot.fontStatus}/${snapshot.fontCount ?? '-'} connection=${snapshot.connection} saveData=${snapshot.saveData ?? '-'}`,
      '',
      '[COMPUTED STYLE COST COUNTS]',
      `scanned=${style.costs.scanned} contain=${style.costs.contain} layoutContain=${style.costs.layoutContain} paintContain=${style.costs.paintContain} contentVisibility=${style.costs.contentVisibility} containerType=${style.costs.containerType}`,
      `transform=${style.costs.transform} filter=${style.costs.filter} backdropFilter=${style.costs.backdropFilter} boxShadow=${style.costs.boxShadow} transition=${style.costs.transition} willChange=${style.costs.willChange}`,
      `fixed=${style.costs.fixed} sticky=${style.costs.sticky} overflowClipOrScroll=${style.costs.overflowClipOrScroll}`,
      '[COMPUTED STYLE TARGETS]',
      ...style.targets.map((target) => target.found
        ? `${target.label} ${target.width}x${target.height} display=${target.display} pos=${target.position} overflow=${target.overflow} contain=${target.contain} contentVis=${target.contentVisibility} container=${target.containerType}/${target.containerName} transform=${target.transform} filter=${target.filter} backdrop=${target.backdropFilter} shadow=${target.boxShadow} transition=${target.transition} willChange=${target.willChange}`
        : `${target.label} NOT_FOUND selector=${target.selector}`),
      '[STYLESHEET ORDER]',
      ...style.stylesheets.map((sheet) => `#${sheet.index} local=${sheet.local} rules=${sheet.rules ?? '-'} source=${sheet.source}`),
    ];
  };

  const copyEnvironmentReport = async () => {
    if (!environment) return;
    try {
      await navigator.clipboard.writeText(buildEnvironmentReportLines(environment).join('\n'));
      setBenchmarkMessage('환경 진단서 복사 완료');
    } catch {
      setBenchmarkMessage('환경 진단서 복사 실패 · 브라우저 클립보드 권한을 확인하세요.');
    }
  };

  const formatProbeLines = (title: string, rows: PerfProbeRow[]) => {
    if (!rows.length) return [`[${title}] 미측정`];
    const baseline = rows.find((row) => row.id === 'baseline')?.renderPerSecond || 0;
    return [
      `[${title}]`,
      ...rows.map((row) => {
        const delta = baseline > 0 && row.id !== 'baseline'
          ? Number((((row.renderPerSecond - baseline) / baseline) * 100).toFixed(1))
          : 0;
        return `${row.label}: render=${row.renderPerSecond}ms/s fps=${row.fps} p95=${row.p95}ms${row.id === 'baseline' ? '' : ` delta=${delta > 0 ? '+' : ''}${delta}%`}`;
      }),
    ];
  };

  const copyComprehensiveReport = async () => {
    if (environmentRunning) return;
    setEnvironmentRunning(true);
    setBenchmarkMessage('종합 진단서 작성 중 · 최신 환경 정보를 함께 수집합니다.');
    try {
      const snapshot = await collectPerfEnvironmentSnapshot();
      setEnvironment(snapshot);
      const current = benchmarkSummary?.median || result;
      const lines = [
        `SORIDRAW PERF FULL REPORT ${new Date().toISOString()}`,
        ...buildEnvironmentReportLines(snapshot),
        '',
        '[AUTO BENCHMARK]',
      ];
      if (current) {
        const durationSeconds = Math.max(0.001, current.durationMs / 1000);
        const frameSamples = Math.max(1, current.rafFrames - 1);
        const browserRender = current.hotspots.find((item) => item.label.startsWith('브라우저 렌더/레이아웃/페인트'))?.totalMs || 0;
        lines.push(
          `workspace=${current.workspaceView} duration=${(current.durationMs / 1000).toFixed(2)}s fps=${current.estimatedFps} avg=${current.avgFrameMs}ms p95=${current.p95FrameMs}ms max=${current.maxFrameMs}ms`,
          `benchmarkSurface=${current.benchmarkSurface ?? '-'} pass=${current.benchmarkSurfacePass ?? '-'} layoutMode=${current.layoutMode ?? '-'}`, 
          `over20/34/50=${current.over20ms}/${current.over34ms}/${current.over50ms} over50Ratio=${((current.over50ms / frameSamples) * 100).toFixed(1)}%`,
          `longTask=${current.longTaskCount}/${current.longTaskTotalMs}ms longTaskPerSec=${(current.longTaskTotalMs / durationSeconds).toFixed(1)}ms/s`,
          `browserRenderPerSec=${(browserRender / durationSeconds).toFixed(1)}ms/s loaf=${current.loafCount}/${current.loafTotalMs}ms blocking=${current.loafBlockingTotalMs}ms`,
          `forcedStyleLayout=${current.forcedStyleLayoutTotalMs}ms max=${current.forcedStyleLayoutMaxMs}ms`,
          `flush=${current.flushAvgMs}/${current.flushMaxMs}ms apply=${current.applyAvgMs}/${current.applyMaxMs}ms contentCommit/divider=${current.contentCommitCount}/${current.dividerOnlyCount}`,
          `pointerMode=${current.inputMode ?? '-'} events=${current.pointerEventCount} rate=${current.pointerEventsPerSecond}/s coalesced=${current.pointerCoalescedCount} intervalAvg/P95=${current.pointerIntervalAvgMs}/${current.pointerIntervalP95Ms}ms batchAvg/max=${current.pointerBatchAvg}/${current.pointerBatchMax} inputToCommitAvg/P95/max=${current.inputToCommitAvgMs}/${current.inputToCommitP95Ms}/${current.inputToCommitMaxMs}ms`,
          `DOM total=${current.domNodes} builder=${current.builderNodes} result=${current.resultNodes} heapMB=${current.heapMb ?? '-'}`,
          `regions musicNoteControls=${current.regionNodes.musicNoteControls} musicNoteList=${current.regionNodes.musicNoteList} libraryControls=${current.regionNodes.libraryControls} libraryList=${current.regionNodes.libraryList} externalStudioUi=${current.regionNodes.externalStudioUi} other=${current.regionNodes.other}`,
        );
        if (benchmarkSummary?.sets?.length) {
          lines.push(`sets=${benchmarkSummary.sets.map((set, index) => `#${index + 1}:${set.estimatedFps}fps/P95${set.p95FrameMs}ms`).join(' | ')}`);
        }
        lines.push('[HOTSPOTS]');
        current.hotspots.slice(0, 8).forEach((item, index) => {
          lines.push(`#${index + 1} ${item.label}: total=${item.totalMs}ms count=${item.count} max=${item.maxMs}ms forced=${item.forcedStyleLayoutMs}ms`);
        });
        lines.push(
          `[LITE V2] layoutWrite=${current.layoutWriteAvgMs}ms responsive=${current.responsiveAvgMs}ms external=${current.externalAvgMs}ms misc=${current.miscAvgMs}ms`,
        );
      } else {
        lines.push('미측정 · 자동 테스트를 먼저 실행하세요.');
      }
      lines.push(
        '',
        ...formatProbeLines('RENDER A/B', renderProbeRows),
        '',
        ...formatProbeLines('AREA A/B', areaProbeRows),
        '',
        ...formatProbeLines('LAYOUT A/B', layoutProbeRows),
        '',
        ...formatProbeLines('MUSICNOTE RESIDUAL A/B', musicNoteProbeRows),
        '',
        '[REAL POINTER INPUT A/B]',
        ...(manualInputRows.length
          ? manualInputRows.map(({ mode, result: row }) => `mode=${mode} duration=${(row.durationMs / 1000).toFixed(2)}s fps=${row.estimatedFps} p95=${row.p95FrameMs}ms max=${row.maxFrameMs}ms events=${row.pointerEventCount} rate=${row.pointerEventsPerSecond}/s coalesced=${row.pointerCoalescedCount} intervalAvg/P95=${row.pointerIntervalAvgMs}/${row.pointerIntervalP95Ms}ms batchAvg/max=${row.pointerBatchAvg}/${row.pointerBatchMax} inputToCommitAvg/P95/max=${row.inputToCommitAvgMs}/${row.inputToCommitP95Ms}/${row.inputToCommitMaxMs}ms longTask=${row.longTaskCount}/${row.longTaskTotalMs}ms`)
          : ['미측정 · 실사용 입력 A/B를 실행하세요.']),
      );
      await navigator.clipboard.writeText(lines.join('\n'));
      setBenchmarkMessage('종합 진단서 복사 완료 · 환경 + 자동 테스트 + A/B 결과를 한 번에 복사했습니다.');
    } catch (error) {
      setBenchmarkMessage(`종합 진단서 복사 실패 · ${error instanceof Error ? error.message : '브라우저 클립보드 권한을 확인하세요.'}`);
    } finally {
      setEnvironmentRunning(false);
    }
  };

  if (!isAdmin || !visible) return null;

  return (
    <aside className={`soridraw-split-perf-panel${collapsed ? ' is-collapsed' : ''}`} aria-label="분할 성능 진단">
      <div className="soridraw-split-perf-head">
        <button type="button" onClick={toggleEnabled} className={enabled ? 'is-on' : ''}>
          PERF {enabled ? 'ON' : 'OFF'}
        </button>
        <strong>{probeRunning ? `${probeKind === 'area' ? '영역' : probeKind === 'layout' ? '좌표 A/B' : probeKind === 'musicnote' ? '뮤직노트 정밀' : '렌더'} 스캔 중` : verdict}</strong>
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
            <button type="button" className="is-secondary" onClick={() => runProbeScan('layout')} disabled={benchmarkRunning || probeRunning || !enabled}>
              {probeRunning && probeKind === 'layout' ? '좌표 A/B 중…' : '좌표 A/B'}
            </button>
            <button type="button" className="is-secondary" onClick={() => runProbeScan('musicnote')} disabled={benchmarkRunning || probeRunning || !enabled}>
              {probeRunning && probeKind === 'musicnote' ? '뮤직노트 정밀 중…' : '뮤직노트 정밀'}
            </button>
            <button type="button" className="is-secondary" onClick={runManualInputAB} disabled={benchmarkRunning || probeRunning || manualInputRunning || !enabled}>
              {manualInputRunning ? `실사용 입력 ${manualInputRows.length + 1}/2` : '실사용 입력 A/B'}
            </button>
            <button type="button" className="is-secondary" onClick={runEnvironmentDiagnostics} disabled={environmentRunning || benchmarkRunning || probeRunning}>
              {environmentRunning ? '환경 진단 중…' : '환경 진단'}
            </button>
            <button type="button" className="is-secondary" onClick={copyComprehensiveReport} disabled={environmentRunning || benchmarkRunning || probeRunning}>
              종합 진단서 복사
            </button>
            <span>자동: 1400×900 고정 표면 · 실사용 입력 A/B: 실제 마우스 React→Native 2회 · 환경: DEV/PROD·computed style·idle Hz</span>
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
                    {displayResult.benchmarkSurface && <span>Benchmark Surface {displayResult.benchmarkSurface} · {displayResult.benchmarkSurfacePass ? 'PASS' : 'FAIL'} · {displayResult.layoutMode === 'direct' ? '직접 좌표' : 'CSS 변수'}</span>}
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
                    <span>실마우스 입력률</span><b>{displayResult.pointerEventCount ? `${displayResult.pointerEventsPerSecond}/s · ${displayResult.inputMode ?? '-'}` : '-'}</b>
                    <span>입력 묶음 평균/최대</span><b>{displayResult.pointerEventCount ? `${displayResult.pointerBatchAvg}/${displayResult.pointerBatchMax}` : '-'}</b>
                    <span>입력→반영 P95/최대</span><b>{displayResult.pointerEventCount ? `${displayResult.inputToCommitP95Ms}/${displayResult.inputToCommitMaxMs}ms` : '-'}</b>
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
                        <span><i>JS minify</i><b>{environment.jsMinifyMode}</b></span>
                        <span><i>CSS minify</i><b>{environment.cssMinifyMode}</b></span>
                        <span><i>Idle Hz</i><b>{environment.idleHz ?? '-'}Hz</b></span>
                        <span><i>SW / Cache</i><b>{environment.swController ? 'CTRL' : '없음'} · {environment.swRegistrations}/{environment.cacheNames ?? '-'}</b></span>
                        <span><i>JS</i><b>{environment.scriptCount}개 · {environment.scriptDecodedKb}KB</b></span>
                        <span><i>CSS</i><b>{environment.cssCount}개 · rules {environment.cssRules ?? '-'}</b></span>
                        <span><i>CPU / RAM</i><b>{environment.hardwareConcurrency ?? '-'}T · {environment.deviceMemoryGb ?? '-'}GB</b></span>
                        <span><i>Viewport</i><b>{environment.viewport} · DPR {environment.dpr}</b></span>
                        <span><i>Network</i><b>{environment.connection}</b></span>
                        <span><i>Style scan</i><b>{environment.computedStyles.costs.scanned} nodes</b></span>
                        <span><i>Contain / CQ</i><b>{environment.computedStyles.costs.contain} / {environment.computedStyles.costs.containerType}</b></span>
                        <span><i>FX / transition</i><b>{environment.computedStyles.costs.filter + environment.computedStyles.costs.backdropFilter + environment.computedStyles.costs.boxShadow} / {environment.computedStyles.costs.transition}</b></span>
                        <span><i>Stylesheets</i><b>{environment.computedStyles.stylesheets.length}장</b></span>
                      </div>
                      <div className="soridraw-split-perf-env-actions">
                        <span>{environment.host}</span>
                        <button type="button" onClick={copyEnvironmentReport}>환경만 복사</button>
                      </div>
                    </details>
                  )}
                  {probeRows.length > 0 && (
                    <details open>
                      <summary>{probeKind === 'area'
                        ? '영역 이진 A/B — 기준 대비 렌더 비용'
                        : probeKind === 'layout'
                          ? '좌표 A/B — 기준 대비 렌더 비용'
                          : probeKind === 'musicnote'
                            ? '뮤직노트 잔여 병목 A/B — 기준 대비 렌더 비용'
                            : '렌더 A/B — 기준 대비 렌더 비용'}</summary>
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

                  {manualInputRows.length > 0 && (
                    <details open>
                      <summary>실사용 Pointer A/B — 실제 마우스 입력 경로</summary>
                      <div className="soridraw-split-perf-probe-grid">
                        {manualInputRows.map(({ mode, result: row }) => (
                          <div className="soridraw-split-perf-probe-row" key={mode}>
                            <span>{mode === 'react' ? 'React onPointerMove' : 'Native PointerEvent'}</span>
                            <b>{row.estimatedFps}fps · P95 {row.p95FrameMs}ms</b>
                            <i>{row.pointerEventsPerSecond}/s · batch {row.pointerBatchAvg}/{row.pointerBatchMax}</i>
                            <em>입력→반영 P95 {row.inputToCommitP95Ms}ms · max {row.inputToCommitMaxMs}ms</em>
                          </div>
                        ))}
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
              <p className="soridraw-split-perf-note is-compact">593: 591 직접 pane 좌표 런타임은 유지합니다. 실사용 입력 A/B는 자동 애니메이션이 아니라 사용자의 실제 마우스 PointerEvent를 기록하고 React onPointerMove와 Native PointerEvent 경로를 순서대로 비교합니다. 진단 종료 후 입력 방식은 기존 React 방식으로 자동 복구합니다.</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
