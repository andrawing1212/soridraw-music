from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)


# Music Note paging must never publish a bundle write just because the user paged.
app = Path('src/App.tsx')
text = app.read_text(encoding='utf-8')
text = replace_once(
    text,
    "const writeFavoritesCache = (uid: string, list: any[]) => {",
    "const writeFavoritesCache = (uid: string, list: any[], options: { skipBundleWrite?: boolean } = {}) => {",
    'writeFavoritesCache options',
)
text = replace_once(
    text,
    "if (musicNoteBundleActiveUids.has(uid)) {",
    "if (!options.skipBundleWrite && musicNoteBundleActiveUids.has(uid)) {",
    'bundle write guard',
)
count = text.count("writeFavoritesCache(uid, merged);")
if count != 2:
    raise SystemExit(f'Music Note bounded paging cache writes: expected 2 matches, got {count}')
text = text.replace("writeFavoritesCache(uid, merged);", "writeFavoritesCache(uid, merged, { skipBundleWrite: true });")
app.write_text(text, encoding='utf-8')

# A changed authoritative count should re-verify the first server page, including cross-device/save-delete changes.
fav = Path('src/pages/FavoritesPage.tsx')
ftext = fav.read_text(encoding='utf-8')
ftext = replace_once(
    ftext,
    """  useEffect(() => {\n    if (isMusicNoteSharedView) return;\n    void onEnsureFavoritesPage?.();\n  }, [isMusicNoteSharedView, onEnsureFavoritesPage]);\n""",
    """  useEffect(() => {\n    if (isMusicNoteSharedView) return;\n    void onEnsureFavoritesPage?.();\n  }, [isMusicNoteSharedView, onEnsureFavoritesPage, favoriteTotalCount]);\n""",
    'Music Note authoritative count refresh dependency',
)
fav.write_text(ftext, encoding='utf-8')

# Library re-entry gets one bounded fresh page; idle view still has no listener/write loop.
lib = Path('src/pages/SunoLibraryPage.tsx')
ltext = lib.read_text(encoding='utf-8')
ltext = replace_once(
    ltext,
    "const ensureLibraryWorkspaceServerFirstPage = (uid: string): Promise<void> => {",
    "const ensureLibraryWorkspaceServerFirstPage = (uid: string, force = false): Promise<void> => {",
    'Library first page force signature',
)
ltext = replace_once(
    ltext,
    "  if (session.serverInitialized) return Promise.resolve();",
    "  if (session.serverInitialized && !force) return Promise.resolve();",
    'Library first page force guard',
)
ltext = replace_once(
    ltext,
    """      if (alreadyRunning && libraryWorkspaceSession?.serverInitialized) {\n        markCacheDiagnostic('library', 'CACHE', 0);\n      } else {\n        void ensureLibraryWorkspaceServerFirstPage(resolvedUser.uid);\n      }\n""",
    """      if (alreadyRunning && libraryWorkspaceSession?.serverInitialized) {\n        markCacheDiagnostic('library', 'CACHE', 0);\n      }\n      // One bounded re-entry refresh keeps newly generated tracks visible without an idle listener.\n      void ensureLibraryWorkspaceServerFirstPage(resolvedUser.uid, true);\n""",
    'Library bounded re-entry refresh',
)
lib.write_text(ltext, encoding='utf-8')

print('Stage3 final regression guard patch applied')
