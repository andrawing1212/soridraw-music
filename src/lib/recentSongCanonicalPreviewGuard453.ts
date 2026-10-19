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
      const canonical = songs[index];
      // Canonical writes accepted after this draft must win when both edit
      // timestamps are available. Do not revive an older RTDB preview.
      const canonicalEditAt = Math.max(
        Number(canonical?.updatedAtMs || 0),
        Number(canonical?.appliedKeywords?.editedInStudioAt || 0),
      );
      const previewEditAt = Math.max(
        Number(cached?.updatedAtMs || 0),
        Number(cached?.appliedKeywords?.editedInStudioAt || 0),
      );
      if (canonicalEditAt > 0 && previewEditAt > 0 && canonicalEditAt > previewEditAt) {
        continue;
      }
      hasUnsettledPreview = true;
      // Keep only the text edited in Studio. Never let a pending draft
      // overwrite accepted save-heart identities, public/private flags,
      // locked state, owner metadata, Suno media or thumbnail revisions.
      const merged: T = { ...canonical };
      for (const key of ['title', 'koreanTitle', 'englishTitle', 'prompt'] as const) {
        if (Object.prototype.hasOwnProperty.call(cached, key)) {
          (merged as Record<string, any>)[key] = cached[key];
        }
      }
      if (Object.prototype.hasOwnProperty.call(cached, 'lyrics')) {
        if (cached.lyrics && typeof cached.lyrics === 'object'
          && canonical.lyrics && typeof canonical.lyrics === 'object') {
          const lyrics = { ...canonical.lyrics };
          for (const language of ['korean', 'english', 'foreign']) {
            if (Object.prototype.hasOwnProperty.call(cached.lyrics, language)) {
              lyrics[language] = cached.lyrics[language];
            }
          }
          (merged as Record<string, any>).lyrics = lyrics;
        } else {
          (merged as Record<string, any>).lyrics = cached.lyrics;
        }
      }
      const cachedLanguages = cached.appliedKeywords?.lyricsByLanguage;
      if (cachedLanguages && typeof cachedLanguages === 'object' && !Array.isArray(cachedLanguages)) {
        (merged as Record<string, any>).appliedKeywords = {
          ...(canonical.appliedKeywords || {}),
          lyricsByLanguage: {
            ...(canonical.appliedKeywords?.lyricsByLanguage || {}),
            ...cachedLanguages,
          },
        };
      }
      (merged as Record<string, any>).__recentSongEditPreview = true;
      songs[index] = merged;
    }
    // When the exact latest text/lyrics finally appear in canonical, leave
    // the canonical row untouched and retire the transient preview marker.
  }
  return { songs, hasUnsettledPreview };
};
