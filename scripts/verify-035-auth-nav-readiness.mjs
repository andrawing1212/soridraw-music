import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

function requireText(text, label) {
  if (!source.includes(text)) throw new Error(`[035] missing ${label}`);
}

function functionSlice(anchor, nextAnchor) {
  const start = source.indexOf(anchor);
  if (start < 0) throw new Error(`[035] missing anchor: ${anchor}`);
  const end = source.indexOf(nextAnchor, start + anchor.length);
  if (end < 0) throw new Error(`[035] missing end anchor: ${nextAnchor}`);
  return source.slice(start, end);
}

requireText('SORIDRAW_AUTH_NAV_READINESS_035', '035 marker');
requireText('const pendingAuthNavigationRef = useRef(false);', 'pending auth navigation ref');
requireText('if (!isAuthReady || !pendingAuthNavigationRef.current) return;', 'post-restore pending navigation guard');
requireText('if (!user) handleLogin();', 'signed-out login after auth restore');
requireText('const canContinueTopNavigation = () => {', 'shared navigation readiness helper');
requireText("if (!isAuthReady) {\n      pendingAuthNavigationRef.current = true;\n      return true;", 'auth-pending navigation allowance');
requireText("if (!user) {\n      handleLogin();\n      return false;", 'resolved signed-out navigation block');

const topNav = functionSlice(
  'const goToTopNav = (path: string, options?: { clearSuno?: boolean }) => {',
  'const allTopNavItems:',
);
if (topNav.includes('if (!isAuthReady) return;')) {
  throw new Error('[035] desktop top navigation still silently drops taps while auth restores');
}
if (!topNav.includes('if (!canContinueTopNavigation()) return;')) {
  throw new Error('[035] desktop top navigation does not use the shared readiness helper');
}

const compactNav = functionSlice(
  'const goToCompactMobileNav = (item: (typeof allTopNavItems)[number]) => {',
  '// Collapse menu when clicking outside',
);
if (compactNav.includes('if (!isAuthReady) return;')) {
  throw new Error('[035] compact mobile navigation still silently drops taps while auth restores');
}
if (!compactNav.includes('if (!canContinueTopNavigation()) return;')) {
  throw new Error('[035] compact mobile navigation does not use the shared readiness helper');
}

for (const [path, label] of [['/my-page', 'My Page'], ['/lab', 'Lab']]) {
  const routeAnchor = `<Route path="${path}" element={`;
  const routeStart = source.indexOf(routeAnchor);
  if (routeStart < 0) throw new Error(`[035] ${label} route missing`);
  const nextRoute = source.indexOf('<Route path=', routeStart + routeAnchor.length);
  const routeText = source.slice(routeStart, nextRoute > routeStart ? nextRoute : routeStart + 2500);
  if (!routeText.includes(') : !isAuthReady ? (')) {
    throw new Error(`[035] ${label} route can redirect before auth restoration completes`);
  }
}

requireText('const [isAuthReady, setIsAuthReady] = useState(false);', 'auth readiness state remains conservative');
requireText('setIsAuthReady(true);', 'auth restoration completion signal');

console.log('SORIDRAW_035_AUTH_NAV_READINESS=PASS');
