import { lazy, Suspense, type ComponentProps } from 'react';

// Do not eagerly load generation settings and their UI libraries on every
// Home/Explore/Music Note visit. Preserve the same props, instance lifecycle
// and modal logic when the user actually opens the generation dialog.
const MusicApiGenerateModalImpl = lazy(() => import('./MusicApiGenerateModal'));
type Props = ComponentProps<typeof import('./MusicApiGenerateModal')['default']>;

export default function MusicApiGenerateModalLazy(props: Props) {
  return (
    <Suspense fallback={null}>
      <MusicApiGenerateModalImpl {...props} />
    </Suspense>
  );
}
