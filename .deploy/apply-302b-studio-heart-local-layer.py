from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text(encoding="utf-8")

def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"app302b {label}: expected 1 match, got {count}")
    text = text.replace(old, new, 1)

replace_once(
"""  const setFavorites = useCallback((list: any[] | ((prev: any[]) => any[])) => {
    const current = favoritesStore.getFavorites();
    const resolved = typeof list === 'function' ? list(current) : list;
    const uid = String(user?.uid || auth.currentUser?.uid || '').trim();
    favoritesStore.setFavorites(
      uid ? overlayStudioHeartPendingIntentsOnFavorites(uid, resolved) : resolved,
    );
  }, [user?.uid]);
""",
"""  const setFavorites = useCallback((list: any[] | ((prev: any[]) => any[])) => {
    const uid = String(user?.uid || auth.currentUser?.uid || '').trim();
    const current = favoritesStore.getFavorites();
    const canonicalCurrent = uid
      ? stripStudioHeartPendingLayerFromFavorites(uid, current)
      : current;
    const resolved = typeof list === 'function' ? list(canonicalCurrent) : list;
    favoritesStore.setFavorites(
      uid ? overlayStudioHeartPendingIntentsOnFavorites(uid, resolved) : resolved,
    );
  }, [user?.uid]);
""",
"favorites adapter canonical base",
)

replace_once(
"""  function overlayStudioHeartPendingIntentsOnFavorites(uid: string, list: any[]): any[] {
    const safeUid = String(uid || '').trim();
    let next = Array.isArray(list) ? [...list] : [];
    if (!safeUid) return next;

    const pending = listStudioHeartPendingIntents(safeUid)
""",
"""  function stripStudioHeartPendingLayerFromFavorites(uid: string, list: any[]): any[] {
    const safeUid = String(uid || '').trim();
    const source = Array.isArray(list) ? list : [];
    if (!safeUid) return [...source];

    const pendingById = new Map(
      listStudioHeartPendingIntents(safeUid)
        .map((intent) => [String(intent.documentId || '').trim(), intent] as const),
    );
    const next: any[] = [];

    for (const favorite of source) {
      if (favorite?.__studioHeartPendingLocal !== true) {
        next.push(favorite);
        continue;
      }

      const documentId = String(favorite?.firestoreId || favorite?.id || '').trim();
      const intent = pendingById.get(documentId);
      if (intent?.baselineSaved && intent.baselineFavorite) {
        const restored = { ...intent.baselineFavorite };
        delete restored.__studioHeartPendingLocal;
        next.push(restored);
      }
    }

    return sortFavoriteList(next);
  }

  function overlayStudioHeartPendingIntentsOnFavorites(uid: string, list: any[]): any[] {
    const safeUid = String(uid || '').trim();
    let next = stripStudioHeartPendingLayerFromFavorites(safeUid, list);
    if (!safeUid) return next;

    const pending = listStudioHeartPendingIntents(safeUid)
""",
"pending layer strip helper",
)

replace_once(
"""  const removeStudioHeartIntentLocal = (uid: string, documentId: string) => {
    clearStudioHeartIntentTimer(documentId);
    removeStudioHeartPendingIntent(uid, documentId);
  };
""",
"""  const removeStudioHeartIntentLocal = (uid: string, documentId: string) => {
    clearStudioHeartIntentTimer(documentId);
    removeStudioHeartPendingIntent(uid, documentId);
    setFavorites((previous) => previous);
  };
""",
"pending layer cleanup",
)

replace_once(
"""    if (intent.desiredSaved === intent.baselineSaved) {
      removeStudioHeartPendingIntent(uid, safeDocumentId);
      return;
    }
""",
"""    if (intent.desiredSaved === intent.baselineSaved) {
      removeStudioHeartIntentLocal(uid, safeDocumentId);
      return;
    }
""",
"net-zero cleanup",
)

replace_once(
"""      if (latest && latest.updatedAtMs === intent.updatedAtMs && latest.desiredSaved === intent.desiredSaved) {
        removeStudioHeartPendingIntent(uid, safeDocumentId);
      }
""",
"""      if (latest && latest.updatedAtMs === intent.updatedAtMs && latest.desiredSaved === intent.desiredSaved) {
        removeStudioHeartIntentLocal(uid, safeDocumentId);
      }
""",
"canonical success cleanup",
)

path.write_text(text, encoding="utf-8")
print("APP302B_PATCH=PASS")
