import { lazy, Suspense } from 'react';

// Master diagnostics are not part of the ordinary listener/render path.
// Load the full diagnostic panel only after administrator access is known.
// The implementation still reads its persisted visibility state on mount.
const CacheDiagnosticsOverlayImpl = lazy(() => import('./CacheDiagnosticsOverlayImpl'));

export default function CacheDiagnosticsOverlay({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null;
  return <Suspense fallback={null}><CacheDiagnosticsOverlayImpl isAdmin={isAdmin} /></Suspense>;
}
