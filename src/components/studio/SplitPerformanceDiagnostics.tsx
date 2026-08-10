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

type PerfProbeProfileId = 'baseline' | 'effects-off' | 'media-off' | 'list-paint-off' | 'container-off';
type PerfProbeRow = {
  id: PerfProbeProfileId;
  label: string;
  summary: SplitPerfBenchmarkSummary;
  fps: number;
  p95: number;
  renderPerSecond: number;
};

const PERF_PROBE_PROFILES: Array<{ id: PerfProbeProfileId; label: string }> = [
  { id: 'baseline', label: '기준' },
  { id: 'effects-off', label: '효과 OFF' },
  { id: 'media-off', label: '이미지 OFF' },
  { id: 'list-paint-off', label: '리스트 Paint OFF' },
  { id: 'container-off', label: 'Container Query OFF' },
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

export default function SplitPerformanceDiagnostics({ isAdmin = false }: { isAdmin?: boolean }) {
  const [visible, setVisible] = useState(readSplitPerfToolVisibility());
  const [enabled, setEnabled] = useState(isSplitPerfDiagnosticsEnabled());
  const [result, setResult] = useState<SplitPerfResult | null>(getLastSplitPerfResult());
  const [benchmarkSummary, setBenchmarkSummary] = useState<SplitPerfBenchmarkSummary | null>(getLastSplitPerfBenchmarkSummary());
  const [collapsed, setCollapsed] = useState(false);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkMessage, setBenchmarkMessage] = useState('');
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeRows, setProbeRows] = useState<PerfProbeRow[]>([]);

  const probeRunningRef = useRef(false);
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

    const profile = PERF_PROBE_PROFILES[probeIndexRef.current];
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
    if (nextIndex >= PERF_PROBE_PROFILES.length) {
      stopProbe(true);
      setBenchmarkMessage('병목 스캔 완료 · 기준 대비 렌더 비용 감소폭이 큰 항목을 우선 확인하세요.');
      return;
    }

    probeIndexRef.current = nextIndex;
    const nextProfile = PERF_PROBE_PROFILES[nextIndex];
    setPerfProbeProfile(nextProfile.id);
    setBenchmarkMessage(`병목 스캔 ${nextIndex + 1}/${PERF_PROBE_PROFILES.length} · ${nextProfile.label}`);
    probeStartTimerRef.current = window.setTimeout(() => {
      probeStartTimerRef.current = null;
      if (!probeRunningRef.current) return;
      window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
    }, 420);
  }, [benchmarkSummary]);

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

  const runProbeScan = () => {
    if (!ensureBenchmarkReady()) return;
    if (benchmarkRunning || probeRunningRef.current) return;
    probeRowsRef.current = [];
    probeBaselineRef.current = null;
    probeIndexRef.current = 0;
    probeHandledSummaryAtRef.current = 0;
    setProbeRows([]);
    probeRunningRef.current = true;
    setProbeRunning(true);
    setPerfProbeProfile(PERF_PROBE_PROFILES[0].id);
    setBenchmarkMessage(`병목 스캔 1/${PERF_PROBE_PROFILES.length} · ${PERF_PROBE_PROFILES[0].label} · 약 1분`);
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
  };

  if (!isAdmin || !visible) return null;

  return (
    <aside className={`soridraw-split-perf-panel${collapsed ? ' is-collapsed' : ''}`} aria-label="분할 성능 진단">
      <div className="soridraw-split-perf-head">
        <button type="button" onClick={toggleEnabled} className={enabled ? 'is-on' : ''}>
          PERF {enabled ? 'ON' : 'OFF'}
        </button>
        <strong>{probeRunning ? '병목 스캔 중' : verdict}</strong>
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
            <button type="button" className="is-secondary" onClick={runProbeScan} disabled={benchmarkRunning || probeRunning || !enabled}>
              {probeRunning ? '병목 스캔 중…' : '병목 스캔'}
            </button>
            <span>자동: 3세트 중앙값 · 스캔: 기준/효과/이미지/리스트 Paint/Container Query</span>
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
                  {probeRows.length > 0 && (
                    <details open>
                      <summary>병목 A/B — 기준 대비 렌더 비용</summary>
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
              <p className="soridraw-split-perf-note is-compact">583: 일반 자동 테스트는 동일 DOM 3세트 중앙값을 유지합니다. 병목 스캔은 진단 중에만 시각 요소를 하나씩 임시 제외해 렌더 비용 차이를 비교하며, 완료 즉시 원래 디자인으로 복구합니다.</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
