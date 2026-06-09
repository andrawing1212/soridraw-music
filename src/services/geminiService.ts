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
  STYLE_CYCLES,
  MID_GENRE_PROMPTS,
  SUB_GENRE_PROMPTS,
  MOODS,
  GENRE_INSTRUMENT_PROFILES,
  VOCAL_TECHNIQUES,
  VOCAL_VOICE_TONES,
  VOCAL_PERSONALITIES,
} from "../constants";
import { VOCAL_TONES } from "../constants/vocalTones";
import {
  LyricsLength,
  SongStructure,
  SongResult,
  VocalConfig,
  CustomSectionItem,
  SituationConfig,
  CustomSectionKind,
} from "../types";

let aiInstance: GoogleGenAI | null = null;
let aiInstanceKey: string | null = null;


const INSTRUMENTAL_BGM_GENRE_IDS = new Set([
  'instrumental_bgm',
  'lofi_study',
  'cafe_bgm',
  'nature_ambience',
  'healing_piano',
  'ambient',
  'minimalism',
  'piano_solo',
  'string_ensemble',
]);

const isInstrumentalBgmId = (value?: string | null) => Boolean(value && INSTRUMENTAL_BGM_GENRE_IDS.has(String(value)));

type BgmBpmRange = { min: number; max: number };

const INSTRUMENTAL_BGM_DEFAULT_BPM: Record<string, BgmBpmRange> = {
  lofi_study: { min: 66, max: 88 },
  cafe_bgm: { min: 74, max: 98 },
  nature_ambience: { min: 38, max: 62 },
  healing_piano: { min: 46, max: 74 },
  ambient: { min: 42, max: 70 },
  minimalism: { min: 60, max: 104 },
  piano_solo: { min: 44, max: 78 },
  string_ensemble: { min: 50, max: 84 },
};

const INSTRUMENTAL_BGM_SLOW_MOODS = new Set([
  'calm', 'relaxing', 'zen', 'healing', 'peaceful', 'restrained',
  'sad', 'sorrowful', 'melancholic', 'lonely', 'wistful', 'hollow',
  'dark', 'moody', 'chilly', 'fragile_edge', 'soft_tender', 'tender',
]);

const INSTRUMENTAL_BGM_FAST_MOODS = new Set([
  'bright', 'hopeful', 'cheerful', 'playful_mischief', 'cheeky_deadpan',
  'comedic', 'quirky', 'cute_mood', 'upbeat', 'swelling', 'powerful',
  'infectious', 'tense', 'uneasy', 'groovy',
]);

function getInstrumentalBgmMainId(params: Pick<GenerateSongParams, 'genre' | 'subGenre'>): string | null {
  const ids = [...(params.subGenre || []), params.genre || ''].filter(Boolean);
  return ids.find((id) => isInstrumentalBgmId(id)) || null;
}

function getInstrumentalBgmDefaultTempo(params: Pick<GenerateSongParams, 'genre' | 'subGenre' | 'moods'>): string {
  const mainId = getInstrumentalBgmMainId(params);
  if (!mainId) return '';
  const base = INSTRUMENTAL_BGM_DEFAULT_BPM[mainId] || { min: 54, max: 88 };
  const moods = params.moods || [];
  const slowHits = moods.filter((id) => INSTRUMENTAL_BGM_SLOW_MOODS.has(id)).length;
  const fastHits = moods.filter((id) => INSTRUMENTAL_BGM_FAST_MOODS.has(id)).length;
  const shift = Math.max(-12, Math.min(12, (fastHits - slowHits) * 4));
  let min = Math.max(20, Math.min(200, Math.round(base.min + shift)));
  let max = Math.max(20, Math.min(200, Math.round(base.max + shift)));
  if (['nature_ambience', 'ambient'].includes(mainId)) max = Math.min(max, 78);
  if (['healing_piano', 'piano_solo', 'string_ensemble'].includes(mainId)) max = Math.min(max, 92);
  return `${min}–${max} BPM`;
}

function getAI(apiKeyOverride?: string | null) {
  const apiKey = String(apiKeyOverride || import.meta.env.VITE_GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error(
      "Google Gemini API Key가 등록되어 있지 않습니다. 마이페이지에서 개인 Google Gemini API Key를 등록해주세요.",
    );
  }

  if (!aiInstance || aiInstanceKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    aiInstanceKey = apiKey;
  }

  return aiInstance;
}

const GEMINI_TEXT_MODEL_CHAIN = [
  "gemini-3.5-flash",
  "gemini-3-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const GEMINI_FALLBACK_STABILITY_INSTRUCTION = `
[FALLBACK MODEL SAFETY MODE]
- Prioritize structural stability over creative reinterpretation.
- Keep the exact 5-line production prompt structure: [Genre], [Instruments], [Atmosphere], [Vocals], [Arrangement].
- Do not invent extra vocal roles. If the user selected solo vocal, keep it solo.
- Do not convert a vocal song into instrumental. Use instrumental/no vocals only when instrumental BGM or no-lyrics mode is explicitly active.
- Preserve direct user input above automatic keyword interpretation.
- Keep lines concise, but do not remove essential vocal character details.
- Return valid JSON exactly matching the requested schema.
`.trim();

function describeGeminiError(error: any): string {
  try {
    return JSON.stringify(error);
  } catch {
    return String(error || "");
  }
}

function isGeminiRetryableError(error: any): boolean {
  const text = describeGeminiError(error).toLowerCase();
  const status = error?.status || error?.error?.status || "";
  const code = error?.code || error?.error?.code || 0;
  return (
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    status === "RESOURCE_EXHAUSTED" ||
    status === "UNAVAILABLE" ||
    status === "DEADLINE_EXCEEDED" ||
    text.includes("429") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("resource_exhausted") ||
    text.includes("overloaded") ||
    text.includes("unavailable") ||
    text.includes("temporarily")
  );
}

function withFallbackSafetyInstruction(config: any, attemptIndex: number): any {
  if (attemptIndex <= 0) return config;
  const baseInstruction = config?.systemInstruction ? String(config.systemInstruction) : "";
  return {
    ...(config || {}),
    systemInstruction: [baseInstruction, GEMINI_FALLBACK_STABILITY_INSTRUCTION]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function getGeminiFallbackReason(error: any): string {
  const text = describeGeminiError(error).toLowerCase();
  const status = String(error?.status || error?.error?.status || "").toLowerCase();
  const code = Number(error?.code || error?.error?.code || 0);
  if (code === 429 || status.includes("resource_exhausted") || text.includes("quota")) return "quota_or_rate_limit";
  if (text.includes("rate limit") || text.includes("429")) return "quota_or_rate_limit";
  if (status.includes("unavailable") || text.includes("unavailable") || text.includes("overloaded")) return "model_unavailable_or_overloaded";
  if (code >= 500 || status.includes("deadline") || text.includes("temporarily")) return "temporary_server_error";
  return "generation_error";
}

interface GeminiModelUsageInfo {
  usedModel: string;
  fallbackUsed: boolean;
  fallbackFrom?: string | null;
  fallbackReason?: string | null;
  attemptedModels: string[];
}

async function generateContentWithModelFallback(
  ai: GoogleGenAI,
  generateParams: any,
  context: string,
  modelChain: string[] = GEMINI_TEXT_MODEL_CHAIN,
): Promise<any> {
  let lastError: any = null;
  let firstFailedModel: string | null = null;
  let firstFallbackReason: string | null = null;
  const attemptedModels: string[] = [];

  for (let i = 0; i < modelChain.length; i += 1) {
    const model = modelChain[i];
    attemptedModels.push(model);
    const paramsForAttempt = {
      ...generateParams,
      model,
      config: withFallbackSafetyInstruction(generateParams.config, i),
    };
    try {
      if (i > 0) {
        console.warn(`[SORIDRAW Gemini Fallback] ${context}: retrying with ${model}`);
      }
      const response = await ai.models.generateContent(paramsForAttempt);
      (response as any).__soridrawGeminiModelInfo = {
        usedModel: model,
        fallbackUsed: i > 0,
        fallbackFrom: i > 0 ? firstFailedModel || modelChain[0] || null : null,
        fallbackReason: i > 0 ? firstFallbackReason || "generation_error" : null,
        attemptedModels,
      } satisfies GeminiModelUsageInfo;
      return response;
    } catch (error) {
      lastError = error;
      if (!firstFailedModel) {
        firstFailedModel = model;
        firstFallbackReason = getGeminiFallbackReason(error);
      }
      console.warn(`[SORIDRAW Gemini Fallback] ${context}: ${model} failed`, error);
      if (!isGeminiRetryableError(error) && i >= 1) break;
    }
  }
  throw lastError;
}


export interface CustomSectionAutoMetadataInput {
  labelKo: string;
  description?: string;
  kind?: CustomSectionKind;
  context?: "section" | "tag";
  geminiApiKey?: string;
}

export interface CustomSectionAutoMetadata {
  labelEn: string;
  tagCue: string;
  promptFull: string;
  kind?: CustomSectionKind;
  allowVocal?: boolean;
  isInstrumental?: boolean;
}

function titleCaseWords(value: string): string {
  return String(value || '')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function fallbackCustomSectionMetadata(input: CustomSectionAutoMetadataInput): CustomSectionAutoMetadata {
  const raw = `${input.labelKo || ''} ${input.description || ''}`.toLowerCase();
  const isRap = /랩|rap/.test(raw) || input.kind === 'rap';
  const isInstrumental = /연주|간주|솔로|instrument|solo|lead/.test(raw) || input.kind === 'instrumental';
  const isTransition = /전환|정지|브레이크|break|stop|transition/.test(raw) || input.kind === 'transition';
  const pairs: Array<[RegExp, string, string]> = [
    [/속삭|whisper/, 'Whisper', 'whispery'],
    [/숨죽|muted|mute/, 'Muted', 'held-back muted'],
    [/대화|dialogue|주고받/, 'Dialogue', 'call-and-response'],
    [/강한|powerful|폭발/, 'Powerful', 'powerful'],
    [/거친|rough|husky/, 'Rough', 'rough'],
    [/젖은|wet/, 'Wet', 'wet'],
    [/낮은|저음|low|deep/, 'Low', 'deep low'],
    [/높은|high|bright/, 'Bright', 'bright'],
    [/감정|emotional/, 'Emotional', 'emotional'],
    [/신스\s*리드|synth lead/, 'Synth Lead', 'synth lead'],
    [/해금|haegeum/, 'Haegeum', 'haegeum'],
    [/가야금|gayageum/, 'Gayageum', 'gayageum'],
    [/장구|janggu/, 'Janggu', 'janggu'],
    [/정적|silent|silence/, 'Silent', 'silent'],
  ];
  const words: string[] = [];
  const cues: string[] = [];
  pairs.forEach(([re, label, cue]) => {
    if (re.test(raw) && !words.includes(label)) {
      words.push(label);
      cues.push(cue);
    }
  });
  if (isRap && !words.includes('Rap')) words.push('Rap');
  if (isInstrumental && !words.some(w => /Solo|Instrumental/.test(w))) words.push(/솔로|solo|lead/.test(raw) ? 'Solo' : 'Instrumental');
  if (isTransition && !words.some(w => /Break|Stop|Transition/.test(w))) words.push('Transition');
  if (!words.length) words.push(...titleCaseWords(input.labelKo || 'Custom Section').split(' ').slice(0, 3));
  const labelEn = titleCaseWords(words.join(' ')).slice(0, 40) || 'Custom Section';
  const tagCue = (cues.join(' ') + (isRap ? ' rap delivery' : isInstrumental ? ' instrumental cue' : isTransition ? ' transition cue' : ' section cue'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const promptFull = [tagCue, isRap ? 'rhythmic flow' : '', isInstrumental ? 'no vocals, no humming' : '', isTransition ? 'short reset between sections' : '']
    .filter(Boolean)
    .join(', ')
    .slice(0, 160);
  return {
    labelEn,
    tagCue,
    promptFull,
    kind: input.kind || (isInstrumental ? 'instrumental' : isRap ? 'rap' : isTransition ? 'transition' : 'other'),
    allowVocal: !(isInstrumental || isTransition),
    isInstrumental,
  };
}

export async function generateCustomSectionMetadata(input: CustomSectionAutoMetadataInput): Promise<CustomSectionAutoMetadata> {
  const fallback = fallbackCustomSectionMetadata(input);
  const labelKo = String(input.labelKo || '').trim();
  if (!labelKo) return fallback;
  try {
    const ai = getAI(input.geminiApiKey);
    const prompt = `You are converting a Korean user-created Suno song section/tag into compact English metadata for a music app.\nReturn ONLY JSON.\nRules:\n- labelEn: short English section/tag name, Title Case, max 4 words.\n- tagCue: short lyric-tag cue, max 8 words, no brackets.\n- promptFull: fuller internal prompt, max 18 words, comma-separated, no brackets.\n- kind: one of vocal, rap, instrumental, transition, build, theme, other.\n- allowVocal false for instrumental/transition.\n- isInstrumental true only when it must contain no voice/humming/chant.\nUser Korean label: ${labelKo}\nDescription: ${input.description || ''}\nPreferred kind: ${input.kind || ''}\nContext: ${input.context || 'section'}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            labelEn: { type: Type.STRING },
            tagCue: { type: Type.STRING },
            promptFull: { type: Type.STRING },
            kind: { type: Type.STRING },
            allowVocal: { type: Type.BOOLEAN },
            isInstrumental: { type: Type.BOOLEAN },
          },
          required: ['labelEn', 'tagCue', 'promptFull'],
        },
      },
    });
    const text = response.text || '';
    const parsed = JSON.parse(text);
    const labelEn = titleCaseWords(parsed.labelEn || fallback.labelEn).slice(0, 40) || fallback.labelEn;
    const tagCue = String(parsed.tagCue || fallback.tagCue).replace(/[\[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || fallback.tagCue;
    const promptFull = String(parsed.promptFull || fallback.promptFull).replace(/[\[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || fallback.promptFull;
    const kind = ['vocal', 'rap', 'instrumental', 'transition', 'build', 'theme', 'other'].includes(parsed.kind) ? parsed.kind as CustomSectionKind : fallback.kind;
    return {
      labelEn,
      tagCue,
      promptFull,
      kind,
      allowVocal: typeof parsed.allowVocal === 'boolean' ? parsed.allowVocal : fallback.allowVocal,
      isInstrumental: typeof parsed.isInstrumental === 'boolean' ? parsed.isInstrumental : fallback.isInstrumental,
    };
  } catch (error) {
    console.warn('Custom section metadata generation failed, using fallback:', error);
    return fallback;
  }
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
  pointSounds?: string[];
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
  instrumentalBgmMode?: boolean;
  lyricLanguages?: LanguageCode[];
  customThemeInput?: string;
  customMoodInput?: string;
  geminiApiKey?: string;
  generationIndex?: number;
  generationCount?: number;
  recentStoryMemory?: string[];
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

function isSeparatorLikeId(value: unknown): boolean {
  return /^separator[-_]/i.test(String(value || '').trim());
}

function isSeparatorLikeItem(item: any): boolean {
  return Boolean(item?.kind === 'separator' || isSeparatorLikeId(item?.id));
}

function filterPromptSelectionIds(values: string[] = []): string[] {
  return values.filter((value) => value && !isSeparatorLikeId(value));
}

function resolveStyleItem(value: string) {
  if (isSeparatorLikeId(value)) return undefined;
  const normalized = value.trim().toLowerCase();
  const found = SOUND_STYLES.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized,
  );
  return isSeparatorLikeItem(found) ? undefined : found;
}

function resolveInstrumentSoundItem(value: string) {
  if (isSeparatorLikeId(value)) return undefined;
  const normalized = value.trim().toLowerCase();
  const found = INSTRUMENT_SOUNDS.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized,
  );
  return isSeparatorLikeItem(found) ? undefined : found;
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
  if (!item || isSeparatorLikeItem(item)) return false;

  // IMPORTANT: Only the Style > Vocal Line category may feed [Vocals].
  // Other style categories can contain words like "emotion", "dramatic", "string",
  // or "cinematic", but those belong to [Atmosphere]/[Arrangement]/[Instruments],
  // not vocal performance. This prevents Theme Music cues such as
  // "dramatic string writing" from leaking into [Vocals].
  const role = STYLE_ROLE_BY_VARIANT_ID[item.id];
  const cycleId = STYLE_CYCLE_ID_BY_VARIANT_ID[item.id];
  if (role && role !== "vocals") return false;
  if (!role && cycleId && cycleId !== "vocal-expression") return false;

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
    role === "vocals" ||
    cycleId === "vocal-expression" ||
    item.id.toLowerCase().startsWith("vocal-") ||
    /vocal|보컬|sing|spoken|말하듯|읊조|whisper|속삭|teary|울먹|pleading|애원|sarcastic|비꼬|emotion|감정|staccato|스타카토|broken|끊어|slur|흘리|pitch|음정|음이|off-pitch|음치|humming|흥얼|sick|감기|nasal|mumbled|발음|말끝|short-breath|숨이|unconfident|자신 없이|blank|멍하게|wobbly|삐걱/.test(text)
  );
}

function vocalExpressionCueFromStyle(item: ReturnType<typeof resolveStyleItem>): VocalExpressionCue | null {
  if (!item || !isVocalExpressionStyleItem(item)) return null;
  const text = [item.id, item.label, item.labelKo, item.style, item.mood]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Safety net: never convert instrumental/theme/arrangement cues into vocal cues.
  if (/string writing|strings?|drums?|bass|synth|guitar|piano|brass|horn|percussion|fx|sfx|ambience|texture|cinematic score|soundtrack|orchestra|arrangement|theme music/.test(text)) {
    return null;
  }

  const label = item.labelKo || item.label || item.id;

  const make = (
    short: string,
    tag: string,
    roleBias: VocalExpressionCue["roleBias"] = "any",
  ): VocalExpressionCue => ({ id: item.id, label, short, tag, roleBias });

  // Era/genre vocal colors: keep the musical memory, but do not force the actual singer count.
  // Example: 2000s R&B Duo Softness can color a solo vocal with harmony-inspired phrasing
  // instead of printing an impossible duo direction when the user selected one singer.
  if (/2000s.*r&b.*duo|r&b.*duo|rnb.*duo/.test(text)) {
    return make('2000s R&B harmony-inspired phrasing, gentle runs, and airy blend color', 'R&B harmony', 'harmony');
  }
  if (/2000s.*r&b|r&b|rnb/.test(text)) {
    return make('2000s R&B phrasing with gentle runs and smooth emotional glide', 'R&B runs', 'lead');
  }

  // Vocal habits / imperfections: keep these as performance details, not story themes.
  if (/broken sentence|문장마다|sentence delivery|끊어/.test(text)) return make("broken sentence delivery", "broken phrasing", "any");
  if (/slurred ending|끝음|word ending|말끝|trailing/.test(text)) return make("fading word endings", "fading endings", "any");
  if (/unstable pitch|음이 살짝|pitch feel|wobbly pitch|삐걱/.test(text)) return make("unstable pitch feel", "unstable pitch", "any");
  if (/off-pitch|음정을|음치|못따/.test(text)) return make("off-pitch imperfection", "off-pitch", "any");
  if (/careless humming|대충|흥얼/.test(text)) return make("careless humming feel", "careless humming", "lead");
  if (/nasal sick|감기|sick voice|nasal/.test(text)) return make("nasal sick-voice texture", "nasal sick voice", "any");
  if (/mumbled|발음|pronunciation|입안|굴리/.test(text)) return make("mumbled mouthy pronunciation", "mumbled", "any");
  if (/short-breath|숨이 모자|breath delivery/.test(text)) return make("short-breath fragility", "short breath", "any");
  if (/unconfident|자신 없이/.test(text)) return make("unconfident small delivery", "unconfident", "lead");
  if (/blank sing|멍하게/.test(text)) return make("blank sing-along detachment", "blank singalong", "lead");

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
  return cues.slice(0, 12);
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


function dedupePromptParts(parts: string[], max = 12): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const cleaned = cleanPromptValue(part)
      .replace(/\s+/g, " ")
      .replace(/\bemotion\s+emotion\b/gi, "emotion")
      .trim();
    if (!cleaned) continue;
    const key = cleaned
      .toLowerCase()
      .replace(/\b(vocal|voice|feel|delivery|phrasing|emotion|texture)\b/g, "")
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    result.push(cleaned);
    if (result.length >= max) break;
  }
  return result;
}

function vocalCueGroup(cue: VocalExpressionCue): "emotion" | "phrasing" | "habit" | "style" {
  const source = `${cue.id} ${cue.label} ${cue.short} ${cue.tag}`.toLowerCase();

  // Human imperfection / habit cues must stay as performance habits.
  if (
    /broken sentence|fading word|slurred|unstable pitch|off-pitch|careless humming|nasal sick|mumbled|mouthy|short-breath|unconfident|blank sing|wobbly|문장마다|끝음|말끝|음이|음정|대충|흥얼|감기|발음|숨이|자신 없이|멍하게|삐걱/.test(source)
  ) {
    return "habit";
  }

  // Timing / technique / articulation cues.
  if (
    /phrasing|spoken|reciting|off-beat|laid-back|runs|sustain|syllable|staccato|delivery|singing|말하듯|읊조|엇박|눕혀|쪼개|이어|꺾|고음선|훅|그루브/.test(source)
  ) {
    return "phrasing";
  }

  // Emotional attitude cues.
  if (
    /emotion|restraint|restrained|resigned|numb|hollow|empty|tearful|pleading|cold|indifferent|lazy|dreamy|rough|whisper|explosive|smiling|sarcastic|suffocated|delicate|감정|울먹|애원|차가|무심|나른|몽롱|거친|속삭|폭발|허무|비꼬|숨 막|섬세|참는/.test(source)
  ) {
    return "emotion";
  }

  return "style";
}

function joinVocalCueItems(items: string[]): string {
  const cleaned = dedupePromptParts(items, 24);
  if (!cleaned.length) return "";
  if (cleaned.length === 1) return cleaned[0];
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function buildSelectedVocalPerformancePhrase(params: GenerateSongParams, max = 12): string {
  const cues = getSelectedVocalExpressionCues(params);
  if (!cues.length) return "";

  const grouped: Record<"emotion" | "phrasing" | "habit" | "style", string[]> = {
    emotion: [],
    phrasing: [],
    habit: [],
    style: [],
  };

  for (const cue of cues) {
    grouped[vocalCueGroup(cue)].push(cue.short);
  }

  const ordered = [
    ...dedupePromptParts(grouped.emotion, 4),
    ...dedupePromptParts(grouped.phrasing, 4),
    ...dedupePromptParts(grouped.habit, 6),
    ...dedupePromptParts(grouped.style, 2),
  ].slice(0, max);

  return joinVocalCueItems(ordered)
    .replace(/\bfading word(?! endings)\b/gi, "fading word endings")
    .replace(/\b(word endings)\s+(restrained emotion|numb|resigned|hollow|lazy|dreamy)\b/gi, "$1, $2")
    .replace(/\b(lazy dreamy phrasing|dreamy blurred softness|lazy relaxed phrasing)\s+(restrained emotion|numb|resigned|hollow)\b/gi, "$1, $2")
    .replace(/\b(restrained emotion|numb resignation|hollow resigned emotion)\s+(lazy dreamy phrasing|dreamy blurred softness|lazy relaxed phrasing)\b/gi, "$1, $2")
    .replace(/\b(dramatic string writing|cinematic string writing|string writing)\b/gi, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*and\s*$/i, "")
    .replace(/,\s*$/g, "")
    .trim();
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

type StylePromptRole = 'genre' | 'instruments' | 'atmosphere' | 'vocals' | 'arrangement';

type ResolvedStyleItem = NonNullable<ReturnType<typeof resolveStyleItem>>;

const STYLE_CYCLE_ROLE_BY_ID: Record<string, StylePromptRole> = {
  // [Genre] only: categories that directly define musical genre / era identity.
  'fusion-genre': 'genre',
  'rhythm-bounce': 'genre', // 재즈 & 알앤비
  'rap-beat-texture': 'genre', // 힙합
  'synth-space': 'genre', // EDM & 댄스
  'band-live': 'genre', // 라이브 밴드
  'era-texture': 'genre', // 시대 질감, compacted into short genre tokens

  // [Atmosphere]: scene, space, cinematic/theme color. Do not treat as genre.
  'space-texture': 'atmosphere',
  'cinematic-scene': 'atmosphere', // 테마 뮤직

  // [Vocals]: only vocal line / phrasing / tone cues.
  'vocal-expression': 'vocals',

  // [Arrangement]: hook, transition, groove, rhythm, section movement.
  'hook-addiction': 'arrangement',
  'stage-shift': 'arrangement',
  'groove-flow': 'arrangement',
};

const STYLE_CYCLE_ID_BY_VARIANT_ID: Record<string, string> = STYLE_CYCLES.reduce((acc, cycle) => {
  cycle.variants.forEach((variant) => {
    if (!isSeparatorLikeItem(variant)) acc[variant.id] = cycle.id;
  });
  return acc;
}, {} as Record<string, string>);

const STYLE_ROLE_BY_VARIANT_ID: Record<string, StylePromptRole> = STYLE_CYCLES.reduce((acc, cycle) => {
  const role = STYLE_CYCLE_ROLE_BY_ID[cycle.id];
  if (!role) return acc;
  cycle.variants.forEach((variant) => {
    if (!isSeparatorLikeItem(variant)) acc[variant.id] = role;
  });
  return acc;
}, {} as Record<string, StylePromptRole>);

function getStyleItemsByPromptRole(styleValues: string[] = [], role: StylePromptRole) {
  return filterPromptSelectionIds(styleValues)
    .map((value) => resolveStyleItem(value))
    .filter((item): item is ResolvedStyleItem =>
      Boolean(item && !isSeparatorLikeItem(item) && STYLE_ROLE_BY_VARIANT_ID[item.id] === role),
    );
}

function getStylePromptValuesByRole(styleValues: string[] = [], role: StylePromptRole, field: 'label' | 'style' | 'sound' | 'mood' = 'label'): string[] {
  return getStyleItemsByPromptRole(styleValues, role)
    .map((item) => String((item as any)[field] || item.label || '').trim())
    .filter(NON_EMPTY);
}

function getInstrumentSoundPromptCores(values: string[] = []): string[] {
  return filterPromptSelectionIds(values)
    .map((value) => resolveInstrumentSoundItem(value)?.promptCore ?? "")
    .filter(NON_EMPTY);
}

function getInstrumentSoundLabels(values: string[] = []): string[] {
  return filterPromptSelectionIds(values)
    .map((value) => {
      const item = resolveInstrumentSoundItem(value);
      return item?.promptCore ?? item?.label ?? sentenceCase(value);
    })
    .filter(NON_EMPTY);
}


function getInstrumentSoundPromptItems(values: string[] = []) {
  return filterPromptSelectionIds(values)
    .map((value) => resolveInstrumentSoundItem(value) as any)
    .filter((item) => item && !isSeparatorLikeItem(item) && String(item.promptCore || '').trim().length > 0)
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

type DirectArtistReference = {
  raw: string;
  reference: string;
  traits: string;
  vocalTraits?: string;
  arrangementTraits?: string;
};

const DIRECT_ARTIST_REFERENCE_TRAITS: Array<{ pattern: RegExp; reference: string; traits: string; vocalTraits?: string; arrangementTraits?: string }> = [
  { pattern: /블랙핑크|BLACKPINK/gi, reference: 'BLACKPINK-style', traits: 'dark girl-crush K-pop with bold hip-hop energy', vocalTraits: 'confident idol vocals with sharp rap-pop attitude and powerful performance edge', arrangementTraits: 'glossy EDM-pop production, punchy hip-hop groove, bold drop-ready chorus energy' },
  { pattern: /뉴진스|NewJeans/gi, reference: 'NewJeans-inspired', traits: 'airy Y2K K-pop with minimal soft groove', vocalTraits: 'soft casual vocals with airy understated delivery and relaxed youthful tone', arrangementTraits: 'minimal groove, clean retro-modern texture, light rhythmic bounce, uncluttered pop flow' },
  { pattern: /아이유|\bIU\b/gi, reference: 'IU-inspired', traits: 'Korean emotional pop ballad with delicate storytelling color', vocalTraits: 'intimate clear vocal with conversational phrasing, fragile emotion, and detailed storytelling tone', arrangementTraits: 'piano-led emotional build, restrained pop-ballad movement, lyrical scene-focused progression' },
  { pattern: /방탄소년단|\bBTS\b/gi, reference: 'BTS-inspired', traits: 'polished global K-pop with emotional performance drive', vocalTraits: 'dynamic idol vocals with rap-pop contrast, expressive group energy, and polished emotional delivery', arrangementTraits: 'global pop production, hybrid hip-hop and pop lift, cinematic performance-driven chorus movement' },
  { pattern: /트와이스|TWICE/gi, reference: 'TWICE-inspired', traits: 'bright catchy K-pop with playful idol charm', vocalTraits: 'bright youthful idol vocals with cute melodic energy and crisp hook-friendly delivery', arrangementTraits: 'catchy pop hook structure, sparkling synth-pop color, upbeat dance-pop bounce' },
  { pattern: /아이브|\bIVE\b/gi, reference: 'IVE-inspired', traits: 'elegant confident idol pop with glossy luxury mood', vocalTraits: 'chic confident idol vocals with polished poise and sleek melodic phrasing', arrangementTraits: 'glossy modern pop production, elegant hook lift, refined luxury-toned arrangement color' },
  { pattern: /르세라핌|LE\s*SSERAFIM/gi, reference: 'LE SSERAFIM-inspired', traits: 'confident athletic K-pop with bold modern energy', vocalTraits: 'assertive performance vocals with cool attitude, rhythmic punch, and confident group delivery', arrangementTraits: 'minimal bold pop production, athletic groove, sharp rhythmic accents, modern performance focus' },
  { pattern: /에스파|aespa/gi, reference: 'aespa-inspired', traits: 'futuristic cyber K-pop with digital glossy intensity', vocalTraits: 'sleek idol vocals with futuristic edge, sharp tone, and polished high-energy delivery', arrangementTraits: 'cyber synth textures, metallic pop production, dramatic digital drops, high-contrast section shifts' },
  { pattern: /태연|Taeyeon/gi, reference: 'Taeyeon-inspired', traits: 'Korean soulful pop ballad with polished emotional lift', vocalTraits: 'clear soulful vocal with controlled belting, emotional nuance, and polished high-register lift', arrangementTraits: 'modern pop-ballad build, refined orchestral-pop support, emotional chorus expansion' },
  { pattern: /아리아나\s*그란데|Ariana\s+Grande/gi, reference: 'Ariana Grande-inspired', traits: 'glossy modern pop-R&B with silky diva color', vocalTraits: 'silky pop-R&B vocal runs, agile melisma, airy high notes, and polished diva texture', arrangementTraits: 'smooth R&B-pop production, glossy layered harmonies, rhythmic modern groove' },
  { pattern: /위켄드|The\s+Weeknd/gi, reference: 'The Weeknd-inspired', traits: 'dark nocturnal synth-pop R&B with cinematic groove', vocalTraits: 'smooth moody R&B vocal with falsetto color, nocturnal emotion, and restrained sensual tension', arrangementTraits: 'dark synthwave-R&B production, pulsing retro groove, cinematic night-drive atmosphere' },
  { pattern: /버즈|\bBuzz\b/gi, reference: 'Buzz-style', traits: '2000s Korean rock band emotional K-rock ballad', vocalTraits: 'restrained low-mid chest-and-falsetto blend in the verse, shifting to powerful chest-dominant rock belting with mixed head-and-chest resonance, emotional vibrato, and tearful high-note restraint in the chorus', arrangementTraits: 'guitar-driven dramatic chorus lift and sentimental 2000s Korean band-ballad build with Buzz-style soaring chorus energy' },
  { pattern: /엠씨더맥스|MC\s*the\s*Max|M\.C\s*the\s*Max/gi, reference: 'MC the Max-inspired', traits: 'Korean emotional rock ballad with explosive high-note drama', vocalTraits: 'explosive male high-note belting with intense vibrato, dramatic breath pressure, and aching rock-ballad emotion', arrangementTraits: 'dramatic string-and-band build with cathartic chorus lift and high-tension climax' },
  { pattern: /SG\s*워너비|SG\s*Wannabe/gi, reference: 'SG Wannabe-inspired', traits: '2000s Korean vocal-group ballad with rich harmony color', vocalTraits: 'rich male harmony blend, powerful emotional chorus delivery, and classic vocal-group ballad phrasing', arrangementTraits: 'sentimental mid-tempo classic K-ballad build, layered harmony moments, warm orchestral-pop support' },
  { pattern: /브라운\s*아이즈|Brown\s*Eyes/gi, reference: 'Brown Eyes-inspired', traits: 'Korean R&B ballad with soulful nostalgic groove', vocalTraits: 'smooth male R&B ballad vocal with soulful emotion, soft runs, and intimate warmth', arrangementTraits: 'mellow piano-and-rhythm color, nostalgic R&B groove, warm harmony-centered progression' },
  { pattern: /박효신|Park\s*Hyo[-\s]?shin/gi, reference: 'Park Hyo-shin-inspired', traits: 'grand Korean emotional ballad with deep cinematic weight', vocalTraits: 'deep resonant Korean ballad vocal with controlled breath, rich low-mid tone, and powerful vibrato', arrangementTraits: 'cinematic emotional build with grand chorus lift, orchestral depth, and slow dramatic expansion' },
  { pattern: /성시경|Sung\s*Si[-\s]?kyung/gi, reference: 'Sung Si-kyung-inspired', traits: 'soft romantic Korean ballad with warm intimate color', vocalTraits: 'smooth warm male vocal with gentle breath, intimate phrasing, and understated romantic emotion', arrangementTraits: 'gentle orchestral-pop color, soft piano-led flow, warm mid-tempo ballad progression' },
  { pattern: /윤하|Younha/gi, reference: 'Younha-inspired', traits: 'sentimental Korean pop-rock with bright piano-driven lift', vocalTraits: 'clear emotional pop-rock vocal with bright high-register lift, clean intensity, and youthful dramatic tone', arrangementTraits: 'piano-driven intensity, band-pop build, soaring melodic chorus, sentimental pop-rock momentum' },
];

function getDirectArtistReferenceText(params?: GenerateSongParams): string {
  if (!params) return '';
  return [
    params.userInput || '',
    getDirectThemeInputText(params),
    getDirectMoodInputText(params),
  ].filter(Boolean).join(' ');
}

function normalizeArtistReferenceName(value: string): string {
  return cleanupPromptTail(String(value || '')
    .replace(/["'“”‘’]/g, ' ')
    .replace(/^(?:like|similar to|in the vein of)\s+/i, '')
    .replace(/^(?:그룹|가수|밴드|아티스트|보컬|싱어|아이돌)\s+/i, '')
    .replace(/\s+(?:같은|처럼|느낌|풍|스타일|계열|감성|무드|inspired|style|vibe)$/i, '')
    .replace(/\s*의$/i, '')
    .replace(/\s+/g, ' ')
    .trim());
}

function getDirectArtistReferences(params?: GenerateSongParams): DirectArtistReference[] {
  const text = getDirectArtistReferenceText(params);
  if (!text) return [];
  const refs: DirectArtistReference[] = [];
  const add = (raw: string, reference: string, traits: string, vocalTraits?: string, arrangementTraits?: string) => {
    const cleanRef = cleanupPromptTail(reference);
    if (!cleanRef) return;
    if (refs.some((item) => item.reference.toLowerCase() === cleanRef.toLowerCase())) return;
    refs.push({
      raw: cleanupPromptTail(raw),
      reference: cleanRef,
      traits: cleanupPromptTail(traits),
      vocalTraits: cleanupPromptTail(vocalTraits || ''),
      arrangementTraits: cleanupPromptTail(arrangementTraits || ''),
    });
  };

  DIRECT_ARTIST_REFERENCE_TRAITS.forEach(({ pattern, reference, traits, vocalTraits, arrangementTraits }) => {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) add(match[0], reference, traits, vocalTraits, arrangementTraits);
  });

  const englishStylePattern = /\b([A-Z][A-Za-z0-9&.'’\-]*(?:\s+[A-Z][A-Za-z0-9&.'’\-]*){0,3})\s*(?:-style|-inspired|-like|\s+vibe|\s+style|\s+inspired)\b/g;
  let englishMatch: RegExpExecArray | null;
  while ((englishMatch = englishStylePattern.exec(text))) {
    const name = normalizeArtistReferenceName(englishMatch[1]);
    if (name && !/^(K|J|R|Pop|Rock|Jazz|Hip|Hop|EDM|Lo|Fi)$/i.test(name)) {
      add(name, `${name}-style`, 'user-referenced artist direction translated into energy, vocal attitude, groove, production color, and emotional tone');
    }
  }

  const koreanReferencePattern = /((?:그룹|가수|밴드|아티스트|아이돌)?\s*["'“”‘’]?[가-힣A-Za-z0-9&.'’\-\s]{2,28}["'“”‘’]?)\s*(?:같은|처럼|느낌|풍|스타일|계열|감성|무드)(?:의|으로|적인|처럼)?/g;
  let koreanMatch: RegExpExecArray | null;
  while ((koreanMatch = koreanReferencePattern.exec(text))) {
    const name = normalizeArtistReferenceName(koreanMatch[1]);
    if (!name) continue;
    if (/^(따뜻|차가|밝|어두|슬픈|기쁜|몽환|귀여|강한|부드|잔잔|로파이|카페|피아노|자연|연주|보컬|장르|감성적인|파워풀한)$/i.test(name)) continue;
    if (name.length > 24) continue;
    const known = DIRECT_ARTIST_REFERENCE_TRAITS.find(({ pattern }) => {
      pattern.lastIndex = 0;
      return pattern.test(name);
    });
    if (known) {
      add(name, known.reference, known.traits, known.vocalTraits, known.arrangementTraits);
    } else if (!/[가-힣]/.test(name)) {
      add(name, `${name}-style`, 'user-referenced artist direction translated into energy, vocal attitude, groove, production color, and emotional tone');
    }
  }

  return refs.slice(0, 2);
}


function isSpecificIdolArtistReference(ref?: DirectArtistReference): boolean {
  if (!ref) return false;
  return /BLACKPINK|NewJeans|BTS|TWICE|IVE|LE\s*SSERAFIM|aespa|블랙핑크|뉴진스|방탄소년단|트와이스|아이브|르세라핌|에스파/i.test(`${ref.raw} ${ref.reference}`);
}

function buildArtistGenrePhrase(ref?: DirectArtistReference, options?: { allowReference?: boolean }): string {
  if (!ref) return '';
  const allowReference = options?.allowReference !== false;
  if (!allowReference || isSpecificIdolArtistReference(ref)) {
    return cleanupPromptTail(ref.traits || 'artist-referenced musical direction');
  }
  return cleanupPromptTail(`${ref.reference}${ref.traits ? `, ${ref.traits}` : ''}`);
}

function buildArtistReferenceGenreAccent(params?: GenerateSongParams): string {
  const refs = getDirectArtistReferences(params);
  if (!refs.length) return '';
  const main = refs[0];
  const second = refs[1];
  const isBuzzReference = /(?:버즈|\bBuzz\b)/i.test(`${main.raw} ${main.reference}`);
  if (isBuzzReference) {
    const secondaryColor = second && !/(?:버즈|\bBuzz\b)/i.test(`${second.raw} ${second.reference}`)
      ? ` with ${buildArtistGenrePhrase(second, { allowReference: !isSpecificIdolArtistReference(second) })} color`
      : '';
    return cleanupPromptTail(`2000s Korean rock band Buzz-style emotional K-rock ballad${secondaryColor}`);
  }
  const mainPhrase = buildArtistGenrePhrase(main);
  const secondPhrase = second ? buildArtistGenrePhrase(second, { allowReference: !isSpecificIdolArtistReference(second) }) : '';
  if (secondPhrase) return cleanupPromptTail(`${mainPhrase} with ${secondPhrase} color`);
  return cleanupPromptTail(mainPhrase);
}

function buildArtistReferenceVocalAccent(params?: GenerateSongParams): string {
  const refs = getDirectArtistReferences(params);
  const parts = refs.map((ref) => ref.vocalTraits).filter(Boolean) as string[];
  return cleanupPromptTail(parts.join(', '));
}

function buildArtistReferenceArrangementAccent(params?: GenerateSongParams): string {
  const refs = getDirectArtistReferences(params);
  const parts = refs.map((ref) => ref.arrangementTraits).filter(Boolean) as string[];
  return cleanupPromptTail(parts.join(', '));
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
- Put every section tag on its own line. Never write a lyric on the same line as a section tag.
- Write lyric bodies as short singable lines, not paragraph blocks.
- Each verse/chorus/hook line should usually be about 8-18 Korean syllables or one short musical phrase.
- Break long Korean sentences into multiple lyric lines with natural rhythm and breathing points.
- Keep 4-6 lyric lines per normal major section unless the selected lyric length says otherwise.
- Treat line count as a breathing guide, not a rigid template. Genre density and fusion section roles may make Verse/Rap denser or Chorus/Hook more spacious while preserving the selected overall length.
- The lyrics should primarily follow the user's story/intention.
- Do not use vocal technique, instrument names, sound layers, mood labels, or genre DNA as lyric topics. They are performance/production directions only.
- Do not invent a central object just because the prompt mentions an object-led or scene-led lens. Use a visible object only when the user directly provides one, or when it naturally grows from the selected Theme/Situation.
- Avoid pretty image lists. Build the lyric from a believable speaker, a clear desire, and one lived detail that proves the feeling.
- Chorus should sound like a line a person might actually repeat, not a summary of the selected keywords.
- Follow the selected lyric language mode exactly; do not add unselected languages.
- If translation is requested by language mode, keep it natural and lyrical rather than literal.
${buildLyricsLengthInstruction(lyricsLength)}
`.trim();
}

type LyricDensityProfileKey =
  | 'space'
  | 'rhythm'
  | 'hook'
  | 'band'
  | 'narrative'
  | 'balanced';

type LyricDensityProfile = {
  key: LyricDensityProfileKey;
  label: string;
  rule: string;
  verse: string;
  preChorus: string;
  chorus: string;
  bridge: string;
};

const LYRIC_DENSITY_PROFILES: Record<LyricDensityProfileKey, LyricDensityProfile> = {
  space: {
    key: 'space',
    label: 'space/breath-led',
    rule: 'lower word density, shorter sung lines, more breath, image and emotional aftertaste over explanation',
    verse: 'use concrete images and restrained phrases; do not over-explain',
    preChorus: 'slightly lift the emotion with fewer words and more breathing space',
    chorus: 'make the hook simple, lingering, and singable rather than wordy',
    bridge: 'use a quiet turn or one revealing line, not a dense explanation',
  },
  rhythm: {
    key: 'rhythm',
    label: 'rhythm/talk-led',
    rule: 'higher word density in rap or rhythmic sections, punchy phrasing, internal rhyme, and lived detail',
    verse: 'allow denser spoken detail, short punch lines, rhyme, and attitude',
    preChorus: 'reduce density enough to prepare the hook or melodic lift',
    chorus: 'keep it repeatable; do not let rap density swallow the hook',
    bridge: 'use a focused switch, confession, or cadence change',
  },
  hook: {
    key: 'hook',
    label: 'hook/repetition-led',
    rule: 'short memorable phrases, clear repetition, drop-friendly hooks, and low clutter around the main hook',
    verse: 'move quickly into the hook idea with compact setup lines',
    preChorus: 'create anticipation with rising phrases and concise wording',
    chorus: 'prioritize a repeatable hook phrase that can be remembered after one listen',
    bridge: 'briefly change the angle before returning to the hook',
  },
  band: {
    key: 'band',
    label: 'band/shout-led',
    rule: 'medium density, emotional build, direct lines, and shoutable chorus phrasing',
    verse: 'set the scene with human tension and medium-length lines',
    preChorus: 'tighten the pressure and make the lift obvious',
    chorus: 'use strong, direct, singalong lines rather than long prose',
    bridge: 'allow a sharp emotional turn or stripped-down confession',
  },
  narrative: {
    key: 'narrative',
    label: 'narrative/drama-led',
    rule: 'clear story progression, character motive, specific scene, and emotional payoff',
    verse: 'advance the story with visible actions and a concrete place',
    preChorus: 'reveal the motive or pressure behind the action',
    chorus: 'state the desire or lesson as a memorable emotional refrain',
    bridge: 'deliver the twist, regret, admission, or final realization',
  },
  balanced: {
    key: 'balanced',
    label: 'balanced mainstream',
    rule: 'medium density, clear scene, singable lines, and a hook that stays memorable',
    verse: 'use enough detail to ground the scene without crowding the melody',
    preChorus: 'lift naturally with concise emotional pressure',
    chorus: 'keep the hook clear, repeatable, and not overly wordy',
    bridge: 'use one focused turn before the final hook',
  },
};

function includesAnyDensityCue(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function getLyricDensityProfileScores(params: GenerateSongParams): Record<LyricDensityProfileKey, number> {
  const text = [
    getSelectedPrimaryGenreKey(params),
    params.genre || '',
    ...(params.subGenre ?? []),
    selectedStyleText(params),
    selectedSoundText(params),
    selectedMoodText(params),
    selectedThemeText(params),
    params.userInput || '',
  ].join(' ').toLowerCase();

  const score: Record<LyricDensityProfileKey, number> = {
    space: 0,
    rhythm: 0,
    hook: 0,
    band: 0,
    narrative: 0,
    balanced: 1,
  };

  if (includesAnyDensityCue(text, [/ballad|발라드|dream\s*pop|dreamwave|shoegaze|city\s*pop|시티팝|r&b|rnb|neo[-_\s]?soul|jazz\s*ballad|ambient|앰비언트|lo[-_\s]?fi|로파이|chill|slow|느린|minimal|미니멀|indie\s*pop|인디팝/])) score.space += 3;
  if (includesAnyDensityCue(text, [/hip[-_\s]?hop|rap|랩|trap|drill|드릴|boom\s*bap|붐뱁|garage|uk\s*garage|breakbeat|브레이크비트|jersey|grime|spoken|말하듯|flow|플로우/])) score.rhythm += 3;
  if (includesAnyDensityCue(text, [/k[-_\s]?pop|j[-_\s]?pop|idol|아이돌|anime|anisong|애니|edm|house|techno|dance|댄스|disco|디스코|funk|펑크|trot[-_\s]?pop|electro|hyperpop|hook|훅|drop|드롭|club|클럽/])) score.hook += 3;
  if (includesAnyDensityCue(text, [/rock|록|band|밴드|punk|펑크|emo|이모|metal|메탈|alternative|얼터너티브|grunge|post[-_\s]?rock|shout|외치는/])) score.band += 3;
  if (includesAnyDensityCue(text, [/folk|포크|trot|트로트|country|컨트리|musical|뮤지컬|opera|오페라|pansori|판소리|gugak|국악|cinematic|시네마틱|orchestra|오케스트라|story|서사|narrative|이야기|여행|가족|전쟁|역사/])) score.narrative += 3;

  if (includesAnyDensityCue(text, [/빠른|fast|upbeat|energetic|high\s*energy|intense|강렬|격렬/])) {
    score.rhythm += 1;
    score.hook += 1;
    score.band += 1;
  }
  if (includesAnyDensityCue(text, [/차분|calm|relaxed|릴렉스|몽환|dreamy|공허|lonely|empty|잔잔|quiet|조용/])) score.space += 1;
  if (includesAnyDensityCue(text, [/고백|confession|이별|breakup|후회|regret|사랑|love|짝사랑|crush/])) {
    score.space += 1;
    score.narrative += 1;
  }

  return score;
}

function pickLyricDensityProfiles(params: GenerateSongParams): LyricDensityProfile[] {
  const scores = getLyricDensityProfileScores(params);
  const picked = (Object.keys(scores) as LyricDensityProfileKey[])
    .filter((key) => key !== 'balanced')
    .sort((a, b) => scores[b] - scores[a])
    .filter((key) => scores[key] > 0)
    .slice(0, 3)
    .map((key) => LYRIC_DENSITY_PROFILES[key]);
  return picked.length ? picked : [LYRIC_DENSITY_PROFILES.balanced];
}

function buildFusionSectionDensityPlan(profiles: LyricDensityProfile[]): string[] {
  const keys = new Set(profiles.map((profile) => profile.key));
  const lines: string[] = [];
  const hasRhythm = keys.has('rhythm');
  const hasSpace = keys.has('space');
  const hasHook = keys.has('hook');
  const hasBand = keys.has('band');
  const hasNarrative = keys.has('narrative');

  if (hasRhythm && hasSpace) {
    lines.push('- Fusion section plan: let Verse/Rap Section carry denser rhythmic detail, then let Chorus/Hook breathe with shorter melodic lines.');
  }
  if (hasRhythm && hasHook) {
    lines.push('- Fusion section plan: keep rap/verse cadence tight, but make Drop/Chorus hook short, repeatable, and rhythm-friendly.');
  }
  if (hasBand && hasSpace) {
    lines.push('- Fusion section plan: use restrained verses and a more direct shoutable chorus lift; do not overfill slow emotional sections.');
  }
  if (hasNarrative && hasHook) {
    lines.push('- Fusion section plan: advance the story in Verse/Bridge, then condense the Chorus into one memorable desire or catchphrase.');
  }
  if (hasBand && hasRhythm) {
    lines.push('- Fusion section plan: allow spoken/rap-like pressure in verses, but keep band choruses direct and singable.');
  }
  if (hasNarrative && hasSpace) {
    lines.push('- Fusion section plan: keep the story visible through objects/actions, but leave enough breath for emotional aftertaste.');
  }

  return lines.length ? lines : ['- Fusion section plan: keep the main profile as the overall air and use secondary influences only in the sections where they naturally belong.'];
}

function buildLyricDensityInstruction(params: GenerateSongParams): string {
  const profiles = pickLyricDensityProfiles(params);
  const main = profiles[0];
  const secondary = profiles.slice(1);
  const isFusion = secondary.length > 0;
  const lengthMode = params.lyricsLength ?? 'normal';
  const lyricModeNote = params.isLyricMode
    ? params.lyricMode === 'preserve'
      ? '- Direct-lyrics original-preserve mode: preserve the user draft line breathing first; apply density only to section tags or very light spacing, not by rewriting the draft.'
      : '- Direct-lyrics AI-correction mode: keep the user draft as the lyrical source, but gently reshape line breaks and section placement toward this density profile.'
    : '- No direct lyric draft: generate new lyrics from the Scene Plan using this density profile.';

  return `LYRIC DENSITY PROFILE (MANDATORY, DO NOT OUTPUT THIS LABEL):
- Overall length mode selected by UI: ${lengthMode}. Respect it, but distribute word density by genre and section role instead of using a flat line-count template.
- Main profile: ${main.label} — ${main.rule}.
${secondary.length ? `- Secondary fusion profiles: ${secondary.map((profile) => `${profile.label} — ${profile.rule}`).join(' / ')}.` : '- Secondary fusion profiles: none detected; use the main profile consistently.'}
- Verse/Rap Section rule: ${isFusion && profiles.some((profile) => profile.key === 'rhythm') ? LYRIC_DENSITY_PROFILES.rhythm.verse : main.verse}.
- Pre-Chorus rule: ${main.preChorus}.
- Chorus/Hook/Drop rule: ${isFusion && profiles.some((profile) => profile.key === 'hook') ? LYRIC_DENSITY_PROFILES.hook.chorus : main.chorus}.
- Bridge rule: ${main.bridge}.
${buildFusionSectionDensityPlan(profiles).join('\n')}
- Do not make every section dense just because one selected genre is rap/drill/garage. Do not make every section sparse just because one selected genre is dream/ballad/ambient.
- In fusion songs, the main genre defines the overall air; secondary genres shape specific section density, cadence, hook repetition, or bridge contrast.
${lyricModeNote}`;
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


function joinReadable(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part, index, arr) => arr.indexOf(part) === index)
    .join(", ");
}

function resolveVocalTechniquePrompt(idOrText?: string): string | undefined {
  if (!idOrText) return undefined;
  const raw = String(idOrText).trim();
  if (!raw) return undefined;
  const found = (VOCAL_TECHNIQUES as readonly any[]).find(
    (item) => item.id === raw || item.label === raw || item.labelKo === raw,
  );

  // Use compact but sensory phrases. The UI shows the full technique description;
  // the prompt should keep the technique name's sound image and avoid mechanical catalogs.
  const compactById: Record<string, string> = {
    chest_voice: 'low chest resonance with a grounded weight',
    head_voice: 'clear head voice lifting into bright open highs',
    mixed_voice: 'connected mixed voice that keeps high notes full',
    falsetto: 'light airy falsetto that thins at the edge',
    belting: 'powerful belting that pushes the high notes forward',
    breathy: 'breathy phrasing that leaves a soft sigh after each line',
    airy: 'air-heavy voice that feels like breath more than volume',
    vocal_fry: 'low crackling vocal fry at the phrase edges',
    edge_voice: 'sharp edge voice bite when the feeling rises',
    creaky_voice: 'creaky voice that cracks like held-back emotion',
    husky: 'husky rough texture with a human grain',
    growling: 'rough growling texture for a burst of raw pressure',
    nasal: 'forward nasal resonance that keeps the tone focused',
    vibrato: 'controlled vibrato that leaves emotion on sustained notes',
    bending: 'soft vocal bending that pulls notes like spoken feeling',
    glissando: 'smooth glissando slides between notes',
    trill: 'quick trills that flash with nervous ornament',
    voice_flip: 'small voice flips where chest and falsetto catch suddenly',
    yodeling: 'rhythmic voice flips with a playful break',
    quarter_tone_bending: 'quarter-tone bends that ache slightly off-center',
    blue_note: 'blue-note dips that color the line with stylish sadness',
    layback: 'laid-back phrasing behind the beat',
    anticipation: 'slightly early phrasing that betrays urgency',
    slurring: 'slurred words that cling and melt together',
    muted_pronunciation: 'muted pronunciation that keeps words inside the mouth',
    detonation: 'slightly detuned endings with a tired human instability',
    sprechgesang: 'half-spoken half-sung delivery like a private confession',
    ghost_note: 'ghost-note whispers that barely touch the lyric',
    reverse_breath: 'reverse breaths that pull the line inward before it escapes',
    double_breath: 'double breaths that sound briefly overwhelmed',
    half_air_stop: 'half-air stops that let the phrase fall into breath',
    vocal_sigh: 'vocal sighs that drop the sound downward',
    vocal_hiccup: 'small vocal hiccups that catch in the throat',
    staccato_breath: 'staccato breaths like startled little inhales',
    off_mic: 'off-mic distance that makes the voice feel physically farther away',
    inward_singing: 'ghostly inward-inhaled breaths that sound suffocated and unreal',
    multiphonics: 'dual-tone multiphonics like broken-glass harmonics',
    glottal_clicks: 'subtle rhythmic throat clicks woven into the singing',
    overtone_singing: 'ancient overtone throat drone with high harmonic shimmer',
    death_growl_pig_squeal: 'distorted growl and animalistic squeal edge',
    white_noise_vocals: 'static-noise vocal texture like radio interference',
    glossolalia: 'abstract syllabic chanting like emotional glossolalia',
    microtonal_slurring: 'melting microtonal slides that feel slightly out of tune',
  };

  return (found && compactById[found.id]) || found?.promptNatural || found?.promptCore || raw;
}

function resolveVocalVoiceTonePrompt(idOrText?: string): string | undefined {
  if (!idOrText) return undefined;
  const raw = String(idOrText).trim();
  if (!raw) return undefined;
  const found = (VOCAL_VOICE_TONES as readonly any[]).find(
    (item) => item.id === raw || item.label === raw || item.labelKo === raw,
  );
  const compactById: Record<string, string> = {
    calm: 'calm tone with a steady close-mic feel',
    heavy: 'deep heavy tone that sits low in the chest',
    first_love: 'clear fragile first-love tone',
    clear: 'clear clean tone with transparent edges',
    hollow: 'hollow distant tone with empty space around it',
    husky_tone: 'husky tone with a dry human grain',
    lazy: 'lazy relaxed tone that leans behind the groove',
    bright: 'bright lively tone with a thin smiling edge',
    wet: 'wet emotional tone with breath left on the words',
    dry: 'dry plain tone that avoids obvious drama',
  };
  return (found && compactById[found.id]) || found?.promptCore || raw;
}

function resolveVocalPersonalityPrompt(idOrText?: string): string | undefined {
  if (!idOrText) return undefined;
  const raw = String(idOrText).trim();
  if (!raw) return undefined;
  const found = (VOCAL_PERSONALITIES as readonly any[]).find(
    (item) => item.id === raw || item.label === raw || item.labelKo === raw,
  );
  const compactById: Record<string, string> = {
    relaxed: 'relaxed attitude, letting the feeling move slowly',
    cool: 'cool on the surface, keeping the feeling hidden',
    plain: 'plain and calm outside, with a small ache underneath',
    frustrated: 'bottled-up frustration that stays under the words',
    stubborn: 'stubborn stance, refusing to soften too easily',
    bouncy: 'bouncy playfulness that hides a real feeling',
    cute: 'cute innocence with light emotional color',
    clingy: 'pleading attachment that cannot quite let go',
    sensitive: 'easily-wounded sensitivity under a careful voice',
    sly: 'sly teasing attitude with hidden sincerity',
    proud: 'proud vulnerability, holding back before admitting too much',
    unable_to_let_go: 'lingering attachment that keeps returning to the line',
  };
  return (found && compactById[found.id]) || found?.promptCore || raw;
}

function getSelectedPrimaryGenreKey(params?: GenerateSongParams): string {
  if (!params || isFreeTextPrimaryMode(params)) return '';
  const first = getSelectedFusionGenres(params)[0];
  const raw = `${first?.id || ''} ${first?.label || ''}`.toLowerCase();
  if (/gugak[_-]?fusion|gugak\s*fusion|fusion\s*gugak|국악\s*퓨전/.test(raw)) return 'gugak_fusion';
  if (/pansori|판소리/.test(raw)) return 'pansori';
  if (/gugak|국악/.test(raw)) return 'gugak_fusion';
  if (/city\s*pop|citypop|시티팝/.test(raw)) return 'citypop';
  if (/neo[-_\s]?soul|네오/.test(raw)) return 'neo_soul';
  if (/classic\s*soul|soul|소울/.test(raw)) return 'soul';
  if (/jazz|재즈/.test(raw)) return 'jazz';
  if (/idol|k[-_\s]?pop|아이돌/.test(raw)) return 'idol';
  if (/r&b|rnb/.test(raw)) return 'rnb';
  if (/rock|록/.test(raw)) return 'rock';
  if (/trot|트로트/.test(raw)) return 'trot';
  return '';
}


function getSelectedLeafGenreLabel(params?: GenerateSongParams): string {
  if (!params || isFreeTextPrimaryMode(params)) return '';
  const first = getSelectedFusionGenres(params)[0];
  return compactGenreToken(first?.label || first?.id || '');
}

function getSelectedSpecificTrotLabel(params?: GenerateSongParams): string {
  const raw = getSelectedLeafGenreLabel(params);
  return raw && /trot|트로트/i.test(raw) ? preserveSpecificTrotGenreLabel(raw) : '';
}

function getSelectedTrotVocalDescriptor(params?: GenerateSongParams): string {
  const label = getSelectedSpecificTrotLabel(params);
  if (!label) return 'Korean trot';
  return label
    .replace(/^Korean\s+/i, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function getSelectedTrotRhythmDescriptor(params?: GenerateSongParams): string {
  const label = getSelectedSpecificTrotLabel(params);
  if (!label) return 'trot';
  return label
    .replace(/^Korean\s+/i, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function getGenreVocalDNAPhrase(params?: GenerateSongParams): string {
  const key = getSelectedPrimaryGenreKey(params);
  if (key === 'trot') {
    const specific = getSelectedTrotVocalDescriptor(params);
    return `${specific} vibrato color with stage-like emotional lift`;
  }
  const map: Record<string, string> = {
    gugak_fusion: 'fusion gugak breath with modern crossover phrasing',
    pansori: 'Korean gugak breath and pansori chest resonance',
    citypop: 'smooth bittersweet city-pop polish',
    neo_soul: 'warm neo-soul pocket with intimate harmonic weight',
    soul: 'gospel-rooted soul weight with warm human resonance',
    jazz: 'jazz phrasing with flexible timing and warm harmonic color',
    idol: 'polished idol-pop clarity with clean hook focus',
    rnb: 'smooth R&B phrasing with close late-night intimacy',
    rock: 'live rock projection with band-driven urgency',
  };
  return map[key] || '';
}

function getGenreDefaultVocalPhrase(params?: GenerateSongParams): string {
  const exactVocal = params ? getSelectedGenreVocalCue(params) : '';
  const key = getSelectedPrimaryGenreKey(params);
  if (key !== 'trot' && exactVocal) return exactVocal;
  if (key === 'trot') {
    const specific = getSelectedTrotVocalDescriptor(params);
    return `${specific} vocal with rounded vibrato, clear diction, and stage-like emotional lift`;
  }
  const map: Record<string, string> = {
    gugak_fusion: 'fusion gugak vocal with Traditional Korean phrasing, modern crossover clarity, and story-aware delivery',
    pansori: 'pansori-style tone, chest-driven gugak breath, han-filled resonance, spoken-sung phrasing, and sharp traditional ornaments. Calm but deeply emotional',
    citypop: 'smooth clear city-pop tone with soft urban warmth and slightly wistful phrasing',
    neo_soul: 'warm neo-soul vocal with intimate breath, soft runs, and a relaxed pocket',
    soul: 'warm soulful vocal with gospel-rooted phrasing and rich human resonance',
    jazz: 'natural jazz vocal with flexible timing, warm phrasing, and subtle blue-note color',
    idol: 'polished idol-pop vocal with clean tone, bright hook focus, and controlled emotion',
    rnb: 'smooth R&B vocal with close breath, late-night phrasing, and soft melodic runs',
    rock: 'live rock vocal with clear projection, human grit, and band-driven urgency',
  };
  return map[key] || '';
}


type VocalCharacterScaleKey = 'ageLevel' | 'rangeLevel' | 'deliveryLevel' | 'rhythmLevel' | 'emotionLevel' | 'textureLevel' | 'charmLevel' | 'ornamentLevel';

type VocalCharacterScaleConfig = {
  key: VocalCharacterScaleKey;
  defaultValue: number;
  defaultValues?: number[];
  steps: string[];
};

const VOCAL_CHARACTER_SCALE_PROMPTS: VocalCharacterScaleConfig[] = [
  { key: 'ageLevel', defaultValue: 6, steps: [
    'childlike youthful vocal color',
    'teen-like vocal color',
    'young adult vocal color',
    'fresh early-adult vocal color',
    'clear young adult vocal color',
    '',
    'mature adult vocal color',
    'middle-aged seasoned vocal color',
    'aged seasoned vocal color',
    'veteran mature vocal color',
    'deep veteran vocal authority',
  ] },
  { key: 'rangeLevel', defaultValue: 6, steps: [
    'very deep low vocal range',
    'very low vocal range',
    'low vocal range',
    'low-mid vocal range',
    'slightly low natural vocal range',
    '',
    'slightly high natural vocal range',
    'upper-mid vocal range',
    'high vocal range',
    'thin very high vocal range',
    'extremely high thin vocal range',
  ] },
  { key: 'deliveryLevel', defaultValue: 6, steps: [
    'airy falsetto delivery',
    'thin falsetto delivery',
    'soft falsetto delivery',
    'falsetto-leaning mixed delivery',
    'connected mixed voice',
    '',
    'natural chest voice',
    'powerful chest voice',
    'speech-like singing delivery',
    'spoken theatrical delivery',
    'rap-like vocal delivery',
  ] },
  { key: 'rhythmLevel', defaultValue: 6, steps: [
    'extremely rushed vocal delivery, deliberately singing far ahead of the beat with urgent anticipatory phrasing',
    'ahead-of-the-beat vocal phrasing',
    'slightly anticipated vocal phrasing',
    'quick responsive vocal phrasing',
    'near-steady vocal phrasing with slight rhythmic pull',
    '',
    'laid-back behind-the-beat vocal phrasing',
    'loose rhythmic vocal delivery',
    'intentionally uneven off-beat timing, slightly missing the beat',
    'rubato, speech-like free-time vocal phrasing',
    'speech-like free-time vocal delivery, intentionally drifting outside the beat grid',
  ] },
  { key: 'emotionLevel', defaultValue: 6, steps: [
    'emotionless delivery',
    'cold restrained emotion',
    'restrained emotion',
    'calm understated emotion',
    'subtle gentle emotion',
    '',
    'expressive emotion',
    'strong expressive emotion',
    'dramatic emotion',
    'exaggerated theatrical emotion',
    'explosive emotional delivery',
  ] },
  { key: 'textureLevel', defaultValue: 6, steps: [
    'very dry vocal tone',
    'low vocal fry texture',
    'creaky vocal texture',
    'low growling vocal edge',
    'slightly nasal vocal tone',
    '',
    'warm vocal tone',
    'soft vocal texture',
    'airy vocal texture',
    'dreamy airy vocal texture',
    'glassy ethereal vocal texture',
  ] },
  { key: 'charmLevel', defaultValue: 6, steps: [
    'neutral colorless vocal charm',
    'pure innocent vocal charm',
    'cute playful vocal charm',
    'friendly approachable vocal charm',
    'warm comforting vocal charm',
    '',
    'soulful vocal character',
    'seductive magnetic vocal charm',
    'cool aloof vocal charm',
    'mysterious vocal aura',
    'dreamy enigmatic vocal charm',
  ] },
  { key: 'ornamentLevel', defaultValue: 8, steps: [
    'intentional strong nasal resonance technique',
    'clean connected phrasing',
    'clear precise articulation',
    'muted consonant-heavy articulation',
    'breathy phrasing',
    'breathy half-air stops',
    'double-breath phrasing',
    '',
    'soft ghost-note vocal touches',
    'slightly detuned vocal delivery',
    'smooth vocal glissando slides',
    'vocal trills and quick ornaments',
    'deep emotional vibrato',
    'vocal bends, slurred slides, and unique turns',
    'context-aware experimental vocal technique',
  ] },
];

function getVocalCharacterScalePhrase(character: any, config: VocalCharacterScaleConfig): string {
  const value = Number(character?.[config.key]);
  if (!Number.isFinite(value)) return '';
  const safe = Math.min(config.steps.length, Math.max(1, Math.round(value)));
  if (safe === config.defaultValue) return '';
  return config.steps[safe - 1] || '';
}

function getVocalCharacterScalePhrases(character: any): string[] {
  const parts = VOCAL_CHARACTER_SCALE_PROMPTS
    .map((config) => getVocalCharacterScalePhrase(character, config))
    .filter(Boolean);

  const ornamentConfig = VOCAL_CHARACTER_SCALE_PROMPTS.find((config) => config.key === 'ornamentLevel');
  if (ornamentConfig) {
    const mainValue = Number(character?.ornamentLevel);
    const mainSafe = Number.isFinite(mainValue) ? Math.min(ornamentConfig.steps.length, Math.max(1, Math.round(mainValue))) : ornamentConfig.defaultValue;
    const secondaryValue = Number(character?.ornamentSecondaryLevel);
    const secondarySafe = Number.isFinite(secondaryValue) ? Math.min(ornamentConfig.steps.length, Math.max(1, Math.round(secondaryValue))) : ornamentConfig.defaultValue;

    if (Number.isFinite(secondaryValue) && secondarySafe !== ornamentConfig.defaultValue) {
      const secondaryPhrase = ornamentConfig.steps[secondarySafe - 1] || '';
      if (secondaryPhrase) parts.push(secondaryPhrase);
    }
  }

  return parts;
}

function hasNonDefaultVocalCharacterScale(character: any): boolean {
  return VOCAL_CHARACTER_SCALE_PROMPTS.some((config) => {
    const value = Number(character?.[config.key]);
    const safe = Math.min(config.steps.length, Math.max(1, Math.round(value)));
    const hasMain = Number.isFinite(value) && safe !== config.defaultValue;
    if (config.key !== 'ornamentLevel') return hasMain;
    const secondaryValue = Number(character?.ornamentSecondaryLevel);
    const secondarySafe = Math.min(config.steps.length, Math.max(1, Math.round(secondaryValue)));
    const hasSecondary = Number.isFinite(secondaryValue) && secondarySafe !== config.defaultValue;
    return hasMain || hasSecondary;
  });
}

function hasVocalCharacterSelection(member: any): boolean {
  const character = member?.character || {};
  return Boolean(
    hasNonDefaultVocalCharacterScale(character) ||
    (Array.isArray(character.techniqueIds) && character.techniqueIds.length) ||
    character.customTechnique ||
    character.voiceToneId ||
    character.customVoiceTone ||
    character.personalityId ||
    character.customPersonality ||
    character.prompt
  );
}

type VocalTechniqueSlot = "register" | "texture" | "melody" | "rhythm" | "breath" | "experimental" | "custom";

type VocalTechniqueIntent = {
  id: string;
  phrase: string;
  slot: VocalTechniqueSlot;
  isExperimental: boolean;
};

type VocalIntentResult = {
  phrase: string;
  extraTechniques: VocalTechniqueIntent[];
  genreDNA: string;
};

function compactTechniquePhrases(phrases: string[]): string[] {
  return dedupePromptParts(phrases.filter(Boolean), 12).slice(0, 3);
}

function getVocalTechniqueItem(idOrText?: string): any | undefined {
  if (!idOrText) return undefined;
  const raw = String(idOrText).trim();
  if (!raw) return undefined;
  return (VOCAL_TECHNIQUES as readonly any[]).find(
    (item) => item.id === raw || item.label === raw || item.labelKo === raw,
  );
}

function vocalTechniqueSlot(item?: any, fallbackText = ""): VocalTechniqueSlot {
  const group = `${item?.groupKo || ""} ${item?.category || ""} ${item?.id || ""} ${fallbackText}`.toLowerCase();
  if (/experimental|실험|inward|multiphonic|glossolalia|microtonal|white_noise|death_growl|pig_squeal|overtone/.test(group)) return "experimental";
  if (/발성|성구|chest|head|mixed|falsetto|belting/.test(group)) return "register";
  if (/질감|공기|texture|breathy|airy|fry|edge|creaky|husky|growling|nasal/.test(group)) return "texture";
  if (/선율|기교|vibrato|bending|glissando|trill|flip|yodel|quarter|blue/.test(group)) return "melody";
  if (/박자|발음|layback|anticipation|slurring|muted|detonation|sprech|ghost/.test(group)) return "rhythm";
  if (/호흡|공간|breath|sigh|hiccup|off_mic|air_stop/.test(group)) return "breath";
  return "custom";
}

function compactTechniquePhraseById(idOrText?: string): string | undefined {
  if (!idOrText) return undefined;
  const raw = String(idOrText).trim();
  if (!raw) return undefined;
  const item = getVocalTechniqueItem(raw);
  const id = item?.id || raw;
  const compactById: Record<string, string> = {
    chest_voice: "chesty resonance",
    head_voice: "bright head-voice lift",
    mixed_voice: "full mixed-voice connection",
    falsetto: "airy falsetto edge",
    belting: "powerful high-note belt",
    breathy: "soft breath",
    airy: "airy breath",
    vocal_fry: "low vocal fry",
    edge_voice: "sharp edge bite",
    creaky_voice: "creaky cracks",
    husky: "husky grain",
    growling: "rough growl",
    nasal: "nasal focus",
    vibrato: "trembling vibrato",
    bending: "soft bending",
    glissando: "glissando slides",
    trill: "quick trills",
    voice_flip: "voice flips",
    yodeling: "playful voice flips",
    quarter_tone_bending: "quarter-tone bends",
    blue_note: "blue-note dips",
    layback: "laid-back timing",
    anticipation: "early urgent entries",
    slurring: "slurred phrasing",
    muted_pronunciation: "muted pronunciation",
    detonation: "slightly detuned endings",
    sprechgesang: "half-spoken delivery",
    ghost_note: "ghost-note whispers",
    reverse_breath: "reverse breaths",
    double_breath: "double breaths",
    half_air_stop: "half-air stops",
    vocal_sigh: "vocal sighs",
    vocal_hiccup: "small vocal hiccups",
    staccato_breath: "staccato breaths",
    off_mic: "off-mic distance",
    inward_singing: "inward-inhaled breaths",
    multiphonics: "split multiphonics",
    glottal_clicks: "subtle throat clicks",
    overtone_singing: "overtone throat drone",
    death_growl_pig_squeal: "distorted growl edge",
    white_noise_vocals: "static-noise voice",
    glossolalia: "emotional glossolalia",
    microtonal_slurring: "melting microtonal slides",
  };
  return compactById[id] || item?.promptCore || raw;
}

function buildTechniqueIntent(idOrText?: string): VocalTechniqueIntent | null {
  if (!idOrText) return null;
  const raw = String(idOrText).trim();
  if (!raw) return null;
  const item = getVocalTechniqueItem(raw);
  const phrase = compactTechniquePhraseById(raw);
  if (!phrase) return null;
  const slot = vocalTechniqueSlot(item, raw);
  return { id: item?.id || raw, phrase, slot, isExperimental: slot === "experimental" };
}

function resolveVocalVoiceToneCompact(idOrText?: string): string | undefined {
  if (!idOrText) return undefined;
  const raw = String(idOrText).trim();
  if (!raw) return undefined;
  const found = (VOCAL_VOICE_TONES as readonly any[]).find(
    (item) => item.id === raw || item.label === raw || item.labelKo === raw,
  );
  const compactById: Record<string, string> = {
    calm: "calm tone",
    heavy: "deep chesty tone",
    first_love: "fragile first-love tone",
    clear: "clear clean tone",
    hollow: "hollow distant tone",
    husky_tone: "husky dry tone",
    lazy: "lazy relaxed tone",
    bright: "bright lively tone",
    wet: "wet emotional tone",
    dry: "dry plain tone",
  };
  return (found && compactById[found.id]) || found?.promptCore || raw;
}

function resolveVocalPersonalityCompact(idOrText?: string): string | undefined {
  if (!idOrText) return undefined;
  const raw = String(idOrText).trim();
  if (!raw) return undefined;
  const found = (VOCAL_PERSONALITIES as readonly any[]).find(
    (item) => item.id === raw || item.label === raw || item.labelKo === raw,
  );
  const compactById: Record<string, string> = {
    relaxed: "relaxed attitude",
    cool: "cool restraint",
    plain: "calm surface, hidden ache",
    frustrated: "bottled frustration",
    stubborn: "stubborn edge",
    bouncy: "playful bounce",
    cute: "innocent color",
    clingy: "pleading attachment",
    sensitive: "wounded sensitivity",
    sly: "sly teasing",
    proud: "proud vulnerability",
    unable_to_let_go: "unable-to-let-go pull",
  };
  return (found && compactById[found.id]) || found?.promptCore || raw;
}

function summarizeVocalPsychology(personality?: string): string {
  const value = String(personality || '').toLowerCase();
  if (!value) return '';
  if (/plain|calm surface|hidden ache|restrained/.test(value)) return 'calm surface, hidden ache';
  if (/cool|hidden/.test(value)) return 'cool restraint';
  if (/relaxed/.test(value)) return 'relaxed attitude';
  if (/pleading|attachment|cannot quite let go|unable/.test(value)) return 'pleading attachment';
  if (/bottled|frustrated/.test(value)) return 'bottled frustration';
  if (/stubborn/.test(value)) return 'stubborn edge';
  if (/bouncy|playful/.test(value)) return 'playful bounce';
  if (/cute|innocent/.test(value)) return 'innocent color';
  if (/sensitive|wounded/.test(value)) return 'wounded sensitivity';
  if (/sly|teasing/.test(value)) return 'sly teasing';
  if (/proud/.test(value)) return 'proud vulnerability';
  return '';
}

function mergeVocalIntentPhrases(tone: string, techniques: VocalTechniqueIntent[], personality: string, maxParts = 6): string[] {
  let tonePhrase = tone;
  const has = (id: string) => techniques.some((item) => item.id === id);
  const removeIds = new Set<string>();
  const merged: string[] = [];

  if (/deep|heavy|chest/i.test(tonePhrase) && has("chest_voice")) {
    tonePhrase = "deep chesty tone";
    removeIds.add("chest_voice");
  }
  if (has("creaky_voice") && has("growling")) {
    merged.push("creaky growl");
    removeIds.add("creaky_voice");
    removeIds.add("growling");
  }
  if (has("head_voice") && has("belting")) {
    merged.push("bright head-voice belt");
    removeIds.add("head_voice");
    removeIds.add("belting");
  }
  if (has("breathy") && has("airy")) {
    merged.push("airy breath");
    removeIds.add("breathy");
    removeIds.add("airy");
  }
  if (has("voice_flip") && has("yodeling")) {
    merged.push("playful voice flips");
    removeIds.add("voice_flip");
    removeIds.add("yodeling");
  }
  if (has("slurring") && has("glissando")) {
    merged.push("slurred glissando slides");
    removeIds.add("slurring");
    removeIds.add("glissando");
  }

  const remaining = techniques.filter((item) => !removeIds.has(item.id)).map((item) => item.phrase);
  return dedupePromptParts([tonePhrase, ...merged, ...remaining, personality].filter(Boolean), 14).slice(0, Math.max(3, maxParts));
}

function selectCoreTechniqueIntents(intents: VocalTechniqueIntent[], maxCore = 3): { core: VocalTechniqueIntent[]; extra: VocalTechniqueIntent[] } {
  const picked: VocalTechniqueIntent[] = [];
  const used = new Set<string>();
  const take = (slot: VocalTechniqueSlot) => {
    const item = intents.find((intent) => intent.slot === slot && !used.has(intent.id));
    if (item) { picked.push(item); used.add(item.id); }
  };

  take("register");
  take("texture");
  if (picked.length < 2) take("melody");
  if (picked.length < 2) take("rhythm");
  if (picked.length < 2) take("breath");
  take("experimental");

  for (const slot of ["melody", "rhythm", "breath", "texture", "register", "custom", "experimental"] as VocalTechniqueSlot[]) {
    if (picked.length >= maxCore) break;
    take(slot);
  }

  for (const item of intents) {
    if (picked.length >= maxCore) break;
    if (used.has(item.id)) continue;
    picked.push(item);
    used.add(item.id);
  }

  const extra = intents.filter((intent) => !used.has(intent.id));
  return { core: picked.slice(0, maxCore), extra };
}

function buildVocalIntentResult(member: any, params?: GenerateSongParams, includeGenreDNA = true): VocalIntentResult {
  if (!hasVocalCharacterSelection(member)) return { phrase: '', extraTechniques: [], genreDNA: getGenreVocalDNAPhrase(params) };
  const character = member?.character || {};
  const scaleTechniquePhrases = getVocalCharacterScalePhrases(character);
  const intents = Array.isArray(character.techniqueIds)
    ? character.techniqueIds.map(buildTechniqueIntent).filter(Boolean) as VocalTechniqueIntent[]
    : [];
  scaleTechniquePhrases.forEach((phrase) => {
    const lower = phrase.toLowerCase();
    const slot: VocalTechniqueSlot = /experimental|glitch|spre|yodel|whisper-noise|cracked|unstable pitch/.test(lower)
      ? 'experimental'
      : /range|voice|falsetto|chest|mixed|spoken|rap-like/.test(lower)
        ? 'register'
        : /beat|phrasing|timing|anticipated/.test(lower)
          ? 'rhythm'
          : /tone|texture|dry|rough|husky|warm|soft|airy|age|adult|teen|seasoned|childlike/.test(lower)
            ? 'texture'
            : /vibrato|trill|bend|slurred|ornament|ghost|muted|half-air/.test(lower)
              ? 'melody'
              : 'custom';
    intents.push({ id: phrase, phrase, slot, isExperimental: slot === 'experimental' });
  });
  if (character.customTechnique) {
    intents.push({ id: String(character.customTechnique).trim(), phrase: String(character.customTechnique).trim(), slot: "custom", isExperimental: false });
  }

  const isLargeGroup = params ? shouldApplyLargeGroupVocalCompression(params) : false;
  const maxCore = isLargeGroup ? 3 : 12;
  const { core, extra } = selectCoreTechniqueIntents(intents, maxCore);
  const voiceTone = resolveVocalVoiceToneCompact(character.voiceToneId) || character.customVoiceTone || '';
  const personalityRaw = resolveVocalPersonalityCompact(character.personalityId) || character.customPersonality || '';
  const personality = summarizeVocalPsychology(personalityRaw) || personalityRaw;
  const genreDNA = getGenreVocalDNAPhrase(params);
  const parts = mergeVocalIntentPhrases(voiceTone, core, personality, isLargeGroup ? 6 : 12);
  const promptParts = includeGenreDNA && genreDNA ? [...parts, genreDNA] : parts;

  const phrase = joinReadable(promptParts)
    .replace(/[\[\]]/g, '')
    .replace(/ghostly inward-inhaled singing\s+singing/gi, 'inward-inhaled breaths')
    .replace(/ghostly inward-inhaled singing/gi, 'inward-inhaled breaths')
    .replace(/\bsinging\s+singing\b/gi, 'singing')
    .replace(/\bvocal\s+vocal\b/gi, 'vocal')
    .replace(/\bpansori-style vocal\b/gi, 'pansori-style tone')
    .replace(/\bvocal tone\b/gi, 'tone')
    .replace(/\btone tone\b/gi, 'tone')
    .replace(/\bunderneath\s+underneath\b/gi, 'underneath')
    .replace(/\bkeeping\s+keeping\b/gi, 'keeping')
    .replace(/\bwith\s+keeping\b/gi, 'with')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

  return { phrase, extraTechniques: extra, genreDNA };
}


function rawVocalRoleBase(role: string): string {
  const value = String(role || "").toLowerCase();
  if (value.includes("rap")) return "Rap Vocal";
  if (value.includes("main")) return "Main Vocal";
  if (value.includes("lead")) return "Lead Vocal";
  if (value.includes("sub")) return "Sub Vocal";
  return "Vocal";
}

function uniquifyVocalLabel(label: string, used: Set<string>): string {
  const clean = String(label || "Vocal").replace(/\s+/g, " ").trim();
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  const letters = ["A", "B", "C", "D", "E"];
  for (const letter of letters) {
    const candidate = `${clean} ${letter}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  let n = 2;
  while (used.has(`${clean} ${n}`)) n += 1;
  const candidate = `${clean} ${n}`;
  used.add(candidate);
  return candidate;
}

function buildCharacterVocalLabel(member: any, index: number, params: GenerateSongParams, used: Set<string>): string {
  const rawRole = member?.roles?.[0] || getDefaultMultiVocalRole(index, params.vocal?.members?.length || 2, Boolean(params.vocal?.rap));
  const base = rawVocalRoleBase(rawRole);
  const characterPhrase = buildVocalIntentResult(member, params, false).phrase.toLowerCase();
  const displayName = String(member?.character?.displayName || "").trim();
  if (displayName) {
    const safe = displayName
      .replace(/[\[\]{}()]/g, "")
      .replace(/[^a-zA-Z0-9가-힣\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (safe && safe.length <= 24) return uniquifyVocalLabel(safe, used);
  }

  const candidates: string[] = [];
  if (base === "Rap Vocal") {
    if (/deep|heavy|chesty|low|chest/.test(characterPhrase)) candidates.push("Low Rap Vocal");
    if (/wet|nasal/.test(characterPhrase)) candidates.push("Wet Rap Vocal");
    if (/creaky|growl|rough/.test(characterPhrase)) candidates.push("Creaky Rap Vocal");
    if (/bright|head-voice|head voice|clear/.test(characterPhrase)) candidates.push("Bright Rap Vocal");
    if (/breath|breathy|airy|whisper/.test(characterPhrase)) candidates.push("Whisper Rap Vocal");
    if (/playful|flip|click|rhythmic/.test(characterPhrase)) candidates.push("Playful Rap Vocal");
    if (/stubborn|grit|intensity/.test(characterPhrase)) candidates.push("Stubborn Rap Vocal");
    candidates.push("Rap Vocal");
  } else {
    const suffix = base === "Vocal" ? "Vocal" : base;
    if (/hollow|distant|empty/.test(characterPhrase)) candidates.push(`Hollow ${suffix}`.replace(/Vocal Vocal$/i, "Vocal"));
    if (/airy|falsetto|breath|breathy/.test(characterPhrase)) candidates.push(`Airy ${suffix}`.replace(/Vocal Vocal$/i, "Vocal"));
    if (/clear|bright|head-voice|first-love/.test(characterPhrase)) candidates.push(`Clear ${suffix}`.replace(/Vocal Vocal$/i, "Vocal"));
    if (/wet|nasal/.test(characterPhrase)) candidates.push(`Wet ${suffix}`.replace(/Vocal Vocal$/i, "Vocal"));
    if (/deep|heavy|chesty|low/.test(characterPhrase)) candidates.push(`Deep ${suffix}`.replace(/Vocal Vocal$/i, "Vocal"));
    if (/calm|plain|restraint|relaxed/.test(characterPhrase)) candidates.push(`Calm ${suffix}`.replace(/Vocal Vocal$/i, "Vocal"));
    candidates.push(base);
  }

  const first = candidates.map((c) => c.replace(/\s+/g, " ").trim()).find(Boolean) || base;
  return uniquifyVocalLabel(first, used);
}

function getVocalCharacterTagLabels(params: GenerateSongParams): string[] {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isMulti) return [];
  const members = params.vocal?.members || [];
  if (!members.some((member: any) => hasVocalCharacterSelection(member))) return [];
  const used = new Set<string>();
  return members.slice(0, 5).map((member: any, index: number) => buildCharacterVocalLabel(member, index, params, used));
}

function buildVocalCharacterPrompt(member: any, params?: GenerateSongParams, includeGenreDNA = true): string {
  return buildVocalIntentResult(member, params, includeGenreDNA).phrase;
}

function buildExtraTechniqueLyricTagInstruction(params: GenerateSongParams): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isMulti) return '';
  const members = params.vocal?.members || [];
  const lines: string[] = [];
  members.slice(0, 5).forEach((member: any, index: number) => {
    const result = buildVocalIntentResult(member, params, false);
    if (!result.extraTechniques.length) return;
    const labels = getVocalCharacterTagLabels(params);
    const roleLabel = labels[index] || buildCharacterVocalLabel(member, index, params, new Set<string>());
    const cue = result.extraTechniques[0]?.phrase;
    if (cue) lines.push(`- ${roleLabel}: if emphasis is needed, use one compact lyric tag such as [Bridge: ${roleLabel}, ${cue}] or [Breakdown: ${roleLabel}, ${cue}].`);
  });
  if (!lines.length) return '';
  return `\n[VOCAL CHARACTER LYRIC TAG CANDIDATES]\n${lines.join('\n')}\n- Use these only once when musically useful. Do not stuff every section tag with technique names.`;
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
        const characterPrompt = buildVocalCharacterPrompt(m, undefined);
        if (!hasRoles && !hasTone && !characterPrompt) return null;

        const genderStr = m.gender === "male" ? "Male" : "Female";
        const rolesStr = hasRoles ? m.roles.join(", ") : "";
        const roleForLabel = rolesStr || getDefaultMultiVocalRole(idx, vocal.members?.length ?? 0, Boolean(vocal.rap));
        const toneValue = m.toneId
          ? describeVocalToneForSplit(m.toneId, roleForLabel, m.gender)
          : "";
        const tagLabel = lyricTagLabelFromRoleTone(
          roleForLabel,
          toneValue || characterPrompt || roleForLabel,
          male > 0 && female > 0,
          m.gender,
        );
        const toneInfo = toneValue ? `, Tone: ${toneValue}` : "";
        const characterInfo = characterPrompt
          ? `, Vocal Character: ${characterPrompt}`
          : "";

        const rolesPart = rolesStr ? `: ${rolesStr}` : "";
        return `- ${tagLabel} (${genderStr})${rolesPart}${toneInfo}${characterInfo}`;
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
- If Vocal Character exists, preserve the selected age/range/delivery/rhythm/emotion/texture/charm/ornament cues in the final [Vocals] line as primary vocal direction, not as optional flavor.
- For solo or duo vocals, include at least 5 distinct Vocal Character cues per configured singer when available: age/range, delivery/register, timing/rhythm, emotion, texture/charm, and ornament/technique. The [Vocals] line may be longer so the character voice is clear.
- Do not dump Vocal Character cues as a keyword chain. Rewrite them into one natural singer-direction sentence for each singer. Merge only truly similar cues into compact phrases, but do not silently drop distinct selected cues such as teen/high/chest voice/rushed timing/bright charm/ornament.
- When Situation roles also exist, use Situation for role/attitude/speech context and Vocal Character for voice color, delivery, timing, texture, charm, and technique. Do not let one erase the other; combine them in the same singer sentence.
- Apply hard compression only to 3+ member group vocals. For 1-2 characters, prefer clarity and emotional specificity over excessive brevity. Do not wrap Style/Prompt vocal instructions in square brackets.
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
      pointSounds: (first as any).pointSounds ?? [],
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
      instrumentalBgmMode: Boolean((first as any).instrumentalBgmMode),
      lyricLanguages: ((first as any).lyricLanguages ?? ["ko"]) as LanguageCode[],
      geminiApiKey: String((first as any).geminiApiKey || '').trim(),
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
    pointSounds: [],
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

function stripLyricSectionTagLines(text: string): string {
  return String(text || "")
    // Exclude full-line Suno section tags and their cue text from language-ratio calculations.
    // Example: [Verse A: low and intimate] should not count as English lyric content.
    .replace(/^\s*\[[^\]]+\]\s*$/gm, "")
    .trim();
}

function countEnglishWords(text: string): number {
  const lyricBodyOnly = stripLyricSectionTagLines(text);
  return (lyricBodyOnly.match(/[A-Za-z]+(?:[’'-][A-Za-z]+)?/g) || []).length;
}

function countKoreanWordUnits(text: string): number {
  return String(text || "")
    .split(/\s+/)
    .filter((part) => /[가-힣]/.test(part)).length;
}

function countLyricWordUnits(text: string): number {
  const plain = stripLyricSectionTagLines(text);
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
  const maxWordsPerKeptFragment = ratio >= 90 ? 40 : ratio >= 70 ? 32 : ratio >= 50 ? 24 : ratio <= 5 ? 3 : ratio <= 10 ? 5 : ratio <= 20 ? 8 : 14;

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


function raiseEnglishMixRatioInKoreanLyrics(text: string, englishMixRatio = 10): string {
  const ratio = normalizeEnglishMixRatio(englishMixRatio);
  let source = String(text || "");
  if (!source.trim() || ratio <= 0) return source;

  const totalUnits = countLyricWordUnits(source);
  const maxEnglishWords = Math.max(1, Math.floor((totalUnits * ratio) / 100));
  const currentEnglishWords = countEnglishWords(source);

  // Treat the selected value as the intended mix strength, not a random decoration.
  // Still keep it safely below the selected maximum, then final limiter enforces the cap.
  const targetEnglishWords = Math.max(
    1,
    Math.floor(
      maxEnglishWords * (ratio >= 90 ? 0.96 : ratio >= 70 ? 0.92 : ratio >= 50 ? 0.86 : ratio >= 30 ? 0.78 : ratio >= 20 ? 0.65 : ratio >= 10 ? 0.45 : 0.25),
    ),
  );

  if (currentEnglishWords >= targetEnglishWords) return source;

  const phrasePool = ratio >= 70
    ? ["I can't run away", "It's written in the stars", "Tell me what you want", "I'm losing control", "No more hiding", "Stay with me tonight", "We can break the fate", "Don't let me go", "Everything is changing", "Right here, right now", "I'm falling into you", "This is not a dream"]
    : ratio >= 50
      ? ["Stay with me", "right now", "I need you", "Don't let go", "Feel alive", "You and I", "No more", "Take me higher", "Hold on", "Let it go"]
      : ratio >= 30
        ? ["(Stay with me)", "tonight", "One more time", "I need you", "Don't let go", "right now", "Feel alive", "You and I", "No more", "Take me higher", "Hold on", "Let it go"]
        : ratio >= 20
          ? ["(Stay tonight)", "One more time", "You and I", "Feel alive"]
          : ratio >= 10
            ? ["(Stay)", "tonight", "You and I"]
            : ["(Stay)"];

  const maxInjections = ratio >= 90 ? 48 : ratio >= 70 ? 40 : ratio >= 50 ? 32 : ratio >= 30 ? 18 : ratio >= 20 ? 8 : ratio >= 10 ? 4 : 1;
  const lines = source.split("\n");
  let usedEnglishWords = currentEnglishWords;
  let injected = 0;
  let phraseIndex = 0;

  const choosePhrase = () => {
    for (let attempt = 0; attempt < phrasePool.length; attempt += 1) {
      const phrase = phrasePool[(phraseIndex + attempt) % phrasePool.length];
      const words = countEnglishWords(phrase);
      if (usedEnglishWords + words <= maxEnglishWords) {
        phraseIndex += attempt + 1;
        return { phrase, words };
      }
    }
    return null;
  };

  // Prefer musical payoff sections first so English feels intentional, not scattered randomly.
  const preferredIndexes: number[] = [];
  let currentSection = "";
  lines.forEach((line, index) => {
    const tag = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (tag) {
      currentSection = tag[1].toLowerCase();
      return;
    }
    if (/chorus|hook|rap|bridge|final/.test(currentSection)) preferredIndexes.push(index);
  });

  const allIndexes = lines.map((_, index) => index);
  const orderedIndexes = [...preferredIndexes, ...allIndexes.filter((index) => !preferredIndexes.includes(index))];

  for (const index of orderedIndexes) {
    if (injected >= maxInjections || usedEnglishWords >= targetEnglishWords) break;

    const rawLine = lines[index] || "";
    const trimmed = rawLine.trim();
    if (!trimmed || /^\[[^\]]+\]$/.test(trimmed)) continue;
    if (!/[가-힣]/.test(trimmed)) continue;
    if (countEnglishWords(trimmed) > 0) continue;

    const picked = choosePhrase();
    if (!picked) break;

    lines[index] = `${rawLine} ${picked.phrase}`.trimEnd();
    usedEnglishWords += picked.words;
    injected += 1;
  }

  return lines.join("\n");
}

function rebalanceHighEnglishMixDominance(text: string, englishMixRatio = 10): string {
  const ratio = normalizeEnglishMixRatio(englishMixRatio);
  let source = String(text || "");
  if (!source.trim() || ratio < 50) return source;

  const getActualEnglishShare = (value: string) => {
    const total = countLyricWordUnits(value);
    return total <= 0 ? 0 : countEnglishWords(value) / total;
  };

  const minimumShare = ratio >= 90 ? 0.78 : ratio >= 70 ? 0.62 : 0.45;
  if (getActualEnglishShare(source) >= minimumShare) return source;

  const phrasePool = ratio >= 90
    ? [
        "I can't run away from this feeling",
        "Everything is written in the stars",
        "Tell me what you really want",
        "I'm losing control tonight",
        "No more hiding from the truth",
        "Stay with me before we fall",
        "We can break the fate tonight",
        "Don't let me go so easily",
        "Everything is changing around us",
        "Right here, right now, I know",
        "I'm falling into you again",
        "This is not a dream anymore",
      ]
    : [
        "I can't run away",
        "It's written in the stars",
        "Tell me what you want",
        "I'm losing control",
        "No more hiding",
        "Stay with me tonight",
        "We can break the fate",
        "Don't let me go",
        "Everything is changing",
        "Right here, right now",
      ];

  let phraseIndex = 0;
  let koreanBodyLineCount = 0;
  const nextPhrase = () => {
    const phrase = phrasePool[phraseIndex % phrasePool.length];
    phraseIndex += 1;
    return phrase;
  };

  const lines = source.split("\n");
  const adjusted: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^\[[^\]]+\]$/.test(trimmed)) {
      adjusted.push(line);
      continue;
    }

    const hasKorean = containsHangul(trimmed);
    const englishWords = countEnglishWords(trimmed);

    if (!hasKorean) {
      adjusted.push(line);
      continue;
    }

    koreanBodyLineCount += 1;

    if (ratio >= 90) {
      // 90% should feel like English-led lyrics. Keep only occasional Korean identity lines;
      // replace most Korean-heavy body lines with English body lines. Section tags are not touched.
      const keepKoreanIdentityLine = koreanBodyLineCount % 5 === 0 || englishWords >= 5;
      if (keepKoreanIdentityLine) {
        adjusted.push(line);
      } else {
        adjusted.push(nextPhrase());
      }
      continue;
    }

    // 50-70% should add English body lines without relying on section tags.
    adjusted.push(line);
    const needsMoreEnglish = ratio >= 70
      ? englishWords === 0 || englishWords < countKoreanWordUnits(trimmed)
      : englishWords === 0 && koreanBodyLineCount % 2 === 0;
    if (needsMoreEnglish) {
      adjusted.push(nextPhrase());
    }
  }

  source = adjusted.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // If still below the intended floor, add compact English response lines after lyric body lines
  // instead of relying on section tags to fake the ratio.
  if (getActualEnglishShare(source) < minimumShare) {
    const expanded: string[] = [];
    for (const line of source.split("\n")) {
      expanded.push(line);
      const trimmed = line.trim();
      if (!trimmed || /^\[[^\]]+\]$/.test(trimmed)) continue;
      if (containsHangul(trimmed) && getActualEnglishShare(expanded.join("\n")) < minimumShare) {
        expanded.push(nextPhrase());
      }
    }
    source = expanded.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  return source;
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

  const koreanMixed = ratio >= 50
    ? rebalanceHighEnglishMixDominance(
        raiseEnglishMixRatioInKoreanLyrics(koreanSource, ratio),
        ratio,
      )
    : raiseEnglishMixRatioInKoreanLyrics(koreanSource, ratio);

  const englishMixed = injectMixedPhrases(
    lyrics.english ?? "",
    ["(이 밤에)", "(너와 나)", "(괜찮아)"],
    containsHangul,
    maxInjections,
  );

  return {
    korean: ratio >= 50
      ? rebalanceHighEnglishMixDominance(koreanMixed, ratio)
      : limitEnglishMixRatioInKoreanLyrics(koreanMixed, ratio),
    english: englishMixed,
  };
}


function normalizeEnglishMixRatio(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(0, Math.min(90, Math.round(numeric)));
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
  const pointSounds = params.pointSounds ?? [];
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
    pointSound: pointSounds,
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




function isCustomInstrumentalTag(tag: string): boolean {
  const raw = String(tag || '').trim();
  // Only explicit instrumental/no-vocal ownership tags should force a whole
  // section to become instrumental. Cues like "Instrumental break" should
  // not turn a vocal section into an instrumental section.
  return /^(?:Instrumental|Instrumental Opening|Instrumental only|No vocals|No humming|No chant|Pure instrumental)$/i.test(raw);
}

function isInstrumentalOnlyLyricCue(value: string): boolean {
  const raw = String(value || '').trim();
  return /^(?:Instrumental\s+solo|Solo\s+instrumental|Instrumental\s+only|Pure\s+instrumental|No\s+vocals?|No\s+humming|No\s+chant)$/i.test(raw);
}

function hasInstrumentalOnlyLyricCue(parts: string[]): boolean {
  return parts.some((part) => isInstrumentalOnlyLyricCue(part) || isCustomInstrumentalTag(part));
}

function isHumanVoiceCueText(value: string): boolean {
  const raw = String(value || '');
  return /\b(?:vocal|vocals|voice|rap|singer|singing|spoken|spoken\s+word|lead\s+vocal|main\s+vocal|sub\s+vocal|harmony\s+vocal|all\s+vocals|choir|chorus\s+vocal|ad[-\s]?lib|adlib|chant|chanting|humming|hum|whisper|breath|breathy|sigh|sob|cry|gasp|laugh|spoken\s+intro)\b|구음|허밍|목소리|보컬|랩|노래|가창|합창|애드립|숨소리|한숨|속삭임/i.test(raw);
}

function cleanInstrumentalCueText(value: string): string {
  return cleanupPromptTail(
    cleanEnglishOnlyLyricTagPart(String(value || ''))
      .replace(/\b(?:ONLY\s+)?(?:Low|Wet|Creaky|Bright|Whisper|Playful|Stubborn|Deep|Airy|Hollow|Clear|Male|Female|Rap|Main|Sub|Harmony|All)\s+Vocals?\b/gi, ' ')
      .replace(/\b(?:ONLY\s+)?Lead\s+Vocals?\b/gi, ' ')
      .replace(/\b(?:male|female)\s+(?:vocal|rap)\b/gi, ' ')
      .replace(/\b(?:vocal|vocals|voice|rap|singer|singing|spoken|lead\s+vocal|main\s+vocal|sub\s+vocal|harmony\s+vocal|all\s+vocals|choir|ad[-\s]?lib|adlib|chant|chanting|humming|hum|whisper|breath|breathy|sigh|sob|cry|gasp|laugh)\b/gi, ' ')
      .replace(/구음|허밍|목소리|보컬|랩|노래|가창|합창|애드립|숨소리|한숨|속삭임/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );
}

function cleanInstrumentalCueParts(parts: string[]): string[] {
  const out: string[] = [];
  parts.forEach((part) => {
    const raw = String(part || '').trim();
    if (!raw || isCustomInstrumentalTag(raw) || isHumanVoiceCueText(raw)) return;
    const clean = cleanInstrumentalCueText(raw);
    if (!clean || isHumanVoiceCueText(clean)) return;
    if (!out.some((item) => item.toLowerCase() === clean.toLowerCase())) out.push(clean);
  });
  return out.slice(0, 3);
}

function customForcedInstrumentalSections(params: GenerateSongParams): Set<string> {
  const forced = new Set<string>();
  (params.customStructure || []).forEach((item) => {
    const sectionName = normalizeLyricSectionDisplayName(String(item.section || '').trim());
    const base = baseLyricSectionName(sectionName);
    const tags = item.tags || [];
    const isInstrumentalSection = /^(?:Instrumental|Solo)$/i.test(sectionName);
    const hasInstrumentalTag = tags.some((tag) => isCustomInstrumentalTag(tag));
    if (sectionName && (isInstrumentalSection || hasInstrumentalTag)) {
      forced.add(sectionName.toLowerCase());
      if (base) forced.add(base.toLowerCase());
    }
  });
  return forced;
}

function isForcedInstrumentalLyricSection(section: string, params: GenerateSongParams): boolean {
  const normalized = normalizeLyricSectionDisplayName(section || '');
  const base = baseLyricSectionName(normalized);
  if (/^(?:Instrumental|Instrumental Opening|Solo)$/i.test(normalized)) return true;
  const forced = customForcedInstrumentalSections(params);
  return forced.has(normalized.toLowerCase()) || forced.has(base.toLowerCase());
}

function buildInstrumentalOnlyTag(section: string, cues: string[] = []): string {
  const cleanSection = normalizeLyricSectionDisplayName(section || 'Instrumental');
  const cleanCues = cleanInstrumentalCueParts(cues);

  // Avoid redundant tags like [Instrumental: Instrumental] or
  // [Instrumental: Instrumental, haegeum solo].
  // For Intro/Outro that are forced to instrumental by a custom tag, keep
  // [Intro: Instrumental, ...] because the section name itself is not an
  // instrumental cue.
  const sectionAlreadyInstrumental = /^(?:Instrumental|Instrumental Opening|Solo|Drop|Breakdown)$/i.test(cleanSection);
  const cueAlreadyDeclaresInstrumental = cleanCues.some((cue) => /^Instrumental\b|^Pure\s+instrumental\b|^No\s+vocals?\b/i.test(cue));
  const bodyParts = (sectionAlreadyInstrumental || cueAlreadyDeclaresInstrumental) ? cleanCues : ['Instrumental', ...cleanCues];
  const body = bodyParts.filter(Boolean).join(', ');
  return `[${cleanSection}${body ? `: ${body}` : ''}]`;
}

function isWarHistoricalContext(params: GenerateSongParams): boolean {
  const haystack = [
    params.userInput,
    params.lyricDraft,
    params.situation?.description,
    params.situation?.details,
    params.situation?.development,
    params.situation?.developmentCustom,
    params.situation?.targetA,
    params.situation?.targetB,
    ...(params.themes || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return /전쟁|전투|역사|영웅|장군|이순신|명량|울돌목|해전|전장|결사|필사즉생|필생즉사|battle|war|hero|historical|admiral|naval|navy|battlefield|twelve\s+ships/.test(haystack);
}

function sanitizeWarContextPromptLine(line: string, params: GenerateSongParams): string {
  if (!isWarHistoricalContext(params)) return line;
  return cleanupPromptTail(String(line || '')
    .replace(/where\s+a\s+tiny\s+everyday\s+conflict\s+carries\s+the\s+whole\s+relationship/gi, 'where fear hardens into resolve through the battle image')
    .replace(/where\s+the\s+singer\s+insists\s+they\s+are\s+fine\s+while\s+the\s+details\s+say\s+otherwise/gi, 'where fear is hidden under resolve')
    .replace(/where\s+one\s+visible\s+object\s+becomes\s+the\s+emotional\s+center/gi, 'where the battle image carries the emotional weight')
    .replace(/where\s+the\s+key\s+image\s+only\s+becomes\s+clear\s+near\s+the\s+end/gi, 'where the battle image is clear from the beginning')
    .replace(/where\s+the\s+real\s+confession\s+is\s+held\s+back\s+until\s+later/gi, 'where fear is buried under resolve')
    .replace(/where\s+.*?confession.*?(?:later|opens|reveals?)/gi, 'where fear is buried under resolve')
    .replace(/micro-conflict\s+hook\s+with\s+subtle\s+lift/gi, 'battle-driven hook with restrained lift')
    .replace(/delayed\s+confession\s+with\s+gradual\s+lift/gi, 'battle-driven build with restrained lift')
    .replace(/delayed\s+image\s+reveal/gi, '')
    .replace(/delayed\s+confession/gi, 'delayed strike')
    .replace(/real\s+confession/gi, 'buried resolve')
    .replace(/tiny\s+everyday\s+conflict/gi, 'battle tension')
    .replace(/whole\s+relationship/gi, 'whole conflict')
    .replace(/relationship/gi, 'conflict')
    .replace(/confession/gi, 'resolve')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' '));
}

function isCustomStopTransitionTag(tag: string): boolean {
  return /^\s*(?:\[?\s*)?Stop(?:\s*\]?)?\s*$/i.test(String(tag || '').trim())
    || /^\s*Hard\s+Stop\s*$/i.test(String(tag || '').trim());
}

function customStopTransitionSections(params: GenerateSongParams): Set<string> {
  const forced = new Set<string>();
  (params.customStructure || []).forEach((item) => {
    const sectionName = normalizeLyricSectionDisplayName(String(item.section || '').trim());
    const base = baseLyricSectionName(sectionName);
    const tags = item.tags || [];
    if (sectionName && tags.some((tag) => isCustomStopTransitionTag(tag))) {
      forced.add(sectionName.toLowerCase());
      if (base) forced.add(base.toLowerCase());
    }
  });
  return forced;
}

function sectionHasCustomStop(section: string, params: GenerateSongParams): boolean {
  const normalized = normalizeLyricSectionDisplayName(section || '');
  const base = baseLyricSectionName(normalized);
  const stops = customStopTransitionSections(params);
  return stops.has(normalized.toLowerCase()) || stops.has(base.toLowerCase());
}

function parseVocalPlacementStructureTag(tag: string): { type: 'single' | 'all'; label: string; cue: string } | null {
  const raw = String(tag || '').trim();
  if (!raw) return null;
  if (raw.startsWith('VOCAL_ALL::')) {
    const parts = raw.split('::');
    return { type: 'all', label: cleanupPromptTail(parts[1] || 'All Vocals'), cue: cleanupPromptTail(parts[2] || '') };
  }
  if (raw.startsWith('VOCAL::')) {
    const parts = raw.split('::');
    return { type: 'single', label: cleanupPromptTail(parts[1] || 'Vocal'), cue: cleanupPromptTail(parts[2] || '') };
  }
  return null;
}

function isRedundantVocalStructureCue(tag: string): boolean {
  const value = String(tag || '').trim();
  if (!value) return true;
  return /^(?:ONLY\s+)?(?:Male|Female|남성\d*|여성\d*|Main Vocal|Lead Vocal|Sub Vocal|Rap Vocal|Bright Rap Vocal|Airy Female Vocal|Female Main Vocal|Male Main Vocal)$/i.test(value)
    || /^(?:ONLY\s+)?(?:Male|Female)\s+(?:Main\s+)?Vocal$/i.test(value)
    || /^(?:Instrumental\s+break|vocal\s+break)$/i.test(value)
    || /^Instrumental$/i.test(value);
}

function compactStructureCue(tag: string): string {
  return cleanupPromptTail(cleanEnglishOnlyLyricTagPart(String(tag || ''))
    .replace(/\b(?:ONLY\s+)?(?:Male|Female)\s+(?:Main\s+)?Vocal\b/gi, ' ')
    .replace(/\b(?:ONLY\s+)?(?:Male|Female|Main Vocal|Lead Vocal|Sub Vocal)\b/gi, ' ')
    .replace(/\bInstrumental\s+break\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim());
}


function formatCustomStructureTagForPrompt(sectionName: string, tags: string[]): string[] {
  const isInstrumentalSection = /^(?:Instrumental|Solo)$/i.test(String(sectionName || '').trim());
  const requestedInstrumental = isInstrumentalSection || tags.some((tag) => isCustomInstrumentalTag(tag));
  const vocalTags = tags.map(parseVocalPlacementStructureTag).filter(Boolean) as Array<{ type: 'single' | 'all'; label: string; cue: string }>;
  const stopRequested = tags.some((tag) => isCustomStopTransitionTag(tag));
  const rawNormalTags = tags.filter((tag) => !parseVocalPlacementStructureTag(tag) && !isCustomStopTransitionTag(tag));

  if (requestedInstrumental) {
    const musicalCues = cleanInstrumentalCueParts(rawNormalTags);
    return ['Instrumental only, no vocals', ...musicalCues].filter(Boolean).slice(0, 4);
  }

  void stopRequested;
  const groupRequested = rawNormalTags.some((tag) => /^(?:Group|All Vocals|Together|전체보컬)$/i.test(String(tag || '').trim()));
  const cleanNormalTags = rawNormalTags
    .filter((tag) => !/^(?:Group|All Vocals|Together|전체보컬)$/i.test(String(tag || '').trim()))
    .filter((tag) => !(vocalTags.length > 0 && isRedundantVocalStructureCue(tag)))
    .map(compactStructureCue)
    .filter(Boolean)
    .filter((tag, index, arr) => arr.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) === index)
    .slice(0, vocalTags.length > 0 ? 1 : 3);

  if (!vocalTags.length && groupRequested) {
    return ['All Vocals', ...cleanNormalTags].filter(Boolean);
  }
  if (!vocalTags.length) return cleanNormalTags;

  const hasAll = vocalTags.some((item) => item.type === 'all');
  if (hasAll) {
    return ['All Vocals', ...cleanNormalTags].filter(Boolean);
  }

  const singles = vocalTags.filter((item) => item.type === 'single');
  if (singles.length === 1) {
    const item = singles[0];
    const cue = cleanupPromptTail(compactStructureCue(item.cue)).split(',').map((part) => part.trim()).filter(Boolean).slice(0, 2).join(', ');
    return [`ONLY ${item.label}${cue ? `, ${cue}` : ''}`, ...cleanNormalTags].filter(Boolean).slice(0, 3);
  }

  const labels = singles.map((item) => item.label).filter(Boolean).join(' + ');
  const cues = singles.map((item) => compactStructureCue(item.cue)).filter(Boolean).slice(0, 1).join(', ');
  return [`${labels}${cues ? `, ${cues}` : ''}`, ...cleanNormalTags].filter(Boolean).slice(0, 3);
}

function stripVocalLabelsFromInstrumentalTagParts(sectionName: string, parts: string[]): string[] {
  if (!/^(?:Instrumental|Instrumental Opening|Solo|Drop|Break)$/i.test(String(sectionName || '').trim())) return parts;
  return cleanInstrumentalCueParts(parts);
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


function buildRepresentativeDefaultStructure(params: GenerateSongParams): string {
  const key = getSelectedPrimaryGenreKey(params);
  const text = [
    key,
    params.genre || '',
    ...(params.subGenre ?? []),
    selectedStyleText(params),
  ].join(' ').toLowerCase();
  const hasRap = Boolean(params.vocal?.rap) || /\brap\b|hip[-\s]?hop|trap|rapper|래퍼|랩/.test(text);

  if (/hip[-_\s]?hop|\brap\b|trap|boom[-\s]?bap|drill/.test(text)) {
    return 'Intro → Rap Section → Hook → Rap Section → Break → Pre-Hook → Hook → Stop → Bridge → Final Hook → Outro';
  }

  if (/edm|dance|house|techno|future|dubstep/.test(text)) {
    return 'Intro → Verse → Build-up → Drop → Verse → Pre-Chorus → Chorus → Stop → Bridge → Final Drop → Outro';
  }

  if (/city\s*pop|citypop|nu[-\s]?disco|disco|funk/.test(text)) {
    return hasRap
      ? 'Intro → Verse → Pre-Chorus → Chorus → Break → Rap Section → Chorus → Instrumental → Stop → Bridge → Final Chorus → Outro'
      : 'Intro → Verse → Pre-Chorus → Chorus → Break → Verse → Chorus → Instrumental → Stop → Bridge → Final Chorus → Outro';
  }

  if (/j[-_\s]?pop|utaite|anime|anisong|rock|glitch|alternative/.test(text)) {
    return 'Intro → Verse → Pre-Chorus → Chorus / Drop → Verse → Pre-Chorus → Chorus / Drop → Stop → Bridge → Final Chorus / Drop → Outro';
  }

  if (/ballad|acoustic|folk/.test(text)) {
    return 'Intro → Verse → Pre-Chorus → Chorus → Verse → Chorus → Stop → Bridge → Final Chorus → Outro';
  }

  if (/lo[-_\s]?fi|chill/.test(text)) {
    return 'Intro → Verse → Hook → Verse → Break → Hook → Stop → Bridge → Final Hook → Outro';
  }

  return 'Intro → Verse → Pre-Chorus → Chorus → Verse → Pre-Chorus → Chorus → Stop → Bridge → Final Chorus → Outro';
}

function buildStructureText(
  songStructure: SongStructure | undefined,
  resolvedStructure: SongStructure,
  customStructure: CustomSectionItem[] = [],
  params?: GenerateSongParams,
): string {
  if (songStructure === "custom" && customStructure.length > 0) {
    return customStructure
      .map(
        (section) => {
          const sectionName = normalizeLyricSectionNameForGeneration(section.section);
          const tags = formatCustomStructureTagForPrompt(sectionName, section.tags || []);
          return `${sectionName}${tags.length > 0 ? ` (${tags.join(", ")})` : ""}`;
        },
      )
      .join(" → ");
  }

  const structureMap: Record<Exclude<SongStructure, "custom">, string> = {
    "1": params ? buildRepresentativeDefaultStructure(params) : "Intro → Verse → Pre-Chorus → Chorus → Verse → Pre-Chorus → Chorus → Stop → Bridge → Final Chorus → Outro",
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


function sectionPartBaseName(part: string): string {
  return String(part || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*:\s*.*$/g, '')
    .trim()
    .toLowerCase();
}

function addMoodShiftToSectionPart(part: string, transitionCue: string): string {
  const cue = cleanupPromptTail(transitionCue || 'controlled emotional turn');
  if (!part || /mood\s*shift/i.test(part)) return part;

  const match = String(part).match(/^(.*?)(?:\s*\((.*?)\))?$/);
  const name = cleanupPromptTail(match?.[1] || part);
  const rawTags = (match?.[2] || '')
    .split(',')
    .map((item) => cleanupPromptTail(item))
    .filter(Boolean);

  const tags: string[] = [];
  const add = (value: string) => {
    const clean = cleanupPromptTail(value);
    if (clean && !tags.some((existing) => existing.toLowerCase() === clean.toLowerCase())) tags.push(clean);
  };

  // Keep at most one vocal owner plus one musical/emotional cue.
  rawTags.filter((tag) => /^(ONLY\s+|All Vocals|Female Group|Male Group|Male Lead|Female Lead|[A-Za-z].*Vocal|.*Rap)/i.test(tag)).slice(0, 1).forEach(add);
  add(cue.replace(/\bmood\s*shift\b/gi, '').trim() || 'emotional turn');
  rawTags.filter((tag) => !/^(ONLY\s+|All Vocals|Female Group|Male Group|Male Lead|Female Lead|[A-Za-z].*Vocal|.*Rap)/i.test(tag) && !/mood\s*shift/i.test(tag)).slice(0, tags.length ? 0 : 1).forEach(add);

  return `${name} (${tags.slice(0, 2).join(', ')})`;
}

function applyMoodShiftToStructureText(structureText: string, transitionCue: string): string {
  if (!transitionCue || !structureText.trim()) return structureText;
  const parts = structureText
    .split('→')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return structureText;

  const isStop = (part: string) => /^stop$/i.test(sectionPartBaseName(part));
  const isBridge = (part: string) => /^bridge\b/i.test(sectionPartBaseName(part));
  const isFinal = (part: string) => /^(final\s+chorus|final\s+hook)\b/i.test(sectionPartBaseName(part));
  const hasMoodShift = parts.findIndex((part) => /mood\s*shift/i.test(part));
  if (hasMoodShift >= 0) return parts.join(' → ');

  const bridgeIndexes = parts.map((part, idx) => (isBridge(part) ? idx : -1)).filter((idx) => idx >= 0);
  let targetIndex = -1;
  if (bridgeIndexes.length) {
    const finalIndex = parts.findIndex(isFinal);
    if (finalIndex >= 0) {
      const beforeFinal = bridgeIndexes.filter((idx) => idx < finalIndex);
      if (beforeFinal.length) targetIndex = beforeFinal[beforeFinal.length - 1];
    }
    if (targetIndex < 0) {
      const halfway = Math.floor(parts.length * 0.45);
      const later = bridgeIndexes.filter((idx) => idx >= halfway);
      targetIndex = (later.length ? later[later.length - 1] : bridgeIndexes[bridgeIndexes.length - 1]);
    }
  }

  const next = [...parts];
  if (targetIndex >= 0) {
    if (targetIndex === 0 || !isStop(next[targetIndex - 1])) {
      next.splice(targetIndex, 0, 'Stop');
      targetIndex += 1;
    }
    next[targetIndex] = addMoodShiftToSectionPart(next[targetIndex], transitionCue);
    return next.join(' → ');
  }

  const insertBefore = (() => {
    const finalIndex = next.findIndex(isFinal);
    if (finalIndex >= 0) return finalIndex;
    for (let i = next.length - 1; i >= 0; i -= 1) {
      if (/^(chorus|hook)\b/i.test(sectionPartBaseName(next[i]))) return i;
    }
    const outroIndex = next.findIndex((part) => /^outro\b/i.test(sectionPartBaseName(part)));
    return outroIndex >= 0 ? outroIndex : next.length;
  })();

  const insert: string[] = [];
  if (insertBefore === 0 || !isStop(next[insertBefore - 1])) insert.push('Stop');
  insert.push(addMoodShiftToSectionPart('Bridge', transitionCue));
  next.splice(insertBefore, 0, ...insert);
  return next.join(' → ');
}

function buildStyle(params: GenerateSongParams): string {
  const subGenreIds = params.subGenre ?? [];
  const genreId = (getPrimarySelectedGenreId(params) || "pop").toLowerCase();

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
  const genreId = (getPrimarySelectedGenreId(params) || "pop").toLowerCase();
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
    const firstSubId = subGenreIds[0];
    genreSoundSource = SUB_GENRE_PROMPTS[firstSubId]?.sound || MID_GENRE_PROMPTS[firstSubId]?.sound || "";
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
  const genreId = (getPrimarySelectedGenreId(params) || "").toLowerCase();
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
    const firstSubId = subGenreIds[0];
    genreVocalSource = SUB_GENRE_PROMPTS[firstSubId]?.vocal || MID_GENRE_PROMPTS[firstSubId]?.vocal || "";
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
  const genreId = getPrimarySelectedGenreId(params) || params.genre;
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
- Treat genre, style, mood, sound, instrument, vocal, tempo, hook, transition, and arrangement words as production instructions only, unless the user explicitly states they are the story topic.
- LYRIC CONTENT SOURCE LOCK: the actual lyric event, objects, relationship, setting, and conflict must come from the direct theme input, selected Theme, active Situation, lyric draft, or user director note.
- MOOD INTERPRETATION LOCK: mood choices are not lyric content sources. They must not invent new objects, events, relationships, settings, conflicts, titles, hooks, or repeated lyric phrases. They may reinterpret the already-existing Theme/Situation/direct-input content through emotional temperature, metaphor style, phrasing, pacing, vocal attitude, and scene texture.
- If a direct theme/topic sentence exists, it outranks automatic context. Do not import any prewritten story template unless the direct input actually contains that story.
- Do NOT turn these into literal title or lyric content: offbeat, syncopated, half-beat, slow tempo, fast tempo, BPM, hook, addictive chorus, vocal tone, female vocal, male vocal, unique voice, high-note restraint, avoid belting, guitar, synth, bass, beat, drop, glitch, neon pulse, melody line, sound layer, R&B groove, anime rock, synthwave, indie-pop production, genre labels.
- Korean equivalents are also production instructions only: 엇박자, 느린템포, 빠른템포, 고음자제, 고음방지, 중독성있는 후렴, 후렴구, 여자보컬, 남자보컬, 여자보이스, 남자보이스, 독특한 목소리, 보컬톤, 기타, 신스, 베이스, 비트, 드롭, 글리치, 네온, 멜로디라인, 사운드레이어, 장르명.
- These terms should shape performance, phrasing, arrangement, and production, but must NOT become repeated lyric phrases, metaphors, title concepts, or the central story.
- MOOD ROLE LOCK: selected mood labels are NOT story sources. They must not create lyric objects, events, relationships, places, conflicts, titles, hooks, or repeated lyric phrases.
- Moods are indirect lyric-expression modifiers and production color. They may color how the existing Theme/Situation/direct-input content feels: emotional temperature, vocal pressure, phrasing, pacing, density, brightness/darkness, metaphor style, scene texture, and how strongly the existing story is performed.
- If a mood suggests a behavior such as hesitation, panic, comedy, loneliness, magic, darkness, or cuteness, apply it as the way the existing Theme story is expressed. Do not invent a new scene, character, object, relationship, place, conflict, title, or hook from the mood itself.
- The lyric's concrete content must come from Theme, direct input, Situation, lyric draft, or user director note. If those are weak, infer a fresh concrete scene from the Theme first, then let mood reinterpret that scene's tone and phrasing without changing the story source.
- Do not import genre/style/sound imagery into lyrics just because it was selected. For Synthwave/Anime Rock, do not automatically write neon, glitch, synth, anime, melody line, or guitar. If the Theme is 설렘, infer a fresh concrete moment from the selected theme instead of using a prewritten example scene.
- If the theme says “everyday freedom,” write about ordinary freedom or self-expression through concrete scenes, not about vocal rhythm or tempo.
`;

function buildTheme(params: GenerateSongParams): string {
  const themes = params.themes ?? [];
  if (themes.length === 0) {
    if (hasUserPrimaryStoryText(params)) {
      return `THEME: Infer only from the user's direct lyric draft or director note. Do not invent a random theme, relationship arc, confession arc, or everyday conflict.`;
    }
    return `THEME: ${DEFAULT_NO_THEME_DIRECTION}`;
  }
  const themeSentence = buildThemeSentence(themes);
  if (hasUserPrimaryStoryText(params)) {
    return `THEME: ${themeSentence}. Reinterpret these selected themes inside the user's direct text instead of replacing it.`;
  }
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
    .replace(/\bwhere\s+(?:words|feelings|memories|promises|silence)\s+that\s+never\s*$/i, "where unresolved feelings stay present")
    .replace(/\bwhere\s+[^,]{1,48}\s+(?:that|who|which|when|while|with|in|and|or|to|of|for|from|through|around)\s*$/i, "")
    .replace(/\bwhere\s+the\s+story\s+moves\s+through\s*$/i, "where the story turns through a concrete detail")
    .replace(/\bwhere\s+the\s+story\s*$/i, "where the story turns through a concrete detail")
    .replace(/\bwhere\s+a\s+recurring\s*$/i, "with a recurring hook motif")
    .replace(/\bwhere\s+an?\s*$/i, "")
    .replace(/\bwhere\s*$/i, "")
    .replace(/\bwhile\s+the\s+other\s*$/i, "while the other voice pulls away")
    .replace(/\bkeeps\s+chasing\s+while\s+the\s+other\s*$/i, "keeps chasing while the other voice pulls away")
    .replace(/\bas\s+one\s+voice\s+keeps\s+chasing\s+while\s+the\s+other\s*$/i, "as one voice keeps chasing while the other voice pulls away")
    .replace(/\binstead\s+of\s*$/i, "instead of balanced exchange")
    .replace(/\bwith\s+uneven\s+vocal\s+ownership\s+instead\s+of\s*$/i, "with uneven vocal ownership instead of balanced exchange")
    .replace(/\bbuilt\s+around\s*$/i, "")
    .replace(/\bset\s+around\s*$/i, "")
    .replace(/\bwith\s+a\s*$/i, "")
    .replace(/\band\s+a\s*$/i, "")
    .replace(
      /(?:,|\s)+(?:with|and|feat\.?|featuring|plus|or|vs|&|그리고|및)$/i,
      "",
    )
    .replace(/\b2020s\s+hyper[-\s]?digital$/i, "2020s hyper-digital polish")
    .replace(/\bhyper[-\s]?digital$/i, "hyper-digital polish")
    .replace(/\btimeless$/i, "timeless polish")
    .replace(/\bconf$/i, "confidence")
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
    [/저승길|저승/g, "afterlife"],
    [/데리러\s*온|데리러|데려가|데려가는/g, "escort"],
    [/미련/g, "lingering regret"],
    [/살아\s*있을\s*때|살아있을\s*때/g, "when alive"],
    [/하고\s*싶은\s*것|못\s*해서|못해서/g, "unfinished wishes"],
    [/반말/g, "casual blunt speech"],
    [/존댓말/g, "polite speech"],
    [/사회\s*풍자형|사회풍자형|사회\s*풍자/g, "social satire"],
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
    (situation as any).speakerAExtra ||
    (situation as any).speakerBExtra ||
    [
      'characterAPoliteness',
      'characterAIntensity',
      'characterADelivery',
      'characterBPoliteness',
      'characterBIntensity',
      'characterBDelivery',
      'storyDialogueBalance',
      'storyRealityScale',
      'storyPlayfulSincere',
    ].some((field) => {
      const raw = (situation as any)[field];
      return raw !== undefined && raw !== null && raw !== '' && Number(raw) !== 50;
    }) ||
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



const STORYBOARD_SLIDER_DEFAULT_VALUE = 50;
const STORYBOARD_SLIDER_STOP_VALUES = [0, 17, 33, 50, 67, 83, 100] as const;

function snapStoryboardAxisValue(value: number): number {
  return STORYBOARD_SLIDER_STOP_VALUES.reduce((closest, stop) => (
    Math.abs(stop - value) < Math.abs(closest - value) ? stop : closest
  ), STORYBOARD_SLIDER_DEFAULT_VALUE);
}

function describeStoryboardAxis(value: unknown, left: string, right: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const snapped = snapStoryboardAxisValue(n);
  const stage = STORYBOARD_SLIDER_STOP_VALUES.findIndex((stop) => stop === snapped);
  if (stage === 0) return `${left} strongly dominant`;
  if (stage === 1) return `${left} dominant`;
  if (stage === 2) return `slightly ${left}`;
  if (stage === 4) return `slightly ${right}`;
  if (stage === 5) return `${right} dominant`;
  if (stage === 6) return `${right} strongly dominant`;
  return "";
}

function buildStoryboardPositionCue(situation?: SituationConfig, roleIndex: 0 | 1 = 0): string {
  const raw = situation as any;
  if (!raw) return "";
  const prefix = roleIndex === 0 ? "characterA" : "characterB";
  const cues = [
    describeStoryboardAxis(raw[`${prefix}Politeness`], "honorific/polite speech", "casual/blunt speech"),
    describeStoryboardAxis(raw[`${prefix}Intensity`], "calm restrained emotion", "explosive emotion"),
    describeStoryboardAxis(raw[`${prefix}Delivery`], "direct straight talk", "indirect ironic wordplay"),
    String(raw[roleIndex === 0 ? "speakerAExtra" : "speakerBExtra"] || "").trim(),
  ].filter(Boolean);
  return cues.join(" / ");
}

function buildStoryboardLineCue(situation?: SituationConfig): string {
  const raw = situation as any;
  if (!raw) return "";
  return [
    describeStoryboardAxis(raw.storyDialogueBalance, "rapid back-and-forth dialogue", "solo-driven monologue"),
    describeStoryboardAxis(raw.storyRealityScale, "realistic everyday scale", "dramatic heightened scale"),
    describeStoryboardAxis(raw.storyPlayfulSincere, "witty playful mode", "sincere emotional mode"),
  ].filter(Boolean).join(" / ");
}

function buildSituationRenderingContext(situation?: SituationConfig): string {
  if (!hasSituation(situation)) return "";

  const speakerA = situation?.speakers?.[0];
  const speakerB = situation?.speakers?.[1];
  const targetA = String(situation?.targetA || speakerA?.role || "").trim();
  const targetB = String(situation?.targetB || speakerB?.role || "").trim();
  const relation = String(situation?.relationship || "").trim();
  const version = String(situation?.versionLabel || situation?.version || "").trim();
  const development = String(
    situation?.developmentCustom ||
      situation?.developmentPreset ||
      situation?.development ||
      "",
  ).trim();
  const description = String(situation?.description || situation?.summary || "").trim();
  const details = [
    ...(situation?.detailPresets || []),
    situation?.detailCustom || situation?.details || "",
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");

  const speakerALine = [
    targetA ? `role=${targetA}` : "",
    situation?.speakerAStyle || speakerA?.speechStyle || "",
    situation?.speakerAAttitude || situation?.attitudeA || speakerA?.attitude || "",
    buildStoryboardPositionCue(situation, 0),
    speakerA?.characterTone || "",
    speakerA?.vocalDirection || "",
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" / ");

  const speakerBLine = [
    targetB ? `role=${targetB}` : "",
    situation?.speakerBStyle || speakerB?.speechStyle || "",
    situation?.speakerBAttitude || situation?.attitudeB || speakerB?.attitude || "",
    buildStoryboardPositionCue(situation, 1),
    speakerB?.characterTone || "",
    speakerB?.vocalDirection || "",
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" / ");

  const englishCharacters = [targetA, targetB]
    .filter(Boolean)
    .map((role, index) => englishRoleLabel(role, `Character ${index + 1}`))
    .join(" vs ");
  const englishDescription = stripRemainingKoreanForProductionPrompt(description);
  const englishDevelopment = stripRemainingKoreanForProductionPrompt(development);
  const englishVersion = stripRemainingKoreanForProductionPrompt(version);
  const englishDetails = stripRemainingKoreanForProductionPrompt(details);
  const englishSpeechContrast = [speakerALine, speakerBLine]
    .map((line) => stripRemainingKoreanForProductionPrompt(line))
    .filter(Boolean)
    .join(" / ");
  const storyboardLineCue = buildStoryboardLineCue(situation);
  const englishStoryboardLineCue = stripRemainingKoreanForProductionPrompt(storyboardLineCue);

  const lines = [
    [targetA, targetB].filter(Boolean).length ? `Characters: ${[targetA, targetB].filter(Boolean).join(" vs ")}` : "",
    englishCharacters ? `English character anchors: ${englishCharacters}` : "",
    relation ? `Relationship: ${relation}` : "",
    description ? `Situation description: ${description}` : "",
    englishDescription ? `English scene/conflict cue: ${englishDescription}` : "",
    development ? `Development / dialogue flow: ${development}` : "",
    englishDevelopment ? `English arrangement cue: ${englishDevelopment}` : "",
    version ? `Version tone: ${version}` : "",
    englishVersion ? `English tone cue: ${englishVersion}` : "",
    speakerALine ? `Speaker A direction: ${speakerALine}` : "",
    speakerBLine ? `Speaker B direction: ${speakerBLine}` : "",
    englishSpeechContrast ? `English speech-contrast cue: ${englishSpeechContrast}` : "",
    storyboardLineCue ? `Story line slider cue: ${storyboardLineCue}` : "",
    englishStoryboardLineCue ? `English story-line cue: ${englishStoryboardLineCue}` : "",
    details ? `Extra detail: ${details}` : "",
    englishDetails ? `English detail cue: ${englishDetails}` : "",
  ].filter(Boolean);

  return lines.join("\n");
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
  const members = Array.isArray((v as any).members) ? (v as any).members : [];
  const memberMale = members.filter((member: any) => member?.gender === "male").length;
  const memberFemale = members.filter((member: any) => member?.gender === "female").length;
  const rawMale = v.male ?? 0;
  const rawFemale = v.female ?? 0;
  // Use explicit member data as a safety source. In solo mode the visible UI can have
  // exactly one member while older count fields are temporarily stale; that must never
  // be interpreted as a group vocal by the final prompt validator.
  const male = members.length ? memberMale : rawMale;
  const female = members.length ? memberFemale : rawFemale;
  const total = members.length || (male + female);
  const formation = getVocalFormation({ ...(v as any), male, female } as VocalConfig);
  const explicitMode = (v as any).mode;
  const mode =
    explicitMode ||
    (total === 1
      ? "solo"
      : total === 2
        ? "duo"
        : total > 2
          ? "group"
          : undefined);
  const isSolo = mode === "solo" || total === 1 || (members.length === 1 && explicitMode !== "group");
  const isMulti = !isSolo && (mode === "duo" || mode === "group" || total >= 2);
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


function hasAnyVocalCharacterMember(params: GenerateSongParams): boolean {
  return Boolean((params.vocal?.members ?? []).some((member: any) => hasVocalCharacterSelection(member)));
}

function compactRoleNameForVocalLine(role: string, fallback: string): string {
  const normalized = rawVocalRoleBase(role || fallback);
  if (/rap/i.test(normalized)) return 'rap';
  if (/main/i.test(normalized)) return 'lead';
  if (/lead/i.test(normalized)) return 'lead';
  if (/sub/i.test(normalized)) return 'sub';
  return 'vocal';
}

function compactMultiVocalCueBits(value: string, max = 3): string[] {
  const raw = String(value || '').toLowerCase();
  const tags: string[] = [];
  const add = (tag: string) => {
    if (tags.length < max && tag && !tags.includes(tag)) tags.push(tag);
  };

  if (/reluctant authority|tired authority|command|authoritative|권위/.test(raw)) add('reluctant authority');
  if (/pleading regret|fragile restraint|애원|후회/.test(raw)) add('pleading regret');
  if (/teen|youth|10대|어린/.test(raw)) add('teen-like color');
  if (/young[-\s]?adult|young|젊/.test(raw)) add('young adult color');
  if (/thin.*high|very high|high vocal range|높은|고음/.test(raw)) add('thin high range');
  if (/high[-\s]?mid|mid[-\s]?high|높은\s*보통|높은\s*중/.test(raw)) add('high-mid range');
  if (/bright|lively|clear|밝|청아/.test(raw)) add('bright tone');
  if (/lazy|relaxed|laid[-\s]?back|나른|릴렉스/.test(raw)) add('relaxed tone');
  if (/airy.*falsetto|falsetto|head[-\s]?voice|가성|두성/.test(raw)) add('airy falsetto');
  if (/nasal|비성/.test(raw)) add('nasal focus');
  if (/breath|inhaled|half[-\s]?air|airy|숨|호흡/.test(raw)) add('fragile breath');
  if (/microtonal|slid|slide|bending|bend|glissando|slurring|꺾|벤딩/.test(raw)) add('melodic bends');
  if (/urgent|early|anticipat|성급|빠른 진입/.test(raw)) add('urgent entries');
  if (/sincere|진심/.test(raw)) add('sincere tone');
  if (/cute|귀여/.test(raw)) add('cute color');
  if (/chest|흉성|진성/.test(raw)) add('chest voice');
  if (/sharp|edge|날카/.test(raw)) add('sharp edge');
  if (/dry|plain|담백|건조/.test(raw)) add('dry tone');
  if (/warm|soft|smooth|부드|따뜻/.test(raw)) add('soft warmth');
  if (/husky|rough|gritty|허스키|거친/.test(raw)) add('husky grain');
  if (/rap|talk|spoken|말하듯|래/.test(raw)) add('talk-rap flow');
  if (/restrain|controlled|calm|절제|차분/.test(raw)) add('restrained control');
  if (/power|belt|strong|폭발|강한/.test(raw)) add('strong lift');

  if (!tags.length) {
    const compact = compactVocalToneForPrompt(value)
      .replace(/\b(?:male|female|vocal|voice|tone|delivery|emotion)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    compact.split(/\s+/).filter(Boolean).slice(0, max).forEach(add);
  }
  return tags.slice(0, max);
}

function compactMemberVocalCue(
  params: GenerateSongParams,
  member: any,
  index: number,
  total: number,
  maxBits = 3,
): string {
  const rawRole = member?.roles?.[0] || getDefaultMultiVocalRole(index, total, Boolean(params.vocal?.rap));
  const gender = member?.gender || getMemberGenderLabel(params, index);
  const roleName = compactRoleNameForVocalLine(rawRole, index === 0 ? 'main' : 'lead');
  const characterPrompt = member && hasVocalCharacterSelection(member)
    ? buildVocalCharacterPrompt(member, params, false)
    : '';
  const toneSource = characterPrompt || (member?.toneId ? describeVocalToneForSplit(member.toneId, rawRole, gender) : makeVocalSplitTone('', rawRole, gender));
  const cueBits = compactMultiVocalCueBits(toneSource, maxBits);
  const head = [gender === 'female' ? 'female' : gender === 'male' ? 'male' : '', roleName].filter(Boolean).join(' ');
  return cleanupPromptTail(`${head}${cueBits.length ? ` with ${cueBits.join(', ')}` : ''}`);
}

function getMultiVocalTotal(params: GenerateSongParams): number {
  const info = getVocalModeInfo(params.vocal);
  const existingMembers = params.vocal?.members ?? [];
  if (info.mode === 'duo' && info.total === 0 && existingMembers.length === 0) return 2;
  if (info.mode === 'group' && info.total === 0 && existingMembers.length === 0) return 4;
  return Math.max(info.total || 0, existingMembers.length);
}

function compactSupportingMemberRoleCue(
  params: GenerateSongParams,
  member: any,
  index: number,
  total: number,
): string {
  const rawRole = member?.roles?.[0] || getDefaultMultiVocalRole(index, total, Boolean(params.vocal?.rap));
  const gender = member?.gender || getMemberGenderLabel(params, index);
  const roleName = compactRoleNameForVocalLine(rawRole, index === 0 ? 'main' : 'sub');
  const genderText = gender === 'female' ? 'female' : gender === 'male' ? 'male' : '';
  if (/rap/i.test(roleName)) return [genderText, 'rap adds rhythmic contrast'].filter(Boolean).join(' ');
  if (/lead|main/i.test(roleName)) return [genderText, 'lead supports the main melody'].filter(Boolean).join(' ');
  if (/sub/i.test(roleName)) return [genderText, 'sub supports harmony and response'].filter(Boolean).join(' ');
  return [genderText, `${roleName} supports the ensemble`].filter(Boolean).join(' ');
}

function buildSupportingMemberCue(
  params: GenerateSongParams,
  members: any[],
  total: number,
  startIndex = 0,
): string {
  const support = members
    .map((member, offset) => compactSupportingMemberRoleCue(params, member, startIndex + offset, total))
    .filter(Boolean);
  if (!support.length) return '';

  const counts = new Map<string, number>();
  support.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  const grouped = Array.from(counts.entries()).map(([item, count]) => {
    if (count <= 1) return item;
    if (/female sub supports harmony and response/i.test(item)) return `${count} female sub vocals support harmony and response`;
    if (/male sub supports harmony and response/i.test(item)) return `${count} male sub vocals support harmony and response`;
    return `${count} ${item}`;
  });
  return grouped.slice(0, 3).join('; ');
}

function compactVocalExpressionForMultiPrompt(cue: VocalExpressionCue): string {
  const text = `${cue.short} ${cue.tag} ${cue.label}`.toLowerCase();
  if (/emotional rise|rising emotion|감정 고조/.test(text)) return 'emotional rise';
  if (/whisper|속삭/.test(text)) return 'whispered feel';
  if (/held|restrained|눌러|참/.test(text)) return 'held-back restraint';
  if (/cold|차가/.test(text)) return 'cold distance';
  if (/delicate|섬세/.test(text)) return 'delicate expression';
  if (/tear|울먹|fragile/.test(text)) return 'tearful fragility';
  if (/pleading|애원/.test(text)) return 'pleading pull';
  if (/lazy|relaxed|나른/.test(text)) return 'relaxed phrasing';
  if (/rough|gritty|거친/.test(text)) return 'rough pressure';
  if (/dreamy|몽롱/.test(text)) return 'dreamy softness';
  if (/spoken|conversational|말하/.test(text)) return 'spoken phrasing';
  if (/sarcastic|비꼬/.test(text)) return 'sarcastic edge';
  if (/nasal|비성/.test(text)) return 'nasal color';
  if (/breath|숨/.test(text)) return 'breath-led tension';
  return cleanupPromptTail(cue.tag || firstPromptWord(cue.short) || cue.label).replace(/\.$/, '');
}

function buildMultiVocalExpressionLine(params: GenerateSongParams): string {
  const cues = getSelectedVocalExpressionCues(params)
    .map(compactVocalExpressionForMultiPrompt)
    .filter(Boolean);
  const unique = Array.from(new Set(cues)).slice(0, 4);
  if (!unique.length) return '';
  return `Vocal line adds ${unique.join(', ')}`;
}

function buildRichGroupMemberVocalSplit(params: GenerateSongParams): string {
  const existingMembers = params.vocal?.members ?? [];
  const total = getMultiVocalTotal(params);
  if (total < 3) return '';

  const characterSegments: string[] = [];
  const supportingMembers: any[] = [];
  existingMembers.forEach((member: any, index: number) => {
    if (hasVocalCharacterSelection(member) && characterSegments.length < 3) {
      characterSegments.push(compactMemberVocalCue(params, member, index, total, 6));
    } else {
      supportingMembers.push(member);
    }
  });

  const supportCue = buildSupportingMemberCue(
    params,
    supportingMembers,
    total,
    existingMembers.findIndex((member: any) => supportingMembers.includes(member)) >= 0
      ? existingMembers.findIndex((member: any) => supportingMembers.includes(member))
      : characterSegments.length,
  );
  const hasRap = Boolean(params.vocal?.rap) || existingMembers.some((member: any) => /rap/i.test(String(member?.roles?.join(' ') || '')));
  const styleLine = buildMultiVocalExpressionLine(params);

  const segments = characterSegments.slice(0, 3);
  if (supportCue) segments.push(supportCue);
  if (!segments.length) {
    const lead = existingMembers[0] ? compactMemberVocalCue(params, existingMembers[0], 0, total, 2) : 'lead carries the story';
    const response = existingMembers[1] ? compactMemberVocalCue(params, existingMembers[1], 1, total, 2) : 'sub vocals answer softly';
    segments.push(lead, response, hasRap ? 'rap adds rhythmic contrast' : 'harmony supports the hook');
  } else if (hasRap && !segments.join(' ').toLowerCase().includes('rap')) {
    segments.push('rap adds rhythmic contrast');
  }

  const tail = [
    styleLine,
    'clear main/sub/rap separation and clean hook blend',
  ].filter(Boolean).join('; ');

  return cleanupPromptTail(`${total}-vocal setup: ${segments.join('; ')}; ${tail}.`);
}

function buildCompressedMemberVocalSplit(params: GenerateSongParams): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isMulti) return '';

  const existingMembers = params.vocal?.members ?? [];
  const total = getMultiVocalTotal(params);
  if (total < 2) return '';

  if (total >= 3) {
    const richGroup = buildRichGroupMemberVocalSplit(params);
    if (richGroup) return richGroup;
  }

  const firstMember = existingMembers[0];
  const secondMember = existingMembers[1];
  if (!firstMember && !secondMember) {
    return 'Natural duet vocals; lead and response alternate clearly, with clean hook harmony and emotion matched to the genre.';
  }

  const first = compactMemberVocalCue(params, firstMember, 0, total, firstMember && hasVocalCharacterSelection(firstMember) ? 5 : 2);
  const second = compactMemberVocalCue(params, secondMember, 1, total, secondMember && hasVocalCharacterSelection(secondMember) ? 5 : 2);
  const blend = hasAnyVocalCharacterMember(params)
    ? 'clean role separation, restrained contrast, hook blend'
    : 'clear lead-response phrasing, gentle harmony, hook blend';
  return cleanupPromptTail(`Natural duet: ${first} vs ${second}; ${blend}.`);
}

function compactSituationRoleCue(
  params: GenerateSongParams,
  role: string,
  roleIndex: number,
  memberIndex = roleIndex,
  maxBits = 2,
): string {
  const roleName = compactRoleForPrompt(role);
  const member = params.vocal?.members?.[memberIndex];
  const gender = getMemberGenderLabel(params, memberIndex);
  const characterPrompt = member && hasVocalCharacterSelection(member)
    ? buildVocalCharacterPrompt(member, params, false)
    : '';
  const rawStyleSource = [
    params.situation?.speakers?.[roleIndex]?.speechStyle,
    params.situation?.speakers?.[roleIndex]?.attitude,
    roleIndex === 0 ? params.situation?.speakerAStyle : params.situation?.speakerBStyle,
    roleIndex === 0
      ? params.situation?.speakerAAttitude || params.situation?.attitudeA
      : params.situation?.speakerBAttitude || params.situation?.attitudeB,
  ].filter(Boolean).join(', ');
  const roleDirection = mergeRoleDirection(role, rawStyleSource);
  const fallbackTone = inferSituationVocalTone(role, roleIndex);
  // For storyboard + vocal-character mode, keep BOTH sides alive:
  // 1) the story-role attitude (ex. Grim Reaper reluctant authority)
  // 2) the selected voice-character color (ex. teen-like, thin high, chest voice).
  // The previous rich compression let Gemini re-summarize this line, so the final
  // prompt could lose either the storyboard or the vocal character. Keep this
  // extraction deterministic and only compact the number of cue bits.
  const roleBits = compactMultiVocalCueBits(
    [roleDirection, fallbackTone].filter(Boolean).join(', '),
    characterPrompt ? 2 : maxBits,
  );
  const characterBits = characterPrompt
    ? compactMultiVocalCueBits(characterPrompt, Math.max(4, maxBits))
    : [];
  const cueBits = Array.from(new Set([...roleBits, ...characterBits]))
    .slice(0, characterPrompt ? Math.max(maxBits, 6) : maxBits);
  const genderText = gender === 'female' ? 'female' : gender === 'male' ? 'male' : '';
  const roleText = /rap|래/i.test(`${fallbackTone} ${member?.roles?.join(' ') || ''}`) ? 'rap' : 'vocal';
  const vocalType = [genderText, roleText].filter(Boolean).join(' ');
  return cleanupPromptTail(`${vocalType} as ${roleName}${cueBits.length ? ` with ${cueBits.join(', ')}` : ''}`);
}


function buildCompressedSituationVocalSplit(
  params: GenerateSongParams,
  roleEntries: SituationRoleEntry[],
  ownershipRule: string,
): string {
  const info = getVocalModeInfo(params.vocal);
  const matchedIndexes = getMatchedMemberIndexes(params, roleEntries);
  if (info.total >= 3) {
    const total = getMultiVocalTotal(params);
    const first = compactSituationRoleCue(params, roleEntries[0].role, 0, matchedIndexes[0], 6);
    const second = roleEntries[1]?.role
      ? compactSituationRoleCue(params, roleEntries[1].role, 1, matchedIndexes[1], 6)
      : 'sub vocals answer the story';
    const storyMemberIndexes = new Set(matchedIndexes.filter((index) => index >= 0));
    const supportingMembers = (params.vocal?.members ?? []).filter((_member: any, index: number) => !storyMemberIndexes.has(index));
    const supportCue = buildSupportingMemberCue(params, supportingMembers, total, 2);
    const hasRap = Boolean(params.vocal?.rap) || (params.vocal?.members ?? []).some((member: any) => /rap/i.test(String(member?.roles?.join(' ') || '')));
    const styleLine = buildMultiVocalExpressionLine(params);
    const segments = [first, second, supportCue].filter(Boolean);
    if (hasRap && !segments.join(' ').toLowerCase().includes('rap')) segments.push('rap adds rhythmic contrast');
    const tail = [styleLine, ownershipRule, 'clear story-role separation'].filter(Boolean).join('; ');
    return cleanupPromptTail(`Story ${total}-vocal setup: ${segments.join('; ')}; ${tail}.`);
  }

  const hasCharacter = hasAnyVocalCharacterMember(params);
  const richDuoBits = hasCharacter ? 7 : 3;
  const first = compactSituationRoleCue(params, roleEntries[0].role, 0, matchedIndexes[0], richDuoBits);
  const second = compactSituationRoleCue(params, roleEntries[1].role, 1, matchedIndexes[1], richDuoBits);
  const relation = hasCharacter
    ? 'separated sections, call-and-response tension, single-owner hooks'
    : `separated sections, role-driven dialogue tension, ${ownershipRule}`;
  return cleanupPromptTail(`Story duet: ${first} vs ${second}; ${relation}.`);
}

function buildRuleBasedCompressedMultiVocals(params: GenerateSongParams): string {
  if (!getVocalModeInfo(params.vocal).isMulti) return '';
  if (hasSituation(params.situation)) {
    const targetA = String(params.situation?.targetA || '').trim();
    const targetB = String(params.situation?.targetB || '').trim();
    const speakers = params.situation?.speakers ?? [];
    const targetRoles = [targetA, targetB]
      .filter(Boolean)
      .slice(0, 2)
      .map((role, index) => {
        const speaker = speakers[index];
        return {
          role,
          genderHint: speaker?.gender && speaker.gender !== 'any' ? speaker.gender : inferRoleGenderFromText(role),
        } as SituationRoleEntry;
      });
    const speakerRoles = speakers
      .slice(0, 2)
      .map((speaker, index) => ({
        role: String(speaker.role || (index === 0 ? targetA : targetB) || speaker.id || `Character ${index + 1}`).trim(),
        genderHint: speaker.gender && speaker.gender !== 'any' ? speaker.gender : inferRoleGenderFromText(String(speaker.role || '')),
      } as SituationRoleEntry))
      .filter((entry) => Boolean(entry.role));
    const roleEntries = targetRoles.length ? targetRoles : speakerRoles;
    if (roleEntries.length >= 2) {
      return buildCompressedSituationVocalSplit(params, roleEntries, 'single-owner hooks when selected');
    }
  }
  return buildCompressedMemberVocalSplit(params);
}

function buildMemberVocalSplit(params: GenerateSongParams): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isMulti) return "";
  return buildCompressedMemberVocalSplit(params);
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
  const member = params.vocal?.members?.[memberIndex];
  const characterPrompt = member ? buildVocalCharacterPrompt(member, params, false) : "";
  const mergedDirection = cleanupPromptTail(
    [
      expressionCue
        ? mergeVocalExpressionIntoEmotion(situationDirection, expressionCue)
        : situationDirection,
      characterPrompt ? `voice character: ${characterPrompt}` : "",
    ].filter(Boolean).join(", ")
  );
  const direction = limitText(
    mergedDirection,
    shouldApplyLargeGroupVocalCompression(params) ? 128 : 240,
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
    arrangementLens: "one-sided pursuit with delayed responses",
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
      "where one fresh concrete detail from the user's input becomes emotionally oversized",
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
      "turn one fresh concrete detail inferred from the user's input into the hook engine",
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

function stableVariationHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickCreativeVariationSeed(
  params: GenerateSongParams,
): CreativeVariationSeed {
  const info = getVocalModeInfo(params.vocal);
  const pool =
    hasSituation(params.situation) && info.isMulti
      ? SITUATION_VARIATION_SEEDS
      : SOLO_VARIATION_SEEDS;
  if (!pool.length) return SOLO_VARIATION_SEEDS[0];

  const index = Number(params.generationIndex || 0);
  const count = Number(params.generationCount || 1);
  if (index > 0 && count > 1) {
    const signature = [
      params.genre || '',
      ...(params.subGenre || []),
      ...(params.moods || []),
      ...(params.themes || []),
      params.userInput || '',
      params.customThemeInput || '',
      params.customMoodInput || '',
      hasSituation(params.situation) ? JSON.stringify(params.situation) : '',
    ].join('|');
    const offset = stableVariationHash(signature) % pool.length;
    return pool[(offset + index - 1) % pool.length] || pool[0];
  }

  return pool[Math.floor(Math.random() * pool.length)] || pool[0];
}

function buildRecentStoryMemoryInstruction(params: GenerateSongParams): string {
  const memoryCount = (params.recentStoryMemory || [])
    .map((item) => cleanupPromptTail(String(item || '').replace(/\s+/g, ' ')))
    .filter(Boolean)
    .slice(0, 6)
    .length;

  if (!memoryCount) {
    return `RECENT STORY MEMORY:
- No recent generated song memory was provided. For a single generation, create a fresh angle from the selected keywords without defaulting to the most common cliché.`;
  }

  return `RECENT STORY MEMORY (ABSTRACT ANTI-CLONE ONLY):
- Recent generated songs exist, but their titles, objects, scenes, and lyric phrases are intentionally hidden so they are not copied as examples.
- Use this only as an anti-clone signal: avoid reusing the same central scene type, visible object type, unresolved action type, chorus engine, or ending direction.
- Keep the selected emotional world, but infer a fresh lived-detail angle from the current input before writing title or lyrics.
- For one-by-one generation, treat recent memory as a similarity warning. For multi-song generation, also make this attempt distinct from the other attempts in the same batch.`;
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
    "one-sided-pursuit": "chasing rhythm pulses, delayed response impacts",
    "negotiation-trade": "trade-off beat switches, answer-back drum accents",
    "parallel-monologue": "split-channel textures, parallel rhythm beds",
    "late-reveal": "hidden texture layers, delayed reveal swells",
    "unresolved-comedy": "dry percussion pops, awkward pause hits",
    "chorus-takeover": "chorus takeover impacts, front-loaded hook drums",
    "echo-undercut": "echo stabs, undercut drops, dry response accents",
    "speaker-flaw-focus": "flaw-exposing pauses, uneven drum pressure",
    "detail-hook-focus": "detail-led motif hits, sparse hook punctuation",
    "role-reversal-focus": "reversal drops, section-flip impacts",
    "silent-gap-focus": "negative space drops, short silence cuts",
    "chorus-solo-A": "solo-hook spotlight, reduced backing pressure",
    "chorus-solo-B": "unexpected solo-hook lift, redirected drop impact",
    "together-hook-focus": "brief group-hook lift, separated verse textures",
    "genre-led-structure": "genre-shaped groove shifts, part-specific production color",
    "object-perspective-focus": "object-motif pulses, visible-anchor sound details",
    "misread-intent-focus": "misread-response glitches, delayed-response accents",
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
  return normalizeVocalRepeatedTokens(cleaned);
}

function moodToMusicAdjective(moodValue: string): string {
  const item = resolveMoodItem(moodValue);
  const raw = [
    moodValue,
    item?.id,
    item?.label,
    item?.labelKo,
    item?.mood,
    item?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim();

  const map: Array<[RegExp, string]> = [
    [/sharp|anxious|high[-\s]?tension|긴장/, "tense"],
    [/rich|immersive|raw depth|heartfelt|감성/, "emotional"],
    [/complex|mixed color|bittersweet|달콤|쌉쌀|씁쓸/, "bittersweet"],
    [/vintage|retro|analog|faded|misty|빈티지|레트로/, "vintage"],
    [/wistful|아련|lonely|외로|고독|quiet empty/, "wistful"],
    [/sad|슬픈|melancholic|우울/, "melancholic"],
    [/sorrow|grieving|비통/, "sorrowful"],
    [/warm|따뜻|cozy|아늑|몽글/, "warm"],
    [/calm|차분|peaceful|평화|meditative|명상/, "calm"],
    [/relax|chill|laid[-\s]?back|릴렉스|칠한/, "relaxed"],
    [/bright|luminous|밝은/, "bright"],
    [/dark|shadow|어두/, "dark"],
    [/hope|희망/, "hopeful"],
    [/comic|comedic|웃픈|코믹|funny/, "comic"],
    [/playful|mischievous|장난|능청|cheeky/, "playful"],
    [/cute|adorable|귀여|깜찍|perky/, "cute"],
    [/fantasy|magical|storybook|마법|판타지|동화/, "magical"],
    [/mysterious|신비|ethereal|에테리얼|dreamlike|dreamy|드리미|몽환/, "dreamy"],
    [/ambient|spacious|공간|앰비언트|airy|에어리/, "spacious"],
    [/groovy|그루비/, "groovy"],
    [/funky|펑키/, "funky"],
    [/upbeat|업비트|cheerful|쾌활/, "upbeat"],
    [/powerful|파워풀|bold/, "powerful"],
    [/catchy|캐치|hooky/, "catchy"],
    [/minimal|미니멀/, "minimal"],
    [/moody|무디/, "moody"],
    [/urban|도시/, "urban"],
    [/cinematic|시네마틱|dramatic/, "cinematic"],
    [/smooth|스무스|mellow|부드/, "smooth"],
  ];

  for (const [pattern, value] of map) {
    if (pattern.test(raw)) return value;
  }

  return cleanPromptValue(item?.label || sentenceCase(moodValue)).toLowerCase();
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

function getMidGenreById(id: string) {
  const normalized = id.toLowerCase();
  for (const group of GENRE_HIERARCHY) {
    const found = group.children.find(
      (mid) =>
        mid.id.toLowerCase() === normalized ||
        mid.id.toLowerCase().replace(/-/g, "_") === normalized.replace(/-/g, "_"),
    );
    if (found) return found;
  }
  return null;
}

function getPrimarySelectedGenreId(params: GenerateSongParams): string {
  return String((params.subGenre ?? []).find(Boolean) || params.genre || "").trim();
}

function getGenrePromptProfile(params: GenerateSongParams): GenrePromptProfile {
  const subId = (params.subGenre ?? []).find(Boolean) || "";
  const genreId = String(params.genre || "").trim();

  if (subId) {
    const subItem = findHierarchySubGenre(subId);
    if (subItem) {
      const subPrompt = lookupPromptRecord(SUB_GENRE_PROMPTS, subId) || {};
      return {
        id: subId,
        label: normalizePromptGenreLabel(subItem.label || sentenceCase(subId)),
        style: cleanPromptValue((subPrompt as any).style || ""),
        sound: cleanPromptValue((subPrompt as any).sound || ""),
        vocal: cleanPromptValue((subPrompt as any).vocal || ""),
      };
    }

    const midItem = getMidGenreById(subId);
    const midPromptFromSubSlot = lookupPromptRecord(MID_GENRE_PROMPTS, subId) || {};
    if (midItem || Object.keys(midPromptFromSubSlot).length > 0) {
      return {
        id: subId,
        label: normalizePromptGenreLabel(midItem?.label || sentenceCase(subId)),
        style: cleanPromptValue((midPromptFromSubSlot as any).style || ""),
        sound: cleanPromptValue((midPromptFromSubSlot as any).sound || ""),
        vocal: cleanPromptValue((midPromptFromSubSlot as any).vocal || ""),
      };
    }
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


type FusionGenreIdentity = {
  id: string;
  label: string;
};

function normalizeGenreIdForProfile(id: string): string {
  return String(id || "").trim().toLowerCase();
}

function getGenreLabelById(id: string): string {
  const normalized = normalizeGenreIdForProfile(id);
  if (!normalized) return "";
  const hierarchySub = findHierarchySubGenre(normalized);
  if (hierarchySub?.label) return normalizePromptGenreLabel(hierarchySub.label);
  const flat = GENRES.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.id.toLowerCase().replace(/[-_]/g, "") === normalized.replace(/[-_]/g, ""),
  );
  if (flat?.label) return normalizePromptGenreLabel(flat.label);
  const genreMeta = getGenreMeta(normalized);
  if (genreMeta?.label) return normalizePromptGenreLabel(genreMeta.label);
  return normalizePromptGenreLabel(sentenceCase(normalized));
}

function getSelectedFusionGenres(params: GenerateSongParams): FusionGenreIdentity[] {
  // If a leaf sub-genre is selected through the hierarchy, that leaf is the real
  // musical choice. The parent MID genre is only kept in App state so the UI can
  // reopen the right folder; it must not be treated as a second musical genre.
  const subIds = (params.subGenre ?? [])
    .map((id) => normalizeGenreIdForProfile(id))
    .filter(Boolean)
    .filter((id) => !isSeparatorLikeId(id));

  const parentIds = [params.genre || ""]
    .map((id) => normalizeGenreIdForProfile(id))
    .filter(Boolean)
    .filter((id) => !isSeparatorLikeId(id));

  const rawIds = subIds.length > 0 ? subIds : parentIds;

  const result: FusionGenreIdentity[] = [];
  rawIds.forEach((id) => {
    const label = getGenreLabelById(id);
    if (!label) return;
    if (result.some((item) => isSameGenreFamily(item.label, label))) return;
    result.push({ id, label });
  });

  if (!result.length) {
    result.push({ id: "pop", label: "Pop" });
  }

  return result.slice(0, 2);
}

function isEraTextureStyleItem(item: ResolvedStyleItem): boolean {
  return STYLE_CYCLE_ID_BY_VARIANT_ID[item.id] === 'era-texture' || /^era-prefix-/i.test(item.id);
}

function compactGenreToken(value: string): string {
  let cleaned = cleanupPromptTail(cleanPromptValue(value))
    .replace(/\bfusion\b/gi, '')
    .replace(/\binfluence\b/gi, '')
    .replace(/\btexture\b/gi, '')
    .replace(/\bas\s+the\s+core\b/gi, '')
    .replace(/\bfused\s+with\b/gi, '')
    .replace(/\bbased\s+on\b/gi, '')
    .replace(/\brooted\s+in\b/gi, '')
    .replace(/\bera\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Genre line is intentionally compact. Keep only broad era cues, not early/mid/late detail.
  cleaned = cleaned
    .replace(/\bearly\s+2000s\b/gi, 'Y2K')
    .replace(/\bmid\s+2000s\b/gi, '2000s')
    .replace(/\blate\s+2000s\b/gi, '2000s')
    .replace(/\bearly\s+(\d{2})s\b/gi, '$1s')
    .replace(/\bmid\s+(\d{2})s\b/gi, '$1s')
    .replace(/\blate\s+(\d{2})s\b/gi, '$1s')
    .replace(/\b(\d{2})s\s+era\b/gi, '$1s')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return sanitizePromptGenreArtifacts(normalizePromptGenreLabel(cleaned));
}

function getSelectedEraTextureItems(params: GenerateSongParams): ResolvedStyleItem[] {
  return filterPromptSelectionIds(params.styles ?? [])
    .map((value) => resolveStyleItem(value))
    .filter((item): item is ResolvedStyleItem => Boolean(item && !isSeparatorLikeItem(item) && isEraTextureStyleItem(item)));
}


type EraTextureLayerProfile = {
  genreAccent: string;
  instrumentCue: string[];
  vocalCue: string;
  arrangementCue: string;
  mediaTexture?: boolean;
};

const EMPTY_ERA_TEXTURE_PROFILE: EraTextureLayerProfile = {
  genreAccent: '',
  instrumentCue: [],
  vocalCue: '',
  arrangementCue: '',
};

function getEraTextureLayerProfile(item?: ResolvedStyleItem): EraTextureLayerProfile {
  if (!item) return EMPTY_ERA_TEXTURE_PROFILE;
  const raw = String((item as any)?.style || item.label || item.id || '').trim();
  const lower = `${item.id} ${item.label || ''} ${item.labelKo || ''} ${raw} ${(item as any)?.sound || ''}`.toLowerCase();

  if (/retro[-_\s]?radio|radio texture|라디오/.test(lower)) return { genreAccent: '', instrumentCue: ['radio filter warmth'], vocalCue: '', arrangementCue: '', mediaTexture: true };
  if (/cassette|tape|카세트|테이프/.test(lower)) return { genreAccent: '', instrumentCue: ['tape hiss and soft wobble'], vocalCue: '', arrangementCue: '', mediaTexture: true };
  if (/vinyl|바이닐|record crackle/.test(lower)) return { genreAccent: '', instrumentCue: ['vinyl crackle warmth'], vocalCue: '', arrangementCue: '', mediaTexture: true };
  if (/digital compression|mp3|compressed digital|디지털\s*압축/.test(lower)) return { genreAccent: '', instrumentCue: ['subtle digital compression texture'], vocalCue: '', arrangementCue: '', mediaTexture: true };

  if (/60s|1960|classic\s*(warmth|pop|soul)|클래식/.test(lower)) return { genreAccent: '60s classic warmth', instrumentCue: ['warm organ', 'vintage guitar', 'live drums'], vocalCue: 'classic melodic phrasing', arrangementCue: 'simple classic verse-chorus flow' };
  if (/70s|1970|analog\s*groove|vintage\s*soul|disco|빈티지\s*소울/.test(lower)) return { genreAccent: '70s analog groove', instrumentCue: ['live bass', 'rhythm guitar', 'warm keys'], vocalCue: 'soulful phrasing', arrangementCue: 'groove-led progression' };
  if (/80s|1980|retro\s*synth|synth\s*color|레트로\s*신스/.test(lower)) return { genreAccent: '80s synth color', instrumentCue: ['analog synth', 'gated drums', 'vintage drum machine'], vocalCue: 'bright polished phrasing', arrangementCue: 'clear chorus lift' };
  if (/new\s*jack|rhythm[-\s]?pop|90s.*bounce|리듬/.test(lower)) return { genreAccent: '90s rhythm-pop bounce', instrumentCue: ['punchy drums', 'syncopated keys', 'slap bass'], vocalCue: 'rhythmic pop phrasing', arrangementCue: 'bouncy section flow' };
  if (/90s|1990|r&b.*감성|rnb.*감성|warm\s*studio|한국\s*발라드/.test(lower)) return { genreAccent: '90s warm studio color', instrumentCue: ['warm keys', 'smooth drums', 'soft pads'], vocalCue: 'warm harmony phrasing', arrangementCue: 'smooth pre-chorus lift' };
  if (/cyworld|싸이월드|korean\s*sentiment|미니홈피/.test(lower)) return { genreAccent: '2000s Korean sentimental color', instrumentCue: ['soft piano', 'warm strings', 'clean drums'], vocalCue: 'earnest emotional phrasing', arrangementCue: 'gradual emotional lift' };
  if (/2000s|y2k|glossy\s*pop|digital\s*pop/.test(lower)) return { genreAccent: '2000s glossy pop polish', instrumentCue: ['glossy synths', 'digital keys', 'tight pop drums'], vocalCue: 'bright youthful phrasing', arrangementCue: 'tight hook-centered structure' };
  if (/2010s.*edm|edm.*pop|festival\s*build|페스티벌|드롭/.test(lower)) return { genreAccent: '2010s festival build color', instrumentCue: ['sidechain synths', 'EDM risers', 'festival drums'], vocalCue: 'bright lift-ready delivery', arrangementCue: 'clean build-up lift, drop-colored hook' };
  if (/2010s.*idol|idol.*pop|아이돌|polished\s*pop\s*energy/.test(lower)) return { genreAccent: '2010s polished pop energy', instrumentCue: ['polished synths', 'punchy drums'], vocalCue: 'clean pop clarity', arrangementCue: 'sharp section contrast, polished chorus lift' };
  if (/2020s.*minimal|minimal\s*clean|미니멀/.test(lower)) return { genreAccent: '2020s minimal clean pop color', instrumentCue: ['minimal beat', 'soft synth', 'clean bass'], vocalCue: 'restrained clean phrasing', arrangementCue: 'sparse groove, controlled hook' };
  if (/2020s|hyper[-\s]?digital|hyperpop|하이퍼팝|glitch/.test(lower)) return { genreAccent: '2020s hyper-digital texture', instrumentCue: ['glitch synths', 'bright digital hits', 'processed drums'], vocalCue: 'sharp processed pop edge', arrangementCue: 'sudden switch-ups, compressed hook impact' };

  const fallback = compactGenreToken(raw);
  return fallback ? { genreAccent: fallback, instrumentCue: [], vocalCue: '', arrangementCue: '' } : EMPTY_ERA_TEXTURE_PROFILE;
}

function getSelectedEraTextureLayerProfiles(params: GenerateSongParams): EraTextureLayerProfile[] {
  const profiles = getSelectedEraTextureItems(params)
    .map(getEraTextureLayerProfile)
    .filter((profile) => Boolean(profile.genreAccent || profile.instrumentCue.length || profile.vocalCue || profile.arrangementCue));
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    const key = [profile.genreAccent, profile.instrumentCue.join('|'), profile.vocalCue, profile.arrangementCue, profile.mediaTexture ? 'media' : 'era'].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

function getEraTextureGenreAccents(params: GenerateSongParams): string[] {
  return getSelectedEraTextureLayerProfiles(params).filter((profile) => !profile.mediaTexture).map((profile) => profile.genreAccent).filter(NON_EMPTY).slice(0, 1);
}
function getEraTextureInstrumentCues(params: GenerateSongParams): string[] {
  return getSelectedEraTextureLayerProfiles(params).flatMap((profile) => profile.instrumentCue).map(cleanPromptValue).filter(NON_EMPTY).slice(0, 3);
}

function getSelectedStyleSoundTextureCues(params: GenerateSongParams): string[] {
  // Style can carry real sound/space texture cues (ex: room reverb, wide reverb, rain ambience).
  // These must be visible to the Gemini instrument assembly even when they are not selected
  // from the dedicated Sound menu. Vocal-only style effects stay in the vocal layer.
  const seen = new Set<string>();
  return filterPromptSelectionIds(params.styles ?? [])
    .map((value) => resolveStyleItem(value))
    .filter((item): item is ResolvedStyleItem => Boolean(item && !isSeparatorLikeItem(item)))
    .filter((item) => STYLE_ROLE_BY_VARIANT_ID[item.id] !== 'vocals')
    .map((item) => cleanPromptValue(String((item as any).sound || '').trim()))
    .filter(NON_EMPTY)
    .filter((cue) => {
      const key = cue.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}
function getEraTextureVocalCues(params: GenerateSongParams): string[] {
  return getSelectedEraTextureLayerProfiles(params).filter((profile) => !profile.mediaTexture).map((profile) => profile.vocalCue).filter(NON_EMPTY).slice(0, 1);
}
function getEraTextureArrangementCues(params: GenerateSongParams): string[] {
  return getSelectedEraTextureLayerProfiles(params).filter((profile) => !profile.mediaTexture).map((profile) => profile.arrangementCue).filter(NON_EMPTY).slice(0, 1);
}
function rawMoodAndDirectInputText(params: GenerateSongParams): string {
  return [ ...(params.moods ?? []), params.userInput || '', params.situation?.description || '', params.situation?.detailCustom || '' ].filter(Boolean).join(' ').toLowerCase();
}
function interpretMoodGenreModifier(params: GenerateSongParams): string {
  const raw = rawMoodAndDirectInputText(params);
  if (!raw) return '';

  const genreRaw = [
    getSelectedPrimaryGenreKey(params),
    params.genre || '',
    ...(params.subGenre ?? []),
    selectedStyleText(params, { excludeEraTexture: true }),
  ].join(' ').toLowerCase();

  const hit = {
    bright: /(밝|희망|설렘|상큼|산뜻|hope|bright|fresh|오픈|open)/.test(raw),
    dark: /(어두|불안|긴장|위태|차가|dark|tense|cold|anxious)/.test(raw),
    melancholic: /(외로|쓸쓸|아련|미련|그리움|공허|lonely|melanchol|wistful|empty)/.test(raw),
    warm: /(따뜻|포근|몽글|다정|위로|cozy|warm|comfort)/.test(raw),
    dreamy: /(몽환|흐릿|나른|꿈같|dreamy|floating|blurred)/.test(raw),
    vintage: /(빈티지|빛바랜|아날로그|낡은|lp|vintage|analog|aged)/.test(raw),
    traditional: /(전통|정통|고전|클래식|민요|traditional|classic|heritage)/.test(raw),
    magical: /(판타지|마법|동화|비현실|신비|fantasy|magical|fairy|surreal)/.test(raw),
    playful: /(장난|코믹|엉뚱|능청|유쾌|병맛|comic|playful|quirky|funny)/.test(raw),
    spatial: /(강렬|폭발|웅장|공간|우주|바다|넓은|영화|powerful|explosive|cinematic|space|ocean|wide)/.test(raw),
  };

  const darkCore = /darkwave|goth|industrial|horror|dark\s*trap|dark\s*synth|synth\s*score|film\s*score|drill|minor|shadow/.test(genreRaw);
  const cinematicCore = /score|ost|cinematic|soundtrack|film|synth\s*score/.test(genreRaw);
  const traditionalCore = /gugak|pansori|trot|flamenco|middle\s*eastern|world|folk|traditional/.test(genreRaw);
  const brightCore = /dance|idol|pop\s*punk|teen\s*pop|tropical|eurobeat|anime|j[-_\s]?pop/.test(genreRaw);

  // Treat repeated/contrasting mood choices as intent, not noise.
  // The modifier should bend the main genre without replacing it.
  if (hit.bright && darkCore) return hit.playful ? 'playful hopeful contrast' : 'faint hopeful contrast';
  if (hit.bright && cinematicCore) return 'hopeful cinematic glow';
  if (hit.dark && brightCore) return 'dark emotional contrast';
  if (hit.playful && darkCore) return 'playful dark contrast';
  if (hit.warm && darkCore) return 'warm shadowed color';
  if (hit.spatial && cinematicCore) return 'wide cinematic color';
  if (hit.magical && traditionalCore) return 'soft magical folk color';

  const candidates: Array<{ modifier: string; hit: boolean }> = [
    { modifier: 'bright pop color', hit: hit.bright },
    { modifier: 'dark emotional edge', hit: hit.dark },
    { modifier: 'melancholic color', hit: hit.melancholic },
    { modifier: 'warm intimate color', hit: hit.warm },
    { modifier: 'dreamy floating color', hit: hit.dreamy },
    { modifier: 'vintage analog color', hit: hit.vintage },
    { modifier: 'traditional classic color', hit: hit.traditional },
    { modifier: 'soft magical color', hit: hit.magical },
    { modifier: 'playful comic edge', hit: hit.playful },
    { modifier: 'cinematic spatial color', hit: hit.spatial },
  ];
  return candidates.find((item) => item.hit)?.modifier || '';
}


type GenreMoodConceptHit = {
  playful: boolean;
  cute: boolean;
  warm: boolean;
  bright: boolean;
  hopeful: boolean;
  dark: boolean;
  melancholic: boolean;
  wistful: boolean;
  dreamy: boolean;
  magical: boolean;
  cool: boolean;
  spatial: boolean;
  tense: boolean;
  calm: boolean;
  smooth: boolean;
  vintage: boolean;
  urban: boolean;
  youthful: boolean;
  moody: boolean;
  romantic: boolean;
  swelling: boolean;
};

function getGenreMoodConceptHit(params: GenerateSongParams): GenreMoodConceptHit {
  const raw = [
    rawMoodAndDirectInputText(params),
    selectedThemeText(params),
    selectedStyleText(params, { excludeEraTexture: false }),
  ].join(' ').toLowerCase();

  return {
    playful: /(장난|코믹|웃픈|엉뚱|능청|유쾌|병맛|comic|playful|quirky|funny|awkward)/.test(raw),
    cute: /(귀여|풋풋|몽글|달콤|flutter|cute|sweet|youthful|campus|대학생|친구|짝사랑|설렘|썸)/.test(raw),
    warm: /(따뜻|포근|다정|위로|안식|cozy|warm|comfort|intimate|몽글)/.test(raw),
    bright: /(밝|희망|쾌활|상큼|산뜻|오픈|hope|bright|fresh|upbeat|cheerful)/.test(raw),
    hopeful: /(희망|기대|성장|변화|hope|hopeful|growth|change)/.test(raw),
    dark: /(어두|비통|불안|서늘|차가|위태|긴장|dark|cold|shadow|anxious|tragic|sorrow)/.test(raw),
    melancholic: /(아련|미련|그리움|공허|외로|쓸쓸|우울|melanchol|wistful|empty|lonely|nostalgic)/.test(raw),
    wistful: /(아련|애틋|미련|그리움|회상|추억|wistful|tender|memory|nostalgic|aftertaste)/.test(raw),
    dreamy: /(몽환|흐릿|나른|꿈|dreamy|floating|blurred|haze|airy)/.test(raw),
    magical: /(판타지|동화|마법|신비|비현실|fantasy|magical|fairy|mystic|surreal)/.test(raw),
    cool: /(시원|서늘|새벽|밤|드라이브|바다|cool|night|drive|dawn|ocean)/.test(raw),
    spatial: /(공간|우주|넓은|웅장|영화|시네마|잔향|space|wide|cinematic|echo|reverb)/.test(raw),
    tense: /(긴장|불안|위태|집착|압박|tense|anxious|pressure|obsessive)/.test(raw),
    calm: /(차분|담담|릴렉스|평온|calm|relaxed|quiet|soft)/.test(raw),
    smooth: /(스무스|부드러운|매끈|smooth|soft|silky)/.test(raw),
    vintage: /(빈티지|빛바랜|아날로그|레트로|lp|바이닐|vintage|analog|retro)/.test(raw),
    urban: /(도시|도시적|카페|정류장|골목|편의점|방|회사|퇴근|야근|city|urban|cafe|street|room|station)/.test(raw),
    youthful: /(풋풋|대학생|청춘|어린|첫사랑|친구|campus|youth|young|teen|school)/.test(raw),
    moody: /(무디|먹먹|그늘|shadow|moody|moodiness)/.test(raw),
    romantic: /(사랑|연인|고백|짝사랑|썸|romance|romantic|love|crush|confession)/.test(raw),
    swelling: /(벅찬|북받|차오르|감정\s*고조|빌드업|overwhelmed|swelling|choked\s*up|emotional\s*build)/.test(raw),
  };
}

function deriveGenreMoodConceptTag(params: GenerateSongParams): string {
  const hit = getGenreMoodConceptHit(params);

  // Priority is intentionally musical: strong contrast first, then scene color,
  // then single mood. The result is the short "what kind of genre" prefix.
  if (hit.urban && hit.romantic && (hit.moody || hit.melancholic || hit.dark)) return 'Moody urban romantic';
  if (hit.urban && hit.romantic && hit.swelling) return 'Swelling urban romantic';
  if (hit.urban && hit.romantic) return 'Urban romantic';
  if (hit.swelling && hit.romantic) return 'Swelling romantic';
  if (hit.moody && hit.urban) return 'Moody urban';
  if (hit.moody && hit.romantic) return 'Moody romantic';
  if (hit.playful && (hit.dark || hit.tense)) return 'Playful dark';
  if (hit.playful && (hit.cute || hit.bright)) return 'Playful bright';
  if (hit.cute && hit.wistful) return 'Youthful bittersweet';
  if (hit.youthful && (hit.warm || hit.cute)) return 'Warm youthful';
  if (hit.magical && (hit.dark || hit.tense)) return 'Dark magical';
  if (hit.magical && (hit.warm || hit.bright)) return 'Soft magical';
  if (hit.cool && (hit.melancholic || hit.dark)) return 'Cool melancholic';
  if (hit.cool && hit.dreamy) return 'Cool dreamy';
  if (hit.dreamy && hit.melancholic) return 'Dreamy melancholic';
  if (hit.warm && hit.melancholic) return 'Warm melancholic';
  if (hit.wistful && hit.warm) return 'Wistful tender';
  if (hit.spatial && (hit.dark || hit.melancholic)) return 'Cinematic melancholic';
  if (hit.spatial && hit.bright) return 'Cinematic hopeful';
  if (hit.vintage && hit.warm) return 'Warm vintage';
  if (hit.urban && hit.melancholic) return 'Urban melancholic';
  if (hit.urban && hit.bright) return 'Bright urban';
  if (hit.moody) return 'Moody';
  if (hit.romantic) return 'Romantic';
  if (hit.swelling) return 'Swelling emotional';
  if (hit.dark) return 'Dark emotional';
  if (hit.melancholic || hit.wistful) return 'Wistful emotional';
  if (hit.warm) return 'Warm intimate';
  if (hit.bright || hit.hopeful) return 'Bright hopeful';
  if (hit.dreamy) return 'Dreamy';
  if (hit.playful) return 'Playful';
  if (hit.calm || hit.smooth) return 'Smooth calm';
  return '';
}

function normalizeGenreFusionAccentToken(token: string, base = ''): string {
  let value = stripNonGenrePerformancePhrases(genreStyleTokenToNatural(token || ''))
    .replace(/\bbright\s+pop\s+color\b/gi, '')
    .replace(/\bdark\s+emotional\s+edge\b/gi, '')
    .replace(/\bmelancholic\s+color\b/gi, '')
    .replace(/\bwarm\s+intimate\s+color\b/gi, '')
    .replace(/\bdreamy\s+floating\s+color\b/gi, '')
    .replace(/\bsoft\s+magical\s+color\b/gi, '')
    .replace(/\bplayful\s+comic\s+edge\b/gi, '')
    .replace(/\bcinematic\s+spatial\s+color\b/gi, '')
    .replace(/\btraditional\s+classic\s+color\b/gi, '')
    .replace(/\btraditional\s+classic\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!value) return '';

  const lower = value.toLowerCase();
  const baseLower = base.toLowerCase();

  if (/melodic\s+rap/.test(lower)) value = 'Melodic Rap flow';
  else if (/ballad/.test(lower)) value = 'Ballad warmth';
  else if (/r&b|rnb/.test(lower)) value = /\b\d{2,4}s\b|y2k/.test(lower) ? value : 'R&B harmony';
  else if (/nu[-\s]?disco/.test(lower)) value = 'Nu-Disco groove';
  else if (/j[-\s]?rock|k[-\s]?band|band\s+pop\s+rock|pop\s+rock/.test(lower)) value = value.replace(/\s+edge$/i, '') + ' edge';
  else if (/punk/.test(lower)) value = 'Punk Rock edge';
  else if (/house/.test(lower)) value = 'House pulse';
  else if (/out[-\s]?run/.test(lower)) value = 'Outrun drive';
  else if (/synthwave/.test(lower)) value = 'Synthwave glow';
  else if (/dreamwave/.test(lower)) value = 'Dreamwave haze';
  else if (/jazz[-\s]?funk|fusion\s+jazz/.test(lower)) value = 'Jazz-funk movement';
  else if (/lo[-\s]?fi/.test(lower)) value = 'lo-fi texture';

  const cleaned = compactGenreToken(value).replace(/\s{2,}/g, ' ').trim();
  if (!cleaned) return '';
  if (baseLower && isSameGenreFamily(base, cleaned)) return '';
  return cleaned;
}

function genreAccentFamilyKey(token: string): string {
  return String(token || '')
    .toLowerCase()
    .replace(/\b(soft|warm|bright|dark|cool|dreamy|cinematic|emotional|color|edge|glow|warmth|harmony|flow|groove|pulse|drive|texture|movement|polish|energy|lift)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function collectGenreFusionAccentTokens(params: GenerateSongParams, mainLabels: string[], base: string): string[] {
  const styleGenreTokens = getStyleGenreInfluenceLabels(params, mainLabels);
  const secondaryMainGenres = mainLabels.slice(1).map(genreStyleTokenToNatural).filter(Boolean);
  const eraAccents = getEraTextureGenreAccents(params);
  const vocalGenreAccents = getVocalGenreAccentTokens(params);
  const raw = [
    ...secondaryMainGenres,
    ...styleGenreTokens,
    ...vocalGenreAccents,
    ...eraAccents,
  ];

  const seen = new Set<string>();
  const result: string[] = [];
  raw.forEach((token) => {
    const normalized = normalizeGenreFusionAccentToken(token, base);
    if (!normalized) return;
    const key = genreAccentFamilyKey(normalized) || normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result.slice(0, 4);
}

function prefixGenreMoodConcept(concept: string, base: string): string {
  const cleanBase = stripNonGenrePerformancePhrases(base || '').replace(/\s{2,}/g, ' ').trim() || 'Pop';
  const cleanConcept = cleanupPromptTail(concept || '').replace(/\s{2,}/g, ' ').trim();
  if (!cleanConcept) return cleanBase;
  const lowerBase = cleanBase.toLowerCase();
  const conceptWords = cleanConcept.toLowerCase().split(/\s+/).filter(Boolean);
  if (conceptWords.some((word) => word.length > 3 && lowerBase.includes(word))) return cleanBase;
  return `${cleanConcept} ${cleanBase}`.replace(/\s{2,}/g, ' ').trim();
}

function renderMoodFusionGenreValue(base: string, accents: string[], concept: string): string {
  const head = prefixGenreMoodConcept(concept, base);
  const cleanAccents = dedupeGenreAccentTokens(
    accents.map((accent) => normalizeGenreFusionAccentToken(accent, head)).filter(Boolean),
  ).slice(0, 4);

  // Case table for genre keywords:
  // 1 = mood + main genre.
  // 2 = mood + main genre with one sub-color.
  // 3 = mood + main genre fusion with two role accents.
  // 4 = mood + main genre fusion with three role accents.
  // 5+ = mood + main genre multi-fusion with four compact role accents.
  if (cleanAccents.length === 0) return cleanupPromptTail(head);
  if (cleanAccents.length === 1) return cleanupPromptTail(`${head} with ${cleanAccents[0]}`);

  const isFusionBase = /\bfusion\b/i.test(head);
  const fusionWord = isFusionBase ? 'with' : cleanAccents.length >= 4 ? 'multi-fusion with' : 'fusion with';
  return cleanupPromptTail(`${head} ${fusionWord} ${joinPromptPhrase(cleanAccents, 'and')}`);
}
function reinforceRepeatedGenreMoodIntent(genreValue: string, base: string, params: GenerateSongParams): string {
  const raw = [
    rawMoodAndDirectInputText(params),
    selectedThemeText(params),
    selectedStyleText(params, { excludeEraTexture: false }),
    selectedSoundText(params),
  ].join(' ').toLowerCase();
  const baseText = `${base || ''} ${genreValue || ''}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(raw);
  const hasBase = (pattern: RegExp) => pattern.test(baseText);

  // If mood/theme repeats the genre identity, emphasize that intent instead of
  // removing it as a duplicate. This is a final Genre-only render pass.
  if (hasBase(/romantic\s*rock|로맨틱\s*록/) && has(/사랑|연인|고백|짝사랑|love|romance|romantic|confession|crush|비|rain|릴렉스|relax|편안/)) {
    if (has(/비|rain|rainy/)) return 'Rain-soaked Romantic Rock with tender love color';
    if (has(/릴렉스|relax|편안|calm|차분/)) return 'Relaxed Romantic Rock with tender love color';
    return 'Deep Romantic Rock with tender love color';
  }
  if (hasBase(/opera|오페라/) && has(/후회|분노|어두|dark|regret|anger|ethereal|에테리얼|네오\s*레트로|neo[-\s]?retro/)) {
    const suffix = has(/네오\s*레트로|neo[-\s]?retro|ethereal|에테리얼/) ? ' with ethereal neo-retro color' : '';
    return `Dark regretful Opera${suffix}`;
  }
  if (hasBase(/j[-\s]?ballad|j\s*발라드/) && has(/후회|퇴근|기묘|strange|after[-\s]?work|regret|wide\s*reverb|넓은\s*리버브/)) {
    return 'Wistful J-Ballad with strange after-work melancholy';
  }
  if (hasBase(/emo\s*rap|이모랩/) && has(/바다|희망|코믹|comic|seaside|hope|2000/)) {
    return /2000/.test(raw) ? 'Playful dark Emo Rap with 2000s glossy pop polish' : genreValue;
  }
  return genreValue;
}

function mergeCompactCue(base: string, additions: string[], max = 3): string {
  const parts = dedupePromptParts([
    ...String(base || '').split(',').map((part) => cleanupPromptTail(part.trim())).filter(Boolean),
    ...additions.map((item) => cleanupPromptTail(item)).filter(Boolean),
  ], 12).slice(0, max);
  return joinPromptPhrase(parts, 'and');
}

function normalizeEraTextureGenreAccent(item: ResolvedStyleItem): string {
  return getEraTextureLayerProfile(item).genreAccent;
}


function getEraTexturePrefix(params: GenerateSongParams): string {
  const eraItem = getSelectedEraTextureItems(params)[0];
  if (!eraItem) return '';
  return normalizeEraTextureGenreAccent(eraItem);
}

function formatGenreInfluence(label: string): string {
  // For [Genre], do not write explanatory glue such as influence / fused with / as the core.
  // Keep genre/style identity as short comma-separated tokens only.
  return compactGenreToken(label);
}

function getStyleGenreInfluenceLabels(params: GenerateSongParams, mainLabels: string[]): string[] {
  return getStyleItemsByPromptRole(params.styles ?? [], 'genre')
    .filter((item) => !isEraTextureStyleItem(item))
    // Genre categories contribute the visible genre name, not long style prose.
    // Example: Hip-hop, Britpop, Nu-Disco.
    .map((item) => String(item.label || (item as any).style || '').trim())
    .map(formatGenreInfluence)
    .filter((label) => label && !mainLabels.some((main) => isSameGenreFamily(main, label)))
    .filter(NON_EMPTY)
    .filter((label, index, arr) => arr.findIndex((item) => item.toLowerCase() === label.toLowerCase()) === index)
    .slice(0, 3);
}

function isTrapOrHiphopCoreGenre(params: GenerateSongParams): boolean {
  if (isFreeTextPrimaryMode(params)) return false;

  const firstGenre = getSelectedFusionGenres(params)[0];
  const raw = `${firstGenre?.id || ''} ${firstGenre?.label || ''}`.toLowerCase();

  return /\b(k[-\s]?trap|dark\s*trap|trap|hip[-\s]?hop|hiphop|drill|boom\s*bap)\b/.test(raw);
}

function genreStyleTokenToNatural(token: string): string {
  const value = String(token || '').trim();
  const lower = value.toLowerCase();
  if (!value) return '';
  if (/2010s.*idol|idol[-\s]?pop|polished\s*pop\s*energy/.test(lower)) return '2010s polished pop energy';
  if (/2010s.*edm|edm[-\s]?pop|festival\s*build/.test(lower)) return '2010s festival build color';
  if (/90s.*r&b|90s.*rnb|90s|warm\s*studio/.test(lower)) return '90s warm studio color';
  if (/2000s|y2k|glossy\s*pop/.test(lower)) return '2000s glossy pop polish';
  if (/80s|retro\s*synth/.test(lower)) return '80s synth color';
  if (/2020s|hyperpop/.test(lower)) return '2020s hyper-digital texture';
  if (/nu[-\s]?disco/.test(lower)) return 'Nu-Disco groove';
  if (/synthwave/.test(lower)) return 'soft Synthwave glow';
  if (/dreamwave/.test(lower)) return 'dreamwave haze';
  if (/motown/.test(lower)) return 'Vintage Motown bounce';
  if (/neo[-\s]?soul/.test(lower)) return 'warm Neo-Soul intimacy';
  if (/r&b|rnb/.test(lower)) return 'warm R&B harmony';
  if (/punk[-\s]?rock|punk/.test(lower)) return 'Punk Rock edge';
  if (/jazz[-\s]?funk|fusion/.test(lower)) return 'jazz-funk fusion movement';
  if (/lo[-\s]?fi/.test(lower)) return 'lo-fi texture';
  if (/city/.test(lower)) return 'urban night color';
  return compactGenreToken(value);
}

function getVocalGenreAccentTokens(params: GenerateSongParams): string[] {
  const text = getStyleItemsByPromptRole(params.styles ?? [], 'vocals')
    .map((item) => `${item.id} ${item.label || ''} ${item.labelKo || ''} ${(item as any).style || ''} ${(item as any).sound || ''}`)
    .join(' ')
    .toLowerCase();

  const accents: string[] = [];
  if (/2000s.*r&b.*duo|r&b.*duo|rnb.*duo/.test(text)) accents.push('warm R&B harmony');
  else if (/2000s.*r&b|r&b|rnb/.test(text)) accents.push('2000s R&B warmth');
  return accents;
}

function dedupeGenreAccentTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  tokens.forEach((token) => {
    const cleaned = cleanupPromptTail(token).replace(/\.+$/g, '').trim();
    if (!cleaned) return;
    const key = cleaned
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(warm|soft|smooth|edge|harmony|color|texture|movement|groove|intimacy|warmth)\b/g, '')
      .trim();
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    result.push(cleaned);
  });
  return result;
}

function formatGenreAccentSuffix(tokens: string[], fallback = ''): string {
  const accents = dedupeGenreAccentTokens(tokens).slice(0, 3);
  if (accents.length) return ` with ${joinPromptPhrase(accents, 'and')}`;
  return fallback ? ` with ${fallback}` : '';
}

function stripNonGenrePerformancePhrases(value: string): string {
  return cleanupPromptTail(value)
    // These are valid in Vocals/Arrangement, but should never define [Genre].
    .replace(/\b(?:stage-like\s+)?emotional\s+(?:lift|peaks?)\b/gi, '')
    .replace(/\bclear\s+verse-to-chorus\s+lift\b/gi, '')
    .replace(/\brounded\s+vibrato\s+(?:space|color)\b/gi, '')
    .replace(/\bfocused\s+hook\b/gi, '')
    .replace(/\b(?:gradual|cinematic)\s+lift\b/gi, '')
    .replace(/\bclose\s+vocal\s+intimacy\b/gi, '')
    .replace(/\blive\s+vocal\s+urgency\b/gi, '')
    .replace(/\s+with\s*$/gi, '')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[,/&-]+\s*|\s*[,/&-]+\s*$/g, '')
    .trim();
}

function attachGenreAccents(base: string, tokens: string[] = [], fallback = ''): string {
  const cleanBase = stripNonGenrePerformancePhrases(base).replace(/\s{2,}/g, ' ').trim();
  const baseLower = cleanBase.toLowerCase();
  const rawAccents = dedupeGenreAccentTokens([
    ...tokens.map(genreStyleTokenToNatural),
    ...(fallback ? [fallback] : []),
  ].filter(Boolean)
    .map(stripNonGenrePerformancePhrases)
    .filter(Boolean));
  const accents = rawAccents
    // If the main genre already carries R&B/City/Rock/etc, avoid repeating the
    // same family as another vague accent. Era-specific forms like 90s R&B stay.
    .filter((accent) => {
      const lower = accent.toLowerCase();
      if (/\b\d{2,4}s\b|y2k|hyperpop/.test(lower)) return true;
      if (/r&b|rnb/.test(baseLower) && /r&b|rnb/.test(lower)) return false;
      if (/trot/.test(baseLower) && /trot/.test(lower)) return false;
      if (/jazz/.test(baseLower) && /jazz/.test(lower)) return false;
      if (/rock/.test(baseLower) && /rock/.test(lower)) return false;
      return true;
    })
    .slice(0, 3);

  if (!cleanBase) return accents.length ? joinPromptPhrase(accents, 'and') : 'Pop';
  if (!accents.length) return cleanBase;

  const withMatch = cleanBase.match(/^(.*?)\s+with\s+(.+)$/i);
  if (!withMatch) {
    return cleanupPromptTail(`${cleanBase} with ${joinPromptPhrase(accents, 'and')}`);
  }

  const head = withMatch[1].trim();
  const existingAccent = withMatch[2].trim();
  const mergedAccents = dedupeGenreAccentTokens([existingAccent, ...accents]).slice(0, 3);
  return cleanupPromptTail(`${head} with ${joinPromptPhrase(mergedAccents, 'and')}`);
}


function preserveSpecificTrotGenreLabel(label: string): string {
  const cleanLabel = compactGenreToken(label || '');
  if (!cleanLabel) return 'Korean Trot';

  // Do not collapse leaf trot genres like Shuffle Trot / Semi Trot into broad Korean Trot.
  // The selected leaf genre is the real genre identity; Korean is only a cultural prefix.
  if (/\btrot\b/i.test(cleanLabel)) {
    if (/^korean\s+/i.test(cleanLabel)) return cleanLabel;
    if (/^traditional\s+trot$/i.test(cleanLabel)) return 'Korean Traditional Trot';
    if (/^semi\s+trot$/i.test(cleanLabel)) return 'Korean Semi Trot';
    if (/^disco\s+trot$/i.test(cleanLabel)) return 'Korean Disco Trot';
    if (/^rock\s+trot$/i.test(cleanLabel)) return 'Korean Rock Trot';
    if (/^ballad\s+trot$/i.test(cleanLabel)) return 'Korean Ballad Trot';
    if (/^blues\s+trot$/i.test(cleanLabel)) return 'Korean Blues Trot';
    if (/^shuffle\s+trot$/i.test(cleanLabel)) return 'Korean Shuffle Trot';
    if (/^gugak\s+trot$/i.test(cleanLabel)) return 'Korean Gugak Trot';
    return `Korean ${cleanLabel}`;
  }

  return cleanLabel;
}


function getSpecificSelectedGenreBase(params: GenerateSongParams, mainLabels: string[]): string {
  const first = getSelectedFusionGenres(params)[0];
  const profile = getGenrePromptProfile(params);
  const rawLabel = mainLabels[0] || profile.label || first?.label || '';
  const rawIdentity = `${first?.id || ''} ${rawLabel} ${profile.style || ''}`;
  if (/gugak[_-]?fusion|gugak\s*fusion|fusion\s*gugak|국악\s*퓨전/i.test(rawIdentity)) return 'Korean Fusion Gugak';
  if (/pansori[_-]?fusion|pansori\s*fusion|판소리\s*퓨전/i.test(rawIdentity)) return 'Pansori Fusion';
  if (/indian[_-]?fusion|indian\s*fusion|인도\s*퓨전/i.test(rawIdentity)) return 'Indian Fusion';
  if (/fusion[_-]?jazz|fusion\s*jazz|퓨전\s*재즈/i.test(rawIdentity)) return 'Fusion Jazz';
  if (/trot|트로트/i.test(rawLabel)) return preserveSpecificTrotGenreLabel(rawLabel);
  const label = compactGenreToken(rawLabel);
  if (label && !/^pop$/i.test(label)) return label;
  const profileStyle = compactGenreToken(profile.style || '');
  return profileStyle || label || 'Pop';
}
function getSelectedGenrePromptSoundCues(params: GenerateSongParams): string[] {
  return getSelectedFusionGenres(params).flatMap((genre, index) => {
    const record = lookupPromptRecord(SUB_GENRE_PROMPTS, genre.id) || lookupPromptRecord(MID_GENRE_PROMPTS, genre.id) || {};
    const source = cleanPromptValue((record as any).sound || '');
    return source.split(',').map((part) => normalizeInstrumentPromptForGenre(part.trim(), params)).filter(Boolean).slice(0, index === 0 ? 3 : 1);
  });
}
function getSelectedGenreVocalCue(params: GenerateSongParams): string {
  const first = getSelectedFusionGenres(params)[0];
  if (!first) return '';
  const record = lookupPromptRecord(SUB_GENRE_PROMPTS, first.id) || lookupPromptRecord(MID_GENRE_PROMPTS, first.id) || {};
  return cleanPromptValue((record as any).vocal || '');
}
function selectedGenreVocalSubject(params: GenerateSongParams, subject: string): string {
  const label = getSpecificSelectedGenreBase(params, getSelectedFusionGenres(params).map((genre) => compactGenreToken(genre.label)).filter(Boolean));
  const cleanSubject = subject || 'vocal';
  if (!label || /^pop$/i.test(label)) return naturalVocalPrefix(params, cleanSubject);
  const lower = label.toLowerCase();
  if (cleanSubject.includes('female')) return `Natural female ${lower} vocal`;
  if (cleanSubject.includes('male')) return `Natural male ${lower} vocal`;
  if (cleanSubject.includes('solo')) return `Natural solo ${lower} vocal`;
  return `Natural ${lower} vocal`;
}
function compactVocalCueAfterSubject(value: string): string {
  let cue = cleanupPromptTail(String(value || ''))
    .replace(/\b(?:natural\s+)?(?:solo\s+|male\s+|female\s+)?(?:urban\s+)?city\s*r&b\s+vocal\b/gi, '')
    .replace(/\b(?:natural\s+)?(?:solo\s+|male\s+|female\s+)?(?:city\s*)?r&b\s+vocal\b/gi, '')
    .replace(/\bvocal\b/gi, 'phrasing')
    .replace(/\s{2,}/g, ' ')
    .replace(/^with\s+/i, '')
    .replace(/^and\s+/i, '')
    .trim();
  if (/^smooth\s+late-night\s*$/i.test(cue)) cue = 'smooth late-night phrasing';
  return cleanupPromptTail(cue);
}
function getSpecificGenreArrangementCue(params: GenerateSongParams): string {
  const first = getSelectedFusionGenres(params)[0];
  const raw = `${first?.id || ''} ${first?.label || ''}`.toLowerCase();
  if (/city[-_\s]?r&b|city[-_\s]?rnb|urban\s+city\s*r&b/.test(raw)) return 'City R&B pocket groove, close vocal space, smooth late-night transitions';
  if (/slow[-_\s]?jam/.test(raw)) return 'slow-jam groove, intimate verse space, gradual emotional lift';
  if (/uk[-_\s]?garage[-_\s]?r&b|uk[-_\s]?garage[-_\s]?rnb/.test(raw)) return 'syncopated garage-R&B groove, shuffled section movement, focused hook';
  if (/alternative[-_\s]?r&b|alternative[-_\s]?rnb|pb[-_\s]?r&b|pb[-_\s]?rnb/.test(raw)) return 'alternative R&B pocket, dark texture shifts, restrained hook lift';
  if (/neo[-_\s]?soul/.test(raw)) return 'deep-pocket groove, intimate verse space, warm harmonic lift, relaxed chorus release';
  if (/j[-_\s]?indie|j\s*indie|인디팝|indie\s*pop/.test(raw)) return 'gentle J-indie band build, intimate verse motion, gradual emotional lift, scene-led hook';
  if (/string\s*ensemble|현악\s*합주|스트링\s*앙상블/.test(raw)) return 'string-led cinematic build, measured rhythmic lift, quiet emotional turn, hopeful chorus bloom';
  if (/mystery\s*bgm|미스터리\s*bgm/.test(raw)) return 'mystery-BGM suspense flow, subtle pulse tension, unresolved scene turn';
  if (/italian\s*pop|이탈리아\s*팝/.test(raw)) return 'melodic Italian-pop flow, bright refrain lift, playful street-scene bounce';
  if (/sarod|사로드/.test(raw)) return 'sarod-led classical flow, tabla rhythmic cycle, tanpura drone space';
  return '';
}

function getGenreIdentityDNA(params: GenerateSongParams, mainLabels: string[], styleTokens: string[]): string {
  const first = getSelectedFusionGenres(params)[0];
  const raw = `${first?.id || ''} ${first?.label || ''} ${mainLabels[0] || ''}`.toLowerCase();
  const styleText = dedupeGenreAccentTokens(styleTokens.filter(Boolean));
  const selectedBase = getSpecificSelectedGenreBase(params, mainLabels);
  if (selectedBase && !/^pop$/i.test(selectedBase)) return attachGenreAccents(selectedBase, styleText);
  if (/gugak[_-]?fusion|gugak\s*fusion|fusion\s*gugak|국악\s*퓨전/.test(raw)) return attachGenreAccents('Korean Fusion Gugak', styleText, 'modern crossover color');
  if (/pansori|판소리/.test(raw)) return attachGenreAccents('Pansori Fusion', styleText, 'modern crossover color');
  if (/gugak|국악/.test(raw)) return attachGenreAccents('Korean Fusion Gugak', styleText, 'modern crossover color');
  if (/city\s*pop|citypop|시티팝/.test(raw)) return attachGenreAccents('City Pop', styleText, 'retro urban color');
  if (/neo[-_\s]?soul|네오/.test(raw)) return attachGenreAccents('Neo-Soul', styleText, 'warm Rhodes harmony');
  if (/classic\s*soul|soul|소울/.test(raw)) return attachGenreAccents('Classic Soul', styleText, 'gospel-rooted warmth');
  if (/fusion[-_\s]?jazz|jazz/.test(raw)) return attachGenreAccents('Electric Jazz', styleText, 'warm harmonic color');
  if (/idol|k[-_\s]?pop|아이돌/.test(raw)) return attachGenreAccents('K-Pop', styleText, 'sharp pop polish');
  if (/r&b|rnb/.test(raw)) return attachGenreAccents(mainLabels[0] || 'R&B', styleText, 'close late-night color');
  if (/rock|록/.test(raw)) return attachGenreAccents(mainLabels[0] || 'Rock', styleText, 'live band edge');
  if (/trot|트로트/.test(raw)) return attachGenreAccents(preserveSpecificTrotGenreLabel(mainLabels[0] || first?.label || 'Korean Trot'), styleText);
  const primary = mainLabels[0] ? compactGenreToken(mainLabels[0]) : 'Pop';
  return attachGenreAccents(primary, styleText);
}

function buildFiveLineGenreValue(params: GenerateSongParams): string {
  if (isFreeTextPrimaryMode(params)) {
    const freeGenre = compactGenreToken(buildFreeTextDirectorProfile(params.userInput || "").genre || "Pop");
    return sanitizePromptGenreArtifacts(stripNonGenrePerformancePhrases(freeGenre));
  }

  const selectedGenres = getSelectedFusionGenres(params);
  const mainLabels = selectedGenres.map((genre) => compactGenreToken(genre.label)).filter(NON_EMPTY);
  const base = getSpecificSelectedGenreBase(params, mainLabels);
  const concept = deriveGenreMoodConceptTag(params);
  const accents = collectGenreFusionAccentTokens(params, mainLabels, base);

  let genreValue = renderMoodFusionGenreValue(base || 'Pop', accents, concept);

  // Keep a couple of highly specific single-genre scene readings, but express
  // them as a mooded genre declaration rather than plain genre names.
  const intentText = getIntentKeywordText(params).toLowerCase();
  if (/^Synthwave$/i.test(stripNonGenrePerformancePhrases(base || '')) && /drive|드라이브|night|밤|방|room|비통|sorrow|시원|cool/.test(intentText)) {
    genreValue = renderMoodFusionGenreValue('Synthwave', accents, concept || 'Cool emotional night-drive');
  } else if (/^J[-\s]?Electro$/i.test(stripNonGenrePerformancePhrases(base || '')) && /수중|submerged|underwater|먹먹|muffled|digital|디지털/.test(intentText)) {
    genreValue = renderMoodFusionGenreValue('J-Electro', accents, concept || 'Submerged digital');
  }

  genreValue = reinforceRepeatedGenreMoodIntent(genreValue, base || mainLabels[0] || '', params);
  const artistAccent = buildArtistReferenceGenreAccent(params);
  if (artistAccent) {
    genreValue = cleanupPromptTail(`${artistAccent} ${stripNonGenrePerformancePhrases(genreValue || 'Pop')}`);
  }
  return sanitizePromptGenreArtifacts(stripNonGenrePerformancePhrases(genreValue || 'Pop'));
}

function lookupGenreInstrumentProfile(id: string) {
  const normalized = normalizeGenreIdForProfile(id);
  const candidates = Array.from(
    new Set([
      normalized,
      normalized.replace(/_/g, "-"),
      normalized.replace(/-/g, "_"),
      normalized.replace(/[-_]/g, ""),
    ]),
  );

  const key = candidates.find((candidate) => GENRE_INSTRUMENT_PROFILES[candidate]);
  return key ? GENRE_INSTRUMENT_PROFILES[key] : undefined;
}

function genreLabelToInstrumentProfileKey(labelOrId: string): string {
  const raw = String(labelOrId || '').trim().toLowerCase();
  if (!raw) return '';
  const compact = raw.replace(/[\s_]+/g, '-');

  if (GENRE_INSTRUMENT_PROFILES[compact]) return compact;
  if (GENRE_INSTRUMENT_PROFILES[compact.replace(/-/g, '')]) return compact.replace(/-/g, '');

  if (/j[-\s]?city\s*pop|city\s*pop/.test(raw)) return 'citypop';
  if (/j[-\s]?pop|anisong|anime/.test(raw)) return 'jpop';
  if (/k[-\s]?idol|k[-\s]?pop|idol\s*pop/.test(raw)) return 'kpop';
  if (/new\s*jack\s*swing/.test(raw)) return 'dance-pop';
  if (/nu[-\s]?disco|retro\s*disco|disco/.test(raw)) return 'disco-fallback';
  if (/bossa/.test(raw)) return 'bossanova';
  if (/britpop/.test(raw)) return 'britpop';
  if (/trap|k[-\s]?trap|dark\s*trap/.test(raw)) return 'trap';
  if (/hip[-\s]?hop|rap/.test(raw)) return 'hiphop';
  if (/r&b|rnb/.test(raw)) return 'rnb';
  if (/jazz/.test(raw)) return 'jazz';
  return '';
}

function getFallbackInstrumentProfile(key: string) {
  if (key === 'disco-fallback') {
    return {
      instruments: ['disco drums', 'funk bass', 'rhythm guitar', 'string stabs'],
      rhythm: ['four-on-the-floor disco groove'],
      texture: ['retro dance sheen'],
    };
  }
  return undefined;
}

function lookupGenreInstrumentProfileByLabel(labelOrId: string) {
  const direct = lookupGenreInstrumentProfile(labelOrId);
  if (direct) return direct;
  const key = genreLabelToInstrumentProfileKey(labelOrId);
  if (!key) return undefined;
  return GENRE_INSTRUMENT_PROFILES[key] || getFallbackInstrumentProfile(key);
}

function pushUniquePromptItem(target: string[], value: string, max = 9) {
  const cleaned = cleanupPromptTail(cleanPromptValue(value)).replace(/\.+$/g, "").trim();
  if (!cleaned) return;
  if (target.some((item) => item.toLowerCase() === cleaned.toLowerCase())) return;
  if (target.length < max) target.push(cleaned);
}


function normalizeInstrumentPromptForGenre(value: string, params: GenerateSongParams): string {
  let item = cleanupPromptTail(String(value || '')).trim();
  if (!item) return '';

  item = item
    .replace(/^world instrument color with\s+/i, '')
    .replace(/^Korean traditional ensemble with\s+/i, '')
    .replace(/\bguitar layer with guitar solo\b/gi, 'guitar solo')
    .replace(/\bClean electric\b/gi, 'clean electric guitar')
    .replace(/\bAcoustic guitar\b/g, 'acoustic guitar')
    .replace(/\bNylon guitar\b/g, 'nylon guitar')
    .replace(/\bPiano\b/g, 'piano')
    .replace(/\bClapping\b/gi, 'hand claps')
    .replace(/\bCajon\b/g, 'cajon')
    .replace(/^Accordion$/i, 'accordion')
    .replace(/^Brass$/i, 'brass section')
    .replace(/^Trot rhythm$/i, 'trot rhythm')
    .replace(/\bFrench horn\b/g, 'French horn')
    .replace(/\bSaw[-\s]?tooth leads?\b/gi, 'saw-tooth leads')
    .replace(/\bArpeggiated bass\b/gi, 'arpeggiated bass')
    .replace(/\bOff[-\s]?beat guitar\b/gi, 'off-beat skank guitar')
    .replace(/\bSkank\b/g, 'off-beat skank guitar')
    .replace(/\bAmbient pads\b/g, 'ambient pads')
    .replace(/\bMinimalist moody beats\b/g, 'minimalist moody beat')
    .replace(/\bBright bass\b/g, 'bright bass')
    .replace(/\bFast drums\b/g, 'fast drums')
    .replace(/\bLive drums\b/g, 'live drums');

  const genreKey = getSelectedPrimaryGenreKey(params);
  if (genreKey === 'pansori' || genreKey === 'gugak_fusion') {
    const lower = item.toLowerCase();
    if (/piri|피리/.test(lower)) return 'piri breath line';
    if (/taepyeongso|태평소/.test(lower)) return 'taepyeongso mournful lead';
    if (/gayageum|가야금/.test(lower)) return 'gayageum plucks';
    if (/haegeum|해금/.test(lower)) return 'haegeum color';
    if (/daegeum|대금/.test(lower)) return 'daegeum airy line';
    if (/janggu|장구/.test(lower)) return 'janggu rhythm';
    if (/buk|북/.test(lower)) return 'buk percussion';
  }
  return item;
}

function dedupeInstrumentSemantic(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const semanticKey = (item: string) => {
    const lower = item.toLowerCase();
    if (/piri|피리/.test(lower)) return 'piri';
    if (/taepyeongso|태평소/.test(lower)) return 'taepyeongso';
    if (/gayageum|가야금/.test(lower)) return 'gayageum';
    if (/haegeum|해금/.test(lower)) return 'haegeum';
    if (/daegeum|대금/.test(lower)) return 'daegeum';
    if (/janggu|장구/.test(lower)) return 'janggu';
    if (/buk percussion|\bbuk\b|북/.test(lower)) return 'buk';
    if (/guitar solo|lead guitar solo/.test(lower)) return 'guitar-solo';
    if (/acoustic guitar|nylon guitar|intimate acoustic guitar|soft acoustic guitar|guitar strum|fingerpicked guitar/.test(lower)) return 'acoustic-guitar';
    if (/electric guitar|clean electric guitar|clean guitar|rhythm guitar|power chords|guitar riff/.test(lower)) return 'electric-guitar';
    if (/synth guitar/.test(lower)) return 'synth-guitar';
    if (/rhodes|warm keys|smooth keys|electric piano|dx7|\bkeys\b|keyboard layer/.test(lower)) return 'keys';
    if (/soft piano|jazz piano|piano band session|electric piano|\bpiano\b/.test(lower)) return 'piano';
    if (/ambient pads|soft pads|lush pads|warm pads|airy pads|pad\b/.test(lower)) return 'pads';
    if (/heavy 808|808 bass|deep 808|808 low|sliding 808|808 slide/.test(lower)) return '808-bass';
    if (/trap hi-hats|hi-hats|hihat/.test(lower)) return 'trap-hi-hats';
    if (/hard snare|snare/.test(lower)) return 'snare';
    if (/minimalist moody beats|low-end beat|punchy beats|beat\b/.test(lower)) return 'beat';
    if (/brush drums|swing drums|disco drums|breakbeat drums|fast drums|live drums|half-time drums|drum kit|soft drums|smooth drums|clean drums|punchy drums|drums|\bdrum\b/.test(lower)) return 'drums';
    if (/modern bass|warm bass|funk bass|groovy bass|jazz-funk bass|upright bass|synthetic bass|sub bass|clean bass|bass/.test(lower)) return 'bass';
    if (/off[-\s]?beat skank guitar|off[-\s]?beat guitar|skank/.test(lower)) return 'offbeat-skank-guitar';
    if (/hand claps|clapping|clap/.test(lower)) return 'hand-claps';
    if (/brass section|(^|[^a-z])brass([^a-z]|$)/.test(lower)) return 'brass-section';
    if (/accordion/.test(lower)) return 'accordion';
    if (/trot rhythm/.test(lower)) return 'trot-rhythm';
    if (/cajon/.test(lower)) return 'cajon';
    if (/riser fx|glitch fx|fx|sfx|effect/.test(lower)) return 'fx';
    return lower.replace(/[^a-z0-9]+/g, ' ').trim();
  };
  items.forEach((item) => {
    const key = semanticKey(item);
    if (!key) return;
    const existingIndex = result.findIndex((existing) => semanticKey(existing) === key);
    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const existingLower = existing.toLowerCase();
      const itemLower = item.toLowerCase();
      const preferNew =
        (key === 'brass-section' && /brass section/.test(itemLower) && !/brass section/.test(existingLower)) ||
        item.length > existing.length + 8;
      if (preferNew) result[existingIndex] = item;
      seen.add(key);
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function buildFiveLineInstrumentsValue(params: GenerateSongParams, detailLayer: string): string {
  if (isFreeTextPrimaryMode(params)) {
    return cleanupPromptTail(buildFreeTextDirectorProfile(detailLayer).sound || "focused core instruments");
  }

  const selectedGenres = getSelectedFusionGenres(params);
  const genreStyleItems = getStyleItemsByPromptRole(params.styles ?? [], 'genre')
    .filter((item) => !isEraTextureStyleItem(item));
  const items: string[] = [];
  const directlySelected = compactSoundPromptsByCategory(params.instrumentSounds ?? [])
    .flatMap((item) => item.split(',').map((part) => part.trim()))
    .map((item) => normalizeInstrumentPromptForGenre(item, params))
    .filter(NON_EMPTY);

  // Directly selected sound/instrument keywords are the user's actual sound palette.
  // Genre DNA may only fill missing musical slots; it must not flood the line or
  // rewrite choices such as piri/taepyeongso/gayageum or synth brass/free lead synth.
  directlySelected.slice(0, 8).forEach((item) => pushUniquePromptItem(items, item, 10));

  getSelectedGenrePromptSoundCues(params).forEach((item) => pushUniquePromptItem(items, item, 10));
  getEraTextureInstrumentCues(params).forEach((item) => pushUniquePromptItem(items, item, 10));
  getSelectedStyleSoundTextureCues(params).forEach((item) => pushUniquePromptItem(items, item, 10));

  const addProfileInstruments = (profile: any, limit: number) => {
    (profile?.instruments || [])
      .map((item: string) => normalizeInstrumentPromptForGenre(item, params))
      .slice(0, limit)
      .forEach((item: string) => pushUniquePromptItem(items, item, 10));
  };

  const directCount = dedupeInstrumentSemantic(items).length;
  const genreKey = getSelectedPrimaryGenreKey(params);

  // If the user already selected a clear palette, add only a small backbone.
  // If the palette is sparse, use genre DNA to complete the arrangement.
  const mainGenreLimit = directCount >= 5 ? 1 : directCount >= 3 ? 2 : 4;
  const styleGenreLimit = directCount >= 5 ? 0 : directCount >= 3 ? 1 : 2;

  selectedGenres.forEach((genre, genreIndex) => {
    const profile = lookupGenreInstrumentProfileByLabel(genre.id) || lookupGenreInstrumentProfileByLabel(genre.label);
    addProfileInstruments(profile, genreIndex === 0 ? mainGenreLimit : Math.min(1, styleGenreLimit));
  });

  genreStyleItems.forEach((item, index) => {
    if (styleGenreLimit <= 0) return;
    const label = String(item.label || item.id || '').trim();
    const profile = lookupGenreInstrumentProfileByLabel(label);
    addProfileInstruments(profile, index === 0 ? styleGenreLimit : 1);
  });

  // Genre-specific minimal anchors when selected sounds cover color instruments only.
  const semantic = dedupeInstrumentSemantic(items).join(', ').toLowerCase();
  if (genreKey === 'pansori' || genreKey === 'gugak_fusion') {
    if (!/janggu|buk|percussion/.test(semantic)) pushUniquePromptItem(items, 'subtle janggu rhythm', 10);
    if (!/bass/.test(semantic)) pushUniquePromptItem(items, 'modern bass', 10);
  }
  if (genreKey === 'citypop') {
    if (!/bass/.test(semantic)) pushUniquePromptItem(items, 'groovy bass', 10);
    if (!/drum/.test(semantic)) pushUniquePromptItem(items, 'disco drums', 10);
  }

  // Only when almost nothing was selected, fall back to older broad sound construction.
  if (items.length < 4) {
    cleanPromptValue(buildSound(params))
      .split(',')
      .map((item) => normalizeInstrumentPromptForGenre(item, params))
      .slice(0, 4)
      .forEach((item) => pushUniquePromptItem(items, item, 10));
  }

  const intentSoundFocus = buildPromptIntent(params).soundFocus;
  if (intentSoundFocus) pushUniquePromptItem(items, intentSoundFocus, 10);

  const storyWeightedItems = applyDirectStoryToInstrumentItems(items, params);
  return cleanupPromptTail(dedupeInstrumentSemantic(storyWeightedItems).slice(0, 8).join(', ')) || "focused drums, bass, and melodic core instruments";
}


function dedupeAtmosphereRepeatedMoods(value: string): string {
  let line = String(value || '');
  const repeatedWords = ['lonely'];

  repeatedWords.forEach((word) => {
    const pattern = new RegExp(`\\b(${word})(?=[^,]*(?:,| and| where| with|$))(.*?)\\b${word}\\b`, 'gi');
    let previous = '';
    while (previous !== line) {
      previous = line;
      line = line.replace(pattern, (_match, first, middle) => `${first}${middle}`);
    }
  });

  return line
    .replace(/,\s*,/g, ',')
    .replace(/,\s+where\b/gi, ', where')
    .replace(/,\s+with\b/gi, ', with')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}


function repairAtmosphereSyntax(value: string): string {
  let line = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '));

  line = line
    .replace(/\bshown\s+through\s+one\s+everyday\s+incident\s+with\s+warm\s+where\s+one\s+unsaid\s+feeling\s+pushing\s+against\s+an\s+ordinary\s+moment\b/gi, 'a warm everyday scene where one unsaid feeling pushes against an ordinary moment')
    .replace(/\bshown\s+through\s+one\s+everyday\s+incident\s+with\s+([^,]+?)\s+where\s+one\s+unsaid\s+feeling\s+pushing\s+against\s+an\s+ordinary\s+moment\b/gi, 'a $1 everyday scene where one unsaid feeling pushes against an ordinary moment')
    .replace(/\bwhere\s+one\s+unsaid\s+feeling\s+pushing\b/gi, 'where one unsaid feeling pushes')
    .replace(/\bwhere\s+([^,]+?)\s+pushing\s+against\b/gi, 'where $1 pushes against')
    .replace(/\bwhere\s+wanting\s+to\s+speak\s+first\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\b/gi, 'where the urge to speak first hides the most important feeling')
    .replace(/\band\s+groovy\s+where\b/gi, 'with groovy pulse where')
    .replace(/,\s*and\s+(dramatic|intense|suspense)\s+where\b/gi, ' with $1 tension where')
    .replace(/\bwith\s+(warm|cold|bright|dark|soft|calm|hopeful|lonely|remote|nostalgic|spacious|relaxed|tender|moody)\s+where\b/gi, 'with $1 tension where')
    .replace(/\bwith\s+spacious\s+and\s+relaxed,\s*remote,\s*nostalgic,\s*and\s+far\s+reverb,\s*softened\s+presence\s+where\b/gi, 'with spacious relaxed distance, far reverb, and nostalgic softened presence where')
    .replace(/\bwith\s+([^,]+?),\s*([^,]+?),\s*and\s+([^,]+?),\s*where\b/gi, 'with $1, $2, and $3 where')
    .replace(/\bwith\s+moody\s+and\s+street\s+noise\b/gi, 'with moody street noise')
    .replace(/\blate[-\s]?night\s+stop\b/gi, 'late-night bus stop')
    .replace(/\bbus\s+bus\s+stop\b/gi, 'bus stop')
    .replace(/\b(calm\s+gentle\s+mood)\s*\1\b/gi, '$1')
    .replace(/\b(retro\s+nostalgia)\s*,\s*nostalgic\s+retro\s+mood\b/gi, '$1')
    .replace(/\bnostalgic\s+retro\s+mood\s*,\s*(retro\s+nostalgia)\b/gi, '$1')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (line.length > 190) {
    const beforeWhere = line.split(/\s+where\s+/i)[0];
    const whereMatch = line.match(/\bwhere\s+(.{1,90})/i);
    const wherePart = whereMatch ? `where ${cleanupPromptTail(whereMatch[1])}` : '';
    const compact = [beforeWhere, wherePart].filter(Boolean).join(' ');
    if (compact.length >= 50) line = compact;
  }

  return cleanupPromptTail(line);
}


function compactAtmosphereFinalLine(value: string): string {
  let line = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '))
    .replace(/\bwhere\s+swallowing\s+old\s+anger\s+while\s+trying\s+to\s+sound\s+ordinary\b/gi, 'where old anger hides under ordinary words')
    .replace(/\bwhere\s+pretending\s+to\s+move\s+on\s+while\s+one\s+small\s+object\s+keeps\s+the\s+feeling\s+alive\b/gi, 'where one small object keeps the feeling alive')
    .replace(/\bwhere\s+([^,]+?)\s+while\s+one\s+small\s+object\s+keeps\s+the\s+feeling\s+alive\b/gi, 'where one small object keeps the feeling alive')
    .replace(/\bwhere\s+wanting\s+to\s+speak\s+first\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\b/gi, 'where the urge to speak first hides the most important feeling')
    .replace(/\band\s+groovy\s+where\b/gi, 'with groovy pulse where')
    .replace(/,\s*and\s+(dramatic|intense|suspense)\s+where\b/gi, ' with $1 tension where')
    .replace(/\bwith\s+([^,]+?),\s*([^,]+?),\s*([^,]+?),\s*and\s+([^,]+?)\s+where\b/gi, 'with $1, $2, and $3 where')
    .replace(/\bwith\s+([^,]+?),\s*and\s+([^,]+?),\s*where\b/gi, 'with $1 and $2 where')
    .replace(/\bcarried\s+by\s+dark\s+conf\s*$/gi, 'carried by dark confidence')
    .replace(/\bdark\s+conf\s*$/gi, 'dark confidence')
    .replace(/\bwith\s+groovy\s+pulse,\s*reverse\s+FX,\s*and\s+tape\s+hiss\s+where\b/gi, 'with tape hiss, reverse FX, and groovy pulse where')
    .replace(/\bwith\s+spacious\s+and\s+relaxed,\s*remote,\s*nostalgic,\s*and\s+far\s+reverb,\s*softened\s+presence\s+where\b/gi, 'with far reverb, relaxed emptiness, and nostalgic distance where')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  line = removeIncompleteAtmosphereEnding(finalizeAtmosphereSentence(line));

  // Keep Atmosphere as one compact scene sentence. If it grows too long, keep
  // the scene core + one where-clause + up to three texture/emotion cues.
  if (line.length > 175) {
    const whereMatch = line.match(/^(.*?)\s+where\s+(.+)$/i);
    if (whereMatch) {
      const head = cleanupPromptTail(whereMatch[1]);
      const where = cleanupPromptTail(whereMatch[2])
        .replace(/\s+(?:with|and|while)\s*$/i, '')
        .split(/,\s*/)
        .slice(0, 1)
        .join(', ');
      const headParts = head.split(/\s+with\s+/i);
      if (headParts.length > 1) {
        const scene = headParts[0];
        const cues = headParts.slice(1).join(' with ')
          .split(/,\s*|\s+and\s+/i)
          .map((part) => cleanupPromptTail(part))
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
        line = cleanupPromptTail(`${scene}${cues ? ` with ${cues}` : ''} where ${where}`);
      } else {
        line = cleanupPromptTail(`${head} where ${where}`);
      }
    } else {
      const parts = line.split(/,\s*|\s+and\s+/i).map((part) => cleanupPromptTail(part)).filter(Boolean);
      if (parts.length > 4) line = cleanupPromptTail(parts.slice(0, 4).join(', '));
    }
  }

  return cleanupPromptTail(removeIncompleteAtmosphereEnding(finalizeAtmosphereSentence(line))) || 'balanced emotional air';
}

function normalizeAtmospherePromptLine(value: string): string {
  let line = stripRemainingKoreanForProductionPrompt(cleanupPromptTail(value || ""))
    .replace(/\s+/g, " ")
    .trim();

  line = line
    .replace(/\ba\s+calm\s+and\s+zen\s+emotional\s+scene\s+/gi, "calm and zen, ")
    .replace(/\b(calm\s+gentle\s+mood)\s*\1\b/gi, '$1')
    .replace(/\b(retro\s+nostalgia)\s*,\s*nostalgic\s+retro\s+mood\b/gi, 'retro nostalgia')
    .replace(/\bnostalgic\s+retro\s+mood\s*,\s*(retro\s+nostalgia)\b/gi, '$1')
    .replace(/\ban?\s+emotional\s+scene\s+/gi, "")
    .replace(/\bscene\s+lonely\b/gi, "scene, lonely")
    .replace(/\bwhere\s+short\s+rhythmic\s+phrases\s+shape\s+the\s+emotional\s+groove\b/gi, "with phrase-shaped emotional movement")
    .replace(/\bwhere\s+the\s+story\s+moves\s+through\s*$/i, "where the story moves through concrete details")
    .replace(/\bwhile\s+the\s+other\s*$/i, "while the other voice pulls away")
    .replace(/\bwith\s*$/i, "")
    .replace(/\ban\s+anxious\s+clear\s+emotional\s+scene\b/gi, 'an anxious emotional scene')
    .replace(/\banxious\s+clear\s+emotional\s+scene\b/gi, 'an anxious emotional scene')
    .replace(/\bclear\s+emotional\s+scene\b/gi, 'emotional scene')
    .replace(/\ba\s+breakup\s+aftermath\s+scene\s+in\s+seaside\s+with\s+dark\s+undertone\s+and\s+moody\s+shadow\b/gi, 'a lonely seaside weekend after a breakup with dreamy air, dark mood, and quiet healing')
    .replace(/\bsmooth\s+and\s+bittersweet\s+tension\s+around\s+small\s+fluttering\s+mistake\b/gi, 'a smooth city-cafe scene where a small fluttering mistake turns playful and bittersweet')
    .replace(/\ba\s+quiet\s+change\s+scene\s+in\s+seaside\s+with\s+soulful\s+warmth\s+and\s+warm\s+tone\b/gi, 'a damp basement-to-seaside scene with lonely warmth and distant siren tension')
    .replace(/\ba\s+reconciliation\s+scene\s+with\s+warm\s+intimacy\b/gi, 'a quiet family reconciliation scene where anger softens into warm but hollow intimacy')
    .replace(/\ba\s+(anxious|intimate|uneasy|open|old|emotional)\b/gi, 'an $1')
    .replace(/\bwith\s+soft\s+brightness\s+and\s+bright\s+tone\b/gi, 'with soft brightness')
    .replace(/\bwith\s+calm\s+tone\s+and\s+spacious\s+tone\b/gi, 'with calm spacious tone')
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  line = dedupeAtmosphereRepeatedMoods(line);
  line = repairAtmosphereSyntax(line);
  line = finalizeAtmosphereSentence(line);

  line = compactAtmosphereFinalLine(line);

  if (!line) return "balanced emotional air";
  return cleanupPromptTail(line);
}

function getAtmosphereSpaceCues(params: GenerateSongParams): string[] {
  const styleSpace = [
    ...getStylePromptValuesByRole(params.styles ?? [], 'atmosphere', 'mood'),
    ...getStylePromptValuesByRole(params.styles ?? [], 'atmosphere', 'sound'),
    ...getStylePromptValuesByRole(params.styles ?? [], 'atmosphere', 'style'),
  ];

  const soundSpace = getInstrumentSoundPromptItems(params.instrumentSounds ?? [])
    .filter((item) => /공간|질감|효과|ambience|space|room|reverb|hiss|noise|vinyl|tape|wind|rain|street|radio|metal|underwater|submerged|distant/i.test(
      `${item.categoryKo} ${item.labelKo} ${item.prompt}`,
    ))
    .map((item) => item.prompt);

  return [...styleSpace, ...soundSpace]
    .map((item) => cleanProductionPhrase(stripRemainingKoreanForProductionPrompt(item)))
    .filter(NON_EMPTY)
    .filter((item, index, arr) => arr.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 3);
}


type InternalScenePlan = {
  hasDirectorNote: boolean;
  hasLyricDraft: boolean;
  scene: string;
  detail: string;
  emotion: string;
  conflict: string;
  chorusCore: string;
  atmosphereCue: string;
  arrangementCues: string[];
  lyricDirection: string;
};

function cleanScenePlanPhrase(value: string, max = 120): string {
  return cleanupPromptTail(
    stripRemainingKoreanForProductionPrompt(String(value || ''))
      .replace(/\b(?:theme|mood|style|sound)\s*:\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  ).slice(0, max).trim();
}

function buildScenePlanConflictCue(params: GenerateSongParams, scene: string): string {
  const text = [getIntentKeywordText(params), selectedThemeText(params), rawMoodAndDirectInputText(params), scene].join(' ').toLowerCase();
  if (/(우주인|astronaut|cosmonaut|space traveler|우주를\s*떠도|지구|earth|신호|signal|transmission)/.test(text) && /(메시지|message|send|sending|던지|보내|전송|final)/.test(text)) return 'one final signal drifts back toward Earth';
  if (/운명|destiny|fate|coincidence|우연|필연/.test(text)) return 'trying to deny coincidence while feeling pulled by fate';
  if (/고백|confession|crush|짝사랑|설렘|flutter/.test(text)) return 'wanting to speak first but hiding the most important line';
  if (/이별|breakup|farewell|goodbye|그리움|longing/.test(text)) return 'pretending to move on while one small object keeps the feeling alive';
  if (/우정|friendship|친구/.test(text)) return 'acting comfortable while noticing that the distance has quietly changed';
  if (/가족|family|화해|reconcile/.test(text)) return 'swallowing old anger while trying to sound ordinary';
  if (/퇴근|야근|회사|office|work/.test(text)) return 'turning tired routine into a small private escape';
  if (/저항|resistance|rebel|반항/.test(text)) return 'staying calm on the surface while resisting from underneath';
  return directConflictFallback(params);
}

function buildScenePlanChorusCore(params: GenerateSongParams, conflict: string): string {
  const text = [getIntentKeywordText(params), selectedThemeText(params), rawMoodAndDirectInputText(params), conflict].join(' ').toLowerCase();
  if (/(우주인|astronaut|cosmonaut|space traveler|우주를\s*떠도|지구|earth|신호|signal|transmission)/.test(text) && /(메시지|message|send|sending|던지|보내|전송|final)/.test(text)) return 'a final signal keeps fading near the blue Earth';
  if (/운명|destiny|fate|우연|필연/.test(text)) return 'the more I avoid it, the closer it pulls me';
  if (/고백|confession|crush|짝사랑|설렘|flutter/.test(text)) return 'I almost say it, then hide it again';
  if (/이별|breakup|farewell|goodbye/.test(text)) return 'I say I am fine while the details prove otherwise';
  if (/우정|friendship|친구/.test(text)) return 'we are still close, but not in the same way';
  if (/성장|growth|change|변화/.test(text)) return 'I am changing even if I sound the same';
  if (/자유|free|freedom|escape|탈출/.test(text)) return 'I want a small freedom that feels like mine';
  return cleanupPromptTail(conflict || 'the hidden feeling keeps returning');
}


type DirectStoryPromptProfile = {
  strength: "none" | "normal" | "strong";
  scene: string;
  conflict: string;
  instrumentCues: string[];
  arrangementCues: string[];
  genreAccent: string;
};

function rawDirectStoryPriorityText(params: GenerateSongParams): string {
  // Keep this limited to real free/direct text so keyword-only songs are not
  // changed by direct-input protection rules.
  return [
    params.userInput || "",
    params.lyricDraft || "",
    getDirectThemeInputText(params),
    params.situation?.relationship || "",
    params.situation?.description || "",
    params.situation?.detailCustom || "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}


function rawDirectThemeMoodText(params: GenerateSongParams): string {
  return [params.userInput || "", params.lyricDraft || "", getDirectThemeInputText(params), getDirectMoodInputText(params), params.situation?.relationship || "", params.situation?.description || "", params.situation?.detailCustom || "", params.situation?.details || ""]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function hasDirectThemeOrMoodInput(params: GenerateSongParams): boolean {
  return Boolean(getDirectThemeInputText(params) || getDirectMoodInputText(params) || String(params.userInput || "").trim());
}

function directTextAllowsCueFamily(params: GenerateSongParams, family: "message" | "confession" | "breakup" | "street" | "ordinaryUnsaid"): boolean {
  const raw = rawDirectThemeMoodText(params).toLowerCase();
  if (!raw) return false;
  if (family === "message") return /메시지|문자|카톡|답장|읽음|전송|발신|신호|signal|transmission|send|sending|sent|message|text|reply|screen|phone|휴대폰|핸드폰|폰/i.test(raw);
  if (family === "confession") return /고백|짝사랑|설렘|떨림|crush|confession|flutter|heart|좋아|사랑/i.test(raw);
  if (family === "breakup") return /이별|헤어|떠나|그리움|longing|breakup|farewell|goodbye/i.test(raw);
  if (family === "street") return /거리|골목|정류장|버스|지하철|station|street|alley|bus|subway|road/i.test(raw);
  if (family === "ordinaryUnsaid") return /말하지\s*못|못한\s*말|속마음|침묵|unsaid|unspoken|hidden\s+feeling|ordinary\s+moment|일상|평범/i.test(raw);
  return false;
}

function stripUnsupportedDirectCueBankPhrases(value: string, params: GenerateSongParams): string {
  if (!hasDirectThemeOrMoodInput(params)) return cleanupPromptTail(value);
  let line = cleanupPromptTail(String(value || ""));
  if (!line) return line;
  const removeIfBlocked = (family: "message" | "confession" | "breakup" | "street" | "ordinaryUnsaid", patterns: RegExp[]) => {
    if (directTextAllowsCueFamily(params, family)) return;
    patterns.forEach((pattern) => { line = line.replace(pattern, ""); });
  };
  removeIfBlocked("message", [/,?\s*unsent[-\s]?message\s+tension\b/gi, /,?\s*message[-\s]?mistake\s+tension\b/gi, /,?\s*fluttering\s+confession\s+hook\b/gi, /\bbedroom[-\s]?message\s+hesitation\s+scene\b/gi, /\bone\s+unsent\s+line\s+on\s+the\s+screen\b/gi, /\bthe\s+screen\s+light\s+exposes\s+a\s+hidden\s+feeling\b/gi]);
  removeIfBlocked("confession", [/,?\s*delayed\s+confession\s+(?:lift|arc|hook)\b/gi, /,?\s*confession\s+(?:hook|arc|tension|lift)\b/gi, /\bheld[-\s]?back\s+confession\s+scene\b/gi, /\bempty[-\s]?room\s+confession\s+(?:scene|hook)\b/gi, /\bwanting\s+to\s+speak\s+first\s+but\s+hiding\s+the\s+most\s+important\s+line\b/gi]);
  removeIfBlocked("breakup", [/,?\s*breakup\s+(?:aftermath|tension|release|hook)\b/gi, /\bbreakup\s+aftermath\s+scene\b/gi, /\bpretending\s+to\s+move\s+on\s+while\s+one\s+small\s+object\s+keeps\s+the\s+feeling\s+alive\b/gi]);
  removeIfBlocked("street", [/\bstreet[-\s]?corner\s+memory\b/gi, /,?\s*late[-\s]?night\s+bus[-\s]?stop\s+tension\b/gi, /,?\s*subway[-\s]?window\s+memory\s+cue\b/gi, /,?\s*transit[-\s]?window\s+memory\s+cue\b/gi]);
  removeIfBlocked("ordinaryUnsaid", [/\bwhere\s+one\s+unsaid\s+feeling\s+push(?:es|ing)?\s+against\s+an\s+ordinary\s+moment\b/gi, /\bone\s+unsaid\s+feeling\s+push(?:es|ing)?\s+against\s+an\s+ordinary\s+moment\b/gi, /\bpassing\s+lights\s+hide\s+words\s+that\s+should\s+have\s+been\s+said\b/gi, /\bpassing\s+lights\s+carry\s+unsaid\s+words\b/gi]);
  line = line.replace(/\s+where\s*(?:,|and|with)?\s*$/i, "").replace(/,\s*(?:,|and\s*,?)+/g, ", ").replace(/(?:^|,\s*)(?:and|with|where)\s*(?=,|$)/gi, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").replace(/\s{2,}/g, " ").trim();
  return cleanupPromptTail(line);
}

function directConflictFallback(params: GenerateSongParams): string {
  // Keep direct-input support principle-based. This fallback must not invent
  // a specific story such as message/confession/commute/collector unless the
  // model writes it from the user's actual text. It is only a neutral pressure cue.
  if (hasDirectThemeOrMoodInput(params)) return "the user-written situation creates visible emotional pressure";
  return "one clear emotional tension drives the scene";
}

function buildDirectStoryPromptProfile(params: GenerateSongParams): DirectStoryPromptProfile {
  const raw = rawDirectStoryPriorityText(params);
  if (!raw) return { strength: "none", scene: "", conflict: "", instrumentCues: [], arrangementCues: [], genreAccent: "" };

  // Do not hard-code topic-specific fallback scenes here. Direct text can be
  // personal, strange, tiny, or very specific, so the production prompt should
  // be rendered by Gemini from the actual direct text in the same call. This
  // local profile only gives the locked prompt a neutral story-aware scaffold.
  const userScene = buildUserTextCoreScene(params);
  if (userScene) {
    return {
      strength: "normal",
      scene: cleanScenePlanPhrase(userScene.scene, 90),
      conflict: directConflictFallback(params),
      instrumentCues: [],
      arrangementCues: ["story-shaped section flow"],
      genreAccent: "story-aware color",
    };
  }

  return { strength: "none", scene: "", conflict: "", instrumentCues: [], arrangementCues: [], genreAccent: "" };
}

function applyDirectStoryToInstrumentItems(items: string[], params: GenerateSongParams): string[] {
  const profile = buildDirectStoryPromptProfile(params);
  if (profile.strength === "none" || !profile.instrumentCues.length) return items;
  const next = [...items];
  profile.instrumentCues.slice(0, profile.strength === "strong" ? 3 : 2).forEach((cue) => pushUniquePromptItem(next, cue, 10));
  return next;
}

function getDirectStoryArrangementCues(params: GenerateSongParams): string[] {
  const profile = buildDirectStoryPromptProfile(params);
  if (profile.strength === "none") return [];
  return profile.arrangementCues.filter(Boolean).slice(0, profile.strength === "strong" ? 3 : 2);
}

function buildInternalScenePlan(params: GenerateSongParams, detailLayer = ''): InternalScenePlan {
  const hasDirectorNote = Boolean((params.userInput || '').trim());
  const hasLyricDraft = Boolean(params.isLyricMode && (params.lyricDraft || '').trim());
  const userTextScene = buildUserTextCoreScene(params);
  const themeCore = buildThemeCoreScene(params);
  const derivedScene = cleanScenePlanPhrase(deriveIntentScene(params), 130);
  // Direct theme/user story text must be the primary scene source. Generic contextual cue-bank scenes
  // Generic contextual cue-bank scenes should not override a user-written story.
  const rawScene = userTextScene?.scene
    ? cleanScenePlanPhrase(userTextScene.scene, 130)
    : derivedScene || cleanScenePlanPhrase(themeCore.scene, 130) || 'a concrete everyday scene';
  const scene = rawScene
    .replace(/^a\s+small\s+fluttering\s+mistake$/i, 'a small everyday mistake turning into fluttering tension')
    .replace(/^a\s+private\s+room\s+scene$/i, 'a private room scene where a hidden feeling becomes harder to ignore');
  const detail = cleanScenePlanPhrase(themeCore.detail || '', 150) || 'one visible object, one small action, one unsaid feeling';
  const emotion = cleanScenePlanPhrase(buildDirectMoodAngle(params) || buildCompactMoodAngle(params) || buildPromptIntent(params).atmosphereTone || buildPromptIntent(params).emotionalCore || 'balanced emotional temperature', 72);
  const spaceCues = getAtmosphereSpaceCues(params).slice(0, 2).map((item) => cleanScenePlanPhrase(item, 52)).filter(Boolean);
  const conflict = buildScenePlanConflictCue(params, scene);
  const chorusCore = buildScenePlanChorusCore(params, conflict);
  const airParts = dedupePromptParts([emotion, ...spaceCues], 4).filter(Boolean);
  const atmosphereCue = cleanupPromptTail([
    scene,
    airParts.length ? `with ${joinPromptPhrase(airParts, 'and')}` : '',
    conflict && !/unsaid feeling/i.test(scene) ? `where ${conflict}` : '',
  ].filter(Boolean).join(' '));

  const movementCandidates = dedupePromptParts([
    ...splitArrangementParts(deriveIntentArrangement(params).replace(/\band\b/g, ',')),
    ...buildArrangementStabilizerParts(params),
  ], 12)
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean)
    .filter((part) => !isInstrumentPerformanceArrangementPart(part))
    .filter((part) => !isGenericArrangementPart(part));

  const arrangementCues = movementCandidates.slice(0, 4);
  const lyricDirection = cleanupPromptTail([
    `Write from ${scene}`,
    `use ${detail}`,
    `center the chorus on: ${chorusCore}`,
    `show ${conflict} through speech, behavior, timing, and small objects`,
  ].join('. '));

  return {
    hasDirectorNote,
    hasLyricDraft,
    scene,
    detail,
    emotion,
    conflict,
    chorusCore,
    atmosphereCue,
    arrangementCues,
    lyricDirection,
  };
}

function buildScenePlanInstruction(params: GenerateSongParams, detailLayer = ''): string {
  const plan = buildInternalScenePlan(params, detailLayer);
  const directorBlock = plan.hasDirectorNote
    ? `- USER FREE-TEXT DIRECTOR NOTE is the top-level director command for genre, structure, mood, vocal attitude, arrangement, and lyric tone. Preserve its concrete intent; do not compress it into a generic theme.`
    : `- No free-text director note was provided. Convert selected keywords into a specific scene, character desire, everyday detail, and chorus intention so the output does not feel like a keyword list.`;
  const lyricDraftBlock = plan.hasLyricDraft
    ? `- lyricDraft / AI correction / original-preserve mode affects generated lyrics only. Do not use the draft as a direct production-prompt command, but keep its story and wording as the primary lyrical source.`
    : `- If no lyric draft is provided, create lyrics from the Scene Plan rather than from abstract mood words.`;

  const directInputBlock = buildDirectInputProtectionInstruction(params);

  return `INTERNAL SCENE PLAN (MANDATORY, DO NOT OUTPUT THIS LABEL):\n${directorBlock}\n${lyricDraftBlock}${directInputBlock ? `\n${directInputBlock}` : ''}\n- Scene: ${plan.scene}\n- Lived detail pool: ${plan.detail}\n- Emotional temperature: ${plan.emotion}\n- Hidden conflict: ${plan.conflict}\n- Chorus core: ${plan.chorusCore}\n- Atmosphere must express the scene air and emotional temperature: ${plan.atmosphereCue}\n- Arrangement must express song movement, not just a hook word: ${plan.arrangementCues.join(', ') || 'genre-specific groove, section lift, transition behavior'}\n- Lyrics must follow this plan as character speech with concrete behavior and lived details, not as explanations of mood/style/sound keywords.`;
}

function hasExplicitSceneOrObjectInput(params: GenerateSongParams, detailLayer = ''): boolean {
  const text = [
    params.userInput || '',
    detailLayer || '',
    params.situation?.description || '',
    params.situation?.detailCustom || '',
    params.situation?.details || '',
  ].join(' ').trim();
  if (!text) return false;
  return /장면|물건|사물|장소|거리|방|창문|휴대폰|사진|컵|잔|커피|정류장|골목|문|의자|편지|object|place|room|street|window|photo|cup|coffee|station|chair/i.test(text);
}

function shouldUseVariationAtmosphereLens(variation: CreativeVariationSeed, params: GenerateSongParams, detailLayer = ''): boolean {
  const lens = `${variation.id} ${variation.atmosphereLens} ${variation.arrangementLens}`.toLowerCase();
  const isObjectLens = /object|visible|place|detail-led|hook-object|object-led|scene-led/.test(lens);
  if (!isObjectLens) return true;
  return hasExplicitSceneOrObjectInput(params, detailLayer) || hasSituation(params.situation);
}


function cleanAtmosphereRendererToken(value: string, max = 80): string {
  return cleanupPromptTail(
    stripRemainingKoreanForProductionPrompt(String(value || ''))
      .replace(/^\s*(?:with|where|and)\s+/i, '')
      .replace(/\b(?:scene|atmosphere|mood)\s*:\s*/gi, '')
      .replace(/\bwhere\b.*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  ).slice(0, max).trim();
}

function normalizeAtmosphereRendererScene(value: string): string {
  let scene = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '));
  if (!scene) return 'a concrete everyday scene';

  // Keep only the scene clause. Conflict is rendered separately so the final
  // Atmosphere line does not become "... where ... where ...".
  scene = scene
    .replace(/\s+where\s+.+$/i, '')
    .replace(/,\s*with\s+.+$/i, '')
    .replace(/\s+with\s+(?:warm|cold|bright|dark|soft|calm|dreamy|spacious|submerged|moody|soulful|magical|intense|suspense|hopeful|lonely|remote|nostalgic|relaxed|tender|groovy)(?:\s+and\s+\w+|,\s*\w+){0,5}\s*$/i, '')
    .replace(/\bshown\s+through\s+one\s+everyday\s+incident\b/gi, 'an everyday incident scene')
    .replace(/\bone\s+concrete\s+everyday\s+scene\b/gi, 'an everyday scene')
    .replace(/\bordinary\s+moments\s+scene\b/gi, 'ordinary moments scene')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .trim();

  if (!scene) scene = 'a concrete everyday scene';
  if (!/^(?:a|an)\s+/i.test(scene)) scene = `a ${scene}`;
  scene = scene
    .replace(/\ba\s+an\s+/i, 'an ')
    .replace(/\ba\s+a\s+/i, 'a ')
    .replace(/\ban\s+a\s+/i, 'a ')
    .replace(/\bscene\s+scene\b/gi, 'scene')
    .replace(/\beveryday\s+scene\s+scene\b/gi, 'everyday scene')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleanupPromptTail(scene);
}

function normalizeAtmosphereRendererConflict(value: string): string {
  let conflict = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '));
  if (!conflict) return '';
  conflict = conflict
    .replace(/^where\s+/i, '')
    .replace(/\bwanting\s+to\s+speak\s+first\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\b/gi, 'the urge to speak first hides the most important feeling')
    .replace(/\bone\s+unsaid\s+feeling\s+pushing\s+against\s+an\s+ordinary\s+moment\b/gi, 'one unsaid feeling pushes against an ordinary moment')
    .replace(/\bwhere\s+one\s+unsaid\s+feeling\s+pushing\b/gi, 'one unsaid feeling pushes')
    .replace(/\bstaying\s+calm\s+on\s+the\s+surface\s+while\s+resisting\s+from\s+underneath\b/gi, 'calm surface hides quiet resistance underneath')
    .replace(/\bswallowing\s+old\s+anger\s+while\s+trying\s+to\s+sound\s+ordinary\b/gi, 'old anger hides under ordinary words')
    .replace(/\bpretending\s+to\s+move\s+on\s+while\s+one\s+small\s+object\s+keeps\s+the\s+feeling\s+alive\b/gi, 'one small object keeps the feeling alive')
    .replace(/\bturning\s+tired\s+routine\s+into\s+a\s+small\s+private\s+escape\b/gi, 'tired routine turns into a small private escape')
    .replace(/\bacting\s+comfortable\s+while\s+noticing\s+that\s+the\s+distance\s+has\s+quietly\s+changed\b/gi, 'comfortable words reveal a quietly changed distance')
    .replace(/\bthe\s+feeling\s+turns\s+back\s+on\s+itself\b/gi, 'the feeling turns back on itself')
    .replace(/\bwhile\s+one\s+small\s+object\s+keeps\s+the\s+feeling\s+alive\b/gi, 'one small object keeps the feeling alive')
    .replace(/\bthe\s+urge\s+to\s+speak\s+first\s+hides\s+the\s+most\s*$/gi, 'the urge to speak first hides the most important feeling')
    .replace(/\s+(?:with|where|and|while|but|by)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleanupPromptTail(conflict);
}

function extractWhereConflictForAtmosphere(raw: string): string {
  const match = String(raw || '').match(/\bwhere\s+(.+)$/i);
  if (!match?.[1]) return '';
  return normalizeAtmosphereRendererConflict(match[1]
    .replace(/,\s*with\s+.+$/i, '')
    .replace(/\s+with\s+(?:warm|cold|bright|dark|soft|calm|dreamy|spacious|submerged|moody|soulful|magical|intense|suspense|hopeful|lonely|remote|nostalgic|relaxed|tender|groovy)(?:\s+and\s+\w+|,\s*\w+){0,5}\s*$/i, '')
  );
}

function collectAtmosphereRendererTextures(params: GenerateSongParams, raw: string, scenePlan: InternalScenePlan): string[] {
  const values: string[] = [];
  const add = (value: string) => {
    let item = cleanAtmosphereRendererToken(value, 54)
      .replace(/\bsubmerged\b/gi, 'submerged air')
      .replace(/\bspacious\b/gi, 'spacious air')
      .replace(/\bdreamy\b/gi, 'dreamy haze')
      .replace(/\bwarm\b/gi, 'warm tone')
      .replace(/\bcalm\b/gi, 'calm tone')
      .replace(/\bmoody\b/gi, 'moody shadow')
      .replace(/\bmagical\b/gi, 'magical color')
      .replace(/\bintense\b/gi, 'intense tension')
      .replace(/\bsuspense\b/gi, 'suspenseful tension')
      .replace(/\bgroovy\b/gi, 'groovy pulse')
      .replace(/\bbright\b/gi, 'soft brightness')
      .replace(/\blonely\b/gi, 'lonely air')
      .replace(/\bremote\b/gi, 'remote distance')
      .replace(/\brelaxed\b/gi, 'relaxed space')
      .replace(/\bnostalgic\b/gi, 'nostalgic air')
      .replace(/\s{2,}/g, ' ')
      .trim();

    item = item
      .replace(/\b(warm tone|calm tone|dreamy haze|spacious air|submerged air|moody shadow|magical color|intense tension|suspenseful tension|groovy pulse|soft brightness|lonely air|remote distance|relaxed space|nostalgic air)\s+tone\b/gi, '$1')
      .replace(/\bscene\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!item || item.length < 3) return;
    if (/^(?:and|with|where|the|a|an)$/i.test(item)) return;
    if (!values.some((existing) => existing.toLowerCase() === item.toLowerCase())) values.push(item);
  };

  // Priority: scene-plan emotion, explicit space cues, then raw with-clause fragments.
  (scenePlan.emotion || '').split(/\s+and\s+|,/i).forEach(add);
  getAtmosphereSpaceCues(params).slice(0, 2).forEach(add);

  const withMatch = String(raw || '').match(/\bwith\s+(.+?)(?:\s+where\s+|$)/i);
  if (withMatch?.[1]) {
    withMatch[1]
      .split(/,|\s+and\s+/i)
      .map((part) => part.trim())
      .forEach(add);
  }

  return dedupePromptParts(values, 8).slice(0, 3);
}


function polishAtmosphereRendererSentence(value: string): string {
  let line = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '));

  // Atmosphere-only polish: keep the rich scene/texture/conflict, but remove
  // obvious connector duplication and nounless adjective chains. Do not shorten
  // the line unless a repeated phrase is clearly harming readability.
  line = line
    .replace(/\bwith\s+cinematic\s+and\s+car\s+ambience\b/gi, 'with cinematic car ambience')
    .replace(/\bwith\s+anxious\s+tension\s+and\s+warm\s+tone\s+intimacy\b/gi, 'with anxious tension and warm intimacy')
    .replace(/\bwith\s+calm\s+tone\s+and\s+choir\s+pad\b/gi, 'with calm choir-pad warmth')
    .replace(/\bwith\s+softened\s+distance\s+and\s+old\s+emotion\s+with\s+dreamy\s+haze\s+and\s+quiet\s+and\s+lonely\s+air\b/gi, 'with softened distance, old emotion, dreamy haze, and quiet loneliness')
    .replace(/\bdawn\s+street\s+air\s+and\s+quiet\s+and\s+lonely\s+air\b/gi, 'dawn street air and quiet loneliness')
    .replace(/\bspacious\s+air\s+and\s+emotional\s+and\s+narrative\b/gi, 'spacious air and emotional narrative')
    .replace(/\bquiet\s+and\s+lonely\s+air\b/gi, 'quiet loneliness')
    .replace(/\bemotional\s+and\s+narrative\b/gi, 'emotional narrative')
    .replace(/\bwarm\s+tone\s+intimacy\b/gi, 'warm intimacy')
    .replace(/\bcalm\s+tone\s+intimacy\b/gi, 'calm intimacy')
    .replace(/\bdreamy\s+haze\s+and\s+dreamy\s+haze\b/gi, 'dreamy haze')
    .replace(/\bspacious\s+air\s+and\s+spacious\s+air\b/gi, 'spacious air')
    .replace(/\blonely\s+air\s+and\s+lonely\s+air\b/gi, 'lonely air')
    .replace(/\bwith\s+([^,]+?)\s+with\s+([^,]+?)\s+where\b/gi, 'with $1 and $2 where')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Remove exact repeated short cues inside the texture segment only.
  const whereParts = line.split(/\s+where\s+/i);
  if (whereParts.length >= 2) {
    const head = whereParts.shift() || '';
    const conflict = whereParts.join(' where ');
    const withParts = head.split(/\s+with\s+/i);
    if (withParts.length >= 2) {
      const scene = withParts.shift() || '';
      const textureText = withParts.join(' with ');
      const seen = new Set<string>();
      const textures = textureText
        .split(/,\s*|\s+and\s+/i)
        .map((item) => cleanupPromptTail(item))
        .filter(Boolean)
        .filter((item) => {
          const key = item.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      if (textures.length) {
        line = cleanupPromptTail(`${scene} with ${joinPromptPhrase(textures, 'and')} where ${conflict}`);
      }
    }
  }

  return cleanupPromptTail(finalizeAtmosphereSentence(line));
}

function renderStableAtmosphereLine(
  params: GenerateSongParams,
  rawAtmosphere: string,
  scenePlan: InternalScenePlan,
): string {
  const raw = cleanupPromptTail(String(rawAtmosphere || '').replace(/\s+/g, ' '));
  const hasUserScene = Boolean(buildUserTextCoreScene(params));
  const allowContextualCue = !hasSituation(params.situation) && !hasUserScene;
  const contextualCue = allowContextualCue ? buildContextualCueBundle(params) : { atmosphereScene: '', arrangementHook: '' };
  const rawWhere = extractWhereConflictForAtmosphere(raw);

  const contextualScene = contextualCue.atmosphereScene || '';
  const contextualWhere = extractWhereConflictForAtmosphere(contextualScene);
  const contextualBase = contextualScene ? normalizeAtmosphereRendererScene(contextualScene) : '';

  const sceneBase = normalizeAtmosphereRendererScene(
    scenePlan.scene || contextualBase || deriveIntentScene(params) || raw || 'a concrete everyday scene',
  );

  const directProfile = buildDirectStoryPromptProfile(params);
  const hasDirectInput = hasDirectThemeOrMoodInput(params);
  const supportedRawWhere = normalizeAtmosphereRendererConflict(stripUnsupportedDirectCueBankPhrases(rawWhere, params));
  const supportedContextualWhere = hasDirectInput ? '' : contextualWhere;
  const conflict = normalizeAtmosphereRendererConflict(
    directProfile.strength === 'strong'
      ? (scenePlan.conflict || supportedRawWhere || 'one visible detail carries the hidden feeling')
      : (supportedContextualWhere || supportedRawWhere || scenePlan.conflict || 'one visible detail carries the hidden feeling'),
  );

  const textures = collectAtmosphereRendererTextures(params, raw, scenePlan)
    .filter((texture) => !sceneBase.toLowerCase().includes(texture.toLowerCase()))
    .filter((texture) => !conflict.toLowerCase().includes(texture.toLowerCase()));

  const texturePhrase = textures.length ? joinPromptPhrase(textures.slice(0, 2), 'and') : '';
  const sentence = cleanupPromptTail([
    sceneBase,
    texturePhrase ? `with ${texturePhrase}` : '',
    conflict ? `where ${conflict}` : '',
  ].filter(Boolean).join(' '));

  return stripUnsupportedDirectCueBankPhrases(polishAtmosphereRendererSentence(
    normalizeAtmospherePromptLine(sentence)
      .replace(/\bwith\s+([^,]+?),\s*([^,]+?),\s*([^,]+?)\s+where\b/gi, 'with $1 and $2 where')
      .replace(/\bwith\s+([^,]+?),\s*and\s+([^,]+?)\s+where\b/gi, 'with $1 and $2 where')
      .replace(/\bwhere\s+where\b/gi, 'where')
      .replace(/\s{2,}/g, ' ')
      .trim()
  ), params);
}

function isGenericAtmosphereFallbackLine(value: string): boolean {
  const line = cleanupPromptTail(String(value || '')).toLowerCase();
  if (!line) return true;
  return /^(?:balanced emotional air|balanced emotional color|emotional scene|a clear emotional scene|an emotional scene|a balanced emotional scene|clear emotional scene)$/i.test(line)
    || /^balanced\s+(?:air|mood|tone)$/i.test(line);
}

function hasAtmosphereInterpretationSignal(params: GenerateSongParams): boolean {
  return Boolean(
    hasSituation(params.situation) ||
    hasDirectThemeOrMoodInput(params) ||
    hasUserPrimaryStoryText(params) ||
    selectedThemeText(params) ||
    selectedMoodText(params) ||
    getAtmosphereSpaceCues(params).length ||
    buildThemeMoodInterpretation(params).atmosphereCue ||
    buildPromptIntent(params).sceneCore
  );
}

function buildIntentConnectedAtmosphereLine(params: GenerateSongParams, original = ''): string {
  if (hasSituation(params.situation)) {
    return normalizeAtmospherePromptLine(buildSituationAtmosphere(params)) || cleanupPromptTail(original) || 'balanced emotional air';
  }

  if (hasDirectThemeOrMoodInput(params)) {
    return buildNaturalDirectAtmosphereFallback(params);
  }

  const scenePlan = buildInternalScenePlan(params, params.userInput || selectedThemeText(params) || selectedMoodText(params) || '');
  const contextual = !hasUserPrimaryStoryText(params) ? buildContextualCueBundle(params) : { atmosphereScene: '', arrangementHook: '' };
  const intent = buildPromptIntent(params);
  const interpreted = buildThemeMoodInterpretation(params);
  const layerScene = buildAtmosphereFromSceneLayers(params).replace(/^a\s+/i, '').replace(/,\s+with\s+.*$/i, '');

  const scene = cleanScenePlanPhrase(
    contextual.atmosphereScene ||
    scenePlan.scene ||
    intent.sceneCore ||
    (layerScene && !/one concrete everyday emotional scene/i.test(layerScene) ? `a ${layerScene}` : '') ||
    deriveIntentScene(params) ||
    original ||
    'one concrete emotional scene',
    105,
  );

  const textureParts = dedupePromptParts([
    interpreted.atmosphereCue,
    intent.atmosphereTone,
    ...getAtmosphereSpaceCues(params),
  ], 8)
    .map((part) => cleanScenePlanPhrase(part, 48))
    .filter(Boolean)
    .filter((part) => !scene.toLowerCase().includes(part.toLowerCase()))
    .slice(0, 2);

  const conflict = cleanScenePlanPhrase(
    scenePlan.conflict ||
    intent.contrast ||
    (interpreted.vocalCue ? `${interpreted.vocalCue} stays under the surface` : '') ||
    'one visible detail carries the hidden feeling',
    95,
  );

  const sentence = cleanupPromptTail([
    scene,
    textureParts.length ? `with ${joinPromptPhrase(textureParts, 'and')}` : '',
    conflict && !scene.toLowerCase().includes(conflict.toLowerCase()) ? `where ${conflict}` : '',
  ].filter(Boolean).join(' '));

  const normalized = normalizeAtmospherePromptLine(sentence);
  return isGenericAtmosphereFallbackLine(normalized) ? (cleanupPromptTail(original) || sentence || 'balanced emotional air') : normalized;
}

function buildSoloVocalSongInterpretationCue(params: GenerateSongParams, interpreted: ThemeMoodInterpretation): string {
  const intent = buildPromptIntent(params);
  const contextual = !hasUserPrimaryStoryText(params) && !hasSituation(params.situation)
    ? buildContextualCueBundle(params)
    : { atmosphereScene: '', arrangementHook: '' };
  const scenePlan = buildInternalScenePlan(params, params.userInput || selectedThemeText(params) || selectedMoodText(params) || '');
  const scene = cleanScenePlanPhrase(contextual.atmosphereScene || scenePlan.scene || intent.sceneCore || '', 70);
  const emotion = cleanScenePlanPhrase(intent.emotionalCore || interpreted.vocalCue || interpreted.atmosphereCue || '', 62);
  const delivery = cleanScenePlanPhrase(interpreted.vocalCue || intent.vocalDelivery || '', 52);

  if (scene && emotion && !/balanced emotional color/i.test(emotion)) {
    return cleanupPromptTail(`carrying ${emotion} inside ${scene}`);
  }
  if (delivery && scene) return cleanupPromptTail(`${delivery} shaped by ${scene}`);
  if (emotion && !/balanced emotional color/i.test(emotion)) return cleanupPromptTail(`carrying ${emotion}`);
  return '';
}

function buildFiveLineAtmosphereValue(
  params: GenerateSongParams,
  detailLayer: string,
  variation: CreativeVariationSeed,
): string {
  const situationActive = hasSituation(params.situation);
  const scenePlan = buildInternalScenePlan(params, detailLayer);
  const base = situationActive
    ? buildVariedSituationAtmosphere(params, variation)
    : getAtmosphereForPrompt(params, detailLayer);
  const spaceCues = joinPromptPhrase(getAtmosphereSpaceCues(params), 'and');
  const coreGenreGuard = !situationActive && isTrapOrHiphopCoreGenre(params)
    ? "carried by dark confidence and restrained hip-hop edge"
    : "";

  const variationLens = !situationActive && !hasUserPrimaryStoryText(params) && !isWarHistoricalContext(params) && shouldUseVariationAtmosphereLens(variation, params, detailLayer)
    ? variation.atmosphereLens
    : "";

  const interpreted = buildThemeMoodInterpretation(params);
  const interpretedCue = interpreted.atmosphereCue;
  const shouldMergeThemeMood = Boolean(interpretedCue) && !isFreeTextPrimaryMode(params);

  const planAtmosphereCue = !situationActive
    ? scenePlan.atmosphereCue
    : "";

  const atmosphere = situationActive
    ? [
        base,
        shouldMergeThemeMood ? interpretedCue : "",
        coreGenreGuard,
        variationLens,
        !shouldMergeThemeMood && spaceCues ? `with ${spaceCues}` : "",
      ]
        .filter(Boolean)
        .join(", ")
    : [
        planAtmosphereCue || (shouldMergeThemeMood ? interpretedCue : base),
        coreGenreGuard,
        !planAtmosphereCue && !shouldMergeThemeMood && spaceCues ? `with ${spaceCues}` : "",
        !planAtmosphereCue && !shouldMergeThemeMood ? variationLens : "",
      ]
        .filter(Boolean)
        .join(", ");

  const fallbackAtmosphere = buildIntentConnectedAtmosphereLine(params, atmosphere);
  const intendedAtmosphere = applyIntentToAtmosphereLine(atmosphere || fallbackAtmosphere, params);
  const rendered = renderStableAtmosphereLine(params, intendedAtmosphere, scenePlan);
  return isGenericAtmosphereFallbackLine(rendered) && hasAtmosphereInterpretationSignal(params)
    ? buildIntentConnectedAtmosphereLine(params, rendered)
    : rendered;
}

function removeArrangementTermsFromVocalLine(value: string): string {
  return cleanupPromptTail(String(value || '')
    .replace(/,?\s*singalong chorus point/gi, '')
    .replace(/,?\s*catchy hook(?:s)?/gi, '')
    .replace(/,?\s*memorable hook(?:s)?/gi, '')
    .replace(/,?\s*chorus lift/gi, '')
    .replace(/,?\s*hook point/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*,/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\(\s*\)/g, '')
    .replace(/,\s*,/g, ','));
}

function vocalEmotionPerformanceLens(params: GenerateSongParams): string {
  const parts: string[] = [];
  const globalEmotion = params.vocal?.globalToneId
    ? resolveVocalEmotionShort(params.vocal.globalToneId)
    : "";
  if (globalEmotion) parts.push(`${globalEmotion} emotion`);

  getStylePromptValuesByRole(params.styles ?? [], 'vocals', 'style')
    .slice(0, 2)
    .forEach((item) => {
      const cleaned = cleanProductionPhrase(stripRemainingKoreanForProductionPrompt(item));
      if (cleaned) parts.push(cleaned);
    });

  const raw = parts.join(' ').toLowerCase();
  const expressive: string[] = [];
  const add = (value: string) => {
    if (expressive.length < 3 && !expressive.includes(value)) expressive.push(value);
  };
  if (/breath|숨|whisper|속삭|airy/.test(raw)) add('human breath');
  if (/restrained|restraint|controlled|numb|resigned|체념|절제|억누/.test(raw)) add('restrained emotion');
  if (/sad|regret|fragile|lonely|상실|후회|슬픔|불안|desperate|pleading/.test(raw)) add('fragile sadness');
  if (/lazy|dreamy|relaxed|나른|몽환/.test(raw)) add('lazy dreamy phrasing');
  if (/power|belt|high|강한|고음/.test(raw)) add('emotional lift');
  if (/rap|spoken|talk|말하/.test(raw)) add('speech-like phrasing');

  return joinPromptPhrase(expressive.length ? expressive : parts.slice(0, 2), 'and');
}

function normalizeVocalPromptEmotion(value: string, params: GenerateSongParams): string {
  let line = cleanupPromptTail(String(value || ''))
    .replace(/\s+with\s+calmly\s+restrained\s+with\s+lightly\s+hopeful/gi, ' with calmly restrained and lightly hopeful delivery')
    .replace(/\bnumb\s+and\s+resigned\s+emotion\s+tossed-off\s+vocal\s+phrasing\s+and\s+lazy\s+relaxed\s+vocal\s+phrasing\b/gi, 'numb restrained emotion with lazy, breath-led phrasing')
    .replace(/\bnumb\s+restrained\s+emotion\s+and\s+lazy,?\s+breath-led\s+phrasing\s+restrained\s+emotion\s+and\s+lazy\s+dreamy\s+phrasing\b/gi, 'numb restrained emotion, human breath, and lazy dreamy phrasing')
    .replace(/\brestrained\s+emotion\s+and\s+lazy,?\s+breath-led\s+phrasing\s+restrained\s+emotion\s+and\s+lazy\s+dreamy\s+phrasing\b/gi, 'restrained emotion, human breath, and lazy dreamy phrasing')
    .replace(/\b(lazy\s+dreamy\s+phrasing)(?:\s+and\s+\1|\s*,\s*\1)+\b/gi, '$1')
    .replace(/\b(restrained\s+emotion)(?:\s+and\s+\1|\s*,\s*\1)+\b/gi, '$1')
    .replace(/\bfading\s+word\s+restrained\s+emotion\b/gi, 'fading word endings and restrained emotion')
    .replace(/\bfading\s+word\s*,?\s*$/gi, 'fading word endings')
    .replace(/\bending\s+restrained\s+emotion\b/gi, 'endings and restrained emotion')
    .replace(/\b(lazy\s+dreamy\s+phrasing)\s+(restrained\s+emotion)\b/gi, '$1 and $2')
    .replace(/\b(restrained\s+emotion)\s+(lazy\s+dreamy\s+phrasing)\b/gi, '$1 and $2')
    .replace(/\b(dreamy blurred vocal phrasing and hollow resigned vocal phrasing restrained emotion and lazy dreamy phrasing)\b/gi, '')
    .replace(/\b(dreamy blurred vocal phrasing|hollow resigned vocal phrasing)\s+(restrained emotion|lazy dreamy phrasing)\b/gi, '$1, $2')
    .replace(/\b(short-breath fragility)\s+(dreamy blurred vocal phrasing|hollow resigned vocal phrasing|restrained emotion|lazy dreamy phrasing)\b/gi, '$1, $2')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // V63: Do not append an extra vocal-performance lens here.
  // buildNaturalVocals/buildMemberVocalSplit already include selected Vocal Line cues.
  // Appending the lens again caused duplicated tails like
  // "... short-breath fragility dreamy blurred vocal phrasing ...".

  return cleanupPromptTail(
    line
      .replace(/\bNatural\s+solo\s+([^,]+?)\s+vocal\s+with\s+([^,]+?)\s+vocals\b/gi, (_m, genre, tone) => `Natural solo ${String(genre).trim()} vocal with ${String(tone).trim()} tone`)
      .replace(/\bvocal\s+with\s+([^,]+?)\s+vocals\b/gi, (_m, tone) => `vocal with ${String(tone).trim()} tone`)
      .replace(/\bDreamy\s+airy\s+vocals\b/gi, 'dreamy airy tone')
      .replace(/\bEthereal\s*,\s*Long\s+sustained\s+melodic\s+notes\b/gi, 'ethereal sustained phrasing')
      .replace(/\bDeep\s*,\s*Emotional\s*,\s*Raspy\s+Spanish\s+vocals\b/gi, 'deep raspy Spanish phrasing')
      .replace(/\bTender\s*,\s*Smooth\s+melodic\s+delivery\b/gi, 'tender smooth melodic phrasing')
      .replace(/\bornamental\s+modal\s+phrasing\s+texture\b/gi, 'ornamental modal phrasing')
      .replace(/\bEmotional\s+tone\s+with\s+/gi, '')
      .replace(/\bTraditional\s+Korean\s+phrasing\s+style\b/gi, 'traditional Korean phrasing')
      .replace(/\bRhythmic\s+Patois\s+style\b/gi, 'rhythmic patois phrasing')
      .replace(/\bLaid[-\s]?back\b/gi, 'laid-back groove')
      .replace(/\bwith\s+warm\s+and\s+calm\s+feeling\s+and\s+story-aware\s+delivery\b/gi, 'with warm calm emotion and story-aware expression')
      .replace(/\bwith\s+calm\s+and\s+smooth\s+feeling\s+and\s+story-aware\s+delivery\b/gi, 'with calm smooth delivery and story-aware expression')
      .replace(/\bwith\s+upbeat\s+feeling\s+and\s+story-aware\s+delivery\b/gi, 'with upbeat warmth and story-aware expression')
      .replace(/\bkorean\s+fusion\s+gugak\b/gi, 'Korean Fusion Gugak')
      .replace(/\balternative\s+r&b\b/gi, 'Alternative R&B')
      .replace(/\bsmooth\s+r&b\b/gi, 'Smooth R&B')
      .replace(/\bcity\s+r&b\b/gi, 'City R&B')
      .replace(/\bwith\s+calm\s+and\s+spacious\s+feeling\b/gi, 'with calm spacious delivery')
      .replace(/\bcalm\s+and\s+spacious\s+feeling\b/gi, 'calm spacious delivery')
      .replace(/\bpowerful\s+and\s+cinematic\s+feeling\b/gi, 'powerful cinematic delivery')
      .replace(/\bbright\s+feeling\b/gi, 'bright delivery')
      .replace(/\bwith\s+emotional\s+and\s+catchy\s+feeling\b/gi, 'with emotional catchy delivery')
      .replace(/\bwith\s+groovy\s+and\s+moody\s+feeling\b/gi, 'with groovy moody delivery')
      .replace(/\bgroovy\s+and\s+moody\s+feeling\b/gi, 'groovy moody delivery')
      .replace(/\bemotional\s+and\s+catchy\s+feeling\b/gi, 'emotional catchy delivery')
      .replace(/\band\s+story-aware\s+delivery\s+and\s+warm\s+harmony\s+phrasing\b/gi, ', warm harmony phrasing, and story-aware expression')
      .replace(/\bwith\s+story-aware\s+delivery\s+and\s+/gi, 'with ')
      .replace(/\band\s+story-aware\s+delivery\b/gi, 'and story-aware expression')
      .replace(/\bstory-aware\s+delivery\b/gi, 'story-aware expression')
      .replace(/\b(phrasing|tone|delivery)\s+with\s+(warm calm emotion|calm smooth delivery|upbeat warmth|powerful cinematic delivery|emotional catchy delivery)\b/gi, '$1, $2')
      .replace(/\bwarm\s+and\s+feeling\b/gi, 'warm feeling')
      .replace(/\bmood\s+feeling\b/gi, 'moody feeling')
      .replace(/\bwarm\s+and\s+moody\s+feeling\b/gi, 'warm moody feeling')
      .replace(/ghostly inward-inhaled singing\s+singing/gi, 'ghostly inward-inhaled breaths')
      .replace(/ghostly inward-inhaled singing/gi, 'ghostly inward-inhaled breaths')
      .replace(/\bsinging\s+singing\b/gi, 'singing')
      .replace(/,\s*,/g, ',')
      .replace(/\s+,/g, ',')
      .replace(/\s+/g, ' ')
      .replace(/^natural\b/i, 'Natural')
  );
}



function shouldApplyLargeGroupVocalCompression(params: GenerateSongParams): boolean {
  const info = getVocalModeInfo(params.vocal);
  const directiveText = [
    params.userInput || '',
    selectedStyleText(params),
    selectedThemeText(params),
    selectedMoodText(params),
  ].join(' ');
  const explicitDuo = /\bduet\b|듀엣|2\s*인|two\s+(?:voices|vocalists|singers)|male\s*\+\s*female|남녀\s*2/i.test(directiveText);
  const explicitLargeGroup = /그룹|혼성\s*그룹|여자\s*그룹|남자\s*그룹|girl\s*group|boy\s*group|female\s*group|male\s*group|mixed\s*group|all\s+vocals|3\s*인|4\s*인|5\s*인|6\s*인|7\s*인|three\s+(?:voices|vocalists|singers)|four\s+(?:voices|vocalists|singers)/i.test(directiveText);
  if (info.isSolo) return false;
  return info.total >= 3 || (explicitLargeGroup && !explicitDuo);
}


function normalizeVocalRepeatedTokens(value: string): string {
  let line = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '));
  const repeatedCuePattern = /\b((?:laid[-\s]?back|groove[-\s]?aware|breath[-\s]?heavy|high[-\s]?pitched|low[-\s]?pitched|dreamy|warm|soft|bright|dark|airy|nasal|rhythmic|soulful|emotional|restrained|intimate|smooth|groovy|melodic|natural|clear|hollow|fragile|powerful|energetic|raw|gentle|deep|heavy|slightly\s+distorted)\s+(?:groove|phrasing|delivery|tone|feeling|emotion|restraint|tension|color|texture|runs|vibrato|breath|projection|lift))\s+\1\b/gi;
  for (let i = 0; i < 3; i += 1) {
    line = line
      .replace(/\b([A-Za-z][A-Za-z'-]*)\s+\1\b/gi, '$1')
      .replace(repeatedCuePattern, '$1')
      .replace(/\b(groove|phrasing|delivery|tone|feeling|emotion|restraint|tension|color|texture|runs|vibrato|breath|projection|lift)\s+\1\b/gi, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return cleanupPromptTail(line);
}

function dedupeRepeatedVocalCuePhrases(value: string): string {
  let line = normalizeVocalRepeatedTokens(value);
  const match = line.match(/^(.*?\bwith\b)\s+(.+)$/i);
  if (!match) return line;
  const head = cleanupPromptTail(match[1]);
  const tail = cleanupPromptTail(match[2]);
  const parts = tail
    .split(/,\s*|\s+and\s+/i)
    .map((part) => normalizeVocalRepeatedTokens(part))
    .filter(Boolean);
  if (parts.length < 2) return line;

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase()
      .replace(/\bstory[-\s]?aware\s+expression\b/g, '')
      .replace(/\bwith\b/g, '')
      .replace(/[^a-z0-9&+\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  if (unique.length === parts.length) return line;
  return cleanupPromptTail(`${head} ${joinPromptPhrase(unique, 'and')}`);
}

function compactFiveLineVocalsValue(value: string, params: GenerateSongParams): string {
  let line = dedupeRepeatedVocalCuePhrases(cleanupPromptTail(String(value || '').replace(/\s+/g, ' ')))
    .replace(/\bwith\s+([^,]+?)\s+with\s+/gi, 'with $1, ')
    .replace(/\band\s+story-aware\s+expression\s+and\s+story-aware\s+expression\b/gi, 'and story-aware expression')
    .replace(/\bstory-aware\s+expression\s+and\s+story-aware\s+expression\b/gi, 'story-aware expression')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .trim();

  const isLargeGroup = shouldApplyLargeGroupVocalCompression(params);
  const maxCueCount = isLargeGroup ? 4 : 8;

  const compressVocalCueTail = () => {
    const match = line.match(/^(.*?\bwith\b)\s+(.+)$/i);
    if (!match) return;
    const head = cleanupPromptTail(match[1]);
    const rawBody = match[2]
      .replace(/\s+and\s+story-aware\s+expression\b/gi, '')
      .replace(/\bstory-aware\s+expression\b/gi, '')
      .replace(/\bwith\s+/gi, ', ')
      .split(/,\s*|\s+and\s+with\s+|\s+and\s+/i)
      .map((part) => cleanupPromptTail(part))
      .filter(Boolean);
    const picked: string[] = [];
    for (const part of rawBody) {
      const key = part.toLowerCase()
        .replace(/\b(?:natural|vocal|vocals|delivery|phrasing|feeling|tone|expression|story-aware)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!key) continue;
      if (picked.some((item) => {
        const existing = item.toLowerCase();
        return existing.includes(key) || key.includes(existing.replace(/\b(?:delivery|phrasing|tone)\b/g, '').trim());
      })) continue;
      picked.push(part);
      if (picked.length >= maxCueCount) break;
    }
    const tail = picked.join(', ');
    line = cleanupPromptTail(`${head} ${tail}`);
  };

  // Only 3+ member group vocals need a hard length guard.
  // Solo and duo vocals must NOT be compressed by length; they may carry richer
  // tone/phrasing contrast. If a solo/duo line is malformed, the final validator
  // repairs it by rewriting a short natural sentence instead of slicing it.
  const cueTail = line.match(/\bwith\b\s+(.+)$/i)?.[1] || '';
  const cueCount = cueTail ? cueTail.split(/,\s*|\s+and\s+/i).filter((part) => cleanupPromptTail(part)).length : 0;
  if (isLargeGroup && (line.length > 205 || cueCount > maxCueCount + 1)) {
    compressVocalCueTail();
  }

  line = line
    .replace(/\bwith\s+([^,]+),\s*\1\b/gi, 'with $1')
    .replace(/\bwith\s+(Vulnerable|Soulful|Clear|Breathy|Soft|Powerful|Deep|Dramatic|Airy|Warm|Bright),/gi, 'with $1')
    .replace(/\s+and\s+story-aware\s+expression\b/gi, '')
    .replace(/,\s*story-aware\s+expression\b/gi, '')
    .replace(/\bstory-aware\s+expression\b/gi, '')
    .replace(/,\s*and\s*$/i, '')
    .replace(/\bwith\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const info = getVocalModeInfo(params.vocal);
  const multiLimit = info.total >= 3 ? 340 : 620;
  if (info.isMulti && (line.length > multiLimit || /voice character:/i.test(line))) {
    const compressed = buildRuleBasedCompressedMultiVocals(params);
    if (compressed) line = compressed;
  }

  return dedupeRepeatedVocalCuePhrases(cleanupPromptTail(line)) || 'Natural vocal with emotional delivery';
}



function isGenericVocalFallbackLine(value: string): boolean {
  const line = cleanupPromptTail(String(value || '')).toLowerCase();
  if (!line) return true;
  return /^(?:natural\s+)?(?:solo\s+)?(?:female\s+|male\s+)?vocal\s+with\s+natural\s+emotional\s+delivery$/.test(line)
    || /^natural\s+vocal\s+with\s+natural\s+emotional\s+delivery$/.test(line)
    || /^natural\s+vocal\s+with\s+emotional\s+delivery$/.test(line)
    || /^natural\s+(?:solo\s+)?vocal\s+with\s+natural\s+delivery$/.test(line);
}

function buildInterpretiveSoloVocalFallbackLine(value: string, params: GenerateSongParams, interpreted: ThemeMoodInterpretation): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isSolo) return value;

  const line = cleanupPromptTail(value);
  const lower = line.toLowerCase();
  const isWeakLine = isGenericVocalFallbackLine(line)
    || /^natural\s+vocal\s+with\s+/.test(lower)
    || /^natural\s+solo\s+vocal\s+with\s+natural\s+emotional\s+delivery/i.test(line);

  // If the line already carries a genre-specific vocal color and at least one
  // emotional/phrasing cue, keep it. This repair is only for thin fallback vocals.
  if (!isWeakLine && /\b(vibrato|phrasing|tone|breath|restraint|tension|warmth|fragile|chant|rubato|runs|resonance|delivery)\b/i.test(line)) {
    return value;
  }

  const soloMember = params.vocal?.members?.[0];
  const gender = soloMember?.gender === 'female'
    ? 'female'
    : soloMember?.gender === 'male'
      ? 'male'
      : info.gender === 'female'
        ? 'female'
        : info.gender === 'male'
          ? 'male'
          : 'solo';
  const subjectSeed = gender === 'female' ? 'female vocal' : gender === 'male' ? 'male vocal' : 'solo vocal';
  const subject = selectedGenreVocalSubject(params, subjectSeed);

  const genreDefault = compactVocalCueAfterSubject(getGenreDefaultVocalPhrase(params));
  const performance = buildSelectedVocalPerformancePhrase(params, 4);
  const artistAccent = buildArtistReferenceVocalAccent(params);
  const intentCue = buildSoloVocalSongInterpretationCue(params, interpreted);
  const moodCue = interpreted.vocalCue;
  const atmosphereCue = interpreted.atmosphereCue
    ? `carrying ${interpreted.atmosphereCue.replace(/^(?:a|an)\s+/i, '').replace(/\s+scene\b/i, ' atmosphere')}`
    : '';

  const parts = dedupePromptParts([
    genreDefault,
    performance,
    artistAccent,
    moodCue,
    intentCue,
    atmosphereCue,
    'single lead vocal focus',
  ], 7).filter(Boolean);

  if (!parts.length) return value;
  return compactFiveLineVocalsValue(
    normalizeVocalPromptEmotion(`${subject} with ${joinPromptPhrase(parts, 'and')}`, params),
    params,
  );
}

function buildSoloInterpretiveVocalLine(baseLine: string, params: GenerateSongParams, interpreted: ThemeMoodInterpretation): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isSolo) return baseLine;

  const soloMember = params.vocal?.members?.[0];
  const hasCharacterCue = soloMember ? hasVocalCharacterSelection(soloMember) : false;
  if (!hasCharacterCue) return baseLine;

  const base = cleanupPromptTail(baseLine);
  if (!base) return baseLine;

  const songInterpretationCue = buildSoloVocalSongInterpretationCue(params, interpreted);
  const interpretationParts = dedupePromptParts([
    interpreted.vocalCue ? `${interpreted.vocalCue}` : '',
    songInterpretationCue,
  ], 3)
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean)
    .slice(0, 2);

  if (!interpretationParts.length) return base;

  const alreadyCovered = interpretationParts.every((part) =>
    base.toLowerCase().includes(part.toLowerCase().replace(/^carrying\s+/i, '').slice(0, 24)),
  );
  if (alreadyCovered) return base;

  return cleanupPromptTail(`${base}, ${joinPromptPhrase(interpretationParts, 'and')}`);
}


function stabilizeSoloCharacterVocalsLine(value: string, params: GenerateSongParams): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isSolo) return value;

  const soloMember = params.vocal?.members?.[0];
  if (!soloMember || !hasVocalCharacterSelection(soloMember)) return value;

  const line = cleanupPromptTail(value);
  const characterPrompt = cleanupPromptTail(buildVocalCharacterPrompt(soloMember, params, false));
  if (!characterPrompt) return value;

  const characterParts = characterPrompt
    .split(/,\s*|\s+and\s+/i)
    .map((part) => cleanupPromptTail(part).toLowerCase())
    .filter((part) => part.length >= 5)
    .slice(0, 6);
  const lowerLine = line.toLowerCase();
  const hasCharacterTrace = characterParts.some((part) => lowerLine.includes(part.slice(0, Math.min(22, part.length))));
  const isGenericSoloFallback = /\bnatural\s+(?:female\s+|male\s+)?vocal\s+with\s+natural\s+emotional\s+delivery\b/i.test(line)
    || /\bnatural\s+emotional\s+delivery\b/i.test(line)
    || (!/\bsolo\b/i.test(line) && /\b(?:female|male)\s+vocal\b/i.test(line));

  if (!isGenericSoloFallback && hasCharacterTrace) return line;

  const gender = soloMember?.gender === "female"
    ? "female"
    : soloMember?.gender === "male"
      ? "male"
      : info.gender === "female"
        ? "female"
        : info.gender === "male"
          ? "male"
          : "solo";
  const subject = gender === "female" ? "Natural female solo vocal" : gender === "male" ? "Natural male solo vocal" : "Natural solo vocal";
  const interpreted = buildThemeMoodInterpretation(params);
  const genreDefault = compactVocalCueAfterSubject(getGenreDefaultVocalPhrase(params));
  const performance = buildSelectedVocalPerformancePhrase(params, 5);
  const artistAccent = buildArtistReferenceVocalAccent(params);
  const interpretation = cleanupPromptTail(joinPromptPhrase(dedupePromptParts([
    interpreted.vocalCue,
    buildSoloVocalSongInterpretationCue(params, interpreted),
  ], 2), 'and'));

  const parts = dedupePromptParts([
    characterPrompt,
    genreDefault,
    performance,
    artistAccent,
    interpretation,
    'single lead vocal focus',
  ], 7).filter(Boolean);
  const rebuilt = cleanupPromptTail(`${subject} with ${joinPromptPhrase(parts, 'and')}`);
  return compactFiveLineVocalsValue(normalizeVocalPromptEmotion(rebuilt, params), params);
}

function buildFiveLineVocalsValue(params: GenerateSongParams, detailLayer: string): string {
  const situationActive = hasSituation(params.situation);
  const base = situationActive
    ? buildSituationVocals(params)
    : buildNaturalVocals(params, detailLayer);
  // V63: base already contains selected Vocal Line cues through
  // buildSelectedVocalPerformancePhrase(). Do not append raw style values again.
  const interpreted = buildThemeMoodInterpretation(params);
  const moodVocalCue = mergeCompactCue(interpreted.vocalCue, getEraTextureVocalCues(params), 2);
  const cleaned = situationActive
    ? sanitizeVocalDirection(base)
    : sanitizeNonSituationVocalPrompt(sanitizeVocalDirection(base));
  const withMood = moodVocalCue
    ? cleanupPromptTail(`${cleaned} with ${moodVocalCue}`)
    : cleaned;
  const interpretedForSolo = buildSoloInterpretiveVocalLine(withMood, params, interpreted);
  const compacted = compactFiveLineVocalsValue(
    applyIntentToVocalLine(normalizeVocalPromptEmotion(interpretedForSolo, params), params),
    params,
  );
  return buildInterpretiveSoloVocalFallbackLine(compacted, params, interpreted);
}

function getCompactPointSoundPrompts(pointSoundIds: string[] = []): string[] {
  return compactSoundPromptsByCategory(filterPromptSelectionIds(pointSoundIds))
    .flatMap((item) => item.split(',').map((part) => part.trim()))
    .map((item) => cleanProductionPhrase(stripRemainingKoreanForProductionPrompt(item)))
    .filter(NON_EMPTY)
    .slice(0, 4);
}

function buildPointSoundArrangementPhrase(pointSoundIds: string[] = []): string {
  const pointSounds = getCompactPointSoundPrompts(pointSoundIds);

  if (!pointSounds.length) return "";

  return `use ${joinPromptPhrase(pointSounds, 'and')} as short point accents in key transitions`;
}


function normalizeTempoForArrangement(tempoPhrase: string): string {
  return cleanupPromptTail(
    String(tempoPhrase || '')
      .replace(/^tempo\s+set\s+to\s+/i, '')
      .replace(/^tempo\s+optimized\s+around\s+/i, '')
      .trim(),
  );
}


function getGenreDefaultTempoForArrangement(params: GenerateSongParams): string {
  const bgmTempo = getInstrumentalBgmDefaultTempo(params);
  if (bgmTempo) return bgmTempo;

  const text = [
    getSelectedPrimaryGenreKey(params),
    params.genre || '',
    ...(params.subGenre ?? []),
    selectedStyleText(params, { excludeEraTexture: true }),
    params.userInput || '',
  ].join(' ').toLowerCase();

  if (/glitch/.test(text)) return '82–112 BPM';
  if (/anime|anisong|j[-_\s]?pop|utaite|alternative\s*pop/.test(text)) return '86–118 BPM';
  if (/synthwave/.test(text)) return '84–112 BPM';
  if (/city\s*pop|citypop|nu[-_\s]?disco|시티팝/.test(text)) return '94–118 BPM';
  if (/neo[-_\s]?soul|r&b|rnb|soul/.test(text)) return '70–92 BPM';
  if (/hip[-_\s]?hop|rap|trap/.test(text)) return '76–104 BPM';
  if (/ballad|발라드/.test(text)) return '62–82 BPM';
  if (/edm|dance|house|disco/.test(text)) return '108–128 BPM';
  if (/rock|록|band/.test(text)) return '96–132 BPM';
  if (/lo[-_\s]?fi|chill/.test(text)) return '70–92 BPM';
  if (/jazz/.test(text)) return '72–104 BPM';
  return '80–110 BPM';
}

function getGenreArrangementDNA(params: GenerateSongParams): string {
  const exactArrangement = getSpecificGenreArrangementCue(params);
  if (exactArrangement) return exactArrangement;
  const key = getSelectedPrimaryGenreKey(params);
  if (key === 'trot') {
    const specificRhythm = getSelectedTrotRhythmDescriptor(params);
    return `steady ${specificRhythm} rhythm, clear verse-to-chorus lift, rounded vibrato space, stage-like emotional peaks`;
  }
  const motionText = [selectedMoodText(params), selectedSoundText(params), selectedStyleText(params, { excludeEraTexture: true })].join(' ').toLowerCase();
  const gugakFusionMotion = /upbeat|업비트|808|trap|electronic|dance|전환|switch|광기/.test(motionText)
    ? 'mid-tempo janggu-driven crossover pulse, traditional melodic turns, modern low-end support, restrained fusion build'
    : 'janggu-driven crossover pulse, weighted traditional pauses, gentle traditional transitions, restrained modern fusion build';
  const map: Record<string, string> = {
    gugak_fusion: gugakFusionMotion,
    pansori: 'slow janggu-driven pulse, weighted vocal pauses, gentle traditional transitions, restrained modern crossover build',
    citypop: 'danceable Nu-Disco groove, restrained verses, soft chorus lift, polished city-pop transitions',
    jazz: 'flexible jazz-funk groove, conversational phrasing, syncopated turns, smooth instrumental breaks',
    neo_soul: 'deep-pocket groove, intimate verse space, warm harmonic lift, relaxed chorus release',
    soul: 'warm live-band groove, call-and-response phrasing, brass lifts, rich chorus harmony',
    rnb: 'slow pocket groove, close vocal space, subtle pre-chorus lift, smooth late-night transitions',
    idol: 'tight pop section contrast, clean hook lift, polished dance breaks, controlled final chorus rise',
    rock: 'band-driven build, guitar-led section lift, live drum transitions, direct chorus release',
  };
  if (map[key]) return map[key];

  const text = [key, params.genre || '', ...(params.subGenre ?? []), selectedStyleText(params, { excludeEraTexture: true })].join(' ').toLowerCase();
  if (/j[-_\s]?indie|j\s*indie|인디팝|indie\s*pop/.test(text)) return 'gentle J-indie band build, intimate verse motion, gradual emotional lift, scene-led hook';
  if (/string\s*ensemble|현악\s*합주|스트링\s*앙상블/.test(text)) return 'string-led cinematic build, measured rhythmic lift, quiet emotional turn, hopeful chorus bloom';
  if (/glitch/.test(text)) return 'glitch-pop stutter groove, sharp hook cuts, digital stop-start contrast, focused chorus impact';
  if (/reggae/.test(text)) {
    if (/resistance|저항|anxious|불안|sorrow|비통|space|우주|echo|잔향/.test(motionText + ' ' + text)) {
      return 'off-beat reggae skank groove, fretless bass movement, anxious resistance build, spacey echo breaks';
    }
    return 'off-beat reggae skank groove, bass-led sway, relaxed hook lift';
  }
  if (/darkwave/.test(text)) return 'darkwave tension build, cold rhythmic pulse, restrained hook lift';
  if (/synth\s*score|score/.test(text)) return 'cinematic synth-score build, spatial motif returns, restrained emotional release';
  if (/trance/.test(text)) return 'rising synth build, euphoric lift, focused hook';
  if (/house/.test(text)) return 'steady four-on-the-floor groove, clean club lift, focused hook';
  if (/pop[-_\s]?punk/.test(text)) return 'fast guitar-driven lift, shoutable hook, tight band breaks';
  if (/anime|anisong|j[-_\s]?pop|utaite/.test(text)) return 'anime-opening section drive, fast pre-chorus lift, high-impact hook, final chorus surge';
  if (/synthwave/.test(text)) return 'retro synth pulse, driving night rhythm, clean build into hook, cinematic bridge turn';
  if (/alternative/.test(text)) return 'alternative pop contrast, tense verse space, hook-centered lift, dynamic bridge turn';
  if (/bollywood/.test(text)) return 'Bollywood pop lift, rhythmic melodic turns, cinematic chorus bloom';
  return '';
}

function normalizeArrangementPart(part: string): string {
  return cleanupPromptTail(
    String(part || '')
      .replace(/\btempo\s+set\s+to\s+/gi, '')
      .replace(/\btempo\s+optimized\s+around\s+/gi, '')
      .replace(/\bdynamic progression with clear sectional contrast\b/gi, '')
      .replace(/\bclear sectional contrast\b/gi, '')
      .replace(/\bclear section contrast\b/gi, '')
      .replace(/\bstable structure\b/gi, '')
      .replace(/\bwarm structure\b/gi, '')
      .replace(/\bharmonic support\b/gi, '')
      .replace(/\bstage[-\s]?light\s+collapse\s+imagery\b/gi, 'soft collapse turn')
      .replace(/\bcollapse\s+imagery\b/gi, 'soft collapse turn')
      .replace(/\bpsychological\s+horror\s+transition\b/gi, 'subtle psychological turn')
      .replace(/\bhorror\s+transition\b/gi, 'dark emotional turn')
      .replace(/\bclear\s+contrast\s+between\s+sections\s+and\s+cinematic\s+scene-building\s+lift\b/gi, 'clear section contrast')
      .replace(/\btight\s+pop\s+section\s+contrast\b/gi, 'tight section contrast')
      .replace(/\bclear\s+contrast\s+between\s+sections\b/gi, 'clear section contrast')
      .replace(/\bcontrolled\s+final\s+chorus\s+rise\b/gi, 'controlled chorus rise')
      .replace(/\bcontrolled\s+emotional\s+turn\b/gi, 'controlled emotional turn')
      .replace(/\bgentle transitions\b/gi, 'gentle traditional transitions')
      .replace(/\bseamless\b/gi, '')
      .replace(/\brelaxed pacing\b/gi, '')
      .replace(/\bsmooth\b\s*,?\s*\beffortless\b/gi, '')
      .replace(/\beffortless\b/gi, '')
      .replace(/\s+,/g, ',')
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/^,\s*/, '')
      .replace(/,\s*$/, ''),
  );
}

function shouldKeepArrangementPart(part: string): boolean {
  const cleaned = String(part || '').trim().toLowerCase();
  if (!cleaned) return false;
  if (/^(and|with|the|a|an)$/i.test(cleaned)) return false;
  if (/^(clear sectional contrast|stable structure|warm structure|harmonic support|smooth|effortless|seamless|relaxed pacing)$/i.test(cleaned)) return false;
  return cleaned.length > 2;
}


function compactArrangementSemanticParts(parts: string[]): string[] {
  const semanticKind = (part: string) => {
    const lower = part.toLowerCase();
    if (/^\d+\s*[–-]\s*\d+\s*bpm$/.test(lower)) return 'tempo';
    if (/cute[-\s]?to[-\s]?(madness|obsessive)|obsessive tension/.test(lower)) return 'cute-switch';
    if (/sudden section flips|stage[-\s]?switch|section[-\s]?switch/.test(lower)) return 'section-switch';
    if (/scene-building lift|gradual lift|pre[-\s]?chorus lift|chorus lift|chorus rise|emotional turn|build-up lift|clean hook lift|section contrast|soft emotional release|final chorus/.test(lower)) return 'structural-lift';
    if (/focused hook|hook returns|hook-centered|hook payoffs|catchy hook|minimalist phrase-led hook|phrase-led hook|contradictory hook|cracked final hook|shoutable hook|final confession hook/.test(lower)) return 'hook';
    return 'other';
  };

  const mergeCuteSwitchIntent = (items: string[]): string[] => {
    if (!items.length) return [];
    const text = items.join(' ').toLowerCase();
    if (/madness|광기/.test(text) && /obsessive|집착/.test(text)) return ['cute-to-madness switch with obsessive undertow'];
    if (/madness|광기/.test(text)) return ['cute-to-madness switch'];
    if (/obsessive|집착/.test(text)) return ['cute-to-obsessive tension'];
    return [items[0]];
  };

  const mergeSwitchIntent = (sectionSwitches: string[], cuteSwitches: string[]): string[] => {
    const cute = mergeCuteSwitchIntent(cuteSwitches);
    if (cute.length && sectionSwitches.length) {
      const text = `${sectionSwitches.join(' ')} ${cute.join(' ')}`.toLowerCase();
      if (/sudden|stage|section|flip|switch|전환/.test(text)) {
        return [cute[0].replace(/\s*$/, ' section turn')];
      }
    }
    return [...cute, ...sectionSwitches.slice(0, cute.length ? 0 : 1)];
  };

  const mergeStructuralLiftIntent = (items: string[]): string[] => {
    if (!items.length) return [];
    if (items.length <= 2) return items;

    const text = items.join(' ').toLowerCase();
    const gradual = /gradual|delayed|slow|pre[-\s]?chorus|build/.test(text);
    const cinematic = /cinematic|scene/.test(text);
    const finalChorus = /final|chorus rise|final chorus|controlled chorus/.test(text);
    const emotional = /emotional|confession|release|turn/.test(text);
    const contrast = /section contrast|clear section|tight section/.test(text);

    if (gradual && /confession/.test(text) && finalChorus) return ['gradual lift toward a final confession hook'];
    if (cinematic && gradual && finalChorus) return ['gradual cinematic lift toward a controlled final chorus'];
    if (cinematic && gradual) return ['gradual cinematic scene-building lift'];
    if (gradual && finalChorus) return ['gradual lift toward a controlled final chorus'];
    if (contrast && finalChorus) return ['section contrast into a controlled chorus rise'];
    if (emotional && gradual) return ['gradual emotional lift'];

    // If the user selected several similar lift/turn cues, preserve the emphasis
    // as one stronger direction rather than deleting it as duplicate noise.
    return [items[0]];
  };

  const grouped = {
    tempo: [] as string[],
    other: [] as string[],
    hook: [] as string[],
    structural: [] as string[],
    cute: [] as string[],
    sectionSwitch: [] as string[],
  };

  for (const part of parts) {
    const kind = semanticKind(part);
    if (kind === 'tempo') grouped.tempo.push(part);
    else if (kind === 'hook') grouped.hook.push(part);
    else if (kind === 'structural-lift') grouped.structural.push(part);
    else if (kind === 'cute-switch') grouped.cute.push(part);
    else if (kind === 'section-switch') grouped.sectionSwitch.push(part);
    else grouped.other.push(part);
  }

  const mergedSwitch = mergeSwitchIntent(grouped.sectionSwitch, grouped.cute);
  const mergedStructural = mergeStructuralLiftIntent(grouped.structural);

  // Keep different musical roles. Only combine cues that are truly doing the same job.
  // This lets dense selections read as a stronger composition plan instead of being erased.
  const maxOther = 5;
  const tempo = grouped.tempo.slice(0, 1);
  const hook = grouped.hook.slice(0, 2);
  return [
    ...tempo,
    ...grouped.other.slice(0, maxOther),
    ...mergedSwitch,
    ...mergedStructural,
    ...hook,
  ];
}

function normalizeArrangementLine(parts: string[]): string {
  const normalized = parts
    .flatMap((part) => String(part || '').split(','))
    .map(normalizeArrangementPart)
    .filter(shouldKeepArrangementPart);

  const unique: string[] = [];
  normalized.forEach((part) => {
    const key = part.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim();
    if (!key || unique.some((existing) => existing.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim() === key)) return;
    unique.push(part);
  });

  const compacted = compactArrangementSemanticParts(unique);
  return cleanupPromptTail(mergeHookArrangementParts(compacted).join(', '));
}


function buildMoodTransitionSectionInstruction(params: GenerateSongParams, exactStructureText: string): string {
  const transitionCue = compactMoodTransitionCue(params);
  if (!transitionCue) return "";
  const hasExplicitOrder = exactStructureText.includes("→");
  const placementLine = hasExplicitOrder
    ? `- The song structure already contains the required transition placement:\n${exactStructureText}`
    : `- Insert one transition event in the middle-late structure, preferably [Stop] then [Bridge: ${transitionCue}] before Final Chorus or the final hook.`;
  return `MOOD TRANSITION SECTION RULE (MANDATORY):
- The selected mood-transition is a SECTION EVENT, not a global Atmosphere keyword.
- Use this transition cue only at the selected transition section as a short natural section tag: ${transitionCue}.
${placementLine}
- Do NOT add another Stop if a Stop already appears immediately before the transition Bridge.
- If multiple Bridge sections exist, only ONE Bridge may carry this transition tag: the middle-late Bridge closest to Final Chorus or the one already marked as the transition point.
- Do NOT write [Stop] [Stop] [Bridge]. Never duplicate Stop.
- Do not spread the transition cue across every section; keep it localized to that Bridge or equivalent transition section.`;
}

function buildPointSoundSectionInstruction(params: GenerateSongParams): string {
  const pointSounds = getCompactPointSoundPrompts(params.pointSounds ?? []);
  if (!pointSounds.length) return "";

  const cueList = pointSounds.join(', ');
  const isCustom = params.songStructure === 'custom' && (params.customStructure ?? []).length > 0;

  if (isCustom) {
    return `POINT SOUND SECTION CUES (CUSTOM MODE):
- Available point sound cues selected in Sound Point Mode: ${cueList}.
- These are sound/stage cues only. Do NOT turn them into lyric words, story topics, metaphors, or repeated hook phrases.
- If one of these cues appears in the custom section tags, keep it as a short English section tag or immediate parenthetical sound cue only.
- Section sound cues must stay in English parentheticals/tags, even when the lyrics are Korean.
- Do not add extra point sound cues to sections where the user did not place them.`;
  }

  return `POINT SOUND SECTION CUES (AUTO MODE):
- Selected point sound cues: ${cueList}.
- These are sound/stage cues only. Do NOT turn them into lyric words, story topics, metaphors, or repeated hook phrases.
- Automatically place them as short English section cues in only 1-2 sections total.
- Allowed automatic sections only: Intro, Bridge, Breakdown, Instrumental, Outro.
- Do not place these cues in Verse, Pre-Chorus, Chorus, Final Chorus, Hook, or Rap Section unless custom mode explicitly places them there.
- Instrumental sections may use these cues, but never add lyric lines inside an instrumental-only section.
- Never invent unselected Foley/SFX such as doors, clocks, sirens, footsteps, typing, or radio noise.`;
}

function mergeHookArrangementParts(parts: string[]): string[] {
  const hookParts = parts.filter((part) => /\b(hook|chorus)\b/i.test(part));
  if (hookParts.length <= 1) return parts;

  const nonHookParts = parts.filter((part) => !/\b(hook|chorus)\b/i.test(part));
  const text = hookParts.join(' ').toLowerCase();
  const descriptors: string[] = [];
  const add = (value: string) => {
    if (!descriptors.includes(value)) descriptors.push(value);
  };

  if (/minimal/.test(text)) add('minimalist');
  if (/phrase[-\s]?led|phrase/.test(text)) add('phrase-led');
  if (/singalong|easy[-\s]?to[-\s]?sing|떼창/.test(text)) add('singalong');
  if (/catchy|addictive|중독|memorable/.test(text)) add('catchy');
  if (/repeat|repeating|반복/.test(text)) add('repeating');
  if (/chant|챈트/.test(text)) add('chant-like');
  if (/strong|power|강/.test(text)) add('strong');

  const preferChorus = /chorus/.test(text) && /singalong|catchy|easy[-\s]?to[-\s]?sing/.test(text);
  const merged = `${descriptors.slice(0, 4).join(' ') || 'focused'} ${preferChorus ? 'chorus' : 'hook'}`
    .replace(/\bminimalist\s+phrase-led\s+hook\b/i, 'minimalist phrase-led hook')
    .replace(/\bcatchy\s+singalong\s+chorus\b/i, 'catchy singalong chorus')
    .replace(/\brepeating\s+phrase-led\s+hook\b/i, 'repeating phrase-led hook')
    .replace(/\bstrong\s+chant-like\s+hook\b/i, 'strong chant-like hook')
    .trim();

  return [...nonHookParts, merged];
}

function buildFiveLineArrangementValue(
  params: GenerateSongParams,
  resolvedStructure: SongStructure,
  variation: CreativeVariationSeed,
): string {
  const situationActive = hasSituation(params.situation);
  const scenePlan = buildInternalScenePlan(params, params.userInput || "");
  const reinterpretationLayer = buildGenreReinterpretationLayer(params, params.userInput || "");
  // Keep BPM in [Arrangement]. If the UI did not pass an explicit/random tempo,
  // use a compact genre-based fallback so the final prompt does not lose tempo guidance.
  const tempo = normalizeTempoForArrangement(buildTempoPromptPhrase(params)) || getGenreDefaultTempoForArrangement(params);
  const genreDNA = getGenreArrangementDNA(params);
  const directDirectorArrangement = isFreeTextPrimaryMode(params)
    ? buildFreeTextDirectorProfile(params.userInput || "").arrangement
    : '';
  const situationArrangement = situationActive ? buildSituationArrangement(params) : '';
  const rawVariationMeaning = !hasUserPrimaryStoryText(params) && !isWarHistoricalContext(params) && shouldUseVariationAtmosphereLens(variation, params, params.userInput || '')
    ? variationArrangementMeaning(variation)
    : '';
  const variationMeaning = /delayed image reveal|image reveal/i.test(rawVariationMeaning)
    ? ''
    : rawVariationMeaning;
  const styleArrangement = situationActive
    ? ""
    : joinPromptPhrase(getStylePromptValuesByRole(params.styles ?? [], 'arrangement', 'style').slice(0, 2), 'and');
  const pointSoundArrangement = buildPointSoundArrangementPhrase(params.pointSounds ?? []);
  const customFlow =
    params.songStructure === "custom" && (params.customStructure ?? []).length > 0
      ? "custom section flow"
      : "";
  const interpretedArrangement = mergeCompactCue(buildThemeMoodInterpretation(params).arrangementCue, getEraTextureArrangementCues(params), 3);
  const directStoryArrangement = getDirectStoryArrangementCues(params).join(', ');

  const parts = [
    tempo,
    pointSoundArrangement,
    situationArrangement,
    directStoryArrangement,
    directDirectorArrangement,
    genreDNA,
    styleArrangement,
    !situationActive ? scenePlan.arrangementCues.join(', ') : '',
    reinterpretationLayer.arrangementLens,
    interpretedArrangement,
    variationMeaning,
    customFlow,
  ];

  const line = normalizeArrangementLine(parts)
    .replace(/\bstage[-\s]?light\s+collapse\s+imagery\b/gi, 'soft collapse turn')
    .replace(/\bcollapse\s+imagery\b/gi, 'soft collapse turn');

  if (line) return applyIntentToArrangementLine(line, params);

  const fallback = normalizeArrangementLine([
    tempo,
    genreDNA,
    cleanPromptValue(buildArrangement(params, resolvedStructure)),
  ]);

  return applyIntentToArrangementLine(fallback || cleanupPromptTail([tempo, 'genre-led section flow'].filter(Boolean).join(', ')), params);
}

function compactFiveLinePromptBody(lines: string[]): string[] {
  // SORIDRAW_V52: Do not hard-cut the five-line prompt.
  // Earlier character limits produced unfinished phrases such as "instead of" or "while the other".
  // Keep full lines and only normalize whitespace/tails.
  return lines.map((line) => cleanupPromptTail(String(line || '').replace(/\s+/g, ' ')));
}

type StyleRecipeProfile = {
  genreLens: string;
  productionLens: string;
  arrangementLens: string;
};

function selectedStyleText(
  params: GenerateSongParams,
  options: { excludeEraTexture?: boolean } = {},
): string {
  return (params.styles ?? [])
    .map((id) => {
      const item = resolveStyleItem(id);
      if (!item) return "";
      // Era Texture is a secondary production/era color. It must not trigger
      // broad genre detectors such as idol/EDM/R&B as if it were the main genre.
      if (options.excludeEraTexture && isEraTextureStyleItem(item)) return "";
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
    .filter(Boolean)
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
    genreLens: cleanupPromptTail(limitText(genreLens, 115)),
    productionLens: cleanupPromptTail(limitText(productionLens, 105)),
    arrangementLens: cleanupPromptTail(limitText(arrangementLens, 85)),
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


function normalizeDirectInputText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^#+\s*/, "")
    .trim();
}

function isLikelyDirectUserText(value: unknown): boolean {
  const raw = normalizeDirectInputText(value);
  if (!raw) return false;
  const compact = raw.replace(/\s+/g, "");
  if (compact.length >= 9) return true;
  if (/\d|[.!?]|,|\/|·|:|;|~/.test(raw)) return true;
  if (/[가-힣]+(?:을|를|이|가|은|는|에|에게|에서|으로|처럼|까지|부터|하고|하며|해서|못해|못한|없는|있는|하는|되는|느낌|마음|상황|장면)/.test(raw)) return true;
  if (/\b(?:about|where|when|because|without|with|missing|lost|cannot|can't|feeling|scene|story)\b/i.test(raw)) return true;
  return false;
}

function getDirectThemeInputText(params: GenerateSongParams): string {
  const anyParams = params as any;
  const values = [
    anyParams.customThemeInput,
    anyParams.customThemeText,
    anyParams.directThemeInput,
    anyParams.directThemeText,
    ...(params.themes ?? []).filter((theme) => isLikelyDirectUserText(theme)),
  ]
    .map(normalizeDirectInputText)
    .filter(Boolean);
  return Array.from(new Set(values)).join(" / ");
}

function getDirectMoodInputText(params: GenerateSongParams): string {
  const anyParams = params as any;
  const values = [
    anyParams.customMoodInput,
    anyParams.customMoodText,
    anyParams.directMoodInput,
    anyParams.directMoodText,
    ...(params.moods ?? []).filter((mood) => !resolveMoodItem(String(mood || "")) && isLikelyDirectUserText(mood)),
  ]
    .map(normalizeDirectInputText)
    .filter(Boolean);
  return Array.from(new Set(values)).join(" / ");
}

function buildDirectMoodAngle(params: GenerateSongParams): string {
  const raw = getDirectMoodInputText(params);
  if (!raw) return "";
  const parts: string[] = [];
  const add = (value: string) => {
    const cleaned = cleanupPromptTail(value);
    if (cleaned && !parts.some((part) => part.toLowerCase() === cleaned.toLowerCase())) parts.push(cleaned);
  };

  if (/(웃|코믹|장난|능청|병맛|funny|comic|playful|quirky)/i.test(raw)) add("comic");
  if (/(답답|막막|갑갑|frustrat|stuck|blocked)/i.test(raw)) add("boxed-in frustration");
  if (/(점점|갈수록|서서히|slowly|gradually)/i.test(raw) && /(진심|serious|sincere)/i.test(raw)) add("slowly turning sincere");
  if (/(진심|sincere|serious)/i.test(raw)) add("sincere pressure");
  if (/(애틋|아련|그리움|wistful|tender|longing)/i.test(raw)) add("wistful tenderness");
  if (/(불안|초조|긴장|anxious|tense|nervous)/i.test(raw)) add("anxious tension");
  if (/(차분|담담|calm|restrained|quiet)/i.test(raw)) add("restrained calm");
  if (/(몽환|흐릿|꿈|dream|hazy|blurred)/i.test(raw)) add("dreamy haze");
  if (/(따뜻|포근|warm|cozy)/i.test(raw)) add("warmth");
  if (/(어둡|서늘|차가|dark|cold)/i.test(raw)) add("cold dark undertone");

  if (!parts.length) return "user-defined emotional temperature";
  return joinPromptPhrase(parts.slice(0, 3), "and");
}

function buildDirectInputProtectionInstruction(params: GenerateSongParams): string {
  const directTheme = getDirectThemeInputText(params);
  const directMood = getDirectMoodInputText(params);
  if (!directTheme && !directMood && !String(params.userInput || "").trim()) return "";

  const lines: string[] = [];
  lines.push("DIRECT INPUT PROTECTION (MANDATORY):");
  if (directTheme) {
    lines.push(`- Direct theme/topic input: ${directTheme}`);
    lines.push("- Treat the direct theme/topic as the main event, object, conflict, and story seed, even if it is private, strange, niche, comedic, trivial, or very personal. Do not normalize it into a standard template.");
    lines.push("- Do not replace it with a generic cue-bank scene or prewritten story pattern unless that exact idea is explicitly in the direct input.");
    lines.push("- Selected keyword cards may color genre, sound, mood, and pacing only. They must not rewrite the direct topic into a different story.");
  }
  if (directMood) {
    lines.push(`- Direct mood/atmosphere input: ${directMood}`);
    lines.push("- Treat the direct mood as the emotional temperature, air pressure, character behavior, and pacing. Do not convert it into a new lyric topic, fixed plot template, or random relationship arc.");
    lines.push("- Mood card selections are secondary when a direct mood sentence exists; blend them gently only if they do not conflict with the direct mood.");
  }
  if (String(params.userInput || "").trim()) {
    lines.push("- User free-text director note remains higher priority than automatic cue-bank inference.");
  }
  lines.push("- Lyrics must turn direct input into concrete character behavior and lived details first, then use selected keywords as production/supporting color.");
  return lines.join("\n");
}

type ThemeMoodInterpretation = {
  atmosphereCue: string;
  vocalCue: string;
  arrangementCue: string;
  lyricSceneCue: string;
  lyricDetailCue: string;
  strength: "weak" | "normal" | "strong";
};

function selectedThemeText(params: GenerateSongParams): string {
  return (params.themes ?? [])
    .map((theme) => stripRemainingKoreanForProductionPrompt(theme || ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function selectedMoodText(params: GenerateSongParams): string {
  return getMoodWordsForMusicDirection(params).join(" ").toLowerCase();
}

function selectedSoundText(params: GenerateSongParams): string {
  return [
    ...getCompactPointSoundPrompts(params.pointSounds ?? []),
    ...getInstrumentSoundPromptItems(params.instrumentSounds ?? []).map((item) => `${item.labelKo || ''} ${item.prompt || ''}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


type AtmosphereSceneLayers = {
  place: string;
  story: string;
  emotion: string[];
  intensity: string;
  detail: string[];
};

const ATMOSPHERE_PLACE_RULES: Array<[RegExp, string, string[]]> = [
  [/바다|해변|파도|sea|ocean|shore|beach/i, 'seaside', ['sea air', 'quiet waves', 'washed-away footprints']],
  [/정류장|버스|station|bus stop/i, 'late-night bus stop', ['passing lights', 'a paused step', 'unanswered silence']],
  [/지하철|subway|metro/i, 'subway ride', ['passing windows', 'cold handles', 'crowded silence']],
  [/골목|거리|street|alley/i, 'small street', ['dim signs', 'slow footsteps', 'familiar corners']],
  [/편의점|convenience/i, 'convenience-store night', ['fluorescent light', 'plastic bags', 'warmed-up food']],
  [/방|room|bedroom/i, 'private room', ['window light', 'quiet stillness', 'small objects']],
  [/회사|직장|office|work/i, 'office after-hours', ['office lights', 'empty desks', 'last train time']],
  [/차안|자동차|drive|car/i, 'night drive', ['dashboard light', 'passing tunnels', 'quiet seats']],
  [/카페|cafe|coffee/i, 'small cafe', ['cooling coffee', 'table edges', 'window seats']],
  [/옥상|rooftop/i, 'rooftop night', ['open air', 'city glow', 'held-back words']],
  [/우주|지구|astronaut|space|earth/i, 'distant space', ['blue Earth', 'helmet view', 'fading signal']],
  [/(?:^|[\s,])비(?:[\s,]|$)|비가|비\s*오는|빗|rain|rainy/i, 'rainy everyday scene', ['wet pavement', 'window drops', 'damp air']],
];

const ATMOSPHERE_STORY_RULES: Array<[RegExp, string, string[]]> = [
  [/화해|reconciliation|reconcile/i, 'reconciliation', ['a careful first step toward each other']],
  [/오해|misunderstanding/i, 'unresolved misunderstanding', ['words that never landed right']],
  [/고백|confession|crush|짝사랑/i, 'held-back confession', ['held-back words', 'awkward timing']],
  [/이별|breakup|goodbye/i, 'breakup aftermath', ['what remains after goodbye']],
  [/재회|다시\s*만|reunion|meet again/i, 'reunion after distance', ['a familiar face returning', 'words saved for later']],
  [/가족|family/i, 'family bond', ['old habits at home', 'a quiet shared meal']],
  [/미련|그리움|longing|lingering|memory|추억|회상/i, 'lingering memory', ['a name almost spoken']],
  [/기다림|waiting/i, 'waiting', ['time stretching too long']],
  [/꿈|성장|변화|freedom|자유|growth|change/i, 'quiet change', ['one brave step forward']],
  [/야근|월요일|퇴근|회사생활|work|office/i, 'tired daily escape', ['small freedom after work']],
  [/사랑|love/i, 'tender affection', ['small signs of affection']],
  [/저항|resistance|rebel|rebellion/i, 'restless resistance', ['words pushed against pressure']],
  [/불화|갈등|conflict/i, 'soft conflict', ['a distance that will not close']],
];

const ATMOSPHERE_EMOTION_RULES: Array<[RegExp, string]> = [
  [/외로움|외로운|lonely|loneliness/i, 'lonely air'],
  [/희망|hope|hopeful/i, 'cautious hope'],
  [/따뜻|warm/i, 'warmth'],
  [/차가|cold/i, 'cold distance'],
  [/아련|wistful/i, 'wistful aftertaste'],
  [/쓸쓸|melanchol|sad|sadness/i, 'quiet sadness'],
  [/몽환|dreamy|dreamlike/i, 'dreamlike haze'],
  [/밝|bright/i, 'soft brightness'],
  [/어두|dark/i, 'dark undertone'],
  [/마법|magical|fantasy/i, 'magical uncertainty'],
  [/소울풀|soulful/i, 'soulful warmth'],
  [/캐치한|catchy/i, 'catchy lift'],
  [/비통|sorrow|grief|grieving/i, 'soulful pain'],
  [/무디|moody/i, 'moody shadow'],
  [/그루비|groovy|groove/i, 'groovy pulse'],
  [/쾌활|cheerful/i, 'cheerful contrast'],
  [/감정 고조|emotional|emotion/i, 'emotional lift'],
];

const ATMOSPHERE_INTENSITY_RULES: Array<[RegExp, string]> = [
  [/위태|fragile|unstable|불안정/i, 'fragile'],
  [/긴장|긴장감|tense|tension/i, 'tense'],
  [/불안|anxious|anxiety/i, 'anxious'],
  [/잔잔|calm|peaceful|차분/i, 'quiet'],
  [/강렬|폭발|burst|explosive|climax/i, 'intense'],
  [/부드럽|soft|gentle/i, 'soft'],
  [/레트로|retro|vintage/i, 'vintage-tinted'],
];

function collectAtmosphereSourceText(params: GenerateSongParams): string {
  const situation = params.situation;
  return [
    ...(params.themes ?? []),
    ...(params.moods ?? []),
    params.userInput || '',
    params.lyricDraft || '',
    situation?.targetA || '',
    situation?.targetB || '',
    situation?.relationship || '',
    situation?.description || '',
    situation?.summary || '',
    situation?.development || '',
    situation?.developmentPreset || '',
    situation?.developmentCustom || '',
    situation?.detailCustom || '',
    situation?.details || '',
    ...(situation?.detailPresets || []),
  ].filter(Boolean).join(' ');
}

function pickAtmosphereLayer(text: string, rules: Array<[RegExp, string] | [RegExp, string, string[]]>): string {
  const matched = rules.find(([pattern]) => pattern.test(text));
  return matched ? matched[1] : '';
}

function pickAtmosphereEmotionLayers(text: string, moodAngle = ''): string[] {
  const values: string[] = [];
  const add = (value: string) => {
    const cleaned = cleanupPromptTail(value);
    if (cleaned && !values.some((item) => item.toLowerCase() === cleaned.toLowerCase())) values.push(cleaned);
  };

  ATMOSPHERE_EMOTION_RULES.forEach(([pattern, value]) => {
    if (pattern.test(text)) add(value);
  });

  cleanupPromptTail(moodAngle)
    .split(/\s+and\s+|,/) 
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      if (values.length < 2 && !/mood|feeling|color/i.test(item)) add(`${item} tone`);
    });

  return values.slice(0, 3);
}

function extractAtmosphereSceneLayers(params: GenerateSongParams, moodAngle = ''): AtmosphereSceneLayers {
  const sourceText = collectAtmosphereSourceText(params);
  const lower = sourceText.toLowerCase();
  const placeMatch = ATMOSPHERE_PLACE_RULES.find(([pattern]) => pattern.test(sourceText));
  const storyMatch = ATMOSPHERE_STORY_RULES.find(([pattern]) => pattern.test(sourceText));
  const intensity = pickAtmosphereLayer(sourceText, ATMOSPHERE_INTENSITY_RULES) || (/tense|unstable|fragile|anxious/.test(moodAngle) ? moodAngle.split(/\s+/)[0] : '');

  const details: string[] = [];
  const addDetail = (value: string) => {
    const cleaned = cleanupPromptTail(value);
    if (cleaned && !details.some((item) => item.toLowerCase() === cleaned.toLowerCase())) details.push(cleaned);
  };
  (placeMatch?.[2] || []).forEach(addDetail);
  (storyMatch?.[2] || []).forEach(addDetail);

  return {
    place: placeMatch?.[1] || '',
    story: storyMatch?.[1] || '',
    emotion: pickAtmosphereEmotionLayers(`${sourceText} ${lower}`, moodAngle),
    intensity: typeof intensity === 'string' ? intensity : '',
    detail: details.slice(0, 4),
  };
}

function buildSpecificAtmosphereCombination(params: GenerateSongParams, layers: AtmosphereSceneLayers, moodAngle = '', spaceCue = ''): string {
  const text = collectAtmosphereSourceText(params).toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  const moods = `${moodAngle} ${layers.emotion.join(' ')}`.toLowerCase();
  const tail = dedupePromptParts([
    /dark|tense|cinematic|어두|긴장|시네마|영화/.test(`${text} ${moods}`) ? 'dark undertone' : '',
    /bright|upbeat|밝|쾌활|희망/.test(`${text} ${moods}`) ? 'upbeat energy' : '',
    /warm|cozy|따뜻|아늑/.test(`${text} ${moods}`) ? 'warm intimate stillness' : '',
    /dreamy|몽환|dream|드리미/.test(`${text} ${moods}`) ? 'dreamy haze' : '',
    spaceCue,
  ].filter(Boolean), 12).slice(0, 2);
  const suffix = tail.length ? `, with ${joinPromptPhrase(tail, 'and')}` : '';

  if (has(/여행|travel|drive|드라이브/) && has(/어린시절|childhood/) && has(/추억|회상|memory|reminiscence/)) {
    return cleanupPromptTail(`a healing childhood travel memory${suffix}`);
  }
  if (has(/여행|travel|drive|드라이브/) && has(/추억|회상|memory|reminiscence/)) {
    return cleanupPromptTail(`a lingering travel memory${suffix}`);
  }
  if (has(/밤|night/) && has(/혼자밥|혼자\s*밥|eating alone|solo meal/)) {
    return cleanupPromptTail(`a tense late-night solitude scene${suffix}`);
  }
  if (has(/짝사랑|crush|one-sided/) && has(/도시|city|urban|street|거리|골목/) && has(/추억|회상|memory|reminiscence/)) {
    return cleanupPromptTail(`a nostalgic one-sided love scene in a calm urban memory${suffix}`);
  }
  if (has(/퇴근|야근|회사|직장|office|work|after[-\s]?work/) && has(/소확행|small happiness|escape|위로|healing|comfort|치유|휴식|relief/) && has(/서늘|공허|차분|calm|empty|hollow|melanchol|tired|피곤|지친/)) {
    return cleanupPromptTail(`a tired after-work escape scene where small happiness cuts through calm emptiness${suffix}`);
  }
  if (has(/회사|직장|office|work|퇴근|야근/) && has(/위로|healing|comfort|치유|relief/)) {
    return cleanupPromptTail(`a quiet office after-hours recovery scene${suffix}`);
  }
  if (has(/고백|confession/) && has(/회상|추억|memory|reminiscence/) && has(/자아|self|identity/)) {
    return cleanupPromptTail(`a reflective confession scene with self-questioning memories${suffix}`);
  }
  if (has(/추억|회상|memory|reminiscence/) && has(/짝사랑|crush|one-sided/)) {
    return cleanupPromptTail(`a nostalgic one-sided love memory${suffix}`);
  }
  if (has(/저항|resistance|rebel/) && has(/불안|anxious|anxiety/) && has(/비통|sorrow|grief|소울풀|soulful|그루비|groovy/)) {
    return cleanupPromptTail(`a restless resistance scene with groovy anxiety and soulful pain${suffix}`);
  }
  if (has(/저항|resistance|rebel/) && has(/치유|healing|comfort/) && has(/추억|회상|memory/)) {
    return cleanupPromptTail(`a healing memory scene with quiet resistance${suffix}`);
  }
  if (has(/저항|resistance|rebel/) && has(/불안|anxious|anxiety/)) {
    return cleanupPromptTail(`an anxious resistance scene${suffix}`);
  }
  return '';
}

function buildAtmosphereFromSceneLayers(
  params: GenerateSongParams,
  options: { moodAngle?: string; fallbackScene?: string; spaceCue?: string } = {},
): string {
  const layers = extractAtmosphereSceneLayers(params, options.moodAngle || '');
  const compressedScene = buildSpecificAtmosphereCombination(params, layers, options.moodAngle || '', options.spaceCue || '');
  if (compressedScene) return compressedScene;
  const fallbackScene = cleanupPromptTail(options.fallbackScene || 'one concrete everyday scene');
  const fallbackPlace = fallbackScene
    .replace(/^(?:a|an|one)\s+/i, '')
    .replace(/\s+shown\s+through\s+one\s+everyday\s+incident$/i, '')
    .trim();

  const fallbackLooksLikeStory = /confession|love|memory|friendship|breakup|reunion|change|self|identity|자아|고백|회상|우정|이별|재회/i.test(fallbackPlace);
  const basePlace = layers.place || (fallbackLooksLikeStory ? 'ordinary moments' : fallbackPlace) || 'everyday scene';
  const intensityPart = layers.intensity ? `${layers.intensity} ` : '';

  const base = cleanupPromptTail(
    layers.story
      ? `a ${intensityPart}${layers.story} scene in ${basePlace}`
      : `a ${intensityPart}${basePlace} scene`,
  )
    .replace(/\bscene\s+scene\b/gi, 'scene')
    .replace(/\beveryday scene scene\b/gi, 'everyday scene')
    .replace(/\brainy everyday scene\s+scene\b/gi, 'rainy everyday scene');

  const tailParts = dedupePromptParts([
    ...layers.emotion.slice(0, 2),
    ...(options.spaceCue ? [options.spaceCue] : []),
  ].filter(Boolean), 12).slice(0, 3);

  if (tailParts.length) {
    return cleanupPromptTail(`${base}, with ${joinPromptPhrase(tailParts, 'and')}`);
  }

  if (layers.detail.length) {
    return cleanupPromptTail(`${base}, where ${joinPromptPhrase(layers.detail.slice(0, 2), 'and')} carry the feeling`);
  }

  return cleanupPromptTail(base);
}

function buildCompactMoodAngle(params: GenerateSongParams): string {
  const moods = getMoodWordsForMusicDirection(params)
    .map((mood) => cleanupPromptTail(stripRemainingKoreanForProductionPrompt(mood || "")).toLowerCase())
    .filter(Boolean);
  const text = moods.join(" ").toLowerCase();
  if (!moods.length) return "";

  if (/tense/.test(text) && /bittersweet/.test(text)) return "tense bittersweet";
  if (/upbeat/.test(text) && /melancholic/.test(text)) return "upbeat but melancholic";
  if (/bright/.test(text) && /(wistful|melancholic|lonely)/.test(text)) return "bright yet wistful";
  if (/(comic|playful)/.test(text) && /(sad|sorrow|melancholic|bittersweet)/.test(text)) return "comic but bittersweet";
  if (/playful/.test(text) && /dark/.test(text)) return "playful dark";
  if (/warm/.test(text) && /(hollow|empty|wistful)/.test(text)) return "warm but hollow";
  if (/minimal/.test(text) && /emotional/.test(text)) return "restrained emotional";
  if (/vintage/.test(text) && /warm/.test(text)) return "warm vintage";
  if (/dreamy/.test(text) && /spacious/.test(text)) return "dreamy spacious";
  if (/tense/.test(text) && /emotional/.test(text)) return "emotionally tense";
  if (/bittersweet/.test(text) && /emotional/.test(text)) return "bittersweet emotional";
  if (/warm/.test(text) && /(mood|moody|dreamy|ambient|spacious|ethereal|mystic|mysterious)/.test(text)) return "warm moody";
  if (/warm/.test(text) && /(soft|cozy|tender|relax|chill)/.test(text)) return "warm soft";
  if (/hollow|empty/.test(text) && /(dreamy|ambient|spacious)/.test(text)) return "hollow spacious";

  const compact = joinPromptPhrase(moods.slice(0, 2), "and")
    .replace(/\bmood\b/gi, "moody")
    .replace(/\bwarm\s+and\s+moody\b/gi, "warm moody")
    .replace(/\bwarm\s+and\s+feeling\b/gi, "warm feeling")
    .replace(/\bplayful\s+and\s+dark\b/gi, "playful dark")
    .replace(/\s+/g, " ");

  return cleanupPromptTail(compact);
}


function buildUserTextCoreScene(params: GenerateSongParams): { scene: string; detail: string } | null {
  // Principle-based direct input handling: do not convert specific user text
  // into fixed example scenes. The real direct text is passed to Gemini in the
  // prompt; this function only supplies a neutral scaffold for local prompt
  // assembly so keyword-only songs keep their existing flow.
  const directThemeText = getDirectThemeInputText(params);
  const directMoodText = getDirectMoodInputText(params);
  const note = [params.userInput, params.lyricDraft, directThemeText, directMoodText]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!note) return null;

  const hasTheme = Boolean(directThemeText || String(params.userInput || '').trim() || String(params.lyricDraft || '').trim());
  const hasMood = Boolean(directMoodText);

  return {
    scene: hasTheme
      ? "a concrete user-described scene shaped by the direct topic"
      : "a scene colored by the user-described mood",
    detail: hasMood
      ? "direct mood, visible behavior, emotional pressure, and section flow"
      : "direct topic, visible behavior, emotional pressure, and character-specific speech",
  };
}
function buildThemeCoreScene(params: GenerateSongParams): { scene: string; detail: string } {
  const userTextScene = buildUserTextCoreScene(params);
  if (userTextScene) return userTextScene;

  const themeText = selectedThemeText(params);
  const rawThemeText = [...(params.themes ?? []), themeText].join(" ").toLowerCase();
  const has = (pattern: RegExp) => pattern.test(rawThemeText);

  if (has(/reunion|재회/) && has(/hometown|고향/) && has(/love|사랑/)) {
    return {
      scene: "hometown reunion with an old love and unresolved feelings",
      detail: "familiar streets, a small room, changed distance, unsaid words",
    };
  }
  if (has(/friendship|우정/)) {
    return {
      scene: "old friendship seen through everyday city memories",
      detail: "old sneakers, a convenience-store bench, changed walking pace, unsaid thanks",
    };
  }
  if (has(/breakup|이별/)) {
    return {
      scene: "breakup aftermath carried by small objects left behind",
      detail: "a toothbrush, a half-folded receipt, an empty room, paused hands",
    };
  }
  if (has(/flutter|excitement|설렘|thrill|두근|떨림/)) {
    return {
      scene: "a small fluttering mistake",
      detail: "a small mismatch in behavior, trembling timing, a too-quiet room, awkward timing",
    };
  }
  if (has(/crush|짝사랑|confession|고백/)) {
    return {
      scene: "shy confession or one-sided love hidden in ordinary moments",
      detail: "held-back words, familiar distance, awkward timing, a small avoided action",
    };
  }
  if (has(/longing|그리움|waiting|기다림|memory|추억|reminiscence|회상/)) {
    return {
      scene: "lingering memory returning through familiar places",
      detail: "old photos, quiet streets, repeated routes, a name almost spoken",
    };
  }
  if (has(/work|company|after work|퇴근|야근|월요일|회사/)) {
    return {
      scene: "tired everyday life trying to find one small emotional escape",
      detail: "office lights, last train, convenience-store food, end-of-day silence",
    };
  }
  if (has(/family|가족|childhood|어린시절|home|방/)) {
    return {
      scene: "family memory and private room silence",
      detail: "old drawers, family photos, quiet hallway light, a childhood object",
    };
  }
  if (has(/freedom|자유|dream|꿈|growth|성장|change|변화|youth|청춘/)) {
    return {
      scene: "a private decision to leave an old version of the self behind",
      detail: "packed bags, open windows, a late-night road, one brave step",
    };
  }
  const layeredScene = extractAtmosphereSceneLayers(params);
  if (layeredScene.place || layeredScene.story) {
    const scene = buildAtmosphereFromSceneLayers(params).replace(/^a\s+/i, '').replace(/,\s+with\s+.*$/i, '');
    return {
      scene,
      detail: layeredScene.detail.length ? layeredScene.detail.join(', ') : "one visible object, one small action, one unsaid feeling",
    };
  }
  if (has(/travel|여행|drive|드라이브|sea|바다|station|정류장|subway|지하철/)) {
    return {
      scene: "moving through a place while an unresolved feeling follows",
      detail: "station lights, passing windows, sea air, a bag held too tightly",
    };
  }
  if (rawThemeText.trim()) {
    return {
      scene: `${getEnglishThemePhrase(params)} shown through one everyday incident`,
      detail: "one visible object, one small action, one unsaid feeling",
    };
  }
  return {
    scene: "one concrete everyday emotional scene",
    detail: "a small place, a visible object, and a feeling shown through behavior",
  };
}


type PromptIntentSnapshot = {
  emotionalCore: string;
  emotionalStrength: "light" | "medium" | "strong";
  contrast: string;
  sceneCore: string;
  atmosphereTone: string;
  vocalDelivery: string;
  arrangementMotion: string;
  soundFocus: string;
};

function getIntentKeywordText(params: GenerateSongParams): string {
  return [
    collectAtmosphereSourceText(params),
    selectedThemeText(params),
    selectedMoodText(params),
    selectedSoundText(params),
    selectedStyleText(params),
    getSelectedFusionGenres(params).map((genre) => `${genre.id} ${genre.label}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasIntentText(text: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function joinIntentPhrase(parts: string[], connector: 'and' | 'with' = 'and', max = 4): string {
  return joinPromptPhrase(dedupePromptParts(parts.filter(Boolean).map(cleanupPromptTail), 12).slice(0, max), connector);
}

function deriveIntentEmotion(params: GenerateSongParams): Pick<PromptIntentSnapshot, 'emotionalCore' | 'emotionalStrength' | 'contrast' | 'atmosphereTone' | 'vocalDelivery'> {
  const text = getIntentKeywordText(params);
  const hits = {
    resistance: hasIntentText(text, /저항|resistance|rebel|rebellion/),
    anxiety: hasIntentText(text, /불안|anxious|anxiety|긴장|tense|위태|fragile/),
    sorrow: hasIntentText(text, /비통|sorrow|grief|sad|sadness|쓸쓸|우울|melanchol|아련|wistful|미련/),
    warmth: hasIntentText(text, /따뜻|warm|아늑|cozy|위로|comfort|healing|치유/),
    bright: hasIntentText(text, /밝|bright|희망|hope|hopeful|쾌활|cheerful|upbeat/),
    groove: hasIntentText(text, /그루비|groovy|groove|funky|bounce|리듬/),
    comic: hasIntentText(text, /코믹|comic|playful|엉뚱|quirky|장난/),
    memory: hasIntentText(text, /추억|회상|memory|reminiscence|nostalgic|nostalgia|그리움|longing/),
    dreamy: hasIntentText(text, /몽환|dreamy|dreamwave|haze|ambient|spacious|우주|space|잔향|echo/),
    dark: hasIntentText(text, /어두|dark|moody|무디|cold|차가/),
    affection: hasIntentText(text, /사랑|love|affection|짝사랑|crush|고백|confession/),
    wandering: hasIntentText(text, /방황|wander|wandering/),
    gift: hasIntentText(text, /선물|gift/),
    magical: hasIntentText(text, /동화|fairy|fairytale|magical|마법|기묘|strange|whimsical/),
    witty: hasIntentText(text, /능청|wry|cheeky|playful|엉뚱|quirky/),
    drinking: hasIntentText(text, /술자리|drinking|bar|tipsy/),
    shelter: hasIntentText(text, /안식처|shelter|refuge|haven/),
    obsession: hasIntentText(text, /집착|obsess|obsessive/),
    breakup: hasIntentText(text, /이별|breakup|break-up|farewell/),
    cold: hasIntentText(text, /서늘|cold|chilly|cool/),
    family: hasIntentText(text, /가족|family/),
    reconcile: hasIntentText(text, /화해|reconcile|reconciliation/),
    anger: hasIntentText(text, /분노|anger|angry|rage/),
    minimal: hasIntentText(text, /미니멀|minimal/),
    hollow: hasIntentText(text, /공허|hollow|empty/),
    urban: hasIntentText(text, /도시|urban|city|거리|street/),
    basement: hasIntentText(text, /지하실|basement|습기|damp/),
    sea: hasIntentText(text, /바다|seaside|sea|ocean/),
    siren: hasIntentText(text, /구급차|siren|ambulance/),
    self: hasIntentText(text, /자아|self|identity/),
    flutter: hasIntentText(text, /설렘|flutter|fluttering/),
    mistake: hasIntentText(text, /달콤쌉쌀|mistake|실수|small fluttering mistake/),
    dawn: hasIntentText(text, /새벽|dawn/),
    smallHappiness: hasIntentText(text, /소확행|small happiness|little happiness|small joy/),
    growth: hasIntentText(text, /성장|growth|growing|coming[-\s]?of[-\s]?age/),
    fantasy: hasIntentText(text, /판타지|fantasy|fantastical|fairy|동화/),
    tender: hasIntentText(text, /애틋|tender|affectionate/),
    calm: hasIntentText(text, /담담|calm|restrained|stoic/),
    endurance: hasIntentText(text, /버팀|endure|endurance|holding its ground|버티/),
    traditional: hasIntentText(text, /전통|traditional|국악|gugak|장구|janggu|가야금|gayageum|거문고|geomungo/),
    campus: hasIntentText(text, /대학생|캠퍼스|college|campus|청춘|youth|풋풋/),
    friendship: hasIntentText(text, /친구|friendship|friend/),
    romanceLine: hasIntentText(text, /연인|사랑|romance|love|짝사랑|crush/),
  };
  const hitCount = Object.values(hits).filter(Boolean).length;
  const emotionalStrength: PromptIntentSnapshot['emotionalStrength'] = hitCount >= 5 ? 'strong' : hitCount >= 3 ? 'medium' : 'light';

  if ((hits.smallHappiness || hits.growth) && (hits.fantasy || hits.tender || hits.bright || hits.dark)) {
    return {
      emotionalCore: 'small cinematic growth with tender fantasy warmth',
      emotionalStrength,
      contrast: hits.dark ? 'moody heart brightened by small hope' : 'small happiness opening into hopeful wonder',
      atmosphereTone: joinIntentPhrase([hits.smallHappiness ? 'small happiness' : '', hits.growth ? 'quiet growth' : '', hits.fantasy ? 'tender fantasy color' : '', hits.dark ? 'moody warmth' : '', hits.bright ? 'cautious hope' : ''], 'and', 4),
      vocalDelivery: 'tender hopeful delivery with airy mystical softness',
    };
  }

  if (hits.campus && hits.friendship && hits.romanceLine) {
    return {
      emotionalCore: 'youthful almost-love confusion between friendship and romance',
      emotionalStrength,
      contrast: 'warm campus sweetness with a wistful aftertaste',
      atmosphereTone: joinIntentPhrase([hits.warmth ? 'warm confusion' : 'soft confusion', hits.sorrow ? 'wistful sweetness' : '', hits.urban || hits.dawn ? 'dawn-city air' : '', hits.comic || hits.bright ? 'cute brightness' : ''], 'and', 4),
      vocalDelivery: 'youthful pleading warmth',
    };
  }

  if (hits.affection && (hits.calm || hits.endurance || hits.sorrow) && (hits.traditional || /enka|엔카/.test(text))) {
    return {
      emotionalCore: 'restrained confession held through traditional sadness',
      emotionalStrength,
      contrast: hits.endurance ? 'lingering sadness holding its ground' : 'calm confession under adult sorrow',
      atmosphereTone: joinIntentPhrase([hits.calm ? 'restrained calm' : '', hits.sorrow ? 'lingering sadness' : '', hits.endurance ? 'quiet endurance' : '', hits.groove ? 'slow groove pulse' : ''], 'and', 4),
      vocalDelivery: 'deep vibrato with adult restraint and lingering emotion',
    };
  }

  if (hits.family && hits.reconcile) {
    return {
      emotionalCore: 'family reconciliation after unresolved anger',
      emotionalStrength,
      contrast: hits.hollow ? 'warm intimacy with a hollow aftertaste' : 'anger softening into warm intimacy',
      atmosphereTone: joinIntentPhrase([hits.anger ? 'softened anger' : '', hits.warmth ? 'warm intimacy' : '', hits.hollow ? 'hollow aftertaste' : '', hits.comic ? 'wry brightness' : ''], 'and', 4),
      vocalDelivery: hits.anger ? 'restrained vintage warmth with softened anger' : 'nostalgic warm restraint',
    };
  }

  if (hits.basement && (hits.sea || hits.siren || hits.self || hits.sorrow)) {
    return {
      emotionalCore: 'damp hidden unease moving toward seaside melancholy',
      emotionalStrength,
      contrast: hits.bright ? 'smiling unease over lonely warmth' : 'lonely warmth under damp unease',
      atmosphereTone: joinIntentPhrase([hits.basement ? 'damp basement unease' : '', hits.sea ? 'seaside melancholy' : '', hits.siren ? 'distant siren tension' : '', hits.warmth ? 'lonely warmth' : ''], 'and', 4),
      vocalDelivery: hits.bright ? 'distant nostalgic phrasing with smiling unease' : 'restrained nostalgic tension',
    };
  }

  if (hits.urban && (hits.flutter || hits.self || hits.basement || hits.magical || hits.affection)) {
    return {
      emotionalCore: 'cute urban flutter with bittersweet self-awareness',
      emotionalStrength,
      contrast: hits.basement ? 'cute surface over hidden basement unease' : 'soft brightness over bittersweet self-awareness',
      atmosphereTone: joinIntentPhrase([hits.dawn ? 'dawn street air' : 'urban reflections', hits.flutter ? 'small fluttering mistake' : '', hits.basement ? 'hidden basement unease' : '', hits.magical ? 'soft magical color' : ''], 'and', 4),
      vocalDelivery: hits.flutter ? 'breath-heavy indie phrasing with cute bittersweet tension' : 'natural indie restraint',
    };
  }

  if (hits.wandering && hits.gift && (hits.magical || hits.warmth || hits.witty)) {
    return {
      emotionalCore: 'wandering heart finding a strange gift',
      emotionalStrength,
      contrast: hits.witty ? 'playful warmth over uncertain wandering' : 'warm wonder over uncertain wandering',
      atmosphereTone: joinIntentPhrase([hits.magical ? 'playful fairy-tale warmth' : 'soft wonder', hits.warmth ? 'cozy intimacy' : '', hits.bright ? 'soft brightness' : '', hits.witty ? 'wry charm' : ''], 'and', 4),
      vocalDelivery: hits.witty ? 'playful magical storytelling' : 'sincere magical storytelling',
    };
  }

  if (hits.drinking && hits.affection && (hits.obsession || hits.shelter || hits.witty || hits.sorrow)) {
    return {
      emotionalCore: 'tipsy one-sided affection with obsessive tenderness',
      emotionalStrength,
      contrast: hits.witty ? 'comic unease over bittersweet shelter' : 'bittersweet shelter under obsessive affection',
      atmosphereTone: joinIntentPhrase([hits.obsession ? 'obsessive tenderness' : 'one-sided tenderness', hits.witty ? 'comic unease' : '', hits.shelter ? 'bittersweet shelter' : '', hits.sorrow ? 'sorrowful warmth' : ''], 'and', 4),
      vocalDelivery: hits.witty ? 'sorrowful warmth with playful hesitation' : 'sorrowful tender restraint',
    };
  }

  if (hits.breakup && (hits.cold || hits.comic || hits.bright || hits.sorrow)) {
    return {
      emotionalCore: 'cold breakup aftermath with cautious hope',
      emotionalStrength,
      contrast: hits.comic ? 'bittersweet humor inside the breakup ache' : 'cautious hope inside cold sadness',
      atmosphereTone: joinIntentPhrase([hits.cold ? 'cold immersion' : '', hits.bright ? 'cautious hope' : '', hits.comic ? 'bittersweet comic pain' : '', hits.sorrow ? 'lingering sadness' : ''], 'and', 4),
      vocalDelivery: hits.comic ? 'bittersweet comic hope' : 'restrained breakup ache',
    };
  }

  if (hits.resistance && hits.anxiety && (hits.sorrow || hits.warmth || hits.groove)) {
    return {
      emotionalCore: hits.groove ? 'anxious soulful resistance with groovy warmth' : 'anxious soulful resistance',
      emotionalStrength,
      contrast: hits.bright ? 'upbeat surface over moody pressure' : 'moody pressure under the groove',
      atmosphereTone: joinIntentPhrase(['groovy anxiety', hits.sorrow ? 'soulful pain' : 'soulful warmth', hits.bright ? 'upbeat warmth' : '', hits.dreamy ? 'wide echoes' : ''], 'and', 4),
      vocalDelivery: hits.groove ? 'laid-back groove with soulful tension' : 'soulful tension',
    };
  }

  if (hits.affection && hits.memory && (hits.warmth || hits.bright)) {
    return {
      emotionalCore: 'tender affection carried by warm memory',
      emotionalStrength,
      contrast: hits.dark ? 'soft warmth against a darker undertone' : '',
      atmosphereTone: joinIntentPhrase(['quiet tenderness', hits.bright ? 'soft brightness' : '', hits.warmth ? 'warm intimacy' : '', hits.dreamy ? 'dreamy haze' : ''], 'and', 4),
      vocalDelivery: 'tender melodic phrasing',
    };
  }

  if (hits.anxiety && hits.bright && (hits.comic || hits.affection)) {
    return {
      emotionalCore: 'anxious hope with a light comic edge',
      emotionalStrength,
      contrast: 'cautious hope over nervous tension',
      atmosphereTone: joinIntentPhrase(['cautious hope', hits.comic ? 'comic tension' : '', hits.bright ? 'soft brightness' : ''], 'and', 3),
      vocalDelivery: hits.comic ? 'comic hopeful delivery' : 'cautious hopeful delivery',
    };
  }

  if (hits.dark && hits.bright) {
    return {
      emotionalCore: 'dark feeling with a faint hopeful contrast',
      emotionalStrength,
      contrast: 'faint hopeful contrast',
      atmosphereTone: joinIntentPhrase(['dark undertone', 'cautious hope', hits.dreamy ? 'spatial echoes' : ''], 'and', 3),
      vocalDelivery: 'restrained hopeful tension',
    };
  }

  const tones = [
    hits.anxiety ? 'anxious tension' : '',
    hits.sorrow ? 'lingering sadness' : '',
    hits.warmth ? 'warm intimacy' : '',
    hits.bright ? 'soft brightness' : '',
    hits.groove ? 'groovy pulse' : '',
    hits.dreamy ? 'dreamy space' : '',
  ].filter(Boolean);

  return {
    emotionalCore: joinIntentPhrase(tones, 'and', 3) || 'balanced emotional color',
    emotionalStrength,
    contrast: '',
    atmosphereTone: joinIntentPhrase(tones, 'and', 3),
    vocalDelivery: joinIntentPhrase([
      hits.groove ? 'groove-aware delivery' : '',
      hits.sorrow ? 'lingering emotional restraint' : '',
      hits.bright ? 'soft bright lift' : '',
      hits.dreamy ? 'dreamy phrasing' : '',
    ], 'and', 3),
  };
}

type ContextualCueBundle = {
  atmosphereScene: string;
  arrangementHook: string;
};

function buildContextualCueBundle(params: GenerateSongParams): ContextualCueBundle {
  const text = [
    getIntentKeywordText(params),
    selectedThemeText(params),
    rawMoodAndDirectInputText(params),
    selectedStyleText(params, { excludeEraTexture: false }),
    selectedSoundText(params),
  ].join(' ').toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  const directSceneText = [
    params.userInput || '',
    params.customThemeInput || '',
    hasSituation(params.situation) ? JSON.stringify(params.situation) : '',
  ].join(' ');
  const directHasDigitalContact = /휴대폰|핸드폰|폰|메시지|문자|카톡|전송|커서|프로필|답장|send|message|text|cursor|profile/i.test(directSceneText);

  const choose = (atmosphereScene: string, arrangementHook: string): ContextualCueBundle => ({
    atmosphereScene: cleanupPromptTail(atmosphereScene),
    arrangementHook: cleanupPromptTail(arrangementHook),
  });

  if (has(/혼자밥|혼자\s*밥|solo\s*meal|eating\s*alone|1인용\s*식탁/)) {
    return choose('a lonely solo-dinner scene where small objects expose quiet emptiness', 'solo-dinner reflection hook');
  }
  if (has(/정류장|버스\s*정류장|bus\s*stop/)) {
    return choose('a late-night bus-stop scene with held-back words and passing lights', 'late-night bus-stop tension');
  }
  if (has(/지하철|subway|metro|전철|기차|train|열차/)) {
    return choose('a transit-window scene where motion hides a trembling feeling', 'subway-window memory cue');
  }
  if (directHasDigitalContact) {
    return choose('a user-specified communication scene where the emotional action comes only from the direct input', 'user-specified communication tension');
  }
  if (has(/사진|photo|photograph|폴라로이드|album|앨범/)) {
    return choose('an old-photo memory scene where a frozen smile opens the old feeling again', 'old-photo memory turn');
  }
  if (has(/서랍|drawer|상자|box|낡은\s*열쇠|열쇠|key/)) {
    return choose('a drawer-memory scene where a forgotten object brings the feeling back', 'drawer-memory turn');
  }
  if (has(/가족|family|부모|엄마|아빠|어머니|아버지/)) {
    return choose('a family-table silence scene where ordinary words hide the real feeling', 'family-table silence turn');
  }
  if (has(/편의점|convenience|영수증|receipt|젤리|봉투|plastic\s*bag/)) {
    return choose('a convenience-store memory scene where a tiny receipt keeps the feeling alive', 'convenience-store memory hook');
  }
  if (has(/시계|초침|clock|tick|틱톡|틱\s*톡/)) {
    return choose('a clock-tick scene where time pressure makes the hidden feeling louder', 'clock-tick urgency');
  }
  if (has(/테이프|tape|hiss|노이즈|noise|vinyl|바이닐/)) {
    return choose('a tape-hiss memory scene with softened distance and old emotion', 'tape-hiss nostalgia');
  }
  if (has(/리버스|reverse\s*fx|reverse|되감|rewind/)) {
    return choose('a reverse-FX memory scene where the feeling turns back on itself', 'reverse-FX memory turn');
  }
  if (has(/방|room|bedroom|침대|창문|window/) && has(/고백|confession|짝사랑|crush|설렘|flutter|사랑|love/)) {
    return choose('an empty-room emotional scene where a hidden feeling presses against the quiet space', 'empty-room emotional hook');
  }
  if (has(/방|room|bedroom|침대|창문|window/)) {
    return choose('a private-room scene where small objects make the feeling harder to ignore', 'empty-room reflection hook');
  }
  if (has(/차안|자동차|운전|드라이브|drive|car|dashboard|핸들/)) {
    return choose('a late-night city-drive scene where passing lights carry unsaid words', 'late-night city-drive flow');
  }
  if (has(/회사|직장|퇴근|야근|office|after[-\s]?work|workplace/)) {
    return choose('an office after-hours scene where tired routine turns into a private escape', 'after-work release hook');
  }
  if (has(/비\s*오는|빗|비가|rainy|rain|우산|umbrella/)) {
    return choose('a rainy-street afterimage scene where wet light keeps the memory open', 'rainy-street afterimage');
  }
  if (has(/우주|지구|astronaut|space|earth|헬멧|helmet|신호|signal/)) {
    return choose('a distant-space scene where isolation stretches across a fading signal', 'fading-signal space hook');
  }
  if (has(/골목|거리|street|alley|산책|walk|neighborhood/)) {
    return choose('a street-corner memory scene where footsteps keep circling the same feeling', 'street-corner memory hook');
  }
  if (has(/카페|cafe|coffee|커피/)) {
    return choose('a small-cafe hesitation scene where cooling coffee holds the unsaid line', 'small-cafe hesitation hook');
  }

  return { atmosphereScene: '', arrangementHook: '' };
}

function deriveIntentScene(params: GenerateSongParams): string {
  const text = getIntentKeywordText(params);
  const has = (pattern: RegExp) => hasIntentText(text, pattern);
  const contextualCue = buildContextualCueBundle(params);

  if (has(/연인|사랑|romance|love/) && has(/친구|friend/) && has(/대학생|캠퍼스|college|campus|청춘|youth|풋풋/)) return 'a tender campus almost-love scene between friendship and romance';
  if (has(/소확행|small happiness/) && has(/성장|growth/) && has(/판타지|fantasy|동화|magical|애틋|tender/)) return 'a tender fantasy-tinged growth scene where small happiness brightens a moody heart';
  if (has(/고백|confession|사랑|love/) && (has(/버팀|endure|버티/) || has(/담담|calm|restrained/) || has(/비통|sorrow|슬픔|sad/)) && (has(/엔카|enka/) || has(/장구|janggu|가야금|gayageum|거문고|geomungo|전통|traditional/))) return 'a restrained confession scene where lingering sadness holds its ground with quiet groove';
  if (has(/가족|family/) && has(/화해|reconcile|reconciliation/)) return 'a quiet family reconciliation scene where anger softens into warm but hollow intimacy';
  if (has(/지하실|basement|습기|damp/) && (has(/바다|sea|seaside|ocean/) || has(/구급차|siren|ambulance/))) return 'a damp basement-to-seaside scene with lonely warmth and distant siren tension';
  if (has(/도시|urban|city|거리|street/) && has(/설렘|flutter|자아|self|달콤쌉쌀|mistake|지하실|basement/)) return has(/새벽|dawn/) ? 'a dawn-city self-discovery scene around a small bittersweet mistake' : 'an urban self-discovery scene around a small bittersweet mistake';
  if (has(/방|room/) && has(/드라이브|drive|driving/) && has(/신스웨이브|synthwave|neon|네온/)) return 'a cool room-to-night-drive scene with fluttering tension and sorrowful afterglow';
  if (has(/j[-_\s]?electro|제이\s*일렉|일렉트로|electro/) && has(/수중|submerged|underwater|먹먹|muffled|digital|디지털/)) return 'a submerged digital confession scene with compressed tension and soft intimacy';
  if (has(/정류장|station|stop/) && has(/회상|memory|기억|사랑|love/) && has(/동화|fairy|magical|마법/)) return 'a magical late-night bus-stop memory scene';

  if (has(/방황|wander|wandering/) && has(/선물|gift/) && has(/동화|fairy|magical|마법|아늑|cozy|능청|wry|playful/)) return 'a cozy wandering scene around a strange gift';
  if (has(/술자리|drinking|bar|tipsy/) && has(/짝사랑|crush|one-sided|사랑|love/) && has(/집착|obsess|안식처|shelter|refuge|엉뚱|quirky|애틋|비통/)) return 'a tipsy one-sided love scene where obsessive affection hides inside a strange refuge';
  if (has(/카페|cafe|coffee/) && has(/혼자밥|혼자\s*밥|solo meal|eating alone/) && has(/도시|urban|city|거리|street/)) return 'a playful city-cafe solitude scene around lonely dining and bittersweet warmth';
  if (has(/카페|cafe|coffee/) && (has(/설렘|flutter|fluttering/) || has(/장난|playful|cute|귀여/) || has(/달콤쌉쌀|bittersweet/))) return 'a smooth city-cafe scene where a small fluttering mistake turns playful and bittersweet';
  if (has(/이별|breakup|break-up|farewell/) && has(/바다|sea|seaside|ocean/) && (has(/주말|weekend/) || has(/혼자밥|혼자\s*밥|solo meal|eating alone/) || has(/치유|healing|heal/) || has(/드리미|dreamy|에어리|airy/))) return 'a lonely seaside weekend after a breakup with dreamy air and quiet healing';
  if (has(/이별|breakup|break-up|farewell/) && has(/웃픈|comic|hope|희망|서늘|cold|몰입|immersive/)) return 'a cold breakup aftermath scene';
  if (has(/편의점|convenience/) && has(/밤|night|새벽/)) return 'a convenience-store night scene';
  if (has(/계절|season/) && has(/사랑|love|affection|짝사랑|crush/)) return 'a calm seasonal affection scene';
  if (has(/저항|resistance|rebel/) && has(/레게|reggae/)) return 'a moody reggae resistance scene';
  if (has(/저항|resistance|rebel/)) return 'a restless resistance scene';
  if (has(/짝사랑|crush|one-sided/) && has(/도시|city|urban|street|거리|골목/)) return 'a quiet urban one-sided love scene';
  if (has(/퇴근|야근|회사|office|work|after[-\s]?work/) && has(/소확행|small happiness|escape|위로|comfort|healing|치유|relief/) && has(/서늘|공허|차분|calm|empty|hollow|melanchol|tired|피곤|지친/)) return 'a tired after-work escape scene where small happiness cuts through calm emptiness';
  if (has(/회사|office|work|퇴근|야근/) && has(/위로|comfort|healing|치유|relief/)) return 'a quiet office after-hours recovery scene';
  if (has(/여행|travel/) && has(/어린시절|childhood/) && has(/추억|memory|회상/)) return 'a healing childhood travel memory';
  if (has(/밤|night/) && has(/혼자밥|혼자\s*밥|solo meal|eating alone/)) return 'a tense late-night solitude scene';
  if (contextualCue.atmosphereScene) return contextualCue.atmosphereScene;

  const layered = extractAtmosphereSceneLayers(params);
  if (layered.place && layered.story) return `a ${layered.story} scene in ${layered.place}`;
  if (layered.story) return `a ${layered.story} scene`;
  if (layered.place) return `a ${layered.place} scene`;
  return '';
}

function deriveIntentArrangement(params: GenerateSongParams): string {
  const text = getIntentKeywordText(params);
  const genreText = getSelectedFusionGenres(params).map((genre) => `${genre.id} ${genre.label}`).join(' ').toLowerCase();
  const parts: string[] = [];
  const add = (value: string) => {
    const cleaned = cleanupPromptTail(value);
    if (cleaned && !parts.some((part) => part.toLowerCase() === cleaned.toLowerCase())) parts.push(cleaned);
  };

  if (/k[-_\s]?trap|케이\s*트랩|트랩/.test(genreText)) {
    add('K-trap bounce');
    if (/melodic\s*rap|멜로딕\s*랩|랩|rap/.test(text + ' ' + genreText)) add('melodic-rap hook flow');
    if (/2020s|hyper|digital|하이퍼|디지털|glitch|글리치/.test(text)) add('hyper-digital stop-start contrast');
    if (/추억|회상|memory|familiar|익숙|편의점|방|장소|place/.test(text)) add('familiar-place memory turn');
  } else if (/chiptune|칩튠|8[-\s]?bit|8비트/.test(genreText)) {
    add('playful chiptune pulse');
    if (/square|pulse|noise|8[-\s]?bit|게임|pixel/.test(text + ' ' + genreText)) add('8-bit section flips');
    if (/귀여움에서\s*광기|cute-to-madness|광기|집착|obsess/.test(text)) add('cute-to-madness switch');
    if (/불안|anxious|warm|따뜻|어둡|dark|웃픈|comic/.test(text)) add('anxious warm hook');
  } else if (/neo\s*soul|네오\s*소울/.test(genreText)) {
    add('deep-pocket neo-soul groove');
    if (/90s|리듬\s*팝|bounce|바운스/.test(text)) add('90s R&B bounce lift');
    if (/2010s|polished|glossy|아이돌|pop energy/.test(text)) add('polished pop chorus rise');
    if (/전통|국악|가야금|해금|장구|traditional|gayageum|haegeum|janggu/.test(text)) add('traditional-color bridge turn');
    if (/재회|reunion|가족|family|희망|hope|불안|동화|fairy|comic|코믹/.test(text)) add('reunion hope hook');
  } else if (/indian|인도/.test(genreText)) {
    add('tabla-driven Indian-fusion pulse');
    if (/post[-\s]?rock|포스트\s*록/.test(genreText)) add('post-rock crescendo build');
    if (/sitar|시타르|bansuri|반수리|tabla|타블라/.test(text)) add('ornamental melodic turns');
    if (/hard snare|하드 스네어|레이저|laser/.test(text)) add('modern accent hits');
    if (/극장|idol|아이돌|전환|shift/.test(text)) add('cinematic idol-style shift');
    if (/희망|hope|성장|growth|소확행|small happiness/.test(text)) add('hopeful final hook');
  } else if (/enka|엔카/.test(genreText)) {
    add('slow enka-R&B groove');
    if (/장구|janggu|가야금|gayageum|거문고|geomungo|전통|traditional/.test(text)) add('restrained traditional pulse');
    if (/담담|버팀|calm|restrained|endure|비통|sorrow/.test(text)) add('janggu-weighted pauses');
    if (/고백|confession/.test(text)) add('gradual confession lift');
    if (/연인|사랑|romance|love|친구|friend|대학생|캠퍼스|college|campus|풋풋|청춘/.test(text)) add('youthful almost-love lift');
    if (/새벽|dawn|거리|street|도시|city|urban|따라\s*부르는|singalong|후렴/.test(text)) add('dawn-street singalong chorus');
    if (/room|intimate|공항|방송|echo|잔향/.test(text)) add('intimate room echoes');
  } else if (/post[-_\s]?punk|포스트\s*펑크|postpunk/.test(genreText)) {
    const playfulOrBright = /장난|playful|comic|cute|귀여|밝|bright|upbeat|자유|free/.test(text);
    const darkOrRestrained = /어두|dark|moody|무디|서늘|cold|restrained|차분|calm/.test(text);
    if (darkOrRestrained) add('dark angular post-punk pulse');
    else if (playfulOrBright) add('angular post-punk groove');
    else add('restrained post-punk groove');
    if (/funk\s*guitar|펑키\s*기타|funky\s*guitar/.test(text)) {
      add(darkOrRestrained ? 'muted guitar tension' : playfulOrBright ? 'playful guitar-led bounce' : 'guitar-led pulses');
    }
    if (/double\s*drums|더블\s*드럼/.test(text)) {
      add(darkOrRestrained ? 'heavier rhythmic drive' : playfulOrBright ? 'rhythmic lift' : 'emotional rhythmic lift');
    }
    if (/dreamy\s*synth|몽환\s*신스|dreamy|몽환|synth/.test(text)) {
      add(darkOrRestrained ? 'dreamy haze breaks' : playfulOrBright ? 'dreamy break sections' : 'dreamy transition space');
    }
    if (/고백|confession/.test(text) && /따라\s*부르는|singalong|후렴|chorus/.test(text)) add('singalong confession chorus');
    else if (/따라\s*부르는|singalong|후렴|chorus/.test(text)) add(darkOrRestrained ? 'restrained singalong hook' : 'singalong chorus lift');
  } else if (/eurobeat|유로비트/.test(genreText)) {
    add('high-speed eurobeat drive');
    if (/j[-\s]?rock|j[-_\s]?록|rock|록|band|밴드/.test(genreText + ' ' + text)) add('J-rock chorus lift');
    if (/friend|우정|친구|자유|free|playful|장난|쾌활|cheerful/.test(text)) add('playful friendship hook');
    if (/synth brass|신스\s*브라스|fast synth|digital synth|drive|driving bass/.test(text)) add('fast synth-pop break');
  } else if (/fantasy|판타지|dark fantasy|다크 판타지/.test(genreText)) {
    add(/dark|어두|다크|ominous|으스스|비/.test(text + ' ' + genreText) ? 'dark fantasy tension' : 'fantasy scene build');
    if (/nu[-_\s]?disco|뉴\s*디스코|disco/.test(genreText + ' ' + text)) add('nu-disco groove pulse');
    if (/rain|비|rainy|everyday|일상/.test(text)) add('rainy scene turn');
    if (/cute|귀여|ambien|앰비언트|공간|spacious|dark|어두/.test(text)) add('eerie chorus lift');
  } else if (/j[-_\s]?electro|j\s*electro|제이\s*일렉|일렉트로/.test(genreText)) {
    add('tight J-electro pulse');
    if (/drill|드릴|hi[-\s]?hat|하이햇/.test(text)) add('drill-hihat tension');
    if (/digital\s*compression|compressed|디지털\s*압축/.test(text)) add('compressed digital break');
    if (/guitar\s*solo|기타\s*솔로/.test(text)) add('guitar-solo lift');
    if (/수중|submerged|underwater|먹먹|muffled/.test(text)) add('submerged transition space');
    if (/고백|confession|기다림|waiting|짝사랑|crush/.test(text)) add('subtle confession hook');
  } else if (/synthwave|신스웨이브/.test(genreText)) {
    add('retro synth pulse');
    if (/drive|driving|드라이브/.test(text)) add('cool night-drive rhythm');
    else if (/night|밤|새벽/.test(text)) add('late-night synth motion');
    if (/감정적인\s*빌드업|emotional build|build[-\s]?up|브레이크다운|breakdown/.test(text)) add('emotional build-up turn');
    if (/cinematic|bridge|브릿지|시네마틱/.test(text)) add('cinematic bridge turn');
    if (/비통|sorrow|설렘|flutter|시원|cool/.test(text)) add('bittersweet neon hook');
  } else if (/dubstep|덥스텝/.test(genreText)) {
    // Arrangement should describe song movement, not detailed instrument performance.
    add('half-time dubstep drop');
    add('heavy low-end drop contrast');
    if (/verse|벌스|section|contrast|전환|드롭|drop|breakdown|브레이크다운/.test(text)) add('sharp verse-to-drop contrast');
    if (/k[-\s]?band|band\s*pop\s*rock|pop\s*rock|밴드\s*팝|팝록|rock|록/.test(genreText + ' ' + text)) add('K-band chorus lift');
    if (/2010s|polished|폴리시|glossy|pop energy/.test(text)) add('polished pop-rise bridge');
    if (/정류장|station|stop|회상|memory|사랑|love|동화|fairy|magical|마법/.test(text)) add('magical late-night memory hook');
  } else if (/emo[-_\s]?rap|이모\s*랩/.test(genreText)) {
    add(/nu[-_\s]?disco|뉴\s*디스코|disco/.test(genreText) ? 'nu-disco emo-rap pulse' : 'guitar-led emo-rap groove');
    if (/guitar|기타|멜로딕\s*기타|melodic guitar/.test(text)) add('melodic guitar-loop motion');
    if (/808|trap|트랩|hi[-\s]?hat|하이햇|hard drums|하드\s*드럼/.test(text)) add('hard trap drum push');
    if (/crowd|chant|관객|챈트/.test(text)) add('crowd-chant hook');
    if (/바다|seaside|sea|ocean|주말|weekend|치유|healing|드리미|dreamy|에어리|airy/.test(text)) add('moody seaside healing turn');
    if (/카페|cafe|coffee|혼자밥|solo meal/.test(text) && /장난|playful|설렘|flutter|도시|urban/.test(text)) add('playful city-cafe hook');
    if (/이별|breakup|달콤쌉쌀|bittersweet/.test(text)) add('bittersweet phrase-led hook');
  } else if (/country|컨트리/.test(genreText) || (/rock|록/.test(genreText) && /steel guitar|fiddle|acoustic guitar|컨트리|steel|fiddle/.test(text))) {
    add(/rock|록/.test(genreText) ? 'acoustic country-rock groove' : 'steady country storytelling groove');
    if (/steel guitar|스틸\s*기타/.test(text)) add('steel-guitar lift');
    if (/fiddle|피들/.test(text)) add('fiddle turns');
    if (/electric guitar|일렉|rock|록/.test(text + ' ' + genreText)) add('soft rock release');
    if (/퇴근|야근|회사|work|office|after[-\s]?work|피곤|지친/.test(text)) add('tired after-work release');
    if (/소확행|small happiness|위로|healing|relief|escape/.test(text)) add('small-happiness final hook');
    if (/서늘|공허|차분|melanchol|empty|hollow|calm/.test(text)) add('restrained melancholy turn');
  } else if (/future[-_\s]?bass|퓨처\s*베이스/.test(genreText)) {
    add('sidechained future-bass lift');
    if (/drill|드릴/.test(genreText)) add('drill-influenced low-end movement');
    if (/발음|흐릿|breath|blur|blurred|mumble/.test(text)) add('breath-blurred verse');
    if (/이별|breakup|웃픈|comic|hope|희망/.test(text)) add('restrained bittersweet breakup hook');
  } else if (/tropical\s*house|트로피컬\s*하우스/.test(genreText)) {
    add('steady tropical four-on-the-floor groove');
    add('clean club lift');
    if (/술자리|drinking|엉뚱|comic|quirky|playful/.test(text)) add('awkward comic turns');
    if (/집착|obsess/.test(text)) add('obsessive undertow');
    if (/짝사랑|crush|애틋|비통|sorrow|안식처|shelter/.test(text)) add('bittersweet hook');
  } else if (/folk\s*rock|포크\s*록/.test(genreText)) {
    add('band-driven build');
    add('guitar-led section lift');
    if (/오케스트라|orchestra|orchestral/.test(text)) add('orchestral-hit accents');
    if (/자신\s*없이|hesitant|uncertain|방황|wander/.test(text)) add('hesitant but focused hook');
    if (/동화|fairy|magical|선물|gift/.test(text)) add('fairy-tale build');
  } else if (/reggae|레게/.test(genreText)) {
    add('off-beat skank groove');
    if (/fretless|프렛리스/.test(text)) add('fretless bass movement');
    if (/저항|resistance|불안|anxious/.test(text)) add('anxious resistance build');
    if (/우주|space|잔향|echo|spatial/.test(text)) add('spacey echo breaks');
  } else if (/j[-\s]?jazz|jazz/.test(genreText)) {
    add('flexible jazz-funk groove');
    add('conversational phrasing');
    if (/dance|댄스|rhythm|리듬/.test(text)) add('dance-focused phrase hook');
  } else if (/campus|캠퍼스/.test(genreText)) {
    add('campus-band section lift');
    if (/가족|family|화해|reconcile|분노|anger/.test(text)) add('quiet reconciliation turn');
    if (/미니멀|minimal|공허|hollow/.test(text)) add('minimal emotional release');
  } else if (/k[-\s]?indie|k인디|인디/.test(genreText)) {
    add('intimate indie groove');
    if (/도시|urban|새벽|dawn|거리|street/.test(text)) add('dawn street reflection');
    if (/설렘|flutter|달콤쌉쌀|bittersweet|귀여|cute/.test(text)) add('cute bittersweet hook');
    if (/레이저|laser|칼림바|kalimba/.test(text)) add('tiny magical sound turns');
  } else if (/synthwave/.test(genreText)) {
    add('retro synth pulse');
    add('driving night rhythm');
    if (/지하실|basement|습기|damp|구급차|siren|바다|seaside/.test(text)) add('damp-to-seaside cinematic turn');
  } else if (/darkwave/.test(genreText)) {
    add('staccato darkwave tension');
    add('restrained hook lift');
  } else if (/synth\s*score|score/.test(genreText)) {
    add('cinematic synth-score build');
    if (/편의점|convenience|밤|night/.test(text)) add('small-scene emotional reveal');
  } else if (/trance/.test(genreText)) {
    add('rising synth build');
    add('euphoric hook lift');
  }

  // Final instrument-to-arrangement role mapping.
  // Instruments should not only appear in [Instruments]; key selected instruments
  // also need a compact performance role in [Arrangement]. This is deliberately
  // generic so random combinations do not require one-off patching.
  const playfulOrBrightGlobal = /장난|playful|comic|cute|귀여|밝|bright|upbeat|자유|free/.test(text);
  const darkOrRestrainedGlobal = /어두|dark|moody|무디|서늘|cold|restrained|차분|calm/.test(text);
  if (!/post[-_\s]?punk|포스트\s*펑크|postpunk/.test(genreText)) {
    if (/funk\s*guitar|펑키\s*기타|funky\s*guitar/.test(text)) add(darkOrRestrainedGlobal ? 'muted guitar tension' : playfulOrBrightGlobal ? 'playful guitar-led bounce' : 'guitar-led pulses');
    if (/double\s*drums|더블\s*드럼/.test(text)) add(darkOrRestrainedGlobal ? 'heavier rhythmic drive' : playfulOrBrightGlobal ? 'rhythmic lift' : 'emotional rhythmic lift');
    if (/dreamy\s*synth|몽환\s*신스/.test(text)) add(darkOrRestrainedGlobal ? 'dreamy haze breaks' : playfulOrBrightGlobal ? 'dreamy break sections' : 'dreamy transition space');
  }
  if (/bass|베이스/.test(text) && /driving|드라이빙|drive/.test(text)) add('driving bass movement');
  if (/angular\s*guitar|각진\s*기타/.test(text)) add('angular guitar stabs');

  if (/cute[-\s]?to[-\s]?madness|귀여움.*광기|광기/.test(text)) add('cute-to-madness switch');
  if (/obsess|집착/.test(text) && /cute|귀여움|광기/.test(text)) add('obsessive undertow');
  if (/cinematic|시네마|영화|scene-building/.test(text) && /lift|고조|rise|final|confession|고백/.test(text)) add('gradual cinematic lift');

  return joinIntentPhrase(parts, 'and', 5);
}

function deriveIntentSoundFocus(params: GenerateSongParams): string {
  const text = selectedSoundText(params);
  if (/heavy\s*808|묵직한\s*808|808/.test(text) && /sub bass|low-end|저음/.test(text)) return 'heavy 808 low-end';
  if (/off[-\s]?beat guitar|skank/.test(text)) return 'off-beat skank guitar';
  if (/warm keys|smooth keys|rhodes|electric piano/.test(text)) return 'warm Rhodes-style keys';
  return '';
}

function buildPromptIntent(params: GenerateSongParams): PromptIntentSnapshot {
  const emotion = deriveIntentEmotion(params);
  return {
    ...emotion,
    sceneCore: deriveIntentScene(params),
    arrangementMotion: deriveIntentArrangement(params),
    soundFocus: deriveIntentSoundFocus(params),
  };
}


function stripFinalInternalProtectionLanguage(value: string): string {
  // Safety filter only. Do not replace internal phrases with fixed story scenes.
  return cleanupPromptTail(String(value || '')
    .replace(/\bdirect\s+user[-\s]?specified(?:\s+\w+){0,4}\b/gi, '')
    .replace(/\bcentered\s+on\s+the\s+exact\s+topic\s+the\s+user\s+wrote\b/gi, '')
    .replace(/\bthe\s+exact\s+topic\s+the\s+user\s+wrote\b/gi, '')
    .replace(/\bmatching\s+the\s+free[-\s]?text\s+direction\b/gi, '')
    .replace(/\bdirect[-\s]?story\s+section\s+movement\b/gi, '')
    .replace(/\bfree[-\s]?text\s+direction\b/gi, '')
    .replace(/\buser\s+direct\s+input\b/gi, '')
    .replace(/\buser\s+input\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .replace(/\s{2,}/g, ' '));
}

function isBrokenFinalPromptPhrase(value: string): boolean {
  const cleaned = cleanupPromptTail(String(value || ''));
  if (!cleaned) return true;
  if (/^(?:a|an|the|with|where|and|or|to|in|of|for)$/i.test(cleaned)) return true;
  if (/\b(?:direct\s+user[-\s]?specified|exact\s+topic\s+the\s+user\s+wrote|free[-\s]?text\s+direction|direct[-\s]?story\s+section\s+movement|matching\s+the\s+free[-\s]?text)\b/i.test(cleaned)) return true;
  if (/\b(?:one\s+specific\s+object|one\s+specific\s+place|one\s+specific\s+conflict)\s*$/i.test(cleaned)) return true;
  if (/\bwhere\s+visible\s+behavior\s+carries\s*$/i.test(cleaned)) return true;
  if (cleaned.length < 8) return true;
  return false;
}

function buildNaturalDirectAtmosphereFallback(params: GenerateSongParams): string {
  const scene = buildUserTextCoreScene(params)?.scene || deriveIntentScene(params) || 'a concrete personal scene where small visible actions carry the emotion';
  const mood = buildDirectMoodAngle(params) || buildCompactMoodAngle(params);
  const space = compactSpaceAndTransitionCue(params);
  return finalizeAtmosphereSentence(cleanupPromptTail([
    mood ? `${mood} ${scene.replace(/^a\s+/i, '')}` : scene,
    space ? `with ${space}` : '',
  ].filter(Boolean).join(', ')));
}

function buildNaturalDirectArrangementFallback(params: GenerateSongParams, original = ''): string {
  const tempo = normalizeTempoForArrangement(buildTempoPromptPhrase(params)) || getGenreDefaultTempoForArrangement(params);
  const stabilizers = buildArrangementStabilizerParts(params).filter((part) => !isInstrumentPerformanceArrangementPart(part));
  const intentParts = splitArrangementParts(deriveIntentArrangement(params).replace(/\band\b/g, ','))
    .map(stripFinalInternalProtectionLanguage)
    .filter(Boolean)
    .filter((part) => !isInstrumentPerformanceArrangementPart(part))
    .filter((part) => !isGenericArrangementPart(part));
  const originalParts = splitArrangementParts(stripFinalInternalProtectionLanguage(original))
    .filter(Boolean)
    .filter((part) => !isInstrumentPerformanceArrangementPart(part))
    .filter((part) => !isGenericArrangementPart(part));
  const parts = dedupePromptParts([tempo, ...stabilizers, ...intentParts, ...originalParts], 7).filter(Boolean);
  return cleanupPromptTail(mergeHookArrangementParts(parts).join(', ')) || cleanupPromptTail([tempo, 'story-driven section movement', 'clear hook release'].filter(Boolean).join(', '));
}

function applyIntentToAtmosphereLine(line: string, params: GenerateSongParams): string {
  const intent = buildPromptIntent(params);
  let cleaned = stripFinalInternalProtectionLanguage(cleanupPromptTail(String(line || '')))
    .replace(/\ba\s+anxious\b/gi, 'an anxious')
    .replace(/\ban\s+anxious\b/gi, 'an anxious')
    .replace(/\bwith\s+([^,]+?)\s+with\s+/gi, 'with $1 and ')
    .replace(/\b(soft brightness)\s+and\s+bright tone\b/gi, '$1')
    .replace(/\b(calm tone)\s+and\s+spacious tone\b/gi, '$1 and spatial echoes')
    .replace(/\bscene\s+in\s+([^,]+?)\s+scene\b/gi, 'scene in $1')
    .replace(/\b(a\s+[^,]+? scene)\s+in\s+\1\b/gi, '$1')
    .replace(/\ba\s+quiet\s+tender\s+affection\s+scene\s+in\s+quiet\s+tender\s+affection\s+scene\s+in\s+/gi, 'a quiet tender affection scene in ')
    .replace(/\bclear\s+emotional\s+scene\b/gi, 'emotional scene')
    .replace(/\ba\s+breakup\s+aftermath\s+scene\s+in\s+seaside\s+with\s+dark\s+undertone\s+and\s+moody\s+shadow\b/gi, 'a lonely seaside weekend after a breakup with dreamy air, dark mood, and quiet healing')
    .replace(/\bsmooth\s+and\s+bittersweet\s+tension\s+around\s+small\s+fluttering\s+mistake\b/gi, 'a smooth city-cafe scene where a small fluttering mistake turns playful and bittersweet')
    .replace(/\ba\s+quiet\s+change\s+scene\s+in\s+seaside\s+with\s+soulful\s+warmth\s+and\s+warm\s+tone\b/gi, 'a damp basement-to-seaside scene with lonely warmth and distant siren tension')
    .replace(/\ba\s+reconciliation\s+scene\s+with\s+warm\s+intimacy\b/gi, 'a quiet family reconciliation scene where anger softens into warm but hollow intimacy')
    .replace(/\bconcrete\s+everyday\s+scene\b/gi, 'concrete everyday moment')
    .replace(/\s{2,}/g, ' ');

  const lower = cleaned.toLowerCase();
  const sceneNeedle = intent.sceneCore.toLowerCase().replace(/^a\s+|^an\s+/, '');
  const isGeneric = /\bemotional scene\b|ordinary moments|one concrete everyday|private room scene|held-back confession scene|with magical tone|^a reconciliation scene|^a quiet change scene|^bittersweet and cute tension/i.test(cleaned);
  const shouldUseIntentScene = Boolean(
    intent.sceneCore && (
      isGeneric ||
      /scene\s+in\s+[^,]+\s+scene/i.test(cleaned) ||
      (/cozy wandering scene|strange gift/i.test(intent.sceneCore) && !/wander|gift|선물|방황/i.test(cleaned)) ||
      (/tipsy one-sided love scene|strange refuge/i.test(intent.sceneCore) && !/tipsy|drinking|술자리|refuge|안식처/i.test(cleaned)) ||
      (/cold breakup aftermath scene/i.test(intent.sceneCore) && !/cold|서늘|bittersweet|comic pain/i.test(cleaned)) ||
      (/seaside weekend after a breakup/i.test(intent.sceneCore) && !/weekend|healing|dreamy air|quiet healing/i.test(cleaned)) ||
      (/city-cafe/i.test(intent.sceneCore) && !/cafe|city-cafe|lonely dining|fluttering mistake/i.test(cleaned)) ||
      (/campus almost-love|friendship and romance/i.test(intent.sceneCore) && !/campus|friendship|romance|almost-love|풋풋/i.test(cleaned))
    )
  );

  if (shouldUseIntentScene) {
    const tone = intent.atmosphereTone || intent.emotionalCore;
    const richIntentScene = /where|around|with\s+(?:quiet groove|warm but hollow intimacy|lonely warmth|distant siren tension)|breakup aftermath|resistance scene/i.test(intent.sceneCore);
    cleaned = tone && !richIntentScene ? `${intent.sceneCore} with ${tone}` : intent.sceneCore;
  }

  if (intent.sceneCore && intent.atmosphereTone && !lower.includes(sceneNeedle)) {
    // Only replace very generic output; do not override already-specific atmosphere lines.
    if (/^an?\s+emotional\s+scene|^an?\s+clear\s+emotional\s+scene/i.test(cleaned)) {
      cleaned = `${intent.sceneCore} with ${intent.atmosphereTone}`;
    }
  }

  cleaned = finalizeAtmosphereSentence(cleaned);

  let finalAtmosphere = finalizeAtmosphereSentence(cleanupPromptTail(
    stripFinalInternalProtectionLanguage(cleaned)
      .replace(/\bwith\s+(.+?)\s+and\s+with\s+/gi, 'with $1 and ')
      .replace(/\bwith\s+([^,]+?)\s+with\s+/gi, 'with $1 and ')
      .replace(/\ba restrained confession scene where lingering sadness holds its ground with quiet groove\s+(?:and|with)\s+restrained calm,?\s*lingering sadness,?\s*quiet endurance,?\s*(?:and\s*)?slow groove pulse\b/gi, 'a restrained confession scene where lingering sadness holds its ground with quiet groove')
      .replace(/\bwith\s+([^,]+?)\s+and\s+([^,]+?)\s+and\s+spatial echoes\s*,?\s*with\s+spatial echoes\b/gi, 'with $1, $2, and spatial echoes')
      .replace(/\b(a\s+[^,]+? scene)\s+in\s+\1\b/gi, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+,/g, ',')
  ));

  if (isBrokenFinalPromptPhrase(finalAtmosphere)) {
    finalAtmosphere = buildNaturalDirectAtmosphereFallback(params);
  }

  return finalizeAtmosphereSentence(finalAtmosphere);
}

function applyIntentToVocalLine(line: string, params: GenerateSongParams): string {
  const intent = buildPromptIntent(params);
  let cleaned = cleanupPromptTail(String(line || ''))
    .replace(/\bRhythmic\s+Patois\s+style\b/gi, 'rhythmic patois phrasing')
    .replace(/\bLaid-back\b/g, 'laid-back groove')
    .replace(/\bJazzy\s*,\s*laid-back\s+groove\s*,\s*Melodic\s+phrasing\b/gi, 'jazzy laid-back groove and melodic phrasing')
    .replace(/\bMinimalist\s+processed\s+textures\b/gi, 'minimal processed texture')
    .replace(/\bSincere\s+storytelling\s*,\s*Warm\s+rock\s+tone\s+with\s+magical\s+feeling\b/gi, 'sincere storytelling, warm rock tone, playful magical delivery')
    .replace(/\bLight\s*,\s*Breezy\s+pop-style\s+vocals\s+with\s+sorrowful\s+feeling\b/gi, 'light breezy pop phrasing with sorrowful warmth')
    .replace(/\bPop-style\s+melodic\s+tone\s*,\s*Airy\s+tone\s+with\s+comic\s+hopeful\s+delivery\b/gi, 'airy pop-melodic phrasing with comic hopeful delivery')
    .replace(/\bVulnerable\s+sing-rapping\s*,\s*Raw\s+tone\s+with\s+dreamy\s+spacious\s+feeling\s*,?\s*groove-aware\s+delivery\s+and\s+dreamy\s+phrasing\b/gi, 'vulnerable sing-rapping with raw airy tone, dreamy spacious phrasing, and groove-aware delivery')
    .replace(/\bVulnerable\s+sing-rapping\s*,\s*Raw\s+tone\s+with\s+smooth\s+and\s+bittersweet\s+feeling\b/gi, 'vulnerable sing-rapping with raw smooth bittersweet phrasing')
    .replace(/\bVulnerable\s+sing-rapping\s*,\s*Raw\s+tone\b/gi, 'vulnerable sing-rapping with raw emotional phrasing')
    .replace(/\bTwangy\s*,\s*Sincere\s+storytelling\s+style\b/gi, 'twangy sincere storytelling')
    .replace(/\bdreamy\s+spacious\s+feeling\b/gi, 'dreamy spacious phrasing')
    .replace(/\bsmooth\s+and\s+bittersweet\s+feeling\b/gi, 'smooth bittersweet tension')
    .replace(/\bPowerful\s+vintage\s+rock\s*,\s*Nostalgic\s+with\s+minimal\s+and\s+warm\s+feeling\b/gi, 'nostalgic warmth with restrained vintage-rock edge')
    .replace(/\bNatural\s*,\s*Breath-heavy\s+tone\s+with\s+bittersweet\s+and\s+cute\s+feeling\b/gi, 'natural breath-heavy tone with cute bittersweet tension')
    .replace(/\bwith\s+groovy\s+moody\s+delivery\s+and\s+story-aware\s+expression\b/gi, 'with groovy moody delivery and story-aware expression')
    .replace(/\b,\s*laid-back\s+groove\s+with\s+/gi, ', laid-back groove, ')
    .replace(/\bwith\s+([^,]+?)\s+with\s+/gi, 'with $1, ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',');

  if (intent.vocalDelivery && !new RegExp(intent.vocalDelivery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(cleaned)) {
    const lowerCleaned = cleaned.toLowerCase();
    const lowerIntent = intent.vocalDelivery.toLowerCase();
    const intentAlreadyCovered =
      (/deep vibrato/.test(lowerIntent) && /deep vibrato/.test(lowerCleaned)) ||
      (/adult restraint|adult/.test(lowerIntent) && /adult phrasing|adult restraint/.test(lowerCleaned)) ||
      (/lingering/.test(lowerIntent) && /lingering|emotional restraint/.test(lowerCleaned)) ||
      (/ornamental melodic phrasing/.test(lowerIntent) && /ornamental melodic phrasing/.test(lowerCleaned)) ||
      (/airy mystical softness/.test(lowerIntent) && /airy|mystical|magical/.test(lowerCleaned));
    const hasOnlyGenericEmotion = /with\s+(?:calm|bright|warm|comic|hopeful|upbeat|moody|magical|sorrowful)\s+(?:feeling|delivery|tone)/i.test(cleaned);
    if (!intentAlreadyCovered && hasOnlyGenericEmotion) {
      cleaned = cleaned.replace(/with\s+(?:calm|bright|warm|comic|hopeful|upbeat|moody|magical|sorrowful)\s+(?:feeling|delivery|tone)/i, `with ${intent.vocalDelivery}`);
    } else if (!intentAlreadyCovered && /story-aware\s+expression/i.test(cleaned) && !new RegExp(intent.vocalDelivery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(cleaned)) {
      cleaned = cleaned.replace(/\s+and\s+story-aware\s+expression/i, `, ${intent.vocalDelivery}, and story-aware expression`);
    }
  }

  if (/traditional[-\s]?trot|trot|트로트/i.test(cleaned) && /youthful pleading warmth/i.test(intent.vocalDelivery)) {
    const formation = /Natural\s+female/i.test(cleaned) ? 'Natural female traditional-trot vocal' : /Natural\s+male/i.test(cleaned) ? 'Natural male traditional-trot vocal' : 'Natural solo traditional-trot vocal';
    cleaned = `${formation} with rounded vibrato, clear diction, youthful pleading warmth, and story-aware expression`;
  }



  return cleanupPromptTail(
    cleaned
      .replace(/\bwith\s+Deep vibrato,\s*Dramatic adult phrasing with deep vibrato with adult restraint and lingering emotion and story-aware expression\b/gi, 'with deep vibrato, dramatic adult phrasing, groove-aware restraint, and lingering emotional expression')
      .replace(/\bDeep vibrato,\s*Dramatic adult phrasing with deep vibrato with adult restraint and lingering emotion\b/gi, 'deep vibrato, dramatic adult phrasing, groove-aware restraint, and lingering emotional expression')
      .replace(/\bwith\s+vulnerable\s+sing-rapping\s+with\s+/gi, 'with vulnerable sing-rapping, ')
      .replace(/\bdreamy\s+spacious\s+phrasing,?\s*groove-aware\s+delivery\s+and\s+dreamy\s+phrasing\b/gi, 'dreamy spacious phrasing and groove-aware delivery')
      .replace(/\bdelivery\s+and\s+story-aware\s+expression\b/gi, 'delivery and story-aware expression')
      .replace(/\band\s+and\b/gi, 'and')
      .replace(/\s{2,}/g, ' ')
  );
}



function buildArrangementSceneHook(params: GenerateSongParams): string {
  const text = [getIntentKeywordText(params), selectedThemeText(params), rawMoodAndDirectInputText(params), selectedStyleText(params, { excludeEraTexture: false }), selectedSoundText(params)]
    .join(' ')
    .toLowerCase();
  const contextualCue = buildContextualCueBundle(params);
  if (contextualCue.arrangementHook) return contextualCue.arrangementHook;

  if (/정류장|stop|station/.test(text) && /회상|추억|memory|사랑|love|애틋|wistful|동화|fairy|magical/.test(text)) return 'late-night memory hook';
  if (/회사|office|퇴근|야근|after[-\s]?work/.test(text) && /희망|hope|성장|growth|사랑|love|고향|hometown|자유|free/.test(text)) return 'hopeful office-life hook';
  if (/지하철|subway|metro/.test(text) && /꿈|dream|비통|sorrow|미니멀|minimal|어두|dark/.test(text)) return 'subway-dream tension hook';
  if (/방|room/.test(text) && /드라이브|drive/.test(text)) return 'room-to-night-drive hook';
  if (/산책|walk|골목|alley|neighborhood|street/.test(text)) return /마법|동화|fantasy|magical/.test(text) ? 'magical neighborhood-walk hook' : 'neighborhood-walk hook';
  if (/혼자밥|혼자\s*밥|solo meal|eating alone/.test(text)) return 'solo-dinner reflection hook';
  if (/카페|cafe|coffee/.test(text)) return 'small-cafe hesitation hook';
  if (/퇴근|야근|after[-\s]?work|office|회사/.test(text)) return 'after-work release hook';
  if (/바다|seaside|ocean|sea/.test(text) && /이별|breakup|치유|healing|주말|weekend/.test(text)) return 'seaside healing hook';
  if (/고백|confession|짝사랑|crush|설렘|flutter|썸/.test(text)) return /장난|comic|playful|귀여|cute|웃픈/.test(text) ? 'playful confession hook' : 'confession lift hook';
  if (/우정|friendship|친구/.test(text)) return 'friendship hook';
  if (/가족|family|화해|reconciliation/.test(text)) return 'reconciliation hook';
  if (/변화|성장|change|growth/.test(text)) return 'change-and-growth hook';
  if (/기다림|waiting|기대/.test(text)) return 'waiting hook';
  return '';
}

function buildArrangementStabilizerParts(params: GenerateSongParams): string[] {
  const text = [
    getIntentKeywordText(params),
    selectedThemeText(params),
    selectedStyleText(params, { excludeEraTexture: false }),
    selectedSoundText(params),
    rawMoodAndDirectInputText(params),
  ].join(' ').toLowerCase();
  const genreText = getSelectedFusionGenres(params).map((genre) => `${genre.id} ${genre.label}`).join(' ').toLowerCase();
  const parts: string[] = [];
  const add = (value: string) => {
    const cleaned = cleanupPromptTail(value);
    if (cleaned && !parts.some((part) => part.toLowerCase() === cleaned.toLowerCase())) parts.push(cleaned);
  };

  // Arrangement is the song movement plan, not an instrument-performance list.
  // Keep it stable as: main genre movement + fusion/style movement + section turn + situation hook.
  if (/mystery\s*bgm|미스터리\s*bgm/.test(genreText)) {
    add('mystery-BGM suspense flow');
    if (/footstep|발걸음|shuffle|셔플|pulse|펄스|eerie|오묘|저항|resistance|바다|sea|회사|office/.test(text)) add('subtle pulse tension');
    if (/piano\s*band|피아노\s*밴드|session|세션|drum|드럼/.test(text)) add('small-band scene movement');
    if (/저항|resistance|mystery|미스터리|불안|anxious|오묘|eerie/.test(text)) add('unresolved resistance hook');
    else add('unresolved mystery hook');
  } else if (/epic\s*trailer|에픽\s*트레일러/.test(genreText)) {
    add('epic-trailer tension build');
    if (/uk\s*garage|uk\s*개러지|garage|개러지/.test(text + ' ' + genreText)) add('UK-garage rhythmic push');
    if (/choir|콰이어|합창|brass|브라스|strings|스트링|rising|상승/.test(text)) add('choir-led trailer rise');
    if (/정류장|stop|station|운명|destiny|comic|코믹|오묘|mysterious/.test(text)) add('comic late-night bus-stop hook');
    else add('heroic trailer hook');
  } else if (/opera|오페라/.test(genreText)) {
    add('operatic dramatic build');
    if (/neo[-\s]?retro|네오\s*레트로|walking\s*bass|워킹\s*베이스|hard\s*snare|하드\s*스네어/.test(text + ' ' + genreText)) add('neo-retro tension pulse');
    if (/후회|regret|분노|anger|어두|dark|에테리얼|ethereal/.test(text)) add('dark regret aria turn');
    if (/confession|고백|사랑|love|꿈|dreamy|몽환/.test(text)) add('dramatic aria release');
  } else if (/j[-_\s]?ballad|j\s*발라드/.test(genreText)) {
    add('slow J-ballad emotional build');
    if (/piano|피아노|reverb|리버브|strings|스트링/.test(text)) add('wide reverb piano space');
    if (/퇴근|after[-\s]?work|후회|regret|기묘|strange|tired|피곤/.test(text)) add('strange after-work release turn');
    if (/고백|confession|사랑|love|이별|breakup/.test(text)) add('restrained ballad hook');
  } else if (/romantic\s*rock|로맨틱\s*록/.test(genreText)) {
    add('romantic rock band build');
    if (/비|rain|rainy|태평소|taepyeongso/.test(text)) add('rain-soaked guitar lift');
    if (/사랑|연인|고백|짝사랑|love|romantic|confession/.test(text)) add('tender love chorus release');
    if (/릴렉스|relax|차분|calm|spatial|잔향/.test(text)) add('relaxed live-band flow');
  } else if (/emo\s*rap|이모랩/.test(genreText)) {
    add('guitar-led emo-rap groove');
    if (/2000|glossy|polish|후반|y2k/.test(text + ' ' + genreText)) add('2000s pop-polish lift');
    if (/바다|seaside|ocean|hope|희망|치유|healing/.test(text)) add('moody seaside healing turn');
    if (/사랑|고백|confession|crush|짝사랑|comic|코믹/.test(text)) add('melodic confession hook');
  } else if (/cafe\s*bgm|카페\s*bgm/.test(genreText)) {
    add('soft cafe-BGM flow');
    if (/retro|레트로|electro|일렉|synth|신스/.test(text + ' ' + genreText)) add('retro-electro texture');
    if (/lo[-_\s]?fi|로파이|tape|테이프|noise|노이즈|static/.test(text)) add('lo-fi tape-noise warmth');
    if (/drive|드라이브|family|가족|reunion|화해|자유|free/.test(text)) add('family-drive scene hook');
    else add('gentle background scene hook');
  } else if (/background\s*music|bgm|테마|theme/.test(genreText)) {
    add('theme-BGM scene flow');
    if (/mystery|미스터리|eerie|오묘|suspense|긴장/.test(text + ' ' + genreText)) add('suspense motif return');
    if (/lo[-_\s]?fi|로파이|radio|라디오|tape|테이프|noise|노이즈/.test(text)) add('textured background pulse');
    const scene = buildArrangementSceneHook(params);
    if (scene) add(scene.replace(/^city-cafe scene hook$/i, 'background scene hook'));
    else add('scene-led BGM hook');
  } else if (/deep\s*house|딥\s*하우스/.test(genreText)) {
    add('deep-house pocket groove');
    if (/lo[-_\s]?fi|로파이|퇴근|after[-\s]?work|office|회사|dream|꿈/.test(text)) add('lo-fi after-work flow');
    if (/gospel|가스펠|choir|콰이어|합창/.test(text)) add('gospel-choir lift');
    if (/운명|fate|dream|꿈|powerful|파워풀|groovy|그루비/.test(text)) add('dreamy fate-release hook');
  } else if (/baroque|바로크/.test(genreText)) {
    add('baroque chamber build');
    if (/cello|첼로|strings|스트링|string|현악|harpsichord|하프시코드|oboe|오보에/.test(text)) add('ornate chamber rise');
    if (/고백|confession|짝사랑|crush|love|사랑/.test(text)) add('restrained confession turn');
    if (/희망|hope|cautious|조심|cinematic|시네마틱/.test(text)) add('hopeful orchestral release');
  } else if (/full\s*orchestra|풀\s*오케스트라|orchestra|오케스트라/.test(genreText)) {
    add('orchestral swell build');
    if (/r&b|rnb|컨템퍼러리|알앤비|smooth|keys|키/.test(text + ' ' + genreText)) add('R&B harmonic lift');
    if (/trap|트랩|drum|드럼|808/.test(text)) add('rhythmic contrast turn');
    if (/고백|confession|comic|코믹|애틋|wistful|시원|cool/.test(text)) add('comic bittersweet confession hook');
  } else if (/modern\s*folk|모던\s*포크|folk|포크/.test(genreText)) {
    add('modern-folk acoustic motion');
    if (/k[-_\s]?band|밴드|rock|록|guitar|기타/.test(text + ' ' + genreText)) add('K-band lift');
    if (/골목|street|neighborhood|고향|hometown|warm|따뜻|room/.test(text)) add('warm street-corner build');
    if (/고백|confession|사랑|love|미련|wistful/.test(text)) add('neighborhood confession hook');
  } else if (/k[-_\s]?band\s*pop|k[-_\s]?밴드\s*팝|band\s*pop|밴드팝/.test(genreText)) {
    add('K-band emotional build');
    if (/uk\s*garage|uk\s*개러지|garage|개러지/.test(text + ' ' + genreText)) add('UK-garage rhythmic undercurrent');
    if (/post[-_\s]?rock|포스트\s*록/.test(text + ' ' + genreText)) add('post-rock final lift');
    if (/이별|breakup|담담|calm|감성|emotional|책|page/.test(text)) add('bittersweet breakup hook');
  } else if (/italian\s*pop|이탈리아\s*팝/.test(genreText)) {
    add('melodic Italian-pop flow');
    if (/subway|지하철|street|도시|city|ride|캐치|catchy|playful|능청|장난/.test(text)) add('subway-scene bounce');
    if (/808|trap|트랩|hi[-\s]?hat|하이햇|snare|스네어|dark\s*synth|어두운\s*신스|glitch|글리치/.test(text)) add('trap-pop rhythm lift');
    if (/저항|resistance|자유|free|오묘|mysterious/.test(text)) add('playful resistance hook');
    else add('bright Italian-pop refrain');
  } else if (/sarod|사로드/.test(genreText)) {
    add('sarod-led classical flow');
    if (/tabla|타블라|drum|드럼|rhythm|리듬/.test(text)) add('tabla rhythmic cycle');
    if (/tanpura|탄푸라|drone|드론|bansuri|반수리|인도|indian/.test(text)) add('tanpura drone space');
    if (/재회|reunion|거리|distance|고향|home|귀여|cute|주말|weekend/.test(text)) add('reunion-after-distance hook');
    else add('classical world-fusion hook');
  } else if (/acoustic\s*jazz|어쿠스틱\s*재즈/.test(genreText)) {
    add('acoustic-jazz pocket');
    if (/punk|펑크|rock|록/.test(text + ' ' + genreText)) add('punk-rock contrast lift');
    if (/dream|몽환|dreamy|synth|신스/.test(text)) add('dreamy synth break');
    if (/회사|office|희망|hope|성장|growth|사랑|love/.test(text)) add('hopeful office-life hook');
  } else if (/phonk|퐁크/.test(genreText)) {
    add('phonk cowbell groove');
    if (/drill|드릴|build|빌드|hi[-\s]?hat|하이햇/.test(text + ' ' + genreText)) add('drill rhythm push');
    if (/urban|도시|그리움|dream|꿈|몽환|따뜻|warm/.test(text)) add('gritty urban tension');
    if (/설렘|flutter|cute|귀여|playful|warm|따뜻/.test(text)) add('playful fluttering hook');
  } else if (/g[-\s]?funk|g\s*펑크|지\s*펑크/.test(genreText)) {
    add('laid-back G-funk groove');
    if (/sine|사인|whiny|신스|synth|kalimba|칼림바|celesta|첼레스타/.test(text)) add('whiny synth lead');
    if (/밤|night|계절|season|밝|bright|파워풀|powerful/.test(text)) add('bright seasonal lift');
    if (/사랑|love|몰입|immersion|affection/.test(text)) add('powerful love hook');
  } else if (/ballad[-\s]?trot|발라드\s*트로트|korean\s*ballad\s*trot/.test(genreText)) {
    add('ballad-trot rhythm');
    if (/80s|80년대|synth|신스|analog|아날로그/.test(text + ' ' + genreText)) add('80s synth color');
    if (/지하철|subway|꿈|dream|비통|sorrow|어두|dark/.test(text)) add('subway-dream tension');
    if (/미니멀|minimal|hope|희망|고향|home/.test(text)) add('bittersweet minimal hook');

  } else if (/k[-_\s]?trap|케이\s*트랩|트랩/.test(genreText)) {
    add('K-trap bounce');
    if (/melodic\s*rap|멜로딕\s*랩|랩|rap/.test(text + ' ' + genreText)) add('melodic-rap hook flow');
    if (/2020s|hyper|digital|하이퍼|디지털|glitch|글리치/.test(text)) add('hyper-digital stop-start contrast');
    if (/추억|회상|memory|familiar|익숙|편의점|방|장소|place/.test(text)) add('familiar-place memory turn');
    if (/기다림|waiting|방황|wander|오묘|mysterious/.test(text)) add('restless late-night trap turn');
  } else if (/chiptune|칩튠|8[-\s]?bit|8비트/.test(genreText)) {
    add('playful chiptune pulse');
    if (/8[-\s]?bit|square|pulse|noise|칩튠|게임|pixel/.test(text + ' ' + genreText)) add('8-bit section flips');
    if (/귀여움에서\s*광기|cute-to-madness|광기|obsess|집착|불안|anxious/.test(text)) add('cute-to-madness switch');
    if (/꿈|dream|fantasy|판타지|명상|relax|릴렉스/.test(text)) add('dreamlike game-world turn');
    if (/어둡|dark|웃픈|comic|warm|따뜻|불안|anxious/.test(text)) add('anxious warm hook');
  } else if (/neo\s*soul|네오\s*소울/.test(genreText)) {
    add('deep-pocket neo-soul groove');
    if (/90s|리듬\s*팝|bounce|바운스/.test(text)) add('90s R&B bounce lift');
    if (/2010s|polished|glossy|폴리시|아이돌|pop energy/.test(text)) add('polished pop chorus rise');
    if (/전통|국악|가야금|해금|장구|traditional|gayageum|haegeum|janggu/.test(text)) add('traditional-color bridge turn');
    if (/재회|reunion|가족|family|불안|희망|hope|동화|fairy|comic|코믹/.test(text)) add('reunion hope hook');
  } else if (/celtic|켈틱/.test(genreText)) {
    add('Celtic folk-band motion');
    if (/acoustic|어쿠스틱|band|밴드/.test(text + ' ' + genreText)) add('acoustic travel groove');
    if (/여행|travel|moving|place|장소|코믹|comic|playful|dark|어두|아련|wistful/.test(text)) add('playful-dark verse turn');
    if (/따뜻|warm|아늑|cozy|미련|unresolved|위태|불안|anxious/.test(text)) add('warm unresolved hook');
  } else if (/nu\s*metal|뉴\s*메탈|뉴메탈/.test(genreText)) {
    add('heavy nu-metal section contrast');
    if (/rap[-\s]?sing|랩싱|랩|rap|turntable|턴테이블/.test(text)) add('rap-sung verse pressure');
    if (/방|room|오해|misunderstanding|미련|기다림|waiting|private/.test(text)) add('private-room conflict turn');
    if (/웃픈|comic|playful|dark|어두|위태|불안/.test(text)) add('comic dark hook');
  } else if (/j[-_\s]?indie|j\s*indie|인디팝|indie\s*pop/.test(genreText)) {
    add('gentle J-indie band build');
    if (/도시|도시적|city|urban|카페|cafe/.test(text) && /사랑|고백|연인|love|romantic|confession|affection/.test(text)) add('urban everyday-love hook');
    else if (/도시|도시적|city|urban|카페|cafe/.test(text)) add('urban everyday scene hook');
    if (/벅찬|overwhelmed|swelling|감정\s*고조|빌드업/.test(text)) add('heart-swelling emotional lift');
    else if (/사랑|고백|연인|love|romantic|confession|affection/.test(text)) add('romantic emotional lift');
  } else if (/string\s*ensemble|현악\s*합주|스트링\s*앙상블/.test(genreText)) {
    add('string-led cinematic build');
    if (/retro|disco|디스코/.test(text + ' ' + genreText)) add('retro-disco rhythmic bounce');
    if (/성장|hope|희망|cautious|조심/.test(text)) add('quiet growth turn');
    if (/고백|love|confession|사랑/.test(text)) add('hopeful confession hook');
  } else if (/dream\s*pop|드림팝/.test(genreText)) {
    add('dream-pop haze flow');
    if (/anime|애니|opening|오프닝|j[-_\s]?pop/.test(text)) add('anime-opening lift');
    if (/breakbeat|브레이크비트/.test(text)) add('breakbeat section turn');
    if (/90s|r&b|리듬\s*팝|rhythm\s*pop|바운스|bounce/.test(text)) add('smooth R&B pre-chorus lift');
  } else if (/bedroom\s*pop|베드룸\s*팝/.test(genreText)) {
    add('intimate bedroom-pop groove');
    if (/70s|disco|디스코/.test(text + ' ' + genreText)) add('soft disco bounce');
    if (/90s|r&b|리듬\s*팝|warm studio|바운스/.test(text)) add('warm 90s-R&B lift');
  } else if (/eurobeat|유로비트/.test(genreText)) {
    add('high-speed eurobeat drive');
    if (/j[-_\s]?rock|j[-_\s]?록|rock|록|band|밴드/.test(text + ' ' + genreText)) add('J-rock chorus lift');
    if (/synth|신스|brass|브라스|driving|drive|베이스/.test(text)) add('fast synth-pop break');
  } else if (/fantasy|판타지|dark fantasy|다크 판타지/.test(genreText)) {
    add(/dark|어두|다크|ominous|으스스|비|rain/.test(text + ' ' + genreText) ? 'dark fantasy tension' : 'fantasy scene build');
    if (/nu[-_\s]?disco|뉴\s*디스코|disco|디스코/.test(text + ' ' + genreText)) add('nu-disco groove pulse');
    if (/rain|비|rainy|일상|everyday/.test(text)) add('rainy scene turn');
  } else if (/j[-_\s]?electro|j\s*electro|제이\s*일렉|일렉트로/.test(genreText)) {
    add('tight J-electro pulse');
    if (/drill|드릴|hi[-\s]?hat|하이햇/.test(text)) add('drill-hihat tension');
    if (/digital\s*compression|compressed|디지털\s*압축/.test(text)) add('compressed digital break');
    if (/guitar\s*solo|기타\s*솔로/.test(text)) add('guitar-solo lift');
    if (/수중|submerged|underwater|먹먹|muffled/.test(text)) add('submerged digital turn');
  } else if (/synthwave|신스웨이브/.test(genreText)) {
    add('retro synth pulse');
    if (/drive|driving|드라이브/.test(text)) add('room-to-night-drive motion');
    else if (/night|밤|새벽|방|room/.test(text)) add('late-night synth motion');
    if (/감정적인\s*빌드업|emotional build|build[-\s]?up|브레이크다운|breakdown/.test(text)) add('emotional build-up turn');
    if (/시원|cool|비통|sorrow|설렘|flutter/.test(text)) add('bittersweet neon hook');
  } else if (/dubstep|덥스텝/.test(genreText)) {
    add('half-time dubstep drop');
    add('sharp verse-to-drop contrast');
    if (/k[-\s]?band|band\s*pop\s*rock|pop\s*rock|밴드|rock|록/.test(text + ' ' + genreText)) add('K-band chorus lift');
    if (/2010s|polished|폴리시|glossy|pop energy/.test(text)) add('polished pop-rise bridge');
  } else if (/k[-_\s]?ballad|발라드/.test(genreText)) {
    add('emotional ballad build');
    if (/punk|펑크|rock|록/.test(text + ' ' + genreText)) add('punk-rock lift');
    if (/shout|비고|외침|hook|후렴/.test(text)) add('shoutable final hook');
  } else if (/k[-_\s]?r&b|r&b|알앤비/.test(genreText)) {
    add('slow pocket groove');
    add('close vocal space');
    if (/punk|펑크|rock|록/.test(text + ' ' + genreText)) add('subtle band-edge lift');
    if (/late[-\s]?night|밤|새벽|city|도시|고향|안식|위로/.test(text)) add('smooth late-night transition');
  } else if (/p[-\s]?funk|피\s*펑크|funk\s*jazz|펑크\s*재즈/.test(genreText)) {
    add('P-funk jazz groove');
    if (/record\s*scratch|scratch|스크래치|turntable|턴테이블/.test(text)) add('scratch-led breaks');
    if (/horn|brass|혼|브라스|stab|스탭/.test(text)) add('horn-stab accents');
    if (/late[-\s]?night|night|stop|정류장|밤|새벽/.test(text)) add('late-night bus-stop tension');
    else add('syncopated funk-jazz hook');
  } else if (/cool\s*jazz|jazz|재즈/.test(genreText)) {
    add('flexible jazz groove');
    if (/p[-\s]?funk|피\s*펑크|funk|펑크/.test(text + ' ' + genreText)) add('P-funk jazz pocket');
    if (/record\s*scratch|scratch|스크래치|turntable|턴테이블/.test(text)) add('scratch-led breaks');
    if (/horn|brass|혼|브라스|stab|스탭/.test(text)) add('horn-stab accents');
    if (/late[-\s]?night|night|stop|정류장|밤|새벽/.test(text)) add('late-night bus-stop tension');
    if (/outrun|아웃런/.test(text + ' ' + genreText)) add('outrun drive contrast');
    if (/low[-\s]?end|저음|beat|비트/.test(text)) add('soft rhythmic pocket');
  } else if (/blues\s*rock|블루스\s*록/.test(genreText)) {
    add('band-driven blues-rock build');
    if (/house|하우스/.test(text + ' ' + genreText)) add('house pulse contrast');
    if (/guitar|기타|solo|솔로/.test(text)) add('guitar-led chorus release');
  } else if (/trot|트로트/.test(genreText)) {
    add('steady traditional-trot rhythm');
    add('rounded vibrato space');
    if (/melodic\s*rap|멜로딕\s*랩/.test(text + ' ' + genreText)) add('melodic-rap bridge turn');
  } else if (/post[-_\s]?punk|포스트\s*펑크|postpunk/.test(genreText)) {
    add('angular post-punk groove');
    if (/singalong|따라\s*부르는|후렴/.test(text)) add('singalong chorus turn');
  }

  const sceneHook = buildArrangementSceneHook(params);
  if (sceneHook) add(sceneHook);

  return parts.slice(0, 5);
}


function removeIncompleteAtmosphereEnding(value: string): string {
  let cleaned = cleanupPromptTail(value);
  cleaned = cleaned
    .replace(/\bwhere\s+words\s+that\s+never(?:\s+\w+){0,4}\s*$/i, 'where unsaid words stay unresolved')
    .replace(/\bwhere\s+(?:the\s+)?(?:words|feelings|memories|promises|silence)\s+that\s+never(?:\s+\w+){0,4}\s*$/i, 'where unresolved feelings stay present')
    .replace(/\bwhere\s+wanting\s+to\s+speak\s+first\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\s*$/i, 'where the urge to speak first hides the most important feeling')
    .replace(/\bwhere\s+(?:trying|wanting)\s+to\s+[^,]{1,70}\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\s*$/i, 'where the hidden feeling stays unresolved')
    .replace(/\bwhere\s+[^,]{1,52}\s+(?:that|who|which|when|while|with|in|and|or|to|of|for|from|through|around)\s*$/i, '')
    .replace(/\b(?:where|that|with|in|and|or|while|as|through|around|into|from|to|of|for)\s*$/i, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleanupPromptTail(cleaned);
}

function finalizeAtmosphereSentence(value: string): string {
  let cleaned = cleanupPromptTail(value);
  cleaned = cleaned
    .replace(/\b(a|an)\s+([a-z][a-z\s-]+?)\s+scene\s+in\s+\2(?:\s+scene)?\s+in\b/gi, '$1 $2 scene in')
    .replace(/\b(a|an)\s+([a-z][a-z\s-]+?)\s+scene\s+in\s+\2(?:\s+scene)?(?:\s*,|$)/gi, '$1 $2 scene')
    .replace(/\b([a-z][a-z\s-]+?\s+scene)\s+in\s+\1\b/gi, '$1')
    .replace(/\b(scene)\s+in\s+([^,]+?)\s+scene\s+in\b/gi, '$1 in')
    .replace(/\b(an?\s+[^,]+?\s+scene)\s+in\s+an?\s+\1\b/gi, '$1')
    .replace(/\b(unresolved misunderstanding scene)\s+in\s+unresolved misunderstanding\b/gi, '$1')
    .replace(/\b(tender affection scene)\s+in\s+tender affection\b/gi, '$1')
    .replace(/\b(quiet tender affection scene)\s+in\s+quiet tender affection\b/gi, '$1')
    .replace(/\b(anxious unresolved misunderstanding scene)\s+in\s+anxious unresolved misunderstanding\b/gi, '$1')
    .replace(/\bwhere\s+words\s+that\s+never(?:\s+\w+){0,4}\s*$/i, 'where unsaid words stay unresolved')
    .replace(/\bwhere\s+(?:the\s+)?(?:words|feelings|memories|promises|silence)\s+that\s+never(?:\s+\w+){0,4}\s*$/i, 'where unresolved feelings stay present')
    .replace(/\s{2,}/g, ' ');

  cleaned = removeRepeatedAtmosphereFragments(cleaned);
  cleaned = removeIncompleteAtmosphereEnding(cleaned);
  return cleanupPromptTail(cleaned);
}

function splitArrangementParts(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean);
}

function removeRepeatedAtmosphereFragments(value: string): string {
  let cleaned = cleanupPromptTail(value);
  cleaned = cleaned
    .replace(/\b(a|an)\s+([a-z][a-z\s-]+?)\s+scene\s+in\s+\2(?:\s+scene)?\s+in\b/gi, '$1 $2 scene in')
    .replace(/\b(a|an)\s+([a-z][a-z\s-]+?)\s+scene\s+in\s+\2(?:\s+scene)?(?:\s*,|$)/gi, '$1 $2 scene')
    .replace(/\b(tender affection scene)\s+in\s+tender affection\s+in\b/gi, '$1 in')
    .replace(/\b(held-back confession scene)\s+in\s+held-back confession\s+in\b/gi, '$1 in')
    .replace(/\b(lingering memory scene)\s+in\s+lingering memory\s+in\b/gi, '$1 in')
    .replace(/\b(quiet change scene)\s+in\s+quiet change\s+in\b/gi, '$1 in')
    .replace(/\b(a|an)\s+([a-z][a-z\s-]+?\s+scene)\s+in\s+\2\b/gi, '$1 $2')
    .replace(/\bwith\s+([^,]+?)\s+with\s+\1\b/gi, 'with $1')
    .replace(/\b([^,]+? tone)\s+and\s+\1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ');
  return repairAtmosphereSyntax(cleaned);
}

function isGenericArrangementPart(part: string): boolean {
  return /^(?:sharp section contrast|polished chorus lift|warm release|soft emotional release|focused hook|singalong chorus|phrase-led singalong chorus|contradictory hook with calm delivery|subtle lift|clean hook lift|clear sectional contrast|bouncy section flow|improvisational interplay|controlled emotional turn)$/i.test(cleanupPromptTail(part));
}

function isInstrumentPerformanceArrangementPart(part: string): boolean {
  return /\b(?:wobble-bass pressure|808 low-end hits|punchy drum hits|funk-guitar bounce|funk-guitar pulses|muted funk-guitar tension|double-drum lift|double-drum drive|double-drum emotional lift|dreamy synth breaks|dreamy synth haze|dreamy synth space|driving bass movement|angular guitar stabs)\b/i.test(part);
}

function isThinArrangementParts(parts: string[]): boolean {
  const nonTempo = parts.filter((part) => !/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part));
  if (!nonTempo.length) return true;
  if (nonTempo.length <= 1) return true;
  const genericCount = nonTempo.filter(isGenericArrangementPart).length;
  if (nonTempo.length <= 2 && genericCount >= 1) return true;
  const text = nonTempo.join(' ').toLowerCase();
  if (/^(?:muted guitar tension|urban reflections|spatial echoes|intimate room echoes|focused hook|soft emotional release|warm release)$/i.test(text.trim())) return true;
  return false;
}

function buildArrangementRescueParts(lineParts: string[], intentParts: string[], params: GenerateSongParams): string[] {
  const tempo = lineParts.find((part) => /\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part))
    || normalizeTempoForArrangement(buildTempoPromptPhrase(params))
    || getGenreDefaultTempoForArrangement(params);
  const usefulIntent = intentParts
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean)
    .filter((part) => !isGenericArrangementPart(part))
    .filter((part) => !isInstrumentPerformanceArrangementPart(part));
  const stabilizers = buildArrangementStabilizerParts(params)
    .filter((part) => !isInstrumentPerformanceArrangementPart(part));
  const rescued = dedupePromptParts([tempo, ...usefulIntent, ...stabilizers], 7);
  return rescued.length > 1 ? rescued : lineParts;
}

function replaceGenericArrangementHooks(parts: string[], intentParts: string[]): string[] {
  if (!intentParts.length) return parts;
  const intentText = intentParts.join(' ').toLowerCase();
  const specificHooks = intentParts.filter((part) => /\b(?:hook|chorus|lift|turn|bridge|release|drop|contrast|transition|break|pulse|groove|rhythm|build)\b/i.test(part));
  const replacement = specificHooks.find((part) => !isGenericArrangementPart(part)) || intentParts.find((part) => !isGenericArrangementPart(part));
  let usedReplacement = false;
  const mapped = parts.flatMap((part) => {
    if (!isGenericArrangementPart(part)) return [part];
    if (!replacement) return [];
    const lowerPart = part.toLowerCase();
    // Keep a generic hook only when the intent has no better hook/chorus/turn information.
    if (/focused hook|soft emotional release|warm release|polished chorus lift|subtle lift|singalong chorus|phrase-led singalong chorus/.test(lowerPart) && /hook|chorus|lift|turn|bridge|release|drop|contrast/.test(intentText)) {
      if (usedReplacement) return [];
      usedReplacement = true;
      return [replacement];
    }
    return [part];
  });
  return mapped.length ? mapped : parts;
}


function arrangementSemanticFamily(part: string): string {
  const value = cleanupPromptTail(part).toLowerCase();
  if (/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*bpm\b/i.test(value)) return 'tempo';
  if (/jazz.*(?:groove|pocket)|(?:groove|pocket).*jazz|syncopated turns|conversational phrasing|smooth instrumental breaks/.test(value)) return 'jazz-motion';
  if (/punk.*(?:lift|contrast)|rock.*(?:lift|contrast)|sudden switch|switch-ups|clear sectional contrast/.test(value)) return 'contrast-lift';
  if (/dreamy.*(?:break|section|space)|dream.*break|synth break/.test(value)) return 'dream-break';
  if (/office|after-work|회사|urban love|everyday-love|city-cafe|neighborhood|subway|scene hook|walk hook|release hook|confession hook|waiting hook|reunion|memory|love hook|fluttering hook/.test(value)) return 'scene-hook';
  if (/phonk|cowbell|drill rhythm|g-funk|funk groove|ballad-trot|trot rhythm|deep-house|house.*groove|techno|sarod|italian-pop|mystery-bgm|bgm/.test(value)) return 'main-motion';
  if (/generic|focused hook|bouncy section flow|soft emotional release|controlled emotional turn|improvisational interplay/.test(value)) return 'generic';
  return value.replace(/\b(?:and|with|the|a|an)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
}

function balanceNormalArrangementLength(line: string, stabilizerParts: string[], params: GenerateSongParams): string {
  // Keep this only for normal prompt mode. Situation mode has a different structure
  // and should not inherit normal-mode compression rules.
  if (hasSituation(params.situation)) return cleanupPromptTail(line);

  const currentParts = splitArrangementParts(line);
  if (!currentParts.length) return cleanupPromptTail(line);

  const tempo = currentParts.find((part) => /\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part));
  const nonTempo = currentParts.filter((part) => part !== tempo);
  const hasTooManyParts = nonTempo.length > 5;
  const hasGenericOnlyEnding = nonTempo.length <= 2 || nonTempo.some(isGenericArrangementPart);
  const hasDuplicateFamilies = (() => {
    const seen = new Set<string>();
    for (const part of nonTempo) {
      const family = arrangementSemanticFamily(part);
      if (family && seen.has(family)) return true;
      seen.add(family);
    }
    return false;
  })();

  if (!hasTooManyParts && !hasGenericOnlyEnding && !hasDuplicateFamilies) {
    return cleanupPromptTail(line);
  }

  const candidates = dedupePromptParts([
    ...(tempo ? [tempo] : []),
    ...stabilizerParts,
    ...nonTempo,
  ], 18)
    .map(cleanupPromptTail)
    .filter(Boolean)
    .filter((part) => !isInstrumentPerformanceArrangementPart(part))
    .filter((part) => !isGenericArrangementPart(part));

  const balanced: string[] = [];
  const families = new Set<string>();
  for (const part of candidates) {
    const family = arrangementSemanticFamily(part);
    if (family === 'tempo') {
      if (!balanced.some((item) => arrangementSemanticFamily(item) === 'tempo')) balanced.push(part);
      continue;
    }
    if (families.has(family)) continue;
    families.add(family);
    balanced.push(part);
    const nonTempoCount = balanced.filter((item) => arrangementSemanticFamily(item) !== 'tempo').length;
    if (nonTempoCount >= 4) break;
  }

  // If the source was too short, allow one more specific stabilizer cue, but never
  // let the line grow back into a long list.
  if (balanced.filter((item) => arrangementSemanticFamily(item) !== 'tempo').length < 3) {
    for (const part of stabilizerParts) {
      const family = arrangementSemanticFamily(part);
      if (!families.has(family) && !isGenericArrangementPart(part)) {
        families.add(family);
        balanced.push(part);
      }
      if (balanced.filter((item) => arrangementSemanticFamily(item) !== 'tempo').length >= 3) break;
    }
  }

  return cleanupPromptTail(mergeHookArrangementParts(balanced.filter(Boolean)).join(', '));
}


function deriveExtraArrangementMotionCues(params: GenerateSongParams): string[] {
  const text = getIntentKeywordText(params);
  const genreText = getSelectedFusionGenres(params).map((genre) => `${genre.id} ${genre.label}`).join(' ').toLowerCase();
  const cues: string[] = [];
  const add = (value: string) => {
    const cleaned = cleanupPromptTail(value);
    if (cleaned && !cues.some((cue) => cue.toLowerCase() === cleaned.toLowerCase())) cues.push(cleaned);
  };

  if (/anime|애니/.test(text + ' ' + genreText)) add('anime-rock section drive');
  if (/k[-\s]?band|밴드|rock|록/.test(text + ' ' + genreText)) add('band-driven lift');
  if (/funk|펑크|wah|슬랩|slap/.test(text + ' ' + genreText)) add('funk groove accents');
  if (/steel\s*drum|스틸\s*드럼/.test(text)) add('steel-drum accent turns');
  if (/sitar|시타르/.test(text)) add('sitar melodic turns');
  if (/drill|드릴/.test(text + ' ' + genreText)) add('drill-hat cuts');
  if (/808|sub\s*bass|서브|low[-\s]?end/.test(text)) add('808 low-end motion');
  if (/swing|재즈|jazz/.test(text + ' ' + genreText)) add('swing-jazz phrasing lift');
  if (/성당|cathedral|hall|홀|reverb|리버브/.test(text)) add('wide reverb transitions');
  if (/헬멧|helmet|먹먹|muffled|underwater|수중/.test(text)) add('muffled-space break');
  if (/fantasy|판타지|마법|magical/.test(text)) add('fantasy release hook');
  if (/growth|성장|변화|change/.test(text)) add('growth-release hook');
  if (/regret|후회|이별|breakup/.test(text)) add('regret-to-release turn');
  if (/calm|차분|릴렉스|relax|relaxed/.test(text)) add('controlled soft lift');

  return cues.slice(0, 5);
}

function strengthenArrangementMinimum(line: string, params: GenerateSongParams, stabilizerParts: string[], intentParts: string[]): string {
  if (hasSituation(params.situation)) return cleanupPromptTail(line);
  const parts = splitArrangementParts(line);
  if (!parts.length) return cleanupPromptTail(line);

  const tempo = parts.find((part) => /\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part))
    || normalizeTempoForArrangement(buildTempoPromptPhrase(params))
    || getGenreDefaultTempoForArrangement(params);
  const nonTempo = parts.filter((part) => part !== tempo);
  const extra = deriveExtraArrangementMotionCues(params);
  const usefulIntent = [...stabilizerParts, ...intentParts, ...extra]
    .map(cleanupPromptTail)
    .filter(Boolean)
    .filter((part) => !isGenericArrangementPart(part))
    .filter((part) => !isInstrumentPerformanceArrangementPart(part));

  const weak = nonTempo.length <= 2 || nonTempo.every(isGenericArrangementPart) || /\b(?:anime-opening section drive|change-and-growth hook|playful confession hook|focused hook|controlled emotional turn)$/i.test(nonTempo.join(', '));
  if (!weak) return cleanupPromptTail(line);

  const rebuilt: string[] = [];
  if (tempo) rebuilt.push(tempo);
  for (const part of [...nonTempo, ...usefulIntent]) {
    const cleaned = cleanupPromptTail(part)
      .replace(/\banime-opening section drive\b/gi, 'anime-rock section drive')
      .replace(/\bchange-and-growth hook\b/gi, 'growth-release hook');
    if (!cleaned || isGenericArrangementPart(cleaned) || isInstrumentPerformanceArrangementPart(cleaned)) continue;
    const family = arrangementSemanticFamily(cleaned);
    if (rebuilt.some((item) => arrangementSemanticFamily(item) === family)) continue;
    rebuilt.push(cleaned);
    const nonTempoCount = rebuilt.filter((item) => arrangementSemanticFamily(item) !== 'tempo').length;
    if (nonTempoCount >= 4) break;
  }

  if (rebuilt.filter((item) => arrangementSemanticFamily(item) !== 'tempo').length < 3) {
    for (const part of usefulIntent) {
      const family = arrangementSemanticFamily(part);
      if (!rebuilt.some((item) => arrangementSemanticFamily(item) === family)) rebuilt.push(part);
      if (rebuilt.filter((item) => arrangementSemanticFamily(item) !== 'tempo').length >= 3) break;
    }
  }

  return cleanupPromptTail(mergeHookArrangementParts(dedupePromptParts(rebuilt, 8).filter(Boolean)).join(', '));
}

function applyIntentToArrangementLine(line: string, params: GenerateSongParams): string {
  const intent = buildPromptIntent(params);
  let cleaned = stripFinalInternalProtectionLanguage(cleanupPromptTail(String(line || '')));
  const stabilizerParts = buildArrangementStabilizerParts(params);
  const intentParts = dedupePromptParts([
    ...splitArrangementParts(intent.arrangementMotion.replace(/\band\b/g, ',')),
    ...stabilizerParts,
  ], 10);

  // Remove terms that belong in [Instruments] rather than [Arrangement].
  let meaningfulParts = splitArrangementParts(cleaned)
    .map((part) => cleanupPromptTail(part)
      .replace(/\bStudy\s+Beats\s+fusion\b/gi, 'subtle study-beat pulse')
      .replace(/\bbreath-led\s+verse\s+with\s+a\s+restrained\s+hook\b/gi, 'breath-blurred verse with a restrained hook')
      .replace(/\bcontrolled\s+verse\s+and\s+contradictory\s+hook\b/gi, 'controlled verse-to-hook tension')
      .replace(/\bcontrolled\s+emotional\s+turn\s+and\s+bouncy\s+section\s+flow\b/gi, 'controlled emotional turn')
      .replace(/\buse\s+guitar-like\s+synth\s+lead\s+as\s+short\s+point\s+accents\s+in\s+key\s+transitions\b/gi, 'synth-lead transition accents')
      .replace(/\bno\s+balanced\s+call-response\b/gi, 'one-sided monologue flow')
      .replace(/\bone-sided\s+monologue\s+focus\s+with\s+single-owner\s+choruses\b/gi, 'one-sided monologue flow, single-owner choruses')
      .replace(/\bspacey\s+echo\s+breaks\s*,\s*spatial\s+echoes\b/gi, 'spacey echo breaks')
      .replace(/\bspatial\s+echoes\s*,\s*spacey\s+echo\s+breaks\b/gi, 'spacey echo breaks')
    )
    .filter(Boolean)
    .filter((part) => !isInstrumentPerformanceArrangementPart(part));

  meaningfulParts = replaceGenericArrangementHooks(meaningfulParts, intentParts);

  const lower = meaningfulParts.join(' ').toLowerCase();
  const nonTempoBeforeAppend = meaningfulParts.filter((part) => !/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part));
  const stabilizerMissing = stabilizerParts.some((part) => !lower.includes(part.toLowerCase().replace(/^and\s+/, '')));
  const shouldAppendIntent = Boolean(intentParts.length) && (
    nonTempoBeforeAppend.length <= 3 ||
    meaningfulParts.some(isGenericArrangementPart) ||
    (Boolean(stabilizerParts.length) && stabilizerMissing) ||
    intentParts.some((part) => !lower.includes(part.toLowerCase().replace(/^and\s+/, '')))
  );

  if (shouldAppendIntent) {
    meaningfulParts = dedupePromptParts([...meaningfulParts, ...intentParts], 16)
      .filter((part) => !isInstrumentPerformanceArrangementPart(part));
    meaningfulParts = replaceGenericArrangementHooks(meaningfulParts, intentParts);
  }

  cleaned = mergeHookArrangementParts(meaningfulParts).join(', ')
    .replace(/\bsharp section contrast\s*,\s*/gi, '')
    .replace(/\bspacey\s+echo\s+breaks\s*,\s*spatial\s+echoes\b/gi, 'spacey echo breaks')
    .replace(/\bspatial\s+echoes\s*,\s*spacey\s+echo\s+breaks\b/gi, 'spacey echo breaks')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();

  const finalParts = splitArrangementParts(cleaned);
  const nonTempoMeaningfulParts = finalParts.filter((part) => !/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part));
  const genericArrangementPartCount = nonTempoMeaningfulParts.filter(isGenericArrangementPart).length;
  const looksTooThin =
    isThinArrangementParts(finalParts) ||
    nonTempoMeaningfulParts.length <= 1 ||
    (nonTempoMeaningfulParts.length <= 2 && genericArrangementPartCount >= 1) ||
    /^(?:\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM,\s*)?(?:intimate room echoes|spatial echoes|urban reflections)$/i.test(cleaned);

  const missingStableAfterMerge = stabilizerParts.length > 0 && stabilizerParts.every((part) => !cleaned.toLowerCase().includes(part.toLowerCase()));
  if ((looksTooThin || missingStableAfterMerge) && intentParts.length) {
    cleaned = mergeHookArrangementParts(buildArrangementRescueParts(finalParts, intentParts, params)).join(', ');
  }

  // Final safety: if a random combination still ends on a bare generic hook/flow,
  // rebuild from stable song-movement cues rather than deleting the arrangement.
  const postRescueParts = splitArrangementParts(cleaned);
  const postNonTempo = postRescueParts.filter((part) => !/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part));
  const stillWeak = postNonTempo.length <= 2 || postNonTempo.some(isGenericArrangementPart) || /\b(?:bouncy section flow|focused hook|soft emotional release|contradictory hook with calm delivery|clear sectional contrast|improvisational interplay)\b/i.test(cleaned);
  if (stillWeak && stabilizerParts.length >= 2) {
    const tempo = postRescueParts.find((part) => /\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part))
      || normalizeTempoForArrangement(buildTempoPromptPhrase(params))
      || getGenreDefaultTempoForArrangement(params);
    cleaned = mergeHookArrangementParts(dedupePromptParts([tempo, ...stabilizerParts], 7)).join(', ');
  }

  // Final main-genre priority guard: the first real movement should come from the
  // primary genre, while style/mood hooks stay behind it. This prevents random
  // combinations from starting with generic emotion or only a secondary texture.
  if (stabilizerParts.length) {
    const partsAfterWeakFix = splitArrangementParts(cleaned);
    const tempoPart = partsAfterWeakFix.find((part) => /\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part));
    const nonTempoAfterWeakFix = partsAfterWeakFix.filter((part) => part !== tempoPart);
    const primaryMove = stabilizerParts[0];
    const hasPrimaryMove = nonTempoAfterWeakFix.some((part) => part.toLowerCase() === primaryMove.toLowerCase());
    if (!hasPrimaryMove && nonTempoAfterWeakFix.length <= 5) {
      cleaned = mergeHookArrangementParts(dedupePromptParts([tempoPart, primaryMove, ...nonTempoAfterWeakFix, ...stabilizerParts.slice(1)], 7).filter(Boolean)).join(', ');
    }
  }

  cleaned = balanceNormalArrangementLength(cleaned, stabilizerParts, params);

  const finalGuardParts = splitArrangementParts(cleaned);
  const finalGuardTempo = finalGuardParts.find((part) => /\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i.test(part))
    || normalizeTempoForArrangement(buildTempoPromptPhrase(params))
    || getGenreDefaultTempoForArrangement(params);
  const finalGuardNonTempo = finalGuardParts.filter((part) => part !== finalGuardTempo);
  const needsMinimumMovementGuard =
    !hasSituation(params.situation) &&
    (finalGuardNonTempo.length <= 1 ||
      finalGuardNonTempo.every(isGenericArrangementPart) ||
      /^(?:\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM,\s*)?(?:focused hook|bouncy section flow|controlled emotional turn)$/i.test(cleaned));
  if (needsMinimumMovementGuard) {
    const minimumParts = dedupePromptParts([
      finalGuardTempo,
      ...stabilizerParts,
      ...intentParts.filter((part) => !isInstrumentPerformanceArrangementPart(part)),
      ...finalGuardNonTempo,
    ], 8).filter(Boolean);
    cleaned = mergeHookArrangementParts(minimumParts).join(', ');
    cleaned = balanceNormalArrangementLength(cleaned, stabilizerParts, params);
  }

  cleaned = strengthenArrangementMinimum(cleaned, params, stabilizerParts, intentParts);

  if (getSelectedPrimaryGenreKey(params) === 'trot' && /youthful pleading warmth/i.test(intent.vocalDelivery)) {
    const tempoMatch = cleaned.match(/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b/i);
    const tempo = tempoMatch ? tempoMatch[0] : normalizeTempoForArrangement(buildTempoPromptPhrase(params)) || getGenreDefaultTempoForArrangement(params);
    const forcedParts = [
      tempo,
      'steady traditional-trot rhythm',
      'rounded vibrato space',
      'youthful pleading lift',
      'phrase-led singalong chorus',
    ].filter(Boolean);
    return cleanupPromptTail(dedupePromptParts(forcedParts, 8).join(', '));
  }

  cleaned = stripFinalInternalProtectionLanguage(cleaned);
  if (isBrokenFinalPromptPhrase(cleaned) || splitArrangementParts(cleaned).some((part) => isBrokenFinalPromptPhrase(part))) {
    cleaned = buildNaturalDirectArrangementFallback(params, cleaned);
  }

  return cleanupPromptTail(cleaned);
}

function compactSpaceAndTransitionCue(params: GenerateSongParams): string {
  // Space texture belongs to Atmosphere. Mood-transition values do NOT belong here;
  // they are structural events and are handled by compactMoodTransitionCue().
  const space = getAtmosphereSpaceCues(params)
    .map((item) => cleanProductionPhrase(stripRemainingKoreanForProductionPrompt(item)))
    .filter(Boolean)
    .slice(0, 2);
  const text = [space.join(" "), selectedStyleText(params)].join(" ").toLowerCase();
  const cues: string[] = [];

  if (/room|small room|방|intimate/.test(text)) cues.push("intimate room echoes");
  else if (/alley|street|urban|city|도시|골목/.test(text)) cues.push("urban reflections");
  else if (/space|spacious|ambient|reverb|echo|앰비언트|공간/.test(text)) cues.push("spatial echoes");

  return joinPromptPhrase(cues.slice(0, 1), "and");
}

function compactMoodTransitionCue(params: GenerateSongParams): string {
  const style = buildStyleRecipeProfile(params);
  const arrangement = cleanProductionPhrase(stripRemainingKoreanForProductionPrompt(style.arrangementLens || ""));
  const text = [arrangement, selectedStyleText(params)].join(" ").toLowerCase();

  if (!/transition|전환|shift|switch|turn|twist|반전|horror|psychological|심리공포|burst|drop|release|climax|collapse|붕괴|조명/i.test(text)) {
    return "";
  }

  if (/귀여움.*광기|광기|madness|obsess|obsessive|cute.*mad|mad.*cute/.test(text)) return "cute-to-obsessive tension";
  if (/collapse|붕괴|조명|stage[-\s]?light/.test(text)) return "soft collapse turn";
  if (/horror|심리공포|psychological/.test(text)) return "subtle psychological tension";
  if (/comic|코믹|comedy|웃픈/.test(text)) return "comic turn";
  if (/dark|어두|cold|차갑/.test(text)) return "darker turn";
  if (/dream|몽환|dreamy/.test(text)) return "dreamy turn";
  if (/burst|폭발|climax|터지는/.test(text)) return "emotional burst";
  if (/release|풀리는|warm|따뜻/.test(text)) return "warm release";
  if (/drop|식는|cold/.test(text)) return "cold drop";
  return "controlled emotional turn";
}

function hasMoodTransitionCue(params: GenerateSongParams): boolean {
  return Boolean(compactMoodTransitionCue(params));
}

function rawUserMoodSceneText(params: GenerateSongParams): string {
  return [
    ...(params.moods ?? []),
    params.userInput || '',
    params.lyricDraft || '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function astronautMoodAtmospherePrefix(params: GenerateSongParams): string {
  const raw = rawUserMoodSceneText(params);
  const parts: string[] = [];
  const add = (value: string) => {
    if (value && !parts.some((part) => part.toLowerCase() === value.toLowerCase())) parts.push(value);
  };

  if (/빈티지|vintage|retro|레트로/.test(raw)) add('vintage');
  if (/아늑|cozy|coziness|포근/.test(raw)) add('cozy');
  if (/텅\s*빈|empty|hollow|공허/.test(raw)) add('empty-space');
  if (/앰비언트|ambient|조용히\s*들|distant\s+music|quiet\s+music/.test(raw)) add('ambient');
  if (/몽글|dreamy|드리미|몽환/.test(raw)) add('dreamy');
  if (/릴렉스|relax|calm|차분|명상/.test(raw)) add('calm');

  return parts.slice(0, 3).join(' ');
}

function buildThemeMoodInterpretation(params: GenerateSongParams): ThemeMoodInterpretation {
  const situationActive = hasSituation(params.situation);
  const moodAngle = buildCompactMoodAngle(params);
  const theme = buildThemeCoreScene(params);
  const spaceCue = compactSpaceAndTransitionCue(params);
  const transitionCue = compactMoodTransitionCue(params);
  const hasThemes = Boolean((params.themes ?? []).filter(Boolean).length);
  const hasMoods = Boolean((params.moods ?? []).filter(Boolean).length);

  if (!hasThemes && !hasMoods && !spaceCue && !transitionCue) {
    return { atmosphereCue: "", vocalCue: "", arrangementCue: "", lyricSceneCue: "", lyricDetailCue: "", strength: "weak" };
  }

  const strength: ThemeMoodInterpretation["strength"] = situationActive ? "weak" : hasThemes ? "strong" : "normal";
  const baseScene = situationActive ? "the active situation" : theme.scene;
  const moodPrefix = moodAngle ? `${moodAngle} ` : "";
  const spaceTail = spaceCue ? `with ${spaceCue}` : "";

  // Keep theme/story nouns visible in Atmosphere. Mood-transition cues are NOT placed here;
  // they are structural events handled by Arrangement + Bridge section tags.
  const joinedScene = (() => {
    if (situationActive) {
      return cleanupPromptTail([moodAngle ? `${moodAngle} color` : "", spaceTail].filter(Boolean).join(" with "));
    }
    if (!moodAngle) return cleanupPromptTail(`${baseScene}${spaceTail ? `, ${spaceTail}` : ""}`);
    const scene = cleanupPromptTail(baseScene);
    const sceneWithoutArticle = scene.replace(/^(?:a|an|one)\s+/i, "");
    const isFlutterScene = /flutter|mistake|message|reply|설렘/i.test(scene);
    const isAstronautMessageScene = /astronaut|space|earth|message|signal|transmission/i.test(scene)
      && /astronaut|earth|message|signal|transmission/i.test(scene);
    if (isFlutterScene && /obsessive/.test(transitionCue)) {
      return cleanupPromptTail(`${moodAngle} crush tension, a small fluttering mistake spiraling into obsession${spaceTail ? `, ${spaceTail}` : ""}`);
    }
    if (isAstronautMessageScene) {
      const directMoodPrefix = astronautMoodAtmospherePrefix(params);
      const prefix = directMoodPrefix || moodAngle || '';
      const hasDirectAmbientCue = /ambient|quiet music|distant music|앰비언트|조용히\s*들/i.test(rawUserMoodSceneText(params));
      const atmosphereTailParts = [
        hasDirectAmbientCue ? 'distant ambient music' : '',
        spaceCue,
      ].filter(Boolean);
      const atmosphereTail = atmosphereTailParts.length ? ` with ${atmosphereTailParts.join(' and ')}` : '';
      return cleanupPromptTail(`${prefix ? `${prefix} ` : ''}astronaut solitude, a fading signal drifting back toward Earth${atmosphereTail}`);
    }
    if (isFlutterScene) {
      return cleanupPromptTail(`${moodAngle} tension around ${sceneWithoutArticle}${spaceTail ? `, ${spaceTail}` : ""}`);
    }
    return buildAtmosphereFromSceneLayers(params, { moodAngle, fallbackScene: baseScene, spaceCue });
  })();

  const atmosphereCue = cleanupPromptTail(joinedScene
    .replace(/\bwarm\s+and\s+astronaut\b/gi, "warm moody astronaut")
    .replace(/\bwarm\s+and\s+mood\b/gi, "warm moody")
    .replace(/\bwarm\s+and\s+feeling\b/gi, "warm feeling")
    .replace(/\s{2,}/g, " "));

  const vocalCue = cleanupPromptTail(
    (situationActive
      ? [moodAngle ? `${moodAngle} restraint` : "", /comic|playful/.test(moodAngle) ? "playful subtext" : ""].filter(Boolean).join(" and ")
      : [moodAngle ? `${moodAngle} feeling` : "natural emotional restraint", hasThemes ? "story-aware delivery" : ""].filter(Boolean).join(" and "))
      .replace(/\bwarm\s+and\s+feeling\b/gi, "warm feeling")
      .replace(/\bwarm\s+and\s+moody\s+feeling\b/gi, "warm moody feeling"),
  );

  const moodShiftArrangement = transitionCue ? `mood shift after Stop into Bridge: ${transitionCue}` : "";
  const arrangementCue = cleanupPromptTail(
    situationActive
      ? [moodShiftArrangement, spaceCue, moodAngle && /tense|bittersweet/.test(moodAngle) ? "restrained emotional pressure" : ""].filter(Boolean).join(", ")
      : [moodShiftArrangement, spaceCue, /tense/.test(moodAngle) ? "restrained tension" : "", /bittersweet|wistful|warm/.test(moodAngle) ? "soft emotional release" : ""].filter(Boolean).join(", "),
  );

  return {
    atmosphereCue: limitText(atmosphereCue, situationActive ? 90 : 145),
    vocalCue: limitText(vocalCue, 90),
    arrangementCue: limitText(arrangementCue, 95),
    lyricSceneCue: theme.scene,
    lyricDetailCue: theme.detail,
    strength,
  };
}

function buildThemeMoodLyricInstruction(params: GenerateSongParams): string {
  const ctx = buildThemeMoodInterpretation(params);
  if (!ctx.lyricSceneCue && !ctx.lyricDetailCue && !ctx.atmosphereCue) return "";
  const situationMode = ctx.strength === "weak";
  const mode = situationMode
    ? "Use the active Situation as the lyric content source. Use Mood only as subtle interpretation color inside that Situation; do not create a new plot from Mood."
    : "Use Theme as the lyric content source. Use Mood only to reinterpret that Theme through emotional behavior, pressure, pacing, metaphor style, scene texture, and sentence temperature.";
  return `THEME + MOOD LYRIC BOUNDARY (MANDATORY):
- ${mode}
- Lyric story source: ${ctx.lyricSceneCue || "the active situation"}.
- Allowed concrete details from Theme/Situation: ${ctx.lyricDetailCue || "small visible behavior and everyday objects"}.
- Mood must NOT become lyric subject matter. It may decide how the existing Theme/Situation content is expressed: how the character speaks, hides, hesitates, jokes, panics, softens, escalates, breathes, imagines, or phrases the feeling.
- Do NOT directly repeat selected mood labels, mood English values, genre/style names, sound names, instrument names, hook/transition terms, or production words in lyric lines OR section-tag cues.
- Section tags may use only compact performance/section-function cues. Convert mood into behavior cues such as hesitant, tense, playful subtext, soft panic, restrained, or emotional lift; do not write literal mood labels such as magical, dark, cute, synthwave, glitchy, neon, guitar, synth.
- Lyric section tags should describe emotional execution, not production texture or new story content. Keep them generic enough to fit the Theme/Situation, such as [Verse: restrained], [Pre-Chorus: rising tension], [Chorus / Drop: emotional lift], [Bridge: vulnerable turn].
- Do NOT turn Genre/Style/Sound into lyric imagery. Keep musical words in the prompt only; lyrics should use ordinary life details from the Theme/Situation.
- Keep the lyrics aligned with the final [Atmosphere], [Vocals], and [Arrangement], but express that alignment through the existing story's behavior, timing, speech style, metaphor temperature, and sentence rhythm rather than mood keyword mentions or newly invented mood-based objects.`;
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
  const shouldUseLens = shouldUseVariationAtmosphereLens(variation, params, '');
  const storyFunction = (shouldUseLens ? lens : '') || storyPhrase;
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

  const interpreted = buildThemeMoodInterpretation(params);
  if (interpreted.atmosphereCue) return interpreted.atmosphereCue;

  const moodPhrase = getEnglishMoodPhrase(params);
  const themePhrase = getEnglishThemePhrase(params);
  if (themePhrase && themePhrase !== "a clear emotional scene") {
    return cleanupPromptTail(`${moodPhrase} ${themePhrase} scene`);
  }
  return cleanupPromptTail(`${moodPhrase} emotional scene`);
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

  const soloMember = params.vocal?.members?.[0];
  const soloCharacterPrompt = soloMember ? buildVocalCharacterPrompt(soloMember, params) : "";
  if (info.isSolo && soloCharacterPrompt) {
    const gender = soloMember?.gender === "female" ? "female" : soloMember?.gender === "male" ? "male" : info.gender;
    const subject = gender === "female" ? "female vocal" : gender === "male" ? "male vocal" : "solo vocal";
    return `${naturalVocalPrefix(params, subject)} with ${soloCharacterPrompt}`;
  }

  const genreDefaultVocal = getGenreDefaultVocalPhrase(params);
  if (info.isSolo && genreDefaultVocal) {
    const gender = soloMember?.gender === "female" ? "female" : soloMember?.gender === "male" ? "male" : info.gender;
    const subject = gender === "female" ? `female vocal` : gender === "male" ? `male vocal` : `solo vocal`;
    if (getSelectedPrimaryGenreKey(params) === 'trot') {
      const specific = getSelectedTrotVocalDescriptor(params);
      const lead = gender === "female" ? `natural female ${specific} vocal` : gender === "male" ? `natural male ${specific} vocal` : `natural solo ${specific} vocal`;
      return `${lead} with rounded vibrato, clear diction, and stage-like emotional lift`;
    }
    const exactSubject = selectedGenreVocalSubject(params, subject);
    const compactCue = compactVocalCueAfterSubject(genreDefaultVocal);
    return compactCue ? `${exactSubject} with ${compactCue}` : exactSubject;
  }

  if (info.isSolo && info.total === 0) {
    const globalEmotion = params.vocal?.globalToneId
      ? resolveVocalEmotionShort(params.vocal.globalToneId)
      : "";
    const performance = buildSelectedVocalPerformancePhrase(params, 12);
    const parts = dedupePromptParts([
      globalEmotion ? `${globalEmotion} emotion` : "",
      performance,
      "natural emotional delivery",
    ], 14);
    return `one suitable solo vocalist chosen to match the genre and mood with ${parts.join(", ")}`;
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
  const performance = buildSelectedVocalPerformancePhrase(params, 12);
  const parts = dedupePromptParts([
    globalEmotion ? `${globalEmotion} emotion` : "",
    performance,
  ], 14);
  if (parts.length) return `${base} with ${parts.join(", ")}`;
  return withOptionalToneAndBreath(base, "natural");
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
    const development = String(
      situation?.developmentCustom || situation?.developmentPreset || situation?.development || "",
    );
    const dev = arrangementDevelopmentToEnglish(development);
    const isParallelMonologue = /평행|독백|parallel|monologue/.test(`${development} ${dev}`.toLowerCase());
    const ownershipRule = isParallelMonologue
      ? "single-owner hooks"
      : "call-response only if chosen";
    return buildCompressedSituationVocalSplit(params, roleEntries, ownershipRule);
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
  const targetLimit = 860;

  if (countBody() <= targetLimit) return current;

  // Keep the music identity readable. The prompt body now allows up to 500 chars,
  // while [Audio quality improved to masterpiece] remains outside this limit.
  // Compress only when the body exceeds 500, and preserve [Vocals] as much as possible.
  const firstPassLimits: Record<string, number> = {
    Genre: 125,
    Instruments: 90,
    Atmosphere: 150,
    Vocals: allowExtendedVocalPrompt ? 460 : 360,
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
    Vocals: allowExtendedVocalPrompt ? 420 : 320,
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

function hasUserPrimaryStoryText(params: GenerateSongParams): boolean {
  return Boolean(
    (params.lyricDraft || "").trim() ||
      (params.userInput || "").trim(),
  );
}

function buildUserPrimaryStoryLockInstruction(params: GenerateSongParams): string {
  if (!hasUserPrimaryStoryText(params)) return "";

  const hasLyricDraft = Boolean((params.lyricDraft || "").trim());
  const hasDirectorNote = Boolean((params.userInput || "").trim());
  const selectedThemes = (params.themes ?? []).filter(Boolean).join(", ") || "none";
  const selectedMoods = (params.moods ?? []).filter(Boolean).join(", ") || "none";

  return `USER TEXT PRIORITY LOCK (MANDATORY):
- The user's ${hasLyricDraft ? "direct lyric draft" : ""}${hasLyricDraft && hasDirectorNote ? " and " : ""}${hasDirectorNote ? "director note" : ""} is the main story source.
- Selected themes are secondary lenses only: ${selectedThemes}. Reinterpret them inside the user's text; never let them replace the user's story.
- Selected moods are emotional/performance color only: ${selectedMoods}. Do NOT copy mood labels such as peaceful, funky, sad, bright, calm, 평화로운, 펑키한, 우울한, 밝은, 차분한 directly into lyric lines.
- If the user text clearly implies war, history, battle, survival, heroism, naval conflict, or historical resolve, reinterpret love/encounter/reunion as loyalty, comradeship, survival, duty, return, or love for country. Do NOT create romance, confession, relationship, everyday conflict, or delayed-confession lenses.
- If the user text clearly implies romance, comedy, workplace, fantasy, or another topic, keep that topic as the main frame and reinterpret selected themes/moods inside it.
- When theme is empty, do NOT invent a random theme. Infer the story only from the user's text and UI selections.
- Atmosphere and Arrangement must describe the user's actual story conflict, not a random creative variation.`;
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

function pushUniqueFront(target: string[], ...values: string[]) {
  values.reverse().forEach((value) => {
    const normalized = value.trim();
    if (!normalized) return;
    const existingIndex = target.findIndex((item) => item.toLowerCase() === normalized.toLowerCase());
    if (existingIndex >= 0) target.splice(existingIndex, 1);
    target.unshift(normalized);
  });
}

function compactFreeTextGenreColor(value: string): string {
  return cleanupPromptTail(String(value || '')
    .replace(/\b(?:mood|atmosphere|tone|scene|story|narrative)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim());
}

function buildFreeTextGenreColorParts(
  mainGenre: string,
  influences: string[],
  moodParts: string[],
  themeParts: string[],
  soundParts: string[],
  rawNote: string,
): string[] {
  const lower = rawNote.toLowerCase();
  const parts: string[] = [];
  const add = (value: string) => {
    const clean = compactFreeTextGenreColor(value);
    if (clean && !parts.some((item) => item.toLowerCase() === clean.toLowerCase())) parts.push(clean);
  };

  influences.slice(0, 2).forEach(add);

  if (/2000년대|2000s|y2k|early\s*2000/i.test(lower)) add('2000s pop polish');
  if (/80년대|80s|80's|eighties|레트로|retro/i.test(lower)) add('retro analog warmth');
  if (/90년대|90s|90's|nineties/i.test(lower)) add('90s texture');

  if (/넓은\s*공간|공간감|wide\s*space|spacious|vast|reverb|잔향|우주|space/i.test(lower)) add('wide spatial haze');
  if (/드래곤볼|용|구슬|조각|fantasy|판타지|마법|모험|adventure|journey|여행/i.test(lower)) add('fantasy journey atmosphere');
  if (/새벽|night|밤|midnight|도시|urban|city|드라이브|drive/i.test(lower)) add(/드라이브|drive/i.test(lower) ? 'late-night city-drive mood' : 'late-night urban mood');
  if (/성장|growth|change|변화/i.test(lower)) add('growth-story warmth');
  if (/고백|confession|짝사랑|crush|설렘/i.test(lower)) add('confession tension');
  if (/이별|breakup|그리움|longing/i.test(lower)) add('breakup melancholy');

  // If the note had few explicit colors, borrow one compact mood/sound color without
  // allowing it to replace the protected main genre.
  if (parts.length < 2) {
    [...themeParts, ...moodParts, ...soundParts]
      .map(compactFreeTextGenreColor)
      .filter(Boolean)
      .slice(0, 2)
      .forEach(add);
  }

  return parts.slice(0, /^(?:Dream Pop|Art Pop|City Pop|80s City Pop|Emo Rock|Tech House|Synth Pop)$/i.test(mainGenre) ? 3 : 2);
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
  const dreamPopKeywords = ["드림팝", "드림 팝", "dream pop", "dream-pop", "dreampop"];
  const artPopKeywords = ["아트팝", "아트 팝", "art pop", "art-pop", "artpop"];
  const emoRockKeywords = ["이모록", "이모 록", "emo rock", "emo-rock", "emorock"];
  const techHouseKeywords = ["테크하우스", "테크 하우스", "tech house", "tech-house"];
  const houseKeywords = ["하우스", "house"];
  const technoKeywords = ["테크노", "techno"];
  const electropopKeywords = ["일렉트로팝", "일렉트로 팝", "electropop", "electro pop", "electro-pop"];
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


  if (has(dreamPopKeywords)) {
    pushUniqueFront(mainGenreParts, "Dream Pop");
    pushUnique(
      soundParts,
      "wide pads",
      "dreamy synth haze",
      "soft drums",
      "warm reverb space",
    );
    pushUnique(moodParts, "dreamy spacious atmosphere", "soft floating mood");
    pushUnique(arrangementParts, "slow dreamy section flow", "wide spatial build");
  }

  if (has(artPopKeywords)) {
    pushUniqueFront(mainGenreParts, "Art Pop");
    pushUnique(soundParts, "unusual synth colors", "asymmetrical pop arrangement", "textural pop layers");
    pushUnique(moodParts, "artful emotional color");
    pushUnique(arrangementParts, "art-pop section turns", "unconventional hook movement");
  }

  if (has(emoRockKeywords)) {
    pushUniqueFront(mainGenreParts, "Emo Rock");
    pushUnique(soundParts, "driving guitars", "live drum pressure", "wide chorus guitars");
    pushUnique(moodParts, "raw urban ache");
    pushUnique(arrangementParts, "band-driven build", "guitar-led section lift");
  }

  if (has(techHouseKeywords)) {
    pushUniqueFront(mainGenreParts, "Tech House");
    pushUnique(soundParts, "tight kick", "minimal synth stabs", "club hats", "focused bass groove");
    pushUnique(moodParts, "cool club atmosphere");
    pushUnique(arrangementParts, "steady four-on-the-floor groove", "clean club lift");
  } else if (has(technoKeywords)) {
    pushUniqueFront(mainGenreParts, "Techno");
    pushUnique(soundParts, "driving electronic pulse", "minimal synth pressure", "tight drum machine");
    pushUnique(arrangementParts, "driving techno progression", "hypnotic section lift");
  } else if (has(houseKeywords) && !has(techHouseKeywords)) {
    pushUniqueFront(mainGenreParts, "House");
    pushUnique(soundParts, "four-on-the-floor drums", "warm house bass", "club-ready synths");
    pushUnique(arrangementParts, "house groove progression", "clean dance-floor lift");
  }

  if (has(electropopKeywords)) {
    pushUniqueFront(mainGenreParts, "Electropop");
    pushUnique(soundParts, "polished synth hooks", "tight pop drums", "bright electronic texture");
    pushUnique(arrangementParts, "electropop hook drive", "synth-led section lift");
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
  if (has(["오페라", "opera"])) pushUnique(mainGenreParts, "Opera");
  if (has(["메탈", "metal"])) pushUnique(mainGenreParts, "Metal");
  if (has(["펑크", "punk"])) pushUnique(mainGenreParts, "Punk Rock");
  if (has(["브레이크비트", "breakbeat", "break beat"])) pushUnique(mainGenreParts, "Breakbeat");
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

  const wantsFemaleGroup = has(["여자 그룹", "여성 그룹", "여자그룹", "여성그룹", "걸그룹", "girl group", "female group"]);
  const wantsMaleGroup = has(["남자 그룹", "남성 그룹", "남자그룹", "남성그룹", "보이그룹", "boy group", "male group"]);
  const wantsMixedGroup = has(["혼성 그룹", "혼성그룹", "mixed group", "co-ed group", "coed group"]);

  if (wantsFemaleGroup) {
    pushUniqueFront(vocalParts, "female group vocals", "layered female harmony");
    pushUnique(arrangementParts, "female-group part layering");
  } else if (wantsMaleGroup) {
    pushUniqueFront(vocalParts, "male group vocals", "layered male harmony");
    pushUnique(arrangementParts, "male-group part layering");
  } else if (wantsMixedGroup) {
    pushUniqueFront(vocalParts, "mixed male and female group vocals", "male-female part contrast");
    pushUnique(arrangementParts, "male-female part exchange");
  } else if (wantsFemaleVocal && !wantsMaleVocal) {
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
  const genreColorParts = buildFreeTextGenreColorParts(
    mainGenre,
    [...extraMainGenres, ...genreInfluenceParts],
    moodParts,
    themeParts,
    soundParts,
    rawNote,
  );
  const genre = genreColorParts.length
    ? `${mainGenre} with ${joinPromptPhrase(genreColorParts.slice(0, 3), 'and')}`
    : mainGenre;

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
      : "clear sectional contrast",
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
  return sanitizeTrackOpeningArtifacts(limitText(`${base}${separator}${setting}.`, 175));
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
      .replace(/\b(?:with|and|fusion with|multi-fusion with)\s+(?:timeless|emotional|moody|bright|dark|warm|cool)\s*$/gi, "")
      .replace(/,\s*(?:and\s*)?(?:timeless|emotional|moody|bright|dark|warm|cool)\s*$/gi, "")
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

  line = line
    .replace(/\bwhere\s+the\s+story\s+moves\s+through\s*$/i, "where the story turns through a concrete detail")
    .replace(/\bwhere\s+the\s+story\s*$/i, "where the story turns through a concrete detail")
    .replace(/\bwhere\s+a\s+recurring\s*$/i, "with a recurring hook motif")
    .replace(/\bwhere\s+an?\s*$/i, "")
    .replace(/\bwhere\s*$/i, "")
    .replace(/\bwith\s+a\s*$/i, "")
    .replace(/\band\s+a\s*$/i, "");

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
      // Genre/style category names belong in [Genre] or [Atmosphere], not repeated inside [Vocals].
      .replace(/,?\s*\b(?:Anisong\s+Pop|Britpop|Idol\s+Dance|Retro\s+Disco|Nu-Disco|Hip-hop|Jazz\s+Hip-hop|Alternative\s+R&B|K-Pop|J-Pop)\s+fusion\b/gi, "")
      .replace(/,?\s*\b(?:Anisong\s+Pop|Britpop|Idol\s+Dance|Retro\s+Disco|Nu-Disco)\s+(?:color|phrasing|style)\b/gi, "")
      .replace(/\(\s*,/g, "(")
      .replace(/,\s*\)/g, ")")
      .replace(/\(\s*\)/g, "")
      .replace(/,\s*,/g, ",")
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
    [...variationSoundItems, ...soundItems].slice(0, 4),
  );
  const performancePhrase = phraseListForPrompt(
    [...feelItems, ...arrangementItems].slice(0, 3),
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
        .replace(/\bone-sided monologue focus with a call-response hook\b/gi, "one-sided monologue focus with single-owner hook")
        .replace(/\bparallel monologue focus with a call-response hook\b/gi, "parallel monologue focus with single-owner hook")
        .replace(/\bno balanced call-response with a call-response hook\b/gi, "single-owner hook, no balanced call-response")
        .replace(/\s{2,}/g, " "),
      170,
    ),
  );
}

function compactHybridPromptBody(lines: string[]): string[] {
  let current = [...lines];
  const countBody = () => current.join("\n").length;
  const targetLimit = 860;
  if (countBody() <= targetLimit) return current;

  const firstPassLimits: Record<string, number> = {
    Track: 175,
    Vocals: 240,
    Production: 160,
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
    Track: 150,
    Vocals: 210,
    Production: 135,
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


function getTrotLeafFromGenreLine(line: string): string {
  const text = String(line || '');
  const match = text.match(/\b(?:Korean\s+)?(Traditional|Semi|Disco|Rock|Ballad|Blues|Shuffle|Gugak)\s+Trot\b/i);
  if (!match) return '';
  return `${match[1].toLowerCase()}-trot`;
}

function collapseDuplicateAtmosphereSentence(value: string): string {
  let line = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '));
  if (!line) return line;

  // Fix missing spaces where two atmosphere sentences were glued together.
  line = line
    .replace(/(emotional\s+tone|calm\s+tone|spatial\s+echoes|room\s+echoes|catchy\s+lift|romantic\s+tension|lonely\s+air|cautious\s+hope)(a\s+)/gi, '$1 $2')
    .replace(/(emotional\s+tone|calm\s+tone|spatial\s+echoes|room\s+echoes|catchy\s+lift|romantic\s+tension|lonely\s+air|cautious\s+hope)(an\s+)/gi, '$1 $2')
    .replace(/(spatial\s+echoes|room\s+echoes|urban\s+reflections)(a\s+)/gi, '$1 $2')
    .replace(/(spatial\s+echoes|room\s+echoes|urban\s+reflections)(an\s+)/gi, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Exact repeated sentence guard.
  // Example: "a held-back confession ... emotional tone a held-back confession ... emotional tone"
  const compact = (text: string) => text.toLowerCase().replace(/[\s,.;:]+/g, ' ').trim();
  for (let cut = Math.floor(line.length / 2) - 8; cut <= Math.floor(line.length / 2) + 8; cut += 1) {
    if (cut <= 20 || cut >= line.length - 20) continue;
    const left = line.slice(0, cut).trim();
    const right = line.slice(cut).trim();
    if (left && right && compact(left) === compact(right)) return cleanupPromptTail(left);
  }

  // If the same scene opener appears twice, keep the first full sentence only.
  // This is intentionally generic so it works for confession, friendship, breakup,
  // reunion, room, city, seaside, etc. without adding one-off patches.
  const sceneStartPattern = /\b(?:a|an)\s+(?:(?:fragile|warm|calm|quiet|lonely|wistful|tense|hopeful|anxious|soft|emotional|catchy|playful|dark|bright|bittersweet|held-back|restrained|private|rainy|cold|small|tender|soulful|magical|vintage|everyday)\s+){0,5}(?:[a-z-]+\s+){0,6}scene\b/gi;
  const starts = Array.from(line.matchAll(sceneStartPattern))
    .map((match) => ({ index: match.index ?? -1, text: match[0] }))
    .filter((match) => match.index >= 0);

  if (starts.length >= 2) {
    const first = starts[0];
    const firstKey = compact(first.text);
    const repeated = starts.find((candidate, idx) => idx > 0 && compact(candidate.text) === firstKey);
    if (repeated && repeated.index > first.index) {
      return cleanupPromptTail(line.slice(0, repeated.index).trim());
    }

    // Some duplicate builders change hyphenation or intensity, but the second scene
    // still starts after a completed tail such as "emotional tone". Cut there too.
    const second = starts[1];
    const beforeSecond = line.slice(0, second.index).toLowerCase();
    if (/(emotional\s+tone|calm\s+tone|spatial\s+echoes?|room\s+echoes?|catchy\s+lift|romantic\s+tension|lonely\s+air|cautious\s+hope|soft\s+brightness|warmth)\s*$/.test(beforeSecond)) {
      return cleanupPromptTail(line.slice(0, second.index).trim());
    }
  }

  // Broad repeated segment guard: if a long prefix appears again later, cut before the repeat.
  const prefixMatch = line.match(/^((?:a|an)\s+.{35,120}?(?:tone|echoes|lift|tension|air|hope|warmth|aftertaste|scene))\s+\1\b/i);
  if (prefixMatch?.[1]) return cleanupPromptTail(prefixMatch[1]);

  return line;
}

function normalizeAtmosphereLayerSyntax(value: string): string {
  let line = collapseDuplicateAtmosphereSentence(
    cleanupPromptTail(String(value || '').replace(/\s+/g, ' ')),
  );

  // Hard guard: the Atmosphere reconciler must replace the scene sentence,
  // never append a second corrected sentence after the original one.
  // Example bug: "... spatial echoesa fragile ... spatial echoes".
  line = line
    .replace(/(spatial\s+echoes)(a\s+)/gi, '$1 $2')
    .replace(/(room\s+echoes)(a\s+)/gi, '$1 $2')
    .replace(/(urban\s+reflections)(a\s+)/gi, '$1 $2');

  const lower = line.toLowerCase();
  const hasOldFriendshipCityMemory =
    /old[-\s]?friendship/.test(lower) &&
    /everyday\s+city\s+memor/.test(lower);

  if (hasOldFriendshipCityMemory) {
    const intensityMatch = line.match(/\b(fragile|warm|calm|quiet|lonely|wistful|tense|hopeful|anxious|soft)\b/i);
    const intensity = intensityMatch?.[1]?.toLowerCase() || 'fragile';
    const tailParts = dedupePromptParts([
      /quiet\s+change/i.test(line) ? 'quiet change' : '',
      /calm\s+tone|calm\s+tension|\bcalm\b/i.test(line) ? 'calm tone' : '',
      /spatial\s+echoes?/i.test(line) ? 'spatial echoes' : '',
      /lonely\s+air/i.test(line) ? 'lonely air' : '',
      /cautious\s+hope/i.test(line) ? 'cautious hope' : '',
    ].filter(Boolean), 12).slice(0, 3);

    return cleanupPromptTail(
      `a ${intensity} old-friendship scene in everyday city memories${tailParts.length ? `, with ${joinPromptPhrase(tailParts, 'and')}` : ''}`
    );
  }

  // The generic layer builder sometimes produced a valid set of layers but joined
  // them without connectors: "old friendship ... city memories quiet change scene".
  // Keep the chosen layers, but turn them into one readable atmosphere sentence.
  line = line.replace(
    /\ba\s+(fragile|warm|calm|quiet|lonely|wistful|tense|hopeful)\s+old friendship seen through everyday city memories quiet change scene with calm tone with spatial echoes\b/gi,
    'a $1 old-friendship scene in everyday city memories, with quiet change, calm tone, and spatial echoes'
  );

  line = line
    .replace(/\beveryday city memories quiet change scene\b/gi, 'everyday city-memory scene with quiet change')
    .replace(/\bold friendship seen through everyday city memories\b/gi, 'old-friendship scene in everyday city memories')
    .replace(/\bwith\s+([^,]+?)\s+with\s+spatial echoes\b/gi, 'with $1 and spatial echoes')
    .replace(/\bwith calm tone and spatial echoes\b/gi, 'with calm tone and spatial echoes')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleanupPromptTail(collapseDuplicateAtmosphereSentence(line));
}

function forceSingleAtmosphereSentence(prompt: string): string {
  return String(prompt || '').split('\n').map((rawLine) => {
    if (!/^\[Atmosphere\]/i.test(rawLine)) return rawLine;
    const content = String(rawLine || '').replace(/^\[Atmosphere\]\s*/i, '').replace(/\s+/g, ' ').trim();
    const lower = content.toLowerCase();

    // Absolute last guard for the old-friendship/city-memory duplicate bug.
    // If both layers are present, replace the whole Atmosphere value with one sentence.
    if (/old[-\s]?friendship/.test(lower) && /everyday\s+city\s+memor/.test(lower)) {
      const intensityMatch = content.match(/\b(fragile|warm|calm|quiet|lonely|wistful|tense|hopeful|anxious|soft)\b/i);
      const intensity = intensityMatch?.[1]?.toLowerCase() || 'fragile';
      const tailParts = dedupePromptParts([
        /quiet\s+change/i.test(content) ? 'quiet change' : '',
        /calm\s+tone|calm\s+tension|\bcalm\b/i.test(content) ? 'calm tone' : '',
        /spatial\s+echoes?/i.test(content) ? 'spatial echoes' : '',
        /lonely\s+air/i.test(content) ? 'lonely air' : '',
        /cautious\s+hope/i.test(content) ? 'cautious hope' : '',
      ].filter(Boolean), 12).slice(0, 3);
      return cleanupPromptTail(
        `[Atmosphere] a ${intensity} old-friendship scene in everyday city memories${tailParts.length ? `, with ${joinPromptPhrase(tailParts, 'and')}` : ''}`
      );
    }

    // Generic adjacent-duplicate guard: "... echoesa fragile ...".
    const fixed = normalizeAtmosphereLayerSyntax(
      collapseDuplicateAtmosphereSentence(
        content
          .replace(/(spatial\s+echoes)(a\s+)/gi, '$1 $2')
          .replace(/(room\s+echoes)(a\s+)/gi, '$1 $2')
          .replace(/(urban\s+reflections)(a\s+)/gi, '$1 $2'),
      ),
    );
    return cleanupPromptTail(`[Atmosphere] ${fixed}`);
  }).join('\n');
}


function lyricTextForPromptRefinement(lyrics: any): string {
  if (!lyrics || typeof lyrics !== 'object') return '';
  return [lyrics.korean, lyrics.english]
    .filter((value) => typeof value === 'string')
    .join('\n')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\([^)]{1,80}\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function directAndLyricRefinementText(params: GenerateSongParams, lyrics: any): string {
  return [
    params.userInput || '',
    getDirectThemeInputText(params),
    getDirectMoodInputText(params),
    selectedThemeText(params),
    selectedMoodText(params),
    lyricTextForPromptRefinement(lyrics),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPromptLineValue(prompt: string, label: 'Atmosphere' | 'Arrangement'): string {
  const line = String(prompt || '').split('\n').find((item) => new RegExp(`^\\[${label}\\]`, 'i').test(item)) || '';
  return line.replace(new RegExp(`^\\[${label}\\]\\s*`, 'i'), '').trim();
}

function replacePromptLineValue(prompt: string, label: 'Atmosphere' | 'Arrangement', value: string): string {
  const normalized = cleanupPromptTail(value);
  if (!normalized) return prompt;
  const pattern = new RegExp(`^\\[${label}\\].*$`, 'im');
  const replacement = `[${label}] ${normalized}`;
  return pattern.test(prompt) ? prompt.replace(pattern, replacement) : `${prompt}\n${replacement}`;
}

function extractBpmCueFromArrangement(value: string): string {
  const match = String(value || '').match(/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b|\b\d{2,3}\s*BPM\b/i);
  return match ? match[0].replace(/\s*[–-]\s*/g, '–').replace(/\s+/g, ' ').trim() : '';
}

function isWeakOrInternalAtmosphere(value: string): boolean {
  const line = String(value || '').trim();
  return !line ||
    /\bdirect user-specified\b|\bexact topic\b|\bfree-text\b|\bdirect-story\b/i.test(line) ||
    /\bconcrete personal scene\b|\buser-described scene\b/i.test(line) ||
    /^(?:a|an|the|with|where)\b\s*$/i.test(line) ||
    line.length < 28;
}

function isWeakOrInternalArrangement(value: string): boolean {
  const line = String(value || '').trim();
  return !line ||
    /\bdirect-story\b|\bfree-text\b|\bmatching the free-text direction\b/i.test(line) ||
    /\bmatching the character arc\b/i.test(line) ||
    /^(?:with|and|where)\b\s*$/i.test(line);
}

function inferLyricAwareAtmosphere(params: GenerateSongParams, lyrics: any, currentAtmosphere: string): string {
  // Deprecated in 284: no topic-specific fallback generation here.
  // The model now returns productionPrompt in the same call, after deciding the lyric concept.
  return '';
}

function inferLyricAwareArrangement(params: GenerateSongParams, lyrics: any, currentArrangement: string): string {
  // Deprecated in 284: no topic-specific fallback generation here.
  // The model now returns productionPrompt in the same call, after deciding the lyric concept.
  return '';
}

function sanitizeFinalPromptInternalPhrases(prompt: string): string {
  return String(prompt || '').split('\n').map((rawLine) => stripInternalPromptLeakPhrases(rawLine)).join('\n');
}

function refineFinalPromptWithGeneratedLyrics(prompt: string, params: GenerateSongParams, lyrics: any): string {
  // Deprecated in 284. Keep as a harmless compatibility wrapper only.
  return sanitizeFinalPromptInternalPhrases(prompt);
}

function stripInternalPromptLeakPhrases(value: string): string {
  return cleanupPromptTail(String(value || '')
    .replace(/\bdirect\s+user[-\s]?specified(?:\s+story\s+scene)?\b/gi, '')
    .replace(/\bcentered\s+on\s+the\s+exact\s+topic\s+the\s+user\s+wrote\b/gi, '')
    .replace(/\bexact\s+topic\b/gi, '')
    .replace(/\bfree[-\s]?text\s+direction\b/gi, '')
    .replace(/\bdirect[-\s]?story(?:\s+section\s+movement)?\b/gi, '')
    .replace(/\bmatching\s+the\s+free[-\s]?text\s+direction\b/gi, '')
    .replace(/\bmatching\s+the\s+character\s+arc\b/gi, '')
    .replace(/\bconcrete\s+personal\s+scene\b/gi, '')
    .replace(/\buser[-\s]?described\s+scene\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim());
}


function removeAudioQualityLineWhenPromptIsNearLimit(prompt: string): string {
  const source = String(prompt || '').trim();
  if (!source) return source;
  if (source.length < 950) return source;
  return source
    .split(/\r?\n/)
    .filter((line) => !/^\[Audio quality improved to masterpiece\]$/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeAiProductionPrompt(rawPrompt: string, fallbackPrompt: string): string {
  const labels = ['Genre', 'Instruments', 'Atmosphere', 'Vocals', 'Arrangement'] as const;
  const fallbackByLabel = new Map<string, string>();
  labels.forEach((label) => {
    const match = String(fallbackPrompt || '').match(new RegExp('^\\[' + label + '\\]\\s*(.*)$', 'im'));
    fallbackByLabel.set(label, match ? cleanupPromptTail(match[1] || '') : '');
  });

  const rawLines = String(rawPrompt || '')
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const byLabel = new Map<string, string>();
  rawLines.forEach((line) => {
    const match = line.match(/^\[(Genre|Instruments|Atmosphere|Vocals|Arrangement)\]\s*(.*)$/i);
    if (!match) return;
    const label = labels.find((item) => item.toLowerCase() === match[1].toLowerCase());
    if (!label || byLabel.has(label)) return;
    let value = stripInternalPromptLeakPhrases(match[2] || '');
    value = stripRemainingKoreanForProductionPrompt(value);
    value = cleanupPromptTail(value);
    byLabel.set(label, value);
  });

  const isBadValue = (label: string, value: string) => {
    const v = String(value || '').trim();
    if (!v) return true;
    if (/^(?:a|an|the|with|where|and)$/i.test(v)) return true;
    if (/direct\s+user|exact\s+topic|free[-\s]?text|direct[-\s]?story|concrete\s+personal|user[-\s]?described/i.test(v)) return true;
    if ((label === 'Atmosphere' || label === 'Arrangement') && v.length < 18) return true;
    return false;
  };

  const finalLines = labels.map((label) => {
    let value = byLabel.get(label) || '';
    if (isBadValue(label, value)) value = stripInternalPromptLeakPhrases(fallbackByLabel.get(label) || '');
    if (label === 'Atmosphere') value = normalizeAtmospherePromptLine(value || 'balanced emotional air');
    else if (label === 'Arrangement') value = normalizeArrangementLine((value || 'clear sectional contrast').split(','));
    else value = cleanupPromptTail(value || fallbackByLabel.get(label) || '');
    if (isBadValue(label, value)) value = label === 'Atmosphere' ? 'balanced emotional air' : label === 'Arrangement' ? 'clear sectional contrast' : fallbackByLabel.get(label) || '';
    return `[${label}] ${value}`;
  });

  finalLines.push('[Audio quality improved to masterpiece]');
  return removeAudioQualityLineWhenPromptIsNearLimit(finalLines.join('\n'));
}

function reconcileFiveLinePromptRoles(prompt: string): string {
  const lines = String(prompt || '').split('\n');
  const genreLine = lines.find((line) => /^\[Genre\]/i.test(line)) || '';
  const trotLeaf = getTrotLeafFromGenreLine(genreLine);

  const normalized = lines.map((rawLine) => {
    let line = String(rawLine || '');

    if (/^\[Genre\]/i.test(line)) {
      // If a secondary genre is not the main identity, mark it as an accent.
      line = line.replace(/\b(Shuffle|Semi|Disco|Rock|Ballad|Blues|Gugak|Traditional)\s+Trot\s+with\s+Tropical House\s+and\b/i, '$1 Trot with Tropical House accent and');
      line = line.replace(/\b(Korean\s+(?:Shuffle|Semi|Disco|Rock|Ballad|Blues|Gugak|Traditional)\s+Trot)\s+with\s+Tropical House\s+and\b/i, '$1 with Tropical House accent and');
    }

    if (trotLeaf && /^\[Vocals\]/i.test(line)) {
      line = line
        .replace(/\bNatural\s+(solo|male|female)\s+vocal\s+with\s+Korean\s+trot\s+vocal\b/gi, (_m, subject) => `Natural ${String(subject).toLowerCase()} ${trotLeaf} vocal`)
        .replace(/\bnatural\s+(solo|male|female)\s+vocal\s+with\s+Korean\s+trot\s+vocal\b/gi, (_m, subject) => `natural ${String(subject).toLowerCase()} ${trotLeaf} vocal`)
        .replace(/\bKorean\s+trot\s+vocal\b/gi, `${trotLeaf} vocal`)
        .replace(/\bvocal\s+with\s+([a-z-]+\s+trot)\s+vocal\b/gi, '$1 vocal')
        .replace(/\s{2,}/g, ' ');
    }

    if (trotLeaf && /^\[Arrangement\]/i.test(line)) {
      line = line
        .replace(/\bsteady\s+trot\s+rhythm\b/gi, `steady ${trotLeaf} rhythm`)
        .replace(/\s{2,}/g, ' ');
    }

    if (/^\[Atmosphere\]/i.test(line)) {
      line = line.replace(/^\[Atmosphere\]\s*/i, '[Atmosphere] ' + normalizeAtmosphereLayerSyntax(line.replace(/^\[Atmosphere\]\s*/i, '')));
    }

    return cleanupPromptTail(line);
  });

  return normalized.join('\n');
}



type FinalPromptLineMap = {
  genre: string;
  instruments: string;
  atmosphere: string;
  vocals: string;
  arrangement: string;
};

function finalValidatorKeywordSignalCount(params: GenerateSongParams): number {
  return [
    ...(params.moods ?? []),
    ...(params.themes ?? []),
    ...(params.styles ?? []),
    ...(params.instrumentSounds ?? []),
    ...(params.pointSounds ?? []),
  ].filter(Boolean).length + (String(params.userInput || '').trim() ? 3 : 0) + (String(params.customThemeInput || '').trim() ? 2 : 0);
}

function finalizePromptOpenTail(value: string): string {
  return cleanupPromptTail(String(value || '')
    .replace(/\bblurred\s+re\b/gi, 'blurred reverb')
    .replace(/\bdark\s+conf\b/gi, 'dark confidence')
    .replace(/\bnostal\b/gi, 'nostalgic color')
    .replace(/\bemo\b(?=\s*$)/gi, 'emotional color')
    .replace(/\b2020s\s+hyper[-\s]?digital\b(?!\s+(?:polish|edge|texture|color))/gi, '2020s hyper-digital polish')
    .replace(/\band\s+timeless\b/gi, 'and timeless polish')
    .replace(/\btimeless\b(?!\s+(?:polish|edge|color|warmth))/gi, 'timeless polish')
    .replace(/\bwith\s+(upbeat|open|dreamy|moody|warm|soft|bright|dark|calm|hopeful|playful),\s*(open|upbeat|dreamy|moody|warm|soft|bright|dark|calm|hopeful|playful)\s+where\b/gi, 'with $1 $2 air where')
    .replace(/\bwith\s+(upbeat|open|dreamy|moody|warm|soft|bright|dark|calm|hopeful|playful)\s+where\b/gi, 'with $1 air where')
    .replace(/\bwith\s+upbeat,\s*open\s+where\b/gi, 'with upbeat open air where')
    .replace(/\bwhere\s+one\s+unsaid\s+feeling\s+pushing\b/gi, 'where one unsaid feeling pushes')
    .replace(/\bwith\s+moody\s+and\s+street\s+noise\b/gi, 'with moody street noise')
    .replace(/\b(?:with|and|where|while|by|through|around|in|on)\s*$/gi, '')
    .replace(/[,\s]+$/g, '')
    .replace(/\s{2,}/g, ' '));
}


function hardenPromptOpenTail(value: string): string {
  return cleanupPromptTail(String(value || '')
    .replace(/\bblurred\s+(?:re|ref|res)\b/gi, 'blurred reverb')
    .replace(/\bdark\s+conf\b/gi, 'dark confidence')
    .replace(/\bwhere\s+wanting\s+to\s+speak\s+first\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\s*$/gi, 'where the urge to speak first hides the most important feeling')
    .replace(/\bwhere\s+(?:trying|wanting)\s+to\s+[^,]{1,70}\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\s*$/gi, 'where the hidden feeling stays unresolved')
    .replace(/\bnostal\b/gi, 'nostalgic color')
    .replace(/\bemo\b(?=\s*$)/gi, 'emotional color')
    .replace(/\bPure\b/g, '')
    .replace(/\b2020s\s+hyper[-\s]?digital\b(?!\s+(?:polish|edge|texture|color))/gi, '2020s hyper-digital polish')
    .replace(/\band\s+timeless\b/gi, 'and timeless polish')
    .replace(/\btimeless\b(?!\s+(?:polish|edge|color|warmth))/gi, 'timeless polish')
    .replace(/\bwith\s+(calm|dreamy|moody|warm|soft|bright|dark|wistful|lonely|open|upbeat)\s+and\s+(calm|dreamy|moody|warm|soft|bright|dark|wistful|lonely|open|upbeat)\s*$/gi, 'with $1 $2 air')
    .replace(/\bwith\s+(calm|dreamy|moody|warm|soft|bright|dark|wistful|lonely|open|upbeat)\s*$/gi, 'with $1 air')
    .replace(/\bwhere\s+(.{1,80})\s+(?:with|and|while|by|through|around|in|on)\s*$/gi, 'where $1')
    .replace(/\b(?:with|and|where|while|by|through|around|in|on)\s*$/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' '));
}

function hardenAtmosphereValidatorText(value: string, params: GenerateSongParams): string {
  let line = hardenPromptOpenTail(value)
    .replace(/\bwhere\s+wanting\s+to\s+speak\s+first\s+but\s+hiding\s+the\s+most(?:\s+important\s+(?:line|feeling))?\b/gi, 'where the urge to speak first hides the most important feeling')
    .replace(/\band\s+groovy\s+where\b/gi, 'with groovy pulse where')
    .replace(/,\s*and\s+(dramatic|intense|suspense)\s+where\b/gi, ' with $1 tension where')
    .replace(/\bwhere\s+the\s+feeling\s+turns\s+back\s+on\s+itself\s+with\s+(calm|dreamy|soft|warm|moody)\s+and\s+(calm|dreamy|soft|warm|moody)\b/gi, 'where $1 $2 feelings turn back on themselves')
    .replace(/\bwhere\s+the\s+feeling\s+turns\s+back\s+on\s+itself\s+with\s+(calm|dreamy|soft|warm|moody)\b/gi, 'where $1 feelings turn back on themselves')
    .replace(/\bwhere\s+tired\s+routine\s+turns\s+into\s+a\s+private\s+escape\s+with\s+soft\s+brightness\s+where\s+turning\s+tired\s+routine\s+into\s+a\s+small\s+private\s+escape\b/gi, 'where tired routine turns into a soft private escape')
    .replace(/\bwhere\s+turning\s+tired\s+routine\s+into\s+a\s+small\s+private\s+escape\b/gi, 'where tired routine turns into a small private escape')
    .replace(/\bwith\s+(moody|dark|wistful|warm|soft|open|upbeat)\s+and\s+([a-z]+\s+noise)\b/gi, 'with $1 $2')
    .replace(/\bwith\s+upbeat,\s*open\s+where\b/gi, 'with upbeat open air where')
    .replace(/\bwhere\s+staying\s+calm\s+on\s+the\s+surface\s+while\s+resisting\s+from\s+underneath\b/gi, 'where calm surface hides quiet resistance underneath')
    .replace(/\bwith\s+calm\s+and\s+dreamy\b/gi, 'with calm dreamy air')
    .replace(/\bwith\s+dark\s+and\s+wistful\b/gi, 'with dark wistful air');

  const whereParts = line.split(/\s+where\s+/i);
  if (whereParts.length > 2) {
    line = cleanupPromptTail(`${whereParts[0]} where ${whereParts[1]}`);
  }

  line = hardenPromptOpenTail(finalizeAtmosphereSentence(line));

  if (line.length > 180) {
    const contextual = buildContextualCueBundle(params);
    const whereMatch = line.match(/^(.*?)\s+where\s+(.+)$/i);
    if (whereMatch) line = cleanupPromptTail(`${whereMatch[1]} where ${cleanupPromptTail(whereMatch[2]).split(/,\s*/)[0]}`);
    if (line.length > 180 && contextual.atmosphereScene) line = contextual.atmosphereScene;
  }
  return hardenPromptOpenTail(line) || 'balanced emotional air';
}


function hasBalancedParentheses(value: string): boolean {
  let depth = 0;
  for (const ch of String(value || '')) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function isMalformedFinalVocalLine(value: string): boolean {
  const line = cleanupPromptTail(value);
  if (!line) return true;
  if (!hasBalancedParentheses(line)) return true;
  if (/[,;:\-–]\s*$/i.test(line)) return true;
  if (/\b(?:with|and|or|as|vs|plus|featuring|feat\.?|tone|emotion|delivery)\s*$/i.test(line)) return true;
  if (/\([^)]{0,140}$/i.test(line)) return true;
  return false;
}

function compactVocalSummaryCue(value: string, maxParts = 3): string {
  const raw = cleanupPromptTail(String(value || '')
    .replace(/\([^)]*$/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\b(?:male|female|vocal|vocals|voice|tone|delivery|phrasing|expression|emotion)\b/gi, ' ')
    .replace(/\s+/g, ' '));
  const parts = raw
    .split(/,\s*|\s+and\s+/i)
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean);
  const picked: string[] = [];
  const add = (part: string) => {
    const clean = cleanupPromptTail(part);
    if (!clean) return;
    const key = clean.toLowerCase().replace(/\b(?:natural|story-aware|human|compact)\b/g, '').trim();
    if (!key) return;
    if (picked.some((item) => {
      const existing = item.toLowerCase();
      return existing.includes(key) || key.includes(existing);
    })) return;
    picked.push(clean);
  };
  parts.forEach(add);
  if (!picked.length) add(raw);
  return joinPromptPhrase(picked.slice(0, maxParts), 'and') || 'natural emotional delivery';
}

function summarizeFinalVocalLineFromParams(params: GenerateSongParams, reason: 'broken' | 'large-group' = 'broken'): string {
  const info = getVocalModeInfo(params.vocal);
  const members = params.vocal?.members || [];
  const hasCharacterMembers = members.some((member: any) => hasVocalCharacterSelection(member));
  const genderWord = info.gender === 'female' ? 'female' : info.gender === 'male' ? 'male' : info.gender === 'mixed' ? 'mixed' : 'vocal';
  const total = info.total || members.length || (info.mode === 'duo' ? 2 : info.mode === 'group' ? 4 : 1);

  if (hasCharacterMembers && (info.mode === 'duo' || total === 2)) {
    const used = new Set<string>();
    const items = members.slice(0, 2).map((member: any, index: number) => {
      const label = buildCharacterVocalLabel(member, index, params, used);
      const cue = compactVocalSummaryCue(buildVocalIntentResult(member, params, false).phrase, 3);
      return `${label} with ${cue}`;
    }).filter(Boolean);
    if (items.length) {
      return cleanupPromptTail(`2 ${genderWord} vocal character split: ${items.join(' vs ')}, with roles clearly separated by section`);
    }
  }

  if (hasCharacterMembers && (reason === 'large-group' || shouldApplyLargeGroupVocalCompression(params))) {
    const used = new Set<string>();
    const labels = members.slice(0, 4).map((member: any, index: number) => buildCharacterVocalLabel(member, index, params, used));
    const labelText = labels.length ? `${labels.join(', ')} roles` : 'main, lead, rap, and harmony roles';
    return cleanupPromptTail(`${Math.max(total, 3)}-voice ${genderWord} group split with ${labelText}, compact distinct tones, and clear section separation`);
  }

  const split = buildMemberVocalSplit(params);
  if (split && !shouldApplyLargeGroupVocalCompression(params)) {
    const safe = split
      .replace(/[()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (safe) return cleanupPromptTail(safe);
  }

  const performance = compactVocalSummaryCue(buildSelectedVocalPerformancePhrase(params, 6), info.isMulti ? 3 : 4);
  if (info.mode === 'duo' || total === 2) {
    return cleanupPromptTail(`2 ${genderWord} vocal split with ${performance}, contrasting delivery, and clear section separation`);
  }
  if (shouldApplyLargeGroupVocalCompression(params)) {
    return cleanupPromptTail(`${Math.max(total, 3)}-voice ${genderWord} group vocal split with compact distinct tones and clear main, rap, harmony roles`);
  }
  return cleanupPromptTail(`Natural ${genderWord === 'vocal' ? '' : genderWord + ' '}vocal with ${performance || 'story-aware delivery'}`);
}

function repairMalformedFinalVocalLine(value: string, params: GenerateSongParams): string {
  const line = cleanupPromptTail(value);
  const isLargeGroup = shouldApplyLargeGroupVocalCompression(params);
  if (isMalformedFinalVocalLine(line)) {
    return summarizeFinalVocalLineFromParams(params, 'broken');
  }
  if (isLargeGroup && line.length > 240) {
    return summarizeFinalVocalLineFromParams(params, 'large-group');
  }
  return line;
}

function hardenFinalVocalGrammar(value: string, params: GenerateSongParams): string {
  let line = cleanupPromptTail(value)
    .replace(/\bvocal\s+(raw|energetic|slightly\s+distorted|sincere\s+storytelling|warm\s+tone|melancholic\s+feeling|natural\s+emotional\s+delivery|dark|wistful\s+feeling|smooth|close\s+breath|late[-\s]?night\s+phrasing)\b/gi, 'vocal with $1')
    .replace(/\bvocals\s+(raw|energetic|slightly\s+distorted|sincere\s+storytelling|warm\s+tone|melancholic\s+feeling|natural\s+emotional\s+delivery|dark|wistful\s+feeling|smooth|close\s+breath|late[-\s]?night\s+phrasing)\b/gi, 'vocals with $1')
    .replace(/\bwith\s+Raw,\s*Energetic,\s*Slightly\s+distorted\b/gi, 'with raw energy and slight distortion')
    .replace(/\bwith\s+Sincere\s+storytelling,\s*Warm\s+tone,\s*melancholic\s+feeling\b/gi, 'with sincere storytelling, warm tone, and melancholy')
    .replace(/\bwith\s+natural\s+emotional\s+delivery,\s*dark,\s*wistful\s+feeling\b/gi, 'with natural emotional delivery and dark wistful feeling')
    .replace(/\bwith\s+Smooth\s+silky\s+tone,\s*Precise\s+R&B\s+runs,\s*upbeat\s+warmth\b/gi, 'with smooth silky tone, precise R&B runs, and upbeat warmth')
    .replace(/\bwith\s+([A-Z][a-z]+),\s*([A-Z][a-z]+),\s*([A-Z][a-z]+(?:\s+[a-z]+)?)\b/g, (_m, a, b, c) => `with ${String(a).toLowerCase()}, ${String(b).toLowerCase()}, ${String(c).toLowerCase()}`)
    .replace(/\bwith\s+([a-z]+),\s*([a-z]+),\s*([a-z]+(?:\s+[a-z]+)?)\b/gi, 'with $1, $2, and $3')
    .replace(/\bwith\s+with\b/gi, 'with')
    .replace(/\s{2,}/g, ' ');

  const isLargeGroup = shouldApplyLargeGroupVocalCompression(params);
  const match = line.match(/^(.*?\bwith\b)\s+(.+)$/i);
  if (isLargeGroup && match) {
    const head = cleanupPromptTail(match[1]);
    const cues = match[2]
      .replace(/\bstory-aware\s+expression\b/gi, '')
      .split(/,\s*|\s+and\s+/i)
      .map((part) => cleanupPromptTail(part))
      .filter(Boolean);
    const picked: string[] = [];
    for (const cue of cues) {
      const normalized = cue.toLowerCase().replace(/\b(?:delivery|phrasing|tone|feeling|emotion|vocal|with)\b/g, '').trim();
      if (!normalized) continue;
      if (picked.some((existing) => existing.toLowerCase().includes(normalized) || normalized.includes(existing.toLowerCase()))) continue;
      picked.push(cue);
      if (picked.length >= 4) break;
    }
    line = cleanupPromptTail(`${head} ${joinPromptPhrase(picked, 'and')}`);
  }
  return dedupeRepeatedVocalCuePhrases(hardenPromptOpenTail(line)) || 'Natural solo vocal with human breath';
}

function finalValidatorSelectedText(params: GenerateSongParams): string {
  return [
    getIntentKeywordText(params),
    selectedThemeText(params),
    rawMoodAndDirectInputText(params),
    selectedStyleText(params, { excludeEraTexture: false }),
    selectedSoundText(params),
    params.userInput || '',
    params.customThemeInput || '',
    getDirectThemeInputText(params),
    getDirectMoodInputText(params),
  ].join(' ').toLowerCase();
}

function buildFinalGenreValidatorAccents(params: GenerateSongParams): string[] {
  const text = finalValidatorSelectedText(params);
  const accents: string[] = [];
  const add = (value: string) => {
    const clean = cleanupPromptTail(value);
    if (!clean) return;
    if (accents.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    accents.push(clean);
  };

  getEraTextureGenreAccents(params).slice(0, 1).forEach(add);
  if (/cyber|사이버|digital|디지털|glitch|글리치/.test(text)) add('cyber texture');
  if (/live|라이브|공연장|stage|concert/.test(text)) add('live-stage warmth');
  if (/새벽|dawn|late[-\s]?night|midnight|밤/.test(text)) add('late-night mood');
  if (/우주|space|cosmic|공간감|넓은\s*공간|wide|spacious/.test(text)) add('wide spatial haze');
  if (/fantasy|판타지|magical|마법|동화/.test(text)) add('fantasy atmosphere');
  if (/dream|dreamy|몽환|드림|hazy|haze/.test(text)) add('dreamy haze');
  if (/band|밴드|rock|록|guitar|기타/.test(text)) add('band edge');
  if (/r&b|rnb|알앤비|harmony|하모니/.test(text)) add('R&B harmony');
  if (/warm|따뜻|intimate|아늑|포근/.test(text)) add('warm intimacy');
  if (/siren|사이렌|ambulance|구급차/.test(text)) add('urgent siren tension');
  return dedupeGenreAccentTokens(accents).slice(0, 2);
}

function validateFinalGenreLine(value: string, params: GenerateSongParams): string {
  let genre = finalizePromptOpenTail(stripNonGenrePerformancePhrases(value));
  genre = sanitizePromptGenreArtifacts(genre)
    .replace(/\s+with\s*$/i, '')
    .replace(/\s+and\s*$/i, '')
    .trim();

  const hasBuzzReference = getDirectArtistReferences(params).some((ref) => /(?:버즈|\bBuzz\b)/i.test(`${ref.raw} ${ref.reference}`));
  if (hasBuzzReference) {
    genre = genre.replace(/\bBuzz-inspired\b/gi, 'Buzz-style');
  }

  const artistAccent = buildArtistReferenceGenreAccent(params);
  if (artistAccent && !genre.toLowerCase().includes(artistAccent.split(',')[0].toLowerCase())) {
    genre = sanitizePromptGenreArtifacts(`${artistAccent} ${genre}`);
  }

  const keywordCount = finalValidatorKeywordSignalCount(params);
  const hasExpansion = /\b(?:with|fusion|edge|color|polish|haze|texture|warmth|mood|atmosphere|pulse)\b/i.test(genre);
  const tooPlain = genre.split(/\s+/).filter(Boolean).length <= 4 || !hasExpansion;
  if (keywordCount >= 4 && tooPlain) {
    genre = attachGenreAccents(genre, buildFinalGenreValidatorAccents(params));
  }

  return hardenPromptOpenTail(genre) || 'Genre-led pop fusion';
}

function compressAtmosphereForFinalValidator(value: string, params: GenerateSongParams): string {
  let line = hardenPromptOpenTail(normalizeAtmospherePromptLine(value));
  const contextual = buildContextualCueBundle(params);
  const maxLength = 170;

  if (line.length > maxLength || /,\s*(?:powerful|surreal|floating|open|upbeat|dreamy|moody|warm|soft),\s*(?:and\s+)?/i.test(line)) {
    const whereMatch = line.match(/^(.*?)\s+where\s+(.+)$/i);
    if (whereMatch) {
      const head = cleanupPromptTail(whereMatch[1]);
      const where = cleanupPromptTail(whereMatch[2]
        .replace(/\s+(?:with|and|while)\s*$/i, '')
        .split(/,\s*/)[0]);
      line = cleanupPromptTail(`${head} where ${where}`);
    }
  }

  if (line.length > maxLength && contextual.atmosphereScene) {
    line = contextual.atmosphereScene;
  }

  if (line.length > maxLength) {
    line = cleanupPromptTail(limitText(line, maxLength));
  }

  return hardenAtmosphereValidatorText(line, params) || 'balanced emotional air';
}


function guardAtmosphereTextureNounBeforeWhere(value: string): string {
  let line = cleanupPromptTail(String(value || '').replace(/\s+/g, ' '));
  if (!line) return line;

  // Final, narrow Atmosphere-only polish: when a texture adjective is left
  // immediately before "where", add the smallest noun needed instead of
  // compressing or removing selected detail.
  const textureNounMap: Record<string, string> = {
    vintage: 'vintage tone',
    floating: 'floating air',
    spacious: 'spacious air',
    dreamy: 'dreamy haze',
    submerged: 'submerged mood',
    cinematic: 'cinematic air',
    magical: 'magical tone',
    emotional: 'emotional tension',
    narrative: 'narrative tension',
    intimate: 'intimate air',
    warm: 'warm tone',
    soft: 'soft tone',
    calm: 'calm tone',
    lonely: 'lonely air',
    quiet: 'quiet air',
    bright: 'bright air',
    dark: 'dark tension',
    moody: 'moody air',
    hopeful: 'hopeful air',
    playful: 'playful tone',
    surreal: 'surreal air',
    open: 'open air',
    upbeat: 'upbeat warmth',
  };

  const textureWords = Object.keys(textureNounMap).join('|');

  line = line
    // Atmosphere-only conjunction cleanup. Keep selected details, but remove
    // connector duplication and noun bare texture adjectives before `where`.
    .replace(/\band\s+and\b/gi, 'and')
    .replace(/,\s*and\s+and\b/gi, ', and')
    .replace(/\bdreamy\s+haze\s+space\s+where\b/gi, 'dreamy haze where')
    .replace(/\bwide\s+spatial\s+haze\s+space\s+where\b/gi, 'wide spatial haze where')
    .replace(/\bwith\s+([^,]+?)\s+with\s+([^,]+?)\s+where\b/gi, 'with $1 and $2 where')
    .replace(/\bwith\s+([^,]+?)\s+and\s+emotional\s+and\s+narrative\s+where\b/gi, 'with $1 and emotional narrative where')
    .replace(/\band\s+emotional\s+and\s+narrative\s+where\b/gi, 'and emotional narrative where')
    .replace(new RegExp(`\\band\\s+(${textureWords})\\s+where\\b`, 'gi'), (_m, word) => `and ${textureNounMap[String(word).toLowerCase()] || word} where`)
    .replace(new RegExp(`,\\s*(${textureWords})\\s+where\\b`, 'gi'), (_m, word) => `, ${textureNounMap[String(word).toLowerCase()] || word} where`)
    .replace(new RegExp(`\\bwith\\s+(${textureWords})\\s+where\\b`, 'gi'), (_m, word) => `with ${textureNounMap[String(word).toLowerCase()] || word} where`);

  // If "with A, B, and C where" still leaves C as a bare texture adjective,
  // noun it without cutting A/B.
  line = line.replace(
    new RegExp(`\\bwith\\s+(.+?),\\s*and\\s+(${textureWords})\\s+where\\b`, 'gi'),
    (_m, prefix, word) => `with ${cleanupPromptTail(prefix)}, and ${textureNounMap[String(word).toLowerCase()] || word} where`,
  );

  line = line
    .replace(/\bwith\s+(.+?)\s+and\s+and\s+(.+?)\s+where\b/gi, 'with $1 and $2 where')
    .replace(/\bwith\s+(.+?),\s*dark,\s*and\s+brooding\s+where\b/gi, 'with $1 and brooding darkness where')
    .replace(/\bwith\s+(.+?),\s*and\s+brooding\s+where\b/gi, 'with $1 and brooding darkness where')
    .replace(/\bwith\s+urban\s+and\s+and\s+suspenseful\s+where\b/gi, 'with urban suspense where')
    .replace(/\bwith\s+urban\s+and\s+suspenseful\s+where\b/gi, 'with urban suspense where')
    .replace(/\band\s+dark,\s*and\s+brooding\s+where\b/gi, 'and brooding darkness where')
    .replace(/\band\s+and\b/gi, 'and')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleanupPromptTail(line);
}


function rescueBrokenDirectAtmosphereLine(value: string, params: GenerateSongParams): string {
  const line = cleanupPromptTail(String(value || ''));
  const isBroken = !line || /^a\s*$/i.test(line) || /^an\s*$/i.test(line) || /^the\s*$/i.test(line) || line.length < 12;
  if (!isBroken) return line;

  const profile = buildDirectStoryPromptProfile(params);
  if (profile.strength !== 'none' && profile.scene) {
    const textureParts = dedupePromptParts([
      ...getAtmosphereSpaceCues(params),
      buildDirectMoodAngle(params),
      buildCompactMoodAngle(params),
    ], 5)
      .map((part) => cleanScenePlanPhrase(part, 42))
      .filter(Boolean)
      .filter((part) => !profile.scene.toLowerCase().includes(part.toLowerCase()))
      .filter((part) => !String(profile.conflict || '').toLowerCase().includes(part.toLowerCase()))
      .slice(0, 2);

    const rescued = cleanupPromptTail([
      cleanScenePlanPhrase(profile.scene, 95),
      textureParts.length ? `with ${joinPromptPhrase(textureParts, 'and')}` : '',
      profile.conflict ? `where ${cleanScenePlanPhrase(profile.conflict, 95)}` : '',
    ].filter(Boolean).join(' '));

    return normalizeAtmospherePromptLine(rescued) || rescued || 'balanced emotional air';
  }

  if (hasDirectThemeOrMoodInput(params)) {
    const userScene = buildUserTextCoreScene(params);
    const scene = cleanScenePlanPhrase(userScene?.scene || deriveIntentScene(params) || 'the user\'s direct scene', 95);
    const mood = cleanScenePlanPhrase(buildDirectMoodAngle(params) || buildCompactMoodAngle(params) || '', 60);
    const conflict = cleanScenePlanPhrase(directConflictFallback(params), 95);
    const rescued = cleanupPromptTail([
      scene,
      mood ? `with ${mood}` : '',
      conflict ? `where ${conflict}` : '',
    ].filter(Boolean).join(' '));
    return normalizeAtmospherePromptLine(rescued) || rescued || 'balanced emotional air';
  }

  return line || 'balanced emotional air';
}

function validateFinalAtmosphereLine(value: string, params: GenerateSongParams): string {
  let line = compressAtmosphereForFinalValidator(value, params)
    .replace(/\bwith\s+([^,]+?),\s*([^,]+?)\s+where\b/gi, 'with $1 and $2 where')
    .replace(/\bwith\s+(upbeat|open|dreamy|moody|warm|soft|bright|dark|calm|hopeful|playful)\s+and\s+(upbeat|open|dreamy|moody|warm|soft|bright|dark|calm|hopeful|playful)\s+where\b/gi, 'with $1 $2 air where')
    .replace(/\bwith\s+upbeat,\s*open\s+where\s+one\s+unsaid\s+feeling\s+pushes\s+against\s+an\s+ordinary\s+moment\b/gi, 'where one unsaid feeling pushes against an ordinary moment with upbeat warmth')
    .replace(/\bwhere\s+a\s+hidden\s+feeling\s+with\s+powerful,\s*surreal,\s*floating,\s*and\s*blurred\s+reverb\b/gi, 'where hidden feelings move through surreal floating air')
    .replace(/\bwith\s+moody\s+street\s+noise\s+where\b/gi, 'with moody street noise where');

  line = compressAtmosphereForFinalValidator(line, params);
  line = hardenAtmosphereValidatorText(line, params);
  line = guardAtmosphereTextureNounBeforeWhere(line)
    .replace(/\band\s+and\b/gi, 'and')
    .replace(/\bwith\s+(.+?),\s*dark,\s*and\s+brooding\s+where\b/gi, 'with $1 and brooding darkness where')
    .replace(/\bwith\s+urban\s+and\s+suspenseful\s+where\b/gi, 'with urban suspense where')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const protectedLine = stripUnsupportedDirectCueBankPhrases(stripFinalInternalProtectionLanguage(line || 'balanced emotional air'), params) || 'balanced emotional air';
  let rescued = rescueBrokenDirectAtmosphereLine(protectedLine, params);
  rescued = stripFinalInternalProtectionLanguage(rescued);
  if (isBrokenFinalPromptPhrase(rescued)) rescued = buildNaturalDirectAtmosphereFallback(params);
  if (isGenericAtmosphereFallbackLine(rescued) && hasAtmosphereInterpretationSignal(params)) {
    rescued = buildIntentConnectedAtmosphereLine(params, protectedLine);
  }
  return cleanupPromptTail(rescued);
}

function lowerCaseVocalCueWords(value: string): string {
  return String(value || '')
    .replace(/\bwith\s+([A-Z][a-z]+),\s*([A-Z][a-z]+\s+delivery)\b/g, (_m, a, b) => `with ${String(a).toLowerCase()} ${String(b).toLowerCase()}`)
    .replace(/\bwith\s+([A-Z][a-z]+),\s*([A-Z][a-z]+),\s*([A-Z][a-z]+(?:\s+[a-z]+)?)\b/g, (_m, a, b, c) => `with ${String(a).toLowerCase()}, ${String(b).toLowerCase()}, ${String(c).toLowerCase()}`)
    .replace(/\bvocal\s+(Smooth|Clear|Soft|Warm|Dreamy|Powerful|Precise|Vulnerable|Soulful|Passionate|Rhythmic|Spanish|Melancholic|Sophisticated)\b/g, (_m, a) => `vocal with ${String(a).toLowerCase()}`)
    .replace(/\bwith\s+Sophisticated,\s*Smooth\s+delivery\b/gi, 'with smooth sophisticated delivery');
}

function enforceExplicitSoloVocalFormation(value: string, params: GenerateSongParams): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isSolo) return value;

  const line = cleanupPromptTail(value);
  // Solo mode is an explicit UI choice. Artist references such as Buzz-inspired, K-band,
  // band ballad, or selected band styles may color the arrangement, but they must not
  // turn the [Vocals] line into a group/duo/main-rap-harmony split.
  const incorrectlySplit = /\b(?:group|duo|split|two[-\s]?voice|three[-\s]?voice|\d+[-\s]?voice|main\s+vocal|lead\s+vocal|sub\s+vocal|rap\s+vocal|harmony\s+vocal|main\s*,\s*rap|rap\s*,\s*harmony|harmony\s+roles?)\b/i.test(line);
  const missingSoloIdentity = !/\bsolo\b/i.test(line) && /\b(?:male|female)\b/i.test(line);
  if (!incorrectlySplit && !missingSoloIdentity) return line;

  const soloMember = params.vocal?.members?.[0];
  const memberGender = soloMember?.gender;
  const gender = memberGender === "female" ? "female" : memberGender === "male" ? "male" : info.gender === "female" ? "female" : info.gender === "male" ? "male" : "solo";
  const subject = gender === "female" ? "Natural female solo vocal" : gender === "male" ? "Natural male solo vocal" : "Natural solo vocal";
  const characterPrompt = soloMember ? buildVocalCharacterPrompt(soloMember, params, false) : "";
  const artistAccent = buildArtistReferenceVocalAccent(params);
  const genreDefault = getGenreDefaultVocalPhrase(params);
  const performance = buildSelectedVocalPerformancePhrase(params, 8);
  const parts = dedupePromptParts([
    characterPrompt,
    artistAccent,
    compactVocalCueAfterSubject(genreDefault),
    performance,
    "single lead vocal focus",
  ], 8).filter(Boolean);

  return cleanupPromptTail(`${subject}${parts.length ? ` with ${joinPromptPhrase(parts, 'and')}` : ' with natural emotional delivery'}`);
}

function validateFinalVocalsLine(value: string, params: GenerateSongParams): string {
  let line = lowerCaseVocalCueWords(normalizeVocalPromptEmotion(value, params));
  line = compactFiveLineVocalsValue(line, params);
  line = lowerCaseVocalCueWords(line)
    .replace(/\bwith\s+with\b/gi, 'with')
    .replace(/\bSmooth\s+silky\s+tone\b/g, 'smooth silky tone')
    .replace(/\bPrecise\s+R&B\s+runs\b/g, 'precise R&B runs')
    .replace(/\bDeep\s+vibrato\b/g, 'deep vibrato')
    .replace(/\bDramatic\s+adult\s+phrasing\b/g, 'dramatic adult phrasing')
    .replace(/\bRhythmic\b/g, 'rhythmic')
    .replace(/\bPassionate\b/g, 'passionate')
    .replace(/\bSpanish\b/g, 'Spanish phrasing')
    .replace(/\bSpanish\s+phrasing\s+phrasing\b/g, 'Spanish phrasing')
    .replace(/\s{2,}/g, ' ');

  // Final hard cap: keep solo vocals compact, but allow group/duet contrast.
  const isLargeGroup = shouldApplyLargeGroupVocalCompression(params);
  const match = line.match(/^(.*?\bwith\b)\s+(.+)$/i);
  if (isLargeGroup && match) {
    const head = cleanupPromptTail(match[1]);
    const cues = match[2]
      .replace(/\bstory-aware\s+expression\b/gi, '')
      .split(/,\s*|\s+and\s+/i)
      .map((part) => cleanupPromptTail(part))
      .filter(Boolean);
    const picked: string[] = [];
    for (const cue of cues) {
      const key = cue.toLowerCase().replace(/\b(?:delivery|phrasing|tone|feeling|emotion|vocal|with)\b/g, '').trim();
      if (!key) continue;
      if (picked.some((existing) => existing.toLowerCase().includes(key) || key.includes(existing.toLowerCase()))) continue;
      picked.push(cue);
      if (picked.length >= 4) break;
    }
    line = cleanupPromptTail(`${head} ${joinPromptPhrase(picked, 'and')}`);
  }

  const artistVocalAccent = buildArtistReferenceVocalAccent(params);
  if (artistVocalAccent && !isBackgroundOnlyBgmGenre(params)) {
    const lowerLine = line.toLowerCase();
    const compactAccent = artistVocalAccent
      .split(/,\s*/)
      .map((part) => cleanupPromptTail(part))
      .filter((part) => part && !lowerLine.includes(part.toLowerCase()))
      .slice(0, shouldApplyLargeGroupVocalCompression(params) ? 1 : 2)
      .join(', ');
    if (compactAccent) line = cleanupPromptTail(`${line}, ${compactAccent}`);
  }

  const multiInfo = getVocalModeInfo(params.vocal);
  const finalMultiLimit = multiInfo.total >= 3 ? 340 : 450;
  if (multiInfo.isMulti && (line.length > finalMultiLimit || /voice character:/i.test(line))) {
    const compressed = buildRuleBasedCompressedMultiVocals(params);
    if (compressed) line = compressed;
  }

  const soloSafeLine = enforceExplicitSoloVocalFormation(line, params);
  const hardened = dedupeRepeatedVocalCuePhrases(hardenFinalVocalGrammar(soloSafeLine, params)) || 'Natural solo vocal with human breath';
  const repaired = repairMalformedFinalVocalLine(enforceExplicitSoloVocalFormation(hardened, params), params);
  const characterStable = stabilizeSoloCharacterVocalsLine(repaired, params);
  return buildInterpretiveSoloVocalFallbackLine(characterStable, params, buildThemeMoodInterpretation(params));
}

function arrangementCueCountForValidator(value: string): number {
  return cleanupPromptTail(value)
    .split(',')
    .map((part) => cleanupPromptTail(part))
    .filter((part) => part && !/^\d+\s*[–-]\s*\d+\s*BPM$/i.test(part) && !/^\d+\s*BPM$/i.test(part))
    .length;
}

function hasEvidenceForGenericCue(cue: string, params: GenerateSongParams): boolean {
  const text = finalValidatorSelectedText(params);
  const lower = cue.toLowerCase();
  if (/city[-\s]?cafe|cafe/.test(lower)) return /카페|cafe|coffee|커피/.test(text);
  if (/night[-\s]?drive|city[-\s]?drive|drive/.test(lower)) return /드라이브|drive|car|차|운전|도로|핸들/.test(text);
  if (/neighborhood[-\s]?walk|walk/.test(lower)) return /산책|walk|골목|street|거리|neighborhood/.test(text);
  return true;
}


function buildInterpretiveArrangementMovementParts(params: GenerateSongParams): string[] {
  const text = [
    selectedThemeText(params),
    selectedMoodText(params),
    getIntentKeywordText(params),
    rawMoodAndDirectInputText(params),
    getSelectedFusionGenres(params).map((genre) => `${genre.id} ${genre.label}`).join(' '),
  ].join(' ').toLowerCase();
  const parts: string[] = [];
  const add = (value: string) => {
    const clean = cleanupPromptTail(value);
    if (clean && !parts.some((part) => part.toLowerCase() === clean.toLowerCase())) parts.push(clean);
  };

  if (/enka|엔카/.test(text)) add('verse held in restrained enka tension');
  else if (/r&b|rnb|소울|soul/.test(text)) add('verse held in close restrained groove');
  else add('verse starts with restrained emotional focus');

  if (/불안|anxious|위태|precarious|tense|긴장/.test(text)) add('pre-chorus tightens into fragile pressure');
  else if (/희망|hope|성장|growth|free|자유/.test(text)) add('pre-chorus lifts the emotional pressure');
  else add('pre-chorus gradually increases emotional pressure');

  if (/chant|챈트|enka|엔카/.test(text)) add('chorus opens into a short phrase-led refrain');
  else add('chorus opens into a focused hook release');

  if (/마법|magical|신비|myster|꿈|dream|space|우주|몽환/.test(text)) add('Bridge turns suspended and otherworldly before the final refrain');
  else if (/슬픈|sad|미련|regret|이별|breakup/.test(text)) add('Bridge turns vulnerable before the final refrain');
  else add('Bridge shifts the emotion before the final refrain');

  return parts.slice(0, 4);
}

function strengthenArrangementInterpretiveMovement(value: string, params: GenerateSongParams): string {
  if (hasSituation(params.situation)) return value;
  const currentParts = splitArrangementParts(value);
  const nonTempo = currentParts.filter((part) => !/^\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM$/i.test(part) && !/^\d{2,3}\s*BPM$/i.test(part));
  const lower = value.toLowerCase();
  const hasSectionMovement = /\bverse\b|pre[-\s]?chorus|chorus|bridge|final\s+refrain|section\s+flow|builds?\s+(?:into|toward)|turns?\s+(?:fragile|vulnerable|suspended)/i.test(value);
  const looksThin = nonTempo.length <= 3 || !hasSectionMovement || /\b(?:focused hook|chant-like hook|clear sectional contrast|soft emotional release)\b/i.test(lower);
  if (!looksThin) return value;

  const additions = buildInterpretiveArrangementMovementParts(params)
    .filter((part) => !lower.includes(part.toLowerCase()));
  if (!additions.length) return value;
  return normalizeArrangementLine(dedupePromptParts([...currentParts, ...additions], 9));
}

function validateFinalArrangementLine(value: string, params: GenerateSongParams): string {
  const contextual = hasDirectThemeOrMoodInput(params) ? { atmosphereScene: '', arrangementHook: '' } : buildContextualCueBundle(params);
  const rawParts = stripUnsupportedDirectCueBankPhrases(cleanupPromptTail(value), params).split(',').map((part) => cleanupPromptTail(part)).filter(Boolean);
  let parts = rawParts.filter((part) => hasEvidenceForGenericCue(part, params));
  if (parts.length < rawParts.length && contextual.arrangementHook) parts.push(contextual.arrangementHook);

  let line = normalizeArrangementLine(parts);
  const additions: string[] = [];
  if (arrangementCueCountForValidator(line) < 3) {
    const specific = getSpecificGenreArrangementCue(params);
    const sceneHook = contextual.arrangementHook || buildArrangementSceneHook(params);
    const genreDNA = getGenreArrangementDNA(params);
    const directStoryCues = getDirectStoryArrangementCues(params).join(', ');
    [directStoryCues, specific, genreDNA, sceneHook, 'focused hook release'].forEach((cue) => {
      cleanupPromptTail(cue).split(',').forEach((part) => {
        const clean = cleanupPromptTail(part);
        if (clean && !additions.some((item) => item.toLowerCase() === clean.toLowerCase())) additions.push(clean);
      });
    });
  }
  const directStoryAlways = getDirectStoryArrangementCues(params).filter((cue) => !line.toLowerCase().includes(cue.toLowerCase()));
  if (additions.length || directStoryAlways.length) line = normalizeArrangementLine([line, ...additions, ...directStoryAlways]);

  const tempo = normalizeTempoForArrangement(buildTempoPromptPhrase(params)) || getGenreDefaultTempoForArrangement(params);
  if (tempo && !/\b\d{2,3}\s*[–-]\s*\d{2,3}\s*BPM\b|\b\d{2,3}\s*BPM\b/i.test(line)) {
    line = normalizeArrangementLine([tempo, line]);
  }
  let finalLine = stripUnsupportedDirectCueBankPhrases(finalizePromptOpenTail(line) || cleanupPromptTail([tempo, 'clear sectional contrast and focused hook'].filter(Boolean).join(', ')), params);
  finalLine = stripFinalInternalProtectionLanguage(finalLine);
  if (isBrokenFinalPromptPhrase(finalLine) || splitArrangementParts(finalLine).some((part) => isBrokenFinalPromptPhrase(part))) {
    finalLine = buildNaturalDirectArrangementFallback(params, finalLine);
  }
  const artistArrangementAccent = buildArtistReferenceArrangementAccent(params);
  if (artistArrangementAccent && !isBackgroundOnlyBgmGenre(params)) {
    const lowerLine = finalLine.toLowerCase();
    const addParts = artistArrangementAccent
      .split(/,\s*/)
      .map((part) => cleanupPromptTail(part))
      .filter((part) => part && !lowerLine.includes(part.toLowerCase()))
      .slice(0, 2);
    if (addParts.length) finalLine = normalizeArrangementLine([finalLine, ...addParts]);
  }
  finalLine = strengthenArrangementInterpretiveMovement(finalLine, params);
  return cleanupPromptTail(stripFinalInternalProtectionLanguage(finalLine));
}

function dedupeFinalInstrumentLine(value: string): string {
  const parts = cleanupPromptTail(value).split(',')
    .map((part) => cleanupPromptTail(part)
      .replace(/\bPure\b/g, '')
      .replace(/^(Distorted|Sliding|Complex|Bright|Pure)\b/, (m) => m.toLowerCase()))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase()
      .replace(/\b(?:bass|drums?|synths?|guitars?|keys?|piano|snare|kick|lead|layer|texture|with|and)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim() || part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return finalizePromptOpenTail(out.slice(0, 8).join(', ')) || 'balanced band and synth texture';
}

function validateFinalInstrumentLine(value: string, params: GenerateSongParams): string {
  const baseItems = dedupeFinalInstrumentLine(value || 'balanced band and synth texture')
    .split(',')
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean);
  const withStory = applyDirectStoryToInstrumentItems(baseItems, params);
  return dedupeFinalInstrumentLine(withStory.join(', '));
}

function isBackgroundOnlyBgmGenre(params: GenerateSongParams): boolean {
  if (Boolean((params as any).instrumentalBgmMode)) return true;

  const selectedIds = [
    params.genre || '',
    ...(params.subGenre || []),
    ...getSelectedFusionGenres(params).map((genre) => String(genre.id || '')),
  ].filter(Boolean);
  const hasSelectedDedicatedBgm = selectedIds.some(isInstrumentalBgmId);
  const hasSelectedNonBgm = selectedIds.some((id) => !isInstrumentalBgmId(id));

  // The visible/current genre selection is the source of truth.
  // If a normal song genre is present, stale Instrumental BGM ids must not keep the prompt in BGM mode.
  if (hasSelectedDedicatedBgm && !hasSelectedNonBgm) return true;

  const directText = [params.userInput || '', getDirectThemeInputText(params), getDirectMoodInputText(params)]
    .join(' ')
    .toLowerCase();
  const directDedicatedBgm = /(?:\bbgm\b|background\s+music|instrumental\s+only|no\s+vocals?|무보컬|보컬\s*없|보컬없이|연주\s*bgm|연주곡|배경음악)/i.test(directText);
  return directDedicatedBgm;
}

function parseFinalPromptLineMap(prompt: string): FinalPromptLineMap {
  const map: FinalPromptLineMap = { genre: '', instruments: '', atmosphere: '', vocals: '', arrangement: '' };
  const source = String(prompt || '').replace(/\r\n?/g, '\n');
  const labelPattern = /\[(Genre|Instruments|Atmosphere|Vocals|Arrangement)\]\s*/gi;
  const matches = Array.from(source.matchAll(labelPattern));
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const label = String(match[1] || '').toLowerCase() as keyof FinalPromptLineMap;
    const start = (match.index || 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index || source.length) : source.length;
    const value = cleanupPromptTail(source.slice(start, end).replace(/\[Audio quality improved to masterpiece\]/gi, ''));
    if (value) map[label] = value;
  }
  return map;
}

function sanitizeBackgroundOnlyBgmVocalsLine(value: string, params: GenerateSongParams): string {
  if (!isBackgroundOnlyBgmGenre(params)) return value;
  return 'Instrumental only, no vocals, no humming';
}

function getBgmSelectedText(params: GenerateSongParams, promptText: string = ''): string {
  return [
    params.genre || '',
    ...(params.subGenre || []),
    ...(params.moods || []),
    ...(params.themes || []),
    getDirectMoodInputText(params),
    getDirectThemeInputText(params),
    params.userInput || '',
    promptText || '',
  ].join(' ');
}

function getInstrumentalBgmProfileType(text: string): 'rhythmic' | 'nature' | 'drumless' | 'minimal' {
  const value = String(text || '').toLowerCase();
  if (/lo[-_\s]?fi|lofi|study|스터디|cafe|카페/.test(value)) return 'rhythmic';
  if (/nature|자연|ambient|앰비언트/.test(value)) return 'nature';
  if (/minimal|미니멀/.test(value)) return 'minimal';
  return 'drumless';
}

function getInstrumentalBgmSelectedIdentities(params: GenerateSongParams): FusionGenreIdentity[] {
  const selected = getSelectedFusionGenres(params)
    .filter((genre) => String(genre.id || '') !== 'instrumental_bgm')
    .filter((genre) => isInstrumentalBgmId(String(genre.id || '')) || /lo[-_\s]?fi|lofi|study|cafe|nature|ambience|ambient|healing|piano|minimal|string|로파이|스터디|카페|자연|앰비언트|힐링|피아노|미니멀|스트링/i.test(`${genre.id || ''} ${genre.label || ''}`));
  if (selected.length) return selected.slice(0, 2);
  const fallbackIds = (params.subGenre || []).filter((id) => String(id || '') !== 'instrumental_bgm');
  const fallbackLabels = getSubGenreLabels(fallbackIds).slice(0, 2);
  if (fallbackLabels.length) return fallbackLabels.map((label, index) => ({ id: fallbackIds[index] || label, label }));
  return [{ id: params.genre || 'instrumental_bgm', label: params.genre ? (getGenreMeta(params.genre)?.label || sentenceCase(params.genre)) : 'Instrumental BGM' }];
}


interface InstrumentalBgmMoodProfile {
  genreColor: string;
  atmosphere: string[];
  arrangement: string[];
}

function getInstrumentalBgmMoodSourceText(params: GenerateSongParams): string {
  const moodValues = (params.moods || []).map((mood) => resolveMoodValue(String(mood || '')));
  const themeValues = (params.themes || []).map((theme) => String(theme || ''));
  return [
    ...moodValues,
    ...themeValues,
    getDirectMoodInputText(params),
    getDirectThemeInputText(params),
    params.userInput || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildInstrumentalBgmMoodProfile(params: GenerateSongParams): InstrumentalBgmMoodProfile {
  const text = getInstrumentalBgmMoodSourceText(params).toLowerCase();
  const atmosphere: string[] = [];
  const arrangement: string[] = [];
  const colors: string[] = [];
  const add = (color: string, atm: string, arr: string) => {
    if (color && !colors.includes(color)) colors.push(color);
    if (atm && !atmosphere.includes(atm)) atmosphere.push(atm);
    if (arr && !arrangement.includes(arr)) arrangement.push(arr);
  };

  if (/따뜻|포근|아늑|편안|잔잔|calm|cozy|warm|peaceful|comfort/.test(text)) {
    add('warm calm', 'warm cozy air', 'gentle restrained movement');
  }
  if (/몽환|꿈|dream|dreamy|surreal|hazy|흐릿/.test(text)) {
    add('dreamy mellow', 'soft dreamy haze', 'slow blurred texture drift');
  }
  if (/설렘|사랑|짝사랑|로맨|애틋|heart|love|romantic|tender|crush/.test(text)) {
    add('tender romantic', 'soft romantic glow', 'gentle emotional swells without vocal hook');
  }
  if (/장난|귀여| playful|cute|cheeky|whimsical/.test(text)) {
    add('light playful', 'small playful warmth', 'subtle playful motif changes');
  }
  if (/슬픈|우울|비통|아련|외로운|lonely|sad|melancholy|blue|sorrow/.test(text)) {
    add('melancholic quiet', 'muted lonely shade', 'slow minor-color texture shifts');
  }
  if (/긴장|서스펜스|미스터리|불안|dark|tense|suspense|mystery|eerie/.test(text)) {
    add('subtle tense', 'quiet shadowy tension', 'sparse suspenseful pulses and restrained swells');
  }
  if (/야간|밤|새벽|midnight|night|late[-\s]?night/.test(text)) {
    add('late-night', 'late-night room stillness', 'soft nocturnal loop flow');
  }
  if (/골목|street|alley|도시|urban/.test(text)) {
    add('urban intimate', 'quiet urban alley ambience', 'subtle city-room texture shifts');
  }
  if (/변화|전환|바뀌|change|evolving|transition/.test(text)) {
    add('gently evolving', 'gentle sense of change in the background air', 'gradual tonal variation across the loop');
  }
  if (/자아|내면|reflection|introspective|self/.test(text)) {
    add('introspective', 'introspective private space', 'quiet reflective progression');
  }

  if (!colors.length) {
    colors.push('quiet focused');
    atmosphere.push('calm low-distraction air');
    arrangement.push('steady unobtrusive background movement');
  }

  return {
    genreColor: colors.slice(0, 3).join(' and '),
    atmosphere: atmosphere.slice(0, 4),
    arrangement: arrangement.slice(0, 3),
  };
}


function bgmGenreIdentityWords(profile: InstrumentalBgmMoodProfile): string[] {
  const raw = String(profile.genreColor || '').toLowerCase();
  const words: string[] = [];
  const add = (value: string) => { if (value && !words.includes(value)) words.push(value); };
  if (/warm|cozy|calm/.test(raw)) add('Warm');
  if (/dreamy|mellow/.test(raw)) add('Dreamy');
  if (/romantic|tender/.test(raw)) add('Romantic');
  if (/playful|cute|light/.test(raw)) add('Playful');
  if (/melancholic|lonely|quiet/.test(raw)) add('Melancholic');
  if (/tense|mystery|dark|suspense/.test(raw)) add('Shadowy');
  if (/late[-\s]?night|night/.test(raw)) add('Late-night');
  if (/urban/.test(raw)) add('Urban');
  if (/evolving/.test(raw)) add('Evolving');
  if (/introspective/.test(raw)) add('Introspective');
  if (!words.length) add('Quiet');
  return words.slice(0, 2);
}

function renderNaturalInstrumentalBgmGenre(base: string, profile: InstrumentalBgmMoodProfile, secondaryLabel = ''): string {
  const cleanBase = compactGenreToken(base || 'Instrumental BGM');
  const identity = bgmGenreIdentityWords(profile).join(' ');
  const withSecondary = secondaryLabel ? ` with ${compactGenreToken(secondaryLabel)} color` : '';
  return cleanupPromptTail(`${identity ? `${identity} ` : ''}${cleanBase}${withSecondary}`);
}

function buildInstrumentalBgmGeminiReinterpretationRule(): string {
  return [
    'Do not simply append mood keywords to the genre name.',
    'Musically reinterpret the selected genre, mood, theme, and direct input into a natural instrumental BGM prompt.',
    'Keep [Genre] concise and genre-like, but include 1–2 core identity keywords when they define the song’s first impression.',
    'Move detailed emotional and story-like words into [Atmosphere] and [Arrangement], not directly into [Genre].',
  ].join(' ');
}

function splitCommaList(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean);
}

function dedupeByNormalized(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = cleanupPromptTail(item);
    if (!clean) continue;
    const key = clean
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, ' ')
      .replace(/\b(?:soft|gentle|quiet|warm|subtle|minimal|background)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function joinBgmCues(...groups: Array<string | string[] | undefined>): string {
  const items = groups.flatMap((group) => Array.isArray(group) ? group : group ? [group] : [])
    .map((item) => cleanupPromptTail(String(item || '')))
    .filter(Boolean);
  return dedupeByNormalized(items).join(', ');
}

function sanitizeBackgroundOnlyBgmAtmosphereLine(value: string, params: GenerateSongParams): string {
  if (!isBackgroundOnlyBgmGenre(params)) return value;
  const selectedText = getBgmSelectedText(params);
  const baseMood = [
    ...(params.moods || []),
    getDirectMoodInputText(params),
    getDirectThemeInputText(params),
    params.userInput || '',
  ].filter(Boolean).join(', ');
  const moodTail = baseMood ? ` with ${cleanupPromptTail(baseMood).slice(0, 90)}` : '';
  if (/nature|자연/i.test(selectedText)) return `quiet natural background space${moodTail}, gentle air, soft environmental motion`;
  if (/cafe|카페/i.test(selectedText)) return `quiet cafe background space${moodTail}, warm room tone, low-distraction everyday ambience`;
  if (/healing|piano|힐링|피아노/i.test(selectedText)) return `calm healing instrumental space${moodTail}, soft piano warmth, quiet room resonance`;
  if (/lo[-_\s]?fi|lofi|로파이|study|스터디/i.test(selectedText)) return `quiet lo-fi study background${moodTail}, warm room tone, low-distraction focus`;
  return `quiet instrumental background atmosphere${moodTail}, soft space, low distraction`;
}

function sanitizeBackgroundOnlyBgmInstrumentsLine(value: string, params: GenerateSongParams): string {
  if (!isBackgroundOnlyBgmGenre(params)) return value;
  const selectedText = getBgmSelectedText(params, value);
  const profileType = getInstrumentalBgmProfileType(selectedText);
  const rawItems = splitCommaList(value)
    .map((item) => cleanupPromptTail(item))
    .filter(Boolean);
  const vocalBannedCue = /\b(?:vocal|vocals|voice|female\s+solo|male\s+solo|humming|hum|choir|chant|breath|breathy|sigh|spoken)\b/i;
  const heavyRhythmCue = /\b(?:808|kick|snare|hi[-\s]?hat|hats|clap|full\s+drums?|heavy\s+drums?|band\s+groove|riff|lead\s+synth|hook\s+synth)\b/i;
  const drumCue = /\b(?:drums?|drum\s*loop|boom[-\s]?bap|brushed\s+drums?|percussion|beat|beats|bass|guitar)\b/i;
  const kept = rawItems.filter((item) => {
    if (vocalBannedCue.test(item)) return false;
    if (heavyRhythmCue.test(item)) return false;
    if (profileType !== 'rhythmic' && drumCue.test(item)) return false;
    return true;
  });
  const minimal = dedupeByNormalized(kept).slice(0, profileType === 'rhythmic' ? 4 : 3);
  if (minimal.length >= 2) {
    const tail = profileType === 'rhythmic' ? 'no vocal samples, rhythm kept extremely sparse' : 'no vocal samples, no drums';
    return cleanupPromptTail([...minimal, tail].join(', '));
  }
  if (profileType === 'nature') {
    return 'natural field ambience, gentle environmental texture, soft ambient pad, no vocal samples, no beat';
  }
  if (profileType === 'minimal') {
    return 'minimal repeating motif, soft tonal pulse, quiet room texture, no vocal samples';
  }
  if (/cafe|카페/i.test(selectedText)) {
    return 'soft piano color, warm room tone, quiet cafe ambience, optional very sparse brushed rhythm, no vocal samples';
  }
  if (/lo[-_\s]?fi|lofi|로파이|study|스터디/i.test(selectedText)) {
    return 'warm muted Rhodes or soft lo-fi keys, analog tape hiss, vinyl crackle, gentle room ambience, very sparse brushed lo-fi drums, no vocal samples';
  }
  if (/string|스트링/i.test(selectedText)) {
    return 'soft string ensemble, warm cello layer, gentle violin harmony, subtle hall reverb, no vocal samples, no drums';
  }
  return 'intimate piano or soft instrumental texture, gentle room reverb, quiet background space, no vocal samples, no drums';
}

function sanitizeBackgroundOnlyBgmArrangementLine(value: string, params: GenerateSongParams): string {
  if (!isBackgroundOnlyBgmGenre(params)) return value;
  const tempo = normalizeTempoForArrangement(buildTempoPromptPhrase(params)) || getGenreDefaultTempoForArrangement(params);
  const selectedText = getBgmSelectedText(params, value);
  const profileType = getInstrumentalBgmProfileType(selectedText);
  const fallback = profileType === 'nature'
    ? 'slow ambient drift, long texture breathing, no beat, non-distracting environmental flow'
    : profileType === 'minimal'
      ? 'loopable minimal motif, subtle micro-variation, restrained background structure'
      : profileType === 'rhythmic'
        ? 'loopable low-distraction background groove, very restrained dynamics, optional sparse beat only, no vocal hook'
        : /string|스트링/i.test(selectedText)
          ? 'slow evolving string movement, gentle swells, loopable scene support, no vocal hook, no drums'
          : 'slow instrumental flow, gentle rise and fall, soft transitions, no vocal hook, no drums';
  const constraint = profileType === 'rhythmic'
    ? 'instrumental only, no vocals, no humming, sparse background rhythm only'
    : 'instrumental only, no vocals, no humming, drumless background flow';
  return cleanupPromptTail(normalizeArrangementLine([
    tempo,
    constraint,
    fallback,
  ].filter(Boolean)));
}

function shouldForceBackgroundOnlyBgmFromPrompt(prompt: string, map: FinalPromptLineMap): boolean {
  const text = [prompt || '', map.genre || '', map.instruments || '', map.atmosphere || '', map.vocals || '', map.arrangement || '']
    .join(' ')
    .toLowerCase();
  return /(?:lo[-\s]?fi\s+study|lo[-\s]?fi\s+chill|lofi[_\s-]*study|lofi[_\s-]*instrumental|nature\s+ambience|cafe\s*bgm|healing\s+piano|piano\s+solo|string\s+ensemble|minimalism|minimalist\s+background|instrumental\s+background|background\s+music|연주\s*bgm|로파이\s*스터디|자연\s*앰비언스|카페\s*bgm|힐링\s*피아노|피아노\s*솔로|스트링\s*합주|배경음악)/i.test(text);
}

function withBackgroundOnlyBgmMarker(params: GenerateSongParams, prompt: string, map: FinalPromptLineMap): GenerateSongParams {
  // The current selected genre state is the source of truth.
  // Do not re-enter Instrumental BGM mode only because Gemini produced a BGM-like line.
  if (!isBackgroundOnlyBgmGenre(params)) return params;
  return {
    ...params,
    subGenre: Array.from(new Set([...(params.subGenre || []), 'instrumental_bgm'])),
    isNoLyrics: true,
    includeLyrics: false,
    instrumentalBgmMode: true,
  } as GenerateSongParams;
}

function stripStaleInstrumentalBgmLanguage(value: string): string {
  return cleanupPromptTail(
    String(value || '')
      .replace(/\bno\s+vocal\s+samples?\b/gi, '')
      .replace(/\binstrumental\s+only\b/gi, '')
      .replace(/\bno\s+vocals?\b/gi, '')
      .replace(/\bno\s+humming\b/gi, '')
      .replace(/\bno\s+chanting\b/gi, '')
      .replace(/\bno\s+choir\b/gi, '')
      .replace(/\bno\s+spoken\s+words\b/gi, '')
      .replace(/\bdrumless\s+background\s+flow\b/gi, '')
      .replace(/\bpercussion[-\s]*free\b/gi, '')
      .replace(/\bno\s+drums?\b/gi, '')
      .replace(/\bno\s+vocal\s+hook\b/gi, '')
      .replace(/\bno\s+sung\s+hook\b/gi, '')
      .replace(/,\s*,+/g, ',')
      .replace(/^\s*,\s*|\s*,\s*$/g, ''),
  );
}

function isStaleInstrumentalBgmVocalLine(value: string): boolean {
  return /(?:instrumental\s+only|no\s+vocals?|no\s+humming|no\s+chanting|no\s+choir|no\s+spoken\s+words)/i.test(String(value || ''));
}

function finalOutputPromptValidator(prompt: string, params: GenerateSongParams): string {
  const map = parseFinalPromptLineMap(prompt);
  const validationParams = withBackgroundOnlyBgmMarker(params, prompt, map);
  const isBgmValidation = isBackgroundOnlyBgmGenre(validationParams);

  if (isBgmValidation) {
    return buildDedicatedInstrumentalBgmPrompt(validationParams);
  }

  map.genre = validateFinalGenreLine(map.genre || 'Genre-led pop fusion', validationParams);
  map.instruments = sanitizeBackgroundOnlyBgmInstrumentsLine(validateFinalInstrumentLine(map.instruments || 'balanced band and synth texture', validationParams), validationParams);
  map.atmosphere = sanitizeBackgroundOnlyBgmAtmosphereLine(validateFinalAtmosphereLine(map.atmosphere || 'balanced emotional air', validationParams), validationParams);
  map.vocals = sanitizeBackgroundOnlyBgmVocalsLine(validateFinalVocalsLine(map.vocals || 'Natural solo vocal with human breath', validationParams), validationParams);
  // In 2+ vocal mode, keep the final [Vocals] line rule-based instead of letting
  // Gemini freely re-summarize it. This preserves storyboard roles and selected
  // vocal-character details while still staying under the 1000-character ceiling.
  const stableMultiVocals = getVocalModeInfo(validationParams.vocal).isMulti
    ? buildRuleBasedCompressedMultiVocals(validationParams)
    : '';
  if (stableMultiVocals) {
    map.vocals = stableMultiVocals;
  }
  map.arrangement = sanitizeBackgroundOnlyBgmArrangementLine(validateFinalArrangementLine(map.arrangement || 'clear sectional contrast', validationParams), validationParams);

  // Final guard: if the current selection is a normal song, stale Instrumental BGM language
  // from a previous selection or Gemini retry must not survive into the visible prompt.
  map.instruments = stripStaleInstrumentalBgmLanguage(map.instruments) || 'balanced band and synth texture';
  map.arrangement = stripStaleInstrumentalBgmLanguage(map.arrangement) || 'clear sectional contrast';
  if (isStaleInstrumentalBgmVocalLine(map.vocals)) {
    map.vocals = cleanupPromptTail(buildFiveLineVocalsValue(validationParams, '')) || 'Natural solo vocal with human breath';
  }

  const finalPromptLines = [
    `[Genre] ${map.genre}`,
    `[Instruments] ${map.instruments}`,
    `[Atmosphere] ${map.atmosphere}`,
    `[Vocals] ${map.vocals}`,
    `[Arrangement] ${map.arrangement}`,
  ];
  if (!getVocalModeInfo(validationParams.vocal).isMulti) {
    finalPromptLines.push('[Audio quality improved to masterpiece]');
  }

  return removeAudioQualityLineWhenPromptIsNearLimit(enforceEnglishProductionPrompt(finalPromptLines.join('\n')));
}



function buildDedicatedInstrumentalBgmPrompt(params: GenerateSongParams): string {
  const selected = getInstrumentalBgmSelectedIdentities(params);
  const main = selected[0] || { id: 'instrumental_bgm', label: 'Instrumental BGM' };
  const secondary = selected[1];
  const selectedLabels = selected.map((item) => item.label).filter(Boolean);
  const selectedText = getBgmSelectedText(params, selectedLabels.join(' '));
  const mainText = `${main.id || ''} ${main.label || ''}`;
  const profileType = getInstrumentalBgmProfileType(mainText || selectedText);

  const moodProfile = buildInstrumentalBgmMoodProfile(params);
  const moodTail = moodProfile.atmosphere.length ? ` with ${moodProfile.atmosphere.join(', ')}` : '';
  const secondaryLabel = secondary?.label && secondary.label !== main.label && !/instrumental\s*bgm|연주\s*bgm/i.test(secondary.label) ? secondary.label : '';
  const secondaryCue = secondaryLabel ? ` with ${compactGenreToken(secondaryLabel)} color` : '';

  let genre = renderNaturalInstrumentalBgmGenre(main.label || 'Instrumental BGM', moodProfile, secondaryLabel);
  let instruments = 'minimal instrumental texture, soft pad, quiet room tone, no vocal samples';
  let atmosphere = `quiet instrumental background${moodTail}, soft space, low-distraction listening air`;
  let arrangementCore = 'loopable background flow, soft transitions, gentle texture movement, non-distracting movement';
  let arrangementConstraint = 'instrumental only, no vocals, no humming';

  if (profileType === 'rhythmic') {
    genre = /lo[-_\s]?fi|lofi|로파이|study|스터디/i.test(mainText)
      ? renderNaturalInstrumentalBgmGenre('Lo-fi Study', moodProfile, secondaryLabel)
      : renderNaturalInstrumentalBgmGenre(main.label || 'Cafe BGM', moodProfile, secondaryLabel);
    instruments = /cafe|카페/i.test(mainText)
      ? 'soft piano, warm room tone, quiet cafe ambience, optional very sparse brushed rhythm, no vocal samples'
      : 'warm muted Rhodes piano, soft vinyl crackle, minimal tape-hiss, gentle room ambience, very sparse brushed lo-fi drums, no vocal samples';
    atmosphere = /cafe|카페/i.test(mainText)
      ? joinBgmCues(`warm quiet cafe background${moodTail}`, 'relaxed everyday space', 'cozy low-distraction comfort')
      : joinBgmCues(`quiet lo-fi study background${moodTail}`, 'calm focus', 'peaceful solitude', 'low-distraction warmth');
    arrangementConstraint = 'instrumental only, no vocals, no humming, sparse background rhythm only';
    arrangementCore = joinBgmCues('minimal loop-based progression', 'steady hypnotic background groove', moodProfile.arrangement, 'very restrained dynamic shifts for continuous focus');
  } else if (profileType === 'nature') {
    genre = renderNaturalInstrumentalBgmGenre(/nature|자연/i.test(mainText) ? 'Nature Ambience' : (main.label || 'Ambient'), moodProfile, secondaryLabel);
    instruments = 'natural field ambience, gentle environmental texture, soft ambient pad, airy space tone, no vocal samples, no beat';
    atmosphere = joinBgmCues(`open natural background ambience${moodTail}`, 'gentle air', 'environmental calm', 'spacious low-distraction texture');
    arrangementConstraint = 'instrumental only, no vocals, no humming, beatless ambient flow';
    arrangementCore = joinBgmCues('slow ambient drift', 'long texture breathing', moodProfile.arrangement, 'gentle scene swells', 'continuous environmental flow');
  } else if (profileType === 'minimal') {
    genre = renderNaturalInstrumentalBgmGenre('Minimalism', moodProfile, secondaryLabel);
    instruments = 'minimal repeating motif, soft tonal pulse, quiet room texture, no vocal samples';
    atmosphere = joinBgmCues(`minimal background space${moodTail}`, 'clean negative space', 'restrained calm', 'focused low-distraction structure');
    arrangementConstraint = 'instrumental only, no vocals, no humming';
    arrangementCore = joinBgmCues('loopable minimal progression', 'subtle micro-variation', moodProfile.arrangement, 'restrained dynamic shape', 'no dramatic drop');
  } else if (/string|스트링/i.test(mainText)) {
    genre = renderNaturalInstrumentalBgmGenre('String Ensemble', moodProfile, secondaryLabel);
    instruments = 'soft string ensemble, warm cello layer, gentle violin harmony, subtle hall reverb, no vocal samples, no drums';
    atmosphere = joinBgmCues(`restrained cinematic string background${moodTail}`, 'warm sustained air', 'elegant instrumental space', 'no singer-centered story');
    arrangementConstraint = 'instrumental only, no vocals, no humming, drumless background flow';
    arrangementCore = joinBgmCues('slow evolving string movement', 'gentle swells', moodProfile.arrangement, 'loopable scene support', 'subtle harmonic motion');
  } else {
    genre = renderNaturalInstrumentalBgmGenre(/healing|힐링/i.test(mainText) ? 'Healing Piano' : /piano|피아노/i.test(mainText) ? 'Piano Solo' : (main.label || 'Instrumental BGM'), moodProfile, secondaryLabel);
    instruments = /healing|힐링/i.test(mainText)
      ? 'warm healing piano, soft room resonance, gentle reverb, airy pad support, no vocal samples, no drums'
      : 'intimate solo piano, soft felt hammer texture, natural room reverb, no vocal samples, no drums';
    atmosphere = joinBgmCues(`calm piano-led instrumental space${moodTail}`, 'warm stillness', 'quiet room resonance', 'gentle instrumental comfort');
    arrangementConstraint = 'instrumental only, no vocals, no humming, drumless background flow';
    arrangementCore = joinBgmCues('slow piano-led flow', 'gentle pauses', moodProfile.arrangement, 'soft rise and fall', 'peaceful loopable background movement');
  }

  const tempo = normalizeTempoForArrangement(buildTempoPromptPhrase(params)) || getGenreDefaultTempoForArrangement(params);
  return removeAudioQualityLineWhenPromptIsNearLimit(enforceEnglishProductionPrompt([
    `[Genre] ${cleanupPromptTail(genre)}`,
    `[Instruments] ${cleanupPromptTail(instruments)}`,
    `[Atmosphere] ${cleanupPromptTail(atmosphere)}`,
    `[Vocals] Instrumental only, no vocals, no humming`,
    `[Arrangement] ${cleanupPromptTail([tempo, arrangementConstraint, arrangementCore].filter(Boolean).join(', '))}`,
    `[Audio quality improved to masterpiece]`,
  ].join('\n')));
}

function hardEnforceInstrumentalBgmFinalPrompt(prompt: string, params: GenerateSongParams): string {
  const map = parseFinalPromptLineMap(prompt);
  const validationParams = withBackgroundOnlyBgmMarker(params, prompt, map);
  if (!isBackgroundOnlyBgmGenre(validationParams)) return prompt;
  return buildDedicatedInstrumentalBgmPrompt(validationParams);
}

function buildFinalPrompt(
  params: GenerateSongParams,
  resolvedStructure: SongStructure,
  detailLayer: string,
  variation: CreativeVariationSeed,
): string {
  const safeBuildLine = (label: string, builder: () => string, fallback: string) => {
    try {
      const value = cleanupPromptTail(builder());
      return value || fallback;
    } catch (error) {
      console.warn(`[Prompt Build Fallback] ${label} line failed:`, error);
      return fallback;
    }
  };

  if (isBackgroundOnlyBgmGenre(params)) {
    return buildDedicatedInstrumentalBgmPrompt(params);
  }

  const genre = safeBuildLine('Genre', () => buildFiveLineGenreValue(params), 'Genre-led pop fusion');
  const instruments = safeBuildLine('Instruments', () => buildFiveLineInstrumentsValue(params, detailLayer), 'balanced band and synth texture');
  const atmosphere = safeBuildLine(
    'Atmosphere',
    () => buildFiveLineAtmosphereValue(params, detailLayer, variation),
    normalizeAtmospherePromptLine(getAtmosphereForPrompt(params, detailLayer) || 'balanced emotional air'),
  );
  const vocals = safeBuildLine('Vocals', () => buildFiveLineVocalsValue(params, detailLayer), 'natural solo vocal with story-aware delivery');
  const arrangement = safeBuildLine('Arrangement', () => buildFiveLineArrangementValue(params, resolvedStructure, variation), 'clear sectional contrast');

  const bodyLines = compactFiveLinePromptBody([
    `[Genre] ${genre}`,
    `[Instruments] ${instruments}`,
    `[Atmosphere] ${atmosphere}`,
    `[Vocals] ${vocals}`,
    `[Arrangement] ${arrangement}`,
  ]).map((line) => {
    const cleaned = cleanupPromptTail(
      cleanProductionPhrase(line)
        .replace(/Fretless/gi, "fretless")
        .replace(/\bone-sided monologue focus with a call-response hook\b/gi, "one-sided monologue focus with single-owner hook")
        .replace(/\bparallel monologue focus with a call-response hook\b/gi, "parallel monologue focus with single-owner hook")
        .replace(/\bno balanced call-response with a call-response hook\b/gi, "single-owner hook, no balanced call-response")
        .replace(/\bMixed Vocal Duo\b/gi, "separated vocal roles")
        .replace(/\bTogether\b/gi, "All Vocals")
        .replace(/\[Genre\]\s+(lonely|relaxing|infectious|upbeat|bright|sad|warm|calm|dark|hopeful|tense)\s+/gi, "[Genre] ")
        .replace(/\bfused with ((?:early|mid|late)\s+\d{2}s|\d{2}s|\d{4}s|Y2K|modern)\b/gi, "$1")
        .replace(/\b(as the core|fused with|influence|based on|rooted in)\b/gi, "")
        .replace(/\[Vocals\]([^\n]*)\bsingalong chorus point\b/gi, (_m, pre) => `[Vocals]${pre}`)
        .replace(/\s{2,}/g, " "),
    );
    return sanitizePromptGenreArtifacts(sanitizeWarContextPromptLine(cleaned, params));
  });

  const preliminaryPrompt = forceSingleAtmosphereSentence(reconcileFiveLinePromptRoles(enforceEnglishProductionPrompt(
    [...bodyLines, `[Audio quality improved to masterpiece]`].join("\n"),
  ))).replace(/\blate[-\s]?night\s+stop\b/gi, 'late-night bus stop')
    .replace(/\bbus\s+bus\s+stop\b/gi, 'bus stop');

  return forceSingleAtmosphereSentence(finalOutputPromptValidator(preliminaryPrompt, params));
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
  const characterLabels = getVocalCharacterTagLabels(params);
  const labels = characterLabels.length ? characterLabels : getSituationAcousticTagLabels(params);
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
    [/서서히\s*멀어지는\s*파도|멀어지는\s*파도|파도\s*소리|파도/g, "distant waves fade out"],
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


const BUILTIN_LYRIC_SECTION_PATTERN = "Break|Stop|Intro|Verse(?:\\s*[A-Z]|\\s*\\d+)?|Pre[-\\s]?Chorus(?:\\s*\\d+)?|Chorus(?:\\s*\\d+)?(?:\\s*\\/\\s*Drop)?|Hook(?:\\s*\\d+)?|Final\\s*Hook|Rap\\s*Verse|Rap\\s*Section(?:\\s*[A-Z]|\\s*\\d+)?|Bridge(?:\\s*[A-Z]|\\s*\\d+)?|Breakdown|Drop|Final\\s*Chorus(?:\\s*\\d+)?(?:\\s*\\/\\s*Drop)?|Outro(?:\\s*\\d+)?|Solo|Instrumental(?:\\s+Opening)?|Build[-\\s]?up(?:\\s*\\d+)?|Climax|Main\\s*Theme|Theme\\s*[AB]";

function escapeRegexForSectionName(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, "\\s+");
}

function customLyricSectionPattern(params: GenerateSongParams): string {
  const customNames = Array.isArray(params.customStructure)
    ? params.customStructure
        .map((item) => String(item?.section || '').trim())
        .filter(Boolean)
        .filter((name) => !/^(?:Break|Stop)$/i.test(name))
        .map(escapeRegexForSectionName)
    : [];
  const unique = Array.from(new Set(customNames));
  return unique.length > 0 ? `${BUILTIN_LYRIC_SECTION_PATTERN}|${unique.join('|')}` : BUILTIN_LYRIC_SECTION_PATTERN;
}

function matchCompositeLyricSectionTag(rawInside: string, params: GenerateSongParams): RegExpMatchArray | null {
  return String(rawInside || '').trim().match(new RegExp(`^((?:${customLyricSectionPattern(params)})(?:\\s*\\/\\s*Drop)?)\\s*:\\s*(.+)$`, 'i'));
}

function isValidLyricSectionTagLine(trimmed: string, params: GenerateSongParams): boolean {
  return new RegExp(`^\\[(?:${customLyricSectionPattern(params)})(?:\\s*:\\s*[^\\]]*)?\\]$`, 'i').test(String(trimmed || '').trim());
}

function sanitizeLyricBracketTagToEnglish(line: string, params: GenerateSongParams): string {
  return String(line || "").replace(/\[([^\]\n]{1,180})\]/g, (full, inside) => {
    const rawInside = String(inside || "").trim();
    if (!rawInside) return "";

    const composite = matchCompositeLyricSectionTag(rawInside, params);
    if (composite) {
      const sectionName = normalizeLyricSectionNameForGeneration(composite[1].trim());
      const body = String(composite[2] || "").trim();
      const rawParts = stripVocalLabelsFromInstrumentalTagParts(
        sectionName,
        body
          .split(/[,，]/)
          .map((part) => cleanEnglishOnlyLyricTagPart(part))
          .filter(Boolean)
      );
      const parts = isInstrumentalLikeSection(sectionName)
        ? rawParts.slice(0, 3)
        : normalizeSungSectionCueParts(rawParts, sectionName).slice(0, 3);
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
  const sectionComposite = matchCompositeLyricSectionTag(rawInside, params);
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
      .replace(/\b(?:male|female|mixed|duet|group)\b\s*,?\s*/gi, "")
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
    .replace(/^Rap\s+Section\s*\d+$/i, "Rap Section")
    .replace(/^Pre[-\s]?Chorus\s*\d+$/i, "Pre-Chorus")
    .replace(/^Chorus\s*\d+$/i, "Chorus")
    .replace(/^Hook\s*\d+$/i, "Hook")
    .replace(/^Bridge\s*\d+$/i, "Bridge")
    .replace(/^Final\s+Chorus\s*\d+$/i, "Final Chorus")
    .replace(/^Outro\s*\d+$/i, "Outro")
    .replace(/^Build\s*up$/i, "Build-up")
    .replace(/^Build[-\s]?up\s*\d+$/i, "Build-up")
    .replace(/^Instrumental\s+Opening$/i, "Instrumental Opening")
    .trim();
}

function parseBracketOnlyLine(line: string): { inside: string; rest: string } | null {
  const match = String(line || "").trim().match(/^\[([^\]]{1,180})\](.*)$/);
  if (!match) return null;
  return { inside: match[1].trim(), rest: String(match[2] || "") };
}

function parseCompositeLyricTagInside(inside: string): { section: string; body: string } | null {
  const match = String(inside || "").trim().match(/^((?:Intro|Verse(?:\s*[A-Z]|\s*\d+)?|Pre[-\s]?Chorus(?:\s*\d+)?|Chorus(?:\s*\d+)?(?:\s*\/\s*Drop)?|Hook(?:\s*\d+)?|Final\s*Hook|Rap\s*Verse|Rap\s*Section(?:\s*[A-Z]|\s*\d+)?|Bridge(?:\s*[A-Z]|\s*\d+)?|Breakdown|Drop|Final\s*Chorus(?:\s*\d+)?(?:\s*\/\s*Drop)?|Outro(?:\s*\d+)?|Solo|Instrumental(?:\s+Opening)?|Build[-\s]?up(?:\s*\d+)?|Climax|Main\s*Theme|Theme\s*[AB])(?:\s*\/\s*Drop)?)\s*:\s*(.+)$/i);
  if (!match) return null;
  return { section: normalizeLyricSectionDisplayName(match[1]), body: match[2].trim() };
}

function isSectionOnlyLyricTagInside(inside: string): boolean {
  return /^(?:Intro|Verse(?:\s*[A-Z]|\s*\d+)?|Pre[-\s]?Chorus(?:\s*\d+)?|Chorus(?:\s*\d+)?(?:\s*\/\s*Drop)?|Hook(?:\s*\d+)?|Final\s*Hook|Rap\s*Verse|Rap\s*Section(?:\s*[A-Z]|\s*\d+)?|Bridge(?:\s*[A-Z]|\s*\d+)?|Breakdown|Drop|Final\s*Chorus(?:\s*\d+)?(?:\s*\/\s*Drop)?|Outro(?:\s*\d+)?|Solo|Instrumental(?:\s+Opening)?|Build[-\s]?up(?:\s*\d+)?|Climax|Main\s*Theme|Theme\s*[AB])(?:\s*\/\s*Drop)?$/i.test(String(inside || "").trim());
}

function isAcousticVoiceLabel(label: string): boolean {
  return /\b(?:Vocal|Vocals|Rap|Spoken\s+Vocal)\b/i.test(String(label || "").trim());
}

function isFinalSharedLyricSection(section: string): boolean {
  return /^(?:Final\s+Chorus|Final\s+Hook)$/i.test(String(section || "").trim());
}

function isInstrumentalLikeSection(section: string): boolean {
  return /^(?:Intro|Drop|Breakdown|Instrumental|Instrumental Opening|Solo|Build-up|Climax|Main Theme|Theme A|Theme B)$/i.test(String(section || "").trim());
}

function isSharedVocalLabel(label: string): boolean {
  return /^(?:All\s+Vocals|All\s+Female\s+Vocals|All\s+Male\s+Vocals|Mixed\s+Vocal\s+Duo|Together|Both|Duet)$/i.test(String(label || "").trim());
}

function fallbackSingleAcousticVoice(params: GenerateSongParams, preferredIndex = 0): string {
  const characterLabels = getVocalCharacterTagLabels(params).filter(Boolean);
  if (characterLabels[preferredIndex]) return characterLabels[preferredIndex];
  if (characterLabels[0]) return characterLabels[0];
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

function acousticLabelFromMemberToken(label: string, params: GenerateSongParams): string {
  const token = String(label || "").trim();
  const labels = getSituationAcousticTagLabels(params).filter(Boolean);
  const num = token.match(/\bMember\s*(\d+)\b/i)?.[1];
  if (num) {
    const index = Math.max(0, Number(num) - 1);
    return labels[index] || labels[0] || "Lead Vocal";
  }
  if (/Member\s*1\s*&\s*2|Member\s*1\s*and\s*2/i.test(token)) {
    return buildSituationDuoAcousticLabel(params);
  }
  return "";
}


function normalizeSungSectionCuePart(cue: string, sectionName: string): string {
  const original = cleanEnglishOnlyLyricTagPart(cue);
  const lower = original.toLowerCase().trim();
  if (!lower) return '';
  const section = String(sectionName || '').toLowerCase();
  const isHookSection = /chorus|hook|drop/.test(section);
  const isBridgeSection = /bridge|breakdown/.test(section);

  // Language labels should not appear as section cues unless the lyric body is actually in that language.
  // Convert common language-style labels into musical performance cues.
  if (/^Spanish$/i.test(original)) return 'latin pulse';
  if (/^Latin$/i.test(original)) return 'latin pulse';
  if (/^Portuguese$/i.test(original)) return 'latin pulse';
  if (/^Japanese$/i.test(original)) return 'clear phrasing';
  if (/^English$/i.test(original)) return 'clean phrasing';
  if (/^Korean$/i.test(original)) return 'clear diction';

  // Section tags should guide vocal/emotional execution. Convert genre/sound texture
  // words into performance or emotional-function cues unless the section is instrumental.
  if (/^fragmented$|fragmented\s+(?:verse|phrasing|line)/i.test(original)) return 'nervous fragments';
  if (/\bglitch(?:y|ed)?\b|glitch[-\s]?pop/i.test(original)) return isHookSection ? 'unstable hook' : 'unstable tension';
  if (/\bdigital\b|\bstutter(?:ing|ed)?\b|stop[-\s]?start/i.test(original)) return 'nervous stop-start';
  if (/\bbrass[-\s]?like\s+synth\s+stab\b|\bsynth\s+stab\b|\bstab\b/i.test(original)) return 'sharp accent';
  if (/\bambient\s+guitar\b|\bguitar\b|\bsynth\b|\bbass\b|\bdrums?\b|\bbeat\b|\bpads?\b|\btexture\b|\bpulse\b|\bmotif\b/i.test(original)) {
    if (/ambient|reverb|echo|room|space/i.test(original)) return 'hollow space';
    if (/bright|high|lift/i.test(original)) return isHookSection ? 'bright lift' : 'lifted tension';
    return '';
  }
  if (/wide\s+reverb|spatial\s+echo|spatial\s+echoes|distant\s+ambience|room\s+echo|intimate\s+room\s+echo|space\s+echo/i.test(original)) return 'spatial echoes';
  if (/^magical$|magic/i.test(original)) return 'wonder-struck';
  if (/^dark$|shadow/i.test(original)) return 'shadowed tension';
  if (/^cute$|adorable/i.test(original)) return 'playful softness';
  if (/obsess/i.test(original)) return 'obsessive tension';
  if (/dramatic\s+burst/i.test(original)) return 'emotional burst';
  if (/full\s+drive/i.test(original)) return 'full release';
  if (/high\s+tension/i.test(original)) return 'high tension';
  if (/cold\s+drop/i.test(original)) return isBridgeSection ? 'cold drop' : 'cold turn';
  if (/nu[-\s]?disco|disco\s+groove|groove|funk\s+bass|bass\s+lift|drum\s+pulse|disco\s+beat|laid[-\s]?back\s+groove/i.test(original)) {
    return isBridgeSection ? 'emotional lift' : '';
  }
  if (/stage[-\s]?light.*collapse|collapse.*imagery|조명.*붕괴/i.test(original)) return 'soft collapse';
  if (/\bmood\s+shift\b/i.test(original)) return isBridgeSection ? 'emotional turn' : 'emotional shift';
  if (/\bsoft\s+collapse\s+turn\b/i.test(original)) return 'soft collapse';
  return original;
}

function normalizeSungSectionCueParts(parts: string[], sectionName: string): string[] {
  const section = String(sectionName || '').toLowerCase();
  const isBridgeSection = /bridge|breakdown/.test(section);
  const normalized = parts
    .map((part) => normalizeSungSectionCuePart(part, sectionName))
    .map((part) => cleanEnglishOnlyLyricTagPart(part))
    .filter(Boolean);

  const priority = isBridgeSection
    ? [/turn|shift|release|collapse|rebuild|pressure|tension|fragile|hollow|intimate|emotional/i, /wide|echo|spatial|air|breath/i]
    : [/hook|lift|tension|intimate|fragile|wide|dry|airy|low|bright|dark|emotional|playful|clear/i];

  const out: string[] = [];
  const add = (clean: string) => {
    const key = clean.toLowerCase();
    if (!out.some((item) => item.toLowerCase() === key)) out.push(clean);
  };

  for (const rule of priority) {
    for (const clean of normalized) {
      if (rule.test(clean)) add(clean);
      if (out.length >= 2) return out;
    }
  }
  for (const clean of normalized) {
    add(clean);
    if (out.length >= 2) break;
  }
  return out;
}

function isLikelyInstrumentalCueLabel(label: string): boolean {
  const text = String(label || "").trim();
  if (!text) return false;
  if (isAcousticVoiceLabel(text) || isSharedVocalLabel(text)) return false;
  return /\b(?:instrumental|opening|solo|pad|pads|synth|bass|sub[-\s]?bass|808|drum|drums|guitar|piano|haegeum|gayageum|daegeum|janggu|piri|taepyeongso|haze|ambience|ambient|wind|rain|noise|texture|beat|drop|break|riff|theme|motif|reverb|echo|hiss|pulse|pulses|stabs|walking|groove)\b|해금|가야금|대금|장구|피리|태평소|바람|비|빗소리|파도|북|베이스|드럼|신스|앰비언스/i.test(text);
}

function cleanupCompositeTagConflicts(tag: string, params: GenerateSongParams): string {
  let out = String(tag || "")
    .replace(/,\s*(?:ONLY\s+)?(?:Male|Female)(?:\s+Main\s+Vocal)?\s*(?=,|$)/gi, ', ')
    .replace(/,\s*(?:Instrumental\s+break|vocal\s+break)\s*(?=,|$)/gi, ', ')
    .replace(/\bONLY\s+(?:Male|Female)(?:\s+Main\s+Vocal)?\b/gi, ' ')
    .replace(/\b(?:Male|Female)\s+Main\s+Vocal\b/gi, ' ')
    .replace(/\bInstrumental\s+break\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*,\s*/, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .trim();
  const isOneSided = /one-sided|parallel|평행|독백/i.test([
    params.situation?.developmentPreset,
    params.situation?.developmentCustom,
    params.situation?.development,
  ].filter(Boolean).join(" "));
  if (isOneSided) {
    out = out
      .replace(/\bcall[-\s]?response\s+hook\b/gi, "single-owner hook")
      .replace(/\bTogether\s+hook\b/gi, "single-owner hook");
  }
  return out.replace(/\s{2,}/g, " ").trim();
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
      .replace(/\bONLY\s+(?:male|female)(?:\s+main\s+vocal)?\b/gi, " ")
      .replace(/\b(?:male|female)\s+main\s+vocal\b/gi, " ")
      .replace(/\binstrumental\s+break\b/gi, " ")
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

function removeRedundantSectionOnlyBeforeComposite(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseBracketOnlyLine(lines[i]);
    const nextParsed = parseBracketOnlyLine(lines[i + 1] || "");
    if (parsed && nextParsed && isSectionOnlyLyricTagInside(parsed.inside)) {
      const nextComposite = parseCompositeLyricTagInside(nextParsed.inside);
      if (nextComposite && baseLyricSectionName(parsed.inside).toLowerCase() === baseLyricSectionName(nextComposite.section).toLowerCase()) {
        continue;
      }
    }
    out.push(lines[i]);
  }
  return out;
}


type CustomInstrumentalCueEntry = { section: string; base: string; cues: string[] };

function buildCustomInstrumentalCueQueue(params: GenerateSongParams): CustomInstrumentalCueEntry[] {
  const entries: CustomInstrumentalCueEntry[] = [];
  if (params.songStructure !== 'custom') return entries;
  (params.customStructure || []).forEach((item) => {
    const section = normalizeLyricSectionDisplayName(String(item.section || '').trim());
    if (!section) return;
    const tags = item.tags || [];
    const isInstrumentalSection = /^(?:Instrumental|Instrumental Opening|Solo|Drop)$/i.test(section) || tags.some((tag) => isCustomInstrumentalTag(tag));
    if (!isInstrumentalSection) return;
    const cues = cleanInstrumentalCueParts(tags.filter((tag) => !isCustomInstrumentalTag(tag)));
    entries.push({ section, base: baseLyricSectionName(section) || section, cues });
  });
  return entries;
}

function findNextCustomInstrumentalCue(
  section: string,
  queue: CustomInstrumentalCueEntry[],
  cursor: { value: number },
): CustomInstrumentalCueEntry | null {
  const normalized = normalizeLyricSectionDisplayName(section || '');
  const base = baseLyricSectionName(normalized) || normalized;
  for (let i = cursor.value; i < queue.length; i += 1) {
    const entry = queue[i];
    if (entry.section.toLowerCase() === normalized.toLowerCase() || entry.base.toLowerCase() === base.toLowerCase()) {
      cursor.value = i + 1;
      return entry;
    }
  }
  return null;
}


function removeLyricsFromForcedInstrumentalSections(lyrics: string, params: GenerateSongParams): string {
  const out: string[] = [];
  let currentForced = false;
  const instrumentalQueue = buildCustomInstrumentalCueQueue(params);
  const instrumentalCursor = { value: 0 };

  String(lyrics || '').split('\n').forEach((line) => {
    const parsed = parseBracketOnlyLine(line.trim());
    if (parsed) {
      const composite = parseCompositeLyricTagInside(parsed.inside);
      const section = composite?.section || (isSectionOnlyLyricTagInside(parsed.inside) ? normalizeLyricSectionDisplayName(parsed.inside) : '');
      const compositeParts = composite ? (() => {
        const { label, cues } = splitLyricTagBody(composite.body);
        return [label, ...cues];
      })() : [];
      const tagForcesInstrumental = composite ? hasInstrumentalOnlyLyricCue(compositeParts) : false;
      currentForced = section ? (isForcedInstrumentalLyricSection(section, params) || tagForcesInstrumental) : false;
      if (currentForced) {
        const customCue = findNextCustomInstrumentalCue(section, instrumentalQueue, instrumentalCursor);
        if (composite) {
          out.push(`${buildInstrumentalOnlyTag(section, [...compositeParts, ...(customCue?.cues || [])])}${parsed.rest || ''}`);
        } else {
          out.push(`${buildInstrumentalOnlyTag(section, customCue?.cues || [])}${parsed.rest || ''}`);
        }
        return;
      }
      out.push(line);
      return;
    }

    if (currentForced) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (out.length && out[out.length - 1] !== '') out.push('');
        return;
      }
      const paren = trimmed.match(/^\(([^()]*)\)$/);
      if (paren) {
        const cue = paren[1].trim();
        if (!isHumanVoiceCueText(cue) && isNonVocalStageCue(cue)) {
          out.push(`(${cleanInstrumentalCueText(cue) || cue})`);
        }
      }
      return;
    }

    out.push(line);
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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

      if (isForcedInstrumentalLyricSection(currentSection, params)) {
        normalized.push(`${buildInstrumentalOnlyTag(currentSection, [rawLabel, ...cues])}${parsed.rest}`);
        return;
      }

      if (isInstrumentalLikeSection(currentSection) && isLikelyInstrumentalCueLabel(rawLabel)) {
        const cueBody = cleanupCompositeTagConflicts(cleanEnglishOnlyLyricTagPart([rawLabel, ...cues].filter(Boolean).join(", ")), params);
        normalized.push(`[${currentSection}${cueBody ? `: ${cueBody}` : ""}]${parsed.rest}`);
        return;
      }

      // Instrumental/Solo sections must not carry a vocalist label such as
      // "Lead Vocal" or "Rap Vocal 1". Keep the musical cue only so Suno does
      // not try to sing over instrumental passages.
      if (/^(?:Instrumental|Instrumental Opening|Solo|Drop)$/i.test(currentSection) && (isAcousticVoiceLabel(rawLabel) || isSharedVocalLabel(rawLabel))) {
        const cueBody = cleanupCompositeTagConflicts(cleanEnglishOnlyLyricTagPart(cues.join(", ")), params);
        normalized.push(`[${currentSection}${cueBody ? `: ${cueBody}` : ""}]${parsed.rest}`);
        return;
      }

      let acousticLabel = hasSituation(params.situation)
        ? acousticLabelFromMemberToken(rawLabel, params) || findSituationAcousticLabelFromTag(rawLabel, params) || cleanEnglishOnlyLyricTagPart(rawLabel)
        : cleanEnglishOnlyLyricTagPart(rawLabel);

      if (!isAcousticVoiceLabel(acousticLabel) && !isSharedVocalLabel(acousticLabel)) {
        acousticLabel = fallbackSingleAcousticVoice(params, /female|ghost|air/i.test(String(rawLabel)) ? 1 : 0);
      }

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
      if (isForcedInstrumentalLyricSection(currentSection, params)) {
        normalized.push(`${buildInstrumentalOnlyTag(currentSection)}${parsed.rest}`);
      } else {
        normalized.push(`[${currentSection}]${parsed.rest}`);
      }
      return;
    }

    const rawLabel = parsed.inside.split(/[:：]/)[0] || parsed.inside;
    const bareLabelCandidate = hasSituation(params.situation)
      ? acousticLabelFromMemberToken(rawLabel, params) || findSituationAcousticLabelFromTag(rawLabel, params) || cleanEnglishOnlyLyricTagPart(rawLabel)
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

  const joined = applySequentialSectionSuffixes(removeRedundantSectionOnlyBeforeComposite(normalized)).join("\n");
  return removeLyricsFromForcedInstrumentalSections(joined, params)
    .replace(/\[(Instrumental(?:\s+Opening)?|Solo|Drop|Breakdown):\s*Instrumental\s*,\s*/gi, '[$1: ')
    .replace(/\[(Instrumental(?:\s+Opening)?|Solo|Drop|Breakdown):\s*Instrumental\s*\]/gi, '[$1]');
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

function isShortVocalGestureCue(cue: string): boolean {
  const text = String(cue || "").trim().toLowerCase();
  if (!text) return false;
  return /^(?:soft\s+|deep\s+|short\s+|quiet\s+|small\s+|light\s+|breathy\s+)?(?:sigh|breath|inhale|exhale|laugh|soft laugh|chuckle|whisper|humming|hum|sob|cry|gasp|ah|oh|mm|hmm)$/.test(text);
}

function isNonVocalStageCue(cue: string): boolean {
  const text = String(cue || "").trim().toLowerCase();
  if (!text || isShortVocalGestureCue(text)) return false;
  return /\b(?:instrumental|intro|solo|break|breakdown|drop|ambience|ambient|noise|hiss|hum|hums|drone|tone|tones|metal|collision|hit|wind|rain|wave|waves|sea|ocean|street|car|horn|footstep|footsteps|clock|ticking|tape|vinyl|crackle|reverb|echo|fade|fading|silence|synth|pad|pads|bass|drum|drums|guitar|piano|ep|fx|sfx|sound|texture|pulse|stabs|riff)\b/.test(text);
}

function appendCueToBracketTagLine(line: string, cue: string): string {
  const parsed = parseBracketOnlyLine(line);
  if (!parsed) return line;
  const cleanCue = cleanEnglishOnlyLyricTagPart(cue)
    .replace(/\b(?:sound|sounds)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleanCue) return line;

  const inside = parsed.inside.trim();
  const lowerInside = inside.toLowerCase();
  if (lowerInside.includes(cleanCue.toLowerCase())) return line;

  const composite = parseCompositeLyricTagInside(inside);
  if (composite) {
    const existing = composite.body.split(/[,，]/).map((part) => part.trim().toLowerCase());
    if (existing.includes(cleanCue.toLowerCase())) return line;
    return `[${composite.section}: ${composite.body}, ${cleanCue}]${parsed.rest || ""}`;
  }

  if (isSectionOnlyLyricTagInside(inside)) {
    return `[${normalizeLyricSectionDisplayName(inside)}: ${cleanCue}]${parsed.rest || ""}`;
  }

  return line;
}

function moveNonVocalParentheticalCuesIntoSectionTags(lyrics: string): string {
  const lines = String(lyrics || "").split("\n");
  const out: string[] = [];
  let lastSectionTagIndex = -1;

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();
    const parsed = parseBracketOnlyLine(trimmed);
    if (parsed) {
      const composite = parseCompositeLyricTagInside(parsed.inside);
      if (composite || isSectionOnlyLyricTagInside(parsed.inside)) {
        lastSectionTagIndex = out.length;
      }
      out.push(line);
      continue;
    }

    const paren = trimmed.match(/^\(([^()]*)\)$/);
    if (paren) {
      const cue = paren[1].trim();
      const prev = lastSectionTagIndex >= 0 ? out[lastSectionTagIndex] || "" : "";
      const prevLower = prev.toLowerCase();

      if (/^instrumental\s+intro$/i.test(cue) && /\[intro[^\]]*(?:instrumental|opening)/i.test(prev)) {
        continue;
      }
      if (/^instrumental\s+solo$/i.test(cue) && /\[(?:instrumental|solo)[^\]]*/i.test(prev)) {
        continue;
      }
      if (/^instrumental\s+break$/i.test(cue) && /\[(?:breakdown|break|instrumental)[^\]]*/i.test(prev)) {
        continue;
      }

      if (isNonVocalStageCue(cue) && lastSectionTagIndex >= 0 && /^\[/.test(prev.trim())) {
        out[lastSectionTagIndex] = appendCueToBracketTagLine(out[lastSectionTagIndex], cue);
        continue;
      }

      // Keep only short vocal gestures in parentheses. Longer sound descriptions are safer as section tags.
      if (!isShortVocalGestureCue(cue) && isNonVocalStageCue(cue)) {
        continue;
      }
    }

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function removeGenericSoloVocalLabelsFromLyricTags(lyrics: string, params: GenerateSongParams): string {
  const info = getVocalModeInfo(params.vocal);
  if (!info.isSolo) return lyrics;

  return String(lyrics || "").split("\n").map((line) => {
    const parsed = parseBracketOnlyLine(line);
    if (!parsed) return line;
    const composite = parseCompositeLyricTagInside(parsed.inside);
    if (!composite) return line;

    const { label, cues } = splitLyricTagBody(composite.body);
    const normalizedLabel = cleanEnglishOnlyLyricTagPart(label);
    const sectionName = normalizeLyricSectionDisplayName(composite.section);
    const isRapSection = /rap/i.test(sectionName);
    const isGenericSoloLabel = /^(?:main|lead|sub)?\s*(?:male|female)?\s*vocal$/i.test(normalizedLabel)
      || /^(?:main|lead|sub)\s+vocal$/i.test(normalizedLabel)
      || /^(?:airy|whisper|harmony|bridge)\s*(?:male|female)?\s*vocal$/i.test(normalizedLabel)
      || /^(?:male|female)\s+(?:main|lead|sub|airy|whisper|harmony)\s+vocal$/i.test(normalizedLabel)
      || (/\bvocal$/i.test(normalizedLabel) && !/rap/i.test(normalizedLabel));
    const shouldKeepRapLabel = isRapSection && /rap/i.test(normalizedLabel);
    if (!isGenericSoloLabel || shouldKeepRapLabel) return line;

    const cleanCues = cues.map((cue) => cleanEnglishOnlyLyricTagPart(cue)).filter(Boolean).slice(0, 2);
    return `[${sectionName}${cleanCues.length ? `: ${cleanCues.join(", ")}` : ""}]${parsed.rest || ""}`;
  }).join("\n");
}


function isLyricSectionTagLine(line: string): boolean {
  return /^\s*\[[^\]\n]+\]\s*$/.test(String(line || ""));
}

function splitSectionTagAndInlineLyric(line: string): string[] {
  const source = String(line || "").trimEnd();
  const match = source.match(/^(\s*\[[^\]\n]+\])\s+(.+)$/);
  if (!match) return [line];
  return [match[1].trim(), match[2].trim()];
}

function splitLongKoreanLyricLine(line: string): string[] {
  const source = String(line || "").trim();
  if (!source) return [line];
  if (isLyricSectionTagLine(source)) return [source];
  if (/^\([^)]+\)$/.test(source)) return [source];
  if (!/[가-힣]/.test(source)) return [source];

  const normalized = source.replace(/\s+/g, " ").trim();
  if (normalized.length <= 24) return [normalized];

  const particles = /(은|는|이|가|을|를|에|에서|으로|로|처럼|마다|까지|부터|조차|마저|라도|만|도|과|와|랑|하고|속에|끝에|위에)$/;
  const endings = /(다|요|죠|네|나|까|게|래|지|어|아|해|돼|봐|줘|걸|뿐|듯|며|고|서|면|니|까)$/;
  const words = normalized.split(" ").filter(Boolean);
  const lines: string[] = [];
  let buffer = "";

  const flush = () => {
    const clean = buffer.trim();
    if (clean) lines.push(clean);
    buffer = "";
  };

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const candidate = buffer ? `${buffer} ${word}` : word;
    const compactLen = candidate.replace(/\s+/g, "").length;
    const next = words[i + 1] || "";
    const naturalStop = compactLen >= 12 && (
      endings.test(word) ||
      particles.test(word) ||
      /[,.!?…]$/.test(word) ||
      (/^[가-힣]+$/.test(word) && /^[가-힣]+$/.test(next) && compactLen >= 16)
    );

    buffer = candidate;

    if (compactLen >= 18 || naturalStop) {
      flush();
    }
  }
  flush();

  if (lines.length <= 1 && normalized.length > 28) {
    const chunks: string[] = [];
    let rest = normalized;
    while (rest.length > 24) {
      const cut = Math.max(rest.lastIndexOf(" ", 22), 14);
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
    return chunks.filter(Boolean);
  }

  return lines.length ? lines : [normalized];
}

function normalizeGeneratedLyricLineBreaks(text: string): string {
  const source = String(text || "").replace(/\r\n?/g, "\n");
  const expanded: string[] = [];

  source.split("\n").forEach((rawLine) => {
    splitSectionTagAndInlineLyric(rawLine).forEach((line) => {
      const trimmed = String(line || "").trim();
      if (!trimmed) {
        if (expanded.length && expanded[expanded.length - 1] !== "") expanded.push("");
        return;
      }
      if (isLyricSectionTagLine(trimmed)) {
        if (expanded.length && expanded[expanded.length - 1] !== "") expanded.push("");
        expanded.push(trimmed);
        return;
      }
      splitLongKoreanLyricLine(trimmed).forEach((splitLine) => expanded.push(splitLine));
    });
  });

  return expanded
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\[[^\]\n]+\])\n(?=\[[^\]\n]+\])/g, "$1\n\n")
    .trim();
}

function vocalTransitionKeyFromLyricTagLine(line: string, params: GenerateSongParams): { section: string; key: string | null; isInstrumental: boolean } | null {
  const parsed = parseBracketOnlyLine(String(line || '').trim());
  if (!parsed) return null;
  if (/^\s*\[(?:Break|Stop)\]\s*$/i.test(String(line || '').trim())) {
    return { section: '', key: null, isInstrumental: true };
  }
  const composite = parseCompositeLyricTagInside(parsed.inside);
  const section = composite?.section || (isSectionOnlyLyricTagInside(parsed.inside) ? normalizeLyricSectionDisplayName(parsed.inside) : '');
  if (!section) return null;
  const isInstrumental = isForcedInstrumentalLyricSection(section, params) || isInstrumentalLikeSection(section);
  if (isInstrumental) return { section, key: null, isInstrumental: true };
  if (!composite) return { section, key: null, isInstrumental: false };

  const { label } = splitLyricTagBody(composite.body);
  const clean = cleanupPromptTail(cleanEnglishOnlyLyricTagPart(String(label || '').replace(/^ONLY\s+/i, '')));
  if (!clean || isSharedVocalLabel(clean) || /\+|All\s+Vocals|Together/i.test(clean)) return { section, key: null, isInstrumental: false };
  if (isAcousticVoiceLabel(clean) || /\b(?:Low|Wet|Creaky|Bright|Playful|Deep|Airy|Hollow|Clear|Male|Female)\b.*\b(?:Rap Vocal|Vocal)\b/i.test(clean)) {
    return { section, key: clean.toLowerCase(), isInstrumental: false };
  }
  return { section, key: null, isInstrumental: false };
}

type CustomSingleVocalPlacementEntry = { section: string; base: string; label: string; cue: string };

function buildCustomSingleVocalPlacementQueue(params: GenerateSongParams): CustomSingleVocalPlacementEntry[] {
  const entries: CustomSingleVocalPlacementEntry[] = [];
  if (params.songStructure !== 'custom') return entries;
  (params.customStructure || []).forEach((item) => {
    const section = normalizeLyricSectionDisplayName(String(item.section || '').trim());
    if (!section || /^(?:Break|Stop)$/i.test(section)) return;
    const tags = item.tags || [];
    const isInstrumentalSection = /^(?:Instrumental|Solo)$/i.test(section) || tags.some((tag) => isCustomInstrumentalTag(tag));
    if (isInstrumentalSection) return;
    const singles = tags
      .map(parseVocalPlacementStructureTag)
      .filter((tag): tag is { type: 'single' | 'all'; label: string; cue: string } => Boolean(tag) && tag.type === 'single');
    const hasAll = tags
      .map(parseVocalPlacementStructureTag)
      .some((tag) => Boolean(tag) && tag.type === 'all') || tags.some((tag) => /^(?:Group|All Vocals|Together|전체보컬)$/i.test(String(tag || '').trim()));
    if (hasAll || singles.length !== 1) return;
    const single = singles[0];
    entries.push({
      section,
      base: baseLyricSectionName(section) || section,
      label: cleanupPromptTail(single.label || ''),
      cue: cleanupPromptTail(single.cue || ''),
    });
  });
  return entries;
}

function findNextCustomSingleVocalPlacement(
  section: string,
  queue: CustomSingleVocalPlacementEntry[],
  cursor: { value: number },
): CustomSingleVocalPlacementEntry | null {
  const normalized = normalizeLyricSectionDisplayName(section || '');
  const base = baseLyricSectionName(normalized) || normalized;
  for (let i = cursor.value; i < queue.length; i += 1) {
    const entry = queue[i];
    if (
      entry.section.toLowerCase() === normalized.toLowerCase() ||
      entry.base.toLowerCase() === base.toLowerCase()
    ) {
      cursor.value = i + 1;
      return entry;
    }
  }
  return null;
}

function forceOnlyLabelInLyricTagLine(line: string, entry: CustomSingleVocalPlacementEntry | null, params: GenerateSongParams): string {
  if (!entry?.label) return line;
  const parsed = parseBracketOnlyLine(String(line || '').trim());
  if (!parsed) return line;
  const composite = parseCompositeLyricTagInside(parsed.inside);
  if (!composite?.section) return line;

  const label = cleanupPromptTail(entry.label);
  const cue = cleanupPromptTail(entry.cue || '');
  let body = cleanupPromptTail(composite.body || '');

  const vocalLabelPattern = /^(?:ONLY\s+)?(?:(?:Low|Wet|Creaky|Bright|Whisper|Playful|Stubborn|Deep|Airy|Hollow|Clear|Heavy|Sharp|Melodic|Dry)\s+)?(?:Male\s+|Female\s+)?(?:Rap\s+)?(?:Vocal|Vocals)|(?:Low|Wet|Creaky|Bright|Whisper|Playful|Stubborn|Deep|Airy|Hollow|Clear|Heavy|Sharp|Melodic|Dry)\s+Rap\s+Vocal|All\s+Vocals|Together/i;
  body = cleanupCompositeTagConflicts(body
    .replace(vocalLabelPattern, '')
    .replace(/\bONLY\s+(?:Male|Female)(?:\s+Main\s+Vocal)?\b/gi, '')
    .replace(/\b(?:Male|Female)\s+Main\s+Vocal\b/gi, '')
    .replace(/\bInstrumental\s+break\b/gi, '')
    .replace(/^\s*,\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim(), params);

  const parts = [`ONLY ${label}`];
  if (cue) parts.push(cue);
  if (body && !parts.some((part) => part.toLowerCase() === body.toLowerCase())) parts.push(body);
  const uniqueParts = parts.filter((part, index, arr) => part && arr.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index);
  return `[${composite.section}: ${uniqueParts.join(', ')}]`;
}

function shouldInsertAutoVocalBreakBetweenSections(previousSection: string | null, currentSection: string): boolean {
  if (!previousSection || !currentSection) return false;
  const prev = normalizeLyricSectionDisplayName(previousSection);
  const current = normalizeLyricSectionDisplayName(currentSection);
  const prevBase = baseLyricSectionName(prev) || prev;
  const currentBase = baseLyricSectionName(current) || current;

  // Do not break every Verse -> Pre-Chorus handoff; it makes the song feel chopped.
  if (/^Pre[-\s]?Chorus$/i.test(currentBase)) return false;
  if (/^Chorus$/i.test(currentBase)) return false;
  if (/^Final\s+Chorus$/i.test(currentBase)) return false;

  // Use automatic Break only at bigger handoffs where a new solo character needs a clear reset.
  if (/^(?:Hook|Bridge|Breakdown|Rap\s+Section)$/i.test(currentBase)) return true;
  if (/^Verse$/i.test(currentBase) && /(?:Verse\s*B|Verse\s*2|Verse\s+2)/i.test(current)) return true;
  if (/^(?:Chorus|Hook)$/i.test(prevBase) && /^Verse$/i.test(currentBase)) return true;
  return false;
}



function removeLyricsFromTransitionSections(lyrics: string): string {
  const lines = String(lyrics || '').split('\n');
  const out: string[] = [];
  let skippingTransitionBody = false;

  lines.forEach((line) => {
    const trimmed = String(line || '').trim();
    if (/^\[(?:Break|Stop)\]$/i.test(trimmed)) {
      if (out.length && out[out.length - 1].trim()) out.push('');
      out.push(trimmed);
      skippingTransitionBody = true;
      return;
    }
    if (/^\[[^\]\n]+\]$/.test(trimmed)) {
      skippingTransitionBody = false;
      out.push(line);
      return;
    }
    if (skippingTransitionBody) {
      if (!trimmed) return;
      return;
    }
    out.push(line);
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function applyCustomStopAndVocalBreaks(lyrics: string, params: GenerateSongParams): string {
  const lines = String(lyrics || '').split('\n');
  const out: string[] = [];
  let previousSingleVocalKey: string | null = null;
  let previousSingleVocalSection: string | null = null;
  let previousWasInstrumental = false;
  const customSingleQueue = buildCustomSingleVocalPlacementQueue(params);
  const customSingleCursor = { value: 0 };

  const alreadyHasTransitionAtEnd = () => /^(?:\[Break\]|\[Stop\])$/i.test((out[out.length - 1] || '').trim());

  lines.forEach((line) => {
    const trimmed = line.trim();
    const info = vocalTransitionKeyFromLyricTagLine(trimmed, params);
    if (info && info.section) {
      const customSingle = findNextCustomSingleVocalPlacement(info.section, customSingleQueue, customSingleCursor);
      const forcedLine = forceOnlyLabelInLyricTagLine(line, customSingle, params);
      const forcedInfo = vocalTransitionKeyFromLyricTagLine(forcedLine.trim(), params) || info;
      const wantsStop = sectionHasCustomStop(info.section, params);
      if (wantsStop && !alreadyHasTransitionAtEnd()) {
        if (out.length && out[out.length - 1].trim()) out.push('');
        out.push('[Stop]');
        out.push('');
      } else if (
        !wantsStop &&
        previousSingleVocalKey &&
        forcedInfo.key &&
        previousSingleVocalKey !== forcedInfo.key &&
        !previousWasInstrumental &&
        !alreadyHasTransitionAtEnd() &&
        shouldInsertAutoVocalBreakBetweenSections(previousSingleVocalSection, forcedInfo.section || info.section)
      ) {
        if (out.length && out[out.length - 1].trim()) out.push('');
        out.push('[Break]');
        out.push('');
      }

      out.push(forcedLine);
      previousSingleVocalKey = forcedInfo.key;
      previousSingleVocalSection = forcedInfo.key ? (forcedInfo.section || info.section) : previousSingleVocalSection;
      previousWasInstrumental = forcedInfo.isInstrumental;
      return;
    }

    if (/^\s*\[(?:Break|Stop)\]\s*$/i.test(trimmed)) {
      if (!alreadyHasTransitionAtEnd()) out.push(trimmed);
      previousSingleVocalKey = null;
      previousWasInstrumental = true;
      return;
    }

    out.push(line);
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}


function sanitizeCustomLyricTagNoiseFinal(lyrics: string): string {
  return String(lyrics || '')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!/^\[[^\]\n]+\]/.test(trimmed)) return line;
      return line
        .replace(/,\s*(?:ONLY\s+)?(?:Male|Female)(?:\s+Main\s+Vocal)?\s*(?=,|\])/gi, '')
        .replace(/,\s*(?:Instrumental\s+break|vocal\s+break)\s*(?=,|\])/gi, '')
        .replace(/,\s*,/g, ',')
        .replace(/,\s*\]/g, ']')
        .replace(/:\s*,\s*/g, ': ')
        .replace(/\s{2,}/g, ' ')
        .trimEnd();
    })
    .join('\n');
}


function addCueToBracketTagLine(line: string, cueParts: string[]): string {
  const match = String(line || '').match(/^\s*\[([^\]:]+)(?::\s*([^\]]*))?\]\s*$/);
  if (!match) return line;
  const section = cleanupPromptTail(match[1]);
  const existing = String(match[2] || '')
    .split(',')
    .map((part) => cleanupPromptTail(part))
    .filter(Boolean)
    .filter((part) => !/^(instrumental|break)$/i.test(part));
  const next: string[] = [];
  const add = (value: string) => {
    const clean = cleanupPromptTail(value);
    if (!clean) return;
    const lower = clean.toLowerCase();
    const isDuplicate = next.some((item) => {
      const existing = item.toLowerCase();
      if (existing === lower) return true;
      if (existing.includes(lower) || lower.includes(existing)) return true;
      if (/obsessive\s+tension/.test(lower) && /cute[-\s]?to[-\s]?obsessive\s+tension/.test(existing)) return true;
      if (/obsessive\s+tension/.test(existing) && /cute[-\s]?to[-\s]?obsessive\s+tension/.test(lower)) return true;
      if (/spatial\s+echoes/.test(existing) && /reverb|echo|ambience|ambient|space/.test(lower)) return true;
      if (/spatial\s+echoes/.test(lower) && /reverb|echo|ambience|ambient|space/.test(existing)) return true;
      return false;
    });
    if (!isDuplicate) next.push(clean);
  };
  existing.filter((part) => /^ONLY\s+|All Vocals|Vocal|Rap/i.test(part)).slice(0, 1).forEach(add);
  cueParts.forEach(add);
  existing.filter((part) => !/^ONLY\s+|All Vocals|Vocal|Rap/i.test(part)).forEach(add);
  return `[${section}${next.length ? `: ${next.slice(0, 3).join(', ')}` : ''}]`;
}


function lyricEmotionCueForBareSection(section: string, params: GenerateSongParams): string[] {
  const name = normalizeLyricSectionDisplayName(section || "");
  if (!name || /^(?:Break|Stop|Instrumental|Solo|Intro|Outro)$/i.test(name)) return [];
  const themeText = selectedThemeText(params);
  const moodText = selectedMoodText(params);
  const transitionCue = compactMoodTransitionCue(params);
  const isFlutter = /flutter|excitement|설렘|thrill|두근|떨림/.test(themeText);
  const isDarkPlayful = /playful|comic|cute|dark|tense|장난|귀여|어두|긴장/.test(`${moodText} ${transitionCue}`);

  if (/^Verse/i.test(name)) return [isFlutter ? "small panic" : isDarkPlayful ? "nervous restraint" : "intimate detail"];
  if (/Pre[-\s]?Chorus/i.test(name)) return [isFlutter ? "rising tension" : "emotional build"];
  if (/Chorus|Hook|Drop/i.test(name) && !/^Final/i.test(name)) return [isFlutter ? "unstable hook" : "emotional hook"];
  if (/^Bridge/i.test(name)) return transitionCue ? [transitionCue] : ["emotional turn"];
  if (/^Final\s+(?:Chorus|Hook)/i.test(name)) return [transitionCue ? "out-of-control release" : "final release"];
  return [];
}

function collapseDuplicateStopTags(lyrics: string): string {
  const lines = String(lyrics || '').split('\n');
  const out: string[] = [];
  const isStop = (line: string) => /^\s*\[\s*Stop(?:\s*:\s*[^\]]*)?\s*\]\s*$/i.test(line.trim());
  const lastNonEmpty = () => {
    for (let i = out.length - 1; i >= 0; i -= 1) {
      if (out[i].trim()) return out[i].trim();
    }
    return '';
  };

  lines.forEach((line) => {
    if (isStop(line) && isStop(lastNonEmpty())) return;
    out.push(line);
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function removeEmptyBridgeBeforeMoodShift(lyrics: string): string {
  const lines = String(lyrics || '').split('\n');
  const out: string[] = [];
  const isTag = (line: string) => /^\s*\[[^\]]+\]\s*$/.test(line.trim());
  const isBridge = (line: string) => /^\s*\[\s*Bridge\b/i.test(line.trim());
  const isStop = (line: string) => /^\s*\[\s*Stop(?:\s*:\s*[^\]]*)?\s*\]\s*$/i.test(line.trim());
  const isMoodShiftBridge = (line: string) => isBridge(line) && /mood\s*shift/i.test(line);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isBridge(line) || isMoodShiftBridge(line)) {
      out.push(line);
      continue;
    }

    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j += 1;
    if (j < lines.length && isTag(lines[j]) && (isStop(lines[j]) || isMoodShiftBridge(lines[j]))) {
      // Drop an empty Bridge A/B marker created right before the real transition.
      continue;
    }

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function ensureEmotionCuesForBareLyricSections(lyrics: string, params: GenerateSongParams): string {
  if (!lyrics.trim()) return lyrics;
  const lines = String(lyrics || '').split('\n');
  const isBareSungSection = (inside: string) => {
    const clean = normalizeLyricSectionDisplayName(inside || '');
    if (!clean || !isSectionOnlyLyricTagInside(clean)) return false;
    return !/^(?:Break|Stop|Instrumental|Instrumental Opening|Solo|Intro|Outro)$/i.test(clean);
  };
  let changed = false;
  const next = lines.map((line) => {
    const parsed = parseBracketOnlyLine(line);
    if (!parsed) return line;
    if (parsed.inside.includes(':')) return line;
    if (!isBareSungSection(parsed.inside)) return line;
    const cues = lyricEmotionCueForBareSection(parsed.inside, params);
    if (!cues.length) return line;
    changed = true;
    return addCueToBracketTagLine(line, cues);
  });
  return changed ? next.join('\n').replace(/\n{3,}/g, '\n\n').trim() : lyrics;
}


function moodShiftSectionSpaceCue(params: GenerateSongParams): string {
  const cue = compactSpaceAndTransitionCue(params);
  if (/space|spatial|ambient|reverb|echo|room|intimate|우주|공간/i.test(cue)) return cue;
  const text = [
    selectedStyleText(params),
    selectedSoundText(params),
    selectedMoodText(params),
    params.userInput || '',
  ].join(' ').toLowerCase();
  if (/space|cosmic|astronaut|earth|ambient|reverb|echo|우주|지구|공간|앰비언트|잔향/.test(text)) return 'spatial echoes';
  return '';
}

function ensureMoodShiftBridgeInLyrics(lyrics: string, params: GenerateSongParams): string {
  const cue = compactMoodTransitionCue(params);
  if (!cue || !lyrics.trim()) return lyrics;
  const lines = String(lyrics || '').split('\n');
  if (lines.some((line) => /^\s*\[[^\]]*\bmood\s*shift\b/i.test(line))) return lyrics;

  const isTag = (line: string) => /^\s*\[[^\]]+\]\s*$/.test(line.trim());
  const isStop = (line: string) => /^\s*\[\s*Stop(?:\s*:\s*[^\]]*)?\s*\]\s*$/i.test(line.trim());
  const isBridge = (line: string) => /^\s*\[\s*Bridge\b/i.test(line.trim());
  const isFinal = (line: string) => /^\s*\[\s*(?:Final\s+Chorus|Final\s+Hook)\b/i.test(line.trim());

  const bridgeIndexes = lines.map((line, idx) => (isTag(line) && isBridge(line) ? idx : -1)).filter((idx) => idx >= 0);
  if (!bridgeIndexes.length) return lyrics;

  const finalIndex = lines.findIndex((line) => isTag(line) && isFinal(line));
  let target = -1;
  if (finalIndex >= 0) {
    const beforeFinal = bridgeIndexes.filter((idx) => idx < finalIndex);
    if (beforeFinal.length) target = beforeFinal[beforeFinal.length - 1];
  }
  if (target < 0) {
    const halfway = Math.floor(lines.length * 0.45);
    const later = bridgeIndexes.filter((idx) => idx >= halfway);
    target = later.length ? later[later.length - 1] : bridgeIndexes[bridgeIndexes.length - 1];
  }

  if (target < 0) return lyrics;
  const spaceCue = moodShiftSectionSpaceCue(params);
  lines[target] = addCueToBracketTagLine(lines[target], [cue, spaceCue].filter(Boolean));

  // If the chosen Bridge is not preceded by Stop, insert one directly before it.
  let prevTagIndex = target - 1;
  while (prevTagIndex >= 0 && !isTag(lines[prevTagIndex])) prevTagIndex -= 1;
  if (prevTagIndex < 0 || !isStop(lines[prevTagIndex])) {
    lines.splice(target, 0, '[Stop]', '');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function compactLyricSectionTagDensity(lyrics: string, params: GenerateSongParams): string {
  const isLikelyGroupOrDuo = (() => {
    const info = getVocalModeInfo(params.vocal);
    const text = [params.userInput || '', selectedStyleText(params), selectedThemeText(params)].join(' ');
    return Boolean(info.isMulti || /그룹|혼성|듀엣|duet|group|all\s+vocals|female\s+group|male\s+group/i.test(text));
  })();

  return String(lyrics || '').split('\n').map((line) => {
    const parsed = parseBracketOnlyLine(line);
    if (!parsed) return line;
    if (/^\s*(?:Break|Stop)\s*$/i.test(parsed.inside)) return `[${normalizeLyricSectionDisplayName(parsed.inside)}]`;

    const composite = parseCompositeLyricTagInside(parsed.inside);
    if (!composite) return line;

    const section = normalizeLyricSectionDisplayName(composite.section || '');
    if (!section) return line;

    const rawParts = composite.body
      .split(/[,，]/)
      .map((part) => cleanEnglishOnlyLyricTagPart(part))
      .filter(Boolean);

    if (isInstrumentalLikeSection(section) || isForcedInstrumentalLyricSection(section, params)) {
      const instrumentalParts = stripVocalLabelsFromInstrumentalTagParts(section, rawParts)
        .map((part) => cleanEnglishOnlyLyricTagPart(part))
        .filter(Boolean)
        .slice(0, 2);
      return `[${section}${instrumentalParts.length ? `: ${instrumentalParts.join(', ')}` : ''}]${parsed.rest || ''}`;
    }

    const first = rawParts[0] || '';
    const firstIsRole = isAcousticVoiceLabel(first) || isSharedVocalLabel(first) || /^(?:Male|Female)\s+(?:Lead|Group|Rap)|^(?:Low|Wet|Creaky|Bright|Whisper|Playful|Deep|Airy|Hollow|Clear)\s+(?:Rap\s+)?Vocal/i.test(first);

    if (firstIsRole) {
      let role = first;
      if (!isLikelyGroupOrDuo && isSharedVocalLabel(role) && !isFinalSharedLyricSection(section)) {
        role = fallbackSingleAcousticVoice(params, 0);
      }
      const cues = dedupeCueAgainstAcousticLabel(
        rawParts.slice(1).map((part) => normalizeSungSectionCuePart(part, section)).filter(Boolean),
        role,
      ).slice(0, 1);
      return `[${section}: ${role}${cues.length ? `, ${cues[0]}` : ''}]${parsed.rest || ''}`;
    }

    const cues = normalizeSungSectionCueParts(rawParts, section).slice(0, 2);
    if (!cues.length) return `[${section}]${parsed.rest || ''}`;
    return `[${section}: ${cues.join(', ')}]${parsed.rest || ''}`;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}



function isTransitionOnlyLyricTag(line: string): boolean {
  return /^\s*\[\s*(?:Stop|Break)(?:\s*:\s*[^\]]*)?\s*\]\s*$/i.test(String(line || '').trim());
}

function lyricSectionNameFromTagLine(line: string): string {
  const parsed = parseBracketOnlyLine(String(line || '').trim());
  if (!parsed) return '';
  const composite = parseCompositeLyricTagInside(parsed.inside);
  if (composite?.section) return normalizeLyricSectionDisplayName(composite.section);
  if (isSectionOnlyLyricTagInside(parsed.inside)) return normalizeLyricSectionDisplayName(parsed.inside);
  return '';
}

function collectLastChorusLikeBody(lines: string[]): string[] {
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const section = lyricSectionNameFromTagLine(lines[i]);
    if (/^(?:Chorus|Hook)(?:\s*\/\s*Drop)?$/i.test(section)) {
      start = i;
      break;
    }
  }
  if (start < 0) return [];
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = String(lines[i] || '').trim();
    if (/^\[[^\]]+\]$/.test(trimmed)) break;
    if (trimmed) body.push(trimmed);
    if (body.length >= 6) break;
  }
  return body.filter((line) => !isTransitionOnlyLyricTag(line));
}

function inferLyricCompletionLanguage(lyrics: string, params: GenerateSongParams): 'ko' | 'en' {
  const body = String(lyrics || '')
    .split('\n')
    .filter((line) => !/^\s*\[[^\]]+\]\s*$/.test(line.trim()))
    .join(' ');
  const hangul = (body.match(/[가-힣]/g) || []).length;
  const latin = (body.match(/[A-Za-z]/g) || []).length;
  if (params.lyricLanguages?.includes('ko') && hangul >= Math.max(8, latin * 0.15)) return 'ko';
  return hangul > latin ? 'ko' : 'en';
}

function fallbackBridgeLinesForCompletion(lyrics: string, params: GenerateSongParams): string[] {
  const lang = inferLyricCompletionLanguage(lyrics, params);
  if (lang === 'en') {
    return ['One last feeling stays', 'quietly asking me to turn back'];
  }
  return ['끝내 놓지 못한 마음이', '다시 조용히 나를 불러'];
}

function fallbackFinalLinesForCompletion(lyrics: string, params: GenerateSongParams): string[] {
  const chorus = collectLastChorusLikeBody(String(lyrics || '').split('\n'));
  if (chorus.length >= 2) return chorus.slice(0, 6);
  const lang = inferLyricCompletionLanguage(lyrics, params);
  if (lang === 'en') {
    return ['I carry it one more time', 'through the fading light', 'even if the night is almost gone', 'the last word stays with me'];
  }
  return ['한 번 더 마음을 불러', '사라지는 불빛 사이로', '끝나지 않은 말 하나', '조용히 남겨둘게'];
}

function fallbackOutroLinesForCompletion(lyrics: string, params: GenerateSongParams): string[] {
  const lang = inferLyricCompletionLanguage(lyrics, params);
  if (lang === 'en') return ['Then I let the silence close', '(soft breath)'];
  return ['마지막 숨을 고르고', '오늘을 천천히 닫아'];
}

function ensureLyricsDoNotEndAtTransition(lyrics: string, params: GenerateSongParams): string {
  const source = String(lyrics || '').trim();
  if (!source) return source;
  const lines = source.split('\n');
  const nonEmpty = lines.map((line, index) => ({ line: line.trim(), index })).filter((item) => item.line);
  if (!nonEmpty.length) return source;
  const last = nonEmpty[nonEmpty.length - 1];
  if (!isTransitionOnlyLyricTag(last.line)) return source;

  // A transition tag such as [Stop] is a cut, not an ending. When generation is
  // truncated there, append a compact closure so the song still reaches a final
  // emotional payoff instead of stopping mid-structure.
  const append: string[] = [];
  const hasBridgeAfterLastTransition = nonEmpty.slice(nonEmpty.findIndex((item) => item.index === last.index) + 1)
    .some((item) => /^\[\s*Bridge\b/i.test(item.line));
  if (!hasBridgeAfterLastTransition) {
    append.push('', '[Bridge: emotional turn]', ...fallbackBridgeLinesForCompletion(source, params));
  }
  append.push('', '[Final Chorus: final release]', ...fallbackFinalLinesForCompletion(source, params));
  append.push('', '[Outro]', ...fallbackOutroLinesForCompletion(source, params));

  return `${source}\n${append.join('\n')}`.replace(/\n{3,}/g, '\n\n').trim();
}

function cleanupKoreanLyricPhraseFragments(lyrics: string): string {
  return String(lyrics || '')
    .replace(/엇갈린\s+는\s+꼬여버린\s+채/g, '엇갈린 말들은 꼬여버린 채')
    .replace(/엇갈린\s+는\b/g, '엇갈린 말들은')
    .replace(/말끝이\s+는\b/g, '말끝은')
    .replace(/마음이\s+는\b/g, '마음은')
    .replace(/기억이\s+는\b/g, '기억은')
    .replace(/감정이\s+는\b/g, '감정은')
    .replace(/진심이\s+는\b/g, '진심은')
    .replace(/\bSpanish\b(?=\])/g, 'latin pulse')
    .replace(/\[Verse(\s*[A-Z0-9]*)?:\s*Spanish\]/gi, (_m, suffix = '') => `[Verse${suffix}: latin pulse]`)
    .replace(/\[([^\]]+):\s*Spanish\]/gi, '[$1: latin pulse]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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


  const cleanedLyricText = removeUiModeWordsFromLyrics(
    normalizeCompositeLyricTagsFinal(stabilizedText, params),
  )
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      // Convert naked sound-palette bracket lines like [shimmering pads and bass]
      // into section-safe cues on the next valid section rather than leaving fake sections.
      if (/^\[[^\]]+\]$/.test(trimmed) && !isValidLyricSectionTagLine(trimmed, params) && !isVocalRoleTag(trimmed)) {
        return `(${trimmed.slice(1, -1).trim()})`;
      }
      return line;
    })
    .join('\n')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lyricTextWithTransitions = removeLyricsFromTransitionSections(
    applyCustomStopAndVocalBreaks(
      moveNonVocalParentheticalCuesIntoSectionTags(
        removeGenericSoloVocalLabelsFromLyricTags(cleanedLyricText, params),
      ),
      params,
    ),
  );

  const lyricTextWithMoodShift = collapseDuplicateStopTags(
    removeEmptyBridgeBeforeMoodShift(
      ensureMoodShiftBridgeInLyrics(lyricTextWithTransitions, params),
    ),
  );
  const lyricTextWithEmotionCues = ensureEmotionCuesForBareLyricSections(lyricTextWithMoodShift, params);

  const compactedLyricText = sanitizeCustomLyricTagNoiseFinal(
    normalizeGeneratedLyricLineBreaks(
      collapseDuplicateStopTags(compactLyricSectionTagDensity(lyricTextWithEmotionCues, params)),
    ),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleanupKoreanLyricPhraseFragments(
    ensureLyricsDoNotEndAtTransition(compactedLyricText, params),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
// SORIDRAW_V49_MIX_RATIO_SAFE_FIX
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
    requestedLyricLanguages.length === 0 ||
    isBackgroundOnlyBgmGenre(params),
  );
  params.isNoLyrics = effectiveNoLyrics;
  if (isBackgroundOnlyBgmGenre(params)) {
    params.includeLyrics = false;
    params.isNoLyrics = true;
    (params as any).instrumentalBgmMode = true;
  }
  params.lyricLanguages = params.isNoLyrics ? [] : requestedLyricLanguages;
  const model: string = GEMINI_TEXT_MODEL_CHAIN[0];

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
  const lyricDensityInstruction = buildLyricDensityInstruction(params);
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
  const selectedSoundAnchorCues = compactSoundPromptsByCategory(params.instrumentSounds ?? []);
  const styleSoundTextureCues = getSelectedStyleSoundTextureCues(params);
  const themePrompt = buildThemePrompt(params.themes ?? []);
  const themeSentence = buildThemeSentence(params.themes ?? []);
  const themeMoodLyricInstruction = buildThemeMoodLyricInstruction(params);
  const vocalPrompt = buildVocalPrompt(
    params.vocal ?? { male: 0, female: 0, rap: false },
    params.subGenre ?? [],
  );
  const basePromptSeed = BASE_PROMPTS.join("\n");

  // Build Detail Layer (Summarized English Prompt)
  const detailLayer = await buildDetailLayer(params.userInput || "");
  const creativeVariation = pickCreativeVariationSeed(params);

  let finalPrompt: string;
  try {
    finalPrompt = buildFinalPrompt(
      params,
      resolvedStructure,
      detailLayer,
      creativeVariation,
    );
  } catch (promptError) {
    console.warn("[SORIDRAW Generation Guard] final prompt build failed, using safe fallback prompt:", promptError);
    const selected = getSelectedFusionGenres(params);
    const safeMain = selected[0]?.label || (params.genre ? (getGenreMeta(params.genre)?.label ?? sentenceCase(params.genre)) : "Pop Fusion");
    const safeEra = getEraTextureGenreAccents(params)[0] || '';
    const safeMood = interpretMoodGenreModifier(params);
    const safeGenre = attachGenreAccents(compactGenreToken(safeMain), [safeEra, safeMood].filter(Boolean));
    const safeInstruments = cleanupPromptTail(dedupeInstrumentSemantic([
      ...getSelectedGenrePromptSoundCues(params),
      ...getEraTextureInstrumentCues(params),
      ...getCompactPointSoundPrompts(params.pointSounds ?? []),
      'balanced drums',
      'bass',
      'melodic core instruments',
    ]).slice(0, 7).join(', '));
    const safeAtmosphere = buildThemeMoodInterpretation(params).atmosphereCue || "balanced emotional scene";
    const safeVocalCue = mergeCompactCue(getSelectedGenreVocalCue(params), getEraTextureVocalCues(params), 2);
    const safeArrangementCue = mergeCompactCue(getSpecificGenreArrangementCue(params) || getGenreArrangementDNA(params), getEraTextureArrangementCues(params), 3);
    finalPrompt = removeAudioQualityLineWhenPromptIsNearLimit([
      `[Genre] ${safeGenre || 'Pop Fusion'}`,
      `[Instruments] ${safeInstruments || 'balanced drums, bass, and melodic core instruments'}`,
      `[Atmosphere] ${normalizeAtmospherePromptLine(safeAtmosphere) || 'balanced emotional scene'}`,
      `[Vocals] ${safeVocalCue ? `natural solo vocal with ${safeVocalCue}` : 'natural solo vocal with story-aware delivery'}`,
      `[Arrangement] ${normalizeArrangementLine([safeArrangementCue, 'focused hook']) || 'clear sectional contrast and focused hook'}`,
      `[Audio quality improved to masterpiece]`,
    ].join("\n"));
  }
  console.log("🔥 generateSong called");
  console.log("🔥 FINAL PROMPT:", finalPrompt);
  const rawStructureText = buildStructureText(
    params.songStructure,
    resolvedStructure,
    params.customStructure ?? [],
    params,
  );
  const moodTransitionCue = compactMoodTransitionCue(params);
  const exactStructureText = rawStructureText.includes("→")
    ? applyMoodShiftToStructureText(rawStructureText, moodTransitionCue)
    : rawStructureText;

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
  const pointSoundSectionInstruction = buildPointSoundSectionInstruction(params);
  const moodTransitionSectionInstruction = buildMoodTransitionSectionInstruction(params, exactStructureText);
  const scenePlanInstruction = buildScenePlanInstruction(params, detailLayer);

  const requestedLanguageInstruction = effectiveNoLyrics
    ? ""
    : `OUTPUT LANGUAGE RULE (MANDATORY):
- Generate titles and lyrics only for the selected language setting: ${requestedLyricLanguages.map((lang) => languageNameMap[lang]).join(" + ")}.
- The title language(s) MUST exactly match the selected lyric language(s).
- ${titleFormatInstruction}
- If Korean is selected, put Korean lyrics in JSON field lyrics.korean and create a natural Korean title.
- The JSON field lyrics.english is the SECONDARY LYRIC SLOT. It must contain the full lyrics for the selected non-Korean language (${languageNameMap[secondaryLanguage]}), even when that language is Japanese, Chinese, Spanish, or French.
- When both Korean and ${languageNameMap[secondaryLanguage]} are selected, BOTH lyrics.korean and lyrics.english must be non-empty full lyric bodies with matching sections.
- If only Korean is selected, leave lyrics.english empty.
- If a language is not selected, do not create a title or lyrics for that language.
- Do not generate unselected lyric languages.
- In Korean-only mode, lyrics.korean must be Korean-only unless MIXED LANGUAGE MODE is explicitly active.
- Environmental SFX and production descriptions must be placed inside the section tag, not as Korean parenthetical lyric lines. Good: [Outro: distant waves fade out]. Bad: (서서히 멀어지는 파도 소리), (빗소리), (바람 소리). Korean parenthetical lines are allowed only when they are actual sung inner thoughts or spoken ad-libs, not production cues.
- Do not start lyrics with a naked sound-palette bracket such as [soft synth, bass]. Every bracket must be a real section tag like [Intro: soft synth], otherwise use parentheses.`;

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
- Treat ${englishMixRatio}% as the intended English share of ACTUAL LYRIC LINES ONLY.
- Do NOT count Suno section headers or section cue text toward the language ratio. Exclude all bracketed section lines such as [Intro], [Verse A: low and intimate], [Chorus / Drop: emotional lift], [Stop], [Break], and [Instrumental: guitar solo].
- Count only sung/spoken lyric body lines. Parenthetical ad-libs like (Stay with me) count because they are lyric content.
- Keep section headers and section tags in English if needed, but they must not be used to satisfy the English ratio.
- For 5%: Korean body lyrics with at most one very short English accent in the whole lyric.
- For 10%: Korean body lyrics with a few short English accents across the whole lyric.
- For 20%: Korean body lyrics with occasional short English hooks/ad-libs in key payoff lines.
- For 30%: Korean body lyrics with regular short English hooks/ad-libs in chorus, hook, rap, bridge, and final sections.
- For 50%: Korean and English body lyric lines should feel clearly balanced. Do not let it collapse back to a 30% style.
- For 70%: English body lyric lines must be dominant. Use English as the main body language and keep Korean only for key emotional hooks and identity lines.
- For 90%: Near-English mode. Write almost every actual lyric body line in English, with Korean only as rare short hook words or one-line emotional anchors. Still place this mixed lyric body in lyrics.korean when Korean is the selected lyric card.
- Do not make 90% more Korean-heavy than 70%. 90% must be the strongest English-led setting.
- For lyrics.korean: write the selected Korean/English mixed lyric body according to the selected ratio, not Korean-only text.
- For lyrics.english: keep English as the main language only when a non-Korean lyric language is selected; otherwise leave lyrics.english empty.
- Keep code-switching natural and melodic, not forced.`
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
- Use this exact section order without omission, replacement, renaming, or extra sections:
${exactStructureText}
- Output lyric sections in this exact order. Do not add numbering such as Rap Section 1, Rap Section 2, Bridge 2, Member 1, or Member 2 unless that exact text exists in the custom structure.
- Every sung custom section must be one composite tag: [Selected Section: Acoustic Voice, short cue]. Bad: [Rap Section 1: Member 1] then [저승사자: male]. Good: [Rap Section: Tired Male Rap, dry authority].
- If a custom section includes an ONLY vocal placement cue such as (ONLY Low Rap Vocal, creaky growl), use that exact vocal label inside the lyric tag: [Verse: ONLY Low Rap Vocal, creaky growl].
- If a section includes All Vocals or two vocal labels joined by +, do NOT use ONLY.
- Break and Stop are standalone transition sections. Output them exactly as [Break] or [Stop], with no colon, no vocals, no parenthetical cues, and no lyric lines.
- Instrumental, Solo, and Drop sections must never include vocal labels such as Lead Vocal, Low Rap Vocal, Wet Rap Vocal, or All Vocals.
- If a custom section is marked Instrumental, its section tag must stay instrumental-only: no vocalist, no humming, no 구음, no ad-libs, no sung lyric lines.
- If the same selected section appears multiple times in the custom order, repeat the exact same section name each time rather than inventing numbers.
- Each tag in parentheses is a real arrangement instruction. Apply it musically, not just as a label.
- Special Sections Guide (if used):
  - Theme A/B: Distinct melodic themes or motifs.
  - Build-up: A section focused on rising tension and energy leading to a main theme or climax.
  - Main Theme: The core melodic or rhythmic identity of the song.
  - Climax: The highest point of energy and emotional intensity.
- Do not collapse this into a generic pop structure.
- If Situation is active, use Situation only as character identity and story context. The user's custom section order, instrumental setting, vocal placement, and rap/instrumental ownership are higher priority and must not be rewritten.
- Rap Section must remain rap delivery. If a Rap Section has a single vocal placement, use [Rap Section: ONLY {label}, rhythmic rap delivery]. Never turn a Rap Section into a sung female vocal unless the user explicitly placed a female rap vocal there.
- Instrumental/solo custom sections must include the exact selected instrument/point-sound cue from the custom structure tag when available, e.g. [Instrumental: Melody Lead Synth]. They must include no vocal, no humming, no chant.
- Do not copy UI-only gender/role tokens like ONLY Male, ONLY Female Main Vocal, Male, Female, or Instrumental break into lyric tags. Use only the resolved acoustic label from [Vocals] plus one short performance cue.
- Do not invent undefined vocal labels such as Bright Rap Vocal unless that exact label was defined in [Vocals] or selected by the user.
- If Situation is active, every lyrical custom section must still follow the Situation roles and relationship.
- Chorus, Hook, Rap Section, Bridge, Verse, Pre-Chorus, Final Chorus, and Outro must not become generic lyrics; keep the scenario and role conflict active.
- Instrumental, Solo, and Drop can be mainly musical, but if they include lyrics or ad-libs, they must stay connected to the same Situation. Break and Stop must remain lyric-free transition tags.`
      : (params.songStructure ?? "1") === "1"
        ? `SONG STRUCTURE (DEFAULT / GENRE REPRESENTATIVE):
- Selected mode: Default. Use this genre-representative structure as the main section order:
${exactStructureText}
- Output lyric sections in this order as closely as possible. Do not replace it with a free Verse A/B/C structure.
- Use [Verse] for the first verse and reuse [Verse] when it returns; do not output [Verse A], [Verse B], or [Verse C] unless the structure explicitly contains those labels or there are multiple different speakers in a Situation.
- If the structure contains [Stop] then a transition Bridge, keep that exact transition event. Do not duplicate Stop.
- Chorus / Drop may be written as [Chorus / Drop] when the structure says so. Otherwise keep the listed section name.
- Instrumental sections may carry short sound cues, but do not turn them into sung lyric sections.
- Break and Stop are standalone transition tags with no lyric lines.
- Keep section tags compact and functional: [Section: short cue]. Do not dump genre, instrument, or mood keyword lists into tags.`
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
- If USER TEXT PRIORITY LOCK is active, variation is secondary only. Do not let it create confession, relationship, object-reveal, micro-conflict, or random story arcs not present in the user's text.
- Same keywords on a later run may choose another angle; do not treat current keywords as a fixed template.
- "Same keywords" includes button selections AND the user's Situation text fields: target A/B, relationship, description, development, speaker style, attitude, and details.
- Even if the exact same Situation sentence is reused, create a sibling version, not a clone: shift the focus, hook owner, flaw, detail, scene angle, or section ownership.
- Keep the same world and genre identity, but change the interpretation angle enough that the prompt describes a similar-but-different song.
- Reflect the chosen variation inside the opening track sentence and [Production], not only in hidden instructions.
- Do NOT append variation wording to [Vocals]. [Vocals] must contain only natural singer direction and role persona.
- When Situation text is long, vague, or repeated, compress it into a fresh dramatic angle rather than copying the user's wording. Same Situation can become ghost regret focus, reaper fatigue focus, negotiation focus, object/detail focus, role reversal, or unresolved comedy depending on this generation.

${buildRecentStoryMemoryInstruction(params)}

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
- Keep the final production prompt dense rather than over-compressed: aim for about 650-750 characters when many selections are active, excluding the fixed audio-quality line. Remove duplicate wording first; do not cut off genre identity, story scene, production movement, tempo, hook behavior, or vocal roles.
- Good [Vocals] style for Situation: 2-character vocal split: Employee with bright female vocal, sarcastic but slightly hurt delivery. Boss with dry male vocal, nagging pressure. Keep each character separated. Good group style: 4 female vocal split: Main Vocal (...), Lead Vocal (...), Low Rap Vocal (...), Whisper Vocal (...). Bad style: Female group vocals, pop, sad.
- For group lyric tags, NEVER use mechanical labels like [Member 1], [Member 2], Rap Vocal 1, or Rap Vocal 2 when character labels exist. Use descriptive role-based tags from [Vocals], such as [Low Rap Vocal: husky off-beat], [Wet Rap Vocal: glissando], [Airy Vocal: fragile], [Whisper Rap Vocal: breathy].
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
- If Gemini starts a sung block with a bare acoustic tag such as [Tired Male Rap: ...] or [Airy Female Vocal: ...], rewrite it into the nearest musical section: [Verse A: ...], [Verse B: ...], [Rap Section: ...], [Bridge: ...], or [Outro: ...].
- Never put Korean story role labels inside brackets. Story roles may appear in lyric lines, but bracket tags must stay English acoustic/section tags only.
- Final production prompt must be English-only. Do not mix Korean words into the music prompt, even if the UI input is Korean. Translate role names, mood, story, and development nuance into concise English. Lyrics may stay Korean, but the production prompt must not.
- Final production prompt format is locked to this 5-line structure plus the fixed quality line:
  [Genre] {short natural genre identity: core genre + 1–2 strongest identity keywords/groove/era/texture, not a raw comma list}
  [Instruments] {Gemini-composed instrument, texture, and playing-style cues from genre + mood + theme/situation + selected core sound}
  [Atmosphere] {scene, air, emotional temperature, and selected spatial texture}
  [Vocals] {sentence-style acoustic vocal direction with emotion, breath, and phrasing; no artist names, but include the referenced vocal traits when the user gave an artist/group reference}
  [Arrangement] {tempo only when selected, genre-specific rhythm/groove, emotional development, section movement, and transition behavior}
  [Audio quality improved to masterpiece]
- Do not collapse this back into [Track] / [Production]. Keep [Genre], [Instruments], [Atmosphere], [Vocals], and [Arrangement] separated.
- Never output any separator-* value. Separator rows are UI-only and must be ignored.
- Genre line must be a short natural identity sentence, not a raw keyword dump. Keep the selected core genre clear, then add only the main groove/era/texture that explains how the genre should move. Do not use filler wording like influence/core/fused/based/rooted unless it is part of a meaningful genre identity such as Korean gugak-based Pansori fusion.
- Era texture selections such as 2010s Idol Pop, 2010s EDM Pop, 90s R&B Warmth, 2000s Y2K Pop, 80s Retro Synth, and 2020s Hyperpop are secondary production colors only. They must not replace the main genre, must not force idol/EDM as the main style, and must not expand into group/idol-vocal instructions unless the vocal menu explicitly selected that.
- Mood/theme words should not be dumped into [Genre] as a list. However, the 1–2 strongest identity keywords that define the song's first impression may be integrated into [Genre] as natural genre adjectives; put all detailed emotion/story words in [Atmosphere] or [Arrangement].
- Groove/rhythm/pulse/hook/transition terms belong in [Arrangement], not [Instruments].
- If multiple hook or chorus style keywords are selected, merge them into one natural phrase such as minimalist phrase-led hook or catchy singalong chorus; do not repeat hook/chorus words.
- Arrangement must not be a generic function-word list. Avoid bare phrases like stable structure, warm structure, harmonic support, smooth, effortless, clear sectional contrast unless they are tied to a concrete genre movement. Write how the song moves: e.g. slow janggu pulse with weighted vocal pauses, danceable Nu-Disco groove with soft chorus lift, warm live-band groove with brass lifts.
- Preserve vocal emotion and spatial texture: [Vocals] must include emotional delivery, not only technique; [Atmosphere] must include selected space/ambience cues when present.
- If the vocal UI mode is solo or exactly one vocalist is selected, [Vocals] must stay a single solo vocalist. Band, K-band, Buzz-inspired, rock band, and band-ballad references may affect instruments/arrangement, but must NOT create group/duo/split/main-rap-harmony vocal roles.
- LYRIC LINE BREAK RULE (MANDATORY): section tags must be standalone lines, then lyrics must start on the next line. Do not output paragraph-style lyric blocks. Split every long Korean line into short singable phrase lines so rhythm is visible.
- LYRIC COMPLETION RULE (MANDATORY): Never end the lyric at [Stop], [Break], [Drop], or [Build-up]. A transition cut must be followed by a compact payoff such as [Bridge], [Final Chorus] or [Final Hook], and [Outro]. If the front half becomes dense, shorten earlier lines rather than dropping the final payoff.

${buildUserPrimaryStoryLockInstruction(params)}

${TECHNICAL_DIRECTION_LYRICS_GUARD}

IMPORTANT:
- Do not use real artist names by default. Exception: if the user explicitly wrote an artist/group reference in direct input, preserve it only in [Genre] as “-style” or “-inspired” and also translate it into musical traits; do not place artist names in [Vocals] or lyrics.
- Do NOT simplify, generalize, or replace the selected arrangement with a default pop form.
- Treat the final production prompt below as a locked music-production blueprint, not a loose reference. For lyric story content, direct input, active Situation, and selected Theme remain higher priority than generic prompt summaries. Selected Mood is an expression-color layer only, not a story source.
- Resolve conflicts by priority: custom song structure if selected, then USER FREE-TEXT DIRECTOR NOTE, then explicit UI selections, while keeping one coherent song concept.
- Keep the final result musically coherent as one song concept, not a loose list of tags.

ROOT GENRE:
${genrePromptCore || (detailLayer ? "Infer the root genre from the USER FREE-TEXT DIRECTOR NOTE." : "Choose an appropriate mainstream-friendly root genre if none is given.")}

INSTRUMENT / SOUND LAYERS:
${instrumentSoundPromptCores.length ? instrumentSoundPromptCores.map((s) => `- ${s}`).join("\n") : "- No extra instrument/sound layer selected."}

USER-SELECTED SOUND ANCHORS (LOCKED IF PRESENT):
${selectedSoundAnchorCues.length ? selectedSoundAnchorCues.map((s) => `- ${s}`).join("\n") : "- No user-selected sound anchor."}

STYLE SOUND / SPACE TEXTURE LAYERS:
${styleSoundTextureCues.length ? styleSoundTextureCues.map((s) => `- ${s}`).join("\n") : "- No extra style sound or space texture selected."}

INSTRUMENTS ASSEMBLY DIRECTION (MANDATORY):
- Let Gemini actively compose the final [Instruments] line from the selected Genre, fusion genre, Mood, Theme, active Situation, and direct user note. Do not treat the locked skeleton's instrument list as the final answer when the mood or scene suggests a better palette.
- Genre decides the core instrument family. Mood decides the playing style, texture, intensity, touch, and space of each instrument. Theme/Situation/direct note adds scene-specific sound details.
- USER-SELECTED SOUND ANCHORS are protected anchors. Keep them exactly or semantically intact in [Instruments]. They do NOT force the whole line to use the old local sound assembly.
- For every non-user-selected instrument, reinterpret or replace the default genre/style instrument through the selected Mood, Theme, Situation, and direct note. If the mood is lonely/dreamy/cold/warm/bright/dark/etc., the non-selected drums, bass, harmony instruments, pads, textures, and space must change their playing feel accordingly.
- If a user-selected sound overlaps with a default genre instrument, keep the user-selected sound cue and remove or replace the duplicated default with a missing complementary role such as drums, bass, harmonic instrument, texture, or space.
- The [Instruments] line should bind instrument + texture + playing method inside the same cue, so the sound is understood as one instruction. Good cue shape: soft DX7-style electric piano chords, brushed slow-jam drums, warm sub bass, airy late-night synth pad.
- Do not separate playing method into [Arrangement] when it belongs to a specific instrument. [Arrangement] is for song movement and section flow; [Instruments] owns the instrument color and how that instrument should be played.
- Also preserve STYLE SOUND / SPACE TEXTURE LAYERS as real instrument/texture cues when they are musically relevant. Do not hide space textures only inside [Atmosphere]; cues like wide reverb, room reflections, rain ambience, stage ambience, or distant ambience belong in [Instruments] when selected.
- It may be more expressive than a plain comma list, but it must still read as instrument/texture cues, not a full mix-description paragraph. Avoid generic mix sentences such as intimate warm natural mix unless they are attached to a concrete sound texture.

MOOD LAYER (INDIRECT EXPRESSION COLOR, NOT LYRIC TOPIC):
${(params.moods ?? []).join(", ") || "No explicit mood layer selected."}
- Use these mood choices to color [Atmosphere], [Arrangement], genre mood color, compressed vocal delivery, and the lyric expression layer: phrasing, metaphor style, sentence temperature, pacing, emotional pressure, and scene texture.
- Do not use mood choices as lyric content sources. They must not invent new lyric objects, events, relationships, places, conflicts, titles, hooks, or repeated lyric phrases. They may only reinterpret the existing Theme/Situation/direct-input content.

VOCAL EXPRESSION STYLE LAYER (VOICE EMOTION / ATTITUDE / PHRASING):
${buildSelectedVocalExpressionInstruction(params)}

${scenePlanInstruction}

${lyricDensityInstruction}

${
  hasSituation(params.situation)
    ? `SITUATION SCENARIO (PRIMARY STRUCTURE):
${buildSituationRenderingContext(params.situation)}

Situation rendering contract:
- Treat the active Situation as the story engine, not as vocal-role metadata.
- [Atmosphere] must be written from the Situation fields first: characters/relationship, visible conflict, setting or description, version tone, and emotional tension. It should sound like the scene itself, not like a generic mood-card summary.
- [Atmosphere] must include at least one concrete Situation anchor outside [Vocals]: a role pair, relationship/conflict, setting/description, version tone, or extra detail cue. Do not settle for generic phrases such as street-corner memory, clear emotional tension, or bittersweet mood if the Situation provides stronger story material.
- [Arrangement] must be written from the Situation development first: dialogue ownership, A/B speech contrast, monologue or call-and-response flow, section progression, and emotional turn. It should not be only a list of genre/sound transitions.
- [Arrangement] must include at least one Situation-development anchor outside [Vocals]: monologue/dialogue ownership, speech contrast, role turn-taking, late emotional turn, satire/comedy version tone, or section ownership cue.
- [Vocals] carries character delivery, but it is not enough for Situation to appear only in [Vocals].
- Selected genre/style/sound/mood keywords may color the music, but they must not replace the Situation scene, relationship, or development.
- If [Atmosphere] or [Arrangement] could fit any unrelated song after removing [Vocals], rewrite it using the Situation fields above before returning JSON.
- Do not invent situation details that are absent from the Situation fields; translate and compress the provided details naturally into English prompt language.`
    : ""
}

${
  (params.themes ?? []).length > 0
    ? `THEME / STORY CONCEPT (FALLBACK WHEN NO SITUATION):
${themePrompt}
Expanded story direction: ${themeSentence}`
    : ""
}

${themeMoodLyricInstruction}

LYRIC SOURCE PRIORITY (MANDATORY):
- For lyric content, prioritize in this order: 1) active Situation, direct theme input, lyric draft, and USER FREE-TEXT DIRECTOR NOTE; 2) selected Theme keywords, exact section structure, and vocal setup; 3) selected Mood as indirect expression color only; 4) the final production prompt's Genre, Vocals, and Arrangement as musical guidance only.
- If a Situation is active, its relationship, conflict, character roles, speech direction, version tone, and development are the main lyric story structure. Direct theme/user notes may add the specific topic. Mood/direct mood may color tone, metaphor, pacing, pressure, and speech style, but must not create or erase the Situation relationship, event, setting, or role logic.
- The final [Atmosphere] line is a production summary. Do not let abstract or generic Atmosphere wording override the user's concrete story, Situation conflict, theme content, chosen section flow, or lyric draft. Use mood alignment as expression color, not as a new plot.
- Keep lyric structure, section tags, density rules, and character speech quality intact. Do not rewrite lyrics merely to match a generic prompt phrase.

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

${moodTransitionSectionInstruction}

${pointSoundSectionInstruction}

${requestedLanguageInstruction}

FINAL PRODUCTION PROMPT OUTPUT RULE (MANDATORY):
- Return productionPrompt as the final 6-line Suno production prompt.
- Never output two production prompts in one response. Do not write a one-line prompt containing multiple labels and then repeat the labels again below.
- GENRE FIRST-IMPRESSION RULE: [Genre] is not just a plain genre name. Keep it concise and genre-like, but include 1–2 core identity keywords from the selected mood/theme/direct input when they define the song’s first impression. Do not turn [Genre] into a long keyword list. Move detailed emotional/story words into [Atmosphere] and movement/flow words into [Arrangement].
- USER ARTIST/GROUP REFERENCE RULE: If the user directly mentions an artist or group in the direct input, preserve that reference in [Genre] as “-style” or “-inspired”, and also translate it into musical traits such as energy, vocal attitude, era, groove, arrangement color, emotional tone, and when relevant vocal technique. Do not remove the artist/group reference when it was explicitly written by the user. Do not rely on the name alone; include trait cues so less globally recognized Korean references still work.
- INSTRUMENTAL BGM NATURAL REINTERPRETATION RULE: ${buildInstrumentalBgmGeminiReinterpretationRule()}
- If the selected genre is Lo-Fi Study, Nature Ambience, Cafe BGM, Healing Piano, Ambient, Minimalism, Piano Solo, String Ensemble, or another dedicated Instrumental BGM/background-only choice, force instrumental-only mode. [Vocals] must be exactly: Instrumental only, no vocals, no humming. Do not add female/male vocal, humming, wordless airy texture, breathy phrasing, sighs, chant, choir, or hook-vocal language.
- For dedicated Instrumental BGM/background-only choices, put the removal cue directly into the final prompt without overloading it: [Instruments] should include no vocal samples and a small number of quiet ambience/texture/instrument cues. Lo-Fi Study and Cafe BGM may use a very sparse muted/brushed rhythm if it supports background flow; Piano/Solo/String/Nature/Ambient BGM should be drumless/no beat. [Arrangement] should include instrumental only, no vocals, no humming, plus the correct BGM flow type.
- For Nature Ambience, prefer environmental ambience and soft pads over musical drums or many instruments. For Lo-Fi Study, prefer tape hiss, room tone, soft keys, and optional very sparse brushed lo-fi drums. For Cafe BGM, allow very sparse brushed rhythm only when useful. For Healing Piano, Piano Solo, and String Ensemble, avoid drums/percussion by default.
- For dedicated Instrumental BGM/background-only choices, [Atmosphere] must describe space, environment, time, room tone, or background air. Do not create a singer/speaker emotional story.
- For dedicated Instrumental BGM/background-only choices, [Arrangement] must describe loopable background flow, ambient swells, soft transitions, and non-distracting texture, not hook release or sung phrasing. Use concise constraints like drumless and percussion-free instead of a long no-kick/no-snare/no-hihat list.
- Use this exact label order and no extra lines:
  [Genre]
  [Instruments]
  [Atmosphere]
  [Vocals]
  [Arrangement]
  [Audio quality improved to masterpiece]
- Build productionPrompt after deciding the lyric concept. It must follow the active Situation, user's direct theme, direct mood, USER FREE-TEXT DIRECTOR NOTE, selected keywords, vocal setup, and section flow.
- Build [Instruments] after deciding the same concept. Recompose the instrument palette so genre + mood + situation/theme feel connected, while preserving any user-selected sound layers and selected style sound/space texture layers.
- Do not copy the local skeleton's [Instruments] line verbatim just because one Sound item is selected. Use the selected Sound item as a protected anchor only. Then reinterpret every other non-selected instrument through the selected mood/theme/situation/direct note, replace duplicated defaults, and add missing companion roles so the final line feels Gemini-composed from genre + mood.
- Directly selected sounds must survive; non-selected default instruments should adapt their playing method and texture to the mood. Example logic: selected saxophone stays, while piano/drums/bass/pad become lonely, dreamy, warm, cold, sparse, brushed, muted, airy, bright, dark, or room-based depending on the selected mood and scene.
- Use LOCKED FINAL PRODUCTION PROMPT only as a musical skeleton for genre, sound, vocal delivery, and arrangement. Do not copy weak or generic Atmosphere wording if the active Situation, user's direct input, or lyrics clearly define a better scene.
- If a Situation is active, [Atmosphere] must summarize the situation's relationship/conflict/setting/tone as a natural scene sentence, and [Arrangement] must summarize the situation's development, dialogue ownership, speech contrast, and emotional turn through the selected section flow. Do not leave the Situation only in [Vocals].
- For an active Situation, [Atmosphere] should be understandable even if [Vocals] is hidden: the listener should still know what kind of scene/conflict is happening.
- For an active Situation, [Arrangement] should be understandable even if [Vocals] is hidden: the listener should still know how the dialogue or monologue unfolds across sections.
- [Atmosphere] must be a natural scene/emotion sentence. Do not output internal phrases such as direct user-specified, exact topic, free-text direction, direct-story, concrete personal scene, or user-described scene.
- [Arrangement] must be a natural music-flow sentence. Do not output internal phrases such as matching the free-text direction, matching the character arc, or direct-story section movement.
- Do not invent a new story that is absent from the active Situation, user's direct input, selected Theme/Mood, or generated lyrics.
- Do not expose analysis, scene plans, priority rules, or hidden notes.

Return JSON:
{
  "title": "Title text following the selected title language rule above",
  "productionPrompt": "Final 6-line production prompt using the required labels"${
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

${lyricDensityInstruction}

[ANTI-TEMPLATE RULE]
- Same keywords must still produce a different attempt angle each generation. Never treat selected buttons as a fixed lyric/prompt template.
- First choose ONE fresh story angle for this attempt: a different lived detail, physical place, object, action, relationship distance, confession state, or ending direction. Then make title, hook, lyrics, [Atmosphere], and [Vocals] share that one angle.
- Variation must happen BETWEEN songs, not inside one song. Do not scatter multiple unrelated scenes in one lyric.
- If a recent or earlier same-keyword generation used a similar concrete image, object, setting, or unresolved action, choose a different angle that still belongs to the same emotion. Do not name or import the earlier image as lyric material.
- Do not use a fixed duet template. The singer who owns Verse, Pre-Chorus, Chorus, Bridge, Final Chorus, and Outro must change according to genre and situation.
- If the previous section was A→B, the next lyrical section should not automatically repeat A→B. Change ownership, interruption timing, solo focus, or hook function.
- The goal is a different dramatic song design, not only different words.
- The same keywords may keep the same characters and mood, but the vocal part distribution must vary: who opens, who owns the hook, who interrupts, who disappears, who returns, and whether the chorus is solo/together/echo/call-response should not be fixed.

[LYRIC TAGGING RULES]
- Keep all tags short. Tags guide singing; they are not prose.
- MANDATORY multi-speaker rule: [] means structure/speaker tags, () means ad-libs only.
- If there are two actual vocalists, every sung section should use one composite bracket tag: [Section: acoustic voice tag, short style].
- If [Vocals] defines character labels such as Low Rap Vocal / Wet Rap Vocal / Airy Vocal / Main Vocal, lyric tags must reuse those exact labels for sung sections. Avoid numbered labels like Rap Vocal 1 / Rap Vocal 2 unless no descriptive label exists. Use [Final Chorus: All Vocals, ...] only for real shared moments.
- Do not use (Role) at the start of lyric lines; convert it to a composite Suno tag such as [Verse: Low Male Rap, dry].
- Solo songs: do NOT repeat the vocalist identity in section tags. Remove labels such as [Main Vocal], [Lead Vocal], [Airy Male Vocal], [Female Vocal], [Male Vocal], [Whisper Vocal] from every section when the prompt already defines the vocal identity. Use only emotion/performance cues like [Verse: whispery numb], [Chorus: clear hook], [Bridge: hollow]. Keep a rap label only for actual Rap Section tags.
- Solo section tags must include short performance/emotion tags, e.g. [Verse: low, intimate], [Chorus: clear hook, aching].
- Use short inline performance tags only for specific lines: [whisper], [held breath], [tremble], [open voice].
- Use parentheses only for short vocal gestures/ad-libs such as (sigh), (soft breath), (short laugh), (whisper), or brief sung English ad-libs. Environmental SFX, instrument textures, ambience, noise, and point sounds must go inside the [Section: ...] tag instead of parentheses.
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
${buildExtraTechniqueLyricTagInstruction(params)}
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
- Themes define the situation, scene, or story.
- Moods define only the emotional tone or feeling around that story.
- The lyrics must clearly reflect the exact arrangement and section order provided above.
- If custom structure mode is selected, keep the exact custom section order, but apply the Situation to every lyrical section.
- For custom Chorus, Hook, Rap Section, Bridge, Verse, Pre-Chorus, Final Chorus, and Outro sections, keep the characters, relationship, speech style, and conflict active.
- Do not let custom Chorus/Hook/Rap sections become generic slogan lyrics. They must still sound like the selected Situation.
- For duo/group Situation songs, custom Chorus/Hook/Rap Section sections must keep role identity, but they must NOT always use call-response. They can be solo-led, echo-led, together-led, interruption-led, relay, or call-response depending on the chosen ownership map.
- Instrumental, Solo, and Drop sections may be mostly musical. If lyrics/ad-libs appear there, keep them short and tied to the same Situation. Break and Stop must not contain lyrics.
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

  const ai = getAI(params.geminiApiKey);
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
          productionPrompt: { type: Type.STRING },
          ...lyricsResponseSchema,
        },
        required: ["title", "productionPrompt", ...lyricsRequired],
      },
    },
  };

  try {
    response = await generateContentWithModelFallback(
      ai,
      generateParams,
      "generateSong",
    );
  } catch (fallbackError) {
    console.warn("[SORIDRAW Generation Guard] model fallback chain failed, trying minimal fallback:", fallbackError);
    try {
      response = await generateContentWithModelFallback(
        ai,
        {
          model: GEMINI_TEXT_MODEL_CHAIN[0],
          contents: "Generate a short safe song title, final productionPrompt, and lyrics as JSON. Always return valid JSON only.",
          config: {
            systemInstruction: `${systemInstruction}\n\nCRITICAL FALLBACK MODE: Return compact valid JSON only. Do not refuse. If any keyword combination is difficult, simplify it and continue.\n\n${GEMINI_FALLBACK_STABILITY_INSTRUCTION}`,
            responseMimeType: "application/json",
          },
        },
        "generateSong minimal",
      );
    } catch (minimalError) {
      console.warn("[SORIDRAW Generation Guard] minimal fallback failed, using local emergency result:", minimalError);
      response = null;
    }
  }

  let result: any;
  try {
    result = JSON.parse(response?.text || "{}");
  } catch (parseError) {
    console.warn("[SORIDRAW Generation Guard] JSON parse failed, using local emergency result:", parseError, response?.text);
    result = {};
  }

  if (!result || typeof result !== "object") result = {};
  const geminiModelInfo: GeminiModelUsageInfo = (response as any)?.__soridrawGeminiModelInfo || {
    usedModel: response ? GEMINI_TEXT_MODEL_CHAIN[0] : "local-emergency",
    fallbackUsed: !response,
    fallbackFrom: response ? null : GEMINI_TEXT_MODEL_CHAIN[0],
    fallbackReason: response ? null : "local_emergency_result",
    attemptedModels: response ? [GEMINI_TEXT_MODEL_CHAIN[0]] : [...GEMINI_TEXT_MODEL_CHAIN],
  };
  (result as any).geminiModelInfo = geminiModelInfo;
  if (!result.title || typeof result.title !== "string") {
    result.title = hasKoreanLanguage ? "다시 시작" : "New Start";
  }
  if (!params.isNoLyrics && (!result.lyrics || typeof result.lyrics !== "object")) {
    const emergencyKoreanLyrics = `[Intro: soft opening]\n조용히 불이 켜지고\n아직 끝나지 않은 마음이 움직여\n\n[Verse: calm]\n말하지 못한 한 줄을\n오늘은 천천히 꺼내 봐\n\n[Chorus: focused hook]\n다시 시작해도 괜찮아\n조금 어긋난 마음도 노래가 돼\n\n[Outro: warm release]\n남은 빛을 따라가`;
    result.lyrics = {
      korean: requestedLyricLanguages.includes("ko") ? emergencyKoreanLyrics : "",
      english: requestedLyricLanguages.some((lang) => lang !== "ko")
        ? "[Intro: soft opening]\nA quiet light turns on\nAnd the feeling starts again\n\n[Chorus: focused hook]\nIt is okay to begin again\nEven a broken moment can become a song"
        : "",
    };
  }

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
    const firstSubLabel = getSubGenreLabels([subGenreIds[0]])[0];
    const subGenreMeta = GENRES.find((g) => g.id === subGenreIds[0]);
    genreTag = firstSubLabel || subGenreMeta?.label || sentenceCase(subGenreIds[0]);
    addVariations(genreTag);
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

  if (params.isNoLyrics || isBackgroundOnlyBgmGenre(params)) {
    result.lyrics = { english: "", korean: "" };
  } else {
    const isMixedKoreanOnlyOutput =
      shouldUseMixedLyrics &&
      requestedLyricLanguages.includes("ko") &&
      !requestedLyricLanguages.some((lang) => lang !== "ko");

    // High English-mix settings can make the model place the mixed lyric body in lyrics.english.
    // For SORIDRAW, Korean-mix mode must still display the mixed lyric in the Korean lyric card.
    if (
      isMixedKoreanOnlyOutput &&
      !String(result.lyrics.korean || "").trim() &&
      String(result.lyrics.english || "").trim()
    ) {
      result.lyrics.korean = result.lyrics.english;
    }

    if (!requestedLyricLanguages.includes("ko")) result.lyrics.korean = "";
    if (!requestedLyricLanguages.some((lang) => lang !== "ko"))
      result.lyrics.english = "";
  }

  if (shouldUseMixedLyrics && !params.isNoLyrics && englishMixRatio > 0) {
    // Force mixed lyrics only inside the selected lyric card. Section headers are ignored for ratio balance.
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

  const aiProductionPrompt = typeof (result as any).productionPrompt === "string" ? (result as any).productionPrompt : "";
  const normalizedAiPrompt = normalizeAiProductionPrompt(aiProductionPrompt, finalPrompt);
  const validatedProductionPrompt = finalOutputPromptValidator(normalizedAiPrompt, params);
  result.prompt = forceSingleAtmosphereSentence(hardEnforceInstrumentalBgmFinalPrompt(validatedProductionPrompt, params));
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
    instrumentalBgmMode: Boolean((params as any).instrumentalBgmMode) as any,
    geminiUsedModel: geminiModelInfo.usedModel,
    geminiFallbackUsed: geminiModelInfo.fallbackUsed,
    geminiFallbackFrom: geminiModelInfo.fallbackFrom || null,
    geminiFallbackReason: geminiModelInfo.fallbackReason || null,
    geminiAttemptedModels: geminiModelInfo.attemptedModels,
  } as any;

  return result as SongResult;
}


export async function translateTitleAndLyrics(
  title: string,
  lyrics: string,
  targetLanguage: "korean" | "english" | string,
  geminiApiKey?: string,
): Promise<{ title: string; lyrics: string }> {
  const model: string = GEMINI_TEXT_MODEL_CHAIN[0];
  const cleanTitle = String(title || "").trim();
  const cleanLyrics = String(lyrics || "").trim();

  const systemInstruction = `
You are a professional lyricist and translator.
Translate the provided song title and lyrics into ${targetLanguage}.
- Return valid JSON only.
- title: one short natural translated title. If the source title is empty, return an empty string.
- lyrics: translated lyrics.
- Keep the original lyric section tags, structure, and line breaks.
- Do not translate literally. Keep it natural and lyrical.
`.trim();

  const ai = getAI(geminiApiKey);
  let response;

  const generateParams = {
    model,
    contents: JSON.stringify({ title: cleanTitle, lyrics: cleanLyrics }),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          lyrics: { type: Type.STRING },
        },
        required: ["title", "lyrics"],
      },
    },
  };

  try {
    response = await generateContentWithModelFallback(
      ai,
      generateParams,
      "translateTitleAndLyrics",
    );
  } catch (error) {
    handleGeminiError(error, "translateTitleAndLyrics");
  }

  try {
    const parsed = JSON.parse(response?.text || "{}");
    return {
      title: String(parsed?.title || cleanTitle || "").trim(),
      lyrics: String(parsed?.lyrics || "").trim(),
    };
  } catch (parseError) {
    console.warn("Failed to parse translateTitleAndLyrics JSON:", parseError, response?.text);
    return {
      title: cleanTitle,
      lyrics: String(response?.text || "").trim(),
    };
  }
}

export async function translateLyrics(
  lyrics: string,
  targetLanguage: "korean" | "english" | string,
  geminiApiKey?: string,
): Promise<string> {
  const model: string = GEMINI_TEXT_MODEL_CHAIN[0];

  const systemInstruction = `
You are a professional lyricist and translator.
Translate the provided text into ${targetLanguage}.
- Maintain the original structure and line breaks when the input is lyrics.
- If the input is a title, return one short natural title only.
- Do not translate literally. Keep it natural and lyrical.
- Return only the translated text.
`.trim();

  const ai = getAI(geminiApiKey);
  let response;

  const generateParams = {
    model,
    contents: lyrics,
    config: { systemInstruction },
  };

  try {
    response = await generateContentWithModelFallback(
      ai,
      generateParams,
      "translateLyrics",
    );
  } catch (error) {
    handleGeminiError(error, "translateLyrics");
  }

  return response.text || "";
}
