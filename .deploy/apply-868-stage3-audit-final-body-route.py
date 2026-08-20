from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE'
if marker in source:
    print('868 Japanese audit final-body route already applied')
    raise SystemExit(0)

if 'SORIDRAW_867_JAPANESE_AUDIT_ROUTE_FIX' not in source:
    raise SystemExit('868 requires 867 Japanese audit route fix to run first')

# 868: make the final rendered lyric bodies the source of truth.
# Metadata may prioritize which physical card is checked first, but it must never gate
# whether the Japanese semantic audit runs. A card is accepted only when its actual
# final body satisfies the existing Japanese language/body contract.
anchor = """  const applied = (result.appliedKeywords || {}) as any;\n  const declaredLanguages = new Set<string>([\n    ...(Array.isArray(params.lyricLanguages) ? params.lyricLanguages : []),\n    ...(Array.isArray(applied.lyricLanguages) ? applied.lyricLanguages : []),\n    ...(Array.isArray(applied.titleLanguages) ? applied.titleLanguages : []),\n    ...Object.keys((applied.lyricsByLanguage || {}) as Record<string, unknown>),\n  ].map((value) => String(value || '').trim()).filter(Boolean));\n  const japaneseWasRequestedOrProduced = declaredLanguages.has('ja')\n    || slots.requested.includes('ja')\n    || Boolean(String((applied.lyricsByLanguage || {}).ja || '').trim());\n  if (!japaneseWasRequestedOrProduced) return result;\n\n  // Slot metadata remains the first choice. If it was lost across a v2/legacy boundary,\n  // fall back to the physical card whose final body actually satisfies Japanese script/body\n  // expectations. This is routing only; it does not rewrite or hardcode lyric wording.\n  for (const card of ['korean', 'english'] as const) {\n    if (!preferredCards.includes(card)) preferredCards.push(card);\n  }\n  const japaneseCard = preferredCards.find((card) => {\n    const lyrics = String(result.lyrics?.[card] || '').trim();\n    if (!lyrics) return false;\n    if ((card === 'korean' && slots.koreanSlotLanguage === 'ja')\n      || (card === 'english' && slots.englishSlotLanguage === 'ja')) return true;\n    return inspectSelectedLanguageBodyContract(lyrics, 'ja').valid;\n  }) || null;\n  if (!japaneseCard) return result;"""

replacement = """  const SORIDRAW_868_JAPANESE_AUDIT_FINAL_BODY_ROUTE = true;\n\n  // Metadata is ordering information only. Never early-return from metadata here.\n  // The final rendered bodies are the truth because those are what the user receives.\n  for (const card of ['korean', 'english'] as const) {\n    if (!preferredCards.includes(card)) preferredCards.push(card);\n  }\n\n  const japaneseCard = preferredCards.find((card) => {\n    const lyrics = String(result.lyrics?.[card] || '').trim();\n    if (!lyrics) return false;\n    return inspectSelectedLanguageBodyContract(lyrics, 'ja').valid;\n  }) || null;\n  if (!japaneseCard) return result;"""

if source.count(anchor) != 1:
    raise SystemExit(f'868 final-body route anchor mismatch: {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 868: final Japanese body is the audit routing source of truth')
