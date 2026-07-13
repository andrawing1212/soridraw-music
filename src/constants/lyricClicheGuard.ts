export type ClicheGuardMode = 'hardBan' | 'softBan';

export type ClicheTerm = {
  ko: string;
  en?: string[];
  mode: ClicheGuardMode;
  reason: string;
};

export type DynamicClicheGuardSettings = {
  hardBanTerms?: string[];
  softBanTerms?: string[];
};

export type RuntimeClicheGuardSettings = {
  global?: DynamicClicheGuardSettings | null;
  user?: DynamicClicheGuardSettings | null;
};

export type ClicheGuardConfig = {
  recentSongLimit: number;
  maxRecentTitleSimilarity: number;
  maxRepeatedLyricTerms: number;
  titleMinCoreTermLength: number;
  lyricMinCoreTermLength: number;
};

export const CLICHE_GUARD_CONFIG: ClicheGuardConfig = {
  recentSongLimit: 5,
  maxRecentTitleSimilarity: 0.62,
  maxRepeatedLyricTerms: 12,
  titleMinCoreTermLength: 2,
  lyricMinCoreTermLength: 2,
};

export const HARD_BAN_CLICHE_TERMS: ClicheTerm[] = [
  { ko: '미로', en: ['maze', 'labyrinth'], mode: 'hardBan', reason: '헤매는 감정의 AI식 고정 은유' },
  { ko: '궤도', en: ['orbit'], mode: 'hardBan', reason: '관계/집착 표현에서 반복되는 AI식 은유' },
  { ko: '네온사인', en: ['neon sign', 'neon signs', 'neon light', 'neon lights'], mode: 'hardBan', reason: '도시 밤 분위기의 과사용 클리셰' },
  { ko: '새벽달', en: ['midnight moon', 'dawn moon'], mode: 'hardBan', reason: '새벽 감성의 과사용 클리셰' },
  { ko: '시계 초침', en: ['clock hands', 'ticking clock'], mode: 'hardBan', reason: '시간 정지/흐름 표현의 과사용 클리셰' },
  { ko: '심장 박동', en: ['heartbeat'], mode: 'hardBan', reason: '격정 감정 표현의 과사용 클리셰' },
  { ko: '맥박', en: ['pulse'], mode: 'hardBan', reason: '심장 박동 계열 반복 표현' },
  { ko: '신기루', en: ['mirage'], mode: 'hardBan', reason: '허무한 사랑/꿈의 AI식 고정 은유' },
  { ko: '캔버스', en: ['canvas'], mode: 'hardBan', reason: '마음을 그린다는 식의 AI식 은유' },
  { ko: '퍼즐', en: ['puzzle'], mode: 'hardBan', reason: '관계 조각 맞추기 클리셰' },
  { ko: '심연', en: ['abyss'], mode: 'hardBan', reason: '깊은 슬픔/어둠의 과장 은유' },
  { ko: '운명', en: ['destiny', 'fate'], mode: 'hardBan', reason: '인연 과장 표현의 클리셰' },
  { ko: '혼돈', en: ['chaos'], mode: 'hardBan', reason: '복잡한 심리의 추상 과장 표현' },
  { ko: '파편', en: ['fragment', 'fragments', 'shard', 'shards'], mode: 'hardBan', reason: '깨진 기억/마음의 AI식 반복 은유' },
  { ko: '되감기', en: ['rewind'], mode: 'hardBan', reason: '회상 장면의 과사용 표현' },
  { ko: '메아리', en: ['echo'], mode: 'hardBan', reason: '대답 없는 감정의 과사용 은유' },
];

