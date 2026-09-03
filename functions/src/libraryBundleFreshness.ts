export const LIBRARY_LIST_BUNDLE_SCHEMA_VERSION = 1;
export const LIBRARY_LIST_BUNDLE_LIMIT = 10;

export type LibraryListBundleCore = {
  schemaVersion: number;
  kind: "library";
  items: Record<string, any>[];
  itemCount: number;
  cursorCreatedAtMs: number;
  hasMore: boolean;
  deletedIds: string[];
};

export type LibraryTrackMutation = {
  trackId: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
};

export type LibraryBundleMutationPlan =
  | { action: "noop"; reason: string }
  | { action: "incremental"; reason: string; bundle: LibraryListBundleCore }
  | { action: "rebuild"; reason: string };

const NON_LIBRARY_FIELD_NAMES = new Set([
  "apiResponse",
  "apiStatusResponse",
  "rawApiResponse",
  "callbackPayload",
  "debugPayload",
  "updatedAt",
  "updatedAtMs",
  "creditCheckedAfterComplete",
  "creditCheckedAt",
]);

const isRecord = (value: unknown): value is Record<string, any> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const isNonLibraryField = (key: string): boolean => {
  if (NON_LIBRARY_FIELD_NAMES.has(key)) return true;
  const normalized = key.toLowerCase();
  if (normalized.includes("debug")) return true;
  return normalized.includes("raw") && (
    normalized.includes("payload") || normalized.includes("response")
  );
};

const cleanLibraryValue = (value: any, depth = 0): any => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date || typeof value?.toMillis === "function") return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanLibraryValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value !== "object" || depth > 12) return undefined;

  const cleaned: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (isNonLibraryField(key)) return;
    const next = cleanLibraryValue(entry, depth + 1);
    if (next !== undefined) cleaned[key] = next;
  });
  return cleaned;
};

export const getLibraryTrackCreatedAtMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") {
    const milliseconds = value.toMillis();
    return Number.isFinite(milliseconds) ? Math.floor(milliseconds) : 0;
  }
  if (typeof value?.seconds === "number") {
    const milliseconds = value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
    return Number.isFinite(milliseconds) ? Math.floor(milliseconds) : 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getItemCreatedAtMs = (item: Record<string, any>): number => (
  Number(item.createdAtMs || 0)
  || getLibraryTrackCreatedAtMs(item.createdAt)
  || 0
);

export const buildLibraryBundleTrackItem = (
  trackId: string,
  data: Record<string, any> | null,
): Record<string, any> | null => {
  const normalizedId = String(trackId || "").trim();
  if (!normalizedId || !isRecord(data)) return null;
  const cleaned = cleanLibraryValue(data);
  if (!isRecord(cleaned)) return null;
  return { ...cleaned, id: normalizedId };
};

const normalizeForComparison = (value: any): any => {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Array.isArray(value)) return value.map(normalizeForComparison);
  if (typeof value !== "object") return value;

  const normalized: Record<string, any> = {};
  Object.keys(value).sort().forEach((key) => {
    normalized[key] = normalizeForComparison(value[key]);
  });
  return normalized;
};

export const getLibraryComparableHash = (value: unknown): string => (
  JSON.stringify(normalizeForComparison(value))
);

export const hasLibraryBundleRelevantChange = (mutation: LibraryTrackMutation): boolean => {
  const beforeItem = buildLibraryBundleTrackItem(mutation.trackId, mutation.before);
  const afterItem = buildLibraryBundleTrackItem(mutation.trackId, mutation.after);
  return getLibraryComparableHash(beforeItem) !== getLibraryComparableHash(afterItem);
};

const normalizeDeletedIds = (value: unknown): string[] => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean),
)).slice(-450);

const sortLibraryItems = (items: Record<string, any>[]): Record<string, any>[] => (
  [...items].sort((left, right) => {
    const timeDifference = getItemCreatedAtMs(right) - getItemCreatedAtMs(left);
    if (timeDifference !== 0) return timeDifference;
    return String(left.id || "").localeCompare(String(right.id || ""));
  })
);

