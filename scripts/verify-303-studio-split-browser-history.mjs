import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const explore = readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');
const splitEngine = readFileSync('src/components/studio/StudioSplitEngineWorkspace.tsx', 'utf8');

assert.match(
  app,
  /const navigateStudioWorkspaceView = useCallback\(\(view: StudioWorkspaceView\) => \{[\s\S]*?const previousView = studioWorkspaceView;[\s\S]*?selectStudioWorkspaceView\(view\);[\s\S]*?if \(previousView === view\) return;[\s\S]*?location\.pathname !== '\/studio'[\s\S]*?readSoridrawDisplayMode\(\) !== 'studio-black'[\s\S]*?nextParams\.set\('view', view\)[\s\S]*?navigate\(\`\/studio\$\{query \? \`\?\$\{query\}\` : ''\}\`\)/,
  'split workspace user navigation must push a browser-history entry carrying the exact view',
);

assert.match(
  app,
  /useEffect\(\(\) => \{[\s\S]*?location\.pathname !== '\/studio'[\s\S]*?readSoridrawDisplayMode\(\) !== 'studio-black'[\s\S]*?new URLSearchParams\(location\.search\)\.get\('view'\)[\s\S]*?requestedView === 'recent'[\s\S]*?requestedView === 'music-note'[\s\S]*?requestedView === 'library'[\s\S]*?requestedView === 'create'[\s\S]*?selectStudioWorkspaceView\(nextView\)/,
  'browser Back/Forward must restore the split workspace from the history URL',
);

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


// app381 is a separately approved UI release; app380 follow-only must retain
// the exact app379 pre-paint workspace and Explore Recent routing.
const appVersion = Number(JSON.parse(readFileSync('public/app-version.json', 'utf8')).version);
if (appVersion >= 381) {


  assert.match(
    explore,
    /onRecentSongs=\{\(\) => go\('\/studio\?view=recent'\)\}/,
    'Explore Recent Songs must route to the exact Recent workspace',
  );
  assert.doesNotMatch(
    explore,
    /onRecentSongs=\{\(\) => go\('\/studio'\)\}/,
    'Explore Recent Songs must not fall back to Create',
  );
  assert.match(splitEngine, /useLayoutEffect/, 'workspace switch must reconcile in layout phase');
  assert.match(splitEngine, /soridraw-studio-frame-resize/, 'workspace switch must reuse the existing Lite frame-resize owner');
  assert.match(splitEngine, /props\.workspaceRequestId/, 'workspace request id must drive pre-paint reconciliation');
  assert.match(splitEngine, /props\.workspaceView/, 'workspace view must drive pre-paint reconciliation');

  console.log('VERIFY_381_RECENT_WORKSPACE_TRANSITION=PASS');
} else {
  assert.match(explore, /onRecentSongs=\{\(\) => go\('\/studio'\)\}/,
    'pre-app381 Explore Recent routing must remain as deployed app379');
  assert.doesNotMatch(explore, /onRecentSongs=\{\(\) => go\('\/studio\?view=recent'\)\}/,
    'app381 UI route must not leak into follow-only release');
  assert.doesNotMatch(splitEngine, /soridraw-studio-frame-resize/,
    'app381 pre-paint layout hotfix must not leak into follow-only release');
  console.log('APP380_APP379_STUDIO_UI_PROTECTED=PASS');
}
