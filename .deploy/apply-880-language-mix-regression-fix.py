from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_880_LANGUAGE_MIX_REGRESSION_FIX'
if marker in source:
    print('880 language mix regression fix already applied')
    raise SystemExit(0)

if 'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT' not in source:
    raise SystemExit('880 requires 877 runtime first')
if 'SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY' in source:
    raise SystemExit('880 must be applied from 877; remove failed 879 patch first')

# 1) Mark this bounded regression repair directly after the 877 marker.
anchor = "const SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;"
replacement = anchor + "\nconst SORIDRAW_880_LANGUAGE_MIX_REGRESSION_FIX = true;"
if source.count(anchor) != 1:
    raise SystemExit(f'880 marker anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 2) The ratio-completion pass was accidentally gated by the number of selected output cards.
#    Language mixing is a per-card feature, so every active mixed card needs the same bounded
#    deficit-completion pass whether one lyric card or two lyric cards are being generated.
old = """      const needsTwoLanguageCandidateExpansion = twoLanguageSelection
        && requestedRatio >= 10
        && requestedRatio <= 50
        && (applied.status !== 'applied' || !applied.ratioBandPassed || !targetCoverage.passed);
      if (needsTwoLanguageCandidateExpansion) {"""
new = """      const needsLanguageMixCandidateExpansion = requestedRatio >= 10
        && requestedRatio <= 50
        && (applied.status !== 'applied' || !applied.ratioBandPassed || !targetCoverage.passed);
      if (needsLanguageMixCandidateExpansion) {"""
if source.count(old) != 1:
    raise SystemExit(f'880 candidate-expansion gate mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

# 3) Keep the same strict acceptance rule for every mixed card. Do not silently expose a 3%,
#    10%, or 17% candidate when the selected 20-50% band was not reached.
old = """      if (twoLanguageSelection
        && requestedRatio >= 10
        && requestedRatio <= 50
        && (applied.status !== 'applied' || !applied.ratioBandPassed || !targetCoverage.passed)) {"""
new = """      if (requestedRatio >= 10
        && requestedRatio <= 50
        && (applied.status !== 'applied' || !applied.ratioBandPassed || !targetCoverage.passed)) {"""
if source.count(old) != 1:
    raise SystemExit(f'880 post-expansion acceptance gate mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

old = """      if (twoLanguageSelection
        && requestedRatio >= 10
        && requestedRatio <= 50
        && applied.status === 'applied'
        && (!applied.ratioBandPassed || !targetCoverage.passed)) {"""
new = """      if (requestedRatio >= 10
        && requestedRatio <= 50
        && applied.status === 'applied'
        && (!applied.ratioBandPassed || !targetCoverage.passed)) {"""
if source.count(old) != 1:
    raise SystemExit(f'880 post-hard-ban acceptance gate mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

# 4) Japanese final audit must never treat foreign-language mix lines as Japanese repair targets.
#    Only Japanese-only sung lines are auditable; mixed or foreign lines remain byte-for-byte untouched.
old = """function collectJapaneseNativeSemanticAuditLines(value: string): Array<{ lineIndex: number; text: string }> {
  return String(value || '')
    .replace(/\\r\\n?/g, '\\n')
    .split('\\n')
    .map((line, lineIndex) => ({ lineIndex, text: String(line || '').trim() }))
    .filter((item) => Boolean(item.text) && !isStandaloneSelectedLanguageCueLine(item.text));
}"""
new = """function collectJapaneseNativeSemanticAuditLines(value: string): Array<{ lineIndex: number; text: string }> {
  return String(value || '')
    .replace(/\\r\\n?/g, '\\n')
    .split('\\n')
    .map((line, lineIndex) => ({ lineIndex, text: String(line || '').trim() }))
    .filter((item) => {
      if (!item.text || isStandaloneSelectedLanguageCueLine(item.text)) return false;
      const counts = countSelectedLanguageScripts(item.text);
      return counts.kana > 0
        && counts.hangul === 0
        && counts.cyrillic === 0
        && counts.thai === 0
        && counts.latin < 3;
    });
}"""
if source.count(old) != 1:
    raise SystemExit(f'880 Japanese audit line filter mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

# 5) A mixed Japanese card is allowed to contain the selected mix languages. Validate only that
#    Japanese still exists after the audit; the mix engine owns ratio and language coverage.
old = """    if (!inspectSelectedLanguageBodyContract(auditedLyrics, 'ja').valid) {
      console.warn('[SORIDRAW 866 Japanese Audit] candidate rejected by selected-language contract');
      return result;
    }"""
new = """    const japaneseAuditCandidateValid = isV1LanguageMixEnabledForParams(params)
      ? hasExpectedSelectedLanguageScript(auditedLyrics, 'ja')
      : inspectSelectedLanguageBodyContract(auditedLyrics, 'ja').valid;
    if (!japaneseAuditCandidateValid) {
      console.warn('[SORIDRAW 866 Japanese Audit] candidate rejected by selected-language contract');
      return result;
    }"""
if source.count(old) != 1:
    raise SystemExit(f'880 Japanese audit candidate validation mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

# 6) The old 871 reservation is unnecessary for mixed cards now that 877 owns a dedicated audit
#    guard session. Never let Japanese auditing steal a normal post-mix correction slot.
old = """    if (hasAuditableJapaneseBodyAtFinalBoundary(guarded)) {
      reserveFinalJapaneseAuditRequest(auditSessionId);
    }"""
new = """    if (!isV1LanguageMixEnabledForParams(params) && hasAuditableJapaneseBodyAtFinalBoundary(guarded)) {
      reserveFinalJapaneseAuditRequest(auditSessionId);
    }"""
if source.count(old) != 1:
    raise SystemExit(f'880 Japanese reservation isolation mismatch: {source.count(old)}')
source = source.replace(old, new, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 880: restore per-card language-mix ratio completion and isolate Japanese audit from mixed lines')
