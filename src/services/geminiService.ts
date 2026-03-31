import { GoogleGenAI, Type } from "@google/genai";
import { BASE_PROMPTS, GENRE_GROUPS } from "../constants";
import { SongResult, LyricsLength, SongDuration, VocalConfig } from "../types";

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
  styles?: string[];
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
- CRITICAL: Ensure clear line breaks between sections if sections are used.
- CRITICAL: The content of the lyrics MUST be influenced ONLY by the selected styles and user story.
- Provide both English and Korean versions.
- Do NOT translate Korean literally from English. Make it feel natural and lyrical.
`.trim();
}

function buildVocalPrompt(vocal: VocalConfig): string {
  const parts: string[] = [];
  if (vocal.male > 0) parts.push(vocal.male === 1 ? 'male solo vocal' : 'male vocal team');
  if (vocal.female > 0) parts.push(vocal.female === 1 ? 'female solo vocal' : 'female vocal team');
  if (vocal.rap) parts.push('rap section included');
  return parts.join(', ') || 'default vocal setup';
}

function calculateSongDuration(
  genres: string[],
  moods: string[],
  lyricsLength: LyricsLength
): SongDuration {
  let duration = 3;
  if (genres.some(g => ['trap', 'drill', 'film-score'].includes(g))) duration += 1;
  if (moods.some(m => ['calm', 'peaceful', 'healing'].includes(m.toLowerCase()))) duration -= 0.5;
  if (moods.some(m => ['powerful', 'upbeat'].includes(m.toLowerCase()))) duration += 0.5;
  if (lyricsLength === 'very-short') duration -= 0.5;
  if (lyricsLength === 'normal') duration += 0.5;
  return String(Math.max(1, Math.min(6, Math.round(duration)))) as SongDuration;
}

function getGenrePromptCore(genreId: string | null): string {
  if (!genreId) return '';
  for (const group of GENRE_GROUPS) {
    const found = group.children.find((item) => item.id === genreId);
    if (found) return found.promptCore;
  }
  return '';
}

function normalizeArgs(args: GenerateSongInput): GenerateSongParams {
  const first = args[0];
  if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
    return {
      genre: first.genre ?? null,
      moods: first.moods ?? [],
      theme: first.theme ?? null,
      styles: first.styles ?? (first.theme ? [first.theme] : []),
      userInput: first.userInput ?? '',
      songPrompt: first.songPrompt,
      lyricsLength: first.lyricsLength ?? 'normal',
      songDuration: first.songDuration ?? '3',
      useAutoDuration: first.useAutoDuration ?? true,
      vocal: first.vocal ?? { male: 0, female: 0, rap: false },
      tempo: first.tempo,
      specialPrompt: first.specialPrompt,
      kpopMode: first.kpopMode ?? 0,
      isBallad: first.isBallad ?? Boolean(first.styles?.includes('Ballad')),
    };
  }

  const [
    genres,
    moods,
    themes,
    userInput,
    songPrompt = '',
    lyricsLength = 'normal',
    songDuration = '3',
    useAutoDuration = true,
    maleCount = 0,
    femaleCount = 0,
    rapEnabled = false,
    tempo,
    specialPrompt,
    kpopMode = 0,
  ] = args as any;

  const styleLabels = (themes ?? []).filter(Boolean);
  return {
    genre: genres?.[0] ?? null,
    moods: moods ?? [],
    theme: styleLabels[0] ?? null,
    styles: styleLabels,
    userInput: userInput ?? '',
    songPrompt,
    lyricsLength,
    songDuration,
    useAutoDuration,
    vocal: { male: maleCount, female: femaleCount, rap: rapEnabled },
    tempo,
    specialPrompt,
    kpopMode,
    isBallad: styleLabels.some((s: string) => String(s).toLowerCase().includes('ballad')),
  };
}

export async function generateSong(...args: GenerateSongInput): Promise<SongResult> {
  const params = normalizeArgs(args);
  const model = "gemini-3-flash-preview";
  const resolvedDuration = (params.useAutoDuration ?? true)
    ? calculateSongDuration(params.genre ? [params.genre] : [], params.moods, params.lyricsLength ?? 'normal')
    : (params.songDuration ?? '3');

  const genrePromptCore = getGenrePromptCore(params.genre);
  const styleText = (params.styles ?? []).join(', ');
  const balladText = params.isBallad ? 'Ballad structure with slower emotional pacing and vocal-centered flow.' : '';
  const vocalPrompt = buildVocalPrompt(params.vocal ?? { male: 0, female: 0, rap: false });
  const lyricGuidancePrompt = buildLyricGuidancePrompt();
  const fallbackPrompt = params.songPrompt && params.songPrompt.trim().length > 0
    ? params.songPrompt
    : [genrePromptCore, styleText ? `Style layer: ${styleText}` : '', balladText, params.tempo ? `Tempo: ${params.tempo}` : '', BASE_PROMPTS[0] ?? '']
        .filter(Boolean)
        .join('\n');

  const systemInstruction = `
