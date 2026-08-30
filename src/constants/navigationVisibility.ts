export const NAVIGATION_VISIBILITY_STORAGE_KEY = 'soridraw_navigation_visibility_v3';
export const LEGACY_NAVIGATION_VISIBILITY_STORAGE_KEY = 'soridraw_navigation_visibility_v2';
export const LEGACY_LIBRARY_VISIBILITY_STORAGE_KEY = 'soridraw_navigation_show_suno_library_menu';
export const LEGACY_LIBRARY_ADMIN_ONLY_STORAGE_KEY = 'soridraw_navigation_suno_library_admin_only';

export const NAVIGATION_MENU_KEYS = ['home', 'explore', 'studio', 'musicNote', 'library', 'lab', 'myPage'] as const;
export type NavigationMenuKey = typeof NAVIGATION_MENU_KEYS[number];
type LegacyNavigationMenuKey = Exclude<NavigationMenuKey, 'explore'>;

// Explore was added after the original navigation settings shipped. Keep the
// new key optional at the type boundary so older in-app/default objects remain
// source compatible; normalizeNavigationVisibilitySettings always materializes
// it to a boolean before settings are used or saved.
export type NavigationMenuVisibility = Record<LegacyNavigationMenuKey, boolean> & { explore?: boolean };
export type NavigationMenuAdminOnly = Record<LegacyNavigationMenuKey, boolean> & { explore?: boolean };
export type NavigationMenuAccessMode = 'public' | 'admin' | 'hidden';

export type NavigationVisibilitySettings = {
  menuVisibility: NavigationMenuVisibility;
  menuAdminOnly: NavigationMenuAdminOnly;
};

export const DEFAULT_NAVIGATION_MENU_VISIBILITY: NavigationMenuVisibility = {
  home: true,
  explore: true,
  studio: true,
  musicNote: true,
  library: false,
  lab: true,
  myPage: true,
};

export const DEFAULT_NAVIGATION_MENU_ADMIN_ONLY: NavigationMenuAdminOnly = {
  home: false,
  explore: false,
  studio: false,
  musicNote: false,
  library: false,
  lab: false,
  myPage: false,
};

export const DEFAULT_NAVIGATION_VISIBILITY_SETTINGS: NavigationVisibilitySettings = {
  menuVisibility: DEFAULT_NAVIGATION_MENU_VISIBILITY,
  menuAdminOnly: DEFAULT_NAVIGATION_MENU_ADMIN_ONLY,
};

const asBooleanOrFallback = (value: unknown, fallback: boolean) => (
  typeof value === 'boolean' ? value : fallback
);

export const normalizeNavigationVisibilitySettings = (
  data: any,
  fallback: NavigationVisibilitySettings = DEFAULT_NAVIGATION_VISIBILITY_SETTINGS,
): NavigationVisibilitySettings => {
  const visibilitySource = data?.menuVisibility && typeof data.menuVisibility === 'object'
    ? data.menuVisibility
    : {};
  const adminOnlySource = data?.menuAdminOnly && typeof data.menuAdminOnly === 'object'
    ? data.menuAdminOnly
    : {};

  return {
    menuVisibility: {
      home: asBooleanOrFallback(visibilitySource.home, fallback.menuVisibility.home),
      explore: asBooleanOrFallback(visibilitySource.explore, fallback.menuVisibility.explore ?? true),
      studio: asBooleanOrFallback(visibilitySource.studio, fallback.menuVisibility.studio),
      musicNote: asBooleanOrFallback(visibilitySource.musicNote, fallback.menuVisibility.musicNote),
      library: asBooleanOrFallback(
        visibilitySource.library,
        typeof data?.showSunoLibraryMenu === 'boolean'
          ? data.showSunoLibraryMenu
          : fallback.menuVisibility.library,
      ),
      lab: asBooleanOrFallback(visibilitySource.lab, fallback.menuVisibility.lab),
      myPage: asBooleanOrFallback(visibilitySource.myPage, fallback.menuVisibility.myPage),
    },
    menuAdminOnly: {
      home: asBooleanOrFallback(adminOnlySource.home, fallback.menuAdminOnly.home),
      explore: asBooleanOrFallback(adminOnlySource.explore, fallback.menuAdminOnly.explore ?? false),
      studio: asBooleanOrFallback(adminOnlySource.studio, fallback.menuAdminOnly.studio),
      musicNote: asBooleanOrFallback(adminOnlySource.musicNote, fallback.menuAdminOnly.musicNote),
      library: asBooleanOrFallback(
        adminOnlySource.library,
        typeof data?.sunoLibraryMenuAdminOnly === 'boolean'
          ? data.sunoLibraryMenuAdminOnly
          : fallback.menuAdminOnly.library,
      ),
      lab: asBooleanOrFallback(adminOnlySource.lab, fallback.menuAdminOnly.lab),
      myPage: asBooleanOrFallback(adminOnlySource.myPage, fallback.menuAdminOnly.myPage),
    },
  };
};

