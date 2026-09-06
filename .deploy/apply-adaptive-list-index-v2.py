from pathlib import Path
import re

MARKER = 'SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


adaptive_path = Path('src/lib/adaptiveListIndexV2.ts')
adaptive_path.write_text(r'''import { doc, getDocFromServer, readAdaptiveListIndexDirtyRevision, clearAdaptiveListIndexDirtyRevision } from './firestoreMeasured';
import { db, functions, httpsCallable } from '../firebase';

export type AdaptiveListIndexKind = 'musicNote' | 'library';

export type AdaptiveListIndexSnapshot = {
  schemaVersion: number;
  kind: AdaptiveListIndexKind;
  items: any[];
  itemCount: number;
  cursorCreatedAtMs: number;
  hasMore: boolean;
  deletedIds: string[];
  updatedAtMs: number;
};

type AdaptivePublishOptions = {
  hasMore?: boolean;
  deletedIds?: string[];
};

const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;
const ADAPTIVE_LIST_INDEX_SCHEMA_VERSION = 2;
const ADAPTIVE_LIST_INDEX_TARGET_BYTES = 700_000;
const ADAPTIVE_LIST_INDEX_MAX_ITEMS = 400;
const ADAPTIVE_LIST_INDEX_MAX_DELETED_IDS = 450;
const ADAPTIVE_LIST_INDEX_PREVIEW_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
]);
const publishTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastPublishedHashes = new Map<string, string>();

const docIdForKind = (kind: AdaptiveListIndexKind) => (
  kind === 'musicNote' ? 'music_note_adaptive_v2' : 'library_adaptive_v2'
);

export const isPreviewAdaptiveListIndexEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return ADAPTIVE_LIST_INDEX_PREVIEW_HOSTS.has(window.location.hostname.toLowerCase());
};

const getCreatedAtMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? Math.floor(ms) : 0;
  }
  if (typeof value?.seconds === 'number') {
    const ms = value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
    return Number.isFinite(ms) ? Math.floor(ms) : 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getItemCreatedAtMs = (item: any): number => (
  Number(item?.createdAtMs || 0)
  || getCreatedAtMs(item?.createdAt)
  || Number(item?.updatedAtMs || 0)
  || getCreatedAtMs(item?.updatedAt)
  || 0
);

const OMIT_KEYS = new Set([
  'lyricRevisions', 'lyricsHistory', 'lyricHistory', 'revisionHistory', 'editHistory',
  'apiResponse', 'apiStatusResponse', 'rawApiResponse', 'callbackPayload', 'debugPayload',
  'creditCheckedAfterComplete', 'creditCheckedAt', 'remainingCreditsAfterComplete',
  'reportedAudioUrls', 'audioValidationStatus',
  'googleGeminiApiKey', 'geminiApiKey', 'apiKey', 'accessToken', 'idToken',
  'refreshToken', 'authorization', 'password', 'secret',
]);

const cleanValue = (value: any, depth = 0): any => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) {
    return value.map((entry) => cleanValue(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object' || depth > 12) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (OMIT_KEYS.has(key)) return;
    const cleaned = cleanValue(entry, depth + 1);
    if (cleaned !== undefined) next[key] = cleaned;
  });
  return next;
};

const isMusicNoteActive = (item: any): boolean => !(
  item?.favoriteRemoved === true
  || item?.saved === false
  || item?.hidden === true
  || item?.favoriteHidden === true
  || item?.deletedAt
  || item?.trashedAt
);

const normalizeDeletedIds = (value?: string[]): string[] => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean),
)).slice(-ADAPTIVE_LIST_INDEX_MAX_DELETED_IDS);

const byteSize = (value: unknown): number => {
  try {
    const text = JSON.stringify(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return text.length * 2;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const buildAdaptivePayload = (
  kind: AdaptiveListIndexKind,
  sourceItems: any[],
  options: AdaptivePublishOptions,
) => {
  const candidates = [...(Array.isArray(sourceItems) ? sourceItems : [])]
    .filter(Boolean)
    .filter((item) => kind !== 'musicNote' || isMusicNoteActive(item))
    .sort((left, right) => {
      const timeDiff = getItemCreatedAtMs(right) - getItemCreatedAtMs(left);
      if (timeDiff !== 0) return timeDiff;
      return String(left?.id || '').localeCompare(String(right?.id || ''));
    });

  const items: any[] = [];
  const seenIds = new Set<string>();
  for (const sourceItem of candidates) {
    if (items.length >= ADAPTIVE_LIST_INDEX_MAX_ITEMS) break;
    const id = String(sourceItem?.id || '').trim();
    const createdAtMs = getItemCreatedAtMs(sourceItem);
    if (!id || seenIds.has(id) || createdAtMs <= 0) continue;
    const cleaned = cleanValue(sourceItem);
    if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) continue;
    const candidate = { ...cleaned, id, createdAtMs };
    const nextItems = [...items, candidate];
    const probe = {
      schemaVersion: ADAPTIVE_LIST_INDEX_SCHEMA_VERSION,
      kind,
      items: nextItems,
      itemCount: nextItems.length,
      cursorCreatedAtMs: createdAtMs,
      hasMore: true,
      deletedIds: normalizeDeletedIds(options.deletedIds),
    };
    if (byteSize(probe) > ADAPTIVE_LIST_INDEX_TARGET_BYTES) break;
    items.push(candidate);
    seenIds.add(id);
  }

  const cursorCreatedAtMs = items.length > 0 ? getItemCreatedAtMs(items[items.length - 1]) : 0;
  const hasMore = Boolean(options.hasMore || candidates.length > items.length);
  return {
    schemaVersion: ADAPTIVE_LIST_INDEX_SCHEMA_VERSION,
    kind,
    items,
    itemCount: items.length,
    cursorCreatedAtMs,
    hasMore,
    deletedIds: normalizeDeletedIds(options.deletedIds),
  };
};

const isCompatibleAdaptiveBundle = (kind: AdaptiveListIndexKind, value: unknown): value is AdaptiveListIndexSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, any>;
  if (data.schemaVersion !== ADAPTIVE_LIST_INDEX_SCHEMA_VERSION || data.kind !== kind) return false;
  if (!Array.isArray(data.items) || data.items.length > ADAPTIVE_LIST_INDEX_MAX_ITEMS) return false;
  if (!Number.isInteger(data.itemCount) || data.itemCount !== data.items.length) return false;
  if (!Number.isInteger(data.cursorCreatedAtMs) || data.cursorCreatedAtMs < 0) return false;
  if (typeof data.hasMore !== 'boolean') return false;
  if (!Array.isArray(data.deletedIds) || data.deletedIds.length > ADAPTIVE_LIST_INDEX_MAX_DELETED_IDS) return false;
  if (!Number.isInteger(data.updatedAtMs) || data.updatedAtMs <= 0) return false;
  const ids = new Set<string>();
  let previousTime = Number.MAX_SAFE_INTEGER;
  for (const item of data.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = String(item.id || '').trim();
    const time = getItemCreatedAtMs(item);
    if (!id || ids.has(id) || time <= 0 || time > previousTime) return false;
    ids.add(id);
    previousTime = time;
  }
  if (data.items.length === 0) return data.cursorCreatedAtMs === 0;
  return data.cursorCreatedAtMs === getItemCreatedAtMs(data.items[data.items.length - 1]);
};

export const readPreviewAdaptiveListIndexV2 = async (
  kind: AdaptiveListIndexKind,
  uid: string,
): Promise<AdaptiveListIndexSnapshot | null> => {
  if (!uid || !isPreviewAdaptiveListIndexEnabled()) return null;
  try {
    const snapshot = await getDocFromServer(
      doc(db, 'user_list_caches', uid, 'bundles', docIdForKind(kind)),
    );
    if (!snapshot.exists()) return null;
    const data = snapshot.data() || {};
    if (!isCompatibleAdaptiveBundle(kind, data)) return null;
    return {
      schemaVersion: Number(data.schemaVersion),
      kind,
      items: data.items,
      itemCount: Number(data.itemCount),
      cursorCreatedAtMs: Number(data.cursorCreatedAtMs),
      hasMore: data.hasMore === true,
      deletedIds: normalizeDeletedIds(data.deletedIds),
      updatedAtMs: Number(data.updatedAtMs),
    };
  } catch (error) {
    console.warn('[adaptiveListIndexV2] preview index unavailable; using legacy bounded path.', error);
    return null;
  }
};

export const schedulePreviewAdaptiveListIndexPublishIfDirty = (
  kind: AdaptiveListIndexKind,
  uid: string,
  sourceItems: any[],
  options: AdaptivePublishOptions = {},
): void => {
  if (!uid || !Array.isArray(sourceItems) || !isPreviewAdaptiveListIndexEnabled()) return;
  const dirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
  if (dirtyRevision <= 0) return;

  const payload = buildAdaptivePayload(kind, sourceItems, options);
  if (payload.items.length === 0 && sourceItems.length > 0) return;
  const payloadHash = JSON.stringify(payload);
  const key = `${kind}:${uid}`;
  if (lastPublishedHashes.get(key) === payloadHash) {
    clearAdaptiveListIndexDirtyRevision(kind, dirtyRevision);
    return;
  }

  const existing = publishTimers.get(key);
  if (existing) clearTimeout(existing);
  publishTimers.set(key, setTimeout(() => {
    publishTimers.delete(key);
    const currentDirtyRevision = readAdaptiveListIndexDirtyRevision(kind);
    if (currentDirtyRevision <= 0) return;
    const callable = httpsCallable(functions, 'publishPreviewAdaptiveListIndexV2');
    void callable({ ...payload, dirtyRevision: currentDirtyRevision })
      .then(() => {
        lastPublishedHashes.set(key, payloadHash);
        clearAdaptiveListIndexDirtyRevision(kind, currentDirtyRevision);
      })
      .catch((error) => {
        console.warn('[adaptiveListIndexV2] preview index publish failed; canonical data remains authoritative.', error);
      });
  }, 1800));
};
''', encoding='utf-8')


