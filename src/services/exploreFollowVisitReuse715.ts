// APP715: bounded, in-memory third-party Follow visit reuse only.
// A previous authenticated GET is a short-lived display hint, never a new
// canonical ACK or a replacement for failure recovery/committed RTDB signals.
import type { ExploreFollowState } from './exploreSocialService';

const VISIT_REUSE_MS_715 = 10_000;
// APP721: a verified GET remains reusable for at most 5 minutes while the
// existing same-account RTDB stream is observed as healthy. A single retained
// last-change signal is NOT a durable history; never cache forever.
const SIGNAL_QUALIFIED_REUSE_MS_720 = 300_000;
const MAX_VISITS_715 = 24;
type Visit715 = { at: number; state: ExploreFollowState; qualified720: boolean };
// APP724: a recent local choice must remain a fence against old GET/RTDB,
// but one *post-ACK, exact* canonical GET suffices for warm revisits. Pending
// and unverified/mismatched responses never qualify.
type Choice724 = { following: boolean; settled: boolean; at: number } | null;
export const canReuseVerifiedFollowChoice724 = (
  choice: Choice724, state: ExploreFollowState | null, now: number,
): boolean => Boolean(choice?.settled === true && state?.countVerified661 === true &&
  Number.isSafeInteger(choice.at) && choice.at > 0 &&
  now >= choice.at && now - choice.at <= 30_000 &&
  state.isFollowing === choice.following);

export const canRememberPostAckFollowChoice724 = (
  choice: Choice724, state: ExploreFollowState, readStartedAt: number, now: number,
): boolean => canReuseVerifiedFollowChoice724(choice, state, now) &&
  Number.isFinite(readStartedAt) && readStartedAt >= choice!.at;

type Inflight716 = { generation: number; startedAt: number; task: Promise<ExploreFollowState> };
type SharedRead716 = { state: ExploreFollowState; startedAt: number; generation: number; shared: boolean };

export const createExploreFollowVisitReuse715 = () => {
  const visits = new Map<string, Visit715>();
  const inflight716 = new Map<string, Inflight716>();
  let generation = 0;
  const key = (viewerUid: string, targetUid: string) => {
    const viewer = String(viewerUid || '').trim();
    const target = String(targetUid || '').trim();
    return viewer && target && viewer !== target ? JSON.stringify([viewer, target]) : '';
  };
  const invalidate = () => {
    generation += 1;
    visits.clear();
    // Never join a GET started before a click, confirmed event or account switch.
    // Existing callers retain their own promise and freshness guards.
    inflight716.clear();
  };
  const read = (
    viewerUid: string, targetUid: string, now = Date.now(),
    signalLive720 = false,
  ): ExploreFollowState | null => {
    const id = key(viewerUid, targetUid);
    const row = visits.get(id);
    if (!row) return null;
    const age = now - row.at;
    const limit = signalLive720 && row.qualified720
      ? SIGNAL_QUALIFIED_REUSE_MS_720 : VISIT_REUSE_MS_715;
    if (age < 0 || age >= limit) {
      visits.delete(id);
      return null;
    }
    return { ...row.state };
  };
  const remember = (
    viewerUid: string, targetUid: string, state: ExploreFollowState,
    startedAt: number, startedGeneration: number, now = Date.now(),
    signalLive720 = false,
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
    visits.set(id, {
      at: startedAt, state: { ...state },
      // Missing/legacy count authority never earns the extended lease.
      qualified720: signalLive720 && state.countVerified661 === true,
    });
    if (visits.size > MAX_VISITS_715) {
      visits.delete(visits.keys().next().value!);
    }
    return true;
  };
  // APP716: join only concurrently pending authenticated GETs for the SAME
  // signed-in viewer and target, within the same invalidation generation.
  // No persistent storage, polling, abort or new backend request is introduced.
  const runOrJoin = (
    viewerUid: string, targetUid: string,
    load: () => Promise<ExploreFollowState>, startedAt = Date.now(),
  ): Promise<SharedRead716> => {
    const id = key(viewerUid, targetUid);
    const prior = id ? inflight716.get(id) : undefined;
    if (prior?.generation === generation) {
      return prior.task.then(state => ({
        state: { ...state }, startedAt: prior.startedAt,
        generation: prior.generation, shared: true,
      }));
    }
    const startedGeneration = generation;
    // Start immediately, rather than scheduling a request after invalidation.
    let raw: Promise<ExploreFollowState>;
    try { raw = Promise.resolve(load()); }
    catch (error) { raw = Promise.reject(error); }
    const task = raw.finally(() => {
      // An invalidated old request must never delete a newer in-flight entry.
      if (id && inflight716.get(id)?.task === task) inflight716.delete(id);
    });
    if (id && inflight716.size < MAX_VISITS_715)
      inflight716.set(id, { generation: startedGeneration, startedAt, task });
    return task.then(state => ({
      state: { ...state }, startedAt,
      generation: startedGeneration, shared: false,
    }));
  };
  return { version: () => generation, read, remember, invalidate, runOrJoin };
};
