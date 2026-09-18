from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_865_JAPANESE_NATIVE_RELATION_FINAL'
if marker in source:
    print('865 Japanese native relation/collocation final pass already applied')
    raise SystemExit(0)

if 'SORIDRAW_864_JAPANESE_NATIVE_DRAFT_PASS' not in source:
    raise SystemExit('865 requires 864 Japanese native drafting to run first')

# 865 stays inside the existing generation/repair calls. It adds no Gemini request,
# no phrase blacklist, and no scene-specific answer. It only tightens the native
# Japanese relation/collocation self-check used before JSON is returned.

# 1) Initial Japanese generation: strengthen predicate/argument and collocation review.
anchor = "- Silently re-read every Japanese sung line before returning JSON. Check modifier→noun fit, subject/object/location plausibility, ordinary Japanese collocation, semantic redundancy, hook clarity, and singable breath. Rewrite only lines that fail this native read-through; do not output the audit."
replacement = """- Silently re-read every Japanese sung line before returning JSON. Check modifier→noun fit, subject/object/location plausibility, ordinary Japanese collocation, semantic redundancy, hook clarity, and singable breath. Rewrite only lines that fail this native read-through; do not output the audit.
- SORIDRAW_865_JAPANESE_NATIVE_RELATION_FINAL: for each Japanese sung line, identify the main predicate and verify that its subject, object, destination/location, state, and case particles are relations a native speaker would naturally assign to that predicate. If the relation is only technically grammatical or only makes sense after translating it back into another language, rewrite the line in native Japanese while preserving the same scene and intent.
- Verify modifier→head-noun compatibility and verb/noun collocation as spoken contemporary Japanese, not dictionary-level word compatibility. Prefer the simplest native relation that carries the intended image over a poetic-looking but unusual combination.
- Check physical and temporal plausibility inside the current scene: actions must have a plausible actor/object/place, sensations must belong to something that can naturally carry them, and neighboring clauses must connect without a hidden source-language premise.
- Do not solve this check with stock lyric vocabulary, generic emotion, extra abstraction, or a canned phrase. The corrected line must remain specific to the existing scene, speaker, and narrative role."""
if source.count(anchor) != 1:
    raise SystemExit(f'865 initial relation-check anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 2) Targeted selected-language repair: use the exact same native relation standard.
anchor = "- For Japanese replacements, verify modifier→noun and noun→predicate fit, natural particles, physically plausible subject/object/location relations, and ordinary contemporary collocation. Avoid abstract noun stacking, translated spatial logic, redundant meaning, or filler used only to sound poetic."
replacement = """- For Japanese replacements, verify modifier→noun and noun→predicate fit, natural particles, physically plausible subject/object/location relations, and ordinary contemporary collocation. Avoid abstract noun stacking, translated spatial logic, redundant meaning, or filler used only to sound poetic.
- SORIDRAW_865_JAPANESE_NATIVE_RELATION_FINAL: before returning a Japanese replacement, identify its main predicate and confirm that every attached subject/object/location/state and case particle forms a relation a native Japanese speaker would actually use. Reject combinations that are merely grammatically possible but pragmatically odd, semantically mismatched, or dependent on another language's clause structure.
- Check the replacement as one spoken lyric line and against its supplied before/after context. Keep the original story role, but choose native Japanese collocations and predicate frames even when that requires reordering or compressing the source idea.
- Never repair by inserting a memorized phrase, a generic poetic noun, or a fixed answer for a scene. Generate the wording from the current context each time."""
if source.count(anchor) != 1:
    raise SystemExit(f'865 targeted repair relation anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 3) Missing-card recovery: same relation/collocation pass, still no extra call.
anchor = "When the target language is Japanese, draft directly in contemporary Japanese: use native collocations, natural particles and predicates, concrete verb-led phrasing, and semantically plausible modifier/noun and subject/object/location relations. Silently re-read each sung line before returning JSON and rewrite any line that only works as a literal translation, abstract noun stack, redundant image, or unnatural Japanese collocation."
replacement = """When the target language is Japanese, draft directly in contemporary Japanese: use native collocations, natural particles and predicates, concrete verb-led phrasing, and semantically plausible modifier/noun and subject/object/location relations. Silently re-read each sung line before returning JSON and rewrite any line that only works as a literal translation, abstract noun stack, redundant image, or unnatural Japanese collocation.
SORIDRAW_865_JAPANESE_NATIVE_RELATION_FINAL: in that silent read-through, verify each line's main predicate against its subject/object/location/state and particles, plus modifier/head-noun and verb/noun collocation. Rewrite any relation that a native speaker would find pragmatically odd even if the grammar is technically legal. Preserve the same scene and intent; do not substitute generic lyric language or canned phrases."""
if source.count(anchor) != 1:
    raise SystemExit(f'865 missing-card relation anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 865 stage 3 final: Japanese native relation/collocation review, no extra Gemini call')
