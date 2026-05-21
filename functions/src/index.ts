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
      sunoRemainingCredits: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsUpdatedAt: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsSourceTrackId: admin.firestore.FieldValue.delete(),
      sunoRemainingCreditsSourceTaskId: admin.firestore.FieldValue.delete(),
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
      updatedAt: timestampToIso(docData?.updatedAt),
      sunoRemainingCredits: typeof docData?.sunoRemainingCredits === "number" ? docData.sunoRemainingCredits : null,
      sunoRemainingCreditsUpdatedAt: timestampToIso(docData?.sunoRemainingCreditsUpdatedAt),
      sunoRemainingCreditsSourceTrackId: docData?.sunoRemainingCreditsSourceTrackId || null,
      sunoRemainingCreditsSourceTaskId: docData?.sunoRemainingCreditsSourceTaskId || null,
    });
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
    const sunoApiKey = apiKeyData.sunoApiKey;

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
      res.status(500).json({ error: "Failed to fetch remaining credits", details: error.message, ok: false });
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
    const sunoApiKey = apiKeyData.sunoApiKey;

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
      res.status(500).json({ error: "Failed to fetch remaining credits", details: error.message, ok: false });
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
    const sunoApiKey = apiKeyData?.sunoApiKey;

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
