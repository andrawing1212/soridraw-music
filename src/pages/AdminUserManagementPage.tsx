import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
} from '../lib/firestoreMeasured';
import { auth, db, functions, httpsCallable } from '../firebase';
import { AccountStatus, AppUserInfo, PaymentStatus, UserRole } from '../types';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Monitor,
  Music,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
  User,
  UserRoundX,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import AdminPageLayout from '../components/AdminPageLayout';
import { cn } from '../lib/utils';
import { getTimestampMs } from '../App';
import { FULL_ADMIN_PERMISSIONS, normalizeAdminPermissions, normalizeStaffRole } from '../constants/adminPermissions';
import { PRESENCE_DIAGNOSTIC_EVENT, readPresenceDiagnostic, type PresenceDiagnostic } from '../services/presenceService';
import { USER_PROFILE_CACHE_EVENT, readUserProfileCache } from '../lib/userProfileCache';
import { readAdminUserListCache, writeAdminUserListCache } from '../lib/adminUserListCache';
import { removeAdminStaffListCache } from '../lib/adminStaffListCache';

const SORIDRAW_929_SINGLE_USER_PROFILE_SOURCE = true;
const ROLE_LABELS: Record<UserRole, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  admin: 'Admin',
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: '정상',
  paused: '일시정지',
  expired: '만료',
  banned: '정지',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  none: '없음',
  active: '구독중',
  canceled: '취소됨',
  expired: '만료됨',
  refunded: '환불됨',
  trial: '체험판',
};

const ADMIN_PAGE_SIZE = 20;
const PRESENCE_CLOCK_TICK_MS = 60_000;
const ADMIN_PRESENCE_REFRESH_STORAGE_KEY = 'soridraw:admin-presence-refresh-ms';
const ADMIN_PRESENCE_REFRESH_DEFAULT_MS = 60_000;
const ADMIN_PRESENCE_REFRESH_OPTIONS = [
  { value: 30_000, label: '30초' },
  { value: 60_000, label: '60초' },
  { value: 120_000, label: '2분' },
  { value: 300_000, label: '5분' },
  { value: 600_000, label: '10분' },
  { value: 0, label: '끄기' },
] as const;
type AdminPresenceRefreshInterval = typeof ADMIN_PRESENCE_REFRESH_OPTIONS[number]['value'];
const LONG_INACTIVE_DAYS = 180;
const DORMANT_DAYS = 365;
const OFFLINE_TO_LOGGED_OUT_MS = 2 * 24 * 60 * 60 * 1000;

type PresenceState = 'active' | 'away' | 'background' | 'offline' | 'loggedOut' | 'forced';
type PresenceDisplayMode = 'ready' | 'checking' | 'error';

type DevicePresenceSummary = {
  deviceId: string;
  label: string;
  platform: string;
  browser: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  state: 'active' | 'away' | 'background' | 'offline';
  connectionCount: number;
  lastActivityAt?: number;
  lastSeenAt?: number;
  updatedAt?: number;
};

type LivePresenceSummary = {
  state: 'active' | 'away' | 'background' | 'offline';
  connectionCount: number;
  deviceCount: number;
  lastActivityAt?: number;
  lastSeenAt?: number;
  devices: DevicePresenceSummary[];
};
type ProviderKind = 'google' | 'email' | 'linked' | 'unknown' | 'deleted';
type ProviderFilter = 'all' | ProviderKind;
type VerificationFilter = 'all' | 'verified' | 'unverified' | 'deleted';
type AdminAction = 'setPresence' | 'forceLogout' | 'resetEmail' | 'deleteUser' | null;

type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'brand' | 'danger';
  requiredText?: string;
  onConfirm: () => Promise<void> | void;
};

const EMPTY_CONFIRM: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: '확인',
  tone: 'brand',
  onConfirm: () => undefined,
};

const getDayDiff = (timestamp?: number, now = Date.now()) => {
  if (!timestamp) return 0;
  return (now - timestamp) / 86_400_000;
};

const isForceLoggedOut = (user: Pick<AppUserInfo, 'lastLoginAt' | 'lastLogoutAt' | 'forceLogoutAt'>) => {
  const loginTime = user.lastLoginAt || 0;
  const logoutTime = user.lastLogoutAt || 0;
  const forceTime = user.forceLogoutAt || 0;
  return forceTime > 0 && forceTime > loginTime && (logoutTime === 0 || logoutTime <= forceTime);
};

const getLatestLivePresenceSignalAt = (livePresence?: LivePresenceSummary) => {
  if (!livePresence) return 0;
  return Math.max(
    livePresence.lastActivityAt || 0,
    ...livePresence.devices.flatMap((device) => [
      device.updatedAt || 0,
      device.lastActivityAt || 0,
    ])
  );
};

const getEffectiveAdminPresenceOverride = (
  user: Pick<AppUserInfo, 'lastLoginAt' | 'forceLogoutAt' | 'adminPresenceState' | 'adminPresenceStateAt'>,
  livePresence?: LivePresenceSummary
): 'offline' | 'loggedOut' | null => {
  const adminOverrideAt = user.adminPresenceStateAt || 0;
  if (!adminOverrideAt || !user.adminPresenceState) return null;

  const loginTime = user.lastLoginAt || 0;
  const forceLogoutTime = user.forceLogoutAt || 0;
  const latestLiveSignalAt = getLatestLivePresenceSignalAt(livePresence);

  // A manual correction wins over stale/ghost sessions that were recorded
  // before the correction. A genuinely new login or a later live write
  // automatically restores real-time presence.
  if (adminOverrideAt <= loginTime || adminOverrideAt < forceLogoutTime || adminOverrideAt < latestLiveSignalAt) {
    return null;
  }
  return user.adminPresenceState;
};

const getEffectiveConnectionCount = (
  user: Pick<AppUserInfo, 'lastLoginAt' | 'forceLogoutAt' | 'adminPresenceState' | 'adminPresenceStateAt'>,
  livePresence?: LivePresenceSummary
) => getEffectiveAdminPresenceOverride(user, livePresence) ? 0 : (livePresence?.connectionCount || 0);

const getPresenceState = (
  user: Pick<AppUserInfo, 'lastSeenAt' | 'lastLoginAt' | 'lastLogoutAt' | 'forceLogoutAt' | 'adminPresenceState' | 'adminPresenceStateAt'>,
  livePresence?: LivePresenceSummary,
  now = Date.now()
): PresenceState => {
  const effectiveOverride = getEffectiveAdminPresenceOverride(user, livePresence);
  if (effectiveOverride === 'loggedOut') return 'loggedOut';
  if (effectiveOverride === 'offline') return 'offline';

  // Real-time presence wins only when it is newer than an administrator's
  // manual correction. This prevents a stale ghost tab from blocking the
  // requested offline/logged-out display forever.
  if (livePresence?.state === 'active') return 'active';
  if (livePresence?.state === 'away') return 'away';
  if (livePresence?.state === 'background') return 'background';

  const loginTime = user.lastLoginAt || 0;

  if (isForceLoggedOut(user)) return 'forced';

  const logoutTime = user.lastLogoutAt || 0;
  const latestActualActivity = Math.max(
    livePresence?.lastActivityAt || 0,
    loginTime
  );
  // lastSeenAt is a connection/disconnect timestamp, not proof of user activity.
  // Comparing logout against it made a normal logout appear as offline.
  if (logoutTime > 0 && logoutTime >= latestActualActivity) return 'loggedOut';

  const offlineSince = Math.max(
    livePresence?.lastSeenAt || 0,
    user.lastSeenAt || 0,
    livePresence?.lastActivityAt || 0,
    loginTime
  );
  if (offlineSince > 0 && now - offlineSince >= OFFLINE_TO_LOGGED_OUT_MS) return 'loggedOut';
  return 'offline';
};

const getProviderKind = (user: AppUserInfo): ProviderKind => {
  if (user.authDeleted || user.authDeletedAt) return 'deleted';
  const providers = user.providerIds || [];
  const hasGoogle = providers.includes('google.com');
  const hasPassword = providers.includes('password');
  if (hasGoogle && hasPassword) return 'linked';
  if (hasGoogle) return 'google';
  if (hasPassword) return 'email';
  return 'unknown';
};

const AuthAccountMark = ({ user }: { user: AppUserInfo }) => {
  const provider = getProviderKind(user);
  if (provider === 'deleted') {
    return <UserRoundX className="w-5 h-5 text-red-300" />;
  }

  if (provider === 'google') {
    return <span className="text-[18px] font-black tracking-[-0.04em] text-sky-300" title="Google 인증 회원" aria-label="Google 인증 회원">G</span>;
  }

  if (provider === 'email') {
    const isVerified = user.emailVerified === true;
    return (
      <span
        className={cn('text-[18px] font-black tracking-[-0.04em]', isVerified ? 'text-pink-400' : 'text-white')}
        title={isVerified ? '이메일 인증 회원' : '이메일 미인증 회원'}
        aria-label={isVerified ? '이메일 인증 회원' : '이메일 미인증 회원'}
      >
        E
      </span>
    );
  }

  if (provider === 'linked') {
    const isEmailVerified = user.emailVerified === true;
    return (
      <span className="inline-flex items-center gap-0.5 text-[16px] font-black tracking-[-0.06em]" title="Google·이메일 연결 회원" aria-label="Google·이메일 연결 회원">
        <span className="text-sky-300">G</span>
        <span className={isEmailVerified ? 'text-pink-400' : 'text-white'}>E</span>
      </span>
    );
  }

  return <span className="text-[18px] font-black text-white" title="가입 방식 확인 필요" aria-label="가입 방식 확인 필요">?</span>;
};

