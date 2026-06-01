import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crown,
  Database,
  Key,
  Languages,
  Library,
  ListMusic,
  Lock,
  LogOut,
  Music,
  Palette,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { AppUserInfo, UserRole } from '../types';
import SunoApiSettingsPanel from '../components/SunoApiSettingsPanel';

type FeatureState = boolean | 'partial';
type FeatureKey =
  | 'libraryDetail'
  | 'applyToNextSong'
  | 'playlist'
  | 'bilingualLyrics'
  | 'songStructureCustom'
  | 'vocalCharacterBuilder'
  | 'sectionCustomAdvanced'
  | 'storyboard'
  | 'colorSync'
  | 'advancedPromptOptions';

type PlanConfig = {
  label: string;
  badge: string;
  description: string;
  dailyGenerateLimit: number | null;
  accentClass: string;
  features: Record<FeatureKey, FeatureState>;
};

const PLAN_CONFIG: Record<Exclude<UserRole, 'admin'> | 'admin', PlanConfig> = {
  free: {
    label: 'Free',
    badge: '기본 플랜',
    description: '개인 API 키 등록 후 기본 생성만 사용할 수 있습니다.',
    dailyGenerateLimit: 10,
    accentClass: 'from-[#A47048]/14 to-[#1B1412]/20 border-[#A47048]/22',
    features: {
      libraryDetail: false,
      applyToNextSong: false,
      playlist: false,
      bilingualLyrics: false,
      songStructureCustom: false,
      vocalCharacterBuilder: false,
      sectionCustomAdvanced: false,
      storyboard: false,
      colorSync: false,
      advancedPromptOptions: false,
    },
  },
  basic: {
    label: 'Basic',
    badge: '편의 기능 플랜',
    description: '보관함, 라이브러리, 언어 생성 편의 기능을 사용할 수 있습니다.',
    dailyGenerateLimit: null,
    accentClass: 'from-[#AC6B69]/18 to-[#A47048]/8 border-[#AC6B69]/28',
    features: {
      libraryDetail: true,
      applyToNextSong: true,
      playlist: true,
      bilingualLyrics: true,
      songStructureCustom: 'partial',
      vocalCharacterBuilder: false,
      sectionCustomAdvanced: 'partial',
      storyboard: 'partial',
      colorSync: true,
      advancedPromptOptions: false,
    },
  },
  pro: {
    label: 'Pro',
    badge: '전체 기능 플랜',
    description: 'SORIDRAW의 고급 커스텀과 프로 작업 기능을 모두 사용할 수 있습니다.',
    dailyGenerateLimit: null,
    accentClass: 'from-[#877198]/20 to-[#965B77]/8 border-[#877198]/30',
    features: {
      libraryDetail: true,
      applyToNextSong: true,
      playlist: true,
      bilingualLyrics: true,
      songStructureCustom: true,
      vocalCharacterBuilder: true,
      sectionCustomAdvanced: true,
      storyboard: true,
      colorSync: true,
      advancedPromptOptions: true,
    },
  },
  admin: {
    label: 'Admin',
    badge: '관리자',
    description: '관리자 계정으로 모든 기능을 사용할 수 있습니다.',
    dailyGenerateLimit: null,
    accentClass: 'from-[#A47048]/18 to-[#877198]/10 border-[#D9B89D]/24',
    features: {
      libraryDetail: true,
      applyToNextSong: true,
      playlist: true,
      bilingualLyrics: true,
      songStructureCustom: true,
      vocalCharacterBuilder: true,
      sectionCustomAdvanced: true,
      storyboard: true,
      colorSync: true,
      advancedPromptOptions: true,
    },
  },
};

const FEATURE_LABELS: Array<{ key: FeatureKey; label: string; description: string; icon: React.ElementType }> = [
  { key: 'libraryDetail', label: '보관함 상세보기', description: '프롬프트·가사·설정값 전체 확인', icon: Library },
  { key: 'applyToNextSong', label: '다음곡 적용', description: '저장곡 설정을 새 작업에 재사용', icon: WandSparkles },
  { key: 'playlist', label: '플레이리스트', description: '라이브러리 곡을 폴더처럼 관리', icon: ListMusic },
  { key: 'bilingualLyrics', label: '한글/영어 동시 생성', description: '가사 결과를 두 언어로 함께 제작', icon: Languages },
  { key: 'songStructureCustom', label: '곡구조 커스텀', description: '섹션 구조를 직접 설계', icon: Music },
  { key: 'vocalCharacterBuilder', label: '보컬 캐릭터 만들기', description: '보컬 성격·창법·표현감 세부 설정', icon: UserCircle2 },
  { key: 'sectionCustomAdvanced', label: '섹션 커스텀', description: '구간별 태그와 전개를 고급 조정', icon: Database },
  { key: 'storyboard', label: '스토리보드', description: '상황·관계·전개 버전을 설계', icon: Sparkles },
  { key: 'colorSync', label: '색상 동기화', description: '보관함/라이브러리 색상 변경사항 동기화', icon: Palette },
  { key: 'advancedPromptOptions', label: '고급 프롬프트 옵션', description: '프로 작업용 세부 생성 옵션', icon: Crown },
];

