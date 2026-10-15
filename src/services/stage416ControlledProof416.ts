import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { readCacheDiagnosticsEnabled } from '../lib/cacheDiagnostics';
import { auth, functions, getFirebaseAppCheckToken, httpsCallable } from '../firebase';
import { getExploreLikedTrackCollectionIds } from './exploreLikedTracksService';
import { readExploreTrackLikeMembership127 } from './exploreLikeService';
import { reserveExploreLikeDeviceSequence416 } from './exploreLikeDeviceSequence416.mjs';
import {
  markStage416PrivateAcceptanceRegistered416,
  recordStage416PrivateAcceptanceError416,
  recordStage416PrivateAcceptanceReply416,
} from './exploreLikePrivateDiagnostic416';
import {
  retryPrivateClickAfterPriorSeal416,
  type PrivateRtdbClick416,
} from './exploreLikePrivateRtdbTransport416';

type StoredProof416 = {
  schemaVersion: 1;
  operationId: string;
  trackId: string;
  deviceId: string;
  deviceSequence: number;
  createdAt: number;
};

type MasterTimingReply416 = {
  ok?: boolean;
  privateMinutes?: number;
  publicMinutes?: number;
  version?: number;
};

type PrivateClickReply416 = {
  ok?: boolean;
  accepted?: boolean;
  version?: number;
  count?: number;
  reason?: string;
};

export type Stage416ControlledProofResult416 = {
  accepted: true;
  version: number;
  count: number;
  privateMinutes: number;
  reusedOperation: boolean;
  reason: string;
};

export type Stage416ControlledPublicProofResult416 = {
  accepted: true;
  version: number;
  count: number;
  privateMinutes: number;
  publicMinutes: number;
  reusedOperation: boolean;
  reason: string;
};

const KEY_PREFIX_416 = 'soridraw:stage416:controlled-e2e-proof:v1:';
const PUBLIC_KEY_PREFIX_416 = 'soridraw:stage416:controlled-public-proof:v1:';
const UUID_416 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const proofKey416 = (uid: string) => KEY_PREFIX_416 + encodeURIComponent(uid);
const publicProofKey416 = (uid: string) => PUBLIC_KEY_PREFIX_416 + encodeURIComponent(uid);

const readStoredProof416 = (uid: string): StoredProof416 | null => {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(proofKey416(uid));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredProof416>;
    if (value.schemaVersion !== 1 || !UUID_416.test(String(value.operationId || '')) ||
        !UUID_416.test(String(value.deviceId || '')) ||
        !String(value.trackId || '').trim() || String(value.trackId).length > 512 ||
        !Number.isSafeInteger(Number(value.deviceSequence)) || Number(value.deviceSequence) <= 0 ||
        !Number.isSafeInteger(Number(value.createdAt)) || Number(value.createdAt) <= 0) return null;
    return {
      schemaVersion: 1,
      operationId: String(value.operationId),
      trackId: String(value.trackId),
      deviceId: String(value.deviceId),
      deviceSequence: Number(value.deviceSequence),
      createdAt: Number(value.createdAt),
    };
  } catch {
    return null;
  }
};

const readStoredPublicProof416 = (uid: string): StoredProof416 | null => {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(publicProofKey416(uid));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredProof416>;
    if (value.schemaVersion !== 1 || !UUID_416.test(String(value.operationId || '')) ||
        !UUID_416.test(String(value.deviceId || '')) ||
        !String(value.trackId || '').trim() || String(value.trackId).length > 512 ||
        !Number.isSafeInteger(Number(value.deviceSequence)) || Number(value.deviceSequence) <= 0 ||
        !Number.isSafeInteger(Number(value.createdAt)) || Number(value.createdAt) <= 0) return null;
    return {
      schemaVersion: 1,
      operationId: String(value.operationId),
      trackId: String(value.trackId),
      deviceId: String(value.deviceId),
      deviceSequence: Number(value.deviceSequence),
      createdAt: Number(value.createdAt),
    };
  } catch {
    return null;
  }
};

