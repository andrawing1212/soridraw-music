import { initializeApp } from "firebase/app";
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

const patchAuthPopupWindowOpenForEdge = () => {
  if (typeof window === "undefined" || window.__soridrawAuthPopupPatchApplied) return;

  window.__soridrawAuthPopupPatchApplied = true;
  const nativeOpen = window.open.bind(window);

  window.open = (url, target, features) => {
    const safeUrl = typeof url === "string" ? url : String(url || "");
    const isFirebaseAuthPopup =
      safeUrl.includes("accounts.google.com") ||
      safeUrl.includes("/__/auth/handler") ||
      safeUrl.includes("firebaseapp.com/__/auth") ||
      safeUrl.includes("firebaseapp.com/__/auth/iframe");

    if (!isFirebaseAuthPopup) {
      return nativeOpen(url, target, features);
    }

    const width = 520;
    const height = 680;
    const left = Math.max(0, Math.round((window.screenX || window.screenLeft || 0) + ((window.outerWidth || window.innerWidth || width) - width) / 2));
    const top = Math.max(0, Math.round((window.screenY || window.screenTop || 0) + ((window.outerHeight || window.innerHeight || height) - height) / 2));
    const popupFeatures = [
      "popup=yes",
      "resizable=yes",
      "scrollbars=yes",
      "status=yes",
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      features || ""
    ].filter(Boolean).join(",");

    return nativeOpen(url, target || "_blank", popupFeatures);
  };
};

patchAuthPopupWindowOpenForEdge();

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export { httpsCallable };
