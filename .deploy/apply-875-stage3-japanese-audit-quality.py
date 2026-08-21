from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_875_JAPANESE_AUDIT_QUALITY_TUNING'
if marker in source:
    print('875 Japanese audit quality tuning already applied')
    raise SystemExit(0)

if 'SORIDRAW_866_JAPANESE_NATIVE_SEMANTIC_AUDIT' not in source:
    raise SystemExit('875 requires the Japanese native semantic audit to be applied first')

marker_anchor = "const SORIDRAW_866_JAPANESE_NATIVE_SEMANTIC_AUDIT = true;"
marker_replacement = marker_anchor + "\nconst SORIDRAW_875_JAPANESE_AUDIT_QUALITY_TUNING = true;"
if source.count(marker_anchor) != 1:
    raise SystemExit(f'875 marker anchor mismatch: {source.count(marker_anchor)}')
source = source.replace(marker_anchor, marker_replacement, 1)

purpose_old = """PURPOSE — 866:\n- Review ONLY the supplied Japanese sung lines after the song is otherwise complete.\n- Return replacements ONLY for high-confidence native-Japanese semantic/collocation errors.\n- If a line is already natural Japanese, leave it unchanged by omitting it from replacements.\n- When uncertain, KEEP the original line."""
purpose_new = """PURPOSE — 875 QUALITY TUNING:\n- Review ONLY the supplied Japanese sung lines after the song is otherwise complete.\n- Act like a careful native Japanese lyric editor, not a literal-meaning checker.\n- Repair clear native-Japanese drafting defects that a native editor would confidently correct, including subtle but unmistakable unnaturalness.\n- If a line is already natural Japanese, leave it unchanged by omitting it from replacements.\n- When genuinely uncertain whether something is an intentional lyric image, KEEP the original line."""
if source.count(purpose_old) != 1:
    raise SystemExit(f'875 purpose anchor mismatch: {source.count(purpose_old)}')
source = source.replace(purpose_old, purpose_new, 1)

poetic_old = """POETIC LANGUAGE MUST BE PRESERVED:\n- Do NOT reject a line merely because its literal physical action is impossible.\n- Natural metaphor, personification, symbolism, synesthesia, compressed lyric grammar, and image-based phrasing are valid when a native Japanese listener can reasonably read them as deliberate poetic expression.\n- Judge the distinction a native lyric editor would make: \"intentional poetic image\" = keep; \"words attached in a way that feels like an AI relation/collocation mistake\" = repair.\n- Never flatten a good poetic line into ordinary explanatory prose just to make it literal."""
poetic_new = """POETIC LANGUAGE MUST BE PRESERVED:\n- Do NOT reject a line merely because its literal physical action is impossible.\n- Natural metaphor, personification, symbolism, synesthesia, compressed lyric grammar, fragments, and image-based phrasing are valid when a native Japanese listener can immediately read them as deliberate lyric expression.\n- Judge the distinction a native lyric editor would make: emotionally coherent intentional image = keep; accidental dependency/collocation artifact = repair.\n- An unusual expression is not an error by itself. If its image, emotion, and grammatical relation are naturally understandable in Japanese lyric context, keep it.\n- Never flatten a good poetic line into ordinary explanatory prose just to make it literal."""
if source.count(poetic_old) != 1:
    raise SystemExit(f'875 poetic anchor mismatch: {source.count(poetic_old)}')
source = source.replace(poetic_old, poetic_new, 1)

failures_old = """REPAIR ONLY HIGH-CONFIDENCE FAILURES SUCH AS:\n- a predicate taking a subject/object/location/case particle that native Japanese would not naturally assign to it;\n- a modifier/head noun or verb/noun collocation that sounds non-native rather than intentionally poetic;\n- a hidden Korean/English clause relation that must be mentally translated back before the Japanese makes sense;\n- an accidental semantic contradiction or missing predicate argument that reads as generation error, not purposeful ambiguity."""
failures_new = """REPAIR CLEAR NATIVE-JAPANESE DRAFTING DEFECTS SUCH AS:\n- accidental lexical, particle, copula, or phrase duplication that reads as a generation artifact rather than intentional hook repetition;\n- a predicate taking a subject, object, location, complement, or case particle that native Japanese would not naturally assign to it;\n- a modifier attaching to the wrong head, or a noun/verb, adjective/noun, or noun/noun collocation that feels non-native rather than intentionally poetic;\n- an incomplete or dangling relation where a phrase is grammatically present but its semantic attachment is unclear or unnatural in the surrounding line context;\n- a hidden Korean/English clause relation or source-language calque that must be mentally translated back before the Japanese makes sense;\n- an accidental subject/reference shift, semantic contradiction, or missing predicate argument that reads as generation error rather than purposeful ambiguity;\n- a locally awkward wording that a native lyric editor would plainly smooth while preserving the same image and meaning.\n\nAUDIT METHOD:\n- First read the whole supplied lyric once for scene, speaker, and recurring imagery.\n- Then inspect every sung line together with its neighboring lines; do not judge isolated words mechanically.\n- Before replacing a line, make one final check: could a native listener reasonably hear the original as deliberate poetic compression, metaphor, personification, or hook repetition? If yes, omit the replacement.\n- Prefer a minimal local correction over rewriting a full line whenever possible."""
if source.count(failures_old) != 1:
    raise SystemExit(f'875 failures anchor mismatch: {source.count(failures_old)}')
source = source.replace(failures_old, failures_new, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 875: stronger native-Japanese defect detection with poetic-language protection')
