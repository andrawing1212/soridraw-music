import { lazy, Suspense, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';

// Do not eagerly load generation settings and their UI libraries on every
// Home/Explore/Music Note visit. Preserve the same props, instance lifecycle
// and modal logic when the user actually opens the generation dialog.
const MusicApiGenerateModalImpl = lazy(() => import('./MusicApiGenerateModal'));
type Props = ComponentProps<typeof import('./MusicApiGenerateModal')['default']>;

export default function MusicApiGenerateModalLazy(props: Props) {
  const content = (
    <Suspense fallback={(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-sm px-3"
        role="status"
        aria-label="생성 설정 불러오는 중…"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] px-5 py-4 shadow-2xl text-[var(--text-primary)]">
          <span aria-hidden="true" className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin opacity-70" />
          <span className="text-sm font-semibold">생성 설정 불러오는 중…</span>
        </div>
      </div>
    )}>
      <MusicApiGenerateModalImpl {...props} />
    </Suspense>
  );
  // Render both the lazy loading state and main generation dialog above the
  // split Builder pane. Preserve the Music API variant's existing placement.
  return props.variant === 'main' && typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
}
