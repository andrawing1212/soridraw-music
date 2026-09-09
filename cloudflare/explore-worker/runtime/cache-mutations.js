// Snapshot builders capture ETags before reading canonical data. Conflicts preserve deltas.
const EXPLORE_CACHE_SNAPSHOT_052 = Symbol('exploreCacheSnapshot');
async function buildExploreFeedR2Payload(env, sort) {
  const baseline = await exploreCacheBucket031(env).head(exploreFeedR2Key(sort));
  const payload = await buildExploreFeedR2PayloadCore052(env, sort);
  payload[EXPLORE_CACHE_SNAPSHOT_052] = { etag: baseline?.etag };
  return payload;
}
async function writeExploreR2Json(env, key, payload) {
  const baseline = payload?.[EXPLORE_CACHE_SNAPSHOT_052];
  if (!baseline) return writeExploreR2JsonCore052(env, key, payload);
  const saved = await exploreCacheBucket031(env).put(key, JSON.stringify(payload), {
    onlyIf: baseline.etag ? { etagMatches: baseline.etag } : { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawBundle: '1', updatedAt: String(Date.now()) }
  });
  if (!saved) {
    const error = new Error('Concurrent mutation superseded cache snapshot: ' + key);
    error.code = 'CACHE_SNAPSHOT_CONFLICT';
    throw error;
  }
}
// Injected into the existing Worker by 031. No bindings, schema or routes added.
async function mutateExploreR2Cache052(env, key, transform) {
  const bucket = exploreCacheBucket031(env);
  if (!bucket) throw new Error('Explore cache binding unavailable');
  for (let attempt = 0; attempt < 8; attempt++) {
    const object = await bucket.get(key);
    if (!object) return { ok: false, repairNeeded: true };
    let previous;
    try { previous = JSON.parse(await object.text()); }
    catch { return { ok: false, repairNeeded: true }; }
    const next = await transform(previous);
    if (!next || JSON.stringify(next) === JSON.stringify(previous)) return { ok: true, changed: false };
    const saved = await bucket.put(key, JSON.stringify(next), {
      onlyIf: { etagMatches: object.etag },
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { soridrawBundle: '1', updatedAt: String(next.updatedAt || Date.now()) }
    });
    if (saved) return { ok: true, changed: true, revision: next.revision };
    // put(null) means a concurrent writer won. Recompute against its complete value.
  }
  throw new Error(`Explore cache contention: ${key}`);
}

function feedCacheNext052(bundle, items, sort, overflowed = false) {
  const data = bundle?.payload?.data;
  if (!Array.isArray(data?.items)) return null;
  const sorted = sortExploreFeedItems012(items, sort).slice(0, EXPLORE_R2_FEED_LIMIT);
  const nextCursor = buildExploreFeedCursor012(sort, sorted, data.nextCursor, overflowed);
  if (JSON.stringify(sorted) === JSON.stringify(data.items)) return null;
  return { ...bundle, updatedAt: Date.now(), payload: {
    ...bundle.payload, data: { ...data, items: sorted, nextCursor }
  } };
}

function profileCacheNext052(bundle, data) {
  if (!validExploreProfileR2Bundle020(bundle)) return null;
  if (JSON.stringify(data) === JSON.stringify(bundle.body.data)) return null;
  const revision = Math.max(Number(bundle.revision || 0), Number(bundle.body.data.revision || 0)) + 1;
  return { ...bundle, revision, updatedAt: Date.now(), body: {
    ...bundle.body, data: { ...data, revision, updatedAt: Date.now() }
  } };
}

async function readChangedExploreTrack052(env, trackId) {
  // Exact primary-key lookup only. No ranking query, COUNT, OFFSET or feed builder.
  const row = await env.DB.prepare(`
    SELECT t.*, p.nickname AS owner_nickname, p.avatar_url AS owner_avatar_url,
      COALESCE(s.like_count,0) AS like_count,
      COALESCE(s.comment_count,0) AS comment_count,
      COALESCE(s.play_count,0) AS play_count
    FROM tracks t
    LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
    LEFT JOIN track_stats s ON s.track_id = t.id
    WHERE t.id = ? AND t.is_public = 1 AND t.status = 'published'
    LIMIT 1
  `).bind(trackId).first();
  return row ? mapTrackRow(row) : null;
}

