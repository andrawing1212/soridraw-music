// The canonical Music Note result may be confirmed on a different device.
// Match its exact favorite document first; never attach an unrelated Recent
// song that already has a distinct favorite link.
export type StudioHeartRecentLinkedSong = {
  favoriteFirestoreId?: unknown;
  musicNoteFavoriteId?: unknown;
};

export const canProjectStudioHeartCanonicalToRecent = (
  documentId: string,
  desiredSaved: boolean,
  pending: { desiredSaved: boolean } | null,
  preview: { desiredSaved: boolean } | null,
): boolean => (
  Boolean(String(documentId || '').trim())
  && (!pending || pending.desiredSaved === desiredSaved)
  && (!preview || preview.desiredSaved === desiredSaved)
);

export const matchStudioHeartCanonicalRecentSongs = <T extends StudioHeartRecentLinkedSong>(
  songs: readonly T[],
  documentId: string,
  canonicalSource: T | null,
  sameRecentSong: (left: T, right: T) => boolean,
): T[] => {
  const target = String(documentId || '').trim();
  if (!target) return [];
  return (songs || []).filter((song) => {
    if (!song || typeof song !== 'object') return false;
    const linked = String(song.favoriteFirestoreId || song.musicNoteFavoriteId || '').trim();
    if (linked) return linked === target;
    return Boolean(canonicalSource && sameRecentSong(song, canonicalSource));
  });
};
