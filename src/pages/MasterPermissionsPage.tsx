import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle2, Crown, Loader2, RefreshCw, Save, Search, UserCog, Users } from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import { ADMIN_PERMISSION_DEFINITIONS, EMPTY_ADMIN_PERMISSIONS, FULL_ADMIN_PERMISSIONS, normalizeAdminPermissions, normalizeStaffRole } from '../constants/adminPermissions';
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

type Draft = { enabled: boolean; permissions: AdminPermissions };
const samePermissions = (a: AdminPermissions, b: AdminPermissions) => ADMIN_PERMISSION_DEFINITIONS.every(({ key }) => a[key] === b[key]);

export default function MasterPermissionsPage() {
  const [users, setUsers] = useState<AppUserInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const nextUsers = snapshot.docs.map((item) => parseUser(item.id, item.data())).sort((a, b) => {
        const order = (role: StaffRole) => role === 'master' ? 0 : role === 'admin' ? 1 : 2;
        return order(a.staffRole || null) - order(b.staffRole || null) || (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '', 'ko');
      });
      setUsers(nextUsers);
      setDrafts(Object.fromEntries(nextUsers.map((user) => [user.uid, {
        enabled: user.staffRole === 'master' || user.staffRole === 'admin',
        permissions: user.staffRole === 'master' ? { ...FULL_ADMIN_PERMISSIONS } : { ...normalizeAdminPermissions(user) },
      }])));
    } catch (error: any) {
      console.error('Failed to load master permissions:', error);
      setMessage({ success: false, text: error?.message || '관리자 권한 목록을 불러오지 못했습니다.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => [user.displayName, user.nickname, user.email, user.uid].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [searchTerm, users]);

  const updateDraft = (uid: string, updater: (draft: Draft) => Draft) => {
    setDrafts((current) => ({ ...current, [uid]: updater(current[uid] || { enabled: false, permissions: { ...EMPTY_ADMIN_PERMISSIONS } }) }));
    setMessage(null);
  };

  const saveUser = async (user: AppUserInfo) => {
    if (user.staffRole === 'master') return;
    const draft = drafts[user.uid] || { enabled: false, permissions: { ...EMPTY_ADMIN_PERMISSIONS } };
    setSavingUid(user.uid);
    setMessage(null);
    try {
      const callable = httpsCallable(functions, 'masterSetAdminAccess');
      await callable({ targetUid: user.uid, staffRole: draft.enabled ? 'admin' : null, adminPermissions: draft.enabled ? draft.permissions : { ...EMPTY_ADMIN_PERMISSIONS } });
      setMessage({ success: true, text: `${user.displayName || user.email || '회원'} 권한을 저장했습니다.` });
      await loadUsers();
    } catch (error: any) {
      console.error('masterSetAdminAccess failed:', error);
      setMessage({ success: false, text: error?.message || '권한 저장에 실패했습니다.' });
    } finally {
      setSavingUid(null);
    }
  };

  const currentUid = auth.currentUser?.uid || '';

  return (
    <AdminPageLayout title="마스터 권한" description="관리자 지정과 페이지별 접근 권한을 마스터만 설정합니다." actions={<button type="button" onClick={() => void loadUsers()} disabled={isLoading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-btn-border bg-btn-bg px-3.5 text-xs font-black text-[var(--text-secondary)] hover:bg-btn-hover disabled:opacity-45"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />새로고침</button>}>
      <div className="space-y-5">
        <div className="rounded-3xl border border-amber-400/15 bg-amber-400/[0.055] p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-300"><Crown className="h-5 w-5" /></div><div><h2 className="text-sm font-black text-amber-100">마스터 보안 원칙</h2><p className="mt-1 text-xs leading-relaxed text-amber-100/65">관리자는 허용된 페이지만 사용할 수 있고 자신의 권한을 올릴 수 없습니다. 마스터 계정은 변경·해제 대상에서 제외됩니다.</p></div></div></div>
        <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="이름, 이메일 또는 UID 검색" className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none focus:border-brand-orange/50" /></div>
        {message && <div className={cn('rounded-2xl border px-4 py-3 text-xs font-bold', message.success ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-red-400/20 bg-red-400/10 text-red-300')}>{message.text}</div>}
        {isLoading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-orange" /></div> : <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isMaster = user.staffRole === 'master';
            const draft = drafts[user.uid] || { enabled: false, permissions: { ...EMPTY_ADMIN_PERMISSIONS } };
            const savedEnabled = user.staffRole === 'admin' || isMaster;
            const savedPermissions = isMaster ? FULL_ADMIN_PERMISSIONS : normalizeAdminPermissions(user);
            const changed = !isMaster && (draft.enabled !== savedEnabled || !samePermissions(draft.permissions, savedPermissions));
            return <div key={user.uid} className={cn('rounded-3xl border bg-[var(--bg-secondary)] p-4 md:p-5', isMaster ? 'border-amber-400/25' : 'border-btn-border')}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black text-[var(--text-primary)]">{user.displayName || user.nickname || '이름 없음'}</h3>{isMaster ? <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-black text-amber-300">MASTER</span> : draft.enabled ? <span className="rounded-full bg-red-400/12 px-2 py-1 text-[10px] font-black text-red-300">ADMIN</span> : <span className="rounded-full bg-zinc-500/12 px-2 py-1 text-[10px] font-black text-zinc-400">USER</span>}{user.uid === currentUid && <span className="text-[10px] font-bold text-sky-300">내 계정</span>}</div><p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{user.email || '이메일 없음'}</p></div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3 lg:min-w-[210px]"><div className="flex items-center gap-2">{isMaster ? <Crown className="h-4 w-4 text-amber-300" /> : <UserCog className="h-4 w-4 text-zinc-400" />}<span className="text-xs font-black text-[var(--text-primary)]">관리자 지정</span></div><button type="button" disabled={isMaster || savingUid === user.uid} onClick={() => updateDraft(user.uid, (current) => ({ enabled: !current.enabled, permissions: !current.enabled ? { ...FULL_ADMIN_PERMISSIONS } : { ...EMPTY_ADMIN_PERMISSIONS } }))} className={cn('flex h-7 w-12 items-center rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-55', draft.enabled ? 'bg-brand-orange' : 'bg-zinc-700')} aria-pressed={draft.enabled}><span className={cn('h-5 w-5 rounded-full bg-white transition-transform', draft.enabled && 'translate-x-5')} /></button></div></div>
              {(draft.enabled || isMaster) && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ADMIN_PERMISSION_DEFINITIONS.map((permission) => { const enabled = isMaster || draft.permissions[permission.key]; return <button key={permission.key} type="button" disabled={isMaster || savingUid === user.uid} onClick={() => updateDraft(user.uid, (current) => ({ ...current, permissions: { ...current.permissions, [permission.key]: !current.permissions[permission.key] } }))} className={cn('flex items-start gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-default', enabled ? 'border-emerald-400/20 bg-emerald-400/[0.07]' : 'border-white/[0.07] bg-black/15')}><span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', enabled ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300' : 'border-zinc-600 text-transparent')}><CheckCircle2 className="h-3.5 w-3.5" /></span><span><span className="block text-xs font-black text-[var(--text-primary)]">{permission.label}</span><span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-secondary)]">{permission.description}</span></span></button>; })}</div>}
              {!isMaster && <div className="mt-4 flex justify-end"><button type="button" onClick={() => void saveUser(user)} disabled={!changed || savingUid === user.uid} className="inline-flex min-w-[126px] items-center justify-center gap-2 rounded-2xl bg-brand-orange px-4 py-2.5 text-xs font-black text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35">{savingUid === user.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}권한 저장</button></div>}
            </div>;
          })}
          {!filteredUsers.length && <div className="rounded-3xl border border-dashed border-btn-border py-16 text-center"><Users className="mx-auto h-9 w-9 text-zinc-600" /><p className="mt-3 text-sm font-black text-zinc-300">검색 결과가 없습니다.</p></div>}
        </div>}
      </div>
    </AdminPageLayout>
  );
}
