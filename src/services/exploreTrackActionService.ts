import type { User } from 'firebase/auth';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { db, getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import { doc, getDoc } from '../lib/firestoreMeasured';

export type ExploreTrackApplySource = {
  trackId: string;
  title: string;
  style?: string | null;
  prompt?: string | null;
  tags?: Array<{ kind?: string; value?: string }>;
  shareBundle?: {
    schemaVersion?: number;
    selectedKeywords?: Record<string, unknown>;
    nextSong?: Record<string, unknown> | null;
  } | null;
  nextSong?: Record<string, unknown> | null;
};

export type ExploreTrackSaveAccess = {
  trackId: string;
  ownerUid: string;
  permissionEnabled: boolean;
  following: boolean;
  allowed: boolean;
  saveSource?: {
    sourceType: 'shared_track';
    exploreTrackId: string;
    originalSourceType?: string;
    originalSourceId?: string;
    sourceSubTrackKey?: string;
    sourceSubTrackIndex?: number | null;
    sourceSubTrackId?: string | null;
    title?: string;
    coverUrl?: string;
    sunoUrlPrimary?: string;
    sunoUrlSecondary?: string | null;
  } | null;
};


const normalizeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  const single = String(value || '').trim();
  return single ? [single] : [];
};

export const buildExploreLegacyApplyKeywords = (
  source?: Partial<ExploreTrackApplySource> | null,
): Record<string, unknown> | null => {
  if (!source) return null;
  const selected = source.shareBundle?.selectedKeywords && typeof source.shareBundle.selectedKeywords === 'object'
    ? source.shareBundle.selectedKeywords
    : {};
  const tags = Array.isArray(source.tags) ? source.tags : [];
  const byKind = (kind: string) => tags
    .filter((tag) => String(tag?.kind || '').trim() === kind)
    .map((tag) => String(tag?.value || '').trim())
    .filter(Boolean);

  const genre = normalizeStringList((selected as any).genres);
  const style = normalizeStringList((selected as any).styles);
  const mood = normalizeStringList((selected as any).moods);
  const theme = normalizeStringList((selected as any).themes);
  const sound = normalizeStringList((selected as any).sounds);

  const fallback = {
    subGenre: genre.length ? genre : byKind('genre'),
    style: style.length ? style : byKind('style'),
    mood: mood.length ? mood : byKind('mood'),
    theme: theme.length ? theme : byKind('theme'),
    instrumentSound: sound.length ? sound : byKind('sound'),
  };
  const compact = Object.fromEntries(
    Object.entries(fallback).filter(([, value]) => Array.isArray(value) && value.length > 0),
  );
  return Object.keys(compact).length ? compact : null;
};

export const getExploreOwnMusicNoteApplyKeywords = async (
  user: User,
  sourceId: string,
): Promise<Record<string, unknown> | null> => {
  const normalizedSourceId = String(sourceId || '').trim();
  if (!user?.uid || !normalizedSourceId) return null;

  const snapshot = await getDoc(doc(db, 'favorites', normalizedSourceId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, any>;
  const ownerUid = String(data?.uid || data?.ownerUid || '').trim();
  if (ownerUid && ownerUid !== user.uid) return null;

  const rawApplied = data?.appliedKeywords && typeof data.appliedKeywords === 'object' && !Array.isArray(data.appliedKeywords)
    ? data.appliedKeywords
    : data?.requestPayload?.appliedKeywords && typeof data.requestPayload.appliedKeywords === 'object'
      ? data.requestPayload.appliedKeywords
      : null;
  if (!rawApplied) return null;

  const nextSong: Record<string, unknown> = { ...rawApplied };
  const userInput = String(
    (rawApplied as any).userInput
    || data?.userInput
    || data?.commandInput
    || data?.directInput
    || data?.customPrompt
    || '',
  ).trim();
  if (userInput) nextSong.userInput = userInput;
  return Object.keys(nextSong).length ? nextSong : null;
};

const buildAuthHeaders = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) {
    throw new Error('Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
    Accept: 'application/json',
  };
};

const requestTrackAction = async <T>(user: User, trackId: string, action: 'apply-source' | 'save-access'): Promise<T> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) throw new Error('곡 정보를 확인하지 못했습니다.');
  const path = `/v1/tracks/${encodeURIComponent(normalizedTrackId)}/${action}`;
  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {
    method: 'GET',
    headers: await buildAuthHeaders(user),
  });
  recordCloudflareResponse(response, `/v1/tracks/:id/${action}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    const message = String(payload?.error?.message || payload?.message || payload?.error || '').trim();
    throw new Error(message || (action === 'apply-source'
      ? '다음곡 적용 정보를 불러오지 못했습니다.'
      : '폴더 저장 권한을 확인하지 못했습니다.'));
  }
  return payload?.data as T;
};

export const getExploreTrackApplySource = (user: User, trackId: string) =>
  requestTrackAction<ExploreTrackApplySource>(user, trackId, 'apply-source');

export const getExploreTrackSaveAccess = (user: User, trackId: string) =>
  requestTrackAction<ExploreTrackSaveAccess>(user, trackId, 'save-access');

const dislikeStorageKey = (uid: string) => `soridraw:explore:disliked:v1:${encodeURIComponent(String(uid || '').trim())}`;

export const readExploreDislikedTrackIds = (uid: string): Set<string> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid || typeof window === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dislikeStorageKey(normalizedUid)) || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 2000));
  } catch {
    return new Set();
  }
};

export const markExploreTrackDisliked = (uid: string, trackId: string) => {
  const normalizedUid = String(uid || '').trim();
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedUid || !normalizedTrackId || typeof window === 'undefined') return;
  const next = readExploreDislikedTrackIds(normalizedUid);
  next.add(normalizedTrackId);
  try {
    window.localStorage.setItem(dislikeStorageKey(normalizedUid), JSON.stringify([...next].slice(-2000)));
  } catch {}
};
