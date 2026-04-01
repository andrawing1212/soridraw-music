import { GoogleGenAI, Type } from "@google/genai";
import {
  BASE_PROMPTS,
  BASIC_STRUCTURE,
  GENRE_GROUPS,
  INSTRUMENT_SOUNDS,
  SOUND_STYLES,
} from "../constants";
import {
  LyricsLength,
  SongStructure,
  SongResult,
  VocalConfig,
  CustomSectionItem,
} from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Try VITE_ prefixed first (standard for Vite), then fallback to standard GEMINI_API_KEY
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("Gemini API key is not defined. Please set VITE_GEMINI_API_KEY or GEMINI_API_KEY in your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

type LegacyGenreInput = string[];
type LegacyMoodInput = string[];
type LegacyThemeInput = string[];

interface GenerateSongParams {
  genre: string | null;
  isKpopSelected?: boolean;
  moods: string[];
  styles?: string[];
  instrumentSounds?: string[];
  userInput: string;
  songPrompt?: string;
  lyricsLength?: LyricsLength;
  songStructure?: SongStructure;
  useAutoDuration?: boolean;
  vocal?: VocalConfig;
  tempo?: string;
  specialPrompt?: string;
  kpopMode?: 0 | 1 | 2;
  customStructure?: CustomSectionItem[];
}

type GenerateSongInput =
  | [
      LegacyGenreInput,
      LegacyMoodInput,
      LegacyThemeInput,
      string,
      string?,
      LyricsLength?,
      SongStructure?,
      boolean?,
      number?,
      number?,
      boolean?,
      string?,
      string?,
      (0 | 1 | 2)?
    ]
  | [GenerateSongParams];

function buildLyricsLengthInstruction(lyricsLength: LyricsLength = "normal"): string {
  switch (lyricsLength) {
    case "very-short":
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: 더짧게 (very-short).
- Keep the lyrics extremely concise.
- Target about 2-3 lyric lines per major section.
- Avoid extra filler lines, repeated padding, long storytelling passages, and unnecessary ad-libs.
- Keep verses, pre-chorus, bridge, and outro notably compact.
- Chorus may repeat hook phrases, but the overall lyric body must still stay short.`;
    case "short":
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: 짧게 (short).
- Keep the lyrics shorter than a standard pop lyric.
- Target about 3-4 lyric lines per major section.
- Use concise imagery and tighter phrasing.
- Avoid long verses, excessive repetition, and over-explaining the story.
- Chorus can be memorable, but keep the overall lyric count restrained.`;
    case "long":
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: 길게 (long).
- Write noticeably longer lyrics than a standard song.
- Target about 6-8 lyric lines per major section.
- Expand the storytelling, imagery, and emotional development.
- Verses, bridge, and final chorus should feel fuller and more developed.
- Do not keep the lyric body short or overly minimal.`;
    case "normal":
    default:
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: 기본 (normal).
- Use a standard mainstream song lyric length.
- Target about 4-6 lyric lines per major section.
- Keep a natural balance between storytelling, repetition, and hook development.
- Do not make the lyrics unusually short or excessively long.`;
  }
}

function buildLyricGuidancePrompt(lyricsLength: LyricsLength = "normal"): string {
  return `
- Ensure clear line breaks between sections if sections are used.
- The lyrics should primarily follow the user's story/intention.
- Provide both English and Korean versions.
- Do not translate Korean literally; keep it natural and lyrical.
${buildLyricsLengthInstruction(lyricsLength)}
`.trim();
}

function calculateSongStructure(
  genres: string[],
  moods: string[],
  lyricsLength: LyricsLength
): "1" | "2" | "3" {
  let structure = 2;

  const rapGenres = [
    "trap",
    "drill",
    "boom-bap",
    "gangsta-rap",
    "lofi-hiphop",
  ];
  const ambientGenres = [
    "ambient-electronic",
    "ambient-newage",
    "meditation-music",
  ];

  if (genres.some((g) => rapGenres.includes(g.toLowerCase()))) structure += 1;
  if (genres.some((g) => ambientGenres.includes(g.toLowerCase()))) structure -= 1;

  const energeticMoods = ["energetic", "dramatic", "bright", "upbeat", "powerful"];
  const calmMoods = [
    "calm",
    "dreamy",
    "loneliness",
    "peaceful",
    "healing",
    "relaxing",
  ];

  if (moods.some((m) => energeticMoods.includes(m.toLowerCase()))) structure += 0.5;
  if (moods.some((m) => calmMoods.includes(m.toLowerCase()))) structure -= 0.5;

  if (lyricsLength === "very-short") structure -= 0.5;
  if (lyricsLength === "long") structure += 0.5;

  const clamped = Math.max(1, Math.min(3, Math.round(structure)));
  return clamped.toString() as "1" | "2" | "3";
}

function getGenrePromptCore(genreId: string | null): string {
  if (!genreId) return "";

  for (const group of GENRE_GROUPS) {
    const found = group.children.find((child) => child.id === genreId);
    if (found) return found.promptCore;
  }

  return "";
}

function getStylePromptCores(styleIds: string[] = []): string[] {
  return styleIds
    .map((id) => SOUND_STYLES.find((item) => item.id === id)?.promptCore ?? "")
    .filter(Boolean);
}

function getInstrumentSoundPromptCores(ids: string[] = []): string[] {
  return ids
    .map((id) => INSTRUMENT_SOUNDS.find((item) => item.id === id)?.promptCore ?? "")
    .filter(Boolean);
}

function buildMoodPrompt(moods: string[]): string {
  return moods.length ? `Mood direction: ${moods.join(", ")}.` : "";
}

function buildVocalPrompt(vocal: VocalConfig): string {
  const lines: string[] = [];
  const total = (vocal.male ?? 0) + (vocal.female ?? 0);

  if (total <= 1) lines.push("Vocal formation: solo.");
  else if (total === 2) lines.push("Vocal formation: duo.");
  else lines.push("Vocal formation: group.");

  if ((vocal.male ?? 0) > 0 && (vocal.female ?? 0) > 0) {
    lines.push(`Vocal gender mix: ${vocal.male} male, ${vocal.female} female.`);
  } else if ((vocal.male ?? 0) > 0) {
    lines.push(`Use male vocals only (${vocal.male}). Do not use female vocals.`);
  } else if ((vocal.female ?? 0) > 0) {
    lines.push(`Use female vocals only (${vocal.female}). Do not use male vocals.`);
  } else {
    lines.push("No strong vocal restriction; default to the arrangement that best fits the request.");
  }

  lines.push(vocal.rap ? "Rap is included." : "Do not include rap unless the user explicitly asks for it.");

  return lines.join(" ");
}

function normalizeArgs(args: GenerateSongInput): GenerateSongParams {
  const first = args[0];

  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    return {
      genre: first.genre ?? null,
      moods: first.moods ?? [],
      styles: first.styles ?? [],
      instrumentSounds: first.instrumentSounds ?? [],
      userInput: first.userInput ?? "",
      songPrompt: first.songPrompt,
      lyricsLength: first.lyricsLength ?? "normal",
      songStructure: first.songStructure ?? "2",
      useAutoDuration: first.useAutoDuration ?? true,
      vocal: first.vocal ?? { male: 0, female: 0, rap: false },
      tempo: first.tempo,
      specialPrompt: first.specialPrompt,
      kpopMode: first.kpopMode ?? 0,
      isKpopSelected: first.isKpopSelected ?? false,
      customStructure: first.customStructure ?? [],
    };
  }

  const [
    genres,
    moods,
    themes,
    userInput,
    songPrompt = "",
    lyricsLength = "normal",
    songStructure = "2",
    useAutoDuration = true,
    maleCount = 0,
    femaleCount = 0,
    rapEnabled = false,
    tempo,
    specialPrompt,
    kpopMode = 0,
  ] = args as [
    LegacyGenreInput,
    LegacyMoodInput,
    LegacyThemeInput,
    string,
    string?,
    LyricsLength?,
    SongStructure?,
    boolean?,
    number?,
    number?,
    boolean?,
    string?,
    string?,
    (0 | 1 | 2)?
  ];

  return {
    genre: genres?.[0] ?? null,
    moods: moods ?? [],
    styles: themes ?? [],
    instrumentSounds: [],
    userInput: userInput ?? "",
    songPrompt: songPrompt ?? "",
    lyricsLength,
    songStructure,
    useAutoDuration,
    vocal: {
      male: maleCount,
      female: femaleCount,
      rap: rapEnabled,
    },
    tempo,
    specialPrompt,
    kpopMode,
    isKpopSelected: genres?.includes("kpop") ?? false,
    customStructure: [],
  };
}

