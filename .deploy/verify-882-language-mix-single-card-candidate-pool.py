from pathlib import Path
s = Path('src/services/geminiService.ts').read_text(encoding='utf-8')
required = [
    'SORIDRAW_882_LANGUAGE_MIX_SINGLE_CARD_CANDIDATE_POOL',
    "(twoLanguageSelection || singleCardSingleTargetGuard) && blockPlan.mode === 'adaptive-arrangement'",
    'const responseShapeExample = compactJsonGuard',
    'compact guarded output mode',
]
for item in required:
    if item not in s:
        raise SystemExit(f'882 verify missing: {item}')
if 'SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY' in s or 'SORIDRAW_880_LANGUAGE_MIX_REGRESSION_FIX' in s:
    raise SystemExit('882 verify failed: old failed patch marker present')
for item in ['Promise.all(', 'auditJapaneseNativeSemanticsAtFinalBoundary', 'args.targetLanguages.length > 1']:
    if item not in s:
        raise SystemExit(f'882 protected-path anchor missing: {item}')
print('882 verifier passed')
