export type SplitPerfApplySample = {
  totalMs: number;
  layoutWriteMs: number;
  responsiveMs: number;
  externalMs: number;
  miscMs: number;
};

export type SplitPerfHotspot = {
  label: string;
  count: number;
  totalMs: number;
  maxMs: number;
  forcedStyleLayoutMs: number;
};

export type SplitPerfRegionNodes = {
  musicNoteControls: number;
  musicNoteList: number;
  libraryControls: number;
  libraryList: number;
  externalStudioUi: number;
  other: number;
};

export type SplitPerfResult = {
  host: string;
  captureKind: 'drag' | 'window-resize';
  workspaceView: string;
  engine: string;
  viewport: string;
  dpr: number;
  durationMs: number;
  rafFrames: number;
  estimatedFps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  over20ms: number;
  over34ms: number;
  over50ms: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  loafSupported: boolean;
  loafCount: number;
  loafTotalMs: number;
  loafMaxMs: number;
  loafBlockingTotalMs: number;
  forcedStyleLayoutTotalMs: number;
  forcedStyleLayoutMaxMs: number;
  eventTimingSupported: boolean;
  slowEventCount: number;
  slowEventTotalMs: number;
  slowEventMaxMs: number;
  inputDelayAvgMs: number;
  inputDelayMaxMs: number;
  pointerEventCount: number;
  pointerEventRate: number;
  pointerSampleCount: number;
  pointerSampleRate: number;
  pointerDistancePx: number;
  pointerGapAvgMs: number;
  pointerGapP95Ms: number;
  pointerGapMaxMs: number;
  commitPerPointerPct: number;
  commitRate: number;
  commitGapAvgMs: number;
  commitGapP95Ms: number;
  commitGapMaxMs: number;
  commitCoveragePct: number;
  inputToCommitAvgMs: number;
  inputToCommitP95Ms: number;
  inputToCommitMaxMs: number;
  layoutAckCount: number;
  layoutAckRate: number;
  layoutAckGapAvgMs: number;
  layoutAckGapP95Ms: number;
  layoutAckGapMaxMs: number;
  layoutAckToWriteAvgMs: number;
  layoutAckToWriteP95Ms: number;
  layoutAckToWriteMaxMs: number;
  layoutAckWidthErrorAvgPx: number;
  layoutAckWidthErrorMaxPx: number;
  layoutAckPerCommitPct: number;
  spatialSampleCount: number;
  spatialSampleRate: number;
  cursorDividerGapAvgPx: number;
  cursorDividerGapP95Px: number;
  cursorDividerGapMaxPx: number;
  cursorDividerGapJitterP95Px: number;
  cursorDividerGapJitterMaxPx: number;
  cursorDividerLeadAvgPx: number;
  cursorDividerLeadP95Px: number;
  cursorDividerLeadMaxPx: number;
  cursorDividerLeadOver6Pct: number;
  cursorPaneGapAvgPx: number;
  cursorPaneGapP95Px: number;
  cursorPaneGapMaxPx: number;
  cursorPaneGapJitterP95Px: number;
  cursorPaneGapJitterMaxPx: number;
  outerRightGapAvgPx: number;
  outerRightGapDeltaP95Px: number;
  outerRightGapDeltaMaxPx: number;
  outerRightGapJitterP95Px: number;
  outerRightGapJitterMaxPx: number;
  viewportWidthDistancePx: number;
  paneModeSwitchCount: number;
  contentModeSwitchCount: number;
  hotspots: SplitPerfHotspot[];
  flushCount: number;
  flushAvgMs: number;
  flushMaxMs: number;
  contentCommitCount: number;
  dividerOnlyCount: number;
  applyCount: number;
  applyAvgMs: number;
  applyMaxMs: number;
  layoutWriteAvgMs: number;
  responsiveAvgMs: number;
  externalAvgMs: number;
  miscAvgMs: number;
  domNodes: number;
  builderNodes: number;
  resultNodes: number;
  regionNodes: SplitPerfRegionNodes;
  heapMb: number | null;
  benchmarkSurface: string | null;
  benchmarkSurfacePass: boolean | null;
  layoutMode: 'css-var' | 'direct' | null;
  createdAt: number;
};

export type SplitPerfBenchmarkSummary = {
  setCount: number;
  median: SplitPerfResult;
  sets: SplitPerfResult[];
  createdAt: number;
};

type HotspotAccumulator = {
  count: number;
  totalMs: number;
  maxMs: number;
  forcedStyleLayoutMs: number;
};

type ActiveDrag = {
  workspaceView: string;
  captureKind: 'drag' | 'window-resize';
  engine: string;
  startedAt: number;
  frameTimes: number[];
  flushTimes: number[];
  contentCommitCount: number;
  dividerOnlyCount: number;
  applySamples: SplitPerfApplySample[];
  longTasks: number[];
  loafDurations: number[];
  loafBlockingDurations: number[];
  forcedStyleLayoutDurations: number[];
  slowEventDurations: number[];
  inputDelays: number[];
  pointerEventTimes: number[];
  pointerXs: number[];
  pointerSampleCount: number;
  latestPointerX: number | null;
  spatialSampleTimes: number[];
  cursorDividerGaps: number[];
  cursorDividerSignedGaps: number[];
  cursorDividerGapJitters: number[];
  cursorPaneGaps: number[];
  cursorPaneSignedGaps: number[];
  cursorPaneGapJitters: number[];
  cursorDividerLeadGaps: number[];
  cursorDividerLeadOver6Count: number;
  latestDividerX: number | null;
  outerRightGaps: number[];
  outerRightGapDeltas: number[];
  outerRightGapJitters: number[];
  outerRightGapBaseline: number | null;
  latestWorkspaceRight: number | null;
  viewportWidths: number[];
  commitTimes: number[];
  inputToCommitLatencies: number[];
  lastPointerAt: number | null;
  geometryWriteCount: number;
  lastGeometryWriteAt: number | null;
  expectedBuilderWidth: number | null;
  expectedResultWidth: number | null;
  layoutAckTimes: number[];
  layoutAckLatencies: number[];
  layoutAckWidthErrors: number[];
  paneModeSwitchCount: number;
  contentModeSwitchCount: number;
  hotspots: Map<string, HotspotAccumulator>;
  domNodes: number;
  builderNodes: number;
  resultNodes: number;
  regionNodes: SplitPerfRegionNodes;
  benchmarkSurface: string | null;
  benchmarkSurfacePass: boolean | null;
  layoutMode: 'css-var' | 'direct' | null;
  rafId: number | null;
};

