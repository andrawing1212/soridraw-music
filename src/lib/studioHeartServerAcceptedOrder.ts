/** A server transaction's root version outlives each twenty-slot receipt.
 * Allocate all accepted click seq numbers from that root, not browser clocks
 * alone. This does not claim a click which never reached RTDB. */
export const nextStudioHeartServerAcceptedSeq = (
  rootVersion: number,
  previousSongSeq: number,
  nowMs: number,
): number => {
  const current = Math.max(0, Math.floor(Number(rootVersion || 0)));
  const previous = Math.max(0, Math.floor(Number(previousSongSeq || 0)));
  const clock = Math.max(0, Math.floor(Number(nowMs || 0)));
  const base = Math.max(current, previous, clock);
  if (!Number.isSafeInteger(base) || base >= Number.MAX_SAFE_INTEGER)
    throw new Error('STUDIO_HEART_SERVER_SEQUENCE_EXHAUSTED');
  return base + 1;
};
