const admin = require('firebase-admin');

const PROJECT_ID = 'soridraw-app-866a5';
const APPLY = process.argv.includes('--apply');
const uidArg = process.argv.find((arg) => arg.startsWith('--uid='));
const requestedUid = uidArg ? String(uidArg.slice('--uid='.length)).trim() : '';
const ELIGIBILITY_VERSION = 1;
const BUNDLE_LIMIT = 20;
const BATCH_LIMIT = 400;
const BUNDLE_MAX_BYTES = 850000;

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const toMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1000000);
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isSoftRemoved = (row = {}) => Boolean(
  row.favoriteRemoved === true
  || row.saved === false
  || row.favoriteRemovedAt
  || row.unlikedAt
  || row.unsavedAt
);

const isUiHidden = (row = {}) => Boolean(
  isSoftRemoved(row)
  || row.hidden === true
  || row.favoriteHidden === true
  || row.deletedAt
  || row.trashedAt
);

const isSharedNote = (row = {}) => Boolean(
  row.isSharedMusicNote === true
  || row.sharedReadOnly === true
  || String(row.sourceType || '') === 'shared_music_note'
  || Boolean(row.sharedNoteShareId)
);

// Keep this classifier identical to the read-only diagnostic that established
// the accepted My Note / Shared Note baseline.
const isMyNoteVisible = (row = {}) => !isUiHidden(row) && !isSharedNote(row);

const HISTORY_KEYS = new Set([
  'lyricRevisions',
  'lyricsHistory',
  'lyricHistory',
  'revisionHistory',
  'editHistory',
]);

const cleanValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value === null ? null : undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value?.toMillis === 'function') return value;
  if (Array.isArray(value)) return value.map((entry) => cleanValue(entry, depth + 1)).filter((entry) => entry !== undefined);
  if (typeof value !== 'object' || depth > 12) return undefined;
  const next = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (HISTORY_KEYS.has(key)) return;
    const cleaned = cleanValue(entry, depth + 1);
    if (cleaned !== undefined) next[key] = cleaned;
  });
  return next;
};

const jsonBytes = (value) => Buffer.byteLength(JSON.stringify(value, (_key, entry) => {
  if (entry && typeof entry?.toMillis === 'function') return entry.toMillis();
  return entry;
}), 'utf8');

const selectTargetUid = async () => {
  if (requestedUid) return requestedUid;
  if (APPLY) {
    throw new Error('Safety stop: --apply requires an explicit --uid=<uid>. Dry-run may auto-select the diagnostic target.');
  }

  const usersSnap = await db.collection('users').get();
  let targetUid = '';
  let largestFavoriteCount = -1;
  for (const doc of usersSnap.docs) {
    const count = Number(doc.data()?.favoriteCount || 0);
    if (count > largestFavoriteCount) {
      largestFavoriteCount = count;
      targetUid = doc.id;
    }
  }
  if (!targetUid) throw new Error('No diagnostic target account found.');
  return targetUid;
};

