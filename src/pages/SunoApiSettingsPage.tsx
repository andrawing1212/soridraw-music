import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Home, Key } from 'lucide-react';
import SunoApiSettingsPanel from '../components/SunoApiSettingsPanel';

export default function SunoApiSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-20 pb-16 text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-[920px] space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/80 px-4 py-2.5 text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-all"
            >
              <Home className="w-4 h-4" /> 홈
            </button>
            <button
              onClick={() => navigate('/my-page')}
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-2.5 text-sm font-black text-sky-300 hover:bg-sky-500/20 transition-all"
            >
              마이페이지
            </button>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Key className="w-8 h-8 text-sky-300" />
              Suno API 설정
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
              이 설정은 마이페이지의 API 연결 영역에서도 동일하게 관리됩니다.
            </p>
          </div>
        </motion.div>

        <SunoApiSettingsPanel showHeader={false} />
      </div>
    </div>
  );
}