const normalizePlan = (role?: string | null, planName?: string | null): UserRole => {
  const raw = `${role || ''} ${planName || ''}`.toLowerCase();
  if (raw.includes('admin')) return 'admin';
  if (raw.includes('pro')) return 'pro';
  if (raw.includes('basic')) return 'basic';
  return 'free';
};

const formatDate = (value?: number | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const PROJECT_ID = 'soridraw-app-866a5';
const REGION = 'us-central1';
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const SUNO_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_suno_api_key_registered';

const scopedStorageKey = (base: string, uid?: string | null) => `${base}_${uid || 'guest'}`;

const getLocalApiStatus = (uid?: string | null) => {
  try {
    return localStorage.getItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, uid)) === 'true';
  } catch {
    return false;
  }
};

const fetchSunoApiStatus = async (user?: User | null): Promise<boolean> => {
  if (!user?.uid) return false;
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${BASE_URL}/getSunoApiKeyStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const result = await res.json().catch(() => null);
    if (res.ok) {
      const hasKey = Boolean(result && (result.hasSunoApiKey || result.registered || result.hasApiKey || result.exists));
      try {
        if (hasKey) localStorage.setItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');
        else localStorage.removeItem(scopedStorageKey(SUNO_API_KEY_REGISTERED_STORAGE_BASE, user.uid));
      } catch {
        // localStorage may be unavailable.
      }
      return hasKey;
    }
  } catch {
    // Network/server failures fall back to local hint.
  }
  return getLocalApiStatus(user.uid);
};

