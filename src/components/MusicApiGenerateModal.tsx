import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, Key, Languages, Music, X } from 'lucide-react';

export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr';

type ModalVariant = 'main' | 'musicApi';

type MusicApiGenerateModalProps = {
  hasApiKey?: boolean;
  isNoLyrics?: boolean;
  variant?: ModalVariant;
  availableLyricLanguages?: LanguageCode[];
  maxLyricLanguages?: number;
  onClose: () => void;
  onConfirm: (titleLanguage: LanguageCode, includeLyrics: boolean, lyricLanguages: LanguageCode[]) => void;
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

  const [step, setStep] = useState<1 | 2>(1);
  const [includeLyrics, setIncludeLyrics] = useState<boolean>(() => !isNoLyrics);
  const [lyricLanguages, setLyricLanguages] = useState<LanguageCode[]>(initialLangs);

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

  const selectedLyricLabel = useMemo(() => {
    if (!includeLyrics) return '가사 미포함';
    return lyricLanguages
      .map((lang) => getLanguageMeta(lang).label)
      .filter(Boolean)
      .join(' + ');
  }, [includeLyrics, lyricLanguages]);

  const toggleLyricLanguage = (lang: LanguageCode) => {
    setLyricLanguages((prev) => {
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
    if (includeLyrics && lyricLanguages.length === 0) return;
    setStep(2);
  };

  const handleConfirm = () => {
    if (!hasApiKey) return;
    const langs = includeLyrics ? lyricLanguages.slice(0, maxCount) : [];
    const titleLanguage = langs.find((lang) => lang !== 'ko') || langs[0] || 'ko';
    onConfirm(titleLanguage, includeLyrics, langs);
  };

  const subtitle = isMain
    ? (step === 1 ? '가사 포함 여부와 생성할 가사 언어를 선택합니다.' : '선택한 설정으로 곡 생성을 시작합니다.')
    : (step === 1 ? 'Music API로 보낼 가사 포함 여부를 선택합니다.' : '선택한 설정으로 생성을 요청합니다.');

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
        className="w-full max-w-md rounded-[28px] bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
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

        <div className="px-6 pb-6">
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
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-[var(--text-secondary)]">가사/제목 언어</p>
                        <p className={`text-[10px] font-bold ${accentText}`}>최대 {maxCount}개</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {filteredLanguages.map((item) => {
                          const selected = lyricLanguages.includes(item.id);
                          const disabled = !selected && lyricLanguages.length >= maxCount;
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
                    </div>
                  )}
                </div>

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
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-sm font-black text-[var(--text-secondary)]">가사 설정</span>
                    <span className={`text-sm font-black ${accentText} flex items-center gap-1.5 text-right`}>
                      {includeLyrics && <Languages className="w-4 h-4" />}
                      {selectedLyricLabel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasApiKey}
                  className={`w-full h-16 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-black transition-all shadow-lg ${accentBg}`}
                >
                  생성하기
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
