from pathlib import Path

MARKER = 'SORIDRAW_EXPLORE_8C_THEME_STATUS_FINAL_951'


# -----------------------------------------------------------------------------
# 1) Switching from Classic Music Note / Library into Split must enter the real
#    /studio workspace, not keep the old standalone route inside a split frame.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    select_index = app.find('  const selectStudioWorkspaceView = useCallback')
    if select_index < 0:
        raise RuntimeError('951 App selectStudioWorkspaceView not found')

    callback_end = app.find('  }, [', select_index)
    if callback_end < 0:
        callback_end = app.find('  }, []);', select_index)
    if callback_end < 0:
        raise RuntimeError('951 App selectStudioWorkspaceView callback end not found')
    callback_line_end = app.find('\n', callback_end)
    if callback_line_end < 0:
        callback_line_end = len(app)
    insert_at = callback_line_end

    transition_effect = r'''

  // 951: A Classic Music Note/Library route is a standalone page. When the
  // user switches that live page into Split, move into the canonical Studio
  // workspace route instead of wrapping the old standalone route in split rails.
  useEffect(() => {
    const redirectLegacyStandaloneRouteIntoSplit = (requestedMode?: unknown) => {
      const mode = requestedMode === 'studio-black' ? 'studio-black' : readSoridrawDisplayMode();
      if (mode !== 'studio-black') return;

      const params = new URLSearchParams(location.search);
      // Shared/public deep links remain independent and must never be swallowed
      // by an appearance change.
      if (params.has('note') || params.has('track') || params.has('playlist')) return;

      const view: StudioWorkspaceView | null = location.pathname === '/history'
        ? 'music-note'
        : location.pathname === '/suno-library'
          ? 'library'
          : null;
      if (!view) return;

      selectStudioWorkspaceView(view);
      navigate(`/studio?view=${view}`, { replace: true });
    };

    redirectLegacyStandaloneRouteIntoSplit();

    const handleThemeChange = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
      redirectLegacyStandaloneRouteIntoSplit(mode);
    };

    window.addEventListener('soridraw-theme-change', handleThemeChange as EventListener);
    return () => window.removeEventListener('soridraw-theme-change', handleThemeChange as EventListener);
  }, [location.pathname, location.search, navigate, selectStudioWorkspaceView]);
'''
    app = app[:insert_at] + transition_effect + app[insert_at:]
    first_const = app.find('const ')
    if first_const < 0:
        raise RuntimeError('951 App marker anchor missing')
    app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]

app_checks = [
    "window.addEventListener('soridraw-theme-change'",
    "location.pathname === '/history'",
    "location.pathname === '/suno-library'",
    "navigate(`/studio?view=${view}`, { replace: true })",
    "params.has('note') || params.has('track') || params.has('playlist')",
]
for fragment in app_checks:
    if fragment not in app:
        raise RuntimeError(f'951 App verification failed: {fragment}')

app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# 2) A completed Suno status check must clear stale warning fields and update the
#    live Library state immediately. Firestore-only completion left the UI on the
#    previous pending/stale object until another listener/cache refresh arrived.
# -----------------------------------------------------------------------------
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
library_marker = '// SORIDRAW_EXPLORE_8C_STATUS_SYNC_951'

if library_marker not in library:
    sync_start = library.find('  const syncStatusResponseToFirestore = async (trackId: string, taskId: string, data: any) => {')
    sync_end = library.find('\n  };', sync_start)
    if sync_start < 0 or sync_end < 0:
        raise RuntimeError('951 Library status sync function not found')
    sync_end += len('\n  };')
    block = library[sync_start:sync_end]

    completed_before = """    } else if (resolved.status === 'completed') {
      updatePayload.status = 'completed';
      updatePayload.completedAt = serverTimestamp();
      const nextSunoData = extractStatusSunoData(data);
      if (nextSunoData) updatePayload.sunoData = nextSunoData;"""
    completed_after = """    } else if (resolved.status === 'completed') {
      updatePayload.status = 'completed';
      updatePayload.completedAt = serverTimestamp();
      // Clear any stale timeout/failure metadata from older recovery paths.
      updatePayload.failedAt = null;
      updatePayload.failureReason = null;
      updatePayload.errorMessage = null;
      const nextSunoData = extractStatusSunoData(data);
      if (nextSunoData) updatePayload.sunoData = nextSunoData;"""
    if completed_before not in block:
        raise RuntimeError('951 Library completed payload anchor not found')
    block = block.replace(completed_before, completed_after, 1)

    write_before = """    if (resolved.status) {
      await updateDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId), updatePayload);
    } else {
      await updateDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId), updatePayload);
    }

    return resolved;"""
    write_after = """    if (resolved.status) {
      await updateDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId), updatePayload);
    } else {
      await updateDoc(doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId), updatePayload);
    }

    // Reflect confirmed status immediately in the mounted Library and its shared
    // SPA session cache. This prevents a completed response from leaving the old
    // `상태 확인 필요` badge visible until a later Firestore/cache refresh.
    if (resolved.status) {
      const localPatch: any = {
        status: resolved.status,
        apiStatusResponse: data || null,
        lastStatusRaw: resolved.raw || null,
      };
      if (resolved.status === 'completed') {
        localPatch.failedAt = null;
        localPatch.failureReason = null;
        localPatch.errorMessage = null;
        if (updatePayload.sunoData) localPatch.sunoData = updatePayload.sunoData;
      } else if (resolved.status === 'failed') {
        localPatch.failureReason = updatePayload.failureReason || null;
        localPatch.errorMessage = updatePayload.failureReason || null;
      }

      setTracks((prev) => prev.map((track: any) =>
        String(track?.id || '') === String(trackId)
          ? { ...track, ...localPatch }
          : track
      ));

      if (libraryWorkspaceSession?.uid === currentUser.uid) {
        libraryWorkspaceSession.tracks = libraryWorkspaceSession.tracks.map((track: any) =>
          String(track?.id || '') === String(trackId)
            ? { ...track, ...localPatch }
            : track
        );
        saveLibraryWorkspaceTrackCache(currentUser.uid, libraryWorkspaceSession.tracks);
        emitLibraryWorkspaceSession(libraryWorkspaceSession);
      }
    }

    return resolved;"""
    if write_before not in block:
        raise RuntimeError('951 Library Firestore write anchor not found')
    block = block.replace(write_before, write_after, 1)

    library = library[:sync_start] + block + library[sync_end:]
    library = library.replace('// SORIDRAW_EXPLORE_8C_STALE_LIBRARY_RECOVERY_950', '// SORIDRAW_EXPLORE_8C_STALE_LIBRARY_RECOVERY_950\n' + library_marker, 1)

library_checks = [
    'updatePayload.failureReason = null;',
    'updatePayload.errorMessage = null;',
    'setTracks((prev) => prev.map((track: any) =>',
    'libraryWorkspaceSession.tracks = libraryWorkspaceSession.tracks.map',
    'emitLibraryWorkspaceSession(libraryWorkspaceSession);',
]
for fragment in library_checks:
    if fragment not in library:
        raise RuntimeError(f'951 Library verification failed: {fragment}')

library_path.write_text(library, encoding='utf-8')
print('apply-951: split theme transition + completed Library status live sync verified')
