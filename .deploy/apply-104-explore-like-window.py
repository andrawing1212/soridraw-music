from pathlib import Path
import json

like_path = Path('src/services/exploreLikeService.ts')
page_path = Path('src/pages/ExplorePage.tsx')
version_path = Path('public/app-version.json')

like = like_path.read_text(encoding='utf-8')
page = page_path.read_text(encoding='utf-8')

if 'SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_104_20260916' not in like:
    old = "const EXPLORE_LIKE_BATCH_MAX = 50;\n"
    new = """const EXPLORE_LIKE_BATCH_MAX = 50;
// SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_104_20260916
// The first real local like change starts the existing server-side five-minute
// aggregate window. Later changes stay local and are flushed once near the end
// of that window, so repeated toggles collapse to the final desired state.
const EXPLORE_LIKE_EVENT_WINDOW_MS_104 = 5 * 60_000;
const EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104 = 15_000;
type ExploreLikeEventWindow104 = {
  startedAt: number;
  finalFlushTimer: number;
};
const exploreLikeEventWindowByUid104 = new Map<string, ExploreLikeEventWindow104>();
"""
    if old not in like:
        raise SystemExit('missing like constant anchor')
    like = like.replace(old, new, 1)

    anchor = "\nexport const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {"
    helper = """

const beginExploreLikeEventWindow104 = (user: User, now = Date.now()) => {
  const uid = user.uid;
  const finalFlushDelay = EXPLORE_LIKE_EVENT_WINDOW_MS_104 - EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104;
  const active = exploreLikeEventWindowByUid104.get(uid);
  if (active && now - active.startedAt < finalFlushDelay) return false;
  if (active) window.clearTimeout(active.finalFlushTimer);

  const startedAt = now;
  const finalFlushTimer = window.setTimeout(() => {
    const current = exploreLikeEventWindowByUid104.get(uid);
    if (!current || current.startedAt != startedAt) return;
    exploreLikeEventWindowByUid104.delete(uid);
    // No request is made when the outbox is already empty. If later toggles
    // exist, this sends their final states before the server aggregate alarm.
    void flushPendingLikes(user);
  }, finalFlushDelay);

  exploreLikeEventWindowByUid104.set(uid, { startedAt, finalFlushTimer });
  return true;
};
"""
    if anchor not in like:
        raise SystemExit('missing liked ids anchor')
    like = like.replace(anchor, helper + anchor, 1)

    old_tail = """  persistLikeOutbox(user.uid, outbox);
  // 094: ordinary browsing is local-only. The only automatic flush inside the
  // Explore session is the hard 50-change batch ceiling.
  if (getPendingExploreLikeMutationCount(user.uid) >= EXPLORE_LIKE_BATCH_MAX) {
    void flushPendingLikes(user);
  }
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
"""
    new_tail = """  persistLikeOutbox(user.uid, outbox);
  // 104: start one five-minute server aggregate window on the first real
  // change, then keep later clicks local until the single near-deadline flush.
  // This preserves idle=0 and avoids one server request per click.
  const startedEventWindow104 = beginExploreLikeEventWindow104(user, now);
  if (startedEventWindow104) {
    void flushPendingLikes(user);
  } else if (getPendingExploreLikeMutationCount(user.uid) >= EXPLORE_LIKE_BATCH_MAX) {
    void flushPendingLikes(user);
  }
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
"""
    if old_tail not in like:
        raise SystemExit('missing local-only tail anchor')
    like = like.replace(old_tail, new_tail, 1)

if 'SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_104_20260916' not in page:
    old_block = """// SORIDRAW_EXPLORE_LIKE_AGGREGATE_AUTO_REFRESH_070_20260912
// Revalidate once after the next 10-minute aggregate window. The extra grace
// covers the revision endpoint's short edge cache without polling.
const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070 = 10 * 60_000;
const EXPLORE_LIKE_REVISION_CACHE_GRACE_MS_070 = 70_000;
"""
    new_block = """// SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_104_20260916
// 103 aggregates five minutes after the first server batch. The actor browser
// performs one forced fresh Feed refresh just after that window; there is no
// periodic polling and no wall-clock 10-minute boundary anymore.
const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 = 5 * 60_000;
const EXPLORE_LIKE_REFRESH_GRACE_MS_104 = 10_000;
"""
    if old_block not in page:
        raise SystemExit('missing old aggregate refresh block')
    page = page.replace(old_block, new_block, 1)

    old_formula = """      const now = Date.now();
      const nextAggregateAt = Math.ceil((now + 1000) / EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070)
        * EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070;
      const deadline = nextAggregateAt + EXPLORE_LIKE_REVISION_CACHE_GRACE_MS_070;
"""
    new_formula = """      const now = Date.now();
      const deadline = now + EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 + EXPLORE_LIKE_REFRESH_GRACE_MS_104;
"""
    if old_formula not in page:
        raise SystemExit('missing old wall-clock deadline formula')
    page = page.replace(old_formula, new_formula, 1)

like_path.write_text(like, encoding='utf-8')
page_path.write_text(page, encoding='utf-8')

version = json.loads(version_path.read_text(encoding='utf-8'))
version['version'] = '104'
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
