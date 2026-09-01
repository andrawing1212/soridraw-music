from pathlib import Path

path = Path('src/App.tsx')
s = path.read_text(encoding='utf-8')

anchor = """      const matches = new Map<string, any>();
      const addCandidates = (candidates: any[]) => {
"""
replacement = """      const matches = new Map<string, any>();
      // 1007 — Recent-song saves already carry a stable SORIDRAW song id.
      // Use that exact identity first so a normal save needs only one bounded
      // server duplicate check instead of chaining favoriteKey + title lookups.
      const stableSongId = getLiveSoridrawSongId(song);
      const addCandidates = (candidates: any[]) => {
"""
if s.count(anchor) != 1:
    raise SystemExit(f'candidate anchor count={s.count(anchor)}')
s = s.replace(anchor, replacement, 1)

exact_block = """      if (exactFavoriteId) {
        try {
          const exactSnap = await getDoc(doc(db, 'favorites', exactFavoriteId));
          if (exactSnap.exists()) addCandidates([mapFavoriteFirestoreDoc(exactSnap)]);
        } catch (error) {
          console.warn('Exact favorite lookup failed.', error);
        }
      }

"""
stable_block = exact_block + """      if (matches.size === 0 && stableSongId) {
        let stableLookupSucceeded = false;
        try {
          const stableSnap = await getDocs(query(
            collection(db, 'favorites'),
            where('uid', '==', user.uid),
            where('soridrawSongId', '==', stableSongId),
            limit(2),
          ));
          stableLookupSucceeded = true;
          addCandidates(stableSnap.docs.map(mapFavoriteFirestoreDoc));
        } catch (error) {
          // Preserve the older bounded identity/title fallback only when the
          // stable-id query itself could not be completed.
          console.warn('Favorite stable song id lookup failed; using legacy bounded fallback.', error);
        }
        if (stableLookupSucceeded) return Array.from(matches.values());
      }

"""
if s.count(exact_block) != 1:
    raise SystemExit(f'exact lookup anchor count={s.count(exact_block)}')
s = s.replace(exact_block, stable_block, 1)

path.write_text(s, encoding='utf-8')
