import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import StudioPageFrame from '../studio/StudioPageFrame';
import StudioLeftRail, { type StudioWorkspaceView } from '../studio/StudioLeftRail';
import ExplorePage from '../../pages/ExplorePage';

export default function ExploreShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);

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
    <div className="soridraw-explore-app-shell">
      <StudioPageFrame workspaceView="explore" leftRail={leftRail} rightRail={null} lockViewport={false}>
        <ExplorePage />
      </StudioPageFrame>
    </div>
  );
}
