import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();


export const syncAuthUserToFirestore = functions.auth.user().onCreate(async (user: admin.auth.UserRecord) => {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();

  const createdAtMs = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).getTime()
    : Date.now();
  const safeCreatedAt = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();

  const providerIds = (user.providerData || [])
    .map((provider: any) => provider.providerId)
    .filter(Boolean);

  const sessionData = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    providerIds,
    lastLoginAt: safeCreatedAt,
    lastSeenAt: safeCreatedAt,
    isOnline: false,
  };

  if (snap.exists) {
    await userRef.set(sessionData, { merge: true });
    return;
  }

  await userRef.set({
    ...sessionData,
    createdAt: safeCreatedAt,
    role: "free",
    accountStatus: "active",
    paymentStatus: "none",
    favoriteCount: 0,
    songGeneratedCount: 0,
  });
});


export const backfillMissingAuthUsers = onCall(
  { region: "us-central1" },
  async (request) => {
    const requesterUid = request.auth?.uid;
    if (!requesterUid) {
      throw new HttpsError("unauthenticated", "관리자 로그인이 필요합니다.");
    }

    const db = admin.firestore();
    const requesterSnap = await db.collection("users").doc(requesterUid).get();
    if (requesterSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }

    const dryRun = request.data?.dryRun === true;
    let pageToken: string | undefined;
    let totalAuthUsers = 0;
    let existingUserDocs = 0;
    let missingUserDocs = 0;
    let createdUserDocs = 0;
    const failedUsers: Array<{ uid: string; email: string; error: string }> = [];

    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      for (const authUser of page.users) {
        totalAuthUsers += 1;
        const userRef = db.collection("users").doc(authUser.uid);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
          existingUserDocs += 1;
          continue;
        }

        missingUserDocs += 1;
        if (dryRun) continue;

        try {
          const createdAtMs = authUser.metadata.creationTime
            ? new Date(authUser.metadata.creationTime).getTime()
            : Date.now();
          const safeCreatedAt = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
          const providerIds = (authUser.providerData || [])
            .map((provider: any) => provider.providerId)
            .filter(Boolean);

          await userRef.set({
            uid: authUser.uid,
            email: authUser.email || "",
            displayName: authUser.displayName || "",
            photoURL: authUser.photoURL || "",
            providerIds,
            createdAt: safeCreatedAt,
            lastLoginAt: safeCreatedAt,
            lastSeenAt: safeCreatedAt,
            isOnline: false,
            role: "free",
            planTier: "free",
            accountStatus: "active",
            paymentStatus: "none",
            favoriteCount: 0,
            songGeneratedCount: 0,
            backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
            backfillSource: "auth-list-users",
          });
          createdUserDocs += 1;
        } catch (error: any) {
          failedUsers.push({
            uid: authUser.uid,
            email: authUser.email || "",
            error: error?.message || String(error),
          });
        }
      }
      pageToken = page.pageToken;
    } while (pageToken);

    return {
      ok: failedUsers.length === 0,
      dryRun,
      totalAuthUsers,
      existingUserDocs,
      missingUserDocs,
      createdUserDocs,
      failedUsers,
    };
  }
);

const APP_CHECK_STATUS_HEADER = "X-SORIDRAW-App-Check-Status";

const ALLOWED_ORIGINS = [
  "https://soridraw-music-git-preview-andrawing1212.vercel.app",
  "https://soridraw-music.vercel.app",
  "https://soridraw.web.app",
  "https://soridraw.firebaseapp.com",
  "https://soridraw-app-866a5.web.app",
  "https://soridraw-app-866a5.firebaseapp.com",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
];

const handleCors = (req: any, res: any) => {
  const origin = String(req.headers.origin || "").trim();
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  const isAiStudioPreview = /^https:\/\/[a-z0-9-]+\.usercontent\.goog$/i.test(origin);
  const isAiStudioRunPreview = /^https:\/\/ais-dev-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/i.test(origin);
  const allowed = Boolean(
    origin && (ALLOWED_ORIGINS.includes(origin) || isAiStudioPreview || isAiStudioRunPreview)
  );

  res.set("Vary", "Origin");
  res.set("Cache-Control", "no-store");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
  res.set("Access-Control-Expose-Headers", APP_CHECK_STATUS_HEADER);

  if (allowed) {
    res.set("Access-Control-Allow-Origin", origin);
  } else if (isEmulator && (!origin || origin.startsWith("http://localhost:"))) {
    res.set("Access-Control-Allow-Origin", origin || "http://localhost:5173");
  } else {
    res.status(403).json({ error: "Origin is not allowed", code: "ORIGIN_NOT_ALLOWED", ok: false });
    return true;
  }

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
};

const verifyAuth = async (req: any, res: any): Promise<string | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", ok: false });
    return null;
  }
  
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    res.status(401).json({ error: "Unauthorized", ok: false });
    return null;
  }
};

type AppCheckMonitorStatus = "valid" | "missing" | "invalid";

const classifyAppCheckOrigin = (originValue: unknown): string => {
  const origin = String(originValue || "").trim().toLowerCase();
  if (!origin) return "none";
  if (origin === "https://soridraw-music.vercel.app") return "test-app";
  if (origin === "https://soridraw.web.app" || origin === "https://soridraw.firebaseapp.com") return "official-app";
  if (/^https:\/\/ais-dev-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app$/i.test(origin)) return "ai-studio";
  if (/^https:\/\/[a-z0-9-]+\.usercontent\.goog$/i.test(origin)) return "ai-studio-usercontent";
  if (origin.startsWith("http://localhost:")) return "localhost";
  return "other-allowed";
};

const reportAppCheckStatus = (
  req: any,
  res: any,
  operation: string,
  status: AppCheckMonitorStatus,
  enforce: boolean,
  accepted: boolean,
): void => {
  const headerValue = status === "valid"
    ? "valid"
    : `${status}-${accepted ? "accepted" : "blocked"}`;
  res.set(APP_CHECK_STATUS_HEADER, headerValue);
  console.info("[App Check monitor]", JSON.stringify({
    operation,
    status,
    enforcement: enforce ? "enabled" : "disabled",
    accepted,
    originType: classifyAppCheckOrigin(req.headers.origin),
  }));
};

const verifyAppCheckForRequest = async (
  req: any,
  res: any,
  operation: string,
): Promise<boolean> => {
  const token = String(req.headers["x-firebase-appcheck"] || "").trim();
  const enforce = process.env.ENFORCE_APP_CHECK === "true";
  if (!token) {
    const accepted = !enforce;
    reportAppCheckStatus(req, res, operation, "missing", enforce, accepted);
    if (!accepted) {
      res.status(401).json({ error: "App Check token is required", code: "APP_CHECK_REQUIRED", ok: false });
      return false;
    }
    return true;
  }
  try {
    await admin.appCheck().verifyToken(token);
    reportAppCheckStatus(req, res, operation, "valid", enforce, true);
    return true;
  } catch {
    const accepted = !enforce;
    reportAppCheckStatus(req, res, operation, "invalid", enforce, accepted);
    if (accepted) return true;
    res.status(401).json({ error: "Invalid App Check token", code: "APP_CHECK_INVALID", ok: false });
    return false;
  }
};

const GEMINI_ALLOWED_MODELS = new Set([
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
]);
const GEMINI_MAX_REQUEST_BYTES = 900_000;
const GEMINI_MAX_REQUESTS_PER_MINUTE = 12;
const GEMINI_MAX_ACTIVE_REQUESTS = 2;
const GEMINI_MAX_REQUESTS_PER_SESSION = 3;
const GEMINI_GUARD_STALE_MS = 3 * 60 * 1000;
const GEMINI_SESSION_WINDOW_MS = 10 * 60 * 1000;
const getStoredGeminiApiKey = async (uid: string): Promise<string> => {
  // Read the current server-only key for every real Gemini request. One Firestore read is
  // intentionally preferred over caching private keys in warm instance memory, so key
  // deletion or replacement takes effect immediately across all Function instances.
  const snap = await admin.firestore().collection("user_api_keys").doc(uid).get();
  return String(snap.data()?.googleGeminiApiKey || "").trim();
};

