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
  Home as HomeIcon,
  Heart as HeartIcon,
  User as UserIcon,
  Heart,
  AlertCircle,
  Lock,
  Unlock,
  Edit2,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GENRES, MOODS, THEMES } from './constants';
import { CategoryItem, SongResult, LyricsLength, DrumStyle, VocalGender } from './types';
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
      let errorMessage = "알 수 없는 오류가 발생했습니다.";
      try {
        const parsed = JSON.parse((this.state as any).error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "권한이 부족합니다. 로그인 상태를 확인해주세요.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-red-500/10">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white">문제가 발생했습니다</h2>
            <p className="text-gray-400">{errorMessage}</p>
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

function Navigation({ user, handleLogin, handleLogout }: { user: User | null; handleLogin: () => void; handleLogout: () => void }) {
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
            "p-3 md:p-[14.4px] rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-md text-white shadow-2xl transition-all z-50",
            isExpanded ? "bg-brand-orange border-brand-orange/50 scale-90" : "hover:bg-zinc-800"
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
                    className="p-2.5 md:p-3 rounded-2xl bg-zinc-800/80 border border-white/20 backdrop-blur-md text-white shadow-xl hover:bg-zinc-700 transition-all"
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
                      className="absolute left-full ml-3 top-0 w-32 md:w-40 py-2 bg-zinc-900/95 border border-white/10 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-white/5 mb-1">
                        <p className="text-[10px] md:text-[12px] text-gray-400 truncate font-medium">{user.displayName}</p>
                      </div>
                      <button 
                        onClick={() => {
                          handleLogout();
                          setIsProfileOpen(false);
                          setIsExpanded(false);
                          if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] md:text-[13px] font-bold text-brand-orange hover:bg-white/5 transition-colors text-left"
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
                className="p-2.5 md:p-3 rounded-2xl bg-zinc-800/80 border border-white/20 backdrop-blur-md text-white shadow-xl hover:bg-zinc-700 transition-all"
                title="홈으로"
              >
                <HomeIcon className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Heart Icon (Favorites) */}
              <button 
                onClick={handleHistoryClick}
                className="p-2.5 md:p-3 rounded-2xl bg-zinc-800/80 border border-white/20 backdrop-blur-md text-white shadow-xl hover:bg-zinc-700 transition-all"
                title="내 보관함"
              >
                <HeartIcon className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Suno Icon */}
              <a 
                href="https://suno.com/create" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={handleSunoClick}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] md:text-[11px] font-black tracking-tighter hover:scale-110 transition-all bg-transparent"
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
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [lyricsLength, setLyricsLength] = useState<LyricsLength>('normal');
  const [drumStyle, setDrumStyle] = useState<DrumStyle>('none');
  const [selectedGenders, setSelectedGenders] = useState<VocalGender[]>([]);
  const [pinnedGenres, setPinnedGenres] = useState<string[]>([]);
  const [pinnedMoods, setPinnedMoods] = useState<string[]>([]);
  const [pinnedThemes, setPinnedThemes] = useState<string[]>([]);
  const [isGenreExpanded, setIsGenreExpanded] = useState(false);
  const [isMoodExpanded, setIsMoodExpanded] = useState(false);
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [tempoEnabled, setTempoEnabled] = useState(true);
  const [minBPM, setMinBPM] = useState(90);
  const [maxBPM, setMaxBPM] = useState(110);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [history, setHistory] = useState<SongResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<CategoryItem | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(false);
  const keywordsContainerRef = useRef<HTMLDivElement>(null);
  const [hasKeywordsOverflow, setHasKeywordsOverflow] = useState(false);
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

  useEffect(() => {
    if (keywordsContainerRef.current) {
      const { scrollHeight, clientHeight } = keywordsContainerRef.current;
      setHasKeywordsOverflow(scrollHeight > clientHeight + 5); // Small buffer
    }
  }, [selectedGenres, selectedMoods, selectedThemes]);

  useEffect(() => {
    if (hoveredItem) {
      const timer = setTimeout(() => {
        setHoveredItem(null);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setIsTooltipHovered(false);
    }
  }, [hoveredItem]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [kpopMode, setKpopMode] = useState<0 | 1 | 2>(0); // 0: unselected, 1: basic, 2: mixed
  const [citypopMode, setCitypopMode] = useState<0 | 1 | 2>(0); // 0: unselected, 1: old, 2: modern
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const navigate = useNavigate();
  const abortControllerRef = useRef<AbortController | null>(null);

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

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch favorites for the user
        const q = query(collection(db, 'favorites'), where('uid', '==', currentUser.uid));
        const unsubFavs = onSnapshot(q, (snapshot) => {
          const favs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFavorites(favs);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'favorites');
        });
        return () => unsubFavs();
      } else {
        setFavorites([]);
      }
    });
    return () => unsubscribe();
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

  const [isAppliedKeywordsExpanded, setIsAppliedKeywordsExpanded] = useState(false);
  const [isGenreRandomized, setIsGenreRandomized] = useState(false);
  const [isMoodRandomized, setIsMoodRandomized] = useState(false);
  const [isThemeRandomized, setIsThemeRandomized] = useState(false);

  const randomizeCategory = (category: 'genre' | 'mood' | 'theme') => {
    const all = category === 'genre' ? GENRES : (category === 'mood' ? MOODS : THEMES);
    const pinned = category === 'genre' ? pinnedGenres : (category === 'mood' ? pinnedMoods : pinnedThemes);
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
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('soridraw_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed);
        if (parsed.length > 0) {
          setResult(parsed[0]);
          setHistoryIndex(0);
        }
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('soridraw_history', JSON.stringify(history));
    }
  }, [history]);


  const toggleSelection = (id: string, category: 'genre' | 'mood' | 'theme') => {
    const setters = {
      genre: { state: selectedGenres, set: setSelectedGenres, pinned: pinnedGenres },
      mood: { state: selectedMoods, set: setSelectedMoods, pinned: pinnedMoods },
      theme: { state: selectedThemes, set: setSelectedThemes, pinned: pinnedThemes }
    };
    
    const { state, set, pinned } = setters[category];
    
    // If pinned, don't allow unselecting unless unpinned first
    if (pinned.includes(id)) return;

    // Reset randomized state when manual change occurs
    if (category === 'genre') setIsGenreRandomized(false);
    if (category === 'mood') setIsMoodRandomized(false);
    if (category === 'theme') setIsThemeRandomized(false);

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
        let nextDesc = kpopItem.description;
        if (nextMode === 1) nextDesc = "K-Pop (기본): 한국의 대중음악으로, 다양한 장르가 혼합된 세련된 사운드입니다.";
        else if (nextMode === 2) nextDesc = "K-Pop (한글+영어): 한국어와 영어가 자연스럽게 섞인 K-Pop 스타일의 가사를 생성합니다.";
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
        let nextDesc = citypopItem.description;
        if (nextMode === 1) nextDesc = "City Pop (올드): 80년대 일본 팝, 펑크, 그루비한 레트로 사운드의 오리지널 시티팝입니다.";
        else if (nextMode === 2) nextDesc = "City Pop (현대): 누디스코, 신스팝, 매끄러운 현대적 감각이 더해진 모던 시티팝입니다.";
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
      setHoveredItem(item);
    }
  };

  const togglePin = (id: string, category: 'genre' | 'mood' | 'theme') => {
    const setters = {
      genre: { pinned: pinnedGenres, setPinned: setPinnedGenres, selected: selectedGenres, setSelected: setSelectedGenres },
      mood: { pinned: pinnedMoods, setPinned: setPinnedMoods, selected: selectedMoods, setSelected: setSelectedMoods },
      theme: { pinned: pinnedThemes, setPinned: setPinnedThemes, selected: selectedThemes, setSelected: setSelectedThemes }
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

  const clearCategory = (category: 'genre' | 'mood' | 'theme') => {
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
  };

  const clearAll = () => {
    setSelectedGenres(pinnedGenres);
    if (!pinnedGenres.includes('kpop')) setKpopMode(0);
    if (!pinnedGenres.includes('citypop')) setCitypopMode(0);
    setSelectedMoods(pinnedMoods);
    setSelectedThemes(pinnedThemes);
    setIsGenreRandomized(false);
    setIsMoodRandomized(false);
    setIsThemeRandomized(false);
    setUserInput('');
    // setResult(null); // Keep current song result visible
    // setHistoryIndex(-1);
    setLyricsLength('normal');
    setDrumStyle('none');
    setSelectedGenders([]);
    setTempoEnabled(true);
    setMinBPM(90);
    setMaxBPM(110);
  };

  const deleteHistoryItem = (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem('soridraw_history', JSON.stringify(newHistory));
    
    if (newHistory.length === 0) {
      setResult(null);
      setHistoryIndex(-1);
    } else {
      const nextIndex = Math.min(index, newHistory.length - 1);
      setHistoryIndex(nextIndex);
      setResult(newHistory[nextIndex]);
    }
  };

  const clearHistory = () => {
    if (window.confirm('모든 히스토리를 삭제하시겠습니까?')) {
      setHistory([]);
      localStorage.removeItem('soridraw_history');
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
    const basePerCat = Math.floor(totalTarget / 3);
    const extra = totalTarget % 3;

    const counts = [basePerCat, basePerCat, basePerCat];
    for (let i = 0; i < extra; i++) {
      counts[i]++;
    }
    
    // Shuffle counts to randomize which category gets the extra
    counts.sort(() => 0.5 - Math.random());

    let g = getRandomForCategory(GENRES, pinnedGenres, counts[0], true);
    let m = getRandomForCategory(MOODS, pinnedMoods, counts[1]);
    let t = getRandomForCategory(THEMES, pinnedThemes, counts[2]);

    setSelectedGenres(g);
    setSelectedMoods(m);
    setSelectedThemes(t);

    setIsGenreRandomized(true);
    setIsMoodRandomized(true);
    setIsThemeRandomized(true);

    // Random tempo logic
    if (tempoEnabled) {
      const { min, max } = calculateOptimalBPM(g, m);
      setMinBPM(min);
      setMaxBPM(max);
      // Keep tempoEnabled true to show real-time updates if keywords change
    }
  };

  const handleGenerate = async () => {
    if (isGenerating) {
      // Cancel logic
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      let finalGenres = [...selectedGenres];
      let finalMoods = [...selectedMoods];
      let finalThemes = [...selectedThemes];
      let randomKeywords: string[] = [];

      const hasGenre = finalGenres.length > 0;
      const hasMood = finalMoods.length > 0;
      const hasTheme = finalThemes.length > 0;

      // If exactly two are selected, pick one random for the third
      const selectedCount = [hasGenre, hasMood, hasTheme].filter(Boolean).length;

      if (selectedCount === 2) {
        if (!hasGenre) {
          const random = GENRES[Math.floor(Math.random() * GENRES.length)];
          finalGenres = [random.id];
          randomKeywords.push(random.label);
        } else if (!hasMood) {
          const random = MOODS[Math.floor(Math.random() * MOODS.length)];
          finalMoods = [random.id];
          randomKeywords.push(random.label);
        } else if (!hasTheme) {
          const random = THEMES[Math.floor(Math.random() * THEMES.length)];
          finalThemes = [random.id];
          randomKeywords.push(random.label);
        }
      } 
      // If nothing selected, pick random (5-15 total)
      else if (selectedCount === 0) {
        const allItems = [
          ...GENRES.filter(i => !TROT_GENRES.includes(i.id)).map(i => ({ ...i, cat: 'genre' })),
          ...MOODS.map(i => ({ ...i, cat: 'mood' })),
          ...THEMES.map(i => ({ ...i, cat: 'theme' }))
        ];
        const count = Math.floor(Math.random() * 11) + 5; // 5-15
        const picked = allItems.sort(() => 0.5 - Math.random()).slice(0, count);
        
        picked.forEach(p => {
          if (p.cat === 'genre') finalGenres.push(p.id);
          if (p.cat === 'mood') finalMoods.push(p.id);
          if (p.cat === 'theme') finalThemes.push(p.id);
          randomKeywords.push(p.label);
        });
      }

      let genderPrompt = "";
      if (selectedGenders.length === 2) {
        genderPrompt = "Duet (Male and Female)";
      } else if (selectedGenders.includes('male')) {
        genderPrompt = "Male Vocal";
      } else if (selectedGenders.includes('female')) {
        genderPrompt = "Female Vocal";
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
        setTempoEnabled(false); // Apply the calculated BPM to the menu
      }

      const tempoInfo = tempoEnabled && (currentMinBPM !== 40 || currentMaxBPM !== 160)
        ? (currentMinBPM === currentMaxBPM ? `Exactly ${currentMinBPM} BPM` : `Between ${currentMinBPM} and ${currentMaxBPM} BPM`)
        : undefined;

      // Trot Specific Prompt Logic
      let specialPrompt = "";
      if (finalGenres.includes('traditional-trot')) {
        specialPrompt = "Heartbreaking / Sorrowful, Deep Vibrato, Crying Vocal style, Accordion-led, Nostalgic / Yearning.";
      } else if (finalGenres.includes('semi-trot')) {
        specialPrompt = "Infectious Rhythm, Upbeat & Cheerful, Driving 2-beat / 4-beat, Bright Brass section, Festive / Celebratory.";
      }

      const genreLabels = finalGenres.flatMap(id => {
        if (id === 'citypop') {
          if (citypopMode === 1) return ["City Pop", "80s Japanese Pop", "Funk", "Groovy", "Retro"];
          if (citypopMode === 2) return ["Modern City Pop", "Nu-Disco", "Synth-pop", "Smooth"];
        }
        return [GENRES.find(g => g.id === id)?.label || id];
      });

      const song = await generateSong(
        genreLabels,
        finalMoods.map(id => MOODS.find(m => m.id === id)?.label || id),
        finalThemes.map(id => THEMES.find(t => t.id === id)?.label || id),
        userInput,
        lyricsLength,
        drumStyle,
        genderPrompt || undefined,
        tempoInfo,
        specialPrompt,
        kpopMode
      );

      // Check if aborted before updating state
      if (abortControllerRef.current?.signal.aborted) return;

      const newResult = {
        ...song,
        randomKeywords
      };

      setResult(newResult);
      setHistory(prev => [newResult, ...prev].slice(0, 5)); // Keep last 5
      setHistoryIndex(0);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation cancelled');
      } else {
        console.error(error);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const navigateHistory = (direction: 'prev' | 'next') => {
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
      `[Themes] ${result.appliedKeywords.theme.join(', ')}`,
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
    <div className="min-h-screen bg-[#0f0f0f] text-gray-100 font-sans selection:bg-brand-orange/30">
      <Navigation user={user} handleLogin={handleLogin} handleLogout={handleLogout} />

      <Routes>
        <Route path="/" element={
          <>
            {/* Suno Icon at Top Right (Symmetrical to Floating Bar, moved 2cm right) - Only show after login */}
            {user && (
              <div className="fixed top-[26px] md:top-[28px] right-4 md:right-6 xl:right-8 2xl:right-[calc((100vw-1152px)/2-82px)] z-50">
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
                    className="w-12 h-12 md:w-[64px] md:h-[64px] rounded-2xl border border-white/10 flex items-center justify-center text-brand-orange text-[10px] md:text-[12px] font-black tracking-tighter hover:scale-110 transition-all bg-zinc-900/90 backdrop-blur-md shadow-2xl"
                    title="Suno Create"
                  >
                    SUNO
                  </a>
                </motion.div>
              </div>
            )}

            {/* Header */}
            <header className="pt-24 pb-12 px-6 border-b border-white/10 bg-gradient-to-b from-zinc-800/50 to-transparent relative">
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
                    className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-2 font-display"
                    style={{ fontFamily: 'Verdana' }}
                  >
                    SORIDRAW's <span className="text-studio-brown">Studio</span>
                  </h1>
                  <p className="text-[11px] md:text-[13px] text-gray-500 font-medium tracking-widest uppercase mb-4">
                    Compose Your Atmosphere
                  </p>
                  <p 
                    className="max-w-2xl mx-auto leading-relaxed px-4"
                    style={{ fontFamily: 'Courier New', color: '#b0b3b8', fontWeight: 'normal', fontSize: '14px' }}
                  >
                    <span className="text-gray-300 font-bold text-xl md:text-2xl">나의 이야기를 음악으로</span><br />
                    <span className="text-gray-400">세상에 단 하나 뿐인 나만의 곡을 만들어보세요</span>
                  </p>
                </div>
              </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
              {/* Selection Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CategorySection 
            title="장르" 
            description="곡의 전반적인 음악 스타일을 결정합니다. (프롬프트에 영향)"
            items={GENRES} 
            selected={selectedGenres} 
            pinned={pinnedGenres}
            onToggle={(id) => toggleSelection(id, 'genre')}
            onTogglePin={(id) => togglePin(id, 'genre')}
            onClear={() => clearCategory('genre')}
            onUnpinAll={() => unpinAll('genre')}
            onRandom={() => randomizeCategory('genre')}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
            hoveredItem={hoveredItem}
            isExpanded={isGenreExpanded}
            onToggleExpand={() => setIsGenreExpanded(!isGenreExpanded)}
            allExpanded={isGenreExpanded && isMoodExpanded && isThemeExpanded}
            kpopMode={kpopMode}
            citypopMode={citypopMode}
            isRandomized={isGenreRandomized}
          />
          <CategorySection 
            title="분위기" 
            description="곡의 멜로디와 감정선을 결정합니다. (프롬프트에 영향)"
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
          <CategorySection 
            title="주제" 
            description="가사의 내용과 핵심 메시지를 결정합니다. (가사에 영향)"
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
            onToggleExpand={() => setIsThemeExpanded(!isThemeExpanded)}
            allExpanded={isGenreExpanded && isMoodExpanded && isThemeExpanded}
            isRandomized={isThemeRandomized}
          />
        </div>

        {/* Lyrics Length & Drum Style & Vocal Gender Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LyricsLengthControl 
            value={lyricsLength}
            onChange={setLyricsLength}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
          />
          <DrumStyleControl 
            lyricsLength={lyricsLength}
            value={drumStyle}
            onChange={setDrumStyle}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
          />
          <VocalGenderControl
            value={selectedGenders}
            onChange={setSelectedGenders}
            onHover={setHoveredItem}
            onLongPressStart={handleLongPressStart}
            onLongPressEnd={handleLongPressEnd}
          />
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
            <div 
              ref={keywordsContainerRef}
              className={cn(
                "flex flex-wrap gap-2 justify-center transition-all duration-300 overflow-hidden",
                !isKeywordsExpanded ? "max-h-[42px]" : "max-h-[500px]"
              )}
            >
              <AnimatePresence>
                {[...selectedGenres, ...selectedMoods, ...selectedThemes].map((id) => {
                  const item = [...GENRES, ...MOODS, ...THEMES].find(i => i.id === id);
                  return (
                    <motion.span
                      key={id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="px-3 py-1.5 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      {item?.label}
                      <button 
                        onClick={() => {
                          if (selectedGenres.includes(id)) toggleSelection(id, 'genre');
                          else if (selectedMoods.includes(id)) toggleSelection(id, 'mood');
                          else if (selectedThemes.includes(id)) toggleSelection(id, 'theme');
                        }}
                        className="hover:bg-brand-orange/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
            
            {(hasKeywordsOverflow || isKeywordsExpanded) && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => setIsKeywordsExpanded(!isKeywordsExpanded)}
                  className="text-[10px] font-bold text-gray-500 hover:text-brand-orange transition-colors flex items-center gap-1 uppercase tracking-tighter bg-zinc-900/50 px-3 py-1 rounded-full border border-white/5"
                >
                  {isKeywordsExpanded ? (
                    <>접기 <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>더보기 <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="relative group">
            <div className="absolute top-6 left-4 pointer-events-none z-10">
              <Search className="w-5 h-5 text-gray-400 group-focus-within:text-brand-orange transition-colors" />
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
              className="w-full bg-[#28282c] border border-white/30 rounded-2xl py-5 pl-12 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all text-lg min-h-[68px] max-h-[300px] resize-none overflow-hidden relative"
              rows={1}
            />
            {!userInput && !isInputFocused && (
              <div className="absolute inset-0 pointer-events-none flex items-center pl-12 overflow-hidden">
                <div className="animate-marquee whitespace-nowrap text-gray-400 text-[14px] md:text-lg">
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
                  setHoveredItem({ id: 'random', label: '랜덤 선택', description: '키워드를 무작위로 조합합니다.' });
                }}
                onMouseEnter={() => setHoveredItem({ id: 'random', label: '랜덤 선택', description: '키워드를 무작위로 조합합니다.' })}
                onMouseLeave={() => {
                  setHoveredItem(null);
                  handleLongPressEnd();
                }}
                onTouchStart={() => handleLongPressStart({ id: 'random', label: '랜덤 선택', description: '키워드를 무작위로 조합합니다.' })}
                onTouchEnd={handleLongPressEnd}
                className="h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white transition-all border border-white/10 flex items-center justify-center gap-2 group/random"
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
                "flex-1 py-4 md:py-5 rounded-2xl text-white font-black text-[30px] md:text-[38px] shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98]",
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
                onClick={clearAll}
                onMouseEnter={() => setHoveredItem({ id: 'clear-all', label: 'Clear all', description: '핀을 제외한 모든 선택 삭제' })}
                onMouseLeave={() => setHoveredItem(null)}
                className="h-full w-14 md:w-auto md:px-6 py-4 md:py-0 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white transition-all border border-white/10 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <span className="hidden md:block font-bold">Clear all</span>
              </button>
            </div>
          </div>
        </div>

        {/* Result Area */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-12 border-t border-white/5"
            >


              {/* Applied Keywords After Generation */}
              <div className="bg-zinc-800/50 rounded-2xl p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[16.5px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Check className="w-3 h-3 text-brand-orange" />
                    적용된 키워드
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAppliedKeywordsExpanded(!isAppliedKeywordsExpanded)}
                      className="flex items-center gap-1.5 px-[18px] py-[6px] rounded-full bg-transparent hover:bg-brand-orange/10 text-brand-orange transition-all border border-brand-orange/30 text-[15px] font-bold"
                    >
                      {isAppliedKeywordsExpanded ? '접기' : '펼쳐보기'}
                      {isAppliedKeywordsExpanded ? <ChevronUp className="w-[16px] h-[16px]" /> : <ChevronDown className="w-[16px] h-[16px]" />}
                    </button>
                    <button
                      onClick={() => {
                        const kwText = [
                          `[Genres] ${result.appliedKeywords.genre.join(', ')}`,
                          `[Moods] ${result.appliedKeywords.mood.join(', ')}`,
                          `[Themes] ${result.appliedKeywords.theme.join(', ')}`,
                          result.appliedKeywords.tempo ? `[Tempo] ${result.appliedKeywords.tempo}` : ''
                        ].filter(Boolean).join('\n');
                        copyToClipboard(kwText, 'keywords');
                      }}
                      onMouseEnter={() => setHoveredItem({ id: 'copy-keywords', label: '키워드 복사', description: '적용된 모든 키워드를 복사합니다.' })}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                    >
                      {copiedType === 'keywords' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <motion.div 
                  initial={false}
                  animate={{ height: isAppliedKeywordsExpanded ? 'auto' : '0px' }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 overflow-hidden"
                >
                  {isAppliedKeywordsExpanded && (['genre', 'mood', 'theme'] as const).map((cat) => (
                    <div key={cat} className="space-y-1 group/cat">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">{cat}</p>
                        <button
                          onClick={() => copyToClipboard(result.appliedKeywords[cat].join(', '), `kw-${cat}`)}
                          className="opacity-0 group-hover/cat:opacity-100 transition-opacity p-1 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400"
                        >
                          {copiedType === `kw-${cat}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {result.appliedKeywords[cat].map((kw, idx) => {
                          const isRandom = result.randomKeywords?.includes(kw);
                          const description = [...GENRES, ...MOODS, ...THEMES].find(item => item.label === kw)?.description;
                          
                          return (
                            <span 
                              key={idx} 
                              onMouseEnter={() => {
                                if (description) {
                                  setHoveredItem({ id: `kw-${cat}-${idx}`, label: kw, description });
                                }
                              }}
                              onMouseLeave={() => setHoveredItem(null)}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[11px] transition-all cursor-help",
                                isRandom 
                                  ? "bg-brand-orange/20 text-brand-orange font-bold border border-brand-orange/30" 
                                  : "bg-zinc-800 text-gray-400 border border-white/5"
                              )}
                            >
                              {kw}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {result.appliedKeywords.tempo && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">tempo</p>
                      <div className="flex flex-wrap gap-1">
                        <span 
                          className="px-2 py-0.5 rounded-md text-[11px] bg-zinc-800 text-gray-400 border border-white/5 cursor-help"
                          onMouseEnter={() => setHoveredItem({ id: 'kw-tempo', label: 'Tempo', description: '곡의 빠르기를 나타내는 BPM 범위입니다.' })}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          {result.appliedKeywords.tempo}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Copy All Button */}
              <div className="flex justify-center">
                <button
                  onClick={copyAll}
                  onMouseEnter={() => setHoveredItem({ id: 'copy-all', label: '곡 정보 복사', description: '키워드, 제목, 가사, 프롬프트를 한 번에 복사합니다.' })}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="flex items-center gap-[18px] px-[48px] py-[18px] rounded-2xl bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange transition-all border border-brand-orange/20 shadow-lg shadow-brand-orange/5 group"
                >
                  {copiedType === 'all' ? (
                    <Check className="w-[30px] h-[30px]" />
                  ) : (
                    <Copy className="w-[30px] h-[30px] group-hover:scale-110 transition-transform" />
                  )}
                  <span className="font-bold text-lg">곡 정보 복사</span>
                </button>
              </div>

              {/* Title Card */}
              <div className="bg-zinc-900 rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(result.title, 'title')}
                    onMouseEnter={() => setHoveredItem({ id: 'copy-title', label: '제목 복사', description: '곡의 제목을 복사합니다.' })}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                  >
                    {copiedType === 'title' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-brand-orange font-mono text-sm tracking-widest uppercase font-bold">
                    <Music className="w-4 h-4" />
                    제목 (Title)
                  </div>
                  <div className="h-[60px] md:h-auto flex items-center justify-center">
                    <h2 className="text-[15px] md:text-2xl font-bold text-white leading-tight line-clamp-2 text-center">
                      {result.title}
                    </h2>
                  </div>

                  {/* History Navigation & Heart Icon Below Title */}
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        if (window.confirm('이 곡을 히스토리에서 삭제하시겠습니까?')) {
                          const newHistory = [...history];
                          newHistory.splice(historyIndex, 1);
                          setHistory(newHistory);
                          if (newHistory.length === 0) {
                            setResult(null);
                            setHistoryIndex(-1);
                          } else {
                            const nextIndex = Math.min(historyIndex, newHistory.length - 1);
                            setHistoryIndex(nextIndex);
                            setResult(newHistory[nextIndex]);
                          }
                        }
                      }}
                      className="p-2.5 rounded-2xl bg-white/10 border border-white/10 shadow-lg transition-all hover:bg-red-500/20 group/trash"
                      title="히스토리에서 삭제"
                    >
                      <Trash2 className="w-5 h-5 text-gray-400 group-hover/trash:text-red-500" />
                    </button>

                    <div className="flex items-center gap-2 bg-zinc-700/70 p-1.5 rounded-2xl border border-white/15 shadow-lg">
                      <button
                        onClick={() => navigateHistory('prev')}
                        disabled={historyIndex >= history.length - 1}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xl font-mono font-bold text-gray-300 min-w-[80px] text-center">
                        {historyIndex + 1} / {history.length}
                      </span>
                      <button
                        onClick={() => navigateHistory('next')}
                        disabled={historyIndex <= 0}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => toggleFavorite(result)}
                      className="p-2.5 rounded-2xl bg-white/10 border border-white/10 shadow-lg transition-all hover:bg-white/20 group/heart"
                    >
                      <Heart 
                        className={cn(
                          "w-5 h-5 transition-all",
                          favorites.some(f => f.title === result.title && f.prompt === result.prompt)
                            ? "fill-[#FF8C00] text-[#FF8C00]"
                            : "text-white group-hover/heart:text-[#FF8C00]"
                        )} 
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* English Lyrics Section */}
                <div className="aspect-square bg-zinc-900 rounded-3xl border border-white/10 overflow-hidden flex flex-col group/lyrics">
                  <div className="p-5 border-b border-white/5 flex items-center justify-between bg-zinc-800/30">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                      <Music className="w-4 h-4 text-brand-orange" />
                      영어 가사
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.lyrics.english, 'lyrics-en')}
                        onMouseEnter={() => setHoveredItem({ id: 'copy-lyrics-en', label: '영어 가사 복사', description: '영어 가사 전체를 복사합니다.' })}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                      >
                        {copiedType === 'lyrics-en' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center h-full">
                    <div className="flex-1" />
                    <pre className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-sm md:text-base w-full text-center">
                      {result.lyrics.english}
                    </pre>
                    <div className="flex-1" />
                  </div>
                </div>

                {/* Korean Lyrics Section */}
                <div className="aspect-square bg-zinc-900 rounded-3xl border border-white/10 overflow-hidden flex flex-col group/lyrics">
                  <div className="p-5 border-b border-white/5 flex items-center justify-between bg-zinc-800/30">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                      <Music className="w-4 h-4 text-brand-orange" />
                      한글 가사
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.lyrics.korean, 'lyrics-ko')}
                        onMouseEnter={() => setHoveredItem({ id: 'copy-lyrics-ko', label: '한글 가사 복사', description: '한글 가사 전체를 복사합니다.' })}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                      >
                        {copiedType === 'lyrics-ko' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center h-full">
                    <div className="flex-1" />
                    <pre className="whitespace-pre-wrap font-sans text-gray-400 leading-relaxed text-sm md:text-base w-full text-center">
                      {result.lyrics.korean}
                    </pre>
                    <div className="flex-1" />
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="bg-zinc-900 rounded-3xl border border-white/10 overflow-hidden flex flex-col aspect-square md:col-span-2 lg:col-span-1">
                  <div className="p-5 border-b border-white/5 flex items-center justify-between bg-zinc-800/30">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-brand-orange" />
                      음악 프롬프트
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(result.prompt, 'prompt')}
                        onMouseEnter={() => setHoveredItem({ id: 'copy-prompt', label: '프롬프트 복사', description: '음악 생성 프롬프트를 복사합니다.' })}
                        onMouseLeave={() => setHoveredItem(null)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                      >
                        {copiedType === 'prompt' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col h-full">
                    <div className="flex-1" />
                    <div className="bg-black/30 rounded-2xl p-6 border border-white/5">
                      <p className="text-gray-400 leading-relaxed text-sm font-mono">
                        {result.prompt}
                      </p>
                    </div>
                    <div className="flex-1" />
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
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">불러오는 중...</div>}>
              <FavoritesPageLazy
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                updateFavorite={updateFavorite}
                clearAllFavorites={clearAllFavorites}
                unlockAllFavorites={unlockAllFavorites}
                user={user}
                onHover={setHoveredItem}
                hoveredItem={hoveredItem}
                onLongPressStart={handleLongPressStart}
                onLongPressEnd={handleLongPressEnd}
              />
            </Suspense>
          }
        />
        <Route path="/archive" element={<Navigate to="/history" replace />} />
        <Route path="/library" element={<Navigate to="/history" replace />} />
      </Routes>

      {/* Tooltip / Description Overlay */}
      <AnimatePresence>
        {hoveredItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: isTooltipHovered ? -100 : 0,
              x: '-50%'
            }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onMouseEnter={() => setIsTooltipHovered(true)}
            onMouseLeave={() => setIsTooltipHovered(false)}
            className="fixed bottom-10 left-1/2 z-[100] px-5 py-3 rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-brand-orange/40 shadow-[0_0_30px_rgba(242,125,38,0.1)] pointer-events-auto cursor-default max-w-[200px] text-center"
          >
            <p className="text-brand-orange font-black text-sm mb-1 tracking-tight">{hoveredItem.label}</p>
            <p className="text-[11px] text-gray-300 font-medium leading-relaxed">{hoveredItem.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 text-center border-t border-white/5 text-gray-600 text-sm">
        <p>© 2026 SORIDRAW's Studio. All rights reserved.</p>
      </footer>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] px-4 py-2 rounded-full bg-zinc-800 border border-white/10 shadow-2xl text-xs font-bold text-white flex items-center gap-2"
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

  return (
    <div className="bg-zinc-800/40 rounded-3xl p-6 border border-white/10 flex flex-col h-full relative group">
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <h3 
            onMouseEnter={() => setShowTitleTooltip(true)}
            onMouseLeave={() => setShowTitleTooltip(false)}
            className="text-[20px] font-bold text-white flex items-center gap-2 cursor-help"
          >
            <span className="w-1.5 h-6 bg-brand-orange rounded-full" />
            {title}
            <span className="text-[14px] font-normal text-gray-400 ml-2">({selected.length}/{items.length})</span>
          </h3>
          <AnimatePresence>
            {showTitleTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-zinc-800 border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
              >
                <p className="text-[11px] text-gray-300 leading-snug">{description}</p>
              </motion.div>
            )}
          </AnimatePresence>
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
              "p-2 rounded-lg transition-all",
              isRandomized 
                ? "bg-brand-orange/20 text-brand-orange shadow-lg shadow-brand-orange/10" 
                : "bg-white/5 hover:bg-brand-orange/20 text-gray-500 hover:text-brand-orange"
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
            className="p-2 rounded-lg bg-white/5 hover:bg-brand-orange/20 text-gray-500 hover:text-brand-orange transition-all"
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
            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Expand/Collapse Button - Moved to top of keywords */}
      <div className="pb-4 flex justify-center">
        <button
          onClick={() => {
            onToggleExpand();
            onHover({ id: 'toggle-expand', label: isExpanded ? '접기' : '펼쳐보기', description: isExpanded ? '키워드 목록을 숨깁니다.' : '더 많은 키워드를 보여줍니다.' });
          }}
          onMouseEnter={() => onHover({ id: 'toggle-expand', label: isExpanded ? '접기' : '펼쳐보기', description: isExpanded ? '키워드 목록을 숨깁니다.' : '더 많은 키워드를 보여줍니다.' })}
          onMouseLeave={() => {
            onHover(null);
            onLongPressEnd();
          }}
          onTouchStart={() => onLongPressStart({ id: 'toggle-expand', label: isExpanded ? '접기' : '펼쳐보기', description: isExpanded ? '키워드 목록을 숨깁니다.' : '더 많은 키워드를 보여줍니다.' })}
          onTouchEnd={onLongPressEnd}
          className="flex items-center gap-2 px-6 py-2 rounded-full bg-transparent hover:bg-brand-orange/10 text-brand-orange transition-all border border-brand-orange/30 hover:border-brand-orange/50 group/expand shadow-lg shadow-brand-orange/5"
        >
          <span className="text-[12px] font-bold uppercase tracking-widest">{isExpanded ? '접기' : '펼쳐보기'}</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 group-hover/expand:scale-125 transition-transform" />
          ) : (
            <ChevronDown className="w-5 h-5 group-hover/expand:scale-125 transition-transform" />
          )}
        </button>
      </div>
      
      <div className={cn(
        "flex flex-wrap gap-2 transition-all duration-500",
        !isExpanded ? "max-h-[40px] md:max-h-[84px] overflow-hidden" : "max-h-[1000px] overflow-visible"
      )}>
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
            if (kpopMode === 1) {
              kpopStyle = "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20";
              displayDescription = "K-Pop (기본): 한국의 대중음악으로, 다양한 장르가 혼합된 세련된 사운드입니다.";
            } else if (kpopMode === 2) {
              kpopStyle = "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20";
              displayDescription = "K-Pop (한글+영어): 한국어와 영어가 자연스럽게 섞인 K-Pop 스타일의 가사를 생성합니다.";
            } else {
              kpopStyle = "bg-[#222226] border-white/10 text-gray-300 hover:border-brand-orange/30 hover:text-gray-100";
            }
          }

          // City Pop specific styles
          let citypopStyle = "";
          if (isCitypop) {
            if (citypopMode === 1) {
              citypopStyle = "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20";
              displayDescription = "City Pop (올드): 80년대 일본 팝, 펑크, 그루비한 레트로 사운드의 오리지널 시티팝입니다.";
            } else if (citypopMode === 2) {
              citypopStyle = "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20";
              displayDescription = "City Pop (현대): 누디스코, 신스팝, 매끄러운 현대적 감각이 더해진 모던 시티팝입니다.";
            } else {
              citypopStyle = "bg-[#222226] border-white/10 text-gray-300 hover:border-brand-orange/30 hover:text-gray-100";
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
                  onHover({ ...item, description: displayDescription, _ts: Date.now() });
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm font-medium transition-all border flex items-center gap-2",
                  isKpop ? kpopStyle : (
                    isCitypop ? citypopStyle : (
                      isSelected
                        ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                        : "bg-[#19191b] border-white/5 text-gray-400 hover:border-brand-orange/30 hover:text-gray-200"
                    )
                  )
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
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 px-3 py-2 rounded-xl bg-zinc-800 border border-brand-orange/30 shadow-2xl w-40 pointer-events-none"
                  >
                    <p className="text-[10px] text-gray-300 text-center leading-tight">{hoveredItem.description}</p>
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
                    ? "bg-[#A0522D] border-[#8B4513] text-white opacity-100 scale-100" 
                    : "bg-zinc-800 border-white/10 text-gray-500 opacity-0 scale-75 group-hover/btn:opacity-100 group-hover/btn:scale-100 hover:text-brand-orange"
                )}
              >
                <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LyricsLengthControlProps {
  value: LyricsLength;
  onChange: (val: LyricsLength) => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function LyricsLengthControl({ value, onChange, onHover, onLongPressStart, onLongPressEnd }: LyricsLengthControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const options = [
    { id: 'normal', label: '기본', description: '일반적인 팝 스타일의 가사 분량' },
    { id: 'short', label: '짧게', description: '함축적이고 간결한 가사 (째즈/발라드 추천)' },
    { id: 'very-short', label: '더 짧게', description: '매우 간결하고 함축적인 가사 (2-3줄)' }
  ];

  return (
    <div className="bg-zinc-800/40 rounded-3xl p-6 border border-white/10 flex flex-col h-full">
      <div className="relative mb-6">
        <h3 
          onMouseEnter={() => setShowTitleTooltip(true)}
          onMouseLeave={() => setShowTitleTooltip(false)}
          className="text-[18px] font-bold text-white flex items-center gap-2 cursor-help"
        >
          <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
          가사 길이
        </h3>
        <AnimatePresence>
          {showTitleTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-zinc-800 border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
            >
              <p className="text-[11px] text-gray-300 leading-snug">가사의 전체적인 분량을 조절합니다.</p>
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
                  : "bg-[#222226] border-white/10 text-gray-300 hover:border-brand-orange/30 hover:text-gray-100"
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

interface DrumStyleControlProps {
  lyricsLength: LyricsLength;
  value: DrumStyle;
  onChange: (val: DrumStyle) => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function DrumStyleControl({ lyricsLength, value, onChange, onHover, onLongPressStart, onLongPressEnd }: DrumStyleControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const options = [
    { id: 'none', label: '기본', description: '표준 드럼 비트를 사용합니다.', recommendation: '모든 가사 길이에 적합' },
    { id: 'half-time', label: 'Half', description: '드럼 비트를 절반 속도로 연주하여 여유로운 느낌을 줍니다.', recommendation: '빠른템포' },
    { id: 'double-time', label: 'Double', description: '드럼 비트를 2배 빠르게 연주하여 긴박감을 줍니다.', recommendation: '느린템포' }
  ];

  return (
    <div className="bg-zinc-800/40 rounded-3xl p-6 border border-white/10 flex flex-col h-full">
      <div className="relative mb-6">
        <h3 
          onMouseEnter={() => setShowTitleTooltip(true)}
          onMouseLeave={() => setShowTitleTooltip(false)}
          className="text-[18px] font-bold text-white flex items-center gap-2 cursor-help"
        >
          <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
          드럼 스타일
        </h3>
        <AnimatePresence>
          {showTitleTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-zinc-800 border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
            >
              <p className="text-[11px] text-gray-300 leading-snug">드럼의 연주 방식을 선택합니다.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 mt-auto">
        {options.map((opt) => (
          <div key={opt.id} className="relative flex-1">
            <button
              onClick={() => {
                onChange(opt.id as DrumStyle);
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
                  : "bg-[#222226] border-white/10 text-gray-300 hover:border-brand-orange/30 hover:text-gray-100"
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

interface VocalGenderControlProps {
  value: VocalGender[];
  onChange: (val: VocalGender[]) => void;
  onHover: (item: CategoryItem | null) => void;
  onLongPressStart: (item: CategoryItem) => void;
  onLongPressEnd: () => void;
}

function VocalGenderControl({ value, onChange, onHover, onLongPressStart, onLongPressEnd }: VocalGenderControlProps) {
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const options = [
    { id: 'male', label: '남자', description: '남성 보컬을 적용합니다.' },
    { id: 'female', label: '여자', description: '여성 보컬을 적용합니다.' }
  ];

  const toggleGender = (gender: VocalGender) => {
    if (value.includes(gender)) {
      onChange(value.filter(g => g !== gender));
    } else {
      onChange([...value, gender]);
    }
  };

  return (
    <div className="bg-zinc-800/40 rounded-3xl p-6 border border-white/10 flex flex-col h-full">
      <div className="relative mb-6">
        <h3 
          onMouseEnter={() => setShowTitleTooltip(true)}
          onMouseLeave={() => setShowTitleTooltip(false)}
          className="text-[18px] font-bold text-white flex items-center gap-2 cursor-help"
        >
          <span className="w-1.5 h-5 bg-brand-orange rounded-full" />
          가수 <span className="text-[12px] font-normal text-gray-400">(둘다 적용 = 듀엣)</span>
        </h3>
        <AnimatePresence>
          {showTitleTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-zinc-800 border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
            >
              <p className="text-[11px] text-gray-300 leading-snug">가수의 성별을 선택합니다. 둘 다 선택 시 듀엣이 적용됩니다.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 mt-auto">
        {options.map((opt) => (
          <div key={opt.id} className="relative flex-1">
            <button
              onClick={() => {
                toggleGender(opt.id as VocalGender);
                onHover({ id: opt.id, label: opt.label, description: opt.description });
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
                value.includes(opt.id as VocalGender)
                  ? "bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20"
                  : "bg-[#222226] border-white/10 text-gray-300 hover:border-brand-orange/30 hover:text-gray-100"
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
      "bg-zinc-800/40 rounded-3xl px-6 py-4 border border-white/10 transition-all"
    )}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <h3 
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className="text-[18px] font-bold text-white flex items-center gap-2 cursor-help"
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
                    className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-zinc-800 border border-brand-orange/30 shadow-2xl w-48 pointer-events-none"
                  >
                    <p className="text-[11px] text-gray-300 leading-snug">곡의 빠르기를 BPM 단위로 조절합니다.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div 
              className={cn(
                "hidden md:flex items-center gap-1 px-1.5 py-1 bg-zinc-800/80 rounded-lg border border-white/10 shadow-inner transition-opacity",
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
                className="w-8 bg-transparent text-cyan-400 font-mono font-bold text-base focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-600 font-bold text-sm">-</span>
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
                className="w-8 bg-transparent text-rose-400 font-mono font-bold text-base focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-400 text-[9px] uppercase font-bold tracking-tighter">bpm</span>
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
                "px-4 py-2 rounded-xl text-sm font-bold transition-all border flex items-center gap-2",
                enabled 
                  ? "bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20" 
                  : "bg-zinc-700/50 text-gray-300 border-white/10 hover:border-brand-orange/30 hover:text-gray-100"
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
                ? "bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20" 
                : "bg-zinc-700/50 text-gray-300 border-white/10 hover:border-brand-orange/30 hover:text-gray-100"
            )}
          >
            <Dices className={cn("w-5 h-5", enabled && "animate-pulse")} />
            <span>랜덤</span>
          </button>
        </div>

        <div 
          className={cn(
            "md:hidden flex items-center justify-center gap-1 px-3 py-1.5 bg-zinc-800/80 rounded-lg border border-white/10 shadow-inner transition-opacity w-fit mx-auto",
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
            className="w-10 bg-transparent text-cyan-400 font-mono font-bold text-lg focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-gray-600 font-bold text-lg">-</span>
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
            className="w-10 bg-transparent text-rose-400 font-mono font-bold text-lg focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-gray-400 text-[10px] uppercase font-bold tracking-tighter">bpm</span>
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
          className="relative h-2 bg-zinc-700 rounded-full cursor-pointer mx-0"
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
              !enabled ? (isValid ? "bg-brand-orange" : "bg-zinc-600") : "bg-brand-orange/40"
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
                ? "bg-zinc-800 border-cyan-500 shadow-lg shadow-cyan-500/20 scale-110" 
                : "bg-zinc-800 border-cyan-500/40 shadow-lg shadow-cyan-500/10 scale-100 cursor-not-allowed",
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
                ? "bg-zinc-800 border-rose-500 shadow-lg shadow-rose-500/20 scale-110" 
                : "bg-zinc-800 border-rose-500/40 shadow-lg shadow-rose-500/10 scale-100 cursor-not-allowed",
              isDragging === 'max' && "scale-125 border-rose-400"
            )}
            style={{ left: `${maxPos}%` }}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", !enabled ? "bg-rose-500" : "bg-rose-500/50")} />
          </div>
        </div>
        
        <div className="flex justify-between mt-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
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
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider bg-white/5 px-3 py-0.5 rounded-full border border-white/5">
              범위 20 이하일 때 적용
            </span>
          )
        )}
      </div>
    </div>
  );
}