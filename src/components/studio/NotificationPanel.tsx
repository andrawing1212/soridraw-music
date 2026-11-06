import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Heart, Mail, Megaphone, Music2, Settings2, UserRoundPlus, X } from 'lucide-react';
import { auth } from '../../firebase';
import { useGlobalPlayerControls } from '../../contexts/GlobalPlayerContext';
import { setExploreFollow } from '../../services/exploreSocialService';
import {
  NOTIFICATION_EXAMPLE_ROWS, NOTIFICATION_PREFERENCES_DEFAULT,
  isNotificationVisualPreview, readNotificationPreferences,
  saveNotificationPreferences, type InboxNotification, type NotificationCategory,
  type NotificationPreferences,
} from '../../services/notifications/notificationModel';
import './notificationPanel.css';

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

const TYPES: Array<{ key: NotificationCategory; label: string; detail: string }> = [
  { key: 'like', label: '내 곡 좋아요', detail: '내 공개곡에 새로운 좋아요가 눌렸을 때' },
  { key: 'follow', label: '새 팔로워', detail: '누군가 나를 새로 팔로우했을 때' },
  { key: 'complete', label: '곡 생성 완료', detail: '내가 생성한 곡이 완성되었을 때' },
  { key: 'announcement', label: '공지사항', detail: 'SORIDRAW 관리자의 공지' },
  { key: 'message', label: '개인 메시지', detail: '관리자가 나에게 보낸 메시지' },
];

const iconFor = (type: NotificationCategory) => {
  if (type === 'like') return <Heart size={18} />;
  if (type === 'follow') return <UserRoundPlus size={18} />;
  if (type === 'complete') return <Music2 size={18} />;
  if (type === 'announcement') return <Megaphone size={18} />;
  return <Mail size={18} />;
};
const timeLabel = (millisecondsAgo: number): string => {
  if (millisecondsAgo < 60 * 60 * 1000) return '방금 전';
  const hours = Math.floor(millisecondsAgo / (60 * 60 * 1000));
  return hours < 24 ? hours + '시간 전' : Math.floor(hours / 24) + '일 전';
};
const validInternalSharePath = (path: string | undefined): string | null => {
  if (!path) return null;
  // Prevent user-controlled notification payloads from becoming a cross-origin URL.
  if (!/^\/(?:suno-library|explore)(?:\?|$)/.test(path) ||
      path.includes('\\') || path.includes('//')) return null;
  return path;
};

