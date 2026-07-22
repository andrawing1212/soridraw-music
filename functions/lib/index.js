"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSunoTrackStatus = exports.createSunoTrack = exports.getSunoRemainingCreditsAfterComplete = exports.getSunoRemainingCredits = exports.fetchSunoShareMetadata = exports.getSunoApiKeyStatus = exports.deleteSunoApiKey = exports.saveSunoApiKey = exports.generateGeminiContent = exports.getGoogleGeminiApiKey = exports.getGoogleGeminiApiKeyStatus = exports.deleteGoogleGeminiApiKey = exports.saveGoogleGeminiApiKey = exports.backfillMissingAuthUsers = exports.syncAuthUserToFirestore = void 0;
const https_1 = require("firebase-functions/v2/https");
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
exports.syncAuthUserToFirestore = functions.auth.user().onCreate(async (user) => {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(user.uid);
    const snap = await userRef.get();
    const createdAtMs = user.metadata.creationTime
        ? new Date(user.metadata.creationTime).getTime()
        : Date.now();
    const safeCreatedAt = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
    const providerIds = (user.providerData || [])
        .map((provider) => provider.providerId)
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
    await userRef.set(Object.assign(Object.assign({}, sessionData), { createdAt: safeCreatedAt, role: "free", accountStatus: "active", paymentStatus: "none", favoriteCount: 0, songGeneratedCount: 0 }));
});
exports.backfillMissingAuthUsers = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    var _a, _b, _c;
    const requesterUid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!requesterUid) {
        throw new https_1.HttpsError("unauthenticated", "관리자 로그인이 필요합니다.");
    }
    const db = admin.firestore();
    const requesterSnap = await db.collection("users").doc(requesterUid).get();
    if (((_b = requesterSnap.data()) === null || _b === void 0 ? void 0 : _b.role) !== "admin") {
        throw new https_1.HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }
    const dryRun = ((_c = request.data) === null || _c === void 0 ? void 0 : _c.dryRun) === true;
    let pageToken;
    let totalAuthUsers = 0;
    let existingUserDocs = 0;
    let missingUserDocs = 0;
    let createdUserDocs = 0;
    const failedUsers = [];
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
            if (dryRun)
                continue;
            try {
                const createdAtMs = authUser.metadata.creationTime
                    ? new Date(authUser.metadata.creationTime).getTime()
                    : Date.now();
                const safeCreatedAt = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
                const providerIds = (authUser.providerData || [])
                    .map((provider) => provider.providerId)
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
            }
            catch (error) {
                failedUsers.push({
                    uid: authUser.uid,
                    email: authUser.email || "",
                    error: (error === null || error === void 0 ? void 0 : error.message) || String(error),
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
});
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
const handleCors = (req, res) => {
    const origin = String(req.headers.origin || "").trim();
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    const isAiStudioPreview = /^https:\/\/[a-z0-9-]+\.usercontent\.goog$/i.test(origin);
    const allowed = Boolean(origin && (ALLOWED_ORIGINS.includes(origin) || isAiStudioPreview));
    res.set("Vary", "Origin");
    res.set("Cache-Control", "no-store");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
    if (allowed) {
        res.set("Access-Control-Allow-Origin", origin);
    }
    else if (isEmulator && (!origin || origin.startsWith("http://localhost:"))) {
        res.set("Access-Control-Allow-Origin", origin || "http://localhost:5173");
    }
    else {
        res.status(403).json({ error: "Origin is not allowed", code: "ORIGIN_NOT_ALLOWED", ok: false });
        return true;
    }
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
};
const verifyAuth = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized", ok: false });
        return null;
    }
    const token = authHeader.split("Bearer ")[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken.uid;
    }
    catch (error) {
        res.status(401).json({ error: "Unauthorized", ok: false });
        return null;
    }
};
const verifyAppCheckForRequest = async (req, res) => {
    const token = String(req.headers["x-firebase-appcheck"] || "").trim();
    const enforce = process.env.ENFORCE_APP_CHECK === "true";
    if (!token) {
        if (enforce) {
            res.status(401).json({ error: "App Check token is required", code: "APP_CHECK_REQUIRED", ok: false });
            return false;
        }
        return true;
    }
    try {
        await admin.appCheck().verifyToken(token);
        return true;
    }
    catch (error) {
        if (!enforce) {
            console.warn("[App Check monitor] invalid token accepted while enforcement is disabled:", error instanceof Error ? error.message : String(error));
            return true;
        }
        res.status(401).json({ error: "Invalid App Check token", code: "APP_CHECK_INVALID", ok: false });
        return false;
    }
};
const GEMINI_ALLOWED_MODELS = new Set([
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]);
const GEMINI_MAX_REQUEST_BYTES = 900000;
const GEMINI_MAX_REQUESTS_PER_MINUTE = 12;
const GEMINI_MAX_ACTIVE_REQUESTS = 2;
const GEMINI_MAX_REQUESTS_PER_SESSION = 3;
const GEMINI_GUARD_STALE_MS = 3 * 60 * 1000;
const GEMINI_SESSION_WINDOW_MS = 10 * 60 * 1000;
const getStoredGeminiApiKey = async (uid) => {
    var _a;
    // Read the current server-only key for every real Gemini request. One Firestore read is
    // intentionally preferred over caching private keys in warm instance memory, so key
    // deletion or replacement takes effect immediately across all Function instances.
    const snap = await admin.firestore().collection("user_api_keys").doc(uid).get();
    return String(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.googleGeminiApiKey) || "").trim();
};
const acquireGeminiRequestGuard = async (uid, sessionId) => {
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
            throw new https_1.HttpsError("permission-denied", "현재 계정 상태에서는 Gemini 생성을 사용할 수 없습니다.");
        }
        const data = guardSnap.data() || {};
        const activeUpdatedAt = Number(data.activeUpdatedAt || 0);
        const staleActive = !activeUpdatedAt || now - activeUpdatedAt > GEMINI_GUARD_STALE_MS;
        const activeCount = staleActive ? 0 : Math.max(0, Number(data.activeCount || 0));
        if (activeCount >= GEMINI_MAX_ACTIVE_REQUESTS) {
            throw new https_1.HttpsError("resource-exhausted", "동시에 실행할 수 있는 Gemini 요청 수를 초과했습니다.");
        }
        const minuteWindowStart = Number(data.minuteWindowStart || 0);
        const sameMinuteWindow = minuteWindowStart > 0 && now - minuteWindowStart < 60000;
        const minuteCount = sameMinuteWindow ? Math.max(0, Number(data.minuteCount || 0)) : 0;
        if (minuteCount >= GEMINI_MAX_REQUESTS_PER_MINUTE) {
            throw new https_1.HttpsError("resource-exhausted", "짧은 시간에 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
        }
        const sessionWindowStart = Number(data.sessionWindowStart || 0);
        const sameSessionWindow = sessionWindowStart > 0 && now - sessionWindowStart < GEMINI_SESSION_WINDOW_MS;
        const sessionCounts = sameSessionWindow && data.sessionCounts && typeof data.sessionCounts === "object"
            ? Object.assign({}, data.sessionCounts) : {};
        const sessionCount = Math.max(0, Number(sessionCounts[sessionId] || 0));
        if (sessionCount >= GEMINI_MAX_REQUESTS_PER_SESSION) {
            throw new https_1.HttpsError("resource-exhausted", "곡 하나의 Gemini 호출 상한에 도달했습니다.");
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
const releaseGeminiRequestGuard = async (uid) => {
    const db = admin.firestore();
    const guardRef = db.collection("gemini_request_guards").doc(uid);
    try {
        await db.runTransaction(async (tx) => {
            var _a;
            const snap = await tx.get(guardRef);
            if (!snap.exists)
                return;
            const activeCount = Math.max(0, Number(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.activeCount) || 0) - 1);
            tx.set(guardRef, {
                activeCount,
                activeUpdatedAt: Date.now(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
    }
    catch (error) {
        console.warn("[Gemini Guard] failed to release active request:", error instanceof Error ? error.message : String(error));
    }
};
const extractGeminiErrorStatus = (error) => {
    var _a;
    const anyError = error;
    const candidates = [anyError === null || anyError === void 0 ? void 0 : anyError.status, anyError === null || anyError === void 0 ? void 0 : anyError.statusCode, anyError === null || anyError === void 0 ? void 0 : anyError.code, (_a = anyError === null || anyError === void 0 ? void 0 : anyError.error) === null || _a === void 0 ? void 0 : _a.code];
    for (const value of candidates) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 400 && parsed <= 599)
            return parsed;
    }
    const message = error instanceof Error ? error.message : String(error || "");
    const match = message.match(/\b(400|401|403|404|408|409|429|500|502|503|504)\b/);
    return match ? Number(match[1]) : 500;
};
const sanitizeGeminiErrorMessage = (error, apiKey) => {
    const raw = error instanceof Error ? error.message : String(error || "Gemini request failed");
    return raw.split(apiKey).join("[REDACTED]").replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]").slice(0, 600);
};
const normalizeGeminiContent = (value) => {
    if (typeof value === "string") {
        return { role: "user", parts: [{ text: value }] };
    }
    if (value && typeof value === "object" && Array.isArray(value.parts))
        return value;
    return value;
};
const validateGeminiTextOnlyRequest = (requestPayload) => {
    var _a;
    const request = requestPayload && typeof requestPayload === "object" ? requestPayload : null;
    if (!request)
        throw new https_1.HttpsError("invalid-argument", "Invalid Gemini request payload.");
    const config = request.config && typeof request.config === "object" ? request.config : {};
    if (request.tools || request.toolConfig || config.tools || config.toolConfig) {
        throw new https_1.HttpsError("invalid-argument", "Gemini tools are not allowed on the SORIDRAW text proxy.");
    }
    let textChars = 0;
    const inspectContent = (content) => {
        if (typeof content === "string") {
            textChars += content.length;
            return;
        }
        if (!content || typeof content !== "object" || !Array.isArray(content.parts)) {
            throw new https_1.HttpsError("invalid-argument", "Gemini contents must contain text parts only.");
        }
        for (const part of content.parts) {
            const keys = part && typeof part === "object" ? Object.keys(part) : [];
            if (!part || typeof part.text !== "string" || keys.some((key) => key !== "text")) {
                throw new https_1.HttpsError("invalid-argument", "Inline files, media and function calls are not allowed.");
            }
            textChars += part.text.length;
        }
    };
    const contents = Array.isArray(request.contents) ? request.contents : [request.contents];
    if (!contents.length || contents.length > 16) {
        throw new https_1.HttpsError("invalid-argument", "Invalid Gemini contents count.");
    }
    contents.forEach(inspectContent);
    if (typeof config.systemInstruction === "string")
        textChars += config.systemInstruction.length;
    else if ((_a = config.systemInstruction) === null || _a === void 0 ? void 0 : _a.parts)
        inspectContent(config.systemInstruction);
    if (textChars <= 0 || textChars > 500000) {
        throw new https_1.HttpsError("invalid-argument", "Gemini text payload is empty or too large.");
    }
};
const callGeminiGenerateContent = async (apiKey, requestPayload) => {
    var _a, _b;
    const model = String((requestPayload === null || requestPayload === void 0 ? void 0 : requestPayload.model) || "").trim();
    const config = (requestPayload === null || requestPayload === void 0 ? void 0 : requestPayload.config) && typeof requestPayload.config === "object"
        ? Object.assign({}, requestPayload.config) : {};
    const systemInstruction = config.systemInstruction;
    const safetySettings = config.safetySettings;
    const tools = config.tools;
    const toolConfig = config.toolConfig;
    delete config.systemInstruction;
    delete config.safetySettings;
    delete config.tools;
    delete config.toolConfig;
    const rawContents = requestPayload === null || requestPayload === void 0 ? void 0 : requestPayload.contents;
    const contents = Array.isArray(rawContents)
        ? rawContents.map(normalizeGeminiContent)
        : [normalizeGeminiContent(rawContents)];
    const body = {
        contents,
        generationConfig: config,
    };
    if (systemInstruction) {
        body.systemInstruction = typeof systemInstruction === "string"
            ? { parts: [{ text: systemInstruction }] }
            : systemInstruction;
    }
    if (safetySettings)
        body.safetySettings = safetySettings;
    if (tools)
        body.tools = tools;
    if (toolConfig)
        body.toolConfig = toolConfig;
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
        const error = new Error(String(((_a = payload === null || payload === void 0 ? void 0 : payload.error) === null || _a === void 0 ? void 0 : _a.message) || `Gemini request failed (${upstream.status})`));
        error.status = upstream.status;
        error.code = ((_b = payload === null || payload === void 0 ? void 0 : payload.error) === null || _b === void 0 ? void 0 : _b.status) || upstream.status;
        throw error;
    }
    return payload || {};
};
const pickFirstString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    return "";
};
const pickFirstPositiveNumber = (...values) => {
    for (const value of values) {
        if (value === undefined || value === null || value === "")
            continue;
        const num = Number(value);
        if (Number.isFinite(num) && num > 0)
            return num;
    }
    return null;
};
const ALLOWED_SUNO_MODELS = ["V5_5", "V5", "V4_5"];
const normalizeSunoModelVersion = (...values) => {
    for (const value of values) {
        if (typeof value !== "string")
            continue;
        const normalized = value.trim().toUpperCase().replace(/[.\s-]/g, "_");
        if (ALLOWED_SUNO_MODELS.includes(normalized)) {
            return normalized;
        }
    }
    return "V5_5";
};
const normalizeSunoDataItem = (item) => {
    if (!item || typeof item !== "object")
        return item;
    const metadata = item.metadata || {};
    const audioUrl = pickFirstString(item.audioUrl, item.audio_url, item.streamAudioUrl, item.stream_audio_url, item.sourceAudioUrl, item.source_audio_url, item.sourceStreamAudioUrl, item.source_stream_audio_url, item.musicUrl, item.music_url, item.url);
    const imageUrl = pickFirstString(item.imageUrl, item.image_url, item.sourceImageUrl, item.source_image_url, item.coverUrl, item.cover_url, metadata.imageUrl, metadata.image_url);
    const duration = pickFirstPositiveNumber(item.duration, item.durationSeconds, item.duration_seconds, item.playDuration, item.play_duration, metadata.duration, metadata.durationSeconds, metadata.duration_seconds, metadata.playDuration, metadata.play_duration);
    return Object.assign(Object.assign(Object.assign(Object.assign({}, item), (audioUrl ? { audioUrl, streamAudioUrl: audioUrl } : {})), (imageUrl ? { imageUrl } : {})), (duration ? { duration } : {}));
};
const isCompleteStatus = (value) => {
    const normalized = String(value || "").toLowerCase();
    return ["success", "succeeded", "completed", "complete"].includes(normalized);
};
const isFailedStatus = (value) => {
    const normalized = String(value || "").toLowerCase();
    return ["failed", "failure", "error"].includes(normalized);
};
const timestampToIso = (value) => {
    if (!value)
        return null;
    if (typeof (value === null || value === void 0 ? void 0 : value.toDate) === "function")
        return value.toDate().toISOString();
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === "string")
        return value;
    return null;
};
const hasSunoTrackAudio = (track) => {
    if (!track || typeof track !== "object")
        return false;
    if (pickFirstString(track.audioUrl, track.streamAudioUrl, track.audio_url, track.stream_audio_url, track.sourceAudioUrl, track.sourceStreamAudioUrl))
        return true;
    if (Array.isArray(track.audioUrls) && track.audioUrls.some((url) => pickFirstString(url)))
        return true;
    const sunoData = Array.isArray(track.sunoData) ? track.sunoData.filter(Boolean) : [];
    return sunoData.some((item) => pickFirstString(item === null || item === void 0 ? void 0 : item.audioUrl, item === null || item === void 0 ? void 0 : item.streamAudioUrl, item === null || item === void 0 ? void 0 : item.audio_url, item === null || item === void 0 ? void 0 : item.stream_audio_url, item === null || item === void 0 ? void 0 : item.sourceAudioUrl, item === null || item === void 0 ? void 0 : item.sourceStreamAudioUrl));
};
const isExternalTlsCertificateError = (error) => {
    var _a, _b;
    const code = String((error === null || error === void 0 ? void 0 : error.code) || ((_a = error === null || error === void 0 ? void 0 : error.cause) === null || _a === void 0 ? void 0 : _a.code) || "");
    const message = String((error === null || error === void 0 ? void 0 : error.message) || ((_b = error === null || error === void 0 ? void 0 : error.cause) === null || _b === void 0 ? void 0 : _b.message) || "");
    return (code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
        code === "CERT_HAS_EXPIRED" ||
        code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
        message.includes("unable to verify the first certificate") ||
        message.includes("certificate"));
};
const sendSunoExternalConnectionError = (res, error) => {
    var _a;
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
        details: (error === null || error === void 0 ? void 0 : error.message) || ((_a = error === null || error === void 0 ? void 0 : error.cause) === null || _a === void 0 ? void 0 : _a.message) || String(error),
    });
};
const extractRemainingCredits = (payload) => {
    var _a, _b, _c, _d;
    const candidates = [
        payload === null || payload === void 0 ? void 0 : payload.data,
        payload === null || payload === void 0 ? void 0 : payload.credits,
        payload === null || payload === void 0 ? void 0 : payload.remainingCredits,
        payload === null || payload === void 0 ? void 0 : payload.remaining_credits,
        payload === null || payload === void 0 ? void 0 : payload.balance,
        (_a = payload === null || payload === void 0 ? void 0 : payload.data) === null || _a === void 0 ? void 0 : _a.credits,
        (_b = payload === null || payload === void 0 ? void 0 : payload.data) === null || _b === void 0 ? void 0 : _b.remainingCredits,
        (_c = payload === null || payload === void 0 ? void 0 : payload.data) === null || _c === void 0 ? void 0 : _c.remaining_credits,
        (_d = payload === null || payload === void 0 ? void 0 : payload.data) === null || _d === void 0 ? void 0 : _d.balance
    ];
    for (const value of candidates) {
        const num = Number(value);
        if (Number.isFinite(num) && num >= 0)
            return num;
    }
    return null;
};
const getStoredSunoApiKeyFromDoc = (docData) => pickFirstString(docData === null || docData === void 0 ? void 0 : docData.sunoApiKey, docData === null || docData === void 0 ? void 0 : docData.musicApiKey, docData === null || docData === void 0 ? void 0 : docData.suno_api_key, docData === null || docData === void 0 ? void 0 : docData.music_api_key);
const hasStoredSunoApiKeyInDoc = (docData) => Boolean(getStoredSunoApiKeyFromDoc(docData));
const normalizeSunoSharePageUrl = (value) => {
    const raw = pickFirstString(value);
    if (!raw)
        throw new Error("Suno URL is required.");
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase();
    if (!host.includes("suno.com") && !host.includes("suno.ai")) {
        throw new Error("Only Suno share URLs are supported.");
    }
    return url.toString();
};
const decodeHtmlEntities = (value) => value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const getMetaTagContent = (html, attrName, attrValue) => {
    const metaTagRegex = /<meta\s+[^>]*>/gi;
    let match;
    while ((match = metaTagRegex.exec(html))) {
        const tag = match[0];
        const attrRegex = new RegExp(`${attrName}\\s*=\\s*["']${attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
        if (!attrRegex.test(tag))
            continue;
        const contentMatch = tag.match(/content\s*=\s*(["'])([\s\S]*?)\1/i);
        if (contentMatch === null || contentMatch === void 0 ? void 0 : contentMatch[2])
            return decodeHtmlEntities(contentMatch[2].trim());
    }
    return "";
};
const normalizeMetadataUrl = (value, baseUrl) => {
    const raw = pickFirstString(value);
    if (!raw)
        return "";
    try {
        const resolved = new URL(raw, baseUrl);
        if (!["http:", "https:"].includes(resolved.protocol))
            return "";
        return resolved.toString();
    }
    catch (_a) {
        return "";
    }
};
const formatDurationText = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0)
        return "";
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
};
const normalizeDurationSeconds = (value) => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 36000) {
        return Math.round(value);
    }
    const raw = pickFirstString(value);
    if (!raw)
        return null;
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
const findDurationInValue = (value, depth = 0) => {
    if (depth > 8 || value == null)
        return null;
    const direct = normalizeDurationSeconds(value);
    if (direct)
        return direct;
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findDurationInValue(item, depth + 1);
            if (found)
                return found;
        }
        return null;
    }
    if (typeof value !== "object")
        return null;
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
        if (!(key in value))
            continue;
        const raw = value[key];
        const normalized = key.toLowerCase().includes("ms") && typeof raw === "number"
            ? normalizeDurationSeconds(raw / 1000)
            : normalizeDurationSeconds(raw);
        if (normalized)
            return normalized;
    }
    for (const key of Object.keys(value)) {
        const found = findDurationInValue(value[key], depth + 1);
        if (found)
            return found;
    }
    return null;
};
const extractDurationFromJsonScripts = (html) => {
    const scriptRegex = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(html))) {
        const raw = decodeHtmlEntities(match[1] || "").trim();
        if (!raw)
            continue;
        try {
            const parsed = JSON.parse(raw);
            const found = findDurationInValue(parsed);
            if (found)
                return found;
        }
        catch (_a) {
            // Ignore non-JSON script content.
        }
    }
    const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch === null || nextDataMatch === void 0 ? void 0 : nextDataMatch[1]) {
        try {
            const parsed = JSON.parse(decodeHtmlEntities(nextDataMatch[1]).trim());
            const found = findDurationInValue(parsed);
            if (found)
                return found;
        }
        catch (_b) {
            // Ignore invalid Next.js payload.
        }
    }
    return null;
};
const extractDurationFromLooseHtml = (html) => {
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
        if (!(match === null || match === void 0 ? void 0 : match[1]))
            continue;
        const isMs = /durationMs/i.test(pattern.source);
        const normalized = isMs
            ? normalizeDurationSeconds(Number(match[1]) / 1000)
            : normalizeDurationSeconds(match[1]);
        if (normalized)
            return normalized;
    }
    return null;
};
const isBlockedSunoAudioUrl = (value) => {
    const raw = pickFirstString(value).toLowerCase();
    if (!raw)
        return true;
    return /(?:^|\/)(?:sil|silent|silence)[-_]?\d*\.(?:mp3|m4a|wav|aac|ogg|flac)(?:$|[?#])/i.test(raw)
        || /(?:^|\/)(?:blank|empty|placeholder)[-_]?\d*\.(?:mp3|m4a|wav|aac|ogg|flac)(?:$|[?#])/i.test(raw);
};
const normalizeSunoAudioUrl = (value, baseUrl) => {
    const resolved = normalizeMetadataUrl(pickFirstString(value), baseUrl);
    if (!resolved || isBlockedSunoAudioUrl(resolved))
        return "";
    try {
        const url = new URL(resolved);
        const path = decodeURIComponent(url.pathname || "").toLowerCase();
        const host = url.hostname.toLowerCase();
        const hasAudioExtension = /\.(mp3|m4a|wav|aac|ogg|flac)(?:$|[?#])/i.test(url.href);
        const isSunoCdn = host.includes("suno") || host.includes("sunoai") || host.includes("cdn");
        const hasAudioLikePath = /(audio|stream|song|media|clip|mp3|m4a)/i.test(path);
        if (hasAudioExtension)
            return resolved;
        if (isSunoCdn && hasAudioLikePath && !/(image|avatar|cover|artwork|png|jpg|jpeg|webp|gif)/i.test(path))
            return resolved;
    }
    catch (_a) {
        return "";
    }
    return "";
};
const findAudioUrlInValue = (value, baseUrl, depth = 0) => {
    if (depth > 8 || value == null)
        return "";
    if (typeof value === "string") {
        return normalizeSunoAudioUrl(value, baseUrl);
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findAudioUrlInValue(item, baseUrl, depth + 1);
            if (found)
                return found;
        }
        return "";
    }
    if (typeof value !== "object")
        return "";
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
        if (!(key in value))
            continue;
        const found = findAudioUrlInValue(value[key], baseUrl, depth + 1);
        if (found)
            return found;
    }
    for (const key of Object.keys(value)) {
        const lowerKey = key.toLowerCase();
        if (!/(audio|stream|mp3|download|media|song|play)/.test(lowerKey))
            continue;
        const found = findAudioUrlInValue(value[key], baseUrl, depth + 1);
        if (found)
            return found;
    }
    return "";
};
const extractAudioUrlFromJsonScripts = (html, pageUrl) => {
    const scriptRegex = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(html))) {
        const raw = decodeHtmlEntities(match[1] || "").trim();
        if (!raw)
            continue;
        try {
            const parsed = JSON.parse(raw);
            const found = findAudioUrlInValue(parsed, pageUrl);
            if (found)
                return found;
        }
        catch (_a) {
            // Ignore non-JSON script content.
        }
    }
    const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch === null || nextDataMatch === void 0 ? void 0 : nextDataMatch[1]) {
        try {
            const parsed = JSON.parse(decodeHtmlEntities(nextDataMatch[1]).trim());
            const found = findAudioUrlInValue(parsed, pageUrl);
            if (found)
                return found;
        }
        catch (_b) {
            // Ignore invalid Next.js payload.
        }
    }
    return "";
};
const extractAudioUrlFromLooseHtml = (html, pageUrl) => {
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
        if (!(match === null || match === void 0 ? void 0 : match[1]))
            continue;
        const found = normalizeSunoAudioUrl(decodeHtmlEntities(match[1]), pageUrl);
        if (found)
            return found;
    }
    return "";
};
const extractSunoShareMetadataFromHtml = (html, pageUrl) => {
    const coverUrl = normalizeMetadataUrl(pickFirstString(getMetaTagContent(html, "property", "og:image"), getMetaTagContent(html, "name", "twitter:image")), pageUrl);
    const title = pickFirstString(getMetaTagContent(html, "property", "og:title"), getMetaTagContent(html, "name", "twitter:title"));
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
const buildSunoApiKeyStatusPayload = (docData = {}) => {
    const hasStoredKey = hasStoredSunoApiKeyInDoc(docData);
    const hasSunoApiKey = Boolean((docData === null || docData === void 0 ? void 0 : docData.hasSunoApiKey) || (docData === null || docData === void 0 ? void 0 : docData.hasMusicApiKey) || hasStoredKey);
    const provider = (docData === null || docData === void 0 ? void 0 : docData.provider) || (docData === null || docData === void 0 ? void 0 : docData.musicApiProvider) || null;
    return {
        ok: true,
        hasSunoApiKey,
        hasMusicApiKey: hasSunoApiKey,
        registered: hasSunoApiKey,
        hasApiKey: hasSunoApiKey,
        exists: hasSunoApiKey,
        provider,
        updatedAt: timestampToIso((docData === null || docData === void 0 ? void 0 : docData.sunoApiUpdatedAt) || (docData === null || docData === void 0 ? void 0 : docData.musicApiUpdatedAt)),
        sunoRemainingCredits: typeof (docData === null || docData === void 0 ? void 0 : docData.sunoRemainingCredits) === "number" ? docData.sunoRemainingCredits : null,
        sunoRemainingCreditsUpdatedAt: timestampToIso(docData === null || docData === void 0 ? void 0 : docData.sunoRemainingCreditsUpdatedAt),
        sunoRemainingCreditsSourceTrackId: (docData === null || docData === void 0 ? void 0 : docData.sunoRemainingCreditsSourceTrackId) || null,
        sunoRemainingCreditsSourceTaskId: (docData === null || docData === void 0 ? void 0 : docData.sunoRemainingCreditsSourceTaskId) || null,
    };
};
exports.saveGoogleGeminiApiKey = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a;
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    if (!(await verifyAppCheckForRequest(req, res)))
        return;
    const apiKey = (_a = req.body) === null || _a === void 0 ? void 0 : _a.apiKey;
    if (!apiKey || typeof apiKey !== "string") {
        res.status(400).json({ error: "Google Gemini API Key is required", ok: false });
        return;
    }
    const normalizedApiKey = apiKey.trim();
    if (normalizedApiKey.length < 20 || normalizedApiKey.length > 200 || !/^[A-Za-z0-9_-]+$/.test(normalizedApiKey)) {
        res.status(400).json({ error: "Google Gemini API Key 형식을 확인해주세요.", code: "INVALID_GEMINI_KEY_FORMAT", ok: false });
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
});
exports.deleteGoogleGeminiApiKey = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    if (!(await verifyAppCheckForRequest(req, res)))
        return;
    const db = admin.firestore();
    await db.collection("user_api_keys").doc(uid).set({
        googleGeminiApiKey: admin.firestore.FieldValue.delete(),
        hasGoogleGeminiApiKey: false,
        googleGeminiProvider: admin.firestore.FieldValue.delete(),
        googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ ok: true, hasGoogleGeminiApiKey: false });
});
exports.getGoogleGeminiApiKeyStatus = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    if (!(await verifyAppCheckForRequest(req, res)))
        return;
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
});
exports.getGoogleGeminiApiKey = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handleCors(req, res))
        return;
    res.status(410).json({
        ok: false,
        code: "GEMINI_KEY_CLIENT_ACCESS_REMOVED",
        error: "Gemini API keys are no longer returned to the browser.",
    });
});
exports.generateGeminiContent = (0, https_1.onRequest)({
    region: "us-central1",
    timeoutSeconds: 180,
    memory: "512MiB",
    concurrency: 20,
    maxInstances: 30,
}, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed", ok: false });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    if (!(await verifyAppCheckForRequest(req, res)))
        return;
    const serializedLength = Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
    if (serializedLength > GEMINI_MAX_REQUEST_BYTES) {
        res.status(413).json({ error: "Gemini request is too large", code: "REQUEST_TOO_LARGE", ok: false });
        return;
    }
    const requestPayload = (_a = req.body) === null || _a === void 0 ? void 0 : _a.request;
    const model = String((requestPayload === null || requestPayload === void 0 ? void 0 : requestPayload.model) || "").trim();
    const sessionId = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.sessionId) || "").trim();
    const context = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.context) || "Gemini 호출").trim().slice(0, 120);
    const fallbackAttempt = Math.max(1, Math.min(3, Math.round(Number((_d = req.body) === null || _d === void 0 ? void 0 : _d.fallbackAttempt) || 1)));
    if (!requestPayload || typeof requestPayload !== "object" || !model || !GEMINI_ALLOWED_MODELS.has(model)) {
        res.status(400).json({ error: "Unsupported Gemini request", code: "INVALID_GEMINI_REQUEST", ok: false });
        return;
    }
    try {
        validateGeminiTextOnlyRequest(requestPayload);
    }
    catch (validationError) {
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
        const text = Array.isArray((_g = (_f = (_e = response === null || response === void 0 ? void 0 : response.candidates) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.content) === null || _g === void 0 ? void 0 : _g.parts)
            ? response.candidates[0].content.parts.map((part) => String((part === null || part === void 0 ? void 0 : part.text) || "")).join("")
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
    }
    catch (error) {
        const requestError = error;
        if (requestError instanceof https_1.HttpsError) {
            const status = requestError.code === "permission-denied" ? 403 : requestError.code === "resource-exhausted" ? 429 : 400;
            res.status(status).json({ error: requestError.message, code: requestError.code, ok: false });
            return;
        }
        const status = extractGeminiErrorStatus(error);
        res.status(status).json({
            error: sanitizeGeminiErrorMessage(error, apiKey),
            code: status === 429 ? "GEMINI_RATE_LIMITED" : status >= 500 ? "GEMINI_UPSTREAM_UNAVAILABLE" : "GEMINI_UPSTREAM_ERROR",
            ok: false,
        });
    }
    finally {
        if (guardAcquired)
            await releaseGeminiRequestGuard(uid);
    }
});
exports.saveSunoApiKey = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a;
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    const apiKey = (_a = req.body) === null || _a === void 0 ? void 0 : _a.apiKey;
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
});
exports.deleteSunoApiKey = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
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
});
exports.getSunoApiKeyStatus = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
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
});
exports.fetchSunoShareMetadata = (0, https_1.onRequest)({ region: "us-central1", invoker: "public" }, async (req, res) => {
    var _a, _b;
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed", ok: false });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    let shareUrl = "";
    try {
        shareUrl = normalizeSunoSharePageUrl(((_a = req.body) === null || _a === void 0 ? void 0 : _a.url) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.sunoShareUrl));
    }
    catch (error) {
        res.status(400).json({
            ok: false,
            error: (error === null || error === void 0 ? void 0 : error.message) || "Invalid Suno URL.",
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
    }
    catch (error) {
        console.error("[Suno metadata] fetch failed", {
            uid,
            shareUrl,
            message: (error === null || error === void 0 ? void 0 : error.message) || String(error),
        });
        res.status(502).json({
            ok: false,
            error: "Suno cover metadata could not be fetched.",
            details: (error === null || error === void 0 ? void 0 : error.message) || String(error),
        });
    }
    finally {
        clearTimeout(timeout);
    }
});
exports.getSunoRemainingCredits = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
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
    }
    catch (error) {
        console.error(error);
        sendSunoExternalConnectionError(res, error);
    }
});
exports.getSunoRemainingCreditsAfterComplete = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a, _b;
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        }
        catch (e) { }
    }
    body = body || {};
    const trackId = pickFirstString(body.trackId, (_a = body.data) === null || _a === void 0 ? void 0 : _a.trackId);
    const taskId = pickFirstString(body.taskId, (_b = body.data) === null || _b === void 0 ? void 0 : _b.taskId);
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
    }
    catch (error) {
        console.error(error);
        sendSunoExternalConnectionError(res, error);
    }
});
exports.createSunoTrack = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a;
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const uid = await verifyAuth(req, res);
    if (!uid)
        return;
    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        }
        catch (e) {
            // Fallback to empty if parse fails
        }
    }
    body = body || {};
    const title = body.title || "Untitled";
    const lyricsText = body.lyrics || "";
    const stylePrompt = body.style || body.prompt || "";
    const appliedKeywords = body.appliedKeywords || null;
    const dryRun = body.dryRun === true || body.dryRun === "true";
    const sunoModelVersion = normalizeSunoModelVersion(body.sunoModelVersion, body.sunoVersion, body.model);
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
        const sunoPayload = {
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
                requestPayload: Object.assign({}, sunoPayload),
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
        const taskId = ((_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.taskId) || (data === null || data === void 0 ? void 0 : data.taskId) || "unknown";
        // If data.code is >= 400 it's a structural error from sunoapi.org
        const isFailed = typeof (data === null || data === void 0 ? void 0 : data.code) === 'number' && data.code >= 400;
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
            res.status(400).json({ error: (data === null || data === void 0 ? void 0 : data.msg) || "Failed to create track based on SunoAPI response", details: data });
            return;
        }
        res.json({ ok: true, trackId: trackRef.id, taskId: taskId, model: sunoModelVersion, sunoVersion: sunoModelVersion });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create track", details: error.message });
    }
});
exports.getSunoTrackStatus = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (handleCors(req, res))
        return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        }
        catch (e) { }
    }
    body = body || {};
    const taskId = body.taskId ||
        ((_a = body.data) === null || _a === void 0 ? void 0 : _a.taskId) ||
        ((_b = req.body) === null || _b === void 0 ? void 0 : _b.taskId) ||
        ((_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.taskId) ||
        null;
    const trackId = body.trackId ||
        ((_e = body.data) === null || _e === void 0 ? void 0 : _e.trackId) ||
        ((_f = req.body) === null || _f === void 0 ? void 0 : _f.trackId) ||
        ((_h = (_g = req.body) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h.trackId) ||
        null;
    const ownerUid = body.ownerUid ||
        ((_j = body.data) === null || _j === void 0 ? void 0 : _j.ownerUid) ||
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
    let targetUid = authUid;
    let isPublicCheckRequired = false;
    if (!targetUid) {
        if (typeof ownerUid === "string" && ownerUid.trim()) {
            targetUid = ownerUid.trim();
            isPublicCheckRequired = true;
        }
        else {
            res.status(401).json({ error: "Unauthorized. Login required or provide ownerUid." });
            return;
        }
    }
    // After the guard above, targetUid is guaranteed to be a string.
    const safeTargetUid = targetUid;
    const db = admin.firestore();
    // Check if public if we are using ownerUid without auth
    if (isPublicCheckRequired) {
        const publicTrackSnap = await db
            .collection("suno_tracks")
            .doc(safeTargetUid)
            .collection("tracks")
            .doc(trackId)
            .get();
        if (!publicTrackSnap.exists || ((_k = publicTrackSnap.data()) === null || _k === void 0 ? void 0 : _k.isPublic) !== true) {
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
    if ((trackData === null || trackData === void 0 ? void 0 : trackData.taskId) !== taskId) {
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
        const isFailed = (typeof (data === null || data === void 0 ? void 0 : data.code) === 'number' && data.code >= 400) || (data === null || data === void 0 ? void 0 : data.status) === 'FAILED' || (data === null || data === void 0 ? void 0 : data.status) === 'failed';
        const isMissingTaskIdError = isFailed && typeof (data === null || data === void 0 ? void 0 : data.msg) === 'string' && data.msg.includes("taskId cannot be empty");
        let status = (trackData === null || trackData === void 0 ? void 0 : trackData.status) || "processing";
        let duration = (trackData === null || trackData === void 0 ? void 0 : trackData.duration) || 0;
        const responseData = data === null || data === void 0 ? void 0 : data.data;
        const responseObj = (responseData === null || responseData === void 0 ? void 0 : responseData.response) || {};
        const sunoDataRaw = (responseObj === null || responseObj === void 0 ? void 0 : responseObj.sunoData) ||
            (responseObj === null || responseObj === void 0 ? void 0 : responseObj.data) ||
            (responseData === null || responseData === void 0 ? void 0 : responseData.sunoData) ||
            (data === null || data === void 0 ? void 0 : data.sunoData) ||
            ((_l = data === null || data === void 0 ? void 0 : data.data) === null || _l === void 0 ? void 0 : _l.sunoData) ||
            (Array.isArray(responseData) ? responseData : (responseData ? [responseData] : [data]));
        const rawSunoData = Array.isArray(sunoDataRaw) ? sunoDataRaw : [sunoDataRaw];
        const sunoData = rawSunoData.filter(Boolean).map(normalizeSunoDataItem);
        const audioUrls = sunoData
            .map((item) => pickFirstString(item === null || item === void 0 ? void 0 : item.audioUrl, item === null || item === void 0 ? void 0 : item.streamAudioUrl, item === null || item === void 0 ? void 0 : item.audio_url, item === null || item === void 0 ? void 0 : item.stream_audio_url))
            .filter(Boolean);
        // If it's just a missing taskId error from API, do not mark as failed.
        if (!isMissingTaskIdError) {
            const hasAnyAudio = audioUrls.length > 0;
            const hasAllAudio = sunoData.length > 0 && sunoData.every((item) => !!pickFirstString(item === null || item === void 0 ? void 0 : item.audioUrl, item === null || item === void 0 ? void 0 : item.streamAudioUrl, item === null || item === void 0 ? void 0 : item.audio_url, item === null || item === void 0 ? void 0 : item.stream_audio_url));
            const anyItemFailed = sunoData.some((item) => isFailedStatus(item === null || item === void 0 ? void 0 : item.status));
            const allItemsCompleted = sunoData.length > 0 && sunoData.every((item) => isCompleteStatus(item === null || item === void 0 ? void 0 : item.status) || !!pickFirstString(item === null || item === void 0 ? void 0 : item.audioUrl, item === null || item === void 0 ? void 0 : item.streamAudioUrl, item === null || item === void 0 ? void 0 : item.audio_url, item === null || item === void 0 ? void 0 : item.stream_audio_url));
            const apiReportedComplete = isCompleteStatus(data === null || data === void 0 ? void 0 : data.status) || isCompleteStatus(responseData === null || responseData === void 0 ? void 0 : responseData.status) || isCompleteStatus(responseObj === null || responseObj === void 0 ? void 0 : responseObj.status);
            for (const item of sunoData) {
                const itemDuration = pickFirstPositiveNumber(item === null || item === void 0 ? void 0 : item.duration, item === null || item === void 0 ? void 0 : item.durationSeconds, item === null || item === void 0 ? void 0 : item.duration_seconds, (_m = item === null || item === void 0 ? void 0 : item.metadata) === null || _m === void 0 ? void 0 : _m.duration, (_o = item === null || item === void 0 ? void 0 : item.metadata) === null || _o === void 0 ? void 0 : _o.durationSeconds, (_p = item === null || item === void 0 ? void 0 : item.metadata) === null || _p === void 0 ? void 0 : _p.duration_seconds);
                if (itemDuration)
                    duration = itemDuration;
            }
            if (isFailed || anyItemFailed) {
                status = hasAnyAudio ? "processing" : "failed";
            }
            else if (hasAllAudio && (apiReportedComplete || allItemsCompleted || hasAnyAudio)) {
                status = "completed";
            }
            else if (hasAnyAudio) {
                // One result may be ready before the second one. Keep polling instead of freezing as completed.
                status = "processing";
            }
            else if (apiReportedComplete) {
                // API can report SUCCESS before audio URLs become available. Keep polling.
                status = "processing";
            }
            else {
                status = String((data === null || data === void 0 ? void 0 : data.status) || (responseData === null || responseData === void 0 ? void 0 : responseData.status) || status || "processing").toLowerCase();
            }
        }
        else {
            console.warn("External API reported missing taskId. Not changing track status to failed.", data);
        }
        const updates = {
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
        const first = Array.isArray(sunoData) ? sunoData.find((item) => pickFirstString(item === null || item === void 0 ? void 0 : item.audioUrl, item === null || item === void 0 ? void 0 : item.streamAudioUrl, item === null || item === void 0 ? void 0 : item.audio_url, item === null || item === void 0 ? void 0 : item.stream_audio_url)) || sunoData[0] : null;
        finalAudioUrl =
            pickFirstString(first === null || first === void 0 ? void 0 : first.audioUrl, first === null || first === void 0 ? void 0 : first.streamAudioUrl, first === null || first === void 0 ? void 0 : first.audio_url, first === null || first === void 0 ? void 0 : first.stream_audio_url, first === null || first === void 0 ? void 0 : first.sourceAudioUrl, first === null || first === void 0 ? void 0 : first.sourceStreamAudioUrl, responseObj === null || responseObj === void 0 ? void 0 : responseObj.audioUrl, responseObj === null || responseObj === void 0 ? void 0 : responseObj.audio_url);
        finalImageUrl =
            pickFirstString(first === null || first === void 0 ? void 0 : first.imageUrl, first === null || first === void 0 ? void 0 : first.image_url, first === null || first === void 0 ? void 0 : first.sourceImageUrl, first === null || first === void 0 ? void 0 : first.source_image_url, responseObj === null || responseObj === void 0 ? void 0 : responseObj.imageUrl, responseObj === null || responseObj === void 0 ? void 0 : responseObj.image_url);
        if (finalAudioUrl) {
            updates.audioUrl = finalAudioUrl;
            updates.streamAudioUrl = finalAudioUrl;
        }
        if (finalImageUrl)
            updates.imageUrl = finalImageUrl;
        if (duration)
            updates.duration = duration;
        await trackRef.update(updates);
        // Also update suno_shares snapshot if it exists
        const shareRef = db.collection('suno_shares').doc(trackId);
        const shareSnap = await shareRef.get();
        if (shareSnap.exists) {
            // If status completed, update snapshot fields
            const shareUpdate = {
                status: status,
                sunoData: sunoData,
                apiStatusResponse: data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (finalAudioUrl)
                shareUpdate.audioUrl = finalAudioUrl;
            if (finalImageUrl)
                shareUpdate.imageUrl = finalImageUrl;
            if (duration)
                shareUpdate.duration = duration;
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch track status", details: error.message });
    }
});
//# sourceMappingURL=index.js.map