from pathlib import Path

path = Path('src/pages/SunoLibraryPage.tsx')
text = path.read_text(encoding='utf-8')

required = {
    '954 marker': '// SORIDRAW_LIBRARY_PLAYBACK_DELETE_CONSISTENCY_954',
    'canonical url resolver': 'const getPlayableUrlFromSource = (source: any) =>',
    'legacy url field support': 'source.url,',
    'root fallback canonical url': 'const playableUrl = getPlayableUrlFromSource(group);',
    'session sync helper': 'const syncLibraryWorkspaceSessionTracks =',
    'local patch helper': 'const patchWorkspaceTrackLocally =',
    'session emit': 'emitLibraryWorkspaceSession(libraryWorkspaceSession);',
    'single delete local patch': 'patchWorkspaceTrackLocally(deleteTarget.groupId',
    'bulk local patch': 'patchWorkspaceTrackLocally(groupId',
}
missing = [name for name, fragment in required.items() if fragment not in text]
if missing:
    raise RuntimeError('verify-954 missing: ' + ', '.join(missing))

start = text.find('const getPlayableUrlFromSource')
end = text.find('const getTitle', start)
block = text[start:end]
for field in [
    'source.audioUrl',
    'source.streamAudioUrl',
    'source.audio_url',
    'source.stream_audio_url',
    'source.url',
    'source.sourceAudioUrl',
    'source.source_audio_url',
    'source.sourceStreamAudioUrl',
    'source.source_stream_audio_url',
]:
    if field not in block:
        raise RuntimeError(f'verify-954 URL field missing: {field}')

if "audioValidationStatus === 'pending_or_empty'" in block or "audioValidationStatus === 'missing'" in block:
    raise RuntimeError('verify-954 stale validation metadata still masks real URL')

if "if (deleteTarget.action === 'permanentDelete' && nextSunoData.length === 0)" not in text:
    raise RuntimeError('verify-954 last-child permanent delete guard missing')
if 'removeWorkspaceTracksLocally([deleteTarget.groupId])' not in text:
    raise RuntimeError('verify-954 parent removal path missing')

print('verify-954: PASS')
