export const isMusicNoteItemRemoved = (item: any): boolean => {
  if (!item || typeof item !== 'object') return true;

  // Current explicit state wins. Removal timestamps are historical metadata and
  // must not override a later successful save/restore.
  if (
    item.favoriteRemoved === true
    || item.saved === false
    || item.hidden === true
    || item.favoriteHidden === true
    || item.deletedAt
    || item.trashedAt
  ) return true;

  if (item.saved === true || item.favoriteRemoved === false) return false;

  // Legacy fallback only for records that predate explicit current-state flags.
  return Boolean(
    item.favoriteRemovedAt
    || item.unlikedAt
    || item.unsavedAt
  );
};

export const isMusicNoteItemActive = (item: any): boolean => !isMusicNoteItemRemoved(item);
