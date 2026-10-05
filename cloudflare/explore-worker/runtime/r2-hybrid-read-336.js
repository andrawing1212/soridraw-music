// SORIDRAW_R2_HYBRID_READ_336_20261004
// Pure merge/cursor helpers for the app336 compatibility layer.
// This file intentionally performs no D1/R2 I/O by itself.

export const EXPLORE_R2_HYBRID_SCHEMA_336 = 1;

export function isExploreR2HybridReadEnabled336(env) {
  return String(env?.SORIDRAW_R2_CATALOG_V1 || '').trim() === '1'
    && String(env?.SORIDRAW_R2_HYBRID_READ_V1 || '').trim() === '1';
}

export function hybridTrackId336(item) {
  return String(item?.id || item?.trackId || '').trim();
}

export function hybridPublishedAt336(item) {
  return Math.max(0, Number(item?.publishedAt ?? item?.published_at ?? 0) || 0);
}

export function hybridLikeCount336(item) {
  return Math.max(0, Number(
    item?.likeCount
    ?? item?.like_count
    ?? item?.stats?.likeCount
    ?? item?.stats?.like_count
    ?? 0
  ) || 0);
}

export function hybridProfilePinned336(item) {
  return Number(Boolean(item?.profilePinned ?? item?.profile_pinned));
}

export function hybridCompare336(kind, left, right) {
  const aId = hybridTrackId336(left);
  const bId = hybridTrackId336(right);
  if (kind === 'popular') {
    const likeDelta = hybridLikeCount336(right) - hybridLikeCount336(left);
    if (likeDelta) return likeDelta;
  }
  if (kind === 'profile') {
    const pinDelta = hybridProfilePinned336(right) - hybridProfilePinned336(left);
    if (pinDelta) return pinDelta;
  }
  const publishedDelta = hybridPublishedAt336(right) - hybridPublishedAt336(left);
  if (publishedDelta) return publishedDelta;
  return bId.localeCompare(aId);
}

export function orderHybridItems336(legacyItems, catalogItems, kind) {
  const byId = new Map();
  for (const item of Array.isArray(legacyItems) ? legacyItems : []) {
    const id = hybridTrackId336(item);
    if (!id) continue;
    byId.set(id, item);
  }
  // Catalog/shared-card data is the newer authority whenever the same track
  // exists in both worlds.
  for (const item of Array.isArray(catalogItems) ? catalogItems : []) {
    const id = hybridTrackId336(item);
    if (!id) continue;
    byId.set(id, item);
  }
  return [...byId.values()].sort((a, b) => hybridCompare336(kind, a, b));
}

export function mergeHybridItems336(legacyItems, catalogItems, kind, limit) {
  const ordered = orderHybridItems336(legacyItems, catalogItems, kind);
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 40)));
  return { ordered, items: ordered.slice(0, safeLimit) };
}

export function hybridBoundary336(kind, item) {
  const id = hybridTrackId336(item);
  if (!id) return null;
  const publishedAt = hybridPublishedAt336(item);
  if (kind === 'popular') {
    return { likeCount: hybridLikeCount336(item), publishedAt, id };
  }
  if (kind === 'profile') {
    return { profilePinned: hybridProfilePinned336(item), publishedAt, id };
  }
  return { publishedAt, id };
}

export function hybridCursorState336(decoded, kind, key) {
  if (!decoded || typeof decoded !== 'object') return null;
  if (Number(decoded.hybridV1 || 0) !== EXPLORE_R2_HYBRID_SCHEMA_336) return null;
  if (String(decoded.kind || '') !== String(kind || '')) return null;
  if (String(decoded.key || '') !== String(key || '')) return null;
  const carry = Array.isArray(decoded.r2Carry)
    ? decoded.r2Carry.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 100)
    : [];
  return {
    boundary: decoded.boundary && typeof decoded.boundary === 'object' ? decoded.boundary : null,
    r2Started: Boolean(decoded.r2Started),
    r2Done: Boolean(decoded.r2Done),
    r2Next: decoded.r2Next && typeof decoded.r2Next === 'object' ? decoded.r2Next : null,
    r2Carry: [...new Set(carry)],
  };
}

export function hybridCursorPayload336(kind, key, state = {}) {
  return {
    hybridV1: EXPLORE_R2_HYBRID_SCHEMA_336,
    kind,
    key,
    boundary: state.boundary || null,
    r2Started: Boolean(state.r2Started),
    r2Done: Boolean(state.r2Done),
    r2Next: state.r2Next || null,
    r2Carry: [...new Set((state.r2Carry || []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 100),
  };
}

export function searchPriority336(item, normalizedQuery) {
  const title = String(item?.title || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  return 2;
}

export function mergeHybridSearch336(legacyData, catalogData, query, limit) {
  const normalized = String(query || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 40)));
  const legacyItems = Array.isArray(legacyData?.items)
    ? legacyData.items
    : Array.isArray(legacyData?.tracks?.items) ? legacyData.tracks.items : [];
  const catalogItems = Array.isArray(catalogData?.items)
    ? catalogData.items
    : Array.isArray(catalogData?.tracks?.items) ? catalogData.tracks.items : [];
  const byId = new Map();
  for (const item of legacyItems) {
    const id = hybridTrackId336(item);
    if (id) byId.set(id, item);
  }
  for (const item of catalogItems) {
    const id = hybridTrackId336(item);
    if (id) byId.set(id, item);
  }
  const items = [...byId.values()]
    .sort((a, b) => searchPriority336(a, normalized) - searchPriority336(b, normalized)
      || hybridPublishedAt336(b) - hybridPublishedAt336(a)
      || hybridTrackId336(b).localeCompare(hybridTrackId336(a)))
    .slice(0, safeLimit);

  const creatorsByUid = new Map();
  for (const creator of Array.isArray(legacyData?.creators) ? legacyData.creators : []) {
    const uid = String(creator?.uid || '').trim();
    if (uid) creatorsByUid.set(uid, creator);
  }
  for (const creator of Array.isArray(catalogData?.creators) ? catalogData.creators : []) {
    const uid = String(creator?.uid || '').trim();
    if (uid) creatorsByUid.set(uid, creator);
  }
  const creators = [...creatorsByUid.values()].slice(0, 20);
  return {
    query,
    items,
    tracks: { items, nextCursor: legacyData?.tracks?.nextCursor ?? legacyData?.nextCursor ?? null },
    creators,
    nextCursor: legacyData?.nextCursor ?? legacyData?.tracks?.nextCursor ?? null,
  };
}