const buildLibraryBundleCore = (
  items: Record<string, any>[],
  hasMore: boolean,
  deletedIds: string[],
): LibraryListBundleCore => {
  const uniqueItems = new Map<string, Record<string, any>>();
  items.forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id || getItemCreatedAtMs(item) <= 0) return;
    uniqueItems.set(id, item);
  });
  const sortedItems = sortLibraryItems(Array.from(uniqueItems.values()))
    .slice(0, LIBRARY_LIST_BUNDLE_LIMIT);
  const cursorCreatedAtMs = sortedItems.length > 0
    ? getItemCreatedAtMs(sortedItems[sortedItems.length - 1])
    : 0;

  return {
    schemaVersion: LIBRARY_LIST_BUNDLE_SCHEMA_VERSION,
    kind: "library",
    items: sortedItems,
    itemCount: sortedItems.length,
    cursorCreatedAtMs,
    hasMore: sortedItems.length >= LIBRARY_LIST_BUNDLE_LIMIT ? hasMore : false,
    deletedIds: normalizeDeletedIds(deletedIds),
  };
};

export const isCompatibleLibraryBundle = (value: unknown): value is LibraryListBundleCore & { updatedAtMs: number } => {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== LIBRARY_LIST_BUNDLE_SCHEMA_VERSION || value.kind !== "library") return false;
  if (!Array.isArray(value.items) || value.items.length > LIBRARY_LIST_BUNDLE_LIMIT) return false;
  if (!Number.isInteger(value.itemCount) || value.itemCount !== value.items.length) return false;
  if (!Number.isInteger(value.cursorCreatedAtMs) || value.cursorCreatedAtMs < 0) return false;
  if (typeof value.hasMore !== "boolean") return false;
  if (!Array.isArray(value.deletedIds) || value.deletedIds.some((id: unknown) => (
    typeof id !== "string" || !id.trim()
  ))) return false;
  if (!Number.isInteger(value.updatedAtMs) || value.updatedAtMs <= 0) return false;
  if (value.items.length === 0) {
    return value.cursorCreatedAtMs === 0 && value.hasMore === false;
  }
  if (value.hasMore && value.items.length < LIBRARY_LIST_BUNDLE_LIMIT) return false;

  const itemIds = new Set<string>();
  const itemTimes: number[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) return false;
    const id = String(item.id || "").trim();
    const createdAtMs = getItemCreatedAtMs(item);
    if (!id || itemIds.has(id) || createdAtMs <= 0) return false;
    itemIds.add(id);
    itemTimes.push(createdAtMs);
  }
  for (let index = 1; index < itemTimes.length; index += 1) {
    if (itemTimes[index] > itemTimes[index - 1]) return false;
  }
  return value.cursorCreatedAtMs === itemTimes[itemTimes.length - 1];
};

const normalizeCompatibleBundle = (
  value: LibraryListBundleCore & { updatedAtMs: number },
): LibraryListBundleCore => buildLibraryBundleCore(
  value.items
    .map((item) => buildLibraryBundleTrackItem(String(item.id || ""), item))
    .filter((item): item is Record<string, any> => Boolean(item)),
  value.hasMore,
  value.deletedIds,
);

export const areLibraryBundleCoresEqual = (
  left: LibraryListBundleCore,
  right: LibraryListBundleCore,
): boolean => getLibraryComparableHash(left) === getLibraryComparableHash(right);

export const isLibraryBundleCoreCurrent = (
  currentValue: unknown,
  candidate: LibraryListBundleCore,
): boolean => (
  isCompatibleLibraryBundle(currentValue)
  && areLibraryBundleCoresEqual(normalizeCompatibleBundle(currentValue), candidate)
);

