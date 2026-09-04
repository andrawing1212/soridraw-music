from pathlib import Path

path = Path('src/pages/SunoLibraryPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_LIBRARY_ACTIVE_GENERATION_WINDOW_20260904'
if marker in text:
    print('already applied')
    raise SystemExit(0)

anchor = "  const isTrackStuck = (group: any) => {"
if anchor not in text:
    raise RuntimeError('isTrackStuck anchor missing')
helper = r'''  const getLibraryGenerationCreatedAtMs = (group: any): number => {
    const createdAt = group?.createdAt;
    if (!createdAt) return 0;
    try {
      if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
      if (typeof createdAt?.seconds === 'number') return createdAt.seconds * 1000;
      if (typeof createdAt?._seconds === 'number') return createdAt._seconds * 1000;
      if (typeof createdAt?.toDate === 'function') return createdAt.toDate().getTime();
      if (typeof createdAt === 'string' || typeof createdAt === 'number') {
        const parsed = new Date(createdAt).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
      }
    } catch {}
    return 0;
  };

  const hasAnyPlayableLibraryOutput = (group: any): boolean => {
    const items = extractSunoData(group);
    const hasDirectOutput = items.some((item: any) => Boolean(String(getAudioUrl(item, group) || '').trim()));
    if (hasDirectOutput) return true;
    const rescueEntries = Object.values(group?.audioRescue || {}) as any[];
    return rescueEntries.some((entry: any) => Boolean(String(entry?.audioUrl || entry?.audio_url || entry?.url || '').trim()));
  };

  // Only a genuinely recent pending task may be labelled `생성 중`.
  // Old/cache-restored pending records are historical reconciliation states,
  // not active generation. Missing timestamps are treated as non-active too.
  const isLibraryActiveGeneration = (group: any): boolean => {
    if (!group?.taskId) return false;
    const status = String(group?.status || '').trim().toLowerCase();
    if (!['processing', 'submitted', 'pending', 'generating', 'queued', 'queue', 'running', 'in_progress'].includes(status)) return false;
    const createdAtMs = getLibraryGenerationCreatedAtMs(group);
    if (!createdAtMs) return false;
    const elapsedMs = Date.now() - createdAtMs;
    return elapsedMs >= 0 && elapsedMs <= 10 * 60 * 1000;
  };

'''
text = text.replace(anchor, helper + anchor, 1)

old_display = """    const normalizedDisplayStatus = String(group.status || '').trim().toLowerCase();
    const displayStatus = hasCompletedRescue
      && ['processing', 'submitted', 'pending', 'generating', 'queued'].includes(normalizedDisplayStatus)
      ? 'completed'
      : normalizedDisplayStatus;"""
new_display = """    const normalizedDisplayStatus = String(group.status || '').trim().toLowerCase();
    const isPendingDisplayStatus = ['processing', 'submitted', 'pending', 'generating', 'queued', 'queue', 'running', 'in_progress'].includes(normalizedDisplayStatus);
    const hasAnyPlayableOutput = hasAnyPlayableLibraryOutput(group);
    const displayStatus = isPendingDisplayStatus && !isLibraryActiveGeneration(group) && (hasCompletedRescue || hasAnyPlayableOutput)
      ? 'completed'
      : normalizedDisplayStatus;"""
if old_display not in text:
    raise RuntimeError('status badge display anchor missing')
text = text.replace(old_display, new_display, 1)

old_badge = """      case 'pending':
        if (isTrackPastAutoCheckWindow(group)) {"""
new_badge = """      case 'pending':
        if (!isLibraryActiveGeneration(group)) {"""
if old_badge not in text:
    raise RuntimeError('status badge pending anchor missing')
text = text.replace(old_badge, new_badge, 1)

old_row = """                      const isCompletedWithoutAudio = isCompletedStatus && !audioUrl && !hasCompletedRescue;
                      const isStalePending = !isFailed && isPendingStatus && !audioUrl && !hasCompletedRescue && isTrackPastAutoCheckWindow(group);
                      const isPending = !isFailed && isPendingStatus && !audioUrl && !hasCompletedRescue && !isStalePending;"""
new_row = """                      const isCompletedWithoutAudio = isCompletedStatus && !audioUrl && !hasCompletedRescue;
                      const isActiveGeneration = isPendingStatus && isLibraryActiveGeneration(group);
                      const isStalePending = !isFailed && isPendingStatus && !audioUrl && !hasCompletedRescue && !isActiveGeneration;
                      const isPending = !isFailed && isPendingStatus && !audioUrl && !hasCompletedRescue && isActiveGeneration;"""
if old_row not in text:
    raise RuntimeError('row pending display anchor missing')
text = text.replace(old_row, new_row, 1)

text = text.replace('// SORIDRAW_LIBRARY_STATUS_MONOTONIC_20260904', '// SORIDRAW_LIBRARY_STATUS_MONOTONIC_20260904\n' + marker, 1)

checks = [
    'const isLibraryActiveGeneration = (group: any): boolean => {',
    'elapsedMs <= 10 * 60 * 1000',
    'if (!isLibraryActiveGeneration(group)) {',
    'const isActiveGeneration = isPendingStatus && isLibraryActiveGeneration(group);',
]
for item in checks:
    if item not in text:
        raise RuntimeError(f'verification failed: {item}')

path.write_text(text, encoding='utf-8')
print('Library active-generation display guard applied')
