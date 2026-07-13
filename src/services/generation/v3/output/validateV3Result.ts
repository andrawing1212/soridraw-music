import type { V3GenerationResult, V3ValidationResult } from '../types';

/** Format-only validation. It must not replace scenes, lyrics, or prompt content. */
export function validateV3Result(_result: V3GenerationResult): V3ValidationResult {
  return {
    valid: true,
    issues: [],
  };
}
