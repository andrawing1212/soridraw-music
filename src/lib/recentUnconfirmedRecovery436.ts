// app436 — recover only demonstrably newer, locally retained generated rows.
// This helper is pure: it never reads/writes shared user data or makes a
// cache look canonical. A skipped recovery retains the local only-copy.
export type RecentRecoverySong = Record<string, any>;
export type RecentRecoveryPlan = { songs: RecentRecoverySong[]; recovered: RecentRecoverySong[] };

export const planRecentUnconfirmedRecovery436 = (
  canonical: readonly RecentRecoverySong[],
  local: readonly RecentRecoverySong[],
  unconfirmedIds: readonly string[],
  canonicalVersion: number,
  getStableId: (song: RecentRecoverySong) => string | null,
): RecentRecoveryPlan | null => {
  if (!Number.isSafeInteger(canonicalVersion) || canonicalVersion <= 0) return null;
  if (!Array.isArray(canonical) || !Array.isArray(local) || !Array.isArray(unconfirmedIds)) return null;
  if (canonical.length > 10 || local.length > 10 || unconfirmedIds.length > 10) return null;
  const canonicalIds = new Set(canonical.map(getStableId).filter(Boolean));
  const localById = new Map<string, RecentRecoverySong>();
  for (const song of local) {
    const id = getStableId(song);
    if (id && !localById.has(id)) localById.set(id, song);
  }

  // Never reinterpret an arbitrary cache-only song as a new generation. The
  // existing generation-time durable UID-scoped unconfirmed marker is required.
  const missing = [...new Set(unconfirmedIds)]
    .filter((id) => id && !canonicalIds.has(id));
  if (!missing.length || canonical.length + missing.length > 10) return null;
  const recovered: RecentRecoverySong[] = [];
  for (const id of missing) {
    const song = localById.get(id);
    const createdAt = Number(song?.createdAt || 0);
    // If a later canonical mutation occurred, this row might have been
    // deliberately removed. Never resurrect it without stronger provenance.
    if (!song || !Number.isSafeInteger(createdAt) || createdAt <= canonicalVersion) return null;
    recovered.push(song);
  }
  const finalSongs = [...recovered, ...canonical];
  if (finalSongs.length > 10) return null;
  return { songs: finalSongs, recovered };
};

// Apply one settled Recent text edit to its exact canonical row, never to an
// older aggregate copied from a different device. No added/removed memberships.
export const patchExactRecentTextRow436 = (
  canonical: readonly RecentRecoverySong[],
  editedSong: RecentRecoverySong,
  getStableId: (song: RecentRecoverySong) => string | null,
): RecentRecoverySong[] | null => {
  if (!Array.isArray(canonical) || canonical.length === 0 || canonical.length > 10) return null;
  const targetId = getStableId(editedSong);
  if (!targetId) return null;
  const matches = canonical
    .map((song, index) => getStableId(song) === targetId ? index : -1)
    .filter((index) => index >= 0);
  // Deleted/ambiguous canonical identity cannot be silently recreated.
  if (matches.length !== 1) return null;
  return canonical.map((song, index) => index === matches[0] ? editedSong : song);
};
