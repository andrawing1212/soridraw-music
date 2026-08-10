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
  inputMode: 'react' | 'native' | 'raw' | 'continuous' | 'auto' | null;
  pointerEventCount: number;
  pointerCoalescedCount: number;
  pointerEventsPerSecond: number;
  pointerIntervalAvgMs: number;
  pointerIntervalP95Ms: number;
  pointerBatchAvg: number;
  pointerBatchMax: number;
  inputToCommitAvgMs: number;
  inputToCommitP95Ms: number;
  inputToCommitMaxMs: number;
  pointerActiveDurationMs: number;
  pointerActiveEventsPerSecond: number;
  pointerActiveSamplesPerSecond: number;
  pointerPauseGapCount: number;
  pointerCommitCount: number;
  pointerCommitsPerSecond: number;
  pointerCommitIntervalP95Ms: number;
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
  hotspots: Map<string, HotspotAccumulator>;
  domNodes: number;
  builderNodes: number;
  resultNodes: number;
  regionNodes: SplitPerfRegionNodes;
  benchmarkSurface: string | null;
  benchmarkSurfacePass: boolean | null;
  layoutMode: 'css-var' | 'direct' | null;
  inputMode: 'react' | 'native' | 'raw' | 'continuous' | 'auto' | null;
  pointerEventTimes: number[];
  pointerClientXs: number[];
  pointerCoalescedCounts: number[];
  pointerCoalescedCount: number;
  pointerPendingBatch: number;
  pointerBatches: number[];
  pointerCommitTimes: number[];
  lastPointerInputAt: number | null;
  inputToCommitLatencies: number[];
  rafId: number | null;
};

type Listener = (result: SplitPerfResult | null) => void;
type BenchmarkListener = (summary: SplitPerfBenchmarkSummary | null) => void;

export const SPLIT_PERF_TOOL_VISIBILITY_STORAGE_KEY = 'soridraw_admin_split_perf_tools_enabled_v1';
export const SPLIT_PERF_TOOL_VISIBILITY_EVENT = 'soridraw:split-perf-tool-visibility';
export const SPLIT_PERF_BENCHMARK_REQUEST_EVENT = 'soridraw:split-perf-benchmark-request';
export const SPLIT_PERF_BENCHMARK_STATUS_EVENT = 'soridraw:split-perf-benchmark-status';
export const SPLIT_PERF_INPUT_MODE_EVENT = 'soridraw:split-perf-input-mode';

export const readSplitPerfToolVisibility = () => {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(SPLIT_PERF_TOOL_VISIBILITY_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

export const writeSplitPerfToolVisibility = (next: boolean) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(SPLIT_PERF_TOOL_VISIBILITY_STORAGE_KEY, String(next)); } catch { /* optional */ }
  window.dispatchEvent(new CustomEvent(SPLIT_PERF_TOOL_VISIBILITY_EVENT, { detail: { enabled: next } }));
};

let enabled = true; // Collection only runs while the admin diagnostic tool is enabled.
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
  inputMode = null,
}: {
  workspaceView?: string;
  engine: string;
  builder: HTMLElement | null;
  result: HTMLElement | null;
  benchmarkSurface?: string | null;
  benchmarkSurfacePass?: boolean | null;
  layoutMode?: 'css-var' | 'direct' | null;
  inputMode?: 'react' | 'native' | 'raw' | 'continuous' | 'auto' | null;
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
    hotspots: new Map(),
    // Count once before dragging so diagnostics do not add DOM traversal inside the hot path.
    domNodes,
    builderNodes: builder ? builder.getElementsByTagName('*').length : 0,
    resultNodes: result ? result.getElementsByTagName('*').length : 0,
    regionNodes,
    benchmarkSurface,
    benchmarkSurfacePass,
    layoutMode,
    inputMode,
    pointerEventTimes: [],
    pointerClientXs: [],
    pointerCoalescedCounts: [],
    pointerCoalescedCount: 0,
    pointerPendingBatch: 0,
    pointerBatches: [],
    pointerCommitTimes: [],
    lastPointerInputAt: null,
    inputToCommitLatencies: [],
    rafId: null,
  };
  runRafProbe();
};

export const recordSplitPerfPointerInput = (
  inputMode: 'react' | 'native' | 'raw' | 'continuous',
  receivedAt: number,
  coalescedCount = 1,
  clientX = Number.NaN,
) => {
  if (!enabled || !active) return;
  active.inputMode = inputMode;
  const timestamp = Number.isFinite(receivedAt) ? receivedAt : now();
  const samples = Math.max(1, Math.round(coalescedCount || 1));
  active.pointerEventTimes.push(timestamp);
  active.pointerClientXs.push(Number.isFinite(clientX) ? clientX : Number.NaN);
  active.pointerCoalescedCounts.push(samples);
  active.pointerCoalescedCount += samples;
  active.pointerPendingBatch += 1;
  active.lastPointerInputAt = timestamp;
};

export const recordSplitPerfPointerCommit = (committedAt: number, allowWithoutPendingInput = false) => {
  if (!enabled || !active) return;
  const hadPendingInput = active.pointerPendingBatch > 0;
  if (!hadPendingInput && !allowWithoutPendingInput) return;
  const timestamp = Number.isFinite(committedAt) ? committedAt : now();
  active.pointerBatches.push(hadPendingInput ? active.pointerPendingBatch : 0);
  active.pointerPendingBatch = 0;
  active.pointerCommitTimes.push(timestamp);
  // Synthetic/interpolated continuous-rAF commits are still visual commits, but
  // only fresh pointer input should contribute to input→commit latency.
  if (hadPendingInput && active.lastPointerInputAt !== null) {
    active.inputToCommitLatencies.push(Math.max(0, timestamp - active.lastPointerInputAt));
  }
};

