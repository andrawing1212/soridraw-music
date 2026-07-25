import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken as getAppCheckToken } from "firebase/app-check";
import { getAuth, initializeAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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
const isFirebaseHostedApp = currentHostname === "soridraw.web.app"
  || currentHostname === "soridraw.firebaseapp.com"
  || currentHostname === "soridraw-app-866a5.web.app"
  || currentHostname === "soridraw-app-866a5.firebaseapp.com";

// AI Studio previews run inside an ephemeral run.app development host where
// reCAPTCHA Enterprise can fail. Firebase's debug provider is enabled only
// for that explicit host pattern; deployed Vercel/Firebase/custom domains
// continue to use real reCAPTCHA Enterprise attestation.
if (isAiStudioPreview && typeof self !== "undefined") {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

let appCheck = null;
// Use the reCAPTCHA Enterprise site key that is registered to this Firebase web
// app and whose website-key domain list includes the Vercel test host and the
// Firebase production hosts. AI Studio keeps the registered debug-provider
// path; deployed Vercel/Firebase hosts use real reCAPTCHA Enterprise attestation.
const APP_CHECK_SITE_KEY = "6Le6bGEtAAAAAOVROhuXew0lxJcpVNVwPZN0ZWKO";
const shouldInitializeAppCheck = isAiStudioPreview || isVercelTestApp || isFirebaseHostedApp;
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
    console.info("[Firebase App Check] token status: disabled");
    return "";
  }
  try {
    const result = await getAppCheckToken(appCheck, false);
    const token = result?.token || "";
    console.info(`[Firebase App Check] token status: ${token ? "available" : "missing"}`);
    return token;
  } catch (error) {
    console.warn("[Firebase App Check] token status: unavailable", error);
    return "";
  }
};

// App Check tokens are requested explicitly by SORIDRAW API callers.
// Do not replace window.fetch globally: Firebase Auth popup sign-in and other
// browser integrations must keep the native fetch implementation.

const readRememberLoginPreference = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("rememberLogin") === "true";
  } catch {
    return false;
  }
};

const initialAuthPersistence = readRememberLoginPreference()
  ? browserLocalPersistence
  : browserSessionPersistence;

export const auth = (() => {
  try {
    return initializeAuth(app, { persistence: initialAuthPersistence });
  } catch (error) {
    // Vite hot reload can reuse an already initialized Auth instance.
    // Keep the saved login preference aligned without forcing every browser
    // into local persistence.
    const existingAuth = getAuth(app);
    void setPersistence(existingAuth, initialAuthPersistence).catch((persistenceError) => {
      console.warn("[Firebase Auth] persistence setup failed:", persistenceError);
    });
    return existingAuth;
  }
})();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
export const db = getFirestore(app);
export const realtimeDb = getDatabase(app);
export const functions = getFunctions(app, "us-central1");
export { httpsCallable };
