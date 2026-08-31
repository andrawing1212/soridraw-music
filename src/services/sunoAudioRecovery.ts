import { auth } from '../firebase';

const SUNO_STATUS_ENDPOINT = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus';
const RECOVERY_CACHE_PREFIX = 'soridraw.suno.audioRecovery.v2';
const RECOVERY_NEGATIVE_CACHE_MS = 5 * 60 * 1000;
// SORIDRAW_LIBRARY_AGED_AUDIO_RECOVERY_990
const RECOVERY_CACHE_MAX_ENTRIES = 200;

type RecoveryResult = {
  audioUrl: string;
  trackId: string;
  taskId: string;
  index: number;
  sunoData: any[] | null;
  raw: any;
  recoveredAt: number;
};

type DownloadRecoveryResult = {
  ok: boolean;
  recovered: boolean;
  directFallback: boolean;
  audioUrl: string;
};

type RecoveryCacheEntry = {
  audioUrl?: string;
  updatedAt: number;
  failedUntil?: number;
  failedUrl?: string;
};

type RecoveryCacheMap = Record<string, RecoveryCacheEntry>;

const recoveryInFlight = new Map<string, Promise<RecoveryResult | null>>();

const toText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
};

const getRecoveryStorageKey = (uid: string) => `${RECOVERY_CACHE_PREFIX}:${uid}`;

const readRecoveryCacheMap = (uid: string): RecoveryCacheMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getRecoveryStorageKey(uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeRecoveryCacheMap = (uid: string, cache: RecoveryCacheMap) => {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(cache)
      .filter(([, value]) => value && typeof value === 'object')
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, RECOVERY_CACHE_MAX_ENTRIES);
    window.localStorage.setItem(getRecoveryStorageKey(uid), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Recovery cache is best-effort only.
  }
};

const readRecoveryCacheEntry = (uid: string, cacheKey: string): RecoveryCacheEntry | null => {
  const entry = readRecoveryCacheMap(uid)[cacheKey];
  return entry && typeof entry === 'object' ? entry : null;
};

const writeRecoverySuccess = (uid: string, cacheKey: string, audioUrl: string) => {
  const cache = readRecoveryCacheMap(uid);
  cache[cacheKey] = {
    audioUrl,
    updatedAt: Date.now(),
  };
  writeRecoveryCacheMap(uid, cache);
};

const writeRecoveryFailure = (uid: string, cacheKey: string, failedUrl: string) => {
  const cache = readRecoveryCacheMap(uid);
  cache[cacheKey] = {
    updatedAt: Date.now(),
    failedUntil: Date.now() + RECOVERY_NEGATIVE_CACHE_MS,
    failedUrl,
  };
  writeRecoveryCacheMap(uid, cache);
};

const touchRecoverySuccess = (uid: string, cacheKey: string, entry: RecoveryCacheEntry) => {
  if (!entry.audioUrl) return;
  const cache = readRecoveryCacheMap(uid);
  cache[cacheKey] = {
    audioUrl: entry.audioUrl,
    updatedAt: Date.now(),
  };
  writeRecoveryCacheMap(uid, cache);
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

  const normalizedFailed = toText(failedUrl);
  const alternative = ordered.find((url) => !normalizedFailed || url !== normalizedFailed);
  if (alternative) return alternative;
  // The Function only exposes audioUrls after a byte probe succeeds. If the
  // provider refreshed the resource behind the same URL, one retry is safe.
  if (normalizedFailed && verified.includes(normalizedFailed)) return normalizedFailed;
  return normalizedFailed ? '' : (ordered[0] || '');
};

const dispatchRecoveredAudioUrl = (result: RecoveryResult) => {
  try {
    window.dispatchEvent(new CustomEvent('soridraw:suno-audio-url-recovered', {
      detail: result,
    }));
  } catch {
    // UI/session sync is best-effort. Recovery persistence is local-first.
  }
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
  parent.lastAudioUrlRecoveredAt = result.recoveredAt || Date.now();

  return {
    ...track,
    url,
    audioUrl: url,
    streamAudioUrl: url,
    parent,
  };
};

export const recoverSunoAudioUrl = async (track: any, options?: { failedUrl?: string }): Promise<RecoveryResult | null> => {
  const user = auth.currentUser;
  const context = getTrackContext(track);
  if (!user || !context.trackId || !context.taskId) return null;

  const cacheKey = `${context.trackId}:${context.taskId}:${context.index}`;
  const inFlightKey = `${user.uid}:${cacheKey}`;
  const hasExplicitFailedUrl = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'failedUrl'));
  const failedUrl = hasExplicitFailedUrl ? toText(options?.failedUrl) : '';
  const cached = readRecoveryCacheEntry(user.uid, cacheKey);

  if (cached?.audioUrl && (!hasExplicitFailedUrl || cached.audioUrl !== failedUrl)) {
    const result: RecoveryResult = {
      audioUrl: cached.audioUrl,
      trackId: context.trackId,
      taskId: context.taskId,
      index: context.index,
      sunoData: null,
      raw: { cacheHit: true },
      recoveredAt: Number(cached.updatedAt || Date.now()),
    };
    touchRecoverySuccess(user.uid, cacheKey, cached);
    dispatchRecoveredAudioUrl(result);
    return result;
  }

  if (cached?.failedUntil && cached.failedUntil > Date.now()) {
    return null;
  }

  const existing = recoveryInFlight.get(inFlightKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(SUNO_STATUS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          trackId: context.trackId,
          taskId: context.taskId,
          recoveryOnly: true,
        }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload) {
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const audioUrl = chooseRecoveredUrl(payload, track, failedUrl);
      if (!audioUrl) {
        writeRecoveryFailure(user.uid, cacheKey, failedUrl);
        return null;
      }

      const result: RecoveryResult = {
        audioUrl,
        trackId: context.trackId,
        taskId: context.taskId,
        index: context.index,
        sunoData: getResponseSunoData(payload),
        raw: payload,
        recoveredAt: Date.now(),
      };

      writeRecoverySuccess(user.uid, cacheKey, audioUrl);
      dispatchRecoveredAudioUrl(result);
      return result;
    } catch (error) {
      console.warn('Suno audio URL recovery failed:', error);
      writeRecoveryFailure(user.uid, cacheKey, failedUrl);
      return null;
    } finally {
      recoveryInFlight.delete(inFlightKey);
    }
  })();

  recoveryInFlight.set(inFlightKey, promise);
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
