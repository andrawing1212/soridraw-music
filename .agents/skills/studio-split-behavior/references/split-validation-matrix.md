# SORIDRAW split validation matrix

Use this after any change to the Studio split bar, pane geometry, responsive transitions, collapse controls, generation bar, long-list drag performance, or external resize interaction.

A static CI pass is not enough for a feel/drag issue.

## A. Source-scope check

PASS only if:
- the changed files match the stated split problem;
- unrelated likes, Explore data, profile, Music Note persistence, Library data, Worker, Functions, Rules, and user-data code are untouched unless explicitly required;
- no new page-specific split engine was introduced;
- no duplicate geometry owner was added.

## B. Divider identity

Check:
- 16px pointer hit area still works comfortably;
- visible line stays 1px;
- hover/drag only changes brightness;
- no yellow state, shortened line, scale, transform, or click-length change appears;
- cursor stays horizontal-resize.

FAIL if the line's visual motion and the real pane boundary disagree.

## C. Fast drag

On PC fine pointer:
1. move divider quickly left-right-left several times;
2. reverse direction abruptly;
3. release at several positions.

PASS:
- no old-position catch-up trail;
- divider and panes move together;
- no accumulating delay;
- no release snap.

## D. Slow drag / exact boundary crossing

Move slowly through each boundary in both directions.

### Builder
- around 660px: mobile handoff;
- around 820px: compact/desktop composition handoff;
- around 1080px: tablet/PC content handoff where applicable.

PASS:
- visible composition changes on the expected side of the boundary;
- no repeated flicker/chatter;
- release does not change to a different layout than the live frame.

### Result
For Recent / Music Note / Library:
- verify the 661px mobile boundary.

For Create:
- verify its current separate Result boundary from source; do not assume 661px.

## E. External viewport routing

Resize the browser across 1100px separately from internal divider drag.

PASS:
- >=1100px uses the split layout path as designed;
- below the compact threshold the compact mobile workspace takes ownership where configured;
- no divider/rail geometry leaks into compact mobile;
- returning above the threshold restores the saved split state cleanly.

Do not treat browser resize and splitter drag as the same event path.

## F. Tablet split profile

At external widths from 1100–1599px:
- drag to both extremes;
- confirm both panes retain the safe minimum where geometry allows;
- confirm the divider cannot collapse a pane below the intended safe bound except through the explicit collapse action;
- confirm tablet and wide saved percentages do not overwrite each other.

PASS target:
- safe minimum pane contract remains 430px;
- normal bounds remain 24%–76% unless tablet safety narrows them.

## G. Minimum-edge collapse controls

Drag to left minimum and right minimum.

PASS:
- only the correct minimum control is shown/positioned;
- it follows the live splitter;
- crossing to the opposite minimum does not leave the previous button stranded;
- collapse and restore return to correct resting positions;
- no pointer-up jump.

## H. Generation bar

While dragging:
- watch its horizontal position;
- cross Builder responsive boundaries;
- release.

PASS:
- follows the Builder in the same visible frame;
- composition changes when required;
- does not wait until pointer-up;
- no release jump;
- no obvious width thrash/flicker.

## I. Scroll preservation

Test Builder and Result panes at:
1. top;
2. middle;
3. bottom.

Perform repeated horizontal drags and releases.

PASS:
- top stays top;
- bottom stays bottom;
- middle keeps the same reading position;
- Library/Music Note do not creep downward;
- no oscillation at release.

## J. Long-list pages

Required when split hot-path code or containment CSS changes.

### Music Note
- use a realistically long list;
- fast drag;
- slow boundary drag;
- pointer-up;
- scroll middle then repeat.

### Library
- playlist rows and workspace track rows;
- same tests.

PASS:
- visible rows continue to track the pane;
- no blank visible region caused by over-broad containment;
- no popup/menu clipping introduced;
- no major new jank compared with the current PREVIEW baseline.

## K. Page round-trip

Test:
- Recent -> Music Note -> Library -> Recent;
- include Create if the change touches shared engine routing;
- drag on each applicable split page.

PASS:
- one page does not inherit another page's stale inline geometry;
- generation bar/search/collapse controls use the current page's geometry;
- no pointer-up residue remains after page change.

## L. Touch / pen / Galaxy Tab

Required when changing:
- tablet fast-path;
- pointer type handling;
- pane containment;
- responsive thresholds;
- direct geometry.

Check touch and S Pen if available.

PASS:
- same real boundary principle;
- no accidental vertical scroll while dragging;
- no touch-only stale responsive state;
- no PC-only optimization that breaks tablet.

If no physical device is available, report this item as **unverified**, not PASS.

## M. External window resize

Resize the browser continuously without touching the splitter.

PASS:
- no one-frame pane/divider mismatch;
- resize-end resting reconciliation is correct;
- split drag still works normally afterward.

This path is separate from splitter drag and must be tested separately.

## N. Diagnostics isolation

Normal user path:
- no split PERF panel;
- no benchmark observer;
- no manual drag instrumentation.

MASTER explicit diagnostics:
- can still run the existing diagnostic/benchmark path when requested.

FAIL if instrumentation becomes part of ordinary drag cost.

## O. Static verification

For a code change:
- TypeScript PASS;
- Build PASS;
- relevant split verifier/tests PASS;
- no unrelated product regression;
- no unintended backend deployment;
- TEST/PRODUCTION unchanged unless promotion was explicitly requested.

## P. Real-hand acceptance

A split feel/performance change is complete only after PREVIEW hand use confirms the intended behavior.

Classify final status as:
- **PASS** — static checks + required real-hand checks passed;
- **PARTIAL** — code/static checks passed but a required device/path is unverified;
- **FAIL** — visible regression, release snap, scroll drift, stale responsive state, or meaningful performance regression remains.

Do not convert PARTIAL into PASS by wording.
