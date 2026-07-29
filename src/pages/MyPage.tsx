import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
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
 ShieldAlert,
 ShieldCheck,
 Sparkles,
 UserCircle2,
 WandSparkles,
 XCircle,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { AppUserInfo, UserRole } from '../types';
import { normalizeClicheTermList } from '../constants/lyricClicheGuard';
import SunoApiSettingsPanel from '../components/SunoApiSettingsPanel';
import { readGeminiAutoModelFallback, writeGeminiAutoModelFallback } from '../services/geminiModelPreferences';

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
 accentClass: 'from-[#ffb400]/22 via-[#ff5f9f]/12 to-[#15151c]/70 ',
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
 accentClass: 'from-[#ff5f9f]/24 via-[#ffb400]/12 to-[#15151c]/70 ',
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
 accentClass: 'from-[#b990ff]/24 via-[#ff5f9f]/12 to-[#15151c]/70 ',
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
 accentClass: 'from-[#ffb400]/24 via-[#b990ff]/14 to-[#15151c]/70 ',
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
 const hasKey = Boolean(result && (result.hasSunoApiKey || result.hasMusicApiKey || result.registered || result.hasApiKey || result.exists));
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

type PersonalClicheDraft = {
 hardBanText: string;
 softBanText: string;
};

const EMPTY_PERSONAL_CLICHE_DRAFT: PersonalClicheDraft = {
 hardBanText: '',
 softBanText: '',
};

const parsePersonalClicheTerms = (value: string) => normalizeClicheTermList(value, 80);
const formatPersonalClicheTerms = (value: unknown) => normalizeClicheTermList(value, 80).join('\n');

