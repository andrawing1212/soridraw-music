import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken as getAppCheckToken } from "firebase/app-check";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyB_XyRUffNmJ5iugtvqx_3yY-rLi6PaumA",
  authDomain: "soridraw-app-866a5.firebaseapp.com",
  projectId: "soridraw-app-866a5",
  storageBucket: "soridraw-app-866a5.firebasestorage.app",
  messagingSenderId: "91309780603",
  appId: "1:91309780603:web:cde703895e2cf31ecffcde"
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

const CLOUD_FUNCTIONS_HOST = "us-central1-soridraw-app-866a5.cloudfunctions.net";
const CLOUD_FUNCTIONS_FETCH_GUARD_FLAG = "__soridrawAppCheckFetchGuardInstalled";

// Every SORIDRAW HTTP Function request receives the same App Check token path.
// Missing/invalid tokens are still accepted until server enforcement is enabled.
const installCloudFunctionsAppCheckFetchGuard = () => {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (window[CLOUD_FUNCTIONS_FETCH_GUARD_FLAG]) return;

  const originalFetch = window.fetch.bind(window);
  window[CLOUD_FUNCTIONS_FETCH_GUARD_FLAG] = true;

  window.fetch = async (input, init) => {
    let parsedUrl;
    try {
      const rawUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input?.url || "";
      parsedUrl = new URL(rawUrl, window.location.href);
    } catch {
      return originalFetch(input, init);
    }

    if (parsedUrl.hostname !== CLOUD_FUNCTIONS_HOST) {
      return originalFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    const appCheckToken = await getFirebaseAppCheckToken();
    if (appCheckToken && !headers.has("X-Firebase-AppCheck")) {
      headers.set("X-Firebase-AppCheck", appCheckToken);
    }

    const response = await originalFetch(input, { ...(init || {}), headers });
    const status = response.headers.get("X-SORIDRAW-App-Check-Status");
    if (status) {
      console.info(`[SORIDRAW App Check] ${parsedUrl.pathname}: ${status}`);
    }
    return response;
  };
};

// AI Studio preview and local/unknown hosts must not replace the global fetch
// implementation. Some preview sandboxes expose fetch as a protected property,
// and assigning to it can stop the Firebase module before React mounts.
if (isVercelTestApp || isFirebaseHostedApp) {
  try {
    installCloudFunctionsAppCheckFetchGuard();
  } catch (error) {
    console.warn("[SORIDRAW App Check] Functions fetch guard skipped:", error);
  }
}

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export { httpsCallable };
