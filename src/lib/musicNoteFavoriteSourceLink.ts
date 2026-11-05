// A new Music Note favorite may retain a known, same-owner Suno document path.
// Never infer a track ID from a song ID, generation batch, task ID, title or URL.
// Historical favorites are unchanged; Next Song validates the exact doc on click.
type Plain = Record<string, unknown>;
const record = (value: unknown): Plain | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Plain : null;
const safeId = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const token = value.trim();
  return /^[A-Za-z0-9_-]{1,240}$/.test(token) ? token : '';
};

export const pickOwnedSunoOriginalLinkForFavorite = (
  rawSong: unknown,
  currentUid: string,
): { sourceTrackId?: string; sourceTaskId?: string } => {
  const song = record(rawSong);
  if (!song || !currentUid.trim()) return {};
  const applied = record(song.appliedKeywords);
  const type = typeof song.sourceType === 'string' ? song.sourceType.trim() : '';
  if (
    type === 'shared_track' || (type && type !== 'suno_track' && type !== 'suno-api')
    || song.isSharedView === true || song.isSharedMusicNote === true || song.sharedReadOnly === true
    || song.recentFavoriteDetachedAt || song.editedInStudio === true || applied?.editedInStudio === true
  ) return {};

  // Do not attach a shared or foreign user's original to this account.
  for (const field of [song.uid, song.ownerUid]) {
    if (typeof field === 'string' && field.trim() && field.trim() !== currentUid) return {};
  }

  // Only an explicit sourceTrackId, or the typed canonical Suno source ID,
  // can identify suno_tracks/{uid}/tracks/{sourceTrackId}. Bare id/taskId never can.
  const explicit = safeId(song.sourceTrackId);
  if (song.sourceTrackId != null && String(song.sourceTrackId).trim() && !explicit) return {};
  const typedSource = type === 'suno_track' ? safeId(song.sourceId) : '';
  const typedTrack = (type === 'suno_track' || type === 'suno-api') ? safeId(song.trackId) : '';
  if (explicit && typedSource && explicit !== typedSource) return {};
  const sourceTrackId = explicit || typedSource || typedTrack;
  if (!sourceTrackId) return {};

  // Task ID is optional evidence for Next Song's mismatch fence, never a locator.
  const sourceTaskId = safeId(song.sourceTaskId) ||
    ((type === 'suno_track' || type === 'suno-api') ? safeId(song.taskId) : '');
  if (safeId(song.sourceTaskId) && safeId(song.taskId)
      && safeId(song.sourceTaskId) !== safeId(song.taskId)) return {};

  return sourceTaskId ? { sourceTrackId, sourceTaskId } : { sourceTrackId };
};
