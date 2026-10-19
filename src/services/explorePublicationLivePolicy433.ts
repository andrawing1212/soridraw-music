export type ExplorePublicationLiveStatus433 = 'public' | 'private';

export type ExplorePublicationLiveSignalState433 = {
  trackId: string;
  at: number;
  status: ExplorePublicationLiveStatus433;
  version: number;
};

export const shouldInsertExplorePublicationTrack433 = (
  sort: 'recommended' | 'latest' | 'popular',
): boolean => sort === 'recommended' || sort === 'latest';

export const recordLatestExplorePublicationSignal433 = (
  ledger: Map<string, ExplorePublicationLiveSignalState433>,
  next: ExplorePublicationLiveSignalState433,
): boolean => {
  const trackId = String(next.trackId || '').trim();
  const at = Math.floor(Number(next.at || 0));
  const version = Math.floor(Number(next.version || 0));
  if (!trackId || !Number.isSafeInteger(at) || at <= 0 ||
      !Number.isSafeInteger(version) || version <= 0 ||
      (next.status !== 'public' && next.status !== 'private')) return false;

  const previous = ledger.get(trackId);
  if (previous) {
    if (version < previous.version) return false;
    if (version === previous.version) {
      if (at < previous.at) return false;
      if (at === previous.at && next.status === previous.status) return false;
    }
  }

  ledger.set(trackId, { trackId, at, status: next.status, version });
  return true;
};

export const isExplorePublicationPublicResponseCurrent433 = (
  ledger: Map<string, ExplorePublicationLiveSignalState433>,
  expected: ExplorePublicationLiveSignalState433,
): boolean => {
  if (expected.status !== 'public') return false;
  const current = ledger.get(expected.trackId);
  return Boolean(
    current
    && current.status === 'public'
    && current.version === expected.version
    && current.at === expected.at,
  );
};


// app435: Publication live-cards describe title/visibility/metadata, NOT an
// authoritative public like-count change. Like counts have their own 192
// changed-card settlement channel, and a same-UID private optimistic overlay.
// A delayed publication snapshot must never roll back either one.
export const mergeExplorePublicationCardPreservingLikeCount435 = <T extends { likeCount?: unknown }>(
  existing: T,
  publication: Partial<T>,
): T => {
  const merged = { ...existing, ...publication };
  if (typeof existing.likeCount === 'number'
      && Number.isSafeInteger(existing.likeCount) && existing.likeCount >= 0) {
    merged.likeCount = existing.likeCount;
  }
  return merged;
};
