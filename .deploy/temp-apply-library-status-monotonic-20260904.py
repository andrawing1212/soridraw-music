from pathlib import Path

path = Path('src/pages/SunoLibraryPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_LIBRARY_STATUS_MONOTONIC_20260904'
if marker in text:
    print('already applied')
    raise SystemExit(0)

# 1) Shared helper: once a Library group is conclusively completed/playable,
# server status checks must never revive it as processing/pending.
anchor = "  const isTrackStuck = (group: any) => {"
if text.count(anchor) != 1:
    raise RuntimeError(f'isTrackStuck anchor count={text.count(anchor)}')
helper = r'''  const hasStableLibraryResult = (group: any) => {
    if (!group) return false;
    const normalizedStatus = String(group.status || '').trim().toLowerCase();
    if (['completed', 'success', 'complete'].includes(normalizedStatus)) return true;

    const items = extractSunoData(group);
    const hasFullyPlayableItems = items.length > 0 && items.every((item: any) => {
      const audioUrl = String(getAudioUrl(item, group) || '').trim();
      return Boolean(audioUrl) && getDuration(item, group) !== null;
    });
    if (hasFullyPlayableItems) return true;

    const rescueEntries = Object.values(group?.audioRescue || {}) as any[];
    return rescueEntries.some((entry: any) => {
      const rescueStatus = String(entry?.status || '').trim().toLowerCase();
      const rescueUrl = String(entry?.audioUrl || entry?.audio_url || entry?.url || '').trim();
      return Boolean(rescueUrl) && (!rescueStatus || ['completed', 'success', 'complete'].includes(rescueStatus));
    });
  };

'''
text = text.replace(anchor, helper + anchor, 1)

# 2) Monotonic status boundary. A stale Suno response must not write a
# completed/playable track back to processing/failed or replace its good payload.
old = """    const resolved = resolveSunoStatusFromResponse(data);\n    const updatePayload: any = {"""
new = """    const resolved = resolveSunoStatusFromResponse(data);\n    const currentTrack = tracks.find((track: any) => String(track?.id || '') === String(trackId));\n    if (currentTrack && hasStableLibraryResult(currentTrack) && resolved.status !== 'completed') {\n      return { status: 'completed' as string | null, raw: resolved.raw || '' };\n    }\n\n    const updatePayload: any = {"""
if text.count(old) != 1:
    raise RuntimeError(f'sync anchor count={text.count(old)}')
text = text.replace(old, new, 1)

# 3) Auto polling is only for a genuinely pending, recent generation. Existing
# playable/completed Library data must never trigger background status traffic.
old = """        const items = extractSunoData(group);\n        const isFullyCompleted = group.status === 'completed' && items.every((item: any) => !!getAudioUrl(item, group) && getDuration(item, group) !== null);\n\n        if (isFullyCompleted) return false;\n\n        if (!group.taskId) return false;"""
new = """        const items = extractSunoData(group);\n        if (hasStableLibraryResult(group)) return false;\n\n        const normalizedStatus = String(group.status || '').trim().toLowerCase();\n        const isExplicitPending = !normalizedStatus || ['processing', 'submitted', 'pending', 'generating', 'queued', 'queue', 'running', 'in_progress'].includes(normalizedStatus);\n        if (!isExplicitPending) return false;\n\n        if (!group.taskId) return false;"""
if text.count(old) != 1:
    raise RuntimeError(f'auto polling anchor count={text.count(old)}')
text = text.replace(old, new, 1)

# 4) Do not offer a status-check button for an already playable result. Keep it
# only for actual stuck/failed records that can benefit from manual recovery.
old = """                      {group.status !== 'completed' && (\n                        <button"""
new = """                      {!isSharedView && group.taskId && !hasStableLibraryResult(group) && (isTrackStuck(group) || ['failed', 'cancelled', 'canceled'].includes(String(group.status || '').trim().toLowerCase())) && (\n                        <button"""
if text.count(old) != 1:
    raise RuntimeError(f'status button anchor count={text.count(old)}')
text = text.replace(old, new, 1)

# 5) A completed rescue URL is completion evidence even when the historic raw
# audio URL field is missing. Never render it as `생성 중`.
old = """                      const isCompleted = Boolean(audioUrl && (isCompletedStatus || hasValidDuration || hasCompletedRescue));\n                      const canRecoverPlaybackUrl = !isSharedView && Boolean(group.taskId) && (isCompletedStatus || hasValidDuration || hasCompletedRescue);\n                      const canPlayOrRecover = Boolean(audioUrl) || canRecoverPlaybackUrl;\n                      const isCompletedWithoutAudio = isCompletedStatus && !audioUrl;\n                      const isStalePending = !isFailed && isPendingStatus && !audioUrl && isTrackPastAutoCheckWindow(group);\n                      const isPending = !isFailed && isPendingStatus && !audioUrl && !isStalePending;"""
new = """                      const isCompleted = Boolean((audioUrl || hasCompletedRescue) && (isCompletedStatus || hasValidDuration || hasCompletedRescue));\n                      const canRecoverPlaybackUrl = !isSharedView && Boolean(group.taskId) && (isCompletedStatus || hasValidDuration || hasCompletedRescue);\n                      const canPlayOrRecover = Boolean(audioUrl) || canRecoverPlaybackUrl;\n                      const isCompletedWithoutAudio = isCompletedStatus && !audioUrl && !hasCompletedRescue;\n                      const isStalePending = !isFailed && isPendingStatus && !audioUrl && !hasCompletedRescue && isTrackPastAutoCheckWindow(group);\n                      const isPending = !isFailed && isPendingStatus && !audioUrl && !hasCompletedRescue && !isStalePending;"""
if text.count(old) != 1:
    raise RuntimeError(f'row pending anchor count={text.count(old)}')
text = text.replace(old, new, 1)

# Marker near existing hardening flags.
flag = "const SORIDRAW_900_LIBRARY_SESSION_CACHE = true;"
if text.count(flag) != 1:
    raise RuntimeError(f'flag anchor count={text.count(flag)}')
text = text.replace(flag, flag + '\n' + marker, 1)

checks = [
    'const hasStableLibraryResult = (group: any) => {',
    "return { status: 'completed' as string | null, raw: resolved.raw || '' };",
    'if (hasStableLibraryResult(group)) return false;',
    "!hasStableLibraryResult(group) && (isTrackStuck(group)",
    "!hasCompletedRescue && !isStalePending",
]
for check in checks:
    if check not in text:
        raise RuntimeError(f'missing verification: {check}')

path.write_text(text, encoding='utf-8')
print('Library status monotonic guard applied')
