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
  // This release targets ONLY the observed 9 canonical / 10 local,
  // single unconfirmed newly generated row. Never repair clear/delete or
  // unrelated shorter catalogs via speculative cache reconciliation.
  if (canonical.length !== 9 || local.length !== 10 || unconfirmedIds.length > 10) return null;
  const canonicalIds = new Set(canonical.map(getStableId).filter(Boolean));
  if (canonicalIds.size !== 9) return null;
  const localIds = new Set(local.map(getStableId).filter(Boolean));
  if (localIds.size !== 10 || ![...canonicalIds].every((id) => localIds.has(id))) return null;
  const localById = new Map<string, RecentRecoverySong>();
  for (const song of local) {
    const id = getStableId(song);
    if (id && !localById.has(id)) localById.set(id, song);
  }

  // Never reinterpret an arbitrary cache-only song as a new generation. The
  // existing generation-time durable UID-scoped unconfirmed marker is required.
  const missing = [...new Set(unconfirmedIds)]
    .filter((id) => id && !canonicalIds.has(id));
  if (missing.length !== 1 || canonical.length + missing.length !== 10) return null;
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
  const original = canonical[matches[0]];
  // A save-heart or media update can advance a generic updatedAtMs without
  // editing text. Prefer the dedicated text-edit revision on BOTH sides to
  // avoid discarding a later genuine title/lyrics edit on another device.
  const originalTextAt = Number(original.appliedKeywords?.editedInStudioAt || 0);
  const pendingTextAt = Number(editedSong.appliedKeywords?.editedInStudioAt || 0);
  const currentEditAt = originalTextAt > 0 ? originalTextAt
    : pendingTextAt > 0 ? 0 : Number(original.updatedAtMs || 0);
  const incomingEditAt = pendingTextAt > 0 ? pendingTextAt
    : originalTextAt > 0 ? 0 : Number(editedSong.updatedAtMs || 0);
  const staleText = currentEditAt > 0 && incomingEditAt > 0 && currentEditAt > incomingEditAt;
  const hasHistory = editedSong.lyricGenerationHistoryV1 != null;
  if (staleText && !hasHistory) return null;
  const mergedHistory = hasHistory ? mergeRecentLyricHistory(original.lyricGenerationHistoryV1, editedSong.lyricGenerationHistoryV1, !staleText) : undefined;
  if (staleText && mergedHistory) {
    const rows = canonical.map((song,index) => index === matches[0] ? { ...original, lyricGenerationHistoryV1: mergedHistory } : song);
    assertRecentLyricHistoryBudget(mergedHistory, rows);
    return rows;
  }

  // The pending operation is TEXT ONLY: preserve the canonical save-heart,
  // public/locked flags, owner, generation IDs, Suno media and all other
  // per-track metadata which may have changed on another device.
  const merged: RecentRecoverySong = { ...original };
  for (const key of ['title', 'koreanTitle', 'englishTitle', 'prompt', 'updatedAtMs']) {
    if (Object.prototype.hasOwnProperty.call(editedSong, key)) merged[key] = editedSong[key];
  }
  if (editedSong.lyrics && typeof editedSong.lyrics === 'object' && !Array.isArray(editedSong.lyrics)) {
    merged.lyrics = { ...(original.lyrics || {}), ...editedSong.lyrics };
  }
  if (editedSong.appliedKeywords && typeof editedSong.appliedKeywords === 'object') {
    const oldApplied = original.appliedKeywords || {};
    const nextApplied: RecentRecoverySong = { ...oldApplied };
    for (const key of ['secondaryLanguage', 'titleLanguages', 'titlesByLanguage',
      'lyricsByLanguage', 'lyricLanguages', 'hasAddedLyricsLanguage', 'addedLyricsLanguage', 'addedLyricsLanguageAt', 'isNoLyrics', 'editedInStudio', 'editedInStudioAt']) {
      if (!Object.prototype.hasOwnProperty.call(editedSong.appliedKeywords, key)) continue;
      if (key === 'lyricsByLanguage' || key === 'titlesByLanguage') {
        nextApplied[key] = { ...(oldApplied[key] || {}), ...(editedSong.appliedKeywords[key] || {}) };
      } else {
        nextApplied[key] = editedSong.appliedKeywords[key];
      }
    }
    merged.appliedKeywords = nextApplied;
  }
  if (mergedHistory) merged.lyricGenerationHistoryV1 = mergedHistory;
  const rows = canonical.map((song, index) => index === matches[0] ? merged : song);
  if (mergedHistory) assertRecentLyricHistoryBudget(mergedHistory, rows);
  return rows;
};