const acquireGeminiRequestGuard = async (uid: string, sessionId: string): Promise<void> => {
  const db = admin.firestore();
  const guardRef = db.collection("gemini_request_guards").doc(uid);
  const userRef = db.collection("users").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const [userSnap, guardSnap] = await Promise.all([tx.get(userRef), tx.get(guardRef)]);
    const userData = userSnap.data() || {};
    const role = String(userData.role || "free");
    const accountStatus = String(userData.accountStatus || "active");
    if (role !== "admin" && accountStatus !== "active") {
      throw new HttpsError("permission-denied", "현재 계정 상태에서는 Gemini 생성을 사용할 수 없습니다.");
    }

    const data = guardSnap.data() || {};
    const activeUpdatedAt = Number(data.activeUpdatedAt || 0);
    const staleActive = !activeUpdatedAt || now - activeUpdatedAt > GEMINI_GUARD_STALE_MS;
    const activeCount = staleActive ? 0 : Math.max(0, Number(data.activeCount || 0));
    if (activeCount >= GEMINI_MAX_ACTIVE_REQUESTS) {
      throw new HttpsError("resource-exhausted", "동시에 실행할 수 있는 Gemini 요청 수를 초과했습니다.");
    }

    const minuteWindowStart = Number(data.minuteWindowStart || 0);
    const sameMinuteWindow = minuteWindowStart > 0 && now - minuteWindowStart < 60_000;
    const minuteCount = sameMinuteWindow ? Math.max(0, Number(data.minuteCount || 0)) : 0;
    if (minuteCount >= GEMINI_MAX_REQUESTS_PER_MINUTE) {
      throw new HttpsError("resource-exhausted", "짧은 시간에 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
    }

    const sessionWindowStart = Number(data.sessionWindowStart || 0);
    const sameSessionWindow = sessionWindowStart > 0 && now - sessionWindowStart < GEMINI_SESSION_WINDOW_MS;
    const sessionCounts = sameSessionWindow && data.sessionCounts && typeof data.sessionCounts === "object"
      ? { ...data.sessionCounts }
      : {};
    const sessionCount = Math.max(0, Number(sessionCounts[sessionId] || 0));
    if (sessionCount >= GEMINI_MAX_REQUESTS_PER_SESSION) {
      throw new HttpsError("resource-exhausted", "곡 하나의 Gemini 호출 상한에 도달했습니다.");
    }
    sessionCounts[sessionId] = sessionCount + 1;

    tx.set(guardRef, {
      activeCount: activeCount + 1,
      activeUpdatedAt: now,
      minuteWindowStart: sameMinuteWindow ? minuteWindowStart : now,
      minuteCount: minuteCount + 1,
      sessionWindowStart: sameSessionWindow ? sessionWindowStart : now,
      sessionCounts,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
};

const releaseGeminiRequestGuard = async (uid: string): Promise<void> => {
  const db = admin.firestore();
  const guardRef = db.collection("gemini_request_guards").doc(uid);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(guardRef);
      if (!snap.exists) return;
      const activeCount = Math.max(0, Number(snap.data()?.activeCount || 0) - 1);
      tx.set(guardRef, {
        activeCount,
        activeUpdatedAt: Date.now(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    console.warn("[Gemini Guard] failed to release active request:", error instanceof Error ? error.message : String(error));
  }
};

const extractGeminiErrorStatus = (error: unknown): number => {
  const anyError = error as any;
  const candidates = [anyError?.status, anyError?.statusCode, anyError?.code, anyError?.error?.code];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 400 && parsed <= 599) return parsed;
  }
  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/\b(400|401|403|404|408|409|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : 500;
};

const sanitizeGeminiErrorMessage = (error: unknown, apiKey: string): string => {
  const raw = error instanceof Error ? error.message : String(error || "Gemini request failed");
  const withoutExactKey = apiKey ? raw.split(apiKey).join("[REDACTED]") : raw;
  return withoutExactKey
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
    .replace(/AQ\.[0-9A-Za-z._~-]{16,}/g, "[REDACTED]")
    .slice(0, 600);
};

const normalizeGeminiApiKey = (value: unknown): string => String(value || "").trim();

const isSupportedGeminiApiKeyFormat = (apiKey: string): boolean => {
  // Google does not guarantee one permanent prefix or length. Treat the key as an opaque
  // printable token, reject whitespace/control characters, and let Gemini perform the
  // authoritative validity check. This supports both AIza... and AQ.... formats.
  return apiKey.length >= 20
    && apiKey.length <= 512
    && !/[\s\u0000-\u001F\u007F]/.test(apiKey);
};

const normalizeGeminiContent = (value: any): any => {
  if (typeof value === "string") {
    return { role: "user", parts: [{ text: value }] };
  }
  if (value && typeof value === "object" && Array.isArray(value.parts)) return value;
  return value;
};

const validateGeminiTextOnlyRequest = (requestPayload: any): void => {
  const request = requestPayload && typeof requestPayload === "object" ? requestPayload : null;
  if (!request) throw new HttpsError("invalid-argument", "Invalid Gemini request payload.");
  const config = request.config && typeof request.config === "object" ? request.config : {};
  if (request.tools || request.toolConfig || config.tools || config.toolConfig) {
    throw new HttpsError("invalid-argument", "Gemini tools are not allowed on the SORIDRAW text proxy.");
  }

  let textChars = 0;
  const inspectContent = (content: any) => {
    if (typeof content === "string") {
      textChars += content.length;
      return;
    }
    if (!content || typeof content !== "object" || !Array.isArray(content.parts)) {
      throw new HttpsError("invalid-argument", "Gemini contents must contain text parts only.");
    }
    for (const part of content.parts) {
      const keys = part && typeof part === "object" ? Object.keys(part) : [];
      if (!part || typeof part.text !== "string" || keys.some((key) => key !== "text")) {
        throw new HttpsError("invalid-argument", "Inline files, media and function calls are not allowed.");
      }
      textChars += part.text.length;
    }
  };

  const contents = Array.isArray(request.contents) ? request.contents : [request.contents];
  if (!contents.length || contents.length > 16) {
    throw new HttpsError("invalid-argument", "Invalid Gemini contents count.");
  }
  contents.forEach(inspectContent);
  if (typeof config.systemInstruction === "string") textChars += config.systemInstruction.length;
  else if (config.systemInstruction?.parts) inspectContent(config.systemInstruction);
  if (textChars <= 0 || textChars > 500_000) {
    throw new HttpsError("invalid-argument", "Gemini text payload is empty or too large.");
  }
};

const sanitizeLegacyGeminiResponseSchema = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(sanitizeLegacyGeminiResponseSchema);
  }
  if (!value || typeof value !== "object") return value;

  const sanitized: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    // The legacy Gemini generateContent `responseSchema` protobuf does not accept
    // JSON Schema's `additionalProperties`. The browser SDK previously normalized
    // this field, but the server REST proxy must remove it explicitly.
    if (key === "additionalProperties") continue;
    sanitized[key] = sanitizeLegacyGeminiResponseSchema(child);
  }
  return sanitized;
};

const callGeminiGenerateContent = async (apiKey: string, requestPayload: any): Promise<any> => {
  const model = String(requestPayload?.model || "").trim();
  const config = requestPayload?.config && typeof requestPayload.config === "object"
    ? { ...requestPayload.config }
    : {};
  const systemInstruction = config.systemInstruction;
  const safetySettings = config.safetySettings;
  const tools = config.tools;
  const toolConfig = config.toolConfig;
  delete config.systemInstruction;
  delete config.safetySettings;
  delete config.tools;
  delete config.toolConfig;
  if (config.responseSchema) {
    config.responseSchema = sanitizeLegacyGeminiResponseSchema(config.responseSchema);
  }

  const rawContents = requestPayload?.contents;
  const contents = Array.isArray(rawContents)
    ? rawContents.map(normalizeGeminiContent)
    : [normalizeGeminiContent(rawContents)];
  const body: any = {
    contents,
    generationConfig: config,
  };
  if (systemInstruction) {
    body.systemInstruction = typeof systemInstruction === "string"
      ? { parts: [{ text: systemInstruction }] }
      : systemInstruction;
  }
  if (safetySettings) body.safetySettings = safetySettings;
  if (tools) body.tools = tools;
  if (toolConfig) body.toolConfig = toolConfig;

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
  );
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const error = new Error(String(payload?.error?.message || `Gemini request failed (${upstream.status})`));
    const upstreamReason = Array.isArray(payload?.error?.details)
      ? String(payload.error.details.find((detail: any) => typeof detail?.reason === "string")?.reason || "")
      : "";
    (error as any).status = upstream.status;
    (error as any).code = payload?.error?.status || upstream.status;
    (error as any).reason = upstreamReason;
    throw error;
  }
  return payload || {};
};

