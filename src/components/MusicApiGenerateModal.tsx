import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { X, Check, ChevronLeft } from 'lucide-react';

export type LanguageCode = "ko" | "en";

interface MusicApiGenerateModalProps {
  onClose: () => void;
  onConfirm: (titleLanguage: LanguageCode, lyricLanguage: LanguageCode) => void;
  isNoLyrics: boolean;
  hasApiKey: boolean;
}

export default function MusicApiGenerateModal({
  onClose,
  onConfirm,
  isNoLyrics,
  hasApiKey
}: MusicApiGenerateModalProps) {
  const navigate = useNavigate();
  // If apiKey is missing, step is 0 (info). Otherwise start at 1.
  const [step, setStep] = useState<number>(!hasApiKey ? 0 : 1);
  const [titleLang, setTitleLang] = useState<LanguageCode | null>(null);
  const [lyricLang, setLyricLang] = useState<LanguageCode | null>(null);

  const handlePrev = () => {
    if (step === 2) setStep(1);
    if (step === 3) {
      if (isNoLyrics) setStep(1);
      else setStep(2);
    }
  };

  const handleConfirm = () => {
    if (!titleLang) return;
    // defaults if for some reason lyricLang string is null and not noLyrics
    onConfirm(titleLang, lyricLang || "ko");
  };

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {step > 1 && (
          <button
            onClick={handlePrev}
            className="absolute top-4 left-4 p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6 pt-2">
                <h2 className="text-xl font-black tracking-tight text-white mb-2 mt-2">API 키가 없습니다</h2>
              </div>

              <div className="space-y-4 text-sm text-white/80 leading-relaxed font-medium bg-white/5 p-4 rounded-xl">
                <p>Music API로 곡을 생성하려면 개인 Suno API 키 등록이 필요합니다.<br/>발급받은 API 키를 등록하면 복사/붙여넣기 없이 앱에서 바로 음악을 생성할 수 있습니다.</p>
                <div>
                  <p className="text-xs text-white/50 mb-2 font-bold uppercase tracking-wider">사용 방법</p>
                  <ol className="list-decimal pl-4 space-y-2 text-sm text-white/70">
                    <li>Suno API 사이트에서 개인 API 키를 발급받습니다.</li>
                    <li>앱에서 개인 설정 {'>'} Music API 키 메뉴로 이동합니다.</li>
                    <li>발급받은 API 키를 붙여넣고 저장합니다.</li>
                    <li>이후 Music API로 생성 버튼을 누르면 바로 곡 생성이 가능합니다.</li>
                  </ol>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate('/suno-api-settings');
                  }}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20 hover:bg-purple-500"
                >
                  API 설정으로 이동
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 text-white/40 text-xs font-bold hover:text-white transition-all uppercase tracking-wider"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6 mt-2 pt-2">
                <h2 className="text-xl font-black tracking-tight text-white mb-1">제목 언어 선택</h2>
                <p className="text-xs text-white/40 font-medium">생성될 곡 제목의 언어를 선택해주세요.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setTitleLang("ko");
                    if (isNoLyrics) {
                      setStep(3);
                    } else {
                      setStep(2);
                    }
                  }}
                  className={`py-6 rounded-xl font-bold text-sm transition-all border flex flex-col items-center gap-3 ${
                    titleLang === 'ko' ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 shadow-inner' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl">🇰🇷</span>
                  한글 제목
                </button>
                <button
                  onClick={() => {
                    setTitleLang("en");
                    if (isNoLyrics) {
                      setStep(3);
                    } else {
                      setStep(2);
                    }
                  }}
                  className={`py-6 rounded-xl font-bold text-sm transition-all border flex flex-col items-center gap-3 ${
                    titleLang === 'en' ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 shadow-inner' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl">🇺🇸</span>
                  영어 제목
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6 mt-2 pt-2">
                <h2 className="text-xl font-black tracking-tight text-white mb-1">가사 언어 선택</h2>
                <p className="text-xs text-white/40 font-medium">생성될 가사의 언어를 선택해주세요.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setLyricLang("ko");
                    setStep(3);
                  }}
                  className={`py-6 rounded-xl font-bold text-sm transition-all border flex flex-col items-center gap-3 ${
                    lyricLang === 'ko' ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 shadow-inner' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl">🇰🇷</span>
                  한글 가사
                </button>
                <button
                  onClick={() => {
                    setLyricLang("en");
                    setStep(3);
                  }}
                  className={`py-6 rounded-xl font-bold text-sm transition-all border flex flex-col items-center gap-3 ${
                    lyricLang === 'en' ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 shadow-inner' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl">🇺🇸</span>
                  영어 가사
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-6 mt-2 pt-2">
                <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/30">
                  <Check className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-white mb-1">생성 준비 완료</h2>
                <p className="text-xs text-purple-400/80 font-medium">선택한 언어 설정으로 생성을 요청합니다.</p>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50 font-bold uppercase tracking-wider">제목 언어</span>
                  <span className="text-sm font-bold text-purple-300">
                    {titleLang === 'ko' ? '한글 제목' : '영어 제목'}
                  </span>
                </div>
                {!isNoLyrics && (
                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-xs text-white/50 font-bold uppercase tracking-wider">가사 언어</span>
                    <span className="text-sm font-bold text-purple-300">
                      {lyricLang === 'ko' ? '한글 가사' : '영어 가사'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleConfirm}
                  className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20 hover:bg-purple-500 flex items-center justify-center gap-2"
                >
                  생성하기
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
