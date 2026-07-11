export type ClicheGuardMode = 'hardBan' | 'softBan';

export type ClicheTerm = {
  ko: string;
  en?: string[];
  mode: ClicheGuardMode;
  reason: string;
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

function formatTermList(terms: ClicheTerm[], limit = 60): string {
  return terms
    .slice(0, limit)
    .map((term) => {
      const english = term.en?.length ? ` (${term.en.slice(0, 3).join(' / ')})` : '';
      return `${term.ko}${english}`;
    })
    .join(', ');
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

export function buildLyricClicheGuardInstruction(): string {
  return `BASIC AI CLICHE GUARD (LIGHTWEIGHT):
Avoid obvious AI lyric/poetry clichés as automatic metaphors.
Hard avoid: ${formatTermList(HARD_BAN_CLICHE_TERMS)}.
Soft avoid unless the user explicitly made it the real subject/background: ${formatTermList(SOFT_BAN_CLICHE_TERMS)}.
This is not a general word blacklist. Do not replace natural Korean with weird evasive words. If a term is truly required by the user's explicit theme, keep it natural.`;
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
    buildLyricClicheGuardInstruction(),
    buildRecentMoodThemeDirectionGuardInstruction(recentMoodThemeMemory, params),
  ].join('\n\n');
}
