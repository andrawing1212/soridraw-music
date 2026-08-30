from pathlib import Path
import re

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_MUSIC_NOTE_LIGHTWEIGHT_CARD_STATE_960'

if marker in text:
    print('apply-960: already applied')
    raise SystemExit(0)

if '// SORIDRAW_EXPLORE_8E4_PERSONAL_LIKE_FIX_959' not in text:
    raise RuntimeError('apply-960: apply-959 must run first')
if 'const SORIDRAW_934_MUSIC_NOTE_FOLDER_SHARED_LISTENER = true;' not in text:
    raise RuntimeError('apply-960: shared user_structures listener from 934 is required')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-960: anchor not found: {label}')
    text = text.replace(old, new, 1)


# 1) All lock reads inside FavoritesPage now resolve through the lightweight card-state layer.
# Do this before inserting the new helper implementation so the helper's legacy fallback remains intact.
text = re.sub(
    r'\b([A-Za-z_][A-Za-z0-9_]*)\.isLocked\b',
    r'isMusicNoteCardLocked(\1)',
    text,
)

# 2) Remove the temporary Explore-social-like client wiring from the Music Note page.
# Explore social likes remain available for 8-E-5 in the dedicated Explore UI, but the Music Note
# card button is strictly a personal local-first state.
text = text.replace("import { getExploreLikedTrackIds, setExploreTrackLike } from '../services/exploreLikeService';\n", '', 1)
text = text.replace(
    "  const [exploreLikedTrackIds, setExploreLikedTrackIds] = useState<Record<string, boolean>>({});\n"
    "  const [exploreLikeBusySourceId, setExploreLikeBusySourceId] = useState<string | null>(null);\n",
    '',
    1,
)

social_start = text.find('  const getFavoriteExploreTrackId = (song: any) => {')
social_end = text.find('  const executeFavoriteMenuAction = (action:', social_start)
if social_start >= 0 and social_end > social_start:
    text = text[:social_start] + text[social_end:]

