import { findLyricHardBanViolations } from '../../../../constants/lyricClicheGuard';
import type { V3GenerationResult, V3SourceParams, V3ValidationResult } from '../types';

/** Format and technical validation only. It must not invent or replace creative content. */
export function validateV3Result(result: V3GenerationResult, params?: V3SourceParams): V3ValidationResult {
  const issues = params
    ? findLyricHardBanViolations(result.lyrics, params).map((violation) => ({
        code: 'LYRIC_HARD_BAN_VIOLATION',
        message: `HardBan term remains on lyric line ${violation.lineIndex + 1}: ${violation.term}`,
        severity: 'error' as const,
      }))
    : [];

  return {
    valid: issues.length === 0,
    issues,
  };
}
