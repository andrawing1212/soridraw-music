from pathlib import Path

source = Path('src/services/geminiService.ts').read_text(encoding='utf-8')
required = [
    'SORIDRAW_875_JAPANESE_AUDIT_QUALITY_TUNING',
    'REPAIR CLEAR NATIVE-JAPANESE DRAFTING DEFECTS SUCH AS:',
    'AUDIT METHOD:',
    "      '일본어 네이티브 의미 검수',",
]
missing = [item for item in required if item not in source]
if missing:
    raise SystemExit(f'875 quality verification failed; missing: {missing}')

if source.count('SORIDRAW_875_JAPANESE_AUDIT_QUALITY_TUNING') != 1:
    raise SystemExit('875 quality verification failed; marker count is not 1')
if source.count('async function auditJapaneseNativeSemanticsAtFinalBoundary(') != 1:
    raise SystemExit('875 quality verification failed; Japanese final audit function count changed')

print('SORIDRAW 875 verification OK: one-call Japanese audit quality tuning is active')
