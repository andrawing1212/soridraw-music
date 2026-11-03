// Future color-only durable outbox. Deployment/activation is explicitly HOLD.
// No collection-wide favorites or suno_tracks trigger is registered: idle
// unrelated document writes incur ZERO new event Function invocations.
// A callable performs the existing canonical color update + one durable
// per-song outbox update in ONE Firestore transaction. A bounded scheduler
// retries pending records even after Eventarc's normal retry window.
// No Firestore Rules change: outbox is server-only, inaccessible to browsers.
import { createHash, randomUUID } from 'node:crypto';
import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { colorCatalogSigningKey, deliverLatestCanonicalColor } from './colorCatalogPublisher';
import type { CanonicalColorKind } from './colorCatalogEventPure';

type OutboxRow = {
  schemaVersion: 1;
  uid: string;
  kind: CanonicalColorKind;
  documentId: string;
  generation: string;
  nextAttemptAt: admin.firestore.Timestamp;
  attempts: number;
  createdAt: admin.firestore.Timestamp;
};
const queue = () => admin.firestore().collection('color_catalog_outbox');
const validColor = (c: unknown): c is string | null =>
  c === null || ['red','orange','yellow','green','blue','purple'].includes(String(c));
const validId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= 240 &&
  id !== '.' && id !== '..' && !/[\/\\]/.test(id);
const validIndex = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 999;
const keyFor = (uid: string, kind: CanonicalColorKind, id: string) =>
  createHash('sha256').update(JSON.stringify([uid, kind, id])).digest('hex');
const isActive = (kind: CanonicalColorKind, row: Record<string,unknown>) => {
  if (row.hidden === true || row.deletedAt || row.trashedAt || row.status === 'deleted') return false;
  if (kind === 'library') return true;
  if (row.favoriteRemoved === true || row.saved === false || row.favoriteHidden === true) return false;
  if (row.saved === true || row.favoriteRemoved === false) return true;
  return !(row.favoriteRemovedAt || row.unlikedAt || row.unsavedAt);
};
const isColorOutboxEnabled = () => process.env.SORIDRAW_COLOR_CATALOG_EVENTS_V1 === '1';
const sourceRef = (uid: string, kind: CanonicalColorKind, id: string) => kind === 'musicNote'
  ? admin.firestore().collection('favorites').doc(id)
  : admin.firestore().collection('suno_tracks').doc(uid).collection('tracks').doc(id);

const scheduleRetry = async (ref: admin.firestore.DocumentReference, generation: string) => {
  await admin.firestore().runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const current = snapshot.data() as OutboxRow | undefined;
    if (!current || current.generation !== generation) return;
    const attempts = Math.min(20, Math.max(0,Number(current.attempts||0)) + 1);
    const delay = Math.min(6*60*60_000, Math.max(5*60_000,2**Math.min(attempts,12)*60_000));
    tx.update(ref, {
      attempts,
      nextAttemptAt: admin.firestore.Timestamp.fromMillis(Date.now()+delay),
    });
  });
};

// Idempotent under competing caller & scheduler execution. A late successful
// delivery can ACK only its own generation, never erase a newer pending click.
export const tryDeliverPendingCanonicalColor = async (
  ref: admin.firestore.DocumentReference,
  expectedGeneration?: string,
):Promise<'DELIVERED'|'SUPERSEDED'|'RETRY'> => {
  const snapshot = await ref.get();
  const row = snapshot.data() as OutboxRow | undefined;
  if (!row || row.schemaVersion !== 1 || !validId(row.documentId)
    || !row.uid || !['musicNote','library'].includes(row.kind)
    || !row.generation || (expectedGeneration && row.generation !== expectedGeneration)) {
    return 'SUPERSEDED';
  }
  try {
    const outcome = await deliverLatestCanonicalColor(row.kind,row.uid,row.documentId,row.generation);
    if (outcome !== 'DELIVERED' && outcome !== 'CANONICAL_ABSENT') throw Error('UNCONFIRMED_DELIVERY');
    await admin.firestore().runTransaction(async tx => {
      const current = (await tx.get(ref)).data() as OutboxRow | undefined;
      if (current?.generation === row.generation) tx.delete(ref);
    });
    return 'DELIVERED';
  } catch {
    await scheduleRetry(ref,row.generation);
    return 'RETRY';
  }
};

// Short-lived, explicit-approval compatibility bridge for clients that still
// write colors directly to Firestore without using the callable. An isolated
// trigger compares its event snapshots first; an unchanged document costs no
// extra Firestore IO beyond the event invocation. Enqueue ONLY the exact active
// canonical row. An existing pending generation is authoritative because its
// later delivery re-reads the latest canonical value.
export const stageLegacyCanonicalColorChange = async (
  kind: CanonicalColorKind, uid: string, documentId: string,
):Promise<'QUEUED'|'EXISTING'|'INACTIVE'> => {
  if (!uid || uid.length > 128 || !validId(documentId)
    || !['musicNote','library'].includes(kind)) return 'INACTIVE';
  const song = sourceRef(uid,kind,documentId);
  const rowRef = queue().doc(keyFor(uid,kind,documentId));
  let state:'QUEUED'|'EXISTING'|'INACTIVE' = 'INACTIVE';
  await admin.firestore().runTransaction(async tx => {
    const latest = await tx.get(song);
    const pending = await tx.get(rowRef);
    if (!latest.exists) return;
    const data = (latest.data() || {}) as Record<string,unknown>;
    if (!isActive(kind,data)
      || (kind === 'musicNote' && data.uid !== uid)
      || (kind === 'library' && data.uid && data.uid !== uid)) return;
    if (pending.exists) { state='EXISTING'; return; }
    tx.set(rowRef,{
      schemaVersion:1,uid,kind,documentId,
      generation:randomUUID(),attempts:0,
      createdAt:admin.firestore.Timestamp.now(),
      nextAttemptAt:admin.firestore.Timestamp.now(),
    } satisfies OutboxRow);
    state='QUEUED';
  });
  return state;
};

