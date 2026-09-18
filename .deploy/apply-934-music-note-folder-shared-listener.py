from pathlib import Path
import re

MARKER = 'SORIDRAW_934_MUSIC_NOTE_FOLDER_SHARED_LISTENER'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'934 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


page_path = Path('src/pages/FavoritesPage.tsx')
page = page_path.read_text(encoding='utf-8')

if MARKER not in page:
    # Add onSnapshot to the existing Firestore import, regardless of whether the
    # measured wrapper has already replaced the module path earlier in prebuild.
    firestore_import = re.compile(
        r"import \{(?P<body>[^}]*\bwriteBatch\b[^}]*)\} from '(?P<module>[^']*(?:firebase/firestore|firestoreMeasured))';"
    )
    match = firestore_import.search(page)
    if not match:
        raise SystemExit('934 Firestore import anchor missing')
    import_body = match.group('body')
    if 'onSnapshot' not in import_body:
        next_body = import_body.rstrip()
        if next_body and not next_body.rstrip().endswith(','):
            next_body = next_body.rstrip() + ','
        next_body += ' onSnapshot '
        next_import = f"import {{{next_body}}} from '{match.group('module')}';"
        page = page[:match.start()] + next_import + page[match.end():]

    # One user_structures listener per signed-in user for the whole SPA session.
    # Page remounts only subscribe to this in-memory source, so left-menu hopping
    # no longer creates a new billed getDoc each time. Keeping the listener alive
    # also preserves immediate cross-device folder updates while the app is open.
    session_anchor = "let musicNoteVisibleCountMemory = MUSIC_NOTE_VISIBLE_BATCH_SIZE;\n"
    session_block = r'''

type MusicNoteFolderSharedSession = {
  data: any | null;
  listeners: Set<(data: any) => void>;
  unsubscribe: (() => void) | null;
};

const musicNoteFolderSharedSessions = new Map<string, MusicNoteFolderSharedSession>();

const subscribeMusicNoteFolderDocument = (uid: string, listener: (data: any) => void) => {
  let session = musicNoteFolderSharedSessions.get(uid);
  if (!session) {
    session = { data: null, listeners: new Set(), unsubscribe: null };
    musicNoteFolderSharedSessions.set(uid, session);
  }

  session.listeners.add(listener);
  if (session.data !== null) {
    const cachedData = session.data;
    queueMicrotask(() => {
      if (session?.listeners.has(listener)) listener(cachedData);
    });
  }

  if (!session.unsubscribe) {
    const targetSession = session;
    targetSession.unsubscribe = onSnapshot(
      doc(db, 'user_structures', uid),
      (snapshot) => {
        const nextData: any = snapshot.exists() ? snapshot.data() : {};
        targetSession.data = nextData;
        targetSession.listeners.forEach((subscriber) => subscriber(nextData));
      },
      (error) => {
        console.warn('music note folder shared listener failed:', error);
        targetSession.unsubscribe = null;
      },
    );
  }

  return () => {
    session?.listeners.delete(listener);
    // Intentionally keep the single Firestore listener alive for this SPA session.
    // Re-subscribing on every route mount would recreate the original read leak.
  };
};

const SORIDRAW_934_MUSIC_NOTE_FOLDER_SHARED_LISTENER = true;
'''
    page = replace_once(page, session_anchor, session_anchor + session_block, 'shared folder session insertion')

    old_effect = r'''  useEffect(() => {
    let cancelled = false;

    const loadMusicNoteFolders = async () => {
      if (!user?.uid) {
        setMyNoteFolders(DEFAULT_MY_NOTE_FOLDERS);
        setSharedNoteFolders(DEFAULT_SHARED_NOTE_FOLDERS);
        setSelectedMyNoteFolderId('default');
        setSelectedSharedNoteFolderId('default');
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'user_structures', user.uid));
        if (cancelled) return;
        const data: any = snap.exists() ? snap.data() : {};
        const stored = data?.musicNoteFolders || {};
        const nextMy = normalizeMusicNoteFolders(stored.myNote || data?.myNoteFolders, DEFAULT_MY_NOTE_FOLDERS);
        const nextShared = normalizeMusicNoteFolders(stored.sharedNote || data?.sharedNoteFolders, DEFAULT_SHARED_NOTE_FOLDERS);
        setMyNoteFolders(nextMy);
        setSharedNoteFolders(nextShared);
        setSelectedMyNoteFolderId((prev) => nextMy.some((folder) => folder.id === prev) ? prev : 'default');
        setSelectedSharedNoteFolderId((prev) => nextShared.some((folder) => folder.id === prev) ? prev : 'default');
      } catch (error) {
        console.warn('load music note folders failed:', error);
        if (!cancelled) {
          setMyNoteFolders(DEFAULT_MY_NOTE_FOLDERS);
          setSharedNoteFolders(DEFAULT_SHARED_NOTE_FOLDERS);
        }
      }
    };

    loadMusicNoteFolders();
    return () => { cancelled = true; };
  }, [user?.uid]);'''

    new_effect = r'''  useEffect(() => {
    if (!user?.uid) {
      setMyNoteFolders(DEFAULT_MY_NOTE_FOLDERS);
      setSharedNoteFolders(DEFAULT_SHARED_NOTE_FOLDERS);
      setSelectedMyNoteFolderId('default');
      setSelectedSharedNoteFolderId('default');
      return;
    }

    let active = true;
    const applyFolderData = (data: any) => {
      if (!active) return;
      const stored = data?.musicNoteFolders || {};
      const nextMy = normalizeMusicNoteFolders(stored.myNote || data?.myNoteFolders, DEFAULT_MY_NOTE_FOLDERS);
      const nextShared = normalizeMusicNoteFolders(stored.sharedNote || data?.sharedNoteFolders, DEFAULT_SHARED_NOTE_FOLDERS);
      setMyNoteFolders(nextMy);
      setSharedNoteFolders(nextShared);
      setSelectedMyNoteFolderId((prev) => nextMy.some((folder) => folder.id === prev) ? prev : 'default');
      setSelectedSharedNoteFolderId((prev) => nextShared.some((folder) => folder.id === prev) ? prev : 'default');
    };

    const unsubscribe = subscribeMusicNoteFolderDocument(user.uid, applyFolderData);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.uid]);'''

    page = replace_once(page, old_effect, new_effect, 'folder getDoc effect replacement')
    page_path.write_text(page, encoding='utf-8')


final_page = page_path.read_text(encoding='utf-8')
if "getDoc(doc(db, 'user_structures', user.uid))" in final_page:
    raise SystemExit('934 safety failed: repeated folder user_structures getDoc remains')
if 'subscribeMusicNoteFolderDocument' not in final_page:
    raise SystemExit('934 safety failed: shared folder listener missing')
if "doc(db, 'user_structures', uid)" not in final_page or 'onSnapshot(' not in final_page:
    raise SystemExit('934 safety failed: shared user_structures listener missing')
if 'persistMusicNoteFolders' not in final_page:
    raise SystemExit('934 safety failed: folder write path unexpectedly removed')

print('Applied SORIDRAW 934: Music Note folders share one user_structures listener per SPA session; route remounts are memory-only.')
