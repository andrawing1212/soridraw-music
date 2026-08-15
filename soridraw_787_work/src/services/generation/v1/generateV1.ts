/**
 * V1 entry boundary.
 *
 * Step 28 intentionally delegates to the existing Classic implementation so
 * output stays identical while the engine receives its own module boundary.
 * V1 prompt/lyric/rule code will be migrated behind this boundary in later
 * steps without affecting V2 or V3.
 */
export async function runV1Engine<TResult>(executeLegacyV1: () => Promise<TResult>): Promise<TResult> {
  return executeLegacyV1();
}
