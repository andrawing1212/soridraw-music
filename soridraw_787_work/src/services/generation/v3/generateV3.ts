import type { V3GenerationResult, V3SourceParams } from './types';

/**
 * V3 engine entry point.
 *
 * Step 27 only creates the isolated module boundary. The Gemini call and
 * generation logic will be connected in later steps so V1/V2 remain untouched.
 */
export async function generateV3(_params: V3SourceParams): Promise<V3GenerationResult> {
  throw new Error('V3 generation engine is not connected yet.');
}
