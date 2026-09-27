from pathlib import Path
import json

MARKER = 'SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927'

def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'214 {label} anchor mismatch: {count}')
    return text.replace(before, after, 1)

# 1) Tiny shared RTDB navigation payload service. No Firestore reads here.
service_path = Path('src/services/navigationVisibilitySyncService.ts')
service_path.write_text("""import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';
import {
  normalizeNavigationVisibilitySettings,
  type NavigationVisibilitySettings,
} from '../constants/navigationVisibility';

export type NavigationVisibilitySyncPayload = {
  revision: string;
  updatedAt: number;
  settings: NavigationVisibilitySettings;
};

const normalizePayload = (raw: unknown): NavigationVisibilitySyncPayload | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const revision = String(value.revision || '').trim();
  if (!revision) return null;
  return {
    revision,
    updatedAt: Math.max(0, Number(value.updatedAt || 0) || 0),
    settings: normalizeNavigationVisibilitySettings(value),
  };
};

// SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927
// One tiny shared RTDB payload. It mirrors only seven menu booleans + revision;
// it never reads Firestore, song data, Feed, profile, or any user collection.
export const subscribeNavigationVisibilitySync = (
  onPayload: (payload: NavigationVisibilitySyncPayload | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe => onValue(
  ref(realtimeDb, 'publicSync/navigationVisibility'),
  (snapshot) => onPayload(normalizePayload(snapshot.val())),
  (error) => onError?.(error),
);
""", encoding='utf-8')

