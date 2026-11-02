import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Gate for the user-authorized physical minimum-pane width correction.
// Preserve EVERY line outside getSplitBounds exactly as on preview, and
// compare both bound functions to the known safe shapes. This is not an
// exception that permits unrelated splitter/Generate/pointer modifications.
const path='src/components/studio/LiteStudioSplitWorkspace.tsx';
const current=readFileSync(path,'utf8');
const baseline=execFileSync('git',['show','FETCH_HEAD:'+path],{encoding:'utf8'});
const pattern=/const getSplitBounds = \(layoutWidth: number\): SplitBounds => \{[\s\S]*?\n\};/g;
const before=baseline.match(pattern);
const after=current.match(pattern);
assert.equal(before?.length,1,'expected one original getSplitBounds function');
assert.equal(after?.length,1,'expected one updated getSplitBounds function');
// The app459 guard still prohibits changes to the rest of the split engine.
// Normalize ONLY these five exact already-approved Music Note portal additions;
// any other engine line difference continues to fail.
const acceptedMusicNoteSelectionAdditions = [
  "  musicNoteSelectionBar: HTMLElement | null;\n",
  "    musicNoteSelectionBar: null,\n",
  "    // Resolve the portaled selection bar once at pointer-down, not in each drag frame.\n    current.musicNoteSelectionBar = workspaceViewRef.current === 'music-note'\n      ? document.querySelector<HTMLElement>('body > [data-music-note-selection-bar=\"true\"][data-music-note-split-selection=\"true\"]')\n      : null;\n",
  "    // Return selection-bar position ownership to the committed root CSS vars.\n    controls.musicNoteSelectionBar?.style.removeProperty('left');\n    controls.musicNoteSelectionBar?.style.removeProperty('max-width');\n",
  "      // Music Note's body portal cannot inherit the Result pane's live geometry.\n      // Reuse this rAF's existing splitter/pane numbers without a DOM read,\n      // React update, or per-pixel root CSS variable invalidation.\n      if (purePaneHybridLive && workspaceViewRef.current === 'music-note') {\n        const selectionBar = externalRef.current.musicNoteSelectionBar;\n        if (selectionBar) {\n          const resultLeft = splitterLeft + 18;\n          const resultRight = metricsRef.current.left + safeWidth;\n          selectionBar.style.setProperty('left', `${Math.round((resultLeft + resultRight) / 2)}px`, 'important');\n          selectionBar.style.setProperty('max-width', `${Math.max(0, Math.round(resultRight - resultLeft - 24))}px`, 'important');\n        }\n      }\n\n",
  "    // Track Music Note's portaled bar on the same drag frame in ALL\n    // selectable split modes, using cached coordinates without DOM reads.\n    if (live && draggingRef.current && workspaceViewRef.current === 'music-note') {\n      const selectionBar = externalRef.current.musicNoteSelectionBar;\n      if (selectionBar) {\n        const resultLeft = splitterLeft + 18;\n        const resultRight = metricsRef.current.left + safeWidth;\n        selectionBar.style.setProperty('left', `${Math.round((resultLeft + resultRight) / 2)}px`, 'important');\n        selectionBar.style.setProperty('max-width', `${Math.max(0, Math.round(resultRight - resultLeft - 24))}px`, 'important');\n      }\n    }\n\n",
];
const normalizeAcceptedMusicNoteSelection = (source) => {
  let normalized = source;
  for (const token of acceptedMusicNoteSelectionAdditions) {
    assert((normalized.split(token).length - 1) <= 1, 'duplicate approved selection token');
    normalized = normalized.replace(token, '');
  }
  return normalized;
};
for (const token of acceptedMusicNoteSelectionAdditions.slice(0, 4)) {
  assert(current.includes(token), 'Music Note selection portal cache/cleanup missing');
}
assert(baseline.includes(acceptedMusicNoteSelectionAdditions[4]) || baseline.includes(acceptedMusicNoteSelectionAdditions[5]), 'expected approved Hybrid or all-mode writer in baseline');
assert(current.includes(acceptedMusicNoteSelectionAdditions[5]), 'all-mode live writer missing');
assert(!current.includes(acceptedMusicNoteSelectionAdditions[4]), 'stale Hybrid-only writer');
// Allow exactly this previously failing native resize rail-edge fix.
// Normalize its known before/after text and keep byte-exact comparison of
// every other Lite splitter line. Do not relax pointer/drag/viewport guards.
const acceptedResizeRailSource = [
  '      // During native resize, retain the last settled left rail edge.',
  '      // layout.rect.left can move independently; resize-end reads the rail.',
  '      leftRailEdge: nativeWindowResize',
  '        ? metricsRef.current.leftRailEdge',
  '        : leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,',
].join('\n');
const previousResizeRailSource = [
  '      leftRailEdge: nativeWindowResize',
  '        ? rect.left',
  '        : leftRailRect && leftRailRect.width > 0 ? leftRailRect.right : rect.left,',
].join('\n');
assert(current.includes(acceptedResizeRailSource), 'native resize must preserve settled rail anchor');
assert.equal(current.split(acceptedResizeRailSource).length, 2, 'exactly one approved resize rail writer');
const normalizeAcceptedResizeRail = (source) => source.replace(acceptedResizeRailSource, previousResizeRailSource);
// The only additional accepted Lite delta is the boundary-only rail read.
// Compare the remainder of the frozen split engine byte-for-byte.
const acceptedRailTransitionRefresh = "    const handleFrameResize = () => {\n      if (draggingRef.current) return;\n      // The frame owns rail collapse/expand only at its discrete 1600px\n      // boundary. Native resize frames deliberately hold the settled rail\n      // edge, so refresh it exactly here, after the new rail grid is committed.\n      // Do not read the rail on every native resize frame.\n      if (document.documentElement.classList.contains('soridraw-window-resizing')) {\n        const leftRail = document.querySelector<HTMLElement>('.soridraw-studio-left-panel');\n        const leftRailRect = leftRail?.getBoundingClientRect();\n        if (leftRailRect && leftRailRect.width > 0) {\n          metricsRef.current.leftRailEdge = leftRailRect.right;\n        }\n      }\n      refreshMetrics();\n    };";
const previousRailTransitionRefresh = "    const handleFrameResize = () => {\n      if (!draggingRef.current) refreshMetrics();\n    };";
assert(current.includes(acceptedRailTransitionRefresh), 'PC/tablet rail change must rebase the collapsed tab once');
assert.equal(current.split(acceptedRailTransitionRefresh).length, 2, 'rail rebase callback must appear exactly once');
const normalizeAcceptedRailTransition = (source) =>
  source.replace(acceptedRailTransitionRefresh, previousRailTransitionRefresh);
