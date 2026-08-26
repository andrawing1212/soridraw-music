import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './components/studio/studioLayout.css';
import './components/studio/tabletTouchPacedContent';

// M-005 one-time Preview post-check removed; normal app entry restored.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);