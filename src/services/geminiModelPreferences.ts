import { auth } from "../firebase";

const GEMINI_AUTO_MODEL_FALLBACK_STORAGE_BASE = "soridraw.geminiAutoModelFallback.v1";
const GEMINI_MODEL_COOLDOWN_STORAGE_BASE = "soridraw.geminiModelCooldown.v1";

const getStorageKey = (uid?: string | null) =>
  `${GEMINI_AUTO_MODEL_FALLBACK_STORAGE_BASE}.${String(uid || "guest")}`;

const getCooldownStorageKey = (uid?: string | null) =>
  `${GEMINI_MODEL_COOLDOWN_STORAGE_BASE}.${String(uid || "guest")}`;

export const DEFAULT_GEMINI_AUTO_MODEL_FALLBACK = true;

type GeminiModelCooldownEntry = {
  until: number;
  reason: string;
};

type GeminiModelCooldownMap = Record<string, GeminiModelCooldownEntry>;

function resolveGeminiPreferenceUid(uid?: string | null): string | null {
  return uid || auth.currentUser?.uid || null;
}

function readGeminiModelCooldownMap(uid?: string | null): GeminiModelCooldownMap {
  if (typeof window === "undefined") return {};
  const resolvedUid = resolveGeminiPreferenceUid(uid);
  if (!resolvedUid) return {};
  try {
    const raw = window.localStorage.getItem(getCooldownStorageKey(resolvedUid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const now = Date.now();
    const next: GeminiModelCooldownMap = {};
    let changed = false;
    for (const [model, value] of Object.entries(parsed as Record<string, any>)) {
      const until = Number(value?.until || 0);
      if (!Number.isFinite(until) || until <= now) {
        changed = true;
        continue;
      }
      next[model] = {
        until,
        reason: String(value?.reason || "temporary_model_cooldown").trim() || "temporary_model_cooldown",
      };
    }
    if (changed) {
      if (Object.keys(next).length) {
        window.localStorage.setItem(getCooldownStorageKey(resolvedUid), JSON.stringify(next));
      } else {
        window.localStorage.removeItem(getCooldownStorageKey(resolvedUid));
      }
    }
    return next;
  } catch {
    return {};
  }
}

export function readGeminiAutoModelFallback(uid?: string | null): boolean {
  if (typeof window === "undefined") return DEFAULT_GEMINI_AUTO_MODEL_FALLBACK;
  const resolvedUid = resolveGeminiPreferenceUid(uid);
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
  const resolvedUid = resolveGeminiPreferenceUid(uid);
  if (!resolvedUid) return;
  try {
    window.localStorage.setItem(getStorageKey(resolvedUid), enabled ? "true" : "false");
  } catch {
    // Browser storage may be unavailable. Firestore remains the account source of truth.
  }
}

export function getGeminiModelCooldown(
  model: string,
  uid?: string | null,
): { remainingMs: number; reason: string } | null {
  const normalizedModel = String(model || "").trim();
  if (!normalizedModel) return null;
  const entry = readGeminiModelCooldownMap(uid)[normalizedModel];
  if (!entry) return null;
  const remainingMs = Math.max(0, entry.until - Date.now());
  return remainingMs > 0 ? { remainingMs, reason: entry.reason } : null;
}

export function setGeminiModelCooldown(
  model: string,
  durationMs: number,
  reason: string,
  uid?: string | null,
): void {
  if (typeof window === "undefined") return;
  const resolvedUid = resolveGeminiPreferenceUid(uid);
  const normalizedModel = String(model || "").trim();
  if (!resolvedUid || !normalizedModel) return;
  const safeDurationMs = Math.max(1_000, Math.min(30 * 60_000, Math.round(Number(durationMs) || 0)));
  try {
    const current = readGeminiModelCooldownMap(resolvedUid);
    const nextUntil = Date.now() + safeDurationMs;
    const previousUntil = Number(current[normalizedModel]?.until || 0);
    current[normalizedModel] = {
      until: Math.max(previousUntil, nextUntil),
      reason: String(reason || current[normalizedModel]?.reason || "temporary_model_cooldown").trim() || "temporary_model_cooldown",
    };
    window.localStorage.setItem(getCooldownStorageKey(resolvedUid), JSON.stringify(current));
  } catch {
    // Cooldown is a latency optimization only. Failure must never block generation.
  }
}

export function clearGeminiModelCooldown(model: string, uid?: string | null): void {
  if (typeof window === "undefined") return;
  const resolvedUid = resolveGeminiPreferenceUid(uid);
  const normalizedModel = String(model || "").trim();
  if (!resolvedUid || !normalizedModel) return;
  try {
    const current = readGeminiModelCooldownMap(resolvedUid);
    if (!current[normalizedModel]) return;
    delete current[normalizedModel];
    if (Object.keys(current).length) {
      window.localStorage.setItem(getCooldownStorageKey(resolvedUid), JSON.stringify(current));
    } else {
      window.localStorage.removeItem(getCooldownStorageKey(resolvedUid));
    }
  } catch {
    // Cooldown is a latency optimization only. Failure must never block generation.
  }
}