const pickFirstString = (...values: any[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const pickFirstPositiveNumber = (...values: any[]): number | null => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
};

const ALLOWED_SUNO_MODELS = ["V5_5", "V5", "V4_5"] as const;
type SunoModelVersion = typeof ALLOWED_SUNO_MODELS[number];

const normalizeSunoModelVersion = (...values: any[]): SunoModelVersion => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim().toUpperCase().replace(/[.\s-]/g, "_");
    if ((ALLOWED_SUNO_MODELS as readonly string[]).includes(normalized)) {
      return normalized as SunoModelVersion;
    }
  }
  return "V5_5";
};

const normalizeSunoDataItem = (item: any): any => {
  if (!item || typeof item !== "object") return item;

  const metadata = item.metadata || {};
  const audioUrl = pickFirstString(
    item.audioUrl,
    item.audio_url,
    item.streamAudioUrl,
    item.stream_audio_url,
    item.sourceAudioUrl,
    item.source_audio_url,
    item.sourceStreamAudioUrl,
    item.source_stream_audio_url,
    item.musicUrl,
    item.music_url,
    item.url
  );
  const imageUrl = pickFirstString(
    item.imageUrl,
    item.image_url,
    item.sourceImageUrl,
    item.source_image_url,
    item.coverUrl,
    item.cover_url,
    metadata.imageUrl,
    metadata.image_url
  );
  const duration = pickFirstPositiveNumber(
    item.duration,
    item.durationSeconds,
    item.duration_seconds,
    item.playDuration,
    item.play_duration,
    metadata.duration,
    metadata.durationSeconds,
    metadata.duration_seconds,
    metadata.playDuration,
    metadata.play_duration
  );

  return {
    ...item,
    ...(audioUrl ? { audioUrl, streamAudioUrl: audioUrl } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(duration ? { duration } : {})
  };
};

const isCompleteStatus = (value: any): boolean => {
  const normalized = String(value || "").toLowerCase();
  return ["success", "succeeded", "completed", "complete"].includes(normalized);
};

const isFailedStatus = (value: any): boolean => {
  const normalized = String(value || "").toLowerCase();
  return ["failed", "failure", "error"].includes(normalized);
};

const timestampToIso = (value: any): string | null => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
};

const hasSunoTrackAudio = (track: any): boolean => {
  if (!track || typeof track !== "object") return false;

  if (pickFirstString(
    track.audioUrl,
    track.streamAudioUrl,
    track.audio_url,
    track.stream_audio_url,
    track.sourceAudioUrl,
    track.sourceStreamAudioUrl
  )) return true;

  if (Array.isArray(track.audioUrls) && track.audioUrls.some((url: any) => pickFirstString(url))) return true;

  const sunoData = Array.isArray(track.sunoData) ? track.sunoData.filter(Boolean) : [];
  return sunoData.some((item: any) => pickFirstString(
    item?.audioUrl,
    item?.streamAudioUrl,
    item?.audio_url,
    item?.stream_audio_url,
    item?.sourceAudioUrl,
    item?.sourceStreamAudioUrl
  ));
};


const isExternalTlsCertificateError = (error: any): boolean => {
  const code = String(error?.code || error?.cause?.code || "");
  const message = String(error?.message || error?.cause?.message || "");
  return (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    message.includes("unable to verify the first certificate") ||
    message.includes("certificate")
  );
};

const sendSunoExternalConnectionError = (res: any, error: any) => {
  const isTlsError = isExternalTlsCertificateError(error);
  res.status(502).json({
    ok: false,
    errorCode: isTlsError ? "SUNO_API_TLS_CERTIFICATE_ERROR" : "SUNO_API_CONNECTION_ERROR",
    error: isTlsError
      ? "Music API 서버의 보안 연결에 문제가 있어 요청을 완료하지 못했습니다."
      : "Music API 서버에 연결하지 못했습니다.",
    userMessage: isTlsError
      ? "Music API 서버의 보안 연결에 문제가 있어 잠시 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
      : "Music API 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    details: error?.message || error?.cause?.message || String(error),
  });
};

const extractRemainingCredits = (payload: any): number | null => {
  const candidates = [
    payload?.data,
    payload?.credits,
    payload?.remainingCredits,
    payload?.remaining_credits,
    payload?.balance,
    payload?.data?.credits,
    payload?.data?.remainingCredits,
    payload?.data?.remaining_credits,
    payload?.data?.balance
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) return num;
  }

  return null;
};

const getStoredSunoApiKeyFromDoc = (docData: any): string => pickFirstString(
  docData?.sunoApiKey,
  docData?.musicApiKey,
  docData?.suno_api_key,
  docData?.music_api_key
);

const hasStoredSunoApiKeyInDoc = (docData: any): boolean => Boolean(getStoredSunoApiKeyFromDoc(docData));

const normalizeSunoSharePageUrl = (value: any): string => {
  const raw = pickFirstString(value);
  if (!raw) throw new Error("Suno URL is required.");

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  const host = url.hostname.toLowerCase();

  if (!host.includes("suno.com") && !host.includes("suno.ai")) {
    throw new Error("Only Suno share URLs are supported.");
  }

  return url.toString();
};

const decodeHtmlEntities = (value: string): string => value
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");

