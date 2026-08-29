const admin = require('firebase-admin');
const crypto = require('crypto');

const PROJECT_ID = 'soridraw-app-866a5';
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const toMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const createdAtType = (value) => {
  if (value === null || value === undefined) return 'missing';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (typeof value?.toMillis === 'function' || typeof value?.seconds === 'number') return 'timestamp';
  if (value instanceof Date) return 'date';
  return typeof value;
};

const isSoftRemoved = (row) => Boolean(
  row?.favoriteRemoved === true ||
  row?.saved === false ||
  row?.favoriteRemovedAt ||
  row?.unlikedAt ||
  row?.unsavedAt
);
const isUiHidden = (row) => Boolean(
  isSoftRemoved(row) ||
  row?.hidden === true ||
  row?.favoriteHidden === true ||
  row?.deletedAt ||
  row?.trashedAt
);
const isSharedNote = (row) => Boolean(
  row?.isSharedMusicNote === true ||
  row?.sharedReadOnly === true ||
  String(row?.sourceType || '') === 'shared_music_note' ||
  Boolean(row?.sharedNoteShareId)
);
const isMyNoteVisible = (row) => !isUiHidden(row) && !isSharedNote(row);

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const signature = (entry) => {
  const row = entry.data || {};
  const title = normalize(row.title || row.koreanTitle || row.englishTitle || '');
  const createdMs = Number(row.createdAtMs || 0) || toMs(row.createdAt);
  const prompt = normalize(row.prompt || row.stylePrompt || row.musicPrompt || '');
  const lyricsKo = normalize(row?.lyrics?.korean || row.koreanLyrics || '');
  const raw = `${createdMs}|${title}|${prompt}|${lyricsKo}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
};
const monthOf = (entry) => {
  const ms = Number(entry?.data?.createdAtMs || 0) || toMs(entry?.data?.createdAt);
  return ms > 0 ? new Date(ms).toISOString().slice(0, 7) : null;
};
const summarizeRawPages = (docs, maxPages = 12) => {
  const pages = [];
  for (let i = 0; i < docs.length && pages.length < maxPages; i += 20) {
    const slice = docs.slice(i, i + 20);
    pages.push({
      page: pages.length + 1,
      rawDocs: slice.length,
      softActive: slice.filter((entry) => !isSoftRemoved(entry.data)).length,
      uiVisible: slice.filter((entry) => !isUiHidden(entry.data)).length,
      myNoteVisible: slice.filter((entry) => isMyNoteVisible(entry.data)).length,
      firstMonth: monthOf(slice[0]),
      lastMonth: monthOf(slice[slice.length - 1]),
    });
  }
  return pages;
};
const simulate985VisibleAdds = (docs, maxPages = 12) => {
  const pages = [];
  let index = 0;
  while (index < docs.length && pages.length < maxPages) {
    const softActive = [];
    const start = index;
    while (index < docs.length && softActive.length < 20) {
      const entry = docs[index++];
      if (!isSoftRemoved(entry.data)) softActive.push(entry);
    }
    if (softActive.length === 0) break;
    pages.push({
      page: pages.length + 1,
      rawDocsConsumed: index - start,
      softActiveReturned: softActive.length,
      uiVisibleAfterPageFilter: softActive.filter((entry) => !isUiHidden(entry.data)).length,
      myNoteVisibleAfterPageFilter: softActive.filter((entry) => isMyNoteVisible(entry.data)).length,
      firstMonth: monthOf(softActive[0]),
      lastMonth: monthOf(softActive[softActive.length - 1]),
    });
  }
  return pages;
};

(async () => {
  const usersSnap = await db.collection('users').get();
  let targetUid = '';
  let targetFavoriteCount = -1;
  for (const doc of usersSnap.docs) {
    const row = doc.data() || {};
    const count = Number(row.favoriteCount || 0);
    if (count > targetFavoriteCount) {
      targetUid = doc.id;
      targetFavoriteCount = count;
    }
  }
  if (!targetUid) throw new Error('No target account found');

  const mixedSnap = await db.collection('favorites').where('uid', '==', targetUid).orderBy('createdAt', 'desc').get();
  const mixedDocs = mixedSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const normalizedSnap = await db.collection('favorites').where('uid', '==', targetUid).orderBy('createdAtMs', 'desc').get();
  const normalizedDocs = normalizedSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));

  const active = normalizedDocs.filter((entry) => !isSoftRemoved(entry.data));
  const uiVisible = normalizedDocs.filter((entry) => !isUiHidden(entry.data));
  const myNoteVisible = normalizedDocs.filter((entry) => isMyNoteVisible(entry.data));
  const removed = normalizedDocs.filter((entry) => isSoftRemoved(entry.data));
  const mixedUiVisible = mixedDocs.filter((entry) => !isUiHidden(entry.data));
  const mixedMyNoteVisible = mixedDocs.filter((entry) => isMyNoteVisible(entry.data));
  const mixedSharedVisible = mixedDocs.filter((entry) => !isUiHidden(entry.data) && isSharedNote(entry.data));
  const timestampDocs = mixedDocs.filter((entry) => createdAtType(entry.data?.createdAt) === 'timestamp');
  const timestampVisible = timestampDocs.filter((entry) => !isUiHidden(entry.data));
  const timestampMyNoteVisible = timestampDocs.filter((entry) => isMyNoteVisible(entry.data));
  const timestampSharedVisible = timestampDocs.filter((entry) => !isUiHidden(entry.data) && isSharedNote(entry.data));

  const hiddenFlags = {
    hiddenTrue: normalizedDocs.filter((entry) => entry.data?.hidden === true).length,
    favoriteHiddenTrue: normalizedDocs.filter((entry) => entry.data?.favoriteHidden === true).length,
    deletedAtPresent: normalizedDocs.filter((entry) => Boolean(entry.data?.deletedAt)).length,
    trashedAtPresent: normalizedDocs.filter((entry) => Boolean(entry.data?.trashedAt)).length,
    softRemoved: removed.length,
  };

  const timestampGroup = {
    raw: timestampDocs.length,
    softActive: timestampDocs.filter((entry) => !isSoftRemoved(entry.data)).length,
    uiVisible: timestampVisible.length,
    myNoteVisible: timestampMyNoteVisible.length,
    sharedNoteVisible: timestampSharedVisible.length,
    createdAtMsPresent: timestampDocs.filter((entry) => Number(entry.data?.createdAtMs || 0) > 0).length,
    isSharedMusicNoteTrue: timestampDocs.filter((entry) => entry.data?.isSharedMusicNote === true).length,
    sharedReadOnlyTrue: timestampDocs.filter((entry) => entry.data?.sharedReadOnly === true).length,
    sharedSourceType: timestampDocs.filter((entry) => String(entry.data?.sourceType || '') === 'shared_music_note').length,
    sharedNoteShareIdPresent: timestampDocs.filter((entry) => Boolean(entry.data?.sharedNoteShareId)).length,
    hiddenTrue: timestampDocs.filter((entry) => entry.data?.hidden === true).length,
    favoriteHiddenTrue: timestampDocs.filter((entry) => entry.data?.favoriteHidden === true).length,
    deletedAtPresent: timestampDocs.filter((entry) => Boolean(entry.data?.deletedAt)).length,
    trashedAtPresent: timestampDocs.filter((entry) => Boolean(entry.data?.trashedAt)).length,
    savedFalse: timestampDocs.filter((entry) => entry.data?.saved === false).length,
    favoriteRemovedTrue: timestampDocs.filter((entry) => entry.data?.favoriteRemoved === true).length,
    hasSoridrawSongId: timestampDocs.filter((entry) => Boolean(String(entry.data?.soridrawSongId || '').trim())).length,
  };

  const typeBreakdown = {};
  for (const entry of mixedDocs) {
    const type = createdAtType(entry.data?.createdAt);
    const bucket = typeBreakdown[type] || { raw: 0, active: 0, removed: 0 };
    bucket.raw += 1;
    if (isSoftRemoved(entry.data)) bucket.removed += 1;
    else bucket.active += 1;
    typeBreakdown[type] = bucket;
  }

  const objectActive = active.filter((entry) => createdAtType(entry.data?.createdAt) === 'object');
  const objectSignatures = new Set(objectActive.map(signature));
  const timestampSignatures = timestampDocs.filter((entry) => !isSoftRemoved(entry.data)).map(signature);
  const timestampExactSignatureMatchesObject = timestampSignatures.filter((sig) => objectSignatures.has(sig)).length;
  const signatureCounts = new Map();
  for (const entry of mixedMyNoteVisible) {
    const sig = signature(entry);
    signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
  }
  let duplicateSignatureGroups = 0;
  let duplicateSignatureExtraDocs = 0;
  for (const count of signatureCounts.values()) {
    if (count > 1) {
      duplicateSignatureGroups += 1;
      duplicateSignatureExtraDocs += count - 1;
    }
  }

  console.log(JSON.stringify({
    mode: 'READ_ONLY_MUSIC_NOTE_VISIBLE_COUNT_DIAGNOSTIC',
    projectId: PROJECT_ID,
    targetSelection: 'largest_profile_favoriteCount_no_uid_output',
    profileFavoriteCount: targetFavoriteCount,
    mixedRawFavoriteDocs: mixedDocs.length,
    mixedUiVisibleFavoriteDocs: mixedUiVisible.length,
    mixedMyNoteVisibleFavoriteDocs: mixedMyNoteVisible.length,
    mixedSharedNoteVisibleFavoriteDocs: mixedSharedVisible.length,
    normalizedRawFavoriteDocs: normalizedDocs.length,
    normalizedSoftActiveFavoriteDocs: active.length,
    normalizedUiVisibleFavoriteDocs: uiVisible.length,
    normalizedMyNoteVisibleFavoriteDocs: myNoteVisible.length,
    normalizedSoftRemovedDocs: removed.length,
    timestampGroup,
    hiddenFlags,
    createdAtTypeBreakdown: typeBreakdown,
    timestampVsObjectComparison: {
      objectActive: objectActive.length,
      timestampActive: timestampDocs.filter((entry) => !isSoftRemoved(entry.data)).length,
      timestampExactSignatureMatchesObject,
      duplicateVisibleMyNoteSignatureGroups: duplicateSignatureGroups,
      duplicateVisibleMyNoteSignatureExtraDocs: duplicateSignatureExtraDocs,
    },
    normalizedRaw20Pages: summarizeRawPages(normalizedDocs, 12),
    simulated985Pages: simulate985VisibleAdds(normalizedDocs, 12),
    safety: {
      readsOnly: true,
      firestoreWrites: 0,
      firestoreDeletes: 0,
      deployments: 0,
      contentValuesLogged: false,
    },
  }, null, 2));
})().catch((error) => {
  console.error('diagnose-music-note-active-count-readonly failed:', error?.stack || error?.message || String(error));
  process.exit(1);
});
