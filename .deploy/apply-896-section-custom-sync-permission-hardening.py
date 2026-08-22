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

# 897 adds local-only visible cache diagnostics. It must run after 895/896 so
# it can instrument the final cache/version paths without changing their behavior.
apply_897 = Path('.deploy/apply-897-cache-diagnostics-overlay.py')
if apply_897.exists():
    exec(compile(apply_897.read_text(encoding='utf-8'), str(apply_897), 'exec'), {'__name__': '__main__'})

# Keep Firestore listener diagnostics honest: local snapshots are CACHE 0, while
# server snapshots count only documents delivered by that listener update.
apply_897_accuracy = Path('.deploy/apply-897-cache-diagnostics-read-accuracy.py')
if apply_897_accuracy.exists():
    exec(compile(apply_897_accuracy.read_text(encoding='utf-8'), str(apply_897_accuracy), 'exec'), {'__name__': '__main__'})

# The visual switch lives in Admin App Settings, but the badge is also scoped to
# the exact account that enabled it so an account switch on the same device cannot
# expose diagnostics to a normal user.
apply_897_admin_scope = Path('.deploy/apply-897-cache-diagnostics-admin-scope.py')
if apply_897_admin_scope.exists():
    exec(compile(apply_897_admin_scope.read_text(encoding='utf-8'), str(apply_897_admin_scope), 'exec'), {'__name__': '__main__'})
