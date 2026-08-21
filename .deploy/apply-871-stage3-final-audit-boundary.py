from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_871_FINAL_JAPANESE_AUDIT_BOUNDARY'
if marker in source:
    print('871 final Japanese audit boundary already applied')
    raise SystemExit(0)

if 'SORIDRAW_870_JAPANESE_AUDIT_PRIORITY_ROUTE' not in source:
    raise SystemExit('871 requires 870 Japanese audit priority route to run first')

# 1) Reserve one physical request for the final Japanese semantic audit once a Japanese
# body is known to exist. This prevents optional post-language-mix production-cue repair
# from consuming the last request before the true final-boundary audit can run.
budget_type_anchor = """type GeminiGenerationRequestBudget = {\n  maxRequests: number;\n  maxCorrectionRequests: number;\n  usedRequests: number;\n  usedCorrectionRequests: number;\n};"""
budget_type_replacement = """type GeminiGenerationRequestBudget = {\n  maxRequests: number;\n  maxCorrectionRequests: number;\n  usedRequests: number;\n  usedCorrectionRequests: number;\n  reservedFinalJapaneseAuditRequests: number;\n};"""
if source.count(budget_type_anchor) != 1:
    raise SystemExit(f'871 budget type anchor mismatch: {source.count(budget_type_anchor)}')
source = source.replace(budget_type_anchor, budget_type_replacement, 1)

budget_init_anchor = """    maxCorrectionRequests: GEMINI_GENERATION_MAX_CORRECTION_REQUESTS,\n    usedRequests: 0,\n    usedCorrectionRequests: 0,\n  });"""
budget_init_replacement = """    maxCorrectionRequests: GEMINI_GENERATION_MAX_CORRECTION_REQUESTS,\n    usedRequests: 0,\n    usedCorrectionRequests: 0,\n    reservedFinalJapaneseAuditRequests: 0,\n  });"""
if source.count(budget_init_anchor) != 1:
    raise SystemExit(f'871 budget init anchor mismatch: {source.count(budget_init_anchor)}')
source = source.replace(budget_init_anchor, budget_init_replacement, 1)

reserve_insert_anchor = """function endGeminiGenerationRequestBudget(sessionId: string): void {\n  if (!sessionId) return;\n  geminiGenerationRequestBudgets.delete(sessionId);\n}\n"""
reserve_helper = """function endGeminiGenerationRequestBudget(sessionId: string): void {\n  if (!sessionId) return;\n  geminiGenerationRequestBudgets.delete(sessionId);\n}\n\nfunction reserveFinalJapaneseAuditRequest(sessionId: string): void {\n  const budget = geminiGenerationRequestBudgets.get(String(sessionId || '').trim());\n  if (!budget) return;\n  budget.reservedFinalJapaneseAuditRequests = Math.max(\n    budget.reservedFinalJapaneseAuditRequests || 0,\n    1,\n  );\n}\n"""
if source.count(reserve_insert_anchor) != 1:
    raise SystemExit(f'871 reserve helper anchor mismatch: {source.count(reserve_insert_anchor)}')
source = source.replace(reserve_insert_anchor, reserve_helper, 1)

absolute_anchor = """  if (budget.usedRequests >= budget.maxRequests) {\n    throw new GeminiRequestBudgetExceededError(\n      `곡 생성 Gemini 호출 상한(${budget.maxRequests}회)에 도달해 ${context} 호출을 생략했습니다.`,\n    );\n  }"""
absolute_replacement = """  const reservedForFinalJapaneseAudit = Math.max(0, budget.reservedFinalJapaneseAuditRequests || 0);\n  const isFinalJapaneseAudit = String(context || '').trim() === '일본어 네이티브 의미 검수';\n  const effectiveMaxForOtherCalls = Math.max(0, budget.maxRequests - reservedForFinalJapaneseAudit);\n  if (!isFinalJapaneseAudit && reservedForFinalJapaneseAudit > 0 && budget.usedRequests >= effectiveMaxForOtherCalls) {\n    throw new GeminiRequestBudgetExceededError(\n      `최종 일본어 네이티브 의미 검수 1회를 위해 남은 호출을 예약하여 ${context} 호출을 생략했습니다.`,\n    );\n  }\n  if (budget.usedRequests >= budget.maxRequests) {\n    throw new GeminiRequestBudgetExceededError(\n      `곡 생성 Gemini 호출 상한(${budget.maxRequests}회)에 도달해 ${context} 호출을 생략했습니다.`,\n    );\n  }"""
if source.count(absolute_anchor) != 1:
    raise SystemExit(f'871 absolute budget anchor mismatch: {source.count(absolute_anchor)}')