backend_path = Path('functions/src/previewAdaptiveListIndex.ts')
backend_path.write_text(r'''import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;
const SCHEMA_VERSION = 2;
const MAX_ITEMS = 400;
const MAX_DELETED_IDS = 450;
const MAX_BYTES = 800_000;
const ALLOWED_PREVIEW_HOSTS = new Set([
  "preview.soridraw.com",
  "soridraw-preview.web.app",
  "soridraw-preview.firebaseapp.com",
]);

type AdaptiveKind = "musicNote" | "library";

const getOriginHost = (originValue: unknown): string => {
  const origin = String(originValue || "").trim();
  if (!origin) return "";
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const getDocId = (kind: AdaptiveKind): string => (
  kind === "musicNote" ? "music_note_adaptive_v2" : "library_adaptive_v2"
);

const byteSize = (value: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const OMIT_KEYS = new Set([
  "lyricRevisions", "lyricsHistory", "lyricHistory", "revisionHistory", "editHistory",
  "apiResponse", "apiStatusResponse", "rawApiResponse", "callbackPayload", "debugPayload",
  "googleGeminiApiKey", "geminiApiKey", "apiKey", "accessToken", "idToken",
  "refreshToken", "authorization", "password", "secret",
]);

const sanitize = (value: unknown, depth = 0): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== "object" || depth > 12) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (OMIT_KEYS.has(key)) continue;
    const safe = sanitize(entry, depth + 1);
    if (safe !== undefined) out[key] = safe;
  }
  return out;
};

const normalizeDeletedIds = (value: unknown): string[] => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean),
)).slice(-MAX_DELETED_IDS);

export const publishPreviewAdaptiveListIndexV2 = onCall(
  { region: "us-central1", enforceAppCheck: true, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required.");
    const originHost = getOriginHost(request.rawRequest?.headers?.origin);
    if (!ALLOWED_PREVIEW_HOSTS.has(originHost)) {
      throw new HttpsError("permission-denied", "Preview origin required.");
    }

    const raw = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const kind = raw.kind === "musicNote" || raw.kind === "library" ? raw.kind : null;
    if (!kind) throw new HttpsError("invalid-argument", "Invalid list kind.");
    if (raw.schemaVersion !== SCHEMA_VERSION) throw new HttpsError("invalid-argument", "Invalid schema version.");
    if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) {
      throw new HttpsError("invalid-argument", "Invalid list items.");
    }

    const sanitizedItems = raw.items.map((item) => sanitize(item)).filter((item) => Boolean(item));
    if (sanitizedItems.length !== raw.items.length) throw new HttpsError("invalid-argument", "Invalid list item payload.");
    const itemCount = Number(raw.itemCount);
    const cursorCreatedAtMs = Number(raw.cursorCreatedAtMs);
    if (!Number.isInteger(itemCount) || itemCount !== sanitizedItems.length) {
      throw new HttpsError("invalid-argument", "Invalid item count.");
    }
    if (!Number.isInteger(cursorCreatedAtMs) || cursorCreatedAtMs < 0) {
      throw new HttpsError("invalid-argument", "Invalid cursor.");
    }
    if (typeof raw.hasMore !== "boolean") throw new HttpsError("invalid-argument", "Invalid continuation flag.");

    const seenIds = new Set<string>();
    let previousCreatedAtMs = Number.MAX_SAFE_INTEGER;
    for (const item of sanitizedItems as Record<string, any>[]) {
      const id = String(item?.id || "").trim();
      const createdAtMs = Number(item?.createdAtMs || 0);
      if (!id || seenIds.has(id) || !Number.isInteger(createdAtMs) || createdAtMs <= 0 || createdAtMs > previousCreatedAtMs) {
        throw new HttpsError("invalid-argument", "Invalid ordered list item.");
      }
      seenIds.add(id);
      previousCreatedAtMs = createdAtMs;
    }
    if (sanitizedItems.length === 0 && cursorCreatedAtMs !== 0) {
      throw new HttpsError("invalid-argument", "Empty list cursor must be zero.");
    }
    if (sanitizedItems.length > 0 && cursorCreatedAtMs !== Number((sanitizedItems[sanitizedItems.length - 1] as any).createdAtMs || 0)) {
      throw new HttpsError("invalid-argument", "Cursor does not match final item.");
    }

    const deletedIds = normalizeDeletedIds(raw.deletedIds);
    const updatedAtMs = Date.now();
    const stablePayload = {
      schemaVersion: SCHEMA_VERSION,
      kind,
      items: sanitizedItems,
      itemCount,
      cursorCreatedAtMs,
      hasMore: raw.hasMore,
      deletedIds,
      updatedAtMs,
    };
    if (byteSize(stablePayload) > MAX_BYTES) {
      throw new HttpsError("invalid-argument", "Adaptive list index exceeds safe size budget.");
    }

    const ref = admin.firestore()
      .collection("user_list_caches")
      .doc(request.auth.uid)
      .collection("bundles")
      .doc(getDocId(kind));
    await ref.set({
      ...stablePayload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });

    return { ok: true, kind, itemCount, updatedAtMs };
  },
);
''', encoding='utf-8')


