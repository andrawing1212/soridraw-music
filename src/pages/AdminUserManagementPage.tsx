import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  where,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AppUserInfo, UserRole, AccountStatus, PaymentStatus } from '../types';
import {
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

export default function AdminUserManagementPage() {
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

  // Edit states for Modal
  const [editRole, setEditRole] = useState<UserRole>('free');
  const [editStatus, setEditStatus] = useState<AccountStatus>('active');
  const [editMemo, setEditMemo] = useState('');

  const isAdmin = isAdminEmail(auth.currentUser?.email);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'users'), orderBy(sortBy, 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedUsers = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          // Safe mapping with default values
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
            adminMemo: data.adminMemo || ''
          } as AppUserInfo;
        });
        setUsers(fetchedUsers);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to fetch users:', error);
        if (error.code === 'permission-denied') {
          // You might want to show a more specific error in UI
          alert('상용자 정보를 불러올 권한이 없습니다. (Permission Denied)');
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
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

  const handleOpenDetail = (user: AppUserInfo) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.accountStatus);
    setEditMemo(user.adminMemo || '');
    setIsDetailOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        role: editRole,
        accountStatus: editStatus,
        adminMemo: editMemo
      });
      setIsDetailOpen(false);
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('사용자 정보 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
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
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-16">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => navigate('/admin/plans')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0", location.pathname === '/admin/plans' ? "bg-brand-orange text-white border-brand-orange" : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn")}>플랜 관리</button>
          <button onClick={() => navigate('/admin/users')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0", location.pathname === '/admin/users' ? "bg-brand-orange text-white border-brand-orange" : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn")}>회원 관리</button>
          <button onClick={() => navigate('/admin/vocals')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0", location.pathname === '/admin/vocals' ? "bg-brand-orange text-white border-brand-orange" : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn")}>보컬 관리</button>
          <button onClick={() => navigate('/admin/tags')} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0", location.pathname === '/admin/tags' ? "bg-brand-orange text-white border-brand-orange" : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn")}>태그 관리</button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)]">회원 관리</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">플랫폼 가입자들의 상태와 등급을 대시보드에서 관리합니다.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="p-2.5 rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
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
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center shrink-0 border border-btn-border group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6 text-[var(--text-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-[var(--text-primary)] truncate">{user.displayName || '이름 없음'}</span>
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

              <div className="px-6 py-5 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/30 flex items-center justify-end gap-3">
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:bg-btn-hover transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={handleUpdateUser}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-brand-orange text-white hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-brand-orange/20"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  설정 저장
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
