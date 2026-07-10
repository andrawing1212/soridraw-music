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
  recentSongLimit: 10,
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
  { ko: '어스름', en: ['twilight haze', 'dusk haze'], mode: 'hardBan', reason: 'AI식 흐릿한 시적 분위기 표현' },
  { ko: '식탁 모서리', en: ['table corner'], mode: 'hardBan', reason: '일상 소품을 억지 상징으로 쓰는 반복 표현' },
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
  '푸른 *',
  '그 *의 끝',
  '*이 지나면',
  '*의 온도',
  '*의 궤도',
  '*의 그림자',
  '*의 조각',
  '*의 파편',
  '*라는 이름',
];

export const LYRIC_CLICHE_PHRASES = [
  '차가운 밤',
  '푸른 외로움',
  '따뜻한 온기',
  '회색 거리',
  '네온 불빛',
  '멈춘 시간',
  '흩어진 기억',
  '깨진 조각',
  '끝없는 밤',
  '대답 없는 메아리',
  '어스름한 소리',
  '어스름한 새벽',
  '식탁 모서리',
  '반짝이는 불빛',
  '화면 너머',
  '두 번째 칸',
  '새로운 모험',
  '배경 소리',
  '하얀 기기',
  '기기를 쥔 손',
  '첫 장면',
  '마지막 단계',
  '감정 온도',
  '주변 공기',
  '따뜻한 국',
  '식어버린 공기',
  '김 서린 온기',
  '피어오르는 온기',
  '수저 끝에 무겁게',
  '그릇을 스치는 소리',
  '작은 부엌의 저녁식사',
  '빈 그릇을 조용히',
];

export const KOREAN_TRANSLATIONESE_BAN_TERMS = [
  '기기',
  '첫 장면',
  '새로운 모험',
  '배경 소리',
  '하얀 기기',
  '두 번째 칸',
  '화면 너머',
  '마지막 단계',
  '습관이란 게',
  '금방 잊어버릴 장난',
  '화면을 향해 말을 걸',
];

export const KOREAN_EVERYDAY_LANGUAGE_GUARD = [
  'Korean lyric body lines must sound like contemporary spoken Korean, not translated AI prose or textbook Korean.',
  'Do not use vague object words such as “기기” when a normal Korean person would say 폰, 휴대폰, 게임기, 콘솔, 패드, 노트북, or just omit the object.',
  'Do not invent story content from music genre or sound labels. “비디오 게임 음악”, “칩튠”, “덥스텝”, “레이저 효과” describe production only; they do not mean the lyric story is about playing games.',
  'Use concrete nouns only when the object is grounded in the user story. If the object is not grounded, remove the line instead of replacing it with another random prop.',
  'Each Korean line must pass a real-life speech check: would a Korean person actually say or think this in the situation? If not, rewrite it plainly.',
];

export const MOOD_WORD_DIRECT_USE_GUARD = [
  '분위기 선택값을 가사 단어로 직접 복사하지 않는다.',
  '분위기 하위 개념은 가사 단어가 아니라 해석 축이다. 온도, 온기, 공기, 계절, 봄, 여름, 가을, 겨울, 새벽, 오후, 공간, 방, 창가, 모퉁이 같은 단어를 자동으로 가사화하지 않는다.',
  '감정/온도/시간대/계절감/공간감/긴장감/에너지/톤은 반드시 인물의 선택, 말투, 거리, 속도, 침묵, 행동 방식으로 번역한 뒤 반영한다.',
  '색상, 온도, 시간대, 계절, 공간 단어를 반복 훅이나 배경 장식으로 사용하지 않는다.',
];

