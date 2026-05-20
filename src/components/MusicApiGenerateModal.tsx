import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ChevronLeft, ChevronUp, Key, Languages, Mic2, Music, X, ListMusic } from 'lucide-react';

export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr';

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
  isKoreanEnglishMix?: boolean;
  englishMixRatio?: number;
  rapEnabled?: boolean;
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
    }
  ) => void;
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

export default function MusicApiGenerateModal({
  hasApiKey = true,
  isNoLyrics = false,
  variant = 'musicApi',
  availableLyricLanguages,
  maxLyricLanguages,
  musicApiTargets = [],
  isKoreanEnglishMix = false,
  englishMixRatio = 10,
  rapEnabled = false,
  onClose,
  onConfirm,
}: MusicApiGenerateModalProps) {
  const isMain = variant === 'main';
  const maxCount = maxLyricLanguages ?? (isMain ? 2 : 1);
  const accent = isMain ? 'orange' : 'purple';
  const accentText = isMain ? 'text-brand-orange' : 'text-purple-300';
  const accentBg = isMain ? 'bg-brand-orange hover:brightness-110 shadow-brand-orange/30' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30';
  const accentSelected = isMain
    ? 'border-brand-orange/70 bg-brand-orange/20 text-orange-100'
    : 'border-purple-400/60 bg-purple-500/20 text-purple-100';
  const accentIcon = isMain
    ? 'bg-brand-orange/20 border-brand-orange/35 text-brand-orange'
    : 'bg-purple-600/25 border-purple-400/30 text-purple-200';

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

  const primaryLanguageOptions = useMemo(() => {
    if (!isMain) return filteredLanguages;
    const priority: LanguageCode[] = ['ko', 'en'];
    const primary = priority
      .map((lang) => filteredLanguages.find((item) => item.id === lang))
      .filter(Boolean) as typeof filteredLanguages;
    return primary.length > 0 ? primary : filteredLanguages.slice(0, 2);
  }, [filteredLanguages, isMain]);

  const extraLanguageOptions = useMemo(() => {
    if (!isMain) return [] as typeof filteredLanguages;
    const primaryIds = new Set(primaryLanguageOptions.map((item) => item.id));
    return filteredLanguages.filter((item) => !primaryIds.has(item.id));
  }, [filteredLanguages, isMain, primaryLanguageOptions]);

  const [showMoreLanguages, setShowMoreLanguages] = useState(false);

  const visibleLanguageOptions = isMain
    ? [...primaryLanguageOptions, ...(showMoreLanguages ? extraLanguageOptions : [])]
    : filteredLanguages;

  const [step, setStep] = useState<1 | 2>(1);
  const [includeLyrics, setIncludeLyrics] = useState<boolean>(() => !isNoLyrics);
  const [lyricLanguages, setLyricLanguages] = useState<LanguageCode[]>(initialLangs);
  const [generationCount, setGenerationCount] = useState<number>(1);
  const canUseBatchTargets = !isMain && musicApiTargets.length > 1;
  const [targetMode, setTargetMode] = useState<MusicApiTargetMode>('current');
  const [perTargetLyricLanguages, setPerTargetLyricLanguages] = useState<Record<string, LanguageCode>>({});
  const [localKoreanEnglishMix, setLocalKoreanEnglishMix] = useState<boolean>(isKoreanEnglishMix);
  const [localEnglishMixRatio, setLocalEnglishMixRatio] = useState<number>(() => Math.min(90, Math.max(5, Number(englishMixRatio) || 10)));
  const [localRapEnabled, setLocalRapEnabled] = useState<boolean>(rapEnabled);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
    setStep(2);
  };

  const handleConfirm = () => {
    if (!hasApiKey) return;
    const langs = includeLyrics ? lyricLanguages.slice(0, maxCount) : [];
    const titleLanguage = langs.find((lang) => lang !== 'ko') || langs[0] || 'ko';
    onConfirm(titleLanguage, includeLyrics, langs, isMain ? generationCount : 1, {
      targetMode: isMain ? 'current' : targetMode,
      perTargetLyricLanguages: includeLyrics && targetMode === 'batch' && !isMain ? perTargetLyricLanguages : undefined,
      isKoreanEnglishMix: includeLyrics && isMain ? localKoreanEnglishMix : false,
      englishMixRatio: includeLyrics && isMain && localKoreanEnglishMix ? localEnglishMixRatio : 10,
      rapEnabled: includeLyrics && isMain ? localRapEnabled : false,
    });
  };

  const subtitle = isMain
    ? (step === 1 ? '가사 포함 여부와 생성할 가사 언어를 선택합니다.' : '선택한 설정으로 곡 생성을 시작합니다.')
    : (step === 1 ? 'Music API로 보낼 대상과 가사를 선택합니다.' : '선택한 설정으로 생성을 요청합니다.');

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-sm px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        className="w-full max-w-md max-h-[92vh] rounded-[28px] bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative px-6 pt-6 pb-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="absolute left-5 top-5 p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
            title={step === 1 ? '닫기' : '뒤로가기'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center pt-4">
            <div className={`w-14 h-14 rounded-full border flex items-center justify-center mb-5 ${accentIcon}`}>
              {step === 1 ? <Music className="w-7 h-7" /> : <Check className="w-7 h-7" />}
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">
              {step === 1 ? '생성 옵션 선택' : '생성 준비 완료'}
            </h2>
            <p className={`text-sm font-semibold ${accentText}/90`}>{subtitle}</p>
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

        <div className="px-6 pb-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-[var(--border-color)] bg-white/5 overflow-hidden">
                  {!isMain && canUseBatchTargets && (
                    <div className="p-4 border-b border-[var(--border-color)]">
                      <p className="text-xs font-black text-[var(--text-secondary)] mb-3">생성 대상</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTargetMode('current')}
                          className={`rounded-xl px-3 py-3 border text-left transition-all ${
                            targetMode === 'current'
                              ? accentSelected
                              : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                          }`}
                        >
                          <p className="text-sm font-black">현재 곡만</p>
                          <p className="text-[10px] opacity-70 mt-0.5">보고 있는 곡 1개</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetMode('batch')}
                          className={`rounded-xl px-3 py-3 border text-left transition-all ${
                            targetMode === 'batch'
                              ? accentSelected
                              : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                          }`}
                        >
                          <p className="text-sm font-black">최근 생성 묶음 전체</p>
                          <p className="text-[10px] opacity-70 mt-0.5">각 곡을 따로 전송</p>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-4 border-b border-[var(--border-color)]">
                    <p className="text-xs font-black text-[var(--text-secondary)] mb-3">가사 포함 여부</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIncludeLyrics(true)}
                        className={`rounded-xl px-3 py-3 border text-left transition-all ${
                          includeLyrics
                            ? accentSelected
                            : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                        }`}
                      >
                        <p className="text-sm font-black">가사 포함</p>
                        <p className="text-[10px] opacity-70 mt-0.5">선택한 언어 가사 생성</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncludeLyrics(false)}
                        className={`rounded-xl px-3 py-3 border text-left transition-all ${
                          !includeLyrics
                            ? accentSelected
                            : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                        }`}
                      >
                        <p className="text-sm font-black">가사 미포함</p>
                        <p className="text-[10px] opacity-70 mt-0.5">프롬프트만 생성</p>
                      </button>
                    </div>
                  </div>

                  {includeLyrics && (
                    <div className="p-4">
                      {targetMode === 'batch' && !isMain ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-black text-[var(--text-secondary)]">곡별 가사/제목 언어</p>
                            <p className={`text-[10px] font-bold ${accentText}`}>각 곡 1개</p>
                          </div>
                          {musicApiTargets.map((target, idx) => (
                            <div key={target.id} className="rounded-xl border border-[var(--border-color)] bg-black/10 p-3">
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
                                          : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
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
                            {visibleLanguageOptions.map((item) => {
                              const selected = lyricLanguages.includes(item.id);
                              const disabled = maxCount > 1 && !selected && lyricLanguages.length >= maxCount;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => toggleLyricLanguage(item.id)}
                                  className={`rounded-xl px-3 py-3 border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                    selected
                                      ? accentSelected
                                      : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
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
                          {isMain && extraLanguageOptions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowMoreLanguages((prev) => !prev)}
                              className="mt-2 w-full rounded-xl border border-[var(--border-color)] bg-black/10 px-3 py-2.5 text-xs font-black text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-1.5"
                            >
                              {showMoreLanguages ? '언어 접기' : '언어 더보기'}
                              {showMoreLanguages ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {isMain && (
                            <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-black/10 p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-black text-[var(--text-secondary)]">가사 옵션</p>
                                <p className={`text-[10px] font-bold ${accentText}`}>가사 포함 시 적용</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setLocalKoreanEnglishMix((prev) => !prev)}
                                  className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
                                    localKoreanEnglishMix
                                      ? accentSelected
                                      : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                                  }`}
                                >
                                  <p className="text-xs font-black flex items-center gap-1.5"><Languages className="w-3.5 h-3.5" /> 한/영 혼합 {localKoreanEnglishMix ? 'ON' : 'OFF'}</p>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLocalRapEnabled((prev) => !prev)}
                                  className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
                                    localRapEnabled
                                      ? accentSelected
                                      : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                                  }`}
                                >
                                  <p className="text-xs font-black flex items-center gap-1.5"><Mic2 className="w-3.5 h-3.5" /> 랩 {localRapEnabled ? 'ON' : 'OFF'}</p>
                                </button>
                              </div>
                              {localKoreanEnglishMix && (
                                <div className="flex flex-wrap gap-1.5 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-2">
                                  {[5, 10, 20, 30, 50, 70, 90].map((ratio) => (
                                    <button
                                      key={ratio}
                                      type="button"
                                      onClick={() => setLocalEnglishMixRatio(ratio)}
                                      className={`px-2.5 py-1.5 rounded-full text-[10px] font-black transition-all ${
                                        localEnglishMixRatio === ratio
                                          ? 'bg-brand-orange text-white'
                                          : 'text-brand-orange/85 hover:bg-brand-orange/10'
                                      }`}
                                    >
                                      {ratio}%
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isMain && (
                  <div className="rounded-2xl border border-[var(--border-color)] bg-white/5 p-4">
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
                          className={`rounded-xl px-2 py-3 border text-center transition-all ${
                            generationCount === count
                              ? accentSelected
                              : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                          }`}
                        >
                          <p className="text-sm font-black">{count}곡</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!hasApiKey || (includeLyrics && lyricLanguages.length === 0)}
                  className={`w-full h-16 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-black transition-all shadow-lg ${accentBg}`}
                >
                  다음
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-[var(--border-color)] bg-white/5 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <span className="text-sm font-black text-[var(--text-secondary)]">가사 설정</span>
                    <span className={`text-sm font-black ${accentText} flex items-center gap-1.5 text-right`}>
                      {includeLyrics && <Languages className="w-4 h-4" />}
                      {selectedLyricLabel}
                    </span>
                  </div>
                  {!isMain && canUseBatchTargets && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border-color)]">
                      <span className="text-sm font-black text-[var(--text-secondary)]">생성 대상</span>
                      <span className={`text-sm font-black ${accentText}`}>{targetMode === 'batch' ? `최근 묶음 ${musicApiTargets.length}곡` : '현재 곡 1곡'}</span>
                    </div>
                  )}
                  {isMain && includeLyrics && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border-color)]">
                      <span className="text-sm font-black text-[var(--text-secondary)]">가사 옵션</span>
                      <span className={`text-sm font-black ${accentText} text-right`}>
                        {[localKoreanEnglishMix ? `한/영 ${localEnglishMixRatio}%` : '', localRapEnabled ? '랩 ON' : ''].filter(Boolean).join(' · ') || '기본'}
                      </span>
                    </div>
                  )}
                  {isMain && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border-color)]">
                      <span className="text-sm font-black text-[var(--text-secondary)]">생성 개수</span>
                      <span className={`text-sm font-black ${accentText}`}>{generationCount}곡</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasApiKey}
                  className={`w-full h-16 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-black transition-all shadow-lg ${accentBg}`}
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
