// app424 — detect a genuine closed/background app resume without polling.
// Only a real hidden/pagehide transition is eligible; app updates, route changes,
// fast reloads and ordinary Explore navigation never trigger data-server reads.
const LAST_HIDDEN_KEY_424 = 'soridraw:explore:last-hidden-at:424';
const LAST_CONSUMED_PREFIX_424 = 'soridraw:explore:resume-consumed:424:';
const MIN_HIDDEN_MS_424 = 15_000;
let installed424 = false;
const lastConsumedMemory424 = new Map<string, number>();

export const installExploreDormantResumeClock424 = (): void => {
  if (installed424 || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed424 = true;
  const noteHidden424 = () => {
    try { window.localStorage.setItem(LAST_HIDDEN_KEY_424, String(Date.now())); } catch {}
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') noteHidden424();
  });
  window.addEventListener('pagehide', noteHidden424);
};

// Each channel consumes the same true-resume token at most once.
// Independent personal and public revision checks are edge/R2 metadata only;
// no source change, extra listener, timer, full-list D1 query or new backend.
export const takeExploreDormantResume424 = (
  channel: 'private' | 'public',
  now = Date.now(),
): boolean => {
  if (typeof window === 'undefined' || !Number.isFinite(now)) return false;
  let hiddenAt = 0;
  try { hiddenAt = Number(window.localStorage.getItem(LAST_HIDDEN_KEY_424) || 0); } catch {}
  if (!Number.isSafeInteger(hiddenAt) || hiddenAt <= 0 ||
      hiddenAt > now || now - hiddenAt < MIN_HIDDEN_MS_424) return false;
  const key = LAST_CONSUMED_PREFIX_424 + channel;
  let consumed = lastConsumedMemory424.get(key) || 0;
  try {
    consumed = Math.max(consumed, Number(window.sessionStorage.getItem(key) || 0) || 0);
  } catch {}
  if (consumed >= hiddenAt) return false;
  lastConsumedMemory424.set(key, hiddenAt);
  try { window.sessionStorage.setItem(key, String(hiddenAt)); } catch {}
  return true;
};
