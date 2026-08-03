import React from 'react';
import { Activity, ChevronRight, Music, Sparkles, X } from 'lucide-react';

type RecentSong = any;

type SelectedKeywordType = 'genre' | 'mood' | 'theme' | 'style' | 'sound' | 'point-sound' | 'mix' | 'rap';

type SelectedKeyword = {
  id: string;
  type: SelectedKeywordType;
  label: string;
};

type StudioRightRailProps = {
  isGenerating: boolean;
  runningCount: number;
  queuedCount: number;
  history: RecentSong[];
  selectedIndex: number;
  remainingCredits: number | null;
  creditsUpdatedAt?: unknown;
  selectedKeywords: SelectedKeyword[];
  onRemoveSelectedKeyword: (keyword: SelectedKeyword) => void;
  formatTime: (value?: unknown) => string;
  onOpenGenerationOptions: () => void;
  onOpenAllSongs: () => void;
  onOpenSong: (song: RecentSong, index: number) => void;
  onOpenApiSettings: () => void;
};

export default function StudioRightRail({
  isGenerating,
  runningCount,
  queuedCount,
  history,
  selectedIndex,
  remainingCredits,
  creditsUpdatedAt,
  selectedKeywords,
  onRemoveSelectedKeyword,
  formatTime,
  onOpenGenerationOptions,
  onOpenAllSongs,
  onOpenSong,
  onOpenApiSettings,
}: StudioRightRailProps) {
  return (
    <aside className="soridraw-studio-dashboard-panel" aria-label="소리스튜디오 보조 대시보드">
      <div className="soridraw-studio-dashboard-inner">
        <section className="soridraw-studio-dashboard-card soridraw-studio-dashboard-status">
          <div className="soridraw-studio-dashboard-heading">
            <div><p>GENERATION</p><h2>생성 상태</h2></div>
            <span className={`soridraw-studio-dashboard-live-dot ${(isGenerating || runningCount > 0) ? 'is-running' : ''}`} />
          </div>
          <div className="soridraw-studio-dashboard-state">
            <strong>{runningCount > 0 ? `${runningCount}곡 생성 중` : queuedCount > 0 ? '대기 작업 있음' : '생성 준비 완료'}</strong>
            <small>{runningCount > 0 ? '완료되면 최근 생성곡에 자동 반영됩니다.' : queuedCount > 0 ? `${queuedCount}건이 순서대로 시작됩니다.` : '설정을 고른 뒤 생성하기를 눌러주세요.'}</small>
          </div>
          <div className="soridraw-studio-dashboard-metrics">
            <span><small>진행</small><strong>{runningCount}</strong></span>
            <span><small>대기</small><strong>{queuedCount}</strong></span>
            <span><small>최근곡</small><strong>{history.length}</strong></span>
          </div>
          <button type="button" className="soridraw-studio-dashboard-primary" onClick={onOpenGenerationOptions}>
            <Sparkles className="h-4 w-4" /> 생성 옵션 열기
          </button>
        </section>

        <section className="soridraw-studio-dashboard-card">
          <div className="soridraw-studio-dashboard-heading">
            <div><p>RECENT SONGS</p><h2>최근 생성곡</h2></div>
            <button type="button" className="soridraw-studio-dashboard-text-button" onClick={onOpenAllSongs}>전체</button>
          </div>
          <div className="soridraw-studio-dashboard-song-list">
            {history.length > 0 ? history.slice(0, 3).map((song, index) => (
              <button
                key={`studio-dashboard-song-${String(song.createdAt || index)}-${song.title || ''}`}
                type="button"
                className={`soridraw-studio-dashboard-song ${selectedIndex === index ? 'is-selected' : ''}`}
                onClick={() => onOpenSong(song, index)}
              >
                <span className="soridraw-studio-dashboard-song-icon"><Music className="h-4 w-4" /></span>
                <span className="soridraw-studio-dashboard-song-copy">
                  <strong>{song.title || song.koreanTitle || song.englishTitle || `생성곡 ${index + 1}`}</strong>
                  <small>{formatTime(song.updatedAt || song.createdAt)}</small>
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )) : (
              <div className="soridraw-studio-dashboard-empty"><Music className="h-5 w-5" /><span>아직 생성된 곡이 없습니다.</span></div>
            )}
          </div>
        </section>

        <section className="soridraw-studio-dashboard-card soridraw-studio-dashboard-credit">
          <div className="soridraw-studio-dashboard-heading compact">
            <div><p>MUSIC API</p><h2>남은 크레딧</h2></div>
            <Activity className="h-5 w-5" />
          </div>
          <div className="soridraw-studio-dashboard-credit-value">
            <strong>{remainingCredits === null ? '—' : remainingCredits.toLocaleString()}</strong><span>credits</span>
          </div>
          <div className="soridraw-studio-dashboard-credit-footer">
            <small>{formatTime(creditsUpdatedAt)}</small><button type="button" onClick={onOpenApiSettings}>설정</button>
          </div>
        </section>

        <section className="soridraw-studio-dashboard-card soridraw-studio-dashboard-keywords-card">
          <div className="soridraw-studio-dashboard-heading compact">
            <div><p>SELECTED KEYWORDS</p><h2>선택된 키워드</h2></div>
            <span className="soridraw-studio-dashboard-keyword-count">{selectedKeywords.length}</span>
          </div>
          <div className="soridraw-studio-dashboard-keyword-list" role="list" aria-label="현재 선택된 키워드">
            {selectedKeywords.length > 0 ? selectedKeywords.map((keyword) => (
              <span
                key={`studio-right-keyword-${keyword.type}-${keyword.id}`}
                className={`soridraw-studio-dashboard-keyword is-${keyword.type}`}
                role="listitem"
              >
                <span className="soridraw-studio-dashboard-keyword-label">{keyword.label}</span>
                <button
                  type="button"
                  className="soridraw-studio-dashboard-keyword-remove"
                  onClick={() => onRemoveSelectedKeyword(keyword)}
                  aria-label={`${keyword.label} 선택 해제`}
                  title={`${keyword.label} 선택 해제`}
                >
                  <X aria-hidden="true" />
                </button>
              </span>
            )) : (
              <div className="soridraw-studio-dashboard-empty compact">
                <span>선택된 키워드가 없습니다.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
