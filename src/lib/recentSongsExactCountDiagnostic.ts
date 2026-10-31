// Read-only, single-UID counters for the on-demand Studio Recent investigation.
// Never enumerate storage keys, log song content, or mutate browser/server data.
export type RecentLocalSlot = { status: 'present' | 'missing' | 'invalid' | 'blocked'; count: number };
export type RecentLocalSummary = { primary: RecentLocalSlot; backup: RecentLocalSlot };
export type RecentServerSummary = {
  exists: boolean;
  songsField: 'array' | 'missing' | 'other';
  rawCount: number;
  renderableCount: number;
};

const looksLikeRecentSong = (song: unknown): boolean => {
  if (!song || typeof song !== 'object') return false;
  const data = song as Record<string, unknown>;
  return Boolean(data.title || data.koreanTitle || data.englishTitle || data.prompt || data.lyrics);
};

const parseLocalSlot = (
  uid: string, key: string, field: 'history' | 'songs',
  getItem: (key: string) => string | null,
): RecentLocalSlot => {
  if (!uid) return { status: 'missing', count: 0 };
  let raw: string | null;
  try {
    raw = getItem(key);
  } catch {
    return { status: 'blocked', count: 0 };
  }
  if (raw === null) return { status: 'missing', count: 0 };
  try {
    const parsed = JSON.parse(raw);
    const songs = parsed?.[field];
    if (!Array.isArray(songs)) return { status: 'invalid', count: 0 };
    return { status: 'present', count: songs.filter(looksLikeRecentSong).length };
  } catch {
    return { status: 'invalid', count: 0 };
  }
};

export const summarizeExactRecentLocal = (
  uid: string, getItem: (key: string) => string | null,
): RecentLocalSummary => ({
  primary: parseLocalSlot(uid, `soridraw_recent_songs_cache_${uid}`, 'history', getItem),
  backup: parseLocalSlot(uid, `soridraw_recent_songs_cache_backup_${uid}`, 'songs', getItem),
});

export const summarizeExactRecentServer = (
  exists: boolean, data: Record<string, unknown> | undefined,
): RecentServerSummary => {
  if (!exists) return { exists: false, songsField: 'missing', rawCount: 0, renderableCount: 0 };
  const songs = data?.songs;
  return {
    exists: true,
    songsField: Array.isArray(songs) ? 'array' : songs === undefined ? 'missing' : 'other',
    rawCount: Array.isArray(songs) ? songs.length : 0,
    renderableCount: Array.isArray(songs) ? songs.filter(looksLikeRecentSong).length : 0,
  };
};
