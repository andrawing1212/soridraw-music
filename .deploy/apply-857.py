from pathlib import Path

p = Path('src/services/geminiService.ts')
s = p.read_text()

if 'JAPANESE FIRST-PASS LYRIC CONTRACT (MANDATORY)' in s:
    raise SystemExit('857 already applied')

needle = '''  const requestedLanguageInstruction = effectiveNoLyrics
    ? ""
    : `OUTPUT LANGUAGE RULE (MANDATORY):
'''
insert = '''  const selectedLanguageSlotsForInitialPass = getV1SelectedLyricSlotLanguages(params);
  const japaneseInitialLyricSlot = selectedLanguageSlotsForInitialPass.englishSlotLanguage === 'ja'
    ? 'lyrics.english'
    : selectedLanguageSlotsForInitialPass.koreanSlotLanguage === 'ja'
      ? 'lyrics.korean'
      : null;
  const japaneseFirstPassLanguageContract = !effectiveNoLyrics
    && !shouldUseMixedLyrics
    && requestedLyricLanguages.includes('ja')
    && japaneseInitialLyricSlot
    ? `JAPANESE FIRST-PASS LYRIC CONTRACT (MANDATORY):
- ${japaneseInitialLyricSlot} is the selected Japanese SUNG-LYRIC card. Write its sung body in Japanese correctly on the FIRST generation pass so a recovery rewrite is normally unnecessary.
- Every sung lyric line in that card must be natural, idiomatic Japanese. Do not write full English lyric lines or an English sentence skeleton with only a few Japanese phrases inserted.
- English is allowed only in standalone square-bracket section/performance/production cues; those cues are not sung lyric text.
- Use natural modern Japanese orthography with Kana + Kanji as a native lyricist would. Do not force kana-only, kanji-only, romaji, or kanji-only wording.
- Prefer concise, singable Japanese phrasing with natural particles and inflections. Avoid literal translationese and unnecessary English/katakana substitutions when ordinary Japanese is more natural.
- Keep the same song meaning and section architecture, but phrase Japanese independently and naturally rather than translating another language line-by-line.
- The Japanese sung body must be clearly Japanese-dominant enough to pass selected-language validation without repairSelectedLanguageCard.`
    : '';

'''

if needle not in s:
    raise SystemExit('857 requestedLanguageInstruction target not found')
s = s.replace(needle, insert + needle, 1)

anchor = '''- Do NOT write Japanese as romaji, Chinese as pinyin, Thai as romanized Thai, or Russian as Latin transliteration. Use the native script.
- ${titleFormatInstruction}
'''
replacement = '''- Do NOT write Japanese as romaji, Chinese as pinyin, Thai as romanized Thai, or Russian as Latin transliteration. Use the native script.
${japaneseFirstPassLanguageContract}
- ${titleFormatInstruction}
'''
if anchor not in s:
    raise SystemExit('857 language instruction anchor not found')
s = s.replace(anchor, replacement, 1)

p.write_text(s)
