from pathlib import Path
import json

app_path = Path("src/App.tsx")
text = app_path.read_text(encoding="utf-8")

def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"app302 {label}: expected 1 match, got {count}")
    text = text.replace(old, new, 1)

replace_once(
"""  publishMusicNoteSaveStateDelta,
  publishMusicNoteHeartPreviewDelta,
  publishRecentSongEditPreviewDelta,""",
"""  publishMusicNoteSaveStateDelta,
  publishRecentSongEditPreviewDelta,""",
"remove initiating heart preview import",
)

replace_once(
"""  // Decoupled favorites store adapter to prevent Studio UI from re-rendering when favorites change
  const setFavorites = useCallback((list: any[] | ((prev: any[]) => any[])) => {
    if (typeof list === 'function') {
      const current = favoritesStore.getFavorites();
      favoritesStore.setFavorites(list(current));
    } else {
      favoritesStore.setFavorites(list);
    }
  }, []);
""",
"""  // Decoupled favorites store adapter to prevent Studio UI from re-rendering when favorites change.
  // app302: Studio-heart pending intent is an initiating-device-only optimistic layer.
  const setFavorites = useCallback((list: any[] | ((prev: any[]) => any[])) => {
    const current = favoritesStore.getFavorites();
    const resolved = typeof list === 'function' ? list(current) : list;
    const uid = String(user?.uid || auth.currentUser?.uid || '').trim();
    favoritesStore.setFavorites(
      uid ? overlayStudioHeartPendingIntentsOnFavorites(uid, resolved) : resolved,
    );
  }, [user?.uid]);
""",
"local optimistic favorites adapter",
)

replace_once(
"""  const isFavoriteHidden = (favorite: any) => Boolean(
    isFavoriteSoftRemoved(favorite)
    || favorite?.hidden === true
    || favorite?.favoriteHidden === true
    || favorite?.deletedAt
    || favorite?.trashedAt
  );

""",
"""  const isFavoriteHidden = (favorite: any) => Boolean(
    isFavoriteSoftRemoved(favorite)
    || favorite?.hidden === true
    || favorite?.favoriteHidden === true
    || favorite?.deletedAt
    || favorite?.trashedAt
  );

  function overlayStudioHeartPendingIntentsOnFavorites(uid: string, list: any[]): any[] {
    const safeUid = String(uid || '').trim();
    let next = Array.isArray(list) ? [...list] : [];
    if (!safeUid) return next;

    const pending = listStudioHeartPendingIntents(safeUid)
      .slice()
      .sort((left, right) => left.updatedAtMs - right.updatedAtMs);

    for (const intent of pending) {
      const documentId = String(intent.documentId || '').trim();
      if (!documentId) continue;

      next = next.filter((favorite: any) => (
        String(favorite?.firestoreId || favorite?.id || '').trim() !== documentId
      ));

      if (!intent.desiredSaved) continue;

      const source = normalizeFavoriteTitleFields({
        ...(intent.baselineFavorite || {}),
        ...(intent.song || {}),
      } as any) as any;
      const createdAtMs = Number(
        intent.baselineFavorite?.createdAtMs
        || source?.createdAtMs
        || 0,
      ) || Math.max(1, Number(intent.updatedAtMs || Date.now()));
      const optimisticFavorite = {
        ...source,
        id: documentId,
        firestoreId: documentId,
        uid: safeUid,
        saved: true,
        hidden: false,
        favoriteHidden: false,
        favoriteRemoved: false,
        favoriteRemovedAt: null,
        unsavedAt: null,
        unlikedAt: null,
        deletedAt: null,
        trashedAt: null,
        isPublic: source?.isPublic === true,
        isLocked: source?.isLocked === true,
        createdAtMs,
        updatedAtMs: Math.max(createdAtMs, Number(intent.updatedAtMs || Date.now())),
        favoriteKey: source?.favoriteKey || buildFavoriteIdentityKey(source),
        searchTokens: source?.searchTokens || buildFavoriteSearchTokens(source),
        __studioHeartPendingLocal: true,
      };

      next = mergeFavoritePages([optimisticFavorite], next);
    }

    return sortFavoriteList(next);
  }

""",
"pending Music Note overlay helper",
)

replace_once(
"""                const localNewer = previous.filter((favorite: any) => {
                  if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
                  const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
""",
"""                const localNewer = previous.filter((favorite: any) => {
                  if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
                  if (favorite?.__studioHeartPendingLocal === true) return false;
                  const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
""",
"catalog merge guard",
)

replace_once(
"""      const localNewer = (Array.isArray(previous) ? previous : []).filter((favorite: any) => {
        if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
        const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
""",
"""      const localNewer = (Array.isArray(previous) ? previous : []).filter((favorite: any) => {
        if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
        if (favorite?.__studioHeartPendingLocal === true) return false;
        const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
""",
"manual sync merge guard",
)

replace_once(
"""    writeStudioHeartPendingIntent(intent);
    scheduleStudioHeartPendingIntent(safeDocumentId);

    rememberRecentHeartAuthority(uid, intent.song, desiredSaved, safeDocumentId, now);
    void publishMusicNoteHeartPreviewDelta(uid, safeDocumentId, intent.song, desiredSaved)
      .then((version) => {
        if (version > 0) rememberStudioHeartPreviewVersion(uid, safeDocumentId, version, desiredSaved, now);
      })
      .catch((error) => console.warn('Studio heart live preview unavailable.', error));
    return true;
""",
"""    writeStudioHeartPendingIntent(intent);
    scheduleStudioHeartPendingIntent(safeDocumentId);

    // app302 option-2:
    // this device gets immediate local Music Note visibility, while another
    // device waits for the successful canonical mutation after latest click +30s.
    // Same-song clicks keep the original canonical baseline and replace only
    // desiredSaved, so final == baseline still settles at W0.
    rememberRecentHeartAuthority(uid, intent.song, desiredSaved, safeDocumentId, now);
    setFavorites((previous) => previous);
    return true;
""",
"remove pre-canonical RTDB preview",
)

replace_once(
"""    for (const intent of listStudioHeartPendingIntents(uid)) {
      const age = Math.max(0, Date.now() - intent.updatedAtMs);
      const delay = Math.max(1_000, STUDIO_HEART_BATCH_MS - age);
      scheduleStudioHeartPendingIntent(intent.documentId, delay);
    }
    return () => {
""",
"""    const pendingIntents = listStudioHeartPendingIntents(uid);
    for (const intent of pendingIntents) {
      const age = Math.max(0, Date.now() - intent.updatedAtMs);
      const delay = Math.max(1_000, STUDIO_HEART_BATCH_MS - age);
      scheduleStudioHeartPendingIntent(intent.documentId, delay);
    }
    if (pendingIntents.length > 0) {
      setFavorites((previous) => previous);
    }
    return () => {
""",
"reload pending overlay recovery",
)

old_comment = """    // app286 — The latest per-song RTDB heart state outranks stale device-local
    // Recent/Music Note cache. This keeps the visual state and the next click
    // direction identical on both devices even if historical duplicate rows exist."""
if old_comment in text:
    text = text.replace(
        old_comment,
        """    // Canonical RTDB heart state from another device outranks stale device-local
    // Recent/Music Note cache. app302 no longer emits pre-canonical Studio-heart
    // previews; legacy preview signals remain readable during mixed-version rollout.""",
        1,
    )

app_path.write_text(text, encoding="utf-8")

version_path = Path("public/app-version.json")
version = json.loads(version_path.read_text(encoding="utf-8"))
version["version"] = 302
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("APP302_PATCH=PASS")
