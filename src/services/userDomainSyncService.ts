import { onAuthStateChanged } from 'firebase/auth';
import { onValue, ref, runTransaction, set, type Unsubscribe } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';
import { projectCatalogItemForSync } from '../lib/userDataEngine';
import {
  addV1MutationPostSuccessHook,
  type V1MutationBoundaryContext,
} from '../data/v1MutationBoundary';

export type UserDomainSyncKind = 'musicNote' | 'recentSongs';

export type UserDomainSyncSignal = {
  version: number;
  at: number;
  originDeviceId: string;
  operation: string;
  affectedCount: number;
  documentIds: string[];
  truncated: boolean;
  itemJson?: string;
  removed?: boolean;
};

const GENERIC_DEVICE_STORAGE_KEY = 'soridraw_user_domain_sync_device_v1';
const MUSIC_NOTE_DEVICE_STORAGE_KEY = 'soridraw_music_note_device_id_v1';
const MUSIC_NOTE_REMOTE_VERSION_BASE = 'soridraw_music_note_remote_sync_version_v1';
const MUSIC_NOTE_LOCAL_VERSION_BASE = 'soridraw_music_note_local_sync_version_v1';
const MUSIC_NOTE_PENDING_SIGNAL_BASE = 'soridraw_music_note_pending_signal_v2';
const RECENT_LOCAL_VERSION_BASE = 'soridraw_recent_songs_local_sync_version_v2';
// Separate RTDB delivery timestamps from the authoritative Firestore document
// version. Persist both signal and acknowledgement across Studio navigation.
const RECENT_PENDING_SIGNAL_BASE = 'soridraw_recent_songs_pending_signal_v3';
const RECENT_ACKNOWLEDGED_SIGNAL_BASE = 'soridraw_recent_songs_acknowledged_signal_v3';
export const MUSIC_NOTE_SYNC_EVENT = 'soridraw:music-note-sync-version';
const RECENT_SONGS_SYNC_EVENT = 'soridraw:recent-songs-sync-version-v2';
const MAX_DOCUMENT_IDS = 10;
const MAX_SYNC_ITEM_JSON_CHARS = 24000;

const getStoredDeviceId = (storageKey: string, prefix: string): string => {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = String(window.localStorage.getItem(storageKey) || '').trim();
    if (existing) return existing;
    const next = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `${prefix}_mem_${Math.random().toString(36).slice(2, 10)}`;
  }
};

const getDeviceId = (kind: UserDomainSyncKind): string => kind === 'musicNote'
  ? getStoredDeviceId(MUSIC_NOTE_DEVICE_STORAGE_KEY, 'mn')
  : getStoredDeviceId(GENERIC_DEVICE_STORAGE_KEY, 'd');

const scopedVersionKey = (base: string, uid: string) => `${base}_${uid}`;

