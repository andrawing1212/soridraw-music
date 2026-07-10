import React from 'react';
import { ChevronRight } from 'lucide-react';

type LabStartCardProps = {
  title: string;
  description: string;
  badge?: string;
  variant?: 'style' | 'lyrics';
  onOpen: () => void;
};

export default function LabStartCard({
  title,
  description,
  badge = 'LAB',
  variant = 'style',
  onOpen,
}: LabStartCardProps) {
  const isLyrics = variant === 'lyrics';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left"
    >
      <div className="overflow-hidden rounded-[1.7rem] bg-white/[0.035] shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.055]">
        <div className="relative h-48 overflow-hidden rounded-[1.7rem] bg-[#101013]">
          <div className="absolute inset-0 opacity-80" style={{ background: isLyrics ? 'radial-gradient(circle at 70% 42%, rgba(85,255,218,0.32), transparent 28%), radial-gradient(circle at 25% 68%, rgba(255,122,174,0.24), transparent 34%)' : 'radial-gradient(circle at 35% 42%, rgba(255,210,95,0.36), transparent 30%), radial-gradient(circle at 70% 62%, rgba(255,107,170,0.30), transparent 34%)' }} />
          <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.55) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

          <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black text-white shadow-2xl" style={{ background: isLyrics ? 'linear-gradient(135deg, #5ef2d6, #ff7aae)' : 'linear-gradient(135deg, #ffd66b, #ff6fae)' }}>
            {isLyrics ? 'LYRIC' : 'STYLE'}
          </div>

          {[
            ['18%', '30%'], ['21%', '72%'], ['78%', '28%'], ['76%', '72%'], ['50%', '16%'], ['50%', '84%'],
          ].map(([left, top], index) => (
            <div key={`${left}-${top}`} className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 shadow-xl backdrop-blur-md" style={{ left, top }}>
              <div className="absolute left-1/2 top-1/2 h-px w-20 origin-left bg-white/22" style={{ transform: `rotate(${index * 58 - 28}deg)` }} />
            </div>
          ))}

          <div className="absolute left-4 top-4 rounded-full bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">{badge}</div>
        </div>

        <div className="flex items-end justify-between gap-4 px-1 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-black text-white">{title}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/48">{description}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/32 transition-all group-hover:translate-x-1 group-hover:text-white/70" />
        </div>
      </div>
    </button>
  );
}
