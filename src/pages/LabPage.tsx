import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Power } from 'lucide-react';
import LabStartCard from '../components/lab/LabStartCard';
import LabWorkspace from '../components/lab/LabWorkspace';

type LabView = 'cards' | 'workspace';

export default function LabPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<LabView>('cards');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-2 md:px-4 pt-20 pb-10 text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1840px] space-y-7">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/80 px-4 py-2.5 text-sm font-black text-[var(--text-secondary)] transition-all hover:bg-[var(--hover-bg)]"
            >
              <ArrowLeft className="h-4 w-4" /> 홈
            </button>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-black text-[#FF8AAE]">
              <Power className="h-4 w-4" /> Lab OFF · 입구만 준비됨
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#FF8AAE]/80">SORIDRAW LAB</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-tight md:text-4xl">
              <FlaskConical className="h-8 w-8 text-[#FF8AAE]" /> 실험실
            </h1>
          </div>
        </motion.div>

        {view === 'cards' ? (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] bg-gradient-to-br from-[#FFD36B]/10 via-white/[0.04] to-[#FF7DAF]/10 p-5 shadow-2xl backdrop-blur-xl md:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-black">실험 카드</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-black text-white/45">1개 준비됨</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <LabStartCard onOpen={() => setView('workspace')} />
            </div>
          </motion.section>
        ) : (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] bg-gradient-to-br from-[#FFD36B]/10 via-white/[0.04] to-[#FF7DAF]/10 p-3 shadow-2xl backdrop-blur-xl md:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#FFD36B]/12 px-3 py-1.5 text-xs font-black text-[#FF8AAE]">
                  <FlaskConical className="h-3.5 w-3.5" /> 1번 실험실
                </div>
                <h2 className="mt-3 text-2xl font-black">FREEDOM 마인드맵 작업대</h2>
              </div>
              <button
                type="button"
                onClick={() => setView('cards')}
                className="rounded-2xl bg-white/[0.04] px-4 py-2.5 text-sm font-black text-[var(--text-secondary)] transition-all hover:bg-white/[0.08] hover:text-white"
              >
                카드 목록
              </button>
            </div>
            <LabWorkspace />
          </motion.section>
        )}
      </div>
    </div>
  );
}
