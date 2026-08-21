from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_876_JAPANESE_AUDIT_MICROTUNE'
if marker in source:
    print('876 Japanese audit microtune already applied')
    raise SystemExit(0)

if 'SORIDRAW_875_JAPANESE_AUDIT_QUALITY_TUNING' not in source:
    raise SystemExit('876 requires 875 Japanese audit quality tuning first')

marker_anchor = "const SORIDRAW_875_JAPANESE_AUDIT_QUALITY_TUNING = true;"
marker_replacement = marker_anchor + "\nconst SORIDRAW_876_JAPANESE_AUDIT_MICROTUNE = true;"
if source.count(marker_anchor) != 1:
    raise SystemExit(f'876 marker anchor mismatch: {source.count(marker_anchor)}')
source = source.replace(marker_anchor, marker_replacement, 1)

anchor = """AUDIT METHOD:\n- First read the whole supplied lyric once for scene, speaker, and recurring imagery."""
replacement = """MICRO-TUNING PRIORITIES — 876:\n- Distinguish intentional hook repetition from accidental local duplication. Repeated full hook lines, chorus callbacks, parallelism, anaphora, and rhythmic repetition may be deliberate and should be preserved. But duplicated nouns, particles, copulas, or short phrases inside the same local clause/phrase with no clear rhythmic or semantic function should be repaired.\n- For noun/verb and complement/predicate relations, judge native Japanese selection and attachment, not just dictionary meaning. If the predicate would not naturally take that subject/object/complement in the given scene, or the relation only becomes understandable after mentally translating from another language, repair it.\n- Prefer the smallest native correction that preserves the same image, speaker, tense, emotional direction, and song hook. Do not replace an unusual but coherent lyric image merely because a more ordinary phrase exists.\n- When a candidate could plausibly be either deliberate poetry or an error, keep it unless neighboring lines make the accidental relation clear.\n\nAUDIT METHOD:\n- First read the whole supplied lyric once for scene, speaker, and recurring imagery."""
if source.count(anchor) != 1:
    raise SystemExit(f'876 audit-method anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 876: micro-tuned accidental duplication and native collocation detection')
