// Manual, exact-row canonical color recovery policy. Pure and fail-closed.
// The caller MUST authenticate the owner, read a single canonical Firestore
// document, and CAS the existing shared R2 journal. Never derive row identity
// from titles or from untrusted client-provided color values.
const has = (record, key) => Object.prototype.hasOwnProperty.call(record, key);
const colors = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);
const colored = (value) => typeof value === 'string' && colors.has(value);
const map = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value);

const inactive = (row, kind) => (
  row.hidden === true || row.deletedAt != null || row.trashedAt != null
  || row.status === 'deleted'
  || (kind === 'musicNote' && (
    row.saved === false || row.favoriteRemoved === true
    || row.favoriteHidden === true || row.favoriteRemovedAt != null
  ))
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
