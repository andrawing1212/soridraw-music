// SORIDRAW Stage A: fail-closed extraction for proposed membership RETURNING results.
// Does not perform a DB query, create a signal, or trust a client-provided event.
// NOT wired to any production/preview Worker, Functions, RTDB or release path.
export function extractChangedLikeTrackIds397(batchResults, maxTracks = 50) {
  if (!Array.isArray(batchResults) || batchResults.length < 4) {
    throw new Error('397: canonical aggregate result missing');
  }
  if (!Number.isSafeInteger(maxTracks) || maxTracks < 1 || maxTracks > 50) {
    throw new Error('397: invalid bound');
  }
  const changed = new Set();
  for (const i of [2, 3]) { // patch040: membership INSERT and DELETE positions
    const result = batchResults[i];
    const count = result?.meta?.changes;
    if (!Number.isSafeInteger(count) || count < 0 || !Array.isArray(result.results)) {
      throw new Error('397: missing RETURNING results or changes metadata');
    }
    if (count !== result.results.length) {
      throw new Error('397: changes vs rows mismatch; do not publish partial alert');
    }
    for (const row of result.results) {
      const trackId = row?.track_id;
      if (typeof trackId !== 'string' || !trackId.trim() || trackId !== trackId.trim() || trackId.length > 512) {
        throw new Error('397: invalid canonical changed track');
      }
      changed.add(trackId);
      if (changed.size > maxTracks) {
        throw new Error('397: change count exceeds bounded event; require split/recovery');
      }
    }
  }
  return [...changed].sort();
}
