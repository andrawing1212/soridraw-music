import React from 'react';
import { Activity, ChevronRight, Heart, Music, Sparkles, X } from 'lucide-react';

type RecentSong = any;

type SelectedKeywordType = 'genre' | 'mood' | 'theme' | 'style' | 'sound' | 'point-sound' | 'mix' | 'rap';

type SelectedKeyword = {
  id: string;
  type: SelectedKeywordType;
  label: string;
};

type RecentSongScrollableCopyProps = {
  title: string;
  time: string;
};

function RecentSongScrollableCopy({ title, time }: RecentSongScrollableCopyProps) {
  const scrollRef = React.useRef<HTMLSpanElement>(null);
  const resetTimerRef = React.useRef<number | null>(null);
  const dragRef = React.useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const [isDragging, setIsDragging] = React.useState(false);

  const clearResetTimer = React.useCallback(() => {
    if (resetTimerRef.current === null) return;
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  const scheduleReturnToStart = React.useCallback(() => {
    clearResetTimer();

    const target = scrollRef.current;
    if (!target || target.scrollLeft <= 0) return;

    resetTimerRef.current = window.setTimeout(() => {
      const currentTarget = scrollRef.current;
      resetTimerRef.current = null;
      if (!currentTarget || currentTarget.scrollLeft <= 0) return;

      currentTarget.scrollTo({ left: 0, behavior: 'smooth' });
    }, 7000);
  }, [clearResetTimer]);

  React.useEffect(() => {
    const target = scrollRef.current;
    clearResetTimer();
    if (target) target.scrollLeft = 0;

    return clearResetTimer;
  }, [title, time, clearResetTimer]);

  const handlePointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;

    const target = scrollRef.current;
    if (!target || target.scrollWidth <= target.clientWidth) return;

    clearResetTimer();

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: target.scrollLeft,
      moved: false,
    };
    target.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const target = scrollRef.current;
    const drag = dragRef.current;
    if (!target || drag.pointerId !== event.pointerId) return;

    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 3) drag.moved = true;
    target.scrollLeft = drag.startScrollLeft - distance;

    if (drag.moved) event.preventDefault();
  };

  const finishPointerDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    const target = scrollRef.current;
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    drag.pointerId = -1;
    setIsDragging(false);
    scheduleReturnToStart();
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!dragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current.moved = false;
  };

  const handleWheel = (event: React.WheelEvent<HTMLSpanElement>) => {
    const target = scrollRef.current;
    if (!target || target.scrollWidth <= target.clientWidth) return;

    const railScroller = target.closest('.soridraw-studio-dashboard-inner') as HTMLElement | null;
    const isVerticalIntent = !event.shiftKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX);

    if (isVerticalIntent && railScroller) {
      const maxScrollTop = Math.max(0, railScroller.scrollHeight - railScroller.clientHeight);
      const canScrollRail = event.deltaY > 0
        ? railScroller.scrollTop < maxScrollTop - 1
        : railScroller.scrollTop > 1;

      if (canScrollRail) {
        railScroller.scrollTop = Math.max(0, Math.min(maxScrollTop, railScroller.scrollTop + event.deltaY));
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const delta = event.shiftKey
      ? event.deltaY
      : Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (delta === 0) return;

    target.scrollLeft += delta;
    scheduleReturnToStart();
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <span
      ref={scrollRef}
      className={`soridraw-studio-dashboard-song-copy ${isDragging ? 'is-dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
      onClickCapture={handleClickCapture}
      onWheel={handleWheel}
    >
      <strong>{title}</strong>
      <small>{time}</small>
    </span>
  );
}

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
  formatSongTitle: (song: RecentSong) => string;
  onOpenGenerationOptions: () => void;
  onOpenSong: (song: RecentSong, index: number) => void;
  isSongUnread: (song: RecentSong) => boolean;
  isSongFavorited: (song: RecentSong) => boolean;
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
  formatSongTitle,
  onOpenGenerationOptions,
  onOpenSong,
  isSongUnread,
  isSongFavorited,
  onOpenApiSettings,
}: StudioRightRailProps) {
  const [showAllRecentSongs, setShowAllRecentSongs] = React.useState(false);
  const visibleRecentSongs = showAllRecentSongs ? history : history.slice(0, 3);

  return (
    <aside
      className={`soridraw-studio-dashboard-panel${showAllRecentSongs ? ' is-recent-expanded' : ''}`}
      aria-label="소리스튜디오 보조 대시보드"
    >
      <div className="soridraw-studio-dashboard-inner">
        <section className="soridraw-studio-dashboard-card soridraw-studio-dashboard-status">
          <div className="soridraw-studio-dashboard-heading">
            <div><p>GENERATION</p><h2>생성 상태</h2></div>
            <div
              className="soridraw-studio-dashboard-status-indicators"
              aria-label={(isGenerating || runningCount > 0) ? `${Math.max(1, runningCount)}곡 생성 중` : '생성 대기'}
            >
              <span className={`soridraw-studio-dashboard-live-dot ${(isGenerating || runningCount > 0) ? 'is-running' : ''}`} />
              {(isGenerating || runningCount > 0) && (
                <span className="soridraw-studio-dashboard-running-spinner" aria-hidden="true" />
              )}
            </div>
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
            <button
              type="button"
              className="soridraw-studio-dashboard-text-button"
              onClick={() => setShowAllRecentSongs((current) => !current)}
              aria-expanded={showAllRecentSongs}
              aria-controls="soridraw-studio-recent-song-list"
            >
              {showAllRecentSongs ? '접기' : '전체'}
            </button>
          </div>
          <div id="soridraw-studio-recent-song-list" className="soridraw-studio-dashboard-song-list">
            {history.length > 0 ? visibleRecentSongs.map((song, index) => {
              const isUnread = isSongUnread(song);
              const isFavorited = isSongFavorited(song);
              return (
                <button
                  key={`studio-dashboard-song-${String(song.createdAt || index)}-${song.title || ''}`}
                  type="button"
                  className={`soridraw-studio-dashboard-song ${selectedIndex === index ? 'is-selected' : ''}`}
                  onClick={() => onOpenSong(song, index)}
                >
                  <span className={`soridraw-studio-dashboard-song-icon ${isUnread ? 'is-unread' : isFavorited ? 'is-favorite' : ''}`}>
                    {isUnread ? (
                      <span className="soridraw-studio-dashboard-song-unread-dot" aria-label="확인하지 않은 새 생성곡" />
                    ) : isFavorited ? (
                      <Heart className="h-4 w-4" aria-label="즐겨찾기 곡" />
                    ) : (
                      <Music className="h-4 w-4" />
                    )}
                  </span>
                  <RecentSongScrollableCopy
                    title={formatSongTitle(song) || `생성곡 ${index + 1}`}
                    time={formatTime(song.updatedAt || song.createdAt)}
                  />
                  <ChevronRight className="h-4 w-4" />
                </button>
              );
            }) : (
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
