const SORIDRAW_CHUNK_LOAD_RECOVERY_047 = true;
const RECOVERY_STORAGE_KEY = 'soridraw_chunk_load_recovery_v1';
const RECOVERY_COOLDOWN_MS = 60_000;
let installed = false;

const errorMessage = (value: unknown): string => {
  if (value instanceof Error) return String(value.message || value.name || '');
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value) {
    return String((value as { message?: unknown }).message || '');
  }
  return '';
};

export const isStaleChunkLoadError = (value: unknown): boolean => {
  const message = errorMessage(value).toLowerCase();
  if (!message) return false;
  return message.includes('failed to fetch dynamically imported module')
    || message.includes('error loading dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('chunkloaderror')
    || (/loading chunk\s+.+\s+failed/.test(message));
};

const recoverySignature = (value: unknown): string => errorMessage(value).trim().slice(0, 800);

export const recoverFromStaleChunkError = (value: unknown): boolean => {
  if (typeof window === 'undefined' || !isStaleChunkLoadError(value)) return false;
  const signature = recoverySignature(value);
  const now = Date.now();
  try {
    const raw = window.sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (raw) {
      const previous = JSON.parse(raw) as { signature?: string; at?: number };
      if (previous?.signature === signature && now - Number(previous?.at || 0) < RECOVERY_COOLDOWN_MS) {
        return false;
      }
    }
    window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ signature, at: now }));
  } catch {
    // Storage can be blocked. A reload is still safer than leaving a stale chunk fatal screen.
  }
  window.location.reload();
  return true;
};

export const installChunkLoadRecovery = (): void => {
  if (typeof window === 'undefined' || installed) return;
  installed = true;
  window.addEventListener('unhandledrejection', (event) => {
    void recoverFromStaleChunkError(event.reason);
  });
  window.addEventListener('error', (event) => {
    const errorEvent = event as ErrorEvent;
    void recoverFromStaleChunkError(errorEvent.error || errorEvent.message);
  });
};

void SORIDRAW_CHUNK_LOAD_RECOVERY_047;
