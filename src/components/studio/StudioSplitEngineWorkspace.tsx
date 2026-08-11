import React, { type ReactNode } from 'react';
import StudioSplitWorkspace from './StudioSplitWorkspace';
import LiteStudioSplitWorkspace from './LiteStudioSplitWorkspace';

export type StudioSplitEngine = 'lite' | 'legacy';
export type StudioLiteRuntimeProfile = 'adaptive' | 'library-590';

type Props = {
  engine: StudioSplitEngine;
  liteRuntimeProfile?: StudioLiteRuntimeProfile;
  children: ReactNode;
  builderMasthead?: ReactNode;
  viewMode?: 'split' | 'result-only' | 'hidden';
  workspaceView?: 'create' | 'recent' | 'music-note' | 'library';
  workspaceRequestId?: number;
};

export default function StudioSplitEngineWorkspace({ engine, liteRuntimeProfile = 'adaptive', ...props }: Props) {
  if (engine === 'legacy') return <StudioSplitWorkspace {...props} />;
  return <LiteStudioSplitWorkspace {...props} runtimeProfile={liteRuntimeProfile} />;
}
