import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './components/studio/studioLayout.css';
import './components/studio/tabletTouchPacedContent';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);