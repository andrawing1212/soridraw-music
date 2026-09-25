import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, serverTimestamp, setDoc } from '../lib/firestoreMeasured';
import { readUserProfileCache } from '../lib/userProfileCache';
import { runV1MutationBoundary } from '../data/v1MutationBoundary';

export type ExploreSharedNoteFolder = {
  id: string;
  title: string;
};

export type ExploreSharedNoteTrack = {
  id: string;
  ownerUid: string;
  ownerHandle?: string | null;
  displayName: string;
  title: string;
  coverUrl?: string | null;
  sunoUrlPrimary?: string | null;
  openUrl?: string | null;
  sourceId?: string | null;
  durationSeconds?: number | null;
  style?: string | null;
  prompt?: string | null;
  lyrics?: string | null;
  publishedAt?: number | null;
  shareBundle?: {
    selectedKeywords?: Record<string, unknown>;
    nextSong?: Record<string, unknown> | null;
  } | null;
};

const DEFAULT_SHARED_NOTE_FOLDERS: ExploreSharedNoteFolder[] = [
  { id: 'default', title: '기본' },
  { id: '1', title: '1' },
  { id: '2', title: '2' },
];

const MUSIC_NOTE_STRUCTURE_CACHE_STORAGE_BASE = 'soridraw_music_note_structure_cache_v1';

const normalizeFolders = (value: unknown): ExploreSharedNoteFolder[] => {
  const raw = Array.isArray(value) ? value : [];
  const source = raw.length ? raw : DEFAULT_SHARED_NOTE_FOLDERS;
  const seen = new Set<string>();
  const result: ExploreSharedNoteFolder[] = [];

  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id || row.folderId || '').trim();
    const title = String(row.title || row.name || '').trim();
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, title });
  }

  if (!seen.has('default')) result.unshift({ id: 'default', title: '기본' });
  return result.slice(0, 10);
};

const readCachedStructure = (uid: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${MUSIC_NOTE_STRUCTURE_CACHE_STORAGE_BASE}_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Number(parsed.schemaVersion || 0) !== 1) return null;
    return parsed as { version?: number; verified?: boolean; data?: Record<string, any> };
  } catch {
    return null;
  }
};

const writeCachedStructure = (uid: string, data: Record<string, any>, version: number) => {
  if (typeof window === 'undefined') return;
  try {
    const previous = readCachedStructure(uid);
    window.localStorage.setItem(`${MUSIC_NOTE_STRUCTURE_CACHE_STORAGE_BASE}_${uid}`, JSON.stringify({
      schemaVersion: 1,
      version: Math.max(Number(previous?.version || 0), Number(version || 0)),
      verified: true,
      updatedAtMs: Date.now(),
      data: {
        ...(previous?.data || {}),
        ...data,
        ...(data.musicNoteFolders ? {
          musicNoteFolders: {
            ...(previous?.data?.musicNoteFolders || {}),
            ...data.musicNoteFolders,
          },
        } : {}),
      },
    }));
  } catch {}
};

const extractSharedFolders = (data: Record<string, any> | null | undefined) =>
  normalizeFolders(data?.musicNoteFolders?.sharedNote ?? data?.sharedNoteFolders);

export const getExploreSharedNoteFolders = async (user: User): Promise<ExploreSharedNoteFolder[]> => {
  const uid = String(user?.uid || '').trim();
  if (!uid) return DEFAULT_SHARED_NOTE_FOLDERS;

  const cached = readCachedStructure(uid);
  const cachedFolders = extractSharedFolders(cached?.data);
  const remoteVersion = Number((readUserProfileCache(uid) as any)?.syncVersions?.musicNoteStructure || 0);
  const cachedVersion = Number(cached?.version || 0);

  if (cached?.verified === true && cachedFolders.length && (remoteVersion <= 0 || cachedVersion >= remoteVersion)) {
    return cachedFolders;
  }

  const snapshot = await getDoc(doc(db, 'user_structures', uid));
  const data = snapshot.exists() ? snapshot.data() as Record<string, any> : {};
  const documentVersion = Number(data?.musicNoteStructureVersion || 0);
  const resolvedVersion = Math.max(remoteVersion, documentVersion, cachedVersion);
  writeCachedStructure(uid, {
    ...(data?.musicNoteFolders ? { musicNoteFolders: data.musicNoteFolders } : {}),
    ...(data?.sharedNoteFolders ? { sharedNoteFolders: data.sharedNoteFolders } : {}),
    ...(documentVersion ? { musicNoteStructureVersion: documentVersion } : {}),
  }, resolvedVersion);
  return extractSharedFolders(data);
};

const cleanUndefinedValues = (value: any): any => {
  if (Array.isArray(value)) return value.map(cleanUndefinedValues);
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, cleanUndefinedValues(entry)])
    );
  }
  return value;
};

