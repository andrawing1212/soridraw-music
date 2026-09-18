from pathlib import Path

page_path = Path('src/pages/SunoLibraryPage.tsx')
text = page_path.read_text(encoding='utf-8')
marker = '// SORIDRAW_LIBRARY_COLOR_PALETTE_LAYER_FIX_971'

if marker in text:
    print('apply-971: already applied')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-971: anchor not found: {label}')
    text = text.replace(old, new, 1)

# The workspace group must become the top stacking context while one of its track palettes is open.
replace_once(
    "className={`soridraw-library-workspace-group soridraw-list-perf-item soridraw-perf-layout-region-group bg-[#151515] rounded-2xl ${activeColorMenu?.startsWith(`workspace-${group.id}-`) ? 'soridraw-list-perf-item--active' : ''}`}",
    "className={`soridraw-library-workspace-group soridraw-list-perf-item soridraw-perf-layout-region-group relative !overflow-visible bg-[#151515] rounded-2xl ${activeColorMenu?.startsWith(`workspace-${group.id}-`) ? 'soridraw-list-perf-item--active z-[250]' : 'z-0'}`}",
    'workspace active group stacking context',
)

# Keep the palette in the same visual position, but guarantee it paints above following cards.
workspace_palette = 'className="absolute left-0 top-7 z-[260] flex items-center gap-2 rounded-xl bg-[#2a2a2a] p-2 shadow-xl"'
replace_once(
    workspace_palette,
    'className="absolute left-0 top-7 z-[400] flex items-center gap-2 rounded-xl bg-[#2a2a2a] p-2 shadow-xl"',
    'workspace palette z-index',
)

# Playlist rows already establish relative positioning; raise their active row/palette too for the same behavior.
replace_once(
    "${(activeColorMenu === item.id || activePlaylistItemMenu === item.id) ? 'soridraw-list-perf-item--active' : ''}",
    "${(activeColorMenu === item.id || activePlaylistItemMenu === item.id) ? 'soridraw-list-perf-item--active z-[250]' : 'z-0'}",
    'playlist active row stacking context',
)
replace_once(
    'className="absolute left-0 top-7 z-[260] flex items-center gap-2 rounded-xl bg-[#2a2a2a] p-2 shadow-xl"',
    'className="absolute left-0 top-7 z-[400] flex items-center gap-2 rounded-xl bg-[#2a2a2a] p-2 shadow-xl"',
    'playlist palette z-index',
)

anchor = "const COLOR_OPTIONS = [\n"
if anchor not in text:
    raise RuntimeError('apply-971: COLOR_OPTIONS anchor missing')
text = text.replace(anchor, marker + "\n" + anchor, 1)

required = [
    marker,
    'relative !overflow-visible bg-[#151515] rounded-2xl',
    "'soridraw-list-perf-item--active z-[250]'",
    'top-7 z-[400] flex items-center gap-2',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-971 verification failed: missing {fragment}')

page_path.write_text(text, encoding='utf-8')
print('apply-971: active Library color palette/group now paints above following cards without changing palette position')
