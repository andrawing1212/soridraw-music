import React, { Children, type ReactNode, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

type StudioWorkspaceView = 'create' | 'recent' | 'music-note' | 'library';

type Props = {
  children: ReactNode;
  workspaceView?: StudioWorkspaceView;
};

export default function StudioCompactMobileWorkspace({ children, workspaceView = 'create' }: Props) {
  const panes = Children.toArray(children);
  const isStandaloneResultPage = workspaceView === 'music-note' || workspaceView === 'library';

  useLayoutEffect(() => {
    const root = document.documentElement;

    // 646: the compact split presentation intentionally behaves like the real
    // phone layout. Responsive consumers should see one mobile composition,
    // while the stored desktop/tablet split ratio and collapse preferences stay
    // untouched because neither split engine is mounted in this mode.
    root.dataset.soridrawCompactWorkspace = 'true';

    // 748 — The floating Generate bar is a body portal. When the outer window
    // crosses from split-tablet into this Compact/mobile workspace, the split
    // engine unmounts in the same commit. Remove its last fixed X/width geometry
    // immediately so the bar falls back to the native full-width mobile rule
    // instead of keeping a stale tablet track until resize-end.
    root.style.removeProperty('--soridraw-action-fixed-left');
    root.style.removeProperty('--soridraw-action-fixed-width');
    const floatingActionBar = document.querySelector<HTMLElement>(
      'body > .soridraw-studio-action-bar--tracking[data-soridraw-placement="floating"]',
    );
    floatingActionBar?.style.removeProperty('--soridraw-action-fixed-left');
    floatingActionBar?.style.removeProperty('--soridraw-action-fixed-width');
    floatingActionBar?.style.removeProperty('--soridraw-studio-builder-width');
    const collapsedActionButton = document.querySelector<HTMLElement>('body > .soridraw-studio-action-collapsed');
    collapsedActionButton?.style.removeProperty('--soridraw-studio-builder-width');
    collapsedActionButton?.style.removeProperty('--soridraw-studio-left-rail-edge');

    root.dataset.soridrawBuilderMode = 'mobile';
    root.dataset.soridrawResultMode = 'mobile';
    root.dataset.soridrawBuilderContentMode = 'mobile';
    root.dataset.soridrawResultContentMode = 'mobile';
    delete root.dataset.soridrawBuilderCollapsed;
    delete root.dataset.soridrawResultCollapsed;

    window.dispatchEvent(new CustomEvent('soridraw-studio-pane-collapse-change', {
      detail: { builderCollapsed: isStandaloneResultPage, resultCollapsed: false },
    }));

    return () => {
      if (root.dataset.soridrawCompactWorkspace === 'true') {
        delete root.dataset.soridrawCompactWorkspace;
        delete root.dataset.soridrawBuilderMode;
        delete root.dataset.soridrawResultMode;
        delete root.dataset.soridrawBuilderContentMode;
        delete root.dataset.soridrawResultContentMode;
      }
    };
  }, [isStandaloneResultPage]);

  const centerModalHost = (
    <div id="soridraw-studio-center-modal-root" className="soridraw-studio-center-modal-host" />
  );

  return (
    <>
      <div
        className={`soridraw-studio-compact-mobile-workspace${isStandaloneResultPage ? ' is-result-page' : ' is-studio-page'}`}
        data-compact-workspace-view={workspaceView}
      >
        {isStandaloneResultPage ? (
          <div id="soridraw-studio-result-pane" className="soridraw-studio-compact-mobile-result soridraw-studio-result-pane" data-soridraw-studio-pane="result">
            {panes[1] ?? null}
          </div>
        ) : (
          <>
            <div id="soridraw-studio-builder-pane" className="soridraw-studio-compact-mobile-builder soridraw-studio-builder-pane" data-soridraw-studio-pane="builder">
              {panes[0] ?? null}
            </div>
            <div id="soridraw-studio-result-pane" className="soridraw-studio-compact-mobile-result soridraw-studio-result-pane" data-soridraw-studio-pane="result">
              {panes[1] ?? null}
            </div>
          </>
        )}
      </div>
      {typeof document !== 'undefined' ? createPortal(centerModalHost, document.body) : centerModalHost}
    </>
  );
}
