import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './components/studio/studioLayout.css';
import './components/explore/exploreNavigation.css';
import './styles/classicLightVisualFixes.css';
import './styles/exploreProfileHeroParity.css';
import './components/studio/tabletTouchPacedContent';
import './services/userDomainSyncService';
import { startPreviewVersionSignal } from './services/versionSignalService';
import { startAppUpdateNotice } from './services/appUpdateNotice';
import { installChunkLoadRecovery } from './services/chunkLoadRecovery';
import { installExploreRevisionRequestCache } from './services/exploreRevisionRequestCache';
import { installExploreDormantResumeClock424 } from './services/exploreDormantResume424';
import { captureOwnerFollowCanaryOptIn634 } from './lib/ownerFollowCanaryTab634';

installChunkLoadRecovery();
installExploreRevisionRequestCache();
installExploreDormantResumeClock424();

// Preserve an explicit QA URL before App navigation drops its query parameters.
// No Auth, Firebase reads/writes, or cross-tab persistence.
if(typeof window!=='undefined'){
 try{
  captureOwnerFollowCanaryOptIn634(
   window.location.hostname.toLowerCase(),window.location.search,window.sessionStorage,
  );
 }catch{/* Storage-disabled browsers retain exact-URL opt-in only. */}
}
void startPreviewVersionSignal();
startAppUpdateNotice();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