# Dirty revisions are memory-only and marked strictly after successful canonical writes.
firestore_path = Path('src/lib/firestoreMeasured.ts')
firestore = firestore_path.read_text(encoding='utf-8')
if MARKER not in firestore:
    marker_anchor = "const SORIDRAW_925_CACHE_LIVE_LARGE_SOURCE_TRACE = true;\n"
    marker_block = marker_anchor + r'''
const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;
export type AdaptiveListIndexDirtyKind = 'musicNote' | 'library';
const adaptiveListIndexDirtyRevisions: Record<AdaptiveListIndexDirtyKind, number> = { musicNote: 0, library: 0 };
const isAdaptiveListPreviewHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'preview.soridraw.com'
    || hostname === 'soridraw-preview.web.app'
    || hostname === 'soridraw-preview.firebaseapp.com';
};
const markAdaptiveListIndexDirtyBySource = (source: string): void => {
  if (!isAdaptiveListPreviewHost()) return;
  if (source === 'favorites' || source.startsWith('favorites:')) {
    adaptiveListIndexDirtyRevisions.musicNote += 1;
  } else if (source === 'suno_tracks/*/tracks' || source.startsWith('suno_tracks/*/tracks:')) {
    adaptiveListIndexDirtyRevisions.library += 1;
  }
};
export const readAdaptiveListIndexDirtyRevision = (kind: AdaptiveListIndexDirtyKind): number => (
  adaptiveListIndexDirtyRevisions[kind] || 0
);
export const clearAdaptiveListIndexDirtyRevision = (kind: AdaptiveListIndexDirtyKind, revision: number): void => {
  if (revision > 0 && adaptiveListIndexDirtyRevisions[kind] === revision) {
    adaptiveListIndexDirtyRevisions[kind] = 0;
  }
};
'''
    firestore = replace_once(firestore, marker_anchor, marker_block, 'firestore dirty marker helpers')
    for fn in ('setDoc', 'updateDoc', 'deleteDoc', 'addDoc'):
        before = f"  const result = await (Firestore.{fn} as any)(...args);\n  markFirestoreActualWrite(1, `${{source}}:write`);"
        after = f"  const result = await (Firestore.{fn} as any)(...args);\n  markAdaptiveListIndexDirtyBySource(source);\n  markFirestoreActualWrite(1, `${{source}}:write`);"
        firestore = replace_once(firestore, before, after, f'{fn} dirty mark')
    before_batch = "    const result = await batch.commit();\n    Object.entries(sourceWrites).forEach(([source, count]) => markFirestoreActualWrite(count, source));"
    after_batch = "    const result = await batch.commit();\n    Object.entries(sourceWrites).forEach(([source, count]) => {\n      markAdaptiveListIndexDirtyBySource(source);\n      markFirestoreActualWrite(count, source);\n    });"
    firestore = replace_once(firestore, before_batch, after_batch, 'batch dirty mark')
    before_tx = "  Object.entries(committedWrites).forEach(([source, count]) => markFirestoreActualWrite(count, source));"
    after_tx = "  Object.entries(committedWrites).forEach(([source, count]) => {\n    markAdaptiveListIndexDirtyBySource(source);\n    markFirestoreActualWrite(count, source);\n  });"
    firestore = replace_once(firestore, before_tx, after_tx, 'transaction dirty mark')
    firestore_path.write_text(firestore, encoding='utf-8')


