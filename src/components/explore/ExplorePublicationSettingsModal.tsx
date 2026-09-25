import React from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import StudioCenterModalPortal from '../studio/StudioCenterModalPortal';
import type { ExplorePublicationOptions } from '../../services/explorePublicationService';

type Props = {
  title: string;
  options: ExplorePublicationOptions;
  busy: boolean;
  privateConfirm: boolean;
  onToggle: (key: keyof ExplorePublicationOptions) => void;
  onSave: () => void;
  onPrivate: () => void;
  onClose: () => void;
};

export default function ExplorePublicationSettingsModal({
  title,
  options,
  busy,
  privateConfirm,
  onToggle,
  onSave,
  onPrivate,
  onClose,
}: Props) {
  return (
    <StudioCenterModalPortal themeClassName="soridraw-explore-publication-modal-portal">
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 1 }}
        transition={{ duration: 0 }}
        className="pointer-events-auto fixed inset-0 z-[430] flex items-end justify-center bg-black/58 px-4 py-5 backdrop-blur-sm md:items-center"
        style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={() => { if (!busy) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0 }}
          className="pointer-events-auto w-full max-w-[430px] overflow-hidden rounded-[28px] bg-[#1b1b1b] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:p-6"
          style={{ pointerEvents: 'auto' }}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FFC1BC]/72">Explore</p>
              <h3 className="mt-1 text-xl font-black text-white">공개 설정</h3>
              <p className="mt-1 truncate text-xs font-semibold text-white/42">{title || '제목 없는 곡'}</p>
            </div>
            <button
              type="button"
              onClick={() => { if (!busy) onClose(); }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/50 transition-all hover:bg-white/[0.09] hover:text-white"
              aria-label="공개 설정 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 space-y-2.5">
            {([
              { key: 'allowNextSongApply', label: '다음곡에 적용 허용', description: '다른 사용자가 이 곡의 공개 설정을 다음곡에 활용할 수 있습니다.' },
              { key: 'allowFollowerSave', label: '팔로워 곡 저장 허용', description: '나를 팔로우한 사용자가 이 공개곡을 공유 노트에 저장할 수 있습니다.' },
              { key: 'profilePinned', label: '공개 프로필에 고정', description: '공개 프로필의 상단에 이 곡을 고정합니다.' },
            ] as const).map((item) => {
              const active = options[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => onToggle(item.key)}
                  className="flex w-full items-center gap-4 rounded-2xl bg-white/[0.045] px-4 py-3.5 text-left transition-all hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-55"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-white/88">{item.label}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-white/38">{item.description}</span>
                  </span>
                  <span className={`relative h-7 w-12 shrink-0 rounded-full transition-all ${active ? 'bg-[#FF7A72]' : 'bg-white/[0.11]'}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition-all ${active ? 'left-6' : 'left-1'}`} />
                  </span>
                </button>
              );
            })}
          </div>

          {privateConfirm && (
            <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-xs font-semibold leading-5 text-red-200/85">
              비공개로 전환하면 Explore와 공개 프로필에서 즉시 숨겨집니다. D1 기록은 삭제하지 않습니다.
            </div>
          )}

          <div className="mt-6 grid gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7A72] text-sm font-black text-white shadow-[0_12px_28px_rgba(255,122,114,0.18)] transition-all hover:bg-[#FF8C85] disabled:cursor-wait disabled:opacity-45"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              저장
            </button>

            <button
              type="button"
              onClick={onPrivate}
              disabled={busy}
              className={`flex h-11 w-full items-center justify-center rounded-2xl text-sm font-black transition-all disabled:cursor-wait disabled:opacity-45 ${
                privateConfirm
                  ? 'bg-red-500/18 text-red-200 hover:bg-red-500/24'
                  : 'bg-white/[0.055] text-white/48 hover:bg-white/[0.085] hover:text-white/78'
              }`}
            >
              {privateConfirm ? '비공개 전환 확인' : '비공개로 전환'}
            </button>

            <button
              type="button"
              onClick={() => { if (!busy) onClose(); }}
              className="h-10 w-full rounded-2xl bg-transparent text-xs font-bold text-white/30 transition-colors hover:text-white/60"
            >
              취소
            </button>
          </div>
        </motion.div>
      </motion.div>
    </StudioCenterModalPortal>
  );
}