export const recordSplitPerfFlush = (durationMs: number, contentCommitted: boolean) => {
  if (!enabled || !active) return;
  active.flushTimes.push(durationMs);
  if (contentCommitted) active.contentCommitCount += 1;
  else active.dividerOnlyCount += 1;
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
  const pointerIntervals: number[] = [];
  const activePointerIntervals: number[] = [];
  let activePointerSamples = 0;
  let pointerPauseGapCount = 0;
  const ACTIVE_POINTER_GAP_MS = 120;
  for (let index = 1; index < active.pointerEventTimes.length; index += 1) {
    const interval = active.pointerEventTimes[index] - active.pointerEventTimes[index - 1];
    pointerIntervals.push(interval);
    const currentX = active.pointerClientXs[index];
    const previousX = active.pointerClientXs[index - 1];
    const moved = !Number.isFinite(currentX) || !Number.isFinite(previousX) || Math.abs(currentX - previousX) >= 0.25;
    if (interval <= ACTIVE_POINTER_GAP_MS && moved) {
      activePointerIntervals.push(interval);
      activePointerSamples += active.pointerCoalescedCounts[index] || 1;
    } else if (interval > ACTIVE_POINTER_GAP_MS) {
      pointerPauseGapCount += 1;
    }
  }
  if (active.pointerPendingBatch > 0) active.pointerBatches.push(active.pointerPendingBatch);
  const activePointerDurationMs = activePointerIntervals.reduce((sum, value) => sum + value, 0);
  const pointerCommitIntervals: number[] = [];
  for (let index = 1; index < active.pointerCommitTimes.length; index += 1) {
    const interval = active.pointerCommitTimes[index] - active.pointerCommitTimes[index - 1];
    if (interval <= ACTIVE_POINTER_GAP_MS) pointerCommitIntervals.push(interval);
  }

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
    inputMode: active.inputMode,
    pointerEventCount: active.pointerEventTimes.length,
    pointerCoalescedCount: active.pointerCoalescedCount,
    pointerEventsPerSecond: round((active.pointerEventTimes.length * 1000) / durationMs, 1),
    pointerIntervalAvgMs: round(mean(pointerIntervals), 2),
    pointerIntervalP95Ms: round(percentile(pointerIntervals, 0.95), 2),
    pointerBatchAvg: round(mean(active.pointerBatches), 2),
    pointerBatchMax: round(max(active.pointerBatches), 0),
    inputToCommitAvgMs: round(mean(active.inputToCommitLatencies), 2),
    inputToCommitP95Ms: round(percentile(active.inputToCommitLatencies, 0.95), 2),
    inputToCommitMaxMs: round(max(active.inputToCommitLatencies), 2),
    pointerActiveDurationMs: round(activePointerDurationMs, 0),
    pointerActiveEventsPerSecond: activePointerDurationMs > 0 ? round((activePointerIntervals.length * 1000) / activePointerDurationMs, 1) : 0,
    pointerActiveSamplesPerSecond: activePointerDurationMs > 0 ? round((activePointerSamples * 1000) / activePointerDurationMs, 1) : 0,
    pointerPauseGapCount,
    pointerCommitCount: active.pointerCommitTimes.length,
    pointerCommitsPerSecond: pointerCommitIntervals.length > 0 ? round((pointerCommitIntervals.length * 1000) / pointerCommitIntervals.reduce((sum, value) => sum + value, 0), 1) : 0,
    pointerCommitIntervalP95Ms: round(percentile(pointerCommitIntervals, 0.95), 2),
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
    engine: `Lite V2 · auto benchmark 594 · ${results.length}세트 중앙값`,
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
    inputMode: 'auto',
    pointerEventCount: Math.round(number('pointerEventCount', 0)),
    pointerCoalescedCount: Math.round(number('pointerCoalescedCount', 0)),
    pointerEventsPerSecond: number('pointerEventsPerSecond', 1),
    pointerIntervalAvgMs: number('pointerIntervalAvgMs', 2),
    pointerIntervalP95Ms: number('pointerIntervalP95Ms', 2),
    pointerBatchAvg: number('pointerBatchAvg', 2),
    pointerBatchMax: number('pointerBatchMax', 0),
    inputToCommitAvgMs: number('inputToCommitAvgMs', 2),
    inputToCommitP95Ms: number('inputToCommitP95Ms', 2),
    inputToCommitMaxMs: number('inputToCommitMaxMs', 2),
    pointerActiveDurationMs: number('pointerActiveDurationMs', 0),
    pointerActiveEventsPerSecond: number('pointerActiveEventsPerSecond', 1),
    pointerActiveSamplesPerSecond: number('pointerActiveSamplesPerSecond', 1),
    pointerPauseGapCount: Math.round(number('pointerPauseGapCount', 0)),
    pointerCommitCount: Math.round(number('pointerCommitCount', 0)),
    pointerCommitsPerSecond: number('pointerCommitsPerSecond', 1),
    pointerCommitIntervalP95Ms: number('pointerCommitIntervalP95Ms', 2),
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
