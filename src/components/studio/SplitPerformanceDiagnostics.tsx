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
  SPLIT_PERF_MANUAL_DRAG_ARM_EVENT,
  SPLIT_PERF_TOOL_VISIBILITY_EVENT,
  SPLIT_PERF_WORKSPACE_REQUEST_EVENT,
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
  | 'musicnote-title-off'
  | 'musicnote-keywords-off'
  | 'musicnote-text-off'
  | 'area-list-off'
  | 'area-builder-off'
  | 'area-result-off'
  | 'area-both-off'
  | 'layout-css-var'
  | 'layout-direct';
type PerfProbeRow = {
  id: PerfProbeProfileId;
  label: string;
  summary: SplitPerfBenchmarkSummary;
  fps: number;
  p95: number;
  renderPerSecond: number;
};

type PairWorkspace = 'music-note' | 'library';
type PairBenchmarkRow = {
  workspace: PairWorkspace;
  summary: SplitPerfBenchmarkSummary;
  fps: number;
  p95: number;
  renderPerSecond: number;
  longTaskPerSecond: number;
  layoutMode: 'css-var' | 'direct' | null;
};

type PairHandRow = {
  workspace: PairWorkspace;
  result: SplitPerfResult;
  fps: number;
  p95: number;
  renderPerSecond: number;
  longTaskPerSecond: number;
  layoutMode: 'css-var' | 'direct' | null;
  pointerEventRate: number;
  pointerSampleRate: number;
  commitRate: number;
  commitGapP95: number;
  commitGapMax: number;
  commitCoverage: number;
  inputToCommitP95: number;
  pointerGapP95: number;
  pointerGapMax: number;
  commitPerPointer: number;
  layoutAckRate: number;
  layoutAckGapP95: number;
  layoutAckGapMax: number;
  layoutAckToWriteP95: number;
  layoutAckToWriteMax: number;
  layoutAckErrorAvg: number;
  layoutAckErrorMax: number;
  layoutAckPerCommit: number;
  paneModeSwitches: number;
  contentModeSwitches: number;
};

const PERF_PAIR_BASELINE_STORAGE_KEY = 'soridraw_perf_pair_baseline_603_v1';

const PERF_RENDER_PROBE_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'baseline', label: '기준' },
  { id: 'musicnote-title-off', label: '뮤직노트 제목 OFF' },
  { id: 'musicnote-keywords-off', label: '뮤직노트 키워드 OFF' },
  { id: 'musicnote-text-off', label: '뮤직노트 제목+키워드 OFF' },
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