const persistStoredProof416 = (uid: string, proof: StoredProof416) => {
  if (typeof window === 'undefined') throw new Error('STAGE416_PROOF_BROWSER_REQUIRED');
  window.localStorage.setItem(proofKey416(uid), JSON.stringify(proof));
  const reread = readStoredProof416(uid);
  if (!reread || reread.operationId !== proof.operationId ||
      reread.deviceId !== proof.deviceId || reread.deviceSequence !== proof.deviceSequence) {
    throw new Error('STAGE416_PROOF_INTENT_NOT_DURABLE');
  }
};

const persistStoredPublicProof416 = (uid: string, proof: StoredProof416) => {
  if (typeof window === 'undefined') throw new Error('STAGE416_PUBLIC_PROOF_BROWSER_REQUIRED');
  window.localStorage.setItem(publicProofKey416(uid), JSON.stringify(proof));
  const reread = readStoredPublicProof416(uid);
  if (!reread || reread.operationId !== proof.operationId ||
      reread.deviceId !== proof.deviceId || reread.deviceSequence !== proof.deviceSequence) {
    throw new Error('STAGE416_PUBLIC_PROOF_INTENT_NOT_DURABLE');
  }
};

const retireStoredProof416 = (uid: string, operationId: string): boolean => {
  if (!uid || typeof window === 'undefined' || !operationId) return false;
  const current = readStoredProof416(uid);
  if (!current || current.operationId !== operationId) return false;
  window.localStorage.removeItem(proofKey416(uid));
  return readStoredProof416(uid) === null;
};

export const hasStage416ControlledProofIntent416 = (uid: string): boolean =>
  !!readStoredProof416(uid);
export const hasStage416ControlledPublicProofIntent416 = (uid: string): boolean =>
  !!readStoredPublicProof416(uid);

const requireMaster416 = async (): Promise<{ privateMinutes: number; publicMinutes: number }> => {
  const call = httpsCallable<Record<string, never>, MasterTimingReply416>(
    functions, 'masterGetLikeBatchTiming416',
  );
  const response = (await call({})).data;
  const privateMinutes = Number(response?.privateMinutes);
  const publicMinutes = Number(response?.publicMinutes);
  if (response?.ok !== true ||
      ![1, 3, 5, 10, 20].includes(privateMinutes) ||
      ![1, 3, 5, 10, 20].includes(publicMinutes)) {
    throw new Error('STAGE416_MASTER_PROOF_NOT_AUTHORIZED');
  }
  return { privateMinutes, publicMinutes };
};

