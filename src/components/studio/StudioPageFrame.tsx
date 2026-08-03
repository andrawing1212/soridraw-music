import React, { type ReactNode, useLayoutEffect } from 'react';

type StudioPageFrameProps = {
  leftRail: ReactNode;
  rightRail: ReactNode;
  children: ReactNode;
};

export default function StudioPageFrame({ leftRail, rightRail, children }: StudioPageFrameProps) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add('soridraw-studio-route-active');
    body.classList.add('soridraw-studio-route-active');

    return () => {
      root.classList.remove('soridraw-studio-route-active');
      body.classList.remove('soridraw-studio-route-active');
    };
  }, []);

  return (
    <div className="soridraw-studio-page-frame">
      {leftRail}
      <div className="soridraw-studio-page-center">{children}</div>
      {rightRail}
    </div>
  );
}
