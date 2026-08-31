const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', 'src', 'index.ts');
let source = fs.readFileSync(sourcePath, 'utf8');

const MARKER = '// SORIDRAW_SUNO_WAV_RESCUE_994';
const ANCHOR = 'export const getSunoTrackStatus = onRequest(';

if (!source.includes(MARKER)) {
  if (!source.includes(ANCHOR)) throw new Error('994 anchor missing: getSunoTrackStatus');

  const block = String.raw`
${MARKER}
const SUNO_WAV_RESCUE_CALLBACK_URL = "https://us-central1-soridraw-app-866a5.cloudfunctions.net/sunoWavRescueCallback";
const SUNO_WAV_RESCUE_BUCKET = "soridraw-app-866a5.firebasestorage.app";
const SUNO_WAV_RESCUE_MAX_POLLS = 12;
const SUNO_WAV_RESCUE_POLL_MS = 5000;

const sleepSunoWavRescue = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSunoWavRescueUrl = (payload: any): string => pickFirstString(
  payload?.data?.response?.audioWavUrl,
  payload?.data?.response?.audio_wav_url,
  payload?.data?.audioWavUrl,
  payload?.data?.audio_wav_url,
  payload?.response?.audioWavUrl,
  payload?.response?.audio_wav_url,
  payload?.audioWavUrl,
  payload?.audio_wav_url,
);

const getSunoWavRescueTaskId = (payload: any): string => pickFirstString(
  payload?.data?.taskId,
  payload?.data?.task_id,
  payload?.taskId,
  payload?.task_id,
);

const pollSunoWavRescue = async (apiKey: string, wavTaskId: string): Promise<{ audioUrl: string; payload: any } | null> => {
  for (let attempt = 0; attempt < SUNO_WAV_RESCUE_MAX_POLLS; attempt += 1) {
    if (attempt > 0) await sleepSunoWavRescue(SUNO_WAV_RESCUE_POLL_MS);

    const response = await fetch(
      `https://api.sunoapi.org/api/v1/wav/record-info?taskId=${encodeURIComponent(wavTaskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn('[Suno WAV Rescue] record-info HTTP', { status: response.status, attempt });
      continue;
    }

    const providerCode = Number(payload?.code || 200);
    const status = String(payload?.data?.successFlag || payload?.data?.status || payload?.status || '').toUpperCase();
    if (providerCode >= 400 || status.includes('FAILED') || status.includes('ERROR')) return null;

    const audioUrl = getSunoWavRescueUrl(payload);
    if (audioUrl && await probeSunoAudioUrlHasBytes(audioUrl)) {
      return { audioUrl, payload };
    }
  }
  return null;
};

const persistSunoWavRescueToStorage = async (
  uid: string,
  trackId: string,
  index: number,
  sourceUrl: string,
): Promise<string> => {
  const sourceResponse = await fetch(sourceUrl, { method: 'GET', redirect: 'follow' });
  if (!sourceResponse.ok) throw new Error(`WAV rescue source download failed (${sourceResponse.status})`);
  const bytes = Buffer.from(await sourceResponse.arrayBuffer());
  if (bytes.byteLength <= 0) throw new Error('WAV rescue source returned zero bytes');

  const bucket = admin.storage().bucket(SUNO_WAV_RESCUE_BUCKET);
  const objectPath = `suno-rescue/${uid}/${trackId}/${index}.wav`;
  const token = admin.firestore().collection('_download_tokens').doc().id;
  const file = bucket.file(objectPath);
  await file.save(bytes, {
    resumable: false,
    contentType: String(sourceResponse.headers.get('content-type') || 'audio/wav'),
    metadata: {
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
};

export const sunoWavRescueCallback = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }
    res.status(200).json({ ok: true });
  },
);

