import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

const ALLOWED_ORIGINS = [
  "https://soridraw-music.vercel.app",
  "https://soridraw-app-866a5.web.app",
  "https://soridraw-app-866a5.firebaseapp.com"
];

const handleCors = (req: any, res: any) => {
  const origin = req.headers.origin;
  
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
    } else {
      res.set("Access-Control-Allow-Origin", origin);
    }
  } else {
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

    await db.collection('user_api_keys').doc(uid).set({
      sunoApiKey: apiKey.trim(),
      hasSunoApiKey: true,
      provider: 'sunoapi.org',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true, hasSunoApiKey: true });
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

    await db.collection('user_api_keys').doc(uid).delete();

    res.json({ ok: true, hasSunoApiKey: false });
  }
);

export const getSunoApiKeyStatus = onRequest(
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

    const docSnap = await db.collection('user_api_keys').doc(uid).get();

    if (!docSnap.exists) {
      res.json({ ok: true, hasSunoApiKey: false });
      return;
    }

    const docData = docSnap.data();
    res.json({
      ok: true,
      hasSunoApiKey: docData?.hasSunoApiKey || false,
      provider: docData?.provider || null,
      updatedAt: docData?.updatedAt ? docData.updatedAt.toDate().toISOString() : null,
    });
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

    const body = req.body || {};
    const title = body.title || "Untitled";
    const lyricsText = body.lyrics || "";
    const stylePrompt = body.style || body.prompt || "";

    const db = admin.firestore();
    const apiKeyDoc = await db.collection('user_api_keys').doc(uid).get();

    if (!apiKeyDoc.exists) {
      res.status(400).json({ error: "Suno API Key not found. Please set it in settings." });
      return;
    }

    const apiKeyData = apiKeyDoc.data();
    const sunoApiKey = apiKeyData?.sunoApiKey;

    if (!sunoApiKey) {
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
          callBackUrl: "playground"
        };
        
      const trackRef = db.collection('suno_tracks').doc(uid).collection('tracks').doc();

      if (body.dryRun === true) {
        const trackData = {
          taskId: "dry_run",
          apiResponse: { ok: true, dryRun: true },
          requestPayload: sunoPayload,
          prompt: stylePrompt,
          style: stylePrompt,
          title: sunoPayload.title,
          lyrics: lyricsText,
          status: "dry_run",
          provider: "sunoapi.org",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await trackRef.set(trackData);
        res.json({ ok: true, dryRun: true, trackId: trackRef.id, requestPayload: sunoPayload });
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await trackRef.set(trackData);

      if (isFailed) {
         res.status(400).json({ error: data?.msg || "Failed to create track based on SunoAPI response", details: data });
         return;
      }

      res.json({ ok: true, trackId: trackRef.id, taskId: taskId });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create track", details: error.message });
    }
  }
);
