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

const summarizePages = (docs, maxPages = 20) => {
  const pages = [];
  for (let i = 0; i < docs.length && pages.length < maxPages; i += 20) {
    const slice = docs.slice(i, i + 20);
    const activeRows = slice.filter((entry) => !isSoftRemoved(entry.data));
    const firstMs = toMs(slice[0]?.data?.createdAtMs || slice[0]?.data?.createdAt);
    const lastMs = toMs(slice[slice.length - 1]?.data?.createdAtMs || slice[slice.length - 1]?.data?.createdAt);
    pages.push({
      page: pages.length + 1,
      rawDocs: slice.length,
      activeVisible: activeRows.length,
      removedHidden: slice.length - activeRows.length,
      firstMonth: firstMs ? new Date(firstMs).toISOString().slice(0, 7) : null,
      lastMonth: lastMs ? new Date(lastMs).toISOString().slice(0, 7) : null,
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

  const snap = await db.collection('favorites')
    .where('uid', '==', targetUid)
    .orderBy('createdAt', 'desc')
    .get();
  const docs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const active = docs.filter((entry) => !isSoftRemoved(entry.data));
  const removed = docs.filter((entry) => isSoftRemoved(entry.data));

  const typeBreakdown = {};
  for (const entry of docs) {
    const type = createdAtType(entry.data?.createdAt);
    const bucket = typeBreakdown[type] || { raw: 0, active: 0, removed: 0 };
    bucket.raw += 1;
    if (isSoftRemoved(entry.data)) bucket.removed += 1;
    else bucket.active += 1;
    typeBreakdown[type] = bucket;
  }

  const objectActive = active.filter((entry) => createdAtType(entry.data?.createdAt) === 'object');
  const timestampActive = active.filter((entry) => createdAtType(entry.data?.createdAt) === 'timestamp');
  const objectSignatures = new Set(objectActive.map(signature));
  const timestampSignatures = timestampActive.map(signature);
  const timestampExactSignatureMatchesObject = timestampSignatures.filter((sig) => objectSignatures.has(sig)).length;

  const objectCreatedAtMs = new Set(objectActive.map((entry) => Number(entry.data?.createdAtMs || 0)).filter((v) => v > 0));
  const timestampCreatedAtMsMatchesObject = timestampActive.filter((entry) => objectCreatedAtMs.has(Number(entry.data?.createdAtMs || 0))).length;

  const signatureCounts = new Map();
  for (const entry of active) {
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

  let createdAtMsQuery = { querySucceeded: false, indexRequired: false, errorCode: null };
  try {
    const page1 = await db.collection('favorites')
      .where('uid', '==', targetUid)
      .orderBy('createdAtMs', 'desc')
      .limit(20)
      .get();
    const page2 = page1.size
      ? await db.collection('favorites')
        .where('uid', '==', targetUid)
        .orderBy('createdAtMs', 'desc')
        .startAfter(page1.docs[page1.docs.length - 1])
        .limit(20)
        .get()
      : null;
    const first40 = [...page1.docs, ...(page2?.docs || [])].map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    createdAtMsQuery = {
      querySucceeded: true,
      indexRequired: false,
      errorCode: null,
      page1Count: page1.size,
      page2Count: page2?.size || 0,
      first40Pages: summarizePages(first40, 2),
    };
  } catch (error) {
    const message = String(error?.message || error || '');
    createdAtMsQuery = {
      querySucceeded: false,
      indexRequired: message.includes('requires an index'),
      errorCode: Number(error?.code || 0) || null,
    };
  }

  console.log(JSON.stringify({
    mode: 'READ_ONLY_MUSIC_NOTE_ACTIVE_COUNT_DIAGNOSTIC',
    projectId: PROJECT_ID,
    targetSelection: 'largest_profile_favoriteCount_no_uid_output',
    profileFavoriteCount: targetFavoriteCount,
    rawFavoriteDocs: docs.length,
    activeFavoriteDocs: active.length,
    softRemovedDocs: removed.length,
    activeMinusProfileCount: active.length - targetFavoriteCount,
    createdAtTypeBreakdown: typeBreakdown,
    timestampVsObjectComparison: {
      objectActive: objectActive.length,
      timestampActive: timestampActive.length,
      timestampExactSignatureMatchesObject,
      timestampCreatedAtMsMatchesObject,
      duplicateSignatureGroups,
      duplicateSignatureExtraDocs,
    },
    createdAtOrderingPages: summarizePages(docs, 20),
    createdAtMsQuery,
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
