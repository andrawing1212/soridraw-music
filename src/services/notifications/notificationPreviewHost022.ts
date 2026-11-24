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

// Production uses the same read-only owner inbox with its own canonical API.
// Existing PREVIEW contract remains unchanged, TEST/local/overrides stay OFF.
const PRODUCTION_HOSTS_RELEASE = new Set(['soridraw.com','soridraw.web.app','soridraw.firebaseapp.com']);
export const NOTIFICATION_PRODUCTION_WORKER_RELEASE='https://soridraw-explore-api.andrawing1212.workers.dev';
export function canUseReleaseInbox(hostname:string,apiBase:string):boolean {
 return canUsePreviewInbox022(hostname,apiBase)||(
  PRODUCTION_HOSTS_RELEASE.has(String(hostname||'').toLowerCase())&&
  String(apiBase||'').replace(/\/+$/,'')===NOTIFICATION_PRODUCTION_WORKER_RELEASE);
}
