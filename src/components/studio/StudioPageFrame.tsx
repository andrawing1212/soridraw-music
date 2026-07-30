import React, { type ReactNode } from 'react';

type StudioPageFrameProps = {
  leftRail: ReactNode;
  rightRail: ReactNode;
  children: ReactNode;
};

export default function StudioPageFrame({ leftRail, rightRail, children }: StudioPageFrameProps) {
  return (
    <div className="soridraw-studio-page-frame">
      {leftRail}
      <div className="soridraw-studio-page-center">{children}</div>
      {rightRail}
    </div>
  );
}