export const planLibraryBundleMutation = (
  currentValue: unknown,
  mutation: LibraryTrackMutation,
): LibraryBundleMutationPlan => {
  if (!hasLibraryBundleRelevantChange(mutation)) {
    return { action: "noop", reason: "non-library-field-change" };
  }
  if (!isCompatibleLibraryBundle(currentValue)) {
    return { action: "rebuild", reason: "bundle-missing-or-incompatible" };
  }

  const current = normalizeCompatibleBundle(currentValue);
  const trackId = String(mutation.trackId || "").trim();
  const currentIndex = current.items.findIndex((item) => String(item.id || "") === trackId);
  const beforeItem = buildLibraryBundleTrackItem(trackId, mutation.before);
  const afterItem = buildLibraryBundleTrackItem(trackId, mutation.after);

  if (!afterItem) {
    if (currentIndex < 0) return { action: "noop", reason: "deleted-track-outside-bundle" };
    return { action: "rebuild", reason: "latest-item-deleted" };
  }

  const afterCreatedAtMs = getItemCreatedAtMs(afterItem);
  if (afterCreatedAtMs <= 0) {
    return { action: "rebuild", reason: "created-at-unavailable" };
  }

  const beforeCreatedAtMs = beforeItem ? getItemCreatedAtMs(beforeItem) : afterCreatedAtMs;
  if (beforeItem && beforeCreatedAtMs !== afterCreatedAtMs) {
    return { action: "rebuild", reason: "created-at-changed" };
  }

  if (currentIndex >= 0) {
    const currentItem = current.items[currentIndex];
    const currentItemHash = getLibraryComparableHash(currentItem);
    const afterItemHash = getLibraryComparableHash(afterItem);
    const beforeItemHash = beforeItem ? getLibraryComparableHash(beforeItem) : "";
    if (
      currentItemHash !== afterItemHash
      && (!beforeItem || currentItemHash !== beforeItemHash)
    ) {
      // Firestore events are at-least-once and may arrive out of order. If this
      // bundle item matches neither side of the event, rebuild from canonical
      // documents instead of letting an older event overwrite a newer mutation.
      return { action: "rebuild", reason: "bundle-item-diverged" };
    }
    if (getItemCreatedAtMs(currentItem) !== afterCreatedAtMs) {
      return { action: "rebuild", reason: "bundle-created-at-mismatch" };
    }
    const nextItems = [...current.items];
    nextItems[currentIndex] = afterItem;
    const next = buildLibraryBundleCore(
      nextItems,
      current.hasMore,
      current.deletedIds.filter((id) => id !== trackId),
    );
    if (areLibraryBundleCoresEqual(current, next)) {
      return { action: "noop", reason: "bundle-already-current" };
    }
    return { action: "incremental", reason: "latest-item-updated", bundle: next };
  }

  if (current.items.length < LIBRARY_LIST_BUNDLE_LIMIT) {
    const next = buildLibraryBundleCore(
      [...current.items, afterItem],
      false,
      current.deletedIds.filter((id) => id !== trackId),
    );
    return { action: "incremental", reason: "new-item-filled-bundle", bundle: next };
  }

  const boundaryCreatedAtMs = current.cursorCreatedAtMs;
  if (afterCreatedAtMs > boundaryCreatedAtMs) {
    const next = buildLibraryBundleCore(
      [...current.items, afterItem],
      true,
      current.deletedIds.filter((id) => id !== trackId),
    );
    return { action: "incremental", reason: "item-entered-latest-ten", bundle: next };
  }
  if (afterCreatedAtMs === boundaryCreatedAtMs) {
    return { action: "rebuild", reason: "boundary-rank-ambiguous" };
  }

  if (!beforeItem && current.hasMore === false) {
    const next = buildLibraryBundleCore(current.items, true, current.deletedIds.filter((id) => id !== trackId));
    return { action: "incremental", reason: "older-item-created-beyond-bundle", bundle: next };
  }
  return { action: "noop", reason: "older-track-outside-bundle" };
};

export const buildRebuiltLibraryBundle = (
  items: Array<{ id: string; data: Record<string, any> }>,
  deletedIds: string[] = [],
): LibraryListBundleCore => buildLibraryBundleCore(
  items
    .map(({ id, data }) => buildLibraryBundleTrackItem(id, data))
    .filter((item): item is Record<string, any> => Boolean(item)),
  items.length >= LIBRARY_LIST_BUNDLE_LIMIT,
  deletedIds,
);

export const getNextLibraryBundleVersion = (currentVersion: unknown, nowMs = Date.now()): number => {
  const previous = Number(currentVersion || 0);
  const safePrevious = Number.isFinite(previous) && previous > 0 ? Math.floor(previous) : 0;
  const safeNow = Number.isFinite(nowMs) && nowMs > 0 ? Math.floor(nowMs) : 1;
  return Math.max(safeNow, safePrevious + 1);
};

export const getDeletedIdsForRebuild = (currentValue: unknown, mutation: LibraryTrackMutation): string[] => {
  const previous = isRecord(currentValue) ? normalizeDeletedIds(currentValue.deletedIds) : [];
  if (mutation.after) return previous.filter((id) => id !== mutation.trackId);
  return normalizeDeletedIds([...previous, mutation.trackId]);
};