# 2) RTDB rules: authenticated members can read one tiny global settings mirror; clients can never write it.
rules_path = Path('database.rules.json')
rules = json.loads(rules_path.read_text(encoding='utf-8'))
public_sync = rules.setdefault('rules', {}).setdefault('publicSync', {})
public_sync['navigationVisibility'] = {
    '.read': 'auth != null',
    '.write': False,
    'revision': {'.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 96'},
    'updatedAt': {'.validate': 'newData.isNumber() && newData.val() > 0'},
    'menuVisibility': {
        key: {'.validate': 'newData.isBoolean()'}
        for key in ['home', 'explore', 'studio', 'musicNote', 'library', 'lab', 'myPage']
    },
    'menuAdminOnly': {
        key: {'.validate': 'newData.isBoolean()'}
        for key in ['home', 'explore', 'studio', 'musicNote', 'library', 'lab', 'myPage']
    },
    '$other': {'.validate': False},
}
public_sync['navigationVisibility']['menuVisibility']['$other'] = {'.validate': False}
public_sync['navigationVisibility']['menuAdminOnly']['$other'] = {'.validate': False}
rules_path.write_text(json.dumps(rules, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# 3) Callable: rare admin save writes Firestore authority once, then one tiny RTDB mirror.
functions_path = Path('functions/src/index.ts')
functions = functions_path.read_text(encoding='utf-8')
if MARKER not in functions:
    anchor = 'export const adminSignalUserControlRevision = onCall(\n'
    if anchor not in functions:
        raise SystemExit('214 Functions insertion anchor missing')
    block = r'''// SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927
const NAVIGATION_VISIBILITY_KEYS_214 = [
  "home",
  "explore",
  "studio",
  "musicNote",
  "library",
  "lab",
  "myPage",
] as const;

const parseNavigationVisibilityMap214 = (raw: unknown, label: string) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpsError("invalid-argument", label + " 설정이 올바르지 않습니다.");
  }
  const source = raw as Record<string, unknown>;
  const parsed: Record<string, boolean> = {};
  NAVIGATION_VISIBILITY_KEYS_214.forEach((key) => {
    if (typeof source[key] !== "boolean") {
      throw new HttpsError("invalid-argument", label + "." + key + " 값이 필요합니다.");
    }
    parsed[key] = source[key] === true;
  });
  return parsed;
};

export const adminSetNavigationVisibility = onCall(
  { region: "us-central1" },
  async (request) => {
    const { db } = await requireAdminCaller(request, "appSettings");
    const rawSettings = request.data?.settings;
    const menuVisibility = parseNavigationVisibilityMap214(rawSettings?.menuVisibility, "menuVisibility");
    const menuAdminOnly = parseNavigationVisibilityMap214(rawSettings?.menuAdminOnly, "menuAdminOnly");
    const now = Date.now();
    const revision = now.toString(36) + "-" + Math.random().toString(36).slice(2, 10);

    await db.collection("app_settings").doc("navigation_visibility").set({
      menuVisibility,
      menuAdminOnly,
      showSunoLibraryMenu: menuVisibility.library,
      sunoLibraryMenuAdminOnly: menuAdminOnly.library,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await admin.database().ref("publicSync/navigationVisibility").set({
      revision,
      updatedAt: now,
      menuVisibility,
      menuAdminOnly,
    });

    return { ok: true, revision, updatedAt: now };
  }
);

'''
    functions = functions.replace(anchor, block + anchor, 1)
functions_path.write_text(functions, encoding='utf-8')

# 4) Admin save: one callable owns both writes. Other app-setting controls stay unchanged.
admin_path = Path('src/pages/AdminAppSettingsPage.tsx')
admin = admin_path.read_text(encoding='utf-8')
admin = replace_once(
    admin,
    "import { auth, db } from '../firebase';",
    "import { auth, db, functions, httpsCallable } from '../firebase';",
    'admin firebase import',
)
old_save = """    try {
      await setDoc(
        NAVIGATION_VISIBILITY_DOC,
        {
          ...getNavigationFirestorePayload(draftSettings),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setSavedSettings(draftSettings);"""
new_save = """    try {
      const saveNavigationVisibility = httpsCallable(functions, 'adminSetNavigationVisibility');
      await saveNavigationVisibility({
        settings: getNavigationFirestorePayload(draftSettings),
      });
      setSavedSettings(draftSettings);"""
admin = replace_once(admin, old_save, new_save, 'admin navigation save')
admin_path.write_text(admin, encoding='utf-8')

# 5) App: consume tiny RTDB payload only for signed-in members. Keep infinite local Firestore payload cache.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
import_anchor = "} from './constants/navigationVisibility';\n"
if "navigationVisibilitySyncService" not in app:
    app = replace_once(
        app,
        import_anchor,
        import_anchor + "import { subscribeNavigationVisibilitySync } from './services/navigationVisibilitySyncService';\n",
        'App navigation sync import',
    )

nav_effect_anchor = """    return () => {
      isMounted = false;
      window.removeEventListener('soridraw:navigation-visibility-updated', handleLocalVisibilityUpdate);
    };
  }, []);
"""
if 'SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927' not in app:
    nav_effect = r'''
  // SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927
  // Existing local cache stays the zero-read bootstrap. Signed-in members also
  // receive one tiny shared RTDB settings mirror so an admin change converges
  // without polling or a Firestore read on app start/route change.
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeNavigationVisibilitySync(
      (payload) => {
        if (!payload) return;
        const nextSettings = normalizeNavigationVisibilitySettings(
          payload.settings,
          readStoredNavigationVisibilitySettings(),
        );
        setNavigationVisibilitySettings(nextSettings);
        writeStoredNavigationVisibilitySettings(nextSettings);
        writeFirestoreReadCache(FIRESTORE_READ_CACHE_KEYS.navigationVisibility, nextSettings);
      },
      (error) => {
        console.warn('Navigation visibility RTDB sync unavailable. Keeping last local cache:', error);
      },
    );
  }, [user?.uid]);
'''
    app = replace_once(app, nav_effect_anchor, nav_effect_anchor + nav_effect, 'App navigation sync effect')

# Include Explore in user-visible/fallback maps.
old_user_map = """  const menuVisibilityForCurrentUser = useMemo<NavigationMenuVisibility>(() => ({
    home: menuVisibility.home && (!menuAdminOnly.home || isAdminMenuUser),
    studio: menuVisibility.studio && (!menuAdminOnly.studio || isAdminMenuUser),"""
new_user_map = """  const menuVisibilityForCurrentUser = useMemo<NavigationMenuVisibility>(() => ({
    home: menuVisibility.home && (!menuAdminOnly.home || isAdminMenuUser),
    explore: (menuVisibility.explore ?? true) && (!(menuAdminOnly.explore ?? false) || isAdminMenuUser),
    studio: menuVisibility.studio && (!menuAdminOnly.studio || isAdminMenuUser),"""
app = replace_once(app, old_user_map, new_user_map, 'current user Explore map')

old_fallback = """    const accessibleVisibility: NavigationMenuVisibility = {
      home: menuVisibility.home && !menuAdminOnly.home,
      studio: menuVisibility.studio && !menuAdminOnly.studio,"""
new_fallback = """    const accessibleVisibility: NavigationMenuVisibility = {
      home: menuVisibility.home && !menuAdminOnly.home,
      explore: (menuVisibility.explore ?? true) && !(menuAdminOnly.explore ?? false),
      studio: menuVisibility.studio && !menuAdminOnly.studio,"""
app = replace_once(app, old_fallback, new_fallback, 'fallback Explore map')

old_route = '        <Route path="/explore" element={<ExploreShellLazy />} />'
new_route = '''        <Route path="/explore" element={
          canAccessNavigationMenu('explore') ? (
            <ExploreShellLazy />
          ) : (
            <FeatureUnavailablePage label="익스플로어" fallbackPath={navigationFallbackPath} />
          )
        } />'''
app = replace_once(app, old_route, new_route, 'Explore route gate')
app_path.write_text(app, encoding='utf-8')

# 6) app version.
version_path = Path('public/app-version.json')
version = json.loads(version_path.read_text(encoding='utf-8'))
version['version'] = '192'
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('214 navigation visibility RTDB sync + Explore direct route gate applied')
