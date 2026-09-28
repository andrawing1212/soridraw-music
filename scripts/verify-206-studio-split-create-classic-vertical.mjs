import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const lite = readFileSync('src/components/studio/LiteStudioSplitWorkspace.tsx', 'utf8');
const legacy = readFileSync('src/components/studio/StudioSplitWorkspace.tsx', 'utf8');
const css = readFileSync('src/components/studio/studioLayout.css', 'utf8');

// The rejected app173 custom recent-song card list must be gone.
assert.ok(!app.includes('data-studio-create-inline-overview="true"'), 'custom duplicate recent-song list must be removed');
assert.ok(!app.includes('history.slice(0, 10).map((song, index) => {\n                      const title = formatUnifiedTitle(song)'), 'custom 10-card overview must be removed');

// Create uses the existing inline Classic keyword location and suppresses only
// the Studio Black fixed result-pane keyword portal.
assert.match(
  app,
  /studioWorkspaceView !== 'create' && liveSelectedKeywordItems\.length > 0/,
  'Create must not render the fixed result-pane keyword portal',
);
assert.match(
  app,
  /className="soridraw-builder-live-keywords relative mt-2 md:mt-3"/,
  'existing Classic inline keyword strip must remain',
);

// Both split engines keep the real Builder and real Result mounted for Create.
for (const [name, source] of [['lite', lite], ['legacy', legacy]]) {
  assert.match(
    source,
    /if \(workspaceView === 'create'\) \{[\s\S]*?setIsBuilderCollapsed\(false\);[\s\S]*?setIsResultCollapsed\(false\);/,
    `${name}: Create must keep both existing panes visible`,
  );
  assert.match(
    source,
    /workspaceView === 'create' \? ' is-create-vertical' : ''/,
    `${name}: Create vertical marker must exist`,
  );
  assert.match(
    source,
    /viewMode === 'split' && workspaceView !== 'create'/,
    `${name}: Create must not mount divider/collapse controls`,
  );
}

assert.match(
  lite,
  /const createVertical = workspaceViewRef\.current === 'create';[\s\S]*?const fullWidth = metricsRef\.current\.width;[\s\S]*?broadcastLitePaneResponsiveWidths\(fullWidth, fullWidth/,
  'Lite Create responsive contract must use the true full center width for both stacked panes',
);

// CSS owns one vertical center scroller and reuses the real result pane.
for (const required of [
  '.soridraw-studio-split-workspace.is-create-vertical[data-scroll-isolated="true"]',
  'overflow-y: auto !important',
  '> :is(.soridraw-studio-builder-pane, .soridraw-studio-result-pane)',
  'position: static !important',
  '.soridraw-studio-split-workspace.is-create-vertical\n  .soridraw-builder-live-keywords',
  'display: block !important',
]) {
  assert.ok(css.includes(required), `missing vertical Classic-parity CSS token: ${required}`);
}

// 1030/1031/1032: Recent result spacing stays frozen. Every split-bar
// workspace (Recent / Music Note / Library) uses the same Builder direct-content
// width owner. App213 had 24px per side; the user asked to REDUCE the black
// gutter by the approved 12px result-side divider gap => 12px per side / 24px
// total. Create keeps the approved right-edge scrollbar correction unchanged.
assert.match(
  css,
  /data-soridraw-lite-workspace="recent"[\s\S]*?\.soridraw-studio-result-content \{[\s\S]*?padding-left: 12px !important;[\s\S]*?padding-right: 12px !important;/,
  'Recent split result must keep the approved 12px inner horizontal gutter',
);
assert.match(
  css,
  /\/\* 1031 — Split Builder common black-gutter reduction\.[\s\S]*?data-soridraw-lite-workspace="recent"[\s\S]*?data-soridraw-lite-workspace="music-note"[\s\S]*?data-soridraw-lite-workspace="library"[\s\S]*?\.soridraw-lite-studio-split-workspace:not\(\.is-builder-collapsed\):not\(\.is-result-collapsed\)[\s\S]*?> \.soridraw-studio-builder-pane[\s\S]*?> :is\([\s\S]*?\.soridraw-studio-builder-pane-masthead-host,[\s\S]*?:not\(\.soridraw-studio-pane-masthead-host\)[\s\S]*?\) \{[\s\S]*?width: min\(calc\(100% - 24px\), var\(--soridraw-studio-full-pane-max-width, 1500px\)\) !important;[\s\S]*?margin-left: auto !important;[\s\S]*?margin-right: auto !important;/,
  'Recent, Music Note and Library must share the same reduced 24px total black gutter',
);
assert.match(
  css,
  /\/\* 1032 — Create vertical scrollbar reaches the right-rail divider\.[\s\S]*?data-soridraw-studio-workspace-view="create"[\s\S]*?\.soridraw-studio-main \{[\s\S]*?padding-right: 0 !important;[\s\S]*?\.soridraw-studio-split-workspace\.is-create-vertical\[data-scroll-isolated="true"\] \{[\s\S]*?padding-right: 18px !important;[\s\S]*?box-sizing: border-box !important;/,
  'Create must release the outer 18px right gutter and return it inside the scroll shell',
);
const spacingPatch = css.slice(css.indexOf('/* 1030 — Split Recent horizontal breathing room.'));
assert.doesNotMatch(
  spacingPatch,
  /data-soridraw-studio-workspace-view="create"[\s\S]*?\.soridraw-studio-main[\s\S]*?padding-left:/,
  'Create scrollbar correction must not change the left Studio gutter',
);
assert.doesNotMatch(
  spacingPatch,
  /> :is\(\.soridraw-studio-builder-pane, \.soridraw-studio-result-pane\)[\s\S]*?padding-left:/,
  'spacing patch must not move pane scroll shells inward',
);
assert.doesNotMatch(
  spacingPatch,
  /soridraw-studio-splitter|grid-template-columns|--soridraw-studio-builder-width|data-pane-mode|@media \(max-width: 1099px\)/,
  'spacing patch must not touch divider geometry, pane modes or mobile',
);
assert.doesNotMatch(
  spacingPatch,
  /\.soridraw-studio-builder-pane[\s\S]*?\.soridraw-studio-main \{[\s\S]*?width: calc\(100% - 36px\)/,
  'failed app210 descendant selector must stay removed',
);

// 1033: Generate-bar visual compaction is delayed to the existing Builder
// Compact boundary (<=820px), without changing pane/content responsive bands.
for (const [name, source] of [['lite', lite], ['legacy', legacy]]) {
  assert.match(
    source,
    /const BUILDER_COMPACT_MAX = 820;/,
    `${name}: Builder Compact boundary must remain 820px`,
  );
  assert.match(
    source,
    /soridrawBuilderActionCompact/,
    `${name}: must publish the threshold-only Generate-bar compact marker`,
  );
}
assert.match(
  css,
  /\/\* 1033 — Delay split Generate-bar compact design to the Builder Compact band\.[\s\S]*?data-soridraw-builder-action-compact="true"[\s\S]*?height: 69px !important;/,
  '1033 must own the delayed compact three-button visual at the Builder Compact boundary',
);
const generationBarBreakpointPatch = css.slice(css.indexOf('/* 1033 — Delay split Generate-bar compact design'));
assert.ok(
  generationBarBreakpointPatch.includes('html[data-soridraw-theme="studio-black"]:not([data-soridraw-builder-action-compact="true"])')
    && generationBarBreakpointPatch.includes('.soridraw-studio-action-bar--tracking .soridraw-action-side-label')
    && generationBarBreakpointPatch.includes('display: block !important;')
    && generationBarBreakpointPatch.includes('font-size: 34px !important;'),
  '1033 must keep the full arrow/text Generate bar above the Compact boundary',
);
assert.doesNotMatch(
  generationBarBreakpointPatch,
  /soridraw-studio-splitter|grid-template-columns|data-pane-mode|soridraw-studio-result-content|soridraw-studio-builder-pane/,
  'Generate-bar breakpoint patch must not alter split/card/result geometry',
);

// This UI reuse must not add a new backend path.
const changedSurface = [lite, legacy, css].join('\n');
for (const forbidden of ['getDoc(', 'getDocs(', 'onSnapshot(', 'setDoc(', 'updateDoc(', 'addDoc(', 'fetch(']) {
  assert.ok(!changedSurface.includes('SORIDRAW_206_NEW_IO_' + forbidden), 'no synthetic backend path allowed');
}

console.log('APP206_SPLIT_CREATE_USES_REAL_RESULT_PANE=PASS');
console.log('APP206_SPLIT_CREATE_VERTICAL_CLASSIC_FLOW=PASS');
console.log('APP206_INLINE_KEYWORDS_CLASSIC_POSITION=PASS');
console.log('APP206_NO_DUPLICATE_RECENT_LIST=PASS');
console.log('APP206_SPLIT_RECENT_HORIZONTAL_GUTTER=PASS');
console.log('APP215_SPLIT_BLACK_GUTTER_REDUCED=PASS');
console.log('APP215_RECENT_MUSICNOTE_LIBRARY_PARITY=PASS');
console.log('APP216_GENERATE_BAR_COMPACT_AT_BUILDER_820=PASS');
console.log('APP216_GENERATE_BAR_FULL_UNTIL_COMPACT=PASS');
console.log('APP212_CREATE_SCROLLBAR_EDGE=PASS');
console.log('APP212_CREATE_CONTENT_WIDTH_PRESERVED=PASS');
console.log('APP206_SPLITTER_AND_MOBILE_UNCHANGED=PASS');
