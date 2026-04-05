console.log("🔥 NEW GEMINI ACTIVE");
import { GoogleGenAI, Type } from "@google/genai";
import {
  BASE_PROMPTS,
  BASIC_STRUCTURE,
  GENRE_GROUPS,
  GENRE_HIERARCHY,
  INSTRUMENT_SOUNDS,
  SOUND_STYLES,
  MID_GENRE_PROMPTS,
  SUB_GENRE_PROMPTS,
} from "../constants";
import { VOCAL_TONES } from "../constants/vocalTones";
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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Gemini API key is not defined. Please set VITE_GEMINI_API_KEY in your environment variables."
      );
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
  subGenre?: string[];
  isKpopSelected?: boolean;
  isKoreanEnglishMix?: boolean;
  moods: string[];
  themes?: string[];
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

const NON_EMPTY = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

function sentenceCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveStyleItem(value: string) {
  const normalized = value.trim().toLowerCase();
  return SOUND_STYLES.find(
    (item) =>
      item.id.toLowerCase() === normalized || item.label.toLowerCase() === normalized
  );
}

function resolveInstrumentSoundItem(value: string) {
  const normalized = value.trim().toLowerCase();
  return INSTRUMENT_SOUNDS.find(
    (item) =>
      item.id.toLowerCase() === normalized || item.label.toLowerCase() === normalized
  );
}

function getSubGenreLabels(subGenreIds: string[] = []): string[] {
  if (!subGenreIds.length) return [];

  return subGenreIds
    .map((subGenreId) =>
      GENRE_HIERARCHY
        .flatMap((group) => group.children)
        .flatMap((main) => main.children)
        .find((item) => item.id === subGenreId)?.label ?? sentenceCase(subGenreId)
    )
    .filter(NON_EMPTY);
}

function getGenreMeta(genreId: string | null) {
  if (!genreId) return null;

  for (const group of GENRE_GROUPS) {
    const found = group.children.find((child) => child.id === genreId);
    if (found) {
      return {
        id: found.id,
        label: found.label,
        description: found.description,
        promptCore: found.promptCore ?? "",
      };
    }
  }

  return null;
}

function getStylePromptCores(styleValues: string[] = []): string[] {
  return styleValues
    .map((value) => resolveStyleItem(value)?.promptCore ?? "")
    .filter(NON_EMPTY);
}

function getStyleLabels(styleValues: string[] = []): string[] {
  return styleValues
    .map((value) => resolveStyleItem(value)?.label ?? sentenceCase(value))
    .filter(NON_EMPTY);
}

function getInstrumentSoundPromptCores(values: string[] = []): string[] {
  return values
    .map((value) => resolveInstrumentSoundItem(value)?.promptCore ?? "")
    .filter(NON_EMPTY);
}

function getInstrumentSoundLabels(values: string[] = []): string[] {
  return values
    .map((value) => resolveInstrumentSoundItem(value)?.label ?? sentenceCase(value))
    .filter(NON_EMPTY);
}

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

  const rapGenres = ["trap", "drill", "boom-bap", "gangsta-rap", "lofi-hiphop"];
  const ambientGenres = ["ambient-electronic", "ambient-newage", "meditation-music"];

  if (genres.some((g) => rapGenres.includes(g.toLowerCase()))) structure += 1;
  if (genres.some((g) => ambientGenres.includes(g.toLowerCase()))) structure -= 1;

  const energeticMoods = ["bright", "hopeful", "tense"];
  const calmMoods = ["calm", "dreamy", "lonely", "peaceful", "sad", "warm"];

  if (moods.some((m) => energeticMoods.includes(m.toLowerCase()))) structure += 0.5;
  if (moods.some((m) => calmMoods.includes(m.toLowerCase()))) structure -= 0.5;

  if (lyricsLength === "very-short") structure -= 0.5;
  if (lyricsLength === "long") structure += 0.5;

  const clamped = Math.max(1, Math.min(3, Math.round(structure)));
  return clamped.toString() as "1" | "2" | "3";
}

function buildThemePrompt(themes: string[]): string {
  if (!themes.length) return "";
  if (themes.length === 1) return `Story concept: ${themes[0]}.`;
  if (themes.length === 2) return `Story concept: ${themes[0]} and ${themes[1]}.`;
  return `Story concept: ${themes.slice(0, -1).join(", ")}, and ${themes[themes.length - 1]}.`;
}

