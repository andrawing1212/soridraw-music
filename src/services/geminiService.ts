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
  isMixedLyrics?: boolean;
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

function buildVocalPrompt(vocal: VocalConfig): string {
  const lines: string[] = [];
  const male = vocal.male ?? 0;
  const female = vocal.female ?? 0;
  const total = male + female;

  if (total <= 1) lines.push("Vocal formation: solo.");
  else if (total === 2) lines.push("Vocal formation: duo.");
  else lines.push("Vocal formation: group ensemble.");

  if (male > 0 && female > 0) {
    lines.push(`Vocal gender mix: ${male} male and ${female} female.`);
  } else if (male > 0) {
    lines.push(`Use male vocals only (${male}). Do not use female vocals.`);
  } else if (female > 0) {
    lines.push(`Use female vocals only (${female}). Do not use male vocals.`);
  } else {
    lines.push("No strong gender restriction; default to the arrangement that best fits the request.");
  }

  lines.push(vocal.rap ? "Rap is included." : "Do not include rap unless the user explicitly asks for it.");

  return lines.join(" ");
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
      isMixedLyrics: first.isMixedLyrics ?? false,
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
    isMixedLyrics: false,
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
  const instrumentSounds = getInstrumentSoundLabels(params.instrumentSounds ?? []);
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

function buildStyle(params: GenerateSongParams): string {
  const genreMeta = getGenreMeta(params.genre);
  const genreLabel = genreMeta?.label ?? (params.genre ? sentenceCase(params.genre) : "Pop");
  const subGenreIds = params.subGenre ?? [];
  const genreId = (params.genre || "pop").toLowerCase();

  console.log("SUB GENRE IDS:", params.subGenre);
  console.log("SUB GENRE DATA:", subGenreIds.map(id => SUB_GENRE_PROMPTS[id]));

  const selectedStyleIds = (params.styles ?? []).slice(0, 3);

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

  const processedStyles: string[] = [];

  selectedStyleIds.forEach((styleId, index) => {
    const styleItem = resolveStyleItem(styleId);
    if (!styleItem) return;

    const compatibleStyles = COMPATIBLE_MAP[genreId] || [];
    const semiCompatibleStyles = SEMI_COMPATIBLE_MAP[genreId] || [];

    const isCompatible = compatibleStyles.includes(styleId);
    const isSemiCompatible = semiCompatibleStyles.includes(styleId);

    let label = styleItem.label;

    if (index === 0) {
      if (isSemiCompatible) {
        label = `${label} influence`;
      } else if (!isCompatible && !isSemiCompatible) {
        label = `${label} influence`;
      }
    } else {
      if (!isCompatible) {
        label = `${label} influence`;
      }
    }

    processedStyles.push(label);
  });

    const tempoText = params.tempo
      ? params.tempo.replace(/^Between\s+/i, "").replace(/^Exactly\s+/i, "").replace(/\s+and\s+/i, "–")
      : "";

  const mid = MID_GENRE_PROMPTS[genreId];
  const subGenreStyleLayers = subGenreIds
    .map((id) => SUB_GENRE_PROMPTS[id]?.style)
    .filter(NON_EMPTY);

  const parts = [
    ...subGenreStyleLayers,      // 🔥 1순위: 소분류 스타일
    mid?.style || genreLabel,    // 2순위: 중분류 스타일
    ...processedStyles,          // 3순위: 기타 스타일
  ].filter(NON_EMPTY);

  if (tempoText) parts.push(tempoText);

  return `·STYLE: ${parts.join(", ")}`;
}

function buildSound(params: GenerateSongParams): string {
  const selected = getInstrumentSoundLabels(params.instrumentSounds ?? []);
  const genreId = (params.genre || "pop").toLowerCase();
  const moods = (params.moods ?? []).map((m) => m.toLowerCase());
  const subGenreIds = params.subGenre ?? [];

  console.log("SUB GENRE IDS:", params.subGenre);
  console.log("SUB GENRE DATA:", subGenreIds.map(id => SUB_GENRE_PROMPTS[id]));

  const GENRE_BASE: Record<string, string[]> = {
    drill: ["sparse drill drums", "heavy 808 bass"],
    trap: ["tight trap drums", "deep 808 bass"],
    "piano-ballad": ["soft piano-led melody", "restrained drums"],
    "lofi-hiphop": ["soft lofi drums", "warm bass"],
    kpop: ["polished synth", "punchy drums"],
    rnb: ["smooth keys", "warm bass"],
    pop: ["modern synth", "clean drums"],
    "acid-jazz": ["electric piano", "jazz groove"],
    "cool-jazz": ["soft trumpet", "brushed drums"],
    ballad: ["warm strings", "soft piano"],
  };

  const TEXTURE_MAP: Record<string, string> = {
    drill: "cold synth texture",
    trap: "polished digital texture",
    ballad: "warm acoustic texture",
    "piano-ballad": "soft felt-piano texture",
    pop: "bright modern texture",
    jazz: "organic vintage texture",
    rock: "raw gritty texture",
    rnb: "smooth velvet texture",
    electronic: "glitchy ambient texture",
    "lofi-hiphop": "dusty lofi texture",
    default: "clean balanced texture"
  };

  const SPACE_MAP: Record<string, string> = {
    emotional: "spacious reverb",
    dark: "tight negative space",
    dreamy: "ethereal atmosphere",
    calm: "intimate dry space",
    tense: "claustrophobic pressure",
    energetic: "wide stereo field",
    sad: "isolated hollow space",
    happy: "open airy space",
    nostalgic: "warm analog space",
    default: "natural acoustic space"
  };

  let result: string[] = [...selected];
  const mid = MID_GENRE_PROMPTS[genreId];

  const isSoftTone =
    genreId.includes("ballad") ||
    moods.includes("emotional") ||
    moods.includes("calm") ||
    moods.includes("sad");
  const isCleanTone = moods.includes("energetic") || moods.includes("happy");

  if (isSoftTone) {
    result = result.map((s) => {
      const lower = s.toLowerCase();
      if ((lower.includes("808") || lower.includes("heavy") || lower.includes("bass")) && !lower.includes("soft")) {
        return `soft ${s}`;
      }
      return s;
    });
  } else if (isCleanTone) {
    result = result.map((s) => {
      const lower = s.toLowerCase();
      if (lower.includes("heavy bass") && !lower.includes("clean")) {
        return `clean ${s}`;
      }
      return s;
    });
  }

  const baseSounds = GENRE_BASE[genreId] || [];
  const hasCategory = (cat: string) => result.some((s) => s.toLowerCase().includes(cat));

  for (const sound of baseSounds) {
    const lowerSound = sound.toLowerCase();
    const isDrum = lowerSound.includes("drums") || lowerSound.includes("rhythm");
    const isBass = lowerSound.includes("bass") || lowerSound.includes("808");

    if (isDrum && !hasCategory("drum") && !hasCategory("hi-hat") && !hasCategory("percussion") && !hasCategory("rhythm")) {
      result.push(sound);
    } else if (isBass && !hasCategory("bass") && !hasCategory("808")) {
      result.push(sound);
    }
  }

  const texture = TEXTURE_MAP[genreId] || Object.entries(TEXTURE_MAP).find(([k]) => genreId.includes(k))?.[1] || TEXTURE_MAP.default;
  const space = SPACE_MAP[moods[0]] || SPACE_MAP.default;

  result.push(texture);
  result.push(`with ${space}`);

  const subGenreSoundLayers = subGenreIds
    .map((id) => SUB_GENRE_PROMPTS[id]?.sound)
    .filter(NON_EMPTY);

  // Reconstruct result to ensure priority: Sub-genre > Mid-genre > Base > Selected
  const prioritizedResult: string[] = [
    ...subGenreSoundLayers,
  ];

  if (mid?.sound) {
    prioritizedResult.push(mid.sound);
  }

  // Add base sounds if not already covered
  for (const sound of baseSounds) {
    const lowerSound = sound.toLowerCase();
    const isDrum = lowerSound.includes("drums") || lowerSound.includes("rhythm");
    const isBass = lowerSound.includes("bass") || lowerSound.includes("808");

    const hasCategoryInResult = (cat: string) => prioritizedResult.some((s) => s.toLowerCase().includes(cat));

    if (isDrum && !hasCategoryInResult("drum") && !hasCategoryInResult("hi-hat") && !hasCategoryInResult("percussion") && !hasCategoryInResult("rhythm")) {
      prioritizedResult.push(sound);
    } else if (isBass && !hasCategoryInResult("bass") && !hasCategoryInResult("808")) {
      prioritizedResult.push(sound);
    }
  }

  // Add selected sounds
  prioritizedResult.push(...result);

  // Add texture and space
  prioritizedResult.push(texture);
  prioritizedResult.push(`with ${space}`);

  const final = Array.from(new Set(prioritizedResult.filter(NON_EMPTY))).slice(0, 8);
  return `·SOUND: ${final.join(", ")}`;
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
  const genreId = (params.genre ?? "pop").toLowerCase();
  const mid = MID_GENRE_PROMPTS[genreId];
  const subGenreIds = params.subGenre ?? [];

  console.log("SUB GENRE IDS:", params.subGenre);
  console.log("SUB GENRE DATA:", subGenreIds.map(id => SUB_GENRE_PROMPTS[id]));

  if (v.male > 0 && v.female > 0) parts.push(`${v.male} male & ${v.female} female vocals`);
  else if (v.male > 0) parts.push(`${v.male === 1 ? "solo male" : `${v.male} male`} vocal`);
  else if (v.female > 0) parts.push(`${v.female === 1 ? "solo female" : `${v.female} female`} vocal`);
  else parts.push("vocal configuration open");

  if (v.rap) parts.push("rap included");

  const moods = (params.moods ?? []).map((m) => m.toLowerCase());

  const DELIVERY_MAP: Record<string, string> = {
    drill: "tight delivery",
    trap: "rhythm-led phrasing",
    ballad: "soft emotional delivery",
    pop: "polished melodic phrasing",
    jazz: "nuanced intimate delivery",
    rock: "powerful raw delivery",
    rnb: "smooth breathy delivery",
    "lofi-hiphop": "laid-back delivery",
    kpop: "polished high-energy delivery",
    default: "natural melodic phrasing"
  };

  const TONE_MAP: Record<string, string> = {
    emotional: "warm tone",
    sad: "fragile tone",
    warm: "warm tone",
    calm: "gentle tone",
    dark: "cold tone",
    bright: "bright tone",
    hopeful: "lifted tone",
    lonely: "airy tone",
    nostalgic: "textured tone",
    dreamy: "dreamy tone",
    tense: "tight tone",
    peaceful: "soft tone",
    default: "natural tone"
  };

  const delivery = DELIVERY_MAP[genreId] || Object.entries(DELIVERY_MAP).find(([k]) => genreId.includes(k))?.[1] || DELIVERY_MAP.default;
  const tone = TONE_MAP[moods[0]] || TONE_MAP.default;

  const subGenreVocalLayers = subGenreIds
    .map((id) => SUB_GENRE_PROMPTS[id]?.vocal)
    .filter(NON_EMPTY);

  parts.push(...subGenreVocalLayers); // 🔥 먼저

  if (mid?.vocal) {
    parts.push(mid.vocal);
  }
  parts.push(delivery);
  parts.push(tone);

  return `·VOCAL: ${parts.join(", ")}`;
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
  const vocalPrompt = buildVocalPrompt(params.vocal ?? { male: 0, female: 0, rap: false });
  const basePromptSeed = BASE_PROMPTS.join("\n");
  const finalPrompt = buildFinalPrompt(params, resolvedStructure);
  console.log("🔥 generateSong called");
  console.log("🔥 FINAL PROMPT:", finalPrompt);
  const exactStructureText = buildStructureText(
    params.songStructure,
    resolvedStructure,
    params.customStructure ?? []
  );

  const shouldUseMixedLyrics = Boolean(params.isMixedLyrics || (params.isKpopSelected && params.kpopMode === 2));

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
