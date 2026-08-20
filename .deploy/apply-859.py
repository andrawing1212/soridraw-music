from pathlib import Path

p = Path('src/services/geminiService.ts')
s = p.read_text()

if '859: native Japanese collocation and syntax guard' in s:
    raise SystemExit('859 already applied')

needle = '''- Prefer concise, singable Japanese phrasing with natural particles, inflections, ellipsis, and native word order. Use ordinary Japanese collocations; avoid literal translationese, semantically awkward modifier+noun pairings, and unnecessary English/katakana substitutions when ordinary Japanese is more natural.\n- Phrase by natural Japanese lyric sense-units rather than translating another language line-by-line. Favor everyday idiomatic combinations a native Japanese lyricist would plausibly sing.\n- Keep the same song meaning and section architecture, but let Japanese phrasing compress, omit, or reorder information naturally when needed for singing.\n'''
replacement = '''- Prefer concise, singable Japanese phrasing with natural particles, inflections, ellipsis, and native word order. Use ordinary Japanese collocations; avoid literal translationese, semantically awkward modifier+noun pairings, and unnecessary English/katakana substitutions when ordinary Japanese is more natural.\n- 859: native Japanese collocation and syntax guard. Compose each sung line directly in Japanese rather than using Korean/English clause order as a scaffold. Choose predicates, particles, modifiers, and noun-verb combinations that are conventional in contemporary Japanese.\n- Before finalizing a line, make sure its modifier→noun and noun→predicate relationships are semantically natural in Japanese, not merely grammatically possible. Prefer verb-centered Japanese phrasing over stacked abstract nouns or mechanically translated spatial/quantity relations.\n- If a metaphor or image feels translated, over-explained, or semantically forced, rewrite it with a simpler everyday Japanese collocation that preserves the scene and emotion. Do not preserve source-language structure at the cost of natural Japanese.\n- Phrase by natural Japanese lyric sense-units rather than translating another language line-by-line. Favor everyday idiomatic combinations a native Japanese lyricist would plausibly sing, while keeping the lyric concise enough to sing naturally.\n- Keep the same song meaning and section architecture, but let Japanese phrasing compress, omit, or reorder information naturally when needed for singing.\n'''
if needle not in s:
    raise SystemExit('859 target not found')
s = s.replace(needle, replacement, 1)
p.write_text(s)
