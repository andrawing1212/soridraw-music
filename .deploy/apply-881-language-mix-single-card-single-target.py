from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_881_LANGUAGE_MIX_SINGLE_CARD_SINGLE_TARGET'
if marker in source:
    print('881 single-card single-target language mix guard already applied')
    raise SystemExit(0)

if 'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT' not in source:
    raise SystemExit('881 requires 877 runtime first')
if 'SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY' in source or 'SORIDRAW_880_LANGUAGE_MIX_REGRESSION_FIX' in source:
    raise SystemExit('881 must start from clean 877 runtime; failed 879/880 patches are not allowed')

# 0) Runtime marker: no functional change outside the language-mix function.
anchor = 'const SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;'
if source.count(anchor) != 1:
    raise SystemExit(f'881 marker anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, anchor + '\nconst SORIDRAW_881_LANGUAGE_MIX_SINGLE_CARD_SINGLE_TARGET = true;', 1)

# 1) Add one explicit guard bit to the locked rewrite request. It is set only by the
#    one-card + one-target path below. Existing two-card behavior remains keyed by the
#    original twoLanguageSelection variable.
anchor = """  sectionNames: string[];\n  parallelPair?: boolean;\n  candidateExpansion?: {"""
replacement = """  sectionNames: string[];\n  parallelPair?: boolean;\n  singleCardSingleTargetGuard?: boolean;\n  candidateExpansion?: {"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 request guard signature mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 2) Compact JSON/schema protection is extended ONLY to this one-card + one-target path.
#    Candidate planning/cleanup rules remain untouched; this section only hardens transport
#    and parse behavior that already protects the two-card path.
anchor = """  const twoLanguageSelection = isV1ExactlyTwoLanguageSelection(args.params);\n  const candidateExpansionMode = Boolean(args.candidateExpansion);"""
replacement = """  const twoLanguageSelection = isV1ExactlyTwoLanguageSelection(args.params);\n  const singleCardSingleTargetGuard = Boolean(args.singleCardSingleTargetGuard && args.targetLanguages.length === 1);\n  const compactJsonGuard = twoLanguageSelection || singleCardSingleTargetGuard;\n  const candidateExpansionMode = Boolean(args.candidateExpansion);"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 compact guard anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """  const responseMode = twoLanguageSelection\n    ? candidateExpansionMode"""
replacement = """  const responseMode = singleCardSingleTargetGuard\n    ? candidateExpansionMode\n      ? 'compact-schema-json-single-card-single-target-deficit-completion'\n      : 'compact-schema-json-single-card-single-target-guard'\n    : twoLanguageSelection\n    ? candidateExpansionMode"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 response mode anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """  const twoLanguageResponseSchema = twoLanguageSelection\n    ? {"""
replacement = """  const twoLanguageResponseSchema = compactJsonGuard\n    ? {"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 compact schema enable mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """      ...(twoLanguageSelection\n        ? {\n            responseMimeType: 'application/json',"""
replacement = """      ...(compactJsonGuard\n        ? {\n            responseMimeType: 'application/json',"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 json mime guard mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """      const schemaDispatchRejected = twoLanguageSelection\n        && dispatchCode === 400"""
replacement = """      const schemaDispatchRejected = compactJsonGuard\n        && dispatchCode === 400"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 schema fallback guard mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """      effectiveResponseMode = 'json-mime-two-language-schema-fallback';\n      activeGenerateParams = buildGenerateParams(false);"""
replacement = """      effectiveResponseMode = singleCardSingleTargetGuard\n        ? 'json-mime-single-card-single-target-schema-fallback'\n        : 'json-mime-two-language-schema-fallback';\n      activeGenerateParams = buildGenerateParams(false);"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 fallback response mode mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """    } catch (parseError) {\n      if (!twoLanguageSelection) throw parseError;\n      // 정확히 두 언어 경로에서만 JSON 파싱 실패를 현재 활성 출력 모드로 1회 재요청한다."""
replacement = """    } catch (parseError) {\n      if (!compactJsonGuard) throw parseError;\n      // 881: 기존 두 언어 경로와 1카드+1혼합 경로만 JSON 파싱 실패 시 같은 활성 출력 모드로 1회 재요청한다."""
if source.count(anchor) != 1:
    raise SystemExit(f'881 JSON parse retry guard mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 3) Identify the exact 3A path inside per-card processing. The boolean is true only when
#    the current song has one physical lyric card and that card has exactly one mix target.
anchor = """    try {\n      const parallelPair = twoLanguageSelection && cards.length === 2;\n      const response = await callV1LockedLanguageMixRewrite({"""
replacement = """    try {\n      const singleCardSingleTargetMix = cards.length === 1 && targetLanguages.length === 1;\n      const parallelPair = twoLanguageSelection && cards.length === 2;\n      const response = await callV1LockedLanguageMixRewrite({"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 single-card path anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """        sectionNames: expectedOrder,\n        parallelPair,\n      });"""
replacement = """        sectionNames: expectedOrder,\n        parallelPair,\n        singleCardSingleTargetGuard: singleCardSingleTargetMix,\n      });"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 initial rewrite call anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 4) Reuse the existing bounded deficit-completion pass for 3A. Existing two-card eligibility
#    is unchanged; the only added eligible case is one-card + one-target.
anchor = """      const needsTwoLanguageCandidateExpansion = twoLanguageSelection\n        && requestedRatio >= 10"""
replacement = """      const needsTwoLanguageCandidateExpansion = (twoLanguageSelection || singleCardSingleTargetMix)\n        && requestedRatio >= 10"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 deficit completion gate mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# Candidate expansion gets the same transport guard, but no new planning algorithm.
anchor = """          sectionNames: expectedOrder,\n          parallelPair,\n          candidateExpansion: {"""
replacement = """          sectionNames: expectedOrder,\n          parallelPair,\n          singleCardSingleTargetGuard: singleCardSingleTargetMix,\n          candidateExpansion: {"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 expansion rewrite call anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 5) Apply the existing strict post-expansion/post-hard-ban ratio gate to 3A only.
#    This prevents an under-filled 3%/17% candidate from being reported as successfully applied.
anchor = """      if (twoLanguageSelection\n        && requestedRatio >= 10\n        && requestedRatio <= 50\n        && (applied.status !== 'applied' || !applied.ratioBandPassed || !targetCoverage.passed)) {"""
replacement = """      if ((twoLanguageSelection || singleCardSingleTargetMix)\n        && requestedRatio >= 10\n        && requestedRatio <= 50\n        && (applied.status !== 'applied' || !applied.ratioBandPassed || !targetCoverage.passed)) {"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 post-expansion strict gate mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

anchor = """      if (twoLanguageSelection\n        && requestedRatio >= 10\n        && requestedRatio <= 50\n        && applied.status === 'applied'\n        && (!applied.ratioBandPassed || !targetCoverage.passed)) {"""
replacement = """      if ((twoLanguageSelection || singleCardSingleTargetMix)\n        && requestedRatio >= 10\n        && requestedRatio <= 50\n        && applied.status === 'applied'\n        && (!applied.ratioBandPassed || !targetCoverage.passed)) {"""
if source.count(anchor) != 1:
    raise SystemExit(f'881 post-hard-ban strict gate mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 881 3A: isolated one-card + one-target language-mix transport and bounded ratio completion')