const getMetaTagContent = (html: string, attrName: "property" | "name", attrValue: string): string => {
  const metaTagRegex = /<meta\s+[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaTagRegex.exec(html))) {
    const tag = match[0];
    const attrRegex = new RegExp(`${attrName}\\s*=\\s*["']${attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
    if (!attrRegex.test(tag)) continue;

    const contentMatch = tag.match(/content\s*=\s*(["'])([\s\S]*?)\1/i);
    if (contentMatch?.[2]) return decodeHtmlEntities(contentMatch[2].trim());
  }

  return "";
};

const normalizeMetadataUrl = (value: string, baseUrl: string): string => {
  const raw = pickFirstString(value);
  if (!raw) return "";

  try {
    const resolved = new URL(raw, baseUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) return "";
    return resolved.toString();
  } catch {
    return "";
  }
};

const formatDurationText = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

const normalizeDurationSeconds = (value: any): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 36000) {
    return Math.round(value);
  }

  const raw = pickFirstString(value);
  if (!raw) return null;

  const trimmed = raw.trim();

  const isoMatch = trimmed.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] || 0);
    const minutes = Number(isoMatch[2] || 0);
    const seconds = Number(isoMatch[3] || 0);
    const total = (hours * 3600) + (minutes * 60) + seconds;
    return total > 0 && total < 36000 ? Math.round(total) : null;
  }

  const timeMatch = trimmed.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1] || 0);
    const minutes = Number(timeMatch[2] || 0);
    const seconds = Number(timeMatch[3] || 0);
    const total = (hours * 3600) + (minutes * 60) + seconds;
    return total > 0 && total < 36000 ? total : null;
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0 && numeric < 36000) {
    return Math.round(numeric);
  }

  return null;
};

const findDurationInValue = (value: any, depth = 0): number | null => {
  if (depth > 8 || value == null) return null;

  const direct = normalizeDurationSeconds(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDurationInValue(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value !== "object") return null;

  const durationKeys = [
    "duration",
    "duration_s",
    "durationS",
    "duration_sec",
    "durationSec",
    "duration_secs",
    "durationSecs",
    "duration_seconds",
    "durationSeconds",
    "durationInSeconds",
    "duration_ms",
    "durationMs",
    "clipDuration",
    "clip_duration",
    "audioDuration",
    "audio_duration",
    "playtime",
    "length",
    "lengthSeconds",
  ];

  for (const key of durationKeys) {
    if (!(key in value)) continue;
    const raw = value[key];
    const normalized = key.toLowerCase().includes("ms") && typeof raw === "number"
      ? normalizeDurationSeconds(raw / 1000)
      : normalizeDurationSeconds(raw);
    if (normalized) return normalized;
  }

  for (const key of Object.keys(value)) {
    const found = findDurationInValue(value[key], depth + 1);
    if (found) return found;
  }

  return null;
};

const extractDurationFromJsonScripts = (html: string): number | null => {
  const scriptRegex = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html))) {
    const raw = decodeHtmlEntities(match[1] || "").trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const found = findDurationInValue(parsed);
      if (found) return found;
    } catch {
      // Ignore non-JSON script content.
    }
  }

  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(nextDataMatch[1]).trim());
      const found = findDurationInValue(parsed);
      if (found) return found;
    } catch {
      // Ignore invalid Next.js payload.
    }
  }

  return null;
};

const extractDurationFromLooseHtml = (html: string): number | null => {
  const patterns = [
    /"duration(?:Seconds|_seconds|_s|S|Sec|_sec)?"\s*:\s*(\d+(?:\.\d+)?)/i,
    /"duration(?:Seconds|_seconds|_s|S|Sec|_sec)?"\s*:\s*"([^"]+)"/i,
    /"durationMs"\s*:\s*(\d+(?:\.\d+)?)/i,
    /"audioDuration"\s*:\s*(\d+(?:\.\d+)?)/i,
    /"clipDuration"\s*:\s*(\d+(?:\.\d+)?)/i,
    /"playtime"\s*:\s*(\d+(?:\.\d+)?)/i,
    /"lengthSeconds"\s*:\s*"?(\d+(?:\.\d+)?)"?/i,
    /property=["']music:duration["'][^>]*content=["']([^"']+)["']/i,
    /name=["']duration["'][^>]*content=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const isMs = /durationMs/i.test(pattern.source);
    const normalized = isMs
      ? normalizeDurationSeconds(Number(match[1]) / 1000)
      : normalizeDurationSeconds(match[1]);
    if (normalized) return normalized;
  }

  return null;
};


const isBlockedSunoAudioUrl = (value: any): boolean => {
  const raw = pickFirstString(value).toLowerCase();
  if (!raw) return true;

  return /(?:^|\/)(?:sil|silent|silence)[-_]?\d*\.(?:mp3|m4a|wav|aac|ogg|flac)(?:$|[?#])/i.test(raw)
    || /(?:^|\/)(?:blank|empty|placeholder)[-_]?\d*\.(?:mp3|m4a|wav|aac|ogg|flac)(?:$|[?#])/i.test(raw);
};

const normalizeSunoAudioUrl = (value: any, baseUrl: string): string => {
  const resolved = normalizeMetadataUrl(pickFirstString(value), baseUrl);
  if (!resolved || isBlockedSunoAudioUrl(resolved)) return "";

  try {
    const url = new URL(resolved);
    const path = decodeURIComponent(url.pathname || "").toLowerCase();
    const host = url.hostname.toLowerCase();

    const hasAudioExtension = /\.(mp3|m4a|wav|aac|ogg|flac)(?:$|[?#])/i.test(url.href);
    const isSunoCdn = host.includes("suno") || host.includes("sunoai") || host.includes("cdn");
    const hasAudioLikePath = /(audio|stream|song|media|clip|mp3|m4a)/i.test(path);

    if (hasAudioExtension) return resolved;
    if (isSunoCdn && hasAudioLikePath && !/(image|avatar|cover|artwork|png|jpg|jpeg|webp|gif)/i.test(path)) return resolved;
  } catch {
    return "";
  }

  return "";
};

const findAudioUrlInValue = (value: any, baseUrl: string, depth = 0): string => {
  if (depth > 8 || value == null) return "";

  if (typeof value === "string") {
    return normalizeSunoAudioUrl(value, baseUrl);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudioUrlInValue(item, baseUrl, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (typeof value !== "object") return "";

  const audioKeys = [
    "audioUrl",
    "audio_url",
    "streamAudioUrl",
    "stream_audio_url",
    "sourceAudioUrl",
    "source_audio_url",
    "downloadUrl",
    "download_url",
    "playUrl",
    "play_url",
    "mediaUrl",
    "media_url",
    "mp3Url",
    "mp3_url",
    "songUrl",
    "song_url",
    "audio",
    "audioSrc",
    "audio_src",
    "src",
  ];

  for (const key of audioKeys) {
    if (!(key in value)) continue;
    const found = findAudioUrlInValue(value[key], baseUrl, depth + 1);
    if (found) return found;
  }

  for (const key of Object.keys(value)) {
    const lowerKey = key.toLowerCase();
    if (!/(audio|stream|mp3|download|media|song|play)/.test(lowerKey)) continue;
    const found = findAudioUrlInValue(value[key], baseUrl, depth + 1);
    if (found) return found;
  }

  return "";
};

const extractAudioUrlFromJsonScripts = (html: string, pageUrl: string): string => {
  const scriptRegex = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html))) {
    const raw = decodeHtmlEntities(match[1] || "").trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const found = findAudioUrlInValue(parsed, pageUrl);
      if (found) return found;
    } catch {
      // Ignore non-JSON script content.
    }
  }

  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(nextDataMatch[1]).trim());
      const found = findAudioUrlInValue(parsed, pageUrl);
      if (found) return found;
    } catch {
      // Ignore invalid Next.js payload.
    }
  }

  return "";
};

const extractAudioUrlFromLooseHtml = (html: string, pageUrl: string): string => {
  const patterns = [
    /<audio[^>]+src=["']([^"']+)["']/i,
    /"audioUrl"\s*:\s*"([^"]+)"/i,
    /"audio_url"\s*:\s*"([^"]+)"/i,
    /"streamAudioUrl"\s*:\s*"([^"]+)"/i,
    /"stream_audio_url"\s*:\s*"([^"]+)"/i,
    /"sourceAudioUrl"\s*:\s*"([^"]+)"/i,
    /"source_audio_url"\s*:\s*"([^"]+)"/i,
    /"downloadUrl"\s*:\s*"([^"]+)"/i,
    /"playUrl"\s*:\s*"([^"]+)"/i,
    /"mediaUrl"\s*:\s*"([^"]+)"/i,
    /"mp3Url"\s*:\s*"([^"]+)"/i,
    /"mp3_url"\s*:\s*"([^"]+)"/i,
    /"songUrl"\s*:\s*"([^"]+)"/i,
    /"song_url"\s*:\s*"([^"]+)"/i,
    /(https?:\/\/[^"'<>\s]+?\.(?:mp3|m4a|wav|aac|ogg|flac)(?:\?[^"'<>\s]*)?)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const found = normalizeSunoAudioUrl(decodeHtmlEntities(match[1]), pageUrl);
    if (found) return found;
  }

  return "";
};


const extractSunoShareMetadataFromHtml = (html: string, pageUrl: string) => {
  const coverUrl = normalizeMetadataUrl(
    pickFirstString(
      getMetaTagContent(html, "property", "og:image"),
      getMetaTagContent(html, "name", "twitter:image")
    ),
    pageUrl
  );

  const title = pickFirstString(
    getMetaTagContent(html, "property", "og:title"),
    getMetaTagContent(html, "name", "twitter:title")
  );

  const durationSeconds = extractDurationFromJsonScripts(html) || extractDurationFromLooseHtml(html);
  const durationText = durationSeconds ? formatDurationText(durationSeconds) : "";
  const audioUrl = extractAudioUrlFromJsonScripts(html, pageUrl) || extractAudioUrlFromLooseHtml(html, pageUrl);

  return {
    coverUrl,
    title,
    durationSeconds,
    durationText,
    audioUrl,
  };
};

const buildSunoApiKeyStatusPayload = (docData: any = {}) => {
  const hasStoredKey = hasStoredSunoApiKeyInDoc(docData);
  const hasSunoApiKey = Boolean(docData?.hasSunoApiKey || docData?.hasMusicApiKey || hasStoredKey);
  const provider = docData?.provider || docData?.musicApiProvider || null;

  return {
    ok: true,
    hasSunoApiKey,
    hasMusicApiKey: hasSunoApiKey,
    registered: hasSunoApiKey,
    hasApiKey: hasSunoApiKey,
    exists: hasSunoApiKey,
    provider,
    updatedAt: timestampToIso(docData?.sunoApiUpdatedAt || docData?.musicApiUpdatedAt),
    sunoRemainingCredits: typeof docData?.sunoRemainingCredits === "number" ? docData.sunoRemainingCredits : null,
    sunoRemainingCreditsUpdatedAt: timestampToIso(docData?.sunoRemainingCreditsUpdatedAt),
    sunoRemainingCreditsSourceTrackId: docData?.sunoRemainingCreditsSourceTrackId || null,
    sunoRemainingCreditsSourceTaskId: docData?.sunoRemainingCreditsSourceTaskId || null,
  };
};

export const saveGoogleGeminiApiKey = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;
    if (!(await verifyAppCheckForRequest(req, res, "saveGoogleGeminiApiKey"))) return;

    const normalizedApiKey = normalizeGeminiApiKey(req.body?.apiKey);
    if (!normalizedApiKey) {
      res.status(400).json({ error: "Google Gemini API Key is required", ok: false });
      return;
    }
    if (!isSupportedGeminiApiKeyFormat(normalizedApiKey)) {
      res.status(400).json({
        error: "Google AI Studio에서 발급한 Gemini API Key 형식을 확인해주세요.",
        code: "INVALID_GEMINI_KEY_FORMAT",
        ok: false,
      });
      return;
    }

    const db = admin.firestore();

    await db.collection("user_api_keys").doc(uid).set({
      googleGeminiApiKey: normalizedApiKey,
      hasGoogleGeminiApiKey: true,
      googleGeminiProvider: "Google AI Studio",
      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true, hasGoogleGeminiApiKey: true });
  }
);

export const deleteGoogleGeminiApiKey = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;
    if (!(await verifyAppCheckForRequest(req, res, "deleteGoogleGeminiApiKey"))) return;

    const db = admin.firestore();

    await db.collection("user_api_keys").doc(uid).set({
      googleGeminiApiKey: admin.firestore.FieldValue.delete(),
      hasGoogleGeminiApiKey: false,
      googleGeminiProvider: admin.firestore.FieldValue.delete(),
      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true, hasGoogleGeminiApiKey: false });
  }
);

export const getGoogleGeminiApiKeyStatus = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;
    if (!(await verifyAppCheckForRequest(req, res, "getGoogleGeminiApiKeyStatus"))) return;

    const db = admin.firestore();
    const docSnap = await db.collection("user_api_keys").doc(uid).get();

    if (!docSnap.exists) {
      res.json({ ok: true, hasGoogleGeminiApiKey: false });
      return;
    }

    const docData = docSnap.data() || {};
    res.json({
      ok: true,
      hasGoogleGeminiApiKey: Boolean(docData.hasGoogleGeminiApiKey && docData.googleGeminiApiKey),
      provider: docData.googleGeminiProvider || null,
      updatedAt: timestampToIso(docData.googleGeminiUpdatedAt),
    });
  }
);

export const getGoogleGeminiApiKey = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;
    res.status(410).json({
      ok: false,
      code: "GEMINI_KEY_CLIENT_ACCESS_REMOVED",
      error: "Gemini API keys are no longer returned to the browser.",
    });
  }
);

export const generateGeminiContent = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 180,
    memory: "512MiB",
    concurrency: 20,
    maxInstances: 30,
  },
  async (req, res) => {
    if (handleCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed", ok: false });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;
    if (!(await verifyAppCheckForRequest(req, res, "generateGeminiContent"))) return;

    const serializedLength = Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
    if (serializedLength > GEMINI_MAX_REQUEST_BYTES) {
      res.status(413).json({ error: "Gemini request is too large", code: "REQUEST_TOO_LARGE", ok: false });
      return;
    }

    const requestPayload = req.body?.request;
    const model = String(requestPayload?.model || "").trim();
    const sessionId = String(req.body?.sessionId || "").trim();
    const context = String(req.body?.context || "Gemini 호출").trim().slice(0, 120);
    const fallbackAttempt = Math.max(1, Math.min(3, Math.round(Number(req.body?.fallbackAttempt) || 1)));

    if (!requestPayload || typeof requestPayload !== "object" || !model || !GEMINI_ALLOWED_MODELS.has(model)) {
      res.status(400).json({ error: "Unsupported Gemini request", code: "INVALID_GEMINI_REQUEST", ok: false });
      return;
    }
    try {
      validateGeminiTextOnlyRequest(requestPayload);
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : "Invalid Gemini request";
      res.status(400).json({ error: message, code: "INVALID_GEMINI_TEXT_REQUEST", ok: false });
      return;
    }
    if (!sessionId || sessionId.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(sessionId)) {
      res.status(400).json({ error: "Invalid Gemini session ID", code: "INVALID_SESSION_ID", ok: false });
      return;
    }

    let guardAcquired = false;
    let apiKey = "";
    try {
      await acquireGeminiRequestGuard(uid, sessionId);
      guardAcquired = true;
      apiKey = await getStoredGeminiApiKey(uid);
      if (!apiKey) {
        res.status(404).json({ error: "Google Gemini API Key is not registered", code: "GEMINI_KEY_NOT_FOUND", ok: false });
        return;
      }

      const response = await callGeminiGenerateContent(apiKey, requestPayload);
      const text = Array.isArray(response?.candidates?.[0]?.content?.parts)
        ? response.candidates[0].content.parts.map((part: any) => String(part?.text || "")).join("")
        : "";
      res.json({
        ok: true,
        text,
        usageMetadata: response.usageMetadata || null,
        modelVersion: response.modelVersion || model,
        responseId: response.responseId || null,
        promptFeedback: response.promptFeedback || null,
        context,
        fallbackAttempt,
      });
    } catch (error) {
      const requestError = error as any;
      if (requestError instanceof HttpsError) {
        const status = requestError.code === "permission-denied" ? 403 : requestError.code === "resource-exhausted" ? 429 : 400;
        res.status(status).json({ error: requestError.message, code: requestError.code, ok: false });
        return;
      }
      const status = extractGeminiErrorStatus(error);
      const upstreamReason = String(requestError?.reason || "").trim();
      const isAuthKeyActivationError = upstreamReason === "ACCESS_TOKEN_TYPE_UNSUPPORTED";
      res.status(status).json({
        error: isAuthKeyActivationError
          ? "새 Gemini 승인 키가 Google API에서 아직 정상 인증되지 않았습니다. AI Studio의 키 연결 프로젝트와 Gemini API 활성화 상태를 확인한 뒤 다시 시도해주세요."
          : sanitizeGeminiErrorMessage(error, apiKey),
        code: isAuthKeyActivationError
          ? "GEMINI_AUTH_KEY_NOT_READY"
          : status === 429
            ? "GEMINI_RATE_LIMITED"
            : status >= 500
              ? "GEMINI_UPSTREAM_UNAVAILABLE"
              : "GEMINI_UPSTREAM_ERROR",
        ...(upstreamReason ? { upstreamReason } : {}),
        ok: false,
      });
    } finally {
      if (guardAcquired) await releaseGeminiRequestGuard(uid);
    }
  }
);

export const saveSunoApiKey = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const apiKey = req.body?.apiKey;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      res.status(400).json({ error: "API Key is required" });
      return;
    }

    const db = admin.firestore();
    const apiKeyDocRef = db.collection('user_api_keys').doc(uid);

    await apiKeyDocRef.set({
      // Keep Music API in the same uid-scoped document as Gemini.
      // Duplicate legacy/explicit field names so every client and function reads the same account-level key.
      sunoApiKey: apiKey.trim(),
      musicApiKey: apiKey.trim(),
      hasSunoApiKey: true,
      hasMusicApiKey: true,
      provider: 'sunoapi.org',
      musicApiProvider: 'sunoapi.org',
      sunoApiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      musicApiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      sunoRemainingCredits: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsUpdatedAt: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsSourceTrackId: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsSourceTaskId: admin.firestore.FieldValue.delete(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const savedSnap = await apiKeyDocRef.get();
    const savedData = savedSnap.data() || {};
    console.log("[Music API Key] saved", {
      uid,
      docExists: savedSnap.exists,
      hasStoredKey: hasStoredSunoApiKeyInDoc(savedData),
      hasSunoApiKey: Boolean(savedData.hasSunoApiKey),
      hasMusicApiKey: Boolean(savedData.hasMusicApiKey),
    });

    res.json(buildSunoApiKeyStatusPayload(savedData));
  }
);

export const deleteSunoApiKey = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const db = admin.firestore();
    const apiKeyDocRef = db.collection('user_api_keys').doc(uid);

    await apiKeyDocRef.set({
      sunoApiKey: admin.firestore.FieldValue.delete(),
      musicApiKey: admin.firestore.FieldValue.delete(),
      hasSunoApiKey: false,
      hasMusicApiKey: false,
      provider: admin.firestore.FieldValue.delete(),
      musicApiProvider: admin.firestore.FieldValue.delete(),
      sunoApiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      musicApiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      sunoRemainingCredits: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsUpdatedAt: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsSourceTrackId: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsSourceTaskId: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const deletedSnap = await apiKeyDocRef.get();
    const deletedData = deletedSnap.data() || {};
    console.log("[Music API Key] deleted", {
      uid,
      docExists: deletedSnap.exists,
      hasStoredKey: hasStoredSunoApiKeyInDoc(deletedData),
      hasSunoApiKey: Boolean(deletedData.hasSunoApiKey),
      hasMusicApiKey: Boolean(deletedData.hasMusicApiKey),
    });

    res.json(buildSunoApiKeyStatusPayload(deletedData));
  }
);

export const getSunoApiKeyStatus = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const db = admin.firestore();

    const docSnap = await db.collection('user_api_keys').doc(uid).get();

    const docData = docSnap.exists ? (docSnap.data() || {}) : {};
    const statusPayload = buildSunoApiKeyStatusPayload(docData);
    console.log("[Music API Key] status", {
      uid,
      docExists: docSnap.exists,
      hasStoredKey: hasStoredSunoApiKeyInDoc(docData),
      hasSunoApiKey: Boolean(docData.hasSunoApiKey),
      hasMusicApiKey: Boolean(docData.hasMusicApiKey),
      statusHasKey: statusPayload.hasSunoApiKey,
    });

    res.json(statusPayload);
  }
);

export const fetchSunoShareMetadata = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed", ok: false });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    let shareUrl = "";
    try {
      shareUrl = normalizeSunoSharePageUrl(req.body?.url || req.body?.sunoShareUrl);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: error?.message || "Invalid Suno URL.",
      });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
      const pageRes = await fetch(shareUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SORIDRAW/1.0; +https://soridraw.web.app)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      const finalUrl = pageRes.url || shareUrl;
      const html = await pageRes.text();

      if (!pageRes.ok) {
        res.status(502).json({
          ok: false,
          error: "Unable to fetch Suno share page.",
          status: pageRes.status,
        });
        return;
      }

      const metadata = extractSunoShareMetadataFromHtml(html, finalUrl);
      res.json({
        ok: true,
        sunoShareUrl: shareUrl,
        sunoCoverUrl: metadata.coverUrl || null,
        sunoTitle: metadata.title || null,
        sunoDurationSeconds: metadata.durationSeconds || null,
        sunoDurationText: metadata.durationText || null,
        sunoAudioUrl: metadata.audioUrl || null,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Suno metadata] fetch failed", {
        uid,
        shareUrl,
        message: error?.message || String(error),
      });
      res.status(502).json({
        ok: false,
        error: "Suno cover metadata could not be fetched.",
        details: error?.message || String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }
);


export const getSunoRemainingCredits = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const db = admin.firestore();
    const apiKeyDocRef = db.collection('user_api_keys').doc(uid);
    const apiKeyDoc = await apiKeyDocRef.get();

    if (!apiKeyDoc.exists) {
      res.status(400).json({ error: "Suno API Key not found for this user.", ok: false });
      return;
    }

    const apiKeyData = apiKeyDoc.data() || {};
    const sunoApiKey = getStoredSunoApiKeyFromDoc(apiKeyData);

    if (!sunoApiKey) {
      res.status(400).json({ error: "Suno API Key is empty.", ok: false });
      return;
    }

    try {
      const creditRes = await fetch("https://api.sunoapi.org/api/v1/generate/credit", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sunoApiKey}`
        }
      });

      if (!creditRes.ok) {
        const errText = await creditRes.text();
        console.error("Suno credit API HTTP Error:", errText);
        res.status(500).json({ error: "Suno credit API HTTP Error", details: errText, ok: false });
        return;
      }

      const creditData = await creditRes.json();
      const remainingCredits = extractRemainingCredits(creditData);

      if (remainingCredits === null) {
        res.status(500).json({ error: "Unable to parse remaining credits", details: creditData, ok: false });
        return;
      }

      await apiKeyDocRef.set({
        sunoRemainingCredits: remainingCredits,
        sunoRemainingCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        sunoRemainingCreditsSource: "settings-manual",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      res.json({
        ok: true,
        remainingCredits,
        checkedAt: new Date().toISOString(),
        source: "settings-manual",
        apiResponse: creditData
      });
    } catch (error: any) {
      console.error(error);
      sendSunoExternalConnectionError(res, error);
    }
  }
);

