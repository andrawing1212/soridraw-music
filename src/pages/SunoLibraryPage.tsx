import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Settings, Home, Music } from 'lucide-react';

export default function SunoLibraryPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-16 text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/')}
              className="mt-1 px-4 py-2.5 text-sm font-bold rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn transition-all shrink-0 flex items-center gap-2"
            >
              <Home className="w-4 h-4" />홈
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Music className="w-8 h-8 text-brand-orange" />
                Suno Library
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Suno API로 생성한 곡을 별도로 관리합니다.
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center self-end md:self-center">
            <button
              onClick={() => navigate('/suno-api-settings')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--bg-secondary)] border border-btn-border hover:bg-btn-hover transition-all"
            >
              <Settings className="w-4 h-4" />
              API 설정
            </button>
          </div>
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl bg-brand-orange/5 border border-brand-orange/20 text-[var(--text-secondary)] text-sm space-y-2 leading-relaxed"
        >
          <p>💡 음원 파일은 서버에 저장되지 않고 외부 audioUrl만 연결됩니다.</p>
          <p>💡 Suno API 기능은 관리자 설정과 개인 API Key 등록이 필요합니다.</p>
        </motion.div>

        {/* Empty State */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]"
        >
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-[var(--text-secondary)]/50" />
          </div>
          <h2 className="text-xl font-bold mb-2">아직 생성된 Suno API 곡이 없습니다.</h2>
          <p className="text-[var(--text-secondary)] mb-8">
            설정에서 API Key를 등록한 후 새로운 곡을 생성해보세요.
          </p>
          <button
            onClick={() => navigate('/suno-api-settings')}
            className="px-6 py-3 rounded-xl bg-brand-orange text-white font-bold hover:bg-brand-orange/90 transition-all active:scale-95"
          >
            API Key 등록하러 가기
          </button>
        </motion.div>
      </div>
    </div>
  );
}