async function patchExploreFeedR2LikeCount(env, trackId, likeCount) {
  for (const sort of ['latest', 'popular']) {
    await mutateExploreR2Cache052(env, exploreFeedR2Key(sort), async bundle => {
      const items = bundle?.payload?.data?.items;
      if (!Array.isArray(items)) return null;
      const existing = items.find(item => getExploreFeedItemId012(item) === trackId);
      if (!existing && sort === 'latest') return null;
      // Read after the R2 snapshot, including retries. An old response's likeCount
      // must not roll back a more recent canonical count or resurrect a private track.
      const current = await readChangedExploreTrack052(env, trackId);
      const rest = items.filter(item => getExploreFeedItemId012(item) !== trackId);
      if (!current) return feedCacheNext052(bundle, rest, sort);
      const count = getExploreFeedItemLikeCount012(current);
      const updated = existing ? { ...existing, likeCount: count,
        ...(existing.stats ? { stats: { ...existing.stats, likeCount: count } } : {}) } : current;
      return feedCacheNext052(bundle, [...rest, updated], sort, !existing && items.length >= EXPLORE_R2_FEED_LIMIT);
    });
  }
}

async function syncExploreFeedR2Publication012(env, incomingItem) {
  const trackId = getExploreFeedItemId012(incomingItem);
  if (!trackId) throw new Error('publication feed item is missing track id');
  for (const sort of ['latest', 'popular']) {
    await mutateExploreR2Cache052(env, exploreFeedR2Key(sort), async bundle => {
      const items = bundle?.payload?.data?.items;
      if (!Array.isArray(items)) return null;
      const current = await readChangedExploreTrack052(env, trackId);
      if (!current) return feedCacheNext052(bundle, items.filter(item => getExploreFeedItemId012(item) !== trackId), sort);
      incomingItem = current;
      const existing = items.find(item => getExploreFeedItemId012(item) === trackId);
      const merged = existing ? { ...existing, ...incomingItem,
        stats: { ...(existing.stats || {}), ...(incomingItem.stats || {}) },
        likeCount: incomingItem.likeCount ?? incomingItem.stats?.likeCount ?? existing.likeCount ?? 0
      } : incomingItem;
      return feedCacheNext052(bundle,
        [...items.filter(item => getExploreFeedItemId012(item) !== trackId), merged], sort,
        !existing && items.length >= EXPLORE_R2_FEED_LIMIT);
    });
  }
}

async function syncExploreFeedR2OptionPatch017(env, trackId, patch) {
  for (const sort of ['latest', 'popular']) {
    await mutateExploreR2Cache052(env, exploreFeedR2Key(sort), bundle => {
      const items = bundle?.payload?.data?.items;
      if (!Array.isArray(items)) return null;
      return feedCacheNext052(bundle, items.map(item =>
        getExploreFeedItemId012(item) === trackId ? { ...item, ...patch } : item), sort);
    });
  }
}

async function syncExploreFeedR2Private017(env, trackId) {
  for (const sort of ['latest', 'popular']) {
    await mutateExploreR2Cache052(env, exploreFeedR2Key(sort), async bundle => {
      const items = bundle?.payload?.data?.items;
      if (!Array.isArray(items)) return null;
      if (await readChangedExploreTrack052(env, trackId)) return null;
      return feedCacheNext052(bundle, items.filter(item => getExploreFeedItemId012(item) !== trackId), sort);
    });
  }
}

async function patchExploreProfileR2Counters020(env, uid, patch) {
  return mutateExploreR2Cache052(env, exploreProfileR2Key(uid), async bundle => {
    if (!validExploreProfileR2Bundle020(bundle)) return null;
    const current = await env.DB.prepare('SELECT follower_count, following_count FROM profile_stats WHERE uid = ? LIMIT 1').bind(uid).first();
    patch = { ...patch };
    if (current && 'followerCount' in patch) patch.followerCount = Math.max(0, Number(current.follower_count || 0));
    if (current && 'followingCount' in patch) patch.followingCount = Math.max(0, Number(current.following_count || 0));
    return profileCacheNext052(bundle, { ...bundle.body.data,
      profile: { ...bundle.body.data.profile, ...patch } });
  });
}

