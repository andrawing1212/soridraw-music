from pathlib import Path

source = Path('src/services/geminiService.ts').read_text(encoding='utf-8')

required = [
    'SORIDRAW_880_LANGUAGE_MIX_REGRESSION_FIX',
    'const needsLanguageMixCandidateExpansion = requestedRatio >= 10',
    "targetLanguages.length > 1",
    "const parallelPair = twoLanguageSelection && cards.length === 2;",
    "processedCards.push(...await Promise.all(cards.map((card) => processLanguageMixCard(card))))",
    "String(context || '').trim() === '일본어 네이티브 의미 검수'",
    "!isV1LanguageMixEnabledForParams(params) && hasAuditableJapaneseBodyAtFinalBoundary(guarded)",
    "const japaneseAuditCandidateValid = isV1LanguageMixEnabledForParams(params)",
    'counts.kana > 0',
    'counts.latin < 3',
]
missing = [item for item in required if item not in source]
if missing:
    raise SystemExit(f'880 verification failed; missing: {missing}')

for forbidden in [
    'SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY',
    'const needsTwoLanguageCandidateExpansion = twoLanguageSelection',
    "two-language-ratio-band-not-met-visible-candidate-kept",
]:
    if forbidden in source:
        raise SystemExit(f'880 verification failed; forbidden regression remains: {forbidden}')

# Protect product contracts: selected output cards max 2, mix targets max 2.
if ").slice(0, 2) as LanguageCode[];" not in source:
    raise SystemExit('880 verification failed: max-2 selected lyric card contract missing')
if ".slice(0, 2);\n  params.languageMixTargetLanguages = requestedLanguageMixTargets;" not in source:
    raise SystemExit('880 verification failed: max-2 mix target contract missing')
if 'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT' not in source:
    raise SystemExit('880 verification failed: 877 Japanese audit slot missing')

print('SORIDRAW 880 verification OK: single/two-card mix recovery active, max-2 mix targets protected, Japanese audit isolated')
