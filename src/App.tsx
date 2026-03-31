import React, { useState, useEffect, useRef, Component, useCallback, lazy, Suspense } from 'react';
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
  Loader2,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Trash2,
  History,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Plus,
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
  Mic2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  GENRES,
  MOODS,
  THEMES,
  GENRE_GROUPS,
  SOUND_STYLES,
  INSTRUMENT_SOUNDS,
  STYLE_CYCLES,
  SOUND_TEXTURE_CYCLES,
} from './constants';
import { CategoryItem, SongResult, LyricsLength, SongDuration } from './types';
import { generateSong } from './services/geminiService';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  writeBatch,
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  getDocFromServer,
  query as firestoreQuery
} from 'firebase/firestore';

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
    activeTimerRef.current = setTimeout(() => setIsActive(false), 2000);
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
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/5 rounded-full" />
            
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

const MOOD_BPM: Record<string, { min: number; max: number }> = {
  'cool': { min: 90, max: 120 },
  'chill': { min: 60, max: 90 },
  'calm': { min: 40, max: 75 },
  'cheerful': { min: 110, max: 140 },
  'cinematic': { min: 60, max: 140 },
  'mellow': { min: 65, max: 95 },
  'coziness': { min: 60, max: 85 },
  'nostalgic': { min: 50, max: 85 },
  'dreamy': { min: 55, max: 90 },
  'romantic': { min: 60, max: 90 },
  'peaceful': { min: 40, max: 75 },
  'healing': { min: 40, max: 80 },
  'bright': { min: 105, max: 135 },
  'emotional': { min: 50, max: 90 },
  'minimalist': { min: 70, max: 110 },
  'melancholic': { min: 40, max: 70 },
  'bittersweet': { min: 50, max: 85 },
  'groovy': { min: 95, max: 125 },
  'upbeat': { min: 120, max: 150 },
  'funky': { min: 100, max: 130 },
  'powerful': { min: 115, max: 155 },
  'urban': { min: 90, max: 120 },
  'sophisticated': { min: 80, max: 115 },
  'atmospheric': { min: 60, max: 130 },
  'moody': { min: 70, max: 100 },
  'infectious': { min: 110, max: 140 },
  'hypnotic': { min: 80, max: 130 },
  'zen': { min: 40, max: 70 },
  'loneliness': { min: 40, max: 75 }
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

const STYLE_VARIANT_LOOKUP = STYLE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, { id: string; label: string; description: string }>>((acc, variant) => {
  acc[variant.id] = variant;
  return acc;
}, {});

const STYLE_LABEL_TO_ID = STYLE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, string>>((acc, variant) => {
  acc[variant.label] = variant.id;
  return acc;
}, {});

const SOUND_VARIANT_LOOKUP = SOUND_TEXTURE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, { id: string; label: string; description: string }>>((acc, variant) => {
  acc[variant.id] = variant;
  return acc;
}, {});

const SOUND_LABEL_TO_ID = SOUND_TEXTURE_CYCLES.flatMap((cycle) => cycle.variants).reduce<Record<string, string>>((acc, variant) => {
  acc[variant.label] = variant.id;
  return acc;
}, {});

function resolveStyleIds(labelsOrIds: string[] = []) {
  return Array.from(new Set(labelsOrIds.map((value) => STYLE_LABEL_TO_ID[value] ?? (STYLE_VARIANT_LOOKUP[value] ? value : null)).filter(Boolean) as string[]));
}

function resolveSoundTextureIds(labelsOrIds: string[] = []) {
  return Array.from(new Set(labelsOrIds.map((value) => SOUND_LABEL_TO_ID[value] ?? (SOUND_VARIANT_LOOKUP[value] ? value : null)).filter(Boolean) as string[]));
}

function getStyleVariantLabelById(id: string) {
  return STYLE_VARIANT_LOOKUP[id]?.label ?? id;
}

function getSoundVariantLabelById(id: string) {
  return SOUND_VARIANT_LOOKUP[id]?.label ?? id;
}


const calculateOptimalBPM = (genres: string[], moods: string[]) => {
  let sumMin = 0;
  let sumMax = 0;
  let count = 0;

  genres.forEach(g => {
    if (GENRE_BPM[g]) {
      sumMin += GENRE_BPM[g].min;
      sumMax += GENRE_BPM[g].max;
      count++;
    }
  });

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
  const finalMin = Math.max(40, avgMin + Math.floor(Math.random() * (range / 2)));
  const finalMax = Math.min(160, finalMin + Math.floor(Math.random() * (range / 2 + 5)));

  return { min: finalMin, max: finalMax };
};

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <Router>
        <App />
      </Router>
    </ErrorBoundary>
  );
}

