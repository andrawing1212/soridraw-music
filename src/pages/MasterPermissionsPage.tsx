import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle2, Crown, FlaskConical, Loader2, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import { readSplitPerfToolVisibility, writeSplitPerfToolVisibility } from '../components/studio/splitPerfDiagnostics';
import { ADMIN_PERMISSION_DEFINITIONS, FULL_ADMIN_PERMISSIONS, normalizeAdminPermissions, normalizeStaffRole } from '../constants/adminPermissions';
import { cn } from '../lib/utils';
import { auth, db, functions } from '../firebase';
import type { AdminPermissions, AppUserInfo, StaffRole } from '../types';
import { getTimestampMs } from '../App';

const parseUser = (uid: string, data: Record<string, any>): AppUserInfo => ({
  uid,
  email: data.email || null,
  displayName: data.displayName || null,
  nickname: data.nickname || null,
  role: data.role || 'free',
  staffRole: normalizeStaffRole(data),
  adminPermissions: normalizeAdminPermissions(data),
  staffBaseRole: data.staffBaseRole || null,
  accountStatus: data.accountStatus || 'active',
  paymentStatus: data.paymentStatus || 'none',
  createdAt: getTimestampMs(data.createdAt || Date.now()),
  lastLoginAt: data.lastLoginAt ? getTimestampMs(data.lastLoginAt) : undefined,
  songGeneratedCount: Number(data.songGeneratedCount || 0),
  favoriteCount: Number(data.favoriteCount || 0),
  adminMemo: data.adminMemo || '',
});

const samePermissions = (a: AdminPermissions, b: AdminPermissions) =>
  ADMIN_PERMISSION_DEFINITIONS.every(({ key }) => a[key] === b[key]);

type MasterSettingsTab = 'app-test' | 'admin-permissions';

