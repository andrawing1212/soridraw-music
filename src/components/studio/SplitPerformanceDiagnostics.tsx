import { lazy, Suspense } from 'react';

// The performance investigation UI does not execute for regular users.
// Admin toggles stay persisted and are read when the panel is mounted.
const SplitPerformanceDiagnosticsImpl = lazy(() => import('./SplitPerformanceDiagnosticsImpl'));

export default function SplitPerformanceDiagnostics({ isAdmin = false }: { isAdmin?: boolean }) {
  if (!isAdmin) return null;
  return <Suspense fallback={null}><SplitPerformanceDiagnosticsImpl isAdmin={isAdmin} /></Suspense>;
}
