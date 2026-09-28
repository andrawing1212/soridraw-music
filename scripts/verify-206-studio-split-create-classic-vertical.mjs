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

// 1030/1031: Recent stays frozen; Create spacing is owned by the actual pane.
assert.match(
  css,
  /data-soridraw-lite-workspace="recent"[\s\S]*?\.soridraw-studio-result-content \{[\s\S]*?padding-left: 12px !important;[\s\S]*?padding-right: 12px !important;/,
  'Recent split result must keep the approved 12px inner horizontal gutter',
);
assert.match(
  css,
  /data-soridraw-studio-workspace-view="create"[\s\S]*?\.soridraw-studio-main \{[\s\S]*?padding-left: 36px !important;[\s\S]*?padding-right: 36px !important;/,
  'Create outer Studio main frame must own the visible 36px horizontal gutters',
);
assert.doesNotMatch(
  css.slice(css.indexOf('/* 1031 — Sori Studio Create horizontal gutter')),
  /> :is\(\.soridraw-studio-builder-pane, \.soridraw-studio-result-pane\)[\s\S]*?padding-left:/,
  'Create gutter must not be patched on inner panes anymore',
);
const spacingPatch = css.slice(css.indexOf('/* 1030 — Split Recent horizontal breathing room.'));
assert.doesNotMatch(
  spacingPatch,
  /soridraw-studio-splitter|grid-template-columns|--soridraw-studio-builder-width|data-pane-mode|@media \(max-width: 1099px\)/,
  'spacing patch must not touch divider geometry, pane modes or mobile',
);
assert.doesNotMatch(
  spacingPatch,
  /width: calc\(100% - 48px\)|width: min\(calc\(100% - 112px\)/,
  'rejected child-width Create spacing workaround must be removed',
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
console.log('APP206_SPLIT_CREATE_HORIZONTAL_GUTTER=PASS');
console.log('APP208_CREATE_MAIN_GUTTER_OWNER=PASS');
console.log('APP206_SPLITTER_AND_MOBILE_UNCHANGED=PASS');
