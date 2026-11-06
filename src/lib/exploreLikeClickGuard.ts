/** Explore public-like browser friction; this is not a server-side rate limit. */
export type ExploreLikeClickDecision = { allowed: boolean; notify: boolean; retryAfterMs: number };
type ClickRecord = { recent: number[]; blockedUntil: number };
const byTrack = new Map<string, ClickRecord>();
const FIVE_SECONDS = 5_000;
const THIRTY_SECONDS = 30_000;
const FIVE_MINUTES = 300_000;
const countWithin = (times: number[], now: number, span: number) =>
  times.filter((time) => time > now - span).length;

/** Record only a successful state-changing public like/unlike toggle, never a failed, ignored or blocked click. */
export const recordExploreLikeAcceptedClick = (uid: string, identity: string, now = Date.now()): void => {
  const safeUid = String(uid || '').trim();
  const safeId = String(identity || '').trim();
  if (!safeUid || !safeId) return;
  const key = safeUid + '|' + safeId;
  const entry = byTrack.get(key) || { recent: [], blockedUntil: 0 };
  if (entry.blockedUntil > now) return;
  entry.recent = entry.recent.filter((time) => time > now - FIVE_MINUTES);
  entry.recent.push(now);
  byTrack.set(key, entry);
  if (byTrack.size > 300) {
    for (const [k, v] of byTrack) {
      if (v.blockedUntil <= now && (!v.recent.length || v.recent[v.recent.length - 1] <= now - FIVE_MINUTES))
        byTrack.delete(k);
    }
  }
};

/**
 * Block the seventh attempted Explore like toggle inside 5s, the twentieth inside 30s,
 * or the fiftieth inside 5m, counting only prior accepted state changes.
 * Pass recordOnAllow=false when the mutation can still fail; call
 * recordExploreLikeAcceptedClick only after the visible/canonical action succeeds.
 * The warning is shown ONCE when a block begins, not for each blocked tap.
 */
export const admitExploreLikeClick = (
  uid: string, identity: string, now = Date.now(), recordOnAllow = true,
): ExploreLikeClickDecision => {
  const safeUid = String(uid || '').trim();
  const safeId = String(identity || '').trim();
  if (!safeUid || !safeId) return { allowed: true, notify: false, retryAfterMs: 0 };
  const key = safeUid + '|' + safeId;
  const entry = byTrack.get(key) || { recent: [], blockedUntil: 0 };
  entry.recent = entry.recent.filter((time) => time > now - FIVE_MINUTES);
  if (entry.blockedUntil > now) {
    return { allowed: false, notify: false, retryAfterMs: entry.blockedUntil - now };
  }
  const severe = countWithin(entry.recent, now, FIVE_MINUTES) >= 49;
  const medium = countWithin(entry.recent, now, THIRTY_SECONDS) >= 19;
  const burst = countWithin(entry.recent, now, FIVE_SECONDS) >= 6;
  if (burst || medium || severe) {
    const blockMs = severe ? 600_000 : medium ? 60_000 : 10_000;
    entry.blockedUntil = now + blockMs;
    byTrack.set(key, entry);
    return { allowed: false, notify: true, retryAfterMs: blockMs };
  }
  if (recordOnAllow) recordExploreLikeAcceptedClick(safeUid, safeId, now);
  return { allowed: true, notify: false, retryAfterMs: 0 };
};
