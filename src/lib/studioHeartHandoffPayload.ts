/** Only when a full Studio snapshot exceeds the existing 24k receipt cap:
 * retain all fields used by the canonical Music Note save, including complete
 * lyrics, prompts, keywords and Suno media. Never truncate original content.
 * Result stays ordinary JSON for older PREVIEW/TEST/PRODUCTION clients. */
const RECOVERY_CANONICAL_KEYS = [
  'id','uid','title','koreanTitle','englishTitle','genre','displayGenre',
  'lyrics','prompt','appliedKeywords','userInput','situationSummary',
  'soridrawSongId','recentSongSyncKey','recentLegacySourceId','recentLegacyCreatedAtMs',
  'favoriteFirestoreId','musicNoteFavoriteId','createdAt','updatedAt','createdAtMs','updatedAtMs',
  'audioUrl','audio_url','streamAudioUrl','stream_audio_url','sourceAudioUrl','sourceStreamAudioUrl',
  'imageUrl','image_url','coverUrl','thumbnailUrl','audioUrls',
  'sunoAudioUrl','sunoCoverUrl','sunoImageUrl','sunoArtworkUrl',
  'sunoLinks','sunoShareLinks','mainSunoIndex','sunoShareUrl',
  'sunoUrl','sunoSongUrl','sunoTitle','sunoDurationSeconds','sunoDurationText',
  'sunoShareUrlUpdatedAt','sunoCoverFetchedAt',
] as const;

export const buildStudioHeartHandoffSongJson = (song: unknown, maxLength = 24000): string => {
  if (!song || typeof song !== 'object' || Array.isArray(song))
    throw new Error('STUDIO_HEART_HANDOFF_INVALID_SONG');
  let raw = '';
  try { raw = JSON.stringify(song); }
  catch { /* Noncanonical UI fields can be cyclic; preserve canonical fields below. */ }
  if (raw && raw.length <= maxLength) return raw;
  const source = song as Record<string, unknown>;
  const compact: Record<string, unknown> = {};
  for (const key of RECOVERY_CANONICAL_KEYS) {
    if (source[key] !== undefined) compact[key] = source[key];
  }
  let packed = '';
  try { packed = JSON.stringify(compact); }
  catch { throw new Error('STUDIO_HEART_HANDOFF_SONG_NOT_SERIALIZABLE'); }
  if (!packed || packed.length > maxLength)
    throw new Error('STUDIO_HEART_HANDOFF_SONG_TOO_LARGE');
  return packed;
};