// Private per-song history. No silent eviction of old generated lyrics.
export type LyricHistoryLane = 'ko' | 'foreign' | 'secondForeign';
export type LyricHistoryEntry = { id: string; at: number; lang: string; text: string; title: string };
export type LyricHistoryV1 = Partial<Record<LyricHistoryLane, { entries: LyricHistoryEntry[]; selectedId: string }>>;
const lyricLanes: LyricHistoryLane[] = ['ko','foreign','secondForeign'];
const lyricLangs = new Set(['ko','en','ja','zh','es','fr','de','ru','th']);
export const recentLyricBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value ?? null)).length;
export const assertRecentLyricHistoryBudget = (history: LyricHistoryV1, aggregate?: unknown) => {
  if (recentLyricBytes(history) > 48000 || (aggregate !== undefined && recentLyricBytes(aggregate) > 800000))
    throw new Error('recent-lyric-history-capacity');
};
const validEntry = (x: any): x is LyricHistoryEntry => Boolean(x && typeof x.id === 'string' && x.id.length <= 120
  && Number.isSafeInteger(x.at) && x.at >= 0 && lyricLangs.has(x.lang)
  && typeof x.text === 'string' && x.text.trim() && typeof x.title === 'string');
export const readRecentLyricHistory = (value: unknown): LyricHistoryV1 => {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-lyric-history');
  const input = value as LyricHistoryV1;
  const out: LyricHistoryV1 = {};
  for (const lane of lyricLanes) {
    const item = input[lane];
    if (!item) continue;
    if (!Array.isArray(item.entries) || !item.entries.every(validEntry) ||
        new Set(item.entries.map(x => x.id)).size !== item.entries.length ||
        !item.entries.some(x => x.id === item.selectedId)) throw new Error('invalid-lyric-history');
    out[lane] = { entries: [...item.entries].sort((a,b) => a.at-b.at || a.id.localeCompare(b.id)), selectedId: item.selectedId };
  }
  return out;
};
export const mergeRecentLyricHistory = (original: unknown, incoming: unknown, selectIncoming = true): LyricHistoryV1 => {
  const a = readRecentLyricHistory(original), b = readRecentLyricHistory(incoming);
  const result: LyricHistoryV1 = {};
  for (const lane of lyricLanes) {
    const old = a[lane], next = b[lane];
    if (!old || !next) { if (old || next) result[lane] = (old || next)!; continue; }
    const entries = new Map(old.entries.map(x => [x.id,x]));
    for (const x of next.entries) {
      const previous = entries.get(x.id);
      if (previous && (previous.lang !== x.lang || previous.text !== x.text || previous.title !== x.title || previous.at !== x.at)) throw new Error('lyric-history-id-conflict');
      entries.set(x.id,x);
    }
    result[lane] = { entries: [...entries.values()].sort((x,y) => x.at-y.at || x.id.localeCompare(y.id)),
      selectedId: (selectIncoming ? next : old).selectedId };
  }
  assertRecentLyricHistoryBudget(result);
  return result;
};
export const sameLyricVersionContent = (a: Pick<LyricHistoryEntry,'lang'|'text'|'title'>, b: Pick<LyricHistoryEntry,'lang'|'text'|'title'>) =>
  a.lang === b.lang && a.text === b.text && a.title === b.title;
export const appendRecentLyricVersion = (history: unknown, lane: LyricHistoryLane, before: LyricHistoryEntry | null, after: LyricHistoryEntry): LyricHistoryV1 => {
  const out = readRecentLyricHistory(history);
  const entries = [...(out[lane]?.entries || [])];
  if (before && !entries.some(x => sameLyricVersionContent(x,before))) entries.push(before);
  if (entries.some(x => x.id === after.id)) throw new Error('lyric-history-id-conflict');
  entries.push(after);
  out[lane] = { entries: entries.sort((a,b) => a.at-b.at || a.id.localeCompare(b.id)), selectedId: after.id };
  assertRecentLyricHistoryBudget(out);
  return out;
};
