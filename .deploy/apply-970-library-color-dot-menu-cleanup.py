from pathlib import Path

page_path = Path('src/pages/SunoLibraryPage.tsx')
text = page_path.read_text(encoding='utf-8')
marker = '// SORIDRAW_LIBRARY_COLOR_DOT_MENU_CLEANUP_970'

if marker in text:
    print('apply-970: already applied')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-970: anchor not found: {label}')
    text = text.replace(old, new, 1)

# Workspace top color filter: keep the click target, remove outer ring/gray button visual.
replace_once(
'''                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      workspaceColorFilter === opt.value ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white scale-110' : 'hover:scale-110 brightness-75 hover:brightness-100'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: opt.color }}></div>''',
'''                    className="group flex h-7 w-7 items-center justify-center rounded-full !bg-transparent !shadow-none !ring-0 transition-transform hover:scale-110"
                  >
                    <div
                      className={`h-3.5 w-3.5 rounded-full transition-all ${workspaceColorFilter === opt.value ? 'scale-110 brightness-110' : 'brightness-75 group-hover:brightness-100'}`}
                      style={{ backgroundColor: opt.color }}
                    />''',
    'workspace top color filter dots',
)

# Playlist top color filter: same single-dot visual contract.
replace_once(
'''                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      playlistColorFilter === opt.value ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-white scale-110' : 'hover:scale-110 brightness-75 hover:brightness-100'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: opt.color }}></div>''',
'''                    className="group flex h-7 w-7 items-center justify-center rounded-full !bg-transparent !shadow-none !ring-0 transition-transform hover:scale-110"
                  >
                    <div
                      className={`h-3.5 w-3.5 rounded-full transition-all ${playlistColorFilter === opt.value ? 'scale-110 brightness-110' : 'brightness-75 group-hover:brightness-100'}`}
                      style={{ backgroundColor: opt.color }}
                    />''',
    'playlist top color filter dots',
)

# Workspace track palette: one dark Music Note-style palette surface.
replace_once(
'''                              <div data-floating-menu="true" className="absolute top-7 left-0 z-30 flex items-center gap-1.5 p-2 bg-[#2a2a2a] rounded-xl shadow-xl border border-black/20" onClick={(e) => e.stopPropagation()}>''',
'''                              <div data-floating-menu="true" className="absolute left-0 top-7 z-[260] flex items-center gap-2 rounded-xl bg-[#2a2a2a] p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>''',
    'workspace palette surface',
)
replace_once(
'''                                  <button
                                    key={c.value}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (multiSelectMode && selectedTrackCount > 0) {
                                        handleBulkChangeColor(c.value);
                                      } else {
                                        handleChangeWorkspaceColor(group, idx, c.value);
                                        setActiveColorMenu(null);
                                      }
                                    }}
                                    className="w-5 h-5 rounded-full outline-none hover:scale-110 transition-transform focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2a2a2a]"
                                    style={{ backgroundColor: c.color }}
                                  />''',
'''                                  <button
                                    key={c.value}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (multiSelectMode && selectedTrackCount > 0) {
                                        handleBulkChangeColor(c.value);
                                      } else {
                                        handleChangeWorkspaceColor(group, idx, c.value);
                                        setActiveColorMenu(null);
                                      }
                                    }}
                                    className="flex h-6 w-6 items-center justify-center rounded-full !bg-transparent !shadow-none !ring-0 outline-none transition-transform hover:scale-110"
                                  >
                                    <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                                  </button>''',
    'workspace palette dot button',
)

# Playlist track palette: same palette surface + colored dots only.
replace_once(
'''                            <div data-floating-menu="true" className="absolute top-6 left-0 z-10 flex items-center gap-1.5 p-2 bg-[#2a2a2a] rounded-xl shadow-xl border border-black/20">''',
'''                            <div data-floating-menu="true" className="absolute left-0 top-7 z-[260] flex items-center gap-2 rounded-xl bg-[#2a2a2a] p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>''',
    'playlist palette surface',
)
replace_once(
'''                                <button
                                  key={c.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (multiSelectMode && selectedTrackCount > 0) {
                                      handleBulkChangeColor(c.value);
                                    } else {
                                      handleChangeColor(item, c.value);
                                      setActiveColorMenu(null);
                                    }
                                  }}
                                  className="w-5 h-5 rounded-full outline-none hover:scale-110 transition-transform focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2a2a2a]"
                                  style={{ backgroundColor: c.color }}
                                />''',
'''                                <button
                                  key={c.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (multiSelectMode && selectedTrackCount > 0) {
                                      handleBulkChangeColor(c.value);
                                    } else {
                                      handleChangeColor(item, c.value);
                                      setActiveColorMenu(null);
                                    }
                                  }}
                                  className="flex h-6 w-6 items-center justify-center rounded-full !bg-transparent !shadow-none !ring-0 outline-none transition-transform hover:scale-110"
                                >
                                  <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                                </button>''',
    'playlist palette dot button',
)

anchor = "const COLOR_OPTIONS = [\n"
if anchor not in text:
    raise RuntimeError('apply-970: COLOR_OPTIONS anchor missing')
text = text.replace(anchor, marker + "\n" + anchor, 1)

required = [
    marker,
    '!bg-transparent !shadow-none !ring-0',
    "workspaceColorFilter === opt.value ? 'scale-110 brightness-110'",
    "playlistColorFilter === opt.value ? 'scale-110 brightness-110'",
    'z-[260] flex items-center gap-2 rounded-xl bg-[#2a2a2a] p-2 shadow-xl',
    'block h-4 w-4 rounded-full',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-970 verification failed: missing {fragment}')

page_path.write_text(text, encoding='utf-8')
print('apply-970: Library top filters use bare color dots; workspace/playlist track palettes match Music Note single-surface dot palette')
