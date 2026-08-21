from pathlib import Path

source = Path('src/services/geminiService.ts').read_text(encoding='utf-8')
required = [
    'SORIDRAW_885_LANGUAGE_MIX_SINGLE_CARD_TWO_TARGET',
    'singleCardTwoTargetGuard?: boolean;',
    'args.singleCardTwoTargetGuard && args.targetLanguages.length === 2',
    'twoLanguageSelection || singleCardSingleTargetGuard || singleCardTwoTargetGuard',
    'compact-schema-json-single-card-two-target-deficit-completion',
    'const singleCardTwoTargetMix = cards.length === 1 && targetLanguages.length === 2;',
    'singleCardTwoTargetGuard: singleCardTwoTargetMix',
    'twoLanguageSelection || singleCardSingleTargetMix || singleCardTwoTargetMix',
]
missing = [item for item in required if item not in source]
if missing:
    raise SystemExit(f'885 verification failed; missing: {missing}')

for item in [
    'const singleCardSingleTargetMix = cards.length === 1 && targetLanguages.length === 1;',
    'const parallelPair = twoLanguageSelection && cards.length === 2;',
    'const AUTO_LANGUAGE_MIX_RETRY_ENABLED = false;',
]:
    if item not in source:
        raise SystemExit(f'885 isolation check failed: {item}')

print('Verified SORIDRAW 885: 1-card + 2-target only, with 3A/two-card/legacy retry isolation intact')
