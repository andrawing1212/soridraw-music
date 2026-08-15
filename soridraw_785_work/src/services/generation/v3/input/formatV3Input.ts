import type { V3CollectedInput } from '../types';

/**
 * Reserved for formatting raw selections and user text for Gemini.
 * It must never invent scenes, emotions, objects, or story direction.
 */
export function formatV3Input(_input: V3CollectedInput): string {
  return '';
}