type Listener = (result: SplitPerfResult | null) => void;
type BenchmarkListener = (summary: SplitPerfBenchmarkSummary | null) => void;

export const SPLIT_PERF_TOOL_VISIBILITY_STORAGE_KEY = 'soridraw_admin_split_perf_tools_enabled_v2';
export const SPLIT_PERF_TOOL_VISIBILITY_EVENT = 'soridraw:split-perf-tool-visibility';
export const SPLIT_PERF_BENCHMARK_REQUEST_EVENT = 'soridraw:split-perf-benchmark-request';
export const SPLIT_PERF_BENCHMARK_STATUS_EVENT = 'soridraw:split-perf-benchmark-status';
export const SPLIT_PERF_WORKSPACE_REQUEST_EVENT = 'soridraw:split-perf-workspace-request';
export const SPLIT_PERF_MANUAL_DRAG_ARM_EVENT = 'soridraw:split-perf-manual-drag-arm';
export const SPLIT_PERF_MANUAL_WINDOW_RESIZE_ARM_EVENT = 'soridraw:split-perf-manual-window-resize-arm';

export const readSplitPerfToolVisibility = () => {
  // 622: diagnostic UI is opt-in. A fresh install/update starts hidden and
  // inactive; admins can explicitly enable it from Admin > App Settings.
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(SPLIT_PERF_TOOL_VISIBILITY_STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
};

export const writeSplitPerfToolVisibility = (next: boolean) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(SPLIT_PERF_TOOL_VISIBILITY_STORAGE_KEY, String(next)); } catch { /* optional */ }
  window.dispatchEvent(new CustomEvent(SPLIT_PERF_TOOL_VISIBILITY_EVENT, { detail: { enabled: next } }));
};

let enabled = readSplitPerfToolVisibility(); // Opt-in only; off by default.
let active: ActiveDrag | null = null;
let lastResult: SplitPerfResult | null = null;
let lastBenchmarkSummary: SplitPerfBenchmarkSummary | null = null;
const listeners = new Set<Listener>();
const benchmarkListeners = new Set<BenchmarkListener>();
let longTaskObserver: PerformanceObserver | null = null;
let loafObserver: PerformanceObserver | null = null;
let eventObserver: PerformanceObserver | null = null;
let loafSupported = false;
let eventTimingSupported = false;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const max = (values: number[]) => values.length ? Math.max(...values) : 0;
const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
};
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const notify = () => listeners.forEach((listener) => listener(lastResult));

const getSupportedEntryTypes = () => (
  typeof PerformanceObserver !== 'undefined' && Array.isArray(PerformanceObserver.supportedEntryTypes)
    ? PerformanceObserver.supportedEntryTypes
    : []
);

const shortSource = (sourceUrl: string) => {
  if (!sourceUrl) return '';
  try {
    const url = new URL(sourceUrl, window.location.href);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.slice(-2).join('/') || url.hostname;
  } catch {
    const clean = sourceUrl.split('?')[0];
    return clean.split('/').filter(Boolean).slice(-2).join('/');
  }
};

const addHotspot = (
  map: Map<string, HotspotAccumulator>,
  label: string,
  durationMs: number,
  forcedStyleLayoutMs = 0,
) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;
  const current = map.get(label) || { count: 0, totalMs: 0, maxMs: 0, forcedStyleLayoutMs: 0 };
  current.count += 1;
  current.totalMs += durationMs;
  current.maxMs = Math.max(current.maxMs, durationMs);
  current.forcedStyleLayoutMs += Math.max(0, forcedStyleLayoutMs || 0);
  map.set(label, current);
};

const collectUniqueNodes = (selectors: string[]) => {
  const nodes = new Set<Element>();
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((root) => {
      nodes.add(root);
      root.querySelectorAll('*').forEach((node) => nodes.add(node));
    });
  }
  return nodes;
};

const collectRegionNodeCounts = (domNodes: number): SplitPerfRegionNodes => {
  if (typeof document === 'undefined') {
    return { musicNoteControls: 0, musicNoteList: 0, libraryControls: 0, libraryList: 0, externalStudioUi: 0, other: 0 };
  }
  const regions = {
    musicNoteControls: collectUniqueNodes([
      '.soridraw-musicnote-page-shell .soridraw-musicnote-mode-tabs',
      '.soridraw-musicnote-page-shell .soridraw-responsive-top-controls',
      '.soridraw-musicnote-page-shell .soridraw-musicnote-folder-heading',
    ]),
    musicNoteList: collectUniqueNodes(['.soridraw-musicnote-list-start-divider']),
    libraryControls: collectUniqueNodes(['.soridraw-library-theme .soridraw-library-primary-controls']),
    libraryList: collectUniqueNodes(['.soridraw-library-theme .soridraw-library-list-start-divider']),
    externalStudioUi: collectUniqueNodes([
      '.soridraw-studio-left-panel',
      '.soridraw-studio-right-panel',
      '.soridraw-studio-action-bar',
      '.soridraw-studio-action-collapsed',
      '#soridraw-studio-workspace-hero-host',
    ]),
  };
  const union = new Set<Element>();
  Object.values(regions).forEach((set) => set.forEach((node) => union.add(node)));
  return {
    musicNoteControls: regions.musicNoteControls.size,
    musicNoteList: regions.musicNoteList.size,
    libraryControls: regions.libraryControls.size,
    libraryList: regions.libraryList.size,
    externalStudioUi: regions.externalStudioUi.size,
    other: Math.max(0, domNodes - union.size),
  };
};

