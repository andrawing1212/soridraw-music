from pathlib import Path

path = Path('src/lib/adaptiveListIndexV2.ts')
source = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, got {count}')
    source = source.replace(old, new, 1)


replace_once(
    "import {\n  readCatalogSnapshotCacheFirst,\n  scheduleCatalogSnapshotPublishIfDirty,\n  type SoridrawCatalogKind,\n} from './userDataEngine';",
    "import {\n  readCatalogSnapshotCacheFirst,\n  scheduleCatalogSnapshotPublishIfDirty,\n  writeCatalogSnapshotToLocalCache,\n  type SoridrawCatalogKind,\n  type SoridrawCatalogSnapshot,\n} from './userDataEngine';\nimport { db } from '../firebase';\nimport { collection, getDocs, query, where } from './firestoreMeasured';",
    'imports',
)

anchor = "// Compatibility bridge for existing Music Note / Library bootstrap callers.\n"
helpers = r'''// 1037: safety recovery for a cold Music Note device when the private V3 catalog
// cannot be obtained. This is deliberately NOT normal pagination: it performs one
// complete canonical read, stores that complete snapshot in the existing V3
// IndexedDB catalog cache, and returns all rows to the UI. Once cached, page entry
// and UI More are local-only again. Library behavior is unchanged.
const SORIDRAW_1037_MUSIC_NOTE_CATALOG_RECOVERY = true;

const RECOVERY_MUSIC_NOTE_SUMMARY_KEYS = new Set([
  'uid', 'soridrawSongId', 'favoriteKey',
  'title', 'koreanTitle', 'englishTitle', 'genre', 'appliedKeywords', 'searchTokens',
  'isLocked', 'liked', 'isLiked', 'personalLiked', 'favoriteLiked', 'isFavorite',
  'isPublic', 'exploreTrackId', 'explorePublicationId',
  'hidden', 'favoriteHidden', 'favoriteRemoved', 'favoriteRemovedAt', 'saved', 'deletedAt', 'trashedAt',
  'color', 'favoriteColor', 'noteColor', 'folderId', 'folderIds', 'musicNoteFolderIds',
  'createdAtMs', 'createdAt', 'updatedAtMs', 'updatedAt',
  'sunoLinks', 'sunoShareLinks', 'mainSunoIndex',
  'sunoShareUrl', 'sunoUrl', 'sunoSongUrl', 'sunoTitle',
  'sunoCoverUrl', 'sunoImageUrl', 'sunoArtworkUrl',
  'sunoDurationSeconds', 'sunoDurationText', 'sunoShareUrlUpdatedAt', 'sunoCoverFetchedAt',
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'sunoAudioUrl',
  'creatorNickname', 'ownerNickname', 'ownerUid', 'nickname',
]);

const isRecoveryMusicNoteVisible = (item: any): boolean => !(
  item?.favoriteRemoved === true
  || item?.saved === false
  || item?.hidden === true
  || item?.favoriteHidden === true
  || item?.deletedAt
  || item?.trashedAt
);

const cleanRecoveryValue = (value: any, depth = 0): any => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') {
    const result = Number(value.toMillis());
    return Number.isFinite(result) ? result : undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanRecoveryValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object' || depth > 10) return undefined;
  const next: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const cleaned = cleanRecoveryValue(entry, depth + 1);
    if (cleaned !== undefined) next[key] = cleaned;
  });
  return next;
};

const projectRecoveryMusicNoteItem = (sourceItem: any, firestoreId: string): any | null => {
  if (!sourceItem || typeof sourceItem !== 'object' || !firestoreId || !isRecoveryMusicNoteVisible(sourceItem)) return null;
  const projected: Record<string, any> = {
    id: firestoreId,
    firestoreId,
    createdAtMs: getItemCreatedAtMs(sourceItem) || 1,
    __catalogSummary: true,
  };
  RECOVERY_MUSIC_NOTE_SUMMARY_KEYS.forEach((key) => {
    if (!(key in sourceItem)) return;
    const cleaned = cleanRecoveryValue(sourceItem[key]);
    if (cleaned !== undefined) projected[key] = cleaned;
  });
  projected.id = firestoreId;
  projected.firestoreId = firestoreId;
  projected.createdAtMs = getItemCreatedAtMs(projected) || 1;
  return projected;
};

const readVisibleLegacyMusicNoteCacheCount = (uid: string): number => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`soridraw_favorites_cache_${uid}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((item) => item && isRecoveryMusicNoteVisible(item)).length;
  } catch {
    return 0;
  }
};

const recoverMusicNoteCatalogFromCanonicalFirestore = async (
  uid: string,
): Promise<AdaptiveListIndexSnapshot | null> => {
  if (!uid || !SORIDRAW_1037_MUSIC_NOTE_CATALOG_RECOVERY) return null;
  try {
    const snapshot = await getDocs(query(
      collection(db, 'favorites'),
      where('uid', '==', uid),
    ));
    const recovered = snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data() || {};
        return projectRecoveryMusicNoteItem(data, String(docSnapshot.id || '').trim());
      })
      .filter((item): item is Record<string, any> => Boolean(item));

    recovered.sort((left, right) => {
      const timeDiff = Number(right.createdAtMs || 1) - Number(left.createdAtMs || 1);
      if (timeDiff !== 0) return timeDiff;
      return String(left.id).localeCompare(String(right.id));
    });

    // Never replace a visible partial cache with an obviously empty result. This
    // guard protects the user's existing list if rules/network state produced an
    // anomalous zero-row response instead of a genuine empty collection.
    const cachedVisibleCount = readVisibleLegacyMusicNoteCacheCount(uid);
    if (recovered.length === 0 && cachedVisibleCount > 0) {
      console.warn('[adaptiveListIndexV2] canonical Music Note recovery returned zero rows while local rows exist; keeping local fallback.');
      return null;
    }

    const generatedAtMs = Date.now();
    const localSnapshot: SoridrawCatalogSnapshot = {
      schemaVersion: 3,
      kind: 'musicNote',
      revision: Math.max(1, generatedAtMs),
      items: recovered,
      itemCount: recovered.length,
      complete: true,
      generatedAtMs,
    };
    await writeCatalogSnapshotToLocalCache('musicNote', uid, localSnapshot);

    const finalItem = recovered[recovered.length - 1];
    return {
      schemaVersion: 1001,
      kind: 'musicNote',
      items: recovered,
      itemCount: recovered.length,
      cursorCreatedAtMs: finalItem ? getItemCreatedAtMs(finalItem) : 0,
      hasMore: false,
      deletedIds: [],
      updatedAtMs: generatedAtMs,
    };
  } catch (error) {
    console.warn('[adaptiveListIndexV2] one-time canonical Music Note recovery failed.', error);
    return null;
  }
};

'''
replace_once(anchor, helpers + anchor, 'recovery helpers')

replace_once(
    "  const snapshot = await readCatalogSnapshotCacheFirst(kind, uid);\n  if (!snapshot) return null;\n  const finalItem = snapshot.items[snapshot.items.length - 1];",
    "  const snapshot = await readCatalogSnapshotCacheFirst(kind, uid);\n  if (!snapshot) {\n    if (kind === 'musicNote') return recoverMusicNoteCatalogFromCanonicalFirestore(uid);\n    return null;\n  }\n  const finalItem = snapshot.items[snapshot.items.length - 1];",
    'catalog fallback',
)

path.write_text(source, encoding='utf-8')
print('1037 Music Note cold-catalog recovery patch applied')
