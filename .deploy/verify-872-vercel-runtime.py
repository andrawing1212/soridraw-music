from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')

required_markers = [
    'SORIDRAW_866_JAPANESE_NATIVE_SEMANTIC_AUDIT',
    'SORIDRAW_867_JAPANESE_AUDIT_ROUTE_FIX',
    'SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE',
    'SORIDRAW_869_JAPANESE_AUDIT_CANONICAL_LANGUAGE_MAP',
    'SORIDRAW_870_JAPANESE_AUDIT_PRIORITY_ROUTE',
    'SORIDRAW_871_FINAL_JAPANESE_AUDIT_BOUNDARY',
    '일본어 네이티브 의미 검수',
]
missing = [marker for marker in required_markers if marker not in source]
if missing:
    raise SystemExit(f'872 Vercel runtime verification failed; missing markers: {missing}')

final_boundary = """    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n    assertNoFinalLyricHardBanViolations(guarded, params);"""

if source.count(final_boundary) != 1:
    raise SystemExit(
        '872 Vercel runtime verification failed; final Japanese audit boundary '
        f'count={source.count(final_boundary)} (expected 1)'
    )

if 'reserveFinalJapaneseAuditRequest(auditSessionId);' not in source:
    raise SystemExit('872 Vercel runtime verification failed; final Japanese audit reservation missing')

print('SORIDRAW 872 runtime verification OK: 862-871 patches applied and final Japanese audit is in the built source')