export const SOFT_BAN_CLICHE_TERMS: ClicheTerm[] = [
  { ko: '우주', en: ['cosmos', 'universe'], mode: 'softBan', reason: '사용자 핵심 배경일 때만 허용' },
  { ko: '그림자', en: ['shadow'], mode: 'softBan', reason: '과거/슬픔 비유로 임의 사용 시 금지' },
  { ko: '숨결', en: ['breath'], mode: 'softBan', reason: '가까운 거리/설렘 묘사 클리셰' },
  { ko: '온기', en: ['warmth'], mode: 'softBan', reason: '위로/그리움의 직접 단어 반복 방지' },
  { ko: '눈물', en: ['tear', 'tears', 'teardrop', 'teardrops'], mode: 'softBan', reason: '슬픔을 직접 시각화하는 과사용 표현' },
  { ko: '전율', en: ['thrill', 'shiver'], mode: 'softBan', reason: '격정 구간의 신체 반응 클리셰' },
  { ko: '속삭임', en: ['whisper'], mode: 'softBan', reason: '비밀스러운 분위기의 과사용 표현' },
  { ko: '불꽃', en: ['spark', 'sparks', 'flame'], mode: 'softBan', reason: '열정/시선 표현의 과사용 은유' },
  { ko: '차가운 공기', en: ['cold air'], mode: 'softBan', reason: '이별/고독 배경 클리셰' },
  { ko: '손끝', en: ['fingertip', 'fingertips'], mode: 'softBan', reason: '닿을 듯 말 듯한 애틋함 클리셰' },
  { ko: '끝없는', en: ['endless', 'infinite'], mode: 'softBan', reason: '거리/밤/바다 앞 추상 수식어 반복 방지' },
  { ko: '영원히', en: ['forever'], mode: 'softBan', reason: '다짐/사랑 과장 표현' },
  { ko: '찰나', en: ['moment', 'flash'], mode: 'softBan', reason: '순간 감정의 과사용 표현' },
  { ko: '아득한', en: ['distant'], mode: 'softBan', reason: '기억/거리 묘사의 추상 반복어' },
  { ko: '공허', en: ['emptiness', 'void'], mode: 'softBan', reason: '마음 상태 직접 명사화 방지' },
  { ko: '경계', en: ['boundary', 'border'], mode: 'softBan', reason: '너와 나/현실과 비현실의 추상 클리셰' },
  { ko: '안개', en: ['fog', 'mist'], mode: 'softBan', reason: '오묘한 분위기 묘사의 과사용 자연물' },
  { ko: '폭풍우', en: ['storm'], mode: 'softBan', reason: '갈등 고조의 날씨 클리셰' },
  { ko: '바람', en: ['wind', 'breeze'], mode: 'softBan', reason: '감정이 스친다는 식의 과사용 표현' },
  { ko: '파도', en: ['wave', 'waves'], mode: 'softBan', reason: '밀려오는 감정 비유 클리셰' },
  { ko: '가시나무', en: ['thorn', 'thorns'], mode: 'softBan', reason: '상처의 직접 은유' },
  { ko: '낙엽', en: ['fallen leaves'], mode: 'softBan', reason: '가을/이별의 과사용 소품' },
  { ko: '가로등', en: ['streetlight', 'street light'], mode: 'softBan', reason: '외로움 배경의 과사용 소품' },
  { ko: '빗물', en: ['raindrop', 'raindrops', 'shower'], mode: 'softBan', reason: '눈물 대체 날씨 클리셰' },
  { ko: '노을', en: ['sunset'], mode: 'softBan', reason: '하루의 끝/아쉬움 클리셰' },
  { ko: '독백', en: ['monologue'], mode: 'softBan', reason: '감정 직접 발화 클리셰' },
  { ko: '헤매다', en: ['wander', 'roam'], mode: 'softBan', reason: '상실/미로 계열 반복 행동' },
  { ko: '스쳐 가다', en: ['pass by'], mode: 'softBan', reason: '인연 엇갈림의 과사용 표현' },
  { ko: '움켜쥐다', en: ['clutch', 'hold tight'], mode: 'softBan', reason: '기억/손을 쥐는 감정 과장 표현' },
  { ko: '흩어지다', en: ['scatter', 'fade'], mode: 'softBan', reason: '기억/연기 사라짐 클리셰' },
  { ko: '주저앉다', en: ['collapse', 'fall'], mode: 'softBan', reason: '좌절 장면의 과장 행동' },
  { ko: '마주보다', en: ['confront', 'face'], mode: 'softBan', reason: '진실/서로를 향하는 과사용 표현' },
  { ko: '물들다', en: ['stain', 'dye'], mode: 'softBan', reason: '감정/노을에 물든다는 클리셰' },
  { ko: '묻어두다', en: ['bury', 'hide'], mode: 'softBan', reason: '비밀/아픔을 감추는 과사용 표현' },
];

