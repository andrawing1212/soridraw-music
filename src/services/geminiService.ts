import { GoogleGenAI, Type } from "@google/genai";
import { SongResult, LyricsLength, DrumStyle, VocalType } from "../types";
import { BASE_PROMPTS } from "../constants";

// 롤백: 원래 작동하던 GEMINI_API_KEY 방식입니다.
const ai = new GoogleGenAI({ apiKey: "AIzaSyB_qCZsU7BJn6X2DRPVoaIYKjDldD0pqIo" });

// Vocal Tone Pools for Role-based structure
const VOCAL_POOLS = {
  main: ["Powerful", "Emotional", "Clear", "Soulful", "Dynamic", "Husky", "Crisp", "Velvety"],
  sub: ["Soft", "Sweet", "Airy", "Melodic", "Smooth", "Gentle", "Breathy", "Warm"],
  chorus: ["Harmonious", "Layered", "Background", "Ethereal", "Rich", "Wide", "Atmospheric", "Choral"]
};

const getRandomTone = (pool: string[]) => pool[Math.floor(Math.random() * pool.length)];

/**
 * Builds a randomized lyric structure prompt based on vocal configuration using the "Hybrid Method".
 * Guarantees that every selected member appears at least once in the lyrics.
 */
function buildLyricStructurePrompt(maleCount: number, femaleCount: number, rapEnabled: boolean): string {
  const totalCount = maleCount + femaleCount;
  const hasBothGenders = maleCount > 0 && femaleCount > 0;

  // 1. Generate all individual roles (A, B, C, D...)
  const mRoles = [];
  for (let i = 0; i < maleCount; i++) mRoles.push(`Male ${String.fromCharCode(65 + i)}`);
  const fRoles = [];
  for (let i = 0; i < femaleCount; i++) fRoles.push(`Female ${String.fromCharCode(65 + i)}`);
  
  const allIndividualRoles = [...mRoles, ...fRoles];
  
  // Helper to build a structure string
  const buildStructure = (steps: { section: string, role: string }[]) => {
    return steps.map(s => `[${s.section} - ${s.role}]`).join("\n    ");
  };

  const templates: string[] = [];

  // 1-2 People: Simple Structure (Existing logic refined)
  if (totalCount <= 2) {
    if (totalCount === 1) {
      const soloRole = allIndividualRoles[0] || "Vocal";
      templates.push(buildStructure([
        { section: "Verse 1", role: soloRole },
        { section: "Pre-Chorus", role: soloRole },
        { section: "Chorus", role: soloRole },
        { section: "Verse 2", role: soloRole },
        { section: "Bridge", role: soloRole },
        { section: "Chorus", role: soloRole },
        { section: "Outro", role: soloRole }
      ]));
    } else if (totalCount === 2) {
      const r1 = allIndividualRoles[0];
      const r2 = allIndividualRoles[1];
      templates.push(buildStructure([
        { section: "Verse 1", role: r1 },
        { section: "Pre-Chorus", role: r2 },
        { section: "Chorus", role: "All" },
        { section: "Verse 2", role: r2 },
        { section: "Pre-Chorus", role: r1 },
        { section: "Chorus", role: "All" },
        { section: "Bridge", role: `${r1} + ${r2}` },
        { section: "Chorus", role: "All" },
        { section: "Outro", role: "All" }
      ]));
      templates.push(buildStructure([
        { section: "Verse 1", role: r1 },
        { section: "Chorus", role: `${r1} Lead + ${r2} Harmony` },
        { section: "Verse 2", role: r2 },
        { section: "Chorus", role: `${r2} Lead + ${r1} Harmony` },
        { section: "Bridge", role: "Mixed Harmony" },
        { section: "Chorus", role: "All" }
      ]));
    }
  } 
  // 3+ People: Hybrid Structure with Guaranteed Appearance
  else {
    // We create multiple versions, each ensuring all members appear.
    const createGuaranteedVersion = (layoutType: number) => {
      let pool = [...allIndividualRoles].sort(() => Math.random() - 0.5);
      
      const usePool = () => {
        if (pool.length > 0) return pool.shift()!;
        return allIndividualRoles[Math.floor(Math.random() * allIndividualRoles.length)];
      };
      
      const getMixedPair = () => {
        if (hasBothGenders) {
          // Try to get one of each from pool to ensure inclusion
          const mIdx = pool.findIndex(r => r.startsWith('Male'));
          const m = mIdx !== -1 ? pool.splice(mIdx, 1)[0] : mRoles[Math.floor(Math.random() * mRoles.length)];
          
          const fIdx = pool.findIndex(r => r.startsWith('Female'));
          const f = fIdx !== -1 ? pool.splice(fIdx, 1)[0] : fRoles[Math.floor(Math.random() * fRoles.length)];
          
          return `${m} + ${f}`;
        }
        // Fallback for same-gender groups: Duo part
        const r1 = usePool();
        const r2 = usePool();
        return r1 === r2 ? r1 : `${r1} + ${r2}`;
      };

      const steps = [];
      if (layoutType === 0) {
        // Layout 0: Verse focus (Solo Verses)
        steps.push({ section: "Verse 1", role: usePool() });
        steps.push({ section: "Pre-Chorus", role: usePool() });
        steps.push({ section: "Chorus", role: "All" });
        steps.push({ section: "Verse 2", role: usePool() });
        steps.push({ section: "Chorus", role: "All" });
        steps.push({ section: "Bridge", role: usePool() });
        steps.push({ section: "Chorus", role: "All" });
        steps.push({ section: "Outro", role: pool.length > 0 ? pool.join(" + ") : "Mixed Harmony" });
      } else if (layoutType === 1) {
        // Layout 1: Alternating Verse
        steps.push({ section: "Verse 1", role: `${usePool()} + ${usePool()} alternating` });
        steps.push({ section: "Pre-Chorus", role: usePool() });
        steps.push({ section: "Chorus", role: "All" });
        steps.push({ section: "Verse 2", role: usePool() });
        steps.push({ section: "Bridge", role: pool.length > 0 ? pool.join(" + ") : "Mixed Harmony" });
        steps.push({ section: "Chorus", role: "All" });
        steps.push({ section: "Outro", role: "All" });
      } else if (layoutType === 2) {
        // Layout 2: Lead centered Chorus
        const lead = usePool();
        const group = maleCount > femaleCount ? "Male Group" : femaleCount > maleCount ? "Female Group" : "Mixed Group";
        steps.push({ section: "Verse 1", role: usePool() });
        steps.push({ section: "Verse 2", role: usePool() });
        steps.push({ section: "Pre-Chorus", role: usePool() });
        steps.push({ section: "Chorus", role: `${lead} Lead + ${group}` });
        steps.push({ section: "Bridge", role: pool.length > 0 ? pool.join(" + ") : usePool() });
        steps.push({ section: "Chorus", role: `${lead} Lead + ${group}` });
        steps.push({ section: "Outro", role: "All" });
      } else {
        // Layout 3: Mixed Gender Focus (Dual Vocal Flow)
        // Mixed parts are applied to Verses and potentially Bridge (approx 30-40% of sections)
        steps.push({ section: "Verse 1", role: getMixedPair() });
        steps.push({ section: "Pre-Chorus", role: usePool() });
        steps.push({ section: "Chorus", role: "All" });
        steps.push({ section: "Verse 2", role: getMixedPair() });
        steps.push({ section: "Chorus", role: "All" });
        // Bridge can be mixed or solo
        steps.push({ section: "Bridge", role: Math.random() > 0.5 ? getMixedPair() : usePool() });
        steps.push({ section: "Chorus", role: "All" });
        steps.push({ section: "Outro", role: "All" });
      }
      
      // Final check: If pool still has members (e.g. 6+ people), ensure they appear in Outro
      if (pool.length > 0) {
        const last = steps[steps.length - 1];
        if (last.role === "All") {
          last.role = `All (${pool.join(" + ")} focus)`;
        } else {
          last.role += ` + ${pool.join(" + ")}`;
        }
      }

      return buildStructure(steps);
    };

    const availableLayouts = hasBothGenders ? [0, 1, 2, 3] : [0, 1, 2];
    const selectedLayout = availableLayouts[Math.floor(Math.random() * availableLayouts.length)];
    templates.push(createGuaranteedVersion(selectedLayout));
  }

  // Add Rap if enabled
  if (rapEnabled) {
    templates.forEach((template, index) => {
      const lines = template.split("\n    ");
      const rand = Math.random();
      
      // For Rap, also allow mixed if both genders exist
      let rapLabel = "";
      if (hasBothGenders && Math.random() > 0.5) {
        const m = mRoles[Math.floor(Math.random() * mRoles.length)];
        const f = fRoles[Math.floor(Math.random() * fRoles.length)];
        rapLabel = `Rap (${m} + ${f})`;
      } else {
        const rapRole = allIndividualRoles[Math.floor(Math.random() * allIndividualRoles.length)];
        rapLabel = `Rap (${rapRole})`;
      }
      
      if (rand < 0.33) {
        // Bridge
        const bridgeIdx = lines.findIndex(l => l.includes("Bridge"));
        if (bridgeIdx !== -1) {
          lines[bridgeIdx] = `[Bridge - ${rapLabel}]`;
        } else {
          lines.splice(lines.length - 1, 0, `[Bridge - ${rapLabel}]`);
        }
      } else if (rand < 0.66) {
        // Verse 2
        const verse2Idx = lines.findIndex(l => l.includes("Verse 2"));
        if (verse2Idx !== -1) {
          lines[verse2Idx] = `[Verse 2 - ${rapLabel}]`;
        } else {
          lines.splice(1, 0, `[Verse 2 - ${rapLabel}]`);
        }
      } else {
        // Before Final Chorus
        const lastChorusIdx = lines.lastIndexOf("[Chorus - All]");
        if (lastChorusIdx !== -1) {
          lines.splice(lastChorusIdx, 0, `[Rap Break - ${rapLabel}]`);
        } else {
          lines.splice(lines.length - 1, 0, `[Rap Section - ${rapLabel}]`);
        }
      }
      templates[index] = lines.join("\n    ");
    });
  }

  const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

  return `
    HYBRID LYRIC PART SEPARATION RULES:
    - You MUST follow this specific part distribution structure for the lyrics:
    ${selectedTemplate}
    - EVERY member (Male A, Male B, Female A, Female B, etc.) MUST appear at least once in an individual or small group part.
    - Verse sections: Can be segmented using individual roles (e.g., Male A, Female B).
    - Chorus sections: MUST be simple (e.g., [Chorus - All] or [Chorus - Lead + Group]). DO NOT list multiple individual roles in Chorus.
    - Pre-Chorus: Use single roles or small combinations.
    - Bridge/Outro: Can be solo, mixed harmony, or rap.
    - Ensure each section is clearly labeled with the role in English (e.g., [Verse 1 - Male A]).
    - IMPORTANT: The Korean lyrics MUST also include these same part labels in English.
  `;
}

