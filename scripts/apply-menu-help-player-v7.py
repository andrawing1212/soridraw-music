from pathlib import Path
import re

ROOT = Path('.')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')

# -----------------------------------------------------------------------------
# 1) Local-only menu help preference. No Firestore/Functions reads or writes.
# -----------------------------------------------------------------------------
preference = """export const MENU_HELP_TIPS_STORAGE_KEY = 'soridraw.menuHelpTips.v1';
export const MENU_HELP_TIPS_EVENT = 'soridraw:menu-help-tips-changed';

export function readMenuHelpTipsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MENU_HELP_TIPS_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeMenuHelpTipsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MENU_HELP_TIPS_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Keep the in-session behavior even when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(MENU_HELP_TIPS_EVENT, { detail: { enabled } }));
}
"""
write('src/lib/menuHelpPreference.ts', preference)

# -----------------------------------------------------------------------------
# 2) Menu title help portal. Keep the existing tooltip visual DOM, but mount it
#    under document.body so split-pane/card overflow can never clip it.
# -----------------------------------------------------------------------------
portal = """import React, { useLayoutEffect, useState } from 'react';
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
"""
write('src/components/studio/MenuTitleTooltipPortal.tsx', portal)

# -----------------------------------------------------------------------------
# 3) Existing stable title-hover hook respects the MyPage local preference.
# -----------------------------------------------------------------------------
stable_path = Path('src/lib/stableHoverTooltip.ts')
stable = stable_path.read_text(encoding='utf-8')
stable = replace_once(
    stable,
    "import { useCallback, useEffect, useRef, useState } from 'react';\n",
    "import { useCallback, useEffect, useRef, useState } from 'react';\nimport { readMenuHelpTipsEnabled } from './menuHelpPreference';\n",
    'stable hover preference import',
)
stable = replace_once(
    stable,
    "    if (!nextVisible) {\n      hideNow();\n      return;\n    }\n    clearShowTimer();",
    "    if (!nextVisible) {\n      hideNow();\n      return;\n    }\n    if (!readMenuHelpTipsEnabled()) {\n      hideNow();\n      return;\n    }\n    clearShowTimer();",
    'stable hover preference guard',
)
write(str(stable_path), stable)

# -----------------------------------------------------------------------------
# Shared helpers for App/Genre title tooltip anchors + portals.
# -----------------------------------------------------------------------------
def mark_title_anchors(source: str, expected: int, label: str) -> str:
    pattern = re.compile(r'(?P<indent>^[ \t]*)onMouseEnter=\{\(\) => (?P<setter>setShow(?:Storyboard)?TitleTooltip)\(true\)\}', re.M)
    def repl(match: re.Match) -> str:
        indent = match.group('indent')
        setter = match.group('setter')
        return f'{indent}data-soridraw-menu-title-tooltip-anchor\n{indent}onMouseEnter={{() => {setter}(true)}}'
    result, count = pattern.subn(repl, source)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} title anchors, found {count}')
    return result


def portal_title_tooltips(source: str, expected: int, label: str) -> str:
    pattern = re.compile(
        r'(?P<indent>^[ \t]*)\{(?P<state>show(?:Storyboard)?TitleTooltip) && \(\n'
        r'(?P<body>[ \t]*<motion\.div\n.*?^[ \t]*</motion\.div>)\n'
        r'(?P=indent)\)\}',
        re.M | re.S,
    )
    def repl(match: re.Match) -> str:
        indent = match.group('indent')
        state = match.group('state')
        body = match.group('body')
        return (
            f'{indent}{{{state} && (\n'
            f'{indent}  <MenuTitleTooltipPortal>\n'
            f'{body}\n'
            f'{indent}  </MenuTitleTooltipPortal>\n'
            f'{indent})}}'
        )
    result, count = pattern.subn(repl, source)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} title tooltip portals, found {count}')
    return result

