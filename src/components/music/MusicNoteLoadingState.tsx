import { Loader2 } from 'lucide-react';

/** Music Note only. All readiness stages use the same existing orange spinner
 * and copy. The caller owns loading; no timer, network request or cache changes. */
export default function MusicNoteLoadingState({
  embedded = false,
  overlay = false,
}: { embedded?: boolean; overlay?: boolean }) {
  return (
    <div
      role="status"
      className={`flex w-full items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] ${embedded ? 'min-h-[320px]' : 'min-h-screen'} ${overlay ? 'absolute inset-0' : ''}`}
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-brand-orange" />
        <p className="text-sm font-medium text-gray-400">뮤직노트를 준비하는 중...</p>
      </div>
    </div>
  );
}
