import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const explore = readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');
const splitEngine = readFileSync('src/components/studio/StudioSplitEngineWorkspace.tsx', 'utf8');
const liteWorkspace = readFileSync('src/components/studio/LiteStudioSplitWorkspace.tsx', 'utf8');

// app440: the URL is the sole owner of in-Studio navigation; do not
// publish an interim Result page while the router still carries an old view.
const navigationStart = app.indexOf('  const navigateStudioWorkspaceView = useCallback(');
const historyStart = app.indexOf('  // Browser Back/Forward and external Explore links', navigationStart);
assert.ok(navigationStart > 0 && historyStart > navigationStart, 'Studio navigation/URL sync must exist');
const navigationBlock = app.slice(navigationStart, historyStart);
assert.match(navigationBlock, /if \(location\.pathname !== '\/studio' \|\| readSoridrawDisplayMode\(\) !== 'studio-black'\) \{[\s\S]*?selectStudioWorkspaceView\(view\);[\s\S]*?return;/,
  'off-route/Classic navigation must retain explicit workspace selection');
assert.match(navigationBlock, /const nextParams = new URLSearchParams\(location\.search\);[\s\S]*?nextParams\.set\('view', view\);[\s\S]*?navigate\(\`\/studio/,
  'in-Studio navigation must push the intended view into browser history');
assert.doesNotMatch(navigationBlock, /const previousView = studioWorkspaceView/,
  'do not restore a stale previous view during a pending router navigation');

const historyEnd = app.indexOf('  // 951: A Classic Music Note/Library route', historyStart);
assert.ok(historyEnd > historyStart, 'missing browser Back/Forward synchronization');
const historyBlock = app.slice(historyStart, historyEnd);
assert.match(historyBlock, /useLayoutEffect\(\(\) => \{[\s\S]*?new URLSearchParams\(location\.search\)\.get\('view'\)[\s\S]*?selectStudioWorkspaceView\(nextView\)/,
  'browser Back/Forward and Explore deep links must settle before paint');

assert.match(
  app,
  /<StudioLeftRail[\s\S]*?onCreate=\{\(\) => \{[\s\S]*?navigateStudioWorkspaceView\('create'\)[\s\S]*?onRecentSongs=\{\(\) => navigateStudioWorkspaceView\('recent'\)\}[\s\S]*?onMusicNote=\{\(\) => navigateStudioWorkspaceView\('music-note'\)\}[\s\S]*?onLibrary=\{\(\) => navigateStudioWorkspaceView\('library'\)\}/,
  'split left rail must use history-aware navigation for all four workspaces',
);

assert.match(
  app,
  /onStudioWorkspaceSelect=\{navigateStudioWorkspaceView\}/,
  'compact split navigation must share the history-aware workspace selector',
);

assert.match(
  app,
  /const openCompactStudioWorkspace = \(view: StudioWorkspaceView\) => \{[\s\S]*?onStudioWorkspaceSelect\(view\);[\s\S]*?location\.pathname !== '\/studio'\) navigate\(\`\/studio\?view=\$\{view\}\`\)/,
  'compact split navigation from another route must carry its target workspace into /studio history',
);

assert.match(
  app,
  /onOpenSong=\{\(song, index\) => \{[\s\S]*?navigateStudioWorkspaceView\('recent'\);[\s\S]*?openStudioDashboardSong\(song, index\)/,
  'split right-rail song navigation must preserve the previous workspace in browser history',
);

assert.match(
  app,
  /onClick=\{\(\) => navigateStudioWorkspaceView\('music-note'\)\}/,
  'split result shortcut to Music Note must be history-aware',
);

assert.match(
  app,
  /clearSunoLibrarySignal\(\);[\s\S]*?navigateStudioWorkspaceView\('library'\);/,
  'split result shortcut to Library must be history-aware',
);

// Classic dark/light routing remains route-based and must stay untouched.
assert.match(app, /\{ key: 'musicNote', path: '\/history'/, 'classic Music Note route changed');
assert.match(app, /\{ key: 'library', path: '\/suno-library'/, 'classic Library route changed');
assert.match(app, /onMusicNote=\{\(\) => navigate\('\/history'\)\}/, 'classic Music Note rail route changed');

console.log('VERIFY_303_STUDIO_SPLIT_BROWSER_HISTORY=PASS');


// app441: A deep link from Explore must highlight its destination on the
// FIRST render, even when App still retains a previous Studio workspace.
const railSelectionStart = app.indexOf('  // app441: After returning from Explore');
const railSelectionEnd = app.indexOf('  // Browser Back/Forward and external Explore links', railSelectionStart);
assert.ok(railSelectionStart > 0 && railSelectionEnd > railSelectionStart,
  'missing first-render split rail destination selection');
const railSelection = app.slice(railSelectionStart, railSelectionEnd);
assert.match(railSelection, /location\.pathname !== '\/studio' \|\| readSoridrawDisplayMode\(\) !== 'studio-black'\) return studioWorkspaceView/,
  'Classic and unrelated routes must retain their existing selection');
assert.match(railSelection, /new URLSearchParams\(location\.search\)\.get\('view'\)/,
  'split rail highlight must be read directly from the destination URL');
assert.match(railSelection, /requestedView === 'recent' \|\| requestedView === 'music-note' \|\| requestedView === 'library'/,
  'all three valid non-Create views must be preserved');
assert.match(railSelection, /: 'create'/,
  'missing or invalid view must retain the canonical Create route');
assert.match(app, /<StudioPageFrame[\s\S]*?leftRail=\{[\s\S]*?<StudioLeftRail[\s\S]*?activeWorkspace=\{studioRailActiveWorkspace\}/,
  'split left rail must use the URL-derived value, not stale previous state');
assert.match(app, /workspaceView=\{studioWorkspaceView\}[\s\S]*?workspaceRequestId=\{studioWorkspaceLayoutRequestId\}/,
  'existing pane geometry and workspace request owner must be unchanged');
console.log('VERIFY_441_STUDIO_RAIL_FIRST_FRAME_URL_HIGHLIGHT=PASS');

// app440 explicit navigation parity: Explore's Create and Recent must
// resolve to distinct routes; only the existing Lite owner settles pane layout.
assert.match(explore, /onCreate=\{\(\) => go\('\/studio'\)\}/,
  'Explore Create must retain its canonical Studio route');
assert.match(explore, /onRecentSongs=\{\(\) => go\('\/studio\?view=recent'\)\}/,
  'Explore Recent must navigate to the exact Recent workspace');
assert.doesNotMatch(explore, /onRecentSongs=\{\(\) => go\('\/studio'\)\}/,
  'Explore Recent must not route to Create');
assert.match(liteWorkspace, /useLayoutEffect\(\(\) => \{[\s\S]*?const nextWorkspace = workspaceView \|\| 'create';[\s\S]*?root\.dataset\.soridrawLiteWorkspace = nextWorkspace/,
  'split first-frame CSS workspace must settle before paint');
assert.match(liteWorkspace, /window\.addEventListener\('soridraw-studio-frame-resize'/,
  'split must preserve existing frame-resize owner');
assert.match(app, /workspaceRequestId=\{studioWorkspaceLayoutRequestId\}/,
  'Studio must preserve the workspace layout request id');
assert.match(splitEngine, /<LiteStudioSplitWorkspace \{\.\.\.props\}/,
  'Lite split engine must remain the existing pane owner');
console.log('VERIFY_440_RECENT_EXACT_ROUTE_AND_ATOMIC_STATE=PASS');
