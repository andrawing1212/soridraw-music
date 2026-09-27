---
name: studio-split-behavior
description: Protect, modify, or audit SORIDRAW Studio Black split-mode behavior: Lite V2 / Pure Pane Hybrid drag geometry, pane-local responsive transitions, minimum-width collapse controls, generation-bar tracking, scroll preservation, and split performance. Use before any split bar, split-mode, pane resize, PC/tablet boundary, or related performance change. Do not use to justify changing unrelated UI or product behavior.
---

# SORIDRAW Studio Split Behavior

Use this skill for SORIDRAW split-mode work involving the divider, left/right pane resizing, responsive handoff while dragging, collapse controls, generation bar tracking, long-list drag performance, or split-specific PC/tablet/mobile behavior.

Explicit user instructions always override this skill.

## 1. Current protected baseline — MUST READ FIRST

The current visual reference is the user's 2026-09-28 KST split-mode video plus the current PREVIEW source. The user asked to preserve **how the splitter works now** as a reusable skill.

Important:
- PREVIEW is currently app198, but the app198 product change was Explore divider CSS, not a split-engine rewrite.
- Therefore the split baseline is defined by the **current source blobs**, not by the app number alone.
- Read `references/soridraw-app198-split-frozen.md` before changing any split behavior.
- Read `references/split-validation-matrix.md` before declaring a split change complete.
- Read current `DOCS/CURRENT_RELEASE_STATE.md` before any SORIDRAW work.

Default posture: **protect the current behavior.** Do not refactor, simplify, replace, or "clean up" the split engine without a concrete split defect or an explicit user request.

## 2. Required source read order

Before changing split behavior, inspect these current PREVIEW files in this order:

1. `src/components/studio/LiteStudioSplitWorkspace.tsx`
2. `src/components/studio/StudioSplitEngineWorkspace.tsx`
3. `src/components/studio/liteSplitWorkspace.css`
4. `src/components/studio/studioLayout.css`
5. `src/App.tsx` when engine/runtime-profile selection or page routing is involved.
6. `src/components/studio/splitPerfDiagnostics.ts` only when diagnostics or performance measurement is involved.

Do not begin from an old ZIP, old chat, or old split PDF when current GitHub differs. Historical documents explain intent; current PREVIEW code owns the actual implementation.

## 3. User-visible behavior contract

The current splitter must behave as one real boundary.

Protect all of these:
- the divider and both panes follow the same live boundary;
- the divider must not visually outrun the pane contents;
- left/right pane content changes layout while the divider is moving, not only after release;
- responsive changes occur from the **actual pane width**, not only the browser viewport;
- pointer-up must not cause a visible snap, card-height jump, delayed generation-bar jump, or scroll jump;
- fast left-right dragging must not accumulate old pointer positions;
- horizontal splitter movement must not turn into vertical page movement;
- minimum-width collapse controls stay attached to the side that is actually at minimum;
- the generation bar tracks the live Builder territory without reintroducing heavy global synchronization;
- current UI position, spacing, colors, divider thickness, hit area, hover behavior, and responsive composition are protected unless the user explicitly asks to change them.

### Divider visual contract

Current Lite V2 CSS behavior:
- hit area: 16px;
- visible line: 1px;
- cursor: `ew-resize`;
- `touch-action: none`;
- hover/active drag changes brightness only;
- no click-time thickness, length, position, radius, scale, or transform change.

Do not make a fake compositor-only line that moves ahead of the real panes.

## 4. Engine and viewport contract

Current split routing:
- Lite V2 is the normal production engine.
- `StudioSplitEngineWorkspace` defaults `v2DragPerfMode` to `pure-pane-hybrid`.
- Legacy remains a comparison/rollback diagnostic path, not the first place to implement production fixes.
- When compact mobile routing is active in split view, `StudioCompactMobileWorkspace` is used instead of mounting the split engine.

External viewport rules:
- split engine territory starts at 1100px;
- 1100–1599px uses the tablet split profile;
- tablet split enforces a safe minimum pane width of 430px where geometry allows it;
- normal wide bounds are 24%–76%;
- wide and tablet split percentages are stored separately.

Do not move these thresholds casually. A threshold change is a product/responsive change and requires explicit scope plus full matrix verification.

## 5. Pane-local responsive contract

The split engine uses already-known pane widths to decide the visible composition.

Key current thresholds:
- content responsive mode: mobile <= 660px, tablet 661–1080px, PC > 1080px;
- Builder visible composition: mobile below 660px, compact through 820px, desktop above 820px;
- Result mobile boundary is 661px for Recent / Music Note / Library;
- Create uses its current separate Result threshold in code; do not normalize it without evidence.

Pure Pane Hybrid exists specifically to keep per-frame geometry cheap while still publishing the few visible composition changes that must happen live.

Rules:
- do not broadcast every pixel as a global responsive state;
- do not add React state for every pointer movement;
- publish responsive state only when the relevant boundary actually changes;
- use the pane width already calculated by the split engine;
- do not create a second page-level ResizeObserver/getBoundingClientRect loop to rediscover the same width.

## 6. Drag lifecycle contract

### Pointer-down

One-time setup is allowed before the hot path starts:
- read the workspace rect;
- read relevant rail/pane resting geometry;
- capture the Result resting right edge;
- capture generation-bar/action geometry;
- capture vertical scroll preservation state;
- disconnect observers that should not compete during drag;
- set pointer capture and the Lite drag marker.

Do not move these one-time reads into pointermove.

### Pointer-move

The hot path is intentionally tiny:

