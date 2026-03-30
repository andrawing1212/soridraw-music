import { GoogleGenAI, Type } from "@google/genai";
import { BASE_PROMPTS, GENRE_GROUPS, SOUND_STYLES } from "../constants";
import { SongResult, LyricsLength, SongDuration, VocalConfig } from "../types";

// GEMINI API KEY
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

type LegacyGenreInput = string[];
type LegacyMoodInput = string[];
type LegacyThemeInput = string[];

interface GenerateSongParams {
  genre: string | null;
  moods: string[];
  theme: string | null;
  userInput: string;
  songPrompt?: string;
  lyricsLength?: LyricsLength;
  songDuration?: SongDuration;
  useAutoDuration?: boolean;
  vocal?: VocalConfig;
  tempo?: string;
  specialPrompt?: string;
  kpopMode?: 0 | 1 | 2;
  isBallad?: boolean;
  soundStyle?: string | null;
}

/**
 * 현재 App.tsx 호환 + 다음 구조 대응
 * - 현재 App.tsx는 기존 시그니처로 호출
 * - 이후 App.tsx 리팩토링 후 객체 시그니처도 받을 수 있음
 */
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

/**
 * Basic lyric guidance.
 */
function buildLyricGuidancePrompt(): string {
  return `
- CRITICAL: Ensure clear line breaks between sections if sections are used.
- CRITICAL: The content of the lyrics MUST be influenced ONLY by the 'Themes' and 'User Story'.
- Provide both English and Korean versions.
- CRITICAL: When providing Korean titles and lyrics, do NOT translate English literally.
  Instead, capture the lyrical and poetic essence of the song to make it feel natural,
  emotionally resonant, and beautiful in Korean.
  The Korean lyrics should read like a standalone poem or song.
`.trim();
}

function buildLegacyVocalPrompt(
  maleCount: number,
  femaleCount: number,
  rapEnabled: boolean
): string {
  const vibes: string[] = [];

  if (maleCount > 0 || femaleCount > 0) {
    vibes.push("vocal-focused");
  }
  if (rapEnabled) {
    vibes.push("with rap elements");
  }

  const description = `The song should have a ${
    maleCount + femaleCount > 1 ? "group" : "solo"
  } vocal vibe.`;

  return `${description} ${vibes.join(", ")}`.trim();
}

function buildVocalPrompt(vocal: VocalConfig): string {
  const vocalDescription: string[] = [];

  const getDesc = (gender: string, count: number) => {
    if (count === 1) return `${gender} solo vocal`;
    if (count === 2) return `${gender} duo vocal`;
    if (count >= 3) return `${gender} group vocal`;
    return null;
  };

  const male = getDesc("male", vocal.male);
  const female = getDesc("female", vocal.female);

  if (male) vocalDescription.push(male);
  if (female) vocalDescription.push(female);
  if (vocal.rap) vocalDescription.push("rap section included");

  return vocalDescription.join(", ") || "default vocal setup";
}

/**
 * Calculates a dynamic song duration based on genres, moods, and lyricsLength.
 */
