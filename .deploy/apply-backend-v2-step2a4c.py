from pathlib import Path

boundary = r'''// Backend V2 Step 2-A4c
// Central boundary for EXISTING V1 Recent/Music Note mutations.
// V1 stays authoritative. The registered Preview shadow hook is invoked only AFTER
// a V1 mutation resolves successfully, and hook failures never change V1 success.

import type { V2LiveMirrorOperation } from './v2LiveMutation';

export const BACKEND_V2_V1_MUTATION_MIRROR_ENABLED = true as const;

export type V1MutationDomain = 'recent' | 'musicNote';

export type V1RecentMutationOperation =
  | 'clear'
  | 'delete-item'
  | 'save-batch'
  | 'regenerate'
  | 'add-lyrics-language'
  | 'edit'
  | 'pre-favorite-edit';

export type V1MusicNoteMutationOperation =
  | 'save'
  | 'restore'
  | 'unsave'
  | 'permanent-delete'
  | 'update'
  | 'recovery-update'
  | 'bulk-delete'
  | 'bulk-lock'
  | 'bulk-unlock'
  | 'folder-update'
  | 'shared-note-save'
  | 'folder-rename'
  | 'folder-delete'
  | 'color-sync';

export type V1MutationOperation = V1RecentMutationOperation | V1MusicNoteMutationOperation;

export interface V1MutationMirrorTarget {
  targetSongId: string;
  operation: V2LiveMirrorOperation;
  sourceUpdatedAtMs: number;
  sourceDocumentId?: string;
}

export interface V1MutationBoundaryContext {
  domain: V1MutationDomain;
  operation: V1MutationOperation;
  uid: string;
  documentIds?: readonly string[];
  affectedCount?: number;
  mirrorTargets?: readonly V1MutationMirrorTarget[];
}

export type V1MutationWrite<T> = Promise<T> | (() => Promise<T>);
export type V1MutationPostSuccessHook = (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
) => void | Promise<void>;

let postSuccessHook: V1MutationPostSuccessHook | null = null;

export const registerV1MutationPostSuccessHook = (hook: V1MutationPostSuccessHook | null): void => {
  postSuccessHook = hook;
};

export async function runV1MutationBoundary<T>(
  context: Readonly<V1MutationBoundaryContext>,
  writeV1: V1MutationWrite<T>,
): Promise<T> {
  const pending = typeof writeV1 === 'function' ? writeV1() : writeV1;
  const result = await pending;
  const hook = postSuccessHook;
  if (hook) {
    try {
      Promise.resolve(hook(context, result)).catch((error) => {
        console.warn('[Backend V2 2-A4c] Preview shadow mirror failed after V1 success.', error);
      });
    } catch (error) {
      console.warn('[Backend V2 2-A4c] Preview shadow mirror hook failed after V1 success.', error);
    }
  }
  return result;
}
'''
Path('src/data/v1MutationBoundary.ts').write_text(boundary, encoding='utf-8')

outbox_path = Path('src/data/indexedDbMirrorOutbox.ts')
outbox = outbox_path.read_text(encoding='utf-8')
outbox = outbox.replace(
    "export type V2MirrorOutboxRecord = V2MirrorMutationEnvelope & {\n  attemptCount: number;",
    "export type V2MirrorOutboxRecord = V2MirrorMutationEnvelope & {\n  /** Exact V1 favorite document id for bounded payload re-read; never song identity. */\n  sourceDocumentId?: string;\n  attemptCount: number;",
    1,
)
outbox = outbox.replace(
    "  async enqueue(input: V2MirrorMutationEnvelope): Promise<boolean> {",
    "  async enqueue(input: V2MirrorMutationEnvelope & { sourceDocumentId?: string }): Promise<boolean> {",
    1,
)
outbox = outbox.replace(
    "      const record: V2MirrorOutboxRecord = {\n        ...validated,\n        attemptCount: 0,",
    "      const sourceDocumentId = input.sourceDocumentId ? requireSegment(input.sourceDocumentId, 'sourceDocumentId') : undefined;\n      const record: V2MirrorOutboxRecord = {\n        ...validated,\n        ...(sourceDocumentId ? { sourceDocumentId } : {}),\n        attemptCount: 0,",
    1,
)
if "sourceDocumentId?: string" not in outbox:
    raise SystemExit('outbox sourceDocumentId patch failed')
