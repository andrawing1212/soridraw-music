import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
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
  User,
  Compass,
  LogOut,
} from 'lucide-react';
import { SORIDRAW_PROFILE_AVATAR_EVENT } from '../../services/profileAvatarAuthority';

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
  onPublicProfile: () => void;
  onSettings: () => void;
  onAdmin?: () => void;
  showAdmin?: boolean;
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

const PROFILE_MENU_WIDTH = 224;
const PROFILE_MENU_GAP = 8;

// SORIDRAW_NAV_PERMISSION_RAIL_953
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
  onPublicProfile,
  onSettings,
  onLogout,
  profileName,
  profileEmail = '',
  profilePhotoURL = '',
}: StudioLeftRailProps) {
  const profileInitial = String(profileName || 'S').trim().charAt(0).toUpperCase() || 'S';
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const [railTooltip, setRailTooltip] = useState<RailTooltip | null>(null);
  const [effectiveProfilePhotoURL, setEffectiveProfilePhotoURL] = useState(profilePhotoURL);

  useEffect(() => {
    setEffectiveProfilePhotoURL(profilePhotoURL);
  }, [profilePhotoURL]);

  useEffect(() => {
    const handleAvatarAuthority = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      setEffectiveProfilePhotoURL(String(detail?.url || ''));
    };
    window.addEventListener(SORIDRAW_PROFILE_AVATAR_EVENT, handleAvatarAuthority as EventListener);
    return () => window.removeEventListener(SORIDRAW_PROFILE_AVATAR_EVENT, handleAvatarAuthority as EventListener);
  }, []);

  const closeProfileMenu = useCallback(() => {
    setIsProfileMenuOpen(false);
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
    const preferredLeft = rect.right + PROFILE_MENU_GAP;
    const left = Math.max(
      viewportPadding,
      Math.min(preferredLeft, window.innerWidth - PROFILE_MENU_WIDTH - viewportPadding),
    );
    const menuHeight = menuRef.current?.getBoundingClientRect().height || 0;
    const maxTop = Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding);
    const top = Math.max(viewportPadding, Math.min(rect.top, maxTop));

    setMenuPosition({
      top: Math.round(top),
      left: Math.round(left),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isProfileMenuOpen) return;
    updateMenuPosition();
  }, [isProfileMenuOpen, updateMenuPosition]);

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

  const profileMenu = isProfileMenuOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          className="soridraw-studio-profile-menu-portal"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="soridraw-studio-profile-menu soridraw-account-menu-surface" role="menu" aria-label="개인 메뉴">
            <div className="soridraw-account-menu-header">
              <p className="soridraw-account-menu-kicker">계정 메뉴</p>
              <p className="soridraw-account-menu-name">{profileName || 'SORiDRAW'}</p>
              {profileEmail && <p className="soridraw-account-menu-email">{profileEmail}</p>}
            </div>

            <button type="button" role="menuitem" data-soridraw-menu-access="my-page" className="soridraw-account-menu-row" onClick={() => runMenuAction(onProfile)}>
              <User aria-hidden="true" />
              <span>MY 페이지</span>
            </button>
            <button type="button" role="menuitem" data-soridraw-menu-access="explore" className="soridraw-account-menu-row" onClick={() => runMenuAction(onPublicProfile)}>
              <Compass aria-hidden="true" />
              <span>MY 프로필</span>
            </button>
            <button type="button" role="menuitem" data-soridraw-menu-access="my-page" className="soridraw-account-menu-row" onClick={() => runMenuAction(onSettings)}>
              <Settings aria-hidden="true" />
              <span>설정</span>
            </button>

            <div className="soridraw-studio-profile-menu-divider soridraw-account-menu-divider" aria-hidden="true" />
            <button
              type="button"
              role="menuitem"
              className="soridraw-account-menu-row soridraw-account-menu-logout"
              onClick={() => {
                closeProfileMenu();
                void onLogout();
              }}
            >
              <LogOut aria-hidden="true" />
              <span>로그아웃</span>
            </button>
          </div>

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
            }}
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            aria-label="개인 메뉴 열기"
            onMouseEnter={(event) => showRailTooltip(event.currentTarget, '프로필')}
            onMouseLeave={hideRailTooltip}
            onClickCapture={hideRailTooltip}
          >
            <span className="soridraw-studio-rail-profile-avatar" aria-hidden="true">
              {effectiveProfilePhotoURL ? (
                <img src={effectiveProfilePhotoURL} alt="" referrerPolicy="no-referrer" />
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
              <PenTool className="h-5 w-5" />
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
              <History className="h-5 w-5" />
              <span>최근 생성곡</span>
              <ChevronRight className="ml-auto h-4 w-4" />
            </button>
            <button
              type="button"
              data-soridraw-menu-access="music-note"
              className={`soridraw-studio-rail-item${activeWorkspace === 'music-note' ? ' is-active' : ''}`}
              onClick={onMusicNote}
              aria-current={activeWorkspace === 'music-note' ? 'page' : undefined}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '뮤직노트')}
              onMouseLeave={hideRailTooltip}
            >
              <Music className="h-5 w-5" />
              <span>뮤직노트</span>
              <ChevronRight className="ml-auto h-4 w-4" />
            </button>
            <button
              type="button"
              data-soridraw-menu-access="library"
              className={`soridraw-studio-rail-item${activeWorkspace === 'library' ? ' is-active' : ''}`}
              onClick={onLibrary}
              aria-current={activeWorkspace === 'library' ? 'page' : undefined}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '라이브러리')}
              onMouseLeave={hideRailTooltip}
            >
              <Library className="h-5 w-5" />
              <span>라이브러리</span>
              <ChevronRight className="ml-auto h-4 w-4" />
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
              <Search className="h-5 w-5" />
              <span>통합 검색</span>
            </button>
            <button
              type="button"
              className="soridraw-studio-rail-item"
              onClick={onApiSettings}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, 'API 설정')}
              onMouseLeave={hideRailTooltip}
            >
              <Settings className="h-5 w-5" />
              <span>API 설정</span>
            </button>
          </nav>

          <div className="soridraw-studio-rail-bottom-actions" aria-label="추가 메뉴">
            <button
              type="button"
              data-soridraw-menu-access="lab"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              onClick={onLab}
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, 'Labs')}
              onMouseLeave={hideRailTooltip}
            >
              <FlaskConical className="h-5 w-5" />
              <span>Labs</span>
            </button>
            <button
              type="button"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              aria-label="알림"
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '알림')}
              onMouseLeave={hideRailTooltip}
            >
              <Bell className="h-5 w-5" />
              <span>알림</span>
            </button>
            <button
              type="button"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              aria-label="기타 메뉴"
              onMouseEnter={(event) => showRailTooltip(event.currentTarget, '더보기')}
              onMouseLeave={hideRailTooltip}
            >
              <Ellipsis className="h-5 w-5" />
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
