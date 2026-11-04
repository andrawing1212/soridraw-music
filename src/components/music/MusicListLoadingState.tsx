import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Shared cold-list loading state for Music Note and Library.
 *
 * A brief authenticated cache hydration must not flash a spinner at every
 * tab/route entry. This component exists only while no displayable list is
 * available; it never blocks list rows that have already been loaded.
 */
export default function MusicListLoadingState() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-label="곡 목록 확인 중"
      className="flex min-h-[112px] w-full items-center justify-center gap-2.5 px-4 py-8"
    >
      {visible && (
        <>
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-white/55" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            곡 목록을 확인하는 중...
          </span>
        </>
      )}
    </div>
  );
}