const getRecentActivityAt = (
  user: Pick<AppUserInfo, 'lastSeenAt' | 'lastLoginAt' | 'lastLogoutAt' | 'forceLogoutAt' | 'adminPresenceState' | 'adminPresenceStateAt'>,
  livePresence?: LivePresenceSummary
) => {
  const presence = getPresenceState(user, livePresence);
  let latest = 0;

  if (presence === 'active' || presence === 'away' || presence === 'background') {
    // A disconnect timestamp is not user activity. Mixing lastSeenAt here caused
    // idle users to jump from 5 minutes ago back to just now after reconnects.
    latest = Math.max(
      livePresence?.lastActivityAt || 0,
      user.lastSeenAt || 0,
      user.lastLoginAt || 0
    );
  } else if (presence === 'forced') {
    latest = Math.max(user.forceLogoutAt || 0, user.lastLogoutAt || 0, user.lastSeenAt || 0);
  } else if (presence === 'loggedOut') {
    latest = Math.max(user.adminPresenceStateAt || 0, user.lastLogoutAt || 0, livePresence?.lastSeenAt || 0, user.lastSeenAt || 0, user.lastLoginAt || 0);
  } else {
    latest = Math.max(user.adminPresenceStateAt || 0, livePresence?.lastSeenAt || 0, user.lastSeenAt || 0, livePresence?.lastActivityAt || 0, user.lastLoginAt || 0);
  }

  return latest > 0 ? latest : undefined;
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return '기록 없음';
  return new Date(timestamp).toLocaleString('ko-KR');
};

const formatLastSeen = (timestamp?: number, now = Date.now()) => {
  if (!timestamp) return '기록 없음';
  const diff = Math.max(0, now - timestamp);
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(timestamp).toLocaleDateString('ko-KR');
};

const parseUserDocument = (uid: string, data: Record<string, any>): AppUserInfo => ({
  uid,
  email: data.email || null,
  displayName: data.displayName || null,
  nickname: data.nickname || null,
  role: (data.role as UserRole) || 'free',
  staffRole: normalizeStaffRole(data),
  adminPermissions: normalizeAdminPermissions(data),
  staffBaseRole: data.staffBaseRole || null,
  staffRoleUpdatedAt: data.staffRoleUpdatedAt ? getTimestampMs(data.staffRoleUpdatedAt) : undefined,
  staffRoleUpdatedBy: data.staffRoleUpdatedBy || null,
  accountStatus: (data.accountStatus as AccountStatus) || 'active',
  paymentStatus: (data.paymentStatus as PaymentStatus) || 'none',
  createdAt: getTimestampMs(data.createdAt || Date.now()),
  lastLoginAt: data.lastLoginAt ? getTimestampMs(data.lastLoginAt) : undefined,
  lastLogoutAt: data.lastLogoutAt ? getTimestampMs(data.lastLogoutAt) : undefined,
  isOnline: Boolean(data.isOnline),
  lastSeenAt: data.lastSeenAt ? getTimestampMs(data.lastSeenAt) : undefined,
  forceLogoutAt: data.forceLogoutAt ? getTimestampMs(data.forceLogoutAt) : undefined,
  adminPresenceState: data.adminPresenceState === 'offline' || data.adminPresenceState === 'loggedOut'
    ? data.adminPresenceState
    : null,
  adminPresenceStateAt: data.adminPresenceStateAt ? getTimestampMs(data.adminPresenceStateAt) : undefined,
  adminPresenceStateBy: data.adminPresenceStateBy || null,
  providerIds: Array.isArray(data.providerIds) ? data.providerIds : [],
  emailVerified: typeof data.emailVerified === 'boolean' ? data.emailVerified : undefined,
  authDisabled: Boolean(data.authDisabled),
  authLastSignInAt: data.authLastSignInAt
    ? getTimestampMs(data.authLastSignInAt)
    : data.lastLoginAt
      ? getTimestampMs(data.lastLoginAt)
      : undefined,
  authDeleted: Boolean(data.authDeleted),
  authDeletedAt: data.authDeletedAtMs
    ? Number(data.authDeletedAtMs)
    : data.authDeletedAt
      ? getTimestampMs(data.authDeletedAt)
      : undefined,
  authDeletedEmail: data.authDeletedEmail || null,
  emailVerificationResetAt: data.emailVerificationResetAtMs
    ? Number(data.emailVerificationResetAtMs)
    : data.emailVerificationResetAt
      ? getTimestampMs(data.emailVerificationResetAt)
      : undefined,
  planName: data.planName,
  planStartAt: data.planStartAt ? getTimestampMs(data.planStartAt) : undefined,
  planExpireAt: data.planExpireAt ? getTimestampMs(data.planExpireAt) : undefined,
  nextBillingAt: data.nextBillingAt ? getTimestampMs(data.nextBillingAt) : undefined,
  lastPaymentAt: data.lastPaymentAt ? getTimestampMs(data.lastPaymentAt) : undefined,
  songGeneratedCount: Number(data.songGeneratedCount || 0),
  favoriteCount: Number(data.favoriteCount || 0),
  adminMemo: data.adminMemo || '',
});

const StaffBadge = ({ user }: { user: AppUserInfo }) => {
  const staffRole = normalizeStaffRole(user);
  if (staffRole === 'master') return <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black text-amber-300">MASTER</span>;
  if (staffRole === 'admin') return <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-black text-red-300">ADMIN</span>;
  return null;
};

const ProviderBadge = ({ user }: { user: AppUserInfo }) => {
  const kind = getProviderKind(user);
  const config: Record<ProviderKind, { label: string; className: string; symbol: React.ReactNode }> = {
    google: {
      label: 'Google',
      className: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
      symbol: <span className="font-black text-[10px]">G</span>,
    },
    email: {
      label: '이메일',
      className: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
      symbol: <Mail className="w-3 h-3" />,
    },
    linked: {
      label: 'Google + 이메일',
      className: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300',
      symbol: <span className="font-black text-[10px]">G+</span>,
    },
    unknown: {
      label: '확인 필요',
      className: 'border-zinc-400/20 bg-zinc-400/10 text-zinc-400',
      symbol: <AlertCircle className="w-3 h-3" />,
    },
    deleted: {
      label: '탈퇴 계정',
      className: 'border-red-400/25 bg-red-400/10 text-red-300',
      symbol: <UserRoundX className="w-3 h-3" />,
    },
  };
  const current = config[kind];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black', current.className)}>
      {current.symbol}
      {current.label}
    </span>
  );
};

const VerificationBadge = ({ user }: { user: AppUserInfo }) => {
  const provider = getProviderKind(user);
  if (provider === 'deleted') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-black text-red-300"><BadgeX className="w-3 h-3" />탈퇴됨</span>;
  }
  if (provider === 'google') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300"><BadgeCheck className="w-3 h-3" />Google 확인</span>;
  }
  if (user.emailVerified === true) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300"><BadgeCheck className="w-3 h-3" />이메일 인증</span>;
  }
  if (user.emailVerified === false && (provider === 'email' || provider === 'linked')) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black text-amber-300"><BadgeX className="w-3 h-3" />미인증</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-zinc-400/20 bg-zinc-400/10 px-2.5 py-1 text-[10px] font-black text-zinc-400"><AlertCircle className="w-3 h-3" />확인 필요</span>;
};

const PresenceBadge = ({ user, livePresence, displayMode = 'ready' }: { user: AppUserInfo; livePresence?: LivePresenceSummary; displayMode?: PresenceDisplayMode }) => {
  if (user.authDeleted || user.authDeletedAt) {
    return <span className="inline-flex items-center gap-2 text-xs md:text-sm font-black text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />탈퇴됨</span>;
  }
  if (!livePresence && displayMode === 'checking') {
    return <span className="inline-flex items-center gap-2 text-xs md:text-sm font-black text-sky-300"><Loader2 className="w-3.5 h-3.5 animate-spin" />확인 중</span>;
  }
  if (!livePresence && displayMode === 'error') {
    return <span className="inline-flex items-center gap-2 text-xs md:text-sm font-black text-amber-300"><AlertCircle className="w-3.5 h-3.5" />연결 오류</span>;
  }
  const presence = getPresenceState(user, livePresence);
  const config: Record<PresenceState, { label: string; className: string }> = {
    active: { label: '활동중', className: 'text-emerald-400' },
    away: { label: '자리비움', className: 'text-amber-300' },
    background: { label: '백그라운드', className: 'text-sky-300' },
    offline: { label: '오프라인', className: 'text-zinc-300' },
    loggedOut: { label: '로그아웃', className: 'text-zinc-500' },
    forced: { label: '강제 로그아웃', className: 'text-red-400' },
  };
  const current = config[presence];
  return <span className={cn('inline-flex items-center gap-2 text-xs md:text-sm font-black', current.className)}><span className="w-2 h-2 rounded-full bg-current" />{current.label}</span>;
};