outbox_path.write_text(outbox, encoding='utf-8')

mirror = r'''/*
 * SORIDRAW Backend V2 Step 2-A4c — Preview-only V1-first shadow mirror.
 * V1 is authoritative. Only exact stable sd_ IDs are eligible.
 */
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { backendV2MirrorOutbox, type V2MirrorOutboxRecord } from './indexedDbMirrorOutbox';
import { compareV2MirrorVersion, createV2MirrorMutationEnvelope, isSoridrawSongId, type V2LiveMirrorOperation } from './v2LiveMutation';
import { registerV1MutationPostSuccessHook, type V1MutationBoundaryContext, type V1MutationMirrorTarget } from './v1MutationBoundary';

export const BACKEND_V2_PREVIEW_SHADOW_HOST = 'soridraw-music-git-preview-andrawing1212.vercel.app';
export const BACKEND_V2_PREVIEW_SHADOW_MAX_TARGETS_PER_MUTATION = 10;
export const BACKEND_V2_PREVIEW_SHADOW_RETRY_BATCH = 3;

const isPreviewShadowHost = (): boolean => typeof window !== 'undefined'
  && window.location.hostname.toLowerCase() === BACKEND_V2_PREVIEW_SHADOW_HOST;
export const BACKEND_V2_PREVIEW_SHADOW_MIRROR_RUNTIME_ENABLED = isPreviewShadowHost();

const retryTimers = new Map<string, number>();
const activeRetryUsers = new Set<string>();
const reservedPayloadKeys = new Set([
  'schemaVersion','musicNote','recentVisible','v2UpdatedAtMs','v2MutationId',
  'legacyRecentIndex','legacyFavoriteId','legacyFavoriteKey',
  'googleGeminiApiKey','geminiApiKey','apiKey','accessToken','idToken','refreshToken','authorization','password','secret',
]);

const sanitizeMirrorPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeMirrorPayload);
  if (!value || typeof value !== 'object') return value;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (reservedPayloadKeys.has(key) || nested === undefined) continue;
    out[key] = sanitizeMirrorPayload(nested);
  }
  return out;
};
const activeMusicNote = (payload: Record<string, unknown> | null): boolean => Boolean(payload && payload.saved !== false && payload.favoriteRemoved !== true);

const loadRecentPayload = async (uid: string, targetSongId: string): Promise<Record<string, unknown> | null> => {
  const snapshot = await getDoc(doc(db, 'user_recent_songs', uid));
  if (!snapshot.exists()) return null;
  const songs = Array.isArray(snapshot.data()?.songs) ? snapshot.data().songs : [];
  const found = songs.find((song: any) => String(song?.soridrawSongId || '').trim() === targetSongId);
  return found && typeof found === 'object' ? found as Record<string, unknown> : null;
};

const loadFavoritePayload = async (uid: string, sourceDocumentId: string, targetSongId?: string): Promise<Record<string, unknown> | null> => {
  const snapshot = await getDoc(doc(db, 'favorites', sourceDocumentId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  if (String(data.uid || '') !== uid) return null;
  const stableId = String(data.soridrawSongId || '').trim();
  if (!isSoridrawSongId(stableId) || (targetSongId && stableId !== targetSongId)) return null;
  return data;
};

const buildV2Patch = (record: V2MirrorOutboxRecord, payload: Record<string, unknown> | null, current: Record<string, unknown> | null) => {
  const safePayload = payload ? sanitizeMirrorPayload(payload) as Record<string, unknown> : {};
  let recentVisible = current?.recentVisible === true;
  let musicNote = current?.musicNote === true;
  if (record.source === 'recent') {
    if (record.operation === 'recent-hide') recentVisible = false;
    else if (record.operation === 'upsert') recentVisible = true;
  }
  if (record.source === 'musicNote') {
    if (record.operation === 'music-note-save') musicNote = true;
    else if (record.operation === 'music-note-unsave') musicNote = false;
    else if (record.operation === 'upsert') musicNote = activeMusicNote(payload);
  }
  return { ...safePayload, soridrawSongId: record.targetSongId, schemaVersion: 2, musicNote, recentVisible, v2UpdatedAtMs: record.sourceUpdatedAtMs, v2MutationId: record.mutationId };
};

const attemptMirror = async (record: V2MirrorOutboxRecord, cachedPayload?: Record<string, unknown> | null): Promise<'applied'|'terminal'|'failed'> => {
  try {
    let payload = cachedPayload;
    if (payload === undefined) {
      if (record.source === 'recent') payload = record.operation === 'recent-hide' ? null : await loadRecentPayload(record.uid, record.targetSongId);
      else if (record.source === 'musicNote') payload = record.sourceDocumentId ? await loadFavoritePayload(record.uid, record.sourceDocumentId, record.targetSongId) : null;
    }
    if (!payload && (record.operation === 'upsert' || record.operation === 'music-note-save')) return 'terminal';
    const targetRef = doc(db, 'users', record.uid, 'songs', record.targetSongId);
    const result = await runTransaction(db, async (transaction) => {
      const currentSnapshot = await transaction.get(targetRef);
      const current = currentSnapshot.exists() ? currentSnapshot.data() as Record<string, unknown> : null;
      if (current) {
        const decision = compareV2MirrorVersion(
          { sourceUpdatedAtMs: record.sourceUpdatedAtMs, mutationId: record.mutationId },
          { sourceUpdatedAtMs: Number(current.v2UpdatedAtMs || 0), mutationId: String(current.v2MutationId || '') },
        );
        if (decision === 'duplicate' || decision === 'stale') return decision;
      }
      transaction.set(targetRef, buildV2Patch(record, payload ?? null, current), { merge: true });
      return 'applied' as const;
    });
    return result === 'applied' ? 'applied' : 'terminal';
  } catch (error) {
    console.warn('[Backend V2 2-A4c] shadow write failed; V1 remains authoritative.', error);
    return 'failed';
  }
};

const finalizeAttempt = async (record: V2MirrorOutboxRecord, outcome: 'applied'|'terminal'|'failed') => {
  if (outcome === 'applied' || outcome === 'terminal') await backendV2MirrorOutbox.remove(record.mutationId);
  else await backendV2MirrorOutbox.recordFailedAttempt(record.mutationId, Date.now());
};

const scheduleNextRetry = async (uid: string) => {
  if (!BACKEND_V2_PREVIEW_SHADOW_MIRROR_RUNTIME_ENABLED || !uid || typeof window === 'undefined') return;
  const old = retryTimers.get(uid);
  if (old !== undefined) window.clearTimeout(old);
  retryTimers.delete(uid);
  const next = (await backendV2MirrorOutbox.listPending(uid, { readyAtMs: Number.MAX_SAFE_INTEGER, limit: 1 }))[0];
  if (!next || next.status !== 'pending') return;
  const delay = Math.max(250, Math.min(300_000, next.nextAttemptAtMs - Date.now()));
  retryTimers.set(uid, window.setTimeout(() => { retryTimers.delete(uid); void processPendingOutbox(uid); }, delay));
};

async function processPendingOutbox(uid: string): Promise<void> {
  if (!BACKEND_V2_PREVIEW_SHADOW_MIRROR_RUNTIME_ENABLED || !uid || activeRetryUsers.has(uid)) return;
  activeRetryUsers.add(uid);
  try {
    const ready = await backendV2MirrorOutbox.listPending(uid, { readyAtMs: Date.now(), limit: BACKEND_V2_PREVIEW_SHADOW_RETRY_BATCH });
    for (const record of ready) await finalizeAttempt(record, await attemptMirror(record));
  } finally {
    activeRetryUsers.delete(uid);
    await scheduleNextRetry(uid);
  }
}

const enqueueAndAttempt = async (input: {uid:string;source:'recent'|'musicNote';operation:V2LiveMirrorOperation;targetSongId:string;sourceUpdatedAtMs:number;sourceDocumentId?:string}, cachedPayload?: Record<string, unknown> | null) => {
  if (!isSoridrawSongId(input.targetSongId)) return;
  const envelope = createV2MirrorMutationEnvelope({ uid: input.uid, targetKind: 'soridraw', targetSongId: input.targetSongId, source: input.source, operation: input.operation, sourceUpdatedAtMs: input.sourceUpdatedAtMs, enqueuedAtMs: Date.now() });
  const queued = await backendV2MirrorOutbox.enqueue({ ...envelope, ...(input.sourceDocumentId ? { sourceDocumentId: input.sourceDocumentId } : {}) });
  if (!queued) { console.warn('[Backend V2 2-A4c] durable outbox unavailable/full; V2 write skipped.'); return; }
  const record = await backendV2MirrorOutbox.get(envelope.mutationId);
  if (!record) return;
  await finalizeAttempt(record, await attemptMirror(record, cachedPayload));
  await scheduleNextRetry(record.uid);
};

const explicitTargets = (context: Readonly<V1MutationBoundaryContext>): V1MutationMirrorTarget[] => {
  const seen = new Set<string>(); const out: V1MutationMirrorTarget[] = [];
  for (const target of context.mirrorTargets || []) {
    const id = String(target?.targetSongId || '').trim();
    if (!isSoridrawSongId(id) || seen.has(id)) continue;
    seen.add(id); out.push({ ...target, targetSongId: id });
    if (out.length >= BACKEND_V2_PREVIEW_SHADOW_MAX_TARGETS_PER_MUTATION) break;
  }
  return out;
};

const mirrorRecent = async (context: Readonly<V1MutationBoundaryContext>, targets: V1MutationMirrorTarget[]) => {
  const needsPayload = targets.some(t => t.operation !== 'recent-hide');
  const payloads = new Map<string, Record<string, unknown>>();
  if (needsPayload) {
    const snap = await getDoc(doc(db, 'user_recent_songs', context.uid));
    const songs = snap.exists() && Array.isArray(snap.data()?.songs) ? snap.data().songs : [];
    for (const song of songs) {
      const id = String(song?.soridrawSongId || '').trim();
      if (isSoridrawSongId(id)) payloads.set(id, song as Record<string, unknown>);
    }
  }
  for (const target of targets) await enqueueAndAttempt({ uid: context.uid, source:'recent', operation:target.operation, targetSongId:target.targetSongId, sourceUpdatedAtMs:target.sourceUpdatedAtMs }, target.operation === 'recent-hide' ? null : (payloads.get(target.targetSongId) ?? null));
};

const resultDocumentId = (result: unknown) => result && typeof result === 'object' ? String((result as any).id || '').trim() || null : null;
const mapMusicNoteOperation = (op: V1MutationBoundaryContext['operation'], payload: Record<string, unknown> | null): V2LiveMirrorOperation | null => {
  if (op === 'save' || op === 'restore') return 'music-note-save';
  if (op === 'unsave' || op === 'permanent-delete') return 'music-note-unsave';
  if (op === 'update' || op === 'recovery-update') return payload && activeMusicNote(payload) ? 'upsert' : 'music-note-unsave';
  return null;
};

const mirrorMusicNote = async (context: Readonly<V1MutationBoundaryContext>, result: unknown, targets: V1MutationMirrorTarget[]) => {
  if (String(context.operation).startsWith('bulk-')) return;
  if (context.operation === 'permanent-delete' && targets.length) {
    for (const target of targets) await enqueueAndAttempt({ uid:context.uid, source:'musicNote', operation:'music-note-unsave', targetSongId:target.targetSongId, sourceUpdatedAtMs:target.sourceUpdatedAtMs, sourceDocumentId:target.sourceDocumentId }, null);
    return;
  }
  const ids = [...(context.documentIds || [])];
  if (context.operation === 'save') { const id = resultDocumentId(result); if (id) ids.push(id); }
  for (const sourceDocumentId of [...new Set(ids.map(v=>String(v||'').trim()).filter(Boolean))].slice(0,10)) {
    const payload = await loadFavoritePayload(context.uid, sourceDocumentId);
    if (!payload) continue;
    const targetSongId = String(payload.soridrawSongId || '').trim();
    if (!isSoridrawSongId(targetSongId)) continue;
    const operation = mapMusicNoteOperation(context.operation, payload);
    if (!operation) continue;
    await enqueueAndAttempt({ uid:context.uid, source:'musicNote', operation, targetSongId, sourceUpdatedAtMs:Date.now(), sourceDocumentId }, payload);
  }
};

const handleV1Success = async (context: Readonly<V1MutationBoundaryContext>, result: unknown) => {
  if (!BACKEND_V2_PREVIEW_SHADOW_MIRROR_RUNTIME_ENABLED || !context.uid) return;
  const targets = explicitTargets(context);
  if (context.domain === 'recent' && targets.length) await mirrorRecent(context, targets);
  else if (context.domain === 'musicNote') await mirrorMusicNote(context, result, targets);
  await processPendingOutbox(context.uid);
};

if (BACKEND_V2_PREVIEW_SHADOW_MIRROR_RUNTIME_ENABLED) {
  registerV1MutationPostSuccessHook(handleV1Success);
  onAuthStateChanged(auth, user => { if (user?.uid) void processPendingOutbox(user.uid); });
  if (typeof window !== 'undefined') window.addEventListener('online', () => { const uid = auth.currentUser?.uid; if (uid) void processPendingOutbox(uid); });
}
'''
Path('src/data/v2PreviewShadowMirror.ts').write_text(mirror, encoding='utf-8')

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str):
    global app
    count = app.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    app = app.replace(old, new, 1)

