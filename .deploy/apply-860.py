from pathlib import Path

p = Path('src/services/geminiService.ts')
s = p.read_text()

if '860: quality-invalid selected-language output gets one bounded strict recovery pass.' in s:
    raise SystemExit('860 already applied')

old = """  const parsed = parseGeminiJsonObject(response?.text || '{}');
  let lyrics = String(parsed?.lyrics || '').trim();
  let title = String(parsed?.title || '').trim().replace(/^['\"]+|['\"]+$/g, '');
  if (!hasDominantSelectedLanguageBody(lyrics, targetLanguage)) {
    throw new Error(`선택한 ${targetName} 가사 카드가 올바른 문자 체계/언어 비중으로 생성되지 않았습니다.`);
  }
  if (!hasExpectedSelectedLanguageScript(title, targetLanguage, true)) {
    title = getSelectedLanguageFallbackTitle(targetLanguage);
  }
"""

new = """  const parsed = parseGeminiJsonObject(response?.text || '{}');
  let lyrics = String(parsed?.lyrics || '').trim();
  let title = String(parsed?.title || '').trim().replace(/^['\"]+|['\"]+$/g, '');

  // 860: quality-invalid selected-language output gets one bounded strict recovery pass.
  // Normal cards still cost zero extra calls. This pass exists only when the first
  // recovery returned valid JSON but still failed the deterministic language gate.
  if (!hasDominantSelectedLanguageBody(lyrics, targetLanguage)) {
    const strictResponse = await generateContentWithModelFallback(
      ai,
      {
        model: 'gemini-3.5-flash-lite',
        contents: JSON.stringify({
          targetLanguage,
          targetLanguageName: targetName,
          invalidLyrics: lyrics || current,
          siblingLyrics: sibling,
        }),
        config: {
          systemInstruction: `You are SORIDRAW's FINAL selected-language lyric-card recovery pass.
This pass runs only because the previous recovery still failed the deterministic language validator.

NON-NEGOTIABLE OUTPUT CONTRACT:
- Target language: ${targetName}.
- Rewrite every sung lyric line in ${nativeScript}.
- Preserve standalone square-bracket section/performance/production cues, but never use Latin/English/romaji as sung lyric text when the target is Japanese.
- For Japanese, use natural modern Japanese with enough Hiragana/Katakana context around Kanji. Never return Kanji-only lyric lines and never leave English lexical ad-libs outside square brackets.
- Preserve section order, story direction, hook role, speaker identity, and approximate line breath.
- Prefer idiomatic native phrasing over literal translation. Do not explain.
- Return valid JSON only: { \"title\": \"...\", \"lyrics\": \"...\" }.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              lyrics: { type: Type.STRING },
            },
            required: ['title', 'lyrics'],
            additionalProperties: false,
          },
        },
      },
      'repairSelectedLanguageCardStrict',
      ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    );
    const strictParsed = parseGeminiJsonObject(strictResponse?.text || '{}');
    lyrics = String(strictParsed?.lyrics || '').trim();
    title = String(strictParsed?.title || '').trim().replace(/^['\"]+|['\"]+$/g, '');
  }

  if (!hasDominantSelectedLanguageBody(lyrics, targetLanguage)) {
    throw new Error(`선택한 ${targetName} 가사 카드가 올바른 문자 체계/언어 비중으로 생성되지 않았습니다.`);
  }
  if (!hasExpectedSelectedLanguageScript(title, targetLanguage, true)) {
    title = getSelectedLanguageFallbackTitle(targetLanguage);
  }
"""

if old not in s:
    raise SystemExit('860 recovery target not found')
s = s.replace(old, new, 1)

needle = """- Japanese must contain natural Hiragana/Katakana in the sung body; do not return romaji or Kanji-only lyric lines.
- Do not add an unselected lyric language.
"""
replacement = """- Japanese must contain natural Hiragana/Katakana in the sung body; do not return romaji or Kanji-only lyric lines.
- For Japanese, English is permitted only inside standalone square-bracket structural/production cues. Sung lines and parenthetical ad-libs must stay in Japanese script.
- For Japanese, prefer ordinary native collocations, particles, predicate pairings, and lyric sense-units; do not preserve foreign-language syntax just because the meaning is similar.
- Do not add an unselected lyric language.
"""
if needle not in s:
    raise SystemExit('860 contract target not found')
s = s.replace(needle, replacement, 1)

p.write_text(s)