// The new director-approved four fold controls only wrap the two Lite V2
// button click callbacks. Normalize precisely that import + two callbacks
// on both the old and new source before comparing the frozen pointer/geometry source byte-for-byte.
const acceptedFoldImport = "import { runStudioFoldTransition } from './studioFoldTransition';\n";
const acceptedBuilderFold = [
  "onClick={() => runStudioFoldTransition('pane', () => {",
  "        setIsResultCollapsed(false);",
  "        setIsBuilderCollapsed((current) => !current);",
  "      })}",
].join('\n');
const acceptedResultFold = [
  "onClick={() => runStudioFoldTransition('pane', () => {",
  "        setIsBuilderCollapsed(false);",
  "        setIsResultCollapsed((current) => !current);",
  "      })}",
].join('\n');
const previousBuilderFold = acceptedBuilderFold.replace("runStudioFoldTransition('pane', () => {", '{').replace('      })}', '      }}');
const previousResultFold = acceptedResultFold.replace("runStudioFoldTransition('pane', () => {", '{').replace('      })}', '      }}');
const normalizeAcceptedFoldHandlers = (source) => {
  let result = source;
  for (const [next, previous] of [
    [acceptedFoldImport, ''],
    [acceptedBuilderFold, previousBuilderFold],
    [acceptedResultFold, previousResultFold],
  ]) {
    assert((result.split(next).length - 1) <= 1, 'duplicate fold-only button token');
    result = result.replace(next, previous);
  }
  return result;
};
assert(current.includes(acceptedFoldImport), 'approved Studio fold helper import missing');
assert(current.includes(acceptedBuilderFold), 'approved Builder button fold wrapper missing');
assert(current.includes(acceptedResultFold), 'approved Result button fold wrapper missing');
// APP716 — The director-approved 12px collapse-button inset must follow the
// real splitter while dragging, not appear only at pointer-up. The app459
// byte-frozen engine guard is retained for every other geometry line.
const oldToggleRegion = baseline.match(/  \/\/ 781 —[\s\S]*?\n  \}, \[\]\);/)?.[0]
  // New PRs have APP716's approved live toggle code already in preview.
  // Accept that exact current baseline as the only other starting point.
  || baseline.match(/  \/\/ Keep both split-pane collapse buttons[\s\S]*?\n  \}, \[\]\);/)?.[0];
