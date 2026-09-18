from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_866_JAPANESE_NATIVE_SEMANTIC_AUDIT'
if marker in source:
    print('866 Japanese semantic audit already applied')
    raise SystemExit(0)

if 'SORIDRAW_865_JAPANESE_NATIVE_RELATION_FINAL' not in source:
    raise SystemExit('866 requires 865 Japanese native relation finalizer to run first')

# Insert one conservative, low-payload Japanese semantic audit after all lyric transforms
# and before final language maps are refreshed. It deliberately preserves natural poetic
# metaphor/personification and only repairs high-confidence native-Japanese relation errors.
insert_token = '\nfunction refreshSelectedLanguageOutputMaps(\n'
insert_at = source.find(insert_token)
if insert_at < 0:
    raise SystemExit('866 audit helper insertion anchor missing')

helper = r'''
const SORIDRAW_866_JAPANESE_NATIVE_SEMANTIC_AUDIT = true;

type JapaneseNativeSemanticAuditReplacement = {
  lineIndex: number;
  text: string;
};

function collectJapaneseNativeSemanticAuditLines(value: string): Array<{ lineIndex: number; text: string }> {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line, lineIndex) => ({ lineIndex, text: String(line || '').trim() }))
    .filter((item) => Boolean(item.text) && !isStandaloneSelectedLanguageCueLine(item.text));
}

function applyJapaneseNativeSemanticAuditReplacements(
  sourceLyrics: string,
  replacements: JapaneseNativeSemanticAuditReplacement[],
): string {
  const lines = String(sourceLyrics || '').replace(/\r\n?/g, '\n').split('\n');
  const auditable = new Set(collectJapaneseNativeSemanticAuditLines(sourceLyrics).map((item) => item.lineIndex));
  const seen = new Set<number>();

  for (const item of replacements || []) {
    const lineIndex = Math.round(Number(item?.lineIndex));
    const text = String(item?.text || '').trim();
    if (!Number.isFinite(lineIndex) || seen.has(lineIndex) || !auditable.has(lineIndex)) continue;
    if (!text || text.length > 180 || /^\s*\[[^\]]+\]\s*$/.test(text)) continue;
    if (selectedLanguageSungLineNeedsRepair(text, 'ja')) continue;
    lines[lineIndex] = text;
    seen.add(lineIndex);
  }

  return lines.join('\n').trim();
}

async function auditJapaneseNativeSemanticsAtFinalBoundary(
  result: SongResult,
  params: GenerateSongParams,
  ai: GoogleGenAI,
): Promise<SongResult> {
  if (!result?.lyrics || params.isNoLyrics || !params.lyricLanguages?.includes('ja')) return result;

  const slots = getV1SelectedLyricSlotLanguages(params);
  const japaneseCard = slots.koreanSlotLanguage === 'ja'
    ? ('korean' as const)
    : slots.englishSlotLanguage === 'ja'
      ? ('english' as const)
      : null;
  if (!japaneseCard) return result;

  const currentLyrics = String(result.lyrics[japaneseCard] || '').trim();
  const lines = collectJapaneseNativeSemanticAuditLines(currentLyrics);
  if (!currentLyrics || lines.length < 2) return result;

  try {
    const response = await generateContentWithModelFallback(
      ai,
      {
        model: 'gemini-3.5-flash-lite',
        contents: JSON.stringify({
          title: String(result.title || '').slice(0, 180),
          lines,
        }),
        config: {
          systemInstruction: `You are SORIDRAW's final native-Japanese lyric semantic auditor.

PURPOSE — 866:
- Review ONLY the supplied Japanese sung lines after the song is otherwise complete.
- Return replacements ONLY for high-confidence native-Japanese semantic/collocation errors.
- If a line is already natural Japanese, leave it unchanged by omitting it from replacements.
- When uncertain, KEEP the original line.

POETIC LANGUAGE MUST BE PRESERVED:
- Do NOT reject a line merely because its literal physical action is impossible.
- Natural metaphor, personification, symbolism, synesthesia, compressed lyric grammar, and image-based phrasing are valid when a native Japanese listener can reasonably read them as deliberate poetic expression.
- Judge the distinction a native lyric editor would make: "intentional poetic image" = keep; "words attached in a way that feels like an AI relation/collocation mistake" = repair.
- Never flatten a good poetic line into ordinary explanatory prose just to make it literal.

REPAIR ONLY HIGH-CONFIDENCE FAILURES SUCH AS:
- a predicate taking a subject/object/location/case particle that native Japanese would not naturally assign to it;
- a modifier/head noun or verb/noun collocation that sounds non-native rather than intentionally poetic;
- a hidden Korean/English clause relation that must be mentally translated back before the Japanese makes sense;
- an accidental semantic contradiction or missing predicate argument that reads as generation error, not purposeful ambiguity.

REPAIR CONTRACT:
- Preserve the same scene, speaker, emotion, narrative role, approximate breath length, and poetic intensity.
- Repair the smallest possible set of lines. Do not rewrite neighboring good lines.
- Do not introduce a new scene, new hook, generic lyric filler, memorized stock phrase, or fixed answer.
- Intentional hook repetition is not an error.
- Every replacement must be natural contemporary Japanese using native Japanese script.
- Return JSON only: { "replacements": [{ "lineIndex": 0, "text": "..." }] }.
- If nothing clearly needs repair, return { "replacements": [] }.` ,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              replacements: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    lineIndex: { type: Type.NUMBER },
                    text: { type: Type.STRING },
                  },
                  required: ['lineIndex', 'text'],
                  additionalProperties: false,
                },
              },
            },
            required: ['replacements'],
            additionalProperties: false,
          },
        },
      },
      '일본어 네이티브 의미 검수',
      ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    );

    const parsed = parseGeminiJsonObject(response?.text || '{}');
    const replacements = (Array.isArray(parsed?.replacements) ? parsed.replacements : [])
      .map((item: any) => ({
        lineIndex: Math.round(Number(item?.lineIndex)),
        text: String(item?.text || '').trim(),
      }))
      .filter((item: JapaneseNativeSemanticAuditReplacement) => Number.isFinite(item.lineIndex) && Boolean(item.text));

    if (!replacements.length) return result;

    const auditedLyrics = applyJapaneseNativeSemanticAuditReplacements(currentLyrics, replacements);
    if (!auditedLyrics || auditedLyrics === currentLyrics) return result;
    if (!inspectSelectedLanguageBodyContract(auditedLyrics, 'ja').valid) {
      console.warn('[SORIDRAW 866 Japanese Audit] candidate rejected by selected-language contract');
      return result;
    }

    const candidate: SongResult = {
      ...result,
      lyrics: {
        ...result.lyrics,
        [japaneseCard]: auditedLyrics,
      },
    };
    try {
      assertNoFinalLyricHardBanViolations(candidate, params);
    } catch (error) {
      console.warn('[SORIDRAW 866 Japanese Audit] candidate rejected by hard-ban guard:', error);
      return result;
    }
    return candidate;
  } catch (error) {
    // Quality audit is fail-open: model quota/latency must never discard a usable song.
    console.warn('[SORIDRAW 866 Japanese Audit] audit unavailable; preserving original Japanese lyrics:', error);
    return result;
  }
}
'''
source = source[:insert_at] + '\n' + helper + source[insert_at:]

# Run the audit after post-language-mix final integrity, before language maps/final hard-ban assertion.
call_anchor = """    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
call_replacement = """    guarded = await auditJapaneseNativeSemanticsAtFinalBoundary(\n      guarded,\n      params,\n      getAuditedAI(params.geminiApiKey, auditSessionId),\n    );\n    guarded = refreshSelectedLanguageOutputMaps(guarded, params);\n    assertNoFinalLyricHardBanViolations(guarded, params);"""
if source.count(call_anchor) != 1:
    raise SystemExit(f'866 final-boundary call anchor mismatch: {source.count(call_anchor)}')
source = source.replace(call_anchor, call_replacement, 1)

path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 866: conservative final Japanese semantic audit with poetic-language preservation')
