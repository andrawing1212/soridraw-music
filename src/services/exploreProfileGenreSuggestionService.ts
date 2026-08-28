import { doc, getDocFromServer } from '../lib/firestoreMeasured';
import { db } from '../firebase';
import { markCacheDiagnostic } from '../lib/cacheDiagnostics';
import { getKeywordLabel, normalizeDisplayGenreLabel } from '../lib/songUtils';

type GenreTier = 0 | 1 | 2; // main -> sub -> hybrid

type GenreStat = {
  label: string;
  songHits: number;
  totalHits: number;
  bestTier: GenreTier;
  firstSeen: number;
};

export type ExploreGenreSuggestionResult = {
  genres: string[];
  recentSongCount: number;
  firestoreReads: number;
};

const CUSTOM_GENRE_PREFIX_RE = /^__custom_(?:genre)__:(.*)$/;

const decodeCustomGenre = (value: unknown) => {
  const raw = String(value || '').trim();
  const match = raw.match(CUSTOM_GENRE_PREFIX_RE);
  if (!match) return raw;
  try {
    return decodeURIComponent(match[1] || '').trim();
  } catch {
    return String(match[1] || '').trim();
  }
};

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap((item) => toArray(item));
  const text = decodeCustomGenre(value);
  if (!text) return [];
  return [text];
};

const normalizeGenre = (value: unknown): string => {
  const raw = decodeCustomGenre(value)
    .replace(/^\[|\]$/g, '')
    .replace(/^genre\s*[:：-]\s*/i, '')
    .trim();
  if (!raw) return '';
  const label = normalizeDisplayGenreLabel(getKeywordLabel(raw) || raw)
    .replace(/\s+/g, ' ')
    .trim();
  if (!label || /^song$/i.test(label) || /^genre$/i.test(label)) return '';
  return label.slice(0, 28);
};

const parseHybridText = (value: unknown): string[] => {
  const text = String(value || '').trim();
  if (!text) return [];
  return text
    .split(/\s*(?:\+|\/|·|,|&|×|x)\s*/i)
    .map(normalizeGenre)
    .filter(Boolean);
};

const getPromptGenre = (song: any): string[] => {
  const prompt = String(song?.prompt || song?.finalPrompt || song?.generatedPrompt || '').trim();
  if (!prompt) return [];
  const match = prompt.match(/\[Genre\]\s*([^\n\r]+)/i);
  return match?.[1] ? parseHybridText(match[1]) : [];
};

const getTitleGenre = (song: any): string[] => {
  const title = String(song?.title || song?.koreanTitle || song?.englishTitle || '').trim();
  const match = title.match(/^\[([^\]]+)\]/);
  return match?.[1] ? parseHybridText(match[1]) : [];
};

const getTimestamp = (song: any): number => {
  const candidates = [
    song?.createdAtMs,
    song?.createdAt,
    song?.generatedAt,
    song?.updatedAtMs,
    song?.updatedAt,
    song?.timestamp,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value?.toMillis === 'function') {
      const ms = value.toMillis();
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof value?.seconds === 'number') {
      const ms = value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof value === 'string') {
      const ms = new Date(value).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }
  return 0;
};

const getTieredGenres = (song: any): Array<{ label: string; tier: GenreTier }> => {
  const applied = song?.appliedKeywords || {};
  const main = [
    ...toArray(applied?.genre),
    ...toArray(song?.genre),
  ].map(normalizeGenre).filter(Boolean);

  const sub = [
    ...toArray(applied?.subGenre),
    ...toArray(applied?.midGenre),
    ...toArray(song?.subGenre),
    ...toArray(song?.midGenre),
  ].map(normalizeGenre).filter(Boolean);

  const hybrid = [
    ...getPromptGenre(song),
    ...getTitleGenre(song),
  ];

  const best = new Map<string, { label: string; tier: GenreTier }>();
  const addTier = (labels: string[], tier: GenreTier) => {
    labels.forEach((label) => {
      const key = label.toLocaleLowerCase();
      const previous = best.get(key);
      if (!previous || tier < previous.tier) best.set(key, { label, tier });
    });
  };
  addTier(main, 0);
  addTier(sub, 1);
  addTier(hybrid, 2);
  return [...best.values()];
};

const selectRecentTen = (songs: any[]) => songs
  .map((song, index) => ({ song, index, time: getTimestamp(song) }))
  .sort((a, b) => {
    if (a.time && b.time && a.time !== b.time) return b.time - a.time;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return a.index - b.index;
  })
  .slice(0, 10)
  .map((entry) => entry.song);

export const suggestExploreProfileGenres = async (uid: string): Promise<ExploreGenreSuggestionResult> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return { genres: [], recentSongCount: 0, firestoreReads: 0 };

  const ref = doc(db, 'user_recent_songs', normalizedUid);
  const snapshot = await getDocFromServer(ref);
  markCacheDiagnostic('recentSongs', 'SYNC', 1, 0);

  const songs = snapshot.exists() && Array.isArray(snapshot.data()?.songs)
    ? selectRecentTen(snapshot.data().songs)
    : [];

  const stats = new Map<string, GenreStat>();
  let firstSeen = 0;

  songs.forEach((song) => {
    const perSong = getTieredGenres(song);
    perSong.forEach(({ label, tier }) => {
      const key = label.toLocaleLowerCase();
      const previous = stats.get(key);
      if (!previous) {
        stats.set(key, {
          label,
          songHits: 1,
          totalHits: 1,
          bestTier: tier,
          firstSeen: firstSeen++,
        });
        return;
      }
      previous.songHits += 1;
      previous.totalHits += 1;
      previous.bestTier = Math.min(previous.bestTier, tier) as GenreTier;
    });
  });

  const genres = [...stats.values()]
    .sort((a, b) => (
      b.songHits - a.songHits
      || a.bestTier - b.bestTier
      || b.totalHits - a.totalHits
      || a.firstSeen - b.firstSeen
      || a.label.localeCompare(b.label)
    ))
    .slice(0, 5)
    .map((item) => item.label);

  return {
    genres,
    recentSongCount: songs.length,
    firestoreReads: 1,
  };
};