function buildThemeSentence(themes: string[]): string {
  const normalized = themes.map((theme) => theme.trim()).filter(NON_EMPTY);
  if (normalized.length === 0) return "No explicit story theme selected.";

  const set = new Set(normalized.map((theme) => theme.toLowerCase()));

  if (set.has("breakup") && set.has("memories")) {
    return "A reflective story after a breakup, replaying memories, unresolved love, and the emotional aftermath.";
  }
  if (set.has("youth") && set.has("dream")) {
    return "A story about youth chasing dreams, balancing fragile hope, uncertainty, and emotional growth.";
  }
  if (set.has("love") && set.has("night")) {
    return "A late-night love story shaped by intimacy, quiet tension, and emotional vulnerability.";
  }
  if (set.has("daily life") && set.has("healing")) {
    return "A healing story drawn from everyday life, finding comfort in ordinary moments and emotional recovery.";
  }
  if (set.has("travel") && set.has("memories")) {
    return "A nostalgic travel story, revisiting places, memories, and the emotions left behind.";
  }
  if (set.has("comfort") && set.has("loneliness")) {
    return "A story of loneliness seeking comfort, warmth, and a sense of emotional shelter.";
  }

  if (normalized.length === 1) {
    return `A story centered on ${normalized[0].toLowerCase()}, with clear narrative focus and emotional detail.`;
  }

  if (normalized.length === 2) {
    return `A story connecting ${normalized[0].toLowerCase()} and ${normalized[1].toLowerCase()}, turning them into one clear emotional situation.`;
  }

  return `A story shaped by ${normalized
    .slice(0, -1)
    .map((theme) => theme.toLowerCase())
    .join(", ")}, and ${normalized[normalized.length - 1].toLowerCase()}, expressed as one coherent emotional scene rather than separate tags.`;
}

function getVocalFormation(vocal: VocalConfig): string | null {
  const male = vocal.male ?? 0;
  const female = vocal.female ?? 0;
  const total = male + female;
  const mode = vocal.mode;

  if (total === 0) return null;

  if (mode === 'solo') {
    return female > 0 ? "Solo female vocal" : "Solo male vocal";
  } else if (mode === 'duo') {
    if (male > 0 && female > 0) return "Mixed duo vocal";
    else if (male > 0) return "Male duo vocal";
    else return "Female duo vocal";
  } else if (mode === 'group') {
    if (male > 0 && female > 0) return "Mixed group vocal";
    else if (male > 0) return "All-male group vocal";
    else return "All-female group vocal";
  } else {
    // Fallback logic
    if (total === 1) return female > 0 ? "Solo female vocal" : "Solo male vocal";
    else if (total === 2) {
      if (male > 0 && female > 0) return "Mixed duo vocal";
      else if (male > 0) return "Male duo vocal";
      else return "Female duo vocal";
    } else {
      if (male > 0 && female > 0) return "Mixed group vocal";
      else if (male > 0) return "All-male group vocal";
      else return "All-female group vocal";
    }
  }
}

function buildVocalPrompt(vocal: VocalConfig, subGenres: string[]): string {
  const male = vocal.male ?? 0;
  const female = vocal.female ?? 0;
  const formation = getVocalFormation(vocal) || "Genre-based recommended vocal formation";

  let genderRule = "";
  if (male > 0 && female > 0) {
    genderRule = `Use a balanced mix of male and female vocalists.`;
  } else if (male > 0) {
    genderRule = `Use ONLY male vocals. Female vocals are NOT allowed.`;
  } else if (female > 0) {
    genderRule = `Use ONLY female vocals. Male vocals are NOT allowed.`;
  } else {
    genderRule = `Choose the most appropriate vocal type (gender and tone) for the genre.`;
  }

  const rapRule = vocal.rap
    ? "Rap sections MUST be included in the song."
    : "Rap is strictly forbidden unless explicitly requested.";

  let toneRule = "";
  if (vocal.tonePrompt) {
    toneRule = `\n- Vocal Tone Character: ${vocal.tonePrompt}`;
  } else if (vocal.globalToneId) {
    toneRule = `\n- Global vocal tone: ${vocal.globalToneId}`;
  }

  let memberRolesRule = "";
  if (vocal.members && vocal.members.length > 0) {
    const memberDescriptions = vocal.members
      .map((m, idx) => {
        const hasRoles = m.roles && m.roles.length > 0;
        const hasTone = !!m.toneId;
        if (!hasRoles && !hasTone) return null;

        const genderStr = m.gender === 'male' ? 'Male' : 'Female';
        const rolesStr = hasRoles ? m.roles.join(", ") : "";
        let toneInfo = "";
        if (m.toneId) {
          const tone = VOCAL_TONES.find((t) => t.id === m.toneId);
          if (tone) {
            // Check for redundancy
            const label = tone.label;
            const displayLabel = label.toLowerCase().includes(genderStr.toLowerCase())
              ? label
              : `${genderStr} ${label}`;
            toneInfo = `, Tone: ${displayLabel} (${tone.promptCore})`;
          }
        }
        
        const rolesPart = rolesStr ? `: ${rolesStr}` : "";
        return `- Member ${idx + 1} (${genderStr})${rolesPart}${toneInfo}`;
      })
      .filter(Boolean)
      .join("\n");

    if (memberDescriptions) {
      memberRolesRule = `\n- Vocal Member Roles:\n${memberDescriptions}`;
    }
  }

  // Genre vocal auxiliary
  let stylingRule = "";
  const genreVocalStrings = subGenres
    .map((id) => SUB_GENRE_PROMPTS[id]?.vocal)
    .filter(Boolean);

  if (genreVocalStrings.length > 0) {
    const firstVocalString = genreVocalStrings[0];
    const vocalOptions = firstVocalString.split(",").map((s) => s.trim());
    const harmonies = vocalOptions.find((o) =>
      o.toLowerCase().includes("harmonies")
    );
    const hooks = vocalOptions.find((o) => o.toLowerCase().includes("hooks"));
    const selectedStyling = harmonies || hooks || vocalOptions[0];
    stylingRule = `\n- Additional Vocal Styling: ${selectedStyling}`;
  }

  return `
VOCAL RULE (STRICT):
- Formation: ${formation}
- Gender: ${genderRule}${memberRolesRule}
- ${rapRule}${toneRule}${stylingRule}
- Do NOT override these vocal rules under any circumstance.
`.trim();
}

