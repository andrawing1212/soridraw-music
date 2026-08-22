from pathlib import Path

MARKER = 'SORIDRAW_896_SECTION_CUSTOM_SYNC_PERMISSION_HARDENING'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app_source = app_path.read_text(encoding='utf-8')

if MARKER not in app_source:
    before = """      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      await setDoc(doc(db, 'users', user.uid), {
        syncVersions: { sectionCustom: nextSectionCustomVersion },
      }, { merge: true });
"""
    after = """      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      try {
        await setDoc(doc(db, 'users', user.uid), {
          syncVersions: { sectionCustom: nextSectionCustomVersion },
        }, { merge: true });
      } catch (syncError) {
        // Keep the section-custom save authoritative even if the currently
        // deployed rules have not yet been upgraded to allow syncVersions.
        // Same-device cache remains valid; cross-device invalidation activates
        // as soon as the prepared Firestore rule is deployed.
        console.warn('Failed to publish section custom sync version:', syncError);
      }
"""
    app_source = replace_once(app_source, before, after, 'section custom profile sync permission fallback')
    app_source = app_source.replace(
        'const SORIDRAW_895_SECTION_CUSTOM_CACHE_SYNC = true;\n',
        f"const {MARKER} = true;\nconst SORIDRAW_895_SECTION_CUSTOM_CACHE_SYNC = true;\n",
        1,
    )
    app_path.write_text(app_source, encoding='utf-8')
    print('Applied SORIDRAW 896: section custom save stays valid if syncVersions rules are not deployed yet.')
else:
    print('896 section custom sync permission hardening already applied.')