function calculateSongDuration(
  genres: string[],
  moods: string[],
  lyricsLength: LyricsLength
): "1" | "2" | "3" | "4" | "5" | "6" {
  let duration = 3;

  const rapGenres = ["rap", "hiphop"];
  const ambientGenres = ["ambient", "jazz"];

  if (genres.some(g => rapGenres.includes(g.toLowerCase()))) duration += 1;
  if (genres.some(g => ambientGenres.includes(g.toLowerCase()))) duration -= 1;

  const energeticMoods = ["energetic", "dramatic", "bright", "upbeat", "powerful"];
  const calmMoods = ["calm", "dreamy", "lonely", "peaceful", "healing"];

  if (moods.some(m => energeticMoods.includes(m.toLowerCase()))) duration += 0.5;
  if (moods.some(m => calmMoods.includes(m.toLowerCase()))) duration -= 0.5;

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

function getSoundStylePromptCore(soundStyleId?: string | null): string {
  if (!soundStyleId) return "";
  return SOUND_STYLES.find((item) => item.id === soundStyleId)?.promptCore ?? "";
}

function buildBalladPrompt(isBallad?: boolean): string {
  if (!isBallad) return "";
  return "The track follows a ballad-style structure with slower pacing, emotional focus, and a vocal-centered arrangement.";
}

function normalizeArgs(args: GenerateSongInput): GenerateSongParams {
  const first = args[0];

  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    return {
      genre: first.genre ?? null,
      moods: first.moods ?? [],
      theme: first.theme ?? null,
      userInput: first.userInput ?? "",
      songPrompt: first.songPrompt,
      lyricsLength: first.lyricsLength ?? "normal",
      songDuration: first.songDuration ?? "3",
      useAutoDuration: first.useAutoDuration ?? true,
      vocal: first.vocal ?? { male: 0, female: 0, rap: false },
      tempo: first.tempo,
      specialPrompt: first.specialPrompt,
      kpopMode: first.kpopMode ?? 0,
      isBallad: first.isBallad ?? false,
      soundStyle: first.soundStyle ?? null,
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
    theme: themes?.[0] ?? null,
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
    isBallad: genres?.includes("Ballad") || genres?.includes("ballad") || false,
    soundStyle: null,
  };
}

function buildAppliedKeywordPayload(params: GenerateSongParams, resolvedDuration: SongDuration, tempo?: string) {
  const genreArray = params.genre ? [params.genre] : [];
  const themeArray = params.theme ? [params.theme] : [];

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
    genre: genreArray,
    mood: params.moods ?? [],
    theme: themeArray,
    tempo,
    vocalType: vocalDescription.join(" + ") || "Default",
    lyricsLength: params.lyricsLength,
    songDuration: resolvedDuration,
    maleCount: params.vocal?.male ?? 0,
    femaleCount: params.vocal?.female ?? 0,
    rapEnabled: params.vocal?.rap ?? false,
    vocal: params.vocal ?? { male: 0, female: 0, rap: false },
    isBallad: Boolean(params.isBallad),
    soundStyle: params.soundStyle ?? null,
  };
}

