import { auth } from "../firebase";

const GEMINI_AUTO_MODEL_FALLBACK_STORAGE_BASE = "soridraw.geminiAutoModelFallback.v1";

const getStorageKey = (uid?: string | null) =>
  `${GEMINI_AUTO_MODEL_FALLBACK_STORAGE_BASE}.${String(uid || "guest")}`;

export const DEFAULT_GEMINI_AUTO_MODEL_FALLBACK = true;

export function readGeminiAutoModelFallback(uid?: string | null): boolean {
  if (typeof window === "undefined") return DEFAULT_GEMINI_AUTO_MODEL_FALLBACK;
  const resolvedUid = uid || auth.currentUser?.uid || null;
  if (!resolvedUid) return DEFAULT_GEMINI_AUTO_MODEL_FALLBACK;
  try {
    return window.localStorage.getItem(getStorageKey(resolvedUid)) !== "false";
  } catch {
    return DEFAULT_GEMINI_AUTO_MODEL_FALLBACK;
  }
}

export function writeGeminiAutoModelFallback(
  enabled: boolean,
  uid?: string | null,
): void {
  if (typeof window === "undefined") return;
  const resolvedUid = uid || auth.currentUser?.uid || null;
  if (!resolvedUid) return;
  try {
    window.localStorage.setItem(getStorageKey(resolvedUid), enabled ? "true" : "false");
  } catch {
    // Browser storage may be unavailable. Firestore remains the account source of truth.
  }
}
