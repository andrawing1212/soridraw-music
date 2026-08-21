from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY'
if marker in source:
    print('879 language-mix active recovery already applied')
    raise SystemExit(0)

if 'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT' not in source:
    raise SystemExit('879 requires 877 runtime first')

# Important: AUTO_LANGUAGE_MIX_RETRY_ENABLED is a superseded legacy retry path.
# Keep it disabled so we do not run two independent mix engines or add duplicate Gemini calls.
if 'const AUTO_LANGUAGE_MIX_RETRY_ENABLED = false;' not in source:
    raise SystemExit('879 safety check failed: legacy language-mix retry must remain disabled')
if 'async function applyV1LockedWholeLyricLanguageMix(' not in source:
    raise SystemExit('879 safety check failed: active locked whole-lyric language-mix engine missing')

old_after_expansion = """      if (twoLanguageSelection
        && requestedRatio >= 10
        && requestedRatio <= 50
        && (applied.status !== 'applied' || !applied.ratioBandPassed || !targetCoverage.passed)) {
        applied = {
          ...applied,
          status: 'preserved',
          lyrics: sourceLyrics,
          actualRatio: measureV1WholeRewriteRatio(
            sourceLyrics,
            card.baseLanguage as V1LanguageMixCode,
            targetLanguages as V1LanguageMixCode[],
          ),
          appliedPlacementCount: 0,
          targetTimelineZoneCount: 0,
          selectedPlacements: [],
          preservedReason: !targetCoverage.passed
            ? 'multi-target-language-coverage-not-met-after-candidate-expansion'
            : 'two-language-ratio-band-not-met-after-candidate-expansion',
          warningReasons: Array.from(new Set([
            ...(applied.warningReasons || []),
            !targetCoverage.passed ? 'multi-target-language-coverage-not-met' : '',
            'two-language-candidate-expansion-exhausted',
          ].filter(Boolean))),
        };
      }
"""
new_after_expansion = """      const SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY = true;
      const mustPreserveAfterCandidateExpansion = twoLanguageSelection
        && requestedRatio >= 10
        && requestedRatio <= 50
        && (
          applied.status !== 'applied'
          || (targetLanguages.length > 1 && (!applied.ratioBandPassed || !targetCoverage.passed))
        );
      if (mustPreserveAfterCandidateExpansion) {
        applied = {
          ...applied,
          status: 'preserved',
          lyrics: sourceLyrics,
          actualRatio: measureV1WholeRewriteRatio(
            sourceLyrics,
            card.baseLanguage as V1LanguageMixCode,
            targetLanguages as V1LanguageMixCode[],
          ),
          appliedPlacementCount: 0,
          targetTimelineZoneCount: 0,
          selectedPlacements: [],
          preservedReason: !targetCoverage.passed
            ? 'multi-target-language-coverage-not-met-after-candidate-expansion'
            : 'two-language-ratio-band-not-met-after-candidate-expansion',
          warningReasons: Array.from(new Set([
            ...(applied.warningReasons || []),
            !targetCoverage.passed ? 'multi-target-language-coverage-not-met' : '',
            'two-language-candidate-expansion-exhausted',
          ].filter(Boolean))),
        };
      } else if (twoLanguageSelection
        && targetLanguages.length === 1
        && requestedRatio >= 10
        && requestedRatio <= 50
        && applied.status === 'applied'
        && !applied.ratioBandPassed) {
        applied = {
          ...applied,
          warningReasons: Array.from(new Set([
            ...(applied.warningReasons || []),
            'two-language-ratio-band-not-met-visible-candidate-kept',
          ])),
        };
      }
"""

old_after_hardban = """      if (twoLanguageSelection
        && requestedRatio >= 10
        && requestedRatio <= 50
        && applied.status === 'applied'
        && (!applied.ratioBandPassed || !targetCoverage.passed)) {
        applied = {
          ...applied,
          status: 'preserved',
          lyrics: sourceLyrics,
          actualRatio: measureV1WholeRewriteRatio(
            sourceLyrics,
            card.baseLanguage as V1LanguageMixCode,
            targetLanguages as V1LanguageMixCode[],
          ),
          appliedPlacementCount: 0,
          targetTimelineZoneCount: 0,
          selectedPlacements: [],
          preservedReason: !targetCoverage.passed
            ? 'multi-target-language-coverage-lost-after-hard-ban-refit'
            : 'two-language-ratio-band-lost-after-hard-ban-refit',
        };
      }
"""
new_after_hardban = """      if (twoLanguageSelection
        && targetLanguages.length > 1
        && requestedRatio >= 10
        && requestedRatio <= 50
        && applied.status === 'applied'
        && (!applied.ratioBandPassed || !targetCoverage.passed)) {
        applied = {
          ...applied,
          status: 'preserved',
          lyrics: sourceLyrics,
          actualRatio: measureV1WholeRewriteRatio(
            sourceLyrics,
            card.baseLanguage as V1LanguageMixCode,
            targetLanguages as V1LanguageMixCode[],
          ),
          appliedPlacementCount: 0,
          targetTimelineZoneCount: 0,
          selectedPlacements: [],
          preservedReason: !targetCoverage.passed
            ? 'multi-target-language-coverage-lost-after-hard-ban-refit'
            : 'two-language-ratio-band-lost-after-hard-ban-refit',
        };
      } else if (twoLanguageSelection
        && targetLanguages.length === 1
        && requestedRatio >= 10
        && requestedRatio <= 50
        && applied.status === 'applied'
        && !applied.ratioBandPassed) {
        applied = {
          ...applied,
          warningReasons: Array.from(new Set([
            ...(applied.warningReasons || []),
            'two-language-ratio-band-lost-after-hard-ban-refit-visible-candidate-kept',
          ])),
        };
      }
"""

if source.count(old_after_expansion) != 1:
    raise SystemExit(f'879 candidate-expansion anchor mismatch: {source.count(old_after_expansion)}')
if source.count(old_after_hardban) != 1:
    raise SystemExit(f'879 hard-ban-refit anchor mismatch: {source.count(old_after_hardban)}')

source = source.replace(old_after_expansion, new_after_expansion, 1)
source = source.replace(old_after_hardban, new_after_hardban, 1)
path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 879: restore active two-language mix output without enabling superseded legacy retry')
