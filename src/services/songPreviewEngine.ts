// src/services/songPreviewEngine.ts

import {
  GENRE_HIERARCHY,
  GENRES,
  STYLE_CYCLES,
  VOCAL_TECHNIQUES,
  VOCAL_VOICE_TONES,
  VOCAL_PERSONALITIES,
} from "../constants";
import { VOCAL_TONES } from "../constants/vocalTones";
import { VocalMember, SituationConfig } from "../types";

/**
 * -------------------------------------------------------------
 * 1. CORE ENGINE TYPES
 * -------------------------------------------------------------
 */

export type PreviewKeywordCategory =
  | 'genre'
  | 'style'
  | 'sound'
  | 'mood'
  | 'theme'
  | 'vocal'
  | 'vocal_technique'
  | 'tempo'
  | 'structure'
  | 'lyrics';

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

  // 스타일 특화 해석 필드
  styleEra?: string;          // 시대감
  styleArrangement?: string;  // 편곡 결
  styleSoundColor?: string;   // 사운드 색
  styleAppeal?: string;       // 대중성/실험성
  styleFusionImpact?: string; // 장르 조합시 퓨전 방향
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

export interface PreviewSongIntent {
  genreDirection: string;
  fusionDirection: string;
  styleFusionDirection: string;       // 추가: 스타일 장르 퓨전 방향
  finalGenreInterpretation: string;   // 추가: 최종 결합된 자연어 해석 요약
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


/**
 * -------------------------------------------------------------
 * 2. CURATED FINE-TUNED MUSIC INTERPRETATION DATASET
 * -------------------------------------------------------------
 * 특정 핵심 키워드에 대해 더 깊은 뉘앙스를 심어두기 위한 데이터셋입니다.
 * 없는 경우, 헬퍼에서 동적으로 constants 데이터로부터 생성 및 보완합니다.
 */

export const PREVIEW_MEANING_DATASET: Record<string, PreviewMeaningData> = {
  // Genres
  "uk_garage_rnb": {
    id: "uk_garage_rnb",
    label: "UK 개러지 R&B",
    category: "genre",
    musicalRole: "세련된 도시 밤거리가 떠오르는 댄서블 R&B",
    plainMeaning: "잘게 쪼개지는 투스텝 개러지 드럼 비트와 부드러운 R&B 보컬 멜로디의 융합",
    genreImpact: "정통 R&B의 솔풀한 코드 진행에 영국 클럽 댄스 그루브가 이식되어 트렌디한 질감 형성",
    rhythmImpact: "싱코페이션(당김음)이 살아있는 리드미컬하고 속도감 있는 리듬 루프",
    instrumentImpact: "묵직하고 따뜻한 서브 베이스, 감성적 패드 신스, 가볍게 날리는 림샷과 하이햇",
    vocalImpact: "그루브를 타는 세련된 멜로디 싱잉과 리듬 속 잔잔한 코러스 백킹",
    arrangementImpact: "드럼 비트가 빠졌다가 순식간에 차오르는 빌드업과 드롭의 세련된 조율",
    lyricImpact: "도시의 밤, 미묘한 속삭임, 엇갈리는 이끌림에 초점을 맞춘 감각적이고 함축적인 메타포",
    moodImpact: "시크함과 쓸쓸함이 공존하며 춤추면서도 한편으로는 아련해지는 독특한 야행성 무드",
    energyImpact: "낮은 보컬 톤과 대조되는 경쾌하고 높은 비트 스피드로 중간-높음급 에너지 균형 유지",
    tempoImpact: "BPM 120-135 사이의 질주하면서도 여유로운 템포 권장",
    weight: 1.5,
    pairsWellWith: ["hollow", "lingering_attachment", "vocal-whisper-expression"]
  },
  "acoustic_rnb": {
    id: "acoustic_rnb",
    label: "어쿠스틱 R&B",
    category: "genre",
    musicalRole: "인접형 프라이빗 오디토리움 스튜디오 감정선",
    plainMeaning: "컴퓨터 사운드를 덜어내고 통기타나 피아노 등 실제 목재 악기 터치 위에 R&B 싱잉을 얹는 스타일",
    genreImpact: "인공적 트랙을 철저히 배제하고 미니멀한 편성으로 가창자와 연주자의 날 것 그대로의 합을 보장",
    rhythmImpact: "과한 타격 대신 부드러운 스냅이나 어쿠스틱 드럼 브러시가 만드는 편안하고 느슨한 싱킹",
    instrumentImpact: "내추럴 울림이 고운 통기타 스트럼과 아르페지오, 따뜻한 우드 베이스",
    vocalImpact: "마이크 아주 가까이서 호흡과 비브라토를 섬세히 전달하는 초밀접 다이내믹 보컬",
    arrangementImpact: "가창자의 감정선에 악기 터치수가 극히 기민하게 반응하는 완전 밀접형 전개",
    lyricImpact: "방 안에서의 가벼운 대화, 일상적 고백, 조용한 성찰 등 장식 없는 정직한 일상형 구어체와 독백",
    moodImpact: "화려하지 않고 수수한 소박함, 집 같은 아늑함과 은은하게 스며드는 눈물",
    energyImpact: "몸을 진정시키는 편안하고 낮은 에너지를 유지하되 따뜻함 유지",
    tempoImpact: "BPM 70-90 사이의 조용하고 흐르는 템포 지향",
    weight: 1.4,
    pairsWellWith: ["warm", "confession", "vocal-spoken-singing"]
  },
  "acoustic_folk": {
    id: "acoustic_folk",
    label: "어쿠스틱 포크",
    category: "genre",
    musicalRole: "이야기를 전하는 목소리와 빈티지 어쿠스틱 무드",
    plainMeaning: "화려한 코드가 아닌 기본적 삼화음 기타 플레이 위에 진솔하게 이야기를 읊조리는 포크 송",
    genreImpact: "음악 기교가 아닌 서사와 어조 중심의 본질에 다가선 유기적 사운드",
    rhythmImpact: "자연적인 기타 스트러밍 비트가 만드는 잔잔하고 흐르는 호흡",
    instrumentImpact: "건조하고 솔직한 어쿠스틱 통기타 솔로, 부드러운 더블링 베이스, 미니멀 퍼커션",
    vocalImpact: "꾸밈없고 정직하며, 기교를 극단적으로 배제한 담백하고 청초한 전달력",
    arrangementImpact: "벌스와 코러스의 급격한 다이내믹 대비 없이 완만한 흐름의 이야기 전개",
    lyricImpact: "풍경 묘사, 흐르는 시간, 성장의 깨달음, 오랜 친구를 향한 진심 어린 위로",
    moodImpact: "어스름한 새벽이나 노을빛을 담은 듯한 아스라한 향수와 평온함, 치유적 공감",
    energyImpact: "인간 본연의 따뜻함이 전하는 지극히 편안하고 편안한 저에너지",
    tempoImpact: "BPM 65-85 사이의 자연스럽고 인간적인 루바토 템포 선호",
    weight: 1.3,
    pairsWellWith: ["warm", "growth", "vocal-spoken-singing"]
  },

  // Moods
  "hollow": {
    id: "hollow",
    label: "공허한",
    category: "mood",
    musicalRole: "소리의 외벽을 비워내고 남겨둔 잔향의 감정선",
    plainMeaning: "밀도를 가득 채우지 않고 여백을 넓혀 쓸쓸함을 자극하는 청각 무드",
    genreImpact: "어떤 장르가 오든 과한 코러스 화음을 금지하고 악기 리버브 잔향의 길이를 늘려 고독감 형성",
    rhythmImpact: "중간중간 박자를 멈추거나 딜레이 효과를 줘서 다음 리듬까지의 거리를 멀게 배치",
    instrumentImpact: "밝은 신스가 아닌 깊은 저음 패드, 톤이 다운된 피아노, 공간감 있는 메아리 음색",
    vocalImpact: "쓸쓸함이 배인 한숨 섞인 공기(Airy)와 담담하게 한 음씩 내려놓는 차분한 표현",
    moodImpact: "도시 가로등 아래 혼자 서 있는 듯한 내적 고독과 쓸쓸한 공기",
    energyImpact: "차갑고 낮게 정체된 가라얹는 에너지 상태 유지",
    weight: 1.2
  },
  "warm": {
    id: "warm",
    label: "따뜻한",
    category: "mood",
    musicalRole: "둥글고 포근한 파형으로 채운 심리적 안전지대",
    plainMeaning: "귀를 찌르는 날카로운 고역대를 깎아내고 포근한 미드레인지 음역대로 안도감을 선물하는 사운드",
    genreImpact: "금속성의 차가운 전자음 대신 아날로그 신스나 어쿠스틱 현의 둥근 결을 활성화",
    rhythmImpact: "모서리가 둥글게 가공된 킥과 쉐이커처럼 기분 좋게 굴러가는 온화한 그루브",
    instrumentImpact: "빈티지 일렉 피아노(EP), 나일론 기타, 하이햇을 대신하는 소프트 퍼커션",
    vocalImpact: "목소리에 따스한 체온이 서려 있는 온화하고 부드러운 가창 어조와 풍부한 중음역 보이스",
    moodImpact: "난로 앞 아늑한 소파에 앉아 나누는 은은한 위로와 기댈 수 있는 따뜻한 정서",
    energyImpact: "몸을 릴렉스시키는 기분 좋은 미온의 중-저에너지 상태 안정화",
    weight: 1.1
  },
  "uneasy": {
    id: "uneasy",
    label: "불안한",
    category: "mood",
    musicalRole: "해결되지 않는 불안정 코드가 풍기는 극적 긴장 레이어",
    plainMeaning: "으뜸화음으로 시원하게 안착하지 않고 다소 불안정한 반감음이나 이탈음이 주는 스릴 질감",
    genreImpact: "안정적인 팝 머니코드를 탈피하여 몽롱하고 살짝 어긋나는 진행을 유도",
    rhythmImpact: "싱코페이션이 거칠거나, 박자가 엇나가 불안정하게 굴러가는 듯한 비대칭성 드럼 룹",
    instrumentImpact: "일그러지거나 흔들리는 코러스 이펙트가 걸린 사운드, 톤 다운된 무디 노이즈",
    vocalImpact: "들숨과 날숨의 경계가 떨리거나, 감정이 위태롭게 흔들려 끝이 살짝 쳐지는 보컬 가창선",
    moodImpact: "안개 속을 걷는 불안함, 보이지 않는 심연의 서스펜스와 감정의 격랑",
    energyImpact: "낮게 응축되어 언제 폭발할지 모르는 진동형 잠재 에너지",
    weight: 1.2
  },

  // Themes
  "lingering_attachment": {
    id: "lingering_attachment",
    label: "미련",
    category: "theme",
    musicalRole: "매듭짓지 못한 끝자락의 잔여 사물과 감각적 흔적",
    plainMeaning: "이별을 인지하고도 자꾸 되돌아보는 미완의 감정을 시각적 오브제와 사운드 여운으로 투사",
    lyricImpact: "서랍 안 가득한 옛 물건, 방 안에 남겨진 잔향, 버리지 못한 습관과 번호를 만지는 침묵",
    vocalImpact: "문장이 마무리에 이르러 길게 빼지 못하고 가슴 한켠에서 삼키듯 뚝 끊어버리는 비련조 보이스",
    moodImpact: "달콤 씁쓸함 속 슬픔이 아스라하게 묻어나는 미완성 러브 가사 정서",
    weight: 1.1
  },
  "confession": {
    id: "confession",
    label: "고백",
    category: "theme",
    musicalRole: "마음을 꺼내는 우주적인 결정적 순간의 긴장 전환점",
    plainMeaning: "평평하게 흐르던 관계의 거리가 깨지고 가까이 다가가는 순간의 찬란한 결단을 묘사",
    lyricImpact: "눈빛의 정지, 한숨을 고르고 뱉는 첫 외마디, 더 이상 삼킬 수 없는 사랑의 실체",
    vocalImpact: "평범한 톤에서 고백 부분으로 통과하며 고음부가 또렷하게 열리는 진정성 있는 인토네이션",
    moodImpact: "벅차오름과 기분 좋은 긴장감, 사랑을 향해 손을 뻗어 한 걸음 내딛는 감동",
    weight: 1.1
  },
  "growth": {
    id: "growth",
    label: "성장",
    category: "theme",
    musicalRole: "아픔을 통과해 넓어지는 지평선과 새로운 호흡",
    plainMeaning: "넘어짐과 일어섬을 통해 스스로 단단해지고 깊어지는 내적 승화",
    lyricImpact: "어제보다 아주 조금 깊어진 한숨, 흉터를 어루만지는 어조, 시선이 비단 나를 넘어 세상을 바라보는 눈빛",
    vocalImpact: "단단하게 무게 중심이 잡힌 발성과 가사 전달력을 중심으로 한 설득력 넘치는 중저음의 완성도",
    moodImpact: "희망과 숭고함, 조용히 불어오는 따스한 도약의 바람",
    weight: 1.1
  },

  // Vocals
  "vocal-whisper-expression": {
    id: "vocal-whisper-expression",
    label: "속삭임 표현",
    category: "vocal_technique",
    musicalRole: "귓가에 직접 닿는 실크 질감의 서스테인",
    plainMeaning: "숨소리의 방출 비율을 극대화하여 귀엽거나 아주 아련하고 친근한 감정을 느끼게 하는 가창 기법",
    vocalImpact: "가사 첫 마디를 완전히 삼세한 들숨으로 시작하며 공간을 친밀감으로 압도",
    instrumentImpact: "보컬을 가릴 수 있는 웅장한 가구 세션을 치우고, 아주 수줍고 여린 피아노나 통기타로만 백킹",
    weight: 1.0
  },
  "vocal-spoken-singing": {
    id: "vocal-spoken-singing",
    label: "말하듯 부름",
    category: "vocal_technique",
    musicalRole: "멜로디의 굴곡을 깎고 말과 노래의 완벽한 접점을 타는 서사 가창",
    plainMeaning: "화려한 비브라토나 꺾기 기교를 덜어내고, 편안한 일상 구어체의 호흡을 얹어 전달력을 키우는 스타일",
    vocalImpact: "마치 바로 앞에서 말하는 듯 자연스럽고 담백한 악센트 배치",
    lyricImpact: "문학적 미사여구보다 실제 일상 대화에 등장하는 지극히 평범하지만 절실한 문단",
    weight: 1.0
  },
  "vocal-cold-expression": {
    id: "vocal-cold-expression",
    label: "차가운 표현/감정 절제",
    category: "vocal_technique",
    musicalRole: "눈물을 머금은 이성, 절묘하게 유지하는 긴장의 외벽",
    plainMeaning: "비극적 가사를 과하게 흔드는 오열이 아닌 오히려 시크하게 읊조려 아이러니를 증폭하는 연출",
    vocalImpact: "어조에서 비브라토를 완전히 지우고 건조하게 끝음을 뚝 떨어뜨리는 도시적인 차가움",
    moodImpact: "과즙처럼 터지는 감정이 아닌 미니멀한 액자가 주는 차디찬 깊이감",
    weight: 1.0
  }
};


/**
 * -------------------------------------------------------------
 * 3. DYNAMIC INTERPRETATION HELPERS (GENRE & STYLE)
 * -------------------------------------------------------------
 */

/**
 * 1) 기존 장르 ID를 PreviewMeaningData로 정밀 변환합니다.
 */
export function resolveGenrePreviewMeaning(genreId: string): PreviewMeaningData {
  // 선언적 데이터셋에 정의된 값이 있다면 우선 사용
  if (PREVIEW_MEANING_DATASET[genreId] && PREVIEW_MEANING_DATASET[genreId].category === 'genre') {
    return PREVIEW_MEANING_DATASET[genreId];
  }

  let foundGenre: { id: string; label: string; labelKo?: string; description?: string } | undefined;

  // constants.ts 의 GENRES 평탄 배열 탐색
  foundGenre = GENRES.find(g => g.id === genreId);

  // constants.ts 의 GENRE_HIERARCHY 계층 트리 탐색
  if (!foundGenre) {
    for (const group of GENRE_HIERARCHY) {
      for (const main of group.children) {
        if (main.id === genreId) {
          foundGenre = main;
          break;
        }
        const sub = main.children?.find(s => s.id === genreId);
        if (sub) {
          foundGenre = sub;
          break;
        }
      }
      if (foundGenre) break;
    }
  }

  const label = foundGenre?.labelKo || foundGenre?.label || genreId;
  const desc = foundGenre?.description || "";
  const lowerId = genreId.toLowerCase();

  // 기본 가이드값 설정 (대괄호 노출 없이 아름다운 음악 용어로 채움)
  let musicalRole = `${label} 본연의 리듬 질감과 화성 선율미`;
  let plainMeaning = desc || `${label} 특유의 분위기적 깊이`;
  let rhythmImpact = "편안하고 균형 잡힌 박자감";
  let instrumentImpact = "가장 대표적이고 표준적인 편곡 파트";
  let vocalImpact = "선율선을 명료하게 전달하는 보컬 프레이징";
  let arrangementImpact = "섹션 간의 흐름이 자연스럽게 넘어가는 감각적인 가이드라인";
  let lyricImpact = "장르가 표출하는 감정선에 순수히 교감하도록 에스코트하는 운율";
  let energyImpact = "과하지도 덜하지도 않은 안정적인 기류";
  let moodImpact = "자연스럽고 편안하게 퍼지는 기분 좋은 공기감";
  let tempLow = 80, tempHigh = 120;

  // 장르 성격 분기 분류
  if (lowerId.includes('edm') || lowerId.includes('electro') || lowerId.includes('dance') || lowerId.includes('techno') || lowerId.includes('club') || lowerId.includes('house') || lowerId.includes('trance') || lowerId.includes('disco') || lowerId.includes('synth_pop') || lowerId.includes('electropop') || lowerId.includes('hyperpop')) {
    musicalRole = "강렬하고 비트 중심적인 도심 일렉트릭 그루브";
    rhythmImpact = "일정하고 타이트한 드럼 브레이크 킥 비트와 강렬한 포인터";
    instrumentImpact = "전자 합성 신디사이저, 빌드업 패드, 묵직한 베이스 펄스";
    vocalImpact = "비트 속을 기만하게 교차하는 리드미컬하고 세련된 보이스 가이드";
    arrangementImpact = "에너지를 응축하다가 일거에 시원하게 드롭하는 센세이셔널 낙차 연출";
    lyricImpact = "찰나의 정서, 직관적인 시선, 반복적이고 트렌디한 문장 구도";
    energyImpact = "현란한 심박수를 자극하는 전율적인 높은 에너지 밀도";
    moodImpact = "글로시하고 네온사인 불빛 아래 흔들리는 듯한 도시적 해방감";
    tempLow = 120; tempHigh = 135;
  } else if (lowerId.includes('ballad') || lowerId.includes('ccm') || lowerId.includes('church') || lowerId.includes('hymn') || lowerId.includes('chansons')) {
    musicalRole = "독보적인 감정선 중심의 서정성 짙은 발라드 서사";
    rhythmImpact = "섬세한 서정성을 뒷받침하며 완만히 진행하는 조용하고 차분한 타격";
    instrumentImpact = "어쿠스틱 피아노, 유려하게 온기를 채우는 스트링 오케스트라, 우드 윈드";
    vocalImpact = "호소력 짙고 감정을 가슴 깊이 머금어 뿜어내는 호화로운 가창 스타일";
    arrangementImpact = "기승전결이 확실하고 코러스로 진입하며 전체 사운드가 풍성해지는 정석적인 발전형 편곡";
    lyricImpact = "마음의 일기장처럼 내면의 독백을 길게 정돈하고 어루만지는 애틋한 구절";
    energyImpact = "감정의 고조에 비례해 뜨거워지는 조용하지만 밀도 높은 열량";
    moodImpact = "은은한 여운을 길게 남기는 사색적이며 깊은 위로의 정서";
    tempLow = 65; tempHigh = 85;
  } else if (lowerId.includes('acoustic') || lowerId.includes('folk') || lowerId.includes('singer-songwriter') || lowerId.includes('indie_pop') || lowerId.includes('bedroom') || lowerId.includes('dream_pop')) {
    musicalRole = "내추럴하면서도 오가닉한 목재 악기 위주의 친근한 흐름";
    rhythmImpact = "드럼을 심플하게 유지하거나 핑거스냅, 소프트 브러시로 직조해낸 아늑한 비트";
    instrumentImpact = "포근하고 내추럴한 통기타 스트로크 및 수수한 어쿠스틱 피아노, 뮤트 파츠";
    vocalImpact = "작은 방 안에서 대화하듯 담백하고 자연스러운 생동감을 지닌 보이스";
    arrangementImpact = "기교를 부리지 않고 오직 가사와 분위기의 흐름에 맞추는 투명한 진행";
    lyricImpact = "한 폭의 수채화처럼 소박하고 솔직한 풍경을 묘사하는 아기자기한 에세이";
    energyImpact = "청자에게 편안하고 기댈 곳 가득한 완충지대를 건네는 유연한 흐름";
    moodImpact = "포근한 공기에 나른하게 마음을 기댈 수 있는 은은한 연한 갈색 무드";
    tempLow = 70; tempHigh = 95;
  } else if (lowerId.includes('rnb') || lowerId.includes('soul') || lowerId.includes('funk') || lowerId.includes('city_pop') || lowerId.includes('citypop') || lowerId.includes('r&b') || lowerId.includes('contemporary-rnb') || lowerId.includes('motown')) {
    musicalRole = "리드미컬하고 세련된 코드 진행이 만드는 그루브와 스무스 질감";
    rhythmImpact = "하프 템포 스냅과 림샷, 싱코페이션 킥이 만드는 매끄럽고 여유 있는 바운스";
    instrumentImpact = "웜 EP(일렉 피아노), 부드럽게 감기는 리듬 기타 드라이브, 베이스 라인";
    vocalImpact = "소울풀한 가성과 진성을 부드럽게 넘나들며 악센트를 가미하는 싱잉";
    arrangementImpact = "일정한 리듬 루프 질감 위에 세련되게 변주되는 하이엔드 전개";
    lyricImpact = "우아하고 섬세하며 묘한 낭만이 감도는 밤거리의 트렌디한 구어체";
    energyImpact = "풍족한 윤기가 흐르는 성숙하고 스타일리시한 미디엄 하이 수준";
    moodImpact = "새벽 밤공기 속 세련되고 아련하게 반짝이는 주간 도시 무드";
    tempLow = 85; tempHigh = 110;
  } else if (lowerId.includes('rock') || lowerId.includes('metal') || lowerId.includes('punk') || lowerId.includes('grunge') || lowerId.includes('post-rock') || lowerId.includes('band') || lowerId.includes('shoegaze')) {
    musicalRole = "생생한 열정과 시원한 청량감의 록 밴드 합주 포맷";
    rhythmImpact = "실제 연주 드럼의 강한 하이햇 타격과 묵직한 리드 드라이브";
    instrumentImpact = "일렉트릭 디스토션 기타, 단단하게 받쳐주는 드라이빙 베이스, 심벌";
    vocalImpact = "음역대가 시원하게 열리고 명확한 발음으로 에너지를 밀어내는 힘찬 가창";
    arrangementImpact = "뜨겁게 고조된 후 시원하게 지르는 웅장하고 거친 리얼 악기들의 스케일 팽창";
    lyricImpact = "자유로움과 성장을 다짐하는 용기, 솔직한 외침과 감각적인 가사와 문장";
    energyImpact = "가슴을 지체 없이 시원하게 관통하는 강력한 충만도";
    moodImpact = "드넓은 페스티벌이나 오픈에어의 역동감 가득한 생동감";
    tempLow = 100; tempHigh = 145;
  } else if (lowerId.includes('hip') || lowerId.includes('trap') || lowerId.includes('rap') || lowerId.includes('drill') || lowerId.includes('boom')) {
    musicalRole = "둔중한 힙 비트 본연의 결이 감각적인 힙합 사운드";
    rhythmImpact = "강박 있는 808 서브 베이스의 타격과 리듬감 넘치는 싱크";
    instrumentImpact = "질감 있는 아날로그 샘플 소스, 벨 소스, 묵직하고 단단한 스네어 단품";
    vocalImpact = "멜로딕 랩과 촘촘하게 박자를 타는 정교한 딜리버리가 또렷한 딜리버리";
    arrangementImpact = "단순하지만 강점을 확실히 살린 미니멀 일정한 루프 위에 빌드업";
    lyricImpact = "도전적이고 거침없는 자아 투사, 위트 있는 펀치라인 구성";
    energyImpact = "내적으로 묵직하게 정렬하여 한 곳에 집중하는 알찬 무거움";
    moodImpact = "빛을 약간 가린 시크하고 묵직한 어두운 그림자의 멋스러운 분위기";
    tempLow = 75; tempHigh = 98;
  } else if (lowerId.includes('jazz') || lowerId.includes('swing') || lowerId.includes('bossa')) {
    musicalRole = "스윙 그루브와 조밀한 텐션 코드가 매력적인 이지하우스 재즈";
    rhythmImpact = "정박을 이탈하는 절묘한 붓점 바운스와 통통 튀는 라이브 그루브";
    instrumentImpact = "콘트라베이스의 피치카토 터치, 드럼 브러시 타격, 부드러운 우프 리드";
    vocalImpact = "세월의 멋을 품은 듯 나른하고 깊이 있는 어조의 정다운 싱잉";
    arrangementImpact = "풍족한 화성 변화와 즉흥적인 솔로 빌드업을 유기적으로 교차하는 진행";
    lyricImpact: "시적인 통찰과 우아함이 공존하며 낭만을 조용히 속삭이는 문구";
    energyImpact = "정서적 깊이를 안도하게 만드는 유연하고 편안한 이완 상태";
    moodImpact = "은은한 노란빛 전구 아래 편안하게 퍼지는 프라이빗 바의 분위기";
    tempLow = 80; tempHigh = 110;
  }

  return {
    id: genreId,
    label,
    category: 'genre',
    musicalRole,
    plainMeaning,
    rhythmImpact,
    instrumentImpact,
    vocalImpact,
    arrangementImpact,
    lyricImpact,
    energyImpact,
    moodImpact,
    tempoImpact: `BPM ${tempLow}-${tempHigh} 최적화`,
    weight: 1.0
  };
}

/**
 * 2) 기존 스타일 ID를 PreviewMeaningData로 정밀 변환합니다.
 */
export function resolveStylePreviewMeaning(styleId: string): PreviewMeaningData {
  if (PREVIEW_MEANING_DATASET[styleId] && PREVIEW_MEANING_DATASET[styleId].category === 'style') {
    return PREVIEW_MEANING_DATASET[styleId];
  }

  let foundStyle: { id: string; label: string; labelKo?: string; description?: string; descriptionKo?: string; style?: string; sound?: string; mood?: string } | undefined;

  // constants.ts 의 STYLE_CYCLES 트리형 가이드 구조 스캐닝
  for (const group of STYLE_CYCLES) {
    if (group.variants) {
      const match = group.variants.find(v => v.id === styleId);
      if (match) {
        foundStyle = match;
        break;
      }
    }
  }

  const label = foundStyle?.labelKo || foundStyle?.label || styleId;
  const desc = foundStyle?.descriptionKo || foundStyle?.description || "";
  const lowerId = styleId.toLowerCase();

  // 기본 가이드값 설정 (대괄호 노출 없이 아름다운 음악 용어로 채움)
  let musicalRole = `${label} 스타일의 현대적 터치와 음질`;
  let plainMeaning = desc || `${label}로 고조되는 사운드 엑센트`;

  // 5가지 스타일 해석 중심 요소 디폴트 마련
  let styleEra = "동시대의 세련된 모던 질감";
  let styleArrangement = "사운드의 밀도를 매끄럽게 제어한 감각적 배치";
  let styleSoundColor = "깔끔한 고해상도 아날로그-디지털 하이브리드 음향";
  let styleAppeal = "대중적인 듣기 편안함을 극대화한 친근한 기조";
  let styleFusionImpact = "장르 본연의 그루브 위에 세련되고 신선한 색채 레이어를 완곡하게 이식";

  // 분류에 따른 정밀 해석
  if (lowerId.includes('fusion') || lowerId.includes('cross') || lowerId.includes('hybrid')) {
    styleEra = "새로운 예술적 조류가 접목된 글로벌 트렌디 세대";
    styleArrangement = "서로 다른 문법의 악기가 대칭적이고 정교하게 교차하는 주파수 믹스";
    styleSoundColor = "전통 배음과 정교한 기하학적 전자 이펙트가 유기적으로 엮인 매혹적인 사운드";
    styleAppeal = "귀에 기분 좋게 안착하면서도 독창성을 선사하는 고품격 크로스오버";
    styleFusionImpact = "장르와 결합했을 때, 이종 문화의 장점을 활짝 열고 전위적인 신선함을 부각";
  } else if (lowerId.includes('retro') || lowerId.includes('vintage') || lowerId.includes('80s') || lowerId.includes('90s') || lowerId.includes('city') || lowerId.includes('disco') || lowerId.includes('nostalgic') || lowerId.includes('oldschool')) {
    styleEra = "과거 명반들의 따스한 아날로그 골든에이지 세대";
    styleArrangement = "코러스 화음과 풍부한 악기군이 촘촘하고 밀도 높게 채워 정겹게 울려 퍼지는 클래식 레이아웃";
    styleSoundColor = "테이프 새츄레이션에서 배어 나오는 둥글고 정제된 두터움과 통통 튀는 빈티지 음압";
    styleAppeal = "남녀노소 누구나 기분 부드럽게 과거로 초대받는 매혹적인 노스탤지어";
    styleFusionImpact = "현대적 장르 위에 복고풍의 로맨틱한 공기를 주입해 소리에 숨어 있는 온기를 확연히 전진";
  } else if (lowerId.includes('indie') || lowerId.includes('indie_pop') || lowerId.includes('bedroom') || lowerId.includes('shoegaze') || lowerId.includes('lofi') || lowerId.includes('lo-fi') || lowerId.includes('chill') || lowerId.includes('acoustic')) {
    styleEra = "방 안에서 속삭이는 나지막한 2010년대 인디-베드룸 DIY 시대";
    styleArrangement = "불필요한 과장을 철저히 배제하고 꼭 필요한 최소한의 오가닉 악기들만 살려두는 미니멀리즘 편곡";
    styleSoundColor = "마이크 앞에 가깝게 밀착한 듯한 기분 좋은 쥠 소리와 자연스러운 공기 노이즈의 친근한 정향";
    styleAppeal = "기성의 정형화된 편성을 탈피해 가창자만의 자유롭고 소탈한 기품을 전달";
    styleFusionImpact = "장르를 지나치게 거창하지 않고 사사롭고 순수하게 빚어내어 청중과 밀접 교감하는 프라이빗 룸으로 유체 변화";
  } else if (lowerId.includes('orchestral') || lowerId.includes('epic') || lowerId.includes('grand') || lowerId.includes('cinema') || lowerId.includes('symphony') || lowerId.includes('dramatic')) {
    styleEra = "시대를 초월한 클래식 명곡들의 품격과 시네마틱 오페라 세대";
    styleArrangement = "현악 합주군과 대형 관악기 세션이 웅대하게 교차하며 음악 성벽을 우뚝 쌓아 올려 가는 설계";
    styleSoundColor = "대형 콘서트홀의 깊은 엠비언스 리버브를 상정한 넓은 광폭 입체 사운드 스테이지";
    styleAppeal = "음률 특유의 비장미를 온전히 살려 청취 환경을 스펙터클하게 압도하는 웰메이드 감동 선사";
    styleFusionImpact = "원형 장르 위에 영웅적 서사와 무게감을 가미해 가슴속 뜨거운 감정 고조를 통쾌하게 수렴";
  } else if (lowerId.includes('vocal') || lowerId.includes('expression') || lowerId.includes('delicate') || lowerId.includes('spoken') || lowerId.includes('whisper')) {
    styleEra = "가장 본질적이고 인간적인 가창 표현의 정서주의 시대";
    styleArrangement = "보컬의 침 삼키는 떨림과 끝 자락 호흡까지 부각하도록 백킹 세션을 잔잔히 비워내는 맞춤형 스케치";
    styleSoundColor = "인공적 보정을 걷어내고 인간 보이스 본연의 따스한 중음역 음폭을 최대치로 투시";
    styleAppeal = "화려한 반주 기하를 넘어 오직 전달하는 가삿말 한절 한절에 완벽하게 집중시키는 치유 효과";
    styleFusionImpact = "장르가 지닌 차가움을 목소리의 절대적 온기로 상쇄하여 청자에게 온전한 교감을 선물";
  }

  return {
    id: styleId,
    label,
    category: 'style',
    musicalRole,
    plainMeaning,
    styleEra,
    styleArrangement,
    styleSoundColor,
    styleAppeal,
    styleFusionImpact,
    weight: 0.8
  };
}


/**
 * -------------------------------------------------------------
 * 4. ENGINE COMPUTATION FUNCTIONS (RE-ENGINEERED)
 * -------------------------------------------------------------
 */

/**
 * Collects custom preview interpretation objects for selected values
 */
export function collectPreviewMeaningData(input: PreviewInput): PreviewMeaningData[] {
  const result: PreviewMeaningData[] = [];
  
  // 1) Genres 수집 및 동적 복원
  const allGenres = [...(input.selectedGenre || [])];
  allGenres.forEach(genreId => {
    result.push(resolveGenrePreviewMeaning(genreId));
  });

  // 2) 기타 요소 수집 및 스타일의 정밀 변환
  const allOtherIds = [
    ...(input.selectedStyles || []),
    ...(input.selectedSounds || []),
    ...(input.selectedMoods || []),
    ...(input.selectedThemes || []),
    ...(input.selectedVocalTags || [])
  ];

  allOtherIds.forEach(itemId => {
    // 이미 프리셋 데이터셋에 정의된 커스텀 해석이 존재할 때
    if (PREVIEW_MEANING_DATASET[itemId]) {
      result.push(PREVIEW_MEANING_DATASET[itemId]);
    } else {
      // 선택한 스타일 배열에 속한 경우 동적 스타일 해석 기법 가동
      if (input.selectedStyles && input.selectedStyles.includes(itemId)) {
        result.push(resolveStylePreviewMeaning(itemId));
      }
    }
  });

  return result;
}

function getRolesKo(roles: string[]): string {
  if (!roles || roles.length === 0) return "보컬";
  const map: Record<string, string> = {
    main: "메인 보컬",
    lead: "리드 보컬",
    sub: "서브 보컬",
    rapper: "래퍼",
  };
  return roles.map(r => map[r] || r).join(" 겸 ");
}

function buildVocalMemberDescription(m: VocalMember, index: number, total: number): string {
  const genderKo = m.gender === 'male' ? '남성' : '여성';
  const roleKo = getRolesKo(m.roles);
  
  let toneLabel = "";
  if (m.toneId) {
    const toneObj = VOCAL_TONES.find((t: any) => t.id === m.toneId);
    if (toneObj) toneLabel = toneObj.labelKo || toneObj.label;
  }
  
  const char = m.character;
  if (char) {
    let vocalToneStr = "";
    if (char.voiceToneId) {
      const v = VOCAL_VOICE_TONES.find((item: any) => item.id === char.voiceToneId);
      if (v) vocalToneStr = v.labelKo || v.label;
    }
    if (char.customVoiceTone) vocalToneStr = char.customVoiceTone;

    let personalityStr = "";
    if (char.personalityId) {
      const p = VOCAL_PERSONALITIES.find((item: any) => item.id === char.personalityId);
      if (p) personalityStr = p.labelKo || p.label;
    }
    if (char.customPersonality) personalityStr = char.customPersonality;

    let techParts: string[] = [];
    if (char.techniqueIds && char.techniqueIds.length > 0) {
      char.techniqueIds.forEach((tid: string) => {
        const tc = VOCAL_TECHNIQUES.find((item: any) => item.id === tid);
        if (tc) techParts.push(tc.labelKo || tc.label);
      });
    }
    if (char.customTechnique) techParts.push(char.customTechnique);

    // Levels
    let levelDescs: string[] = [];
    
    // Emotion
    if (char.emotionLevel !== undefined) {
      if (char.emotionLevel > 7) {
        levelDescs.push("감정이 아주 진하고 깊게 묻어나며 절절하게 터뜨리는 호소력");
      } else if (char.emotionLevel < 4) {
        levelDescs.push("감정을 극도로 절제하고 덤덤하게 내뱉는 차분한 창법");
      } else {
        levelDescs.push("안정적이고 은은해 편안하게 와닿는 감정 완급 조절");
      }
    }
    
    // Range
    if (char.rangeLevel !== undefined) {
      if (char.rangeLevel > 7) {
        levelDescs.push("높고 시원하게 치솟는 청량함");
      } else if (char.rangeLevel < 4) {
        levelDescs.push("낮고 포근하며 부드럽게 감싸는 중저음");
      } else {
        levelDescs.push("안정적인 고유 성부 음역");
      }
    }

    // Delivery / Breath
    if (char.deliveryLevel !== undefined) {
      if (char.deliveryLevel > 7) {
        levelDescs.push("가사 전달이 타이트하고 직관적인 선명한 딜리버리");
      } else if (char.deliveryLevel < 4) {
        levelDescs.push("숨소리를 풍부하게 머금고 나지막이 속삭이는 높은 호흡감");
      }
    }

    let vibeAttrs: string[] = [];
    if (vocalToneStr) vibeAttrs.push(vocalToneStr);
    if (personalityStr) vibeAttrs.push(personalityStr);
    
    const baseDesc = `${genderKo} ${roleKo}${toneLabel ? ` (${toneLabel})` : ''}`;
    const mainAttrText = vibeAttrs.length > 0 ? `${vibeAttrs.join(', ')} 느낌의 매력을 바탕으로 ` : '';
    const levelText = levelDescs.length > 0 ? levelDescs.join(', ') : '';
    const techText = techParts.length > 0 ? `, 표현 기교인 ${techParts.join('와 ')}를 가미함` : '';

    return `- **제${index + 1}보컬 (${baseDesc})**: ${mainAttrText}${levelText}${techText}을 품고 정성스럽게 가창합니다.`;
  } else {
    const toneText = toneLabel ? `${toneLabel} 톤의 ` : '';
    return `- **제${index + 1}보컬 (${genderKo} ${roleKo})**: ${toneText}익숙하고 따뜻한 어조로 파트를 담담하게 일구어가며 조화를 맞춥니다.`;
  }
}

function buildVocalFormationSummary(members: VocalMember[], rapEnabled: boolean): string {
  const maleCount = members.filter(m => m.gender === 'male').length;
  const femaleCount = members.filter(m => m.gender === 'female').length;
  const count = members.length;
  const hasRap = rapEnabled || members.some(m => m.roles.includes('rapper'));
  
  if (count === 1) {
    const m = members[0];
    const genderKo = m.gender === 'male' ? '남성' : '여성';
    const roleKo = getRolesKo(m.roles);
    return `${genderKo} 싱글 단독 솔로 보컬 구도로, 오직 한 목소리의 깊이와 세세한 다이내믹에 곡의 온전한 주의를 집중하게 만듭니다${hasRap ? " (리드미컬한 랩 세션이 포함되어 듣는 재미를 더함)" : ""}`;
  } else if (count === 2) {
    if (maleCount === 1 && femaleCount === 1) {
      return `아름답고 섬세한 남녀 혼성 듀엣(Duo) 구성으로, 두 보컬이 서로 대화하듯 노랫말을 화답하며 번갈아 나타나 곡의 입체감을 불어넣습니다`;
    } else if (maleCount === 2) {
      return `두터운 화음이 매력적인 남성 이중창 듀엣(Duo) 구성으로, 음이 낮고 넓게 퍼지는 풍성한 성부 배치가 돋보입니다`;
    } else if (femaleCount === 2) {
      return `맑고 우아하게 어우러지는 여성 이중창 듀엣(Duo) 구성으로, 높은 멜로디의 맑은 음역들이 촘촘히 겹쳐져 전방위적인 화색을 더합니다`;
    } else {
      return `서로 다른 매력의 두 보컬이 만나 선순환하는 듀엣(Duo) 구성`;
    }
  } else {
    if (maleCount > 0 && femaleCount > 0) {
      return `남성 ${maleCount}명과 여성 ${femaleCount}명이 함께 목소리를 맞춰 전개하는 다채로운 혼성 그룹(Group) 입체 가창 포맷입니다`;
    } else if (maleCount > 0) {
      return `남성 ${maleCount}명으로 배치된 두터운 보색과 남성적 코러스 레이어가 웅장하게 물결치는 보컬 그룹(Group) 포맷입니다`;
    } else {
      return `여성 ${femaleCount}명의 유려하고 밝은 선율들이 화사하게 날아오르며 극의 활색을 뿜어내는 여성 보컬 그룹(Group) 포맷입니다`;
    }
  }
}

/**
 * Builds the abstract PreviewSongIntent combining and adjusting values
 */
export function buildPreviewSongIntent(input: PreviewInput): PreviewSongIntent {
  const dataset = collectPreviewMeaningData(input);
  const warnings: string[] = [];

  // 1) 기본 분류 체계 데이터 확보
  const genres = dataset.filter(d => d.category === 'genre');
  const styles = dataset.filter(d => d.category === 'style');
  const moods = dataset.filter(d => d.category === 'mood');
  const themes = dataset.filter(d => d.category === 'theme');
  const vocals = dataset.filter(d => d.category === 'vocal_technique');

  // 디폴트 문장 스펙 정의
  let genreDirection = "박자와 멜로디의 균형이 아주 잘 갖춰진 대중 팝";
  let fusionDirection = "대중적인 장르 구성 위에 흥겨운 리듬을 얹은 편안한 스타일";
  let styleFusionDirection = "장르 고유의 장점을 잘 살린 깔끔하고 세련된 일치감";
  let finalGenreInterpretation = "대중적인 감성과 조화로움을 고루 들려주는 완성도 높은 곡";
  let coreInstruments = ["피아노", "어쿠스틱 드럼", "신스 패드"];
  let soundTexture = "귀가 피로하지 않게 깔끔히 정돈하여 균형을 맞춘 소리 질감";
  let emotionalCore = "억지로 꾸미지 않아 더 다정하게 다가오는 깊이 있는 정서";
  let moodColor = "너무 밝거나 어둡지 않게 균위가 잡힌 다정한 중간 톤";
  let vocalDirection = "목소리가 편안하고 가사 소리가 선명히 들리는 표준형 가창";
  let arrangementFlow = "익숙한 도입에서 점진적으로 분위기를 전개하고 한결 풍성한 입체감을 더해 매끄럽게 매듭지어집니다.";
  let lyricDirection = "귓가에 부드럽게 쏙 들어오도록 단락을 잘 맞춘 기본 편전 구성";
  let finalImpression = "세련된 멜로디와 정겨운 연주가 함께 어우러져 한결 풍성한 여운을 전해주는 구도";

  // 2) 장르 핵심 데이터 연동 (리듬, 악기, 전개, 가사 어조, 에너지 밀도)
  const primaryGenre = genres[0];
  const genreLabel = primaryGenre ? primaryGenre.label : "대중적인 팝";

  if (primaryGenre) {
    if (primaryGenre.musicalRole) genreDirection = primaryGenre.musicalRole;
    if (primaryGenre.plainMeaning) fusionDirection = primaryGenre.plainMeaning;
    if (primaryGenre.instrumentImpact) {
      // 쉼표로 분리해 정적 악기 구성 추측
      const rawInstruments = primaryGenre.instrumentImpact.split(',').map(s => s.trim().replace('.', ''));
      if (rawInstruments.length > 0 && rawInstruments[0] !== "") {
        coreInstruments = rawInstruments;
      }
    }
    if (primaryGenre.rhythmImpact) {
      soundTexture = `${primaryGenre.rhythmImpact}과 ${primaryGenre.instrumentImpact || '장르 악기'}의 유기적 조화`;
    }
    if (primaryGenre.vocalImpact) {
      vocalDirection = `${primaryGenre.label} 장르에 걸맞게 ${primaryGenre.vocalImpact.replace(/^[A-Z\-가-힣 ]+ \- /, '')}`;
    }
    if (primaryGenre.arrangementImpact) {
      arrangementFlow = primaryGenre.arrangementImpact;
    }
    if (primaryGenre.lyricImpact) {
      lyricDirection = primaryGenre.lyricImpact;
    }
    if (primaryGenre.energyImpact) {
      emotionalCore = `${primaryGenre.energyImpact}를 배경으로 삼은 ${primaryGenre.moodImpact || '장르 고유의 다정한 감수성'}`;
    }
  }

  // 복수 장르 선택 시 융합 방향성 조율
  if (genres.length > 1) {
    const backupGenre = genres[1];
    fusionDirection = `${primaryGenre.label} 특유의 든든한 기초 위에 ${backupGenre.label} 고유의 맛과 분위기가 매끄럽고 자연스레 합쳐진 멋스러운 융합 사운드`;
  }

  // 3) 스타일 결합 분석 (시대감, 편곡 결, 사운드 색, 대중성/실험성, 장르 융합 방향)
  // "스타일이 여러 개 선택된 경우: 모든 스타일을 같은 비중으로 나열하지 않습니다. 장르에 가장 큰 영향을 주는 스타일 1~2개만 fusionDirection/styleFusionDirection에 반영합니다."
  const primaryStyles = styles.slice(0, 2);
  const backgroundStyles = styles.slice(2);

  if (primaryStyles.length > 0) {
    const s1 = primaryStyles[0];
    const s2 = primaryStyles[1];

    if (s2) {
      styleFusionDirection = `${s1.label}과 ${s2.label} 고유의 감성을 교차해 장르를 더 입체적으로 꾸몄습니다. 구체적으로는 ${s1.styleEra} 및 ${s2.styleEra}의 장점이 부드럽게 감돕니다`;
      fusionDirection = `${primaryGenre ? primaryGenre.label : '중심 테마'}에 ${s1.label}과 ${s2.label}의 어조를 조화롭게 녹여내어 ${s1.styleFusionImpact || '새롭고 따뜻한 감성'}을 들려드리게끔 마련했습니다`;
    } else {
      styleFusionDirection = `${s1.label} 특유의 ${s1.styleEra}적인 멋이 잘 담겨 있어, ${s1.styleFusionImpact || '신선하고 새로운 들을 거리'}를 열어냅니다`;
      fusionDirection = `${genreLabel} 고유의 기분 좋은 리듬감 위에 ${s1.label}의 ${s1.styleFusionImpact || '세련된 감성'}을 조화로이 더해 완성도를 기분 좋게 챙겼습니다`;
    }

    // 편곡 결 (styleArrangement) 및 사운드 색 (styleSoundColor) 반영
    soundTexture = `${soundTexture} 및 ${s1.styleSoundColor || '귀가 편안한 균형감'}과 빈티지하고 촉촉한 잔향이 함께 감돕니다`;
    arrangementFlow = `${s1.styleArrangement || arrangementFlow}. 또한, ${arrangementFlow}`;
    
    if (s1.styleAppeal) {
      finalImpression = `${s1.styleAppeal}을 목표로 삼아, 감상이 완전히 끝난 하이라이트 뒤에도 가창자의 잔상이 포근하고 감미롭게 퍼지는 여운의 순간`;
    }
  }

  // "나머지 스타일(3개 이상일 때)은 soundTexture나 moodColor 보정값으로 약하게 반영합니다."
  if (backgroundStyles.length > 0) {
    const bStyleLabels = backgroundStyles.map(b => b.label).join(', ');
    soundTexture = `${soundTexture} (여기에 ${bStyleLabels}의 미묘한 정취 뉘앙스가 가볍게 오버랩됨)`;
  }

  // 4) 장르 + 스타일 융합 자연어 결합 요약 (finalGenreInterpretation)
  // 예시: “어두운 UK 개러지 R&B에 다크 트랩 질감이 섞인 곡” 문장 형태 구현 (대괄호 전면 제거 및 자연스러운 맥락 융합)
  if (primaryGenre) {
    let vibePrefix = "세련되고 도시적인";
    if (moods.length > 0) {
      const m1 = moods[0];
      if (m1.id === 'hollow' || m1.label.includes('공허') || m1.label.includes('쓸쓸')) vibePrefix = "어둡고 쓸쓸한";
      else if (m1.id === 'warm' || m1.label.includes('따뜻') || m1.label.includes('편안')) vibePrefix = "따뜻하고 서정적인";
      else if (m1.id === 'uneasy' || m1.label.includes('불안')) vibePrefix = "위태롭고 서스펜스 넘치는";
      else vibePrefix = `${m1.label} 감성의`;
    }

    if (primaryStyles.length > 0) {
      const s = primaryStyles[0];
      finalGenreInterpretation = `${vibePrefix} ${primaryGenre.label}에 ${s.label} 특유의 질감과 기교가 웅숭깊게 믹싱된 곡`;
    } else {
      finalGenreInterpretation = `${vibePrefix} ${primaryGenre.label}의 리듬적 본질을 극대화해 담아낸 음원`;
    }
  } else {
    finalGenreInterpretation = "대중문화 감각을 관통하는 세련된 사운드 밸런스";
  }

  // 5) 분위기(Mood) 반영 보정
  if (moods.length > 0) {
    const primaryMood = moods[0];
    moodColor = `${primaryMood.label} 감성이 녹아든 사운드 분위기`;
    if (primaryMood.id === 'hollow') {
      soundTexture += " 및 쓸쓸함이 묻어나는 아련하고 넓은 공간 울림 효과";
      moodColor = "소리가 먼 곳에서 메아리쳐 오듯 은은하고 아스라한 느낌";
    } else if (primaryMood.id === 'warm') {
      soundTexture += " 및 귀를 따스하게 해주는 둥글고 모나지 않은 파형";
      moodColor = "벽난로 앞 소파에 앉은 대화처럼 조용조용 귓가를 감싸 안는 다정한 톤";
    } else if (primaryMood.id === 'uneasy') {
      soundTexture += " 및 살짝 위태롭게 흔들려 아슬아슬함이 묻어나는 독특한 소리 톤";
      moodColor = "안개 속을 천천히 걷는 것처럼 신비롭고 긴장되게 퍼지는 어조 조율";
    }
  }

  // 6) 가사 주제(Theme) 연동 보정
  if (themes.length > 0) {
    const primaryTheme = themes[0];
    if (primaryTheme.lyricImpact) lyricDirection = primaryTheme.lyricImpact;
    if (primaryTheme.musicalRole) emotionalCore = `${primaryTheme.label} 서사에 초점을 맞춰 설계된 ${primaryTheme.musicalRole}`;
  }

  // 7) 가창/보컬 가이드 보정
  if (vocals.length > 0) {
    const primaryVocal = vocals[0];
    vocalDirection = `${primaryVocal.label}을 적용해 ${primaryVocal.musicalRole || '가창 완성도'}`;

    if (primaryVocal.id === 'vocal-whisper-expression') {
      vocalDirection = "마이크와 청자의 귓가 바로 옆에서 밀착해 전하는 숨이 섞인 고해상도 속삭임 보이스";
      lyricDirection += " (친밀한 거리에 맞추어 함축적이며 나지막이 소곤거리는 짧은 구어체 적용)";
    } else if (primaryVocal.id === 'vocal-spoken-singing') {
      vocalDirection = "과도한 멜로디 굴곡보다는 편안한 대화 주파수로 완급을 읊는 낭독형 독백 가창";
      lyricDirection += " (자연스러운 발성에 최적화된 장식 없는 솔직 담백한 시어 구절 배치)";
    } else if (primaryVocal.id === 'vocal-cold-expression') {
      vocalDirection = "감정을 극한으로 절제해 비브라토를 소거하고 끝음을 건조하게 툭 끊는 성숙하고 현대적인 보이스";
    }
  }

  // 8) 랩 및 이중가치 추가 튜닝
  if (input.rapEnabled && input.includeLyrics) {
    vocalDirection += " 및 비트에 감각적으로 쪼개지는 멜로디컬 랩 가창이 대단원 교차 가미";
    lyricDirection += " (랩 고유의 선명한 리듬감과 압축력 있는 펀치라인 결속 구현)";
  }

  if (!input.includeLyrics) {
    vocalDirection = "해당 트랙은 연주 전용(Instrumental) 모드로, 보컬을 배제합니다";
    lyricDirection = "순수 기악 연주의 입체감에 집중적인 리듬과 멜로디 구성을 위해 가사는 탑재하지 않습니다";
    finalImpression = "멜로디 악기와 마스터링 리듬이 이야기꾼이 되어 청중의 고요한 집중을 선사하는 시네마틱 기악 트랙";
  } else {
    let langLabel = "한국어";
    if (input.lyricLanguages && input.lyricLanguages.length > 0) {
      if (input.lyricLanguages.includes('en') && !input.lyricLanguages.includes('ko')) langLabel = "영어";
      else if (input.lyricLanguages.includes('ja')) langLabel = "일본어";

      if (input.bilingualMix) {
        langLabel = `한국어 가사를 기반으로 전조 형태의 영어 어구가 약 ${input.englishMixRatio || 30}% 가량 매끄럽게 교차된 이중언어`;
      }
    }
    lyricDirection = `${langLabel} 가사로서, ${lyricDirection}`;
  }

  // 9) 템포 계산
  let tempoLabel = "곡에 알맞은 다이내믹 속도감 가이드";
  const t = input.tempo;
  if (t && t.enabled) {
    const avg = Math.round((t.min + t.max) / 2);
    if (avg < 80) {
      tempoLabel = `느린 호흡 (${t.min}-${t.max} BPM)의 빠르기로, 깊은 생각에 조용히 젖어들기 좋은 은은하고 편안한 템포`;
    } else if (avg >= 80 && avg <= 119) {
      tempoLabel = `중간 빠르기 (${t.min}-${t.max} BPM)의 속도로, 일상의 심장 박동처럼 무척 편안하고 자연스러운 속도감`;
    } else {
      tempoLabel = `밀고 나가는 빠른 템포 (${t.min}-${t.max} BPM)로, 들뜰 때처럼 리듬을 타며 활기를 일깨우는 에너제틱한 속도감`;
    }
  } else {
    tempoLabel = "해당 장르를 들려주기에 가장 이상적인 추천 빠르기";
  }
  arrangementFlow = `${tempoLabel}를 기준으로 맞물리며, ${arrangementFlow}`;

  // 10) 충돌 경고 분석
  if (input.selectedGenre.includes('uk_garage_rnb') && input.selectedMoods.includes('warm')) {
    warnings.push("시크한 도시적인 분위기의 UK 개러지 비트에 따뜻하고 안락한 느낌을 더하면, 묘하게 미적 매력이 어우러지는 아주 독특하고 개성 넘치는 융합이 생겨납니다. 두 뉘앙스가 고루 살아나도록 소리 배율을 균형 있게 다듬어 줍니다.");
  }
  if (!input.includeLyrics && input.selectedVocalTags.length > 0) {
    warnings.push("가사가 없는 연주 전용(instrumental) 곡인데 보컬의 특징이나 기법이 함께 체크되었습니다. 사람 목소리로 기사를 노래하기보다, 목소리를 악기처럼 짧게 자른 컴퓨터 이펙트 소리(보이스 찹)나 메인 가락을 바꾸는 연주자 기법을 어울리게 엮어 보심을 추천합니다.");
  }

  // ==========================================
  // VOCAL & STORYBOARD/SITUATION DYNAMIC COUPLING
  // ==========================================
  const hasVocalMembers = input.vocalMembers && input.vocalMembers.length > 0;
  const hasStoryboard = input.situation && input.situation.enabled && (
    input.situation.targetA || input.situation.targetB || input.situation.relationship || input.situation.description
  );

  if (input.includeLyrics) {
    // 1) Vocal Cast Overwrite / Enhancement
    if (hasVocalMembers) {
      const formationSummary = buildVocalFormationSummary(input.vocalMembers!, input.rapEnabled);
      const membersDetailArray = input.vocalMembers!.map((m, i) => buildVocalMemberDescription(m, i, input.vocalMembers!.length));
      
      let parts: string[] = [
        `이번 트랙은 **${formationSummary}**를 기본 뼈대로 삼고 있습니다. 구체적인 보컬 캐릭터 구성은 다음과 같이 디자인되어 가사의 뉘앙스를 온전히 어루만집니다.`,
        membersDetailArray.join('\n'),
      ];
      
      const rapperCount = input.vocalMembers!.filter(m => m.roles.includes('rapper')).length;
      if (rapperCount > 0) {
        parts.push(`곡의 전반에 멜로디 파트뿐만 아니라 비트 위에 감각적으로 잘게 쪼개는 딕션의 래핑이 자연스레 흐르며, 사운드의 속도감과 쫄깃하고 트렌디한 질감을 조율합니다.`);
      }
      
      vocalDirection = parts.join('\n\n');
    }

    // 2) Storyboard Overwrite / Enhancement
    if (hasStoryboard) {
      const sit = input.situation!;
      const charA = sit.targetA || "화자";
      const charB = sit.targetB || "상대방";
      const rel = sit.relationship ? `${sit.relationship}` : "";
      const sitDesc = sit.description || "";
      const dev = sit.development || sit.developmentCustom || sit.developmentPreset || "";
      const details = sit.details || sit.detailCustom || "";
      
      // Sliders
      let dialogueText = "독백과 소통이 균형을 이루는 중간 형태";
      if (sit.storyDialogueBalance !== undefined) {
        if (sit.storyDialogueBalance > 7) {
          dialogueText = `${charA}의 깊은 내면에 머물며 지나간 순간을 조용히 되뇌며 긴 호흡으로 읊어 내리는 고독한 독백 구조의 노랫말`;
        } else if (sit.storyDialogueBalance < 4) {
          dialogueText = `${charA}와 ${charB}가 서로 대사를 주거니 받거니 하며 전개되는 한 편의 극적 연출과 같은 연극적 대화(티키타카) 구도`;
        } else {
          dialogueText = `말을 상대방에게 부드럽게 건네듯 풀어 나가며, 화자 스스로도 서정성에 젖는 조화롭고 자연스러운 복합 전개`;
        }
      }
      
      let realityText = "";
      if (sit.storyRealityScale !== undefined) {
        if (sit.storyRealityScale > 7) {
          realityText = "영화나 꿈속의 일들을 마주하는 듯 극적이고 아름답게 미화된 드라마틱 시네마 세계관";
        } else if (sit.storyRealityScale < 4) {
          realityText = "주변에서 쉽게 부딪히는 익숙하고 아기자기한 감정을 담담히 그리는 피부 밀착형 리얼리즘 일상";
        }
      }
      
      let sincereText = "";
      if (sit.storyPlayfulSincere !== undefined) {
        if (sit.storyPlayfulSincere > 7) {
          sincereText = "한 구절 한 소절마다 숨을 조심스레 고르고 깊고 무거운 마음의 진심만을 고백하는 애틋함";
        } else if (sit.storyPlayfulSincere < 4) {
          sincereText = "살짝 옅은 미소와 위트 있는 어구들을 군데군데 엮어 지나치게 무겁지 않게 청량감을 전하려는 센스";
        }
      }
      
      let speakerAttitudeText = "";
      if (sit.speakerAStyle || sit.speakerAAttitude || sit.attitudeA) {
        speakerAttitudeText = `${charA}는 주로 ${sit.speakerAStyle || ''} ${sit.speakerAAttitude || sit.attitudeA || ''} 태도를 유지하여 캐릭터에 생명을 불어넣습니다.`;
      }
      if (sit.speakerBStyle || sit.speakerBAttitude || sit.attitudeB) {
        speakerAttitudeText += ` 이에 화답하여 ${charB}는 ${sit.speakerBStyle || ''} ${sit.speakerBAttitude || sit.attitudeB || ''} 뉘앙스로 서로 대칭을 이룹니다.`;
      }
      
      let lyricParts: string[] = [
        `이번 트랙의 노랫말은 단순 장르의 전형적인 구성을 완전히 탈피하여, **${charA}와 ${charB} 두 사람의 ${rel || '아련한 서사'}**를 아름답고 촘촘하게 추종합니다.`,
      ];
      if (sitDesc) lyricParts.push(`**상황적 배경**: ${sitDesc}`);
      if (details) lyricParts.push(`**세부 묘사 스케치**: ${details}`);
      
      lyricParts.push(`**스토리 및 가사 전개 원칙**:`);
      lyricParts.push(`- **대화 및 소사**: ${dialogueText}`);
      if (realityText) lyricParts.push(`- **서사 강도**: ${realityText}`);
      if (sincereText) lyricParts.push(`- **정서 색감**: ${sincereText}`);
      if (speakerAttitudeText) lyricParts.push(`- **인물의 태도 및 대조**: ${speakerAttitudeText}`);
      
      lyricDirection = lyricParts.join('\n\n');

      // emotionalCore
      let emoParts: string[] = [];
      if (rel) emoParts.push(`${charA}와 ${charB}의 관계인 ${rel}의 기류`);
      if (sitDesc) emoParts.push(sitDesc);
      if (sincereText) emoParts.push(sincereText);
      
      if (emoParts.length > 0) {
        emotionalCore = `${emoParts.join(' 속에서 우러나오는 ')}를 배경으로 설계해 청중의 정적 자극을 극대화한 독창적인 마음 깊이`;
      }

      // arrangementFlow
      if (dev) {
        arrangementFlow = `스토리 극 전개 양상을 아름답게 대변해 주는 ${dev}의 흐름을 전조 삼아 엮어집니다. 이를 토대로, ${arrangementFlow}`;
      } else {
        arrangementFlow = `${charA}와 ${charB}의 극적인 심상 감정 흐름에 유기적으로 발맞추며 고조되었다가 담담히 수그러드는 전개를 바탕 삼고 있으며, ${arrangementFlow}`;
      }

      // finalImpression
      finalImpression = `단순한 한 곡의 가창을 넘어 ${charA}의 목소리를 빌려 전하는 아름다운 서정 단편소설 한 편을 감상한 듯한 깊은 영화적 아스라함과 온화한 울림의 순간`;
    }
  }

  // 3) Combined Summary Header Overwrite (genreDirection)
  // [STUDIO-010E-FIX-1 / v2] 짧고 세련된 매칭 장르 1줄 요약 구성 (기본 장르 + 스타일 퓨전 영향 반영)
  function formatStyleToGenreModifier(styleLabel: string): { prefix?: string; middle?: string } {
    const label = styleLabel.trim();
    if (label.includes("보컬") || label.includes("표현") || label.includes("가창") || label.includes("창법")) {
      if (label.includes("섬세한")) return { prefix: "섬세한" };
      if (label.includes("속삭임")) return { prefix: "나지막한" };
      if (label.includes("울먹이는")) return { prefix: "애절한" };
      if (label.includes("툭 던지는")) return { prefix: "덤덤한" };
      if (label.includes("눌러 참는")) return { prefix: "절제된" };
      if (label.includes("애원하는")) return { prefix: "간절한" };
      if (label.includes("차가운")) return { prefix: "차가운" };
      if (label.includes("무심한")) return { prefix: "무심한" };
      if (label.includes("나른한")) return { prefix: "나른한" };
      return {};
    }
    if (label === "브릿팝" || label === "Britpop") return { prefix: "브릿팝 감성의" };
    if (label === "록" || label === "Rock") return { prefix: "록 밴드 질감의" };
    if (label === "오케스트라") return { prefix: "웅장한 오케스트럴" };
    if (label.includes("피아노")) return { prefix: "피아노 선율의" };
    if (label === "베드룸 팝") return { prefix: "아늑한 베드룸" };
    if (label === "슈게이즈") return { prefix: "슈게이즈 풍의" };
    if (label === "앰비언트 팝") return { prefix: "몽환적인 앰비언트" };
    if (label.includes("허스키 R&B")) return { prefix: "허스키 R&B 감성의" };
    if (label.includes("다크 트랩") || label === "다크 트랩") return { middle: "다크 트랩" };
    if (label.includes("신스웨이브") || label.includes("신스")) return { prefix: "레트로 신스" };
    if (label.includes("붐뱁")) return { middle: "사이버 붐뱁" };
    if (label.includes("K-아이돌")) return { prefix: "K-아이돌 풍의" };
    if (label.includes("J-아이돌")) return { prefix: "J-아이돌 풍의" };
    if (label.includes("애니 오프닝")) return { prefix: "애니 오프닝 풍" };
    
    if (label.length <= 4) {
      return { prefix: `${label} 감성의` };
    }
    return { prefix: `${label} 스타일의` };
  }

  let moodPrefix = "";
  if (moods.length > 0) {
    const m = moods[0];
    const mId = m.id;
    const mLabel = m.label || "";
    if (mId === "hollow" || mLabel.includes("공허") || mLabel.includes("쓸쓸") || mLabel.includes("어두")) {
      moodPrefix = "어두운";
    } else if (mId === "warm" || mLabel.includes("따뜻") || mLabel.includes("편안") || mLabel.includes("포근")) {
      moodPrefix = "따뜻한";
    } else if (mId === "uneasy" || mLabel.includes("불안") || mLabel.includes("위태") || mLabel.includes("차가")) {
      moodPrefix = "차가운";
    } else if (mLabel.includes("몽환") || mLabel.includes("환상") || mLabel.includes("우주") || mLabel.includes("신비")) {
      moodPrefix = "몽환적인";
    } else if (mLabel.includes("청량") || mLabel.includes("시원") || mLabel.includes("맑")) {
      moodPrefix = "시원한";
    } else {
      moodPrefix = mLabel.endsWith("한") || mLabel.endsWith("운") || mLabel.endsWith("인") ? mLabel : `${mLabel} 감성의`;
    }
  }

  let stylePrefix = "";
  let styleMiddle = "";
  if (styles.length > 0) {
    const s1 = styles[0];
    const f1 = formatStyleToGenreModifier(s1.label);
    if (f1.prefix) stylePrefix = f1.prefix;
    if (f1.middle) styleMiddle = f1.middle;

    if (styles.length > 1) {
      const s2 = styles[1];
      const f2 = formatStyleToGenreModifier(s2.label);
      if (f2.prefix && !stylePrefix) {
        stylePrefix = f2.prefix;
      } else if (f2.prefix && stylePrefix && !stylePrefix.includes(f2.prefix.replace(" 감성의", ""))) {
        if (s1.label === "브릿팝" && s2.label === "록") {
          stylePrefix = "멜로딕 록 밴드";
        } else {
          stylePrefix = `${s1.label}·${s2.label} 풍의`;
        }
      }
      if (f2.middle && !styleMiddle) {
        styleMiddle = f2.middle;
      }
    }
  }

  let genreBaseName = "대중 팝";
  if (genres.length > 0) {
    const mainGenre = genres[0];
    let mainLabel = mainGenre.label || "";
    if (mainLabel === "네오소울") {
      mainLabel = "네오소울 R&B";
    }
    
    if (genres.length > 1) {
      let subLabel = genres[1].label || "";
      if (subLabel === "네오소울") subLabel = "네오소울";
      
      if (mainLabel.includes("R&B") && subLabel.includes("하우스")) {
        genreBaseName = "어쿠스틱 하우스 R&B";
      } else if (mainLabel.includes("R&B") && (subLabel.includes("힙합") || subLabel.includes("소울"))) {
        genreBaseName = "R&B 소울";
      } else {
        genreBaseName = `${mainLabel} ${subLabel}`;
      }
    } else {
      if (styles.length > 0) {
        const sL = styles[0].label || "";
        if (sL.includes("다크 트랩") && mainLabel.includes("R&B")) {
          genreBaseName = "다크 트랩 R&B";
          styleMiddle = ""; // already in genreBaseName
        } else if (sL.includes("신스웨이브") && mainLabel.includes("시티팝")) {
          genreBaseName = "시티팝";
          stylePrefix = "레트로 신스";
        } else if (sL.includes("붐뱁") && mainLabel.includes("힙합")) {
          genreBaseName = "붐뱁 힙합";
          styleMiddle = ""; // already in genreBaseName
        } else {
          genreBaseName = mainLabel;
        }
      } else {
        genreBaseName = mainLabel;
      }
    }
  }

  let generatedGenreStr = `${moodPrefix ? moodPrefix + ' ' : ''}${genreBaseName}`.trim();
  
  // Clean double spaces and duplicate words
  generatedGenreStr = generatedGenreStr.replace(/\s+/g, ' ');
  
  if (generatedGenreStr.startsWith("시원한 시원한")) {
    generatedGenreStr = generatedGenreStr.replace("시원한 시원한", "시원한");
  }
  if (generatedGenreStr.startsWith("레트로 레트로")) {
    generatedGenreStr = generatedGenreStr.replace("레트로 레트로", "레트로");
  }
  if (generatedGenreStr.startsWith("몽환적인 몽환적인")) {
    generatedGenreStr = generatedGenreStr.replace("몽환적인 몽환적인", "몽환적인");
  }

  genreDirection = generatedGenreStr;

  return {
    genreDirection,
    fusionDirection,
    styleFusionDirection,
    finalGenreInterpretation,
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
    moodId: moods.length > 0 ? moods[0].id : undefined,
    selectedMoods: moods.map(m => ({ id: m.id, label: m.label })),
    selectedThemes: themes.map(t => ({ id: t.id, label: t.label }))
  };
}

/**
 * Creates finalized presentational card strings from PreviewSongIntent
 * 대괄호 `[]` 기호를 전부 자연스럽게 탈피한 프리미엄 한국어 제작 브리핑을 조형합니다.
 */
export function renderPreviewCards(intent: PreviewSongIntent): PreviewCards {
  const instruments = intent.coreInstruments.length > 0 ? intent.coreInstruments.join(', ') : '주요 악기';

  let vocalAttitude = "보컬은 너무 튀지 않도록 전체 소리 뒤편에 자연스럽게 숨어 노래합니다.";

  const hasVocalMembers = intent.vocalMembers && intent.vocalMembers.length > 0;
  if (hasVocalMembers) {
    const firstMember = intent.vocalMembers![0];
    const genderLabel = firstMember.gender === 'male' ? '남성 보컬' : '여성 보컬';
    
    let styleText = "가까이에서 속삭이듯 말하듯 담담하게 가사를 들려줍니다.";
    const char = firstMember.character;
    if (char) {
      if (char.emotionLevel !== undefined && char.emotionLevel > 7) {
        styleText = "감정을 깊게 터뜨리며 슬프고 애절한 창법으로 노래를 부릅니다.";
      } else if (char.emotionLevel !== undefined && char.emotionLevel < 4) {
        styleText = "감정을 한껏 누그러뜨리고 편안하게 말하듯이 무심하게 가사를 전달합니다.";
      } else if (char.deliveryLevel !== undefined && char.deliveryLevel < 4) {
        styleText = "숨소리를 많이 보태어 귓가에 조용히 소통하듯 노래합니다.";
      } else if (char.rangeLevel !== undefined && char.rangeLevel > 7) {
        styleText = "시원하고 탄탄한 고음을 질러가며 노래의 분위기를 한층 돋웁니다.";
      }
    }
    
    if (intent.vocalMembers!.length === 2) {
      vocalAttitude = "두 보컬이 대화를 주고받듯 번갈아 노래를 불러 지루할 틈이 없습니다.";
    } else if (intent.vocalMembers!.length > 2) {
      vocalAttitude = "여러 명의 보컬이 입체적인 레이어를 쌓아가며 풍성한 소리를 냅니다.";
    } else {
      vocalAttitude = `${genderLabel}은 ${styleText}`;
    }
  } else {
    const isVocalDisabled = intent.warnings.some(w => w.includes("연주 전용") || w.includes("instrumental") || w.includes("가사가 없는"));
    if (isVocalDisabled) {
      vocalAttitude = "악기 소리로 채우는 연주 전용 트랙이라 가창 보컬은 따로 포함되지 않습니다.";
    }
  }

  let vibeFeeling = "전체적으로 아기자기하고 편안한 여운을 부드럽게 남깁니다.";
  if (intent.genreDirection.includes("어두운") || intent.genreDirection.includes("차가운")) {
    vibeFeeling = "전체적으로 쓸쓸하고 차가우면서도 깊은 여운을 끝까지 끌고 갑니다.";
  } else if (intent.genreDirection.includes("몽환적인")) {
    vibeFeeling = "전체적으로 꿈을 꾸듯 묘하고 아름다운 분위기를 끝까지 풍깁니다.";
  } else if (intent.genreDirection.includes("시원한")) {
    vibeFeeling = "전체적으로 막힌 가슴이 다 뚫릴 만큼 시원하고 청량한 느낌을 안겨줍니다.";
  } else if (intent.genreDirection.includes("따뜻한") || intent.genreDirection.includes("포근한")) {
    vibeFeeling = "전체적으로 마음이 한결 다정해지고 고요해지는 기분 좋은 편안함이 느껴집니다.";
  }

  const interpretationSummary = `이 곡은 ${intent.genreDirection} 스타일의 음악입니다. 주요 악기로는 ${instruments} 연주를 중심에 두고 흘러갑니다.`;

  // 1) S1: Air and Temp based on Mood + Instruments
  let s1 = "";
  const instText = intent.coreInstruments && intent.coreInstruments.length > 1 
    ? `${intent.coreInstruments[0]}와 ${intent.coreInstruments[1]}`
    : (intent.coreInstruments && intent.coreInstruments[0] ? intent.coreInstruments[0] : "악기 소리");

  const moodId = intent.moodId || (intent.selectedMoods && intent.selectedMoods.length > 0 ? intent.selectedMoods[0].id : "");
  
  const isHollow = moodId === 'hollow' || intent.genreDirection.includes("어두운") || intent.genreDirection.includes("차가운");
  const isWarm = moodId === 'warm' || moodId === 'coziness' || moodId === 'soft_tender' || moodId === 'tender' || moodId === 'healing' || intent.genreDirection.includes("따뜻한") || intent.genreDirection.includes("포근한");
  const isUneasy = moodId === 'uneasy';
  const isBright = moodId === 'bright' || moodId === 'hopeful' || moodId === 'cheerful';

  if (isHollow) {
    s1 = `${instText} 소리가 빗소리처럼 차분하고 쓸쓸하게 섞여 깊은 밤 같은 공기를 만듭니다.`;
  } else if (isWarm) {
    s1 = `포근한 ${instText} 선율이 어우러지며 따뜻하고 아늑한 방 안 같은 온기를 가득 안겨줍니다.`;
  } else if (isUneasy) {
    s1 = `어쿠스틱 편곡과 서늘하게 메아리치는 ${instText}가 섞여 서늘하고 위태로운 긴장의 공기를 자아냅니다.`;
  } else if (isBright) {
    s1 = `맑은 ${instText} 울림이 아침 햇살처럼 환하고 다정한 밝기의 온기를 만들어 냅니다.`;
  } else {
    s1 = `단정한 ${instText} 선율이 부드럽게 감돌며 모나지 않고 차분히 정돈된 온도의 공기가 흐릅니다.`;
  }

  // 2) S2: Emotion & Brightness & Weight (using Theme for emotional direction, or default weight balance)
  let s2 = "리듬은 자연스럽게 움직이지만 전체 분위기는 안정적이고 가볍지 않게 무게 중심을 잡아줍니다.";
  const mainThemeId = intent.selectedThemes && intent.selectedThemes.length > 0 ? intent.selectedThemes[0].id : "";
  const themeLabel = intent.selectedThemes && intent.selectedThemes.length > 0 ? intent.selectedThemes[0].label : "";

  if (mainThemeId === 'rain' || themeLabel.includes('비')) {
    s2 = "비 오는 날처럼 차분하게 가라앉은 그리움이 담겨 있어, 밝기보다는 차분하고 촉촉한 슬픔이 흐릅니다.";
  } else if (mainThemeId === 'hometown' || mainThemeId === 'memory' || themeLabel.includes('고향') || themeLabel.includes('추억') || themeLabel.includes('기억')) {
    s2 = "고향과 지나간 추억을 떠올리는 정서가 묻어나, 가만히 머무는 그리운 감점에 깊은 무게감이 느껴집니다.";
  } else if (mainThemeId === 'fantasy' || mainThemeId === 'fantasy_bgm' || mainThemeId === 'dark_fantasy' || themeLabel.includes('판타지')) {
    s2 = "현실에서 잠시 벗어난 듯 신비롭고 묘한 감성선이 은은하게 번져, 밝고 가벼운 느낌과는 거리가 멉니다.";
  } else if (mainThemeId === 'love' || mainThemeId === 'crush' || mainThemeId === 'excitement' || mainThemeId === 'confession' || themeLabel.includes('사랑') || themeLabel.includes('설렘') || themeLabel.includes('고백')) {
    s2 = "사랑하는 이를 그려보는 다정한 마음에 발맞추어, 무게감보다는 몽글몽글한 미소가 번지는 밝은 분위기로 채워집니다.";
  } else if (mainThemeId === 'separation' || mainThemeId === 'regret' || mainThemeId === 'loneliness' || themeLabel.includes('이별') || themeLabel.includes('후회') || themeLabel.includes('외로움') || themeLabel.includes('슬픔')) {
    s2 = "가슴에 남은 머뭇거림이나 홀로 남은 쓸쓸함이 녹아 있어, 온도가 내려가며 한결 차분해진 감정의 두터운 단면이 보입니다.";
  }

  // 3) S3: Space, Distance, or Overall layout (Close or Spacious)
  let s3 = "소리가 귀에 선명하고 또렷하게 닿아 친숙하고 편안하게 스며드는 거리감을 형성합니다.";
  
  if (isHollow || mainThemeId === 'fantasy' || mainThemeId === 'dark_fantasy') {
    s3 = "공간감이 넓게 은은히 퍼지는 구조라 한 걸음 떨어진 채 바라보는 신비롭고 먼 거리감이 느껴집니다.";
  } else if (isWarm || moodId === 'coziness' || moodId === 'calm' || mainThemeId === 'love') {
    s3 = "공간감은 방 안처럼 좁고 아늑한 편이라 바로 옆에서 도란도란 이야기를 나누는 듯한 부드럽고 가까운 거리감입니다.";
  } else if (isUneasy) {
    s3 = "소리는 가깝게 다가오지만 잔향 폭이 넓고 날카롭게 뻗어가 팽팽한 긴장을 유지하는 거리감을 이룹니다.";
  } else if (isBright) {
    s3 = "바람이 불어오듯 시원하게 귓가를 관통하여 가사에 집중도가 높은 선명하고 기분 좋은 거리감을 보입니다.";
  }

  const expectedAtmosphere = `${s1} ${s2} ${s3}`;

  const expectedVocals = intent.vocalDirection;

  const expectedArrangement = intent.arrangementFlow;

  const expectedLyrics = intent.lyricDirection;

  const pointsToNote: string[] = [];

  if (intent.warnings.length > 0) {
    pointsToNote.push(...intent.warnings);
  }

  return {
    genreStr: intent.genreDirection,
    interpretationSummary,
    expectedAtmosphere,
    expectedVocals,
    expectedArrangement,
    expectedLyrics,
    pointsToNote
  };
}