export default function NotificationPanel({ open, anchorRef, onClose }: Props) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const { playTrack } = useGlobalPlayerControls();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(NOTIFICATION_PREFERENCES_DEFAULT);
  const [position, setPosition] = useState({ left: 80, top: 12 });
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const uid = auth.currentUser?.uid || '';

  useEffect(() => {
    if (!open) return;
    setPrefs(readNotificationPreferences(uid));
    setSettingsOpen(false);
    setNotice('');
  }, [open, uid]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      const width = Math.min(418, window.innerWidth - 24);
      // The panel sits beside the left rail even when its width is collapsed.
      const left = Math.min(
        window.innerWidth - width - 12,
        Math.max(12, (rect?.right ?? 64) + 10),
      );
      setPosition({ left: Math.round(left), top: Math.min(65, Math.max(12, window.innerHeight - 240)) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('soridraw-studio-frame-resize', update as EventListener);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('soridraw-studio-frame-resize', update as EventListener);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, anchorRef, onClose]);

  // No live subscription, polling, per-user list scan, or backend writes in
  // the UI release. A verified recipient-scoped backend inbox is a separate
  // activation gate. PREVIEW examples are explicitly labelled as examples.
  const visualExample = isNotificationVisualPreview();
  const rows = useMemo(() => (visualExample ? NOTIFICATION_EXAMPLE_ROWS : [])
    .filter((row) => prefs[row.category]), [visualExample, prefs]);

  const updatePreference = (category: NotificationCategory) => {
    const next = { ...prefs, [category]: !prefs[category] };
    setPrefs(next);
    saveNotificationPreferences(uid, next);
  };
  const closeAndNavigate = (path: string) => {
    onClose();
    navigate(path);
  };
  const openProfile = (row: InboxNotification) => {
    if (visualExample) return;
    if (row.actorUid) closeAndNavigate('/explore?profile=' + encodeURIComponent(row.actorUid));
  };
  const follow = async (row: InboxNotification) => {
    if (visualExample || !row.actorUid || !auth.currentUser ||
        row.actorUid === auth.currentUser.uid || followBusy) return;
    setFollowBusy(row.actorUid);
    setNotice('');
    try {
      const result = await setExploreFollow(auth.currentUser, row.actorUid, true);
      if (result.isFollowing) setFollowed((previous) => ({ ...previous, [row.actorUid!]: true }));
    } catch {
      setNotice('팔로우를 처리하지 못했습니다. 프로필에서 다시 시도해 주세요.');
    } finally { setFollowBusy(null); }
  };
  const playSong = (row: InboxNotification) => {
    if (visualExample || !row.song) return;
    const audioUrl = String(row.song.audioUrl || '').trim();
    if (/^https:\/\//i.test(audioUrl)) {
      playTrack({ id: row.song.id, url: audioUrl, audioUrl, title: row.song.title,
        imageUrl: row.song.coverUrl });
      onClose();
      return;
    }
    const path = validInternalSharePath(row.song.sharePath);
    if (path) closeAndNavigate(path);
    else setNotice('이 곡의 재생 주소를 확인할 수 없습니다.');
  };

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={panelRef} className="soridraw-notification-panel" style={position}
      role="dialog" aria-modal="false" aria-label={settingsOpen ? '알림 설정' : '알림'}>
      <div className="soridraw-notification-header">
        <div className="soridraw-notification-heading">
          <Bell size={20} aria-hidden="true" />
          <strong>{settingsOpen ? '알림 설정' : '알림'}</strong>
        </div>
        <div className="soridraw-notification-header-actions">
          {settingsOpen ? (
            <button type="button" className="soridraw-notification-header-button"
              onClick={() => setSettingsOpen(false)} aria-label="알림 목록으로 돌아가기">
              <Check size={18} />
            </button>
          ) : (
            <button type="button" className="soridraw-notification-header-button"
              onClick={() => setSettingsOpen(true)} aria-label="알림 설정 열기">
              <Settings2 size={19} />
            </button>
          )}
          <button type="button" className="soridraw-notification-header-button"
            onClick={onClose} aria-label="알림 닫기"><X size={20} /></button>
        </div>
      </div>

      {settingsOpen ? (
        <div className="soridraw-notification-settings">
          {TYPES.map((item) => (
            <label key={item.key} className="soridraw-notification-setting-row">
              <span className="soridraw-notification-category-icon" data-type={item.key}>
                {iconFor(item.key)}
              </span>
              <span className="soridraw-notification-setting-copy">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <input type="checkbox" checked={prefs[item.key]}
                onChange={() => updatePreference(item.key)} aria-label={item.label} />
            </label>
          ))}
          <p className="soridraw-notification-footnote">
            알림 종류 선택은 현재 이 기기에 저장됩니다. 알림 취합 주기는 관리자만 변경할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="soridraw-notification-list">
          {visualExample && (
            <div className="soridraw-notification-sample-label">
              화면 미리보기 · 실제 사용자 알림이 아닙니다
            </div>
          )}
          {rows.length ? rows.map((row) => (
            <div className="soridraw-notification-row" key={row.id}>
              <button className="soridraw-notification-avatar" type="button"
                aria-label={row.actorName + ' 프로필'} onClick={() => openProfile(row)}
                disabled={visualExample || !row.actorUid}>
                {row.actorAvatarUrl ? <img src={row.actorAvatarUrl} alt="" referrerPolicy="no-referrer" /> :
                  <span>{row.actorName.slice(0, 1)}</span>}
              </button>
              <div className="soridraw-notification-content">
                <span><strong>{row.actorName}</strong> {row.text}</span>
                {row.song && <small className="soridraw-notification-song-title">{row.song.title}</small>}
                <small>{timeLabel(row.createdAt)}</small>
              </div>
              {row.category === 'follow' ? (
                <button type="button" className="soridraw-notification-follow"
                  disabled={visualExample || !row.actorUid || followed[row.actorUid] || followBusy === row.actorUid}
                  onClick={() => void follow(row)}>
                  {row.actorUid && followed[row.actorUid] ? '팔로잉' : '팔로우'}
                </button>
              ) : row.song ? (
                <button type="button" className="soridraw-notification-cover" onClick={() => playSong(row)}
                  disabled={visualExample} aria-label={row.song.title + ' 재생'}>
                  {row.song.coverUrl ? <img src={row.song.coverUrl} alt="" referrerPolicy="no-referrer" /> :
                    <Music2 size={22} aria-hidden="true" />}
                  <span className="soridraw-notification-play">▶</span>
                </button>
              ) : <span className="soridraw-notification-end-icon" aria-hidden="true">{iconFor(row.category)}</span>}
            </div>
          )) : (
            <p className="soridraw-notification-empty">아직 표시할 알림이 없습니다.</p>
          )}
          {visualExample && (
            <p className="soridraw-notification-footnote">
              실제 좋아요·팔로우·곡 완성·관리자 알림은 서버 취합 기능 연결 후 표시됩니다.
            </p>
          )}
          {!visualExample && <p className="soridraw-notification-footnote">알림 전달 기능은 준비 중입니다.</p>}
        </div>
      )}
      {notice && <div role="status" className="soridraw-notification-error">{notice}</div>}
    </div>,
    document.body,
  );
}
