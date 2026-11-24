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
  for (const key of ['secondaryLanguage','titleLanguages','titlesByLanguage','lyricLanguages']) {
    if (JSON.stringify(remote.appliedKeywords?.[key] ?? null) !== JSON.stringify(local.appliedKeywords?.[key] ?? null)) return false;
  }
  const remoteLanguages = remote.appliedKeywords?.lyricsByLanguage;
  const localLanguages = local.appliedKeywords?.lyricsByLanguage;
  if (remoteLanguages || localLanguages) {
    if (JSON.stringify(remoteLanguages ?? null) !== JSON.stringify(localLanguages ?? null)) return false;
  }
  // The canonical row may include additional concurrently committed entries.
  // Only require that every complete preview entry is actually present.
  if (local.lyricGenerationHistoryV1 && local.__recentSongHistoryIncomplete !== true) {
    for (const [lane, draft] of Object.entries(local.lyricGenerationHistoryV1) as [string, any][]) {
      const saved = remote.lyricGenerationHistoryV1?.[lane];
      if (!saved || saved.selectedId !== draft.selectedId || !draft.entries.every((x:any) => saved.entries.some((y:any) => JSON.stringify(x) === JSON.stringify(y)))) return false;
    }
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
          ...(pickRecentSongLiveAppliedKeywords457(cached.appliedKeywords || null) || {}),
          lyricsByLanguage: {
            ...(canonical.appliedKeywords?.lyricsByLanguage || {}),
            ...cachedLanguages,
          },
        };
      }
      if (cached.lyricGenerationHistoryV1 && cached.__recentSongHistoryIncomplete !== true) {
        const history = { ...(canonical.lyricGenerationHistoryV1 || {}) };
        for (const [lane,draft] of Object.entries(cached.lyricGenerationHistoryV1) as [string, any][]) {
          const entries = new Map((history[lane]?.entries || []).map((x:any) => [x.id,x]));
          for (const x of draft.entries) if (!entries.has(x.id)) entries.set(x.id,x);
          history[lane] = { entries: [...entries.values()].sort((a:any,b:any)=>a.at-b.at||a.id.localeCompare(b.id)), selectedId: draft.selectedId };
        }
        (merged as Record<string, any>).lyricGenerationHistoryV1 = history;
      }
      (merged as Record<string, any>).__recentSongEditPreview = true;
      songs[index] = merged;
    }
    // When the exact latest text/lyrics finally appear in canonical, leave
    // the canonical row untouched and retire the transient preview marker.
  }
  return { songs, hasUnsettledPreview };
};


// RTDB edit-preview can contain nullable favorite IDs and other old metadata.
// It is NOT an authoritative save-heart, publication, lock or Suno mutation.
// Whitelist only live text fields before composing it into the on-screen row.
export const pickRecentSongLiveTextPreview457 = (
  incoming: Record<string, any>,
): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const key of ['title', 'koreanTitle', 'englishTitle', 'prompt', 'lyrics', 'updatedAtMs']) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) result[key] = incoming[key];
  }
  result.__recentSongEditPreview = true;
  return result;
};


// Likewise an RTDB text draft cannot replace canonical generation identities
// or unrelated generation options with null compact-preview placeholders.
export const pickRecentSongLiveAppliedKeywords457 = (
  incoming: Record<string, any> | null,
): Record<string, any> | null => {
  if (!incoming) return null;
  const result: Record<string, any> = {};
  for (const key of ['secondaryLanguage','titleLanguages','titlesByLanguage','lyricLanguages','lyricsByLanguage','hasAddedLyricsLanguage','addedLyricsLanguage','addedLyricsLanguageAt','isNoLyrics','editedInStudio','editedInStudioAt']) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)
      && incoming[key] !== null && incoming[key] !== undefined) {
      result[key] = incoming[key];
    }
  }
  return result;
};
