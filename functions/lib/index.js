"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSunoTrack = exports.getSunoApiKeyStatus = exports.deleteSunoApiKey = exports.saveSunoApiKey = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const ALLOWED_ORIGINS = [
    "https://soridraw-music.vercel.app",
    "https://soridraw-app-866a5.web.app",
    "https://soridraw-app-866a5.firebaseapp.com"
];
const handleCors = (req, res) => {
    const origin = req.headers.origin;
    if (origin) {
        if (ALLOWED_ORIGINS.includes(origin)) {
            res.set("Access-Control-Allow-Origin", origin);
        }
        else {
            res.set("Access-Control-Allow-Origin", origin);
        }
    }
    else {
        res.set("Access-Control-Allow-Origin", "*");
    }
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true; // CORS preflight handled
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
    await db.collection('user_api_keys').doc(uid).set({
        sunoApiKey: apiKey.trim(),
        hasSunoApiKey: true,
        provider: 'sunoapi.org',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ ok: true, hasSunoApiKey: true });
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
    await db.collection('user_api_keys').doc(uid).delete();
    res.json({ ok: true, hasSunoApiKey: false });
});
exports.getSunoApiKeyStatus = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
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
    if (!docSnap.exists) {
        res.json({ ok: true, hasSunoApiKey: false });
        return;
    }
    const docData = docSnap.data();
    res.json({
        ok: true,
        hasSunoApiKey: (docData === null || docData === void 0 ? void 0 : docData.hasSunoApiKey) || false,
        provider: (docData === null || docData === void 0 ? void 0 : docData.provider) || null,
        updatedAt: (docData === null || docData === void 0 ? void 0 : docData.updatedAt) ? docData.updatedAt.toDate().toISOString() : null,
    });
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
    const { prompt } = req.body;
    if (!prompt) {
        res.status(400).json({ error: "prompt is required" });
        return;
    }
    const db = admin.firestore();
    const apiKeyDoc = await db.collection('user_api_keys').doc(uid).get();
    if (!apiKeyDoc.exists) {
        res.status(400).json({ error: "Suno API Key not found. Please set it in settings." });
        return;
    }
    const apiKeyData = apiKeyDoc.data();
    const sunoApiKey = apiKeyData === null || apiKeyData === void 0 ? void 0 : apiKeyData.sunoApiKey;
    if (!sunoApiKey) {
        res.status(400).json({ error: "Suno API Key is empty." });
        return;
    }
    try {
        const sunoRes = await fetch("https://api.sunoapi.org/api/v1/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sunoApiKey}`
            },
            body: JSON.stringify({
                prompt: prompt,
                model: "V5_5",
                callbackUrl: "playground"
            })
        });
        if (!sunoRes.ok) {
            const errText = await sunoRes.text();
            console.error("Suno API Error:", errText);
            res.status(500).json({ error: "Suno API Error", details: errText });
            return;
        }
        const data = await sunoRes.json();
        const taskId = (data === null || data === void 0 ? void 0 : data.id) || (data === null || data === void 0 ? void 0 : data.taskId) || ((_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.task_id) || (data === null || data === void 0 ? void 0 : data.task_id) || "unknown";
        const trackRef = db.collection('suno_tracks').doc(uid).collection('tracks').doc();
        const trackData = {
            taskId: taskId,
            apiResponse: data,
            prompt: prompt,
            status: "submitted",
            provider: "sunoapi.org",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await trackRef.set(trackData);
        res.json({ ok: true, trackId: trackRef.id, taskId: taskId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create track", details: error.message });
    }
});
//# sourceMappingURL=index.js.map