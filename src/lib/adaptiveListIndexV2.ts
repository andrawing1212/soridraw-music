import {
  readCatalogSnapshotCacheFirst,
  scheduleCatalogSnapshotPublishIfDirty,
  type SoridrawCatalogKind,
} from './userDataEngine';

export type AdaptiveListIndexKind = SoridrawCatalogKind;

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
  complete?: boolean;
  expectedItemCount?: number | null;
};

const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;
const PREVIEW_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
]);

export const isPreviewAdaptiveListIndexEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return PREVIEW_HOSTS.has(window.location.hostname.toLowerCase());
};

const getCreatedAtMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') {
    const result = Number(value.toMillis());
    return Number.isFinite(result) ? Math.floor(result) : 0;
  }
  if (typeof value?.seconds === 'number') return Math.floor(Number(value.seconds) * 1000);
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
};

const getItemCreatedAtMs = (item: any): number => (
  Number(item?.createdAtMs || 0)
  || getCreatedAtMs(item?.createdAt)
  || Number(item?.updatedAtMs || 0)
  || getCreatedAtMs(item?.updatedAt)
  || 0
);

// Compatibility bridge for existing Music Note / Library bootstrap callers.
// The underlying implementation is now the common catalog engine:
// full private object snapshot -> IndexedDB -> local-only UI pagination.
export const readPreviewAdaptiveListIndexV2 = async (
  kind: AdaptiveListIndexKind,
  uid: string,
): Promise<AdaptiveListIndexSnapshot | null> => {
  if (!uid || !isPreviewAdaptiveListIndexEnabled()) return null;
  const snapshot = await readCatalogSnapshotCacheFirst(kind, uid);
  if (!snapshot) return null;
  const finalItem = snapshot.items[snapshot.items.length - 1];
  return {
    schemaVersion: 1001,
    kind,
    items: snapshot.items,
    itemCount: snapshot.itemCount,
    cursorCreatedAtMs: finalItem ? getItemCreatedAtMs(finalItem) : 0,
    hasMore: false,
    deletedIds: [],
    updatedAtMs: snapshot.generatedAtMs,
  };
};

export const schedulePreviewAdaptiveListIndexPublishIfDirty = (
  kind: AdaptiveListIndexKind,
  uid: string,
  sourceItems: any[],
  options: AdaptivePublishOptions = {},
): void => {
  scheduleCatalogSnapshotPublishIfDirty(kind, uid, sourceItems, {
    hasMore: options.hasMore,
    complete: options.complete,
    expectedItemCount: options.expectedItemCount,
  });
};