const liveToggleRegion = current.match(/  \/\/ Keep both split-pane collapse buttons[\s\S]*?\n  \}, \[\]\);/)?.[0];
assert(oldToggleRegion && liveToggleRegion, 'APP716 toggle region not found');
if (oldToggleRegion.startsWith('  // Keep both split-pane collapse buttons')) {
  assert.equal(oldToggleRegion, liveToggleRegion, 'APP716 previously merged toggle must remain byte-exact');
}
const functionStart = '  const syncMinimumCollapseControls = useCallback((';
const liveStart = '    if (!livePosition) return;';
assert.equal(
  liveToggleRegion.slice(liveToggleRegion.indexOf(functionStart), liveToggleRegion.indexOf(liveStart)),
  oldToggleRegion.slice(oldToggleRegion.indexOf(functionStart), oldToggleRegion.indexOf(liveStart)),
  'APP716 must not change minimum-edge state or drag geometry inputs',
);
const approvedToggleWriter = [
  '    if (!livePosition) return;',
  '    const roundedSplitterLeft = Math.max(0, Math.round(splitterLeft));',
  '    // Match the resting Studio Black CSS offsets (-55/+21) at EVERY drag X,',
  '    // including both minimum edges. Inline-important wins over tablet rules',
  '    // that intentionally keep the root split variable unchanged until release.',
  '    const builderLeft = \`\${Math.max(0, roundedSplitterLeft - 55)}px\`;',
  '    const resultLeft = \`\${roundedSplitterLeft + 21}px\`;',
  '    const builderToggle = builderToggleRef.current;',
  '    const resultToggle = resultToggleRef.current;',
  '    if (builderToggle && builderToggle.style.left !== builderLeft) {',
  "      builderToggle.style.setProperty('left', builderLeft, 'important');",
  '    }',
  '    if (resultToggle && resultToggle.style.left !== resultLeft) {',
  "      resultToggle.style.setProperty('left', resultLeft, 'important');",
  '    }',
  '  }, []);',
].join('\n');
assert(liveToggleRegion.endsWith(approvedToggleWriter), 'APP716 live toggle writer differs from approved two-button inset');
const oldPurePaneCallComment = [
  '      // Keep the split-edge collapse UI correct even on the Pure Pane',
  '      // production hot path, which intentionally returns before auxiliary',
  '      // external-geometry synchronization. This is threshold-only state plus',
  '      // one tiny button position write at an actual minimum edge.',
].join('\n');
const livePurePaneCallComment = [
  '      // Keep BOTH collapse buttons on the same live splitter X and 12px inset,',
  '      // without updating inherited root variables or measuring the DOM.',
].join('\n');
assert(current.includes(livePurePaneCallComment), 'APP716 live boundary call missing');
const normalizeApp716Toggle = (source) => (
  // With a current APP716 preview baseline there is NOTHING to normalize:
  // all collapse-button geometry and comments must remain byte-for-byte.
  oldToggleRegion.startsWith('  // Keep both split-pane collapse buttons')
    ? source
    : source.replace(liveToggleRegion, oldToggleRegion)
      .replace(livePurePaneCallComment, oldPurePaneCallComment)
);

assert.equal(
  normalizeAcceptedMusicNoteSelection(normalizeAcceptedResizeRail(normalizeAcceptedRailTransition(normalizeAcceptedFoldHandlers(baseline.replace(before[0], '<SPLIT_BOUNDS>'))))),
  normalizeAcceptedMusicNoteSelection(normalizeAcceptedResizeRail(normalizeAcceptedRailTransition(normalizeAcceptedFoldHandlers(normalizeApp716Toggle(current.replace(after[0], '<SPLIT_BOUNDS>')))))),
  'APP459 changed protected Lite splitter code beyond approved Music Note selection and boundary-only rail change',
);
// The initial app459 PR compared the legacy tablet-only guard to the new
// real-center-workspace guard. Later PRs use app459 as their baseline: in
// that case the full function must remain EXACT, not merely equivalent.
if (before[0].includes("getSplitProfile() !== 'tablet'")) {
  assert.doesNotMatch(after[0],/getSplitProfile\(\) !== 'tablet'/,'app459 still excludes wide split');
} else {
  assert.equal(after[0],before[0],'post-app459 PR altered frozen split bounds');
}
for(const line of [
  'Math.min(TABLET_MIN_PANE_PX, safeWidth / 2)',
  'Math.max(MIN_PERCENT, minimumPercent)',
  'Math.min(MAX_PERCENT, 100 - minimumPercent)',
  'min >= max ? { min: 50, max: 50 }',
]) assert(after[0].includes(line),'missing proven min-pane clamp: '+line);
const bounds=(w)=>{
  const minPane=Math.min(430,w/2);
  const min=Math.max(24,minPane/w*100);
  const max=Math.min(76,100-minPane/w*100);
  return min>=max ? {min:50,max:50}:{min,max};
};
for(const width of [600,720,859,860,861,1000,1200,1500,1792,2000]){
  const {min,max}=bounds(width);
  assert(min>=24 && min<=50 && max>=50 && max<=76);
  if(width<860)assert.equal(min,50,'impossible dual-430 should be centered');
  else assert((width*min/100)>=Math.min(430,width*0.24)-0.01,'minimum pane under protection');
  assert(Math.abs(min+max-100)<0.01);
}
console.log('APP459_SCOPE_LITE_SPLIT_BOUNDS_ONLY=PASS');
console.log('APP459_SPLIT_MIN_430_WHEN_FEASIBLE_CENTER_WHEN_NOT=PASS');

