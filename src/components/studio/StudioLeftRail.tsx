import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FlaskConical,
  History,
  Library,
  Music,
  PenTool,
  Search,
  Settings,
} from 'lucide-react';
import {
  applySoridrawDisplayMode,
  readSoridrawDisplayMode,
  type SoridrawDisplayMode,
} from '../../services/themePreferences';

export type StudioWorkspaceView = 'create' | 'recent' | 'music-note' | 'library';

type StudioLeftRailProps = {
  activeWorkspace: StudioWorkspaceView;
  onCreate: () => void;
  onRecentSongs: () => void;
  onMusicNote: () => void;
  onLibrary: () => void;
  onSearch: () => void;
  onApiSettings: () => void;
  onLab: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onPlan: () => void;
  onBilling: () => void;
  onLogout: () => void | Promise<void>;
  profileName: string;
  profileEmail?: string;
  profilePhotoURL?: string;
};

type MenuPosition = {
  top: number;
  left: number;
};

type RailTooltip = {
  label: string;
  top: number;
  left: number;
};

const PROFILE_MENU_WIDTH = 200;
const PROFILE_MENU_GAP = 8;

export default function StudioLeftRail({
  activeWorkspace,
  onCreate,
  onRecentSongs,
  onMusicNote,
  onLibrary,
  onSearch,
  onApiSettings,
  onLab,
  onProfile,
  onSettings,
  onPlan,
  onBilling,
  onLogout,
  profileName,
  profileEmail = '',
  profilePhotoURL = '',
}: StudioLeftRailProps) {
  const profileInitial = String(profileName || 'S').trim().charAt(0).toUpperCase() || 'S';
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<SoridrawDisplayMode>(() => readSoridrawDisplayMode());
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const [railTooltip, setRailTooltip] = useState<RailTooltip | null>(null);

  const closeProfileMenu = useCallback(() => {
    setIsProfileMenuOpen(false);
    setIsThemeMenuOpen(false);
  }, []);

  const showRailTooltip = useCallback((target: HTMLElement, label: string) => {
    const frame = target.closest('.soridraw-studio-page-frame');
    if (!frame?.classList.contains('is-left-rail-collapsed')) {
      setRailTooltip(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    setRailTooltip({
      label,
      top: Math.round(rect.top + (rect.height / 2)),
      left: Math.round(rect.right + 8),
    });
  }, []);

  const hideRailTooltip = useCallback(() => {
    setRailTooltip(null);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const profileButton = profileButtonRef.current;
    if (!profileButton) return;

    const rect = profileButton.getBoundingClientRect();
    const viewportPadding = 8;
    const preferredLeft = rect.left;
    const left = Math.max(
      viewportPadding,
      Math.min(preferredLeft, window.innerWidth - PROFILE_MENU_WIDTH - viewportPadding),
    );

    setMenuPosition({
      top: Math.round(rect.bottom + PROFILE_MENU_GAP),
      left: Math.round(left),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isProfileMenuOpen) return;
    updateMenuPosition();
  }, [isProfileMenuOpen, updateMenuPosition]);

  useEffect(() => {
    const refreshDisplayMode = () => setDisplayMode(readSoridrawDisplayMode());
    window.addEventListener('soridraw-theme-change', refreshDisplayMode as EventListener);
    window.addEventListener('storage', refreshDisplayMode);
    return () => {
      window.removeEventListener('soridraw-theme-change', refreshDisplayMode as EventListener);
      window.removeEventListener('storage', refreshDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileButtonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeProfileMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeProfileMenu();
    };

    const handleViewportChange = () => closeProfileMenu();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('soridraw-studio-frame-resize', handleViewportChange as EventListener);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('soridraw-studio-frame-resize', handleViewportChange as EventListener);
    };
  }, [closeProfileMenu, isProfileMenuOpen]);

  useEffect(() => {
    if (!railTooltip) return;

    const hideTooltip = () => setRailTooltip(null);
    window.addEventListener('resize', hideTooltip);
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('soridraw-studio-frame-resize', hideTooltip as EventListener);

    return () => {
      window.removeEventListener('resize', hideTooltip);
      window.removeEventListener('scroll', hideTooltip, true);
      window.removeEventListener('soridraw-studio-frame-resize', hideTooltip as EventListener);
    };
  }, [railTooltip]);

  const runMenuAction = (action: () => void) => {
    closeProfileMenu();
    action();
  };

  const selectDisplayMode = (mode: SoridrawDisplayMode) => {
    const appliedMode = applySoridrawDisplayMode(mode);
    setDisplayMode(appliedMode);
    closeProfileMenu();
  };

  const profileMenu = isProfileMenuOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          className="soridraw-studio-profile-menu-portal"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onMouseLeave={() => setIsThemeMenuOpen(false)}
        >
          <div className="soridraw-studio-profile-menu" role="menu" aria-label="개인 메뉴">
            <button type="button" role="menuitem" onClick={() => runMenuAction(onProfile)}>
              <span>내 프로필</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(onSettings)}>
              <span>설정</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(onPlan)}>
              <span>요금제</span>
            </button>
            <button type="button" role="menuitem" onClick={() => runMenuAction(onBilling)}>
              <span>결제 관리</span>
            </button>

            <div className="soridraw-studio-profile-menu-divider" aria-hidden="true" />

            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isThemeMenuOpen}
              className={isThemeMenuOpen ? 'is-submenu-open' : undefined}
              onMouseEnter={() => setIsThemeMenuOpen(true)}
              onClick={() => setIsThemeMenuOpen((current) => !current)}
            >
              <span>테마</span>
              <ChevronRight aria-hidden="true" />
            </button>

            <div className="soridraw-studio-profile-menu-divider" aria-hidden="true" />

            <button type="button" role="menuitem" disabled>
              <span>고객지원 · 준비중</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeProfileMenu();
                void onLogout();
              }}
            >
              <span>로그아웃</span>
            </button>
          </div>

          {isThemeMenuOpen && (
            <div
              className="soridraw-studio-profile-theme-menu"
              role="menu"
              aria-label="테마 선택"
              onMouseEnter={() => setIsThemeMenuOpen(true)}
            >
              {([
                { mode: 'dark' as const, label: '다크' },
                { mode: 'light' as const, label: '라이트' },
                { mode: 'studio-black' as const, label: '분할' },
              ]).map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={displayMode === item.mode}
                  onClick={() => selectDisplayMode(item.mode)}
                >
                  <span>{item.label}</span>
                  {displayMode === item.mode && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  const railTooltipPortal = railTooltip && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="soridraw-studio-rail-tooltip-portal"
          style={{ top: railTooltip.top, left: railTooltip.left }}
          role="tooltip"
        >
          {railTooltip.label}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <aside className="soridraw-studio-left-panel" aria-label="소리스튜디오 작업 메뉴">
        <div className="soridraw-studio-left-panel-inner">
          <button
            ref={profileButtonRef}
            type="button"
            className="soridraw-studio-rail-brand soridraw-studio-rail-profile soridraw-studio-rail-profile-trigger"
            onClick={() => {
              if (!isProfileMenuOpen) updateMenuPosition();
              setIsProfileMenuOpen((current) => !current);
              setIsThemeMenuOpen(false);
            }}
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            aria-label="개인 메뉴 열기"
            onMouseEnter={(event) => showRailTooltip(event.currentTarget, '프로필')}
            onMouseLeave={hideRailTooltip}
            onClickCapture={hideRailTooltip}
          >
            <span className="soridraw-studio-rail-profile-avatar" aria-hidden="true">
              {profilePhotoURL ? (
                <img src={profilePhotoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{profileInitial}</span>
              )}
            </span>
            <span className="soridraw-studio-rail-profile-copy">
              <strong>{profileName || 'SORiDRAW'}</strong>
              <small>{profileEmail || '분할 모드'}</small>
            </span>
            <ChevronDown className="soridraw-studio-rail-profile-chevron" aria-hidden="true" />
          </button>

          <nav className="soridraw-studio-rail-nav" aria-label="스튜디오 내부 이동">
            <p className="soridraw-studio-rail-label">WORKSPACE</p>
            <button
              type="button"
              className={`soridraw-studio-rail-item${activeWorkspace === 'create' ? ' is-active' : ''}`}
              onClick={onCreate}
              aria-current={activeWorkspace === 'create' ? 'page' : undefined}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '곡 만들기')}
              onMouseLeave={hideRailTooltip}
            >
              <PenTool className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>곡 만들기</span>
            </button>
            <button
              type="button"
              className={`soridraw-studio-rail-item${activeWorkspace === 'recent' ? ' is-active' : ''}`}
              onClick={onRecentSongs}
              aria-current={activeWorkspace === 'recent' ? 'page' : undefined}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '최근 생성곡')}
              onMouseLeave={hideRailTooltip}
            >
              <History className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>최근 생성곡</span>
              <ChevronRight className="soridraw-studio-rail-item-chevron ml-auto" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`soridraw-studio-rail-item${activeWorkspace === 'music-note' ? ' is-active' : ''}`}
              onClick={onMusicNote}
              aria-current={activeWorkspace === 'music-note' ? 'page' : undefined}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '뮤직노트')}
              onMouseLeave={hideRailTooltip}
            >
              <Music className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>뮤직노트</span>
              <ChevronRight className="soridraw-studio-rail-item-chevron ml-auto" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`soridraw-studio-rail-item${activeWorkspace === 'library' ? ' is-active' : ''}`}
              onClick={onLibrary}
              aria-current={activeWorkspace === 'library' ? 'page' : undefined}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '라이브러리')}
              onMouseLeave={hideRailTooltip}
            >
              <Library className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>라이브러리</span>
              <ChevronRight className="soridraw-studio-rail-item-chevron ml-auto" aria-hidden="true" />
            </button>

            <div className="soridraw-studio-rail-divider" />
            <p className="soridraw-studio-rail-label">TOOLS</p>
            <button
              type="button"
              className="soridraw-studio-rail-item"
              onClick={onSearch}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '통합 검색')}
              onMouseLeave={hideRailTooltip}
            >
              <Search className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>통합 검색</span>
            </button>
            <button
              type="button"
              className="soridraw-studio-rail-item"
              onClick={onApiSettings}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, 'API 설정')}
              onMouseLeave={hideRailTooltip}
            >
              <Settings className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>API 설정</span>
            </button>
          </nav>

          <div className="soridraw-studio-rail-bottom-actions" aria-label="추가 메뉴">
            <button
              type="button"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              onClick={onLab}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, 'Labs')}
              onMouseLeave={hideRailTooltip}
            >
              <FlaskConical className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>Labs</span>
            </button>
            <button
              type="button"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              aria-label="알림"
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '알림')}
              onMouseLeave={hideRailTooltip}
            >
              <Bell className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>알림</span>
            </button>
            <button
              type="button"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              aria-label="기타 메뉴"
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '더보기')}
              onMouseLeave={hideRailTooltip}
            >
              <Ellipsis className="soridraw-studio-rail-primary-icon" aria-hidden="true" />
              <span>더보기</span>
            </button>
          </div>

        </div>
      </aside>
      {profileMenu}
      {railTooltipPortal}
    </>
  );
}
