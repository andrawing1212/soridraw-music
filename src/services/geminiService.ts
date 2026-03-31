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
  SongDuration,
  SongResult,
  VocalConfig,
} from "../types";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

type LegacyGenreInput = string[];
type LegacyMoodInput = string[];
type LegacyThemeInput = string[];

interface GenerateSongParams {
  genre: string | null;
  moods: string[];
  styles?: string[];
  instrumentSounds?: string[];
  userInput: string;
  songPrompt?: string;
  lyricsLength?: LyricsLength;
  songDuration?: SongDuration;
  useAutoDuration?: boolean;
  vocal?: VocalConfig;
  tempo?: string;
  specialPrompt?: string;
  kpopMode?: 0 | 1 | 2;
}

type GenerateSongInput =
  | [
      LegacyGenreInput,
      LegacyMoodInput,
      LegacyThemeInput,
      string,
      string?,
      LyricsLength?,
      SongDuration?,
      boolean?,
      number?,
      number?,
      boolean?,
      string?,
      string?,
      0 | 1 | 2?
    ]
  | [GenerateSongParams];

function buildLyricGuidancePrompt(): string {
  return `
- Ensure clear line breaks between sections if sections are used.
- The lyrics should primarily follow the user's story/intention.
- Provide both English and Korean versions.
- Do not translate Korean literally; keep it natural and lyrical.
`.trim();
}

function calculateSongDuration(
  genres: string[],
  moods: string[],
  lyricsLength: LyricsLength
): "1" | "2" | "3" | "4" | "5" | "6" {
  let duration = 3;

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

  if (genres.some((g) => rapGenres.includes(g.toLowerCase()))) duration += 1;
  if (genres.some((g) => ambientGenres.includes(g.toLowerCase()))) duration -= 1;

  const energeticMoods = ["energetic", "dramatic", "bright", "upbeat", "powerful"];
  const calmMoods = [
    "calm",
    "dreamy",
    "loneliness",
    "peaceful",
    "healing",
    "relaxing",
  ];

  if (moods.some((m) => energeticMoods.includes(m.toLowerCase()))) duration += 0.5;
  if (moods.some((m) => calmMoods.includes(m.toLowerCase()))) duration -= 0.5;

  if (lyricsLength === "normal") duration += 0.5;
  if (lyricsLength === "very-short") duration -= 0.5;

  const clamped = Math.max(1, Math.min(6, Math.round(duration)));
  return clamped.toString() as "1" | "2" | "3" | "4" | "5" | "6";
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
      songDuration: first.songDuration ?? "3",
      useAutoDuration: first.useAutoDuration ?? true,
      vocal: first.vocal ?? { male: 0, female: 0, rap: false },
      tempo: first.tempo,
      specialPrompt: first.specialPrompt,
      kpopMode: first.kpopMode ?? 0,
    };
  }

  const [
    genres,
    moods,
    themes,
    userInput,
    songPrompt = "",
    lyricsLength = "normal",
    songDuration = "3",
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
    SongDuration?,
    boolean?,
    number?,
    number?,
    boolean?,
    string?,
    string?,
    0 | 1 | 2?
  ];

  return {
    genre: genres?.[0] ?? null,
    moods: moods ?? [],
    styles: themes ?? [],
    instrumentSounds: [],
    userInput: userInput ?? "",
    songPrompt: songPrompt ?? "",
    lyricsLength,
    songDuration,
    useAutoDuration,
    vocal: {
      male: maleCount,
      female: femaleCount,
      rap: rapEnabled,
    },
    tempo,
    specialPrompt,
    kpopMode,
  };
}

function buildAppliedKeywordPayload(
  params: GenerateSongParams,
  resolvedDuration: SongDuration
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
    songDuration: resolvedDuration,
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
  const resolvedDuration = (
    (params.useAutoDuration ?? true)
      ? calculateSongDuration(
          genresForDuration,
          params.moods ?? [],
          params.lyricsLength ?? "normal"
        )
      : (params.songDuration ?? "3")
  ) as SongDuration;

  const lyricGuidancePrompt = buildLyricGuidancePrompt();
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

  const kpopInstruction =
    params.kpopMode === 2
      ? "Use Korean and English naturally mixed in the lyrics when it supports the request."
      : "";

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
- Intended duration: about ${resolvedDuration} minutes.

Prompt rules:
${params.specialPrompt ? `- SPECIAL INSTRUCTION: ${params.specialPrompt}` : ""}
- ${params.tempo ? `TEMPO CONSTRAINT: ${params.tempo}` : "Tempo should be appropriate for the chosen direction."}
- Make the production prompt read like a real creative brief, not a keyword dump.
`.trim();

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

  result.appliedKeywords = {
    ...buildAppliedKeywordPayload(params, resolvedDuration),
    ...(result.appliedKeywords ?? {}),
    genre: result?.appliedKeywords?.genre ?? (params.genre ? [params.genre] : []),
    mood: result?.appliedKeywords?.mood ?? (params.moods ?? []),
    theme: result?.appliedKeywords?.theme ?? (params.styles ?? []),
    style: params.styles ?? [],
    instrumentSound: params.instrumentSounds ?? [],
    tempo: result?.appliedKeywords?.tempo ?? params.tempo,
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

  const response = await ai.models.generateContent({
    model,
    contents: lyrics,
    config: { systemInstruction },
  });

  return response.text || "";
}
