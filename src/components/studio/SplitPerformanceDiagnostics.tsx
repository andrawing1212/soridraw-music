import React, { useEffect, useMemo, useState } from 'react';
import {
  getLastSplitPerfResult,
  isSplitPerfDiagnosticsEnabled,
  setSplitPerfDiagnosticsEnabled,
  subscribeSplitPerfResult,
  type SplitPerfResult,
} from './splitPerfDiagnostics';

const format = (value: number | null, suffix = '') => value === null ? '-' : `${value}${suffix}`;

export default function SplitPerformanceDiagnostics() {
  const [enabled, setEnabled] = useState(isSplitPerfDiagnosticsEnabled());
  const [result, setResult] = useState<SplitPerfResult | null>(getLastSplitPerfResult());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => subscribeSplitPerfResult(setResult), []);

  const verdict = useMemo(() => {
    if (!result) return '분할바를 3~5초 왕복하세요';
    if (result.estimatedFps >= 55 && result.p95FrameMs <= 20) return '매우 양호';
    if (result.estimatedFps >= 45 && result.p95FrameMs <= 28) return '양호';
    if (result.longTaskCount > 0 || result.p95FrameMs >= 34) return '병목 있음';
    return '추가 최적화 필요';
  }, [result]);

  const toggleEnabled = () => {
    const next = !enabled;
    setSplitPerfDiagnosticsEnabled(next);
    setEnabled(next);
  };

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
          {!result ? (
            <p>같은 화면·같은 창 크기로 분할바를 빠르게 3~5초 왕복하면 결과가 표시됩니다.</p>
          ) : (
            <>
              <div className="soridraw-split-perf-source">
                <span>{result.host}</span>
                <span>{result.workspaceView}</span>
                <span>{result.viewport} · DPR {result.dpr}</span>
              </div>
              <div className="soridraw-split-perf-grid">
                <span>추정 FPS</span><b>{result.estimatedFps}</b>
                <span>평균 프레임</span><b>{result.avgFrameMs}ms</b>
                <span>P95 / 최악</span><b>{result.p95FrameMs} / {result.maxFrameMs}ms</b>
                <span>&gt;20 / &gt;34 / &gt;50ms</span><b>{result.over20ms} / {result.over34ms} / {result.over50ms}</b>
                <span>Long Task</span><b>{result.longTaskCount}회 · {result.longTaskTotalMs}ms</b>
                <span>LoAF</span><b>{result.loafSupported ? `${result.loafCount}회 · ${result.loafTotalMs}ms` : '미지원'}</b>
                <span>LoAF blocking</span><b>{result.loafSupported ? `${result.loafBlockingTotalMs}ms` : '-'}</b>
                <span>강제 Style/Layout</span><b>{result.loafSupported ? `${result.forcedStyleLayoutTotalMs} / max ${result.forcedStyleLayoutMaxMs}ms` : '-'}</b>
                <span>느린 입력 이벤트</span><b>{result.eventTimingSupported ? `${result.slowEventCount}회 · max ${result.slowEventMaxMs}ms` : '미지원'}</b>
                <span>입력 지연 평균/최대</span><b>{result.eventTimingSupported ? `${result.inputDelayAvgMs}/${result.inputDelayMaxMs}ms` : '-'}</b>
                <span>JS flush 평균/최대</span><b>{result.flushAvgMs}/{result.flushMaxMs}ms</b>
                <span>실제 폭 반영 / 선만</span><b>{result.contentCommitCount} / {result.dividerOnlyCount}</b>
                <span>apply 평균/최대</span><b>{result.applyAvgMs}/{result.applyMaxMs}ms</b>
                <span>DOM 전체</span><b>{result.domNodes.toLocaleString()}</b>
                <span>좌/우 DOM</span><b>{result.builderNodes.toLocaleString()} / {result.resultNodes.toLocaleString()}</b>
                <span>JS Heap</span><b>{format(result.heapMb, 'MB')}</b>
              </div>

              <details open>
                <summary>병목 TOP — 누가 시간을 쓰는지</summary>
                {result.loafSupported ? (
                  result.hotspots.length ? (
                    <div className="soridraw-split-perf-hotspots">
                      {result.hotspots.map((item, index) => (
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
                  <span>폭/분할선 write</span><b>{result.layoutWriteAvgMs}ms</b>
                  <span>반응형 판정</span><b>{result.responsiveAvgMs}ms</b>
                  <span>외부 UI 동기화</span><b>{result.externalAvgMs}ms</b>
                  <span>dataset/ARIA</span><b>{result.miscAvgMs}ms</b>
                </div>
              </details>
              <p className="soridraw-split-perf-note">576: 573 실시간 경계를 유지한 채 React DOM 교체/전체 카드 스캔 없이 Music Note/Library의 leaf 카드만 브라우저 native isolation으로 분리했습니다. 같은 동작 후 PERF와 체감을 비교하세요.</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