const readLocalNumber = (key: string): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(window.localStorage.getItem(key) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const writeLocalNumberMax = (key: string, value: number): void => {
  if (typeof window === 'undefined' || !Number.isFinite(value) || value <= 0) return;
  try {
    window.localStorage.setItem(key, String(Math.max(readLocalNumber(key), Math.floor(value))));
  } catch {}
};

const rememberMusicNotePendingSignal = (uid: string, signal: UserDomainSyncSignal): void => {
  if (!uid || typeof window === 'undefined' || !signal?.version) return;
  try {
    const key = scopedVersionKey(MUSIC_NOTE_PENDING_SIGNAL_BASE, uid);
    const currentRaw = window.localStorage.getItem(key);
    const current = currentRaw ? JSON.parse(currentRaw) : null;
    if (Number(current?.version || 0) > signal.version) return;
    window.localStorage.setItem(key, JSON.stringify(signal));
  } catch {}
};

export const readPendingMusicNoteSyncSignal = (uid: string): UserDomainSyncSignal | null => {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(scopedVersionKey(MUSIC_NOTE_PENDING_SIGNAL_BASE, uid));
    return raw ? normalizeSignal(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const readRecentSongsPendingSignalVersion = (uid: string): number =>
  readLocalNumber(scopedVersionKey(RECENT_PENDING_SIGNAL_BASE, uid));

export const readRecentSongsAcknowledgedSignalVersion = (uid: string): number =>
  readLocalNumber(scopedVersionKey(RECENT_ACKNOWLEDGED_SIGNAL_BASE, uid));

export const rememberRecentSongsPendingSignalVersion = (uid: string, version: number): void => {
  if (!uid) return;
  writeLocalNumberMax(scopedVersionKey(RECENT_PENDING_SIGNAL_BASE, uid), version);
};

export const acknowledgeRecentSongsSignalVersion = (uid: string, version: number): void => {
  if (!uid) return;
  writeLocalNumberMax(scopedVersionKey(RECENT_ACKNOWLEDGED_SIGNAL_BASE, uid), version);
};

const resultDocumentId = (result: unknown): string => {
  if (!result || typeof result !== 'object') return '';
  return String((result as { id?: unknown }).id || '').trim();
};

const projectRemovedMusicNoteIdentityForSync = (
  raw: unknown,
  preferredId = '',
): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, any>;
  const id = String(preferredId || source.id || source.firestoreId || '').trim();
  if (!id) return null;

  const applied = source.appliedKeywords && typeof source.appliedKeywords === 'object'
    ? source.appliedKeywords as Record<string, any>
    : {};
  const generationBatchId = String(applied.generationBatchId || '').trim();
  const generationIndex = Math.floor(Number(applied.generationIndex || 0));
  const recentLegacySourceId = String(source.recentLegacySourceId || '').trim();
  const soridrawSongId = String(source.soridrawSongId || '').trim();
  const recentSongSyncKey = String(source.recentSongSyncKey || '').trim();
  const hasGenerationIdentity = Boolean(generationBatchId && Number.isFinite(generationIndex) && generationIndex > 0);

  // app285 — removed rows still need enough song identity for the receiving
  // device to keep Recent Songs linked to the same exact Music Note document.
  // This is the same already-existing RTDB signal; no extra mutation/read.
  if (!recentLegacySourceId && !soridrawSongId && !recentSongSyncKey && !hasGenerationIdentity) return null;

  return {
    __musicNoteRemovalIdentity: true,
    id,
    firestoreId: id,
    soridrawSongId: soridrawSongId || null,
    recentSongSyncKey: recentSongSyncKey || null,
    appliedKeywords: hasGenerationIdentity ? {
      generationBatchId,
      generationIndex,
    } : null,
    recentLegacySourceId: recentLegacySourceId || null,
    recentLegacyCreatedAtMs: toSyncTimestamp(source.recentLegacyCreatedAtMs),
    favoriteRemoved: true,
    saved: false,
    favoriteRemovedAt: toSyncTimestamp(source.favoriteRemovedAt || source.unsavedAt || source.updatedAtMs),
    unsavedAt: toSyncTimestamp(source.unsavedAt || source.favoriteRemovedAt || source.updatedAtMs),
  };
};

const toSyncTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    try {
      const resolved = Number((value as { toMillis: () => number }).toMillis());
      return Number.isFinite(resolved) ? resolved : 0;
    } catch {}
  }
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};