const setPerfProbeProfile = (profile: PerfProbeProfileId) => {
  const root = document.documentElement;
  if (profile === 'baseline' || profile === 'layout-css-var' || profile === 'layout-direct') delete root.dataset.soridrawPerfProbe;
  else root.dataset.soridrawPerfProbe = profile;
};

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
    buildProfile: '610 · mouse-touch parity: latest coalesced mouse sample + drag hit-test shield',
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
  const [probeKind, setProbeKind] = useState<'render' | 'area' | 'layout'>('render');
  const [probeRows, setProbeRows] = useState<PerfProbeRow[]>([]);
  const [renderProbeRows, setRenderProbeRows] = useState<PerfProbeRow[]>([]);
  const [areaProbeRows, setAreaProbeRows] = useState<PerfProbeRow[]>([]);
  const [layoutProbeRows, setLayoutProbeRows] = useState<PerfProbeRow[]>([]);
  const [environment, setEnvironment] = useState<PerfEnvironmentSnapshot | null>(null);
  const [environmentRunning, setEnvironmentRunning] = useState(false);

  const [pairRunning, setPairRunning] = useState(false);
  const [pairRows, setPairRows] = useState<PairBenchmarkRow[]>([]);
  const [handPairRunning, setHandPairRunning] = useState(false);
  const [handPairRows, setHandPairRows] = useState<PairHandRow[]>([]);
  const [pairBaseline, setPairBaseline] = useState<PairBenchmarkRow[]>(() => {
    try {
      const raw = window.localStorage.getItem(PERF_PAIR_BASELINE_STORAGE_KEY);
      return raw ? JSON.parse(raw) as PairBenchmarkRow[] : [];
    } catch {
      return [];
    }
  });

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
    const nextRows = [...probeRowsRef.current, row];
    probeRowsRef.current = nextRows;
    setProbeRows(nextRows);
    if (probeKind === 'render') setRenderProbeRows(nextRows);
    else if (probeKind === 'area') setAreaProbeRows(nextRows);
    else setLayoutProbeRows(nextRows);
    if (probeIndexRef.current === 0) probeBaselineRef.current = benchmarkSummary;

    const nextIndex = probeIndexRef.current + 1;
    if (nextIndex >= profiles.length) {
      stopProbe(true);
      setBenchmarkMessage(probeKind === 'area'
        ? '영역 스캔 완료 · 렌더 비용이 크게 떨어지는 영역이 실제 병목 후보입니다.'
        : probeKind === 'layout'
          ? '좌표 A/B 완료 · 같은 1400×900 표면에서 CSS 변수와 직접 좌표를 비교했습니다.'
          : '렌더 스캔 완료 · 기준 대비 렌더 비용 감소폭이 큰 항목을 우선 확인하세요.');
      return;
    }

    probeIndexRef.current = nextIndex;
    const nextProfile = profiles[nextIndex];
    setPerfProbeProfile(nextProfile.id);
    setBenchmarkMessage(`${probeKind === 'area' ? '영역 스캔' : probeKind === 'layout' ? '좌표 A/B' : '렌더 스캔'} ${nextIndex + 1}/${profiles.length} · ${nextProfile.label}`);
    probeStartTimerRef.current = window.setTimeout(() => {
      probeStartTimerRef.current = null;
      if (!probeRunningRef.current) return;
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT, { detail: { layoutMode: nextProfile.id === 'layout-direct' ? 'direct' : 'css-var' } }));
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
    if (!document.querySelector('.soridraw-lite-studio-split-workspace')) {
      setBenchmarkMessage('612 자동 모드는 화면별 검증 엔진을 사용합니다. 현재 화면이 기존 방식이면 우측 상단에서 Lite V2를 강제 선택한 뒤 PERF 진단을 실행하세요.');
      return false;
    }
    return true;
  };

  const getCurrentStudioWorkspace = (): PairWorkspace | 'recent' | 'create' => {
    const current = document.documentElement.dataset.soridrawStudioWorkspaceView;
    if (current === 'music-note' || current === 'library' || current === 'recent' || current === 'create') return current;
    return 'create';
  };

  const waitForWorkspaceReady = (workspace: PairWorkspace, timeoutMs = 12000) => new Promise<void>((resolve, reject) => {
    const startedAt = performance.now();
    let frame = 0;
    const check = () => {
      const current = document.documentElement.dataset.soridrawStudioWorkspaceView;
      const target = workspace === 'music-note'
        ? document.querySelector('.soridraw-musicnote-theme .soridraw-musicnote-song-card')
        : document.querySelector('.soridraw-library-theme :is(.soridraw-library-playlist-row, .soridraw-library-workspace-track-row)');
      const split = document.querySelector('.soridraw-lite-studio-split-workspace');
      if (current === workspace && target && split) {
        window.setTimeout(resolve, 420);
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        reject(new Error(`${workspace === 'music-note' ? '뮤직노트' : '라이브러리'} 화면 준비 시간 초과`));
        return;
      }
      frame = window.requestAnimationFrame(check);
    };
    frame = window.requestAnimationFrame(check);
    void frame;
  });

  const runRuntimeBenchmarkPromise = (workspace: PairWorkspace) => new Promise<SplitPerfBenchmarkSummary>((resolve, reject) => {
    const startedAt = Date.now();
    let settled = false;
    let timeoutId = 0;
    const cleanup = () => {
      unsubscribe();
      window.removeEventListener(SPLIT_PERF_BENCHMARK_STATUS_EVENT, handleStatus as EventListener);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    const finishResolve = (summary: SplitPerfBenchmarkSummary) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(summary);
    };
    const finishReject = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: 'running' | 'done' | 'error'; message?: string }>).detail;
      if (detail?.state === 'error') finishReject(detail.message || '자동 테스트 오류');
    };
    const unsubscribe = subscribeSplitPerfBenchmarkSummary((summary) => {
      if (!summary || summary.createdAt < startedAt) return;
      if (summary.median.workspaceView !== workspace) return;
      finishResolve(summary);
    });
    window.addEventListener(SPLIT_PERF_BENCHMARK_STATUS_EVENT, handleStatus as EventListener);
    timeoutId = window.setTimeout(() => finishReject('자동 테스트 응답 시간 초과'), 42000);
    // No layoutMode override: 603 measures the actual runtime mode of the active workspace.
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
  });

  const toPairRow = (workspace: PairWorkspace, summary: SplitPerfBenchmarkSummary): PairBenchmarkRow => {
    const median = summary.median;
    const durationSeconds = Math.max(0.001, median.durationMs / 1000);
    return {
      workspace,
      summary,
      fps: median.estimatedFps,
      p95: median.p95FrameMs,
      renderPerSecond: getBrowserRenderPerSecond(median),
      longTaskPerSecond: Number((median.longTaskTotalMs / durationSeconds).toFixed(1)),
      layoutMode: median.layoutMode,
    };
  };

  const runPairBenchmark = async () => {
    if (!ensureBenchmarkReady() || pairRunning || benchmarkRunning || probeRunningRef.current) return;
    const originalWorkspace = getCurrentStudioWorkspace();
    setPairRunning(true);
    setPairRows([]);
    setBenchmarkMessage('뮤직노트 → 라이브러리 순서로 같은 1400×900 조건을 자동 비교합니다.');
    try {
      const nextRows: PairBenchmarkRow[] = [];
      for (const workspace of ['music-note', 'library'] as PairWorkspace[]) {
        setBenchmarkMessage(`${workspace === 'music-note' ? '뮤직노트' : '라이브러리'} 준비 중…`);
        window.dispatchEvent(new CustomEvent(SPLIT_PERF_WORKSPACE_REQUEST_EVENT, { detail: { view: workspace } }));
        await waitForWorkspaceReady(workspace);
        setBenchmarkMessage(`${workspace === 'music-note' ? '뮤직노트' : '라이브러리'} 자동 테스트 중 · 실제 런타임 좌표 방식`);
        const summary = await runRuntimeBenchmarkPromise(workspace);
        nextRows.push(toPairRow(workspace, summary));
        setPairRows([...nextRows]);
      }

      if (!pairBaseline.length && nextRows.length === 2) {
        try { window.localStorage.setItem(PERF_PAIR_BASELINE_STORAGE_KEY, JSON.stringify(nextRows)); } catch { /* optional */ }
        setPairBaseline(nextRows);
        setBenchmarkMessage('2화면 비교 완료 · 603 보호 기준을 저장했습니다. 다음 수정부터 라이브러리 회귀를 자동 확인합니다.');
      } else {
        const library = nextRows.find((row) => row.workspace === 'library');
        const libraryBase = pairBaseline.find((row) => row.workspace === 'library');
        const regressed = Boolean(library && libraryBase && (library.fps < libraryBase.fps * 0.9 || library.p95 > libraryBase.p95 * 1.15));
        setBenchmarkMessage(regressed
          ? '2화면 비교 완료 · 라이브러리 보호 기준보다 성능이 하락했습니다. 이 수정은 회귀 후보입니다.'
          : '2화면 비교 완료 · 라이브러리 보호 기준 통과. 뮤직노트 개선 여부를 비교하세요.');
      }
    } catch (error) {
      setBenchmarkMessage(`2화면 비교 중단 · ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      if (originalWorkspace === 'music-note' || originalWorkspace === 'library' || originalWorkspace === 'recent' || originalWorkspace === 'create') {
        window.dispatchEvent(new CustomEvent(SPLIT_PERF_WORKSPACE_REQUEST_EVENT, { detail: { view: originalWorkspace } }));
      }
      setPairRunning(false);
    }
  };

  const waitForManualDragResult = (workspace: PairWorkspace) => new Promise<SplitPerfResult>((resolve, reject) => {
    const startedAt = Date.now();
    let settled = false;
    let timeoutId = 0;
    const cleanup = () => {
      unsubscribe();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    const finishResolve = (next: SplitPerfResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(next);
    };
    const finishReject = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const unsubscribe = subscribeSplitPerfResult((next) => {
      if (!next || next.createdAt < startedAt || next.workspaceView !== workspace) return;
      if (next.benchmarkSurface !== null) return;
      if (next.durationMs < 1200 || next.pointerEventCount < 10 || next.pointerDistancePx < 120) {
        setBenchmarkMessage(`${workspace === 'music-note' ? '뮤직노트' : '라이브러리'} · 너무 짧습니다. 분할바를 4~6초 계속 좌우로 움직인 뒤 놓아주세요.`);
        return;
      }
      finishResolve(next);
    });
    timeoutId = window.setTimeout(() => finishReject('실사용 드래그 입력 대기 시간 초과'), 65000);
  });

  const toHandPairRow = (workspace: PairWorkspace, next: SplitPerfResult): PairHandRow => {
    const durationSeconds = Math.max(0.001, next.durationMs / 1000);
    return {
      workspace,
      result: next,
      fps: next.estimatedFps,
      p95: next.p95FrameMs,
      renderPerSecond: getBrowserRenderPerSecond(next),
      longTaskPerSecond: Number((next.longTaskTotalMs / durationSeconds).toFixed(1)),
      layoutMode: next.layoutMode,
      pointerEventRate: next.pointerEventRate,
      pointerSampleRate: next.pointerSampleRate,
      commitRate: next.commitRate,
      commitGapP95: next.commitGapP95Ms,
      commitGapMax: next.commitGapMaxMs,
      commitCoverage: next.commitCoveragePct,
      inputToCommitP95: next.inputToCommitP95Ms,
      pointerGapP95: next.pointerGapP95Ms,
      pointerGapMax: next.pointerGapMaxMs,
      commitPerPointer: next.commitPerPointerPct,
      layoutAckRate: next.layoutAckRate,
      layoutAckGapP95: next.layoutAckGapP95Ms,
      layoutAckGapMax: next.layoutAckGapMaxMs,
      layoutAckToWriteP95: next.layoutAckToWriteP95Ms,
      layoutAckToWriteMax: next.layoutAckToWriteMaxMs,
      layoutAckErrorAvg: next.layoutAckWidthErrorAvgPx,
      layoutAckErrorMax: next.layoutAckWidthErrorMaxPx,
      layoutAckPerCommit: next.layoutAckPerCommitPct,
      paneModeSwitches: next.paneModeSwitchCount,
      contentModeSwitches: next.contentModeSwitchCount,
    };
  };

  const runHandPairBenchmark = async () => {
    if (!ensureBenchmarkReady() || handPairRunning || pairRunning || benchmarkRunning || probeRunningRef.current) return;
    const originalWorkspace = getCurrentStudioWorkspace();
    setHandPairRunning(true);
    setHandPairRows([]);
    try {
      const rows: PairHandRow[] = [];
      for (const workspace of ['music-note', 'library'] as PairWorkspace[]) {
        window.dispatchEvent(new CustomEvent(SPLIT_PERF_WORKSPACE_REQUEST_EVENT, { detail: { view: workspace } }));
        setBenchmarkMessage(`${workspace === 'music-note' ? '뮤직노트' : '라이브러리'} 준비 중…`);
        await waitForWorkspaceReady(workspace);
        setBenchmarkMessage(`${workspace === 'music-note' ? '뮤직노트' : '라이브러리'} · 분할바를 4~6초 동안 계속 좌우로 실제 드래그한 뒤 놓아주세요.`);
        // 611: normal hand dragging is never instrumented. Arm PERF only for
        // this explicit admin hand-comparison request; Lite V2 consumes the arm
        // once on the next matching pointer-down and disarms after pointer-up.
        window.dispatchEvent(new CustomEvent(SPLIT_PERF_MANUAL_DRAG_ARM_EVENT, { detail: { armed: true, workspace } }));
        const measured = await waitForManualDragResult(workspace);
        rows.push(toHandPairRow(workspace, measured));
        setHandPairRows([...rows]);
        await new Promise((resolve) => window.setTimeout(resolve, 420));
      }
      const music = rows.find((row) => row.workspace === 'music-note');
      const library = rows.find((row) => row.workspace === 'library');
      if (music && library) {
        const musicAckBehind =
          music.layoutAckGapP95 > library.layoutAckGapP95 * 1.2
          || music.layoutAckToWriteP95 > library.layoutAckToWriteP95 * 1.2
          || music.layoutAckErrorMax > Math.max(2, library.layoutAckErrorMax * 1.5);
        const responsiveConflict =
          music.paneModeSwitches + music.contentModeSwitches > library.paneModeSwitches + library.contentModeSwitches + 2;
        setBenchmarkMessage(musicAckBehind
          ? '실손 비교 완료 · 뮤직노트는 DOM 쓰기는 빠르지만 실제 pane 레이아웃 확인 주기가 라이브러리보다 뒤처집니다. 다음 수정은 이 동기 지연만 제거합니다.'
          : responsiveConflict
            ? '실손 비교 완료 · 뮤직노트에서 반응형 모드 전환이 더 자주 발생합니다. Tablet/콘텐츠 판정 충돌을 먼저 분리합니다.'
            : '실손 비교 완료 · pane 레이아웃 확인은 유사합니다. 남은 체감 차이는 외부 UI/콘텐츠가 같은 프레임에 따라오는지 다음 단계에서 좁힙니다.');
      }
    } catch (error) {
      setBenchmarkMessage(`실손 비교 중단 · ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_MANUAL_DRAG_ARM_EVENT, { detail: { armed: false } }));
      if (originalWorkspace === 'music-note' || originalWorkspace === 'library' || originalWorkspace === 'recent' || originalWorkspace === 'create') {
        window.dispatchEvent(new CustomEvent(SPLIT_PERF_WORKSPACE_REQUEST_EVENT, { detail: { view: originalWorkspace } }));
      }
      setHandPairRunning(false);
    }
  };

  const runBenchmark = () => {
    if (!ensureBenchmarkReady()) return;
    setPerfProbeProfile('baseline');
    setBenchmarkRunning(true);
    setBenchmarkMessage('워밍업 후 같은 조건을 3세트 측정해 중앙값으로 판정합니다.');
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
  };

  const runProbeScan = (kind: 'render' | 'area' | 'layout') => {
    if (!ensureBenchmarkReady()) return;
    if (benchmarkRunning || probeRunningRef.current) return;
    const profiles = kind === 'area' ? PERF_AREA_PROBE_PROFILES : kind === 'layout' ? PERF_LAYOUT_PROBE_PROFILES : PERF_RENDER_PROBE_PROFILES;
    probeProfilesRef.current = profiles;
    probeRowsRef.current = [];
    probeBaselineRef.current = null;
    probeIndexRef.current = 0;
    probeHandledSummaryAtRef.current = 0;
    setProbeKind(kind);
    setProbeRows([]);
    if (kind === 'render') setRenderProbeRows([]);
    else if (kind === 'area') setAreaProbeRows([]);
    else setLayoutProbeRows([]);
    probeRunningRef.current = true;
    setProbeRunning(true);
    setPerfProbeProfile(profiles[0].id);
    setBenchmarkMessage(`${kind === 'area' ? '영역 스캔' : kind === 'layout' ? '좌표 A/B' : '렌더 스캔'} 1/${profiles.length} · ${profiles[0].label}`);
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT, { detail: { layoutMode: profiles[0].id === 'layout-direct' ? 'direct' : 'css-var' } }));
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
          `hand pointerRate=${current.pointerEventRate}/s samples=${current.pointerSampleRate}/s distance=${current.pointerDistancePx}px pointerGapP95/max=${current.pointerGapP95Ms}/${current.pointerGapMaxMs}ms commitRate=${current.commitRate}/s commitPerPointer=${current.commitPerPointerPct}% commitGapAvg/P95/max=${current.commitGapAvgMs}/${current.commitGapP95Ms}/${current.commitGapMaxMs}ms coverage=${current.commitCoveragePct}% inputToCommitP95/max=${current.inputToCommitP95Ms}/${current.inputToCommitMaxMs}ms`,
          `layoutAck rate=${current.layoutAckRate}/s ackPerCommit=${current.layoutAckPerCommitPct}% gapAvg/P95/max=${current.layoutAckGapAvgMs}/${current.layoutAckGapP95Ms}/${current.layoutAckGapMaxMs}ms writeToAckP95/max=${current.layoutAckToWriteP95Ms}/${current.layoutAckToWriteMaxMs}ms widthErrorAvg/max=${current.layoutAckWidthErrorAvgPx}/${current.layoutAckWidthErrorMaxPx}px responsiveSwitch pane/content=${current.paneModeSwitchCount}/${current.contentModeSwitchCount}`,
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
      if (pairRows.length) {
        lines.push('', '[MUSIC NOTE / LIBRARY PAIRED BENCHMARK]');
        pairRows.forEach((row) => {
          const base = pairBaseline.find((item) => item.workspace === row.workspace);
          const fpsDelta = base ? Number((((row.fps - base.fps) / Math.max(0.1, base.fps)) * 100).toFixed(1)) : null;
          const p95Delta = base ? Number((((row.p95 - base.p95) / Math.max(0.1, base.p95)) * 100).toFixed(1)) : null;
          lines.push(`${row.workspace} mode=${row.layoutMode ?? '-'} fps=${row.fps} p95=${row.p95}ms render=${row.renderPerSecond}ms/s longTask=${row.longTaskPerSecond}ms/s${fpsDelta === null ? '' : ` baselineFpsDelta=${fpsDelta}% baselineP95Delta=${p95Delta}%`}`);
        });
      }
      if (handPairRows.length) {
        lines.push('', '[MUSIC NOTE / LIBRARY REAL HAND DRAG]');
        handPairRows.forEach((row) => {
          lines.push(`${row.workspace} mode=${row.layoutMode ?? '-'} fps=${row.fps} p95=${row.p95}ms pointerRate=${row.pointerEventRate}/s samples=${row.pointerSampleRate}/s pointerGapP95/max=${row.pointerGapP95}/${row.pointerGapMax}ms commitRate=${row.commitRate}/s commitPerPointer=${row.commitPerPointer}% commitGapP95/max=${row.commitGapP95}/${row.commitGapMax}ms coverage=${row.commitCoverage}% inputToCommitP95=${row.inputToCommitP95}ms layoutAck=${row.layoutAckRate}/s ackPerCommit=${row.layoutAckPerCommit}% ackGapP95/max=${row.layoutAckGapP95}/${row.layoutAckGapMax}ms writeToAckP95/max=${row.layoutAckToWriteP95}/${row.layoutAckToWriteMax}ms widthErrorAvg/max=${row.layoutAckErrorAvg}/${row.layoutAckErrorMax}px responsiveSwitch=${row.paneModeSwitches}/${row.contentModeSwitches} render=${row.renderPerSecond}ms/s longTask=${row.longTaskPerSecond}ms/s`);
        });
      }
      lines.push('', ...formatProbeLines('RENDER A/B', renderProbeRows), '', ...formatProbeLines('AREA A/B', areaProbeRows), '', ...formatProbeLines('LAYOUT A/B', layoutProbeRows));
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
        <strong>{probeRunning ? `${probeKind === 'area' ? '영역' : probeKind === 'layout' ? '좌표 A/B' : '렌더'} 스캔 중` : verdict}</strong>
        <button type="button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? '진단 펼치기' : '진단 접기'}>
          {collapsed ? '＋' : '－'}
        </button>
      </div>
      {!collapsed && (
        <div className="soridraw-split-perf-body">
          <div className="soridraw-split-perf-benchmark-row">
            <button type="button" onClick={runBenchmark} disabled={benchmarkRunning || probeRunning || handPairRunning || !enabled}>
              {benchmarkRunning && !probeRunning ? '자동 테스트 중…' : '자동 테스트'}
            </button>
            <button type="button" className="is-secondary" onClick={runPairBenchmark} disabled={benchmarkRunning || probeRunning || pairRunning || handPairRunning || !enabled}>
              {pairRunning ? '2화면 비교 중…' : '뮤직노트↔라이브러리 비교'}
            </button>
            <button type="button" className="is-secondary" onClick={runHandPairBenchmark} disabled={benchmarkRunning || probeRunning || pairRunning || handPairRunning || !enabled}>
              {handPairRunning ? '실손 비교 중…' : '실손 드래그 비교'}
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
            <button type="button" className="is-secondary" onClick={runEnvironmentDiagnostics} disabled={environmentRunning || benchmarkRunning || probeRunning}>
              {environmentRunning ? '환경 진단 중…' : '환경 진단'}
            </button>
            <button type="button" className="is-secondary" onClick={copyComprehensiveReport} disabled={environmentRunning || benchmarkRunning || probeRunning}>
              종합 진단서 복사
            </button>
            <span>자동: 1400×900 동일조건 · 실손: 실제 마우스 입력률/폭 반영률/긴 프레임을 뮤직노트↔라이브러리로 직접 비교</span>
          </div>
          {benchmarkMessage && <p className="soridraw-split-perf-benchmark-message">{benchmarkMessage}</p>}
          {pairRows.length > 0 && (
            <div className="soridraw-split-perf-pair" aria-label="뮤직노트 라이브러리 성능 비교">
              {pairRows.map((row) => {
                const base = pairBaseline.find((item) => item.workspace === row.workspace);
                const fpsDelta = base ? Number((((row.fps - base.fps) / Math.max(0.1, base.fps)) * 100).toFixed(1)) : null;
                const p95Delta = base ? Number((((row.p95 - base.p95) / Math.max(0.1, base.p95)) * 100).toFixed(1)) : null;
                return (
                  <span key={row.workspace}>
                    <b>{row.workspace === 'music-note' ? '뮤직노트' : '라이브러리'}</b>
                    <i>{row.layoutMode === 'direct' ? 'direct' : 'css-var'}</i>
                    <strong>{row.fps} FPS</strong>
                    <em>P95 {row.p95}ms</em>
                    <small>render {row.renderPerSecond}ms/s{fpsDelta === null ? '' : ` · FPS ${fpsDelta >= 0 ? '+' : ''}${fpsDelta}% / P95 ${p95Delta! >= 0 ? '+' : ''}${p95Delta}%`}</small>
                  </span>
                );
              })}
            </div>
          )}
          {handPairRows.length > 0 && (
            <div className="soridraw-split-perf-pair" aria-label="뮤직노트 라이브러리 실손 드래그 비교">
              {handPairRows.map((row) => (
                <span key={`hand-${row.workspace}`}>
                  <b>{row.workspace === 'music-note' ? '뮤직노트 손' : '라이브러리 손'}</b>
                  <i>{row.layoutMode === 'direct' ? 'direct' : 'css-var'}</i>
                  <strong>반영 {row.commitRate}/s</strong>
                  <em>gap P95 {row.commitGapP95}ms · layout ack {row.layoutAckRate}/s</em>
                  <small>입력 {row.pointerEventRate}/s · commit {row.commitRate}/s · ack P95 {row.layoutAckGapP95}ms · write→ack {row.layoutAckToWriteP95}ms · 전환 {row.paneModeSwitches}/{row.contentModeSwitches}</small>
                </span>
              ))}
            </div>
          )}
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
                    <span>JS flush 평균/최대</span><b>{displayResult.flushAvgMs}/{displayResult.flushMaxMs}ms</b>
                    <span>실제 폭 반영 / 선만</span><b>{displayResult.contentCommitCount} / {displayResult.dividerOnlyCount}</b>
                    <span>손 입력 / sample</span><b>{displayResult.pointerEventRate}/s · {displayResult.pointerSampleRate}/s</b>
                    <span>손 실제 폭 반영률</span><b>{displayResult.commitRate}/s · coverage {displayResult.commitCoveragePct}%</b>
                    <span>반영 gap 평균/P95/최대</span><b>{displayResult.commitGapAvgMs}/{displayResult.commitGapP95Ms}/{displayResult.commitGapMaxMs}ms</b>
                    <span>실제 pane layout 확인</span><b>{displayResult.layoutAckRate}/s · {displayResult.layoutAckPerCommitPct}%</b>
                    <span>layout ack P95 / write→ack</span><b>{displayResult.layoutAckGapP95Ms} / {displayResult.layoutAckToWriteP95Ms}ms</b>
                    <span>폭 오차 평균/최대</span><b>{displayResult.layoutAckWidthErrorAvgPx}/{displayResult.layoutAckWidthErrorMaxPx}px</b>
                    <span>반응형 전환 pane/content</span><b>{displayResult.paneModeSwitchCount}/{displayResult.contentModeSwitchCount}</b>
                    <span>입력→반영 P95/최대</span><b>{displayResult.inputToCommitP95Ms}/{displayResult.inputToCommitMaxMs}ms</b>
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
              <p className="soridraw-split-perf-note is-compact">589: JS/CSS minify를 모두 정상 복구했습니다. 환경 진단/종합 진단서는 DEV·PROD의 실제 computed style 비용 속성 개수, 핵심 pane·Music Note·Library 대상 스타일, stylesheet 적용 순서를 함께 기록해 production cascade 차이를 직접 비교합니다.</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
