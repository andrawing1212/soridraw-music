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

    const db = admin.firestore();
    const apiKeyDoc = await db.collection('user_api_keys').doc(uid).get();

    if (!apiKeyDoc.exists && !dryRun) {
      res.status(400).json({ error: "Suno API Key not found. Please set it in settings." });
      return;
    }

    const apiKeyData = apiKeyDoc.data();
    const sunoApiKey = apiKeyData?.sunoApiKey;

    if (!sunoApiKey && !dryRun) {
      res.status(400).json({ error: "Suno API Key is empty." });
      return;
    }

    try {
        const sunoPayload: any = {
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
        appliedKeywords: appliedKeywords,
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

export const getSunoTrackStatus = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const body = req.body || {};
    const { trackId, taskId, ownerUid } = body;
    if (!trackId || !taskId) {
      res.status(400).json({ error: "trackId and taskId are required" });
      return;
    }

    const authUid = await verifyAuth(req, res).catch(() => null);
    
    // Determine which UID to use for API key and track path
    let targetUid = authUid;
    let isPublicCheckRequired = false;

    if (!targetUid) {
      if (ownerUid) {
        targetUid = ownerUid;
        isPublicCheckRequired = true;
      } else {
        res.status(401).json({ error: "Unauthorized. Login required or provide ownerUid." });
        return;
      }
    }

    const db = admin.firestore();
    
    // Check if public if we are using ownerUid without auth
    if (isPublicCheckRequired) {
      const publicTrackSnap = await db.collection('suno_tracks').doc(targetUid).collection('tracks').doc(trackId).get();
      if (!publicTrackSnap.exists || publicTrackSnap.data()?.isPublic !== true) {
        res.status(403).json({ error: "Track is not public or not found." });
        return;
      }
    }

    const apiKeyDoc = await db.collection('user_api_keys').doc(targetUid).get();

    if (!apiKeyDoc.exists) {
      res.status(400).json({ error: "Suno API Key not found for this user." });
      return;
    }

    const apiKeyData = apiKeyDoc.data();
    const sunoApiKey = apiKeyData?.sunoApiKey;

    if (!sunoApiKey) {
      res.status(400).json({ error: "Suno API Key is empty." });
      return;
    }

    const trackRef = db.collection('suno_tracks').doc(targetUid).collection('tracks').doc(trackId);
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
      const SUNO_STATUS_URL = "https://api.sunoapi.org/api/v1/generate/record-info";
      
      const sunoRes = await fetch(`${SUNO_STATUS_URL}?taskIds=${taskId}`, {
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
      
      const isFailed = typeof data?.code === 'number' && data.code >= 400;
      
      let status = "processing";
      let audioUrl = "";
      let streamAudioUrl = "";
      let imageUrl = "";
      let duration = 0;
      const sunoData = Array.isArray(data?.data) ? data.data : [data?.data || data];
      const audioUrls: string[] = [];

      for (const item of sunoData) {
        if (!item) continue;
        
        const itemAudioUrl = item.audioUrl || item.audio_url || item.sourceAudioUrl || "";
        const itemStreamUrl = item.streamAudioUrl || item.stream_audio_url || "";
        
        if (itemAudioUrl) audioUrls.push(itemAudioUrl);
        else if (itemStreamUrl) audioUrls.push(itemStreamUrl);

        if (!audioUrl && (itemAudioUrl || itemStreamUrl)) {
          audioUrl = itemAudioUrl || itemStreamUrl;
          streamAudioUrl = itemStreamUrl || itemAudioUrl;
          imageUrl = item.imageUrl || item.image_url || "";
          duration = item.duration || item.durationSeconds || item.metadata?.duration || 0;
        }

        // Determine overall status
        if (item.status === "SUCCESS" || item.status === "completed") {
          status = "completed";
        } else if (item.status === "FAILED" || item.status === "failed") {
          if (status !== "completed") status = "failed";
        } else if (item.status && status !== "completed") {
          status = item.status.toLowerCase();
        } else if ((itemAudioUrl || itemStreamUrl) && status !== "completed") {
          status = "completed";
        }
      }

      if (isFailed) {
        status = "failed";
      }

      const updates: any = {
        apiStatusResponse: data,
        sunoData: sunoData,
        audioUrls: audioUrls,
        status: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (audioUrl) updates.audioUrl = audioUrl;
      if (streamAudioUrl) updates.streamAudioUrl = streamAudioUrl;
      if (imageUrl) updates.imageUrl = imageUrl;

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
        if (audioUrl) shareUpdate.audioUrl = audioUrl;
        if (imageUrl) shareUpdate.imageUrl = imageUrl;
        if (duration) shareUpdate.duration = duration;

        await shareRef.update(shareUpdate);
      }

      res.json({
        ok: true,
        status: status,
        audioUrl: audioUrl || streamAudioUrl,
        streamAudioUrl: streamAudioUrl,
        imageUrl: imageUrl,
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