const firstText = (value: unknown) => {
  if (Array.isArray(value)) {
    const found = value.map((item) => String(item || '').trim()).find(Boolean);
    return found || '';
  }
  return String(value || '').trim();
};

const buildSharedNoteDocumentId = (uid: string, trackId: string) => {
  const safeUid = uid.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  const safeTrack = trackId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 180);
  return `explore_shared_${safeUid}_${safeTrack}`;
};

export const saveExploreTrackToSharedNote = async (
  user: User,
  track: ExploreSharedNoteTrack,
  folder: ExploreSharedNoteFolder,
): Promise<string> => {
  const uid = String(user?.uid || '').trim();
  const trackId = String(track?.id || '').trim();
  if (!uid || !trackId) throw new Error('공유 노트에 저장할 곡 정보를 확인하지 못했습니다.');

  const now = Date.now();
  const sourceCreatedAtMs = Math.max(1, Number(track.publishedAt || 0) || now);
  const sourceCreatedAt = new Date(sourceCreatedAtMs);
  const nextSong = track.shareBundle?.nextSong && typeof track.shareBundle.nextSong === 'object'
    ? track.shareBundle.nextSong
    : {};
  const selected = track.shareBundle?.selectedKeywords && typeof track.shareBundle.selectedKeywords === 'object'
    ? track.shareBundle.selectedKeywords
    : {};
  const genre = firstText((selected as any).genres)
    || firstText((nextSong as any).subGenre)
    || firstText((nextSong as any).genre);
  const shareUrl = String(track.openUrl || track.sunoUrlPrimary || '').trim();
  const coverUrl = String(track.coverUrl || '').trim();
  const lyricsText = String(track.lyrics || '');
  const lyrics = /[가-힣]/.test(lyricsText)
    ? { korean: lyricsText, english: '' }
    : { korean: '', english: lyricsText };
  const creatorName = String(track.displayName || track.ownerHandle || 'SORiDRAW').trim() || 'SORiDRAW';
  const sunoLinks = shareUrl ? [{
    url: shareUrl,
    title: track.title,
    coverUrl,
    durationSeconds: Number(track.durationSeconds || 0) || null,
    rank: 1,
    updatedAt: now,
    fetchedAt: now,
  }] : [];

  const documentId = buildSharedNoteDocumentId(uid, trackId);
  const payload = cleanUndefinedValues({
    uid,
    ownerUid: track.ownerUid || null,
    creatorUid: track.ownerUid || null,
    originalOwnerUid: track.ownerUid || null,
    originalCreatorUid: track.ownerUid || null,
    ownerNickname: creatorName,
    creatorNickname: creatorName,
    creatorDisplayId: track.ownerHandle || creatorName,
    creatorName,
    creatorDisplayName: creatorName,
    originalOwnerNickname: creatorName,
    originalCreatorNickname: creatorName,
    originalCreatorDisplayId: track.ownerHandle || creatorName,
    originalCreatorName: creatorName,
    originalCreatorDisplayName: creatorName,
    savedByUid: uid,
    savedByNickname: String(user.displayName || user.email || '').trim() || 'SORiDRAW',
    savedByEmail: user.email || null,
    title: track.title,
    koreanTitle: '',
    englishTitle: '',
    genre,
    lyrics,
    prompt: track.prompt || '',
    appliedKeywords: { ...(nextSong as Record<string, unknown>) },
    userInput: '',
    situationSummary: String((nextSong as any).situationSummary || ''),
    style: track.style || '',
    musicNoteMemo: '',
    noteMemo: '',
    musicNoteDuplicateKey: `explore:${trackId}`,
    sunoShareUrl: shareUrl,
    sunoLinks,
    sunoShareLinks: sunoLinks,
    mainSunoIndex: 0,
    imageUrl: coverUrl,
    audioUrl: track.sunoUrlPrimary || '',
    isLocked: false,
    isSharedMusicNote: true,
    sharedReadOnly: true,
    sourceType: 'shared_music_note',
    originalFavoriteId: track.sourceId || trackId,
    sharedNoteShareId: trackId,
    exploreTrackId: trackId,
    sharedNoteFolderId: folder.id,
    sharedNoteFolderTitle: folder.title,
    sharedNoteFolderUpdatedAt: now,
    createdAtMs: sourceCreatedAtMs,
    originalCreatedAtMs: sourceCreatedAtMs,
    createdAt: sourceCreatedAt,
    originalCreatedAt: sourceCreatedAt,
    updatedAt: serverTimestamp(),
    sharedNoteSavedAt: serverTimestamp(),
    sharedNoteSavedAtMs: now,
  });

  await runV1MutationBoundary({
    domain: 'musicNote',
    operation: 'shared-note-save',
    uid,
    documentIds: [documentId],
    affectedCount: 1,
  }, setDoc(doc(db, 'favorites', documentId), payload, { merge: true }));

  return documentId;
};