export const MOOD_DEEP_SEMANTIC_RULES = [
  '감정 = 슬픔/기쁨 같은 단어를 쓰는 것이 아니라, 인물이 지금 무엇을 피하고 무엇을 못 말하는지 정하는 축이다.',
  '온도 = 따뜻함/차가움/온기/공기 같은 단어를 쓰는 것이 아니라, 인물 사이의 거리감, 경계심, 풀림 정도, 말의 부드러움/딱딱함을 정하는 축이다.',
  '시간대 = 새벽 몇 시/오후 몇 시를 자동으로 쓰는 것이 아니라, 행동의 속도, 피로도, 미루는 느낌, 하루의 압력을 정하는 축이다. 사용자가 시간을 직접 주지 않았으면 정확한 시각을 만들지 않는다.',
  '계절감 = 봄/여름/가을/겨울 단어를 쓰는 것이 아니라, 기억의 질감, 생활 리듬, 옷차림/습관의 변화 정도를 정하는 축이다. 사용자가 계절을 주지 않았으면 계절명을 만들지 않는다.',
  '공간감 = 지하실/창가/모퉁이 같은 장소를 새로 만드는 것이 아니라, 가까움/멀어짐, 좁음/넓음, 말소리의 크기, 시선의 방향, 동선의 막힘을 정하는 축이다.',
  '긴장감 = 불안/숨막힘 같은 단어를 쓰는 것이 아니라, 말이 끊기는 정도, 행동이 늦어지는 정도, 서로 눈치를 보는 압력을 정하는 축이다.',
  '에너지 = 힘/에너지라는 단어를 쓰는 것이 아니라, 문장 길이, 행동 속도, 반복 정도, 후렴의 밀도를 정하는 축이다.',
  '톤 = 색감/푸른/회색 같은 시각 단어가 아니라, 말투의 건조함/다정함/비꼼/담담함/장난기 같은 표현 방식을 정하는 축이다.',
];

export const RECENT_REPEAT_GUARD_RULES = [
  '최근 생성 10곡의 제목과 같은 제목을 만들지 않는다.',
  '최근 생성 10곡 제목의 핵심 명사와 같은 제목 구조를 반복하지 않는다.',
  '최근 생성 10곡 가사에서 반복된 소품/은유/배경 명사는 새 가사에서 피한다.',
  '단, 사용자가 직접 입력한 핵심 주제어는 예외로 허용한다.',
];

export const LYRIC_CLICHE_GUARD = {
  config: CLICHE_GUARD_CONFIG,
  hardBanTerms: HARD_BAN_CLICHE_TERMS,
  softBanTerms: SOFT_BAN_CLICHE_TERMS,
  titleClichePatterns: TITLE_CLICHE_PATTERNS,
  lyricClichePhrases: LYRIC_CLICHE_PHRASES,
  moodWordDirectUseGuard: MOOD_WORD_DIRECT_USE_GUARD,
  moodDeepSemanticRules: MOOD_DEEP_SEMANTIC_RULES,
  recentRepeatGuardRules: RECENT_REPEAT_GUARD_RULES,
  koreanTranslationeseBanTerms: KOREAN_TRANSLATIONESE_BAN_TERMS,
  koreanEverydayLanguageGuard: KOREAN_EVERYDAY_LANGUAGE_GUARD,
};

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

export function buildRecentTitleAntiRepeatInstruction(recentTitles: unknown[] = []): string {
  const cleaned = Array.from(
    new Set(
      recentTitles
        .map(normalizeRecentTitleForGuard)
        .filter((title) => title.length >= 2),
    ),
  ).slice(0, CLICHE_GUARD_CONFIG.recentSongLimit);

  if (!cleaned.length) {
    return `RECENT TITLE ANTI-REPEAT:
- No recent titles were provided. Still avoid generic AI title patterns and do not default to cliché poetic title formulas.`;
  }

  const recentTitleList = cleaned
    .map((title, index) => `${index + 1}. ${title}`)
    .join('\n');

  return `RECENT TITLE ANTI-REPEAT (MANDATORY):
The following recent titles are provided ONLY as a similarity blacklist, NOT as examples to imitate:
${recentTitleList}

Title rules:
- Do not reuse any recent title exactly.
- Do not reuse the same main noun, visible object, emotional metaphor, or ending formula from recent titles unless the user explicitly wrote it as the core topic.
- Do not create another title with the same structure such as "~ 없는 밤", "~의 끝", "~이 지나면", "그 ~", "~라는 이름", or another near-clone pattern.
- If the current theme requires a word that appeared in a recent title, keep the theme but choose a different everyday phrase, situation, or spoken sentence as the title.
- After creating the title, compare it against the recent titles above. If it feels like a sibling copy, rewrite only the title before returning JSON.`;
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

export function buildRecentLyricAntiRepeatInstruction(_recentLyricSnippets: unknown[] = []): string {
  return `LYRIC MINIMAL TEST MODE (MANDATORY):
- For this test, do not apply the cliche blacklist, recent-lyric anti-repeat rules, mood deep-semantic rules, prop-extraction rules, or over-detailed lyric safety rules.
- Write the lyrics mainly from the user's selected theme, mood, vocal intent, and direct input.
- Keep the scene coherent and natural. Do not force objects, metaphors, instruments, genre words, or production terms into the lyric body.
- Korean lyrics must sound like a real Korean person would say or remember the situation in plain contemporary Korean.
- Keep the requested section tag format and language rules. Do not add explanations outside the lyrics.`;
}
