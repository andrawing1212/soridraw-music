// SORIDRAW Stage022: read-only inbox is enabled solely on actual PREVIEW
// Hosting when its canonical PREVIEW Worker is selected.
// Do not enable from localhost, TEST/PRODUCTION, or a mismatched Vite API override.
const PREVIEW_HOSTS_022 = new Set([
  'preview.soridraw.com','soridraw-preview.web.app','soridraw-preview.firebaseapp.com',
]);
export const NOTIFICATION_PREVIEW_WORKER_022 =
  'https://soridraw-explore-preview.andrawing1212.workers.dev';
export function canUsePreviewInbox022(hostname:string,apiBase:string):boolean {
  return PREVIEW_HOSTS_022.has(String(hostname||'').toLowerCase()) &&
    String(apiBase||'').replace(/\/+$/,'')===NOTIFICATION_PREVIEW_WORKER_022;
}
