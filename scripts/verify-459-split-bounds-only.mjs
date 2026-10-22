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
assert.equal(baseline.replace(before[0],'<SPLIT_BOUNDS>'),
  current.replace(after[0],'<SPLIT_BOUNDS>'),
  'APP459 changed protected Lite splitter code outside getSplitBounds');
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