# -----------------------------------------------------------------------------
# 4) App: title portals + central description-help ON/OFF guard.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "import { useStableHoverTooltip } from './lib/stableHoverTooltip';\n",
    "import { useStableHoverTooltip } from './lib/stableHoverTooltip';\nimport MenuTitleTooltipPortal from './components/studio/MenuTitleTooltipPortal';\nimport { MENU_HELP_TIPS_EVENT, MENU_HELP_TIPS_STORAGE_KEY, readMenuHelpTipsEnabled } from './lib/menuHelpPreference';\n",
    'App menu help imports',
)
app = mark_title_anchors(app, 7, 'App title anchors')
app = portal_title_tooltips(app, 7, 'App title portals')
app = replace_once(
    app,
    "  const commitHoveredItem = useCallback((item: CategoryItem | null) => {\n    studioDescriptionCurrentItemRef.current = item;",
    "  const commitHoveredItem = useCallback((item: CategoryItem | null) => {\n    if (item && !readMenuHelpTipsEnabled()) {\n      studioDescriptionCurrentItemRef.current = null;\n      studioDescriptionControllerRef.current?.hide();\n      return;\n    }\n    studioDescriptionCurrentItemRef.current = item;",
    'App central help preference guard',
)
app = replace_once(
    app,
    "  }, [commitHoveredItem, location.pathname]);\n\n  useEffect(() => () => {",
    "  }, [commitHoveredItem, location.pathname]);\n\n  useEffect(() => {\n    const hideDisabledMenuHelp = () => {\n      if (!readMenuHelpTipsEnabled()) setHoveredItem(null);\n    };\n    const handleMenuHelpStorage = (event: StorageEvent) => {\n      if (event.key === MENU_HELP_TIPS_STORAGE_KEY) hideDisabledMenuHelp();\n    };\n    window.addEventListener(MENU_HELP_TIPS_EVENT, hideDisabledMenuHelp as EventListener);\n    window.addEventListener('storage', handleMenuHelpStorage);\n    return () => {\n      window.removeEventListener(MENU_HELP_TIPS_EVENT, hideDisabledMenuHelp as EventListener);\n      window.removeEventListener('storage', handleMenuHelpStorage);\n    };\n  }, [setHoveredItem]);\n\n  useEffect(() => () => {",
    'App immediate central help hide effect',
)
write(str(app_path), app)

# -----------------------------------------------------------------------------
# 5) Genre hierarchy title help uses the same body portal.
# -----------------------------------------------------------------------------
genre_path = Path('src/components/GenreHierarchySelector.tsx')
genre = genre_path.read_text(encoding='utf-8')
genre = replace_once(
    genre,
    "import { useStableHoverTooltip } from \"../lib/stableHoverTooltip\";\n",
    "import { useStableHoverTooltip } from \"../lib/stableHoverTooltip\";\nimport MenuTitleTooltipPortal from './studio/MenuTitleTooltipPortal';\n",
    'Genre title portal import',
)
genre = mark_title_anchors(genre, 1, 'Genre title anchor')
genre = portal_title_tooltips(genre, 1, 'Genre title portal')
write(str(genre_path), genre)

# -----------------------------------------------------------------------------
# 6) Remove the now-obsolete sibling :has() stacking workaround. Portal owns
#    the visual layer; split pane overflow/containment remains untouched.
# -----------------------------------------------------------------------------
css_path = Path('src/components/studio/studioLayout.css')
css = css_path.read_text(encoding='utf-8')
marker = '\n/* 988 — title tooltip sibling stacking only.'
if marker not in css:
    raise SystemExit('studioLayout 988 marker not found')
css = css.split(marker, 1)[0].rstrip() + '\n'
write(str(css_path), css)

