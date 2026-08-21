from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')

required = [
    'SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY',
    'async function applyV1LockedWholeLyricLanguageMix(',
    'two-language-ratio-band-not-met-visible-candidate-kept',
    'two-language-ratio-band-lost-after-hard-ban-refit-visible-candidate-kept',
    'targetLanguages.length > 1',
]
missing = [item for item in required if item not in source]
if missing:
    raise SystemExit(f'879 verification failed; missing: {missing}')

if 'const AUTO_LANGUAGE_MIX_RETRY_ENABLED = false;' not in source:
    raise SystemExit('879 verification failed: superseded legacy mix retry was unexpectedly enabled')
if 'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT' not in source:
    raise SystemExit('879 verification failed: 877 Japanese audit slot missing')
if source.count('SORIDRAW_879_LANGUAGE_MIX_ACTIVE_RECOVERY') != 1:
    raise SystemExit('879 verification failed: marker count mismatch')

print('SORIDRAW 879 verification OK: active language mix restored; legacy duplicate retry remains off; 877 audit slot preserved')
