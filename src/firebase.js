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
// Use the exact reCAPTCHA Enterprise site key registered to the SORIDRAW
// Firebase web app. The previous Vercel 400 came from a different site key in
// the client bundle, even though the registered key and domains were correct.
// AI Studio keeps its registered debug provider; Vercel and Firebase Hosting
// use real reCAPTCHA Enterprise attestation.
const APP_CHECK_SITE_KEY = "6Ld7iWAtAAAAAIJQFwoYsnfxl1elxKE1Qtcqcs8H";
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
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export { httpsCallable };
