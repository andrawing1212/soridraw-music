from pathlib import Path

MARKER = '// SORIDRAW_LIBRARY_PLAYBACK_DELETE_CONSISTENCY_954'
path = Path('src/pages/SunoLibraryPage.tsx')
text = path.read_text(encoding='utf-8')

if MARKER in text:
    print('apply-954: already applied')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-954: anchor not found: {label}')
    text = text.replace(old, new, 1)


old_audio = """  const getAudioUrl = (item: any, group: any) => {
    if (group?.audioValidationStatus === 'pending_or_empty' || group?.audioValidationStatus === 'missing') return '';
    return item?.audioUrl || item?.streamAudioUrl || item?.audio_url || item?.stream_audio_url || item?.sourceAudioUrl || item?.source_audio_url || item?.sourceStreamAudioUrl || item?.source_stream_audio_url || group?.audioUrl || group?.streamAudioUrl || group?.audio_url || group?.stream_audio_url || '';
  };"""
new_audio = """  const getPlayableUrlFromSource = (source: any) => {
    if (!source || typeof source !== 'object') return '';
    const candidates = [
      source.audioUrl,
      source.streamAudioUrl,
      source.audio_url,
      source.stream_audio_url,
      source.url,
      source.sourceAudioUrl,
      source.source_audio_url,
      source.sourceStreamAudioUrl,
      source.source_stream_audio_url,
    ];
    for (const candidate of candidates) {
      const normalized = typeof candidate === 'string' ? candidate.trim() : '';
      if (normalized) return normalized;
    }
    return '';
  };

  const getAudioUrl = (item: any, group: any) => {
    return getPlayableUrlFromSource(item) || getPlayableUrlFromSource(group) || '';
  };"""
replace_once(old_audio, new_audio, 'audio resolver')

old_extract = """    return [{
      audioUrl: group?.audioUrl || group?.streamAudioUrl,
      title: group?.title,
      imageUrl: group?.imageUrl,
      duration: getDuration(group, group),
      hidden: !!group?.hidden
    }];"""
new_extract = """    const playableUrl = getPlayableUrlFromSource(group);
    return [{
      audioUrl: playableUrl,
      streamAudioUrl: playableUrl,
      url: playableUrl,
      title: group?.title,
      imageUrl: group?.imageUrl || group?.image_url,
      duration: getDuration(group, group),
      hidden: !!group?.hidden
    }];"""
replace_once(old_extract, new_extract, 'root fallback url')

# Previous cache stages can reshape this helper, so replace it by function boundaries
# instead of depending on one historical body string.
remove_start = text.find('  const removeWorkspaceTracksLocally = (trackIds: string[]) => {')
remove_end = text.find('\n  useEffect(() => {', remove_start)
if remove_start < 0 or remove_end < 0:
    raise RuntimeError('apply-954: removeWorkspaceTracksLocally boundaries not found')
new_remove = """  const syncLibraryWorkspaceSessionTracks = (uid: string, nextTracks: any[]) => {
    if (!uid || libraryWorkspaceSession?.uid !== uid) return;
    libraryWorkspaceSession.tracks = nextTracks;
    saveLibraryWorkspaceTrackCache(uid, nextTracks);
    emitLibraryWorkspaceSession(libraryWorkspaceSession);
  };

  const patchWorkspaceTrackLocally = (trackId: string, updater: (track: any) => any) => {
    const safeTrackId = String(trackId || '').trim();
    if (!safeTrackId) return;
    const uid = user?.uid || appUser?.uid || auth.currentUser?.uid;
    setTracks((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((track: any) =>
        String(track?.id || '').trim() === safeTrackId ? updater(track) : track
      );
      if (uid) {
        saveWorkspaceTrackCache(uid, next);
        syncLibraryWorkspaceSessionTracks(uid, next);
      }
      return next;
    });
  };

  const removeWorkspaceTracksLocally = (trackIds: string[]) => {
    const removedIds = new Set(trackIds.map((id) => String(id || '').trim()).filter(Boolean));
    if (removedIds.size === 0) return;
    const uid = user?.uid || appUser?.uid || auth.currentUser?.uid;
    setTracks((prev) => {
      const next = (Array.isArray(prev) ? prev : []).filter(
        (track: any) => !removedIds.has(String(track?.id || '').trim())
      );
      if (uid) {
        saveWorkspaceTrackCache(uid, next);
        syncLibraryWorkspaceSessionTracks(uid, next);
      }
      return next;
    });
  };
"""
text = text[:remove_start] + new_remove + text[remove_end:]

# Bulk restore: keep mounted state/session/cache in sync.
replace_once(
    "          await updateDoc(trackRef, { sunoData: nextSunoData, hidden: false, deletedAt: null });",
    "          await updateDoc(trackRef, { sunoData: nextSunoData, hidden: false, deletedAt: null });\n          patchWorkspaceTrackLocally(groupId, (current) => ({ ...current, sunoData: nextSunoData, hidden: false, deletedAt: null }));",
    'bulk restore child'
)
replace_once(
    "          await updateDoc(trackRef, { hidden: false, deletedAt: null });",
    "          await updateDoc(trackRef, { hidden: false, deletedAt: null });\n          patchWorkspaceTrackLocally(groupId, (current) => ({ ...current, hidden: false, deletedAt: null }));",
    'bulk restore root'
)

# Bulk permanent delete: partial group must disappear immediately from local caches too.
replace_once(
    "            await updateDoc(trackRef, { sunoData: nextSunoData });",
    "            await updateDoc(trackRef, { sunoData: nextSunoData });\n            patchWorkspaceTrackLocally(groupId, (current) => ({ ...current, sunoData: nextSunoData }));",
    'bulk permanent partial'
)

