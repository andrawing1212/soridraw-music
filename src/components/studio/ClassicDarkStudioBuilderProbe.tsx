import React, { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  children: ReactNode;
  masthead?: ReactNode;
};

const collectCurrentCompiledCss = () => {
  if (typeof document === 'undefined') return '';

  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
      } catch {
        // Cross-origin font/style sheets cannot expose cssRules. The app's local
        // compiled CSS remains readable and is all this probe needs.
        return '';
      }
    })
    .filter(Boolean)
    .join('\n');
};

/**
 * 675 diagnostic only.
 *
 * The parent split shell/right pane stays in Studio Black. The one existing
 * Builder React subtree is portaled into a ShadowRoot that recreates the real
 * Classic/Dark selector ancestry (html > body > #root > .soridraw-app-root).
 * The currently compiled app CSS is copied into that shadow tree once.
 *
 * Because Studio-Black ancestor selectors cannot cross the shadow boundary,
 * while Classic/Dark html selectors match the recreated ancestry, this is a
 * real style-path A/B rather than the 674 "same split UI with one class removed"
 * probe. It does not create an iframe or a second App/Firebase instance.
 */
export default function ClassicDarkStudioBuilderProbe({ children, masthead }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    shadow.replaceChildren();

    const appStyle = document.createElement('style');
    appStyle.dataset.soridrawClassicDarkProbeCss = 'compiled-app';
    appStyle.textContent = collectCurrentCompiledCss();
    shadow.appendChild(appStyle);

    const probeStyle = document.createElement('style');
    probeStyle.dataset.soridrawClassicDarkProbeCss = 'probe-shell';
    probeStyle.textContent = `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        color-scheme: dark;
      }

      html.soridraw-classic-dark-probe-html,
      html.soridraw-classic-dark-probe-html body,
      html.soridraw-classic-dark-probe-html #root,
      html.soridraw-classic-dark-probe-html .soridraw-app-root,
      html.soridraw-classic-dark-probe-html .soridraw-classic-dark-probe-main {
        display: block;
        width: 100%;
        min-width: 0;
        max-width: none;
        margin-left: 0;
        margin-right: 0;
        box-sizing: border-box;
      }

      html.soridraw-classic-dark-probe-html {
        --bg-primary: #0f0f0f;
        --bg-secondary: #1a1a1a;
        --card-bg: #1e1e1e;
        --text-primary: #f8f9fa;
        --text-secondary: #b0b3b8;
        --border-color: rgba(255,255,255,.25);
        --input-bg: rgba(255,255,255,.15);
        --hover-bg: rgba(255,255,255,.12);
        --hover-bg-solid: #2a2a2a;
        --glass-bg: rgba(26,26,26,.9);
        --glass-border: rgba(255,255,255,.1);
        --button-bg: rgba(255,255,255,.05);
        --button-border: rgba(255,255,255,.1);
        --button-hover-bg: rgba(255,255,255,.12);
        --button-shadow: none;
        --soridraw-panel-bg: #1a1a1a;
        --soridraw-card-bg: #1e1e1e;
        --soridraw-border: rgba(255,255,255,.25);
        --soridraw-text-main: #f8f9fa;
        --soridraw-text-muted: #b0b3b8;
        --soridraw-selected-bg: #ffb400;
        --soridraw-selected-text: #171717;
        --soridraw-menu-theme-color: #ffb400;
        --soridraw-green-tone: #7fbd75;
        --soridraw-menu-amber: #ffb400;
        --soridraw-menu-amber-rgb: 255 187 34;
        --soridraw-menu-amber-soft: #ffd36a;
        --soridraw-menu-amber-soft-rgb: 255 211 106;
        --soridraw-menu-red: #ff5c52;
        --soridraw-menu-green: #7fbd75;
        min-height: 0;
        background: var(--bg-primary);
        color: var(--text-primary);
      }

      html.soridraw-classic-dark-probe-html body,
      html.soridraw-classic-dark-probe-html .soridraw-app-root {
        min-height: 0;
        margin: 0;
        background: var(--bg-primary);
        color: var(--text-primary);
      }

      html.soridraw-classic-dark-probe-html .soridraw-classic-dark-probe-main {
        padding-bottom: 24px !important;
      }

      html.soridraw-classic-dark-probe-html
      .soridraw-classic-dark-probe-hero
      .soridraw-studio-scroll-builder-masthead {
        position: relative;
        display: flex;
        width: 100%;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
      }

      html.soridraw-classic-dark-probe-html
      .soridraw-classic-dark-probe-hero
      .soridraw-studio-scroll-search-button {
        margin-left: auto;
        flex: 0 0 auto;
      }
    `;
    shadow.appendChild(probeStyle);

    // Build the selector hierarchy used by the real dark-mode Studio. These are
    // ordinary elements inside the shadow tree; they do not affect the parent
    // Studio-Black document.
    const html = document.createElement('html');
    html.className = 'dark soridraw-classic-dark-probe-html';
    html.dataset.soridrawTheme = 'classic';
    html.dataset.soridrawColorMode = 'dark';
    html.dataset.soridrawDevice = 'large-screen';

    const body = document.createElement('body');
    const root = document.createElement('div');
    root.id = 'root';
    const appRoot = document.createElement('div');
    appRoot.className = 'soridraw-app-root min-h-0 bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans';

    root.appendChild(appRoot);
    body.appendChild(root);
    html.appendChild(body);
    shadow.appendChild(html);

    setPortalTarget(appRoot);
    return () => setPortalTarget(null);
  }, []);

  return (
    <>
      <div
        ref={hostRef}
        data-soridraw-classic-dark-builder-probe="true"
        style={{ display: 'block', width: '100%', minWidth: 0 }}
      />
      {portalTarget ? createPortal(
        <>
          <header className="soridraw-classic-dark-probe-hero soridraw-studio-hero studio-hero-tone pt-20 pb-0 md:pt-24 md:pb-0 bg-transparent relative">
            <div className="soridraw-studio-shell mx-auto w-full max-w-[1500px] px-4 md:px-6 relative">
              <div className="soridraw-studio-hero-row">
                <div className="soridraw-studio-masthead flex flex-col items-start mt-4 md:mt-10 w-full">
                  {masthead}
                </div>
              </div>
            </div>
          </header>
          <main className="soridraw-classic-dark-probe-main soridraw-studio-main studio-tone-down mx-auto w-full max-w-[1500px] px-3 md:px-5 pt-6 pb-6 space-y-5 md:space-y-5">
            {children}
          </main>
        </>,
        portalTarget,
      ) : null}
    </>
  );
}
