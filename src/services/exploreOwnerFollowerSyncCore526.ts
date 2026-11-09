// APP526: pure gate for a server-confirmed owner-scoped follow invalidation.
// Marker carries no list or provisional count. Refresh only the owner's profile.
export type ExploreOwnerFollowerSignal526 = {
  ownerUid: string;
  version: number;
  at: number;
  receiptId: string;
};
const SIGNAL_MAX_AGE_MS_526 = 10 * 60_000;
const SIGNAL_FUTURE_SKEW_MS_526 = 60_000;

export const normalizeExploreOwnerFollowerSignal526 = (
  raw: unknown, ownerUid: string,
): ExploreOwnerFollowerSignal526 | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const uid = String(row.ownerUid || '').trim();
  const receiptId = String(row.receiptId || '').trim();
  const version = Number(row.version);
  const at = Number(row.at);
  if (!uid || uid !== ownerUid || !receiptId || receiptId.length > 128 ||
      !Number.isSafeInteger(version) || version <= 0 ||
      !Number.isSafeInteger(at) || at <= 0) return null;
  return { ownerUid: uid, receiptId, version, at };
};

export const createExploreOwnerFollowerGate526 = (
  ownerUid: string,
  readCanonicalFollowerCount: () => Promise<number>,
  applyCanonicalFollowerCount: (count: number) => void,
  now: () => number = Date.now,
  onReadError: (error: unknown) => void = () => {},
) => {
  let primed = false;
  let seenVersion = 0;
  let requestedVersion = 0;
  let reading = false;
  let disposed = false;

  const drain = async () => {
    if (disposed || reading || requestedVersion === 0) return;
    reading = true;
    try {
      while (!disposed && requestedVersion > 0) {
        requestedVersion = 0;
        try {
          const count = await readCanonicalFollowerCount();
          // A newer event arrived during the GET: never apply the old response.
          if (disposed) return;
          if (requestedVersion > 0) continue;
          if (Number.isSafeInteger(count) && count >= 0 && count <= 1_000_000_000) {
            applyCanonicalFollowerCount(count);
          }
        } catch (error) {
          if (disposed) return;
          onReadError(error); // Existing focus recheck remains the fallback.
        }
      }
    } finally {
      reading = false;
    }
  };

  const receive = (raw: unknown) => {
    if (disposed) return;
    const signal = normalizeExploreOwnerFollowerSignal526(raw, ownerUid);
    // First snapshot is retained RTDB state, not a new follow mutation.
    if (!primed) {
      primed = true;
      seenVersion = signal?.version || 0;
      return;
    }
    if (!signal || signal.version <= seenVersion) return;
    seenVersion = signal.version;
    const age = now() - signal.at;
    if (age > SIGNAL_MAX_AGE_MS_526 || age < -SIGNAL_FUTURE_SKEW_MS_526) return;
    requestedVersion = signal.version;
    void drain();
  };
  return { receive, dispose: () => { disposed = true; requestedVersion = 0; } };
};
