import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import StudioPageFrame from '../studio/StudioPageFrame';
import StudioLeftRail, { type StudioWorkspaceView } from '../studio/StudioLeftRail';
import ExplorePage from '../../pages/ExplorePage';
import { flushSoridrawPageSync } from '../../lib/pageSyncCoordinator';

export default function ExploreShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user?.uid) return;
    const activeUser = user;
    const flushWhenHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      void flushSoridrawPageSync(activeUser, 'route-change')
        .catch((error) => console.warn('[094] Explore background sync retained locally:', error));
    };
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      void flushSoridrawPageSync(activeUser, 'route-change')
        .catch((error) => console.warn('[081] Explore page sync pending:', error));
    };
  }, [user?.uid]);

  const go = async (path: string) => {
    if (`${location.pathname}${location.search}` === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (user?.uid) {
      await flushSoridrawPageSync(user, 'route-change')
        .catch((error) => console.warn('[094] Explore route sync retained locally:', error));
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
        if (user?.uid) {
          await flushSoridrawPageSync(user, 'route-change')
            .catch((error) => console.warn('[094] Explore logout sync retained locally:', error));
        }
        await signOut(auth);
        navigate('/');
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