# Prefer the adaptive preview materialized view, then fall back to the untouched legacy bounded path.
bundle_path = Path('src/lib/listBundleCache.ts')
bundle = bundle_path.read_text(encoding='utf-8')
if MARKER not in bundle:
    import_anchor = "import { markCacheDiagnosticWrite } from './cacheDiagnostics';\n"
    bundle = replace_once(
        bundle,
        import_anchor,
        import_anchor + "import { readPreviewAdaptiveListIndexV2 } from './adaptiveListIndexV2';\n\nconst SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;\n",
        'bundle adaptive import',
    )
    run_pattern = re.compile(r"  const runOneShotRead = \(\) => \{.*?\n  \};\n\n  const handleMusicNotePageEntry", re.S)
    match = run_pattern.search(bundle)
    if not match:
        raise SystemExit('bundle runOneShotRead block missing')
    run_replacement = r'''  const runLegacyOneShotRead = () => {
    void getDocFromServer(getBundleRef(kind, uid))
      .then((snapshot) => {
        if (cancelled) return;
        const meta = { fromCache: false };
        if (!snapshot.exists()) {
          callbacks.onMissing?.(meta);
          return;
        }

        const data = snapshot.data() || {};
        if (kind === 'library' && !isCompatibleLibraryListBundle(data)) {
          callbacks.onError?.(new Error('Library list bundle is incompatible or corrupted.'));
          return;
        }
        const items = Array.isArray(data.items) ? data.items : [];
        const legacyBundle: ListBundleSnapshot = {
          schemaVersion: Number(data.schemaVersion || 0),
          kind,
          items,
          itemCount: Number(data.itemCount || items.length || 0),
          cursorCreatedAtMs: Number(data.cursorCreatedAtMs || 0),
          hasMore: data.hasMore === true,
          deletedIds: normalizeDeletedIds(data.deletedIds),
          updatedAtMs: Number(data.updatedAtMs || 0),
        };
        rememberListBundleSnapshot(kind, uid, legacyBundle, kind === 'musicNote' ? 20 : 10);
        callbacks.onData(legacyBundle, meta);
      })
      .catch((error) => {
        if (!cancelled) callbacks.onError?.(error);
      });
  };

  const runOneShotRead = () => {
    if (cancelled || started) return;
    started = true;
    void readPreviewAdaptiveListIndexV2(kind, uid)
      .then((adaptiveBundle) => {
        if (cancelled) return;
        if (adaptiveBundle) {
          callbacks.onData(adaptiveBundle, { fromCache: false });
          return;
        }
        runLegacyOneShotRead();
      })
      .catch(() => runLegacyOneShotRead());
  };

  const handleMusicNotePageEntry'''
    bundle = bundle[:match.start()] + run_replacement + bundle[match.end():]

    read_pattern = re.compile(r"export const readListBundleFromServerOnce = async \(.*?\n\};\n\nconst SORIDRAW_921_FIRESTORE_COST_HARDENING", re.S)
    read_match = read_pattern.search(bundle)
    if not read_match:
        raise SystemExit('readListBundleFromServerOnce block missing')
    read_replacement = r'''export const readListBundleFromServerOnce = async (
  kind: ListBundleKind,
  uid: string,
): Promise<ListBundleSnapshot | null> => {
  if (!uid) return null;
  const adaptiveBundle = await readPreviewAdaptiveListIndexV2(kind, uid);
  if (adaptiveBundle) return adaptiveBundle;
  const snapshot = await getDocFromServer(getBundleRef(kind, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const legacyBundle: ListBundleSnapshot = {
    schemaVersion: Number(data.schemaVersion || 0),
    kind,
    items,
    itemCount: Number(data.itemCount || items.length || 0),
    cursorCreatedAtMs: Number(data.cursorCreatedAtMs || 0),
    hasMore: data.hasMore === true,
    deletedIds: normalizeDeletedIds(data.deletedIds),
    updatedAtMs: Number(data.updatedAtMs || 0),
  };
  rememberListBundleSnapshot(kind, uid, legacyBundle, kind === 'musicNote' ? 20 : 10);
  return legacyBundle;
};

const SORIDRAW_921_FIRESTORE_COST_HARDENING'''
    bundle = bundle[:read_match.start()] + read_replacement + bundle[read_match.end():]
    bundle_path.write_text(bundle, encoding='utf-8')


