from pathlib import Path

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

# 1) Recent Studio heart toggles can trust the local Music Note identity only when
# the local payload/version is current. In that common case there is no reason to
# spend a duplicate-check read before creating the favorite.
old_sig = "  const toggleFavorite = async (song: SongResult) => {"
new_sig = "  const toggleFavorite = async (song: SongResult, options?: { trustedRecentStudio?: boolean }) => {"
if app.count(old_sig) != 1:
    raise SystemExit(f'toggleFavorite signature anchor count={app.count(old_sig)}')
app = app.replace(old_sig, new_sig, 1)

old_lookup = """      const localExistingFav = findLocalExistingFavorite();
      const serverExistingFav = (localExistingFav || (song as any)?.recentFavoriteDetachedAt) ? null : await findServerExistingFavorite().catch((error) => {
        console.warn('Favorite server confirmation failed. Using local favorite state as fallback.', error);
        return null;
      });
      const existingFav = localExistingFav || serverExistingFav;
"""
new_lookup = """      const localExistingFav = findLocalExistingFavorite();
      const stableRecentSongId = getLiveSoridrawSongId(song);
      const localMusicNoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, user.uid);
      const remoteMusicNoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, user.uid);
      const canTrustRecentStudioLocalIdentity = Boolean(
        options?.trustedRecentStudio
        && stableRecentSongId
        && hasMusicNotePayloadCache(user.uid)
        && localMusicNoteVersion > 0
        && remoteMusicNoteVersion <= localMusicNoteVersion
      );
      const serverExistingFav = (
        localExistingFav
        || (song as any)?.recentFavoriteDetachedAt
        || canTrustRecentStudioLocalIdentity
      ) ? null : await findServerExistingFavorite().catch((error) => {
        console.warn('Favorite server confirmation failed. Using local favorite state as fallback.', error);
        return null;
      });
      const existingFav = localExistingFav || serverExistingFav;
"""
if app.count(old_lookup) != 1:
    raise SystemExit(f'server lookup anchor count={app.count(old_lookup)}')
app = app.replace(old_lookup, new_lookup, 1)

# Deterministic recent-song favorite ids make the zero-read fresh-cache save path
# idempotent across concurrent devices. Legacy/stale paths keep the existing
# bounded server check + random addDoc behavior.
insert_anchor = """      const createdAtMs = Date.now();
      song = ensureLiveSoridrawSongId(song as any) as SongResult;
      const favoriteSoridrawSongId = getLiveSoridrawSongId(song);
"""
insert_replacement = """      const createdAtMs = Date.now();
      song = ensureLiveSoridrawSongId(song as any) as SongResult;
      const favoriteSoridrawSongId = getLiveSoridrawSongId(song);
      const buildRecentFavoriteDocumentId = (uid: string, stableSongId: string): string => {
        const raw = `${uid}|${stableSongId}`;
        let hash = 2166136261;
        for (let index = 0; index < raw.length; index += 1) {
          hash ^= raw.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        const safeSongId = stableSongId.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 72) || 'song';
        return `rs_${safeSongId}_${(hash >>> 0).toString(36)}`;
      };
"""
if app.count(insert_anchor) != 1:
    raise SystemExit(f'deterministic id insert anchor count={app.count(insert_anchor)}')
app = app.replace(insert_anchor, insert_replacement, 1)

old_write = """      const favoriteDocRef = await runV1MutationBoundary({ domain: 'musicNote', operation: 'save', uid: user.uid, affectedCount: 1 }, addDoc(collection(db, 'favorites'), favoritePayload));

      const localFavorite = sanitizeForFirestore({
"""
new_write = """      const useDeterministicRecentFavoriteDoc = Boolean(
        canTrustRecentStudioLocalIdentity && favoriteSoridrawSongId
      );
      const favoriteDocRef = useDeterministicRecentFavoriteDoc
        ? doc(db, 'favorites', buildRecentFavoriteDocumentId(user.uid, favoriteSoridrawSongId))
        : null;
      if (favoriteDocRef) {
        await runV1MutationBoundary(
          { domain: 'musicNote', operation: 'save', uid: user.uid, documentIds: [favoriteDocRef.id], affectedCount: 1 },
          setDoc(favoriteDocRef, favoritePayload, { merge: false }),
        );
      }
      const createdFavoriteDocRef = favoriteDocRef || await runV1MutationBoundary(
        { domain: 'musicNote', operation: 'save', uid: user.uid, affectedCount: 1 },
        addDoc(collection(db, 'favorites'), favoritePayload),
      );

      const localFavorite = sanitizeForFirestore({
"""
if app.count(old_write) != 1:
    raise SystemExit(f'favorite write anchor count={app.count(old_write)}')
app = app.replace(old_write, new_write, 1)
app = app.replace("        id: favoriteDocRef.id,\n        firestoreId: favoriteDocRef.id,", "        id: createdFavoriteDocRef.id,\n        firestoreId: createdFavoriteDocRef.id,", 1)

# 2) The Recent-song server document must not be rewritten merely because the
# heart state changed. favoriteFirestoreId is a local UI link and stable song id
# can rebuild it. Only an already-pending real text edit is flushed by the heart.
call_old = "      await toggleFavorite(heartSnapshot as SongResult);"
call_new = "      await toggleFavorite(heartSnapshot as SongResult, { trustedRecentStudio: true });"
if app.count(call_old) != 1:
    raise SystemExit(f'trusted recent call anchor count={app.count(call_old)}')
app = app.replace(call_old, call_new, 1)

old_recent_flush = """          recentSongTextWritePendingRef.current = {
            uid: user.uid,
            songs: nextCommittedHistory,
            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',
            mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),
          };
          await flushRecentSongTextWrite();
"""
new_recent_flush = """          const pendingRecentTextWrite = recentSongTextWritePendingRef.current;
          if (pendingRecentTextWrite) {
            // A real title/lyrics edit was already waiting to be committed.
            // Keep heart as that edit's commit boundary, but do not create a
            // user_recent_songs write for a plain save/unsave click.
            recentSongTextWritePendingRef.current = {
              ...pendingRecentTextWrite,
              uid: user.uid,
              songs: nextCommittedHistory,
              mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),
            };
            await flushRecentSongTextWrite();
          }
"""
if app.count(old_recent_flush) != 1:
    raise SystemExit(f'recent heart flush anchor count={app.count(old_recent_flush)}')
app = app.replace(old_recent_flush, new_recent_flush, 1)

app_path.write_text(app, encoding='utf-8')

# 3) Diagnostic accuracy: Firestore listeners first emit local optimistic events
# with hasPendingWrites=true. Those are not server reads and must not inflate the
# browser SDK read counter. Count the later acknowledged server snapshot only.
measured_path = Path('src/lib/firestoreMeasured.ts')
measured = measured_path.read_text(encoding='utf-8')
old_listener = """const recordListenerSnapshot = (snapshot: any, state: ListenerState) => {
  if (snapshot?.metadata?.fromCache === true) {
"""
new_listener = """const recordListenerSnapshot = (snapshot: any, state: ListenerState) => {
  if (snapshot?.metadata?.hasPendingWrites === true) {
    return;
  }
  if (snapshot?.metadata?.fromCache === true) {
"""
if measured.count(old_listener) != 1:
    raise SystemExit(f'listener measurement anchor count={measured.count(old_listener)}')
measured = measured.replace(old_listener, new_listener, 1)
measured_path.write_text(measured, encoding='utf-8')

print('Applied 1008 Music Note save/unsave IO reduction.')