export async function generateSong(...args: GenerateSongInput): Promise<SongResult> {
  const params = normalizeArgs(args);
  const model = "gemini-3-flash-preview";

  const genresForDuration = params.genre ? [params.genre] : [];
  const resolvedDuration = (
    params.useAutoDuration ?? true
      ? calculateSongDuration(genresForDuration, params.moods ?? [], params.lyricsLength ?? "normal")
      : (params.songDuration ?? "3")
  ) as SongDuration;

  const vocalPrompt =
    params.vocal
      ? buildVocalPrompt(params.vocal)
      : buildLegacyVocalPrompt(0, 0, false);

  const lyricGuidancePrompt = buildLyricGuidancePrompt();
  const genrePromptCore = getGenrePromptCore(params.genre);
  const soundStylePromptCore = getSoundStylePromptCore(params.soundStyle);
  const balladPrompt = buildBalladPrompt(params.isBallad);

  const fallbackPrompt =
    params.songPrompt && params.songPrompt.trim().length > 0
      ? params.songPrompt
      : [
          genrePromptCore,
          soundStylePromptCore,
          balladPrompt,
          params.tempo ? `Tempo: ${params.tempo}` : "",
        ]
          .filter(Boolean)
          .join("\n");

  const kpopInstruction =
    params.kpopMode === 2
      ? `
CRITICAL K-POP STYLE (Korean + English Mixed Version):
- For 'lyrics.korean': Generate K-Pop style lyrics that are primarily in Korean but naturally code-switch with English.
  - CONSTRAINT: English usage should be approximately 25-30% of the total song content.
- For 'lyrics.english': Generate K-Pop style lyrics that are primarily in English but naturally code-switch with Korean.
  - CONSTRAINT: Korean usage should be approximately 25-30% of the total song content.
  - Mix in Korean at the end of sentences or for core keywords.
- The code-switching ratio does NOT need to be identical between the two versions.
- Ensure the code-switching feels natural and uses words relevant to the song's theme and user story.
`
      : "";

  const basePromptSeed = BASE_PROMPTS.length > 0 ? BASE_PROMPTS[0] : "";

  const systemInstruction = `
${fallbackPrompt}

${genrePromptCore ? `GENRE CORE:\n- ${genrePromptCore}` : ""}
${soundStylePromptCore ? `SOUND STYLE:\n- ${soundStylePromptCore}` : ""}
${balladPrompt ? `BALLAD OPTION:\n- ${balladPrompt}` : ""}
${basePromptSeed ? `REFERENCE STYLE SEED:\n- ${basePromptSeed}` : ""}

You are a professional music composer and lyricist.
Your task is to generate a song based on the provided genre, moods, theme, vocal setup, and user story.

${kpopInstruction}

Output Format:
Return a JSON object with the following structure:
{
  "title": "[Genre]'English Title'│'Korean Title'",
  "lyrics": {
    "english": "Full English lyrics.",
    "korean": "Full Korean lyrics."
  },
  "prompt": "A detailed music production prompt",
  "appliedKeywords": {
    "genre": ["genre"],
    "mood": ["mood1", "mood2"],
    "theme": ["theme"],
    "tempo": "tempo info if provided",
    "vocalType": "vocal description"
  }
}

Rules for Title:
- Use at most one main genre in the brackets.
- Format: [Genre] 'English Title' │ 'Korean Title'

Rules for Lyrics:
${lyricGuidancePrompt}
- CRITICAL: The content of the lyrics MUST be influenced ONLY by the 'Theme' and 'User Story'.
- CRITICAL: The 'Genre' and 'Moods' should NOT directly dictate the story content, but should influence the musical atmosphere and production prompt.
- Provide both English and Korean versions.
- Keep the lyrics natural and musically singable.
- The intended song duration is approximately ${resolvedDuration} minutes.

Rules for Prompt:
${params.specialPrompt ? `- SPECIAL GENRE INSTRUCTION: ${params.specialPrompt}` : ""}
- ${params.tempo ? `TEMPO CONSTRAINT: ${params.tempo}` : "Tempo should be appropriate for the genre and mood."}
- VOCAL CONFIGURATION: ${vocalPrompt}
${balladPrompt ? `- BALLAD OPTION: ${balladPrompt}` : ""}
${soundStylePromptCore ? `- SOUND STYLE OPTION: ${soundStylePromptCore}` : ""}

Keywords to use:
Genre: ${params.genre ?? "Pop"}
Moods: ${(params.moods ?? []).join(", ")}
Theme: ${params.theme ?? ""}
User Story: ${params.userInput}
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
              korean: { type: Type.STRING }
            },
            required: ["english", "korean"]
          },
          prompt: { type: Type.STRING },
          appliedKeywords: {
            type: Type.OBJECT,
            properties: {
              genre: { type: Type.ARRAY, items: { type: Type.STRING } },
              mood: { type: Type.ARRAY, items: { type: Type.STRING } },
              theme: { type: Type.ARRAY, items: { type: Type.STRING } },
              tempo: { type: Type.STRING },
              vocalType: { type: Type.STRING }
            },
            required: ["genre", "mood", "theme"]
          }
        },
        required: ["title", "lyrics", "prompt", "appliedKeywords"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");

  result.appliedKeywords = {
    ...buildAppliedKeywordPayload(params, resolvedDuration, params.tempo),
    ...(result.appliedKeywords ?? {}),
    genre: result?.appliedKeywords?.genre ?? (params.genre ? [params.genre] : []),
    mood: result?.appliedKeywords?.mood ?? (params.moods ?? []),
    theme: result?.appliedKeywords?.theme ?? (params.theme ? [params.theme] : []),
    tempo: result?.appliedKeywords?.tempo ?? params.tempo,
  };

  if (!result.prompt || typeof result.prompt !== "string") {
    result.prompt = fallbackPrompt || basePromptSeed || "";
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
Your task is to translate the provided lyrics into ${targetLanguage}.

CRITICAL:
- Maintain the original structure and line breaks.
- Do NOT translate literally. Capture the lyrical and poetic essence.
- The translated lyrics should feel natural and emotionally resonant in ${targetLanguage}.
- Return ONLY the translated lyrics text.
`.trim();

  const response = await ai.models.generateContent({
    model,
    contents: lyrics,
    config: {
      systemInstruction
    }
  });

  return response.text || "";
}
