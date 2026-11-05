/** Session-local defense-in-depth. A browser guard cannot replace backend rate limits. */
export type StudioHeartClickDecision = { allowed: boolean; notify: boolean; retryAfterMs: number };
type ClickRecord = { recent: number[]; blockedUntil: number; strikes: number; lastNoticeAt: number };
const bySong = new Map<string, ClickRecord>();
const FIVE_SECONDS = 5_000;
const THIRTY_SECONDS = 30_000;
const FIVE_MINUTES = 300_000;
const countWithin = (times: number[], now: number, span: number) =>
  times.filter((time) => time > now - span).length;

/** Block before optimistic UI, outbox or RTDB; never delete a previously queued action. */
export const admitStudioHeartClick = (uid: string, identity: string, now = Date.now()): StudioHeartClickDecision => {
  const safeUid = String(uid || '').trim();
  const safeId = String(identity || '').trim();
  if (!safeUid || !safeId) return { allowed: true, notify: false, retryAfterMs: 0 };
  const key = safeUid + '|' + safeId;
  const entry = bySong.get(key) || { recent: [], blockedUntil: 0, strikes: 0, lastNoticeAt: 0 };
  entry.recent = entry.recent.filter((time) => time > now - FIVE_MINUTES);
  if (entry.blockedUntil > now) {
    const notify = entry.lastNoticeAt === 0 || now - entry.lastNoticeAt >= THIRTY_SECONDS;
    if (notify) entry.lastNoticeAt = now;
    bySong.set(key, entry);
    return { allowed: false, notify, retryAfterMs: entry.blockedUntil - now };
  }
  const severe = countWithin(entry.recent, now, FIVE_MINUTES) >= 19;
  const medium = countWithin(entry.recent, now, THIRTY_SECONDS) >= 9;
  const burst = countWithin(entry.recent, now, FIVE_SECONDS) >= 5;
  if (burst || medium || severe) {
    entry.strikes += 1;
    const blockMs = severe || entry.strikes >= 3 ? FIVE_MINUTES : medium || entry.strikes === 2 ? 60_000 : 20_000;
    entry.blockedUntil = now + blockMs;
    entry.lastNoticeAt = now;
    bySong.set(key, entry);
    return { allowed: false, notify: true, retryAfterMs: blockMs };
  }
  entry.recent.push(now);
  bySong.set(key, entry);
  if (bySong.size > 300) {
    for (const [k, v] of bySong) {
      if (v.blockedUntil <= now && (!v.recent.length || v.recent[v.recent.length - 1] <= now - FIVE_MINUTES)) bySong.delete(k);
    }
  }
  return { allowed: true, notify: false, retryAfterMs: 0 };
};