export const TITLE_CLICHE_PATTERNS = [
  '* 없는 밤',
  '그 *의 끝',
  '*이 지나면',
  '*라는 이름',
];

export const LYRIC_CLICHE_GUARD = {
  config: CLICHE_GUARD_CONFIG,
  hardBanTerms: HARD_BAN_CLICHE_TERMS,
  softBanTerms: SOFT_BAN_CLICHE_TERMS,
  titleClichePatterns: TITLE_CLICHE_PATTERNS,
};

function normalizeClicheTermText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\[\]{}]/g, ' ')
    .replace(/["“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

export function normalizeClicheTermList(value: unknown, limit = 80): string[] {
  const rawItems = Array.isArray(value)
    ? value.flatMap((item) => String(item ?? '').split(/[\n,]/g))
    : String(value ?? '').split(/[\n,]/g);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of rawItems) {
    const cleaned = normalizeClicheTermText(item);
    if (!cleaned || cleaned.length > 32) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= limit) break;
  }

  return result;
}

function formatTermList(terms: ClicheTerm[], limit = 60): string {
  return terms
    .slice(0, limit)
    .map((term) => {
      const english = term.en?.length ? ` (${term.en.slice(0, 3).join(' / ')})` : '';
      return `${term.ko}${english}`;
    })
    .join(', ');
}

function formatDynamicTermList(terms: string[], limit = 80): string {
  return normalizeClicheTermList(terms, limit).join(', ');
}

function readRuntimeClicheSettings(params?: any): RuntimeClicheGuardSettings {
  const direct = params?.lyricClicheGuard || params?.clicheGuard || {};
  return {
    global: direct.global || params?.globalLyricClicheGuard || null,
    user: direct.user || params?.userLyricClicheGuard || params?.personalLyricClicheGuard || null,
  };
}

function normalizeClicheTermKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s"'“”‘’.,!?…·:;()[\]{}<>/\\|_\-]+/g, '')
    .trim();
}

function builtInHardBanStrings(): string[] {
  return HARD_BAN_CLICHE_TERMS.flatMap((term) => [term.ko, ...(term.en ?? [])]);
}

function builtInSoftBanStrings(): string[] {
  return SOFT_BAN_CLICHE_TERMS.flatMap((term) => [term.ko, ...(term.en ?? [])]);
}

function expandKnownClicheAliases(terms: string[]): string[] {
  const requestedKeys = new Set(terms.map(normalizeClicheTermKey).filter(Boolean));
  const known = [...HARD_BAN_CLICHE_TERMS, ...SOFT_BAN_CLICHE_TERMS];
  const expanded = [...terms];

  known.forEach((entry) => {
    const aliases = [entry.ko, ...(entry.en ?? [])];
    if (aliases.some((alias) => requestedKeys.has(normalizeClicheTermKey(alias)))) {
      expanded.push(...aliases);
    }
  });

  return expanded;
}