export const getSunoRemainingCreditsAfterComplete = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const trackId = pickFirstString(body.trackId, body.data?.trackId);
    const taskId = pickFirstString(body.taskId, body.data?.taskId);

    if (!trackId) {
      res.status(400).json({ error: "The trackId cannot be empty", ok: false });
      return;
    }

    const db = admin.firestore();
    const trackRef = db.collection("suno_tracks").doc(uid).collection("tracks").doc(trackId);
    const trackSnap = await trackRef.get();

    if (!trackSnap.exists) {
      res.status(404).json({ error: "Track not found", ok: false });
      return;
    }

    const trackData = trackSnap.data() || {};
    if (taskId && trackData.taskId && trackData.taskId !== taskId) {
      res.status(400).json({ error: "Task ID mismatch", ok: false });
      return;
    }

    const status = String(trackData.status || "").toLowerCase();
    const isCompleted = ["completed", "success", "complete", "succeeded"].includes(status);
    if (!isCompleted || !hasSunoTrackAudio(trackData)) {
      res.status(409).json({
        ok: false,
        error: "Track is not completed yet. Credits are checked only after completed audio is available.",
        status: trackData.status || null
      });
      return;
    }

    const apiKeyDocRef = db.collection('user_api_keys').doc(uid);
    const apiKeyDoc = await apiKeyDocRef.get();

    if (!apiKeyDoc.exists) {
      res.status(400).json({ error: "Suno API Key not found for this user.", ok: false });
      return;
    }

    const apiKeyData = apiKeyDoc.data() || {};
    const sunoApiKey = getStoredSunoApiKeyFromDoc(apiKeyData);

    if (!sunoApiKey) {
      res.status(400).json({ error: "Suno API Key is empty.", ok: false });
      return;
    }

    if (trackData.creditCheckedAfterComplete === true && typeof apiKeyData.sunoRemainingCredits === "number") {
      res.json({
        ok: true,
        alreadyChecked: true,
        remainingCredits: apiKeyData.sunoRemainingCredits,
        checkedAt: timestampToIso(apiKeyData.sunoRemainingCreditsUpdatedAt),
        sourceTrackId: apiKeyData.sunoRemainingCreditsSourceTrackId || trackId,
        sourceTaskId: apiKeyData.sunoRemainingCreditsSourceTaskId || trackData.taskId || null
      });
      return;
    }

    try {
      const creditRes = await fetch("https://api.sunoapi.org/api/v1/generate/credit", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sunoApiKey}`
        }
      });

      if (!creditRes.ok) {
        const errText = await creditRes.text();
        console.error("Suno credit API HTTP Error:", errText);
        res.status(500).json({ error: "Suno credit API HTTP Error", details: errText, ok: false });
        return;
      }

      const creditData = await creditRes.json();
      const remainingCredits = extractRemainingCredits(creditData);

      if (remainingCredits === null) {
        res.status(500).json({ error: "Unable to parse remaining credits", details: creditData, ok: false });
        return;
      }

      await apiKeyDocRef.set({
        sunoRemainingCredits: remainingCredits,
        sunoRemainingCreditsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        sunoRemainingCreditsSourceTrackId: trackId,
        sunoRemainingCreditsSourceTaskId: trackData.taskId || taskId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      await trackRef.set({
        creditCheckedAfterComplete: true,
        creditCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        remainingCreditsAfterComplete: remainingCredits,
      }, { merge: true });

      res.json({
        ok: true,
        alreadyChecked: false,
        remainingCredits,
        sourceTrackId: trackId,
        sourceTaskId: trackData.taskId || taskId || null,
        apiResponse: creditData
      });
    } catch (error: any) {
      console.error(error);
      sendSunoExternalConnectionError(res, error);
    }
  }
);

export const createSunoTrack = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Fallback to empty if parse fails
      }
    }
    body = body || {};

    const title = body.title || "Untitled";
    const lyricsText = body.lyrics || "";
    const stylePrompt = body.style || body.prompt || "";
    const appliedKeywords = body.appliedKeywords || null;
    const dryRun = body.dryRun === true || body.dryRun === "true";
    const sunoModelVersion = normalizeSunoModelVersion(
      body.sunoModelVersion,
      body.sunoVersion,
      body.model
    );

    const db = admin.firestore();
    const apiKeyDoc = await db.collection('user_api_keys').doc(uid).get();

    if (!apiKeyDoc.exists && !dryRun) {
      res.status(400).json({ error: "Suno API Key not found. Please set it in settings." });
      return;
    }

    const apiKeyData = apiKeyDoc.data();
    const sunoApiKey = getStoredSunoApiKeyFromDoc(apiKeyData);

    if (!sunoApiKey && !dryRun) {
      res.status(400).json({ error: "Suno API Key is empty." });
      return;
    }

    try {
        const sunoPayload: any = {
          custom_mode: true,
          customMode: true,
          instrumental: typeof body.instrumental === "boolean" ? body.instrumental : false,
          model: sunoModelVersion,
          sunoVersion: sunoModelVersion,
          sunoModelVersion,
          title: title,
          prompt: lyricsText,
          style: stylePrompt,
          lyrics: lyricsText,
          appliedKeywords: appliedKeywords,
          callBackUrl: "playground"
        };

        if (dryRun) {
          sunoPayload.dryRun = true;
        }
        
      const trackRef = db.collection('suno_tracks').doc(uid).collection('tracks').doc();

      if (dryRun) {
        const trackId = trackRef.id;
        const trackData = {
          taskId: `dryrun_${Date.now()}`,
          title: title,
          prompt: stylePrompt,
          style: stylePrompt,
          lyrics: lyricsText,
          status: 'completed',
          provider: 'dryRun',
          model: sunoModelVersion,
          sunoVersion: sunoModelVersion,
          audioUrl: '',
          imageUrl: '',
          appliedKeywords: appliedKeywords,
          requestPayload: {
            ...sunoPayload
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await trackRef.set(trackData);

        res.json({
          ok: true,
          dryRun: true,
          trackId: trackId,
          taskId: trackData.taskId,
          appliedKeywords: trackData.appliedKeywords,
          requestPayload: trackData.requestPayload
        });
        return;
      }

      const sunoRes = await fetch("https://api.sunoapi.org/api/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sunoApiKey}`
        },
        body: JSON.stringify(sunoPayload)
      });

      if (!sunoRes.ok) {
        const errText = await sunoRes.text();
        console.error("Suno API HTTP Error:", errText);
        res.status(500).json({ error: "Suno API HTTP Error", details: errText });
        return;
      }

      const data = await sunoRes.json();
      
      const taskId = data?.data?.taskId || data?.taskId || "unknown";
      
      // If data.code is >= 400 it's a structural error from sunoapi.org
      const isFailed = typeof data?.code === 'number' && data.code >= 400;

      const trackData = {
        taskId: taskId,
        apiResponse: data,
        requestPayload: sunoPayload,
        prompt: stylePrompt,
        style: stylePrompt,
        title: sunoPayload.title,
        lyrics: lyricsText,
        status: isFailed ? "failed" : "submitted",
        provider: "sunoapi.org",
        model: sunoModelVersion,
        sunoVersion: sunoModelVersion,
        appliedKeywords: appliedKeywords,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await trackRef.set(trackData);

      if (isFailed) {
         res.status(400).json({ error: data?.msg || "Failed to create track based on SunoAPI response", details: data });
         return;
      }

      res.json({ ok: true, trackId: trackRef.id, taskId: taskId, model: sunoModelVersion, sunoVersion: sunoModelVersion });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create track", details: error.message });
    }
  }
);

