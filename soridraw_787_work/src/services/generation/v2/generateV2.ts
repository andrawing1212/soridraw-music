/**
 * V2 entry boundary.
 *
 * The existing V2 implementation now lives entirely inside this folder. The
 * public route still delegates through the legacy service during Step 28 so
 * its runtime input normalization and output remain unchanged.
 */
export async function runV2Engine<TResult>(executeLegacyV2: () => Promise<TResult>): Promise<TResult> {
  return executeLegacyV2();
}