async function patchExploreProfileR2Like020(env, ownerUid, trackId, likeCount) {
  return mutateExploreR2Cache052(env, exploreProfileR2Key(ownerUid), async bundle => {
    if (!validExploreProfileR2Bundle020(bundle)) return null;
    if (!bundle.body.data.items.some(item => getProfileTrackId019(item) === trackId)) return null;
    const current = await readChangedExploreTrack052(env, trackId);
    const items = current ? bundle.body.data.items.map(item => getProfileTrackId019(item) === trackId
      ? { ...item, likeCount: getExploreFeedItemLikeCount012(current),
        ...(item.stats ? { stats: { ...item.stats, likeCount: getExploreFeedItemLikeCount012(current) } } : {}) } : item)
      : bundle.body.data.items.filter(item => getProfileTrackId019(item) !== trackId);
    return profileCacheNext052(bundle, { ...bundle.body.data, items });
  });
}

async function patchExploreProfileR2Mutation019(env, uid, change) {
  const trackId = String(change?.trackId || '').trim();
  if (!uid || !trackId) return { ok: false, skipped: true };
  return mutateExploreR2Cache052(env, exploreProfileR2Key(uid), async bundle => {
    if (!validExploreProfileR2Bundle020(bundle)) return null;
    const data = bundle.body.data;
    const existing = data.items.find(item => getProfileTrackId019(item) === trackId);
    let items = data.items.filter(item => getProfileTrackId019(item) !== trackId);
    const current = (existing || change.item) ? await readChangedExploreTrack052(env, trackId) : null;
    // Options for a track outside the first window must not insert an ID-less item.
    if (current && (change.item || existing)) {
      items.push({ ...(existing || {}), ...current });
    }
    items = sortProfileTracks019(items).slice(0, PUBLIC_PROFILE_FIRST_VIEW_LIMIT);
    const trackCount = Math.max(0, Number(data.profile.trackCount ?? data.profile.track_count ?? 0)
      + Number(change.trackCountDelta || 0));
    return profileCacheNext052(bundle, { ...data, items, profile: { ...data.profile, trackCount } });
  });
}

async function refreshPublicProfileFirstViewProfile(env, uid) {
  let refs = [uid];
  const result = await mutateExploreR2Cache052(env, exploreProfileR2Key(uid), async bundle => {
    if (!validExploreProfileR2Bundle020(bundle)) return null;
    const profile = await readPublicProfileFirstViewBaseProfile(env, uid);
    if (!profile) return null;
    refs = [uid, bundle.body.data.profile.handle, profile.handle].filter(Boolean);
    return profileCacheNext052(bundle, { ...bundle.body.data, profile: {
      ...bundle.body.data.profile, ...profile,
      trackCount: bundle.body.data.profile.trackCount ?? bundle.body.data.profile.track_count ?? 0
    } });
  });
  if (result.ok && refs.length > 1) await writeExploreProfileAlias020(env, refs.at(-1), uid);
  return refs;
}
async function refreshOrPrebuildPublicProfileFirstView(env, uid) {
  // A missing first view is repaired on its existing cold path, not by a profile edit.
  return refreshPublicProfileFirstViewProfile(env, uid);
}
async function syncExploreLikeR2AfterMutation(env, uid, trackId, liked) {
  return mutateExploreR2Cache052(env, exploreLikeR2Key(uid), async bundle => {
    if (!Array.isArray(bundle.likedTrackIds)) return null;
    const membership = await env.DB.prepare('SELECT track_id FROM likes WHERE track_id = ? AND user_uid = ? LIMIT 1').bind(trackId, uid).first();
    liked = Boolean(membership);
    const ids = new Set(bundle.likedTrackIds);
    if (liked) ids.add(trackId); else ids.delete(trackId);
    const likedTrackIds = [...ids].filter(Boolean).slice(0, 2000);
    if (JSON.stringify(likedTrackIds) === JSON.stringify(bundle.likedTrackIds)) return null;
    return { ...bundle, updatedAt: Date.now(), likedTrackIds };
  });
}