export const readStoredNavigationVisibilitySettings = (): NavigationVisibilitySettings => {
  try {
    const raw = localStorage.getItem(NAVIGATION_VISIBILITY_STORAGE_KEY)
      || localStorage.getItem(LEGACY_NAVIGATION_VISIBILITY_STORAGE_KEY);
    if (raw) {
      return normalizeNavigationVisibilitySettings(JSON.parse(raw));
    }

    const legacyLibraryVisible = localStorage.getItem(LEGACY_LIBRARY_VISIBILITY_STORAGE_KEY) === 'true';
    const legacyLibraryAdminOnly = localStorage.getItem(LEGACY_LIBRARY_ADMIN_ONLY_STORAGE_KEY) === 'true';
    return {
      menuVisibility: {
        ...DEFAULT_NAVIGATION_MENU_VISIBILITY,
        library: legacyLibraryVisible,
      },
      menuAdminOnly: {
        ...DEFAULT_NAVIGATION_MENU_ADMIN_ONLY,
        library: legacyLibraryAdminOnly,
      },
    };
  } catch {
    return DEFAULT_NAVIGATION_VISIBILITY_SETTINGS;
  }
};

export const writeStoredNavigationVisibilitySettings = (settings: NavigationVisibilitySettings) => {
  try {
    localStorage.setItem(NAVIGATION_VISIBILITY_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem(LEGACY_NAVIGATION_VISIBILITY_STORAGE_KEY, JSON.stringify({
      menuVisibility: settings.menuVisibility,
      sunoLibraryMenuAdminOnly: settings.menuAdminOnly.library,
    }));
    localStorage.setItem(
      LEGACY_LIBRARY_VISIBILITY_STORAGE_KEY,
      settings.menuVisibility.library ? 'true' : 'false',
    );
    localStorage.setItem(
      LEGACY_LIBRARY_ADMIN_ONLY_STORAGE_KEY,
      settings.menuAdminOnly.library ? 'true' : 'false',
    );
  } catch {
    // localStorage may be unavailable. Firestore remains the source of truth.
  }
};

export const getNavigationFirestorePayload = (settings: NavigationVisibilitySettings) => ({
  menuVisibility: {
    ...settings.menuVisibility,
    explore: settings.menuVisibility.explore ?? true,
  },
  menuAdminOnly: {
    ...settings.menuAdminOnly,
    explore: settings.menuAdminOnly.explore ?? false,
  },
  // Keep legacy library fields so older deployed clients continue to behave correctly.
  showSunoLibraryMenu: settings.menuVisibility.library,
  sunoLibraryMenuAdminOnly: settings.menuAdminOnly.library,
});

export const getNavigationMenuAccessMode = (
  settings: NavigationVisibilitySettings,
  key: NavigationMenuKey,
): NavigationMenuAccessMode => {
  const visible = key === 'explore'
    ? (settings.menuVisibility.explore ?? true)
    : settings.menuVisibility[key];
  if (!visible) return 'hidden';
  const adminOnly = key === 'explore'
    ? (settings.menuAdminOnly.explore ?? false)
    : settings.menuAdminOnly[key];
  return adminOnly ? 'admin' : 'public';
};

export const setNavigationMenuAccessMode = (
  settings: NavigationVisibilitySettings,
  key: NavigationMenuKey,
  mode: NavigationMenuAccessMode,
): NavigationVisibilitySettings => ({
  menuVisibility: {
    ...settings.menuVisibility,
    [key]: mode !== 'hidden',
  },
  menuAdminOnly: {
    ...settings.menuAdminOnly,
    [key]: mode === 'admin',
  },
});

export const NAVIGATION_MENU_PATHS: Record<NavigationMenuKey, string> = {
  home: '/',
  explore: '/explore',
  studio: '/studio',
  musicNote: '/history',
  library: '/suno-library',
  lab: '/lab',
  myPage: '/my-page',
};

export const getFirstEnabledNavigationPath = (visibility: NavigationMenuVisibility): string => {
  const firstEnabled = NAVIGATION_MENU_KEYS.find((key) => (
    key === 'explore' ? (visibility.explore ?? true) : visibility[key]
  ));
  return firstEnabled ? NAVIGATION_MENU_PATHS[firstEnabled] : '/';
};