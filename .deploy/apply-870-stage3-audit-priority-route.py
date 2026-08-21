from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_870_JAPANESE_AUDIT_PRIORITY_ROUTE'
if marker in source:
    print('870 Japanese audit priority route already applied')
    raise SystemExit(0)

if 'SORIDRAW_869_JAPANESE_AUDIT_CANONICAL_LANGUAGE_MAP' not in source:
    raise SystemExit('870 requires 869 canonical Japanese audit route to run first')

route_anchor = """  const SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE = true;\n  const SORIDRAW_869_JAPANESE_AUDIT_CANONICAL_LANGUAGE_MAP = true;\n\n  const applied = (result.appliedKeywords || {}) as any;\n  const canonicalJapaneseLyrics = String(applied.lyricsByLanguage?.ja || '').trim();\n\n  // Keep slot metadata only for synchronizing an accepted audit result back to the\n  // physical legacy card. It no longer decides whether Japanese auditing happens.\n  for (const card of ['korean', 'english'] as const) {\n    if (!preferredCards.includes(card)) preferredCards.push(card);\n  }\n  const japaneseCard = preferredCards.find((card) => {\n    const lyrics = String(result.lyrics?.[card] || '').trim();\n    if (!lyrics) return false;\n    if ((card === 'korean' && slots.koreanSlotLanguage === 'ja')\n      || (card === 'english' && slots.englishSlotLanguage === 'ja')) return true;\n    return inspectSelectedLanguageBodyContract(lyrics, 'ja').valid;\n  }) || null;\n\n  const physicalJapaneseLyrics = japaneseCard\n    ? String(result.lyrics?.[japaneseCard] || '').trim()\n    : '';\n  const currentLyrics = canonicalJapaneseLyrics || physicalJapaneseLyrics;\n  if (!currentLyrics) return result;"""
route_replacement = """  const SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE = true;\n  const SORIDRAW_869_JAPANESE_AUDIT_CANONICAL_LANGUAGE_MAP = true;\n  const SORIDRAW_870_JAPANESE_AUDIT_PRIORITY_ROUTE = true;\n\n  const applied = (result.appliedKeywords || {}) as any;\n  const canonicalJapaneseLyrics = String(applied.lyricsByLanguage?.ja || '').trim();\n\n  // 870: Audit routing must never depend on language metadata or the strict final\n  // validator. Detect the actual Japanese sung body directly from the final payload.\n  // This is intentionally looser than the acceptance validator: it only answers\n  // \"is this a Japanese lyric body worth auditing?\", not \"is it already perfect?\".\n  const japaneseBodyScore = (lyrics: string): { eligible: boolean; score: number } => {\n    const text = lyricBodyWithoutSectionCues(String(lyrics || ''));\n    const counts = countSelectedLanguageScripts(text);\n    const japanese = counts.kana + counts.han;\n    const recognized = japanese + counts.hangul + counts.cyrillic + counts.thai + counts.latin;\n    const share = recognized > 0 ? japanese / recognized : 0;\n    return {\n      eligible: japanese >= 12 && counts.kana >= 6 && share >= 0.55,\n      score: japanese * 10 + counts.kana * 2 - (counts.hangul + counts.cyrillic + counts.thai + counts.latin),\n    };\n  };\n\n  const physicalCandidates = (['korean', 'english'] as const)\n    .map((card) => {\n      const lyrics = String(result.lyrics?.[card] || '').trim();\n      const detected = japaneseBodyScore(lyrics);\n      const metadataBonus = (card === 'korean' && slots.koreanSlotLanguage === 'ja')\n        || (card === 'english' && slots.englishSlotLanguage === 'ja')\n        ? 100000\n        : 0;\n      return { card, lyrics, eligible: detected.eligible, score: detected.score + metadataBonus };\n    })\n    .filter((item) => item.lyrics && item.eligible)\n    .sort((a, b) => b.score - a.score);\n\n  const canonicalDetected = japaneseBodyScore(canonicalJapaneseLyrics);\n  let japaneseCard: 'korean' | 'english' | null = physicalCandidates[0]?.card || null;\n  if (!japaneseCard && canonicalDetected.eligible) {\n    if (slots.koreanSlotLanguage === 'ja') japaneseCard = 'korean';\n    else if (slots.englishSlotLanguage === 'ja') japaneseCard = 'english';\n  }\n\n  const physicalJapaneseLyrics = japaneseCard\n    ? String(result.lyrics?.[japaneseCard] || '').trim()\n    : '';\n  const currentLyrics = canonicalDetected.eligible\n    ? canonicalJapaneseLyrics\n    : physicalJapaneseLyrics;\n  if (!currentLyrics || !japaneseBodyScore(currentLyrics).eligible) return result;"""
if source.count(route_anchor) != 1:
    raise SystemExit(f'870 Japanese detection route anchor mismatch: {source.count(route_anchor)}')
source = source.replace(route_anchor, route_replacement, 1)

# Give the semantic audit priority over optional section-production-cue repair. Language
# mixing is already complete here, while the later integrity pass only repairs structural
# sections/bracket production cues. This reserves the next available Gemini request for
# the Japanese native audit even after multi-model generation fallback.
pre_integrity_anchor = """    guarded = await applyV1LockedWholeLyricLanguageMix(guarded, params);\n\n    if (route !== 'v2' && guarded?.lyrics) {"""
pre_integrity_replacement = """    guarded = await applyV1LockedWholeLyricLanguageMix(guarded, params);\n\n    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n\n    if (route !== 'v2' && guarded?.lyrics) {"""
if source.count(pre_integrity_anchor) != 1:
    raise SystemExit(f'870 pre-integrity audit anchor mismatch: {source.count(pre_integrity_anchor)}')
source = source.replace(pre_integrity_anchor, pre_integrity_replacement, 1)

# 869 placed the audit at the final return boundary. Remove that second invocation now
# that 870 runs it immediately after final language mixing and before optional cue repair.
final_anchor = """    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
final_replacement = """    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
if source.count(final_anchor) != 1:
    raise SystemExit(f'870 final duplicate-audit anchor mismatch: {source.count(final_anchor)}')
source = source.replace(final_anchor, final_replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 870: direct Japanese-body detection + audit priority before optional production-cue repair')
