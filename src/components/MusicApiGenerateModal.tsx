import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, Key, Languages, Music, X } from 'lucide-react';

export type LanguageCode = 'ko' | 'en';

type MusicApiGenerateModalProps = {
  hasApiKey?: boolean;
  isNoLyrics?: boolean;
  mode?: 'song' | 'musicApi';
  hideTitleLanguage?: boolean;
  onClose: () => void;
  onConfirm: (titleLanguage: LanguageCode, includeLyrics: boolean, lyricLanguages: LanguageCode[]) => void;
};

const TITLE_LANGUAGES: { id: LanguageCode; label: string; subLabel: string }[] = [
  { id: 'ko', label: '한글 제목', subLabel: 'Korean title' },
  { id: 'en', label: '영어 제목', subLabel: 'English title' },
];

const LYRIC_LANGUAGES: { id: LanguageCode; label: string; subLabel: string }[] = [
  { id: 'ko', label: '한글 가사', subLabel: 'Korean lyrics' },
  { id: 'en', label: '영어 가사', subLabel: 'English lyrics' },
];

export default function MusicApiGenerateModal({
  hasApiKey = true,
  isNoLyrics = false,
  mode = 'musicApi',
  hideTitleLanguage = false,
  onClose,
  onConfirm,
}: MusicApiGenerateModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [titleLanguage, setTitleLanguage] = useState<LanguageCode>('ko');
  const [includeLyrics, setIncludeLyrics] = useState<boolean>(() => !isNoLyrics);
  const [lyricLanguages, setLyricLanguages] = useState<LanguageCode[]>(['ko']);

  const modalTitle = mode === 'song' ? '생성 옵션 선택' : '생성 옵션 선택';
  const modalDescription = mode === 'song'
    ? '가사 포함 여부와 생성할 가사 언어를 선택합니다.'
    : 'Music API로 보낼 가사 포함 여부를 선택합니다.';

  const selectedLyricLabel = useMemo(() => {
    if (!includeLyrics) return '가사 미포함';
    return lyricLanguages
      .map((lang) => LYRIC_LANGUAGES.find((item) => item.id === lang)?.label)
      .filter(Boolean)
      .join(' + ');
  }, [includeLyrics, lyricLanguages]);

  const toggleLyricLanguage = (lang: LanguageCode) => {
    setLyricLanguages((prev) => {
      if (prev.includes(lang)) {
        const next = prev.filter((item) => item !== lang);
        return next.length > 0 ? next : prev;
      }
      if (prev.length >= 2) return prev;
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
    onConfirm(titleLanguage, includeLyrics, includeLyrics ? lyricLanguages.slice(0, 2) : []);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        className="w-full max-w-md rounded-[28px] bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
      >
        <div className="relative px-6 pt-6 pb-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="absolute left-5 top-5 p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
          >
            {step === 1 ? <ChevronLeft className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center pt-4">
            <div className="w-14 h-14 rounded-full bg-purple-600/25 border border-purple-400/30 flex items-center justify-center mb-5">
              {step === 1 ? <Music className="w-7 h-7 text-purple-200" /> : <Check className="w-7 h-7 text-purple-200" />}
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] mb-2">
              {step === 1 ? modalTitle : '생성 준비 완료'}
            </h2>
            <p className="text-sm font-semibold text-purple-300/90">
              {step === 1 ? modalDescription : '선택한 설정으로 생성을 요청합니다.'}
            </p>
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
                  {!hideTitleLanguage && (
                    <div className="p-4 border-b border-[var(--border-color)]">
                      <p className="text-xs font-black text-[var(--text-secondary)] mb-3">제목 언어</p>
                      <div className="grid grid-cols-2 gap-2">
                        {TITLE_LANGUAGES.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTitleLanguage(item.id)}
                            className={`rounded-xl px-3 py-3 border text-left transition-all ${
                              titleLanguage === item.id
                                ? 'border-purple-400/60 bg-purple-500/20 text-purple-100'
                                : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                            }`}
                          >
                            <p className="text-sm font-black">{item.label}</p>
                            <p className="text-[10px] opacity-70 mt-0.5">{item.subLabel}</p>
                          </button>
                        ))}
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
                            ? 'border-purple-400/60 bg-purple-500/20 text-purple-100'
                            : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                        }`}
                      >
                        <p className="text-sm font-black">가사 포함</p>
                        <p className="text-[10px] opacity-70 mt-0.5">선택한 언어 가사 전송</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIncludeLyrics(false)}
                        className={`rounded-xl px-3 py-3 border text-left transition-all ${
                          !includeLyrics
                            ? 'border-purple-400/60 bg-purple-500/20 text-purple-100'
                            : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                        }`}
                      >
                        <p className="text-sm font-black">가사 미포함</p>
                        <p className="text-[10px] opacity-70 mt-0.5">프롬프트만 전송</p>
                      </button>
                    </div>
                  </div>

                  {includeLyrics && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-[var(--text-secondary)]">가사 언어</p>
                        <p className="text-[10px] font-bold text-purple-300">최대 2개</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {LYRIC_LANGUAGES.map((item) => {
                          const selected = lyricLanguages.includes(item.id);
                          const disabled = !selected && lyricLanguages.length >= 2;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleLyricLanguage(item.id)}
                              className={`rounded-xl px-3 py-3 border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                selected
                                  ? 'border-purple-400/60 bg-purple-500/20 text-purple-100'
                                  : 'border-[var(--border-color)] bg-black/10 text-[var(--text-secondary)] hover:bg-white/5'
                              }`}
                            >
                              <p className="text-sm font-black flex items-center gap-1.5">
                                {selected && <Check className="w-3.5 h-3.5" />}
                                {item.label}
                              </p>
                              <p className="text-[10px] opacity-70 mt-0.5">{item.subLabel}</p>
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
                  className="w-full h-16 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-black transition-all shadow-lg shadow-purple-900/30"
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
                  {!hideTitleLanguage && (
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                      <span className="text-sm font-black text-[var(--text-secondary)]">제목 언어</span>
                      <span className="text-sm font-black text-purple-300">
                        {TITLE_LANGUAGES.find((item) => item.id === titleLanguage)?.label}
                      </span>
                    </div>
                  )}
                  <div className={`flex items-center justify-between px-5 py-4 ${hideTitleLanguage ? '' : ''}`}>
                    <span className="text-sm font-black text-[var(--text-secondary)]">가사 설정</span>
                    <span className="text-sm font-black text-purple-300 flex items-center gap-1.5 text-right">
                      {includeLyrics && <Languages className="w-4 h-4" />}
                      {selectedLyricLabel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasApiKey}
                  className="w-full h-16 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-black transition-all shadow-lg shadow-purple-900/30"
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
