import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Crown, Home, Key, Mic2, SlidersHorizontal, Tags, Users } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { FULL_ADMIN_PERMISSIONS, normalizeAdminPermissions, normalizeStaffRole } from '../constants/adminPermissions';
import type { AdminPermissionKey, AdminPermissions, StaffRole } from '../types';
import { cn } from '../lib/utils';

type AdminPageLayoutProps = { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode };
type AdminTab = { path: string; label: string; icon: React.ElementType; permission?: AdminPermissionKey; masterOnly?: boolean };

const ADMIN_TABS: AdminTab[] = [
  { path: '/admin/master', label: '마스터 권한', icon: Crown, masterOnly: true },
  { path: '/admin/users', label: '회원 관리', icon: Users, permission: 'userManagement' },
  { path: '/admin/vocals', label: '보컬 관리', icon: Mic2, permission: 'vocalManagement' },
  { path: '/admin/tags', label: '섹션 태그', icon: Tags, permission: 'sectionTagManagement' },
  { path: '/admin/suno-api', label: 'Suno API', icon: Key, permission: 'sunoApiManagement' },
  { path: '/admin/app-settings', label: '앱 설정', icon: SlidersHorizontal, permission: 'appSettings' },
  { path: '/admin/gemini-audit', label: 'Gemini 호출', icon: Activity, permission: 'geminiAudit' },
];

const readCachedAdminLayoutHint = (): { staffRole: StaffRole; permissions: AdminPermissions } => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return { staffRole: null, permissions: normalizeAdminPermissions(null) };
    const raw = window.localStorage.getItem('soridraw_cached_user_role_v1');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.uid === uid && parsed?.role === 'admin') {
      // Navigation-only fallback. Route authorization is still enforced by App's
      // live/current-user admin gate; this cannot grant access to an admin route.
      return { staffRole: 'admin', permissions: { ...FULL_ADMIN_PERMISSIONS } };
    }
  } catch {
    // Storage is optional; the live Firestore snapshot remains the normal source.
  }
  return { staffRole: null, permissions: normalizeAdminPermissions(null) };
};

export default function AdminPageLayout({ title, description, actions, children }: AdminPageLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const cachedAdminHint = readCachedAdminLayoutHint();
  const [staffRole, setStaffRole] = useState<StaffRole>(cachedAdminHint.staffRole);
  const [permissions, setPermissions] = useState<AdminPermissions>(cachedAdminHint.permissions);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let unsubscribe: (() => void) | null = null;
    let retryTimer: number | null = null;
    let retryAttempt = 0;
    let disposed = false;

    const attach = () => {
      if (disposed || auth.currentUser?.uid !== uid) return;
      if (unsubscribe) {
        try { unsubscribe(); } catch {}
        unsubscribe = null;
      }

      unsubscribe = onSnapshot(doc(db, 'users', uid), (snapshot) => {
        retryAttempt = 0;
        if (retryTimer !== null) {
          window.clearTimeout(retryTimer);
          retryTimer = null;
        }
        const data = snapshot.exists() ? snapshot.data() : null;
        setStaffRole(normalizeStaffRole(data));
        setPermissions(normalizeAdminPermissions(data));
      }, (error: any) => {
        // 843 — Keep the last live/cached navigation state and reattach slowly.
        // Firestore does not continue a listener after its error callback fires.
        console.warn('[Admin layout] user permission listener unavailable; keeping last verified/cached layout state.', error);
        const code = String(error?.code || '').toLowerCase();
        const transient = ['resource-exhausted', 'unavailable', 'deadline-exceeded', 'aborted', 'internal']
          .some((candidate) => code.includes(candidate));
        if (!transient || disposed) return;
        const delays = [30_000, 60_000, 120_000, 300_000];
        const delay = delays[Math.min(retryAttempt, delays.length - 1)];
        retryAttempt += 1;
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          attach();
        }, delay);
      });
    };

    attach();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const visibleTabs = useMemo(() => ADMIN_TABS.filter((tab) => {
    if (tab.masterOnly) return staffRole === 'master';
    if (staffRole === 'master') return true;
    return Boolean(tab.permission && permissions[tab.permission]);
  }), [permissions, staffRole]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-16">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = location.pathname === tab.path;
            return <button key={tab.path} onClick={() => navigate(tab.path)} className={cn('inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0', active ? 'bg-brand-orange text-white shadow-[0_8px_18px_rgba(249,115,22,0.18)]' : 'bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover hover:text-[var(--text-primary)] shadow-btn')}><Icon className="w-3.5 h-3.5" />{tab.label}</button>;
          })}
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 md:gap-4 min-w-0">
            <button onClick={() => navigate('/')} className="w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-btn-bg border border-btn-border text-[var(--text-secondary)] hover:text-brand-orange hover:bg-btn-hover transition-all flex items-center justify-center shadow-btn shrink-0" aria-label="홈으로 이동"><Home className="w-5 h-5" /></button>
            <div className="min-w-0 pt-0.5"><h1 className="text-2xl md:text-4xl font-black text-[var(--text-primary)] tracking-tight">{title}</h1>{description && <p className="mt-1 text-sm md:text-base text-[var(--text-secondary)] break-keep">{description}</p>}</div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
