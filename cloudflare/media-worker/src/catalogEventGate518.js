// app518: Side-effect-free cost gate for a future server Firestore favorites
// onWrite event. No deployment, no Firebase trigger registration, no backend I/O.
// An event is only a hint: NEVER publish its stale after-image. A relevant event
// must cause exactly ONE fresh owner-scoped canonical document read first.
//
// projectSummary must be the same authoritative whitelist/projection used by
// the Catalog Worker; returning null means removed/hidden/unsaved.
const text = (value) => typeof value === 'string' ? value.trim() : '';

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
};

const sameProjected = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

export const planFavoriteCatalogEvent518 = ({
  uid, documentId, before, after, projectSummary,
} = {}) => {
  if (!text(uid) || !text(documentId) || text(documentId).length > 240
    || text(documentId) === '.' || text(documentId) === '..'
    || /[\\/]/.test(text(documentId)) || typeof projectSummary !== 'function') {
    return { code: 'DENY_INVALID_EVENT', canonicalReads: 0, writes: 0 };
  }
  // No event payload from a different owner should ever become catalog
  // authority, even in a test or while migrating legacy song IDs.
  if ((before && before.uid !== uid) || (after && after.uid !== uid)) {
    return { code: 'DENY_OWNER_MISMATCH', canonicalReads: 0, writes: 0 };
  }
  if (!before && !after) return { code: 'IGNORE_EMPTY', canonicalReads: 0, writes: 0 };
  const beforeSummary = before ? projectSummary(before, documentId) : null;
  const afterSummary = after ? projectSummary(after, documentId) : null;
  if (beforeSummary && String(beforeSummary.id || '') !== documentId
    || afterSummary && String(afterSummary.id || '') !== documentId) {
    return { code: 'DENY_ID_MISMATCH', canonicalReads: 0, writes: 0 };
  }
  if (sameProjected(beforeSummary, afterSummary)) {
    // Never trigger a Cloud Function -> Firestore read or R2 write for
    // unrelated metadata changes. Relevance must include visibility/media.
    return { code: 'IGNORE_NO_CATALOG_CHANGE', canonicalReads: 0, writes: 0 };
  }
  // Strictly a PLAN, not a side effect: the real handler must read the latest
  // canonical owner document, then apply source-version/tombstone fencing.
  return {
    code: 'RECHECK_EXACT_CANONICAL',
    uid, documentId,
    canonicalReads: 1,
    writes: 0,
    neverTrustEventAfter: true,
  };
};
