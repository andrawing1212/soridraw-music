import { set, ref } from 'firebase/database';
import { realtimeDb } from '../firebase';
import {
  addV1MutationPostSuccessHook,
  type V1MutationBoundaryContext,
} from '../data/v1MutationBoundary';

export type UserDomainSyncKind = 'musicNote' | 'recentSongs';

export type UserDomainSyncSignal = {
  version: number;
  at: number;
  originDeviceId: string;
  operation: string;
  affectedCount: number;
  documentIds: string[];
  truncated: boolean;
};

const DEVICE_STORAGE_KEY = 'soridraw_user_domain_sync_device_v1';
const MAX_DOCUMENT_IDS = 10;

const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = String(window.localStorage.getItem(DEVICE_STORAGE_KEY) || '').trim();
    if (existing) return existing;
    const next = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_STORAGE_KEY, next);
    return next;
  } catch {
    return `d_mem_${Math.random().toString(36).slice(2, 10)}`;
  }
};

const resultDocumentId = (result: unknown): string => {
  if (!result || typeof result !== 'object') return '';
  return String((result as { id?: unknown }).id || '').trim();
};

const buildSignal = (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
): UserDomainSyncSignal => {
  const rawIds = [
    ...(context.documentIds || []),
    ...(context.domain === 'musicNote' && context.operation === 'save' ? [resultDocumentId(result)] : []),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(rawIds)];
  const now = Date.now();
  return {
    version: now,
    at: now,
    originDeviceId: getDeviceId(),
    operation: String(context.operation || '').slice(0, 48),
    affectedCount: Math.max(0, Math.min(1_000_000, Number(context.affectedCount || uniqueIds.length || 1) || 1)),
    documentIds: uniqueIds.slice(0, MAX_DOCUMENT_IDS),
    truncated: uniqueIds.length > MAX_DOCUMENT_IDS,
  };
};

const publishSignal = async (
  context: Readonly<V1MutationBoundaryContext>,
  result: unknown,
): Promise<void> => {
  const uid = String(context.uid || '').trim();
  if (!uid) return;
  const kind: UserDomainSyncKind = context.domain === 'musicNote' ? 'musicNote' : 'recentSongs';
  await set(ref(realtimeDb, `userSync/${uid}/${kind}`), buildSignal(context, result));
};

// SORIDRAW_USER_DOMAIN_SYNC_STAGE2A_20260905
// This is a mutation-only mirror. App entry, reload, cache hydration and ordinary reads
// never call set(). The payload is fixed-size and contains at most 10 document IDs.
// It never reads Firestore and can never enumerate an owner's song collection.
addV1MutationPostSuccessHook(publishSignal);
