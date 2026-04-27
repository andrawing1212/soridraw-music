"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSunoTrackStatus = exports.createSunoTrack = exports.getSunoApiKeyStatus = exports.deleteSunoApiKey = exports.saveSunoApiKey = void 0;
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
    const db = admin.firestore();
    const apiKeyDoc = await db.collection('user_api_keys').doc(uid).get();
    if (!apiKeyDoc.exists && !dryRun) {
        res.status(400).json({ error: "Suno API Key not found. Please set it in settings." });
        return;
    }
    const apiKeyData = apiKeyDoc.data();
    const sunoApiKey = apiKeyData === null || apiKeyData === void 0 ? void 0 : apiKeyData.sunoApiKey;
    if (!sunoApiKey && !dryRun) {
        res.status(400).json({ error: "Suno API Key is empty." });
        return;
    }
    try {
        const sunoPayload = {
            custom_mode: true,
            customMode: true,
            instrumental: typeof body.instrumental === "boolean" ? body.instrumental : false,
            model: "V5_5",
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
            appliedKeywords: appliedKeywords,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await trackRef.set(trackData);
        if (isFailed) {
            res.status(400).json({ error: (data === null || data === void 0 ? void 0 : data.msg) || "Failed to create track based on SunoAPI response", details: data });
            return;
        }
        res.json({ ok: true, trackId: trackRef.id, taskId: taskId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create track", details: error.message });
    }
});
exports.getSunoTrackStatus = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
    const sunoApiKey = apiKeyData === null || apiKeyData === void 0 ? void 0 : apiKeyData.sunoApiKey;
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
            (Array.isArray(responseData) ? responseData : (responseData ? [responseData] : [data]));
        const sunoData = Array.isArray(sunoDataRaw) ? sunoDataRaw : [sunoDataRaw];
        const audioUrls = [];
        // If it's just a missing taskId error from API, do not mark as failed.
        if (!isMissingTaskIdError) {
            for (const item of sunoData) {
                if (!item)
                    continue;
                const itemAudioUrl = item.audioUrl || item.audio_url || item.sourceAudioUrl || item.streamAudioUrl || item.stream_audio_url || "";
                if (itemAudioUrl)
                    audioUrls.push(itemAudioUrl);
                if (item.duration || item.durationSeconds || ((_l = item.metadata) === null || _l === void 0 ? void 0 : _l.duration)) {
                    duration = item.duration || item.durationSeconds || ((_m = item.metadata) === null || _m === void 0 ? void 0 : _m.duration);
                }
                // Determine overall status
                if (item.status === "SUCCESS" || item.status === "COMPLETED" || item.status === "completed" || item.status === "success") {
                    status = "completed";
                }
                else if (item.status === "FAILED" || item.status === "failed") {
                    if (status !== "completed")
                        status = "failed";
                }
                else if (item.status && status !== "completed") {
                    status = item.status.toLowerCase();
                }
                else if (itemAudioUrl && status !== "completed") {
                    status = "completed";
                }
            }
            if (isFailed) {
                status = "failed";
            }
            if ((data === null || data === void 0 ? void 0 : data.status) === "SUCCESS" || (data === null || data === void 0 ? void 0 : data.status) === "COMPLETED" || (data === null || data === void 0 ? void 0 : data.status) === "completed" || (data === null || data === void 0 ? void 0 : data.status) === "success") {
                status = "completed";
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
        if (status === "completed" || status === "success") {
            const first = Array.isArray(sunoData) ? sunoData[0] : null;
            finalAudioUrl =
                (first === null || first === void 0 ? void 0 : first.audioUrl) ||
                    (first === null || first === void 0 ? void 0 : first.audio_url) ||
                    (first === null || first === void 0 ? void 0 : first.sourceAudioUrl) ||
                    (first === null || first === void 0 ? void 0 : first.sourceStreamAudioUrl) ||
                    (responseObj === null || responseObj === void 0 ? void 0 : responseObj.audioUrl) ||
                    (responseObj === null || responseObj === void 0 ? void 0 : responseObj.audio_url) ||
                    "";
            finalImageUrl =
                (first === null || first === void 0 ? void 0 : first.imageUrl) ||
                    (first === null || first === void 0 ? void 0 : first.image_url) ||
                    (first === null || first === void 0 ? void 0 : first.sourceImageUrl) ||
                    (responseObj === null || responseObj === void 0 ? void 0 : responseObj.imageUrl) ||
                    (responseObj === null || responseObj === void 0 ? void 0 : responseObj.image_url) ||
                    "";
            if (finalAudioUrl) {
                updates.audioUrl = finalAudioUrl;
                updates.streamAudioUrl = finalAudioUrl;
            }
            if (finalImageUrl)
                updates.imageUrl = finalImageUrl;
        }
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