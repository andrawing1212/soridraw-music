import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';
const identity = { cacheKey: 'explore-viewer-genres-346', sourceType: 'explore_viewer_genres', schemaVersion: 1 };
export const EXPLORE_VIEWER_GENRES_EVENT = 'soridraw:viewer-genres-346';
type Summary = { uid: string; genres: string[]; updatedAt: number };
export const readExploreViewerGenres = (uid: string): string[] | null => {
  if (!uid) return null;
  const data = readSoridrawPersistentCache<Summary>({ ...identity, uid })?.data;
  return data?.uid === uid && Array.isArray(data.genres) ? data.genres : null;
};
export const rememberExploreViewerGenres = (uid: string, value: unknown): void => {
  if (!uid || !value || typeof value !== 'object') return;
  const row = value as Record<string, unknown>;
  if (row.uid !== uid || !Array.isArray(row.genres)) return;
  const genres = [...new Set(row.genres.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean))].slice(0, 5);
  const current = readSoridrawPersistentCache<Summary>({ ...identity, uid })?.data;
  const updatedAt = Number(row.updatedAt || 0);
  if (!Number.isFinite(updatedAt) || updatedAt < 0 || (current?.uid === uid && updatedAt < current.updatedAt)) return;
  const previous = readExploreViewerGenres(uid);
  writeSoridrawPersistentCache({ ...identity, uid, dataVersion: updatedAt, data: { uid, genres, updatedAt } });
  if (typeof window !== 'undefined' && JSON.stringify(previous) !== JSON.stringify(genres)) window.dispatchEvent(new CustomEvent(EXPLORE_VIEWER_GENRES_EVENT, { detail: { uid } }));
};