export default function MasterPermissionsPage() {
  const [activeTab, setActiveTab] = useState<MasterSettingsTab>('app-test');
  const [perfToolsVisible, setPerfToolsVisible] = useState(() => readSplitPerfToolVisibility());
  const [admins, setAdmins] = useState<AppUserInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AdminPermissions>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const loadAdmins = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const nextAdmins = snapshot.docs
        .map((item) => parseUser(item.id, item.data()))
        .filter((user) => normalizeStaffRole(user) !== null)
        .sort((a, b) => {
          const order = (role: StaffRole) => role === 'master' ? 0 : 1;
          return order(a.staffRole || null) - order(b.staffRole || null)
            || (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'ko');
        });

      setAdmins(nextAdmins);
      setDrafts(Object.fromEntries(nextAdmins.map((user) => [
        user.uid,
        user.staffRole === 'master'
          ? { ...FULL_ADMIN_PERMISSIONS }
          : { ...normalizeAdminPermissions(user) },
      ])));
    } catch (error: any) {
      console.error('Failed to load admin permissions:', error);
      setMessage({ success: false, text: error?.message || '관리자 권한 목록을 불러오지 못했습니다.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadAdmins(); }, [loadAdmins]);

  const filteredAdmins = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return admins;
    return admins.filter((user) => [user.displayName, user.nickname, user.email, user.uid]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [admins, searchTerm]);

  const updatePermission = (uid: string, key: keyof AdminPermissions) => {
    setDrafts((current) => {
      const base = current[uid] || normalizeAdminPermissions(admins.find((user) => user.uid === uid));
      return { ...current, [uid]: { ...base, [key]: !base[key] } };
    });
    setMessage(null);
  };

  const saveAdmin = async (user: AppUserInfo) => {
    if (user.staffRole === 'master') return;
    const permissions = drafts[user.uid] || normalizeAdminPermissions(user);
    setSavingUid(user.uid);
    setMessage(null);
    try {
      const callable = httpsCallable(functions, 'masterSetAdminAccess');
      await callable({ targetUid: user.uid, staffRole: 'admin', adminPermissions: permissions });
      setMessage({ success: true, text: `${user.displayName || user.email || '관리자'} 권한을 저장했습니다.` });
      await loadAdmins();
    } catch (error: any) {
      console.error('masterSetAdminAccess failed:', error);
      setMessage({ success: false, text: error?.message || '권한 저장에 실패했습니다.' });
    } finally {
      setSavingUid(null);
    }
  };

  const currentUid = auth.currentUser?.uid || '';

  return (
    <AdminPageLayout
      title="마스터 권한"
      description="현재 관리자만 표시하며 페이지별 접근 권한을 설정합니다."
      actions={activeTab === 'admin-permissions' ? (
        <button
          type="button"
          onClick={() => void loadAdmins()}
          disabled={isLoading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 text-xs font-black text-zinc-200 hover:bg-white/[0.10] disabled:opacity-40"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          새로고침
        </button>
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('app-test')}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition',
              activeTab === 'app-test' ? 'bg-zinc-100 text-zinc-950' : 'bg-white/[0.045] text-zinc-400 hover:bg-white/[0.075] hover:text-zinc-100',
            )}
          >
            <FlaskConical className="h-4 w-4" />
            앱 테스트
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin-permissions')}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition',
              activeTab === 'admin-permissions' ? 'bg-zinc-100 text-zinc-950' : 'bg-white/[0.045] text-zinc-400 hover:bg-white/[0.075] hover:text-zinc-100',
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            관리자권한관리
          </button>
        </div>

        {activeTab === 'app-test' ? (
          <div className="rounded-3xl bg-white/[0.035] p-5 md:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-zinc-200">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-zinc-100">Studio 앱 테스트 메뉴</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Studio 우측의 엔진 비교, 생성바 A/B, V2 드래그·Pure Pane 진단 메뉴와 성능 진단 패널을 마스터 계정에서만 표시합니다. 기본값은 OFF이며 이 기기에서만 저장됩니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-pressed={perfToolsVisible}
                onClick={() => {
                  const next = !perfToolsVisible;
                  setPerfToolsVisible(next);
                  writeSplitPerfToolVisibility(next);
                }}
                className={cn(
                  'inline-flex min-w-[116px] items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition',
                  perfToolsVisible ? 'bg-zinc-100 text-zinc-950' : 'bg-black/25 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200',
                )}
              >
                앱 테스트 {perfToolsVisible ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl bg-white/[0.035] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-zinc-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-100">관리자 전용 목록</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                일반 회원은 이 페이지에서 불러오지 않습니다. 관리자 지정과 해제는 회원 관리 상세 화면에서 마스터만 수행합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="관리자 이름, 이메일 또는 UID 검색"
            className="h-12 w-full rounded-2xl bg-white/[0.045] pl-11 pr-4 text-sm text-white outline-none transition focus:bg-white/[0.075]"
          />
        </div>

        {message && (
          <div className={cn(
            'rounded-2xl px-4 py-3 text-xs font-bold',
            message.success ? 'bg-white/[0.065] text-zinc-200' : 'bg-red-400/10 text-red-300'
          )}>
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAdmins.map((user) => {
              const isMaster = user.staffRole === 'master';
              const draft = drafts[user.uid] || normalizeAdminPermissions(user);
              const savedPermissions = isMaster ? FULL_ADMIN_PERMISSIONS : normalizeAdminPermissions(user);
              const changed = !isMaster && !samePermissions(draft, savedPermissions);

              return (
                <div
                  key={user.uid}
                  className={cn('rounded-3xl bg-white/[0.035] p-4 md:p-5', isMaster && 'bg-white/[0.065]')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-zinc-100">
                          {user.displayName || user.nickname || '이름 없음'}
                        </h3>
                        <span className="rounded-full bg-white/[0.08] px-2 py-1 text-[10px] font-black text-zinc-300">
                          {isMaster ? 'MASTER' : 'ADMIN'}
                        </span>
                        {user.uid === currentUid && <span className="text-[10px] font-bold text-zinc-500">내 계정</span>}
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">{user.email || '이메일 없음'}</p>
                    </div>
                    {isMaster && <Crown className="h-4 w-4 text-zinc-300" />}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ADMIN_PERMISSION_DEFINITIONS.map((permission) => {
                      const enabled = isMaster || draft[permission.key];
                      return (
                        <button
                          key={permission.key}
                          type="button"
                          disabled={isMaster || savingUid === user.uid}
                          onClick={() => updatePermission(user.uid, permission.key)}
                          className={cn(
                            'flex items-start gap-3 rounded-2xl p-3 text-left transition disabled:cursor-default',
                            enabled ? 'bg-white/[0.10]' : 'bg-black/20 hover:bg-white/[0.055]'
                          )}
                        >
                          <span className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                            enabled ? 'bg-white/[0.14] text-zinc-100' : 'bg-white/[0.035] text-zinc-700'
                          )}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                          <span>
                            <span className="block text-xs font-black text-zinc-100">{permission.label}</span>
                            <span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">{permission.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!isMaster && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void saveAdmin(user)}
                        disabled={!changed || savingUid === user.uid}
                        className="inline-flex min-w-[126px] items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-2.5 text-xs font-black text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                      >
                        {savingUid === user.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        권한 저장
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {!filteredAdmins.length && (
              <div className="rounded-3xl bg-white/[0.025] py-16 text-center">
                <p className="text-sm font-black text-zinc-400">표시할 관리자가 없습니다.</p>
              </div>
            )}
          </div>
        )}
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
