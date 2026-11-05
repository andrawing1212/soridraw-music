import { get, onChildAdded, onChildChanged, onChildRemoved, ref, runTransaction, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';

export type StudioHeartHandoffReceipt = {
  documentId: string;
  seq: number;
  desiredSaved: boolean;
  originDeviceId: string;
  updatedAtMs: number;
  status: 'pending' | 'claimed';
  claimToken: string;
  claimedUntilMs: number;
  songJson: string;
};

const MAX_SONG_JSON = 24000;
const CLAIM_LEASE_MS = 30_000;
const quietMs = 5_000;
const safeKey = (value: string): string => {
  const id = String(value || '').trim();
  return id.length > 0 && id.length <= 256 && !/[.#$\[\]/]/.test(id) ? id : '';
};
const receiptRef = (uid: string, id: string) =>
  ref(realtimeDb, 'userSync/' + uid + '/studioHeartHandoffs/' + id);
const getOrigin = (): string => {
  try {
    const key = 'soridraw_studio_heart_handoff_device_v1';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = 'sh_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem(key, id);
    return id;
  } catch {
    return 'sh_session_' + Math.random().toString(36).slice(2, 12);
  }
};
export const studioHeartHandoffDeviceId = getOrigin;
const normalize = (input: unknown): StudioHeartHandoffReceipt | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const x = input as Record<string, any>;
  const id = safeKey(String(x.documentId || ''));
  const seq = Number(x.seq || 0);
  const updated = Number(x.updatedAtMs || 0);
  const desired = x.desiredSaved;
  const status = x.status;
  if (!id || !Number.isSafeInteger(seq) || seq < 1 || !Number.isFinite(updated)
    || updated <= 0 || typeof desired !== 'boolean'
    || (status !== 'pending' && status !== 'claimed')) return null;
  const songJson = typeof x.songJson === 'string' && x.songJson.length <= MAX_SONG_JSON
    ? x.songJson : '';
  return {
    documentId: id, seq, desiredSaved: desired,
    originDeviceId: String(x.originDeviceId || '').slice(0, 96),
    updatedAtMs: updated, status,
    claimToken: String(x.claimToken || '').slice(0, 96),
    claimedUntilMs: Math.max(0, Number(x.claimedUntilMs || 0)),
    songJson,
  };
};

/** The durable RTDB receipt is independent of the ephemeral live-preview event. */
export const publishStudioHeartHandoff = async (
  uid: string, documentId: string, desiredSaved: boolean, song: unknown,
  updatedAtMs: number,
): Promise<StudioHeartHandoffReceipt | null> => {
  const id = safeKey(documentId);
  if (!uid || !id || typeof desiredSaved !== 'boolean') return null;
  let songJson = '';
  if (desiredSaved) {
    try {
      songJson = JSON.stringify(song);
    } catch { throw new Error('STUDIO_HEART_HANDOFF_SONG_NOT_SERIALIZABLE'); }
    if (!songJson || songJson.length > MAX_SONG_JSON)
      throw new Error('STUDIO_HEART_HANDOFF_SONG_TOO_LARGE');
  }
  const originDeviceId = getOrigin();
  const target = receiptRef(uid, id);
  const outcome = await runTransaction(target, (current: any) => {
    const previous = normalize(current);
    // An earlier click on THIS device must not overwrite a newer delivered click.
    if (previous && previous.originDeviceId === originDeviceId
      && previous.updatedAtMs > updatedAtMs) return;
    return {
      documentId: id,
      seq: Math.max(Date.now(), (previous?.seq || 0) + 1),
      desiredSaved, originDeviceId,
      updatedAtMs,
      status: 'pending', claimToken: '', claimedUntilMs: 0,
      songJson,
    };
  }, { applyLocally: false });
  return outcome.committed ? normalize(outcome.snapshot.val()) : null;
};

export const claimStudioHeartHandoff = async (
  uid: string, documentId: string,
  expected?: { seq: number; desiredSaved: boolean } | null,
): Promise<{ receipt: StudioHeartHandoffReceipt; token: string } | null> => {
  const id = safeKey(documentId);
  if (!uid || !id) return null;
  const token = getOrigin() + '_' + Math.random().toString(36).slice(2, 13);
  const now = Date.now();
  const outcome = await runTransaction(receiptRef(uid, id), (value: any) => {
    const current = normalize(value);
    if (!current) return;
    if (expected && (current.seq !== expected.seq || current.desiredSaved !== expected.desiredSaved)) return;
    if (current.updatedAtMs + quietMs > now) return;
    if (current.status === 'claimed' && current.claimedUntilMs > now) return;
    return { ...current, status: 'claimed', claimToken: token, claimedUntilMs: now + CLAIM_LEASE_MS };
  }, { applyLocally: false });
  const value = normalize(outcome.snapshot.val());
  return outcome.committed && value?.claimToken === token ? { receipt: value, token } : null;
};

/** A completed receipt is deleted only by the exact claim owner and version. */
export const settleStudioHeartHandoff = async (uid: string, documentId: string, seq: number, token: string): Promise<boolean> => {
  const id = safeKey(documentId);
  if (!uid || !id || !token) return false;
  const outcome = await runTransaction(receiptRef(uid, id), (value: any) => {
    const current = normalize(value);
    if (!current || current.seq !== seq || current.claimToken !== token || current.status !== 'claimed') return;
    return null;
  }, { applyLocally: false });
  return outcome.committed;
};

export const releaseStudioHeartHandoff = async (uid: string, documentId: string, seq: number, token: string): Promise<void> => {
  const id = safeKey(documentId);
  if (!uid || !id || !token) return;
  await runTransaction(receiptRef(uid, id), (value: any) => {
    const current = normalize(value);
    if (!current || current.seq !== seq || current.claimToken !== token || current.status !== 'claimed') return;
    return { ...current, status:'pending', claimToken:'', claimedUntilMs:0 };
  }, { applyLocally:false });
};

export const readStudioHeartHandoff = async (uid: string, documentId: string): Promise<StudioHeartHandoffReceipt | null> => {
  const id = safeKey(documentId);
  if (!uid || !id) return null;
  return normalize((await get(receiptRef(uid, id))).val());
};

/** Child-only subscription: an empty inbox has no per-song downloads or polling. */
export const subscribeStudioHeartHandoffs = (
  uid: string, callback: (receipt: StudioHeartHandoffReceipt) => void,
  onRemoved?: (documentId: string) => void,
): Unsubscribe => {
  if (!uid) return () => {};
  const location = ref(realtimeDb, 'userSync/' + uid + '/studioHeartHandoffs');
  const receive = (snapshot: any) => {
    const item = normalize(snapshot.val());
    if (item && item.documentId === snapshot.key) callback(item);
  };
  const offAdd = onChildAdded(location, receive);
  const offChange = onChildChanged(location, receive);
  const offRemove = onChildRemoved(location, (snapshot) => {
    if (snapshot.key && onRemoved) onRemoved(snapshot.key);
  });
  return () => { offAdd(); offChange(); offRemove(); };
};