const confirmCanonicalLiked416 = async (trackId: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) throw new Error('STAGE416_PROOF_AUTH_REQUIRED');
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) throw new Error('STAGE416_PROOF_APPCHECK_REQUIRED');
  const query = new URLSearchParams({ trackIds: trackId });
  const response = await fetch(`${EXPLORE_API_BASE}/v1/me/likes?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
    },
  });
  let payload: any = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok || !Array.isArray(payload?.data?.likedTrackIds)) {
    throw new Error('STAGE416_PROOF_CANONICAL_CHECK_FAILED');
  }
  return payload.data.likedTrackIds
    .map((value: unknown) => String(value || '').trim())
    .includes(trackId);
};

const selectLocalLikedCandidate416 = (uid: string): string => {
  const ids = getExploreLikedTrackCollectionIds(uid) || [];
  const candidate = ids.find((trackId) =>
    readExploreTrackLikeMembership127(uid, trackId) === true);
  if (!candidate) throw new Error('STAGE416_PROOF_NO_LOCAL_LIKED_TRACK');
  return candidate;
};

const prepareProof416 = async (
  uid: string,
): Promise<{ proof: StoredProof416; reused: boolean; canonicalConfirmed: boolean }> => {
  const existing = readStoredProof416(uid);
  if (existing) return { proof: existing, reused: true, canonicalConfirmed: false };
  const trackId = selectLocalLikedCandidate416(uid);
  if (!await confirmCanonicalLiked416(trackId)) {
    throw new Error('STAGE416_PROOF_CANDIDATE_NOT_CANONICALLY_LIKED');
  }
  if (typeof window === 'undefined' || typeof navigator === 'undefined' ||
      !navigator.locks || typeof crypto === 'undefined' ||
      typeof crypto.randomUUID !== 'function') {
    throw new Error('STAGE416_PROOF_DEVICE_SEQUENCE_UNAVAILABLE');
  }
  const sequence = await reserveExploreLikeDeviceSequence416(
    uid, window.localStorage, navigator.locks, () => crypto.randomUUID(),
  );
  const proof: StoredProof416 = {
    schemaVersion: 1,
    operationId: crypto.randomUUID(),
    trackId,
    deviceId: sequence.deviceId,
    deviceSequence: sequence.deviceSequence,
    createdAt: Date.now(),
  };
  // Persist BEFORE any Stage416 mutation call so retries reuse exactly one op.
  persistStoredProof416(uid, proof);
  return { proof, reused: false, canonicalConfirmed: true };
};

const preparePublicProof416 = async (
  uid: string,
): Promise<{ proof: StoredProof416; reused: boolean; canonicalConfirmed: boolean }> => {
  const existing = readStoredPublicProof416(uid);
  if (existing) return { proof: existing, reused: true, canonicalConfirmed: false };
  const trackId = selectLocalLikedCandidate416(uid);
  if (!await confirmCanonicalLiked416(trackId)) {
    throw new Error('STAGE416_PUBLIC_PROOF_CANDIDATE_NOT_CANONICALLY_LIKED');
  }
  if (typeof window === 'undefined' || typeof navigator === 'undefined' ||
      !navigator.locks || typeof crypto === 'undefined' ||
      typeof crypto.randomUUID !== 'function') {
    throw new Error('STAGE416_PUBLIC_PROOF_DEVICE_SEQUENCE_UNAVAILABLE');
  }
  const sequence = await reserveExploreLikeDeviceSequence416(
    uid, window.localStorage, navigator.locks, () => crypto.randomUUID(),
  );
  const proof: StoredProof416 = {
    schemaVersion: 1,
    operationId: crypto.randomUUID(),
    trackId,
    deviceId: sequence.deviceId,
    deviceSequence: sequence.deviceSequence,
    createdAt: Date.now(),
  };
  // This button performs ONE real unlike. Keep the exact operation durable so
  // a retry can never allocate a second mutation after an ambiguous response.
  persistStoredPublicProof416(uid, proof);
  return { proof, reused: false, canonicalConfirmed: true };
};

export const runStage416ControlledProof416 = async (): Promise<Stage416ControlledProofResult416> => {
  const user = auth.currentUser;
  const uid = user?.uid || '';
  if (!uid) throw new Error('STAGE416_PROOF_AUTH_REQUIRED');
  if (!readCacheDiagnosticsEnabled(uid)) throw new Error('STAGE416_PROOF_DIAGNOSTICS_OFF');

  // Server-side Master authorization happens before any diagnostic mutation.
  const { privateMinutes } = await requireMaster416();
  const { proof, reused, canonicalConfirmed } = await prepareProof416(uid);

  // A fresh proof was already checked once before it was persisted. Reused
  // ambiguous operations are checked once again before any retry.
  if (!canonicalConfirmed && !await confirmCanonicalLiked416(proof.trackId)) {
    throw new Error('STAGE416_PROOF_CANDIDATE_CHANGED');
  }

  const click: PrivateRtdbClick416 = {
    trackId: proof.trackId,
    liked: true,
    operationId: proof.operationId,
    deviceId: proof.deviceId,
    deviceSequence: proof.deviceSequence,
  };
  const callable = httpsCallable<PrivateRtdbClick416, PrivateClickReply416>(
    functions, 'recordPrivateLike416',
  );
  let lastReason = 'OTHER';
  let result: { version: number; count: number } | null = null;
  try {
    result = await retryPrivateClickAfterPriorSeal416(async () => {
      try {
        const reply = (await callable(click)).data;
        lastReason = String(reply?.reason || (reply?.accepted ? 'ACCEPTED' : 'OTHER'));
        recordStage416PrivateAcceptanceReply416(uid, proof.operationId, 'initial', reply);
        return {
          ok: reply?.ok === true,
          accepted: reply?.accepted === true,
          version: Number(reply?.version),
          count: Number(reply?.count),
          reason: String(reply?.reason || ''),
        };
      } catch (error) {
        recordStage416PrivateAcceptanceError416(uid, proof.operationId, 'initial', error);
        throw error;
      }
    }, () => readStoredProof416(uid)?.operationId === proof.operationId);
  } catch (error) {
    const reason = String(
      (error as { stage416Reason?: unknown } | null)?.stage416Reason || '',
    );
    // Controlled proof only: STALE_OR_DUPLICATE means the server has already
    // advanced this device beyond this exact diagnostic operation. Retire only
    // this Master-only local proof so the next button press allocates a fresh,
    // strictly higher deviceSequence. Ambiguous transport/internal failures
    // keep the same proof and therefore still retry the same operation.
    if (reason === 'STALE_OR_DUPLICATE') {
      if (!retireStoredProof416(uid, proof.operationId)) {
        throw new Error('STAGE416_PROOF_STALE_RETIRE_FAILED');
      }
      throw new Error('STAGE416_PROOF_STALE_RETIRED');
    }
    throw error;
  }

  if (!result) throw new Error('STAGE416_PROOF_OPERATION_SUPERSEDED');
  markStage416PrivateAcceptanceRegistered416(
    uid, proof.operationId, 'initial', result.version,
  );
  return {
    accepted: true,
    version: result.version,
    count: result.count,
    privateMinutes,
    reusedOperation: reused,
    reason: lastReason,
  };
};


export const runStage416ControlledPublicProof416 = async (
): Promise<Stage416ControlledPublicProofResult416> => {
  const user = auth.currentUser;
  const uid = user?.uid || '';
  if (!uid) throw new Error('STAGE416_PUBLIC_PROOF_AUTH_REQUIRED');
  if (!readCacheDiagnosticsEnabled(uid)) {
    throw new Error('STAGE416_PUBLIC_PROOF_DIAGNOSTICS_OFF');
  }

  // Master authorization is confirmed by the already-deployed server callable
  // BEFORE creating a real unlike operation. Both timing values must be 5m;
  // the actual public hold is now the single private 5m window.
  const { privateMinutes, publicMinutes } = await requireMaster416();
  if (privateMinutes !== 5 || publicMinutes !== 5) {
    throw new Error('STAGE416_PUBLIC_PROOF_REQUIRES_5_MINUTES');
  }
  const { proof, reused, canonicalConfirmed } = await preparePublicProof416(uid);
  if (!canonicalConfirmed && !await confirmCanonicalLiked416(proof.trackId)) {
    throw new Error('STAGE416_PUBLIC_PROOF_CANDIDATE_CHANGED');
  }

  const click: PrivateRtdbClick416 = {
    trackId: proof.trackId,
    liked: false,
    operationId: proof.operationId,
    deviceId: proof.deviceId,
    deviceSequence: proof.deviceSequence,
  };
  const callable = httpsCallable<PrivateRtdbClick416, PrivateClickReply416>(
    functions, 'recordPrivateLike416',
  );
  let lastReason = 'OTHER';
  const result = await retryPrivateClickAfterPriorSeal416(async () => {
    try {
      const reply = (await callable(click)).data;
      lastReason = String(reply?.reason || (reply?.accepted ? 'ACCEPTED' : 'OTHER'));
      recordStage416PrivateAcceptanceReply416(uid, proof.operationId, 'initial', reply);
      return {
        ok: reply?.ok === true,
        accepted: reply?.accepted === true,
        version: Number(reply?.version),
        count: Number(reply?.count),
        reason: String(reply?.reason || ''),
      };
    } catch (error) {
      recordStage416PrivateAcceptanceError416(uid, proof.operationId, 'initial', error);
      throw error;
    }
  }, () => readStoredPublicProof416(uid)?.operationId === proof.operationId);

  if (!result) throw new Error('STAGE416_PUBLIC_PROOF_OPERATION_SUPERSEDED');
  markStage416PrivateAcceptanceRegistered416(
    uid, proof.operationId, 'initial', result.version,
  );
  return {
    accepted: true,
    version: result.version,
    count: result.count,
    privateMinutes,
    publicMinutes,
    reusedOperation: reused,
    reason: lastReason,
  };
};