export const commitCanonicalColorWithOutbox = onCall({
  region:'asia-northeast3', enforceAppCheck:true, maxInstances:10,
  secrets:[colorCatalogSigningKey],
}, async request => {
  if (!isColorOutboxEnabled()) throw new HttpsError('failed-precondition','COLOR_CATALOG_DISABLED');
  const uid = String(request.auth?.uid || '').trim();
  if (!uid) throw new HttpsError('unauthenticated','AUTH_REQUIRED');
  const body = request.data as Record<string,unknown> | null;
  const kind = body?.kind;
  const documentId = body?.documentId;
  const field = body?.field;
  const index = body?.index;
  const color = body?.color;
  if (!body || Object.keys(body).some(k=>!['kind','documentId','field','index','color'].includes(k))
    || (kind !== 'musicNote' && kind !== 'library')
    || !validId(documentId) || !validColor(color)
    || (kind === 'musicNote' && (field !== 'favoriteColorTag' || index !== undefined))
    || (kind === 'library' && (field !== 'colorTags' && field !== 'favoriteColorTags' || !validIndex(index)))) {
    throw new HttpsError('invalid-argument','INVALID_COLOR_CHANGE');
  }
  const song = sourceRef(uid, kind,documentId);
  const rowRef = queue().doc(keyFor(uid,kind,documentId));
  const generation = randomUUID();
  let changed = false;
  await admin.firestore().runTransaction(async tx => {
    const existing = await tx.get(song);
    if (!existing.exists) throw new HttpsError('not-found','CANONICAL_ROW_ABSENT');
    const record = (existing.data() || {}) as Record<string,unknown>;
    if ((kind === 'musicNote' && record.uid !== uid)
      || (kind === 'library' && record.uid && record.uid !== uid)) {
      throw new HttpsError('permission-denied','CANONICAL_OWNER_MISMATCH');
    }
    if (!isActive(kind,record)) throw new HttpsError('failed-precondition','CANONICAL_ROW_INACTIVE');
    const value = kind === 'musicNote' ? record.favoriteColorTag
      : (record[field as string] as Record<string,unknown> | undefined)?.[String(index)];
    if (value === color || (value === null && color === null)) return;
    const path = kind === 'musicNote' ? 'favoriteColorTag' : field + '.' + index;
    tx.update(song, { [path]: color, updatedAt:admin.firestore.FieldValue.serverTimestamp() });
    tx.set(rowRef, {
      schemaVersion:1,uid,kind,documentId,generation,
      attempts:0,createdAt:admin.firestore.Timestamp.now(),
      nextAttemptAt:admin.firestore.Timestamp.now(),
    } satisfies OutboxRow);
    changed = true;
  });
  if (!changed) return {ok:true,changed:false,pending:false};
  // Durable record has already committed. Do not roll back canonical data on
  // Cloudflare failure; the scheduler will replay the exact pending record.
  const delivery = await tryDeliverPendingCanonicalColor(rowRef,generation);
  return {ok:true,changed:true,pending:delivery === 'RETRY'};
});

// Bounded backlog capacity: 300 due rows per 5 minutes, max 15 concurrent
// deliveries. At 12s network timeout each wave of 15 needs <=12s network
// time; 20 waves have a 240s network ceiling excluding Firestore latency.
// Failure backoff, per-event CAS and single scheduler instance remain intact.
export const COLOR_REPLAY_LIMIT = 300;
export const COLOR_REPLAY_PARALLELISM = 15;
export const COLOR_REPLAY_CADENCE_MINUTES = 5;
export const retryPendingCanonicalColors = onSchedule({
  schedule:'every 5 minutes', timeZone:'UTC', region:'asia-northeast3',
  maxInstances:1, timeoutSeconds:540, secrets:[colorCatalogSigningKey],
}, async () => {
  if (!isColorOutboxEnabled()) return;
  // Indexed, due-time-bounded query; NEVER enumerate all outbox rows.
  const due = await queue().where('nextAttemptAt','<=',admin.firestore.Timestamp.now())
    .orderBy('nextAttemptAt').limit(COLOR_REPLAY_LIMIT).get();
  for (let index = 0; index < due.docs.length; index += COLOR_REPLAY_PARALLELISM) {
    await Promise.allSettled(due.docs.slice(index,index+COLOR_REPLAY_PARALLELISM).map(item =>
      tryDeliverPendingCanonicalColor(item.ref)
    ));
  }
});