const DevicePresenceList = ({ user, livePresence, now, backendSchemaReady }: { user: AppUserInfo; livePresence?: LivePresenceSummary; now: number; backendSchemaReady: boolean }) => {
  const devices = livePresence?.devices || [];
  const overallPresence = getPresenceState(user, livePresence, now);

  if (devices.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-dashed bg-black/20 px-4 py-5 text-center', backendSchemaReady ? 'border-white/10' : 'border-amber-400/20')}>
        <p className={cn('text-xs font-black', backendSchemaReady ? 'text-zinc-300' : 'text-amber-300')}>
          {backendSchemaReady ? '저장된 기기 기록이 없습니다.' : '기기별 접속 서버가 아직 구버전입니다.'}
        </p>
        <p className="mt-1 text-[10px] font-bold text-zinc-600">
          {backendSchemaReady
            ? '이 버전 적용 후 회원이 다시 접속하면 브라우저별 기록이 자동으로 쌓입니다.'
            : 'getAdminPresence Function과 Realtime Database Rules를 먼저 배포한 뒤 다시 확인해주세요.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {devices.map((device) => {
        const manualOverride = getEffectiveAdminPresenceOverride(user, livePresence);
        const effectiveState: PresenceState = manualOverride
          ? manualOverride
          : (overallPresence === 'forced' || overallPresence === 'loggedOut') && device.state === 'offline'
            ? overallPresence
            : device.state;
        const effectiveConnectionCount = manualOverride ? 0 : device.connectionCount;
        const config: Record<PresenceState, { label: string; className: string; dot: string }> = {
          active: { label: '활동중', className: 'text-emerald-300', dot: 'bg-emerald-400' },
          away: { label: '자리비움', className: 'text-amber-300', dot: 'bg-amber-300' },
          background: { label: '백그라운드', className: 'text-sky-300', dot: 'bg-sky-300' },
          offline: { label: '오프라인', className: 'text-zinc-300', dot: 'bg-zinc-500' },
          loggedOut: { label: '로그아웃', className: 'text-zinc-500', dot: 'bg-zinc-600' },
          forced: { label: '강제 로그아웃', className: 'text-red-300', dot: 'bg-red-400' },
        };
        const current = config[effectiveState];
        const DeviceIcon = device.deviceType === 'mobile' ? Smartphone : device.deviceType === 'tablet' ? Tablet : Monitor;
        const recentAt = Math.max(device.lastActivityAt || 0, device.lastSeenAt || 0) || undefined;

        return (
          <div key={device.deviceId} className="rounded-2xl border border-white/[0.08] bg-black/25 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"><DeviceIcon className="h-4 w-4 text-zinc-300" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="truncate text-xs font-black text-zinc-100">{device.label || '브라우저 기기'}</p>
                  <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-black', current.className)}><span className={cn('h-1.5 w-1.5 rounded-full', current.dot)} />{current.label}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-500">
                  <span>{formatLastSeen(recentAt, now)}</span>
                  {effectiveConnectionCount > 0 && <span className="text-sky-300">열린 탭 {effectiveConnectionCount}개</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function AdminUserManagementPage({ isAdmin: isAdminProp }: { isAdmin?: boolean }) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(Boolean(isAdminProp));
  const [users, setUsers] = useState<AppUserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastUserDoc, setLastUserDoc] = useState<any | null>(null);
  const [cachedLastUserUid, setCachedLastUserUid] = useState<string | null>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [isBackfillingUsers, setIsBackfillingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'loggedIn' | 'loggedOut'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastLoginAt'>('createdAt');
  const [selectedUser, setSelectedUser] = useState<AppUserInfo | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editRole, setEditRole] = useState<UserRole>('free');
  const [editStatus, setEditStatus] = useState<AccountStatus>('active');
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>('none');
  const [editPlanName, setEditPlanName] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeAdminAction, setActiveAdminAction] = useState<AdminAction>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(EMPTY_CONFIRM);
  const [confirmText, setConfirmText] = useState('');
  const [presenceClock, setPresenceClock] = useState(() => Date.now());
  const [presenceRefreshIntervalMs, setPresenceRefreshIntervalMs] = useState<AdminPresenceRefreshInterval>(() => {
    if (typeof window === 'undefined') return ADMIN_PRESENCE_REFRESH_DEFAULT_MS;
    const storedValue = window.localStorage.getItem(ADMIN_PRESENCE_REFRESH_STORAGE_KEY);
    if (storedValue === null) return ADMIN_PRESENCE_REFRESH_DEFAULT_MS;
    const stored = Number(storedValue);
    return ADMIN_PRESENCE_REFRESH_OPTIONS.some((option) => option.value === stored)
      ? stored as AdminPresenceRefreshInterval
      : ADMIN_PRESENCE_REFRESH_DEFAULT_MS;
  });
  const [livePresence, setLivePresence] = useState<Record<string, LivePresenceSummary>>({});
  const [isPresenceSyncing, setIsPresenceSyncing] = useState(false);
  const [presenceSyncError, setPresenceSyncError] = useState<string | null>(null);
  const [hasPresenceSynced, setHasPresenceSynced] = useState(false);
  const [devicePresenceBackendSchemaReady, setDevicePresenceBackendSchemaReady] = useState(false);
  const [localPresenceDiagnostic, setLocalPresenceDiagnostic] = useState<PresenceDiagnostic | null>(() => readPresenceDiagnostic(auth.currentUser?.uid || ''));
  const [visibleCount, setVisibleCount] = useState(ADMIN_PAGE_SIZE);
  const presenceRequestInFlightRef = useRef(false);
  const detailHistoryRef = useRef(false);

  useEffect(() => {
    if (isAdminProp !== undefined) setIsAdmin(isAdminProp);
  }, [isAdminProp]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setPresenceClock(Date.now()), PRESENCE_CLOCK_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_PRESENCE_REFRESH_STORAGE_KEY, String(presenceRefreshIntervalMs));
    }
  }, [presenceRefreshIntervalMs]);

  useEffect(() => {
    const uid = auth.currentUser?.uid || '';
    if (!uid) return;
    setLocalPresenceDiagnostic(readPresenceDiagnostic(uid));
    const handleDiagnostic = (event: Event) => {
      const detail = (event as CustomEvent<PresenceDiagnostic>).detail;
      if (detail?.uid === uid) setLocalPresenceDiagnostic(detail);
    };
    window.addEventListener(PRESENCE_DIAGNOSTIC_EVENT, handleDiagnostic);
    return () => window.removeEventListener(PRESENCE_DIAGNOSTIC_EVENT, handleDiagnostic);
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    if (!auth.currentUser || isAdminProp !== undefined) return;
    const uid = auth.currentUser.uid;
    const applyCachedAdmin = () => {
      const profile = readUserProfileCache(uid);
      if (profile) setIsAdmin(normalizeStaffRole(profile) !== null);
    };
    applyCachedAdmin();
    const handleProfileCache = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (detail?.uid === uid) applyCachedAdmin();
    };
    window.addEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
    return () => window.removeEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
  }, [isAdminProp]);

  const persistUserList = useCallback((
    nextUsers: AppUserInfo[],
    nextHasMoreUsers: boolean,
    nextLastUserUid: string | null,
  ) => {
    const adminUid = auth.currentUser?.uid || '';
    if (!adminUid) return;
    writeAdminUserListCache(adminUid, sortBy, {
      users: nextUsers,
      hasMoreUsers: nextHasMoreUsers,
      lastUserUid: nextLastUserUid,
    });
  }, [sortBy]);

  const fetchUsers = useCallback(async (forceServer = false) => {
    if (!isAdmin) return;
    const adminUid = auth.currentUser?.uid || '';
    if (!adminUid) return;

    if (!forceServer) {
      const cached = readAdminUserListCache(adminUid, sortBy);
      if (cached) {
        setUsers(cached.users);
        setLastUserDoc(null);
        setCachedLastUserUid(cached.lastUserUid);
        setHasMoreUsers(cached.hasMoreUsers);
        setVisibleCount(ADMIN_PAGE_SIZE);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    try {
      const snapshot = await getDocs(query(
        collection(db, 'users'),
        orderBy(sortBy, 'desc'),
        limit(ADMIN_PAGE_SIZE)
      ));
      const nextUsers = snapshot.docs.map((item) => parseUserDocument(item.id, item.data()));
      const nextLastUserDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      const nextLastUserUid = nextLastUserDoc?.id || null;
      const nextHasMoreUsers = snapshot.docs.length === ADMIN_PAGE_SIZE;
      setUsers(nextUsers);
      setLastUserDoc(nextLastUserDoc);
      setCachedLastUserUid(nextLastUserUid);
      setHasMoreUsers(nextHasMoreUsers);
      setVisibleCount(ADMIN_PAGE_SIZE);
      persistUserList(nextUsers, nextHasMoreUsers, nextLastUserUid);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      if (error?.code === 'permission-denied') alert('사용자 정보를 불러올 관리자 권한이 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, persistUserList, sortBy]);

  const fetchMoreUsers = useCallback(async () => {
    if (!isAdmin || !hasMoreUsers || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      let cursorDoc = lastUserDoc;
      if (!cursorDoc && cachedLastUserUid) {
        const cursorSnapshot = await getDoc(doc(db, 'users', cachedLastUserUid));
        if (!cursorSnapshot.exists()) {
          await fetchUsers(true);
          return;
        }
        cursorDoc = cursorSnapshot;
        setLastUserDoc(cursorSnapshot);
      }
      if (!cursorDoc) return;

      const snapshot = await getDocs(query(
        collection(db, 'users'),
        orderBy(sortBy, 'desc'),
        startAfter(cursorDoc),
        limit(ADMIN_PAGE_SIZE)
      ));
      const nextUsers = snapshot.docs.map((item) => parseUserDocument(item.id, item.data()));
      const merged = new Map(users.map((user) => [user.uid, user]));
      nextUsers.forEach((user) => merged.set(user.uid, user));
      const mergedUsers = Array.from(merged.values());
      const nextLastUserDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : cursorDoc;
      const nextLastUserUid = nextLastUserDoc?.id || cachedLastUserUid;
      const nextHasMoreUsers = snapshot.docs.length === ADMIN_PAGE_SIZE;
      setUsers(mergedUsers);
      setLastUserDoc(nextLastUserDoc);
      setCachedLastUserUid(nextLastUserUid);
      setHasMoreUsers(nextHasMoreUsers);
      setVisibleCount((count) => count + ADMIN_PAGE_SIZE);
      persistUserList(mergedUsers, nextHasMoreUsers, nextLastUserUid);
    } catch (error: any) {
      console.error('Failed to fetch more users:', error);
      if (error?.code === 'permission-denied') alert('사용자 정보를 더 불러올 관리자 권한이 없습니다.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [cachedLastUserUid, fetchUsers, hasMoreUsers, isAdmin, isLoadingMore, lastUserDoc, persistUserList, sortBy, users]);

  useEffect(() => {
    void fetchUsers(false);
  }, [fetchUsers]);

  useEffect(() => {
    if (!isDetailOpen) {
      detailHistoryRef.current = false;
      return;
    }
    window.history.pushState({ modal: 'admin-user-detail' }, '');
    detailHistoryRef.current = true;
    const close = () => {
      setIsDetailOpen(false);
      detailHistoryRef.current = false;
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('popstate', close);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('popstate', close);
      window.removeEventListener('keydown', keydown);
      if (detailHistoryRef.current) {
        window.history.back();
        detailHistoryRef.current = false;
      }
    };
  }, [isDetailOpen]);

  const usersWithAuth = useMemo(() => users, [users]);

  useEffect(() => {
    if (!selectedUser) return;
    const latest = usersWithAuth.find((user) => user.uid === selectedUser.uid);
    if (latest) setSelectedUser(latest);
  }, [selectedUser?.uid, usersWithAuth]);

  const stats = useMemo(() => {
    let online = 0;
    let google = 0;
    let email = 0;
    let unverified = 0;
    let deleted = 0;
    usersWithAuth.forEach((user) => {
      const provider = getProviderKind(user);
      if (provider === 'deleted') deleted += 1;
      if (provider === 'google') google += 1;
      if (provider === 'email') email += 1;
      if ((provider === 'email' || provider === 'linked') && user.emailVerified === false) unverified += 1;
      const presence = getPresenceState(user, livePresence[user.uid], presenceClock);
      if (presence === 'active' || presence === 'away' || presence === 'background') online += 1;
    });
    return { total: usersWithAuth.length, online, google, email, unverified, deleted };
  }, [livePresence, presenceClock, usersWithAuth]);

  const filteredUsers = useMemo(() => usersWithAuth.filter((user) => {
    const keyword = searchTerm.trim().toLowerCase();
    const provider = getProviderKind(user);
    const matchesSearch = !keyword
      || user.email?.toLowerCase().includes(keyword)
      || user.uid.toLowerCase().includes(keyword)
      || user.displayName?.toLowerCase().includes(keyword)
      || user.nickname?.toLowerCase().includes(keyword);
    const matchesProvider = providerFilter === 'all' || provider === providerFilter;
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.accountStatus === statusFilter;
    const matchesPayment = paymentFilter === 'all' || user.paymentStatus === paymentFilter;
    const presence = getPresenceState(user, livePresence[user.uid], presenceClock);
    const matchesPresence = presenceFilter === 'all'
      || (presenceFilter === 'loggedIn' && (presence === 'active' || presence === 'away' || presence === 'background'))
      || (presenceFilter === 'loggedOut' && (presence === 'offline' || presence === 'loggedOut' || presence === 'forced'));
    const matchesVerification = verificationFilter === 'all'
      || (verificationFilter === 'deleted' && provider === 'deleted')
      || (verificationFilter === 'verified' && provider !== 'deleted' && (provider === 'google' || user.emailVerified === true))
      || (verificationFilter === 'unverified' && provider !== 'deleted' && (provider === 'email' || provider === 'linked') && user.emailVerified === false);
    return matchesSearch && matchesProvider && matchesRole && matchesStatus && matchesPayment && matchesPresence && matchesVerification;
  }), [livePresence, paymentFilter, presenceClock, presenceFilter, providerFilter, roleFilter, searchTerm, statusFilter, usersWithAuth, verificationFilter]);

  useEffect(() => {
    setVisibleCount(ADMIN_PAGE_SIZE);
  }, [paymentFilter, presenceFilter, providerFilter, roleFilter, searchTerm, sortBy, statusFilter, verificationFilter]);

  const visibleUsers = useMemo(() => filteredUsers.slice(0, visibleCount), [filteredUsers, visibleCount]);
  const presenceTargetUids = useMemo(() => Array.from(new Set([
    ...(presenceFilter === 'all' ? visibleUsers : usersWithAuth.slice(0, 50)).map((user) => user.uid),
    ...(selectedUser ? [selectedUser.uid] : []),
  ])).slice(0, 50), [presenceFilter, selectedUser?.uid, usersWithAuth, visibleUsers]);
  const presenceTargetKey = presenceTargetUids.join('|');

  const fetchPresence = useCallback(async () => {
    const targetUids = presenceTargetKey ? presenceTargetKey.split('|') : [];
    if (!isAdmin || !auth.currentUser || targetUids.length === 0 || presenceRequestInFlightRef.current) return;
    presenceRequestInFlightRef.current = true;
    setIsPresenceSyncing(true);
    try {
      const callable = httpsCallable(functions, 'getAdminPresence');
      const response = await callable({ uids: targetUids });
      const payload: any = response.data || {};
      const backendSchemaReady = Number(payload.schemaVersion || 0) >= 2;
      setDevicePresenceBackendSchemaReady(backendSchemaReady);
      const next: Record<string, LivePresenceSummary> = {};
      Object.entries(payload.presence || {}).forEach(([uid, value]) => {
        const raw = value as any;
        const rawState = String(raw?.state || 'offline');
        const state: LivePresenceSummary['state'] = ['active', 'away', 'background', 'offline'].includes(rawState)
          ? rawState as LivePresenceSummary['state']
          : 'offline';
        const devices: DevicePresenceSummary[] = Array.isArray(raw?.devices)
          ? raw.devices.slice(0, 10).map((device: any) => {
            const rawDeviceState = String(device?.state || 'offline');
            const deviceState: DevicePresenceSummary['state'] = ['active', 'away', 'background', 'offline'].includes(rawDeviceState)
              ? rawDeviceState as DevicePresenceSummary['state']
              : 'offline';
            const rawDeviceType = String(device?.deviceType || 'desktop');
            const deviceType: DevicePresenceSummary['deviceType'] = rawDeviceType === 'mobile' || rawDeviceType === 'tablet'
              ? rawDeviceType
              : 'desktop';
            return {
              deviceId: String(device?.deviceId || ''),
              label: String(device?.label || '브라우저 기기'),
              platform: String(device?.platform || ''),
              browser: String(device?.browser || ''),
              deviceType,
              state: deviceState,
              connectionCount: Math.max(0, Number(device?.connectionCount || 0)),
              lastActivityAt: Number(device?.lastActivityAt || 0) || undefined,
              lastSeenAt: Number(device?.lastSeenAt || 0) || undefined,
              updatedAt: Number(device?.updatedAt || 0) || undefined,
            };
          }).filter((device: DevicePresenceSummary) => Boolean(device.deviceId))
          : [];
        next[uid] = {
          state,
          connectionCount: Math.max(0, Number(raw?.connectionCount || 0)),
          deviceCount: Math.max(devices.length, Number.isFinite(Number(raw?.deviceCount)) ? Number(raw.deviceCount) : 0),
          lastActivityAt: Number(raw?.lastActivityAt || 0) || undefined,
          lastSeenAt: Number(raw?.lastSeenAt || 0) || undefined,
          devices,
        };
      });
      setLivePresence((previous) => ({ ...previous, ...next }));
      setPresenceSyncError(null);
      setHasPresenceSynced(true);
      // Use one local clock source so the relative time never moves backward
      // because of a small server/client clock difference.
      setPresenceClock(Date.now());
    } catch (error) {
      console.error('Failed to load Realtime presence:', error);
      setHasPresenceSynced(false);
      setDevicePresenceBackendSchemaReady(false);
      setPresenceSyncError(error?.message || '접속 상태 서버에 연결하지 못했습니다.');
    } finally {
      presenceRequestInFlightRef.current = false;
      setIsPresenceSyncing(false);
    }
  }, [isAdmin, presenceTargetKey]);

  useEffect(() => {
    if (!isAdmin || !presenceTargetKey) return;
    void fetchPresence();
    const intervalId = presenceRefreshIntervalMs > 0
      ? window.setInterval(() => {
        if (document.visibilityState === 'visible') void fetchPresence();
      }, presenceRefreshIntervalMs)
      : null;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void fetchPresence();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchPresence, isAdmin, presenceRefreshIntervalMs, presenceTargetKey]);

  const presenceDisplayMode: PresenceDisplayMode = presenceSyncError
    ? 'error'
    : hasPresenceSynced
      ? 'ready'
      : 'checking';

  const presenceRefreshLabel = presenceRefreshIntervalMs === 0
    ? '자동 확인 꺼짐'
    : `${ADMIN_PRESENCE_REFRESH_OPTIONS.find((option) => option.value === presenceRefreshIntervalMs)?.label || '60초'} 자동 확인`;

  const currentAdminUid = auth.currentUser?.uid || '';
  const currentAdminUser = usersWithAuth.find((item) => item.uid === currentAdminUid);
  const currentAdminCachedProfile = currentAdminUid ? readUserProfileCache(currentAdminUid) : null;
  const currentAdminIsMaster = normalizeStaffRole(currentAdminCachedProfile || currentAdminUser) === 'master';
  const currentAdminLive = currentAdminUid ? livePresence[currentAdminUid] : undefined;

  const getBadgeInfo = (user: AppUserInfo) => {
    if (user.authDeleted || user.authDeletedAt) return { label: '탈퇴됨', className: 'text-red-300', dot: 'bg-red-400' };
    const effectivePresence = getPresenceState(user, livePresence[user.uid], presenceClock);
    if (effectivePresence === 'forced') return { label: '강제 로그아웃', className: 'text-red-300', dot: 'bg-red-400' };
    const inactiveDays = getDayDiff(user.lastLoginAt, presenceClock);
    if (inactiveDays >= DORMANT_DAYS) return { label: '휴면회원', className: 'text-red-300', dot: 'bg-red-400' };
    if (inactiveDays >= LONG_INACTIVE_DAYS) return { label: '장기 미접속', className: 'text-orange-300', dot: 'bg-orange-400' };
    if (user.accountStatus === 'banned') return { label: '정지', className: 'text-red-300', dot: 'bg-red-400' };
    return { label: STATUS_LABELS[user.accountStatus], className: 'text-emerald-300', dot: 'bg-emerald-400' };
  };

  const openDetail = (user: AppUserInfo) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.accountStatus);
    setEditPaymentStatus(user.paymentStatus || 'none');
    setEditPlanName(user.planName || '');
    setEditMemo(user.adminMemo || '');
    setSaveStatus('idle');
    setActionResult(null);
    setIsDetailOpen(true);
  };

  const closeConfirm = () => {
    setConfirmModal(EMPTY_CONFIRM);
    setConfirmText('');
  };

  const refreshAfterAction = async (targetUid: string) => {
    const freshSnapshot = await getDoc(doc(db, 'users', targetUid));
    if (freshSnapshot.exists()) {
      const freshUser = parseUserDocument(targetUid, freshSnapshot.data());
      const nextUsers = users.map((user) => user.uid === targetUid ? freshUser : user);
      setUsers(nextUsers);
      persistUserList(nextUsers, hasMoreUsers, cachedLastUserUid);
      setSelectedUser(freshUser);
    }
  };

  const executeUpdate = async () => {
    if (!selectedUser || selectedUser.authDeleted) return;
    setIsSaving(true);
    setSaveStatus('idle');
    closeConfirm();
    try {
      const selectedStaffRole = normalizeStaffRole(selectedUser);
      const promotedToAdmin = currentAdminIsMaster && selectedStaffRole !== 'master' && editRole === 'admin' && selectedStaffRole !== 'admin';
      const demotedFromAdmin = currentAdminIsMaster && selectedStaffRole === 'admin' && editRole !== 'admin';

      if (promotedToAdmin || demotedFromAdmin) {
        const callable = httpsCallable(functions, 'masterSetAdminAccess');
        await callable({
          targetUid: selectedUser.uid,
          staffRole: promotedToAdmin ? 'admin' : null,
          adminPermissions: promotedToAdmin ? { ...FULL_ADMIN_PERMISSIONS } : {},
        });
        const signalControlRevision = httpsCallable(functions, 'adminSignalUserControlRevision');
        void signalControlRevision({ targetUid: selectedUser.uid, reason: 'admin-access' }).catch((error) => {
          console.warn('Admin access revision signal failed; Firestore listener fallback remains active.', error);
        });
        const masterUid = auth.currentUser?.uid || '';
        if (masterUid) removeAdminStaffListCache(masterUid);
      }

      const updates: Record<string, unknown> = {
        accountStatus: editStatus,
        paymentStatus: editPaymentStatus,
        planName: editPlanName,
        adminMemo: editMemo,
      };
      if (!promotedToAdmin) updates.role = editRole;

      const userControlChanged = editRole !== selectedUser.role || editStatus !== selectedUser.accountStatus;
      await updateDoc(doc(db, 'users', selectedUser.uid), updates);
      if (userControlChanged) {
        const signalControlRevision = httpsCallable(functions, 'adminSignalUserControlRevision');
        void signalControlRevision({ targetUid: selectedUser.uid, reason: 'admin-user-settings' }).catch((error) => {
          console.warn('User control revision signal failed; Firestore listener fallback remains active.', error);
        });
      }
      setSaveStatus('success');
      await refreshAfterAction(selectedUser.uid);
    } catch (error) {
      console.error('Failed to update user:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUser = () => {
    if (!selectedUser || selectedUser.authDeleted) return;
    const isSelf = auth.currentUser?.uid === selectedUser.uid;
    const selectedStaffRole = normalizeStaffRole(selectedUser);
    if (selectedStaffRole && !currentAdminIsMaster) {
      alert('마스터·관리자 계정은 마스터만 수정할 수 있습니다.');
      return;
    }
    if (selectedStaffRole === 'master' && (editRole !== selectedUser.role || editStatus !== selectedUser.accountStatus)) {
      alert('마스터 계정의 등급과 계정 상태는 변경할 수 없습니다.');
      return;
    }
    if (isSelf && selectedUser.role === 'admin' && editRole !== 'admin') {
      alert('자기 자신의 관리자 권한은 해제할 수 없습니다.');
      return;
    }
    if (isSelf && editStatus !== 'active') {
      alert('자기 자신의 계정 상태는 제한할 수 없습니다.');
      return;
    }
    const adminCount = usersWithAuth.filter((user) => normalizeStaffRole(user) !== null && !user.authDeleted).length;
    if (adminCount <= 1 && selectedUser.role === 'admin' && editRole !== 'admin') {
      alert('마지막 관리자 권한은 해제할 수 없습니다.');
      return;
    }
    const needsConfirm = editRole !== selectedUser.role || editStatus !== selectedUser.accountStatus;
    if (!needsConfirm) {
      void executeUpdate();
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: '회원 설정 변경',
      message: '회원 등급 또는 계정 상태 변경은 즉시 적용됩니다.',
      confirmLabel: '변경 적용',
      tone: 'brand',
      onConfirm: executeUpdate,
    });
  };

  const runAdminCallable = async (action: Exclude<AdminAction, null>, functionName: string, payload: Record<string, unknown>, successMessage: string) => {
    if (!selectedUser) return;
    closeConfirm();
    setActiveAdminAction(action);
    setActionResult(null);
    try {
      const callable = httpsCallable(functions, functionName);
      await callable(payload);
      if (action === 'forceLogout' || action === 'resetEmail' || action === 'deleteUser') {
        const signalControlRevision = httpsCallable(functions, 'adminSignalUserControlRevision');
        void signalControlRevision({ targetUid: selectedUser.uid, reason: action }).catch((error) => {
          console.warn('User control revision signal failed; Firestore listener fallback remains active.', error);
        });
      }
      setActionResult({ success: true, message: successMessage });
      await refreshAfterAction(selectedUser.uid);
    } catch (error: any) {
      console.error(`${functionName} failed:`, error);
      setActionResult({ success: false, message: error?.message || '관리자 작업에 실패했습니다.' });
    } finally {
      setActiveAdminAction(null);
    }
  };

  const requestPresenceOverride = (state: 'offline' | 'loggedOut' | null) => {
    if (!selectedUser) return;
    const label = state === 'offline' ? '오프라인' : state === 'loggedOut' ? '로그아웃' : '자동 판정';
    setConfirmModal({
      isOpen: true,
      title: `접속 상태 · ${label}`,
      message: state
        ? `${label}으로 표시를 보정합니다. 현재 남아 있는 오래된 접속 기록보다 이 보정이 우선하며, 이후 새 로그인이나 새 활동이 감지되면 자동으로 실제 상태로 돌아갑니다.`
        : '수동 보정을 해제하고 실시간 접속 기록과 2일 자동 판정 기준으로 되돌립니다.',
      confirmLabel: '상태 적용',
      tone: 'brand',
      onConfirm: async () => {
        if (!selectedUser || !auth.currentUser) return;
        closeConfirm();
        setActiveAdminAction('setPresence');
        setActionResult(null);
        try {
          const updates: Record<string, unknown> = {
            adminPresenceState: state,
            adminPresenceStateAt: state ? serverTimestamp() : null,
            adminPresenceStateBy: state ? auth.currentUser.uid : null,
          };
          if (state) updates.isOnline = false;
          await updateDoc(doc(db, 'users', selectedUser.uid), updates);
          setActionResult({ success: true, message: state ? `${label} 표시로 보정했습니다.` : '접속 상태를 자동 판정으로 되돌렸습니다.' });
          await refreshAfterAction(selectedUser.uid);
        } catch (error: any) {
          console.error('Presence override failed:', error);
          setActionResult({ success: false, message: error?.message || '접속 상태 보정에 실패했습니다.' });
        } finally {
          setActiveAdminAction(null);
        }
      },
    });
  };

  const requestForceLogout = () => {
    if (!selectedUser) return;
    setConfirmModal({
      isOpen: true,
      title: '강제 로그아웃',
      message: '현재 로그인 세션을 종료하고 갱신 토큰을 무효화합니다. 회원은 다시 로그인할 수 있습니다.',
      confirmLabel: '로그아웃 실행',
      tone: 'danger',
      onConfirm: () => runAdminCallable('forceLogout', 'adminForceLogoutUser', { targetUid: selectedUser.uid }, '강제 로그아웃이 완료되었습니다.'),
    });
  };

  const requestEmailVerificationReset = () => {
    if (!selectedUser) return;
    setConfirmModal({
      isOpen: true,
      title: '이메일 인증 초기화',
      message: '인증 완료 상태를 미인증으로 되돌리고 현재 세션을 종료합니다. 다음 로그인 때 이메일 인증을 다시 받아야 합니다.',
      confirmLabel: '인증 초기화',
      tone: 'danger',
      onConfirm: () => runAdminCallable('resetEmail', 'adminResetEmailVerification', { targetUid: selectedUser.uid }, '이메일 인증이 초기화되었습니다. 다음 로그인 때 재인증이 필요합니다.'),
    });
  };

  const requestDeleteUser = () => {
    if (!selectedUser) return;
    const requiredText = selectedUser.email || selectedUser.authDeletedEmail || selectedUser.uid;
    setConfirmText('');
    setConfirmModal({
      isOpen: true,
      title: '강제 탈퇴 · Auth 계정 삭제',
      message: 'Firebase 로그인 계정과 저장된 개인 API 키를 삭제합니다. 생성곡·뮤직노트·플레이리스트는 실수 방지를 위해 보존되며, 삭제된 계정으로는 다시 로그인할 수 없습니다.',
      confirmLabel: '강제 탈퇴 실행',
      tone: 'danger',
      requiredText,
      onConfirm: () => runAdminCallable('deleteUser', 'adminDeleteUserAccount', {
        targetUid: selectedUser.uid,
        confirmEmail: selectedUser.email || selectedUser.authDeletedEmail || '',
      }, '강제 탈퇴가 완료되었습니다. 로그인 계정은 삭제되고 사용자 콘텐츠는 보존됩니다.'),
    });
  };

  const requestBackfillMissingUsers = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Auth 누락회원 복구',
      message: 'Firebase Authentication에는 있지만 Firestore 회원목록에 없는 계정만 복구합니다. 기존 회원 정보는 덮어쓰지 않습니다.',
      confirmLabel: '누락회원 복구',
      tone: 'brand',
      onConfirm: async () => {
        closeConfirm();
        setIsBackfillingUsers(true);
        try {
          const callable = httpsCallable(functions, 'backfillMissingAuthUsers');
          const response = await callable({ dryRun: false });
          const data: any = response.data || {};
          const failedCount = Array.isArray(data.failedUsers) ? data.failedUsers.length : 0;
          setActionResult({
            success: failedCount === 0,
            message: `누락 ${Number(data.missingUserDocs || 0)}명 중 ${Number(data.createdUserDocs || 0)}명을 복구했습니다. 실패 ${failedCount}명`,
          });
          await fetchUsers(true);
        } catch (error: any) {
          console.error('backfillMissingAuthUsers failed:', error);
          setActionResult({ success: false, message: error?.message || '누락회원 복구에 실패했습니다.' });
        } finally {
          setIsBackfillingUsers(false);
        }
      },
    });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-black text-[var(--text-primary)]">접근 권한이 없습니다</h1>
          <button onClick={() => navigate('/')} className="px-6 py-3 rounded-2xl bg-brand-orange text-white font-bold">홈으로</button>
        </div>
      </div>
    );
  }

  const selectedProvider = selectedUser ? getProviderKind(selectedUser) : 'unknown';
  const selectedIsProtected = Boolean(selectedUser && (normalizeStaffRole(selectedUser) !== null || auth.currentUser?.uid === selectedUser.uid));
  const canResetEmailVerification = Boolean(
    selectedUser
      && selectedProvider === 'email'
      && selectedUser.emailVerified === true
      && !selectedIsProtected
      && !selectedUser.authDeleted
      && !selectedUser.authDeletedAt
  );

  const metricCards = [
    { label: '불러온 회원', value: stats.total, icon: Users, className: 'text-white' },
    { label: '현재 접속', value: stats.online, icon: Activity, className: 'text-emerald-300' },
    { label: 'Google 가입', value: stats.google, icon: BadgeCheck, className: 'text-sky-300' },
    { label: '이메일 가입', value: stats.email, icon: Mail, className: 'text-violet-300' },
    { label: '이메일 미인증', value: stats.unverified, icon: BadgeX, className: 'text-amber-300' },
    { label: '강제 탈퇴', value: stats.deleted, icon: UserRoundX, className: 'text-red-300' },
  ];

  return (
    <AdminPageLayout
      title="회원 관리"
      description="가입 방식, 이메일 인증, 등급과 계정 상태를 한 화면에서 관리합니다."
      actions={(
        <div className="flex items-center gap-2">
          <button
            onClick={requestBackfillMissingUsers}
            disabled={isBackfillingUsers}
            className="hidden md:inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-black text-[var(--text-secondary)] hover:bg-white/[0.07] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {isBackfillingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            누락 복구
          </button>
          <button
            onClick={() => { void fetchUsers(true); void fetchPresence(); }}
            disabled={isLoading || isLoadingMore || isPresenceSyncing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-xs font-black text-[var(--text-primary)] hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', (isLoading || isLoadingMore || isPresenceSyncing) && 'animate-spin')} />
            새로고침
          </button>
        </div>
      )}
    >
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {metricCards.map(({ label, value, icon: Icon, className }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.018] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.16)]">
            <div className={cn('flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]', className)}>
              <Icon className="w-3.5 h-3.5" />{label}
            </div>
            <div className="mt-2 text-2xl font-black text-[var(--text-primary)]">{value}<span className="ml-1 text-[10px] text-[var(--text-secondary)]">명</span></div>
          </div>
        ))}
      </section>

      <section className="rounded-[26px] border border-white/10 bg-white/[0.028] p-3 md:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="이름, 이메일, UID 검색"
              className="w-full h-12 rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-brand-orange/60 focus:bg-black/30"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 xl:w-auto">
            <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)} className="h-12 rounded-2xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-[var(--text-primary)] outline-none">
              <option value="all">전체 가입 방식</option>
              <option value="google">Google</option>
              <option value="email">이메일</option>
              <option value="linked">연결 계정</option>
              <option value="unknown">확인 필요</option>
              <option value="deleted">탈퇴 계정</option>
            </select>
            <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value as VerificationFilter)} className="h-12 rounded-2xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-[var(--text-primary)] outline-none">
              <option value="all">전체 인증 상태</option>
              <option value="verified">인증 완료</option>
              <option value="unverified">미인증</option>
              <option value="deleted">탈퇴됨</option>
            </select>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')} className="h-12 rounded-2xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-[var(--text-primary)] outline-none">
              <option value="all">전체 등급</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AccountStatus | 'all')} className="h-12 rounded-2xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-[var(--text-primary)] outline-none">
              <option value="all">전체 계정 상태</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentStatus | 'all')} className="h-12 rounded-2xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-[var(--text-primary)] outline-none">
              <option value="all">전체 결제 상태</option>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value as 'all' | 'loggedIn' | 'loggedOut')} className="h-12 rounded-2xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-[var(--text-primary)] outline-none">
              <option value="all">전체 접속 상태</option>
              <option value="loggedIn">접속·자리비움</option>
              <option value="loggedOut">로그아웃</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'createdAt' | 'lastLoginAt')} className="h-12 rounded-2xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-[var(--text-primary)] outline-none col-span-2 md:col-span-1">
              <option value="createdAt">가입일순</option>
              <option value="lastLoginAt">최근 접속순</option>
            </select>
          </div>
        </div>
        <div className="mt-3 grid gap-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3 text-xs font-bold text-[var(--text-secondary)] md:grid-cols-[auto_1fr_auto] md:items-center">
          <span>불러온 {usersWithAuth.length}명 중 검색 결과 {filteredUsers.length}명</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              회원 문서 인증정보 사용 · 전체 Auth 자동조회 없음
            </span>
            <span className={cn('inline-flex items-center gap-2', presenceSyncError ? 'text-amber-300' : hasPresenceSynced ? 'text-sky-300' : 'text-zinc-300')}>
              {isPresenceSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : presenceSyncError ? <AlertCircle className="w-3.5 h-3.5" /> : hasPresenceSynced ? <Activity className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isPresenceSyncing ? '접속 상태 확인 중' : presenceSyncError || (hasPresenceSynced ? `접속 상태 서버 연결됨 · ${presenceRefreshLabel}` : '접속 상태 첫 확인 중')}
            </span>
            {localPresenceDiagnostic && (
              <span className={cn('inline-flex items-center gap-2', localPresenceDiagnostic.status === 'connected' ? 'text-emerald-300' : localPresenceDiagnostic.status === 'error' ? 'text-amber-300' : 'text-zinc-300')}>
                {localPresenceDiagnostic.status === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : localPresenceDiagnostic.status === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                현재 기기: {localPresenceDiagnostic.status === 'connected' ? '기록 정상' : localPresenceDiagnostic.status === 'error' ? '자동 재연결 중' : '연결 준비 중'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
            {currentAdminUser && <PresenceBadge user={currentAdminUser} livePresence={currentAdminLive} displayMode={presenceDisplayMode} />}
            <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-black text-zinc-300">
              <span className="whitespace-nowrap">자동 갱신</span>
              <select
                value={presenceRefreshIntervalMs}
                onChange={(event) => setPresenceRefreshIntervalMs(Number(event.target.value) as AdminPresenceRefreshInterval)}
                className="h-7 rounded-lg border border-white/10 bg-[#171717] px-2 text-[11px] font-black text-zinc-100 outline-none focus:border-brand-orange/40"
                aria-label="접속 상태 자동 갱신 주기"
              >
                {ADMIN_PRESENCE_REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void fetchPresence()} disabled={isPresenceSyncing} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-zinc-200 hover:border-brand-orange/30 hover:text-brand-orange disabled:opacity-50">지금 확인</button>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        {isLoading ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.025] py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange mx-auto" />
            <p className="mt-3 text-sm font-bold text-[var(--text-secondary)]">회원 정보를 불러오는 중입니다.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.025] py-20 text-center text-sm font-bold text-[var(--text-secondary)]">조건에 맞는 회원이 없습니다.</div>
        ) : visibleUsers.map((user) => {
          const badge = getBadgeInfo(user);
          const live = livePresence[user.uid];
          const presence = getPresenceState(user, live, presenceClock);
          const presenceDot = presence === 'active'
            ? 'bg-emerald-400'
            : presence === 'away'
              ? 'bg-amber-300'
              : presence === 'background'
                ? 'bg-sky-300'
                : presence === 'forced'
                  ? 'bg-red-400'
                  : presence === 'loggedOut'
                    ? 'bg-zinc-600'
                    : 'bg-zinc-500';
          const recentTime = getRecentActivityAt(user, live);
          const recentTimeClassName = presence === 'loggedOut' ? 'text-zinc-500' : 'text-zinc-300';
          return (
            <button
              key={user.uid}
              onClick={() => openDetail(user)}
              className="group w-full rounded-[22px] border border-white/10 bg-gradient-to-r from-white/[0.045] to-white/[0.018] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand-orange/35 hover:bg-white/[0.065] hover:shadow-[0_18px_45px_rgba(0,0,0,0.22)]"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className={cn('relative w-11 h-11 md:w-12 md:h-12 rounded-2xl border flex items-center justify-center shrink-0', user.authDeleted ? 'border-red-400/20 bg-red-400/10' : 'border-white/10 bg-black/20')}>
                  <AuthAccountMark user={user} />
                  <span className={cn('absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-[#181818]', presenceDot)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('truncate text-sm md:text-base font-black', user.authDeleted ? 'text-zinc-500 line-through' : 'text-[var(--text-primary)]')}>{user.displayName || user.nickname || '이름 없음'}</span>
                    <StaffBadge user={user} />
                    {normalizeStaffRole(user) === null && <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase', user.role === 'pro' ? 'bg-orange-500/15 text-orange-300' : user.role === 'basic' ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-500/15 text-zinc-400')}>{ROLE_LABELS[user.role]}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{user.email || user.authDeletedEmail || '이메일 없음'}</span>
                    <span className={cn('inline-flex items-center gap-1 font-bold', badge.className)}><span className={cn('w-1.5 h-1.5 rounded-full', badge.dot)} />{badge.label}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 md:hidden">
                    <div className="min-w-0"><PresenceBadge user={user} livePresence={live} displayMode={presenceDisplayMode} />{Boolean(live?.deviceCount) && <p className="mt-0.5 text-[9px] font-bold text-amber-300">{live.deviceCount}개 기기</p>}</div>
                    <span className={cn('inline-flex items-center gap-1 text-xs font-black', recentTimeClassName)}><Clock className="w-3.5 h-3.5" />{formatLastSeen(recentTime, presenceClock)}</span>
                  </div>
                </div>
                <div className="hidden md:flex w-44 flex-col items-end gap-1.5 shrink-0">
                  <PresenceBadge user={user} livePresence={live} displayMode={presenceDisplayMode} />
                  <span className={cn('text-xs font-black', recentTimeClassName)}>{formatLastSeen(recentTime, presenceClock)}</span>
                  {Boolean(live?.deviceCount) && <span className="text-[10px] font-bold text-amber-300">{live.deviceCount}개 기기</span>}
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-brand-orange" />
              </div>
            </button>
          );
        })}
        {(visibleCount < filteredUsers.length || hasMoreUsers) && (
          <button
            type="button"
            onClick={() => {
              if (visibleCount < filteredUsers.length) {
                setVisibleCount((count) => count + ADMIN_PAGE_SIZE);
                return;
              }
              void fetchMoreUsers();
            }}
            disabled={isLoadingMore}
            className="w-full rounded-[20px] border border-white/10 bg-white/[0.025] py-3 text-xs font-black text-zinc-300 hover:border-brand-orange/30 hover:text-brand-orange disabled:opacity-50"
          >
            {isLoadingMore
              ? '다음 회원을 불러오는 중...'
              : visibleCount < filteredUsers.length
                ? `다음 ${Math.min(ADMIN_PAGE_SIZE, filteredUsers.length - visibleCount)}명 더 보기`
                : `다음 ${ADMIN_PAGE_SIZE}명 서버에서 불러오기`}
          </button>
        )}
      </section>

      <AnimatePresence>
        {isDetailOpen && selectedUser && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center p-3 md:p-6" onClick={() => setIsDetailOpen(false)}>
            <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-white/12 bg-[#141414] shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
            >
              <header className="border-b border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent px-5 py-5 md:px-7">
                <div className="flex items-start gap-4">
                  <div className="w-13 h-13 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center shrink-0">
                    {selectedUser.authDeleted ? <UserRoundX className="w-6 h-6 text-red-300" /> : <User className="w-6 h-6 text-zinc-200" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-black text-white">{selectedUser.displayName || selectedUser.nickname || '이름 없음'}</h2>
                      <StaffBadge user={selectedUser} />
                      {normalizeStaffRole(selectedUser) === null && <span className="rounded-lg bg-brand-orange/15 px-2 py-1 text-[10px] font-black uppercase text-brand-orange">{ROLE_LABELS[selectedUser.role]}</span>}
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-zinc-400">{selectedUser.email || selectedUser.authDeletedEmail || '이메일 없음'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5"><ProviderBadge user={selectedUser} /><VerificationBadge user={selectedUser} /></div>
                  </div>
                  <button onClick={() => setIsDetailOpen(false)} className="w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
              </header>

              <div className="overflow-y-auto p-5 md:p-7 space-y-5">
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-400"><Shield className="w-4 h-4 text-brand-orange" />로그인 · 인증</h3>
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">가입 방식</span><ProviderBadge user={selectedUser} /></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">인증 상태</span><VerificationBadge user={selectedUser} /></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">Auth 비활성화</span><span className={cn('font-bold', selectedUser.authDisabled ? 'text-red-300' : 'text-emerald-300')}>{selectedUser.authDisabled ? '예' : '아니오'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">최근 Auth 로그인</span><span className="text-right font-bold text-zinc-200">{formatTimestamp(selectedUser.authLastSignInAt)}</span></div>
                      {selectedUser.emailVerificationResetAt && <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">인증 초기화</span><span className="text-right font-bold text-amber-300">{formatTimestamp(selectedUser.emailVerificationResetAt)}</span></div>}
                      {selectedUser.authDeletedAt && <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">강제 탈퇴</span><span className="text-right font-bold text-red-300">{formatTimestamp(selectedUser.authDeletedAt)}</span></div>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-400"><Activity className="w-4 h-4 text-brand-orange" />활동 정보</h3>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-black/25 p-3"><span className="text-[10px] font-bold text-zinc-500">가입일</span><p className="mt-1 text-xs font-black text-zinc-200">{formatTimestamp(selectedUser.createdAt)}</p></div>
                      <div className="rounded-2xl bg-black/25 p-3">
                        <span className="text-xs font-bold text-zinc-400">최근 활동</span>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <PresenceBadge user={selectedUser} livePresence={livePresence[selectedUser.uid]} displayMode={presenceDisplayMode} />
                          <span className={cn('text-sm font-black', getPresenceState(selectedUser, livePresence[selectedUser.uid], presenceClock) === 'loggedOut' ? 'text-zinc-500' : 'text-zinc-100')}>{formatLastSeen(getRecentActivityAt(selectedUser, livePresence[selectedUser.uid]), presenceClock)}</span>
                          {Boolean(livePresence[selectedUser.uid]?.deviceCount) && <span className="text-[10px] font-bold text-sky-300">{livePresence[selectedUser.uid].deviceCount}개 기기 · 열린 탭 {getEffectiveConnectionCount(selectedUser, livePresence[selectedUser.uid])}개</span>}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/25 p-3"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500"><Music className="w-3 h-3" />생성곡</span><p className="mt-1 text-lg font-black text-white">{selectedUser.songGeneratedCount}</p></div>
                      <div className="rounded-2xl bg-black/25 p-3"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500"><Heart className="w-3 h-3" />뮤직노트</span><p className="mt-1 text-lg font-black text-white">{selectedUser.favoriteCount}</p></div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-400"><Monitor className="w-4 h-4 text-brand-orange" />기기별 접속 현황</h3>
                      <p className="mt-1.5 text-[10px] font-bold leading-relaxed text-zinc-600">같은 컴퓨터라도 Chrome과 Edge는 각각 표시됩니다. 같은 브라우저의 여러 탭은 하나의 기기로 묶고 열린 탭 수만 따로 보여줍니다.</p>
                    </div>
                    {Boolean(livePresence[selectedUser.uid]?.deviceCount) && <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black text-sky-300">총 {livePresence[selectedUser.uid].deviceCount}개</span>}
                  </div>
                  <div className="mt-4">
                    <DevicePresenceList user={selectedUser} livePresence={livePresence[selectedUser.uid]} now={presenceClock} backendSchemaReady={devicePresenceBackendSchemaReady} />
                  </div>
                </section>

                <section className={cn('rounded-3xl bg-white/[0.03] p-5', (selectedUser.authDeleted || selectedUser.authDeletedAt) && 'opacity-60 pointer-events-none')}>
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-400"><Save className="w-4 h-4 text-zinc-500" />회원 설정</h3>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-[10px] font-black text-zinc-500">회원 등급</label>
                      <div className={cn('grid gap-1.5', currentAdminIsMaster ? 'grid-cols-4' : 'grid-cols-3')}>
                        {(Object.keys(ROLE_LABELS) as UserRole[])
                          .filter((role) => currentAdminIsMaster || role !== 'admin')
                          .map((role) => (
                            <button
                              key={role}
                              onClick={() => setEditRole(role)}
                              disabled={normalizeStaffRole(selectedUser) === 'master'}
                              className={cn(
                                'rounded-xl py-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-45',
                                editRole === role
                                  ? 'bg-white/[0.13] text-white ring-1 ring-white/25'
                                  : 'bg-black/20 text-zinc-500 hover:bg-white/[0.055] hover:text-zinc-300'
                              )}
                            >
                              {ROLE_LABELS[role]}
                            </button>
                          ))}
                      </div>
                      {!currentAdminIsMaster && <p className="mt-2 text-[10px] font-bold text-zinc-600">Admin 지정은 마스터만 가능합니다.</p>}
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black text-zinc-500">계정 상태</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(Object.keys(STATUS_LABELS) as AccountStatus[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => setEditStatus(status)}
                            disabled={normalizeStaffRole(selectedUser) === 'master'}
                            className={cn(
                              'rounded-xl py-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-45',
                              editStatus === status
                                ? 'bg-white/[0.13] text-white ring-1 ring-white/25'
                                : 'bg-black/20 text-zinc-500 hover:bg-white/[0.055] hover:text-zinc-300'
                            )}
                          >
                            {STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black text-zinc-500">플랜명</label>
                      <input value={editPlanName} onChange={(event) => setEditPlanName(event.target.value)} placeholder="예: Pro Plan" className="h-11 w-full rounded-2xl bg-black/20 px-4 text-xs text-white outline-none transition focus:bg-white/[0.06]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-black text-zinc-500">결제 상태</label>
                      <select value={editPaymentStatus} onChange={(event) => setEditPaymentStatus(event.target.value as PaymentStatus)} className="h-11 w-full rounded-2xl bg-black/20 px-4 text-xs font-bold text-white outline-none">
                        {Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 flex items-center gap-1.5 text-[10px] font-black text-zinc-500"><FileText className="w-3 h-3" />관리자 메모</label>
                    <textarea value={editMemo} onChange={(event) => setEditMemo(event.target.value)} placeholder="회원 관련 메모를 남겨주세요." className="h-24 w-full resize-none rounded-2xl bg-black/20 p-4 text-xs text-white outline-none transition focus:bg-white/[0.06]" />
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    {saveStatus === 'success' && <span className="mr-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-300"><CheckCircle2 className="w-3.5 h-3.5" />저장 완료</span>}
                    {saveStatus === 'error' && <span className="mr-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-red-300"><AlertCircle className="w-3.5 h-3.5" />저장 실패</span>}
                    <button onClick={handleUpdateUser} disabled={isSaving} className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-5 py-2.5 text-xs font-black text-zinc-950 hover:bg-white disabled:opacity-40">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}설정 저장</button>
                  </div>
                </section>

                <section className={cn('rounded-3xl border border-white/10 bg-white/[0.03] p-5', (selectedUser.authDeleted || selectedUser.authDeletedAt) && 'opacity-60 pointer-events-none')}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-400/10 flex items-center justify-center shrink-0"><Activity className="w-5 h-5 text-sky-300" /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-zinc-100">접속 상태 수동 보정</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">오래된 회원 표시를 정리하는 기능입니다. 실제 접속이 감지되면 활동중·자리비움·백그라운드가 우선하며, 새 로그인 이후에는 수동 보정이 자동으로 무효화됩니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button onClick={() => requestPresenceOverride(null)} disabled={Boolean(activeAdminAction)} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-black text-zinc-300 hover:border-emerald-400/30 hover:text-emerald-300 disabled:opacity-35"><RefreshCw className="w-4 h-4" />자동 판정</button>
                    <button onClick={() => requestPresenceOverride('offline')} disabled={Boolean(activeAdminAction)} className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-400/20 bg-zinc-400/[0.06] px-4 py-3 text-xs font-black text-zinc-200 hover:border-zinc-300/40 disabled:opacity-35"><Activity className="w-4 h-4" />오프라인 표시</button>
                    <button onClick={() => requestPresenceOverride('loggedOut')} disabled={Boolean(activeAdminAction)} className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-600/30 bg-zinc-700/20 px-4 py-3 text-xs font-black text-zinc-400 hover:border-zinc-500/50 hover:text-zinc-300 disabled:opacity-35"><LogOut className="w-4 h-4" />로그아웃 표시</button>
                  </div>
                  <p className="mt-3 text-[10px] font-bold text-zinc-600">오프라인 상태가 2일을 넘으면 기존 회원을 포함해 자동으로 로그아웃으로 표시됩니다. 실제 인증 세션 종료는 아래 강제 로그아웃을 사용합니다.</p>
                </section>

                <section className="rounded-3xl border border-red-400/15 bg-red-400/[0.035] p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-400/10 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-red-300" /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-red-200">관리자 보안 작업</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">관리자 본인과 다른 관리자 계정은 보호됩니다. 강제 탈퇴는 Firebase Auth 계정과 개인 API 키를 삭제하고 사용자 콘텐츠는 보존합니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button onClick={requestForceLogout} disabled={Boolean(activeAdminAction) || selectedIsProtected || Boolean(selectedUser.authDeleted || selectedUser.authDeletedAt)} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-black text-zinc-200 hover:border-amber-400/30 hover:text-amber-200 disabled:opacity-35"><LogOut className="w-4 h-4" />강제 로그아웃</button>
                    <button onClick={requestEmailVerificationReset} disabled={Boolean(activeAdminAction) || !canResetEmailVerification} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-black text-zinc-200 hover:border-violet-400/30 hover:text-violet-200 disabled:opacity-35"><RotateCcw className="w-4 h-4" />이메일 인증 초기화</button>
                    <button onClick={requestDeleteUser} disabled={Boolean(activeAdminAction) || selectedIsProtected || Boolean(selectedUser.authDeleted || selectedUser.authDeletedAt)} className="flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs font-black text-red-200 hover:bg-red-400/20 disabled:opacity-35"><Trash2 className="w-4 h-4" />강제 탈퇴</button>
                  </div>
                  {!canResetEmailVerification && selectedProvider !== 'email' && !selectedUser.authDeleted && <p className="mt-3 text-[10px] font-bold text-zinc-600">이메일 인증 초기화는 순수 이메일·비밀번호 가입 회원에게만 적용됩니다.</p>}
                  <AnimatePresence>{actionResult && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={cn('mt-3 rounded-2xl border px-4 py-3 text-[11px] font-bold', actionResult.success ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-red-400/20 bg-red-400/10 text-red-300')}>{activeAdminAction && <Loader2 className="mr-2 inline w-3.5 h-3.5 animate-spin" />}{actionResult.message}</motion.div>}</AnimatePresence>
                </section>

                <section className="rounded-3xl border border-white/10 bg-black/20 p-4 text-[10px] text-zinc-600">
                  <div className="flex flex-col gap-1"><span>UID: <span className="font-mono text-zinc-400">{selectedUser.uid}</span></span><span>최근 로그인: {formatTimestamp(selectedUser.lastLoginAt)}</span><span>최근 로그아웃: {formatTimestamp(selectedUser.lastLogoutAt)}</span></div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4" onClick={closeConfirm}>
            <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div onClick={(event) => event.stopPropagation()} initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} className="relative w-full max-w-md rounded-[28px] border border-white/12 bg-[#171717] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.7)]">
              <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', confirmModal.tone === 'danger' ? 'bg-red-400/10 text-red-300' : 'bg-brand-orange/10 text-brand-orange')}>{confirmModal.tone === 'danger' ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}</div>
              <h3 className="mt-4 text-lg font-black text-white">{confirmModal.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{confirmModal.message}</p>
              {confirmModal.requiredText && (
                <div className="mt-4 rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-3">
                  <p className="text-[10px] font-bold text-zinc-500">실행하려면 아래 내용을 그대로 입력하세요.</p>
                  <p className="mt-1 break-all font-mono text-xs font-black text-red-200">{confirmModal.requiredText}</p>
                  <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white outline-none focus:border-red-400/50" />
                </div>
              )}
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button onClick={closeConfirm} className="rounded-2xl border border-white/10 bg-white/[0.035] py-3 text-xs font-black text-zinc-300 hover:bg-white/[0.07]">취소</button>
                <button
                  onClick={() => void confirmModal.onConfirm()}
                  disabled={Boolean(confirmModal.requiredText && confirmText.trim() !== confirmModal.requiredText)}
                  className={cn('rounded-2xl py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-30', confirmModal.tone === 'danger' ? 'bg-red-500 hover:bg-red-400' : 'bg-brand-orange hover:brightness-110')}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminPageLayout>
  );
}
