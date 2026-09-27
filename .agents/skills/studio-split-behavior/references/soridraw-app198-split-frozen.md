# SORIDRAW current split baseline — PREVIEW app198 era

## Status

This reference freezes the current **split behavior**, not the unrelated app198 Explore divider change.

- Current PREVIEW app: 198.
- app198 release source: `1f9018b287a8cd1d07f7b255e243c2a042f6d7c4`.
- The user supplied a 2026-09-28 KST video as the visual reference for how the Studio split bar currently behaves.
- The current request is to preserve that behavior as a reusable development skill.
- This is a protection/reference document, not an instruction to redeploy or rewrite the split engine.

## Exact current source blobs

These PREVIEW blob SHAs define the source baseline used to write this skill:

| File | Blob SHA | Role |
|---|---|---|
| `src/App.tsx` | `abe4628b96e1baef19b3d6439d643c14b2451b27` | engine/runtime profile selection and app integration |
| `src/components/studio/LiteStudioSplitWorkspace.tsx` | `a6e1b19f8325afc882989d79ec25d51377ec9584` | Lite V2 drag lifecycle, geometry, responsive boundaries, scroll, collapse controls, generation bar |
| `src/components/studio/StudioSplitEngineWorkspace.tsx` | `d85f11cafb08d94c99eec1212e42096e0d79622a` | Lite / Legacy / Compact Mobile routing |
| `src/components/studio/liteSplitWorkspace.css` | `ae686386fdc7fc7cd440ba86834eaa27e20e7fbf` | Lite V2 divider skin, drag isolation, list containment |
| `src/components/studio/studioLayout.css` | `c3696d28668a8099df246cf25838508ce84b7e84` | Studio Black shared layout, pane-responsive UI, tablet fast-path, visual contracts |
| `src/components/studio/splitPerfDiagnostics.ts` | `49282b29ba6b193fe0db9cc31f8518f56bc32ab1` | MASTER-only performance diagnostics |

If any SHA changes, inspect the diff before assuming this frozen description is still exact.

## Current engine contract

`StudioSplitEngineWorkspace` currently:
- defaults to Lite when the caller selects Lite;
- defaults `v2DragPerfMode` to `pure-pane-hybrid`;
- routes split view to `StudioCompactMobileWorkspace` when compact mobile mode is active;
- keeps Legacy as an explicit alternate path.

The current production drag design in `LiteStudioSplitWorkspace` is **Pure Pane Hybrid**:
- real pane geometry and the real divider share one rAF frame;
- expensive root/global synchronization is not performed for every pixel;
- responsive composition work is limited to visible boundary changes that must happen live;
- generation-bar geometry is kept live using the already-known Builder width.

## Geometry constants

Current source values:
- default split: 50%;
- normal min/max: 24% / 76%;
- tablet external viewport: 1100–1599px;
- tablet safe minimum pane: 430px;
- Builder mobile breakpoint: 660px;
- Builder compact max: 820px;
- content mobile max: 660px;
- content tablet max: 1080px;
- Result mobile breakpoint: 680px in the general path;
- Result content mobile breakpoint: 661px for Recent / Music Note / Library;
- pane mode hysteresis exists for the older/general mode resolver, but Pure Pane Hybrid's live composition signature is boundary-driven.

Do not merge these into one arbitrary breakpoint. They represent different contracts.

## Current pointer flow

### Start

At pointer-down, the engine may read resting geometry once:
- workspace;
- left rail;
- Builder/Result rects;
- Result resting right edge;
- action/generation-bar anchor geometry.

It captures scroll-lock state, disables competing resting observers, sets pointer capture, then marks Lite dragging.

### Move

Pointermove itself stores `clientX` and schedules one rAF.

The rAF flush:
1. consumes the newest X;
2. clamps it to the current split bounds;
3. ignores a pixel position that is unchanged;
4. converts the pixel to a percent;
5. calls the live split application once.

There is no queue that replays old pointer positions.

### Live Pure Pane Hybrid

The live frame directly owns the visible boundary:
- Builder width;
- Result left/right boundary;
- splitter position.

The path reuses the widths it already calculated.

For the current hybrid path:
- tablet-band fast-path state is based on the current pane width;
- Builder compact/mobile composition changes are handled at their actual boundaries;
- Result mode changes use the applicable Result boundary;
- generation bar receives a minimal live geometry update;
- minimum-edge collapse controls follow the real boundary.

### Release

Pointer-up:
- flushes the latest pending point;
- removes drag markers;
- removes temporary direct geometry;
- performs one deferred reconciliation;
- commits the final root measurements;
- clears live external geometry so resting ownership resumes;
- restores scroll once;
- reconnects the resting observer;
- stores the split percentage.

This separation between **live local geometry** and **one release reconciliation** is a core invariant.

## Scroll invariant

Horizontal split drag does not own vertical scrolling.

The engine records each pane as:
- top,
- bottom,
- or a middle `scrollTop`.

After drag it preserves that same meaning. Repeated horizontal drags must not slowly push Library/Music Note downward or make them oscillate vertically.

## Divider visual invariant

From `liteSplitWorkspace.css`:
- actual pointer hit width is 16px;
- visual line is 1px;
- line extends the split workspace height;
- hover/drag only raises line brightness;
- no transform/scale/radius/width animation is used;
- cursor remains `ew-resize`.

The current visual baseline should not be replaced by a thicker, shorter, colored, or animated divider unless the user asks for a design change.

## Long-list performance invariant

During active Lite drag, current CSS can use:
- `content-visibility:auto`;
- intrinsic-size hints;
- `contain: layout style paint`;
- transition/animation suppression on specified heavy rows/cards.

This is intended to reduce off-screen work while keeping visible responsive layout real.

Do not replace it with a fake divider-only animation or DOM swapping that makes the line smooth but the actual pane late.

## Generation-bar invariant

Current code keeps the generation bar on the same visible split experience:
- derive geometry from the already-known Builder width;
- keep a stable base layout width;
- scale between meaningful rebases;
- do not perform a new DOM read for every pixel;
- do not re-enable broad root/external synchronization just for the bar.

## Minimum collapse invariant

Minimum-edge collapse controls are owned by the live splitter boundary:
- minimum state changes only when the edge threshold changes;
- the visible button tracks the correct side;
- after drag, live inline coordinates are cleared and resting rules own the controls again.

## Old architecture document versus current code

The older split architecture PDF described the important foundation correctly: Lite V2, one real boundary, rAF latest-coordinate handling, local geometry, deferred reconciliation, and no per-frame global remeasurement.

However, the current PREVIEW source has evolved beyond that historical 793-era document:
- current default drag mode is Pure Pane Hybrid;
- current Builder compact/mobile handling includes the later boundary work;
- current generation-bar live path includes later stable-width/scale optimization;
- current native-resize and reconciliation comments include later 1000-series fixes.

When old documentation and current source disagree, current PREVIEW source wins.

## Protection rule

This reference is a comparison baseline.

Do not automatically revert whole files to these blobs after future unrelated development. If a split regression appears:
1. compare the affected owner against this baseline;
2. isolate the split-specific change;
3. restore only the required behavior;
4. preserve newer unrelated valid changes;
5. verify with the split validation matrix.