function normalizeArgs(args: GenerateSongInput): GenerateSongParams {
  const first = args[0];

  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    return {
      genre: first.genre ?? null,
      subGenre: first.subGenre ?? [],
      moods: first.moods ?? [],
      themes: first.themes ?? [],
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
      isKoreanEnglishMix: first.isKoreanEnglishMix ?? false,
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
    subGenre: genres?.slice(1) ?? [],
    moods: moods ?? [],
    themes: themes ?? [],
    styles: [],
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
    isKoreanEnglishMix: false,
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
  const themes = params.themes ?? [];
  const styles = getStyleLabels(params.styles ?? []);
  const instrumentSounds = getInstrumentSoundLabels(
    params.instrumentSounds ?? []
  );
  const vocalDescription: string[] = [];

  const formation = getVocalFormation(
    params.vocal ?? { male: 0, female: 0, rap: false }
  );

  if (formation) vocalDescription.push(formation);
  
  if (params.vocal?.members && params.vocal.members.length > 0) {
    params.vocal.members.forEach(m => {
      const roles = m.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join("/");
      vocalDescription.push(`${m.gender === 'male' ? 'Male' : 'Female'}(${roles})`);
    });
  }

  if (params.vocal?.rap) vocalDescription.push("Rap");

  return {
    genre: params.genre ? [params.genre] : [],
    subGenre: params.subGenre ?? [],
    mood: params.moods ?? [],
    theme: themes,
    style: styles,
    instrumentSound: instrumentSounds,
    tempo: params.tempo ?? "",
    vocalType: vocalDescription.join(" + ") || "Default",
    lyricsLength: params.lyricsLength ?? "normal",
    songStructure: params.songStructure === "custom" ? "custom" : resolvedStructure,
    customStructure: params.songStructure === "custom" ? (params.customStructure ?? []) : [],
    maleCount: params.vocal?.male ?? 0,
    femaleCount: params.vocal?.female ?? 0,
    rapEnabled: params.vocal?.rap ?? false,
    vocal: params.vocal ?? { male: 0, female: 0, rap: false },
  };
}

function buildStructureText(
  songStructure: SongStructure | undefined,
  resolvedStructure: SongStructure,
  customStructure: CustomSectionItem[] = []
): string {
  if (songStructure === "custom" && customStructure.length > 0) {
    return customStructure
      .map((section) =>
        `${section.section}${section.tags.length > 0 ? ` (${section.tags.join(", ")})` : ""}`
      )
      .join(" → ");
  }

  const structureMap: Record<Exclude<SongStructure, "custom">, string> = {
    "1": "Intro → Verse 1 → Chorus / Drop → Outro",
    "2": BASIC_STRUCTURE,
    "3": "Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro",
  };

  const selected = (songStructure === "custom" ? resolvedStructure : songStructure) ?? resolvedStructure;
  return structureMap[(selected as Exclude<SongStructure, "custom">) || "2"];
}

/**
 * Common helper to optimize prompt arrays by priority, deduplication, and conflict removal.
 */
function optimizePromptArray(
  candidates: { value: string; priority: number }[],
  maxCount: number = 5,
  mustKeepPriority: number = 1
): string[] {
  // 1. Sort by priority (lower number = higher priority)
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority);

  const result: string[] = [];
  const normalizedResult: string[] = [];

  // Conflict Map (Lower case for comparison)
  const CONFLICTS: Record<string, string[]> = {
    soft: ["aggressive", "hard", "heavy", "intense", "powerful", "energetic", "punchy"],
    aggressive: ["soft", "gentle", "calm", "peaceful", "mellow", "smooth", "relaxed"],
    minimal: ["rich", "complex", "dense", "layered", "lush", "orchestral", "full", "maximalist"],
    rich: ["minimal", "sparse", "simple", "stripped-back", "naked"],
    vintage: ["modern", "contemporary", "futuristic", "cutting-edge", "new-age"],
    modern: ["vintage", "retro", "old-school", "classic", "antique"],
    acoustic: ["electronic", "synthesized", "digital", "synth-heavy", "electric", "computerized"],
    electronic: ["acoustic", "unplugged", "natural", "organic", "live"],
    dark: ["bright", "cheerful", "happy", "uplifting", "vibrant"],
    bright: ["dark", "gloomy", "somber", "moody", "melancholic"],
    fast: ["slow", "relaxed", "chill", "laid-back"],
    slow: ["fast", "upbeat", "high-energy", "driving"],
  };

  // Similar Keywords Groups (to keep only 1-2 from a group)
  const SIMILAR_GROUPS = [
    ["pop", "modern pop", "contemporary pop", "mainstream pop", "k-pop", "kpop", "idol pop"],
    ["dance", "club", "disco", "groove", "edm", "house", "techno"],
    ["electronic", "synth", "synthesized", "digital", "electro"],
    ["rock", "alternative", "indie", "punk", "metal", "grunge"],
    ["hip hop", "rap", "trap", "urban", "drill", "boom bap"],
    ["rnb", "soul", "neo soul", "funk", "motown"],
    ["ballad", "emotional", "sentimental", "sad", "melancholic"],
  ];

  for (const candidate of sorted) {
    const val = candidate.value.trim();
    if (!val) continue;

    const lowerVal = val.toLowerCase();
    const isMustKeep = candidate.priority <= mustKeepPriority;

    // 1. Exact duplicate check
    if (normalizedResult.includes(lowerVal)) continue;

    if (!isMustKeep) {
      // 2. Limit check
      if (result.length >= maxCount) continue;

      // 3. Conflict check
      let hasConflict = false;
      for (const added of normalizedResult) {
        if (CONFLICTS[added]?.some(c => lowerVal.includes(c)) || 
            CONFLICTS[lowerVal]?.some(c => added.includes(c))) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) continue;

      // 4. Redundancy check (Similar keywords)
      let isRedundant = false;
      for (const added of normalizedResult) {
        // Substring check
        if (added.includes(lowerVal) || lowerVal.includes(added)) {
          isRedundant = true;
          break;
        }
        
        // Group check
        for (const group of SIMILAR_GROUPS) {
          if (group.some(g => added.includes(g)) && group.some(g => lowerVal.includes(g))) {
            isRedundant = true;
            break;
          }
        }
        if (isRedundant) break;
      }
      if (isRedundant) continue;
    }

    result.push(val);
    normalizedResult.push(lowerVal);
  }

  return result;
}

