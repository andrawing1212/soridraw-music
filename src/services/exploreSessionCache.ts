// SORIDRAW_EXPLORE_CLIENT_SESSION_CACHE_988
const EXPLORE_FEED_SESSION_TTL_MS = 30_000;

type ExploreFeedSessionEntry = {
  expiresAt: number;
  rows: Array<Record<string, unknown>>;
};

const exploreFeedSessionCache = new Map<string, ExploreFeedSessionEntry>();

const isFeedRequest = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === '/v1/feed';
  } catch {
    return url.includes('/v1/feed?');
  }
};

export const readExploreFeedSessionCache = (url: string): Array<Record<string, unknown>> | null => {
  if (!isFeedRequest(url)) return null;
  const entry = exploreFeedSessionCache.get(url);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    exploreFeedSessionCache.delete(url);
    return null;
  }
  return entry.rows.map((row) => ({ ...row }));
};

export const writeExploreFeedSessionCache = (
  url: string,
  rows: Array<Record<string, unknown>>,
) => {
  if (!isFeedRequest(url)) return;
  exploreFeedSessionCache.set(url, {
    expiresAt: Date.now() + EXPLORE_FEED_SESSION_TTL_MS,
    rows: rows.map((row) => ({ ...row })),
  });
};

export const invalidateExploreFeedSessionCache = () => {
  exploreFeedSessionCache.clear();
};
