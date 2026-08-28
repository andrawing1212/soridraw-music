import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Pencil, Plus, RefreshCw, UserRound, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  getExplorePublicProfile,
  updateExplorePublicProfile,
  uploadExploreProfileMedia,
  type ExploreProfileDraft,
  type ExploreProfileMediaKind,
  type ExplorePublicProfile,
} from '../../services/exploreSocialService';
import { suggestExploreProfileGenres } from '../../services/exploreProfileGenreSuggestionService';
import ExploreImageCropModal from './ExploreImageCropModal';

type Props = {
  user: User;
  profile: ExplorePublicProfile;
  onClose: () => void;
  onSaved: (profile: ExplorePublicProfile) => void;
};

type CropEditorState = {
  kind: ExploreProfileMediaKind;
  file: File;
} | null;

const genericNames = new Set(['SORIDRAW 사용자', 'SORIDRAW User', 'SORiDRAW', 'SORIDRAW']);

const suggestedNickname = (user: User, profile: ExplorePublicProfile) => {
  const current = String(profile.nickname || '').trim();
  if (current && !genericNames.has(current)) return current;
  return String(user.displayName || user.email?.split('@')[0] || current || 'SORIDRAW').trim();
};

const suggestedHandle = (user: User, profile: ExplorePublicProfile) => {
  if (profile.handle) return profile.handle.toLowerCase();
  const source = String(user.displayName || user.email?.split('@')[0] || profile.nickname || 'soridraw')
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);
  return source.length >= 3 ? source : `user${user.uid.slice(0, 8).toLowerCase()}`;
};