function buildStyle(params: GenerateSongParams): string {
  const genreMeta = getGenreMeta(params.genre);
  const genreLabel = genreMeta?.label ?? (params.genre ? sentenceCase(params.genre) : "Pop");
  const subGenreIds = params.subGenre ?? [];
  const genreId = (params.genre || "pop").toLowerCase();
  const selectedStyleIds = (params.styles ?? []).slice(0, 3);

  const candidates: { value: string; priority: number }[] = [];

  // 1. Sub-genre (Priority 1)
  subGenreIds.forEach(id => {
    const prompt = SUB_GENRE_PROMPTS[id];
    if (prompt?.style) {
      candidates.push({ value: prompt.style, priority: 1 });
    }
  });

  // 2. Mid-genre (Priority 2)
  const mid = MID_GENRE_PROMPTS[genreId];
  if (mid?.style) {
    candidates.push({ value: mid.style, priority: 2 });
  } else {
    candidates.push({ value: genreLabel, priority: 2 });
  }

  // 3. User Styles (Priority 3)
  const COMPATIBLE_MAP: Record<string, string[]> = {
    pop: ["pop", "dance", "modern-edm", "global-pop-style", "k-style"],
    "dance-pop": ["dance", "classic-disco", "modern-edm", "global-pop-style", "k-style"],
    "synth-pop": ["dance", "modern-edm", "electronic", "techno-style", "house-style"],
    kpop: ["dance", "modern-edm", "global-pop-style", "k-style", "hip-hop", "trap-style"],
    trap: ["hip-hop", "trap-style", "boom-bap-style"],
    drill: ["hip-hop", "trap-style"],
    "contemporary-rnb": ["rnb", "neo-soul-style", "pb-rnb-style", "soul", "classic-soul"],
    "neo-soul": ["rnb", "neo-soul-style", "soul", "classic-soul", "jazz"],
    jazz: ["jazz", "classic-jazz", "jazzhop-style", "swing", "bebop", "cool-jazz"],
    rock: ["rock", "classic-rock", "modern-rock", "punk", "pop-punk"],
    "heavy-metal": ["rock", "classic-rock", "modern-rock", "punk"],
    house: ["electronic", "house-style", "techno-style", "dance", "modern-edm"],
    techno: ["electronic", "techno-style", "house-style", "modern-edm"],
    "lofi-hiphop": ["hip-hop", "lofi-hip-hop-style", "jazzhop-style", "rnb"],
    "piano-ballad": ["ballad", "classic-ballad", "soul", "classic-soul"],
  };

  const SEMI_COMPATIBLE_MAP: Record<string, string[]> = {
    "piano-ballad": ["trap-style", "modern-edm", "rnb"],
    drill: ["global-pop-style", "modern-edm", "rnb"],
    jazz: ["modern-edm", "electronic", "hip-hop", "trap-style"],
    rock: ["electronic", "modern-edm", "hip-hop"],
    pop: ["rock", "classic-rock", "punk"],
    "folk-rock": ["electronic", "modern-edm"],
    "traditional-trot": ["modern-edm", "dance", "electronic"],
  };

  selectedStyleIds.forEach((styleId, index) => {
    const styleItem = resolveStyleItem(styleId);
    if (!styleItem) return;

    candidates.push({ value: styleItem.label, priority: 3 });

    // 4. Auto-correction (Priority 4)
    const compatibleStyles = COMPATIBLE_MAP[genreId] || [];
    const semiCompatibleStyles = SEMI_COMPATIBLE_MAP[genreId] || [];
    const isCompatible = compatibleStyles.includes(styleId);
    const isSemiCompatible = semiCompatibleStyles.includes(styleId);

    if (index === 0) {
      if (isSemiCompatible || (!isCompatible && !isSemiCompatible)) {
        candidates.push({ value: `${styleItem.label} influence`, priority: 4 });
      }
    } else if (!isCompatible) {
      candidates.push({ value: `${styleItem.label} influence`, priority: 4 });
    }
  });

  // Filter out sound/vocal/instrument keywords
  const EXCLUDED_STYLE_KEYWORDS = [
    "texture", "bass", "drums", "vocal", "sound", "instrument", "synth", "percussion",
    "beat", "rhythm", "melody", "harmony", "arrangement", "production", "mix", "mastering"
  ];

  const filteredCandidates = candidates.filter(c => {
    const lower = c.value.toLowerCase();
    return !EXCLUDED_STYLE_KEYWORDS.some(kw => lower.includes(kw));
  });

  // Optimize
  const optimizedStyles = optimizePromptArray(filteredCandidates, 5).map(s => s.charAt(0).toUpperCase() + s.slice(1));

  // Tempo (Always last)
  const tempoText = params.tempo
    ? params.tempo.replace(/^Between\s+/i, "").replace(/^Exactly\s+/i, "").replace(/\s+and\s+/i, "–")
    : "";

  const finalParts = [...optimizedStyles];
  if (tempoText) finalParts.push(tempoText);

  return `·STYLE: ${finalParts.join(", ")}`;
}

