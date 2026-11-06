import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronRight, Heart, Mail, Megaphone, Music2, Settings2, UserRoundPlus, X } from 'lucide-react';
import { auth } from '../../firebase';
import { useGlobalPlayerControls } from '../../contexts/GlobalPlayerContext';
import { setExploreFollow } from '../../services/exploreSocialService';
import {
  NOTIFICATION_EXAMPLE_ROWS, NOTIFICATION_PREFERENCES_DEFAULT,
  isNotificationVisualPreview, readNotificationMasterEnabled,
  readNotificationPreferences, saveNotificationMasterEnabled, saveNotificationPreferences,
  type InboxNotification, type NotificationCategory,
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
// One native checkbox drives the visual sliding switch for the master setting
// and for every category. Keyboard, touch and screen readers share its state.
function NotificationSwitch({ checked, onChange, label, disabled = false }: {
  checked: boolean; onChange: () => void; label: string; disabled?: boolean;
}) {
  return (
    <span className="soridraw-notification-switch-control">
      <input type="checkbox" role="switch" className="soridraw-notification-switch-input"
        checked={checked} onChange={onChange} disabled={disabled} aria-label={label} />
      <span className="soridraw-notification-switch-track" aria-hidden="true">
        <span className="soridraw-notification-switch-thumb" />
      </span>
    </span>
  );
}
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
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const { playTrack } = useGlobalPlayerControls();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(NOTIFICATION_PREFERENCES_DEFAULT);
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [position, setPosition] = useState({ left: 80, top: 12 });
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InboxNotification | null>(null);
  const uid = auth.currentUser?.uid || '';

  useEffect(() => {
    if (!open) return;
    const savedPreferences = readNotificationPreferences(uid);
    setPrefs(savedPreferences);
    setMasterEnabled(readNotificationMasterEnabled(uid, savedPreferences));
    setSettingsOpen(false);
    setNotice('');
    setSelectedMessage(null);
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
    // Resizing an external browser window invalidates the anchoring viewport.
    // Close instead of allowing a stale fixed panel at the wrong location.
    window.addEventListener('resize', onClose);
    // The Studio split-bar only moves the rail: reposition without closing.
    window.addEventListener('soridraw-studio-frame-resize', update as EventListener);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('soridraw-studio-frame-resize', update as EventListener);
    };
  }, [open, anchorRef, onClose]);

  useEffect(() => {
    if (selectedMessage) detailCloseRef.current?.focus();
  }, [selectedMessage]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      // Modal backdrop owns dismissal while a message is being read.
      if (selectedMessage) return;
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedMessage) {
        event.stopImmediatePropagation();
        setSelectedMessage(null);
      } else {
        onClose();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, anchorRef, onClose, selectedMessage]);

  // No live subscription, polling, per-user list scan, or backend writes in
  // the UI release. A verified recipient-scoped backend inbox is a separate
  // activation gate. PREVIEW examples are explicitly labelled as examples.
  const visualExample = isNotificationVisualPreview();
  const rows = useMemo(() => (visualExample ? NOTIFICATION_EXAMPLE_ROWS : [])
    .filter((row) => masterEnabled && prefs[row.category]), [visualExample, prefs, masterEnabled]);

  const toggleMaster = () => {
    const nextEnabled = !masterEnabled;
    setMasterEnabled(nextEnabled);
    saveNotificationMasterEnabled(uid, nextEnabled);
  };
  const updatePreference = (category: NotificationCategory) => {
    if (!masterEnabled) return;
    const next = { ...prefs, [category]: !prefs[category] };
    setPrefs(next);
    saveNotificationPreferences(uid, next);
  };
  const closeAndNavigate = (path: string) => {
    onClose();
    navigate(path);
  };
  const openProfile = (row: InboxNotification) => {
    // PREVIEW examples are not real people. Never invent a UID or redirect
    // to a different user's profile to simulate a notification.
    if (visualExample) {
      setNotice('예시 사용자에게 연결된 실제 공개 프로필은 없습니다.');
      return;
    }
    const actorUid = String(row.actorUid || '').trim();
    if (actorUid) closeAndNavigate('/explore?profile=' + encodeURIComponent(actorUid));
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
    <>
    <div ref={panelRef} className="soridraw-notification-panel" style={position}
      role="dialog" aria-modal="false" aria-label={settingsOpen ? '알림 설정' : '알림'}>
      <div className="soridraw-notification-header">
        <div className="soridraw-notification-heading">
          <Bell size={20} aria-hidden="true" />
          <strong>{settingsOpen ? '알림 설정' : '알림'}</strong>
          {visualExample && !settingsOpen && <span className="soridraw-notification-preview-tag">예시</span>}
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
          <label className="soridraw-notification-setting-master">
            <span className="soridraw-notification-category-icon" aria-hidden="true">
              <Bell size={18} />
            </span>
            <span className="soridraw-notification-setting-copy">
              <strong>전체 알림</strong>
              <small>{masterEnabled ? '선택한 알림이 켜져 있습니다' :
                '전체 알림이 꺼져 있습니다'}</small>
            </span>
            <NotificationSwitch checked={masterEnabled} onChange={toggleMaster}
              label="전체 알림" />
          </label>
          <div className="soridraw-notification-settings-divider" aria-hidden="true" />
          {TYPES.map((item) => (
            <label key={item.key}
              className={`soridraw-notification-setting-row${masterEnabled ? '' : ' is-disabled'}`}
              aria-disabled={!masterEnabled}>
              <span className="soridraw-notification-category-icon" data-type={item.key}>
                {iconFor(item.key)}
              </span>
              <span className="soridraw-notification-setting-copy">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <NotificationSwitch checked={prefs[item.key]} disabled={!masterEnabled}
                onChange={() => updatePreference(item.key)} label={item.label} />
            </label>
          ))}

        </div>
      ) : (
        <div className="soridraw-notification-list">
          {rows.length ? rows.map((row) => (
            <div className="soridraw-notification-row" key={row.id}>
              {row.category === 'announcement' || row.category === 'message' ? (
                <span className="soridraw-notification-avatar-icon" data-type={row.category} aria-hidden="true">
                  {iconFor(row.category)}
                </span>
              ) : (
                <button className="soridraw-notification-avatar" type="button"
                  aria-label={row.actorName + ' 프로필'} onClick={() => openProfile(row)}
                  disabled={visualExample || !row.actorUid}>
                  {row.actorAvatarUrl ? <img src={row.actorAvatarUrl} alt="" referrerPolicy="no-referrer" /> :
                    <span>{row.actorName.slice(0, 1)}</span>}
                </button>
              )}
              <div className="soridraw-notification-content">
                <span>
                  {row.category === 'like' || row.category === 'follow' ? (
                    <>
                      <button type="button" className="soridraw-notification-actor-link"
                        disabled={!visualExample && !row.actorUid}
                        aria-label={row.actorName + ' 공개 프로필 열기'}
                        onClick={() => openProfile(row)}>
                        {row.actorName}
                      </button>
                      {' '}{row.text}
                    </>
                  ) : row.text}
                </span>
                {row.song && <small className="soridraw-notification-song-title">{row.song.title}</small>}
                <small>{timeLabel(row.createdAt)}</small>
              </div>
              {row.category === 'announcement' || row.category === 'message' ? (
                <button type="button" className="soridraw-notification-detail-open"
                  aria-label={row.category === 'announcement' ? '공지사항 자세히 보기' : '개인 메시지 자세히 보기'}
                  onClick={() => setSelectedMessage(row)}>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              ) : row.category === 'follow' ? (
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
              ) : <span className="soridraw-notification-end-icon" data-type={row.category} aria-hidden="true">{iconFor(row.category)}</span>}
            </div>
          )) : (
            <p className="soridraw-notification-empty">아직 표시할 알림이 없습니다.</p>
          )}
        </div>
      )}
      {notice && <div role="status" className="soridraw-notification-error">{notice}</div>}
    </div>
    {selectedMessage && (selectedMessage.category === 'announcement' || selectedMessage.category === 'message') && (
      <div className="soridraw-notification-detail-backdrop"
        onMouseDown={(event) => {
          // Do not let the panel's outside-click listener close the inbox too.
          event.stopPropagation();
          if (event.target === event.currentTarget) setSelectedMessage(null);
        }}>
        <div className="soridraw-notification-detail-modal" role="dialog" aria-modal="true"
          aria-label={selectedMessage.category === 'announcement' ? '공지사항 내용' : '개인 메시지 내용'}>
          <div className="soridraw-notification-detail-header">
            <span className="soridraw-notification-detail-type" data-type={selectedMessage.category}>
              {iconFor(selectedMessage.category)}
              {selectedMessage.category === 'announcement' ? '공지사항' : '개인 메시지'}
              {visualExample && <small className="soridraw-notification-preview-tag">예시</small>}
            </span>
            <button type="button" ref={detailCloseRef} className="soridraw-notification-detail-close"
              aria-label="메시지 닫기" onClick={() => setSelectedMessage(null)}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="soridraw-notification-detail-content">
            <h2>{selectedMessage.text}</h2>
            <div className="soridraw-notification-detail-body">
              {selectedMessage.body?.trim() || selectedMessage.text}
            </div>
          </div>
          <div className="soridraw-notification-detail-footer">
            <button type="button" className="soridraw-notification-detail-confirm"
              onClick={() => setSelectedMessage(null)}>확인</button>
          </div>
        </div>
      </div>
    )}
    </>,
    document.body,
  );
}
