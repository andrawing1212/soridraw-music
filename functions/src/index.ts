import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

const ALLOWED_ORIGINS = [
  "https://soridraw-music.vercel.app",
  "https://soridraw-app-866a5.web.app",
  "https://soridraw-app-866a5.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

const handleCors = (req: any, res: any) => {
  const origin = req.headers.origin as string | undefined;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    // 개발/프리뷰/Vercel alias 대응. API Key는 서버에만 있으므로 프론트 origin은 넓게 허용.
    res.set("Access-Control-Allow-Origin", "*");
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");

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
    console.error("verifyAuth error:", error);
    res.status(401).json({ error: "Unauthorized", ok: false });
    return null;
  }
};

const normalizeSunoStatus = (rawStatus?: string) => {
  const status = (rawStatus || "").toUpperCase();

  if (status === "SUCCESS" || status === "COMPLETED") return "completed";
  if (
    status === "CREATE_TASK_FAILED" ||
    status === "GENERATE_AUDIO_FAILED" ||
    status === "CALLBACK_EXCEPTION" ||
    status === "SENSITIVE_WORD_ERROR" ||
    status === "FAILED"
  ) {
    return "failed";
  }
  if (status === "TEXT_SUCCESS" || status === "FIRST_SUCCESS" || status === "PENDING") {
    return "processing";
  }

  return rawStatus ? rawStatus.toLowerCase() : "processing";
};

const extractFirstSunoAudio = (data: any) => {
  const rootData = data?.data || data;
  const response = rootData?.response || {};
  const sunoData = response?.sunoData;

  const candidates = [
    ...(Array.isArray(sunoData) ? sunoData : []),
    ...(Array.isArray(rootData?.sunoData) ? rootData.sunoData : []),
    ...(Array.isArray(rootData) ? rootData : []),
    rootData,
    response,
  ].filter(Boolean);

  for (const item of candidates) {
    const audioUrl = item.audioUrl || item.audio_url || item.sourceAudioUrl || "";
    const streamAudioUrl = item.streamAudioUrl || item.stream_audio_url || "";
    const imageUrl = item.imageUrl || item.image_url || "";

    if (audioUrl || streamAudioUrl) {
      return {
        audioUrl,
        streamAudioUrl,
        imageUrl,
      };
    }
  }

  return {
    audioUrl: "",
    streamAudioUrl: "",
    imageUrl: "",
  };
};

export const saveSunoApiKey = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const apiKey = req.body?.apiKey;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      res.status(400).json({ error: "API Key is required" });
      return;
    }

    const db = admin.firestore();

    await db.collection("user_api_keys").doc(uid).set(
      {
        sunoApiKey: apiKey.trim(),
        hasSunoApiKey: true,
        provider: "sunoapi.org",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ ok: true, hasSunoApiKey: true });
  }
);

export const deleteSunoApiKey = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const db = admin.firestore();

    await db.collection("user_api_keys").doc(uid).delete();

    res.json({ ok: true, hasSunoApiKey: false });
  }
);

export const getSunoApiKeyStatus = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const db = admin.firestore();
    const docSnap = await db.collection("user_api_keys").doc(uid).get();

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
  { region: "us-central1", cors: true },
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
    const apiKeyDoc = await db.collection("user_api_keys").doc(uid).get();

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
        title,
        prompt: lyricsText,
        style: stylePrompt,
        lyrics: lyricsText,
        callBackUrl: "playground",
      };

      const trackRef = db.collection("suno_tracks").doc(uid).collection("tracks").doc();

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
          Authorization: `Bearer ${sunoApiKey}`,
        },
        body: JSON.stringify(sunoPayload),
      });

      if (!sunoRes.ok) {
        const errText = await sunoRes.text();
        console.error("Suno API HTTP Error:", errText);
        res.status(500).json({ error: "Suno API HTTP Error", details: errText });
        return;
      }

      const data = await sunoRes.json();
      const taskId = data?.data?.taskId || data?.taskId || "unknown";
      const isFailed = typeof data?.code === "number" && data.code >= 400;

      const trackData = {
        taskId,
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

      res.json({ ok: true, trackId: trackRef.id, taskId });
    } catch (error: any) {
      console.error("createSunoTrack error:", error);
      res.status(500).json({ error: "Failed to create track", details: error.message });
    }
  }
);

export const getSunoTrackStatus = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;

    const { trackId, taskId } = req.body || {};

    if (!trackId || !taskId) {
      res.status(400).json({ error: "trackId and taskId are required" });
      return;
    }

    const db = admin.firestore();
    const apiKeyDoc = await db.collection("user_api_keys").doc(uid).get();

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

    const trackRef = db.collection("suno_tracks").doc(uid).collection("tracks").doc(trackId);
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
      const url = new URL("https://api.sunoapi.org/api/v1/generate/record-info");
      url.searchParams.set("taskId", taskId);

      const sunoRes = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sunoApiKey}`,
        },
      });

      if (!sunoRes.ok) {
        const errText = await sunoRes.text();
        console.error("Suno API HTTP Error:", errText);
        res.status(500).json({ error: "Suno API HTTP Error", details: errText });
        return;
      }

      const data = await sunoRes.json();
      const apiCode = typeof data?.code === "number" ? data.code : 200;
      const rootData = data?.data || {};
      const apiStatus = rootData?.status || data?.status;
      const normalizedStatus = normalizeSunoStatus(apiStatus);
      const audio = extractFirstSunoAudio(data);

      let status = normalizedStatus;

      if (apiCode >= 400) {
        status = "failed";
      } else if ((audio.audioUrl || audio.streamAudioUrl) && status !== "failed") {
        status = "completed";
      }

      const updates: any = {
        apiStatusResponse: data,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (audio.audioUrl) updates.audioUrl = audio.audioUrl;
      if (audio.streamAudioUrl) updates.streamAudioUrl = audio.streamAudioUrl;
      if (audio.imageUrl) updates.imageUrl = audio.imageUrl;
      if (rootData?.errorCode) updates.errorCode = rootData.errorCode;
      if (rootData?.errorMessage) updates.errorMessage = rootData.errorMessage;

      await trackRef.update(updates);

      res.json({
        ok: true,
        status,
        audioUrl: audio.audioUrl || audio.streamAudioUrl || "",
        streamAudioUrl: audio.streamAudioUrl || "",
        imageUrl: audio.imageUrl || "",
        apiStatusResponse: data,
      });
    } catch (error: any) {
      console.error("getSunoTrackStatus error:", error);
      res.status(500).json({ error: "Failed to fetch track status", details: error.message });
    }
  }
);