/**
 * Builds a simple vocal prompt for the music production instructions.
 */
function buildVocalPrompt(maleCount: number, femaleCount: number, rapEnabled: boolean): string {
  const parts = [];
  if (maleCount > 0 && femaleCount > 0) {
    parts.push("mixed vocal group");
  } else if (maleCount > 0) {
    parts.push(maleCount === 1 ? "male vocal" : "male group vocal");
  } else if (femaleCount > 0) {
    parts.push(femaleCount === 1 ? "female vocal" : "female group vocal");
  }

  if (rapEnabled) {
    parts.push("with rap section");
  }

  return parts.join(", ");
}

export async function generateSong(
  genres: string[],
  moods: string[],
  themes: string[],
  userInput: string,
  lyricsLength: LyricsLength = 'normal',
  drumStyle: DrumStyle = 'none',
  maleCount: number = 0,
  femaleCount: number = 0,
  rapEnabled: boolean = false,
  tempo?: string,
  specialPrompt?: string,
  kpopMode: 0 | 1 | 2 = 0
): Promise<SongResult> {
  const model = "gemini-3-flash-preview";
  
  const vocalPrompt = buildVocalPrompt(maleCount, femaleCount, rapEnabled);
  const lyricStructurePrompt = buildLyricStructurePrompt(maleCount, femaleCount, rapEnabled);

  const kpopInstruction = kpopMode === 2 ? `
    CRITICAL K-POP STYLE (Korean + English Mixed Version):
    - For 'lyrics.korean': Generate K-Pop style lyrics that are primarily in Korean but naturally code-switch with English. 
      - CONSTRAINT: English usage should be approximately 15-20% of the total song content.
      - Mix in English at the end of sentences or for core keywords. Include English ad-libs (e.g., "(Yeah)", "(Uh-huh)", "(Wait)") in parentheses throughout.
    - For 'lyrics.english': Generate K-Pop style lyrics that are primarily in English but naturally code-switch with Korean.
      - CONSTRAINT: Korean usage should be approximately 25-30% of the total song content.
      - Mix in Korean at the end of sentences or for core keywords. Include Korean ad-libs in parentheses throughout.
    - The code-switching ratio does NOT need to be identical between the two versions.
    - Ensure the code-switching feels natural and uses words relevant to the song's theme and user story.
    - Incorporate English chorus lines and ad-libs to enhance the song's richness.
    - If the song's mood, theme, and genre align with K-R&B or popular styles, apply sophisticated English rhymes at the end of lines.
  ` : "";

  const systemInstruction = `
    You are a professional music composer and lyricist.
    Your task is to generate a song based on the provided genres, moods, themes, and user story.
    
    ${kpopInstruction}

    Output Format:
    Return a JSON object with the following structure:
    {
      "title": "[Genre1 Genre2] 'English Title' │ 'Korean Title'",
      "lyrics": {
        "english": "Full English lyrics with structure like [Verse 1 - Role], [Chorus - Role], etc.",
        "korean": "Full Korean translation of the lyrics with the same structure"
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
    ${lyricStructurePrompt}
    - Structure: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Chorus], [Outro]
    - CRITICAL: Ensure clear line breaks between sections.
    - CRITICAL: The content of the lyrics MUST be influenced ONLY by the 'Themes' and 'User Story'. 
    - CRITICAL: The 'Genres' and 'Moods' should NOT directly influence the lyrics content, but they should influence the music prompt.
    - Length Constraint (lyricsLength: ${lyricsLength}):
      - 'very-short': Extremely concise and minimal lyrics. Only 2-3 lines per section.
      - 'short': Concise and implicit lyrics, suitable for Jazz or Ballads. Fewer lines per section.
      - 'normal': Standard length for most pop songs.
    - Provide both English and Korean versions.
    - CRITICAL: When providing Korean titles and lyrics, do NOT translate English literally. Instead, capture the lyrical and poetic essence of the song to make it feel natural, emotionally resonant, and beautiful in Korean. The Korean lyrics should read like a standalone poem or song.
    
    Rules for Prompt:
    ${specialPrompt ? `- SPECIAL GENRE INSTRUCTION: ${specialPrompt}` : ""}
    - Use the provided base prompts ONLY if the selected genres are EXCLUSIVELY from this specific list: ['Indie', 'Folk', 'R&B', 'Groovy', 'Acoustic'].
    - At least TWO genres from this specific list must be selected to use the base prompts.
    - If ANY other genre (e.g., Techno, K-Pop, Metal, etc.) is included in the selection, do NOT use the base prompts, even if the above conditions are met.
    - If NO genres are selected (unspecified generation), you have a 40% chance to use the base prompts as a style reference. Otherwise, create a fresh and appropriate style based on the moods and themes.
    - ALWAYS include these constraints: (Intimate and warm natural mix with light reverb, no dramatic build-up, no explosive climax, Target song length between 2 minutes 30 seconds and 3 minute, Soft and intimate outro, minimal instrumentation, Restrained vocal delivery, no dramatic ending, fade gently into silence, gradual instrumental fade-out).
    - DRUM STYLE: ${drumStyle === 'half-time' ? "Apply 'Half Time' drum style." : drumStyle === 'double-time' ? "Apply 'Double Time' drum style." : ""}
    - CRITICAL: The total song duration MUST be between 2 minutes 30 seconds and 3 minutes. NEVER exceed 3 minutes 20 seconds.
    - Ensure the song can be finished within 2 minutes 45 seconds if possible.
    - ${tempo ? `TEMPO CONSTRAINT: ${tempo}` : "Tempo should be appropriate for the genre and mood."}
    - VOCAL CONFIGURATION: ${vocalPrompt}
    
    Keywords to use:
    Genres: ${genres.join(", ")}
    Moods: ${moods.join(", ")}
    Themes: ${themes.join(", ")}
    User Story: ${userInput}
    
    Reference Prompts:
    ${BASE_PROMPTS.join("\n\n")}
  `;

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
  
  // Override vocalType with the requested configuration for accuracy
  if (result.appliedKeywords) {
    const vocalDescription = [];
    const getDesc = (gender: string, count: number) => {
      if (count === 1) return `${gender} Solo`;
      if (count === 2) return `${gender} Duo`;
      if (count >= 3) return `${gender} Group`;
      return null;
    };
    const m = getDesc('Male', maleCount);
    const f = getDesc('Female', femaleCount);
    if (m) vocalDescription.push(m);
    if (f) vocalDescription.push(f);
    if (rapEnabled) vocalDescription.push("Rap");
    
    result.appliedKeywords.vocalType = vocalDescription.join(" + ") || "Default";
  }
  
  return result as SongResult;
}

export async function translateLyrics(
  lyrics: string,
  targetLanguage: 'korean' | 'english'
): Promise<string> {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `
    You are a professional lyricist and translator.
    Your task is to translate the provided lyrics into ${targetLanguage}.
    
    CRITICAL: 
    - Maintain the original structure, line breaks, and section markers (e.g., [Verse 1], [Chorus]).
    - Do NOT translate literally. Capture the lyrical and poetic essence.
    - The translated lyrics should feel natural and emotionally resonant in ${targetLanguage}.
    - Return ONLY the translated lyrics text.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: lyrics,
    config: {
      systemInstruction,
    }
  });

  return response.text || "";
}
