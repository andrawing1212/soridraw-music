/**
 * Preview-only Recent edits have already painted the receiving device, but
 * their 150-second canonical batch can still be unsettled. A bounded
 * Firestore aggregate gap-read must NOT roll that newer text backwards.
 */
const previewEqual = (remote: Record<string, any>, local: Record<string, any>): boolean => {
  for (const key of ['title','koreanTitle','englishTitle','prompt']) {
    if ((remote[key] ?? null) !== (local[key] ?? null)) return false;
  }
  for (const key of ['korean','english','foreign']) {
    if ((remote.lyrics?.[key] ?? null) !== (local.lyrics?.[key] ?? null)) return false;
  }
  const remoteLanguages = remote.appliedKeywords?.lyricsByLanguage;
  const localLanguages = local.appliedKeywords?.lyricsByLanguage;
  if (remoteLanguages || localLanguages) {
    if (JSON.stringify(remoteLanguages ?? null) !== JSON.stringify(localLanguages ?? null)) return false;
  }
  return true;
};

export const protectRecentCanonicalSnapshotFromPreview453 = <T extends Record<string, any>>(
  canonicalSongs: T[],
  cachedSongs: T[],
  songId: (song: T) => string,
): { songs: T[]; hasUnsettledPreview: boolean } => {
  const songs = canonicalSongs.map((song) => ({ ...song }));
  let hasUnsettledPreview = false;
  for (const cached of cachedSongs) {
    if (cached?.__recentSongEditPreview !== true) continue;
    const id = String(songId(cached) || '').trim();
    // Unknown identity must not result in silent deletion of the only copy.
    if (!id) {
      hasUnsettledPreview = true;
      if (!songs.includes(cached)) songs.push({ ...cached });
      continue;
    }
    const index = songs.findIndex((song) => String(songId(song) || '').trim() === id);
    if (index < 0) {
      hasUnsettledPreview = true;
      songs.push({ ...cached });
      continue;
    }
    if (!previewEqual(songs[index], cached)) {
      hasUnsettledPreview = true;
      songs[index] = { ...songs[index], ...cached };
    }
    // When the exact latest text/lyrics finally appear in canonical, leave
    // the canonical row untouched and retire the transient preview marker.
  }
  return { songs, hasUnsettledPreview };
};