const projectMusicNoteItemForSignal = (
  raw: unknown,
  preferredId = '',
): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, any>;
  const id = String(preferredId || source.id || source.firestoreId || '').trim();
  if (!id) return null;

  const projected = projectCatalogItemForSync('musicNote', {
    ...source,
    id,
    firestoreId: id,
  });
  if (!projected) return null;

  try {
    if (JSON.stringify(projected).length <= MAX_SYNC_ITEM_JSON_CHARS) return projected;
  } catch {}

  // app289 — Oversized active Music Note summaries used to lose itemJson entirely.
  // Reuse the same RTDB mutation but shrink only appliedKeywords to immutable song
  // identity so SAVE/RESTORE can still update the remote Studio heart.
  const applied = source.appliedKeywords && typeof source.appliedKeywords === 'object'
    ? source.appliedKeywords as Record<string, any>
    : {};
  const generationBatchId = String(applied.generationBatchId || '').trim();
  const generationIndex = Math.floor(Number(applied.generationIndex || 0));
  const hasGenerationIdentity = Boolean(
    generationBatchId && Number.isFinite(generationIndex) && generationIndex > 0
  );
  const compactProjected: Record<string, unknown> = {
    ...projected,
    __musicNoteCompactActiveSync: true,
    appliedKeywords: hasGenerationIdentity ? {
      generationBatchId,
      generationIndex,
    } : null,
  };

  try {
    if (JSON.stringify(compactProjected).length <= MAX_SYNC_ITEM_JSON_CHARS) return compactProjected;
  } catch {}

  // Extreme fallback. The canonical Firestore document is untouched; this only
  // bounds the transient changed-item signal and keeps receiver Firestore reads at 0.
  return {
    __catalogSummary: true,
    __musicNoteCompactActiveSync: true,
    id,
    firestoreId: id,
    title: String(source.title || ''),
    koreanTitle: String(source.koreanTitle || ''),
    englishTitle: String(source.englishTitle || ''),
    genre: source.genre ?? null,
    soridrawSongId: String(source.soridrawSongId || '').trim() || null,
    recentSongSyncKey: String(source.recentSongSyncKey || '').trim() || null,
    recentLegacySourceId: String(source.recentLegacySourceId || '').trim() || null,
    recentLegacyCreatedAtMs: toSyncTimestamp(source.recentLegacyCreatedAtMs),
    appliedKeywords: hasGenerationIdentity ? {
      generationBatchId,
      generationIndex,
    } : null,
    isLocked: source.isLocked === true,
    isPublic: source.isPublic === true,
    hidden: false,
    favoriteHidden: false,
    favoriteRemoved: false,
    saved: true,
    createdAtMs: toSyncTimestamp(source.createdAtMs || source.createdAt),
    updatedAtMs: toSyncTimestamp(source.updatedAtMs || source.updatedAt),
  };
};

