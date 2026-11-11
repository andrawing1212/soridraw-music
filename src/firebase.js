import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken as getAppCheckToken } from "firebase/app-check";
import { initializeAuth, browserPopupRedirectResolver, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, GoogleAuthProvider } from "firebase/auth";
import { selectStartupAuthPersistence, protectInitialAuthRestore } from "./lib/authRestorePersistence";
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyB_XyRUffNmJ5iugtvqx_3yY-rLi6PaumA",
  authDomain: "soridraw-app-866a5.firebaseapp.com",
  projectId: "soridraw-app-866a5",
  storageBucket: "soridraw-app-866a5.firebasestorage.app",
  messagingSenderId: "91309780603",
  appId: "1:91309780603:web:cde703895e2cf31ecffcde",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://soridraw-app-866a5-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

const currentHostname = typeof window === "undefined"
  ? ""
  : window.location.hostname.toLowerCase();
const isAiStudioPreview = /^ais-dev-[a-z0-9-]+-[0-9]+\.[a-z0-9-]+\.run\.app$/.test(currentHostname);
const isVercelTestApp = currentHostname === "soridraw-music.vercel.app";
const isVercelPreviewApp = currentHostname === "soridraw-music-git-preview-andrawing1212.vercel.app"
  || /^soridraw-music-git-preview-[a-z0-9-]+\.vercel\.app$/.test(currentHostname);
const isFirebaseHostingPreviewApp = /^soridraw--[a-z0-9-]+\.web\.app$/.test(currentHostname);
const isFirebaseMultiSiteApp = currentHostname === "soridraw-preview.web.app"
  || currentHostname === "soridraw-preview.firebaseapp.com"
  || currentHostname === "soridraw-test.web.app"
  || currentHostname === "soridraw-test.firebaseapp.com";
const isSoridrawCustomDomain = currentHostname === "preview.soridraw.com"
  || currentHostname === "test.soridraw.com"
  || currentHostname === "soridraw.com"
  || currentHostname === "www.soridraw.com";
const isFirebaseHostedApp = currentHostname === "soridraw.web.app"
  || currentHostname === "soridraw.firebaseapp.com"
  || currentHostname === "soridraw-app-866a5.web.app"
  || currentHostname === "soridraw-app-866a5.firebaseapp.com"
  || isFirebaseHostingPreviewApp
  || isFirebaseMultiSiteApp
  || isSoridrawCustomDomain;

// AI Studio previews run inside an ephemeral run.app development host where
// reCAPTCHA Enterprise can fail. Firebase's debug provider is enabled only
// for that explicit host pattern; deployed Vercel/Firebase/custom domains
// continue to use real reCAPTCHA Enterprise attestation.
if (isAiStudioPreview && typeof self !== "undefined") {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

let appCheck = null;
// Use the reCAPTCHA Enterprise site key that is registered to this Firebase web
// app. Vercel preview/test and Firebase production hosts use real Enterprise
// attestation; only the explicit AI Studio run.app pattern uses the debug path.
const APP_CHECK_SITE_KEY = "6Le6bGEtAAAAAOVROhuXew0lxJcpVNVwPZN0ZWKO";
const shouldInitializeAppCheck = isAiStudioPreview || isVercelPreviewApp || isVercelTestApp || isFirebaseHostedApp;
if (APP_CHECK_SITE_KEY && shouldInitializeAppCheck && typeof window !== "undefined") {
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn("[Firebase App Check] initialization skipped:", error);
  }
}

export const getFirebaseAppCheckToken = async () => {
  if (!appCheck) {
    return "";
  }
  try {
    const result = await getAppCheckToken(appCheck, false);
    const token = result?.token || "";
    return token;
  } catch (error) {
    console.warn("[Firebase App Check] token status: unavailable", error);
    return "";
  }
};

// App Check tokens are requested explicitly by SORIDRAW API callers.
// Do not replace window.fetch globally: Firebase Auth popup sign-in and other
// browser integrations must keep the native fetch implementation.