export function resolveLyricClicheGuardTerms(params?: any): {
  hardBanTerms: string[];
  softBanTerms: string[];
  globalHard: string[];
  globalSoft: string[];
  userHard: string[];
  userSoft: string[];
} {
  const runtime = readRuntimeClicheSettings(params);
  const globalHard = normalizeClicheTermList(runtime.global?.hardBanTerms ?? []);
  const globalSoft = normalizeClicheTermList(runtime.global?.softBanTerms ?? []);
  const userHard = normalizeClicheTermList(runtime.user?.hardBanTerms ?? []);
  const userSoft = normalizeClicheTermList(runtime.user?.softBanTerms ?? []);

  const dynamicHardWithAliases = expandKnownClicheAliases([...globalHard, ...userHard]);
  const hardBanTerms = normalizeClicheTermList([
    ...builtInHardBanStrings(),
    ...dynamicHardWithAliases,
  ], 240);
  const hardKeys = new Set(hardBanTerms.map(normalizeClicheTermKey).filter(Boolean));
  const softBanTerms = normalizeClicheTermList([
    ...builtInSoftBanStrings(),
    ...globalSoft,
    ...userSoft,
  ], 240).filter((term) => !hardKeys.has(normalizeClicheTermKey(term)));

  return {
    hardBanTerms,
    softBanTerms,
    globalHard,
    globalSoft: globalSoft.filter((term) => !hardKeys.has(normalizeClicheTermKey(term))),
    userHard,
    userSoft: userSoft.filter((term) => !hardKeys.has(normalizeClicheTermKey(term))),
  };
}

export type LyricHardBanViolation = {
  lineIndex: number;
  term: string;
  line: string;
};

function isLyricSectionTagLine(value: string): boolean {
  return /^\s*\[[^\]]+\]\s*$/.test(String(value || ''));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsLatinHardBanTerm(line: string, term: string): boolean {
  const normalizedLine = String(line || '').normalize('NFKC').toLowerCase();
  const normalizedTerm = String(term || '').normalize('NFKC').toLowerCase().trim();
  if (!normalizedTerm) return false;
  const phrasePattern = normalizedTerm
    .split(/\s+/g)
    .map(escapeRegExp)
    .join('[\\s_\\-]+');
  return new RegExp(`(^|[^a-z0-9])${phrasePattern}($|[^a-z0-9])`, 'i').test(normalizedLine);
}

function containsHardBanTerm(line: string, term: string): boolean {
  const rawTerm = String(term || '').normalize('NFKC').trim();
  if (!rawTerm) return false;
  const isLatinOnly = /[a-z]/i.test(rawTerm) && !/[가-힣ㄱ-ㅎㅏ-ㅣ一-龥ぁ-ゟ゠-ヿ]/.test(rawTerm);
  if (isLatinOnly) return containsLatinHardBanTerm(line, rawTerm);

  const normalizedLine = String(line || '').normalize('NFKC').toLowerCase();
  const normalizedTerm = rawTerm.toLowerCase();
  if (normalizedLine.includes(normalizedTerm)) return true;

  // Multi-part phrases such as "시계 초침" may contain variable whitespace.
  // Single short words such as "네온" must not match across unrelated words
  // (for example "네 온기가"), so compact matching is limited to longer compounds.
  if (/\s/.test(normalizedTerm)) {
    const phrasePattern = normalizedTerm
      .split(/\s+/g)
      .map(escapeRegExp)
      .join('[\\s"\'“”‘’.,!?…·:;()\\[\\]{}<>/\\\\|_\\-]*');
    return new RegExp(phrasePattern, 'i').test(normalizedLine);
  }

  const termKey = normalizeClicheTermKey(normalizedTerm);
  return termKey.length >= 4 && normalizeClicheTermKey(normalizedLine).includes(termKey);
}

