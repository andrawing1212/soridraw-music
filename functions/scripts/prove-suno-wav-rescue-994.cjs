const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'soridraw-app-866a5',
  storageBucket: 'soridraw-app-866a5.firebasestorage.app',
});

const db = admin.firestore();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DAY = 24 * 60 * 60 * 1000;
const CALLBACK_URL = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/sunoWavRescueCallback';

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCredits = (payload) => {
  const candidates = [
    payload?.data,
    payload?.credits,
    payload?.remainingCredits,
    payload?.remaining_credits,
    payload?.balance,
    payload?.data?.credits,
    payload?.data?.remainingCredits,
    payload?.data?.remaining_credits,
    payload?.data?.balance,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return null;
};

const readCredits = async (apiKey) => {
  try {
    const response = await fetch('https://api.sunoapi.org/api/v1/generate/credit', {
      headers: { Authorization: 'Bearer ' + apiKey },
    });
    return parseCredits(await response.json().catch(() => null));
  } catch {
    return null;
  }
};

const probeBytes = async (url) => {
  if (!url) return { ok: false, bytes: 0, status: 0, contentType: '' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-65535', Accept: 'audio/*,*/*;q=0.8' },
      signal: controller.signal,
      redirect: 'follow',
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      ok: (response.ok || response.status === 206) && buffer.length > 0,
      bytes: buffer.length,
      status: response.status,
      contentType: String(response.headers.get('content-type') || ''),
    };
  } catch {
    return { ok: false, bytes: 0, status: 0, contentType: '' };
  } finally {
    clearTimeout(timer);
  }
};

const readWavUrl = (payload) => firstText(
  payload?.data?.response?.audioWavUrl,
  payload?.data?.response?.audio_wav_url,
  payload?.data?.audioWavUrl,
  payload?.data?.audio_wav_url,
  payload?.response?.audioWavUrl,
  payload?.response?.audio_wav_url,
  payload?.audioWavUrl,
  payload?.audio_wav_url,
);

const readTaskId = (payload) => firstText(
  payload?.data?.taskId,
  payload?.data?.task_id,
  payload?.taskId,
  payload?.task_id,
);

const safeHost = (url) => {
  try { return new URL(url).hostname; } catch { return ''; }
};

const logResult = (data) => console.log('[994 proof] RESULT ' + JSON.stringify(data));

