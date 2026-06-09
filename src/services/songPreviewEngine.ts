// src/services/songPreviewEngine.ts
// SORIDRAW preview engine
// 미리보기는 실제 5단 프롬프트([Genre]/[Instruments]/[Atmosphere]/[Vocals]/[Arrangement])의 사용자용 번역본이다.

import {
  GENRE_HIERARCHY,
  GENRES,
  STYLE_CYCLES,
  SOUND_TEXTURE_CYCLES,
  MOODS,
  THEMES,
  VOCAL_TECHNIQUES,
  VOCAL_VOICE_TONES,
  VOCAL_PERSONALITIES,
} from "../constants";
import { VOCAL_TONES } from "../constants/vocalTones";
import { VocalMember, SituationConfig } from "../types";

export type PreviewKeywordCategory =
  | "genre"
  | "style"
  | "sound"
  | "mood"
  | "theme"
  | "vocal"
  | "vocal_technique"
  | "tempo"
  | "structure"
  | "lyrics";

export interface PreviewMeaningData {
  id: string;
  label: string;
  category: PreviewKeywordCategory;
  musicalRole?: string;
  plainMeaning?: string;
  genreImpact?: string;
  rhythmImpact?: string;
  instrumentImpact?: string;
  vocalImpact?: string;
  arrangementImpact?: string;
  lyricImpact?: string;
  moodImpact?: string;
  energyImpact?: string;
  tempoImpact?: string;
  weight?: number;
  conflictsWith?: string[];
  pairsWellWith?: string[];
  mustNotCreateLyricContent?: boolean;
  allowedAsExpressionColor?: boolean;
  styleEra?: string;
  styleArrangement?: string;
  styleSoundColor?: string;
  styleAppeal?: string;
  styleFusionImpact?: string;
}

export interface PreviewInput {
  selectedGenre: string[];
  selectedStyles: string[];
  selectedSounds: string[];
  selectedPointSounds?: string[];
  selectedMoods: string[];
  selectedThemes: string[];
  selectedVocalTags: string[];
  selectedVocalCharacter?: any;
  selectedSections?: any[];
  vocalMode?: string;
  maleCount?: number;
  femaleCount?: number;
  tempo?: { enabled: boolean; min: number; max: number };
  lyricsLength?: string;
  includeLyrics: boolean;
  lyricLanguages: string[];
  bilingualMix: boolean;
  englishMixRatio: number;
  rapEnabled: boolean;
  directInput?: string;
  customPrompt?: string;
  vocalMembers?: VocalMember[];
  situation?: SituationConfig;
}

export type PreviewPromptPartKey = "genre" | "instruments" | "atmosphere" | "vocals" | "arrangement" | "lyrics";

export interface PreviewPromptPart {
  main: string[];
  support: string[];
  sourceLabels: string[];
}

export interface PreviewPromptParts {
  genre: PreviewPromptPart;
  instruments: PreviewPromptPart;
  atmosphere: PreviewPromptPart;
  vocals: PreviewPromptPart;
  arrangement: PreviewPromptPart;
  lyrics: PreviewPromptPart;
}

export interface PreviewSongIntent {
  genreDirection: string;
  fusionDirection: string;
  styleFusionDirection: string;
  finalGenreInterpretation: string;
  coreInstruments: string[];
  soundTexture: string;
  emotionalCore: string;
  moodColor: string;
  vocalDirection: string;
  arrangementFlow: string;
  lyricDirection: string;
  finalImpression: string;
  warnings: string[];
  vocalMembers?: VocalMember[];
  situation?: SituationConfig;
  moodId?: string;
  selectedMoods?: { id: string; label: string }[];
  selectedThemes?: { id: string; label: string }[];
  previewPromptParts?: PreviewPromptParts;
}

export interface PreviewCards {
  genreStr: string;
  interpretationSummary: string;
  expectedAtmosphere: string;
  expectedVocals: string;
  expectedArrangement: string;
  expectedLyrics: string;
  pointsToNote: string[];
}

type LookupItem = {
  id: string;
  label?: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  style?: string;
  sound?: string;
  mood?: string;
  arrangement?: string;
  promptCore?: string;
  kind?: string;
};

export const PREVIEW_MEANING_DATASET: Record<string, PreviewMeaningData> = {};

const DEFAULT_NOTE = "'미리보기'는 실제 생성 전, 선택한 키워드를 바탕으로 곡의 방향을 미리 보여주는 안내입니다. 실제 생성 결과와는 다를수있으니 참고용으로만 봐주세요.";

const CUSTOM_MOOD_PREFIX = "__custom_mood__:";
const CUSTOM_THEME_PREFIX = "__custom_theme__:";

function decodeLooseURIComponent(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/%[0-9A-Fa-f]{2}/.test(text)) return text;
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function decodeCustomPreviewKeyword(value?: string | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const prefixes = [CUSTOM_MOOD_PREFIX, CUSTOM_THEME_PREFIX, "__custom_mood__", "__custom_theme__"];
  for (const prefix of prefixes) {
    const index = raw.indexOf(prefix);
    if (index >= 0) {
      const encoded = raw.slice(index + prefix.length).replace(/^[:_\s-]+/, "").trim();
      return decodeLooseURIComponent(encoded);
    }
  }

  return decodeLooseURIComponent(raw);
}

