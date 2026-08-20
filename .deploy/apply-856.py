from pathlib import Path

p = Path('src/services/geminiService.ts')
s = p.read_text()
marker = "function getSelectedLanguageFallbackTitle(language: LanguageCode): string {"

if 'function hasDominantSelectedLanguageBody(' not in s:
    helper = r'''function hasDominantSelectedLanguageBody(value: unknown, language: LanguageCode): boolean {
  const text = lyricBodyWithoutSectionCues(value);
  if (!text.trim()) return false;

  // 856: Japanese needs a dominance check, not merely "some Kana exists".
  // Count Kanji as Japanese only when the body also carries enough Kana context.
  // This keeps normal Japanese lyrics (Kana + Kanji) valid while rejecting cases
  // where an English lyric contains only a few isolated Japanese lines.
  if (language === 'ja') {
    const hangul = (text.match(/[가-힣]/g) || []).length;
    const kana = (text.match(/[\u3040-\u30ff\u31f0-\u31ff]/g) || []).length;
    const han = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const cyrillic = (text.match(/[\u0400-\u04ff]/g) || []).length;
    const thai = (text.match(/[\u0e00-\u0e7f]/g) || []).length;
    const latin = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ]/g) || []).length;
    const japanese = kana + han;
    const recognized = japanese + hangul + cyrillic + thai + latin;
    if (recognized <= 0 || japanese < 12 || kana < 6) return false;

    const japaneseShare = japanese / recognized;
    const kanaShareWithinJapanese = japanese > 0 ? kana / japanese : 0;
    return japaneseShare >= 0.78 && kanaShareWithinJapanese >= 0.10;
  }

  return hasExpectedSelectedLanguageScript(text, language);
}

'''
    if marker not in s:
        raise SystemExit('856 marker not found')
    s = s.replace(marker, helper + marker, 1)

old = "if (!hasExpectedSelectedLanguageScript(lyrics, targetLanguage)) {\n    throw new Error(`선택한 ${targetName} 가사 카드가 올바른 문자 체계로 생성되지 않았습니다.`);\n  }"
new = "if (!hasDominantSelectedLanguageBody(lyrics, targetLanguage)) {\n    throw new Error(`선택한 ${targetName} 가사 카드가 올바른 문자 체계/언어 비중으로 생성되지 않았습니다.`);\n  }"
if old not in s:
    raise SystemExit('856 repair validation target not found')
s = s.replace(old, new, 1)

old = '''  const next: SongResult = {
    ...result,
    lyrics: { ...result.lyrics },
    appliedKeywords: { ...(result.appliedKeywords || {}) },
  };

  // The existing generator writes the first non-Korean selection into the legacy
'''
new = '''  const next: SongResult = {
    ...result,
    lyrics: { ...result.lyrics },
    appliedKeywords: { ...(result.appliedKeywords || {}) },
  };
  const intentionalLanguageMix = isV1LanguageMixEnabledForParams(params);
  const selectedBodyMatches = (lyrics: string, target: LanguageCode) =>
    intentionalLanguageMix
      ? hasExpectedSelectedLanguageScript(lyrics, target)
      : hasDominantSelectedLanguageBody(lyrics, target);

  // The existing generator writes the first non-Korean selection into the legacy
'''
if old not in s:
    raise SystemExit('856 selected-language enforcement target not found')
s = s.replace(old, new, 1)

needle = "if (!hasExpectedSelectedLanguageScript(current, target)) {"
if s.count(needle) != 2:
    raise SystemExit(f'856 expected 2 selected-card checks, found {s.count(needle)}')
s = s.replace(needle, "if (!selectedBodyMatches(current, target)) {", 2)
p.write_text(s)
