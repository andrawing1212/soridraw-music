import React, { type ReactNode } from 'react';
import StudioSplitWorkspace from './StudioSplitWorkspace';
import LiteStudioSplitWorkspace from './LiteStudioSplitWorkspace';
import StudioCompactMobileWorkspace from './StudioCompactMobileWorkspace';

export type StudioSplitEngine = 'lite' | 'legacy';
export type StudioLiteRuntimeProfile = 'adaptive' | 'library-590';
export type StudioGenerationBarPerfMode = 'normal' | 'freeze' | 'off';
export type StudioV2DragPerfMode = 'normal' | 'content-left-freeze' | 'content-right-freeze' | 'content-freeze' | 'aux-boundary' | 'aux-freeze' | 'scroll-defer' | 'direct-geometry' | 'direct-scroll-defer' | 'responsive-freeze' | 'responsive-hysteresis' | 'local-responsive';

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
  v2DragPerfMode = 'normal',
  ...props
}: Props) {
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
  return <LiteStudioSplitWorkspace {...props} runtimeProfile={liteRuntimeProfile} generationBarPerfMode={generationBarPerfMode} v2DragPerfMode={v2DragPerfMode} />;
}
