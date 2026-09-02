import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './components/studio/studioLayout.css';
import './components/explore/exploreNavigation.css';
import './styles/classicLightVisualFixes.css';
import './components/studio/tabletTouchPacedContent';
import { startPreviewVersionSignal } from './services/versionSignalService';

void startPreviewVersionSignal();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);