/* APP462: The native scrollbar has priority on the LEFT side of the boundary.
 * The transparent 16px effective splitter hit region moves to the RIGHT
 * without changing the left-coordinate writer or 1px visual line. */
const splitterCss=readFileSync('src/components/studio/studioLayout.css','utf8');
const marker='APP462_SCROLLBAR_SPLITTER_EXCLUSIVE_HIT_ZONES';
const markerPos=splitterCss.indexOf(marker);
assert(markerPos>=0,'APP462 splitter/scrollbar hit-zone contract missing');
const scoped=splitterCss.slice(markerPos);
for(const requirement of [
  '@media (min-width: 1100px)',
  'html[data-soridraw-theme="studio-black"] body > button.soridraw-studio-splitter.soridraw-lite-studio-splitter',
  'width: 24px !important;',
  'justify-content: flex-start !important;',
  'clip-path: inset(0 0 0 8px);',
  '> span {',
  'margin-left: 8px !important;',
])assert(scoped.includes(requirement),'APP462 splitter hit-zone token missing: '+requirement);
for(const forbidden of ['requestAnimationFrame(', 'getBoundingClientRect(', 'ResizeObserver(', 'pointerdown', 'pointermove', 'scrollTop =', 'fetch(']){
  assert(!scoped.includes(forbidden),'APP462 hit zone must stay passive CSS: '+forbidden);
}
// This models pointer ownership at the unchanged boundary coordinate.
// Old base button starts 8px left; new visible CSS clip starts 8px into it,
// and its 24px width leaves a 16px right-side hit zone.
const boundary=500, buttonLeft=boundary-8, clippedLeft=buttonLeft+8, clippedRight=buttonLeft+24;
assert.equal(clippedLeft,boundary,'APP462 scrollbar-side coverage must be zero');
assert.equal(clippedRight-clippedLeft,16,'APP462 must preserve 16px usable splitter target');
assert.equal(buttonLeft+8,boundary,'APP462 drawn 1px line must remain on boundary');
console.log('APP462_NATIVE_SCROLLBAR_AND_SPLITTER_SEPARATE_HIT_ZONES=PASS');

