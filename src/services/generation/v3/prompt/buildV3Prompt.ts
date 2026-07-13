import type { V3CollectedInput, V3PromptRequest } from '../types';

/** Builds the single-call V3 request. Implemented in a later step. */
export function buildV3Prompt(_input: V3CollectedInput): V3PromptRequest {
  return {
    systemInstruction: '',
    userContent: '',
  };
}
