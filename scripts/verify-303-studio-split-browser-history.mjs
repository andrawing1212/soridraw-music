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


// app442: Recent/Music Note/Library split gutters must follow the actual
// Studio page being rendered. The document-level Lite workspace marker can be
// removed by an old workspace effect cleanup during PERF A/B remounts or route
// transitions; using it for CSS creates a visible 12px-per-side width jump.
const studioPageFrame = readFileSync('src/components/studio/StudioPageFrame.tsx', 'utf8');
const studioLayout = readFileSync('src/components/studio/studioLayout.css', 'utf8');
const gutterStart = studioLayout.indexOf('/* 1030 —');
const gutterEnd = studioLayout.indexOf('/* 1032 —', gutterStart);
assert.ok(gutterStart >= 0 && gutterEnd > gutterStart, 'missing scoped split gutter rules');
const gutterRules = studioLayout.slice(gutterStart, gutterEnd);
assert.match(studioPageFrame, /data-workspace-view=\{workspaceView\}/,
  'the current Studio page must own the workspace view on its DOM frame');
assert.match(gutterRules, /\.soridraw-studio-page-frame\[data-workspace-view="recent"\]/,
  'Recent right-pane approved gutters must follow the real page frame');
assert.match(gutterRules, /\.soridraw-studio-page-frame:is\([\s\S]*?\[data-workspace-view="recent"\][\s\S]*?\[data-workspace-view="music-note"\][\s\S]*?\[data-workspace-view="library"\]/,
  'the three Builder gutters must use the same real rendered page frame');
assert.doesNotMatch(gutterRules, /data-soridraw-lite-workspace/,
  'split gutter CSS must not rely on a document-level effect marker');
assert.match(gutterRules, /width: min\(calc\(100% - 24px\)/,
  'user-approved 12px per-side split Builder gutter must stay unchanged');
console.log('VERIFY_442_SPLIT_GUTTER_LOCAL_FRAME_OWNER=PASS');


// app445: Hybrid must publish the Builder 1080px tablet/PC transition
// DURING the same gesture as 660/820 pane composition, never on pointer-up.
// The existing CSS responds to the Builder content mode in the Generate bar.
// Only one precomputed boundary change may write <html> — no continuous
// content-width event / observer / per-pixel DOM measurement is allowed.
const hybridSignatureStart = liteWorkspace.indexOf('const readPurePaneHybridSignature = (');
const hybridSignatureEnd = liteWorkspace.indexOf('const readDragBoundarySignature = (', hybridSignatureStart);
assert.ok(hybridSignatureStart > 0 && hybridSignatureEnd > hybridSignatureStart,
  'app445 Hybrid boundary signature missing');
const hybridSignatureSource = liteWorkspace.slice(hybridSignatureStart, hybridSignatureEnd);
assert.match(hybridSignatureSource, /builderContentBand = readContentResponsiveMode\(safeBuilderWidth\)/,
  'Hybrid must account for Builder 1080px content-mode threshold');
assert.match(hybridSignatureSource, /\$\{builderBand\}:\$\{builderContentBand\}:\$\{resultBand\}/,
  'Builder and Result 660/820 existing mode bands must remain in signature');

const hybridDragStart = liteWorkspace.indexOf('if (purePaneHybridLive) {\n        const hybridSignature');
const hybridDragEnd = liteWorkspace.indexOf('// 790: Pure Pane', hybridDragStart);
assert.ok(hybridDragStart > 0 && hybridDragEnd > hybridDragStart,
  'app445 Hybrid live apply section missing');
const hybridDrag = liteWorkspace.slice(hybridDragStart, hybridDragEnd);
assert.match(hybridDrag, /if \(dragBoundarySignatureRef\.current !== hybridSignature\) \{[\s\S]*?const builderContentMode = readContentResponsiveMode\(builderWidth\)/,
  '1080px publication must execute only when the computed Hybrid band changes');
assert.match(hybridDrag, /if \(contentResponsiveModeRef\.current\.builder !== builderContentMode\) \{[\s\S]*?root\.dataset\.soridrawBuilderContentMode = builderContentMode;/,
  'content mode writes must be conditional and correctly update the shared Generate-bar CSS contract');
assert.match(hybridDrag, /syncPaneModes\(builderWidth, resultWidth, \{\s*rootSync: false,\s*hysteresisPx: 0/,
  '660/820 pane-local responsive transitions must stay immediate');
assert.doesNotMatch(hybridDrag, /broadcastLitePaneResponsiveWidths|dispatchEvent|ResizeObserver|getBoundingClientRect|setState\(/,
  'Hybrid 1080 signal must not reintroduce whole-tree broadcasts/measurements/React renders');

const contentBandForTest = width => width <= 660 ? 'mobile' : width <= 1080 ? 'tablet' : 'pc';
const composedSignatureForTest = width => [
  width < 660 ? 'mobile' : width <= 820 ? 'compact' : 'desktop',
  contentBandForTest(width),
].join(':');
// The current pane <660 threshold and content <=660 threshold are separate
// existing contracts. The signature must detect each visible mode boundary.
for (const [a,b] of [[659,660],[660,661],[820,821],[1080,1081],[1081,1080],[821,820],[661,660]]) {
  assert.notEqual(composedSignatureForTest(a), composedSignatureForTest(b),
    'Hybrid must notice Builder boundary crossed at '+a+'/'+b);
}
assert.equal(composedSignatureForTest(900), composedSignatureForTest(1000),
  'Hybrid must not publish an extra mode when still in the same band');
console.log('VERIFY_445_HYBRID_1080_LIVE_BUILDER_MODE=PASS');


// app446: the compositor-scaled Generate bar must hand off to current resting
// command-anchor coordinates BEFORE temporary width/X/scale are removed.
// A one-shot release read is permitted; none may be added to pointermove/rAF.
const restingBarStart = liteWorkspace.indexOf('const commitRestingGenerationBarGeometry = useCallback(');
const restingBarEnd = liteWorkspace.indexOf('const clearLiveExternalGeometry = useCallback(', restingBarStart);
assert.ok(restingBarStart > 0 && restingBarEnd > restingBarStart,
  'app446 missing narrow resting Generate bar handoff helper');
const restingBar = liteWorkspace.slice(restingBarStart, restingBarEnd);
assert.match(restingBar, /generationBarPerfMode !== 'normal'/,
  'keep frozen or off Generate-bar diagnostics inert');
assert.match(restingBar, /floatingActionBar\.dataset\.soridrawPlacement !== 'floating'/,
  'do not alter the inline or collapsed Generate owner');
assert.match(restingBar, /actionAnchor\.getBoundingClientRect\(\)/,
  'measure only the current, final Builder command anchor at release');
assert.match(restingBar, /getStudioActionFloatingGutter\(window\.innerWidth, modeRef\.current\.builder\)/,
  'release geometry must respect the existing compact and full gutter');
assert.match(restingBar, /resolveStudioActionFloatingGeometry\(rect\.left, rect\.width, gutter\)/,
  'release must use the same shared Generate-bar geometry math');
assert.match(restingBar, /rootStyle\.setProperty\('--soridraw-action-fixed-left'/,
  'commit resting left coordinate before clearing compositor variables');
assert.match(restingBar, /rootStyle\.setProperty\('--soridraw-action-fixed-width'/,
  'commit resting width before clearing compositor variables');
const endDragStart = liteWorkspace.indexOf('const finishDrag = useCallback(');
const endDragEnd = liteWorkspace.indexOf('const handlePointerMove = ', endDragStart);
assert.ok(endDragStart > 0 && endDragEnd > endDragStart, 'missing finishDrag block');
const endDrag = liteWorkspace.slice(endDragStart, endDragEnd);
const lastBuilderCommitOffset = endDrag.indexOf('commitRootMeasurements(builderWidth,');
const restingBarCommitOffset = endDrag.indexOf('commitRestingGenerationBarGeometry();', lastBuilderCommitOffset);
const liveClearOffset = endDrag.indexOf('clearLiveExternalGeometry();', restingBarCommitOffset);
const dragEndEventOffset = endDrag.indexOf("window.dispatchEvent(new CustomEvent('soridraw-split-drag-end'))", liveClearOffset);
assert.ok(lastBuilderCommitOffset >= 0
  && restingBarCommitOffset > lastBuilderCommitOffset
  && liveClearOffset > restingBarCommitOffset
  && dragEndEventOffset > liveClearOffset,
  'release must seed accurate resting geometry before removing live transforms and announcing drag end');
const hotPathStart = liteWorkspace.indexOf('const syncGenerationBarGeometry = useCallback(');
const hotPathEnd = liteWorkspace.indexOf('const syncExternalGeometry = useCallback(', hotPathStart);
assert.ok(hotPathStart > 0 && hotPathEnd > hotPathStart, 'missing existing live bar writer');
assert.doesNotMatch(liteWorkspace.slice(hotPathStart, hotPathEnd), /getBoundingClientRect|commitRestingGenerationBarGeometry/,
  'no extra measurements or release-only geometry in the per-frame drag writer');
console.log('VERIFY_446_GENERATE_BAR_RELEASE_GEOMETRY_HANDOFF=PASS');


// app447: when the Result is labelled mobile during a live split gesture,
// Music Note/Library three-tab strips must NEVER expand beyond their approved
// 480px track. A stale mobile mode previously overrode the Tailwind max cap to
// 100%, stretching every tab across the growing Result width and snapping back.
const tabsRuleStart = studioLayout.indexOf('/* 370/447:');
assert.ok(tabsRuleStart > 0, 'missing Music Note/Library split tab cap scope');
const tabsRuleEnd = studioLayout.indexOf('@media (max-width: 660px)', tabsRuleStart);
assert.ok(tabsRuleEnd > tabsRuleStart, 'missing safe end of split tab cap scope');
const tabsRule = studioLayout.slice(tabsRuleStart, tabsRuleEnd);
assert.match(tabsRule, /@media \(min-width: 1100px\)/,
  'split tab cap must not change phone/small-viewport layout');
assert.match(tabsRule, /\.soridraw-studio-result-pane\[data-pane-mode="mobile"\][\s\S]*?:is\(\.soridraw-musicnote-mode-tabs, \.soridraw-library-mode-tabs\) \{\s*width: 100% !important;\s*max-width: 480px !important;/,
  'mobile Result pane must cap BOTH mode-tab strips to 480px instead of full pane');
assert.doesNotMatch(tabsRule, /max-width: 100% !important/,
  'split mode tab cap must not be reset to the entire Result pane width');
for (const source of ['src/pages/FavoritesPage.tsx', 'src/pages/SunoLibraryPage.tsx']) {
  const page = readFileSync(source, 'utf8');
  assert.match(page, /mode-tabs grid grid-cols-3[^"\n]*w-full max-w-\[480px\]/,
    'preserve the existing three-button base 480px design: '+source);
}
console.log('VERIFY_447_NOTE_LIBRARY_TAB_STRETCH_CAP=PASS');