const RAW_ENGLISH_CUE_MAP: Array<[RegExp, string]> = [
  [/dark enclosed reflections/gi, "어둡고 폐쇄적인 울림"],
  [/short breath[- ]led vocal fragments/gi, "짧은 호흡으로 끊기는 보컬 조각"],
  [/broken sentence vocal delivery/gi, "문장마다 끊어 부르는 보컬"],
  [/post[- ]rock band/gi, "포스트록 밴드"],
  [/dark synth layer/gi, "어둡게 깔리는 신스 레이어"],
  [/expansive cinematic/gi, "넓고 영화적인"],
  [/heavy,? uneasy/gi, "무겁고 불안한"],
  [/layered guitars/gi, "겹겹이 쌓이는 기타"],
  [/gradual crescendos/gi, "점점 커지는 전개"],
  [/recorder/gi, "리코더"],
  [/vocal fragments/gi, "보컬 조각"],
  [/vocal delivery/gi, "보컬 전달"],
  [/synth layer/gi, "신스 레이어"],
];

function preferKoreanSegment(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const parts = text.split(/\s+(?:-|–|—)\s+|\s*:\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return text;

  const koreanParts = parts
    .map((part) => ({ part, score: (part.match(/[가-힣]/g) || []).length }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return koreanParts[0]?.part || text;
}

function replaceRawEnglishCues(value: string): string {
  return RAW_ENGLISH_CUE_MAP.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function compactText(value?: string | null): string {
  const decoded = decodeCustomPreviewKeyword(value);
  const koreanPreferred = preferKoreanSegment(decoded);
  return replaceRawEnglishCues(koreanPreferred)
    .replace(/\*\*/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\(([A-Za-z0-9_.,&/\-\s]+)\)/g, "")
    .replace(/_{2,}custom_(?:mood|theme)_{2}:?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeRawEnglishCue(value: string): boolean {
  const text = compactText(value);
  if (!text) return false;
  const allowed = text.replace(/R&B|J-Pop|K-Pop|K-Indie|EDM|UK|BPM|808|Y2K|Lo-fi|lo-fi/gi, "");
  const words = allowed.match(/[A-Za-z]{3,}/g) || [];
  const koreanChars = (allowed.match(/[가-힣]/g) || []).length;
  return words.length >= 2 && koreanChars < 3;
}

function previewText(value?: string | null, sourceLabel?: string): string {
  const clean = compactText(value);
  const source = compactText(sourceLabel);
  if (!clean) return source;
  if (looksLikeRawEnglishCue(clean) && source) return source;
  return clean;
}

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  return list
    .map(compactText)
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function take(list: string[], count: number): string[] {
  return unique(list).slice(0, count);
}

function labelOf(item?: LookupItem | null, fallback = ""): string {
  return compactText(item?.labelKo || item?.label || fallback);
}

function findGenreById(id: string): LookupItem | undefined {
  const flat = GENRES.find((g) => g.id === id);
  if (flat) return flat;

  for (const group of GENRE_HIERARCHY as any[]) {
    for (const main of group.children || []) {
      if (main.id === id) return main;
      const sub = (main.children || []).find((child: LookupItem) => child.id === id);
      if (sub) return sub;
    }
  }
  return undefined;
}

function findStyleById(id: string): { item?: LookupItem; groupId?: string; groupTitle?: string } {
  for (const group of STYLE_CYCLES as any[]) {
    const item = (group.variants || []).find((variant: LookupItem) => variant.id === id && variant.kind !== "separator");
    if (item) return { item, groupId: group.id, groupTitle: group.titleKo || group.title };
  }
  return {};
}

function findSoundById(id: string): LookupItem | undefined {
  for (const group of SOUND_TEXTURE_CYCLES as readonly any[]) {
    const item = (group.variants || []).find((variant: LookupItem) => variant.id === id && variant.kind !== "separator");
    if (item) return item;
  }
  return undefined;
}

function findMoodById(id: string): LookupItem | undefined {
  return (MOODS as LookupItem[]).find((m) => m.id === id);
}

function findThemeById(id: string): LookupItem | undefined {
  return (THEMES as LookupItem[]).find((t) => t.id === id);
}

function asSentence(label: string): string {
  return compactText(label).replace(/[.。]$/, "");
}

function joinKo(list: string[], fallback = ""): string {
  const values = unique(list);
  if (values.length === 0) return fallback;
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')}와 ${values[values.length - 1]}`;
}

function hasKoreanBatchim(text: string): boolean {
  const last = compactText(text).trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return ((code - 0xac00) % 28) !== 0;
}

function withObjectParticle(text: string): string {
  const clean = compactText(text);
  if (!clean) return clean;
  return `${clean}${hasKoreanBatchim(clean) ? "을" : "를"}`;
}

const STYLE_SUBGENRE_GROUP_IDS = new Set([
  "fusion-genre",
  "rhythm-bounce",
  "rap-beat-texture",
  "synth-space",
  "band-live",
  "cinematic-scene",
]);

const STYLE_VOCAL_GROUP_IDS = new Set(["vocal-expression"]);
const STYLE_HOOK_GROUP_IDS = new Set(["hook-addiction"]);
const STYLE_TEXTURE_GROUP_IDS = new Set(["space-texture", "era-texture"]);
const STYLE_ARRANGEMENT_GROUP_IDS = new Set(["stage-shift"]);

function quoteList(list: string[], max = 4): string {
  const values = take(list, max);
  if (values.length === 0) return "";
  return values.join(", ");
}

function sentenceList(lines: Array<string | undefined | null>): string {
  return lines
    .map((line) => compactText(line || ""))
    .filter(Boolean)
    .map((line) => /[.!?。]$/.test(line) ? line : `${line}.`)
    .join(" ");
}

function isGenreLike(label: string, id = "", groupId = ""): boolean {
  const text = `${label} ${id} ${groupId}`.toLowerCase();
  return (
    groupId.includes("fusion") ||
    /pop|rock|metal|r&b|rnb|soul|hip|rap|trap|drill|boom|house|edm|techno|trance|jazz|folk|band|city|synth|idol|anime|vocaloid|garage|disco|funk|reggae|trot|opera|musical/.test(text)
  );
}

function isVocalLike(label: string, id = "", groupId = ""): boolean {
  const text = `${label} ${id} ${groupId}`.toLowerCase();
  return /vocal|voice|sing|singing|whisper|breath|breathy|husky|soft|spoken|rap|rapper|보컬|목소리|창법|가창|호흡|숨|허스키|속삭|말하듯|랩/.test(text);
}

function isInstrumentLike(label: string, id = ""): boolean {
  const text = `${label} ${id}`.toLowerCase();
  return /piano|guitar|drum|bass|synth|pad|keys|string|orchestra|brass|flute|sax|violin|808|kick|snare|hat|percussion|fx|noise|reverb|delay|피아노|기타|드럼|베이스|신스|패드|건반|현악|오케스트라|리버브|딜레이|질감|악기/.test(text);
}

function moodPrefixFromLabels(labels: string[]): string {
  const text = labels.join(" ");
  if (/차가|어두|공허|쓸쓸|외로|고독|다크|dark/i.test(text)) return "어두운";
  if (/따뜻|포근|편안|치유|warm|soft/i.test(text)) return "따뜻한";
  if (/몽환|환상|신비|우주|dream|fantasy/i.test(text)) return "몽환적인";
  if (/불안|위태|긴장|uneasy|tense/i.test(text)) return "위태로운";
  if (/청량|시원|밝|희망|bright|fresh/i.test(text)) return "밝은";
  return "";
}

function genrePhrase(baseGenres: string[], genreFusion: string[], moodLabels: string[]): string {
  const base = joinKo(take(baseGenres, 2), "대중 팝");
  const fusion = take(genreFusion.filter((item) => !base.includes(item)), 2);
  const mood = moodPrefixFromLabels(moodLabels);
  const fusionText = fusion.length > 0 ? `${fusion.join('·')} 질감의 ` : "";
  return compactText(`${mood ? `${mood} ` : ""}${fusionText}${base}`);
}

function summarizeTempo(tempo?: PreviewInput["tempo"]): string {
  if (!tempo?.enabled) return "선택한 장르에 맞는 자연스러운 속도로 흐릅니다";
  const avg = Math.round((tempo.min + tempo.max) / 2);
  if (avg < 80) return `${tempo.min}-${tempo.max} BPM의 느린 호흡으로 여백을 넓게 둡니다`;
  if (avg <= 119) return `${tempo.min}-${tempo.max} BPM의 중간 템포로 리듬과 감정의 균형을 잡습니다`;
  return `${tempo.min}-${tempo.max} BPM의 빠른 흐름으로 에너지를 앞으로 밀어냅니다`;
}

function lyricLanguageText(input: PreviewInput): string {
  if (!input.includeLyrics) return "가사 없이 악기와 전개 중심으로 곡의 방향을 보여줍니다";
  if (input.bilingualMix) return `한국어를 중심으로 영어 표현이 약 ${input.englishMixRatio || 30}% 정도 섞이는 방향입니다`;
  const langs = input.lyricLanguages || [];
  if (langs.includes("en") && !langs.includes("ko")) return "영어 가사 중심으로 말맛과 리듬을 잡습니다";
  if (langs.includes("ja")) return "일본어 가사 중심으로 발음의 흐름을 살립니다";
  return "한국어 가사 중심으로 감정과 말맛을 잡습니다";
}

function buildGenreVocalGrammar(genreLabels: string[]): string {
  const text = genreLabels.join(" ").toLowerCase();
  if (/r&b|rnb|soul|소울/.test(text)) return "리듬의 빈칸을 부드럽게 타고 감정을 길게 남기는 장르 보컬감";
  if (/hip|rap|trap|drill|boom|힙합|랩|트랩|드릴|붐뱁/.test(text)) return "박자와 말맛을 또렷하게 살리는 리듬 중심 보컬감";
  if (/rock|metal|punk|band|록|메탈|밴드|펑크/.test(text)) return "악기 밀도 위에서도 감정선이 묻히지 않는 단단한 보컬감";
  if (/jazz|재즈/.test(text)) return "박자를 살짝 밀고 당기며 여유를 남기는 보컬감";
  if (/ballad|발라드/.test(text)) return "호흡과 끝음을 길게 살리는 감정 중심 보컬감";
  if (/house|garage|edm|dance|disco|funk|하우스|개러지|댄스|디스코|펑크/.test(text)) return "비트 위에서 가볍게 움직이며 리듬을 선명하게 잡는 보컬감";
  if (/synth|city|pop|indie|신스|시티|팝|인디/.test(text)) return "멜로디를 깔끔하게 타면서 분위기를 해치지 않는 보컬감";
  return "선택한 장르의 기본 흐름에 맞는 보컬감";
}

function buildMoodVocalPressure(moodLabels: string[]): string {
  const text = moodLabels.join(" ");
  if (/어두|차가|공허|쓸쓸|외로|고독|불안|위태|긴장|서늘|폐쇄/i.test(text)) {
    return "감정을 크게 터뜨리기보다 눌러 담아 긴장감을 남깁니다";
  }
  if (/따뜻|포근|치유|편안|몽환|아련|추억|사랑|후회|그리움/i.test(text)) {
    return "호흡과 끝음을 부드럽게 남겨 감정의 여운을 살립니다";
  }
  if (/밝|청량|신나는|경쾌|희망|상쾌/i.test(text)) {
    return "발음을 또렷하게 열어 밝은 에너지가 앞으로 나오게 합니다";
  }
  return "곡의 분위기에 맞춰 과하지 않게 감정을 조절합니다";
}

function vocalRoleTextFromCounts(maleCount = 0, femaleCount = 0, vocalMode = ""): string {
  const total = maleCount + femaleCount;
  if (total <= 0) return "";
  if (total === 1) {
    if (maleCount === 1) return "남성 솔로 보컬";
    if (femaleCount === 1) return "여성 솔로 보컬";
  }
  if (maleCount > 0 && femaleCount > 0) {
    if (total === 2) return "남녀 듀엣 보컬";
    return `남성 ${maleCount}명과 여성 ${femaleCount}명의 혼성 보컬`;
  }
  if (total === 2) return `${maleCount > 0 ? "남성" : "여성"} 듀엣 보컬`;
  if (vocalMode === "group" || total >= 3) return `${maleCount > 0 ? "남성" : "여성"} ${total}인 보컬 그룹`;
  return `${maleCount > 0 ? "남성" : "여성"} 보컬`;
}

function buildVocalRoleText(members: VocalMember[], fallback?: { maleCount?: number; femaleCount?: number; vocalMode?: string }): string {
  const maleCount = members.filter((m) => m.gender === "male").length;
  const femaleCount = members.filter((m) => m.gender === "female").length;
  if (members.length === 0) {
    return vocalRoleTextFromCounts(fallback?.maleCount || 0, fallback?.femaleCount || 0, fallback?.vocalMode || "");
  }
  if (members.length === 1) return `${members[0].gender === "male" ? "남성" : "여성"} 솔로 보컬`;
  if (maleCount > 0 && femaleCount > 0) {
    if (members.length === 2) return "남녀 듀엣 보컬";
    return `남성 ${maleCount}명과 여성 ${femaleCount}명의 혼성 보컬`;
  }
  if (members.length === 2) return `${maleCount > 0 ? "남성" : "여성"} 듀엣 보컬`;
  return `${maleCount > 0 ? "남성" : "여성"} ${members.length}인 보컬 그룹`;
}

function collectDirectVocalChoices(members: VocalMember[]): string[] {
  const directParts: string[] = [];
  if (members.length === 0) return directParts;

  const roleText = buildVocalRoleText(members);
  if (roleText) directParts.push(roleText);

  members.slice(0, 2).forEach((member) => {
    const tone = member.toneId ? VOCAL_TONES.find((t: any) => t.id === member.toneId) : undefined;
    if (tone) directParts.push(tone.labelKo || tone.label);

    const char = member.character;
    if (!char) return;

    if (char.voiceToneId) {
      const v = VOCAL_VOICE_TONES.find((item: any) => item.id === char.voiceToneId);
      if (v) directParts.push(v.labelKo || v.label);
    }
    if (char.customVoiceTone) directParts.push(char.customVoiceTone);

    if (char.personalityId) {
      const p = VOCAL_PERSONALITIES.find((item: any) => item.id === char.personalityId);
      if (p) directParts.push(p.labelKo || p.label);
    }
    if (char.customPersonality) directParts.push(char.customPersonality);

    if (char.techniqueIds?.length) {
      char.techniqueIds.slice(0, 2).forEach((tid) => {
        const technique = VOCAL_TECHNIQUES.find((item: any) => item.id === tid);
        if (technique) directParts.push(technique.labelKo || technique.label);
      });
    }
    if (char.customTechnique) directParts.push(char.customTechnique);

    if (char.emotionLevel !== undefined) {
      if (char.emotionLevel >= 8) directParts.push("감정을 진하게 드러내는 표현");
      else if (char.emotionLevel <= 3) directParts.push("감정을 눌러 담는 절제된 표현");
    }
    if (char.deliveryLevel !== undefined) {
      if (char.deliveryLevel <= 3) directParts.push("숨을 많이 섞는 호흡감");
      else if (char.deliveryLevel >= 8) directParts.push("선명하게 앞으로 나오는 전달력");
    }
    if (char.rangeLevel !== undefined) {
      if (char.rangeLevel >= 8) directParts.push("높게 열리는 음역");
      else if (char.rangeLevel <= 3) directParts.push("낮고 가까운 음역");
    }
  });

  return take(directParts, 6);
}

function buildVocalSummary(
  input: PreviewInput,
  moodLabels: string[],
  genreLabels: string[],
  styleVocalLabels: string[] = []
): string {
  if (!input.includeLyrics) return "연주 전용 설정이라 노래 보컬은 중심에 두지 않습니다.";

  const members = input.vocalMembers || [];
  const roleText = buildVocalRoleText(members, {
    maleCount: input.maleCount,
    femaleCount: input.femaleCount,
    vocalMode: input.vocalMode,
  });
  const directChoices = collectDirectVocalChoices(members).filter((item) => item !== roleText);
  const styleChoices = take(styleVocalLabels, 3);
  const genreGrammar = buildGenreVocalGrammar(genreLabels);
  const moodPressure = buildMoodVocalPressure(moodLabels);
  const hasRap = input.rapEnabled || members.some((m) => m.roles?.includes("rapper"));

  const roleLine = roleText
    ? `보컬은 ${roleText}을 기준으로 합니다.`
    : "보컬은 장르의 기본 보컬 톤을 기준으로 합니다.";

  const selectedStyleLine = styleChoices.length > 0
    ? `${quoteList(styleChoices)} 보컬의 목소리와 창법을 중심으로, ${genreGrammar}을 함께 살립니다.`
    : directChoices.length > 0
      ? `${quoteList(directChoices)} 설정을 중심으로, ${genreGrammar}을 함께 살립니다.`
      : `${genreGrammar}을 바탕으로 보컬 방향을 잡습니다.`;

  const rapLine = hasRap ? "랩 설정이 함께 켜져 있으면 말맛과 리듬 전달도 보컬 흐름에 반영됩니다." : "";

  return sentenceList([
    roleLine,
    selectedStyleLine,
    moodPressure,
    rapLine,
  ]);
}

function buildSituationSummary(situation?: SituationConfig): string[] {
  if (!situation?.enabled) return [];
  const parts: string[] = [];
  const targetA = compactText(situation.targetA);
  const targetB = compactText(situation.targetB);
  const relation = compactText(situation.relationship);
  const description = compactText(situation.description);
  const development = compactText(situation.development || situation.developmentCustom || situation.developmentPreset);
  const detail = compactText(situation.details || situation.detailCustom);

  if (targetA || targetB) parts.push(`${targetA || "화자"}${targetB ? `와 ${targetB}` : ""}`);
  if (relation) parts.push(relation);
  if (description) parts.push(description);
  if (development) parts.push(`${development} 흐름`);
  if (detail) parts.push(detail);
  return take(parts, 4);
}

function styleDisplayCue(_item: LookupItem | undefined, label: string): string {
  return previewText(label, label);
}

function soundDisplayCue(_item: LookupItem | undefined, label: string): string {
  return previewText(label, label);
}

function moodDisplayCue(_item: LookupItem | undefined, label: string): string {
  return previewText(label, label);
}

function createEmptyParts(): PreviewPromptParts {
  const part = (): PreviewPromptPart => ({ main: [], support: [], sourceLabels: [] });
  return {
    genre: part(),
    instruments: part(),
    atmosphere: part(),
    vocals: part(),
    arrangement: part(),
    lyrics: part(),
  };
}

function addToPart(parts: PreviewPromptParts, key: PreviewPromptPartKey, value?: string, source?: string, main = false): void {
  const clean = previewText(value, source);
  if (!clean) return;
  const target = parts[key];
  if (main) target.main.push(clean);
  else target.support.push(clean);
  if (source) target.sourceLabels.push(compactText(source));
}

function buildPreviewPromptParts(input: PreviewInput): PreviewPromptParts {
  const parts = createEmptyParts();

  (input.selectedGenre || []).forEach((id) => {
    const genre = findGenreById(id);
    const label = labelOf(genre, id);
    addToPart(parts, "genre", label, label, true);
  });

  (input.selectedStyles || []).forEach((id) => {
    const { item, groupId } = findStyleById(id);
    const label = labelOf(item, id);
    if (!label) return;

    const group = groupId || "";
    const displayCue = styleDisplayCue(item, label);
    const vocalLike = isVocalLike(label, id, group);
    const instrumentLike = isInstrumentLike(label, id);

    // 스타일 메뉴의 왼쪽 줄은 장르/서브장르 성격으로 보고 [Genre]에 우선 반영한다.
    if (STYLE_SUBGENRE_GROUP_IDS.has(group)) {
      addToPart(parts, "genre", label, label);
      return;
    }

    // 후렴 라인은 보컬 상태가 아니라 곡 전개/후렴 구조로 반영한다.
    if (STYLE_HOOK_GROUP_IDS.has(group)) {
      addToPart(parts, "lyrics", label, label, true);
      addToPart(parts, "arrangement", label, label, true);
      return;
    }

    // 보컬 라인은 곡 질감이나 장르가 아니라 보컬 상태에만 반영한다.
    if (STYLE_VOCAL_GROUP_IDS.has(group) || vocalLike) {
      addToPart(parts, "vocals", label, label, true);
      return;
    }

    if (STYLE_TEXTURE_GROUP_IDS.has(group)) {
      addToPart(parts, "atmosphere", label, label, true);
      if (instrumentLike || item?.sound) addToPart(parts, "instruments", label, label);
      else addToPart(parts, "instruments", displayCue, label);
      return;
    }

    if (STYLE_ARRANGEMENT_GROUP_IDS.has(group)) {
      addToPart(parts, "arrangement", label, label, true);
      return;
    }

    if (instrumentLike || item?.sound) {
      addToPart(parts, "instruments", label, label, true);
      return;
    }

    addToPart(parts, "atmosphere", displayCue, label);
  });

  (input.selectedSounds || []).forEach((id) => {
    const sound = findSoundById(id);
    const label = labelOf(sound, id);
    addToPart(parts, "instruments", label, label, true);
    addToPart(parts, "atmosphere", soundDisplayCue(sound, label), label);
  });

  (input.selectedMoods || []).forEach((id) => {
    const mood = findMoodById(id);
    const label = labelOf(mood, id);
    addToPart(parts, "atmosphere", label, label, true);
  });

  (input.selectedThemes || []).forEach((id) => {
    const theme = findThemeById(id);
    const label = labelOf(theme, id);
    addToPart(parts, "lyrics", label, label, true);
    addToPart(parts, "atmosphere", label, label);
  });

  (input.selectedVocalTags || []).forEach((id) => {
    const vocal = PREVIEW_MEANING_DATASET[id];
    addToPart(parts, "vocals", vocal?.label || id, vocal?.label || id, true);
  });

  const existingVocalHints = take(parts.vocals.main, 4);
  const vocalSummary = buildVocalSummary(input, [...parts.atmosphere.main, ...parts.atmosphere.support], parts.genre.main, existingVocalHints);
  parts.vocals.main = unique([vocalSummary, ...parts.vocals.main]);
  parts.vocals.sourceLabels.push("보컬 요약");

  const situationParts = buildSituationSummary(input.situation);
  situationParts.forEach((item) => {
    addToPart(parts, "lyrics", item, "스토리보드", true);
    addToPart(parts, "atmosphere", item, "스토리보드");
  });

  addToPart(parts, "arrangement", summarizeTempo(input.tempo), "템포", true);
  if (input.rapEnabled) {
    addToPart(parts, "arrangement", "랩 구간의 리듬감", "랩 옵션");
    addToPart(parts, "lyrics", "짧고 리듬감 있는 문장", "랩 옵션");
  }
  if (!input.includeLyrics) {
    addToPart(parts, "lyrics", "가사 없이 악기와 전개 중심", "가사 옵션", true);
  }

  return parts;
}

export function resolveGenrePreviewMeaning(genreId: string): PreviewMeaningData {
  const genre = findGenreById(genreId);
  const label = labelOf(genre, genreId);
  return {
    id: genreId,
    label,
    category: "genre",
    musicalRole: label,
    plainMeaning: `${label} 기반의 음악 방향`,
    arrangementImpact: label,
    weight: 1,
  };
}

export function resolveStylePreviewMeaning(styleId: string): PreviewMeaningData {
  const { item, groupId } = findStyleById(styleId);
  const label = labelOf(item, styleId);
  return {
    id: styleId,
    label,
    category: "style",
    musicalRole: label,
    plainMeaning: label,
    genreImpact: isGenreLike(label, styleId, groupId || "") ? label : undefined,
    instrumentImpact: label,
    vocalImpact: isVocalLike(label, styleId, groupId || "") ? label : undefined,
    moodImpact: label,
    arrangementImpact: label,
    styleFusionImpact: isGenreLike(label, styleId, groupId || "") ? label : undefined,
    weight: 0.8,
  };
}

export function collectPreviewMeaningData(input: PreviewInput): PreviewMeaningData[] {
  return [
    ...(input.selectedGenre || []).map(resolveGenrePreviewMeaning),
    ...(input.selectedStyles || []).map(resolveStylePreviewMeaning),
  ];
}


function isHookLabel(label: string): boolean {
  return /후렴|훅|hook|따라|반복|중독|코러스|chorus/i.test(label);
}

function cleanLyricThemeLabels(labels: string[]): string[] {
  return take(labels.filter((label) => {
    const text = compactText(label);
    if (!text) return false;
    if (/가사 없이|가사 옵션|리듬감 있는 문장/i.test(text)) return false;
    if (isHookLabel(text)) return false;
    return true;
  }), 4);
}

function buildAtmosphereSummary(moodLabels: string[], textureLabels: string[], themeLabels: string[]): string {
  const moodText = quoteList(moodLabels, 4);
  const textureText = quoteList(textureLabels, 3);
  const themeText = quoteList(themeLabels, 4);

  return sentenceList([
    moodText
      ? `${moodText} 분위기가 전체 공기를 이끕니다`
      : "선택한 장르와 사운드에 맞춰 곡의 기본 분위기가 잡힙니다",
    textureText
      ? `${textureText} 등을 바탕으로 곡의 사운드와 보컬을 더 풍성하게 만듭니다`
      : "악기와 질감은 분위기를 해치지 않는 방향으로 정리됩니다",
    themeText
      ? `특히 ${themeText} 주제와 어울려 곡의 감정 방향을 잡아줍니다`
      : "주제는 억지 사건보다 감정의 방향으로 반영됩니다",
  ]);
}

function buildLyricDirectionSummary(input: PreviewInput, lyricLabels: string[]): string {
  if (!input.includeLyrics) return "가사 미포함 설정이라, 이야기는 악기와 전개 중심으로 전달됩니다.";

  const hookLabels = take(lyricLabels.filter(isHookLabel), 2);
  const themeLabels = cleanLyricThemeLabels(lyricLabels);

  const baseLine = themeLabels.length > 0
    ? `${quoteList(themeLabels, 4)} 선택한 주제에 맞도록 이야기를 만들고, 그에 맞는 감정과 분위기가 가사에 적용됩니다`
    : "선택한 주제와 분위기에 맞도록 이야기를 만들고, 말투와 감정선을 가사에 적용합니다";

  const hookLine = hookLabels.length > 0
    ? `이어서, 후렴 라인은 ${quoteList(hookLabels, 2)} 방향으로 이 곡만의 특색을 더 살려줍니다`
    : "후렴은 곡의 중심 감정이 자연스럽게 남도록 정리됩니다";

  return sentenceList([baseLine, hookLine]);
}


function isTempoArrangementText(value: string): boolean {
  const text = compactText(value);
  return /BPM|템포|속도|흐릅니다|느린 호흡|빠른 흐름|중간 템포|현재 선택된 BPM/i.test(text);
}

function buildTempoArrangementSentence(tempo?: PreviewInput["tempo"]): string {
  if (!tempo?.enabled) return "템포는 현재 선택된 BPM 값을 기준으로 정리됩니다";
  const min = Math.round(Number(tempo.min));
  const max = Math.round(Number(tempo.max));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "템포는 현재 선택된 BPM 값을 기준으로 정리됩니다";
  if (min === max) return `템포는 정확히 ${min} BPM으로 전개됩니다`;
  return `템포는 ${min}-${max} BPM 범위로 전개됩니다`;
}

function pointSoundLabelsFromInput(input: PreviewInput): string[] {
  return take((input.selectedPointSounds || []).map((id) => labelOf(findSoundById(id), id)).filter(Boolean), 3);
}

function buildArrangementSummary(input: PreviewInput, parts: PreviewPromptParts, genreDirection: string): string {
  const tempoLine = buildTempoArrangementSentence(input.tempo);
  const pointSounds = pointSoundLabelsFromInput(input);
  const arrangementCues = take(
    [...parts.arrangement.main, ...parts.arrangement.support]
      .filter((item) => !isTempoArrangementText(item))
      .filter((item) => !/랩 구간|랩 옵션|포인트/i.test(item)),
    2
  );
  const instrumentCues = take([...parts.instruments.main, ...parts.instruments.support], 3);

  const startLine = `${withObjectParticle(genreDirection)} 기본 바탕으로 초반부가 전개됩니다`;

  const middleLine = instrumentCues.length > 0
    ? `중반부터는 ${joinKo(instrumentCues)} 사운드로 곡을 이어 갑니다`
    : arrangementCues.length > 0
      ? `중반부터는 ${joinKo(arrangementCues)} 흐름으로 곡을 이어 갑니다`
      : "중반부터는 선택한 장르의 리듬과 사운드가 자연스럽게 앞으로 나옵니다";

  const rapLine = input.rapEnabled
    ? "랩이 켜져 있으면 해당 구간에서 말맛과 리듬감을 짧게 살립니다"
    : "";

  const pointLine = pointSounds.length > 0
    ? `포인트 악기는 ${joinKo(pointSounds)} 중심으로 전환부나 강조 구간에서 짧게 살아납니다`
    : "";

  const detailLine = arrangementCues.length > 0
    ? `전반적으로 질감은 ${joinKo(arrangementCues)} 방향을 참고해 과하지 않게 정리됩니다`
    : "";

  const finishLine = "후렴과 마무리는 곡의 중심 감정이 남도록 정리됩니다";

  return sentenceList([tempoLine, startLine, middleLine, rapLine, pointLine, detailLine, finishLine]);
}

export function buildPreviewSongIntent(input: PreviewInput): PreviewSongIntent {
  const parts = buildPreviewPromptParts(input);
  const genreDirection = genrePhrase(parts.genre.main, parts.genre.support, [...parts.atmosphere.main, ...parts.atmosphere.support]);
  const coreInstruments = take([...parts.instruments.main, ...parts.instruments.support], 4);
  const moodLabels = take([...parts.atmosphere.main, ...parts.atmosphere.support], 4);
  const allLyricLabels = unique([...parts.lyrics.main, ...parts.lyrics.support]);
  const lyricLabels = take(allLyricLabels, 4);
  const vocalLabels = take([...parts.vocals.main, ...parts.vocals.support], 3);

  const soundTexture = coreInstruments.length > 0
    ? `${joinKo(coreInstruments)}가 곡의 주요 소리 재료가 됩니다.`
    : "선택한 장르에 맞는 기본 악기와 질감이 중심이 됩니다.";

  const moodColor = moodLabels.length > 0
    ? `${joinKo(moodLabels)} 느낌이 곡의 공기와 온도를 잡습니다.`
    : "선택한 장르와 사운드에 맞춰 곡의 기본 분위기가 잡힙니다.";

  const emotionalCore = lyricLabels.length > 0
    ? `${joinKo(lyricLabels)} 쪽의 감정을 중심에 둡니다.`
    : "특정 이야기보다 선택한 키워드의 감정 방향을 따라갑니다.";

  const vocalDirection = vocalLabels.length > 0
    ? vocalLabels[0]
    : "장르와 분위기에 맞는 자연스러운 보컬 톤으로 정리됩니다.";

  const arrangementFlow = buildArrangementSummary(input, parts, genreDirection);

  const lyricDirection = buildLyricDirectionSummary(input, allLyricLabels);

  const finalImpression = `${genreDirection} 안에서 ${coreInstruments[0] || "핵심 사운드"}와 ${vocalLabels[0] || "보컬"}이 중심을 잡는 곡입니다.`;

  const warnings: string[] = [];
  if (!input.includeLyrics && ((input.selectedVocalTags || []).length > 0 || (input.vocalMembers || []).length > 0)) {
    warnings.push("가사 미포함 상태라 보컬 설정은 실제 노래보다 악기 질감이나 보이스 이펙트 쪽으로 약하게 반영될 수 있습니다.");
  }

  return {
    genreDirection,
    fusionDirection: joinKo(take(parts.genre.support, 2)),
    styleFusionDirection: joinKo(take(parts.genre.support, 2)),
    finalGenreInterpretation: genreDirection,
    coreInstruments,
    soundTexture,
    emotionalCore,
    moodColor,
    vocalDirection,
    arrangementFlow,
    lyricDirection,
    finalImpression,
    warnings,
    vocalMembers: input.vocalMembers,
    situation: input.situation,
    moodId: input.selectedMoods?.[0],
    selectedMoods: (input.selectedMoods || []).map((id) => ({ id, label: labelOf(findMoodById(id), id) })),
    selectedThemes: (input.selectedThemes || []).map((id) => ({ id, label: labelOf(findThemeById(id), id) })),
    previewPromptParts: parts,
  };
}

export function renderPreviewCards(intent: PreviewSongIntent): PreviewCards {
  const parts = intent.previewPromptParts;
  const instruments = take(intent.coreInstruments, 3);
  const moodItems = parts ? take(parts.atmosphere.main, 4) : [];
  const textureItems = parts ? take([...parts.instruments.main, ...parts.atmosphere.support], 4) : instruments;
  const allLyricItems = parts ? unique([...parts.lyrics.main, ...parts.lyrics.support]) : [];
  const lyricItems = cleanLyricThemeLabels(allLyricItems);
  const interpretationLines = [
    `이 곡은 ${intent.genreDirection}입니다.`,
    instruments.length > 0 ? `${quoteList(instruments, 3)} 사운드를 중심으로 곡의 기본 색을 잡습니다.` : "선택한 장르에 맞는 기본 사운드가 중심이 됩니다.",
    intent.vocalDirection || "보컬은 장르와 분위기에 맞춰 자연스럽게 정리됩니다.",
    lyricItems.length > 0 ? `${quoteList(lyricItems, 4)} 주제와 어울려 전체 감정 방향이 정리됩니다.` : `${intent.moodColor}`,
  ];

  const atmosphereSummary = buildAtmosphereSummary(moodItems, textureItems, lyricItems);

  const lyricLines = [
    intent.lyricDirection,
  ];

  const pointsToNote = intent.warnings.length > 0 ? [...intent.warnings, DEFAULT_NOTE] : [DEFAULT_NOTE];

  return {
    genreStr: intent.genreDirection,
    interpretationSummary: sentenceList(unique(interpretationLines)),
    expectedAtmosphere: atmosphereSummary,
    expectedVocals: intent.vocalDirection || "보컬은 선택한 장르와 분위기에 맞춰 자연스럽게 정리됩니다.",
    expectedArrangement: intent.arrangementFlow,
    expectedLyrics: sentenceList(unique(lyricLines)),
    pointsToNote,
  };
}
