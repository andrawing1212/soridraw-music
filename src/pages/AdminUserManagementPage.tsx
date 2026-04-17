import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  where,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AppUserInfo, UserRole, AccountStatus, PaymentStatus } from '../types';
import {
  Users,
  Search,
  Filter,
  User,
  Mail,
  Calendar,
  CreditCard,
  Shield,
  Activity,
  ChevronRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  X,
  Save,
  Clock,
  Music,
  Heart,
  FileText,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAdminEmail, getTimestampMs } from '../App';
import { motion, AnimatePresence } from 'motion/react';

import AdminPageLayout from '../components/AdminPageLayout';

const ROLE_LABELS: Record<UserRole, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  admin: 'Admin'
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: '정상',
  paused: '일시정지',
  expired: '만료',
  banned: '정지'
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  none: '없음',
  active: '구독중',
  canceled: '취소됨',
  expired: '만료됨',
  refunded: '환불됨',
  trial: '체험판'
};

export default function AdminUserManagementPage({ isAdmin: isAdminProp }: { isAdmin?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<AppUserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all');
  const [sortBy, setBy] = useState<'createdAt' | 'lastLoginAt'>('createdAt');
  
  const [selectedUser, setSelectedUser] = useState<AppUserInfo | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Edit states for Modal
  const [editRole, setEditRole] = useState<UserRole>('free');
  const [editStatus, setEditStatus] = useState<AccountStatus>('active');
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>('none');
  const [editPlanName, setEditPlanName] = useState('');
  const [editMemo, setEditMemo] = useState('');

  const [isAdmin, setIsAdmin] = useState(isAdminProp || isAdminEmail(auth.currentUser?.email));

  // --- Summary Statistics Calculation ---
  const userStats = useMemo(() => {
    const total = users.length;
    // Primary criterion: isOnline flag from document
    // Secondary safety: lastSeenAt within last 1 hour (to catch abandoned sessions where isOnline might be stuck)
    const onlineThreshold = 3600000; // 1 hour safety margin
    const now = Date.now();

    const isActuallyOnline = (u: AppUserInfo) => {
      // If flag is true and haven't seen them for > 1 hour, probably a stuck session
      if (u.isOnline) {
        if (u.lastSeenAt && (now - u.lastSeenAt) > onlineThreshold) return false;
        return true;
      }
      return false;
    };
    
    const online = users.filter(u => isActuallyOnline(u)).length;
    
    const byRole = {
      free: { total: 0, online: 0 },
      basic: { total: 0, online: 0 },
      pro: { total: 0, online: 0 },
      admin: { total: 0, online: 0 }
    };
    
    users.forEach(u => {
      const r = u.role || 'free';
      const isOnline = isActuallyOnline(u);
      
      if (byRole[r as keyof typeof byRole]) {
        byRole[r as keyof typeof byRole].total++;
        if (isOnline) byRole[r as keyof typeof byRole].online++;
      }
    });
    
    return { total, online, byRole };
  }, [users]);
  // ---------------------------------------

  useEffect(() => {
    if (isAdminProp !== undefined) {
      setIsAdmin(isAdminProp);
    }
  }, [isAdminProp]);

  useEffect(() => {
    if (!auth.currentUser || isAdminProp !== undefined) return;
    
    // 1-time check for admin role to save costs
    const checkAdmin = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.role === 'admin' || isAdminEmail(auth.currentUser?.email)) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch (err) {
        console.error("Admin check failed:", err);
      }
    };
    checkAdmin();
  }, [isAdminProp]);

  // Fetch users 1-time or on refresh
  const fetchUsers = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy(sortBy, 'desc'));
      const snapshot = await getDocs(q);
      const fetchedUsers = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          email: data.email || null,
          displayName: data.displayName || null,
          role: (data.role as UserRole) || 'free',
          accountStatus: (data.accountStatus as AccountStatus) || 'active',
          paymentStatus: (data.paymentStatus as PaymentStatus) || 'none',
          createdAt: getTimestampMs(data.createdAt || Date.now()),
          lastLoginAt: data.lastLoginAt ? getTimestampMs(data.lastLoginAt) : undefined,
          planName: data.planName,
          planStartAt: data.planStartAt ? getTimestampMs(data.planStartAt) : undefined,
          planExpireAt: data.planExpireAt ? getTimestampMs(data.planExpireAt) : undefined,
          nextBillingAt: data.nextBillingAt ? getTimestampMs(data.nextBillingAt) : undefined,
          lastPaymentAt: data.lastPaymentAt ? getTimestampMs(data.lastPaymentAt) : undefined,
          songGeneratedCount: data.songGeneratedCount || 0,
          favoriteCount: data.favoriteCount || 0,
          adminMemo: data.adminMemo || '',
          isOnline: data.isOnline || false,
          lastSeenAt: data.lastSeenAt ? getTimestampMs(data.lastSeenAt) : undefined,
        } as AppUserInfo;
      });
      setUsers(fetchedUsers);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      if (error.code === 'permission-denied') {
        alert('사용자 정보를 불러올 권한이 없습니다. (Permission Denied)');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isAdmin, sortBy]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.accountStatus === statusFilter;
      const matchesPayment = paymentFilter === 'all' || user.paymentStatus === paymentFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesPayment;
    });
  }, [users, searchTerm, roleFilter, statusFilter, paymentFilter]);

  const [isRefreshingDetail, setIsRefreshingDetail] = useState(false);

  const fetchUserDetail = async (uid: string) => {
    setIsRefreshingDetail(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        const updatedUser = {
          uid: snap.id,
          email: data.email || null,
          displayName: data.displayName || null,
          role: (data.role as UserRole) || 'free',
          accountStatus: (data.accountStatus as AccountStatus) || 'active',
          paymentStatus: (data.paymentStatus as PaymentStatus) || 'none',
          createdAt: getTimestampMs(data.createdAt || Date.now()),
          lastLoginAt: data.lastLoginAt ? getTimestampMs(data.lastLoginAt) : undefined,
          planName: data.planName,
          planStartAt: data.planStartAt ? getTimestampMs(data.planStartAt) : undefined,
          planExpireAt: data.planExpireAt ? getTimestampMs(data.planExpireAt) : undefined,
          nextBillingAt: data.nextBillingAt ? getTimestampMs(data.nextBillingAt) : undefined,
          lastPaymentAt: data.lastPaymentAt ? getTimestampMs(data.lastPaymentAt) : undefined,
          songGeneratedCount: data.songGeneratedCount || 0,
          favoriteCount: data.favoriteCount || 0,
          adminMemo: data.adminMemo || '',
          isOnline: data.isOnline || false,
          lastSeenAt: data.lastSeenAt ? getTimestampMs(data.lastSeenAt) : undefined,
        } as AppUserInfo;
        
        setSelectedUser(updatedUser);
        setEditRole(updatedUser.role);
        setEditStatus(updatedUser.accountStatus);
        setEditPaymentStatus(updatedUser.paymentStatus || 'none');
        setEditPlanName(updatedUser.planName || '');
        setEditMemo(updatedUser.adminMemo || '');
        
        // Also update in list to keep it relatively in sync
        setUsers(prev => prev.map(u => u.uid === uid ? updatedUser : u));
      }
    } catch (err) {
      console.error("Failed to refresh user detail:", err);
    } finally {
      setIsRefreshingDetail(false);
    }
  };

  const handleOpenDetail = (user: AppUserInfo) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.accountStatus);
    setEditPaymentStatus(user.paymentStatus || 'none');
    setEditPlanName(user.planName || '');
    setEditMemo(user.adminMemo || '');
    setSaveStatus('idle');
    setIsDetailOpen(true);
    // Fetch latest when opening
    fetchUserDetail(user.uid);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    // Safety Checks
    const isSelf = auth.currentUser?.uid === selectedUser.uid;
    
    // 1. Prevents self-demotion from admin
    if (isSelf && selectedUser.role === 'admin' && editRole !== 'admin') {
      alert('자기 자신의 관리자 권한을 해제할 수 없습니다.');
      return;
    }

    // 2. Prevents self-suspension/ban
    if (isSelf && editStatus !== 'active') {
      alert('자기 자신의 계정 상태를 변경(일시정지/정지 등)할 수 없습니다.');
      return;
    }

    // 3. Prevents removing the last admin
    const adminCount = users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1 && selectedUser.role === 'admin' && editRole !== 'admin') {
      alert('시스템에 최소 1명의 관리자가 존재해야 합니다. 마지막 관리자 권한을 해제할 수 없습니다.');
      return;
    }

    // Confirmation logic
    const needsConfirm = editRole !== selectedUser.role || editStatus !== selectedUser.accountStatus;
    
    if (needsConfirm && !confirmModal.isOpen) {
      setConfirmModal({
        isOpen: true,
        title: '변경 내용 확인',
        message: '회원의 등급 또는 상태를 변경하시겠습니까? 이 작업은 즉시 반영됩니다.',
        onConfirm: () => executeUpdate()
      });
      return;
    }

    executeUpdate();
  };

  const executeUpdate = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setSaveStatus('idle');
    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        role: editRole,
        accountStatus: editStatus,
        paymentStatus: editPaymentStatus,
        planName: editPlanName,
        adminMemo: editMemo
      });
      setSaveStatus('success');
      setTimeout(() => {
        setIsDetailOpen(false);
        setSaveStatus('idle');
      }, 1500);
    } catch (error) {
      console.error('Failed to update user:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return '기록 없음';
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return new Date(timestamp).toLocaleDateString();
  };

  const isUserOnline = (user: AppUserInfo) => {
    if (!user.isOnline) return false;
    // 1-hour safety margin for stuck sessions
    if (user.lastSeenAt && (Date.now() - user.lastSeenAt) > 3600000) return false;
    return true;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-brand-orange text-white rounded-xl">홈으로</button>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout
      title="회원 관리"
      description="플랫폼 가입자들의 상태와 등급을 대시보드에서 관리합니다."
      actions={
        <button 
          onClick={fetchUsers} 
          disabled={isLoading}
          className="p-2.5 rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn disabled:opacity-50"
        >
          <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
        </button>
      }
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border-color)] shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1 text-[var(--text-secondary)] text-xs font-bold">
            <Users className="w-3.5 h-3.5" />
            총 회원수
          </div>
          <div className="text-2xl font-black text-[var(--text-primary)]">
            {userStats.total}<span className="text-sm font-bold ml-1">명</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border-color)] shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1 text-emerald-500 text-xs font-bold">
            <Activity className="w-3.5 h-3.5" />
            현재 접속
          </div>
          <div className="text-2xl font-black text-emerald-500">
            {userStats.online}<span className="text-sm font-bold ml-1">명</span>
          </div>
        </motion.div>
        
        {/* Role Stats */}
        {(Object.entries(userStats.byRole) as [UserRole, {total: number, online: number}][]).map(([role, data], idx) => (
          <motion.div 
            key={role}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + (idx * 0.05) }}
            className="bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border-color)] shadow-sm"
          >
            <div 
              className="flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-wider"
              style={{ 
                color: role === 'admin' ? '#f43f5e' : 
                       role === 'pro' ? 'var(--brand-orange)' : 
                       role === 'basic' ? '#3b82f6' : 'var(--text-secondary)' 
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ 
                backgroundColor: role === 'admin' ? '#f43f5e' : 
                                role === 'pro' ? 'var(--brand-orange)' : 
                                role === 'basic' ? '#3b82f6' : 'var(--text-secondary)' 
              }} />
              {ROLE_LABELS[role]}
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-xl font-black text-[var(--text-primary)]">{data.total}</span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                ON {data.online}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border-color)] shadow-[var(--shadow-md)] space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="이메일, UID, 닉네임 검색..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--bg-secondary)] border border-btn-border outline-none focus:border-brand-orange transition-all"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-2xl bg-[var(--bg-secondary)] border border-btn-border text-sm outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="all">전체 등급</option>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="admin">Admin</option>
              </select>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-2xl bg-[var(--bg-secondary)] border border-btn-border text-sm outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="all">계정 상태</option>
                <option value="active">정상</option>
                <option value="paused">일시정지</option>
                <option value="expired">만료</option>
                <option value="banned">정지</option>
              </select>
              <select 
                value={paymentFilter} 
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-2xl bg-[var(--bg-secondary)] border border-btn-border text-sm outline-none focus:border-brand-orange cursor-pointer"
              >
                <option value="all">결제 상태</option>
                <option value="none">없음</option>
                <option value="active">구독중</option>
                <option value="canceled">취소됨</option>
                <option value="expired">만료됨</option>
                <option value="refunded">환불됨</option>
                <option value="trial">체험판</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-[var(--text-secondary)] px-1">
            <button onClick={() => setBy('createdAt')} className={cn("hover:text-brand-orange transition-colors", sortBy === 'createdAt' && "text-brand-orange")}>가입일순</button>
            <button onClick={() => setBy('lastLoginAt')} className={cn("hover:text-brand-orange transition-colors", sortBy === 'lastLoginAt' && "text-brand-orange")}>최종 접속순</button>
            <span className="ml-auto">총 {filteredUsers.length}명 검색됨</span>
          </div>
        </div>

        {/* User List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">사용자 목록을 불러오는 중...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-[var(--border-color)] rounded-3xl">
              <User className="w-12 h-12 text-[var(--text-secondary)]/30 mx-auto mb-2" />
              <p className="text-[var(--text-secondary)]">검색 결과가 없습니다.</p>
            </div>
          ) : (
            filteredUsers.map(user => (
              <div 
                key={user.uid}
                onClick={() => handleOpenDetail(user)}
                className="bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border-color)] hover:border-brand-orange/30 transition-all cursor-pointer group shadow-sm flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center shrink-0 border border-btn-border group-hover:scale-110 transition-transform relative">
                  <User className="w-6 h-6 text-[var(--text-secondary)]" />
                  {isUserOnline(user) && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--bg-primary)] rounded-full animate-pulse shadow-sm" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-[var(--text-primary)] truncate">{user.displayName || '이름 없음'}</span>
                    {isUserOnline(user) && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-emerald-500" /> 접속 중</span>}
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                      user.role === 'admin' ? "bg-red-500/10 text-red-500" :
                      user.role === 'pro' ? "bg-brand-orange/10 text-brand-orange" :
                      user.role === 'basic' ? "bg-blue-500/10 text-blue-500" :
                      "bg-zinc-500/10 text-zinc-500"
                    )}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 가입: {new Date(user.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 최근 활동: {formatLastSeen(user.lastSeenAt)}</span>
                  </div>
                </div>
                <div className="hidden md:flex flex-col items-end shrink-0 gap-1.5 px-4 border-l border-btn-border">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      user.accountStatus === 'active' ? "bg-emerald-500" : 
                      user.accountStatus === 'banned' ? "bg-red-500" : "bg-zinc-400"
                    )} />
                    <span className="text-xs font-bold text-[var(--text-primary)]">{STATUS_LABELS[user.accountStatus]}</span>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {PAYMENT_LABELS[user.paymentStatus]}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
              </div>
            ))
          )}
        </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsDetailOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--card-bg)] rounded-[32px] border border-[var(--border-color)] overflow-hidden shadow-2xl"
            >
              <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]/30">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-brand-orange" />
                  <h2 className="text-xl font-black text-[var(--text-primary)]">회원 상세 정보</h2>
                  <button 
                    onClick={() => fetchUserDetail(selectedUser.uid)}
                    disabled={isRefreshingDetail}
                    className="p-1.5 hover:bg-btn-hover rounded-lg transition-colors ml-2"
                    title="새로고침"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5 text-[var(--text-secondary)]", isRefreshingDetail && "animate-spin")} />
                  </button>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-btn-hover rounded-full transition-colors">
                  <X className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-8">
                {/* Basic Info */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-brand-orange uppercase tracking-widest flex items-center gap-2">
                       <Activity className="w-3.5 h-3.5" /> 기본 프로필
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-btn-border/50">
                        <span className="text-xs text-[var(--text-secondary)]">UID</span>
                        <span className="text-xs font-mono text-[var(--text-primary)] font-bold">{selectedUser.uid}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-btn-border/50">
                        <span className="text-xs text-[var(--text-secondary)]">이메일</span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{selectedUser.email}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-btn-border/50">
                        <span className="text-xs text-[var(--text-secondary)]">닉네임</span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{selectedUser.displayName || '없음'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-btn-border/50">
                        <span className="text-xs text-[var(--text-secondary)]">가입일시</span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{new Date(selectedUser.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-btn-border/50">
                        <span className="text-xs text-[var(--text-secondary)]">최종 접속</span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : '기록 없음'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-brand-orange uppercase tracking-widest flex items-center gap-2">
                       <CreditCard className="w-3.5 h-3.5" /> 구독 및 결제
                    </h3>
                    <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-btn-border space-y-3 shadow-inner">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">구독 상품</span>
                        <span className="text-sm font-black text-brand-orange">{selectedUser.planName || 'Free Plan'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">결제 상태</span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">{PAYMENT_LABELS[selectedUser.paymentStatus]}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">만료 일시</span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">{selectedUser.planExpireAt ? new Date(selectedUser.planExpireAt).toLocaleDateString() : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--text-secondary)]">차기 결제일</span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">{selectedUser.nextBillingAt ? new Date(selectedUser.nextBillingAt).toLocaleDateString() : '-'}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 px-2">
                       <div className="flex-1 text-center">
                          <div className="text-xs text-[var(--text-secondary)] mb-1">생성곡</div>
                          <div className="text-lg font-black text-[var(--text-primary)] flex items-center justify-center gap-1"><Music className="w-4 h-4" /> {selectedUser.songGeneratedCount}</div>
                       </div>
                       <div className="flex-1 text-center">
                          <div className="text-xs text-[var(--text-secondary)] mb-1">저장곡</div>
                          <div className="text-lg font-black text-[var(--text-primary)] flex items-center justify-center gap-1"><Heart className="w-4 h-4" /> {selectedUser.favoriteCount}</div>
                       </div>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-btn-border/50" />

                {/* Management UI */}
                <section className="space-y-6">
                  <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" /> 계정 권한 및 상태 관리
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
                        회원 등급 변경
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['free', 'basic', 'pro', 'admin'] as UserRole[]).map(r => (
                          <button
                            key={r}
                            onClick={() => setEditRole(r)}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold border transition-all",
                              editRole === r ? "bg-brand-orange border-brand-orange text-white" : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                            )}
                          >
                            {ROLE_LABELS[r]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
                        계정 상태 변경
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['active', 'paused', 'expired', 'banned'] as AccountStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={() => setEditStatus(s)}
                            className={cn(
                              "py-2 rounded-xl text-xs font-bold border transition-all",
                              editStatus === s ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                            )}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
                       구독 플랜 및 결제 상세 변경
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       <input 
                         value={editPlanName}
                         onChange={(e) => setEditPlanName(e.target.value)}
                         placeholder="플랜명 (예: Pro Plan)"
                         className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-btn-border text-xs outline-none focus:border-brand-orange"
                       />
                       <select 
                         value={editPaymentStatus}
                         onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                         className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-btn-border text-xs outline-none focus:border-brand-orange cursor-pointer"
                       >
                         {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                           <option key={value} value={value}>{label}</option>
                         ))}
                       </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> 관리자 메모 (해당 회원에 대한 특이사항 기록)
                    </label>
                    <textarea 
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      placeholder="메모를 입력하세요..."
                      className="w-full h-24 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-btn-border outline-none focus:border-brand-orange transition-all text-sm resize-none shadow-inner"
                    />
                  </div>
                </section>
              </div>

              <div className="px-6 py-5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/30 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <AnimatePresence>
                    {saveStatus === 'success' && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        className="text-emerald-500 text-xs font-bold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> 성공적으로 저장되었습니다.
                      </motion.div>
                    )}
                    {saveStatus === 'error' && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        className="text-red-500 text-xs font-bold flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3" /> 저장 중 오류가 발생했습니다.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:bg-btn-hover transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={handleUpdateUser}
                  disabled={isSaving || saveStatus === 'success'}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:brightness-110 transition-all flex items-center gap-2 shadow-lg",
                    saveStatus === 'success' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-brand-orange shadow-brand-orange/20"
                  )}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === 'success' ? <RefreshCw className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saveStatus === 'success' ? '완료' : '설정 저장'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-brand-orange">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-black">{confirmModal.title}</h3>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 rounded-2xl bg-btn-bg border border-btn-border text-sm font-bold text-[var(--text-secondary)] hover:bg-btn-hover"
                >
                  취소
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-2xl bg-brand-orange text-white text-sm font-bold hover:brightness-110 shadow-lg shadow-brand-orange/20"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminPageLayout>
  );
}
