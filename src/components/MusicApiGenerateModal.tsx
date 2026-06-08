import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ChevronLeft, Key, Languages, Music, X, ListMusic, Mic2 } from 'lucide-react';

declare global {
  interface Window {
    __soridrawMusicApiSunoModelVersion?: 'V5_5' | 'V5' | 'V4_5';
  }
}

export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr';
export type SunoModelVersion = 'V5_5' | 'V5' | 'V4_5';

type ModalVariant = 'main' | 'musicApi';
type MusicApiTargetMode = 'current' | 'batch';

export type MusicApiTargetOption = {
  id: string;
  label: string;
  subLabel?: string;
  availableLyricLanguages: LanguageCode[];
};

type MusicApiGenerateModalProps = {
  hasApiKey?: boolean;
  isNoLyrics?: boolean;
  variant?: ModalVariant;
  availableLyricLanguages?: LanguageCode[];
  maxLyricLanguages?: number;
  musicApiTargets?: MusicApiTargetOption[];
  remainingCredits?: number | null;
  onClose: () => void;
  onConfirm: (
    titleLanguage: LanguageCode,
    includeLyrics: boolean,
    lyricLanguages: LanguageCode[],
    generationCount: number,
    options?: {
      targetMode?: MusicApiTargetMode;
      perTargetLyricLanguages?: Record<string, LanguageCode>;
      isKoreanEnglishMix?: boolean;
      englishMixRatio?: number;
      rapEnabled?: boolean;
      sunoModelVersion?: SunoModelVersion;
    }
  ) => void;
  isKoreanEnglishMix?: boolean;
  englishMixRatio?: number;
  rapEnabled?: boolean;
  onPreview?: (options: {
    includeLyrics: boolean;
    lyricLanguages: LanguageCode[];
    generationCount: number;
    isKoreanEnglishMix?: boolean;
    englishMixRatio?: number;
    rapEnabled?: boolean;
  }) => void;
  suspendHistoryHandling?: boolean;
};

const LANGUAGE_OPTIONS: { id: LanguageCode; label: string; subLabel: string; short: string }[] = [
  { id: 'ko', label: '한글 가사', subLabel: 'Korean lyrics', short: '한글' },
  { id: 'en', label: '영어 가사', subLabel: 'English lyrics', short: '영어' },
  { id: 'ja', label: '일본어 가사', subLabel: 'Japanese lyrics', short: '일본어' },
  { id: 'zh', label: '중국어 가사', subLabel: 'Chinese lyrics', short: '중국어' },
  { id: 'es', label: '스페인어 가사', subLabel: 'Spanish lyrics', short: '스페인어' },
  { id: 'fr', label: '프랑스어 가사', subLabel: 'French lyrics', short: '프랑스어' },
];

const getLanguageMeta = (id: LanguageCode) => LANGUAGE_OPTIONS.find((item) => item.id === id) || LANGUAGE_OPTIONS[0];

const SUNO_MODEL_OPTIONS: { id: SunoModelVersion; label: string; subLabel: string }[] = [
  { id: 'V5_5', label: 'v5.5', subLabel: '최신 기본' },
  { id: 'V5', label: 'v5', subLabel: '빠른 표현' },
  { id: 'V4_5', label: 'v4.5', subLabel: '안정 비교' },
];

const SUNO_MODEL_STORAGE_KEY = 'soridraw.musicApi.sunoModelVersion';

const isSunoModelVersion = (value: unknown): value is SunoModelVersion =>
  typeof value === 'string' && SUNO_MODEL_OPTIONS.some((item) => item.id === value);

const readStoredSunoModelVersion = (): SunoModelVersion => {
  if (typeof window === 'undefined') return 'V5_5';

  // 1) localStorage is the persisted source.
  try {
    const stored = window.localStorage.getItem(SUNO_MODEL_STORAGE_KEY);
    if (isSunoModelVersion(stored)) return stored;
  } catch {
    // Some embedded browsers can block localStorage. Fallback below keeps the value during the current session.
  }

  // 2) Runtime fallback: survives modal close/reopen while the page is alive.
  const runtimeStored = window.__soridrawMusicApiSunoModelVersion;
  return isSunoModelVersion(runtimeStored) ? runtimeStored : 'V5_5';
};

