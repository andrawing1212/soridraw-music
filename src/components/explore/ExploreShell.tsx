import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Compass, Home, Zap } from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { applySoridrawDisplayMode, readSoridrawDisplayMode } from '../../services/themePreferences';
import StudioPageFrame from '../studio/StudioPageFrame';
import StudioLeftRail, { type StudioWorkspaceView } from '../studio/StudioLeftRail';
import ExplorePage from '../../pages/ExplorePage';

export default function ExploreShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);

  useLayoutEffect(() => {
    applySoridrawDisplayMode(readSoridrawDisplayMode());
  }, []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const go = (path: string) => {
    if (`${location.pathname}${location.search}` === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    navigate(path);
  };

  const leftRail = (
    <StudioLeftRail
      activeWorkspace={'__explore__' as StudioWorkspaceView}
      onCreate={() => go('/studio')}
      onRecentSongs={() => go('/studio')}
      onMusicNote={() => go('/history')}
      onLibrary={() => go('/suno-library')}
      onSearch={() => go('/')}
      onApiSettings={() => go('/suno-api-settings')}
      onLab={() => go('/lab')}
      onProfile={() => go('/my-page')}
      onSettings={() => go('/my-page?tab=settings')}
      onPlan={() => go('/my-page?tab=plan')}
      onBilling={() => go('/my-page?tab=billing')}
      onLogout={async () => {
        await signOut(auth);
        go('/');
      }}
      profileName={user?.displayName || user?.email?.split('@')[0] || 'SORiDRAW'}
      profileEmail={user?.email || ''}
      profilePhotoURL={user?.photoURL || ''}
    />
  );

  return (
    <div className="soridraw-app-root soridraw-explore-app-shell">
      <header className="soridraw-top-navigation soridraw-explore-top-navigation">
        <button type="button" className="soridraw-explore-brand" onClick={() => go('/')} aria-label="SORiDRAW 홈">SORiDRAW</button>
        <nav aria-label="주요 메뉴">
          <button type="button" className="soridraw-top-nav-item" onClick={() => go('/')}><Home aria-hidden="true" /><span>홈</span></button>
          <button type="button" className="soridraw-top-nav-item" onClick={() => go('/studio')}><Zap aria-hidden="true" /><span>스튜디오</span></button>
          <button type="button" className="soridraw-top-nav-item is-active" data-soridraw-explore-native="true" aria-current="page" onClick={() => go('/explore')}><Compass aria-hidden="true" /><span>익스플로어</span></button>
        </nav>
        <span className="soridraw-explore-top-spacer" aria-hidden="true" />
      </header>

      <StudioPageFrame workspaceView="explore" leftRail={leftRail} rightRail={null} lockViewport={false}>
        <ExplorePage />
      </StudioPageFrame>
    </div>
  );
}
