from pathlib import Path

p = Path('src/services/geminiService.ts')
s = p.read_text()

if '858: reject standalone Latin sung/ad-lib lines in strict Japanese cards' in s:
    raise SystemExit('858 already applied')

validator_needle = '''  // 856: Japanese needs a dominance check, not merely "some Kana exists".\n  // Count Kanji as Japanese only when the body also carries enough Kana context.\n  // This keeps normal Japanese lyrics (Kana + Kanji) valid while rejecting cases\n  // where an English lyric contains only a few isolated Japanese lines.\n  if (language === 'ja') {\n    const hangul = (text.match(/[가-힣]/g) || []).length;\n'''
validator_replacement = '''  // 856: Japanese needs a dominance check, not merely "some Kana exists".\n  // Count Kanji as Japanese only when the body also carries enough Kana context.\n  // This keeps normal Japanese lyrics (Kana + Kanji) valid while rejecting cases\n  // where an English lyric contains only a few isolated Japanese lines.\n  if (language === 'ja') {\n    // 858: reject standalone Latin sung/ad-lib lines in strict Japanese cards.\n    // Standalone square-bracket section/performance/production cues remain allowed.\n    const hasForeignLatinSungLine = String(value || '')\n      .split(/\\r?\\n/)\n      .map((line) => line.trim())\n      .filter(Boolean)\n      .some((line) => {\n        if (/^\\[[^\\]]+\\]$/.test(line)) return false;\n        const latinInLine = (line.match(/[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ]/g) || []).length;\n        const kanaInLine = (line.match(/[\\u3040-\\u30ff\\u31f0-\\u31ff]/g) || []).length;\n        const hanInLine = (line.match(/[\\u3400-\\u9fff]/g) || []).length;\n        return latinInLine >= 3 && (kanaInLine + hanInLine) === 0;\n      });\n    if (hasForeignLatinSungLine) return false;\n\n    const hangul = (text.match(/[가-힣]/g) || []).length;\n'''
if validator_needle not in s:
    raise SystemExit('858 validator target not found')
s = s.replace(validator_needle, validator_replacement, 1)

prompt_needle = '''- English is allowed only in standalone square-bracket section/performance/production cues; those cues are not sung lyric text.\n- Use natural modern Japanese orthography with Kana + Kanji as a native lyricist would. Do not force kana-only, kanji-only, romaji, or kanji-only wording.\n- Prefer concise, singable Japanese phrasing with natural particles and inflections. Avoid literal translationese and unnecessary English/katakana substitutions when ordinary Japanese is more natural.\n- Keep the same song meaning and section architecture, but phrase Japanese independently and naturally rather than translating another language line-by-line.\n'''
prompt_replacement = '''- English is allowed only in standalone square-bracket section/performance/production cues; those cues are not sung lyric text. Never write sung English words, English lexical ad-libs, or romaji outside those square brackets. Parenthetical sung/ad-lib text must use Japanese script or be omitted.\n- Use natural modern Japanese orthography with Kana + Kanji as a native lyricist would. Do not force kana-only, kanji-only, romaji, or kanji-only wording.\n- Prefer concise, singable Japanese phrasing with natural particles, inflections, ellipsis, and native word order. Use ordinary Japanese collocations; avoid literal translationese, semantically awkward modifier+noun pairings, and unnecessary English/katakana substitutions when ordinary Japanese is more natural.\n- Phrase by natural Japanese lyric sense-units rather than translating another language line-by-line. Favor everyday idiomatic combinations a native Japanese lyricist would plausibly sing.\n- Keep the same song meaning and section architecture, but let Japanese phrasing compress, omit, or reorder information naturally when needed for singing.\n'''
if prompt_needle not in s:
    raise SystemExit('858 prompt target not found')
s = s.replace(prompt_needle, prompt_replacement, 1)

p.write_text(s)
