import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Pencil, Plus, UserRound, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  getExplorePublicProfile,
  prepareExploreProfileMedia,
  updateExplorePublicProfile,
  uploadExploreProfileMedia,
  type ExploreProfileDraft,
  type ExplorePublicProfile,
} from '../../services/exploreSocialService';

type Props = {
  user: User;
  profile: ExplorePublicProfile;
  onClose: () => void;
  onSaved: (profile: ExplorePublicProfile) => void;
};

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl || '');
  const [backgroundPreview, setBackgroundPreview] = useState(profile.backgroundUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      if (backgroundPreview.startsWith('blob:')) URL.revokeObjectURL(backgroundPreview);
    };
  }, [avatarPreview, backgroundPreview]);

  const handleValid = useMemo(() => /^[a-z0-9._]{3,24}$/.test(draft.handle) && !draft.handle.startsWith('.') && !draft.handle.endsWith('.') && !draft.handle.includes('..'), [draft.handle]);

  const selectImage = (file: File | undefined, kind: 'avatar' | 'background') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 선택할 수 있습니다.');
      return;
    }
    setError('');
    const nextUrl = URL.createObjectURL(file);
    if (kind === 'avatar') {
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(file);
      setAvatarPreview(nextUrl);
    } else {
      if (backgroundPreview.startsWith('blob:')) URL.revokeObjectURL(backgroundPreview);
      setBackgroundFile(file);
      setBackgroundPreview(nextUrl);
    }
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
      if (backgroundFile) {
        const blob = await prepareExploreProfileMedia(backgroundFile, 'background');
        await uploadExploreProfileMedia(user, 'background', blob);
      }
      if (avatarFile) {
        const blob = await prepareExploreProfileMedia(avatarFile, 'avatar');
        await uploadExploreProfileMedia(user, 'avatar', blob);
      }
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
      if (event.target === event.currentTarget && !saving) onClose();
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
          <input ref={backgroundInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => selectImage(event.target.files?.[0], 'background')} />
          <p className="soridraw-explore-profile-edit-help">가로형 이미지를 권장합니다. 저장할 때 1600×600 WEBP로 자동 최적화합니다.</p>

          <label className="soridraw-explore-profile-edit-label">프로필 사진</label>
          <button type="button" className="soridraw-explore-profile-avatar-picker" onClick={() => avatarInputRef.current?.click()} disabled={saving}>
            {avatarPreview ? <img src={avatarPreview} alt="" /> : <UserRound aria-hidden="true" />}
            <span className="soridraw-explore-profile-image-edit-badge"><Pencil aria-hidden="true" /></span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => selectImage(event.target.files?.[0], 'avatar')} />
          <p className="soridraw-explore-profile-edit-help">정사각형으로 잘라 512×512 WEBP로 자동 최적화합니다.</p>

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

          <label className="soridraw-explore-profile-edit-label">대표 장르 <span>{draft.genres.length}/5</span></label>
          <div className="soridraw-explore-profile-genre-add">
            <input value={genreInput} maxLength={20} placeholder="장르 입력" onChange={(event) => setGenreInput(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); addGenre(); }
            }} />
            <button type="button" onClick={addGenre} disabled={!genreInput.trim() || draft.genres.length >= 5}><Plus aria-hidden="true" /> 추가</button>
          </div>
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
    </div>
  );
}