export default function ExploreProfileEditModal({ user, profile, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ExploreProfileDraft>(() => ({
    nickname: suggestedNickname(user, profile),
    bio: profile.bio || '',
    handle: suggestedHandle(user, profile),
    genres: profile.genres || [],
    spotifyUrl: profile.socialLinks?.spotify || '',
    instagramUrl: profile.socialLinks?.instagram || '',
    tiktokUrl: profile.socialLinks?.tiktok || '',
  }));
  const [genreInput, setGenreInput] = useState('');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [backgroundBlob, setBackgroundBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl || '');
  const [backgroundPreview, setBackgroundPreview] = useState(profile.backgroundUrl || '');
  const [cropEditor, setCropEditor] = useState<CropEditorState>(null);
  const [genreRefreshing, setGenreRefreshing] = useState(false);
  const [genreNotice, setGenreNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const avatarPreviewRef = useRef(avatarPreview);
  const backgroundPreviewRef = useRef(backgroundPreview);

  useEffect(() => { avatarPreviewRef.current = avatarPreview; }, [avatarPreview]);
  useEffect(() => { backgroundPreviewRef.current = backgroundPreview; }, [backgroundPreview]);
  useEffect(() => () => {
    if (avatarPreviewRef.current.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewRef.current);
    if (backgroundPreviewRef.current.startsWith('blob:')) URL.revokeObjectURL(backgroundPreviewRef.current);
  }, []);

  const handleValid = useMemo(() => /^[a-z0-9._]{3,24}$/.test(draft.handle) && !draft.handle.startsWith('.') && !draft.handle.endsWith('.') && !draft.handle.includes('..'), [draft.handle]);

  const selectImage = (file: File | undefined, kind: ExploreProfileMediaKind) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 선택할 수 있습니다.');
      return;
    }
    setError('');
    setCropEditor({ kind, file });
  };

  const applyEditedImage = (kind: ExploreProfileMediaKind, blob: Blob) => {
    const nextUrl = URL.createObjectURL(blob);
    if (kind === 'avatar') {
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      setAvatarBlob(blob);
      setAvatarPreview(nextUrl);
    } else {
      if (backgroundPreview.startsWith('blob:')) URL.revokeObjectURL(backgroundPreview);
      setBackgroundBlob(blob);
      setBackgroundPreview(nextUrl);
    }
    setCropEditor(null);
  };

  const addGenre = () => {
    const value = genreInput.trim().slice(0, 20);
    if (!value || draft.genres.length >= 5) return;
    if (draft.genres.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setGenreInput('');
      return;
    }
    setDraft((prev) => ({ ...prev, genres: [...prev.genres, value] }));
    setGenreInput('');
    setGenreNotice('');
    setError('');
  };

  const refreshGenres = async () => {
    if (genreRefreshing) return;
    setGenreRefreshing(true);
    setGenreNotice('');
    setError('');
    try {
      const result = await suggestExploreProfileGenres(user.uid);
      if (result.recentSongCount === 0) {
        setGenreNotice('최근 생성곡이 없어 자동 추천을 만들지 못했어요.');
        return;
      }
      if (result.genres.length === 0) {
        setGenreNotice(`최근 ${result.recentSongCount}곡에서 장르 정보를 찾지 못했어요.`);
        return;
      }
      setDraft((prev) => ({ ...prev, genres: result.genres }));
      setGenreNotice(`최근 ${result.recentSongCount}곡 기준으로 대표 장르를 갱신했어요. 서버 읽기 ${result.firestoreReads}회.`);
    } catch (reason) {
      console.error('Explore profile genre refresh failed:', reason);
      setError(reason instanceof Error ? reason.message : '최근곡 장르를 불러오지 못했습니다.');
    } finally {
      setGenreRefreshing(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const nickname = draft.nickname.trim().replace(/\s+/g, ' ');
    if (!nickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    if (!handleValid) {
      setError('핸들은 영문 소문자, 숫자, 점(.), 밑줄(_)로 3~24자만 사용할 수 있습니다.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateExplorePublicProfile(user, { ...draft, nickname });
      if (backgroundBlob) await uploadExploreProfileMedia(user, 'background', backgroundBlob);
      if (avatarBlob) await uploadExploreProfileMedia(user, 'avatar', avatarBlob);
      const refreshed = await getExplorePublicProfile(user.uid);
      onSaved(refreshed);
      onClose();
    } catch (reason) {
      console.error('Explore profile save failed:', reason);
      setError(reason instanceof Error ? reason.message : '프로필 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="soridraw-explore-profile-edit-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving && !cropEditor) onClose();
    }}>
      <section className="soridraw-explore-profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="soridraw-profile-edit-title">
        <header className="soridraw-explore-profile-edit-header">
          <h2 id="soridraw-profile-edit-title">프로필 편집</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기"><X aria-hidden="true" /></button>
        </header>

        <div className="soridraw-explore-profile-edit-scroll">
          <label className="soridraw-explore-profile-edit-label">배경 이미지</label>
          <button type="button" className="soridraw-explore-profile-background-picker" onClick={() => backgroundInputRef.current?.click()} disabled={saving}>
            {backgroundPreview ? <img src={backgroundPreview} alt="" /> : <span><ImagePlus aria-hidden="true" /> 배경 이미지 선택</span>}
            <span className="soridraw-explore-profile-image-edit-badge"><Pencil aria-hidden="true" /></span>
          </button>
          <input ref={backgroundInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
            selectImage(event.target.files?.[0], 'background');
            event.currentTarget.value = '';
          }} />
          <p className="soridraw-explore-profile-edit-help">선택 후 위치 이동과 확대/축소를 조정하고 1600×600 WEBP로 저장합니다.</p>

          <label className="soridraw-explore-profile-edit-label">프로필 사진</label>
          <button type="button" className="soridraw-explore-profile-avatar-picker" onClick={() => avatarInputRef.current?.click()} disabled={saving}>
            {avatarPreview ? <img src={avatarPreview} alt="" /> : <UserRound aria-hidden="true" />}
            <span className="soridraw-explore-profile-image-edit-badge"><Pencil aria-hidden="true" /></span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
            selectImage(event.target.files?.[0], 'avatar');
            event.currentTarget.value = '';
          }} />
          <p className="soridraw-explore-profile-edit-help">선택 후 위치 이동과 확대/축소를 조정하고 512×512 WEBP로 저장합니다.</p>

          <label className="soridraw-explore-profile-edit-label" htmlFor="soridraw-profile-nickname">닉네임</label>
          <input id="soridraw-profile-nickname" className="soridraw-explore-profile-edit-input" value={draft.nickname} maxLength={40} onChange={(event) => setDraft((prev) => ({ ...prev, nickname: event.target.value }))} />

          <label className="soridraw-explore-profile-edit-label" htmlFor="soridraw-profile-bio">소개</label>
          <div className="soridraw-explore-profile-edit-textarea-wrap">
            <textarea id="soridraw-profile-bio" value={draft.bio} maxLength={200} onChange={(event) => setDraft((prev) => ({ ...prev, bio: event.target.value }))} placeholder="음악과 작업을 간단히 소개해보세요." />
            <span>{draft.bio.length}/200</span>
          </div>

          <label className="soridraw-explore-profile-edit-label" htmlFor="soridraw-profile-handle">고유 핸들</label>
          <div className={`soridraw-explore-profile-handle-wrap${handleValid ? '' : ' is-invalid'}`}>
            <span>@</span>
            <input id="soridraw-profile-handle" value={draft.handle} maxLength={24} autoCapitalize="none" spellCheck={false} onChange={(event) => setDraft((prev) => ({ ...prev, handle: event.target.value.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9._]/g, '') }))} />
          </div>
          <p className="soridraw-explore-profile-edit-help">페이지를 구분하는 고유 이름입니다. 중복 확인은 저장할 때 한 번만 합니다.</p>

          <div className="soridraw-explore-profile-genre-heading">
            <label className="soridraw-explore-profile-edit-label">대표 장르 <span>{draft.genres.length}/5</span></label>
            <button
              type="button"
              className="soridraw-explore-profile-genre-refresh"
              onClick={() => void refreshGenres()}
              disabled={genreRefreshing}
              aria-label="최근 10곡에서 대표 장르 새로고침"
              title="최근 10곡에서 대표 장르 새로고침"
            >
              {genreRefreshing ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            </button>
          </div>
          <div className="soridraw-explore-profile-genre-add">
            <input value={genreInput} maxLength={20} placeholder="장르 입력" onChange={(event) => setGenreInput(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); addGenre(); }
            }} />
            <button
              type="button"
              className="soridraw-explore-profile-genre-plus"
              onClick={addGenre}
              disabled={!genreInput.trim() || draft.genres.length >= 5}
              aria-label="장르 추가"
              title="장르 추가"
            ><Plus aria-hidden="true" /></button>
          </div>
          <p className="soridraw-explore-profile-edit-help">직접 입력하거나 새로고침 버튼을 눌러 최근 10곡 기준으로 자동 추천합니다. 자동 조회는 버튼을 누를 때만 1회 실행됩니다.</p>
          {genreNotice && <div className="soridraw-explore-profile-genre-notice" role="status">{genreNotice}</div>}
          {draft.genres.length > 0 && <div className="soridraw-explore-profile-genre-chips">
            {draft.genres.map((genre) => <button key={genre} type="button" onClick={() => setDraft((prev) => ({ ...prev, genres: prev.genres.filter((item) => item !== genre) }))}>{genre}<X aria-hidden="true" /></button>)}
          </div>}

          <label className="soridraw-explore-profile-edit-label">소셜 링크</label>
          {([
            ['spotifyUrl', 'Spotify', 'https://open.spotify.com/...'],
            ['instagramUrl', 'Instagram', 'https://www.instagram.com/...'],
            ['tiktokUrl', 'TikTok', 'https://www.tiktok.com/@...'],
          ] as const).map(([key, label, placeholder]) => (
            <div className="soridraw-explore-profile-social-input" key={key}>
              <Link2 aria-hidden="true" />
              <span>{label}</span>
              <input value={draft[key]} placeholder={placeholder} inputMode="url" onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))} />
            </div>
          ))}

          {error && <div className="soridraw-explore-profile-edit-error" role="alert">{error}</div>}
        </div>

        <footer className="soridraw-explore-profile-edit-footer">
          <button type="button" className="is-cancel" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="is-save" onClick={() => void save()} disabled={saving || !handleValid || !draft.nickname.trim()}>
            {saving ? <><Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> 저장 중</> : '저장'}
          </button>
        </footer>
      </section>

      {cropEditor && (
        <ExploreImageCropModal
          file={cropEditor.file}
          kind={cropEditor.kind}
          onCancel={() => setCropEditor(null)}
          onApply={(blob) => applyEditedImage(cropEditor.kind, blob)}
        />
      )}
    </div>
  );
}
