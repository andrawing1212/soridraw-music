import React from 'react';
import { ChevronRight, FlaskConical } from 'lucide-react';

type LabStartCardProps = {
  title?: string;
  description?: string;
  onOpen: () => void;
};

export default function LabStartCard({
  title = 'FREEDOM',
  description = '프롬프트 구조와 가사 구조를 직접 실험할 첫 작업대입니다.',
  onOpen,
}: LabStartCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-left shadow-xl transition-all hover:border-[#BBA8CA]/28 hover:bg-white/[0.06]"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="rounded-2xl border border-[#BBA8CA]/18 bg-[#877198]/12 p-3 text-[#BBA8CA]">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p>
            <p className="mt-3 inline-flex rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] font-black text-[#BBA8CA]">
              실험실 만들기
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/35 transition-all group-hover:translate-x-0.5 group-hover:text-[#BBA8CA]" />
      </div>
    </button>
  );
}
