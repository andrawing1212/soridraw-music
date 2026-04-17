import React, { useState, useEffect, useRef, Component, useCallback, useMemo, lazy, Suspense } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate,
  useLocation,
  Navigate
} from 'react-router-dom';
import { 
  Music, 
  Sparkles, 
  RotateCcw, 
  Copy, 
  Check, 
  Search, 
  X, 
  Info,
  Languages,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Trash2,
  History,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Shuffle,
  Dices,
  Menu,
  Sun,
  Moon,
  Monitor,
  Home as HomeIcon,
  Heart as HeartIcon,
  User as UserIcon,
  Heart,
  AlertCircle,
  Lock,
  Unlock,
  Edit2,
  Filter,
  RefreshCw,
  CheckCircle2,
  Mic2,
  MicOff,
  Tag,
  Users,
  Settings,
  Play,
  ThumbsUp,
  ThumbsDown,
  Youtube as YoutubeIcon,
  ExternalLink,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { createPortal } from 'react-dom';

// Portal component for top-level rendering
function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  GENRES,
  MOODS,
  THEMES,
  GENRE_GROUPS,
  GENRE_HIERARCHY,
  SOUND_STYLES,
  INSTRUMENT_SOUNDS,
  STYLE_CYCLES,
  SOUND_TEXTURE_CYCLES,
  ALLOWED_TAGS_BY_SECTION,
  TAG_DESCRIPTIONS,
  TAG_META,
  SECTION_META,
  TagTier,
  INSTRUMENTAL_SOLO_TAGS,
  INSTRUMENT_TAGS,
  INSTRUMENT_TAG_DESCRIPTIONS
} from './constants';
import { VOCAL_TONES } from './constants/vocalTones';
import { CategoryItem, SongResult, LyricsLength, SongStructure, CustomSectionItem, VocalMode, VocalTone, VocalMember, VocalRole, SectionTag, UserRole } from './types';
import { PROMPT_TEMPLATES, PromptTemplate } from './constants/templates';

const normalizeCustomStructure = (input: any): CustomSectionItem[] => {
  if (!input || !Array.isArray(input)) return [];
  
  try {
    return input.map((item: any) => {
      // If it's already an object with the right structure
      if (typeof item === 'object' && item !== null && 'section' in item) {
        return {
          id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          section: item.section || 'Unknown',
          tags: Array.isArray(item.tags) ? item.tags : []
        };
      }
      // If it's the old string format
      if (typeof item === 'string') {
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          section: item,
          tags: []
        };
      }
      // Fallback for unexpected items
      return null;
    }).filter((item): item is CustomSectionItem => item !== null);
  } catch (error) {
    console.error('Failed to normalize custom structure:', error);
    return [];
  }
};

import { generateSong } from './services/geminiService';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
  limit,
  addDoc,
  writeBatch,
  getDocs,
  getDocFromServer,
  query as firestoreQuery
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import { sanitizeForFirestore } from './lib/utils';
import GenreHierarchySelector from './components/GenreHierarchySelector';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if ((this.state as any).hasError) {
      const error = (this.state as any).error;
      let errorMessage = "알 수 없는 오류가 발생했습니다.";
      
      if (error?.message) {
        if (error.message.includes("VITE_GEMINI_API_KEY")) {
          errorMessage = "Gemini API 키가 설정되지 않았습니다. 설정을 확인해주세요.";
        } else if (error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("limit")) {
          errorMessage = "무료 생성 한도를 초과했습니다. 나중에 다시 시도해주세요.";
        } else {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.includes("insufficient permissions")) {
              errorMessage = "권한이 부족합니다. 로그인 상태를 확인해주세요.";
            }
          } catch (e) {
            errorMessage = error.message;
          }
        }
      }

      return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-red-500/10">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">문제가 발생했습니다</h2>
            <p className="text-[var(--text-secondary)]">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-brand-orange text-white font-bold hover:brightness-110 transition-all"
            >
              다시 시도하기
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ReorderableSectionItem = ({ 
  item, 
  index, 
  onEdit, 
  onRemove, 
  onHover 
}: { 
  item: CustomSectionItem; 
  index: number; 
  onEdit: (index: number) => void; 
  onRemove: (index: number) => void; 
  onHover: (item: CategoryItem | null) => void;
  key?: React.Key;
}) => {
  const controls = useDragControls();
  
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-2xl bg-[var(--bg-secondary)] border border-btn-border px-3 py-2.5 touch-pan-y shadow-sm"
      as="div"
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: "0 8px 30px rgba(0,0,0,0.3)", 
        borderColor: "rgba(255,165,0,0.3)",
        backgroundColor: "rgba(255,255,255,0.08)"
      }}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        className="w-8 h-8 rounded-lg border bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover transition-all flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 touch-none shadow-btn"
        onMouseEnter={() => onHover({ id: 'section-drag', label: '순서 변경', description: '이 버튼을 눌러 위아래로 드래그하여 순서를 변경합니다.' })}
        onMouseLeave={() => onHover(null)}
      >
        <ArrowUpDown className="w-4 h-4" />
      </button>

      <span className="w-6 h-6 rounded-full bg-brand-orange/10 text-brand-orange text-[11px] font-black flex items-center justify-center shrink-0">
        {index + 1}
      </span>
      
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-[var(--text-primary)] block">{item.section}</span>
        {SECTION_META[item.section]?.descriptionKo && (
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed line-clamp-2 md:line-clamp-none break-keep">
            {SECTION_META[item.section].descriptionKo}
          </p>
        )}
        {(item.tags ?? []).length > 0 && (
          <p className="text-[10px] text-brand-orange/80 font-medium mt-1 truncate">
            {(item.tags ?? []).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(index)}
          onMouseEnter={() => onHover({ id: 'section-edit-tags', label: '태그 편집', description: '이 섹션에 세부 디렉션(태그)을 추가하거나 수정합니다.' })}
          onMouseLeave={() => onHover(null)}
          className="w-8 h-8 rounded-lg border bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover transition-all flex items-center justify-center shadow-btn"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(index)}
          onMouseEnter={() => onHover({ id: 'section-remove', label: '삭제', description: '이 섹션을 구조에서 제거합니다.' })}
          onMouseLeave={() => onHover(null)}
          className="w-8 h-8 rounded-lg border bg-white/5 border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
};

const ADMIN_EMAILS = ['andrawing1212@gmail.com'];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(normalizeEmail(email));
}

type UserPlanRecord = {
  email: string;
  tier: TagTier;
  updatedAt?: any;
  updatedBy?: string;
};

function AdminPlanManagerPage({ currentUser, isAdmin }: { currentUser: User | null; isAdmin: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [emailInput, setEmailInput] = useState('');
  const [planRecords, setPlanRecords] = useState<UserPlanRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const canAccess = isAdmin;

  const loadPlans = useCallback(async () => {
    if (!canAccess) return;
    try {
      const snapshot = await getDocs(collection(db, 'user_plans'));
      const plans = snapshot.docs
        .map((snapshotDoc) => ({
          email: String(snapshotDoc.data().email || snapshotDoc.id),
          tier: (snapshotDoc.data().tier || 'free') as TagTier,
          updatedAt: snapshotDoc.data().updatedAt,
          updatedBy: snapshotDoc.data().updatedBy,
        }))
        .sort((a, b) => a.email.localeCompare(b.email));
      setPlanRecords(plans);
    } catch (error) {
      console.error('Failed to load user plans:', error);
      setPageError('플랜 목록을 불러오지 못했습니다.');
    }
  }, [canAccess]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const assignPlan = async (email: string, tier: TagTier) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setPageError('올바른 이메일을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setPageError(null);
    try {
      await setDoc(
        doc(db, 'user_plans', normalizedEmail),
        sanitizeForFirestore({
          email: normalizedEmail,
          tier,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.email || null,
        }),
        { merge: true }
      );
      setEmailInput('');
      await loadPlans();
    } catch (error) {
      console.error('Failed to assign user plan:', error);
      setPageError('플랜 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const removePlan = async (email: string) => {
    setIsSaving(true);
    setPageError(null);
    try {
      await deleteDoc(doc(db, 'user_plans', normalizeEmail(email)));
      await loadPlans();
    } catch (error) {
      console.error('Failed to remove user plan:', error);
      setPageError('플랜 삭제에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-red-500/10">
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">접근 권한이 없습니다</h2>
          <p className="text-[var(--text-secondary)]">관리자 계정으로만 플랜을 부여할 수 있습니다.</p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-3 rounded-2xl bg-brand-orange text-white font-bold hover:brightness-110 transition-all"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-6 pt-28 pb-16">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex gap-2 mb-2">
          <button 
            onClick={() => navigate('/admin/plans')} 
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              location.pathname === '/admin/plans' 
                ? "bg-brand-orange border-brand-orange text-white" 
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn"
            )}
          >
            플랜 관리
          </button>
          <button 
            onClick={() => navigate('/admin/users')} 
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              location.pathname === '/admin/users' 
                ? "bg-brand-orange border-brand-orange text-white" 
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn"
            )}
          >
            회원 관리
          </button>
          <button 
            onClick={() => navigate('/admin/vocals')} 
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              location.pathname === '/admin/vocals' 
                ? "bg-brand-orange border-brand-orange text-white" 
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn"
            )}
          >
            보컬 관리
          </button>
          <button 
            onClick={() => navigate('/admin/tags')} 
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              location.pathname === '/admin/tags' 
                ? "bg-brand-orange border-brand-orange text-white" 
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn"
            )}
          >
            태그 관리
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)]">플랜 관리</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2">이메일 기준으로 free / pro / pro+ 권한을 직접 부여합니다.</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-all"
          >
            홈으로
          </button>
        </div>

        <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] p-5 shadow-[var(--shadow-md)] space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">플랜 부여</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">계정 이메일을 입력하고 원하는 플랜을 바로 부여하세요.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="plan@example.com"
              className="flex-1 px-4 py-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] outline-none focus:border-brand-orange"
            />
            <div className="flex gap-2">
              <button
                onClick={() => assignPlan(emailInput, 'free')}
                disabled={isSaving}
                className="px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-all disabled:opacity-50"
              >
                Free
              </button>
              <button
                onClick={() => assignPlan(emailInput, 'pro')}
                disabled={isSaving}
                className="px-4 py-3 rounded-2xl border border-brand-orange/30 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 transition-all disabled:opacity-50"
              >
                Pro
              </button>
              <button
                onClick={() => assignPlan(emailInput, 'pro+')}
                disabled={isSaving}
                className="px-4 py-3 rounded-2xl bg-brand-orange text-white hover:brightness-110 transition-all disabled:opacity-50"
              >
                Pro+
              </button>
            </div>
          </div>

          {pageError && <p className="text-sm text-red-400">{pageError}</p>}
          <p className="text-xs text-[var(--text-secondary)]">관리자 본인 계정은 항상 Pro+로 동작합니다.</p>
        </div>

        <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] p-5 shadow-[var(--shadow-md)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">부여된 플랜 목록</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">삭제하면 다시 free로 돌아갑니다.</p>
            </div>
            <button
              onClick={loadPlans}
              className="p-2 rounded-xl border border-[var(--border-color)] bg-btn-bg text-[var(--text-primary)] hover:bg-btn-hover transition-all shadow-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {planRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-6 text-sm text-[var(--text-secondary)] text-center">
                아직 부여된 플랜이 없습니다.
              </div>
            ) : (
              planRecords.map((record) => (
                <div
                  key={record.email}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-[var(--border-color)] px-4 py-3 bg-[var(--bg-secondary)]/40"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{record.email}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">현재 플랜: {record.tier}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => assignPlan(record.email, 'free')} disabled={isSaving} className="px-3 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-all disabled:opacity-50">Free</button>
                    <button onClick={() => assignPlan(record.email, 'pro')} disabled={isSaving} className="px-3 py-2 rounded-xl border border-brand-orange/30 text-brand-orange hover:bg-brand-orange/10 transition-all disabled:opacity-50">Pro</button>
                    <button onClick={() => assignPlan(record.email, 'pro+')} disabled={isSaving} className="px-3 py-2 rounded-xl bg-brand-orange text-white hover:brightness-110 transition-all disabled:opacity-50">Pro+</button>
                    <button onClick={() => removePlan(record.email)} disabled={isSaving} className="px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50">삭제</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryScrollControl() {
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const isDraggingRef = useRef(false);
  const dragYRef = useRef(0);
  const startY = useRef(0);
  const scrollRaf = useRef<number | null>(null);
  const activeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Max drag distance (track height is 160px, circle radius is 12px)
  const MAX_DRAG = 65;

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      // Show if page is long enough, regardless of current scroll position
      setIsVisible(scrollHeight > clientHeight * 1.2);
      
      // Show on scroll
      setIsActive(true);
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      activeTimerRef.current = setTimeout(() => setIsActive(false), 2000);
    };

    const checkModal = () => {
      // Check if the lyrics modal is open (it has z-[100])
      const modal = document.querySelector('.z-\\[100\\]');
      setIsModalOpen(!!modal);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    const modalInterval = setInterval(checkModal, 500);
    
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearInterval(modalInterval);
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    };
  }, []);

  const stopScrolling = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    dragYRef.current = 0;
    setDragY(0);
    
    if (scrollRaf.current) {
      cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = null;
    }
    
    // Restore scroll behavior
    document.documentElement.style.scrollBehavior = '';
    
    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    activeTimerRef.current = setTimeout(() => setIsActive(false), 1500);
  }, []);

  // Global cleanup for safety
  useEffect(() => {
    const handleGlobalStop = () => stopScrolling();
    window.addEventListener('blur', handleGlobalStop);
    window.addEventListener('visibilitychange', handleGlobalStop);
    return () => {
      window.removeEventListener('blur', handleGlobalStop);
      window.removeEventListener('visibilitychange', handleGlobalStop);
    };
  }, [stopScrolling]);

  useEffect(() => {
    const scroll = () => {
      if (!isDraggingRef.current) {
        if (scrollRaf.current) {
          cancelAnimationFrame(scrollRaf.current);
          scrollRaf.current = null;
        }
        return;
      }

      const speedFactor = 0.4;
      const speed = dragYRef.current * speedFactor;
      const clampedSpeed = Math.max(-40, Math.min(40, speed));
      
      // Boundary checks with small epsilon
      const isAtTop = window.scrollY <= 0.5;
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      const canScrollUp = clampedSpeed < 0 && !isAtTop;
      const canScrollDown = clampedSpeed > 0 && !isAtBottom;

      if ((canScrollUp || canScrollDown) && Math.abs(clampedSpeed) > 1.5) {
        window.scrollBy(0, clampedSpeed);
      }
      
      scrollRaf.current = requestAnimationFrame(scroll);
    };

    if (isDragging) {
      // Disable smooth scroll during drag to prevent lag/infinite loops
      document.documentElement.style.scrollBehavior = 'auto';
      scrollRaf.current = requestAnimationFrame(scroll);
    } else {
      if (scrollRaf.current) {
        cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = null;
      }
    }

    return () => {
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    };
  }, [isDragging, stopScrolling]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      const delta = e.clientY - startY.current;
      const clampedDelta = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, delta));
      setDragY(clampedDelta);
      dragYRef.current = clampedDelta;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    stopScrolling();
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    stopScrolling();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {(isActive || isDragging || isVisible) && !isModalOpen && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ 
            opacity: (isActive || isDragging) ? 1 : 0.3, 
            x: 0 
          }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed right-2 top-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center pointer-events-none"
        >
          <div className="relative h-40 w-8 flex items-center justify-center">
            {/* Track Visual */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-btn-border/30 rounded-full" />
            
            {/* Control Circle (Reduced Size) */}
            <motion.div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              animate={{ y: isDragging ? dragY : 0 }}
              transition={isDragging ? { type: "just" } : { type: "spring", stiffness: 400, damping: 30 }}
              className={cn(
                "w-6 h-6 rounded-full bg-zinc-900/80 backdrop-blur-md border border-brand-orange/40 shadow-2xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto touch-none transition-colors",
                isDragging ? "border-brand-orange bg-zinc-800" : "hover:border-brand-orange/60"
              )}
            >
              <div className={cn(
                "w-1 h-1 rounded-full transition-all",
                isDragging ? "bg-brand-orange scale-125" : "bg-brand-orange/60"
              )} />
              
              {isDragging && Math.abs(dragY) > 10 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {dragY < 0 ? (
                    <ChevronUp className="w-3 h-3 text-brand-orange/60 animate-pulse" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-brand-orange/60 animate-pulse" />
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const FavoritesPageLazy = lazy(() => import('./pages/FavoritesPage'));
const AdminVocalTonesPageLazy = lazy(() => import('./pages/AdminVocalTonesPage'));
const AdminSectionTagsPageLazy = lazy(() => import('./pages/AdminSectionTagsPage'));
const AdminUserManagementPageLazy = lazy(() => import('./pages/AdminUserManagementPage'));

const TROT_GENRES = ['traditional-trot', 'semi-trot'];

const GENRE_BPM: Record<string, { min: number; max: number }> = {
  'ballad': { min: 60, max: 85 },
  'pop': { min: 100, max: 130 },
  'jazz': { min: 70, max: 120 },
  'rnb': { min: 65, max: 95 },
  'hip-hop': { min: 80, max: 110 },
  'rock': { min: 110, max: 150 },
  'metal': { min: 120, max: 160 },
  'latin': { min: 95, max: 135 },
  'dance': { min: 120, max: 140 },
  'synth': { min: 105, max: 135 },
  'electronic': { min: 115, max: 150 },
  'piano': { min: 40, max: 90 },
  'new-age': { min: 40, max: 80 },
  'country': { min: 85, max: 125 },
  'traditional-trot': { min: 60, max: 90 },
  'semi-trot': { min: 120, max: 150 },
  'jpop': { min: 115, max: 145 },
  'guitar': { min: 70, max: 130 }
};

const SUBGENRE_BPM: Record<string, { min: number; max: number }> = {
  'synth_pop': { min: 110, max: 135 },
  'disco': { min: 115, max: 130 },
  'electropop': { min: 120, max: 140 },
  'teen_pop': { min: 100, max: 130 },
  'britpop': { min: 110, max: 140 },
  'indie_pop': { min: 90, max: 125 },
  'city_pop': { min: 105, max: 125 },
  'funk_pop': { min: 100, max: 125 },
  'dance_pop': { min: 120, max: 140 },
  'acoustic_pop': { min: 70, max: 110 },
  'idol_dance': { min: 120, max: 145 },
  'k_ballad': { min: 60, max: 85 },
  'k_synth_pop': { min: 110, max: 135 },
  'k_trap': { min: 130, max: 160 },
  'k_new_jack_swing': { min: 100, max: 115 },
  'k_indie': { min: 80, max: 115 },
  'k_folk': { min: 70, max: 100 },
  'k_rock': { min: 120, max: 155 },
  'gugak_fusion': { min: 80, max: 130 },
  'trap': { min: 130, max: 160 },
  'drill': { min: 140, max: 150 },
  'boombap': { min: 85, max: 100 },
  'lofi': { min: 70, max: 95 },
  'jazz_hiphop': { min: 85, max: 105 },
  'emo_rap': { min: 120, max: 160 },
  'old_school': { min: 90, max: 110 },
  'g_funk': { min: 85, max: 100 },
  'cloud_rap': { min: 110, max: 150 },
  'contemporary_rnb': { min: 65, max: 95 },
  'neo_soul': { min: 70, max: 95 },
  'soul': { min: 70, max: 110 },
  'funk': { min: 100, max: 120 },
  'alternative_rnb': { min: 60, max: 90 },
  'new_jack_swing': { min: 100, max: 115 },
  'alternative_rock': { min: 110, max: 150 },
  'modern_rock': { min: 115, max: 145 },
  'punk_rock': { min: 140, max: 170 },
  'hard_rock': { min: 110, max: 140 },
  'soft_rock': { min: 80, max: 120 },
  'garage_rock': { min: 120, max: 160 },
  'shoegazing': { min: 90, max: 130 },
  'folk_rock': { min: 100, max: 130 },
  'blues_rock': { min: 90, max: 130 },
  'heavy_metal': { min: 120, max: 160 },
  'death_metal': { min: 140, max: 180 },
  'thrash_metal': { min: 150, max: 190 },
  'metalcore': { min: 130, max: 170 },
  'nu_metal': { min: 90, max: 120 },
  'symphonic_metal': { min: 120, max: 160 },
  'power_metal': { min: 150, max: 180 },
  'house': { min: 120, max: 130 },
  'techno': { min: 125, max: 145 },
  'trance': { min: 130, max: 145 },
  'future_bass': { min: 140, max: 170 },
  'dubstep': { min: 140, max: 150 },
  'deep_house': { min: 115, max: 125 },
  'tropical_house': { min: 100, max: 120 },
  'eurobeat': { min: 150, max: 165 },
  'drum_and_bass': { min: 165, max: 185 },
  'swing_jazz': { min: 120, max: 180 },
  'bossa_nova': { min: 80, max: 120 },
  'fusion_jazz': { min: 100, max: 140 },
  'cool_jazz': { min: 70, max: 100 },
  'big_band': { min: 120, max: 160 },
  'latin_jazz': { min: 110, max: 150 },
  'jazz_vocal': { min: 70, max: 120 },
  'hard_bop': { min: 140, max: 200 },
  'traditional_folk': { min: 80, max: 120 },
  'country': { min: 90, max: 130 },
  'bluegrass': { min: 130, max: 170 },
  'singer_songwriter': { min: 70, max: 110 },
  'acoustic_session': { min: 70, max: 120 },
  'fingerstyle': { min: 70, max: 110 },
  'reggae': { min: 80, max: 100 },
  'afrobeat': { min: 110, max: 130 },
  'celtic': { min: 100, max: 140 },
  'latin_salsa': { min: 160, max: 200 },
  'flamenco': { min: 100, max: 160 },
  'traditional_trot': { min: 60, max: 90 },
  'semi_trot': { min: 120, max: 150 },
  'disco_trot': { min: 125, max: 145 },
  'rock_trot': { min: 120, max: 150 },
  'ballad_trot': { min: 65, max: 90 },
  'blues_trot': { min: 70, max: 100 },
  'shuffle_trot': { min: 110, max: 135 },
  'gugak_trot': { min: 80, max: 120 },
  '7080_folk': { min: 80, max: 110 },
  'adult_ballad': { min: 60, max: 85 },
  'campus_band_sound': { min: 110, max: 140 },
  'enka_style': { min: 60, max: 90 },
  'orchestral_score': { min: 60, max: 140 },
  'hybrid_epic': { min: 80, max: 150 },
  'synth_score': { min: 90, max: 130 },
  'piano_solo': { min: 40, max: 90 },
  'string_ensemble': { min: 50, max: 110 },
  'chiptune': { min: 120, max: 160 },
  'world_music': { min: 80, max: 140 },
  'minimalism': { min: 90, max: 130 },
  'ambient': { min: 40, max: 80 },
};

const MOOD_BPM: Record<string, { min: number; max: number }> = {
  'emotional': { min: 55, max: 90 },
  'sad': { min: 50, max: 82 },
  'warm': { min: 70, max: 105 },
  'calm': { min: 45, max: 78 },
  'dark': { min: 60, max: 100 },
  'bright': { min: 105, max: 135 },
  'hopeful': { min: 80, max: 118 },
  'lonely': { min: 45, max: 80 },
  'nostalgic': { min: 55, max: 88 },
  'dreamy': { min: 55, max: 92 },
  'tense': { min: 85, max: 125 },
  'peaceful': { min: 45, max: 76 }
};

const CYCLE_VARIANT_COLORS = [
  "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20",
  "bg-violet-600 border-violet-400 text-white shadow-lg shadow-violet-500/20",
  "bg-sky-600 border-sky-400 text-white shadow-lg shadow-sky-500/20",
  "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20",
  "bg-fuchsia-600 border-fuchsia-400 text-white shadow-lg shadow-fuchsia-500/20",
] as const;

function buildCycleLookup<T extends { variants: readonly { id: string }[] }>(cycles: readonly T[]) {
  return cycles.reduce<Record<string, T>>((acc, cycle) => {
    cycle.variants.forEach((variant) => {
      acc[variant.id] = cycle;
    });
    return acc;
  }, {});
}

const SOUND_TEXTURE_CYCLE_LOOKUP = buildCycleLookup(SOUND_TEXTURE_CYCLES);

function getCycleVariantLabel(cycles: readonly { id: string; title: string; variants: readonly { id: string; label: string }[] }[], selectedIds: string[]) {
  return cycles
    .map((cycle) => cycle.variants.find((variant) => selectedIds.includes(variant.id)))
    .filter(Boolean)
    .map((variant) => variant!.label);
}

const STYLE_VARIANT_LOOKUP = STYLE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, { id: string; label: string; labelKo?: string; description: string; descriptionKo?: string }>>((acc, variant) => {
  acc[variant.id] = variant;
  return acc;
}, {});

const STYLE_LABEL_TO_ID = STYLE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, string>>((acc, variant) => {
  acc[variant.label] = variant.id;
  return acc;
}, {});

const SOUND_VARIANT_LOOKUP = SOUND_TEXTURE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, { id: string; label: string; labelKo?: string; description: string; descriptionKo?: string }>>((acc, variant) => {
  acc[variant.id] = variant;
  return acc;
}, {});

const SOUND_LABEL_TO_ID = SOUND_TEXTURE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, string>>((acc, variant) => {
  acc[variant.label] = variant.id;
  return acc;
}, {});

const mapLabelsToIds = (labels: string[], category: CategoryItem[]) => {
  return labels.map(label => {
    // Special case for City Pop and K-Pop which might have extra labels
    if (label.includes('City Pop') || label === '80s Japanese Pop' || label === 'Funk' || label === 'Groovy' || label === 'Retro' || label === 'Nu-Disco' || label === 'Synth-pop') {
      return 'citypop';
    }
    if (label.includes('K-Pop')) {
      return 'kpop';
    }
    const item = category.find(c => c.label === label || c.id === label);
    return item ? item.id : null;
  }).filter(Boolean) as string[];
};

const resolveMidGenreId = (val: string) => {
  // 1. Check Hierarchy Main (MID)
  for (const group of GENRE_HIERARCHY) {
    const main = group.children.find(m => m.id === val || m.label === val || m.labelKo === val);
    if (main) return main.id;
  }
  // 2. Check Hierarchy Sub (if stored in genre[] by mistake)
  for (const group of GENRE_HIERARCHY) {
    for (const main of group.children) {
      const sub = main.children.find(s => s.id === val || s.label === val || s.labelKo === val);
      if (sub) return main.id;
    }
  }
  // 3. Fallback to GENRES but map to Hierarchy
  const item = GENRES.find(c => c.id === val || c.label === val || c.id === val.replace('_', '-'));
  if (item) {
    for (const group of GENRE_HIERARCHY) {
      const main = group.children.find(m => m.label === item.label || m.labelKo === item.labelKo || m.id === item.id.replace('-', '_'));
      if (main) return main.id;
    }
    return item.id;
  }
  return null;
};

const resolveSubGenreId = (val: string) => {
  for (const group of GENRE_HIERARCHY) {
    for (const main of group.children) {
      const sub = main.children.find(s => s.id === val || s.label === val || s.labelKo === val);
      if (sub) return sub.id;
    }
  }
  return null;
};

function resolveStyleIds(labelsOrIds: string[] = []) {
  return Array.from(new Set(labelsOrIds.map((value) => STYLE_LABEL_TO_ID[value] ?? (STYLE_VARIANT_LOOKUP[value] ? value : null)).filter(Boolean) as string[]));
}

function resolveSoundTextureIds(labelsOrIds: string[] = []) {
  return Array.from(new Set(labelsOrIds.map((value) => SOUND_LABEL_TO_ID[value] ?? (SOUND_VARIANT_LOOKUP[value] ? value : null)).filter(Boolean) as string[]));
}

function getStyleVariantLabelById(id: string) {
  const variant = STYLE_VARIANT_LOOKUP[id];
  return variant?.labelKo || variant?.label || id;
}

function getSoundVariantLabelById(id: string) {
  const variant = SOUND_VARIANT_LOOKUP[id];
  return variant?.labelKo || variant?.label || id;
}

function buildThemeSentence(themeLabels: string[] = []): string {
  if (!themeLabels.length) return '';
  if (themeLabels.length === 1) return `Focused on ${themeLabels[0].toLowerCase()}.`;
  if (themeLabels.length === 2) {
    return `Focused on ${themeLabels[0].toLowerCase()} and ${themeLabels[1].toLowerCase()}.`;
  }
  const lowered = themeLabels.map((label) => label.toLowerCase());
  return `Focused on ${lowered.slice(0, -1).join(', ')}, and ${lowered[lowered.length - 1]}.`;
}


const calculateOptimalBPM = (genres: string[], moods: string[], subGenre: string[] = []) => {
  let sumMin = 0;
  let sumMax = 0;
  let count = 0;

  // 1. Sub-genres (Highest weight)
  subGenre.forEach(sg => {
    if (SUBGENRE_BPM[sg]) {
      sumMin += SUBGENRE_BPM[sg].min * 2;
      sumMax += SUBGENRE_BPM[sg].max * 2;
      count += 2;
    }
  });

  // 2. Genres
  genres.forEach(g => {
    if (GENRE_BPM[g]) {
      sumMin += GENRE_BPM[g].min;
      sumMax += GENRE_BPM[g].max;
      count++;
    }
  });

  // 3. Moods
  moods.forEach(m => {
    if (MOOD_BPM[m]) {
      sumMin += MOOD_BPM[m].min;
      sumMax += MOOD_BPM[m].max;
      count++;
    }
  });

  if (count === 0) {
    const base = Math.floor(Math.random() * (140 - 50 + 1)) + 50;
    return { min: base, max: base + Math.floor(Math.random() * 21) };
  }

  let avgMin = Math.round(sumMin / count);
  let avgMax = Math.round(sumMax / count);

  const range = avgMax - avgMin;
  const finalMin = Math.max(40, avgMin + Math.floor(Math.random() * (range / 4)));
  const finalMax = Math.min(200, finalMin + Math.max(10, Math.floor(Math.random() * (range / 2 + 10))));

  return { min: finalMin, max: finalMax };
};


export function getTimestampMs(value: any): number {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    const ms = value.toDate().getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <Router>
        <App />
      </Router>
    </ErrorBoundary>
  );
}

function Navigation({ user, handleLogin, handleLogout, themeMode, toggleTheme, isAdminUser }: { user: User | null; handleLogin: () => void; handleLogout: () => void; themeMode: 'light' | 'dark' | 'system'; toggleTheme: () => void; isAdminUser: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Collapse menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setIsProfileOpen(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
      setIsProfileOpen(false);
    }, 2000);
  };

  // Collapse menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsExpanded(false);
      setIsProfileOpen(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHomeClick = () => {
    if (!user) {
      handleLogin();
      return;
    }
    if (location.pathname === '/') {
      scrollToTop();
    } else {
      navigate('/');
    }
    setIsExpanded(false);
  };

  const handleHistoryClick = () => {
    if (!user) {
      handleLogin();
      return;
    }
    if (location.pathname === '/history') {
      scrollToTop();
    } else {
      navigate('/history');
    }
    setIsExpanded(false);
  };

  const handleSunoClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      handleLogin();
    }
    setIsExpanded(false);
  };

  return (
    <>
      {/* Floating Bar (Menu Folder) */}
      <div 
        ref={menuRef}
        className="fixed top-6 left-4 md:left-8 2xl:left-[calc((100vw-1152px)/2-82px)] z-50 flex flex-col items-center gap-4"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Folder Trigger Icon */}
        <button 
          onClick={() => {
            if (isExpanded) {
              setIsExpanded(false);
              setIsProfileOpen(false);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            } else {
              setIsExpanded(true);
            }
          }}
          className={cn(
            "p-3 md:p-[14.4px] rounded-2xl bg-[var(--card-bg)]/90 border border-[var(--border-color)] backdrop-blur-md text-[var(--text-primary)] shadow-2xl transition-all z-50",
            isExpanded ? "bg-brand-orange border-brand-orange/50 scale-90 text-white" : "hover:bg-[var(--hover-bg)]"
          )}
        >
          <Menu className={cn("w-6 h-6 md:w-[28.8px] md:h-[28.8px] transition-transform", isExpanded && "rotate-90")} />
        </button>

        {/* Expanded Icons */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="flex flex-col items-center gap-4 md:gap-5"
            >
              {/* Profile Icon */}
              <div className="relative">
                {user ? (
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="relative overflow-hidden rounded-full border-2 border-brand-orange/30 shadow-xl hover:scale-110 transition-all group"
                  >
                    <img 
                      src={user.photoURL || 'https://picsum.photos/seed/user/100/100'} 
                      alt="Profile" 
                      className="w-10 h-10 md:w-12 md:h-12 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <button 
                    onClick={() => { handleLogin(); setIsExpanded(false); }}
                    className="p-2.5 md:p-3 rounded-2xl bg-[var(--card-bg)]/80 border border-[var(--border-color)] backdrop-blur-md text-[var(--text-primary)] shadow-xl hover:bg-[var(--hover-bg)] transition-all"
                  >
                    <UserIcon className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                )}

                {/* Profile Popup (Logout) */}
                <AnimatePresence>
                  {isProfileOpen && user && (
                    <motion.div
                      initial={{ opacity: 0, x: 10, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 10, scale: 0.95 }}
                      className="absolute left-full ml-3 top-0 w-32 md:w-40 py-2 bg-[var(--card-bg)]/95 border border-[var(--border-color)] backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-[var(--border-color)]/50 mb-1">
                        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] truncate font-medium">{user.displayName}</p>
                      </div>
                      {isAdminUser && (
                        <>
                          <button 
                            onClick={() => {
                              navigate('/admin/plans');
                              setIsProfileOpen(false);
                              setIsExpanded(false);
                            }}
                            className="w-full px-4 py-2 text-left text-[10px] md:text-[12px] text-[var(--text-primary)] hover:bg-brand-orange/10 hover:text-brand-orange transition-all flex items-center gap-2"
                          >
                            <Settings className="w-3 h-3" />
                            플랜 관리
                          </button>
                          <button 
                            onClick={() => {
                              navigate('/admin/users');
                              setIsProfileOpen(false);
                              setIsExpanded(false);
                            }}
                            className="w-full px-4 py-2 text-left text-[10px] md:text-[12px] text-[var(--text-primary)] hover:bg-brand-orange/10 hover:text-brand-orange transition-all flex items-center gap-2"
                          >
                            <Users className="w-3 h-3" />
                            회원 관리
                          </button>
                          <button 
                            onClick={() => {
                              navigate('/admin/vocals');
                              setIsProfileOpen(false);
                              setIsExpanded(false);
                            }}
                            className="w-full px-4 py-2 text-left text-[10px] md:text-[12px] text-[var(--text-primary)] hover:bg-brand-orange/10 hover:text-brand-orange transition-all flex items-center gap-2"
                          >
                            <Settings className="w-3 h-3" />
                            보컬 관리
                          </button>
                          <button 
                            onClick={() => {
                              navigate('/admin/tags');
                              setIsProfileOpen(false);
                              setIsExpanded(false);
                            }}
                            className="w-full px-4 py-2 text-left text-[10px] md:text-[12px] text-[var(--text-primary)] hover:bg-brand-orange/10 hover:text-brand-orange transition-all flex items-center gap-2"
                          >
                            <Tag className="w-3 h-3" />
                            태그 관리
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => {
                          handleLogout();
                          setIsProfileOpen(false);
                          setIsExpanded(false);
                          if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] md:text-[13px] font-bold text-brand-orange hover:bg-[var(--hover-bg)] transition-colors text-left"
                      >
                        로그아웃
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Home Icon */}
              <button 
                onClick={handleHomeClick}
                className="p-2.5 md:p-3 rounded-2xl bg-[var(--card-bg)]/80 border border-[var(--border-color)] backdrop-blur-md text-[var(--text-primary)] shadow-xl hover:bg-[var(--hover-bg)] transition-all"
                title="홈으로"
              >
                <HomeIcon className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Heart Icon (Favorites) */}
              <button 
                onClick={handleHistoryClick}
                className="p-2.5 md:p-3 rounded-2xl bg-[var(--card-bg)]/80 border border-[var(--border-color)] backdrop-blur-md text-[var(--text-primary)] shadow-xl hover:bg-[var(--hover-bg)] transition-all"
                title="내 보관함"
              >
                <HeartIcon className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Theme Toggle Button */}
              <button 
                onClick={toggleTheme}
                className="p-2.5 md:p-3 rounded-2xl bg-[var(--card-bg)]/80 border border-[var(--border-color)] backdrop-blur-md text-[var(--text-primary)] shadow-xl hover:bg-[var(--hover-bg)] transition-all"
                title={
                  themeMode === 'light' ? '다크 모드로 전환' : 
                  themeMode === 'dark' ? '시스템 설정으로 전환' : 
                  '라이트 모드로 전환'
                }
              >
                {themeMode === 'light' ? <Sun className="w-5 h-5 md:w-6 md:h-6" /> : 
                 themeMode === 'dark' ? <Moon className="w-5 h-5 md:w-6 md:h-6" /> : 
                 <Monitor className="w-5 h-5 md:w-6 md:h-6" />}
              </button>

              {/* Suno Icon */}
              <a 
                href="https://suno.com/create" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={handleSunoClick}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-[var(--text-primary)] flex items-center justify-center text-[var(--text-primary)] text-[9px] md:text-[11px] font-black tracking-tighter hover:scale-110 transition-all bg-transparent"
                title="Suno Create"
              >
                SUNO
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Menu - Login (Only on Home Page) */}
      {location.pathname === '/' && !user && (
        <div className="fixed top-6 right-4 md:right-8 2xl:right-[calc((100vw-1152px)/2+12px)] z-50">
          <button 
            onClick={handleLogin}
            className="px-4 py-2 rounded-2xl bg-brand-orange text-white text-[11px] font-bold shadow-lg shadow-brand-orange/20 hover:brightness-110 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Login
          </button>
        </div>
      )}
    </>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('themeMode') as 'light' | 'dark' | 'system';
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('themeMode') || 'system';
    if (savedMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return (savedMode === 'dark' ? 'dark' : 'light');
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = () => {
      if (themeMode === 'system') {
        setTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setTheme(themeMode as 'light' | 'dark');
      }
    };

    updateTheme();

    const handleChange = () => {
      if (themeMode === 'system') {
        setTheme(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('themeMode', themeMode);
  }, [theme, themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [subGenre, setSubGenre] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedInstrumentSounds, setSelectedInstrumentSounds] = useState<string[]>([]);
  
  const [lyricsLength, setLyricsLength] = useState<LyricsLength>('normal');
  const [isNoLyrics, setIsNoLyrics] = useState(false);
  const [songStructure, setSongStructure] = useState<SongStructure>('2');
  const [vocalMode, setVocalMode] = useState<VocalMode>('solo');
  const [vocalTones, setVocalTones] = useState<VocalTone[]>(VOCAL_TONES);
  const [selectedVocalToneId, setSelectedVocalToneId] = useState<string | undefined>(undefined);
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [vocalMembers, setVocalMembers] = useState<VocalMember[]>([]);
  const [rapEnabled, setRapEnabled] = useState(false);
  useEffect(() => {
    const total = maleCount + femaleCount;
    if (total === 0) {
      if (vocalMembers.length > 0) setVocalMembers([]);
      return;
    }

    // If counts match members, do nothing (preserve custom order/settings)
    const currentM = vocalMembers.filter(m => m.gender === 'male').length;
    const currentF = vocalMembers.filter(m => m.gender === 'female').length;
    if (currentM === maleCount && currentF === femaleCount && vocalMembers.length === total) return;

    setVocalMembers(prev => {
      const newMembers: VocalMember[] = [];
      let mRemaining = maleCount;
      let fRemaining = femaleCount;

      // Try to preserve existing members' roles and tones if gender matches
      // In group mode, we might have a custom order, so we try to match by index first
      for (let i = 0; i < total; i++) {
        const existing = prev[i];
        let gender: 'male' | 'female' = 'male';
        
        if (mRemaining > 0) {
          gender = 'male';
          mRemaining--;
        } else {
          gender = 'female';
          fRemaining--;
        }

        if (existing && existing.gender === gender) {
          newMembers.push(existing);
        } else {
          // Assign default roles
          let roles: VocalRole[] = [];
          if (vocalMode === 'solo') {
            roles = ['main'];
          } else if (vocalMode === 'duo') {
            roles = i === 0 ? ['main'] : ['sub'];
          } else {
            if (i === 0) roles = ['main'];
            else if (i === 1) roles = ['lead'];
            else roles = ['sub'];
          }

          // If rap is enabled and it's a solo or we need a rapper in group
          if (rapEnabled && (vocalMode === 'solo' || (vocalMode === 'group' && i === total - 1) || (vocalMode === 'duo' && i === 1))) {
            if (!roles.includes('rapper')) roles.push('rapper');
          }

          newMembers.push({
            id: `member_${Date.now()}_${i}`,
            gender,
            roles,
          });
        }
      }
      return newMembers;
    });
  }, [maleCount, femaleCount, vocalMode, rapEnabled]);

  const [pinnedGenres, setPinnedGenres] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_genres');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedThemes, setPinnedThemes] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_themes');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedStyles, setPinnedStyles] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_styles');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedInstrumentSounds, setPinnedInstrumentSounds] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_instrument_sounds');
    return saved ? JSON.parse(saved) : [];
  });



  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_genres', JSON.stringify(pinnedGenres));
  }, [pinnedGenres]);
  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_themes', JSON.stringify(pinnedThemes));
  }, [pinnedThemes]);
  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_styles', JSON.stringify(pinnedStyles));
  }, [pinnedStyles]);
  useEffect(() => {
    sessionStorage.setItem('soridraw_pinned_instrument_sounds', JSON.stringify(pinnedInstrumentSounds));
  }, [pinnedInstrumentSounds]);
  const [isGenreExpanded, setIsGenreExpanded] = useState(false);
  const [isStyleExpanded, setIsStyleExpanded] = useState(false);
  const [isSoundExpanded, setIsSoundExpanded] = useState(false);
  const [isMoodExpanded, setIsMoodExpanded] = useState(false);
  const [isVocalExpanded, setIsVocalExpanded] = useState(true);
  const [isSongStructureExpanded, setIsSongStructureExpanded] = useState(true);
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [sectionTags, setSectionTags] = useState<SectionTag[]>([]);

  // Load section tags from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'section_tags'),
      orderBy('label', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTags = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as SectionTag[];
      setSectionTags(fetchedTags);
    }, (err) => {
      console.error("Error fetching section tags for user UI:", err);
    });

    return () => unsubscribe();
  }, []);

  const toggleMainSections = (section: 'genre' | 'style' | 'sound') => {
    const isPC = window.innerWidth >= 1024;
    if (isPC) {
      const nextState = !isGenreExpanded;
      setIsGenreExpanded(nextState);
      setIsStyleExpanded(nextState);
      setIsSoundExpanded(nextState);
    } else {
      if (section === 'genre') setIsGenreExpanded(!isGenreExpanded);
      else if (section === 'style') setIsStyleExpanded(!isStyleExpanded);
      else if (section === 'sound') setIsSoundExpanded(!isSoundExpanded);
    }
  };

  const toggleSubSections = (section: 'mood' | 'theme') => {
    const isPC = window.innerWidth >= 1024;
    if (isPC) {
      const nextState = !isMoodExpanded;
      setIsMoodExpanded(nextState);
      setIsThemeExpanded(nextState);
    } else {
      if (section === 'mood') setIsMoodExpanded(!isMoodExpanded);
      else if (section === 'theme') setIsThemeExpanded(!isThemeExpanded);
    }
  };

  const [genreHeight, setGenreHeight] = useState(0);
  const [styleHeight, setStyleHeight] = useState(0);
  const [soundHeight, setSoundHeight] = useState(0);
  const [moodHeight, setMoodHeight] = useState(0);
  const [themeHeight, setThemeHeight] = useState(0);

  const row1MaxHeight = useMemo(() => Math.max(genreHeight, styleHeight, soundHeight), [genreHeight, styleHeight, soundHeight]);
  const row2MaxHeight = useMemo(() => Math.max(moodHeight, themeHeight), [moodHeight, themeHeight]);

  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [isGenreHierarchyModalOpen, setIsGenreHierarchyModalOpen] = useState(false);
  const [isActionButtonsTemporarilyHidden, setIsActionButtonsTemporarilyHidden] = useState(false);
  const scrollStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const genreModalHistoryPushedRef = useRef(false);
  const [activeGenreGroupId, setActiveGenreGroupId] = useState<string | null>(null);

  const openGenreModal = (groupId: string) => {
    setActiveGenreGroupId(groupId);
    setIsGenreModalOpen(true);
    window.history.pushState({ modal: 'genre' }, '');
    genreModalHistoryPushedRef.current = true;
  };

  const closeGenreModal = (source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && genreModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsGenreModalOpen(false);
    genreModalHistoryPushedRef.current = false;
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isGenreModalOpen) {
        closeGenreModal('history');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGenreModalOpen]);
  const [tempoEnabled, setTempoEnabled] = useState(true);
  const [minBPM, setMinBPM] = useState(90);
  const [maxBPM, setMaxBPM] = useState(110);
  const [userTier, setUserTier] = useState<TagTier>('free');
  const [userInput, setUserInput] = useState('');
  const [isLyricMode, setIsLyricMode] = useState(false);
  const [lyricDraft, setLyricDraft] = useState('');
  const [lyricMode, setLyricMode] = useState<'assist' | 'preserve'>('assist');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [history, setHistory] = useState<SongResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isConfirmingDeleteHistory, setIsConfirmingDeleteHistory] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isAppliedKeywordsExpanded, setIsAppliedKeywordsExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<CategoryItem | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const appliedKeywordsRef = useRef<HTMLDivElement>(null);
  const [appliedKeywordsHeight, setAppliedKeywordsHeight] = useState<number | string>(0);
  const actionButtonsAnchorRef = useRef<HTMLDivElement>(null);
  const [isActionsFloating, setIsActionsFloating] = useState(false);
  const selectedKeywordCount = selectedGenres.length + selectedThemes.length + selectedMoods.length + selectedStyles.length + selectedInstrumentSounds.length;
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLongPressStart = (item: CategoryItem) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setHoveredItem(item);
    }, 2000);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const applyTemplate = (template: PromptTemplate) => {
    // Helper to filter valid IDs
    const filterValid = (ids: string[] | undefined, validList: { id: string }[]) => {
      if (!ids) return [];
      const validIds = new Set(validList.map(item => item.id));
      return ids.filter(id => validIds.has(id));
    };

    // 1. Genres & SubGenres
    // SubGenres can be main genres or leaf genres in GENRE_HIERARCHY
    const allSubGenres = GENRE_HIERARCHY.flatMap(group => 
      group.children.flatMap(main => [main, ...(main.children || [])])
    );
    const validGenres = filterValid(template.genre, GENRES);
    const validSubGenres = filterValid(template.subGenre, allSubGenres);

    // Ensure that if a subGenre is selected, its parent main genre is also in selectedGenres
    const inferredGenres = new Set(validGenres);
    if (validSubGenres.length > 0) {
      validSubGenres.forEach(subId => {
        GENRE_HIERARCHY.forEach(group => {
          group.children.forEach(mainGenre => {
            if (mainGenre.id === subId || mainGenre.children?.some(sub => sub.id === subId)) {
              inferredGenres.add(mainGenre.id);
            }
          });
        });
      });
    }

    setSelectedGenres(Array.from(inferredGenres));
    setSubGenre(validSubGenres);

    // 2. Moods & Themes
    setSelectedMoods(filterValid(template.moods, MOODS));
    setSelectedThemes(filterValid(template.themes, THEMES));

    // 3. Styles & Sounds
    setSelectedStyles(filterValid(template.styles, SOUND_STYLES));
    setSelectedInstrumentSounds(filterValid(template.instrumentSounds, INSTRUMENT_SOUNDS));

    // 4. Vocal Settings
    setMaleCount(template.maleCount ?? 0);
    setFemaleCount(template.femaleCount ?? 0);
    setRapEnabled(template.rapEnabled ?? false);
    
    const isValidVocalTone = VOCAL_TONES.some(tone => tone.id === template.vocalToneId);
    setSelectedVocalToneId(isValidVocalTone ? template.vocalToneId : undefined);

    // 5. Structure & Mode
    if (template.songStructure) {
      setSongStructure(template.songStructure as SongStructure);
    }
    if (template.customStructure) {
      setCustomStructure(template.customStructure);
    }
    if (template.lyricMode) {
      setLyricMode(template.lyricMode);
    }
    
    // Scroll to input area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = (
    id: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
    limit = Number.POSITIVE_INFINITY
  ) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= limit) return prev;
      return [...prev, id];
    });
  };