// Store ONLY the remember-login boolean in a small first-party functional cookie.
// Firebase credentials/tokens remain exclusively under the SDK's control.
// The cookie survives a full localStorage quota (when cookies are allowed).
const REMEMBER_LOGIN_COOKIE = 'soridraw_remember_login_v1';
const readRememberLoginCookie = () => {
  if (typeof document === 'undefined') return null;
  try {
    const prefix = REMEMBER_LOGIN_COOKIE + '=';
    const match = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
    const value = match ? match.slice(prefix.length) : '';
    return value === '1' ? true : value === '0' ? false : null;
  } catch {
    return null;
  }
};

export const readRememberLoginPreference = () => {
  const cookieValue = readRememberLoginCookie();
  // The cookie wins if localStorage contains stale OFF following a quota failure.
  if (cookieValue !== null) return cookieValue;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('rememberLogin') === 'true';
  } catch {
    // Unknown is NOT a user opt-out. Prefer protecting a previously durable
    // account over silently selecting tab-only Auth on a blocked browser store.
    return true;
  }
};

export const writeRememberLoginPreference = (value) => {
  if (typeof document !== 'undefined') {
    try {
      const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = REMEMBER_LOGIN_COOKIE + '=' + (value ? '1' : '0')
        + '; Path=/; Max-Age=31536000; SameSite=Lax' + secure;
    } catch {
      // Some restricted browsers block cookies too; never delete other data.
    }
  }
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem('rememberLogin', String(value));
    return true;
  } catch {
    return false;
  }
};

// Firebase migrates a recovered user to the first available store in an
// array, clearing SDK Auth keys in the other stores. That can log out an older
// open tab. Restore from ONE original persistence instead: detect LOCAL/SESSION
// using key existence only, otherwise allow IndexedDB. New login modes remain
// explicitly selected in App.tsx after authStateReady().
const safeBrowserStore = (name) => {
  try { return typeof window !== 'undefined' ? window[name] : null; }
  catch { return null; }
};
const startupAuthStore = selectStartupAuthPersistence({
  apiKey: firebaseConfig.apiKey,
  rememberLogin: readRememberLoginPreference(),
  localStorage: safeBrowserStore('localStorage'),
  sessionStorage: safeBrowserStore('sessionStorage'),
});
const startupAuthPersistence = startupAuthStore === 'local'
  ? browserLocalPersistence
  : startupAuthStore === 'session'
    ? browserSessionPersistence : indexedDBLocalPersistence;

let startupAuthWriteBlocked = false;
const safeStartupAuth = protectInitialAuthRestore(startupAuthPersistence, () => {
  // No token, user object, or browser data is read/copied into this marker.
  startupAuthWriteBlocked = true;
});
export const didAuthRestoreStorageWriteFail = () => startupAuthWriteBlocked;
export const auth = initializeAuth(app, {
  persistence: safeStartupAuth.persistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
// The wrapper's startup-only protection must not mask writes from new sign-in.
void auth.authStateReady().then(safeStartupAuth.markReady, safeStartupAuth.markReady);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
let firestoreDb;
try {
  // Auth persistence and Firestore cache persistence are intentionally independent.
  // "Remember login" controls only Firebase Auth. Deployed SORIDRAW apps always use
  // the in-memory Firestore cache so a full browser storage quota cannot break the
  // Firestore client's multi-tab persistence metadata and crash the whole app.
  // Persistent multi-tab cache remains development-only for short local/AI Studio
  // reload cycles where clearing browser storage is part of the development workflow.
  const shouldUsePersistentFirestoreCache = isAiStudioPreview
    || currentHostname === "localhost"
    || currentHostname === "127.0.0.1";

  firestoreDb = initializeFirestore(app, {
    localCache: shouldUsePersistentFirestoreCache
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
  });
} catch (error) {
  console.warn("[Firestore] cache initialization unavailable; using default memory cache:", error);
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;
export const realtimeDb = getDatabase(app);
export const functions = getFunctions(app, "us-central1");
export { httpsCallable };
