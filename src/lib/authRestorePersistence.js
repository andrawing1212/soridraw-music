// app500 — preserve existing Firebase Auth credentials in their original browser
// persistence when a new app version opens in another tab. The Firebase SDK
// normally migrates all recovered users to the first available persistence
// in an array, removing keys from the other stores; that logs out old tabs.
//
// This module never reads or copies credentials into application state or
// alternate storage. It only checks the existence of an SDK-managed key.
export const getAuthUserStorageKey = (apiKey, appName = '[DEFAULT]') =>
  `firebase:authUser:${apiKey}:${appName}`;

const storageHasAuthKey = (storage, key) => {
  try {
    return Boolean(storage && storage.getItem(key));
  } catch {
    // A blocked Web Storage store is not proof that the user signed out.
    return false;
  }
};

export const selectStartupAuthPersistence = ({
  apiKey, appName = '[DEFAULT]', rememberLogin,
  localStorage, sessionStorage,
}) => {
  const key = getAuthUserStorageKey(apiKey, appName);
  const hasLocal = storageHasAuthKey(localStorage, key);
  const hasSession = storageHasAuthKey(sessionStorage, key);

  // An existing local/session account has first claim on its original store.
  // If both exist, do not delete either: use the explicit user's preference.
  if (hasLocal && hasSession) return rememberLogin ? 'local' : 'session';
  if (hasLocal) return 'local';
  if (hasSession) return 'session';

  // An existing IndexedDB user has no Web Storage key. With only IndexedDB
  // configured, the SDK restores it without migrating/deleting other stores.
  // New sign-ins still select their own persistence in App.tsx.
  return 'indexeddb';
};

const isSameSavedAccount = async (persistence, key, value) => {
  if (!key.startsWith('firebase:authUser:') || !value || typeof value.uid !== 'string') return false;
  try {
    const previous = await persistence._get(key);
    return Boolean(previous && previous.uid === value.uid);
  } catch {
    return false;
  }
};

// Wrap ONLY the initial restored store, not new sign-in persistences. Firebase
// refreshes the restored user and writes it even during initialization. If a
// nearly-full store refuses that refresh, retaining the unchanged UID in memory
// is safer than letting SDK init catch the error and clear the old credentials.
// Do not silently accept any new user's write or any unrelated storage error.
export const protectInitialAuthRestore = (UnderlyingPersistence, onWriteBlocked = () => {}) => {
  let initialRestoreFinished = false;
  const ProtectedPersistence = class extends UnderlyingPersistence {
    async _set(key, value) {
      try {
        return await super._set(key, value);
      } catch (error) {
        if (!initialRestoreFinished && await isSameSavedAccount(this, key, value)) {
          onWriteBlocked(error);
          return;
        }
        throw error;
      }
    }

  };
  return {
    persistence: ProtectedPersistence,
    markReady: () => { initialRestoreFinished = true; },
  };
};