# 3) Module-level lightweight state helpers. Reuse the already-existing user_structures document
# and its one SPA listener. No new collection, no new listener, no users/favorites writes.
module_anchor = 'const SORIDRAW_934_MUSIC_NOTE_FOLDER_SHARED_LISTENER = true;\n'
module_block = r'''

type MusicNoteCardStateItem = {
  liked: boolean;
  locked: boolean;
  updatedAtMs: number;
};

type MusicNoteCardStateSnapshot = {
  schemaVersion: 1;
  items: Record<string, MusicNoteCardStateItem>;
  updatedAtMs: number;
};

const MUSIC_NOTE_CARD_STATE_STORAGE_BASE = 'soridraw_music_note_card_state_v1';
const MUSIC_NOTE_CARD_STATE_WRITE_DELAY_MS = 1200;
const EMPTY_MUSIC_NOTE_CARD_STATE: MusicNoteCardStateSnapshot = {
  schemaVersion: 1,
  items: {},
  updatedAtMs: 0,
};

const getMusicNoteCardStateStorageKey = (uid: string) => `${MUSIC_NOTE_CARD_STATE_STORAGE_BASE}_${uid}`;

const normalizeMusicNoteCardState = (value: any): MusicNoteCardStateSnapshot => {
  const rawItems = value && typeof value?.items === 'object' && value.items ? value.items : {};
  const items: Record<string, MusicNoteCardStateItem> = {};
  Object.entries(rawItems).forEach(([id, raw]: [string, any]) => {
    const normalizedId = String(id || '').trim();
    if (!normalizedId || !raw || typeof raw !== 'object') return;
    items[normalizedId] = {
      liked: Boolean(raw.liked),
      locked: Boolean(raw.locked),
      updatedAtMs: Number(raw.updatedAtMs || 0),
    };
  });
  return {
    schemaVersion: 1,
    items,
    updatedAtMs: Number(value?.updatedAtMs || 0),
  };
};

const mergeMusicNoteCardStateSnapshots = (
  first: MusicNoteCardStateSnapshot,
  second: MusicNoteCardStateSnapshot,
): MusicNoteCardStateSnapshot => {
  const ids = new Set([...Object.keys(first.items || {}), ...Object.keys(second.items || {})]);
  const items: Record<string, MusicNoteCardStateItem> = {};
  ids.forEach((id) => {
    const a = first.items?.[id];
    const b = second.items?.[id];
    if (!a) items[id] = b;
    else if (!b) items[id] = a;
    else items[id] = Number(b.updatedAtMs || 0) >= Number(a.updatedAtMs || 0) ? b : a;
  });
  return {
    schemaVersion: 1,
    items,
    updatedAtMs: Math.max(Number(first.updatedAtMs || 0), Number(second.updatedAtMs || 0)),
  };
};

const readMusicNoteCardStateLocal = (uid: string): MusicNoteCardStateSnapshot => {
  if (!uid || typeof localStorage === 'undefined') return EMPTY_MUSIC_NOTE_CARD_STATE;
  try {
    const raw = localStorage.getItem(getMusicNoteCardStateStorageKey(uid));
    return raw ? normalizeMusicNoteCardState(JSON.parse(raw)) : EMPTY_MUSIC_NOTE_CARD_STATE;
  } catch {
    return EMPTY_MUSIC_NOTE_CARD_STATE;
  }
};

const writeMusicNoteCardStateLocal = (uid: string, snapshot: MusicNoteCardStateSnapshot) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getMusicNoteCardStateStorageKey(uid), JSON.stringify(snapshot));
  } catch {
    // Local persistence is an optimization; in-memory state still works.
  }
};

type PendingMusicNoteCardStateWrite = {
  items: Record<string, MusicNoteCardStateItem>;
  updatedAtMs: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const pendingMusicNoteCardStateWrites = new Map<string, PendingMusicNoteCardStateWrite>();

const scheduleMusicNoteCardStateServerWrite = (
  uid: string,
  updates: Record<string, MusicNoteCardStateItem>,
  updatedAtMs: number,
) => {
  if (!uid || Object.keys(updates).length === 0) return;
  const pending = pendingMusicNoteCardStateWrites.get(uid) || {
    items: {},
    updatedAtMs: 0,
    timer: null,
  };
  Object.assign(pending.items, updates);
  pending.updatedAtMs = Math.max(pending.updatedAtMs, updatedAtMs);
  if (pending.timer) clearTimeout(pending.timer);

  pending.timer = setTimeout(async () => {
    const current = pendingMusicNoteCardStateWrites.get(uid);
    if (!current) return;
    pendingMusicNoteCardStateWrites.delete(uid);
    try {
      await setDoc(doc(db, 'user_structures', uid), {
        musicNoteCardState: {
          schemaVersion: 1,
          items: current.items,
          updatedAtMs: current.updatedAtMs,
          updatedAt: serverTimestamp(),
        },
      }, { merge: true });
    } catch (error) {
      console.warn('Music Note lightweight card-state sync failed; local state is preserved.', error);
    }
  }, MUSIC_NOTE_CARD_STATE_WRITE_DELAY_MS);

  pendingMusicNoteCardStateWrites.set(uid, pending);
};

const SORIDRAW_MUSIC_NOTE_LIGHTWEIGHT_CARD_STATE_960 = true;
'''
replace_once(module_anchor, module_anchor + module_block, 'lightweight module state')

