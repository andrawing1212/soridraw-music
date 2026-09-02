import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type MenuTitleTooltipPortalProps = {
  children: React.ReactNode;
};

type TooltipPosition = {
  left: number;
  top: number;
};

type TooltipElementProps = {
  className?: string;
  style?: React.CSSProperties;
  'data-soridraw-unified-menu-tip'?: boolean;
};

const UNIFIED_MENU_TOOLTIP_CLASS =
  'soridraw-card-title-tooltip relative z-[1] mt-2 w-64 max-w-[calc(100vw-16px)] rounded-xl border border-[#69441D] bg-[#29292A] px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.28)] pointer-events-none';

const findHoveredTitleAnchor = () => {
  if (typeof document === 'undefined') return null;
  const anchors = Array.from(
    document.querySelectorAll<HTMLElement>('[data-soridraw-menu-title-tooltip-anchor]:hover'),
  );
  return anchors[anchors.length - 1] ?? null;
};

const normalizeTooltipChildren = (children: React.ReactNode) =>
  React.Children.map(children, (child) => {
    if (!React.isValidElement<TooltipElementProps>(child)) return child;

    return React.cloneElement(child, {
      className: UNIFIED_MENU_TOOLTIP_CLASS,
      style: {
        ...(child.props.style ?? {}),
        position: 'relative',
        top: 'auto',
        right: 'auto',
        bottom: 'auto',
        left: 'auto',
        marginTop: 8,
      },
      'data-soridraw-unified-menu-tip': true,
    });
  });

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
      {normalizeTooltipChildren(children)}
    </div>,
    document.body,
  );
}
