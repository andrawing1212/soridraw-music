// Backend V2 Step 2-A4b
// Central boundary for EXISTING V1 Recent/Music Note mutations.
// This module deliberately performs no Firebase/network/IndexedDB/V2 work.
// A later separately approved step may attach best-effort mirroring only after V1 succeeds.

export const BACKEND_V2_V1_MUTATION_MIRROR_ENABLED = false as const;

export type V1MutationDomain = 'recent' | 'musicNote';

export type V1RecentMutationOperation =
  | 'clear'
  | 'delete-item'
  | 'save-batch'
  | 'regenerate'
  | 'add-lyrics-language'
  | 'edit'
  | 'pre-favorite-edit';

export type V1MusicNoteMutationOperation =
  | 'save'
  | 'restore'
  | 'unsave'
  | 'permanent-delete'
  | 'update'
  | 'recovery-update'
  | 'bulk-delete'
  | 'bulk-lock'
  | 'bulk-unlock'
  | 'folder-update'
  | 'shared-note-save'
  | 'folder-rename'
  | 'folder-delete'
  | 'color-sync';

export type V1MutationOperation = V1RecentMutationOperation | V1MusicNoteMutationOperation;

export interface V1MutationBoundaryContext {
  domain: V1MutationDomain;
  operation: V1MutationOperation;
  uid: string;
  /** Existing V1 document IDs when already known. Never used as cross-domain identity proof. */
  documentIds?: readonly string[];
  /** Number of V1 content documents affected by this logical mutation. */
  affectedCount?: number;
}

export type V1MutationWrite<T> = Promise<T> | (() => Promise<T>);

/**
 * Passes one existing V1 mutation through the common boundary and returns/throws exactly as it does.
 *
 * Accepting the already-created Promise is intentional in Step 2-A4b: it lets us wrap existing
 * Firestore expressions with the smallest possible behavioral change. A future approved mirror
 * can still run only after this Promise resolves successfully.
 *
 * Step 2-A4b invariants:
 * - V1 is authoritative,
 * - no V2 mirror is executed,
 * - no outbox is opened,
 * - no extra Firebase read/write is introduced,
 * - no mutation is retried here.
 *
 * The context is intentionally metadata-only. It is a future hook point, not a payload copy.
 */
export async function runV1MutationBoundary<T>(
  _context: Readonly<V1MutationBoundaryContext>,
  writeV1: V1MutationWrite<T>,
): Promise<T> {
  const pending = typeof writeV1 === 'function' ? writeV1() : writeV1;
  return await pending;
}
