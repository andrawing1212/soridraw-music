const admin = require('firebase-admin');

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

const isSoftRemoved = (row) => Boolean(
  row?.favoriteRemoved === true ||
  row?.saved === false ||
  row?.favoriteRemovedAt ||
  row?.unlikedAt ||
  row?.unsavedAt
);

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

  const pages = [];
  for (let i = 0; i < docs.length && pages.length < 20; i += 20) {
    const slice = docs.slice(i, i + 20);
    const activeRows = slice.filter((entry) => !isSoftRemoved(entry.data));
    const removedRows = slice.length - activeRows.length;
    const firstMs = toMs(slice[0]?.data?.createdAtMs || slice[0]?.data?.createdAt);
    const lastMs = toMs(slice[slice.length - 1]?.data?.createdAtMs || slice[slice.length - 1]?.data?.createdAt);
    pages.push({
      page: pages.length + 1,
      rawDocs: slice.length,
      activeVisible: activeRows.length,
      removedHidden: removedRows,
      firstMonth: firstMs ? new Date(firstMs).toISOString().slice(0, 7) : null,
      lastMonth: lastMs ? new Date(lastMs).toISOString().slice(0, 7) : null,
    });
  }

  const monthCounts = {};
  for (const entry of docs) {
    const ms = toMs(entry.data?.createdAtMs || entry.data?.createdAt);
    const month = ms ? new Date(ms).toISOString().slice(0, 7) : 'unknown';
    const bucket = monthCounts[month] || { raw: 0, active: 0, removed: 0 };
    bucket.raw += 1;
    if (isSoftRemoved(entry.data)) bucket.removed += 1;
    else bucket.active += 1;
    monthCounts[month] = bucket;
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
    first20PagesRawVsVisible: pages,
    monthCounts,
    safety: {
      readsOnly: true,
      firestoreWrites: 0,
      firestoreDeletes: 0,
      deployments: 0,
    },
  }, null, 2));
})().catch((error) => {
  console.error('diagnose-music-note-active-count-readonly failed:', error?.stack || error?.message || String(error));
  process.exit(1);
});
