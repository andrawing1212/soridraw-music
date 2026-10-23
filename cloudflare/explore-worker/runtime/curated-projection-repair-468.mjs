// app468: bounded, durable and event-driven projection retries.
// Pending tickets remain independent: B's ACK must NOT erase A's in-flight
// canonical change, even when B completes first. D1 user originals never
// change in this helper; reconciliation reads at most curated MAX40 rows.
export const CURATED_REPAIR_KEY_468 = 'curated-projection-repair-468';
const CURATED_REPAIR_COUNTER_KEY_468 = 'curated-repair-sequence-468';
export const CURATED_REPAIR_MAX_IDS_468 = 40;
export const CURATED_REPAIR_PREPARE_GRACE_MS_468 = 180_000;
export const CURATED_REPAIR_WAKE_MS_468 = 5_000;
export const CURATED_REPAIR_MAX_BACKOFF_MS_468 = 3_600_000;

const uniqueIds = (input) => {
  const ids = [...new Set((Array.isArray(input) ? input : [])
    .map((x) => String(x || '').trim()).filter(Boolean))];
  if (ids.length > CURATED_REPAIR_MAX_IDS_468 || ids.some((id) => id.length > 512))
    throw Error('CURATED_REPAIR_IDS_INVALID_468');
  return ids;
};

const scheduleAtMost = async (storage, when, now) => {
  const current = await storage.getAlarm();
  if (current == null || current <= now || current > when)
    await storage.setAlarm(when);
};

const ticketsOf = (state) => Array.isArray(state?.tickets) ? state.tickets : [];
const unionTickets = (tickets) => uniqueIds(tickets.flatMap((t) => t.trackIds || []));
const keepState = async (storage, state) => {
  const tickets = ticketsOf(state);
  if (!tickets.length) {
    await storage.delete(CURATED_REPAIR_KEY_468);
    return;
  }
  await storage.put(CURATED_REPAIR_KEY_468, {
    ...state, trackIds: unionTickets(tickets),
  });
};
const dueAt = (ticket) => Number(ticket.confirmedAt || 0)
  ? Number(ticket.confirmedAt) + CURATED_REPAIR_WAKE_MS_468
  : Number(ticket.reservedAt) + CURATED_REPAIR_PREPARE_GRACE_MS_468;

// Pre-commit reservation: if this fails, caller MUST NOT mutate canonical.
// A successful reservation survives a Worker crash after canonical settlement.
export async function reserveCuratedRepair468(storage, trackIds, now = Date.now()) {
  const requested = uniqueIds(trackIds);
  if (!requested.length) return { reserved: false };
  const prior = await storage.get(CURATED_REPAIR_KEY_468) || {};
  const existing = ticketsOf(prior);
  if (existing.length >= CURATED_REPAIR_MAX_IDS_468)
    throw Error('CURATED_REPAIR_QUEUE_FULL_468');
  // Persist across empty-queue cycles: delayed stale ACKs must never match
  // a new ticket by reusing generation=1 (ABA/concurrent visibility race).
  const lastGeneration = Number(await storage.get(CURATED_REPAIR_COUNTER_KEY_468) || 0);
  if (!Number.isSafeInteger(lastGeneration) || lastGeneration < 0 ||
      lastGeneration >= Number.MAX_SAFE_INTEGER)
    throw Error('CURATED_REPAIR_SEQUENCE_INVALID_468');
  const generation = lastGeneration + 1;
  await storage.put(CURATED_REPAIR_COUNTER_KEY_468, generation);
  const tickets = [...existing, {
    generation, trackIds: requested, reservedAt: now, confirmedAt: 0,
  }];
  await keepState(storage, {
    ...prior, generation, tickets,
    failures: Number(prior.failures || 0),
    nextAttemptAt: Number(prior.nextAttemptAt || 0),
  });
  await scheduleAtMost(storage, now + CURATED_REPAIR_WAKE_MS_468, now);
  return { reserved: true, generation, trackIds: requested };
}

export async function confirmCuratedRepair468(storage, generation, now = Date.now()) {
  const state = await storage.get(CURATED_REPAIR_KEY_468);
  const tickets = ticketsOf(state);
  const index = tickets.findIndex((t) => t.generation === generation);
  if (index < 0) return { confirmed: false, missing: true };
  tickets[index] = { ...tickets[index], confirmedAt: now };
  await keepState(storage, { ...state, tickets });
  await scheduleAtMost(storage, now + CURATED_REPAIR_WAKE_MS_468, now);
  return { confirmed: true, generation };
}

export async function acknowledgeCuratedRepair468(storage, generation) {
  const state = await storage.get(CURATED_REPAIR_KEY_468);
  const tickets = ticketsOf(state);
  if (!tickets.some((t) => t.generation === generation))
    return { acknowledged: false, missing: true };
  const rest = tickets.filter((t) => t.generation !== generation);
  await keepState(storage, { ...state, tickets: rest });
  // Never cancel an existing alarm: it may belong to the frozen like scheduler.
  return { acknowledged: true, generation, stillPending: rest.length };
}

export async function drainCuratedRepair468(storage, reconcile, now = Date.now()) {
  const state = await storage.get(CURATED_REPAIR_KEY_468);
  const tickets = ticketsOf(state);
  if (!tickets.length) return { pending: false };
  const blockedUntil = Number(state.nextAttemptAt || 0);
  const eligible = now < blockedUntil ? [] : tickets.filter((t) => dueAt(t) <= now);
  if (!eligible.length) {
    const wakeAt = Math.max(now + 1, blockedUntil,
      Math.min(...tickets.map((t) => dueAt(t))));
    await scheduleAtMost(storage, wakeAt, now);
    return { pending: true, deferred: true };
  }

  const eligibleIds = unionTickets(eligible);
  let settled = false;
  try {
    const result = await reconcile(eligibleIds);
    settled = result?.ok === true;
  } catch { /* keep persisted tickets for bounded retry */ }

  const current = await storage.get(CURATED_REPAIR_KEY_468);
  if (!ticketsOf(current).length) return { pending: false };
  const latest = ticketsOf(current);
  if (settled) {
    // Only retire tickets whose canonical action was due when this read began.
    // A later ticket, especially an UNCOMMITTED writer, cannot be retired by
    // an earlier writer's CAS success/ack or by an alarm in flight.
    const processed = new Set(eligible.map((t) => t.generation));
    const remaining = latest.filter((t) => !processed.has(t.generation));
    await keepState(storage, {
      ...current, tickets: remaining, failures: 0, nextAttemptAt: 0,
    });
    if (remaining.length)
      await scheduleAtMost(storage,
        Math.max(now + 1, Math.min(...remaining.map((t) => dueAt(t)))), now);
    return { pending: remaining.length > 0, repaired: true };
  }
  const failures = Math.min(20, Number(current.failures || 0) + 1);
  const backoff = Math.min(CURATED_REPAIR_MAX_BACKOFF_MS_468,
    CURATED_REPAIR_WAKE_MS_468 * (2 ** Math.min(12, failures)));
  const nextAttemptAt = now + backoff;
  await keepState(storage, { ...current, failures, nextAttemptAt });
  await scheduleAtMost(storage, nextAttemptAt, now);
  return { pending: true, retrying: true, failures };
}