# Bulk hide: update local state after Firestore succeeds.
old_bulk_hide = """              await updateDoc(trackRef, updatePayload);
            } else {
              await updateDoc(trackRef, { hidden: true, isPublic: false, deletedAt: serverTimestamp() });
            }"""
new_bulk_hide = """              await updateDoc(trackRef, updatePayload);
              patchWorkspaceTrackLocally(groupId, (current) => ({ ...current, ...updatePayload, sunoData: nextSunoData }));
            } else {
              const deletedAt = serverTimestamp();
              await updateDoc(trackRef, { hidden: true, isPublic: false, deletedAt });
              patchWorkspaceTrackLocally(groupId, (current) => ({ ...current, hidden: true, isPublic: false, deletedAt }));
            }"""
replace_once(old_bulk_hide, new_bulk_hide, 'bulk hide')

# Single-item delete/restore: preserve parent document unless the last persisted subtrack is permanently deleted.
start = text.find('  const confirmDelete = async () => {')
end = text.find('\n  const isModalOpen =', start)
if start < 0 or end < 0:
    raise RuntimeError('apply-954: confirmDelete boundaries not found')

new_confirm = """  const confirmDelete = async () => {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { doc, updateDoc, serverTimestamp, deleteDoc } = await import('firebase/firestore');
      const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', deleteTarget.groupId);
      const sourceGroup = deleteTarget.group || {};
      const hasPersistedSunoData = Array.isArray(sourceGroup.sunoData) && sourceGroup.sunoData.length > 0;
      let deletedTrackDocument = false;

      if (hasPersistedSunoData) {
        const nextSunoData = [...sourceGroup.sunoData];
        if (deleteTarget.action === 'hide') {
          if (nextSunoData[deleteTarget.itemIndex]) nextSunoData[deleteTarget.itemIndex] = { ...nextSunoData[deleteTarget.itemIndex], hidden: true };
        } else if (deleteTarget.action === 'restore') {
          if (nextSunoData[deleteTarget.itemIndex]) nextSunoData[deleteTarget.itemIndex] = { ...nextSunoData[deleteTarget.itemIndex], hidden: false };
        } else if (deleteTarget.action === 'permanentDelete') {
          nextSunoData.splice(deleteTarget.itemIndex, 1);
        }

        if (deleteTarget.action === 'permanentDelete' && nextSunoData.length === 0) {
          await deleteDoc(trackRef);
          deletedTrackDocument = true;
        } else {
          const allHidden = nextSunoData.length > 0 && nextSunoData.every((entry: any) => entry?.hidden === true);
          const updatePayload: any = { sunoData: nextSunoData, hidden: allHidden };
          if (allHidden) {
            updatePayload.isPublic = false;
            updatePayload.deletedAt = serverTimestamp();
          } else if (deleteTarget.action === 'restore') {
            updatePayload.deletedAt = null;
          }
          await updateDoc(trackRef, updatePayload);
          patchWorkspaceTrackLocally(deleteTarget.groupId, (current) => ({ ...current, ...updatePayload, sunoData: nextSunoData }));
        }
      } else {
        if (deleteTarget.action === 'hide') {
          const deletedAt = serverTimestamp();
          const updatePayload = { hidden: true, isPublic: false, deletedAt };
          await updateDoc(trackRef, updatePayload);
          patchWorkspaceTrackLocally(deleteTarget.groupId, (current) => ({ ...current, ...updatePayload }));
        } else if (deleteTarget.action === 'restore') {
          const updatePayload = { hidden: false, deletedAt: null };
          await updateDoc(trackRef, updatePayload);
          patchWorkspaceTrackLocally(deleteTarget.groupId, (current) => ({ ...current, ...updatePayload }));
        } else if (deleteTarget.action === 'permanentDelete') {
          await deleteDoc(trackRef);
          deletedTrackDocument = true;
        }
      }

      if (deletedTrackDocument) removeWorkspaceTracksLocally([deleteTarget.groupId]);
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      setDeleteError('작업에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };"""
text = text[:start] + new_confirm + text[end:]

# Normalize current player URL identity too.
old_current = """  const getCurrentPlayableUrl = () => {
    const parent: any = currentTrack?.parent || {};
    return normalizePlayableUrl(
      (currentTrack as any)?.url ||
      (currentTrack as any)?.audioUrl ||
      parent.audioUrl ||
      parent.streamAudioUrl ||
      parent.audio_url
    );
  };"""
new_current = """  const getCurrentPlayableUrl = () => {
    const parent: any = currentTrack?.parent || {};
    return normalizePlayableUrl(getPlayableUrlFromSource(currentTrack as any) || getPlayableUrlFromSource(parent));
  };"""
replace_once(old_current, new_current, 'current player url')

export_anchor = 'export default function SunoLibraryPage'
if export_anchor not in text:
    raise RuntimeError('apply-954: export anchor missing')
text = text.replace(export_anchor, MARKER + '\n' + export_anchor, 1)

for fragment in [
    'const getPlayableUrlFromSource = (source: any) =>',
    'source.url,',
    'const patchWorkspaceTrackLocally =',
    'syncLibraryWorkspaceSessionTracks',
    'patchWorkspaceTrackLocally(deleteTarget.groupId',
    'patchWorkspaceTrackLocally(groupId',
]:
    if fragment not in text:
        raise RuntimeError(f'apply-954 verification failed: {fragment}')

path.write_text(text, encoding='utf-8')
print('apply-954: playback URL + delete/cache consistency applied')