const projectRecentSongForSync = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, any>;
  const applied = source.appliedKeywords && typeof source.appliedKeywords === 'object'
    ? source.appliedKeywords as Record<string, any>
    : {};

  // app290 — live Recent text preview must not carry the large generation payload.
  // Send only immutable identity + user-visible edited fields so PC/mobile can update
  // immediately while the canonical Firestore aggregate waits for the trailing batch.
  if (source.__recentSongEditPreview === true) {
    const preview: Record<string, unknown> = {
      __recentSongSync: true,
      __recentSongPartial: false,
      __recentSongEditPreview: true,
      id: source.id ?? null,
      taskId: source.taskId ?? null,
      sourceId: source.sourceId ?? null,
      soridrawSongId: source.soridrawSongId ?? null,
      recentSongSyncKey: source.recentSongSyncKey ?? null,
      title: source.title ?? '',
      koreanTitle: source.koreanTitle ?? '',
      englishTitle: source.englishTitle ?? '',
      displayGenre: source.displayGenre ?? null,
      genre: source.genre ?? null,
      prompt: source.prompt ?? '',
      lyrics: source.lyrics ?? null,
      favoriteFirestoreId: source.favoriteFirestoreId ?? null,
      musicNoteFavoriteId: source.musicNoteFavoriteId ?? null,
      recentFavoriteDetachedAt: source.recentFavoriteDetachedAt ?? null,
      recentFavoriteExplicitlyUnsavedAt: source.recentFavoriteExplicitlyUnsavedAt ?? null,
      recentFavoriteIdentityHealedAt: source.recentFavoriteIdentityHealedAt ?? null,
      createdAtMs: toSyncTimestamp(source.createdAtMs || source.createdAt),
      updatedAtMs: toSyncTimestamp(source.updatedAtMs || source.updatedAt) || Date.now(),
      appliedKeywords: {
        generationBatchId: applied.generationBatchId ?? null,
        generationIndex: applied.generationIndex ?? null,
        secondaryLanguage: applied.secondaryLanguage ?? null,
        titleLanguages: applied.titleLanguages ?? null,
        titlesByLanguage: applied.titlesByLanguage ?? null,
        editedInStudio: applied.editedInStudio ?? null,
        editedInStudioAt: applied.editedInStudioAt ?? null,
      },
    };
    try {
      if (JSON.stringify(preview).length <= MAX_SYNC_ITEM_JSON_CHARS) return preview;
    } catch {}
    return {
      __recentSongSync: true,
      __recentSongPartial: true,
      __recentSongEditPreview: true,
      id: source.id ?? null,
      taskId: source.taskId ?? null,
      sourceId: source.sourceId ?? null,
      soridrawSongId: source.soridrawSongId ?? null,
      recentSongSyncKey: source.recentSongSyncKey ?? null,
      title: source.title ?? '',
      koreanTitle: source.koreanTitle ?? '',
      englishTitle: source.englishTitle ?? '',
      displayGenre: source.displayGenre ?? null,
      genre: source.genre ?? null,
      favoriteFirestoreId: source.favoriteFirestoreId ?? null,
      musicNoteFavoriteId: source.musicNoteFavoriteId ?? null,
      appliedKeywords: {
        generationBatchId: applied.generationBatchId ?? null,
        generationIndex: applied.generationIndex ?? null,
      },
      updatedAtMs: toSyncTimestamp(source.updatedAtMs || source.updatedAt) || Date.now(),
    };
  }
  const full: Record<string, unknown> = {
    __recentSongSync: true,
    __recentSongPartial: false,
    id: source.id ?? null,
    taskId: source.taskId ?? null,
    sourceId: source.sourceId ?? null,
    soridrawSongId: source.soridrawSongId ?? null,
    recentSongSyncKey: source.recentSongSyncKey ?? null,
    title: source.title ?? '',
    koreanTitle: source.koreanTitle ?? '',
    englishTitle: source.englishTitle ?? '',
    displayGenre: source.displayGenre ?? null,
    genre: source.genre ?? null,
    prompt: source.prompt ?? '',
    lyrics: source.lyrics ?? null,
    appliedKeywords: source.appliedKeywords ?? null,
    userInput: source.userInput ?? null,
    situationSummary: source.situationSummary ?? null,
    favoriteFirestoreId: source.favoriteFirestoreId ?? null,
    musicNoteFavoriteId: source.musicNoteFavoriteId ?? null,
    recentFavoriteDetachedAt: source.recentFavoriteDetachedAt ?? null,
    recentFavoriteExplicitlyUnsavedAt: source.recentFavoriteExplicitlyUnsavedAt ?? null,
    recentFavoriteIdentityHealedAt: source.recentFavoriteIdentityHealedAt ?? null,
    createdAtMs: toSyncTimestamp(source.createdAtMs || source.createdAt),
    updatedAtMs: toSyncTimestamp(source.updatedAtMs || source.updatedAt),
  };
  try {
    if (JSON.stringify(full).length <= 24000) return full;
  } catch {}

  return {
    __recentSongSync: true,
    __recentSongPartial: true,
    id: source.id ?? null,
    taskId: source.taskId ?? null,
    sourceId: source.sourceId ?? null,
    soridrawSongId: source.soridrawSongId ?? null,
    recentSongSyncKey: source.recentSongSyncKey ?? null,
    title: source.title ?? '',
    koreanTitle: source.koreanTitle ?? '',
    englishTitle: source.englishTitle ?? '',
    displayGenre: source.displayGenre ?? null,
    genre: source.genre ?? null,
    favoriteFirestoreId: source.favoriteFirestoreId ?? null,
    musicNoteFavoriteId: source.musicNoteFavoriteId ?? null,
    recentFavoriteDetachedAt: source.recentFavoriteDetachedAt ?? null,
    recentFavoriteExplicitlyUnsavedAt: source.recentFavoriteExplicitlyUnsavedAt ?? null,
    recentFavoriteIdentityHealedAt: source.recentFavoriteIdentityHealedAt ?? null,
    createdAtMs: toSyncTimestamp(source.createdAtMs || source.createdAt),
    updatedAtMs: toSyncTimestamp(source.updatedAtMs || source.updatedAt),
    appliedKeywords: {
      generationBatchId: applied.generationBatchId ?? null,
      generationIndex: applied.generationIndex ?? null,
      secondaryLanguage: applied.secondaryLanguage ?? null,
      titleLanguages: applied.titleLanguages ?? null,
      titlesByLanguage: applied.titlesByLanguage ?? null,
      editedInStudio: applied.editedInStudio ?? null,
      editedInStudioAt: applied.editedInStudioAt ?? null,
    },
  };
};