# 4) Component state + shared-listener hydration. This subscribes to the existing in-memory
# user_structures session, so it does not create a second Firestore listener.
state_anchor = "  const [explorePublicationPrivateConfirm, setExplorePublicationPrivateConfirm] = useState(false);\n"
state_block = r'''  const [musicNoteCardState, setMusicNoteCardState] = useState<MusicNoteCardStateSnapshot>(EMPTY_MUSIC_NOTE_CARD_STATE);
  const musicNoteCardStateRef = useRef<MusicNoteCardStateSnapshot>(EMPTY_MUSIC_NOTE_CARD_STATE);

  useEffect(() => {
    if (!user?.uid) {
      musicNoteCardStateRef.current = EMPTY_MUSIC_NOTE_CARD_STATE;
      setMusicNoteCardState(EMPTY_MUSIC_NOTE_CARD_STATE);
      return;
    }

    const uid = user.uid;
    const localState = readMusicNoteCardStateLocal(uid);
    musicNoteCardStateRef.current = localState;
    setMusicNoteCardState(localState);

    let active = true;
    const unsubscribe = subscribeMusicNoteFolderDocument(uid, (data: any) => {
      if (!active) return;
      const serverState = normalizeMusicNoteCardState(data?.musicNoteCardState);
      const currentLocal = musicNoteCardStateRef.current;
      const merged = mergeMusicNoteCardStateSnapshots(serverState, currentLocal);
      const localNewer: Record<string, MusicNoteCardStateItem> = {};
      Object.entries(currentLocal.items).forEach(([id, item]) => {
        const serverItem = serverState.items?.[id];
        if (!serverItem || Number(item.updatedAtMs || 0) > Number(serverItem.updatedAtMs || 0)) {
          localNewer[id] = item;
        }
      });

      musicNoteCardStateRef.current = merged;
      setMusicNoteCardState(merged);
      writeMusicNoteCardStateLocal(uid, merged);
      if (Object.keys(localNewer).length > 0) {
        scheduleMusicNoteCardStateServerWrite(uid, localNewer, merged.updatedAtMs);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.uid]);
'''
replace_once(state_anchor, state_anchor + state_block, 'lightweight component state')

# 5) Local-first accessors and mutation helper. Legacy song.isLiked/isLocked remain fallback-only,
# preserving old user data without migration. Once a card is touched, the lightweight state wins.
like_start = text.find('  const handleTogglePersonalLike = async (song: any) => {')
lock_start = text.find('  const handleToggleLock = async (song: any) => {', like_start)
if like_start < 0 or lock_start < 0:
    raise RuntimeError('apply-960: 959 like/lock helper anchors missing')
like_block = text[like_start:lock_start]
if 'updateFavorite(song.id, { isLiked: newLikedState })' not in like_block:
    raise RuntimeError('apply-960: expected 959 personal-like write path missing')

helper_code = r'''  const getMusicNoteCardStateSongId = (song: any) => String(
    song?.firestoreId || song?.favoriteFirestoreId || song?.id || ''
  ).trim();

  const getMusicNoteCardStateItem = (song: any): MusicNoteCardStateItem | null => {
    const id = getMusicNoteCardStateSongId(song);
    return id ? (musicNoteCardState.items?.[id] || null) : null;
  };

  const isMusicNoteCardLiked = (song: any) => {
    const item = getMusicNoteCardStateItem(song);
    return item ? Boolean(item.liked) : Boolean(song?.isLiked);
  };

  const isMusicNoteCardLocked = (song: any) => {
    const item = getMusicNoteCardStateItem(song);
    const locked = item ? Boolean(item.locked) : Boolean(song?.isLocked);
    if (item && song && typeof song === 'object') song.isLocked = locked;
    return locked;
  };

  const updateMusicNoteCardStateForSong = (
    song: any,
    patch: Partial<Pick<MusicNoteCardStateItem, 'liked' | 'locked'>>,
  ) => {
    if (!user?.uid || !song || shouldHideSunoUrlControls(song)) return;
    const id = getMusicNoteCardStateSongId(song);
    if (!id) return;

    const previousItem = getMusicNoteCardStateItem(song);
    const now = Date.now();
    const nextItem: MusicNoteCardStateItem = {
      liked: patch.liked ?? (previousItem ? Boolean(previousItem.liked) : Boolean(song?.isLiked)),
      locked: patch.locked ?? (previousItem ? Boolean(previousItem.locked) : Boolean(song?.isLocked)),
      updatedAtMs: now,
    };
    const nextSnapshot: MusicNoteCardStateSnapshot = {
      schemaVersion: 1,
      items: { ...musicNoteCardStateRef.current.items, [id]: nextItem },
      updatedAtMs: now,
    };

    musicNoteCardStateRef.current = nextSnapshot;
    setMusicNoteCardState(nextSnapshot);
    writeMusicNoteCardStateLocal(user.uid, nextSnapshot);
    scheduleMusicNoteCardStateServerWrite(user.uid, { [id]: nextItem }, now);

    // Keep legacy object consumers in this render/session consistent without a favorites write.
    song.isLiked = nextItem.liked;
    song.isLocked = nextItem.locked;
  };

  const handleTogglePersonalLike = (song: any) => {
    if (!song || shouldHideSunoUrlControls(song)) return;
    updateMusicNoteCardStateForSong(song, { liked: !isMusicNoteCardLiked(song) });
  };

'''
text = text[:like_start] + helper_code + text[lock_start:]

