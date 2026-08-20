from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_864_JAPANESE_NATIVE_DRAFT_PASS'
if marker in source:
    print('864 Japanese native semantic drafting already applied')
    raise SystemExit(0)

if 'SORIDRAW_862_TARGETED_SELECTED_LANGUAGE_REPAIR' not in source:
    raise SystemExit('864 requires 862 targeted repair to run first')
if 'SORIDRAW_863_SELECTED_LANGUAGE_CONTRACT_ALIGN' not in source:
    raise SystemExit('864 requires 863 contract alignment to run first')

# 1) Strengthen the initial Japanese generation contract without adding another Gemini call.
anchor = "- Before finalizing, read each sung line as a standalone Japanese sentence fragment: the subject/object/location relationship must still make sense without relying on a source-language sentence that the listener cannot see.\n- Phrase by natural Japanese lyric sense-units rather than translating another language line-by-line. Favor everyday idiomatic combinations a native Japanese lyricist would plausibly sing, while keeping the lyric concise enough to sing naturally."
replacement = """- Before finalizing, read each sung line as a standalone Japanese sentence fragment: the subject/object/location relationship must still make sense without relying on a source-language sentence that the listener cannot see.
- 864 native drafting pass: build every Japanese sung line from the current scene directly in Japanese. Do not preserve foreign-language noun chains, modifier order, spatial relations, or clause logic merely because they are grammatically translatable.
- Prefer concrete verb-led Japanese phrasing, conventional particle/predicate pairings, and collocations that sound normal when spoken aloud by a contemporary native speaker.
- Silently re-read every Japanese sung line before returning JSON. Check modifier→noun fit, subject/object/location plausibility, ordinary Japanese collocation, semantic redundancy, hook clarity, and singable breath. Rewrite only lines that fail this native read-through; do not output the audit.
- If an abstract image is not immediately intelligible in Japanese, keep the same emotion and scene but express it through a concrete action, sensation, object, or observable change instead of forcing the abstraction into Japanese.
- Repetition is allowed when it functions as an intentional hook. Do not create near-duplicate lines or repeat the same image only because the wording changed slightly.
- Do not improve a weak line by inserting generic lyric vocabulary or unrelated emotion. Every image and feeling must stay grounded in the song's existing scene, speaker, and story.
- Phrase by natural Japanese lyric sense-units rather than translating another language line-by-line. Favor everyday idiomatic combinations a native Japanese lyricist would plausibly sing, while keeping the lyric concise enough to sing naturally."""
if source.count(anchor) != 1:
    raise SystemExit(f'864 initial Japanese guard anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 2) Make selected-language line repair obey the same native semantic standard.
anchor = "- For Japanese, write natural modern Japanese directly. No romaji, no standalone English lexical sung line, and no Korean/English sentence skeleton translated mechanically into Japanese.\n- Keep the original meaning, speaker, emotional direction, and approximate line breath."
replacement = """- For Japanese, write natural modern Japanese directly. No romaji, no standalone English lexical sung line, and no Korean/English sentence skeleton translated mechanically into Japanese.
- SORIDRAW_864_JAPANESE_NATIVE_DRAFT_PASS: when the target is Japanese, each replacement must sound independently natural when read aloud without seeing the source line. Preserve the scene and intent, but freely reorder, compress, or omit source-language information when that is necessary for native Japanese syntax.
- For Japanese replacements, verify modifier→noun and noun→predicate fit, natural particles, physically plausible subject/object/location relations, and ordinary contemporary collocation. Avoid abstract noun stacking, translated spatial logic, redundant meaning, or filler used only to sound poetic.
- Repeated wording is acceptable only when it is clearly functioning as the hook. Otherwise keep the replacement distinct from neighboring lines while preserving the same story role.
- Keep the original meaning, speaker, emotional direction, and approximate line breath."""
if source.count(anchor) != 1:
    raise SystemExit(f'864 targeted repair prompt anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 3) Apply the same principle when an entire selected-language card is genuinely missing.
anchor = "Write the sung lyric body in ${nativeScript}.\nPreserve the supplied section order and shared story/hook direction from siblingLyrics, but write natural independent ${targetName} rather than literal line-by-line translation."
replacement = """Write the sung lyric body in ${nativeScript}.
When the target language is Japanese, draft directly in contemporary Japanese: use native collocations, natural particles and predicates, concrete verb-led phrasing, and semantically plausible modifier/noun and subject/object/location relations. Silently re-read each sung line before returning JSON and rewrite any line that only works as a literal translation, abstract noun stack, redundant image, or unnatural Japanese collocation.
Preserve the supplied section order and shared story/hook direction from siblingLyrics, but write natural independent ${targetName} rather than literal line-by-line translation."""
if source.count(anchor) != 1:
    raise SystemExit(f'864 missing-card prompt anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 4) Strengthen Japanese title phrasing without changing validation or adding calls.
anchor = "- title must be a natural ${targetName} title based on lyricContext.\n- Return valid JSON only: { \"title\": \"...\", \"replacements\": [{ \"lineIndex\": 0, \"text\": \"...\" }] }."
replacement = """- title must be a natural ${targetName} title based on lyricContext. For Japanese, prefer a concise title that a native listener can understand immediately from the song's central scene or hook; do not translate another language's title mechanically.
- Return valid JSON only: { \"title\": \"...\", \"replacements\": [{ \"lineIndex\": 0, \"text\": \"...\" }] }."""
if source.count(anchor) != 1:
    raise SystemExit(f'864 title prompt anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 864 stage 3: Japanese native semantic drafting, no extra Gemini call')
