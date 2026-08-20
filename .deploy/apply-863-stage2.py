from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_863_SELECTED_LANGUAGE_CONTRACT_ALIGN'
if marker in source:
    print('863 selected-language contract alignment already applied')
    raise SystemExit(0)

if 'SORIDRAW_862_TARGETED_SELECTED_LANGUAGE_REPAIR' not in source:
    raise SystemExit('863 requires 862 targeted selected-language repair to run first')

# 1) Replace the old standalone body validator with a wrapper around one shared report.
start_token = 'function hasDominantSelectedLanguageBody(value: unknown, language: LanguageCode): boolean {'
end_token = '\nfunction getSelectedLanguageFallbackTitle(language: LanguageCode): string {'
start = source.find(start_token)
end = source.find(end_token, start)
if start < 0 or end < 0:
    raise SystemExit(f'863 validator anchor mismatch: start={start}, end={end}')
source = source[:start] + '''function hasDominantSelectedLanguageBody(value: unknown, language: LanguageCode): boolean {\n  return inspectSelectedLanguageBodyContract(value, language).valid;\n}\n''' + source[end:]

# 2) Insert the shared deterministic report immediately before the 862 line-target selector.
insert_token = 'function selectedLanguageSungLineNeedsRepair(value: string, language: LanguageCode): boolean {'
insert_at = source.find(insert_token)
if insert_at < 0:
    raise SystemExit('863 line selector anchor missing')

report_code = r'''const SORIDRAW_863_SELECTED_LANGUAGE_CONTRACT_ALIGN = true;

type SelectedLanguageBodyContractReport = {
  valid: boolean;
  reasons: string[];
  metrics: {
    recognized: number;
    targetScript: number;
    kana: number;
    han: number;
    latin: number;
    hangul: number;
    cyrillic: number;
    thai: number;
    targetShare: number;
    kanaShareWithinJapanese: number;
    foreignLatinSungLineCount: number;
  };
};

function inspectSelectedLanguageBodyContract(
  value: unknown,
  language: LanguageCode,
): SelectedLanguageBodyContractReport {
  const raw = String(value || '');
  const text = lyricBodyWithoutSectionCues(raw);
  const counts = countSelectedLanguageScripts(text);
  const baseMetrics = {
    recognized: 0,
    targetScript: 0,
    kana: counts.kana,
    han: counts.han,
    latin: counts.latin,
    hangul: counts.hangul,
    cyrillic: counts.cyrillic,
    thai: counts.thai,
    targetShare: 0,
    kanaShareWithinJapanese: 0,
    foreignLatinSungLineCount: 0,
  };

  if (!text.trim()) {
    return { valid: false, reasons: ['empty-body'], metrics: baseMetrics };
  }

  if (language !== 'ja') {
    const valid = hasExpectedSelectedLanguageScript(text, language);
    return {
      valid,
      reasons: valid ? [] : ['expected-script-missing'],
      metrics: {
        ...baseMetrics,
        recognized: text.replace(/\s/g, '').length,
      },
    };
  }

  const foreignLatinSungLineCount = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (isStandaloneSelectedLanguageCueLine(line)) return false;
      const lineCounts = countSelectedLanguageScripts(line);
      return lineCounts.latin >= 3 && (lineCounts.kana + lineCounts.han) === 0;
    }).length;

  const japanese = counts.kana + counts.han;
  const recognized = japanese + counts.hangul + counts.cyrillic + counts.thai + counts.latin;
  const targetShare = recognized > 0 ? japanese / recognized : 0;
  const kanaShareWithinJapanese = japanese > 0 ? counts.kana / japanese : 0;
  const reasons: string[] = [];

  if (foreignLatinSungLineCount > 0) reasons.push('foreign-latin-sung-line');
  if (recognized <= 0) reasons.push('recognized-script-empty');
  if (japanese < 12) reasons.push('japanese-script-below-minimum');
  if (counts.kana < 6) reasons.push('kana-below-minimum');
  if (targetShare < 0.78) reasons.push('japanese-share-below-0.78');
  if (kanaShareWithinJapanese < 0.10) reasons.push('kana-share-below-0.10');

  return {
    valid: reasons.length === 0,
    reasons,
    metrics: {
      ...baseMetrics,
      recognized,
      targetScript: japanese,
      targetShare,
      kanaShareWithinJapanese,
      foreignLatinSungLineCount,
    },
  };
}

'''
source = source[:insert_at] + report_code + source[insert_at:]

# 3) Every targeted repair sees the exact deterministic reason/metrics that will judge it.
before = "  const compactLyricContext = lyricBodyWithoutSectionCues(currentLyrics).slice(0, 1800);"
after = "  const validationReport = inspectSelectedLanguageBodyContract(currentLyrics, targetLanguage);\n  const compactLyricContext = lyricBodyWithoutSectionCues(currentLyrics).slice(0, 1800);"
if source.count(before) != 1:
    raise SystemExit(f'863 validation report insertion mismatch: {source.count(before)}')
source = source.replace(before, after, 1)

before = "        lyricContext: compactLyricContext,\n        repairLines: targets.map((item) => ({"
after = "        lyricContext: compactLyricContext,\n        validationFailureCodes: validationReport.reasons,\n        validationMetrics: validationReport.metrics,\n        repairLines: targets.map((item) => ({"
if source.count(before) != 1:
    raise SystemExit(f'863 repair payload mismatch: {source.count(before)}')
source = source.replace(before, after, 1)

before = "STRICT SCOPE CONTRACT — 862:\n- Rewrite ONLY the supplied repairLines. Do not regenerate the full lyric card."
after = """FULL-CARD VALIDATOR CONTRACT — 863:\n- The replacements are merged back into the original card and judged by the SAME deterministic contract reported in validationFailureCodes/validationMetrics.\n- For Japanese, sung text must remain Japanese-dominant: no standalone Latin/romaji sung line; at least 12 Japanese-script characters including at least 6 Kana; Japanese share at least 0.78 of recognized target/foreign script; Kana at least 0.10 of Japanese script.\n- Fix the reported contract failure naturally inside only the supplied lines. Do not pad with meaningless Kana, repeat phrases, or add filler just to satisfy counts.\n\nSTRICT SCOPE CONTRACT — 862:\n- Rewrite ONLY the supplied repairLines. Do not regenerate the full lyric card."""
if source.count(before) != 1:
    raise SystemExit(f'863 prompt contract mismatch: {source.count(before)}')
source = source.replace(before, after, 1)

# 4) Final rejection uses the same report and logs the exact deterministic reason.
before = """  if (!hasDominantSelectedLanguageBody(lyrics, targetLanguage)) {\n    throw new Error(`선택한 ${targetName} 가사 카드가 올바른 문자 체계/언어 비중으로 생성되지 않았습니다.`);\n  }"""
after = """  const finalLanguageContract = inspectSelectedLanguageBodyContract(lyrics, targetLanguage);\n  if (!finalLanguageContract.valid) {\n    console.warn('[SORIDRAW Selected Language Contract] recovery exhausted', {\n      targetLanguage,\n      reasons: finalLanguageContract.reasons,\n      metrics: finalLanguageContract.metrics,\n    });\n    throw new Error(`선택한 ${targetName} 가사 카드가 올바른 문자 체계/언어 비중으로 생성되지 않았습니다.`);\n  }"""
if source.count(before) != 1:
    raise SystemExit(f'863 final contract mismatch: {source.count(before)}')
source = source.replace(before, after, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 863 stage 2: shared selected-language repair/validator contract')
