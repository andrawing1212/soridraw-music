import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import App from './App.tsx';
import ExploreNavigationBridge from './components/explore/ExploreNavigationBridge';
import ExploreShell from './components/explore/ExploreShell';
import './index.css';
import './components/studio/studioLayout.css';
import './components/studio/tabletTouchPacedContent';

function SoridrawRoot() {
  const location = useLocation();
  const isExploreRoute = location.pathname === '/explore';

  return (
    <>
      <ExploreNavigationBridge />
      {isExploreRoute ? <ExploreShell /> : <App />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <SoridrawRoot />
    </Router>
  </StrictMode>,
);
