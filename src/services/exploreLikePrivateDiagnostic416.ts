import { readCacheDiagnosticsEnabled } from '../lib/cacheDiagnostics';

export const STAGE416_PRIVATE_ACCEPTANCE_DIAGNOSTIC_EVENT =
  'soridraw:stage416-private-acceptance-diagnostic';

const STORAGE_KEY_416 = 'soridraw_stage416_private_acceptance_diagnostic_v1';

export type Stage416PrivateAcceptanceDiagnostic416 = {
  operationToken: string;
  source: 'initial' | 'recovery';
  phase: 'reply' | 'registered' | 'error';
  attempt: number;
  serverAccepted: boolean | null;
  receiptValid: boolean;
  reason: string;
  version: number | null;
  count: number | null;
  outboxRegistered: boolean;
  updatedAt: number;
};

type PrivateReply416 = {
  ok?: boolean;
  accepted?: boolean;
  version?: number;
  count?: number;
  reason?: string;
};

const SAFE_REASONS_416 = new Set([
  'ACCEPTED',
  'DUPLICATE_CONFIRMED',
  'PRIOR_WINDOW_NEEDS_SEAL',
  'STALE_OR_DUPLICATE',
  'DEVICE_LIMIT',
  'TRACK_LIMIT',
]);

const SAFE_ERROR_CODES_416 = new Set([
  'UNAUTHENTICATED',
  'FAILED-PRECONDITION',
  'INVALID-ARGUMENT',
  'PERMISSION-DENIED',
  'UNAVAILABLE',
  'DEADLINE-EXCEEDED',
  'INTERNAL',
  'NOT-FOUND',
  'RESOURCE-EXHAUSTED',
  'UNKNOWN',
]);

const opaqueOperationToken416 = (operationId: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < operationId.length; index += 1) {
    hash ^= operationId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return 'op-' + (hash >>> 0).toString(16).padStart(8, '0');
};

const safeReason416 = (value: unknown) => {
  const reason = String(value || '').trim().toUpperCase();
  return SAFE_REASONS_416.has(reason) ? reason : 'OTHER';
};

const safeCallableError416 = (error: unknown) => {
  const raw = String((error as { code?: unknown })?.code || '')
    .replace(/^functions\//i, '')
    .trim()
    .toUpperCase();
  return 'CALLABLE_' + (SAFE_ERROR_CODES_416.has(raw) ? raw : 'UNKNOWN');
};

const readStored416 = (): Stage416PrivateAcceptanceDiagnostic416 | null => {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_416);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Stage416PrivateAcceptanceDiagnostic416>;
    const attempt = Number(value.attempt);
    const updatedAt = Number(value.updatedAt);
    if (!/^op-[0-9a-f]{8}$/.test(String(value.operationToken || '')) ||
        !['initial', 'recovery'].includes(String(value.source || '')) ||
        !['reply', 'registered', 'error'].includes(String(value.phase || '')) ||
        !Number.isSafeInteger(attempt) || attempt < 1 ||
        !Number.isSafeInteger(updatedAt) || updatedAt <= 0) return null;
    const version = Number(value.version);
    const count = Number(value.count);
    return {
      operationToken: String(value.operationToken),
      source: value.source as 'initial' | 'recovery',
      phase: value.phase as 'reply' | 'registered' | 'error',
      attempt,
      serverAccepted: typeof value.serverAccepted === 'boolean' ? value.serverAccepted : null,
      receiptValid: value.receiptValid === true,
      reason: String(value.reason || 'OTHER').slice(0, 48),
      version: Number.isSafeInteger(version) && version > 0 ? version : null,
      count: Number.isSafeInteger(count) && count >= 0 ? count : null,
      outboxRegistered: value.outboxRegistered === true,
      updatedAt,
    };
  } catch {
    return null;
  }
};

const writeStored416 = (state: Stage416PrivateAcceptanceDiagnostic416) => {
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem(STORAGE_KEY_416, JSON.stringify(state)); } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STAGE416_PRIVATE_ACCEPTANCE_DIAGNOSTIC_EVENT, {
      detail: state,
    }));
  }
};

const nextAttempt416 = (operationToken: string) => {
  const previous = readStored416();
  return previous?.operationToken === operationToken
    ? Math.min(99, previous.attempt + 1)
    : 1;
};

export const recordStage416PrivateAcceptanceReply416 = (
  uid: string,
  operationId: string,
  source: 'initial' | 'recovery',
  reply: PrivateReply416,
): void => {
  if (!uid || !operationId || !readCacheDiagnosticsEnabled(uid)) return;
  const operationToken = opaqueOperationToken416(operationId);
  const version = Number(reply?.version);
  const count = Number(reply?.count);
  const receiptValid = reply?.ok === true && reply?.accepted === true &&
    Number.isSafeInteger(version) && version > 0 &&
    Number.isSafeInteger(count) && count >= 0;
  writeStored416({
    operationToken,
    source,
    phase: 'reply',
    attempt: nextAttempt416(operationToken),
    serverAccepted: typeof reply?.accepted === 'boolean' ? reply.accepted : null,
    receiptValid,
    reason: reply?.accepted === true && !reply?.reason
      ? 'ACCEPTED'
      : safeReason416(reply?.reason),
    version: Number.isSafeInteger(version) && version > 0 ? version : null,
    count: Number.isSafeInteger(count) && count >= 0 ? count : null,
    outboxRegistered: false,
    updatedAt: Date.now(),
  });
};

export const recordStage416PrivateAcceptanceError416 = (
  uid: string,
  operationId: string,
  source: 'initial' | 'recovery',
  error: unknown,
): void => {
  if (!uid || !operationId || !readCacheDiagnosticsEnabled(uid)) return;
  const operationToken = opaqueOperationToken416(operationId);
  writeStored416({
    operationToken,
    source,
    phase: 'error',
    attempt: nextAttempt416(operationToken),
    serverAccepted: null,
    receiptValid: false,
    reason: safeCallableError416(error),
    version: null,
    count: null,
    outboxRegistered: false,
    updatedAt: Date.now(),
  });
};

export const markStage416PrivateAcceptanceRegistered416 = (
  uid: string,
  operationId: string,
  source: 'initial' | 'recovery',
  version: number,
): void => {
  if (!uid || !operationId || !readCacheDiagnosticsEnabled(uid)) return;
  const operationToken = opaqueOperationToken416(operationId);
  const previous = readStored416();
  const exact = previous?.operationToken === operationToken ? previous : null;
  writeStored416({
    operationToken,
    source,
    phase: 'registered',
    attempt: exact?.attempt || 1,
    serverAccepted: true,
    receiptValid: true,
    reason: exact?.reason === 'DUPLICATE_CONFIRMED' ? 'DUPLICATE_CONFIRMED' : 'ACCEPTED',
    version: Number.isSafeInteger(version) && version > 0 ? version : exact?.version || null,
    count: exact?.count ?? null,
    outboxRegistered: true,
    updatedAt: Date.now(),
  });
};

export const readStage416PrivateAcceptanceDiagnostic416 = (
  uid: string,
): Stage416PrivateAcceptanceDiagnostic416 | null => {
  if (!uid || !readCacheDiagnosticsEnabled(uid)) return null;
  return readStored416();
};