export const rescueSunoTrackAudio = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    concurrency: 10,
    maxInstances: 10,
  },
  async (req, res) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const uid = await verifyAuth(req, res);
    if (!uid) return;
    if (!(await verifyAppCheckForRequest(req, res, 'rescueSunoTrackAudio'))) return;

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const trackId = pickFirstString(body.trackId, body.data?.trackId);
    const taskId = pickFirstString(body.taskId, body.data?.taskId);
    const requestedAudioId = pickFirstString(body.audioId, body.data?.audioId);
    const rawIndex = Number(body.index ?? body.data?.index ?? 0);
    const index = Number.isFinite(rawIndex) && rawIndex >= 0 && rawIndex <= 10 ? Math.floor(rawIndex) : 0;
    const indexKey = String(index);

    if (!trackId || !taskId) {
      res.status(400).json({ ok: false, error: 'trackId and taskId are required', code: 'SUNO_RESCUE_INVALID_INPUT' });
      return;
    }

    const db = admin.firestore();
    const trackRef = db.collection('suno_tracks').doc(uid).collection('tracks').doc(trackId);
    const trackSnap = await trackRef.get();
    if (!trackSnap.exists) {
      res.status(404).json({ ok: false, error: 'Track not found', code: 'SUNO_RESCUE_TRACK_NOT_FOUND' });
      return;
    }

    const trackData = trackSnap.data() || {};
    if (pickFirstString(trackData.taskId) !== taskId) {
      res.status(400).json({ ok: false, error: 'Task ID mismatch', code: 'SUNO_RESCUE_TASK_MISMATCH' });
      return;
    }

    const item = Array.isArray(trackData.sunoData) ? (trackData.sunoData[index] || {}) : {};
    const audioId = pickFirstString(requestedAudioId, item?.id, item?.audioId, item?.audio_id);
    if (!audioId) {
      res.status(409).json({ ok: false, error: 'Audio ID is unavailable for this track', code: 'SUNO_RESCUE_AUDIO_ID_MISSING' });
      return;
    }

    const apiKeySnap = await db.collection('user_api_keys').doc(uid).get();
    const apiKey = getStoredSunoApiKeyFromDoc(apiKeySnap.data() || {});
    if (!apiKey) {
      res.status(400).json({ ok: false, error: 'Music API Key is unavailable', code: 'SUNO_RESCUE_API_KEY_MISSING' });
      return;
    }

    const existing = trackData?.audioRescue?.[indexKey] || {};
    const existingStoredUrl = pickFirstString(existing?.audioUrl);
    if (existingStoredUrl && await probeSunoAudioUrlHasBytes(existingStoredUrl)) {
      res.json({ ok: true, audioUrl: existingStoredUrl, index, audioId, source: 'stored-rescue', reused: true });
      return;
    }

    let wavTaskId = pickFirstString(existing?.wavTaskId);
    let providerResult: { audioUrl: string; payload: any } | null = null;

    if (wavTaskId) {
      providerResult = await pollSunoWavRescue(apiKey, wavTaskId);
    }

    if (!providerResult) {
      const createResponse = await fetch('https://api.sunoapi.org/api/v1/wav/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          audioId,
          callBackUrl: SUNO_WAV_RESCUE_CALLBACK_URL,
        }),
      });
      const createPayload = await createResponse.json().catch(() => null);
      const providerCode = Number(createPayload?.code || createResponse.status || 500);

      if (providerCode === 429 || providerCode === 402 || createResponse.status === 429 || createResponse.status === 402) {
        res.status(402).json({ ok: false, code: 'SUNO_RESCUE_INSUFFICIENT_CREDITS', error: 'Music API credits are insufficient for WAV rescue.' });
        return;
      }
      if (providerCode === 451) {
        res.status(410).json({ ok: false, code: 'SUNO_RESCUE_SOURCE_UNAVAILABLE', error: 'Music API source audio is no longer available.' });
        return;
      }
      if (!createResponse.ok || providerCode >= 400) {
        res.status(502).json({
          ok: false,
          code: 'SUNO_RESCUE_CREATE_FAILED',
          error: String(createPayload?.msg || `Music API WAV rescue failed (${createResponse.status})`),
        });
        return;
      }

      wavTaskId = getSunoWavRescueTaskId(createPayload);
      if (!wavTaskId) {
        res.status(502).json({ ok: false, code: 'SUNO_RESCUE_TASK_ID_MISSING', error: 'Music API did not return a WAV rescue task ID.' });
        return;
      }

      await trackRef.update({
        [`audioRescue.${indexKey}`]: {
          audioId,
          wavTaskId,
          status: 'processing',
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        lastAudioRescueAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      providerResult = await pollSunoWavRescue(apiKey, wavTaskId);
    }

    if (!providerResult?.audioUrl) {
      await trackRef.update({
        [`audioRescue.${indexKey}.status`]: 'pending',
        lastAudioRescueAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => undefined);
      res.status(202).json({ ok: false, pending: true, code: 'SUNO_RESCUE_PENDING', wavTaskId, index, audioId });
      return;
    }

    let durableUrl = '';
    try {
      durableUrl = await persistSunoWavRescueToStorage(uid, trackId, index, providerResult.audioUrl);
    } catch (storageError: any) {
      console.error('[Suno WAV Rescue] durable storage copy failed', {
        uid,
        trackId,
        index,
        message: storageError?.message || String(storageError),
      });
    }

    const finalUrl = durableUrl || providerResult.audioUrl;
    if (!(await probeSunoAudioUrlHasBytes(finalUrl))) {
      res.status(502).json({ ok: false, code: 'SUNO_RESCUE_ZERO_BYTES', error: 'Recovered audio URL did not return playable bytes.' });
      return;
    }

    await trackRef.update({
      [`audioRescue.${indexKey}`]: {
        audioId,
        wavTaskId,
        audioUrl: finalUrl,
        providerAudioUrl: providerResult.audioUrl,
        durable: Boolean(durableUrl),
        status: 'completed',
        recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      lastAudioRescueAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('[Suno WAV Rescue] success', {
      uid,
      trackId,
      index,
      durable: Boolean(durableUrl),
      host: (() => { try { return new URL(finalUrl).hostname; } catch { return 'invalid'; } })(),
    });

    res.json({
      ok: true,
      audioUrl: finalUrl,
      index,
      audioId,
      wavTaskId,
      source: durableUrl ? 'firebase-storage-wav-rescue' : 'provider-wav-rescue',
      durable: Boolean(durableUrl),
      reused: false,
    });
  },
);

`;

  source = source.replace(ANCHOR, block + ANCHOR);
  fs.writeFileSync(sourcePath, source, 'utf8');
}

const verify = fs.readFileSync(sourcePath, 'utf8');
for (const expected of [
  MARKER,
  'export const rescueSunoTrackAudio = onRequest(',
  'export const sunoWavRescueCallback = onRequest(',
  '/api/v1/wav/generate',
  '/api/v1/wav/record-info',
  'audioRescue.${indexKey}',
  'persistSunoWavRescueToStorage',
]) {
  if (!verify.includes(expected)) throw new Error(`994 verification failed: ${expected}`);
}
console.log('apply-suno-wav-rescue-994: guarded WAV rescue backend applied');
