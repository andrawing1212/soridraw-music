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
  SituationConfig,
} from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Gemini API key is not defined. Please set VITE_GEMINI_API_KEY in your environment variables.",
      );
    }

    aiInstance = new GoogleGenAI({ apiKey });
  }

  return aiInstance;
}

type LegacyGenreInput = string[];
type LegacyMoodInput = string[];
type LegacyThemeInput = string[];
type LanguageCode = "ko" | "en" | "ja" | "zh" | "es" | "fr";

interface GenerateSongParams {
  genre: string | null;
  subGenre?: string[];
  isKpopSelected?: boolean;
  isKoreanEnglishMix?: boolean;
  moods: string[];
  themes?: string[];
  situation?: SituationConfig;
  styles?: string[];
  instrumentSounds?: string[];
  userInput: string;
  lyricDraft?: string;
  isLyricMode?: boolean;
  lyricMode?: "assist" | "preserve";
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
      (0 | 1 | 2)?,
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
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized,
  );
}

function resolveInstrumentSoundItem(value: string) {
  const normalized = value.trim().toLowerCase();
  return INSTRUMENT_SOUNDS.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized,
  );
}

function getSubGenreLabels(subGenreIds: string[] = []): string[] {
  if (!subGenreIds.length) return [];

  return subGenreIds
    .map(
      (subGenreId) =>
        GENRE_HIERARCHY.flatMap((group) => group.children)
          .flatMap((main) => main.children)
          .find((item) => item.id === subGenreId)?.label ??
        sentenceCase(subGenreId),
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
      item.label.toLowerCase() === normalized,
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
      item.label.toLowerCase() === normalized ||
      (item.labelKo || "").toLowerCase() === normalized,
  );

  if (!tone) return toneIdOrLabel;
  return tone.promptCore ?? tone.label;
}

function resolveVocalToneShortValue(toneIdOrLabel: string): string {
  const normalized = toneIdOrLabel.trim().toLowerCase();

  const tone = VOCAL_TONES.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized ||
      (item.labelKo || "").toLowerCase() === normalized,
  );

  if (!tone) return compactVocalToneForPrompt(toneIdOrLabel);
  // Keep promptCore as the free-language source, but use promptShort only as
  // the compressed voice color for short final prompt lines.
  return (
    tone.promptShort ||
    compactVocalToneForPrompt(tone.promptCore || tone.labelKo || tone.label)
  );
}

/**
 * Generalizes artist names into vocal characteristics to avoid direct mentions.
 */
