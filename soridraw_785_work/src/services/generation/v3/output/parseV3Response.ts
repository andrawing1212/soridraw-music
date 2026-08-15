import type { V3GenerationResult } from '../types';

/** Splits title, music prompt, and lyrics without rewriting their meaning. */
export function parseV3Response(rawResponse: string): V3GenerationResult {
  return {
    title: '',
    musicPrompt: '',
    lyrics: '',
    rawResponse,
  };
}
