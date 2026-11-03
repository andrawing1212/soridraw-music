// Manual, exact-row canonical color recovery policy. Pure and fail-closed.
// The caller MUST authenticate the owner, read a single canonical Firestore
// document, and CAS the existing shared R2 journal. Never derive row identity
// from titles or from untrusted client-provided color values.
const has = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
const colors = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);
const colored = (value) => typeof value === 'string' && colors.has(value);
const map = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value);

// Match src/lib/musicNoteSavedState.ts exactly: explicit current save status
// outranks historical removal timestamps, and legacy removals still count.
const isMusicNoteRemoved = (row) => {
  if (row.favoriteRemoved === true || row.saved === false
    || row.hidden === true || row.favoriteHidden === true
    || row.deletedAt || row.trashedAt) return true;
  if (row.saved === true || row.favoriteRemoved === false) return false;
  return Boolean(row.favoriteRemovedAt || row.unlikedAt || row.unsavedAt);
};
const inactive = (row, kind) => (
  row.status === 'deleted'
  || (kind === 'musicNote' ? isMusicNoteRemoved(row)
    : row.hidden === true || row.deletedAt != null || row.trashedAt != null)
);

export const planExactCanonicalColorRestore = (kind, canonical, catalogRow) => {
  if (!['musicNote', 'library'].includes(kind)
    || !canonical || typeof canonical !== 'object'
    || !catalogRow || typeof catalogRow !== 'object'
    || !String(catalogRow.id || '').trim()) {
    return { code: 'INVALID_OR_MISSING_ROW', row: null };
  }
  // Even a stale canonical document must not re-color a deleted R2 row.
  if (inactive(canonical, kind) || inactive(catalogRow, kind)) {
    return { code: 'INACTIVE', row: null };
  }

  if (kind === 'musicNote') {
    // Modern explicit gray/null reset blocks all legacy fallback.
    const source = has(canonical, 'favoriteColorTag')
      ? canonical.favoriteColorTag
      : has(canonical, 'colorTag') ? canonical.colorTag : undefined;
    if (!colored(source)) return { code: 'NO_CURRENT_SOURCE_COLOR', row: null };
    // Absence is NOT the same as a null/gray reset, even for legacy aliases.
    if (['favoriteColorTag', 'colorTag', 'favoriteColor', 'noteColor', 'color']
      .some(key => has(catalogRow, key))) {
      return { code: 'EXISTING_COLOR_OR_RESET', row: null };
    }
    return { code: 'READY', row: { ...catalogRow, favoriteColorTag: source } };
  }

  let next = null;
  for (const field of ['colorTags', 'favoriteColorTags']) {
    const original = canonical[field];
    if (!map(original)) continue;
    if (has(catalogRow, field) && !map(catalogRow[field])) continue;
    // An explicit empty map may represent a reset: never repopulate it.
    if (map(catalogRow[field]) && Object.keys(catalogRow[field]).length === 0) continue;
    const existing = map(catalogRow[field]) ? catalogRow[field] : {};
    let updated = null;
    for (const [index, value] of Object.entries(original)) {
      if (!/^(0|[1-9]\d{0,3})$/.test(index) || !colored(value) || has(existing, index)) continue;
      if (!updated) updated = { ...existing };
      updated[index] = value;
    }
    if (updated) {
      if (!next) next = { ...catalogRow };
      next[field] = updated;
    }
  }
  return next ? { code: 'READY', row: next } : { code: 'NO_MISSING_COLOR', row: null };
};


// Future canonical-authoritative version fence. Not called by any live Writer.
// A Firestore onWrite/outbox publisher must provide a server-attested updateTime
// and deliver every change (including explicit null/gray) at least once.
// An R2 CAS loop must re-run this pure decision after every conflict.
// This prevents late OLD events overwriting a NEWER source version already
// applied. It cannot make Firestore+R2 atomic or substitute for delivery.
const firestoreVersion = (version) => {
  if (typeof version !== 'string') return '';
  const match = version.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/);
  if (!match || !Number.isFinite(Date.parse(match[1] + 'Z'))) return '';
  return match[1] + '.' + (match[2] || '').padEnd(9, '0') + 'Z';
};
const normalizedColor = (value) => (
  colored(value) ? value : (value === null || value === 'gray' ? null : undefined)
);
const canonicalColorPatch = (kind, canonical, existing, allowExisting) => {
  const patch = {};
  if (kind === 'musicNote') {
    const key = has(canonical, 'favoriteColorTag') ? 'favoriteColorTag'
      : has(canonical, 'colorTag') ? 'colorTag' : '';
    if (!key) return patch;
    const value = normalizedColor(canonical[key]);
    if (value === undefined) return patch;
    if (!allowExisting && ['favoriteColorTag', 'colorTag', 'favoriteColor', 'noteColor', 'color']
      .some(k => has(existing, k))) return patch;
    patch.favoriteColorTag = value;
    return patch;
  }
  for (const field of ['colorTags', 'favoriteColorTags']) {
    const original = canonical[field];
    if (!map(original)) continue;
    const target = existing[field];
    if (!allowExisting && has(existing, field) && !map(target)) continue;
    if (!allowExisting && map(target) && Object.keys(target).length === 0) continue;
    const update = {};
    for (const [index, raw] of Object.entries(original)) {
      if (!/^(0|[1-9]\d{0,3})$/.test(index)) continue;
      const value = normalizedColor(raw);
      if (value === undefined) continue;
      if (!allowExisting && map(target) && has(target, index)) continue;
      if (map(target) && has(target, index) && target[index] === value) continue;
      update[index] = value;
    }
    if (Object.keys(update).length) patch[field] = update;
  }
  return patch;
};

// Candidate for a future event-backed Writer; this function performs NO IO.
// Invalid or unversioned events never overwrite existing explicit resets.
// Versions alone are insufficient: the caller must authenticate exact owner/ID,
// read the true canonical source, and establish guaranteed eventual delivery.
export const planCanonicalColorVersionTransition = ({
  kind, canonical, catalogRow, sourceUpdateTime, appliedSourceUpdateTime,
}) => {
  if (!['musicNote', 'library'].includes(kind) || !canonical || !catalogRow
    || !String(catalogRow.id || '').trim()
    || inactive(canonical, kind) || inactive(catalogRow, kind)) {
    return { code: 'INACTIVE_OR_UNKNOWN', patch: null };
  }
  const next = firestoreVersion(sourceUpdateTime);
  const previous = appliedSourceUpdateTime ? firestoreVersion(appliedSourceUpdateTime) : '';
  if (!next || (appliedSourceUpdateTime && !previous)) {
    return { code: 'SOURCE_VERSION_INVALID', patch: null };
  }
  if (previous && next < previous) return { code: 'OLDER_EVENT_REJECTED', patch: null };
  if (previous && next === previous) return { code: 'DUPLICATE_EVENT', patch: null };
  const patch = canonicalColorPatch(kind, canonical, catalogRow, Boolean(previous));
  if (!Object.keys(patch).length) {
    return { code: previous ? 'NO_COLOR_CHANGE' : 'UNVERSIONED_RESET_OR_NO_MISSING_COLOR', patch: null };
  }
  return { code: 'COLOR_VERSION_ADVANCE_CANDIDATE', patch, updateTime: next };
};