export const getSunoTrackStatus = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch(e) {}
    }
    body = body || {};

    const taskId =
      body.taskId ||
      body.data?.taskId ||
      req.body?.taskId ||
      req.body?.data?.taskId ||
      null;

    const trackId =
      body.trackId ||
      body.data?.trackId ||
      req.body?.trackId ||
      req.body?.data?.trackId ||
      null;

    const ownerUid =
      body.ownerUid ||
      body.data?.ownerUid ||
      null;

    if (!taskId) {
      res.status(400).json({ error: "The taskId cannot be empty" });
      return;
    }
    if (!trackId) {
      res.status(400).json({ error: "The trackId cannot be empty" });
      return;
    }

    const authUid = await verifyAuth(req, res).catch(() => null);
    
    // Determine which UID to use for API key and track path
    let targetUid: string | null = authUid;
    let isPublicCheckRequired = false;

    if (!targetUid) {
      if (typeof ownerUid === "string" && ownerUid.trim()) {
        targetUid = ownerUid.trim();
        isPublicCheckRequired = true;
      } else {
        res.status(401).json({ error: "Unauthorized. Login required or provide ownerUid." });
        return;
      }
    }

    // After the guard above, targetUid is guaranteed to be a string.
    const safeTargetUid: string = targetUid;

    const db = admin.firestore();
    
    // Check if public if we are using ownerUid without auth
    if (isPublicCheckRequired) {
      const publicTrackSnap = await db
      .collection("suno_tracks")
      .doc(safeTargetUid)
      .collection("tracks")
      .doc(trackId)
      .get();
      if (!publicTrackSnap.exists || publicTrackSnap.data()?.isPublic !== true) {
        res.status(403).json({ error: "Track is not public or not found." });
        return;
      }
    }

      const apiKeyDoc = await db
      .collection("user_api_keys")
      .doc(safeTargetUid)
      .get();

    if (!apiKeyDoc.exists) {
      res.status(400).json({ error: "Suno API Key not found for this user." });
      return;
    }

    const apiKeyData = apiKeyDoc.data();
    const sunoApiKey = getStoredSunoApiKeyFromDoc(apiKeyData);

    if (!sunoApiKey) {
      res.status(400).json({ error: "Suno API Key is empty." });
      return;
    }

    const trackRef = db
    .collection("suno_tracks")
    .doc(safeTargetUid)
    .collection("tracks")
    .doc(trackId);
    const trackSnap = await trackRef.get();
    if (!trackSnap.exists) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    const trackData = trackSnap.data();
    if (trackData?.taskId !== taskId) {
      res.status(400).json({ error: "Task ID mismatch" });
      return;
    }

    try {
      console.log("getSunoTrackStatus resolved taskId:", taskId);
      console.log("getSunoTrackStatus resolved trackId:", trackId);

      const SUNO_STATUS_URL = "https://api.sunoapi.org/api/v1/generate/record-info";
      
      const reqUrl = `${SUNO_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`;
      
      console.log("getSunoTrackStatus calling URL:", reqUrl);

      const sunoRes = await fetch(reqUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sunoApiKey}`
        }
      });

      if (!sunoRes.ok) {
        const errText = await sunoRes.text();
        console.error("Suno API HTTP Error:", errText);
        res.status(500).json({ error: "Suno API HTTP Error", details: errText });
        return;
      }

      const data = await sunoRes.json();
      
      const isFailed = (typeof data?.code === 'number' && data.code >= 400) || data?.status === 'FAILED' || data?.status === 'failed';
      const isMissingTaskIdError = isFailed && typeof data?.msg === 'string' && data.msg.includes("taskId cannot be empty");
      
      let status = trackData?.status || "processing";
      let duration = trackData?.duration || 0;

      const responseData = data?.data;
      const responseObj = responseData?.response || {};
      const sunoDataRaw =
        responseObj?.sunoData ||
        responseObj?.data ||
        responseData?.sunoData ||
        data?.sunoData ||
        data?.data?.sunoData ||
        (Array.isArray(responseData) ? responseData : (responseData ? [responseData] : [data]));
      const rawSunoData = Array.isArray(sunoDataRaw) ? sunoDataRaw : [sunoDataRaw];
      const sunoData = rawSunoData.filter(Boolean).map(normalizeSunoDataItem);

      const audioUrls: string[] = sunoData
        .map((item: any) => pickFirstString(item?.audioUrl, item?.streamAudioUrl, item?.audio_url, item?.stream_audio_url))
        .filter(Boolean);

      // If it's just a missing taskId error from API, do not mark as failed.
      if (!isMissingTaskIdError) {
        const hasAnyAudio = audioUrls.length > 0;
        const hasAllAudio = sunoData.length > 0 && sunoData.every((item: any) => !!pickFirstString(item?.audioUrl, item?.streamAudioUrl, item?.audio_url, item?.stream_audio_url));
        const anyItemFailed = sunoData.some((item: any) => isFailedStatus(item?.status));
        const allItemsCompleted = sunoData.length > 0 && sunoData.every((item: any) => isCompleteStatus(item?.status) || !!pickFirstString(item?.audioUrl, item?.streamAudioUrl, item?.audio_url, item?.stream_audio_url));
        const apiReportedComplete = isCompleteStatus(data?.status) || isCompleteStatus(responseData?.status) || isCompleteStatus(responseObj?.status);

        for (const item of sunoData) {
          const itemDuration = pickFirstPositiveNumber(item?.duration, item?.durationSeconds, item?.duration_seconds, item?.metadata?.duration, item?.metadata?.durationSeconds, item?.metadata?.duration_seconds);
          if (itemDuration) duration = itemDuration;
        }

        if (isFailed || anyItemFailed) {
          status = hasAnyAudio ? "processing" : "failed";
        } else if (hasAllAudio && (apiReportedComplete || allItemsCompleted || hasAnyAudio)) {
          status = "completed";
        } else if (hasAnyAudio) {
          // One result may be ready before the second one. Keep polling instead of freezing as completed.
          status = "processing";
        } else if (apiReportedComplete) {
          // API can report SUCCESS before audio URLs become available. Keep polling.
          status = "processing";
        } else {
          status = String(data?.status || responseData?.status || status || "processing").toLowerCase();
        }
      } else {
         console.warn("External API reported missing taskId. Not changing track status to failed.", data);
      }

      const updates: any = {
        apiStatusResponse: data,
        sunoData: sunoData,
        audioUrls: audioUrls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (!isMissingTaskIdError) {
        updates.status = status;
      }

      let finalAudioUrl = "";
      let finalImageUrl = "";

      const first = Array.isArray(sunoData) ? sunoData.find((item: any) => pickFirstString(item?.audioUrl, item?.streamAudioUrl, item?.audio_url, item?.stream_audio_url)) || sunoData[0] : null;

      finalAudioUrl =
        pickFirstString(
          first?.audioUrl,
          first?.streamAudioUrl,
          first?.audio_url,
          first?.stream_audio_url,
          first?.sourceAudioUrl,
          first?.sourceStreamAudioUrl,
          responseObj?.audioUrl,
          responseObj?.audio_url
        );

      finalImageUrl =
        pickFirstString(
          first?.imageUrl,
          first?.image_url,
          first?.sourceImageUrl,
          first?.source_image_url,
          responseObj?.imageUrl,
          responseObj?.image_url
        );

      if (finalAudioUrl) {
        updates.audioUrl = finalAudioUrl;
        updates.streamAudioUrl = finalAudioUrl;
      }
      if (finalImageUrl) updates.imageUrl = finalImageUrl;
      if (duration) updates.duration = duration;

      await trackRef.update(updates);

      // Also update suno_shares snapshot if it exists
      const shareRef = db.collection('suno_shares').doc(trackId);
      const shareSnap = await shareRef.get();
      if (shareSnap.exists) {
        // If status completed, update snapshot fields
        const shareUpdate: any = {
          status: status,
          sunoData: sunoData,
          apiStatusResponse: data,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (finalAudioUrl) shareUpdate.audioUrl = finalAudioUrl;
        if (finalImageUrl) shareUpdate.imageUrl = finalImageUrl;
        if (duration) shareUpdate.duration = duration;

        await shareRef.update(shareUpdate);
      }

      res.json({
        ok: true,
        status: status,
        audioUrl: finalAudioUrl,
        streamAudioUrl: finalAudioUrl,
        imageUrl: finalImageUrl,
        audioUrls: audioUrls,
        sunoData: sunoData,
        apiStatusResponse: data
      });
      
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch track status", details: error.message });
    }
  }
);
