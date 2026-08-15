# Studio layout ownership

- `StudioPageFrame`: owns the three-area page structure (left rail / workspace / right rail).
- `StudioLeftRail`: owns Studio Black's left navigation rail.
- `StudioRightRail`: owns generation status, recent songs, credits, and activity.
- `StudioSplitWorkspace`: owns the builder/result splitter, drag behavior, pane width measurement, and per-pane mobile/desktop mode.
- `studioLayout.css`: owns Studio Black layout and color tokens only.

Classic mode collapses these wrappers with `display: contents` and hides the Studio Black rails/splitter. Feature state and generation logic remain in `App.tsx`; layout responsibility no longer does.
