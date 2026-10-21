import React, { useEffect, useState, type ReactNode } from 'react';
import { readCurrentSplitFrameMode, subscribeSplitFrameMode } from '../../services/navigationVisibilitySyncService';
import StudioSplitWorkspace from './StudioSplitWorkspace';
import LiteStudioSplitWorkspace from './LiteStudioSplitWorkspace';
import StudioCompactMobileWorkspace from './StudioCompactMobileWorkspace';

export type StudioSplitEngine = 'lite' | 'legacy';
export type StudioLiteRuntimeProfile = 'adaptive' | 'library-590';
export type StudioGenerationBarPerfMode = 'normal' | 'freeze' | 'off';
export type StudioV2DragPerfMode = 'normal' | 'content-left-freeze' | 'content-right-freeze' | 'content-freeze' | 'aux-boundary' | 'aux-freeze' | 'scroll-defer' | 'direct-geometry' | 'direct-scroll-defer' | 'responsive-freeze' | 'responsive-hysteresis' | 'local-responsive' | 'pure-pane' | 'pure-pane-hybrid' | 'pure-pane-live' | 'splitter-only' | 'left-pane-only' | 'right-pane-only' | 'tablet-touch-pure';

type Props = {
  engine: StudioSplitEngine;
  liteRuntimeProfile?: StudioLiteRuntimeProfile;
  children: ReactNode;
  builderMasthead?: ReactNode;
  viewMode?: 'split' | 'result-only' | 'hidden';
  workspaceView?: 'create' | 'recent' | 'music-note' | 'library';
  workspaceRequestId?: number;
  compactMobileMode?: boolean;
  generationBarPerfMode?: StudioGenerationBarPerfMode;
  v2DragPerfMode?: StudioV2DragPerfMode;
};

export default function StudioSplitEngineWorkspace({
  engine,
  liteRuntimeProfile = 'adaptive',
  compactMobileMode = false,
  generationBarPerfMode = 'normal',
  v2DragPerfMode = 'pure-pane-hybrid',
  ...props
}: Props) {
  const [globalSplitFrameMode, setGlobalSplitFrameMode] = useState(readCurrentSplitFrameMode);
  useEffect(() => {
    // The realtime mode is a control plane value, NOT a per-drag signal.
    // Never switch the live split handler mid-pointer gesture.
    let pointerHeld = false;
    let pendingMode: ReturnType<typeof readCurrentSplitFrameMode> | null = null;
    let commitFrame: number | null = null;
    const releasePointer = () => {
      pointerHeld = false;
      // Window capture listeners run BEFORE the split pane's pointer-up
      // handler. Commit on the next frame only, after app448's final
      // geometry/capture cleanup has completed for this event.
      if (pendingMode && commitFrame === null) {
        commitFrame = window.requestAnimationFrame(() => {
          commitFrame = null;
          if (pointerHeld) return;
          const mode = pendingMode;
          pendingMode = null;
          if (mode) setGlobalSplitFrameMode(mode);
        });
      }
    };
    const unsubscribe = subscribeSplitFrameMode((next) => {
      if (pointerHeld || commitFrame !== null) {
        pendingMode = next;
      } else {
        setGlobalSplitFrameMode(next);
      }
    });
    const holdPointer = () => { pointerHeld = true; };
    window.addEventListener('pointerdown', holdPointer, true);
    window.addEventListener('pointerup', releasePointer, true);
    window.addEventListener('pointercancel', releasePointer, true);
    window.addEventListener('blur', releasePointer);
    return () => {
      unsubscribe();
      if (commitFrame !== null) window.cancelAnimationFrame(commitFrame);
      window.removeEventListener('pointerdown', holdPointer, true);
      window.removeEventListener('pointerup', releasePointer, true);
      window.removeEventListener('pointercancel', releasePointer, true);
      window.removeEventListener('blur', releasePointer);
    };
  }, []);
  // Only explicit diagnostic v2DragPerf URL selection overrides the global
  // Master mode; absent that selection, app448's default remains Hybrid.
  const diagnosticOverride = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('v2DragPerf');
  const effectiveSplitFrameMode = diagnosticOverride ? v2DragPerfMode : globalSplitFrameMode;

  // 646: below the mobile threshold Studio Black is no longer a squeezed split
  // canvas. It renders the same information hierarchy as the phone UI and does
  // not mount either split engine, so no divider/rail geometry can leak into it.
  if (compactMobileMode && props.viewMode === 'split') {
    return (
      <StudioCompactMobileWorkspace workspaceView={props.workspaceView}>
        {props.children}
      </StudioCompactMobileWorkspace>
    );
  }

  if (engine === 'legacy') return <StudioSplitWorkspace {...props} generationBarPerfMode={generationBarPerfMode} />;
  return <LiteStudioSplitWorkspace {...props} runtimeProfile={liteRuntimeProfile} generationBarPerfMode={generationBarPerfMode} v2DragPerfMode={effectiveSplitFrameMode} />;
}
