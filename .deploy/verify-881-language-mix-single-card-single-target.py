from pathlib import Path

service = Path('src/services/geminiService.ts').read_text(encoding='utf-8')
package = Path('package.json').read_text(encoding='utf-8')

required = [
    'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT',
    'SORIDRAW_881_LANGUAGE_MIX_SINGLE_CARD_SINGLE_TARGET',
    'const singleCardSingleTargetGuard = Boolean(args.singleCardSingleTargetGuard && args.targetLanguages.length === 1);',
    'const compactJsonGuard = twoLanguageSelection || singleCardSingleTargetGuard;',
    'const singleCardSingleTargetMix = cards.length === 1 && targetLanguages.length === 1;',
    'const needsTwoLanguageCandidateExpansion = (twoLanguageSelection || singleCardSingleTargetMix)',
    'singleCardSingleTargetGuard: singleCardSingleTargetMix,',
    "responseMimeType: 'application/json'",
]
missing = [item for item in required if item not in service]
if missing:
    raise SystemExit(f'881 verify missing runtime markers: {missing}')

for forbidden in [
    'SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY',
    'SORIDRAW_880_LANGUAGE_MIX_REGRESSION_FIX',
]:
    if forbidden in service:
        raise SystemExit(f'881 verify failed: forbidden failed patch present: {forbidden}')

protected = [
    "const parallelPair = twoLanguageSelection && cards.length === 2;",
    "if (twoLanguageSelection && cards.length === 2) {",
    "return Array.from(new Set(targets)).slice(0, 2);",
    "const AUTO_LANGUAGE_MIX_RETRY_ENABLED = false;",
    "const SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;",
]
missing_protected = [item for item in protected if item not in service]
if missing_protected:
    raise SystemExit(f'881 verify protected path changed/missing: {missing_protected}')

if service.count('cards.length === 1 && targetLanguages.length === 1') != 1:
    raise SystemExit('881 verify failed: 3A scope predicate must occur exactly once')

for script in ('predev', 'prebuild', 'prelint'):
    needle = '.deploy/apply-877-stage3-japanese-audit-dedicated-slot.py && python3 .deploy/apply-881-language-mix-single-card-single-target.py'
    if needle not in package:
        raise SystemExit(f'881 verify package wiring missing for {script}')

print('Verified SORIDRAW 881 3A isolation: one-card + one-target only; two-card, multi-target, Japanese audit and legacy retry paths preserved')
