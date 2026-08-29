const admin = require('firebase-admin');

const PROJECT_ID = 'soridraw-app-866a5';
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const isPresent = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const toMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const tallyFields = (rows, fields) => {
  const result = { total: rows.length };
  for (const field of fields) {
    let present = 0;
    for (const row of rows) if (isPresent(row[field])) present += 1;
    result[`${field}Present`] = present;
    result[`${field}Missing`] = rows.length - present;
  }
  return result;
};

const tallyFavoriteMetadata = (entries) => {
  const result = {
    total: entries.length,
    favoriteColorTagPresent: 0,
    colorTagPresent: 0,
    sunoLinksNonEmpty: 0,
    sunoShareUrlPresent: 0,
    sunoUrlPresent: 0,
    sunoSongUrlPresent: 0,
    storedIdPresent: 0,
    storedIdDiffersFromDocId: 0,
  };
  for (const entry of entries) {
    const row = entry.data || {};
    if (isPresent(row.favoriteColorTag)) result.favoriteColorTagPresent += 1;
    if (isPresent(row.colorTag)) result.colorTagPresent += 1;
    if (Array.isArray(row.sunoLinks) && row.sunoLinks.length > 0) result.sunoLinksNonEmpty += 1;
    if (isPresent(row.sunoShareUrl)) result.sunoShareUrlPresent += 1;
    if (isPresent(row.sunoUrl)) result.sunoUrlPresent += 1;
    if (isPresent(row.sunoSongUrl)) result.sunoSongUrlPresent += 1;
    const storedId = String(row.id || '').trim();
    if (storedId) {
      result.storedIdPresent += 1;
      if (storedId !== entry.doc.id) result.storedIdDiffersFromDocId += 1;
    }
  }
  return result;
};

const resolveTaskId = (row) => String(
  row?.taskId || row?.task_id || row?.meta?.taskId || row?.meta?.task_id
  || row?.sourceTaskId || row?.generationTaskId || row?.source?.taskId
  || row?.source?.task_id || row?.metadata?.taskId || row?.metadata?.task_id || ''
).trim();
const resolveTrackId = (row, docId = '') => String(
  row?.id || row?.trackId || row?.audioId || row?.sunoId || row?.source?.trackId
  || row?.source?.id || row?.metadata?.trackId || row?.metadata?.id || docId || ''
).trim();

