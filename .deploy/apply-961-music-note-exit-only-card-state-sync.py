from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_MUSIC_NOTE_EXIT_ONLY_CARD_STATE_SYNC_961'

if marker in text:
    print('apply-961: already applied')
    raise SystemExit(0)

if 'const SORIDRAW_MUSIC_NOTE_LIGHTWEIGHT_CARD_STATE_960 = true;' not in text:
    raise RuntimeError('apply-961: apply-960 must run first')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-961: anchor not found: {label}')
    text = text.replace(old, new, 1)


def replace_between(start: str, end: str, replacement: str, label: str) -> None:
    global text
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f'apply-961: start anchor not found: {label}')
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f'apply-961: end anchor not found: {label}')
    text = text[:start_index] + replacement + text[end_index:]

# Remove the 1.2 second debounce contract. Like/Lock are local-only while the Music Note page is open.
replace_once(
    "const MUSIC_NOTE_CARD_STATE_WRITE_DELAY_MS = 1200;\n",
    "const MUSIC_NOTE_CARD_STATE_DIRTY_STORAGE_BASE = 'soridraw_music_note_card_state_dirty_v1';\n",
    'remove 1.2s write delay',
)

pending_start = 'type PendingMusicNoteCardStateWrite = {'
pending_end = 'const SORIDRAW_MUSIC_NOTE_LIGHTWEIGHT_CARD_STATE_960 = true;'
exit_sync_block = r'''const getMusicNoteCardStateDirtyStorageKey = (uid: string) => `${MUSIC_NOTE_CARD_STATE_DIRTY_STORAGE_BASE}_${uid}`;

const isMusicNoteCardStateDirty = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getMusicNoteCardStateDirtyStorageKey(uid)) === '1';
  } catch {
    return false;
  }
};

const markMusicNoteCardStateDirty = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getMusicNoteCardStateDirtyStorageKey(uid), '1');
  } catch {
    // The in-memory state still works even when localStorage is unavailable.
  }
};

const clearMusicNoteCardStateDirty = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(getMusicNoteCardStateDirtyStorageKey(uid));
  } catch {
    // Ignore storage cleanup failures.
  }
};

const musicNoteCardStateFlushInFlight = new Map<string, Promise<boolean>>();

const flushMusicNoteCardStateServerWrite = (uid: string): Promise<boolean> => {
  if (!uid || !isMusicNoteCardStateDirty(uid)) return Promise.resolve(false);
  const existing = musicNoteCardStateFlushInFlight.get(uid);
  if (existing) return existing;

  const snapshot = readMusicNoteCardStateLocal(uid);
  const task = (async () => {
    try {
      await setDoc(doc(db, 'user_structures', uid), {
        musicNoteCardState: {
          schemaVersion: 1,
          items: snapshot.items,
          updatedAtMs: snapshot.updatedAtMs,
          updatedAt: serverTimestamp(),
        },
      }, { merge: true });
      clearMusicNoteCardStateDirty(uid);
      return true;
    } catch (error) {
      // Keep the dirty marker + local cache so the next page exit can retry safely.
      console.warn('Music Note card-state exit sync failed; local dirty state is preserved.', error);
      return false;
    } finally {
      musicNoteCardStateFlushInFlight.delete(uid);
    }
  })();

  musicNoteCardStateFlushInFlight.set(uid, task);
  return task;
};

const SORIDRAW_MUSIC_NOTE_LIGHTWEIGHT_CARD_STATE_960 = true;
const SORIDRAW_MUSIC_NOTE_EXIT_ONLY_CARD_STATE_SYNC_961 = true;
'''
replace_between(pending_start, pending_end, exit_sync_block, 'replace debounce writer with exit-only writer')

# The shared listener may merge a newer local cache, but it must never write merely because data was read.
replace_once(
    '''      if (Object.keys(localNewer).length > 0) {
        scheduleMusicNoteCardStateServerWrite(uid, localNewer, merged.updatedAtMs);
      }
''',
    '''      // Local-newer data stays cached and dirty; do not write while this page is open.
      // A single exit flush handles all accumulated Like/Lock changes.
''',
    'remove hydration-triggered write',
)

# Every Like/Lock click now changes memory + localStorage only and marks one dirty bit.
replace_once(
    '    scheduleMusicNoteCardStateServerWrite(user.uid, { [id]: nextItem }, now);\n',
    '    markMusicNoteCardStateDirty(user.uid);\n',
    'click becomes local-only dirty mark',
)

# Flush once when leaving the Music Note page. pagehide is best-effort for closing/navigation;
# dirty localStorage survives if the browser terminates before Firestore finishes.
accessor_anchor = '''  const getMusicNoteCardStateSongId = (song: any) => String(
'''
flush_effect = r'''  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const flushIfDirty = () => {
      if (isMusicNoteCardStateDirty(uid)) void flushMusicNoteCardStateServerWrite(uid);
    };

    window.addEventListener('pagehide', flushIfDirty);
    return () => {
      window.removeEventListener('pagehide', flushIfDirty);
      flushIfDirty();
    };
  }, [user?.uid]);

'''
replace_once(accessor_anchor, flush_effect + accessor_anchor, 'exit-only flush effect')

required = [
    marker,
    'MUSIC_NOTE_CARD_STATE_DIRTY_STORAGE_BASE',
    'markMusicNoteCardStateDirty(user.uid)',
    'flushMusicNoteCardStateServerWrite(uid)',
    "window.addEventListener('pagehide', flushIfDirty)",
    'isMusicNoteCardStateDirty(uid)',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-961 verification failed: missing {fragment}')

for forbidden in [
    'MUSIC_NOTE_CARD_STATE_WRITE_DELAY_MS',
    'scheduleMusicNoteCardStateServerWrite(',
    'pendingMusicNoteCardStateWrites',
]:
    if forbidden in text:
        raise RuntimeError(f'apply-961 verification failed: click-time server writer remains: {forbidden}')

# Personal Like/Lock must stay out of the legacy expensive mutation routes.
if "updateFavorite(song.id, { isLiked:" in text:
    raise RuntimeError('apply-961 verification failed: personal Like still writes favorites')
if "updateFavorite(song.id, { isLocked:" in text:
    raise RuntimeError('apply-961 verification failed: single Lock still writes favorites')

path.write_text(text, encoding='utf-8')
print('apply-961: Like/Lock are local-only while open; dirty state flushes once on Music Note exit/pagehide')
