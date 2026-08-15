import type { V3CollectedInput, V3SourceParams } from '../types';

/** Collects the app input as-is. No interpretation, compression, or hardcoding. */
export function collectV3Input(params: V3SourceParams): V3CollectedInput {
  return {
    params,
    collectedAt: Date.now(),
  };
}
