console.log("🔥 NEW GEMINI ACTIVE");
import { GoogleGenAI, Type } from "@google/genai";
import {
  BASE_PROMPTS,
  BASIC_STRUCTURE,
  GENRE_GROUPS,
  GENRE_HIERARCHY,
  GENRES,
  INSTRUMENT_SOUNDS,
  SOUND_STYLES,
  MID_GENRE_PROMPTS,
  SUB_GENRE_PROMPTS,
  MOODS,
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
type LanguageCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr';

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
  lyricDraft?: string;
  isLyricMode?: boolean;
  lyricMode?: 'assist' | 'preserve';
  songPrompt?: string;
  lyricsLength?: LyricsLength;
  songStructure?: SongStructure;
  useAutoDuration?: boolean;
  vocal?: VocalConfig;
  tempo?: string;
  specialPrompt?: string;
  kpopMode?: 0 | 1 | 2;
  customStructure?: CustomSectionItem[];
  isNoLyrics?: boolean;
  includeLyrics?: boolean;
  lyricLanguages?: LanguageCode[];
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
        labelKo: found.labelKo,
        description: found.description,
        promptCore: found.promptCore ?? "",
      };
    }
  }

  return null;
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
    .map((value) => {
      const item = resolveInstrumentSoundItem(value);
      return item?.promptCore ?? item?.label ?? sentenceCase(value);
    })
    .filter(NON_EMPTY);
}
function resolveMoodItem(value: string) {
  const normalized = value.trim().toLowerCase();
  return MOODS.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized
  );
}

function resolveMoodValue(moodValue: string): string {
  const mood = resolveMoodItem(moodValue);
  if (!mood) return moodValue;
  return mood.mood ?? mood.promptCore ?? mood.label;
}
function resolveVocalToneValue(toneIdOrLabel: string): string {
  const normalized = toneIdOrLabel.trim().toLowerCase();

  const tone = VOCAL_TONES.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized
  );

  if (!tone) return toneIdOrLabel;
  return tone.promptCore ?? tone.label;
}

/**
 * Generalizes artist names into vocal characteristics to avoid direct mentions.
 */
function sanitizeUserInput(input: string): string {
  if (!input) return "";
  
  let sanitized = input;
  
  const artistReplacements: [RegExp, string][] = [
    [/아이유|IU/gi, "맑고 섬세한 여성 보컬 (clear and delicate female vocal)"],
    [/태연|Taeyeon/gi, "청아하고 호소력 있는 여성 보컬 (clear and soulful female vocal)"],
    [/정국|Jungkook/gi, "부드럽고 트렌디한 남성 보컬 (smooth and trendy male vocal)"],
    [/지민|Jimin/gi, "유니크하고 미성이 섞인 남성 보컬 (unique and high-toned male vocal)"],
    [/뷔|V(?![a-z])/gi, "허스키하고 깊은 저음의 남성 보컬 (husky and deep bass male vocal)"],
    [/블랙핑크|BLACKPINK/gi, "세련되고 파워풀한 여성 그룹 보컬 (sophisticated and powerful female group vocal)"],
    [/뉴진스|NewJeans/gi, "자연스럽고 청량한 여성 그룹 보컬 (natural and refreshing female group vocal)"],
    [/에스파|aespa/gi, "에너제틱하고 미래지향적인 여성 그룹 보컬 (energetic and futuristic female group vocal)"],
    [/볼빨간사춘기|안지영/gi, "독특하고 귀여운 음색의 여성 보컬 (unique and cute female vocal)"],
    [/백예린|Yerin Baek/gi, "몽환적이고 감각적인 여성 보컬 (dreamy and soulful female vocal)"],
    [/임영웅/gi, "따뜻하고 호소력 짙은 남성 보컬 (warm and deeply expressive male vocal)"],
    [/성시경/gi, "부드럽고 감미로운 남성 보컬 (smooth and sweet male vocal)"],
    [/박효신/gi, "웅장하고 깊은 울림의 남성 보컬 (grand and deep resonant male vocal)"],
    [/트와이스|TWICE/gi, "밝고 에너제틱한 여성 그룹 보컬 (bright and energetic female group vocal)"],
    [/아이브|IVE/gi, "우아하고 세련된 여성 그룹 보컬 (elegant and sophisticated female group vocal)"],
    [/르세라핌|LE SSERAFIM/gi, "당당하고 파워풀한 여성 그룹 보컬 (confident and powerful female group vocal)"],
  ];

  artistReplacements.forEach(([regex, replacement]) => {
    sanitized = sanitized.replace(regex, replacement);
  });

  return sanitized;
}
/**
 * Handles Gemini API errors and provides user-friendly messages.
 */
function handleGeminiError(error: any, context: string): never {
  console.error(`Gemini API Error (${context}):`, error);
  
  const errorStr = JSON.stringify(error);
  const isQuotaError = 
    error?.status === "RESOURCE_EXHAUSTED" || 
    error?.code === 429 || 
    error?.error?.code === 429 ||
    error?.error?.status === "RESOURCE_EXHAUSTED" ||
    errorStr.includes("RESOURCE_EXHAUSTED") || 
    errorStr.includes("quota") ||
    errorStr.includes("429");

  if (isQuotaError) {
    throw new Error("API 할당량이 초과되었습니다. 잠시 후 다시 시도하거나, 나중에 다시 이용해주세요. (API Quota Exceeded)");
  }
  
  // Check for other common errors
  if (error?.status === "INVALID_ARGUMENT" || error?.code === 400 || error?.error?.code === 400) {
    throw new Error("요청이 부적절합니다. 입력 내용을 확인해주세요. (Invalid Request)");
  }

  throw new Error("음악 생성 중 오류가 발생했습니다. 다시 시도해주세요. (Generation Error)");
}

/**
 * Normalizes user free-text without an extra AI call.
 *
 * Cost rule:
 * - Do NOT call Gemini here. The main song generation call is enough.
 * - Artist names are generalized by sanitizeUserInput().
 * - The deterministic parser below distributes the note into GENRE/SOUND/MOOD/etc.
 */