replace_once(
    "import { runV1MutationBoundary } from './data/v1MutationBoundary';",
    "import { runV1MutationBoundary, type V1MutationMirrorTarget } from './data/v1MutationBoundary';\nimport './data/v2PreviewShadowMirror';\nimport { createSoridrawSongId, isSoridrawSongId } from './data/v2LiveMutation';",
    'imports',
)
helper_anchor = "const RAP_APP_CHECK_RECAPTCHA_SITE_KEY = import.meta.env.VITE_RAP_APP_CHECK_RECAPTCHA_SITE_KEY?.trim() || '';"
helper = r'''const getLiveSoridrawSongId = (song: any): string | null => {
  const value = String(song?.soridrawSongId || '').trim();
  return isSoridrawSongId(value) ? value : null;
};

const ensureLiveSoridrawSongId = <T extends Record<string, any>>(song: T): T => {
  if (!song || typeof song !== 'object' || getLiveSoridrawSongId(song)) return song;
  const soridrawSongId = createSoridrawSongId();
  try { (song as any).soridrawSongId = soridrawSongId; return song; }
  catch { return { ...song, soridrawSongId }; }
};

const buildRecentMirrorTargets = (songs: readonly any[], operation: 'upsert' | 'recent-hide', sourceUpdatedAtMs = Date.now()): V1MutationMirrorTarget[] => {
  const seen = new Set<string>(); const targets: V1MutationMirrorTarget[] = [];
  for (const song of songs || []) {
    const targetSongId = getLiveSoridrawSongId(song);
    if (!targetSongId || seen.has(targetSongId)) continue;
    seen.add(targetSongId); targets.push({ targetSongId, operation, sourceUpdatedAtMs });
    if (targets.length >= 10) break;
  }
  return targets;
};

'''
replace_once(helper_anchor, helper + helper_anchor, 'helper insertion')

