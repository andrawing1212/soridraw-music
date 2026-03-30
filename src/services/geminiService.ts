import { GoogleGenAI, Type } from "@google/genai";
import { SongResult, LyricsLength, SongDuration } from "../types";

// GEMINI API KEY
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!
});

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
  `;
}

/**
 * Builds a simple vocal prompt for music production instructions.
 */
function buildVocalPrompt(
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

  const energeticMoods = ["energetic", "dramatic", "bright"];
  const calmMoods = ["calm", "dreamy", "lonely"];

  if (moods.some(m => energeticMoods.includes(m.toLowerCase()))) duration += 0.5;
  if (moods.some(m => calmMoods.includes(m.toLowerCase()))) duration -= 0.5;

  if (lyricsLength === "normal") duration += 0.5;
  if (lyricsLength === "very-short") duration -= 0.5;

  const clamped = Math.max(1, Math.min(6, Math.round(duration)));
  return clamped.toString() as "1" | "2" | "3" | "4" | "5" | "6";
}

export async function generateSong(
  genres: string[],
  moods: string[],
  themes: string[],
  userInput: string,
  songPrompt: string,
  lyricsLength: LyricsLength = "normal",
  songDuration: SongDuration = "3",
  useAutoDuration: boolean = true,
  maleCount: number = 0,
  femaleCount: number = 0,
  rapEnabled: boolean = false,
  tempo?: string,
  specialPrompt?: string,
  kpopMode: 0 | 1 | 2 = 0
): Promise<SongResult> {
  const model = "gemini-3-flash-preview";

  const resolvedDuration = useAutoDuration
    ? calculateSongDuration(genres, moods, lyricsLength)
    : songDuration;

  const vocalPrompt = buildVocalPrompt(maleCount, femaleCount, rapEnabled);
  const lyricGuidancePrompt = buildLyricGuidancePrompt();

  const kpopInstruction =
    kpopMode === 2
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

  const systemInstruction = `
${songPrompt}

You are a professional music composer and lyricist.
Your task is to generate a song based on the provided genres, moods, themes, and user story.

${kpopInstruction}

Output Format:
Return a JSON object with the following structure:
{
  "title": "[Genre1 Genre2]'English Title'│'Korean Title'",
  "lyrics": {
    "english": "Full English lyrics.",
    "korean": "Full Korean lyrics."
  },
  "prompt": "A detailed music production prompt",
  "appliedKeywords": {
    "genre": ["genre1", "genre2", ...],
    "mood": ["mood1", "mood2", ...],
    "theme": ["theme1", "theme2", ...],
    "tempo": "tempo info if provided"
  }
}

Rules for Title:
- Use at most two main genres in the brackets.
- Format: [Genre1 Genre2] 'English Title' │ 'Korean Title'

Rules for Lyrics:
${lyricGuidancePrompt}
- CRITICAL: The content of the lyrics MUST be influenced ONLY by the 'Themes' and 'User Story'.
- CRITICAL: The 'Genres' and 'Moods' should NOT directly influence the lyrics content, but they should influence the music prompt.
- The lyrics MUST be generated based on the full prompt above.
- Provide both English and Korean versions.
- Keep the lyrics natural and musically singable.
- The intended song duration is approximately ${resolvedDuration} minutes.

Rules for Prompt:
${specialPrompt ? `- SPECIAL GENRE INSTRUCTION: ${specialPrompt}` : ""}
- ${tempo ? `TEMPO CONSTRAINT: ${tempo}` : "Tempo should be appropriate for the genre and mood."}
- VOCAL CONFIGURATION: ${vocalPrompt}

Keywords to use:
Genres: ${genres.join(", ")}
Moods: ${moods.join(", ")}
Themes: ${themes.join(", ")}
User Story: ${userInput}
`;

  console.log("--- Final System Instruction ---");
  console.log(systemInstruction);
  console.log("--------------------------------");

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

  if (result.appliedKeywords) {
    const vocalDescription: string[] = [];

    const getDesc = (gender: string, count: number) => {
      if (count === 1) return `${gender} Solo`;
      if (count === 2) return `${gender} Duo`;
      if (count >= 3) return `${gender} Group`;
      return null;
    };

    const m = getDesc("Male", maleCount);
    const f = getDesc("Female", femaleCount);

    if (m) vocalDescription.push(m);
    if (f) vocalDescription.push(f);
    if (rapEnabled) vocalDescription.push("Rap");

    result.appliedKeywords.vocalType =
      vocalDescription.join(" + ") || "Default";
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
`;

  const response = await ai.models.generateContent({
    model,
    contents: lyrics,
    config: {
      systemInstruction
    }
  });

  return response.text || "";
}