const buildSignal = (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
): UserDomainSyncSignal => {
  const rawIds = [
    ...(context.documentIds || []),
    ...(context.domain === 'musicNote' && context.operation === 'save' ? [resultDocumentId(result)] : []),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(rawIds)];
  const now = Date.now();
  const kind: UserDomainSyncKind = context.domain === 'musicNote' ? 'musicNote' : 'recentSongs';
  const persistedRecentVersion = kind === 'recentSongs' && typeof result === 'number'
    && Number.isFinite(result) && result > 0 ? Math.floor(result) : 0;

  let itemJson = '';
  let removed = false;
  if (kind === 'musicNote') {
    try {
      if (context.syncStructure && typeof context.syncStructure === 'object') {
        const encoded = JSON.stringify({
          __musicNoteStructureSync: true,
          data: context.syncStructure,
        });
        // Reuse the already-approved bounded itemJson field so no RTDB rule or
        // schema expansion is needed for folder/card-state live sync.
        if (encoded.length <= MAX_SYNC_ITEM_JSON_CHARS) itemJson = encoded;
      } else {
        const rawSyncItems = Array.isArray(context.syncItems)
          ? context.syncItems.slice(0, MAX_DOCUMENT_IDS)
          : context.syncItem && typeof context.syncItem === 'object'
            ? [context.syncItem]
            : [];
        const projectedItems = rawSyncItems
          .map((rawItem, index) => {
            if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return null;
            const preferredId = uniqueIds[index] || uniqueIds[0] || resultDocumentId(result);
            return projectMusicNoteItemForSignal(rawItem, preferredId);
          })
          .filter(Boolean);
        if (projectedItems.length > 0) {
          const payload = projectedItems.length === 1 ? projectedItems[0] : projectedItems;
          const encoded = JSON.stringify(payload);
          // Keep the account-level signal tiny and bounded. Oversized detail never
          // rides RTDB; only catalog summaries are eligible.
          if (encoded.length <= MAX_SYNC_ITEM_JSON_CHARS) itemJson = encoded;
        } else if (rawSyncItems.length > 0) {
          removed = true;
          const removalItems = rawSyncItems
            .map((rawItem, index) => projectRemovedMusicNoteIdentityForSync(
              rawItem,
              uniqueIds[index] || uniqueIds[0] || '',
            ))
            .filter(Boolean);
          if (removalItems.length > 0) {
            const payload = removalItems.length === 1 ? removalItems[0] : removalItems;
            const encoded = JSON.stringify(payload);
            if (encoded.length <= MAX_SYNC_ITEM_JSON_CHARS) itemJson = encoded;
          }
        }
      }
    } catch {}
  } else if (kind === 'recentSongs') {
    try {
      const projected = projectRecentSongForSync(context.syncItem);
      if (projected) {
        const encoded = JSON.stringify(projected);
        if (encoded.length <= MAX_SYNC_ITEM_JSON_CHARS) itemJson = encoded;
      }
    } catch {}
  }

  return {
    version: persistedRecentVersion || now,
    at: now,
    originDeviceId: getDeviceId(kind),
    operation: String(context.operation || '').slice(0, 48),
    affectedCount: Math.max(0, Math.min(1_000_000, Number(context.affectedCount || uniqueIds.length || 1) || 1)),
    documentIds: uniqueIds.slice(0, MAX_DOCUMENT_IDS),
    truncated: uniqueIds.length > MAX_DOCUMENT_IDS,
    ...(itemJson ? { itemJson } : {}),
    ...(removed ? { removed: true } : {}),
  };
};

