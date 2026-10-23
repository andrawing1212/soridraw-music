// app468: single bounded, durable, EVENT-DRIVEN curation projection repair.
// The canonical D1 is never written here. There is one pending record per
// curator environment, NOT one polling job per user or song.
export const CURATED_REPAIR_KEY_468 = 'curated-projection-repair-468';
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

const scheduleAtMost = async (storage, when) => {
  const current = await storage.getAlarm();
  if (current == null || current > when) await storage.setAlarm(when);
};

// Reserve BEFORE the canonical publication request. If the reservation fails,
// caller must not execute that request. A browser/workerd crash after the
// canonical commit still leaves a durable repair record to be checked later.
export async function reserveCuratedRepair468(storage, trackIds, now = Date.now()) {
  const requested = uniqueIds(trackIds);
  if (!requested.length) return { reserved: false };
  const previous = await storage.get(CURATED_REPAIR_KEY_468);
  const ids = uniqueIds([...(previous?.trackIds || []), ...requested]);
  const generation = Number(previous?.generation || 0) + 1;
  const pending = {
    generation, trackIds: ids,
    firstAt: Number(previous?.firstAt || now), reservedAt: now,
    confirmedAt: 0, failures: Number(previous?.failures || 0),
    nextAttemptAt: now + CURATED_REPAIR_PREPARE_GRACE_MS_468,
  };
  await storage.put(CURATED_REPAIR_KEY_468, pending);
  await scheduleAtMost(storage, now + CURATED_REPAIR_WAKE_MS_468);
  return { reserved: true, generation, trackIds: ids };
}

export async function confirmCuratedRepair468(storage, generation, now = Date.now()) {
  const row = await storage.get(CURATED_REPAIR_KEY_468);
  if (!row || row.generation !== generation) return { confirmed: false, superseded: true };
  row.confirmedAt = now;
  row.nextAttemptAt = now + CURATED_REPAIR_WAKE_MS_468;
  await storage.put(CURATED_REPAIR_KEY_468, row);
  await scheduleAtMost(storage, row.nextAttemptAt);
  return { confirmed: true, generation };
}

export async function acknowledgeCuratedRepair468(storage, generation) {
  const row = await storage.get(CURATED_REPAIR_KEY_468);
  if (!row || row.generation !== generation) return { acknowledged: false, superseded: true };
  await storage.delete(CURATED_REPAIR_KEY_468);
  return { acknowledged: true, generation };
}

export async function drainCuratedRepair468(storage, reconcile, now = Date.now()) {
  const state = await storage.get(CURATED_REPAIR_KEY_468);
  if (!state) return { pending: false };
  // A pre-commit crash can leave an unconfirmed reservation. Wait for the
  // last prepared action to settle or time out, then reconcile canonical D1.
  const eligibleAt = state.confirmedAt
    ? Math.max(state.nextAttemptAt, state.confirmedAt)
    : Math.max(state.nextAttemptAt, state.reservedAt + CURATED_REPAIR_PREPARE_GRACE_MS_468);
  if (now < eligibleAt) {
    await scheduleAtMost(storage, eligibleAt);
    return { pending: true, deferred: true };
  }

  let settled = false;
  try {
    const outcome = await reconcile(uniqueIds(state.trackIds));
    settled = outcome?.ok === true;
  } catch { /* derived refresh errors retry without touching original D1 */ }

  const latest = await storage.get(CURATED_REPAIR_KEY_468);
  if (!latest) return { pending: false };
  if (latest.generation !== state.generation) {
    await scheduleAtMost(storage, Math.max(now + CURATED_REPAIR_WAKE_MS_468, latest.nextAttemptAt));
    return { pending: true, superseded: true };
  }
  if (settled) {
    await storage.delete(CURATED_REPAIR_KEY_468);
    return { pending: false, repaired: true };
  }
  const failures = Math.min(20, Number(state.failures || 0) + 1);
  const backoff = Math.min(CURATED_REPAIR_MAX_BACKOFF_MS_468,
    CURATED_REPAIR_WAKE_MS_468 * (2 ** Math.min(12, failures)));
  const next = { ...state, failures, nextAttemptAt: now + backoff };
  await storage.put(CURATED_REPAIR_KEY_468, next);
  await scheduleAtMost(storage, next.nextAttemptAt);
  return { pending: true, retrying: true, failures };
}
