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

void startPreviewVersionSignal();
startAppUpdateNotice();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