const publishSignal = async (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
): Promise<number> => {
  const uid = String(context.uid || '').trim();
  if (!uid) return 0;
  const kind: UserDomainSyncKind = context.domain === 'musicNote' ? 'musicNote' : 'recentSongs';
  if (kind === 'recentSongs' && result == null) return 0; // Mutation epoch skip is not a write.

  if (kind === 'musicNote') {
    // app276 — Music Note signals used each device's Date.now() as a global
    // ordering token. If one phone clock was ahead of a PC, the later PC signal
    // could be numerically older forever and the phone would ignore it.
    // Keep the existing one tiny RTDB mutation, but allocate a UID-wide
    // monotonic version inside that same node.
    const signalRef = ref(realtimeDb, `userSync/${uid}/musicNote`);
    const transaction = await runTransaction(signalRef, (current) => {
      const currentVersion = Math.max(0, Math.floor(Number(current?.version || 0)));
      const signal = buildSignal(context, result);
      signal.version = Math.max(Date.now(), currentVersion + 1);
      return signal;
    }, { applyLocally: true });
    return Math.max(0, Math.floor(Number(transaction.snapshot.val()?.version || 0)));
  }

  const signal = buildSignal(context, result);
  await set(ref(realtimeDb, `userSync/${uid}/${kind}`), signal);
  return Math.max(0, Math.floor(Number(signal.version || 0)));
};

// app290 — Studio heart clicks use this RTDB-only preview immediately, while
// the canonical favorites write waits for the 30-second trailing client batch.
// The returned monotonic version lets two devices resolve overlapping pending
// intents without relying on their local clocks.
export const publishMusicNoteHeartPreviewDelta = async (
  uid: string,
  documentId: string,
  syncItem: unknown,
  desiredSaved: boolean,
): Promise<number> => {
  const safeUid = String(uid || '').trim();
  const safeDocumentId = String(documentId || '').trim();
  if (!safeUid || !safeDocumentId || !syncItem || typeof syncItem !== 'object' || Array.isArray(syncItem)) return 0;
  const now = Date.now();
  const source = syncItem as Record<string, any>;
  const projected = projectMusicNoteItemForSignal(source, safeDocumentId) || {
    __catalogSummary: true,
    id: safeDocumentId,
    firestoreId: safeDocumentId,
    title: String(source.title || ''),
    koreanTitle: String(source.koreanTitle || ''),
    englishTitle: String(source.englishTitle || ''),
    soridrawSongId: String(source.soridrawSongId || '').trim() || null,
    recentSongSyncKey: String(source.recentSongSyncKey || '').trim() || null,
    recentLegacySourceId: String(source.recentLegacySourceId || '').trim() || null,
    recentLegacyCreatedAtMs: toSyncTimestamp(source.recentLegacyCreatedAtMs),
    imageUrl: source.imageUrl ?? source.image_url ?? null,
    coverUrl: source.coverUrl ?? null,
    thumbnailUrl: source.thumbnailUrl ?? null,
    sunoCoverUrl: source.sunoCoverUrl ?? null,
    sunoImageUrl: source.sunoImageUrl ?? null,
    sunoArtworkUrl: source.sunoArtworkUrl ?? null,
    sunoLinks: source.sunoLinks ?? null,
    sunoShareLinks: source.sunoShareLinks ?? null,
    mainSunoIndex: source.mainSunoIndex ?? null,
    createdAtMs: toSyncTimestamp(source.createdAtMs || source.createdAt),
    updatedAtMs: toSyncTimestamp(source.updatedAtMs || source.updatedAt),
  };
  const item = desiredSaved
    ? {
        ...projected,
        __studioHeartRemotePreview: true,
        saved: true,
        hidden: false,
        favoriteHidden: false,
        favoriteRemoved: false,
        favoriteRemovedAt: null,
        unsavedAt: null,
        unlikedAt: null,
      }
    : {
        ...projected,
        __studioHeartRemotePreview: true,
        saved: false,
        hidden: false,
        favoriteHidden: false,
        favoriteRemoved: true,
        favoriteRemovedAt: now,
        unsavedAt: now,
        unlikedAt: now,
      };
  return publishSignal({
    domain: 'musicNote',
    operation: desiredSaved ? 'heart-preview-save' : 'heart-preview-unsave',
    uid: safeUid,
    documentIds: [safeDocumentId],
    affectedCount: 1,
    syncItem: item,
  }, null);
};

