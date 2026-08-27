import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Compass } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const HOST_ATTR = 'data-soridraw-explore-nav-host';
const normalizeLabel = (element: Element) => String(element.textContent || '').replace(/\s+/g, '').trim();

export default function ExploreNavigationBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let currentHost: HTMLElement | null = null;

    const syncNavigation = () => {
      const navigation = document.querySelector<HTMLElement>('.soridraw-top-navigation');
      if (!navigation) {
        setHost(null);
        return;
      }

      if (navigation.querySelector('[data-soridraw-explore-native="true"]')) {
        currentHost?.remove();
        currentHost = null;
        setHost(null);
        return;
      }

      const topNavItems = Array.from(navigation.querySelectorAll<HTMLElement>('.soridraw-top-nav-item'));
      const studioButton = topNavItems.find((item) => normalizeLabel(item).includes('스튜디오'));
      if (!studioButton?.parentElement) {
        setHost(null);
        return;
      }

      topNavItems.forEach((item) => {
        const label = normalizeLabel(item);
        const keep = label.includes('홈') || label.includes('스튜디오');
        if (keep) item.removeAttribute('data-soridraw-explore-split-hide');
        else item.setAttribute('data-soridraw-explore-split-hide', 'true');
      });

      let nextHost = navigation.querySelector<HTMLElement>(`[${HOST_ATTR}="true"]`);
      if (!nextHost) {
        nextHost = document.createElement('span');
        nextHost.setAttribute(HOST_ATTR, 'true');
        nextHost.className = 'soridraw-explore-nav-host';
        studioButton.insertAdjacentElement('afterend', nextHost);
      } else if (nextHost.previousElementSibling !== studioButton) {
        studioButton.insertAdjacentElement('afterend', nextHost);
      }

      currentHost = nextHost;
      setHost(nextHost);
    };

    syncNavigation();
    observer = new MutationObserver(syncNavigation);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      currentHost?.remove();
      document.querySelectorAll('[data-soridraw-explore-split-hide]').forEach((element) => {
        element.removeAttribute('data-soridraw-explore-split-hide');
      });
      setHost(null);
    };
  }, [location.pathname]);

  if (!host) return null;

  const active = location.pathname === '/explore';
  return createPortal(
    <button
      type="button"
      className={`soridraw-top-nav-item relative flex h-11 items-center gap-2.5 rounded-2xl px-3 text-[14px] font-black transition-all whitespace-nowrap sm:px-4${active ? ' is-active bg-transparent text-white' : ' bg-transparent text-white/60 hover:text-white'}`}
      onClick={() => navigate('/explore')}
      aria-current={active ? 'page' : undefined}
      aria-label="익스플로어"
      title="익스플로어"
    >
      <Compass className="h-6 w-6" aria-hidden="true" />
      <span className="relative inline-flex items-center pb-1">익스플로어</span>
    </button>,
    host,
  );
}
