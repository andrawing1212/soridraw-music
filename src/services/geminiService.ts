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
        labelKo: found.labelKo,
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
    .map((value) => {
      const item = resolveInstrumentSoundItem(value);
      return item?.promptCore ?? item?.label ?? sentenceCase(value);
    })
    .filter(NON_EMPTY);
}
function resolveMoodValue(moodValue: string): string {
  const normalized = moodValue.trim().toLowerCase();

  const mood = MOODS.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized
  );

  if (!mood) return moodValue;
  return mood.promptCore ?? mood.label;
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
  let userStyleLabel = "";
  if (selectedStyleIds.length > 0) {
    const styleItem = resolveStyleItem(selectedStyleIds[0]);
    if (styleItem) {
      userStyleLabel = styleItem.label;
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
  if (userStyleLabel) {
    stylePart = `${userStyleLabel} influenced ${genreStyle}`;
  }
  
  const bpmPart = tempoText ? `, ${tempoText} BPM` : "";

  return `STYLE: ${stylePart}${bpmPart}`;
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

  const limitedSounds = finalSoundLabels.slice(0, 6);
  return `SOUND: ${limitedSounds.join(", ")}`;
}

function buildMoodTexture(params: GenerateSongParams): string {
  const moods = params.moods ?? [];

  const moodValues = moods
    .slice(0, 6)
    .map((mood) => resolveMoodValue(mood))
    .filter(Boolean);

  const moodValue = moodValues.length > 0
    ? moodValues.join(", ")
    : "Balanced";

  const selectedStyleIds = params.styles ?? [];
  let textureDesc = "clear and polished";

  if (selectedStyleIds.length > 0) {
    const styleItem = resolveStyleItem(selectedStyleIds[0]);
    if (styleItem && styleItem.promptCore) {
      textureDesc = styleItem.promptCore
        .replace(/^Style layer:\s*/i, "")
        .trim();
    }
  }

  return `MOOD & TEXTURE: ${moodValue}, ${textureDesc}`;
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
  let flow = "dynamic progression with clear sectional contrast";

  if (genreId === "drill") flow = "cold and sparse with hard-hitting rhythmic shifts";
  if (genreId?.includes("jazz")) flow = "fluid and groove-led with organic transitions";
  if (genreId?.includes("ballad")) flow = "gradual emotional build-up towards a powerful climax";

  return `ARRANGEMENT: ${flow}`;
}

function buildTheme(params: GenerateSongParams): string {
  const themeSentence = buildThemeSentence(params.themes ?? []);
  return `THEME: ${themeSentence}`;
}

function buildFinalPrompt(params: GenerateSongParams, resolvedStructure: SongStructure): string {
  const sections = [
    { label: "STYLE", content: buildStyle(params) },
    { label: "SOUND", content: buildSound(params) },
    { label: "MOOD & TEXTURE", content: buildMoodTexture(params) },
    { label: "VOCAL", content: buildVocal(params) },
    { label: "ARRANGEMENT", content: buildArrangement(params, resolvedStructure) },
    { label: "THEME", content: buildTheme(params) },
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
  "title": "[Genre] 'English Title'│'Korean Title'",
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

  // Title Post-processing
  const subGenreIds = (params.subGenre ?? []).map(id => id.toLowerCase());
  const genreId = (params.genre || "").toLowerCase();
  
  let genreTag = "";
  const keywordsToRemove = new Set([
    "k-pop", "kpop", "j-pop", "jpop", "hip hop", "hiphop", "r&b", "rnb", "edm", "pop", "rock", "jazz", "ballad", "trot", "dance", "synth", "indie", "folk", "metal", "drill", "trap", "lo-fi", "lofi", "g-funk", "gfunk"
  ]);

  if (subGenreIds.length > 0) {
    const subGenreMeta = GENRES.find(g => g.id === subGenreIds[0]);
    genreTag = subGenreMeta?.label ?? sentenceCase(subGenreIds[0]);
    if (subGenreMeta) {
      keywordsToRemove.add(subGenreMeta.label.toLowerCase());
      if (subGenreMeta.labelKo) keywordsToRemove.add(subGenreMeta.labelKo.toLowerCase());
    }
  } else if (genreId) {
    const genreMeta = GENRES.find(g => g.id === genreId);
    genreTag = genreMeta?.label ?? sentenceCase(genreId);
    if (genreMeta) {
      keywordsToRemove.add(genreMeta.label.toLowerCase());
      if (genreMeta.labelKo) keywordsToRemove.add(genreMeta.labelKo.toLowerCase());
    }
  } else {
    genreTag = "Song";
  }
  keywordsToRemove.add(genreTag.toLowerCase());

  if (typeof result.title === "string") {
    let title = result.title.trim();
    
    // 1. Remove any existing [Genre] tag from the AI
    title = title.replace(/^\[[^\]]+\]\s*/, "");
    
    // 2. Remove leading genre keywords (case-insensitive)
    let changed = true;
    while (changed) {
      changed = false;
      const sortedKeywords = Array.from(keywordsToRemove).filter(Boolean).sort((a, b) => b.length - a.length);
      for (const kw of sortedKeywords) {
        const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match keyword at the start, followed by space or punctuation or quote
        const regex = new RegExp(`^${escapedKw}(?=[\\s'\"│\\-]|$)\\s*[\\-\\s]*`, "i");
        if (regex.test(title)) {
          title = title.replace(regex, "").trim();
          changed = true;
          break;
        }
      }
    }
    
    // 3. Ensure the title has spaces around │ and is properly quoted if possible
    if (title.includes("│")) {
      const parts = title.split("│").map(p => p.trim());
      title = parts.join(" │ ");
    }
    
    // 4. Final assembly
    result.title = `[${genreTag}] ${title}`;
  } else {
    result.title = `[${genreTag}] 'Untitled' │ '무제'`;
  }

  // Ensure lyrics object and properties exist
  if (!result.lyrics || typeof result.lyrics !== 'object') {
    result.lyrics = { english: "", korean: "" };
  } else {
    result.lyrics.english = typeof result.lyrics.english === 'string' ? result.lyrics.english : "";
    result.lyrics.korean = typeof result.lyrics.korean === 'string' ? result.lyrics.korean : "";
  }

  if (shouldUseMixedLyrics) {
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
  };

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
