import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MusicApiGenerateModalLazy from '../../src/components/MusicApiGenerateModalLazy';

// Isolated UI behavior only. Do not initialize Firebase/Workers or invoke AI.
function ModalProbe() {
  const [variant, setVariant] = useState<'main' | 'musicApi' | null>(null);
  return (
    <main>
      <button id="open-main" onClick={() => setVariant('main')}>Open main</button>
      <button id="open-musicapi" onClick={() => setVariant('musicApi')}>Open musicApi</button>
      {variant && (
        <MusicApiGenerateModalLazy
          variant={variant}
          hasApiKey={true}
          remainingCredits={120}
          isNoLyrics={false}
          initialLyricLanguages={['ko']}
          maxLyricLanguages={variant === 'main' ? 2 : 1}
          musicApiTargets={[{
            id: 'probe-track', label: 'Probe song',
            availableLyricLanguages: ['ko', 'en'],
          }]}
          onClose={() => setVariant(null)}
          onConfirm={() => setVariant(null)}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<ModalProbe />);
