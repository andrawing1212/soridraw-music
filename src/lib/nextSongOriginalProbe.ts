// Memory-only metadata from the last explicit Next Song click.
// Never retain lyrics, prompts, manual commands or a user-data snapshot.
export type NextSongOriginalProbeSelection = {
  uid: string;
  origin: 'musicNote' | 'library' | 'player';
  favoriteId?: string;
  trackId?: string;
  playlistId?: string;
  playlistItemId?: string;
  stableSongId?: string;
  taskId?: string;
};
export const NEXT_SONG_ORIGINAL_PROBE_EVENT = 'soridraw:next-song-probe-source';
let lastSelection: NextSongOriginalProbeSelection | null = null;
const token = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 && text.length <= 240 && !text.includes('/') && !text.includes('\\')
    ? text : '';
};
export const stageNextSongOriginalProbeSelection = (
  value?: NextSongOriginalProbeSelection,
): void => {
  if (!value || !token(value.uid) || !['musicNote', 'library', 'player'].includes(value.origin)) {
    lastSelection = null;
  } else {
    lastSelection = {
      uid: token(value.uid), origin: value.origin,
      favoriteId: token(value.favoriteId), trackId: token(value.trackId),
      playlistId: token(value.playlistId), playlistItemId: token(value.playlistItemId),
      stableSongId: token(value.stableSongId), taskId: token(value.taskId),
    };
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NEXT_SONG_ORIGINAL_PROBE_EVENT));
};
export const readNextSongOriginalProbeSelection = (uid: string): NextSongOriginalProbeSelection | null =>
  lastSelection && token(uid) === lastSelection.uid ? lastSelection : null;

type Plain = Record<string, unknown>;
const record = (value: unknown): Plain | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Plain;
  if (typeof value !== 'string' || value.length > 100_000) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Plain : null;
  } catch { return null; }
};
export type OriginalInputPresence = { present: string[]; empty: string[] };
// Report only field names and nested storage paths; NEVER report text values.
export const summarizeOriginalInputPresence = (source: unknown): OriginalInputPresence => {
  const root = record(source) || {};
  const request = record(root.requestPayload);
  const layers: Array<[string, Plain | null]> = [
    ['appliedKeywords', record(root.appliedKeywords)],
    ['requestPayload.appliedKeywords', record(request?.appliedKeywords)],
    ['requestPayload', request],
    ['song', root],
  ];
  const fields = [
    'userInput', 'commandInput', 'directInput', 'customPrompt',
    'customGenreInput', 'customMoodInput', 'customThemeInput',
    'customStyleInput', 'customSoundInput', 'lyricDraft',
    'isLyricMode', 'lyricMode',
  ];
  const present: string[] = [];
  const empty: string[] = [];
  for (const [location, value] of layers) {
    if (!value) continue;
    for (const key of fields) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const field = value[key];
      const nonEmpty = typeof field === 'string' ? field.trim().length > 0
        : typeof field === 'boolean' ? field === true
        : field !== null && field !== undefined;
      (nonEmpty ? present : empty).push(location + '.' + key);
    }
    if (value.manualCommandCleared === true) empty.push(location + '.manualCommandCleared');
  }
  return { present, empty };
};
export type RecentProbeMatch = {
  status: 'matched' | 'task-candidate' | 'not-matched' | 'ambiguous' | 'invalid';
  song?: Plain;
};
export const findNextSongOriginalInRecent = (
  recentDocument: unknown,
  selection: NextSongOriginalProbeSelection,
): RecentProbeMatch => {
  const source = record(recentDocument);
  if (!Array.isArray(source?.songs) || source.songs.length > 500) return { status: 'invalid' };
  const songs = source.songs.map(record).filter((item): item is Plain => Boolean(item));
  const strong = new Set([token(selection.stableSongId), token(selection.trackId)].filter(Boolean));
  if (strong.size) {
    const exact = songs.filter((song) => [
      song.soridrawSongId, song.recentSongSyncKey, song.id, song.trackId, song.sourceTrackId,
    ].some((item) => strong.has(token(item))));
    if (exact.length === 1) return { status: 'matched', song: exact[0] };
    if (exact.length > 1) return { status: 'ambiguous' };
  }
  const taskId = token(selection.taskId);
  if (!taskId) return { status: 'not-matched' };
  const tasks = songs.filter((song) => token(song.taskId) === taskId);
  if (tasks.length === 1) return { status: 'task-candidate', song: tasks[0] };
  return { status: tasks.length > 1 ? 'ambiguous' : 'not-matched' };
};
