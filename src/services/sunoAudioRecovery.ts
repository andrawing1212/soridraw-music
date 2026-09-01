import { auth, getFirebaseAppCheckToken } from '../firebase';

const SUNO_STATUS_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus';
const SUNO_WAV_RESCUE_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/rescueSunoTrackAudio';

type RecoveryResult = {
  audioUrl: string;
  trackId: string;
  taskId: string;
  index: number;
  sunoData: any[] | null;
  raw: any;
};

type DownloadRecoveryResult = {
  ok: boolean;
  recovered: boolean;
  directFallback: boolean;
  audioUrl: string;
};

type WavRescueRequestResult = {
  result: RecoveryResult | null;
  status: number;
  code: string;
  pending: boolean;
};

const recoveryInFlight = new Map<string, Promise<RecoveryResult | null>>();
const wavRescueInFlight = new Map<string, Promise<WavRescueRequestResult>>();

const toText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
};

const getAudioCandidates = (source: any): string[] => {
  if (!source || typeof source !== 'object') return [];
  return Array.from(new Set([
    source.sourceAudioUrl,
    source.source_audio_url,
    source.sourceStreamAudioUrl,
    source.source_stream_audio_url,
    source.audioUrl,
    source.audio_url,
    source.streamAudioUrl,
    source.stream_audio_url,
    source.url,
    source.downloadUrl,
    source.download_url,
    source.playUrl,
    source.play_url,
    source.mediaUrl,
    source.media_url,
    source.mp3Url,
    source.mp3_url,
  ].map(toText).filter(Boolean)));
};

const getResponseSunoData = (payload: any): any[] => {
  const candidates = [
    payload?.sunoData,
    payload?.data?.sunoData,
    payload?.response?.sunoData,
    payload?.data?.response?.sunoData,
    payload?.result?.sunoData,
    payload?.data?.result?.sunoData,
    payload?.tracks,
    payload?.data?.tracks,
  ];
  return candidates.find((value) => Array.isArray(value) && value.length > 0) || [];
};

const getTrackContext = (track: any) => {
  const parent = track?.parent || {};
  const trackId = firstText(
    parent.id,
    parent.trackId,
    parent.sourceId,
    track?.parentTrackId,
    track?.sourceId,
    track?.trackId,
    track?.id,
  );
  const taskId = firstText(parent.taskId, track?.taskId, parent.requestPayload?.taskId, track?.requestPayload?.taskId);
  const rawIndex = track?.index ?? track?.subTrackIndex ?? track?.sourceSubTrackIndex ?? parent?.subTrackIndex ?? parent?.sourceSubTrackIndex;
  const parsedIndex = Number(rawIndex);
  const index = Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0;
  const currentUrl = firstText(track?.url, track?.audioUrl, track?.streamAudioUrl, ...getAudioCandidates(parent));
  const currentSubItem = Array.isArray(parent?.sunoData) ? parent.sunoData[index] : null;
  const subTrackId = firstText(
    track?.subTrackId,
    track?.sourceSubTrackId,
    track?.audioId,
    currentSubItem?.id,
    currentSubItem?.audioId,
  );
  return { parent, trackId, taskId, index, currentUrl, subTrackId };
};

const chooseRecoveredUrl = (payload: any, track: any, failedUrl = '') => {
  const { index, subTrackId } = getTrackContext(track);
  const sunoData = getResponseSunoData(payload);
  const verified = Array.isArray(payload?.audioUrls)
    ? payload.audioUrls.map(toText).filter(Boolean)
    : [];
  const validationStatus = firstText(payload?.audioValidationStatus, payload?.data?.audioValidationStatus).toLowerCase();

  // SORIDRAW_SUNO_VERIFIED_MP3_ONLY_999
  // getSunoTrackStatus byte-probes provider URLs. If that explicit validation says
  // pending/empty/missing, never retry the raw sunoData URL again: those raw URLs are
  // the expired 403/404/zero-byte sources that caused the old-track recovery loop.
  if (validationStatus && validationStatus !== 'verified') return '';

  let matchedItem: any = null;
  if (subTrackId) {
    matchedItem = sunoData.find((item: any) => firstText(item?.id, item?.audioId) === subTrackId) || null;
  }
  if (!matchedItem && sunoData[index]) matchedItem = sunoData[index];

  const ordered: string[] = [];
  const push = (value: unknown) => {
    const text = toText(value);
    if (text && !ordered.includes(text)) ordered.push(text);
  };

  if (validationStatus === 'verified') {
    if (verified.length > 0 && sunoData.length > 0 && verified.length === sunoData.length) {
      push(verified[index]);
    }
    getAudioCandidates(matchedItem).forEach((candidate) => {
      if (verified.includes(candidate)) push(candidate);
    });
    if (index === 0) {
      push(payload?.audioUrl);
      push(payload?.streamAudioUrl);
    }
    verified.forEach(push);
  } else {
    // Compatibility with an older Function response that predates audioValidationStatus.
    if (verified.length > 0 && sunoData.length > 0 && verified.length === sunoData.length) {
      push(verified[index]);
    }
    getAudioCandidates(matchedItem).forEach(push);
    if (index === 0) {
      push(payload?.audioUrl);
      push(payload?.streamAudioUrl);
    }
    verified.forEach(push);
    sunoData.forEach((item: any) => getAudioCandidates(item).forEach(push));
  }

  const normalizedFailed = toText(failedUrl);
  return ordered.find((url) => url !== normalizedFailed) || ordered[0] || '';
};