function containsLatin(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

function containsHangul(text: string): boolean {
  return /[가-힣]/.test(text);
}

function injectMixedPhrases(
  text: string,
  phrases: string[],
  detector: (text: string) => boolean
): string {
  if (!text.trim() || detector(text)) return text;

  const lines = text.split("\n");
  let phraseIndex = 0;
  let injected = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || /^\[.*\]$/.test(line)) continue;

    const phrase = phrases[phraseIndex % phrases.length];
    phraseIndex += 1;

    if (!lines[i].includes(phrase)) {
      lines[i] = `${lines[i]} ${phrase}`.trim();
      injected += 1;
    }

    if (injected >= 3) break;
  }

  return lines.join("\n");
}

function enforceKpopMixedLyrics(
  lyrics: { english: string; korean: string }
): { english: string; korean: string } {
  const koreanMixed = injectMixedPhrases(
    lyrics.korean ?? "",
    ["(Stay tonight)", "(You and I)", "(Feel alive)"],
    containsLatin
  );

  const englishMixed = injectMixedPhrases(
    lyrics.english ?? "",
    ["(이 밤에)", "(너와 나)", "(괜찮아)"],
    containsHangul
  );

  return {
    korean: koreanMixed,
    english: englishMixed,
  };
}

function buildAppliedKeywordPayload(
  params: GenerateSongParams,
  resolvedStructure: SongStructure
) {
  const styles = params.styles ?? [];
  const vocalDescription: string[] = [];

  const getDesc = (gender: string, count: number) => {
    if (count === 1) return `${gender} Solo`;
    if (count === 2) return `${gender} Duo`;
    if (count >= 3) return `${gender} Group`;
    return null;
  };

  const maleDesc = getDesc("Male", params.vocal?.male ?? 0);
  const femaleDesc = getDesc("Female", params.vocal?.female ?? 0);

  if (maleDesc) vocalDescription.push(maleDesc);
  if (femaleDesc) vocalDescription.push(femaleDesc);
  if (params.vocal?.rap) vocalDescription.push("Rap");

  return {
    genre: params.genre ? [params.genre] : [],
    mood: params.moods ?? [],
    theme: styles,
    style: styles,
    instrumentSound: params.instrumentSounds ?? [],
    tempo: params.tempo,
    vocalType: vocalDescription.join(" + ") || "Default",
    lyricsLength: params.lyricsLength,
    songStructure: params.songStructure === "custom" ? "custom" : resolvedStructure,
    customStructure: params.songStructure === "custom" ? (params.customStructure ?? []) : undefined,
    maleCount: params.vocal?.male ?? 0,
    femaleCount: params.vocal?.female ?? 0,
    rapEnabled: params.vocal?.rap ?? false,
    vocal: params.vocal ?? { male: 0, female: 0, rap: false },
  };
}

