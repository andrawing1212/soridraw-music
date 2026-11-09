export type NotificationCategory = 'like' | 'follow' | 'complete' | 'announcement' | 'message';
export type NotificationSection = 'activity' | 'creation' | 'announcement';

/** Classify only notification presentation. No new generation history
 * database or user-scoped scan is needed to render either tab. */
export function notificationSectionFor(category: NotificationCategory): NotificationSection {
  return category === 'complete' ? 'creation' : category === 'announcement' ? 'announcement' : 'activity';
}

export interface InboxNotification {
  id: string;
  category: NotificationCategory;
  actorUid?: string;
  actorName: string;
  actorAvatarUrl?: string;
  text: string;
  /** Complete body of an administrator announcement or private message. */
  body?: string;
  createdAt: number;
  read?: boolean;
  song?: {
    id: string;
    title: string;
    coverUrl?: string;
    audioUrl?: string;
    // URL for the EXISTING share/player route, not an arbitrary external URL.
    sharePath?: string;
  };
}

export type NotificationPreferences = Record<NotificationCategory, boolean>;

export const NOTIFICATION_PREFERENCES_DEFAULT: NotificationPreferences = {
  like: true, follow: true, complete: true, announcement: true, message: true,
};

// Keep the existing per-category v1 record unchanged. The master is an
// independent local gate: turning it off never destroys five saved choices.
const keyFor = (uid: string) => 'soridraw:notification-preferences:v1:' + encodeURIComponent(uid);
const masterKeyFor = (uid: string) => 'soridraw:notification-master:v1:' + encodeURIComponent(uid);

export function readNotificationMasterEnabled(uid: string, preferences: NotificationPreferences): boolean {
  if (!uid || typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(masterKeyFor(uid));
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch { /* fall through without changing existing saved settings */ }
  // Backwards compatibility: the old master wrote every category false.
  // Respect that legacy all-off state without creating any new write on read.
  return (Object.keys(NOTIFICATION_PREFERENCES_DEFAULT) as NotificationCategory[])
    .some((category) => preferences[category]);
}

export function saveNotificationMasterEnabled(uid: string, enabled: boolean): void {
  if (!uid || typeof window === 'undefined') return;
  try { window.localStorage.setItem(masterKeyFor(uid), String(enabled));
    window.dispatchEvent?.(new Event('soridraw:notification-dot-change')); }
  catch { /* in-memory state remains usable if storage is full */ }
}

/** Pink-dot visibility only: message delivery and lists ignore these settings.
 * Local UI preference during the initial panel release.
 * Account-wide settings and actual notifications require the approved backend;
 * this intentionally makes NO new server request, mutation, or listener. */
export function readNotificationPreferences(uid: string): NotificationPreferences {
  if (!uid || typeof window === 'undefined') return { ...NOTIFICATION_PREFERENCES_DEFAULT };
  try {
    const raw = window.localStorage.getItem(keyFor(uid));
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== 'object') return { ...NOTIFICATION_PREFERENCES_DEFAULT };
    const value = saved as Record<string, unknown>;
    return Object.fromEntries(
      (Object.keys(NOTIFICATION_PREFERENCES_DEFAULT) as NotificationCategory[])
        .map((category) => [category, typeof value[category] === 'boolean'
          ? value[category] : NOTIFICATION_PREFERENCES_DEFAULT[category]])
    ) as NotificationPreferences;
  } catch { return { ...NOTIFICATION_PREFERENCES_DEFAULT }; }
}

export function saveNotificationPreferences(uid: string, data: NotificationPreferences): void {
  if (!uid || typeof window === 'undefined') return;
  try { window.localStorage.setItem(keyFor(uid), JSON.stringify(data));
    window.dispatchEvent?.(new Event('soridraw:notification-dot-change')); } catch { /* memory state stays usable */ }
}

/** No fake user activity in production. PREVIEW's explicitly labelled visual
 * examples exist solely for design review, never for delivery or counters. */
export function isNotificationVisualPreview(): boolean {
  return typeof window !== 'undefined' &&
    (window.location.hostname === 'preview.soridraw.com' ||
     window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1');
}

export const NOTIFICATION_EXAMPLE_ROWS: InboxNotification[] = [
  { id: 'example-like', category: 'like', actorName: 'LunaBeat', text: '내 곡에 좋아요를 눌렀습니다.',
    createdAt: 2 * 60 * 60 * 1000, song: { id: '', title: '깊어지는 시간의 궤적' } },
  { id: 'example-follow', category: 'follow', actorName: 'RiverTone', text: '나를 팔로우했습니다.',
    createdAt: 2 * 60 * 60 * 1000 },
  { id: 'example-complete', category: 'complete', actorName: 'SORIDRAW',
    text: '새로운 곡 생성이 완료되었습니다.', createdAt: 4 * 60 * 60 * 1000,
    song: { id: '', title: 'Night Window' } },
  { id: 'example-notice', category: 'announcement', actorName: 'SORIDRAW',
    text: '[공지] 서비스 업데이트 안내',
    body: '서비스 업데이트 공지의 전체 내용을 이곳에서 확인할 수 있습니다.',
    createdAt: 6 * 60 * 60 * 1000 },
  { id: 'example-message', category: 'message', actorName: 'SORIDRAW',
    text: '관리자가 보낸 개인 메시지입니다.',
    body: '관리자가 보낸 개인 메시지의 전체 내용을 이곳에서 확인할 수 있습니다.',
    createdAt: 6 * 60 * 60 * 1000 },
];