// app287 — An empty-heart SAVE can be idempotent when the canonical favorite
// row is already active locally. In that case there is no Firestore write to
// trigger the mutation boundary, but the other device still needs the same
// bounded changed-item signal. Publish only the existing UID-scoped RTDB event.
export const publishRecentSongEditPreviewDelta = async (
  uid: string,
  syncItem: unknown,
): Promise<void> => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || !syncItem || typeof syncItem !== 'object' || Array.isArray(syncItem)) return;
  await publishSignal({
    domain: 'recent',
    operation: 'edit-preview',
    uid: safeUid,
    affectedCount: 1,
    syncItem: { ...(syncItem as Record<string, unknown>), __recentSongEditPreview: true },
  }, Date.now());
};

export const publishMusicNoteSaveStateDelta = async (
  uid: string,
  documentId: string,
  syncItem: unknown,
): Promise<void> => {
  const safeUid = String(uid || '').trim();
  const safeDocumentId = String(documentId || '').trim();
  if (!safeUid || !safeDocumentId || !syncItem || typeof syncItem !== 'object' || Array.isArray(syncItem)) return;
  await publishSignal({
    domain: 'musicNote',
    operation: 'save',
    uid: safeUid,
    documentIds: [safeDocumentId],
    affectedCount: 1,
    syncItem,
  }, null);
};

export const publishMusicNoteStructureDelta = async (
  uid: string,
  syncStructure: unknown,
): Promise<number> => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || !syncStructure || typeof syncStructure !== 'object') return 0;
  return publishSignal({
    domain: 'musicNote',
    operation: 'structure-update',
    uid: safeUid,
    affectedCount: 1,
    syncStructure,
  }, null);
};

// URL Save inside Detail & Edit stays on the existing local draft / page-exit
// Firestore batch. This tiny RTDB-only preview makes the changed Suno artwork
// visible on the user's other devices immediately without adding a Firestore read/write.
export const publishMusicNoteSunoMediaDelta = async (
  uid: string,
  documentId: string,
  syncItem: unknown,
): Promise<void> => {
  const safeUid = String(uid || '').trim();
  const safeDocumentId = String(documentId || '').trim();
  if (!safeUid || !safeDocumentId || !syncItem || typeof syncItem !== 'object' || Array.isArray(syncItem)) return;
  await publishSignal({
    domain: 'musicNote',
    operation: 'suno-media-preview',
    uid: safeUid,
    documentIds: [safeDocumentId],
    affectedCount: 1,
    syncItem,
  }, null);
};

export const publishMusicNoteDetailPreviewDelta = async (
  uid: string,
  documentId: string,
  syncItem: unknown,
): Promise<void> => {
  const safeUid = String(uid || '').trim();
  const safeDocumentId = String(documentId || '').trim();
  if (!safeUid || !safeDocumentId || !syncItem || typeof syncItem !== 'object' || Array.isArray(syncItem)) return;
  await publishSignal({
    domain: 'musicNote',
    operation: 'detail-preview',
    uid: safeUid,
    documentIds: [safeDocumentId],
    affectedCount: 1,
    syncItem,
  }, null);
};

const normalizeSignal = (raw: unknown): UserDomainSyncSignal | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const version = Number(value.version || 0);
  const at = Number(value.at || 0);
  const originDeviceId = String(value.originDeviceId || '').trim();
  const operation = String(value.operation || '').trim().slice(0, 48);
  if (!Number.isFinite(version) || version <= 0 || !originDeviceId || !operation) return null;
  const documentIds = Array.isArray(value.documentIds)
    ? value.documentIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, MAX_DOCUMENT_IDS)
    : [];
  const itemJsonRaw = typeof value.itemJson === 'string' ? value.itemJson : '';
  const itemJson = itemJsonRaw.length <= 24000 ? itemJsonRaw : '';
  const removed = value.removed === true;
  return {
    version,
    at: Number.isFinite(at) && at > 0 ? at : version,
    originDeviceId,
    operation,
    affectedCount: Math.max(0, Math.min(1_000_000, Number(value.affectedCount || 0) || 0)),
    documentIds,
    truncated: value.truncated === true,
    ...(itemJson ? { itemJson } : {}),
    ...(removed ? { removed: true } : {}),
  };
};

