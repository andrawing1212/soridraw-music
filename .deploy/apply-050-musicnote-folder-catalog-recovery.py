from pathlib import Path

REQUIRED_FIELDS = [
    'noteFolderId', 'myNoteFolderId', 'favoriteFolderId',
    'sharedNoteFolderId', 'sharedNoteFolder', 'noteSharedFolderId',
    'sharedNoteShareId', 'isSharedMusicNote', 'sharedReadOnly',
    'sourceType', 'originalFavoriteId',
]
FIELD_LINES = (
    "  'noteFolderId', 'myNoteFolderId', 'favoriteFolderId', 'sharedNoteFolderId', 'sharedNoteFolder', 'noteSharedFolderId',\n"
    "  'sharedNoteShareId', 'isSharedMusicNote', 'sharedReadOnly', 'sourceType', 'originalFavoriteId',\n"
)
ANCHOR = "  'color', 'favoriteColor', 'noteColor', 'folderId', 'folderIds', 'musicNoteFolderIds',\n"


def patch_client():
    path = Path('src/lib/userDataEngine.ts')
    text = path.read_text(encoding='utf-8')
    block = text[text.index('const MUSIC_NOTE_SUMMARY_KEYS'):text.index('const LIBRARY_SUMMARY_KEYS')]
    assert text.count(ANCHOR) == 1, 'client field anchor changed'
    assert not any(f"'{field}'" in block for field in REQUIRED_FIELDS), 'client 050 fields already partially present'
    text = text.replace(ANCHOR, ANCHOR + FIELD_LINES, 1)

    old = "const CATALOG_LOCAL_CACHE_GENERATION = 5 as const;\n"
    assert text.count(old) == 1 and 'MUSIC_NOTE_LOCAL_CACHE_GENERATION_050' not in text
    text = text.replace(old, old + "const MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 = 6 as const;\n", 1)

    old = "if (record?.cacheGeneration !== CATALOG_LOCAL_CACHE_GENERATION) {"
    new = "if (record?.cacheGeneration !== (kind === 'musicNote' ? MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 : CATALOG_LOCAL_CACHE_GENERATION)) {"
    assert text.count(old) == 1
    text = text.replace(old, new, 1)

    old = "key, uid, kind, cacheGeneration: CATALOG_LOCAL_CACHE_GENERATION, snapshot,"
    new = "key, uid, kind, cacheGeneration: kind === 'musicNote' ? MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 : CATALOG_LOCAL_CACHE_GENERATION, snapshot,"
    assert text.count(old) == 1
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')


def patch_worker():
    path = Path('cloudflare/media-worker/src/index.js')
    text = path.read_text(encoding='utf-8')
    block = text[text.index('const MUSIC_NOTE_CATALOG_FIELDS'):text.index('const LIBRARY_CATALOG_FIELDS')]
    assert text.count(ANCHOR) == 1, 'worker field anchor changed'
    assert not any(f"'{field}'" in block for field in REQUIRED_FIELDS), 'worker 050 fields already partially present'
    text = text.replace(ANCHOR, ANCHOR + FIELD_LINES, 1)

    old = (
        "const catalogObjectKey = (uid, kind) => `catalog/v4/${encodeURIComponent(uid)}/${kind}.json`;\n"
        "const catalogJournalKey = (uid, kind) => `catalog/v4/${encodeURIComponent(uid)}/${kind}/journal.json`;\n"
        "const catalogCompactedBaseKey = (uid, kind, revision) => `catalog/v4/${encodeURIComponent(uid)}/${kind}/bases/${revision}.json`;"
    )
    new = (
        "const MUSIC_NOTE_CATALOG_STORAGE_GENERATION_050 = 'v5';\n"
        "const catalogStorageGeneration = (kind) => kind === 'musicNote' ? MUSIC_NOTE_CATALOG_STORAGE_GENERATION_050 : 'v4';\n"
        "const catalogObjectKey = (uid, kind) => `catalog/${catalogStorageGeneration(kind)}/${encodeURIComponent(uid)}/${kind}.json`;\n"
        "const catalogJournalKey = (uid, kind) => `catalog/${catalogStorageGeneration(kind)}/${encodeURIComponent(uid)}/${kind}/journal.json`;\n"
        "const catalogCompactedBaseKey = (uid, kind, revision) => `catalog/${catalogStorageGeneration(kind)}/${encodeURIComponent(uid)}/${kind}/bases/${revision}.json`;"
    )
    assert text.count(old) == 1 and 'MUSIC_NOTE_CATALOG_STORAGE_GENERATION_050' not in text
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')


