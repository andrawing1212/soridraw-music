export type SplitPerfApplySample = {
  totalMs: number;
  layoutWriteMs: number;
  responsiveMs: number;
  externalMs: number;
  miscMs: number;
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
  heapMb: number | null;
  createdAt: number;
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
  domNodes: number;
  builderNodes: number;
  resultNodes: number;
  rafId: number | null;
};

type Listener = (result: SplitPerfResult | null) => void;

let enabled = true; // 571 is a temporary diagnostic build. Collection only runs while dragging.
let active: ActiveDrag | null = null;
let lastResult: SplitPerfResult | null = null;
const listeners = new Set<Listener>();
let longTaskObserver: PerformanceObserver | null = null;

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

const ensureLongTaskObserver = () => {
  if (longTaskObserver || typeof PerformanceObserver === 'undefined') return;
  try {
    const supported = Array.isArray(PerformanceObserver.supportedEntryTypes)
      && PerformanceObserver.supportedEntryTypes.includes('longtask');
    if (!supported) return;
    longTaskObserver = new PerformanceObserver((list) => {
      if (!active) return;
      for (const entry of list.getEntries()) active.longTasks.push(entry.duration);
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch {
    longTaskObserver = null;
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
}: {
  workspaceView?: string;
  engine: string;
  builder: HTMLElement | null;
  result: HTMLElement | null;
}) => {
  if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return;
  if (active?.rafId !== null && active?.rafId !== undefined) window.cancelAnimationFrame(active.rafId);
  ensureLongTaskObserver();
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
    // Count once before dragging so diagnostics do not add DOM traversal inside the hot path.
    domNodes: document.getElementsByTagName('*').length,
    builderNodes: builder ? builder.getElementsByTagName('*').length : 0,
    resultNodes: result ? result.getElementsByTagName('*').length : 0,
    rafId: null,
  };
  runRafProbe();
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
    heapMb: heapMb === null ? null : round(heapMb, 1),
    createdAt: Date.now(),
  };

  active = null;
  notify();
  try {
    console.groupCollapsed('[SORIDRAW Split PERF]', lastResult.host, lastResult.workspaceView);
    console.table(lastResult);
    console.groupEnd();
  } catch {
    // Console output is optional.
  }
};

export const subscribeSplitPerfResult = (listener: Listener) => {
  listeners.add(listener);
  listener(lastResult);
  return () => { listeners.delete(listener); };
};

export const getLastSplitPerfResult = () => lastResult;
