from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 exact match, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


app = 'src/App.tsx'
replace_once(
    app,
    "  const studioDescriptionPointerRef = useRef({ x: 0, y: 0 });",
    "  const studioDescriptionPointerRef = useRef<{ x: number; y: number; target: EventTarget | null }>({ x: 0, y: 0, target: null });",
)
replace_once(
    app,
    """    const rememberPointer = (event: PointerEvent) => {
      studioDescriptionPointerRef.current = { x: event.clientX, y: event.clientY };
    };""",
    """    const rememberPointer = (event: PointerEvent) => {
      studioDescriptionPointerRef.current = { x: event.clientX, y: event.clientY, target: event.target };
    };""",
)
replace_once(
    app,
    """    const { x, y } = studioDescriptionPointerRef.current;
    const hoveredElement = document.elementFromPoint(x, y) as HTMLElement | null;
    const builderPane = document.querySelector<HTMLElement>('[data-soridraw-studio-pane=\"builder\"]');
    const resultPane = document.querySelector<HTMLElement>('[data-soridraw-studio-pane=\"result\"]');
    let paneElement = hoveredElement?.closest<HTMLElement>('[data-soridraw-studio-pane]') ?? null;

    if (!paneElement && hoveredElement?.closest('.soridraw-studio-action-bar--tracking, .soridraw-studio-action-collapsed')) {
      paneElement = builderPane;
    }

    if (!paneElement && y >= 58) {
      const builderRect = builderPane?.getBoundingClientRect();
      const resultRect = resultPane?.getBoundingClientRect();
      if (builderRect && x >= builderRect.left && x <= builderRect.right) paneElement = builderPane;
      else if (resultRect && x >= resultRect.left && x <= resultRect.right) paneElement = resultPane;
    }""",
    """    const { x, y, target } = studioDescriptionPointerRef.current;
    // SORIDRAW_STUDIO_TOOLTIP_TARGET_REUSE_985
    // pointerover already tells us the live DOM target. Reuse it instead of
    // forcing elementFromPoint + two document queries on every tooltip hover.
    const pointerTarget = target instanceof Element && target.isConnected ? target : null;
    const hoveredElement = pointerTarget ?? document.elementFromPoint(x, y);
    let paneElement = hoveredElement?.closest('[data-soridraw-studio-pane]') as HTMLElement | null;
    let builderPane: HTMLElement | null = null;
    let resultPane: HTMLElement | null = null;

    if (!paneElement && hoveredElement?.closest('.soridraw-studio-action-bar--tracking, .soridraw-studio-action-collapsed')) {
      builderPane = document.querySelector<HTMLElement>('[data-soridraw-studio-pane=\"builder\"]');
      paneElement = builderPane;
    }

    if (!paneElement && y >= 58) {
      builderPane ??= document.querySelector<HTMLElement>('[data-soridraw-studio-pane=\"builder\"]');
      resultPane = document.querySelector<HTMLElement>('[data-soridraw-studio-pane=\"result\"]');
      const builderRect = builderPane?.getBoundingClientRect();
      const resultRect = resultPane?.getBoundingClientRect();
      if (builderRect && x >= builderRect.left && x <= builderRect.right) paneElement = builderPane;
      else if (resultRect && x >= resultRect.left && x <= resultRect.right) paneElement = resultPane;
    }""",
)

fav = 'src/pages/FavoritesPage.tsx'
replace_once(
    fav,
    """                  onMouseEnter={(event) => {
                    handleSelectionDragEnter(event, song.id);
                    event.currentTarget.style.backgroundColor = '#171717';
                  }}
                  onMouseLeave={(event) => {
                    handleCardLongPressEnd();
                    setIsMusicNoteMousePressTracking(false);
                    event.currentTarget.style.backgroundColor = '';
                  }}""",
    """                  onMouseEnter={isSelectionMode ? ((event: React.MouseEvent<HTMLDivElement>) => {
                    handleSelectionDragEnter(event, song.id);
                  }) : undefined}
                  onMouseLeave={isMusicNoteMousePressTracking ? (() => {
                    handleCardLongPressEnd();
                    setIsMusicNoteMousePressTracking(false);
                  }) : undefined}""",
)
replace_once(
    fav,
    '                    "soridraw-musicnote-song-card soridraw-list-perf-item soridraw-perf-layout-region-item group relative overflow-visible rounded-2xl border border-black/24 bg-[var(--bg-secondary)] select-none",',
    '                    "soridraw-musicnote-song-card soridraw-list-perf-item soridraw-perf-layout-region-item group relative overflow-visible rounded-2xl border border-black/24 bg-[var(--bg-secondary)] hover:bg-[#171717] select-none",',
)

lib = 'src/pages/SunoLibraryPage.tsx'
replace_once(
    lib,
    """                          onMouseEnter={(event) => {
                            handleLibraryDragSelectEnter(event, selection);
                          }}
                          onMouseLeave={() => {
                            handleLibraryCardLongPressEnd();
                          }}""",
    """                          onMouseEnter={multiSelectMode ? ((event: React.MouseEvent<HTMLDivElement>) => {
                            handleLibraryDragSelectEnter(event, selection);
                          }) : undefined}
                          onMouseLeave={isLibraryMousePressTracking ? handleLibraryCardLongPressEnd : undefined}""",
)
replace_once(
    lib,
    """                      onMouseEnter={(event) => handleLibraryDragSelectEnter(event, selection)}
                      onMouseLeave={handleLibraryCardLongPressEnd}""",
    """                      onMouseEnter={multiSelectMode ? ((event: React.MouseEvent<HTMLDivElement>) => handleLibraryDragSelectEnter(event, selection)) : undefined}
                      onMouseLeave={isLibraryMousePressTracking ? handleLibraryCardLongPressEnd : undefined}""",
)
