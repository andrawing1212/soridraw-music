import { buildLyricClicheGuardInstruction } from '../../../../constants/lyricClicheGuard';
import type { V3CollectedInput, V3PromptRequest } from '../types';

/** Builds the single-call V3 request. Implemented in a later step. */
export function buildV3Prompt(input: V3CollectedInput): V3PromptRequest {
  return {
    // V3 creative prompting is still intentionally empty, but the common
    // technical lyric guard is already attached so it cannot be skipped when
    // the engine is connected later.
    systemInstruction: buildLyricClicheGuardInstruction(input.params),
    userContent: '',
  };
}
