import { Type } from "@google/genai";
import {
  GENRES,
  GENRE_HIERARCHY,
  INSTRUMENT_SOUNDS,
  MOODS,
  SOUND_STYLES,
  THEMES,
} from "../constants";
import type { SongResult } from "../types";
import { buildPromptEngineV2OutputInstruction } from "./promptEngineV2";
import { sanitizeV2GeneratedLyrics } from "./lyricEngineV2";

export interface GenerateSongV2Deps {
  getAI: (apiKeyOverride?: string | null) => any;
  generateContentWithModelFallback: (
    ai: any,
    generateParams: any,
    context: string,
    modelChain?: string[],
  ) => Promise<any>;
  modelChain: string[];
}

type LanguageCode = "ko" | "en" | "ja" | "zh" | "es" | "fr" | "de" | "ru" | "th";

type FlatItem = {
  id?: string;
  label?: string;
  labelKo?: string;
  title?: string;
  titleKo?: string;
  promptCore?: string;
  description?: string;
  descriptionKo?: string;
  children?: FlatItem[];
  subGenres?: FlatItem[];
  variants?: FlatItem[];
};

const LANGUAGE_NAME_MAP: Record<LanguageCode, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  zh: "Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  ru: "Russian",
  th: "Thai",
};

const LANGUAGE_SCRIPT_MAP: Record<LanguageCode, string> = {
  ko: "Hangul Korean script",
  en: "standard English Latin alphabet",
  ja: "Japanese native script",
  zh: "Chinese Han characters",
  es: "standard Spanish Latin alphabet",
  fr: "standard French Latin alphabet",
  de: "standard German Latin alphabet",
  ru: "Russian Cyrillic script",
  th: "Thai script",
};

const V2_PRODUCTION_LABELS = ["Genre", "Sound", "Mood", "Vocals", "Production"] as const;

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function flattenItems(items: unknown[]): FlatItem[] {
  const out: FlatItem[] = [];
  const visit = (item: any) => {
    if (!item || typeof item !== "object") return;
    out.push(item);
    [item.children, item.subGenres, item.variants].forEach((childList) => {
      if (Array.isArray(childList)) childList.forEach(visit);
    });
  };
  items.forEach(visit);
  return out;
}

const ALL_LABEL_ITEMS: FlatItem[] = flattenItems([
  ...(GENRES as any[]),
  ...(GENRE_HIERARCHY as any[]),
  ...(SOUND_STYLES as any[]),
  ...(INSTRUMENT_SOUNDS as any[]),
  ...(MOODS as any[]),
  ...(THEMES as any[]),
]);

