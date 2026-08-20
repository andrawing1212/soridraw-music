from pathlib import Path

path = Path('src/services/geminiService.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_862_TARGETED_SELECTED_LANGUAGE_REPAIR'
if marker in source:
    print('862 targeted selected-language repair already applied')
    raise SystemExit(0)

start_token = 'async function repairSelectedLanguageCardWithGemini('
end_token = '\nasync function enforceSelectedLanguageCardsBeforeHardBan('
start = source.find(start_token)
end = source.find(end_token, start)
if start < 0 or end < 0:
    raise SystemExit(f'862 anchor mismatch: start={start}, end={end}')

replacement = r'''const SORIDRAW_862_TARGETED_SELECTED_LANGUAGE_REPAIR = true;

type SelectedLanguageRepairTarget = {
  lineIndex: number;
  text: string;
  before: string;
  after: string;
};

type SelectedLanguageRepairReplacement = {
  lineIndex: number;
  text: string;
};

function isStandaloneSelectedLanguageCueLine(value: string): boolean {
  return /^\s*\[[^\]]+\]\s*$/.test(String(value || ''));
}

function countSelectedLanguageScripts(value: string): {
  hangul: number;
  kana: number;
  han: number;
  cyrillic: number;
  thai: number;
  latin: number;
} {
  const text = String(value || '');
  return {
    hangul: (text.match(/[가-힣]/g) || []).length,
    kana: (text.match(/[\u3040-\u30ff\u31f0-\u31ff]/g) || []).length,
    han: (text.match(/[\u3400-\u9fff]/g) || []).length,
    cyrillic: (text.match(/[\u0400-\u04ff]/g) || []).length,
    thai: (text.match(/[\u0e00-\u0e7f]/g) || []).length,
    latin: (text.match(/[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ]/g) || []).length,
  };
}

function selectedLanguageSungLineNeedsRepair(value: string, language: LanguageCode): boolean {
  const line = String(value || '').trim();
  if (!line || isStandaloneSelectedLanguageCueLine(line)) return false;
  const counts = countSelectedLanguageScripts(line);
  const nonPunctuation = line.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (!nonPunctuation) return false;

  switch (language) {
    case 'ja': {
      const japanese = counts.kana + counts.han;
      return japanese <= 0
        || counts.hangul > 0
        || counts.cyrillic > 0
        || counts.thai > 0
        || counts.latin >= 3;
    }
    case 'zh':
      return counts.han <= 0 || counts.kana > 0 || counts.hangul > 0 || counts.cyrillic > 0 || counts.thai > 0;
    case 'ko':
      return counts.hangul <= 0 || counts.kana > 0 || counts.cyrillic > 0 || counts.thai > 0;
    case 'ru':
      return counts.cyrillic <= 0 || counts.hangul > 0 || counts.kana > 0 || counts.thai > 0;
    case 'th':
      return counts.thai <= 0 || counts.hangul > 0 || counts.kana > 0 || counts.cyrillic > 0;
    case 'en':
    case 'es':
    case 'fr':
    case 'de':
      return counts.latin <= 0 || counts.hangul > 0 || counts.kana > 0 || counts.cyrillic > 0 || counts.thai > 0;
    default:
      return false;
  }
}

function collectSelectedLanguageRepairTargets(
  value: string,
  language: LanguageCode,
  forceAllSungLines = false,
): SelectedLanguageRepairTarget[] {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const sungIndexes = lines
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ line }) => Boolean(String(line || '').trim()) && !isStandaloneSelectedLanguageCueLine(line))
    .map(({ lineIndex }) => lineIndex);

  const previousSung = (lineIndex: number): string => {
    for (let index = lineIndex - 1; index >= 0; index -= 1) {
      const line = String(lines[index] || '').trim();
      if (line && !isStandaloneSelectedLanguageCueLine(line)) return line;
    }
    return '';
  };
  const nextSung = (lineIndex: number): string => {
    for (let index = lineIndex + 1; index < lines.length; index += 1) {
      const line = String(lines[index] || '').trim();
      if (line && !isStandaloneSelectedLanguageCueLine(line)) return line;
    }
    return '';
  };

  return sungIndexes
    .filter((lineIndex) => forceAllSungLines || selectedLanguageSungLineNeedsRepair(lines[lineIndex], language))
    .map((lineIndex) => ({
      lineIndex,
      text: String(lines[lineIndex] || '').trim(),
      before: previousSung(lineIndex),
      after: nextSung(lineIndex),
    }));
}

function applySelectedLanguageRepairReplacements(
  sourceLyrics: string,
  targetLanguage: LanguageCode,
  requestedTargets: SelectedLanguageRepairTarget[],
  replacements: SelectedLanguageRepairReplacement[],
): string {
  const lines = String(sourceLyrics || '').replace(/\r\n?/g, '\n').split('\n');
  const requested = new Set(requestedTargets.map((item) => item.lineIndex));
  const seen = new Set<number>();

  for (const item of replacements || []) {
    const lineIndex = Math.round(Number(item?.lineIndex));
    const text = String(item?.text || '').trim();
    if (!Number.isFinite(lineIndex) || seen.has(lineIndex) || !requested.has(lineIndex)) continue;
    if (lineIndex < 0 || lineIndex >= lines.length || isStandaloneSelectedLanguageCueLine(lines[lineIndex])) continue;
    if (!text || selectedLanguageSungLineNeedsRepair(text, targetLanguage)) continue;
    lines[lineIndex] = text;
    seen.add(lineIndex);
  }

  return lines.join('\n').trim();
}

async function requestTargetedSelectedLanguageLineRepairs(
  ai: GoogleGenAI,
  targetLanguage: LanguageCode,
  targetName: string,
  nativeScript: string,
  currentLyrics: string,
  targets: SelectedLanguageRepairTarget[],
  context: 'repairSelectedLanguageCard' | 'repairSelectedLanguageCardStrict',
): Promise<{ lyrics: string; title: string }> {
  const compactLyricContext = lyricBodyWithoutSectionCues(currentLyrics).slice(0, 1800);
  const response = await generateContentWithModelFallback(
    ai,
    {
      model: context === 'repairSelectedLanguageCard' ? 'gemini-3.5-flash' : 'gemini-3.5-flash-lite',
      contents: JSON.stringify({
        targetLanguage,
        targetLanguageName: targetName,
        lyricContext: compactLyricContext,
        repairLines: targets.map((item) => ({
          lineIndex: item.lineIndex,
          text: item.text,
          before: item.before,
          after: item.after,
        })),
      }),
      config: {
        systemInstruction: `You are SORIDRAW's targeted selected-language lyric-line repair stage.

TARGET LANGUAGE CONTRACT:
- Target language: ${targetName}.
- Every replacement sung line must use ${nativeScript}.
- For Japanese, write natural modern Japanese directly. No romaji, no standalone English lexical sung line, and no Korean/English sentence skeleton translated mechanically into Japanese.
- Keep the original meaning, speaker, emotional direction, and approximate line breath.

STRICT SCOPE CONTRACT — 862:
- Rewrite ONLY the supplied repairLines. Do not regenerate the full lyric card.
- Return exactly one replacement for each supplied lineIndex and no other lyric lines.
- Never return section tags, production cues, explanations, markdown, or analysis inside replacement text.
- Use before/after only as local context. Do not rewrite them.
- Do not invent a new scene, hook, character, or topic.
- title must be a concise natural ${targetName} title based on lyricContext.
- Return valid JSON only: { "title": "...", "replacements": [{ "lineIndex": 0, "text": "..." }] }.` ,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
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
          required: ['title', 'replacements'],
          additionalProperties: false,
        },
      },
    },
    context,
    context === 'repairSelectedLanguageCard'
      ? ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
      : ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  );

  const parsed = parseGeminiJsonObject(response?.text || '{}');
  const replacements = (Array.isArray(parsed?.replacements) ? parsed.replacements : [])
    .map((item: any) => ({
      lineIndex: Math.round(Number(item?.lineIndex)),
      text: String(item?.text || '').trim(),
    }))
    .filter((item: SelectedLanguageRepairReplacement) => Number.isFinite(item.lineIndex) && Boolean(item.text));

  return {
    lyrics: applySelectedLanguageRepairReplacements(currentLyrics, targetLanguage, targets, replacements),
    title: String(parsed?.title || '').trim().replace(/^['\"]+|['\"]+$/g, ''),
  };
}

async function repairSelectedLanguageCardWithGemini(
  ai: GoogleGenAI,
  params: GenerateSongParams,
  targetLanguage: LanguageCode,
  currentLyrics: string,
  siblingLyrics: string,
  productionPrompt: string,
): Promise<{ lyrics: string; title: string }> {
  const targetName = V1_LANGUAGE_NAME_MAP[targetLanguage] || targetLanguage;
  const nativeScript = SELECTED_LANGUAGE_NATIVE_SCRIPT_MAP[targetLanguage] || 'the language’s normal native writing system';
  const current = String(currentLyrics || '').trim();
  const sibling = String(siblingLyrics || '').trim();
  let lyrics = current;
  let title = '';

  if (current) {
    let targets = collectSelectedLanguageRepairTargets(current, targetLanguage);
    if (!targets.length && !hasDominantSelectedLanguageBody(current, targetLanguage)) {
      targets = collectSelectedLanguageRepairTargets(current, targetLanguage, true);
    }
    if (targets.length) {
      const targeted = await requestTargetedSelectedLanguageLineRepairs(
        ai,
        targetLanguage,
        targetName,
        nativeScript,
        current,
        targets,
        'repairSelectedLanguageCard',
      );
      lyrics = targeted.lyrics;
      title = targeted.title;
    }
  } else {
    const response = await generateContentWithModelFallback(
      ai,
      {
        model: 'gemini-3.5-flash',
        contents: JSON.stringify({
          targetLanguage,
          targetLanguageName: targetName,
          productionPrompt: String(productionPrompt || '').slice(0, 1200),
          siblingLyrics: sibling,
          exactSectionOrder: isGenerationEngineV2(params)
            ? Array.from(new Set(
                String(sibling || '')
                  .replace(/\r\n?/g, '\n')
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => /^\[[^\]]+\]$/.test(line))
                  .map((line) => line.slice(1, -1).split(/[:：]/)[0].trim())
                  .filter(Boolean),
              ))
            : getV1SectionBlueprint(params).entries.map((entry) => entry.name),
        }),
        config: {
          systemInstruction: `You are SORIDRAW's missing selected-language lyric-card recovery stage.
Target language: ${targetName}.
Write the sung lyric body in ${nativeScript}.
Preserve the supplied section order and shared story/hook direction from siblingLyrics, but write natural independent ${targetName} rather than literal line-by-line translation.
Keep English square-bracket section/performance/production cues in their structural role only.
Do not add an unselected lyric language, explanations, markdown, analysis, or extra fields.
Return valid JSON only: { "title": "...", "lyrics": "..." }.
The title must be a natural ${targetName} song title in the target script.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              lyrics: { type: Type.STRING },
            },
            required: ['title', 'lyrics'],
            additionalProperties: false,
          },
        },
      },
      'repairSelectedLanguageCard',
      ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    );
    const parsed = parseGeminiJsonObject(response?.text || '{}');
    lyrics = String(parsed?.lyrics || '').trim();
    title = String(parsed?.title || '').trim().replace(/^['\"]+|['\"]+$/g, '');
  }

  // Stage 1 keeps the existing deterministic validator unchanged. If the targeted
  // first pass is still invalid, run one bounded targeted strict pass instead of
  // regenerating the whole card again.
  if (!hasDominantSelectedLanguageBody(lyrics, targetLanguage) && lyrics) {
    let strictTargets = collectSelectedLanguageRepairTargets(lyrics, targetLanguage);
    if (!strictTargets.length) {
      strictTargets = collectSelectedLanguageRepairTargets(lyrics, targetLanguage, true);
    }
    if (strictTargets.length) {
      const strict = await requestTargetedSelectedLanguageLineRepairs(
        ai,
        targetLanguage,
        targetName,
        nativeScript,
        lyrics,
        strictTargets,
        'repairSelectedLanguageCardStrict',
      );
      lyrics = strict.lyrics;
      if (strict.title) title = strict.title;
    }
  }

  if (!hasDominantSelectedLanguageBody(lyrics, targetLanguage)) {
    throw new Error(`선택한 ${targetName} 가사 카드가 올바른 문자 체계/언어 비중으로 생성되지 않았습니다.`);
  }
  if (!hasExpectedSelectedLanguageScript(title, targetLanguage, true)) {
    title = getSelectedLanguageFallbackTitle(targetLanguage);
  }

  if (isGenerationEngineV2(params)) {
    lyrics = sanitizeV2GeneratedLyrics(lyrics, {
      language: targetLanguage,
      rapMode: getRapModeFromParams(params),
    });
  } else {
    lyrics = sanitizeGeneratedLyricTagsAndFragments(lyrics, params);
    lyrics = stripSpatialAndEraKeywordsFromLyrics(lyrics, params);
    lyrics = postProcessLyricsSectionTags(lyrics, params);
    lyrics = finalizeGeneratedLyricsStructuralSafety(lyrics, params);
    lyrics = applyV1SectionBlueprintGuard(lyrics, params);
  }

  return { lyrics, title };
}
'''

source = source[:start] + replacement + source[end:]
path.write_text(source, encoding='utf-8')
print('Applied SORIDRAW 862 stage 1: targeted selected-language line repair only')