function buildSound(params: GenerateSongParams): string {
  const genreId = (params.genre || "pop").toLowerCase();
  const subGenreIds = params.subGenre ?? [];
  const selectedSoundIds = params.instrumentSounds ?? [];

  const candidates: { value: string; priority: number; role: string }[] = [];

  const getSoundRole = (text: string): string => {
    const lower = text.toLowerCase();
    if (lower.includes("drum") || lower.includes("beat") || lower.includes("rhythm") || lower.includes("groove") || lower.includes("kick") || lower.includes("snare") || lower.includes("hi-hat") || lower.includes("percussion") || (lower.includes("808") && lower.includes("drum"))) return "rhythm";
    if (lower.includes("bass") || lower.includes("808") || lower.includes("low end") || lower.includes("sub")) return "low-end";
    if (lower.includes("texture") || lower.includes("ambience") || lower.includes("noise") || lower.includes("layer") || lower.includes("pad") || lower.includes("atmosphere")) return "texture";
    if (lower.includes("reverb") || lower.includes("delay") || lower.includes("space") || lower.includes("stereo") || lower.includes("mix") || lower.includes("room") || lower.includes("hall") || lower.includes("panning") || lower.includes("field")) return "space";
    if (lower.includes("piano") || lower.includes("guitar") || lower.includes("synth") || lower.includes("string") || lower.includes("brass") || lower.includes("lead") || lower.includes("keys") || lower.includes("organ") || lower.includes("horn") || lower.includes("bell") || lower.includes("pluck")) return "main-sound";
    return "support";
  };

  // 1. Sub-genre (Priority 1)
  subGenreIds.forEach(id => {
    const prompt = SUB_GENRE_PROMPTS[id];
    if (prompt?.sound) {
      prompt.sound.split(",").forEach(s => {
        const val = s.trim();
        if (val) candidates.push({ value: val, priority: 1, role: getSoundRole(val) });
      });
    }
  });

  // 2. Mid-genre (Priority 2)
  const mid = MID_GENRE_PROMPTS[genreId];
  if (mid?.sound) {
    mid.sound.split(",").forEach(s => {
      const val = s.trim();
      if (val) candidates.push({ value: val, priority: 2, role: getSoundRole(val) });
    });
  }

  // 3. User Selection (Priority 0.5 - to override for "tuning" while keeping identity)
  const selectedLabels = getInstrumentSoundLabels(selectedSoundIds);
  selectedLabels.forEach(label => {
    candidates.push({ value: label, priority: 0.5, role: getSoundRole(label) });
  });

  // 4. Auto-correction (Priority 4)
  const GENRE_BASE: Record<string, string[]> = {
    drill: ["sparse drill drums", "heavy 808 bass"],
    trap: ["tight trap drums", "deep 808 bass"],
    "piano-ballad": ["soft piano-led melody", "restrained drums"],
    "lofi-hiphop": ["soft lofi drums", "warm bass"],
    kpop: ["polished synth", "punchy drums"],
    rnb: ["smooth keys", "warm bass"],
    pop: ["modern synth", "clean drums"],
    ballad: ["warm strings", "soft piano"],
  };
  (GENRE_BASE[genreId] || []).forEach(s => {
    candidates.push({ value: s, priority: 4, role: getSoundRole(s) });
  });

  const TEXTURE_MAP: Record<string, string> = {
    drill: "cold synth texture",
    trap: "polished digital texture",
    ballad: "warm acoustic texture",
    pop: "bright modern texture",
    jazz: "organic vintage texture",
    rock: "raw gritty texture",
    electronic: "glitchy ambient texture",
    "lofi-hiphop": "dusty lofi texture",
  };
  if (TEXTURE_MAP[genreId]) {
    candidates.push({ value: TEXTURE_MAP[genreId], priority: 4, role: "texture" });
  }

  const SPACE_MAP: Record<string, string> = {
    emotional: "spacious reverb",
    dark: "tight negative space",
    dreamy: "ethereal atmosphere",
    calm: "intimate dry space",
    tense: "claustrophobic pressure",
    energetic: "wide stereo field",
  };
  (params.moods ?? []).forEach(mood => {
    const space = SPACE_MAP[mood.toLowerCase()];
    if (space) candidates.push({ value: space, priority: 4, role: "space" });
  });

  // Filter out STYLE and VOCAL keywords
  const EXCLUDED_KEYWORDS = [
    "pop", "k-pop", "kpop", "idol", "style", "genre", "vocal", "singing", "voice", "rap",
    "emotional", "powerful", "high energy", "cheerful", "happy", "sad",
    "production", "quality", "commercial"
  ];

  const filteredCandidates = candidates.filter(c => {
    const lower = c.value.toLowerCase();
    if (lower.includes("dreamy") && !lower.includes("atmosphere") && !lower.includes("texture")) return false;
    return !EXCLUDED_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw));
  });

  // Role-based Deduplication: For each role, pick the best candidate
  const roleBest: Record<string, { value: string; priority: number }> = {};
  filteredCandidates.forEach(c => {
    if (!roleBest[c.role] || c.priority < roleBest[c.role].priority) {
      roleBest[c.role] = { value: c.value, priority: c.priority };
    }
  });

  const finalCandidates = Object.values(roleBest);

  // Optimize (Max 6)
  const optimizedSounds = optimizePromptArray(finalCandidates, 6, 1).map(s => s.charAt(0).toUpperCase() + s.slice(1));

  return `·SOUND: ${optimizedSounds.join(", ")}`;
}