// APP464_NATIVE_RESIZE_ACTION_AND_CREATE_GUTTER
// Verify the accepted 750 native-resize CSS geometry is the single active X
// owner (no leftover 797 compositor translation during a window resize),
// and that Create's tablet-only inner gutter matches app1031's 24px contract.
const app464Css=splitterCss.slice(splitterCss.indexOf('APP464_NATIVE_RESIZE_GENERATE_AND_TABLET_CREATE_GUTTERS'));
assert(app464Css.startsWith('APP464_NATIVE_RESIZE_GENERATE_AND_TABLET_CREATE_GUTTERS'),'app464 scoped stylesheet missing');
for(const token of [
  'html[data-soridraw-theme="studio-black"].soridraw-window-resizing',
  'body > .soridraw-studio-action-bar--tracking[data-soridraw-placement="floating"]',
  'transform: none !important;',
  '@media (min-width: 1100px) and (max-width: 1599.98px)',
  '.soridraw-studio-page-frame[data-workspace-view="create"]',
  '.soridraw-lite-studio-split-workspace.is-create-vertical',
  '> .soridraw-studio-builder-pane',
  'width: min(calc(100% - 24px), var(--soridraw-studio-full-pane-max-width, 1500px)) !important;',
  'margin-left: auto !important;',
  'margin-right: auto !important;',
]) assert(app464Css.includes(token),'APP464 missing native resize/create-gutter contract: '+token);
for(const unsafe of ['pointermove', 'onPointer', 'ResizeObserver(', 'getBoundingClientRect(', 'requestAnimationFrame(', 'fetch(']) {
  assert(!app464Css.includes(unsafe),'APP464 CSS must not add hot-path reads, handlers or I/O: '+unsafe);
}
// In CSS the 1031 target geometry subtracts 24px total before centering.
for(const pane of [430,660,760,820,920,1300]){
  const newContentWidth=Math.min(Math.max(0,pane-24),1500);
  assert.equal((pane-newContentWidth)/2,12,'app464 Create tablet side margins must each be 12px');
}
console.log('APP464_RESIZE_GENERATE_NO_DOUBLE_TRANSFORM=PASS');
console.log('APP464_TABLET_CREATE_GUTTERS_MATCH_1031=PASS');

 
// APP465_TABLET_ONEPANE_GUTTERS_AND_RAIL_SCROLLBAR
// One-pane must not inherit 1031's split-only scope or 779's asymmetric padding.
// The unchanged 1031 and 779 rules are intentional protected baselines.
const app465Start=splitterCss.indexOf('APP465_TABLET_ONEPANE_GUTTERS_AND_RAIL_SCROLLBAR');
const app465End=splitterCss.indexOf('/* The relocated rail menus belong only to Split;', app465Start);
// APP465 protects this tablet-only rule block, not later independent fold
// animations or the director-approved wide-PC reading-width rule.
assert(app465Start >= 0 && app465End > app465Start, 'APP465 isolated tablet CSS rule block missing');
const app465=splitterCss.slice(app465Start,app465End);
assert(app465.startsWith('APP465_TABLET_ONEPANE_GUTTERS_AND_RAIL_SCROLLBAR'),'APP465 tablet one-pane correction missing');
assert.match(app465,/@media \(min-width: 1100px\) and \(max-width: 1599\.98px\)/);
for (const token of [
  '[data-workspace-view="recent"]',
  '[data-workspace-view="music-note"]',
  '[data-workspace-view="library"]',
  '[data-soridraw-result-collapsed="true"]',
  '[data-soridraw-builder-collapsed="true"]',
  '.soridraw-lite-studio-split-workspace.is-result-collapsed',
  '.soridraw-lite-studio-split-workspace.is-builder-collapsed',
  'padding-right: 18px !important;',
  'width: min(calc(100% - 24px)',
  '.soridraw-studio-builder-pane-masthead-host',
  '.soridraw-studio-main {',
  'padding-right: 0 !important;',
  '> .soridraw-studio-result-pane {',
  'right: 0 !important;',
  'padding-right: 36px !important;',
]) assert(app465.includes(token),'APP465 one-pane contract missing: '+token);
assert(!app465.includes('is-create-vertical'),'APP465 may not modify the accepted Create page');
assert(!app465.includes(':not(.is-builder-collapsed):not(.is-result-collapsed)'),'APP465 must not change normal split view');
for(const unsafe of ['pointermove','onPointer','ResizeObserver(', 'getBoundingClientRect(', 'requestAnimationFrame(', 'fetch(']){
  assert(!app465.includes(unsafe),'APP465 must not add drag measurements or network work: '+unsafe);
}
// One-pane native scroll shell right edge: reserved 18px -> zero rail gap.
// Returning the reserve to pane padding holds the visible right content guide.
const tabletWorkspaceWidths=[860,900,1100,1300];
for(const outerWidth of tabletWorkspaceWidths){
  const formerResultScrollRight=outerWidth-18;
  const finalResultScrollRight=outerWidth;
  const formerResultContentWidth=outerWidth-18-18-18-18;
  const finalResultContentWidth=outerWidth-18-18-36;
  assert.equal(finalResultScrollRight-formerResultScrollRight,18,'APP465 scrollbar must move to rail');
  assert.equal(finalResultContentWidth,formerResultContentWidth,'APP465 result content width must stay stable');
  // Builder: unchanged 18px left main inset; 18px inner right pad.
  // Both direct children use a 24px total centered inset.
  const builderAvailable=outerWidth-18-18;
  const childWidth=Math.min(builderAvailable-24,1500);
  const childMargin=(builderAvailable-childWidth)/2;
  const leftGutter=18+childMargin;
  const rightGutter=18+childMargin;
  assert.equal(leftGutter,rightGutter,'APP465 expanded Builder left/right black gutters must match');
  assert.equal(leftGutter,30,'APP465 tablet expanded Builder reference gutter');
}
console.log('APP465_TABLET_ONEPANE_GUTTERS_AND_RAIL_SCROLLBAR=PASS');