function StatusPill({ active, label }: { active: boolean; label: string }) {
 return (
 <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${active ? 'bg-emerald-500/10 text-emerald-300 ' : 'bg-rose-500/10 text-rose-300 '}`}>
 {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
 {label}
 </span>
 );
}

function FeatureBadge({ state }: { state: FeatureState }) {
 if (state === true) {
 return <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-300">사용 가능</span>;
 }
 if (state === 'partial') {
 return <span className="rounded-full bg-[#ff5f9f]/12 px-2.5 py-1 text-[11px] font-black text-[#ff8fb4]">일부 가능</span>;
 }
 return <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-white/56">잠김</span>;
}

type MyPageProps = {
 onLogout: () => Promise<void> | void;
};

export default function MyPage({ onLogout }: MyPageProps) {
 const navigate = useNavigate();
 const location = useLocation();
 const [user, setUser] = useState<User | null>(auth.currentUser);
 const [profile, setProfile] = useState<AppUserInfo | null>(null);
 const [isApiRegistered, setIsApiRegistered] = useState(() => getLocalApiStatus(auth.currentUser?.uid));
 const [remainingCredits, setRemainingCredits] = useState<number | null>(() => getRemainingCredits(auth.currentUser?.uid));
 const [nicknameDraft, setNicknameDraft] = useState('');
 const [isEditingNickname, setIsEditingNickname] = useState(false);
 const [isSavingNickname, setIsSavingNickname] = useState(false);
 const [nicknameMessage, setNicknameMessage] = useState<string | null>(null);
 const [personalClicheDraft, setPersonalClicheDraft] = useState<PersonalClicheDraft>(EMPTY_PERSONAL_CLICHE_DRAFT);
 const [isSavingPersonalCliche, setIsSavingPersonalCliche] = useState(false);
 const [personalClicheMessage, setPersonalClicheMessage] = useState<string | null>(null);
 const [autoModelFallback, setAutoModelFallback] = useState(() => readGeminiAutoModelFallback(auth.currentUser?.uid));
 const [isSavingAutoModelFallback, setIsSavingAutoModelFallback] = useState(false);
 const [autoModelFallbackMessage, setAutoModelFallbackMessage] = useState<string | null>(null);

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
 if (!user?.uid || !profile) return;
 const nextValue = profile.generationPreferences?.autoModelFallback !== false;
 setAutoModelFallback(nextValue);
 writeGeminiAutoModelFallback(nextValue, user.uid);
 }, [profile, user?.uid]);

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
 const displayNickname = useMemo(() => {
 const profileAny = profile as any;
 return String(profileAny?.nickname || profileAny?.displayName || user?.displayName || user?.email?.split('@')[0] || 'SORIDRAW User').trim();
 }, [profile, user?.displayName, user?.email]);

 useEffect(() => {
 if (!user) {
 setNicknameDraft('');
 setIsEditingNickname(false);
 setNicknameMessage(null);
 return;
 }
 setNicknameDraft(displayNickname === 'SORIDRAW User' ? '' : displayNickname);
 }, [user?.uid, displayNickname]);

 useEffect(() => {
 if (!user) {
 setPersonalClicheDraft(EMPTY_PERSONAL_CLICHE_DRAFT);
 setPersonalClicheMessage(null);
 return;
 }
 const guard = (profile as any)?.lyricClicheGuard || {};
 setPersonalClicheDraft({
 hardBanText: formatPersonalClicheTerms(guard.hardBanTerms),
 softBanText: formatPersonalClicheTerms(guard.softBanTerms),
 });
 }, [user?.uid, profile?.lyricClicheGuard]);

 const handleSaveNickname = useCallback(async () => {
 if (!user?.uid || isSavingNickname) return;
 const nextNickname = nicknameDraft.trim().replace(/\s+/g, ' ');
 if (!nextNickname) {
 setNicknameMessage('닉네임을 입력해주세요.');
 return;
 }
 if (nextNickname.length > 20) {
 setNicknameMessage('닉네임은 20자 이내로 입력해주세요.');
 return;
 }

 setIsSavingNickname(true);
 setNicknameMessage(null);
 try {
 await updateDoc(doc(db, 'users', user.uid), {
 nickname: nextNickname,
 displayName: nextNickname,
 updatedAt: Date.now(),
 });
 await updateProfile(user, { displayName: nextNickname }).catch(() => {});
 setIsEditingNickname(false);
 setNicknameMessage('닉네임이 저장되었습니다.');
 } catch (error) {
 console.error('nickname update failed:', error);
 setNicknameMessage('닉네임 저장에 실패했습니다.');
 } finally {
 setIsSavingNickname(false);
 }
 }, [isSavingNickname, nicknameDraft, user]);

 const handleSavePersonalCliche = useCallback(async () => {
 if (!user?.uid || isSavingPersonalCliche) return;
 const hardBanTerms = parsePersonalClicheTerms(personalClicheDraft.hardBanText);
 const softBanTerms = parsePersonalClicheTerms(personalClicheDraft.softBanText);

 setIsSavingPersonalCliche(true);
 setPersonalClicheMessage(null);
 try {
 await updateDoc(doc(db, 'users', user.uid), {
 lyricClicheGuard: {
 hardBanTerms,
 softBanTerms,
 updatedAt: Date.now(),
 },
 updatedAt: Date.now(),
 });
 setPersonalClicheDraft({
 hardBanText: hardBanTerms.join('\n'),
 softBanText: softBanTerms.join('\n'),
 });
 setPersonalClicheMessage('개인 클리셰 설정이 저장되었습니다.');
 } catch (error) {
 console.error('personal cliche guard update failed:', error);
 setPersonalClicheMessage('개인 클리셰 설정 저장에 실패했습니다.');
 } finally {
 setIsSavingPersonalCliche(false);
 }
 }, [isSavingPersonalCliche, personalClicheDraft.hardBanText, personalClicheDraft.softBanText, user?.uid]);

 const handleToggleAutoModelFallback = useCallback(async () => {
 if (!user?.uid || isSavingAutoModelFallback) return;
 const previousValue = autoModelFallback;
 const nextValue = !previousValue;
 setAutoModelFallback(nextValue);
 setIsSavingAutoModelFallback(true);
 setAutoModelFallbackMessage(null);
 writeGeminiAutoModelFallback(nextValue, user.uid);
 try {
 await updateDoc(doc(db, 'users', user.uid), {
 'generationPreferences.autoModelFallback': nextValue,
 updatedAt: Date.now(),
 });
 setAutoModelFallbackMessage(nextValue
 ? '한도 초과 시 대체 Gemini 모델로 자동 전환합니다.'
 : '기본 Gemini 모델만 사용합니다.');
 } catch (error) {
 console.error('Gemini auto model fallback preference update failed:', error);
 setAutoModelFallback(previousValue);
 writeGeminiAutoModelFallback(previousValue, user.uid);
 setAutoModelFallbackMessage('자동 전환 설정 저장에 실패했습니다.');
 } finally {
 setIsSavingAutoModelFallback(false);
 }
 }, [autoModelFallback, isSavingAutoModelFallback, user?.uid]);

 const handleLogout = useCallback(async () => {
 await onLogout();
 }, [onLogout]);

 if (!user) {
 return (
 <div className="min-h-screen bg-[#09090d] px-4 pt-20 pb-16 text-[var(--text-primary)]">
 <div className="mx-auto max-w-xl rounded-3xl bg-[var(--bg-secondary)] p-8 text-center shadow-2xl">
 <UserCircle2 className="mx-auto mb-4 h-10 w-10 text-[#ff8fb4]" />
 <h1 className="text-2xl font-black">로그인이 필요합니다</h1>
 <p className="mt-2 text-sm text-white/56">마이페이지는 로그인 후 사용할 수 있습니다.</p>
 <button onClick={() => navigate('/')} className="mt-6 rounded-2xl bg-[#ff5f9f]/12 px-5 py-3 text-sm font-black text-[#ff8fb4] hover:bg-[#ff5f9f]/20 transition-all">
 홈으로 돌아가기
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-[#09090d] px-4 md:px-6 pt-20 pb-16 text-[var(--text-primary)]">
 <div className="mx-auto w-full max-w-[1500px] space-y-7">
 <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <button
 onClick={() => navigate('/')}
 className="inline-flex items-center gap-2 rounded-2xl bg-[#15151c]/88 px-4 py-2.5 text-sm font-black text-white/56 hover:bg-[var(--hover-bg)] transition-all"
 >
 <ArrowLeft className="w-4 h-4" /> 홈
 </button>
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 className="inline-flex items-center gap-2 rounded-2xl bg-[#b990ff]/12 px-4 py-2.5 text-sm font-black text-[#c9a6ff] opacity-80 cursor-not-allowed"
 title="플랜/구독 페이지는 다음 단계에서 연결합니다."
 >
 <Crown className="w-4 h-4" /> 플랜 업그레이드 준비중
 </button>
 </div>
 </div>

 <div>
 <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ff5f9f]/80">MY STUDIO</p>
 <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">마이페이지</h1>
 <p className="mt-2 text-sm text-white/56 leading-relaxed">
 개인 API 연결 관리, 현재 플랜, 사용량과 잠긴 기능을 한눈에 확인합니다.
 </p>
 </div>
 </motion.div>

 <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
 <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-3xl bg-[#15151c]/88 p-5 md:p-6 shadow-2xl backdrop-blur-xl">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-center gap-4 min-w-0">
 <img src={user.photoURL || 'https://picsum.photos/seed/soridraw-user/160/160'} alt="profile" referrerPolicy="no-referrer" className="h-16 w-16 rounded-3xl object-cover shadow-xl" />
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 {isEditingNickname ? (
 <>
 <input
 value={nicknameDraft}
 onChange={(event) => setNicknameDraft(event.target.value)}
 maxLength={20}
 className="h-9 min-w-[180px] rounded-xl bg-black/20 px-3 text-sm font-black text-white outline-none transition-all placeholder:text-white/25 "
 placeholder="닉네임 입력"
 />
 <div className="flex flex-col items-start gap-1">
 <p className="text-[10px] font-bold leading-none text-[#ff8fb4]/80">14일 동안 변경을 할 수 없습니다.</p>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={handleSaveNickname}
 disabled={isSavingNickname}
 className="rounded-xl bg-[#ff8fb4] px-3 py-2 text-xs font-black text-[#211615] transition-all hover:brightness-110 disabled:opacity-60"
 >
 저장
 </button>
 <button
 type="button"
 onClick={() => {
 setIsEditingNickname(false);
 setNicknameDraft(displayNickname === 'SORIDRAW User' ? '' : displayNickname);
 setNicknameMessage(null);
 }}
 disabled={isSavingNickname}
 className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-black text-white/70 transition-all hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
 >
 취소
 </button>
 </div>
 </div>
 </>
 ) : (
 <>
 <h2 className="truncate text-xl font-black">{displayNickname}</h2>
 <button
 type="button"
 onClick={() => {
 setNicknameDraft(displayNickname === 'SORIDRAW User' ? '' : displayNickname);
 setIsEditingNickname(true);
 setNicknameMessage(null);
 }}
 className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-[#ff8fb4] transition-all hover:bg-[#ff5f9f]/12"
 >
 닉네임 변경
 </button>
 </>
 )}
 </div>
 <p className="truncate text-sm text-white/56">{user.email || profile?.email || '-'}</p>
 <p className="mt-1 text-xs text-white/56">가입일 {formatDate(profile?.createdAt)}</p>
 {nicknameMessage && <p className="mt-1 text-xs font-bold text-[#ff8fb4]">{nicknameMessage}</p>}
 </div>
 </div>
 <button onClick={handleLogout} className="shrink-0 rounded-2xl bg-white/[0.04] p-3 text-white/56 hover:bg-rose-500/10 hover:text-rose-300 transition-all" title="로그아웃">
 <LogOut className="w-5 h-5" />
 </button>
 </div>

 <div className="mt-6 grid gap-3 sm:grid-cols-3">
 <div className="rounded-2xl bg-white/[0.03] p-4">
 <p className="text-xs font-bold text-white/56">전체 생성</p>
 <p className="mt-2 text-2xl font-black">{generatedCount.toLocaleString()}</p>
 </div>
 <div className="rounded-2xl bg-white/[0.03] p-4">
 <p className="text-xs font-bold text-white/56">보관함</p>
 <p className="mt-2 text-2xl font-black">{favoriteCount.toLocaleString()}</p>
 </div>
 <div className="rounded-2xl bg-white/[0.03] p-4">
 <p className="text-xs font-bold text-white/56">생성 제한</p>
 <p className="mt-2 text-lg font-black text-[#ff8fb4]">{dailyLimitText}</p>
 </div>
 </div>
 </motion.section>

 <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`rounded-3xl bg-gradient-to-br ${plan.accentClass} p-5 md:p-6 shadow-2xl`}>
 <div className="flex items-start justify-between gap-4">
 <div>
 <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-black">
 <ShieldCheck className="w-3.5 h-3.5" /> {plan.badge}
 </div>
 <h2 className="mt-4 text-3xl font-black">{plan.label}</h2>
 <p className="mt-2 text-sm text-white/56 leading-relaxed">{plan.description}</p>
 </div>
 <Crown className="h-10 w-10 opacity-80" />
 </div>
 <div className="mt-6 grid gap-3">
 <div className="flex items-center justify-between rounded-2xl bg-black/10 p-4">
 <span className="text-sm font-bold text-white/56">구독 상태</span>
 <span className="text-sm font-black">{profile?.paymentStatus === 'active' ? '활성' : '미연결'}</span>
 </div>
 <div className="flex items-center justify-between rounded-2xl bg-black/10 p-4">
 <span className="text-sm font-bold text-white/56">만료/갱신일</span>
 <span className="text-sm font-black">{formatDate(profile?.planExpireAt || profile?.nextBillingAt)}</span>
 </div>
 </div>
 </motion.section>
 </div>

 <motion.section
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.16 }}
 className="rounded-3xl bg-[#15151c]/88 p-5 md:p-6 shadow-2xl backdrop-blur-xl"
 >
 <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
 <div className="max-w-3xl">
 <div className="flex items-center gap-2">
 <WandSparkles className="h-5 w-5 text-zinc-300" />
 <h2 className="text-lg font-black text-white">개인 설정</h2>
 </div>
 <h3 className="mt-4 text-sm font-black text-zinc-100">생성 모델 자동 전환</h3>
 <p className="mt-1 text-sm leading-relaxed text-white/56">
 기본 Gemini 모델이 명확한 요청 한도 초과 또는 일시 사용 불가 상태일 때만 대체 Gemini 모델로 전환합니다.
 정상 생성, 느린 응답, 가사 품질이나 형식 문제로는 전환하지 않습니다.
 </p>
 {autoModelFallbackMessage && (
 <p className="mt-2 text-xs font-bold text-zinc-400">{autoModelFallbackMessage}</p>
 )}
 </div>
 <button
 type="button"
 role="switch"
 aria-checked={autoModelFallback}
 aria-label="생성 모델 자동 전환"
 onClick={handleToggleAutoModelFallback}
 disabled={isSavingAutoModelFallback}
 className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${autoModelFallback ? 'bg-zinc-100' : 'bg-white/[0.10]'}`}
 >
 <span
 className={`h-6 w-6 rounded-full shadow-sm transition-transform ${autoModelFallback ? 'translate-x-6 bg-zinc-950' : 'translate-x-0 bg-zinc-300'}`}
 />
 </button>
 </div>
 </motion.section>

 <div className="grid gap-5 lg:grid-cols-2 items-start">
 <div id="music-api-credit-section" className="scroll-mt-24">
 <SunoApiSettingsPanel className="h-full bg-gradient-to-br from-[#24191f]/95 via-[#191824]/95 to-[#161922]/95" />
 </div>

 <motion.section
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 className="h-full rounded-[28px] bg-gradient-to-br from-[#25151f]/95 via-[#181622]/95 to-[#1f1a10]/95 p-5 md:p-6 shadow-2xl backdrop-blur-xl"
 >
 <div className="flex items-start gap-3">
 <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff4f8b]/28 to-[#ffb400]/22 text-[#ffd166] shadow-lg shadow-[#ff4f8b]/10">
 <ShieldAlert className="h-5 w-5" />
 </div>
 <div>
 <h2 className="text-lg font-black text-white">개인 클리셰 관리</h2>
 <p className="mt-1 text-sm leading-relaxed text-white/58">
 나만 피하고 싶은 단어를 한 줄에 하나씩 입력합니다. 관리자 전체 설정 위에 추가 적용됩니다.
 </p>
 </div>
 </div>

 <div className="mt-5 grid gap-4 md:grid-cols-2">
 <label className="block">
 <span className="text-xs font-black text-[#ff8fb4]">HardBan · 나만 강하게 피하기</span>
 <textarea
 value={personalClicheDraft.hardBanText}
 onChange={(event) => setPersonalClicheDraft((prev) => ({ ...prev, hardBanText: event.target.value }))}
 disabled={isSavingPersonalCliche}
 placeholder={"너라는 우주\n심장이 기억해"}
 className="mt-2 h-64 w-full resize-y rounded-[22px] bg-black/24 px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/22 focus:ring-2 focus:ring-[#ff4f8b]/35 disabled:opacity-60"
 />
 </label>
 <label className="block">
 <span className="text-xs font-black text-[#c9a6ff]">SoftBan · 나만 조건부 회피</span>
 <textarea
 value={personalClicheDraft.softBanText}
 onChange={(event) => setPersonalClicheDraft((prev) => ({ ...prev, softBanText: event.target.value }))}
 disabled={isSavingPersonalCliche}
 placeholder={"비\n창문\n거리"}
 className="mt-2 h-64 w-full resize-y rounded-[22px] bg-black/24 px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/22 focus:ring-2 focus:ring-[#b990ff]/35 disabled:opacity-60"
 />
 </label>
 </div>

 <div className="mt-5 rounded-[22px] bg-white/[0.045] p-4">
 <p className="text-xs leading-relaxed text-white/55">
 HardBan은 거의 금지, SoftBan은 내가 직접 주제로 고르면 허용됩니다.
 </p>
 </div>

 <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 {personalClicheMessage ? (
 <p className="text-xs font-bold text-[#ffd166]">{personalClicheMessage}</p>
 ) : (
 <p className="text-xs text-white/40">저장 후 다음 생성부터 적용됩니다.</p>
 )}
 <button
 type="button"
 onClick={handleSavePersonalCliche}
 disabled={isSavingPersonalCliche}
 className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#ffb400] to-[#ff5f9f] px-5 py-3 text-sm font-black text-[#1d1216] shadow-lg shadow-[#ff5f9f]/20 transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
 >
 {isSavingPersonalCliche ? '저장중...' : '개인 클리셰 저장'}
 </button>
 </div>
 </motion.section>
 </div>

 <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-3xl bg-[#15151c]/88 p-5 md:p-6 shadow-2xl backdrop-blur-xl">
 <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
 <div>
 <h2 className="text-lg font-black">플랜별 기능 상태</h2>
 <p className="mt-1 text-sm text-white/56">현재 플랜 기준으로 사용할 수 있는 기능을 표시합니다.</p>
 </div>
 <span className="text-xs font-bold text-white/56">Free는 API 등록 후에도 일부 편의 기능이 잠깁니다.</span>
 </div>
 <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 {FEATURE_LABELS.map((feature) => {
 const Icon = feature.icon;
 const state = plan.features[feature.key];
 return (
 <div key={feature.key} className={`rounded-2xl p-4 transition-all ${state ? ' bg-[#ff5f9f]/[0.055]' : ' bg-white/[0.025]'}`}>
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-start gap-3">
 <div className={`rounded-2xl p-2 ${state ? ' bg-[#ff5f9f]/12 text-[#ff8fb4]' : ' bg-white/[0.04] text-white/56'}`}>
 <Icon className="w-4 h-4" />
 </div>
 <div>
 <p className="text-sm font-black">{feature.label}</p>
 <p className="mt-1 text-xs leading-relaxed text-white/56">{feature.description}</p>
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