function buildMoodTexture(params: GenerateSongParams): string {
  const moods = params.moods ?? [];
  if (moods.length === 0) return "·MOOD & TEXTURE: Balanced, clear and polished";

  const MOOD_TONE_MAP: Record<string, string[]> = {
    emotional: ["warm", "soft", "emotionally restrained"],
    sad: ["soft", "minimal", "fragile"],
    warm: ["warm", "gentle", "comforting"],
    calm: ["gentle", "smooth", "steady"],
    dark: ["cold", "heavy", "shadowy"],
    bright: ["bright", "clean", "vibrant"],
    hopeful: ["uplifting", "open", "soaring"],
    lonely: ["isolated", "spacious", "hollow"],
    nostalgic: ["warm", "vintage", "slightly blurred"],
    dreamy: ["airy", "spacious", "ethereal"],
    tense: ["tight", "pressured", "claustrophobic"],
    peaceful: ["soft", "flowing", "serene"],
  };

  const ATMOSPHERE_MAP: Record<string, string> = {
    emotional: "intimate atmosphere",
    dark: "noir atmosphere",
    dreamy: "hazy atmosphere",
    calm: "quiet atmosphere",
    tense: "high-tension atmosphere",
    energetic: "dynamic atmosphere",
    sad: "melancholic atmosphere",
    happy: "cheerful atmosphere",
    nostalgic: "late-night atmosphere",
    default: "polished atmosphere"
  };

  const tonesSet = new Set<string>();
  moods.forEach((mood) => {
    const tones = MOOD_TONE_MAP[mood.toLowerCase()];
    if (tones) {
      tones.forEach((t) => tonesSet.add(t));
    }
  });

  const lowerMoods = moods.map((m) => m.toLowerCase());
  const filteredTones = Array.from(tonesSet).filter((t) => !lowerMoods.includes(t.toLowerCase()));

  // Limit to 4 tones for richness
  const limitedTones = filteredTones.slice(0, 4);
  const atmosphere = ATMOSPHERE_MAP[lowerMoods[0]] || ATMOSPHERE_MAP.default;

  const combined = [...moods, ...limitedTones, atmosphere];
  return `·MOOD & TEXTURE: ${combined.join(", ")}`;
}

