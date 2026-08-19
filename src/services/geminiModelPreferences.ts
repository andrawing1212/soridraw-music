import { auth } from "../firebase";

const GEMINI_AUTO_MODEL_FALLBACK_STORAGE_BASE = "soridraw.geminiAutoModelFallback.v1";
const GEMINI_MODEL_COOLDOWN_STORAGE_BASE = "soridraw.geminiModelCooldown.v1";
const GEMINI_MODEL_COOLDOWN_GUEST_SCOPE = "guest";

const getStorageKey = (uid?: string | null) =>
  `${GEMINI_AUTO_MODEL_FALLBACK_STORAGE_BASE}.${String(uid || "guest")}`;

const getCooldownStorageKey = (uid?: string | null) =>
  `${GEMINI_MODEL_COOLDOWN_STORAGE_BASE}.${String(uid || GEMINI_MODEL_COOLDOWN_GUEST_SCOPE)}`;

export const DEFAULT_GEMINI_AUTO_MODEL_FALLBACK = true;

type GeminiModelCooldownEntry = {
  until: number;
  reason: string;
};

type GeminiModelCooldownMap = Record<string, GeminiModelCooldownEntry>;

// Session memory is the zero-latency source of truth for the current tab. The
// persisted copy only exists so a refresh does not immediately hit a model that
// just returned quota/high-demand. This also protects every generation path
// (initial song, repair, correction, language-mix retry) even when Firebase Auth
// has not finished exposing currentUser yet.
let sessionCooldowns: GeminiModelCooldownMap = {};

function resolveGeminiPreferenceUid(uid?: string | null): string | null {
  return uid || auth.currentUser?.uid || null;
}

function sanitizeCooldownMap(value: unknown): GeminiModelCooldownMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const now = Date.now();
  const next: GeminiModelCooldownMap = {};
  for (const [model, entry] of Object.entries(value as Record<string, any>)) {
    const until = Number(entry?.until || 0);
    if (!Number.isFinite(until) || until <= now) continue;
    const reason = String(entry?.reason || "temporary_model_cooldown").trim() || "temporary_model_cooldown";
    // 853 migration: old 847-852 quota cooldowns could persist for 5-10 minutes.
    // New quota policy is Retry-After based and capped at 60s, so clamp only
    // legacy quota entries. Other timeout/overload cooldowns are preserved.
    const safeUntil = reason === "quota_or_rate_limit"
      ? Math.min(until, now + 60_000)
      : until;
    next[model] = {
      until: safeUntil,
      reason,
    };
  }
  return next;
}

function mergeCooldownMaps(...maps: GeminiModelCooldownMap[]): GeminiModelCooldownMap {
  const merged: GeminiModelCooldownMap = {};
  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([model, entry]) => {
      const previous = merged[model];
      if (!previous || entry.until > previous.until) merged[model] = entry;
    });
  });
  return merged;
}

function readStoredCooldownMap(scope: string): GeminiModelCooldownMap {
  if (typeof window === "undefined") return {};
  try {
    const key = getCooldownStorageKey(scope);
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const sanitized = sanitizeCooldownMap(JSON.parse(raw));
    if (Object.keys(sanitized).length) {
      window.localStorage.setItem(key, JSON.stringify(sanitized));
    } else {
      window.localStorage.removeItem(key);
    }
    return sanitized;
  } catch {
    return {};
  }
}

function writeStoredCooldownMap(scope: string, map: GeminiModelCooldownMap): void {
  if (typeof window === "undefined") return;
  try {
    const key = getCooldownStorageKey(scope);
    const sanitized = sanitizeCooldownMap(map);
    if (Object.keys(sanitized).length) {
      window.localStorage.setItem(key, JSON.stringify(sanitized));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage is a persistence bonus only; session memory still protects latency.
  }
}

function readGeminiModelCooldownMap(uid?: string | null): GeminiModelCooldownMap {
  sessionCooldowns = sanitizeCooldownMap(sessionCooldowns);
  if (typeof window === "undefined") return sessionCooldowns;

  const resolvedUid = resolveGeminiPreferenceUid(uid);
  const primaryScope = resolvedUid || GEMINI_MODEL_COOLDOWN_GUEST_SCOPE;
  const primary = readStoredCooldownMap(primaryScope);

  // A generation can begin while Firebase Auth is still hydrating and then enter
  // a repair pass after currentUser becomes available. Migrate the short-lived
  // guest cooldown into the authenticated scope so the second pass never retries
  // a model that already failed earlier in the same song.
  let guest: GeminiModelCooldownMap = {};
  if (resolvedUid) {
    guest = readStoredCooldownMap(GEMINI_MODEL_COOLDOWN_GUEST_SCOPE);
  }

  const merged = mergeCooldownMaps(sessionCooldowns, primary, guest);
  sessionCooldowns = merged;

  if (resolvedUid && Object.keys(guest).length) {
    writeStoredCooldownMap(resolvedUid, merged);
    writeStoredCooldownMap(GEMINI_MODEL_COOLDOWN_GUEST_SCOPE, {});
  }

  return merged;
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
  const normalizedModel = String(model || "").trim();
  if (!normalizedModel) return;
  const normalizedReason = String(reason || "temporary_model_cooldown").trim() || "temporary_model_cooldown";
  const requestedDurationMs = Math.max(1_000, Math.min(30 * 60_000, Math.round(Number(durationMs) || 0)));
  // 853 safety net: the Function now returns Retry-After based quota cooldowns.
  // Never let an older/fallback client path inflate quota_or_rate_limit back into
  // the legacy multi-minute lock; provider-guided cooldowns are capped at 60s.
  const safeDurationMs = normalizedReason === "quota_or_rate_limit"
    ? Math.min(60_000, requestedDurationMs)
    : requestedDurationMs;
  const nextUntil = Date.now() + safeDurationMs;
  const existing = readGeminiModelCooldownMap(uid)[normalizedModel];
  const nextEntry: GeminiModelCooldownEntry = {
    until: Math.max(Number(existing?.until || 0), nextUntil),
    reason: normalizedReason || existing?.reason || "temporary_model_cooldown",
  };

  // Always update memory first so a correction launched milliseconds later sees
  // the cooldown without another storage/Auth dependency.
  sessionCooldowns = {
    ...sanitizeCooldownMap(sessionCooldowns),
    [normalizedModel]: nextEntry,
  };

  if (typeof window === "undefined") return;
  const resolvedUid = resolveGeminiPreferenceUid(uid);
  const scope = resolvedUid || GEMINI_MODEL_COOLDOWN_GUEST_SCOPE;
  const stored = readStoredCooldownMap(scope);
  writeStoredCooldownMap(scope, {
    ...stored,
    [normalizedModel]: nextEntry,
  });
}

export function clearGeminiModelCooldown(model: string, uid?: string | null): void {
  const normalizedModel = String(model || "").trim();
  if (!normalizedModel) return;

  if (sessionCooldowns[normalizedModel]) {
    const next = { ...sessionCooldowns };
    delete next[normalizedModel];
    sessionCooldowns = sanitizeCooldownMap(next);
  }

  if (typeof window === "undefined") return;
  const resolvedUid = resolveGeminiPreferenceUid(uid);
  const scopes = Array.from(new Set([
    resolvedUid || GEMINI_MODEL_COOLDOWN_GUEST_SCOPE,
    GEMINI_MODEL_COOLDOWN_GUEST_SCOPE,
  ]));
  scopes.forEach((scope) => {
    const current = readStoredCooldownMap(scope);
    if (!current[normalizedModel]) return;
    delete current[normalizedModel];
    writeStoredCooldownMap(scope, current);
  });
}
