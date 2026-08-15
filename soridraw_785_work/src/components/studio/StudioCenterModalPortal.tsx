import React, { type ReactNode, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const STUDIO_CENTER_MODAL_ROOT_ID = 'soridraw-studio-center-modal-root';

type StudioCenterModalPortalProps = {
  children: ReactNode;
  themeClassName?: string;
};

const resolvePortalTarget = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  return document.getElementById(STUDIO_CENTER_MODAL_ROOT_ID) || document.body;
};

export default function StudioCenterModalPortal({ children, themeClassName = '' }: StudioCenterModalPortalProps) {
  const [target, setTarget] = useState<HTMLElement | null>(() => resolvePortalTarget());

  useLayoutEffect(() => {
    const nextTarget = resolvePortalTarget();
    if (nextTarget !== target) setTarget(nextTarget);
  }, [target]);

  if (!target) return null;

  const isStudioCenter = target.id === STUDIO_CENTER_MODAL_ROOT_ID;
  const className = [
    'soridraw-detail-modal-portal-scope',
    isStudioCenter ? 'is-studio-center-overlay' : '',
    themeClassName,
  ].filter(Boolean).join(' ');

  return createPortal(
    <div className={className} data-studio-center-overlay={isStudioCenter ? 'true' : undefined}>
      {children}
    </div>,
    target,
  );
}