const cycleFamilySelection = (
  cycleId: string,
  selected: string[],
  setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  cycles: readonly { id: string; variants: readonly { id: string }[] }[],
  maxCount = Number.POSITIVE_INFINITY
) => {
  setSelected((prev) => {
    const cycle = cycles.find((item) => item.id === cycleId);
    if (!cycle) return prev;
    const activeIndex = cycle.variants.findIndex((variant) =>
      prev.includes(variant.id)
    );
    const withoutFamily = prev.filter(
      (id) => !cycle.variants.some((variant) => variant.id === id)
    );
    if (activeIndex === -1) {
      if (withoutFamily.length >= maxCount) return prev;
      return [...withoutFamily, cycle.variants[0].id];
    }
    if (activeIndex < cycle.variants.length - 1) {
      return [...withoutFamily, cycle.variants[activeIndex + 1].id];
    }

    return withoutFamily;
  });
};

  useEffect(() => {
    if (appliedKeywordsRef.current) {
      setAppliedKeywordsHeight(appliedKeywordsRef.current.scrollHeight);
    }
  }, [isAppliedKeywordsExpanded, result]);

  useEffect(() => {
    const handleScroll = () => {
      let isFloating = false;
      if (actionButtonsAnchorRef.current) {
        const rect = actionButtonsAnchorRef.current.getBoundingClientRect();
        // Floating when anchor is below the bottom floating line
        // 120px accounts for button height + bottom margin
        isFloating = rect.top > window.innerHeight - 120;
        setIsActionsFloating(isFloating);
      }

      // Hide buttons temporarily while scrolling ONLY when floating
      if (isFloating) {
        setIsActionButtonsTemporarilyHidden(true);
        
        if (scrollStopTimerRef.current) {
          clearTimeout(scrollStopTimerRef.current);
        }
        
        scrollStopTimerRef.current = setTimeout(() => {
          setIsActionButtonsTemporarilyHidden(false);
        }, 2000);
      } else {
        // Always show when in original position
        setIsActionButtonsTemporarilyHidden(false);
        if (scrollStopTimerRef.current) {
          clearTimeout(scrollStopTimerRef.current);
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hoveredItem) {
      const timer = setTimeout(() => {
        setHoveredItem(null);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setIsTooltipHovered(false);
    }
  }, [hoveredItem]);

  const [exitCount, setExitCount] = useState(0);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // If there's a state object, it's likely a modal or internal navigation, so skip exit logic
      if (e.state) return;

      if (location.pathname === '/') {
        setExitCount(prev => {
          const newCount = prev + 1;
          
          if (newCount >= 4) {
            setToast({ message: '앱을 종료하려면 한 번 더 눌러주세요.', visible: true });
            if (newCount >= 5) {
              console.log('App Exit Triggered');
              // In a real PWA environment, you might use specific APIs to exit
            }
            return newCount;
          }
          
          if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
          exitTimerRef.current = setTimeout(() => setExitCount(0), 2000);
          
          return newCount;
        });
        
        // Push state back to prevent actual back navigation if on home
        window.history.pushState(null, '', window.location.href);
      }
    };

    // Initial push state to enable popstate on home
    if (location.pathname === '/') {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [location.pathname]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [kpopMode, setKpopMode] = useState<0 | 1 | 2>(0); // legacy K-Pop mode state
  const [isKoreanEnglishMix, setIsKoreanEnglishMix] = useState(false);
  const [customStructure, setCustomStructure] = useState<CustomSectionItem[]>([]);
  const [citypopMode, setCitypopMode] = useState<0 | 1 | 2>(0); // 0: unselected, 1: old, 2: modern
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('free');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const isAnyModalOpen = isGenreModalOpen || isGenreHierarchyModalOpen || isGuideModalOpen || isStructureModalOpen;
  const isAdminUser = useMemo(() => userRole === 'admin' || isAdminEmail(user?.email), [userRole, user?.email]);
  const effectiveUserTier: TagTier = isAdminUser ? 'pro+' : userTier;

  // Refs for stable access in callbacks
  const pinnedGenresRef = useRef(pinnedGenres);
  const pinnedThemesRef = useRef(pinnedThemes);
  const pinnedStylesRef = useRef(pinnedStyles);
  const pinnedInstrumentSoundsRef = useRef(pinnedInstrumentSounds);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const userRef = useRef(user);

  useEffect(() => { pinnedGenresRef.current = pinnedGenres; }, [pinnedGenres]);
  useEffect(() => { pinnedThemesRef.current = pinnedThemes; }, [pinnedThemes]);
  useEffect(() => { pinnedStylesRef.current = pinnedStyles; }, [pinnedStyles]);
  useEffect(() => { pinnedInstrumentSoundsRef.current = pinnedInstrumentSounds; }, [pinnedInstrumentSounds]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  useEffect(() => { userRef.current = user; }, [user]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasInitializedHomeRef = useRef(false);

  type ClearAllOptions = {
    preserveHistory?: boolean;
    preservePinned?: boolean;
  };

  // Real-time tempo calculation when in random mode
  useEffect(() => {
    if (tempoEnabled && (selectedGenres.length > 0 || selectedMoods.length > 0 || subGenre.length > 0)) {
      const { min, max } = calculateOptimalBPM(selectedGenres, selectedMoods, subGenre);
      setMinBPM(min);
      setMaxBPM(max);
    }
  }, [selectedGenres, selectedMoods, subGenre, tempoEnabled]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();

    let unsubFavs: (() => void) | null = null;
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (unsubFavs) {
        unsubFavs();
        unsubFavs = null;
      }
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (currentUser) {
        // Sync user role in real-time
        unsubUserDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.role) setUserRole(data.role as UserRole);
          } else {
            // Initial signup fallback
            setUserRole(isAdminEmail(currentUser.email) ? 'admin' : 'free');
          }
        }, (error) => {
          console.error('Failed to sync user role:', error);
        });

        const syncUserDoc = async () => {
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            // Fetch counts
            const favsSnap = await getDocs(query(collection(db, 'favorites'), where('uid', '==', currentUser.uid)));
            const songsSnap = await getDoc(doc(db, 'user_recent_songs', currentUser.uid));
            const songCount = songsSnap.exists() ? (songsSnap.data().songs?.length || 0) : 0;

            const baseData = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              lastLoginAt: Date.now(),
              favoriteCount: favsSnap.size,
              songGeneratedCount: songCount
            };

            if (!userSnap.exists()) {
              // Get current tier from user_plans if exists
              let initialRole: UserRole = 'free';
              if (isAdminEmail(currentUser.email)) {
                initialRole = 'admin';
              } else {
                const normalizedEmail = normalizeEmail(currentUser.email || '');
                if (normalizedEmail) {
                  const planSnap = await getDoc(doc(db, 'user_plans', normalizedEmail));
                  if (planSnap.exists()) {
                    const tier = planSnap.data()?.tier;
                    if (tier === 'pro' || tier === 'pro+') initialRole = 'pro';
                    if (tier === 'basic') initialRole = 'basic';
                  }
                }
              }

              await setDoc(userRef, {
                ...baseData,
                role: initialRole,
                accountStatus: 'active',
                paymentStatus: 'none',
                createdAt: Date.now(),
              });
            } else {
              await updateDoc(userRef, baseData);
            }
          } catch (error) {
            console.error('Failed to sync user document:', error);
          }
        };

        syncUserDoc();
        const loadUserPlan = async () => {
          try {
            if (isAdminEmail(currentUser.email)) {
              setUserTier('pro+');
              return;
            }

            const normalizedEmail = normalizeEmail(currentUser.email || '');
            if (!normalizedEmail) {
              setUserTier('free');
              return;
            }

            const planSnap = await getDoc(doc(db, 'user_plans', normalizedEmail));
            if (planSnap.exists()) {
              const tier = planSnap.data()?.tier;
              setUserTier(tier === 'pro' || tier === 'pro+' ? tier : 'free');
            } else {
              setUserTier('free');
            }
          } catch (error) {
            console.error('Failed to load user plan:', error);
            setUserTier('free');
          }
        };

        loadUserPlan();

        // Fetch favorites for the user
        const q = query(collection(db, 'favorites'), where('uid', '==', currentUser.uid));
        unsubFavs = onSnapshot(q, (snapshot) => {
          const favs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => {
              const aTime = a.createdAtMs || getTimestampMs(a.createdAt);
              const bTime = b.createdAtMs || getTimestampMs(b.createdAt);
              return bTime - aTime;
            });
          setFavorites(favs);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'favorites');
        });
      } else {
        setFavorites([]);
        setUserTier('free');
      }
    });

    return () => {
      unsubscribe();
      if (unsubFavs) unsubFavs();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
  }, []);

  const toggleFavorite = async (song: SongResult) => {
    if (!user) {
      showToast('로그인이 필요합니다.');
      handleLogin();
      return;
    }

    const existingFav = favorites.find(f => f.title === song.title && f.prompt === song.prompt);

    try {
      if (existingFav) {
        if (existingFav.isLocked) {
          showToast('잠긴 곡은 삭제할 수 없습니다.');
          return;
        }
        await deleteDoc(doc(db, 'favorites', existingFav.id));
        showToast('곡이 삭제 되었습니다.');
      } else {
        await addDoc(collection(db, 'favorites'), sanitizeForFirestore({
          uid: user.uid,
          title: song.title,
          lyrics: song.lyrics,
          prompt: song.prompt,
          appliedKeywords: song.appliedKeywords,
          isLocked: false,
          createdAt: serverTimestamp(),
          createdAtMs: Date.now()
        }));
        showToast('저장되었습니다.');
      }
    } catch (error) {
      handleFirestoreError(error, existingFav ? OperationType.DELETE : OperationType.CREATE, 'favorites');
    }
  };

  const updateFavorite = async (id: string, updates: Partial<any>) => {
    try {
      await updateDoc(doc(db, 'favorites', id), sanitizeForFirestore(updates));
      if ('isLocked' in updates) {
        showToast(updates.isLocked ? "곡을 잠궜습니다." : "잠김이 해제되었습니다.");
      } else {
        showToast('수정되었습니다.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'favorites');
    }
  };

  const clearAllFavorites = async () => {
    if (!user) return;
    const unlockedFavs = favorites.filter(f => !f.isLocked);
    if (unlockedFavs.length === 0) {
      showToast('삭제할 수 있는 곡이 없습니다.');
      return;
    }
    try {
      const batch = writeBatch(db);
      unlockedFavs.forEach(f => {
        batch.delete(doc(db, 'favorites', f.id));
      });
      await batch.commit();
      showToast(`${unlockedFavs.length}개의 곡이 삭제되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'favorites');
    }
  };

  const lockAllFavorites = async () => {
    if (!user) return;
    const unlockedFavs = favorites.filter(f => !f.isLocked);
    if (unlockedFavs.length === 0) {
      showToast('이미 모든 곡이 잠겨 있습니다.');
      return;
    }
    try {
      const batch = writeBatch(db);
      unlockedFavs.forEach(f => {
        batch.update(doc(db, 'favorites', f.id), { isLocked: true });
      });
      await batch.commit();
      showToast(`${unlockedFavs.length}개의 곡이 잠금 설정되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'favorites');
    }
  };

  const unlockAllFavorites = async () => {
    if (!user) return;
    const lockedFavs = favorites.filter(f => f.isLocked);
    if (lockedFavs.length === 0) {
      showToast('잠긴 곡이 없습니다.');
      return;
    }
    try {
      const batch = writeBatch(db);
      lockedFavs.forEach(f => {
        batch.update(doc(db, 'favorites', f.id), { isLocked: false });
      });
      await batch.commit();
      showToast(`${lockedFavs.length}개의 곡이 잠금 해제되었습니다.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'favorites');
    }
  };

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const applyKeywordsToNext = useCallback((appliedKeywords: SongResult['appliedKeywords']) => {
    let genreIds: string[] = [];
    let subGenreIds: string[] = [];

    // Step 1: Restore SUB genre
    if (appliedKeywords.subGenre && appliedKeywords.subGenre.length > 0) {
      const subId = resolveSubGenreId(appliedKeywords.subGenre[0]);
      if (subId) {
        subGenreIds = [subId];
        // Derive MID from SUB
        for (const group of GENRE_HIERARCHY) {
          for (const main of group.children) {
            if (main.children.some(s => s.id === subId)) {
              genreIds = [main.id];
              break;
            }
          }
          if (genreIds.length > 0) break;
        }
      }
    }

    // Step 2: Restore MID genre if not derived or if multiple exist
    if (genreIds.length === 0 && appliedKeywords.genre && appliedKeywords.genre.length > 0) {
      genreIds = appliedKeywords.genre.map(resolveMidGenreId).filter(Boolean) as string[];
    }

    // Step 3: Final validation - ensure MID is set if SUB is set
    if (subGenreIds.length > 0 && genreIds.length === 0) {
      const subId = subGenreIds[0];
      for (const group of GENRE_HIERARCHY) {
        for (const main of group.children) {
          if (main.children.some(s => s.id === subId)) {
            genreIds = [main.id];
            break;
          }
        }
        if (genreIds.length > 0) break;
      }
    }

    setSelectedGenres(Array.from(new Set(genreIds)));
    setSubGenre(Array.from(new Set(subGenreIds)));

    const moodIds = Array.from(new Set(mapLabelsToIds(appliedKeywords.mood, MOODS)));
    const themeIds = Array.from(new Set(mapLabelsToIds(appliedKeywords.theme, THEMES)));
    const styleIds = resolveStyleIds(appliedKeywords.style ?? appliedKeywords.theme ?? []);
    const instrumentSoundIds = resolveSoundTextureIds(appliedKeywords.instrumentSound ?? []);
    const resolvedKpopMode = appliedKeywords.kpopMode ?? (genreIds.includes('kpop') ? 1 : 0);
    const resolvedMixedLyrics = appliedKeywords.isKoreanEnglishMix ?? (appliedKeywords.kpopMode === 2);

    // Overwrite pinned keywords when applying from Favorites or Results
    setPinnedGenres([]);
    setPinnedThemes([]);

    setSelectedMoods(moodIds);
    setSelectedThemes(themeIds);
    setSelectedStyles(styleIds);
    setSelectedInstrumentSounds(instrumentSoundIds);
    setKpopMode(genreIds.includes('kpop') ? resolvedKpopMode : 0);
    setIsKoreanEnglishMix(resolvedMixedLyrics);
    setCitypopMode(genreIds.includes('citypop') ? ((appliedKeywords.citypopMode ?? 1) as 0 | 1 | 2) : 0);

    // Expand to include other generation settings
    if (appliedKeywords.lyricsLength) setLyricsLength(appliedKeywords.lyricsLength);
    if (appliedKeywords.isNoLyrics !== undefined) setIsNoLyrics(appliedKeywords.isNoLyrics);
    if (appliedKeywords.songStructure) setSongStructure(appliedKeywords.songStructure);
    if (appliedKeywords.maleCount !== undefined) setMaleCount(appliedKeywords.maleCount);
    if (appliedKeywords.femaleCount !== undefined) setFemaleCount(appliedKeywords.femaleCount);
    if (appliedKeywords.rapEnabled !== undefined) setRapEnabled(appliedKeywords.rapEnabled);
    if (appliedKeywords.customStructure) setCustomStructure(normalizeCustomStructure(appliedKeywords.customStructure));
    
    if (appliedKeywords.userInput !== undefined) setUserInput(appliedKeywords.userInput);
    if (appliedKeywords.lyricDraft !== undefined) setLyricDraft(appliedKeywords.lyricDraft);
    if (appliedKeywords.isLyricMode !== undefined) setIsLyricMode(appliedKeywords.isLyricMode);
    if (appliedKeywords.lyricMode !== undefined) setLyricMode(appliedKeywords.lyricMode);

    if (appliedKeywords.vocal) {
      const v = appliedKeywords.vocal;
      if (v.isToneSelected && v.globalToneId) {
        setSelectedVocalToneId(v.globalToneId);
      } else {
        setSelectedVocalToneId(undefined);
      }
      if (v.mode) setVocalMode(v.mode);
      if (v.members) setVocalMembers(v.members);
    }

    if (appliedKeywords.tempoConfig) {
      setTempoEnabled(appliedKeywords.tempoConfig.enabled);
      setMinBPM(appliedKeywords.tempoConfig.min);
      setMaxBPM(appliedKeywords.tempoConfig.max);
    } else if (appliedKeywords.tempo) {
      const bpmMatch = appliedKeywords.tempo.match(/(\d+)/g);
      if (bpmMatch) {
        if (bpmMatch.length === 1) {
          const bpm = parseInt(bpmMatch[0]);
          setMinBPM(bpm);
          setMaxBPM(bpm);
        } else if (bpmMatch.length === 2) {
          setMinBPM(parseInt(bpmMatch[0]));
          setMaxBPM(parseInt(bpmMatch[1]));
        }
        setTempoEnabled(false); // Manual mode
      }
    }

    showToast('키워드가 다음 곡에 적용되었습니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSelectedGenres, setSubGenre, setSelectedMoods, setSelectedThemes, setSelectedStyles, setSelectedInstrumentSounds, setKpopMode, setIsKoreanEnglishMix, setCitypopMode, setLyricsLength, setSongStructure, setPinnedGenres, setPinnedThemes, setMaleCount, setFemaleCount, setRapEnabled, setCustomStructure, setTempoEnabled, setMinBPM, setMaxBPM, showToast]);


  const [isGenreRandomized, setIsGenreRandomized] = useState(false);
  const [isMoodRandomized, setIsMoodRandomized] = useState(false);
  const [isThemeRandomized, setIsThemeRandomized] = useState(false);
  const [isStyleRandomized, setIsStyleRandomized] = useState(false);
  const [isSoundTextureRandomized, setIsSoundTextureRandomized] = useState(false);

  const randomizeCategory = (category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    const limits = {
      genre: 1,
      style: 3,
      sound: 3,
      mood: 5,
      theme: 4
    };
    
    const all = category === 'genre' ? GENRES : (category === 'mood' ? MOODS : (category === 'theme' ? THEMES : (category === 'style' ? SOUND_STYLES : INSTRUMENT_SOUNDS)));
    const pinned = category === 'genre' ? pinnedGenres : (category === 'theme' ? pinnedThemes : (category === 'style' ? pinnedStyles : pinnedInstrumentSounds));
    const isGenre = category === 'genre';
    
    // Calculate current count of other categories to respect total 15 limit
    const otherCount = (category === 'genre' ? 0 : selectedGenres.length) +
                       (category === 'mood' ? 0 : selectedMoods.length) +
                       (category === 'theme' ? 0 : selectedThemes.length) +
                       (category === 'style' ? 0 : selectedStyles.length) +
                       (category === 'sound' ? 0 : selectedInstrumentSounds.length);
    
    const maxForCat = limits[category];
    const maxAllowedByTotal = Math.max(0, 15 - otherCount);
    const finalLimit = Math.min(maxForCat, maxAllowedByTotal);
    
    // Start with pinned items, but don't exceed finalLimit
    let result = category === 'mood' ? [] : [...pinned].slice(0, finalLimit);
    
    const remainingPool = all.filter(item => 
      (category === 'mood' ? true : !pinned.includes(item.id)) && 
      (!isGenre || !TROT_GENRES.includes(item.id))
    );
    
    const currentCount = result.length;
    const needed = finalLimit - currentCount;
    
    let pickedIds: string[] = [];
    if (needed > 0) {
      // Pick between 1 and 'needed' items
      const additionalCount = Math.floor(Math.random() * needed) + 1;
      const picked = [...remainingPool].sort(() => 0.5 - Math.random()).slice(0, additionalCount);
      pickedIds = picked.map(p => p.id);
    }
    
    const final = [...result, ...pickedIds];
    
    if (category === 'genre') {
      setSelectedGenres(final);
      setIsGenreRandomized(true);
    } else if (category === 'mood') {
      setSelectedMoods(final);
      setIsMoodRandomized(true);
    } else if (category === 'theme') {
      setSelectedThemes(final);
      setIsThemeRandomized(true);
    } else if (category === 'style') {
      setSelectedStyles(final);
      setIsStyleRandomized(true);
    } else if (category === 'sound') {
      setSelectedInstrumentSounds(final);
      setIsSoundTextureRandomized(true);
    }
  };


  const handleGenreSelect = (genreId: string) => {
    setSelectedGenres([genreId]);
    setIsGenreRandomized(false);

    if (genreId === 'kpop') {
      setKpopMode(1);
    } else {
      setKpopMode(0);
    }

    if (genreId === 'citypop') {
      setCitypopMode(1);
    } else {
      setCitypopMode(0);
    }

    closeGenreModal('ui');
  };

  const randomizeSingleGenre = () => {
    const allSubGenres = GENRE_GROUPS.flatMap(group => group.children);
    const random = allSubGenres[Math.floor(Math.random() * allSubGenres.length)];
    if (!random) return;
    handleGenreSelect(random.id);
    setIsGenreRandomized(true);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      setHistory([]);
      setResult(null);
      setHistoryIndex(-1);
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // History state is now persisted per logged-in user in Firestore.
  useEffect(() => {
    if (!user) {
      setHistory([]);
      setResult(null);
      setHistoryIndex(-1);
      return;
    }

    const ref = doc(db, "user_recent_songs", user.uid);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const songs = snap.data().songs || [];
        
        // Sort songs: newest first (descending order)
        const sortedSongs = [...songs].sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeB - timeA;
        });
        
        // If no createdAt, keep original order
        const finalSongs = sortedSongs;

        setHistory(finalSongs);

        if (finalSongs.length > 0) {
          // Set to the first song (newest) on initial load/reconnect
          const firstIndex = 0;
          setHistoryIndex(firstIndex);
          historyIndexRef.current = firstIndex;
          setResult(finalSongs[firstIndex]);
        } else {
          setHistoryIndex(-1);
          setResult(null);
        }
      } else {
        setHistory([]);
        setResult(null);
        setHistoryIndex(-1);
      }
    });

    return () => unsubscribe();
  }, [user]);


  const toggleSelection = (id: string, category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    const setters = {
      genre: { state: selectedGenres, set: setSelectedGenres, pinned: pinnedGenres },
      mood: { state: selectedMoods, set: setSelectedMoods, pinned: [] },
      theme: { state: selectedThemes, set: setSelectedThemes, pinned: pinnedThemes },
      style: { state: selectedStyles, set: setSelectedStyles, pinned: pinnedStyles },
      sound: { state: selectedInstrumentSounds, set: setSelectedInstrumentSounds, pinned: pinnedInstrumentSounds }
    };
    
    const { state, set, pinned } = setters[category];
    
    // If pinned, don't allow unselecting unless unpinned first
    if (pinned.includes(id)) return;

    // Reset randomized state when manual change occurs
    if (category === 'genre') setIsGenreRandomized(false);
    if (category === 'mood') setIsMoodRandomized(false);
    if (category === 'theme') setIsThemeRandomized(false);
    if (category === 'style') setIsStyleRandomized(false);
    if (category === 'sound') setIsSoundTextureRandomized(false);

    // K-Pop Special Logic
    if (category === 'genre' && id === 'kpop') {
      const nextMode = ((kpopMode + 1) % 3) as 0 | 1 | 2;
      let canChange = true;
      
      if (nextMode !== 0 && !state.includes(id) && state.length >= 9) {
        canChange = false;
      }

      if (canChange) {
        setKpopMode(nextMode);
        if (nextMode === 0) {
          set(state.filter(i => i !== id));
        } else if (!state.includes(id)) {
          set([...state, id]);
        }

        // Update hover description
        const kpopItem = GENRES.find(g => g.id === 'kpop')!;
        let nextDesc = "K-Pop 장르를 선택하고 스타일(기본/Mix)을 순환하며 선택합니다.";
        if (nextMode === 2) nextDesc = "K-Pop (한글+영어): 한국어와 영어가 자연스럽게 섞인 K-Pop 스타일의 가사를 생성합니다.";
        else if (nextMode === 1) nextDesc = "K-Pop (기본): 한국의 대중음악으로, 다양한 장르가 혼합된 세련된 사운드입니다.";
        
        setHoveredItem({ ...kpopItem, description: nextDesc, _ts: Date.now() });
      }
      return;
    }

    // City Pop Special Logic
    if (category === 'genre' && id === 'citypop') {
      const nextMode = ((citypopMode + 1) % 3) as 0 | 1 | 2;
      let canChange = true;
      
      if (nextMode !== 0 && !state.includes(id) && state.length >= 9) {
        canChange = false;
      }

      if (canChange) {
        setCitypopMode(nextMode);
        if (nextMode === 0) {
          set(state.filter(i => i !== id));
        } else if (!state.includes(id)) {
          set([...state, id]);
        }

        // Update hover description
        const citypopItem = GENRES.find(g => g.id === 'citypop')!;
        let nextDesc = "City Pop 장르를 선택하고 스타일(올드/현대)을 순환하며 선택합니다.";
        if (nextMode === 2) nextDesc = "City Pop (현대): 누디스코, 신스팝, 매끄러운 현대적 감각이 더해진 모던 시티팝입니다.";
        else if (nextMode === 1) nextDesc = "City Pop (올드): 80년대 일본 팝, 펑크, 그루비한 레트로 사운드의 오리지널 시티팝입니다.";
        
        setHoveredItem({ ...citypopItem, description: nextDesc, _ts: Date.now() });
      }
      return;
    }

    if (state.includes(id)) {
      set(state.filter(i => i !== id));
      
      // Trot Logic: Auto-unselect moods
      if (category === 'genre') {
        if (id === 'traditional-trot') {
          const moodsToRemove = ['sad', 'nostalgic', 'lonely', 'emotional', 'dark'];
          setSelectedMoods(prev => prev.filter(m => !moodsToRemove.includes(m)));
        } else if (id === 'semi-trot') {
          const moodsToRemove = ['bright', 'hopeful', 'warm', 'tense'];
          setSelectedMoods(prev => prev.filter(m => !moodsToRemove.includes(m)));
        }
      }
    } else if (state.length < 10) {
      set([...state, id]);
      
      // Trot Logic: Auto-select moods
      if (category === 'genre') {
        if (id === 'traditional-trot') {
          const moodsToAdd = ['sad', 'nostalgic', 'lonely', 'emotional', 'dark'];
          setSelectedMoods(prev => {
            const combined = Array.from(new Set([...prev, ...moodsToAdd]));
            return combined.slice(0, 9);
          });
        } else if (id === 'semi-trot') {
          const moodsToAdd = ['bright', 'hopeful', 'warm', 'tense'];
          setSelectedMoods(prev => {
            const combined = Array.from(new Set([...prev, ...moodsToAdd]));
            return combined.slice(0, 9);
          });
        }
      }
    }

    // For all other items, update hover description on click (for mobile support)
    const item = [...GENRES, ...MOODS, ...THEMES].find(i => i.id === id);
    if (item) {
      setHoveredItem({ ...item, _ts: Date.now() });
    }
  };

  const togglePin = (id: string, category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    if (category === 'mood') return;
    const setters = {
      genre: { pinned: pinnedGenres, setPinned: setPinnedGenres, selected: selectedGenres, setSelected: setSelectedGenres },
      theme: { pinned: pinnedThemes, setPinned: setPinnedThemes, selected: selectedThemes, setSelected: setSelectedThemes },
      style: { pinned: pinnedStyles, setPinned: setPinnedStyles, selected: selectedStyles, setSelected: setSelectedStyles },
      sound: { pinned: pinnedInstrumentSounds, setPinned: setPinnedInstrumentSounds, selected: selectedInstrumentSounds, setSelected: setSelectedInstrumentSounds }
    };

    const { pinned, setPinned, selected, setSelected } = setters[category as Exclude<typeof category, 'mood'>];
    const isPinned = pinned.includes(id);

    if (isPinned) {
      setPinned(pinned.filter(i => i !== id));
    } else {
      // When pinning, ensure it's also selected
      if (!selected.includes(id)) {
        if (selected.length < 15) {
          setSelected([...selected, id]);
          setPinned([...pinned, id]);
        }
      } else {
        setPinned([...pinned, id]);
      }
    }
  };

  const clearCategory = (category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    if (category === 'genre') {
      setSelectedGenres(pinnedGenres);
      if (!pinnedGenres.includes('kpop')) setKpopMode(0);
      if (!pinnedGenres.includes('citypop')) setCitypopMode(0);
      setIsGenreRandomized(false);
    }
    if (category === 'mood') {
      setSelectedMoods([]);
      setIsMoodRandomized(false);
    }
    if (category === 'theme') {
      setSelectedThemes(pinnedThemes);
      setIsThemeRandomized(false);
    }
    if (category === 'style') {
      setSelectedStyles(pinnedStyles);
      setIsStyleRandomized(false);
    }
    if (category === 'sound') {
      setSelectedInstrumentSounds(pinnedInstrumentSounds);
      setIsSoundTextureRandomized(false);
    }
  };

  const clearAll = useCallback(async (options: ClearAllOptions = {}) => {
    const { preserveHistory = false, preservePinned = false } = options;

    if (!preservePinned) {
      setPinnedGenres([]);
      setPinnedThemes([]);
      setPinnedStyles([]);
      setPinnedInstrumentSounds([]);
    }

    setSelectedGenres(preservePinned ? pinnedGenresRef.current : []);
    setSubGenre([]);
    setSelectedMoods([]);
    setSelectedThemes(preservePinned ? pinnedThemesRef.current : []);
    setSelectedStyles(preservePinned ? pinnedStylesRef.current : []);
    setSelectedInstrumentSounds(preservePinned ? pinnedInstrumentSoundsRef.current : []);

    setKpopMode(0);
    setIsKoreanEnglishMix(false);
    setCitypopMode(0);

    setIsGenreRandomized(false);
    setIsMoodRandomized(false);
    setIsThemeRandomized(false);
    setIsStyleRandomized(false);
    setIsSoundTextureRandomized(false);
        // 펼쳐보기 상태 초기화
    setIsGenreExpanded(false);
    setIsStyleExpanded(false);
    setIsSoundExpanded(false);
    setIsMoodExpanded(false);
    setIsThemeExpanded(false);

    // 기본 열림 상태 유지 (앱 초기값 기준)
    setIsVocalExpanded(true);
    setIsSongStructureExpanded(true);

    // 적용된 키워드
    setIsAppliedKeywordsExpanded(false);

    setUserInput('');
    setLyricDraft('');
    setIsLyricMode(false);
    setLyricMode('assist');
    setLyricsLength('normal');
    setSongStructure('2');
    setMaleCount(0);
    setFemaleCount(0);
    setRapEnabled(false);
    setCustomStructure([]);

    setTempoEnabled(true);
    setMinBPM(90);
    setMaxBPM(110);

    if (!preserveHistory) {
      setResult(null);
      setHistoryIndex(-1);
      setHistory([]);

      if (userRef.current) {
        try {
          const ref = doc(db, "user_recent_songs", userRef.current.uid);
          await setDoc(ref, { songs: [] }, { merge: true });
        } catch (error) {
          console.error('Failed to clear history in Firestore:', error);
        }
      }
    } else {
      setResult(prev => {
        const currentHistory = historyRef.current;
        const currentIndex = historyIndexRef.current;
        if (currentHistory.length === 0) return null;
        if (currentIndex >= 0 && currentHistory[currentIndex]) return currentHistory[currentIndex];
        return currentHistory[0] ?? prev;
      });
    }
    // 상태 초기화들 다 끝난 뒤

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('전체 설정이 초기화되었습니다.');
  }, []); // Now truly stable

  const deleteHistoryItem = async (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    
    if (user) {
      try {
        const ref = doc(db, "user_recent_songs", user.uid);
        await setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true });
      } catch (e) {
        console.error("Failed to update history in Firestore:", e);
      }
    }

    setHistory(newHistory);
    
    if (newHistory.length === 0) {
      setResult(null);
      setHistoryIndex(-1);
    } else {
      const nextIndex = Math.min(index, newHistory.length - 1);
      setHistoryIndex(nextIndex);
      setResult(newHistory[nextIndex]);
    }
  };

  const clearHistory = async () => {
    if (window.confirm('모든 히스토리를 삭제하시겠습니까?')) {
      if (user) {
        try {
          const ref = doc(db, "user_recent_songs", user.uid);
          await setDoc(ref, { songs: [] }, { merge: true });
        } catch (e) {
          console.error("Failed to clear history in Firestore:", e);
        }
      }
      setHistory([]);
      setResult(null);
      setHistoryIndex(-1);
    }
  };

  // Reset filters on navigation to Home, but preserve generated song history
  useEffect(() => {
    if (location.pathname !== '/') return;

    const initializeHome = async () => {
      if (!hasInitializedHomeRef.current) {
        hasInitializedHomeRef.current = true;
        window.scrollTo(0, 0);
        return;
      }

      // 1. Clear current state (preserving history)
      await clearAll({ preserveHistory: true, preservePinned: true });

      // 2. Check for pending keywords from Favorites
      const pending = sessionStorage.getItem('pendingAppliedKeywords');
      if (pending) {
        try {
          const keywords = JSON.parse(pending);
          // This function clears pinned keywords and sets new ones
          applyKeywordsToNext(keywords);
          // 3. Prevent duplicate application
          sessionStorage.removeItem('pendingAppliedKeywords');
        } catch (e) {
          console.error('Failed to parse pending keywords', e);
        }
      }

      window.scrollTo(0, 0);
    };

    initializeHome();
  }, [location.pathname, applyKeywordsToNext, clearAll]);

  const unpinAll = (category: 'genre' | 'mood' | 'theme') => {
    if (category === 'genre') {
      setPinnedGenres([]);
      setIsGenreRandomized(false);
    }
    if (category === 'mood') {
      setIsMoodRandomized(false);
    }
    if (category === 'theme') {
      setPinnedThemes([]);
      setIsThemeRandomized(false);
    }
  };

  const applyRandom = () => {
    const getRandomForCategory = (all: CategoryItem[], pinned: string[], maxCount: number, isGenre: boolean = false) => {
      // Start with pinned, limited by maxCount
      let result = [...pinned].slice(0, maxCount);
      const remainingPool = all.filter(item => 
        !pinned.includes(item.id) && 
        (!isGenre || !TROT_GENRES.includes(item.id))
      );
      
      const currentCount = result.length;
      const needed = maxCount - currentCount;
      
      if (needed > 0) {
        // Pick a random number of items to add (at least 1 if current is 0)
        const minToPick = currentCount > 0 ? 0 : 1;
        const pickCount = Math.floor(Math.random() * (needed - minToPick + 1)) + minToPick;
        
        const picked = [...remainingPool].sort(() => 0.5 - Math.random()).slice(0, pickCount);
        result = [...result, ...picked.map(p => p.id)];
      }
      
      return result;
    };

    // 1. Genre Selection (1 Main + 1 Sub from Hierarchy)
    const allMainGenres = GENRE_HIERARCHY.flatMap((g) => g.children);
    const randomMain = allMainGenres[Math.floor(Math.random() * allMainGenres.length)];
    const randomSub = randomMain && randomMain.children.length > 0
      ? randomMain.children[Math.floor(Math.random() * randomMain.children.length)]
      : null;

    let g = randomMain ? [randomMain.id] : [];
    let sg = randomSub ? [randomSub.id] : [];

    // 2. Other categories with their limits
    // Limits: Style 3, Sound 3, Mood 5, Theme 4
    let s = getRandomForCategory(SOUND_STYLES, pinnedStyles, 3);
    let snd = getRandomForCategory(INSTRUMENT_SOUNDS, pinnedInstrumentSounds, 3);
    let m = getRandomForCategory(MOODS, [], 5);
    let t = getRandomForCategory(THEMES, pinnedThemes, 4);

    // 3. Total Limit 15 Check and Priority Trimming
    // Priority: Genre > Style > Sound > Mood > Theme (Theme is first to be cut)
    while (g.length + s.length + snd.length + m.length + t.length > 15) {
      if (t.length > 0) t.pop();
      else if (m.length > 0) m.pop();
      else if (snd.length > 0) snd.pop();
      else if (s.length > 0) s.pop();
      else break;
    }

    setSelectedGenres(g);
    setSubGenre(sg);
    setSelectedMoods(m);
    setSelectedThemes(t);
    setSelectedStyles(s);
    setSelectedInstrumentSounds(snd);

    setIsGenreRandomized(true);
    setIsMoodRandomized(true);
    setIsThemeRandomized(true);
    setIsStyleRandomized(true);
    setIsSoundTextureRandomized(true);

    // Random tempo logic
    if (tempoEnabled) {
      const { min, max } = calculateOptimalBPM(g, m, sg);
      setMinBPM(min);
      setMaxBPM(max);
    }
  };
const saveRecentSong = async (newSong: any) => {
  if (!user) return;

  try {
    const ref = doc(db, "user_recent_songs", user.uid);
    const snap = await getDoc(ref);

    let existingSongs: any[] = [];

    if (snap.exists()) {
      existingSongs = snap.data().songs || [];
    }

    const updatedSongs = [newSong, ...existingSongs].slice(0, 10);

    await setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true });

  } catch (e) {
    console.error("Failed to save recent songs:", e);
  }
};

  /* 
  useEffect(() => {
    const q = query(collection(db, 'vocalTones'), orderBy('sortOrder', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tones = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VocalTone[];
      setVocalTones(tones.filter(t => t.isActive));
      
      // Set default tone if available
      const defaultTone = tones.find(t => t.isDefault && t.isActive);
      if (defaultTone && !selectedVocalToneId) {
        setSelectedVocalToneId(defaultTone.id);
      }
    }, (err) => {
      console.error("Error fetching vocal tones:", err);
    });

    return () => unsubscribe();
  }, []);
  */

  const handleGenerate = async () => {
    if (!user) {
      showToast('로그인이 필요합니다.');
      handleLogin();
      return;
    }

    if (selectedGenres.length === 0) {
      showToast('최소 장르 1개를 선택해주세요.');
      return;
    }

    if (isGenerating) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setResult(prev => (prev ? { ...prev, title: '생성 중...' } : null));
    abortControllerRef.current = new AbortController();

    try {
      let finalGenres = [...selectedGenres];
      let finalMoods = [...selectedMoods];
      let finalThemes = [...selectedThemes];
      let finalStyles = [...selectedStyles];
      let finalInstrumentSounds = [...selectedInstrumentSounds];
      let randomKeywords: string[] = [];

      const hasGenre = finalGenres.length > 0;
      const hasMood = finalMoods.length > 0;
      const hasTheme = finalThemes.length > 0;
      const hasStyle = finalStyles.length > 0;
      const hasSound = finalInstrumentSounds.length > 0;

      const selectedCount = [hasGenre, hasMood, hasTheme, hasStyle, hasSound].filter(Boolean).length;

      // If nothing selected, pick random (5-15 total)
      if (selectedCount === 0) {
        const allItems = [
          ...GENRES.filter(i => !TROT_GENRES.includes(i.id)).map(i => ({ ...i, cat: 'genre' as const })),
          ...MOODS.map(i => ({ ...i, cat: 'mood' as const })),
          ...THEMES.map(i => ({ ...i, cat: 'theme' as const })),
          ...SOUND_STYLES.map(i => ({ ...i, cat: 'style' as const })),
          ...INSTRUMENT_SOUNDS.map(i => ({ ...i, cat: 'sound' as const })),
        ];

        const count = Math.floor(Math.random() * 11) + 5; // 5-15
        const picked = allItems.sort(() => 0.5 - Math.random()).slice(0, count);

        picked.forEach(p => {
          if (p.cat === 'genre') finalGenres.push(p.id);
          if (p.cat === 'mood') finalMoods.push(p.id);
          if (p.cat === 'theme') finalThemes.push(p.id);
          if (p.cat === 'style') finalStyles.push(p.id);
          if (p.cat === 'sound') finalInstrumentSounds.push(p.id);
          randomKeywords.push(p.label);
        });
      }

      let currentMinBPM = minBPM;
      let currentMaxBPM = maxBPM;

      // Apply optimal BPM for random selection or when tempo random is enabled
      if (tempoEnabled) {
        const { min, max } = calculateOptimalBPM(finalGenres, finalMoods, subGenre);
        currentMinBPM = min;
        currentMaxBPM = max;
        setMinBPM(min);
        setMaxBPM(max);
      }

      const tempoInfo =
        (currentMinBPM !== 40 || currentMaxBPM !== 160)
          ? currentMinBPM === currentMaxBPM
            ? `Exactly ${currentMinBPM} BPM`
            : `Between ${currentMinBPM} and ${currentMaxBPM} BPM`
          : undefined;

      // Trot specific prompt logic
      let specialPrompt = "";
      if (finalGenres.includes('traditional-trot')) {
        specialPrompt =
          "Heartbreaking / Sorrowful, Deep Vibrato, Crying Vocal style, Accordion-led, Nostalgic / Yearning.";
      } else if (finalGenres.includes('semi-trot')) {
        specialPrompt =
          "Infectious Rhythm, Upbeat & Cheerful, Driving 2-beat / 4-beat, Bright Brass section, Festive / Celebratory.";
      }

      const effectiveStyleIds = Array.from(new Set(finalStyles ?? []));
      const styleLabels = getCycleVariantLabel(STYLE_CYCLES, effectiveStyleIds);
      const themeLabels = finalThemes.map((id) => THEMES.find((item) => item.id === id)?.label || id);
      const soundTextureLabels = getCycleVariantLabel(SOUND_TEXTURE_CYCLES, finalInstrumentSounds);
      const hasBalladStyle = effectiveStyleIds.some((id) => ['ballad', 'classic-ballad'].includes(id));

      const genreLabels = finalGenres.flatMap(id => {
        if (id === 'citypop') {
          if (citypopMode === 1) return ["City Pop", "80s Japanese Pop", "Funk", "Groovy", "Retro"];
          if (citypopMode === 2) return ["Modern City Pop", "Nu-Disco", "Synth-pop", "Smooth"];
        }
        return [GENRES.find(g => g.id === id)?.label || id];
      });

      const getRecommendedVocalTone = (m: number, f: number, genres: string[], subGenres: string[]) => {
        if (vocalTones.length === 0) return null;
        
        // 1. Determine gender target
        let genderTarget: 'male' | 'female' | 'group' = 'male';
        if (m > 0 && f > 0) {
          genderTarget = 'group';
        } else if (f > 0) {
          genderTarget = 'female';
        } else if (m > 0) {
          genderTarget = 'male';
        } else {
          // Default if nothing selected
          genderTarget = 'male';
        }

        // 2. Filter candidates by gender
        let candidates = vocalTones.filter(t => {
          if (genderTarget === 'group') {
            return t.genderTarget === 'group' || t.genderTarget === 'unisex' || t.genderTarget === 'any';
          } else if (genderTarget === 'male') {
            return t.genderTarget === 'male' || t.genderTarget === 'any';
          } else {
            return t.genderTarget === 'female' || t.genderTarget === 'any';
          }
        });

        // 3. Try matching genre (SubGenre first, then MainGenre)
        const searchGenres = [...(subGenres || []), ...(genres || [])];
        for (const gId of searchGenres) {
          const match = candidates.find(t => t.genreTags && t.genreTags.includes(gId));
          if (match) return match;
        }

        // 4. Fallback (Strictly defined default values)
        if (genderTarget === 'group') {
          return vocalTones.find(t => t.id === 'balanced_group') || candidates[0] || vocalTones[0];
        } else if (genderTarget === 'female') {
          return vocalTones.find(t => t.id === 'female_airy') || candidates[0] || vocalTones[0];
        } else {
          return vocalTones.find(t => t.id === 'male_husky') || candidates[0] || vocalTones[0];
        }
      };

      const recommendedTone = getRecommendedVocalTone(maleCount, femaleCount, finalGenres, subGenre);

      const formation = maleCount > 0 && femaleCount > 0
        ? 'Mixed group vocal'
        : maleCount > 1
          ? 'Male group vocal'
          : maleCount === 1
            ? 'Solo male vocal'
            : femaleCount > 1
              ? 'Female group vocal'
              : femaleCount === 1
                ? 'Solo female vocal'
                : '';

      const buildSongPrompt = () => {
        const subGenreLabels = subGenre.map((id) => {
          const matched = GENRE_HIERARCHY
            .flatMap((group) => group.children)
            .flatMap((main) => main.children)
            .find((item) => item.id === id);
          return matched?.label || id;
        });

        const genreStr = [...genreLabels, ...subGenreLabels].length > 0
          ? [...genreLabels, ...subGenreLabels].join(', ')
          : 'Pop';
        const moodStr = finalMoods.length > 0
          ? finalMoods.map(id => MOODS.find(m => m.id === id)?.label || id).join(', ')
          : 'Emotional';
        const themeStr = buildThemeSentence(themeLabels);

        const selectedStyleText = styleLabels.length > 0 ? styleLabels.join(', ') : 'Core style kept close to the root genre';
        const selectedSoundText = soundTextureLabels.length > 0 ? soundTextureLabels.join(', ') : 'Balanced mainstream arrangement with tasteful detail';
        const selectedStyleIds = new Set(effectiveStyleIds);
        const selectedSoundFamilies = new Set(finalInstrumentSounds.map((id) => SOUND_TEXTURE_CYCLE_LOOKUP[id]?.id).filter(Boolean));
        const hasStyleId = (...ids: string[]) => ids.some((id) => selectedStyleIds.has(id));
        const hasSoundFamily = (...ids: string[]) => ids.some((id) => selectedSoundFamilies.has(id));

        const bpm = (tempoInfo || '')
          .replace('Between ', '')
          .replace('Exactly ', '')
          .replace(' and ', '–')
          || (finalMoods.includes('bright') || finalMoods.includes('hopeful') || finalMoods.includes('tense') || hasStyleId('dance', 'modern-edm', 'electronic', 'techno-style', 'house-style'))
            ? '118–132 BPM'
            : (hasBalladStyle || finalMoods.includes('calm') || finalMoods.includes('peaceful') || finalMoods.includes('sad') || finalMoods.includes('lonely'))
              ? '72–96 BPM'
              : '90–112 BPM';

        const drums = [
          hasSoundFamily('drums-family') ? `Primary drum character shaped by ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'drums-family'), finalInstrumentSounds).join(', ') || 'Drums'}` : null,
          hasSoundFamily('snare-family') ? `Snare detail using ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'snare-family'), finalInstrumentSounds).join(', ')}` : null,
          hasSoundFamily('hihats-family') ? `Hi-hat motion using ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'hihats-family'), finalInstrumentSounds).join(', ')}` : null,
          !hasSoundFamily('drums-family', 'snare-family', 'hihats-family') && hasBalladStyle ? 'Soft live-pop drums with restrained movement and emotional pacing' : null,
          !hasSoundFamily('drums-family', 'snare-family', 'hihats-family') && !hasBalladStyle ? 'Clean modern drums supporting the topline without overcrowding the mix' : null,
        ].filter(Boolean).join(', ');

        const bass = [
          hasSoundFamily('bass-family')
            ? `Bass focus built around ${getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'bass-family'), finalInstrumentSounds).join(', ')}`
            : (hasBalladStyle ? 'Warm supportive low end following the emotional chord movement' : 'Warm melodic bass supporting the harmony'),
          hasStyleId('g-funk', 'funk', 'p-funk') ? 'keep the groove elastic and rhythm-led' : null,
          hasStyleId('trap-style', 'hip-hop', 'boom-bap-style') ? 'let the low end lock firmly with the beat' : null,
        ].filter(Boolean).join(', ');

        const sound = [
          selectedSoundText,
          hasStyleId('anime-style', 'game-bgm-style') ? 'with melodic lift and scene-like transitions' : null,
          hasStyleId('classic-disco', 'modern-edm', 'electronic', 'house-style') ? 'while keeping a polished commercial finish' : null,
        ].filter(Boolean).join(', ');

        const texture = [
          hasSoundFamily('texture-family') ? getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'texture-family'), finalInstrumentSounds).join(', ') : null,
          hasSoundFamily('ambience-family') ? getCycleVariantLabel(SOUND_TEXTURE_CYCLES.filter(c => c.id === 'ambience-family'), finalInstrumentSounds).join(', ') : null,
          !hasSoundFamily('texture-family', 'ambience-family') && hasBalladStyle ? 'Emotion-first, gently rising, and spacious' : null,
          !hasSoundFamily('texture-family', 'ambience-family') && !hasBalladStyle ? 'Balanced, clear, and commercially polished' : null,
        ].filter(Boolean).join(', ');

        // --- Vocal Restoration Logic ---
        const genreVocalParts = subGenre.map((id) => {
          const matched = GENRE_HIERARCHY
            .flatMap((group) => group.children)
            .flatMap((main) => main.children)
            .find((item) => item.id === id);
          return matched?.vocal;
        }).filter(Boolean) as string[];

        const pickOneGenreVocal = (parts: string[]) => {
          if (parts.length === 0) return null;
          const allDescriptors = parts.flatMap(p => p.split(',').map(s => s.trim()));
          const harmonies = allDescriptors.find(d => d.toLowerCase().includes('harmonies'));
          if (harmonies) return harmonies;
          const hooks = allDescriptors.find(d => d.toLowerCase().includes('hooks'));
          if (hooks) return hooks;
          return allDescriptors[0];
        };
        const auxiliaryVocal = pickOneGenreVocal(genreVocalParts);

        const selectedTone = selectedVocalToneId ? vocalTones.find(t => t.id === selectedVocalToneId)?.label : null;
        const recTone = recommendedTone?.label;
        const primaryTone = selectedTone || recTone;

        const vocalDesignParts = [];
        if (formation) vocalDesignParts.push(formation);
        if (primaryTone) vocalDesignParts.push(primaryTone);
        if (auxiliaryVocal) vocalDesignParts.push(auxiliaryVocal);
        
        const vocalDesign = vocalDesignParts.length > 0 ? vocalDesignParts.join(', ') : 'Main lead vocal with harmony support where needed';

        const vocalStyle = [
          hasBalladStyle ? 'Tender and emotionally clear' : null,
          hasStyleId('anime-style', 'k-style') ? 'slightly dramatic with melodic lift' : null,
          finalMoods.includes('bright') ? 'youthful and open' : null,
          finalMoods.includes('warm') || finalMoods.includes('peaceful') ? 'gentle and reassuring' : null,
          finalMoods.includes('tense') ? 'focused and dynamically assertive' : null,
          !hasBalladStyle && !finalMoods.includes('bright') && !finalMoods.includes('warm') && !finalMoods.includes('tense') ? 'clear, expressive, and melody-led' : null,
        ].filter(Boolean).slice(0, 1).join(', '); // Limit to one additional styling

        const arrangement = [
          songStructure === 'custom' 
            ? `Custom structure: ${customStructure.map(s => {
                if (s.section === 'Instrumental' && s.tags.length > 0) {
                  return `${s.section}: ${s.tags[0]} Solo`;
                }
                return `${s.section}${s.tags.length > 0 ? ` (${s.tags.join(', ')})` : ''}`;
              }).join(' → ')}`
            : `Base structure: ${songStructure === '1' ? 'Intro → Verse 1 → Chorus / Drop → Outro' : songStructure === '2' ? 'Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro' : 'Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro'}`,
          hasBalladStyle ? 'allow a slower emotional rise through the pre-chorus and chorus' : 'keep the sectional contrast clear and memorable',
          selectedStyleText !== 'Core style kept close to the root genre' ? `style direction anchored by ${selectedStyleText}` : null,
        ].filter(Boolean).join(', ');

        return `·STYLE: ${genreStr}, ${selectedStyleText}, ${bpm}
