import { auth, getFirebaseAppCheckToken } from '../firebase';
// SORIDRAW_R2_LAZY_MP3_PREVIEW_1000

const R2_MEDIA_ENDPOINT = 'https://soridraw-media-preview.andrawing1212.workers.dev';
const ARCHIVE_MIN_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type SunoR2ArchiveResult = {
  audioUrl: string;
  trackId: string;
  taskId: string;
  index: number;
  sunoData: null;
  raw: any;
};

const archiveInFlight = new Map<string, Promise<SunoR2ArchiveResult | null>>();

const toText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
};

const timestampToMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') {
    const ms = Number(value.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value?._seconds === 'number') return value._seconds * 1000;
  return 0;
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
  const createdAtMs = timestampToMs(parent.createdAt) || timestampToMs(track?.createdAt);
  const sourceType = firstText(track?.sourceType, parent?.sourceType).toLowerCase();
  const ownerUid = firstText(track?.ownerUid, parent?.ownerUid, parent?.uid);
  return { trackId, taskId, index, createdAtMs, sourceType, ownerUid };
};

export const isSunoR2ArchiveEligible = (track: any) => {
  const user = auth.currentUser;
  if (!user) return false;
  const context = getTrackContext(track);
  if (!context.trackId || !context.createdAtMs) return false;
  if (context.ownerUid && context.ownerUid !== user.uid) return false;
  if (context.sourceType === 'shared_track') return false;
  return Date.now() - context.createdAtMs >= ARCHIVE_MIN_AGE_MS;
};

const dispatchArchivedAudio = (result: SunoR2ArchiveResult) => {
  try {
    window.dispatchEvent(new CustomEvent('soridraw:suno-audio-url-recovered', {
      detail: result,
    }));
  } catch {
    // Local UI/cache synchronization is best-effort.
  }
};

export const archiveOldSunoMp3ToR2 = async (track: any): Promise<SunoR2ArchiveResult | null> => {
  const user = auth.currentUser;
  if (!user || !isSunoR2ArchiveEligible(track)) return null;

  const context = getTrackContext(track);
  const key = `${user.uid}:${context.trackId}:${context.index}`;
  const existing = archiveInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const [idToken, appCheckToken] = await Promise.all([
        user.getIdToken(),
        getFirebaseAppCheckToken(),
      ]);
      if (!appCheckToken) return null;

      const response = await fetch(`${R2_MEDIA_ENDPOINT}/v1/archive/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Firebase-AppCheck': appCheckToken,
        },
        body: JSON.stringify({ trackId: context.trackId, index: context.index }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.ok) return null;

      const audioUrl = firstText(payload.playbackUrl, payload.audioUrl);
      if (!audioUrl) return null;

      const result: SunoR2ArchiveResult = {
        audioUrl,
        trackId: context.trackId,
        taskId: context.taskId,
        index: context.index,
        sunoData: null,
        raw: { ...payload, recoverySource: 'r2-lazy-mp3' },
      };
      dispatchArchivedAudio(result);
      return result;
    } catch (error) {
      console.warn('SORIDRAW lazy R2 MP3 archive failed:', error);
      return null;
    } finally {
      archiveInFlight.delete(key);
    }
  })();

  archiveInFlight.set(key, promise);
  return promise;
};
