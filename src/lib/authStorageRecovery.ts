// A full or restricted browser store must not make Google sign-in impossible.
// Keep the recovery strictly limited to Firebase Auth persistence; never clear
// SORIDRAW local caches, Music Note drafts, or other application storage.
export type AuthStorageMode = 'indexeddb' | 'local' | 'session' | 'memory';

export const isRecoverableAuthStorageError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const item = error as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };
  const code = String(item.code ?? '').toLowerCase();
  const name = String(item.name ?? '').toLowerCase();
  const message = String(item.message ?? '').toLowerCase();

  if (code === '22' || code === '1014' || code === 'quotaexceedederror'
    || code === 'auth/web-storage-unsupported') return true;
  if (name === 'quotaexceedederror' || name === 'ns_error_dom_quota_reached'
    || name === 'securityerror') return true;
  if (/quota.*exceed|storage.*quota|storage.*space|storage.*full|storage.*disabled/.test(message)) return true;

  if (item.cause && item.cause !== error) {
    const cause = item.cause as { code?: unknown; name?: unknown };
    const causeCode = String(cause.code ?? '').toLowerCase();
    const causeName = String(cause.name ?? '').toLowerCase();
    return causeCode === '22' || causeCode === '1014' || causeName === 'quotaexceedederror';
  }
  return false;
};

// One small write/read-neutral probe before opening a Google popup helps catch
// nearly-full Web Storage before the user selects an account. Only our temporary
// probe key is removed; no existing browser or app data is touched.
export const probeAuthStorageCapacity = (
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
): void => {
  const key = `__soridraw_auth_probe_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let wroteProbe = false;
  try {
    storage.setItem(key, 's'.repeat(4096));
    wroteProbe = true;
  } finally {
    if (wroteProbe) storage.removeItem(key);
  }
};

export const resolveAuthPersistence = async (
  preferred: 'local' | 'session',
  apply: (mode: AuthStorageMode) => Promise<void>,
  skipLocal = false,
): Promise<AuthStorageMode> => {
  // A saturated localStorage does not imply IndexedDB is unavailable.
  // Prefer the Firebase durable store used by getAuth() before Web Storage.
  const modes: AuthStorageMode[] = preferred === 'local'
    ? skipLocal ? ['indexeddb', 'session', 'memory'] : ['indexeddb', 'local', 'session', 'memory']
    : ['session', 'memory'];

  let lastStorageError: unknown;
  for (const mode of modes) {
    try {
      await apply(mode);
      return mode;
    } catch (error) {
      // Never suppress an unrelated Firebase authentication or security error.
      if (!isRecoverableAuthStorageError(error)) throw error;
      lastStorageError = error;
    }
  }
  throw lastStorageError;
};

/**
 * A login can pass the persistence preflight but fail to write its credentials
 * later. On a second user click, try only the remaining storage backends.
 * Never remove SORIDRAW drafts/caches or downgrade an authenticated user.
 */
export const recoverAuthPersistenceAfterWriteFailure = async (
  failedMode: AuthStorageMode,
  apply: (mode: AuthStorageMode) => Promise<void>,
  skipLocal = false,
): Promise<AuthStorageMode> => {
  const candidates: AuthStorageMode[] = failedMode === 'indexeddb'
    ? skipLocal ? ['session', 'memory'] : ['local', 'session', 'memory']
    : failedMode === 'local' ? ['session', 'memory']
    : failedMode === 'session' ? ['memory'] : [];

  let lastStorageError: unknown = new Error('No remaining Firebase Auth persistence mode');
  for (const mode of candidates) {
    try {
      await apply(mode);
      return mode;
    } catch (error) {
      if (!isRecoverableAuthStorageError(error)) throw error;
      lastStorageError = error;
    }
  }
  throw lastStorageError;
};
