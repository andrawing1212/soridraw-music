from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')

required = [
    'SORIDRAW_876_JAPANESE_AUDIT_MICROTUNE',
    'MICRO-TUNING PRIORITIES — 876:',
    'Distinguish intentional hook repetition from accidental local duplication.',
    'For noun/verb and complement/predicate relations, judge native Japanese selection and attachment',
    'Prefer the smallest native correction that preserves the same image, speaker, tense, emotional direction, and song hook.',
]
missing = [item for item in required if item not in source]
if missing:
    raise SystemExit(f'876 Japanese audit microtune verification failed; missing: {missing}')

if source.count('SORIDRAW_876_JAPANESE_AUDIT_MICROTUNE') != 1:
    raise SystemExit('876 Japanese audit microtune marker count mismatch')

print('SORIDRAW 876 Japanese audit microtune verification OK')