const dispatchRecoveredAudio = (result: RecoveryResult) => {
  try {
    window.dispatchEvent(new CustomEvent('soridraw:suno-audio-url-recovered', {
      detail: result,
    }));
  } catch {
    // UI event sync is best-effort.
  }
};

const getRecoveryHeaders = async (user: NonNullable<typeof auth.currentUser>) => {
  const token = await user.getIdToken();
  const appCheckToken = await getFirebaseAppCheckToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
  return headers;
};

export const applyRecoveredSunoAudioUrl = (track: any, result: RecoveryResult | null) => {
  if (!track || !result?.audioUrl) return track;
  const url = result.audioUrl;
  const parent = { ...(track.parent || {}) };
  const index = result.index;

  if (Array.isArray(parent.sunoData) && parent.sunoData.length > 0) {
    parent.sunoData = parent.sunoData.map((entry: any, entryIndex: number) => entryIndex === index
      ? { ...entry, audioUrl: url, streamAudioUrl: url, url }
      : entry);
  }

  if (index === 0 || !Array.isArray(parent.sunoData) || parent.sunoData.length <= 1) {
    parent.audioUrl = url;
    parent.streamAudioUrl = url;
  }
  parent.audioValidationStatus = 'verified';

  return {
    ...track,
    url,
    audioUrl: url,
    streamAudioUrl: url,
    parent,
  };
};

const requestSunoWavRescue = async (track: any, reuseOnly: boolean): Promise<WavRescueRequestResult> => {
  const user = auth.currentUser;
  const context = getTrackContext(track);
  if (!user || !context.trackId || !context.taskId) {
    return { result: null, status: 0, code: 'SUNO_RESCUE_CONTEXT_MISSING', pending: false };
  }

  const key = `${user.uid}:${context.trackId}:${context.taskId}:${context.index}:${reuseOnly ? 'reuse' : 'create'}`;
  const existing = wavRescueInFlight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<WavRescueRequestResult> => {
    try {
      const headers = await getRecoveryHeaders(user);
      const body: Record<string, unknown> = {
        trackId: context.trackId,
        taskId: context.taskId,
        index: context.index,
      };
      if (context.subTrackId) body.audioId = context.subTrackId;
      if (reuseOnly) body.reuseOnly = true;

      const response = await fetch(SUNO_WAV_RESCUE_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const code = firstText(payload?.code, payload?.data?.code);
      const pending = response.status === 202 || payload?.pending === true;
      if (!response.ok || !payload?.ok) {
        return { result: null, status: response.status, code, pending };
      }

      const audioUrl = firstText(payload?.audioUrl, payload?.data?.audioUrl);
      if (!audioUrl) return { result: null, status: response.status, code, pending };

      const result: RecoveryResult = {
        audioUrl,
        trackId: context.trackId,
        taskId: context.taskId,
        index: context.index,
        sunoData: null,
        raw: payload,
      };
      dispatchRecoveredAudio(result);
      return { result, status: response.status, code, pending: false };
    } catch (error) {
      console.warn('Suno WAV rescue request failed:', error);
      return { result: null, status: 0, code: 'SUNO_RESCUE_REQUEST_FAILED', pending: false };
    } finally {
      wavRescueInFlight.delete(key);
    }
  })();

  wavRescueInFlight.set(key, promise);
  return promise;
};

