import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906
const SCHEMA_VERSION = 2;
const MAX_ITEMS = 400;
const MAX_DELETED_IDS = 450;
const MAX_BYTES = 800_000;
const ALLOWED_PREVIEW_HOSTS = new Set([
  "preview.soridraw.com",
  "soridraw-preview.web.app",
  "soridraw-preview.firebaseapp.com",
]);

type AdaptiveKind = "musicNote" | "library";

const getOriginHost = (originValue: unknown): string => {
  const origin = String(originValue || "").trim();
  if (!origin) return "";
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const getDocId = (kind: AdaptiveKind): string => (
  kind === "musicNote" ? "music_note_adaptive_v2" : "library_adaptive_v2"
);

const byteSize = (value: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const OMIT_KEYS = new Set([
  "lyricRevisions", "lyricsHistory", "lyricHistory", "revisionHistory", "editHistory",
  "apiResponse", "apiStatusResponse", "rawApiResponse", "callbackPayload", "debugPayload",
  "googleGeminiApiKey", "geminiApiKey", "apiKey", "accessToken", "idToken",
  "refreshToken", "authorization", "password", "secret",
]);

const sanitize = (value: unknown, depth = 0): unknown => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== "object" || depth > 12) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (OMIT_KEYS.has(key)) continue;
    const safe = sanitize(entry, depth + 1);
    if (safe !== undefined) out[key] = safe;
  }
  return out;
};

const normalizeDeletedIds = (value: unknown): string[] => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean),
)).slice(-MAX_DELETED_IDS);

export const publishPreviewAdaptiveListIndexV2 = onCall(
  { region: "us-central1", enforceAppCheck: true, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required.");
    const originHost = getOriginHost(request.rawRequest?.headers?.origin);
    if (!ALLOWED_PREVIEW_HOSTS.has(originHost)) {
      throw new HttpsError("permission-denied", "Preview origin required.");
    }

    const raw = request.data && typeof request.data === "object" ? request.data as Record<string, unknown> : {};
    const kind = raw.kind === "musicNote" || raw.kind === "library" ? raw.kind : null;
    if (!kind) throw new HttpsError("invalid-argument", "Invalid list kind.");
    if (raw.schemaVersion !== SCHEMA_VERSION) throw new HttpsError("invalid-argument", "Invalid schema version.");
    if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) {
      throw new HttpsError("invalid-argument", "Invalid list items.");
    }

    const sanitizedItems = raw.items.map((item) => sanitize(item)).filter((item) => Boolean(item));
    if (sanitizedItems.length !== raw.items.length) throw new HttpsError("invalid-argument", "Invalid list item payload.");
    const itemCount = Number(raw.itemCount);
    const cursorCreatedAtMs = Number(raw.cursorCreatedAtMs);
    if (!Number.isInteger(itemCount) || itemCount !== sanitizedItems.length) {
      throw new HttpsError("invalid-argument", "Invalid item count.");
    }
    if (!Number.isInteger(cursorCreatedAtMs) || cursorCreatedAtMs < 0) {
      throw new HttpsError("invalid-argument", "Invalid cursor.");
    }
    if (typeof raw.hasMore !== "boolean") throw new HttpsError("invalid-argument", "Invalid continuation flag.");

    const seenIds = new Set<string>();
    let previousCreatedAtMs = Number.MAX_SAFE_INTEGER;
    for (const item of sanitizedItems as Record<string, any>[]) {
      const id = String(item?.id || "").trim();
      const createdAtMs = Number(item?.createdAtMs || 0);
      if (!id || seenIds.has(id) || !Number.isInteger(createdAtMs) || createdAtMs <= 0 || createdAtMs > previousCreatedAtMs) {
        throw new HttpsError("invalid-argument", "Invalid ordered list item.");
      }
      seenIds.add(id);
      previousCreatedAtMs = createdAtMs;
    }
    if (sanitizedItems.length === 0 && cursorCreatedAtMs !== 0) {
      throw new HttpsError("invalid-argument", "Empty list cursor must be zero.");
    }
    if (sanitizedItems.length > 0 && cursorCreatedAtMs !== Number((sanitizedItems[sanitizedItems.length - 1] as any).createdAtMs || 0)) {
      throw new HttpsError("invalid-argument", "Cursor does not match final item.");
    }

    const deletedIds = normalizeDeletedIds(raw.deletedIds);
    const updatedAtMs = Date.now();
    const stablePayload = {
      schemaVersion: SCHEMA_VERSION,
      kind,
      items: sanitizedItems,
      itemCount,
      cursorCreatedAtMs,
      hasMore: raw.hasMore,
      deletedIds,
      updatedAtMs,
    };
    if (byteSize(stablePayload) > MAX_BYTES) {
      throw new HttpsError("invalid-argument", "Adaptive list index exceeds safe size budget.");
    }

    const ref = admin.firestore()
      .collection("user_list_caches")
      .doc(request.auth.uid)
      .collection("bundles")
      .doc(getDocId(kind));
    await ref.set({
      ...stablePayload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });

    return { ok: true, kind, itemCount, updatedAtMs };
  },
);
