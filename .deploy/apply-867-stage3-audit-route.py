from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_867_JAPANESE_AUDIT_ROUTE_FIX'
if marker in source:
    print('867 Japanese audit route fix already applied')
    raise SystemExit(0)

if 'SORIDRAW_866_JAPANESE_NATIVE_SEMANTIC_AUDIT' not in source:
    raise SystemExit('867 requires 866 Japanese semantic audit to run first')

# 1) The final Japanese audit is a required final-language quality/safety pass, not a
# discretionary structure correction. Let it use the existing absolute 5-call budget
# even when another correction operation already consumed the single correction slot.
anchor = """    || clean === 'rewriteLyricHardBanLinesSecondPass'\n    || clean === 'repairSelectedLanguageCard';"""
replacement = """    || clean === 'rewriteLyricHardBanLinesSecondPass'\n    || clean === 'repairSelectedLanguageCard'\n    || clean === '일본어 네이티브 의미 검수';"""
if source.count(anchor) != 1:
    raise SystemExit(f'867 audit budget classification anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

# 2) Resolve the actual final Japanese physical card from the final result, instead of
# trusting only one params-level language gate. This covers v2/legacy slot mapping and
# mixed selected-language routes while keeping the same two physical lyric slots.
anchor = """  if (!result?.lyrics || params.isNoLyrics || !params.lyricLanguages?.includes('ja')) return result;\n\n  const slots = getV1SelectedLyricSlotLanguages(params);\n  const japaneseCard = slots.koreanSlotLanguage === 'ja'\n    ? ('korean' as const)\n    : slots.englishSlotLanguage === 'ja'\n      ? ('english' as const)\n      : null;\n  if (!japaneseCard) return result;\n\n  const currentLyrics = String(result.lyrics[japaneseCard] || '').trim();"""
replacement = """  if (!result?.lyrics || params.isNoLyrics) return result;\n\n  const SORIDRAW_867_JAPANESE_AUDIT_ROUTE_FIX = true;\n  const slots = getV1SelectedLyricSlotLanguages(params);\n  const preferredCards: Array<'korean' | 'english'> = [];\n  if (slots.koreanSlotLanguage === 'ja') preferredCards.push('korean');\n  if (slots.englishSlotLanguage === 'ja') preferredCards.push('english');\n\n  const applied = (result.appliedKeywords || {}) as any;\n  const declaredLanguages = new Set<string>([\n    ...(Array.isArray(params.lyricLanguages) ? params.lyricLanguages : []),\n    ...(Array.isArray(applied.lyricLanguages) ? applied.lyricLanguages : []),\n    ...(Array.isArray(applied.titleLanguages) ? applied.titleLanguages : []),\n    ...Object.keys((applied.lyricsByLanguage || {}) as Record<string, unknown>),\n  ].map((value) => String(value || '').trim()).filter(Boolean));\n  const japaneseWasRequestedOrProduced = declaredLanguages.has('ja')\n    || slots.requested.includes('ja')\n    || Boolean(String((applied.lyricsByLanguage || {}).ja || '').trim());\n  if (!japaneseWasRequestedOrProduced) return result;\n\n  // Slot metadata remains the first choice. If it was lost across a v2/legacy boundary,\n  // fall back to the physical card whose final body actually satisfies Japanese script/body\n  // expectations. This is routing only; it does not rewrite or hardcode lyric wording.\n  for (const card of ['korean', 'english'] as const) {\n    if (!preferredCards.includes(card)) preferredCards.push(card);\n  }\n  const japaneseCard = preferredCards.find((card) => {\n    const lyrics = String(result.lyrics?.[card] || '').trim();\n    if (!lyrics) return false;\n    if ((card === 'korean' && slots.koreanSlotLanguage === 'ja')\n      || (card === 'english' && slots.englishSlotLanguage === 'ja')) return true;\n    return inspectSelectedLanguageBodyContract(lyrics, 'ja').valid;\n  }) || null;\n  if (!japaneseCard) return result;\n\n  const currentLyrics = String(result.lyrics[japaneseCard] || '').trim();"""
if source.count(anchor) != 1:
    raise SystemExit(f'867 Japanese card route anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 867: Japanese semantic audit final-card routing + correction-budget priority')