export const recoverExistingSunoWav = async (track: any): Promise<RecoveryResult | null> => {
  const reuse = await requestSunoWavRescue(track, true);
  return reuse.result;
};

const recoverSunoWavAfterExpiredMp3 = async (track: any): Promise<RecoveryResult | null> => {
  // Final recovery order:
  // 1) reuse a durable/already-requested WAV with zero new credit;
  // 2) only when the backend proves there was never a rescue request, start one WAV rescue;
  // 3) backend 995 blocks a second paid task forever while an earlier task exists.
  const reuse = await requestSunoWavRescue(track, true);
  if (reuse.result) return reuse.result;
  if (reuse.pending) return null;

  if (reuse.status !== 404 || reuse.code !== 'SUNO_RESCUE_NOT_PREVIOUSLY_RECOVERED') {
    return null;
  }

  const created = await requestSunoWavRescue(track, false);
  return created.result;
};

export const recoverSunoAudioUrl = async (track: any, options?: { failedUrl?: string }): Promise<RecoveryResult | null> => {
  const user = auth.currentUser;
  const context = getTrackContext(track);
  if (!user || !context.trackId || !context.taskId) return null;

  const key = `${user.uid}:${context.trackId}:${context.taskId}:${context.index}`;
  const existing = recoveryInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const headers = await getRecoveryHeaders(user);
      const response = await fetch(SUNO_STATUS_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ trackId: context.trackId, taskId: context.taskId }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload) return null;

      const audioUrl = chooseRecoveredUrl(payload, track, options?.failedUrl || context.currentUrl);
      if (!audioUrl) {
        return await recoverSunoWavAfterExpiredMp3(track);
      }

      const result: RecoveryResult = {
        audioUrl,
        trackId: context.trackId,
        taskId: context.taskId,
        index: context.index,
        sunoData: getResponseSunoData(payload),
        raw: payload,
      };

      dispatchRecoveredAudio(result);
      return result;
    } catch (error) {
      console.warn('Suno audio URL recovery failed:', error);
      return null;
    } finally {
      recoveryInFlight.delete(key);
    }
  })();

  recoveryInFlight.set(key, promise);
  return promise;
};

const sanitizeDownloadName = (value: string) => String(value || 'SORIDRAW')
  .replace(/[\\/:*?"<>|]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80) || 'SORIDRAW';

const getExtension = (url: string) => {
  const match = String(url || '').split('?')[0].match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i);
  return match?.[1]?.toLowerCase() || 'mp3';
};

const tryBlobDownload = async (url: string, title?: string) => {
  if (!url) return false;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return false;
    const blob = await response.blob();
    if (!blob || blob.size <= 0) return false;

    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `${sanitizeDownloadName(title || 'SORIDRAW')}.${getExtension(url)}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch {
    return false;
  }
};

const triggerDirectDownloadFallback = (url: string, title?: string) => {
  if (!url) return false;
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeDownloadName(title || 'SORIDRAW')}.${getExtension(url)}`;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  }
};

export const downloadSunoAudioWithRecovery = async (track: any, title?: string): Promise<DownloadRecoveryResult> => {
  const context = getTrackContext(track);
  const initialUrl = context.currentUrl;

  if (initialUrl && await tryBlobDownload(initialUrl, title)) {
    return { ok: true, recovered: false, directFallback: false, audioUrl: initialUrl };
  }

  const recovered = await recoverSunoAudioUrl(track, { failedUrl: initialUrl });
  if (recovered?.audioUrl) {
    if (await tryBlobDownload(recovered.audioUrl, title)) {
      return { ok: true, recovered: true, directFallback: false, audioUrl: recovered.audioUrl };
    }
    if (triggerDirectDownloadFallback(recovered.audioUrl, title)) {
      return { ok: true, recovered: true, directFallback: true, audioUrl: recovered.audioUrl };
    }
  }

  // If no Task ID exists but the original URL is still directly accessible, allow the browser to open it.
  if (!context.taskId && initialUrl && triggerDirectDownloadFallback(initialUrl, title)) {
    return { ok: true, recovered: false, directFallback: true, audioUrl: initialUrl };
  }

  return { ok: false, recovered: false, directFallback: false, audioUrl: recovered?.audioUrl || initialUrl };
};