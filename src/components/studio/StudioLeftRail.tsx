import React from 'react';
import {
  ChevronRight,
  History,
  Library,
  Music,
  Palette,
  PenTool,
  Search,
  Settings,
} from 'lucide-react';

type StudioLeftRailProps = {
  onCreate: () => void;
  onRecentSongs: () => void;
  onMusicNote: () => void;
  onLibrary: () => void;
  onSearch: () => void;
  onApiSettings: () => void;
  onThemeSettings: () => void;
};

export default function StudioLeftRail({
  onCreate,
  onRecentSongs,
  onMusicNote,
  onLibrary,
  onSearch,
  onApiSettings,
  onThemeSettings,
}: StudioLeftRailProps) {
  return (
    <aside className="soridraw-studio-left-panel" aria-label="소리스튜디오 작업 메뉴">
      <div className="soridraw-studio-left-panel-inner">
        <div className="soridraw-studio-rail-brand">
          <span className="soridraw-studio-rail-brand-mark">SD</span>
          <span><strong>Sori Studio</strong><small>Studio Black</small></span>
        </div>

        <nav className="soridraw-studio-rail-nav" aria-label="스튜디오 내부 이동">
          <p className="soridraw-studio-rail-label">WORKSPACE</p>
          <button type="button" className="soridraw-studio-rail-item is-active" onClick={onCreate}>
            <PenTool className="h-5 w-5" />
            <span>곡 만들기</span>
          </button>
          <button type="button" className="soridraw-studio-rail-item" onClick={onRecentSongs}>
            <History className="h-5 w-5" />
            <span>최근 생성곡</span>
            <ChevronRight className="ml-auto h-4 w-4" />
          </button>
          <button type="button" className="soridraw-studio-rail-item" onClick={onMusicNote}>
            <Music className="h-5 w-5" />
            <span>뮤직노트</span>
            <ChevronRight className="ml-auto h-4 w-4" />
          </button>
          <button type="button" className="soridraw-studio-rail-item" onClick={onLibrary}>
            <Library className="h-5 w-5" />
            <span>라이브러리</span>
            <ChevronRight className="ml-auto h-4 w-4" />
          </button>

          <div className="soridraw-studio-rail-divider" />
          <p className="soridraw-studio-rail-label">TOOLS</p>
          <button type="button" className="soridraw-studio-rail-item" onClick={onSearch}>
            <Search className="h-5 w-5" />
            <span>통합 검색</span>
          </button>
          <button type="button" className="soridraw-studio-rail-item" onClick={onApiSettings}>
            <Settings className="h-5 w-5" />
            <span>API 설정</span>
          </button>
        </nav>

        <button type="button" className="soridraw-studio-rail-theme" onClick={onThemeSettings}>
          <Palette className="h-5 w-5" />
          <span><strong>디자인 테마</strong><small>Classic / Studio Black</small></span>
          <ChevronRight className="ml-auto h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
