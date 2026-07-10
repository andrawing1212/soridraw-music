import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Power } from 'lucide-react';
import LabStartCard from '../components/lab/LabStartCard';
import LabWorkspace from '../components/lab/LabWorkspace';

type LabView = 'cards' | 'style' | 'lyrics';

export default function LabPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<LabView>('cards');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-3 md:px-6 pt-20 pb-10 text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1720px] space-y-7">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (view === 'cards' ? navigate('/') : setView('cards'))}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.045] px-4 py-2.5 text-sm font-black text-[var(--text-secondary)] transition-all hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> {view === 'cards' ? '홈' : '카드 목록'}
            </button>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.035] px-4 py-2.5 text-xs font-black text-[#FF8AAE]">
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
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2rem] bg-[#0A0B0F] p-5 shadow-2xl md:p-6">
            <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.28) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 18% 12%, rgba(255,214,107,0.13), transparent 26%), radial-gradient(circle at 82% 18%, rgba(255,111,174,0.13), transparent 30%)' }} />
            <div className="relative z-10 mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl font-black">실험 카드</h2>
              <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] font-black text-white/45">2개 준비됨</span>
            </div>
            <div className="relative z-10 grid gap-7 md:grid-cols-2">
              <LabStartCard
                title="스타일 마인드맵"
                description="프롬프트 구조와 재료 배치를 실험하는 작업대"
                badge="STYLE"
                variant="style"
                onOpen={() => setView('style')}
              />
              <LabStartCard
                title="가사 마인드맵"
                description="가사 섹션과 말투 흐름을 실험하는 작업대"
                badge="LYRICS"
                variant="lyrics"
                onOpen={() => setView('lyrics')}
              />
            </div>
          </motion.section>
        ) : (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LabWorkspace mode={view === 'lyrics' ? 'lyrics' : 'style'} />
          </motion.section>
        )}
      </div>
    </div>
  );
}