const dispatchSignal = (uid: string, kind: UserDomainSyncKind, signal: UserDomainSyncSignal): void => {
  if (typeof window === 'undefined') return;

  if (kind === 'musicNote') {
    writeLocalNumberMax(scopedVersionKey(MUSIC_NOTE_REMOTE_VERSION_BASE, uid), signal.version);
    rememberMusicNotePendingSignal(uid, signal);
    if (
      signal.originDeviceId === getDeviceId('musicNote')
      && signal.operation !== 'heart-preview-save'
      && signal.operation !== 'heart-preview-unsave'
    ) {
      // A canonical local mutation already patched Music Note cache/state.
      // Heart preview is intentionally non-canonical and must not advance the
      // Firestore/catalog document version before the trailing batch commits.
      writeLocalNumberMax(scopedVersionKey(MUSIC_NOTE_LOCAL_VERSION_BASE, uid), signal.version);
    }
    window.dispatchEvent(new CustomEvent(MUSIC_NOTE_SYNC_EVENT, {
      detail: {
        uid,
        version: signal.version,
        originDeviceId: signal.originDeviceId,
        operation: signal.operation,
        documentIds: signal.documentIds,
        truncated: signal.truncated,
        itemJson: signal.itemJson || '',
        removed: signal.removed === true,
      },
    }));
    return;
  }

  if (signal.originDeviceId === getDeviceId('recentSongs')) {
    // Recent-song writes save the aggregate document before this mirror fires.
    // Advance the local gate so the existing event consumer does not reread that
    // same document on the device that just wrote it.
    writeLocalNumberMax(scopedVersionKey(RECENT_LOCAL_VERSION_BASE, uid), signal.version);
    acknowledgeRecentSongsSignalVersion(uid, signal.version);
  } else {
    rememberRecentSongsPendingSignalVersion(uid, signal.version);
  }
  window.dispatchEvent(new CustomEvent(RECENT_SONGS_SYNC_EVENT, {
    detail: {
      uid,
      version: signal.version,
      originDeviceId: signal.originDeviceId,
      operation: signal.operation,
      itemJson: signal.itemJson || '',
    },
  }));
};

let activeUid = '';
let unsubscribeMusicNote: Unsubscribe | null = null;
let unsubscribeRecentSongs: Unsubscribe | null = null;

const stopDomainSubscriptions = () => {
  unsubscribeMusicNote?.();
  unsubscribeRecentSongs?.();
  unsubscribeMusicNote = null;
  unsubscribeRecentSongs = null;
  activeUid = '';
};

const startDomainSubscriptions = (uid: string) => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || activeUid === safeUid) return;
  stopDomainSubscriptions();
  activeUid = safeUid;

  unsubscribeMusicNote = onValue(ref(realtimeDb, `userSync/${safeUid}/musicNote`), (snapshot) => {
    const signal = normalizeSignal(snapshot.val());
    if (signal) dispatchSignal(safeUid, 'musicNote', signal);
  }, (error) => {
    console.warn('Music Note RTDB sync signal unavailable; Firestore fallback remains active.', error);
  });

  unsubscribeRecentSongs = onValue(ref(realtimeDb, `userSync/${safeUid}/recentSongs`), (snapshot) => {
    const signal = normalizeSignal(snapshot.val());
    if (signal) dispatchSignal(safeUid, 'recentSongs', signal);
  }, (error) => {
    console.warn('Recent-song RTDB sync signal unavailable; Firestore fallback remains active.', error);
  });

  // App 119: Explore likes no longer subscribe to historical RTDB replay state.
};

// SORIDRAW_USER_DOMAIN_SYNC_STAGE2A_20260905
// Mutation-only publisher: app entry, reload, cache hydration and ordinary reads never call set().
// The payload is fixed-size and contains at most 10 document IDs.
addV1MutationPostSuccessHook(async (context, result) => {
  await publishSignal(context, result);
});

// SORIDRAW_USER_DOMAIN_SYNC_STAGE2B_20260905
// Read-only UID-scoped RTDB subscribers feed the existing version-event consumers.
// Stage2 keeps the Firestore users/{uid} listener as fallback, so this cannot remove
// role/security or cross-device behavior before deployment/runtime validation.
onAuthStateChanged(auth, (user) => {
  if (user?.uid) startDomainSubscriptions(user.uid);
  else stopDomainSubscriptions();
});