function fallbackLabel(id: unknown): string {
  return cleanText(id)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function itemLabel(item?: FlatItem | null): string {
  if (!item) return "";
  return cleanText(item.label || item.title || item.labelKo || item.titleKo || item.id || "");
}

function labelForId(id: unknown): string {
  const key = cleanText(id);
  if (!key) return "";
  const found = ALL_LABEL_ITEMS.find((item) => cleanText(item.id).toLowerCase() === key.toLowerCase());
  return itemLabel(found) || fallbackLabel(key);
}

function labelsForIds(ids: unknown): string[] {
  return unique(Array.isArray(ids) ? ids.map(labelForId) : []);
}

function valuesForIds(ids: unknown): string[] {
  return unique(Array.isArray(ids) ? ids.map((id) => cleanText(id)) : []);
}

function summarizeVocal(vocal: any): string {
  if (!vocal || typeof vocal !== "object") return "Natural solo vocal";
  const male = Number(vocal.male || 0);
  const female = Number(vocal.female || 0);
  const members = Array.isArray(vocal.members) ? vocal.members : [];
  const rapMode = cleanText(vocal.rapMode || (vocal.rap ? "on" : "auto"));
  const mode = cleanText(vocal.mode || (members.length > 1 || male + female > 1 ? "group" : "solo"));
  const parts: string[] = [];
  if (members.length) {
    parts.push(`${members.length} vocal member setup`);
    members.slice(0, 4).forEach((member: any, index: number) => {
      const roles = Array.isArray(member.roles) ? member.roles.join("/") : "vocal";
      parts.push(`Vocal ${index + 1}: ${member.gender || "any"}, ${roles}${member.tonePrompt ? `, ${member.tonePrompt}` : ""}`);
    });
  } else if (male || female) {
    parts.push(`${male} male / ${female} female vocal count`);
  }
  if (mode) parts.push(`mode: ${mode}`);
  if (vocal.tonePrompt) parts.push(`tone: ${vocal.tonePrompt}`);
  if (rapMode) parts.push(`rap mode: ${rapMode}`);
  return parts.length ? parts.join("; ") : "Natural solo vocal";
}

function summarizeStructure(params: any): string {
  if (params?.songStructure === "custom" && Array.isArray(params.customStructure) && params.customStructure.length) {
    return params.customStructure
      .map((item: any) => cleanText(item.labelEn || item.label || item.tagCue || item.kind || "Section"))
      .filter(Boolean)
      .join(" → ");
  }
  if (params?.songStructure === "2") return "Basic song structure with clear Verse / Chorus contrast";
  if (params?.songStructure === "3") return "Variant song structure with tasteful contrast";
  return "Adaptive song structure, choose the most musical section order";
}

function summarizeSituation(situation: any): string {
  if (!situation || typeof situation !== "object" || situation.enabled === false) return "";
  const pairs: string[] = [];
  [
    "targetA",
    "targetB",
    "relationship",
    "description",
    "development",
    "developmentPreset",
    "developmentCustom",
    "versionLabel",
    "speakerAStyle",
    "speakerAAttitude",
    "speakerAExtra",
    "speakerBStyle",
    "speakerBAttitude",
    "speakerBExtra",
  ].forEach((key) => {
    const value = cleanText(situation[key]);
    if (value) pairs.push(`${key}: ${value}`);
  });
  if (Array.isArray(situation.speakers) && situation.speakers.length) {
    situation.speakers.slice(0, 4).forEach((speaker: any, index: number) => {
      const value = [speaker.role, speaker.gender, speaker.ageRange, speaker.speechStyle, speaker.attitude, speaker.vocalDirection]
        .map(cleanText)
        .filter(Boolean)
        .join(", ");
      if (value) pairs.push(`speaker ${index + 1}: ${value}`);
    });
  }
  return pairs.join("\n");
}

function getRequestedLanguages(params: any): LanguageCode[] {
  if (params?.isNoLyrics || params?.includeLyrics === false) return [];
  const langs = Array.isArray(params?.lyricLanguages) && params.lyricLanguages.length ? params.lyricLanguages : ["ko"];
  return unique(langs).slice(0, 2) as LanguageCode[];
}

function buildLanguageInstruction(languages: LanguageCode[], params: any): string {
  if (!languages.length) return "No-lyrics mode: return lyrics.korean and lyrics.english as empty strings.";
  const scriptLines = languages
    .map((lang) => `- ${LANGUAGE_NAME_MAP[lang] || lang}: use ${LANGUAGE_SCRIPT_MAP[lang] || "its normal native script"}.`)
    .join("\n");
  const mixTargets = Array.isArray(params?.languageMixTargetLanguages) ? params.languageMixTargetLanguages : [];
  const mixRatio = Number(params?.englishMixRatio || 0);
  const mixInstruction = params?.isKoreanEnglishMix || mixTargets.length
    ? `\nLanguage mix mode: keep the primary lyric card natural, and use secondary-language phrases only as short rhythm points. Target mix ratio: ${Number.isFinite(mixRatio) ? mixRatio : 10}%.`
    : "";
  return `${scriptLines}${mixInstruction}`;
}

function buildSelectedInputSummary(params: any): string {
  const genre = unique([labelForId(params?.genre), ...labelsForIds(params?.subGenre), cleanText(params?.customGenreInput)]).join(" / ") || "No explicit genre selected";
  const style = unique([...labelsForIds(params?.styles), cleanText(params?.customStyleInput)]).join(", ") || "No style selected";
  const sound = unique([...labelsForIds(params?.instrumentSounds), ...labelsForIds(params?.pointSounds), cleanText(params?.customSoundInput)]).join(", ") || "No extra sound selected";
  const mood = unique([...labelsForIds(params?.moods), cleanText(params?.customMoodInput)]).join(", ") || "No mood selected";
  const theme = unique([...labelsForIds(params?.themes), cleanText(params?.customThemeInput)]).join(", ") || "No theme selected";
  const rawIds = {
    genre: cleanText(params?.genre),
    subGenre: valuesForIds(params?.subGenre),
    styles: valuesForIds(params?.styles),
    instrumentSounds: valuesForIds(params?.instrumentSounds),
    pointSounds: valuesForIds(params?.pointSounds),
    moods: valuesForIds(params?.moods),
    themes: valuesForIds(params?.themes),
  };

  return `GENRE: ${genre}
STYLE: ${style}
SOUND: ${sound}
MOOD: ${mood}
THEME: ${theme}
TEMPO: ${cleanText(params?.tempo) || (params?.isRandomTempo ? "random/adaptive" : "not selected")}
VOCAL: ${summarizeVocal(params?.vocal)}
STRUCTURE: ${summarizeStructure(params)}
USER DIRECTOR NOTE: ${cleanText(params?.userInput) || "none"}
LYRIC DRAFT MODE: ${cleanText(params?.lyricMode || (params?.isLyricMode ? "assist" : "none"))}
LYRIC DRAFT: ${cleanText(params?.lyricDraft) || "none"}
SITUATION:
${summarizeSituation(params?.situation) || "none"}
RAW SELECTION IDS: ${JSON.stringify(rawIds)}`;
}

function getRapMode(params: any): string {
  const raw = cleanText(params?.vocal?.rapMode).toLowerCase();
  if (raw === "off" || raw === "on" || raw === "auto") return raw;
  return params?.vocal?.rap ? "on" : "auto";
}

function defaultPromptLine(label: typeof V2_PRODUCTION_LABELS[number], params: any): string {
  const genre = unique([labelForId(params?.genre), ...labelsForIds(params?.subGenre), cleanText(params?.customGenreInput)]).join(" with ") || "genre-led pop fusion";
  const sound = unique([...labelsForIds(params?.instrumentSounds), ...labelsForIds(params?.styles), cleanText(params?.customSoundInput)]).slice(0, 6).join(", ") || "balanced core instruments, clean texture";
  const mood = unique([...labelsForIds(params?.moods), ...labelsForIds(params?.themes), cleanText(params?.customThemeInput), cleanText(params?.userInput)]).slice(0, 4).join(", ") || "clear emotional scene";
  const vocals = params?.isNoLyrics ? "Instrumental only, no vocals, no humming" : "natural vocal with story-aware delivery";
  const production = unique([cleanText(params?.tempo), summarizeStructure(params), params?.vocal?.rap ? "rap-aware section flow" : "focused hook flow"]).join(", ") || "clear sectional contrast";
  if (label === "Genre") return genre;
  if (label === "Sound") return sound;
  if (label === "Mood") return mood;
  if (label === "Vocals") return vocals;
  return production;
}

function extractPromptMap(prompt: string): Record<string, string> {
  const map: Record<string, string> = {};
  const classicToV2: Record<string, string> = {
    instruments: "Sound",
    atmosphere: "Mood",
    arrangement: "Production",
  };
  const lines = cleanText(prompt).split("\n");
  let currentLabel = "";
  for (const line of lines) {
    const match = line.trim().match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) {
      const raw = match[1].trim();
      const lower = raw.toLowerCase();
      const label = V2_PRODUCTION_LABELS.find((item) => item.toLowerCase() === lower) || classicToV2[lower] || "";
      currentLabel = label;
      if (label) map[label] = [map[label], match[2].trim()].filter(Boolean).join(" ");
      continue;
    }
    if (currentLabel && line.trim()) {
      map[currentLabel] = [map[currentLabel], line.trim()].filter(Boolean).join(" ");
    }
  }
  return map;
}