async function buildDetailLayer(userInput: string): Promise<string> {
  const trimmed = (userInput || "").trim();
  if (!trimmed) return "";

  return sanitizeUserInput(trimmed)
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function buildLyricsLengthInstruction(lyricsLength: LyricsLength = "normal"): string {
  switch (lyricsLength) {
    case "very-short":
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: very-short.
- Keep the lyrics extremely concise.
- Target about 2-3 lyric lines per major section.
- Avoid extra filler lines, repeated padding, long storytelling passages, and unnecessary ad-libs.
- Keep verses, pre-chorus, bridge, and outro notably compact.
- Chorus may repeat hook phrases, but the overall lyric body must still stay short.`;
    case "short":
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: short.
- Keep the lyrics shorter than a standard pop lyric.
- Target about 3-4 lyric lines per major section.
- Use concise imagery and tighter phrasing.
- Avoid long verses, excessive repetition, and over-explaining the story.
- Chorus can be memorable, but keep the overall lyric count restrained.`;
    case "long":
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: long.
- Write noticeably longer lyrics than a standard song.
- Target about 6-8 lyric lines per major section.
- Expand the storytelling, imagery, and emotional development.
- Verses, bridge, and final chorus should feel fuller and more developed.
- Do not keep the lyric body short or overly minimal.`;
    case "normal":
    default:
      return `LYRICS LENGTH (MANDATORY):
- Apply this length rule across ALL genres without exception.
- The selected length is: normal.
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
  if (normalized.length === 0) return "";

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

  // --- Add Auxiliary Vocal Rule (Only 1) ---
  let auxiliaryVocalRule = "";
  if (subGenres.length > 0) {
    const genreVocal = SUB_GENRE_PROMPTS[subGenres[0]]?.vocal;
    if (genreVocal) {
      const genreParts = genreVocal.split(",").map(s => s.trim());
      const harmonies = genreParts.find(p => p.toLowerCase().includes("harmonies"));
      const hooks = genreParts.find(p => p.toLowerCase().includes("hooks"));
      const auxiliary = harmonies || hooks || genreParts[0];
      if (auxiliary) {
        auxiliaryVocalRule = `\n- Additional Vocal Styling: ${auxiliary}`;
      }
    }
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
          const toneValue = resolveVocalToneValue(m.toneId);
          const displayLabel = toneValue.toLowerCase().includes(genderStr.toLowerCase())
            ? toneValue
            : `${genderStr} ${toneValue}`;
          toneInfo = `, Tone: ${displayLabel}`;
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

  return `
VOCAL RULE (STRICT):
- Formation: ${formation}
- Gender: ${genderRule}${memberRolesRule}
- ${rapRule}${toneRule}${auxiliaryVocalRule}
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
      lyricDraft: first.lyricDraft ?? "",
      isLyricMode: first.isLyricMode ?? false,
      lyricMode: first.lyricMode ?? 'assist',
      isNoLyrics: first.isNoLyrics ?? false,
      includeLyrics: (first as any).includeLyrics ?? !(first.isNoLyrics ?? false),
      lyricLanguages: ((first as any).lyricLanguages ?? ['ko', 'en']) as LanguageCode[],
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
    lyricDraft: "",
    isLyricMode: false,
    lyricMode: 'assist',
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
  const styles = params.styles ?? [];
  const instrumentSounds = params.instrumentSounds ?? [];
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
    isKoreanEnglishMix: params.isKoreanEnglishMix ?? false,
    vocal: params.vocal ?? { male: 0, female: 0, rap: false },
    isNoLyrics: params.isNoLyrics ?? false,
    lyricDraft: params.lyricDraft,
    isLyricMode: params.isLyricMode ?? false,
    lyricMode: params.lyricMode ?? 'assist',
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

function buildStyle(params: GenerateSongParams): string {
  const subGenreIds = params.subGenre ?? [];
  const genreId = (params.genre || "pop").toLowerCase();
  
  let genreStyle = "";
  if (subGenreIds.length > 0) {
    genreStyle = SUB_GENRE_PROMPTS[subGenreIds[0]]?.style || "";
  } else if (genreId) {
    genreStyle = MID_GENRE_PROMPTS[genreId]?.style || "";
  }
  
  if (!genreStyle) {
    const genreMeta = getGenreMeta(genreId);
    genreStyle = genreMeta?.label || "Pop";
  }

  const selectedStyleIds = params.styles ?? [];
  const stylePrompts: string[] = [];
  // Only 1st style affects STYLE section
  if (selectedStyleIds.length > 0) {
    const item = resolveStyleItem(selectedStyleIds[0]);
    if (item?.style) {
      stylePrompts.push(item.style);
    }
  }

  const tempoText = params.tempo
    ? params.tempo
        .replace(/^Between\s+/i, "")
        .replace(/^Exactly\s+/i, "")
        .replace(/\s+and\s+/i, "–")
        .replace(/\s*BPM\s*/gi, "")
        .trim()
    : "";

  let stylePart = genreStyle;
  if (stylePrompts.length > 0) {
    const uniqueStylePrompts = Array.from(new Set(stylePrompts));
    stylePart = `${genreStyle} with ${uniqueStylePrompts.join(", ")}`;
  }
  
  const bpmPart = tempoText ? `, ${tempoText} BPM` : "";

  return `GENRE: ${stylePart}${bpmPart}`;
}

function buildSound(params: GenerateSongParams): string {
  const subGenreIds = params.subGenre ?? [];
  const genreId = (params.genre || "pop").toLowerCase();
  const selectedSoundIds = params.instrumentSounds ?? [];
  
  interface SoundItem {
    label: string;
    priority: number; // 2: User, 1: Genre (Sub or Mid), 0: Other
    role: string | null;
  }

  const soundItems: SoundItem[] = [];
  const ROLES = ["bass", "snare", "drum", "kick", "hi-hat", "synth", "piano", "guitar", "pad", "string", "808", "percussion", "lead", "pluck"];

  const getRole = (s: string) => {
    const lower = s.toLowerCase();
    if (lower.includes("808")) return "808";
    for (const r of ROLES) {
      if (lower.includes(r)) return r;
    }
    return null;
  };

  // 1. User selected sounds (Highest priority)
  const selectedLabels = getInstrumentSoundLabels(selectedSoundIds);
  selectedLabels.forEach(label => {
    soundItems.push({ label, priority: 2, role: getRole(label) });
  });

  // 1.5. Style sounds (1st and 2nd styles only)
  const selectedStyleIds = params.styles ?? [];
  selectedStyleIds.slice(0, 2).forEach(id => {
    const item = resolveStyleItem(id);
    if (item?.sound) {
      item.sound.split(",").forEach(s => {
        const label = s.trim();
        if (label) {
          soundItems.push({ label, priority: 1.5, role: getRole(label) });
        }
      });
    }
  });

  // 2. Genre sounds (SubGenre takes precedence over MidGenre)
  let genreSoundSource = "";
  if (subGenreIds.length > 0) {
    genreSoundSource = SUB_GENRE_PROMPTS[subGenreIds[0]]?.sound || "";
  } else if (genreId) {
    genreSoundSource = MID_GENRE_PROMPTS[genreId]?.sound || "";
  }

  if (genreSoundSource) {
    genreSoundSource.split(",").forEach(s => {
      const label = s.trim();
      if (label) {
        soundItems.push({ label, priority: 1, role: getRole(label) });
      }
    });
  }

  // Deduplicate by role and label
  const finalSoundLabels: string[] = [];
  const seenRoles = new Set<string>();
  const seenLabels = new Set<string>();

  // Sort by priority desc
  soundItems.sort((a, b) => b.priority - a.priority);

  for (const item of soundItems) {
    const lowerLabel = item.label.toLowerCase();
    if (seenLabels.has(lowerLabel)) continue;

    if (item.role) {
      if (seenRoles.has(item.role)) continue;
      seenRoles.add(item.role);
    }
    
    seenLabels.add(lowerLabel);
    finalSoundLabels.push(item.label);
  }

  // Ensure not empty
  if (finalSoundLabels.length === 0) {
    finalSoundLabels.push("Drums", "Bass", "Synthesizer", "Piano");
  }

  const limitedSounds = finalSoundLabels.slice(0, 9);
  return `SOUND: ${limitedSounds.join(", ")}`;
}

function buildMoodTexture(params: GenerateSongParams): string {
  const moods = params.moods ?? [];

  // 1. Mood values from MOODS data (all selected)
  const moodValues = moods
    .map((mood) => resolveMoodValue(mood))
    .filter(Boolean);

  // 2. Mood values from selected styles (1st, 2nd, and 3rd styles)
  const selectedStyleIds = params.styles ?? [];
  const styleMoods: string[] = [];
  selectedStyleIds.slice(0, 3).forEach(id => {
    const item = resolveStyleItem(id);
    if (item?.mood) {
      styleMoods.push(item.mood);
    }
  });

  // Combine and deduplicate
  const combinedMoods = Array.from(new Set([...moodValues, ...styleMoods]));

  const moodValue = combinedMoods.length > 0
    ? combinedMoods.join(", ")
    : "Balanced";

  const textureDesc = "clear and polished";

  return `MOOD: ${moodValue}, ${textureDesc}`;
}

function buildVocal(params: GenerateSongParams): string {
  const v = params.vocal ?? { male: 0, female: 0, rap: false };
  const subGenreIds = (params.subGenre ?? []).map(id => id.toLowerCase());
  const genreId = (params.genre || "").toLowerCase();
  const parts: string[] = [];

  const isHiphop = genreId.includes("hiphop") || 
                   genreId.includes("trap") || 
                   genreId.includes("drill") ||
                   subGenreIds.some(id => id.includes("hiphop") || id.includes("trap") || id.includes("drill") || id.includes("rap"));
  
  // 1. Formation
  const formation = getVocalFormation(v);
  if (formation) parts.push(formation);

  // Check Tone Selection Status
  let allTonesSelected = false;
  const hasGlobalTone = v.isToneSelected && v.globalToneId;
  const hasMembers = v.members && v.members.length > 0;
  
  if (v.isToneSelected) {
    allTonesSelected = true;
  } else if (hasMembers) {
    allTonesSelected = v.members!.every(m => !!m.toneId);
  } else {
    allTonesSelected = false;
  }

  const shouldApplyRecommended = !allTonesSelected;
  const shouldApplyGenreFixedTones = allTonesSelected;

  // Collect Tones and Auxiliaries from Genre
  const genreTones: string[] = [];
  const genreAuxiliaries: string[] = [];
  
  let genreVocalSource = "";
  if (subGenreIds.length > 0) {
    genreVocalSource = SUB_GENRE_PROMPTS[subGenreIds[0]]?.vocal || "";
  } else if (genreId) {
    genreVocalSource = MID_GENRE_PROMPTS[genreId]?.vocal || "";
  }

  if (genreVocalSource) {
    const rawParts = genreVocalSource.split(",").map(p => p.trim()).filter(Boolean);
    const auxKeywords = ["harmonies", "hooks", "delivery", "phrasing", "scat", "ad-libs", "call and response", "storytelling", "ggeok-gi", "technique"];
    
    rawParts.forEach(part => {
      const lower = part.toLowerCase();
      if (auxKeywords.some(kw => lower.includes(kw))) {
        genreAuxiliaries.push(part);
      } else {
        genreTones.push(part);
      }
    });
  }

  // 2. Tones (Conditional Application)
  const toneParts: string[] = [];
  
  // A. User Global Tone
  if (hasGlobalTone && v.globalToneId) {
  toneParts.push(resolveVocalToneValue(v.globalToneId));
}

  // B. Genre Fixed Tones (Only if all tones selected)
  if (shouldApplyGenreFixedTones) {
    toneParts.push(...genreTones);
  }

  // C. Recommended Tone (If not all selected)
  if (shouldApplyRecommended) {
    toneParts.push("Genre-based recommended vocal tone");
  }

  // Deduplicate tones (case-insensitive)
  const uniqueTones = Array.from(new Set(toneParts.map(t => t.toLowerCase())))
    .map(lower => toneParts.find(t => t.toLowerCase() === lower)!);
  
  parts.push(...uniqueTones);

  // 3. Members (if any) - Member tones and roles
  if (hasMembers) {
    const membersOutput = v.members!
      .map((m, idx) => {
        const genderLabel = m.gender === 'male' ? 'Male' : 'Female';
        let toneLabel = "";
        if (m.toneId) {
          toneLabel = resolveVocalToneValue(m.toneId);
        }
        
        let finalLabel = toneLabel || genderLabel;
        if (toneLabel && !toneLabel.toLowerCase().includes(genderLabel.toLowerCase())) {
          finalLabel = `${genderLabel} ${toneLabel}`;
        }

        // Role Assignment Logic
        let roles = [...(m.roles || [])];
        if (roles.length === 0) {
          if (idx === 0) roles = ["main"];
          else if (idx === 1) roles = ["lead"];
          else if (idx === 2 && isHiphop) roles = ["rapper"];
          else roles = ["sub"];
        }

        // Ensure Rapper for Hiphop if missing
        if (isHiphop && idx === v.members!.length - 1 && !v.members!.some(member => member.roles?.some(r => r.toLowerCase().includes("rapper")))) {
          if (!roles.some(r => r.toLowerCase().includes("rapper"))) {
            roles = roles.filter(r => r !== "sub");
            if (roles.length === 0) roles.push("rapper");
            else roles.push("rapper");
          }
        }

        const rolesLabel = roles.length > 0
          ? ` (${roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")})`
          : "";

        return `${finalLabel}${rolesLabel}`;
      })
      .filter((m): m is string => m !== null);
    parts.push(...membersOutput);
  }

  // 4. Auxiliary Vocal (1 only)
  if (genreAuxiliaries.length > 0) {
    // Priority: harmonies > hooks > delivery > phrasing > others
    const harmonies = genreAuxiliaries.find(p => p.toLowerCase().includes("harmonies"));
    const hooks = genreAuxiliaries.find(p => p.toLowerCase().includes("hooks"));
    const delivery = genreAuxiliaries.find(p => p.toLowerCase().includes("delivery"));
    const phrasing = genreAuxiliaries.find(p => p.toLowerCase().includes("phrasing"));
    
    const selectedAux = harmonies || hooks || delivery || phrasing || genreAuxiliaries[0];
    parts.push(selectedAux);
  }

  // 5. Rap
  if (v.rap) parts.push("Rap enabled");

  const deduplicated = Array.from(new Set(parts.map(p => p.toLowerCase())))
    .map(lower => parts.find(p => p.toLowerCase() === lower) || lower);

  return `VOCAL: ${deduplicated.join(", ")}`;
}

function buildArrangement(params: GenerateSongParams, resolvedStructure: SongStructure): string {
  const genreId = params.genre;
  let genreFlow = "dynamic progression with clear sectional contrast";

  if (genreId === "drill") genreFlow = "cold and sparse with hard-hitting rhythmic shifts";
  if (genreId?.includes("jazz")) genreFlow = "fluid and groove-led with organic transitions";
  if (genreId?.includes("ballad")) genreFlow = "gradual emotional build-up towards a powerful climax";

  // Mood arrangements (first 3 only)
  const moodArrangements: string[] = [];
  const moods = params.moods ?? [];
  moods.slice(0, 3).forEach(id => {
    const item = resolveMoodItem(id);
    if (item?.arrangement) {
      moodArrangements.push(item.arrangement);
    }
  });

  // Combine and deduplicate
  const combinedArrangements = Array.from(new Set([genreFlow, ...moodArrangements]));

  return `ARRANGEMENT: ${combinedArrangements.join(", ")}`;
}

const DEFAULT_NO_THEME_DIRECTION = "No explicit story theme selected; create a simple original everyday emotional scene. Do not use genre, mood, vocal, sound, arrangement, tempo, hook, or structure terms as the lyrical topic.";

const TECHNICAL_DIRECTION_LYRICS_GUARD = `
TECHNICAL DIRECTION GUARD (MANDATORY):
- Treat genre, mood, sound, vocal, tempo, hook, and arrangement words as production instructions only, unless the user explicitly states they are the story topic.
- Do NOT turn these into literal title or lyric content: offbeat, syncopated, half-beat, slow tempo, fast tempo, BPM, hook, addictive chorus, vocal tone, female vocal, male vocal, unique voice, high-note restraint, avoid belting, guitar, synth, bass, R&B groove, indie-pop production, genre labels.
- Korean equivalents are also production instructions only: 엇박자, 느린템포, 빠른템포, 고음자제, 고음방지, 중독성있는 후렴, 후렴구, 여자보컬, 남자보컬, 여자보이스, 남자보이스, 독특한 목소리, 보컬톤, 기타, 신스, 베이스, 장르명.
- These terms should shape performance, phrasing, arrangement, and production, but must NOT become repeated lyric phrases, metaphors, title concepts, or the central story.
- If the theme says “everyday freedom,” write about ordinary freedom or self-expression through concrete scenes, not about vocal rhythm or tempo.
`;

function buildTheme(params: GenerateSongParams): string {
  const themes = params.themes ?? [];
  if (themes.length === 0) return `THEME: ${DEFAULT_NO_THEME_DIRECTION}`;
  const themeSentence = buildThemeSentence(themes);
  return `THEME: ${themeSentence}`;
}

function hasFreeTextDirectorNote(params: GenerateSongParams): boolean {
  return Boolean((params.userInput || "").trim());
}

function hasExplicitGenreSelection(params: GenerateSongParams): boolean {
  return Boolean((params.genre || "").trim()) || Boolean((params.subGenre ?? []).length);
}

function isFreeTextPrimaryMode(params: GenerateSongParams): boolean {
  return hasFreeTextDirectorNote(params) && !hasExplicitGenreSelection(params);
}

type FreeTextDirectorProfile = {
  genre: string;
  sound: string;
  mood: string;
  vocal: string;
  arrangement: string;
  theme: string;
  detail: string;
};

function includesAny(source: string, keywords: string[]): boolean {
  return keywords.some((keyword) => source.includes(keyword.toLowerCase()));
}

function pushUnique(target: string[], ...values: string[]) {
  values.forEach((value) => {
    const normalized = value.trim();
    if (normalized && !target.includes(normalized)) target.push(normalized);
  });
}

function hasInfluenceBeforeMainGenre(source: string, influenceKeywords: string[], mainGenreKeywords: string[]): boolean {
  return influenceKeywords.some((influence) =>
    mainGenreKeywords.some((genre) => {
      const influenceIndex = source.indexOf(influence.toLowerCase());
      const genreIndex = source.indexOf(genre.toLowerCase());
      if (influenceIndex < 0 || genreIndex < 0 || influenceIndex >= genreIndex) return false;

      const between = source.slice(influenceIndex + influence.length, genreIndex);
      return /(느낌|감성|풍|스타일|influence|inspired|based|with|like|색깔|질감)/i.test(between);
    })
  );
}


type FreeTextVocalHint = { keywords: string[]; prompts: string[] };

const FREE_TEXT_VOCAL_HINTS: FreeTextVocalHint[] = [
  { keywords: ["독특한 창법", "유니크한 창법", "특이한 창법", "개성 있는 보컬", "개성있는 보컬", "특이한 보컬", "유니크한 보컬", "독특한 보컬", "독특한 목소리", "유니크한 목소리", "특이한 목소리", "개성 있는 목소리", "개성있는 목소리", "독특한 음색", "유니크한 음색", "distinctive vocal", "unique vocal", "unique voice", "distinctive voice"], prompts: ["unique vocal phrasing", "distinctive vocal tone"] },
  { keywords: ["속삭이듯", "속삭이는", "속삭임", "whisper", "whispery", "breathy"], prompts: ["whispery vocal texture", "intimate breathy delivery"] },
  { keywords: ["말하듯이", "말하듯", "말하는 듯", "spoken-like", "conversational"], prompts: ["conversational singing style", "natural spoken-like phrasing"] },
  { keywords: ["나른하게", "나른한", "느슨하게", "lazy", "laid-back", "relaxed"], prompts: ["relaxed airy delivery", "lazy soft vocal tone"] },
  { keywords: ["허스키", "husky", "raspy"], prompts: ["husky vocal color", "slightly raspy texture"] },
  { keywords: ["비음", "nasal"], prompts: ["nasal vocal nuance", "bright nasal resonance"] },
  { keywords: ["힘 빼고", "힘빼고", "힘을 빼고", "힘을 뺀", "low-pressure"], prompts: ["relaxed low-pressure vocal delivery"] },
  { keywords: ["음 끝", "끝을 끌", "끌어주는", "drawn-out", "trailing"], prompts: ["slightly drawn-out line endings", "soft trailing vocal lines"] },
  { keywords: ["흘리듯", "흘려 부르는", "flowing"], prompts: ["flowing loose phrasing", "soft trailing vocal lines"] },
  { keywords: ["몽환적인 보컬", "몽환적 보컬", "몽환적인 발음", "dreamy vocal", "airy vocal"], prompts: ["dreamy airy vocal tone", "soft ethereal pronunciation"] },
  { keywords: ["청량한 보컬", "맑은 보컬", "청아한 보컬", "clear pure vocal", "refreshing vocal"], prompts: ["clear pure vocal tone", "bright refreshing vocal tone"] },
  { keywords: ["귀여운 보컬", "cute vocal", "playful vocal"], prompts: ["cute playful vocal delivery"] },
  { keywords: ["세련된 보컬", "polished vocal", "modern vocal"], prompts: ["polished modern vocal delivery"] },
  { keywords: ["도도한 보컬", "chic vocal", "confident vocal"], prompts: ["chic confident vocal delivery"] },
  { keywords: ["감정적인 보컬", "감성적인 보컬", "감정이 묻어", "emotional vocal"], prompts: ["emotionally expressive delivery"] },
  { keywords: ["담담한 보컬", "담백한 보컬", "calm vocal", "restrained vocal"], prompts: ["restrained emotional delivery", "calm intimate tone"] },
  { keywords: ["섬세한 보컬", "delicate vocal"], prompts: ["delicate vocal control", "subtle emotional nuance"] },
  { keywords: ["파워풀한 보컬", "강한 보컬", "powerful vocal"], prompts: ["powerful vocal delivery"] },
  { keywords: ["시원한 고음", "고음 폭발", "high notes", "high note"], prompts: ["open bright high notes"] },
  { keywords: ["거친 보컬", "gritty vocal"], prompts: ["gritty vocal texture"] },
  { keywords: ["절규하듯", "절규", "belted", "belting"], prompts: ["intense belted emotional delivery"] },
  { keywords: ["폭발적인 후렴", "터지는 후렴", "explosive chorus"], prompts: ["explosive chorus vocal lift"] },
  { keywords: ["그루브 있는 보컬", "groovy vocal", "rhythmic vocal"], prompts: ["groovy rhythmic vocal phrasing"] },
  { keywords: ["소울풀한 보컬", "soulful vocal"], prompts: ["soulful vocal delivery"] },
  { keywords: ["애드리브", "애드립", "ad-lib", "adlib", "vocal runs"], prompts: ["expressive ad-libs", "vocal runs"] },
  { keywords: ["꺾는 창법", "꺾어서", "꺾어 부르는", "멜리즈마", "melismatic"], prompts: ["melismatic vocal runs", "flexible ornamented phrasing"] },
  { keywords: ["랩하듯", "랩처럼", "rap-sung"], prompts: ["rap-sung vocal phrasing"] },
];

function applyFreeTextVocalHints(lowerNote: string, vocalParts: string[]) {
  FREE_TEXT_VOCAL_HINTS.forEach((hint) => {
    if (includesAny(lowerNote, hint.keywords)) {
      pushUnique(vocalParts, ...hint.prompts);
    }
  });
}

function buildFreeTextDirectorProfile(note: string): FreeTextDirectorProfile {
  const rawNote = (note || "").trim();
  const lower = rawNote.toLowerCase();

  const mainGenreParts: string[] = [];
  const genreInfluenceParts: string[] = [];
  const soundParts: string[] = [];
  const moodParts: string[] = [];
  const arrangementParts: string[] = [];
  const themeParts: string[] = [];
  const vocalParts: string[] = [];
  const constraintParts: string[] = [];

  const has = (keywords: string[]) => includesAny(lower, keywords);
  const has80sEra = has(["80년대", "80s", "80's", "eighties"]);
  const hasRetro = has80sEra || has(["레트로", "retro", "복고"]);
  const hasSlowTempo = has(["느린템포", "느린 템포", "느리게", "slow tempo", "slow", "잔잔한 템포", "gentle tempo"]);
  const hasFastTempo = has(["빠른템포", "빠른 템포", "빠르게", "fast tempo", "fast", "업템포", "up-tempo", "uptempo"]);
  const hasMidTempo = has(["미디엄", "medium tempo", "mid tempo", "mid-tempo"]);
  const hasCalm = has(["잔잔", "차분", "담담", "calm", "quiet", "understated", "gentle"]);

  const rnbKeywords = ["알앤비", "알앤비느낌", "알앤비 느낌", "리듬앤블루스", "r&b", "rnb", "rhythm and blues"];
  const neoSoulKeywords = ["네오소울", "네오 소울", "neo soul", "neo-soul"];
  const indieKeywords = ["인디음악", "인디 음악", "인디곡", "인디 곡", "인디팝", "인디 팝", "indie", "indie song", "indie music", "indie pop", "indie-pop"];
  const cityPopKeywords = ["시티팝", "city pop", "city-pop", "citypop"];
  const synthPopKeywords = ["시스팝", "신스팝", "신스 팝", "synth pop", "synth-pop", "synthpop"];
  const idolKeywords = ["아이돌", "idol", "idol pop", "아이돌팝", "아이돌 팝"];
  const balladKeywords = ["발라드", "발라드곡", "ballad"];
  const rockKeywords = ["락", "록", "락곡", "록곡", "rock"];
  const rnbInfluenceOfIndie = hasInfluenceBeforeMainGenre(lower, rnbKeywords, indieKeywords);
  const neoSoulInfluenceOfCityPop = hasInfluenceBeforeMainGenre(lower, neoSoulKeywords, cityPopKeywords);

  // MAIN GENRE: one main identity first, then secondary influences.
  if (has(synthPopKeywords)) {
    pushUnique(mainGenreParts, has(idolKeywords) ? "Synth Pop / Idol Pop" : "Synth Pop");
    pushUnique(soundParts, "layered synths", "polished electronic pop production", "bright synth texture", "punchy electronic groove");
    pushUnique(moodParts, "stylish modern pop mood", "slightly quirky energy");
    pushUnique(arrangementParts, "synth-pop progression", "clear electronic sectional contrast");
  }

  if (!has(synthPopKeywords) && has(idolKeywords)) {
    pushUnique(mainGenreParts, "Idol Pop");
    pushUnique(soundParts, "polished idol-pop production", "clean hook-focused mix");
    pushUnique(moodParts, "stylish idol-pop energy");
    pushUnique(arrangementParts, "idol-pop sectional progression");
  }

  if (has(cityPopKeywords)) {
    pushUnique(mainGenreParts, has80sEra ? "80s City Pop" : "City Pop");
    pushUnique(soundParts, "smooth electric piano", "clean funk guitar", "warm analog synth", "polished retro-pop groove");
    pushUnique(moodParts, "urban night mood", "nostalgic retro mood");
    pushUnique(arrangementParts, has80sEra ? "80s city-pop progression" : "smooth city-pop progression");
  }

  if (has(["국악", "국악퓨전", "국악 퓨전", "전통 퓨전", "korean traditional fusion", "gugak", "gugak fusion"])) {
    pushUnique(mainGenreParts, "Korean Traditional Fusion");
    pushUnique(soundParts, "gayageum or haegeum color", "traditional Korean percussion", "cinematic drums", "modern fusion production");
    pushUnique(moodParts, "epic historical atmosphere", "solemn heroic mood");
    pushUnique(arrangementParts, "cinematic Korean traditional fusion progression", "dramatic dynamic structure");
  }

  if (has(indieKeywords)) {
    pushUnique(mainGenreParts, hasSlowTempo || hasCalm ? "Slow Indie Pop" : "Indie Pop");
    pushUnique(soundParts, "minimal indie-pop production", "warm guitar or soft keys", "intimate clean mix");
    pushUnique(moodParts, "calm intimate mood", "understated emotional color");
    pushUnique(arrangementParts, "relaxed indie-pop progression");
  }

  if (has(["케이팝", "k-pop", "kpop"])) pushUnique(mainGenreParts, "K-Pop");
  if (has(balladKeywords)) pushUnique(mainGenreParts, "Ballad");
  if (has(["트로트", "trot"])) pushUnique(mainGenreParts, "Trot");
  if (has(rockKeywords)) pushUnique(mainGenreParts, "Rock");
  if (has(["재즈", "jazz"])) pushUnique(mainGenreParts, "Jazz");
  if (has(["edm", "일렉트로닉", "electronic"])) pushUnique(mainGenreParts, "EDM");
  if (has(["댄스", "dance"])) pushUnique(mainGenreParts, "Dance Pop");
  if (has(["힙합", "hip hop", "hip-hop"])) pushUnique(mainGenreParts, "Hip-Hop");
  if (has(rnbKeywords)) {
    if (rnbInfluenceOfIndie) {
      pushUnique(mainGenreParts, hasSlowTempo || hasCalm ? "Slow Indie Pop" : "Indie Pop");
      pushUnique(genreInfluenceParts, "R&B influence");
    } else if (mainGenreParts.length) {
      pushUnique(genreInfluenceParts, "R&B influence");
    } else {
      pushUnique(mainGenreParts, "R&B");
    }
    pushUnique(soundParts, "smooth R&B groove", "warm keys", "soft bass", "intimate polished mix");
    pushUnique(moodParts, "mellow soulful mood", "laid-back intimate atmosphere");
    pushUnique(arrangementParts, rnbInfluenceOfIndie ? "relaxed indie-R&B groove progression" : "slow R&B groove progression");
  }
  if (has(["포크", "folk", "folk-pop", "어쿠스틱", "acoustic"])) {
    if (mainGenreParts.length) {
      pushUnique(genreInfluenceParts, "acoustic singer-songwriter influence");
    } else {
      pushUnique(mainGenreParts, "Korean soft pop", "singer-songwriter pop");
    }
    pushUnique(soundParts, "clean acoustic guitar", "soft pop drums", "intimate mix");
    pushUnique(arrangementParts, "gentle singer-songwriter progression");
  }

  // GENRE INFLUENCE / SUB COLOR: preserve the main genre while adding flavor.
  if (has(neoSoulKeywords)) {
    if (neoSoulInfluenceOfCityPop) {
      pushUnique(mainGenreParts, has80sEra ? "80s City Pop" : "City Pop");
      pushUnique(genreInfluenceParts, "Neo Soul influence");
    } else if (mainGenreParts.length) {
      pushUnique(genreInfluenceParts, "Neo Soul influence");
    } else {
      pushUnique(mainGenreParts, "Neo Soul / R&B");
    }
    pushUnique(soundParts, "smooth neo-soul chord color", "warm electric piano", "laid-back groove");
    pushUnique(moodParts, "mellow soulful atmosphere");
  }
  if (has(["재즈풍", "재즈 느낌", "jazz influence", "jazzy"])) {
    if (!mainGenreParts.includes("Jazz")) pushUnique(genreInfluenceParts, "Jazz influence");
    pushUnique(soundParts, "sophisticated jazz chord color", "soft swing nuance");
  }
  if (has(["소울", "soulful", "soul"]) && !has(neoSoulKeywords)) {
    pushUnique(genreInfluenceParts, "Soul influence");
    pushUnique(moodParts, "soulful emotional color");
  }
  if (hasRetro) {
    pushUnique(soundParts, "vintage 80s sheen", "retro analog warmth");
    pushUnique(moodParts, "retro nostalgia");
  }
  if (has(["오케스트라", "orchestra", "orchestral", "시네마틱", "cinematic"])) {
    pushUnique(genreInfluenceParts, "cinematic orchestral influence");
    pushUnique(soundParts, "cinematic orchestral layer");
    pushUnique(moodParts, "grand cinematic weight");
  }

  // SOUND / INSTRUMENT DETAIL
  if (has(["피아노", "piano"])) pushUnique(soundParts, "piano-led texture");
  if (has(["일렉피아노", "electric piano", "epiano", "e-piano"])) pushUnique(soundParts, "warm electric piano");
  if (has(["기타", "guitar"])) pushUnique(soundParts, "guitar texture");
  if (has(["신스", "synth", "synthesizer"])) pushUnique(soundParts, "synth layer");
  if (has(["베이스", "bass"])) pushUnique(soundParts, "focused bass groove");
  if (has(["드럼", "drum", "drums"])) pushUnique(soundParts, "drum groove");
  if (has(["해금", "haegeum"])) pushUnique(soundParts, "haegeum melodic color");
  if (has(["가야금", "gayageum"])) pushUnique(soundParts, "gayageum plucked texture");
  if (has(["대금", "daegeum"])) pushUnique(soundParts, "daegeum flute tone");
  if (has(["장구", "janggu"])) pushUnique(soundParts, "janggu percussion groove");
  if (has(["판소리", "pansori"])) {
    pushUnique(soundParts, "pansori-inspired tension");
    pushUnique(vocalParts, "Korean traditional vocal inflection");
  }

  // ARTIST REFERENCES: sanitizeUserInput() already turns names into traits.
  if (has(["clear and delicate female vocal", "맑고 섬세한 여성 보컬"])) {
    if (!mainGenreParts.length) pushUnique(mainGenreParts, "Korean soft pop");
    pushUnique(soundParts, "warm electric piano", "clean acoustic guitar", "soft pop drums", "intimate mix");
    pushUnique(moodParts, "bright", "delicate", "warm", "softly romantic");
    pushUnique(vocalParts, "clear and delicate female vocal", "intimate emotional delivery", "natural storytelling expression");
    pushUnique(arrangementParts, "gentle verse build-up", "soft chorus lift");
  }
  if (has(["clear and soulful female vocal", "dreamy and soulful female vocal", "몽환적이고 감각적인 여성 보컬"])) {
    if (!mainGenreParts.length) pushUnique(mainGenreParts, "Korean soft pop");
    pushUnique(genreInfluenceParts, "R&B influence");
    pushUnique(soundParts, "warm keys", "airy ambience", "intimate mix");
    pushUnique(moodParts, "dreamy", "soulful", "delicate");
    pushUnique(vocalParts, "soulful female vocal", "emotional breath control");
  }
  if (has(["palette", "팔레트"])) {
    if (!mainGenreParts.length) pushUnique(mainGenreParts, "Korean soft pop", "singer-songwriter pop");
    pushUnique(soundParts, "warm electric piano", "clean guitar", "soft pop groove", "intimate polished mix");
    pushUnique(moodParts, "bright", "warm", "ethereal", "delicate");
    pushUnique(arrangementParts, "gentle verse progression", "warm chorus lift", "intimate bridge development");
  }

  // MOOD / SCENE / ATMOSPHERE: keep this separate from THEME.
  if (has(["밤", "night", "midnight"])) pushUnique(moodParts, "night atmosphere");
  if (has(["새벽", "dawn", "late night"])) pushUnique(moodParts, "late-night intimate atmosphere");
  if (has(["가을", "autumn", "fall"])) pushUnique(moodParts, "autumn nostalgia");
  if (has(["여름", "summer"])) pushUnique(moodParts, "summer brightness");
  if (has(["겨울", "winter"])) pushUnique(moodParts, "winter loneliness");
  if (has(["봄", "spring"])) pushUnique(moodParts, "spring warmth");
  if (has(["시원", "청량", "refreshing", "cool breeze", "breezy"])) {
    pushUnique(moodParts, "refreshing breezy feel");
    pushUnique(soundParts, "airy mix", "cool spacious texture");
  }
  if (has(["몽환", "dreamy", "ethereal"])) pushUnique(moodParts, "dreamy ethereal atmosphere");
  if (has(["슬픈", "sad", "쓸쓸", "외로운", "lonely"])) pushUnique(moodParts, "sad restrained emotional color");
  if (has(["따뜻", "warm"])) pushUnique(moodParts, "warm emotional tone");
  if (has(["어두", "dark"])) pushUnique(moodParts, "dark atmosphere");
  if (has(["밝은", "bright"])) pushUnique(moodParts, "bright mood");
  if (has(["청춘", "youth"])) pushUnique(moodParts, "youthful emotional color");
  if (hasCalm) pushUnique(moodParts, "calm gentle mood");

  // THEME / STORY: people, relationship, event, narrative.
  if (has(["사랑", "love"])) pushUnique(themeParts, "romantic love story");
  if (has(["연인", "couple", "lover", "lovers"])) pushUnique(themeParts, "couple relationship");
  if (has(["이별", "breakup", "헤어", "그리움", "longing"])) pushUnique(themeParts, "breakup and longing");
  if (has(["비 오는", "비오는", "빗소리", "빗속", "장마", "rain", "rainy"])) pushUnique(themeParts, "rainy scene");
  if (has(["바다", "sea", "ocean"])) pushUnique(themeParts, "ocean imagery");
  if (has(["드라이브", "drive", "night drive"])) pushUnique(themeParts, "drive scene");
  if (has(["고백", "confession"])) pushUnique(themeParts, "tender confession");
  if (has(["성장", "growth", "coming of age"])) pushUnique(themeParts, "growth narrative");
  if (has(["추억", "memory", "memories"])) pushUnique(themeParts, "memory and nostalgia");
  if (has(["일상의 자유", "자유에 대한", "자유로운 일상", "자유", "freedom", "everyday freedom"])) {
    pushUnique(themeParts, "everyday freedom and self-expression");
  } else if (has(["일상에 관한", "일상적인", "일상 이야기", "일상", "everyday life", "daily life"])) {
    pushUnique(themeParts, "everyday life story");
  }
  if (has(["이순신", "명량", "명량해전", "해전", "전쟁", "장군", "역사", "historical", "battle", "naval battle"])) {
    pushUnique(themeParts, "historical heroic narrative", "naval battle drama");
    pushUnique(moodParts, "heroic tension", "grand cinematic weight");
    pushUnique(arrangementParts, "battle-like rise and fall", "dramatic narrative arc");
  }
  if (has(["드라마적인 서사", "드라마틱한 서사", "dramatic narrative", "cinematic narrative", "서사적"])) {
    pushUnique(themeParts, "dramatic narrative");
    pushUnique(arrangementParts, "cinematic story-driven progression");
  }

  // VOCAL / GENDER / PHRASING / LIMITS
  applyFreeTextVocalHints(lower, vocalParts);

  const femaleLikeVoice = has([
    "여자 같은 보이스", "여자같은 보이스", "여자 같은 목소리", "여자같은 목소리",
    "여성 같은 보이스", "여성같은 보이스", "여성 같은 목소리", "여성같은 목소리",
    "female-like voice", "feminine voice color"
  ]);

  const maleLikeVoice = has([
    "남자 같은 보이스", "남자같은 보이스", "남자 같은 목소리", "남자같은 목소리",
    "남성 같은 보이스", "남성같은 보이스", "남성 같은 목소리", "남성같은 목소리",
    "male-like voice", "masculine voice color"
  ]);

  const koreanCountToEnglish = (value: string): string => {
    const normalized = value.trim();
    const map: Record<string, string> = { "1": "one", "한": "one", "하나": "one", "2": "two", "두": "two", "둘": "two", "3": "three", "세": "three", "셋": "three", "4": "four", "네": "four", "넷": "four", "5": "five", "다섯": "five" };
    return map[normalized] || normalized;
  };

  const femaleIdolCountMatch = rawNote.match(/(?:여자|여성)\s*아이돌\s*([0-9]+|한|하나|두|둘|세|셋|네|넷|다섯)\s*명?/i);
  const maleIdolCountMatch = rawNote.match(/(?:남자|남성)\s*아이돌\s*([0-9]+|한|하나|두|둘|세|셋|네|넷|다섯)\s*명?/i);

  if (femaleIdolCountMatch) {
    const count = koreanCountToEnglish(femaleIdolCountMatch[1]);
    pushUnique(vocalParts, `${count} female idol vocalists`, "female vocal direction");
    if (!mainGenreParts.length) pushUnique(mainGenreParts, has(synthPopKeywords) ? "Synth Pop / Idol Pop" : "Idol Pop");
    pushUnique(arrangementParts, "member-by-member vocal part contrast");
  }

  if (maleIdolCountMatch) {
    const count = koreanCountToEnglish(maleIdolCountMatch[1]);
    pushUnique(vocalParts, `${count} male idol vocalists`, "male vocal direction");
    if (!mainGenreParts.length) pushUnique(mainGenreParts, has(synthPopKeywords) ? "Synth Pop / Idol Pop" : "Idol Pop");
    pushUnique(arrangementParts, "member-by-member vocal part contrast");
  }

  if (has(["각자 다른 보이스", "각자 다른 목소리", "각기 다른 보이스", "각기 다른 목소리", "서로 다른 보이스", "서로 다른 목소리", "다른 독특한 보이스", "다른 독특한 목소리", "different voices", "distinct voices", "different vocal colors"])) {
    pushUnique(vocalParts, "distinct vocal colors", "different vocal characters", "characterful delivery");
    pushUnique(arrangementParts, "shifting vocal parts between members");
  }

  const wantsFemaleVocal =
    !femaleLikeVoice && (
      has([
        "여자가수", "여성가수",
        "여자 보컬", "여성 보컬", "여자보컬", "여성보컬",
        "여자 목소리", "여성 목소리", "여자목소리", "여성목소리",
        "여자 보이스", "여성 보이스", "여자보이스", "여성보이스"
      ]) ||
      /\b(female|woman|girl)\s+(vocal|vocalist|singer|voice)\b/.test(lower)
    );

  const wantsMaleVocal =
    !maleLikeVoice && (
      has([
        "남자가수", "남성가수",
        "남자 보컬", "남성 보컬", "남자보컬", "남성보컬",
        "남자 목소리", "남성 목소리", "남자목소리", "남성목소리",
        "남자 보이스", "남성 보이스", "남자보이스", "남성보이스"
      ]) ||
      /\b(male|man|boy)\s+(vocal|vocalist|singer|voice)\b/.test(lower)
    );

  if (has(["굵고 깊", "굵은", "깊은", "저음", "deep male", "deep vocal", "low male"])) {
    pushUnique(vocalParts, "deep resonant male vocal tone", "rich low vocal color");
  }
  if (has(["엇박자", "엇박", "박자를 밀고", "밀고 당기는", "syncopated", "offbeat"])) {
    pushUnique(vocalParts, "offbeat vocal phrasing", "syncopated delivery", "distinctive timing");
  }
  if (has(["고음자제", "고음 자제", "고음금지", "고음 금지", "고음방지", "고음 방지", "고음 피", "높은 음 피", "샤우팅 금지", "소리 지르지", "avoid high", "no high note", "no belting"])) {
    pushUnique(vocalParts, "restrained high notes", "controlled vocal range", "avoid belting");
    pushUnique(constraintParts, "avoid excessive high notes");
  }
  if (has(["과한 애드리브 금지", "애드리브 자제", "ad-lib restraint"])) {
    pushUnique(vocalParts, "restrained ad-libs");
    pushUnique(constraintParts, "avoid excessive ad-libs");
  }

  if (wantsFemaleVocal && !wantsMaleVocal) {
    pushUnique(vocalParts, "female vocal direction");
  } else if (wantsMaleVocal && !wantsFemaleVocal) {
    pushUnique(vocalParts, "male vocal direction");
  } else if (wantsFemaleVocal && wantsMaleVocal) {
    pushUnique(vocalParts, "mixed male and female vocal direction");
  }

  if (has(["솔로", "solo"])) pushUnique(vocalParts, "solo vocal focus");
  if (has(["듀엣", "duet"])) pushUnique(vocalParts, "duet-style vocal interaction");
  if (has(["랩 없이", "랩없", "no rap", "without rap"])) {
    pushUnique(vocalParts, "no rap, vocal-only delivery");
    pushUnique(constraintParts, "no rap section");
  } else if (has(["묵직한 랩", "무거운 랩", "굵은 랩", "딥한 랩", "heavy rap", "deep rap", "weighty rap"])) {
    pushUnique(vocalParts, "heavy rap section", "deep rhythmic rap delivery");
    pushUnique(arrangementParts, "heavy rap section with strong rhythmic impact");
  } else if (has(["랩", "rap"])) {
    pushUnique(vocalParts, "rap section");
    pushUnique(arrangementParts, "dedicated rap section");
  }

  // ARRANGEMENT / TEMPO / HOOK / STRUCTURE
  if (hasSlowTempo) pushUnique(arrangementParts, "slow tempo feel");
  if (hasFastTempo) pushUnique(arrangementParts, "fast tempo feel");
  if (hasMidTempo) pushUnique(arrangementParts, "mid-tempo feel");
  if (has(["짧게", "짧은 곡", "short song", "short lyrics"])) pushUnique(arrangementParts, "compact song structure", "concise lyric flow");
  if (has(["길게", "긴 곡", "long song", "long lyrics"])) pushUnique(arrangementParts, "expanded song structure", "fuller lyric development");
  if (has(["중독성있는 후렴", "중독성 있는 후렴", "중독성 후렴", "귀에 남는 후렴", "후렴구", "훅", "hook", "catchy chorus", "addictive chorus"])) {
    pushUnique(arrangementParts, "addictive chorus hook", "memorable refrain", "catchy melodic phrase");
  }
  if (has(["폭발적인 후렴", "터지는 후렴", "explosive chorus"])) {
    pushUnique(arrangementParts, "explosive chorus lift");
  }
  if (has(["변화무쌍한 구조", "변화무쌍", "dynamic structure", "unpredictable structure", "구조 변화", "전개가 바뀌"])) {
    pushUnique(arrangementParts, "unpredictable dynamic structure", "strong sectional contrast");
  }
  if (has(["드롭", "drop"])) pushUnique(arrangementParts, "strong drop section");
  if (has(["브릿지", "bridge"])) pushUnique(arrangementParts, "distinct bridge section");

  // NEGATIVE / CONSTRAINT: fold into relevant sections so it stays visible without extra DETAIL LAYER.
  if (has(["너무 밝지", "과하게 밝", "not too bright"])) {
    pushUnique(moodParts, "not overly bright, restrained emotional color");
  }
  if (has(["발라드처럼 가지 않", "발라드로 가지 않", "not ballad"])) {
    pushUnique(constraintParts, "do not turn into a ballad");
  }

  // Remove contradictory vocal hints after constraints.
  if (constraintParts.includes("avoid excessive high notes")) {
    const highNoteTerms = new Set(["open bright high notes", "powerful vocal delivery", "intense belted emotional delivery"]);
    for (let i = vocalParts.length - 1; i >= 0; i--) {
      if (highNoteTerms.has(vocalParts[i])) vocalParts.splice(i, 1);
    }
  }

  // Keep explicit vocal gender visible even when many vocal traits are detected.
  // Example: "여자보이스 + 유니크한 목소리 + 엇박자 + 고음방지" can create many VOCAL tokens,
  // so gender direction must be prioritized instead of being clipped by the output limit.
  const prioritizeVocalGender = () => {
    const genderTerms = [
      "female vocal direction",
      "male vocal direction",
      "mixed male and female vocal direction",
    ];
    const found = genderTerms.filter((term) => vocalParts.includes(term));
    if (!found.length) return;
    const rest = vocalParts.filter((term) => !genderTerms.includes(term));
    vocalParts.splice(0, vocalParts.length, ...found, ...rest);
  };

  prioritizeVocalGender();

  const mainGenre = mainGenreParts.length ? mainGenreParts[0] : "Contemporary Pop";
  const extraMainGenres = mainGenreParts.slice(1);
  const influenceText = [...extraMainGenres, ...genreInfluenceParts].slice(0, 3).join(" with ");
  const tempoPart = arrangementParts.find((part) => part.includes("tempo"));
  const genre = [mainGenre, influenceText ? `with ${influenceText}` : "", tempoPart && !mainGenre.toLowerCase().includes("slow") ? tempoPart : ""]
    .filter(Boolean)
    .join(", ");

  const limit = (values: string[], max: number) => values.slice(0, max).join(", ");

  return {
    genre,
    sound: soundParts.length ? limit(soundParts, 6) : "clean focused production, balanced instrumental palette",
    mood: moodParts.length ? limit(moodParts, 5) : "balanced emotional tone",
    vocal: vocalParts.length ? limit(vocalParts, 8) : "natural genre-appropriate vocal tone",
    arrangement: arrangementParts.length ? limit(arrangementParts, 6) : "clear sectional contrast matching the free-text direction",
    theme: themeParts.length ? limit(themeParts, 4) : DEFAULT_NO_THEME_DIRECTION,
    detail: rawNote,
  };
}
function buildFreeTextPrimarySections(detailLayer: string) {
  const profile = buildFreeTextDirectorProfile(detailLayer);

  return [
    { label: "GENRE", content: profile.genre },
    { label: "SOUND", content: profile.sound },
    { label: "MOOD", content: profile.mood },
    { label: "VOCAL", content: profile.vocal },
    { label: "ARRANGEMENT", content: profile.arrangement },
    { label: "THEME", content: profile.theme },
  ];
}

function buildFinalPrompt(params: GenerateSongParams, resolvedStructure: SongStructure, detailLayer: string): string {
  const themeContent = buildTheme(params);
  const sections = isFreeTextPrimaryMode(params)
    ? buildFreeTextPrimarySections(detailLayer)
    : [
        { label: "GENRE", content: buildStyle(params) },
        { label: "SOUND", content: buildSound(params) },
        { label: "MOOD", content: buildMoodTexture(params) },
        { label: "VOCAL", content: buildVocal(params) },
        { label: "ARRANGEMENT", content: buildArrangement(params, resolvedStructure) },
        ...(themeContent ? [{ label: "THEME", content: themeContent }] : []),
        ...(detailLayer ? [{ label: "DETAIL LAYER", content: detailLayer }] : []),
      ];

  return sections
    .map(s => {
      const value = s.content.replace(new RegExp(`^${s.label}:\\s*`, "i"), "").trim();
      return `·${s.label}: ${value}`;
    })
    .join("\n\n");
}


export async function generateSong(...args: GenerateSongInput): Promise<SongResult> {
  const params = normalizeArgs(args);
  const requestedLyricLanguages = Array.from(new Set((params.lyricLanguages?.length ? params.lyricLanguages : ['ko', 'en']).filter(Boolean))).slice(0, 2) as LanguageCode[];
  const effectiveNoLyrics = Boolean(params.isNoLyrics || params.includeLyrics === false || requestedLyricLanguages.length === 0);
  params.isNoLyrics = effectiveNoLyrics;
  params.lyricLanguages = requestedLyricLanguages;
  const model: string = "gemini-3-flash-preview";

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
  const selectedGenreIdentity = [
    params.genre ? (genreMeta?.label ?? sentenceCase(params.genre)) : "",
    ...getSubGenreLabels(params.subGenre ?? []),
  ]
    .filter(NON_EMPTY)
    .join(" / ") || "No explicit genre selected";
  const instrumentSoundPromptCores = getInstrumentSoundPromptCores(params.instrumentSounds ?? []);
  const themePrompt = buildThemePrompt(params.themes ?? []);
  const themeSentence = buildThemeSentence(params.themes ?? []);
  const vocalPrompt = buildVocalPrompt(
    params.vocal ?? { male: 0, female: 0, rap: false },
    params.subGenre ?? []
  );
  const basePromptSeed = BASE_PROMPTS.join("\n");
  
  // Build Detail Layer (Summarized English Prompt)
  const detailLayer = await buildDetailLayer(params.userInput || "");
  
  const finalPrompt = buildFinalPrompt(params, resolvedStructure, detailLayer);
  console.log("🔥 generateSong called");
  console.log("🔥 FINAL PROMPT:", finalPrompt);
  const exactStructureText = buildStructureText(
    params.songStructure,
    resolvedStructure,
    params.customStructure ?? []
  );

  const shouldUseMixedLyrics = Boolean(params.isKoreanEnglishMix || (params.isKpopSelected && params.kpopMode === 2));


  const languageNameMap: Record<LanguageCode, string> = {
    ko: 'Korean',
    en: 'English',
    ja: 'Japanese',
    zh: 'Chinese',
    es: 'Spanish',
    fr: 'French',
  };
  const secondaryLanguage = requestedLyricLanguages.find((lang) => lang !== 'ko') || 'en';
  const requestedLanguageInstruction = effectiveNoLyrics
    ? ''
    : `OUTPUT LANGUAGE RULE (MANDATORY):
- Generate titles and lyrics only for the selected language setting: ${requestedLyricLanguages.map((lang) => languageNameMap[lang]).join(' + ')}.
- If Korean is selected, put Korean lyrics in JSON field lyrics.korean and create a natural Korean title.
- If a non-Korean language is selected, put that language's lyrics in JSON field lyrics.english, even when the selected language is not English.
- The first title slot before │ must be the non-Korean selected language title (${languageNameMap[secondaryLanguage]}). The second title slot after │ must be Korean when Korean is selected.
- If only Korean is selected, still return a compact compatible second title, but keep Korean as the main title.
- Do not generate unselected lyric languages.`;

  const lyricsResponseSchema = params.isNoLyrics 
    ? {} 
    : {
        lyrics: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            korean: { type: Type.STRING },
          },
          required: ["english", "korean"],
        },
      };

  const lyricsRequired = params.isNoLyrics ? [] : ["lyrics"];

  const mixedLyricsInstruction = (shouldUseMixedLyrics && !params.isNoLyrics)
    ? `MIXED LANGUAGE MODE (MANDATORY):
- Use natural Korean/English mixed lyrics.
- Ratio: about 70-75% primary language flow and 25-30% mixed-language accents.
- For lyrics.korean: keep Korean as the main language, but include natural English words or short phrases in MULTIPLE sections.
- For lyrics.english: keep English as the main language, but include natural Korean words or short phrases in MULTIPLE sections.
- The chorus or hook MUST contain visible code-switching.
- Do not keep the two versions fully separated by language.
- Keep the code-switching natural and melodic, not forced.`
    : "";
  
  const lyricDraftInstruction = (params.isLyricMode && params.lyricDraft)
    ? (params.lyricMode === 'preserve' 
      ? `LYRIC PRESERVE MODE (PRIMARY SOURCE):
- The user provided finished lyrics or draft lyrics below:
"${params.lyricDraft}"

- Preserve the user's wording, expressions, imagery, line flow, and emotional tone as much as possible.
- Do NOT add new story elements, unrelated metaphors, or new narrative directions.
- Do NOT rewrite the lyrics into a different theme.
- Only:
  - improve minor awkward line breaks if necessary
  - split into song sections if needed
  - repeat existing hook lines only when needed
- The user's original wording must remain the main body of the lyrics.
- Reorganize into the selected song structure automatically.`
      : `LYRIC DRAFT PRIORITY (PRIMARY SOURCE):
- The user provided original lyric ideas below:
"${params.lyricDraft}"

- Preserve the user's wording, imagery, emotional tone, and key phrases as much as possible.
- Do NOT discard or replace the user's core lyrical ideas.
- Expand naturally only where needed to fit the structure and length.
- Reorganize into the selected song structure automatically.
- Keep it natural and polished.`)
    : "";

  const structureInstruction =
    params.songStructure === "custom" && (params.customStructure ?? []).length > 0
      ? `SONG STRUCTURE (MANDATORY):
- Selected mode: Custom.
- Use this exact section order without omission or replacement:
${exactStructureText}
- Each tag in parentheses is a real arrangement instruction. Apply it musically, not just as a label.
- Special Sections Guide (if used):
  - Theme A/B: Distinct melodic themes or motifs.
  - Build-up: A section focused on rising tension and energy leading to a main theme or climax.
  - Main Theme: The core melodic or rhythmic identity of the song.
  - Climax: The highest point of energy and emotional intensity.
- Do not collapse this into a generic pop structure.`
      : `SONG STRUCTURE (MANDATORY):
- Selected mode: ${resolvedStructure}.
- Use this exact structure:
${exactStructureText}
- Do not substitute a different default structure.`;

  const systemInstruction = `
You are a professional music composer and lyricist.

USER FREE-TEXT DIRECTOR NOTE (HIGH PRIORITY):
${detailLayer || "No extra user description."}

ROLE OF USER INPUT:
- The user input is a free-text director note for users who prefer describing the whole song in words instead of selecting buttons.
- It CAN define or influence genre, style, tempo feel, song length feel, vocal direction, rap direction, arrangement, structure density, theme, scene, season, relationship, mood, sound palette, and lyrical direction.
- If no explicit genre is selected in the UI, infer the main genre directly from this note and treat it as the primary genre identity.
- If explicit UI selections exist, combine them with the note. When they conflict, prefer the user's clearly written natural-language direction unless a custom song structure is explicitly selected.
- If the user mentions a song length, slow/fast tempo, short/long lyrics, verse/chorus/bridge, rap/no rap, or vocal formation, reflect that in the final song direction.
- If custom song structure mode is selected, keep the custom section order fixed, but still apply the note to mood, sound, theme, vocal expression, and section energy.

GENRE COHERENCE RULE (MANDATORY):
- The final song must still be coherent as one concept, not a loose list of tags.
- When the note defines a genre, use that genre as the core blueprint.
- When the note contains multiple influences, blend them into one clear production identity.
- Do NOT turn mood into a different genre unless the free-text note clearly asks for that genre.
- Do NOT ignore explicit free-text words such as city pop, Korean traditional fusion, slow tempo, autumn, night, love, couple, historical battle, refreshing feel, rap, no rap, short song, long song, or female/male vocal.

THEME SEPARATION RULE (MANDATORY):
- Theme means the lyrical story, situation, message, relationship, event, or narrative.
- Mood, genre, vocal technique, sound, tempo, hook, and arrangement instructions are NOT story themes.
- If no explicit theme is selected or written, create a simple original everyday emotional scene.
- Do NOT turn technical instructions such as offbeat vocal phrasing, addictive chorus, restrained high notes, slow tempo, synth, guitar, or genre names into the title or lyrical topic.
- If a theme exists, keep mood as emotional color around that story, not as a replacement story.

${TECHNICAL_DIRECTION_LYRICS_GUARD}

IMPORTANT:
- Do NOT use real artist names in the output. Generalize them into vocal characteristics.
- Do NOT simplify, generalize, or replace the selected arrangement with a default pop form.
- Treat the final production prompt below as a locked blueprint, not a loose reference.
- Resolve conflicts by priority: custom song structure if selected, then USER FREE-TEXT DIRECTOR NOTE, then explicit UI selections, while keeping one coherent song concept.
- Keep the final result musically coherent as one song concept, not a loose list of tags.

ROOT GENRE:
${genrePromptCore || (detailLayer ? "Infer the root genre from the USER FREE-TEXT DIRECTOR NOTE." : "Choose an appropriate mainstream-friendly root genre if none is given.")}

INSTRUMENT / SOUND LAYERS:
${instrumentSoundPromptCores.length ? instrumentSoundPromptCores.map((s) => `- ${s}`).join("\n") : "- No extra instrument/sound layer selected."}

MOOD LAYER (EMOTIONAL COLOR ONLY):
${(params.moods ?? []).join(", ") || "No explicit mood layer selected."}

${(params.themes ?? []).length > 0 ? `THEME / STORY CONCEPT (SITUATION, MESSAGE, OR NARRATIVE):
${themePrompt}
Expanded story direction: ${themeSentence}` : ""}

LOCKED FINAL PRODUCTION PROMPT:
${finalPrompt}

VOCAL DIRECTION (HIGH PRIORITY):
${vocalPrompt}

REFERENCE PRINCIPLES:
${basePromptSeed}

${mixedLyricsInstruction}

${lyricDraftInstruction}

${structureInstruction}

${requestedLanguageInstruction}

Return JSON:
{
  "title": "'English Title' │ 'Korean Title'"${params.isNoLyrics ? "" : `,
  "lyrics": { "english": "Full English lyrics.", "korean": "Full Korean lyrics." }`}
}

TITLE RULES (CRITICAL):


- Generate ONE English title and ONE Korean title as a pair.
- They MUST be independent titles, NOT direct translations of each other.
- They should share the same vibe, theme, and genre of the song.
- Avoid feeling like a literal translation; they should sound natural in their respective languages.
- Tone should match (e.g., both sophisticated, both playful, both dark).
- The title must contain ONLY the song title itself.
- DO NOT include genre, style, production terms, era, nationality, or descriptors.
- DO NOT include words taken from STYLE such as: "Traditional Korean Fusion", "Gugak-pop", "New Jack Swing", "City Pop", "K-pop", "J-pop", "ballad pacing", "global pop approach", etc.
- DO NOT include words taken from STYLE such as: "K-pop", "City Pop", etc.
- The genre label will be attached later by the app, so return the title body only.
- Format: 'English Title' │ 'Korean Title'
- Do NOT use technical direction words as the title concept unless the user explicitly made them the story theme.
- Examples of forbidden title concepts when they are only instructions: offbeat, half-beat, slow tempo, hook, vocal tone, high-note restraint, 엇박자, 느린템포, 고음자제, 중독성 후렴, 보컬톤.


[REALISTIC TITLE RULES]
- The title must feel like a real phrase, not a keyword combination.
- Avoid cliché poetic titles (echo, warmth, shadow, etc. combinations).
- Prefer:
  - a line from the song
  - a specific moment
  - a phrase that sounds like something someone would actually say
- Avoid stacking abstract emotional nouns.
- Natural phrasing is more important than poetic wording.


[HIT TITLE RULES]

- Titles should be short, memorable, and easy to say.
- Prefer 2–5 words for English titles.
- Prefer 3–10 syllables for Korean titles.
- The title should feel like something someone would actually say or remember.
- Avoid complex or overly poetic phrasing.

---

[TITLE STYLE]

Prefer titles that:
- sound like a real sentence fragment
- feel like a moment or a thought
- could be used in conversation

Examples:
- "Stayed a Little Longer"
- "We Didn’t Say Goodbye"
- "Call Me Back"
- "I Thought You Knew"

Korean examples:
- "조금 더 있다가 가"
- "말 안 해도 알 줄 알았어"
- "그날 이후로"
- "아직 그대로야"

---

[AVOID THESE PATTERNS]

- Avoid abstract noun stacking:
  (e.g. "Echo of Warmth", "Shadow of Memory")

- Avoid single vague poetic words:
  (e.g. "Velvet", "Echo", "Warmth")

- Avoid titles that sound like generated keywords.

---

[STRUCTURE VARIATION]

- Titles can be:
  - a short sentence
  - a phrase
  - a question
  - a line someone might say

---

[FINAL CHECK]

- If the title sounds like a real song name someone would remember → OK
- If it sounds like AI-generated poetry → rewrite

[KOREAN TITLE STYLE]

- Korean titles should feel like natural spoken phrases.
- Prefer everyday language over poetic wording.
- Avoid overly literary or abstract expressions.
- Titles should sound like something someone might actually say.

Examples:
- "조금만 더 있다가 가"
- "그때 말 안 했잖아"
- "아직 그대로야"
- "오늘은 그냥 가"

[KOREAN NUANCE TITLE RULES]

- Korean titles should NOT feel like fully completed sentences.
- Avoid combining two complete phrases into one title.
- Prefer slightly incomplete, open-ended expressions.

- Good titles often feel like:
  - something left unsaid
  - a thought that trails off
  - a phrase that implies more context

- It is often better to remove one part of a sentence than to keep everything.

---

[NUANCE CONTROL]

- If a title feels too complete, shorten it.
- Reduce unnecessary words.
- Avoid "A + B" combined sentence structures.

Examples:

Too complete:
- 오늘따라 운이 좋았어
→ Better:
- 오늘따라
- 운이 좋았던 날

Too combined:
- 아직 여길 못 떠나
→ Better:
- 아직 여길
- 못 떠나서

Too explanatory:
- 그냥 늘 있던 곳에
→ Better:
- 늘 있던 곳에
- 그냥 거기

Natural:
- 비어있는 옆자리 (OK)
- 그날 이후로 (GOOD)
- 아직 그대로야 (GOOD)

${params.isNoLyrics ? "LYRICS RULE (MANDATORY):\n- DO NOT generate any lyrics. The user requested an instrumental-only track or a track without lyrics.\n- Omit the 'lyrics' field from the JSON output." : `Lyrics rules:
${lyricGuidancePrompt}

[LYRIC STYLE SYSTEM]

Write lyrics that feel like they were written by a real person, not an AI.

[CORE RULES]
- Do NOT write like a poem generator.
- Avoid overused abstract words unless absolutely necessary.
- Do NOT stack emotional nouns (e.g. echo, warmth, shadow, light, darkness).
- Keywords (theme, mood) must NOT be directly repeated as words.

[WRITING STYLE]
- Focus on specific moments, not general emotions.
- Show feelings through actions and scenes.
- Use small, relatable details (places, objects, time, gestures).
- Write like someone recalling a memory, not describing a concept.
- Slight imperfection is okay — natural > perfect.

[LANGUAGE STYLE]
- Use natural, conversational phrasing.
- Avoid overly dramatic or artificial expressions.
- Mix short and long lines naturally.
- Do NOT repeat the same structure every line.

[EMOTION EXPRESSION]
Instead of:
"I feel lonely in the darkness"
Write like:
"The streetlight stayed on longer than usual, and I didn’t go home"

[KEYWORD USAGE RULE]
- Theme and mood should guide the situation, not appear as direct words.
- If a keyword-like word is used, use it only once and naturally.
- Never build the whole lyric around a single abstract word.

[TECHNICAL INSTRUCTION LEAKAGE GUARD]
- Do NOT write lyrics or titles about performance/production instructions.
- Do NOT use “엇박자”, “느린템포”, “슬로우 모션”, “고음자제”, “중독성 후렴”, “여자보이스”, “독특한 목소리”, or similar instruction words as lyric phrases unless the user explicitly made them the story topic.
- If the prompt contains offbeat/syncopated vocal phrasing, realize it through rhythm and delivery only.
- If the prompt contains slow tempo, realize it through pacing and arrangement only; do not write “slow motion” or “slow tempo” as a lyric image.
- If the prompt contains addictive chorus/hook, make the chorus memorable without literally singing about hooks or choruses.
- If the prompt contains vocal gender/tone/limits, apply them to singer direction only.

- If lyricDraft exists, it must be treated as the primary lyrical source.
- The generated lyrics should preserve the user’s draft as much as possible.
- Only expand, refine, and restructure where necessary.
- Do not ignore lyricDraft.
- Do not rewrite it with a completely new lyric idea.
- The lyrics should follow the selected theme(s) and explicit narrative details provided by the user.
- If no explicit theme exists, create a simple original everyday emotional scene without using genre, vocal, sound, tempo, hook, or arrangement instructions as the lyrical topic.
- Themes define the situation, message, scene, or story.
- Moods define only the emotional tone or feeling around that story.
- The lyrics must clearly reflect the exact arrangement and section order provided above.
- If a section has tags such as Rap, Group, Minimal, Build-up, Instrumental, Soft, Big, or Adlib, the writing should support that musical role.
- Respect the selected lyricsLength strictly.
- Respect the selected song structure strictly.
- Do not drift longer than the requested lyric size.
- Do not invent a new structure that conflicts with the locked blueprint.`}
${params.specialPrompt ? `- SPECIAL INSTRUCTION: ${params.specialPrompt}` : ""}
`.trim();

  const ai = getAI();
  let response;
  
  const generateParams = {
    model,
    contents: "Generate the song title and lyrics based on the locked instructions.",
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          ...lyricsResponseSchema,
        },
        required: ["title", ...lyricsRequired],
      },
    },
  };

  try {
    response = await ai.models.generateContent(generateParams);
  } catch (error) {
    const errorStr = JSON.stringify(error);
    const isQuotaError = 
      error?.status === "RESOURCE_EXHAUSTED" || 
      error?.code === 429 || 
      error?.error?.code === 429 ||
      error?.error?.status === "RESOURCE_EXHAUSTED" ||
      errorStr.includes("RESOURCE_EXHAUSTED") || 
      errorStr.includes("quota") ||
      errorStr.includes("429");

    // If quota exhausted on primary model, try fallback model
    if (isQuotaError && model !== "gemini-2.5-flash-lite") {
      console.warn("Primary model quota exhausted, trying fallback model (gemini-2.5-flash-lite)...");
      try {
        response = await ai.models.generateContent({
          ...generateParams,
          model: "gemini-2.5-flash-lite"
        });
      } catch (fallbackError) {
        handleGeminiError(fallbackError, "generateSong (fallback)");
      }
    } else {
      handleGeminiError(error, "generateSong");
    }
  }

  const result = JSON.parse(response.text || "{}");

  // Title Post-processing
  const subGenreIds = (params.subGenre ?? []).map(id => id.toLowerCase());
  const genreId = (params.genre || "").toLowerCase();
  
  let genreTag = "";
  const keywordsToRemove = new Set([
    "k-pop", "kpop", "j-pop", "jpop", "hip hop", "hiphop", "r&b", "rnb", "edm", "pop", "rock", "jazz", "ballad", "trot", "dance", "synth", "indie", "folk", "metal", "drill", "trap", "lo-fi", "lofi", "g-funk", "gfunk",
    "traditional korean fusion", "gugak-pop", "new jack swing", "city pop", "ballad pacing", "global pop approach", "korean idol production style", "japanese style", "fusion", "style", "production", "groove", "pacing"
  ]);

  const addVariations = (label: string) => {
    if (!label) return;
    const l = label.toLowerCase();
    keywordsToRemove.add(l);
    
    const prefixes = [
      "k ", "j ", "k-", "j-", "90s ", "80s ", "70s ", "modern ", "korean ", "japanese ", 
      "retro ", "classic ", "neo ", "new ", "old school ", "old-school ", "style ", "production ",
      "korean idol production style ", "japanese idol production style ", "idol production style "
    ];
    prefixes.forEach(p => {
      keywordsToRemove.add((p + l).toLowerCase());
    });
    
    const parts = l.split(/\s+/);
    if (parts.length > 1) {
      parts.forEach(part => {
        if (part.length > 2) keywordsToRemove.add(part);
      });
    }
  };

  if (subGenreIds.length > 0) {
    const subGenreMeta = GENRES.find(g => g.id === subGenreIds[0]);
    genreTag = subGenreMeta?.label ?? sentenceCase(subGenreIds[0]);
    if (subGenreMeta) {
      addVariations(subGenreMeta.label);
      if (subGenreMeta.labelKo) keywordsToRemove.add(subGenreMeta.labelKo.toLowerCase());
    }
  } else if (genreId) {
    const genreMeta = GENRES.find(g => g.id === genreId);
    genreTag = genreMeta?.label ?? sentenceCase(genreId);
    if (genreMeta) {
      addVariations(genreMeta.label);
      if (genreMeta.labelKo) keywordsToRemove.add(genreMeta.labelKo.toLowerCase());
    }
  } else {
    const freeTextForTitle = typeof params.userInput === "string" ? params.userInput.trim() : "";
    if (freeTextForTitle) {
      const profile = buildFreeTextDirectorProfile(sanitizeUserInput(freeTextForTitle));
      const inferredGenre = (profile.genre || "")
        .replace(/,\s*(slow|fast|mid)-?tempo feel/gi, "")
        .split(" with " )[0]
        .split(",")[0]
        .trim();
      genreTag = inferredGenre && !/free-text direction|contemporary pop/i.test(inferredGenre) ? inferredGenre : "Song";
    } else {
      genreTag = "Song";
    }
  }
  
  addVariations(genreTag);

  if (typeof result.title === "string") {
    let rawTitle = result.title.trim();
    
    // 1. Remove any existing [Genre] tag from the AI
    rawTitle = rawTitle.replace(/^\[[^\]]+\]\s*/, "");
    
    // 2. Try to extract quoted pair: 'Eng' │ 'Kor' or "Eng" │ "Kor"
    const quotePairRegex = /['"]([^'"]+)['"]\s*│\s*['"]([^'"]+)['"]/;
    const match = rawTitle.match(quotePairRegex);
    
    if (match) {
      const engTitle = match[1].trim();
      const korTitle = match[2].trim();
      result.englishTitle = engTitle;
      result.koreanTitle = korTitle;
      result.title = `[${genreTag}] '${engTitle}' │ '${korTitle}'`;
    } else {
      // 3. Fallback: Aggressive cleaning
      let title = rawTitle;
      let changed = true;
      while (changed) {
        changed = false;
        const sortedKeywords = Array.from(keywordsToRemove)
          .filter(Boolean)
          .map(kw => kw.trim())
          .filter(kw => kw.length > 0)
          .sort((a, b) => b.length - a.length);

        for (const kw of sortedKeywords) {
          const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`^${escapedKw}(?=[\\s'\"│\\-\\:]|$)\\s*[\\-\\s\\:]*`, "i");
          if (regex.test(title)) {
            title = title.replace(regex, "").trim();
            changed = true;
            break;
          }
        }
      }
      
      // 4. Ensure it has a │ and is quoted
      if (title.includes("│")) {
        const parts = title.split("│").map(p => p.trim().replace(/^['"]+|['"]+$/g, ""));
        const eng = parts[0] || "Untitled";
        const kor = parts[1] || "무제";
        result.englishTitle = eng;
        result.koreanTitle = kor;
        result.title = `[${genreTag}] '${eng}' │ '${kor}'`;
      } else {
        const cleanTitle = title.replace(/^['"]+|['"]+$/g, "");
        result.englishTitle = cleanTitle || 'Untitled';
        result.koreanTitle = cleanTitle || '무제';
        result.title = `[${genreTag}] '${cleanTitle || 'Untitled'}'`;
      }
    }
  } else {
    result.englishTitle = 'Untitled';
    result.koreanTitle = '무제';
    result.title = `[${genreTag}] 'Untitled' │ '무제'`;
  }

  // Ensure lyrics object and properties exist
  if (!result.lyrics || typeof result.lyrics !== 'object') {
    result.lyrics = { english: "", korean: "" };
  } else {
    result.lyrics.english = typeof result.lyrics.english === 'string' ? result.lyrics.english : "";
    result.lyrics.korean = typeof result.lyrics.korean === 'string' ? result.lyrics.korean : "";
  }

  if (params.isNoLyrics) {
    result.lyrics = { english: '', korean: '' };
  } else {
    if (!requestedLyricLanguages.includes('ko')) result.lyrics.korean = '';
    if (!requestedLyricLanguages.some((lang) => lang !== 'ko')) result.lyrics.english = '';
  }

  if (shouldUseMixedLyrics && !params.isNoLyrics) {
    result.lyrics = enforceKpopMixedLyrics(result.lyrics);
  }

  result.prompt = finalPrompt;
  result.appliedKeywords = {
    ...buildAppliedKeywordPayload(params, resolvedStructure),
    genre: params.genre ? [params.genre] : [],
    subGenre: params.subGenre ?? [],
    mood: params.moods ?? [],
    theme: params.themes ?? [],
    style: params.styles ?? [],
    instrumentSound: params.instrumentSounds ?? [],
    tempo: params.tempo,
    kpopMode: params.kpopMode ?? 0,
    lyricLanguages: requestedLyricLanguages as any,
    isNoLyrics: params.isNoLyrics as any,
  } as any;

  return result as SongResult;
}

export async function translateLyrics(
  lyrics: string,
  targetLanguage: "korean" | "english"
): Promise<string> {
  const model: string = "gemini-3-flash-preview";

  const systemInstruction = `
You are a professional lyricist and translator.
Translate the provided lyrics into ${targetLanguage}.
- Maintain the original structure and line breaks.
- Do not translate literally. Keep it natural and lyrical.
- Return only the translated lyrics text.
`.trim();

  const ai = getAI();
  let response;
  
  const generateParams = {
    model,
    contents: lyrics,
    config: { systemInstruction },
  };

  try {
    response = await ai.models.generateContent(generateParams);
  } catch (error) {
    const errorStr = JSON.stringify(error);
    const isQuotaError = 
      error?.status === "RESOURCE_EXHAUSTED" || 
      error?.code === 429 || 
      error?.error?.code === 429 ||
      error?.error?.status === "RESOURCE_EXHAUSTED" ||
      errorStr.includes("RESOURCE_EXHAUSTED") || 
      errorStr.includes("quota") ||
      errorStr.includes("429");

    if (isQuotaError && model !== "gemini-2.5-flash-lite") {
      try {
        response = await ai.models.generateContent({
          ...generateParams,
          model: "gemini-2.5-flash-lite"
        });
      } catch (fallbackError) {
        handleGeminiError(fallbackError, "translateLyrics (fallback)");
      }
    } else {
      handleGeminiError(error, "translateLyrics");
    }
  }

  return response.text || "";
}