function sanitizeUserInput(input: string): string {
  if (!input) return "";

  let sanitized = input;

  const artistReplacements: [RegExp, string][] = [
    [/아이유|IU/gi, "맑고 섬세한 여성 보컬 (clear and delicate female vocal)"],
    [
      /태연|Taeyeon/gi,
      "청아하고 호소력 있는 여성 보컬 (clear and soulful female vocal)",
    ],
    [
      /정국|Jungkook/gi,
      "부드럽고 트렌디한 남성 보컬 (smooth and trendy male vocal)",
    ],
    [
      /지민|Jimin/gi,
      "유니크하고 미성이 섞인 남성 보컬 (unique and high-toned male vocal)",
    ],
    [
      /뷔|V(?![a-z])/gi,
      "허스키하고 깊은 저음의 남성 보컬 (husky and deep bass male vocal)",
    ],
    [
      /블랙핑크|BLACKPINK/gi,
      "세련되고 파워풀한 여성 그룹 보컬 (sophisticated and powerful female group vocal)",
    ],
    [
      /뉴진스|NewJeans/gi,
      "자연스럽고 청량한 여성 그룹 보컬 (natural and refreshing female group vocal)",
    ],
    [
      /에스파|aespa/gi,
      "에너제틱하고 미래지향적인 여성 그룹 보컬 (energetic and futuristic female group vocal)",
    ],
    [
      /볼빨간사춘기|안지영/gi,
      "독특하고 귀여운 음색의 여성 보컬 (unique and cute female vocal)",
    ],
    [
      /백예린|Yerin Baek/gi,
      "몽환적이고 감각적인 여성 보컬 (dreamy and soulful female vocal)",
    ],
    [
      /임영웅/gi,
      "따뜻하고 호소력 짙은 남성 보컬 (warm and deeply expressive male vocal)",
    ],
    [/성시경/gi, "부드럽고 감미로운 남성 보컬 (smooth and sweet male vocal)"],
    [
      /박효신/gi,
      "웅장하고 깊은 울림의 남성 보컬 (grand and deep resonant male vocal)",
    ],
    [
      /트와이스|TWICE/gi,
      "밝고 에너제틱한 여성 그룹 보컬 (bright and energetic female group vocal)",
    ],
    [
      /아이브|IVE/gi,
      "우아하고 세련된 여성 그룹 보컬 (elegant and sophisticated female group vocal)",
    ],
    [
      /르세라핌|LE SSERAFIM/gi,
      "당당하고 파워풀한 여성 그룹 보컬 (confident and powerful female group vocal)",
    ],
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
    throw new Error(
      "API 할당량이 초과되었습니다. 잠시 후 다시 시도하거나, 나중에 다시 이용해주세요. (API Quota Exceeded)",
    );
  }

  // Check for other common errors
  if (
    error?.status === "INVALID_ARGUMENT" ||
    error?.code === 400 ||
    error?.error?.code === 400
  ) {
    throw new Error(
      "요청이 부적절합니다. 입력 내용을 확인해주세요. (Invalid Request)",
    );
  }

  throw new Error(
    "음악 생성 중 오류가 발생했습니다. 다시 시도해주세요. (Generation Error)",
  );
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

function buildLyricsLengthInstruction(
  lyricsLength: LyricsLength = "normal",
): string {
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

function buildLyricGuidancePrompt(
  lyricsLength: LyricsLength = "normal",
): string {
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
  lyricsLength: LyricsLength,
): "1" | "2" | "3" {
  let structure = 2;

  const rapGenres = ["trap", "drill", "boom-bap", "gangsta-rap", "lofi-hiphop"];
  const ambientGenres = [
    "ambient-electronic",
    "ambient-newage",
    "meditation-music",
  ];

  if (genres.some((g) => rapGenres.includes(g.toLowerCase()))) structure += 1;
  if (genres.some((g) => ambientGenres.includes(g.toLowerCase())))
    structure -= 1;

  const energeticMoods = ["bright", "hopeful", "tense"];
  const calmMoods = ["calm", "dreamy", "lonely", "peaceful", "sad", "warm"];

  if (moods.some((m) => energeticMoods.includes(m.toLowerCase())))
    structure += 0.5;
  if (moods.some((m) => calmMoods.includes(m.toLowerCase()))) structure -= 0.5;

  if (lyricsLength === "very-short") structure -= 0.5;
  if (lyricsLength === "long") structure += 0.5;

  const clamped = Math.max(1, Math.min(3, Math.round(structure)));
  return clamped.toString() as "1" | "2" | "3";
}

function buildThemePrompt(themes: string[]): string {
  if (!themes.length) return "";
  if (themes.length === 1) return `Story concept: ${themes[0]}.`;
  if (themes.length === 2)
    return `Story concept: ${themes[0]} and ${themes[1]}.`;
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
    .join(
      ", ",
    )}, and ${normalized[normalized.length - 1].toLowerCase()}, expressed as one coherent emotional scene rather than separate tags.`;
}

function getVocalFormation(vocal: VocalConfig): string | null {
  const male = vocal.male ?? 0;
  const female = vocal.female ?? 0;
  const total = male + female;
  const mode = vocal.mode;

  if (total === 0) return null;

  if (mode === "solo") {
    return female > 0 ? "Solo female vocal" : "Solo male vocal";
  } else if (mode === "duo") {
    if (male > 0 && female > 0) return "Mixed duo vocal";
    else if (male > 0) return "Male duo vocal";
    else return "Female duo vocal";
  } else if (mode === "group") {
    if (male > 0 && female > 0) return "Mixed group vocal";
    else if (male > 0) return "All-male group vocal";
    else return "All-female group vocal";
  } else {
    if (total === 1)
      return female > 0 ? "Solo female vocal" : "Solo male vocal";
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
  const formation =
    getVocalFormation(vocal) || "Genre-based recommended vocal formation";

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
      const genreParts = genreVocal.split(",").map((s) => s.trim());
      const harmonies = genreParts.find((p) =>
        p.toLowerCase().includes("harmonies"),
      );
      const hooks = genreParts.find((p) => p.toLowerCase().includes("hooks"));
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

        const genderStr = m.gender === "male" ? "Male" : "Female";
        const rolesStr = hasRoles ? m.roles.join(", ") : "";
        let toneInfo = "";
        if (m.toneId) {
          const toneValue = resolveVocalToneValue(m.toneId);
          const displayLabel = toneValue
            .toLowerCase()
            .includes(genderStr.toLowerCase())
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
      situation: first.situation,
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
      lyricMode: first.lyricMode ?? "assist",
      isNoLyrics: first.isNoLyrics ?? false,
      includeLyrics:
        (first as any).includeLyrics ?? !(first.isNoLyrics ?? false),
      lyricLanguages: ((first as any).lyricLanguages ?? [
        "ko",
        "en",
      ]) as LanguageCode[],
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
    (0 | 1 | 2)?,
  ];

  return {
    genre: genres?.[0] ?? null,
    subGenre: genres?.slice(1) ?? [],
    moods: moods ?? [],
    themes: themes ?? [],
    situation: undefined,
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
    lyricMode: "assist",
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
  detector: (text: string) => boolean,
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

function enforceKpopMixedLyrics(lyrics: { english: string; korean: string }): {
  english: string;
  korean: string;
} {
  const koreanMixed = injectMixedPhrases(
    lyrics.korean ?? "",
    ["(Stay tonight)", "(You and I)", "(Feel alive)"],
    containsLatin,
  );

  const englishMixed = injectMixedPhrases(
    lyrics.english ?? "",
    ["(이 밤에)", "(너와 나)", "(괜찮아)"],
    containsHangul,
  );

  return {
    korean: koreanMixed,
    english: englishMixed,
  };
}

function buildAppliedKeywordPayload(
  params: GenerateSongParams,
  resolvedStructure: SongStructure,
) {
  const themes = params.themes ?? [];
  const styles = params.styles ?? [];
  const instrumentSounds = params.instrumentSounds ?? [];
  const vocalDescription: string[] = [];

  const formation = getVocalFormation(
    params.vocal ?? { male: 0, female: 0, rap: false },
  );

  if (formation) vocalDescription.push(formation);

  if (params.vocal?.members && params.vocal.members.length > 0) {
    params.vocal.members.forEach((m) => {
      const roles = m.roles
        .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
        .join("/");
      vocalDescription.push(
        `${m.gender === "male" ? "Male" : "Female"}(${roles})`,
      );
    });
  }

  if (params.vocal?.rap) vocalDescription.push("Rap");

  return {
    genre: params.genre ? [params.genre] : [],
    subGenre: params.subGenre ?? [],
    mood: params.moods ?? [],
    theme: themes,
    situation: params.situation,
    situationSummary: buildSituationSummary(params.situation),
    style: styles,
    instrumentSound: instrumentSounds,
    tempo: params.tempo ?? "",
    vocalType: vocalDescription.join(" + ") || "Default",
    lyricsLength: params.lyricsLength ?? "normal",
    songStructure:
      params.songStructure === "custom" ? "custom" : resolvedStructure,
    customStructure:
      params.songStructure === "custom" ? (params.customStructure ?? []) : [],
    maleCount: params.vocal?.male ?? 0,
    femaleCount: params.vocal?.female ?? 0,
    rapEnabled: params.vocal?.rap ?? false,
    isKoreanEnglishMix: params.isKoreanEnglishMix ?? false,
    vocal: params.vocal ?? { male: 0, female: 0, rap: false },
    isNoLyrics: params.isNoLyrics ?? false,
    lyricDraft: params.lyricDraft,
    isLyricMode: params.isLyricMode ?? false,
    lyricMode: params.lyricMode ?? "assist",
  };
}

function buildStructureText(
  songStructure: SongStructure | undefined,
  resolvedStructure: SongStructure,
  customStructure: CustomSectionItem[] = [],
): string {
  if (songStructure === "custom" && customStructure.length > 0) {
    return customStructure
      .map(
        (section) =>
          `${section.section}${section.tags.length > 0 ? ` (${section.tags.join(", ")})` : ""}`,
      )
      .join(" → ");
  }

  const structureMap: Record<Exclude<SongStructure, "custom">, string> = {
    "1": "Intro → Verse 1 → Chorus / Drop → Outro",
    "2": BASIC_STRUCTURE,
    "3": "Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro",
  };

  const selected =
    (songStructure === "custom" ? resolvedStructure : songStructure) ??
    resolvedStructure;
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
  const ROLES = [
    "bass",
    "snare",
    "drum",
    "kick",
    "hi-hat",
    "synth",
    "piano",
    "guitar",
    "pad",
    "string",
    "808",
    "percussion",
    "lead",
    "pluck",
  ];

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
  selectedLabels.forEach((label) => {
    soundItems.push({ label, priority: 2, role: getRole(label) });
  });

  // 1.5. Style sounds (1st and 2nd styles only)
  const selectedStyleIds = params.styles ?? [];
  selectedStyleIds.slice(0, 2).forEach((id) => {
    const item = resolveStyleItem(id);
    if (item?.sound) {
      item.sound.split(",").forEach((s) => {
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
    genreSoundSource.split(",").forEach((s) => {
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
  selectedStyleIds.slice(0, 3).forEach((id) => {
    const item = resolveStyleItem(id);
    if (item?.mood) {
      styleMoods.push(item.mood);
    }
  });

  // Combine and deduplicate
  const combinedMoods = Array.from(new Set([...moodValues, ...styleMoods]));

  const moodValue =
    combinedMoods.length > 0 ? combinedMoods.join(", ") : "Balanced";

  const textureDesc = "clear and polished";

  return `MOOD: ${moodValue}, ${textureDesc}`;
}

function buildVocal(params: GenerateSongParams): string {
  const v = params.vocal ?? { male: 0, female: 0, rap: false };
  const subGenreIds = (params.subGenre ?? []).map((id) => id.toLowerCase());
  const genreId = (params.genre || "").toLowerCase();
  const parts: string[] = [];

  const isHiphop =
    genreId.includes("hiphop") ||
    genreId.includes("trap") ||
    genreId.includes("drill") ||
    subGenreIds.some(
      (id) =>
        id.includes("hiphop") ||
        id.includes("trap") ||
        id.includes("drill") ||
        id.includes("rap"),
    );

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
    allTonesSelected = v.members!.every((m) => !!m.toneId);
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
    const rawParts = genreVocalSource
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const auxKeywords = [
      "harmonies",
      "hooks",
      "delivery",
      "phrasing",
      "scat",
      "ad-libs",
      "call and response",
      "storytelling",
      "ggeok-gi",
      "technique",
    ];

    rawParts.forEach((part) => {
      const lower = part.toLowerCase();
      if (auxKeywords.some((kw) => lower.includes(kw))) {
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
  const uniqueTones = Array.from(
    new Set(toneParts.map((t) => t.toLowerCase())),
  ).map((lower) => toneParts.find((t) => t.toLowerCase() === lower)!);

  parts.push(...uniqueTones);

  // 3. Members (if any) - Member tones and roles
  if (hasMembers) {
    const membersOutput = v
      .members!.map((m, idx) => {
        const genderLabel = m.gender === "male" ? "Male" : "Female";
        let toneLabel = "";
        if (m.toneId) {
          toneLabel = resolveVocalToneValue(m.toneId);
        }

        let finalLabel = toneLabel || genderLabel;
        if (
          toneLabel &&
          !toneLabel.toLowerCase().includes(genderLabel.toLowerCase())
        ) {
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
        if (
          isHiphop &&
          idx === v.members!.length - 1 &&
          !v.members!.some((member) =>
            member.roles?.some((r) => r.toLowerCase().includes("rapper")),
          )
        ) {
          if (!roles.some((r) => r.toLowerCase().includes("rapper"))) {
            roles = roles.filter((r) => r !== "sub");
            if (roles.length === 0) roles.push("rapper");
            else roles.push("rapper");
          }
        }

        const rolesLabel =
          roles.length > 0
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
    const harmonies = genreAuxiliaries.find((p) =>
      p.toLowerCase().includes("harmonies"),
    );
    const hooks = genreAuxiliaries.find((p) =>
      p.toLowerCase().includes("hooks"),
    );
    const delivery = genreAuxiliaries.find((p) =>
      p.toLowerCase().includes("delivery"),
    );
    const phrasing = genreAuxiliaries.find((p) =>
      p.toLowerCase().includes("phrasing"),
    );

    const selectedAux =
      harmonies || hooks || delivery || phrasing || genreAuxiliaries[0];
    parts.push(selectedAux);
  }

  // 5. Rap
  if (v.rap) parts.push("Rap enabled");

  const deduplicated = Array.from(
    new Set(parts.map((p) => p.toLowerCase())),
  ).map((lower) => parts.find((p) => p.toLowerCase() === lower) || lower);

  return `VOCAL: ${deduplicated.join(", ")}`;
}

function buildArrangement(
  params: GenerateSongParams,
  resolvedStructure: SongStructure,
): string {
  const genreId = params.genre;
  let genreFlow = "dynamic progression with clear sectional contrast";

  if (genreId === "drill")
    genreFlow = "cold and sparse with hard-hitting rhythmic shifts";
  if (genreId?.includes("jazz"))
    genreFlow = "fluid and groove-led with organic transitions";
  if (genreId?.includes("ballad"))
    genreFlow = "gradual emotional build-up towards a powerful climax";

  // Mood arrangements (first 3 only)
  const moodArrangements: string[] = [];
  const moods = params.moods ?? [];
  moods.slice(0, 3).forEach((id) => {
    const item = resolveMoodItem(id);
    if (item?.arrangement) {
      moodArrangements.push(item.arrangement);
    }
  });

  // Combine and deduplicate
  const combinedArrangements = Array.from(
    new Set([genreFlow, ...moodArrangements]),
  );

  return `ARRANGEMENT: ${combinedArrangements.join(", ")}`;
}

const DEFAULT_NO_THEME_DIRECTION =
  "No explicit story theme selected; create a simple original everyday emotional scene. Do not use genre, mood, vocal, sound, arrangement, tempo, hook, or structure terms as the lyrical topic.";

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

function cleanPromptValue(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/^[A-Z /]+:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupPromptTail(value: string): string {
  return cleanPromptValue(value)
    .replace(
      /(?:,|\s)+(?:with|and|feat\.?|featuring|plus|or|vs|&|그리고|및)$/i,
      "",
    )
    .replace(/\b(?:with|and|feat\.?|featuring|plus|or|vs|&)$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function translateKoreanPromptFragments(value: string): string {
  let text = String(value || "");
  const replacements: Array<[RegExp, string]> = [
    [/저승사자/g, "Grim Reaper"],
    [/처녀귀신/g, "Maiden Ghost"],
    [/이순신|충무공/g, "Yi Sun-sin"],
    [/도요토미\s*히데요시|토요토미\s*히데요시|히데요시/g, "Hideyoshi"],
    [/귀신/g, "Ghost"],
    [/유령/g, "Ghost"],
    [/상사|부장님|부장|팀장/g, "Boss"],
    [/MZ사원|MZ 직원|직원|사원/g, "MZ Employee"],
    [/엄마|어머니/g, "Mom"],
    [/아빠|아버지/g, "Dad"],
    [/아들/g, "Son"],
    [/딸/g, "Daughter"],
    [/연인/g, "Lover"],
    [/전남친/g, "Ex-boyfriend"],
    [/전여친/g, "Ex-girlfriend"],
    [/세종대왕|세종/g, "King Sejong"],
    [/퇴계이황|이황|퇴계/g, "Yi Hwang"],
    [/조선시대/g, "Joseon-era"],
    [/회사생활|직장 생활|회사/g, "office life"],
    [/상하관계/g, "workplace hierarchy"],
    [/세대차이/g, "generational clash"],
    [/한쪽 독백 중심/g, "one-sided monologue focus"],
    [/짧은 대화형/g, "short dialogue sections"],
    [/콜앤리스폰스형|콜앤리스폰스/g, "call-response"],
    [/감정 누적형/g, "gradual emotional build"],
    [/끝까지 티격태격/g, "constant bickering"],
    [/후반 살짝 이해/g, "late slight understanding"],
    [/몰아붙이고 받아치기/g, "push-and-reply tension"],
    [/서로 다른 말만 반복/g, "talking-past-each-other loop"],
    [/마지막 반전/g, "late twist"],
    [/곡의 전체 정서/g, "the song's emotional core"],
    [/달콤쌉쌀/g, "bittersweet"],
    [/고독한/g, "lonely"],
    [/몽환적/g, "dreamy"],
    [/감성적/g, "emotional"],
    [/밝은/g, "bright"],
    [/펑키한/g, "funky"],
    [/차분한/g, "calm"],
    [/편안한/g, "comfortable"],
    [/평화로운/g, "peaceful"],
    [/사랑/g, "love"],
    [/운명/g, "fate"],
    [/짝사랑/g, "crush"],
    [/그리움/g, "longing"],
    [/여행/g, "travel"],
    [/비/g, "rain"],
    [/곡의\s*전체\s*정서/g, "the song's emotional core"],
    [/장면 중심|장면우선/g, "scene-first"],
    [/비 오는|비오는/g, "rainy"],
    [/여행/g, "travel"],
    [/추억/g, "memory"],
  ];
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return cleanupPromptTail(text.replace(/\s+/g, " "));
}

function stripRemainingKoreanForProductionPrompt(value: string): string {
  // Final music prompt should be English-only. Unknown Korean fragments are
  // removed rather than copied raw, so user notes influence lyrics/internal
  // interpretation but do not leak as mixed-language prompt text.
  return cleanupPromptTail(
    translateKoreanPromptFragments(value)
      .replace(/[가-힣]+/g, "")
      .replace(/\b(?:ui|eun|neun|ga|i|eul|reul)\b/gi, "")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/[,;:]\s*([,;:])/g, "$1")
      .replace(/\s{2,}/g, " "),
  );
}

function englishRoleLabel(role: string, fallback = "Role"): string {
  const translated = translateKoreanPromptFragments(role);
  const withoutKorean = translated.replace(/[가-힣]+/g, "").trim();
  return limitText(withoutKorean || fallback, 24);
}

function enforceEnglishProductionPrompt(prompt: string): string {
  return prompt
    .split("\n")
    .map((line) => {
      if (/^\[Audio quality improved to masterpiece\]$/.test(line.trim()))
        return line.trim();
      return cleanProductionPhrase(stripRemainingKoreanForProductionPrompt(line));
    })
    .filter(Boolean)
    .join("\n");
}

function limitText(value: string, max = 74): string {
  const cleaned = cleanupPromptTail(value);
  if (cleaned.length <= max) return cleaned;
  const sliced = cleaned.slice(0, max + 1);
  const cut = Math.max(sliced.lastIndexOf(","), sliced.lastIndexOf(" "));
  return cleanupPromptTail(
    cut > 24 ? sliced.slice(0, cut) : cleaned.slice(0, max),
  );
}

function takeCommaItems(value: string, maxItems = 3, maxChars = 74): string {
  const items = cleanPromptValue(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const picked = items.slice(0, maxItems).join(", ");
  return cleanupPromptTail(
    limitText(picked || cleanPromptValue(value), maxChars),
  );
}

function hasSituation(situation?: SituationConfig): boolean {
  if (!situation) return false;
  return Boolean(
    situation.enabled ||
    situation.targetA ||
    situation.targetB ||
    situation.relationship ||
    situation.description ||
    situation.development ||
    situation.developmentPreset ||
    situation.developmentCustom ||
    situation.versionLabel ||
    situation.speakerAStyle ||
    situation.speakerAAttitude ||
    situation.speakerBStyle ||
    situation.speakerBAttitude ||
    situation.details ||
    situation.detailCustom ||
    (situation.detailPresets && situation.detailPresets.length > 0) ||
    situation.summary ||
    (situation.speakers && situation.speakers.length > 0),
  );
}

function buildSituationSummary(situation?: SituationConfig): string {
  if (!hasSituation(situation)) return "";
  const relation = [situation?.targetA, situation?.targetB]
    .filter(Boolean)
    .join(" vs ");
  const version = situation?.versionLabel || situation?.version;
  const development =
    situation?.developmentCustom ||
    situation?.developmentPreset ||
    situation?.development;
  const parts = [relation, situation?.relationship, version, development]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.length
    ? parts.join(" / ")
    : limitText(
        situation?.description || situation?.summary || "Situation",
        60,
      );
}

function joinNaturalKorean(items: string[]): string {
  const cleaned = items
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (cleaned.length <= 1) return cleaned[0] || "";
  if (cleaned.length === 2) return `${cleaned[0]}고 ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, 그리고 ${cleaned[cleaned.length - 1]}`;
}

function moodLabelToAtmosphereWord(value: string): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  const map: Record<string, string> = {
    달콤쌉쌀: "bittersweet",
    고독한: "lonely",
    몽환적: "dreamy",
    외로운: "lonely",
    아련한: "wistful",
    쓸쓸한: "lonely",
    따뜻한: "warm",
    차분한: "calm",
    어두운: "dark",
    밝은: "bright",
    희망찬: "hopeful",
    긴장된: "tense",
    평화로운: "peaceful",
    bittersweet: "bittersweet",
    loneliness: "lonely",
    lonely: "lonely",
    dreamy: "dreamy",
    wistful: "wistful",
    warm: "warm",
    calm: "calm",
    dark: "dark",
    bright: "bright",
    hopeful: "hopeful",
    tense: "tense",
    peaceful: "peaceful",
  };
  return map[raw] || cleanupPromptTail(value).toLowerCase();
}

function uniquePromptWords(values: string[], max = 3): string[] {
  return values
    .map((value) =>
      cleanupPromptTail(cleanPromptValue(String(value || ""))).toLowerCase(),
    )
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, max);
}

function buildMoodAtmosphereClause(moodWords: string[]): string {
  const words = uniquePromptWords(moodWords, 3);
  if (!words.length) return "A situation-shaped mood surrounds";

  const hasLonely = words.includes("lonely");
  const hasDreamy = words.includes("dreamy");
  const hasBittersweet = words.includes("bittersweet");

  if (hasLonely && hasDreamy && hasBittersweet) {
    return "A bittersweet sense of lonely dreaminess surrounds";
  }
  if (hasLonely && hasDreamy) {
    return "A lonely dreamlike mood surrounds";
  }
  if (hasBittersweet && hasLonely) {
    return "A bittersweet lonely mood surrounds";
  }
  if (hasBittersweet && hasDreamy) {
    return "A bittersweet dreamlike mood surrounds";
  }

  const phrase = joinPromptPhrase(words, "and");
  return `A ${phrase} mood surrounds`;
}

function roleToPromptPersona(role: string): string {
  const value = String(role || "").toLowerCase();
  if (/이순신|충무공|yi sun-sin|yi sun sin/.test(value)) return "Yi Sun-sin";
  if (/히데요시|도요토미|토요토미|hideyoshi/.test(value)) return "Hideyoshi";
  if (/저승사자|사자|reaper|grim/.test(value)) return "tired reaper";
  if (/귀신|유령|ghost|spirit/.test(value)) return "regretful ghost";
  if (/상사|부장|boss|manager|팀장/.test(value)) return "boss";
  if (/직원|mz|사원|employee|worker|staff/.test(value)) return "employee";
  if (/엄마|어머니|mother|mom/.test(value)) return "mother";
  if (/아들|son/.test(value)) return "son";
  return compactRoleForPrompt(role);
}

function compactVersionTone(value: string): string {
  const raw = String(value || "").toLowerCase();
  if (/코믹|comic/.test(raw)) return "comic";
  if (/블랙|black/.test(raw)) return "black comedy";
  if (/풍자|satire/.test(raw)) return "satirical";
  if (/짠한|웃픈|bittersweet/.test(raw)) return "bittersweet";
  if (/세대|generation/.test(raw)) return "generational";
  if (/화해|reconcile/.test(raw)) return "soft reconciliation";
  if (/평행선|parallel/.test(raw)) return "unresolved parallel-line";
  if (/갈등|conflict/.test(raw)) return "sharp conflict";
  return cleanupPromptTail(value);
}

function compactSituationScene(params: GenerateSongParams): string {
  const situation = params.situation;
  const targetA = String(situation?.targetA || "").trim();
  const targetB = String(situation?.targetB || "").trim();
  const relation = String(situation?.relationship || "").trim();
  const description = String(
    situation?.description || situation?.summary || "",
  ).trim();
  const development = String(
    situation?.developmentCustom ||
      situation?.developmentPreset ||
      situation?.development ||
      "",
  ).trim();
  const detailText = [
    ...(situation?.detailPresets || []),
    situation?.detailCustom || situation?.details || "",
  ]
    .filter(Boolean)
    .join(", ");
  const all =
    `${targetA} ${targetB} ${relation} ${description} ${development} ${detailText}`.toLowerCase();

  const roleScene =
    targetA && targetB
      ? `${roleToPromptPersona(targetA)} and ${roleToPromptPersona(targetB)}`
      : targetA || targetB
        ? roleToPromptPersona(targetA || targetB)
        : "the characters";

  if (/저승|귀신|유령|reaper|ghost|afterlife|미련/.test(all))
    return `${roleScene} on a midnight afterlife road`;
  if (/회사|직장|상사|mz|사원|회의|퇴근|회식|office/.test(all))
    return `${roleScene} inside office hierarchy`;
  if (/엄마|어머니|아들|딸|가족|방문|방|mom|mother|son|daughter/.test(all))
    return `${roleScene} in a late-night family room`;
  if (/이별|끝난 사랑|연인|ex|breakup|봄/.test(all))
    return `${roleScene} facing a lingering breakup memory`;
  return roleScene;
}


function interpretEmotionBlendForPrompt(rawValue: string): string {
  const raw = String(rawValue || "").toLowerCase();
  const has = (pattern: RegExp) => pattern.test(raw);

  // When two selected feelings look contradictory, reinterpret them as one playable emotional state.
  if (has(/기분.*좋|웃음|들뜬|설레|기대|될 것/) && has(/아무것도.*싫|귀찮|힘.?빠|무미건조|별일 아닌 척/)) {
    return "a lazily pleased state, happy because nothing has to be done";
  }
  if (has(/좋은데|사랑|보고 싶은|기대|설레/) && has(/서운|쓸쓸|멀어진|흔들|신경/)) {
    return "mixed affection and quiet disappointment";
  }
  if (has(/웃는데|웃음|밝|장난/) && has(/쓸쓸|그리움|후회|외로|눈물/)) {
    return "smiling through a lonely aftertaste";
  }
  if (has(/화났|억울|날카|반항|말대꾸/) && has(/보고 싶은|신경|기대|좋은데/)) {
    return "irritated but still emotionally attached";
  }
  if (has(/자유|떠나고|도망/) && has(/불안|공황|숨이 턱|쫓기는/)) {
    return "restless longing for escape under anxious pressure";
  }
  if (has(/복받쳐|터질|무너/) && has(/참|아무렇지|담담|체념/)) {
    return "holding back a rising emotional burst";
  }
  if (has(/위로|기대고/) && has(/혼자|버티|척/)) {
    return "wanting comfort while pretending to stand alone";
  }

  const traits: string[] = [];
  const add = (value: string) => {
    if (traits.length < 2 && !traits.includes(value)) traits.push(value);
  };
  if (has(/기분.*좋|웃음|들뜬|설레|기대|오늘은 될/)) add("lightly hopeful");
  if (has(/위로|기대고|사랑받/)) add("seeking comfort");
  if (has(/자유|떠나고|도망/)) add("longing for freedom");
  if (has(/미련|놓지 못|그리움|돌아가|후회/)) add("lingering regret");
  if (has(/복받쳐|터질|무너/)) add("emotion close to breaking");
  if (has(/불안|공황|숨이 턱|쫓기는|실수할까/)) add("anxious tension");
  if (has(/억울|반항|날카|말대꾸|비꼬/)) add("prickly resistance");
  if (has(/아무것도.*싫|귀찮|힘.?빠|무미건조|감정이 식|체념|툭 놓/)) add("flat, drained restraint");
  if (has(/아무렇지|척|모르는 척|별일 아닌 척/)) add("pretending to be fine");
  if (has(/좋은데 서운|웃는데 쓸쓸|편한데 멀어진|괜찮은데 흔들|싫은데 신경|끝난 줄/)) add("subtle mixed emotion");
  return traits.join(" and ");
}

function interpretSpeechStyleForPrompt(rawValue: string): string {
  const raw = String(rawValue || "").toLowerCase();
  const traits: string[] = [];
  const add = (value: string) => {
    if (traits.length < 2 && !traits.includes(value)) traits.push(value);
  };
  if (/담담|차분|낮게|누르/.test(raw)) add("calmly restrained");
  if (/아무렇지|무심|건조|툭/.test(raw)) add("tossed-off and dry");
  if (/리드미컬|빠르게|받아치/.test(raw)) add("rhythmically responsive");
  if (/비꼬|능청|웃으며|장난/.test(raw)) add("playfully sarcastic");
  if (/혼잣말|속삭|숨을 삼키/.test(raw)) add("intimate and inward");
  if (/고백|간절|망설|서툴/.test(raw)) add("vulnerably hesitant");
  if (/직설|날카|존댓말|압박/.test(raw)) add("direct and pointed");
  if (/다정|달래/.test(raw)) add("gently reassuring");
  return traits.join(" and ");
}

function roleDirectionDefaults(role: string): string {
  const value = String(role || "").toLowerCase();
  if (/이순신|충무공|yi sun-sin|yi sun sin/.test(value))
    return "disciplined authority and dry heroic restraint";
  if (/히데요시|도요토미|토요토미|hideyoshi/.test(value))
    return "insecure bravado and tired need for comfort";
  if (/저승사자|사자|reaper|grim/.test(value))
    return "tired authority and reluctant sympathy";
  if (/귀신|유령|ghost|spirit/.test(value))
    return "pleading regret and fragile restraint";
  if (/상사|부장|boss|manager|팀장/.test(value))
    return "dry authority and nagging pressure";
  if (/직원|mz|사원|employee/.test(value))
    return "sarcastic but slightly hurt delivery";
  if (/엄마|어머니|mother|mom/.test(value))
    return "worried warmth that sounds like nagging";
  if (/아들|son/.test(value)) return "blunt defensive replies";
  return "character-driven delivery";
}

function mergeRoleDirection(role: string, rawStyleSource: string): string {
  const base = roleDirectionDefaults(role);
  const roleText = String(role || "").toLowerCase();
  const raw = String(rawStyleSource || "").toLowerCase();

  const blendedEmotion = interpretEmotionBlendForPrompt(raw);
  const speechStyle = interpretSpeechStyleForPrompt(raw);
  const combined = [speechStyle, blendedEmotion].filter(Boolean).join(" with ");

  // Strong role archetypes should remain concise, but still allow the user's selected mood/speech nuance to color them.
  if (/저승사자|사자|reaper|grim/.test(roleText) || /귀신|유령|ghost|spirit/.test(roleText)) {
    return combined ? `${base} with ${combined}` : base;
  }

  const extras: string[] = [];
  const add = (value: string, guard: RegExp) => {
    if (!guard.test(base.toLowerCase()) && !extras.includes(value))
      extras.push(value);
  };

  if (combined) extras.push(combined);
  if (/비꼬|sarcastic/.test(raw)) add("sarcastic edge", /sarcastic/);
  if (/서운|hurt/.test(raw)) add("hurt undertone", /hurt|regret|pleading/);
  if (/잔소리|nag/.test(raw)) add("nagging edge", /nagging/);
  if (/직설|blunt/.test(raw)) add("blunt phrasing", /blunt/);
  if (/통제|명령|몰아붙|press|command/.test(raw))
    add("pressing delivery", /pressure|authority|pressing/);

  return extras.length
    ? `${base} with ${extras.slice(0, 2).join(" and ")}`
    : base;
}

function buildMoodSituationSentence(
  moodLabels: string[],
  scene: string,
  version: string,
): string {
  const moodWords = moodLabels.map(moodLabelToAtmosphereWord).filter(Boolean);
  const sceneText = cleanupPromptTail(scene || "the scene");
  const versionText = cleanupPromptTail(version || "");
  const moodClause = buildMoodAtmosphereClause(moodWords);
  const versionClause = versionText ? ` with ${versionText} tension` : "";
  return cleanupPromptTail(`${moodClause} ${sceneText}${versionClause}`);
}

function buildSituationAtmosphere(params: GenerateSongParams): string {
  const situation = params.situation;
  if (!hasSituation(situation)) return "";
  const version = compactVersionTone(
    String(situation?.versionLabel || situation?.version || "").trim(),
  );
  const moodWords = (params.moods ?? [])
    .map((mood) => resolveMoodItem(mood)?.label || sentenceCase(mood))
    .map(moodLabelToAtmosphereWord)
    .filter(Boolean);

  const moodClause = buildMoodAtmosphereClause(moodWords);
  const scene = compactSituationScene(params);
  const versionClause = version ? ` with ${version} tension` : "";

  // Atmosphere must read as a sentence, not a raw comma list such as "lonely, dreamy".
  const sentence = `${moodClause} ${scene}${versionClause}`;
  return cleanupPromptTail(limitText(sentence, 145));
}

function inferSituationVocalTone(role: string, index: number): string {
  const r = role.toLowerCase();
  if (/세종|왕|전하|임금|king|ruler/.test(role) || /king|ruler/.test(r))
    return "low commanding rap";
  if (
    /퇴계|이황|신하|선비|학자|scholar|official/.test(role) ||
    /scholar|official/.test(r)
  )
    return "tired witty reply";
  if (/상사|부장|boss|manager|팀장/.test(role) || /boss|manager/.test(r))
    return "dry nagging rap";
  if (
    /직원|mz|사원|employee|worker|staff/.test(role) ||
    /employee|worker|staff|gen z/.test(r)
  )
    return "bright sarcastic reply";
  if (/저승사자|사자|reaper|grim/.test(role) || /reaper|grim/.test(r))
    return "dry tired rap-singing";
  if (/귀신|유령|ghost|spirit/.test(role) || /ghost|spirit/.test(r))
    return "fragile pleading vocal";
  if (/엄마|어머니|mother|mom/.test(role) || /mother|mom/.test(r))
    return "warm nagging vocal";
  if (
    /아들|딸|자녀|son|daughter|child/.test(role) ||
    /son|daughter|child/.test(r)
  )
    return "young defensive reply";
  if (/연인|전남친|전여친|lover|ex/.test(role) || /lover|ex/.test(r))
    return index === 0 ? "aching lead vocal" : "distant reply";
  return index === 0 ? "character-led vocal" : "contrasting reply";
}

function getVocalModeInfo(vocal?: VocalConfig) {
  const v = vocal ?? { male: 0, female: 0, rap: false };
  const male = v.male ?? 0;
  const female = v.female ?? 0;
  const total = male + female;
  const formation = getVocalFormation(v);
  const mode =
    v.mode ||
    (total === 1
      ? "solo"
      : total === 2
        ? "duo"
        : total > 2
          ? "group"
          : undefined);
  const isSolo = mode === "solo" || total === 1;
  const isMulti = mode === "duo" || mode === "group" || total >= 2;
  const gender =
    male > 0 && female > 0
      ? "mixed"
      : male > 0
        ? "male"
        : female > 0
          ? "female"
          : "character";
  return { v, male, female, total, formation, mode, isSolo, isMulti, gender };
}

function getMemberGenderLabel(
  params: GenerateSongParams,
  index: number,
): string {
  const members = params.vocal?.members ?? [];
  const memberGender = members[index]?.gender;
  if (memberGender === "male") return "male";
  if (memberGender === "female") return "female";
  const info = getVocalModeInfo(params.vocal);
  if (info.gender === "male") return "male";
  if (info.gender === "female") return "female";
  return index === 0 ? "male" : "female";
}

function compactVocalToneForPrompt(value: string): string {
  const raw = cleanPromptValue(value).toLowerCase();
  if (!raw) return "character";
  const hasMale = raw.includes("male") || raw.includes("남성");
  const hasFemale = raw.includes("female") || raw.includes("여성");
  const gender = hasMale ? "male" : hasFemale ? "female" : "";

  const tones: string[] = [];
  const addTone = (tone: string) => {
    if (tones.length < 3 && !tones.includes(tone)) tones.push(tone);
  };

  // Keep the selected member voice color visible in the final [Vocals] line,
  // but compress it to short Suno-friendly English tags.
  if (/warm|따뜻/.test(raw)) addTone("warm");
  if (/smooth|silky|매끄|부드럽고|감미/.test(raw)) addTone("smooth");
  if (/r&b|rnb|알앤비|리듬.?앤.?블루스/.test(raw)) addTone("R&B");
  if (/spoken|talk|conversational|말하듯|말하|대화/.test(raw))
    addTone("spoken");
  if (/soft|gentle|부드/.test(raw)) addTone("soft");
  if (/plain|담백/.test(raw)) addTone("plain");
  if (/folk|포크/.test(raw)) addTone("folk");
  if (/dry|건조/.test(raw)) addTone("dry");
  if (/gritty|husky|rough|허스키|거친/.test(raw)) addTone("gritty");
  if (/command|authoritative|저음|낮/.test(raw)) addTone("commanding");
  if (/low|deep/.test(raw)) addTone("low");
  if (/bright|clear|청아|밝/.test(raw)) addTone("bright");
  if (/rap|래/.test(raw)) addTone("rap");

  if (tones.length === 0 && /main|lead|sub|vocal|보컬|voice|tone/.test(raw))
    addTone("natural");
  if (tones.length === 0) addTone("character");
  return [...tones, gender].filter(Boolean).join(" ").trim();
}

function compactRoleForPrompt(role: string): string {
  return englishRoleLabel(role, "Role");
}

function compactPersonaForPrompt(value: string): string {
  const raw = String(value || "").toLowerCase();
  const tags: string[] = [];
  const add = (tag: string) => {
    if (tags.length < 3 && !tags.includes(tag)) tags.push(tag);
  };
  if (/걱정|잔소리|nag/.test(raw)) add("worried");
  if (/방어|반박|defensive|blunt|귀찮|짜증/.test(raw)) add("defensive");
  if (/통제|명령|몰아붙|press|command/.test(raw)) add("pressing");
  if (/비꼬|sarcastic|풍자/.test(raw)) add("sarcastic");
  if (/짠|서운|상처|hurt|soft/.test(raw)) add("soft");
  if (/직설|짧|단답|direct/.test(raw)) add("blunt");
  if (/생활|밥|방|잠|학교|성적|청소/.test(raw)) add("daily-life");
  if (/자유|프라이버시|공간|space|independent/.test(raw)) add("independent");
  if (/존댓|공손|formal/.test(raw)) add("formal");
  if (/반말|casual/.test(raw)) add("casual");
  return tags.join(" ");
}

function personaDirectionSentence(value: string): string {
  const raw = String(value || "").toLowerCase();
  const traits: string[] = [];
  const add = (trait: string) => {
    if (traits.length < 2 && !traits.includes(trait)) traits.push(trait);
  };

  if (/걱정|잔소리|nag/.test(raw)) add("a worried, nagging tone");
  if (/비꼬|sarcastic|풍자/.test(raw)) add("sarcastic delivery");
  if (/방어|반박|defensive|귀찮|짜증/.test(raw)) add("defensive phrasing");
  if (/통제|명령|몰아붙|press|command/.test(raw)) add("a pressing attitude");
  if (/직설|짧|단답|direct|blunt/.test(raw)) add("blunt short replies");
  if (/짠|서운|상처|hurt/.test(raw)) add("slightly hurt emotion");
  if (/생활|밥|방|잠|학교|성적|청소/.test(raw)) add("daily-life realism");
  if (/자유|프라이버시|공간|space|independent/.test(raw))
    add("independent boundary-setting");
  if (/존댓|공손|formal/.test(raw)) add("formal restraint");
  if (/반말|casual/.test(raw)) add("casual speech");

  return traits.length ? traits.join(" and ") : "natural character emotion";
}

function getSituationSpeakerStyle(
  situation: SituationConfig | undefined,
  roleIndex: number,
): string {
  if (!situation) return "";
  const speaker = situation.speakers?.[roleIndex];
  const base = [
    speaker?.speechStyle,
    speaker?.attitude,
    roleIndex === 0 ? situation.speakerAStyle : situation.speakerBStyle,
    roleIndex === 0
      ? situation.speakerAAttitude || situation.attitudeA
      : situation.speakerBAttitude || situation.attitudeB,
  ]
    .filter(Boolean)
    .join(", ");
  return compactPersonaForPrompt(base);
}

type InferredRoleGender = "male" | "female" | "any";

function inferRoleGenderFromText(role: string): InferredRoleGender {
  const value = String(role || "").toLowerCase();
  if (
    /엄마|어머니|시어머니|장모|할머니|아내|부인|여자|여성|여친|전여친|딸|며느리|누나|언니|여동생|왕비|공주|mother|mom|wife|woman|female|daughter|girlfriend|sister|grandmother|queen|princess/.test(
      value,
    )
  ) {
    return "female";
  }
  if (
    /아빠|아버지|시아버지|장인|할아버지|남편|남자|남성|남친|전남친|아들|사위|형|오빠|남동생|왕|임금|전하|세종|퇴계|이황|이순신|충무공|히데요시|도요토미|토요토미|신하|선비|부장|상사|boss|father|dad|husband|man|male|son|boyfriend|brother|grandfather|king|ruler|scholar|official|manager/.test(
      value,
    )
  ) {
    return "male";
  }
  return "any";
}

type SituationRoleEntry = {
  role: string;
  genderHint?: InferredRoleGender;
};

function getMatchedMemberIndexes(
  params: GenerateSongParams,
  roles: SituationRoleEntry[],
): number[] {
  const members = params.vocal?.members ?? [];
  const used = new Set<number>();

  return roles.map((entry, roleIndex) => {
    const genderHint =
      entry.genderHint && entry.genderHint !== "any"
        ? entry.genderHint
        : inferRoleGenderFromText(entry.role);

    if (genderHint !== "any") {
      const matched = members.findIndex(
        (member, memberIndex) =>
          !used.has(memberIndex) && member.gender === genderHint,
      );
      if (matched >= 0) {
        used.add(matched);
        return matched;
      }
    }

    const fallback = members.findIndex(
      (_, memberIndex) => !used.has(memberIndex),
    );
    if (fallback >= 0) {
      used.add(fallback);
      return fallback;
    }

    return roleIndex;
  });
}

function getMemberToneForPrompt(
  params: GenerateSongParams,
  index: number,
): string {
  const member = params.vocal?.members?.[index];
  if (!member?.toneId) return "";
  return resolveVocalToneShortValue(member.toneId);
}

function getMemberRoleForPrompt(
  params: GenerateSongParams,
  index: number,
): string {
  const member = params.vocal?.members?.[index];
  const role = member?.roles?.[0];
  if (!role) return index === 0 ? "main" : "lead";
  const normalized = role.toLowerCase();
  if (normalized.includes("main")) return "main";
  if (normalized.includes("lead")) return "lead";
  if (normalized.includes("rapper")) return "rap";
  if (normalized.includes("sub")) return "sub";
  return limitText(role, 8).toLowerCase();
}

function firstPromptWord(value: string): string {
  const cleaned = cleanPromptValue(value)
    .replace(
      /natural|korean|male|female|vocal|voice|tone|delivery|singing|style|main|lead|sub|rap/gi,
      " ",
    )
    .replace(/[^a-zA-Z가-힣&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(" ").filter(Boolean)[0] || "natural";
}

function oneWordVocalTone(value: string): string {
  const compact = compactVocalToneForPrompt(value);
  const first = firstPromptWord(compact);
  return first === "character" ? "natural" : first;
}

function oneWordPersona(value: string): string {
  const compact = compactPersonaForPrompt(value);
  return firstPromptWord(compact);
}

function buildSituationRoleVocalItem(
  params: GenerateSongParams,
  role: string,
  roleIndex: number,
  memberIndex = roleIndex,
): string {
  const gender = getMemberGenderLabel(params, memberIndex);
  const memberTone = getMemberToneForPrompt(params, memberIndex);
  const fallbackTone = compactVocalToneForPrompt(
    inferSituationVocalTone(role, roleIndex),
  );
  const voiceTone = oneWordVocalTone(memberTone || fallbackTone || gender);
  const rawStyleSource = [
    params.situation?.speakers?.[roleIndex]?.speechStyle,
    params.situation?.speakers?.[roleIndex]?.attitude,
    roleIndex === 0
      ? params.situation?.speakerAStyle
      : params.situation?.speakerBStyle,
    roleIndex === 0
      ? params.situation?.speakerAAttitude || params.situation?.attitudeA
      : params.situation?.speakerBAttitude || params.situation?.attitudeB,
  ]
    .filter(Boolean)
    .join(", ");

  const roleName = compactRoleForPrompt(role);
  const cleanTone = voiceTone === "character" ? "natural" : voiceTone;

  // Keep each role compact so the final [Vocals] line never cuts off before
  // the second character name. The detailed nuance still comes from the
  // selected speech/emotion values, but it is compressed into one singer note.
  const direction = limitText(
    mergeRoleDirection(role, rawStyleSource)
      .replace(/\s+with\s+with\s+/gi, " with ")
      .replace(/\s+and\s+and\s+/gi, " and "),
    34,
  );

  return `${cleanTone} ${gender} vocal with ${direction} (${roleName})`;
}

function joinPromptPhrase(items: string[], connector = "and"): string {
  const cleaned = items
    .map((item) => cleanupPromptTail(cleanPromptValue(String(item || ""))))
    .filter(Boolean)
    .filter(
      (item, index, arr) =>
        arr.findIndex((v) => v.toLowerCase() === item.toLowerCase()) === index,
    );
  if (cleaned.length <= 1) return cleaned[0] || "";
  if (cleaned.length === 2) return `${cleaned[0]} ${connector} ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, ${connector} ${cleaned[cleaned.length - 1]}`;
}

type CreativeVariationSeed = {
  id: string;
  genreLens: string;
  atmosphereLens: string;
  vocalLens: string;
  arrangementLens: string;
  lyricArchitecture: string;
  avoidPattern: string;
};

const SITUATION_VARIATION_SEEDS: CreativeVariationSeed[] = [
  {
    id: "interruption-cut-in",
    genreLens: "with an interruption-driven edge",
    atmosphereLens: "where one voice keeps cutting into the other",
    vocalLens:
      "keep one singer interrupting the other instead of balancing every line",
    arrangementLens: "interruption-led section ownership",
    lyricArchitecture:
      "start one section as a solo complaint, then let the other role cut in after 1-2 lines",
    avoidPattern: "balanced A/B/A/B call-response in every section",
  },
  {
    id: "one-sided-pursuit",
    genreLens: "with a chase-like narrative pulse",
    atmosphereLens:
      "where one character keeps chasing and the other keeps delaying",
    vocalLens:
      "let one singer sound persistent while the other dodges or delays",
    arrangementLens: "one-sided pursuit with delayed replies",
    lyricArchitecture:
      "let one role own the verse, while the other appears as short interruptions or echoes",
    avoidPattern: "Verse A then Verse B with equal length",
  },
  {
    id: "negotiation-trade",
    genreLens: "with a playful negotiation groove",
    atmosphereLens:
      "where the conflict feels like a small deal being negotiated",
    vocalLens:
      "shape the singers as two people trading conditions, refusals, and small concessions",
    arrangementLens: "trade-and-refusal progression",
    lyricArchitecture:
      "build the song around offers, refusals, counteroffers, and a hook phrase from the bargain",
    avoidPattern: "simple complaint-answer-empathy structure",
  },
  {
    id: "parallel-monologue",
    genreLens: "with a parallel inner-monologue feel",
    atmosphereLens:
      "where both characters are close but emotionally out of sync",
    vocalLens:
      "let the singers feel like they are talking past each other, not directly answering every line",
    arrangementLens: "parallel monologues that collide in the hook",
    lyricArchitecture:
      "give each role a short private monologue before they clash in Hook or Chorus",
    avoidPattern: "direct reply after every line",
  },
  {
    id: "late-reveal",
    genreLens: "with a late-reveal emotional turn",
    atmosphereLens: "where the real reason is hidden until later",
    vocalLens:
      "keep one singer guarded until a late reveal shifts the delivery",
    arrangementLens: "late reveal instead of early reconciliation",
    lyricArchitecture:
      "hold back the true motive until Bridge, Breakdown, or Final Chorus",
    avoidPattern: "Bridge always becoming sympathy or easy reconciliation",
  },
  {
    id: "unresolved-comedy",
    genreLens: "with an unresolved comic bite",
    atmosphereLens: "where the tension stays funny but never fully solved",
    vocalLens:
      "keep both singers in character until the end without forcing harmony",
    arrangementLens: "unresolved ending with short hook fragments",
    lyricArchitecture:
      "let the final section stay awkward, funny, bitter, or one-sided instead of resolving the conflict",
    avoidPattern: "Final Chorus always resolving the conflict",
  },
  {
    id: "chorus-takeover",
    genreLens: "with a hook takeover structure",
    atmosphereLens:
      "where one character dominates the hook and the other only undercuts it",
    vocalLens:
      "let one singer own the hook while the other adds short undercutting replies",
    arrangementLens: "chorus takeover with undercut replies",
    lyricArchitecture:
      "make the chorus mostly one role's catchphrase, with the other role interrupting in short bursts",
    avoidPattern: "equal chorus lines for both speakers",
  },
  {
    id: "echo-undercut",
    genreLens: "with an echo-and-undercut hook style",
    atmosphereLens:
      "where repeated phrases are echoed, corrected, or mocked by the other role",
    vocalLens: "use echo, correction, and undercutting as vocal behavior",
    arrangementLens: "echo-response hook with asymmetric roles",
    lyricArchitecture:
      "one role sings full lines while the other echoes, corrects, or mocks fragments",
    avoidPattern: "straight alternating dialogue blocks only",
  },
  {
    id: "speaker-flaw-focus",
    genreLens: "with a character-flaw driven color",
    atmosphereLens:
      "where one speaker's weakness quietly drives the whole conflict",
    vocalLens:
      "let the main singer reveal a flaw through delivery, not explanation",
    arrangementLens: "flaw-led verse ownership with an uneven hook response",
    lyricArchitecture:
      "choose one role's flaw as the engine, let the other role react only at key moments",
    avoidPattern: "both speakers getting equal emotional explanations",
  },
  {
    id: "detail-hook-focus",
    genreLens: "with a tiny everyday detail turned into the hook",
    atmosphereLens:
      "where a small object, errand, message, room, or street detail becomes emotionally oversized",
    vocalLens:
      "let the singer treat one ordinary detail like the whole reason they cannot move on",
    arrangementLens: "detail-led hook with sparse character interruptions",
    lyricArchitecture:
      "pick one concrete detail from the Situation and make it the hook engine instead of summarizing the whole conflict",
    avoidPattern:
      "generic regret or generic conflict without a memorable object/detail",
  },
  {
    id: "role-reversal-focus",
    genreLens: "with a subtle role-reversal twist",
    atmosphereLens:
      "where the expected strong role becomes unsettled and the weaker role gains control",
    vocalLens:
      "let the expected authority voice crack slightly while the other voice becomes clearer",
    arrangementLens: "role reversal after the first hook",
    lyricArchitecture:
      "start with expected power dynamics, then shift section ownership to the other role after Hook or Verse 2",
    avoidPattern: "the same role staying dominant from start to finish",
  },
  {
    id: "silent-gap-focus",
    genreLens: "with a quiet pause-driven tension",
    atmosphereLens:
      "where what is not said creates more tension than direct argument",
    vocalLens:
      "use restraint, pauses, and short replies instead of constant debate",
    arrangementLens: "space-led sections with short spoken gaps",
    lyricArchitecture:
      "use missing answers, pauses, or unanswered lines as the dramatic engine",
    avoidPattern:
      "constant verbal back-and-forth without silence or withheld emotion",
  },
  {
    id: "chorus-solo-A",
    genreLens: "with a solo-hook focus for the first role",
    atmosphereLens:
      "where the first role owns the emotional hook while the other role stays peripheral",
    vocalLens:
      "let the first singer carry the chorus while the second only adds small ad-libs or corrections",
    arrangementLens: "first-role solo chorus with brief undercuts",
    lyricArchitecture:
      "make Chorus mostly speaker A's hook; speaker B appears only as ad-lib, echo, or one-line interruption",
    avoidPattern: "equal A/B/A/B chorus lines",
  },
  {
    id: "chorus-solo-B",
    genreLens: "with a second-role hook takeover",
    atmosphereLens: "where the second role unexpectedly owns the hook",
    vocalLens:
      "let the second singer take the chorus while the first role comments from the side",
    arrangementLens: "second-role solo chorus with side comments",
    lyricArchitecture:
      "make Chorus mostly speaker B's catchphrase; speaker A appears as one short interruption or spoken tag",
    avoidPattern: "the first role always leading the hook",
  },
  {
    id: "together-hook-focus",
    genreLens: "with a shared-hook center",
    atmosphereLens:
      "where both roles briefly sound trapped in the same phrase despite conflict",
    vocalLens:
      "use a short shared hook, then separate the voices again immediately",
    arrangementLens: "brief together hook with separated verses",
    lyricArchitecture:
      "let Together own only the main hook phrase while verses remain asymmetrical",
    avoidPattern: "Together taking whole choruses or solving the conflict",
  },
  {
    id: "genre-led-structure",
    genreLens: "with genre-shaped part ownership",
    atmosphereLens:
      "where the scene follows the selected genre's natural vocal architecture",
    vocalLens:
      "match vocal part ownership to the genre rather than forcing dialogue everywhere",
    arrangementLens: "genre-led part architecture",
    lyricArchitecture:
      "if ballad/R&B use one lead hook, if funk/city pop use stylish ad-libs, if rap use relay or battle, if EDM use hook fragments",
    avoidPattern: "one universal dialogue pattern for every genre",
  },
  {
    id: "object-perspective-focus",
    genreLens: "with a cinematic object-perspective edge",
    atmosphereLens:
      "where the scene is anchored by one visible object or place",
    vocalLens:
      "let both singers circle around the same object without explaining it directly",
    arrangementLens: "object-led verses and a reframed hook",
    lyricArchitecture:
      "choose one object/place from the Situation as the recurring anchor and change who interprets it by section",
    avoidPattern: "abstract relationship talk without visible scenery",
  },
  {
    id: "misread-intent-focus",
    genreLens: "with a misread-intention tension",
    atmosphereLens:
      "where both roles misunderstand why the other keeps speaking",
    vocalLens: "make each singer answer the wrong emotional question",
    arrangementLens: "misread replies with delayed clarification",
    lyricArchitecture:
      "write sections where each role responds to what they think the other means, not what was actually said",
    avoidPattern: "cleanly logical dialogue that resolves too easily",
  },
  {
    id: "comic-loop-focus",
    genreLens: "with a looping comic hook device",
    atmosphereLens:
      "where the conflict loops back to the same small problem in a new way",
    vocalLens:
      "let a repeated phrase become funnier or sadder with each return",
    arrangementLens: "looping hook with changed ownership each time",
    lyricArchitecture:
      "repeat one hook phrase but change who owns it and what it means in Chorus 2 or Final Chorus",
    avoidPattern: "repeating the chorus with no change in meaning",
  },
  {
    id: "emotional-fakeout-focus",
    genreLens: "with an emotional fakeout turn",
    atmosphereLens:
      "where the song hints at sincerity then swerves into comedy or denial",
    vocalLens:
      "let one singer almost open up, then dodge it with a joke or practical detail",
    arrangementLens: "fakeout bridge and redirected final hook",
    lyricArchitecture:
      "make Bridge look like confession, then redirect it into humor, avoidance, or a practical problem",
    avoidPattern: "Bridge always becoming direct confession or reconciliation",
  },
  {
    id: "status-game-focus",
    genreLens: "with a status-game performance",
    atmosphereLens: "where both roles compete for control of the room",
    vocalLens:
      "make vocal delivery feel like status play: one pushes, one reframes",
    arrangementLens: "status battle with shifting section ownership",
    lyricArchitecture:
      "let each section change who has status: command, refusal, mockery, silence, or small win",
    avoidPattern: "static power dynamic from start to end",
  },
  {
    id: "memory-cut-focus",
    genreLens: "with jump-cut memory flashes",
    atmosphereLens:
      "where the scene jumps through short memories instead of linear explanation",
    vocalLens:
      "let singers sound like they are catching fragments, not delivering speeches",
    arrangementLens: "memory jump-cuts with a focused hook",
    lyricArchitecture:
      "use short scene fragments and let the hook connect them, rather than telling the situation in order",
    avoidPattern: "linear exposition from start to finish",
  },
  {
    id: "adlib-character-focus",
    genreLens: "with character ad-libs shaping the groove",
    atmosphereLens:
      "where tiny ad-libs expose the real relationship more than full lines",
    vocalLens:
      "let ad-libs and side comments reveal attitude while the main melody stays simple",
    arrangementLens: "ad-lib driven hook with sparse dialogue",
    lyricArchitecture:
      "use short ad-libs, sighs, corrections, or side comments to reveal character, not constant full dialogue",
    avoidPattern: "every reaction written as full explanatory lines",
  },
  {
    id: "asymmetric-duet-focus",
    genreLens: "with an asymmetric duet design",
    atmosphereLens:
      "where one voice carries melody and the other works as rhythm, echo, or spoken pressure",
    vocalLens:
      "do not give both singers the same job; split melody, rhythm, ad-lib, or spoken roles",
    arrangementLens: "asymmetric duet part design",
    lyricArchitecture:
      "assign different musical jobs to each role: one melodic lead, one spoken/rap echo, or one ad-lib counterline",
    avoidPattern:
      "both speakers singing the same type of lines in the same length",
  },
];

const SOLO_VARIATION_SEEDS: CreativeVariationSeed[] = [
  {
    id: "scene-first",
    genreLens: "with a scene-first emotional focus",
    atmosphereLens: "where a small object or place carries the feeling",
    vocalLens:
      "keep the singer natural and scene-bound rather than overly dramatic",
    arrangementLens: "scene-led verse and clean hook lift",
    lyricArchitecture:
      "start from a concrete place, object, or time before naming the emotion",
    avoidPattern: "abstract emotion-first lyrics",
  },
  {
    id: "confession-delay",
    genreLens: "with a delayed-confession arc",
    atmosphereLens: "where the real confession is held back until later",
    vocalLens: "keep the vocal restrained until the confession opens",
    arrangementLens: "delayed confession with gradual lift",
    lyricArchitecture: "hide the real sentence until Bridge or Final Chorus",
    avoidPattern: "opening the song with the full emotional explanation",
  },
  {
    id: "memory-fragment",
    genreLens: "with a fragmented memory feel",
    atmosphereLens: "where small memory fragments replace direct explanation",
    vocalLens: "make the singer sound like they are remembering in pieces",
    arrangementLens: "fragmented verse with a focused hook",
    lyricArchitecture:
      "use short memory fragments and incomplete thoughts before the hook clarifies the feeling",
    avoidPattern: "linear diary-style storytelling",
  },
  {
    id: "quiet-contradiction",
    genreLens: "with a quiet contradiction inside the hook",
    atmosphereLens: "where the singer says one thing but clearly feels another",
    vocalLens: "use controlled delivery that hides a crack underneath",
    arrangementLens: "controlled verse and contradictory hook",
    lyricArchitecture:
      "build the hook around a contradiction, not a simple emotional statement",
    avoidPattern: "straight sad/happy declarations",
  },
  {
    id: "vocal-breath-focus",
    genreLens: "with a breath-led vocal intimacy",
    atmosphereLens:
      "where the emotion is carried by breath and hesitation more than explanation",
    vocalLens: "let the singer sound natural, close, and slightly withheld",
    arrangementLens: "breath-led verse with a restrained hook",
    lyricArchitecture:
      "make small breaths, pauses, and short sentences carry the emotion",
    avoidPattern: "long prose-like emotional explanation",
  },
  {
    id: "hook-object-focus",
    genreLens: "with a concrete hook-object focus",
    atmosphereLens: "where one visible object becomes the emotional center",
    vocalLens:
      "let the singer repeat one object or phrase as if it means more each time",
    arrangementLens: "object-led hook variation",
    lyricArchitecture:
      "turn a small object, message, street, room, photo, or season detail into the hook engine",
    avoidPattern: "generic emotional hook without a concrete image",
  },
  {
    id: "denial-focus",
    genreLens: "with a denial-under-the-surface arc",
    atmosphereLens:
      "where the singer insists they are fine while the details say otherwise",
    vocalLens:
      "keep the vocal controlled, but let small cracks appear in the hook",
    arrangementLens: "controlled verse and cracked final hook",
    lyricArchitecture:
      "write a singer who denies the feeling while objects and habits reveal it",
    avoidPattern: "directly stating the emotion too early",
  },
  {
    id: "late-image-focus",
    genreLens: "with a late-image payoff",
    atmosphereLens: "where the key image only becomes clear near the end",
    vocalLens: "keep the delivery restrained until the final image opens",
    arrangementLens: "delayed image reveal",
    lyricArchitecture:
      "hold back the central image until Bridge or Final Chorus, then make it reframe earlier lines",
    avoidPattern: "explaining the full concept in Verse 1",
  },
  {
    id: "rhythm-phrase-focus",
    genreLens: "with a phrase-rhythm driven feel",
    atmosphereLens: "where short rhythmic phrases shape the emotional groove",
    vocalLens:
      "let the singer use short, singable phrases instead of diary sentences",
    arrangementLens: "phrase-led hook and clipped verses",
    lyricArchitecture:
      "use short phrases, internal rhythm, and a compact refrain rather than long sentences",
    avoidPattern: "prose lines that are hard to sing",
  },
  {
    id: "contradictory-hook-focus",
    genreLens: "with a contradiction-driven hook",
    atmosphereLens: "where the hook says two emotions at once",
    vocalLens: "make the singer sound calm while the words reveal the opposite",
    arrangementLens: "contradictory hook with calm delivery",
    lyricArchitecture:
      "build the hook from a contradiction like staying/leaving, fine/not fine, love/resentment",
    avoidPattern: "single-note emotional statement",
  },
  {
    id: "scene-loop-focus",
    genreLens: "with a looping scene motif",
    atmosphereLens:
      "where the same place returns with a slightly different meaning",
    vocalLens: "let repeated scene words feel more intimate each time",
    arrangementLens: "scene-loop verse and changed final hook",
    lyricArchitecture:
      "return to the same location or object in each section but change what it means",
    avoidPattern: "new unrelated images in every section",
  },
  {
    id: "micro-conflict-focus",
    genreLens: "with a micro-conflict emotional lens",
    atmosphereLens:
      "where a tiny everyday conflict carries the whole relationship",
    vocalLens:
      "let the singer make a small problem feel personal without overdrama",
    arrangementLens: "micro-conflict hook with subtle lift",
    lyricArchitecture:
      "choose one tiny action or phrase as the conflict instead of a broad life summary",
    avoidPattern: "large abstract themes without one small dramatic trigger",
  },
];

function pickCreativeVariationSeed(
  params: GenerateSongParams,
): CreativeVariationSeed {
  const info = getVocalModeInfo(params.vocal);
  const pool =
    hasSituation(params.situation) && info.isMulti
      ? SITUATION_VARIATION_SEEDS
      : SOLO_VARIATION_SEEDS;
  return pool[Math.floor(Math.random() * pool.length)] || pool[0];
}

function appendPromptLens(base: string, addition: string, max = 160): string {
  const cleanedBase = cleanupPromptTail(base);
  const cleanedAddition = cleanupPromptTail(addition);
  if (!cleanedAddition) return cleanedBase;
  if (cleanedBase.toLowerCase().includes(cleanedAddition.toLowerCase()))
    return cleanedBase;
  return cleanupPromptTail(limitText(`${cleanedBase} ${cleanedAddition}`, max));
}

function getSituationDetailFocus(params: GenerateSongParams): string {
  const situation = params.situation;
  const candidates = [
    ...(situation?.detailPresets || []),
    situation?.detailCustom || "",
    situation?.details || "",
    situation?.developmentCustom || "",
    situation?.description || "",
  ]
    .flatMap((value) => String(value || "").split(/[,/·]|\s{2,}/g))
    .map((value) => cleanupPromptTail(value))
    .filter((value) => value.length >= 2 && value.length <= 28)
    .filter(
      (value, index, arr) =>
        arr.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === index,
    );
  if (!candidates.length) return "one small unfinished detail";
  return (
    candidates[Math.floor(Math.random() * candidates.length)] || candidates[0]
  );
}

function variationAtmosphereMeaning(
  variation: CreativeVariationSeed,
  params: GenerateSongParams,
): string {
  const detail = getSituationDetailFocus(params);
  const map: Record<string, string> = {
    "interruption-cut-in":
      "through interruptions that keep breaking the emotional flow",
    "one-sided-pursuit":
      "as one voice keeps chasing while the other keeps resisting",
    "negotiation-trade":
      "as a small negotiation where every request has a cost",
    "parallel-monologue": "through two private monologues that barely meet",
    "late-reveal": "with the real reason hidden until the later sections",
    "unresolved-comedy": "with comic tension that refuses to fully resolve",
    "chorus-takeover": "with one character taking over the emotional hook",
    "echo-undercut": "through dry echoes, corrections, and undercut replies",
    "speaker-flaw-focus":
      "through one exposed character flaw rather than a balanced argument",
    "detail-hook-focus": `through ${detail} becoming the emotional hook`,
    "role-reversal-focus": "as the expected power balance quietly shifts",
    "silent-gap-focus": "through pauses, short replies, and unsaid feelings",
    "chorus-solo-A":
      "with the first role owning the chorus while the other stays at the edge",
    "chorus-solo-B": "with the second role unexpectedly owning the chorus",
    "together-hook-focus":
      "through a brief shared hook that does not solve the conflict",
    "genre-led-structure":
      "through a part structure shaped by the selected genre",
    "object-perspective-focus": `through ${detail} as the visible anchor of the scene`,
    "misread-intent-focus":
      "as both characters keep answering the wrong emotional question",
    "comic-loop-focus":
      "through a recurring small problem that changes meaning each time",
    "emotional-fakeout-focus":
      "with sincerity repeatedly dodged by jokes or practical details",
    "status-game-focus": "as both roles compete for control of the moment",
    "memory-cut-focus":
      "through fragmented memories rather than a straight explanation",
    "adlib-character-focus": "through small ad-libs that reveal personality",
    "asymmetric-duet-focus":
      "with uneven vocal ownership instead of equal back-and-forth",
  };
  return map[variation.id] || "through a fresh angle inside the same situation";
}

function buildVariedSituationAtmosphere(
  params: GenerateSongParams,
  variation: CreativeVariationSeed,
): string {
  const situation = params.situation;
  if (!hasSituation(situation)) return "";

  const moodWords = (params.moods ?? [])
    .map((mood) => resolveMoodItem(mood)?.label || sentenceCase(mood))
    .map(moodLabelToAtmosphereWord)
    .filter(Boolean);
  const moodClause = buildMoodAtmosphereClause(moodWords)
    .replace(/ surrounds$/i, " frames")
    .replace(/ mood frames$/i, " mood frames")
    .trim();
  const scene = compactSituationScene(params);
  const angle = variationAtmosphereMeaning(variation, params);

  // The user's Situation text can be long or vague, so do not copy it directly.
  // Reinterpret it into one fresh dramatic angle each generation.
  return cleanupPromptTail(limitText(`${moodClause} ${scene} ${angle}`, 210));
}


function normalizeStoryAngleForTrackLine(value: string): string {
  let angle = stripRemainingKoreanForProductionPrompt(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!angle) return "";

  angle = angle
    .replace(/^through\s+(.+?)\s+becoming\s+the\s+emotional\s+hook\.?$/i, "where $1 becomes the emotional hook")
    .replace(/^through\s+(.+?)\s+as\s+the\s+visible\s+anchor\s+of\s+the\s+scene\.?$/i, "where $1 anchors the scene")
    .replace(/^through\s+a\s+recurring\s+(.+?)\s+that\s+changes\s+meaning\s+each\s+time\.?$/i, "where a recurring $1 changes meaning each time");

  if (/^through\s+/i.test(angle)) {
    angle = angle.replace(/^through\s+/i, "where the story moves through ");
  } else if (/^with\s+/i.test(angle)) {
    angle = angle.replace(/^with\s+/i, "with ");
  } else if (/^as\s+/i.test(angle)) {
    angle = angle.replace(/^as\s+/i, "as ");
  } else if (!/^(where|with|as)\b/i.test(angle)) {
    angle = `where ${angle}`;
  }

  return cleanupPromptTail(angle)
    .replace(/\bwhere\s+where\b/gi, "where")
    .replace(/\bwith\s+with\b/gi, "with")
    .trim();
}

function joinSceneAndStoryAngle(scene: string, angle: string): string {
  const cleanScene = cleanupPromptTail(scene || "a clear story scene");
  const cleanAngle = normalizeStoryAngleForTrackLine(angle);
  if (!cleanAngle) return `set around ${cleanScene}`;
  if (/^(where|as)\b/i.test(cleanAngle)) return `set around ${cleanScene}, ${cleanAngle}`;
  if (/^with\b/i.test(cleanAngle)) return `set around ${cleanScene} ${cleanAngle}`;
  return `set around ${cleanScene}, ${cleanAngle}`;
}

function cleanProductionPhrase(value: string): string {
  let text = String(value || "")
    .replace(/\bwith\s+and\s+with\s+/gi, "with ")
    .replace(/\bwith\s+with\s+/gi, "with ")
    .replace(/\bwith\s+and\s+/gi, "with ")
    .replace(/\band\s+with\s+/gi, "and ")
    .replace(/\bwith\s+(?:a|an)\s+with\s+/gi, "with ")
    .replace(/,\s*with\s+/gi, " with ")
    .replace(/\s+,\s+/g, ", ")
    .replace(/\s{2,}/g, " ");

  // Run repeatedly because append/limit steps can create chained connectors.
  for (let i = 0; i < 3; i += 1) {
    text = text
      .replace(/\bwith\s+and\s+with\s+/gi, "with ")
      .replace(/\bwith\s+with\s+/gi, "with ")
      .replace(/\bwith\s+and\s+/gi, "with ")
      .replace(/\band\s+with\s+/gi, "and ")
      .replace(/\s{2,}/g, " ");
  }

  return cleanupPromptTail(text);
}

function variationArrangementMeaning(variation: CreativeVariationSeed): string {
  const map: Record<string, string> = {
    "interruption-cut-in":
      "interruption-led sections with uneven vocal ownership",
    "one-sided-pursuit":
      "one voice leads while the other resists in short replies",
    "negotiation-trade": "negotiation-led verses with a changing hook owner",
    "parallel-monologue":
      "parallel monologues that meet only briefly in the hook",
    "late-reveal": "delayed reveal with the emotional turn saved for later",
    "unresolved-comedy": "comic loop ending without full resolution",
    "chorus-takeover":
      "one-speaker chorus takeover with short side interruptions",
    "echo-undercut": "echo-and-undercut hook with asymmetric roles",
    "speaker-flaw-focus": "flaw-driven section ownership with uneven responses",
    "detail-hook-focus": "detail-led hook with sparse character interruptions",
    "role-reversal-focus": "role reversal after the first hook",
    "silent-gap-focus": "space-led sections with short spoken gaps",
    "chorus-solo-A": "first-role solo chorus with brief undercuts",
    "chorus-solo-B": "second-role solo chorus with side comments",
    "together-hook-focus": "brief shared hook with separated verses",
    "genre-led-structure":
      "genre-led part architecture instead of fixed dialogue",
    "object-perspective-focus": "object-led verses and a reframed hook",
    "misread-intent-focus": "misread replies with delayed clarification",
    "comic-loop-focus": "looping hook with changed ownership each time",
    "emotional-fakeout-focus": "fakeout bridge with redirected final hook",
    "status-game-focus": "status battle with shifting section ownership",
  };
  return map[variation.id] || cleanupPromptTail(variation.arrangementLens);
}

function sanitizeVocalDirection(value: string): string {
  let cleaned = cleanupPromptTail(value)
    .replace(/\s+(?:let|use|shape|make)\s+the\s+[^\n]+$/i, "")
    .replace(
      /\s+(?:let|use|shape|make)\s+[^\n]*(?:through|as|while|where)$/i,
      "",
    )
    .replace(/\s+(?:through|as|while|where|with)$/i, "")
    .replace(/\bvocal\s+vocal\b/gi, "vocal")
    .replace(/\bvocals\s+vocals\b/gi, "vocals")
    .replace(/\bwith\s+natural\s+tone\s+and\s+human\s+breath\b/gi, "with human breath")
    .replace(/\bnatural\s+natural\b/gi, "natural")
    .replace(/\s+/g, " ")
    .trim();
  cleaned = cleanupPromptTail(cleaned);
  return cleaned;
}

function moodToMusicAdjective(moodValue: string): string {
  const item = resolveMoodItem(moodValue);
  const label = (item?.label || moodValue || "").toLowerCase().trim();
  const map: Record<string, string> = {
    달콤쌉쌀: "bittersweet",
    고독한: "lonely",
    몽환적: "dreamy",
    아련한: "wistful",
    따뜻한: "warm",
    차분한: "calm",
    어두운: "dark",
    밝은: "bright",
    희망찬: "hopeful",
    긴장된: "tense",
    bittersweet: "bittersweet",
    loneliness: "lonely",
    lonely: "lonely",
    dreamy: "dreamy",
    sad: "sad",
    warm: "warm",
    calm: "calm",
    dark: "dark",
    bright: "bright",
    hopeful: "hopeful",
    nostalgic: "nostalgic",
    tense: "tense",
    peaceful: "peaceful",
    emotional: "emotional",
    groovy: "groovy",
    funky: "funky",
    upbeat: "upbeat",
  };
  return (
    map[label] ||
    cleanPromptValue(item?.label || sentenceCase(moodValue)).toLowerCase()
  );
}

function getMoodWordsForMusicDirection(params: GenerateSongParams): string[] {
  return (params.moods ?? [])
    .map(moodToMusicAdjective)
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 2);
}

function inferVocalCultureLabel(params: GenerateSongParams): string {
  const values = [
    params.genre,
    ...(params.subGenre ?? []),
    ...(params.styles ?? []),
    ...(params.themes ?? []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(" ");

  // Do not force a country label by default. Add it only when the selected genre
  // itself carries a clear national/cultural vocal identity.
  if (
    params.isKpopSelected ||
    /\b(k[\s-]?pop|k[\s-]?ballad|korean|gugak|국악|트로트|trot|k[\s-]?r&b|k[\s-]?hip[\s-]?hop)\b/i.test(
      values,
    )
  ) {
    return "Korean";
  }
  if (/\b(j[\s-]?pop|japanese|enka|anime)\b/i.test(values)) return "Japanese";
  if (/\b(c[\s-]?pop|mandopop|cantopop|chinese)\b/i.test(values)) return "Chinese";
  if (/\b(latin|reggaeton|bossa|samba|afrobeat|afropop)\b/i.test(values))
    return "Latin";
  return "";
}

function naturalVocalPrefix(
  params: GenerateSongParams,
  subject: string,
): string {
  const culture = inferVocalCultureLabel(params);
  return culture ? `natural ${culture} ${subject}` : `natural ${subject}`;
}

function naturalVocalPrefixTitle(
  params: GenerateSongParams,
  subject: string,
): string {
  const value = naturalVocalPrefix(params, subject);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function withOptionalToneAndBreath(base: string, tone: string): string {
  const cleanBase = cleanupPromptTail(base)
    .replace(/\bvocal\s+vocal\b/gi, "vocal")
    .replace(/\bvocals\s+vocals\b/gi, "vocals")
    .replace(/\s+/g, " ")
    .trim();
  const cleanTone = oneWordVocalTone(tone || "").toLowerCase();
  if (!cleanTone || cleanTone === "natural") {
    return `${cleanBase} with human breath`;
  }
  return `${cleanBase} with ${cleanTone} tone and human breath`;
}

function getGenreLabelForPrompt(params: GenerateSongParams): string {
  const genreMeta = getGenreMeta(params.genre || "");
  const subLabels = getSubGenreLabels(params.subGenre ?? [])
    .filter(Boolean)
    .slice(0, 2);
  const styleLabels = getStyleLabels(params.styles ?? [])
    .filter(Boolean)
    .slice(0, 2);
  const moodWords = getMoodWordsForMusicDirection(params);

  const rawGenre = String(params.genre || "").trim();
  const baseCandidates = [
    genreMeta?.label,
    ...subLabels,
    params.isKpopSelected ? "K-Pop" : "",
    rawGenre && rawGenre !== "null" && rawGenre !== "undefined"
      ? sentenceCase(rawGenre)
      : "",
  ].filter(Boolean) as string[];

  let genreCore = joinPromptPhrase(baseCandidates.slice(0, 3), "and");
  if (
    !genreCore ||
    /^thin|^isolated|^cold|^floating|^lonely|^dreamy|^bittersweet/i.test(
      genreCore,
    )
  ) {
    genreCore = params.isKpopSelected
      ? "K-Pop"
      : styleLabels.length
        ? "Korean pop"
        : "Pop";
  }

  const stylePhrase = joinPromptPhrase(styleLabels.slice(0, 2), "and");
  const moodPhrase = joinPromptPhrase(moodWords, "and");

  const cleanGenreCore = genreCore
    .replace(/\s+and\s+/gi, "-")
    .replace(/\s*,\s*/g, " ")
    .trim();
  const cleanStyle = stylePhrase
    .replace(/\s+and\s+/gi, " and ")
    .replace(/Style$/i, "style")
    .trim();

  let sentence = moodPhrase
    ? `A ${moodPhrase} ${cleanGenreCore} track`
    : `A ${cleanGenreCore} track`;
  if (cleanStyle) sentence = `${sentence} with ${cleanStyle}`;

  return cleanupPromptTail(sentence) || "A pop track";
}

function getEnglishMoodPhrase(params: GenerateSongParams): string {
  const moodWords = getMoodWordsForMusicDirection(params)
    .map((item) => stripRemainingKoreanForProductionPrompt(item))
    .filter(Boolean)
    .slice(0, 3);
  if (!moodWords.length) return "balanced emotional";
  return joinPromptPhrase(moodWords, "and").toLowerCase();
}


type MoodStoryProfile = {
  exactWords: string[];
  storyPhrase: string;
};

function buildMoodStoryProfile(params: GenerateSongParams): MoodStoryProfile {
  const moodWords = getMoodWordsForMusicDirection(params)
    .map((word) => stripRemainingKoreanForProductionPrompt(word).toLowerCase())
    .filter(Boolean)
    .slice(0, 3);

  const has = (...items: string[]) =>
    moodWords.some((word) => items.some((item) => word.includes(item)));

  let storyPhrase = "the emotional details reveal more than the singer says out loud";

  if (has("calm", "chill", "peaceful", "comfortable")) {
    storyPhrase =
      "quiet warmth and unhurried hesitation carry the hidden feeling beneath the scene";
  } else if (has("sad", "atmospheric", "dark")) {
    storyPhrase =
      "hushed regret and fragile silence make the scene feel heavier than the words admit";
  } else if (has("bright", "funky", "upbeat", "groovy")) {
    storyPhrase =
      "playful tension and bouncy movement keep the emotional conflict light but noticeable";
  } else if (has("bittersweet", "dreamy", "lonely", "nostalgic", "wistful")) {
    storyPhrase =
      "warm regret, blurred memory, and soft contradiction shape the emotional pull";
  } else if (has("tense", "hopeful")) {
    storyPhrase =
      "restrained pressure and a small hope keep the story moving forward";
  } else if (has("warm")) {
    storyPhrase =
      "familiar warmth softens the hesitation inside the story";
  }

  return { exactWords: moodWords, storyPhrase };
}

function removeRepeatedMoodWordsFromStory(
  sentence: string,
  usedMoodWords: string[],
): string {
  let cleaned = cleanupPromptTail(sentence);
  usedMoodWords.forEach((word) => {
    if (!word || word.length < 3) return;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
  });
  return cleanupPromptTail(
    cleaned
      .replace(/\bin\s+a\s+mood\b/gi, "")
      .replace(/\bin\s+an\s+mood\b/gi, "")
      .replace(/\bin\s+a\s+[,\s]+mood\b/gi, "")
      .replace(/\bin\s+an\s+[,\s]+mood\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*,/g, ","),
  );
}

function getEnglishThemePhrase(params: GenerateSongParams): string {
  const rawThemes = (params.themes ?? [])
    .map((theme) => stripRemainingKoreanForProductionPrompt(theme || ""))
    .filter(Boolean)
    .slice(0, 4);
  if (!rawThemes.length) return "a clear emotional scene";
  if (rawThemes.length === 1) return rawThemes[0].toLowerCase();
  return joinPromptPhrase(rawThemes, "and").toLowerCase();
}

function buildNonSituationStoryClause(
  params: GenerateSongParams,
  variation: CreativeVariationSeed,
  fallbackAtmosphere: string,
): string {
  const themePhrase = getEnglishThemePhrase(params);
  const { exactWords, storyPhrase } = buildMoodStoryProfile(params);
  const lens = removeRepeatedMoodWordsFromStory(
    stripRemainingKoreanForProductionPrompt(variation.atmosphereLens || "")
      .replace(/^where\s+/i, "")
      .trim(),
    exactWords,
  );
  const fallback = removeRepeatedMoodWordsFromStory(
    stripRemainingKoreanForProductionPrompt(fallbackAtmosphere || ""),
    exactWords,
  );

  // The opening track sentence already uses the direct mood words before the genre.
  // Do not repeat phrases like "in a calm and chill mood" here. Turn the same mood
  // into a story function instead: what the feeling does inside the scene.
  const storyFunction = lens || storyPhrase;
  if (themePhrase && themePhrase !== "a clear emotional scene") {
    return cleanupPromptTail(
      `built around ${themePhrase}, where ${storyFunction}`,
    );
  }
  if (fallback && !/[가-힣]/.test(fallback)) {
    return cleanupPromptTail(
      `shaped by ${fallback.toLowerCase()}, where ${storyFunction}`,
    );
  }
  return cleanupPromptTail(
    `built around an emotional scene where ${storyFunction}`,
  );
}

function getAtmosphereForPrompt(
  params: GenerateSongParams,
  detailLayer: string,
): string {
  if (hasSituation(params.situation)) return buildSituationAtmosphere(params);
  if (isFreeTextPrimaryMode(params))
    return stripRemainingKoreanForProductionPrompt(
      buildFreeTextDirectorProfile(detailLayer).mood,
    );

  const moodPhrase = getEnglishMoodPhrase(params);
  const themePhrase = getEnglishThemePhrase(params);
  if (themePhrase && themePhrase !== "a clear emotional scene") {
    return cleanupPromptTail(
      `a ${moodPhrase} mood built around ${themePhrase}`,
    );
  }
  return cleanupPromptTail(`a ${moodPhrase} emotional scene`);
}

function buildNaturalVocals(
  params: GenerateSongParams,
  detailLayer: string,
): string {
  if (isFreeTextPrimaryMode(params)) {
    const profileVocal = buildFreeTextDirectorProfile(detailLayer).vocal;
    const tone = oneWordVocalTone(profileVocal);
    return withOptionalToneAndBreath(naturalVocalPrefix(params, "vocal"), tone);
  }

  const info = getVocalModeInfo(params.vocal);
  const members = params.vocal?.members ?? [];
  if (info.isMulti && members.length >= 2) {
    const items = members.slice(0, 2).map((member, index) => {
      const gender = member.gender === "female" ? "female" : "male";
      const tone = oneWordVocalTone(
        member.toneId ? getMemberToneForPrompt(params, index) : gender,
      );
      return `${tone} ${gender}`;
    });
    return `${naturalVocalPrefix(params, `${info.mode || "duo"} vocals`)} with ${items.join(" vs ")} contrast`;
  }

  const gender =
    info.gender === "female"
      ? "female"
      : info.gender === "male"
        ? "male"
        : "vocal";
  const globalTone = params.vocal?.globalToneId
    ? resolveVocalToneShortValue(params.vocal.globalToneId)
    : "natural";
  const tone = oneWordVocalTone(globalTone);
  const subject = gender === "vocal" ? "vocal" : `${gender} vocal`;
  return withOptionalToneAndBreath(naturalVocalPrefix(params, subject), tone);
}

function buildSituationVocals(params: GenerateSongParams): string {
  const situation = params.situation;
  if (!hasSituation(situation)) return "";

  const info = getVocalModeInfo(params.vocal);
  const formation = info.isMulti
    ? naturalVocalPrefixTitle(params, info.mode || "duo")
    : info.gender === "female"
      ? naturalVocalPrefixTitle(params, "female vocal")
      : info.gender === "male"
        ? naturalVocalPrefixTitle(params, "male vocal")
        : naturalVocalPrefixTitle(params, "vocal");
  const targetA = String(situation?.targetA || "").trim();
  const targetB = String(situation?.targetB || "").trim();
  const speakers = situation?.speakers ?? [];

  // Situation role names must come from targetA/targetB first.
  // Older saved data can contain a partial speakers array, so do not let it replace
  // the visible target names with generic Role labels.
  const targetRoles = [targetA, targetB]
    .filter(Boolean)
    .slice(0, 2)
    .map((role, index) => {
      const speaker = speakers[index];
      return {
        role,
        genderHint:
          speaker?.gender && speaker.gender !== "any"
            ? speaker.gender
            : inferRoleGenderFromText(role),
      } as SituationRoleEntry;
    });

  const speakerRoles = speakers
    .slice(0, 2)
    .map((speaker, index) => {
      const role = String(
        speaker.role ||
          (index === 0 ? targetA : targetB) ||
          speaker.id ||
          `Character ${index + 1}`,
      ).trim();
      return {
        role,
        genderHint:
          speaker.gender && speaker.gender !== "any"
            ? speaker.gender
            : inferRoleGenderFromText(role),
      } as SituationRoleEntry;
    })
    .filter((entry) => Boolean(entry.role));

  const roleEntries: SituationRoleEntry[] = targetRoles.length
    ? targetRoles
    : speakerRoles;

  // Situation characters are story roles. Actual singer count follows the Vocal menu.
  if (info.isSolo) {
    const perspective =
      targetA && targetB
        ? `as ${compactRoleForPrompt(targetA)}, addressing ${compactRoleForPrompt(targetB)}`
        : targetA
          ? `as ${compactRoleForPrompt(targetA)}`
          : "with section emotion tags";
    return `${formation} with human breath and restrained emotion, singing ${perspective}`;
  }

  if (roleEntries.length >= 2) {
    const matchedIndexes = getMatchedMemberIndexes(params, roleEntries);
    const first = buildSituationRoleVocalItem(
      params,
      roleEntries[0].role,
      0,
      matchedIndexes[0],
    );
    const second = buildSituationRoleVocalItem(
      params,
      roleEntries[1].role,
      1,
      matchedIndexes[1],
    );
    return `${formation} with ${first} vs ${second}`;
  }

  if (roleEntries.length === 1) {
    const [matchedIndex] = getMatchedMemberIndexes(params, roleEntries);
    return `${formation} with ${buildSituationRoleVocalItem(params, roleEntries[0].role, 0, matchedIndex)}`;
  }

  return `${formation} with human breath and character-led delivery`;
}

function arrangementDevelopmentToEnglish(value: string): string {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "";
  if (/한쪽\s*독백|독백|monologue/.test(lower))
    return "one-sided monologue focus";
  if (/콜앤|call|response|리스폰스/.test(lower))
    return "call-response dialogue";
  if (/짧은\s*대화|대화형|dialogue/.test(lower))
    return "short dialogue sections";
  if (/티격태격|끝까지|bicker/.test(lower))
    return "constant bickering dialogue";
  if (/반전|twist/.test(lower)) return "late twist progression";
  if (/화해|이해|reconcile|understand/.test(lower))
    return "soft reconciliation arc";
  if (/감정\s*누적|쌓|build/.test(lower)) return "gradual emotional build";
  if (/몰아붙|받아치|push/.test(lower)) return "push-and-reply tension";
  if (/서로\s*다른\s*말|동문서답/.test(lower))
    return "talking-past-each-other flow";
  return cleanupPromptTail(limitText(raw, 32));
}

function buildSituationArrangement(params: GenerateSongParams): string {
  const situation = params.situation;
  if (!hasSituation(situation)) return "";
  const info = getVocalModeInfo(params.vocal);
  const hasTwoStoryRoles =
    Boolean(situation?.targetA && situation?.targetB) ||
    (situation?.speakers?.length ?? 0) > 1;
  const isDialogue = hasTwoStoryRoles && info.isMulti;
  const development = String(
    situation?.developmentCustom ||
      situation?.developmentPreset ||
      situation?.development ||
      "",
  ).trim();
  const dev = arrangementDevelopmentToEnglish(development);
  const base = isDialogue
    ? `${dev || "separated dialogue sections"} with a call-response hook`
    : `${dev || "solo narrative flow"} with section emotion tags and line ad-libs`;
  return cleanupPromptTail(limitText(base, 86));
}

function compactPromptBody(lines: string[]): string[] {
  let current = [...lines];
  const getLineValue = (label: string) => {
    const found = current.find((line) => line.startsWith(`[${label}]`));
    return found?.replace(/^\[[^\]]+\]\s*/, "") ?? "";
  };
  const countBody = () => current.join("\n").length;

  const vocalValue = getLineValue("Vocals");
  const allowExtendedVocalPrompt =
    vocalValue.length > 86 ||
    /\b(duo|group|trio|quartet|vs)\b/i.test(vocalValue);
  const targetLimit = 500;

  if (countBody() <= targetLimit) return current;

  // Keep the music identity readable. The prompt body now allows up to 500 chars,
  // while [Audio quality improved to masterpiece] remains outside this limit.
  // Compress only when the body exceeds 500, and preserve [Vocals] as much as possible.
  const firstPassLimits: Record<string, number> = {
    Genre: 125,
    Instruments: 90,
    Atmosphere: 150,
    Vocals: allowExtendedVocalPrompt ? 235 : 170,
    Arrangement: 80,
  };

  current = current.map((line) => {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!match) return limitText(line, 52);
    const [, label, value] = match;
    return `[${label}] ${cleanupPromptTail(limitText(value, firstPassLimits[label] ?? 48))}`;
  });
  if (countBody() <= targetLimit) return current;

  const secondPassLimits: Record<string, number> = {
    Genre: 100,
    Instruments: 70,
    Atmosphere: 120,
    Vocals: allowExtendedVocalPrompt ? 210 : 150,
    Arrangement: 60,
  };

  current = current.map((line) => {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!match) return line;
    const [, label, value] = match;
    if (label === "Vocals")
      return `[${label}] ${cleanupPromptTail(limitText(value, secondPassLimits[label]))}`;
    if (label === "Atmosphere")
      return `[${label}] ${limitText(value, secondPassLimits[label] ?? 34)}`;
    return `[${label}] ${takeCommaItems(value, 2, secondPassLimits[label] ?? 34)}`;
  });
  return current;
}

function hasFreeTextDirectorNote(params: GenerateSongParams): boolean {
  return Boolean((params.userInput || "").trim());
}

function hasExplicitGenreSelection(params: GenerateSongParams): boolean {
  return (
    Boolean((params.genre || "").trim()) ||
    Boolean((params.subGenre ?? []).length)
  );
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

function hasInfluenceBeforeMainGenre(
  source: string,
  influenceKeywords: string[],
  mainGenreKeywords: string[],
): boolean {
  return influenceKeywords.some((influence) =>
    mainGenreKeywords.some((genre) => {
      const influenceIndex = source.indexOf(influence.toLowerCase());
      const genreIndex = source.indexOf(genre.toLowerCase());
      if (influenceIndex < 0 || genreIndex < 0 || influenceIndex >= genreIndex)
        return false;

      const between = source.slice(
        influenceIndex + influence.length,
        genreIndex,
      );
      return /(느낌|감성|풍|스타일|influence|inspired|based|with|like|색깔|질감)/i.test(
        between,
      );
    }),
  );
}

type FreeTextVocalHint = { keywords: string[]; prompts: string[] };

const FREE_TEXT_VOCAL_HINTS: FreeTextVocalHint[] = [
  {
    keywords: [
      "독특한 창법",
      "유니크한 창법",
      "특이한 창법",
      "개성 있는 보컬",
      "개성있는 보컬",
      "특이한 보컬",
      "유니크한 보컬",
      "독특한 보컬",
      "독특한 목소리",
      "유니크한 목소리",
      "특이한 목소리",
      "개성 있는 목소리",
      "개성있는 목소리",
      "독특한 음색",
      "유니크한 음색",
      "distinctive vocal",
      "unique vocal",
      "unique voice",
      "distinctive voice",
    ],
    prompts: ["unique vocal phrasing", "distinctive vocal tone"],
  },
  {
    keywords: [
      "속삭이듯",
      "속삭이는",
      "속삭임",
      "whisper",
      "whispery",
      "breathy",
    ],
    prompts: ["whispery vocal texture", "intimate breathy delivery"],
  },
  {
    keywords: [
      "말하듯이",
      "말하듯",
      "말하는 듯",
      "spoken-like",
      "conversational",
    ],
    prompts: ["conversational singing style", "natural spoken-like phrasing"],
  },
  {
    keywords: [
      "나른하게",
      "나른한",
      "느슨하게",
      "lazy",
      "laid-back",
      "relaxed",
    ],
    prompts: ["relaxed airy delivery", "lazy soft vocal tone"],
  },
  {
    keywords: ["허스키", "husky", "raspy"],
    prompts: ["husky vocal color", "slightly raspy texture"],
  },
  {
    keywords: ["비음", "nasal"],
    prompts: ["nasal vocal nuance", "bright nasal resonance"],
  },
  {
    keywords: ["힘 빼고", "힘빼고", "힘을 빼고", "힘을 뺀", "low-pressure"],
    prompts: ["relaxed low-pressure vocal delivery"],
  },
  {
    keywords: ["음 끝", "끝을 끌", "끌어주는", "drawn-out", "trailing"],
    prompts: ["slightly drawn-out line endings", "soft trailing vocal lines"],
  },
  {
    keywords: ["흘리듯", "흘려 부르는", "flowing"],
    prompts: ["flowing loose phrasing", "soft trailing vocal lines"],
  },
  {
    keywords: [
      "몽환적인 보컬",
      "몽환적 보컬",
      "몽환적인 발음",
      "dreamy vocal",
      "airy vocal",
    ],
    prompts: ["dreamy airy vocal tone", "soft ethereal pronunciation"],
  },
  {
    keywords: [
      "청량한 보컬",
      "맑은 보컬",
      "청아한 보컬",
      "clear pure vocal",
      "refreshing vocal",
    ],
    prompts: ["clear pure vocal tone", "bright refreshing vocal tone"],
  },
  {
    keywords: ["귀여운 보컬", "cute vocal", "playful vocal"],
    prompts: ["cute playful vocal delivery"],
  },
  {
    keywords: ["세련된 보컬", "polished vocal", "modern vocal"],
    prompts: ["polished modern vocal delivery"],
  },
  {
    keywords: ["도도한 보컬", "chic vocal", "confident vocal"],
    prompts: ["chic confident vocal delivery"],
  },
  {
    keywords: [
      "감정적인 보컬",
      "감성적인 보컬",
      "감정이 묻어",
      "emotional vocal",
    ],
    prompts: ["emotionally expressive delivery"],
  },
  {
    keywords: ["담담한 보컬", "담백한 보컬", "calm vocal", "restrained vocal"],
    prompts: ["restrained emotional delivery", "calm intimate tone"],
  },
  {
    keywords: ["섬세한 보컬", "delicate vocal"],
    prompts: ["delicate vocal control", "subtle emotional nuance"],
  },
  {
    keywords: ["파워풀한 보컬", "강한 보컬", "powerful vocal"],
    prompts: ["powerful vocal delivery"],
  },
  {
    keywords: ["시원한 고음", "고음 폭발", "high notes", "high note"],
    prompts: ["open bright high notes"],
  },
  {
    keywords: ["거친 보컬", "gritty vocal"],
    prompts: ["gritty vocal texture"],
  },
  {
    keywords: ["절규하듯", "절규", "belted", "belting"],
    prompts: ["intense belted emotional delivery"],
  },
  {
    keywords: ["폭발적인 후렴", "터지는 후렴", "explosive chorus"],
    prompts: ["explosive chorus vocal lift"],
  },
  {
    keywords: ["그루브 있는 보컬", "groovy vocal", "rhythmic vocal"],
    prompts: ["groovy rhythmic vocal phrasing"],
  },
  {
    keywords: ["소울풀한 보컬", "soulful vocal"],
    prompts: ["soulful vocal delivery"],
  },
  {
    keywords: ["애드리브", "애드립", "ad-lib", "adlib", "vocal runs"],
    prompts: ["expressive ad-libs", "vocal runs"],
  },
  {
    keywords: ["꺾는 창법", "꺾어서", "꺾어 부르는", "멜리즈마", "melismatic"],
    prompts: ["melismatic vocal runs", "flexible ornamented phrasing"],
  },
  {
    keywords: ["랩하듯", "랩처럼", "rap-sung"],
    prompts: ["rap-sung vocal phrasing"],
  },
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
  const hasSlowTempo = has([
    "느린템포",
    "느린 템포",
    "느리게",
    "slow tempo",
    "slow",
    "잔잔한 템포",
    "gentle tempo",
  ]);
  const hasFastTempo = has([
    "빠른템포",
    "빠른 템포",
    "빠르게",
    "fast tempo",
    "fast",
    "업템포",
    "up-tempo",
    "uptempo",
  ]);
  const hasMidTempo = has(["미디엄", "medium tempo", "mid tempo", "mid-tempo"]);
  const hasCalm = has([
    "잔잔",
    "차분",
    "담담",
    "calm",
    "quiet",
    "understated",
    "gentle",
  ]);

  const rnbKeywords = [
    "알앤비",
    "알앤비느낌",
    "알앤비 느낌",
    "리듬앤블루스",
    "r&b",
    "rnb",
    "rhythm and blues",
  ];
  const neoSoulKeywords = ["네오소울", "네오 소울", "neo soul", "neo-soul"];
  const indieKeywords = [
    "인디음악",
    "인디 음악",
    "인디곡",
    "인디 곡",
    "인디팝",
    "인디 팝",
    "indie",
    "indie song",
    "indie music",
    "indie pop",
    "indie-pop",
  ];
  const cityPopKeywords = ["시티팝", "city pop", "city-pop", "citypop"];
  const synthPopKeywords = [
    "시스팝",
    "신스팝",
    "신스 팝",
    "synth pop",
    "synth-pop",
    "synthpop",
  ];
  const idolKeywords = ["아이돌", "idol", "idol pop", "아이돌팝", "아이돌 팝"];
  const lofiKeywords = [
    "로파이",
    "로우파이",
    "lo-fi",
    "lofi",
    "lo fi",
    "lofi hiphop",
    "lo-fi hip hop",
    "lo-fi hiphop",
    "lofi hip-hop",
  ];
  const studyKeywords = [
    "공부",
    "공부할때",
    "공부할 때",
    "독서실",
    "도서관",
    "책 읽",
    "책읽",
    "study",
    "studying",
    "reading room",
    "library",
    "focus music",
    "background music",
  ];
  const balladKeywords = ["발라드", "발라드곡", "ballad"];
  const rockKeywords = ["락", "록", "락곡", "록곡", "rock"];
  const rnbInfluenceOfIndie = hasInfluenceBeforeMainGenre(
    lower,
    rnbKeywords,
    indieKeywords,
  );
  const neoSoulInfluenceOfCityPop = hasInfluenceBeforeMainGenre(
    lower,
    neoSoulKeywords,
    cityPopKeywords,
  );

  // MAIN GENRE: one main identity first, then secondary influences.
  if (has(lofiKeywords)) {
    pushUnique(
      mainGenreParts,
      has(["힙합", "hip hop", "hip-hop"]) ? "Lo-fi Hip-Hop" : "Lo-fi Chill",
    );
    pushUnique(
      soundParts,
      "dusty lo-fi drum loop",
      "warm muted keys",
      "soft vinyl texture",
      "low-volume background mix",
      "gentle tape warmth",
    );
    pushUnique(moodParts, "quiet focused atmosphere", "dreamy mellow mood");
    pushUnique(
      arrangementParts,
      "minimal loop-based progression",
      "very restrained dynamic movement",
    );
  }

  if (!has(lofiKeywords) && has(studyKeywords)) {
    pushUnique(mainGenreParts, "Study Chill Pop");
    pushUnique(
      soundParts,
      "soft background-friendly production",
      "warm muted keys",
      "gentle rhythmic pulse",
      "non-distracting mix",
    );
    pushUnique(moodParts, "quiet focused atmosphere", "calm study mood");
    pushUnique(
      arrangementParts,
      "minimal progression for concentration",
      "restrained repetitive flow",
    );
  }

  if (has(synthPopKeywords)) {
    pushUnique(
      mainGenreParts,
      has(idolKeywords) ? "Synth Pop / Idol Pop" : "Synth Pop",
    );
    pushUnique(
      soundParts,
      "layered synths",
      "polished electronic pop production",
      "bright synth texture",
      "punchy electronic groove",
    );
    pushUnique(moodParts, "stylish modern pop mood", "slightly quirky energy");
    pushUnique(
      arrangementParts,
      "synth-pop progression",
      "clear electronic sectional contrast",
    );
  }

  if (!has(synthPopKeywords) && has(idolKeywords)) {
    pushUnique(mainGenreParts, "Idol Pop");
    pushUnique(
      soundParts,
      "polished idol-pop production",
      "clean hook-focused mix",
    );
    pushUnique(moodParts, "stylish idol-pop energy");
    pushUnique(arrangementParts, "idol-pop sectional progression");
  }

  if (has(cityPopKeywords)) {
    pushUnique(mainGenreParts, has80sEra ? "80s City Pop" : "City Pop");
    pushUnique(
      soundParts,
      "smooth electric piano",
      "clean funk guitar",
      "warm analog synth",
      "polished retro-pop groove",
    );
    pushUnique(moodParts, "urban night mood", "nostalgic retro mood");
    pushUnique(
      arrangementParts,
      has80sEra ? "80s city-pop progression" : "smooth city-pop progression",
    );
  }

  if (
    has([
      "국악",
      "국악퓨전",
      "국악 퓨전",
      "전통 퓨전",
      "korean traditional fusion",
      "gugak",
      "gugak fusion",
    ])
  ) {
    pushUnique(mainGenreParts, "Korean Traditional Fusion");
    pushUnique(
      soundParts,
      "gayageum or haegeum color",
      "traditional Korean percussion",
      "cinematic drums",
      "modern fusion production",
    );
    pushUnique(moodParts, "epic historical atmosphere", "solemn heroic mood");
    pushUnique(
      arrangementParts,
      "cinematic Korean traditional fusion progression",
      "dramatic dynamic structure",
    );
  }

  if (has(indieKeywords)) {
    pushUnique(
      mainGenreParts,
      hasSlowTempo || hasCalm ? "Slow Indie Pop" : "Indie Pop",
    );
    pushUnique(
      soundParts,
      "minimal indie-pop production",
      "warm guitar or soft keys",
      "intimate clean mix",
    );
    pushUnique(moodParts, "calm intimate mood", "understated emotional color");
    pushUnique(arrangementParts, "relaxed indie-pop progression");
  }

  if (has(["케이팝", "k-pop", "kpop"])) pushUnique(mainGenreParts, "K-Pop");
  if (has(balladKeywords)) pushUnique(mainGenreParts, "Ballad");
  if (has(["트로트", "trot"])) pushUnique(mainGenreParts, "Trot");
  if (has(rockKeywords)) pushUnique(mainGenreParts, "Rock");
  if (has(["재즈", "jazz"])) pushUnique(mainGenreParts, "Jazz");
  if (has(["edm", "일렉트로닉", "electronic"]))
    pushUnique(mainGenreParts, "EDM");
  if (has(["댄스", "dance"])) pushUnique(mainGenreParts, "Dance Pop");
  if (has(["힙합", "hip hop", "hip-hop"]))
    pushUnique(mainGenreParts, "Hip-Hop");
  if (has(rnbKeywords)) {
    if (rnbInfluenceOfIndie) {
      pushUnique(
        mainGenreParts,
        hasSlowTempo || hasCalm ? "Slow Indie Pop" : "Indie Pop",
      );
      pushUnique(genreInfluenceParts, "R&B influence");
    } else if (mainGenreParts.length) {
      pushUnique(genreInfluenceParts, "R&B influence");
    } else {
      pushUnique(mainGenreParts, "R&B");
    }
    pushUnique(
      soundParts,
      "smooth R&B groove",
      "warm keys",
      "soft bass",
      "intimate polished mix",
    );
    pushUnique(
      moodParts,
      "mellow soulful mood",
      "laid-back intimate atmosphere",
    );
    pushUnique(
      arrangementParts,
      rnbInfluenceOfIndie
        ? "relaxed indie-R&B groove progression"
        : "slow R&B groove progression",
    );
  }
  if (has(["포크", "folk", "folk-pop", "어쿠스틱", "acoustic"])) {
    if (mainGenreParts.length) {
      pushUnique(genreInfluenceParts, "acoustic singer-songwriter influence");
    } else {
      pushUnique(mainGenreParts, "Korean soft pop", "singer-songwriter pop");
    }
    pushUnique(
      soundParts,
      "clean acoustic guitar",
      "soft pop drums",
      "intimate mix",
    );
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
    pushUnique(
      soundParts,
      "smooth neo-soul chord color",
      "warm electric piano",
      "laid-back groove",
    );
    pushUnique(moodParts, "mellow soulful atmosphere");
  }
  if (has(["재즈풍", "재즈 느낌", "jazz influence", "jazzy"])) {
    if (!mainGenreParts.includes("Jazz"))
      pushUnique(genreInfluenceParts, "Jazz influence");
    pushUnique(
      soundParts,
      "sophisticated jazz chord color",
      "soft swing nuance",
    );
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
  if (has(["일렉피아노", "electric piano", "epiano", "e-piano"]))
    pushUnique(soundParts, "warm electric piano");
  if (has(["기타", "guitar"])) pushUnique(soundParts, "guitar texture");
  if (has(["신스", "synth", "synthesizer"]))
    pushUnique(soundParts, "synth layer");
  if (has(["베이스", "bass"])) pushUnique(soundParts, "focused bass groove");
  if (has(["드럼", "drum", "drums"])) pushUnique(soundParts, "drum groove");
  if (has(["빈티지", "vintage", "테이프", "tape", "바이닐", "vinyl"]))
    pushUnique(soundParts, "soft vinyl texture", "gentle tape warmth");
  if (has(["잔잔한 로파이", "mellow lofi", "chill lofi", "lofi chill"]))
    pushUnique(
      soundParts,
      "mellow lo-fi beat",
      "soft background-friendly production",
    );
  if (has(["해금", "haegeum"])) pushUnique(soundParts, "haegeum melodic color");
  if (has(["가야금", "gayageum"]))
    pushUnique(soundParts, "gayageum plucked texture");
  if (has(["대금", "daegeum"])) pushUnique(soundParts, "daegeum flute tone");
  if (has(["장구", "janggu"]))
    pushUnique(soundParts, "janggu percussion groove");
  if (has(["판소리", "pansori"])) {
    pushUnique(soundParts, "pansori-inspired tension");
    pushUnique(vocalParts, "Korean traditional vocal inflection");
  }

  // ARTIST REFERENCES: sanitizeUserInput() already turns names into traits.
  if (has(["clear and delicate female vocal", "맑고 섬세한 여성 보컬"])) {
    if (!mainGenreParts.length) pushUnique(mainGenreParts, "Korean soft pop");
    pushUnique(
      soundParts,
      "warm electric piano",
      "clean acoustic guitar",
      "soft pop drums",
      "intimate mix",
    );
    pushUnique(moodParts, "bright", "delicate", "warm", "softly romantic");
    pushUnique(
      vocalParts,
      "clear and delicate female vocal",
      "intimate emotional delivery",
      "natural storytelling expression",
    );
    pushUnique(arrangementParts, "gentle verse build-up", "soft chorus lift");
  }
  if (
    has([
      "clear and soulful female vocal",
      "dreamy and soulful female vocal",
      "몽환적이고 감각적인 여성 보컬",
    ])
  ) {
    if (!mainGenreParts.length) pushUnique(mainGenreParts, "Korean soft pop");
    pushUnique(genreInfluenceParts, "R&B influence");
    pushUnique(soundParts, "warm keys", "airy ambience", "intimate mix");
    pushUnique(moodParts, "dreamy", "soulful", "delicate");
    pushUnique(vocalParts, "soulful female vocal", "emotional breath control");
  }
  if (has(["palette", "팔레트"])) {
    if (!mainGenreParts.length)
      pushUnique(mainGenreParts, "Korean soft pop", "singer-songwriter pop");
    pushUnique(
      soundParts,
      "warm electric piano",
      "clean guitar",
      "soft pop groove",
      "intimate polished mix",
    );
    pushUnique(moodParts, "bright", "warm", "ethereal", "delicate");
    pushUnique(
      arrangementParts,
      "gentle verse progression",
      "warm chorus lift",
      "intimate bridge development",
    );
  }

  // MOOD / SCENE / ATMOSPHERE: keep this separate from THEME.
  if (has(["밤", "night", "midnight"]))
    pushUnique(moodParts, "night atmosphere");
  if (has(["새벽", "dawn", "late night"]))
    pushUnique(moodParts, "late-night intimate atmosphere");
  if (has(["가을", "autumn", "fall"]))
    pushUnique(moodParts, "autumn nostalgia");
  if (has(["여름", "summer"])) pushUnique(moodParts, "summer brightness");
  if (has(["겨울", "winter"])) pushUnique(moodParts, "winter loneliness");
  if (has(["봄", "spring"])) pushUnique(moodParts, "spring warmth");
  if (has(["시원", "청량", "refreshing", "cool breeze", "breezy"])) {
    pushUnique(moodParts, "refreshing breezy feel");
    pushUnique(soundParts, "airy mix", "cool spacious texture");
  }
  if (has(["몽환", "dreamy", "ethereal"]))
    pushUnique(moodParts, "dreamy ethereal atmosphere");
  if (has(["슬픈", "sad", "쓸쓸", "외로운", "lonely"]))
    pushUnique(moodParts, "sad restrained emotional color");
  if (has(["따뜻", "warm"])) pushUnique(moodParts, "warm emotional tone");
  if (has(["어두", "dark"])) pushUnique(moodParts, "dark atmosphere");
  if (has(["밝은", "bright"])) pushUnique(moodParts, "bright mood");
  if (has(["청춘", "youth"])) pushUnique(moodParts, "youthful emotional color");
  if (hasCalm) pushUnique(moodParts, "calm gentle mood");
  if (has(studyKeywords)) {
    pushUnique(
      moodParts,
      "quiet study-room focus",
      "non-distracting background atmosphere",
    );
    pushUnique(themeParts, "quiet study-room scene");
  }

  // THEME / STORY: people, relationship, event, narrative.
  if (has(["사랑", "love"])) pushUnique(themeParts, "romantic love story");
  if (has(["연인", "couple", "lover", "lovers"]))
    pushUnique(themeParts, "couple relationship");
  if (has(["이별", "breakup", "헤어", "그리움", "longing"]))
    pushUnique(themeParts, "breakup and longing");
  if (has(["비 오는", "비오는", "빗소리", "빗속", "장마", "rain", "rainy"]))
    pushUnique(themeParts, "rainy scene");
  if (has(["바다", "sea", "ocean"])) pushUnique(themeParts, "ocean imagery");
  if (has(["드라이브", "drive", "night drive"]))
    pushUnique(themeParts, "drive scene");
  if (has(["고백", "confession"])) pushUnique(themeParts, "tender confession");
  if (has(["성장", "growth", "coming of age"]))
    pushUnique(themeParts, "growth narrative");
  if (has(["추억", "memory", "memories"]))
    pushUnique(themeParts, "memory and nostalgia");
  if (
    has([
      "일상의 자유",
      "자유에 대한",
      "자유로운 일상",
      "자유",
      "freedom",
      "everyday freedom",
    ])
  ) {
    pushUnique(themeParts, "everyday freedom and self-expression");
  } else if (
    has([
      "일상에 관한",
      "일상적인",
      "일상 이야기",
      "일상",
      "everyday life",
      "daily life",
    ])
  ) {
    pushUnique(themeParts, "everyday life story");
  }
  if (
    has([
      "이순신",
      "명량",
      "명량해전",
      "해전",
      "전쟁",
      "장군",
      "역사",
      "historical",
      "battle",
      "naval battle",
    ])
  ) {
    pushUnique(themeParts, "historical heroic narrative", "naval battle drama");
    pushUnique(moodParts, "heroic tension", "grand cinematic weight");
    pushUnique(
      arrangementParts,
      "battle-like rise and fall",
      "dramatic narrative arc",
    );
  }
  if (
    has([
      "드라마적인 서사",
      "드라마틱한 서사",
      "dramatic narrative",
      "cinematic narrative",
      "서사적",
    ])
  ) {
    pushUnique(themeParts, "dramatic narrative");
    pushUnique(arrangementParts, "cinematic story-driven progression");
  }

  // VOCAL / GENDER / PHRASING / LIMITS
  applyFreeTextVocalHints(lower, vocalParts);

  const femaleLikeVoice = has([
    "여자 같은 보이스",
    "여자같은 보이스",
    "여자 같은 목소리",
    "여자같은 목소리",
    "여성 같은 보이스",
    "여성같은 보이스",
    "여성 같은 목소리",
    "여성같은 목소리",
    "female-like voice",
    "feminine voice color",
  ]);

  const maleLikeVoice = has([
    "남자 같은 보이스",
    "남자같은 보이스",
    "남자 같은 목소리",
    "남자같은 목소리",
    "남성 같은 보이스",
    "남성같은 보이스",
    "남성 같은 목소리",
    "남성같은 목소리",
    "male-like voice",
    "masculine voice color",
  ]);

  const koreanCountToEnglish = (value: string): string => {
    const normalized = value.trim();
    const map: Record<string, string> = {
      "1": "one",
      한: "one",
      하나: "one",
      "2": "two",
      두: "two",
      둘: "two",
      "3": "three",
      세: "three",
      셋: "three",
      "4": "four",
      네: "four",
      넷: "four",
      "5": "five",
      다섯: "five",
    };
    return map[normalized] || normalized;
  };

  const femaleIdolCountMatch = rawNote.match(
    /(?:여자|여성)\s*아이돌\s*([0-9]+|한|하나|두|둘|세|셋|네|넷|다섯)\s*명?/i,
  );
  const maleIdolCountMatch = rawNote.match(
    /(?:남자|남성)\s*아이돌\s*([0-9]+|한|하나|두|둘|세|셋|네|넷|다섯)\s*명?/i,
  );

  if (femaleIdolCountMatch) {
    const count = koreanCountToEnglish(femaleIdolCountMatch[1]);
    pushUnique(
      vocalParts,
      `${count} female idol vocalists`,
      "female vocal direction",
    );
    if (!mainGenreParts.length)
      pushUnique(
        mainGenreParts,
        has(synthPopKeywords) ? "Synth Pop / Idol Pop" : "Idol Pop",
      );
    pushUnique(arrangementParts, "member-by-member vocal part contrast");
  }

  if (maleIdolCountMatch) {
    const count = koreanCountToEnglish(maleIdolCountMatch[1]);
    pushUnique(
      vocalParts,
      `${count} male idol vocalists`,
      "male vocal direction",
    );
    if (!mainGenreParts.length)
      pushUnique(
        mainGenreParts,
        has(synthPopKeywords) ? "Synth Pop / Idol Pop" : "Idol Pop",
      );
    pushUnique(arrangementParts, "member-by-member vocal part contrast");
  }

  if (
    has([
      "각자 다른 보이스",
      "각자 다른 목소리",
      "각기 다른 보이스",
      "각기 다른 목소리",
      "서로 다른 보이스",
      "서로 다른 목소리",
      "다른 독특한 보이스",
      "다른 독특한 목소리",
      "different voices",
      "distinct voices",
      "different vocal colors",
    ])
  ) {
    pushUnique(
      vocalParts,
      "distinct vocal colors",
      "different vocal characters",
      "characterful delivery",
    );
    pushUnique(arrangementParts, "shifting vocal parts between members");
  }

  const wantsFemaleVocal =
    !femaleLikeVoice &&
    (has([
      "여자가수",
      "여성가수",
      "여자 보컬",
      "여성 보컬",
      "여자보컬",
      "여성보컬",
      "여자 목소리",
      "여성 목소리",
      "여자목소리",
      "여성목소리",
      "여자 보이스",
      "여성 보이스",
      "여자보이스",
      "여성보이스",
    ]) ||
      /\b(female|woman|girl)\s+(vocal|vocalist|singer|voice)\b/.test(lower));

  const wantsMaleVocal =
    !maleLikeVoice &&
    (has([
      "남자가수",
      "남성가수",
      "남자 보컬",
      "남성 보컬",
      "남자보컬",
      "남성보컬",
      "남자 목소리",
      "남성 목소리",
      "남자목소리",
      "남성목소리",
      "남자 보이스",
      "남성 보이스",
      "남자보이스",
      "남성보이스",
    ]) ||
      /\b(male|man|boy)\s+(vocal|vocalist|singer|voice)\b/.test(lower));

  if (
    has([
      "굵고 깊",
      "굵은",
      "깊은",
      "저음",
      "deep male",
      "deep vocal",
      "low male",
    ])
  ) {
    pushUnique(
      vocalParts,
      "deep resonant male vocal tone",
      "rich low vocal color",
    );
  }
  if (
    has([
      "엇박자",
      "엇박",
      "박자를 밀고",
      "밀고 당기는",
      "syncopated",
      "offbeat",
    ])
  ) {
    pushUnique(
      vocalParts,
      "offbeat vocal phrasing",
      "syncopated delivery",
      "distinctive timing",
    );
  }
  if (
    has([
      "고음자제",
      "고음 자제",
      "고음금지",
      "고음 금지",
      "고음방지",
      "고음 방지",
      "고음 피",
      "높은 음 피",
      "샤우팅 금지",
      "소리 지르지",
      "avoid high",
      "no high note",
      "no belting",
    ])
  ) {
    pushUnique(
      vocalParts,
      "restrained high notes",
      "controlled vocal range",
      "avoid belting",
    );
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
  if (has(["듀엣", "duet"]))
    pushUnique(vocalParts, "duet-style vocal interaction");
  if (has(["랩 없이", "랩없", "no rap", "without rap"])) {
    pushUnique(vocalParts, "no rap, vocal-only delivery");
    pushUnique(constraintParts, "no rap section");
  } else if (
    has([
      "묵직한 랩",
      "무거운 랩",
      "굵은 랩",
      "딥한 랩",
      "heavy rap",
      "deep rap",
      "weighty rap",
    ])
  ) {
    pushUnique(vocalParts, "heavy rap section", "deep rhythmic rap delivery");
    pushUnique(
      arrangementParts,
      "heavy rap section with strong rhythmic impact",
    );
  } else if (has(["랩", "rap"])) {
    pushUnique(vocalParts, "rap section");
    pushUnique(arrangementParts, "dedicated rap section");
  }

  // ARRANGEMENT / TEMPO / HOOK / STRUCTURE
  if (
    has([
      "아주 느린",
      "매우 느린",
      "엄청 느린",
      "very slow",
      "extra slow",
      "super slow",
    ])
  ) {
    pushUnique(arrangementParts, "very slow tempo feel", "wide relaxed pacing");
  } else if (hasSlowTempo) {
    pushUnique(arrangementParts, "slow tempo feel");
  }
  if (hasFastTempo) pushUnique(arrangementParts, "fast tempo feel");
  if (hasMidTempo) pushUnique(arrangementParts, "mid-tempo feel");
  if (has(["짧게", "짧은 곡", "short song", "short lyrics"]))
    pushUnique(
      arrangementParts,
      "compact song structure",
      "concise lyric flow",
    );
  if (has(["길게", "긴 곡", "long song", "long lyrics"]))
    pushUnique(
      arrangementParts,
      "expanded song structure",
      "fuller lyric development",
    );
  if (
    has([
      "중독성있는 후렴",
      "중독성 있는 후렴",
      "중독성 후렴",
      "귀에 남는 후렴",
      "후렴구",
      "훅",
      "hook",
      "catchy chorus",
      "addictive chorus",
    ])
  ) {
    pushUnique(
      arrangementParts,
      "addictive chorus hook",
      "memorable refrain",
      "catchy melodic phrase",
    );
  }
  if (has(["폭발적인 후렴", "터지는 후렴", "explosive chorus"])) {
    pushUnique(arrangementParts, "explosive chorus lift");
  }
  if (
    has([
      "변화무쌍한 구조",
      "변화무쌍",
      "dynamic structure",
      "unpredictable structure",
      "구조 변화",
      "전개가 바뀌",
    ])
  ) {
    pushUnique(
      arrangementParts,
      "unpredictable dynamic structure",
      "strong sectional contrast",
    );
  }
  if (has(["드롭", "drop"]))
    pushUnique(arrangementParts, "strong drop section");
  if (has(["브릿지", "bridge"]))
    pushUnique(arrangementParts, "distinct bridge section");

  // NEGATIVE / CONSTRAINT: fold into relevant sections so it stays visible without extra DETAIL LAYER.
  if (has(["너무 밝지", "과하게 밝", "not too bright"])) {
    pushUnique(moodParts, "not overly bright, restrained emotional color");
  }
  if (has(["발라드처럼 가지 않", "발라드로 가지 않", "not ballad"])) {
    pushUnique(constraintParts, "do not turn into a ballad");
  }

  // Remove contradictory vocal hints after constraints.
  if (constraintParts.includes("avoid excessive high notes")) {
    const highNoteTerms = new Set([
      "open bright high notes",
      "powerful vocal delivery",
      "intense belted emotional delivery",
    ]);
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

  const mainGenre = mainGenreParts.length
    ? mainGenreParts[0]
    : has(studyKeywords)
      ? "Study Chill Pop"
      : hasCalm || hasSlowTempo
        ? "Slow Chill Pop"
        : "Contemporary Pop";
  const extraMainGenres = mainGenreParts.slice(1);
  const influenceText = [...extraMainGenres, ...genreInfluenceParts]
    .slice(0, 3)
    .join(" with ");
  const tempoPart = arrangementParts.find((part) => part.includes("tempo"));
  const genre = [
    mainGenre,
    influenceText ? `with ${influenceText}` : "",
    tempoPart && !mainGenre.toLowerCase().includes("slow") ? tempoPart : "",
  ]
    .filter(Boolean)
    .join(", ");

  const limit = (values: string[], max: number) =>
    values.slice(0, max).join(", ");

  return {
    genre,
    sound: soundParts.length
      ? limit(soundParts, 6)
      : "clean focused production, balanced instrumental palette",
    mood: moodParts.length ? limit(moodParts, 5) : "balanced emotional tone",
    vocal: vocalParts.length
      ? limit(vocalParts, 8)
      : "natural genre-appropriate vocal tone",
    arrangement: arrangementParts.length
      ? limit(arrangementParts, 6)
      : "clear sectional contrast matching the free-text direction",
    theme: themeParts.length
      ? limit(themeParts, 4)
      : DEFAULT_NO_THEME_DIRECTION,
    detail: rawNote,
  };
}
function buildFreeTextPrimarySections(detailLayer: string) {
  const profile = buildFreeTextDirectorProfile(detailLayer);

  return [
    { label: "Genre", content: profile.genre },
    { label: "Instruments", content: profile.sound },
    { label: "Atmosphere", content: profile.mood },
    { label: "Vocals", content: profile.vocal },
    { label: "Arrangement", content: profile.arrangement },
  ];
}

function lowerFirstForPrompt(value: string): string {
  const text = cleanupPromptTail(String(value || "").trim());
  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildStorySettingClause(
  params: GenerateSongParams,
  variation: CreativeVariationSeed,
  fallbackAtmosphere: string,
): string {
  if (!hasSituation(params.situation)) {
    return cleanupPromptTail(
      limitText(
        buildNonSituationStoryClause(params, variation, fallbackAtmosphere),
        180,
      ),
    );
  }

  const scene = stripRemainingKoreanForProductionPrompt(
    compactSituationScene(params),
  );
  const angle = variationAtmosphereMeaning(variation, params);

  // Use the user's Situation as story material, but never paste it directly.
  // The first prompt sentence should feel like a short song pitch: genre + mood + scene + story nuance.
  const clause = joinSceneAndStoryAngle(scene || "a clear story scene", angle);
  return cleanupPromptTail(limitText(clause, 180));
}

function buildHybridTrackLine(
  params: GenerateSongParams,
  genre: string,
  atmosphere: string,
  variation: CreativeVariationSeed,
): string {
  const base = stripRemainingKoreanForProductionPrompt(
    cleanupPromptTail(genre || "A pop track").replace(/\.$/, ""),
  );
  let setting = stripRemainingKoreanForProductionPrompt(
    buildStorySettingClause(params, variation, atmosphere).replace(/\.$/, ""),
  );
  const usedMoodWords = getMoodWordsForMusicDirection(params).map((word) =>
    stripRemainingKoreanForProductionPrompt(word).toLowerCase(),
  );
  setting = removeRepeatedMoodWordsFromStory(setting, usedMoodWords)
    .replace(/^with\s+/i, "built around ")
    .replace(/^where\s+/i, "built around a scene where ")
    .replace(/^,\s*/, "")
    .trim();
  const separator = setting
    ? setting.startsWith("built") ||
      setting.startsWith("set") ||
      setting.startsWith("shaped")
      ? ", "
      : ", built around "
    : "";
  return cleanupPromptTail(limitText(`${base}${separator}${setting}.`, 255));
}

function phraseListForPrompt(items: string[]): string {
  const cleaned = items
    .map((item) => cleanupPromptTail(item).replace(/\.+$/g, "").trim())
    .filter(Boolean);

  const unique = cleaned.filter(
    (item, index, arr) =>
      arr.findIndex((other) => other.toLowerCase() === item.toLowerCase()) ===
      index,
  );

  if (!unique.length) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function buildHybridProductionLine(
  instruments: string,
  arrangement: string,
): string {
  const rawSoundItems = cleanPromptValue(instruments)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const feelWords = new Set([
    "melodic",
    "smooth",
    "effortless",
    "polished",
    "balanced",
    "minimal movement",
    "subtle shifts",
  ]);

  const soundItems: string[] = [];
  const feelItems: string[] = [];

  rawSoundItems.forEach((item) => {
    const cleaned = cleanupPromptTail(item).replace(/\.+$/g, "").trim();
    if (!cleaned) return;
    if (feelWords.has(cleaned.toLowerCase())) {
      feelItems.push(cleaned.toLowerCase());
    } else {
      soundItems.push(cleaned);
    }
  });

  const arrangementItems = cleanPromptValue(arrangement || "clear section movement")
    .split(",")
    .map((item) =>
      cleanupPromptTail(item)
        .replace(/\.+$/g, "")
        .replace(/^dynamic progression with clear sectional contrast$/i, "clear sectional contrast")
        .replace(/^(?:(?:and|with)\s+)+/i, "")
        .trim(),
    )
    .filter(Boolean);

  const soundPhrase = phraseListForPrompt(soundItems.slice(0, 4));
  const performancePhrase = phraseListForPrompt(
    [...feelItems, ...arrangementItems].slice(0, 5),
  );

  const production = soundPhrase
    ? performancePhrase
      ? `${soundPhrase} with ${performancePhrase}`
      : soundPhrase
    : performancePhrase || "a focused instrumental palette with clear movement";

  return cleanupPromptTail(limitText(cleanProductionPhrase(production), 165));
}

function compactHybridPromptBody(lines: string[]): string[] {
  let current = [...lines];
  const countBody = () => current.join("\n").length;
  const targetLimit = 500;
  if (countBody() <= targetLimit) return current;

  const firstPassLimits: Record<string, number> = {
    Track: 220,
    Vocals: 210,
    Production: 145,
  };
  current = current.map((line, index) => {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) {
      const [, label, value] = match;
      return `[${label}] ${cleanupPromptTail(limitText(value, firstPassLimits[label] ?? 120))}`;
    }
    // First sentence has no label by design.
    return cleanupPromptTail(
      limitText(line, index === 0 ? firstPassLimits.Track : 120),
    );
  });
  if (countBody() <= targetLimit) return current;

  const secondPassLimits: Record<string, number> = {
    Track: 190,
    Vocals: 185,
    Production: 120,
  };
  current = current.map((line, index) => {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) {
      const [, label, value] = match;
      return `[${label}] ${cleanupPromptTail(limitText(value, secondPassLimits[label] ?? 100))}`;
    }
    return cleanupPromptTail(
      limitText(line, index === 0 ? secondPassLimits.Track : 100),
    );
  });
  return current;
}

function buildFinalPrompt(
  params: GenerateSongParams,
  resolvedStructure: SongStructure,
  detailLayer: string,
  variation: CreativeVariationSeed,
): string {
  const situationActive = hasSituation(params.situation);
  const baseGenre = isFreeTextPrimaryMode(params)
    ? buildFreeTextDirectorProfile(detailLayer).genre
    : getGenreLabelForPrompt(params);
  const genre = appendPromptLens(baseGenre, variation.genreLens, 165);
  const instruments = isFreeTextPrimaryMode(params)
    ? buildFreeTextDirectorProfile(detailLayer).sound
    : cleanPromptValue(buildSound(params));
  const baseAtmosphere = getAtmosphereForPrompt(params, detailLayer);
  const atmosphere = situationActive
    ? buildVariedSituationAtmosphere(params, variation)
    : appendPromptLens(baseAtmosphere, variation.atmosphereLens, 170);
  const baseVocals = situationActive
    ? buildSituationVocals(params)
    : buildNaturalVocals(params, detailLayer);
  // Keep variation out of [Vocals]. Variation belongs to the track sentence and [Production]
  // so the vocal line never ends with cut fragments like "through" or "as".
  const vocals = sanitizeVocalDirection(baseVocals);
  const arrangementBase = situationActive
    ? buildSituationArrangement(params)
    : isFreeTextPrimaryMode(params)
      ? buildFreeTextDirectorProfile(detailLayer).arrangement
      : cleanPromptValue(buildArrangement(params, resolvedStructure));
  const variedArrangementBase = appendPromptLens(
    arrangementBase,
    variationArrangementMeaning(variation),
    145,
  );
  const arrangement = params.tempo
    ? `${variedArrangementBase}, ${params.tempo
        .replace(/^Between\s+/i, "")
        .replace(/^Exactly\s+/i, "")
        .replace(/\s+and\s+/i, "–")}`
    : variedArrangementBase;

  const trackLine = buildHybridTrackLine(params, genre, atmosphere, variation);
  const production = buildHybridProductionLine(instruments, arrangement);

  const bodyLines = compactHybridPromptBody([
    trackLine,
    `[Vocals] ${cleanupPromptTail(vocals).replace(/^natural\b/i, "Natural")}`,
    `[Production] ${cleanupPromptTail(production)}`,
  ]);

  const finalBodyLines = bodyLines.map((line) =>
    cleanupPromptTail(
      cleanProductionPhrase(line)
        .replace(/Fretless/gi, "fretless")
        .replace(/\bthrough\s+becoming\b/gi, "where it becomes"),
    ),
  );

  return enforceEnglishProductionPrompt(
    [...finalBodyLines, `[Audio quality improved to masterpiece]`].join("\n"),
  );
}

export async function generateSong(
  ...args: GenerateSongInput
): Promise<SongResult> {
  const params = normalizeArgs(args);
  const requestedLyricLanguages = Array.from(
    new Set(
      (params.lyricLanguages?.length
        ? params.lyricLanguages
        : ["ko", "en"]
      ).filter(Boolean),
    ),
  ).slice(0, 2) as LanguageCode[];
  const effectiveNoLyrics = Boolean(
    params.isNoLyrics ||
    params.includeLyrics === false ||
    requestedLyricLanguages.length === 0,
  );
  params.isNoLyrics = effectiveNoLyrics;
  params.lyricLanguages = requestedLyricLanguages;
  const model: string = "gemini-3-flash-preview";

  const genresForDuration = params.genre ? [params.genre] : [];
  const resolvedStructure = (
    (params.useAutoDuration ?? true)
      ? calculateSongStructure(
          genresForDuration,
          params.moods ?? [],
          params.lyricsLength ?? "normal",
        )
      : (params.songStructure ?? "2")
  ) as SongStructure;

  const lyricGuidancePrompt = buildLyricGuidancePrompt(
    params.lyricsLength ?? "normal",
  );
  const genreMeta = getGenreMeta(params.genre);
  const genrePromptCore = genreMeta?.promptCore ?? "";
  const selectedGenreIdentity =
    [
      params.genre ? (genreMeta?.label ?? sentenceCase(params.genre)) : "",
      ...getSubGenreLabels(params.subGenre ?? []),
    ]
      .filter(NON_EMPTY)
      .join(" / ") || "No explicit genre selected";
  const instrumentSoundPromptCores = getInstrumentSoundPromptCores(
    params.instrumentSounds ?? [],
  );
  const themePrompt = buildThemePrompt(params.themes ?? []);
  const themeSentence = buildThemeSentence(params.themes ?? []);
  const vocalPrompt = buildVocalPrompt(
    params.vocal ?? { male: 0, female: 0, rap: false },
    params.subGenre ?? [],
  );
  const basePromptSeed = BASE_PROMPTS.join("\n");

  // Build Detail Layer (Summarized English Prompt)
  const detailLayer = await buildDetailLayer(params.userInput || "");
  const creativeVariation = pickCreativeVariationSeed(params);

  const finalPrompt = buildFinalPrompt(
    params,
    resolvedStructure,
    detailLayer,
    creativeVariation,
  );
  console.log("🔥 generateSong called");
  console.log("🔥 FINAL PROMPT:", finalPrompt);
  const exactStructureText = buildStructureText(
    params.songStructure,
    resolvedStructure,
    params.customStructure ?? [],
  );

  const shouldUseMixedLyrics = Boolean(
    params.isKoreanEnglishMix ||
    (params.isKpopSelected && params.kpopMode === 2),
  );

  const languageNameMap: Record<LanguageCode, string> = {
    ko: "Korean",
    en: "English",
    ja: "Japanese",
    zh: "Chinese",
    es: "Spanish",
    fr: "French",
  };
  const secondaryLanguage =
    requestedLyricLanguages.find((lang) => lang !== "ko") || "en";
  const hasKoreanLanguage = requestedLyricLanguages.includes("ko");
  const hasSecondaryLanguage = requestedLyricLanguages.some(
    (lang) => lang !== "ko",
  );
  const titleFormatInstruction =
    hasKoreanLanguage && hasSecondaryLanguage
      ? `Return the title pair as: 'Korean Title' | '${languageNameMap[secondaryLanguage]} Title'.`
      : hasKoreanLanguage
        ? `Return the title as: 'Korean Title'. Do not create an English or other-language title.`
        : `Return the title as: '${languageNameMap[secondaryLanguage]} Title'. Do not create Korean or English titles unless that language is selected.`;
  const requestedLanguageInstruction = effectiveNoLyrics
    ? ""
    : `OUTPUT LANGUAGE RULE (MANDATORY):
- Generate titles and lyrics only for the selected language setting: ${requestedLyricLanguages.map((lang) => languageNameMap[lang]).join(" + ")}.
- The title language(s) MUST exactly match the selected lyric language(s).
- ${titleFormatInstruction}
- If Korean is selected, put Korean lyrics in JSON field lyrics.korean and create a natural Korean title.
- If a non-Korean language is selected, put that language's lyrics in JSON field lyrics.english, even when the selected language is not English.
- If a language is not selected, do not create a title or lyrics for that language.
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

  const mixedLyricsInstruction =
    shouldUseMixedLyrics && !params.isNoLyrics
      ? `MIXED LANGUAGE MODE (MANDATORY):
- Use natural Korean/English mixed lyrics.
- Ratio: about 70-75% primary language flow and 25-30% mixed-language accents.
- For lyrics.korean: keep Korean as the main language, but include natural English words or short phrases in MULTIPLE sections.
- For lyrics.english: keep English as the main language, but include natural Korean words or short phrases in MULTIPLE sections.
- The chorus or hook MUST contain visible code-switching.
- Do not keep the two versions fully separated by language.
- Keep the code-switching natural and melodic, not forced.`
      : "";

  const lyricDraftInstruction =
    params.isLyricMode && params.lyricDraft
      ? params.lyricMode === "preserve"
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
- Keep it natural and polished.`
      : "";

  const structureInstruction =
    params.songStructure === "custom" &&
    (params.customStructure ?? []).length > 0
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
- Do not collapse this into a generic pop structure.
- If Situation is active, every lyrical custom section must still follow the Situation roles and relationship.
- Chorus, Hook, Rap Verse, Bridge, Verse, Pre-Chorus, Final Chorus, and Outro must not become generic lyrics; keep the scenario and role conflict active.
- Instrumental, Solo, Drop, and Break can be mainly musical, but if they include lyrics or ad-libs, they must stay connected to the same Situation.`
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
- When the user writes 로파이/lo-fi/lofi, the core genre MUST be Lo-fi Chill or Lo-fi Hip-Hop, never generic Contemporary Pop.
- When the user writes 공부/독서실/도서관/study/library, preserve that as a quiet focus/study-room scene and background-friendly listening context.
- If explicit UI selections exist, combine them with the note. When they conflict, prefer the user's clearly written natural-language direction unless a custom song structure is explicitly selected.
- Explicit Genre, Style, Sound, Mood, and Situation selections are locked source materials. Do not drop them from the final concept; compress them instead.
- Same selected keywords must NOT create the same song every time. Treat the selections as a reusable palette, not a fixed template.
- If the user mentions a song length, slow/fast tempo, short/long lyrics, verse/chorus/bridge, rap/no rap, or vocal formation, reflect that in the final song direction.
- If custom song structure mode is selected, keep the custom section order fixed, but still apply the note to mood, sound, theme, vocal expression, and section energy.

CREATIVE VARIATION SEED (MANDATORY, DO NOT OUTPUT AS A SECTION):
- Attempt ID: ${creativeVariation.id}
- This generation must use this angle: ${creativeVariation.lyricArchitecture}.
- Avoid this repeated pattern: ${creativeVariation.avoidPattern}.
- Apply the variation to prompt interpretation, song section ownership, chorus function, lyric architecture, and the final track sentence/[Production] wording.
- Same keywords on a later run may choose another angle; do not treat current keywords as a fixed template.
- "Same keywords" includes button selections AND the user's Situation text fields: target A/B, relationship, description, development, speaker style, attitude, and details.
- Even if the exact same Situation sentence is reused, create a sibling version, not a clone: shift the focus, hook owner, flaw, detail, scene angle, or section ownership.
- Keep the same world and genre identity, but change the interpretation angle enough that the prompt describes a similar-but-different song.
- Reflect the chosen variation inside the opening track sentence and [Production], not only in hidden instructions.
- Do NOT append variation wording to [Vocals]. [Vocals] must contain only natural singer direction and role persona.
- When Situation text is long, vague, or repeated, compress it into a fresh dramatic angle rather than copying the user's wording. Same Situation can become ghost regret focus, reaper fatigue focus, negotiation focus, object/detail focus, role reversal, or unresolved comedy depending on this generation.

SITUATION NUANCE VARIATION RULE (MANDATORY):
- Before writing lyrics, reinterpret the Situation through the current Attempt ID.
- Choose whose desire leads the song, whose flaw is exposed first, which concrete detail becomes the hook, and who owns the chorus.
- Do not let identical Situation text always produce the same track sentence, [Vocals], [Production], or chorus ownership.
- Examples of valid sibling versions: ghost-regret focus, reaper-fatigue focus, negotiation focus, parallel-conflict focus, late-reveal focus, chorus-takeover focus, unresolved-comedy focus, memory-detail focus.

GENRE COHERENCE RULE (MANDATORY):
- The final song must still be coherent as one concept, not a loose list of tags.
- When the note defines a genre, use that genre as the core blueprint.
- When the note contains multiple influences, blend them into one clear production identity.
- Do NOT turn mood into a different genre unless the free-text note clearly asks for that genre.
- Do NOT ignore explicit free-text words such as city pop, Korean traditional fusion, slow tempo, autumn, night, love, couple, historical battle, refreshing feel, rap, no rap, short song, long song, or female/male vocal.

SITUATION / THEME SEPARATION RULE (MANDATORY):
- Situation is the primary scenario key when provided: relationship, conflict, place, attitude, development, and ending tone.
- Theme is only a fallback story helper when Situation is not provided.
- Final [Vocals] must prioritize a natural vocal/duet feel first and be written as a short singer-directing sentence, not a comma tag list. Do not force Korean by default; add Korean/Japanese/Latin or another cultural vocal identity only when the selected genre or lyric language clearly calls for it. Keep the selected tone compact, then describe attitude/delivery naturally.
- Do not copy user-provided speaker style, attitude, development, or detail words directly into [Vocals] as raw keywords. Rewrite them into a producer-style sentence that sounds like directing a real singer.
- [Vocals] must read as a human character direction: attitude + vocal feel + persona role. Example: bright female vocals with sarcastic but slightly hurt delivery (MZ Employee).
- Do not over-specify genre-default vocals or mood-default phrases; let the model interpret genre and mood naturally unless the user selected Style/Sound or Situation details.
- Style and Sound selections must be reflected in the opening track sentence and [Production]. Mood selections must color the opening sentence as part of the music/story pitch. Do not output raw comma lists for Mood.
- [Production] must communicate the playing/production feel, not just dump tags. Rewrite sound and arrangement items into a compact performance sentence such as "walking bass and soft synth stabs with subtle shifts and smooth sectional contrast."
- Mood, genre, vocal technique, sound, tempo, hook, and arrangement instructions are NOT story themes.
- Do NOT turn technical instructions into the title or lyrical topic.
- Keep the final production prompt body up to 500 characters, excluding the fixed audio-quality line. Do not cut off genre identity, story scene, production movement, or vocal roles.
- Good [Vocals] style: Natural duet with bright female vocals and sarcastic delivery (Employee) vs dry male vocals with a nagging tone (Boss). If the genre is K-pop/Trot/Gugak, Natural Korean duet is appropriate. Bad style: Female, pop, sad.
- Final production prompt must be English-only. Do not mix Korean words into the music prompt, even if the UI input is Korean. Translate role names, mood, story, and development nuance into concise English. Lyrics may stay Korean, but the production prompt must not.
- Final production prompt format for Situation-led songs should feel like a short natural pitch, not a technical form. Prefer this hybrid structure:
  A {mood + genre + style} track with {core feel}, set around {story scene and nuance}.
  [Vocals] {sentence-style character vocal direction}
  [Production] {main sound palette with playing feel / story-shaped part ownership / hook movement}
  [Audio quality improved to masterpiece]
- Do not output separate [Atmosphere] or [Arrangement] lines in the final production prompt; fold them into the opening sentence and [Production].

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

${
  hasSituation(params.situation)
    ? `SITUATION SCENARIO (PRIMARY):
Summary: ${buildSituationSummary(params.situation)}
Description: ${params.situation?.description || ""}
Version: ${params.situation?.versionLabel || params.situation?.version || ""}
Development preset: ${params.situation?.developmentPreset || ""}
Development custom: ${params.situation?.developmentCustom || params.situation?.development || ""}
Target A style: ${params.situation?.speakerAStyle || ""}
Target A attitude: ${params.situation?.speakerAAttitude || params.situation?.attitudeA || ""}
Target B style: ${params.situation?.speakerBStyle || ""}
Target B attitude: ${params.situation?.speakerBAttitude || params.situation?.attitudeB || ""}
Detail presets: ${(params.situation?.detailPresets || []).join(", ")}
Detail custom: ${params.situation?.detailCustom || params.situation?.details || ""}`
    : ""
}

${
  (params.themes ?? []).length > 0
    ? `THEME / STORY CONCEPT (FALLBACK WHEN NO SITUATION):
${themePrompt}
Expanded story direction: ${themeSentence}`
    : ""
}

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
  "title": "Title text following the selected title language rule above"${
    params.isNoLyrics
      ? ""
      : `,
  "lyrics": { "english": "Full lyrics in the selected non-Korean language, or empty if no non-Korean language is selected.", "korean": "Full Korean lyrics, or empty if Korean is not selected." }`
  }
}

TITLE RULES (CRITICAL):


- Generate title(s) ONLY in the selected lyric language(s).
- If two title languages are selected, they MUST be independent titles, NOT direct translations of each other.
- They should share the same vibe, theme, and genre of the song.
- Avoid feeling like a literal translation; they should sound natural in their respective languages.
- Tone should match (e.g., both sophisticated, both playful, both dark).
- The title must contain ONLY the song title itself.
- DO NOT include genre, style, production terms, era, nationality, or descriptors.
- DO NOT include words taken from STYLE such as: "Traditional Korean Fusion", "Gugak-pop", "New Jack Swing", "City Pop", "K-pop", "J-pop", "ballad pacing", "global pop approach", etc.
- DO NOT include words taken from STYLE such as: "K-pop", "City Pop", etc.
- If the user described a concrete listening scene such as studying in a reading room/library, the title should reflect that quiet everyday scene, not a random unrelated emotional phrase.
- The genre label will be attached later by the app, so return the title body only.
- Format must follow the selected title language rule above.
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

${
  params.isNoLyrics
    ? "LYRICS RULE (MANDATORY):\n- DO NOT generate any lyrics. The user requested an instrumental-only track or a track without lyrics.\n- Omit the 'lyrics' field from the JSON output."
    : `Lyrics rules:
${lyricGuidancePrompt}

[ANTI-TEMPLATE RULE]
- Same keywords must still produce a different attempt angle each generation. Never treat selected buttons as a fixed lyric/prompt template.
- Do not use a fixed duet template. The singer who owns Verse 1, Pre-Chorus, Chorus, Bridge, Final Chorus, and Outro must change according to genre and situation.
- If the previous section was A→B, the next lyrical section should not automatically repeat A→B. Change ownership, interruption timing, solo focus, or hook function.
- The goal is a different dramatic song design, not only different words.
- The same keywords may keep the same characters and mood, but the vocal part distribution must vary: who opens, who owns the hook, who interrupts, who disappears, who returns, and whether the chorus is solo/together/echo/call-response should not be fixed.

[LYRIC TAGGING RULES]
- Keep all tags short. Tags guide singing; they are not prose.
- MANDATORY multi-speaker rule: [] means structure/speaker tags, () means ad-libs only.
- If there are two actual vocalists, every sung line block must be preceded by a bracket speaker tag: [Role: gender, short style].
- Do not use (Role) at the start of lyric lines; convert it to [Role: gender, short style].
- Solo songs: do NOT repeat [Female Vocal] or [Male Vocal] every section when the prompt already defines the vocal identity.
- Solo section tags must include short performance/emotion tags, e.g. [Verse 1: low, intimate], [Chorus: clear hook, aching].
- Use short inline performance tags only for specific lines: [whisper], [held breath], [tremble], [open voice].
- Use parentheses for short ad-libs, breath, inner thoughts, or rhythm points. Keep ad-libs sparse, 0-2 per section.
- Situation target A/B are story roles, NOT automatic duet singers. The actual singer count and gender MUST follow the Vocal menu.
- Solo vocal + two targets: write one singer narrating/addressing the other; do NOT create alternating role vocal tags.
- Duo/group vocal + two targets: use separated role vocal tags under the section tag. Include gender and the selected speaker style/attitude in EVERY speaker tag, e.g. [40대 엄마: female, worried nagging, spoken], [10대 아들: male, blunt defensive, spoken].
- If Target A/B speech style or attitude is provided, it is mandatory: reflect it in both the [Vocals] line concept and the lyric speaker tags.
- User-provided style/attitude text is source material, not final wording. Interpret it into natural character behavior and short singable tags.
- Final prompt sentences should sound like a producer directing a real singer; lyric tags should stay compact and musical.
- NEVER write speaker names in parentheses such as (40대 엄마), (10대 아들), (상사), (직원). Parentheses are ONLY for ad-libs, breath, SFX, inner thoughts, or short reactions.
- NEVER merge speaker identity into a section tag such as [Verse 1: 40대 엄마, male main spoken]. Keep section tags and speaker tags separate.
- Correct multi-speaker format:
  [Verse 1: short dialogue]
  [40대 엄마: female, worried, spoken]
  ...
  [10대 아들: male, blunt, spoken]
  ...
- Chorus ownership is flexible. A chorus can be solo-led, duet-led, echo-led, together-led, or call-response depending on the chosen section ownership map. Examples:
  [Chorus: ghost-led hook]
  [귀신: female, pleading]
  ...
  [저승사자: male, dry interruption]
  ...

  [Chorus: boss-led hook]
  [직장상사: male, pressing]
  ...
  [MZ사원: female, short ad-lib]
  (...)

  [Chorus: together hook]
  [Together: short hook]
  ...
- For actual duo/group conflict songs, do NOT collapse both characters into one generic narrator. However, do NOT force every section to alternate A/B line by line. Use speaker tags only where that speaker actually owns or interrupts that part.
- Do NOT default every chorus to A/B/A/B dialogue. [Chorus: Together], [Chorus: A-led hook], [Chorus: B-led hook], [Chorus: echo hook], or [Chorus: call-response hook] are all allowed when they fit the genre and ownership map.
- When a section is call-response, keep each role block short, usually 2-4 lines. When a section is solo-led, one speaker may own the full section with only short interruptions or ad-libs from the other.
- Avoid blended vocals when Arrangement says separated dialogue or call-response.
- In custom structures, do not drop speaker tags in Chorus, Hook, Rap Verse, Breakdown, Bridge, or Outro when they contain lyrics.
- One line must not contain two speaker tags. Split them into separate lines/blocks.
- Use the A→B pattern ONLY for sections explicitly chosen as call-response. Other sections may be A-only, B-only, Together-only, echo-style, interruption-style, or one speaker with the other appearing only as an ad-lib.
- Avoid long tag explanations; keep tags short and musical.
- Keep English around 10% or less, mostly as short ad-libs or rhythm points.


[PART OWNERSHIP / SONG ARCHITECTURE RULES]
- CRITICAL: Multi-speaker does NOT mean every section must be a back-and-forth dialogue. First decide the part ownership of the song, then place speaker tags only where needed.
- This is NOT just dialogue alternation. Decide who owns each musical part differently for each song.
- Before writing lyrics, silently choose ONE section ownership map based on Genre + Situation version + development feeling. Do NOT show the map.
- Never reuse the same ownership formula across all genres. A ballad, city pop, funk, rap, trot, EDM, and gugak fusion song must distribute vocal parts differently.
- The selected genre must affect part ownership:
  - Ballad/R&B: one voice may own emotional verses; the other appears as memory, answer, or late confession.
  - City pop/Funk: hook and chorus may be stylish call-response, but they can also be one-speaker hooks with short echo/ad-lib replies; verses can be solo monologue, interruption, or trade.
  - Rap/Hip-hop: Rap Verse can be a battle, relay, or one-sided rant; do not force polite A/B alternation.
  - Trot/Gugak/Fusion: one role can narrate or command while the other answers with traditional/formal phrasing.
  - EDM/Drop: Drop can be ad-lib/hook-driven, but if lyrics appear, keep role identity in short bursts.
- Possible section ownership maps:
  1) A-led pursuit: A owns Verse 1; B cuts in at Hook; Chorus becomes a chase.
  2) B-led complaint: B owns Verse 1; A answers later; Bridge exposes A's weakness.
  3) Interruption map: one role begins each section, the other interrupts after 1-2 lines.
  4) Trade/negotiation map: A and B exchange short offers/refusals; one section becomes a solo complaint.
  5) Parallel monologue map: A and B get separate short monologues, then clash in Hook or Chorus.
  6) Reversal map: the confident role loses control in Bridge, Breakdown, or Final Chorus.
  7) Unresolved map: no reconciliation; keep emotional distance through the Outro.
  8) Chorus-takeover map: the chorus is owned mostly by one role, while the other only interrupts with short lines/ad-libs.
  9) Echo map: one role sings full lines while the other echoes, corrects, or undercuts them.
- Do NOT always use: Verse A→B, Pre-Chorus softening, Chorus A/B/A/B, Bridge reconciliation, Final Chorus resolution.
- Do NOT make every lyrical section contain both speakers. Some sections may be A-only, B-only, echo-only, or Together-only if it fits the map.
- Bridge must not always be empathy or reconciliation. It can be interruption, reveal, refusal, reversal, silence, parallel monologue, or comic failure.
- Final Chorus must not always resolve the conflict. It can stay comic, bitter, awkward, one-sided, or unresolved if the Situation version supports it.
- Custom structures: preserve the user's section order, but assign a different owner/function to each section. Do not repeat the same A/B block order in Verse, Pre-Chorus, Chorus, Bridge, and Final Chorus.
- Chorus/Hook must not always be balanced call-response. It can be A-dominant, B-dominant, echo style, one-line interruptions, full Together hook, solo emotional hook, or short punchline hook depending on the chosen map.
- Across generations with the same keywords, vary chorus ownership: female-only, male-only, together, A-led with B ad-libs, B-led with A interruptions, echo/correction, call-response, rap relay, or refrain-only are all valid.
- Never assume the chorus should be one sentence from A then one sentence from B repeatedly.

[STRICT PART DIVERSITY RULES]
- CRITICAL: Do not design the song as a dialogue template. Design it as a song with changing part ownership.
- A multi-speaker song can have many valid part architectures. Use only ONE or TWO dialogue-heavy sections unless the user explicitly asked for full musical-theater dialogue.
- At least two lyrical sections should be owned mostly by one speaker, by Together, or by echo/ad-lib structure instead of balanced A/B exchange.
- The chorus must choose ONE function, not the same A/B line-trading every time:
  1) A solo hook, B only ad-libs
  2) B solo hook, A only interrupts once
  3) Together hook only
  4) A hook + B echo/correction
  5) B hook + A spoken undercut
  6) Rap relay hook
  7) Refrain-only hook with no speaker split
  8) True call-response hook
- Do not use true call-response in more than one major hook section unless the selected development feeling specifically asks for it.
- Vary section ownership across the whole song. Examples of valid distributions:
  A) Verse 1=A solo, Pre-Chorus=Together, Chorus=B solo hook, Verse 2=B solo, Bridge=A interruption, Final Chorus=Together.
  B) Verse 1=B solo, Hook=A short cut-in, Chorus=Together, Verse 2=A solo, Bridge=parallel monologue, Final Chorus=B solo.
  C) Verse 1=A interrupted by B, Pre-Chorus=A solo, Chorus=A-led with B ad-libs, Verse 2=B rant, Bridge=unresolved silence, Outro=A punchline.
  D) Verse 1=parallel monologues, Chorus=refrain-only, Verse 2=rap relay, Bridge=late reveal, Final Chorus=echo/correction.
- Do not make Verse 1, Verse 2, Pre-Chorus, Chorus, Bridge, and Final Chorus all contain both speakers.
- Do not make both characters appear in the same order in every section.
- If the song has a genre with strong vocal conventions, follow that genre's part logic before dialogue symmetry: ballad can be solo emotional hook, funk can be ad-lib undercut, rap can be relay/battle, trot can be one main singer with spoken replies, EDM can use refrain/drop fragments.
- The goal is dozens of possible structures, not a stable template. Same selected keywords should create a different part architecture each generation.

[PRONUNCIATION DESIGN]
- Write lyrics as singable spoken language, not prose.
- Chorus and high-emotion lines should prefer open vowels and fewer heavy final consonants.
- Rap/groove sections should use short rhythmic phrases and crisp consonant energy.
- Do not intentionally misspell Korean to force pronunciation.
- Use short English ad-libs as breath or punchline points only.

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
- If custom structure mode is selected, keep the exact custom section order, but apply the Situation to every lyrical section.
- For custom Chorus, Hook, Rap Verse, Bridge, Verse, Pre-Chorus, Final Chorus, and Outro sections, keep the characters, relationship, speech style, and conflict active.
- Do not let custom Chorus/Hook/Rap sections become generic slogan lyrics. They must still sound like the selected Situation.
- For duo/group Situation songs, custom Chorus/Hook/Rap Verse sections must keep role identity, but they must NOT always use call-response. They can be solo-led, echo-led, together-led, interruption-led, relay, or call-response depending on the chosen ownership map.
- Instrumental, Solo, Drop, and Break sections may be mostly musical. If lyrics/ad-libs appear there, keep them short and tied to the same Situation.
- If a section has tags such as Rap, Group, Minimal, Build-up, Instrumental, Soft, Big, or Adlib, the writing should support that musical role without replacing the story.
- For multi-speaker songs, do not give Verse 1, Verse 2, Bridge, and Final Chorus the same speaker order. Rotate section ownership naturally.
- A chorus can be led by one speaker with the other interrupting, not always equal A/B alternation.
- A verse can be mostly one speaker if the other interrupts briefly; this is different from a full duet block.
- Respect the selected lyricsLength strictly.
- Respect the selected song structure strictly.
- Do not drift longer than the requested lyric size.
- Do not invent a new structure that conflicts with the locked blueprint.`
}
${params.specialPrompt ? `- SPECIAL INSTRUCTION: ${params.specialPrompt}` : ""}
`.trim();

  const ai = getAI();
  let response;

  const generateParams = {
    model,
    contents:
      "Generate the song title and lyrics based on the locked instructions.",
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
      console.warn(
        "Primary model quota exhausted, trying fallback model (gemini-2.5-flash-lite)...",
      );
      try {
        response = await ai.models.generateContent({
          ...generateParams,
          model: "gemini-2.5-flash-lite",
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
  const subGenreIds = (params.subGenre ?? []).map((id) => id.toLowerCase());
  const genreId = (params.genre || "").toLowerCase();

  let genreTag = "";
  const keywordsToRemove = new Set([
    "k-pop",
    "kpop",
    "j-pop",
    "jpop",
    "hip hop",
    "hiphop",
    "r&b",
    "rnb",
    "edm",
    "pop",
    "rock",
    "jazz",
    "ballad",
    "trot",
    "dance",
    "synth",
    "indie",
    "folk",
    "metal",
    "drill",
    "trap",
    "lo-fi",
    "lofi",
    "g-funk",
    "gfunk",
    "traditional korean fusion",
    "gugak-pop",
    "new jack swing",
    "city pop",
    "ballad pacing",
    "global pop approach",
    "korean idol production style",
    "japanese style",
    "fusion",
    "style",
    "production",
    "groove",
    "pacing",
  ]);

  const addVariations = (label: string) => {
    if (!label) return;
    const l = label.toLowerCase();
    keywordsToRemove.add(l);

    const prefixes = [
      "k ",
      "j ",
      "k-",
      "j-",
      "90s ",
      "80s ",
      "70s ",
      "modern ",
      "korean ",
      "japanese ",
      "retro ",
      "classic ",
      "neo ",
      "new ",
      "old school ",
      "old-school ",
      "style ",
      "production ",
      "korean idol production style ",
      "japanese idol production style ",
      "idol production style ",
    ];
    prefixes.forEach((p) => {
      keywordsToRemove.add((p + l).toLowerCase());
    });

    const parts = l.split(/\s+/);
    if (parts.length > 1) {
      parts.forEach((part) => {
        if (part.length > 2) keywordsToRemove.add(part);
      });
    }
  };

  if (subGenreIds.length > 0) {
    const subGenreMeta = GENRES.find((g) => g.id === subGenreIds[0]);
    genreTag = subGenreMeta?.label ?? sentenceCase(subGenreIds[0]);
    if (subGenreMeta) {
      addVariations(subGenreMeta.label);
      if (subGenreMeta.labelKo)
        keywordsToRemove.add(subGenreMeta.labelKo.toLowerCase());
    }
  } else if (genreId) {
    const genreMeta = GENRES.find((g) => g.id === genreId);
    genreTag = genreMeta?.label ?? sentenceCase(genreId);
    if (genreMeta) {
      addVariations(genreMeta.label);
      if (genreMeta.labelKo)
        keywordsToRemove.add(genreMeta.labelKo.toLowerCase());
    }
  } else {
    const freeTextForTitle =
      typeof params.userInput === "string" ? params.userInput.trim() : "";
    if (freeTextForTitle) {
      const profile = buildFreeTextDirectorProfile(
        sanitizeUserInput(freeTextForTitle),
      );
      const inferredGenre = (profile.genre || "")
        .replace(/,\s*(slow|fast|mid)-?tempo feel/gi, "")
        .split(" with ")[0]
        .split(",")[0]
        .trim();
      genreTag =
        inferredGenre &&
        !/free-text direction|contemporary pop/i.test(inferredGenre)
          ? inferredGenre
          : "Song";
    } else {
      genreTag = "Song";
    }
  }

  addVariations(genreTag);

  if (typeof result.title === "string") {
    let rawTitle = result.title.trim();

    // 1. Remove any existing [Genre] tag from the AI
    rawTitle = rawTitle.replace(/^\[[^\]]+\]\s*/, "");

    // 2. Try to extract quoted pair: 'Korean' │ 'Foreign' or "Korean" | "Foreign"
    const quotePairRegex = /['"]([^'"]+)['"]\s*[│|]\s*['"]([^'"]+)['"]/;
    const match = rawTitle.match(quotePairRegex);

    if (match) {
      const firstTitle = match[1].trim();
      const secondTitle = match[2].trim();
      result.koreanTitle = hasKoreanLanguage ? firstTitle : "";
      result.englishTitle = hasSecondaryLanguage
        ? hasKoreanLanguage
          ? secondTitle
          : firstTitle
        : "";
      const titleParts = [
        hasKoreanLanguage ? result.koreanTitle : "",
        hasSecondaryLanguage ? result.englishTitle : "",
      ].filter(Boolean);
      result.title =
        titleParts.length > 1
          ? `[${genreTag}] '${titleParts[0]}' | '${titleParts[1]}'`
          : `[${genreTag}] '${titleParts[0] || firstTitle}'`;
    } else {
      // 3. Fallback: Aggressive cleaning
      let title = rawTitle;
      let changed = true;
      while (changed) {
        changed = false;
        const sortedKeywords = Array.from(keywordsToRemove)
          .filter(Boolean)
          .map((kw) => kw.trim())
          .filter((kw) => kw.length > 0)
          .sort((a, b) => b.length - a.length);

        for (const kw of sortedKeywords) {
          const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(
            `^${escapedKw}(?=[\\s'\"│\\-\\:]|$)\\s*[\\-\\s\\:]*`,
            "i",
          );
          if (regex.test(title)) {
            title = title.replace(regex, "").trim();
            changed = true;
            break;
          }
        }
      }

      // 4. Ensure it has a separator and is quoted
      if (title.includes("│") || title.includes("|")) {
        const parts = title
          .split(/[│|]/)
          .map((p) => p.trim().replace(/^['"]+|['"]+$/g, ""));
        const first = parts[0] || "Untitled";
        const second = parts[1] || "무제";
        result.koreanTitle = hasKoreanLanguage ? first : "";
        result.englishTitle = hasSecondaryLanguage
          ? hasKoreanLanguage
            ? second
            : first
          : "";
        const titleParts = [
          hasKoreanLanguage ? result.koreanTitle : "",
          hasSecondaryLanguage ? result.englishTitle : "",
        ].filter(Boolean);
        result.title =
          titleParts.length > 1
            ? `[${genreTag}] '${titleParts[0]}' | '${titleParts[1]}'`
            : `[${genreTag}] '${titleParts[0] || first}'`;
      } else {
        const cleanTitle = title.replace(/^['"]+|['"]+$/g, "");
        result.englishTitle = hasSecondaryLanguage
          ? cleanTitle || "Untitled"
          : "";
        result.koreanTitle = hasKoreanLanguage ? cleanTitle || "무제" : "";
        result.title = `[${genreTag}] '${cleanTitle || (hasKoreanLanguage ? "무제" : "Untitled")}'`;
      }
    }
  } else {
    result.englishTitle = hasSecondaryLanguage ? "Untitled" : "";
    result.koreanTitle = hasKoreanLanguage ? "무제" : "";
    const fallbackParts = [result.koreanTitle, result.englishTitle].filter(
      Boolean,
    );
    result.title =
      fallbackParts.length > 1
        ? `[${genreTag}] '${fallbackParts[0]}' | '${fallbackParts[1]}'`
        : `[${genreTag}] '${fallbackParts[0] || "Untitled"}'`;
  }

  // Ensure lyrics object and properties exist
  if (!result.lyrics || typeof result.lyrics !== "object") {
    result.lyrics = { english: "", korean: "" };
  } else {
    result.lyrics.english =
      typeof result.lyrics.english === "string" ? result.lyrics.english : "";
    result.lyrics.korean =
      typeof result.lyrics.korean === "string" ? result.lyrics.korean : "";
  }

  if (params.isNoLyrics) {
    result.lyrics = { english: "", korean: "" };
  } else {
    if (!requestedLyricLanguages.includes("ko")) result.lyrics.korean = "";
    if (!requestedLyricLanguages.some((lang) => lang !== "ko"))
      result.lyrics.english = "";
  }

  if (shouldUseMixedLyrics && !params.isNoLyrics) {
    result.lyrics = enforceKpopMixedLyrics(result.lyrics);
  }

  result.prompt = finalPrompt;
  result.situationSummary = buildSituationSummary(params.situation);
  result.appliedKeywords = {
    ...buildAppliedKeywordPayload(params, resolvedStructure),
    genre: params.genre ? [params.genre] : [],
    subGenre: params.subGenre ?? [],
    mood: params.moods ?? [],
    theme: params.themes ?? [],
    situation: params.situation,
    situationSummary: buildSituationSummary(params.situation),
    style: params.styles ?? [],
    instrumentSound: params.instrumentSounds ?? [],
    tempo: params.tempo,
    kpopMode: params.kpopMode ?? 0,
    lyricLanguages: requestedLyricLanguages as any,
    titleLanguages: requestedLyricLanguages as any,
    secondaryLanguage: secondaryLanguage as any,
    isNoLyrics: params.isNoLyrics as any,
  } as any;

  return result as SongResult;
}

export async function translateLyrics(
  lyrics: string,
  targetLanguage: "korean" | "english" | string,
): Promise<string> {
  const model: string = "gemini-3-flash-preview";

  const systemInstruction = `
You are a professional lyricist and translator.
Translate the provided text into ${targetLanguage}.
- Maintain the original structure and line breaks when the input is lyrics.
- If the input is a title, return one short natural title only.
- Do not translate literally. Keep it natural and lyrical.
- Return only the translated text.
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
          model: "gemini-2.5-flash-lite",
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
