export const NAVIGATION_VISIBILITY_STORAGE_KEY = 'soridraw_navigation_visibility_v2';
export const LEGACY_LIBRARY_VISIBILITY_STORAGE_KEY = 'soridraw_navigation_show_suno_library_menu';
export const LEGACY_LIBRARY_ADMIN_ONLY_STORAGE_KEY = 'soridraw_navigation_suno_library_admin_only';

export const NAVIGATION_MENU_KEYS = ['home', 'studio', 'musicNote', 'library', 'lab', 'myPage'] as const;
export type NavigationMenuKey = typeof NAVIGATION_MENU_KEYS[number];

export type NavigationMenuVisibility = Record<NavigationMenuKey, boolean>;

export type NavigationVisibilitySettings = {
  menuVisibility: NavigationMenuVisibility;
  sunoLibraryMenuAdminOnly: boolean;
};

export const DEFAULT_NAVIGATION_MENU_VISIBILITY: NavigationMenuVisibility = {
  home: true,
  studio: true,
  musicNote: true,
  library: false,
  lab: true,
  myPage: true,
};

export const DEFAULT_NAVIGATION_VISIBILITY_SETTINGS: NavigationVisibilitySettings = {
  menuVisibility: DEFAULT_NAVIGATION_MENU_VISIBILITY,
  sunoLibraryMenuAdminOnly: false,
};

const asBooleanOrFallback = (value: unknown, fallback: boolean) => (
  typeof value === 'boolean' ? value : fallback
);

export const normalizeNavigationVisibilitySettings = (
  data: any,
  fallback: NavigationVisibilitySettings = DEFAULT_NAVIGATION_VISIBILITY_SETTINGS,
): NavigationVisibilitySettings => {
  const source = data?.menuVisibility && typeof data.menuVisibility === 'object'
    ? data.menuVisibility
    : {};

  return {
    menuVisibility: {
      home: asBooleanOrFallback(source.home, fallback.menuVisibility.home),
      studio: asBooleanOrFallback(source.studio, fallback.menuVisibility.studio),
      musicNote: asBooleanOrFallback(source.musicNote, fallback.menuVisibility.musicNote),
      library: asBooleanOrFallback(
        source.library,
        typeof data?.showSunoLibraryMenu === 'boolean'
          ? data.showSunoLibraryMenu
          : fallback.menuVisibility.library,
      ),
      lab: asBooleanOrFallback(source.lab, fallback.menuVisibility.lab),
      myPage: asBooleanOrFallback(source.myPage, fallback.menuVisibility.myPage),
    },
    sunoLibraryMenuAdminOnly: asBooleanOrFallback(
      data?.sunoLibraryMenuAdminOnly,
      fallback.sunoLibraryMenuAdminOnly,
    ),
  };
};

export const readStoredNavigationVisibilitySettings = (): NavigationVisibilitySettings => {
  try {
    const raw = localStorage.getItem(NAVIGATION_VISIBILITY_STORAGE_KEY);
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
      sunoLibraryMenuAdminOnly: legacyLibraryAdminOnly,
    };
  } catch {
    return DEFAULT_NAVIGATION_VISIBILITY_SETTINGS;
  }
};

export const writeStoredNavigationVisibilitySettings = (settings: NavigationVisibilitySettings) => {
  try {
    localStorage.setItem(NAVIGATION_VISIBILITY_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem(
      LEGACY_LIBRARY_VISIBILITY_STORAGE_KEY,
      settings.menuVisibility.library ? 'true' : 'false',
    );
    localStorage.setItem(
      LEGACY_LIBRARY_ADMIN_ONLY_STORAGE_KEY,
      settings.sunoLibraryMenuAdminOnly ? 'true' : 'false',
    );
  } catch {
    // localStorage may be unavailable. Firestore remains the source of truth.
  }
};

export const getNavigationFirestorePayload = (settings: NavigationVisibilitySettings) => ({
  menuVisibility: settings.menuVisibility,
  // Keep the legacy fields so older deployed clients continue to behave correctly.
  showSunoLibraryMenu: settings.menuVisibility.library,
  sunoLibraryMenuAdminOnly: settings.sunoLibraryMenuAdminOnly,
});

export const NAVIGATION_MENU_PATHS: Record<NavigationMenuKey, string> = {
  home: '/',
  studio: '/studio',
  musicNote: '/history',
  library: '/suno-library',
  lab: '/lab',
  myPage: '/my-page',
};

export const getFirstEnabledNavigationPath = (visibility: NavigationMenuVisibility): string => {
  const firstEnabled = NAVIGATION_MENU_KEYS.find((key) => visibility[key]);
  return firstEnabled ? NAVIGATION_MENU_PATHS[firstEnabled] : '/';
};
