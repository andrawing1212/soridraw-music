from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'[069] {label}: expected one target, got {count}')
    return text.replace(old, new, 1)


service_path = Path('src/services/exploreLikeService.ts')
service = service_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912' not in service:
    service = replace_once(
        service,
        '// SORIDRAW_EXPLORE_LIKE_VISIBLE_COUNT_SIGNAL_067_20260911\n',
        '// SORIDRAW_EXPLORE_LIKE_VISIBLE_COUNT_SIGNAL_067_20260911\n// SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912\n',
        'service marker',
    )
    service = replace_once(
        service,
        """        mutations: batchEntries.map((pending) => ({
          trackId: pending.trackId,
          liked: pending.desiredLiked,
        })),""",
        """        mutations: batchEntries.map((pending) => ({
          trackId: pending.trackId,
          liked: pending.desiredLiked,
          mutationAt: pending.updatedAt,
        })),""",
        'mutationAt',
    )
    service = replace_once(
        service,
        """      // The Worker accepts this mutation immediately, but its public like-count
      // baseline is intentionally deferred. Keep the already-visible optimistic
      // count as the same-account signal until the public aggregate catches up.
      let visibleLiked = pending.desiredLiked;
      let visibleLikeCount = pending.optimisticLikeCount;""",
        """      // 069: heart state can sync promptly, but public numeric count is
      // authoritative only after the deferred aggregate. Never manufacture +/-.
      let visibleLiked = pending.desiredLiked;
      let visibleLikeCount = result.likeCount;""",
        'visible result baseline',
    )
    service = replace_once(
        service,
        """        visibleLiked = latest.desiredLiked;
        visibleLikeCount = latest.optimisticLikeCount;""",
        """        visibleLiked = latest.desiredLiked;
        visibleLikeCount = result.likeCount;""",
        'latest visible result',
    )
    service = replace_once(
        service,
        """        latest.retryCount = Math.min(8, latest.retryCount + 1);
        latest.updatedAt = Date.now();
        latestOutbox[pending.trackId] = latest;""",
        """        latest.retryCount = Math.min(8, latest.retryCount + 1);
        // Keep updatedAt stable across retries because 069 uses it in the
        // idempotent chronological queue key.
        latestOutbox[pending.trackId] = latest;""",
        'stable retry timestamp',
    )
    service = replace_once(
        service,
        '  const optimisticLikeCount = Math.max(0, clampLikeCount(currentLikeCount) + (liked ? 1 : -1));',
        """  // 069: keep the last aggregate-confirmed public number until the
  // deferred server aggregate changes it.
  const optimisticLikeCount = clampLikeCount(currentLikeCount);""",
        'no optimistic numeric delta',
    )
    service_path.write_text(service, encoding='utf-8')

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912' not in page:
    old_sync = """  useEffect(() => {
    const onLikeSync = (event: Event) => {
      const detail = (event as CustomEvent<{
        trackId?: string;
        ownerUid?: string;
        liked?: boolean;
        likeCount?: number;
      }>).detail;
      const trackId = String(detail?.trackId || '').trim();
      const rawCount = Number(detail?.likeCount);
      if (!trackId || typeof detail?.liked !== 'boolean' || !Number.isFinite(rawCount)) return;
      const likeCount = Math.max(0, Math.floor(rawCount));
      setLikedTrackIds((prev) => ({ ...prev, [trackId]: detail.liked as boolean }));
      updateTrackLikeCount(trackId, likeCount);
      patchExploreFeedSessionCacheRow(requestUrl, trackId, { likeCount });
      const ownerUid = String(detail?.ownerUid || '').trim();
      if (ownerUid) patchExplorePublicProfileFirstViewTrack(ownerUid, trackId, { likeCount });
    };"""
    new_sync = """  // SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912
  useEffect(() => {
    const onLikeSync = (event: Event) => {
      const detail = (event as CustomEvent<{
        trackId?: string;
        ownerUid?: string;
        liked?: boolean;
        likeCount?: number;
      }>).detail;
      const trackId = String(detail?.trackId || '').trim();
      if (!trackId || typeof detail?.liked !== 'boolean') return;
      // Same-account signal changes only the personal heart. Public likeCount
      // changes only when the deferred aggregate/feed delta confirms it.
      setLikedTrackIds((prev) => ({ ...prev, [trackId]: detail.liked as boolean }));
    };"""
    page = replace_once(page, old_sync, new_sync, 'heart-only sync')
    old_toggle = """    try {
      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);
      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));
      updateTrackLikeCount(track.id, result.likeCount);
      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: result.likeCount });
      patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: result.likeCount });
    } catch (reason) {"""
    new_toggle = """    try {
      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);
      // Heart changes immediately; public numeric count stays unchanged until
      // the scheduled aggregate publishes the confirmed count.
      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));
    } catch (reason) {"""
    page = replace_once(page, old_toggle, new_toggle, 'heart-only toggle')
    page_path.write_text(page, encoding='utf-8')

Path('public/app-version.json').write_text('{\n  "version": "069"\n}\n', encoding='utf-8')
print('069 client source prepared')