const getRemainingCredits = (uid?: string | null) => {
  try {
    const value = Number(localStorage.getItem(scopedStorageKey('soridraw_suno_remaining_credits', uid)) || '');
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
};

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black border ${active ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20' : 'bg-rose-500/10 text-rose-300 border-rose-400/20'}`}>
      {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
}

function FeatureBadge({ state }: { state: FeatureState }) {
  if (state === true) {
    return <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-300">사용 가능</span>;
  }
  if (state === 'partial') {
    return <span className="rounded-full border border-[#AC6B69]/24 bg-[#AC6B69]/12 px-2.5 py-1 text-[11px] font-black text-[#D8A4A2]">일부 가능</span>;
  }
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-[var(--text-secondary)]">잠김</span>;
}

export default function MyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<AppUserInfo | null>(null);
  const [isApiRegistered, setIsApiRegistered] = useState(() => getLocalApiStatus(auth.currentUser?.uid));
  const [remainingCredits, setRemainingCredits] = useState<number | null>(() => getRemainingCredits(auth.currentUser?.uid));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsApiRegistered(getLocalApiStatus(currentUser?.uid));
      setRemainingCredits(getRemainingCredits(currentUser?.uid));
      fetchSunoApiStatus(currentUser).then(setIsApiRegistered);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      setProfile(snapshot.exists() ? ({ uid: user.uid, ...snapshot.data() } as AppUserInfo) : null);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const refreshStatus = () => {
      setIsApiRegistered(getLocalApiStatus(user?.uid));
      setRemainingCredits(getRemainingCredits(user?.uid));
      fetchSunoApiStatus(user).then(setIsApiRegistered);
    };
    window.addEventListener('storage', refreshStatus);
    window.addEventListener('soridraw:suno-credits-updated', refreshStatus as EventListener);
    window.addEventListener('focus', refreshStatus);
    return () => {
      window.removeEventListener('storage', refreshStatus);
      window.removeEventListener('soridraw:suno-credits-updated', refreshStatus as EventListener);
      window.removeEventListener('focus', refreshStatus);
    };
  }, [user?.uid]);


  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    if (params.get('section') !== 'music-api') return;

    const scrollToMusicApiSection = () => {
      const target = document.getElementById('music-api-credit-section');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const frameId = window.requestAnimationFrame(() => {
      window.setTimeout(scrollToMusicApiSection, 80);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.search, user]);

  const planKey = useMemo(() => normalizePlan(profile?.role, profile?.planName), [profile?.role, profile?.planName]);
  const plan = PLAN_CONFIG[planKey];
  const generatedCount = profile?.songGeneratedCount || 0;
  const favoriteCount = profile?.favoriteCount || 0;
  const dailyLimitText = plan.dailyGenerateLimit === null ? '제한 없음' : `하루 ${plan.dailyGenerateLimit}회`;

  const handleLogout = useCallback(async () => {
    await signOut(auth);
    navigate('/');
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] px-4 pt-20 pb-16 text-[var(--text-primary)]">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-[var(--bg-secondary)] p-8 text-center shadow-2xl">
          <UserCircle2 className="mx-auto mb-4 h-10 w-10 text-[#D8A4A2]" />
          <h1 className="text-2xl font-black">로그인이 필요합니다</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">마이페이지는 로그인 후 사용할 수 있습니다.</p>
          <button onClick={() => navigate('/')} className="mt-6 rounded-2xl border border-[#AC6B69]/28 bg-[#AC6B69]/12 px-5 py-3 text-sm font-black text-[#D8A4A2] hover:bg-[#AC6B69]/20 transition-all">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-20 pb-16 text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1500px] space-y-7">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/80 px-4 py-2.5 text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> 홈
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#877198]/28 bg-[#877198]/12 px-4 py-2.5 text-sm font-black text-[#BBA8CA] opacity-80 cursor-not-allowed"
                title="플랜/구독 페이지는 다음 단계에서 연결합니다."
              >
                <Crown className="w-4 h-4" /> 플랜 업그레이드 준비중
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#AC6B69]/80">MY STUDIO</p>
            <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">마이페이지</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              개인 API 연결 관리, 현재 플랜, 사용량과 잠긴 기능을 한눈에 확인합니다.
            </p>
          </div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)]/80 p-5 md:p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <img src={user.photoURL || 'https://picsum.photos/seed/soridraw-user/160/160'} alt="profile" referrerPolicy="no-referrer" className="h-16 w-16 rounded-3xl object-cover border border-white/10 shadow-xl" />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black">{user.displayName || 'SORIDRAW User'}</h2>
                  <p className="truncate text-sm text-[var(--text-secondary)]">{user.email || profile?.email || '-'}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">가입일 {formatDate(profile?.createdAt)}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-300 transition-all" title="로그아웃">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold text-[var(--text-secondary)]">전체 생성</p>
                <p className="mt-2 text-2xl font-black">{generatedCount.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold text-[var(--text-secondary)]">보관함</p>
                <p className="mt-2 text-2xl font-black">{favoriteCount.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold text-[var(--text-secondary)]">생성 제한</p>
                <p className="mt-2 text-lg font-black text-[#D8A4A2]">{dailyLimitText}</p>
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`rounded-3xl border bg-gradient-to-br ${plan.accentClass} p-5 md:p-6 shadow-2xl`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-black">
                  <ShieldCheck className="w-3.5 h-3.5" /> {plan.badge}
                </div>
                <h2 className="mt-4 text-3xl font-black">{plan.label}</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{plan.description}</p>
              </div>
              <Crown className="h-10 w-10 opacity-80" />
            </div>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-4">
                <span className="text-sm font-bold text-[var(--text-secondary)]">구독 상태</span>
                <span className="text-sm font-black">{profile?.paymentStatus === 'active' ? '활성' : '미연결'}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 p-4">
                <span className="text-sm font-bold text-[var(--text-secondary)]">만료/갱신일</span>
                <span className="text-sm font-black">{formatDate(profile?.planExpireAt || profile?.nextBillingAt)}</span>
              </div>
            </div>
          </motion.section>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.45fr_0.55fr] xl:grid-cols-[1.55fr_0.45fr]">
          <div id="music-api-credit-section" className="scroll-mt-24">
            <SunoApiSettingsPanel />
          </div>

          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)]/80 p-4 md:p-5 shadow-2xl backdrop-blur-xl">
            <h2 className="text-base font-black flex items-center gap-2"><Palette className="w-4 h-4 text-[#BBA8CA]" /> 개인 설정</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">이후 단계에서 확장합니다.</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">색상 동기화</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">진입 1회 확인, 이탈 시 변경분 1회 저장</p>
                  </div>
                  <FeatureBadge state={plan.features.colorSync} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">기본 언어/자동 저장</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">추후 연결 예정</p>
                  </div>
                  <Lock className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)]/80 p-5 md:p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black">플랜별 기능 상태</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">현재 플랜 기준으로 사용할 수 있는 기능을 표시합니다.</p>
            </div>
            <span className="text-xs font-bold text-[var(--text-secondary)]">Free는 API 등록 후에도 일부 편의 기능이 잠깁니다.</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {FEATURE_LABELS.map((feature) => {
              const Icon = feature.icon;
              const state = plan.features[feature.key];
              return (
                <div key={feature.key} className={`rounded-2xl border p-4 transition-all ${state ? 'border-[#AC6B69]/20 bg-[#AC6B69]/[0.055]' : 'border-white/10 bg-white/[0.025]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-2xl border p-2 ${state ? 'border-[#AC6B69]/24 bg-[#AC6B69]/12 text-[#D8A4A2]' : 'border-white/10 bg-white/[0.04] text-[var(--text-secondary)]'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-black">{feature.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{feature.description}</p>
                      </div>
                    </div>
                    <FeatureBadge state={state} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