${fallbackPrompt}

You are a professional music composer and lyricist.
Create a song using:
- one core genre
- multiple style layers
- multiple moods
- the user's story

Rules for lyrics:
${lyricGuidancePrompt}
- The lyrics must be influenced by the selected styles and user story.
- Genre and moods should shape the music prompt and atmosphere.
- Keep the lyrics natural and singable.
- Intended duration: about ${resolvedDuration} minutes.

Rules for prompt:
- Genre Core: ${genrePromptCore || params.genre || 'Pop'}
- Style Layers: ${styleText || 'None'}
- Mood Layers: ${(params.moods ?? []).join(', ')}
- ${params.tempo ? `Tempo constraint: ${params.tempo}` : 'Tempo should fit the selected genre and moods.'}
- Vocal configuration: ${vocalPrompt}
${params.specialPrompt ? `- Special instruction: ${params.specialPrompt}` : ''}
${balladText ? `- Ballad option: ${balladText}` : ''}

Output JSON:
{
  "title": "[Genre] 'English Title' │ 'Korean Title'",
  "lyrics": {
    "english": "Full English lyrics.",
    "korean": "Full Korean lyrics."
  },
  "prompt": "Detailed music production prompt",
  "appliedKeywords": {
    "genre": ["genre"],
    "mood": ["mood1", "mood2"],
    "theme": ["style1", "style2"],
    "style": ["style1", "style2"],
    "tempo": "tempo info if provided",
    "vocalType": "vocal description"
  }
}

Selected values:
Genre: ${params.genre ?? 'Pop'}
Styles: ${styleText}
Moods: ${(params.moods ?? []).join(', ')}
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
              style: { type: Type.ARRAY, items: { type: Type.STRING } },
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
  const vocalType = [
    params.vocal?.male ? (params.vocal.male === 1 ? 'Male Solo' : 'Male Group') : '',
    params.vocal?.female ? (params.vocal.female === 1 ? 'Female Solo' : 'Female Group') : '',
    params.vocal?.rap ? 'Rap' : ''
  ].filter(Boolean).join(' + ') || 'Default';

  result.appliedKeywords = {
    ...(result.appliedKeywords ?? {}),
    genre: result?.appliedKeywords?.genre ?? (params.genre ? [params.genre] : []),
    mood: result?.appliedKeywords?.mood ?? (params.moods ?? []),
    theme: result?.appliedKeywords?.theme ?? (params.styles ?? []),
    style: result?.appliedKeywords?.style ?? (params.styles ?? []),
    tempo: result?.appliedKeywords?.tempo ?? params.tempo,
    vocalType,
  };

  if (!result.prompt || typeof result.prompt !== 'string') {
    result.prompt = fallbackPrompt;
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
Translate the lyrics into ${targetLanguage}.
Maintain line breaks and structure.
Do not translate literally; preserve lyrical meaning and naturalness.
Return only the translated lyrics.
`.trim();

  const response = await ai.models.generateContent({
    model,
    contents: lyrics,
    config: { systemInstruction }
  });

  return response.text || "";
}
