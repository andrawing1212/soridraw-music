// SORIDRAW_SHARED_FEED_TARGETED_PARITY_069_20260919
// Targeted mutations on the shared first-page R2 snapshots. No D1 access.
// All puts use conditional ETags to preserve other writers' changes.
export const SHARED_FEED_MUTATION_MAX_RETRIES_069 = 8;

function sharedFeedId069(item) {
  return String(item?.id || item?.trackId || '').trim();
}

export function sharedFeedNext069(bundle, sort, operation) {
  const data = bundle?.payload?.data;
  if (!data || !Array.isArray(data.items)) return null;
  const trackId = String(operation?.trackId || '').trim();
  if (!trackId) return null;
  const existing = data.items.find((item) => sharedFeedId069(item) === trackId) || null;
  if (operation.kind === 'private') {
    if (!existing) return null;
    const items = data.items.filter((item) => sharedFeedId069(item) !== trackId);
    return {
      ...bundle,
      payload: { ...bundle.payload, data: { ...data, items } },
      updatedAt: Date.now(),
    };
  }

  if (operation.kind === 'options') {
    if (!existing) return null;
    const patch = operation.patch && typeof operation.patch === 'object' ? operation.patch : {};
    // An options-only mutation must never insert an absent or private track.
    const items = data.items.map((item) => sharedFeedId069(item) === trackId ? { ...item, ...patch } : item);
    if (JSON.stringify(items) === JSON.stringify(data.items)) return null;
    const sorted = sortExploreFeedItems012(items, sort).slice(0, EXPLORE_R2_FEED_LIMIT);
    return {
      ...bundle,
      payload: { ...bundle.payload, data: { ...data, items: sorted } },
      updatedAt: Date.now(),
    };
  }

  if (operation.kind !== 'publish' || !operation.item || sharedFeedId069(operation.item) !== trackId) return null;
  const incoming = operation.item;
  const merged = existing ? {
    ...existing,
    ...incoming,
    stats: { ...(incoming?.stats || {}), ...(existing?.stats || {}) },
    likeCount: existing?.likeCount ?? incoming?.likeCount ?? incoming?.stats?.likeCount ?? 0,
    commentCount: existing?.commentCount ?? incoming?.commentCount ?? incoming?.stats?.commentCount ?? 0,
    playCount: existing?.playCount ?? incoming?.playCount ?? incoming?.stats?.playCount ?? 0,
  } : incoming;
  const without = data.items.filter((item) => sharedFeedId069(item) !== trackId);
  const overflowed = !existing && data.items.length >= EXPLORE_R2_FEED_LIMIT;
  const items = sortExploreFeedItems012([merged, ...without], sort).slice(0, EXPLORE_R2_FEED_LIMIT);
  if (sort === 'popular' && overflowed && !items.some((item) => sharedFeedId069(item) === trackId)) return null;
  if (JSON.stringify(items) === JSON.stringify(data.items)) return null;
  return {
    ...bundle,
    payload: {
      ...bundle.payload,
      data: { ...data, items, sort, nextCursor: buildExploreFeedCursor012(sort, items, data.nextCursor ?? null, overflowed) },
    },
    updatedAt: Date.now(),
  };
}

async function catalogAllowsSharedMutation069(env, operation) {
  if (!isExploreR2CatalogEnabled066(env)) return true;
  const object = await env.PROFILE_MEDIA.get(catalogMetaKey066(operation.trackId));
  if (!object) return false; // Do not guess when the ordering guard is missing.
  const meta = JSON.parse(await object.text());
  const shouldBePublic = operation.kind !== 'private';
  return meta?.trackId === operation.trackId && typeof meta.public === 'boolean'
    && meta.public === shouldBePublic;
}

export async function syncExploreSharedFeedTargeted069(env, operation) {
  const bucket = env?.PROFILE_MEDIA;
  const trackId = String(operation?.trackId || '').trim();
  if (!bucket || !trackId || !['private', 'publish', 'options'].includes(operation?.kind)) {
    return { ok: false, repairNeeded: true, reason: 'input_or_binding' };
  }
  const results = await Promise.all(['latest', 'popular'].map(async (sort) => {
    const key = exploreSharedFeedR2Key059(sort);
    for (let attempt = 0; attempt < SHARED_FEED_MUTATION_MAX_RETRIES_069; attempt += 1) {
      // Recheck every retry. A later republish/private must not be overwritten
      // by an older request whose shared-R2 update was delayed.
      if (!(await catalogAllowsSharedMutation069(env, operation))) {
        return { ok: true, changed: false, skippedNewerState: true };
      }
      const object = await bucket.get(key);
      if (!object) return { ok: false, repairNeeded: true, reason: 'missing_shared_snapshot' };
      let previous;
      try { previous = JSON.parse(await object.text()); }
      catch { return { ok: false, repairNeeded: true, reason: 'invalid_shared_snapshot' }; }
      const next = sharedFeedNext069(previous, sort, operation);
      if (!next) return { ok: true, changed: false };
      const saved = await bucket.put(key, JSON.stringify(next), {
        onlyIf: { etagMatches: object.etag },
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: {
          ...(object.customMetadata || {}),
          soridrawSharedFeed: '069',
          targetedAt: String(next.updatedAt),
        },
      });
      if (saved) return { ok: true, changed: true };
    }
    return { ok: false, repairNeeded: true, reason: 'shared_snapshot_contention' };
  }));
  return { ok: results.every((result) => result.ok), results };
}
