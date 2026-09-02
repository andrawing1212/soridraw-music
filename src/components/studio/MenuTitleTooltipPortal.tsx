import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type MenuTitleTooltipPortalProps = {
  children: React.ReactNode;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const findHoveredTitleAnchor = () => {
  if (typeof document === 'undefined') return null;
  const anchors = Array.from(
    document.querySelectorAll<HTMLElement>('[data-soridraw-menu-title-tooltip-anchor]:hover'),
  );
  return anchors[anchors.length - 1] ?? null;
};

export default function MenuTitleTooltipPortal({ children }: MenuTitleTooltipPortalProps) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    const anchor = findHoveredTitleAnchor();
    if (!anchor) return;

    const update = () => {
      if (!anchor.isConnected) return;
      const rect = anchor.getBoundingClientRect();
      const safeLeft = Math.max(8, Math.min(window.innerWidth - 264, rect.left));
      setPosition({ left: safeLeft, top: rect.bottom });
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', update, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  if (!position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-soridraw-menu-title-tooltip-portal
      className="fixed h-0 w-0 pointer-events-none"
      style={{ left: position.left, top: position.top, zIndex: 220 }}
    >
      {children}
    </div>,
    document.body,
  );
}