const medianNumber = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const medianRounded = (values: number[], digits = 1) => round(medianNumber(values), digits);

const aggregateHotspots = (results: SplitPerfResult[]): SplitPerfHotspot[] => {
  const labels = new Set<string>();
  results.forEach((result) => result.hotspots.forEach((item) => labels.add(item.label)));
  return Array.from(labels).map((label) => {
    const rows = results.map((result) => result.hotspots.find((item) => item.label === label));
    return {
      label,
      count: Math.round(medianNumber(rows.map((row) => row?.count || 0))),
      totalMs: medianRounded(rows.map((row) => row?.totalMs || 0), 1),
      maxMs: medianRounded(rows.map((row) => row?.maxMs || 0), 1),
      forcedStyleLayoutMs: medianRounded(rows.map((row) => row?.forcedStyleLayoutMs || 0), 1),
    };
  }).sort((a, b) => b.totalMs - a.totalMs).slice(0, 8);
};

const ensureLongTaskObserver = () => {
  if (longTaskObserver || typeof PerformanceObserver === 'undefined') return;
  try {
    if (!getSupportedEntryTypes().includes('longtask')) return;
    longTaskObserver = new PerformanceObserver((list) => {
      if (!active) return;
      for (const entry of list.getEntries()) active.longTasks.push(entry.duration);
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch {
    longTaskObserver = null;
  }
};

const ensureLoafObserver = () => {
  if (loafObserver || typeof PerformanceObserver === 'undefined') return;
  loafSupported = getSupportedEntryTypes().includes('long-animation-frame');
  if (!loafSupported) return;

  try {
    loafObserver = new PerformanceObserver((list) => {
      if (!active) return;
      for (const rawEntry of list.getEntries()) {
        const entry = rawEntry as PerformanceEntry & {
          blockingDuration?: number;
          scripts?: Array<{
            duration?: number;
            forcedStyleAndLayoutDuration?: number;
            invoker?: string;
            invokerType?: string;
            sourceURL?: string;
            sourceFunctionName?: string;
          }>;
        };
        const duration = Math.max(0, Number(entry.duration) || 0);
        const blocking = Math.max(0, Number(entry.blockingDuration) || 0);
        active.loafDurations.push(duration);
        active.loafBlockingDurations.push(blocking);

        const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];
        let scriptTotal = 0;
        let forcedTotal = 0;
        for (const script of scripts) {
          const scriptDuration = Math.max(0, Number(script.duration) || 0);
          const forced = Math.max(0, Number(script.forcedStyleAndLayoutDuration) || 0);
          scriptTotal += scriptDuration;
          forcedTotal += forced;
          const invoker = String(script.invoker || '').trim();
          const invokerType = String(script.invokerType || '').trim();
          const functionName = String(script.sourceFunctionName || '').trim();
          const source = shortSource(String(script.sourceURL || ''));
          const primary = invoker || functionName || invokerType || 'script callback';
          const label = [primary, source].filter(Boolean).join(' · ');
          addHotspot(active.hotspots, label, scriptDuration, forced);
        }
        active.forcedStyleLayoutDurations.push(forcedTotal);

        // Time in a long animation frame that is not attributed to JS scripts is
        // the best in-app clue we can collect for browser rendering/layout/paint.
        const renderGap = Math.max(0, duration - scriptTotal);
        if (renderGap > 0.5) addHotspot(active.hotspots, '브라우저 렌더/레이아웃/페인트(비JS)', renderGap, 0);
      }
    });
    loafObserver.observe({ type: 'long-animation-frame', buffered: false } as PerformanceObserverInit);
  } catch {
    loafObserver = null;
    loafSupported = false;
  }
};

const ensureEventObserver = () => {
  if (eventObserver || typeof PerformanceObserver === 'undefined') return;
  eventTimingSupported = getSupportedEntryTypes().includes('event');
  if (!eventTimingSupported) return;

  try {
    eventObserver = new PerformanceObserver((list) => {
      if (!active) return;
      for (const rawEntry of list.getEntries()) {
        const entry = rawEntry as PerformanceEntry & { processingStart?: number };
        const duration = Math.max(0, Number(entry.duration) || 0);
        const processingStart = Number(entry.processingStart) || entry.startTime;
        const inputDelay = Math.max(0, processingStart - entry.startTime);
        active.slowEventDurations.push(duration);
        active.inputDelays.push(inputDelay);
      }
    });
    // Chrome only reports Event Timing entries above the requested threshold.
    eventObserver.observe({ type: 'event', buffered: false, durationThreshold: 16 } as PerformanceObserverInit);
  } catch {
    eventObserver = null;
    eventTimingSupported = false;
  }
};

const runRafProbe = () => {
  if (!active || typeof window === 'undefined') return;
  active.frameTimes.push(now());
  active.rafId = window.requestAnimationFrame(runRafProbe);
};

export const setSplitPerfDiagnosticsEnabled = (next: boolean) => {
  enabled = next;
  if (!enabled && active) {
    if (active.rafId !== null && typeof window !== 'undefined') window.cancelAnimationFrame(active.rafId);
    active = null;
  }
};

export const isSplitPerfDiagnosticsEnabled = () => enabled;
export const isSplitPerfDragActive = () => Boolean(enabled && active);

export const beginSplitPerfDrag = ({
  workspaceView,
  engine,
  builder,
  result,
  benchmarkSurface = null,
  benchmarkSurfacePass = null,
  layoutMode = null,
  captureKind = 'drag',
  outerRightGapBaseline = null,
  initialWorkspaceRight = null,
}: {
  workspaceView?: string;
  engine: string;
  builder: HTMLElement | null;
  result: HTMLElement | null;
  benchmarkSurface?: string | null;
  benchmarkSurfacePass?: boolean | null;
  layoutMode?: 'css-var' | 'direct' | null;
  captureKind?: 'drag' | 'window-resize';
  outerRightGapBaseline?: number | null;
  initialWorkspaceRight?: number | null;
}) => {
  if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return;
  if (active?.rafId !== null && active?.rafId !== undefined) window.cancelAnimationFrame(active.rafId);
  ensureLongTaskObserver();
  ensureLoafObserver();
  ensureEventObserver();
  const domNodes = document.getElementsByTagName('*').length;
  const regionNodes = collectRegionNodeCounts(domNodes);
  active = {
    workspaceView: workspaceView || 'create',
    captureKind,
    engine,
    startedAt: now(),
    frameTimes: [],
    flushTimes: [],
    contentCommitCount: 0,
    dividerOnlyCount: 0,
    applySamples: [],
    longTasks: [],
    loafDurations: [],
    loafBlockingDurations: [],
    forcedStyleLayoutDurations: [],
    slowEventDurations: [],
    inputDelays: [],
    pointerEventTimes: [],
    pointerXs: [],
    pointerSampleCount: 0,
    latestPointerX: null,
    spatialSampleTimes: [],
    cursorDividerGaps: [],
    cursorDividerSignedGaps: [],
    cursorDividerGapJitters: [],
    cursorPaneGaps: [],
    cursorPaneSignedGaps: [],
    cursorPaneGapJitters: [],
    cursorDividerLeadGaps: [],
    cursorDividerLeadOver6Count: 0,
    latestDividerX: null,
    outerRightGaps: [],
    outerRightGapDeltas: [],
    outerRightGapJitters: [],
    outerRightGapBaseline: Number.isFinite(outerRightGapBaseline) ? Number(outerRightGapBaseline) : null,
    latestWorkspaceRight: Number.isFinite(initialWorkspaceRight) ? Number(initialWorkspaceRight) : null,
    viewportWidths: [],
    commitTimes: [],
    inputToCommitLatencies: [],
    lastPointerAt: null,
    geometryWriteCount: 0,
    lastGeometryWriteAt: null,
    expectedBuilderWidth: null,
    expectedResultWidth: null,
    layoutAckTimes: [],
    layoutAckLatencies: [],
    layoutAckWidthErrors: [],
    paneModeSwitchCount: 0,
    contentModeSwitchCount: 0,
    hotspots: new Map(),
    // Count once before dragging so diagnostics do not add DOM traversal inside the hot path.
    domNodes,
    builderNodes: builder ? builder.getElementsByTagName('*').length : 0,
    resultNodes: result ? result.getElementsByTagName('*').length : 0,
    regionNodes,
    benchmarkSurface,
    benchmarkSurfacePass,
    layoutMode,
    rafId: null,
  };
  runRafProbe();
};

export const recordSplitPerfPointer = (clientX: number, coalescedCount = 1) => {
  if (!enabled || !active) return;
  const timestamp = now();
  active.pointerEventTimes.push(timestamp);
  active.pointerXs.push(clientX);
  active.pointerSampleCount += Math.max(1, Math.round(coalescedCount || 1));
  active.latestPointerX = clientX;
  if (active.captureKind === 'drag' && active.latestDividerX !== null) {
    const leadGap = Math.abs(clientX - active.latestDividerX);
    active.cursorDividerLeadGaps.push(leadGap);
    if (leadGap >= 6) active.cursorDividerLeadOver6Count += 1;
  }
  active.lastPointerAt = timestamp;
};

export const recordSplitPerfGeometryWrite = (builderWidth: number, resultWidth: number) => {
  if (!enabled || !active) return;
  active.geometryWriteCount += 1;
  active.lastGeometryWriteAt = now();
  active.expectedBuilderWidth = Number.isFinite(builderWidth) ? builderWidth : null;
  active.expectedResultWidth = Number.isFinite(resultWidth) ? resultWidth : null;
};

export const recordSplitPerfLayoutAck = (builderWidth: number, resultWidth: number) => {
  if (!enabled || !active || active.lastGeometryWriteAt === null) return;
  const timestamp = now();
  active.layoutAckTimes.push(timestamp);
  active.layoutAckLatencies.push(Math.max(0, timestamp - active.lastGeometryWriteAt));
  const builderError = active.expectedBuilderWidth === null ? 0 : Math.abs(builderWidth - active.expectedBuilderWidth);
  const resultError = active.expectedResultWidth === null ? 0 : Math.abs(resultWidth - active.expectedResultWidth);
  active.layoutAckWidthErrors.push(Math.max(builderError, resultError));
};

export const recordSplitPerfDividerSample = (dividerX: number) => {
  if (!enabled || !active || active.captureKind !== 'drag' || active.latestPointerX === null) return;
  const safeDividerX = Number.isFinite(dividerX) ? dividerX : 0;
  const signedGap = active.latestPointerX - safeDividerX;
  active.cursorDividerGaps.push(Math.abs(signedGap));
  active.cursorDividerSignedGaps.push(signedGap);
  if (active.cursorDividerSignedGaps.length > 1) {
    const previousGap = active.cursorDividerSignedGaps[active.cursorDividerSignedGaps.length - 2];
    active.cursorDividerGapJitters.push(Math.abs(signedGap - previousGap));
  }
  active.latestDividerX = safeDividerX;
};

const pushOuterRightGap = (target: ActiveDrag, rightGap: number) => {
  if (!Number.isFinite(rightGap)) return;
  target.outerRightGaps.push(rightGap);
  if (target.outerRightGapBaseline === null) target.outerRightGapBaseline = rightGap;
  target.outerRightGapDeltas.push(Math.abs(rightGap - target.outerRightGapBaseline));
  if (target.outerRightGaps.length > 1) {
    const previousGap = target.outerRightGaps[target.outerRightGaps.length - 2];
    target.outerRightGapJitters.push(Math.abs(rightGap - previousGap));
  }
};

export const recordSplitPerfViewportSample = (viewportWidth: number) => {
  if (!enabled || !active || active.captureKind !== 'window-resize') return;
  const safeViewport = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  active.viewportWidths.push(safeViewport);
  if (active.latestWorkspaceRight !== null) pushOuterRightGap(active, safeViewport - active.latestWorkspaceRight);
};

export const recordSplitPerfSpatialSample = ({
  workspaceLeft,
  builderWidth,
  resultWidth,
  viewportWidth,
}: {
  workspaceLeft: number;
  builderWidth: number;
  resultWidth: number;
  viewportWidth: number;
}) => {
  if (!enabled || !active) return;
  const safeLeft = Number.isFinite(workspaceLeft) ? workspaceLeft : 0;
  const safeBuilder = Number.isFinite(builderWidth) ? Math.max(0, builderWidth) : 0;
  const safeResult = Number.isFinite(resultWidth) ? Math.max(0, resultWidth) : 0;
  const safeViewport = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const dividerX = safeLeft + safeBuilder;
  const timestamp = now();
  active.spatialSampleTimes.push(timestamp);

  if (active.captureKind === 'drag' && active.latestPointerX !== null) {
    const signedGap = active.latestPointerX - dividerX;
    active.cursorPaneGaps.push(Math.abs(signedGap));
    active.cursorPaneSignedGaps.push(signedGap);
    if (active.cursorPaneSignedGaps.length > 1) {
      const previousGap = active.cursorPaneSignedGaps[active.cursorPaneSignedGaps.length - 2];
      active.cursorPaneGapJitters.push(Math.abs(signedGap - previousGap));
    }
  }

  if (active.captureKind === 'window-resize') {
    const workspaceRight = safeLeft + safeBuilder + safeResult;
    active.latestWorkspaceRight = workspaceRight;
    pushOuterRightGap(active, safeViewport - workspaceRight);
  }
};

export const recordSplitPerfResponsiveSwitch = (kind: 'pane' | 'content') => {
  if (!enabled || !active) return;
  if (kind === 'pane') active.paneModeSwitchCount += 1;
  else active.contentModeSwitchCount += 1;
};

export const recordSplitPerfFlush = (durationMs: number, contentCommitted: boolean) => {
  if (!enabled || !active) return;
  active.flushTimes.push(durationMs);
  if (contentCommitted) {
    active.contentCommitCount += 1;
    const timestamp = now();
    active.commitTimes.push(timestamp);
    if (active.lastPointerAt !== null) active.inputToCommitLatencies.push(Math.max(0, timestamp - active.lastPointerAt));
  } else {
    active.dividerOnlyCount += 1;
  }
};

export const recordSplitPerfApply = (sample: SplitPerfApplySample) => {
  if (!enabled || !active) return;
  active.applySamples.push(sample);
};

export const finishSplitPerfDrag = () => {
  if (!enabled || !active || typeof window === 'undefined') return;
  const endedAt = now();
  if (active.rafId !== null) window.cancelAnimationFrame(active.rafId);

  const frameGaps: number[] = [];
  for (let index = 1; index < active.frameTimes.length; index += 1) {
    frameGaps.push(active.frameTimes[index] - active.frameTimes[index - 1]);
  }
  const durationMs = Math.max(1, endedAt - active.startedAt);
  const applyTotals = active.applySamples.map((sample) => sample.totalMs);
  const layoutWrites = active.applySamples.map((sample) => sample.layoutWriteMs);
  const responsive = active.applySamples.map((sample) => sample.responsiveMs);
  const external = active.applySamples.map((sample) => sample.externalMs);
  const misc = active.applySamples.map((sample) => sample.miscMs);
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  const heapMb = memory?.usedJSHeapSize ? memory.usedJSHeapSize / 1024 / 1024 : null;
  const pointerGaps: number[] = [];
  for (let index = 1; index < active.pointerEventTimes.length; index += 1) pointerGaps.push(active.pointerEventTimes[index] - active.pointerEventTimes[index - 1]);
  const commitGaps: number[] = [];
  for (let index = 1; index < active.commitTimes.length; index += 1) commitGaps.push(active.commitTimes[index] - active.commitTimes[index - 1]);
  const layoutAckGaps: number[] = [];
  for (let index = 1; index < active.layoutAckTimes.length; index += 1) layoutAckGaps.push(active.layoutAckTimes[index] - active.layoutAckTimes[index - 1]);
  let pointerDistancePx = 0;
  for (let index = 1; index < active.pointerXs.length; index += 1) pointerDistancePx += Math.abs(active.pointerXs[index] - active.pointerXs[index - 1]);
  let viewportWidthDistancePx = 0;
  for (let index = 1; index < active.viewportWidths.length; index += 1) viewportWidthDistancePx += Math.abs(active.viewportWidths[index] - active.viewportWidths[index - 1]);

  const hotspotRows: SplitPerfHotspot[] = Array.from(active.hotspots.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      totalMs: round(value.totalMs, 1),
      maxMs: round(value.maxMs, 1),
      forcedStyleLayoutMs: round(value.forcedStyleLayoutMs, 1),
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 8);

  lastResult = {
    host: window.location.host || 'local-preview',
    captureKind: active.captureKind,
    workspaceView: active.workspaceView,
    engine: active.engine,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    dpr: window.devicePixelRatio || 1,
    durationMs: round(durationMs, 0),
    rafFrames: active.frameTimes.length,
    estimatedFps: round((Math.max(0, active.frameTimes.length - 1) * 1000) / durationMs, 1),
    avgFrameMs: round(mean(frameGaps), 2),
    p95FrameMs: round(percentile(frameGaps, 0.95), 2),
    maxFrameMs: round(max(frameGaps), 2),
    over20ms: frameGaps.filter((value) => value > 20).length,
    over34ms: frameGaps.filter((value) => value > 34).length,
    over50ms: frameGaps.filter((value) => value > 50).length,
    longTaskCount: active.longTasks.length,
    longTaskTotalMs: round(active.longTasks.reduce((sum, value) => sum + value, 0), 1),
    longTaskMaxMs: round(max(active.longTasks), 1),
    loafSupported,
    loafCount: active.loafDurations.length,
    loafTotalMs: round(active.loafDurations.reduce((sum, value) => sum + value, 0), 1),
    loafMaxMs: round(max(active.loafDurations), 1),
    loafBlockingTotalMs: round(active.loafBlockingDurations.reduce((sum, value) => sum + value, 0), 1),
    forcedStyleLayoutTotalMs: round(active.forcedStyleLayoutDurations.reduce((sum, value) => sum + value, 0), 1),
    forcedStyleLayoutMaxMs: round(max(active.forcedStyleLayoutDurations), 1),
    eventTimingSupported,
    slowEventCount: active.slowEventDurations.length,
    slowEventTotalMs: round(active.slowEventDurations.reduce((sum, value) => sum + value, 0), 1),
    slowEventMaxMs: round(max(active.slowEventDurations), 1),
    inputDelayAvgMs: round(mean(active.inputDelays), 2),
    inputDelayMaxMs: round(max(active.inputDelays), 2),
    pointerEventCount: active.pointerEventTimes.length,
    pointerEventRate: round((active.pointerEventTimes.length * 1000) / durationMs, 1),
    pointerSampleCount: active.pointerSampleCount,
    pointerSampleRate: round((active.pointerSampleCount * 1000) / durationMs, 1),
    pointerDistancePx: round(pointerDistancePx, 0),
    pointerGapAvgMs: round(mean(pointerGaps), 2),
    pointerGapP95Ms: round(percentile(pointerGaps, 0.95), 2),
    pointerGapMaxMs: round(max(pointerGaps), 2),
    commitPerPointerPct: round((active.contentCommitCount / Math.max(1, active.pointerEventTimes.length)) * 100, 1),
    commitRate: round((active.contentCommitCount * 1000) / durationMs, 1),
    commitGapAvgMs: round(mean(commitGaps), 2),
    commitGapP95Ms: round(percentile(commitGaps, 0.95), 2),
    commitGapMaxMs: round(max(commitGaps), 2),
    commitCoveragePct: round((active.contentCommitCount / Math.max(1, active.frameTimes.length - 1)) * 100, 1),
    inputToCommitAvgMs: round(mean(active.inputToCommitLatencies), 2),
    inputToCommitP95Ms: round(percentile(active.inputToCommitLatencies, 0.95), 2),
    inputToCommitMaxMs: round(max(active.inputToCommitLatencies), 2),
    layoutAckCount: active.layoutAckTimes.length,
    layoutAckRate: round((active.layoutAckTimes.length * 1000) / durationMs, 1),
    layoutAckGapAvgMs: round(mean(layoutAckGaps), 2),
    layoutAckGapP95Ms: round(percentile(layoutAckGaps, 0.95), 2),
    layoutAckGapMaxMs: round(max(layoutAckGaps), 2),
    layoutAckToWriteAvgMs: round(mean(active.layoutAckLatencies), 2),
    layoutAckToWriteP95Ms: round(percentile(active.layoutAckLatencies, 0.95), 2),
    layoutAckToWriteMaxMs: round(max(active.layoutAckLatencies), 2),
    layoutAckWidthErrorAvgPx: round(mean(active.layoutAckWidthErrors), 2),
    layoutAckWidthErrorMaxPx: round(max(active.layoutAckWidthErrors), 2),
    layoutAckPerCommitPct: round((active.layoutAckTimes.length / Math.max(1, active.geometryWriteCount)) * 100, 1),
    spatialSampleCount: active.spatialSampleTimes.length,
    spatialSampleRate: round((active.spatialSampleTimes.length * 1000) / durationMs, 1),
    cursorDividerGapAvgPx: round(mean(active.cursorDividerGaps), 2),
    cursorDividerGapP95Px: round(percentile(active.cursorDividerGaps, 0.95), 2),
    cursorDividerGapMaxPx: round(max(active.cursorDividerGaps), 2),
    cursorDividerGapJitterP95Px: round(percentile(active.cursorDividerGapJitters, 0.95), 2),
    cursorDividerGapJitterMaxPx: round(max(active.cursorDividerGapJitters), 2),
    cursorDividerLeadAvgPx: round(mean(active.cursorDividerLeadGaps), 2),
    cursorDividerLeadP95Px: round(percentile(active.cursorDividerLeadGaps, 0.95), 2),
    cursorDividerLeadMaxPx: round(max(active.cursorDividerLeadGaps), 2),
    cursorDividerLeadOver6Pct: round((active.cursorDividerLeadOver6Count / Math.max(1, active.cursorDividerLeadGaps.length)) * 100, 1),
    cursorPaneGapAvgPx: round(mean(active.cursorPaneGaps), 2),
    cursorPaneGapP95Px: round(percentile(active.cursorPaneGaps, 0.95), 2),
    cursorPaneGapMaxPx: round(max(active.cursorPaneGaps), 2),
    cursorPaneGapJitterP95Px: round(percentile(active.cursorPaneGapJitters, 0.95), 2),
    cursorPaneGapJitterMaxPx: round(max(active.cursorPaneGapJitters), 2),
    outerRightGapAvgPx: round(mean(active.outerRightGaps), 2),
    outerRightGapDeltaP95Px: round(percentile(active.outerRightGapDeltas, 0.95), 2),
    outerRightGapDeltaMaxPx: round(max(active.outerRightGapDeltas), 2),
    outerRightGapJitterP95Px: round(percentile(active.outerRightGapJitters, 0.95), 2),
    outerRightGapJitterMaxPx: round(max(active.outerRightGapJitters), 2),
    viewportWidthDistancePx: round(viewportWidthDistancePx, 0),
    paneModeSwitchCount: active.paneModeSwitchCount,
    contentModeSwitchCount: active.contentModeSwitchCount,
    hotspots: hotspotRows,
    flushCount: active.flushTimes.length,
    flushAvgMs: round(mean(active.flushTimes), 3),
    flushMaxMs: round(max(active.flushTimes), 3),
    contentCommitCount: active.contentCommitCount,
    dividerOnlyCount: active.dividerOnlyCount,
    applyCount: active.applySamples.length,
    applyAvgMs: round(mean(applyTotals), 3),
    applyMaxMs: round(max(applyTotals), 3),
    layoutWriteAvgMs: round(mean(layoutWrites), 3),
    responsiveAvgMs: round(mean(responsive), 3),
    externalAvgMs: round(mean(external), 3),
    miscAvgMs: round(mean(misc), 3),
    domNodes: active.domNodes,
    builderNodes: active.builderNodes,
    resultNodes: active.resultNodes,
    regionNodes: active.regionNodes,
    heapMb: heapMb === null ? null : round(heapMb, 1),
    benchmarkSurface: active.benchmarkSurface,
    benchmarkSurfacePass: active.benchmarkSurfacePass,
    layoutMode: active.layoutMode,
    createdAt: Date.now(),
  };

  active = null;
  notify();
  try {
    console.groupCollapsed('[SORIDRAW Split PERF]', lastResult.host, lastResult.workspaceView);
    console.table(lastResult);
    if (lastResult.hotspots.length) console.table(lastResult.hotspots);
    console.groupEnd();
  } catch {
    // Console output is optional.
  }
};

export const clearSplitPerfBenchmarkSummary = () => {
  lastBenchmarkSummary = null;
  benchmarkListeners.forEach((listener) => listener(lastBenchmarkSummary));
};

export const publishSplitPerfBenchmarkSummary = (results: SplitPerfResult[]) => {
  if (!results.length) return null;
  const first = results[0];
  const number = (key: keyof SplitPerfResult, digits = 1) => medianRounded(results.map((result) => Number(result[key]) || 0), digits);
  const boolMajority = (key: keyof SplitPerfResult) => results.filter((result) => Boolean(result[key])).length >= Math.ceil(results.length / 2);
  const heapValues = results.map((result) => result.heapMb).filter((value): value is number => value !== null);
  const median: SplitPerfResult = {
    ...first,
    engine: `Lite V2 · auto benchmark 610 · ${results.length}세트 중앙값`,
    durationMs: number('durationMs', 0),
    rafFrames: Math.round(number('rafFrames', 0)),
    estimatedFps: number('estimatedFps', 1),
    avgFrameMs: number('avgFrameMs', 2),
    p95FrameMs: number('p95FrameMs', 2),
    maxFrameMs: number('maxFrameMs', 2),
    over20ms: Math.round(number('over20ms', 0)),
    over34ms: Math.round(number('over34ms', 0)),
    over50ms: Math.round(number('over50ms', 0)),
    longTaskCount: Math.round(number('longTaskCount', 0)),
    longTaskTotalMs: number('longTaskTotalMs', 1),
    longTaskMaxMs: number('longTaskMaxMs', 1),
    loafSupported: boolMajority('loafSupported'),
    loafCount: Math.round(number('loafCount', 0)),
    loafTotalMs: number('loafTotalMs', 1),
    loafMaxMs: number('loafMaxMs', 1),
    loafBlockingTotalMs: number('loafBlockingTotalMs', 1),
    forcedStyleLayoutTotalMs: number('forcedStyleLayoutTotalMs', 1),
    forcedStyleLayoutMaxMs: number('forcedStyleLayoutMaxMs', 1),
    eventTimingSupported: boolMajority('eventTimingSupported'),
    slowEventCount: Math.round(number('slowEventCount', 0)),
    slowEventTotalMs: number('slowEventTotalMs', 1),
    slowEventMaxMs: number('slowEventMaxMs', 1),
    inputDelayAvgMs: number('inputDelayAvgMs', 2),
    inputDelayMaxMs: number('inputDelayMaxMs', 2),
    pointerEventCount: Math.round(number('pointerEventCount', 0)),
    pointerEventRate: number('pointerEventRate', 1),
    pointerSampleCount: Math.round(number('pointerSampleCount', 0)),
    pointerSampleRate: number('pointerSampleRate', 1),
    pointerDistancePx: number('pointerDistancePx', 0),
    pointerGapAvgMs: number('pointerGapAvgMs', 2),
    pointerGapP95Ms: number('pointerGapP95Ms', 2),
    pointerGapMaxMs: number('pointerGapMaxMs', 2),
    commitPerPointerPct: number('commitPerPointerPct', 1),
    commitRate: number('commitRate', 1),
    commitGapAvgMs: number('commitGapAvgMs', 2),
    commitGapP95Ms: number('commitGapP95Ms', 2),
    commitGapMaxMs: number('commitGapMaxMs', 2),
    commitCoveragePct: number('commitCoveragePct', 1),
    inputToCommitAvgMs: number('inputToCommitAvgMs', 2),
    inputToCommitP95Ms: number('inputToCommitP95Ms', 2),
    inputToCommitMaxMs: number('inputToCommitMaxMs', 2),
    layoutAckCount: Math.round(number('layoutAckCount', 0)),
    layoutAckRate: number('layoutAckRate', 1),
    layoutAckGapAvgMs: number('layoutAckGapAvgMs', 2),
    layoutAckGapP95Ms: number('layoutAckGapP95Ms', 2),
    layoutAckGapMaxMs: number('layoutAckGapMaxMs', 2),
    layoutAckToWriteAvgMs: number('layoutAckToWriteAvgMs', 2),
    layoutAckToWriteP95Ms: number('layoutAckToWriteP95Ms', 2),
    layoutAckToWriteMaxMs: number('layoutAckToWriteMaxMs', 2),
    layoutAckWidthErrorAvgPx: number('layoutAckWidthErrorAvgPx', 2),
    layoutAckWidthErrorMaxPx: number('layoutAckWidthErrorMaxPx', 2),
    layoutAckPerCommitPct: number('layoutAckPerCommitPct', 1),
    spatialSampleCount: Math.round(number('spatialSampleCount', 0)),
    spatialSampleRate: number('spatialSampleRate', 1),
    cursorDividerGapAvgPx: number('cursorDividerGapAvgPx', 2),
    cursorDividerGapP95Px: number('cursorDividerGapP95Px', 2),
    cursorDividerGapMaxPx: number('cursorDividerGapMaxPx', 2),
    cursorDividerGapJitterP95Px: number('cursorDividerGapJitterP95Px', 2),
    cursorDividerGapJitterMaxPx: number('cursorDividerGapJitterMaxPx', 2),
    cursorDividerLeadAvgPx: number('cursorDividerLeadAvgPx', 2),
    cursorDividerLeadP95Px: number('cursorDividerLeadP95Px', 2),
    cursorDividerLeadMaxPx: number('cursorDividerLeadMaxPx', 2),
    cursorDividerLeadOver6Pct: number('cursorDividerLeadOver6Pct', 1),
    cursorPaneGapAvgPx: number('cursorPaneGapAvgPx', 2),
    cursorPaneGapP95Px: number('cursorPaneGapP95Px', 2),
    cursorPaneGapMaxPx: number('cursorPaneGapMaxPx', 2),
    cursorPaneGapJitterP95Px: number('cursorPaneGapJitterP95Px', 2),
    cursorPaneGapJitterMaxPx: number('cursorPaneGapJitterMaxPx', 2),
    outerRightGapAvgPx: number('outerRightGapAvgPx', 2),
    outerRightGapDeltaP95Px: number('outerRightGapDeltaP95Px', 2),
    outerRightGapDeltaMaxPx: number('outerRightGapDeltaMaxPx', 2),
    outerRightGapJitterP95Px: number('outerRightGapJitterP95Px', 2),
    outerRightGapJitterMaxPx: number('outerRightGapJitterMaxPx', 2),
    viewportWidthDistancePx: number('viewportWidthDistancePx', 0),
    paneModeSwitchCount: Math.round(number('paneModeSwitchCount', 0)),
    contentModeSwitchCount: Math.round(number('contentModeSwitchCount', 0)),
    hotspots: aggregateHotspots(results),
    flushCount: Math.round(number('flushCount', 0)),
    flushAvgMs: number('flushAvgMs', 3),
    flushMaxMs: number('flushMaxMs', 3),
    contentCommitCount: Math.round(number('contentCommitCount', 0)),
    dividerOnlyCount: Math.round(number('dividerOnlyCount', 0)),
    applyCount: Math.round(number('applyCount', 0)),
    applyAvgMs: number('applyAvgMs', 3),
    applyMaxMs: number('applyMaxMs', 3),
    layoutWriteAvgMs: number('layoutWriteAvgMs', 3),
    responsiveAvgMs: number('responsiveAvgMs', 3),
    externalAvgMs: number('externalAvgMs', 3),
    miscAvgMs: number('miscAvgMs', 3),
    domNodes: Math.round(number('domNodes', 0)),
    builderNodes: Math.round(number('builderNodes', 0)),
    resultNodes: Math.round(number('resultNodes', 0)),
    regionNodes: {
      musicNoteControls: Math.round(medianNumber(results.map((result) => result.regionNodes.musicNoteControls))),
      musicNoteList: Math.round(medianNumber(results.map((result) => result.regionNodes.musicNoteList))),
      libraryControls: Math.round(medianNumber(results.map((result) => result.regionNodes.libraryControls))),
      libraryList: Math.round(medianNumber(results.map((result) => result.regionNodes.libraryList))),
      externalStudioUi: Math.round(medianNumber(results.map((result) => result.regionNodes.externalStudioUi))),
      other: Math.round(medianNumber(results.map((result) => result.regionNodes.other))),
    },
    heapMb: heapValues.length ? medianRounded(heapValues, 1) : null,
    createdAt: Date.now(),
  };
  lastBenchmarkSummary = { setCount: results.length, median, sets: [...results], createdAt: Date.now() };
  benchmarkListeners.forEach((listener) => listener(lastBenchmarkSummary));
  return lastBenchmarkSummary;
};

export const subscribeSplitPerfBenchmarkSummary = (listener: BenchmarkListener) => {
  benchmarkListeners.add(listener);
  listener(lastBenchmarkSummary);
  return () => { benchmarkListeners.delete(listener); };
};

export const getLastSplitPerfBenchmarkSummary = () => lastBenchmarkSummary;

export const subscribeSplitPerfResult = (listener: Listener) => {
  listeners.add(listener);
  listener(lastResult);
  return () => { listeners.delete(listener); };
};

export const getLastSplitPerfResult = () => lastResult;