# 6) Replace single and multi-lock server mutations with the same local-first/batched state path.
old_lock = '''  const handleToggleLock = async (song: any) => {
    const newLockedState = !isMusicNoteCardLocked(song);
    await updateFavorite(song.id, { isLocked: newLockedState });
'''
new_lock = '''  const handleToggleLock = async (song: any) => {
    const newLockedState = !isMusicNoteCardLocked(song);
    updateMusicNoteCardStateForSong(song, { locked: newLockedState });
'''
replace_once(old_lock, new_lock, 'single lock local-first')

text = text.replace(
    "    await Promise.all(selectedSongs.map(song => updateFavorite(song.id, { isLocked: shouldLock })));",
    "    selectedSongs.forEach((song) => updateMusicNoteCardStateForSong(song, { locked: shouldLock }));",
)
text = text.replace(
    "      selectedSongIds.forEach(id => updateFavorite(id, { isLocked: true }));",
    "      activeFavoriteSource.filter((item) => selectedSongIds.includes(item.id)).forEach((item) => updateMusicNoteCardStateForSong(item, { locked: true }));",
)
text = text.replace(
    "      selectedSongIds.forEach(id => updateFavorite(id, { isLocked: false }));",
    "      activeFavoriteSource.filter((item) => selectedSongIds.includes(item.id)).forEach((item) => updateMusicNoteCardStateForSong(item, { locked: false }));",
)

# 7) Like visuals read the lightweight state immediately. No Explore/publication gate and no favorites update.
text = text.replace('backgroundColor: song.isLiked ?', 'backgroundColor: isMusicNoteCardLiked(song) ?', 1)
text = text.replace('color: song.isLiked ?', 'color: isMusicNoteCardLiked(song) ?', 1)
text = text.replace('boxShadow: song.isLiked ?', 'boxShadow: isMusicNoteCardLiked(song) ?', 1)
text = text.replace("aria-label={song.isLiked ? '좋아요 해제' : '좋아요'}", "aria-label={isMusicNoteCardLiked(song) ? '좋아요 해제' : '좋아요'}", 1)
text = text.replace("title={song.isLiked ? '좋아요 해제' : '좋아요'}", "title={isMusicNoteCardLiked(song) ? '좋아요 해제' : '좋아요'}", 1)

# 8) Cost and correctness assertions.
required = [
    marker,
    'musicNoteCardState',
    'MUSIC_NOTE_CARD_STATE_WRITE_DELAY_MS = 1200',
    'subscribeMusicNoteFolderDocument(uid',
    "doc(db, 'user_structures', uid)",
    'updateMusicNoteCardStateForSong',
    'isMusicNoteCardLiked(song)',
    'isMusicNoteCardLocked(song)',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-960 verification failed: missing {fragment}')

if "updateFavorite(song.id, { isLiked:" in text:
    raise RuntimeError('apply-960: personal Like still writes favorites')
if "updateFavorite(song.id, { isLocked:" in text:
    raise RuntimeError('apply-960: single Lock still writes favorites')
if "getExploreLikedTrackIds" in text or "setExploreTrackLike" in text or "toggleFavoriteExploreLike" in text:
    raise RuntimeError('apply-960: Explore social-like client remains in Music Note page')

path.write_text(text, encoding='utf-8')
print('apply-960: local-first Like/Lock + 1.2s batched user_structures sync applied')