`pointermove -> store latest clientX -> one requestAnimationFrame -> apply latest position`

Rules:
- only the latest X matters;
- one scheduled rAF per frame;
- stale intermediate pointer positions are discarded;
- no per-move React `setState`;
- no new `getBoundingClientRect()`;
- no new `ResizeObserver` measurement;
- no per-move `matchMedia` / capability query;
- no full-root measurement loop.

### Live frame

In the current production path, the same frame owns:
- Builder width;
- Result boundary;
- splitter X;
- required pane-local responsive boundary transitions;
- generation-bar live geometry;
- minimum-width collapse-control position when relevant.

Heavy root/global synchronization remains deferred.

### Pointer-up

Release is a reconciliation step, not a second layout system.

Required order:
- flush the latest pending pointer position;
- end dragging;
- remove drag-only markers/temporary geometry;
- reconcile deferred responsive/external state exactly once;
- commit final root measurements;
- return geometry ownership to the resting CSS/root contract;
- restore protected scroll position once;
- reconnect resting observers;
- persist the split percent.

Do not add a second drag-only card-height owner that is removed at pointer-up. That pattern previously caused release-only jumps.

## 7. Scroll preservation contract

A horizontal drag must not move the user's vertical reading position.

Current intent:
- if a pane is at the top, it stays at the top;
- if a pane is at the bottom, it stays at the bottom;
- if it is in the middle, preserve the same `scrollTop`;
- re-apply once after release if needed;
- do not perform per-frame card scanning to achieve this.

Any split change that makes Music Note or Library drift vertically during repeated left-right dragging is a regression.

## 8. Generation bar and auxiliary UI contract

The generation bar is part of the split experience but must not make the hot path expensive.

Current design:
- live geometry is derived from the Builder width already known by the split engine;
- the bar keeps a stable layout width and uses a compositor scale for intermediate visual width;
- it rebases only when width drift or responsive composition meaningfully changes;
- external/root work that is not visually required every frame stays deferred.

Collapse controls:
- minimum-edge state changes only at threshold changes;
- the visible edge control uses the exact live splitter coordinate;
- collapsed restore positions return to the committed resting ownership after drag.

Do not re-enable a large external-geometry synchronization just to move one companion control.

## 9. Drag-time performance protections

Protect the current low-cost path:
- use direct/local geometry where the runtime path requires it;
- reuse calculated Builder/Result widths;
- allow browser-native off-screen work skipping for long lists;
- pause nonessential transitions/animations during active drag where current CSS already does so;
- keep diagnostic instrumentation out of ordinary hand dragging.

The ordinary user path must not start PERF observers or benchmark instrumentation. Manual diagnostic capture is explicit and one-shot.

Do not restore the legacy global `soridraw-split-dragging` behavior. Lite V2 uses its narrower `soridraw-lite-split-dragging` marker so old app-wide selectors do not force thousands of nodes through style matching.

## 10. Hard prohibitions

Do not add any of the following without a proven need and explicit review:
- per-frame React state updates;
- per-frame DOM geometry reads;
- per-card ResizeObservers for split width;
- global root CSS variable or dataset writes for every pixel;
- duplicate geometry owners for the same pane/splitter;
- a fake 60fps divider with slower real panes;
- drag-only height snapshots for normal cards;
- page-specific split engines or one-off page geometry patches;
- automatic Legacy promotion to production;
- normal-user performance instrumentation;
- split fixes that alter unrelated Music Note, Library, Explore, profile, likes, or backend behavior.

## 11. Modification workflow

When a split bug is reported:

1. Reproduce the exact visible failure and identify whether it is:
   - input/rAF,
   - pane geometry,
   - responsive boundary,
   - generation bar / collapse control,
   - scroll preservation,
   - pointer-up reconciliation,
   - CSS reflow/paint,
   - external browser resize rather than internal splitter drag.
2. Inspect the current Lite V2 owner first.
3. Change the smallest owner that actually causes the problem.
4. Do not add a second owner to compensate for the first.
5. Keep unrelated pages and current visual design unchanged.
6. Run the focused validation matrix.
7. For substantial split changes, independently audit the fixed commit before PREVIEW deployment.
8. Real-hand PREVIEW verification is required before calling a feel/performance change fully accepted.

If the same approach fails repeatedly, stop adding patches and re-evaluate ownership.

## 12. Required validation

Use `references/split-validation-matrix.md`.

At minimum:
- fast left-right drag;
- slow boundary crossing;
- Builder 660px mobile boundary;
- Builder 820px compact boundary;
- content 1080px tablet/PC boundary;
- applicable Result mobile boundary;
- external viewport 1100px split/compact routing boundary;
- tablet 1100–1599px safe minimum;
- both minimum edges and collapse controls;
- pointer-up with no snap;
- top/middle/bottom scroll preservation;
- generation bar live tracking;
- Recent / Music Note / Library page round-trip;
- long Music Note and Library lists;
- PC fine pointer;
- tablet/touch or Galaxy Tab when the change affects that path;
- external window resize separately from splitter drag;
- TypeScript / Build / relevant regression tests;
- TEST / PRODUCTION unchanged unless explicitly promoted.

## 13. Reporting

Report in director language:
- what visible split behavior was wrong;
- the actual owner/cause;
- what changed;
- what stayed protected;
- whether pointer-up, scroll, generation bar, and responsive boundaries stayed correct;
- PC/tablet/touch status;
- TypeScript/Build/tests;
- PREVIEW real-hand status;
- remaining risk.

Do not call a split performance change complete from CI alone.
