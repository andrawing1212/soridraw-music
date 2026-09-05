// Backend V2 Step 2-A4c
// Central boundary for EXISTING V1 Recent/Music Note mutations.
// V1 stays authoritative. Registered post-success hooks are invoked only AFTER
// a V1 mutation resolves successfully, and hook failures never change V1 success.

import type { V2LiveMirrorOperation } from './v2LiveMutation';

export const BACKEND_V2_V1_MUTATION_MIRROR_ENABLED = true as const;

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
  | 'color-sync'
  | 'structure-update';

export type V1MutationOperation = V1RecentMutationOperation | V1MusicNoteMutationOperation;

export interface V1MutationMirrorTarget {
  targetSongId: string;
  operation: V2LiveMirrorOperation;
  sourceUpdatedAtMs: number;
  sourceDocumentId?: string;
}

export interface V1MutationBoundaryContext {
  domain: V1MutationDomain;
  operation: V1MutationOperation;
  uid: string;
  documentIds?: readonly string[];
  affectedCount?: number;
  mirrorTargets?: readonly V1MutationMirrorTarget[];
}

export type V1MutationWrite<T> = Promise<T> | (() => Promise<T>);
export type V1MutationPostSuccessHook = (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
) => void | Promise<void>;

let legacyPostSuccessHook: V1MutationPostSuccessHook | null = null;
const additivePostSuccessHooks = new Set<V1MutationPostSuccessHook>();

// Backward-compatible single legacy slot used by the existing V2 shadow mirror.
export const registerV1MutationPostSuccessHook = (hook: V1MutationPostSuccessHook | null): void => {
  legacyPostSuccessHook = hook;
};

// SORIDRAW_V1_MUTATION_ADDITIVE_HOOKS_20260905
// New bounded side effects can coexist without replacing the existing shadow hook.
export const addV1MutationPostSuccessHook = (hook: V1MutationPostSuccessHook): (() => void) => {
  additivePostSuccessHooks.add(hook);
  return () => additivePostSuccessHooks.delete(hook);
};

const invokeHookSafely = (
  hook: V1MutationPostSuccessHook,
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
): void => {
  try {
    Promise.resolve(hook(context, result)).catch((error) => {
      console.warn('[Backend V2 2-A4c] post-success hook failed after V1 success.', error);
    });
  } catch (error) {
    console.warn('[Backend V2 2-A4c] post-success hook threw after V1 success.', error);
  }
};

export async function runV1MutationBoundary<T>(
  context: Readonly<V1MutationBoundaryContext>,
  writeV1: V1MutationWrite<T>,
): Promise<T> {
  const pending = typeof writeV1 === 'function' ? writeV1() : writeV1;
  const result = await pending;

  if (legacyPostSuccessHook) {
    invokeHookSafely(legacyPostSuccessHook, context, result);
  }
  for (const hook of additivePostSuccessHooks) {
    if (hook === legacyPostSuccessHook) continue;
    invokeHookSafely(hook, context, result);
  }

  return result;
}
