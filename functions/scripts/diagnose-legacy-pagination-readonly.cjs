const admin = require('firebase-admin');

const PROJECT_ID = 'soridraw-app-866a5';
if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const isPresent = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const tallyFields = (rows, fields) => {
  const result = { total: rows.length };
  for (const field of fields) {
    let present = 0;
    for (const row of rows) {
      if (isPresent(row[field])) present += 1;
    }
    result[`${field}Present`] = present;
    result[`${field}Missing`] = rows.length - present;
  }
  return result;
};

(async () => {
  const favoritesSnap = await db.collection('favorites').get();
  const favoriteRows = favoritesSnap.docs.map((doc) => doc.data() || {});

  const tracksSnap = await db.collectionGroup('tracks').get();
  const trackRows = tracksSnap.docs.map((doc) => doc.data() || {});

  const favorites = tallyFields(favoriteRows, [
    'createdAt',
    'createdAtMs',
    'updatedAtMs',
    'taskId',
    'trackId',
  ]);

  const tracks = tallyFields(trackRows, [
    'createdAt',
    'createdAtMs',
    'taskId',
    'trackId',
    'sourceTaskId',
    'sourceId',
  ]);

  console.log(JSON.stringify({
    mode: 'READ_ONLY_COUNT_ONLY',
    projectId: PROJECT_ID,
    favorites,
    tracks,
  }, null, 2));
})().catch((error) => {
  console.error('diagnose-legacy-pagination-readonly failed:', error?.message || String(error));
  process.exit(1);
});
