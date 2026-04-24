"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSunoApiKeyStatus = exports.deleteSunoApiKey = exports.saveSunoApiKey = void 0;
const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
admin.initializeApp();
exports.saveSunoApiKey = functions.https.onCall(async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { apiKey } = request.data;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        throw new functions.https.HttpsError('invalid-argument', 'API Key is required.');
    }
    const uid = auth.uid;
    const db = admin.firestore();
    await db.collection('user_api_keys').doc(uid).set({
        sunoApiKey: apiKey.trim(),
        hasSunoApiKey: true,
        provider: 'sunoapi.org',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, hasSunoApiKey: true };
});
exports.deleteSunoApiKey = functions.https.onCall(async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = auth.uid;
    const db = admin.firestore();
    await db.collection('user_api_keys').doc(uid).delete();
    return { ok: true, hasSunoApiKey: false };
});
exports.getSunoApiKeyStatus = functions.https.onCall(async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = auth.uid;
    const db = admin.firestore();
    const docSnap = await db.collection('user_api_keys').doc(uid).get();
    if (!docSnap.exists) {
        return { ok: true, hasSunoApiKey: false };
    }
    const data = docSnap.data();
    return {
        ok: true,
        hasSunoApiKey: (data === null || data === void 0 ? void 0 : data.hasSunoApiKey) || false,
        provider: (data === null || data === void 0 ? void 0 : data.provider) || null,
        updatedAt: (data === null || data === void 0 ? void 0 : data.updatedAt) ? data.updatedAt.toDate().toISOString() : null,
    };
});
//# sourceMappingURL=index.js.map