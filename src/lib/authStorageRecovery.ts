// A full or restricted browser store must not make Google sign-in impossible.
// Keep the recovery strictly limited to Firebase Auth persistence; never clear
// SORIDRAW local caches, Music Note drafts, or other application storage.
export type AuthStorageMode = 'local' | 'session' | 'memory';

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
  if (/quota.exceed|storage.quota|storage.space|storage.is.full|storage.is.disabled/.test(message)) return true;

  if (item.cause && item.cause !== error) {
    const cause = item.cause as { code?: unknown; name?: unknown };
    const causeCode = String(cause.code ?? '').toLowerCase();
    const causeName = String(cause.name ?? '').toLowerCase();
    return causeCode === '22' || causeCode === '1014' || causeName === 'quotaexceedederror';
  }
  return false;
};

export const resolveAuthPersistence = async (
  preferred: 'local' | 'session',
  apply: (mode: AuthStorageMode) => Promise<void>,
  skipLocal = false,
): Promise<AuthStorageMode> => {
  const modes: AuthStorageMode[] = preferred === 'local'
    ? skipLocal ? ['session', 'memory'] : ['local', 'session', 'memory']
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
