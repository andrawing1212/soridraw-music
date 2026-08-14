import React, { type ReactNode } from 'react';
import StudioSplitWorkspace from './StudioSplitWorkspace';
import LiteStudioSplitWorkspace from './LiteStudioSplitWorkspace';

export type StudioSplitEngine = 'lite' | 'legacy';

type Props = {
  engine: StudioSplitEngine;
  children: ReactNode;
  builderMasthead?: ReactNode;
  viewMode?: 'split' | 'result-only' | 'hidden';
  workspaceView?: 'create' | 'recent' | 'music-note' | 'library';
  workspaceRequestId?: number;
};

export default function StudioSplitEngineWorkspace({ engine, ...props }: Props) {
  if (engine === 'legacy') return <StudioSplitWorkspace {...props} />;
  return <LiteStudioSplitWorkspace {...props} />;
}