function buildVocal(params: GenerateSongParams): string {
  const v = params.vocal ?? { male: 0, female: 0, rap: false };
  const parts: string[] = [];

  // 1. Formation (Solo male vocal, Mixed group vocal, etc.)
  const formation = getVocalFormation(v);
  if (formation) {
    parts.push(formation);
  }

  // 2. Member Roles & Tones
  let membersOutput: string[] = [];
  if (v.members && v.members.length > 0) {
    membersOutput = v.members
      .map((m) => {
        const hasRoles = m.roles && m.roles.length > 0;
        const hasTone = !!m.toneId;
        if (!hasRoles && !hasTone) return null;

        const genderLabel = m.gender === 'male' ? 'Male' : 'Female';
        let toneLabel = "";

        if (m.toneId) {
          const tone = VOCAL_TONES.find((t) => t.id === m.toneId);
          if (tone) toneLabel = tone.label;
        } else if (v.globalToneId && v.isToneSelected) {
          const tone = VOCAL_TONES.find((t) => t.id === v.globalToneId);
          if (tone && (tone.genderTarget === 'any' || tone.genderTarget === m.gender)) {
            toneLabel = tone.label;
          }
        }

        // Redundancy check
        let finalLabel = toneLabel;
        if (finalLabel) {
          if (!finalLabel.toLowerCase().includes(genderLabel.toLowerCase())) {
            finalLabel = `${genderLabel} ${finalLabel}`;
          }
        } else {
          finalLabel = genderLabel;
        }

        const rolesLabel = hasRoles
          ? ` (${m.roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")})`
          : "";

        return `${finalLabel}${rolesLabel}`;
      })
      .filter((m): m is string => m !== null);
  }

  if (membersOutput.length > 0) {
    parts.push(...membersOutput);
  } else if (v.globalToneId) {
    // 3. Fallback: Selected or Recommended Tone Label
    const tone = VOCAL_TONES.find((t) => t.id === v.globalToneId);
    if (tone) {
      if (!formation) {
        parts.push("Genre-based recommended vocal tone");
      } else if (!v.isToneSelected) {
        parts.push("Genre-based recommended tone");
      } else {
        parts.push(tone.label);
      }
    }
  }

  // 4. Genre vocal auxiliary (max 1)
  const subGenreIds = params.subGenre ?? [];
  const genreVocalStrings = subGenreIds
    .map((id) => SUB_GENRE_PROMPTS[id]?.vocal)
    .filter(Boolean);

  if (genreVocalStrings.length > 0) {
    const firstVocalString = genreVocalStrings[0];
    const vocalOptions = firstVocalString.split(",").map((s) => s.trim());

    // Logic:
    // tone 있음 -> harmonies
    // tone 없음 -> hooks 또는 harmonies
    // harmonies 우선
    const harmonies = vocalOptions.find((o) =>
      o.toLowerCase().includes("harmonies")
    );
    const hooks = vocalOptions.find((o) => o.toLowerCase().includes("hooks"));

    if (harmonies) {
      parts.push(harmonies);
    } else if (hooks) {
      parts.push(hooks);
    } else {
      parts.push(vocalOptions[0]);
    }
  }

  // 4. Rap status
  if (v.rap) {
    parts.push("Rap enabled");
  }

  const capitalizedParts = parts
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return `·VOCAL: ${capitalizedParts.join(", ")}`;
}

function buildArrangement(params: GenerateSongParams, resolvedStructure: SongStructure): string {
  const genreId = params.genre;
  let flow = "dynamic progression with clear sectional contrast";

  if (genreId === "drill") flow = "cold and sparse with hard-hitting rhythmic shifts";
  if (genreId?.includes("jazz")) flow = "fluid and groove-led with organic transitions";
  if (genreId?.includes("ballad")) flow = "gradual emotional build-up towards a powerful climax";

  return `·ARRANGEMENT: ${flow}`;
}

function buildTheme(params: GenerateSongParams): string {
  const themeSentence = buildThemeSentence(params.themes ?? []);
  return `·THEME: ${themeSentence}`;
}

