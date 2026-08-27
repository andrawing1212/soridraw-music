import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.tsx';
import ExploreNavigationBridge from './components/explore/ExploreNavigationBridge';
import './index.css';
import './components/studio/studioLayout.css';
import './components/studio/tabletTouchPacedContent';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <ExploreNavigationBridge />
      <App />
    </Router>
  </StrictMode>,
);
