// Studio heart previews are ephemeral account-scoped Music Note items.
// Preserve the original song detail for immediate cross-device display.
// Never treat a preview as a canonical Catalog write or deletion.
const DETAIL_KEYS = ['prompt', 'lyrics', 'userInput', 'situationSummary'];
const OPTIONAL_HEAVY_KEYS = [
  'searchTokens', 'sunoLinks', 'sunoShareLinks', 'sunoData', 'audioUrls',
  'streamAudioUrl', 'sourceStreamAudioUrl',
];

const selectTitle = (source) => {
  const applied = source?.appliedKeywords || {};
  return [source?.title, source?.koreanTitle, source?.englishTitle,
    applied?.titlesByLanguage?.ko, applied?.titlesByLanguage?.en]
    .find((value) => typeof value === 'string' && value.trim())?.trim() || '';
};

const boundedPlain = (value, max) => {
  try {
    const json = JSON.stringify(value);
    return json && json.length <= max ? JSON.parse(json) : null;
  } catch { return null; }
};

// Pass an active, marker-free COPY to the existing Catalog projector: that
// projector must reject real removed/optimistic rows, but the RTDB preview
// must still carry the full song. The copy never touches canonical storage.
export const buildStudioHeartPreviewItem = (source, documentId, projectActiveSummary, maxChars = 24000) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const id = String(documentId || source.firestoreId || source.id || '').trim();
  if (!id) return null;

  const activeSource = {
    ...source, id, firestoreId: id,
    __studioHeartRemotePreview: false,
    __studioHeartRemotePreviewLocal: false,
    __studioHeartPendingLocal: false,
    saved: true, hidden: false, favoriteHidden: false,
    favoriteRemoved: false, favoriteRemovedAt: null,
    unsavedAt: null, unlikedAt: null, deletedAt: null, trashedAt: null,
  };
  const summary = projectActiveSummary(activeSource, id);
  if (!summary) return null;

  const saved = source.saved !== false && source.favoriteRemoved !== true;
  const title = selectTitle(source) || selectTitle(summary);
  const full = {
    ...summary,
    id, firestoreId: id, title,
    __catalogSummary: false,
    __studioHeartRemotePreview: true,
    saved, hidden: false, favoriteHidden: false,
    favoriteRemoved: !saved,
    favoriteRemovedAt: saved ? null : (source.favoriteRemovedAt || Date.now()),
    unsavedAt: saved ? null : (source.unsavedAt || Date.now()),
    unlikedAt: saved ? null : (source.unlikedAt || Date.now()),
  };
  for (const key of DETAIL_KEYS) {
    if (source[key] !== undefined) full[key] = source[key];
  }
  let complete = boundedPlain(full, maxChars);
  if (complete) return complete;

  // Prefer full song text over redundant search indexes or large media arrays.
  const reduced = { ...full };
  for (const key of OPTIONAL_HEAVY_KEYS) delete reduced[key];
  complete = boundedPlain(reduced, maxChars);
  if (complete) return complete;

  // A genuinely oversized song cannot fit the existing 24k RTDB signal.
  // Mark the rare fallback partial instead of fabricating a complete Detail.
  const essential = {
    ...reduced,
    __catalogSummary: true,
    __studioHeartDetailPartial: true,
  };
  if (essential.appliedKeywords && typeof essential.appliedKeywords === 'object') {
    const applied = essential.appliedKeywords;
    essential.appliedKeywords = {
      generationBatchId: applied.generationBatchId ?? null,
      generationIndex: applied.generationIndex ?? null,
      titlesByLanguage: applied.titlesByLanguage ?? null,
    };
  }
  for (const key of ['situationSummary', 'userInput', 'lyrics', 'prompt']) {
    if (boundedPlain(essential, maxChars)) break;
    delete essential[key];
  }
  return boundedPlain(essential, maxChars) || boundedPlain({
    id, firestoreId: id, title,
    __catalogSummary: true,
    __studioHeartDetailPartial: true,
    __studioHeartRemotePreview: true,
    saved, favoriteRemoved: !saved,
    favoriteRemovedAt: saved ? null : (source.favoriteRemovedAt || Date.now()),
    recentSongSyncKey: source.recentSongSyncKey || null,
    soridrawSongId: source.soridrawSongId || null,
  }, maxChars);
};
