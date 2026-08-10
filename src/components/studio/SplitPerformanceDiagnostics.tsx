import React, { useEffect, useMemo, useState } from 'react';
import {
  getLastSplitPerfBenchmarkSummary,
  getLastSplitPerfResult,
  isSplitPerfDiagnosticsEnabled,
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

export default function SplitPerformanceDiagnostics({ isAdmin = false }: { isAdmin?: boolean }) {
  const [visible, setVisible] = useState(readSplitPerfToolVisibility());
  const [enabled, setEnabled] = useState(isSplitPerfDiagnosticsEnabled());
  const [result, setResult] = useState<SplitPerfResult | null>(getLastSplitPerfResult());
  const [benchmarkSummary, setBenchmarkSummary] = useState<SplitPerfBenchmarkSummary | null>(getLastSplitPerfBenchmarkSummary());
  const [collapsed, setCollapsed] = useState(false);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkMessage, setBenchmarkMessage] = useState('');

  useEffect(() => subscribeSplitPerfResult(setResult), []);
  useEffect(() => subscribeSplitPerfBenchmarkSummary(setBenchmarkSummary), []);

  useEffect(() => {
    const handleVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      const next = typeof detail?.enabled === 'boolean' ? detail.enabled : readSplitPerfToolVisibility();
      setVisible(next);
      if (!next) {
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
      if (detail?.message) setBenchmarkMessage(detail.message);
    };
    window.addEventListener(SPLIT_PERF_BENCHMARK_STATUS_EVENT, handleBenchmarkStatus as EventListener);
    return () => window.removeEventListener(SPLIT_PERF_BENCHMARK_STATUS_EVENT, handleBenchmarkStatus as EventListener);
  }, []);

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

  const toggleEnabled = () => {
    const next = !enabled;
    setSplitPerfDiagnosticsEnabled(next);
    setEnabled(next);
  };

  const runBenchmark = () => {
    if (!enabled) {
      setSplitPerfDiagnosticsEnabled(true);
      setEnabled(true);
    }
    if (window.location.pathname !== '/studio') {
      setBenchmarkMessage('스튜디오의 분할 화면에서 자동 테스트를 실행하세요.');
      return;
    }
    setBenchmarkRunning(true);
    setBenchmarkMessage('워밍업 후 같은 조건을 3세트 측정해 중앙값으로 판정합니다.');
    window.dispatchEvent(new CustomEvent(SPLIT_PERF_BENCHMARK_REQUEST_EVENT));
  };

  if (!isAdmin || !visible) return null;

  return (
    <aside className={`soridraw-split-perf-panel${collapsed ? ' is-collapsed' : ''}`} aria-label="분할 성능 진단">
      <div className="soridraw-split-perf-head">
        <button type="button" onClick={toggleEnabled} className={enabled ? 'is-on' : ''}>
          PERF {enabled ? 'ON' : 'OFF'}
        </button>
        <strong>{verdict}</strong>
        <button type="button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? '진단 펼치기' : '진단 접기'}>
          {collapsed ? '＋' : '－'}
        </button>
      </div>
      {!collapsed && (
        <div className="soridraw-split-perf-body">
          <div className="soridraw-split-perf-benchmark-row">
            <button type="button" onClick={runBenchmark} disabled={benchmarkRunning || !enabled}>
              {benchmarkRunning ? '자동 테스트 중…' : '자동 테스트'}
            </button>
            <span>32% ↔ 68% · 워밍업 1회 · 3세트 중앙값</span>
          </div>
          {benchmarkMessage && <p className="soridraw-split-perf-benchmark-message">{benchmarkMessage}</p>}
          {!displayResult ? (
            <p>자동 테스트를 누르면 사람 손 오차 없이 같은 거리와 같은 시간으로 분할 성능을 측정합니다.</p>
          ) : (
            <>
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
              <div className="soridraw-split-perf-grid">
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
                <p className="soridraw-split-perf-note">브라우저 LoAF API는 비JS 렌더 시간을 DOM 하위영역별로 직접 귀속하지 못하므로, 581은 영역별 DOM 규모와 JS/LoAF 병목을 함께 보여줘 다음 격리 대상을 고릅니다.</p>
              </details>

              <details open>
                <summary>병목 TOP — 누가 시간을 쓰는지</summary>
                {displayResult.loafSupported ? (
                  displayResult.hotspots.length ? (
                    <div className="soridraw-split-perf-hotspots">
                      {displayResult.hotspots.map((item, index) => (
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

              <details>
                <summary>Lite V2 내부 단계 시간</summary>
                <div className="soridraw-split-perf-grid is-detail">
                  <span>폭/분할선 write</span><b>{displayResult.layoutWriteAvgMs}ms</b>
                  <span>반응형 판정</span><b>{displayResult.responsiveAvgMs}ms</b>
                  <span>외부 UI 동기화</span><b>{displayResult.externalAvgMs}ms</b>
                  <span>dataset/ARIA</span><b>{displayResult.miscAvgMs}ms</b>
                </div>
              </details>
              <p className="soridraw-split-perf-note">581: 자동 벤치마크는 워밍업 후 동일한 2왕복 측정을 3세트 실행하고 중앙값으로 판정합니다. 영역별 DOM 규모도 함께 기록해 Music Note/Library의 다음 격리 대상을 비교합니다.</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