source = source.replace(absolute_anchor, absolute_replacement, 1)

# 2) Add a lightweight direct Japanese-body detector outside the audit function so the
# request can be reserved before optional post-language-mix integrity repair runs.
helper_anchor = """async function auditJapaneseNativeSemanticsAtFinalBoundary(\n"""
helper = """const SORIDRAW_871_FINAL_JAPANESE_AUDIT_BOUNDARY = true;\n\nfunction hasAuditableJapaneseBodyAtFinalBoundary(result: SongResult): boolean {\n  const applied = (result?.appliedKeywords || {}) as any;\n  const candidates = [\n    String(applied?.lyricsByLanguage?.ja || '').trim(),\n    String(result?.lyrics?.korean || '').trim(),\n    String(result?.lyrics?.english || '').trim(),\n  ].filter(Boolean);\n  return candidates.some((lyrics) => {\n    const text = lyricBodyWithoutSectionCues(lyrics);\n    const counts = countSelectedLanguageScripts(text);\n    const japanese = counts.kana + counts.han;\n    const recognized = japanese + counts.hangul + counts.cyrillic + counts.thai + counts.latin;\n    const share = recognized > 0 ? japanese / recognized : 0;\n    return japanese >= 12 && counts.kana >= 6 && share >= 0.55;\n  });\n}\n\nasync function auditJapaneseNativeSemanticsAtFinalBoundary(\n"""
if source.count(helper_anchor) != 1:
    raise SystemExit(f'871 final-body helper anchor mismatch: {source.count(helper_anchor)}')
source = source.replace(helper_anchor, helper, 1)

# 3) 870 ran the audit before post-language-mix integrity. Remove that call. Refresh the
# canonical language map only to decide whether a request must be reserved. The actual
# audit will run after the post-language-mix integrity pass has made its last lyric edit.
pre_integrity_anchor = """    guarded = await applyV1LockedWholeLyricLanguageMix(guarded, params);\n\n    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n\n    if (route !== 'v2' && guarded?.lyrics) {"""
pre_integrity_replacement = """    guarded = await applyV1LockedWholeLyricLanguageMix(guarded, params);\n\n    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    if (hasAuditableJapaneseBodyAtFinalBoundary(guarded)) {\n      reserveFinalJapaneseAuditRequest(auditSessionId);\n    }\n\n    if (route !== 'v2' && guarded?.lyrics) {"""
if source.count(pre_integrity_anchor) != 1:
    raise SystemExit(f'871 pre-integrity anchor mismatch: {source.count(pre_integrity_anchor)}')
source = source.replace(pre_integrity_anchor, pre_integrity_replacement, 1)

# 4) This is the real final lyric boundary: post-language-mix integrity is complete and
# refreshSelectedLanguageOutputMaps has rebuilt the exact language map returned to the UI.
# Run the Japanese semantic audit here, then do only assertions/internal-key cleanup.
final_anchor = """    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
final_replacement = """    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
if source.count(final_anchor) != 1:
    raise SystemExit(f'871 final audit boundary anchor mismatch: {source.count(final_anchor)}')
source = source.replace(final_anchor, final_replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 871: reserve one request and run Japanese semantic audit at the true final lyric boundary')