function buildFinalPrompt(params: GenerateSongParams, resolvedStructure: SongStructure): string {
  return [
    buildStyle(params),
    buildSound(params),
    buildMoodTexture(params),
    buildVocal(params),
    buildArrangement(params, resolvedStructure),
    buildTheme(params),
  ]
    .filter(NON_EMPTY)
    .join("\n\n");
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
  const genreMeta = getGenreMeta(params.genre);
  const genrePromptCore = genreMeta?.promptCore ?? "";
  const stylePromptCores = getStylePromptCores(params.styles ?? []);
  const instrumentSoundPromptCores = getInstrumentSoundPromptCores(params.instrumentSounds ?? []);
  const themePrompt = buildThemePrompt(params.themes ?? []);
  const themeSentence = buildThemeSentence(params.themes ?? []);
  const vocalPrompt = buildVocalPrompt(
    params.vocal ?? { male: 0, female: 0, rap: false },
    params.subGenre ?? []
  );
  const basePromptSeed = BASE_PROMPTS.join("\n");
  const finalPrompt = buildFinalPrompt(params, resolvedStructure);
  console.log("🔥 generateSong called");
  console.log("🔥 FINAL PROMPT:", finalPrompt);
  const exactStructureText = buildStructureText(
    params.songStructure,
    resolvedStructure,
    params.customStructure ?? []
  );

  const shouldUseMixedLyrics = Boolean(params.isKoreanEnglishMix || (params.isKpopSelected && params.kpopMode === 2));

  const mixedLyricsInstruction = shouldUseMixedLyrics
    ? `MIXED LANGUAGE MODE (MANDATORY):
- Use natural Korean/English mixed lyrics.
- Ratio: about 70-75% primary language flow and 25-30% mixed-language accents.
- For lyrics.korean: keep Korean as the main language, but include natural English words or short phrases in MULTIPLE sections.
- For lyrics.english: keep English as the main language, but include natural Korean words or short phrases in MULTIPLE sections.
- The chorus or hook MUST contain visible code-switching.
- Do not keep the two versions fully separated by language.
- Keep the code-switching natural and melodic, not forced.`
    : "";

  const structureInstruction =
    params.songStructure === "custom" && (params.customStructure ?? []).length > 0
      ? `SONG STRUCTURE (MANDATORY):
- Selected mode: Custom.
- Use this exact section order without omission or replacement:
${exactStructureText}
- Each tag in parentheses is a real arrangement instruction. Apply it musically, not just as a label.
- Do not collapse this into a generic pop structure.`
      : `SONG STRUCTURE (MANDATORY):
- Selected mode: ${resolvedStructure}.
- Use this exact structure:
${exactStructureText}
- Do not substitute a different default structure.`;

  const systemInstruction = `
You are a professional music composer and lyricist.

USER CREATIVE INTENT (HIGHEST PRIORITY):
${params.userInput || "No extra user description."}

IMPORTANT:
- The user input overrides stylistic assumptions if conflict occurs.
- Treat user intent as the primary creative direction.
- Do NOT simplify, generalize, or replace the selected arrangement with a default pop form.
- Treat the final production prompt below as a locked blueprint, not a loose reference.

ROOT GENRE:
${genrePromptCore || "Choose an appropriate mainstream-friendly root genre if none is given."}

STYLE LAYERS:
${stylePromptCores.length ? stylePromptCores.map((s) => `- ${s}`).join("\n") : "- No extra style layer selected."}

INSTRUMENT / SOUND LAYERS:
${instrumentSoundPromptCores.length ? instrumentSoundPromptCores.map((s) => `- ${s}`).join("\n") : "- No extra instrument/sound layer selected."}

MOOD LAYER (EMOTIONAL COLOR ONLY):
${(params.moods ?? []).join(", ") || "No explicit mood layer selected."}

THEME / STORY CONCEPT (SITUATION, MESSAGE, OR NARRATIVE):
${themePrompt || "No explicit theme/story concept selected."}
Expanded story direction: ${themeSentence}

LOCKED FINAL PRODUCTION PROMPT:
${finalPrompt}

VOCAL DIRECTION (HIGH PRIORITY):
${vocalPrompt}

REFERENCE PRINCIPLES:
${basePromptSeed}

${mixedLyricsInstruction}

${structureInstruction}

Return JSON:
{
  "title": "[Genre] 'English Title' │ 'Korean Title'",
  "lyrics": { "english": "Full English lyrics.", "korean": "Full Korean lyrics." }
}

Lyrics rules:
${lyricGuidancePrompt}
- The lyrics should primarily follow the user's story/intention and the selected theme(s).
- Themes define the situation, message, scene, or story.
- Moods define only the emotional tone or feeling around that story.
- The lyrics must clearly reflect the exact arrangement and section order provided above.
- If a section has tags such as Rap, Group, Minimal, Build-up, Instrumental, Soft, Big, or Adlib, the writing should support that musical role.
- Respect the selected lyricsLength strictly.
- Respect the selected song structure strictly.
- Do not drift longer than the requested lyric size.
- Do not invent a new structure that conflicts with the locked blueprint.
${params.specialPrompt ? `- SPECIAL INSTRUCTION: ${params.specialPrompt}` : ""}
`.trim();

  const ai = getAI();
  const response = await ai.models.generateContent({
    model,
    contents: "Generate the song title and lyrics based on the locked instructions.",
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
        },
        required: ["title", "lyrics"],
      },
    },
  });

  const result = JSON.parse(response.text || "{}");

  if (shouldUseMixedLyrics && result.lyrics) {
    result.lyrics = enforceKpopMixedLyrics(result.lyrics);
  }

  result.prompt = finalPrompt;
  result.appliedKeywords = {
    ...buildAppliedKeywordPayload(params, resolvedStructure),
    genre: params.genre ? [params.genre] : [],
    subGenre: params.subGenre ?? [],
    mood: params.moods ?? [],
    theme: params.themes ?? [],
    style: getStyleLabels(params.styles ?? []),
    instrumentSound: getInstrumentSoundLabels(params.instrumentSounds ?? []),
    tempo: params.tempo,
    kpopMode: params.kpopMode ?? 0,
  };

  if (!result.title || typeof result.title !== "string") {
    const genreLabel = genreMeta?.label ?? (params.genre ? sentenceCase(params.genre) : "Song");
    result.title = `[${genreLabel}] 'Untitled' │ '무제'`;
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
