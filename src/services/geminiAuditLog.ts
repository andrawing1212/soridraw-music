export type GeminiAuditSessionStatus = 'running' | 'success' | 'failed';
export type GeminiAuditCallStatus = 'success' | 'failed';

export interface GeminiAuditUsage {
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

export interface GeminiAuditCall {
  id: string;
  sessionId: string;
  sequence: number;
  context: string;
  model: string;
  status: GeminiAuditCallStatus;
  startedAt: string;
  durationMs: number;
  usage: GeminiAuditUsage;
  fallbackAttempt: number;
  errorMessage?: string;
}

export interface GeminiAuditSession {
  id: string;
  operation: string;
  status: GeminiAuditSessionStatus;
  startedAt: string;
  endedAt?: string;
  resultLabel?: string;
  errorMessage?: string;
  calls: GeminiAuditCall[];
}

export const GEMINI_AUDIT_EVENT = 'soridraw:gemini-audit-updated';
const STORAGE_KEY = 'soridraw_gemini_audit_v1';
const MAX_SESSIONS = 80;
const MAX_ERROR_LENGTH = 500;

const emptyUsage = (): GeminiAuditUsage => ({
  promptTokens: 0,
  outputTokens: 0,
  thoughtsTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
});

function createId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeUsageMetadata(metadata: any): GeminiAuditUsage {
  if (!metadata || typeof metadata !== 'object') return emptyUsage();
  const promptTokens = safeNumber(metadata.promptTokenCount ?? metadata.inputTokenCount);
  const outputTokens = safeNumber(metadata.candidatesTokenCount ?? metadata.outputTokenCount);
  const thoughtsTokens = safeNumber(metadata.thoughtsTokenCount);
  const cachedTokens = safeNumber(metadata.cachedContentTokenCount);
  const reportedTotal = safeNumber(metadata.totalTokenCount);
  return {
    promptTokens,
    outputTokens,
    thoughtsTokens,
    cachedTokens,
    totalTokens: reportedTotal || promptTokens + outputTokens + thoughtsTokens,
  };
}

function normalizeError(error: unknown): string {
  if (!error) return '';
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : (() => {
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        })();
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_LENGTH);
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readSessions(): GeminiAuditSession[] {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: GeminiAuditSession[]): void {
  if (!isBrowser()) return;
  try {
    const trimmed = sessions
      .slice()
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, MAX_SESSIONS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(GEMINI_AUDIT_EVENT));
  } catch (error) {
    console.warn('[SORIDRAW Gemini Audit] failed to persist local audit log:', error);
  }
}

export function getGeminiAuditSessions(): GeminiAuditSession[] {
  return readSessions()
    .slice()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function clearGeminiAuditSessions(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(GEMINI_AUDIT_EVENT));
}

export function startGeminiAuditSession(operation: string): string {
  const id = createId('gemini-session');
  const session: GeminiAuditSession = {
    id,
    operation: String(operation || 'Gemini 작업').trim() || 'Gemini 작업',
    status: 'running',
    startedAt: new Date().toISOString(),
    calls: [],
  };
  writeSessions([session, ...readSessions()]);
  return id;
}

export function finishGeminiAuditSession(
  sessionId: string | undefined,
  status: Exclude<GeminiAuditSessionStatus, 'running'>,
  options?: { resultLabel?: string; error?: unknown },
): void {
  if (!sessionId) return;
  const sessions = readSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index < 0) return;
  sessions[index] = {
    ...sessions[index],
    status,
    endedAt: new Date().toISOString(),
    resultLabel: String(options?.resultLabel || '').trim().slice(0, 120) || undefined,
    errorMessage: normalizeError(options?.error) || undefined,
  };
  writeSessions(sessions);
}

export function recordGeminiAuditCall(input: {
  sessionId?: string;
  context: string;
  model: string;
  status: GeminiAuditCallStatus;
  startedAtMs: number;
  response?: any;
  fallbackAttempt?: number;
  durationMs?: number;
  error?: unknown;
}): void {
  if (!input.sessionId) return;
  const sessions = readSessions();
  const index = sessions.findIndex((session) => session.id === input.sessionId);
  if (index < 0) return;
  const session = sessions[index];
  const call: GeminiAuditCall = {
    id: createId('gemini-call'),
    sessionId: input.sessionId,
    sequence: session.calls.length + 1,
    context: String(input.context || 'Gemini 호출').trim() || 'Gemini 호출',
    model: String(input.model || 'unknown').trim() || 'unknown',
    status: input.status,
    startedAt: new Date(input.startedAtMs).toISOString(),
    durationMs: Number.isFinite(Number(input.durationMs))
      ? Math.max(0, Math.round(Number(input.durationMs)))
      : Math.max(0, Date.now() - input.startedAtMs),
    usage: normalizeUsageMetadata(input.response?.usageMetadata),
    fallbackAttempt: Math.max(1, Math.round(Number(input.fallbackAttempt) || 1)),
    errorMessage: normalizeError(input.error) || undefined,
  };
  sessions[index] = {
    ...session,
    calls: [...session.calls, call],
  };
  writeSessions(sessions);
}

export function summarizeGeminiAuditSession(session: GeminiAuditSession): GeminiAuditUsage & {
  callCount: number;
  failedCallCount: number;
  durationMs: number;
} {
  const totals = session.calls.reduce<GeminiAuditUsage>((acc, call) => ({
    promptTokens: acc.promptTokens + call.usage.promptTokens,
    outputTokens: acc.outputTokens + call.usage.outputTokens,
    thoughtsTokens: acc.thoughtsTokens + call.usage.thoughtsTokens,
    cachedTokens: acc.cachedTokens + call.usage.cachedTokens,
    totalTokens: acc.totalTokens + call.usage.totalTokens,
  }), emptyUsage());
  const started = new Date(session.startedAt).getTime();
  const ended = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  return {
    ...totals,
    callCount: session.calls.length,
    failedCallCount: session.calls.filter((call) => call.status === 'failed').length,
    durationMs: Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0,
  };
}