(async () => {
  const masterSnap = await db.collection('users').where('staffRole', '==', 'master').limit(1).get();
  if (masterSnap.empty) throw new Error('Master user not found');
  const uid = masterSnap.docs[0].id;

  const tracksSnap = await db.collection('suno_tracks').doc(uid).collection('tracks')
    .orderBy('createdAt', 'desc').limit(20).get();
  const now = Date.now();
  const candidates = tracksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const target = candidates.find((track) => {
    const age = now - toMillis(track.createdAt);
    const first = Array.isArray(track.sunoData) ? track.sunoData[0] : null;
    return age > 30 * DAY && firstText(track.taskId) && firstText(first?.id, first?.audioId, first?.audio_id);
  });

  if (!target) {
    logResult({ result: 'NO_ELIGIBLE_AGED_TRACK', scanned: candidates.length });
    return;
  }

  const trackId = target.id;
  const taskId = firstText(target.taskId);
  const first = Array.isArray(target.sunoData) ? target.sunoData[0] : {};
  const audioId = firstText(first?.id, first?.audioId, first?.audio_id);
  const title = firstText(first?.title, target.title) || 'Untitled';
  const ageDays = Math.floor((now - toMillis(target.createdAt)) / DAY);
  const trackRef = db.collection('suno_tracks').doc(uid).collection('tracks').doc(trackId);

  const existing = target?.audioRescue?.['0'] || {};
  const existingUrl = firstText(existing.audioUrl);
  if (existingUrl) {
    const existingProbe = await probeBytes(existingUrl);
    if (existingProbe.ok) {
      logResult({
        result: 'SUCCESS_EXISTING_RESCUE',
        title,
        ageDays,
        durable: Boolean(existing.durable),
        probeBytes: existingProbe.bytes,
        host: safeHost(existingUrl),
        creditDelta: 0,
      });
      return;
    }
  }

  const keySnap = await db.collection('user_api_keys').doc(uid).get();
  const keyData = keySnap.data() || {};
  const apiKey = firstText(keyData.sunoApiKey, keyData.musicApiKey, keyData.suno_api_key, keyData.music_api_key);
  if (!apiKey) {
    logResult({ result: 'API_KEY_MISSING', title, ageDays });
    return;
  }

  const creditsBefore = await readCredits(apiKey);
  const createResponse = await fetch('https://api.sunoapi.org/api/v1/wav/generate', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, audioId, callBackUrl: CALLBACK_URL }),
  });
  const createPayload = await createResponse.json().catch(() => null);
  const providerCode = Number(createPayload?.code || createResponse.status || 500);
  const providerMessage = String(createPayload?.msg || createPayload?.message || '').slice(0, 220);

  if (!createResponse.ok || providerCode >= 400) {
    const creditsAfter = await readCredits(apiKey);
    logResult({
      result: providerCode === 451 ? 'SOURCE_UNAVAILABLE' : 'PROVIDER_CREATE_FAILED',
      title,
      ageDays,
      http: createResponse.status,
      providerCode,
      providerMessage,
      creditsBefore,
      creditsAfter,
      creditDelta: creditsBefore != null && creditsAfter != null ? creditsBefore - creditsAfter : null,
    });
    return;
  }

  const wavTaskId = readTaskId(createPayload);
  if (!wavTaskId) {
    const creditsAfter = await readCredits(apiKey);
    logResult({
      result: 'WAV_TASK_ID_MISSING', title, ageDays, providerCode, providerMessage,
      creditsBefore, creditsAfter,
      creditDelta: creditsBefore != null && creditsAfter != null ? creditsBefore - creditsAfter : null,
    });
    return;
  }

  await trackRef.set({
    audioRescue: {
      0: {
        audioId,
        wavTaskId,
        status: 'processing',
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    lastAudioRescueAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  let providerAudioUrl = '';
  let providerProbe = { ok: false, bytes: 0, status: 0, contentType: '' };
  let finalProviderState = '';

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    if (attempt > 1) await sleep(5000);
    const response = await fetch('https://api.sunoapi.org/api/v1/wav/record-info?taskId=' + encodeURIComponent(wavTaskId), {
      headers: { Authorization: 'Bearer ' + apiKey },
    });
    const payload = await response.json().catch(() => null);
    finalProviderState = String(payload?.data?.successFlag || payload?.data?.status || payload?.status || '').toUpperCase();
    const candidate = readWavUrl(payload);
    if (candidate) {
      const probe = await probeBytes(candidate);
      if (probe.ok) {
        providerAudioUrl = candidate;
        providerProbe = probe;
        break;
      }
    }
    if (finalProviderState.includes('FAILED') || finalProviderState.includes('ERROR')) break;
  }

  const creditsAfter = await readCredits(apiKey);
  const creditDelta = creditsBefore != null && creditsAfter != null ? creditsBefore - creditsAfter : null;

  if (!providerAudioUrl) {
    await trackRef.set({
      audioRescue: { 0: { audioId, wavTaskId, status: 'failed_or_unavailable' } },
      lastAudioRescueAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    logResult({
      result: 'NO_PLAYABLE_WAV_BYTES', title, ageDays, finalProviderState,
      creditsBefore, creditsAfter, creditDelta,
    });
    return;
  }

  const fullResponse = await fetch(providerAudioUrl, { redirect: 'follow' });
  if (!fullResponse.ok) {
    logResult({ result: 'PROVIDER_WAV_COPY_FAILED', title, ageDays, http: fullResponse.status, creditsBefore, creditsAfter, creditDelta });
    return;
  }
  const bytes = Buffer.from(await fullResponse.arrayBuffer());
  if (!bytes.length) {
    logResult({ result: 'PROVIDER_WAV_ZERO_BYTES_ON_COPY', title, ageDays, creditsBefore, creditsAfter, creditDelta });
    return;
  }

  let durableUrl = '';
  let durableProbe = { ok: false, bytes: 0, status: 0, contentType: '' };
  try {
    const bucket = admin.storage().bucket('soridraw-app-866a5.firebasestorage.app');
    const objectPath = 'suno-rescue/' + uid + '/' + trackId + '/0.wav';
    const token = db.collection('_download_tokens').doc().id;
    await bucket.file(objectPath).save(bytes, {
      resumable: false,
      contentType: String(fullResponse.headers.get('content-type') || 'audio/wav'),
      metadata: {
        cacheControl: 'public,max-age=31536000,immutable',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    durableUrl = 'https://firebasestorage.googleapis.com/v0/b/' + encodeURIComponent(bucket.name)
      + '/o/' + encodeURIComponent(objectPath) + '?alt=media&token=' + encodeURIComponent(token);
    durableProbe = await probeBytes(durableUrl);
  } catch (error) {
    console.warn('[994 proof] durable copy unavailable:', error?.message || String(error));
  }

  const finalUrl = durableProbe.ok ? durableUrl : providerAudioUrl;
  await trackRef.set({
    audioRescue: {
      0: {
        audioId,
        wavTaskId,
        audioUrl: finalUrl,
        providerAudioUrl,
        durable: durableProbe.ok,
        status: 'completed',
        recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    lastAudioRescueAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  logResult({
    result: 'SUCCESS',
    title,
    ageDays,
    providerHost: safeHost(providerAudioUrl),
    providerProbeBytes: providerProbe.bytes,
    fullBytes: bytes.length,
    durable: durableProbe.ok,
    durableHost: durableProbe.ok ? safeHost(durableUrl) : '',
    durableProbeBytes: durableProbe.bytes,
    creditsBefore,
    creditsAfter,
    creditDelta,
  });
})().catch((error) => {
  console.error('[994 proof] FATAL ' + (error?.message || String(error)));
  process.exit(1);
});
