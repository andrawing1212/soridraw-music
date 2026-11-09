import { onValue, ref as databaseRef, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';

// Source-only candidate; no trusted Worker -> Firebase Admin relay exists yet.
// Shared backend release requires separate approval. Disabled by default.
export const EXPLORE_OWNER_FOLLOW_REALTIME_526_ENABLED = false;

export const subscribeExploreOwnerFollowerSync526 = (
  ownerUid: string, onSnapshot: (value: unknown) => void,
): Unsubscribe => {
  const uid = String(ownerUid || '').trim();
  if (!EXPLORE_OWNER_FOLLOW_REALTIME_526_ENABLED || !uid) return () => {};
  return onValue(
    databaseRef(realtimeDb, 'userSync/' + uid + '/exploreFollowerOwner526'),
    (snapshot) => onSnapshot(snapshot.val()),
    (error) => console.warn('[526] owner follow invalidation unavailable:', error),
  );
};
