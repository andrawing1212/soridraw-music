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
  englishMixRatio?: number;
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
  isRandomTempo?: boolean;
  tempoSource?: "random" | "manual";
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

function formatTempoForPrompt(tempo?: string | null): string {
  const raw = String(tempo || "").trim();
  if (!raw) return "";

  const formatted = raw
    .replace(/^Between\s+/i, "")
    .replace(/^Exactly\s+/i, "")
    .replace(/\s+and\s+/i, "–")
    .replace(/\s*BPM\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!formatted) return "";
  return /BPM$/i.test(formatted) ? formatted : `${formatted} BPM`;
}

function buildTempoPromptPhrase(
  params: Pick<GenerateSongParams, "tempo" | "isRandomTempo" | "tempoSource">,
): string {
  const tempo = formatTempoForPrompt(params.tempo);
  if (!tempo) return "";

  if (params.tempoSource === "random" || params.isRandomTempo) {
    return `tempo optimized around ${tempo}`;
  }

  return `tempo set to ${tempo}`;
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



type VocalEmotionLine = {
  id: string;
  labelKo: string;
  label: string;
  descriptionKo?: string;
  promptCore: string;
  promptShort: string;
  tag: string;
  roleBias: "main" | "lead" | "rap" | "whisper" | "harmony" | "any";
};

const VOCAL_EMOTION_LINES: VocalEmotionLine[] = [
  { id: "emotion_smiling_hidden_pain", labelKo: "아무렇지 않은 척하지만 속으로 우는", label: "Smiling through pain", descriptionKo: "겉으로는 웃거나 평온해 보이지만, 내면은 슬픔과 상처로 곪아 있어 위태로운 감정 상태.", promptCore: "smiling through pain, crying inside, emotionally wounded underneath", promptShort: "smiling through hidden pain", tag: "hidden pain", roleBias: "main" },
  { id: "emotion_resentful_lingering", labelKo: "원망스럽지만 여전히 미련이 남은", label: "Resentful but still clinging", descriptionKo: "상대가 밉고 화가 나면서도 끝내 다 놓지 못해 마음 한구석에 미련과 그리움이 남아있는 상태.", promptCore: "resentful but still clinging to lingering feelings, angry yet unable to let go", promptShort: "resentful but still longing", tag: "resentful longing", roleBias: "rap" },
  { id: "emotion_resigned_empty", labelKo: "모든 것을 체념하고 텅 빈", label: "Numb and empty", descriptionKo: "슬픔이나 분노마저 다 지나가 버려 어떤 기대나 희망도 없이 무감각하고 공허해진 상태.", promptCore: "completely resigned, numb and empty inside, no hope left", promptShort: "numb and resigned", tag: "numb", roleBias: "lead" },
  { id: "emotion_too_exhausted_to_anger", labelKo: "화낼 기력조차 없이 지쳐버린", label: "Too exhausted to be angry", descriptionKo: "화가 나고 억울하지만 감정을 너무 많이 소모해서 더 이상 따질 힘조차 남아있지 않은 상태.", promptCore: "too exhausted to be angry, emotionally drained, no strength left to fight", promptShort: "exhausted beyond anger", tag: "drained", roleBias: "lead" },
  { id: "emotion_pushing_away_fear", labelKo: "상처받을까 두려워 먼저 차갑게 밀어내는", label: "Pushing away out of fear", descriptionKo: "다가가고 싶지만 또 상처받는 것이 두려워 자기방어적으로 선을 긋고 냉정하게 구는 상태.", promptCore: "pushing away out of fear of getting hurt, guarded longing, defensive coldness", promptShort: "pushing away out of fear", tag: "guarded", roleBias: "rap" },
  { id: "emotion_cold_suppressed_anger", labelKo: "터질 듯한 분노를 차갑게 억누르는", label: "Coldly suppressed anger", descriptionKo: "폭발할 것 같은 거대한 분노를 품고 있지만, 이성을 붙잡고 싸늘하게 다스리는 상태.", promptCore: "coldly suppressing explosive anger, controlled rage, icy restraint", promptShort: "coldly suppressed anger", tag: "suppressed anger", roleBias: "rap" },
  { id: "emotion_abandonment_anxiety", labelKo: "버림받을까 봐 조마조마하고 불안한", label: "Terrified of losing", descriptionKo: "겉으로는 태연해 보이려 하지만 상대방의 마음이 떠날까 봐 속으로 극도로 초조하고 불안한 상태.", promptCore: "anxious and terrified of losing, insecure attachment, fear of being left behind", promptShort: "anxious fear of losing", tag: "insecure", roleBias: "whisper" },
  { id: "emotion_awkward_sincere_approach", labelKo: "어색하지만 진심을 다해 조심스럽게 다가가는", label: "Awkward but sincere", descriptionKo: "표현이 서툴고 쑥스럽지만 용기를 내어 진심을 조심스럽게 전하려는 상태.", promptCore: "awkward but sincerely and carefully approaching, clumsy honesty, careful affection", promptShort: "awkward but sincere", tag: "sincere", roleBias: "harmony" },
  { id: "emotion_bitter_regret_self_blame", labelKo: "지난날을 뼈저리게 후회하며 자책하는", label: "Bitter regret and self-blame", descriptionKo: "되돌릴 수 없는 과거의 잘못이나 선택을 깊이 후회하며 스스로를 원망하는 상태.", promptCore: "bitterly regretting and blaming oneself, painful remorse, self-directed guilt", promptShort: "bitter regret and self-blame", tag: "self-blame", roleBias: "main" },
  { id: "emotion_secret_yearning", labelKo: "들킬까 봐 숨죽이며 애태우는", label: "Secretly yearning", descriptionKo: "진짜 마음이 들통날까 봐 전전긍긍하며 혼자 속앓이를 하는 상태.", promptCore: "secretly yearning, painfully hiding true feelings, breath-held longing", promptShort: "secret yearning held back", tag: "secret longing", roleBias: "whisper" },
  { id: "emotion_choked_gratitude", labelKo: "벅찬 감동에 가슴이 메이는", label: "Overwhelmed and choked up", descriptionKo: "큰 기쁨, 사랑, 위로를 받아 감정이 북받쳐 말을 잇지 못할 만큼 벅찬 상태.", promptCore: "overwhelmed with emotion, choked up with gratitude, heart-swelling tenderness", promptShort: "overwhelmed and choked up", tag: "choked up", roleBias: "main" },
  { id: "emotion_burden_released", labelKo: "오랜 짐을 벗어던지고 온전히 후련한", label: "Free from a heavy burden", descriptionKo: "오랫동안 짓누르던 억압, 상처, 인연에서 벗어나 진정한 해방감과 자유를 느끼는 상태.", promptCore: "completely free, letting go of a heavy burden, cathartic release", promptShort: "free from a heavy burden", tag: "liberated", roleBias: "main" },
];

function resolveVocalEmotionLine(value: string | null | undefined): VocalEmotionLine | undefined {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return undefined;
  return VOCAL_EMOTION_LINES.find((item) =>
    item.id.toLowerCase() === normalized ||
    item.label.toLowerCase() === normalized ||
    item.labelKo.toLowerCase() === normalized
  );
}

function resolveVocalEmotionCore(value: string | null | undefined): string {
  const item = resolveVocalEmotionLine(value);
  return item?.promptCore || String(value || "");
}

function resolveVocalEmotionShort(value: string | null | undefined): string {
  const item = resolveVocalEmotionLine(value);
  return item?.promptShort || "";
}

function getGlobalVocalEmotionCueForRole(
  params: GenerateSongParams,
  role: string,
  tone: string,
  index: number,
): VocalExpressionCue | null {
  const item = resolveVocalEmotionLine(params.vocal?.globalToneId);
  if (!item) return null;
  return adaptVocalEmotionCueForRole(item, role, tone, index);
}

type VocalExpressionCue = {
  id: string;
  label: string;
  short: string;
  tag: string;
  roleBias: "main" | "lead" | "rap" | "whisper" | "harmony" | "any";
};

function isVocalExpressionStyleItem(item: ReturnType<typeof resolveStyleItem>): boolean {
  if (!item) return false;
  const text = [
    item.id,
    item.label,
    item.labelKo,
    item.style,
    item.sound,
    item.mood,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    item.id.toLowerCase().startsWith("vocal-") ||
    /vocal|보컬|sing|spoken|말하듯|읊조|whisper|속삭|teary|울먹|pleading|애원|sarcastic|비꼬|emotion|감정/.test(text)
  );
}

function vocalExpressionCueFromStyle(item: ReturnType<typeof resolveStyleItem>): VocalExpressionCue | null {
  if (!item) return null;
  const text = [item.id, item.label, item.labelKo, item.style, item.mood]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const label = item.labelKo || item.label || item.id;

  const make = (
    short: string,
    tag: string,
    roleBias: VocalExpressionCue["roleBias"] = "any",
  ): VocalExpressionCue => ({ id: item.id, label, short, tag, roleBias });

  if (/sarcastic|비꼬/.test(text)) return make("subtle sarcastic edge", "sarcastic", "rap");
  if (/tossed|툭/.test(text)) return make("dry tossed-off attitude", "dry casual", "rap");
  if (/spoken|말하듯/.test(text)) return make("spoken conversational phrasing", "conversational", "rap");
  if (/reciting|읊조/.test(text)) return make("quiet reciting phrasing", "poetic calm", "lead");
  if (/held|눌러|참/.test(text)) return make("held-back restrained emotion", "restrained", "main");
  if (/teary|울먹/.test(text)) return make("tearful fragile emotion", "fragile", "lead");
  if (/pleading|애원/.test(text)) return make("pleading vulnerable pull", "pleading", "main");
  if (/cold|차가/.test(text)) return make("cold restrained distance", "cold", "rap");
  if (/indifferent|무심/.test(text)) return make("detached indifferent calm", "detached", "rap");
  if (/lazy|나른/.test(text)) return make("lazy relaxed phrasing", "laid-back", "lead");
  if (/rough|거친|gritty/.test(text)) return make("rough gritty pressure", "gritty", "rap");
  if (/dreamy|몽롱/.test(text)) return make("dreamy blurred softness", "dreamy", "lead");
  if (/whisper|속삭/.test(text)) return make("whispery intimate restraint", "whispery", "whisper");
  if (/explosive|폭발/.test(text)) return make("explosive emotional peak", "explosive", "main");
  if (/smiling|웃는/.test(text)) return make("smiling playful warmth", "playful warm", "harmony");
  if (/empty|허무/.test(text)) return make("hollow resigned emotion", "empty", "lead");
  if (/suffocated|숨 막|breathless/.test(text)) return make("breathless pressured tension", "breathless tense", "main");
  if (/emotional rise|감정 고조/.test(text)) return make("gradual emotional rise", "rising emotion", "main");
  if (/delicate|섬세/.test(text)) return make("delicate controlled expression", "delicate", "lead");

  const fallback = cleanPromptValue(item.style || item.mood || item.label || item.id);
  if (!fallback) return null;
  return make(limitText(fallback, 42), firstPromptWord(fallback), "any");
}

function getSelectedVocalExpressionCues(params: GenerateSongParams): VocalExpressionCue[] {
  const cues: VocalExpressionCue[] = [];
  const seen = new Set<string>();
  for (const id of params.styles ?? []) {
    const item = resolveStyleItem(id);
    if (!isVocalExpressionStyleItem(item)) continue;
    const cue = vocalExpressionCueFromStyle(item);
    if (!cue || seen.has(cue.id)) continue;
    seen.add(cue.id);
    cues.push(cue);
  }
  return cues.slice(0, 4);
}

function roleBiasForVocalSplit(role: string, tone: string): VocalExpressionCue["roleBias"] {
  const value = `${role} ${tone}`.toLowerCase();
  if (/rap|talk|flow/.test(value)) return "rap";
  if (/whisper|breathy/.test(value)) return "whisper";
  if (/main|belt|high|climax/.test(value)) return "main";
  if (/lead|airy|soft|dreamy/.test(value)) return "lead";
  if (/sub|harmony|support/.test(value)) return "harmony";
  return "any";
}

function pickVocalExpressionCueForRole(
  params: GenerateSongParams,
  role: string,
  tone: string,
  index: number,
): VocalExpressionCue | null {
  const cues = getSelectedVocalExpressionCues(params);
  if (!cues.length) return null;
  const roleBias = roleBiasForVocalSplit(role, tone);
  const direct = cues.find((cue) => cue.roleBias === roleBias);
  if (direct) return direct;
  const any = cues.find((cue) => cue.roleBias === "any");
  if (any) return any;
  return cues[index % cues.length] || null;
}

function adaptVocalEmotionCueForRole(
  item: VocalEmotionLine,
  role: string,
  tone: string,
  index: number,
): VocalExpressionCue {
  const roleBias = roleBiasForVocalSplit(role, tone);
  const core = `${item.promptCore} ${item.promptShort}`.toLowerCase();
  let short = item.promptShort;
  let tag = item.tag;

  // A global emotion should be the emotional center, but each singer must express it differently.
  // Otherwise every member receives the same phrase (ex: "numb and resigned") and the split loses color.
  if (item.id === "emotion_resigned_empty" || /numb|resigned|empty/.test(core)) {
    if (roleBias === "main") {
      short = "numb but climactic";
      tag = "numb";
    } else if (roleBias === "lead") {
      short = "hollow and fragile";
      tag = "hollow";
    } else if (roleBias === "rap") {
      short = /low|husky|off/i.test(`${role} ${tone}`)
        ? "tired cynical detachment"
        : "numb but casually sharp";
      tag = "numb";
    } else if (roleBias === "whisper") {
      short = "empty breath-held restraint";
      tag = "empty";
    } else {
      short = "quiet numb restraint";
      tag = "numb";
    }
  } else if (item.id === "emotion_smiling_hidden_pain" || /hidden pain|crying inside|wounded/.test(core)) {
    if (roleBias === "main") short = "smiling through hidden pain";
    else if (roleBias === "lead") short = "fragile pain under calm";
    else if (roleBias === "rap") short = "dry pain behind bravado";
    else if (roleBias === "whisper") short = "secret wounded restraint";
    tag = roleBias === "rap" ? "hidden pain" : item.tag;
  } else if (item.id === "emotion_resentful_lingering" || /resentful|longing|lingering/.test(core)) {
    if (roleBias === "main") short = "aching resentful longing";
    else if (roleBias === "lead") short = "soft lingering hurt";
    else if (roleBias === "rap") short = "resentful sharp longing";
    else if (roleBias === "whisper") short = "secret lingering resentment";
    tag = "longing";
  } else if (item.id === "emotion_cold_suppressed_anger" || /suppressed.*anger|controlled rage|icy restraint/.test(core)) {
    if (roleBias === "main") short = "cold controlled anger";
    else if (roleBias === "lead") short = "shaky restrained anger";
    else if (roleBias === "rap") short = "icy aggressive restraint";
    else if (roleBias === "whisper") short = "quiet dangerous anger";
    tag = "suppressed anger";
  } else if (item.id === "emotion_abandonment_anxiety" || /terrified|insecure|fear of being left/.test(core)) {
    if (roleBias === "main") short = "insecure emotional urgency";
    else if (roleBias === "lead") short = "fragile anxious hesitation";
    else if (roleBias === "rap") short = "defensive anxious edge";
    else if (roleBias === "whisper") short = "breath-held anxious fear";
    tag = "anxious";
  } else if (item.id === "emotion_pushing_away_fear" || /pushing away|guarded longing|defensive cold/.test(core)) {
    if (roleBias === "main") short = "guarded longing";
    else if (roleBias === "lead") short = "soft fear behind distance";
    else if (roleBias === "rap") short = "cold defensive push-away";
    else if (roleBias === "whisper") short = "secret guarded fear";
    tag = "guarded";
  } else {
    // Light role-shaping for any future emotion item.
    if (roleBias === "rap" && !/attitude|edge|sharp|cynical|flow/i.test(short)) short = `${short} attitude`;
    if (roleBias === "whisper" && !/breath|secret|whisper|restraint/i.test(short)) short = `secretive ${short}`;
    if (roleBias === "lead" && !/fragile|soft|hollow|airy|dreamy/i.test(short)) short = `soft ${short}`;
    if (roleBias === "harmony" && !/supportive|warm|blend/i.test(short)) short = `supportive ${short}`;
  }

  return { id: item.id, label: item.labelKo, short, tag, roleBias: item.roleBias || "any" };
}

function adaptVocalExpressionCueForRole(
  cue: VocalExpressionCue | null,
  role: string,
  tone: string,
): VocalExpressionCue | null {
  if (!cue) return null;
  const roleBias = roleBiasForVocalSplit(role, tone);
  const source = `${cue.short} ${cue.tag} ${cue.label}`.toLowerCase();
  let short = cue.short;
  let tag = cue.tag;

  if (/rough|gritty|거친/.test(source)) {
    if (roleBias === "main") {
      short = "rough climactic pressure";
      tag = "gritty";
    } else if (roleBias === "lead") {
      short = "fragile rough edge";
      tag = "fragile";
    } else if (roleBias === "rap") {
      short = "gritty off-beat pressure";
      tag = "gritty";
    } else if (roleBias === "whisper") {
      short = "breathy rough tension";
      tag = "breathy";
    }
  } else if (/sarcastic|cynical|비꼬/.test(source) && roleBias !== "rap") {
    short = roleBias === "main" ? "controlled cynical edge" : "subtle cynical color";
    tag = "cynical";
  } else if (/explosive|폭발/.test(source) && roleBias === "lead") {
    short = "fragile build-up tension";
    tag = "tense";
  } else if (/whisper|속삭/.test(source) && roleBias !== "whisper") {
    short = roleBias === "rap" ? "hushed talk-rap delivery" : "intimate soft restraint";
    tag = roleBias === "rap" ? "hushed" : "intimate";
  }

  return { ...cue, short, tag, roleBias: cue.roleBias };
}

function mergeVocalExpressionIntoEmotion(baseEmotion: string, cue: VocalExpressionCue | null): string {
  const base = String(baseEmotion || "").replace(/^with\s+/i, "").trim();
  if (!cue?.short) return base;
  const cueShort = cue.short.trim();
  if (!cueShort) return base;
  const low = base.toLowerCase();
  const cueKey = firstPromptWord(cueShort).toLowerCase();
  if (cueKey && low.includes(cueKey)) return base;
  if (!base) return cueShort;
  return `${base}, ${cueShort}`;
}

function buildSelectedVocalExpressionInstruction(params: GenerateSongParams): string {
  const cues = getSelectedVocalExpressionCues(params);
  if (!cues.length) return "No extra Vocal Expression style selected.";
  return cues
    .map((cue) => `- ${cue.label}: use ${cue.short}; lyric tags may include one short cue such as ${cue.tag}.`)
    .join("\n");
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


function getInstrumentSoundPromptItems(values: string[] = []) {
  return values
    .map((value) => resolveInstrumentSoundItem(value) as any)
    .filter((item) => item && String(item.promptCore || '').trim().length > 0)
    .map((item) => ({
      id: String(item.id || ''),
      prompt: String(item.promptCore || '').trim(),
      categoryKo: String(item.categoryKo || item.categoryLabel || '기타'),
      labelKo: String(item.labelKo || item.label || item.id || ''),
    }));
}

function compactSoundPromptsByCategory(values: string[] = []): string[] {
  const items = getInstrumentSoundPromptItems(values);
  if (!items.length) return [];

  const byCategory = new Map<string, typeof items>();
  items.forEach((item) => {
    const list = byCategory.get(item.categoryKo) ?? [];
    list.push(item);
    byCategory.set(item.categoryKo, list);
  });

  const compacted: string[] = [];
  const joinPrompts = (list: typeof items, max = 4) =>
    list.map((item) => item.prompt).filter(Boolean).slice(0, max).join(', ');

  byCategory.forEach((list, categoryKo) => {
    if (list.length === 1) {
      compacted.push(list[0].prompt);
      return;
    }

    const prompts = joinPrompts(list, categoryKo === '전통악기' || categoryKo === '월드악기' ? 5 : 4);
    switch (categoryKo) {
      case '전통악기':
        compacted.push(`Korean traditional ensemble with ${prompts}`);
        break;
      case '월드악기':
        compacted.push(`world instrument color with ${prompts}`);
        break;
      case '리듬 악기':
        compacted.push(`rhythm section with ${prompts}`);
        break;
      case '베이스':
        compacted.push(`low-end foundation with ${prompts}`);
        break;
      case '기타':
        compacted.push(`guitar layer with ${prompts}`);
        break;
      case '건반':
        compacted.push(`keyboard layer with ${prompts}`);
        break;
      case '신스':
        compacted.push(`synth layer with ${prompts}`);
        break;
      case '현악':
        compacted.push(`string layer with ${prompts}`);
        break;
      case '관악':
        compacted.push(`wind and brass color with ${prompts}`);
        break;
      case '타악':
        compacted.push(`percussion accents with ${prompts}`);
        break;
      case '보컬효과':
        compacted.push(`vocal FX layer with ${prompts}`);
        break;
      case '공간효과':
        compacted.push(`space FX with ${prompts}`);
        break;
      case '질감효과':
        compacted.push(`texture FX with ${prompts}`);
        break;
      default:
        compacted.push(prompts);
    }
  });

  return compacted.filter(Boolean);
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
  const emotion = resolveVocalEmotionLine(toneIdOrLabel);
  if (emotion) return emotion.promptCore;
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
  const emotion = resolveVocalEmotionLine(toneIdOrLabel);
  if (emotion) return emotion.promptShort;
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

function resolveVocalToneItem(toneIdOrLabel: string | null | undefined) {
  const normalized = String(toneIdOrLabel || "").trim().toLowerCase();
  if (!normalized) return undefined;
  return VOCAL_TONES.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized ||
      (item.labelKo || "").toLowerCase() === normalized,
  );
}

function describeVocalToneForSplit(
  toneIdOrLabel: string | null | undefined,
  role: string,
  gender: string,
): string {
  const tone = resolveVocalToneItem(toneIdOrLabel);
  const source = tone
    ? `${tone.id} ${tone.label} ${tone.labelKo || ""} ${tone.promptShort || ""} ${tone.promptCore || ""}`
    : String(toneIdOrLabel || "");
  const raw = source.toLowerCase();
  const roleRaw = String(role || "").toLowerCase();
  const isRapRole = /rap|rapper|래퍼|랩/.test(roleRaw) || /rap|래/.test(raw);

  if (isRapRole) {
    if (/whisper|breathy|속삭|숨결/.test(raw)) return "whispery breathy rap texture";
    if (/low|deep|husky|off-beat|offbeat|저음|낮|허스키/.test(raw)) return "low husky off-beat rap flow";
    if (/swagger|stylish|sassy|confident|스타일|스웨그/.test(raw)) return "stylish rhythmic rap flow";
    if (/aggressive|punchy|sharp|cutting|공격|날카/.test(raw)) return "sharp punchy rap flow";
    if (/bright|clear|cute|밝|선명|맑/.test(raw)) return "bright playful rap flow";
    return "rhythmic rap flow";
  }

  if (/whisper|breathy|속삭|숨결/.test(raw)) return "whispery breathy tone";
  if (/airy|floating|dreamy|relaxed|나른|몽환|공기/.test(raw)) return "airy relaxed tone";
  if (/sweet|bright|clear|clean|cute|맑|선명|밝|달콤/.test(raw)) return "clear bright tone";
  if (/power|belt|high|고음|파워/.test(raw)) return "powerful high-note belt";
  if (/r&b|rnb|soul|소울/.test(raw)) return "soulful R&B tone";
  if (/jazz|velvet|smoky|재즈/.test(raw)) return "velvety smoky tone";
  if (/conversational|spoken|talk|말하/.test(raw)) return "spoken conversational tone";
  if (/husky|gritty|rough|허스키|거친/.test(raw)) return "husky textured tone";

  const short = tone?.promptShort || compactVocalToneForPrompt(source);
  const cleaned = String(short || "").replace(/\b(male|female)\b/gi, "").replace(/\s+/g, " ").trim();
  if (cleaned && cleaned !== "character" && cleaned !== "natural") return cleaned;
  return defaultToneForVocalSplitRole(role, gender);
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
- Follow the selected lyric language mode exactly; do not add unselected languages.
- If translation is requested by language mode, keep it natural and lyrical rather than literal.
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

  if (total === 0) {
    if (mode === "solo") return "Auto solo vocal";
    if (mode === "duo") return "Auto duo vocal";
    if (mode === "group") return "Auto group vocal";
    return null;
  }

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
  if ((vocal as any).mode === "solo" && male === 0 && female === 0) {
    genderRule = `Use exactly one suitable solo vocalist chosen to match the genre and mood. Do not print the phrase "random solo vocal" in the final prompt.`;
  } else if ((vocal as any).mode === "duo" && male === 0 && female === 0) {
    genderRule = `Use exactly two contrasting vocalists chosen to match the song, with clearly separated roles by section. The duo may be mixed, male duo, or female duo. Do not print the phrase "random-gender duo" in the final prompt.`;
  } else if ((vocal as any).mode === "group" && male === 0 && female === 0) {
    genderRule = `Use a group vocal split with suitable mixed or same-gender voices chosen to match the genre, using clear Main, Lead, Rap, and Harmony-style roles. Do not print the phrase "random-gender group" in the final prompt.`;
  } else if (male > 0 && female > 0) {
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
        const roleForLabel = rolesStr || getDefaultMultiVocalRole(idx, vocal.members?.length ?? 0, Boolean(vocal.rap));
        const toneValue = m.toneId
          ? describeVocalToneForSplit(m.toneId, roleForLabel, m.gender)
          : "";
        const tagLabel = lyricTagLabelFromRoleTone(
          roleForLabel,
          toneValue || roleForLabel,
          male > 0 && female > 0,
          m.gender,
        );
        let toneInfo = "";
        if (m.toneId) {
          toneInfo = `, Tone: ${toneValue}`;
        }

        const rolesPart = rolesStr ? `: ${rolesStr}` : "";
        return `- ${tagLabel} (${genderStr})${rolesPart}${toneInfo}`;
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
      songStructure: first.songStructure ?? "1",
      useAutoDuration: first.useAutoDuration ?? true,
      vocal: first.vocal ?? { male: 0, female: 0, rap: false },
      tempo: first.tempo,
      specialPrompt: first.specialPrompt,
      kpopMode: first.kpopMode ?? 0,
      isKpopSelected: first.isKpopSelected ?? false,
      isKoreanEnglishMix: first.isKoreanEnglishMix ?? false,
      englishMixRatio: normalizeEnglishMixRatio((first as any).englishMixRatio),
      customStructure: first.customStructure ?? [],
      lyricDraft: first.lyricDraft ?? "",
      isLyricMode: first.isLyricMode ?? false,
      lyricMode: first.lyricMode ?? "assist",
      isNoLyrics: first.isNoLyrics ?? false,
      includeLyrics:
        (first as any).includeLyrics ?? !(first.isNoLyrics ?? false),
      lyricLanguages: ((first as any).lyricLanguages ?? ["ko"]) as LanguageCode[],
    };
  }

  const [
    genres,
    moods,
    themes,
    userInput,
    songPrompt = "",
    lyricsLength = "normal",
    songStructure = "1",
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
    englishMixRatio: 10,
    customStructure: [],
    lyricLanguages: ["ko"],
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
  maxInjections = 3,
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

    if (injected >= maxInjections) break;
  }

  return lines.join("\n");
}

function countEnglishWords(text: string): number {
  return (String(text || "").match(/[A-Za-z]+(?:[’'-][A-Za-z]+)?/g) || []).length;
}

function countKoreanWordUnits(text: string): number {
  return String(text || "")
    .split(/\s+/)
    .filter((part) => /[가-힣]/.test(part)).length;
}

function countLyricWordUnits(text: string): number {
  const plain = String(text || "")
    // Remove Suno section tags from ratio calculation.
    .replace(/^\s*\[[^\]]+\]\s*$/gm, "")
    .trim();
  return Math.max(1, countKoreanWordUnits(plain) + countEnglishWords(plain));
}

function removeEnglishFragmentsFromKoreanLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;
  if (/^\[[^\]]+\]$/.test(trimmed)) return line;

  // Remove standalone English ad-libs/lines.
  if (/^\(?[A-Za-z0-9\s’'",.!?&-]+\)?$/.test(trimmed)) return "";

  return line
    // Remove English-only parenthetical phrases: (Stay with me)
    .replace(/\s*\([A-Za-z0-9\s’'",.!?&-]+\)\s*/g, " ")
    // Remove Latin words inside Korean lines.
    .replace(/[A-Za-z]+(?:[’'-][A-Za-z]+)?/g, "")
    // Clean separators left by removed English phrases.
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/^[\s,.:;!?-]+|[\s,.:;!?-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trimEnd();
}

function limitEnglishMixRatioInKoreanLyrics(text: string, englishMixRatio = 10): string {
  const source = String(text || "");
  const ratio = normalizeEnglishMixRatio(englishMixRatio);
  if (!source.trim()) return source;
  if (ratio <= 0) return stripEnglishAdlibsForKoreanOnlyLyrics(source);

  const totalUnits = countLyricWordUnits(source);
  const maxEnglishWords = Math.max(1, Math.floor((totalUnits * ratio) / 100));
  const currentEnglishWords = countEnglishWords(source);
  if (currentEnglishWords <= maxEnglishWords) return source;

  let usedEnglishWords = 0;
  const maxWordsPerKeptFragment = ratio <= 5 ? 3 : ratio <= 10 ? 5 : ratio <= 20 ? 8 : 12;

  const limited = source
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (/^\[[^\]]+\]$/.test(trimmed)) return line;

      const englishWords = countEnglishWords(line);
      if (englishWords === 0) return line;

      const hasKorean = /[가-힣]/.test(line);
      const isStandaloneEnglish = !hasKorean || /^\([A-Za-z0-9\s’'",.!?&-]+\)$/.test(trimmed);

      if (
        usedEnglishWords + englishWords <= maxEnglishWords &&
        englishWords <= maxWordsPerKeptFragment &&
        (isStandaloneEnglish || hasKorean)
      ) {
        usedEnglishWords += englishWords;
        return line;
      }

      return removeEnglishFragmentsFromKoreanLine(line);
    })
    .filter((line, index, arr) => {
      if (line.trim()) return true;
      const prev = arr[index - 1]?.trim();
      const next = arr[index + 1]?.trim();
      return Boolean(prev && next && /^\[/.test(next));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return limited;
}

function enforceKpopMixedLyrics(
  lyrics: { english: string; korean: string },
  englishMixRatio = 10,
): {
  english: string;
  korean: string;
} {
  const ratio = normalizeEnglishMixRatio(englishMixRatio);
  const maxInjections = ratio <= 5 ? 1 : ratio <= 10 ? 1 : ratio <= 20 ? 2 : 3;
  const koreanSource = lyrics.korean ?? "";
  const koreanTotalUnits = countLyricWordUnits(koreanSource);
  const currentEnglishWords = countEnglishWords(koreanSource);
  const maxEnglishWords = Math.max(1, Math.floor((koreanTotalUnits * ratio) / 100));

  // Only add mixed accents when the model produced almost no English.
  // If it already exceeded the selected ratio, do not inject more.
  const koreanMixed = currentEnglishWords === 0
    ? injectMixedPhrases(
        koreanSource,
        ratio <= 5 ? ["(Stay)"] : ["(Stay tonight)", "(You and I)", "(Feel alive)"],
        containsLatin,
        maxInjections,
      )
    : koreanSource;

  const englishMixed = injectMixedPhrases(
    lyrics.english ?? "",
    ["(이 밤에)", "(너와 나)", "(괜찮아)"],
    containsHangul,
    maxInjections,
  );

  return {
    korean: limitEnglishMixRatioInKoreanLyrics(koreanMixed, ratio),
    english: englishMixed,
  };
}


function normalizeEnglishMixRatio(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(0, Math.min(30, Math.round(numeric)));
}

function stripEnglishAdlibsForKoreanOnlyLyrics(text: string): string {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      // Keep Suno-style section tags such as [Verse] or [Chorus]. For default/free and custom structures, prefer [Verse] instead of numbered [Verse]/[Verse].
      if (/^\[[^\]]+\]$/.test(trimmed)) return line;
      // Remove standalone English ad-libs such as (Stay with me) or (I don't want you here).
      if (/^\([A-Za-z0-9\s'",.!?&-]+\)$/.test(trimmed)) return "";
      // Remove trailing English-only parenthetical ad-libs after Korean lines.
      return line.replace(/\s*\([A-Za-z0-9\s'",.!?&-]+\)\s*$/g, "").trimEnd();
    })
    .filter((line, index, arr) => {
      if (line.trim()) return true;
      const prev = arr[index - 1]?.trim();
      const next = arr[index + 1]?.trim();
      return Boolean(prev && next && /^\[/.test(next));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    tempoSource: params.tempoSource ?? undefined,
    isRandomTempo: params.isRandomTempo ?? false,
    vocalType: vocalDescription.join(" + ") || "Default",
    lyricsLength: params.lyricsLength ?? "normal",
    songStructure:
      params.songStructure === "custom" ? "custom" : (params.songStructure ?? "1"),
    customStructure:
      params.songStructure === "custom" ? (params.customStructure ?? []) : [],
    maleCount: params.vocal?.male ?? 0,
    femaleCount: params.vocal?.female ?? 0,
    rapEnabled: params.vocal?.rap ?? false,
    isKoreanEnglishMix: params.isKoreanEnglishMix ?? false,
    englishMixRatio: normalizeEnglishMixRatio(params.englishMixRatio),
    vocal: params.vocal ?? { male: 0, female: 0, rap: false },
    isNoLyrics: params.isNoLyrics ?? false,
    lyricDraft: params.lyricDraft,
    isLyricMode: params.isLyricMode ?? false,
    lyricMode: params.lyricMode ?? "assist",
  };
}


function normalizeLyricSectionNameForGeneration(sectionName: string): string {
  return String(sectionName || "")
    .replace(/\bRap\s+Verse\b/gi, "Rap Section")
    .replace(/\bRap\s*Verse\b/gi, "Rap Section");
}

function normalizeLyricStructureTextForGeneration(structureText: string): string {
  return String(structureText || "")
    .split("→")
    .map((part) => normalizeLyricSectionNameForGeneration(part.trim()))
    .join(" → ");
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
          `${normalizeLyricSectionNameForGeneration(section.section)}${section.tags.length > 0 ? ` (${section.tags.join(", ")})` : ""}`,
      )
      .join(" → ");
  }

  const structureMap: Record<Exclude<SongStructure, "custom">, string> = {
    "1": "Default free structure: arrange sections freely around the story arc and emotional climax",
    "2": BASIC_STRUCTURE,
    "3": "Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Bridge → Instrumental / Break → Final Chorus / Drop → Outro",
  };

  const selected =
    (songStructure === "custom" ? resolvedStructure : songStructure) ??
    resolvedStructure;
  return normalizeLyricStructureTextForGeneration(
    structureMap[(selected as Exclude<SongStructure, "custom">) || "1"],
  );
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
  // Recommendation presets are ignored directly; their applied instrument ids are compacted by category.
  const selectedLabels = compactSoundPromptsByCategory(selectedSoundIds);
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
    [/이순신|충무공/g, "Korean Admiral"],
    [/도요토미\s*히데요시|토요토미\s*히데요시|히데요시/g, "foreign warlord"],
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
    [/세종대왕|세종/g, "Joseon king"],
    [/퇴계이황|이황|퇴계/g, "Joseon scholar"],
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

function sanitizeArtistLikeNamesForSunoPrompt(value: string): string {
  // Suno can reject proper names in the style/tags prompt as artist references.
  // Keep specific names for lyrics if needed, but make the final music prompt role-safe.
  return String(value || "")
    .replace(/\bYi[\s-]?Sun[\s-]?sin\b/gi, "Korean Admiral")
    .replace(/\bHideyoshi\b/gi, "foreign warlord")
    .replace(/\bToyotomi\b/gi, "foreign warlord")
    .replace(/\bKing\s+Sejong\b/gi, "Joseon king")
    .replace(/\bYi\s+Hwang\b/gi, "Joseon scholar")
    .replace(/\bLee\s+Sun[\s-]?sin\b/gi, "Korean Admiral");
}

function enforceEnglishProductionPrompt(prompt: string): string {
  return prompt
    .split("\n")
    .map((line) => {
      if (/^\[Audio quality improved to masterpiece\]$/.test(line.trim()))
        return line.trim();
      return cleanProductionPhrase(sanitizeArtistLikeNamesForSunoPrompt(stripRemainingKoreanForProductionPrompt(line)));
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
  if (/이순신|충무공|yi sun-sin|yi sun sin/.test(value)) return "Korean Admiral";
  if (/히데요시|도요토미|토요토미|hideyoshi|toyotomi/.test(value)) return "foreign warlord";
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
    return "dry heroic restraint";
  if (/히데요시|도요토미|토요토미|hideyoshi/.test(value))
    return "insecure, tired need for comfort";
  if (/저승사자|사자|reaper|grim/.test(value))
    return "tired authority and reluctant sympathy";
  if (/귀신|유령|ghost|spirit/.test(value))
    return "pleading regret and fragile restraint";
  if (/상사|부장|boss|manager|팀장/.test(value))
    return "dry authority and nagging pressure";
  if (/직원|mz|사원|employee/.test(value))
    return "sarcastic, slightly hurt edge";
  if (/엄마|어머니|mother|mom/.test(value))
    return "worried warmth that sounds like nagging";
  if (/아들|son/.test(value)) return "blunt defensive replies";
  return "character-led phrasing";
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
    add("pressing phrasing", /pressure|authority|pressing/);

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
          : mode === "solo" || mode === "duo" || mode === "group"
            ? "random"
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
  if (/stylish|swagger|sassy|스타일|스웨그/.test(raw)) addTone("stylish");
  if (/confident|자신감|당당/.test(raw)) addTone("confident");
  if (/denial|괜찮|숨기|hidden/.test(raw)) addTone("controlled");
  if (/anxious|anxiety|불안|초조|unease/.test(raw)) addTone("anxious");
  if (/desperate|절박|pleading|애원/.test(raw)) addTone("desperate");
  if (/sarcastic|cynical|비꼬|냉소/.test(raw)) addTone("sarcastic");
  if (/anger|rage|분노|화난/.test(raw)) addTone("angry");
  if (/whisper|breathy|속삭|숨결/.test(raw)) addTone("whispery");
  if (/airy|floating|dreamy|relaxed|공기|몽환|나른/.test(raw)) addTone("airy");
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


function getDefaultMultiVocalRole(index: number, total: number, rapEnabled = false): string {
  if (total <= 2) return index === 0 ? "main" : (rapEnabled ? "rap/lead" : "lead");
  if (total === 3) {
    if (index === 0) return "main";
    if (index === 1) return "lead";
    return rapEnabled ? "sub/talk-rap" : "sub";
  }
  if (total === 4) {
    if (index === 0) return "main";
    if (index === 1) return "lead";
    if (index === 2) return rapEnabled ? "rap" : "sub";
    return "sub";
  }
  if (index === 0) return "main";
  if (index === 1) return "lead";
  if (index === 2) return "rap 1";
  if (index === 3) return "rap 2";
  return "bridge";
}

function normalizeVocalSplitRole(role: string): string {
  const value = String(role || "").toLowerCase();
  if (value.includes("rap") && value.includes("lead")) return "Rap/Lead";
  if (value.includes("rap") && value.includes("1")) return "Rap";
  if (value.includes("rap") && value.includes("2")) return "Rap";
  if (value.includes("rapper") || value === "rap") return "Rap";
  if (value.includes("main")) return "Main";
  if (value.includes("lead")) return "Lead";
  if (value.includes("bridge")) return "Bridge";
  if (value.includes("talk")) return "Sub";
  if (value.includes("sub")) return "Sub";
  return sentenceCase(role || "Vocal");
}

function vocalLabelFromRoleTone(role: string, tone: string, usedLabels: Set<string>): string {
  const normalizedRole = normalizeVocalSplitRole(role);
  const value = `${role} ${tone}`.toLowerCase();

  const candidates: string[] = [];
  if (/main/.test(value)) candidates.push("Main Vocal");
  if (/lead/.test(value)) candidates.push("Lead Vocal");
  if (/rap/.test(value) && /whisper|breathy/.test(value)) candidates.push("Whisper Rap Vocal");
  if (/rap/.test(value) && /stylish|swagger|sassy/.test(value)) candidates.push("Stylish Rap Vocal");
  if (/rap/.test(value) && /low|husky|off/.test(value)) candidates.push("Low Rap Vocal");
  if (/rap/.test(value) && /bright|fast|triplet|playful|talk|sharp|punchy/.test(value)) candidates.push("Rap Vocal");
  if (/rap/.test(value)) candidates.push("Rap Vocal");
  if (/whisper|soft whisper|breathy/.test(value)) candidates.push("Whisper Vocal");
  if (/airy|dreamy|relaxed/.test(value)) candidates.push("Airy Vocal");
  if (/sub|harmony|support/.test(value)) candidates.push("Harmony Vocal");
  if (/bridge|high-note|build/.test(value)) candidates.push("Bridge Vocal");
  candidates.push(`${normalizedRole} Vocal`.replace(/Vocal Vocal$/i, "Vocal"));

  for (const candidate of candidates) {
    const clean = candidate.replace(/\s+/g, " ").trim();
    if (clean && !usedLabels.has(clean)) {
      usedLabels.add(clean);
      return clean;
    }
  }

  const fallback = `${normalizedRole} Color`;
  usedLabels.add(fallback);
  return fallback;
}

function lyricTagLabelFromRoleTone(role: string, tone: string, mixedGender: boolean, gender: string): string {
  const base = vocalLabelFromRoleTone(role, tone, new Set<string>())
    .replace(/ Vocal$/i, " Vocal")
    .trim();
  if (!mixedGender) return base;
  const genderPrefix = gender === "male" ? "Male" : gender === "female" ? "Female" : "";
  return genderPrefix ? `${genderPrefix} ${base}` : base;
}

function defaultToneForVocalSplitRole(role: string, gender: string): string {
  const value = String(role || "").toLowerCase();
  if (value.includes("rap") && value.includes("2")) return gender === "male" ? "low husky off-beat flow" : "low husky off-beat flow";
  if (value.includes("rap")) return "sharp rhythmic rap flow";
  if (value.includes("bridge")) return "whisper-to-high-note build";
  if (value.includes("main")) return "emotional high-note belt";
  if (value.includes("lead")) return "airy soft tone";
  if (value.includes("talk")) return "harmony support plus light talk-rap";
  if (value.includes("sub")) return "harmony support";
  return gender === "male" ? "natural male tone" : gender === "female" ? "natural female tone" : "natural tone";
}

function makeVocalSplitTone(value: string, role: string, gender: string): string {
  const tone = compactVocalToneForPrompt(value || "");
  if (!tone || tone === "character" || tone === "natural") {
    return defaultToneForVocalSplitRole(role, gender);
  }
  const cleaned = tone.replace(/\b(male|female)\b/gi, "").replace(/\s+/g, " ").trim();
  const roleDefault = defaultToneForVocalSplitRole(role, gender);
  if (!cleaned) return roleDefault;
  if (/rap/i.test(role) && !/rap|flow|talk/i.test(cleaned)) return `${cleaned} rap flow`;
  if (/main/i.test(role) && !/belt|high|lead|vocal/i.test(cleaned)) return `${cleaned} main vocal tone`;
  if (/lead/i.test(role) && !/soft|airy|melodic|vocal/i.test(cleaned)) return `${cleaned} lead vocal tone`;
  if (/sub/i.test(role) && !/harmony|talk|support/i.test(cleaned)) return `${cleaned} harmony support`;
  return cleaned;
}

function getVocalSplitEmotion(
  params: GenerateSongParams,
  role: string,
  index: number,
  tone = "",
): string {
  const mood = getEnglishMoodPhrase(params).toLowerCase();
  const value = `${role || ""} ${tone || ""}`.toLowerCase();
  if (/rap/.test(value)) {
    if (/whisper|breathy/.test(value)) return "with secretive restrained tension";
    if (/stylish|swagger|sassy/.test(value)) return "with confident sleek attitude";
    if (/low|husky|off/.test(value)) return "with cool off-beat attitude";
    if (/dark|intense|aggressive|powerful/.test(mood)) return "with confident, cutting attitude";
    if (/playful|bright|cheerful/.test(mood)) return "with playful talk-like attitude";
    return "with clear rhythmic attitude";
  }
  if (/whisper|breathy/.test(value)) return "with intimate secretive emotion";
  if (/airy|relaxed|dreamy/.test(value)) return "with fragile floating emotion";
  if (value.includes("main")) {
    if (/sad|lonely|nostalgic|emotional|bittersweet/.test(mood)) return "with sincere emotional focus";
    if (/powerful|intense|aggressive/.test(mood)) return "with bold climactic emotion";
    return "with clear emotional focus";
  }
  if (value.includes("lead")) return "with soft, expressive phrasing";
  if (value.includes("sub") || value.includes("harmony")) return "with supportive, conversational warmth";
  if (value.includes("bridge")) return "with rising emotional tension";
  return index === 0 ? "with clear character focus" : "with contrasting delivery";
}

function buildMemberVocalSplit(params: GenerateSongParams): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isMulti) return "";

  const existingMembers = params.vocal?.members ?? [];
  const isRandomDuo = info.mode === "duo" && info.total === 0 && existingMembers.length === 0;
  const isRandomGroup = info.mode === "group" && info.total === 0 && existingMembers.length === 0;
  const total = isRandomDuo ? 2 : isRandomGroup ? 4 : Math.max(info.total || 0, existingMembers.length);
  if (total < 2) return "";

  const mixedGender = info.gender === "mixed";
  const usedLabels = new Set<string>();
  const members = Array.from({ length: Math.min(total, 5) }, (_, index) => {
    const member = existingMembers[index];
    const gender =
      member?.gender ||
      (isRandomDuo || isRandomGroup
        ? "vocal"
        : info.gender === "female"
          ? "female"
          : info.gender === "male"
            ? "male"
            : index < info.female
              ? "female"
              : "male");
    const rawRole =
      member?.roles?.[0] ||
      getDefaultMultiVocalRole(index, total, Boolean(params.vocal?.rap));
    const tone = member?.toneId
      ? describeVocalToneForSplit(member.toneId, rawRole, gender)
      : makeVocalSplitTone("", rawRole, gender);
    const baseEmotion = getVocalSplitEmotion(params, rawRole, index, tone).replace(/^with\s+/i, "");
    const vocalExpressionCue = adaptVocalExpressionCueForRole(
      pickVocalExpressionCueForRole(params, rawRole, tone, index),
      rawRole,
      tone,
    );
    const globalEmotionCue = getGlobalVocalEmotionCueForRole(params, rawRole, tone, index);
    const emotionWithStyle = mergeVocalExpressionIntoEmotion(baseEmotion, vocalExpressionCue);
    const emotion = mergeVocalExpressionIntoEmotion(emotionWithStyle, globalEmotionCue);
    const label = vocalLabelFromRoleTone(rawRole, `${tone} ${vocalExpressionCue?.short || ""}`, usedLabels);
    const lyricLabel = lyricTagLabelFromRoleTone(rawRole, tone, mixedGender, gender);
    return { label, lyricLabel, tone, emotion, gender };
  });

  const head = isRandomDuo
    ? `${total}-vocalist duo split with contrasting tones chosen to match the song`
    : isRandomGroup
      ? `${total}-voice group vocal split with suitable voices chosen to match the genre`
      : `${total} ${info.gender === "female" ? "female" : info.gender === "male" ? "male" : "mixed"} vocal split`;
  const body = members
    .map((member) =>
      `${member.label} (${member.tone}${member.emotion ? `, ${member.emotion}` : ""})`,
    )
    .join(", ");
  // Keep the music prompt focused on vocal color, emotion, and role separation.
  // Lyric tag formatting is handled in the lyric-generation instructions, not here,
  // so the [Vocals] line does not get cut off by tag examples.
  return `${head}: ${body}. Keep roles clearly separated by section.`;
}

function roleVoiceAgeColor(role: string): string {
  const value = String(role || "").toLowerCase();
  if (/엄마|어머니|mother|mom/.test(value)) return "middle-aged female vocal";
  if (/아빠|아버지|father|dad/.test(value)) return "middle-aged male vocal";
  if (/아들|son/.test(value)) return "young male vocal";
  if (/딸|daughter/.test(value)) return "young female vocal";
  return "";
}

function buildCharacterVocalSplitItem(
  params: GenerateSongParams,
  role: string,
  roleIndex: number,
  memberIndex = roleIndex,
): string {
  const roleName = compactRoleForPrompt(role);
  const gender = getMemberGenderLabel(params, memberIndex);
  const memberTone = getMemberToneForPrompt(params, memberIndex);
  const fallbackTone = compactVocalToneForPrompt(inferSituationVocalTone(role, roleIndex));
  const explicitAgeColor = roleVoiceAgeColor(role);
  const voiceTone = explicitAgeColor || `${oneWordVocalTone(memberTone || fallbackTone || gender)} ${gender} vocal`.replace(/^natural\s+/i, "");
  const rawStyleSource = [
    params.situation?.speakers?.[roleIndex]?.speechStyle,
    params.situation?.speakers?.[roleIndex]?.attitude,
    roleIndex === 0 ? params.situation?.speakerAStyle : params.situation?.speakerBStyle,
    roleIndex === 0
      ? params.situation?.speakerAAttitude || params.situation?.attitudeA
      : params.situation?.speakerBAttitude || params.situation?.attitudeB,
  ]
    .filter(Boolean)
    .join(", ");
  const situationDirection = mergeRoleDirection(role, rawStyleSource);
  const expressionCue = rawStyleSource
    ? null
    : pickVocalExpressionCueForRole(params, getMemberRoleForPrompt(params, memberIndex), memberTone || fallbackTone, roleIndex);
  const direction = limitText(
    expressionCue
      ? mergeVocalExpressionIntoEmotion(situationDirection, expressionCue)
      : situationDirection,
    128,
  );
  const acousticLabel = buildSituationAcousticTagLabel(params, role, roleIndex, memberIndex);
  return `${acousticLabel} as ${roleName}, ${direction}`;
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
    58,
  );

  const tonePrefix = cleanTone && cleanTone !== "natural" ? `${cleanTone} ` : "";
  const vocalColor = cleanupPromptTail(`${tonePrefix}${gender} vocal`).replace(/^natural\s+/i, "");

  // Keep a few historically-inspired role archetypes short and Suno-safe.
  if (/Korean Admiral/i.test(roleName)) {
    return `disciplined ${gender} vocal with dry heroic restraint (${roleName})`;
  }
  if (/foreign warlord/i.test(roleName)) {
    return `${gender} vocal with insecure, tired need for comfort (${roleName})`;
  }

  return `${vocalColor} with ${direction} (${roleName})`;
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
      "start with expected power dynamics, then shift section ownership to the other role after Hook, Verse, or Rap Section",
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
    avoidPattern: "explaining the full concept in the first Verse",
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
    "status-game-focus": "where both figures compete for control of the moment",
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

  text = text
    .replace(/\bcall-response hook\s+status battle\b/gi, "call-response hook, status-battle tension")
    .replace(/\bcall-response hook\s+detail-led hook\b/gi, "call-response hook, detail-led emotional turn")
    .replace(/\bcall-response hook\s+space-led sections\b/gi, "call-response hook and space-led sections")
    .replace(/\bcall-response hook\s+delayed reveal\b/gi, "call-response hook with a delayed reveal")
    .replace(/\bcall-response hook\s+misread replies\b/gi, "call-response hook with misread replies")
    .replace(/\bcall-response hook\s+parallel monologues that meet only briefly in the hook\b/gi, "parallel monologues, brief hook meetings, and call-response accents")
    .replace(/\bwith a call-response hook\s+parallel monologues that meet only briefly in the hook\b/gi, "with parallel monologues, brief hook meetings, and call-response accents")
    .replace(/\bcall-response hook\s+echo-and-undercut hook\b/gi, "call-response hook with echo-and-undercut tension")
    .replace(/\bwith a call-response hook\s+echo-and-undercut hook\b/gi, "with a call-response hook and echo-and-undercut tension")
    .replace(/\bcall-response hook\s+looping hook\b/gi, "call-response hook with looping ownership shifts")
    .replace(/\bcall-response hook\s+one-speaker chorus\b/gi, "call-response hook and one-speaker chorus takeover")
    .replace(/\bwith\s+a\s+call-response hook\s+status-battle tension\s+with\s+/gi, "with a call-response hook, status-battle tension, and ")
    .replace(/\bwith\s+a\s+call-response hook,\s*status-battle tension\s+with\s+/gi, "with a call-response hook, status-battle tension, and ")
    .replace(/\bstatus battle with shifting section ownership\b/gi, "status-battle tension and shifting section ownership")
    .replace(/\bdetail-led hook with sparse character interruptions\b/gi, "detail-led emotional hook and sparse character interruptions")
    .replace(/\bspace-led sections\b/gi, "space-led sections")
    .replace(/\s+,\s+/g, ", ")
    .replace(/,\s*and\s+and\s+/gi, ", and ")
    .replace(/\s{2,}/g, " ");

  return cleanupPromptTail(
    text
      .replace(/\bwith\s+and\s+with\b/gi, "with")
      .replace(/\bwith\s+with\b/gi, "with")
      .replace(/\bcall-response hook\s+echo-and-undercut hook\b/gi, "call-response hook with echo-and-undercut tension")
      .replace(/\bcall-response hook\s+parallel monologues that meet only briefly in the hook\b/gi, "parallel monologues, brief hook meetings, and call-response accents")
      .replace(/\bwith a call-response hook\s+parallel monologues that meet only briefly in the hook\b/gi, "with parallel monologues, brief hook meetings, and call-response accents")
      .replace(/\bcall-response hook\s+([a-z-]+\s+hook)\b/gi, "call-response hook with $1"),
  );
}


function variationProductionMeaning(
  variation: CreativeVariationSeed,
  params: GenerateSongParams,
): string {
  const styleText = selectedStyleText(params);
  const genreProfile = getGenrePromptProfile(params);
  const genreText = `${genreProfile.label} ${genreProfile.style} ${genreProfile.sound}`.toLowerCase();

  const hasStageSwitch = /stage|전환|drop|드롭|twist|반전|붕괴|collapse|chaos|혼돈/.test(styleText);
  const hasCyber = /cyber|사이버|glitch|글리치|electronic|전자|synth|신스|metallic|금속/.test(styleText + " " + genreText);
  const hasTrap = /trap|트랩|808|hi-?hat|kick|hip\s*hop|힙합|drill|드릴/.test(styleText + " " + genreText);
  const hasBand = /band|밴드|guitar|기타|drum|드럼|live|라이브|rock|록/.test(styleText + " " + genreText);
  const hasSpace = /space|공간|reverb|잔향|room|hall|tunnel|radio|phone|underwater|수중|우주|성당|클럽/.test(styleText);

  const map: Record<string, string> = {
    "scene-first": "scene-framing instrumental details, warm foreground texture",
    "confession-delay": "slow-build tension, delayed release accents",
    "memory-fragment": "glitchy memory cuts, broken synth echoes, fragmented percussion",
    "quiet-contradiction": "muted sub pressure, restrained metallic details, quiet hook impact",
    "vocal-breath-focus": "close breath space, sparse sub-bass pulses, soft negative space",
    "hook-object-focus": "object-like hook accents, focused motif repeats",
    "denial-focus": "tight 808 pressure, clipped trap drums, cold synth pulses",
    "late-image-focus": "delayed texture reveals, late-arriving shimmer accents",
    "rhythm-phrase-focus": "syncopated trap accents, clipped phrase breaks, tight stop-start drums",
    "contradictory-hook-focus": "hook-punch drops, reversed tension swells, sharp contrast breaks",
    "scene-loop-focus": "looped scene motif, repeating texture shifts",
    "micro-conflict-focus": "small-detail percussion hits, pressure-building synth stabs",

    "interruption-cut-in": "sudden cut-ins, stop-start drum shocks, interruption hits",
    "one-sided-pursuit": "chasing rhythm pulses, delayed reply impacts",
    "negotiation-trade": "trade-off beat switches, answer-back drum accents",
    "parallel-monologue": "split-channel textures, parallel rhythm beds",
    "late-reveal": "hidden texture layers, delayed reveal swells",
    "unresolved-comedy": "dry percussion pops, awkward pause hits",
    "chorus-takeover": "chorus takeover impacts, front-loaded hook drums",
    "echo-undercut": "echo stabs, undercut drops, dry reply accents",
    "speaker-flaw-focus": "flaw-exposing pauses, uneven drum pressure",
    "detail-hook-focus": "detail-led motif hits, sparse hook punctuation",
    "role-reversal-focus": "reversal drops, section-flip impacts",
    "silent-gap-focus": "negative space drops, short silence cuts",
    "chorus-solo-A": "solo-hook spotlight, reduced backing pressure",
    "chorus-solo-B": "unexpected solo-hook lift, redirected drop impact",
    "together-hook-focus": "brief group-hook lift, separated verse textures",
    "genre-led-structure": "genre-shaped groove shifts, part-specific production color",
    "object-perspective-focus": "object-motif pulses, visible-anchor sound details",
    "misread-intent-focus": "misread-reply glitches, delayed-response accents",
    "comic-loop-focus": "looped hook accents, recurring offbeat hits",
    "emotional-fakeout-focus": "fakeout swells, redirected bridge textures",
    "status-game-focus": "status-battle drum pressure, control-shifting drops",
    "memory-cut-focus": "jump-cut samples, memory-flash percussion",
    "adlib-character-focus": "ad-lib pockets, sparse reaction hits",
    "asymmetric-duet-focus": "asymmetric vocal pockets, uneven rhythm lanes",
  };

  const core = map[variation.id] || cleanupPromptTail(variation.arrangementLens);
  const accents: string[] = [];
  if (hasTrap) accents.push("808-weighted rhythm pressure");
  if (hasCyber) accents.push("cyber glitch details");
  if (hasStageSwitch) accents.push("hard switch-drop impact");
  if (hasBand) accents.push("wide live-instrument edge");
  if (hasSpace) accents.push("spatial depth shifts");

  return cleanupPromptTail(
    limitText(
      phraseListForPrompt([core, ...accents].filter(Boolean).slice(0, 3)),
      145,
    ),
  );
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
    평화로운: "peaceful",
    낭만적: "romantic",
    로맨틱: "romantic",
    향수적: "nostalgic",
    위로: "comforting",
    위로되는: "comforting",
    미니멀한: "minimal",
    드라이브: "driving",
    강력한: "powerful",
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


function normalizePromptGenreLabel(value: string): string {
  const cleaned = cleanupPromptTail(String(value || ""))
    .replace(/_/g, " ")
    .replace(/\bKpop\b/gi, "K-Pop")
    .replace(/\bJpop\b/gi, "J-Pop")
    .replace(/\bRnb\b/gi, "R&B")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .replace(/\bK-Pop\s*[-/]\s*K-Pop\b/gi, "K-Pop")
    .replace(/\bJ-Pop\s*[-/]\s*J-Pop\b/gi, "J-Pop")
    .replace(/\bAlternative\s+R&B\s*[-/]\s*R&B\b/gi, "Alternative R&B")
    .replace(/\bAlternative\s+R&B\s*[-/]\s*Rnb\b/gi, "Alternative R&B")
    .replace(/\bR&B\s*[-/]\s*R&B\b/gi, "R&B")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameGenreFamily(a: string, b: string): boolean {
  const normalize = (value: string) =>
    normalizePromptGenreLabel(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.includes(y) || y.includes(x);
}

function uniqueGenreLabels(values: string[]): string[] {
  const result: string[] = [];
  values
    .map(normalizePromptGenreLabel)
    .filter(Boolean)
    .forEach((label) => {
      if (!result.some((existing) => isSameGenreFamily(existing, label))) {
        result.push(label);
      }
    });
  return result;
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
  const rawGenreLabel =
    rawGenre && rawGenre !== "null" && rawGenre !== "undefined"
      ? sentenceCase(rawGenre)
      : "";

  // IMPORTANT: the deepest selected sub-genre is the song body.
  // Do not append stale parent genre values such as K-Pop/J-Pop/R&B after a child
  // genre is already selected. This prevents outputs like "7080 Folk with K-Pop color"
  // and duplicated labels like "Alternative R&B-Rnb".
  let genreParts = subLabels.length
    ? uniqueGenreLabels(subLabels).slice(0, 1)
    : uniqueGenreLabels([
        genreMeta?.label || "",
        params.isKpopSelected ? "K-Pop" : "",
        rawGenreLabel,
      ].filter(Boolean)).slice(0, 1);

  if (!genreParts.length) {
    genreParts = params.isKpopSelected
      ? ["K-Pop"]
      : styleLabels.length
        ? ["Korean pop"]
        : ["Pop"];
  }

  let genreCore = genreParts[0];

  if (
    !genreCore ||
    /^thin|^isolated|^cold|^floating|^lonely|^dreamy|^bittersweet/i.test(
      genreCore,
    )
  ) {
    genreCore = params.isKpopSelected ? "K-Pop" : "Pop";
  }

  const stylePhrase = joinPromptPhrase(styleLabels.slice(0, 2), "and");
  const moodPhrase = joinPromptPhrase(moodWords, "and");

  const cleanGenreCore = normalizePromptGenreLabel(genreCore);
  const cleanStyle = stylePhrase
    .replace(/Style$/i, "style")
    .trim();

  let sentence = moodPhrase
    ? `A ${moodPhrase} ${cleanGenreCore} track`
    : `A ${cleanGenreCore} track`;
  if (cleanStyle) sentence = `${sentence} with ${cleanStyle}`;

  return cleanupPromptTail(sentence) || "A pop track";
}


type GenrePromptProfile = {
  id: string;
  label: string;
  style: string;
  sound: string;
  vocal: string;
};

function lookupPromptRecord<T>(
  record: Record<string, T>,
  id: string | null | undefined,
): T | undefined {
  const raw = String(id || "").trim();
  if (!raw) return undefined;
  const candidates = Array.from(
    new Set([
      raw,
      raw.toLowerCase(),
      raw.replace(/-/g, "_"),
      raw.replace(/_/g, "-"),
      raw.toLowerCase().replace(/-/g, "_"),
      raw.toLowerCase().replace(/_/g, "-"),
    ]),
  );
  return candidates.map((key) => record[key]).find(Boolean);
}

function findHierarchySubGenre(id: string) {
  const normalized = id.toLowerCase();
  for (const group of GENRE_HIERARCHY) {
    for (const mid of group.children) {
      const found = mid.children.find(
        (child) =>
          child.id.toLowerCase() === normalized ||
          child.id.toLowerCase().replace(/-/g, "_") ===
            normalized.replace(/-/g, "_"),
      );
      if (found) return found;
    }
  }
  return null;
}

function getGenrePromptProfile(params: GenerateSongParams): GenrePromptProfile {
  const subId = (params.subGenre ?? []).find(Boolean) || "";
  const genreId = String(params.genre || "").trim();

  if (subId) {
    const subPrompt = lookupPromptRecord(SUB_GENRE_PROMPTS, subId) || {};
    const subItem = findHierarchySubGenre(subId);
    return {
      id: subId,
      label: normalizePromptGenreLabel(subItem?.label || sentenceCase(subId)),
      style: cleanPromptValue((subPrompt as any).style || ""),
      sound: cleanPromptValue((subPrompt as any).sound || ""),
      vocal: cleanPromptValue((subPrompt as any).vocal || ""),
    };
  }

  const midPrompt = lookupPromptRecord(MID_GENRE_PROMPTS, genreId) || {};
  const genreMeta = getGenreMeta(genreId);
  return {
    id: genreId || "pop",
    label: normalizePromptGenreLabel(
      genreMeta?.label || (genreId ? sentenceCase(genreId) : "Pop"),
    ),
    style: cleanPromptValue((midPrompt as any).style || genreMeta?.promptCore || ""),
    sound: cleanPromptValue((midPrompt as any).sound || ""),
    vocal: cleanPromptValue((midPrompt as any).vocal || ""),
  };
}

type StyleRecipeProfile = {
  genreLens: string;
  productionLens: string;
  arrangementLens: string;
};

function selectedStyleText(params: GenerateSongParams): string {
  return (params.styles ?? [])
    .map((id) => {
      const item = resolveStyleItem(id);
      return [
        id,
        item?.label,
        item?.labelKo,
        item?.style,
        item?.sound,
        item?.mood,
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ")
    .toLowerCase();
}

function countSelectedStyleMatches(
  params: GenerateSongParams,
  patterns: RegExp[],
): number {
  return (params.styles ?? []).filter((id) => {
    const item = resolveStyleItem(id);
    const text = [
      id,
      item?.label,
      item?.labelKo,
      item?.style,
      item?.sound,
      item?.mood,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return patterns.some((pattern) => pattern.test(text));
  }).length;
}

function buildStyleRecipeProfile(params: GenerateSongParams): StyleRecipeProfile {
  const stageSwitchCount = countSelectedStyleMatches(params, [
    /stage|전환|drop|드롭|twist|반전|horror|호러|붕괴|collapse|chaos|광기|공격성|darktrap|theater/,
  ]);
  const hookCount = countSelectedStyleMatches(params, [
    /hook|훅|chorus|후렴|catchy|chant|떼창|repeat|반복|addictive|중독/,
  ]);
  const spaceCount = countSelectedStyleMatches(params, [
    /space|공간|reverb|잔향|room|hall|tunnel|radio|phone|underwater|수중|우주|성당|클럽|distance|멀리/,
  ]);
  const vocalCount = countSelectedStyleMatches(params, [
    /vocal|보컬|sing|spoken|말하듯|whisper|속삭|pleading|애원|gritty|거친|breath|숨|emotion|감정/,
  ]);
  const rhythmCount = countSelectedStyleMatches(params, [
    /rhythm|리듬|groove|그루브|bounce|바운스|funk|펑키|shuffle|셔플|swing|스윙|dance|댄스/,
  ]);
  const synthCount = countSelectedStyleMatches(params, [
    /synth|신스|electronic|전자|edm|future|glitch|cyber|analog|neon|pad/,
  ]);
  const bandCount = countSelectedStyleMatches(params, [
    /band|밴드|guitar|기타|drum|드럼|piano|피아노|live|라이브|amp|앰프/,
  ]);
  const cinematicCount = countSelectedStyleMatches(params, [
    /cinematic|시네마|ost|orchestra|오케스트라|trailer|영화|string|스트링|heroic|웅장/,
  ]);
  const eraCount = countSelectedStyleMatches(params, [
    /70s|80s|90s|2000s|2010s|2020s|y2k|retro|레트로|vintage|빈티지|cassette|카세트|radio|라디오|mp3/,
  ]);

  const genreLenses: string[] = [];
  const productionLenses: string[] = [];
  const arrangementLenses: string[] = [];

  if (stageSwitchCount >= 2 && hookCount >= 1) {
    genreLenses.push("with a hook-driven stage-switching design");
    productionLenses.push("sharp switch drops and addictive hook returns");
    arrangementLenses.push("sudden section flips with recurring hook payoffs");
  } else if (stageSwitchCount >= 1) {
    genreLenses.push("with dramatic section-switch color");
    productionLenses.push("stage-shift transitions");
    arrangementLenses.push("clear contrast between sections");
  } else if (hookCount >= 1) {
    genreLenses.push("with a hook-centered pop design");
    productionLenses.push("catchy hook emphasis");
    arrangementLenses.push("hook returns that anchor the structure");
  }

  if (spaceCount >= 1) productionLenses.push("defined spatial depth");
  if (vocalCount >= 1) genreLenses.push("colored by expressive vocal texture");
  if (rhythmCount >= 1) productionLenses.push("elastic rhythmic movement");
  if (synthCount >= 1) productionLenses.push("synth-space texture");
  if (bandCount >= 1) productionLenses.push("live-performance body");
  if (cinematicCount >= 1) arrangementLenses.push("cinematic scene-building lift");
  if (eraCount >= 1) productionLenses.push("era-specific mix color");

  return {
    genreLens: joinPromptPhrase(genreLenses.slice(0, 2), "and"),
    productionLens: phraseListForPrompt(productionLenses.slice(0, 4)),
    arrangementLens: phraseListForPrompt(arrangementLenses.slice(0, 3)),
  };
}

function buildDetailLayerGenreLens(detailLayer: string): string {
  const note = String(detailLayer || "").trim();
  if (!note) return "";
  const profile = buildFreeTextDirectorProfile(note);
  const parts = [profile.mood, profile.theme, profile.arrangement]
    .map((part) => stripRemainingKoreanForProductionPrompt(part))
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "";
  return cleanupPromptTail(`reimagined through ${joinPromptPhrase(parts, "and")}`);
}

function buildSituationGenreLens(params: GenerateSongParams): string {
  if (!hasSituation(params.situation)) return "";
  const scene = stripRemainingKoreanForProductionPrompt(compactSituationScene(params));
  const version = compactVersionTone(
    String(params.situation?.versionLabel || params.situation?.version || ""),
  );
  const parts = [scene, version ? `${version} dramatic tone` : ""]
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "scene-led genre reinterpretation";
  return cleanupPromptTail(`reinterpreted around ${joinPromptPhrase(parts, "and")}`);
}

type GenreReinterpretationLayer = {
  genreLens: string;
  productionLens: string;
  arrangementLens: string;
};

function buildGenreReinterpretationLayer(
  params: GenerateSongParams,
  detailLayer: string,
): GenreReinterpretationLayer {
  const genreProfile = getGenrePromptProfile(params);
  const styleRecipe = buildStyleRecipeProfile(params);
  const genreStyle = takeCommaItems(genreProfile.style, 2, 82);
  const userLens = buildDetailLayerGenreLens(detailLayer);
  const situationLens = buildSituationGenreLens(params);

  const moodLens = getMoodWordsForMusicDirection(params).length
    ? `shaped by ${joinPromptPhrase(getMoodWordsForMusicDirection(params), "and")} emotion`
    : "";

  // Priority: Situation > user command > selected keywords > genre defaults.
  // The selected genre always remains the body; these lenses only reinterpret it.
  const genreLens = joinPromptPhrase(
    [
      situationLens,
      !situationLens ? userLens : "",
      !situationLens && !userLens ? styleRecipe.genreLens : styleRecipe.genreLens,
      !situationLens && !userLens && !styleRecipe.genreLens ? genreStyle : "",
      !situationLens && !userLens && !styleRecipe.genreLens ? moodLens : "",
    ].filter(Boolean).slice(0, 3),
    "and",
  );

  const productionLens = phraseListForPrompt(
    [
      styleRecipe.productionLens,
      genreProfile.sound ? takeCommaItems(genreProfile.sound, 2, 70) : "",
      userLens && !hasSituation(params.situation)
        ? takeCommaItems(buildFreeTextDirectorProfile(detailLayer).sound, 2, 70)
        : "",
    ].filter(Boolean).slice(0, 4),
  );

  const arrangementLens = phraseListForPrompt(
    [
      styleRecipe.arrangementLens,
      userLens && !hasSituation(params.situation)
        ? takeCommaItems(buildFreeTextDirectorProfile(detailLayer).arrangement, 2, 70)
        : "",
    ].filter(Boolean).slice(0, 3),
  );

  return {
    genreLens: cleanupPromptTail(limitText(genreLens, 150)),
    productionLens: cleanupPromptTail(limitText(productionLens, 145)),
    arrangementLens: cleanupPromptTail(limitText(arrangementLens, 110)),
  };
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
      .replace(/\ba\s+and\s+emotional\s+scene\b/gi, "a tense emotional scene")
      .replace(/\ban\s+and\s+emotional\s+scene\b/gi, "a tense emotional scene")
      .replace(/\ba\s+emotional\s+scene\b/gi, "an emotional scene")
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
    const cleanFallback = cleanupPromptTail(
      fallback
        .toLowerCase()
        .replace(/\ba\s+and\s+emotional\s+scene\b/gi, "an emotional scene")
        .replace(/\ba\s+emotional\s+scene\b/gi, "an emotional scene")
        .replace(/\band\s+emotional\s+scene\b/gi, "emotional scene")
        .replace(/\s{2,}/g, " "),
    );
    if (cleanFallback && cleanFallback !== "an emotional scene") {
      return cleanupPromptTail(
        `built around ${cleanFallback}, where ${storyFunction}`,
      );
    }
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
  const splitPrompt = buildMemberVocalSplit(params);
  if (info.isMulti && splitPrompt) {
    return splitPrompt;
  }

  if (info.isSolo && info.total === 0) {
    const globalEmotion = params.vocal?.globalToneId
      ? resolveVocalEmotionShort(params.vocal.globalToneId)
      : "";
    const emotionPart = globalEmotion ? ` with ${globalEmotion} emotion` : "";
    return `one suitable solo vocalist chosen to match the genre and mood${emotionPart}, with natural emotional delivery`;
  }

  const gender =
    info.gender === "female"
      ? "female"
      : info.gender === "male"
        ? "male"
        : "vocal";
  const globalEmotion = params.vocal?.globalToneId
    ? resolveVocalEmotionShort(params.vocal.globalToneId)
    : "";
  const subject = gender === "vocal" ? "vocal" : `${gender} vocal`;
  const base = naturalVocalPrefix(params, subject);
  return globalEmotion ? `${base} with ${globalEmotion} emotion` : withOptionalToneAndBreath(base, "natural");
}

function buildSituationVocals(params: GenerateSongParams): string {
  const situation = params.situation;
  if (!hasSituation(situation)) return "";

  const info = getVocalModeInfo(params.vocal);
  const formation = info.isMulti
    ? naturalVocalPrefixTitle(params, info.mode === "group" ? "group" : "duo")
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

  const roleGenderFormation = (() => {
    if (!info.isMulti || roleEntries.length < 2) return formation;
    const inferred = roleEntries.slice(0, 2).map((entry, index) =>
      entry.genderHint || inferRoleGenderFromText(entry.role) || (index === 0 ? "male" : "female"),
    );
    if (inferred.every((gender) => gender === "male"))
      return naturalVocalPrefixTitle(params, info.mode === "group" ? "male group" : "male duo");
    if (inferred.every((gender) => gender === "female"))
      return naturalVocalPrefixTitle(params, info.mode === "group" ? "female group" : "female duo");
    return naturalVocalPrefixTitle(params, info.mode === "group" ? "mixed group" : "duet");
  })();

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
    const first = buildCharacterVocalSplitItem(
      params,
      roleEntries[0].role,
      0,
      matchedIndexes[0],
    );
    const second = buildCharacterVocalSplitItem(
      params,
      roleEntries[1].role,
      1,
      matchedIndexes[1],
    );
    const development = String(
      situation?.developmentCustom || situation?.developmentPreset || situation?.development || "",
    );
    const dev = arrangementDevelopmentToEnglish(development);
    const isParallelMonologue = /평행|독백|parallel|monologue/.test(`${development} ${dev}`.toLowerCase());
    const ownershipRule = isParallelMonologue
      ? "Keep each character clearly separated by section; choruses/hooks must be owned by one character, not alternating dialogue; the other character may only add one short parenthetical aside"
      : "Keep each character clearly separated by section; use call-response only when the arrangement explicitly needs it";
    return `2-character vocal split: ${first}. ${second}. ${ownershipRule}`;
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
  const devLower = `${development} ${dev}`.toLowerCase();
  const isParallelMonologue = /평행|독백|parallel|monologue|unresolved parallel-line/.test(devLower);
  const isExplicitCallResponse = /콜앤|call[-\s]?response|리스폰스/.test(devLower);
  const isConversationDriven = /대화|dialogue|bicker|티격태격|받아치|push-and-reply/.test(devLower);

  let base = "";
  if (isDialogue) {
    if (isParallelMonologue) {
      base = `${dev || "parallel monologue sections"} with single-owner choruses, no balanced call-response`;
    } else if (isExplicitCallResponse) {
      base = `${dev || "call-response dialogue"} with a controlled call-response hook`;
    } else if (isConversationDriven) {
      base = `${dev || "separated dialogue sections"} with section-led ownership, not every chorus as A/B dialogue`;
    } else {
      base = `${dev || "separated character sections"} with one-speaker chorus focus`;
    }
  } else {
    base = `${dev || "solo narrative flow"} with section emotion tags and line ad-libs`;
  }

  return cleanupPromptTail(limitText(base, 112));
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
  const targetLimit = 1050;

  if (countBody() <= targetLimit) return current;

  // Keep the music identity readable. The prompt body now allows up to 500 chars,
  // while [Audio quality improved to masterpiece] remains outside this limit.
  // Compress only when the body exceeds 500, and preserve [Vocals] as much as possible.
  const firstPassLimits: Record<string, number> = {
    Genre: 125,
    Instruments: 90,
    Atmosphere: 150,
    Vocals: allowExtendedVocalPrompt ? 360 : 220,
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
    Vocals: allowExtendedVocalPrompt ? 320 : 190,
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
  return sanitizeTrackOpeningArtifacts(limitText(`${base}${separator}${setting}.`, 255));
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

function sanitizePromptGenreArtifacts(line: string): string {
  return cleanupPromptTail(
    String(line || "")
      .replace(/\bK-Pop\s*[-/]\s*Kpop\b/gi, "K-Pop")
      .replace(/\bKpop\s*[-/]\s*K-Pop\b/gi, "K-Pop")
      .replace(/\bJ-Pop\s*[-/]\s*Jpop\b/gi, "J-Pop")
      .replace(/\bJpop\s*[-/]\s*J-Pop\b/gi, "J-Pop")
      .replace(/\bAlternative\s+R&B\s*[-/]\s*Rnb\b/gi, "Alternative R&B")
      .replace(/\bAlternative\s+R&B\s*[-/]\s*R&B\b/gi, "Alternative R&B")
      .replace(/\bR&B\s*[-/]\s*Rnb\b/gi, "R&B")
      .replace(/\bR&B\s*[-/]\s*R&B\b/gi, "R&B")
      .replace(/\s{2,}/g, " "),
  );
}


function sanitizeTrackOpeningArtifacts(value: string): string {
  let line = cleanupPromptTail(String(value || "").replace(/\s+/g, " "));

  line = line
    .replace(/\bshaped\s+by\s+a\s+and\s+emotional\s+scene\s+where\s+/gi, "built around ")
    .replace(/\bshaped\s+by\s+a\s+and\s+emotional\s+scene\b/gi, "built around emotional tension")
    .replace(/\bshaped\s+by\s+an\s+emotional\s+scene\s+where\s+/gi, "built around ")
    .replace(/\bshaped\s+by\s+a\s+tense\s+emotional\s+scene\s+where\s+/gi, "built around ")
    .replace(/\ba\s+and\s+emotional\s+scene\b/gi, "a tense emotional scene")
    .replace(/\ban\s+and\s+emotional\s+scene\b/gi, "a tense emotional scene")
    .replace(/\ba\s+emotional\s+scene\b/gi, "an emotional scene")
    .replace(/\bwhere\s+the\s+singer\s+insists\s+they\s+are\s+fine\s+while\s+the\s+details\s+say\s+otherwise,\s*where\s+/gi, "where ")
    .replace(/\bwhere\s+a\s+tiny\s+everyday\s+conflict\s+carries\s+the\s+whole\s+relationship,\s*where\s+a\s+tiny\s+/gi, "where a tiny ")
    .replace(/\bwhere\s+short\s+rhythmic\s+phrases\s+shape\s+the\s+emotional\s+groove,\s*where\s+short\s+rhythmic\s+/gi, "where short rhythmic ")
    .replace(/\bbuilt\s+around\s+built\s+around\b/gi, "built around")
    .replace(/\bwith\s+with\b/gi, "with")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ");

  line = line.replace(
    /with\s+a\s+denial-under-the-surface\s+arc,\s*built\s+around\s+the\s+singer\s+insists\s+they\s+are\s+fine\s+while\s+the\s+details\s+say\s+otherwise/gi,
    "built around emotional denial and small revealing details",
  );
  line = line.replace(
    /with\s+a\s+phrase-rhythm\s+driven\s+feel,\s*built\s+around\s+short\s+rhythmic\s+phrases\s+shape\s+the\s+emotional\s+groove/gi,
    "built around phrase-driven emotional rhythm",
  );
  line = line.replace(
    /with\s+a\s+micro-conflict\s+emotional\s+lens,\s*built\s+around\s+a\s+tiny\s+everyday\s+conflict\s+carries\s+the\s+whole\s+relationship/gi,
    "built around a tiny everyday conflict that carries the relationship",
  );

  return cleanupPromptTail(line);
}

function sanitizeNonSituationVocalPrompt(value: string): string {
  return cleanupPromptTail(
    String(value || "")
      .replace(/\s+vs\s+/gi, " and ")
      .replace(/\bmale\s+and\s+male\s+contrast\b/gi, "layered male vocal colors")
      .replace(/\bfemale\s+and\s+female\s+contrast\b/gi, "layered female vocal colors")
      .replace(/\bnatural\s+male\s+and\s+natural\s+male\s+contrast\b/gi, "natural layered male vocal colors")
      .replace(/\bnatural\s+female\s+and\s+natural\s+female\s+contrast\b/gi, "natural layered female vocal colors")
      .replace(/\bcontrast\b/gi, "layering")
      .replace(/\s{2,}/g, " "),
  );
}

function sanitizeProductionPromptTail(value: string): string {
  let line = cleanupPromptTail(String(value || "").replace(/\s+/g, " "));

  // When prompt compaction cuts the last word of a common phrase, complete it
  // instead of leaving fragments like "clear sectional".
  line = line
    .replace(/\bclear\s+sectional\s*$/i, "clear sectional contrast")
    .replace(/\bsectional\s*$/i, "sectional contrast")
    .replace(/\bslow-drag\s*$/i, "slow-drag weighted sections")
    .replace(/\bweighted\s*$/i, "weighted sections")
    .replace(/\bstop-start\s*$/i, "stop-start drum movement")
    .replace(/\bcyber\s+glitch\s*$/i, "cyber glitch details")
    .replace(/\brhythmic\s*$/i, "rhythmic shocks")
    .replace(/\bmetallic\s+synth\s*$/i, "metallic synth details")
    .replace(/\b808-weighted\s+rhythm\s*$/i, "808-weighted rhythm pressure")
    .replace(/\brepeating\s+texture\s*$/i, "repeating texture shifts")
    .replace(/\bclipped\s+phrase\s*$/i, "clipped phrase breaks")
    .replace(/\bsyncopated\s+trap\s*$/i, "syncopated trap accents")
    .replace(/\bwith\s*$/i, "")
    .replace(/,\s*$/g, "")
    .trim();

  return cleanupPromptTail(line);
}

function ensureProductionTempoPhrase(production: string, tempoPhrase: string): string {
  let line = sanitizeProductionPromptTail(production)
    .replace(/\s+with\s+tempo\s+set\s+to\s*$/i, "")
    .replace(/\s+tempo\s+set\s+to\s*$/i, "")
    .replace(/\s+Tempo:\s*$/i, "")
    .replace(/,\s*$/g, "")
    .trim();

  const tempo = String(tempoPhrase || "").trim();
  if (!tempo) return line;

  const bpm = tempo.match(/(\d{2,3}\s*[–-]\s*\d{2,3}|\d{2,3})\s*BPM/i)?.[0];
  if (!bpm) return line;
  if (/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b|\b\d{2,3}\s*BPM\b/i.test(line)) return line;

  // Keep tempo as a compact sentence so long sound palettes cannot cut it in half.
  return `${line}. Tempo: ${bpm.replace(/\s+/g, " ")}.`;
}

function buildHybridProductionLine(
  instruments: string,
  arrangement: string,
  productionVariation = "",
): string {
  const variationSoundItems = cleanPromptValue(productionVariation)
    .split(",")
    .map((item) => cleanupPromptTail(item).replace(/\.+$/g, "").trim())
    .filter(Boolean);

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

  const soundPhrase = phraseListForPrompt(
    [...variationSoundItems, ...soundItems].slice(0, 5),
  );
  const performancePhrase = phraseListForPrompt(
    [...feelItems, ...arrangementItems].slice(0, 5),
  );

  const production = soundPhrase
    ? performancePhrase
      ? `${soundPhrase} with ${performancePhrase}`
      : soundPhrase
    : performancePhrase || "a focused instrumental palette with clear movement";

  return sanitizeProductionPromptTail(
    limitText(
      cleanProductionPhrase(production)
        .replace(/\bwith a call-response hook echo-and-undercut hook\b/gi, "with a call-response hook and echo-and-undercut tension")
        .replace(/\bcall-response hook echo-and-undercut hook\b/gi, "call-response hook and echo-and-undercut tension")
        .replace(/\s{2,}/g, " "),
      230,
    ),
  );
}

function compactHybridPromptBody(lines: string[]): string[] {
  let current = [...lines];
  const countBody = () => current.join("\n").length;
  const targetLimit = 1050;
  if (countBody() <= targetLimit) return current;

  const firstPassLimits: Record<string, number> = {
    Track: 250,
    Vocals: 520,
    Production: 230,
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
    Track: 220,
    Vocals: 440,
    Production: 190,
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
  const reinterpretationLayer = buildGenreReinterpretationLayer(params, detailLayer);
  const genre = appendPromptLens(
    appendPromptLens(baseGenre, reinterpretationLayer.genreLens, 210),
    variation.genreLens,
    230,
  );
  const instruments = appendPromptLens(
    isFreeTextPrimaryMode(params)
      ? buildFreeTextDirectorProfile(detailLayer).sound
      : cleanPromptValue(buildSound(params)),
    reinterpretationLayer.productionLens,
    190,
  );
  const baseAtmosphere = getAtmosphereForPrompt(params, detailLayer);
  const atmosphere = situationActive
    ? buildVariedSituationAtmosphere(params, variation)
    : appendPromptLens(baseAtmosphere, variation.atmosphereLens, 170);
  const baseVocals = situationActive
    ? buildSituationVocals(params)
    : buildNaturalVocals(params, detailLayer);
  // Keep variation out of [Vocals]. Variation belongs to the track sentence and [Production]
  // so the vocal line never ends with cut fragments like "through" or "as".
  // In normal non-Situation mode, never use "vs". It makes a single/group vocal sound
  // like a dialogue battle even when the user did not select a conflict structure.
  const vocals = situationActive
    ? sanitizeVocalDirection(baseVocals)
    : sanitizeNonSituationVocalPrompt(sanitizeVocalDirection(baseVocals));
  const arrangementBase = situationActive
    ? buildSituationArrangement(params)
    : isFreeTextPrimaryMode(params)
      ? buildFreeTextDirectorProfile(detailLayer).arrangement
      : cleanPromptValue(buildArrangement(params, resolvedStructure));
  const variedArrangementBase = appendPromptLens(
    appendPromptLens(arrangementBase, reinterpretationLayer.arrangementLens, 145),
    variationArrangementMeaning(variation),
    165,
  );
  const tempoPhrase = buildTempoPromptPhrase(params);
  const arrangement = tempoPhrase
    ? `${tempoPhrase}, ${variedArrangementBase}`
    : variedArrangementBase;

  const trackLine = buildHybridTrackLine(params, genre, atmosphere, variation);
  const productionVariation = variationProductionMeaning(variation, params);
  const production = ensureProductionTempoPhrase(
    buildHybridProductionLine(
      instruments,
      arrangement,
      productionVariation,
    ),
    tempoPhrase,
  );

  const bodyLines = compactHybridPromptBody([
    trackLine,
    `[Vocals] ${cleanupPromptTail(vocals).replace(/^natural\b/i, "Natural")}`,
    `[Production] ${cleanupPromptTail(production)}`,
  ]);

  const finalBodyLines = bodyLines.map((line) => {
    const cleaned = cleanupPromptTail(
      cleanProductionPhrase(line)
        .replace(/Fretless/gi, "fretless")
        .replace(/\bthrough\s+becoming\b/gi, "where it becomes")
        .replace(/\bshaped\s+by\s+a\s+and\s+emotional\s+scene\s+where\s+/gi, "built around ")
        .replace(/\bshaped\s+by\s+a\s+and\s+emotional\s+scene\b/gi, "built around emotional tension")
        .replace(/\ba\s+and\s+emotional\s+scene\b/gi, "a tense emotional scene")
        .replace(/\bwhere a tiny everyday conflict carries the whole relationship, where a tiny\b/gi, "where a tiny everyday conflict carries the whole relationship")
        .replace(/\bwhere short rhythmic phrases shape the emotional groove, where short rhythmic\b/gi, "where short rhythmic phrases shape the emotional groove"),
    );
    const genreCleaned = sanitizePromptGenreArtifacts(cleaned);
    if (line.startsWith("[Production]")) {
      return genreCleaned.replace(/^\[Production\]\s*/i, "[Production] ").replace(/^(\[Production\]\s*)(.*)$/i, (_, head, body) => `${head}${sanitizeProductionPromptTail(body)}`);
    }
    return line.startsWith("[") ? genreCleaned : sanitizeTrackOpeningArtifacts(genreCleaned);
  });

  return enforceEnglishProductionPrompt(
    [...finalBodyLines, `[Audio quality improved to masterpiece]`].join("\n"),
  );
}


function isSingleGenderVocalGroup(params: GenerateSongParams): boolean {
  const info = getVocalModeInfo(params.vocal);
  return info.total >= 2 && (info.gender === "female" || info.gender === "male");
}

function sanitizeLyricTagGenderNoise(line: string, params: GenerateSongParams): string {
  if (!isSingleGenderVocalGroup(params)) return line;
  // In all-female/all-male groups, the [Vocals] prompt already states gender.
  // Keep lyric tags compact: [Rap Vocal: husky flow], not [Rap Vocal: female, husky flow].
  return line
    .replace(
      /\[([^\]\n:]+ Vocal[^\]\n:]*):\s*(?:female|male)\s*,\s*([^\]]*)\]/gi,
      (_, label, desc) => `[${String(label).trim()}: ${String(desc).trim()}]`,
    )
    .replace(
      /\[([^\]\n:]+ Vocal[^\]\n]*)\s*[-–]\s*(?:female|male)\s*,\s*([^\]]*)\]/gi,
      (_, label, desc) => `[${String(label).trim()}: ${String(desc).trim()}]`,
    );
}


function compactLyricTagCuePhrase(value: string): string {
  const raw = String(value || "")
    .replace(/\b(female|male|vocal|voice|tone|texture|delivery|emotion|attitude)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = raw.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/clear.*bright|bright.*clear/, "clear bright"],
    [/airy|floating|relaxed/, "airy"],
    [/low.*husky|husky.*off|off[-\s]?beat/, "husky off-beat"],
    [/whisper|breathy/, "breathy"],
    [/stylish|swagger|sassy/, "stylish"],
    [/sharp|cutting/, "sharp"],
    [/hidden pain|smiling.*pain|crying inside|wounded/, "hidden pain"],
    [/resentful|longing|yearning|lingering/, "longing"],
    [/numb|empty|resigned/, "numb"],
    [/drained|exhausted/, "drained"],
    [/guarded|push|fear|get hurt|distance/, "guarded"],
    [/suppressed anger|rage|anger/, "suppressed anger"],
    [/insecure|terrified|losing|anxious/, "anxious"],
    [/awkward|sincere|careful/, "sincere"],
    [/regret|self[-\s]?blame|guilt/, "self-blame"],
    [/secret|hiding|held back/, "secretive"],
    [/choked|overwhelmed|gratitude/, "choked up"],
    [/liberat|free|burden|release|cathartic/, "liberated"],
    [/sarcastic|cynical|irony/, "cynical"],
    [/fragile|tearful|vulnerable/, "fragile"],
    [/tense|tension|breathless/, "tense"],
    [/playful|lighthearted|teasing/, "playful"],
    [/warm|comfort|tender/, "warm"],
    [/dream|ethereal|hazy/, "dreamy"],
  ];
  for (const [pattern, cue] of rules) {
    if (pattern.test(lower)) return cue;
  }
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function compactLyricVocalTagLine(line: string): string {
  return String(line || "").replace(
    /\[((?:[A-Za-z가-힣0-9 ]+\s)?(?:Main|Lead|Sub|Airy|Harmony|Whisper|Low\s+Rap|Rap|Bridge|Stylish\s+Rap|Whisper\s+Rap)\s+Vocal|Together)\s*:\s*([^\]]+)\]/gi,
    (_, label, desc) => {
      const chunks = String(desc || "")
        .split(/[,/]|\band\b/gi)
        .map((part) => compactLyricTagCuePhrase(part))
        .filter(Boolean);
      const unique: string[] = [];
      for (const chunk of chunks) {
        const normalized = chunk.toLowerCase();
        if (!unique.some((item) => item.toLowerCase() === normalized)) unique.push(chunk);
        if (unique.length >= 2) break;
      }
      const compact = unique.join(", ");
      return compact ? `[${String(label).trim()}: ${compact}]` : `[${String(label).trim()}]`;
    },
  );
}

function sanitizeCompositeSectionVocalTag(line: string): string {
  let cleaned = String(line || "");

  // Suno generally follows composite sung-section tags better than split tags:
  // [Verse: Airy Female Vocal, pleading]. Do NOT break these apart.
  // Only normalize legacy section names while preserving the composite tag body.
  cleaned = cleaned.replace(/^\s*\[Rap\s+Verse([^\]]*)\]/i, (_, rest) => `[Rap Section${rest}]`);

  // Normalize tag-only variants using " - ..." into colon style, but keep section composites intact.
  cleaned = cleaned.replace(
    /^\s*\[((?:Main|Lead|Sub|Airy|Harmony|Whisper|Low\s+Rap|Rap|Bridge|Stylish\s+Rap|Whisper\s+Rap)\s+Vocal)\s*[-–]\s*([^\]]*)\]\s*/i,
    (_, role, desc) => `[${String(role).trim()}: ${String(desc).trim()}] `,
  );

  return cleaned.trimEnd();
}

function isBracketTag(line: string): boolean {
  return /^\[[^\]]+\]$/.test(line.trim());
}

function isBrokenBracketPlaceholder(line: string): boolean {
  return /^\[\s*(?:\d+|[:;,.-]*)\s*\]\s*$/i.test(line.trim());
}

function stripBrokenBracketPrefix(line: string): string {
  return line.replace(/^\s*(?:\[\s*(?:\d+|[:;,.-]*)\s*\]\s*)+/i, "").trimStart();
}

function isVocalRoleTag(line: string): boolean {
  return /^\[[^\]]*(?:Vocal|Rap Vocal|Lead Vocal|Main Vocal|Harmony Vocal|Whisper Vocal|Airy Vocal|Together)[^\]]*\]$/i.test(
    line.trim(),
  );
}

function extractVocalRoleTag(line: string): string | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(\[[^\]]*(?:Vocal|Rap Vocal|Lead Vocal|Main Vocal|Harmony Vocal|Whisper Vocal|Airy Vocal|Together)[^\]]*\])/i);
  return match ? match[1] : null;
}

function fillerForEmptySectionTag(tag: string): string {
  const lower = tag.toLowerCase();
  if (/intro/.test(lower)) return "(Instrumental intro)";
  if (/solo/.test(lower)) return "(Instrumental solo)";
  if (/drop/.test(lower)) return "(Beat drop)";
  if (/breakdown|break/.test(lower)) return "(Instrumental break)";
  return "";
}

function situationAcousticDescriptorFromText(value: string): string {
  const raw = String(value || "").toLowerCase();
  if (/reaper|저승|사신|grim|tired|피곤|퇴근|잔소리|nag/.test(raw)) return "Tired";
  if (/ghost|귀신|유령|airy|fragile|pleading|애원|미련/.test(raw)) return "Airy";
  if (/boss|상사|부장|manager|firm|press|command|명령|압박/.test(raw)) return "Firm";
  if (/mother|엄마|어머니|warm|걱정|다정/.test(raw)) return "Warm";
  if (/son|아들|young|defensive|방어/.test(raw)) return "Young";
  if (/low|deep|husky|gritty|낮|허스키/.test(raw)) return "Low";
  if (/dry|spoken|말하듯|건조|무심/.test(raw)) return "Dry";
  if (/sharp|punchy|rap|래|날카|직설/.test(raw)) return "Sharp";
  if (/soft|gentle|fragile|여린|부드/.test(raw)) return "Soft";
  if (/clear|bright|맑|밝/.test(raw)) return "Clear";
  return "Natural";
}

function situationAcousticVoiceTypeFromText(value: string): "Rap" | "Spoken Vocal" | "Vocal" {
  const raw = String(value || "").toLowerCase();
  if (/rap|래|flow|off[-\s]?beat|punchy/.test(raw)) return "Rap";
  if (/spoken|talk|말하듯|dry|건조|대사|narrat/.test(raw)) return "Spoken Vocal";
  return "Vocal";
}

function buildSituationAcousticTagLabel(
  params: GenerateSongParams,
  role: string,
  roleIndex: number,
  memberIndex = roleIndex,
): string {
  const genderHint = inferRoleGenderFromText(role);
  const memberGender = getMemberGenderLabel(params, memberIndex);
  const gender = genderHint === "male" || genderHint === "female" ? genderHint : memberGender;
  const genderTitle = gender === "male" ? "Male" : gender === "female" ? "Female" : "Vocal";
  const memberTone = getMemberToneForPrompt(params, memberIndex);
  const fallbackTone = compactVocalToneForPrompt(inferSituationVocalTone(role, roleIndex));
  const rawStyleSource = [
    params.situation?.speakers?.[roleIndex]?.speechStyle,
    params.situation?.speakers?.[roleIndex]?.attitude,
    roleIndex === 0 ? params.situation?.speakerAStyle : params.situation?.speakerBStyle,
    roleIndex === 0
      ? params.situation?.speakerAAttitude || params.situation?.attitudeA
      : params.situation?.speakerBAttitude || params.situation?.attitudeB,
    role,
    memberTone,
    fallbackTone,
  ]
    .filter(Boolean)
    .join(" ");

  const descriptor = situationAcousticDescriptorFromText(rawStyleSource);
  const voiceType = situationAcousticVoiceTypeFromText(rawStyleSource);

  if (genderTitle === "Vocal") return `${descriptor} ${voiceType}`.replace(/\s+/g, " ").trim();
  return `${descriptor} ${genderTitle} ${voiceType}`.replace(/\s+/g, " ").trim();
}

function getSituationAcousticTagPairs(params: GenerateSongParams): Array<[string, string]> {
  const situation = params.situation;
  if (!hasSituation(situation)) return [];
  const rawRoles = [situation?.targetA, situation?.targetB]
    .map((role) => String(role || "").trim())
    .filter(Boolean);
  const speakerRoles = (situation?.speakers ?? [])
    .slice(0, 2)
    .map((speaker) => String(speaker.role || speaker.id || "").trim())
    .filter(Boolean);
  const roles = (rawRoles.length ? rawRoles : speakerRoles).slice(0, 2);
  const roleEntries: SituationRoleEntry[] = roles.map((role) => ({
    role,
    genderHint: inferRoleGenderFromText(role),
  }));
  const matchedIndexes = getMatchedMemberIndexes(params, roleEntries);
  return roles.map((role, index) => [
    role,
    buildSituationAcousticTagLabel(params, role, index, matchedIndexes[index] ?? index),
  ] as [string, string]);
}

function getSituationAcousticTagLabels(params: GenerateSongParams): string[] {
  return getSituationAcousticTagPairs(params).map(([, label]) => label);
}

function buildSituationDuoAcousticLabel(params: GenerateSongParams): string {
  const labels = getSituationAcousticTagLabels(params);
  const joined = labels.join(" ").toLowerCase();
  if (/male/.test(joined) && /female/.test(joined)) return "All Vocals";
  if (labels.length >= 2 && labels.every((label) => /male/i.test(label))) return "All Male Vocals";
  if (labels.length >= 2 && labels.every((label) => /female/i.test(label))) return "All Female Vocals";
  return "All Vocals";
}

function getSituationEnglishRoleLabels(params: GenerateSongParams): string[] {
  const situation = params.situation;
  if (!hasSituation(situation)) return [];
  const rawRoles = [situation?.targetA, situation?.targetB]
    .map((role) => String(role || "").trim())
    .filter(Boolean);
  const speakerRoles = (situation?.speakers ?? [])
    .slice(0, 2)
    .map((speaker) => String(speaker.role || speaker.id || "").trim())
    .filter(Boolean);
  const roles = (rawRoles.length ? rawRoles : speakerRoles).slice(0, 2);
  return roles.map((role, index) => englishRoleLabel(role, `Character ${index + 1}`));
}

function getSituationRoleLabelPairs(params: GenerateSongParams): Array<[string, string]> {
  const situation = params.situation;
  if (!hasSituation(situation)) return [];
  const rawRoles = [situation?.targetA, situation?.targetB]
    .map((role) => String(role || "").trim())
    .filter(Boolean);
  const speakerRoles = (situation?.speakers ?? [])
    .slice(0, 2)
    .map((speaker) => String(speaker.role || speaker.id || "").trim())
    .filter(Boolean);
  const roles = (rawRoles.length ? rawRoles : speakerRoles).slice(0, 2);
  return roles.map((role, index) => [role, englishRoleLabel(role, `Character ${index + 1}`)] as [string, string]);
}

function cleanCharacterCue(cue: string): string {
  return String(cue || "")
    .replace(/\b(?:male|female|mixed|duet|group)\b\s*,?\s*/gi, "")
    .replace(/^[\s:,，ㆍ·-]+|[\s:,，ㆍ·-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}


function translateKoreanLyricTagCue(value: string): string {
  let text = String(value || "");
  const replacements: Array<[RegExp, string]> = [
    [/저승\s*사자|저승사자|사신/g, "Tired Male Rap"],
    [/귀신|유령/g, "Airy Female Vocal"],
    [/엄마|어머니/g, "Warm Female Vocal"],
    [/아빠|아버지/g, "Dry Male Spoken Vocal"],
    [/아들/g, "Young Male Vocal"],
    [/딸/g, "Young Female Vocal"],
    [/상사|부장/g, "Firm Male Spoken Vocal"],
    [/직원/g, "Bright Female Vocal"],
    [/남성\s*보컬|남자\s*보컬|남성/g, "Male Vocal"],
    [/여성\s*보컬|여자\s*보컬|여성/g, "Female Vocal"],
    [/랩|래핑|래퍼/g, "Rap"],
    [/속삭(?:이는|이듯|임)?|숨\s*섞인/g, "breathy"],
    [/애원(?:하는|하듯)?|부탁(?:하는|하듯)?|간절(?:한|하게)?/g, "pleading"],
    [/후회(?:하는|하듯)?/g, "regretful"],
    [/미련(?:이\s*남은|있는)?/g, "lingering"],
    [/불안(?:한|하게)?|조마조마(?:한|하게)?/g, "anxious"],
    [/분노|화난|화내는/g, "angry"],
    [/차갑(?:게|고|한)?|냉정(?:한|하게)?/g, "cold"],
    [/무심(?:한|하게)?|담담(?:한|하게)?/g, "detached"],
    [/냉소(?:적인|적으로)?|비꼬(?:는|듯)?/g, "cynical"],
    [/지친|피곤(?:한|하게)?/g, "tired"],
    [/잔소리|재촉(?:하는|하듯)?/g, "nagging"],
    [/설득(?:하는|하듯)?/g, "persuading"],
    [/반박(?:하는|하듯)?/g, "rebuttal"],
    [/직설(?:적인|적으로)?|단호(?:한|하게)?/g, "direct"],
    [/부드럽(?:게|고|러운)?|여린/g, "soft"],
    [/위태(?:로운|롭게)?|떨리는|여린/g, "fragile"],
    [/장난(?:스러운|스럽게)?|가볍(?:게|고)?/g, "playful"],
    [/누그러(?:진|지는|지며)?|풀리는/g, "softening"],
    [/후렴|훅/g, "hook"],
    [/대사|말하듯/g, "spoken"],
  ];
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text;
}

function cleanEnglishOnlyLyricTagPart(value: string): string {
  return cleanupPromptTail(
    stripRemainingKoreanForProductionPrompt(translateKoreanLyricTagCue(value))
      .replace(/[()]/g, " ")
      .replace(/\b(?:ui|eun|neun|ga|i|eul|reul)\b/gi, "")
      .replace(/\s*[;|/]\s*/g, ", ")
      .replace(/\s+([,.:])/g, "$1")
      .replace(/[,.:]\s*([,.:])/g, "$1")
      .replace(/^\s*[,.:\-]+\s*|\s*[,.:\-]+\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
}


function translateKoreanStageCueParentheses(line: string): string {
  const trimmed = String(line || "").trim();
  const match = trimmed.match(/^\(([^()]*[가-힣][^()]*)\)$/);
  if (!match) return line;
  const raw = match[1].trim();
  const normalized = raw.replace(/\s+/g, " ");
  const map: Array<[RegExp, string]> = [
    [/희미한\s*도시.*소음|도시.*소음/g, "faint city ambience"],
    [/규칙적인\s*발걸음|발걸음\s*소리/g, "steady footsteps"],
    [/멀어지는\s*발걸음/g, "footsteps fading away"],
    [/시계\s*소리|시계/g, "clock ticking"],
    [/정적/g, "silence"],
    [/비\s*소리|빗소리/g, "rain ambience"],
    [/바람\s*소리/g, "wind ambience"],
    [/문\s*닫히는\s*소리/g, "door closing sound"],
    [/숨\s*소리/g, "breath sound"],
    [/한숨\s*소리|한숨/g, "sigh"],
    [/웃음\s*소리/g, "soft laugh"],
    [/흐느낌/g, "quiet sob"],
    [/비트\s*드롭|드롭/g, "beat drop"],
    [/악기\s*간주|간주/g, "instrumental break"],
  ];
  for (const [pattern, replacement] of map) {
    if (pattern.test(normalized)) return `(${replacement})`;
  }
  // Keep Korean parenthetical lyric/ad-lib lines when they are not obvious stage cues.
  return line;
}

function sanitizeLyricBracketTagToEnglish(line: string, params: GenerateSongParams): string {
  return String(line || "").replace(/\[([^\]\n]{1,180})\]/g, (full, inside) => {
    const rawInside = String(inside || "").trim();
    if (!rawInside) return "";

    const composite = rawInside.match(/^((?:Intro|Verse(?:\s*[A-Z]|\s*\d+)?|Pre[-\s]?Chorus|Chorus(?:\s*\/\s*Drop)?|Hook|Final\s*Hook|Rap\s*Verse|Rap\s*Section|Bridge|Breakdown|Drop|Final\s*Chorus(?:\s*\/\s*Drop)?|Outro|Solo|Instrumental|Build[-\s]?up|Climax|Main\s*Theme|Theme\s*[AB])(?:\s*\/\s*Drop)?)\s*:\s*(.+)$/i);
    if (composite) {
      const sectionName = normalizeLyricSectionNameForGeneration(composite[1].trim());
      const body = String(composite[2] || "").trim();
      const parts = body
        .split(/[,，]/)
        .map((part) => cleanEnglishOnlyLyricTagPart(part))
        .filter(Boolean)
        .slice(0, 3);
      if (!parts.length) return `[${sectionName}]`;
      return `[${sectionName}: ${parts.join(", ")}]`;
    }

    const acousticLabel = hasSituation(params.situation)
      ? findSituationAcousticLabelFromTag(rawInside, params)
      : "";
    if (acousticLabel) {
      const cueMatch = rawInside.match(/[:：,，]\s*(.*)$/);
      const cue = cueMatch ? cleanEnglishOnlyLyricTagPart(cueMatch[1]) : "";
      return `[${acousticLabel}${cue ? `: ${cue}` : ""}]`;
    }

    const cleaned = cleanEnglishOnlyLyricTagPart(rawInside);
    if (!cleaned) return "";
    return `[${cleaned}]`;
  });
}

function findSituationEnglishLabelFromTag(rawTag: string, params: GenerateSongParams): string {
  if (!hasSituation(params.situation)) return "";
  const normalizedTag = String(rawTag || "")
    .replace(/[\[\]]/g, "")
    .replace(/[,，]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!normalizedTag) return "";

  const rolePairs = getSituationRoleLabelPairs(params);
  for (const [raw, english] of rolePairs) {
    const rawClean = String(raw || "").trim();
    const englishClean = String(english || "").trim();
    if (!rawClean && !englishClean) continue;
    if (normalizedTag.toLowerCase() === englishClean.toLowerCase()) return englishClean;
    if (rawClean && normalizedTag.includes(rawClean)) return englishClean;
    if (englishClean && normalizedTag.toLowerCase().includes(englishClean.toLowerCase())) return englishClean;
  }

  // Strong fallback for common situation roles, even if Gemini outputs Korean labels.
  if (/저승\s*사자|저승사자|사신|grim\s*reaper|reaper/i.test(normalizedTag)) return "Grim Reaper";
  if (/귀신|유령|ghost|spirit/i.test(normalizedTag)) return "Ghost";
  if (/엄마|어머니|mother|mom/i.test(normalizedTag)) return "Mother";
  if (/아들|son/i.test(normalizedTag)) return "Son";
  if (/딸|daughter/i.test(normalizedTag)) return "Daughter";
  if (/아빠|아버지|father|dad/i.test(normalizedTag)) return "Father";
  if (/직원|employee/i.test(normalizedTag)) return "Employee";
  if (/상사|boss/i.test(normalizedTag)) return "Boss";

  return "";
}

function findSituationAcousticLabelFromTag(rawTag: string, params: GenerateSongParams): string {
  if (!hasSituation(params.situation)) return "";
  const normalizedTag = String(rawTag || "")
    .replace(/[\[\]]/g, "")
    .replace(/[,，]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!normalizedTag) return "";

  const acousticPairs = getSituationAcousticTagPairs(params);
  const rolePairs = getSituationRoleLabelPairs(params);
  if (/&|together|duo|both|shared harmony/i.test(normalizedTag) && acousticPairs.length >= 2) {
    return buildSituationDuoAcousticLabel(params);
  }
  for (let index = 0; index < acousticPairs.length; index += 1) {
    const [raw, acoustic] = acousticPairs[index];
    const english = rolePairs[index]?.[1] || "";
    const rawClean = String(raw || "").trim();
    const englishClean = String(english || "").trim();
    const acousticClean = String(acoustic || "").trim();
    if (!acousticClean) continue;
    if (normalizedTag.toLowerCase().includes(acousticClean.toLowerCase())) return acousticClean;
    if (englishClean && normalizedTag.toLowerCase().includes(englishClean.toLowerCase())) return acousticClean;
    if (rawClean && normalizedTag.includes(rawClean)) return acousticClean;
  }

  if (/저승\s*사자|저승사자|사신|grim\s*reaper|reaper/i.test(normalizedTag))
    return acousticPairs[0]?.[1] || "Tired Male Rap";
  if (/귀신|유령|ghost|spirit/i.test(normalizedTag))
    return acousticPairs[1]?.[1] || "Airy Female Vocal";
  if (/엄마|어머니|mother|mom/i.test(normalizedTag)) return "Warm Female Vocal";
  if (/아들|son/i.test(normalizedTag)) return "Young Male Vocal";
  if (/딸|daughter/i.test(normalizedTag)) return "Young Female Vocal";
  if (/아빠|아버지|father|dad/i.test(normalizedTag)) return "Dry Male Spoken Vocal";
  if (/직원|employee/i.test(normalizedTag)) return "Bright Female Vocal";
  if (/상사|boss/i.test(normalizedTag)) return "Firm Male Spoken Vocal";

  return "";
}

function normalizeSituationCharacterLyricTag(line: string, params: GenerateSongParams): string {
  if (!hasSituation(params.situation)) return line;
  const source = String(line || "");
  const trimmed = source.trim();
  const match = trimmed.match(/^\[([^\]]{1,120})\](.*)$/);
  if (!match) return line;

  const rawInside = match[1].trim();
  const rest = String(match[2] || "");

  // Composite section tag: [Verse: Ghost, pleading] -> [Verse: Airy Female Vocal, pleading]
  const sectionComposite = rawInside.match(/^((?:Intro|Verse\s*\d*|Pre[-\s]?Chorus|Chorus(?:\s*\([^\]]+\))?|Hook|Rap\s*Verse|Rap\s*Section|Bridge|Breakdown|Drop|Final\s*Chorus|Outro|Solo|Instrumental)(?:\s*\/\s*Drop)?)\s*:\s*(.+)$/i);
  if (sectionComposite) {
    const sectionName = sectionComposite[1].replace(/^Rap\s+Verse$/i, "Rap Section").trim();
    const body = sectionComposite[2].trim();
    const parts = body.split(/[,，]/).map((part) => part.trim()).filter(Boolean);
    const firstPart = parts[0] || body;
    const acousticLabel = findSituationAcousticLabelFromTag(firstPart, params);
    if (!acousticLabel) return line;
    const cues = parts.slice(1).join(", ");
    const cleanCue = cleanCharacterCue(cues);
    return `[${sectionName}: ${acousticLabel}${cleanCue ? `, ${cleanCue}` : ""}]${rest.replace(/^\s*,\s*/, "")}`;
  }

  const acousticLabel = findSituationAcousticLabelFromTag(rawInside, params);
  if (!acousticLabel) return line;

  let cue = "";
  const cueMatch = rawInside.match(/[:：,，]\s*(.*)$/);
  if (cueMatch) cue = cleanCharacterCue(cueMatch[1]);

  return `[${acousticLabel}${cue ? `: ${cue}` : ""}]${rest.replace(/^\s*,\s*/, "")}`;
}

function isGenericVocalRoleTagLabel(label: string): boolean {
  return /^(?:Main|Lead|Sub|Airy|Harmony|Whisper|Low\s+Rap|Rap|Bridge)\s+Vocal$|^Together$/i.test(label.trim());
}

function normalizeGenericTagsInSituationLyrics(lines: string[], params: GenerateSongParams): string[] {
  if (!hasSituation(params.situation)) return lines;
  const labels = getSituationAcousticTagLabels(params);
  if (labels.length < 2) return lines;
  const [firstVoice, secondVoice] = labels;
  const info = getVocalModeInfo(params.vocal);
  if (!info.isMulti) return lines;

  let currentVoice = firstVoice;
  let genericCursor = 0;
  return lines.map((line) => {
    const trimmed = String(line || "").trim();
    const match = trimmed.match(/^\[([^\]:]+)(?::\s*([^\]]*))?\](.*)$/);
    if (!match) return line;
    const label = match[1].trim();
    const cue = String(match[2] || "").trim();
    const rest = String(match[3] || "");

    if (labels.some((item) => item.toLowerCase() === label.toLowerCase())) {
      currentVoice = label;
      return line;
    }

    if (!isGenericVocalRoleTagLabel(label)) return line;

    let replacement = currentVoice;
    if (/together/i.test(label)) {
      replacement = buildSituationDuoAcousticLabel(params);
    } else if (/air|main|lead|sub|harmony/i.test(label)) {
      replacement = secondVoice;
    } else if (/rap|low/i.test(label)) {
      replacement = firstVoice;
    } else {
      replacement = genericCursor % 2 === 0 ? firstVoice : secondVoice;
      genericCursor += 1;
    }
    currentVoice = replacement.includes("&") ? currentVoice : replacement;

    const compactCue = cue
      .replace(/(?:male|female|mixed|duet|group)\s*,?\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^,\s*|,\s*$/g, "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");

    return `[${replacement}${compactCue ? `: ${compactCue}` : ""}]${rest}`;
  });
}


function normalizeGeneratedLyricTagSpacing(lyrics: string): string {
  let text = String(lyrics || "").replace(/\r\n/g, "\n");

  // If Gemini collapses the whole lyric into one paragraph, restore line breaks before tags.
  text = text.replace(/\]\s+(?=\[)/g, "]\n");
  // Situation roles can be arbitrary Korean user labels, so split before any compact bracket tag, not only known Suno tags.
  text = text.replace(/([^\n])\s+(\[[^\]\n]{1,80}\])/g, "$1\n$2");
  text = text.replace(
    /([^\n])\s+(\[(?:Intro|Verse\s*\d*|Pre[-\s]?Chorus|Chorus(?:\s*\([^\]]+\))?|Hook|Rap\s*Verse|Rap\s*Section|Bridge|Breakdown|Drop|Final\s*Chorus|Outro|Solo|Together|Main\s+Vocal|Lead\s+Vocal|Sub\s+Vocal|Airy\s+Vocal|Harmony\s+Vocal|Whisper\s+Rap\s+Vocal|Whisper\s+Vocal|Low\s+Rap\s+Vocal|Rap\s+Vocal)[^\]]*\])/gi,
    "$1\n$2",
  );

  // Normalize empty or broken placeholders that may appear inline.
  text = text.replace(/\[\s*\]/g, "");
  text = text.replace(/\[\s*\d+\s*\]/g, "");
  text = text.replace(/\[\s*[:;,.-]+\s*\]/g, "");
  text = text.replace(/\(\s*[:;,.-]+\s*\)/g, "");

  return text;
}


function isTogetherVocalTag(line: string): boolean {
  return /^\s*\[\s*Together(?:\s*:[^\]]*)?\]\s*$/i.test(String(line || "").trim());
}

function replaceTogetherTagWithSoloRole(line: string, replacement: string): string {
  const trimmed = String(line || "").trim();
  if (!isTogetherVocalTag(trimmed)) return line;
  return `[${replacement}]`;
}

function limitRepeatedTogetherTags(lines: string[], params: GenerateSongParams): string[] {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isMulti) return lines;

  const togetherIndices = lines
    .map((line, index) => (isTogetherVocalTag(line) ? index : -1))
    .filter((index) => index >= 0);

  if (togetherIndices.length <= 2) return lines;

  // Keep one early shared hook and the final shared hook, but convert middle repeated
  // Together blocks back into role-led tags so group songs do not collapse into choir mode.
  const keep = new Set<number>([togetherIndices[0], togetherIndices[togetherIndices.length - 1]]);
  let replacementCursor = 0;
  const replacements = [
    "Main Vocal: clear bright, focused",
    "Airy Vocal: airy, fragile",
    "Low Rap Vocal: husky off-beat",
    "Whisper Rap Vocal: breathy, secretive",
  ];

  return lines.map((line, index) => {
    if (!isTogetherVocalTag(line) || keep.has(index)) return line;
    const replacement = replacements[replacementCursor % replacements.length];
    replacementCursor += 1;
    return replaceTogetherTagWithSoloRole(line, replacement);
  });
}

function ensureLeadingSectionBeforeFirstVocal(lines: string[]): string[] {
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) return lines;
  const first = lines[firstContentIndex].trim();
  if (isVocalRoleTag(first)) {
    const copy = [...lines];
    copy.splice(firstContentIndex, 0, "[Verse]");
    return copy;
  }
  return lines;
}


function normalizeLyricSectionDisplayName(section: string): string {
  return normalizeLyricSectionNameForGeneration(String(section || "").trim())
    .replace(/^Verse\s*\d+$/i, "Verse")
    .replace(/^Rap\s+Verse$/i, "Rap Section")
    .replace(/^Build\s*up$/i, "Build-up")
    .trim();
}

function parseBracketOnlyLine(line: string): { inside: string; rest: string } | null {
  const match = String(line || "").trim().match(/^\[([^\]]{1,180})\](.*)$/);
  if (!match) return null;
  return { inside: match[1].trim(), rest: String(match[2] || "") };
}

function parseCompositeLyricTagInside(inside: string): { section: string; body: string } | null {
  const match = String(inside || "").trim().match(/^((?:Intro|Verse(?:\s*[A-Z]|\s*\d+)?|Pre[-\s]?Chorus|Chorus(?:\s*\/\s*Drop)?|Hook|Final\s*Hook|Rap\s*Verse|Rap\s*Section|Bridge(?:\s*[A-Z])?|Breakdown|Drop|Final\s*Chorus(?:\s*\/\s*Drop)?|Outro|Solo|Instrumental|Build[-\s]?up|Climax|Main\s*Theme|Theme\s*[AB])(?:\s*\/\s*Drop)?)\s*:\s*(.+)$/i);
  if (!match) return null;
  return { section: normalizeLyricSectionDisplayName(match[1]), body: match[2].trim() };
}

function isSectionOnlyLyricTagInside(inside: string): boolean {
  return /^(?:Intro|Verse(?:\s*[A-Z]|\s*\d+)?|Pre[-\s]?Chorus|Chorus(?:\s*\/\s*Drop)?|Hook|Final\s*Hook|Rap\s*Verse|Rap\s*Section|Bridge(?:\s*[A-Z])?|Breakdown|Drop|Final\s*Chorus(?:\s*\/\s*Drop)?|Outro|Solo|Instrumental|Build[-\s]?up|Climax|Main\s*Theme|Theme\s*[AB])(?:\s*\/\s*Drop)?$/i.test(String(inside || "").trim());
}

function isAcousticVoiceLabel(label: string): boolean {
  return /\b(?:Vocal|Vocals|Rap|Spoken\s+Vocal)\b/i.test(String(label || "").trim());
}

function isFinalSharedLyricSection(section: string): boolean {
  return /^(?:Final\s+Chorus|Final\s+Hook)$/i.test(String(section || "").trim());
}

function isInstrumentalLikeSection(section: string): boolean {
  return /^(?:Intro|Drop|Breakdown|Instrumental|Solo|Build-up|Climax|Main Theme|Theme A|Theme B)$/i.test(String(section || "").trim());
}

function isSharedVocalLabel(label: string): boolean {
  return /^(?:All\s+Vocals|All\s+Female\s+Vocals|All\s+Male\s+Vocals|Mixed\s+Vocal\s+Duo|Together|Both|Duet)$/i.test(String(label || "").trim());
}

function fallbackSingleAcousticVoice(params: GenerateSongParams, preferredIndex = 0): string {
  const labels = getSituationAcousticTagLabels(params).filter(Boolean);
  if (labels[preferredIndex]) return labels[preferredIndex];
  if (labels[0]) return labels[0];
  return "Lead Vocal";
}

function splitLyricTagBody(body: string): { label: string; cues: string[] } {
  const parts = String(body || "")
    .split(/[,，]/)
    .map((part) => cleanEnglishOnlyLyricTagPart(part))
    .filter(Boolean);
  const label = parts.shift() || cleanEnglishOnlyLyricTagPart(body);
  return { label, cues: parts };
}

function dedupeCueAgainstAcousticLabel(cues: string[], acousticLabel: string): string[] {
  const labelWords = new Set(
    String(acousticLabel || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word && !/^(?:male|female|vocal|vocals|voice|spoken)$/.test(word)),
  );

  const out: string[] = [];
  cues.forEach((cue) => {
    const clean = cleanEnglishOnlyLyricTagPart(cue)
      .replace(/\b(?:male|female|vocal|vocals|voice|tone|delivery|emotion|attitude)\b/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!clean) return;
    const cueWords = clean.toLowerCase().split(/\s+/).filter(Boolean);
    const isOnlyRepeatingLabel = cueWords.length > 0 && cueWords.every((word) => labelWords.has(word));
    if (isOnlyRepeatingLabel) return;
    if (!out.some((item) => item.toLowerCase() === clean.toLowerCase())) out.push(clean);
  });
  return out.slice(0, 2);
}

function formatCompositeLyricTag(section: string, acousticLabel: string, cues: string[]): string {
  const cleanSection = normalizeLyricSectionDisplayName(section || "Verse");
  const cleanLabel = cleanEnglishOnlyLyricTagPart(acousticLabel || "Lead Vocal") || "Lead Vocal";
  const cleanCues = dedupeCueAgainstAcousticLabel(cues, cleanLabel);
  return `[${cleanSection}: ${cleanLabel}${cleanCues.length ? `, ${cleanCues.join(", ")}` : ""}]`;
}

function chooseSectionForBareAcousticTag(currentSection: string): string {
  const current = normalizeLyricSectionDisplayName(currentSection || "");
  if (current && !isInstrumentalLikeSection(current)) return current;
  return "Verse";
}

function baseLyricSectionName(section: string): string {
  return normalizeLyricSectionDisplayName(String(section || "").replace(/\s+[A-Z]$/i, "").trim());
}

function applySequentialSectionSuffixes(lines: string[]): string[] {
  const tagInfos: Array<{ index: number; section: string; base: string }> = [];
  lines.forEach((line, index) => {
    const parsed = parseBracketOnlyLine(line);
    if (!parsed) return;
    const composite = parseCompositeLyricTagInside(parsed.inside);
    if (!composite) return;
    const base = baseLyricSectionName(composite.section);
    if (!/^(?:Verse|Bridge)$/i.test(base)) return;
    tagInfos.push({ index, section: composite.section, base });
  });

  const copy = [...lines];
  for (let i = 0; i < tagInfos.length; i += 1) {
    const run = [tagInfos[i]];
    let j = i + 1;
    while (j < tagInfos.length && tagInfos[j].base.toLowerCase() === tagInfos[i].base.toLowerCase()) {
      run.push(tagInfos[j]);
      j += 1;
    }
    if (run.length > 1) {
      run.forEach((item, runIndex) => {
        const suffix = String.fromCharCode(65 + runIndex);
        copy[item.index] = copy[item.index].replace(
          new RegExp(`^\\[${item.section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`),
          `[${item.base} ${suffix}:`,
        );
      });
    }
    i = j - 1;
  }
  return copy;
}

function normalizeCompositeLyricTagsFinal(lyrics: string, params: GenerateSongParams): string {
  const sourceLines = String(lyrics || "").split("\n");
  const normalized: string[] = [];
  let currentSection = "";
  let lastConcreteVoice = fallbackSingleAcousticVoice(params, 0);

  sourceLines.forEach((line) => {
    const parsed = parseBracketOnlyLine(line);
    if (!parsed) {
      normalized.push(line);
      return;
    }

    const composite = parseCompositeLyricTagInside(parsed.inside);
    if (composite) {
      currentSection = composite.section;
      const { label: rawLabel, cues } = splitLyricTagBody(composite.body);
      let acousticLabel = hasSituation(params.situation)
        ? findSituationAcousticLabelFromTag(rawLabel, params) || cleanEnglishOnlyLyricTagPart(rawLabel)
        : cleanEnglishOnlyLyricTagPart(rawLabel);

      if (isSharedVocalLabel(acousticLabel) && !isFinalSharedLyricSection(currentSection)) {
        acousticLabel = lastConcreteVoice || fallbackSingleAcousticVoice(params, 0);
      } else if (isSharedVocalLabel(acousticLabel) && isFinalSharedLyricSection(currentSection)) {
        acousticLabel = buildSituationDuoAcousticLabel(params);
      }

      if (acousticLabel && !isSharedVocalLabel(acousticLabel)) lastConcreteVoice = acousticLabel;
      normalized.push(`${formatCompositeLyricTag(currentSection, acousticLabel, cues)}${parsed.rest}`);
      return;
    }

    if (isSectionOnlyLyricTagInside(parsed.inside)) {
      currentSection = normalizeLyricSectionDisplayName(parsed.inside);
      normalized.push(`[${currentSection}]${parsed.rest}`);
      return;
    }

    const rawLabel = parsed.inside.split(/[:：]/)[0] || parsed.inside;
    const bareLabelCandidate = hasSituation(params.situation)
      ? findSituationAcousticLabelFromTag(rawLabel, params) || cleanEnglishOnlyLyricTagPart(rawLabel)
      : cleanEnglishOnlyLyricTagPart(rawLabel);

    if (isAcousticVoiceLabel(bareLabelCandidate) || isSharedVocalLabel(bareLabelCandidate)) {
      const cueMatch = parsed.inside.match(/[:：]\s*(.*)$/);
      const cueSource = cueMatch ? cueMatch[1] : "";
      let acousticLabel = bareLabelCandidate;
      if (isSharedVocalLabel(acousticLabel)) acousticLabel = lastConcreteVoice || fallbackSingleAcousticVoice(params, 0);
      if (acousticLabel && !isSharedVocalLabel(acousticLabel)) lastConcreteVoice = acousticLabel;
      const section = chooseSectionForBareAcousticTag(currentSection);
      currentSection = section;
      normalized.push(`${formatCompositeLyricTag(section, acousticLabel, cueSource ? cueSource.split(/[,，]/) : [])}${parsed.rest}`);
      return;
    }

    normalized.push(line);
  });

  return applySequentialSectionSuffixes(normalized).join("\n");
}

function removeUiModeWordsFromLyrics(lyrics: string): string {
  return String(lyrics || "")
    .replace(/사회\s*풍자(?:형|라니)?/g, "")
    .replace(/평행\s*독백(?:형)?/g, "")
    .replace(/한쪽\s*독백(?:\s*중심)?/g, "")
    .replace(/콜\s*앤\s*리스폰스(?:형)?/g, "")
    .replace(/대화(?:형)?/g, "")
    .replace(/연출\s*톤/g, "")
    .replace(/보컬\s*감정(?:\s*방향)?/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n /g, "\n")
    .replace(/ \n/g, "\n");
}

function sanitizeGeneratedLyricTagsAndFragments(
  lyrics: string,
  params: GenerateSongParams,
): string {
  if (!lyrics) return "";

  const rawLines = normalizeGeneratedLyricTagSpacing(lyrics)
    .split("\n")
    .map((line) =>
      sanitizeLyricBracketTagToEnglish(
        normalizeSituationCharacterLyricTag(
          compactLyricVocalTagLine(sanitizeLyricTagGenderNoise(sanitizeCompositeSectionVocalTag(line), params)),
          params,
        ),
        params,
      )
        .split("\n")
        .map(translateKoreanStageCueParentheses)
        .join("\n")
        .replace(/\(\s*:\s*\)/g, "")
        .replace(/\(\s*,\s*\)/g, "")
        .replace(/\(\s*\)/g, "")
        .replace(/\s+,\s+/g, ", ")
        .replace(/,\s*,/g, ",")
        .replace(/\s+([,.!?])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trimEnd(),
    );

  const out: string[] = [];
  let lastVocalTag: string | null = null;

  for (let index = 0; index < rawLines.length; index += 1) {
    let line = rawLines[index];
    let trimmed = line.trim();

    if (isBrokenBracketPlaceholder(trimmed)) {
      continue;
    }

    if (/^\s*\[\s*(?:\d+|[:;,.-]*)\s*\]/i.test(line)) {
      const lyricAfterBrokenTag = stripBrokenBracketPrefix(line);
      if (!lyricAfterBrokenTag) continue;
      line = lastVocalTag ? `${lastVocalTag} ${lyricAfterBrokenTag}` : lyricAfterBrokenTag;
      trimmed = line.trim();
    }

    const currentVocalTag = extractVocalRoleTag(trimmed);
    if (currentVocalTag) {
      lastVocalTag = currentVocalTag;
    }

    // Remove empty role tags rather than leaving a naked singer label.
    if (isVocalRoleTag(trimmed)) {
      const nextNonEmpty = rawLines.slice(index + 1).find((next) => next.trim());
      if (!nextNonEmpty || isBracketTag(nextNonEmpty) || isBrokenBracketPlaceholder(nextNonEmpty)) {
        continue;
      }
    }

    out.push(line);

    // Instrumental section tags may be intentionally lyric-free, but avoid a totally empty tag.
    if (isBracketTag(trimmed) && !isVocalRoleTag(trimmed)) {
      const nextNonEmpty = rawLines.slice(index + 1).find((next) => next.trim());
      if (!nextNonEmpty || isBracketTag(nextNonEmpty) || isBrokenBracketPlaceholder(nextNonEmpty)) {
        const filler = fillerForEmptySectionTag(trimmed);
        if (filler) out.push(filler);
      }
    }
  }

  const stabilizedLines = ensureLeadingSectionBeforeFirstVocal(
    normalizeGenericTagsInSituationLyrics(limitRepeatedTogetherTags(out, params), params),
  );

  const stabilizedText = stabilizedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\[([^\]\n:]+ Vocal[^\]\n:]*):\s*,\s*/gi, "[$1: ")
    .replace(/\[([^\]\n:]+ Vocal[^\]\n:]*):\s*\]/gi, "[$1]")
    .trim();

  return removeUiModeWordsFromLyrics(
    normalizeCompositeLyricTagsFinal(stabilizedText, params),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export async function generateSong(
  ...args: GenerateSongInput
): Promise<SongResult> {
  const params = normalizeArgs(args);
  const requestedLyricLanguages = Array.from(
    new Set(
      (params.lyricLanguages?.length
        ? params.lyricLanguages
        : ["ko"]
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
  const selectedStructureMode = (params.songStructure ?? "1") as SongStructure;
  const resolvedStructure = (
    selectedStructureMode === "custom"
      ? "custom"
      : selectedStructureMode === "1"
        ? "1"
        : selectedStructureMode
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
  const englishMixRatio = normalizeEnglishMixRatio(params.englishMixRatio);

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
- Do not generate unselected lyric languages.
- In Korean-only mode, lyrics.korean must be Korean-only unless MIXED LANGUAGE MODE is explicitly active.
- Section-level sound/stage cues directly after tags must be English acoustic instructions, e.g. (faint city ambience), (steady footsteps), (beat drop). Korean parenthetical lines are allowed only when they are actual sung inner thoughts or spoken ad-libs, not production cues.`;

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

  const koreanOnlyNoEnglishInstruction =
    !shouldUseMixedLyrics &&
    !params.isNoLyrics &&
    requestedLyricLanguages.includes("ko") &&
    !requestedLyricLanguages.some((lang) => lang !== "ko")
      ? `KOREAN-ONLY LYRIC MODE (MANDATORY):
- Write lyrics.korean in Korean only.
- Do NOT include English words, English sentences, romanized Korean, or English ad-libs.
- Parentheses are allowed only for Korean inner thoughts, Korean ad-libs, or Korean sound expressions.
- Do NOT add lines such as "(Stay)", "(I miss you)", "Oh baby", "tonight", or any English hook phrase unless the user explicitly asks for English.`
      : "";

  const mixedLyricsInstruction =
    shouldUseMixedLyrics && !params.isNoLyrics
      ? `MIXED LANGUAGE MODE (MANDATORY):
- Use natural Korean/English mixed lyrics only because the user enabled mixed lyrics.
- English share is a STRICT MAXIMUM of ${englishMixRatio}% of the entire lyric body, not ${englishMixRatio}% per section.
- Count all English words, English ad-libs, English hook phrases, and English words inside parentheses as part of that total ratio.
- Korean must remain the main language when Korean lyrics are selected.
- For 5%: use at most one very short English accent in the whole lyric, or skip English entirely if not needed.
- For 10%: use only a few short English accents across the whole lyric.
- Do NOT place English in every section.
- Avoid long English sentences unless the selected ratio is 25% or higher.
- For lyrics.korean: keep Korean as the main language and place English accents very sparingly according to the selected whole-lyric ratio.
- For lyrics.english: keep English as the main language only when a non-Korean lyric language is selected; otherwise leave lyrics.english empty.
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
- Chorus, Hook, Rap Section, Bridge, Verse, Pre-Chorus, Final Chorus, and Outro must not become generic lyrics; keep the scenario and role conflict active.
- Instrumental, Solo, Drop, and Break can be mainly musical, but if they include lyrics or ad-libs, they must stay connected to the same Situation.`
      : (params.songStructure ?? "1") === "1"
        ? `SONG STRUCTURE (DEFAULT / ADAPTIVE EXPERIMENTAL):
- Do not force a fixed Verse-Chorus template. Build a coherent but experimental song architecture around the story arc, hook timing, and emotional reveal.
- Use about 9-12 major sections so the song does not feel too short. A compact song is allowed only when the user explicitly asks for a very short lyric.
- Prefer an asymmetric spine rather than a plain Verse→Pre-Chorus→Chorus loop. Use at least TWO non-standard or transition sections when appropriate: [Hook], [Drop], [Breakdown], [Instrumental], [Solo], [Build-up], [Climax], [Main Theme], or [Final Hook].
- Repetition is allowed when it has a musical purpose: Verse may return, Hook/Chorus may return, and Breakdown/Drop may appear more than once if the energy changes.
- For the default/free structure, use [Verse] as the normal verse tag. If two Verse sections appear back-to-back for different voices or viewpoints, label them [Verse A: ...] and [Verse B: ...] so the order stays clear. Otherwise, do not use numbered [Verse 1]/[Verse 2].
- Chorus/Hook should have ONE main owner per occurrence unless call-response is explicitly selected. The owner may change between Chorus and Final Hook/Final Chorus to create a story turn.
- Do not always place Chorus once in the middle and Final Chorus right before Outro. Rotate ending patterns: Breakdown→Outro, Hook reprise→sudden stop, Drop→Outro, Instrumental→spoken Outro, Final Hook→fade, Bridge→unresolved ending, or Rap Section→cold ending are allowed.
- Final Chorus/Final Hook does not always need to resolve the conflict. It may be unresolved, bitter, comic, reversed, quieter, or bigger depending on the Situation.
- Avoid consecutive identical bracket section tags except [Verse A] → [Verse B]. If a hook returns late, use [Final Hook], [Hook], [Breakdown], or [Drop] according to the musical function rather than duplicating the same tag twice in a row.
- Use composite lyric tags for every sung section, e.g. [Verse A: Airy Female Vocal, pleading] or [Rap Section: Low Male Rap, tired]. Instrumental-only sections may use section-only tags.
- Never output a bare acoustic tag like [Tired Male Rap: dry] or [Airy Female Vocal: pleading]. It must always include the section first: [Verse A: Tired Male Rap, dry] or [Chorus: Airy Female Vocal, pleading].
- For Situation songs, character story roles still drive the lyric content, but section labels must stay musical, varied, and intentional.`
        : `SONG STRUCTURE (MANDATORY):
- Selected mode: ${resolvedStructure === "2" ? "1" : "2"}.
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
- Good [Vocals] style for Situation: 2-character vocal split: Employee with bright female vocal, sarcastic but slightly hurt delivery. Boss with dry male vocal, nagging pressure. Keep each character separated. Good group style: 4 female vocal split: Main Vocal (...), Lead Vocal (...), Rap Vocal (...), Whisper Vocal (...). Bad style: Female group vocals, pop, sad.
- For group lyric tags, NEVER use mechanical labels like [Member 1], [Member 2], etc. Use role-based tags such as [Main Vocal: clear bright, hidden pain], [Airy Vocal: airy, fragile], [Rap Vocal: sharp, cynical], [Whisper Rap Vocal: breathy, secretive].
- If the group is all-female or all-male, do not repeat the gender in lyric tags. Only include gender in lyric tags for mixed-gender groups.
- Keep lyric tags compact: [Role: one voice cue, one emotion cue]. Use at most 2 short cues after the colon. Do not put full sentences, long descriptions, or all vocal settings inside lyric tags.
- LYRIC CONTENT SOURCE LOCK (MANDATORY): Lyrics must be created only from USER FREE-TEXT DIRECTOR NOTE, selected Theme, and active Situation if provided. Vocal emotion direction, vocal expression, vocal tone, Sound, Style, tempo, BPM, instrument names, and production texture are NOT lyric topics.
- Vocal emotion direction and vocal expression are singer-performance directions only. They may appear in [Vocals] and compact lyric tags, but must NOT create lyric story, imagery, subject matter, repeated keywords, or narrative content. Do not write lyric lines that explain the selected emotion/expression. If no Theme/Situation/user note exists, keep lyrics broad and character-driven rather than explaining vocal settings.
- In Situation/character lyrics, lyric tags must use composite acoustic tags: [Section: Acoustic Voice Label, short cue], e.g. [Verse A: Tired Male Rap, dry authority] or [Chorus: Airy Female Vocal, pleading hook]. Never output Korean speaker labels in brackets, never output malformed labels like [저승사자:, ], never output bare acoustic tags like [Tired Male Rap: dry], and never switch back to generic vocal labels after acoustic labels have been established.
- Every sung tag must include a section name before the colon. Bad: [Airy Female Vocal: empty]. Good: [Outro: Airy Female Vocal, empty].
- KIM EANA-STYLE LYRIC FOUNDATION (MANDATORY): Write lyrics as character speech, not emotion exposition. Start from character, situation, desire, speech style, and lived detail. Prefer concrete everyday details, persona flaws, small behavior, and a believable scene over abstract emotion words. Chorus should express the character's real desire or repeating phrase, not summarize the selected vocal emotion.
- Do not make tags empty. Every vocalist tag must be followed by at least 1-2 complete lyric or ad-lib lines. Never output broken placeholders like "( : )", "[ : ]", empty parentheses, or empty vocal tags.
- Use composite lyric tags for sung sections: [Section: Vocal/Acoustic Role, short emotion or delivery]. Good: [Hook: Whisper Rap Vocal, breathy tension], [Rap Section: Low Male Rap, husky off-beat].
- If the selected structure says Rap Section, write it as [Rap Section] in generated lyrics. Composite form is allowed and preferred: [Rap Section: Low Male Rap, husky off-beat].
- In group songs, [Together] is not the default singer. Use [Together] only for one short shared hook or the final hook unless the user explicitly asks for full-group singing.
- For repeated Hook/Chorus sections, distribute ownership across roles: Main Vocal or Airy Vocal can lead early hooks, Rap/Whisper Rap can interrupt or answer, and Together should be saved for the final or most important hook.
- Do not let [Together] own every repeated hook. Keep group unity, but preserve the selected vocal split.
- Every lyric block must belong to a section tag. In custom structures, each sung structural block should use a composite section tag such as [Hook: Clear Female Vocal, aching], [Verse: Tired Male Rap, dry], [Rap Section: Low Male Rap, husky off-beat], [Bridge: Airy Female Vocal, fragile]. For instrumental blocks, use section-only tags such as [Drop] or [Intro]. For parallel monologue, keep [Hook]/[Chorus] owned by one main acoustic role; the other role may add at most one short parenthetical interruption, not alternating full lines.
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

VOCAL EXPRESSION STYLE LAYER (VOICE EMOTION / ATTITUDE / PHRASING):
${buildSelectedVocalExpressionInstruction(params)}

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

${koreanOnlyNoEnglishInstruction}
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
- Do not use a fixed duet template. The singer who owns Verse, Pre-Chorus, Chorus, Bridge, Final Chorus, and Outro must change according to genre and situation.
- If the previous section was A→B, the next lyrical section should not automatically repeat A→B. Change ownership, interruption timing, solo focus, or hook function.
- The goal is a different dramatic song design, not only different words.
- The same keywords may keep the same characters and mood, but the vocal part distribution must vary: who opens, who owns the hook, who interrupts, who disappears, who returns, and whether the chorus is solo/together/echo/call-response should not be fixed.

[LYRIC TAGGING RULES]
- Keep all tags short. Tags guide singing; they are not prose.
- MANDATORY multi-speaker rule: [] means structure/speaker tags, () means ad-libs only.
- If there are two actual vocalists, every sung section should use one composite bracket tag: [Section: acoustic voice tag, short style].
- Do not use (Role) at the start of lyric lines; convert it to a composite Suno tag such as [Verse: Low Male Rap, dry].
- Solo songs: do NOT repeat [Female Vocal] or [Male Vocal] every section when the prompt already defines the vocal identity.
- Solo section tags must include short performance/emotion tags, e.g. [Verse: low, intimate], [Chorus: clear hook, aching].
- Use short inline performance tags only for specific lines: [whisper], [held breath], [tremble], [open voice].
- Use parentheses for short ad-libs, breath, inner thoughts, or rhythm points. Keep ad-libs sparse, 0-2 per section.
- Situation target A/B are story roles, NOT automatic duet singers. The actual singer count and gender MUST follow the Vocal menu.
- Solo vocal + two targets: write one singer narrating/addressing the other; do NOT create alternating role vocal tags.
- Duo/group vocal + two targets: use composite Suno tags for sung sections: [Section: acoustic voice tag, short cue]. UI story roles such as 저승사자/Ghost/Boss/Mother are story context only; final lyric tags must use physical sound labels such as [Verse: Tired Male Rap, dry nagging] or [Chorus: Airy Female Vocal, pleading hook]. Do NOT output Korean role labels such as [저승사자] or [귀신], and do NOT fall back to generic [Main Vocal] / [Airy Vocal] tags in character-led lyrics.
- If Target A/B speech style or attitude is provided, it is mandatory: reflect it in both the [Vocals] line concept and the lyric speaker tags.
- User-provided style/attitude text is source material, not final wording. Interpret it into natural character behavior and short singable tags.
- Final prompt sentences should sound like a producer directing a real singer; lyric tags should stay compact and musical, with no more than 2 short cues after the colon.
- NEVER write speaker names in parentheses such as (40대 엄마), (10대 아들), (상사), (직원). Parentheses are ONLY for ad-libs, breath, SFX, inner thoughts, or short reactions.
- For sung sections, prefer composite tags because Suno follows them better: [Section: acoustic voice tag, short cue]. Do not split section and singer into separate tags unless the section is instrumental or purely SFX.
- Correct multi-speaker format:
  [Verse: Warm Female Vocal, worried spoken]
  ...
  [Verse: Young Male Vocal, blunt reply]
  ...
- Chorus ownership is flexible, but arrangement wording controls it. If the arrangement is parallel monologue / 평행 독백형 / one-sided monologue, the chorus should be owned by one acoustic voice, not A/B line-by-line dialogue. The other voice may appear only as one short parenthetical aside/ad-lib if needed. Use call-response choruses only when call-response is explicitly selected.
- Do NOT use "Mixed Vocal Duo". Shared singing labels are allowed only in final shared sections or explicit group moments: [Final Chorus: All Vocals, ...], [Final Hook: All Vocals, ...], [Final Chorus: All Female Vocals, ...], or [Final Chorus: All Male Vocals, ...]. Do not use All Vocals in Verse, Pre-Chorus, Bridge, or Breakdown; keep those owned by one acoustic voice label.
Examples:
  [Chorus: Airy Female Vocal, pleading hook]
  ...
  (dry aside)

  [Chorus: Firm Male Spoken Vocal, pressing hook]
  ...
  (short aside)

  [Final Chorus: All Vocals, short shared hook]
  ...
- For actual duo/group conflict songs, do NOT collapse both characters into one generic narrator. However, do NOT force every section to alternate A/B line by line. Use acoustic composite tags only where that voice actually owns or interrupts that part.
- Do NOT default every chorus to A/B/A/B dialogue. In parallel monologue, use [Chorus: A-led hook] or [Chorus: B-led hook] as the default. [Chorus: call-response hook] is allowed only when the arrangement explicitly says call-response.
- When a section is call-response, keep each role block short, usually 2-4 lines. When a section is solo-led, one speaker may own the full section with only short interruptions or ad-libs from the other.
- Avoid blended vocals when Arrangement says separated dialogue or call-response.
- In custom structures, do not drop section labels in Chorus, Hook, Rap Section, Breakdown, Bridge, or Outro when they contain lyrics.
- In custom structures, do not drop the vocal/acoustic role inside Chorus, Hook, Rap Section, Breakdown, Bridge, or Outro composite tags when they contain lyrics.
- One line must not contain two speaker tags. Split them into separate lines/blocks.
- Use the A→B pattern ONLY for sections explicitly chosen as call-response. Other sections may be A-only, B-only, Together-only, echo-style, interruption-style, or one speaker with the other appearing only as an ad-lib.
- Avoid long tag explanations; keep tags short and musical.
- Keep English around 10% or less, mostly as short ad-libs or rhythm points.
- UI mode words such as 사회풍자형, 평행 독백형, 대화형, 콜앤리스폰스형, 보컬감정, or 연출 톤 are internal controls. Never write those words directly in the lyric body; express them through character behavior and concrete details.


[PART OWNERSHIP / SONG ARCHITECTURE RULES]
- CRITICAL: Multi-speaker does NOT mean every section must be a back-and-forth dialogue. First decide the part ownership of the song, then place speaker tags only where needed.
- This is NOT just dialogue alternation. Decide who owns each musical part differently for each song.
- Before writing lyrics, silently choose ONE section ownership map based on Genre + Situation version + development feeling. Do NOT show the map.
- Never reuse the same ownership formula across all genres. A ballad, city pop, funk, rap, trot, EDM, and gugak fusion song must distribute vocal parts differently.
- The selected genre must affect part ownership:
  - Ballad/R&B: one voice may own emotional verses; the other appears as memory, answer, or late confession.
  - City pop/Funk: hook and chorus may be stylish call-response, but they can also be one-speaker hooks with short echo/ad-lib replies; verses can be solo monologue, interruption, or trade.
  - Rap/Hip-hop: Rap Section can be a battle, relay, or one-sided rant; do not force polite A/B alternation.
  - Trot/Gugak/Fusion: one role can narrate or command while the other answers with traditional/formal phrasing.
  - EDM/Drop: Drop can be ad-lib/hook-driven, but if lyrics appear, keep role identity in short bursts.
- Possible section ownership maps:
  1) A-led pursuit: A owns Verse; B cuts in at Hook; Chorus becomes a chase.
  2) B-led complaint: B owns Verse; A answers later; Bridge exposes A's weakness.
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
  A) Verse=A solo, Pre-Chorus=Together, Chorus=B solo hook, Verse=B solo, Bridge=A interruption, Final Chorus=Together.
  B) Verse=B solo, Hook=A short cut-in, Chorus=Together, Verse=A solo, Bridge=parallel monologue, Final Chorus=B solo.
  C) Verse=A interrupted by B, Pre-Chorus=A solo, Chorus=A-led with B ad-libs, Verse=B rant, Bridge=unresolved silence, Outro=A punchline.
  D) Verse=parallel monologues, Chorus=refrain-only, Verse=rap relay, Bridge=late reveal, Final Chorus=echo/correction.
- Do not make Verse sections, Pre-Chorus, Chorus, Bridge, and Final Chorus all contain both speakers.
- Do not make both characters appear in the same order in every section.
- If the song has a genre with strong vocal conventions, follow that genre's part logic before dialogue symmetry: ballad can be solo emotional hook, funk can be ad-lib undercut, rap can be relay/battle, trot can be one main singer with spoken replies, EDM can use refrain/drop fragments.
- The goal is varied but song-like structures, not random section collage. Same selected keywords can create different part ownership each generation, but the section order must still feel musically intentional.

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
- For custom Chorus, Hook, Rap Section, Bridge, Verse, Pre-Chorus, Final Chorus, and Outro sections, keep the characters, relationship, speech style, and conflict active.
- Do not let custom Chorus/Hook/Rap sections become generic slogan lyrics. They must still sound like the selected Situation.
- For duo/group Situation songs, custom Chorus/Hook/Rap Section sections must keep role identity, but they must NOT always use call-response. They can be solo-led, echo-led, together-led, interruption-led, relay, or call-response depending on the chosen ownership map.
- Instrumental, Solo, Drop, and Break sections may be mostly musical. If lyrics/ad-libs appear there, keep them short and tied to the same Situation.
- If a section has tags such as Rap, Group, Minimal, Build-up, Instrumental, Soft, Big, or Adlib, the writing should support that musical role without replacing the story.
- For multi-speaker songs, do not give Verse sections, Bridge, and Final Chorus the same speaker order. Rotate section ownership naturally.
- A chorus can be led by one speaker with the other interrupting, not always equal A/B alternation.
- A verse can be mostly one speaker if the other interrupts briefly; this is different from a full duet block.
- Respect the selected lyricsLength strictly.
- Respect the selected song structure strictly.
- In DEFAULT/ADAPTIVE mode, respect the adaptive blueprint you choose at the start and keep the section order coherent.
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

  if (shouldUseMixedLyrics && !params.isNoLyrics && englishMixRatio > 0) {
    // Only force tiny mixed accents when the model ignored an explicitly enabled mix mode.
    result.lyrics = enforceKpopMixedLyrics(result.lyrics, englishMixRatio);
  }

  if (!shouldUseMixedLyrics && !params.isNoLyrics) {
    const isKoreanOnly =
      requestedLyricLanguages.includes("ko") &&
      !requestedLyricLanguages.some((lang) => lang !== "ko");
    if (isKoreanOnly) {
      result.lyrics.korean = stripEnglishAdlibsForKoreanOnlyLyrics(result.lyrics.korean);
      result.lyrics.english = "";
    }
  }

  if (!params.isNoLyrics) {
    result.lyrics.korean = sanitizeGeneratedLyricTagsAndFragments(result.lyrics.korean, params);
    result.lyrics.english = sanitizeGeneratedLyricTagsAndFragments(result.lyrics.english, params);
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
    tempoSource: params.tempoSource,
    isRandomTempo: params.isRandomTempo ?? false,
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
