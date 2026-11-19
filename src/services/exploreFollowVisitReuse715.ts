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
// APP726: a successful exact GET can be reused across route remounts only
// after BOTH the actor stream is ready and the target public RTDB revision
// has been observed again. A missing or changed signal forces the old GET path.
const RETURN_REUSE_MS_726 = 30_000;
type Public726 = {
  generation: string; revision: number; followerCount: number;
  followingCount: number; observedAt: number;
};
type VerifiedReturn726 = {
  state: ExploreFollowState; at: number; revision: string;
  generation: string;
};
const observedPublic726 = new Map<string, { generation: string; revision: number }>();
const verifiedReturns726 = new Map<string, VerifiedReturn726>();
const pair726 = (viewer: string, target: string) => {
  const a=String(viewer||'').trim(),b=String(target||'').trim();
  return a&&b&&a!==b?JSON.stringify([a,b]):'';
};
export const observePublicFollowRevision726 = (
  viewer: string,target: string,generation: string,revision: number,
): boolean => {
  const key=pair726(viewer,target);
  if(!key||!generation||!Number.isSafeInteger(revision)||revision<0)return true;
  const prior=observedPublic726.get(key);
  if(prior?.generation===generation&&prior.revision===revision)return false;
  // Never roll a remembered revision backward on a retained older response.
  if(prior?.generation===generation&&prior.revision>revision)return true;
  observedPublic726.delete(key);
  observedPublic726.set(key,{generation,revision});
  if(observedPublic726.size>MAX_VISITS_715)
    observedPublic726.delete(observedPublic726.keys().next().value!);
  return true; // new public signal is a REAL cache-invalidation boundary
};
export const rememberVerifiedFollowReturn726 = (
  viewer:string,target:string,state:ExploreFollowState,startedAt:number,
  now:number,publicSignal:Public726|null,actorLive:boolean,
):boolean=>{
  const id=pair726(viewer,target);
  if(!actorLive||!id||!publicSignal||state.countVerified661!==true||
     !Number.isSafeInteger(startedAt)||!Number.isSafeInteger(now)||
     now<startedAt||now-startedAt>=10_000||
     !Number.isSafeInteger(publicSignal.observedAt)||
     publicSignal.observedAt>startedAt||
     !Number.isSafeInteger(publicSignal.revision)||
     state.followerCount!==publicSignal.followerCount||
     state.followingCount!==publicSignal.followingCount)return false;
  const observed=observedPublic726.get(id);
  if(observed?.generation!==publicSignal.generation||
     observed.revision!==publicSignal.revision)return false;
  verifiedReturns726.delete(id);
  verifiedReturns726.set(id,{
    state:{...state},at:startedAt,
    generation:publicSignal.generation,revision:String(publicSignal.revision),
  });
  if(verifiedReturns726.size>MAX_VISITS_715)
    verifiedReturns726.delete(verifiedReturns726.keys().next().value!);
  return true;
};
export const readVerifiedFollowReturn726 = (
  viewer:string,target:string,now:number,publicSignal:Public726|null,
  actorLive:boolean,choice:{following:boolean;settled:boolean;at:number}|null,
):ExploreFollowState|null=>{
  if(!actorLive||!publicSignal)return null;
  const id=pair726(viewer,target),row=verifiedReturns726.get(id);
  if(!id||!row)return null;
  if(!Number.isSafeInteger(now)||now<row.at||
     now-row.at>=RETURN_REUSE_MS_726||
     row.generation!==publicSignal.generation||
     row.revision!==String(publicSignal.revision)||
     row.state.followerCount!==publicSignal.followerCount||
     row.state.followingCount!==publicSignal.followingCount||
     observedPublic726.get(id)?.generation!==publicSignal.generation||
     observedPublic726.get(id)?.revision!==publicSignal.revision||
     (choice!==null&&(!choice.settled||row.at<choice.at||
       row.state.isFollowing!==choice.following))){
    verifiedReturns726.delete(id);
    return null;
  }
  return {...row.state};
};
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

// APP725: pending GETs are shared across *mounted Explore instances* in this
// browser tab. Completed data stays in each instance's existing APP715 cache.
// Never store these requests or results in localStorage / Firebase / the server.
type Inflight716 = { epoch725: number; startedAt: number; task: Promise<ExploreFollowState> };
type SharedRead716 = {
  state: ExploreFollowState; startedAt: number; generation: number;
  shared: boolean; current725: boolean;
};
const inflight716 = new Map<string, Inflight716>();
let epoch725 = 0;
let observedViewer725: string | null = null;
const invalidateShared725 = () => {
  epoch725 += 1;
  inflight716.clear();
  verifiedReturns726.clear();
};
export const observeExploreFollowViewer725 = (viewerUid: string | undefined): void => {
  const uid = String(viewerUid || '').trim();
  if (observedViewer725 === uid) return;
  observedViewer725 = uid;
  observedPublic726.clear();
  invalidateShared725(); // actual logout/account switch, NOT same-user remount
};

export const createExploreFollowVisitReuse715 = () => {
  const visits = new Map<string, Visit715>();
  let generation = 0;
  const key = (viewerUid: string, targetUid: string) => {
    const viewer = String(viewerUid || '').trim();
    const target = String(targetUid || '').trim();
    return viewer && target && viewer !== target ? JSON.stringify([viewer, target]) : '';
  };
  const invalidate = (realChange725 = true) => {
    generation += 1;
    visits.clear();
    // Same-user route remount only drops this instance's display cache.
    // Actual click/ACK/RTDB/connection invalidation fences every pending GET.
    if (realChange725) invalidateShared725();
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
  // APP725: share only an unfinished authenticated GET for this exact pair.
  // Never join an older read across a new choice, pending mutation, signal,
  // account change, hidden-tab or connection invalidation. Preserve the
  // original start time so old responses cannot overwrite a newer receipt.
  const runOrJoin = (
    viewerUid: string, targetUid: string,
    load: () => Promise<ExploreFollowState>, startedAt = Date.now(),
    choiceAt725 = 0, pendingChange725 = false,
  ): Promise<SharedRead716> => {
    const id = key(viewerUid, targetUid);
    const prior = id ? inflight716.get(id) : undefined;
    const age = prior ? startedAt - prior.startedAt : -1;
    if (id && !pendingChange725 && prior?.epoch725 === epoch725 &&
        age >= 0 && age < VISIT_REUSE_MS_715 &&
        prior.startedAt >= choiceAt725) {
      const ownGeneration = generation;
      return prior.task.then(state => ({
        state: { ...state }, startedAt: prior.startedAt,
        generation: ownGeneration, shared: true,
        current725: epoch725 === prior.epoch725,
      }));
    }
    const ownGeneration = generation;
    const ownEpoch725 = epoch725;
    // Start at once. A newer intent or expired request must start separately;
    // the older request's finally must never delete the newer entry.
    let raw: Promise<ExploreFollowState>;
    try { raw = Promise.resolve(load()); }
    catch (error) { raw = Promise.reject(error); }
    const task = raw.finally(() => {
      if (id && inflight716.get(id)?.task === task) inflight716.delete(id);
    });
    if (id && (inflight716.has(id) || inflight716.size < MAX_VISITS_715))
      inflight716.set(id, { epoch725: ownEpoch725, startedAt, task });
    return task.then(state => ({
      state: { ...state }, startedAt,
      generation: ownGeneration, shared: false,
      current725: epoch725 === ownEpoch725,
    }));
  };
  return { version: () => generation, read, remember, invalidate, runOrJoin };
};
