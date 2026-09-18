from pathlib import Path

MARKER = '// SORIDRAW_LIBRARY_PLAYED_WRITE_DEDUPE_973'
path = Path('src/pages/SunoLibraryPage.tsx')
text = path.read_text(encoding='utf-8')

if MARKER in text:
    print('apply-973: already applied')
    raise SystemExit(0)

workspace_old = """  const markWorkspaceItemPlayed = async (group: any, idx: number) => {\n    if (!user || !group?.id) return;\n    const playedAt = new Date().toISOString();\n"""
workspace_new = """  const markWorkspaceItemPlayed = async (group: any, idx: number) => {\n    if (!user || !group?.id) return;\n    const sourceItem = extractSunoData(group)[idx] || group;\n    if (!isWorkspaceItemUnplayed(group, sourceItem, idx)) return;\n    const playedAt = new Date().toISOString();\n"""

playlist_old = """  const markPlaylistItemPlayed = async (item: any) => {\n    if (!user || !item) return;\n    const playedAt = new Date().toISOString();\n"""
playlist_new = """  const markPlaylistItemPlayed = async (item: any) => {\n    if (!user || !item) return;\n    if (!isPlaylistItemUnplayed(item)) return;\n    const playedAt = new Date().toISOString();\n"""

if workspace_old not in text:
    raise RuntimeError('apply-973: workspace played anchor not found')
if playlist_old not in text:
    raise RuntimeError('apply-973: playlist played anchor not found')

text = text.replace(workspace_old, workspace_new, 1)
text = text.replace(playlist_old, playlist_new, 1)
text = text.replace(
    "export default function SunoLibraryPage({ appUser = null }: { appUser?: any } = {}) {",
    MARKER + "\nexport default function SunoLibraryPage({ appUser = null }: { appUser?: any } = {}) {",
    1,
)

for required in [
    MARKER,
    'if (!isWorkspaceItemUnplayed(group, sourceItem, idx)) return;',
    'if (!isPlaylistItemUnplayed(item)) return;',
]:
    if required not in text:
        raise RuntimeError(f'apply-973 verification failed: {required}')

path.write_text(text, encoding='utf-8')
print('apply-973: repeated Library playback no longer rewrites played state')