const writeStoredSunoModelVersion = (value: SunoModelVersion) => {
  if (typeof window === 'undefined') return;

  // Always keep an in-memory copy first so close/reopen works even if storage is blocked.
  window.__soridrawMusicApiSunoModelVersion = value;

  try {
    window.localStorage.setItem(SUNO_MODEL_STORAGE_KEY, value);
  } catch {
    // Ignore blocked storage. The runtime copy above still keeps the selected version while the page is open.
  }
};

const getSunoModelMeta = (id: SunoModelVersion) => SUNO_MODEL_OPTIONS.find((item) => item.id === id) || SUNO_MODEL_OPTIONS[0];

export default function MusicApiGenerateModal({
  hasApiKey = true,
  isNoLyrics = false,
  variant = 'musicApi',
  availableLyricLanguages,
  maxLyricLanguages,
  musicApiTargets = [],
  remainingCredits = null,
  onClose,
  onConfirm,
  isKoreanEnglishMix = false,
  englishMixRatio = 10,
  rapEnabled = false,
  onPreview,
  suspendHistoryHandling = false,
}: MusicApiGenerateModalProps) {
  const isMain = variant === 'main';
  const maxCount = maxLyricLanguages ?? (isMain ? 2 : 1);
  const accent = isMain ? 'orange' : 'purple';
  const accentText = isMain ? 'text-[#E7AD68]' : 'text-purple-300';
  const accentBg = isMain
    ? 'bg-[#E7AD68] hover:bg-[#ECB976] !text-[#111111] shadow-[0_12px_28px_rgba(231,173,104,0.22)] hover:shadow-[0_16px_34px_rgba(231,173,104,0.28)]'
    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30';
  const accentSelected = isMain
    ? 'border-transparent bg-[#E7AD68] !text-[#111111] shadow-[0_10px_24px_rgba(231,173,104,0.20)]'
    : 'border-purple-400/60 bg-purple-500/20 text-purple-100';
  const accentIcon = isMain
    ? 'bg-white/[0.055] border-transparent text-[#E7AD68]'
    : 'bg-purple-600/25 border-purple-400/30 text-purple-200';
  const modalSurface = isMain
    ? 'bg-[var(--card-bg)] shadow-[0_24px_70px_rgba(0,0,0,0.58)]'
    : 'bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl';
  const panelSurface = isMain
    ? 'rounded-2xl bg-white/[0.035] overflow-hidden'
    : 'rounded-2xl border border-[var(--border-color)] bg-white/5 overflow-hidden';
  const plainPanelSurface = isMain
    ? 'rounded-2xl bg-white/[0.035] p-3 sm:p-4'
    : 'rounded-2xl border border-[var(--border-color)] bg-white/5 p-3 sm:p-4';
  const optionRest = isMain
    ? 'border-transparent bg-white/[0.055] text-[var(--text-secondary)] hover:bg-white/[0.08]'
    : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5';
  const optionRestLight = isMain
    ? 'border-transparent bg-white/[0.055] text-[var(--text-secondary)] hover:bg-white/[0.08]'
    : 'border-[var(--border-color)] bg-white/5 text-[var(--text-secondary)] hover:bg-white/10';
  const dividerClass = isMain ? 'border-white/[0.06]' : 'border-[var(--border-color)]';

  const filteredLanguages = useMemo(() => {
    const source = availableLyricLanguages && availableLyricLanguages.length > 0
      ? availableLyricLanguages
      : (LANGUAGE_OPTIONS.map((item) => item.id) as LanguageCode[]);
    const unique = Array.from(new Set(source));
    return LANGUAGE_OPTIONS.filter((item) => unique.includes(item.id));
  }, [availableLyricLanguages]);

  const initialLangs = useMemo(() => {
    if (isNoLyrics) return [] as LanguageCode[];
    if (filteredLanguages.some((item) => item.id === 'ko')) return ['ko'] as LanguageCode[];
    return filteredLanguages[0] ? [filteredLanguages[0].id] : ([] as LanguageCode[]);
  }, [filteredLanguages, isNoLyrics]);

  const [step, setStep] = useState<1 | 2>(1);
  const stepRef = useRef<1 | 2>(1);
  const backInputGuardUntilRef = useRef(0);
  const suspendHistoryHandlingRef = useRef(suspendHistoryHandling);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    suspendHistoryHandlingRef.current = suspendHistoryHandling;
  }, [suspendHistoryHandling]);

  const startBackInputGuard = (duration = 600) => {
    backInputGuardUntilRef.current = Date.now() + duration;
  };

  const isBackInputGuardActive = () => Date.now() < backInputGuardUntilRef.current;

  const makeModalHistoryState = (nextStep: 1 | 2) => ({
    __soridrawGenerateModal: true,
    step: nextStep,
  });

  const setModalStep = (
    nextStep: 1 | 2,
    options?: { pushHistory?: boolean; replaceHistory?: boolean }
  ) => {
    stepRef.current = nextStep;
    setStep(nextStep);

    if (typeof window !== 'undefined') {
      const state = makeModalHistoryState(nextStep);
      if (options?.pushHistory) {
        window.history.pushState(state, '', window.location.href);
      } else if (options?.replaceHistory) {
        window.history.replaceState(state, '', window.location.href);
      }
    }
  };
  const [includeLyrics, setIncludeLyrics] = useState<boolean>(() => !isNoLyrics);
  const [lyricLanguages, setLyricLanguages] = useState<LanguageCode[]>(initialLangs);
  const [generationCount, setGenerationCount] = useState<number>(1);
  const [localKoreanEnglishMix, setLocalKoreanEnglishMix] = useState<boolean>(() => Boolean(isKoreanEnglishMix));
  const [localEnglishMixRatio, setLocalEnglishMixRatio] = useState<number>(() => Math.max(5, Math.min(90, Number(englishMixRatio) || 10)));
  const [localRapEnabled, setLocalRapEnabled] = useState<boolean>(() => Boolean(rapEnabled));
  const [showMoreLanguages, setShowMoreLanguages] = useState(false);
  const [sunoModelVersion, setSunoModelVersion] = useState<SunoModelVersion>(() => (isMain ? 'V5_5' : readStoredSunoModelVersion()));
  const [isSunoModelOpen, setIsSunoModelOpen] = useState(false);

  useEffect(() => {
    if (isMain) return;
    setSunoModelVersion(readStoredSunoModelVersion());
  }, [isMain]);
  const primaryLanguageIds: LanguageCode[] = ['ko', 'en'];
  const primaryLanguages = filteredLanguages.filter((item) => primaryLanguageIds.includes(item.id));
  const hiddenLanguages = filteredLanguages.filter((item) => !primaryLanguageIds.includes(item.id));
  const visibleLanguages = showMoreLanguages || primaryLanguages.length === 0
    ? filteredLanguages
    : primaryLanguages;
  const canUseBatchTargets = !isMain && musicApiTargets.length > 1;
  const [targetMode, setTargetMode] = useState<MusicApiTargetMode>('current');
  const [perTargetLyricLanguages, setPerTargetLyricLanguages] = useState<Record<string, LanguageCode>>({});

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const handleModalBack = () => {
    if (stepRef.current === 2) {
      startBackInputGuard();
      setModalStep(1, { replaceHistory: true });
      return;
    }

    if (isBackInputGuardActive()) return;
    onCloseRef.current();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.history.pushState(makeModalHistoryState(1), '', window.location.href);

    const onPopState = (event: PopStateEvent) => {
      // 곡 미리보기 팝업이 위에 떠 있을 때는 App.tsx의 미리보기 핸들러가
      // 뒤로가기를 먼저 처리해야 한다. 여기서 잡으면 미리보기 대신 생성옵션이 닫힌다.
      if (suspendHistoryHandlingRef.current) return;

      // 생성옵션 모달이 열려 있을 때는 전역 앱 뒤로가기/종료 핸들러로
      // 이벤트가 넘어가지 않게 이 모달이 먼저 소비한다.
      event.stopPropagation();
      event.stopImmediatePropagation();
      const state = event.state as { __soridrawGenerateModal?: boolean; step?: 1 | 2 } | null;

      // 마우스 뒤로가기 버튼은 pointerdown/mousedown/mouseup/auxclick 등이
      // 한 번의 입력에서 연속으로 발생할 수 있다. 2단계에서 1단계로 이동한 직후
      // 같은 입력이 popstate까지 이어져 창 닫기로 중복 처리되지 않게 막는다.
      if (isBackInputGuardActive()) {
        if (state?.__soridrawGenerateModal && state.step === 1) {
          setModalStep(1);
        }
        return;
      }

      // 마우스 뒤로가기/브라우저 뒤로가기로 2단계에서 1단계 히스토리로 돌아온 경우
      // 창을 닫지 않고 이전 단계만 보여준다.
      if (state?.__soridrawGenerateModal && state.step === 1) {
        setModalStep(1);
        return;
      }

      if (stepRef.current === 2) {
        startBackInputGuard();
        setModalStep(1, { replaceHistory: true });
        return;
      }

      onCloseRef.current();
    };

    const onMouseBackButton = (event: MouseEvent) => {
      if (event.button !== 3) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (isBackInputGuardActive()) return;
      handleModalBack();
    };

    window.addEventListener('popstate', onPopState, true);
    window.addEventListener('pointerdown', onMouseBackButton, true);
    window.addEventListener('mousedown', onMouseBackButton, true);
    window.addEventListener('mouseup', onMouseBackButton, true);
    window.addEventListener('auxclick', onMouseBackButton, true);

    return () => {
      window.removeEventListener('popstate', onPopState, true);
      window.removeEventListener('pointerdown', onMouseBackButton, true);
      window.removeEventListener('mousedown', onMouseBackButton, true);
      window.removeEventListener('mouseup', onMouseBackButton, true);
      window.removeEventListener('auxclick', onMouseBackButton, true);
    };
  }, []);

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    if (!isMain) return;
    setLocalKoreanEnglishMix(Boolean(isKoreanEnglishMix));
    setLocalEnglishMixRatio(Math.max(5, Math.min(90, Number(englishMixRatio) || 10)));
    setLocalRapEnabled(Boolean(rapEnabled));
  }, [englishMixRatio, isKoreanEnglishMix, isMain, rapEnabled]);

  useEffect(() => {
    if (!includeLyrics) setShowMoreLanguages(false);
  }, [includeLyrics]);

  useEffect(() => {
    if (!includeLyrics) return;
    setLyricLanguages((prev) => {
      const availableIds = filteredLanguages.map((item) => item.id);
      const next = prev.filter((lang) => availableIds.includes(lang)).slice(0, maxCount);
      if (next.length > 0) return next;
      return initialLangs.slice(0, maxCount);
    });
  }, [filteredLanguages, includeLyrics, initialLangs, maxCount]);

  useEffect(() => {
    if (isMain || !includeLyrics || targetMode !== 'batch') return;
    setPerTargetLyricLanguages((prev) => {
      const next: Record<string, LanguageCode> = {};
      musicApiTargets.forEach((target) => {
        const available = target.availableLyricLanguages || [];
        if (available.length === 0) return;
        next[target.id] = available.includes(prev[target.id]) ? prev[target.id] : available[0];
      });
      return next;
    });
  }, [includeLyrics, isMain, musicApiTargets, targetMode]);

  const selectedLyricLabel = useMemo(() => {
    if (!includeLyrics) return '가사 미포함';
    if (!isMain && targetMode === 'batch') return `곡별 언어 선택 (${musicApiTargets.length}곡)`;
    return lyricLanguages
      .map((lang) => getLanguageMeta(lang).label)
      .filter(Boolean)
      .join(' + ');
  }, [includeLyrics, isMain, lyricLanguages, musicApiTargets.length, targetMode]);

  const toggleLyricLanguage = (lang: LanguageCode) => {
    setLyricLanguages((prev) => {
      // Music API mode uses radio-style single selection: click another language to switch.
      if (maxCount === 1) return [lang];

      if (prev.includes(lang)) {
        const next = prev.filter((item) => item !== lang);
        return next.length > 0 ? next : prev;
      }
      if (prev.length >= maxCount) return prev;
      return [...prev, lang];
    });
  };

  const handleNext = () => {
    if (!hasApiKey) return;
    if (includeLyrics && targetMode === 'batch' && !isMain) {
      const allSelected = musicApiTargets.every((target) => !target.availableLyricLanguages?.length || perTargetLyricLanguages[target.id]);
      if (!allSelected) return;
    } else if (includeLyrics && lyricLanguages.length === 0) {
      return;
    }
    setModalStep(2, { pushHistory: true });
  };

  const handleConfirm = () => {
    if (!hasApiKey) return;
    const langs = includeLyrics ? lyricLanguages.slice(0, maxCount) : [];
    const titleLanguage = langs.find((lang) => lang !== 'ko') || langs[0] || 'ko';
    onConfirm(titleLanguage, includeLyrics, langs, isMain ? generationCount : 1, {
      targetMode: isMain ? 'current' : targetMode,
      perTargetLyricLanguages: includeLyrics && targetMode === 'batch' && !isMain ? perTargetLyricLanguages : undefined,
      isKoreanEnglishMix: isMain && includeLyrics ? localKoreanEnglishMix : undefined,
      englishMixRatio: isMain && includeLyrics ? localEnglishMixRatio : undefined,
      rapEnabled: isMain && includeLyrics ? localRapEnabled : undefined,
      sunoModelVersion: !isMain ? sunoModelVersion : undefined,
    });
  };

  const subtitle = isMain
    ? (step === 1 ? '가사 포함 여부와 생성할 가사 언어를 선택합니다.' : '선택한 설정으로 곡 생성을 시작합니다.')
    : (step === 1 ? 'Music API로 보낼 대상과 가사를 선택합니다.' : '선택한 설정으로 생성을 요청합니다.');
  const mixRatioOptions = [5, 10, 20, 30, 50, 70, 90];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/25 backdrop-blur-sm px-3 sm:px-4 py-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        className={`w-full max-w-md max-h-[calc(100dvh-32px)] rounded-[28px] overflow-hidden flex flex-col ${modalSurface}`}
        onMouseDown={(event) => {
          event.stopPropagation();
          if (event.button === 3) {
            event.preventDefault();
            handleModalBack();
          }
        }}
        onAuxClick={(event) => {
          if (event.button === 3) {
            event.preventDefault();
            event.stopPropagation();
            handleModalBack();
          }
        }}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0 px-5 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleModalBack();
            }}
            className="absolute left-5 top-5 p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
            title={step === 2 ? '이전 단계' : '닫기'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          {!isMain && typeof remainingCredits === 'number' && (
            <div className="absolute left-14 top-5 h-8 px-2.5 rounded-full border border-purple-400/25 bg-purple-500/10 text-[10px] font-black text-purple-200 flex items-center gap-1.5" title="남은 크레딧">
              <Key className="w-3 h-3 text-purple-300" />
              <span>남은 크레딧 {remainingCredits.toLocaleString()}</span>
            </div>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
            className="absolute right-5 top-5 p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>

          {!isMain && (
            <div className="absolute right-14 top-5 z-20">
              <button
                type="button"
                onClick={() => setIsSunoModelOpen((prev) => !prev)}
                className={`h-8 px-2.5 rounded-full border text-[11px] font-black flex items-center gap-1 transition-all ${accentSelected}`}
                title="Suno 버전 선택"
              >
                {getSunoModelMeta(sunoModelVersion).label}
                <ChevronDown className={`w-3 h-3 transition-transform ${isSunoModelOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isSunoModelOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    className="absolute right-0 mt-2 w-28 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xl overflow-hidden"
                  >
                    {SUNO_MODEL_OPTIONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          writeStoredSunoModelVersion(item.id);
                          setSunoModelVersion(item.id);
                          setIsSunoModelOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left transition-all ${sunoModelVersion === item.id ? accentSelected : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                      >
                        <span className="block text-xs font-black">{item.label}</span>
                        <span className="block text-[9px] opacity-70">{item.subLabel}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex flex-col items-center text-center pt-4">
            <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center mb-3 sm:mb-5 ${accentIcon}`}>
              {step === 1 ? <Music className="w-5 h-5 sm:w-7 sm:h-7" /> : <Check className="w-5 h-5 sm:w-7 sm:h-7" />}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] mb-1.5 sm:mb-2">
              {step === 1 ? '생성 옵션 선택' : '생성 준비 완료'}
            </h2>
            <p className={`text-xs sm:text-sm font-semibold ${accentText} opacity-90`}>{subtitle}</p>
          </div>
        </div>

        {!hasApiKey && (
          <div className="mx-6 mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex gap-3 text-sm text-red-200">
            <Key className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-black mb-1">Music API 키가 필요합니다.</p>
              <p className="text-xs opacity-80">설정 페이지에서 API 키를 먼저 등록해주세요.</p>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-5 sm:pb-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-3 sm:space-y-4"
              >
                <div className={panelSurface}>
                  {!isMain && canUseBatchTargets && (
                    <div className={`p-3 sm:p-4 border-b ${dividerClass}`}>
                      <p className="text-xs font-black text-[var(--text-secondary)] mb-3">생성 대상</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTargetMode('current')}
                          className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all ${
                            targetMode === 'current'
                              ? accentSelected
                              : optionRest
                          }`}
                        >
                          <p className="text-sm font-black">현재 곡만</p>
                          <p className="text-[10px] opacity-70 mt-0.5">보고 있는 곡 1개</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetMode('batch')}
                          className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all ${
                            targetMode === 'batch'
                              ? accentSelected
                              : optionRest
                          }`}
                        >
                          <p className="text-sm font-black">최근 생성 묶음 전체</p>
                          <p className="text-[10px] opacity-70 mt-0.5">각 곡을 따로 전송</p>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`p-3 sm:p-4 border-b ${dividerClass}`}>
                    <p className="text-xs font-black text-[var(--text-secondary)] mb-3">가사 포함 여부</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIncludeLyrics(true)}
                        className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all ${
                          includeLyrics
                            ? accentSelected
                            : optionRest
                        }`}
                      >
                        <p className="text-sm font-black">가사 포함</p>
                        <p className="text-[10px] opacity-70 mt-0.5">선택한 언어 가사 생성</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncludeLyrics(false)}
                        className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all ${
                          !includeLyrics
                            ? accentSelected
                            : optionRest
                        }`}
                      >
                        <p className="text-sm font-black">가사 미포함</p>
                        <p className="text-[10px] opacity-70 mt-0.5">프롬프트만 생성</p>
                      </button>
                    </div>
                  </div>

                  {includeLyrics && (
                    <div className="p-3 sm:p-4">
                      {targetMode === 'batch' && !isMain ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-black text-[var(--text-secondary)]">곡별 가사/제목 언어</p>
                            <p className={`text-[10px] font-bold ${accentText}`}>각 곡 1개</p>
                          </div>
                          {musicApiTargets.map((target, idx) => (
                            <div key={target.id} className={`rounded-xl p-3 ${isMain ? 'bg-white/[0.055]' : 'border border-[var(--border-color)] bg-black/10'}`}>
                              <p className="text-xs font-black text-[var(--text-primary)] truncate">{idx + 1}. {target.label}</p>
                              {target.subLabel && <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{target.subLabel}</p>}
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {(target.availableLyricLanguages || []).map((lang) => {
                                  const meta = getLanguageMeta(lang);
                                  const selected = perTargetLyricLanguages[target.id] === lang;
                                  return (
                                    <button
                                      key={`${target.id}-${lang}`}
                                      type="button"
                                      onClick={() => setPerTargetLyricLanguages((prev) => ({ ...prev, [target.id]: lang }))}
                                      className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
                                        selected
                                          ? accentSelected
                                          : optionRest
                                      }`}
                                    >
                                      <p className="text-xs font-black flex items-center gap-1.5">
                                        {selected && <Check className="w-3.5 h-3.5" />}
                                        {meta.short}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-black text-[var(--text-secondary)]">가사/제목 언어</p>
                            <p className={`text-[10px] font-bold ${accentText}`}>최대 {maxCount}개</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(hiddenLanguages.length > 0 ? primaryLanguages : filteredLanguages).map((item) => {
                              const selected = lyricLanguages.includes(item.id);
                              const disabled = maxCount > 1 && !selected && lyricLanguages.length >= maxCount;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => toggleLyricLanguage(item.id)}
                                  className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                    selected
                                      ? accentSelected
                                      : optionRest
                                  }`}
                                >
                                  <p className="text-sm font-black flex items-center gap-1.5">
                                    {selected && <Check className="w-3.5 h-3.5" />}
                                    {item.label}
                                  </p>
                                  <p className="text-[10px] opacity-70 mt-0.5">제목도 {item.short} 기준</p>
                                </button>
                              );
                            })}
                          </div>
                          <AnimatePresence initial={false}>
                            {showMoreLanguages && hiddenLanguages.length > 0 && (
                              <motion.div
                                key="more-languages"
                                initial={{ height: 0, opacity: 0, y: -4 }}
                                animate={{ height: 'auto', opacity: 1, y: 0 }}
                                exit={{ height: 0, opacity: 0, y: -4 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                  {hiddenLanguages.map((item) => {
                                    const selected = lyricLanguages.includes(item.id);
                                    const disabled = maxCount > 1 && !selected && lyricLanguages.length >= maxCount;
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => toggleLyricLanguage(item.id)}
                                        className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                          selected
                                            ? accentSelected
                                            : optionRest
                                        }`}
                                      >
                                        <p className="text-sm font-black flex items-center gap-1.5">
                                          {selected && <Check className="w-3.5 h-3.5" />}
                                          {item.label}
                                        </p>
                                        <p className="text-[10px] opacity-70 mt-0.5">제목도 {item.short} 기준</p>
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {hiddenLanguages.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowMoreLanguages((prev) => !prev)}
                              className={`mt-2 w-full rounded-xl px-3 py-2.5 text-xs font-black transition-all ${optionRest}`}
                            >
                              {showMoreLanguages ? '언어 접기' : '+ 언어 더보기'}
                            </button>
                          )}
                        </>
                      )}

                      {isMain && (
                        <div className={`mt-4 pt-4 border-t ${dividerClass} space-y-3`}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-[var(--text-secondary)]">가사 옵션</p>
                            <p className={`text-[10px] font-bold ${accentText}`}>가사 포함 시 적용</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setLocalKoreanEnglishMix((prev) => !prev)}
                              className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all ${
                                localKoreanEnglishMix
                                  ? accentSelected
                                  : optionRest
                              }`}
                            >
                              <p className="text-sm font-black flex items-center gap-1.5">
                                <Languages className="w-3.5 h-3.5" />
                                한/영 혼합 {localKoreanEnglishMix ? 'ON' : 'OFF'}
                              </p>
                              <p className="text-[10px] opacity-70 mt-0.5">한국어 중심에 영어를 섞습니다</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setLocalRapEnabled((prev) => !prev)}
                              className={`rounded-xl px-3 py-2.5 sm:py-3 border text-left transition-all ${
                                localRapEnabled
                                  ? accentSelected
                                  : optionRest
                              }`}
                            >
                              <p className="text-sm font-black flex items-center gap-1.5">
                                <Mic2 className="w-3.5 h-3.5" />
                                랩 {localRapEnabled ? 'ON' : 'OFF'}
                              </p>
                              <p className="text-[10px] opacity-70 mt-0.5">랩 섹션과 리듬형 가사를 허용</p>
                            </button>
                          </div>
                          <AnimatePresence initial={false}>
                            {localKoreanEnglishMix && (
                              <motion.div
                                key="english-mix-ratio"
                                initial={{ height: 0, opacity: 0, y: -4 }}
                                animate={{ height: 'auto', opacity: 1, y: 0 }}
                                exit={{ height: 0, opacity: 0, y: -4 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className={`rounded-xl p-3 ${isMain ? 'bg-white/[0.055]' : 'border border-[var(--border-color)] bg-black/10'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[11px] font-black text-[var(--text-secondary)]">영어 비율</p>
                                    <p className={`text-[11px] font-black ${accentText}`}>{localEnglishMixRatio}%</p>
                                  </div>
                                  <div className="grid grid-cols-7 gap-1.5">
                                    {mixRatioOptions.map((ratio) => (
                                      <button
                                        key={ratio}
                                        type="button"
                                        onClick={() => setLocalEnglishMixRatio(ratio)}
                                        className={`rounded-lg px-1.5 py-2 border text-[10px] font-black transition-all ${
                                          localEnglishMixRatio === ratio
                                            ? accentSelected
                                            : optionRestLight
                                        }`}
                                      >
                                        {ratio}%
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isMain && (
                  <div className={plainPanelSurface}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-[var(--text-secondary)] flex items-center gap-1.5">
                        <ListMusic className="w-3.5 h-3.5" />
                        생성 개수
                      </p>
                      <p className={`text-[10px] font-bold ${accentText}`}>최대 5곡</p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setGenerationCount(count)}
                          className={`rounded-xl px-2 py-2.5 sm:py-3 border text-center transition-all ${
                            generationCount === count
                              ? accentSelected
                              : optionRest
                          }`}
                        >
                          <p className="text-sm font-black">{count}곡</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isMain && onPreview ? (
                  <div className="flex gap-2.5 w-full items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onPreview({
                          includeLyrics,
                          lyricLanguages: includeLyrics ? lyricLanguages.slice(0, maxCount) : [],
                          generationCount,
                          isKoreanEnglishMix: includeLyrics ? localKoreanEnglishMix : false,
                          englishMixRatio: localEnglishMixRatio,
                          rapEnabled: includeLyrics ? localRapEnabled : false,
                        });
                      }}
                      className="basis-[33%] w-[33%] h-14 sm:h-16 rounded-2xl border border-white/10 bg-black hover:bg-white text-white hover:text-black font-black text-[11px] sm:text-base transition-all flex items-center justify-center shrink-0 whitespace-nowrap outline-none select-none"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      미리보기
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!hasApiKey || (includeLyrics && lyricLanguages.length === 0)}
                      className="basis-[67%] w-[67%] h-14 sm:h-16 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-lg font-black transition-all shadow-lg bg-[#E7AD68] hover:bg-[#ECB976] !text-[#111111] shadow-[0_12px_28px_rgba(231,173,104,0.22)] shrink-0 flex items-center justify-center outline-none select-none"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      다음
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!hasApiKey || (includeLyrics && lyricLanguages.length === 0)}
                    className={`w-full h-14 sm:h-16 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-lg sm:text-xl font-black transition-all shadow-lg ${accentBg} outline-none select-none`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    다음
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4 sm:space-y-5"
              >
                <div className={panelSurface}>
                  <div className={`flex items-center justify-between px-5 py-4 border-b ${dividerClass}`}>
                    <span className="text-sm font-black text-[var(--text-secondary)]">가사 설정</span>
                    <span className={`text-sm font-black ${accentText} flex items-center gap-1.5 text-right`}>
                      {includeLyrics && <Languages className="w-4 h-4" />}
                      {selectedLyricLabel}
                    </span>
                  </div>
                  {!isMain && (
                    <div className={`flex items-center justify-between px-5 py-4 border-t ${dividerClass}`}>
                      <span className="text-sm font-black text-[var(--text-secondary)]">Suno 버전</span>
                      <span className={`text-sm font-black ${accentText}`}>{getSunoModelMeta(sunoModelVersion).label}</span>
                    </div>
                  )}
                  {isMain && includeLyrics && (
                    <div className={`flex items-center justify-between px-5 py-4 border-t ${dividerClass}`}>
                      <span className="text-sm font-black text-[var(--text-secondary)]">가사 옵션</span>
                      <span className={`text-sm font-black ${accentText} text-right`}>
                        {localKoreanEnglishMix ? `한/영 ${localEnglishMixRatio}%` : '한/영 OFF'} · 랩 {localRapEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  )}
                  {!isMain && canUseBatchTargets && (
                    <div className={`flex items-center justify-between px-5 py-4 border-t ${dividerClass}`}>
                      <span className="text-sm font-black text-[var(--text-secondary)]">생성 대상</span>
                      <span className={`text-sm font-black ${accentText}`}>{targetMode === 'batch' ? `최근 묶음 ${musicApiTargets.length}곡` : '현재 곡 1곡'}</span>
                    </div>
                  )}
                  {isMain && (
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-sm font-black text-[var(--text-secondary)]">생성 개수</span>
                      <span className={`text-sm font-black ${accentText}`}>{generationCount}곡</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasApiKey}
                  className={`w-full h-14 sm:h-16 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-lg sm:text-xl font-black transition-all shadow-lg ${accentBg}`}
                >
                  {isMain ? `${generationCount}곡 생성하기` : (targetMode === 'batch' ? `${musicApiTargets.length}곡 API 생성하기` : '1곡 API 생성하기')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
