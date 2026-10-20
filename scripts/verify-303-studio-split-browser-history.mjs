import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const explore = readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');
const splitEngine = readFileSync('src/components/studio/StudioSplitEngineWorkspace.tsx', 'utf8');
const liteWorkspace = readFileSync('src/components/studio/LiteStudioSplitWorkspace.tsx', 'utf8');

// app440: the exact URL is the ONLY in-Studio navigation owner. The app439
// state-first call raced the passive old-URL sync and caused a first-frame
// Recent Result overlap/jump when leaving Music Note/Library.
const navigationBlock = app.match(/const navigateStudioWorkspaceView = useCallback\\(\\(view: StudioWorkspaceView\\) => \\{[\\s\\S]*?\\n  \\}, \\[location\\.pathname, location\\.search, navigate, selectStudioWorkspaceView\\]\\);/)?.[0] || '';
assert.ok(navigationBlock, 'missing URL-owned Studio workspace navigation');
assert.match(navigationBlock, /location\\.pathname !== '\\/studio'[\\s\\S]*?selectStudioWorkspaceView\\(view\\);[\\s\\S]*?return;/,
  'off-route and Classic paths must retain explicit workspace selection');
assert.match(navigationBlock, /const nextParams = new URLSearchParams\\(location\\.search\\);[\\s\\S]*?nextParams\\.set\\('view', view\\);[\\s\\S]*?navigate\\(\\`\\/studio/,
  'in-Studio navigation must push the intended URL view into browser history');
assert.doesNotMatch(navigationBlock, /const previousView = studioWorkspaceView|selectStudioWorkspaceView\\(view\\);[\\s\\S]*?if \\(previousView === view\\)/,
  'do not publish an uncommitted Result workspace before router navigation');

const historyBlock = app.match(/\\/\\/ Browser Back\\/Forward and external Explore links[\\s\\S]*?useLayoutEffect\\(\\(\\) => \\{[\\s\\S]*?new URLSearchParams\\(location\\.search\\)\\.get\\('view'\\)[\\s\\S]*?selectStudioWorkspaceView\\(nextView\\);[\\s\\S]*?\\}, \\[location\\.pathname, location\\.search, selectStudioWorkspaceView, studioWorkspaceView\\]\\);/)?.[0] || '';
assert.ok(historyBlock, 'URL→workspace state must settle before paint, including Back/Forward and Explore');
assert.doesNotMatch(historyBlock, /useEffect\\(\\(\\) =>/, 'the URL→workspace effect must not be passive');

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


// app440 explicit navigation parity (not a future-flag): Explore's Create
// and Recent entries MUST lead to different workspaces on every route entry.
assert.match(explore, /onCreate=\\{\\(\\) => go\\('\\/studio'\\)\\}/,
  'Explore Create must retain canonical Studio Create route');
assert.match(explore, /onRecentSongs=\\{\\(\\) => go\\('\\/studio\\?view=recent'\\)\\}/,
  'Explore Recent must navigate to the exact Recent workspace');
assert.doesNotMatch(explore, /onRecentSongs=\\{\\(\\) => go\\('\\/studio'\\)\\}/,
  'Explore Recent must never fall back to Create');
assert.match(liteWorkspace, /useLayoutEffect\\(\\(\\) => \\{[\\s\\S]*?workspaceView \\|\\| 'create'[\\s\\S]*?data(s|set)et\\.soridrawLiteWorkspace/,
  'split first-frame CSS workspace contract must settle before paint');
assert.match(liteWorkspace, /window\\.addEventListener\\('soridraw-studio-frame-resize'/,
  'split must preserve the existing frame-resize owner');
assert.match(app, /workspaceRequestId=\\{studioWorkspaceLayoutRequestId\\}/,
  'split workspace request id must remain connected');
assert.match(splitEngine, /<LiteStudioSplitWorkspace \\{\\.\\.\\.props\\}/,
  'Lite Studio split component must still own the pane geometry');
console.log('VERIFY_440_RECENT_EXACT_ROUTE_AND_ATOMIC_STATE=PASS');