(async () => {
  const favoritesSnap = await db.collection('favorites').get();
  const trackGroupSnap = await db.collectionGroup('tracks').get();

  const favoritesByUid = new Map();
  for (const doc of favoritesSnap.docs) {
    const data = doc.data() || {};
    const uid = String(data.uid || '').trim();
    if (!uid) continue;
    const bucket = favoritesByUid.get(uid) || [];
    bucket.push({ doc, data });
    favoritesByUid.set(uid, bucket);
  }

  const tracksByUid = new Map();
  for (const doc of trackGroupSnap.docs) {
    const uid = String(doc.ref.parent.parent?.id || '').trim();
    if (!uid) continue;
    const bucket = tracksByUid.get(uid) || [];
    bucket.push({ doc, data: doc.data() || {} });
    tracksByUid.set(uid, bucket);
  }

  const candidateUids = new Set([...favoritesByUid.keys(), ...tracksByUid.keys()]);
  let targetUid = '';
  let targetScore = -1;
  for (const uid of candidateUids) {
    const score = (favoritesByUid.get(uid)?.length || 0) + (tracksByUid.get(uid)?.length || 0) * 10;
    if (score > targetScore) {
      targetUid = uid;
      targetScore = score;
    }
  }
  if (!targetUid) throw new Error('No account with favorites/tracks found');

  const targetFavoriteEntries = favoritesByUid.get(targetUid) || [];
  const favoriteRows = targetFavoriteEntries.map((entry) => entry.data);
  const targetTrackEntries = tracksByUid.get(targetUid) || [];
  const trackRows = targetTrackEntries.map((entry) => entry.data);

  // Exact current generated Music Note query: 20 items, uid + createdAt desc.
  const favoritePage1 = await db.collection('favorites')
    .where('uid', '==', targetUid)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  const favoritePage2 = favoritePage1.size
    ? await db.collection('favorites')
      .where('uid', '==', targetUid)
      .orderBy('createdAt', 'desc')
      .startAfter(favoritePage1.docs[favoritePage1.docs.length - 1])
      .limit(20)
      .get()
    : null;

  // Exact current generated Library query: 10 generation-set docs per page.
  const tracksRef = db.collection('suno_tracks').doc(targetUid).collection('tracks');
  const libraryPage1 = await tracksRef.orderBy('createdAt', 'desc').limit(10).get();
  const libraryPage2 = libraryPage1.size
    ? await tracksRef.orderBy('createdAt', 'desc')
      .startAfter(libraryPage1.docs[libraryPage1.docs.length - 1])
      .limit(10)
      .get()
    : null;

  const musicBundle = await db.collection('user_list_caches').doc(targetUid)
    .collection('bundles').doc('music_note_latest_20').get();
  const libraryBundle = await db.collection('user_list_caches').doc(targetUid)
    .collection('bundles').doc('library_latest_10_sets').get();
  const musicBundleData = musicBundle.exists ? (musicBundle.data() || {}) : {};
  const libraryBundleData = libraryBundle.exists ? (libraryBundle.data() || {}) : {};

  const favoriteEntriesSorted = [...targetFavoriteEntries].sort((a, b) => {
    const aMs = Number(a.data?.createdAtMs || 0) || toMs(a.data?.createdAt);
    const bMs = Number(b.data?.createdAtMs || 0) || toMs(b.data?.createdAt);
    return bMs - aMs;
  });
  const favoriteLatest20Entries = favoriteEntriesSorted.slice(0, 20);
  const favoriteOlderEntries = favoriteEntriesSorted.slice(20);

  const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  let olderThan14Days = 0;
  let olderRecoverable = 0;
  let olderWithPlayableUrl = 0;
  for (const entry of targetTrackEntries) {
    const row = entry.data;
    const createdAtMs = Number(row?.createdAtMs || 0) || toMs(row?.createdAt);
    if (!(createdAtMs > 0 && createdAtMs < cutoffMs)) continue;
    olderThan14Days += 1;
    if (resolveTaskId(row) && resolveTrackId(row, entry.doc.id)) olderRecoverable += 1;
    const items = Array.isArray(row?.sunoData) ? row.sunoData : [];
    const hasUrl = Boolean(row?.audioUrl || row?.audio_url || row?.url)
      || items.some((item) => Boolean(item?.audio_url || item?.audioUrl || item?.url || item?.stream_audio_url));
    if (hasUrl) olderWithPlayableUrl += 1;
  }

  console.log(JSON.stringify({
    mode: 'READ_ONLY_PAGINATION_DIAGNOSTIC',
    projectId: PROJECT_ID,
    targetSelection: 'largest_tracks_plus_favorites_account_no_uid_output',
    favorites: tallyFields(favoriteRows, ['createdAt', 'createdAtMs', 'updatedAtMs', 'taskId', 'trackId']),
    favoriteMetadata: {
      all: tallyFavoriteMetadata(targetFavoriteEntries),
      latest20: tallyFavoriteMetadata(favoriteLatest20Entries),
      olderAfter20: tallyFavoriteMetadata(favoriteOlderEntries),
    },
    tracks: tallyFields(trackRows, ['createdAt', 'createdAtMs', 'taskId', 'trackId', 'sourceTaskId', 'sourceId']),
    musicNotePaging: {
      page1Count: favoritePage1.size,
      page2Count: favoritePage2?.size || 0,
      page1SuggestsMore: favoritePage1.size >= 20,
      page2SuggestsMore: (favoritePage2?.size || 0) >= 20,
    },
    libraryPaging: {
      page1Count: libraryPage1.size,
      page2Count: libraryPage2?.size || 0,
      page1SuggestsMore: libraryPage1.size >= 10,
      page2SuggestsMore: (libraryPage2?.size || 0) >= 10,
    },
    bundles: {
      musicNote: {
        exists: musicBundle.exists,
        itemCount: Array.isArray(musicBundleData.items) ? musicBundleData.items.length : Number(musicBundleData.itemCount || 0),
        hasMore: Boolean(musicBundleData.hasMore),
        cursorPresent: Number(musicBundleData.cursorCreatedAtMs || 0) > 0,
      },
      library: {
        exists: libraryBundle.exists,
        itemCount: Array.isArray(libraryBundleData.items) ? libraryBundleData.items.length : Number(libraryBundleData.itemCount || 0),
        hasMore: Boolean(libraryBundleData.hasMore),
        cursorPresent: Number(libraryBundleData.cursorCreatedAtMs || 0) > 0,
      },
    },
    olderThan14Days: {
      total: olderThan14Days,
      recoveryIdentifiersResolvable: olderRecoverable,
      currentlyHasPlayableUrl: olderWithPlayableUrl,
    },
  }, null, 2));
})().catch((error) => {
  console.error('diagnose-legacy-pagination-readonly failed:', error?.stack || error?.message || String(error));
  process.exit(1);
});
