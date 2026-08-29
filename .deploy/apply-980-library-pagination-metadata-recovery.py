from pathlib import Path

MARKER = 'SORIDRAW_980_LIBRARY_PAGINATION_METADATA_RECOVERY'
path = Path('src/pages/SunoLibraryPage.tsx')
source = path.read_text(encoding='utf-8')

if MARKER in source:
    print('SORIDRAW 980 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_936_LIBRARY_VERSION_SYNC_ONLY' not in source:
    raise SystemExit('980 requires SORIDRAW 936 Library version gate to run first')

before = '''    return cachedTracks.length === 0 || localVersion <= 0 || remoteVersion > localVersion;
'''
after = '''    // SORIDRAW_980_LIBRARY_PAGINATION_METADATA_RECOVERY
    // The durable track cache stores content, not the Firestore pagination cursor.
    // On a fresh browser session `session.lastDoc` starts null, so skipping the
    // healthy one-document bundle read would incorrectly leave hasMore=false.
    // Verify exactly one bundle document to restore cursor + hasMore; same-SPA
    // route remounts still reuse the in-memory session and perform zero reads.
    return cachedTracks.length === 0
      || session.lastDoc === null
      || localVersion <= 0
      || remoteVersion > localVersion;
'''

count = source.count(before)
if count != 1:
    raise SystemExit(f'980 Library version gate anchor mismatch: {count}')
source = source.replace(before, after, 1)

required = [
    "session.lastDoc = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;",
    'session.hasMore = bundle.hasMore;',
    "subscribeListBundle('library', uid",
]
for needle in required:
    if needle not in source:
        raise SystemExit(f'980 safety failed: required existing bundle hydration path missing: {needle}')

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 980: cached Library sessions restore pagination cursor/hasMore from one bundle document.')
