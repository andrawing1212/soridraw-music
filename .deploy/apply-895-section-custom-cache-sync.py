from pathlib import Path
import re

MARKER = 'SORIDRAW_895_SECTION_CUSTOM_CACHE_SYNC'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


def regex_replace_once(source: str, pattern: str, replacement: str, label: str) -> str:
    next_source, count = re.subn(pattern, replacement, source, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return next_source


app_path = Path('src/App.tsx')
app_source = app_path.read_text(encoding='utf-8')

if MARKER not in app_source:
    # -------------------------------------------------------------------------
    # 1) Small per-user version metadata only. Existing section-custom payloads
    #    and Firestore document shapes stay compatible.
    # -------------------------------------------------------------------------
    constants_before = """const USER_CUSTOM_SECTIONS_STORAGE_KEY = 'soridraw_user_custom_sections_v1';
const USER_CUSTOM_SECTION_TAGS_STORAGE_KEY = 'soridraw_user_custom_section_tags_v1';
const USER_SAVED_STRUCTURES_STORAGE_KEY = 'soridraw_saved_structures_v1';
const getSavedStructuresStorageKey = (uid?: string | null) => `${USER_SAVED_STRUCTURES_STORAGE_KEY}_${uid || 'guest'}`;
"""
    constants_after = """const USER_CUSTOM_SECTIONS_STORAGE_KEY = 'soridraw_user_custom_sections_v1';
const USER_CUSTOM_SECTION_TAGS_STORAGE_KEY = 'soridraw_user_custom_section_tags_v1';
const USER_SAVED_STRUCTURES_STORAGE_KEY = 'soridraw_saved_structures_v1';
const getSavedStructuresStorageKey = (uid?: string | null) => `${USER_SAVED_STRUCTURES_STORAGE_KEY}_${uid || 'guest'}`;

const SORIDRAW_895_SECTION_CUSTOM_CACHE_SYNC = true;
const SECTION_CUSTOM_SYNC_VERSION_EVENT = 'soridraw:section-custom-sync-version';
const SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE = 'soridraw_section_custom_local_version_v1';
const SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE = 'soridraw_section_custom_remote_version_v1';
const getSectionCustomVersionStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;
const readSectionCustomVersion = (base: string, uid?: string | null): number => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(getSectionCustomVersionStorageKey(base, uid)) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};
const writeSectionCustomVersion = (base: string, uid: string, version: number) => {
  if (!uid || !Number.isFinite(version) || version <= 0 || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getSectionCustomVersionStorageKey(base, uid), String(version));
  } catch {}
};
const publishSectionCustomRemoteVersion = (uid: string, version: number) => {
  if (!uid || !Number.isFinite(version) || version <= 0) return;
  writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, uid, version);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SECTION_CUSTOM_SYNC_VERSION_EVENT, { detail: { uid, version } }));
  }
};
"""
    app_source = replace_once(app_source, constants_before, constants_after, 'section custom version helpers')

    # -------------------------------------------------------------------------
    # 2) Reuse the already-existing users/{uid} listener as the tiny version
    #    signal. This adds no dedicated section-custom polling/listener/read.
    # -------------------------------------------------------------------------
    profile_before = """          if (docSnap.exists()) {
            const data = docSnap.data();
            setEmailVerificationCycleKey(getEmailVerificationCycleKey(currentUser, data));"""
    profile_after = """          if (docSnap.exists()) {
            const data = docSnap.data();
            const sectionCustomVersion = Number(data?.syncVersions?.sectionCustom || 0);
            if (sectionCustomVersion > 0) {
              publishSectionCustomRemoteVersion(currentUser.uid, sectionCustomVersion);
            }
            setEmailVerificationCycleKey(getEmailVerificationCycleKey(currentUser, data));"""
    app_source = replace_once(app_source, profile_before, profile_after, 'existing user profile version signal')

    # -------------------------------------------------------------------------
    # 3) Every actual section-custom write gets one version token. The custom
    #    document keeps the token for backward-compatible refreshes, while the
    #    existing users document exposes only the tiny syncVersions signal.
    # -------------------------------------------------------------------------
    payload_before = """    const payload = {
      structures: savedStructuresRef.current
        .map((item) => normalizeSavedStructurePreset(item))
        .filter((item): item is SavedStructurePreset => item !== null)
        .slice(0, 20),
      customSections: normalizeUserCustomSections(userCustomSectionsRef.current).slice(0, 40),
      customSectionTags: normalizeUserCustomSectionTags(userCustomSectionTagsRef.current).slice(0, 120),
      customDataSyncVersion: 2,
      customDataUpdatedAt: Date.now(),
    };
"""
    payload_after = """    const nextSectionCustomVersion = Date.now();
    const payload = {
      structures: savedStructuresRef.current
        .map((item) => normalizeSavedStructurePreset(item))
        .filter((item): item is SavedStructurePreset => item !== null)
        .slice(0, 20),
      customSections: normalizeUserCustomSections(userCustomSectionsRef.current).slice(0, 40),
      customSectionTags: normalizeUserCustomSectionTags(userCustomSectionTagsRef.current).slice(0, 120),
      customDataSyncVersion: 2,
      customDataUpdatedAt: nextSectionCustomVersion,
      sectionCustomVersion: nextSectionCustomVersion,
    };
"""
    app_source = replace_once(app_source, payload_before, payload_after, 'section custom save payload version')

    save_before = """    try {
      const ref = doc(db, 'user_structures', user.uid);
      await setDoc(ref, sanitizeForFirestore(payload), { merge: true });
    } catch (error) {
      customBackupDirtyRef.current = true;
      console.error('Failed to save custom backup to Firestore:', error);
    } finally {
      customBackupSavingRef.current = false;
    }
  }, [user]);
"""
    save_after = """    try {
      const ref = doc(db, 'user_structures', user.uid);
      await setDoc(ref, sanitizeForFirestore(payload), { merge: true });

      // The payload write is authoritative for this device. Cache the same token
      // before publishing it to the profile so our own profile snapshot does not
      // cause a redundant reread.
      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      await setDoc(doc(db, 'users', user.uid), {
        syncVersions: { sectionCustom: nextSectionCustomVersion },
      }, { merge: true });
    } catch (error) {
      customBackupDirtyRef.current = true;
      console.error('Failed to save custom backup to Firestore:', error);
    } finally {
      customBackupSavingRef.current = false;
    }
  }, [user]);
"""
    app_source = replace_once(app_source, save_before, save_after, 'section custom profile version write')

    # -------------------------------------------------------------------------
    # 4) Cache-first loader. If this device has already loaded/saved the current
    #    version, reopening the app or modal does not read user_structures again.
    # -------------------------------------------------------------------------
    load_start_before = """    customBackupLoadingRef.current = true;
    const storageKey = getSavedStructuresStorageKey(user.uid);

    try {
      const ref = doc(db, 'user_structures', user.uid);
      const snap = await getDoc(ref);
"""
    load_start_after = """    customBackupLoadingRef.current = true;
    const storageKey = getSavedStructuresStorageKey(user.uid);
    const localVersion = readSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid);
    const remoteVersion = readSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid);
    const cacheVersionMatches = localVersion > 0 && (remoteVersion <= 0 || localVersion === remoteVersion);

    if (cacheVersionMatches) {
      customBackupLoadedRef.current = true;
      customBackupLoadingRef.current = false;
      return;
    }

    try {
      const ref = doc(db, 'user_structures', user.uid);
      const snap = await getDoc(ref);
"""
    app_source = replace_once(app_source, load_start_before, load_start_after, 'section custom cache-first guard')

    missing_before = """      if (!snap.exists()) {
        if (localStructures.length > 0 || localSections.length > 0 || localTags.length > 0) {
          customBackupDirtyRef.current = true;
        }
        return;
      }
"""
    missing_after = """      if (!snap.exists()) {
        if (localStructures.length > 0 || localSections.length > 0 || localTags.length > 0) {
          customBackupDirtyRef.current = true;
        }
        // Remember that this device has already checked the empty remote state.
        // A later cross-device save publishes a different profile version and
        // will invalidate this sentinel automatically.
        const checkedVersion = remoteVersion || localVersion || Date.now();
        writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, checkedVersion);
        if (remoteVersion <= 0) {
          writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, checkedVersion);
        }
        return;
      }
"""
    app_source = replace_once(app_source, missing_before, missing_after, 'section custom empty remote cache')

    load_finish_before = """      if (hasCustomTags) {
        const normalizedTags = normalizeUserCustomSectionTags(data.customSectionTags);
        setUserCustomSectionTags(normalizedTags);
        userCustomSectionTagsRef.current = normalizedTags;
        writeJsonArray(USER_CUSTOM_SECTION_TAGS_STORAGE_KEY, normalizedTags);
      } else if (localTags.length > 0) {
        customBackupDirtyRef.current = true;
      }
    } catch (error) {
"""
    load_finish_after = """      if (hasCustomTags) {
        const normalizedTags = normalizeUserCustomSectionTags(data.customSectionTags);
        setUserCustomSectionTags(normalizedTags);
        userCustomSectionTagsRef.current = normalizedTags;
        writeJsonArray(USER_CUSTOM_SECTION_TAGS_STORAGE_KEY, normalizedTags);
      } else if (localTags.length > 0) {
        customBackupDirtyRef.current = true;
      }

      const resolvedVersion = Number(data?.sectionCustomVersion || data?.customDataUpdatedAt || remoteVersion || Date.now());
      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
    } catch (error) {
"""
    app_source = replace_once(app_source, load_finish_before, load_finish_after, 'section custom fetched version cache')

    # -------------------------------------------------------------------------
    # 5) If another device changes section custom while this app is open, the
    #    existing profile snapshot emits a tiny version event. Refresh exactly
    #    once only when the cached version differs.
    # -------------------------------------------------------------------------
    listener_before = """  }, [user]);


  const openCustomModal = () => {
    onModalStateChange?.(true);
    void ensureCustomBackupLoaded();
"""
    listener_after = """  }, [user]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const refreshIfVersionChanged = (version: number) => {
      if (!Number.isFinite(version) || version <= 0) return;
      const localVersion = readSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid);
      if (localVersion > 0 && localVersion === version) return;
      customBackupLoadedRef.current = false;
      void ensureCustomBackupLoaded();
    };

    const handleSectionCustomVersion = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string; version?: number }>).detail;
      if (!detail || detail.uid !== user.uid) return;
      refreshIfVersionChanged(Number(detail.version || 0));
    };

    window.addEventListener(SECTION_CUSTOM_SYNC_VERSION_EVENT, handleSectionCustomVersion as EventListener);
    refreshIfVersionChanged(readSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid));
    return () => window.removeEventListener(SECTION_CUSTOM_SYNC_VERSION_EVENT, handleSectionCustomVersion as EventListener);
  }, [user, ensureCustomBackupLoaded]);


  const openCustomModal = () => {
    onModalStateChange?.(true);
    void ensureCustomBackupLoaded();
"""
    app_source = replace_once(app_source, listener_before, listener_after, 'section custom version change listener')

    app_path.write_text(app_source, encoding='utf-8')
    print('Applied SORIDRAW 895: section custom uses per-device cache and existing profile syncVersions for change-only refresh.')
else:
    print('895 section custom cache/version sync already applied.')
