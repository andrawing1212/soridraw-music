import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './components/studio/studioLayout.css';
import './components/studio/tabletTouchPacedContent';

const root = createRoot(document.getElementById('root')!);
const params = new URLSearchParams(window.location.search);
const isM005PreviewPostcheck = window.location.hostname === 'soridraw-music-git-preview-andrawing1212.vercel.app'
  && params.get('m005-postcheck') === 'final-20260826';

if (isM005PreviewPostcheck) {
  void import('./m005PreviewSessionPostcheck').then(({ default: M005PreviewSessionPostcheck }) => {
    root.render(<M005PreviewSessionPostcheck />);
  });
} else {
  root.render(
    <StrictMode>
      <Router>
        <App />
      </Router>
    </StrictMode>,
  );
}
