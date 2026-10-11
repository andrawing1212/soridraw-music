// Stage416 private canonical timing candidate; no live backend side effects.
export const PRIVATE_BATCH_MINUTES_416 = [1, 3, 5, 10, 20] as const;
export type PrivateBatchMinutes416 = typeof PRIVATE_BATCH_MINUTES_416[number];
export type PrivateBatchWindow416 = {
  openedAt: number;
  lastClickAt: number;
  minutes: PrivateBatchMinutes416;
  deadlineAt: number;
};
export const DEFAULT_PRIVATE_BATCH_MINUTES_416: PrivateBatchMinutes416 = 5;
export const validPrivateBatchMinutes416 = (minutes: unknown): minutes is PrivateBatchMinutes416 =>
  typeof minutes === 'number' && PRIVATE_BATCH_MINUTES_416.some(value => value === minutes);
export const parsePrivateBatchWindow416 = (value: unknown): PrivateBatchWindow416 | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<PrivateBatchWindow416>;
  if (!validPrivateBatchMinutes416(row.minutes) ||
      !Number.isSafeInteger(row.openedAt) || Number(row.openedAt) <= 0 ||
      !Number.isSafeInteger(row.lastClickAt) || Number(row.lastClickAt) < Number(row.openedAt) ||
      !Number.isSafeInteger(row.deadlineAt) ||
      Number(row.deadlineAt) !== Number(row.lastClickAt) + row.minutes * 60_000) return null;
  return row as PrivateBatchWindow416;
};
// Changes to Master settings never shorten/lengthen an already open window.
export const advancePrivateBatchWindow416 = (
  prior: PrivateBatchWindow416 | null, clickAt: number,
  configuredMinutes: PrivateBatchMinutes416 = DEFAULT_PRIVATE_BATCH_MINUTES_416,
): PrivateBatchWindow416 => {
  if (!Number.isSafeInteger(clickAt) || clickAt <= 0 ||
      !validPrivateBatchMinutes416(configuredMinutes)) throw new Error('BAD_PRIVATE_BATCH_CLOCK_416');
  const previous = parsePrivateBatchWindow416(prior);
  const continued = !!previous && previous.lastClickAt <= clickAt && clickAt <= previous.deadlineAt;
  const minutes = continued ? previous.minutes : configuredMinutes;
  return {
    openedAt: continued ? previous.openedAt : clickAt,
    lastClickAt: clickAt,
    minutes,
    deadlineAt: clickAt + minutes * 60_000,
  };
};
// Stage416 (OFF) remote hints may only EXTEND the pending clock. A client
// clock is not a server authority; complete offline/cross-device coordination
// still requires an authenticated server-side settlement gate.
export type PrivateBatchRemoteClick416 = {
  version: number;
  at: number;
  status: 'pending' | 'accepted' | 'rejected';
};
export const advancePrivateBatchWindowForRemoteClick416 = (
  prior: PrivateBatchWindow416 | null,
  remote: PrivateBatchRemoteClick416,
  receivedAt: number,
  configuredMinutes: PrivateBatchMinutes416 = DEFAULT_PRIVATE_BATCH_MINUTES_416,
): PrivateBatchWindow416 | null => {
  if (remote?.status !== 'pending' ||
      !Number.isSafeInteger(remote.version) || remote.version <= 0 ||
      !Number.isSafeInteger(remote.at) || remote.at <= 0 ||
      !Number.isSafeInteger(receivedAt) || receivedAt <= 0 ||
      !validPrivateBatchMinutes416(configuredMinutes) ||
      Math.abs(remote.at - receivedAt) > 30_000) return null;
  const safeAt = Math.max(receivedAt, remote.at);
  const current = parsePrivateBatchWindow416(prior);
  if (current && safeAt <= current.lastClickAt) return current;
  return advancePrivateBatchWindow416(current, safeAt, configuredMinutes);
};

// Rebuild a lost local clock from the durable outbox without clearing intents.
export const privateBatchDeadline416 = (
  prior: PrivateBatchWindow416 | null, latestOutboxClickAt: number,
): number => {
  const value = parsePrivateBatchWindow416(prior);
  if (value && value.lastClickAt >= latestOutboxClickAt) return value.deadlineAt;
  if (!Number.isSafeInteger(latestOutboxClickAt) || latestOutboxClickAt <= 0) {
    throw new Error('BAD_PRIVATE_BATCH_OUTBOX_416');
  }
  return latestOutboxClickAt + DEFAULT_PRIVATE_BATCH_MINUTES_416 * 60_000;
};
