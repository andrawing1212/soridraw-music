// The last-resort Music Note RTDB signal must keep exact Suno URL/artwork
// even when large historical appliedKeywords/search payloads cannot fit.
// Keep fields whole (never slice a user URL), and never exceed existing
// 24k-character RTDB itemJson budget.
export const MUSIC_NOTE_MEDIA_SYNC_FALLBACK_KEYS_452 = [
  'sunoShareUrl', 'sunoCoverUrl', 'sunoShareUrlUpdatedAt', 'sunoCoverFetchedAt',
  'sunoUrl', 'sunoSongUrl', 'sunoImageUrl', 'sunoArtworkUrl',
  'mainSunoIndex', 'sunoLinkCount', 'sunoLinks', 'sunoShareLinks',
  'sunoTitle', 'sunoDurationSeconds', 'sunoDurationText',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl',
] as const;

export const appendBoundedMusicNoteMediaFallback452 = (
  base: Record<string, unknown>,
  projected: Record<string, unknown>,
  maxCharacters = 24000,
): Record<string, unknown> => {
  let result = { ...base };
  for (const key of MUSIC_NOTE_MEDIA_SYNC_FALLBACK_KEYS_452) {
    if (!Object.prototype.hasOwnProperty.call(projected, key)) continue;
    const candidate = { ...result, [key]: projected[key] };
    // A giant historical Suno array is skipped, not mutilated: at least its
    // independently bounded primary URL and cover can still propagate.
    try {
      if (JSON.stringify(candidate).length <= maxCharacters) result = candidate;
    } catch {
      // Only the optional media field is omitted; canonical storage untouched.
    }
  }
  return result;
};