replace_once(
    "      const createdAtMs = Date.now();\n      const resolvedGenre = getResolvedGenre(song);\n      const favoritePayload = sanitizeForFirestore({\n        uid: user.uid,",
    "      const createdAtMs = Date.now();\n      song = ensureLiveSoridrawSongId(song as any) as SongResult;\n      const favoriteSoridrawSongId = getLiveSoridrawSongId(song);\n      const resolvedGenre = getResolvedGenre(song);\n      const favoritePayload = sanitizeForFirestore({\n        uid: user.uid,\n        soridrawSongId: favoriteSoridrawSongId,",
    'favorite stable id',
)
replace_once(
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'permanent-delete', uid: user.uid, documentIds: [existingFav.id], affectedCount: 1 }, deleteDoc(doc(db, 'favorites', existingFav.id)));",
    "await runV1MutationBoundary({ domain: 'musicNote', operation: 'permanent-delete', uid: user.uid, documentIds: [existingFav.id], affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([existingFav], 'recent-hide').map((target) => ({ ...target, operation: 'music-note-unsave' as const, sourceDocumentId: existingFav.id })) }, deleteDoc(doc(db, 'favorites', existingFav.id)));",
    'favorite permanent delete mirror',
)
replace_once(
    "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: userRef.current.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));",
    "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: userRef.current.uid, affectedCount: 0, mirrorTargets: buildRecentMirrorTargets(historyRef.current, 'recent-hide') }, setDoc(ref, { songs: [] }, { merge: true }));",
    'reset clear mirror',
)
replace_once(
    "await runV1MutationBoundary({ domain: 'recent', operation: 'delete-item', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true }));",
    "await runV1MutationBoundary({ domain: 'recent', operation: 'delete-item', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([history[index]], 'recent-hide') }, setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true }));",
    'delete recent mirror',
)
replace_once(
    "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: user.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));",
    "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: user.uid, affectedCount: 0, mirrorTargets: buildRecentMirrorTargets(history, 'recent-hide') }, setDoc(ref, { songs: [] }, { merge: true }));",
    'manual clear mirror',
)
replace_once(
    "const saveRecentSongsBatch = async (newSongs: any[]) => {\n  if (!user || !Array.isArray(newSongs) || newSongs.length === 0) return;\n\n  const saveOperation = async () => {",
    "const saveRecentSongsBatch = async (newSongs: any[]) => {\n  if (!user || !Array.isArray(newSongs) || newSongs.length === 0) return;\n\n  const canonicalNewSongs = newSongs.map((song) => ensureLiveSoridrawSongId(song));\n\n  const saveOperation = async () => {",
    'batch assign ids',
)
replace_once(
    "      const updatedSongs = mergeRecentSongLists(newSongs, firestoreSongs, recoverySongs);\n\n      await runV1MutationBoundary({ domain: 'recent', operation: 'save-batch', uid: user.uid, affectedCount: newSongs.length }, setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true }));",
    "      const updatedSongs = mergeRecentSongLists(canonicalNewSongs, firestoreSongs, recoverySongs);\n      const updatedStableIds = new Set(updatedSongs.map((song: any) => getLiveSoridrawSongId(song)).filter(Boolean));\n      const mirrorAtMs = Date.now();\n      const mirrorTargets = [\n        ...buildRecentMirrorTargets(canonicalNewSongs, 'upsert', mirrorAtMs),\n        ...buildRecentMirrorTargets(firestoreSongs.filter((song: any) => { const stableId = getLiveSoridrawSongId(song); return Boolean(stableId && !updatedStableIds.has(stableId)); }), 'recent-hide', mirrorAtMs),\n      ].slice(0, 10);\n\n      await runV1MutationBoundary({ domain: 'recent', operation: 'save-batch', uid: user.uid, affectedCount: canonicalNewSongs.length, mirrorTargets }, setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true }));",
    'batch mirror targets',
)
replace_once(
    "await runV1MutationBoundary({ domain: 'recent', operation: 'regenerate', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));",
    "await runV1MutationBoundary({ domain: 'recent', operation: 'regenerate', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([nextSong], 'upsert') }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));",
    'regenerate mirror',
)
replace_once(
    "runV1MutationBoundary({ domain: 'recent', operation: 'add-lyrics-language', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true })).catch((error) => {",
    "runV1MutationBoundary({ domain: 'recent', operation: 'add-lyrics-language', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([nextSong], 'upsert') }, setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true })).catch((error) => {",
    'language mirror',
)
replace_once(
    "await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));",
    "await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([nextSong], 'upsert') }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));",
    'edit mirror',
)
replace_once(
    "runV1MutationBoundary({ domain: 'recent', operation: 'pre-favorite-edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })).catch((error) => {",
    "runV1MutationBoundary({ domain: 'recent', operation: 'pre-favorite-edit', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([nextHistory[currentIndex]], 'upsert') }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })).catch((error) => {",
    'pre-favorite mirror',
)

app_path.write_text(app, encoding='utf-8')
print('A4C_APPLY_PATCH=PASS')