# -----------------------------------------------------------------------------
# 7) MyPage local toggle. Keep existing personal-settings visual language and
#    add no server writes or new border treatment.
# -----------------------------------------------------------------------------
my_path = Path('src/pages/MyPage.tsx')
my = my_path.read_text(encoding='utf-8')
my = replace_once(
    my,
    "import { USER_PROFILE_CACHE_EVENT, isUserProfileCacheStorageKey, readUserProfileCache } from '../lib/userProfileCache';\n",
    "import { USER_PROFILE_CACHE_EVENT, isUserProfileCacheStorageKey, readUserProfileCache } from '../lib/userProfileCache';\nimport { MENU_HELP_TIPS_STORAGE_KEY, readMenuHelpTipsEnabled, writeMenuHelpTipsEnabled } from '../lib/menuHelpPreference';\n",
    'MyPage menu help import',
)
my = replace_once(
    my,
    " const [autoModelFallbackMessage, setAutoModelFallbackMessage] = useState<string | null>(null);\n",
    " const [autoModelFallbackMessage, setAutoModelFallbackMessage] = useState<string | null>(null);\n const [menuHelpTipsEnabled, setMenuHelpTipsEnabled] = useState(() => readMenuHelpTipsEnabled());\n",
    'MyPage menu help state',
)
my = replace_once(
    my,
    " useEffect(() => {\n const refreshStatus = () => {",
    " useEffect(() => {\n const handleMenuHelpStorage = (event: StorageEvent) => {\n if (event.key === MENU_HELP_TIPS_STORAGE_KEY) setMenuHelpTipsEnabled(readMenuHelpTipsEnabled());\n };\n window.addEventListener('storage', handleMenuHelpStorage);\n return () => window.removeEventListener('storage', handleMenuHelpStorage);\n }, []);\n\n useEffect(() => {\n const refreshStatus = () => {",
    'MyPage menu help storage sync',
)
my = replace_once(
    my,
    " const handleLogout = useCallback(async () => {",
    " const handleToggleMenuHelpTips = useCallback(() => {\n const nextValue = !menuHelpTipsEnabled;\n setMenuHelpTipsEnabled(nextValue);\n writeMenuHelpTipsEnabled(nextValue);\n }, [menuHelpTipsEnabled]);\n\n const handleLogout = useCallback(async () => {",
    'MyPage menu help handler',
)
settings_end = """ </button>
 </div>
 </motion.section>

 <div className="grid gap-5 lg:grid-cols-2 items-start">"""
settings_new = """ </button>
 </div>

 <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
 <div className="max-w-3xl">
 <h3 className="text-sm font-black text-zinc-100">메뉴 설명 팁</h3>
 <p className="mt-1 text-sm leading-relaxed text-white/56">
 Studio의 메뉴 제목과 버튼 설명 팁을 표시합니다. 필요하지 않으면 꺼서 마우스 이동 시 도움말 팝업을 만들지 않습니다.
 </p>
 </div>
 <button
 type="button"
 role="switch"
 aria-checked={menuHelpTipsEnabled}
 aria-label="메뉴 설명 팁"
 onClick={handleToggleMenuHelpTips}
 className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${menuHelpTipsEnabled ? 'bg-zinc-100' : 'bg-white/[0.10]'}`}
 >
 <span
 className={`h-6 w-6 rounded-full shadow-sm transition-transform ${menuHelpTipsEnabled ? 'translate-x-6 bg-zinc-950' : 'translate-x-0 bg-zinc-300'}`}
 />
 </button>
 </div>
 </motion.section>

 <div className="grid gap-5 lg:grid-cols-2 items-start">"""
my = replace_once(my, settings_end, settings_new, 'MyPage menu help toggle UI')
write(str(my_path), my)

# -----------------------------------------------------------------------------
# 8) Global Player layer: above Studio working controls/help, below real modals.
#    Existing app functional modals begin at z=260, Studio controls are <=120.
# -----------------------------------------------------------------------------
player_path = Path('src/components/GlobalPlayer.tsx')
player = player_path.read_text(encoding='utf-8')
player = replace_once(player, 'z-[140]', 'z-[250]', 'player warning layer')
player = replace_once(player, 'z-[99]', 'z-[235]', 'player backdrop layer')
player = replace_once(player, 'fixed z-[100] flex flex-col', 'fixed z-[240] flex flex-col', 'player root layer')
write(str(player_path), player)

print('Applied menu help portal/preference and player layer v7.')
print('Split pane overflow/containment and split drag engine were not modified.')