def patch_version():
    notice_path = Path('src/services/appUpdateNotice.ts')
    notice = notice_path.read_text(encoding='utf-8')
    assert notice.count("const CURRENT_APP_VERSION = '049';") == 1
    notice_path.write_text(notice.replace("const CURRENT_APP_VERSION = '049';", "const CURRENT_APP_VERSION = '050';", 1), encoding='utf-8')

    version_path = Path('public/app-version.json')
    version = version_path.read_text(encoding='utf-8')
    assert version.count('"049"') == 1 and '"050"' not in version
    version_path.write_text(version.replace('"049"', '"050"', 1), encoding='utf-8')


def write_verifier():
    path = Path('scripts/verify-050-musicnote-folder-catalog-recovery.mjs')
    path.write_text("""import fs from 'node:fs';

const client = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const worker = fs.readFileSync('cloudflare/media-worker/src/index.js', 'utf8');
const favorites = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));
const required = [
  'noteFolderId', 'myNoteFolderId', 'favoriteFolderId',
  'sharedNoteFolderId', 'sharedNoteFolder', 'noteSharedFolderId',
  'sharedNoteShareId', 'isSharedMusicNote', 'sharedReadOnly', 'sourceType', 'originalFavoriteId',
];
const clientBlock = client.slice(client.indexOf('const MUSIC_NOTE_SUMMARY_KEYS'), client.indexOf('const LIBRARY_SUMMARY_KEYS'));
const workerBlock = worker.slice(worker.indexOf('const MUSIC_NOTE_CATALOG_FIELDS'), worker.indexOf('const LIBRARY_CATALOG_FIELDS'));
for (const key of required) {
  if (!clientBlock.includes(`'${key}'`)) throw new Error(`client missing ${key}`);
  if (!workerBlock.includes(`'${key}'`)) throw new Error(`worker missing ${key}`);
}
const filterSignals = [
  'song.noteFolderId || song.myNoteFolderId || song.favoriteFolderId || song.folderId',
  'song.sharedNoteFolderId || song.sharedNoteFolder || song.noteSharedFolderId',
  'song?.sharedReadOnly',
  'song?.isSharedMusicNote',
  "song?.sourceType === 'shared_music_note'",
  'song?.sharedNoteShareId',
];
for (const signal of filterSignals) if (!favorites.includes(signal)) throw new Error(`FavoritesPage filter contract changed: ${signal}`);
if (!client.includes('MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 = 6')) throw new Error('Music Note local cache generation not isolated');
if (!client.includes("kind === 'musicNote' ? MUSIC_NOTE_LOCAL_CACHE_GENERATION_050 : CATALOG_LOCAL_CACHE_GENERATION")) throw new Error('per-kind local generation missing');
if (!worker.includes("MUSIC_NOTE_CATALOG_STORAGE_GENERATION_050 = 'v5'")) throw new Error('Music Note R2 generation missing');
if (!worker.includes("kind === 'musicNote' ? MUSIC_NOTE_CATALOG_STORAGE_GENERATION_050 : 'v4'")) throw new Error('Library R2 generation must remain v4');
if (version.version !== '050') throw new Error('version must be 050');
console.log('VERIFY_050_MUSICNOTE_FOLDER_CATALOG_RECOVERY=PASS');
console.log('MY_NOTE_CLASSIFICATION_FIELDS=PASS');
console.log('SHARED_NOTE_CLASSIFICATION_FIELDS=PASS');
console.log('MUSICNOTE_ONLY_LOCAL_CACHE_INVALIDATION=PASS');
console.log('MUSICNOTE_ONLY_R2_REBUILD_NAMESPACE=PASS');
console.log('LIBRARY_CATALOG_UNCHANGED=PASS');
console.log('FAVORITES_PAGE_FILTER_LOGIC_UNCHANGED=PASS');
""", encoding='utf-8')


patch_client()
patch_worker()
patch_version()
write_verifier()
print('APPLY_050_MUSICNOTE_FOLDER_CATALOG_RECOVERY=PASS')