# Publish only after a successful real favorites mutation dirties the preview session.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    import_anchor = "import { scheduleListBundleWrite, subscribeListBundle, readListBundleFromServerOnce } from './lib/listBundleCache';\n"
    app = replace_once(
        app,
        import_anchor,
        import_anchor + "import { schedulePreviewAdaptiveListIndexPublishIfDirty } from './lib/adaptiveListIndexV2';\nconst SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;\n",
        'App adaptive import',
    )
    cache_anchor = "    favoritesInMemoryCache.set(uid, safeList);\n"
    cache_after = cache_anchor + r'''    schedulePreviewAdaptiveListIndexPublishIfDirty('musicNote', uid, safeList, {
      hasMore: safeList.length >= 20,
      deletedIds: Array.from(getFavoriteDeletedTombstoneIds(uid)),
    });
'''
    app = replace_once(app, cache_anchor, cache_after, 'App adaptive publish hook')
    app_path.write_text(app, encoding='utf-8')


# Library already pages locally first; publishing the larger materialized view makes those More clicks read-free.
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    import_anchor = "import { subscribeListBundle, readLibraryBundleLocalSyncVersion, writeLibraryBundleLocalSyncVersion } from '../lib/listBundleCache';\n"
    library = replace_once(
        library,
        import_anchor,
        import_anchor + "import { schedulePreviewAdaptiveListIndexPublishIfDirty } from '../lib/adaptiveListIndexV2';\n\nconst SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;\n",
        'Library adaptive import',
    )
    cache_anchor = "  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {\n    saveLibraryWorkspaceTrackCache(uid, list);\n  };"
    cache_after = "  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {\n    saveLibraryWorkspaceTrackCache(uid, list);\n    schedulePreviewAdaptiveListIndexPublishIfDirty('library', uid, list, {\n      hasMore: list.length >= WORKSPACE_SERVER_PAGE_SIZE,\n    });\n  };"
    library = replace_once(library, cache_anchor, cache_after, 'Library adaptive publish hook')
    library_path.write_text(library, encoding='utf-8')


# Additive callable only. Existing Functions remain unchanged and production clients cannot invoke it.
index_path = Path('functions/src/index.ts')
index_source = index_path.read_text(encoding='utf-8')
export_line = 'export { publishPreviewAdaptiveListIndexV2 } from "./previewAdaptiveListIndex";\n'
if export_line not in index_source:
    index_source = index_source.rstrip() + '\n\n' + export_line
    index_path.write_text(index_source, encoding='utf-8')

print('Applied adaptive preview list index: one materialized document read, local More reuse, mutation-only publish.')