export async function generateSong(...args: GenerateSongInput): Promise<SongResult> {
  const params = normalizeArgs(args);
  const model = "gemini-3-flash-preview";

  const genresForDuration = params.genre ? [params.genre] : [];
  const resolvedStructure = (
    (params.useAutoDuration ?? true)
      ? calculateSongStructure(
          genresForDuration,
          params.moods ?? [],
          params.lyricsLength ?? "normal"
        )
      : (params.songStructure ?? "2")
  ) as SongStructure;

  const lyricGuidancePrompt = buildLyricGuidancePrompt(params.lyricsLength ?? "normal");
  const genrePromptCore = getGenrePromptCore(params.genre);
  const stylePromptCores = getStylePromptCores(params.styles ?? []);
  const instrumentSoundPromptCores = getInstrumentSoundPromptCores(
    params.instrumentSounds ?? []
  );
  const moodPrompt = buildMoodPrompt(params.moods ?? []);
  const vocalPrompt = buildVocalPrompt(
    params.vocal ?? { male: 0, female: 0, rap: false }
  );
  const basePromptSeed = BASE_PROMPTS.join("\n");

  const isKpopMixedMode = params.isKpopSelected && params.kpopMode === 2;

  const kpopInstruction = isKpopMixedMode
    ? `K-POP MIXED LANGUAGE MODE (MANDATORY):
- This request is specifically for K-Pop with Korean/English mixed lyrics.
- Ratio: 70-75% Korean, 25-30% English.
- Focus: English should be used primarily in choruses, hooks, and key points for impact.
- Style: Natural K-Pop style, not forced.
- For lyrics.korean: keep Korean as the main language, but include natural English words or short phrases in MULTIPLE sections.
- For lyrics.english: keep English as the main language, but include natural Korean words or short phrases in MULTIPLE sections.
- The chorus MUST contain visible code-switching.
- Do not keep the two versions fully separated by language. The mixed-language feel must be obvious at a glance.
- Keep the code-switching natural and melodic, like commercial K-Pop toplines and hooks.`
    : "";

  const structureTemplateMap: Record<Exclude<SongStructure, "custom">, { label: string; recommendedLength: string; instruction: string }> = {
    "1": {
      label: "Structure 1",
      recommendedLength: "about 1-2 minutes",
      instruction: "Use a short and concise song form: Intro → Verse 1 → Chorus / Drop → Outro. Avoid Verse 2 and Bridge unless absolutely necessary.",
    },
    "2": {
      label: "Structure 2",
      recommendedLength: "about 2-4 minutes",
      instruction: `Use a standard mainstream form: ${BASIC_STRUCTURE}`,
    },
    "3": {
      label: "Structure 3",
      recommendedLength: "about 4-6 minutes",
      instruction: "Use an extended song form with a fuller build-up: Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro. Allow a larger emotional build and extra repetition where musically appropriate.",
    },
  };

  const structureInstruction = params.songStructure === "custom"
    ? (params.customStructure && params.customStructure.length > 0
      ? `SONG STRUCTURE (MANDATORY):
- Selected mode: Custom.
- You MUST follow this structure exactly: ${params.customStructure.map(s => `${s.section}${s.tags.length > 0 ? ` (${s.tags.join(', ')})` : ''}`).join(" → ")}.
- Do not add, remove, or change any sections.
- For sections with tags in parentheses, apply those musical directions (e.g., "Verse 1 (Solo)" means Verse 1 should be a solo vocal).`
      : `SONG STRUCTURE (FALLBACK):
- Selected mode: Custom, but no custom section order was provided.
- Fallback to the standard structure: ${BASIC_STRUCTURE}`)
    : `SONG STRUCTURE (MANDATORY):
- Selected mode: ${structureTemplateMap[resolvedStructure].label}.
- Recommended song length: ${structureTemplateMap[resolvedStructure].recommendedLength}.
- ${structureTemplateMap[resolvedStructure].instruction}`;

  const systemInstruction = `
You are a professional music composer and lyricist.

USER CREATIVE INTENT (HIGHEST PRIORITY):
${params.userInput || "No extra user description."}

IMPORTANT:
- The user input overrides stylistic assumptions if conflict occurs.
- Treat user intent as the primary creative direction.

ROOT GENRE:
${genrePromptCore || "Choose an appropriate mainstream-friendly root genre if none is given."}

STYLE LAYERS:
${stylePromptCores.length ? stylePromptCores.map((s) => `- ${s}`).join("\n") : "- No extra style layer selected."}

INSTRUMENT / SOUND LAYERS:
${instrumentSoundPromptCores.length ? instrumentSoundPromptCores.map((s) => `- ${s}`).join("\n") : "- No extra instrument/sound layer selected."}

MOOD LAYER:
${moodPrompt || "No explicit mood layer selected."}

VOCAL DIRECTION (HIGH PRIORITY):
${vocalPrompt}

REFERENCE PRINCIPLES:
${basePromptSeed}

${kpopInstruction}

${structureInstruction}

Return JSON:
{
  "title": "[Genre] 'English Title' │ 'Korean Title'",
  "lyrics": { "english": "Full English lyrics.", "korean": "Full Korean lyrics." },
  "prompt": "A detailed music production prompt",
  "appliedKeywords": {
    "genre": ["genre"],
    "mood": ["mood1", "mood2"],
    "theme": ["style1", "style2"],
    "tempo": "tempo info if provided",
    "vocalType": "vocal description"
  }
}

Lyrics rules:
${lyricGuidancePrompt}
- The lyrics should primarily follow the user's story/intention.
- Genre, style, instrument/sound, and mood should strongly shape the music-production prompt and overall atmosphere.
- Respect the selected lyricsLength strictly.
- This lyricsLength rule applies to every genre.
- Respect the selected song structure strictly.
- Respect the selected lyricsLength strictly. Do not drift longer than the requested lyric size.
- This lyricsLength rule applies to every genre, not only ballad, jazz, or specific styles.

Prompt rules:
${params.specialPrompt ? `- SPECIAL INSTRUCTION: ${params.specialPrompt}` : ""}
- ${params.tempo ? `TEMPO CONSTRAINT: ${params.tempo}` : "Tempo should be appropriate for the chosen direction."}
- Make the production prompt read like a real creative brief, not a keyword dump.
`.trim();

  const ai = getAI();
  const response = await ai.models.generateContent({
    model,
    contents: "Generate a song based on the system instructions.",
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          lyrics: {
            type: Type.OBJECT,
            properties: {
              english: { type: Type.STRING },
              korean: { type: Type.STRING },
            },
            required: ["english", "korean"],
          },
          prompt: { type: Type.STRING },
          appliedKeywords: {
            type: Type.OBJECT,
            properties: {
              genre: { type: Type.ARRAY, items: { type: Type.STRING } },
              mood: { type: Type.ARRAY, items: { type: Type.STRING } },
              theme: { type: Type.ARRAY, items: { type: Type.STRING } },
              tempo: { type: Type.STRING },
              vocalType: { type: Type.STRING },
            },
            required: ["genre", "mood", "theme"],
          },
        },
        required: ["title", "lyrics", "prompt", "appliedKeywords"],
      },
    },
  });

  const result = JSON.parse(response.text || "{}");

  if (isKpopMixedMode && result.lyrics) {
    result.lyrics = enforceKpopMixedLyrics(result.lyrics);
  }

  result.appliedKeywords = {
    ...buildAppliedKeywordPayload(params, resolvedStructure),
    ...(result.appliedKeywords ?? {}),
    genre: result?.appliedKeywords?.genre ?? (params.genre ? [params.genre] : []),
    mood: result?.appliedKeywords?.mood ?? (params.moods ?? []),
    theme: result?.appliedKeywords?.theme ?? (params.styles ?? []),
    style: params.styles ?? [],
    instrumentSound: params.instrumentSounds ?? [],
    tempo: result?.appliedKeywords?.tempo ?? params.tempo,
    kpopMode: params.kpopMode ?? 0,
  };

  if (!result.prompt || typeof result.prompt !== "string") {
    result.prompt = [
      genrePromptCore,
      ...stylePromptCores,
      ...instrumentSoundPromptCores,
      moodPrompt,
      params.tempo ? `Tempo: ${params.tempo}` : "",
      params.userInput ? `User intent: ${params.userInput}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return result as SongResult;
}

export async function translateLyrics(
  lyrics: string,
  targetLanguage: "korean" | "english"
): Promise<string> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
You are a professional lyricist and translator.
Translate the provided lyrics into ${targetLanguage}.
- Maintain the original structure and line breaks.
- Do not translate literally. Keep it natural and lyrical.
- Return only the translated lyrics text.
`.trim();

  const ai = getAI();
  const response = await ai.models.generateContent({
    model,
    contents: lyrics,
    config: { systemInstruction },
  });

  return response.text || "";
}
