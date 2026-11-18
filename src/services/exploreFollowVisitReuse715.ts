// APP715: bounded, in-memory third-party Follow visit reuse only.
// A previous authenticated GET is a short-lived display hint, never a new
// canonical ACK or a replacement for failure recovery/committed RTDB signals.
import type { ExploreFollowState } from './exploreSocialService';

const VISIT_REUSE_MS_715 = 10_000;
const MAX_VISITS_715 = 24;
type Visit715 = { at: number; state: ExploreFollowState };

export const createExploreFollowVisitReuse715 = () => {
  const visits = new Map<string, Visit715>();
  let generation = 0;
  const key = (viewerUid: string, targetUid: string) => {
    const viewer = String(viewerUid || '').trim();
    const target = String(targetUid || '').trim();
    return viewer && target && viewer !== target ? JSON.stringify([viewer, target]) : '';
  };
  const invalidate = () => {
    generation += 1;
    visits.clear();
  };
  const read = (viewerUid: string, targetUid: string, now = Date.now()): ExploreFollowState | null => {
    const id = key(viewerUid, targetUid);
    const row = visits.get(id);
    if (!row) return null;
    const age = now - row.at;
    if (age < 0 || age >= VISIT_REUSE_MS_715) {
      visits.delete(id);
      return null;
    }
    return { ...row.state };
  };
  const remember = (
    viewerUid: string, targetUid: string, state: ExploreFollowState,
    startedAt: number, startedGeneration: number, now = Date.now(),
  ): boolean => {
    const id = key(viewerUid, targetUid);
    const age = now - startedAt;
    if (!id || generation !== startedGeneration || age < 0 ||
        age >= VISIT_REUSE_MS_715 ||
        typeof state?.isFollowing !== 'boolean' ||
        !Number.isSafeInteger(state.followerCount) || state.followerCount < 0 ||
        !Number.isSafeInteger(state.followingCount) || state.followingCount < 0) return false;
    // Freshness begins when the GET started, never when it finally completed.
    visits.delete(id);
    visits.set(id, { at: startedAt, state: { ...state } });
    if (visits.size > MAX_VISITS_715) {
      visits.delete(visits.keys().next().value!);
    }
    return true;
  };
  return { version: () => generation, read, remember, invalidate };
};