·DRUMS: ${drums}
·BASS: ${bass}
·SOUND: ${sound}
·TEXTURE: ${texture}
·VOCAL: ${vocalDesign}
·VOCAL STYLE: ${vocalStyle}
·ARRANGEMENT: ${arrangement}
·MOOD: ${moodStr}
·THEME: ${themeStr || 'No explicit story theme selected.'}`.trim();
      };

      const songPrompt = buildSongPrompt();

      const payload = {
        genre: finalGenres[0] ?? null,
        subGenre: subGenre ?? [],
        isKpopSelected: (selectedGenres ?? []).includes('kpop'),
        moods: finalMoods.map(id => MOODS.find(m => m.id === id)?.label || id),
        themes: themeLabels,
        styles: finalStyles,
        instrumentSounds: finalInstrumentSounds,
        userInput,
        songPrompt,
        lyricsLength,
        songStructure,
        useAutoDuration: false,
        vocal: {
          male: maleCount,
          female: femaleCount,
          rap: rapEnabled,
          mode: vocalMode,
          globalToneId: selectedVocalToneId || recommendedTone?.id,
          isToneSelected: !!selectedVocalToneId,
          tonePrompt: selectedVocalToneId 
            ? vocalTones.find(t => t.id === selectedVocalToneId)?.promptCore
            : recommendedTone?.promptCore,
          members: vocalMembers,
        },
        tempo: tempoInfo,
        specialPrompt,
        kpopMode,
        isKoreanEnglishMix,
        customStructure,
        isNoLyrics,
        lyricDraft: isLyricMode ? lyricDraft : undefined,
        isLyricMode,
        lyricMode: isLyricMode ? lyricMode : undefined,
      };

      console.log("SELECTED GENRE:", selectedGenres);
      console.log("SELECTED SUB GENRE:", subGenre);
      console.log("GENERATE PAYLOAD:", payload);

      const song = await generateSong(payload);

      if (abortControllerRef.current?.signal.aborted) return;

      const newResult: SongResult = {
        ...song,
        prompt: song.prompt,
        appliedKeywords: {
          ...song.appliedKeywords,
          genre: selectedGenres,
          subGenre: subGenre,
          vocal: payload.vocal,
          vocalType: formation || 'Default',
          vocalTone: selectedVocalToneId 
            ? vocalTones.find(t => t.id === selectedVocalToneId)?.label 
            : null,
          rapEnabled: rapEnabled,
          isNoLyrics: isNoLyrics,
          isKoreanEnglishMix: isKoreanEnglishMix,
          kpopMode,
          isBallad: hasBalladStyle,
          userInput: userInput,
          lyricDraft: isLyricMode ? lyricDraft : undefined,
          isLyricMode,
          lyricMode: isLyricMode ? lyricMode : undefined,
          tempoConfig: {
            enabled: tempoEnabled,
            min: minBPM,
            max: maxBPM
          }
        },
        randomKeywords
      };

      setResult(newResult);
      setHistory(prev => [newResult, ...prev].slice(0, 10));
      await saveRecentSong(newResult);
      setHistoryIndex(0);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation cancelled');
      } else {
        console.error(error);
        const errorMessage = error.message || '곡 생성 중 오류가 발생했습니다.';
        if (errorMessage.includes('VITE_GEMINI_API_KEY')) {
          showToast('API 키가 설정되지 않았습니다. 설정을 확인해주세요.');
        } else if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('limit')) {
          showToast('무료 생성 한도를 초과했습니다. 나중에 다시 시도해주세요.');
        } else {
          showToast(errorMessage);
        }
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const navigateHistory = (direction: 'prev' | 'next') => {
    setIsConfirmingDeleteHistory(false);
    if (direction === 'prev' && historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setResult(history[newIndex]);
    } else if (direction === 'next' && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setResult(history[newIndex]);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const keywords = [
      `[Genres] ${result.appliedKeywords.genre.join(', ')}`,
      `[Moods] ${result.appliedKeywords.mood.join(', ')}`,
      result.appliedKeywords.theme?.length ? `[Themes] ${result.appliedKeywords.theme.join(', ')}` : '',
      result.appliedKeywords.style?.length ? `[Styles] ${result.appliedKeywords.style.join(', ')}` : '',
      result.appliedKeywords.instrumentSound?.length ? `[Sound / Texture] ${result.appliedKeywords.instrumentSound.map(getSoundVariantLabelById).join(', ')}` : '',
      result.appliedKeywords.vocalType ? `[Vocal] ${result.appliedKeywords.vocalType}${result.appliedKeywords.vocal?.isToneSelected && result.appliedKeywords.vocalTone ? ` (${result.appliedKeywords.vocalTone})` : ''}` : '',
      result.appliedKeywords.tempo ? `[Tempo] ${result.appliedKeywords.tempo}` : ''
    ].filter(Boolean).join('\n');

    const text = `
