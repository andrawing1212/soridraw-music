from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_869_JAPANESE_AUDIT_CANONICAL_LANGUAGE_MAP'
if marker in source:
    print('869 Japanese canonical audit route already applied')
    raise SystemExit(0)

if 'SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE' not in source:
    raise SystemExit('869 requires 868 Japanese final-body route to run first')

# 1) Build the canonical selected-language map before the audit. The UI and final
# language output consume this map, so the Japanese auditor must inspect the same
# final language body rather than trying to rediscover it from a physical legacy slot.
call_anchor = """    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
call_replacement = """    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
if source.count(call_anchor) != 1:
    raise SystemExit(f'869 final-boundary order anchor mismatch: {source.count(call_anchor)}')
source = source.replace(call_anchor, call_replacement, 1)

# 2) After refresh, appliedKeywords.lyricsByLanguage.ja is the canonical final Japanese
# lyric body. Use it first. Physical korean/english slots are only synchronization/fallback
# targets and must not gate whether the audit runs.
route_anchor = """  const SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE = true;\n\n  // Metadata is ordering information only. Never early-return from metadata here.\n  // The final rendered bodies are the truth because those are what the user receives.\n  for (const card of ['korean', 'english'] as const) {\n    if (!preferredCards.includes(card)) preferredCards.push(card);\n  }\n\n  const japaneseCard = preferredCards.find((card) => {\n    const lyrics = String(result.lyrics?.[card] || '').trim();\n    if (!lyrics) return false;\n    return inspectSelectedLanguageBodyContract(lyrics, 'ja').valid;\n  }) || null;\n  if (!japaneseCard) return result;\n\n  const currentLyrics = String(result.lyrics[japaneseCard] || '').trim();"""
route_replacement = """  const SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE = true;\n  const SORIDRAW_869_JAPANESE_AUDIT_CANONICAL_LANGUAGE_MAP = true;\n\n  const applied = (result.appliedKeywords || {}) as any;\n  const canonicalJapaneseLyrics = String(applied.lyricsByLanguage?.ja || '').trim();\n\n  // Keep slot metadata only for synchronizing an accepted audit result back to the\n  // physical legacy card. It no longer decides whether Japanese auditing happens.\n  for (const card of ['korean', 'english'] as const) {\n    if (!preferredCards.includes(card)) preferredCards.push(card);\n  }\n  const japaneseCard = preferredCards.find((card) => {\n    const lyrics = String(result.lyrics?.[card] || '').trim();\n    if (!lyrics) return false;\n    if ((card === 'korean' && slots.koreanSlotLanguage === 'ja')\n      || (card === 'english' && slots.englishSlotLanguage === 'ja')) return true;\n    return inspectSelectedLanguageBodyContract(lyrics, 'ja').valid;\n  }) || null;\n\n  const physicalJapaneseLyrics = japaneseCard\n    ? String(result.lyrics?.[japaneseCard] || '').trim()\n    : '';\n  const currentLyrics = canonicalJapaneseLyrics || physicalJapaneseLyrics;\n  if (!currentLyrics) return result;"""
if source.count(route_anchor) != 1:
    raise SystemExit(f'869 canonical Japanese route anchor mismatch: {source.count(route_anchor)}')
source = source.replace(route_anchor, route_replacement, 1)

# 3) Accepted replacements must update the canonical language map that the user sees,
# and the mapped physical slot when one exists. Do not run refresh again afterward,
# because that could overwrite the audited canonical body with a stale physical value.
candidate_anchor = """    const candidate: SongResult = {\n      ...result,\n      lyrics: {\n        ...result.lyrics,\n        [japaneseCard]: auditedLyrics,\n      },\n    };"""
candidate_replacement = """    const currentApplied = (result.appliedKeywords || {}) as any;\n    const candidate: SongResult = {\n      ...result,\n      lyrics: japaneseCard\n        ? {\n            ...result.lyrics,\n            [japaneseCard]: auditedLyrics,\n          }\n        : result.lyrics,\n      appliedKeywords: {\n        ...currentApplied,\n        lyricsByLanguage: {\n          ...(currentApplied.lyricsByLanguage || {}),\n          ja: auditedLyrics,\n        },\n      } as any,\n    };"""
if source.count(candidate_anchor) != 1:
    raise SystemExit(f'869 audit candidate sync anchor mismatch: {source.count(candidate_anchor)}')
source = source.replace(candidate_anchor, candidate_replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 869: audit canonical final Japanese language map and sync accepted repairs')
