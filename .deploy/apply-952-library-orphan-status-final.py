from pathlib import Path

MARKER = '// SORIDRAW_LIBRARY_ORPHAN_STATUS_FINAL_952'
path = Path('src/pages/SunoLibraryPage.tsx')
text = path.read_text(encoding='utf-8')

if MARKER in text:
    print('apply-952: already applied')
    raise SystemExit(0)

# 1) Old tasks that are still reported as processing must never be revived as
#    an endless spinner after a manual status check. A >10m task with no usable
#    completion result is terminally unresolved, not actively generating.
old_sync = """      const resolved = data ? await syncStatusResponseToFirestore(trackId, taskId, data) : { status: null, raw: '' };

      if (resolved.status === 'completed') {"""
new_sync = """      const previewResolved = data ? resolveSunoStatusFromResponse(data) : { status: null, raw: '' };
      if (group && isTrackPastAutoCheckWindow(group) && previewResolved.status === 'processing') {
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', trackId);
        const terminalReason = '서버 생성 상태 장기 미확정 (10분 초과)';
        await updateDoc(trackRef, {
          status: 'failed',
          failedAt: serverTimestamp(),
          failureReason: terminalReason,
          errorMessage: terminalReason,
          lastStatusRaw: previewResolved.raw || 'processing | stale_manual_check',
          lastStatusCheckedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const localPatch = {
          status: 'failed',
          failureReason: terminalReason,
          errorMessage: terminalReason,
        };
        setTracks((prev) => prev.map((track: any) =>
          String(track?.id || '') === String(trackId) ? { ...track, ...localPatch } : track
        ));
        if (libraryWorkspaceSession?.uid === user.uid) {
          libraryWorkspaceSession.tracks = libraryWorkspaceSession.tracks.map((track: any) =>
            String(track?.id || '') === String(trackId) ? { ...track, ...localPatch } : track
          );
          saveLibraryWorkspaceTrackCache(user.uid, libraryWorkspaceSession.tracks);
          emitLibraryWorkspaceSession(libraryWorkspaceSession);
        }
        alert('이 작업은 오래 전에 종료됐지만 서버에서 완료 음원 정보를 확인하지 못했습니다. 다시 생성해주세요.');
        return;
      }

      const resolved = data ? await syncStatusResponseToFirestore(trackId, taskId, data) : { status: null, raw: '' };

      if (resolved.status === 'completed') {"""
if old_sync not in text:
    raise RuntimeError('apply-952: manual status sync anchor not found')
text = text.replace(old_sync, new_sync, 1)

# 2) A record can be server-completed while its historic Firestore payload has
#    no playable audio URL. That is an incomplete legacy/orphan record, not a
#    pending generation. Never show the blue infinite spinner in that state.
old_state = """                      const isFailed = group.status === 'failed';
                      const isCompleted = Boolean(audioUrl && (group.status === 'completed' || group.status === 'success' || hasValidDuration));
                      const isStalePending = !isFailed && !audioUrl && isTrackPastAutoCheckWindow(group);
                      const isPending = !isFailed && !audioUrl && !isStalePending;"""
new_state = """                      const normalizedGroupStatus = String(group.status || '').trim().toLowerCase();
                      const isFailed = ['failed', 'cancelled', 'canceled'].includes(normalizedGroupStatus);
                      const isCompletedStatus = ['completed', 'success', 'complete'].includes(normalizedGroupStatus);
                      const isPendingStatus = ['processing', 'submitted', 'pending', 'generating', 'queued'].includes(normalizedGroupStatus);
                      const isCompleted = Boolean(audioUrl && (isCompletedStatus || hasValidDuration));
                      const isCompletedWithoutAudio = isCompletedStatus && !audioUrl;
                      const isStalePending = !isFailed && isPendingStatus && !audioUrl && isTrackPastAutoCheckWindow(group);
                      const isPending = !isFailed && isPendingStatus && !audioUrl && !isStalePending;"""
if old_state not in text:
    raise RuntimeError('apply-952: Library row status state anchor not found')
text = text.replace(old_state, new_state, 1)

old_row = """                            ) : isStalePending ? (
                              <span className=\"text-xs opacity-60 truncate flex items-center gap-1.5 text-amber-300\">
                                <RefreshCw className=\"w-3.5 h-3.5\" />
                                상태 확인 필요
                              </span>
                            ) : isPending ? ("""
new_row = """                            ) : isCompletedWithoutAudio ? (
                              <span className=\"text-xs opacity-70 truncate flex items-center gap-1.5 text-amber-300\">
                                <AlertCircle className=\"w-3.5 h-3.5\" />
                                완료 · 재생 URL 없음
                              </span>
                            ) : isStalePending ? (
                              <span className=\"text-xs opacity-60 truncate flex items-center gap-1.5 text-amber-300\">
                                <RefreshCw className=\"w-3.5 h-3.5\" />
                                상태 확인 필요
                              </span>
                            ) : isPending ? ("""
if old_row not in text:
    raise RuntimeError('apply-952: Library row stale label anchor not found')
text = text.replace(old_row, new_row, 1)

# 3) Do not tell the user a completed response is fully usable when the status
#    response itself still contains no playable audio URL. The status is done,
#    but the historic audio payload is incomplete.
old_completed_alert = """      if (resolved.status === 'completed') {
        alert('생성 완료되었습니다.');"""
new_completed_alert = """      if (resolved.status === 'completed') {
        const resolvedSunoData = extractStatusSunoData(data);
        const resolvedHasAudio = Array.isArray(resolvedSunoData) && resolvedSunoData.some((entry: any) =>
          Boolean(normalizePlayableUrl(entry?.audio_url || entry?.audioUrl || entry?.url || ''))
        );
        const currentHasAudio = Boolean(group && extractSunoData(group).some((entry: any) =>
          Boolean(getAudioUrl(entry, group))
        ));
        alert(resolvedHasAudio || currentHasAudio
          ? '생성 완료되었습니다.'
          : '생성 완료 상태지만 재생 음원 정보를 받지 못했습니다.');"""
if old_completed_alert not in text:
    raise RuntimeError('apply-952: completed alert anchor not found')
text = text.replace(old_completed_alert, new_completed_alert, 1)

text = text.replace('// SORIDRAW_EXPLORE_8C_STATUS_SYNC_951', '// SORIDRAW_EXPLORE_8C_STATUS_SYNC_951\n' + MARKER, 1)

checks = [
    "previewResolved.status === 'processing'",
    "서버 생성 상태 장기 미확정 (10분 초과)",
    'const isCompletedWithoutAudio = isCompletedStatus && !audioUrl;',
    '완료 · 재생 URL 없음',
    '생성 완료 상태지만 재생 음원 정보를 받지 못했습니다.',
]
for fragment in checks:
    if fragment not in text:
        raise RuntimeError(f'apply-952: verification failed: {fragment}')

path.write_text(text, encoding='utf-8')
print('apply-952: orphan completed/processing Library records can no longer become infinite generating')