${keywords}

${result.title}

[Lyrics - English]
${result.lyrics.english}

[Lyrics - Korean]
${result.lyrics.korean}

[Music Prompt]
${result.prompt}
    `.trim();
    copyToClipboard(text, 'all');
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const isGlobalClearable = 
    selectedGenres.length > 0 ||
    selectedMoods.length > 0 ||
    selectedThemes.length > 0 ||
    selectedStyles.length > 0 ||
    selectedInstrumentSounds.length > 0 ||
    userInput !== '' ||
    lyricsLength !== 'normal' ||
    songStructure !== '2' ||
    maleCount > 0 ||
    femaleCount > 0 ||
    rapEnabled ||
    !tempoEnabled ||
    minBPM !== 90 ||
    maxBPM !== 110 ||
    kpopMode !== 0 ||
    isKoreanEnglishMix ||
    citypopMode !== 0 ||
    isGenreRandomized ||
    isMoodRandomized ||
    isThemeRandomized ||
    isStyleRandomized ||
    isSoundTextureRandomized;

  // --- Genre Display Logic ---
  const displayGenreKeywords = subGenre.length > 0 
    ? subGenre.map(id => {
        let label = id;
        for (const group of GENRE_HIERARCHY) {
          for (const main of group.children) {
            const sub = main.children.find(s => s.id === id);
            if (sub) {
              label = sub.label;
              break;
            }
          }
          if (label !== id) break;
        }
        return { id, type: 'genre' as const, label };
      })
    : selectedGenres.map(id => ({ 
        id, 
        type: 'genre' as const, 
        label: GENRES.find(item => item.id === id)?.labelKo || GENRES.find(item => item.id === id)?.label || id 
      }));

  const actionButtonsContent = (
    <>
      <div className="relative flex-shrink-0">
        <button
          onClick={() => {
            applyRandom();
            setHoveredItem({ id: 'random', label: 'Ramdom all', description: '키워드를 무작위로 조합합니다.' });
          }}
          onMouseEnter={() => setHoveredItem({ id: 'random', label: 'Ramdom all', description: '키워드를 무작위로 조합합니다.' })}
          onMouseLeave={() => {
            setHoveredItem(null);
            handleLongPressEnd();
          }}
          onTouchStart={() => handleLongPressStart({ id: 'random', label: 'Ramdom all', description: '키워드를 무작위로 조합합니다.' })}
          onTouchEnd={handleLongPressEnd}
          className="h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl bg-[var(--card-bg)] hover:bg-btn-hover text-[var(--text-primary)] transition-all border border-btn-border flex items-center justify-center gap-2 group/random shadow-btn"
        >
          <Dices className="w-5 h-5 text-brand-orange group-hover:rotate-180 transition-transform duration-500" />
          <span className="hidden md:block font-bold">랜덤 선택</span>
        </button>
      </div>

      <button
        onClick={() => {
          handleGenerate();
          setHoveredItem({ id: 'generate', label: '곡 생성하기', description: isGenerating ? '생성을 중단합니다.' : '입력한 키워드로 곡을 생성합니다.(장르는 필수 선택)' });
        }}
        onMouseEnter={() => setHoveredItem({ id: 'generate', label: '곡 생성하기', description: isGenerating ? '생성을 중단합니다.' : '입력한 키워드로 곡을 생성합니다.(장르는 필수 선택)' })}
        onMouseLeave={() => {
          setHoveredItem(null);
          handleLongPressEnd();
        }}
        onTouchStart={() => handleLongPressStart({ id: 'generate', label: '곡 생성하기', description: isGenerating ? '생성을 중단합니다.' : '입력한 키워드로 곡을 생성합니다.(장르는 필수 선택)' })}
        onTouchEnd={handleLongPressEnd}
        className={cn(
          "flex-1 py-4 md:py-5 rounded-2xl text-white font-black text-[25px] md:text-[34px] shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98]",
          isGenerating 
            ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30" 
            : "music-waves shadow-brand-orange/20 hover:brightness-110"
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
            <span>작곡 취소</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
            <span>곡 생성하기</span>
          </>
        )}
      </button>

      <div className="relative flex-shrink-0">
        <button
          onClick={() => clearAll({ preserveHistory: true })}
          onMouseEnter={() => setHoveredItem({ id: 'clear-all', label: 'Clear all', description: '선택한 옵션만 초기화하고, 아래 생성 곡 히스토리는 유지합니다.' })}
          onMouseLeave={() => setHoveredItem(null)}
          className={cn(
            "h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl transition-all border flex items-center justify-center gap-2 shadow-btn",
            isGlobalClearable
              ? "bg-[var(--card-bg)] border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
              : "bg-[var(--bg-primary)] border-btn-border text-[var(--text-secondary)]/50 cursor-not-allowed opacity-60"
          )}
          disabled={!isGlobalClearable}
        >
          <Trash2 className={cn("w-5 h-5", isGlobalClearable ? "text-red-500" : "text-red-500/30")} />
          <span className="hidden md:block font-bold">전체초기화</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans selection:bg-brand-orange/30">
      <Navigation user={user} handleLogin={handleLogin} handleLogout={handleLogout} themeMode={themeMode} toggleTheme={toggleTheme} isAdminUser={isAdminUser} />

      {/* Guide Button */}
      {user && (
        <div className="fixed top-6 right-20 md:right-28 2xl:right-[calc((100vw-1152px)/2-2px)] z-50">
          <button
            onClick={() => setIsGuideModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 md:py-3 rounded-2xl bg-[var(--card-bg)]/90 border border-[var(--border-color)] backdrop-blur-md text-[var(--text-primary)] shadow-xl hover:bg-[var(--hover-bg)] hover:scale-105 transition-all group"
          >
            <YoutubeIcon className="w-5 h-5 md:w-6 md:h-6 text-red-500 group-hover:scale-110 transition-transform" />
            <span className="hidden md:block font-bold">가이드</span>
          </button>
        </div>
      )}

      {/* Suno Icon at Top Right (Symmetrical to Floating Bar, moved 2cm right) - Always show after login */}
      {user && (
        <div className="fixed top-6 right-4 md:right-8 2xl:right-[calc((100vw-1152px)/2-82px)] z-50">
          <motion.div
            animate={{ 
              y: [0, -5, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <a 
              href="https://suno.com/create" 
              target="_blank" 
              rel="noopener noreferrer"
              onMouseEnter={() => setHoveredItem({ id: 'suno-main', label: 'Suno Create', description: 'Suno에서 음악을 생성합니다.' })}
              onMouseLeave={() => {
                setHoveredItem(null);
                handleLongPressEnd();
              }}
              onTouchStart={() => handleLongPressStart({ id: 'suno-main', label: 'Suno Create', description: 'Suno에서 음악을 생성합니다.' })}
              onTouchEnd={handleLongPressEnd}
              className="w-12 h-12 md:w-[57.6px] md:h-[57.6px] rounded-2xl border border-[var(--border-color)] flex items-center justify-center text-brand-orange text-[10px] md:text-[11px] font-black tracking-tighter hover:scale-110 transition-all bg-[var(--card-bg)]/90 backdrop-blur-md shadow-2xl"
              title="Suno Create"
            >
              SUNO
            </a>
          </motion.div>
        </div>
      )}

      <Routes>
        <Route path="/" element={
          <>

            {/* Header */}
            <header className="pt-24 pb-12 px-6 border-b border-[var(--border-color)] bg-gradient-to-b from-[var(--hover-bg)] to-transparent relative">
              <div className="max-w-6xl mx-auto">
                <div className="text-center">
                  <motion.div
                    initial={{ opacity: 0, y: -40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 100, damping: 10 }}
                    className="flex flex-col items-center justify-center mb-6"
                  >
                    <button 
                      onClick={() => {
                        if (!user) {
                          handleLogin();
                        } else {
                          navigate('/history');
                        }
                      }}
                      className="inline-flex items-center justify-center p-4 rounded-2xl bg-brand-orange/10 hover:bg-brand-orange/20 transition-all group"
                    >
                      <Music className="w-10 h-10 text-brand-orange group-hover:scale-110 transition-transform" />
                    </button>
                  </motion.div>
                  <h1 
                    className="text-3xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-2 font-display"
                    style={{ fontFamily: 'Verdana' }}
                  >
                    SORIDRAW's <span className="text-brand-orange">Studio</span>
                  </h1>
                  <p className="text-[11px] md:text-[13px] text-[var(--text-secondary)] font-medium tracking-widest uppercase mb-4">
                    Compose Your Atmosphere
                  </p>
                  <p 
                    className="max-w-2xl mx-auto leading-relaxed px-4"
                    style={{ fontFamily: 'Courier New', color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '14px' }}
                  >
                    <span className="text-[var(--text-primary)] opacity-80 font-bold text-xl md:text-2xl">나의 이야기를 음악으로</span><br />
                    <span className="text-[var(--text-secondary)]">세상에 단 하나 뿐인 나만의 곡을 만들어보세요</span>
                  </p>
                </div>
              </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
              {/* Selection Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <GenreHierarchySelector
                selectedGenre={selectedGenres}
                selectedSubGenre={subGenre}
                onSelectGenre={(id) => {
                  setSelectedGenres([id]);
                  setIsGenreRandomized(false);
                }}
                onSelectSubGenre={(id) =>
                  setSubGenre((prev) =>
                    prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
                  )
                }
                onCommitSelection={(mainId, subId) => {
                  setSelectedGenres(mainId ? [mainId] : []);
                  setSubGenre(subId ? [subId] : []);
                  setIsGenreRandomized(false);
                }}
                onClear={() => {
                  setSelectedGenres([]);
                  setSubGenre([]);
                  setIsGenreRandomized(false);
                }}
                onRandom={() => {
                  const allMainGenres = GENRE_HIERARCHY.flatMap((g) => g.children);
                  const randomMain = allMainGenres[Math.floor(Math.random() * allMainGenres.length)];
                  if (!randomMain) return;
                  
                  const randomSub = randomMain.children.length > 0
                    ? randomMain.children[Math.floor(Math.random() * randomMain.children.length)]
                    : null;
                    
                  setSelectedGenres([randomMain.id]);
                  setSubGenre(randomSub ? [randomSub.id] : []);
                  setIsGenreRandomized(true);
                }}
                onHover={setHoveredItem}
                isExpanded={isGenreExpanded}
                onToggleExpand={() => toggleMainSections('genre')}
                isRandomized={isGenreRandomized}
                onHeightChange={setGenreHeight}
                forcedHeight={window.innerWidth >= 1024 ? row1MaxHeight : undefined}
                onModalStateChange={setIsGenreHierarchyModalOpen}
              />
          <CycleSection 
            title="Style" 
            titleKo="스타일"
            description="Determines the expression and flow of the song. Depending on the selected style, the development and rhythmic feel of the song change, leading the overall impression of the music in the desired direction, such as classic, sophisticated, or emotional."
            descriptionKo="하이브리드 장르를 위해 선택하세요. 선택한 스타일에 따라 곡의 전개와 리듬감이 달라지며, 굳이 선택 안하고 기본 장르만으로도 좋은 곡을 만들수 있습니다 "
            cycles={STYLE_CYCLES}
            selected={selectedStyles}
            onCycleToggle={(cycleId) => cycleFamilySelection(cycleId, selectedStyles, setSelectedStyles, STYLE_CYCLES, 3)}
            onClear={() => { setSelectedStyles([]); setIsStyleRandomized(false); }}
            onRandom={() => randomizeCategory('style')}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            isRandomized={isStyleRandomized}
            isExpanded={isStyleExpanded}
            onToggleExpand={() => toggleMainSections('style')}
            onHeightChange={setStyleHeight}
            forcedHeight={window.innerWidth >= 1024 ? row1MaxHeight : undefined}
          />
          <CycleSection 
            title="Sound/Texture" 
            titleKo="사운드"
            description="Sets the instrument tone and background texture. By adjusting the grain of the sound, spaciousness, weight, and impact, it determines the auditory impression of the music, affecting the production of rich or clean sounds."
            descriptionKo="악기 톤과 배경 질감을 설정합니다. 기본 장르에 적용된 악기 사운드의 질감을 바꿔서 원하는 느낌으로 풍성하거나 깔끔한 사운드를 연출하는 데 영향을 줍니다."
            cycles={SOUND_TEXTURE_CYCLES}
            selected={selectedInstrumentSounds}
            onCycleToggle={(cycleId) => cycleFamilySelection(cycleId, selectedInstrumentSounds, setSelectedInstrumentSounds, SOUND_TEXTURE_CYCLES)}
            onClear={() => { setSelectedInstrumentSounds([]); setIsSoundTextureRandomized(false); }}
            onRandom={() => randomizeCategory('sound')}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            isRandomized={isSoundTextureRandomized}
            isExpanded={isSoundExpanded}
            onToggleExpand={() => toggleMainSections('sound')}
            onHeightChange={setSoundHeight}
            forcedHeight={window.innerWidth >= 1024 ? row1MaxHeight : undefined}
          />
        </div>

        <AnimatePresence>
          {isGenreModalOpen && activeGenreGroupId && (
            <GenreSelectModal
              group={GENRE_GROUPS.find((item) => item.id === activeGenreGroupId) ?? null}
              selectedGenreId={selectedGenres[0] ?? null}
              onClose={() => closeGenreModal('ui')}
              onSelect={handleGenreSelect}
            />
          )}
        </AnimatePresence>

        {/* Lyrics Length & Drum Style & Vocal Gender Controls */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <CategorySection 
              title="Mood" 
              titleKo="분위기"
              description="Determines the emotional curve and mood of the song. By setting the emotional core the music aims to convey, such as sadness, joy, or tension, it decides the overall emotional tone of the generated music."
              descriptionKo="곡의 감정선과 분위기를 결정합니다. 슬픔, 기쁨, 긴장감 등 음악이 전달하고자 하는 감정적 핵심을 설정하여, 생성되는 음악의 전반적인 감성적 톤을 결정합니다."
              items={MOODS} 
              selected={selectedMoods} 
              onToggle={(id) => toggleSelection(id, 'mood')}
              onClear={() => clearCategory('mood')}
              onRandom={() => randomizeCategory('mood')}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              hoveredItem={hoveredItem}
              isExpanded={isMoodExpanded}
              onToggleExpand={() => toggleSubSections('mood')}
              onHeightChange={setMoodHeight}
              forcedHeight={window.innerWidth >= 1024 ? row2MaxHeight : undefined}
              allExpanded={isGenreExpanded && isMoodExpanded && isThemeExpanded}
              isRandomized={isMoodRandomized}
              hidePin={true}
            />
            <CategorySection 
              title="Theme" 
              titleKo="주제"
              description="Determines the situation, story, and message of the song. Like love, breakup, night, or travel, it sets what the song talks about and what scene it paints."
              descriptionKo="곡의 상황, 이야기, 메시지를 결정합니다. 사랑, 이별, 밤, 여행처럼 노래가 무엇을 말하는지와 어떤 장면을 그릴지 설정합니다."
              items={THEMES} 
              selected={selectedThemes} 
              pinned={pinnedThemes}
              onToggle={(id) => toggleSelection(id, 'theme')}
              onTogglePin={(id) => togglePin(id, 'theme')}
              onClear={() => clearCategory('theme')}
              onUnpinAll={() => unpinAll('theme')}
              onRandom={() => randomizeCategory('theme')}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              hoveredItem={hoveredItem}
              isExpanded={isThemeExpanded}
              onToggleExpand={() => toggleSubSections('theme')}
              onHeightChange={setThemeHeight}
              forcedHeight={window.innerWidth >= 1024 ? row2MaxHeight : undefined}
              allExpanded={isGenreExpanded && isMoodExpanded && isThemeExpanded}
              isRandomized={isThemeRandomized}
            />
            <VocalControl 
              maleCount={maleCount}
              femaleCount={femaleCount}
              vocalMode={vocalMode}
              vocalTones={vocalTones}
              vocalMembers={vocalMembers}
              selectedToneId={selectedVocalToneId}
              rapEnabled={rapEnabled}
              onMaleChange={setMaleCount}
              onFemaleChange={setFemaleCount}
              onModeChange={setVocalMode}
              onMembersChange={setVocalMembers}
              onToneChange={setSelectedVocalToneId}
              onRapChange={setRapEnabled}
              isKoreanEnglishMix={isKoreanEnglishMix}
              onToggleKoreanEnglishMix={() => {
                const nextValue = !isKoreanEnglishMix;
                setIsKoreanEnglishMix(nextValue);
                setHoveredItem({
                  id: 'lyrics-mix-toggle',
                  label: '한/영 혼합',
                  description: nextValue
                    ? '선택한 장르와 관계없이 한국어와 영어가 자연스럽게 섞인 가사를 생성합니다.'
                    : '한/영 혼합을 끄고 기본 언어 흐름으로 되돌립니다.',
                  _ts: Date.now(),
                });
              }}
              onClear={() => {
                setMaleCount(0);
                setFemaleCount(0);
                setVocalMode('solo');
                setRapEnabled(false);
                setSelectedVocalToneId(undefined);
                setVocalMembers([]);
                setIsKoreanEnglishMix(false);
              }}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
            />
            <SongStructureIntegratedControl
              lyricsLength={lyricsLength}
              onLyricsLengthChange={setLyricsLength}
              isNoLyrics={isNoLyrics}
              onNoLyricsToggle={() => setIsNoLyrics(!isNoLyrics)}
              songStructure={songStructure}
              customStructure={customStructure}
              onSongStructureChange={setSongStructure}
              onCustomStructureChange={setCustomStructure}
              onModalStateChange={setIsStructureModalOpen}
              onClear={() => {
                setLyricsLength('normal');
                setIsNoLyrics(false);
                setSongStructure('2');
                setCustomStructure([]);
              }}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              user={user}
              userTier={effectiveUserTier}
              sectionTags={sectionTags}
            />
          </div>
        </div>

        {/* Tempo Control Bar */}
        <div className="mb-4">
          <TempoControl 
            enabled={tempoEnabled}
            onEnabledChange={setTempoEnabled}
            min={minBPM}
            max={maxBPM}
            onMinChange={setMinBPM}
            onMaxChange={setMaxBPM}
            onClear={() => {
              setTempoEnabled(true);
              setMinBPM(90);
              setMaxBPM(110);
            }}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
          />
        </div>

        {/* Search & Actions */}
        <div className="space-y-6">
          <div className="relative group">
            <div className="absolute top-6 left-4 pointer-events-none z-10">
              <Search className="w-5 h-5 text-[var(--text-secondary)] group-focus-within:text-brand-orange transition-colors" />
            </div>
            
              <textarea
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px';
                }}
                onFocus={() => {
                  setIsInputFocused(true);
                }}
                onBlur={() => setIsInputFocused(false)}
                className="w-full bg-[var(--bg-secondary)] border border-btn-border rounded-2xl py-5 pl-12 pr-6 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all text-lg min-h-[68px] max-h-[320px] resize-none overflow-y-auto custom-scrollbar relative shadow-[var(--shadow-lg)] placeholder:text-[var(--text-secondary)]/40 scroll-smooth shadow-inner"
                rows={1}
                placeholder="곡의 장르, 분위기, 특징을 콤마로 구분해서 입력하거나 문장으로 입력하세요..."
              />
                {/* Direct Lyrics Toggle Button */}
            <AnimatePresence>
              {(userInput.length > 0 || isInputFocused) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-4 bottom-4 z-20"
                >
                  <button
                    onClick={() => setIsLyricMode(!isLyricMode)}
                    onMouseEnter={() => setHoveredItem({ id: 'lyric-mode', label: '직접 작사', description: '가사 초안을 직접 입력하여 생성 결과에 우선 반영합니다.' })}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all border shadow-sm",
                      isLyricMode 
                        ? "bg-brand-orange text-white border-brand-orange" 
                        : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
                    )}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    직접 작사
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Direct Lyrics Input Area */}
          <AnimatePresence>
            {isLyricMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2 pb-4 space-y-3">
                  <div className="h-px bg-btn-border w-full" />
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                      <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                        이 아래 내용은 가사 초안으로 우선 반영됩니다.
                      </p>
                    </div>
                    
                    {/* Lyric Mode Selector */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-btn-bg rounded-lg p-0.5 border border-btn-border shadow-btn">
                        <button
                          onClick={() => setLyricMode('assist')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                            lyricMode === 'assist' 
                              ? "bg-brand-orange text-white shadow-sm" 
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          AI 보정
                        </button>
                        <button
                          onClick={() => setLyricMode('preserve')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                            lyricMode === 'preserve' 
                              ? "bg-brand-orange text-white shadow-sm" 
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          원문 유지
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setLyricDraft('');
                          setIsLyricMode(false);
                        }}
                        onMouseEnter={() => setHoveredItem({ id: 'delete-lyric', label: '가사 삭제', description: '입력한 가사 초안을 모두 지우고 창을 닫습니다.' })}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="p-1.5 rounded-lg bg-btn-bg border border-btn-border text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all shadow-btn"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative group">
                    <textarea
                      value={lyricDraft}
                      onChange={(e) => {
                        setLyricDraft(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 320) + 'px';
                      }}
                      placeholder="여기에 가사 초안을 자유롭게 적어주세요. 구조는 자동 반영됩니다."
                      className="w-full bg-[var(--bg-secondary)] border border-btn-border rounded-2xl py-4 px-5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange/30 transition-all text-[15px] min-h-[100px] max-h-[320px] resize-none overflow-y-auto custom-scrollbar placeholder:text-[var(--text-secondary)]/30 shadow-inner"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons Anchor */}
          <div ref={actionButtonsAnchorRef} className="relative">
            <div className={cn(
              "flex flex-row items-stretch gap-2 md:gap-4 w-full transition-all duration-300",
              (isActionsFloating || isAnyModalOpen) ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"
            )}>
              {actionButtonsContent}
            </div>
          </div>

          {/* Floating Action Buttons */}
          <AnimatePresence>
            {isActionsFloating && !isAnyModalOpen && !isActionButtonsTemporarilyHidden && (
              <Portal>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="fixed bottom-10 left-0 w-full z-[120] flex justify-center pointer-events-none px-6"
                >
                  <div className="pointer-events-auto flex flex-row items-stretch gap-2 md:gap-4 w-full max-w-6xl">
                    {actionButtonsContent}
                  </div>
                </motion.div>
              </Portal>
            )}
          </AnimatePresence>

          {/* Applied Keywords Display */}
          <div className="relative">
            <div className="flex flex-wrap gap-2 justify-center min-h-[84px] content-start">
              {[
                ...displayGenreKeywords,
                ...selectedThemes.map((id) => ({ id, type: 'theme' as const, label: THEMES.find((item) => item.id === id)?.labelKo || THEMES.find((item) => item.id === id)?.label || id })),
                ...selectedMoods.map((id) => ({ id, type: 'mood' as const, label: MOODS.find((item) => item.id === id)?.labelKo || MOODS.find((item) => item.id === id)?.label || id })),
                ...selectedStyles.map((id) => ({ id, type: 'style' as const, label: getStyleVariantLabelById(id) })),
                ...selectedInstrumentSounds.map((id) => ({ id, type: 'sound' as const, label: getSoundVariantLabelById(id) })),
                ...(isKoreanEnglishMix ? [{ id: 'mix', type: 'mix' as const, label: '#한/영 혼합' }] : []),
                ...(rapEnabled ? [{ id: 'rap', type: 'rap' as const, label: '#랩 ON' }] : []),
                ...(selectedVocalToneId ? [{ 
                  id: 'vocal-tone', 
                  type: 'vocal-tone' as const, 
                  label: `#보컬톤: ${vocalTones.find(t => t.id === selectedVocalToneId)?.label || '선택됨'}` 
                }] : []),
              ].map((item) => {
                  const chipClassName = item.type === 'style'
                    ? 'px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-400/20 text-violet-300 text-xs font-bold flex items-center gap-1.5 shadow-sm'
                    : item.type === 'sound'
                      ? 'px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-bold flex items-center gap-1.5 shadow-sm'
                      : item.type === 'mix' || item.type === 'rap' || item.type === 'vocal-tone'
                        ? 'px-3 py-1.5 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-bold flex items-center gap-1.5 shadow-sm'
                        : 'px-3 py-1.5 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-bold flex items-center gap-1.5 shadow-sm';
                  return (
                    <span
                      key={`${item.type}-${item.id}`}
                      className={chipClassName}
                    >
                      {item.label}
                      <button 
                        onClick={() => {
                          if (item.type === 'genre') toggleSelection(item.id, 'genre');
                          else if (item.type === 'theme') toggleSelection(item.id, 'theme');
                          else if (item.type === 'mood') toggleSelection(item.id, 'mood');
                          else if (item.type === 'style') setSelectedStyles((prev) => prev.filter((value) => value !== item.id));
                          else if (item.type === 'sound') setSelectedInstrumentSounds((prev) => prev.filter((value) => value !== item.id));
                          else if (item.type === 'mix') setIsKoreanEnglishMix(false);
                          else if (item.type === 'rap') setRapEnabled(false);
                          else if (item.type === 'vocal-tone') setSelectedVocalToneId(undefined);
                        }}
                        className="hover:bg-btn-hover rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Result Area */}
        <AnimatePresence>
          {user && result && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10 pt-20 border-t-2 border-[var(--border-color)]/20"
            >


              {/* Title Card */}
              <div className="bg-[var(--card-bg)] rounded-3xl p-8 border border-[var(--border-color)]/80 shadow-[var(--shadow-lg)] relative overflow-hidden group hover:border-brand-orange/20 transition-all duration-500">
          <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
                    <button
                      onClick={() => navigate('/history')}
                      onMouseEnter={() =>
                        setHoveredItem({
                          id: 'go-history',
                          label: '보관함으로 이동',
                          description: '보관함 페이지로 이동합니다.',
                        })
                      }
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-[var(--hover-bg)] hover:bg-brand-orange/10 text-brand-orange border border-brand-orange/30 hover:border-brand-orange/40 transition-all active:scale-95 shadow-sm"
                    >
                      <HeartIcon className="w-5 h-5" />
                      <span className="text-xs md:text-sm font-bold whitespace-nowrap">보관함</span>
                    </button>
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
                    <button
                      onClick={() => copyToClipboard(result.title, 'title')}
                      onMouseEnter={() =>
                        setHoveredItem({
                          id: 'copy-title',
                          label: '제목 복사',
                          description: '곡의 제목을 복사합니다.',
                        })
                      }
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)]/30 active:scale-95"
                    >
                      {copiedType === 'title' ? (
                        <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 md:w-5 md:h-5" />
                      )}
                      <span className="hidden md:block text-sm font-bold whitespace-nowrap">복사</span>
                    </button>
                  </div>

                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    {historyIndex === 0 && (
                      <span className="px-3 py-1 bg-brand-white/10 text-brand-White text-[10px] font-bold rounded-full border border-brand-orange/17 normal-case tracking-normal mb-1">
                        최근 생성 곡
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-brand-orange font-mono text-sm tracking-widest uppercase font-bold">
                      <Music className="w-4 h-4" />
                      제목 (Title)
                    </div>
                  </div>
                  <div className="h-[60px] md:h-auto flex items-center justify-center">
                    <h2 className="text-[15px] md:text-2xl font-bold text-[var(--text-primary)] leading-tight line-clamp-2 text-center">
                      {result.title}
                    </h2>
                  </div>

                  {/* History Navigation & Heart Icon Below Title */}
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        if (isConfirmingDeleteHistory) {
                          deleteHistoryItem(historyIndex);
                          setIsConfirmingDeleteHistory(false);
                        } else {
                          setIsConfirmingDeleteHistory(true);
                          setTimeout(() => setIsConfirmingDeleteHistory(false), 3000);
                        }
                      }}
                      className={cn(
                        "p-2.5 rounded-2xl border shadow-lg transition-all group/trash flex items-center justify-center min-w-[44px]",
                        isConfirmingDeleteHistory 
                          ? "bg-red-500 text-white border-red-600" 
                          : "bg-[var(--hover-bg)] border-[var(--border-color)] hover:bg-red-500/20"
                      )}
                      title={isConfirmingDeleteHistory ? "정말 삭제하시겠습니까?" : "히스토리에서 삭제"}
                    >
                      {isConfirmingDeleteHistory ? (
                        <span className="text-[10px] font-bold px-1 whitespace-nowrap">삭제 확인</span>
                      ) : (
                        <Trash2 className="w-5 h-5 text-[var(--text-secondary)] group-hover/trash:text-red-500" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigateHistory('prev')}
                        disabled={historyIndex >= history.length - 1}
                        className={cn(
                          "px-4 py-3 rounded-xl transition-all border",
                          "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                        )}
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-mono font-bold text-[var(--text-secondary)] min-w-[80px] text-center">
                        {historyIndex + 1} / {history.length}
                      </span>
                      <button
                        onClick={() => navigateHistory('next')}
                        disabled={historyIndex <= 0}
                        className={cn(
                          "px-4 py-3 rounded-xl transition-all border",
                          "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
                        )}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => toggleFavorite(result)}
                      className="p-2.5 rounded-2xl bg-[var(--hover-bg)] border border-[var(--border-color)] shadow-lg transition-all hover:bg-[var(--hover-bg)]/20 group/heart"
                    >
                      <Heart 
                        className={cn(
                          "w-5 h-5 transition-all",
                          favorites.some(f => f.title === result.title && f.prompt === result.prompt)
                            ? "fill-brand-orange text-brand-orange"
                            : "text-[var(--text-primary)] group-hover/heart:text-brand-orange"
                        )} 
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Applied Keywords After Generation */}
              <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)]/80 shadow-[var(--shadow-md)] relative hover:border-brand-orange/10 transition-all duration-500">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-brand-orange" />
                    적용된 키워드
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => applyKeywordsToNext(result.appliedKeywords)}
                      onMouseEnter={() => setHoveredItem({ id: 'apply-keywords-all', label: '다음 곡에 적용', description: '이 곡의 모든 설정을 다음 곡 생성에 적용합니다.' })}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center justify-center gap-1.5 px-3 h-9 min-w-[90px] rounded-xl bg-[var(--card-bg)] text-brand-orange hover:bg-brand-orange/10 transition-all shadow-sm text-[11px] font-bold border border-brand-orange/30 active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">다음 곡에 적용</span>
                    </button>
                  </div>
                </div>
                
                <motion.div 
                  initial={false}
                  animate={{ 
                    height: isAppliedKeywordsExpanded ? appliedKeywordsHeight : 0,
                    opacity: isAppliedKeywordsExpanded ? 1 : 0
                  }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div ref={appliedKeywordsRef} className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2">
                    {[
                      {
                        key: 'genre',
                        title: 'genre',
                        values: (result.appliedKeywords.subGenre && result.appliedKeywords.subGenre.length > 0)
                          ? result.appliedKeywords.subGenre
                          : (result.appliedKeywords.genre ?? []),
                        accent: 'default' as const,
                        getDescription: (kw: string) => GENRES.find((item) => item.label === kw || item.id === kw)?.description,
                        getLabel: (kw: string) => {
                          for (const group of GENRE_HIERARCHY) {
                            for (const main of group.children) {
                              const sub = main.children.find(s => s.id === kw);
                              if (sub) return sub.label;
                            }
                          }
                          return GENRES.find((item) => item.label === kw || item.id === kw)?.label ?? kw;
                        },
                      },
                      {
                        key: 'theme',
                        title: 'theme',
                        values: result.appliedKeywords.theme ?? [],
                        accent: 'default' as const,
                        getDescription: (kw: string) => THEMES.find((item) => item.label === kw || item.id === kw)?.description,
                        getLabel: (kw: string) => THEMES.find((item) => item.label === kw || item.id === kw)?.label ?? kw,
                      },
                      {
                        key: 'style',
                        title: 'style',
                        values: result.appliedKeywords.style ?? [],
                        accent: 'violet' as const,
                        getDescription: (kw: string) => STYLE_VARIANT_LOOKUP[STYLE_LABEL_TO_ID[kw] ?? kw]?.description,
                        getLabel: (kw: string) => STYLE_VARIANT_LOOKUP[STYLE_LABEL_TO_ID[kw] ?? kw]?.label ?? kw,
                      },
                      {
                        key: 'mood',
                        title: 'mood',
                        values: result.appliedKeywords.mood ?? [],
                        accent: 'default' as const,
                        getDescription: (kw: string) => MOODS.find((item) => item.label === kw || item.id === kw)?.description,
                        getLabel: (kw: string) => MOODS.find((item) => item.label === kw || item.id === kw)?.label ?? kw,
                      },
                      {
                        key: 'instrumentSound',
                        title: 'sound / texture',
                        values: result.appliedKeywords.instrumentSound ?? [],
                        accent: 'sky' as const,
                        getDescription: (kw: string) => SOUND_VARIANT_LOOKUP[SOUND_LABEL_TO_ID[kw] ?? kw]?.description,
                        getLabel: (kw: string) => SOUND_VARIANT_LOOKUP[SOUND_LABEL_TO_ID[kw] ?? kw]?.label ?? kw,
                      },
                    ].filter((section) => section.values.length > 0).map((section) => (
                      <div key={section.key} className="space-y-0.5 group/cat">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">{section.title}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {section.values.map((kw, idx) => {
                            const displayLabel = section.getLabel(kw);
                            const description = section.getDescription(kw);
                            const isRandom = result.randomKeywords?.includes(displayLabel) || result.randomKeywords?.includes(kw);
                            
                            return (
                              <span 
                                key={idx} 
                                onMouseEnter={() => {
                                  if (description) {
                                    setHoveredItem({ id: `kw-${section.key}-${idx}`, label: displayLabel, description });
                                  }
                                }}
                                onMouseLeave={() => setHoveredItem(null)}
                                className={cn(
                                  "px-1.5 py-0.5 rounded-md text-[11px] transition-all cursor-help border",
                                  section.accent === 'violet'
                                    ? "bg-violet-500/10 text-violet-300 border-violet-400/20"
                                    : section.accent === 'sky'
                                      ? "bg-sky-500/10 text-sky-300 border-sky-400/20"
                                      : isRandom 
                                        ? "bg-brand-orange/20 text-brand-orange font-bold border-brand-orange/30" 
                                        : "bg-[var(--input-bg)] text-[var(--text-secondary)] border-[var(--border-color)]"
                                )}
                              >
                                {displayLabel}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {(result.appliedKeywords.vocalType || (result.appliedKeywords.vocal?.isToneSelected && result.appliedKeywords.vocalTone)) && (
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">vocal</p>
                        <div className="flex flex-wrap gap-1">
                          {result.appliedKeywords.vocalType && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--border-color)] cursor-help"
                              onMouseEnter={() => setHoveredItem({ id: 'kw-vocal', label: 'Vocal', description: '곡의 보컬 구성을 나타냅니다.' })}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              {result.appliedKeywords.vocalType}
                            </span>
                          )}
                          {result.appliedKeywords.vocal?.isToneSelected && result.appliedKeywords.vocalTone && (
                            <span 
                              className="px-1.5 py-0.5 rounded-md text-[11px] bg-brand-orange/10 text-brand-orange border border-brand-orange/20 cursor-help"
                              onMouseEnter={() => setHoveredItem({ id: 'kw-vocal-tone', label: 'Vocal Tone', description: `선택된 보컬톤: ${result.appliedKeywords.vocalTone}` })}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              #보컬톤: {result.appliedKeywords.vocalTone}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {result.appliedKeywords.tempo && (
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">tempo</p>
                        <div className="flex flex-wrap gap-1">
                          <span 
                            className="px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--input-bg)] text-[var(--text-secondary)] border border border-[var(--border-color)] cursor-help"
                            onMouseEnter={() => setHoveredItem({ id: 'kw-tempo', label: 'Tempo', description: '곡의 빠르기를 나타내는 BPM 범위입니다.' })}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {result.appliedKeywords.tempo}
                          </span>
                        </div>
                      </div>
                    )}
                    {(result.appliedKeywords.songStructure && result.appliedKeywords.songStructure !== 'custom') || (result.appliedKeywords.customStructure && (result.appliedKeywords.customStructure ?? []).length > 0) ? (
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">structure</p>
                        <div className="flex flex-wrap gap-1">
                          <span 
                            className="px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--input-bg)] text-[var(--text-secondary)] border border border-[var(--border-color)] cursor-help"
                            onMouseEnter={() => setHoveredItem({ id: 'kw-structure', label: 'Structure', description: '곡의 전체 구성입니다.' })}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {result.appliedKeywords.songStructure === 'custom' 
                              ? (result.appliedKeywords.customStructure ?? []).map(s => {
                                  if (s.section === 'Instrumental' && (s.tags ?? []).length > 0) {
                                    return `${s.section}: ${(s.tags ?? [])[0]}`;
                                  }
                                  return `${s.section}${(s.tags ?? []).length > 0 ? ` (${(s.tags ?? []).join(', ')})` : ''}`;
                                }).join(' → ')
                              : result.appliedKeywords.songStructure === '1'
                                ? 'Intro → Verse 1 → Chorus / Drop → Outro"'
                                : result.appliedKeywords.songStructure === '2'
                                  ? 'Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro'
                                  : result.appliedKeywords.songStructure === '3'
                                    ? 'Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro'
                                    : ''
                            }
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </motion.div>

                {/* Expand Button at Bottom Center */}
                <button
                  onClick={() => setIsAppliedKeywordsExpanded(!isAppliedKeywordsExpanded)}
                  className={cn(
                    "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-full border flex items-center justify-center transition-all z-20 shadow-xl",
                    isAppliedKeywordsExpanded 
                      ? "bg-brand-orange text-white border-brand-orange" 
                      : "bg-[var(--card-bg)] border-[var(--border-color)] text-brand-orange hover:text-white hover:bg-brand-orange"
                  )}
                >
                  {isAppliedKeywordsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Prompt Section */}
              <div className="bg-[var(--card-bg)] rounded-3xl border border-btn-border overflow-hidden flex flex-col h-[400px] shadow-[var(--shadow-md)] hover:border-brand-orange/10 transition-all duration-500">
                <div className="p-5 border-b border-btn-border flex items-center justify-between bg-[var(--bg-secondary)]">
                  <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-brand-orange" />
                    음악 프롬프트
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(result.prompt, 'prompt')}
                      onMouseEnter={() => setHoveredItem({ id: 'copy-prompt', label: '프롬프트 복사', description: '음악 생성 프롬프트를 복사합니다.' })}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-btn-bg hover:bg-btn-hover text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-btn-border active:scale-95 shadow-btn"
                    >
                      {copiedType === 'prompt' ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                      <span className="hidden md:block text-sm font-bold">복사</span>
                    </button>
                  </div>
                </div>
                <div className="p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                  <pre className="whitespace-pre-wrap font-mono text-[var(--text-secondary)] leading-relaxed text-sm w-full">
                    {result.prompt}
                  </pre>
                </div>
              </div>



              <div className="flex flex-col gap-6">
                {!result.appliedKeywords.isNoLyrics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* English Lyrics Section */}
                    <div className="aspect-square bg-[var(--card-bg)] rounded-3xl border border-btn-border overflow-hidden flex flex-col group/lyrics shadow-[var(--shadow-md)] hover:border-brand-orange/10 transition-all duration-500">
                      <div className="p-5 border-b border-btn-border flex items-center justify-between bg-[var(--bg-secondary)]">
                        <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                          <Music className="w-4 h-4 text-brand-orange" />
                          영어 가사
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(result.lyrics.english, 'lyrics-en')}
                            onMouseEnter={() => setHoveredItem({ id: 'copy-lyrics-en', label: '영어 가사 복사', description: '영어 가사 전체를 복사합니다.' })}
                            onMouseLeave={() => setHoveredItem(null)}
                            className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-btn-bg hover:bg-btn-hover text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-btn-border active:scale-95 shadow-btn"
                          >
                            {copiedType === 'lyrics-en' ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                            <span className="hidden md:block text-sm font-bold">복사</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center h-full">
                        <div className="flex-1" />
                        <pre className="whitespace-pre-wrap font-sans text-[var(--text-secondary)] leading-relaxed text-sm md:text-base w-full text-center">
                          {(result.lyrics.english || '')
                            .replace(/\\n/g, '\n')
                            .replace(sectionRegex, '\n\n$1')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim()}
                        </pre>
                        <div className="flex-1" />
                      </div>
                    </div>

                    {/* Korean Lyrics Section */}
                    <div className="aspect-square bg-[var(--card-bg)] rounded-3xl border border-btn-border overflow-hidden flex flex-col group/lyrics shadow-[var(--shadow-md)] hover:border-brand-orange/10 transition-all duration-500">
                      <div className="p-5 border-b border-btn-border flex items-center justify-between bg-[var(--bg-secondary)]">
                        <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                          <Music className="w-4 h-4 text-brand-orange" />
                          한글 가사
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(result.lyrics.korean, 'lyrics-ko')}
                            onMouseEnter={() => setHoveredItem({ id: 'copy-lyrics-ko', label: '한글 가사 복사', description: '한글 가사 전체를 복사합니다.' })}
                            onMouseLeave={() => setHoveredItem(null)}
                            className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-btn-bg hover:bg-btn-hover text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-btn-border active:scale-95 shadow-btn"
                          >
                            {copiedType === 'lyrics-ko' ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                            <span className="hidden md:block text-sm font-bold">복사</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center h-full">
                        <div className="flex-1" />
                        <pre className="whitespace-pre-wrap font-sans text-[var(--text-secondary)] leading-relaxed text-sm md:text-base w-full text-center">
                          {(result.lyrics.korean || '')
                            .replace(/\\n/g, '\n')
                            .replace(sectionRegex, '\n\n$1')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim()}
                        </pre>
                        <div className="flex-1" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
            </main>
          </>
        } />
        <Route
          path="/history"
          element={
            !isAuthReady ? (
              <div className="min-h-screen flex items-center justify-center text-[var(--text-primary)] bg-[var(--bg-primary)]">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
                  <p className="text-sm font-medium text-gray-400">사용자 정보를 불러오는 중...</p>
                </div>
              </div>
            ) : user ? (
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
                <FavoritesPageLazy
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  updateFavorite={updateFavorite}
                  clearAllFavorites={clearAllFavorites}
                  unlockAllFavorites={unlockAllFavorites}
                  lockAllFavorites={lockAllFavorites}
                  user={user}
                  onHover={setHoveredItem}
                  hoveredItem={hoveredItem}
                  onLongPressStart={handleLongPressStart}
                  onLongPressEnd={handleLongPressEnd}
                />
              </Suspense>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/archive" element={<Navigate to="/history" replace />} />
        <Route path="/library" element={<Navigate to="/history" replace />} />
        
        {/* Admin Routes */}
        {isAdminUser ? (
          <>
            <Route path="/admin/plans" element={<AdminPlanManagerPage currentUser={user} isAdmin={isAdminUser} />} />
            <Route path="/admin/users" element={
              <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>}>
                <AdminUserManagementPageLazy isAdmin={isAdminUser} />
              </Suspense>
            } />
            <Route path="/admin/vocals" element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
                <AdminVocalTonesPageLazy isAdmin={isAdminUser} />
              </Suspense>
            } />
            <Route path="/admin/tags" element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
                <AdminSectionTagsPageLazy isAdmin={isAdminUser} />
              </Suspense>
            } />
          </>
        ) : (
          <>
            <Route path="/admin/plans" element={<Navigate to="/" replace />} />
            <Route path="/admin/vocals" element={<Navigate to="/" replace />} />
            <Route path="/admin/tags" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>

      {/* Tooltip / Description Overlay */}
      <AnimatePresence>
        {hoveredItem && (
          <motion.div
            initial={{ opacity: 0, x: '-50%' }}
            animate={{ 
              opacity: isTooltipHovered ? 0.1 : 1, 
              x: '-50%'
            }}
            exit={{ opacity: 0, x: '-50%' }}
            onMouseEnter={() => setIsTooltipHovered(true)}
            onMouseLeave={() => setIsTooltipHovered(false)}
            className={cn(
              "fixed left-1/2 z-[200] px-5 py-3 rounded-2xl bg-[var(--card-bg)]/90 backdrop-blur-xl border border-brand-orange/40 shadow-[0_0_30px_rgba(242,125,38,0.1)] pointer-events-auto cursor-default text-center transition-all duration-300",
              location.pathname === '/' 
                ? (isActionsFloating && !isAnyModalOpen && !isActionButtonsTemporarilyHidden
                    ? "bottom-29 md:bottom-35 max-w-[200px] md:max-w-[400px]" 
                    : "bottom-10 max-w-[200px] md:max-w-[400px]")
                : "bottom-10 max-w-[250px] md:max-w-[400px]"
            )}
          >
            <p className="text-brand-orange font-black text-sm mb-1 tracking-tight">{hoveredItem.label}</p>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed">{hoveredItem.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 text-center border-t border-[var(--border-color)] text-[var(--text-secondary)]/50 text-sm">
        <p>© 2026 SORIDRAW's Studio. All rights reserved.</p>
      </footer>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] px-4 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl text-xs font-bold text-[var(--text-primary)] flex items-center gap-2"
          >
            <Check className="w-3 h-3 text-brand-orange" />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <GuideModal 
        isOpen={isGuideModalOpen} 
        onClose={() => setIsGuideModalOpen(false)} 
        applyTemplate={applyTemplate} 
      />

      <SecondaryScrollControl />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 130, 0, 0.3);
        }
        .custom-scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar-hidden {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee-right {
          animation: marquee-right 30s linear infinite;
        }
      `}</style>
    </div>
  );
}

function GuideModal({ isOpen, onClose, applyTemplate }: { isOpen: boolean; onClose: () => void; applyTemplate: (template: PromptTemplate) => void }) {
  if (!isOpen) return null;

  const guides = [
    {
      id: 'idol-dance',
      title: '아이돌 댄스곡 만들기',
      youtubeUrl: 'https://youtu.be/MuXLbouYeIM?si=wm2vQZCgdxb16Gzv',
      templateId: 'kpop-fresh'
    },
    {
      id: 'emotional-indie',
      title: '감성 인디곡 만들기',
      youtubeUrl: 'https://youtu.be/izyFzAfgjlg?si=Fna5bgfonYfaYBD7',
      templateId: 'indie-folk-warm'
    },
    {
      id: 'hiphop-beat',
      title: '힙합 비트 만들기',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      templateId: 'hiphop-dark'
    }
  ];

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[var(--card-bg)] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <YoutubeIcon className="w-6 h-6 text-red-500" />
                가이드 템플릿
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-btn-hover rounded-full transition-colors">
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="space-y-3">
              {guides.map((guide) => (
                <div key={guide.id} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      window.open(guide.youtubeUrl, '_blank');
                    }}
                    className="flex-1 flex items-center justify-between p-4 rounded-2xl bg-btn-bg border border-btn-border hover:bg-btn-hover hover:border-brand-orange/30 transition-all group text-left shadow-btn"
                  >
                    <span className="font-bold text-[var(--text-primary)] group-hover:text-brand-orange transition-colors">
                      {guide.title}
                    </span>
                    <ExternalLink className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                  <button
                    onClick={() => {
                      const template = PROMPT_TEMPLATES.find(t => t.id === guide.templateId);
                      if (template) {
                        applyTemplate(template);
                        onClose();
                      }
                    }}
                    className="p-4 rounded-2xl bg-brand-orange/10 border border-brand-orange/20 text-brand-orange hover:bg-brand-orange hover:text-white transition-all group/zap"
                    title="템플릿 적용"
                  >
                    <Zap className="w-5 h-5 group-hover/zap:scale-110 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}


interface GenreCategorySectionProps {
  title: string;
  description: string;
  groups: typeof GENRE_GROUPS;
  selectedGenreId: string | null;
  isRandomized: boolean;
  onOpenGroup: (groupId: string) => void;
  onClear: () => void;
  onRandom: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function GenreCategorySection({
  title,
  description,
  groups,
  selectedGenreId,
  isRandomized,
  onOpenGroup,
  onClear,
  onRandom,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  isExpanded = false,
  onToggleExpand,
}: GenreCategorySectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded, groups]);

  const selectedChild = groups.flatMap((group) => group.children).find((item) => item.id === selectedGenreId) ?? null;
  const selectedGroup = groups.find((group) => group.children.some((item) => item.id === selectedGenreId)) ?? null;

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full relative group shadow-[var(--shadow-md)]">
      {onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full bg-[var(--card-bg)] border border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shadow-[0_4px_12px_rgba(255,130,0,0.2)] flex items-center justify-center"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <h3
              onMouseEnter={() => setShowTitleTooltip(true)}
              onMouseLeave={() => setShowTitleTooltip(false)}
              className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
            >
              <span className="w-1.5 h-6 bg-brand-orange rounded-full" />
              {title}
              <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-2">({selectedChild ? '1' : '0'}/1)</span>
            </h3>
            <AnimatePresence>
              {showTitleTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-[var(--shadow-md)] w-56 pointer-events-none"
                >
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{description}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRandom}
            onMouseEnter={() => onHover({ id: 'genre-random', label: 'Random', labelKo: '랜덤 선택', description: '세부 장르 1개를 무작위로 선택합니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'genre-random', label: 'Random', labelKo: '랜덤 선택', description: '세부 장르 1개를 무작위로 선택합니다.' })}
            onTouchEnd={onLongPressEnd}
            className={cn(
              "p-2.5 rounded-xl transition-all",
              isRandomized
                ? "bg-brand-orange text-white"
                : "bg-white/10 text-[var(--text-secondary)] hover:bg-white/20"
            )}
          >
            <Dices className="w-4 h-4" />
          </button>
          <button
            onClick={onClear}
            onMouseEnter={() => onHover({ id: 'genre-clear', label: 'Reset', labelKo: '초기화', description: '선택한 장르를 초기화합니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'genre-clear', label: 'Reset', labelKo: '초기화', description: '선택한 장르를 초기화합니다.' })}
            onTouchEnd={onLongPressEnd}
            className={cn(
              "p-2.5 rounded-xl transition-all border shadow-btn",
              (!!selectedChild || isRandomized)
                ? "bg-white/5 border-red-500/40 text-red-400 hover:bg-red-500/20"
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
            )}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ 
          height: isExpanded ? contentHeight : 120,
          opacity: 1
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div ref={contentRef} className="grid grid-cols-2 gap-2">
          {groups.map((group) => {
            const isSelectedGroup = selectedGroup?.id === group.id;
            return (
              <button
                key={group.id}
                onClick={() => onOpenGroup(group.id)}
                onMouseEnter={() => onHover({ 
                  id: group.id, 
                  label: group.label, 
                  labelKo: group.labelKo,
                  description: group.descriptionKo || group.description 
                })}
                onMouseLeave={() => {
                  onHover(null);
                  onLongPressEnd();
                }}
                onTouchStart={() => onLongPressStart({ 
                  id: group.id, 
                  label: group.label, 
                  labelKo: group.labelKo,
                  description: group.descriptionKo || group.description 
                })}
                onTouchEnd={onLongPressEnd}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all border text-left min-h-[44px]",
                  isSelectedGroup
                    ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                    : "bg-white/5 border-white/10 text-[var(--text-primary)] hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{group.labelKo || group.label}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                </div>
                {isSelectedGroup && selectedChild && (
                  <div className="mt-1 text-[11px] text-white/80 font-medium">
                    {selectedChild.labelKo || selectedChild.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-4 min-h-[44px] rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-3 flex items-center justify-center text-center">
        {selectedChild ? (
          <p className="text-sm font-semibold text-brand-orange">
            {(selectedGroup?.labelKo || selectedGroup?.label)} / {(selectedChild.labelKo || selectedChild.label)}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            대분류를 누른 뒤 팝업에서 세부 장르 1개를 선택하세요.
          </p>
        )}
      </div>
    </div>
  );
}

function GenreSelectModal({
  group,
  selectedGenreId,
  onClose,
  onSelect,
}: {
  group: (typeof GENRE_GROUPS)[number] | null;
  selectedGenreId: string | null;
  onClose: () => void;
  onSelect: (genreId: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    
    // Lock body scroll
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalStyle;
    };
  }, [onClose]);

  if (!group) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="w-full max-w-md rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{group.labelKo || group.label}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{group.descriptionKo || group.description}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div 
          className="p-4 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar overscroll-behavior-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {group.children.map((item) => {
            const isSelected = selectedGenreId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full text-left rounded-2xl border px-4 py-2 transition-all",
                  isSelected
                    ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                    : "bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)]"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm">{item.labelKo || item.label}</div>
                    <div className={cn("text-xs mt-1", isSelected ? "text-white/80" : "text-[var(--text-secondary)]")}>
                      {item.descriptionKo || item.description}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

interface CycleSectionProps {
  title: string;
  titleKo?: string;
  description: string;
  descriptionKo?: string;
  cycles: readonly { 
    id: string; 
    title: string; 
    titleKo?: string;
    variants: readonly { 
      id: string; 
      label: string; 
      labelKo?: string;
      description: string;
      descriptionKo?: string;
    }[] 
  }[];
  selected: string[];
  onCycleToggle: (cycleId: string) => void;
  onClear: () => void;
  onRandom: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  titleClassName?: string;
  isRandomized?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onHeightChange?: (height: number) => void;
  forcedHeight?: number;
}

function CycleSection({ 
  title, 
  titleKo,
  description, 
  descriptionKo,
  cycles, 
  selected, 
  onCycleToggle, 
  onClear, 
  onRandom, 
  onHover, 
  onLongPressStart, 
  onLongPressEnd, 
  titleClassName, 
  isRandomized,
  isExpanded = false,
  onToggleExpand,
  onHeightChange,
  forcedHeight
}: CycleSectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(0);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      if (onHeightChange) {
        onHeightChange(height);
      }
    }
  }, [cycles, onHeightChange]);

  const selectedFamilyCount = cycles.filter((cycle) => cycle.variants.some((variant) => selected.includes(variant.id))).length;

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col justify-between h-auto relative group shadow-[var(--shadow-md)] pb-12">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative min-w-0">
              <h3
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className={cn("font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help min-w-0", titleClassName ?? "text-[20px]")}
              >
                <span className="w-1.5 h-6 bg-brand-orange rounded-full shrink-0" />
                <span className="truncate">{titleKo || title}</span>
                <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-1 shrink-0">({selectedFamilyCount}/{cycles.length})</span>
              </h3>
              <AnimatePresence>
                {showTitleTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-[var(--shadow-md)] w-56 pointer-events-none"
                  >
                    <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{descriptionKo || description}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onRandom} className={cn("p-2.5 rounded-xl transition-all shadow-btn border border-btn-border", isRandomized ? 'bg-brand-orange text-white border-brand-orange' : 'bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover')}>
              <Dices className="w-4 h-4" />
            </button>
            <button 
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'cycle-clear', label: 'Reset', labelKo: '초기화', description: `${title} 설정을 초기화합니다.` })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2.5 rounded-xl transition-all border shadow-btn",
                (selected.length > 0 || isRandomized)
                  ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/30" 
                  : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
              )}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ 
            height: isExpanded ? (forcedHeight || contentHeight) : 64,
            opacity: 1
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div ref={contentRef} className="grid grid-cols-2 gap-2 md:gap-2.5">
            {cycles.map((cycle) => {
              const activeIndex = cycle.variants.findIndex((variant) => selected.includes(variant.id));
              const activeVariant = activeIndex >= 0 ? cycle.variants[activeIndex] : null;
              
              const selectedIndex = activeVariant ? selected.indexOf(activeVariant.id) : -1;
              const showOrderBadge = title === "Style" && selected.length >= 2 && selectedIndex >= 0;
              const orderNumber = selectedIndex + 1;

              const baseVariant = cycle.variants[0];
              const hoverItem: CategoryItem = activeVariant
                ? {
                    id: cycle.id,
                    label: activeVariant.label,
                    labelKo: activeVariant.labelKo,
                    description: activeVariant.descriptionKo ?? activeVariant.description,
                  }
                : {
                    id: cycle.id,
                    label: cycle.title,
                    labelKo: cycle.titleKo,
                    description: baseVariant.descriptionKo ?? baseVariant.description,
                  };
              return (
                <button
                  key={cycle.id}
                  onClick={() => {
                    const nextIndex = activeIndex === -1 ? 0 : activeIndex < cycle.variants.length - 1 ? activeIndex + 1 : -1;
                    onCycleToggle(cycle.id);
                    if (nextIndex === -1) {
                      onHover({ 
                        id: cycle.id, 
                        label: cycle.title, 
                        labelKo: cycle.titleKo,
                        description: baseVariant.descriptionKo ?? baseVariant.description, 
                        _ts: Date.now() 
                      } as CategoryItem);
                    } else {
                      const nextVariant = cycle.variants[nextIndex];
                      onHover({ 
                        id: cycle.id, 
                        label: nextVariant.label, 
                        labelKo: nextVariant.labelKo,
                        description: nextVariant.descriptionKo ?? nextVariant.description, 
                        _ts: Date.now() 
                      } as CategoryItem);
                    }
                  }}
                  onMouseEnter={() => onHover(hoverItem)}
                  onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                  onTouchStart={() => onLongPressStart(hoverItem)}
                  onTouchEnd={onLongPressEnd}
                  className={cn(
                    "min-h-[48px] rounded-xl border px-3 py-2 text-center transition-all flex items-center justify-center relative shadow-btn",
                    activeVariant ? CYCLE_VARIANT_COLORS[Math.min(activeIndex, CYCLE_VARIANT_COLORS.length - 1)] : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                  )}
                >
                  {showOrderBadge && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 z-10">
                      <span className="text-[10px] font-black text-white leading-none">{orderNumber}</span>
                    </div>
                  )}
                  <span className="text-[13px] md:text-[13.5px] font-bold leading-tight truncate w-full">
                    {activeVariant ? (activeVariant.labelKo ?? activeVariant.label) : (cycle.titleKo ?? cycle.title)}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div 
        className="mt-4 h-[56px] rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-3 flex items-center justify-center text-center overflow-hidden"
      >
        {selected.length > 0 ? (
          <p className="text-sm font-semibold text-brand-orange leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis">
            {cycles.filter(c => c.variants.some(v => selected.includes(v.id)))
              .map(c => {
                const v = c.variants.find(v => selected.includes(v.id));
                return v?.labelKo || v?.label;
              })
              .join(', ')}
          </p>
        ) : (
          <p className="text-sm font-medium text-brand-orange/40 leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis">
            {titleKo || title} 키워드를 선택하세요.
          </p>
        )}
      </div>

      {onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className={cn(
            "absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full border transition-all shadow-[0_4px_12px_rgba(255,130,0,0.2)] flex items-center justify-center",
            isExpanded
              ? "bg-brand-orange text-white border-brand-orange"
              : "bg-[var(--card-bg)] border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white"
          )}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  titleKo?: string;
  description: string;
  descriptionKo?: string;
  items: CategoryItem[];
  selected: string[];
  pinned?: string[];
  onToggle: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onClear: () => void;
  onUnpinAll?: () => void;
  onRandom: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  hoveredItem: CategoryItem | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  allExpanded: boolean;
  kpopMode?: 0 | 1 | 2;
  citypopMode?: 0 | 1 | 2;
  isRandomized?: boolean;
  hidePin?: boolean;
  onHeightChange?: (height: number) => void;
  forcedHeight?: number;
}

function CategorySection({ 
  title, 
  titleKo,
  description,
  descriptionKo,
  items, 
  selected, 
  pinned = [],
  onToggle, 
  onTogglePin,
  onClear, 
  onUnpinAll,
  onRandom,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  hoveredItem,
  isExpanded,
  onToggleExpand,
  allExpanded,
  kpopMode = 0,
  citypopMode = 0,
  isRandomized = false,
  hidePin = false,
  onHeightChange,
  forcedHeight
}: CategorySectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(84);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      if (onHeightChange) {
        onHeightChange(height);
      }
    }
  }, [items, onHeightChange]);

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col justify-between h-auto relative group shadow-[var(--shadow-md)] pb-12">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative min-w-0">
              <h3 
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help min-w-0"
              >
                <span className="w-1.5 h-6 bg-brand-orange rounded-full shrink-0" />
                <span className="truncate">{titleKo || title}</span>
                <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-2 shrink-0">({selected.length}/{items.length})</span>
              </h3>
              <AnimatePresence>
                {showTitleTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-[var(--shadow-md)] w-48 pointer-events-none"
                  >
                    <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{descriptionKo || description}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onRandom}
              onMouseEnter={() => onHover({ id: 'random-cat', label: 'Random', labelKo: '랜덤 선택', description: `${titleKo || title} 키워드를 무작위로 선택합니다.` })}
              onMouseLeave={() => {
                onHover(null);
                onLongPressEnd();
              }}
              onTouchStart={() => onLongPressStart({ id: 'random-cat', label: 'Random', labelKo: '랜덤 선택', description: `${titleKo || title} 키워드를 무작위로 선택합니다.` })}
              onTouchEnd={onLongPressEnd}
              className={cn(
                "p-2.5 rounded-xl transition-all shadow-btn",
                isRandomized 
                  ? "bg-brand-orange text-white" 
                  : "bg-btn-bg text-[var(--text-secondary)] border border-btn-border hover:bg-btn-hover"
              )}
            >
              <Dices className="w-4 h-4" />
            </button>
            {!hidePin && onUnpinAll && (
              <button 
                onClick={onUnpinAll}
                onMouseEnter={() => onHover({ id: 'unpin-all', label: 'Unpin All', labelKo: '모든 핀 해제', description: '고정된 모든 키워드를 해제합니다.' })}
                onMouseLeave={() => {
                  onHover(null);
                  onLongPressEnd();
                }}
                onTouchStart={() => onLongPressStart({ id: 'unpin-all', label: 'Unpin All', labelKo: '모든 핀 해제', description: '고정된 모든 키워드를 해제합니다.' })}
                onTouchEnd={onLongPressEnd}
                className="p-2.5 rounded-xl bg-btn-bg text-[var(--text-secondary)] border border-btn-border hover:bg-btn-hover transition-all shadow-btn"
              >
                <PinOff className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'clear', label: 'Reset', labelKo: '초기화', description: hidePin ? '모든 선택을 초기화합니다.' : '핀을 제외한 모든 선택을 초기화합니다.' })}
              onMouseLeave={() => {
                onHover(null);
                onLongPressEnd();
              }}
              onTouchStart={() => onLongPressStart({ id: 'clear', label: 'Reset', labelKo: '초기화', description: hidePin ? '모든 선택을 초기화합니다.' : '핀을 제외한 모든 선택을 초기화합니다.' })}
              onTouchEnd={onLongPressEnd}
              className={cn(
                "p-2.5 rounded-xl transition-all border shadow-btn",
                (selected.length > 0 || isRandomized)
                  ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/30" 
                  : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
              )}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <motion.div
          initial={false}
          animate={{ 
            height: isExpanded ? (forcedHeight || contentHeight) : (window.innerWidth < 768 ? 40 : 84),
            opacity: 1
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden min-h-[40px] md:min-h-[84px]"
        >
          <div ref={contentRef} className="flex flex-wrap gap-2">
            {items.map((item) => {
            const isPinned = pinned.includes(item.id);
            const isSelected = selected.includes(item.id);
            const selectedIndex = selected.indexOf(item.id);
            const isPrimaryMood = title === "Mood" && isSelected && selectedIndex >= 0 && selectedIndex < 3;
            const isSecondaryMood = isSelected && !isPrimaryMood;
            
            const isKpop = item.id === 'kpop';
            const isCitypop = item.id === 'citypop';
            
            // K-Pop specific styles
            let kpopStyle = "";
            let displayLabel = item.labelKo ?? item.label;
            let displayDescription = item.descriptionKo ?? item.description;

            if (isKpop) {
              if (kpopMode === 2) {
                kpopStyle = "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20";
                displayDescription = "K-Pop (한글+영어): 한국어와 영어가 자연스럽게 섞인 K-Pop 스타일의 가사를 생성합니다.";
                displayLabel = "K-Pop (Mix)";
              } else if (kpopMode === 1) {
                kpopStyle = "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20";
                displayDescription = "K-Pop (기본): 한국의 대중음악으로, 다양한 장르가 혼합된 세련된 사운드입니다.";
                displayLabel = "K-Pop";
              } else {
                kpopStyle = "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover shadow-btn";
                displayDescription = "K-Pop 장르를 선택하고 스타일(기본/Mix)을 순환하며 선택합니다.";
                displayLabel = "K-Pop";
              }
            }

            // City Pop specific styles
            let citypopStyle = "";
            if (isCitypop) {
              if (citypopMode === 2) {
                citypopStyle = "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20";
                displayDescription = "City Pop (현대): 누디스코, 신스팝, 매끄러운 현대적 감각이 더해진 모던 시티팝입니다.";
                displayLabel = "City Pop(M)";
              } else if (citypopMode === 1) {
                citypopStyle = "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20";
                displayDescription = "City Pop (올드): 80년대 일본 팝, 펑크, 그루비한 레트로 사운드의 오리지널 시티팝입니다.";
                displayLabel = "City Pop(O)";
              } else {
                citypopStyle = "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover shadow-btn";
                displayDescription = "City Pop 장르를 선택하고 스타일(올드/현대)을 순환하며 선택합니다.";
                displayLabel = "City Pop";
              }
            }

            return (
              <div key={item.id} className="relative group/btn">
                <button
                  onMouseEnter={() => onHover({ 
                    ...item, 
                    label: item.label,
                    labelKo: item.labelKo,
                    description: displayDescription 
                  })}
                  onMouseLeave={() => {
                    onHover(null);
                    onLongPressEnd();
                  }}
                  onTouchStart={() => onLongPressStart({ 
                    ...item, 
                    label: item.label,
                    labelKo: item.labelKo,
                    description: displayDescription 
                  })}
                  onTouchEnd={onLongPressEnd}
                  onClick={() => {
                    onToggle(item.id);
                    // Show description on click for mobile/touch users
                    // For K-Pop and City Pop, toggleSelection already updates the hover state with the correct next description
                    if (!isKpop && !isCitypop) {
                      onHover({ 
                        ...item, 
                        label: item.label,
                        labelKo: item.labelKo,
                        description: displayDescription, 
                        _ts: Date.now() 
                      });
                    }
                  }}
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition-all border flex items-center gap-2 shadow-btn",
                    (isKpop || isCitypop) ? "min-w-[120px] justify-center" : "",
                    isPrimaryMood
                      ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20"
                      : isSecondaryMood
                        ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                        : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover",
                    isKpop && kpopMode > 0 ? kpopStyle : "",
                    isCitypop && citypopMode > 0 ? citypopStyle : ""
                  )}
                >
                  {isKpop && kpopMode > 0 && (
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      kpopMode === 1 ? "bg-white" : "bg-indigo-200"
                    )} />
                  )}
                  {isCitypop && citypopMode > 0 && (
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      citypopMode === 1 ? "bg-white" : "bg-emerald-200"
                    )} />
                  )}
                  {displayLabel}
                </button>
                
                {/* Floating Description Tooltip - Only show when expanded */}
                <AnimatePresence>
                  {isExpanded && hoveredItem?.id === item.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-2xl w-40 pointer-events-none"
                    >
                      <p className="text-[10px] text-[var(--text-secondary)] text-center leading-tight">{hoveredItem.description}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Pin Toggle Button - Top Right Corner Only */}
                {!hidePin && onTogglePin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(item.id);
                    }}
                    className={cn(
                      "absolute -top-2 -right-2 p-1.5 rounded-full border transition-all z-10",
                      isPinned 
                        ? "bg-brand-orange border-orange-400 text-white opacity-100 scale-100 shadow-lg shadow-brand-orange/20" 
                        : "bg-white/8 border-white/15 text-[var(--text-secondary)] opacity-0 scale-75 group-hover/btn:opacity-100 group-hover/btn:scale-100 hover:text-brand-orange"
                    )}
                  >
                    <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </motion.div>
      </div>

      <div 
        className="mt-4 h-[56px] rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-3 flex items-center justify-center text-center overflow-hidden"
      >
        {selected.length > 0 ? (
          <p className="text-sm font-semibold text-brand-orange leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis">
            {selected.map(id => {
              const item = items.find(i => i.id === id);
              return item?.labelKo || item?.label;
            }).join(', ')}
          </p>
        ) : (
          <p className="text-sm font-medium text-brand-orange/40 leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis">
            키워드를 선택하여 곡의 {titleKo || title}를 설정하세요.
          </p>
        )}
      </div>

      {onToggleExpand && (
        <button
          onClick={onToggleExpand}
          onMouseEnter={() => onHover({ id: 'category-expand', label: isExpanded ? 'Collapse' : 'Expand', labelKo: isExpanded ? '접기' : '더보기', description: isExpanded ? '목록을 접습니다.' : '전체 목록을 확인합니다.' })}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full border transition-all shadow-[0_4px_12px_rgba(255,130,0,0.2)] flex items-center justify-center",
            isExpanded
              ? "bg-brand-orange text-white border-brand-orange"
              : "bg-[var(--card-bg)] border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white"
          )}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

interface SongStructureIntegratedControlProps {
  lyricsLength: LyricsLength;
  onLyricsLengthChange: (val: LyricsLength) => void;
  isNoLyrics: boolean;
  onNoLyricsToggle: () => void;
  songStructure: SongStructure;
  customStructure: CustomSectionItem[];
  onSongStructureChange: (val: SongStructure) => void;
  onCustomStructureChange: (val: CustomSectionItem[]) => void;
  onClear: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  user: User | null;
  userTier: TagTier;
  sectionTags: SectionTag[];
  onModalStateChange?: (isOpen: boolean) => void;
}

function SongStructureIntegratedControl({
  lyricsLength,
  onLyricsLengthChange,
  isNoLyrics,
  onNoLyricsToggle,
  songStructure,
  customStructure,
  onSongStructureChange,
  onCustomStructureChange,
  onClear,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  user,
  userTier,
  sectionTags,
  onModalStateChange
}: SongStructureIntegratedControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const customModalHistoryPushedRef = useRef(false);
  const [draftStructure, setDraftStructure] = useState<CustomSectionItem[]>([]);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [savedStructures, setSavedStructures] = useState<SavedStructurePreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [editingSavedStructureId, setEditingSavedStructureId] = useState<string | null>(null);
  const [structureSearch, setStructureSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState<'all' | 'like' | 'dislike'>('all');

  const [contentHeight, setContentHeight] = useState<number | string>('auto');

  useEffect(() => {
    onModalStateChange?.(isCustomModalOpen || editingSectionIndex !== null);
  }, [isCustomModalOpen, editingSectionIndex, onModalStateChange]);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [lyricsLength, songStructure, customStructure]);

  const lyricsOptions = [
    { id: 'very-short', label: 'Very Short', labelKo: '더짧게', description: '매우 간결하고 함축적인 가사 (트로트)' },
    { id: 'short', label: 'Short', labelKo: '짧게', description: '함축적이고 간결한 가사 (째즈/발라드 등)' },
    { id: 'normal', label: 'Normal', labelKo: '기본', description: '일반적인 팝 스타일의 가사 분량' },
    { id: 'long', label: 'Long', labelKo: '길게', description: '서사적이고 풍부한 가사(랩,오페라 등)' }
  ];

  const structureOptions = [
    { id: '1', label: '1', description: '간결한 구조.추천 1~2분' },
    { id: '2', label: '2', description: '일반적인 기본 구조. 추천 2~4분' },
    { id: '3', label: '3', description: '브릿지와 반복이 확장된 구조. 추천 4~6분' },
    { id: 'custom', label: '커스텀', description: (customStructure ?? []).length > 0 ? `직접 지정한 구조 적용 · ${formatStructureText(customStructure)}` : '직접 구조를 지정하는 모드 · 구성에 따라 길이가 달라집니다.' },
  ] as const;

  useEffect(() => {
    if (!user) {
      setSavedStructures([]);
      return;
    }

    const loadStructures = async () => {
      try {
        const ref = doc(db, 'user_structures', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const normalized = (snap.data().structures || []).map((s: any) => ({
            ...s,
            sections: normalizeCustomStructure(s.sections)
          }));
          setSavedStructures(normalized);
        }
      } catch (error) {
        console.error('Failed to load saved song structures:', error);
      }
    };
    loadStructures();
  }, [user]);

  const closeCustomModal = useCallback((source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && customModalHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setIsCustomModalOpen(false);
    customModalHistoryPushedRef.current = false;
  }, []);

  useEffect(() => {
    if (!isCustomModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingSectionIndex !== null) {
          setEditingSectionIndex(null);
        } else {
          closeCustomModal();
        }
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isCustomModalOpen) {
        closeCustomModal('history');
      }
    };

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isCustomModalOpen, closeCustomModal, editingSectionIndex]);

  const persistSavedStructures = async (next: SavedStructurePreset[]) => {
    if (!user) return;
    try {
      const ref = doc(db, 'user_structures', user.uid);
      await setDoc(ref, sanitizeForFirestore({ structures: next }), { merge: true });
      setSavedStructures(next);
    } catch (error) {
      console.error('Failed to save song structures:', error);
    }
  };

  const openCustomModal = () => {
    setDraftStructure(normalizeCustomStructure(customStructure));
    setPresetName('');
    setEditingSavedStructureId(null);
    setIsCustomModalOpen(true);
    window.history.pushState({ modal: 'custom-structure' }, '');
    customModalHistoryPushedRef.current = true;
  };

  function formatStructureText(structure: CustomSectionItem[]) {
    const normalized = normalizeCustomStructure(structure);
    return normalized.map(s => {
      if (s.section === 'Instrumental' && (s.tags ?? []).length > 0) {
        return `${s.section}: ${(s.tags ?? [])[0]}`;
      }
      return `${s.section}${(s.tags ?? []).length > 0 ? ` · ${(s.tags ?? []).join(' · ')}` : ''}`;
    }).join(' → ');
  }

  const handleSelectStructure = (optionId: SongStructure) => {
    const optionDescriptions: Record<SongStructure, string> = {
      '1': '짧고 간결한 구조 · 추천 길이 1~2분',
      '2': '가장 일반적인 기본 구조 · 추천 길이 2~4분',
      '3': '브릿지와 반복이 확장된 구조 · 추천 길이 4~6분',
      'custom': (customStructure ?? []).length > 0 ? `직접 지정한 구조 적용 · ${formatStructureText(customStructure)}` : '직접 구조를 지정하는 모드 · Pro부터 사용할 수 있습니다.',
    };

    if (optionId === 'custom' && userTier === 'free') {
      onHover({
        id: 'song-structure-custom-locked',
        label: '구조 커스텀',
        description: '커스텀 구조는 Pro부터 사용할 수 있습니다.',
        _ts: Date.now(),
      });
      alert('커스텀 구조는 Pro부터 사용할 수 있습니다.');
      return;
    }

    onSongStructureChange(optionId);

    if (optionId === 'custom') {
      onHover({
        id: 'song-structure-custom',
        label: '구조 커스텀',
        description: optionDescriptions.custom,
        _ts: Date.now(),
      });
      openCustomModal();
      return;
    }

    onHover({
      id: `song-structure-${optionId}`,
      label: `구조 ${optionId}`,
      description: optionDescriptions[optionId],
      _ts: Date.now(),
    });
  };

  const appendSection = (section: string) => {
    const newItem: CustomSectionItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      section,
      tags: []
    };
    setDraftStructure((prev) => [...prev, newItem]);
  };

  const removeSectionAt = (index: number) => {
    setDraftStructure((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyCustomStructure = () => {
    if ((draftStructure ?? []).length === 0) return;
    onCustomStructureChange(draftStructure);
    onSongStructureChange('custom');
    closeCustomModal();
    onHover({
      id: 'song-structure-custom-applied',
      label: '커스텀 구조 적용',
      description: formatStructureText(draftStructure),
      _ts: Date.now(),
    });
  };

  const handleSavePreset = () => {
    const trimmedName = presetName.trim() || '제목없음';
    if ((draftStructure ?? []).length === 0) return;

    if (editingSavedStructureId) {
      const next = savedStructures.map(p => 
        p.id === editingSavedStructureId 
          ? { ...p, name: trimmedName, sections: draftStructure } 
          : p
      );
      persistSavedStructures(next);
    } else {
      const nextPreset: SavedStructurePreset = {
        id: `${Date.now()}`,
        name: trimmedName,
        sections: draftStructure,
        createdAt: Date.now(),
      };
      persistSavedStructures([nextPreset, ...savedStructures].slice(0, 20));
    }
    
    setPresetName('');
    setEditingSavedStructureId(null);
  };

  const handleLoadPreset = (preset: SavedStructurePreset) => {
    setDraftStructure(normalizeCustomStructure(preset.sections));
    setPresetName(preset.name);
    setEditingSavedStructureId(preset.id);
  };

  const handleDeletePreset = (presetId: string) => {
    persistSavedStructures(savedStructures.filter((preset) => preset.id !== presetId));
  };

  const handleToggleReaction = (presetId: string, reaction: 'like' | 'dislike') => {
    const next = savedStructures.map(p => {
      if (p.id === presetId) {
        return {
          ...p,
          reaction: p.reaction === reaction ? null : reaction
        };
      }
      return p;
    });
    persistSavedStructures(next);
  };

  const filteredSavedStructures = useMemo(() => {
    return savedStructures.filter(preset => {
      const matchesSearch = preset.name.toLowerCase().includes(structureSearch.toLowerCase()) ||
                          formatStructureText(preset.sections).toLowerCase().includes(structureSearch.toLowerCase());
      const matchesFilter = structureFilter === 'all' || preset.reaction === structureFilter;
      return matchesSearch && matchesFilter;
    });
  }, [savedStructures, structureSearch, structureFilter]);

  return (
    <>
      <div className="bg-[var(--card-bg)] rounded-3xl p-5 border border-[var(--border-color)] flex flex-col h-full shadow-[var(--shadow-md)] relative pb-12 overflow-visible">
        <div className="relative mb-4 flex items-center justify-between">
          <h3 
            onMouseEnter={() => setShowTitleTooltip(true)}
            onMouseLeave={() => setShowTitleTooltip(false)}
            className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
          >
            <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
            곡 구조
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onNoLyricsToggle}
              onMouseEnter={() => onHover({ id: 'no-lyrics', label: '가사없음', labelKo: '가사없음', description: isNoLyrics ? '가사 생성을 다시 활성화합니다.' : '가사 없이 연주곡 또는 가사 없는 노래를 생성합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border shadow-sm",
                isNoLyrics 
                  ? "bg-brand-orange/10 border-brand-orange/40 text-brand-orange" 
                  : "bg-btn-bg border-btn-border text-[var(--text-secondary)]"
              )}
            >
              <MicOff className={cn("w-3 h-3", isNoLyrics ? "text-brand-orange" : "text-[var(--text-secondary)]")} />
              가사없음 {isNoLyrics ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'song-structure-integrated-clear', label: '초기화', description: '곡 구조 설정을 초기화합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2 rounded-lg transition-all border shadow-btn",
                (lyricsLength !== 'normal' || songStructure !== '2' || (customStructure ?? []).length > 0 || isNoLyrics)
                  ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/30" 
                  : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <AnimatePresence>
            {showTitleTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-2xl w-56 pointer-events-none"
              >
                <p className="text-[11px] text-[var(--text-secondary)] leading-snug">가사 분량과 곡의 전개 방식을 통합적으로 설정합니다.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col flex-1 overflow-visible">
          <motion.div 
            animate={{ height: contentHeight }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div ref={contentRef} className="space-y-3 flex-1 flex flex-col justify-start">
              {/* 1. 가사 길이 */}
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-brand-orange uppercase tracking-wider">│가사 길이</p>
                <div className="flex gap-2">
                  {lyricsOptions.map((opt) => (
                    <div key={opt.id} className="relative flex-1">
                      <button
                        onClick={() => {
                          onLyricsLengthChange(opt.id as LyricsLength);
                          onHover({ id: opt.id, label: opt.label, labelKo: opt.labelKo, description: opt.description, _ts: Date.now() });
                        }}
                        onMouseEnter={() => onHover({ id: opt.id, label: opt.label, labelKo: opt.labelKo, description: opt.description })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: opt.id, label: opt.label, labelKo: opt.labelKo, description: opt.description })}
                        onTouchEnd={onLongPressEnd}
                        className={cn(
                          "w-full py-1.5 rounded-xl text-[13px] font-bold transition-all border shadow-sm",
                          lyricsLength === opt.id
                            ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                            : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                        )}
                      >
                        {opt.labelKo || opt.label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-1/2 h-[1px] bg-btn-border/50" />
              </div>

              {/* 3. 섹션 구조 */}
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-brand-orange uppercase tracking-wider">│섹션 구조</p>
                <div className="grid grid-cols-4 gap-2">
                  {structureOptions.map((opt) => {
                    const isCustomLocked = opt.id === 'custom' && userTier === 'free';
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectStructure(opt.id as SongStructure)}
                        onMouseEnter={() => onHover({ id: `song-structure-${opt.id}`, label: `구조 ${opt.label}`, description: isCustomLocked ? '커스텀 구조는 Pro부터 사용할 수 있습니다.' : opt.description })}
                        onMouseLeave={() => {
                          onHover(null);
                          onLongPressEnd();
                        }}
                        onTouchStart={() => onLongPressStart({ id: `song-structure-${opt.id}`, label: `구조 ${opt.label}`, description: isCustomLocked ? '커스텀 구조는 Pro부터 사용할 수 있습니다.' : opt.description })}
                        onTouchEnd={onLongPressEnd}
                        className={cn(
                          "py-1.5 rounded-xl text-[13px] font-bold transition-all border flex items-center justify-center gap-1.5 shadow-sm",
                          songStructure === opt.id
                            ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                            : isCustomLocked
                              ? "bg-btn-bg border-btn-border text-[var(--text-secondary)]/60 hover:bg-btn-hover"
                              : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                        )}
                      >
                        {opt.label}
                        {isCustomLocked && <Lock className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
                
                {/* Structure Guide - Always Visible */}
                <div className="mt-2 rounded-2xl border border-dashed border-brand-orange/30 px-3 py-3 bg-brand-orange/5">
                  <p className="text-[10px] font-bold text-brand-orange mb-1 uppercase tracking-tight">
                    {songStructure === 'custom' ? '현재 커스텀 구조' : `구조 ${songStructure} 상세 가이드`}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed break-words">
                    {songStructure === '1' && "Intro → Verse 1 → Chorus / Drop → Outro"}
                    {songStructure === '2' && "Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro"}
                    {songStructure === '3' && "Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro"}
                    {songStructure === 'custom' && (
                      (customStructure ?? []).length > 0 ? formatStructureText(customStructure) : '직접 구조를 지정하는 모드입니다.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isCustomModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => closeCustomModal()}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="w-full max-w-4xl max-h-[86vh] rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">커스텀 곡 구조 편집</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">섹션을 직접 추가하고 순서를 바꿔 원하는 곡 구조를 만드세요.</p>
                </div>
                <button
                  onClick={() => closeCustomModal()}
                  className="w-10 h-10 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto custom-scrollbar max-h-[calc(86vh-82px)] space-y-5">
                <div>
                  <p className="text-xs font-bold text-brand-orange uppercase tracking-wider mb-3">섹션 추가</p>
                  <div className="flex flex-wrap gap-2">
                    {CUSTOM_STRUCTURE_SECTIONS.map((section) => {
                      const meta = SECTION_META[section];
                      const sectionTier = meta?.tier || 'free';
                      const isLocked = sectionTier === 'pro+' && userTier !== 'pro+';

                      return (
                        <button
                          key={section}
                          onClick={() => {
                            if (isLocked) {
                              alert('이 섹션은 Pro+ 플랜 전용 기능입니다.');
                              return;
                            }
                            appendSection(section);
                          }}
                          onMouseEnter={() => onHover({ 
                            id: `section-add-${section}`, 
                            label: section, 
                            description: isLocked 
                              ? 'Pro+ 플랜 전용 섹션입니다.' 
                                : (SECTION_META[section]?.descriptionKo || '')
                            })
                          }
                          onMouseLeave={() => onHover(null)}
                          className={cn(
                            "px-3.5 py-2 rounded-xl border text-[13px] font-bold transition-all flex items-center gap-1.5 shadow-btn",
                            isLocked 
                              ? "bg-btn-bg border-btn-border text-[var(--text-secondary)]/40 cursor-not-allowed"
                              : "bg-btn-bg border-btn-border text-[var(--text-primary)] hover:bg-btn-hover"
                          )}
                        >
                          {section}
                          {isLocked && <Lock className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-5">
                  <div className="space-y-4">
                    {/* Action Buttons & Preview moved here */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => closeCustomModal()}
                          className="px-4 py-2.5 rounded-xl bg-btn-bg border border-btn-border text-[var(--text-primary)] hover:bg-btn-hover transition-all font-bold text-sm shadow-btn"
                        >
                          취소
                        </button>
                        {(editingSavedStructureId || (draftStructure ?? []).length > 0) && (
                          <button
                            onClick={handleSavePreset}
                            className={cn(
                              "px-5 py-2.5 rounded-xl font-bold transition-all border text-sm shadow-btn",
                              (draftStructure ?? []).length > 0
                                ? "bg-btn-bg text-brand-orange border-brand-orange/40 hover:bg-brand-orange/10"
                                : "bg-white/5 border-white/10 text-[var(--text-secondary)]/50 cursor-not-allowed"
                            )}
                            disabled={(draftStructure ?? []).length === 0}
                          >
                            {editingSavedStructureId ? '업데이트 저장' : '구조 저장'}
                          </button>
                        )}
                        <button
                          onClick={handleApplyCustomStructure}
                          disabled={(draftStructure ?? []).length === 0}
                          className={cn(
                            "px-5 py-2.5 rounded-xl font-bold transition-all border text-sm shadow-btn",
                            (draftStructure ?? []).length > 0
                              ? "bg-brand-orange text-white border-orange-400 hover:brightness-110"
                              : "bg-white/5 border-white/10 text-[var(--text-secondary)]/50 cursor-not-allowed"
                          )}
                        >
                          적용
                        </button>
                      </div>

                      {(draftStructure ?? []).length > 0 && (
                        <div className="rounded-2xl bg-[var(--hover-bg)]/60 border border-[var(--border-color)] px-4 py-3">
                          <p className="text-[11px] font-bold text-brand-orange mb-2">미리보기</p>
                          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed break-words">
                            {formatStructureText(draftStructure)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-brand-orange uppercase tracking-wider">현재 구조</p>
                      <button
                        onClick={() => setDraftStructure([])}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-btn",
                          (draftStructure ?? []).length > 0
                            ? "bg-white/5 border-red-500/40 text-red-400 hover:bg-red-500/20"
                            : "bg-btn-bg border-btn-border text-[var(--text-secondary)]/50 cursor-not-allowed"
                        )}
                        disabled={(draftStructure ?? []).length === 0}
                      >
                        전체 초기화
                      </button>
                    </div>

                    <Reorder.Group 
                      axis="y" 
                      values={draftStructure ?? []} 
                      onReorder={setDraftStructure}
                      className="min-h-[180px] rounded-2xl border border-dashed border-[var(--border-color)] p-3 space-y-2"
                      as="div"
                    >
                      {(draftStructure ?? []).length === 0 ? (
                        <div className="h-full min-h-[150px] flex items-center justify-center text-center text-[12px] text-[var(--text-secondary)]">
                          구조가 비어 있습니다. 위의 섹션 버튼을 눌러 추가하세요.
                        </div>
                      ) : (
                        (draftStructure ?? []).map((item, index) => (
                          <ReorderableSectionItem
                            key={item.id}
                            item={item}
                            index={index}
                            onEdit={setEditingSectionIndex}
                            onRemove={removeSectionAt}
                            onHover={onHover}
                          />
                        ))
                      )}
                    </Reorder.Group>
                  </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--border-color)] p-4 space-y-3">
                      <p className="text-xs font-bold text-brand-orange uppercase tracking-wider">현재 구조 저장</p>
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="예: 감성 발라드형"
                        className="w-full rounded-xl bg-[var(--bg-secondary)] border border-btn-border px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/40 shadow-inner"
                      />
                      <button
                        onClick={handleSavePreset}
                        disabled={(draftStructure ?? []).length === 0}
                        className={cn(
                          "w-full py-2.5 rounded-xl font-bold text-sm transition-all border",
                          (draftStructure ?? []).length > 0
                            ? "bg-brand-orange text-white border-orange-400 hover:brightness-110"
                            : "bg-white/5 border-white/10 text-[var(--text-secondary)]/50 cursor-not-allowed"
                        )}
                      >
                        {editingSavedStructureId ? '업데이트 저장' : '구조 저장'}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-color)] p-4">
                      <div className="flex flex-col gap-3 mb-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-brand-orange uppercase tracking-wider">저장된 구조</p>
                          <span className="text-[11px] text-[var(--text-secondary)]">{filteredSavedStructures.length} / {savedStructures.length}개</span>
                        </div>
                        
                        {/* Search and Filters */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                            <input
                              type="text"
                              value={structureSearch}
                              onChange={(e) => setStructureSearch(e.target.value)}
                              placeholder="구조 이름 또는 내용 검색..."
                              className="w-full rounded-xl bg-[var(--bg-secondary)] border border-btn-border pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-1 focus:ring-brand-orange/40 shadow-inner"
                            />
                            {structureSearch && (
                              <button 
                                onClick={() => setStructureSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                              >
                                <X className="w-3 h-3 text-[var(--text-secondary)]" />
                              </button>
                            )}
                          </div>
                          
                          <div className="flex gap-1">
                            {(['all', 'like', 'dislike'] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => setStructureFilter(f)}
                                className={cn(
                                  "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center gap-1.5 shadow-btn",
                                  structureFilter === f
                                    ? "bg-brand-orange/20 border-brand-orange/40 text-brand-orange"
                                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                                )}
                              >
                                {f === 'all' && '전체'}
                                {f === 'like' && <><ThumbsUp className="w-3 h-3" /> </>}
                                {f === 'dislike' && <><ThumbsDown className="w-3 h-3" /> </>}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                        {filteredSavedStructures.length === 0 ? (
                          <div className="rounded-xl bg-[var(--bg-secondary)] border border-btn-border px-3 py-6 text-center">
                            <Search className="w-6 h-6 text-[var(--text-secondary)]/30 mx-auto mb-2" />
                            <p className="text-[12px] text-[var(--text-secondary)]">
                              {structureSearch || structureFilter !== 'all' ? '검색 결과가 없습니다.' : '저장된 구조가 없습니다.'}
                            </p>
                          </div>
                        ) : (
                          filteredSavedStructures.map((preset) => (
                            <div key={preset.id} className="rounded-2xl bg-[var(--bg-secondary)] border border-btn-border p-3 hover:border-brand-orange/30 transition-all group shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{preset.name}</p>
                                    {preset.reaction && (
                                      <span className={cn(
                                        "shrink-0 p-1 rounded-md",
                                        preset.reaction === 'like' ? "bg-brand-orange/20 text-brand-orange" : "bg-btn-bg text-[var(--text-secondary)] shadow-btn border border-btn-border"
                                      )}>
                                        {preset.reaction === 'like' ? <ThumbsUp className="w-2.5 h-2.5" /> : <ThumbsDown className="w-2.5 h-2.5" />}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed break-words">
                                    {formatStructureText(preset.sections)}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    onClick={() => handleDeletePreset(preset.id)}
                                    className="w-8 h-8 rounded-lg border bg-white/5 border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="mt-3 flex gap-2">
                                <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                                  <button
                                    onClick={() => handleToggleReaction(preset.id, 'like')}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      preset.reaction === 'like'
                                        ? "bg-brand-orange text-white shadow-sm"
                                        : "text-[var(--text-secondary)] hover:bg-white/10"
                                    )}
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleReaction(preset.id, 'dislike')}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      preset.reaction === 'dislike'
                                        ? "bg-white/20 text-white shadow-sm"
                                        : "text-[var(--text-secondary)] hover:bg-white/10"
                                    )}
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleLoadPreset(preset)}
                                  className="flex-1 py-1.5 rounded-xl bg-white/10 border border-white/15 text-[11px] font-bold text-[var(--text-primary)] hover:bg-white/15 transition-all"
                                >
                                  불러오기
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingSectionIndex !== null && (
          <TagEditModal
            isOpen={true}
            onClose={() => setEditingSectionIndex(null)}
            section={draftStructure[editingSectionIndex]?.section || ''}
            tags={draftStructure[editingSectionIndex]?.tags || []}
            onSave={(newTags) => {
              setDraftStructure(prev => {
                const next = [...prev];
                if (next[editingSectionIndex]) {
                  next[editingSectionIndex] = { ...next[editingSectionIndex], tags: newTags };
                }
                return next;
              });
              setEditingSectionIndex(null);
            }}
            onHover={onHover}
            onLongPressStart={onLongPressStart}
            onLongPressEnd={onLongPressEnd}
            userTier={userTier}
            sectionTags={sectionTags}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface SongStructureControlProps {
  value: SongStructure;
  customStructure: CustomSectionItem[];
  onChange: (val: SongStructure) => void;
  onCustomStructureChange: (sections: CustomSectionItem[]) => void;
  onClear: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  user: User | null;
  userTier: TagTier;
}

function TagEditModal({
  isOpen,
  onClose,
  section,
  tags,
  onSave,
  onHover,
  onLongPressStart,
  onLongPressEnd,
  userTier,
  sectionTags
}: {
  isOpen: boolean;
  onClose: () => void;
  section: string;
  tags: string[];
  onSave: (tags: string[]) => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
  userTier: TagTier;
  sectionTags: SectionTag[];
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>(tags);
  const isInstrumental = section === 'Instrumental' || section === 'Solo';

  const allowedTags = useMemo(() => {
    // 1. Get all tags from Firestore for this section
    const fsTagsForSection = sectionTags.filter(t => Array.isArray(t.sections) && t.sections.includes(section));
    const fsLabels = new Set(fsTagsForSection.map(t => t.label));

    // 2. Get fallback tags from constants that are NOT in Firestore yet
    const fallbackSource = isInstrumental
      ? [...INSTRUMENTAL_SOLO_TAGS]
      : [...((ALLOWED_TAGS_BY_SECTION[section as keyof typeof ALLOWED_TAGS_BY_SECTION] || []) as string[])];
    
    const missingFromFs = fallbackSource.filter(label => !fsLabels.has(label));

    // 3. Only include ACTIVE tags from Firestore
    const activeFsLabels = fsTagsForSection.filter(t => t.isActive).map(t => t.label);

    // 4. Merge: Active Firestore tags + Constants not yet in Firestore
    const merged = [...activeFsLabels, ...missingFromFs];
    return Array.from(new Set(merged));
  }, [section, isInstrumental, sectionTags]);

  const getTagTier = (tag: string) => {
    const fsTag = sectionTags.find(t => t.label === tag);
    if (fsTag) return fsTag.tier;

    if (isInstrumental) return 'free';
    return TAG_META[tag as keyof typeof TAG_META]?.tier || 'free';
  };

  const getTagDescription = (tag: string) => {
    const fsTag = sectionTags.find(t => t.label === tag);
    if (fsTag) return fsTag.description || '';

    if (isInstrumental) {
      return INSTRUMENT_TAG_DESCRIPTIONS[tag as keyof typeof INSTRUMENT_TAG_DESCRIPTIONS] || '';
    }
    return TAG_DESCRIPTIONS[tag as keyof typeof TAG_DESCRIPTIONS] || '';
  };

  const maxSelectable = isInstrumental ? 1 : 2;

  useEffect(() => {
    if (isOpen) setSelectedTags(tags);
  }, [isOpen, tags]);

  const toggleTag = (tag: string) => {
    const tier = getTagTier(tag);
    
    const isLocked = !isInstrumental && ((tier === 'pro' && userTier === 'free') || 
                     (tier === 'pro+' && userTier !== 'pro+'));

    if (isLocked) {
      const tierLabel = tier === 'pro' ? 'Pro' : 'Pro+';
      alert(`${tierLabel} 기능입니다.`);
      return;
    }

    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      }
      
      // For Instrumental, replace the existing selection if it's max 1
      if (isInstrumental) {
        return [tag];
      }

      if (prev.length >= maxSelectable) return prev;
      return [...prev, tag];
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h4 className="text-lg font-bold text-[var(--text-primary)]">{section} 태그 편집</h4>
            {SECTION_META[section]?.descriptionKo && (
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {SECTION_META[section].descriptionKo}
              </p>
            )}
            <p className="text-[10px] text-brand-orange/80 font-bold mt-1 uppercase tracking-wider">
              {`최대 ${maxSelectable}개 선택 가능`}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-white/5 text-[var(--text-secondary)]"
            onMouseEnter={() => onHover({ id: 'tag-modal-close', label: 'Close', labelKo: '닫기', description: '태그 편집 창을 닫습니다.' })}
            onMouseLeave={() => onHover(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {allowedTags.map(tag => {
              const tier = getTagTier(tag);
              const description = getTagDescription(tag);
              const isLocked = !isInstrumental && ((tier === 'pro' && userTier === 'free') || 
                               (tier === 'pro+' && userTier !== 'pro+'));
              
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  onMouseEnter={() => onHover({ 
                    id: `tag-${tag}`, 
                    label: tag, 
                    labelKo: tag, 
                    description: description || (isInstrumental ? '독주용 악기를 선택합니다.' : '음악적 디렉션을 추가합니다.')
                  })}
                  onMouseLeave={() => {
                    onHover(null);
                    onLongPressEnd();
                  }}
                  onTouchStart={() => onLongPressStart({ 
                    id: `tag-${tag}`, 
                    label: tag, 
                    labelKo: tag, 
                    description: description || (isInstrumental ? '독주용 악기를 선택합니다.' : '음악적 디렉션을 추가합니다.')
                  })}
                  onTouchEnd={onLongPressEnd}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border flex items-center gap-1.5",
                    selectedTags.includes(tag)
                      ? "bg-brand-orange border-orange-400 text-white"
                      : isLocked
                        ? "bg-white/5 border-white/10 text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                        : "bg-white/5 border-white/10 text-[var(--text-primary)] hover:bg-white/10"
                  )}
                >
                  {tag}
                  {isLocked && <Lock className="w-3 h-3" />}
                  {tier !== 'free' && !isLocked && <Sparkles className="w-3 h-3 text-yellow-500" />}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              onMouseEnter={() => onHover({ id: 'tag-modal-cancel', label: 'Cancel', labelKo: '취소', description: '변경사항을 취소하고 닫습니다.' })}
              onMouseLeave={() => onHover(null)}
              className="flex-1 py-3 rounded-xl bg-btn-bg border border-btn-border text-sm font-bold text-[var(--text-primary)] hover:bg-btn-hover transition-all shadow-btn"
            >
              취소
            </button>
            <button
              onClick={() => onSave(selectedTags)}
              onMouseEnter={() => onHover({ id: 'tag-modal-save', label: 'Save', labelKo: '저장', description: '선택한 태그를 해당 섹션에 적용합니다.' })}
              onMouseLeave={() => onHover(null)}
              className="flex-1 py-3 rounded-xl bg-brand-orange border border-orange-400 text-sm font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-brand-orange/20"
            >
              저장
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

type SavedStructurePreset = {
  id: string;
  name: string;
  sections: CustomSectionItem[];
  createdAt: number;
  reaction?: 'like' | 'dislike' | null;
};

export const CUSTOM_STRUCTURE_SECTIONS = [
  'Intro',
  'Verse 1',
  'Pre-Chorus',
  'Chorus',
  'Hook',
  'Verse 2',
  'Bridge',
  'Final Chorus',
  'Outro',
  'Breakdown',  
  'Drop',
  'Rap Verse',
  'Solo',
  'Instrumental',
  'Theme A',
  'Theme B',
  'Build-up',
  'Main Theme',
  'Climax',
] as const;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sectionPattern = CUSTOM_STRUCTURE_SECTIONS
  .map(escapeRegExp)
  .join('|');

const sectionRegex = new RegExp(
  `\\s*(\\[(${sectionPattern})[^\\]]*\\])`,
  'g'
);

const TAG_DESCRIPTIONS_LOCAL: Record<string, string> = {
  'Solo': '한 명의 보컬이 중심이 되어 또렷하게 들립니다.',
  'Duet': '두 보컬이 주고받으며 자연스럽게 어우러집니다.',
  'Group': '여러 보컬이 함께 나와 풍성하게 들립니다.',
  'Rap': '멜로디보다 리듬감 있는 랩이 강조됩니다.',
  'Harmony': '여러 화성이 겹쳐 더 풍부하게 들립니다.',
  'Adlib': '자유로운 애드리브가 추가되어 표현이 더 살아납니다.',
};

interface VocalControlProps {
  maleCount: number;
  femaleCount: number;
  vocalMode: VocalMode;
  vocalTones: VocalTone[];
  vocalMembers: VocalMember[];
  selectedToneId?: string;
  rapEnabled: boolean;
  onMaleChange: (count: number) => void;
  onFemaleChange: (count: number) => void;
  onModeChange: (mode: VocalMode) => void;
  onMembersChange: (members: VocalMember[]) => void;
  onToneChange: (toneId: string | undefined) => void;
  onRapChange: (enabled: boolean) => void;
  isKoreanEnglishMix: boolean;
  onToggleKoreanEnglishMix: () => void;
  onClear: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function VocalControl({ 
  maleCount, 
  femaleCount, 
  vocalMode,
  vocalTones,
  vocalMembers,
  selectedToneId,
  rapEnabled,
  isKoreanEnglishMix,
  onToggleKoreanEnglishMix,
  onMaleChange, 
  onFemaleChange, 
  onModeChange,
  onMembersChange,
  onToneChange,
  onRapChange,
  onClear,
  onHover, 
  onLongPressStart, 
  onLongPressEnd,
}: VocalControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Height is now handled by overflow-visible
  }, [maleCount, femaleCount, vocalMode, vocalMembers, selectedToneId, rapEnabled, isKoreanEnglishMix]);
  const [showToneSelector, setShowToneSelector] = useState(false);
  const [activeVocalTonePopup, setActiveVocalTonePopup] = useState<string | null>(null);
  const [vocalTonePopupPos, setVocalTonePopupPos] = useState({ top: 0, left: 0 });

  const handleVocalToneClick = (e: React.MouseEvent, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;
    
    setVocalTonePopupPos({
      top: rect.bottom + scrollY + 4,
      left: rect.left + scrollX
    });
    setActiveVocalTonePopup(activeVocalTonePopup === id ? null : id);
  };

  const getModeLabel = (mode: VocalMode) => {
    if (mode === 'solo') return "솔로";
    if (mode === 'duo') return "듀오";
    return "그룹";
  };

  const getCombinedDescription = () => {
    if (maleCount === 0 && femaleCount === 0) return "보컬의 구성과 성별을 선택합니다.";
    
    const parts = [];
    parts.push(getModeLabel(vocalMode));
    
    if (maleCount > 0 && femaleCount > 0) parts.push("혼성");
    else if (maleCount > 0) parts.push("남성");
    else if (femaleCount > 0) parts.push("여성");
    
    if (rapEnabled) parts.push("랩 포함");
    return parts.join(" ");
  };

  const [contentHeight, setContentHeight] = useState<number | string>('auto');

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [vocalMode, maleCount, femaleCount, vocalMembers, rapEnabled, isKoreanEnglishMix]);

  const handleModeClick = (mode: VocalMode) => {
    onModeChange(mode);
    
    // Reset counts when mode changes to keep it consistent
    if (mode === 'solo') {
      if (maleCount > 0) { onMaleChange(1); onFemaleChange(0); }
      else if (femaleCount > 0) { onMaleChange(0); onFemaleChange(1); }
      else { onMaleChange(1); onFemaleChange(0); } // Default to male solo
    } else if (mode === 'duo') {
      if (maleCount > 1) { onMaleChange(2); onFemaleChange(0); }
      else if (femaleCount > 1) { onMaleChange(0); onFemaleChange(2); }
      else if (maleCount > 0 && femaleCount > 0) { onMaleChange(1); onFemaleChange(1); }
      else if (maleCount > 0) { onMaleChange(2); onFemaleChange(0); }
      else if (femaleCount > 0) { onMaleChange(0); onFemaleChange(2); }
      else { onMaleChange(1); onFemaleChange(1); } // Default to mixed duo
    } else if (mode === 'group') {
      // Start with a reasonable group if empty
      if (maleCount + femaleCount < 3) {
        onMaleChange(2); onFemaleChange(1);
      }
    }
    
    onHover({ id: 'vocal-mode', label: 'Vocal Mode', labelKo: getModeLabel(mode), description: `${getModeLabel(mode)} 모드로 전환합니다.`, _ts: Date.now() });
  };

  const handleGenderToggle = (gender: 'male' | 'female') => {
    if (vocalMode === 'solo') {
      if (gender === 'male') { onMaleChange(1); onFemaleChange(0); }
      else { onMaleChange(0); onFemaleChange(1); }
    } else if (vocalMode === 'duo') {
      if (gender === 'male') {
        if (maleCount === 2) { onMaleChange(1); onFemaleChange(1); }
        else if (maleCount === 1 && femaleCount === 1) { onMaleChange(2); onFemaleChange(0); }
        else { onMaleChange(2); onFemaleChange(0); }
      } else {
        if (femaleCount === 2) { onMaleChange(1); onFemaleChange(1); }
        else if (maleCount === 1 && femaleCount === 1) { onMaleChange(0); onFemaleChange(2); }
        else { onMaleChange(0); onFemaleChange(2); }
      }
    } else if (vocalMode === 'group') {
      // In group mode, toggle gender buttons can act as "Add" or "Switch"
      // But let's make it add a member if total < 7
      if (maleCount + femaleCount < 7) {
        if (gender === 'male') onMaleChange(maleCount + 1);
        else onFemaleChange(femaleCount + 1);
      }
    }
    onHover({ 
      id: gender, 
      label: gender === 'male' ? 'Male' : 'Female', 
      labelKo: gender === 'male' ? '남성' : '여성', 
      description: `${gender === 'male' ? '남성' : '여성'} 보컬 비중을 조절합니다.`, 
      _ts: Date.now() 
    });
  };

  const handleAddMember = (gender: 'male' | 'female') => {
    if (maleCount + femaleCount >= 7) return;
    
    const newMember: VocalMember = {
      id: `member_${Date.now()}`,
      gender,
      roles: ['sub'],
    };
    
    const newMembers = [...vocalMembers, newMember];
    onMembersChange(newMembers);
    if (gender === 'male') onMaleChange(maleCount + 1);
    else onFemaleChange(femaleCount + 1);
  };

  const handleRemoveMember = (idx: number) => {
    if (maleCount + femaleCount <= 1) return; // Minimum 1 member
    
    const member = vocalMembers[idx];
    const newMembers = vocalMembers.filter((_, i) => i !== idx);
    onMembersChange(newMembers);
    
    if (member.gender === 'male') onMaleChange(maleCount - 1);
    else onFemaleChange(femaleCount - 1);
  };

  const handleUpdateMember = (idx: number, updates: Partial<VocalMember>) => {
    const newMembers = [...vocalMembers];
    newMembers[idx] = { ...newMembers[idx], ...updates };
    onMembersChange(newMembers);
  };

  const filteredTones = vocalTones.filter(t => {
    const target = t.genderTarget as string;
    if (target === 'any' || target === 'unisex') return true;
    
    if (maleCount > 0 && femaleCount > 0) {
      return target === 'unisex' || target === 'any' || target === 'group';
    }
    if (maleCount > 0) {
      return target === 'male' || target === 'any' || (vocalMode === 'group' && target === 'group');
    }
    if (femaleCount > 0) {
      return target === 'female' || target === 'any' || (vocalMode === 'group' && target === 'group');
    }
    
    return true;
  });

  const selectedTone = vocalTones.find(t => t.id === selectedToneId);

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl pt-3 px-5 pb-10 border border-[var(--border-color)] flex flex-col h-full shadow-[var(--shadow-md)] relative overflow-visible">
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 
            onMouseEnter={() => setShowTitleTooltip(true)}
            onMouseLeave={() => setShowTitleTooltip(false)}
            className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
          >
            <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
            보컬
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleKoreanEnglishMix}
            onMouseEnter={() => onHover({
              id: 'lyrics-mix',
              label: '한/영 혼합',
              description: isKoreanEnglishMix
                ? '선택한 장르와 관계없이 한국어와 영어가 자연스럽게 섞인 가사를 생성합니다.'
                : '한/영 혼합을 켜면 모든 장르에서 한국어와 영어가 자연스럽게 섞인 가사를 생성합니다.',
            })}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border shadow-sm",
              isKoreanEnglishMix 
                ? "bg-brand-orange/10 border-brand-orange/40 text-brand-orange" 
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)]"
            )}
          >
            <Languages className={cn("w-3 h-3", isKoreanEnglishMix ? "text-brand-orange" : "text-[var(--text-secondary)]")} />
            한/영 혼합 {isKoreanEnglishMix ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => onRapChange(!rapEnabled)}
            onMouseEnter={() => onHover({ id: 'rap', label: 'Rap', labelKo: '랩 사용', description: rapEnabled ? '랩 섹션을 제거합니다.' : '곡에 랩 섹션을 추가합니다.' })}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border shadow-sm",
              rapEnabled 
                ? "bg-brand-orange/10 border-brand-orange/40 text-brand-orange" 
                : "bg-btn-bg border-btn-border text-[var(--text-secondary)]"
            )}
          >
            <Mic2 className={cn("w-3 h-3", rapEnabled ? "text-brand-orange" : "text-[var(--text-secondary)]")} />
            랩 {rapEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={onClear}
            onMouseEnter={() => onHover({ id: 'vocal-clear', label: 'Reset', labelKo: '초기화', description: '보컬 설정을 초기화합니다.' })}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "p-2 rounded-lg transition-all border shadow-btn",
              (maleCount > 0 || femaleCount > 0 || rapEnabled || isKoreanEnglishMix)
                ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/30" 
                : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <AnimatePresence>
          {showTitleTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
            >
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{getCombinedDescription()}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={cn(
        "flex flex-col flex-1 overflow-visible transition-all duration-500 ease-in-out",
        (vocalMembers.length > 0 || maleCount > 0 || femaleCount > 0 || vocalMode === 'group') ? "justify-start" : "justify-center"
      )}>
        <motion.div 
          animate={{ height: contentHeight }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div ref={contentRef} className="space-y-2 mt-0">
            {/* Mode Selection */}
          <div className="flex gap-1 bg-btn-bg p-1 rounded-xl border border-btn-border shadow-btn">
            {(['solo', 'duo', 'group'] as VocalMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeClick(mode)}
                onMouseEnter={() => {
                  const modeInfo = {
                    solo: { label: 'Solo', labelKo: '솔로', description: '혼자서 노래하는 솔로 보컬을 선택합니다.' },
                    duo: { label: 'Duo', labelKo: '듀오', description: '두 명이서 노래하는 듀오 보컬을 선택합니다.' },
                    group: { label: 'Group', labelKo: '그룹', description: '여러 명이서 노래하는 그룹 보컬을 선택합니다.' }
                  };
                  onHover({ id: `vocal-mode-${mode}`, ...modeInfo[mode] });
                }}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                  vocalMode === mode 
                    ? "bg-brand-orange text-white shadow-md" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-btn-hover"
                )}
              >
                {getModeLabel(mode)}
              </button>
            ))}
          </div>

          {/* Gender Selection */}
          {vocalMode === 'group' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddMember('male')}
                disabled={maleCount + femaleCount >= 7}
                onMouseEnter={() => onHover({ id: 'add-male', label: 'Add Male Member', labelKo: '남성 멤버 추가', description: '남성 보컬 멤버를 1명 추가합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3 px-2 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2.5",
                  maleCount + femaleCount < 7
                    ? "bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                남성 멤버 추가
              </button>
              <button
                onClick={() => handleAddMember('female')}
                disabled={maleCount + femaleCount >= 7}
                onMouseEnter={() => onHover({ id: 'add-female', label: 'Add Female Member', labelKo: '여성 멤버 추가', description: '여성 보컬 멤버를 1명 추가합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3 px-2 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-2.5",
                  maleCount + femaleCount < 7
                    ? "bg-pink-600/10 border-pink-500/20 text-pink-400 hover:bg-pink-600/20"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                여성 멤버 추가
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleGenderToggle('male')}
                onMouseEnter={() => onHover({ id: 'male', label: 'Male', labelKo: '남성', description: '남성 보컬을 선택합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3.5 px-3 rounded-2xl text-[13px] font-bold transition-all border flex items-center justify-center gap-2.5 shadow-btn",
                  maleCount > 0
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", maleCount > 0 ? "bg-blue-400" : "bg-[var(--border-color)]")} />
                남성
              </button>
              <button
                onClick={() => handleGenderToggle('female')}
                onMouseEnter={() => onHover({ id: 'female', label: 'Female', labelKo: '여성', description: '여성 보컬을 선택합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "py-3.5 px-3 rounded-2xl text-[13px] font-bold transition-all border flex items-center justify-center gap-2.5 shadow-btn",
                  femaleCount > 0
                    ? "bg-pink-600/20 border-pink-500/40 text-pink-400"
                    : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", femaleCount > 0 ? "bg-pink-400" : "bg-[var(--border-color)]")} />
                여성
              </button>
            </div>
          )}

          {/* Member Roles */}
          {vocalMembers.length > 0 && (
            <div className="space-y-1.5 pt-1.5 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">멤버별 설정 ({vocalMembers.length}/7)</p>
                <span className="text-[9px] text-[var(--text-secondary)] opacity-50">역할 및 톤 개별 설정</span>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                {vocalMembers.map((member, idx) => (
                  <div key={member.id} className="bg-btn-bg rounded-xl p-2 border border-btn-border relative group/member shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          member.gender === 'male' ? "bg-blue-400" : "bg-pink-400"
                        )} />
                        <span className="text-[11px] font-bold text-[var(--text-primary)]">
                          {member.gender === 'male' ? '남성' : '여성'} {idx + 1}
                        </span>
                      </div>
                      
                      {vocalMode === 'group' && vocalMembers.length > 1 && (
                        <button
                          onClick={() => handleRemoveMember(idx)}
                          className="p-1 rounded-md text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover/member:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {(['main', 'lead', 'sub', 'rapper'] as VocalRole[]).map(role => {
                          const isActive = member.roles.includes(role);
                          const roleLabels: Record<VocalRole, { label: string, labelKo: string, description: string }> = {
                            main: { label: 'Main Vocal', labelKo: '메인보컬', description: '곡의 중심이 되는 메인 보컬 역할을 수행합니다.' },
                            lead: { label: 'Lead Vocal', labelKo: '리드보컬', description: '메인 보컬을 보조하며 곡의 흐름을 이끄는 역할을 수행합니다.' },
                            sub: { label: 'Sub Vocal', labelKo: '서브보컬', description: '곡의 풍성함을 더해주는 서브 보컬 역할을 수행합니다.' },
                            rapper: { label: 'Rapper', labelKo: '래퍼', description: '곡의 랩 파트를 담당하는 래퍼 역할을 수행합니다.' }
                          };
                          const info = roleLabels[role];
                          
                          return (
                            <button
                              key={role}
                              onClick={() => {
                                const newRoles = isActive 
                                  ? member.roles.filter(r => r !== role)
                                  : [...member.roles, role];
                                handleUpdateMember(idx, { roles: newRoles });
                              }}
                              onMouseEnter={() => onHover({ id: `role-${role}`, ...info })}
                              onMouseLeave={() => onHover(null)}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[9px] font-bold transition-all border",
                                isActive
                                  ? "bg-brand-orange/20 border-brand-orange/40 text-brand-orange"
                                  : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                              )}
                            >
                              {info.labelKo}
                            </button>
                          );
                        })}
                      </div>

                          <div className="relative">
                            <button
                              data-tone-trigger={member.id}
                              onClick={(e) => handleVocalToneClick(e, member.id)}
                          className={cn(
                            "w-full py-1 px-2 rounded-lg text-[9px] font-bold transition-all border flex items-center justify-between",
                            member.toneId
                              ? "bg-brand-orange/10 border-brand-orange/30 text-brand-orange"
                              : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <Settings className="w-2.5 h-2.5" />
                            <span>{member.toneId ? (vocalTones.find(t => t.id === member.toneId)?.labelKo || vocalTones.find(t => t.id === member.toneId)?.label) : "톤 선택 (기본)"}</span>
                          </div>
                          <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", activeVocalTonePopup === member.id && "rotate-180")} />
                        </button>

                      <AnimatePresence>
                        {activeVocalTonePopup === member.id && (
                          <Portal>
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              style={{ 
                                position: 'absolute',
                                top: vocalTonePopupPos.top,
                                left: vocalTonePopupPos.left,
                                zIndex: 10000,
                                pointerEvents: 'auto'
                              }}
                              className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden w-48"
                            >
                              <div className="p-1 max-h-40 overflow-y-auto custom-scrollbar">
                                <button
                                  onClick={() => { handleUpdateMember(idx, { toneId: undefined }); setActiveVocalTonePopup(null); }}
                                  className={cn(
                                    "w-full text-left px-2 py-1.5 rounded-md text-[9px] font-bold transition-all mb-0.5",
                                    !member.toneId ? "bg-brand-orange text-white" : "text-[var(--text-secondary)] hover:bg-btn-hover"
                                  )}
                                >
                                  기본 (Default)
                                </button>
                                {vocalTones
                                  .filter(t => t.genderTarget === 'any' || t.genderTarget === 'unisex' || t.genderTarget === member.gender || (vocalMode === 'group' && t.genderTarget === 'group'))
                                  .map(tone => (
                                  <button
                                    key={tone.id}
                                    onClick={() => { handleUpdateMember(idx, { toneId: tone.id }); setActiveVocalTonePopup(null); }}
                                    className={cn(
                                      "w-full text-left px-2 py-1.5 rounded-md text-[9px] font-bold transition-all mb-0.5",
                                      member.toneId === tone.id ? "bg-brand-orange text-white" : "text-[var(--text-secondary)] hover:bg-btn-hover"
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{tone.labelKo || tone.label}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                            <div className="fixed inset-0 z-[9999]" onClick={() => setActiveVocalTonePopup(null)} />
                          </Portal>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </motion.div>
      </div>
    </div>
  );
}

interface TempoControlProps {
  enabled: boolean;
  onEnabledChange: (val: boolean) => void;
  min: number;
  max: number;
  onMinChange: (val: number) => void;
  onMaxChange: (val: number) => void;
  onClear: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function TempoControl({ enabled, onEnabledChange, min, max, onMinChange, onMaxChange, onClear, onHover, onLongPressStart, onLongPressEnd }: TempoControlProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);

  const handleStart = (type: 'min' | 'max') => {
    if (enabled) return; // If random is enabled, slider is disabled
    setIsDragging(type);
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!isDragging || !sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = x / rect.width;
      const val = Math.round(40 + percent * (160 - 40));

      if (isDragging === 'min') {
        if (val <= max) onMinChange(val);
      } else {
        if (val >= min) onMaxChange(val);
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(null);
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, min, max, onMinChange, onMaxChange]);

  const displayMin = min;
  const displayMax = max;
  const minPos = ((displayMin - 40) / (160 - 40)) * 100;
  const maxPos = ((displayMax - 40) / (160 - 40)) * 100;
  const isValid = (max - min <= 40) && (min !== 40 || max !== 160);

  return (
    <div className={cn(
      "bg-[var(--card-bg)] rounded-3xl px-6 py-4 border border-[var(--border-color)] transition-all shadow-[var(--shadow-md)]"
    )}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <h3 
              onMouseEnter={() => setShowTitleTooltip(true)}
              onMouseLeave={() => setShowTitleTooltip(false)}
              className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
            >
              <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
              템포(BPM)
            </h3>

            <div 
              className={cn(
                "hidden md:flex items-center gap-1 px-2.5 py-2 bg-btn-bg rounded-xl border border-btn-border shadow-btn transition-opacity",
                enabled && "opacity-30 pointer-events-none"
              )}
              onMouseEnter={() => onHover({ id: 'bpm-input-pc', label: 'BPM Input', labelKo: 'BPM 입력', description: '원하는 BPM 범위를 직접 입력합니다.' })}
              onMouseLeave={() => onHover(null)}
            >
              <input
                type="number"
                min={40}
                max={max}
                value={min}
                disabled={enabled}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    const clamped = Math.max(40, Math.min(val, max));
                    onMinChange(clamped);
                  }
                }}
                className="w-7 bg-transparent text-cyan-400 font-mono font-bold text-[14px] focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[var(--text-secondary)]/50 font-bold text-sm">-</span>
              <input
                type="number"
                min={min}
                max={160}
                value={max}
                disabled={enabled}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    const clamped = Math.max(min, Math.min(val, 160));
                    onMaxChange(clamped);
                  }
                }}
                className="w-7 bg-transparent text-rose-400 font-mono font-bold text-[14px] focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[var(--text-secondary)] text-[9px] uppercase font-bold tracking-tighter">bpm</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={onClear}
                onMouseEnter={() => onHover({ id: 'tempo-clear-mobile', label: 'Reset', labelKo: '초기화', description: '템포 설정을 초기화합니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "p-2 rounded-lg transition-all border shadow-btn",
                  (!enabled || min !== 90 || max !== 110)
                    ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/30" 
                    : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover"
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  onEnabledChange(!enabled);
                  onHover({ id: 'tempo-random-mobile', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' });
                }}
                onMouseEnter={() => onHover({ id: 'tempo-random-mobile', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  enabled 
                    ? "bg-brand-orange text-white" 
                    : "bg-white/10 text-[var(--text-primary)] hover:bg-white/20"
                )}
              >
                <Dices className={cn("w-4 h-4", enabled && "animate-pulse")} />
                <span>랜덤</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => {
                onEnabledChange(!enabled);
                onHover({ id: 'tempo-random-pc', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' });
              }}
              onMouseEnter={() => onHover({ id: 'tempo-random-pc', label: 'Random Tempo', labelKo: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "px-6 py-3 rounded-xl text-base font-bold transition-all flex items-center gap-2",
                enabled 
                  ? "bg-brand-orange text-white" 
                  : "bg-white/10 text-[var(--text-primary)] hover:bg-white/20"
              )}
            >
              <Dices className={cn("w-5 h-5", enabled && "animate-pulse")} />
              <span>랜덤</span>
            </button>
            <button
              onClick={onClear}
              onMouseEnter={() => onHover({ id: 'tempo-clear-pc', label: 'Reset', labelKo: '초기화', description: '템포 설정을 초기화합니다.' })}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2 rounded-lg transition-all border",
                (!enabled || min !== 90 || max !== 110)
                  ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/30" 
                  : "bg-white/10 text-[var(--text-secondary)] border-white/10 hover:bg-white/20"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div 
          className={cn(
            "md:hidden flex items-center justify-center gap-1 px-3 py-2 bg-white/5 rounded-xl border border-white/10 shadow-[var(--shadow-md)] transition-opacity w-fit mx-auto",
            enabled && "opacity-30 pointer-events-none"
          )}
          onMouseEnter={() => onHover({ id: 'bpm-input-mobile', label: 'BPM Input', labelKo: 'BPM 입력', description: '원하는 BPM 범위를 직접 입력합니다.' })}
          onMouseLeave={() => onHover(null)}
        >
          <input
            type="number"
            min={40}
            max={max}
            value={min}
            disabled={enabled}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                const clamped = Math.max(40, Math.min(val, max));
                onMinChange(clamped);
              }
            }}
            className="w-9 bg-transparent text-cyan-400 font-mono font-bold text-base focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[var(--text-secondary)]/50 font-bold text-base">-</span>
          <input
            type="number"
            min={min}
            max={160}
            value={max}
            disabled={enabled}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                const clamped = Math.max(min, Math.min(val, 160));
                onMaxChange(clamped);
              }
            }}
            className="w-9 bg-transparent text-rose-400 font-mono font-bold text-base focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[var(--text-secondary)] text-[9px] uppercase font-bold tracking-tighter">bpm</span>
        </div>
      </div>

      <div 
        className={cn(
          "px-0 py-2 transition-opacity",
          enabled && "opacity-50 pointer-events-none"
        )}
        onMouseEnter={() => onHover({ id: 'bpm-slider', label: 'BPM 조절', description: '슬라이더를 드래그하여 BPM을 조절합니다.' })}
        onMouseLeave={() => onHover(null)}
      >
        <div 
          ref={sliderRef}
          className="relative h-2 bg-[var(--hover-bg)] rounded-full cursor-pointer mx-0"
          onClick={(e) => {
            if (enabled) return;
            const rect = sliderRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const val = Math.round(40 + percent * (160 - 40));
            
            // Snap to nearest handle but respect constraints
            if (Math.abs(val - min) < Math.abs(val - max)) {
              onMinChange(Math.min(val, max));
            } else {
              onMaxChange(Math.max(val, min));
            }
          }}
        >
          {/* Active Range Bar */}
          <div 
            className={cn(
              "absolute h-full rounded-full transition-colors",
              !enabled ? (isValid ? "bg-brand-orange" : "bg-[var(--text-secondary)]/30") : "bg-brand-orange/40"
            )}
            style={{ left: `${minPos}%`, width: `${maxPos - minPos}%` }}
          />

          {/* Min Handle */}
          <div 
            onMouseDown={(e) => { e.stopPropagation(); handleStart('min'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleStart('min'); }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-20",
              !enabled 
                ? "bg-[var(--card-bg)] border-cyan-500 shadow-lg shadow-cyan-500/20 scale-110" 
                : "bg-[var(--card-bg)] border-cyan-500/40 shadow-lg shadow-cyan-500/10 scale-100 cursor-not-allowed",
              isDragging === 'min' && "scale-125 border-cyan-400"
            )}
            style={{ left: `${minPos}%` }}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", !enabled ? "bg-cyan-500" : "bg-cyan-500/50")} />
          </div>

          {/* Max Handle */}
          <div 
            onMouseDown={(e) => { e.stopPropagation(); handleStart('max'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleStart('max'); }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-20",
              !enabled 
                ? "bg-[var(--card-bg)] border-rose-500 shadow-lg shadow-rose-500/20 scale-110" 
                : "bg-[var(--card-bg)] border-rose-500/40 shadow-lg shadow-rose-500/10 scale-100 cursor-not-allowed",
              isDragging === 'max' && "scale-125 border-rose-400"
            )}
            style={{ left: `${maxPos}%` }}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", !enabled ? "bg-rose-500" : "bg-rose-500/50")} />
          </div>
        </div>
        
        <div className="flex justify-between mt-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          <span>40 BPM</span>
          <span>100 BPM</span>
          <span>160 BPM</span>
        </div>
      </div>

      {/* Status Guidance Text - Repositioned to Bottom Center */}
      <div className="flex justify-center mt-2">
        {enabled ? (
          <span className="text-brand-orange text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-brand-orange/10 px-3 py-0.5 rounded-full border border-brand-orange/20">
            <Sparkles className="w-3 h-3 animate-pulse" /> 랜덤 템포 적용됨
          </span>
        ) : (
          isValid ? (
            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-emerald-400/10 px-3 py-0.5 rounded-full border border-emerald-400/20">
              <Check className="w-3 h-3" /> 템포 지정됨
            </span>
          ) : (
            <span className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wider bg-[var(--hover-bg)]/50 px-3 py-0.5 rounded-full border border-[var(--border-color)]">
              범위 20 이하일 때 적용
            </span>
          )
        )}
      </div>
    </div>
  );
}