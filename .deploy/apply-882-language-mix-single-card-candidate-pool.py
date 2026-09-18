from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_882_LANGUAGE_MIX_SINGLE_CARD_CANDIDATE_POOL'
if marker in source:
    print('882 single-card candidate pool already applied')
    raise SystemExit(0)
if 'SORIDRAW_881_LANGUAGE_MIX_SINGLE_CARD_SINGLE_TARGET' not in source:
    raise SystemExit('882 requires 881 runtime first')

anchor = 'const SORIDRAW_881_LANGUAGE_MIX_SINGLE_CARD_SINGLE_TARGET = true;'
if source.count(anchor) != 1:
    raise SystemExit('882 marker anchor mismatch')
source = source.replace(anchor, anchor + '\nconst SORIDRAW_882_LANGUAGE_MIX_SINGLE_CARD_CANDIDATE_POOL = true;', 1)

old = "const twoLanguageAdaptiveCandidateFloor = twoLanguageSelection && blockPlan.mode === 'adaptive-arrangement'"
new = "const twoLanguageAdaptiveCandidateFloor = (twoLanguageSelection || singleCardSingleTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
if source.count(old) != 1:
    raise SystemExit('882 adaptive candidate floor anchor mismatch')
source = source.replace(old, new, 1)

old = "const twoLanguageCandidatePoolContract = twoLanguageSelection && blockPlan.mode === 'adaptive-arrangement'"
new = "const twoLanguageCandidatePoolContract = (twoLanguageSelection || singleCardSingleTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
if source.count(old) != 1:
    raise SystemExit('882 candidate pool contract anchor mismatch')
source = source.replace(old, new, 1)

old = "${twoLanguageSelection && blockPlan.mode === 'adaptive-arrangement'"
new = "${(twoLanguageSelection || singleCardSingleTargetGuard) && blockPlan.mode === 'adaptive-arrangement'"
if source.count(old) != 1:
    raise SystemExit('882 adaptive instruction anchor mismatch')
source = source.replace(old, new, 1)

old = "const responseShapeExample = twoLanguageSelection"
new = "const responseShapeExample = compactJsonGuard"
if source.count(old) != 1:
    raise SystemExit('882 response shape anchor mismatch')
source = source.replace(old, new, 1)

old = "${twoLanguageSelection\n  ? '- In compact two-language output mode"
new = "${compactJsonGuard\n  ? '- In compact guarded output mode"
if source.count(old) != 1:
    raise SystemExit('882 compact output instruction anchor mismatch')
source = source.replace(old, new, 1)

old = "${twoLanguageSelection ? '' : ' meaningConnection and phoneticConnection are optional diagnostics only; they do not make a weak lyric acceptable.'}"
new = "${compactJsonGuard ? '' : ' meaningConnection and phoneticConnection are optional diagnostics only; they do not make a weak lyric acceptable.'}"
if source.count(old) != 1:
    raise SystemExit('882 optional diagnostics anchor mismatch')
source = source.replace(old, new, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 882: reuse the proven broad adaptive candidate-pool contract for one-card + one-target mixing')