export function sanitizeV2ProductionPrompt(prompt: string, params: any): string {
  const map = extractPromptMap(prompt);
  const lines = V2_PRODUCTION_LABELS.map((label) => {
    const value = cleanText(map[label]).replace(/^[:\-–\s]+/, "") || defaultPromptLine(label, params);
    return `[${label}] ${value}`;
  });
  lines.push("[Audio quality improved to masterpiece]");
  return lines.join("\n");
}

function buildAppliedKeywords(params: any, geminiModelInfo: any): any {
  return {
    genre: params?.genre ? [params.genre] : [],
    subGenre: Array.isArray(params?.subGenre) ? params.subGenre : [],
    subGenreIds: Array.isArray(params?.subGenre) ? params.subGenre : [],
    mood: Array.isArray(params?.moods) ? params.moods : [],
    theme: Array.isArray(params?.themes) ? params.themes : [],
    situation: params?.situation,
    situationSummary: summarizeSituation(params?.situation),
    style: Array.isArray(params?.styles) ? params.styles : [],
    instrumentSound: Array.isArray(params?.instrumentSounds) ? params.instrumentSounds : [],
    pointSounds: Array.isArray(params?.pointSounds) ? params.pointSounds : [],
    customGenreInput: params?.customGenreInput,
    customMoodInput: params?.customMoodInput,
    customThemeInput: params?.customThemeInput,
    customStyleInput: params?.customStyleInput,
    customSoundInput: params?.customSoundInput,
    tempo: params?.tempo,
    tempoSource: params?.tempoSource,
    isRandomTempo: params?.isRandomTempo ?? false,
    vocal: params?.vocal,
    maleCount: params?.vocal?.male,
    femaleCount: params?.vocal?.female,
    rapEnabled: Boolean(params?.vocal?.rap),
    lyricsLength: params?.lyricsLength,
    songStructure: params?.songStructure,
    customStructure: params?.customStructure,
    kpopMode: params?.kpopMode ?? 0,
    isKoreanEnglishMix: Boolean(params?.isKoreanEnglishMix),
    lyricLanguages: params?.lyricLanguages,
    titleLanguages: params?.lyricLanguages,
    languageMixTargetLanguages: params?.languageMixTargetLanguages,
    isNoLyrics: Boolean(params?.isNoLyrics),
    includeLyrics: params?.includeLyrics,
    instrumentalBgmMode: Boolean(params?.instrumentalBgmMode),
    userInput: params?.userInput ?? "",
    lyricDraft: params?.lyricDraft,
    isLyricMode: params?.isLyricMode,
    lyricMode: params?.lyricMode,
    generationEngineVersion: "v2",
    geminiUsedModel: geminiModelInfo?.usedModel,
    geminiFallbackUsed: Boolean(geminiModelInfo?.fallbackUsed),
    geminiFallbackFrom: geminiModelInfo?.fallbackFrom || null,
    geminiFallbackReason: geminiModelInfo?.fallbackReason || null,
    geminiAttemptedModels: geminiModelInfo?.attemptedModels,
  };
}

