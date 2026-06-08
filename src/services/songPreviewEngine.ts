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
  selectedMoods: string[];
  selectedThemes: string[];
  selectedVocalTags: string[];
  selectedVocalCharacter?: any;
  selectedSections?: any[];
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

function compactText(value?: string | null): string {
  return (value || "")
    .replace(/\*\*/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\(([A-Za-z0-9_.,&/\-\s]+)\)/g, "")
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

function buildVocalSummary(input: PreviewInput, moodLabels: string[], genreLabels: string[]): string {
  if (!input.includeLyrics) return "연주 전용 설정이라 노래 보컬은 중심에 두지 않습니다.";

  const members = input.vocalMembers || [];
  const directParts: string[] = [];

  if (members.length > 0) {
    const maleCount = members.filter((m) => m.gender === "male").length;
    const femaleCount = members.filter((m) => m.gender === "female").length;
    if (members.length === 1) {
      directParts.push(`${members[0].gender === "male" ? "남성" : "여성"} 솔로 보컬`);
    } else if (maleCount > 0 && femaleCount > 0) {
      directParts.push("남녀가 함께 부르는 보컬 구성");
    } else if (members.length === 2) {
      directParts.push(`${maleCount > 0 ? "남성" : "여성"} 듀엣`);
    } else {
      directParts.push(`${members.length}인 보컬 그룹`);
    }

    const first = members[0];
    const tone = first.toneId ? VOCAL_TONES.find((t: any) => t.id === first.toneId) : undefined;
    if (tone) directParts.push(`${tone.labelKo || tone.label} 톤`);

    const char = first.character;
    if (char) {
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
      if (char.deliveryLevel !== undefined && char.deliveryLevel <= 3) {
        directParts.push("숨을 많이 섞는 호흡감");
      }
      if (char.rangeLevel !== undefined) {
        if (char.rangeLevel >= 8) directParts.push("높게 열리는 음역");
        else if (char.rangeLevel <= 3) directParts.push("낮고 가까운 음역");
      }
    }
  }

  if (input.rapEnabled || members.some((m) => m.roles?.includes("rapper"))) {
    directParts.push("랩 흐름");
  }

  if (directParts.length > 0) {
    const main = joinKo(take(directParts, 4));
    return `${main}을 중심으로, ${genreLabels[0] || "선택한 장르"} 안에서 감정을 전달합니다.`;
  }

  const moodText = moodLabels.length > 0 ? `${joinKo(take(moodLabels, 2))} 분위기에 맞춰` : "곡 분위기에 맞춰";
  return `${moodText} 장르에 어울리는 자연스러운 보컬 톤으로 정리됩니다.`;
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

function styleDisplayCue(item: LookupItem | undefined, label: string): string {
  return previewText(item?.descriptionKo || label, label);
}

function soundDisplayCue(item: LookupItem | undefined, label: string): string {
  return previewText(item?.descriptionKo || label, label);
}

function moodDisplayCue(item: LookupItem | undefined, label: string): string {
  return previewText(item?.descriptionKo || label, label);
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
    if (genre?.description) addToPart(parts, "arrangement", genre.description, label);
  });

  (input.selectedStyles || []).forEach((id) => {
    const { item, groupId } = findStyleById(id);
    const label = labelOf(item, id);
    if (!label) return;

    const genreLike = isGenreLike(label, id, groupId || "");
    const vocalLike = isVocalLike(label, id, groupId || "");
    const instrumentLike = isInstrumentLike(label, id);

    const displayCue = styleDisplayCue(item, label);

    if (genreLike && !vocalLike && !instrumentLike) {
      addToPart(parts, "genre", label, label);
      addToPart(parts, "arrangement", displayCue, label);
      return;
    }

    if (instrumentLike || item?.sound) {
      addToPart(parts, "instruments", label, label, true);
    }
    if (vocalLike) {
      addToPart(parts, "vocals", label, label, true);
    }
    if (item?.mood || (!genreLike && !instrumentLike && !vocalLike)) {
      addToPart(parts, "atmosphere", displayCue, label);
    }
    if (item?.style && !vocalLike) {
      addToPart(parts, "arrangement", label, label);
    }
  });

  (input.selectedSounds || []).forEach((id) => {
    const sound = findSoundById(id);
    const label = labelOf(sound, id);
    addToPart(parts, "instruments", label, label, true);
    if (sound?.descriptionKo || sound?.description) addToPart(parts, "atmosphere", soundDisplayCue(sound, label), label);
  });

  (input.selectedMoods || []).forEach((id) => {
    const mood = findMoodById(id);
    const label = labelOf(mood, id);
    addToPart(parts, "atmosphere", label, label, true);
    if (mood?.arrangement) addToPart(parts, "arrangement", moodDisplayCue(mood, label), label);
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

  const vocalSummary = buildVocalSummary(input, [...parts.atmosphere.main, ...parts.atmosphere.support], parts.genre.main);
  addToPart(parts, "vocals", vocalSummary, "보컬 직접 선택", true);

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
  addToPart(parts, "lyrics", lyricLanguageText(input), "가사 옵션", true);

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
    plainMeaning: genre?.description || `${label} 기반의 음악 방향`,
    arrangementImpact: genre?.description,
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
    plainMeaning: item?.descriptionKo || item?.description || label,
    genreImpact: isGenreLike(label, styleId, groupId || "") ? label : undefined,
    instrumentImpact: item?.sound,
    vocalImpact: isVocalLike(label, styleId, groupId || "") ? label : undefined,
    moodImpact: item?.mood,
    arrangementImpact: item?.style,
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

export function buildPreviewSongIntent(input: PreviewInput): PreviewSongIntent {
  const parts = buildPreviewPromptParts(input);
  const genreDirection = genrePhrase(parts.genre.main, parts.genre.support, [...parts.atmosphere.main, ...parts.atmosphere.support]);
  const coreInstruments = take([...parts.instruments.main, ...parts.instruments.support], 4);
  const moodLabels = take([...parts.atmosphere.main, ...parts.atmosphere.support], 4);
  const lyricLabels = take([...parts.lyrics.main, ...parts.lyrics.support], 4);
  const arrangementLabels = take([...parts.arrangement.main, ...parts.arrangement.support], 4);
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

  const arrangementFlow = arrangementLabels.length > 0
    ? `${arrangementLabels[0]}. ${arrangementLabels.slice(1, 3).join(' ')}`.trim()
    : "초반은 무리 없이 시작하고, 후렴에서 선택한 장르의 힘을 조금 더 드러냅니다.";

  const lyricDirection = input.includeLyrics
    ? `${lyricLanguageText(input)}. ${lyricLabels.length > 0 ? `${joinKo(lyricLabels)} 감정을 말투와 후렴 방향에 반영합니다.` : "가사의 말투와 반복 방식은 선택한 장르와 분위기에 맞춥니다."}`
    : lyricLanguageText(input);

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
  const moodItems = parts ? take([...parts.atmosphere.main, ...parts.atmosphere.support], 3) : [];
  const lyricItems = parts ? take([...parts.lyrics.main, ...parts.lyrics.support], 3) : [];
  const arrangementItems = parts ? take([...parts.arrangement.main, ...parts.arrangement.support], 3) : [];

  const interpretationLines = [
    `이 곡은 ${intent.genreDirection}입니다.`,
    instruments.length > 0 ? `${joinKo(instruments)}가 주요 사운드로 쓰입니다.` : "선택한 장르에 맞는 기본 사운드가 중심이 됩니다.",
    intent.vocalDirection ? `${intent.vocalDirection}` : "보컬은 장르와 분위기에 맞춰 자연스럽게 정리됩니다.",
    `${intent.moodColor}`,
  ];

  const atmosphereLines = [
    moodItems.length > 0 ? `${joinKo(moodItems)} 느낌이 곡의 공기를 만듭니다.` : "선택한 장르와 사운드에 맞춰 분위기가 잡힙니다.",
    instruments.length > 0 ? `${joinKo(instruments.slice(0, 2))}가 그 분위기를 실제 소리로 받쳐줍니다.` : "악기와 질감은 분위기를 해치지 않는 방향으로 정리됩니다.",
    lyricItems.length > 0 ? `${joinKo(lyricItems)} 감정이 분위기의 중심에 놓입니다.` : "주제는 가사 사건을 억지로 만들기보다 감정 방향으로만 반영됩니다.",
  ];

  const arrangementLines = [
    arrangementItems[0] || "초반은 선택한 장르의 기본 흐름으로 시작합니다.",
    arrangementItems[1] || "중반과 후렴에서는 핵심 사운드가 조금 더 앞으로 나옵니다.",
    arrangementItems[2] || "마지막은 곡의 분위기를 유지하며 자연스럽게 마무리됩니다.",
  ];

  const lyricLines = [
    intent.lyricDirection,
  ];

  const pointsToNote = intent.warnings.length > 0 ? [...intent.warnings, DEFAULT_NOTE] : [DEFAULT_NOTE];

  return {
    genreStr: intent.genreDirection,
    interpretationSummary: unique(interpretationLines).join(" "),
    expectedAtmosphere: unique(atmosphereLines).join(" "),
    expectedVocals: intent.vocalDirection || "보컬은 선택한 장르와 분위기에 맞춰 자연스럽게 정리됩니다.",
    expectedArrangement: unique(arrangementLines).join(" "),
    expectedLyrics: unique(lyricLines).join(" "),
    pointsToNote,
  };
}
