from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_885_LANGUAGE_MIX_SINGLE_CARD_TWO_TARGET'
if marker in source:
    print('885 single-card two-target language mix guard already applied')
    raise SystemExit(0)

if 'SORIDRAW_883_LANGUAGE_MIX_AUDIT_GROUPING' not in source:
    raise SystemExit('885 requires 883 runtime first')
if 'SORIDRAW_881_LANGUAGE_MIX_SINGLE_CARD_SINGLE_TARGET' not in source:
    raise SystemExit('885 requires 881 runtime first')
if 'SORIDRAW_882_LANGUAGE_MIX_SINGLE_CARD_CANDIDATE_POOL' not in source:
    raise SystemExit('885 requires 882 runtime first')

# Runtime marker.
anchor = 'const SORIDRAW_882_LANGUAGE_MIX_SINGLE_CARD_CANDIDATE_POOL = true;'
if source.count(anchor) != 1:
    raise SystemExit(f'885 marker anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, anchor + '\nconst SORIDRAW_885_LANGUAGE_MIX_SINGLE_CARD_TWO_TARGET = true;', 1)

# Add an explicit request guard only for one physical card + exactly two mix targets.
anchor = """  parallelPair?: boolean;\n  singleCardSingleTargetGuard?: boolean;\n  candidateExpansion?: {"""
replacement = """  parallelPair?: boolean;\n  singleCardSingleTargetGuard?: boolean;\n  singleCardTwoTargetGuard?: boolean;\n  candidateExpansion?: {"""
if source.count(anchor) != 1:
    raise SystemExit(f'885 request guard signature mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# Reuse the already-proven compact JSON transport and broad candidate pool only for 1-card + 2-target.
anchor = """  const singleCardSingleTargetGuard = Boolean(args.singleCardSingleTargetGuard && args.targetLanguages.length === 1);\n  const compactJsonGuard = twoLanguageSelection || singleCardSingleTargetGuard;"""
replacement = """  const singleCardSingleTargetGuard = Boolean(args.singleCardSingleTargetGuard && args.targetLanguages.length === 1);\n  const singleCardTwoTargetGuard = Boolean(args.singleCardTwoTargetGuard && args.targetLanguages.length === 2);\n  const compactJsonGuard = twoLanguageSelection || singleCardSingleTargetGuard || singleCardTwoTargetGuard;"""
if source.count(anchor) != 1:
    raise SystemExit(f'885 compact guard anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

old = "const twoLanguageAdaptiveCandidateFloor = (twoLanguageSelection || singleCardSingleTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
new = "const twoLanguageAdaptiveCandidateFloor = (twoLanguageSelection || singleCardSingleTargetGuard || singleCardTwoTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
if source.count(old) != 1:
    raise SystemExit(f'885 adaptive candidate floor mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

anchor = """  const responseMode = singleCardSingleTargetGuard\n    ? candidateExpansionMode"""
replacement = """  const responseMode = singleCardTwoTargetGuard\n    ? candidateExpansionMode\n      ? 'compact-schema-json-single-card-two-target-deficit-completion'\n      : 'compact-schema-json-single-card-two-target-guard'\n    : singleCardSingleTargetGuard\n    ? candidateExpansionMode"""
if source.count(anchor) != 1:
    raise SystemExit(f'885 response mode anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

old = "const twoLanguageCandidatePoolContract = (twoLanguageSelection || singleCardSingleTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
new = "const twoLanguageCandidatePoolContract = (twoLanguageSelection || singleCardSingleTargetGuard || singleCardTwoTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
if source.count(old) != 1:
    raise SystemExit(f'885 candidate pool contract mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

old = "${(twoLanguageSelection || singleCardSingleTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
new = "${(twoLanguageSelection || singleCardSingleTargetGuard || singleCardTwoTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
if source.count(old) != 1:
    raise SystemExit(f'885 adaptive instruction mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

anchor = """      effectiveResponseMode = singleCardSingleTargetGuard\n        ? 'json-mime-single-card-single-target-schema-fallback'\n        : 'json-mime-two-language-schema-fallback';"""
replacement = """      effectiveResponseMode = singleCardTwoTargetGuard\n        ? 'json-mime-single-card-two-target-schema-fallback'\n        : singleCardSingleTargetGuard\n          ? 'json-mime-single-card-single-target-schema-fallback'\n          : 'json-mime-two-language-schema-fallback';"""
if source.count(anchor) != 1:
    raise SystemExit(f'885 schema fallback mode mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# Identify the 3B path without changing 3A or two-card routing.
anchor = """      const singleCardSingleTargetMix = cards.length === 1 && targetLanguages.length === 1;\n      const parallelPair = twoLanguageSelection && cards.length === 2;"""
replacement = """      const singleCardSingleTargetMix = cards.length === 1 && targetLanguages.length === 1;\n      const singleCardTwoTargetMix = cards.length === 1 && targetLanguages.length === 2;\n      const parallelPair = twoLanguageSelection && cards.length === 2;"""
if source.count(anchor) != 1:
    raise SystemExit(f'885 3B path anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """        parallelPair,\n        singleCardSingleTargetGuard: singleCardSingleTargetMix,\n      });"""
replacement = """        parallelPair,\n        singleCardSingleTargetGuard: singleCardSingleTargetMix,\n        singleCardTwoTargetGuard: singleCardTwoTargetMix,\n      });"""
if source.count(anchor) != 1:
    raise SystemExit(f'885 initial rewrite guard wiring mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# Reuse the existing single bounded deficit-completion pass for 1-card + 2-target.
old = "const needsTwoLanguageCandidateExpansion = (twoLanguageSelection || singleCardSingleTargetMix)"
new = "const needsTwoLanguageCandidateExpansion = (twoLanguageSelection || singleCardSingleTargetMix || singleCardTwoTargetMix)"
if source.count(old) != 1:
    raise SystemExit(f'885 expansion gate mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

anchor = """          parallelPair,\n          singleCardSingleTargetGuard: singleCardSingleTargetMix,\n          candidateExpansion: {"""
replacement = """          parallelPair,\n          singleCardSingleTargetGuard: singleCardSingleTargetMix,\n          singleCardTwoTargetGuard: singleCardTwoTargetMix,\n          candidateExpansion: {"""
if source.count(anchor) != 1:
    raise SystemExit(f'885 expansion guard wiring mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

old = "if ((twoLanguageSelection || singleCardSingleTargetMix)\n        && requestedRatio >= 10"
new = "if ((twoLanguageSelection || singleCardSingleTargetMix || singleCardTwoTargetMix)\n        && requestedRatio >= 10"
count = source.count(old)
if count != 2:
    raise SystemExit(f'885 strict ratio gates mismatch: {count}')
source = source.replace(old, new, 2)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 885: one-card + two-target uses proven compact transport, broad candidate pool, and one bounded deficit-completion pass')