export async function generateSongV2(params: any, deps: GenerateSongV2Deps): Promise<SongResult> {
  const requestedLanguages = getRequestedLanguages(params);
  const wantsSecondary = requestedLanguages.some((lang) => lang !== "ko");
  const noLyrics = Boolean(params?.isNoLyrics || params?.includeLyrics === false || requestedLanguages.length === 0);
  const selectedInputSummary = buildSelectedInputSummary(params);
  const model = deps.modelChain[0];
  const systemInstruction = `SORIDRAW GENERATION ENGINE v2 — CLEAN-ROOM ROUTE
This is a clean v2 generation path. Do not use Classic/v1 repair logic, Classic label names, or Classic section-recovery habits.

${buildPromptEngineV2OutputInstruction({ isNoLyrics: noLyrics })}

SELECTED INPUTS:
${selectedInputSummary}

LANGUAGE RULES:
${buildLanguageInstruction(requestedLanguages, params)}

V2 CLEAN-ROOM RULES:
- Generate everything in one response. Do not request a second analysis pass.
- Return ONLY valid JSON that matches the schema.
- productionPrompt must use only [Genre], [Sound], [Mood], [Vocals], [Production], then [Audio quality improved to masterpiece].
- Never output Classic labels [Instruments], [Atmosphere], or [Arrangement].
- Do not write internal analysis, score tables, explanations, or implementation notes.
- Do not repair bad output by adding generic sections. Start with clean intent.
- Lyrics must use English section tags only and should sound natural for the selected language.
- If lyricDraft exists, preserve its core words, emotion, and line breath before expanding.
- If no-lyrics mode is active, keep lyrics.korean and lyrics.english empty.
- If only Korean lyrics are requested, keep lyrics.english empty.
- If a secondary lyric language is requested, write lyrics.english in that selected secondary language's normal script when it is not English.
- Rap Section is allowed only when rap mode is on or the custom structure clearly asks for rap. Current rap mode: ${getRapMode(params)}.`;

  const ai = deps.getAI(params?.geminiApiKey);
  const response = await deps.generateContentWithModelFallback(
    ai,
    {
      model,
      contents: "Generate a SORIDRAW v2 song result from the selected inputs. Return JSON only.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            koreanTitle: { type: Type.STRING },
            englishTitle: { type: Type.STRING },
            productionPrompt: { type: Type.STRING },
            lyrics: {
              type: Type.OBJECT,
              properties: {
                korean: { type: Type.STRING },
                english: { type: Type.STRING },
              },
              required: ["korean", "english"],
            },
          },
          required: ["title", "productionPrompt", "lyrics"],
        },
      },
    },
    "generateSong v2 clean-room",
    deps.modelChain,
  );

  let parsed: any;
  try {
    parsed = JSON.parse(response.text || "{}");
  } catch (error: any) {
    throw new Error(`Gemini v2 응답 형식 분석에 실패했습니다. (JSON parse 오류: ${error?.message || error})`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini v2 생성 응답 데이터가 이상 상태입니다. 다시 시도해 주세요.");
  }

  const title = cleanText(parsed.title || parsed.koreanTitle || parsed.englishTitle);
  if (!title) {
    throw new Error("Gemini v2가 정상적인 곡 제목을 생성하지 못했습니다. 다시 생성해 주세요.");
  }

  const geminiModelInfo = (response as any)?.__soridrawGeminiModelInfo || {
    usedModel: deps.modelChain[0],
    fallbackUsed: false,
    fallbackFrom: null,
    fallbackReason: null,
    attemptedModels: [...deps.modelChain],
  };

  const prompt = sanitizeV2ProductionPrompt(parsed.productionPrompt || parsed.prompt || "", params);
  let koreanLyrics = "";
  let secondaryLyrics = "";

  if (!noLyrics) {
    koreanLyrics = requestedLanguages.includes("ko")
      ? sanitizeV2GeneratedLyrics(parsed.lyrics?.korean || "", { language: "ko", rapMode: getRapMode(params) })
      : "";
    secondaryLyrics = wantsSecondary
      ? sanitizeV2GeneratedLyrics(parsed.lyrics?.english || "", { language: requestedLanguages.find((lang) => lang !== "ko") || "en", rapMode: getRapMode(params) })
      : "";
  }

  const result: SongResult & { productionPrompt?: string } = {
    title,
    koreanTitle: cleanText(parsed.koreanTitle || (requestedLanguages.includes("ko") ? title : "")) || undefined,
    englishTitle: cleanText(parsed.englishTitle || (!requestedLanguages.includes("ko") ? title : "")) || undefined,
    lyrics: {
      korean: koreanLyrics,
      english: secondaryLyrics,
    },
    prompt,
    productionPrompt: prompt,
    appliedKeywords: buildAppliedKeywords(params, geminiModelInfo),
    userInput: params?.userInput ?? "",
    situationSummary: summarizeSituation(params?.situation),
    geminiModelInfo,
  };

  return result;
}