function Navigation({ user, handleLogin, handleLogout, themeMode, toggleTheme }: { user: User | null; handleLogin: () => void; handleLogout: () => void; themeMode: 'light' | 'dark' | 'system'; toggleTheme: () => void }) {
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
        className="fixed top-6 left-4 md:left-6 xl:left-8 2xl:left-[calc((100vw-1152px)/2-82px)] z-50 flex flex-col items-center gap-4"
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
        <div className="fixed top-6 right-4 md:right-6 xl:right-8 2xl:right-[calc((100vw-1152px)/2+12px)] z-50">
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
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedInstrumentSounds, setSelectedInstrumentSounds] = useState<string[]>([]);
  
  const [lyricsLength, setLyricsLength] = useState<LyricsLength>('normal');
  const [songDuration, setSongDuration] = useState<SongDuration>('3');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [rapEnabled, setRapEnabled] = useState(false);
  const [pinnedGenres, setPinnedGenres] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_genres');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedMoods, setPinnedMoods] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('soridraw_pinned_moods');
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
    sessionStorage.setItem('soridraw_pinned_moods', JSON.stringify(pinnedMoods));
  }, [pinnedMoods]);
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
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
  const [activeGenreGroupId, setActiveGenreGroupId] = useState<string | null>(null);
  const [tempoEnabled, setTempoEnabled] = useState(true);
  const [minBPM, setMinBPM] = useState(90);
  const [maxBPM, setMaxBPM] = useState(110);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [history, setHistory] = useState<SongResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(historyIndex);
  const [isConfirmingDeleteHistory, setIsConfirmingDeleteHistory] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);
  const [isAppliedKeywordsExpanded, setIsAppliedKeywordsExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<CategoryItem | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(true);
  const keywordsContainerRef = useRef<HTMLDivElement>(null);
  const appliedKeywordsRef = useRef<HTMLDivElement>(null);
  const [hasKeywordsOverflow, setHasKeywordsOverflow] = useState(false);
  const [keywordsContentHeight, setKeywordsContentHeight] = useState(84);
  const [appliedKeywordsHeight, setAppliedKeywordsHeight] = useState<number | string>(0);
  const collapsedKeywordsHeight = 84;
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
    cycles: readonly { id: string; variants: readonly { id: string }[] }[]
  ) => {
    setSelected((prev) => {
      const cycle = cycles.find((item) => item.id === cycleId);
      if (!cycle) return prev;
      const activeIndex = cycle.variants.findIndex((variant) => prev.includes(variant.id));
      const withoutFamily = prev.filter((id) => !cycle.variants.some((variant) => variant.id === id));
      if (activeIndex === -1) return [...withoutFamily, cycle.variants[0].id];
      if (activeIndex < cycle.variants.length - 1) return [...withoutFamily, cycle.variants[activeIndex + 1].id];
      return withoutFamily;
    });
  };

  useEffect(() => {
    if (keywordsContainerRef.current) {
      const fullHeight = keywordsContainerRef.current.scrollHeight;
      setKeywordsContentHeight(Math.max(collapsedKeywordsHeight, fullHeight));
      setHasKeywordsOverflow(fullHeight > collapsedKeywordsHeight + 5);
    } else {
      setKeywordsContentHeight(collapsedKeywordsHeight);
      setHasKeywordsOverflow(false);
    }
  }, [selectedGenres, selectedThemes, selectedMoods, selectedStyles, selectedInstrumentSounds, collapsedKeywordsHeight]);

  useEffect(() => {
    if (appliedKeywordsRef.current) {
      setAppliedKeywordsHeight(appliedKeywordsRef.current.scrollHeight);
    }
  }, [isAppliedKeywordsExpanded, result]);

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
  const [kpopMode, setKpopMode] = useState<0 | 1 | 2>(0); // 0: unselected, 1: basic, 2: mixed
  const [customStructure, setCustomStructure] = useState<string[]>([]);
  const [citypopMode, setCitypopMode] = useState<0 | 1 | 2>(0); // 0: unselected, 1: old, 2: modern
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
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
    if (tempoEnabled && (selectedGenres.length > 0 || selectedMoods.length > 0)) {
      const { min, max } = calculateOptimalBPM(selectedGenres, selectedMoods);
      setMinBPM(min);
      setMaxBPM(max);
    }
  }, [selectedGenres, selectedMoods, tempoEnabled]);

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

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (unsubFavs) {
        unsubFavs();
        unsubFavs = null;
      }

      if (currentUser) {
        // Fetch favorites for the user
        const q = query(collection(db, 'favorites'), where('uid', '==', currentUser.uid));
        unsubFavs = onSnapshot(q, (snapshot) => {
          const favs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFavorites(favs);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'favorites');
        });
      } else {
        setFavorites([]);
      }
    });

    return () => {
      unsubscribe();
      if (unsubFavs) unsubFavs();
    };
  }, []);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000);
  };

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
        await addDoc(collection(db, 'favorites'), {
          uid: user.uid,
          title: song.title,
          lyrics: song.lyrics,
          prompt: song.prompt,
          appliedKeywords: song.appliedKeywords,
          isLocked: false,
          createdAt: serverTimestamp()
        });
        showToast('저장되었습니다.');
      }
    } catch (error) {
      handleFirestoreError(error, existingFav ? OperationType.DELETE : OperationType.CREATE, 'favorites');
    }
  };

  const updateFavorite = async (id: string, updates: Partial<any>) => {
    try {
      await updateDoc(doc(db, 'favorites', id), updates);
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

  // Reset filters on navigation to Home, but preserve generated song history
    useEffect(() => {
      if (location.pathname !== '/') return;

      if (!hasInitializedHomeRef.current) {
        hasInitializedHomeRef.current = true;
        window.scrollTo(0, 0);
        return;
      }

      // 1. Clear current state (preserving history)
      clearAll({ preserveHistory: true, preservePinned: true });

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
    }, [location.pathname]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const applyKeywordsToNext = (appliedKeywords: SongResult['appliedKeywords']) => {
    const mapLabelsToIds = (labels: string[], category: CategoryItem[]) => {
      return labels.map(label => {
        // Special case for City Pop and K-Pop which might have extra labels
        if (label.includes('City Pop') || label === '80s Japanese Pop' || label === 'Funk' || label === 'Groovy' || label === 'Retro' || label === 'Nu-Disco' || label === 'Synth-pop') {
          return 'citypop';
        }
        if (label.includes('K-Pop')) {
          return 'kpop';
        }
        const item = category.find(c => c.label === label);
        return item ? item.id : null;
      }).filter(Boolean) as string[];
    };

    const genreIds = Array.from(new Set(mapLabelsToIds(appliedKeywords.genre, GENRES)));
    const moodIds = Array.from(new Set(mapLabelsToIds(appliedKeywords.mood, MOODS)));
    const themeIds = Array.from(new Set(mapLabelsToIds(appliedKeywords.theme, THEMES)));
    const styleIds = resolveStyleIds(appliedKeywords.style ?? appliedKeywords.theme ?? []);
    const instrumentSoundIds = resolveSoundTextureIds(appliedKeywords.instrumentSound ?? []);
    const resolvedKpopMode = appliedKeywords.kpopMode ?? (genreIds.includes('kpop') ? 1 : 0);

    // Overwrite pinned keywords when applying from Favorites or Results
    setPinnedGenres([]);
    setPinnedMoods([]);
    setPinnedThemes([]);

    setSelectedGenres(genreIds);
    setSelectedMoods(moodIds);
    setSelectedThemes(themeIds);
    setSelectedStyles(styleIds);
    setSelectedInstrumentSounds(instrumentSoundIds);
    setKpopMode(genreIds.includes('kpop') ? resolvedKpopMode : 0);
    setCitypopMode(genreIds.includes('citypop') ? ((appliedKeywords.citypopMode ?? 1) as 0 | 1 | 2) : 0);

    // Expand to include other generation settings
    if (appliedKeywords.lyricsLength) setLyricsLength(appliedKeywords.lyricsLength);
    if (appliedKeywords.songDuration) setSongDuration(appliedKeywords.songDuration);
    if (appliedKeywords.maleCount !== undefined) setMaleCount(appliedKeywords.maleCount);
    if (appliedKeywords.femaleCount !== undefined) setFemaleCount(appliedKeywords.femaleCount);
    if (appliedKeywords.rapEnabled !== undefined) setRapEnabled(appliedKeywords.rapEnabled);
    
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
  };


  const [isGenreRandomized, setIsGenreRandomized] = useState(false);
  const [isMoodRandomized, setIsMoodRandomized] = useState(false);
  const [isThemeRandomized, setIsThemeRandomized] = useState(false);
  const [isStyleRandomized, setIsStyleRandomized] = useState(false);
  const [isSoundTextureRandomized, setIsSoundTextureRandomized] = useState(false);

  const randomizeCategory = (category: 'genre' | 'mood' | 'theme' | 'style' | 'sound') => {
    const all = category === 'genre' ? GENRES : (category === 'mood' ? MOODS : (category === 'theme' ? THEMES : (category === 'style' ? SOUND_STYLES : INSTRUMENT_SOUNDS)));
    const pinned = category === 'genre' ? pinnedGenres : (category === 'mood' ? pinnedMoods : (category === 'theme' ? pinnedThemes : (category === 'style' ? pinnedStyles : pinnedInstrumentSounds)));
    const isGenre = category === 'genre';
    
    const result = [...pinned];
    const remainingPool = all.filter(item => 
      !pinned.includes(item.id) && 
      (!isGenre || !TROT_GENRES.includes(item.id))
    );
    
    // Choose a random number of additional items (up to 5 total)
    const currentCount = pinned.length;
    const maxTotal = 5;
    const additionalCount = Math.max(1, Math.floor(Math.random() * (maxTotal - currentCount + 1)));
    const picked = [...remainingPool].sort(() => 0.5 - Math.random()).slice(0, additionalCount);
    
    const final = [...result, ...picked.map(p => p.id)];
    
    if (category === 'genre') {
      setSelectedGenres(final);
      setIsGenreRandomized(true);
    }
    if (category === 'mood') {
      setSelectedMoods(final);
      setIsMoodRandomized(true);
    }
    if (category === 'theme') {
      setSelectedThemes(final);
      setIsThemeRandomized(true);
    }
    if (category === 'style') {
      setSelectedStyles(final);
      setIsStyleRandomized(true);
    }
    if (category === 'sound') {
      setSelectedInstrumentSounds(final);
      setIsSoundTextureRandomized(true);
    }
  };


  const openGenreModal = (groupId: string) => {
    setActiveGenreGroupId(groupId);
    setIsGenreModalOpen(true);
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

    setIsGenreModalOpen(false);
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
      mood: { state: selectedMoods, set: setSelectedMoods, pinned: pinnedMoods },
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
          const moodsToRemove = ['melancholic', 'nostalgic', 'bittersweet', 'loneliness', 'emotional', 'cinematic'];
          setSelectedMoods(prev => prev.filter(m => !moodsToRemove.includes(m)));
        } else if (id === 'semi-trot') {
          const moodsToRemove = ['urban', 'infectious', 'groovy', 'upbeat', 'cheerful', 'bright'];
          setSelectedMoods(prev => prev.filter(m => !moodsToRemove.includes(m)));
        }
      }
    } else if (state.length < 9) {
      set([...state, id]);
      
      // Trot Logic: Auto-select moods
      if (category === 'genre') {
        if (id === 'traditional-trot') {
          const moodsToAdd = ['melancholic', 'nostalgic', 'bittersweet', 'loneliness', 'emotional', 'cinematic'];
          setSelectedMoods(prev => {
            const combined = Array.from(new Set([...prev, ...moodsToAdd]));
            return combined.slice(0, 9);
          });
        } else if (id === 'semi-trot') {
          const moodsToAdd = ['urban', 'infectious', 'groovy', 'upbeat', 'cheerful', 'bright'];
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
    const setters = {
      genre: { pinned: pinnedGenres, setPinned: setPinnedGenres, selected: selectedGenres, setSelected: setSelectedGenres },
      mood: { pinned: pinnedMoods, setPinned: setPinnedMoods, selected: selectedMoods, setSelected: setSelectedMoods },
      theme: { pinned: pinnedThemes, setPinned: setPinnedThemes, selected: selectedThemes, setSelected: setSelectedThemes },
      style: { pinned: pinnedStyles, setPinned: setPinnedStyles, selected: selectedStyles, setSelected: setSelectedStyles },
      sound: { pinned: pinnedInstrumentSounds, setPinned: setPinnedInstrumentSounds, selected: selectedInstrumentSounds, setSelected: setSelectedInstrumentSounds }
    };

    const { pinned, setPinned, selected, setSelected } = setters[category];
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
      setSelectedMoods(pinnedMoods);
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

  const clearAll = async (options: ClearAllOptions = {}) => {
    const { preserveHistory = false, preservePinned = false } = options;

    if (!preservePinned) {
      setPinnedGenres([]);
      setPinnedMoods([]);
      setPinnedThemes([]);
      setPinnedStyles([]);
      setPinnedInstrumentSounds([]);
    }

    setSelectedGenres(preservePinned ? pinnedGenres : []);
    setSelectedMoods(preservePinned ? pinnedMoods : []);
    setSelectedThemes(preservePinned ? pinnedThemes : []);
    setSelectedStyles(preservePinned ? pinnedStyles : []);
    setSelectedInstrumentSounds(preservePinned ? pinnedInstrumentSounds : []);

    setKpopMode(0);
    setCitypopMode(0);

    setIsGenreRandomized(false);
    setIsMoodRandomized(false);
    setIsThemeRandomized(false);
    setIsStyleRandomized(false);
    setIsSoundTextureRandomized(false);

    setUserInput('');
    setLyricsLength('normal');
    setSongDuration('3');
    setMaleCount(0);
    setFemaleCount(0);
    setRapEnabled(false);

    setTempoEnabled(true);
    setMinBPM(90);
    setMaxBPM(110);

    if (!preserveHistory) {
      setResult(null);
      setHistoryIndex(-1);
      setHistory([]);

      if (user) {
        try {
          const ref = doc(db, "user_recent_songs", user.uid);
          await setDoc(ref, { songs: [] }, { merge: true });
        } catch (error) {
          console.error('Failed to clear history in Firestore:', error);
        }
      }
    } else {
      setResult(prev => {
        if (history.length === 0) return null;
        if (historyIndex >= 0 && history[historyIndex]) return history[historyIndex];
        return history[0] ?? prev;
      });
    }
  };

  const deleteHistoryItem = async (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    
    if (user) {
      try {
        const ref = doc(db, "user_recent_songs", user.uid);
        await setDoc(ref, { songs: newHistory }, { merge: true });
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

  const unpinAll = (category: 'genre' | 'mood' | 'theme') => {
    if (category === 'genre') {
      setPinnedGenres([]);
      setIsGenreRandomized(false);
    }
    if (category === 'mood') {
      setPinnedMoods([]);
      setIsMoodRandomized(false);
    }
    if (category === 'theme') {
      setPinnedThemes([]);
      setIsThemeRandomized(false);
    }
  };

  const applyRandom = () => {
    const getRandomForCategory = (all: CategoryItem[], pinned: string[], count: number, isGenre: boolean = false) => {
      const result = [...pinned];
      const remainingPool = all.filter(item => 
        !pinned.includes(item.id) && 
        (!isGenre || !TROT_GENRES.includes(item.id))
      );
      
      const needed = Math.max(0, count - pinned.length);
      const picked = [...remainingPool].sort(() => 0.5 - Math.random()).slice(0, needed);
      
      return [...result, ...picked.map(p => p.id)];
    };

    // Random selection: Total 5-15, balanced across categories
    const totalTarget = Math.floor(Math.random() * 11) + 5; // 5-15
    const basePerCat = Math.floor(totalTarget / 5);
    const extra = totalTarget % 5;

    const counts = [basePerCat, basePerCat, basePerCat, basePerCat, basePerCat];
    for (let i = 0; i < extra; i++) {
      counts[i]++;
    }
    
    // Shuffle counts to randomize which category gets the extra
    counts.sort(() => 0.5 - Math.random());

    let g = getRandomForCategory(GENRES, pinnedGenres, counts[0], true);
    let m = getRandomForCategory(MOODS, pinnedMoods, counts[1]);
    let t = getRandomForCategory(THEMES, pinnedThemes, counts[2]);
    let s = getRandomForCategory(SOUND_STYLES, pinnedStyles, counts[3]);
    let snd = getRandomForCategory(INSTRUMENT_SOUNDS, pinnedInstrumentSounds, counts[4]);

    setSelectedGenres(g);
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
      const { min, max } = calculateOptimalBPM(g, m);
      setMinBPM(min);
      setMaxBPM(max);
      // Keep tempoEnabled true to show real-time updates if keywords change
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

    await setDoc(ref, { songs: updatedSongs }, { merge: true });

  } catch (e) {
    console.error("Failed to save recent songs:", e);
  }
};
  const handleGenerate = async () => {
    if (!user) {
      showToast('로그인이 필요합니다.');
      handleLogin();
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
        const { min, max } = calculateOptimalBPM(finalGenres, finalMoods);
        currentMinBPM = min;
        currentMaxBPM = max;
        setMinBPM(min);
        setMaxBPM(max);
      }

      const tempoInfo =
        tempoEnabled && (currentMinBPM !== 40 || currentMaxBPM !== 160)
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

      const effectiveStyleIds = Array.from(new Set([...(finalStyles ?? []), ...(finalThemes ?? [])]));
      const styleLabels = getCycleVariantLabel(STYLE_CYCLES, effectiveStyleIds);
      const soundTextureLabels = getCycleVariantLabel(SOUND_TEXTURE_CYCLES, finalInstrumentSounds);
      const hasBalladStyle = effectiveStyleIds.some((id) => ['ballad', 'classic-ballad'].includes(id));

      const genreLabels = finalGenres.flatMap(id => {
        if (id === 'citypop') {
          if (citypopMode === 1) return ["City Pop", "80s Japanese Pop", "Funk", "Groovy", "Retro"];
          if (citypopMode === 2) return ["Modern City Pop", "Nu-Disco", "Synth-pop", "Smooth"];
        }
        return [GENRES.find(g => g.id === id)?.label || id];
      });

      const buildSongPrompt = () => {
        const genreStr = genreLabels.length > 0 ? genreLabels.join(', ') : 'Pop';
        const moodStr = finalMoods.length > 0
          ? finalMoods.map(id => MOODS.find(m => m.id === id)?.label || id).join(', ')
          : 'Emotional';

        const selectedStyleText = styleLabels.length > 0 ? styleLabels.join(', ') : 'Core style kept close to the root genre';
        const selectedSoundText = soundTextureLabels.length > 0 ? soundTextureLabels.join(', ') : 'Balanced mainstream arrangement with tasteful detail';
        const selectedStyleIds = new Set(effectiveStyleIds);
        const selectedSoundFamilies = new Set(finalInstrumentSounds.map((id) => SOUND_TEXTURE_CYCLE_LOOKUP[id]?.id).filter(Boolean));
        const hasStyleId = (...ids: string[]) => ids.some((id) => selectedStyleIds.has(id));
        const hasSoundFamily = (...ids: string[]) => ids.some((id) => selectedSoundFamilies.has(id));

        const bpm = tempoInfo
          ? tempoInfo.replace('Between ', '').replace('Exactly ', '').replace(' and ', '–')
          : (finalMoods.includes('upbeat') || finalMoods.includes('powerful') || hasStyleId('dance', 'modern-edm', 'electronic', 'techno-style', 'house-style'))
            ? '118–132 BPM'
            : (hasBalladStyle || finalMoods.includes('calm') || finalMoods.includes('healing'))
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

        const vocalDesign = maleCount > 0 || femaleCount > 0
          ? (maleCount > 0 && femaleCount > 0
              ? 'Mixed lead arrangement with layered harmonies'
              : maleCount > 1 || femaleCount > 1
                ? 'Stacked ensemble lead with supportive harmonies'
                : 'Main lead vocal with harmony support where needed')
          : 'Main lead vocal with harmony support where needed';

        const vocalStyle = [
          hasBalladStyle ? 'Tender and emotionally clear' : null,
          hasStyleId('anime-style', 'k-style') ? 'slightly dramatic with melodic lift' : null,
          finalMoods.includes('bright') ? 'youthful and open' : null,
          finalMoods.includes('healing') || finalMoods.includes('peaceful') ? 'gentle and reassuring' : null,
          finalMoods.includes('powerful') ? 'focused and dynamically assertive' : null,
          !hasBalladStyle && !finalMoods.includes('bright') && !finalMoods.includes('healing') && !finalMoods.includes('powerful') ? 'clear, expressive, and melody-led' : null,
        ].filter(Boolean).join(', ');

        const arrangement = [
          'Base structure: Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro',
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
·MOOD: ${moodStr}`.trim();
      };

      const songPrompt = buildSongPrompt();

      const song = await generateSong({
        genre: finalGenres[0] ?? null,
        isKpopSelected: selectedGenres.includes('kpop'),
        moods: finalMoods.map(id => MOODS.find(m => m.id === id)?.label || id),

        styles: styleLabels,
        instrumentSounds: finalInstrumentSounds,
        userInput,
        songPrompt,
        lyricsLength,
        songDuration,
        useAutoDuration: false,
        vocal: {
          male: maleCount,
          female: femaleCount,
          rap: rapEnabled,
        },
        tempo: tempoInfo,
        specialPrompt,
        kpopMode,
        customStructure,
      });

      if (abortControllerRef.current?.signal.aborted) return;

      const newResult: SongResult = {
        ...song,
        title: song.title,
        prompt: songPrompt,
        appliedKeywords: {
          ...song.appliedKeywords,
          theme: song.appliedKeywords.theme ?? styleLabels,
          style: song.appliedKeywords.style ?? styleLabels,
          instrumentSound: song.appliedKeywords.instrumentSound ?? finalInstrumentSounds,
          kpopMode,
          customStructure,
          lyricsLength,
          songDuration,
          maleCount,
          femaleCount,
          rapEnabled,
          isBallad: hasBalladStyle,
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
      saveRecentSong(newResult);
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
      result.appliedKeywords.style?.length ? `[Styles] ${result.appliedKeywords.style.join(', ')}` : `[Themes] ${result.appliedKeywords.theme.join(', ')}`,
      result.appliedKeywords.instrumentSound?.length ? `[Sound / Texture] ${result.appliedKeywords.instrumentSound.map(getSoundVariantLabelById).join(', ')}` : '',
      result.appliedKeywords.vocalType ? `[Vocal] ${result.appliedKeywords.vocalType}` : '',
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans selection:bg-brand-orange/30">
      <Navigation user={user} handleLogin={handleLogin} handleLogout={handleLogout} themeMode={themeMode} toggleTheme={toggleTheme} />

      {/* Suno Icon at Top Right (Symmetrical to Floating Bar, moved 2cm right) - Always show after login */}
      {user && (
        <div className="fixed top-6 right-4 md:right-6 xl:right-8 2xl:right-[calc((100vw-1152px)/2-82px)] z-50">
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GenreCategorySection
            title="장르"
            description="대분류를 고른 뒤 실제 장르 1개를 선택합니다."
            groups={GENRE_GROUPS}
            selectedGenreId={selectedGenres[0] ?? null}
            isRandomized={isGenreRandomized}
            onOpenGroup={openGenreModal}
            onClear={() => clearCategory('genre')}
            onRandom={randomizeSingleGenre}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            isExpanded={isGenreExpanded}
            onToggleExpand={() => setIsGenreExpanded(!isGenreExpanded)}
          />            
          <CycleSection 
            title="스타일" 
            description="곡의 표현 방식과 흐름을 결정합니다. 선택한 스타일에 따라 곡의 전개와 리듬감이 달라지며, 음악의 전체적인 인상을 클래식, 세련됨, 감성적 등 원하는 방향으로 이큼니다."
            cycles={STYLE_CYCLES}
            selected={selectedStyles}
            onCycleToggle={(cycleId) => cycleFamilySelection(cycleId, selectedStyles, setSelectedStyles, STYLE_CYCLES)}
            onClear={() => { setSelectedStyles([]); setIsStyleRandomized(false); }}
            onRandom={() => randomizeCategory('style')}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            isRandomized={isStyleRandomized}
            isExpanded={isStyleExpanded}
            onToggleExpand={() => setIsStyleExpanded(!isStyleExpanded)}
          />
          <CycleSection 
            title="사운드/텍스쳐" 
            titleClassName="text-[16px] md:text-[18px]"
            description="악기 톤과 배경 질감을 설정합니다. 소리의 결, 공간감, 무게감, 타격감을 조절하여 음악의 청감 인상을 결정하며, 풍성하거나 깔끔한 사운드를 연출하는 데 영향을 줍니다."
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
            onToggleExpand={() => setIsSoundExpanded(!isSoundExpanded)}
          />
        </div>

        <AnimatePresence>
          {isGenreModalOpen && activeGenreGroupId && (
            <GenreSelectModal
              group={GENRE_GROUPS.find((item) => item.id === activeGenreGroupId) ?? null}
              selectedGenreId={selectedGenres[0] ?? null}
              onClose={() => setIsGenreModalOpen(false)}
              onSelect={handleGenreSelect}
            />
          )}
        </AnimatePresence>

        {/* Lyrics Length & Drum Style & Vocal Gender Controls */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SingerControl 
              maleCount={maleCount}
              femaleCount={femaleCount}
              rapEnabled={rapEnabled}
              onMaleChange={setMaleCount}
              onFemaleChange={setFemaleCount}
              onRapChange={setRapEnabled}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
            />
            <CategorySection 
              title="분위기" 
              description="곡의 감정선과 분위기를 결정합니다. 슬픔, 기쁨, 긴장감 등 음악이 전달하고자 하는 감정적 핵심을 설정하여, 생성되는 음악의 전반적인 감성적 톤을 결정합니다."
              items={MOODS} 
              selected={selectedMoods} 
              pinned={pinnedMoods}
              onToggle={(id) => toggleSelection(id, 'mood')}
              onTogglePin={(id) => togglePin(id, 'mood')}
              onClear={() => clearCategory('mood')}
              onUnpinAll={() => unpinAll('mood')}
              onRandom={() => randomizeCategory('mood')}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
              hoveredItem={hoveredItem}
              isExpanded={isMoodExpanded}
              onToggleExpand={() => setIsMoodExpanded(!isMoodExpanded)}
              allExpanded={isGenreExpanded && isMoodExpanded && isThemeExpanded}
              isRandomized={isMoodRandomized}
            />
            <LyricsControl 
              value={lyricsLength}
              onChange={setLyricsLength}
              kpopMode={kpopMode}
              isKpopSelected={selectedGenres.includes('kpop')}
              onToggleMixedLyrics={() => {
                if (!selectedGenres.includes('kpop')) {
                  setHoveredItem({
                    id: 'lyrics-mix-disabled',
                    label: '한/영 혼합',
                    description: '이 기능은 K-Pop 장르를 선택했을 때 적용됩니다.',
                    _ts: Date.now(),
                  });
                  return;
                }
                const nextMode = kpopMode === 2 ? 1 : 2;
                setKpopMode(nextMode);
                setHoveredItem({
                  id: 'lyrics-mix-toggle',
                  label: '한/영 혼합',
                  description: nextMode === 2
                    ? 'K-Pop 가사에 한국어와 영어가 자연스럽게 섞이도록 적용합니다.'
                    : 'K-Pop 가사를 기본 한국어 중심 흐름으로 되돌립니다.',
                  _ts: Date.now(),
                });
              }}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
            />
            <SongDurationControl 
              value={songDuration}
              onChange={setSongDuration}
              onHover={setHoveredItem}
              onLongPressStart={handleLongPressStart}
              onLongPressEnd={handleLongPressEnd}
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
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
          />
        </div>

        {/* Search & Actions */}
        <div className="space-y-6">
          {/* Applied Keywords Display */}
          <div className="relative">
            <motion.div
              initial={false}
              animate={{ 
                height: isKeywordsExpanded ? keywordsContentHeight : collapsedKeywordsHeight,
                opacity: 1
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden min-h-[84px]"
            >
              <div 
                ref={keywordsContainerRef}
                className="flex flex-wrap gap-2 justify-center min-h-[84px] content-start"
              >
                {[
                  ...selectedGenres.map((id) => ({ id, type: 'genre' as const, label: GENRES.find((item) => item.id === id)?.label ?? id })),
                  ...selectedThemes.map((id) => ({ id, type: 'theme' as const, label: THEMES.find((item) => item.id === id)?.label ?? id })),
                  ...selectedMoods.map((id) => ({ id, type: 'mood' as const, label: MOODS.find((item) => item.id === id)?.label ?? id })),
                  ...selectedStyles.map((id) => ({ id, type: 'style' as const, label: getStyleVariantLabelById(id) })),
                  ...selectedInstrumentSounds.map((id) => ({ id, type: 'sound' as const, label: getSoundVariantLabelById(id) })),
                ].map((item) => {
                    const chipClassName = item.type === 'style'
                      ? 'px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-400/20 text-violet-300 text-xs font-bold flex items-center gap-1.5 shadow-sm'
                      : item.type === 'sound'
                        ? 'px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-bold flex items-center gap-1.5 shadow-sm'
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
                          }}
                          className="hover:bg-white/10 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
              </div>
            </motion.div>
            
            {selectedKeywordCount > 0 && (hasKeywordsOverflow || !isKeywordsExpanded) && (
              <button
                onClick={() => setIsKeywordsExpanded(!isKeywordsExpanded)}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-10 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center text-brand-orange hover:text-white hover:bg-brand-orange transition-all z-20 shadow-xl"
              >
                {isKeywordsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            )}
          </div>

          <div className="relative group">
            <div className="absolute top-6 left-4 pointer-events-none z-10">
              <Search className="w-5 h-5 text-[var(--text-secondary)] group-focus-within:text-brand-orange transition-colors" />
            </div>
            
            <textarea
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onFocus={() => {
                setIsInputFocused(true);
              }}
              onBlur={() => setIsInputFocused(false)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-2xl py-5 pl-12 pr-6 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all text-lg min-h-[68px] max-h-[300px] resize-none overflow-hidden relative shadow-[var(--shadow-lg)]"
              rows={1}
            />
            {!userInput && !isInputFocused && (
              <div className="absolute inset-0 pointer-events-none flex items-center pl-12 overflow-hidden">
                <div className="animate-marquee whitespace-nowrap text-[var(--text-secondary)] text-[14px] md:text-lg">
                  작곡 할 내용을 입력하세요.( 예 : 주식 떡상을 위한 기도, 화성 갈끄니까 괜찮아 ) &nbsp;&nbsp;&nbsp;&nbsp; 작곡 할 내용을 입력하세요.( 예 : 주식 떡상을 위한 기도, 화성 갈끄니까 괜찮아 )
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-row items-stretch gap-2 md:gap-4">
            <div className="relative flex-shrink-0">
              <button
                onClick={() => {
                  applyRandom();
                  setHoveredItem({ id: 'random', label: '전체 랜덤 선택', description: '키워드를 무작위로 조합합니다.' });
                }}
                onMouseEnter={() => setHoveredItem({ id: 'random', label: '전체 랜덤 선택', description: '키워드를 무작위로 조합합니다.' })}
                onMouseLeave={() => {
                  setHoveredItem(null);
                  handleLongPressEnd();
                }}
                onTouchStart={() => handleLongPressStart({ id: 'random', label: '전체 랜덤 선택', description: '키워드를 무작위로 조합합니다.' })}
                onTouchEnd={handleLongPressEnd}
                className="h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] transition-all border border-[var(--border-color)] flex items-center justify-center gap-2 group/random shadow-[var(--shadow-md)]"
              >
                <Dices className="w-5 h-5 text-brand-orange group-hover:rotate-180 transition-transform duration-500" />
                <span className="hidden md:block font-bold">랜덤 선택</span>
              </button>
            </div>

            <button
              onClick={() => {
                handleGenerate();
                setHoveredItem({ id: 'generate', label: '곡 생성하기', description: isGenerating ? '생성을 중단합니다.' : '입력한 키워드로 곡을 생성합니다.' });
              }}
              onMouseEnter={() => setHoveredItem({ id: 'generate', label: '곡 생성하기', description: isGenerating ? '생성을 중단합니다.' : '입력한 키워드로 곡을 생성합니다.' })}
              onMouseLeave={() => {
                setHoveredItem(null);
                handleLongPressEnd();
              }}
              onTouchStart={() => handleLongPressStart({ id: 'generate', label: '곡 생성하기', description: isGenerating ? '생성을 중단합니다.' : '입력한 키워드로 곡을 생성합니다.' })}
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
                className="h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] transition-all border border-[var(--border-color)] flex items-center justify-center gap-2 shadow-[var(--shadow-md)]"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <span className="hidden md:block font-bold">Clear all</span>
              </button>
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
                  <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
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
                      className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--hover-bg)] hover:bg-brand-orange/10 text-brand-orange border border-brand-orange/30 hover:border-brand-orange/40 transition-all active:scale-95 shadow-sm"
                    >
                      <HeartIcon className="w-5 h-5" />
                      <span className="text-sm font-bold whitespace-nowrap">보관함</span>
                    </button>

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
                  <div ref={appliedKeywordsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
                    {[
                      {
                        key: 'genre',
                        title: 'genre',
                        values: result.appliedKeywords.genre ?? [],
                        accent: 'default' as const,
                        getDescription: (kw: string) => GENRES.find((item) => item.label === kw || item.id === kw)?.description,
                        getLabel: (kw: string) => GENRES.find((item) => item.label === kw || item.id === kw)?.label ?? kw,
                      },
                      {
                        key: 'style',
                        title: 'style',
                        values: result.appliedKeywords.style ?? result.appliedKeywords.theme ?? [],
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
                    {result.appliedKeywords.vocalType && (
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter">vocal</p>
                        <div className="flex flex-wrap gap-1">
                          <span 
                            className="px-1.5 py-0.5 rounded-md text-[11px] bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--border-color)] cursor-help"
                            onMouseEnter={() => setHoveredItem({ id: 'kw-vocal', label: 'Vocal', description: '곡의 보컬 구성을 나타냅니다.' })}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {result.appliedKeywords.vocalType}
                          </span>
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
                  </div>
                </motion.div>

                {/* Expand Button at Bottom Center */}
                <button
                  onClick={() => setIsAppliedKeywordsExpanded(!isAppliedKeywordsExpanded)}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center text-brand-orange hover:text-white hover:bg-brand-orange transition-all z-20 shadow-xl"
                >
                  {isAppliedKeywordsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>


              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* English Lyrics Section */}
                  <div className="aspect-square bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)]/80 overflow-hidden flex flex-col group/lyrics shadow-[var(--shadow-md)] hover:border-brand-orange/10 transition-all duration-500">
                    <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]">
                      <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                        <Music className="w-4 h-4 text-brand-orange" />
                        영어 가사
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(result.lyrics.english, 'lyrics-en')}
                          onMouseEnter={() => setHoveredItem({ id: 'copy-lyrics-en', label: '영어 가사 복사', description: '영어 가사 전체를 복사합니다.' })}
                          onMouseLeave={() => setHoveredItem(null)}
                          className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)]/30 active:scale-95"
                        >
                          {copiedType === 'lyrics-en' ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                          <span className="hidden md:block text-sm font-bold">복사</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center h-full">
                      <div className="flex-1" />
                      <pre className="whitespace-pre-wrap font-sans text-[var(--text-secondary)] leading-relaxed text-sm md:text-base w-full text-center">
                        {result.lyrics.english
                          .replace(/\\n/g, '\n')
                          .replace(/\s*(\[(Intro|Verse 1|Verse 2|Pre-Chorus|Chorus|Bridge|Final Chorus|Outro|Drop|Hook|Rap)[^\]]*\])/g, '\n\n$1')
                          .replace(/\n{3,}/g, '\n\n')
                          .trim()}
                      </pre>
                      <div className="flex-1" />
                    </div>
                  </div>

                  {/* Korean Lyrics Section */}
                  <div className="aspect-square bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)]/80 overflow-hidden flex flex-col group/lyrics shadow-[var(--shadow-md)] hover:border-brand-orange/10 transition-all duration-500">
                    <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]/30">
                      <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                        <Music className="w-4 h-4 text-brand-orange" />
                        한글 가사
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(result.lyrics.korean, 'lyrics-ko')}
                          onMouseEnter={() => setHoveredItem({ id: 'copy-lyrics-ko', label: '한글 가사 복사', description: '한글 가사 전체를 복사합니다.' })}
                          onMouseLeave={() => setHoveredItem(null)}
                          className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)]/30 active:scale-95"
                        >
                          {copiedType === 'lyrics-ko' ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                          <span className="hidden md:block text-sm font-bold">복사</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center h-full">
                      <div className="flex-1" />
                      <pre className="whitespace-pre-wrap font-sans text-[var(--text-secondary)] leading-relaxed text-sm md:text-base w-full text-center">
                        {result.lyrics.korean
                          .replace(/\\n/g, '\n')
                          .replace(/\s*(\[(Intro|Verse 1|Verse 2|Pre-Chorus|Chorus|Bridge|Final Chorus|Outro|Drop|Hook|Rap)[^\]]*\])/g, '\n\n$1')
                          .replace(/\n{3,}/g, '\n\n')
                          .trim()}
                      </pre>
                      <div className="flex-1" />
                    </div>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)]/80 overflow-hidden flex flex-col h-[400px] shadow-[var(--shadow-md)] hover:border-brand-orange/10 transition-all duration-500">
                  <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-secondary)]/30">
                    <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-brand-orange" />
                      음악 프롬프트
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.prompt, 'prompt')}
                        onMouseEnter={() => setHoveredItem({ id: 'copy-prompt', label: '프롬프트 복사', description: '음악 생성 프롬프트를 복사합니다.' })}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="flex items-center gap-1.5 p-2 md:px-3.5 md:py-2 rounded-xl bg-[var(--hover-bg)] hover:bg-[var(--hover-bg)]/20 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)]/30 active:scale-95"
                      >
                        {copiedType === 'prompt' ? <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
                        <span className="hidden md:block text-sm font-bold">복사</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                    <div className="bg-[var(--input-bg)] rounded-2xl p-6 border border-[var(--border-color)]">
                      <p className="text-[var(--text-secondary)] leading-relaxed text-sm font-mono whitespace-pre-wrap">
                        {result.prompt}
                      </p>
                    </div>
                  </div>
                </div>
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
            className="fixed bottom-10 left-1/2 z-[100] px-5 py-3 rounded-2xl bg-[var(--card-bg)]/90 backdrop-blur-xl border border-brand-orange/40 shadow-[0_0_30px_rgba(242,125,38,0.1)] pointer-events-auto cursor-default max-w-[200px] text-center"
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

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-brand-orange hover:bg-[var(--hover-bg)] transition-all shadow-sm"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRandom}
            onMouseEnter={() => onHover({ id: 'genre-random', label: '랜덤 선택', description: '세부 장르 1개를 무작위로 선택합니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'genre-random', label: '랜덤 선택', description: '세부 장르 1개를 무작위로 선택합니다.' })}
            onTouchEnd={onLongPressEnd}
            className={cn(
              "p-2.5 rounded-xl transition-all border",
              isRandomized
                ? "bg-brand-orange text-white border-orange-400 shadow-lg shadow-brand-orange/20"
                : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            )}
          >
            <Dices className="w-4 h-4" />
          </button>
          <button
            onClick={onClear}
            onMouseEnter={() => onHover({ id: 'genre-clear', label: 'Clear all', description: '선택한 장르를 초기화합니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'genre-clear', label: 'Clear all', description: '선택한 장르를 초기화합니다.' })}
            onTouchEnd={onLongPressEnd}
            className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-red-500/20 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
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
                onMouseEnter={() => onHover({ id: group.id, label: group.label, description: group.description })}
                onMouseLeave={() => {
                  onHover(null);
                  onLongPressEnd();
                }}
                onTouchStart={() => onLongPressStart({ id: group.id, label: group.label, description: group.description })}
                onTouchEnd={onLongPressEnd}
                className={cn(
                  "px-3.5 py-3 rounded-xl text-[13px] font-bold transition-all border text-left min-h-[52px]",
                  isSelectedGroup
                    ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                    : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{group.label}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                </div>
                {isSelectedGroup && selectedChild && (
                  <div className="mt-1 text-[11px] text-white/80 font-medium">
                    {selectedChild.label}
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
            {selectedGroup?.label} / {selectedChild.label}
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
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!group) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
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
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{group.label}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{group.description}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {group.children.map((item) => {
            const isSelected = selectedGenreId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full text-left rounded-2xl border px-4 py-3 transition-all",
                  isSelected
                    ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                    : "bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)]"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm">{item.label}</div>
                    <div className={cn("text-xs mt-1", isSelected ? "text-white/80" : "text-[var(--text-secondary)]")}>
                      {item.description}
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
  description: string;
  cycles: readonly { id: string; title: string; variants: readonly { id: string; label: string; description: string }[] }[];
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
}

function CycleSection({ 
  title, 
  description, 
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
  onToggleExpand
}: CycleSectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded, cycles]);

  const selectedFamilyCount = cycles.filter((cycle) => cycle.variants.some((variant) => selected.includes(variant.id))).length;

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full relative group shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative min-w-0">
            <h3
              onMouseEnter={() => setShowTitleTooltip(true)}
              onMouseLeave={() => setShowTitleTooltip(false)}
              className={cn("font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help", titleClassName ?? "text-[20px]")}
            >
              <span className="w-1.5 h-6 bg-brand-orange rounded-full shrink-0" />
              <span className="truncate">{title}</span>
              <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-1">({selectedFamilyCount}/{cycles.length})</span>
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

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-brand-orange hover:bg-[var(--hover-bg)] transition-all shrink-0 shadow-sm"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onRandom} className={`p-2.5 rounded-xl border border-[var(--border-color)] transition-all ${isRandomized ? 'bg-brand-orange text-white' : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}>
            <Dices className="w-4 h-4" />
          </button>
          <button onClick={onClear} className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-red-500/20 hover:text-red-400 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ 
          height: isExpanded ? contentHeight : 130,
          opacity: 1
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div ref={contentRef} className="grid grid-cols-2 gap-2 md:gap-2.5">
          {cycles.map((cycle) => {
            const activeIndex = cycle.variants.findIndex((variant) => selected.includes(variant.id));
            const activeVariant = activeIndex >= 0 ? cycle.variants[activeIndex] : null;
            const baseVariant = cycle.variants[0];
            const hoverItem: CategoryItem = activeVariant
              ? {
                  id: cycle.id,
                  label: activeVariant.label,
                  description: activeVariant.description,
                }
              : {
                  id: cycle.id,
                  label: cycle.title,
                  description: baseVariant.description,
                };
            return (
              <button
                key={cycle.id}
                onClick={() => {
                  const nextIndex = activeIndex === -1 ? 0 : activeIndex < cycle.variants.length - 1 ? activeIndex + 1 : -1;
                  onCycleToggle(cycle.id);
                  if (nextIndex === -1) {
                    onHover({ id: cycle.id, label: cycle.title, description: baseVariant.description, _ts: Date.now() } as CategoryItem);
                  } else {
                    const nextVariant = cycle.variants[nextIndex];
                    onHover({ id: cycle.id, label: nextVariant.label, description: nextVariant.description, _ts: Date.now() } as CategoryItem);
                  }
                }}
                onMouseEnter={() => onHover(hoverItem)}
                onMouseLeave={() => { onHover(null); onLongPressEnd(); }}
                onTouchStart={() => onLongPressStart(hoverItem)}
                onTouchEnd={onLongPressEnd}
                className={cn(
                  "min-h-[58px] rounded-xl border px-3 py-2.5 text-left transition-all flex items-center",
                  activeVariant ? CYCLE_VARIANT_COLORS[Math.min(activeIndex, CYCLE_VARIANT_COLORS.length - 1)] : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
                )}
              >
                <span className="text-[13px] md:text-[13.5px] font-bold leading-tight truncate w-full">
                  {activeVariant ? activeVariant.label : cycle.title}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-4 min-h-[44px] rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-3 flex items-center justify-center text-center">
        {selected.length > 0 ? (
          <p className="text-sm font-semibold text-brand-orange">
            {cycles.filter(c => c.variants.some(v => selected.includes(v.id)))
              .map(c => c.variants.find(v => selected.includes(v.id))?.label)
              .join(', ')}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            {title} 키워드를 선택하세요.
          </p>
        )}
      </div>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  description: string;
  items: CategoryItem[];
  selected: string[];
  pinned: string[];
  onToggle: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClear: () => void;
  onUnpinAll: () => void;
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
}

function CategorySection({ 
  title, 
  description,
  items, 
  selected, 
  pinned,
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
  isRandomized = false
}: CategorySectionProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(84);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [items, selected, isExpanded]);

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full relative group shadow-[var(--shadow-md)]">
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
              <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-2">({selected.length}/{items.length})</span>
            </h3>
            <AnimatePresence>
              {showTitleTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-[var(--shadow-md)] w-48 pointer-events-none"
                >
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{description}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-brand-orange hover:bg-[var(--hover-bg)] transition-all shadow-sm"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onRandom}
            onMouseEnter={() => onHover({ id: 'random-cat', label: '랜덤 선택', description: `${title} 키워드를 무작위로 선택합니다.` })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'random-cat', label: '랜덤 선택', description: `${title} 키워드를 무작위로 선택합니다.` })}
            onTouchEnd={onLongPressEnd}
            className={cn(
              "p-2.5 rounded-xl transition-all border",
              isRandomized 
                ? "bg-brand-orange text-white border-orange-400 shadow-lg shadow-brand-orange/20" 
                : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            )}
          >
            <Dices className="w-4 h-4" />
          </button>
          <button 
            onClick={onUnpinAll}
            onMouseEnter={() => onHover({ id: 'unpin-all', label: '모든 핀 해제', description: '고정된 모든 키워드를 해제합니다.' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'unpin-all', label: '모든 핀 해제', description: '고정된 모든 키워드를 해제합니다.' })}
            onTouchEnd={onLongPressEnd}
            className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-all"
          >
            <PinOff className="w-4 h-4" />
          </button>
          <button 
            onClick={onClear}
            onMouseEnter={() => onHover({ id: 'clear', label: 'Clear all', description: '핀을 제외한 모든 선택 삭제' })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: 'clear', label: 'Clear all', description: '핀을 제외한 모든 선택 삭제' })}
            onTouchEnd={onLongPressEnd}
            className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-red-500/20 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <motion.div
        initial={false}
        animate={{ 
          height: isExpanded ? contentHeight : (window.innerWidth < 768 ? 40 : 84),
          opacity: 1
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden min-h-[40px] md:min-h-[84px]"
      >
        <div ref={contentRef} className="flex flex-wrap gap-2">
          {items.map((item) => {
          const isPinned = pinned.includes(item.id);
          const isSelected = selected.includes(item.id);
          const isKpop = item.id === 'kpop';
          const isCitypop = item.id === 'citypop';
          
          // K-Pop specific styles
          let kpopStyle = "";
          let displayLabel = item.label;
          let displayDescription = item.description;

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
              kpopStyle = "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]";
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
              citypopStyle = "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]";
              displayDescription = "City Pop 장르를 선택하고 스타일(올드/현대)을 순환하며 선택합니다.";
              displayLabel = "City Pop";
            }
          }

          return (
            <div key={item.id} className="relative group/btn">
              <button
                onMouseEnter={() => onHover({ ...item, description: displayDescription })}
                onMouseLeave={() => {
                  onHover(null);
                  onLongPressEnd();
                }}
                onTouchStart={() => onLongPressStart({ ...item, description: displayDescription })}
                onTouchEnd={onLongPressEnd}
                onClick={() => {
                  onToggle(item.id);
                  // Show description on click for mobile/touch users
                  // For K-Pop and City Pop, toggleSelection already updates the hover state with the correct next description
                  if (!isKpop && !isCitypop) {
                    onHover({ ...item, description: displayDescription, _ts: Date.now() });
                  }
                }}
                className={cn(
                  "px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition-all border flex items-center gap-2",
                  (isKpop || isCitypop) ? "min-w-[120px] justify-center" : "",
                  isSelected
                    ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                    : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]",
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(item.id);
                }}
                className={cn(
                  "absolute -top-2 -right-2 p-1.5 rounded-full border transition-all z-10",
                  isPinned 
                    ? "bg-brand-orange border-orange-400 text-white opacity-100 scale-100 shadow-lg shadow-brand-orange/20" 
                    : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-secondary)] opacity-0 scale-75 group-hover/btn:opacity-100 group-hover/btn:scale-100 hover:text-brand-orange"
                )}
              >
                <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
              </button>
            </div>
          );
        })}
        </div>
      </motion.div>

      <div className="mt-4 min-h-[44px] rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-3 flex items-center justify-center text-center">
        {selected.length > 0 ? (
          <p className="text-sm font-semibold text-brand-orange">
            {selected.map(id => items.find(i => i.id === id)?.label).join(', ')}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            키워드를 선택하여 곡의 {title}를 설정하세요.
          </p>
        )}
      </div>
    </div>
  );
}

interface LyricsControlProps {
  value: LyricsLength;
  onChange: (val: LyricsLength) => void;
  kpopMode: 0 | 1 | 2;
  isKpopSelected: boolean;
  onToggleMixedLyrics: () => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function LyricsControl({ value, onChange, kpopMode, isKpopSelected, onToggleMixedLyrics, onHover, onLongPressStart, onLongPressEnd }: LyricsControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const options = [
    { id: 'very-short', label: '더짧게', description: '매우 간결하고 함축적인 가사 (2-3줄)' },
    { id: 'short', label: '짧게', description: '함축적이고 간결한 가사 (째즈/발라드 추천)' },
    { id: 'normal', label: '기본', description: '일반적인 팝 스타일의 가사 분량' },
    { id: 'long', label: '길게', description: '서사적이고 풍부한 가사' }
  ];

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full shadow-[var(--shadow-md)]">
      <div className="relative mb-6 flex items-center justify-between gap-3">
        <h3 
          onMouseEnter={() => setShowTitleTooltip(true)}
          onMouseLeave={() => setShowTitleTooltip(false)}
          className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
        >
          <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
          가사
        </h3>

        <button
          onClick={onToggleMixedLyrics}
          onMouseEnter={() => onHover({
            id: 'lyrics-mix',
            label: '한/영 혼합',
            description: !isKpopSelected
              ? '이 기능은 K-Pop 장르를 선택했을 때 적용됩니다.'
              : kpopMode === 2
                ? 'K-Pop 가사에 한국어와 영어가 자연스럽게 섞이도록 적용됩니다.'
                : 'K-Pop 가사를 기본 한국어 중심 흐름으로 생성합니다.',
          })}
          onMouseLeave={() => {
            onHover(null);
            onLongPressEnd();
          }}
          onTouchStart={() => onLongPressStart({
            id: 'lyrics-mix',
            label: '한/영 혼합',
            description: !isKpopSelected
              ? '이 기능은 K-Pop 장르를 선택했을 때 적용됩니다.'
              : kpopMode === 2
                ? 'K-Pop 가사에 한국어와 영어가 자연스럽게 섞이도록 적용됩니다.'
                : 'K-Pop 가사를 기본 한국어 중심 흐름으로 생성합니다.',
          })}
          onTouchEnd={onLongPressEnd}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
            !isKpopSelected
              ? "bg-[var(--hover-bg)] border-[var(--border-color)] text-[var(--text-secondary)]/60"
              : kpopMode === 2
                ? "bg-brand-orange/10 border-brand-orange text-brand-orange"
                : "bg-[var(--hover-bg)] border-[var(--border-color)] text-[var(--text-secondary)]"
          )}
        >
          <span className={cn(
            "w-2 h-2 rounded-full",
            !isKpopSelected ? "bg-[var(--text-secondary)]/40" : kpopMode === 2 ? "bg-brand-orange" : "bg-[var(--text-secondary)]"
          )} />
          한/영 혼합 {isKpopSelected ? (kpopMode === 2 ? 'ON' : 'OFF') : '대기'}
        </button>
        <AnimatePresence>
          {showTitleTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-2xl w-56 pointer-events-none"
            >
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">가사의 전체적인 분량을 조절합니다. K-Pop 선택 시 오른쪽 토글로 한글/영어 혼합 가사도 설정할 수 있습니다.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 mt-auto">
        {options.map((opt) => (
          <div key={opt.id} className="relative flex-1">
            <button
              onClick={() => {
                onChange(opt.id as LyricsLength);
                onHover({ id: opt.id, label: opt.label, description: opt.description, _ts: Date.now() });
              }}
              onMouseEnter={() => onHover({ id: opt.id, label: opt.label, description: opt.description })}
              onMouseLeave={() => {
                onHover(null);
                onLongPressEnd();
              }}
              onTouchStart={() => onLongPressStart({ id: opt.id, label: opt.label, description: opt.description })}
              onTouchEnd={onLongPressEnd}
              className={cn(
                "w-full py-3 rounded-xl text-sm font-bold transition-all border",
                value === opt.id
                  ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                  : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
              )}
            >
              {opt.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SongDurationControlProps {
  value: SongDuration;
  onChange: (val: SongDuration) => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function SongDurationControl({ value, onChange, onHover, onLongPressStart, onLongPressEnd }: SongDurationControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);

  const options = [
    { id: '1', label: '1분' },
    { id: '2', label: '2분' },
    { id: '3', label: '3분' },
    { id: '4', label: '4분' },
    { id: '5', label: '5분' },
    { id: '6', label: '6분' }
  ];

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full shadow-[var(--shadow-md)]">
      <div className="relative mb-6">
        <h3 
          onMouseEnter={() => setShowTitleTooltip(true)}
          onMouseLeave={() => setShowTitleTooltip(false)}
          className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
        >
          <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
          곡 길이
        </h3>
        <AnimatePresence>
          {showTitleTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
            >
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">곡의 전체 길이를 설정합니다.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-auto">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => {
              onChange(opt.id as SongDuration);
              onHover({ id: opt.id, label: opt.label, description: `곡 길이를 ${opt.label}로 설정합니다.` });
            }}
            onMouseEnter={() => onHover({ id: opt.id, label: opt.label, description: `곡 길이를 ${opt.label}로 설정합니다.` })}
            onMouseLeave={() => {
              onHover(null);
              onLongPressEnd();
            }}
            onTouchStart={() => onLongPressStart({ id: opt.id, label: opt.label, description: `곡 길이를 ${opt.label}로 설정합니다.` })}
            onTouchEnd={onLongPressEnd}
            className={cn(
              "py-3 rounded-xl text-sm font-bold transition-all border",
              value === opt.id
                ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SingerControlProps {
  maleCount: number;
  femaleCount: number;
  rapEnabled: boolean;
  onMaleChange: (count: number) => void;
  onFemaleChange: (count: number) => void;
  onRapChange: (enabled: boolean) => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function SingerControl({ 
  maleCount, 
  femaleCount, 
  rapEnabled,
  onMaleChange, 
  onFemaleChange, 
  onRapChange,
  onHover, 
  onLongPressStart, 
  onLongPressEnd 
}: SingerControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);

  const getMaleDescription = (count: number) => {
    if (count === 0) return "남성 보컬 미선택";
    if (count === 1) return "남성 솔로 보컬";
    if (count === 2) return "남성 듀오 보컬";
    return "남성 그룹 보컬";
  };

  const getFemaleDescription = (count: number) => {
    if (count === 0) return "여성 보컬 미선택";
    if (count === 1) return "여성 솔로 보컬";
    if (count === 2) return "여성 듀오 보컬";
    return "여성 그룹 보컬";
  };

  const getCombinedDescription = () => {
    if (maleCount === 0 && femaleCount === 0) return "가수의 성별과 인원 구성을 선택합니다.";
    
    const parts = [];
    if (maleCount > 0) parts.push(getMaleDescription(maleCount));
    if (femaleCount > 0) parts.push(getFemaleDescription(femaleCount));
    if (rapEnabled) parts.push("랩 섹션 포함");
    return parts.join(" + ");
  };

  const handleMaleClick = () => {
    const next = (maleCount + 1) % 4;
    onMaleChange(next);
    const label = next === 0 ? "남자" : next === 3 ? "남자 그룹" : `남자 ${next}인`;
    onHover({ id: 'male', label, description: getMaleDescription(next), _ts: Date.now() });
  };

  const handleFemaleClick = () => {
    const next = (femaleCount + 1) % 4;
    onFemaleChange(next);
    const label = next === 0 ? "여자" : next === 3 ? "여자 그룹" : `여자 ${next}인`;
    onHover({ id: 'female', label, description: getFemaleDescription(next), _ts: Date.now() });
  };

  const getMaleLabel = () => {
    if (maleCount === 0) return "남자";
    if (maleCount === 3) return "남자 그룹";
    return `남자 ${maleCount}인`;
  };

  const getFemaleLabel = () => {
    if (femaleCount === 0) return "여자";
    if (femaleCount === 3) return "여자 그룹";
    return `여자 ${femaleCount}인`;
  };

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full shadow-[var(--shadow-md)]">
      <div className="relative mb-6 flex items-center justify-between">
        <h3 
          onMouseEnter={() => setShowTitleTooltip(true)}
          onMouseLeave={() => setShowTitleTooltip(false)}
          className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
        >
          <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
          가수
        </h3>

        <button
          onClick={() => onRapChange(!rapEnabled)}
          onMouseEnter={() => onHover({ id: 'rap', label: '랩 사용', description: rapEnabled ? '랩 섹션을 제거합니다.' : '곡에 랩 섹션을 추가합니다.' })}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
            rapEnabled 
              ? "bg-brand-orange/10 border-brand-orange text-brand-orange" 
              : "bg-[var(--hover-bg)] border-[var(--border-color)] text-[var(--text-secondary)]"
          )}
        >
          <Mic2 className={cn("w-3 h-3", rapEnabled ? "text-brand-orange" : "text-[var(--text-secondary)]")} />
          랩 {rapEnabled ? 'ON' : 'OFF'}
        </button>

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

      <div className="grid grid-cols-2 gap-2 mt-auto">
        <button
          onClick={handleMaleClick}
          onMouseEnter={() => onHover({ id: 'male', label: getMaleLabel(), description: getMaleDescription(maleCount) })}
          onMouseLeave={() => onHover(null)}
          onTouchStart={() => onLongPressStart({ id: 'male', label: getMaleLabel(), description: getMaleDescription(maleCount) })}
          onTouchEnd={onLongPressEnd}
          className={cn(
            "py-3 px-2 rounded-xl text-xs font-bold transition-all border min-w-[90px] h-[44px] flex items-center justify-center",
            maleCount === 1 
              ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
              : maleCount > 1
                ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20"
                : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
          )}
        >
          {getMaleLabel()}
        </button>
        <button
          onClick={handleFemaleClick}
          onMouseEnter={() => onHover({ id: 'female', label: getFemaleLabel(), description: getFemaleDescription(femaleCount) })}
          onMouseLeave={() => onHover(null)}
          onTouchStart={() => onLongPressStart({ id: 'female', label: getFemaleLabel(), description: getFemaleDescription(femaleCount) })}
          onTouchEnd={onLongPressEnd}
          className={cn(
            "py-3 px-2 rounded-xl text-xs font-bold transition-all border min-w-[90px] h-[44px] flex items-center justify-center",
            femaleCount === 1 
              ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
              : femaleCount > 1
                ? "bg-pink-600 border-pink-400 text-white shadow-lg shadow-pink-500/20"
                : "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
          )}
        >
          {getFemaleLabel()}
        </button>
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
  onHover: (item: { id: string; label: string; description: string } | null) => void;
  onLongPressStart: (item: { id: string; label: string; description: string }) => void;
  onLongPressEnd: () => void;
}

function TempoControl({ enabled, onEnabledChange, min, max, onMinChange, onMaxChange, onHover, onLongPressStart, onLongPressEnd }: TempoControlProps) {
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
            <div className="relative">
              <h3 
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className="text-[18px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
              >
                <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
                템포(BPM)
              </h3>
              <AnimatePresence>
                {showTitleTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
                  >
                    <p className="text-[11px] text-[var(--text-secondary)] leading-snug">곡의 빠르기를 BPM 단위로 조절합니다.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div 
              className={cn(
                "hidden md:flex items-center gap-1 px-2.5 py-2 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-md)] transition-opacity",
                enabled && "opacity-30 pointer-events-none"
              )}
              onMouseEnter={() => onHover({ id: 'bpm-input-pc', label: 'BPM 입력', description: '원하는 BPM 범위를 직접 입력합니다.' })}
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

          <div className="md:hidden">
              <button
                onClick={() => {
                  onEnabledChange(!enabled);
                  onHover({ id: 'tempo-random-mobile', label: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' });
                }}
                onMouseEnter={() => onHover({ id: 'tempo-random-mobile', label: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' })}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "px-4 py-3 rounded-xl text-sm font-bold transition-all border flex items-center gap-2",
                  enabled 
                    ? "bg-brand-orange text-white border-orange-400 shadow-lg shadow-brand-orange/20" 
                    : "bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]"
                )}
              >
              <Dices className={cn("w-4 h-4", enabled && "animate-pulse")} />
              <span>랜덤</span>
            </button>
          </div>
        </div>

        <div className="hidden md:block">
          <button
            onClick={() => {
              onEnabledChange(!enabled);
              onHover({ id: 'tempo-random-pc', label: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' });
            }}
            onMouseEnter={() => onHover({ id: 'tempo-random-pc', label: '랜덤 템포', description: '장르와 분위기에 맞는 최적의 템포로 적용됩니다.' })}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "px-6 py-3 rounded-xl text-base font-bold transition-all border flex items-center gap-2",
              enabled 
                ? "bg-brand-orange text-white border-orange-400 shadow-lg shadow-brand-orange/20" 
                : "bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]"
            )}
          >
            <Dices className={cn("w-5 h-5", enabled && "animate-pulse")} />
            <span>랜덤</span>
          </button>
        </div>

        <div 
          className={cn(
            "md:hidden flex items-center justify-center gap-1 px-3 py-2 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-md)] transition-opacity w-fit mx-auto",
            enabled && "opacity-30 pointer-events-none"
          )}
          onMouseEnter={() => onHover({ id: 'bpm-input-mobile', label: 'BPM 입력', description: '원하는 BPM 범위를 직접 입력합니다.' })}
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