const commitPatches = async (patches) => {
  for (let offset = 0; offset < patches.length; offset += BATCH_LIMIT) {
    const chunk = patches.slice(offset, offset + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach(({ ref, update }) => batch.set(ref, update, { merge: true }));
    await batch.commit();
  }
};

(async () => {
  const uid = await selectTargetUid();
  const favoritesSnap = await db.collection('favorites').where('uid', '==', uid).get();
  const entries = favoritesSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }));

  const patches = [];
  const unsafeActiveIds = [];
  const normalizedEntries = entries.map((entry) => {
    const eligible = isMyNoteVisible(entry.data);
    const existingCreatedAtMs = Number(entry.data.createdAtMs || 0);
    const derivedCreatedAtMs = existingCreatedAtMs > 0 ? existingCreatedAtMs : toMs(entry.data.createdAt);
    const update = {};

    if (entry.data.musicNoteListEligible !== eligible) {
      update.musicNoteListEligible = eligible;
    }
    if (existingCreatedAtMs <= 0 && derivedCreatedAtMs > 0) {
      update.createdAtMs = derivedCreatedAtMs;
    }
    if (eligible && derivedCreatedAtMs <= 0) {
      unsafeActiveIds.push(entry.id);
    }
    if (Object.keys(update).length > 0) patches.push({ ref: entry.ref, update });

    return {
      ...entry,
      eligible,
      createdAtMs: derivedCreatedAtMs,
      normalizedData: {
        ...entry.data,
        ...update,
        musicNoteListEligible: eligible,
        ...(derivedCreatedAtMs > 0 ? { createdAtMs: derivedCreatedAtMs } : {}),
      },
    };
  });

  const active = normalizedEntries
    .filter((entry) => entry.eligible)
    .sort((a, b) => {
      if (b.createdAtMs !== a.createdAtMs) return b.createdAtMs - a.createdAtMs;
      return b.id.localeCompare(a.id);
    });
  const sharedVisible = normalizedEntries.filter((entry) => !isUiHidden(entry.data) && isSharedNote(entry.data));
  const inactive = normalizedEntries.filter((entry) => !entry.eligible);
  const latest20 = active.slice(0, BUNDLE_LIMIT);

  const bundleItems = latest20.map((entry) => cleanValue({
    ...entry.normalizedData,
    id: entry.normalizedData?.id || entry.id,
    firestoreId: entry.id,
  })).filter(Boolean);
  const lastBundleItem = latest20[latest20.length - 1] || null;
  const bundlePayload = {
    schemaVersion: 2,
    eligibilityVersion: ELIGIBILITY_VERSION,
    kind: 'musicNote',
    items: bundleItems,
    itemCount: bundleItems.length,
    cursorCreatedAtMs: lastBundleItem?.createdAtMs || 0,
    cursorId: lastBundleItem?.id || '',
    hasMore: active.length > BUNDLE_LIMIT,
    deletedIds: [],
    updatedAtMs: Date.now(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const bundleBytes = jsonBytes(bundlePayload);

  const report = {
    mode: APPLY ? 'APPLY_REQUESTED' : 'DRY_RUN',
    projectId: PROJECT_ID,
    targetSelection: requestedUid ? 'explicit_uid' : 'largest_profile_favoriteCount_diagnostic_target',
    totalFavoriteDocs: entries.length,
    activeMyNoteCount: active.length,
    sharedVisibleCount: sharedVisible.length,
    inactiveOrSharedCount: inactive.length,
    favoriteDocsNeedingMetadataPatch: patches.length,
    activeDocsWithoutRecoverableCreatedAtMs: unsafeActiveIds.length,
    latestBundleItemCount: bundleItems.length,
    bundleBytes,
    userProfileWritesPlanned: 1,
    bundleWritesPlanned: 1,
    contentFieldsModified: 0,
    deletesPlanned: 0,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log('DRY RUN ONLY: no Firestore writes, deletes, index deploys, Functions deploys, or Hosting deploys were performed.');
    return;
  }

  if (unsafeActiveIds.length > 0) {
    throw new Error(`Safety stop: ${unsafeActiveIds.length} active My Note documents have no recoverable createdAtMs.`);
  }
  if (bundleBytes > BUNDLE_MAX_BYTES) {
    throw new Error(`Safety stop: latest-20 bundle is ${bundleBytes} bytes, above ${BUNDLE_MAX_BYTES}.`);
  }
  if (active.length === 0) {
    throw new Error('Safety stop: active My Note classification returned zero rows.');
  }

  // Phase 1: additive per-document metadata only. No song content is overwritten.
  await commitPatches(patches);

  // Phase 2: rebuild the one-document latest-20 bundle from classified active rows.
  const bundleRef = db.collection('user_list_caches').doc(uid).collection('bundles').doc('music_note_latest_20');
  await bundleRef.set(bundlePayload, { merge: false });

  // Phase 3 LAST: publish count + migration readiness only after all metadata and
  // the bundle succeeded. The 986 client will therefore never switch early.
  await db.collection('users').doc(uid).set({
    musicNoteCount: active.length,
    musicNoteListEligibilityVersion: ELIGIBILITY_VERSION,
    musicNoteListEligibilityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(JSON.stringify({
    result: 'APPLIED',
    favoriteMetadataWrites: patches.length,
    musicNoteCount: active.length,
    sharedVisibleCount: sharedVisible.length,
    bundleItemCount: bundleItems.length,
    safety: 'additive metadata + aggregate bundle/profile only; no favorite document deletes and no song content-field writes',
  }, null, 2));
})().catch((error) => {
  console.error('backfill-music-note-list-eligibility failed:', error?.stack || error?.message || String(error));
  process.exit(1);
});