export function findLyricHardBanViolations(lyrics: unknown, params?: any): LyricHardBanViolation[] {
  const source = String(lyrics ?? '').replace(/\r\n?/g, '\n');
  if (!source.trim()) return [];
  const { hardBanTerms } = resolveLyricClicheGuardTerms(params);
  if (!hardBanTerms.length) return [];

  const violations: LyricHardBanViolation[] = [];
  source.split('\n').forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed || isLyricSectionTagLine(trimmed)) return;
    hardBanTerms.forEach((term) => {
      if (containsHardBanTerm(line, term)) {
        violations.push({ lineIndex, term, line });
      }
    });
  });

  const seen = new Set<string>();
  return violations.filter((item) => {
    const key = `${item.lineIndex}:${normalizeClicheTermKey(item.term)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeRecentTitleForGuard(value: unknown): string {
  return String(value ?? '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/["'“”‘’]/g, '')
    .replace(/\s*[|│]\s*/g, ' / ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);
}

export function normalizeRecentMoodThemeMemoryForGuard(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 260);
}

export function buildRecentTitleAntiRepeatInstruction(recentTitles: unknown[] = []): string {
  const cleaned = Array.from(
    new Set(
      recentTitles
        .map(normalizeRecentTitleForGuard)
        .filter((title) => title.length >= 2),
    ),
  ).slice(0, CLICHE_GUARD_CONFIG.recentSongLimit);

  if (!cleaned.length) {
    return `TITLE SAFETY:
- Do not use a generic AI title formula. Keep the title grounded in the current song idea.`;
  }

  return `TITLE SAFETY:
- Do not reuse these recent titles exactly: ${cleaned.join(' / ')}.
- Do not over-control the title. If a recent word is necessary for the current theme, it may be used naturally.`;
}

export function buildRecentMoodThemeDirectionGuardInstruction(recentMoodThemeMemory: unknown[] = [], params?: any): string {
  const cleaned = Array.from(
    new Set(
      recentMoodThemeMemory
        .map(normalizeRecentMoodThemeMemoryForGuard)
        .filter((item) => item.length >= 4),
    ),
  ).slice(0, CLICHE_GUARD_CONFIG.recentSongLimit);

  const currentMood = Array.isArray(params?.moods) ? params.moods.filter(Boolean).join(' / ') : String(params?.mood ?? '').trim();
  const currentTheme = Array.isArray(params?.themes) ? params.themes.filter(Boolean).join(' / ') : String(params?.theme ?? '').trim();

  const recentBlock = cleaned.length
    ? `Recent 5 mood/theme memories:\n${cleaned.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
    : 'No recent mood/theme memories were provided.';

  return `RECENT 5 MOOD/THEME DIRECTION GUARD (MANDATORY):
Current mood: ${currentMood || 'none'}
Current theme: ${currentTheme || 'none'}
${recentBlock}

Use this only to avoid repeating the same creative direction, not to ban ordinary words.
If the current song has the same mood+theme, same mood, or same theme as one of the recent 5 songs, change at least one of these: speaker angle, situation, title angle, hook idea, emotional turn, or ending direction.
Do not copy a recent song's main scene, conflict, title formula, hook attitude, or ending feeling.
Do not force strange replacement words. Keep lyrics natural and let Gemini write freely inside the current theme/mood.`;
}

export function buildLyricClicheGuardInstruction(params?: any): string {
  const resolved = resolveLyricClicheGuardTerms(params);
  const hardText = formatDynamicTermList(resolved.hardBanTerms, 240) || 'none';
  const softText = formatDynamicTermList(resolved.softBanTerms, 240) || 'none';

  return `LYRIC CLICHE GUARD — ABSOLUTE HARD BAN:
- HARD BAN TERMS: ${hardText}.
- None of the hard-ban terms may appear in lyric-body lines. This rule also applies when the same term is present in the user draft, director note, selected theme, or another instruction.
- Preserve the intended meaning by rewriting the whole phrase naturally with a context-appropriate alternative. Never merely delete the word, leave a broken particle/ending, or create an awkward evasive sentence.
- Avoid spacing variants and obvious direct variants of the same hard-ban expression.
- HardBan always overrides SoftBan when a term appears in both lists.

SOFT AVOID TERMS: ${softText}.
- Do not introduce soft-avoid terms by habit. They may be used only when they are the user's genuine selected subject/background and no natural alternative preserves the intended specificity.
- Keep Korean and every selected lyric language natural, singable, and connected. Do not expose this rule in the lyrics.`;
}

export function normalizeRecentLyricSnippetForGuard(value: unknown): string {
  return String(value ?? '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[()（）][^()（）]{0,80}[()（）]/g, ' ')
    .replace(/[\r\n\t]+/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 360);
}

export function buildRecentLyricAntiRepeatInstruction(recentMoodThemeMemory: unknown[] = [], params?: any): string {
  return [
    buildLyricClicheGuardInstruction(params),
    buildRecentMoodThemeDirectionGuardInstruction(recentMoodThemeMemory, params),
  ].join('\n\n');
}
