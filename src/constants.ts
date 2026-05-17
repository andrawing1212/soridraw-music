// SORIDRAW_TEXTURE_FX_FOLEY_EXPAND_V25
import {
  CategoryItem,
  GenreGroup,
  InstrumentSoundCycle,
  InstrumentSoundItem,
  SoundStyleCycle,
  SoundStyleItem,
  GenreGroupItem,
} from './types';

export const GENRES: CategoryItem[] = [
  { id: 'pop', label: 'Pop', labelKo: '팝', description: '가장 보편적이고 대중적인 팝 사운드입니다.' },
  { id: 'dance-pop', label: 'Dance Pop', labelKo: '댄스 팝', description: '강한 훅과 리듬감이 있는 대중적인 댄스 팝입니다.' },
  { id: 'synth-pop', label: 'Synth Pop', labelKo: '신스 팝', description: '신디사이저 중심의 세련된 팝 사운드입니다.' },
  { id: 'teen-pop', label: 'Teen Pop', labelKo: '틴 팝', description: '밝고 접근성이 높은 틴 팝 스타일입니다.' },
  { id: 'kpop', label: 'K-Pop', labelKo: 'K-팝', description: '한국 대중음악 기반의 세련된 사운드입니다.' },
  { id: 'jpop', label: 'J-Pop', labelKo: 'J-팝', description: '일본 대중음악 특유의 멜로디와 편곡이 특징입니다.' },
  { id: 'citypop', label: 'City Pop', labelKo: '시티팝', description: '도시적인 레트로 감성과 세련된 그루브가 중심인 시티팝입니다.' },
  { id: 'piano-ballad', label: 'Piano Ballad', labelKo: '피아노 발라드', description: '피아노 중심의 감성적인 발라드입니다.' },
  { id: 'adult-contemporary', label: 'Adult Contemporary', labelKo: '어덜트 컨템퍼러리', description: '부드럽고 안정적인 성인 취향의 팝입니다.' },
  { id: 'indie-pop', label: 'Indie Pop', labelKo: '인디 팝', description: '감각적인 인디 팝 스타일입니다.' },
  { id: 'chamber-pop', label: 'Chamber Pop', labelKo: '챔버 팝', description: '현악기와 섬세한 편곡이 특징인 팝입니다.' },

  { id: 'grunge', label: 'Grunge', labelKo: '그랜지', description: '거칠고 무거운 얼터너티브 록 스타일입니다.' },
  { id: 'britpop', label: 'Britpop', labelKo: '브릿팝', description: '영국식 멜로디와 밴드 감성이 특징입니다.' },
  { id: 'shoegaze', label: 'Shoegaze', labelKo: '슈게이즈', description: '공간감 있는 기타 레이어가 중심인 록입니다.' },
  { id: 'post-rock', label: 'Post Rock', labelKo: '포스트 록', description: '서사적 전개와 질감 중심의 록입니다.' },
  { id: 'punk-rock', label: 'Punk Rock', labelKo: '펑크 록', description: '빠르고 직선적인 밴드 에너지가 특징입니다.' },
  { id: 'heavy-metal', label: 'Heavy Metal', labelKo: '헤비 메탈', description: '강한 기타 리프와 묵직한 에너지의 메탈입니다.' },
  { id: 'thrash-metal', label: 'Thrash Metal', labelKo: '스래시 메탈', description: '빠르고 공격적인 메탈 스타일입니다.' },
  { id: 'death-metal', label: 'Death Metal', labelKo: '데스 메탈', description: '극단적으로 무겁고 강렬한 메탈입니다.' },
  { id: 'progressive-rock', label: 'Progressive Rock', labelKo: '프로그레시브 록', description: '복잡한 구성과 전개가 특징인 록입니다.' },
  { id: 'psychedelic-rock', label: 'Psychedelic Rock', labelKo: '사이케델릭 록', description: '몽환적이고 실험적인 록 스타일입니다.' },

  { id: 'boom-bap', label: 'Boom Bap', labelKo: '붐뱁', description: '클래식한 힙합 드럼과 샘플 기반 스타일입니다.' },
  { id: 'trap', label: 'Trap', labelKo: '트랩', description: '묵직한 808과 빠른 하이햇이 특징인 힙합입니다.' },
  { id: 'drill', label: 'Drill', labelKo: '드릴', description: '어둡고 공격적인 리듬 중심 힙합입니다.' },
  { id: 'gangsta-rap', label: 'Gangsta Rap', labelKo: '갱스터 랩', description: '강한 태도와 직설적인 에너지가 특징입니다.' },
  { id: 'lofi-hiphop', label: 'Lo-fi Hip-Hop', labelKo: '로파이 힙합', description: '질감 있는 빈티지 톤의 로파이 힙합입니다.' },
  { id: 'contemporary-rnb', label: 'Contemporary R&B', labelKo: '컨템퍼러리 R&B', description: '현대적인 R&B 보컬과 그루브가 중심입니다.' },
  { id: 'motown', label: 'Motown', labelKo: '모타운', description: '클래식 소울과 그루브 중심의 스타일입니다.' },
  { id: 'gospel', label: 'Gospel', labelKo: '가스펠', description: '복음성가 기반의 감정적인 보컬 음악입니다.' },
  { id: 'funk-rnb', label: 'Funk', labelKo: '펑크', description: '리듬과 베이스가 살아 있는 펑크 기반 음악입니다.' },
  { id: 'pb-rnb', label: 'PBR&B', labelKo: 'PBR&B', description: '어둡고 몽환적인 질감의 현대적 R&B입니다.' },
  { id: 'jazz-hiphop', label: 'Jazz Hip-Hop', labelKo: '재즈 힙합', description: '재즈 화성과 힙합 리듬이 결합된 스타일입니다.' },
  { id: 'neo-soul', label: 'Neo Soul', labelKo: '네오 소울', description: 'R&B, 소울, 재즈가 섞인 깊이 있는 그루브입니다.' },
  { id: 'hiphop', label: 'Hip-hop', labelKo: '힙합', description: '리듬과 비트, 래핑이 중심인 힙합 사운드입니다.' },
  { id: 'rnb', label: 'R&B', labelKo: 'R&B', description: '감미로운 보컬과 그루브가 특징인 알앤비 사운드입니다.' },
  { id: 'rock', label: 'Rock', labelKo: '록', description: '강렬한 기타와 밴드 사운드가 중심인 록 음악입니다.' },
  { id: 'metal', label: 'Metal', labelKo: '메탈', description: '폭발적인 에너지와 강한 디스토션의 메탈 사운드입니다.' },

  { id: 'house', label: 'House', labelKo: '하우스', description: '4/4 클럽 그루브 중심의 전자 음악입니다.' },
  { id: 'techno', label: 'Techno', labelKo: '테크노', description: '반복적이고 몰입감 있는 전자 리듬이 특징입니다.' },
  { id: 'trance', label: 'Trance', labelKo: '트랜스', description: '상승감과 몰입감이 강한 전자 음악입니다.' },
  { id: 'dubstep', label: 'Dubstep', labelKo: '덥스텝', description: '강한 드롭과 베이스 변형이 특징입니다.' },
  { id: 'drum-and-bass', label: 'Drum & Bass', labelKo: '드럼 앤 베이스', description: '빠른 브레이크비트와 베이스가 중심입니다.' },
  { id: 'future-bass', label: 'Future Bass', labelKo: '퓨처 베이스', description: '현대적 신스와 감성적인 드롭이 특징입니다.' },
  { id: 'ambient-electronic', label: 'Ambient', labelKo: '앰비언트', description: '공간감과 질감 중심의 전자 음악입니다.' },
  { id: 'vaporwave', label: 'Vaporwave', labelKo: '베이퍼웨이브', description: '레트로하고 몽환적인 디지털 감성이 특징입니다.' },
  { id: 'electro-pop', label: 'Electro Pop', labelKo: '일렉트로 팝', description: '팝 감성과 전자 사운드가 결합된 스타일입니다.' },
  { id: 'eurobeat', label: 'Eurobeat', labelKo: '유로비트', description: '고속 비트와 강한 멜로디가 특징입니다.' },
  { id: 'edm', label: 'EDM', labelKo: 'EDM', description: '클럽과 페스티벌을 위한 강렬한 전자 댄스 음악입니다.' },

  { id: 'swing', label: 'Swing', labelKo: '스윙', description: '스윙 리듬이 살아 있는 전통 재즈입니다.' },
  { id: 'bebop', label: 'Bebop', labelKo: '비밥', description: '복잡한 즉흥성과 빠른 전개가 특징입니다.' },
  { id: 'cool-jazz', label: 'Cool Jazz', labelKo: '쿨 재즈', description: '차분하고 세련된 재즈 스타일입니다.' },
  { id: 'hard-bop', label: 'Hard Bop', labelKo: '하드 밥', description: '블루스와 소울 감성이 섞인 재즈입니다.' },
  { id: 'free-jazz', label: 'Free Jazz', labelKo: '프리 재즈', description: '자유롭고 실험적인 재즈입니다.' },
  { id: 'fusion-jazz', label: 'Fusion Jazz', labelKo: '퓨전 재즈', description: '록/전자 요소가 섞인 현대적 재즈입니다.' },
  { id: 'bossanova', label: 'Bossanova', labelKo: '보사노바', description: '브라질 리듬과 재즈가 결합된 부드러운 스타일입니다.' },
  { id: 'acid-jazz', label: 'Acid Jazz', labelKo: '애시드 재즈', description: '재즈와 펑크/그루브가 결합된 스타일입니다.' },
  { id: 'delta-blues', label: 'Delta Blues', labelKo: '델타 블루스', description: '전통적인 블루스 루츠 스타일입니다.' },
  { id: 'chicago-blues', label: 'Chicago Blues', labelKo: '시카고 블루스', description: '전기 블루스 중심의 도시적 블루스입니다.' },
  { id: 'jazz', label: 'Jazz', labelKo: '재즈', description: '즉흥 연주와 세련된 화성이 특징인 재즈 사운드입니다.' },
  { id: 'classical', label: 'Classical', labelKo: '클래식', description: '우아하고 웅장한 클래식 오케스트레이션 사운드입니다.' },

  { id: 'modern-folk', label: 'Modern Folk', labelKo: '모던 포크', description: '현대적으로 다듬어진 포크 스타일입니다.' },
  { id: 'anti-folk', label: 'Anti-Folk', labelKo: '안티 포크', description: '거칠고 솔직한 감성의 포크 스타일입니다.' },
  { id: 'folk-rock', label: 'Folk Rock', labelKo: '포크 록', description: '포크와 록이 결합된 밴드 기반 스타일입니다.' },
  { id: 'singer-songwriter', label: 'Singer-Songwriter', labelKo: '싱어송라이터', description: '서사적 가사와 자전적 감성이 중심입니다.' },
  { id: 'world-music', label: 'World Music', labelKo: '월드 뮤직', description: '세계 각국의 전통 음악 요소가 반영된 스타일입니다.' },
  { id: 'country-pop', label: 'Country Pop', labelKo: '컨트리 팝', description: '컨트리 감성과 팝 감성이 결합된 스타일입니다.' },
  { id: 'bluegrass', label: 'Bluegrass', labelKo: '블루그래스', description: '빠른 현악기 중심의 전통 컨트리 스타일입니다.' },
  { id: 'americana', label: 'Americana', labelKo: '아메리카나', description: '미국 루츠 음악 전반을 포괄하는 스타일입니다.' },
  { id: 'honky-tonk', label: 'Honky-Tonk', labelKo: '홍키통크', description: '경쾌한 피아노와 컨트리 감성이 특징입니다.' },
  { id: 'southern-rock', label: 'Southern Rock', labelKo: '서던 록', description: '남부 록 감성과 블루스가 결합된 스타일입니다.' },
  { id: 'acoustic_folk', label: 'Acoustic Folk', labelKo: '어쿠스틱 포크', description: '따뜻한 어쿠스틱 악기와 진솔한 감성의 포크입니다.' },
  { id: 'world_music_folk', label: 'World Music', labelKo: '월드 뮤직', description: '세계 각국의 전통적인 색채와 리듬이 담긴 음악입니다.' },

  { id: 'traditional-trot', label: 'Traditional Trot', labelKo: '정통 트로트', description: '전통 트로트의 깊은 감성이 살아 있는 스타일입니다.' },
  { id: 'semi-trot', label: 'Semi-Trot', labelKo: '세미 트로트', description: '현대적으로 다듬어진 대중적 트로트 스타일입니다.' },
  { id: 'trot', label: 'Trot', labelKo: '트로트', description: '한국 특유의 정서와 흥이 담긴 트로트 사운드입니다.' },
  { id: '7080_gayo', label: '7080 Gayo', labelKo: '7080 가요', description: '70~80년대 한국 가요의 아날로그 복고 감성입니다.' },
  { id: 'ost', label: 'OST', labelKo: 'OST', description: '영화나 드라마의 서사를 완성하는 배경음악 스타일입니다.' },

  { id: 'film-score', label: 'Film Score', labelKo: '필름 스코어', description: '영화 음악 스타일의 서사적 구성입니다.' },
  { id: 'game-bgm', label: 'Game BGM', labelKo: '게임 BGM', description: '게임 배경음악 스타일입니다.' },
  { id: 'drama-theme', label: 'Drama Theme', labelKo: '드라마 테마', description: '드라마 OST 스타일의 감성적인 테마곡입니다.' },
  { id: 'piano-instrumental', label: 'Piano', labelKo: '피아노 연주', description: '피아노 중심의 연주곡입니다.' },
  { id: 'guitar-instrumental', label: 'Guitar', labelKo: '기타 연주', description: '기타 중심의 연주곡입니다.' },
  { id: 'lofi-instrumental', label: 'Lo-fi', labelKo: '로파이 연주', description: '로파이 질감 중심의 연주곡입니다.' },
  { id: 'healing-music', label: 'Healing Music', labelKo: '힐링 뮤직', description: '휴식과 안정감을 위한 기능성 음악입니다.' },
  { id: 'meditation-music', label: 'Meditation Music', labelKo: '명상 음악', description: '명상과 집중을 위한 기능성 음악입니다.' },
  { id: 'ambient-newage', label: 'Ambient New Age', labelKo: '앰비언트 뉴에이지', description: '앰비언트/뉴에이지 계열의 평온한 음악입니다.' },
];

function groupChildren(ids: string[]) {
  return GENRES.filter((item) => ids.includes(item.id)).map((item) => ({
    ...item,
    promptCore: `Base genre identity: ${item.label}. ${item.description}`,
  }));
}

export const GENRE_GROUPS: GenreGroup[] = [
  {
    id: 'pop',
    label: 'Pop',
    labelKo: '팝',
    description: '가장 대중적이며 상업적인 성공을 목적으로 하는 음악군입니다.',
    children: groupChildren([
      'pop','dance-pop','synth-pop','teen-pop','kpop','jpop','citypop','piano-ballad','adult-contemporary','indie-pop','chamber-pop',
    ]),
  },
  {
    id: 'rock',
    label: 'Rock & Metal',
    labelKo: '록 & 메탈',
    description: '기타, 베이스, 드럼의 강렬한 사운드와 저항 정신을 기반으로 합니다.',
    children: groupChildren([
      'grunge','britpop','shoegaze','post-rock','punk-rock','heavy-metal','thrash-metal','death-metal','progressive-rock','psychedelic-rock',
    ]),
  },
  {
    id: 'hiphop',
    label: 'Hip-hop & R&B',
    labelKo: '힙합 & R&B',
    description: '리듬과 그루브, 라임과 비트를 강조하는 블랙 뮤직의 핵심입니다.',
    children: groupChildren([
      'boom-bap','trap','drill','gangsta-rap','lofi-hiphop','contemporary-rnb','motown','gospel','funk-rnb','pb-rnb','jazz-hiphop','neo-soul',
    ]),
  },
  {
    id: 'electronic',
    label: 'Electronic / EDM',
    labelKo: '일렉트로닉 / EDM',
    description: '컴퓨터와 신디사이저를 활용한 사운드 디자인 중심의 음악입니다.',
    children: groupChildren([
      'house','techno','trance','dubstep','drum-and-bass','future-bass','ambient-electronic','vaporwave','electro-pop','eurobeat',
    ]),
  },
  {
    id: 'jazz-blues',
    label: 'Jazz & Blues',
    labelKo: '재즈 & 블루스',
    description: '즉흥 연주와 독특한 화성 체계를 가진 현대 대중음악의 뿌리입니다.',
    children: groupChildren([
      'swing','bebop','cool-jazz','hard-bop','free-jazz','fusion-jazz','bossanova','acid-jazz','delta-blues','chicago-blues',
    ]),
  },
  {
    id: 'folk-country',
    label: 'Folk & Country',
    labelKo: '포크 & 컨트리',
    description: '전통적인 악기와 서사적인 가사를 중시하는 음악군입니다.',
    children: groupChildren([
      'modern-folk','anti-folk','folk-rock','singer-songwriter','world-music','country-pop','bluegrass','americana','honky-tonk','southern-rock',
    ]),
  },
  {
    id: 'trot',
    label: 'Trot',
    labelKo: '트로트',
    description: '트로트 고유의 꺾기와 감정선, 대중적인 흥을 중심으로 한 음악군입니다.',
    children: groupChildren(['traditional-trot','semi-trot']),
  },
  {
    id: 'soundtrack-ost',
    label: 'Soundtrack / OST',
    labelKo: '사운드트랙 / OST',
    description: '영상음악과 기능성 음악 등 용도 기반 분류입니다.',
    children: groupChildren([
      'film-score','game-bgm','drama-theme','piano-instrumental','guitar-instrumental','lofi-instrumental','healing-music','meditation-music','ambient-newage',
    ]),
  },
];

// SORIDRAW_STYLE_SOUND_ORDERED_CONCISE_V8: reorder style/sound variants by genre/instrument family and shorten sound promptCore keywords.
// SORIDRAW_STYLE_KEYWORD_PREFIX_V5: show the exact English prompt keyword at the start of each Korean description.
// 1차 수정: 삭제/대규모 이동 없이, 장르/질감 판단을 쉽게 하도록 설명 앞에 영문 적용 키워드를 노출합니다.
// Boom Bap은 힙합 하위 장르이므로 Jazz & Groove에서 Hip-hop & Dance로 이동했습니다.
// SORIDRAW_STYLE_MENU_LAYOUT_V4_HIPHOP_DANCE_JAZZ_GROOVE: rename and move variants only; ids preserved.
// SORIDRAW_LIVE_BAND_RECLASS_V13: live band folder keeps only band genre/style items; piano/space/arrangement items moved.
// SORIDRAW_ERA_TEXTURE_LABEL_FIX_V15: era texture titles localized to Korean and prompt keywords shortened without the word era.
// SORIDRAW_TEXTURE_FX_TRANSITION_EXPAND_V26: adds common transition/electronic FX to Texture FX with compact prompt keywords.
export const STYLE_CYCLES: SoundStyleCycle[] = [
  // SORIDRAW_STYLE_GROOVE_SOUND_RECLASS_V9: left-side style categories keep real genre items; groove feel gets its own category; sound/instrument texture items move to Sound.
  {
    id: 'fusion-genre',
    title: 'Fusion Genre',
    titleKo: '퓨전 장르',
    variants: [
      { id: 'separator-style-fusion-idol-jpop', kind: 'separator', label: '아이돌/J-Pop', labelKo: '아이돌/J-Pop', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-k-idol-pop', label: 'K-Idol Pop', labelKo: 'K-아이돌 팝', description: 'K-idol style polish with sharp sections and catchy hooks.', descriptionKo: 'K-Idol Pop - 선명한 섹션 대비와 중독적인 훅이 있는 K-아이돌식 팝 감성입니다.', style: 'K-Idol Pop fusion', sound: 'polished synths, punchy drums, sharp hook layers', mood: 'bright, energetic' },
      { id: 'fusion-j-idol-pop', label: 'J-Idol Pop', labelKo: 'J-아이돌 팝', description: 'Japanese idol-pop brightness with melodic lift and cute energy.', descriptionKo: 'J-Idol Pop - 밝은 멜로디 상승감과 산뜻한 J-아이돌 팝 감성입니다.', style: 'J-Idol Pop fusion', sound: 'sparkling synths, bright drums, melodic hook layers', mood: 'bright, cute' },
      { id: 'fusion-jpop-anime-opening', label: 'J-Pop Anime Opening', labelKo: 'J-Pop 애니 오프닝', description: 'Anime-opening style melodic rush with bright band-pop lift.', descriptionKo: 'J-Pop Anime Opening - 애니 오프닝처럼 빠르게 치고 올라가는 밝은 밴드팝 감성입니다.', style: 'J-Pop Anime Opening fusion', sound: 'fast band-pop drums, bright guitars, soaring synth layers', mood: 'uplifting, dramatic' },
      { id: 'fusion-anisong-pop', label: 'Anisong Pop', labelKo: '애니송 팝', description: 'Anime-song pop color with dramatic melody and emotional hooks.', descriptionKo: 'Anisong Pop - 극적인 멜로디와 감정적인 훅이 살아있는 애니송 팝 색채입니다.', style: 'Anisong Pop fusion', sound: 'bright pop-rock drums, emotional synth strings, melodic hooks', mood: 'dramatic, bright' },
      { id: 'fusion-vocaloid-style', label: 'Vocaloid Style', labelKo: '보컬로이드 스타일', description: 'Fast digital J-pop color with synthetic vocal-friendly motion.', descriptionKo: 'Vocaloid Style - 빠르고 디지털한 J-pop 질감과 보컬로이드식 전개감을 더합니다.', style: 'Vocaloid Style fusion', sound: 'fast digital synths, sharp drums, playful arps', mood: 'energetic, synthetic' },
      { id: 'separator-style-fusion-band-rock', kind: 'separator', label: '밴드/록', labelKo: '밴드/록', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-britpop', label: 'Britpop', labelKo: '브릿팝', description: 'British melodic band-pop color with guitar-driven lift.', descriptionKo: 'Britpop - 영국식 멜로디와 기타 중심 밴드팝 감성을 더합니다.', style: 'Britpop fusion', sound: 'jangly guitars, live drums, melodic bass', mood: 'confident, nostalgic' },
      { id: 'fusion-rock', label: 'Rock', labelKo: '록', description: 'Rock band energy with guitar-driven arrangement power.', descriptionKo: 'Rock - 기타 중심의 밴드 에너지와 강한 전개감을 더합니다.', style: 'Rock fusion', sound: 'electric guitars, live drums, driving bass', mood: 'energetic, raw' },
      { id: 'separator-style-fusion-orchestral-acoustic', kind: 'separator', label: '오케스트라/어쿠스틱', labelKo: '오케스트라/어쿠스틱', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-orchestral', label: 'Orchestral', labelKo: '오케스트라', description: 'Orchestral scale and cinematic harmonic depth.', descriptionKo: 'Orchestral - 오케스트라의 웅장함과 영화적인 화성감을 더합니다.', style: 'Orchestral fusion', sound: 'strings, brass, cinematic percussion', mood: 'grand, dramatic' },
      { id: 'fusion-acoustic-piano', label: 'Acoustic Piano', labelKo: '어쿠스틱 피아노', description: 'Piano-led acoustic fusion with intimate melodic weight.', descriptionKo: 'Acoustic Piano - 피아노 중심의 어쿠스틱 감성과 선율 중심 무게감을 더합니다.', style: 'Acoustic Piano fusion', sound: 'acoustic piano, soft room tone, gentle sustain', mood: 'intimate, emotional' },
      { id: 'separator-style-fusion-indie-space', kind: 'separator', label: '인디/공간 팝', labelKo: '인디/공간 팝', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-bedroom-pop', label: 'Bedroom Pop', labelKo: '베드룸 팝', description: 'Intimate DIY pop color with close, small-room warmth.', descriptionKo: 'Bedroom Pop - 방 안에서 녹음한 듯한 밀착감과 DIY 팝 감성을 더합니다.', style: 'Bedroom Pop fusion', sound: 'close-mic vocals, soft synths, small-room warmth', mood: 'intimate, lo-fi' },
      { id: 'fusion-shoegaze', label: 'Shoegaze', labelKo: '슈게이즈', description: 'Guitar haze and spatial wall-of-sound texture.', descriptionKo: 'Shoegaze - 기타 노이즈와 넓은 공간감이 쌓이는 슈게이즈 질감입니다.', style: 'Shoegaze fusion', sound: 'washed guitars, wide reverb, layered noise wall', mood: 'hazy, immersive' },
      { id: 'fusion-ambient-pop', label: 'Ambient Pop', labelKo: '앰비언트 팝', description: 'Pop structure softened by ambient atmosphere and spacious texture.', descriptionKo: 'Ambient Pop - 팝 구조에 앰비언트한 공간감과 부드러운 질감을 더합니다.', style: 'Ambient Pop fusion', sound: 'ambient pads, soft pulses, spacious texture', mood: 'floating, calm' },
      { id: 'separator-style-fusion-world-pop', kind: 'separator', label: '월드 팝', labelKo: '월드 팝', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-bollywood-pop', label: 'Bollywood Pop', labelKo: '볼리우드 팝', description: 'Indian pop color with bright rhythm and cinematic melodic lift.', descriptionKo: 'Bollywood Pop - 인도 팝 특유의 밝은 리듬과 영화적인 멜로디 상승감을 더합니다.', style: 'Bollywood Pop fusion', sound: 'tabla accents, bright strings, cinematic pop drums', mood: 'colorful, dramatic' },
      { id: 'fusion-arab-pop', label: 'Arab Pop', labelKo: '아랍 팝', description: 'Arab pop melodic color with ornamental phrasing and percussion.', descriptionKo: 'Arab Pop - 아랍 팝 특유의 장식적인 선율감과 퍼커션 색채를 더합니다.', style: 'Arab Pop fusion', sound: 'middle eastern percussion, ornamental melodic lines, warm strings', mood: 'exotic, dramatic' }
    ],
  },
  {
    id: 'vocal-expression',
    title: 'Vocal Line',
    titleKo: '보컬 라인',
    variants: [
      { id: 'separator-style-vocal-emotion', kind: 'separator', label: '감정 표현', labelKo: '감정 표현', description: '', descriptionKo: '', promptCore: '' },
      { id: 'vocal-delicate', label: 'Delicate Vocal Expression', labelKo: '섬세한 보컬', description: 'Soft and detailed vocal expression with emotional control.', descriptionKo: 'Delicate Vocal Expression - 보컬의 결을 섬세하게 살리는 표현감입니다.', style: 'delicate vocal expression', sound: 'vocal-forward focus with soft dynamics', mood: 'intimate, expressive' },
      { id: 'vocal-emotional-rise', label: 'Emotional Vocal Rise', labelKo: '감정 고조', description: 'Gradually rising vocal emotion toward a stronger payoff.', descriptionKo: 'Emotional Vocal Rise - 후반으로 갈수록 감정이 점점 고조되는 보컬 표현입니다.', style: 'gradual emotional vocal rise', sound: 'building vocal intensity', mood: 'emotional, rising' },
      { id: 'vocal-whisper-expression', label: 'Whispered Vocal Feel', labelKo: '속삭임 표현', description: 'Breathy, close vocal expression like a whisper.', descriptionKo: 'Whispered Vocal Feel - 가까이서 속삭이는 듯한 보컬 표현감을 더합니다.', style: 'whispered vocal expression', sound: 'breathy close-mic vocal texture', mood: 'intimate, quiet' },
      { id: 'vocal-teary-expression', label: 'Tearful Vocal Feel', labelKo: '울먹이는 표현', description: 'Vocal phrasing that feels close to tears without overacting.', descriptionKo: 'Tearful Vocal Feel - 과하지 않게 울먹임이 묻어나는 보컬 표현입니다.', style: 'tearful vocal phrasing', sound: 'slightly trembling vocal detail', mood: 'fragile, aching' },
      { id: 'separator-style-vocal-attitude-tone', kind: 'separator', label: '태도/온도', labelKo: '태도/온도', description: '', descriptionKo: '', promptCore: '' },
      { id: 'vocal-tossed-off', label: 'Tossed-off Vocal Feel', labelKo: '툭 던지는 표현', description: 'Casual vocal phrasing that sounds emotionally understated.', descriptionKo: 'Tossed-off Vocal Feel - 감정을 과하게 밀지 않고 툭 놓고 부르는 느낌입니다.', style: 'tossed-off vocal phrasing', sound: 'understated vocal delivery', mood: 'dry, casual' },
      { id: 'vocal-held-back', label: 'Held-back Vocal Feel', labelKo: '눌러 참는 표현', description: 'Restrained vocal emotion that feels held inside.', descriptionKo: 'Held-back Vocal Feel - 감정을 누르고 참는 듯한 보컬 표현입니다.', style: 'held-back vocal emotion', sound: 'controlled tension in the vocal line', mood: 'restrained, tense' },
      { id: 'vocal-pleading', label: 'Pleading Vocal Feel', labelKo: '애원하는 표현', description: 'Vocal expression with a pleading emotional pull.', descriptionKo: 'Pleading Vocal Feel - 간절하게 붙잡는 듯한 보컬 표현감입니다.', style: 'pleading vocal phrasing', sound: 'emotional vocal pull', mood: 'desperate, vulnerable' },
      { id: 'vocal-cold-expression', label: 'Cold Vocal Feel', labelKo: '차가운 표현', description: 'Cool and emotionally distant vocal expression.', descriptionKo: 'Cold Vocal Feel - 감정을 차갑게 절제한 보컬 표현입니다.', style: 'cold restrained vocal tone', sound: 'clean dry vocal edge', mood: 'distant, cool' },
      { id: 'vocal-indifferent', label: 'Indifferent Vocal Feel', labelKo: '무심한 표현', description: 'Detached vocal expression with minimal emotional pressure.', descriptionKo: 'Indifferent Vocal Feel - 아무렇지 않은 듯 무심하게 부르는 느낌입니다.', style: 'indifferent vocal phrasing', sound: 'flat understated vocal texture', mood: 'detached, dry' },
      { id: 'vocal-lazy-expression', label: 'Lazy Vocal Feel', labelKo: '나른한 표현', description: 'Relaxed vocal expression with a slow, loose feel.', descriptionKo: 'Lazy Vocal Feel - 힘을 빼고 나른하게 흐르는 보컬 표현입니다.', style: 'lazy relaxed vocal phrasing', sound: 'loose soft vocal movement', mood: 'drowsy, laid-back' },
      { id: 'vocal-rough-expression', label: 'Rough Vocal Feel', labelKo: '거친 표현', description: 'Rough-edged vocal expression with grain and grit.', descriptionKo: 'Rough Vocal Feel - 거친 결이 살아있는 보컬 표현감입니다.', style: 'rough gritty vocal expression', sound: 'grainy vocal edge', mood: 'raw, intense' },
      { id: 'vocal-dreamy-expression', label: 'Dreamy Vocal Feel', labelKo: '몽롱한 표현', description: 'Soft, blurred vocal expression with a floating feel.', descriptionKo: 'Dreamy Vocal Feel - 몽롱하게 흐르는 듯한 보컬 표현입니다.', style: 'dreamy blurred vocal phrasing', sound: 'soft reverb vocal haze', mood: 'dreamy, floating' },
      { id: 'separator-style-vocal-speech-narrative', kind: 'separator', label: '말하듯/서사 표현', labelKo: '말하듯/서사 표현', description: '', descriptionKo: '', promptCore: '' },
      { id: 'vocal-spoken-singing', label: 'Spoken-singing Feel', labelKo: '말하듯 부름', description: 'Vocal phrasing that sits between speech and melody.', descriptionKo: 'Spoken-singing Feel - 대사처럼 말하듯 부르는 표현감입니다.', style: 'spoken-singing vocal style', sound: 'speech-like melodic phrasing', mood: 'conversational, direct' },
      { id: 'vocal-reciting', label: 'Reciting Vocal Feel', labelKo: '읊조리듯 부름', description: 'Poetic vocal phrasing that feels quietly recited.', descriptionKo: 'Reciting Vocal Feel - 시를 읊조리듯 낮게 흐르는 보컬 표현입니다.', style: 'reciting vocal phrasing', sound: 'quiet narrative vocal flow', mood: 'poetic, calm' },
      { id: 'separator-style-vocal-character-peak', kind: 'separator', label: '클라이맥스/캐릭터 표현', labelKo: '클라이맥스/캐릭터 표현', description: '', descriptionKo: '', promptCore: '' },
      { id: 'vocal-explosive-emotion', label: 'Explosive Vocal Emotion', labelKo: '폭발적인 감정 표현', description: 'A strong emotional vocal burst for climactic sections.', descriptionKo: 'Explosive Vocal Emotion - 클라이맥스에서 감정이 크게 터지는 보컬 표현입니다.', style: 'explosive emotional vocal peak', sound: 'wide dynamic vocal lift', mood: 'intense, cathartic' },
      { id: 'vocal-smiling-expression', label: 'Smiling Vocal Feel', labelKo: '웃는 듯한 표현', description: 'A vocal expression that sounds like smiling through the phrase.', descriptionKo: 'Smiling Vocal Feel - 웃음을 머금고 부르는 듯한 보컬 표현입니다.', style: 'smiling vocal phrasing', sound: 'bright subtle vocal lift', mood: 'warm, playful' },
      { id: 'vocal-empty-expression', label: 'Empty Vocal Feel', labelKo: '허무한 표현', description: 'Hollow and resigned vocal expression.', descriptionKo: 'Empty Vocal Feel - 비어 있는 듯 허무하게 부르는 표현입니다.', style: 'hollow resigned vocal phrasing', sound: 'thin spacious vocal tone', mood: 'empty, resigned' },
      { id: 'vocal-sarcastic-expression', label: 'Sarcastic Vocal Feel', labelKo: '비꼬는 표현', description: 'A lightly sarcastic vocal edge that sharpens the character.', descriptionKo: 'Sarcastic Vocal Feel - 캐릭터의 빈정거림이 느껴지는 보컬 표현입니다.', style: 'sarcastic vocal edge', sound: 'sharp playful vocal inflection', mood: 'witty, prickly' },
      { id: 'vocal-suffocated-expression', label: 'Suffocated Vocal Feel', labelKo: '숨 막히는 표현', description: 'Tight vocal expression that feels breathless and pressured.', descriptionKo: 'Suffocated Vocal Feel - 숨이 막히는 듯 답답한 보컬 표현입니다.', style: 'breathless pressured vocal phrasing', sound: 'tight close vocal texture', mood: 'anxious, trapped' },
      { id: 'separator-style-vocal-rhythm-phrasing', kind: 'separator', label: '리듬/발성 방식', labelKo: '리듬/발성 방식', description: '', descriptionKo: '', promptCore: '' },
      { id: 'vocal-offbeat-push-pull', label: 'Off-beat Push-pull Feel', labelKo: '엇박자로 밀고 당기는', description: 'Rhythmic vocal phrasing that pushes and pulls around the beat.', descriptionKo: 'Off-beat Push-pull Feel - 박자를 살짝 밀고 당기며 리듬감 있게 부르는 표현입니다.', style: 'off-beat vocal phrasing with rhythmic push and pull', sound: 'syncopated vocal timing with tight rhythmic movement', mood: 'witty, groovy' },
      { id: 'vocal-laidback-behind-beat', label: 'Laid-back Vocal Timing', labelKo: '뒤로 살짝 눕혀 부르는', description: 'Relaxed behind-the-beat vocal phrasing with a loose groove.', descriptionKo: 'Laid-back Vocal Timing - 박자보다 살짝 뒤에 기대듯 여유롭게 부르는 표현입니다.', style: 'laid-back behind-the-beat vocal phrasing', sound: 'loose vocal timing with relaxed groove', mood: 'cool, relaxed' },
      { id: 'vocal-raplike-tight', label: 'Rap-like Tight Phrasing', labelKo: '랩처럼 말하듯 쪼개는', description: 'Tight spoken-melodic phrasing with rap-like rhythmic detail.', descriptionKo: 'Rap-like Tight Phrasing - 말하듯 부르되 랩처럼 리듬을 잘게 쪼개는 표현입니다.', style: 'rap-like spoken vocal phrasing with tight rhythmic delivery', sound: 'tight consonant rhythm and spoken-melodic flow', mood: 'direct, sharp' },
      { id: 'vocal-rounded-mouthy', label: 'Rounded Mouthy Phrasing', labelKo: '입안에서 굴리듯 부르는', description: 'Rounded vocal phrasing with soft mouth-shaped groove.', descriptionKo: 'Rounded Mouthy Phrasing - 소리를 입안에서 부드럽게 굴리듯 처리하는 표현입니다.', style: 'rounded mouthy vocal phrasing with soft groove', sound: 'rounded vowel movement with mellow phrasing', mood: 'sensual, smooth' },
      { id: 'vocal-silky-connected', label: 'Silky Connected Phrasing', labelKo: '부드럽게 이어 부르는', description: 'Silky connected vocal phrasing with smooth line-to-line flow.', descriptionKo: 'Silky Connected Phrasing - 음과 음을 끊지 않고 매끄럽게 이어 부르는 표현입니다.', style: 'silky connected vocal phrasing with mellow flow', sound: 'legato vocal connection with smooth transitions', mood: 'warm, flowing' },
      { id: 'vocal-light-rnb-runs', label: 'Light R&B Runs', labelKo: '가볍게 꺾어 흐르는', description: 'Light R&B-style vocal runs used as tasteful melodic ornamentation.', descriptionKo: 'Light R&B Runs - 과하지 않은 R&B식 꺾기와 짧은 애드리브가 섞인 표현입니다.', style: 'light R&B vocal runs with tasteful melodic ornaments', sound: 'short agile runs and soft melisma accents', mood: 'smooth, soulful' },
      { id: 'vocal-sustained-ending', label: 'Sustained Ending Notes', labelKo: '끝음을 길게 붙잡는', description: 'Controlled sustained phrase endings with stable emotional hold.', descriptionKo: 'Sustained Ending Notes - 문장의 끝음을 안정적으로 길게 붙잡아 여운을 주는 표현입니다.', style: 'sustained ending notes with controlled emotional hold', sound: 'long held note endings with controlled sustain', mood: 'emotional, lingering' },
      { id: 'separator-style-vocal-habit-flaw', kind: 'separator', label: '보컬 습관/결점', labelKo: '보컬 습관/결점', description: '', descriptionKo: '', promptCore: '' },
      { id: 'vocal-broken-sentence-delivery', label: 'Broken Sentence Delivery', labelKo: '문장마다 끊어 부르는', description: 'A vocal habit that breaks each sentence into short breath-led fragments.', descriptionKo: 'Broken Sentence Delivery - 문장마다 호흡이 끊기듯 짧게 나눠 부르는 습관입니다.', style: 'broken sentence vocal delivery', sound: 'short breath-led vocal fragments', mood: 'fragile, hesitant' },
      { id: 'vocal-slurred-ending-phrasing', label: 'Slurred Ending Phrasing', labelKo: '끝음을 흘리는', description: 'A vocal habit that lets phrase endings trail off without a clean finish.', descriptionKo: 'Slurred Ending Phrasing - 문장 끝음을 또렷하게 닫지 않고 흘리듯 마무리하는 습관입니다.', style: 'slurred ending vocal phrasing', sound: 'soft trailing word endings', mood: 'loose, weary' },
      { id: 'vocal-unstable-pitch-feel', label: 'Unstable Pitch Feel', labelKo: '음이 살짝 흔들리는', description: 'A slightly unstable pitch feel that makes the voice sound emotionally unsteady.', descriptionKo: 'Unstable Pitch Feel - 음정이 완전히 고정되지 않고 살짝 흔들리는 불안정한 느낌입니다.', style: 'slightly unstable pitch vocal feel', sound: 'subtle wavering pitch detail', mood: 'anxious, fragile' },
      { id: 'vocal-off-pitch-feel', label: 'Off-pitch Vocal Feel', labelKo: '음정을 놓치는 듯한', description: 'A deliberately imperfect vocal feel that sounds like some notes are not fully reached.', descriptionKo: 'Off-pitch Vocal Feel - 일부 음을 정확히 맞추지 못하는 듯한 서툰 보컬 느낌입니다.', style: 'imperfect off-pitch vocal feel', sound: 'slightly missed note edges', mood: 'awkward, human' },
      { id: 'vocal-careless-humming-feel', label: 'Careless Humming Feel', labelKo: '대충 흥얼거리는', description: 'A casual vocal habit that sounds like loose, careless humming rather than polished singing.', descriptionKo: 'Careless Humming Feel - 힘을 주지 않고 대충 흥얼거리듯 부르는 습관입니다.', style: 'careless humming vocal feel', sound: 'loose low-effort humming texture', mood: 'casual, detached' },
      { id: 'vocal-nasal-sick-voice', label: 'Nasal Sick Voice', labelKo: '감기 걸린 듯한', description: 'A nasal, congested vocal color like the singer has a cold.', descriptionKo: 'Nasal Sick Voice - 코가 막히거나 감기 걸린 듯 답답하고 탁한 목소리 느낌입니다.', style: 'nasal sick vocal tone', sound: 'congested nasal vocal color', mood: 'tired, muted' },
      { id: 'vocal-mumbled-pronunciation', label: 'Mumbled Pronunciation', labelKo: '발음이 흐릿한', description: 'A vocal habit with blurred pronunciation and words softened inside the mouth.', descriptionKo: 'Mumbled Pronunciation - 발음을 또렷하게 하지 않고 입안에서 뭉개듯 부르는 느낌입니다.', style: 'mumbled vocal pronunciation', sound: 'blurred consonants and mouthy word edges', mood: 'shy, withdrawn' },
      { id: 'vocal-fading-word-endings', label: 'Fading Word Endings', labelKo: '말끝이 사라지는', description: 'A vocal habit where the end of each phrase gets smaller and fades away.', descriptionKo: 'Fading Word Endings - 말끝이 점점 작아지며 사라지는 듯한 보컬 습관입니다.', style: 'fading word endings', sound: 'vanishing phrase tails', mood: 'uncertain, wistful' },
      { id: 'vocal-short-breath-delivery', label: 'Short-breath Delivery', labelKo: '숨이 모자란 듯한', description: 'A breath-short vocal habit that feels like the singer runs out of air between lines.', descriptionKo: 'Short-breath Delivery - 숨이 부족해서 문장 중간중간 끊기는 듯한 표현입니다.', style: 'short-breath vocal delivery', sound: 'breath-starved line breaks', mood: 'nervous, pressured' },
      { id: 'vocal-unconfident-feel', label: 'Unconfident Vocal Feel', labelKo: '자신 없이 부르는', description: 'A small, uncertain vocal habit with cautious and unconfident delivery.', descriptionKo: 'Unconfident Vocal Feel - 확신 없이 조심스럽고 작게 부르는 느낌입니다.', style: 'unconfident cautious vocal delivery', sound: 'small hesitant vocal attack', mood: 'timid, vulnerable' },
      { id: 'vocal-blank-singalong-feel', label: 'Blank Sing-along Feel', labelKo: '멍하게 따라 부르는', description: 'A blank, almost automatic sing-along habit with emotionally distant delivery.', descriptionKo: 'Blank Sing-along Feel - 감정 없이 멍하게 따라 부르는 듯한 보컬 습관입니다.', style: 'blank sing-along vocal feel', sound: 'flat automatic humming-like delivery', mood: 'numb, detached' },
      { id: 'vocal-wobbly-pitch-feel', label: 'Wobbly Pitch Feel', labelKo: '삐걱대는 음정', description: 'A wobbly pitch habit with slightly shaky and imperfect note control.', descriptionKo: 'Wobbly Pitch Feel - 음정이 미세하게 흔들리며 불안정하게 들리는 표현입니다.', style: 'wobbly pitch vocal feel', sound: 'shaky imperfect note control', mood: 'unstable, raw' },
      { id: 'separator-style-vocal-era-genre', kind: 'separator', label: '시대/장르 보컬', labelKo: '시대/장르 보컬', description: '', descriptionKo: '', promptCore: '' },
      { id: 'vocal-breezy-retro-pop', label: 'Breezy Retro-pop Feel', labelKo: '레트로 팝처럼 산뜻한', description: 'Light breezy retro-pop vocal phrasing with sweet clarity.', descriptionKo: 'Breezy Retro-pop Feel - 레트로 팝처럼 맑고 산뜻하게 흘러가는 보컬 표현입니다.', style: 'breezy retro-pop vocal phrasing with sweet clarity', sound: 'light clear vocal lift with soft pop sparkle', mood: 'bright, nostalgic' },
      { id: 'vocal-2000s-kindie-playful-dreamy', label: '2000s K-Indie Vocal Feel', labelKo: '2000년대 K-인디 감성', description: 'Playful but dreamy 2000s Korean indie-pop vocal phrasing with airy sweetness.', descriptionKo: '2000s K-Indie Vocal Feel - 2000년대 한국 인디팝처럼 장난스럽지만 몽환적으로 흘러가는 보컬 표현입니다. 공기감 있는 여성 보컬이나 산뜻한 밴드팝에 잘 어울립니다.', style: '2000s K-indie playful but dreamy vocal phrasing', sound: 'airy sweet indie-pop vocal lift with light nostalgic color', mood: 'playful, dreamy, nostalgic' },
      { id: 'vocal-90s-kballad-open-sustain', label: '90s K-Ballad Open Sustain', labelKo: '90년대 K-발라드 고음선', description: 'Classic Korean 90s ballad phrasing with open vowels, long held notes, and sincere emotional lift.', descriptionKo: '90s K-Ballad Open Sustain - 90년대 한국 발라드처럼 열린 발음과 긴 고음, 진심 어린 감정선을 살리는 창법입니다. 파워 발라드나 드라마틱한 후렴에 잘 어울립니다.', style: 'classic 90s Korean ballad vocal lift with open sustained high notes', sound: 'open vowel belting, long sustain, sincere vibrato', mood: 'dramatic, sincere, nostalgic' },
      { id: 'vocal-90s-dance-pop-crisp', label: '90s Dance-pop Vocal Attack', labelKo: '90년대 댄스팝 보컬', description: 'Bright and punchy 90s dance-pop vocal phrasing with crisp diction and energetic hook attack.', descriptionKo: '90s Dance-pop Vocal Attack - 90년대 댄스팝처럼 또렷하고 힘 있게 박자를 치고 들어가는 보컬 표현입니다. 빠른 댄스곡과 단체 훅에 잘 어울립니다.', style: 'bright punchy 90s dance-pop vocal phrasing with crisp hook attack', sound: 'crisp diction, energetic pop attack, tight chorus lift', mood: 'upbeat, bold, retro' },
      { id: 'vocal-2000s-cyworld-ballad', label: '2000s Cyworld Ballad Feel', labelKo: '2000년대 싸이월드 발라드', description: 'Glossy 2000s Korean sentimental ballad phrasing with soft piano-pop emotion and clean melodic delivery.', descriptionKo: '2000s Cyworld Ballad Feel - 2000년대 싸이월드 감성 발라드처럼 깨끗하고 감성적인 멜로디 라인을 살리는 표현입니다. 피아노, 스트링, 추억형 가사에 잘 어울립니다.', style: 'glossy 2000s Korean sentimental ballad phrasing', sound: 'clean melodic delivery, soft piano-pop emotion, nostalgic gloss', mood: 'sentimental, nostalgic, tender' },
      { id: 'vocal-2000s-rnb-duo-soft', label: '2000s R&B Duo Softness', labelKo: '2000년대 R&B 듀오 감성', description: 'Soft 2000s Korean R&B duo phrasing with airy harmony, gentle runs, and smooth emotional blend.', descriptionKo: '2000s R&B Duo Softness - 2000년대 R&B 듀오처럼 부드러운 하모니와 공기감, 짧은 꺾기가 섞인 표현입니다. 남녀 듀엣이나 여성 듀오에 잘 어울립니다.', style: 'smooth 2000s Korean R&B duo phrasing with airy harmony', sound: 'soft harmony blend, gentle R&B runs, smooth vocal overlap', mood: 'romantic, smooth, intimate' },
      { id: 'vocal-2000s-husky-rnb', label: '2000s Husky R&B Feel', labelKo: '2000년대 허스키 R&B', description: 'Mellow 2000s R&B phrasing with husky warmth, low-mid glide, and restrained groove.', descriptionKo: '2000s Husky R&B Feel - 2000년대 R&B처럼 허스키한 온기와 낮은 그루브를 살려 부르는 표현입니다. 차분한 R&B, 시티팝, 밤 분위기에 잘 어울립니다.', style: 'husky mellow 2000s R&B vocal phrasing with warm low-mid glide', sound: 'warm husky glide, mellow groove, restrained R&B tone', mood: 'mature, smooth, late-night' },
      { id: 'vocal-2010s-idol-hook', label: '2010s Idol Hook Delivery', labelKo: '2010년대 아이돌 훅', description: 'Polished K-pop idol hook delivery with clear diction, bright lift, and catchy chorus focus.', descriptionKo: '2010s Idol Hook Delivery - 2010년대 아이돌 팝처럼 발음이 선명하고 후렴 훅이 잘 살아나는 표현입니다. 밝은 후렴, 그룹 보컬, 댄스팝에 잘 어울립니다.', style: 'polished 2010s K-pop idol hook delivery with bright catchy lift', sound: 'clear diction, glossy chorus lift, synchronized pop energy', mood: 'bright, catchy, confident' },
      { id: 'vocal-2010s-acoustic-indie', label: '2010s Acoustic Indie Intimacy', labelKo: '2010년대 어쿠스틱 인디', description: 'Close and honest acoustic indie vocal phrasing with small-room warmth and natural softness.', descriptionKo: '2010s Acoustic Indie Intimacy - 2010년대 어쿠스틱 인디처럼 가까운 방 안에서 담담하게 부르는 듯한 표현입니다. 통기타, 작은 밴드, 일상형 가사에 잘 어울립니다.', style: 'intimate 2010s acoustic indie vocal phrasing with small-room sincerity', sound: 'close-mic softness, natural breath, warm acoustic room', mood: 'honest, gentle, everyday' },
      { id: 'vocal-2020s-hyperpop-gloss', label: '2020s Hyperpop Vocal Gloss', labelKo: '2020년대 하이퍼팝 보컬', description: 'Glossy modern hyperpop-style vocal phrasing with clipped hooks, bright processing, and playful digital energy.', descriptionKo: '2020s Hyperpop Vocal Gloss - 2020년대 하이퍼팝처럼 밝고 잘게 잘리는 디지털 보컬 표현입니다. 글리치, 빠른 팝, 과장된 훅에 잘 어울립니다.', style: 'glossy 2020s hyperpop vocal phrasing with clipped bright hooks', sound: 'bright processed vocal chops, tight digital phrasing, playful pitch color', mood: 'hyper, playful, futuristic' },
      { id: 'vocal-citypop-smooth-groove', label: 'City-pop Smooth Groove', labelKo: '시티팝 보컬 그루브', description: 'Relaxed city-pop vocal phrasing with smooth groove, clean nostalgia, and light rhythmic swing.', descriptionKo: 'City-pop Smooth Groove - 시티팝처럼 힘을 빼고 리듬에 부드럽게 올라타는 보컬 표현입니다. 밤거리, 드라이브, 레트로 밴드 사운드에 잘 어울립니다.', style: 'smooth city-pop vocal phrasing with relaxed nostalgic groove', sound: 'clean nostalgic vocal shine, light rhythmic swing, smooth pop glide', mood: 'urban, relaxed, nostalgic' },
      { id: 'vocal-trotpop-light-bend', label: 'Trot-pop Light Bend', labelKo: '트로트팝 꺾기 감성', description: 'Light trot-pop phrasing with tasteful Korean ggeok-gi, playful bends, and catchy emotional lift.', descriptionKo: 'Trot-pop Light Bend - 트로트팝처럼 과하지 않은 꺾기와 흥을 살리는 표현입니다. 세미트로트, 코믹형, 중독성 있는 후렴에 잘 어울립니다.', style: 'light trot-pop vocal bend phrasing with tasteful Korean ggeok-gi', sound: 'playful vocal bends, catchy emotional lift, clear trot-pop inflection', mood: 'playful, sentimental, catchy' },
      { id: 'vocal-jpop-anime-opening', label: 'J-Pop Anime Opening Lift', labelKo: 'J-Pop 애니 오프닝 창법', description: 'Energetic J-pop anime opening-style delivery with clear high hooks, dramatic lift, and forward motion.', descriptionKo: 'J-Pop Anime Opening Lift - J-Pop 애니 오프닝처럼 선명한 고음 훅과 앞으로 달려가는 에너지를 살리는 표현입니다. 빠른 전개와 밝은 록/팝에 잘 어울립니다.', style: 'energetic J-pop anime opening vocal delivery with clear high hook lift', sound: 'bright high hook, dramatic vocal lift, forward driving melody', mood: 'energetic, hopeful, dramatic' },
      { id: 'vocal-lofi-hushed', label: 'Lo-fi Hushed Vocal Feel', labelKo: '로파이 허밍 보컬', description: 'Quiet lo-fi vocal phrasing with hushed volume, soft grain, and intimate low-energy delivery.', descriptionKo: 'Lo-fi Hushed Vocal Feel - 로파이처럼 작게 흥얼거리듯 낮은 볼륨으로 부르는 표현입니다. 공부용, 새벽, 카세트 질감에 잘 어울립니다.', style: 'hushed lo-fi vocal phrasing with intimate low-volume delivery', sound: 'soft grain, low-volume vocal, close sleepy humming', mood: 'calm, intimate, late-night' }
    ],
  },
  // SORIDRAW_STYLE_CATEGORY_RECLASS_V11: EDM build-up and selected groove items moved to Mood Transition, Groove renamed to 그루브 리듬감, 70s-Disco label fixed.
  {
    id: 'rhythm-bounce',
    title: 'Jazz & R&B',
    titleKo: '재즈 & 알앤비',
    variants: [
      { id: 'separator-style-jazz-rnb-jazz-latin', kind: 'separator', label: '재즈/라틴', labelKo: '재즈/라틴', description: '', descriptionKo: '', promptCore: '' },
      { id: 'swing-feel', label: 'Swing / Jazz', labelKo: '스윙 / 재즈', description: 'Swing-like rhythmic looseness and motion.', descriptionKo: 'Swing / Jazz - 스윙 특유의 느슨하고 유연한 리듬감을 더합니다.', style: 'swing-aware rhythmic motion', sound: 'loose offbeat accents', mood: 'playful, stylish' },
      { id: 'fusion-bossa-nova-pop', label: 'Bossa Nova Pop', labelKo: '보사노바 팝', description: 'Bossa nova rhythm blended into a soft pop structure.', descriptionKo: 'Bossa Nova Pop - 보사노바 리듬을 부드러운 팝 구조에 섞는 글로벌 스타일입니다.', style: 'Bossa Nova Pop fusion', sound: 'nylon guitar, soft brush rhythm, warm chords', mood: 'gentle, breezy' },
      { id: 'separator-style-jazz-rnb-funk-rnb', kind: 'separator', label: '펑크/R&B', labelKo: '펑크/R&B', description: '', descriptionKo: '', promptCore: '' },
      { id: 'funky-bounce', label: 'Funk', labelKo: '펑크', description: 'Elastic bass and syncopated rhythmic bounce.', descriptionKo: 'Funk - 통통 튀는 베이스와 리드미컬한 탄력감을 더합니다.', style: 'syncopated rhythmic bounce', sound: 'elastic bass groove, upbeat snap', mood: 'funky, energetic' },
      { id: 'rnb-groove-bounce', label: 'Contemporary R&B', labelKo: '컨템퍼러리 R&B', description: 'Smooth R&B pocket and flexible groove.', descriptionKo: 'Contemporary R&B - 부드럽고 유연한 R&B 그루브를 더합니다.', style: 'smooth R&B rhythmic pocket', sound: 'laid-back drums and flexible groove', mood: 'smooth, sensual' },
      { id: 'fusion-neo-soul', label: 'Neo Soul', labelKo: '네오 소울', description: 'Soul-based harmonic richness with relaxed modern groove.', descriptionKo: 'Neo Soul - 풍부한 소울 화성과 여유로운 현대적 그루브를 더합니다.', style: 'Neo Soul fusion', sound: 'warm electric piano, soulful bass, relaxed drums', mood: 'smooth, soulful' },
      { id: 'fusion-pbrnb', label: 'PBR&B', labelKo: 'PBR&B', description: 'Alternative R&B color with atmospheric electronic texture.', descriptionKo: 'PBR&B - 몽환적인 전자 질감이 섞인 얼터너티브 R&B 색채입니다.', style: 'PBR&B fusion', sound: 'moody synth pads, sparse R&B drums, deep sub bass', mood: 'moody, atmospheric' }
    ],
  },
  {
    id: 'space-texture',
    title: 'Space Texture',
    titleKo: '공간 질감',
    variants: [
      { id: 'separator-style-space-special', kind: 'separator', label: '비현실/특수 공간', labelKo: '비현실/특수 공간', description: '', descriptionKo: '', promptCore: '' },
      { id: 'space-echo-orbit', label: 'Outer-space Reverb', labelKo: '우주 잔향감', description: 'A distant, weightless spatial feel like sound floating in space.', descriptionKo: 'Outer-space Reverb - 우주 공간에 소리가 떠 있는 듯한 넓고 차가운 잔향감입니다.', style: 'outer-space spatial texture', sound: 'wide reverb, distant ambience', mood: 'lonely, weightless' },
      { id: 'underwater-muffle', label: 'Underwater Muffle', labelKo: '수중 먹먹함', description: 'Muffled sound texture as if heard underwater.', descriptionKo: 'Underwater Muffle - 물속에서 듣는 듯 먹먹하고 둔탁한 공간 질감입니다.', style: 'underwater muffled atmosphere', sound: 'low-pass filtered ambience, softened transients', mood: 'submerged, dreamy' },
      { id: 'separator-style-space-indoor-closed', kind: 'separator', label: '실내/밀폐 공간', labelKo: '실내/밀폐 공간', description: '', descriptionKo: '', promptCore: '' },
      { id: 'car-interior', label: 'Car Interior Intimacy', labelKo: '차 안 밀폐감', description: 'Closed and intimate sound like singing inside a car.', descriptionKo: 'Car Interior Intimacy - 차 안에서 부르는 듯한 밀폐되고 가까운 공간감입니다.', style: 'car-interior intimate space', sound: 'tight dry vocal room with soft reflections', mood: 'private, close' },
      { id: 'tunnel-echo', label: 'Tunnel Echo', labelKo: '터널 메아리', description: 'tunnel echo - Long tunnel reflections with a moving echo tail.', descriptionKo: 'tunnel echo - 터널 안에서 울리는 긴 메아리와 이동감 있는 반사음입니다.', style: 'tunnel echo space', sound: 'long metallic echoes', mood: 'lonely, cinematic' },
      { id: 'bathroom-reverb', label: 'Bathroom Reverb', labelKo: '욕실 울림', description: 'Small tiled-room reverb with bright reflections.', descriptionKo: 'Bathroom Reverb - 욕실 타일에 반사되는 듯한 밝고 작은 울림입니다.', style: 'bathroom reverb texture', sound: 'short bright room reflections', mood: 'raw, intimate' },
      { id: 'separator-style-space-stage-public', kind: 'separator', label: '공연/공공장소', labelKo: '공연/공공장소', description: '', descriptionKo: '', promptCore: '' },
      { id: 'live-hall-space', label: 'Live Hall Space', labelKo: '공연장 라이브감', description: 'Open live hall space with audience-like depth.', descriptionKo: 'Live Hall Space - 공연장처럼 넓게 열리는 라이브 공간감입니다.', style: 'live hall spatial energy', sound: 'room depth, live ambience', mood: 'open, performative' },
      { id: 'live-stage-energy', label: 'Live Stage Energy', labelKo: '라이브 무대감', description: 'Live stage ambience with open performance energy.', descriptionKo: 'Live Stage Energy - 라이브 무대에서 연주하는 듯한 현장감을 더합니다.', style: 'live stage energy', sound: 'stage ambience, open room energy', mood: 'alive, open' },
      { id: 'alley-reverb', label: 'Alley Reverb', labelKo: '골목 잔향', description: 'Narrow street reflections with late-night air.', descriptionKo: 'Alley Reverb - 좁은 골목에서 울리는 듯한 늦은 밤의 잔향감입니다.', style: 'narrow alley reverb', sound: 'short urban reflections', mood: 'nocturnal, intimate' },
      { id: 'phone-filter', label: 'Over-the-phone Texture', labelKo: '전화기 너머', description: 'Filtered vocal texture like a voice coming through a phone.', descriptionKo: 'Over-the-phone Texture - 전화기 너머에서 들리는 듯한 필터 처리된 질감입니다.', style: 'telephone-filtered vocal texture', sound: 'narrow-band filtered voice', mood: 'distant, nostalgic' },
      { id: 'radio-texture', label: 'Radio Texture', labelKo: '라디오 질감', description: 'Broadcast-like warmth and slight analog noise.', descriptionKo: 'Radio Texture - 라디오 방송처럼 따뜻하고 살짝 노이즈가 있는 질감입니다.', style: 'radio-broadcast texture', sound: 'analog noise, softened midrange', mood: 'nostalgic, warm' },
      { id: 'club-space', label: 'Club Room Energy', labelKo: '클럽 울림', description: 'Dense low-end room feel like a small club.', descriptionKo: 'Club Room Energy - 작은 클럽 안에서 저음이 차오르는 듯한 공간감입니다.', style: 'club-room spatial pressure', sound: 'dense low-end reflections', mood: 'physical, immersive' },
      { id: 'separator-style-space-outdoor-air', kind: 'separator', label: '야외/배경 공기', labelKo: '야외/배경 공기', description: '', descriptionKo: '', promptCore: '' },
      { id: 'dawn-street-air', label: 'Dawn Street Air', labelKo: '새벽 거리 공기', description: 'Cool open air texture like singing on an empty dawn street.', descriptionKo: 'Dawn Street Air - 새벽 거리의 차갑고 빈 공기가 느껴지는 공간 질감입니다.', style: 'empty dawn street atmosphere', sound: 'cool open ambience', mood: 'quiet, lonely' },
      { id: 'basement-damp', label: 'Damp Basement Texture', labelKo: '지하실 습기감', description: 'Dark, humid, enclosed room texture.', descriptionKo: 'Damp Basement Texture - 지하실처럼 어둡고 습한 폐쇄감이 느껴지는 질감입니다.', style: 'damp basement texture', sound: 'dark enclosed reflections', mood: 'heavy, uneasy' },
      { id: 'empty-room-reverb', label: 'Empty Room Reverb', labelKo: '빈 방의 잔향', description: 'Sparse room reflections with emotional emptiness.', descriptionKo: 'Empty Room Reverb - 빈 방에 혼자 남은 듯한 휑한 잔향감입니다.', style: 'empty-room reverb', sound: 'sparse room tail', mood: 'hollow, still' },
      { id: 'dream-space', label: 'Dream-space Haze', labelKo: '꿈속 공간감', description: 'Blurred, surreal space like a scene inside a dream.', descriptionKo: 'Dream-space Haze - 꿈속 장면처럼 흐릿하고 비현실적인 공간감입니다.', style: 'dream-space haze', sound: 'blurred reverb and soft delay', mood: 'surreal, floating' },
      { id: 'airport-announcement', label: 'Airport Announcement Feel', labelKo: '공항 방송감', description: 'A public-address sense with distant movement.', descriptionKo: 'Airport Announcement Feel - 공항 안내방송처럼 멀고 이동감 있는 공간 질감입니다.', style: 'airport PA spatial texture', sound: 'distant announcement-like ambience', mood: 'transient, wistful' },
      { id: 'cathedral-hall', label: 'Cathedral Hall Reverb', labelKo: '성당 홀 울림', description: 'Large sacred hall reverb with long decay.', descriptionKo: 'Cathedral Hall Reverb - 성당 홀처럼 길고 성스러운 울림을 더합니다.', style: 'cathedral hall reverb', sound: 'long lush decay', mood: 'sacred, grand' },
      { id: 'rooftop-night-air', label: 'Rooftop Night Air', labelKo: '옥상 밤공기', description: 'Open rooftop atmosphere with night air and city distance.', descriptionKo: 'Rooftop Night Air - 도시가 멀리 내려다보이는 옥상 밤공기 같은 질감입니다.', style: 'rooftop night atmosphere', sound: 'wide air, distant city ambience', mood: 'lonely, open' },
      { id: 'foggy-space', label: 'Foggy Space', labelKo: '안개 낀 공간감', description: 'Soft foggy ambience with blurred edges.', descriptionKo: 'Foggy Space - 안개가 낀 듯 윤곽이 흐려지는 공간감입니다.', style: 'foggy atmospheric space', sound: 'soft blurred ambience', mood: 'mysterious, muted' },
      { id: 'helmet-muffle', label: 'Inside-helmet Muffle', labelKo: '헬멧 안 먹먹함', description: 'Muffled close breathing and sealed helmet space.', descriptionKo: 'Inside-helmet Muffle - 헬멧 안에서 숨소리와 목소리가 먹먹하게 울리는 질감입니다.', style: 'inside-helmet muffled space', sound: 'close breath, sealed resonance', mood: 'isolated, claustrophobic' },
      { id: 'distant-voice', label: 'Distant Voice Feel', labelKo: '멀리서 들리는 느낌', description: 'A faraway vocal image with emotional distance.', descriptionKo: 'Distant Voice Feel - 멀리서 들려오는 듯한 거리감 있는 보컬 공간입니다.', style: 'distant vocal image', sound: 'far reverb, softened presence', mood: 'remote, nostalgic' },
      { id: 'separator-style-space-reverb-ambience', kind: 'separator', label: '공간효과 병합', labelKo: '공간효과 병합', description: '', descriptionKo: '', promptCore: '' },
      { id: 'room-reverb', label: 'Room Reverb', labelKo: '작은 방 울림', description: 'room reverb - 작은 방에서 울리는 친밀한 리버브입니다.', descriptionKo: 'room reverb - 작은 방에서 울리는 친밀한 리버브입니다.', style: 'room reverb texture', sound: 'short room reflections', mood: 'intimate, close' },
      { id: 'wide-reverb', label: 'Wide Reverb', labelKo: '넓은 리버브', description: 'wide reverb - 공간을 크게 넓히는 리버브입니다.', descriptionKo: 'wide reverb - 공간을 크게 넓히는 리버브입니다.', style: 'wide reverb space', sound: 'wide reverb tail', mood: 'open, spacious' },
      { id: 'dream-reverb', label: 'Dream Reverb', labelKo: '꿈속 리버브', description: 'dream reverb - 몽환적으로 번지는 리버브입니다.', descriptionKo: 'dream reverb - 몽환적으로 번지는 리버브입니다.', style: 'dream reverb haze', sound: 'soft washed reverb', mood: 'dreamy, floating' },
      { id: 'rain-ambience', label: 'Rain Ambience', labelKo: '비 오는 공간감', description: 'rain ambience - 비 오는 배경의 촉촉한 공간감입니다.', descriptionKo: 'rain ambience - 비 오는 배경의 촉촉한 공간감입니다.', style: 'rain ambience space', sound: 'rainy background ambience', mood: 'wet, quiet' },
      { id: 'city-ambience', label: 'City Ambience', labelKo: '도시 소음 질감', description: 'urban ambience - 도시의 소음과 공기가 섞인 배경감입니다.', descriptionKo: 'urban ambience - 도시의 소음과 공기가 섞인 배경감입니다.', style: 'urban ambience texture', sound: 'city background noise', mood: 'urban, lived-in' },
      { id: 'ocean-ambience', label: 'Ocean Ambience', labelKo: '바다 배경 질감', description: 'ocean ambience - 파도와 바다 공기가 느껴지는 배경감입니다.', descriptionKo: 'ocean ambience - 파도와 바다 공기가 느껴지는 배경감입니다.', style: 'ocean ambience space', sound: 'wave background ambience', mood: 'coastal, open' },
    ],
  },
  {
    id: 'rap-beat-texture',
    title: 'Hip-hop',
    titleKo: '힙합',
    variants: [
      { id: 'separator-style-hiphop-basic', kind: 'separator', label: '기본 힙합', labelKo: '기본 힙합', description: '', descriptionKo: '', promptCore: '' },
      { id: 'hip-hop', label: 'Hip-hop', labelKo: '힙합', description: 'Beat-led hip-hop edge and urban rhythm.', descriptionKo: 'Hip-hop - 비트 중심의 힙합 감각을 더합니다.', style: 'hip-hop attitude, beat-led motion', sound: 'rhythmic vocal emphasis, urban drums', mood: 'confident, urban' },
      { id: 'boom-bap-style', label: 'Boom Bap', labelKo: '붐뱁', description: 'Classic boom bap drum texture and head-nod groove.', descriptionKo: 'Boom Bap - 클래식한 붐뱁 드럼 질감을 더합니다.', style: 'boom bap rhythm, head-nod groove', sound: 'classic drum knock, sample-minded movement', mood: 'raw, classic' },
      { id: 'separator-style-hiphop-jazz-lofi', kind: 'separator', label: '재즈/로파이 힙합', labelKo: '재즈/로파이 힙합', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-jazzy-hiphop', label: 'Jazzy Hip-hop', labelKo: '재지 힙합', description: 'Hip-hop rhythm blended with jazz harmony and mellow swing.', descriptionKo: 'Jazzy Hip-hop - 힙합 리듬에 재즈 코드와 부드러운 스윙감을 섞습니다.', style: 'Jazzy Hip-hop fusion', sound: 'jazz chords, boom bap drums, upright bass color', mood: 'mellow, sophisticated' },
      { id: 'lofi-hip-hop-style', label: 'Lo-fi Hip-hop', labelKo: '로파이 힙합', description: 'Lo-fi hip-hop warmth and dusty beat texture.', descriptionKo: 'Lo-fi Hip-hop - 먼지 낀 듯 따뜻한 로파이 비트 질감입니다.', style: 'lo-fi hip-hop mood, relaxed groove', sound: 'soft beat texture, warm dust', mood: 'chill, nostalgic' },
      { id: 'fusion-chillhop', label: 'Chillhop', labelKo: '칠홉', description: 'Relaxed hip-hop groove with warm lo-fi musicality.', descriptionKo: 'Chillhop - 따뜻한 로파이 질감과 여유로운 힙합 그루브를 더합니다.', style: 'Chillhop fusion', sound: 'soft boom bap drums, warm keys, mellow bass', mood: 'relaxed, cozy' },
      { id: 'separator-style-hiphop-trap-drill', kind: 'separator', label: '트랩/드릴', labelKo: '트랩/드릴', description: '', descriptionKo: '', promptCore: '' },
      { id: 'trap-style', label: 'Trap', labelKo: '트랩', description: 'Modern trap beat with fast hats and deep bass.', descriptionKo: 'Trap - 빠른 하이햇과 깊은 베이스 중심의 트랩 질감입니다.', style: 'trap energy, modern street-level intensity', sound: 'heavy low-end, crisp hats', mood: 'aggressive, dark' },
      { id: 'dark-trap', label: 'Dark Trap', labelKo: '다크 트랩', description: 'Heavy and ominous trap beat texture.', descriptionKo: 'Dark Trap - 묵직하고 불길한 다크 트랩 질감입니다.', style: 'dark trap texture', sound: 'heavy 808, sharp hats, ominous low end', mood: 'menacing, unstable' },
      { id: 'drill-mood', label: 'Drill', labelKo: '드릴', description: 'Dark drill-inspired rhythm and tension.', descriptionKo: 'Drill - 어둡고 긴장감 있는 드릴 리듬을 더합니다.', style: 'drill-inspired rhythmic tension', sound: 'sliding bass, sharp hats', mood: 'dark, tense' },
      { id: 'separator-style-hiphop-melodic-cloud', kind: 'separator', label: '몽환/멜로딕 랩', labelKo: '몽환/멜로딕 랩', description: '', descriptionKo: '', promptCore: '' },
      { id: 'cloud-rap', label: 'Cloud Rap', labelKo: '클라우드 랩', description: 'Airy, floating rap beat texture.', descriptionKo: 'Cloud Rap - 공중에 떠 있는 듯한 몽환적 랩 비트 질감입니다.', style: 'cloud rap atmosphere', sound: 'airy pads, soft trap rhythm', mood: 'floaty, hazy' },
      { id: 'melodic-rap', label: 'Melodic Rap', labelKo: '멜로딕 랩', description: 'Rap flow blended with melodic phrasing.', descriptionKo: 'Melodic Rap - 랩과 멜로디가 섞인 흐름을 더합니다.', style: 'melodic rap flow', sound: 'rap-singing rhythmic melody', mood: 'smooth, modern' }
    ],
  },
  {
    id: 'era-texture',
    title: 'Era Texture',
    titleKo: '시대 질감',
    variants: [
      // SORIDRAW_ERA_PREFIX_V12: 시대 질감 prefix layer. 기존 항목은 유지하고 장르 앞에 붙는 시대 레이어만 추가.
      { id: 'separator-style-era-prefix', kind: 'separator', label: '시대 접두어', labelKo: '시대 접두어', description: '', descriptionKo: '', promptCore: '' },
      { id: 'era-prefix-60s', label: '60s', labelKo: '60년대', description: 'Adds a 60s prefix before the main genre.', descriptionKo: '60s - 빈티지 소울, 록앤롤, 초기 팝의 따뜻한 아날로그 시대감입니다.', style: '60s', sound: 'warm vintage recording color', mood: 'classic, nostalgic' },
      { id: 'era-prefix-70s', label: '70s', labelKo: '70년대', description: 'Adds a 70s prefix before the main genre.', descriptionKo: '70s - 소울, 펑크, 디스코 기반의 따뜻하고 라이브한 시대감입니다.', style: '70s', sound: 'analog warmth, live groove', mood: 'vintage, warm' },
      { id: 'era-prefix-late-70s', label: 'late 70s', labelKo: '70년대 후반', description: 'Adds a late 70s prefix before the main genre.', descriptionKo: 'late 70s - 디스코 전성기와 아날로그 그루브가 강한 레트로 시대감입니다.', style: 'late 70s', sound: 'disco-era polish, analog rhythm color', mood: 'retro, lively' },
      { id: 'era-prefix-early-80s', label: 'early 80s', labelKo: '80년대 초반', description: 'Adds an early 80s prefix before the main genre.', descriptionKo: 'early 80s - 아날로그에서 디지털 신스로 넘어가는 초기 80년대 팝 감각입니다.', style: 'early 80s', sound: 'early digital synths, analog drums', mood: 'retro, clean' },
      { id: 'era-prefix-mid-80s', label: 'mid 80s', labelKo: '80년대 중반', description: 'Adds a mid 80s prefix before the main genre.', descriptionKo: 'mid 80s - DX 계열 건반, 글로시한 신스, 네온 팝 질감이 강한 시대감입니다.', style: 'mid 80s', sound: 'DX-style keys, glossy synths', mood: 'neon, polished' },
      { id: 'era-prefix-late-80s', label: 'late 80s', labelKo: '80년대 후반', description: 'Adds a late 80s prefix before the main genre.', descriptionKo: 'late 80s - 밝은 신스팝, 게이트 드럼, 세련된 80년대 후반 팝 질감입니다.', style: 'late 80s', sound: 'bright synth pop polish, gated drum feel', mood: 'nostalgic, glossy' },
      { id: 'era-prefix-early-90s', label: 'early 90s', labelKo: '90년대 초반', description: 'Adds an early 90s prefix before the main genre.', descriptionKo: 'early 90s - 뉴잭스윙, 초기 R&B, 선명한 디지털 팝 리듬감입니다.', style: 'early 90s', sound: 'swingbeat drums, warm digital keys', mood: 'fresh, nostalgic' },
      { id: 'era-prefix-mid-90s', label: 'mid 90s', labelKo: '90년대 중반', description: 'Adds a mid 90s prefix before the main genre.', descriptionKo: 'mid 90s - 재지한 코드, 샘플 드럼, 부드러운 R&B/힙합 시대감입니다.', style: 'mid 90s', sound: 'sampled drums, smooth R&B color', mood: 'mellow, urban' },
      { id: 'era-prefix-late-90s', label: 'late 90s', labelKo: '90년대 후반', description: 'Adds a late 90s prefix before the main genre.', descriptionKo: 'late 90s - 라디오 팝, 댄스팝, 밝은 디지털 포인트가 섞인 시대감입니다.', style: 'late 90s', sound: 'polished pop mix, bright digital accents', mood: 'nostalgic, energetic' },
      { id: 'era-prefix-early-2000s', label: 'early 2000s', labelKo: '2000년대 초반', description: 'Adds an early 2000s prefix before the main genre.', descriptionKo: 'early 2000s - Y2K 팝, 글로시한 신스, 반짝이는 디지털 프로덕션 감각입니다.', style: 'early 2000s', sound: 'glossy digital pop texture', mood: 'Y2K, shiny' },
      { id: 'era-prefix-mid-2000s', label: 'mid 2000s', labelKo: '2000년대 중반', description: 'Adds a mid 2000s prefix before the main genre.', descriptionKo: 'mid 2000s - 깨끗한 라디오 팝 믹스와 선명한 디지털 드럼 시대감입니다.', style: 'mid 2000s', sound: 'radio pop polish, clean digital drums', mood: 'clear, nostalgic' },
      { id: 'era-prefix-late-2000s', label: 'late 2000s', labelKo: '2000년대 후반', description: 'Adds a late 2000s prefix before the main genre.', descriptionKo: 'late 2000s - 클럽팝 신스, 압축감 있는 라디오 믹스, 밝은 에너지의 시대감입니다.', style: 'late 2000s', sound: 'club-pop synths, compressed radio mix', mood: 'bright, energetic' },
      { id: 'era-prefix-early-2010s', label: 'early 2010s', labelKo: '2010년대 초반', description: 'Adds an early 2010s prefix before the main genre.', descriptionKo: 'early 2010s - EDM 팝 빌드업과 페스티벌형 신스 리드가 강한 시대감입니다.', style: 'early 2010s', sound: 'EDM-pop build, shiny synth lead', mood: 'festival, bright' },
      { id: 'era-prefix-mid-2010s', label: 'mid 2010s', labelKo: '2010년대 중반', description: 'Adds a mid 2010s prefix before the main genre.', descriptionKo: 'mid 2010s - 트로피컬 팝, 깔끔한 사이드체인, 세련된 여름감의 시대감입니다.', style: 'mid 2010s', sound: 'tropical pop polish, clean sidechain', mood: 'sleek, summery' },
      { id: 'era-prefix-late-2010s', label: 'late 2010s', labelKo: '2010년대 후반', description: 'Adds a late 2010s prefix before the main genre.', descriptionKo: 'late 2010s - 미니멀 트랩팝 드럼과 정제된 보컬 공간감이 강한 시대감입니다.', style: 'late 2010s', sound: 'minimal trap-pop drums, polished vocal space', mood: 'modern, restrained' },
      { id: 'era-prefix-early-2020s', label: 'early 2020s', labelKo: '2020년대 초반', description: 'Adds an early 2020s prefix before the main genre.', descriptionKo: 'early 2020s - 클린한 모던 팝 믹스와 단단한 디지털 저역의 시대감입니다.', style: 'early 2020s', sound: 'clean modern pop mix, digital low-end', mood: 'modern, crisp' },
      { id: 'era-prefix-modern', label: 'modern', labelKo: '모던', description: 'Adds a modern prefix before the main genre.', descriptionKo: 'modern - 현재형 팝 프로덕션처럼 깨끗하고 선명한 최신 믹스 감각입니다.', style: 'modern', sound: 'clean modern production', mood: 'current, polished' },
      { id: 'era-prefix-y2k', label: 'Y2K', labelKo: 'Y2K', description: 'Adds a Y2K prefix before the main genre.', descriptionKo: 'Y2K - 2000년대 초반의 반짝이는 디지털 팝, 틴팝, 링톤 감각입니다.', style: 'Y2K', sound: 'glossy digital synths, shiny pop drums', mood: 'shiny, nostalgic' },
      { id: 'era-prefix-neo-retro', label: 'neo-retro', labelKo: '네오 레트로', description: 'Adds a neo-retro prefix before the main genre.', descriptionKo: 'neo-retro - 복고 질감을 현대적인 믹스와 팝 프로덕션으로 재해석한 감각입니다.', style: 'neo-retro', sound: 'retro color with modern polish', mood: 'stylish, nostalgic' },
      { id: 'era-prefix-future-retro', label: 'future-retro', labelKo: '퓨처 레트로', description: 'Adds a future-retro prefix before the main genre.', descriptionKo: 'future-retro - 과거의 레트로 신스와 미래적인 전자 질감이 함께 있는 감각입니다.', style: 'future-retro', sound: 'retro synths, futuristic digital sheen', mood: 'futuristic, retro' },
      { id: 'era-prefix-retro-futuristic', label: 'retro-futuristic', labelKo: '레트로 퓨처', description: 'Adds a retro-futuristic prefix before the main genre.', descriptionKo: 'retro-futuristic - 복고적 상상력과 SF적인 미래 질감이 섞인 시네마틱 감각입니다.', style: 'retro-futuristic', sound: 'neon synths, sci-fi retro polish', mood: 'cinematic, futuristic' },
      { id: 'era-prefix-timeless', label: 'timeless', labelKo: '타임리스', description: 'Adds a timeless feel before the main genre.', descriptionKo: 'timeless - 특정 시대에 묶이지 않는 클래식하고 오래가는 균형감입니다.', style: 'timeless', sound: 'classic balanced production', mood: 'classic, universal' },
      { id: 'separator-style-era-genre-texture', kind: 'separator', label: '장르별 시대감', labelKo: '장르별 시대감', description: '', descriptionKo: '', promptCore: '' },
      { id: '70s-vintage-soul', label: '70s Vintage Soul', labelKo: '70s 빈티지 소울', description: 'Warm 70s soul-inspired production texture.', descriptionKo: '70s Vintage Soul - 70년대 소울 감성의 따뜻한 빈티지 질감입니다.', style: '70s vintage soul texture', sound: 'warm bass, analog drums, soulful keys', mood: 'warm, nostalgic' },
      { id: '80s-retro-synth', label: '80s Retro Synth', labelKo: '80s 레트로 신스', description: '80s-inspired synth and gated rhythm color.', descriptionKo: '80s Retro Synth - 80년대식 신스와 레트로 리듬 질감입니다.', style: '80s retro synth texture', sound: 'analog synths, gated drums, neon pads', mood: 'retro, cinematic' },
      { id: '90s-new-jack', label: '90s New Jack Swing', labelKo: '90s 뉴잭스윙', description: '90s new jack swing groove and pop-R&B rhythm.', descriptionKo: '90s New Jack Swing - 90년대 뉴잭스윙 특유의 팝/R&B 리듬감입니다.', style: '90s new jack swing groove', sound: 'swingbeat drums, bright keys, punchy rhythm', mood: 'fresh, rhythmic' },
      { id: '90s-rnb', label: '90s R&B Warmth', labelKo: '90s R&B 감성', description: 'Smooth 90s R&B warmth and vocal-friendly production.', descriptionKo: '90s R&B Warmth - 90년대 R&B 특유의 부드럽고 따뜻한 감성입니다.', style: '90s R&B smoothness', sound: 'warm chords, smooth drums, soulful bass', mood: 'smooth, nostalgic' },
      { id: '2000s-y2k-pop', label: '2000s Y2K Pop', labelKo: '2000s Y2K 팝', description: 'Glossy 2000s pop polish and digital brightness.', descriptionKo: '2000s Y2K Pop - 2000년대 Y2K 팝의 반짝이는 디지털 질감입니다.', style: '2000s Y2K pop polish', sound: 'glossy synths, crisp drums, bright hooks', mood: 'shiny, nostalgic' },
      { id: 'cyworld-2000s', label: '2000s Cyworld Sentiment', labelKo: '2000s 싸이월드 감성', description: 'Korean 2000s internet-era sentimental pop mood.', descriptionKo: '2000s Cyworld Sentiment - 2000년대 싸이월드 시절의 감성적인 대중가요 질감입니다.', style: '2000s Korean internet-era sentiment', sound: 'soft piano, glossy strings, sentimental pop polish', mood: 'nostalgic, sentimental' },
      { id: '2010s-edm-pop', label: '2010s EDM Pop', labelKo: '2010s EDM 팝', description: '2010s EDM-pop build and festival-ready shine.', descriptionKo: '2010s EDM Pop - 2010년대 EDM 팝의 빌드업과 화려한 드롭감입니다.', style: '2010s EDM pop energy', sound: 'big builds, sidechain synths, festival drops', mood: 'energetic, bright' },
      { id: '2010s-idol-pop', label: '2010s Idol Pop', labelKo: '2010s 아이돌 팝', description: '2010s idol-pop polish and section contrast.', descriptionKo: '2010s Idol Pop - 2010년대 아이돌 팝의 세련된 구성과 섹션 대비감입니다.', style: '2010s idol-pop polish', sound: 'sharp section changes, polished synths, addictive hooks', mood: 'bright, energetic' },
      { id: '2020s-hyperpop', label: '2020s Hyperpop Texture', labelKo: '2020s 하이퍼팝 질감', description: 'Hyperpop-inspired bright distortion and digital exaggeration.', descriptionKo: '2020s Hyperpop Texture - 2020년대 하이퍼팝의 과장된 디지털 질감입니다.', style: '2020s hyperpop texture', sound: 'pitched vocals, bright distortion, glitchy synths', mood: 'hyper, synthetic' },
      { id: '2020s-minimal-pop', label: '2020s Minimal Pop', labelKo: '2020s 미니멀 팝', description: 'Clean 2020s minimal pop production.', descriptionKo: '2020s Minimal Pop - 2020년대식 간결하고 세련된 미니멀 팝 질감입니다.', style: '2020s minimal pop polish', sound: 'clean drums, sparse synths, focused vocal space', mood: 'modern, restrained' },
      { id: 'separator-style-era-media-texture', kind: 'separator', label: '매체/기기 질감', labelKo: '매체/기기 질감', description: '', descriptionKo: '', promptCore: '' },
      { id: 'retro-radio', label: 'Retro Radio Texture', labelKo: '복고풍 라디오 질감', description: 'Old radio-like warm filter and nostalgic noise.', descriptionKo: 'Retro Radio Texture - 오래된 라디오처럼 따뜻하고 필터링된 질감입니다.', style: 'retro radio texture', sound: 'filtered mids, soft noise, vintage broadcast warmth', mood: 'nostalgic, intimate' },
      { id: 'cassette-tape', label: 'Cassette Tape Texture', labelKo: '카세트 테이프 질감', description: 'Cassette warmth, wobble, and gentle hiss.', descriptionKo: 'Cassette Tape Texture - 카세트 특유의 따뜻함과 흔들림, 히스 노이즈입니다.', style: 'cassette tape texture', sound: 'tape hiss, soft wobble, analog warmth', mood: 'lo-fi, nostalgic' },
      { id: 'analog-vintage', label: 'Analog Vintage', labelKo: '아날로그 빈티지', description: 'Analog warmth and vintage production color.', descriptionKo: 'Analog Vintage - 아날로그 장비 특유의 따뜻한 빈티지 질감입니다.', style: 'analog vintage production', sound: 'soft saturation, warm harmonic color', mood: 'warm, classic' },
      { id: 'digital-y2k', label: 'Digital Y2K Texture', labelKo: '디지털 Y2K 질감', description: 'Early digital pop texture and Y2K brightness.', descriptionKo: 'Digital Y2K Texture - 초기 디지털 팝의 밝고 인공적인 Y2K 질감입니다.', style: 'digital Y2K texture', sound: 'thin bright synths, crisp digital drums', mood: 'shiny, nostalgic' },
      { id: 'retro-game-sound', label: 'Retro Game Sound', labelKo: '레트로 게임 사운드', description: 'Retro game-inspired chiptune and pixel-like sound.', descriptionKo: 'Retro Game Sound - 레트로 게임처럼 픽셀감 있는 전자음 질감입니다.', style: 'retro game sound texture', sound: 'chiptune leads, square waves, playful bleeps', mood: 'playful, nostalgic' },
      { id: 'early-internet', label: 'Early Internet Feel', labelKo: '초기 인터넷 감성', description: 'Early web-era digital nostalgia and amateur gloss.', descriptionKo: 'Early Internet Feel - 초기 인터넷 시대의 어설프지만 반짝이는 디지털 감성입니다.', style: 'early internet nostalgia', sound: 'light digital textures, quirky synthetic accents', mood: 'nostalgic, quirky' },
      { id: 'old-mp3-texture', label: 'Old MP3 Texture', labelKo: '구형 MP3 질감', description: 'Compressed digital texture like old MP3 files.', descriptionKo: 'Old MP3 Texture - 구형 MP3처럼 압축감이 느껴지는 디지털 질감입니다.', style: 'old MP3 compression texture', sound: 'compressed highs, narrow digital texture', mood: 'nostalgic, rough' },
      { id: 'separator-style-era-retro-mood', kind: 'separator', label: '레트로 무드', labelKo: '레트로 무드', description: '', descriptionKo: '', promptCore: '' },
      { id: 'neon-retro', label: 'Neon Retro Feel', labelKo: '네온 레트로 감성', description: 'Neon-lit retro-futurist pop color.', descriptionKo: 'Neon Retro Feel - 네온빛이 감도는 레트로 퓨처 감성입니다.', style: 'neon retro-futurist texture', sound: 'glowing synths, polished retro drums', mood: 'stylish, nocturnal' }
    ],
  },
  {
    id: 'synth-space',
    title: 'EDM & Dance',
    titleKo: 'EDM & 댄스',
    variants: [
      { id: 'separator-style-edm-disco', kind: 'separator', label: '디스코', labelKo: '디스코', description: '', descriptionKo: '', promptCore: '' },
      { id: 'classic-disco', label: '70s-Disco', labelKo: '70s-디스코', description: '70s disco dance groove with bright rhythmic lift.', descriptionKo: '70s-Disco - 70s 디스코 특유의 밝고 경쾌한 댄스 그루브입니다.', style: '70s disco groove', sound: 'four-on-the-floor drums, bright rhythm guitar', mood: 'uplifting, retro' },
      { id: 'fusion-nu-disco', label: 'Nu-Disco', labelKo: '누 디스코', description: 'Disco groove reinterpreted with modern pop and electronic polish.', descriptionKo: 'Nu-Disco - 디스코 그루브를 현대적인 팝/전자 프로덕션으로 보강한 퓨전 장르입니다.', style: 'Nu-Disco fusion', sound: 'slap bass, disco drum pulse, 16th-note funk guitar', mood: 'groovy, stylish' },
      { id: 'fusion-retro-disco', label: 'Retro Disco', labelKo: '레트로 디스코', description: 'Classic disco color with vintage dance-floor energy.', descriptionKo: 'Retro Disco - 빈티지한 디스코 리듬과 댄스 플로어 감성을 더합니다.', style: 'Retro Disco fusion', sound: 'four-on-the-floor drums, funky bass, bright strings', mood: 'retro, lively' },
      { id: 'separator-style-edm-house-club', kind: 'separator', label: '하우스/클럽', labelKo: '하우스/클럽', description: '', descriptionKo: '', promptCore: '' },
      { id: 'house-style', label: 'House', labelKo: '하우스', description: 'Four-on-the-floor house groove for dance movement.', descriptionKo: 'House - 하우스 특유의 4/4 그루브를 더합니다.', style: 'house groove, four-on-the-floor rhythm', sound: 'steady kick, clean dancefloor pulse', mood: 'smooth, energetic' },
      { id: 'fusion-deep-house', label: 'Deep House', labelKo: '딥 하우스', description: 'Warm house groove with deep bass and smooth club texture.', descriptionKo: 'Deep House - 깊은 베이스와 부드러운 클럽 질감의 하우스 그루브입니다.', style: 'Deep House fusion', sound: 'deep bass, soft house drums, warm keys', mood: 'smooth, nocturnal' },
      { id: 'fusion-soulful-house', label: 'Soulful House', labelKo: '소울풀 하우스', description: 'House rhythm with soulful chords and warm vocal-friendly color.', descriptionKo: 'Soulful House - 하우스 리듬에 소울풀한 코드와 따뜻한 보컬 친화 질감을 더합니다.', style: 'Soulful House fusion', sound: 'soulful keys, warm house groove, smooth bass', mood: 'warm, uplifting' },
      { id: 'fusion-progressive-house', label: 'Progressive House', labelKo: '프로그레시브 하우스', description: 'Expansive house build-up with emotional festival-scale lift.', descriptionKo: 'Progressive House - 감정적인 빌드업과 확장감 있는 하우스 전개를 더합니다.', style: 'Progressive House fusion', sound: 'sidechain synths, big builds, four-on-the-floor drums', mood: 'uplifting, expansive' },
      { id: 'fusion-tropical-house', label: 'Tropical House', labelKo: '트로피컬 하우스', description: 'Light tropical house color with warm plucks and relaxed dance pulse.', descriptionKo: 'Tropical House - 따뜻한 플럭과 여유로운 댄스 펄스가 있는 트로피컬 하우스 감성입니다.', style: 'Tropical House fusion', sound: 'tropical plucks, soft house drums, warm bass', mood: 'sunny, relaxed' },
      { id: 'fusion-uk-garage', label: 'UK Garage', labelKo: 'UK 개러지', description: 'Shuffling UK garage rhythm with bouncy syncopated drums.', descriptionKo: 'UK Garage - 셔플감 있는 UK 개러지 리듬과 탄력 있는 드럼 질감입니다.', style: 'UK Garage fusion', sound: 'shuffling drums, sub bass, chopped vocal rhythm', mood: 'bouncy, stylish' },
      { id: 'fusion-jersey-club', label: 'Jersey Club', labelKo: '저지 클럽', description: 'Fast club bounce with chopped kick patterns and playful energy.', descriptionKo: 'Jersey Club - 잘게 쪼개지는 킥 패턴과 빠른 클럽 바운스를 더합니다.', style: 'Jersey Club fusion', sound: 'triplet kick bounce, chopped club drums, vocal chops', mood: 'playful, kinetic' },
      { id: 'separator-style-edm-world-dance', kind: 'separator', label: '월드 댄스', labelKo: '월드 댄스', description: '', descriptionKo: '', promptCore: '' },
      { id: 'latin-rhythm', label: 'Latin Pop / Reggaeton', labelKo: '라틴 팝 / 레게톤', description: 'Latin-inspired rhythmic swing and percussion.', descriptionKo: 'Latin Pop / Reggaeton - 라틴 계열의 리듬감과 퍼커션 움직임을 더합니다.', style: 'Latin rhythmic movement', sound: 'syncopated percussion accents', mood: 'warm, lively' },
      { id: 'fusion-dancehall', label: 'Dancehall', labelKo: '댄스홀', description: 'Dancehall groove with syncopated island rhythm.', descriptionKo: 'Dancehall - 싱코페이션이 강한 아일랜드 리듬 기반의 댄스홀 그루브입니다.', style: 'Dancehall fusion', sound: 'dancehall drums, offbeat percussion, warm bass', mood: 'loose, groovy' },
      { id: 'fusion-afrobeats', label: 'Afrobeats', labelKo: '아프로비츠', description: 'Global groove fusion with light percussion and warm rhythmic bounce.', descriptionKo: 'Afrobeats - 가벼운 퍼커션과 따뜻한 리듬 바운스가 있는 글로벌 그루브입니다.', style: 'Afrobeats fusion', sound: 'afro percussion, warm bass, syncopated guitar accents', mood: 'sunny, groovy' },
      { id: 'fusion-amapiano', label: 'Amapiano', labelKo: '아마피아노', description: 'South African house-rooted groove with log drum and airy chords.', descriptionKo: 'Amapiano - 로그 드럼과 공기감 있는 코드가 특징인 남아공 하우스 기반 그루브입니다.', style: 'Amapiano fusion', sound: 'log drum bass, airy keys, soft house percussion', mood: 'deep, relaxed' },
      { id: 'fusion-moombahton', label: 'Moombahton', labelKo: '뭄바톤', description: 'Moombahton bounce with slowed club rhythm and tropical color.', descriptionKo: 'Moombahton - 느리게 흔들리는 클럽 리듬과 트로피컬한 바운스를 더합니다.', style: 'Moombahton fusion', sound: 'moombahton drums, syncopated bass, tropical synth accents', mood: 'bouncy, tropical' },
      { id: 'fusion-flamenco-pop', label: 'Flamenco Pop', labelKo: '플라멩코 팝', description: 'Flamenco guitar and handclap rhythm blended with pop structure.', descriptionKo: 'Flamenco Pop - 플라멩코 기타와 손뼉 리듬을 팝 구조에 섞습니다.', style: 'Flamenco Pop fusion', sound: 'flamenco guitar, handclaps, percussive footwork accents', mood: 'passionate, rhythmic' },
      { id: 'separator-style-edm-retro-synth', kind: 'separator', label: '레트로 전자', labelKo: '레트로 전자', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-retro-electro', label: 'Retro Electro', labelKo: '레트로 일렉트로', description: 'Old-school electro rhythm with synthetic retro color.', descriptionKo: 'Retro Electro - 올드스쿨 전자 리듬과 레트로 신스 질감을 더합니다.', style: 'Retro Electro fusion', sound: 'electro drums, synthetic bass, retro leads', mood: 'mechanical, retro' },
      { id: 'synthpop-sense', label: 'Synth-pop Sense', labelKo: '신스팝 감각', description: 'Synth-pop style melodic electronic color.', descriptionKo: 'Synth-pop Sense - 신스팝 특유의 선명한 멜로디와 전자 감각입니다.', style: 'synth-pop sensibility', sound: 'bright synth hooks and clean drum machines', mood: 'catchy, retro-modern' },
      { id: 'fusion-synthwave', label: 'Synthwave', labelKo: '신스웨이브', description: 'Retro-futuristic synth color with neon night-drive energy.', descriptionKo: 'Synthwave - 네온빛 야간 주행 같은 레트로 퓨처 신스 감성입니다.', style: 'Synthwave fusion', sound: 'analog synth arps, gated drums, neon pads', mood: 'cinematic, nocturnal' },
      { id: 'fusion-dreamwave', label: 'Dreamwave', labelKo: '드림웨이브', description: 'Dreamy synth atmosphere with soft retro-futuristic space.', descriptionKo: 'Dreamwave - 몽환적인 신스 공간감과 부드러운 레트로 퓨처 감성입니다.', style: 'Dreamwave fusion', sound: 'soft synth haze, floating pads, gentle electronic pulse', mood: 'dreamy, floating' },
      { id: 'fusion-outrun', label: 'Outrun', labelKo: '아웃런', description: 'Fast neon retro drive with cinematic electronic energy.', descriptionKo: 'Outrun - 빠른 네온 드라이브감과 영화적인 전자음 에너지를 더합니다.', style: 'Outrun fusion', sound: 'driving synth bass, pulsing arps, retro electronic drums', mood: 'fast, nocturnal' },
      { id: 'retro-synth', label: 'Retro Synth', labelKo: '레트로 신스', description: 'retro synth - Retro synth color with nostalgic electronic warmth.', descriptionKo: 'retro synth - 복고적인 신스 감성과 따뜻한 전자 질감입니다.', style: 'retro synth color', sound: 'analog-style synth lines', mood: 'nostalgic, neon' },
      { id: 'separator-style-edm-modern-electronic', kind: 'separator', label: '모던 전자', labelKo: '모던 전자', description: '', descriptionKo: '', promptCore: '' },
      { id: 'future-bass', label: 'Future Bass', labelKo: '퓨처 베이스', description: 'Wide future bass chords and elastic synth movement.', descriptionKo: 'Future Bass - 넓게 퍼지는 퓨처 베이스 코드와 탄력 있는 신스입니다.', style: 'future bass synth movement', sound: 'wide chords, elastic bass synth', mood: 'bright, emotional' },
      { id: 'fusion-hyperpop', label: 'Hyperpop', labelKo: '하이퍼팝', description: 'Exaggerated digital pop color with glitchy high-energy texture.', descriptionKo: 'Hyperpop - 과장된 디지털 질감과 글리치한 고에너지 팝 감성입니다.', style: 'Hyperpop fusion', sound: 'glitchy synths, bright distortion, pitched vocal texture', mood: 'hyper, synthetic' },
      { id: 'deep-electronic', label: 'Deep Electronic Mood', labelKo: '딥 일렉트로닉 무드', description: 'Deep electronic layers and immersive low atmosphere.', descriptionKo: 'Deep Electronic Mood - 깊게 잠기는 전자음 레이어와 몰입감입니다.', style: 'deep electronic mood', sound: 'dark pads, low electronic pressure', mood: 'immersive, moody' }
    ],
  },
  {
    id: 'hook-addiction',
    title: 'Hook Line',
    titleKo: '후렴 라인',
    variants: [
      { id: 'separator-style-hook-repeat', kind: 'separator', label: '반복 훅', labelKo: '반복 훅', description: '', descriptionKo: '', promptCore: '' },
      { id: 'one-line-hook', label: 'One-line Hook', labelKo: '한 줄 훅', description: 'A single strong line becomes the emotional anchor.', descriptionKo: 'One-line Hook - 한 줄이 곡의 중심 훅이 되도록 만듭니다.', style: 'one-line hook focus', sound: 'minimal hook anchor', mood: 'direct, memorable' },
      { id: 'short-hook-repeat', label: 'Short Hook Repeat', labelKo: '짧은 훅 반복', description: 'A short hook repeated for strong recall.', descriptionKo: 'Short Hook Repeat - 짧은 훅을 반복해 기억에 남게 합니다.', style: 'short repeated hook', sound: 'tight hook loop', mood: 'simple, catchy' },
      { id: 'easy-sing-chorus', label: 'Easy-sing Chorus', labelKo: '따라 부르는 후렴', description: 'A chorus with simple phrasing for easy singing.', descriptionKo: 'Easy-sing Chorus - 누구나 따라 부르기 쉬운 후렴 구조입니다.', style: 'easy-to-sing chorus', sound: 'simple vocal spacing', mood: 'friendly, accessible' },
      { id: 'singalong-point', label: 'Singalong Point', labelKo: '떼창 포인트', description: 'A chorus section that invites group singing.', descriptionKo: 'Singalong Point - 따라 부르기 쉬운 떼창 포인트를 만듭니다.', style: 'singalong chorus point', sound: 'group-friendly hook spacing', mood: 'communal, uplifting' },
      { id: 'chant-hook', label: 'Chant Hook', labelKo: '챈트 훅', description: 'Rhythmic chant-like hook for impact.', descriptionKo: 'Chant Hook - 구호처럼 외치는 리듬형 훅입니다.', style: 'chant-like hook', sound: 'rhythmic vocal chant accents', mood: 'energetic, bold' },
      { id: 'call-response-hook', label: 'Call-response Hook', labelKo: '콜앤리스폰스 훅', description: 'Hook built on call-and-response movement.', descriptionKo: 'Call-response Hook - 주고받는 구조의 후렴 훅을 만듭니다.', style: 'call-response hook movement', sound: 'alternating vocal hook accents', mood: 'interactive, playful' },
      { id: 'repeated-slogan', label: 'Repeated Slogan', labelKo: '반복되는 구호', description: 'A slogan-like phrase repeats as a hook device.', descriptionKo: 'Repeated Slogan - 구호처럼 반복되는 문구로 훅을 만듭니다.', style: 'repeated slogan hook', sound: 'chantable phrase repetition', mood: 'bold, performative' },
      { id: 'separator-style-hook-melody-catchy', kind: 'separator', label: '멜로디/캐치 훅', labelKo: '멜로디/캐치 훅', description: '', descriptionKo: '', promptCore: '' },
      { id: 'melody-hook', label: 'Melody Hook', labelKo: '멜로디 훅', description: 'A melodic phrase that becomes the main hook.', descriptionKo: 'Melody Hook - 선율 자체가 훅이 되는 멜로디 중심 스타일입니다.', style: 'melodic hook focus', sound: 'clear melodic motif', mood: 'singable, polished' },
      { id: 'catchy-hook', label: 'Catchy Hook', labelKo: '캐치한 훅', description: 'A hook designed to stick quickly in the listener’s ear.', descriptionKo: 'Catchy Hook - 귀에 빠르게 남는 캐치한 훅을 강화합니다.', style: 'catchy hook focus', sound: 'clear melodic hook emphasis', mood: 'memorable, bright' },
      { id: 'addictive-repeat', label: 'Addictive Repetition', labelKo: '중독성 있는 반복', description: 'Repetitive hook phrases that build familiarity.', descriptionKo: 'Addictive Repetition - 짧고 반복적인 훅으로 중독성을 더합니다.', style: 'addictive repeated hook phrases', sound: 'loop-friendly hook rhythm', mood: 'catchy, hypnotic' },
      { id: 'earworm-chorus', label: 'Earworm Chorus', labelKo: '귀에 남는 후렴', description: 'A chorus designed for strong earworm effect.', descriptionKo: 'Earworm Chorus - 계속 머릿속에 맴도는 후렴감을 강화합니다.', style: 'earworm chorus writing', sound: 'sticky melodic contour', mood: 'catchy, addictive' },
      { id: 'separator-style-hook-chorus-development', kind: 'separator', label: '후렴 전개', labelKo: '후렴 전개', description: '', descriptionKo: '', promptCore: '' },
      { id: 'chorus-focus', label: 'Chorus Focus', labelKo: '후렴 강조', description: 'Stronger chorus-centered arrangement and payoff.', descriptionKo: 'Chorus Focus - 후렴의 존재감과 완성도를 높이는 스타일입니다.', style: 'chorus-focused songwriting', sound: 'wide chorus lift', mood: 'satisfying, direct' },
      { id: 'chorus-shift', label: 'Chorus Shift', labelKo: '후렴 전환감', description: 'A chorus that changes the emotional or rhythmic angle.', descriptionKo: 'Chorus Shift - 후렴에서 분위기나 리듬이 전환되는 느낌을 줍니다.', style: 'chorus shift moment', sound: 'section contrast at the hook', mood: 'dynamic, surprising' },
      { id: 'chorus-explosion', label: 'Explosive Chorus', labelKo: '후렴 폭발', description: 'A chorus that opens wide with stronger energy.', descriptionKo: 'Explosive Chorus - 후렴에서 에너지가 크게 터지는 구조입니다.', style: 'explosive chorus payoff', sound: 'wide lift, stronger drums and harmony', mood: 'powerful, cathartic' },
      { id: 'hook-led-flow', label: 'Hook-led Flow', labelKo: '훅 중심 전개', description: 'The whole song is organized around the hook.', descriptionKo: 'Hook-led Flow - 곡 전체가 훅을 중심으로 돌아가는 전개입니다.', style: 'hook-led structure', sound: 'recurring hook motif', mood: 'focused, memorable' }
    ],
  },
  {
    id: 'band-live',
    title: 'Live Band',
    titleKo: '라이브 밴드',
    variants: [
      // SORIDRAW_LIVE_BAND_RECLASS_V13: only band genre/style items remain here.
      { id: 'separator-style-band-acoustic-indie', kind: 'separator', label: '어쿠스틱/인디', labelKo: '어쿠스틱/인디', description: '', descriptionKo: '', promptCore: '' },
      { id: 'acoustic-band', label: 'Acoustic Band', labelKo: '어쿠스틱 밴드', description: 'Acoustic band texture with natural warmth.', descriptionKo: 'Acoustic Band - 자연스러운 따뜻함의 어쿠스틱 밴드 질감입니다.', style: 'acoustic band', sound: 'acoustic guitar, soft drums, warm bass', mood: 'warm, organic' },
      { id: 'indie-band', label: 'Indie Band', labelKo: '인디 밴드', description: 'Loose indie band character and warm performance.', descriptionKo: 'Indie Band - 인디 밴드 특유의 자연스럽고 따뜻한 연주감입니다.', style: 'indie band', sound: 'raw guitars, natural room drums', mood: 'warm, sincere' },
      { id: 'separator-style-band-k-band', kind: 'separator', label: 'K-밴드', labelKo: 'K-밴드', description: '', descriptionKo: '', promptCore: '' },
      { id: 'k-band-emotional-rock', label: 'K-Band Emotional Rock', labelKo: 'K-밴드 감성 록', description: 'Korean emotional rock band style with dramatic melodic vocals.', descriptionKo: 'K-Band Emotional Rock - 한국 밴드 발라드록처럼 서정적인 멜로디와 감정적인 록 에너지를 더합니다.', style: 'K-band emotional rock', sound: 'emotional guitar band, driving drums', mood: 'emotional, anthemic' },
      { id: 'k-band-pop-rock', label: 'K-Band Pop Rock', labelKo: 'K-밴드 팝록', description: 'Bright Korean pop-rock band style with clear hooks.', descriptionKo: 'K-Band Pop Rock - 밝고 선명한 멜로디 중심의 한국 밴드 팝록 감각을 더합니다.', style: 'K-band pop rock', sound: 'bright guitars, pop-rock drums', mood: 'fresh, energetic' },
      { id: 'modern-k-band-alt-rock', label: 'Modern K-Band Alt Rock', labelKo: '모던 K-밴드 얼터록', description: 'Modern Korean alternative rock band style with polished vocals and guitars.', descriptionKo: 'Modern K-Band Alt Rock - 세련된 보컬과 감성적인 기타 라인이 중심인 현대 한국 얼터너티브 록 밴드 스타일입니다.', style: 'modern K-band alt rock', sound: 'polished guitars, modern band drums', mood: 'stylish, emotional' },
      { id: 'separator-style-band-brit-soft-rock', kind: 'separator', label: '브릿/소프트 록', labelKo: '브릿/소프트 록', description: '', descriptionKo: '', promptCore: '' },
      { id: 'britpop-sense', label: 'Britpop', labelKo: '브릿팝', description: 'Britpop-like melodic band character.', descriptionKo: 'Britpop - 브릿팝 특유의 멜로딕한 기타 밴드 감각입니다.', style: 'Britpop', sound: 'jangly guitars and steady drums', mood: 'nostalgic, anthemic' },
      { id: 'soft-rock-band', label: 'Soft Rock Band', labelKo: '소프트 록 밴드', description: 'Soft rock band style with smooth guitars and stable drums.', descriptionKo: 'Soft Rock Band - 부드러운 기타와 안정적인 드럼이 중심인 소프트 록 밴드 스타일입니다.', style: 'soft rock band', sound: 'smooth guitars, steady drums', mood: 'warm, easygoing' },
      { id: 'rock', label: 'Rock', labelKo: '록', description: 'Modern rock foundation and band energy.', descriptionKo: 'Rock - 밴드 중심의 기본 록 에너지를 더합니다.', style: 'rock band', sound: 'guitar drive, live drum force', mood: 'powerful, energetic' },
      { id: 'separator-style-band-punk-funk', kind: 'separator', label: '펑크/펑크록', labelKo: '펑크/펑크록', description: '', descriptionKo: '', promptCore: '' },
      { id: 'pop-punk-band', label: 'Pop Punk Band', labelKo: '팝 펑크 밴드', description: 'Fast pop-punk band style with youthful guitar energy.', descriptionKo: 'Pop Punk Band - 빠르고 직선적인 기타와 청춘감 있는 보컬 중심의 팝 펑크 밴드 스타일입니다.', style: 'pop punk band', sound: 'fast guitars, punchy drums', mood: 'youthful, urgent' },
      { id: 'punk-rock', label: 'Punk Rock', labelKo: '펑크 록', description: 'Fast, direct punk rock drive.', descriptionKo: 'Punk Rock - 빠르고 직선적인 펑크 록 에너지입니다.', style: 'punk rock', sound: 'fast guitars, punchy drums', mood: 'rebellious, urgent' },
      { id: 'funk-rock-band', label: 'Funk Rock Band', labelKo: '펑크 록 밴드', description: 'Funk-rock band style with tight rhythmic guitar.', descriptionKo: 'Funk Rock Band - 펑키한 기타 리듬과 밴드 에너지가 결합된 스타일입니다.', style: 'funk rock band', sound: 'funk guitar, tight drums, live bass', mood: 'groovy, energetic' },
      { id: 'separator-style-band-j-anime-emo', kind: 'separator', label: 'J/애니/이모 록', labelKo: 'J/애니/이모 록', description: '', descriptionKo: '', promptCore: '' },
      { id: 'j-rock-band', label: 'J-Rock Band', labelKo: 'J-록 밴드', description: 'Japanese rock band style with fast drums and clear guitar riffs.', descriptionKo: 'J-Rock Band - 빠른 드럼과 선명한 기타 리프가 중심인 일본식 록 밴드 스타일입니다.', style: 'J-rock band', sound: 'fast drums, clear guitar riffs', mood: 'bright, driving' },
      { id: 'anime-rock-band', label: 'Anime Rock Band', labelKo: '애니 록 밴드', description: 'Anime opening-like bright and driving rock band style.', descriptionKo: 'Anime Rock Band - 애니메이션 오프닝처럼 밝고 질주감 있는 밴드 록 스타일입니다.', style: 'anime rock band', sound: 'driving guitars, fast drums, bright hooks', mood: 'exciting, heroic' },
      { id: 'emo-rock-band', label: 'Emo Rock Band', labelKo: '이모 록 밴드', description: 'Emotional rock band style with expressive vocals and melodic guitars.', descriptionKo: 'Emo Rock Band - 감정적인 보컬과 서정적인 기타 진행이 중심인 이모 록 밴드 스타일입니다.', style: 'emo rock band', sound: 'emotional guitars, dynamic drums', mood: 'vulnerable, intense' },
      { id: 'separator-style-band-post-full', kind: 'separator', label: '포스트/풀밴드', labelKo: '포스트/풀밴드', description: '', descriptionKo: '', promptCore: '' },
      { id: 'post-rock-band', label: 'Post-Rock Band', labelKo: '포스트록 밴드', description: 'Post-rock band style with layered guitars and gradual crescendos.', descriptionKo: 'Post-Rock Band - 긴 여운과 점층적인 기타 레이어가 중심인 포스트록 밴드 스타일입니다.', style: 'post-rock band', sound: 'layered guitars, gradual crescendos', mood: 'expansive, cinematic' },
      { id: 'band', label: 'Full Band Sound', labelKo: '풀 밴드 사운드', description: 'Balanced full band ensemble feeling.', descriptionKo: 'Full Band Sound - 드럼, 베이스, 기타, 건반이 어우러지는 기본 풀 밴드감입니다.', style: 'full band sound', sound: 'drums, bass, guitar, keys in balance', mood: 'organic, live' }
    ],
  },
  {
    id: 'stage-shift',
    title: 'Mood Transition',
    titleKo: '분위기 전환',
    variants: [
      // SORIDRAW_STYLE_CATEGORY_RECLASS_V11: moved from EDM & Dance / Groove into Mood Transition.
      { id: 'separator-style-shift-build-live', kind: 'separator', label: '빌드업/라이브 전환', labelKo: '빌드업/라이브 전환', description: '', descriptionKo: '', promptCore: '' },
      { id: 'modern-edm', label: 'EDM Build-up', labelKo: 'EDM 빌드업', description: 'Modern EDM build and polished drop energy.', descriptionKo: 'EDM Build-up - 현대적인 EDM 빌드업과 드롭감을 더합니다.', style: 'modern EDM build-up and drops', sound: 'sharp builds, sidechain impact', mood: 'high energy, powerful' },
      { id: 'improv-feel', label: 'Improvisational Feel', labelKo: '즉흥 연주감', description: 'Loose interplay and spontaneous instrumental motion.', descriptionKo: 'Improvisational Feel - 즉흥적으로 주고받는 연주감을 더합니다.', style: 'improvisational interplay', sound: 'loose instrumental responses', mood: 'free, lively' },
      { id: 'climax-band-up', label: 'Climax Band-up', labelKo: '클라이맥스 밴드업', description: 'Band arrangement grows toward a bigger climax.', descriptionKo: 'Climax Band-up - 후반 클라이맥스로 밴드가 점점 커지는 전개입니다.', style: 'climax band build-up', sound: 'growing drums and guitars', mood: 'rising, cathartic' },
      { id: 'separator-style-shift-rhythm-rap', kind: 'separator', label: '리듬/랩 전환', labelKo: '리듬/랩 전환', description: '', descriptionKo: '', promptCore: '' },
      { id: 'uptempo-bounce', label: 'Uptempo Bounce', labelKo: '업템포 탄력', description: 'Fast, energetic rhythmic lift.', descriptionKo: 'Uptempo Bounce - 빠르고 탄력 있는 업템포 움직임을 더합니다.', style: 'uptempo rhythmic bounce', sound: 'energetic drum drive', mood: 'bright, lively' },
      { id: 'rhythmic-development', label: 'Rhythmic Development', labelKo: '리듬감 있는 전개', description: 'Arrangement develops through rhythmic motion.', descriptionKo: 'Rhythmic Development - 리듬의 변화로 곡 전개를 살리는 스타일입니다.', style: 'rhythm-led development', sound: 'sectional rhythmic changes', mood: 'moving, dynamic' },
      { id: 'staccato-rhythm', label: 'Staccato Rhythm', labelKo: '끊어치는 리듬', description: 'Sharp, short rhythmic articulation.', descriptionKo: 'Staccato Rhythm - 짧고 또렷하게 끊어치는 리듬감을 더합니다.', style: 'staccato rhythmic articulation', sound: 'tight short accents', mood: 'sharp, precise' },
      { id: 'hard-rap-flow', label: 'Hard Rap Flow', labelKo: '하드 랩 플로우', description: 'Harder rap energy with stronger rhythmic attack.', descriptionKo: 'Hard Rap Flow - 강한 어택감의 랩 플로우를 더합니다.', style: 'hard rap flow emphasis', sound: 'aggressive rhythmic phrasing', mood: 'intense, bold' },
      { id: 'aggressive-rap', label: 'Aggressive Rap', labelKo: '공격적인 랩', description: 'Forceful rap sections with aggressive phrasing.', descriptionKo: 'Aggressive Rap - 공격적인 랩 파트를 강화합니다.', style: 'aggressive rap section energy', sound: 'sharp vocal attack over hard drums', mood: 'angry, powerful' },
      { id: 'separator-style-shift-character-contrast', kind: 'separator', label: '캐릭터/대비 전환', labelKo: '캐릭터/대비 전환', description: '', descriptionKo: '', promptCore: '' },
      { id: 'bright-to-dark', label: 'Bright to Dark', labelKo: '밝음에서 어둠으로', description: 'A bright surface turns into dark emotional pressure.', descriptionKo: 'Bright to Dark - 밝은 분위기가 어두운 압박감으로 뒤집히는 전환입니다.', style: 'bright-to-dark contrast', sound: 'major-to-minor shift, darker beat entry', mood: 'surprising, ominous' },
      { id: 'sweet-to-aggressive', label: 'Sweet to Aggressive', labelKo: '달콤함에서 공격성으로', description: 'Sweet melody turns into aggressive vocal or beat energy.', descriptionKo: 'Sweet to Aggressive - 달콤한 멜로디가 공격적인 보컬/비트로 뒤집힙니다.', style: 'sweet-to-aggressive switch', sound: 'soft hook shifting into hard rap or trap drop', mood: 'volatile, exciting' },
      { id: 'cute-to-madness', label: 'Cute to Madness', labelKo: '귀여움에서 광기로', description: 'Cute energy snaps into unstable madness.', descriptionKo: 'Cute to Madness - 귀여운 느낌이 불안한 광기와 공격성으로 뒤집힙니다.', style: 'cute-to-madness switch', sound: 'sugary hook snapping into aggressive rap or distorted drop', mood: 'playful, menacing' },
      { id: 'dual-persona-shift', label: 'Dual Persona Shift', labelKo: '이중 페르소나 전환', description: 'Two contrasting personas alternate in the same track.', descriptionKo: 'Dual Persona Shift - 한 곡 안에서 두 개의 페르소나가 오가는 전환입니다.', style: 'dual-persona transition', sound: 'contrasting vocal and beat sections', mood: 'split, theatrical' },
      { id: 'theatrical-idol-shift', label: 'Theatrical Idol Shift', labelKo: '극장형 아이돌 전환', description: 'Idol-pop performance shifts like a theatrical scene.', descriptionKo: 'Theatrical Idol Shift - 아이돌 무대가 극장처럼 장면 전환되는 스타일입니다.', style: 'theatrical idol-pop shift', sound: 'stage hits, bright hooks, sudden darker sections', mood: 'dramatic, playful' },
      { id: 'separator-style-shift-horror-dark', kind: 'separator', label: '호러/다크 전환', labelKo: '호러/다크 전환', description: '', descriptionKo: '', promptCore: '' },
      { id: 'horror-pop', label: 'Horror Pop', labelKo: '호러팝', description: 'Pop structure colored with psychological horror tension.', descriptionKo: 'Horror Pop - 팝 구조 위에 심리공포와 불안을 얹는 스타일입니다.', style: 'horror-pop tension', sound: 'eerie synth stabs, low pulses, unsettling accents', mood: 'creepy, anxious' },
      { id: 'psycho-horror-shift', label: 'Psychological Horror Shift', labelKo: '심리공포 전환', description: 'A psychological horror turn hidden inside pop performance.', descriptionKo: 'Psychological Horror Shift - 밝은 곡 안에 심리공포가 갑자기 드러나는 전환입니다.', style: 'psychological horror transition', sound: 'low drones, eerie accents, sudden silence', mood: 'disturbing, tense' },
      { id: 'dark-trap-switch', label: 'Dark Trap Switch', labelKo: '다크트랩 전환', description: 'Bright pop sections switch into dark trap drops.', descriptionKo: 'Dark Trap Switch - 밝은 구간이 묵직한 다크 트랩으로 꺾이는 전환입니다.', style: 'abrupt dark trap switch', sound: 'heavy 808, sharp hi-hats, sudden beat drops', mood: 'tense, menacing' },
      { id: 'separator-style-shift-drop-abrupt', kind: 'separator', label: '드롭/급전환', labelKo: '드롭/급전환', description: '', descriptionKo: '', promptCore: '' },
      { id: 'sudden-switch-structure', label: 'Sudden Switch Structure', labelKo: '급전환 구조', description: 'Abrupt switches between contrasting sections.', descriptionKo: 'Sudden Switch Structure - 서로 다른 구간이 갑자기 전환되는 구조입니다.', style: 'sudden switch structure', sound: 'sharp section cuts and contrast', mood: 'unstable, surprising' },
      { id: 'reverse-drop', label: 'Reversal Drop', labelKo: '반전 드롭', description: 'A drop that reverses the expected mood.', descriptionKo: 'Reversal Drop - 예상과 다른 방향으로 터지는 반전 드롭입니다.', style: 'reversal drop structure', sound: 'surprise drop and contrast impact', mood: 'shocking, dynamic' },
      { id: 'dramatic-drop', label: 'Dramatic Drop', labelKo: '극적 드롭', description: 'Sudden explosive drops and impact moments.', descriptionKo: 'Dramatic Drop - 갑작스러운 드롭으로 극적인 충격을 만드는 스타일입니다.', style: 'dramatic drop-driven transition', sound: 'abrupt drops, strong transient impact', mood: 'explosive, theatrical' },
      { id: 'separator-style-shift-stage-effect', kind: 'separator', label: '무대 효과', labelKo: '무대 효과', description: '', descriptionKo: '', promptCore: '' },
      { id: 'stage-collapse', label: 'Stage Collapse', labelKo: '무대 붕괴감', description: 'A polished stage performance collapses into chaos.', descriptionKo: 'Stage Collapse - 완성된 무대가 점점 혼돈으로 무너지는 느낌입니다.', style: 'stage-performance collapse', sound: 'crowd chants, broken transitions, distorted stage accents', mood: 'chaotic, theatrical' },
      { id: 'lights-collapse', label: 'Lighting Collapse', labelKo: '조명 붕괴감', description: 'Stage lights feel like they collapse into darkness.', descriptionKo: 'Lighting Collapse - 무대 조명이 무너져 어둠으로 내려앉는 느낌입니다.', style: 'stage-light collapse imagery', sound: 'blinding hits falling into dark low-end', mood: 'dramatic, unsettling' },
      { id: 'crowd-shift', label: 'Crowd Shift', labelKo: '관객 함성 전환', description: 'Crowd energy becomes part of the transition.', descriptionKo: 'Crowd Shift - 관객 함성이 곡 전환의 일부처럼 작동합니다.', style: 'crowd-energy transition', sound: 'crowd chants, arena shouts, sudden cuts', mood: 'performative, intense' },
      { id: 'chaotic-stage-shift', label: 'Chaotic Stage Shift', labelKo: '혼돈 무대 전환', description: 'Fast unstable transitions between performance states.', descriptionKo: 'Chaotic Stage Shift - 서로 다른 무대 상태가 빠르게 전환되는 혼돈형 스타일입니다.', style: 'chaotic stage-shift structure', sound: 'sudden cuts, rhythmic shocks, crowd energy', mood: 'chaotic, unpredictable' }
    ],
  },
  {
    id: 'cinematic-scene',
    title: 'Theme Music',
    titleKo: '테마 뮤직',
    variants: [
      { id: 'separator-style-theme-ost-scene', kind: 'separator', label: 'OST/장면감', labelKo: 'OST/장면감', description: '', descriptionKo: '', promptCore: '' },
      { id: 'ost-emotion', label: 'OST Emotion', labelKo: 'OST 감성', description: 'Drama or film OST-like emotional development.', descriptionKo: 'OST Emotion - 드라마나 영화 OST 같은 감정 전개를 더합니다.', style: 'OST-like emotional development', sound: 'theme-driven melodic lift', mood: 'emotional, narrative' },
      { id: 'narrative-atmosphere', label: 'Narrative Atmosphere', labelKo: '서사적인 분위기', description: 'Story-like atmosphere with a clear emotional arc.', descriptionKo: 'Narrative Atmosphere - 이야기처럼 느껴지는 서사적 분위기입니다.', style: 'narrative atmosphere', sound: 'theme motifs and paced development', mood: 'story-driven, immersive' },
      { id: 'cinematic', label: 'Cinematic', labelKo: '시네마틱', description: 'Film-like dramatic atmosphere and scale.', descriptionKo: 'Cinematic - 영화적인 장면감과 스케일을 더합니다.', style: 'cinematic atmosphere', sound: 'wide dramatic production', mood: 'visual, dramatic' },
      { id: 'dark-film-feel', label: 'Dark Film Feel', labelKo: '어두운 영화감', description: 'Dark film-like tone and shadowy production.', descriptionKo: 'Dark Film Feel - 어두운 영화 장면 같은 질감을 더합니다.', style: 'dark cinematic film tone', sound: 'shadowy pads, low pulses', mood: 'dark, brooding' },
      { id: 'slowmotion-scene', label: 'Slow-motion Scene', labelKo: '슬로모션 장면감', description: 'Music that feels like a slow-motion visual moment.', descriptionKo: 'Slow-motion Scene - 슬로모션 장면처럼 감정이 길게 늘어지는 느낌입니다.', style: 'slow-motion cinematic feel', sound: 'stretched transitions, long reverb tails', mood: 'dramatic, suspended' },
      { id: 'separator-style-theme-build-tension', kind: 'separator', label: '빌드업/긴장', labelKo: '빌드업/긴장', description: '', descriptionKo: '', promptCore: '' },
      { id: 'emotional-build', label: 'Emotional Build-up', labelKo: '감정적인 빌드업', description: 'Emotional build that grows section by section.', descriptionKo: 'Emotional Build-up - 섹션마다 감정이 차오르는 빌드업입니다.', style: 'emotional build-up', sound: 'gradual layering and lift', mood: 'rising, heartfelt' },
      { id: 'tense-development', label: 'Tense Development', labelKo: '긴장감 있는 전개', description: 'Tense progression with suspense and pressure.', descriptionKo: 'Tense Development - 불안과 압박이 느껴지는 긴장감 있는 전개입니다.', style: 'tense cinematic development', sound: 'pulsing low strings or dark accents', mood: 'suspenseful, anxious' },
      { id: 'scene-transition', label: 'Scene Transition', labelKo: '장면 전환감', description: 'Arrangement that feels like scene changes in a film.', descriptionKo: 'Scene Transition - 영화 장면이 바뀌듯 전환되는 느낌입니다.', style: 'scene-transition arrangement', sound: 'sectional cinematic shifts', mood: 'dynamic, visual' },
      { id: 'separator-style-theme-orchestra-scale', kind: 'separator', label: '오케스트라/스케일', labelKo: '오케스트라/스케일', description: '', descriptionKo: '', promptCore: '' },
      { id: 'dramatic-strings', label: 'Dramatic Strings', labelKo: '극적인 스트링', description: 'Dramatic string movement for emotional height.', descriptionKo: 'Dramatic Strings - 감정을 높이는 극적인 스트링 움직임입니다.', style: 'dramatic string writing', sound: 'rising string lines', mood: 'emotional, cinematic' },
      { id: 'orchestral-hit', label: 'Orchestral Hits', labelKo: '오케스트라 히트', description: 'Orchestral impact hits for dramatic moments.', descriptionKo: 'Orchestral Hits - 극적인 순간에 오케스트라 히트감을 더합니다.', style: 'orchestral impact moments', sound: 'brass and string hits', mood: 'dramatic, intense' },
      { id: 'large-scale-sound', label: 'Large-scale Sound', labelKo: '스케일 큰 사운드', description: 'Large-scale arrangement and wide sonic image.', descriptionKo: 'Large-scale Sound - 크고 넓게 펼쳐지는 대형 사운드입니다.', style: 'large-scale sonic image', sound: 'wide layers and big dynamic spread', mood: 'epic, spacious' },
      { id: 'grand-development', label: 'Grand Development', labelKo: '웅장한 전개', description: 'Large and expansive arrangement growth.', descriptionKo: 'Grand Development - 스케일이 커지는 웅장한 전개감입니다.', style: 'grand arrangement development', sound: 'expanding layers and wide dynamics', mood: 'epic, powerful' },
      { id: 'separator-style-theme-trailer-climax', kind: 'separator', label: '예고편/클라이맥스', labelKo: '예고편/클라이맥스', description: '', descriptionKo: '', promptCore: '' },
      { id: 'trailer-feel', label: 'Trailer Feel', labelKo: '영화 예고편 느낌', description: 'Trailer-like build with bold impacts.', descriptionKo: 'Trailer Feel - 영화 예고편처럼 강한 빌드업과 임팩트를 줍니다.', style: 'trailer-like dramatic build', sound: 'impact hits, risers, big drums', mood: 'intense, suspenseful' },
      { id: 'heroic-rise', label: 'Heroic Rise', labelKo: '영웅적 상승감', description: 'Heroic upward lift and triumphant scale.', descriptionKo: 'Heroic Rise - 영웅적으로 차오르는 상승감을 더합니다.', style: 'heroic rising development', sound: 'bright brass, rising drums, wide chords', mood: 'heroic, uplifting' },
      { id: 'tragic-climax', label: 'Tragic Climax', labelKo: '비극적 클라이맥스', description: 'A climactic moment colored by tragedy.', descriptionKo: 'Tragic Climax - 비극적인 감정이 터지는 클라이맥스입니다.', style: 'tragic climax focus', sound: 'minor swelling layers', mood: 'tragic, intense' }
    ],
  },
  {
    id: 'groove-flow',
    title: 'Groove Rhythm',
    titleKo: '리듬감',
    variants: [
      { id: 'separator-style-groove-low-pressure', kind: 'separator', label: '저자극 루프', labelKo: '저자극 루프', description: '', descriptionKo: '', promptCore: '' },
      { id: 'fusion-study-beats', label: 'Study Beats', labelKo: '스터디 비트', description: 'Low-pressure beat style for calm focus and soft repetition.', descriptionKo: 'Study Beats - 차분한 집중감과 반복 그루브를 주는 저자극 비트 스타일입니다.', style: 'Study Beats fusion', sound: 'soft drums, mellow keys, low-pressure loop', mood: 'calm, focused' },
      { id: 'separator-style-groove-swing-bounce', kind: 'separator', label: '스윙/바운스', labelKo: '스윙/바운스', description: '', descriptionKo: '', promptCore: '' },
      { id: 'shuffle-rhythm', label: 'Shuffle Rhythm', labelKo: '셔플 리듬', description: 'Shuffle rhythm with rolling movement.', descriptionKo: 'Shuffle Rhythm - 구르는 듯한 셔플 리듬감을 더합니다.', style: 'shuffle rhythmic movement', sound: 'rolling groove feel', mood: 'easygoing, rhythmic' },
      { id: 'bounce-feel', label: 'Bounce Feel', labelKo: '바운스감', description: 'A bouncy, elastic rhythmic feel.', descriptionKo: 'Bounce Feel - 몸이 자연스럽게 움직이는 바운스감을 더합니다.', style: 'bouncy rhythmic feel', sound: 'elastic groove and playful accents', mood: 'light, groovy' },
      { id: 'separator-style-groove-loose', kind: 'separator', label: '느슨한 그루브', labelKo: '느슨한 그루브', description: '', descriptionKo: '', promptCore: '' },
      { id: 'loose-groove', label: 'Loose Groove', labelKo: '느슨한 그루브', description: 'Relaxed groove that sits behind the beat.', descriptionKo: 'Loose Groove - 박자 뒤에 느슨하게 걸치는 그루브감을 더합니다.', style: 'loose laid-back groove', sound: 'behind-the-beat rhythm', mood: 'relaxed, chill' },
      { id: 'loose-rap-groove', label: 'Loose Rap Groove', labelKo: '느슨한 랩 그루브', description: 'Relaxed rap rhythm with a loose pocket.', descriptionKo: 'Loose Rap Groove - 느슨하게 흐르는 랩 그루브를 더합니다.', style: 'loose rap groove', sound: 'laid-back beat pocket', mood: 'cool, relaxed' },
      { id: 'groovy-flow', label: 'Groovy Flow', labelKo: '그루비한 흐름', description: 'A continuous groove that keeps the track moving.', descriptionKo: 'Groovy Flow - 곡 전체를 자연스럽게 밀어주는 그루브 흐름입니다.', style: 'continuous groovy flow', sound: 'smooth rhythmic continuity', mood: 'steady, stylish' },
      { id: 'separator-style-groove-tight-dance', kind: 'separator', label: '타이트/댄스', labelKo: '타이트/댄스', description: '', descriptionKo: '', promptCore: '' },
      { id: 'tight-rhythm', label: 'Tight Rhythm', labelKo: '타이트한 리듬', description: 'Precise rhythm with clean punch.', descriptionKo: 'Tight Rhythm - 정확하고 선명하게 맞물리는 타이트한 리듬입니다.', style: 'tight rhythmic precision', sound: 'clean punchy rhythm section', mood: 'controlled, crisp' },
      { id: 'dance', label: 'Dance Rhythm', labelKo: '댄스 리듬', description: 'Rhythm and performance-centered dance movement.', descriptionKo: 'Dance Rhythm - 리듬과 퍼포먼스 중심의 댄스감을 더합니다.', style: 'dance-focused pulse', sound: 'immediate rhythmic energy', mood: 'performance-ready' },
    ],
  }
];


export const STYLE_GROUPS = [
  // SORIDRAW_STYLE_MENU_LAYOUT_V3_2_FIXED
  // 화면이 2열 grid(row-major)로 채워지기 때문에, 원하는 좌/우 컬럼 배치를 만들기 위해 좌/우 항목을 행 단위로 교차 배치합니다.
  // 왼쪽 컬럼: 장르 계열 / 오른쪽 컬럼: 질감·표현·전개 계열
  // 기존 id, cycleIds, 세부 variants는 변경하지 않고 표시 이름과 배치 순서만 정리합니다.
  { id: 'fusion-genre', label: 'Fusion Genre', labelKo: '퓨전 장르', descriptionKo: '기본 장르 위에 덧입히는 퓨전 장르를 선택합니다.', cycleIds: ['fusion-genre'] },
  { id: 'vocal-expression', label: 'Vocal Line', labelKo: '보컬 라인', descriptionKo: '보컬이 어떤 감정과 태도로 표현되는지 보강합니다.', cycleIds: ['vocal-expression'] },

  { id: 'rhythm-bounce', label: 'Jazz & R&B', labelKo: '재즈 & 알앤비', descriptionKo: '재즈, R&B, 네오소울, 보사노바, 펑크처럼 화성과 그루브가 살아있는 장르감을 보강합니다.', cycleIds: ['rhythm-bounce'] },
  { id: 'space-texture', label: 'Space Texture', labelKo: '공간 질감', descriptionKo: '우주, 수중, 차 안, 전화기 너머처럼 어디서 들리는 듯한 공간감을 보강합니다.', cycleIds: ['space-texture'] },

  { id: 'rap-beat-texture', label: 'Hip-hop', labelKo: '힙합', descriptionKo: '힙합, 붐뱁, 재지 힙합, 로파이 힙합, 칠홉, 트랩, 드릴, 클라우드 랩, 멜로딕 랩 같은 힙합 장르감을 보강합니다.', cycleIds: ['rap-beat-texture'] },
  { id: 'era-texture', label: 'Era Texture', labelKo: '시대 질감', descriptionKo: '70s~2020s까지 시대별 유행 사운드와 믹스 질감을 보강합니다.', cycleIds: ['era-texture'] },

  { id: 'synth-space', label: 'EDM & Dance', labelKo: 'EDM & 댄스', descriptionKo: '디스코, 하우스, UK 개러지, 저지 클럽, 레게톤, 아프로비츠, EDM, 신스 계열 댄스 장르감을 보강합니다.', cycleIds: ['synth-space'] },
  { id: 'hook-addiction', label: 'Hook Line', labelKo: '후렴 라인', descriptionKo: '후렴, 훅, 반복 구간의 중독성과 기억성을 강화합니다.', cycleIds: ['hook-addiction'] },

  { id: 'band-live', label: 'Live Band', labelKo: '라이브 밴드', descriptionKo: 'K-밴드, 인디, 브릿팝, 록, 팝펑크, J-록, 애니록처럼 라이브 밴드 장르감을 보강합니다.', cycleIds: ['band-live'] },
  { id: 'stage-shift', label: 'Mood Transition', labelKo: '분위기 전환', descriptionKo: '급전환, 무대 붕괴, 밝음에서 어둠으로 바뀌는 특수 연출을 보강합니다.', cycleIds: ['stage-shift'] },

  { id: 'cinematic-scene', label: 'Theme Music', labelKo: '테마 뮤직', descriptionKo: 'OST, 영화적 장면, 웅장한 전개와 서사감을 보강합니다.', cycleIds: ['cinematic-scene'] },
  { id: 'groove-flow', label: 'Groove Rhythm', labelKo: '리듬감', descriptionKo: '장르가 아니라 곡 전개 배경에 은은하게 깔리는 셔플, 바운스, 느슨함, 타이트함 같은 그루브 리듬감을 보강합니다.', cycleIds: ['groove-flow'] },
] as const;

export const SOUND_STYLES: SoundStyleItem[] = STYLE_CYCLES.flatMap((cycle) =>
  cycle.variants.map((variant) => ({
    ...variant,
    _ts: Date.now(),
  }))
);


// SORIDRAW_SOUND_KEYWORD_PREFIX_V6_1_FIXED: sound menu descriptions show the English prompt keyword before Korean explanation.
// SORIDRAW_SOUND_INSTRUMENT_SEPARATORS_V19: 사운드 악기 메뉴 구분선 + 압축 키워드 + 설명 정리
export const SOUND_TEXTURE_CYCLES = [
  {
    id: 'recommended-sound-combos',
    title: 'Recommended Combos',
    titleKo: '추천 조합',
    variants: [
      {
        id: 'rec-heavy-808-bass',
        label: 'Heavy 808 Bass',
        labelKo: '묵직한 808 베이스',
        description: 'Heavy 808 Bass - 808과 트랩 리듬을 한 번에 잡는 저역 중심 조합입니다. 어두운 힙합, K-Trap, 강한 아이돌곡에 잘 어울립니다.',
        descriptionKo: 'Heavy 808 Bass - 808과 트랩 리듬을 한 번에 잡는 저역 중심 조합입니다. 어두운 힙합, K-Trap, 강한 아이돌곡에 잘 어울립니다.',
        promptCore: '',
        applyPools: [
          ['heavy-808', 'trap-hi-hats', 'hard-snare', 'dark-synth', 'glitch-fx'],
          ['808-bass', 'drill-hi-hats', 'punchy-kick', 'cyber-synth', 'static-noise'],
          ['sub-bass', 'fast-hi-hats', 'industrial-percussion', 'metallic-synth', 'impact-hit'],
        ],
      },
      {
        id: 'rec-cyber-synth-texture',
        label: 'Cyber Synth Texture',
        labelKo: '사이버 신스 질감',
        description: 'Cyber Synth Texture - 차갑고 디지털한 신스와 글리치 효과를 묶은 조합입니다. 사이버, 미래적, 긴장감 있는 곡에 어울립니다.',
        descriptionKo: 'Cyber Synth Texture - 차갑고 디지털한 신스와 글리치 효과를 묶은 조합입니다. 사이버, 미래적, 긴장감 있는 곡에 어울립니다.',
        promptCore: '',
        applyPools: [
          ['cyber-synth', 'dark-pad', 'metallic-percussion', 'glitch-fx', 'sub-bass'],
          ['cold-lead-synth', 'wide-pad', 'static-noise', 'mechanical-noise', 'punchy-kick'],
          ['fm-synth', 'digital-noise', 'dark-synth', 'impact-hit', 'deep-sub-bass'],
        ],
      },
      {
        id: 'rec-warm-live-band',
        label: 'Warm Live Band',
        labelKo: '따뜻한 라이브 밴드',
        description: 'Warm Live Band - 기타, 베이스, 드럼, 건반이 자연스럽게 섞이는 밴드 조합입니다. 팝, 포크, 시티팝, R&B에 잘 어울립니다.',
        descriptionKo: 'Warm Live Band - 기타, 베이스, 드럼, 건반이 자연스럽게 섞이는 밴드 조합입니다. 팝, 포크, 시티팝, R&B에 잘 어울립니다.',
        promptCore: '',
        applyPools: [
          ['clean-electric-guitar', 'electric-bass', 'live-drums', 'rhodes-keys', 'warm-pad'],
          ['acoustic-guitar', 'fretless-bass', 'brush-drums', 'upright-piano', 'room-reverb'],
          ['funk-guitar', 'smooth-bass', 'soft-drums', 'electric-piano', 'analog-warmth'],
        ],
      },
      {
        id: 'rec-korean-instrument-color',
        label: 'Korean Instrument Color',
        labelKo: '전통악기 질감',
        description: 'Korean Instrument Color - 한국 전통악기의 선율과 리듬을 중심으로 한 조합입니다. 국악 팝, 사극풍, 퓨전 계열에 어울립니다.',
        descriptionKo: 'Korean Instrument Color - 한국 전통악기의 선율과 리듬을 중심으로 한 조합입니다. 국악 팝, 사극풍, 퓨전 계열에 어울립니다.',
        promptCore: '',
        applyPools: [
          ['gayageum', 'haegeum', 'janggu', 'room-reverb', 'warm-pad'],
          ['daegeum', 'haegeum', 'buk', 'strings', 'cathedral-reverb'],
          ['geomungo', 'gayageum', 'janggu', 'deep-sub-bass', 'dark-pad'],
        ],
      },
      {
        id: 'rec-magic-texture-fx',
        label: 'Magic Texture FX',
        labelKo: '마법 질감 효과',
        description: 'Magic Texture FX - 반짝이는 효과음, 벨, 패드가 섞인 환상적인 조합입니다. 몽환, 판타지, 귀여운 곡에 잘 어울립니다.',
        descriptionKo: 'Magic Texture FX - 반짝이는 효과음, 벨, 패드가 섞인 환상적인 조합입니다. 몽환, 판타지, 귀여운 곡에 잘 어울립니다.',
        promptCore: '',
        applyPools: [
          ['bell-synth', 'celesta', 'magic-sparkle-fx', 'wide-pad', 'dream-reverb'],
          ['music-box', 'shimmer-fx', 'vocal-pad', 'soft-pluck-synth', 'room-reverb'],
          ['choir-pad', 'reverse-fx', 'magic-sparkle-fx', 'warm-pad', 'deep-sub-bass'],
        ],
      },
      {
        id: 'rec-cinematic-strings',
        label: 'Cinematic Strings',
        labelKo: '시네마틱 현악',
        description: 'Cinematic Strings - 현악과 타격감을 중심으로 감정선과 스케일을 키우는 조합입니다. 웅장함, 긴장감, 서사적인 곡에 어울립니다.',
        descriptionKo: 'Cinematic Strings - 현악과 타격감을 중심으로 감정선과 스케일을 키우는 조합입니다. 웅장함, 긴장감, 서사적인 곡에 어울립니다.',
        promptCore: '',
        applyPools: [
          ['cinematic-strings', 'cello', 'timpani', 'cinematic-hit', 'choir-pad'],
          ['staccato-strings', 'french-horn', 'orchestral-percussion', 'impact-hit', 'cathedral-reverb'],
          ['solo-violin', 'deep-cello', 'trailer-rise', 'timpani', 'wide-reverb'],
        ],
      }
    ],
  },

  {
    // SORIDRAW_SOUND_DRUM_DETAIL_EXPAND_V18: 드럼 메뉴에 킥/스네어/하이햇/드럼 연주 방식 추가 및 설명 형식 통일
    id: 'rhythm-instruments',
    title: 'Drums',
    titleKo: '드럼',
    variants: [
      { id: 'separator-kick', kind: 'separator', label: '킥', labelKo: '킥', description: '', descriptionKo: '', promptCore: '' },
      { id: 'soft-kick', label: 'Soft Kick', labelKo: '소프트 킥', description: 'soft kick - 부드럽고 약하게 깔리는 킥드럼입니다. (Lo-fi, Ballad, R&B, Chillhop)', descriptionKo: 'soft kick - 부드럽고 약하게 깔리는 킥드럼입니다. (Lo-fi, Ballad, R&B, Chillhop)', promptCore: 'soft kick' },
      { id: 'punchy-kick', label: 'Punchy Kick', labelKo: '단단한 킥', description: 'punchy kick - 짧고 탄력 있게 앞으로 나오는 킥드럼입니다. (K-Pop, Funk, City Pop, Pop Rock)', descriptionKo: 'punchy kick - 짧고 탄력 있게 앞으로 나오는 킥드럼입니다. (K-Pop, Funk, City Pop, Pop Rock)', promptCore: 'punchy kick' },
      { id: 'heavy-kick', label: 'Heavy Kick', labelKo: '묵직한 킥', description: 'heavy kick - 낮고 강하게 찍히는 킥드럼입니다. (Trap, Hip-hop, EDM, Rock)', descriptionKo: 'heavy kick - 낮고 강하게 찍히는 킥드럼입니다. (Trap, Hip-hop, EDM, Rock)', promptCore: 'heavy kick' },
      { id: 'four-on-the-floor-kick', label: 'Four-on-the-floor Kick', labelKo: '4비트 킥', description: 'four-on-the-floor kick - 일정하게 쿵쿵 밟는 클럽형 킥입니다. (House, Disco, Nu-Disco, EDM)', descriptionKo: 'four-on-the-floor kick - 일정하게 쿵쿵 밟는 클럽형 킥입니다. (House, Disco, Nu-Disco, EDM)', promptCore: 'four-on-the-floor kick' },
      { id: 'double-kick', label: 'Double Kick', labelKo: '더블 킥', description: 'double kick - 빠르게 두 번 몰아치는 공격적인 킥입니다. (Rock, Punk Rock, Metal, Anime Rock)', descriptionKo: 'double kick - 빠르게 두 번 몰아치는 공격적인 킥입니다. (Rock, Punk Rock, Metal, Anime Rock)', promptCore: 'double kick' },
      { id: 'kick-roll', label: 'Kick Roll', labelKo: '킥 롤', description: 'kick roll - 점점 촘촘해지며 올라가는 전개용 킥입니다. (EDM, Future Bass, Drop, Build-up)', descriptionKo: 'kick roll - 점점 촘촘해지며 올라가는 전개용 킥입니다. (EDM, Future Bass, Drop, Build-up)', promptCore: 'kick roll' },
      { id: 'separator-snare', kind: 'separator', label: '스네어', labelKo: '스네어', description: '', descriptionKo: '', promptCore: '' },
      { id: 'soft-snare', label: 'Soft Snare', labelKo: '소프트 스네어', description: 'soft snare - 부드럽고 약하게 찍히는 스네어입니다. (Ballad, R&B, Lo-fi, Acoustic Pop)', descriptionKo: 'soft snare - 부드럽고 약하게 찍히는 스네어입니다. (Ballad, R&B, Lo-fi, Acoustic Pop)', promptCore: 'soft snare' },
      { id: 'tight-snare', label: 'Tight Snare', labelKo: '타이트 스네어', description: 'tight snare - 짧고 또렷하게 박히는 스네어입니다. (K-Pop, Pop, Funk, Hip-hop)', descriptionKo: 'tight snare - 짧고 또렷하게 박히는 스네어입니다. (K-Pop, Pop, Funk, Hip-hop)', promptCore: 'tight snare' },
      { id: 'hard-snare', label: 'Hard Snare', labelKo: '하드 스네어', description: 'hard snare - 강하고 공격적으로 치고 나오는 스네어입니다. (Trap, Drill, Rock, Punk)', descriptionKo: 'hard snare - 강하고 공격적으로 치고 나오는 스네어입니다. (Trap, Drill, Rock, Punk)', promptCore: 'hard snare' },
      { id: 'reverb-snare', label: 'Reverb Snare', labelKo: '리버브 스네어', description: 'reverb snare - 넓게 울리며 공간감을 만드는 스네어입니다. (80s Pop, Synthwave, Ballad, Cinematic Pop)', descriptionKo: 'reverb snare - 넓게 울리며 공간감을 만드는 스네어입니다. (80s Pop, Synthwave, Ballad, Cinematic Pop)', promptCore: 'reverb snare' },
      { id: 'snare-roll', label: 'Snare Roll', labelKo: '스네어 롤', description: 'snare roll - 두두두두 올라가며 긴장감을 만드는 스네어입니다. (EDM, Build-up, Trailer, Marching)', descriptionKo: 'snare roll - 두두두두 올라가며 긴장감을 만드는 스네어입니다. (EDM, Build-up, Trailer, Marching)', promptCore: 'snare roll' },
      { id: 'rimshot', label: 'Rimshot', labelKo: '림샷', description: 'rimshot - 딱딱하고 선명하게 튀는 스네어 타격입니다. (Jazz, Funk, City Pop, Acoustic Pop)', descriptionKo: 'rimshot - 딱딱하고 선명하게 튀는 스네어 타격입니다. (Jazz, Funk, City Pop, Acoustic Pop)', promptCore: 'rimshot' },
      { id: 'separator-hihat', kind: 'separator', label: '하이햇', labelKo: '하이햇', description: '', descriptionKo: '', promptCore: '' },
      { id: 'soft-hi-hats', label: 'Soft Hi-hats', labelKo: '소프트 하이햇', description: 'soft hi-hats - 가볍고 부드럽게 깔리는 하이햇입니다. (Lo-fi, R&B, Chillhop, Ballad)', descriptionKo: 'soft hi-hats - 가볍고 부드럽게 깔리는 하이햇입니다. (Lo-fi, R&B, Chillhop, Ballad)', promptCore: 'soft hi-hats' },
      { id: 'closed-hi-hats', label: 'Closed Hi-hats', labelKo: '클로즈드 하이햇', description: 'closed hi-hats - 짧고 닫힌 칫칫 리듬의 하이햇입니다. (Pop, Funk, City Pop, Disco)', descriptionKo: 'closed hi-hats - 짧고 닫힌 칫칫 리듬의 하이햇입니다. (Pop, Funk, City Pop, Disco)', promptCore: 'closed hi-hats' },
      { id: 'open-hi-hats', label: 'Open Hi-hats', labelKo: '오픈 하이햇', description: 'open hi-hats - 시원하게 열리며 퍼지는 하이햇입니다. (House, Disco, EDM, Dance Pop)', descriptionKo: 'open hi-hats - 시원하게 열리며 퍼지는 하이햇입니다. (House, Disco, EDM, Dance Pop)', promptCore: 'open hi-hats' },
      { id: 'fast-hi-hats', label: 'Fast Hi-hats', labelKo: '빠른 하이햇', description: 'fast hi-hats - 촘촘하게 쪼개지며 속도감을 주는 하이햇입니다. (Trap, Hip-hop, Drill, Jersey Club)', descriptionKo: 'fast hi-hats - 촘촘하게 쪼개지며 속도감을 주는 하이햇입니다. (Trap, Hip-hop, Drill, Jersey Club)', promptCore: 'fast hi-hats' },
      { id: 'trap-hi-hats', label: 'Trap Hi-hats', labelKo: '트랩 하이햇', description: 'trap hi-hats - 트랩 특유의 잘게 굴러가는 하이햇입니다. (Trap, Cloud Rap, Melodic Rap)', descriptionKo: 'trap hi-hats - 트랩 특유의 잘게 굴러가는 하이햇입니다. (Trap, Cloud Rap, Melodic Rap)', promptCore: 'trap hi-hats' },
      { id: 'drill-hi-hats', label: 'Drill Hi-hats', labelKo: '드릴 하이햇', description: 'drill hi-hats - 미끄러지고 비틀리는 빠른 하이햇입니다. (Drill, UK Drill, Dark Trap)', descriptionKo: 'drill hi-hats - 미끄러지고 비틀리는 빠른 하이햇입니다. (Drill, UK Drill, Dark Trap)', promptCore: 'drill hi-hats' },
      { id: 'split-hihat', label: 'Chopped Hi-hats', labelKo: '쪼개는 하이햇', description: 'chopped hi-hats - 잘게 쪼개지며 긴장감을 만드는 하이햇입니다. (Trap, Drill, Hyperpop, Jersey Club)', descriptionKo: 'chopped hi-hats - 잘게 쪼개지며 긴장감을 만드는 하이햇입니다. (Trap, Drill, Hyperpop, Jersey Club)', promptCore: 'chopped hi-hats' },
      { id: 'separator-drum-pattern', kind: 'separator', label: '드럼 연주방식', labelKo: '드럼 연주방식', description: '', descriptionKo: '', promptCore: '' },
      { id: 'basic-drums', label: 'Basic Drums', labelKo: '기본 드럼', description: 'basic drums - 킥, 스네어, 하이햇 중심의 기본 드럼 리듬입니다. (Pop, K-Pop, Rock, Ballad)', descriptionKo: 'basic drums - 킥, 스네어, 하이햇 중심의 기본 드럼 리듬입니다. (Pop, K-Pop, Rock, Ballad)', promptCore: 'basic drums' },
      { id: 'soft-drums', label: 'Soft Drums', labelKo: '소프트 드럼', description: 'soft drums - 과하지 않고 부드럽게 받쳐주는 드럼입니다. (Ballad, Lo-fi, R&B, Acoustic Pop)', descriptionKo: 'soft drums - 과하지 않고 부드럽게 받쳐주는 드럼입니다. (Ballad, Lo-fi, R&B, Acoustic Pop)', promptCore: 'soft drums' },
      { id: 'brush-drums', label: 'Brush Drums', labelKo: '브러시 드럼', description: 'brush drums - 부드럽게 쓸리는 브러시 드럼 질감입니다. (Jazz, Ballad, Acoustic, Bossa Nova)', descriptionKo: 'brush drums - 부드럽게 쓸리는 브러시 드럼 질감입니다. (Jazz, Ballad, Acoustic, Bossa Nova)', promptCore: 'brush drums' },
      { id: 'live-drums', label: 'Live Drums', labelKo: '라이브 드럼', description: 'live drums - 실제 사람이 연주하는 듯한 자연스러운 드럼입니다. (Rock, Band, Funk, City Pop)', descriptionKo: 'live drums - 실제 사람이 연주하는 듯한 자연스러운 드럼입니다. (Rock, Band, Funk, City Pop)', promptCore: 'live drums' },
      { id: 'double-drums', label: 'Double Drums', labelKo: '더블 드럼', description: 'double drums - 드럼을 겹쳐 더 풍성하고 강한 리듬감을 만듭니다. (Rock, Punk Rock, EDM, Cinematic)', descriptionKo: 'double drums - 드럼을 겹쳐 더 풍성하고 강한 리듬감을 만듭니다. (Rock, Punk Rock, EDM, Cinematic)', promptCore: 'double drums' },
      { id: 'half-time-drums', label: 'Half-time Drums', labelKo: '하프타임 드럼', description: 'half-time drums - 실제 템포보다 느리게 느껴지는 묵직한 드럼 패턴입니다. (Trap, Rock Breakdown, EDM Drop, Future Bass)', descriptionKo: 'half-time drums - 실제 템포보다 느리게 느껴지는 묵직한 드럼 패턴입니다. (Trap, Rock Breakdown, EDM Drop, Future Bass)', promptCore: 'half-time drums' },
      { id: 'driving-drums', label: 'Driving Drums', labelKo: '드라이브 드럼', description: 'driving drums - 곡을 앞으로 밀어주는 추진력 있는 드럼입니다. (Rock, Pop Rock, Anime Rock, K-Band)', descriptionKo: 'driving drums - 곡을 앞으로 밀어주는 추진력 있는 드럼입니다. (Rock, Pop Rock, Anime Rock, K-Band)', promptCore: 'driving drums' },
      { id: 'breakbeat', label: 'Breakbeat', labelKo: '브레이크비트', description: 'breakbeat drums - 잘게 쪼개진 드럼 브레이크 리듬입니다. (Hip-hop, Drum & Bass, Breakbeat, UK Garage)', descriptionKo: 'breakbeat drums - 잘게 쪼개진 드럼 브레이크 리듬입니다. (Hip-hop, Drum & Bass, Breakbeat, UK Garage)', promptCore: 'breakbeat drums' },
      { id: 'shuffle-drums', label: 'Shuffle Drums', labelKo: '셔플 드럼', description: 'shuffle drums - 구르는 듯한 셔플 리듬의 드럼입니다. (Blues, Swing, Jazz, Funk)', descriptionKo: 'shuffle drums - 구르는 듯한 셔플 리듬의 드럼입니다. (Blues, Swing, Jazz, Funk)', promptCore: 'shuffle drums' },
      { id: 'swing-drums', label: 'Swing Drums', labelKo: '스윙 드럼', description: 'swing drums - 밀고 당기는 재즈식 리듬의 드럼입니다. (Jazz, Swing, Big Band, Jazzy Hip-hop)', descriptionKo: 'swing drums - 밀고 당기는 재즈식 리듬의 드럼입니다. (Jazz, Swing, Big Band, Jazzy Hip-hop)', promptCore: 'swing drums' },
      { id: 'funk-drums', label: 'Funk Drums', labelKo: '펑크 드럼', description: 'funk drums - 타이트하고 그루비한 펑크 리듬의 드럼입니다. (Funk, City Pop, Disco, R&B)', descriptionKo: 'funk drums - 타이트하고 그루비한 펑크 리듬의 드럼입니다. (Funk, City Pop, Disco, R&B)', promptCore: 'funk drums' },
      { id: 'disco-drums', label: 'Disco Drums', labelKo: '디스코 드럼', description: 'disco drums - 4비트 킥과 경쾌한 하이햇 중심의 디스코 드럼입니다. (Disco, Nu-Disco, City Pop)', descriptionKo: 'disco drums - 4비트 킥과 경쾌한 하이햇 중심의 디스코 드럼입니다. (Disco, Nu-Disco, City Pop)', promptCore: 'disco drums' },
      { id: 'house-drums', label: 'House Drums', labelKo: '하우스 드럼', description: 'house drums - 일정한 4비트 킥이 중심인 클럽형 드럼입니다. (House, Deep House, Soulful House, EDM)', descriptionKo: 'house drums - 일정한 4비트 킥이 중심인 클럽형 드럼입니다. (House, Deep House, Soulful House, EDM)', promptCore: 'house drums' },
      { id: 'boom-bap-drums', label: 'Boom Bap Drums', labelKo: '붐뱁 드럼', description: 'boom bap drums - 클래식 힙합 특유의 킥과 스네어 중심 드럼입니다. (Boom Bap, Old-school Hip-hop, Jazzy Hip-hop)', descriptionKo: 'boom bap drums - 클래식 힙합 특유의 킥과 스네어 중심 드럼입니다. (Boom Bap, Old-school Hip-hop, Jazzy Hip-hop)', promptCore: 'boom bap drums' },
      { id: 'trap-drums', label: 'Trap Drums', labelKo: '트랩 드럼', description: 'trap drums - 808, 스네어, 촘촘한 하이햇이 중심인 트랩 드럼입니다. (Trap, Cloud Rap, Melodic Rap)', descriptionKo: 'trap drums - 808, 스네어, 촘촘한 하이햇이 중심인 트랩 드럼입니다. (Trap, Cloud Rap, Melodic Rap)', promptCore: 'trap drums' },
      { id: 'drill-drums', label: 'Drill Drums', labelKo: '드릴 드럼', description: 'drill drums - 어둡고 미끄러지는 저역과 빠른 하이햇이 있는 드릴 드럼입니다. (Drill, UK Drill, Dark Trap)', descriptionKo: 'drill drums - 어둡고 미끄러지는 저역과 빠른 하이햇이 있는 드릴 드럼입니다. (Drill, UK Drill, Dark Trap)', promptCore: 'drill drums' },
      { id: 'rock-drums', label: 'Rock Drums', labelKo: '록 드럼', description: 'rock drums - 강한 킥과 스네어가 중심인 밴드형 드럼입니다. (Rock, Pop Rock, K-Band)', descriptionKo: 'rock drums - 강한 킥과 스네어가 중심인 밴드형 드럼입니다. (Rock, Pop Rock, K-Band)', promptCore: 'rock drums' },
      { id: 'punk-rock-drums', label: 'Punk Rock Drums', labelKo: '펑크록 드럼', description: 'punk rock drums - 빠르고 직선적으로 몰아치는 록 드럼입니다. (Punk Rock, Pop Punk, Anime Rock)', descriptionKo: 'punk rock drums - 빠르고 직선적으로 몰아치는 록 드럼입니다. (Punk Rock, Pop Punk, Anime Rock)', promptCore: 'punk rock drums' },
      { id: 'build-up-drums', label: 'Build-up Drums', labelKo: '빌드업 드럼', description: 'build-up drums - 점점 고조되며 후렴이나 드롭으로 밀어 올리는 드럼입니다. (EDM, Future Bass, Trailer, K-Pop)', descriptionKo: 'build-up drums - 점점 고조되며 후렴이나 드롭으로 밀어 올리는 드럼입니다. (EDM, Future Bass, Trailer, K-Pop)', promptCore: 'build-up drums' },
      { id: 'drop-drums', label: 'Drop Drums', labelKo: '드롭 드럼', description: 'drop drums - 드롭 구간에서 강하게 터지는 드럼입니다. (EDM, Trap, Future Bass, Hyperpop)', descriptionKo: 'drop drums - 드롭 구간에서 강하게 터지는 드럼입니다. (EDM, Trap, Future Bass, Hyperpop)', promptCore: 'drop drums' },
      { id: 'breakdown-drums', label: 'Breakdown Drums', labelKo: '브레이크다운 드럼', description: 'breakdown drums - 곡 중간에 힘을 빼거나 무겁게 떨어뜨리는 드럼입니다. (Rock, Metal, Trap, EDM Drop)', descriptionKo: 'breakdown drums - 곡 중간에 힘을 빼거나 무겁게 떨어뜨리는 드럼입니다. (Rock, Metal, Trap, EDM Drop)', promptCore: 'breakdown drums' },
      { id: 'minimal-drums', label: 'Minimal Drums', labelKo: '미니멀 드럼', description: 'minimal drums - 필요한 타격만 남긴 절제된 드럼입니다. (Minimal Pop, R&B, Lo-fi, Ambient Pop)', descriptionKo: 'minimal drums - 필요한 타격만 남긴 절제된 드럼입니다. (Minimal Pop, R&B, Lo-fi, Ambient Pop)', promptCore: 'minimal drums' },
      { id: 'heavy-drums', label: 'Heavy Drums', labelKo: '헤비 드럼', description: 'heavy drums - 강하고 묵직한 타격감의 드럼입니다. (Rock, Trap, EDM, Cinematic)', descriptionKo: 'heavy drums - 강하고 묵직한 타격감의 드럼입니다. (Rock, Trap, EDM, Cinematic)', promptCore: 'heavy drums' },
      { id: 'separator-percussion-hit', kind: 'separator', label: '타격음', labelKo: '타격음', description: '', descriptionKo: '', promptCore: '' },
      { id: 'industrial-percussion', label: 'Industrial Percussion', labelKo: '인더스트리얼 타격', description: 'industrial percussion - 금속성 있고 거친 타격음입니다. (Industrial, Cyberpunk, Dark EDM, Trailer)', descriptionKo: 'industrial percussion - 금속성 있고 거친 타격음입니다. (Industrial, Cyberpunk, Dark EDM, Trailer)', promptCore: 'industrial percussion' },
      { id: 'metallic-percussion', label: 'Metallic Percussion', labelKo: '금속 타격음', description: 'metallic percussion - 쇠붙이처럼 차갑고 날카로운 타격음입니다. (Cyberpunk, Industrial, Trailer, Dark Pop)', descriptionKo: 'metallic percussion - 쇠붙이처럼 차갑고 날카로운 타격음입니다. (Cyberpunk, Industrial, Trailer, Dark Pop)', promptCore: 'metallic percussion' },
    ],
  },
  {
    id: 'bass-instruments',
    title: 'Bass',
    titleKo: '베이스',
    variants: [
      { id: 'separator-bass-basic', kind: 'separator', label: '베이스 종류', labelKo: '베이스 종류', description: '', descriptionKo: '', promptCore: '' },
      { id: 'smooth-bass', label: 'Smooth Bass', labelKo: '스무스 베이스', description: 'smooth bass - 둥글고 부드러운 베이스입니다. (R&B, City Pop, Chillhop)', descriptionKo: 'smooth bass - 둥글고 부드러운 베이스입니다. (R&B, City Pop, Chillhop)', promptCore: 'smooth bass' },
      { id: 'fretless-bass', label: 'Fretless Bass', labelKo: '프렛리스 베이스', description: 'fretless bass - 미끄러지는 듯한 부드러운 베이스입니다. (City Pop, Jazz Pop, R&B)', descriptionKo: 'fretless bass - 미끄러지는 듯한 부드러운 베이스입니다. (City Pop, Jazz Pop, R&B)', promptCore: 'fretless bass' },
      { id: 'electric-bass', label: 'Electric Bass', labelKo: '일렉 베이스', description: 'electric bass - 밴드 사운드의 중심을 잡는 기본 베이스입니다. (Rock, Band, Funk, Pop)', descriptionKo: 'electric bass - 밴드 사운드의 중심을 잡는 기본 베이스입니다. (Rock, Band, Funk, Pop)', promptCore: 'electric bass' },
      { id: 'synth-bass', label: 'Synth Bass', labelKo: '신스 베이스', description: 'synth bass - 전자적으로 만든 선명한 베이스입니다. (Synth-pop, EDM, K-Pop)', descriptionKo: 'synth bass - 전자적으로 만든 선명한 베이스입니다. (Synth-pop, EDM, K-Pop)', promptCore: 'synth bass' },
      { id: 'separator-bass-play', kind: 'separator', label: '연주방식', labelKo: '연주방식', description: '', descriptionKo: '', promptCore: '' },
      { id: 'walking-bass', label: 'Walking Bass', labelKo: '워킹 베이스', description: 'walking bass - 걸어가듯 음이 움직이는 베이스 라인입니다. (Jazz, Swing, Blues)', descriptionKo: 'walking bass - 걸어가듯 음이 움직이는 베이스 라인입니다. (Jazz, Swing, Blues)', promptCore: 'walking bass' },
      { id: 'slap-bass', label: 'Slap Bass', labelKo: '슬랩 베이스', description: 'slap bass - 튀기듯 치는 탄력 있는 베이스입니다. (Funk, City Pop, Disco)', descriptionKo: 'slap bass - 튀기듯 치는 탄력 있는 베이스입니다. (Funk, City Pop, Disco)', promptCore: 'slap bass' },
      { id: 'funk-bass', label: 'Funk Bass', labelKo: '펑키 베이스', description: 'funk bass - 탄력 있고 리듬감 있는 베이스입니다. (Funk, R&B, City Pop)', descriptionKo: 'funk bass - 탄력 있고 리듬감 있는 베이스입니다. (Funk, R&B, City Pop)', promptCore: 'funk bass' },
      { id: 'separator-bass-low', kind: 'separator', label: '저역/808', labelKo: '저역/808', description: '', descriptionKo: '', promptCore: '' },
      { id: '808-bass', label: '808 Bass', labelKo: '808 베이스', description: '808 bass - 낮고 길게 이어지는 808 베이스입니다. (Trap, Hip-hop, Drill)', descriptionKo: '808 bass - 낮고 길게 이어지는 808 베이스입니다. (Trap, Hip-hop, Drill)', promptCore: '808 bass' },
      { id: 'heavy-808', label: 'Heavy 808', labelKo: '묵직한 808', description: 'heavy 808 - 깊고 강한 저음 압력을 주는 808입니다. (Trap, Drill, Dark Pop)', descriptionKo: 'heavy 808 - 깊고 강한 저음 압력을 주는 808입니다. (Trap, Drill, Dark Pop)', promptCore: 'heavy 808' },
      { id: 'sub-bass', label: 'Sub Bass', labelKo: '서브 베이스', description: 'sub bass - 곡 아래를 넓게 받쳐주는 낮은 저음입니다. (EDM, R&B, Ambient Pop)', descriptionKo: 'sub bass - 곡 아래를 넓게 받쳐주는 낮은 저음입니다. (EDM, R&B, Ambient Pop)', promptCore: 'sub bass' },
      { id: 'deep-sub-bass', label: 'Deep Sub Bass', labelKo: '딥 서브 베이스', description: 'deep sub bass - 더 깊게 깔리는 저역 베이스입니다. (Trap, EDM, Cinematic)', descriptionKo: 'deep sub bass - 더 깊게 깔리는 저역 베이스입니다. (Trap, EDM, Cinematic)', promptCore: 'deep sub bass' },
      { id: 'separator-bass-synth', kind: 'separator', label: '전자 베이스', labelKo: '전자 베이스', description: '', descriptionKo: '', promptCore: '' },
      { id: 'wobble-bass', label: 'Wobble Bass', labelKo: '워블 베이스', description: 'wobble bass - 흔들리는 전자 베이스입니다. (Dubstep, EDM, Drop)', descriptionKo: 'wobble bass - 흔들리는 전자 베이스입니다. (Dubstep, EDM, Drop)', promptCore: 'wobble bass' },
      { id: 'reese-bass', label: 'Reese Bass', labelKo: '리스 베이스', description: 'reese bass - 넓고 어두운 전자 베이스입니다. (Drum & Bass, Dubstep, Dark EDM)', descriptionKo: 'reese bass - 넓고 어두운 전자 베이스입니다. (Drum & Bass, Dubstep, Dark EDM)', promptCore: 'reese bass' },
      { id: 'growl-bass', label: 'Growl Bass', labelKo: '그라울 베이스', description: 'growl bass - 거칠게 울부짖는 듯한 베이스입니다. (Dubstep, EDM, Aggressive Pop)', descriptionKo: 'growl bass - 거칠게 울부짖는 듯한 베이스입니다. (Dubstep, EDM, Aggressive Pop)', promptCore: 'growl bass' },
      { id: 'low-end-beat', label: 'Low-end Beat', labelKo: '저음 중심 비트', description: 'low-end beat - 저음 움직임을 중심으로 하는 비트 질감입니다. (Hip-hop, Trap, Dark Pop)', descriptionKo: 'low-end beat - 저음 움직임을 중심으로 하는 비트 질감입니다. (Hip-hop, Trap, Dark Pop)', promptCore: 'low-end beat' },
    ],
  },
  {
    id: 'guitar-instruments',
    title: 'Guitar',
    titleKo: '기타',
    variants: [
      { id: 'separator-guitar-type', kind: 'separator', label: '기타 종류', labelKo: '기타 종류', description: '', descriptionKo: '', promptCore: '' },
      { id: 'nylon-guitar', label: 'Nylon Guitar', labelKo: '나일론 기타', description: 'nylon guitar - 부드럽고 따뜻한 나일론 현 기타입니다. (Ballad, Folk, Acoustic)', descriptionKo: 'nylon guitar - 부드럽고 따뜻한 나일론 현 기타입니다. (Ballad, Folk, Acoustic)', promptCore: 'nylon guitar' },
      { id: 'acoustic-guitar', label: 'Acoustic Guitar', labelKo: '어쿠스틱 기타', description: 'acoustic guitar - 자연스럽고 따뜻한 통기타입니다. (Acoustic Pop, Folk, K-Ballad)', descriptionKo: 'acoustic guitar - 자연스럽고 따뜻한 통기타입니다. (Acoustic Pop, Folk, K-Ballad)', promptCore: 'acoustic guitar' },
      { id: 'clean-electric-guitar', label: 'Clean Electric Guitar', labelKo: '클린 일렉 기타', description: 'clean guitar - 깨끗하고 선명한 전기 기타입니다. (City Pop, Funk, K-Pop, J-Pop)', descriptionKo: 'clean guitar - 깨끗하고 선명한 전기 기타입니다. (City Pop, Funk, K-Pop, J-Pop)', promptCore: 'clean guitar' },
      { id: 'distorted-guitar', label: 'Distorted Guitar', labelKo: '디스토션 기타', description: 'distorted guitar - 거칠고 강한 록 기타 질감입니다. (Rock, Punk Rock, Anime Rock)', descriptionKo: 'distorted guitar - 거칠고 강한 록 기타 질감입니다. (Rock, Punk Rock, Anime Rock)', promptCore: 'distorted guitar' },
      { id: 'separator-guitar-play', kind: 'separator', label: '연주방식', labelKo: '연주방식', description: '', descriptionKo: '', promptCore: '' },
      { id: 'acoustic-strum', label: 'Acoustic Strum', labelKo: '스트럼 기타', description: 'acoustic strum - 코드를 넓게 긁어 리듬을 만드는 기타입니다. (Acoustic Pop, Folk, Band, K-Ballad)', descriptionKo: 'acoustic strum - 코드를 넓게 긁어 리듬을 만드는 기타입니다. (Acoustic Pop, Folk, Band, K-Ballad)', promptCore: 'acoustic strum' },
      { id: 'guitar-arpeggio', label: 'Guitar Arpeggio', labelKo: '아르페지오 기타', description: 'guitar arpeggio - 코드를 한 음씩 풀어내는 섬세한 기타입니다. (Ballad, Indie Pop, Acoustic, City Pop)', descriptionKo: 'guitar arpeggio - 코드를 한 음씩 풀어내는 섬세한 기타입니다. (Ballad, Indie Pop, Acoustic, City Pop)', promptCore: 'guitar arpeggio' },
      { id: 'nylon-fingerstyle', label: 'Nylon Fingerstyle', labelKo: '핑거스타일 기타', description: 'nylon fingerstyle - 손가락으로 멜로디와 반주를 함께 만드는 기타입니다. (Acoustic, Folk, Ballad)', descriptionKo: 'nylon fingerstyle - 손가락으로 멜로디와 반주를 함께 만드는 기타입니다. (Acoustic, Folk, Ballad)', promptCore: 'nylon fingerstyle' },
      { id: 'palm-muted-guitar', label: 'Muted Guitar', labelKo: '뮤트 기타', description: 'muted guitar - 짧게 눌러 치는 타이트한 기타 리듬입니다. (Pop Rock, Punk Rock, Anime Rock)', descriptionKo: 'muted guitar - 짧게 눌러 치는 타이트한 기타 리듬입니다. (Pop Rock, Punk Rock, Anime Rock)', promptCore: 'muted guitar' },
      { id: 'clean-16th-guitar', label: 'Clean 16th Guitar', labelKo: '16비트 기타', description: 'clean 16th guitar - 촘촘하게 끊어치는 클린 기타 리듬입니다. (City Pop, Nu-Disco, Funk, J-Pop)', descriptionKo: 'clean 16th guitar - 촘촘하게 끊어치는 클린 기타 리듬입니다. (City Pop, Nu-Disco, Funk, J-Pop)', promptCore: 'clean 16th guitar' },
      { id: 'funk-guitar', label: 'Funk Guitar', labelKo: '펑키 기타', description: 'funk guitar - 짧고 탄력 있게 끊어치는 리듬 기타입니다. (Funk, City Pop, Disco, R&B)', descriptionKo: 'funk guitar - 짧고 탄력 있게 끊어치는 리듬 기타입니다. (Funk, City Pop, Disco, R&B)', promptCore: 'funk guitar' },
      { id: 'power-chords', label: 'Power Chords', labelKo: '파워 코드', description: 'power chords - 두껍고 직선적인 록 코드감입니다. (Rock, Punk Rock, Pop Punk, Anime Rock)', descriptionKo: 'power chords - 두껍고 직선적인 록 코드감입니다. (Rock, Punk Rock, Pop Punk, Anime Rock)', promptCore: 'power chords' },
      { id: 'distorted-riff', label: 'Distorted Riff', labelKo: '디스토션 리프', description: 'distorted riff - 거칠고 강한 왜곡 기타 리프입니다. (Rock, Hard Rock, Punk Rock)', descriptionKo: 'distorted riff - 거칠고 강한 왜곡 기타 리프입니다. (Rock, Hard Rock, Punk Rock)', promptCore: 'distorted riff' },
      { id: 'guitar-solo', label: 'Guitar Solo', labelKo: '기타 솔로', description: 'guitar solo - 연주 구간에서 기타가 멜로디를 이끄는 솔로입니다. (Rock, Ballad, Anime Rock)', descriptionKo: 'guitar solo - 연주 구간에서 기타가 멜로디를 이끄는 솔로입니다. (Rock, Ballad, Anime Rock)', promptCore: 'guitar solo' },
      { id: 'separator-guitar-tone', kind: 'separator', label: '톤/질감', labelKo: '톤/질감', description: '', descriptionKo: '', promptCore: '' },
      { id: 'citypop-guitar', label: 'City-pop Guitar', labelKo: '시티팝 기타', description: 'city-pop guitar - 시티팝에 어울리는 깔끔한 기타 리듬입니다. (City Pop, J-Pop, Funk)', descriptionKo: 'city-pop guitar - 시티팝에 어울리는 깔끔한 기타 리듬입니다. (City Pop, J-Pop, Funk)', promptCore: 'city-pop guitar' },
      { id: 'ambient-guitar', label: 'Ambient Guitar', labelKo: '앰비언트 기타', description: 'ambient guitar - 잔향이 넓게 퍼지는 공간감 있는 기타입니다. (Ambient Pop, Dream Pop, Post-Rock)', descriptionKo: 'ambient guitar - 잔향이 넓게 퍼지는 공간감 있는 기타입니다. (Ambient Pop, Dream Pop, Post-Rock)', promptCore: 'ambient guitar' },
      { id: 'shoegaze-guitar', label: 'Shoegaze Guitar', labelKo: '슈게이즈 기타', description: 'shoegaze wall - 두껍게 쌓이는 몽환적인 기타 벽입니다. (Shoegaze, Dream Pop, Indie Rock)', descriptionKo: 'shoegaze wall - 두껍게 쌓이는 몽환적인 기타 벽입니다. (Shoegaze, Dream Pop, Indie Rock)', promptCore: 'shoegaze wall' },
      { id: 'rough-guitar', label: 'Rough Guitar', labelKo: '거친 기타', description: 'rough guitar - 거칠고 강한 기타 톤입니다. (Rock, Garage Rock, Punk Rock)', descriptionKo: 'rough guitar - 거칠고 강한 기타 톤입니다. (Rock, Garage Rock, Punk Rock)', promptCore: 'rough guitar' },
      { id: 'warm-amp', label: 'Warm Amp Texture', labelKo: '따뜻한 앰프', description: 'warm amp - 앰프에서 나오는 따뜻한 기타 질감입니다. (Indie Rock, Blues, Soft Rock)', descriptionKo: 'warm amp - 앰프에서 나오는 따뜻한 기타 질감입니다. (Indie Rock, Blues, Soft Rock)', promptCore: 'warm amp' },
      { id: 'separator-guitar-role', kind: 'separator', label: '역할', labelKo: '역할', description: '', descriptionKo: '', promptCore: '' },
      { id: 'guitar-centered', label: 'Guitar-centered', labelKo: '기타 중심', description: 'guitar-centered - 기타가 곡의 중심을 잡는 밴드 질감입니다. (Band, Rock, Britpop, K-Band)', descriptionKo: 'guitar-centered - 기타가 곡의 중심을 잡는 밴드 질감입니다. (Band, Rock, Britpop, K-Band)', promptCore: 'guitar-centered' },
    ],
  },
  {
    id: 'keyboard-instruments',
    title: 'Keys',
    titleKo: '건반',
    variants: [
      { id: 'separator-piano-type', kind: 'separator', label: '피아노', labelKo: '피아노', description: '', descriptionKo: '', promptCore: '' },
      { id: 'felt-piano', label: 'Felt Piano', labelKo: '펠트 피아노', description: 'felt piano - 부드럽고 가까이 들리는 피아노입니다. (Ballad, Lo-fi, Indie Pop)', descriptionKo: 'felt piano - 부드럽고 가까이 들리는 피아노입니다. (Ballad, Lo-fi, Indie Pop)', promptCore: 'felt piano' },
      { id: 'upright-piano', label: 'Upright Piano', labelKo: '업라이트 피아노', description: 'upright piano - 소박하고 따뜻한 세로형 피아노입니다. (Ballad, Acoustic, Indie Pop)', descriptionKo: 'upright piano - 소박하고 따뜻한 세로형 피아노입니다. (Ballad, Acoustic, Indie Pop)', promptCore: 'upright piano' },
      { id: 'grand-piano', label: 'Grand Piano', labelKo: '그랜드 피아노', description: 'grand piano - 넓고 풍부한 정통 피아노입니다. (Ballad, Classical Pop, OST)', descriptionKo: 'grand piano - 넓고 풍부한 정통 피아노입니다. (Ballad, Classical Pop, OST)', promptCore: 'grand piano' },
      { id: 'live-piano', label: 'Live Piano', labelKo: '라이브 피아노', description: 'live piano - 실제 연주처럼 자연스러운 피아노입니다. (Band, Ballad, Jazz Pop)', descriptionKo: 'live piano - 실제 연주처럼 자연스러운 피아노입니다. (Band, Ballad, Jazz Pop)', promptCore: 'live piano' },
      { id: 'separator-piano-play', kind: 'separator', label: '연주방식', labelKo: '연주방식', description: '', descriptionKo: '', promptCore: '' },
      { id: 'piano-arpeggio', label: 'Piano Arpeggio', labelKo: '피아노 아르페지오', description: 'piano arpeggio - 코드를 한 음씩 풀어내는 피아노입니다. (Ballad, OST, Indie Pop)', descriptionKo: 'piano arpeggio - 코드를 한 음씩 풀어내는 피아노입니다. (Ballad, OST, Indie Pop)', promptCore: 'piano arpeggio' },
      { id: 'piano-chords', label: 'Piano Chords', labelKo: '피아노 코드', description: 'piano chords - 코드로 곡의 중심을 받치는 피아노입니다. (Pop, R&B, K-Ballad)', descriptionKo: 'piano chords - 코드로 곡의 중심을 받치는 피아노입니다. (Pop, R&B, K-Ballad)', promptCore: 'piano chords' },
      { id: 'improv-piano-solo', label: 'Improvised Piano Solo', labelKo: '즉흥 피아노 솔로', description: 'piano solo - 연주 구간에서 피아노가 자유롭게 이끄는 솔로입니다. (Jazz, Ballad, City Pop)', descriptionKo: 'piano solo - 연주 구간에서 피아노가 자유롭게 이끄는 솔로입니다. (Jazz, Ballad, City Pop)', promptCore: 'piano solo' },
      { id: 'jazz-piano-touch', label: 'Jazz Piano Touch', labelKo: '재즈 피아노 터치', description: 'jazz piano - 재즈 코드와 터치가 느껴지는 피아노입니다. (Jazz, R&B, City Pop)', descriptionKo: 'jazz piano - 재즈 코드와 터치가 느껴지는 피아노입니다. (Jazz, R&B, City Pop)', promptCore: 'jazz piano' },
      { id: 'rock-piano-energy', label: 'Rock Piano Energy', labelKo: '록 피아노 에너지', description: 'rock piano - 밴드 구간을 밀어주는 강한 피아노입니다. (Rock, Pop Rock, K-Band)', descriptionKo: 'rock piano - 밴드 구간을 밀어주는 강한 피아노입니다. (Rock, Pop Rock, K-Band)', promptCore: 'rock piano' },
      { id: 'separator-keys', kind: 'separator', label: '일렉 건반', labelKo: '일렉 건반', description: '', descriptionKo: '', promptCore: '' },
      { id: 'electric-piano', label: 'Electric Piano', labelKo: '일렉 피아노', description: 'electric piano - 부드럽고 전기적인 건반 질감입니다. (R&B, City Pop, Neo Soul)', descriptionKo: 'electric piano - 부드럽고 전기적인 건반 질감입니다. (R&B, City Pop, Neo Soul)', promptCore: 'electric piano' },
      { id: 'rhodes-keys', label: 'Rhodes Keys', labelKo: '로즈 건반', description: 'Rhodes keys - 따뜻하고 둥근 로즈 건반입니다. (Neo Soul, R&B, City Pop)', descriptionKo: 'Rhodes keys - 따뜻하고 둥근 로즈 건반입니다. (Neo Soul, R&B, City Pop)', promptCore: 'Rhodes keys' },
      { id: 'wurlitzer', label: 'Wurlitzer', labelKo: '월리처', description: 'Wurlitzer - 살짝 거친 빈티지 일렉 피아노입니다. (Soul, Rock, Retro Pop)', descriptionKo: 'Wurlitzer - 살짝 거친 빈티지 일렉 피아노입니다. (Soul, Rock, Retro Pop)', promptCore: 'Wurlitzer' },
      { id: 'organ', label: 'Organ', labelKo: '오르간', description: 'organ - 두껍고 복고적인 오르간 질감입니다. (Gospel, Rock, Soul)', descriptionKo: 'organ - 두껍고 복고적인 오르간 질감입니다. (Gospel, Rock, Soul)', promptCore: 'organ' },
      { id: 'separator-cute-keys', kind: 'separator', label: '특수 건반', labelKo: '특수 건반', description: '', descriptionKo: '', promptCore: '' },
      { id: 'celesta', label: 'Celesta', labelKo: '첼레스타', description: 'celesta - 맑고 반짝이는 작은 건반 소리입니다. (Fantasy Pop, OST, Cute Pop)', descriptionKo: 'celesta - 맑고 반짝이는 작은 건반 소리입니다. (Fantasy Pop, OST, Cute Pop)', promptCore: 'celesta' },
      { id: 'music-box', label: 'Music Box', labelKo: '오르골', description: 'music box - 동화적이고 작은 오르골 질감입니다. (Ballad, Fantasy, Lullaby)', descriptionKo: 'music box - 동화적이고 작은 오르골 질감입니다. (Ballad, Fantasy, Lullaby)', promptCore: 'music box' },
      { id: 'bell-synth', label: 'Bell Synth', labelKo: '벨 신스', description: 'bell synth - 맑게 울리는 벨 타입 신스입니다. (K-Pop, Future Bass, Fantasy Pop)', descriptionKo: 'bell synth - 맑게 울리는 벨 타입 신스입니다. (K-Pop, Future Bass, Fantasy Pop)', promptCore: 'bell synth' },
      { id: 'piano-band-session', label: 'Piano Band Session', labelKo: '피아노 밴드 세션', description: 'piano band session - 밴드 안에서 피아노가 리듬과 화성을 받치는 질감입니다. (K-Band, Pop Rock, City Pop)', descriptionKo: 'piano band session - 밴드 안에서 피아노가 리듬과 화성을 받치는 질감입니다. (K-Band, Pop Rock, City Pop)', promptCore: 'piano band session' },
    ],
  },
  {
    id: 'synth-instruments',
    title: 'Synth',
    titleKo: '신스',
    variants: [
      { id: 'separator-synth-pad', kind: 'separator', label: '패드', labelKo: '패드', description: '', descriptionKo: '', promptCore: '' },
      { id: 'warm-pad', label: 'Warm Pad', labelKo: '따뜻한 패드', description: 'warm pad - 부드럽게 공간을 채우는 패드입니다. (Ballad, Ambient Pop, R&B)', descriptionKo: 'warm pad - 부드럽게 공간을 채우는 패드입니다. (Ballad, Ambient Pop, R&B)', promptCore: 'warm pad' },
      { id: 'wide-pad', label: 'Wide Pad', labelKo: '넓은 패드', description: 'wide pad - 좌우로 넓게 펼쳐지는 패드입니다. (Dream Pop, Synth-pop, Cinematic)', descriptionKo: 'wide pad - 좌우로 넓게 펼쳐지는 패드입니다. (Dream Pop, Synth-pop, Cinematic)', promptCore: 'wide pad' },
      { id: 'dark-pad', label: 'Dark Pad', labelKo: '어두운 패드', description: 'dark pad - 공간을 어둡게 채우는 신스 패드입니다. (Dark Pop, Trap, Cinematic)', descriptionKo: 'dark pad - 공간을 어둡게 채우는 신스 패드입니다. (Dark Pop, Trap, Cinematic)', promptCore: 'dark pad' },
      { id: 'wide-synth-pad', label: 'Wide Synth Pad', labelKo: '공간감 있는 패드', description: 'wide synth pad - 넓은 공간감을 만드는 신스 패드입니다. (Synthwave, Ambient Pop, Dream Pop)', descriptionKo: 'wide synth pad - 넓은 공간감을 만드는 신스 패드입니다. (Synthwave, Ambient Pop, Dream Pop)', promptCore: 'wide synth pad' },
      { id: 'separator-synth-basic', kind: 'separator', label: '신스', labelKo: '신스', description: '', descriptionKo: '', promptCore: '' },
      { id: 'warm-analog-synth', label: 'Warm Analog Synth', labelKo: '따뜻한 아날로그 신스', description: 'warm analog synth - 따뜻한 빈티지 신스 질감입니다. (City Pop, Synth-pop, Retro Pop)', descriptionKo: 'warm analog synth - 따뜻한 빈티지 신스 질감입니다. (City Pop, Synth-pop, Retro Pop)', promptCore: 'warm analog synth' },
      { id: 'retro-synth', label: 'Retro Synth', labelKo: '레트로 신스', description: 'retro synth - 복고적인 전자 신스 질감입니다. (Synthwave, 80s Pop, Retro Electro)', descriptionKo: 'retro synth - 복고적인 전자 신스 질감입니다. (Synthwave, 80s Pop, Retro Electro)', promptCore: 'retro synth' },
      { id: 'fm-synth', label: 'FM Synth', labelKo: 'FM 신스', description: 'FM synth - 선명하고 유리 같은 디지털 신스입니다. (80s Pop, City Pop, Synth-pop)', descriptionKo: 'FM synth - 선명하고 유리 같은 디지털 신스입니다. (80s Pop, City Pop, Synth-pop)', promptCore: 'FM synth' },
      { id: 'dreamy-synth', label: 'Dreamy Synth', labelKo: '몽환 신스', description: 'dreamy synth - 흐릿하고 몽환적인 신스 질감입니다. (Dream Pop, Chillwave, Lo-fi Pop)', descriptionKo: 'dreamy synth - 흐릿하고 몽환적인 신스 질감입니다. (Dream Pop, Chillwave, Lo-fi Pop)', promptCore: 'dreamy synth' },
      { id: 'synth-brass', label: 'Synth Brass', labelKo: '신스 브라스', description: 'synth brass - 실제 브라스보다 선명하고 전자적인 관악기 느낌입니다. (80s Pop, City Pop, Funk, Idol Pop)', descriptionKo: 'synth brass - 실제 브라스보다 선명하고 전자적인 관악기 느낌입니다. (80s Pop, City Pop, Funk, Idol Pop)', promptCore: 'synth brass' },
      { id: 'brass-like-synth-stab', label: 'Brass-like Synth Stab', labelKo: '브라스형 신스 스탭', description: 'brass-like synth stab - 브라스처럼 짧고 강하게 찍는 전자 신스 포인트입니다. (Funk, Disco, K-Pop, Synthwave)', descriptionKo: 'brass-like synth stab - 브라스처럼 짧고 강하게 찍는 전자 신스 포인트입니다. (Funk, Disco, K-Pop, Synthwave)', promptCore: 'brass-like synth stab' },
      { id: 'synth-guitar', label: 'Synth Guitar', labelKo: '신스 기타', description: 'synth guitar - 일렉기타 같은 질감을 전자적으로 만든 신스 사운드입니다. (Synth Rock, EDM, Cyber Pop)', descriptionKo: 'synth guitar - 일렉기타 같은 질감을 전자적으로 만든 신스 사운드입니다. (Synth Rock, EDM, Cyber Pop)', promptCore: 'synth guitar' },
      { id: 'guitar-like-synth-lead', label: 'Guitar-like Synth Lead', labelKo: '기타형 신스 리드', description: 'guitar-like synth lead - 기타처럼 선율을 밀고 나가는 전자 리드 신스입니다. (Synth Rock, J-Rock Fusion, 80s Rock Pop)', descriptionKo: 'guitar-like synth lead - 기타처럼 선율을 밀고 나가는 전자 리드 신스입니다. (Synth Rock, J-Rock Fusion, 80s Rock Pop)', promptCore: 'guitar-like synth lead' },
      { id: 'separator-synth-play', kind: 'separator', label: '연주방식', labelKo: '연주방식', description: '', descriptionKo: '', promptCore: '' },
      { id: 'synth-arpeggio', label: 'Synth Arpeggio', labelKo: '신스 아르페지오', description: 'synth arpeggio - 반복적으로 굴러가는 신스 패턴입니다. (Synthwave, EDM, Future Bass)', descriptionKo: 'synth arpeggio - 반복적으로 굴러가는 신스 패턴입니다. (Synthwave, EDM, Future Bass)', promptCore: 'synth arpeggio' },
      { id: 'soft-pluck-synth', label: 'Soft Pluck Synth', labelKo: '부드러운 플럭', description: 'soft pluck - 짧고 부드럽게 튀는 플럭 신스입니다. (Future Bass, K-Pop, Chill Pop)', descriptionKo: 'soft pluck - 짧고 부드럽게 튀는 플럭 신스입니다. (Future Bass, K-Pop, Chill Pop)', promptCore: 'soft pluck' },
      { id: 'pluck-synth', label: 'Pluck Synth', labelKo: '플럭 신스', description: 'pluck synth - 짧게 튀며 리듬을 만드는 신스입니다. (EDM, Future Bass, Tropical House)', descriptionKo: 'pluck synth - 짧게 튀며 리듬을 만드는 신스입니다. (EDM, Future Bass, Tropical House)', promptCore: 'pluck synth' },
      { id: 'cold-lead-synth', label: 'Cold Lead Synth', labelKo: '차가운 리드 신스', description: 'cold lead - 차갑고 선명하게 앞에 나오는 리드 신스입니다. (EDM, Hyperpop, Cyber Pop)', descriptionKo: 'cold lead - 차갑고 선명하게 앞에 나오는 리드 신스입니다. (EDM, Hyperpop, Cyber Pop)', promptCore: 'cold lead' },
      { id: 'separator-synth-texture', kind: 'separator', label: '전자 질감', labelKo: '전자 질감', description: '', descriptionKo: '', promptCore: '' },
      { id: 'metallic-synth', label: 'Metallic Synth', labelKo: '금속성 신스', description: 'metallic synth - 차갑고 금속적인 신스 질감입니다. (Cyberpunk, Industrial, Dark EDM)', descriptionKo: 'metallic synth - 차갑고 금속적인 신스 질감입니다. (Cyberpunk, Industrial, Dark EDM)', promptCore: 'metallic synth' },
      { id: 'cyber-synth', label: 'Cyber Synth', labelKo: '사이버 신스', description: 'cyber synth - 디지털하고 미래적인 신스 질감입니다. (Cyberpunk, Hyperpop, Future Bass)', descriptionKo: 'cyber synth - 디지털하고 미래적인 신스 질감입니다. (Cyberpunk, Hyperpop, Future Bass)', promptCore: 'cyber synth' },
      { id: 'dark-synth', label: 'Dark Synth', labelKo: '어두운 신스', description: 'dark synth - 어둡고 긴장감 있는 신스입니다. (Dark Pop, Trap, Cinematic)', descriptionKo: 'dark synth - 어둡고 긴장감 있는 신스입니다. (Dark Pop, Trap, Cinematic)', promptCore: 'dark synth' },
      { id: 'neon-synth', label: 'Neon Synth', labelKo: '네온 신스', description: 'neon synth - 네온처럼 밝고 선명한 신스입니다. (Synthwave, City Pop, Retro Pop)', descriptionKo: 'neon synth - 네온처럼 밝고 선명한 신스입니다. (Synthwave, City Pop, Retro Pop)', promptCore: 'neon synth' },
      { id: 'sparkling-synth', label: 'Sparkling Synth', labelKo: '반짝이는 신스', description: 'sparkling synth - 밝게 반짝이는 신스 포인트입니다. (K-Pop, Future Bass, Y2K Pop)', descriptionKo: 'sparkling synth - 밝게 반짝이는 신스 포인트입니다. (K-Pop, Future Bass, Y2K Pop)', promptCore: 'sparkling synth' },
      { id: 'cold-synth', label: 'Cold Synth', labelKo: '차가운 신스', description: 'cold synth - 차갑고 건조한 전자 질감입니다. (Minimal Pop, Cyber Pop, Dark EDM)', descriptionKo: 'cold synth - 차갑고 건조한 전자 질감입니다. (Minimal Pop, Cyber Pop, Dark EDM)', promptCore: 'cold synth' },
      { id: 'dark-synth-layer', label: 'Dark Synth Layer', labelKo: '어두운 신스 레이어', description: 'dark synth layer - 어둡게 깔리는 신스 레이어입니다. (Dark Pop, Cinematic, Trap)', descriptionKo: 'dark synth layer - 어둡게 깔리는 신스 레이어입니다. (Dark Pop, Cinematic, Trap)', promptCore: 'dark synth layer' },
    ],
  },
  {
    id: 'string-instruments',
    title: 'Strings',
    titleKo: '현악',
    variants: [
      { id: 'separator-string-play', kind: 'separator', label: '연주방식', labelKo: '연주방식', description: '', descriptionKo: '', promptCore: '' },
      { id: 'pizzicato-strings', label: 'Pizzicato Strings', labelKo: '피치카토 스트링', description: 'pizzicato strings - 짧게 튕기는 현악 소리입니다. (Cute Pop, Classical Pop, OST)', descriptionKo: 'pizzicato strings - 짧게 튕기는 현악 소리입니다. (Cute Pop, Classical Pop, OST)', promptCore: 'pizzicato strings' },
      { id: 'staccato-strings', label: 'Staccato Strings', labelKo: '스타카토 스트링', description: 'staccato strings - 짧고 또렷하게 끊는 현악입니다. (Cinematic, Trailer, Tension)', descriptionKo: 'staccato strings - 짧고 또렷하게 끊는 현악입니다. (Cinematic, Trailer, Tension)', promptCore: 'staccato strings' },
      { id: 'legato-strings', label: 'Legato Strings', labelKo: '레가토 스트링', description: 'legato strings - 부드럽게 이어지는 현악입니다. (Ballad, OST, Cinematic)', descriptionKo: 'legato strings - 부드럽게 이어지는 현악입니다. (Ballad, OST, Cinematic)', promptCore: 'legato strings' },
      { id: 'tremolo-strings', label: 'Tremolo Strings', labelKo: '트레몰로 스트링', description: 'tremolo strings - 떨리듯 긴장감을 만드는 현악입니다. (Thriller, Cinematic, Trailer)', descriptionKo: 'tremolo strings - 떨리듯 긴장감을 만드는 현악입니다. (Thriller, Cinematic, Trailer)', promptCore: 'tremolo strings' },
      { id: 'separator-string-instrument', kind: 'separator', label: '현악기', labelKo: '현악기', description: '', descriptionKo: '', promptCore: '' },
      { id: 'strings', label: 'Strings', labelKo: '스트링', description: 'strings - 곡의 감정선을 넓게 받치는 현악입니다. (Ballad, OST, K-Pop)', descriptionKo: 'strings - 곡의 감정선을 넓게 받치는 현악입니다. (Ballad, OST, K-Pop)', promptCore: 'strings' },
      { id: 'solo-violin', label: 'Solo Violin', labelKo: '바이올린 솔로', description: 'solo violin - 선율을 앞에서 이끄는 바이올린입니다. (OST, Ballad, Classical Pop)', descriptionKo: 'solo violin - 선율을 앞에서 이끄는 바이올린입니다. (OST, Ballad, Classical Pop)', promptCore: 'solo violin' },
      { id: 'cello', label: 'Cello', labelKo: '첼로', description: 'cello - 낮고 따뜻한 첼로입니다. (Ballad, OST, Chamber Pop)', descriptionKo: 'cello - 낮고 따뜻한 첼로입니다. (Ballad, OST, Chamber Pop)', promptCore: 'cello' },
      { id: 'deep-cello', label: 'Deep Cello', labelKo: '딥 첼로', description: 'deep cello - 더 어둡고 깊게 깔리는 첼로입니다. (Cinematic, Dark Pop, OST)', descriptionKo: 'deep cello - 더 어둡고 깊게 깔리는 첼로입니다. (Cinematic, Dark Pop, OST)', promptCore: 'deep cello' },
      { id: 'cinematic-strings', label: 'Cinematic Strings', labelKo: '시네마틱 스트링', description: 'cinematic strings - 스케일을 키우는 영화적 현악입니다. (Cinematic, Trailer, Epic Pop)', descriptionKo: 'cinematic strings - 스케일을 키우는 영화적 현악입니다. (Cinematic, Trailer, Epic Pop)', promptCore: 'cinematic strings' },
    ],
  },
  {
    id: 'wind-instruments',
    title: 'Winds',
    titleKo: '관악',
    variants: [
      { id: 'separator-woodwind', kind: 'separator', label: '목관', labelKo: '목관', description: '', descriptionKo: '', promptCore: '' },
      { id: 'flute', label: 'Flute', labelKo: '플루트', description: 'flute - 맑고 가볍게 흐르는 목관 소리입니다. (Bossa Nova, Ballad, Fantasy Pop)', descriptionKo: 'flute - 맑고 가볍게 흐르는 목관 소리입니다. (Bossa Nova, Ballad, Fantasy Pop)', promptCore: 'flute' },
      { id: 'separator-brass-solo', kind: 'separator', label: '브라스 솔로', labelKo: '브라스 솔로', description: '', descriptionKo: '', promptCore: '' },
      { id: 'muted-trumpet', label: 'Muted Trumpet', labelKo: '뮤트 트럼펫', description: 'muted trumpet - 부드럽고 재지한 트럼펫입니다. (Jazz, City Pop, Lo-fi)', descriptionKo: 'muted trumpet - 부드럽고 재지한 트럼펫입니다. (Jazz, City Pop, Lo-fi)', promptCore: 'muted trumpet' },
      { id: 'trumpet', label: 'Trumpet', labelKo: '트럼펫', description: 'trumpet - 밝고 선명하게 튀는 금관 소리입니다. (Funk, Jazz, Latin Pop)', descriptionKo: 'trumpet - 밝고 선명하게 튀는 금관 소리입니다. (Funk, Jazz, Latin Pop)', promptCore: 'trumpet' },
      { id: 'saxophone', label: 'Saxophone', labelKo: '색소폰', description: 'saxophone - 부드럽고 감성적인 색소폰입니다. (City Pop, Jazz, R&B)', descriptionKo: 'saxophone - 부드럽고 감성적인 색소폰입니다. (City Pop, Jazz, R&B)', promptCore: 'saxophone' },
      { id: 'trombone', label: 'Trombone', labelKo: '트롬본', description: 'trombone - 두껍고 낮게 받치는 금관 소리입니다. (Funk, Big Band, Jazz)', descriptionKo: 'trombone - 두껍고 낮게 받치는 금관 소리입니다. (Funk, Big Band, Jazz)', promptCore: 'trombone' },
      { id: 'french-horn', label: 'French Horn', labelKo: '프렌치 호른', description: 'French horn - 웅장하고 둥근 금관 소리입니다. (Cinematic, OST, Epic Pop)', descriptionKo: 'French horn - 웅장하고 둥근 금관 소리입니다. (Cinematic, OST, Epic Pop)', promptCore: 'French horn' },
      { id: 'separator-brass-section', kind: 'separator', label: '브라스 섹션', labelKo: '브라스 섹션', description: '', descriptionKo: '', promptCore: '' },
      { id: 'brass', label: 'Brass', labelKo: '브라스', description: 'brass - 여러 금관이 함께 밀어주는 섹션 사운드입니다. (Funk, Soul, Big Band, K-Pop)', descriptionKo: 'brass - 여러 금관이 함께 밀어주는 섹션 사운드입니다. (Funk, Soul, Big Band, K-Pop)', promptCore: 'brass' },
      { id: 'brass-stabs', label: 'Brass Stabs', labelKo: '브라스 스탭', description: 'brass stabs - 짧게 치고 들어오는 브라스 포인트입니다. (Funk, Disco, K-Pop, Latin Pop)', descriptionKo: 'brass stabs - 짧게 치고 들어오는 브라스 포인트입니다. (Funk, Disco, K-Pop, Latin Pop)', promptCore: 'brass stabs' },
    ],
  },
  {
    id: 'percussion-instruments',
    title: 'Percussion',
    titleKo: '타악',
    variants: [
      { id: 'separator-hand-percussion', kind: 'separator', label: '핸드 퍼커션', labelKo: '핸드 퍼커션', description: '', descriptionKo: '', promptCore: '' },
      { id: 'cajon', label: 'Cajon', labelKo: '카혼', description: 'cajon - 나무 상자처럼 따뜻하게 울리는 타악기입니다. (Acoustic, Folk, Ballad)', descriptionKo: 'cajon - 나무 상자처럼 따뜻하게 울리는 타악기입니다. (Acoustic, Folk, Ballad)', promptCore: 'cajon' },
      { id: 'djembe', label: 'Djembe', labelKo: '젬베', description: 'djembe - 손으로 치는 아프리카계 타악기입니다. (Afrobeats, World Pop, Acoustic)', descriptionKo: 'djembe - 손으로 치는 아프리카계 타악기입니다. (Afrobeats, World Pop, Acoustic)', promptCore: 'djembe' },
      { id: 'latin-percussion', label: 'Latin Percussion', labelKo: '라틴 퍼커션', description: 'Latin percussion - 라틴 리듬을 만드는 타악 조합입니다. (Latin Pop, Reggaeton, Bossa Nova)', descriptionKo: 'Latin percussion - 라틴 리듬을 만드는 타악 조합입니다. (Latin Pop, Reggaeton, Bossa Nova)', promptCore: 'Latin percussion' },
      { id: 'separator-big-percussion', kind: 'separator', label: '대형 타악', labelKo: '대형 타악', description: '', descriptionKo: '', promptCore: '' },
      { id: 'taiko', label: 'Taiko', labelKo: '타이코', description: 'taiko - 크고 강하게 울리는 일본식 대형 북입니다. (Cinematic, J-Rock, Trailer)', descriptionKo: 'taiko - 크고 강하게 울리는 일본식 대형 북입니다. (Cinematic, J-Rock, Trailer)', promptCore: 'taiko' },
      { id: 'orchestral-percussion', label: 'Orchestral Percussion', labelKo: '오케스트라 타악', description: 'orchestral percussion - 오케스트라 스케일을 키우는 타악입니다. (Cinematic, OST, Trailer)', descriptionKo: 'orchestral percussion - 오케스트라 스케일을 키우는 타악입니다. (Cinematic, OST, Trailer)', promptCore: 'orchestral percussion' },
      { id: 'timpani', label: 'Timpani', labelKo: '팀파니', description: 'timpani - 웅장하게 저역을 울리는 오케스트라 북입니다. (Cinematic, Classical, Epic Pop)', descriptionKo: 'timpani - 웅장하게 저역을 울리는 오케스트라 북입니다. (Cinematic, Classical, Epic Pop)', promptCore: 'timpani' },
      { id: 'separator-impact', kind: 'separator', label: '히트/라이즈', labelKo: '히트/라이즈', description: '', descriptionKo: '', promptCore: '' },
      { id: 'cinematic-hit', label: 'Cinematic Hit', labelKo: '시네마틱 히트', description: 'cinematic hit - 장면 전환을 강하게 찍는 타격음입니다. (Trailer, Cinematic, EDM)', descriptionKo: 'cinematic hit - 장면 전환을 강하게 찍는 타격음입니다. (Trailer, Cinematic, EDM)', promptCore: 'cinematic hit' },
      { id: 'trailer-rise', label: 'Trailer Rise', labelKo: '트레일러 라이즈', description: 'trailer rise - 점점 올라가며 긴장감을 만드는 효과입니다. (Trailer, EDM Build-up, Cinematic)', descriptionKo: 'trailer rise - 점점 올라가며 긴장감을 만드는 효과입니다. (Trailer, EDM Build-up, Cinematic)', promptCore: 'trailer rise' },
    ],
  },
  {
    id: 'world-instruments',
    title: 'World',
    titleKo: '월드악기',
    variants: [
      { id: 'separator-korean-traditional-instruments', kind: 'separator', label: '한국 전통악기', labelKo: '한국 전통악기', description: '', descriptionKo: '', promptCore: '' },
      { id: 'gayageum', label: 'Gayageum', labelKo: '가야금', description: 'gayageum - 맑고 탄력 있는 한국 전통 현악기입니다. (Korean Fusion, Gugak Pop, OST)', descriptionKo: 'gayageum - 맑고 탄력 있는 한국 전통 현악기입니다. (Korean Fusion, Gugak Pop, OST)', promptCore: 'gayageum' },
      { id: 'geomungo', label: 'Geomungo', labelKo: '거문고', description: 'geomungo - 낮고 묵직한 한국 전통 현악기입니다. (Gugak Fusion, Dark OST, Historical)', descriptionKo: 'geomungo - 낮고 묵직한 한국 전통 현악기입니다. (Gugak Fusion, Dark OST, Historical)', promptCore: 'geomungo' },
      { id: 'haegeum', label: 'Haegeum', labelKo: '해금', description: 'haegeum - 애절하고 날카로운 한국 전통 선율 악기입니다. (Gugak Pop, Historical OST, Ballad)', descriptionKo: 'haegeum - 애절하고 날카로운 한국 전통 선율 악기입니다. (Gugak Pop, Historical OST, Ballad)', promptCore: 'haegeum' },
      { id: 'daegeum', label: 'Daegeum', labelKo: '대금', description: 'daegeum - 넓고 숨결이 강한 한국 전통 관악기입니다. (Gugak Pop, Historical OST, Ambient)', descriptionKo: 'daegeum - 넓고 숨결이 강한 한국 전통 관악기입니다. (Gugak Pop, Historical OST, Ambient)', promptCore: 'daegeum' },
      { id: 'piri', label: 'Piri', labelKo: '피리', description: 'piri - 가늘고 선명한 한국 전통 관악기입니다. (Gugak Fusion, Folk, OST)', descriptionKo: 'piri - 가늘고 선명한 한국 전통 관악기입니다. (Gugak Fusion, Folk, OST)', promptCore: 'piri' },
      { id: 'taepyeongso', label: 'Taepyeongso', labelKo: '태평소', description: 'taepyeongso - 크고 강한 한국 전통 관악기입니다. (Festival, Gugak Fusion, Trot Fusion)', descriptionKo: 'taepyeongso - 크고 강한 한국 전통 관악기입니다. (Festival, Gugak Fusion, Trot Fusion)', promptCore: 'taepyeongso' },
      { id: 'janggu', label: 'Janggu', labelKo: '장구', description: 'janggu - 장단을 만드는 한국 전통 타악기입니다. (Gugak Pop, Folk, Festival)', descriptionKo: 'janggu - 장단을 만드는 한국 전통 타악기입니다. (Gugak Pop, Folk, Festival)', promptCore: 'janggu' },
      { id: 'buk', label: 'Buk', labelKo: '북', description: 'buk - 굵고 단단한 한국 전통 북입니다. (Gugak Fusion, Historical, Cinematic)', descriptionKo: 'buk - 굵고 단단한 한국 전통 북입니다. (Gugak Fusion, Historical, Cinematic)', promptCore: 'buk' },
      { id: 'kkwaenggwari', label: 'Kkwaenggwari', labelKo: '꽹과리', description: 'kkwaenggwari - 날카롭고 밝게 치고 나오는 한국 전통 타악기입니다. (Samulnori, Festival, Gugak Fusion)', descriptionKo: 'kkwaenggwari - 날카롭고 밝게 치고 나오는 한국 전통 타악기입니다. (Samulnori, Festival, Gugak Fusion)', promptCore: 'kkwaenggwari' },
      { id: 'separator-world-pluck', kind: 'separator', label: '플럭/현악', labelKo: '플럭/현악', description: '', descriptionKo: '', promptCore: '' },
      { id: 'kalimba', label: 'Kalimba', labelKo: '칼림바', description: 'kalimba - 맑고 작은 금속 플럭 소리입니다. (Lo-fi, Cute Pop, Fantasy)', descriptionKo: 'kalimba - 맑고 작은 금속 플럭 소리입니다. (Lo-fi, Cute Pop, Fantasy)', promptCore: 'kalimba' },
      { id: 'sitar', label: 'Sitar', labelKo: '시타르', description: 'sitar - 인도풍의 길게 울리는 현악기입니다. (Indian Fusion, Psychedelic, World Pop)', descriptionKo: 'sitar - 인도풍의 길게 울리는 현악기입니다. (Indian Fusion, Psychedelic, World Pop)', promptCore: 'sitar' },
      { id: 'koto', label: 'Koto', labelKo: '고토', description: 'koto - 일본 전통 현악의 맑은 플럭 소리입니다. (J-Pop Fusion, OST, Ambient)', descriptionKo: 'koto - 일본 전통 현악의 맑은 플럭 소리입니다. (J-Pop Fusion, OST, Ambient)', promptCore: 'koto' },
      { id: 'oud', label: 'Oud', labelKo: '우드', description: 'oud - 중동풍의 따뜻하고 깊은 현악기입니다. (Arab Pop, World Fusion, Cinematic)', descriptionKo: 'oud - 중동풍의 따뜻하고 깊은 현악기입니다. (Arab Pop, World Fusion, Cinematic)', promptCore: 'oud' },
      { id: 'separator-world-drum', kind: 'separator', label: '월드 타악', labelKo: '월드 타악', description: '', descriptionKo: '', promptCore: '' },
      { id: 'steel-drum', label: 'Steel Drum', labelKo: '스틸 드럼', description: 'steel drum - 밝고 열대적인 금속 타악기입니다. (Tropical Pop, Calypso, Summer Pop)', descriptionKo: 'steel drum - 밝고 열대적인 금속 타악기입니다. (Tropical Pop, Calypso, Summer Pop)', promptCore: 'steel drum' },
      { id: 'tabla', label: 'Tabla', labelKo: '타블라', description: 'tabla - 빠르고 섬세한 인도 타악기입니다. (Indian Fusion, World Pop, Electronic)', descriptionKo: 'tabla - 빠르고 섬세한 인도 타악기입니다. (Indian Fusion, World Pop, Electronic)', promptCore: 'tabla' },
      { id: 'separator-world-wind', kind: 'separator', label: '월드 관악', labelKo: '월드 관악', description: '', descriptionKo: '', promptCore: '' },
      { id: 'bansuri', label: 'Bansuri', labelKo: '반수리', description: 'bansuri - 부드럽고 숨결 있는 인도 플루트입니다. (Indian Fusion, Ambient, Ballad)', descriptionKo: 'bansuri - 부드럽고 숨결 있는 인도 플루트입니다. (Indian Fusion, Ambient, Ballad)', promptCore: 'bansuri' },
      { id: 'shakuhachi', label: 'Shakuhachi', labelKo: '샤쿠하치', description: 'shakuhachi - 깊고 명상적인 일본 대나무 피리입니다. (Ambient, J-Fusion, Cinematic)', descriptionKo: 'shakuhachi - 깊고 명상적인 일본 대나무 피리입니다. (Ambient, J-Fusion, Cinematic)', promptCore: 'shakuhachi' },
      { id: 'erhu', label: 'Erhu', labelKo: '얼후', description: 'erhu - 애절하게 휘어지는 중국 전통 현악 선율입니다. (C-Pop, OST, World Fusion)', descriptionKo: 'erhu - 애절하게 휘어지는 중국 전통 현악 선율입니다. (C-Pop, OST, World Fusion)', promptCore: 'erhu' },
      { id: 'dizi', label: 'Dizi', labelKo: '디즈', description: 'dizi - 맑고 밝은 중국 전통 피리입니다. (C-Pop Fusion, Folk, OST)', descriptionKo: 'dizi - 맑고 밝은 중국 전통 피리입니다. (C-Pop Fusion, Folk, OST)', promptCore: 'dizi' },
      { id: 'duduk', label: 'Duduk', labelKo: '두둑', description: 'duduk - 깊고 쓸쓸한 중동풍 목관 악기입니다. (Cinematic, World Fusion, Dark Ballad)', descriptionKo: 'duduk - 깊고 쓸쓸한 중동풍 목관 악기입니다. (Cinematic, World Fusion, Dark Ballad)', promptCore: 'duduk' },
    ],
  },
  {
    id: 'vocal-effects',
    title: 'Vocal FX',
    titleKo: '보컬효과',
    variants: [
      { id: 'hummed-texture', label: 'Hummed Texture', labelKo: '허밍 질감', description: 'hummed texture - 허밍처럼 부드럽게 깔리는 목소리 질감입니다.', descriptionKo: 'hummed texture - 허밍처럼 부드럽게 깔리는 목소리 질감입니다.', promptCore: 'hummed texture' },
      { id: 'vocal-pad', label: 'Vocal Pad', labelKo: '보컬 패드', description: 'vocal pad - 목소리처럼 부드럽게 깔리는 패드입니다.', descriptionKo: 'vocal pad - 목소리처럼 부드럽게 깔리는 패드입니다.', promptCore: 'vocal pad' },
      { id: 'choir-pad', label: 'Choir Pad', labelKo: '콰이어 패드', description: 'choir pad - 합창처럼 넓게 깔리는 패드입니다.', descriptionKo: 'choir pad - 합창처럼 넓게 깔리는 패드입니다.', promptCore: 'choir pad' },
      { id: 'gospel-choir', label: 'Gospel Choir', labelKo: '가스펠 콰이어', description: 'gospel choir - 풍성한 가스펠 합창 질감입니다.', descriptionKo: 'gospel choir - 풍성한 가스펠 합창 질감입니다.', promptCore: 'gospel choir' },
      { id: 'crowd-chant', label: 'Crowd Chant', labelKo: '관객 챈트', description: 'crowd chant - 여러 사람이 함께 외치는 듯한 효과입니다.', descriptionKo: 'crowd chant - 여러 사람이 함께 외치는 듯한 효과입니다.', promptCore: 'crowd chant' },
      { id: 'vocal-chop', label: 'Vocal Chop', labelKo: '보컬 찹', description: 'vocal chop - 보컬을 잘게 잘라 리듬/멜로디처럼 쓰는 효과입니다.', descriptionKo: 'vocal chop - 보컬을 잘게 잘라 리듬/멜로디처럼 쓰는 효과입니다.', promptCore: 'vocal chop' }
    ],
  },
  {
    id: 'texture-effects',
    title: 'Texture FX',
    titleKo: '질감효과',
    variants: [
      { id: 'separator-texture-noise', kind: 'separator', label: 'Noise Texture', labelKo: '노이즈 질감', description: '', descriptionKo: '', promptCore: '' },
      { id: 'analog-warmth', label: 'Analog Warmth', labelKo: '아날로그 온기', description: 'analog warmth - 빈티지 장비처럼 따뜻하게 묻어나는 질감입니다. (Lo-fi, City Pop, Retro Pop)', descriptionKo: 'analog warmth - 빈티지 장비처럼 따뜻하게 묻어나는 질감입니다. (Lo-fi, City Pop, Retro Pop)', promptCore: 'analog warmth' },
      { id: 'tape-hiss', label: 'Tape Hiss', labelKo: '테이프 노이즈', description: 'tape hiss - 오래된 카세트처럼 부드럽게 깔리는 히스입니다. (Lo-fi, Indie Pop, Retro Pop)', descriptionKo: 'tape hiss - 오래된 카세트처럼 부드럽게 깔리는 히스입니다. (Lo-fi, Indie Pop, Retro Pop)', promptCore: 'tape hiss' },
      { id: 'vinyl-noise', label: 'Vinyl Noise', labelKo: '바이닐 노이즈', description: 'vinyl crackle - 레코드판의 따뜻한 잡음입니다. (Lo-fi, Jazz, City Pop)', descriptionKo: 'vinyl crackle - 레코드판의 따뜻한 잡음입니다. (Lo-fi, Jazz, City Pop)', promptCore: 'vinyl crackle' },
      { id: 'static-noise', label: 'Static Noise', labelKo: '정전기 노이즈', description: 'static noise - 라디오 잡음처럼 차갑게 깔리는 노이즈입니다. (Lo-fi, Synthwave, Ambient)', descriptionKo: 'static noise - 라디오 잡음처럼 차갑게 깔리는 노이즈입니다. (Lo-fi, Synthwave, Ambient)', promptCore: 'static noise' },
      { id: 'radio-noise', label: 'Radio Noise', labelKo: '라디오 노이즈', description: 'radio noise - 오래된 라디오처럼 흐릿하게 섞이는 송출 잡음입니다. (Lo-fi, Retro Pop, Indie, Cinematic)', descriptionKo: 'radio noise - 오래된 라디오처럼 흐릿하게 섞이는 송출 잡음입니다. (Lo-fi, Retro Pop, Indie, Cinematic)', promptCore: 'radio noise' },
      { id: 'digital-noise', label: 'Digital Noise', labelKo: '디지털 노이즈', description: 'digital noise - 압축되고 깨지는 디지털 질감입니다. (Hyperpop, Electronic, Experimental)', descriptionKo: 'digital noise - 압축되고 깨지는 디지털 질감입니다. (Hyperpop, Electronic, Experimental)', promptCore: 'digital noise' },

      { id: 'separator-texture-nature', kind: 'separator', label: 'Nature Ambience', labelKo: '자연/공간 배경음', description: '', descriptionKo: '', promptCore: '' },
      { id: 'rain-ambience', label: 'Rain Ambience', labelKo: '비 소리', description: 'rain ambience - 잔잔하게 깔리는 빗소리 배경 질감입니다. (Lo-fi, Ballad, Ambient, Cinematic)', descriptionKo: 'rain ambience - 잔잔하게 깔리는 빗소리 배경 질감입니다. (Lo-fi, Ballad, Ambient, Cinematic)', promptCore: 'rain ambience' },
      { id: 'thunder-fx', label: 'Thunder FX', labelKo: '천둥소리', description: 'thunder FX - 멀리서 울리는 천둥과 폭풍의 긴장감을 더합니다. (Cinematic, Dark Pop, Rock, Trailer)', descriptionKo: 'thunder FX - 멀리서 울리는 천둥과 폭풍의 긴장감을 더합니다. (Cinematic, Dark Pop, Rock, Trailer)', promptCore: 'thunder FX' },
      { id: 'ocean-ambience', label: 'Ocean Ambience', labelKo: '바다 소리', description: 'ocean ambience - 파도와 바다 공기를 배경으로 깔아주는 질감입니다. (Ambient, Ballad, Chillout, Cinematic)', descriptionKo: 'ocean ambience - 파도와 바다 공기를 배경으로 깔아주는 질감입니다. (Ambient, Ballad, Chillout, Cinematic)', promptCore: 'ocean ambience' },
      { id: 'wind-noise', label: 'Wind Noise', labelKo: '바람 소리', description: 'wind noise - 공기 흐름과 쓸쓸한 바람 질감을 더합니다. (Ambient, Cinematic, Folk, Ballad)', descriptionKo: 'wind noise - 공기 흐름과 쓸쓸한 바람 질감을 더합니다. (Ambient, Cinematic, Folk, Ballad)', promptCore: 'wind noise' },
      { id: 'room-tone', label: 'Room Tone', labelKo: '방 공기감', description: 'room tone - 작은 공간의 조용한 공기감을 더합니다. (Acoustic, Ballad, Lo-fi, Indie Pop)', descriptionKo: 'room tone - 작은 공간의 조용한 공기감을 더합니다. (Acoustic, Ballad, Lo-fi, Indie Pop)', promptCore: 'room tone' },
      { id: 'street-noise', label: 'Street Noise', labelKo: '거리 소음', description: 'street noise - 거리의 공기와 생활 소음을 얇게 깔아주는 질감입니다. (City Pop, Lo-fi, Hip-hop, Cinematic)', descriptionKo: 'street noise - 거리의 공기와 생활 소음을 얇게 깔아주는 질감입니다. (City Pop, Lo-fi, Hip-hop, Cinematic)', promptCore: 'street noise' },

      { id: 'separator-texture-transport', kind: 'separator', label: 'Transport SFX', labelKo: '이동/교통 소리', description: '', descriptionKo: '', promptCore: '' },
      { id: 'car-ambience', label: 'Car Ambience', labelKo: '자동차 소리', description: 'car ambience - 차 안이나 도로 위의 낮은 주행음을 깔아줍니다. (City Pop, Lo-fi, Night Drive, Synthwave)', descriptionKo: 'car ambience - 차 안이나 도로 위의 낮은 주행음을 깔아줍니다. (City Pop, Lo-fi, Night Drive, Synthwave)', promptCore: 'car ambience' },
      { id: 'train-ambience', label: 'Train Ambience', labelKo: '기차 소리', description: 'train ambience - 기차가 지나가거나 달리는 반복적인 이동감을 더합니다. (Lo-fi, Ballad, Cinematic, Indie Pop)', descriptionKo: 'train ambience - 기차가 지나가거나 달리는 반복적인 이동감을 더합니다. (Lo-fi, Ballad, Cinematic, Indie Pop)', promptCore: 'train ambience' },
      { id: 'airplane-ambience', label: 'Airplane Ambience', labelKo: '비행기 소리', description: 'airplane ambience - 비행기 엔진처럼 멀고 낮게 깔리는 이동감을 더합니다. (Ambient, Cinematic, Dream Pop, Travel Pop)', descriptionKo: 'airplane ambience - 비행기 엔진처럼 멀고 낮게 깔리는 이동감을 더합니다. (Ambient, Cinematic, Dream Pop, Travel Pop)', promptCore: 'airplane ambience' },
      { id: 'ambulance-siren', label: 'Ambulance Siren', labelKo: '구급차 사이렌', description: 'ambulance siren - 멀리서 들리는 긴박한 사이렌 효과입니다. (Cinematic, Dark Pop, Hip-hop, Experimental)', descriptionKo: 'ambulance siren - 멀리서 들리는 긴박한 사이렌 효과입니다. (Cinematic, Dark Pop, Hip-hop, Experimental)', promptCore: 'ambulance siren' },

      { id: 'separator-texture-object', kind: 'separator', label: 'Object Foley', labelKo: '생활/사물 소리', description: '', descriptionKo: '', promptCore: '' },
      { id: 'typing-sfx', label: 'Typing SFX', labelKo: '타자 소리', description: 'typing SFX - 키보드나 타자기처럼 또각거리는 사물 소리입니다. (Lo-fi, Indie Pop, City Pop, Spoken Pop)', descriptionKo: 'typing SFX - 키보드나 타자기처럼 또각거리는 사물 소리입니다. (Lo-fi, Indie Pop, City Pop, Spoken Pop)', promptCore: 'typing SFX' },
      { id: 'page-turns', label: 'Page Turns', labelKo: '책 넘기는 소리', description: 'page turns - 종이를 넘기는 작고 섬세한 사물 소리입니다. (Acoustic, Ballad, Lo-fi, Narrative Pop)', descriptionKo: 'page turns - 종이를 넘기는 작고 섬세한 사물 소리입니다. (Acoustic, Ballad, Lo-fi, Narrative Pop)', promptCore: 'page turns' },
      { id: 'clock-tick', label: 'Clock Tick', labelKo: '시계 초침', description: 'clock tick - 시간의 흐름을 느끼게 하는 반복적인 초침 소리입니다. (Ballad, Cinematic, Lo-fi, Dark Pop)', descriptionKo: 'clock tick - 시간의 흐름을 느끼게 하는 반복적인 초침 소리입니다. (Ballad, Cinematic, Lo-fi, Dark Pop)', promptCore: 'clock tick' },
      { id: 'door-sfx', label: 'Door SFX', labelKo: '문 여닫는 소리', description: 'door SFX - 문이 열리고 닫히는 장면 전환용 사물 소리입니다. (Cinematic, Narrative Pop, Ballad, Musical)', descriptionKo: 'door SFX - 문이 열리고 닫히는 장면 전환용 사물 소리입니다. (Cinematic, Narrative Pop, Ballad, Musical)', promptCore: 'door SFX' },
      { id: 'footsteps', label: 'Footsteps', labelKo: '발걸음 소리', description: 'footsteps - 걷는 장면을 만드는 작고 반복적인 발걸음 소리입니다. (Cinematic, Lo-fi, Ballad, Narrative Pop)', descriptionKo: 'footsteps - 걷는 장면을 만드는 작고 반복적인 발걸음 소리입니다. (Cinematic, Lo-fi, Ballad, Narrative Pop)', promptCore: 'footsteps' },

      { id: 'separator-texture-electronic-fx', kind: 'separator', label: 'Electronic FX', labelKo: '전자/전환 효과', description: '', descriptionKo: '', promptCore: '' },
      { id: 'mechanical-noise', label: 'Mechanical Noise', labelKo: '기계음 노이즈', description: 'mechanical noise - 금속성 있고 차가운 기계 소리입니다. (Industrial, Cyberpunk, Experimental)', descriptionKo: 'mechanical noise - 금속성 있고 차가운 기계 소리입니다. (Industrial, Cyberpunk, Experimental)', promptCore: 'mechanical noise' },
      { id: 'glitch-fx', label: 'Glitch FX', labelKo: '글리치 효과', description: 'glitch FX - 끊기고 깨지는 전자 효과음입니다. (Hyperpop, EDM, Experimental)', descriptionKo: 'glitch FX - 끊기고 깨지는 전자 효과음입니다. (Hyperpop, EDM, Experimental)', promptCore: 'glitch FX' },
      { id: 'shimmer-fx', label: 'Shimmer FX', labelKo: '반짝임 효과', description: 'shimmer FX - 빛이 번지는 듯한 반짝이는 효과입니다. (Dream Pop, Fantasy, K-Pop, Ambient)', descriptionKo: 'shimmer FX - 빛이 번지는 듯한 반짝이는 효과입니다. (Dream Pop, Fantasy, K-Pop, Ambient)', promptCore: 'shimmer FX' },
      { id: 'magic-sparkle-fx', label: 'Magic Sparkle FX', labelKo: '마법 반짝임', description: 'magic sparkle FX - 반짝이고 환상적인 효과음입니다. (Fantasy, Dreamy Pop, OST)', descriptionKo: 'magic sparkle FX - 반짝이고 환상적인 효과음입니다. (Fantasy, Dreamy Pop, OST)', promptCore: 'magic sparkle FX' },
      { id: 'reverse-fx', label: 'Reverse FX', labelKo: '리버스 효과', description: 'reverse FX - 거꾸로 빨려 들어가는 듯한 전환 효과입니다. (EDM, K-Pop, Trailer, Future Bass)', descriptionKo: 'reverse FX - 거꾸로 빨려 들어가는 듯한 전환 효과입니다. (EDM, K-Pop, Trailer, Future Bass)', promptCore: 'reverse FX' },
      { id: 'impact-hit', label: 'Impact Hit', labelKo: '임팩트 히트', description: 'impact hit - 구간 전환에 강하게 찍히는 효과음입니다. (Cinematic, EDM, K-Pop, Trailer)', descriptionKo: 'impact hit - 구간 전환에 강하게 찍히는 효과음입니다. (Cinematic, EDM, K-Pop, Trailer)', promptCore: 'impact hit' },
      { id: 'riser-fx', label: 'Riser FX', labelKo: '라이저 효과', description: 'riser FX - 점점 위로 올라가며 긴장감을 만드는 전환 효과입니다. (EDM, K-Pop, Future Bass, Trailer)', descriptionKo: 'riser FX - 점점 위로 올라가며 긴장감을 만드는 전환 효과입니다. (EDM, K-Pop, Future Bass, Trailer)', promptCore: 'riser FX' },
      { id: 'downlifter-fx', label: 'Downlifter FX', labelKo: '다운리프터 효과', description: 'downlifter FX - 구간 끝에서 아래로 가라앉는 전환 효과입니다. (EDM, Cinematic, K-Pop, Ambient)', descriptionKo: 'downlifter FX - 구간 끝에서 아래로 가라앉는 전환 효과입니다. (EDM, Cinematic, K-Pop, Ambient)', promptCore: 'downlifter FX' },
      { id: 'whoosh-fx', label: 'Whoosh FX', labelKo: '휙 전환음', description: 'whoosh FX - 공기가 지나가듯 빠르게 스치는 전환음입니다. (K-Pop, EDM, Trailer, Cinematic)', descriptionKo: 'whoosh FX - 공기가 지나가듯 빠르게 스치는 전환음입니다. (K-Pop, EDM, Trailer, Cinematic)', promptCore: 'whoosh FX' },
      { id: 'sweep-fx', label: 'Sweep FX', labelKo: '스윕 효과', description: 'sweep FX - 필터가 쓸고 지나가듯 공간을 여는 전환 효과입니다. (EDM, Synth-pop, House, K-Pop)', descriptionKo: 'sweep FX - 필터가 쓸고 지나가듯 공간을 여는 전환 효과입니다. (EDM, Synth-pop, House, K-Pop)', promptCore: 'sweep FX' },
      { id: 'sub-drop', label: 'Sub Drop', labelKo: '서브 드롭', description: 'sub drop - 낮은 저음이 아래로 떨어지는 묵직한 효과입니다. (Trap, EDM, Trailer, Hip-hop)', descriptionKo: 'sub drop - 낮은 저음이 아래로 떨어지는 묵직한 효과입니다. (Trap, EDM, Trailer, Hip-hop)', promptCore: 'sub drop' },
      { id: 'tape-stop', label: 'Tape Stop', labelKo: '테이프 스톱', description: 'tape stop - 테이프가 멈추듯 소리가 느려지며 꺼지는 효과입니다. (Hip-hop, K-Pop, Lo-fi, Hyperpop)', descriptionKo: 'tape stop - 테이프가 멈추듯 소리가 느려지며 꺼지는 효과입니다. (Hip-hop, K-Pop, Lo-fi, Hyperpop)', promptCore: 'tape stop' },
      { id: 'record-scratch', label: 'Record Scratch', labelKo: '레코드 스크래치', description: 'record scratch - DJ가 레코드를 긁는 듯한 짧은 전환 효과입니다. (Hip-hop, Funk, Comedy Pop, Retro Pop)', descriptionKo: 'record scratch - DJ가 레코드를 긁는 듯한 짧은 전환 효과입니다. (Hip-hop, Funk, Comedy Pop, Retro Pop)', promptCore: 'record scratch' },
      { id: 'laser-fx', label: 'Laser FX', labelKo: '레이저 효과', description: 'laser FX - 날카롭고 미래적인 전자 효과음입니다. (EDM, Cyberpunk, Hyperpop, Synthwave)', descriptionKo: 'laser FX - 날카롭고 미래적인 전자 효과음입니다. (EDM, Cyberpunk, Hyperpop, Synthwave)', promptCore: 'laser FX' },
      { id: 'stutter-fx', label: 'Stutter FX', labelKo: '스터터 효과', description: 'stutter FX - 소리를 잘게 끊어 리듬처럼 튀게 만드는 효과입니다. (Hyperpop, EDM, K-Pop, Experimental)', descriptionKo: 'stutter FX - 소리를 잘게 끊어 리듬처럼 튀게 만드는 효과입니다. (Hyperpop, EDM, K-Pop, Experimental)', promptCore: 'stutter FX' },
      { id: 'cyber-texture', label: 'Cyber Texture', labelKo: '사이버 질감', description: 'cyber texture - 미래적이고 사이버틱한 전자 질감입니다. (Cyberpunk, EDM, Hyperpop)', descriptionKo: 'cyber texture - 미래적이고 사이버틱한 전자 질감입니다. (Cyberpunk, EDM, Hyperpop)', promptCore: 'cyber texture' },
      { id: 'glitch-texture', label: 'Glitch Texture', labelKo: '글리치 질감', description: 'glitch texture - 끊기고 튀는 디지털 질감입니다. (Hyperpop, Electronic, Experimental)', descriptionKo: 'glitch texture - 끊기고 튀는 디지털 질감입니다. (Hyperpop, Electronic, Experimental)', promptCore: 'glitch texture' },
      { id: 'electronic', label: 'Electronic Texture', labelKo: '전자적 질감', description: 'electronic texture - 정교한 전자음과 디지털 선명함입니다. (EDM, Synth-pop, K-Pop)', descriptionKo: 'electronic texture - 정교한 전자음과 디지털 선명함입니다. (EDM, Synth-pop, K-Pop)', promptCore: 'electronic texture' }
    ],
  }] as const;


export const INSTRUMENT_SOUNDS = SOUND_TEXTURE_CYCLES.flatMap((cycle) =>
  cycle.variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    labelKo: variant.labelKo,
    description: variant.description,
    descriptionKo: variant.descriptionKo,
    promptCore: variant.promptCore,
    categoryId: cycle.id,
    categoryKo: cycle.titleKo,
    categoryLabel: cycle.title,
    applyPools: (variant as any).applyPools,
  }))
);

export const MOODS: CategoryItem[] = [
  { 
    id: 'calm', label: 'Calm', labelKo: '차분한', 
    description: '차분하고 평화롭게 정돈된 감정선으로 고요하고 안정적인 무드를 만듭니다.', 
    mood: 'Calm, peaceful, settled, quiet', 
    arrangement: 'minimal movement, stable structure, subtle shifts' 
  },
  { 
    id: 'relaxing', label: 'Relaxing', labelKo: '릴렉스', 
    description: '편안함과 칠한 여유를 함께 담아 힘을 빼고 자연스럽게 흘러가는 무드를 만듭니다.', 
    mood: 'Relaxed, chill, laid-back, gentle flow', 
    arrangement: 'easy pacing, relaxed groove, effortless progression' 
  },
  { 
    id: 'zen', label: 'Zen', labelKo: '명상적인', 
    description: '비움과 정적이 느껴지는 절제된 분위기로 맑고 고요한 질감을 만듭니다.', 
    mood: 'Spacious, meditative stillness', 
    arrangement: 'minimalist, significant space' 
  },
  { 
    id: 'healing', label: 'Healing', labelKo: '치유되는', 
    description: '상처를 감싸듯 부드럽게 스며드는 분위기로 위로감 있는 무드를 만듭니다.', 
    mood: 'Warm, comforting, therapeutic', 
    arrangement: 'gentle flow, nurturing transitions' 
  },
  { 
    id: 'warm', label: 'Warm', labelKo: '따뜻한', 
    description: '온기 있게 감싸는 질감으로 부드럽고 포근한 분위기를 만듭니다.', 
    mood: 'Soft, thick, cozy', 
    arrangement: 'warm structure, harmonic support' 
  },
  { 
    id: 'coziness', label: 'Coziness', labelKo: '아늑한', 
    description: '작고 포근한 공간에 머무는 듯한 따뜻하고 친밀한 분위기를 만듭니다.', 
    mood: 'Close-up, warm, intimate', 
    arrangement: 'small-space, close-mic feel' 
  },
  { 
    id: 'soft_tender', label: 'Soft Tender', labelKo: '몽글한', 
    description: '부드럽고 말랑하게 피어나는 따뜻한 감정의 질감을 만듭니다.', 
    mood: 'Soft, tender, gently warm', 
    arrangement: 'rounded flow, gentle lift' 
  },
  { 
    id: 'tender', label: 'Tender', labelKo: '애틋한', 
    description: '조심스럽고 다정하지만 어딘가 아픈 애틋한 감정선을 더합니다.', 
    mood: 'Tender, affectionate, bittersweet', 
    arrangement: 'soft emotional lift, warm lingering sections' 
  },
  { 
    id: 'bright', label: 'Bright', labelKo: '밝은', 
    description: '환하게 열리는 인상으로 선명하고 가벼운 분위기를 형성합니다.', 
    mood: 'Clear, airy, luminous', 
    arrangement: 'uplifting, forward structure' 
  },
  { 
    id: 'hopeful', label: 'Hopeful', labelKo: '희망찬', 
    description: '앞으로 나아가는 기대감이 느껴지는 밝고 상승감 있는 무드를 형성합니다.', 
    mood: 'Rising shimmer, optimistic', 
    arrangement: 'gradual build, bright resolution' 
  },
  { 
    id: 'cheerful', label: 'Cheerful', labelKo: '쾌활한', 
    description: '밝고 경쾌하게 튀어 오르는 에너지로 생기 있는 무드를 만듭니다.', 
    mood: 'Bouncy, playful energy', 
    arrangement: 'energetic flow, lively accents' 
  },
  { 
    id: 'playful_mischief', label: 'Playful Mischief', labelKo: '장난끼', 
    description: '가볍게 장난치듯 톡톡 튀는 감정으로 playful한 분위기를 만듭니다.', 
    mood: 'Playful, mischievous, lighthearted', 
    arrangement: 'bouncy accents, playful breaks' 
  },
  { 
    id: 'cheeky_deadpan', label: 'Cheeky Deadpan', labelKo: '능청미', 
    description: '능청스럽고 뻔뻔한 듯한 유머로 말맛 있는 코믹한 무드를 더합니다.', 
    mood: 'Slyly playful, deadpan humor, cheeky', 
    arrangement: 'dry pauses, witty turnarounds' 
  },
  { 
    id: 'comic_but_sad', label: 'Comic But Sad', labelKo: '웃픈', 
    description: '웃기지만 어딘가 짠한 감정을 섞어 funny yet bittersweet한 분위기를 만듭니다.', 
    mood: 'Comic but sad, funny yet bittersweet', 
    arrangement: 'light groove with bittersweet turns' 
  },
  { 
    id: 'comedic', label: 'Comedic', labelKo: '코믹한', 
    description: '가볍고 유쾌한 코미디 감각으로 상황을 재미있게 풀어내는 무드를 만듭니다.', 
    mood: 'Comedic, playful, humorous', 
    arrangement: 'comic timing, short playful stops' 
  },
  { 
    id: 'quirky', label: 'Quirky', labelKo: '엉뚱한', 
    description: '예상 밖의 전개와 엉뚱한 매력으로 독특하고 귀여운 분위기를 만듭니다.', 
    mood: 'Quirky, unexpected, oddball', 
    arrangement: 'unexpected accents, quirky shifts' 
  },
  { 
    id: 'cute_mood', label: 'Cute', labelKo: '귀여운', 
    description: '귀엽고 깜찍하며 발랄한 매력을 담아 작고 밝게 튀는 무드를 만듭니다.', 
    mood: 'Cute, adorable, perky, bubbly, sweet', 
    arrangement: 'small bright hooks, perky phrases, playful motion' 
  },
  { 
    id: 'upbeat', label: 'Upbeat', labelKo: '업비트', 
    description: '경쾌하게 밀고 나가는 에너지로 가볍고 활발한 무드를 만듭니다.', 
    mood: 'Crisp, driving, high-energy', 
    arrangement: 'energetic pulse, forward momentum' 
  },
  { 
    id: 'swelling', label: 'Swelling', labelKo: '벅찬', 
    description: '감정이 차오르며 후반으로 갈수록 크게 벅차오르는 무드를 만듭니다.', 
    mood: 'Swelling, emotional, overwhelming', 
    arrangement: 'gradual build, final emotional bloom' 
  },
  { 
    id: 'powerful', label: 'Powerful', labelKo: '파워풀', 
    description: '강한 추진력과 존재감으로 힘 있게 밀어붙이는 분위기를 만듭니다.', 
    mood: 'Bold, grand, massive', 
    arrangement: 'high-impact, strong emphasis' 
  },
  { 
    id: 'infectious', label: 'Infectious', labelKo: '캐치한', 
    description: '한 번 들으면 귀에 맴도는 강한 인상으로 반복적인 몰입감을 형성합니다.', 
    mood: 'Catchy, repetitive, magnetic', 
    arrangement: 'infectious, memorable hooks' 
  },
  { 
    id: 'bittersweet', label: 'Bittersweet', labelKo: '달콤씁쓸', 
    description: '따뜻함과 쓸쓸함이 함께 남는 복합적인 무드와 질감을 형성합니다.', 
    mood: 'Complex, mixed colors', 
    arrangement: 'balanced, contrasting dynamics' 
  },
  { 
    id: 'emotional', label: 'Emotional', labelKo: '감성적', 
    description: '섬세하고 진한 감정 표현이 살아나는 분위기로 몰입감 있는 무드를 형성합니다.', 
    mood: 'Rich, immersive, raw depth', 
    arrangement: 'dynamic build, expressive peaks' 
  },
  { 
    id: 'romantic', label: 'Romantic', labelKo: '낭만적', 
    description: '감미롭고 설레는 정서가 흐르는 분위기로 로맨틱한 무드를 만듭니다.', 
    mood: 'Lush, sweet, intimate', 
    arrangement: 'smooth flow, graceful builds' 
  },
  { 
    id: 'wistful', label: 'Wistful', labelKo: '아련한', 
    description: '희미한 여운과 조용한 쓸쓸함, 고독한 거리감을 함께 담아 아련한 무드를 만듭니다.', 
    mood: 'Wistful, lonely, quiet, faintly emotional', 
    arrangement: 'soft lingering flow, sparse movement, gentle emotional pull' 
  },
  { 
    id: 'restrained', label: 'Restrained', labelKo: '담담한', 
    description: '감정을 과하게 드러내지 않고 차분히 눌러 담는 무드를 만듭니다.', 
    mood: 'Restrained, calm, understated', 
    arrangement: 'controlled dynamics, minimal emotional overflow' 
  },
  { 
    id: 'hollow', label: 'Hollow', labelKo: '공허한', 
    description: '마음 한쪽이 비어 있는 듯한 거리감과 허전한 여백을 만듭니다.', 
    mood: 'Hollow, empty, distant', 
    arrangement: 'open space, restrained low movement' 
  },
  { 
    id: 'melancholic', label: 'Melancholic', labelKo: '우울한', 
    description: '쓸쓸하고 가라앉은 감정선을 중심으로 무게감 있는 분위기를 만듭니다.', 
    mood: 'Lonely, fragile, blue', 
    arrangement: 'slow flow, lingering notes' 
  },
  { 
    id: 'sad', label: 'Sad', labelKo: '슬픈', 
    description: '슬픔과 상실감이 또렷하게 느껴지는 감정 중심의 무드를 만듭니다.', 
    mood: 'Fragile mourning, heavy weight', 
    arrangement: 'slow, minimal ornaments' 
  },
  { 
    id: 'sorrowful', label: 'Sorrowful', labelKo: '비통한', 
    description: '가슴이 찢어질 듯한 슬픔과 비통한 분위기를 만듭니다.', 
    mood: 'Grieving, heartbreaking', 
    arrangement: 'no climaxes, mourning pace' 
  },
  { 
    id: 'dark', label: 'Dark', labelKo: '어두운', 
    description: '묵직하고 짙게 가라앉는 분위기로 어둡고 깊은 무드를 만듭니다.', 
    mood: 'Heavy, somber, shadows', 
    arrangement: 'slow-drag, weighted sections' 
  },
  { 
    id: 'moody', label: 'Moody', labelKo: '무디', 
    description: '감정의 결이 짙게 배어 있는 분위기로 깊고 미묘한 무드를 만듭니다.', 
    mood: 'Thick, moody, shifting', 
    arrangement: 'shifting structure, emotive turns' 
  },
  { 
    id: 'tense', label: 'Tense', labelKo: '긴장된', 
    description: '서서히 조여오는 긴장감으로 날카롭고 불안정한 무드감을 형성합니다.', 
    mood: 'Sharp, anxious, high-tension', 
    arrangement: 'tight pacing, sudden shifts' 
  },
  { 
    id: 'uneasy', label: 'Uneasy', labelKo: '불안한', 
    description: '안정되지 못하고 흔들리는 긴장감으로 불안한 감정의 결을 만듭니다.', 
    mood: 'Uneasy, unstable, tense', 
    arrangement: 'uneven pacing, unresolved transitions' 
  },
  { 
    id: 'chilly', label: 'Chilly', labelKo: '서늘한', 
    description: '차갑게 스며드는 미묘한 긴장감과 서늘한 공기를 더합니다.', 
    mood: 'Cold, subtle tension', 
    arrangement: 'cool textures, restrained tension' 
  },
  { 
    id: 'fragile_edge', label: 'Fragile Edge', labelKo: '위태로운', 
    description: '금방이라도 무너질 듯 흔들리는 섬세하고 위태로운 분위기를 만듭니다.', 
    mood: 'Fragile, unstable, on the edge', 
    arrangement: 'unstable shifts, delicate tension' 
  },
  { 
    id: 'groovy', label: 'Groovy', labelKo: '그루비', 
    description: '리듬의 탄력과 흐름이 살아 있는 질감으로 자연스럽게 몸을 타는 무드를 만듭니다.', 
    mood: 'Elastic, rhythmic, pocketed', 
    arrangement: 'groovy pocket, consistent drive' 
  },
  { 
    id: 'funky', label: 'Funky', labelKo: '펑키', 
    description: '톡톡 튀는 리듬감과 개성 있는 질감으로 활기찬 분위기를 형성합니다.', 
    mood: 'Sharp, funky, rhythmic snap', 
    arrangement: 'syncopated, energetic drive' 
  },
  { 
    id: 'hypnotic', label: 'Hypnotic', labelKo: '몰입감', 
    description: '반복과 흐름 속에 빨려 들어가듯 깊이 몰입되는 분위기를 만듭니다.', 
    mood: 'Swirling, hypnotic, trance-like', 
    arrangement: 'repetitive, evolving layers' 
  },
  { 
    id: 'sophisticated', label: 'Sophisticated', labelKo: '세련된', 
    description: '정교하고 다듬어진 인상으로 도시적이고 세련된 무드를 형성합니다.', 
    mood: 'Polished, urban, refined', 
    arrangement: 'elegant structure, intricate' 
  },
  { 
    id: 'minimalist', label: 'Minimalist', labelKo: '미니멀', 
    description: '불필요한 요소를 덜어낸 절제된 질감으로 깔끔한 분위기를 만듭니다.', 
    mood: 'Bare, minimalist, essential', 
    arrangement: 'simple, focused elements' 
  },
  { 
    id: 'cool', label: 'Cool', labelKo: '시원한', 
    description: '맑고 선선하게 트인 인상으로 차갑고 세련된 무드를 더합니다.', 
    mood: 'Sharp, clear, icy', 
    arrangement: 'detached flow, crisp sections' 
  },
  { 
    id: 'smooth', label: 'Smooth', labelKo: '스무스', 
    description: '부드럽고 매끄럽게 이어지는 세련된 흐름으로 걸림 없는 질감을 더합니다.', 
    mood: 'Smooth, mellow, polished, flowing', 
    arrangement: 'smooth transitions, fluid movement, flowing sections' 
  },
  { 
    id: 'glossy', label: 'Glossy', labelKo: '글로시', 
    description: '윤기 있고 반짝이는 세련된 표면감으로 현대적인 무드를 만듭니다.', 
    mood: 'Glossy, polished, sparkling', 
    arrangement: 'polished lift, sparkling accents' 
  },
  { 
    id: 'nostalgic', label: 'Nostalgic', labelKo: '빈티지', 
    description: '빈티지한 추억감과 레트로한 아날로그 질감으로 지나간 시간의 무드를 더합니다.', 
    mood: 'Vintage, retro, analog, misty, faded', 
    arrangement: 'classic pop movement, bittersweet pacing, longing feel' 
  },
  { 
    id: 'lofi', label: 'Lo-fi', labelKo: '로파이', 
    description: '먼지 낀 듯 낮은 해상도와 친밀한 빈티지 질감의 무드를 더합니다.', 
    mood: 'Lo-fi, dusty, intimate', 
    arrangement: 'simple loop feel, close texture' 
  },
  { 
    id: 'soulful', label: 'Soulful', labelKo: '소울풀', 
    description: '보컬과 감정 표현에 깊은 온도와 진한 표현력을 더합니다.', 
    mood: 'Soulful, expressive, warm', 
    arrangement: 'expressive peaks, warm harmonic support' 
  },
  { 
    id: 'urban', label: 'Urban', labelKo: '도시적', 
    description: '차갑고 세련된 도시의 결을 담아 현대적 분위기를 형성합니다.', 
    mood: 'Sleek, urban, metropolitan', 
    arrangement: 'modern pulse, sharp transitions' 
  },
  { 
    id: 'cinematic', label: 'Cinematic', labelKo: '시네마틱', 
    description: '장면이 그려지듯 입체적으로 펼쳐지는 무드와 스케일감을 더합니다.', 
    mood: 'Epic, grand, wide-screen', 
    arrangement: 'dynamic arc, narrative' 
  },
  { 
    id: 'airy', label: 'Airy', labelKo: '에어리', 
    description: '가볍고 열린 공기감으로 숨이 트이는 듯한 밝은 여백을 만듭니다.', 
    mood: 'Airy, light, open', 
    arrangement: 'open space, light movement' 
  },
  { 
    id: 'ambient', label: 'Ambient', labelKo: '앰비언트', 
    description: '공간감과 여운이 넓게 퍼지는 배경감 중심의 분위기를 더합니다.', 
    mood: 'Ambient, spacious, atmospheric, airy', 
    arrangement: 'wide space, open reverb, slow evolving layers' 
  },
  { 
    id: 'dreamy_soft', label: 'Dreamy', labelKo: '드리미', 
    description: '소리 질감이 꿈결처럼 부드럽고 몽환적으로 떠 있는 흐릿한 무드를 만듭니다.', 
    mood: 'Dreamy, floating, hazy, dreamlike, soft', 
    arrangement: 'blurred transitions, ethereal flow, floating movement' 
  },
  { 
    id: 'ethereal', label: 'Ethereal', labelKo: '에테리얼', 
    description: '현실에서 살짝 떠 있는 듯한 가볍고 신비로운 초현실적 분위기를 만듭니다.', 
    mood: 'Ethereal, weightless, otherworldly', 
    arrangement: 'weightless layers, floating transitions' 
  },
  { 
    id: 'mysterious', label: 'Mysterious', labelKo: '신비로운', 
    description: '정체를 알 수 없는 끌림과 신비한 공기로 mysterious한 분위기를 만듭니다.', 
    mood: 'Mysterious, mystical, enchanting', 
    arrangement: 'mystical textures, subtle reveals' 
  },
  { 
    id: 'fantasy', label: 'Fantasy', labelKo: '판타지', 
    description: '현실에서 벗어난 이야기 세계관처럼 환상적이고 imaginative한 무드를 더합니다.', 
    mood: 'Fantasy-like, magical, storybook', 
    arrangement: 'storybook arc, magical color shifts' 
  },
  { 
    id: 'fairytale', label: 'Fairytale', labelKo: '동화적인', 
    description: '순수하고 이야기책 같은 정서로 맑고 동화적인 분위기를 만듭니다.', 
    mood: 'Fairytale-like, innocent, magical', 
    arrangement: 'gentle storybook progression' 
  },
  { 
    id: 'magical', label: 'Magical', labelKo: '마법같은', 
    description: '반짝이고 신기한 사건감으로 magical하고 설레는 분위기를 더합니다.', 
    mood: 'Magical, sparkling, wonder-filled', 
    arrangement: 'sparkling lifts, magical transitions' 
  },
  { 
    id: 'surreal', label: 'Surreal', labelKo: '초현실적', 
    description: '현실의 규칙이 살짝 어긋난 듯한 비현실적이고 dreamlike한 분위기를 만듭니다.', 
    mood: 'Surreal, unreal, dreamlike', 
    arrangement: 'off-kilter space, unreal transitions' 
  },
  { 
    id: 'strange', label: 'Strange', labelKo: '기묘한', 
    description: '낯설고 묘한 긴장감으로 strange하고 curious한 분위기를 만듭니다.', 
    mood: 'Strange, uncanny, curious', 
    arrangement: 'curious pauses, eerie small shifts' 
  },
  { 
    id: 'subtle_mystic', label: 'Subtle Mystic', labelKo: '오묘한', 
    description: '한마디로 정의하기 어려운 미묘함과 신비감을 섞어 오묘한 무드를 만듭니다.', 
    mood: 'Subtle, mysterious, hard to define', 
    arrangement: 'subtle tension, ambiguous resolution' 
  }
];

export const THEMES: CategoryItem[] = [
  // 사랑 / 관계
  { id: 'love', label: 'Love', labelKo: '사랑', description: '사랑이 시작되거나 깊어지는 감정과 관계를 중심으로 한 이야기입니다.' },
  { id: 'crush', label: 'Crush', labelKo: '짝사랑', description: '혼자만 간직한 마음과 조심스러운 감정을 담은 이야기입니다.' },
  { id: 'excitement', label: 'Excitement', labelKo: '설렘', description: '새로운 감정이 시작될 때의 떨림과 기대를 담은 이야기입니다.' },
  { id: 'confession', label: 'Confession', labelKo: '고백', description: '숨겨둔 마음을 꺼내 전하려는 순간과 그 긴장감을 담습니다.' },
  { id: 'encounter', label: 'Encounter', labelKo: '만남', description: '새로운 인연과 시작의 순간을 그리는 이야기입니다.' },
  { id: 'breakup', label: 'Breakup', labelKo: '이별', description: '이별의 순간과 그 이후 남겨진 감정을 중심으로 한 이야기입니다.' },
  { id: 'lingering_attachment', label: 'Lingering Attachment', labelKo: '미련', description: '놓지 못한 마음과 끝난 뒤에도 남아 있는 감정을 표현합니다.' },
  { id: 'longing', label: 'Longing', labelKo: '그리움', description: '보고 싶은 마음과 잊지 못하는 감정을 중심으로 합니다.' },
  { id: 'waiting', label: 'Waiting', labelKo: '기다림', description: '오지 않는 사람이나 순간을 기다리는 마음을 담습니다.' },
  { id: 'reunion', label: 'Reunion', labelKo: '재회', description: '다시 만나는 순간의 감정과 변화를 표현합니다.' },
  { id: 'misunderstanding', label: 'Misunderstanding', labelKo: '오해', description: '엇갈린 말과 마음 때문에 생기는 거리감과 갈등을 담습니다.' },
  { id: 'reconciliation', label: 'Reconciliation', labelKo: '화해', description: '상처나 오해를 풀고 다시 다가가는 과정을 표현합니다.' },
  { id: 'friendship', label: 'Friendship', labelKo: '우정', description: '친구와의 관계와 소중한 순간을 표현합니다.' },
  { id: 'family', label: 'Family', labelKo: '가족', description: '가족과의 관계와 따뜻한 순간을 담습니다.' },

  // 감정 / 내면
  { id: 'loneliness', label: 'Loneliness', labelKo: '외로움', description: '혼자 남겨진 듯한 감정과 공허함을 담습니다.' },
  { id: 'regret', label: 'Regret', labelKo: '후회', description: '지나간 선택과 행동에 대한 아쉬움과 감정을 표현합니다.' },
  { id: 'reminiscence', label: 'Reminiscence', labelKo: '회상', description: '과거를 떠올리며 되짚는 기억의 흐름을 담습니다.' },
  { id: 'obsession', label: 'Obsession', labelKo: '집착', description: '강하게 매달리는 감정과 그로 인한 갈등을 표현합니다.' },
  { id: 'anger', label: 'Anger', labelKo: '분노', description: '억눌린 감정이 터져 나오는 강렬한 순간을 표현합니다.' },
  { id: 'anxiety', label: 'Anxiety', labelKo: '불안', description: '미래에 대한 불안과 흔들리는 감정을 담습니다.' },
  { id: 'hope', label: 'Hope', labelKo: '희망', description: '앞으로 나아가려는 기대와 긍정적인 감정을 표현합니다.' },
  { id: 'fate', label: 'Fate', labelKo: '운명', description: '정해진 인연과 흐름 속에서의 이야기를 담습니다.' },
  { id: 'comfort', label: 'Comfort', labelKo: '위로', description: '지친 마음을 달래고 위로하는 이야기를 담습니다.' },
  { id: 'safe_place', label: 'Safe Place', labelKo: '안식처', description: '편안하게 쉴 수 있는 공간과 마음을 표현합니다.' },
  { id: 'identity', label: 'Identity', labelKo: '자아', description: '자신을 돌아보고 정체성을 찾아가는 내면의 이야기입니다.' },
  { id: 'dream', label: 'Dream', labelKo: '꿈', description: '바라고 그리는 미래, 혹은 아직 닿지 못한 목표를 담습니다.' },
  { id: 'freedom', label: 'Freedom', labelKo: '자유', description: '속박에서 벗어나 자유를 느끼는 순간을 표현합니다.' },
  { id: 'wandering', label: 'Wandering', labelKo: '방황', description: '길을 잃은 듯 흔들리며 자신만의 방향을 찾는 이야기를 담습니다.' },
  { id: 'resistance', label: 'Resistance', labelKo: '저항', description: '무언가에 맞서 싸우는 의지와 감정을 담습니다.' },
  { id: 'endurance', label: 'Endurance', labelKo: '버팀', description: '무너지지 않기 위해 버티는 마음과 시간을 표현합니다.' },
  { id: 'growth', label: 'Growth', labelKo: '성장', description: '변화하고 발전해가는 과정을 담은 이야기입니다.' },
  { id: 'change', label: 'Change', labelKo: '변화', description: '익숙한 상태에서 벗어나 달라지는 순간과 감정을 담습니다.' },

  // 시간 / 기억
  { id: 'childhood', label: 'Childhood', labelKo: '어린시절', description: '어린 시절의 기억과 순수한 감정을 표현합니다.' },
  { id: 'youth', label: 'Youth', labelKo: '청춘', description: '청춘의 빛나는 순간과 고민을 담습니다.' },
  { id: 'hometown', label: 'Hometown', labelKo: '고향', description: '고향에 대한 기억과 그리움을 표현합니다.' },
  { id: 'memory', label: 'Memory', labelKo: '추억', description: '지나간 기억과 그 속의 감정을 중심으로 합니다.' },
  { id: 'time', label: 'Time', labelKo: '시간', description: '흐르는 시간 속에서 변화하는 감정을 담습니다.' },
  { id: 'season', label: 'Season', labelKo: '계절', description: '계절의 변화와 그에 따른 감정의 흐름을 표현합니다.' },
  { id: 'rain', label: 'Rain', labelKo: '비', description: '비와 함께 떠오르는 감정과 분위기를 담습니다.' },
  { id: 'night', label: 'Night', labelKo: '밤', description: '밤이라는 시간 속에서 일어나는 감정과 사건을 담습니다.' },
  { id: 'dawn', label: 'Dawn', labelKo: '새벽', description: '조용하고 고요한 새벽의 감정과 분위기를 표현합니다.' },

  // 일상 / 현실감
  { id: 'small_happiness', label: 'Small Happiness', labelKo: '소확행', description: '일상 속 작은 행복과 소소한 만족을 담은 이야기입니다.' },
  { id: 'weekend', label: 'Weekend', labelKo: '주말', description: '여유롭고 자유로운 주말의 순간을 그린 이야기입니다.' },
  { id: 'monday', label: 'Monday', labelKo: '월요일', description: '새로운 한 주의 시작과 그에 얽힌 피로감, 다짐, 현실감을 담습니다.' },
  { id: 'after_work', label: 'After Work', labelKo: '퇴근', description: '하루를 마치고 돌아가는 길에서 느껴지는 감정을 담습니다.' },
  { id: 'overtime', label: 'Overtime', labelKo: '야근', description: '늦은 시간까지 이어지는 일과 지친 마음, 웃픈 현실감을 표현합니다.' },
  { id: 'company_life', label: 'Company Life', labelKo: '회사생활', description: '직장 안에서 겪는 관계, 피로, 농담, 현실적인 감정을 담습니다.' },
  { id: 'eating_alone', label: 'Eating Alone', labelKo: '혼자밥', description: '혼자 보내는 식사 시간 속 외로움과 소소한 위안을 표현합니다.' },
  { id: 'drinking_party', label: 'Drinking Party', labelKo: '술자리', description: '술자리에서 풀리는 말과 감정, 관계의 어색함이나 솔직함을 담습니다.' },
  { id: 'gift', label: 'Gift', labelKo: '선물', description: '주고받는 마음과 의미를 담은 따뜻한 이야기입니다.' },

  // 장소 / 이동
  { id: 'city', label: 'City', labelKo: '도시', description: '도시 속 삶과 그 안에서의 감정과 장면을 담습니다.' },
  { id: 'alley', label: 'Alley', labelKo: '골목', description: '좁은 골목길에서 생기는 거리감과 생활감 있는 장면을 담습니다.' },
  { id: 'bus_stop', label: 'Bus Stop', labelKo: '정류장', description: '기다림과 지나가는 풍경이 겹치는 정류장의 순간을 표현합니다.' },
  { id: 'subway', label: 'Subway', labelKo: '지하철', description: '이동하는 사람들 속에서 느끼는 고독, 설렘, 현실감을 담습니다.' },
  { id: 'convenience_store', label: 'Convenience Store', labelKo: '편의점', description: '작은 생활 공간에서 마주치는 소소한 감정과 현실감을 표현합니다.' },
  { id: 'cafe', label: 'Cafe', labelKo: '카페', description: '카페에서의 여유롭고 감성적인 순간을 그린 이야기입니다.' },
  { id: 'room', label: 'Room', labelKo: '방', description: '혼자만의 방 안에서 떠오르는 생각과 감정을 담습니다.' },
  { id: 'walk', label: 'Walk', labelKo: '산책', description: '가볍게 걸으며 떠오르는 생각과 감정을 담은 이야기입니다.' },
  { id: 'drive', label: 'Drive', labelKo: '드라이브', description: '이동하는 시간 속에서 느껴지는 감정과 풍경을 담습니다.' },
  { id: 'travel', label: 'Travel', labelKo: '여행', description: '새로운 장소에서의 경험과 감정을 담습니다.' },
  { id: 'sea', label: 'Sea', labelKo: '바다', description: '넓은 바다 앞에서 느끼는 해방감, 그리움, 고요함을 표현합니다.' },
];

export const BASE_PROMPTS = [
  'Create a musically coherent, commercially usable song prompt with clear genre identity, tasteful arrangement, and emotionally consistent songwriting.',
  'Treat the selected genre as the root identity, selected styles as transformation layers, selected instrument/sound choices as arrangement guidance, and moods as emotional color.',
  'User free-text intent has the highest priority whenever it conflicts with default assumptions.'
];

export const BASIC_STRUCTURE =
  'Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro';

export const GENRE_HIERARCHY: GenreGroupItem[] = [
  {
    id: 'group_pop_global',
    label: 'Pop & Global',
    labelKo: '팝 & 글로벌',
    description: '전 세계적으로 사랑받는 대중적인 팝 사운드와 K-Pop, J-Pop 등 글로벌 스타일을 포함합니다.',
    children: [
      {
        id: 'pop',
        label: 'Pop',
        labelKo: '팝',
        description: '대중적인 멜로디와 세련된 편곡을 중심으로 전 세계적으로 사랑받는 음악 스타일입니다.',
        children: [
          { id: 'synth_pop', label: 'Synth Pop', labelKo: '신스팝', description: '80년대 복고풍 신디사이저 사운드와 몽환적인 멜로디가 특징인 팝 스타일입니다.' },
          { id: 'disco', label: 'Disco', labelKo: '디스코', description: '경쾌한 4분음표 비트와 펑키한 베이스 라인이 돋보이는 댄스 음악입니다.' },
          { id: 'electropop', label: 'Electropop', labelKo: '일렉트로팝', description: '전자음악의 질감과 팝의 대중적인 멜로디가 결합된 현대적인 스타일입니다.' },
          { id: 'teen_pop', label: 'Teen Pop', labelKo: '틴팝', description: '밝고 청량한 에너지와 중독성 있는 훅이 돋보이는 하이틴 감성의 팝입니다.' },
          { id: 'britpop', label: 'Britpop', labelKo: '브릿팝', description: '영국 밴드 특유의 멜로디와 자연스러운 사운드가 강조된 얼터너티브 록 스타일입니다.' },
          { id: 'indie_pop', label: 'Indie Pop', labelKo: '인디팝', description: '독창적인 감성과 부드러운 사운드로 나른하고 편안한 분위기를 만드는 팝입니다.' },
          { id: 'city_pop', label: 'City Pop', labelKo: '클래식 시티팝', description: '밤거리, 드라이브, 네온사인 같은 도시 장면에 잘 맞는 레트로 팝입니다. 부드러운 베이스, 펑키한 기타, 일렉트릭 피아노와 아날로그 신스가 세련된 그루브를 만듭니다.' },
          { id: 'funk_pop', label: 'Funk Pop', labelKo: '펑크팝', description: '리듬감 넘치는 베이스와 경쾌한 기타 커팅이 조화로운 팝 스타일입니다.' },
          { id: 'dance_pop', label: 'Dance Pop', labelKo: '댄스팝', description: '클럽 지향의 강렬한 비트와 화려한 코러스가 돋보이는 댄스 음악입니다.' },
          { id: 'acoustic_pop', label: 'Acoustic Pop', labelKo: '어쿠스틱팝', description: '어쿠스틱 기타와 피아노 중심의 담백하고 진솔한 감성을 담은 팝입니다.' },
          { id: 'alternative_pop', label: 'Alternative Pop', labelKo: '얼터너티브 팝', description: '대중적인 팝 구조에 독특한 사운드와 비정형 감성을 더한 팝입니다. 평범한 후렴보다 색다른 질감, 어두운 신스, 개성 있는 보컬 표현에 잘 어울립니다.' },
          { id: 'bedroom_pop', label: 'Bedroom Pop', labelKo: '베드룸 팝', description: '작은 방에서 녹음한 듯한 친밀하고 사적인 팝입니다. 로파이 질감, 가까운 보컬, 소박한 기타와 신스가 어울립니다.' },
          { id: 'dream_pop', label: 'Dream Pop', labelKo: '드림팝', description: '몽환적인 기타와 패드, 넓은 리버브가 흐릿한 꿈 같은 분위기를 만드는 팝입니다. 그리움, 밤, 회상 장면에 잘 맞습니다.' },
          { id: 'art_pop', label: 'Art Pop', labelKo: '아트팝', description: '팝의 멜로디를 유지하면서도 실험적인 구성과 독특한 사운드 디자인을 더한 장르입니다. 감각적이고 비정형적인 곡에 적합합니다.' },
          { id: 'y2k_pop', label: 'Y2K Pop', labelKo: 'Y2K 팝', description: '2000년대 초반의 반짝이는 디지털 팝 감성을 현대적으로 재해석한 스타일입니다. 통통 튀는 신스, 밝은 훅, 향수 어린 질감에 잘 어울립니다.' },
          { id: 'hyperpop', label: 'Hyperpop', labelKo: '하이퍼팝', description: '과장된 신스, 튀는 보컬 처리, 빠른 전개가 특징인 실험적 디지털 팝입니다. 과감하고 비현실적인 에너지에 적합합니다.' },
        ]
      },
      {
        id: 'kpop',
        label: 'K-Pop',
        labelKo: 'K-Pop',
        description: '세련된 아이돌 중심의 구조와 멜로디, 퍼포먼스를 강조한 현대적인 K-Pop 스타일입니다.',
        children: [
          { id: 'idol_dance', label: 'Idol Dance', labelKo: '아이돌 댄스', description: '강한 비트와 중독성 있는 훅, 퍼포먼스 중심의 에너지 넘치는 K-Pop 댄스 스타일입니다.' },
          { id: 'k_ballad', label: 'K-Ballad', labelKo: 'K-발라드', description: '한국적인 감정선과 호소력 짙은 보컬, 웅장한 스트링이 조화로운 발라드입니다.' },
          { id: 'k_synth_pop', label: 'K-Synth Pop', labelKo: 'K-신스팝', description: '세련된 K-Pop 감성에 복고풍 신스 사운드를 더한 몽환적인 스타일입니다.' },
          { id: 'k_trap', label: 'K-Trap', labelKo: 'K-트랩', description: '한국식 멜로디 훅과 트랩 리듬을 결합한 강한 힙합 팝입니다. 묵직한 808, 빠른 하이햇, 랩과 보컬의 대비, 어두운 무대 전환감에 잘 어울립니다.' },
          { id: 'k_new_jack_swing', label: 'K-New Jack Swing', labelKo: 'K-뉴잭스윙', description: '90년대 한국 가요의 향수를 불러일으키는 경쾌한 스윙 리듬의 음악입니다.' },
          { id: 'k_indie', label: 'K-Indie', labelKo: 'K-인디', description: '담백한 밴드 사운드와 생활감 있는 멜로디가 중심인 한국 인디 스타일입니다. 과하게 세련되기보다 자연스러운 음색, 말하듯 흐르는 보컬, 작은 공간감에 잘 맞습니다.' },
          { id: 'k_folk', label: 'K-Folk', labelKo: 'K-포크', description: '통기타 중심의 서정적인 선율과 진솔한 가사가 담긴 한국적 포크 음악입니다.' },
          { id: 'k_rock', label: 'K-Rock', labelKo: 'K-록', description: '시원한 밴드 사운드와 한국적인 멜로디가 결합된 에너제틱한 록 스타일입니다.' },
          { id: 'gugak_fusion', label: 'Gugak Fusion', labelKo: '국악 퓨전', description: '전통 국악기와 현대적인 사운드가 만나 새로운 조화를 이루는 퓨전 장르입니다.' },
          { id: 'k_indie_pop_2000s', label: '2000s K-Indie Pop', labelKo: '2000년대 K-인디팝', description: '2000년대 한국 인디팝 특유의 공기감 있는 여성 보컬, 산뜻한 밴드 사운드, 장난스럽지만 몽환적인 감성이 살아있는 스타일입니다.' },
          { id: 'k_band_pop', label: 'K-Band Pop', labelKo: 'K-밴드팝', description: '한국식 멜로디와 밴드 합주가 결합된 대중적인 밴드팝입니다. 기타, 베이스, 드럼이 또렷하고 보컬 훅이 중심이 됩니다.' },
          { id: 'k_rnb_pop', label: 'K-R&B Pop', labelKo: 'K-R&B 팝', description: '한국적인 멜로디 감성과 부드러운 R&B 그루브를 섞은 스타일입니다. 감성적인 보컬, 일렉피아노, 매끄러운 베이스에 잘 어울립니다.' },
        ]
      },
      {
        id: 'jpop',
        label: 'J-Pop',
        labelKo: 'J-Pop',
        description: '일본 특유의 섬세한 멜로디 라인과 다채로운 악기 구성이 돋보이는 대중음악입니다.',
        children: [
          { id: 'j_idol_pop', label: 'J-Idol Pop', labelKo: 'J-아이돌 팝', description: '밝고 활기찬 에너지와 하이톤의 멜로디가 돋보이는 일본 아이돌 스타일입니다.' },
          { id: 'shibuya_kei', label: 'Shibuya-kei', labelKo: '시부야계', description: '재즈, 보사노바, 라운지 음악이 섞인 세련되고 감각적인 시부야계 스타일입니다.' },
          { id: 'anime_rock', label: 'Anime Rock', labelKo: '애니메이션 록', description: '애니메이션 주제가 특유의 빠른 전개와 질주감 있는 밴드 사운드입니다.' },
          { id: 'j_city_pop', label: 'J-City Pop', labelKo: 'J-시티팝', description: '80년대 일본 시티팝의 펑키하고 도회적인 감성을 현대적으로 재해석한 스타일입니다.' },
          { id: 'visual_kei', label: 'Visual-kei', labelKo: '비주얼계', description: '화려한 비주얼과 드라마틱한 구성, 강렬한 록 사운드가 특징인 장르입니다.' },
          { id: 'utaite_style', label: 'Utaite Style', labelKo: '우타이테 스타일', description: '인터넷 문화 기반의 빠른 템포와 개성 넘치는 보컬 표현이 돋보이는 스타일입니다.' },
          { id: 'vocaloid_style', label: 'Vocaloid Style', labelKo: '보컬로이드 스타일', description: '디지털 보컬의 독특한 질감과 테크니컬한 팝 사운드가 결합된 장르입니다.' },
          { id: 'j_jazz_pop', label: 'J-Jazz Pop', labelKo: 'J-재즈팝', description: '여유로운 재즈 리듬에 일본 특유의 선율미를 더한 세련된 팝 스타일입니다.' },
          { id: 'j_electro', label: 'J-Electro', labelKo: 'J-일렉트로', description: '정교한 디지털 비트와 몽환적인 전자음이 어우러진 일본식 일렉트로닉입니다.' },
          { id: 'j_ballad', label: 'J-Ballad', labelKo: 'J-발라드', description: '섬세한 감정 표현과 서정적인 멜로디가 강조된 일본식 발라드입니다.' },
          { id: 'anisong_pop', label: 'Anisong Pop', labelKo: '애니송 팝', description: '애니메이션 오프닝처럼 선명한 멜로디와 빠른 감정 전환이 있는 팝입니다. 청량한 보컬, 힘 있는 후렴, 드라마틱한 코드 진행에 잘 맞습니다.' },
          { id: 'j_indie_pop', label: 'J-Indie Pop', labelKo: 'J-인디팝', description: '일본 인디 특유의 섬세한 기타, 맑은 보컬, 소박하지만 감각적인 멜로디가 중심인 스타일입니다.' },
        ]
      }
    ]
  },
  {
    id: 'group_hiphop_rnb',
    label: 'Hip-hop & R&B',
    labelKo: '힙합 & R&B',
    description: '강렬한 비트의 힙합과 감미로운 그루브의 R&B, 소울 음악을 아우르는 카테고리입니다.',
    children: [
      {
        id: 'hiphop',
        label: 'Hip-hop',
        labelKo: '힙합',
        description: '리듬 중심의 비트와 래핑을 통해 도시적인 감성과 에너지를 표현하는 장르입니다.',
        children: [
          { id: 'trap', label: 'Trap', labelKo: '트랩', description: '묵직한 808 베이스와 빠른 하이햇 롤이 주도하는 현대 힙합의 대표적인 스타일입니다.' },
          { id: 'drill', label: 'Drill', labelKo: '드릴', description: '어둡고 공격적인 분위기와 독특한 베이스 슬라이딩이 특징인 힙합 장르입니다.' },
          { id: 'boombap', label: 'Boom Bap', labelKo: '붐뱁', description: '90년대 황금기 힙합의 투박한 드럼 비트와 샘플링 기반의 클래식 스타일입니다.' },
          { id: 'lofi', label: 'Lo-fi', labelKo: '로파이', description: '거칠고 따뜻한 질감의 비트와 반복적인 루프로 편안한 분위기를 만드는 스타일입니다.' },
          { id: 'jazz_hiphop', label: 'Jazz Hip-hop', labelKo: '재즈힙합', description: '재즈의 부드러운 화성과 힙합의 리듬감이 만나 세련된 그루브를 형성합니다.' },
          { id: 'emo_rap', label: 'Emo Rap', labelKo: '이모랩', description: '우울하고 감성적인 멜로디와 힙합 비트가 결합된 내면적인 스타일입니다.' },
          { id: 'old_school', label: 'Old School', labelKo: '올드스쿨', description: '힙합 초창기의 펑키한 샘플링과 정석적인 리듬감이 돋보이는 장르입니다.' },
          { id: 'g_funk', label: 'G-Funk', labelKo: 'G-펑크', description: '미국 서부 힙합 특유의 나른한 그루브와 신시사이저 사운드가 특징입니다.' },
          { id: 'cloud_rap', label: 'Cloud Rap', labelKo: '클라우드 랩', description: '몽환적인 패드 사운드와 공간감 있는 비트로 부유하는 듯한 느낌을 줍니다.' },
          { id: 'melodic_rap', label: 'Melodic Rap', labelKo: '멜로딕 랩', description: '랩과 노래의 중간에 있는 멜로디 중심 랩입니다. 감정적인 훅, 오토튠 질감, 반복성 있는 플로우에 잘 어울립니다.' },
          { id: 'trap_soul', label: 'Trap Soul', labelKo: '트랩 소울', description: '트랩 비트와 R&B 보컬 감성이 결합된 어둡고 부드러운 스타일입니다. 낮은 808, 몽환 신스, 끈적한 보컬에 잘 맞습니다.' },
          { id: 'phonk', label: 'Phonk', labelKo: '퐁크', description: '거친 샘플, 어두운 베이스, 반복적인 드라이브감이 강한 힙합/전자음악 스타일입니다. 질주감과 다크한 에너지를 만들 때 적합합니다.' },
          { id: 'jersey_club_hiphop', label: 'Jersey Club Hip-hop', labelKo: '저지 클럽 힙합', description: '빠르게 튀는 킥 패턴과 반복 훅이 강한 클럽 기반 힙합입니다. 짧고 중독적인 보컬 샘플, 댄스 에너지에 잘 맞습니다.' },
        ]
      },
      {
        id: 'rnb',
        label: 'R&B',
        labelKo: '알앤비',
        description: '감미로운 보컬과 그루브 있는 리듬을 기반으로 깊은 감성을 전달하는 음악입니다.',
        children: [
          { id: 'contemporary_rnb', label: 'Contemporary R&B', labelKo: '컨템퍼러리 R&B', description: '매끄러운 보컬과 트렌디한 비트가 조화로운 현대적인 R&B 스타일입니다.' },
          { id: 'neo_soul', label: 'Neo Soul', labelKo: '네오 소울', description: '재즈와 소울, R&B가 결합된 지적이고 예술적인 깊이가 있는 그루브입니다.' },
          { id: 'soul', label: 'Soul', labelKo: '소울', description: '전통적인 소울 음악의 깊은 감성과 파워풀한 보컬이 중심인 스타일입니다.' },
          { id: 'funk', label: 'Funk', labelKo: '펑크', description: '베이스와 리듬 기타의 탄력 있는 그루브가 폭발하는 에너지 넘치는 장르입니다.' },
          { id: 'alternative_rnb', label: 'Alternative R&B', labelKo: '얼터너티브 R&B', description: '정통 R&B보다 더 어둡고 몽환적인 질감의 현대 R&B입니다. 느슨한 그루브, 공간감 있는 신스, 낮고 부드러운 보컬, 실험적인 비트에 잘 어울립니다.' },
          { id: 'new_jack_swing', label: 'New Jack Swing', labelKo: '뉴잭스윙', description: '힙합 비트와 알앤비 멜로디가 섞인 경쾌하고 리드미컬한 90년대 스타일입니다.' },
          { id: 'slow_jam', label: 'Slow Jam', labelKo: '슬로우 잼', description: '느린 템포와 끈적한 보컬 그루브가 중심인 R&B입니다. 밤, 고백, 가까운 거리감, 부드러운 베이스에 잘 어울립니다.' },
          { id: 'city_rnb', label: 'City R&B', labelKo: '시티 R&B', description: '도시적인 밤 분위기와 세련된 R&B 그루브가 결합된 스타일입니다. Rhodes, 서브 베이스, 부드러운 보컬에 잘 맞습니다.' },
          { id: 'uk_garage_rnb', label: 'UK Garage R&B', labelKo: 'UK 개러지 R&B', description: '쪼개지는 UK 개러지 리듬 위에 부드러운 R&B 보컬을 얹는 스타일입니다. 세련된 리듬감과 도시적인 질감이 특징입니다.' },
        ]
      }
    ]
  },
  {
    id: 'group_rock_band',
    label: 'Rock & Band',
    labelKo: '록 & 밴드',
    description: '에너지 넘치는 록 사운드부터 묵직한 메탈까지, 밴드 악기 중심의 강렬한 음악들을 제공합니다.',
    children: [
      {
        id: 'rock',
        label: 'Rock',
        labelKo: '록',
        description: '기타 중심의 강한 사운드와 밴드 합주를 통해 자유롭고 저항적인 에너지를 담아냅니다.',
        children: [
          { id: 'alternative_rock', label: 'Alternative Rock', labelKo: '얼터너티브 록', description: '정형화되지 않은 자유로운 구성과 감성적인 멜로디가 특징인 록 스타일입니다.' },
          { id: 'modern_rock', label: 'Modern Rock', labelKo: '모던 록', description: '세련된 밴드 사운드와 대중적인 감각이 조화로운 현대적인 록 장르입니다.' },
          { id: 'punk_rock', label: 'Punk Rock', labelKo: '펑크 록', description: '빠르고 직선적인 비트와 저항적인 에너지가 담긴 밴드 음악입니다.' },
          { id: 'hard_rock', label: 'Hard Rock', labelKo: '하드 록', description: '강렬한 기타 리프와 파워풀한 드럼이 주도하는 묵직한 에너지의 록입니다.' },
          { id: 'soft_rock', label: 'Soft Rock', labelKo: '소프트 록', description: '부드러운 선율과 편안한 밴드 사운드로 대중성을 강조한 록 스타일입니다.' },
          { id: 'garage_rock', label: 'Garage Rock', labelKo: '개러지 록', description: '거칠고 가공되지 않은 날 것 그대로의 에너지가 느껴지는 록 장르입니다.' },
          { id: 'shoegazing', label: 'Shoegazing', labelKo: '슈게이징', description: '두터운 기타 레이어와 깊은 리버브로 몽환적인 소리의 벽을 만드는 스타일입니다.' },
          { id: 'folk_rock', label: 'Folk Rock', labelKo: '포크 록', description: '포크의 서정적인 가사와 록의 밴드 사운드가 결합된 따뜻한 장르입니다.' },
          { id: 'blues_rock', label: 'Blues Rock', labelKo: '블루스 록', description: '블루스 특유의 끈적한 그루브와 록의 강렬함이 만난 스타일입니다.' },
          { id: 'indie_rock', label: 'Indie Rock', labelKo: '인디 록', description: '거칠지 않지만 개성 있는 기타 리프와 자연스러운 밴드감이 중심인 록입니다. 청춘, 도시, 밴드 라이브감에 잘 맞습니다.' },
          { id: 'emo_rock', label: 'Emo Rock', labelKo: '이모 록', description: '감정적인 보컬과 폭발하는 밴드 후렴이 특징인 록입니다. 불안, 고백, 청춘의 격한 감정에 적합합니다.' },
          { id: 'math_rock', label: 'Math Rock', labelKo: '매스 록', description: '복잡한 박자와 정교한 기타 패턴이 특징인 연주 중심 록입니다. 변칙적인 전개와 테크니컬한 밴드 사운드에 잘 맞습니다.' },
          { id: 'post_punk', label: 'Post-Punk', labelKo: '포스트 펑크', description: '차갑고 반복적인 베이스, 건조한 보컬, 어두운 기타 질감이 중심인 록입니다. 도시적 긴장감과 냉소적인 분위기에 적합합니다.' },
          { id: 'pop_punk', label: 'Pop Punk', labelKo: '팝 펑크', description: '펑크의 속도감과 팝의 선명한 멜로디가 결합된 밝고 직선적인 밴드 사운드입니다.' },
          { id: 'band_ballad', label: 'Band Ballad', labelKo: '밴드 발라드', description: '발라드의 감정선에 밴드 사운드가 더해진 스타일입니다. 기타와 드럼이 후반 감정 고조를 받쳐주는 곡에 잘 맞습니다.' },
        ]
      },
      {
        id: 'metal',
        label: 'Metal',
        labelKo: '메탈',
        description: '강렬한 디스토션 기타와 폭발적인 드럼 비트로 극대화된 에너지를 선사하는 장르입니다.',
        children: [
          { id: 'heavy_metal', label: 'Heavy Metal', labelKo: '헤비메탈', description: '강력한 기타 리프와 웅장한 사운드로 금속적인 에너지를 선사하는 장르입니다.' },
          { id: 'death_metal', label: 'Death Metal', labelKo: '데스메탈', description: '극단적으로 낮은 튜닝과 공격적인 비트로 어둡고 강렬한 에너지를 표현합니다.' },
          { id: 'thrash_metal', label: 'Thrash Metal', labelKo: '스래시메탈', description: '빠른 속도감과 정교한 기타 연주가 돋보이는 공격적인 메탈 스타일입니다.' },
          { id: 'metalcore', label: 'Metalcore', labelKo: '메탈코어', description: '헤비메탈의 묵직함과 하드코어 펑크의 에너지가 결합된 현대적 메탈입니다.' },
          { id: 'nu_metal', label: 'Nu Metal', labelKo: '뉴메탈', description: '힙합과 전자음악 요소가 섞인 리드미컬하고 묵직한 메탈 장르입니다.' },
          { id: 'symphonic_metal', label: 'Symphonic Metal', labelKo: '심포닉 메탈', description: '오케스트라와 오페라적인 요소가 가미된 웅장하고 서사적인 메탈입니다.' },
          { id: 'power_metal', label: 'Power Metal', labelKo: '파워 메탈', description: '빠른 템포와 멜로딕한 선율, 영웅적인 분위기가 특징인 메탈 스타일입니다.' },
        ]
      }
    ]
  },
  {
    id: 'group_edm_dance',
    label: 'Electronic & Dance',
    labelKo: '전자음악 & 댄스',
    description: '신디사이저와 디지털 비트가 주도하는 클럽 사운드와 현대적인 일렉트로닉 댄스 음악입니다.',
    children: [
      {
        id: 'edm',
        label: 'EDM',
        labelKo: 'EDM',
        description: '신디사이저와 디지털 비트가 주도하는 클럽 사운드로 현대적인 댄스 음악의 정수입니다.',
        children: [
          { id: 'house', label: 'House', labelKo: '하우스', description: '일정한 4/4 박자와 반복적인 그루브가 중심인 클럽 댄스 음악입니다.' },
          { id: 'techno', label: 'Techno', labelKo: '테크노', description: '기계적이고 반복적인 리듬으로 몰입감 있는 전자음악의 세계를 만듭니다.' },
          { id: 'trance', label: 'Trance', labelKo: '트랜스', description: '상승하는 선율과 몽환적인 분위기로 황홀경을 선사하는 전자음악입니다.' },
          { id: 'future_bass', label: 'Future Bass', labelKo: '퓨처 베이스', description: '감성적인 코드 진행과 현대적인 신스 사운드가 돋보이는 트렌디한 장르입니다.' },
          { id: 'dubstep', label: 'Dubstep', labelKo: '덥스텝', description: '강렬한 베이스 변형과 파괴적인 드롭이 특징인 공격적인 전자음악입니다.' },
          { id: 'deep_house', label: 'Deep House', labelKo: '딥 하우스', description: '차분하고 세련된 분위기와 깊이 있는 베이스 라인이 특징인 하우스입니다.' },
          { id: 'tropical_house', label: 'Tropical House', labelKo: '트로피컬 하우스', description: '여유롭고 시원한 분위기의 신스 사운드가 돋보이는 하우스 스타일입니다.' },
          { id: 'eurobeat', label: 'Eurobeat', labelKo: '유로비트', description: '빠른 템포와 강렬한 멜로디로 질주감을 선사하는 댄스 음악입니다.' },
          { id: 'drum_and_bass', label: 'Drum & Bass', labelKo: '드럼앤베이스', description: '빠른 브레이크비트와 묵직한 베이스가 주도하는 에너제틱한 장르입니다.' },
          { id: 'synthwave', label: 'Synthwave', labelKo: '신스웨이브', description: '80년대 영화와 게임을 떠올리게 하는 아날로그 신스 중심의 전자음악입니다. 네온, 밤 드라이브, 레트로 SF에 잘 어울립니다.' },
          { id: 'darkwave', label: 'Darkwave', labelKo: '다크웨이브', description: '차가운 신스와 어두운 분위기가 중심인 전자/고딕 계열 스타일입니다. 냉정함, 밤, 디스토피아 장면에 적합합니다.' },
          { id: 'breakbeat_electronic', label: 'Breakbeat', labelKo: '브레이크비트 일렉트로닉', description: '끊어지는 드럼 루프와 불규칙한 리듬감이 특징인 전자음악입니다. 긴장감 있는 전개와 리듬 변주에 잘 맞습니다.' },
          { id: 'uk_garage', label: 'UK Garage', labelKo: 'UK 개러지', description: '튕기는 드럼과 쪼개지는 리듬이 세련된 클럽 감각을 만드는 장르입니다. 도시적인 밤, 가벼운 그루브, R&B 보컬과 잘 어울립니다.' },
          { id: 'future_garage', label: 'Future Garage', labelKo: '퓨처 개러지', description: 'UK 개러지 리듬에 몽환적인 패드와 감성적인 공간감을 더한 장르입니다. 새벽, 비 오는 도시, 고독한 감정에 잘 맞습니다.' },
          { id: 'glitch_pop', label: 'Glitch Pop', labelKo: '글리치 팝', description: '깨지는 전자음과 팝 멜로디가 결합된 실험적 장르입니다. 디지털 오류, 사이버 장면, 독특한 보컬 처리에 적합합니다.' },
          { id: 'hardstyle', label: 'Hardstyle', labelKo: '하드스타일', description: '강한 킥과 공격적인 신스 리드가 폭발하는 고에너지 전자음악입니다. 페스티벌, 질주감, 강한 드롭에 잘 맞습니다.' },
        ]
      }
    ]
  },
  {
    id: 'group_jazz_classical',
    label: 'Jazz & Classical',
    labelKo: '재즈 & 클래식',
    description: '예술적 깊이가 있는 재즈의 즉흥성과 클래식의 우아한 선율을 담은 고품격 음악 카테고리입니다.',
    children: [
      {
        id: 'jazz',
        label: 'Jazz',
        labelKo: '재즈',
        description: '즉흥 연주와 독특한 화성 체계를 통해 지적이고 세련된 분위기를 자아내는 음악입니다.',
        children: [
          { id: 'swing_jazz', label: 'Swing Jazz', labelKo: '스윙 재즈', description: '경쾌한 스윙 리듬과 빅밴드의 화려한 합주가 돋보이는 고전 재즈입니다.' },
          { id: 'bossa_nova', label: 'Bossa Nova', labelKo: '보사노바', description: '브라질 리듬과 재즈 화성이 만나 부드럽고 나른한 분위기를 만드는 장르입니다.' },
          { id: 'fusion_jazz', label: 'Fusion Jazz', labelKo: '퓨전 재즈', description: '록, 펑크, 전자음악 등 다양한 장르와 결합된 현대적인 재즈 스타일입니다.' },
          { id: 'cool_jazz', label: 'Cool Jazz', labelKo: '쿨 재즈', description: '절제된 감정과 차분하고 지적인 분위기가 돋보이는 세련된 재즈입니다.' },
          { id: 'big_band', label: 'Big Band', labelKo: '빅밴드', description: '웅장한 관악 편성과 화려한 앙상블이 특징인 클래식 재즈 스타일입니다.' },
          { id: 'latin_jazz', label: 'Latin Jazz', labelKo: '라틴 재즈', description: '열정적인 라틴 리듬과 재즈의 즉흥 연주가 어우러진 에너제틱한 장르입니다.' },
          { id: 'jazz_vocal', label: 'Jazz Vocal', labelKo: '재즈 보컬', description: '재즈 특유의 창법과 감성이 담긴 매력적인 보컬 중심의 음악입니다.' },
          { id: 'hard_bop', label: 'Hard Bop', labelKo: '하드 밥', description: '블루스와 가스펠의 영향으로 더욱 묵직하고 소울풀해진 재즈 스타일입니다.' },
          { id: 'smooth_jazz', label: 'Smooth Jazz', labelKo: '스무스 재즈', description: '부드러운 색소폰, 일렉피아노, 여유로운 리듬이 중심인 세련된 재즈입니다. 라운지, 밤, 드라이브 장면에 잘 어울립니다.' },
          { id: 'lounge_jazz', label: 'Lounge Jazz', labelKo: '라운지 재즈', description: '칵테일 바나 호텔 라운지처럼 차분하고 고급스러운 분위기의 재즈입니다. 보사노바, 피아노, 브러시 드럼과 잘 맞습니다.' },
          { id: 'nu_jazz', label: 'Nu Jazz', labelKo: '누 재즈', description: '재즈 화성에 전자음악과 힙합 비트를 섞은 현대적 재즈입니다. 세련된 도시감과 실험적인 그루브에 적합합니다.' },
          { id: 'jazz_ballad', label: 'Jazz Ballad', labelKo: '재즈 발라드', description: '느린 템포의 재즈 화성과 감성적인 보컬이 중심인 발라드입니다. 쓸쓸한 밤, 바, 회상 장면에 잘 어울립니다.' },
        ]
      },
      {
        id: 'classical',
        label: 'Classical',
        labelKo: '클래식',
        description: '우아한 선율과 웅장한 오케스트레이션으로 깊은 예술적 감동을 주는 전통 음악입니다.',
        children: [
          { id: 'full_orchestra', label: 'Full Orchestra', labelKo: '풀 오케스트라', description: '수많은 악기가 어우러져 만드는 웅장하고 깊이 있는 클래식 사운드입니다.' },
          { id: 'piano_solo_classical', label: 'Piano Solo', labelKo: '피아노 독주', description: '피아노 한 대로 표현하는 섬세하고 우아한 클래식 독주곡입니다.' },
          { id: 'string_ensemble_classical', label: 'String Ensemble', labelKo: '현악 합주', description: '현악기들의 조화로운 울림으로 서정적이고 아름다운 선율을 만듭니다.' },
          { id: 'choral', label: 'Choral', labelKo: '합창', description: '인간의 목소리가 만드는 성스럽고 웅장한 하모니의 합창 음악입니다.' },
          { id: 'baroque', label: 'Baroque', labelKo: '바로크', description: '화려한 장식음과 정교한 대위법이 돋보이는 고전 음악 스타일입니다.' },
          { id: 'opera', label: 'Opera', labelKo: '오페라', description: '음악과 극이 결합된 종합 예술로 극적인 보컬과 선율이 특징입니다.' },
          { id: 'neoclassical', label: 'Neo Classical', labelKo: '네오클래식', description: '클래식 악기와 현대적인 미니멀 감성을 결합한 연주 중심 장르입니다. 피아노, 현악, 잔잔한 서사에 잘 맞습니다.' },
          { id: 'modern_classical', label: 'Modern Classical', labelKo: '모던 클래식', description: '전통 클래식의 형식을 현대적인 화성과 공간감으로 재해석한 장르입니다. 영화적이면서도 절제된 분위기에 적합합니다.' },
          { id: 'cinematic_piano', label: 'Cinematic Piano', labelKo: '시네마틱 피아노', description: '피아노를 중심으로 장면의 감정선을 크게 만드는 연주 스타일입니다. 드라마틱한 회상, 독백, 엔딩 장면에 잘 어울립니다.' },
          { id: 'chamber_orchestra', label: 'Chamber Orchestra', labelKo: '체임버 오케스트라', description: '소규모 현악과 목관 중심의 섬세한 오케스트라 사운드입니다. 웅장함보다 가까운 감정과 우아함을 표현합니다.' },
        ]
      }
    ]
  },
  {
    id: 'group_folk_world',
    label: 'Folk & World',
    labelKo: '포크 & 월드',
    description: '어쿠스틱 악기의 따뜻한 감성과 세계 각국의 전통적인 색채를 담은 이국적인 음악들입니다.',
    children: [
      {
        id: 'acoustic_folk',
        label: 'Acoustic/Folk',
        labelKo: '어쿠스틱/포크',
        description: '어쿠스틱 악기의 따뜻한 질감과 진솔한 가사로 편안한 감성을 전달하는 스타일입니다.',
        children: [
          { id: 'traditional_folk', label: 'Traditional Folk', labelKo: '정통 포크', description: '소박한 악기 구성과 삶의 이야기가 담긴 정통 포크 스타일입니다.' },
          { id: 'country', label: 'Country', labelKo: '컨트리', description: '미국 남부의 정서와 소박한 멜로디가 담긴 친숙한 음악 장르입니다.' },
          { id: 'bluegrass', label: 'Bluegrass', labelKo: '블루그래스', description: '빠른 현악기 연주와 화음이 돋보이는 전통적인 컨트리 스타일입니다.' },
          { id: 'singer_songwriter', label: 'Singer-Songwriter', labelKo: '싱어송라이터', description: '자신의 이야기를 직접 쓰고 노래하는 진솔한 감성의 음악입니다.' },
          { id: 'acoustic_session', label: 'Acoustic Session', labelKo: '어쿠스틱 세션', description: '가공되지 않은 순수한 악기 소리로 편안한 분위기를 만드는 세션입니다.' },
          { id: 'fingerstyle', label: 'Fingerstyle', labelKo: '핑거스타일', description: '기타 한 대로 멜로디와 리듬을 동시에 표현하는 테크니컬한 연주입니다.' },
          { id: 'modern_folk', label: 'Modern Folk', labelKo: '모던 포크', description: '전통 포크의 담백함에 현대적인 편곡과 보컬 감성을 더한 장르입니다. 작은 방, 일기 같은 가사, 담담한 고백에 잘 어울립니다.' },
          { id: 'indie_folk', label: 'Indie Folk', labelKo: '인디 포크', description: '소박한 어쿠스틱 악기와 개인적인 가사가 중심인 포크입니다. 자연스러운 보컬과 따뜻한 공간감에 적합합니다.' },
        ]
      },
      {
        id: 'world_music_folk',
        label: 'World Music',
        labelKo: '월드 뮤직',
        description: '세계 각국의 전통적인 색채와 이국적인 리듬이 어우러진 독특한 음악군입니다.',
        children: [
          { id: 'reggae', label: 'Reggae', labelKo: '레게', description: '자메이카 특유의 여유로운 리듬과 긍정적인 메시지가 담긴 장르입니다.' },
          { id: 'afrobeat', label: 'Afrobeat', labelKo: '아프로비트', description: '아프리카 리듬과 펑크, 재즈가 결합된 에너제틱한 월드 뮤직입니다.' },
          { id: 'celtic', label: 'Celtic', labelKo: '켈틱', description: '아일랜드와 스코틀랜드 전통의 신비롭고 서정적인 선율이 특징입니다.' },
          { id: 'latin_salsa', label: 'Latin (Salsa)', labelKo: '라틴(살사)', description: '열정적인 리듬과 화려한 브라스가 주도하는 라틴 댄스 음악입니다.' },
          { id: 'flamenco', label: 'Flamenco', labelKo: '플라멩코', description: '스페인 전통의 강렬한 기타 연주와 열정적인 감성이 담긴 장르입니다.' },
          { id: 'reggaeton', label: 'Reggaeton', labelKo: '레게톤', description: '반복적인 뎀보 리듬과 라틴 팝 감성이 결합된 댄스 장르입니다. 중독적인 훅과 여름, 클럽, 파티 장면에 잘 맞습니다.' },
          { id: 'latin_pop', label: 'Latin Pop', labelKo: '라틴 팝', description: '라틴 리듬과 팝 멜로디가 결합된 밝고 뜨거운 스타일입니다. 기타, 퍼커션, 경쾌한 후렴에 잘 어울립니다.' },
          { id: 'afro_pop', label: 'Afro Pop', labelKo: '아프로 팝', description: '아프리카 리듬의 탄력과 팝 멜로디가 만난 장르입니다. 부드러운 그루브, 밝은 기타, 리듬감 있는 보컬에 적합합니다.' },
          { id: 'indian_fusion', label: 'Indian Fusion', labelKo: '인도 퓨전', description: '시타르, 타블라 같은 인도 악기와 현대 비트를 결합한 월드 퓨전입니다. 신비로운 선율과 리듬 변주에 잘 맞습니다.' },
          { id: 'middle_eastern', label: 'Middle Eastern', labelKo: '중동 음악', description: '우드, 두둑, 프레임드럼 같은 중동 악기의 이국적인 선율과 리듬을 중심으로 한 장르입니다. 신비롭고 건조한 사막의 분위기에 적합합니다.' },
          { id: 'japanese_folk', label: 'Japanese Folk', labelKo: '일본 포크', description: '샤쿠하치, 고토 등 일본 전통 악기의 섬세한 선율과 담백한 포크 감성을 결합한 스타일입니다.' },
          { id: 'pansori_fusion', label: 'Pansori Fusion', labelKo: '판소리 퓨전', description: '판소리의 극적인 발성과 현대적인 비트나 밴드 사운드를 결합한 한국적 퓨전 장르입니다. 서사와 캐릭터성이 강한 곡에 잘 맞습니다.' },
        ]
      }
    ]
  },
  {
    id: 'group_trot_adult',
    label: 'Trot & Adult Gayo',
    labelKo: '트로트 & 성인가요',
    description: '한국 특유의 정서와 흥이 담긴 트로트와 전 세대가 즐길 수 있는 성인 가요 스타일입니다.',
    children: [
      {
        id: 'trot',
        label: 'Trot',
        labelKo: '트로트',
        description: '한국 고유의 꺾기와 리듬감을 바탕으로 전 세대가 즐길 수 있는 친숙한 장르입니다.',
        children: [
          { id: 'traditional_trot', label: 'Traditional Trot', labelKo: '정통 트로트', description: '트로트 고유의 깊은 꺾기와 애절한 감성이 살아있는 정통 스타일입니다.' },
          { id: 'semi_trot', label: 'Semi-Trot', labelKo: '세미 트로트', description: '현대적인 감각과 대중적인 리듬이 더해진 친숙한 트로트 장르입니다.' },
          { id: 'disco_trot', label: 'Disco Trot', labelKo: '디스코 트로트', description: '경쾌한 디스코 비트와 트로트가 만나 흥겨움을 극대화한 스타일입니다.' },
          { id: 'rock_trot', label: 'Rock Trot', labelKo: '락 트로트', description: '강렬한 록 사운드와 트로트의 창법이 결합된 에너제틱한 장르입니다.' },
          { id: 'ballad_trot', label: 'Ballad Trot', labelKo: '발라드 트로트', description: '서정적인 발라드 선율에 트로트의 감성을 담은 애틋한 스타일입니다.' },
          { id: 'blues_trot', label: 'Blues Trot', labelKo: '블루스 트로트', description: '블루지한 그루브와 트로트의 꺾기가 만나 독특한 분위기를 만듭니다.' },
          { id: 'shuffle_trot', label: 'Shuffle Trot', labelKo: '셔플 트로트', description: '경쾌한 셔플 리듬을 바탕으로 밝고 즐거운 분위기를 선사합니다.' },
          { id: 'gugak_trot', label: 'Gugak Trot', labelKo: '국악 트로트', description: '국악적인 요소와 트로트가 결합되어 한국적인 색채를 강조한 장르입니다.' },
        ]
      },
      {
        id: '7080_gayo',
        label: '7080 Gayo',
        labelKo: '7080 가요',
        description: '70~80년대 한국 가요 특유의 아날로그 복고 감성과 향수를 담은 음악입니다.',
        children: [
          { id: '7080_folk', label: '7080 Folk', labelKo: '7080 포크', description: '70~80년대 통기타 시대를 상징하는 순수하고 서정적인 포크 음악입니다.' },
          { id: 'adult_ballad', label: 'Adult Ballad', labelKo: '성인 발라드', description: '성인층이 공감할 수 있는 깊은 감성과 인생의 이야기를 담은 발라드입니다.' },
          { id: 'campus_band_sound', label: 'Campus Band Sound', labelKo: '캠퍼스 밴드 사운드', description: '대학 가요제 시절의 풋풋함과 열정이 담긴 밴드 사운드입니다.' },
          { id: 'enka_style', label: 'Enka Style', labelKo: '엔카 스타일', description: '일본 엔카 특유의 애절한 감성과 선율이 반영된 성인 가요 스타일입니다.' },
        ]
      }
    ]
  },
  {
    id: 'group_cinematic_bgm',
    label: 'Cinematic & BGM',
    labelKo: '시네마틱 & 배경음악',
    description: '영화나 드라마의 서사를 완성하는 배경음악과 공간의 분위기를 채우는 기능성 사운드입니다.',
    children: [
      {
        id: 'ost',
        label: 'OST',
        labelKo: 'OST',
        description: '영화나 드라마의 서사를 완성하며 극적인 분위기와 몰입감을 높여주는 배경음악입니다.',
        children: [
          { id: 'orchestral_score', label: 'Orchestral Score', labelKo: '오케스트럴 스코어', description: '오케스트라의 웅장한 사운드로 극의 서사와 감동을 완성하는 배경음악입니다.' },
          { id: 'hybrid_epic', label: 'Hybrid Epic', labelKo: '하이브리드 에픽', description: '전자음과 오케스트라가 결합된 압도적이고 웅장한 스케일의 사운드입니다.' },
          { id: 'synth_score', label: 'Synth Score', labelKo: '신시사이저 스코어', description: '신시사이저의 독특한 질감으로 미래적이거나 긴장감 있는 분위기를 만듭니다.' },
          { id: 'piano_solo', label: 'Piano Solo', labelKo: '피아노 솔로', description: '피아노의 맑고 섬세한 선율로 장면의 감성을 극대화하는 연주곡입니다.' },
          { id: 'string_ensemble', label: 'String Ensemble', labelKo: '스트링 합주', description: '현악기들의 조화로운 울림으로 서정적이고 극적인 분위기를 연출합니다.' },
          { id: 'chiptune', label: 'Chiptune', labelKo: '칩튠', description: '8비트 게임기 사운드로 레트로하고 귀여운 분위기를 자아내는 음악입니다.' },
          { id: 'world_music', label: 'World Music', labelKo: '월드 뮤직', description: '이국적인 악기와 선율로 특정 지역이나 문화의 분위기를 표현합니다.' },
          { id: 'minimalism', label: 'Minimalism', labelKo: '미니멀리즘', description: '단순한 패턴의 반복과 절제로 세련되고 집중력 있는 분위기를 만듭니다.' },
          { id: 'ambient', label: 'Ambient', labelKo: '앰비언트', description: '멜로디보다 공간, 질감, 잔향을 중심으로 분위기를 만드는 음악입니다. 공부, 명상, 심해, 우주, 새벽 같은 장면을 배경처럼 깔아줄 때 잘 맞습니다.' },
          { id: 'fantasy_bgm', label: 'Fantasy BGM', labelKo: '판타지 BGM', description: '벨, 패드, 코러스 질감으로 마법적이고 환상적인 공간을 만드는 배경음악입니다. 동화, 마법, 모험 장면에 잘 맞습니다.' },
          { id: 'dark_fantasy', label: 'Dark Fantasy', labelKo: '다크 판타지', description: '어두운 현악, 낮은 드론, 신비로운 코러스가 결합된 판타지 음악입니다. 불길한 성, 저주, 마법 전투 장면에 적합합니다.' },
          { id: 'mystery_bgm', label: 'Mystery BGM', labelKo: '미스터리 BGM', description: '작은 피아노, 서늘한 패드, 미세한 효과음으로 의문과 긴장감을 만드는 배경음악입니다.' },
          { id: 'sci_fi_score', label: 'Sci-Fi Score', labelKo: 'SF 스코어', description: '차가운 신스, 우주적인 패드, 기계적 리듬으로 미래적 장면을 만드는 음악입니다. 우주, AI, 사이버 세계에 잘 맞습니다.' },
          { id: 'horror_ambience', label: 'Horror Ambience', labelKo: '호러 앰비언스', description: '낮은 드론, 불안한 노이즈, 갑작스러운 임팩트로 공포감을 만드는 배경음악입니다.' },
          { id: 'lofi_study', label: 'Lo-Fi Study', labelKo: '로파이 스터디', description: '부드러운 로파이 드럼과 따뜻한 피아노, 테이프 노이즈가 공부나 작업에 어울리는 편안한 반복감을 만듭니다.' },
          { id: 'cafe_bgm', label: 'Cafe BGM', labelKo: '카페 BGM', description: '부드러운 피아노, 기타, 라이트 재즈 리듬으로 카페처럼 편안하고 집중하기 좋은 분위기를 만듭니다.' },
          { id: 'nature_ambience', label: 'Nature Ambience', labelKo: '자연 앰비언스', description: '숲, 바람, 물소리 같은 자연 배경음과 부드러운 패드가 어우러진 편안한 음악입니다.' },
          { id: 'healing_piano', label: 'Healing Piano', labelKo: '힐링 피아노', description: '단순하고 따뜻한 피아노 선율로 안정감과 위로를 주는 연주 중심 음악입니다.' },
          { id: 'epic_trailer', label: 'Epic Trailer', labelKo: '에픽 트레일러', description: '강한 타악, 브라스, 스트링 빌드업으로 영화 예고편 같은 거대한 클라이맥스를 만드는 음악입니다.' },
        ]
      }
    ]
  }
];
/* ===================== MID GENRE PROMPTS ===================== */

export const MID_GENRE_PROMPTS: Record<
  string,
  {
    style: string;
    sound: string;
    vocal: string;
  }
> = {
  pop: {
    style: "Modern Global Pop, Radio-friendly style", // 빌보드 지향의 세련되고 대중적인 스타일 정의
    sound: "Layered synths, Electric guitar, Polished pop drums", // 정교한 신스 레이어와 깔끔하게 정돈된 드럼 사운드
    vocal: "Clear melodic delivery, Professional pop vocal tone", // 가사 전달력이 명확하고 매끄러운 팝 전문 창법
  },
  kpop: {
    style: "Modern K-Pop, Korean Idol Production style", // 한국 아이돌 특유의 화려하고 정교한 제작 방식 강조
    sound: "Polished hybrid beats, Clean digital synths", // 전자음과 리얼 악기가 결합된 입체적이고 세련된 질감
    vocal: "Expressive Korean vocals, Dynamic and melodic phrasing", // 한국적 감정선과 리드미컬한 선율 강조
  },
  jpop: {
    style: "Modern J-Pop, Japanese Pop aesthetic", // 제이팝 특유의 청량하고 복잡한 구성의 미학 반영
    sound: "Bright digital synths, Fast-paced arrangement, J-pop guitar", // 하이톤의 디지털 신스와 빠른 속도의 악기 배치
    vocal: "Clear J-pop style tone, Bright and energetic delivery", // 맑고 선명하며 에너지가 넘치는 일본식 창법
  },
  hiphop: {
    style: "Urban Hip-hop, Street Style, Modern Rap energy", // 도시적인 거리 감성과 현대적인 힙합 에너지 정의
    sound: "Heavy 808 bass, Punchy snare, Deep low-end groove", // 가슴을 울리는 808 베이스와 타격감 있는 스네어 비트
    vocal: "Rhythmic rap flow, Confident and charismatic delivery", // 박자감이 살아있는 플로우와 자신감 넘치는 전달력
  },
  rnb: {
    style: "Contemporary R&B, Smooth Soul vibe", // 매끄럽고 부드러운 현대 알앤비와 소울의 분위기
    sound: "Electric piano, Silky bassline, Groovy R&B percussion", // 일렉 피아노의 따뜻함과 부드러운 베이스 라인의 조화
    vocal: "Soulful and smooth vocals, R&B riffs and runs", // 소울풀한 감성과 화려한 보컬 기교(애드리브) 강조
  },
  trot: {
    style: "Authentic Korean Trot, Adult Contemporary", // 한국 정통 트로트의 리듬과 성인 가요 스타일 고정
    sound: "Accordion-led arrangement with subtle melancholic string ensemble", // 아코디언과 화려한 관악기가 주도하는 특유의 비트
    vocal: "Deep vibrato, Crying vocal style, Restrained and intimate", // 정통 트로트 비브라토와 꺾기 창법 명시
  },
  "7080_gayo": {
    style: "7080 Korean Retro Pop, Nostalgic Gayo style", // 70~80년대 한국 가요의 아날로그 복고 감성
    sound: "Acoustic guitar, Vintage Organ, Analog warm texture", // 통기타와 빈티지 오르간의 따뜻하고 포근한 질감
    vocal: "Warm and nostalgic storytelling tone, Sincere delivery", // 이야기를 들려주는 듯한 따뜻하고 진솔한 창법
  },
  ost: {
    style: "Cinematic Score, Dramatic Soundtrack vibe", // 영화나 드라마의 서사적이고 극적인 배경음악 스타일
    sound: "Orchestral strings, Grand piano, Atmospheric pads", // 웅장한 현악기와 공간감이 풍부한 피아노 사운드
    vocal: "Emotional and atmospheric textures, Cinematic phrasing", // 감정이 깊게 배어 있는 몽환적이고 영화적인 보컬
  },
  rockmetal: {
    style: "Rock and Metal, High Energy Band Sound", // 강력한 에너지의 밴드 합주와 록의 거친 느낌 정의
    sound: "Distorted electric guitar, Driving bass, Power drums", // 왜곡된 일렉 기타 사운드와 폭발적인 드럼 비트
    vocal: "Powerful and raw tone, Intense rock delivery", // 파워풀하고 날 것 그대로의 거친 가창 스타일
  },
  edm: {
    style: "Electronic Dance Music, Festival Energy", // 축제와 클럽 지향의 강력한 전자 댄스 음악
    sound: "Lead synths, Heavy sub-bass, Digital dance percussion", // 강렬한 신스 리드와 바닥을 치는 저음역대 사운드
    vocal: "Processed vocal textures, Energetic and rhythmic delivery", // 보정된 기계적 질감과 에너지가 넘치는 창법
  },
  jazz: {
    style: "Sophisticated Jazz, Classic Lounge style", // 지적이고 세련된 라운지 및 클래식 재즈 분위기
    sound: "Upright bass, Jazz piano, Brushed drums, Saxophone", // 콘트라베이스와 브러쉬 드럼 등 재즈 전용 악기 구성
    vocal: "Jazzy phrasing, Laid-back and rhythmic delivery", // 박자를 여유롭게 밀고 당기는 재즈 특유의 가창
  },
  classical: {
    style: "Classical Orchestral, Symphonic style", // 서양 고전 음악의 정중하고 장엄한 심포니 스타일
    sound: "Full symphonic orchestra, Grand piano, Woodwinds", // 풀 오케스트라와 그랜드 피아노의 협연 사운드
    vocal: "Classical technique, Formal and elegant vocal style", // 성악적 기교가 담긴 격조 있고 우아한 창법
  },
  acoustic: {
    style: "Pure Acoustic, Folk and Singer-songwriter style", // 인위적 가공을 뺀 순수한 포크와 싱어송라이터 스타일
    sound: "Steel-string acoustic guitar, Organic percussion", // 찰랑거리는 어쿠스틱 기타와 자연스러운 타악기 소리
    vocal: "Natural and pure tone, Sincere acoustic delivery", // 꾸밈없고 맑은 목소리의 진솔한 가창
  },
  world: {
    style: "Global World Music, Ethnic Fusion style", // 세계 각국의 민속적 색채와 현대적 퓨전 스타일의 조화
    sound: "Traditional ethnic instruments, Native percussion", // 이국적인 전통 악기들과 민속적인 타악 리듬
    vocal: "Traditional native phrasing, Ethnic vocal style", // 특정 지역 고유의 창법과 이국적인 음색 강조
  },
};
export const SUB_GENRE_PROMPTS: Record<
  string,
  {
    style?: string;
    sound?: string;
    vocal?: string;
  }
> = {
  /* ===================== 1. Pop & Global (ID 소문자 통일) ===================== */
  synth_pop: { 
    style: "80s Retro Synth-pop Style", 
    sound: "Vintage analog synths, DX7 bells, Classic drum machine", 
    vocal: "Reverb-drenched, Ethereal pop tone" 
  }, // 80년대 복고풍 신스 사운드와 몽환적인 보컬 강조
  disco: { 
    style: "Modern Nu-Disco, Groovy Dance", 
    sound: "Funky slap bass, Four-on-the-floor beat", 
    vocal: "High-pitched rhythmic delivery, Falsetto" 
  }, // 디스코 특유의 슬랩 베이스와 고음 가성 창법 강조
  electropop: { 
    style: "Electronic Pop, Digital Style", 
    sound: "Heavy saw synths, Glitchy textures", 
    vocal: "Processed vocals, Auto-tuned vibe" 
  }, // 강렬한 전자음과 오토튠 등 기계적인 보컬 질감
  teen_pop: { 
    style: "Bubblegum Teen-pop, Upbeat", 
    sound: "Bright handclaps, Sweet catchy melodies", 
    vocal: "Youthful, Energetic, Sweet pop tone" 
  }, // 하이틴 스타일의 밝고 청량한 사운드와 에너지
  britpop: { 
    style: "UK Indie Rock, 90s Britpop", 
    sound: "Strummed electric guitar, Raw band sound", 
    vocal: "Raw, Casual UK style delivery" 
  }, // 90년대 영국 밴드 특유의 거칠고 자연스러운 창법
  indie_pop: { 
    style: "Lo-fi Indie Pop, Dreamy Style", 
    sound: "Mellow guitar, Reverb-drenched pads", 
    vocal: "Breathy, Soft, Whispering tone" 
  }, // 나른하고 부드러운 로파이 인디 감성
  city_pop: { 
    style: "Urban City Pop, 80s Nostalgia", 
    sound: "Fretless bass, Sophisticated jazz chords", 
    vocal: "Sophisticated, Smooth delivery" 
  }, // 도회적이고 세련된 80년대 라운지 사운드
  funk_pop: { 
    style: "Funk-driven Pop, Rhythmic Style", 
    sound: "Slap bass, Rhythmic guitar scratching", 
    vocal: "Syncopated phrasing, Rhythmic ad-libs" 
  }, // 펑키한 베이스 리듬과 박자를 쪼개는 창법
  dance_pop: { 
    style: "Club Dance Pop, High Energy", 
    sound: "Heavy kick drum, Side-chained synths", 
    vocal: "Powerful, Tuned, Wide-stereo harmonies" 
  }, // 클럽 지향의 강렬한 비트와 화려한 코러스 화음
  acoustic_pop: { 
    style: "Unplugged Acoustic Pop, Soft", 
    sound: "Acoustic focus, Minimalist percussion", 
    vocal: "Intimate, Pure, Raw recording feel" 
  }, // 어쿠스틱 악기 중심의 진솔하고 가까운 목소리

  idol_dance: { 
    style: "K-Pop Idol Dance, High Energy", 
    sound: "Punchy hybrid beats, Wide stereo mix", 
    vocal: "Synchronized harmonies, Catchy idol hooks" 
  }, // 화려한 군무 중심의 아이돌 댄스
  k_ballad: { 
    style: "Emotional K-Ballad, Dramatic", 
    sound: "Grand piano, Lush orchestral strings", 
    vocal: "Vulnerable, Soulful, Powerful high notes" 
  }, // 한국 정통 발라드의 폭발적인 고음과 감성
  k_synth_pop: { 
    style: "Retro K-Pop, Dreamy Synth-pop", 
    sound: "Vintage synths, Dreamy K-pop atmosphere", 
    vocal: "Sweet, Melodic K-pop phrasing" 
  }, // 한국식 세련미를 더한 복고풍 신스팝 사운드
  k_trap: { 
    style: "K-Hip-hop Fusion, Trap Style", 
    sound: "Rapid hi-hats, Booming 808 bass", 
    vocal: "Rap-singing mix, Melodic rap flow" 
  }, // 트랩 비트 위에 얹어진 K-힙합의 멜로딕 랩
  k_new_jack_swing: { 
    style: "90s Korean New Jack Swing", 
    sound: "Vintage sampler hits, Swing-beat rhythm", 
    vocal: "Soulful, Rhythmic swing delivery" 
  }, // 90년대 가요 감성의 뉴잭스윙
  k_indie: { 
    style: "Korean Indie Pop, Airy Style", 
    sound: "Warm guitar, Lo-fi texture", 
    vocal: "Natural, Breath-heavy tone" 
  }, // 담백하고 공기감이 느껴지는 한국 인디 보컬
  k_folk: { 
    style: "Modern Korean Folk, Sincere", 
    sound: "Steel-string guitar, Simple recording", 
    vocal: "Simple storytelling style, Emotional" 
  }, // 통기타 한 대와 진솔한 이야기가 담긴 포크
  k_rock: { 
    style: "K-Rock Band, Energetic Rock", 
    sound: "Driving electric guitar, Rock drums", 
    vocal: "Powerful rock belting, High energy" 
  }, // 시원하게 뻗는 일렉 기타와 파워풀한 록 발성
  gugak_fusion: { 
    style: "Traditional Korean Fusion, Gugak-pop", 
    sound: "Gayageum, Haegeum, Korean percussion", 
    vocal: "Traditional Korean phrasing style" 
  }, // 국악기와 현대 사운드가 결합된 퓨전 음악

  j_idol_pop: { 
    style: "J-Pop Idol Style, Upbeat", 
    sound: "Fast tempo, Bright synths, Group layers", 
    vocal: "Group chorus, Youthful high-energy" 
  }, // 하이톤 에너지가 돋보이는 일본 아이돌 팝
  shibuya_kei: { 
    style: "Jazzy Shibuya-kei, Bossa Nova", 
    sound: "Retro samples, Sophisticated arrangement", 
    vocal: "Soft, Wispy, French-pop aesthetic" 
  }, // 시부야계 특유의 재즈/보사노바풍 편곡
  anime_rock: { 
    style: "Fast Anisong Rock, Energetic", 
    sound: "Distorted guitar riffs, Double-time drums", 
    vocal: "Intense, High-pitched anime rock tone" 
  }, // 애니메이션 주제가 특유의 질주감 있는 록
  j_city_pop: { 
    style: "80s Japanese City Pop", 
    sound: "Slap Bass, DX7 FM Electric Piano, Chorus Electric Guitar ", 
    vocal: "airy, sophisticated, and restrained, delivered in a cool mid-range without dramatic peaks" 
  }, // 80년대 일본 시티팝의 펑키하고 도회적인 사운드
  visual_kei: { 
    style: "Dramatic Visual-kei, Gothic", 
    sound: "Heavy rock, Orchestral elements", 
    vocal: "Vibrato-heavy, Operatic rock style" 
  }, // 화려하고 드라마틱한 구성의 비주얼계 록
  utaite_style: { 
    style: "High-speed Internet Pop, Utaite", 
    sound: "Hyper-active melody, Intense production", 
    vocal: "High-speed delivery, Sharp digital tone" 
  }, // 일본 우타이테 문화 특유의 빠른 팝 사운드
  vocaloid_style: { 
    style: "Synthesized Vocaloid Style", 
    sound: "Digital vocal texture, Tech-pop beat", 
    vocal: "Robotic, Synthesized, Artificial tone" 
  }, // 인위적인 기계 보컬 질감을 의도한 스타일
  j_jazz_pop: { 
    style: "Modern J-Jazz Fusion, Melodic", 
    sound: "Virtuoso piano, Walking bass, Jazz feel", 
    vocal: "Jazzy, Laid-back, Melodic phrasing" 
  }, // 여유로운 재즈 리듬과 일본식 멜로디의 결합
  j_electro: { 
    style: "Japanese Techno-pop, Electronic", 
    sound: "Trance synths, Precise digital beats", 
    vocal: "Vocoder-processed, Ethereal, Filtered" 
  }, // 정교한 디지털 비트와 기계적 보컬 필터링
  j_ballad: { 
    style: "Emotional J-Ballad, Melodic", 
    sound: "Soft piano, Warm strings", 
    vocal: "Tender, Passionate, Melodic focus" 
  }, // 선율미가 강조된 일본식 발라드

  /* ===================== 2. Hip-hop & R&B (ID 소문자 통일) ===================== */
  trap: { 
    style: "Modern Trap, Hard-hitting Energy", 
    sound: "Rapid hi-hats, Booming 808 bass", 
    vocal: "Aggressive trap flow, Triplets rap" 
  }, // 강렬한 808 베이스와 현대적인 트랩 비트
  drill: { 
    style: "UK/NY Drill Style, Dark Gritty", 
    sound: "Sliding 808 bass, Complex percussion", 
    vocal: "Deep-voiced, Intense street flow" 
  }, // 드릴 특유의 슬라이딩 베이스와 어두운 분위기
  boombap: { 
    style: "Classic Boom-bap, Golden Era", 
    sound: "Dusty vinyl samples, Punchy drums", 
    vocal: "Raw lyrical delivery, Rhythmic flow" 
  }, // 90년대 황금기 힙합의 투박한 붐뱁 비트
  lofi: { 
    style: "Chill Lo-fi Hip-hop, Relaxing", 
    sound: "Mellow jazz samples, Vinyl crackle", 
    vocal: "Laid-back whispering, Dreamy delivery" 
  }, // 나른하고 편안한 로파이 비트 (ID: lofi)
  jazz_hiphop: { 
    style: "Jazz-influenced Hip-hop, Groove", 
    sound: "Smooth jazz piano, Saxophone, Jazz break", 
    vocal: "Mellow rhythmic flow, Poetic delivery" 
  }, // 재즈 선율과 힙합 비트의 세련된 조화
  emo_rap: { 
    style: "Emotional Emo-rap, Melancholic", 
    sound: "Melodic guitar loops, Trap beats", 
    vocal: "Vulnerable sing-rapping, Raw tone" 
  }, // 우울한 기타 선율과 감성적인 랩-싱잉
  old_school: { 
    style: "Classic Old School Hip-hop", 
    sound: "Funk samples, Scratching, Basic beats", 
    vocal: "Storytelling, Clear rhythmic rap" 
  }, // 초창기 힙합의 펑키한 샘플과 정석적인 래핑
  g_funk: { 
    style: "West Coast G-Funk Style", 
    sound: "Whiny sine synths, Funk groove, Deep bass", 
    vocal: "Laid-back, Melodic West Coast flow" 
  }, // 서부 힙합 특유의 지펑크 사운드
  cloud_rap: { 
    style: "Cloud Rap, Ambient Hip-hop", 
    sound: "Atmospheric pads, Slow trap beats", 
    vocal: "Distant, Reverb-heavy melodic rap" 
  }, // 몽환적인 패드 사운드와 공간감 있는 래핑

  contemporary_rnb: { 
    style: "Modern Contemporary R&B", 
    sound: "Polished synths, Deep sub-bass, Snaps", 
    vocal: "Smooth silky vocals, Precise R&B runs" 
  }, // 매끄럽고 트렌디한 현대 알앤비
  neo_soul: { 
    style: "Sophisticated Neo-soul, Jazzy", 
    sound: "Rhodes piano, Groovy live bass", 
    vocal: "Soulful artistic phrasing, Deep emotion" 
  }, // 지적이고 예술적인 네오 소울
  soul: { 
    style: "Classic Soul, Vintage Motown", 
    sound: "Brass section, Hammond organ, Vintage drums", 
    vocal: "Powerful raw soul, Gospel-influenced" 
  }, // 정통 소울 가창
  funk: { 
    style: "Classic Funk, Groovy Dance", 
    sound: "Slap bass, Wah-wah guitar, Punchy brass", 
    vocal: "Dynamic rhythmic vocals, Energetic" 
  }, // 리듬감이 폭발하는 펑크
  alternative_rnb: { 
    style: "Alternative PBR&B, Atmospheric", 
    sound: "Ambient pads, Minimalist moody beats", 
    vocal: "Dreamy airy vocals, Emotional tone" 
  }, // 얼터너티브 알앤비 (ID: alternative_rnb)
  new_jack_swing: { 
    style: "New Jack Swing, Retro Groove", 
    sound: "Vintage sampler hits, Swing rhythm", 
    vocal: "Soulful, Rhythmic swing delivery" 
  }, // 복고풍 스윙 리듬 (ID: new_jack_swing)

  /* ===================== 3. Rock & Band (ID 소문자 통일) ===================== */
  alternative_rock: { 
    style: "Modern Alternative Rock", 
    sound: "Clean to driven guitar, Band sound", 
    vocal: "Emotional rock vocals, Melodic" 
  },
  modern_rock: { 
    style: "Modern Rock, Contemporary Band", 
    sound: "Polished electric guitar, Tight drums", 
    vocal: "Clear and melodic rock delivery" 
  },
  punk_rock: { 
    style: "Fast Punk Rock, Rebellious", 
    sound: "Raw overdriven guitar, Fast-paced drums", 
    vocal: "Rough shouting, Youthful rebellious" 
  },
  hard_rock: { 
    style: "Classic Hard Rock, Heavy Band", 
    sound: "Distorted riffs, Powerful drums", 
    vocal: "Powerful belting, High-pitched rock" 
  },
  soft_rock: { 
    style: "Soft Rock, Melodic Band Sound", 
    sound: "Acoustic guitar, Piano, Clean electric", 
    vocal: "Tender, Smooth melodic delivery" 
  },
  garage_rock: { 
    style: "Garage Rock, Raw Lo-fi Style", 
    sound: "Distorted fuzzy guitar, Simple drums", 
    vocal: "Raw, Energetic, Slightly distorted" 
  },
  shoegazing: { 
    style: "Shoegazing, Dreamy Noise Rock", 
    sound: "Wall of sound guitar, Deep reverb", 
    vocal: "Soft, Buried in the mix, Dreamy tone" 
  },
  folk_rock: { 
    style: "Folk Rock, Acoustic-Electric", 
    sound: "Acoustic guitar, Tambourine, Organ", 
    vocal: "Sincere storytelling, Warm rock tone" 
  },
  blues_rock: { 
    style: "Blues Rock, Soulful Guitar", 
    sound: "Bluesy guitar solos, Hammond organ", 
    vocal: "Gritty, Soulful, Powerful bluesy tone" 
  },

  heavy_metal: { 
    style: "Classic Heavy Metal, Powerful", 
    sound: "Chugging guitar, Double-bass drums", 
    vocal: "Powerful rock belting, Metal shouting" 
  },
  death_metal: { 
    style: "Death Metal, Aggressive Dark", 
    sound: "Low-tuned guitar, Blast beats", 
    vocal: "Deep guttural growls, Harsh vocals" 
  },
  thrash_metal: { 
    style: "Thrash Metal, Fast Aggressive", 
    sound: "Fast shredding guitar, Intense drums", 
    vocal: "Aggressive shouting, High-speed rap-like" 
  },
  metalcore: { 
    style: "Metalcore, Modern Aggressive", 
    sound: "Heavy breakdowns, Melodic guitar riffs", 
    vocal: "Mixed screaming and melodic clean" 
  },
  nu_metal: { 
    style: "Nu Metal, Hiphop-Metal Fusion", 
    sound: "Down-tuned guitar, Turntables, Groovy", 
    vocal: "Rap-singing, Angry energetic delivery" 
  },
  symphonic_metal: { 
    style: "Symphonic Metal, Epic Grand", 
    sound: "Orchestral elements, Heavy guitar", 
    vocal: "Operatic female vocals, Dramatic" 
  },
  power_metal: { 
    style: "Power Metal, Epic Fantasy", 
    sound: "Fast melodic guitar, Double-bass", 
    vocal: "High-pitched clean vocals, Heroic" 
  },

  /* ===================== 4. Electronic & Dance (ID 소문자 통일) ===================== */
  house: { 
    style: "Classic House, 4/4 Groove", 
    sound: "Deep bass, Repetitive stabs, Drum machine", 
    vocal: "Soulful diva vocals, Vocal chops" 
  },
  techno: { 
    style: "Dark Techno, Industrial Style", 
    sound: "Repetitive rhythmic synths, Dark kick", 
    vocal: "Minimalist, Monotone rhythmic delivery" 
  },
  trance: { 
    style: "Uplifting Trance, Melodic Journey", 
    sound: "Saw-tooth leads, Arpeggiated bass", 
    vocal: "Ethereal, Long sustained melodic notes" 
  },
  future_bass: { 
    style: "Future Bass, Modern Electronic", 
    sound: "Bright supersaw synths, Vocal chops", 
    vocal: "Pop-style melodic vocals, Airy tone" 
  },
  dubstep: { 
    style: "Aggressive Dubstep, Bass Drop", 
    sound: "Wobble bass, Gritty synths, Half-time", 
    vocal: "Intense shouting, Hype-man delivery" 
  },
  deep_house: { 
    style: "Deep House, Chill Lounge", 
    sound: "Warm chords, Mellow bass, Smooth beat", 
    vocal: "Soulful, Laid-back, Sultry vocals" 
  },
  tropical_house: { 
    style: "Tropical House, Summer Vibe", 
    sound: "Marimba, Steel drums, Flute-like synth", 
    vocal: "Light, Breezy pop-style vocals" 
  },
  eurobeat: { 
    style: "Eurobeat, Fast High-Energy", 
    sound: "High-speed digital synths, Fast tempo", 
    vocal: "High-pitched, Energetic, Flashy" 
  },
  drum_and_bass: { 
    style: "Drum & Bass, Fast Breakbeat", 
    sound: "Fast broken beats, Deep sub-bass", 
    vocal: "Rhythmic melodic delivery, MC style" 
  },

  /* ===================== 5. Jazz & Classical (ID 소문자 통일) ===================== */
  swing_jazz: { 
    style: "Classic Swing Jazz, Big Band", 
    sound: "Walking bass, Bright brass, Ride cymbal", 
    vocal: "Rhythmic phrasing, Scat singing" 
  },
  bossa_nova: { 
    style: "Bossa Nova, Brazilian Jazz", 
    sound: "Nylon guitar, Soft shaker, Jazz piano", 
    vocal: "Soft, Wispy, Portuguese/English" 
  },
  fusion_jazz: { 
    style: "Jazz Fusion, Modern Complex", 
    sound: "Electric guitar, Keyboards, Complex drums", 
    vocal: "Instrumental focus, Artistic phrasing" 
  },
  cool_jazz: { 
    style: "Cool Jazz, Relaxed Lounge", 
    sound: "Muted trumpet, Soft piano, Brushed drums", 
    vocal: "Laid-back, Whispering, Smooth tone" 
  },
  big_band: { 
    style: "Big Band Era, Grand Jazz", 
    sound: "Full brass section, Upright bass", 
    vocal: "Show-tune style, Powerful jazz vocals" 
  },
  latin_jazz: { 
    style: "Latin Jazz, Rhythmic Energy", 
    sound: "Congas, Timbales, Montuno piano", 
    vocal: "Energetic, Spanish/English, Rhythmic" 
  },
  jazz_vocal: { 
    style: "Standard Jazz Vocal, Classic", 
    sound: "Jazz trio (Piano, Bass, Drums)", 
    vocal: "Sophisticated phrasing, Soulful tone" 
  },
  hard_bop: { 
    style: "Hard Bop, Intense Jazz", 
    sound: "Aggressive drums, Fast saxophone solos", 
    vocal: "Energetic, Soulful jazz delivery" 
  },

  full_orchestra: { 
    style: "Full Orchestral Symphony", 
    sound: "Symphonic strings, Woodwinds, Brass", 
    vocal: "Operatic phrasing, Grand classical" 
  },
  piano_solo_classical: { 
    style: "Pure Piano Solo, Classical", 
    sound: "Grand piano resonance, Soft pedals", 
    vocal: "Atmospheric breathing, Pure tone" 
  }, // ID: piano_solo_classical
  string_ensemble_classical: { 
    style: "String Ensemble, Baroque-style", 
    sound: "Violins, Violas, Cellos, Basses", 
    vocal: "Choir-like textures, Elegant phrasing" 
  }, // ID: string_ensemble_classical
  choral: { 
    style: "Grand Choral, Sacred Style", 
    sound: "Pipe organ or Minimalist, Full choir", 
    vocal: "Soprano, Alto, Tenor, Bass harmony" 
  },
  baroque: { 
    style: "Baroque Classical, Ornate", 
    sound: "Harpsichord, String chamber, Oboe", 
    vocal: "Clear, Ornate classical phrasing" 
  },
  opera: { 
    style: "Grand Opera, Dramatic Classical", 
    sound: "Full orchestra, Dramatic builds", 
    vocal: "Full operatic projection, Vibrato-heavy" 
  },

  /* ===================== 6. Folk & World (ID 소문자 통일) ===================== */
  traditional_folk: { 
    style: "Traditional Folk, Sincere", 
    sound: "Acoustic guitar, Banjo, Fiddle", 
    vocal: "Raw, Storytelling, Natural tone" 
  },
  country: { 
    style: "Classic Country, Nashville Style", 
    sound: "Steel guitar, Acoustic guitar, Fiddle", 
    vocal: "Twangy, Sincere storytelling style" 
  },
  bluegrass: { 
    style: "Fast Bluegrass, High Energy", 
    sound: "Banjo, Mandolin, Upright bass", 
    vocal: "High-pitched harmonies, Fast phrasing" 
  },
  singer_songwriter: { 
    style: "Singer-Songwriter Style, Intimate", 
    sound: "Solo guitar or Piano, Pure recording", 
    vocal: "Honest, Whispering, Personal tone" 
  },
  acoustic_session: { 
    style: "Acoustic Session, Live Vibe", 
    sound: "Organic instruments, Small percussion", 
    vocal: "Pure, Unprocessed, Natural delivery" 
  },
  fingerstyle: { 
    style: "Fingerstyle Guitar, Organic", 
    sound: "Complex acoustic guitar picking", 
    vocal: "Breath-heavy, Intimate, Soft tone" 
  },

  reggae: { 
    style: "Reggae, Jamaican Island Vibe", 
    sound: "Off-beat guitar, Deep bass, Skank", 
    vocal: "Rhythmic Patois style, Laid-back" 
  },
  afrobeat: { 
    style: "Afrobeat, Energetic Rhythmic", 
    sound: "Complex percussion, Funky brass", 
    vocal: "Call and response, Rhythmic delivery" 
  },
  celtic: { 
    style: "Celtic Folk, Irish Tradition", 
    sound: "Tin whistle, Bagpipes, Bodhran", 
    vocal: "Pure, Melodic, Celtic phrasing" 
  },
  latin_salsa: { 
    style: "Latin Salsa, High Energy Dance", 
    sound: "Piano montuno, Brass, Percussion", 
    vocal: "Spanish, Rhythmic, Passionate" 
  },
  flamenco: { 
    style: "Flamenco, Passionate Spanish", 
    sound: "Nylon guitar, Clapping, Cajon", 
    vocal: "Deep, Emotional, Raspy Spanish vocals" 
  },

  /* ===================== 7. Trot & Adult (ID 소문자 통일) ===================== */
  traditional_trot: { 
    style: "Authentic Traditional Trot", 
    sound: "Accordion, Brass, Trot rhythm", 
    vocal: "Deep vibrato, Masterful Ggeok-gi" 
  },
  semi_trot: { 
    style: "Modern Semi-Trot, Danceable", 
    sound: "infectious synth melody, Infectious Rhythm, Bright brass", 
    vocal: "Cheerful, Light trot phrasing" 
  },
  disco_trot: { 
    style: "Disco Trot, High Energy", 
    sound: "4/4 Disco beat, Electronic synths", 
    vocal: "Energetic, Rhythmic trot delivery" 
  },
  rock_trot: { 
    style: "Rock Trot, Band-style Trot", 
    sound: "Electric guitar riffs, Rock drums", 
    vocal: "Powerful rock belting, Trot technique" 
  },
  ballad_trot: { 
    style: "Emotional Ballad Trot, Sad", 
    sound: "Acoustic guitar, Soft strings", 
    vocal: "Tearful, Soulful trot vibrato" 
  },
  blues_trot: { 
    style: "Bluesy Trot, Soulful Adult", 
    sound: "Bluesy guitar, Saxophone, Slow tempo", 
    vocal: "Gritty, Soulful adult contemporary" 
  },
  shuffle_trot: { 
    style: "Shuffle Trot, Rhythmic", 
    sound: "Shuffle rhythm, Bright accordion", 
    vocal: "Bouncy, Rhythmic trot delivery" 
  },
  gugak_trot: { 
    style: "Gugak-fused Trot, Traditional", 
    sound: "Gayageum, Haegeum, Trot rhythm", 
    vocal: "Traditional Korean Minyo-style trot" 
  },

  "7080_folk": { 
    style: "7080 Folk Gayo, Nostalgic", 
    sound: "Acoustic guitar, Harmonica, Pure", 
    vocal: "Sincere storytelling, Warm tone" 
  },
  adult_ballad: { 
    style: "Adult Contemporary Ballad", 
    sound: "Piano, Strings, Clean production", 
    vocal: "Mature, Emotional storytelling" 
  },
  campus_band_sound: { 
    style: "Campus Band Sound, 7080 Rock", 
    sound: "Vintage electric guitar, Combo organ", 
    vocal: "Powerful vintage rock, Nostalgic" 
  },
  enka_style: { 
    style: "Enka-influenced Gayo, Classic", 
    sound: "Orchestral strings, Traditional brass", 
    vocal: "Deep vibrato, Dramatic adult phrasing" 
  },

  /* ===================== 8. Cinematic & BGM (ID 소문자 통일) ===================== */
  orchestral_score: { 
    style: "Epic Orchestral Score", 
    sound: "Full symphony, Brass, Percussion", 
    vocal: "Dramatic wordless vocals, Choir" 
  },
  hybrid_epic: { 
    style: "Hybrid Epic Cinematic", 
    sound: "Orchestral + Modern Synths, Taiko", 
    vocal: "Intense dramatic textures, Wordless" 
  },
  synth_score: { 
    style: "Electronic Synth Score, Retro", 
    sound: "Analog synths, Dark atmosphere", 
    vocal: "Minimalist processed textures" 
  },
  piano_solo: { 
    style: "Emotional Piano Solo, OST", 
    sound: "Grand piano, Deep resonance", 
    vocal: "Intimate breathing, Atmospheric" 
  }, // ID: piano_solo (OST 하위)
  string_ensemble: { 
    style: "String Ensemble, Melancholic", 
    sound: "Lush violins and cellos", 
    vocal: "Soft choral textures, Wordless" 
  },
  chiptune: { 
    style: "Chiptune, 8-bit Video Game", 
    sound: "Square waves, Pulse waves, Noise", 
    vocal: "Digital, Synthesized, Robotic" 
  },
  world_music: { 
    style: "Cinematic World Music, Ethnic", 
    sound: "Ethnic instruments, World percussion", 
    vocal: "Native traditional phrasing, Ethnic" 
  },
  minimalism: { 
    style: "Minimalist OST, Repetitive", 
    sound: "Repetitive patterns, Piano, Marimba", 
    vocal: "Wordless, Rhythmic breathing" 
  },
  ambient: { 
    style: "Ambient BGM, Atmospheric", 
    sound: "Distant pads, Field recordings", 
    vocal: "Ethereal, Distant, Wordless textures" 
  },
  /* ===================== Added expanded genre prompts ===================== */
  alternative_pop: {
    style: "Alternative Pop with distinctive pop structure",
    sound: "unusual synth layers, polished drums, textured guitar accents",
    vocal: "characterful pop vocal with expressive phrasing"
  },
  bedroom_pop: {
    style: "Intimate Bedroom Pop",
    sound: "lo-fi drums, mellow guitar, close room ambience",
    vocal: "soft close-mic vocal, private storytelling"
  },
  dream_pop: {
    style: "Dream Pop with floating atmosphere",
    sound: "reverb guitars, wide pads, soft drums",
    vocal: "hazy airy vocal, floating delivery"
  },
  art_pop: {
    style: "Art Pop with experimental structure",
    sound: "unusual synth colors, asymmetrical pop arrangement",
    vocal: "distinctive vocal phrasing, artful emotional control"
  },
  y2k_pop: {
    style: "Y2K Pop with glossy nostalgic energy",
    sound: "sparkling digital synths, punchy pop drums, bright FX",
    vocal: "bright playful pop vocal, early-2000s sweetness"
  },
  hyperpop: {
    style: "Hyperpop with exaggerated digital pop energy",
    sound: "distorted synths, pitched vocal FX, fast digital drums",
    vocal: "processed high-energy vocal, playful extremes"
  },
  k_indie_pop_2000s: {
    style: "2000s Korean Indie Pop",
    sound: "jangly guitar, light band groove, warm small-room texture",
    vocal: "airy and breathy female vocal, playful but dreamy"
  },
  k_band_pop: {
    style: "Korean Band Pop with melodic hooks",
    sound: "clean electric guitar, live drums, warm bass",
    vocal: "clear Korean pop-band vocal, hook-focused"
  },
  k_rnb_pop: {
    style: "Korean R&B Pop with soft groove",
    sound: "Rhodes keys, smooth bass, polished R&B drums",
    vocal: "smooth emotional Korean R&B vocal"
  },
  anisong_pop: {
    style: "Anisong Pop with bright dramatic payoff",
    sound: "fast band-pop drums, sparkling synths, anime-style guitar",
    vocal: "clear energetic vocal, dramatic hook lift"
  },
  j_indie_pop: {
    style: "Japanese Indie Pop",
    sound: "delicate guitar, soft keys, natural band texture",
    vocal: "clear gentle J-indie vocal phrasing"
  },
  melodic_rap: {
    style: "Melodic Rap with sung hooks",
    sound: "808 groove, soft synth pads, trap drums",
    vocal: "melodic rap flow, sung-rap phrasing"
  },
  trap_soul: {
    style: "Trap Soul with dark R&B mood",
    sound: "deep 808, moody pads, sparse trap drums",
    vocal: "smooth aching vocal, intimate trap-soul delivery"
  },
  phonk: {
    style: "Dark Phonk drive",
    sound: "distorted bass, gritty samples, hard cowbell rhythm",
    vocal: "low gritty vocal chops or aggressive rap tone"
  },
  jersey_club_hiphop: {
    style: "Jersey Club Hip-hop bounce",
    sound: "jersey kick pattern, chopped vocal samples, tight bass",
    vocal: "short rhythmic vocal chants, club-ready hooks"
  },
  slow_jam: {
    style: "Slow Jam R&B",
    sound: "slow groove, soft electric piano, deep warm bass",
    vocal: "silky intimate R&B vocal"
  },
  city_rnb: {
    style: "Urban City R&B",
    sound: "Rhodes keys, sub bass, soft electronic drums",
    vocal: "smooth late-night R&B vocal"
  },
  uk_garage_rnb: {
    style: "UK Garage R&B",
    sound: "shuffled garage drums, warm bass, chopped ambience",
    vocal: "smooth R&B vocal over syncopated groove"
  },
  indie_rock: {
    style: "Indie Rock with natural band energy",
    sound: "jangly guitars, live drums, warm bass",
    vocal: "casual expressive indie vocal"
  },
  emo_rock: {
    style: "Emo Rock with emotional band lift",
    sound: "driving guitars, punchy drums, wide chorus guitars",
    vocal: "raw emotional vocal, urgent melodic delivery"
  },
  math_rock: {
    style: "Math Rock with intricate rhythm",
    sound: "tapping guitars, odd-meter drums, clean bass",
    vocal: "minimal or light vocal, technical phrasing"
  },
  post_punk: {
    style: "Post-Punk with cold urban tension",
    sound: "driving bass, dry drums, angular guitar",
    vocal: "detached vocal, dry spoken edge"
  },
  pop_punk: {
    style: "Pop Punk with fast catchy energy",
    sound: "power chords, fast drums, bright bass",
    vocal: "youthful energetic vocal, shoutable hooks"
  },
  band_ballad: {
    style: "Band Ballad with emotional lift",
    sound: "electric guitar arpeggios, live drums, warm strings",
    vocal: "emotional band-ballad vocal, rising high notes"
  },
  synthwave: {
    style: "Retro Synthwave",
    sound: "analog arps, gated drums, neon pads",
    vocal: "distant nostalgic vocal or wordless texture"
  },
  darkwave: {
    style: "Darkwave with cold synth mood",
    sound: "dark pads, mechanical drums, cold bass",
    vocal: "detached dark vocal, low dramatic phrasing"
  },
  breakbeat_electronic: {
    style: "Breakbeat electronic groove",
    sound: "chopped break drums, sub bass, rhythmic synth stabs",
    vocal: "rhythmic vocal cuts or spoken phrases"
  },
  uk_garage: {
    style: "UK Garage bounce",
    sound: "shuffled drums, warm sub bass, chopped vocal FX",
    vocal: "tight rhythmic vocal, light club phrasing"
  },
  future_garage: {
    style: "Future Garage atmosphere",
    sound: "shuffled ghost drums, deep sub, rainy pads",
    vocal: "distant emotional vocal texture"
  },
  glitch_pop: {
    style: "Glitch Pop with digital cuts",
    sound: "glitch FX, chopped synths, tight pop drums",
    vocal: "processed pop vocal with playful digital edges"
  },
  hardstyle: {
    style: "Hardstyle festival energy",
    sound: "distorted hard kick, supersaw leads, festival risers",
    vocal: "anthemic vocal shouts or powerful hooks"
  },
  smooth_jazz: {
    style: "Smooth Jazz lounge",
    sound: "smooth sax, electric piano, soft brushed drums",
    vocal: "warm relaxed jazz vocal"
  },
  lounge_jazz: {
    style: "Lounge Jazz",
    sound: "upright bass, brushed drums, cocktail piano",
    vocal: "laid-back classy vocal phrasing"
  },
  nu_jazz: {
    style: "Nu Jazz with electronic groove",
    sound: "jazz chords, electronic drums, warm bass",
    vocal: "cool rhythmic vocal or wordless textures"
  },
  jazz_ballad: {
    style: "Jazz Ballad",
    sound: "slow jazz piano, upright bass, brushed drums",
    vocal: "intimate smoky jazz vocal"
  },
  neoclassical: {
    style: "Neo Classical minimal emotion",
    sound: "felt piano, small strings, soft ambience",
    vocal: "wordless or minimal intimate vocal texture"
  },
  modern_classical: {
    style: "Modern Classical with cinematic space",
    sound: "modern strings, piano, subtle drones",
    vocal: "elegant wordless vocal texture"
  },
  cinematic_piano: {
    style: "Cinematic Piano focus",
    sound: "emotional grand piano, soft strings, wide hall",
    vocal: "breathy atmospheric vocal texture"
  },
  chamber_orchestra: {
    style: "Chamber Orchestra intimacy",
    sound: "small string ensemble, woodwinds, room ambience",
    vocal: "delicate classical phrasing or wordless choir"
  },
  modern_folk: {
    style: "Modern Folk storytelling",
    sound: "acoustic guitar, soft percussion, warm room",
    vocal: "natural intimate folk vocal"
  },
  indie_folk: {
    style: "Indie Folk intimacy",
    sound: "fingerpicked guitar, soft harmonies, organic percussion",
    vocal: "airy sincere folk vocal"
  },
  reggaeton: {
    style: "Reggaeton pop groove",
    sound: "dembow rhythm, latin percussion, warm bass",
    vocal: "rhythmic pop vocal, catchy Spanish-style hook"
  },
  latin_pop: {
    style: "Latin Pop brightness",
    sound: "nylon guitar, latin percussion, brass accents",
    vocal: "bright rhythmic vocal, passionate hook"
  },
  afro_pop: {
    style: "Afro Pop groove",
    sound: "afrobeat percussion, clean guitar, warm bass",
    vocal: "light rhythmic vocal, sunny melodic hooks"
  },
  indian_fusion: {
    style: "Indian Fusion texture",
    sound: "sitar, tabla, bansuri with modern beat",
    vocal: "ornamental melodic vocal or airy texture"
  },
  middle_eastern: {
    style: "Middle Eastern texture",
    sound: "oud, duduk, frame drum, desert ambience",
    vocal: "ornamental modal vocal texture"
  },
  japanese_folk: {
    style: "Japanese Folk texture",
    sound: "shakuhachi, koto, soft taiko, natural ambience",
    vocal: "gentle traditional phrasing"
  },
  pansori_fusion: {
    style: "Korean gugak-based Pansori fusion, modern traditional crossover",
    sound: "janggu rhythm, gayageum plucks, piri breath line, haegeum color, modern bass",
    vocal: "pansori-style chest-driven breath, Korean traditional ornament, han-filled resonance, spoken-sung phrasing"
  },
  fantasy_bgm: {
    style: "Fantasy BGM",
    sound: "bell synth, celesta, choir pad, magical shimmer",
    vocal: "ethereal wordless vocal texture"
  },
  dark_fantasy: {
    style: "Dark Fantasy score",
    sound: "low drones, dark strings, ominous choir, heavy hits",
    vocal: "haunting choir or whispered texture"
  },
  mystery_bgm: {
    style: "Mystery BGM",
    sound: "small piano motifs, subtle pulses, eerie pads",
    vocal: "minimal breathy texture"
  },
  sci_fi_score: {
    style: "Sci-Fi Score",
    sound: "cold synth pads, mechanical pulses, space ambience",
    vocal: "distant processed vocal texture"
  },
  horror_ambience: {
    style: "Horror Ambience",
    sound: "low drone, unsettling noise, sudden impact hits",
    vocal: "whispery distant vocal texture"
  },
  lofi_study: {
    style: "Lo-Fi Study BGM",
    sound: "lo-fi drums, warm keys, tape hiss",
    vocal: "minimal or no vocal, soft background texture"
  },
  cafe_bgm: {
    style: "Cafe BGM",
    sound: "soft piano, nylon guitar, brushed drums",
    vocal: "gentle wordless or light vocal texture"
  },
  nature_ambience: {
    style: "Nature Ambience",
    sound: "forest or water ambience, soft pads, light percussion",
    vocal: "wordless airy texture"
  },
  healing_piano: {
    style: "Healing Piano",
    sound: "warm piano, soft pad, gentle reverb",
    vocal: "minimal wordless breath texture"
  },
  epic_trailer: {
    style: "Epic Trailer score",
    sound: "massive percussion, brass hits, rising strings",
    vocal: "cinematic choir, heroic vocal texture"
  },

};

export type TagTier = 'free' | 'basic' | 'pro';

export const SECTION_META: Record<string, { tier: TagTier, descriptionKo?: string }> = {
  'Intro': { 
    tier: 'basic', 
    descriptionKo: "곡의 시작을 여는 구간. 분위기와 톤을 설정하며, 청자의 몰입을 유도합니다." 
  },
  'Break': {
    tier: 'basic',
    descriptionKo: "짧은 호흡 전환. 이전 보컬/리듬의 잔향을 가볍게 끊고 다음 섹션으로 넘깁니다."
  },
  'Stop': {
    tier: 'basic',
    descriptionKo: "찰나의 정지. 이전 흐름을 강하게 끊고 다음 섹션의 임팩트를 만듭니다."
  },
  'Verse 1': { 
    tier: 'basic', 
    descriptionKo: "첫 번째 이야기 전개 구간. 가사와 분위기의 방향을 제시합니다." 
  },
  'Verse 2': { 
    tier: 'basic', 
    descriptionKo: "두 번째 전개 구간. 감정이나 내용을 확장하고 변화를 줍니다." 
  },
  'Pre-Chorus': { 
    tier: 'basic', 
    descriptionKo: "코러스로 넘어가기 전 긴장감을 쌓는 구간. 에너지 상승과 기대감을 형성합니다." 
  },
  'Chorus': { 
    tier: 'basic', 
    descriptionKo: "곡의 핵심 후렴구. 가장 강한 감정과 멜로디가 반복되며 기억에 남는 부분입니다." 
  },
  'Hook': { 
    tier: 'basic', 
    descriptionKo: "귀에 꽂히는 핵심 포인트. 짧지만 강한 반복 요소로 곡의 중독성을 만듭니다." 
  },
  'Drop': { 
    tier: 'basic', 
    descriptionKo: "비트나 사운드가 폭발하는 구간. 에너지 중심의 전개가 강조됩니다." 
  },
  'Bridge': { 
    tier: 'basic', 
    descriptionKo: "곡의 흐름을 전환하는 구간. 새로운 분위기나 변화를 통해 후반부를 준비합니다." 
  },
  'Breakdown': { 
    tier: 'basic',
    descriptionKo: "곡의 에너지를 낮추고 리듬을 쪼개어 변화를 주는 구간입니다."
  },
  'Instrumental': { 
    tier: 'basic',
    descriptionKo: "보컬 없이 악기 연주만으로 구성된 구간입니다."
  },
  'Solo': { 
    tier: 'basic',
    descriptionKo: "특정 악기의 독주가 강조되는 구간입니다."
  },
  'Rap Verse': { 
    tier: 'basic',
    descriptionKo: "랩으로 구성된 전개 구간입니다."
  },
  'Final Chorus': { 
    tier: 'basic',
    descriptionKo: "곡의 대미를 장식하는 마지막 후렴구입니다."
  },
  'Outro': { 
    tier: 'basic', 
    descriptionKo: "곡을 마무리하는 구간. 감정을 정리하고 자연스럽게 끝맺습니다." 
  },
  'Theme A': { 
    tier: 'basic',
    descriptionKo: "곡의 주요 테마 A를 정의하는 구간입니다."
  },
  'Theme B': { 
    tier: 'basic',
    descriptionKo: "곡의 주요 테마 B를 정의하는 구간입니다."
  },
  'Build-up': { 
    tier: 'basic',
    descriptionKo: "에너지를 점진적으로 고조시키는 구간입니다."
  },
  'Main Theme': { 
    tier: 'basic',
    descriptionKo: "곡의 가장 핵심적인 테마가 연주되는 구간입니다."
  },
  'Climax': { 
    tier: 'basic',
    descriptionKo: "곡의 감정과 에너지가 최고조에 달하는 구간입니다."
  },
};

export const FREE_TAGS = [
  // Intro
  "Minimal", "Soft Start", "Ambient",

  // Verse
  "Low Energy", "Steady", "Story",

  // Pre-Chorus
  "Lead-in", "Build",

  // Chorus
  "High Energy", "Hook Boost",

  // Bridge
  "Breakdown", "Contrast",

  // Outro
  "Fade-out", "Soft End", "Calm"
];


export const PRO_TAGS = [
  // Intro
  "Slow Build", "Hook First", "Instrumental",
  "Layer Build", "Teaser Intro",

  // Verse
  "Rhythmic Flow", "Sparse",
  "Groove Drive", "Laid-back", "Subtle Build",

  // Pre-Chorus
  "Energy Rise", "Tension Build",
  "Dynamic Rise", "Momentum Shift", "Intensity Build", "Anticipation",

  // Chorus
  "Full Power", "Peak Hit",
  "Explosive Hit", "Anthem Hook", "Wide Spread", "Power Drive",

  // Bridge
  "Energy Drop", "Reset",
  "Hard Shift", "Dynamic Switch", "Rebuild", "Transition Flow",

  // Outro
  "Smooth Exit",
  "Echo Fade", "Energy Release", "Minimal End", "Loop Ready"
];

export const TAG_META: Record<string, { tier: TagTier }> = {
  "Minimal": { tier: 'basic' },
  "Ambient Start": { tier: 'basic' },
  "Soft Entry": { tier: 'basic' },
  "Instrumental Opening": { tier: 'basic' },
  "Gradual Layering": { tier: 'basic' },
  "Teaser Opening": { tier: 'basic' },
  "Hook-first": { tier: 'basic' },
  "Fade-in": { tier: 'basic' },
  "Cold Open": { tier: 'basic' },
  "Spoken Intro": { tier: 'basic' },
  "Atmosphere Intro": { tier: 'basic' },
  "Muted Opening": { tier: 'basic' },
  "Low Energy": { tier: 'basic' },
  "Story Focused": { tier: 'basic' },
  "Rhythmic Flow": { tier: 'basic' },
  "Sparse Arrangement": { tier: 'basic' },
  "Groove Driven": { tier: 'basic' },
  "Laid-back": { tier: 'basic' },
  "Steady Pace": { tier: 'basic' },
  "Subtle Build": { tier: 'basic' },
  "Intimate Delivery": { tier: 'basic' },
  "Conversational": { tier: 'basic' },
  "Melodic Verse": { tier: 'basic' },
  "Tension Hint": { tier: 'basic' },
  "Build-up": { tier: 'basic' },
  "Rising Energy": { tier: 'basic' },
  "Tension Lift": { tier: 'basic' },
  "Dynamic Increase": { tier: 'basic' },
  "Momentum Shift": { tier: 'basic' },
  "Intensity Growth": { tier: 'basic' },
  "Lead-in": { tier: 'basic' },
  "Anticipation": { tier: 'basic' },
  "Pre-drop Pause": { tier: 'basic' },
  "Harmony Lift": { tier: 'basic' },
  "Drum Lift": { tier: 'basic' },
  "Vocal Push": { tier: 'basic' },
  "High Energy": { tier: 'basic' },
  "Explosive": { tier: 'basic' },
  "Full Arrangement": { tier: 'basic' },
  "Peak Section": { tier: 'basic' },
  "Anthemic": { tier: 'basic' },
  "Wide Impact": { tier: 'basic' },
  "Powerful Delivery": { tier: 'basic' },
  "Hook Emphasis": { tier: 'basic' },
  "Singalong Hook": { tier: 'basic' },
  "Layered Vocals": { tier: 'basic' },
  "Big Drums": { tier: 'basic' },
  "Bright Release": { tier: 'basic' },
  "Final Lift": { tier: 'basic' },
  "Last Hook": { tier: 'basic' },
  "Catchy Repeat": { tier: 'basic' },
  "Short Phrase": { tier: 'basic' },
  "Loop Hook": { tier: 'basic' },
  "Call-and-response": { tier: 'basic' },
  "Rhythmic Hook": { tier: 'basic' },
  "Earworm": { tier: 'basic' },
  "Minimal Hook": { tier: 'basic' },
  "Vocal Chop Hook": { tier: 'basic' },
  "Sassy Hook": { tier: 'basic' },
  "Punchline Hook": { tier: 'basic' },
  "Chant Hook": { tier: 'basic' },
  "Bass Drop": { tier: 'basic' },
  "Beat Drop": { tier: 'basic' },
  "Dance Break": { tier: 'basic' },
  "Impact Hit": { tier: 'basic' },
  "Synth Burst": { tier: 'basic' },
  "Drum Drop": { tier: 'basic' },
  "Energy Drop": { tier: 'basic' },
  "Contrast Section": { tier: 'basic' },
  "Minimal Reset": { tier: 'basic' },
  "Unexpected Shift": { tier: 'basic' },
  "Dynamic Change": { tier: 'basic' },
  "Rebuild Start": { tier: 'basic' },
  "Transition Focused": { tier: 'basic' },
  "Emotional Turn": { tier: 'basic' },
  "Mood Shift": { tier: 'basic' },
  "Half-time Feel": { tier: 'basic' },
  "Space Open": { tier: 'basic' },
  "Soft Collapse": { tier: 'basic' },
  "Breakdown": { tier: 'basic' },
  "Stripped Down": { tier: 'basic' },
  "Drum Break": { tier: 'basic' },
  "Bass Focus": { tier: 'basic' },
  "Silence Gap": { tier: 'basic' },
  "Glitch Break": { tier: 'basic' },
  "Percussion Break": { tier: 'basic' },
  "Tension Hold": { tier: 'basic' },
  "Short Break": { tier: 'basic' },
  "Stop Moment": { tier: 'basic' },
  "Drum Fill": { tier: 'basic' },
  "Breath Pause": { tier: 'basic' },
  "Impact Cut": { tier: 'basic' },
  "Quick Reset": { tier: 'basic' },
  "Vocal Drop": { tier: 'basic' },
  "Beat Cut": { tier: 'basic' },
  "Re-entry": { tier: 'basic' },
  "Hard Stop": { tier: 'basic' },
  "Sound Cut": { tier: 'basic' },
  "Freeze": { tier: 'basic' },
  "Dead Stop": { tier: 'basic' },
  "One-beat Pause": { tier: 'basic' },
  "Dropout": { tier: 'basic' },
  "Clean Stop": { tier: 'basic' },
  "Instrumental": { tier: 'basic' },
  "Guitar Solo": { tier: 'basic' },
  "Piano Solo": { tier: 'basic' },
  "Sax Solo": { tier: 'basic' },
  "Lead Melody": { tier: 'basic' },
  "Expressive Solo": { tier: 'basic' },
  "Short Solo": { tier: 'basic' },
  "Wide Lead": { tier: 'basic' },
  "Rap": { tier: 'basic' },
  "Fast Rap": { tier: 'basic' },
  "Off-beat Flow": { tier: 'basic' },
  "Punchy Reply": { tier: 'basic' },
  "Dry Spoken Rap": { tier: 'basic' },
  "Character Switch": { tier: 'basic' },
  "Low Voice Rap": { tier: 'basic' },
  "Sassy Rap": { tier: 'basic' },
  "Fade-out": { tier: 'basic' },
  "Soft Ending": { tier: 'basic' },
  "Gradual Exit": { tier: 'basic' },
  "Echo Finish": { tier: 'basic' },
  "Energy Release": { tier: 'basic' },
  "Minimal Ending": { tier: 'basic' },
  "Calm Closure": { tier: 'basic' },
  "Loop-friendly Ending": { tier: 'basic' },
  "Final Breath": { tier: 'basic' },
  "Last Chord": { tier: 'basic' },
  "Ambient Fade": { tier: 'basic' },
  "Soft Closure": { tier: 'basic' },
  "Main Theme": { tier: 'basic' },
  "Motif": { tier: 'basic' },
  "Character Theme": { tier: 'basic' },
  "Melodic Theme": { tier: 'basic' },
  "Warm Theme": { tier: 'basic' },
  "Dark Theme": { tier: 'basic' },
  "Repeat Motif": { tier: 'basic' },
  "Strong Hook": { tier: 'basic' },
  "Emotional Peak": { tier: 'basic' },
  "Power Drive": { tier: 'basic' },
  "Climax": { tier: 'basic' }
};

export const ALLOWED_TAGS_BY_SECTION: Record<string, string[]> = {
  "Intro": [
    "Minimal",
    "Ambient Start",
    "Soft Entry",
    "Instrumental Opening",
    "Gradual Layering",
    "Teaser Opening",
    "Hook-first",
    "Fade-in",
    "Cold Open",
    "Spoken Intro",
    "Atmosphere Intro",
    "Muted Opening"
  ],
  "Verse": [
    "Low Energy",
    "Story Focused",
    "Rhythmic Flow",
    "Sparse Arrangement",
    "Groove Driven",
    "Laid-back",
    "Steady Pace",
    "Subtle Build",
    "Intimate Delivery",
    "Conversational",
    "Melodic Verse",
    "Tension Hint"
  ],
  "Verse 1": [
    "Low Energy",
    "Story Focused",
    "Rhythmic Flow",
    "Sparse Arrangement",
    "Groove Driven",
    "Laid-back",
    "Steady Pace",
    "Subtle Build",
    "Intimate Delivery",
    "Conversational",
    "Melodic Verse",
    "Tension Hint"
  ],
  "Verse 2": [
    "Low Energy",
    "Story Focused",
    "Rhythmic Flow",
    "Sparse Arrangement",
    "Groove Driven",
    "Laid-back",
    "Steady Pace",
    "Subtle Build",
    "Intimate Delivery",
    "Conversational",
    "Melodic Verse",
    "Tension Hint"
  ],
  "Pre-Chorus": [
    "Build-up",
    "Rising Energy",
    "Tension Lift",
    "Dynamic Increase",
    "Momentum Shift",
    "Intensity Growth",
    "Lead-in",
    "Anticipation",
    "Pre-drop Pause",
    "Harmony Lift",
    "Drum Lift",
    "Vocal Push"
  ],
  "Chorus": [
    "High Energy",
    "Explosive",
    "Full Arrangement",
    "Peak Section",
    "Anthemic",
    "Wide Impact",
    "Powerful Delivery",
    "Hook Emphasis",
    "Singalong Hook",
    "Layered Vocals",
    "Big Drums",
    "Bright Release"
  ],
  "Final Chorus": [
    "High Energy",
    "Explosive",
    "Full Arrangement",
    "Peak Section",
    "Anthemic",
    "Wide Impact",
    "Powerful Delivery",
    "Hook Emphasis",
    "Final Lift",
    "Last Hook",
    "Layered Vocals",
    "Bright Release"
  ],
  "Hook": [
    "Hook Emphasis",
    "Catchy Repeat",
    "Short Phrase",
    "Loop Hook",
    "Call-and-response",
    "Rhythmic Hook",
    "Earworm",
    "Minimal Hook",
    "Vocal Chop Hook",
    "Sassy Hook",
    "Punchline Hook",
    "Chant Hook"
  ],
  "Drop": [
    "Explosive",
    "Bass Drop",
    "Beat Drop",
    "Wide Impact",
    "High Energy",
    "Full Arrangement",
    "Hook Emphasis",
    "Powerful Delivery",
    "Dance Break",
    "Impact Hit",
    "Synth Burst",
    "Drum Drop"
  ],
  "Bridge": [
    "Energy Drop",
    "Contrast Section",
    "Minimal Reset",
    "Unexpected Shift",
    "Dynamic Change",
    "Rebuild Start",
    "Transition Focused",
    "Emotional Turn",
    "Mood Shift",
    "Half-time Feel",
    "Space Open",
    "Soft Collapse"
  ],
  "Breakdown": [
    "Breakdown",
    "Energy Drop",
    "Minimal Reset",
    "Half-time Feel",
    "Stripped Down",
    "Drum Break",
    "Bass Focus",
    "Silence Gap",
    "Glitch Break",
    "Percussion Break",
    "Tension Hold",
    "Rebuild Start"
  ],
  "Break": [
    "Short Break",
    "Stop Moment",
    "Silence Gap",
    "Drum Fill",
    "Breath Pause",
    "Impact Cut",
    "Transition Focused",
    "Tension Hold",
    "Quick Reset",
    "Vocal Drop",
    "Beat Cut",
    "Re-entry"
  ],
  "Stop": [
    "Hard Stop",
    "Stop Moment",
    "Silence Gap",
    "Sound Cut",
    "Freeze",
    "Impact Cut",
    "Dead Stop",
    "One-beat Pause",
    "Dropout",
    "Tension Hold",
    "Clean Stop",
    "Re-entry"
  ],
  "Solo": [
    "Instrumental",
    "Synth Lead",
    "Guitar Solo",
    "Piano Solo",
    "Sax Solo",
    "Drum Fill",
    "Lead Melody",
    "Expressive Solo",
    "Short Solo",
    "Breakdown",
    "Rebuild Start",
    "Wide Lead"
  ],
  "Rap Section": [
    "Rap",
    "Fast Rap",
    "Rhythmic Flow",
    "Off-beat Flow",
    "Punchy Reply",
    "Dry Spoken Rap",
    "Character Switch",
    "Sparse Arrangement",
    "Groove Driven",
    "Call-and-response",
    "Low Voice Rap",
    "Sassy Rap"
  ],
  "Rap Verse": [
    "Rap",
    "Fast Rap",
    "Rhythmic Flow",
    "Off-beat Flow",
    "Punchy Reply",
    "Dry Spoken Rap",
    "Character Switch",
    "Sparse Arrangement",
    "Groove Driven",
    "Call-and-response",
    "Low Voice Rap",
    "Sassy Rap"
  ],
  "Instrumental": [
    "Piano",
    "Acoustic Guitar",
    "Electric Guitar",
    "Strings",
    "Synth Lead",
    "Pluck",
    "Gayageum",
    "Haegeum",
    "Taepyeongso",
    "Saxophone",
    "Flute",
    "Cello"
  ],
  "Outro": [
    "Fade-out",
    "Soft Ending",
    "Gradual Exit",
    "Echo Finish",
    "Energy Release",
    "Minimal Ending",
    "Calm Closure",
    "Loop-friendly Ending",
    "Final Breath",
    "Last Chord",
    "Ambient Fade",
    "Soft Closure"
  ],
  "Theme A": [
    "Main Theme",
    "Motif",
    "Character Theme",
    "Melodic Theme",
    "Story Focused",
    "Low Energy",
    "Rhythmic Flow",
    "Groove Driven",
    "Tension Hint",
    "Warm Theme",
    "Dark Theme",
    "Repeat Motif"
  ],
  "Theme B": [
    "Main Theme",
    "Motif",
    "Character Theme",
    "Melodic Theme",
    "Story Focused",
    "Low Energy",
    "Rhythmic Flow",
    "Groove Driven",
    "Tension Hint",
    "Warm Theme",
    "Dark Theme",
    "Repeat Motif"
  ],
  "Build-up": [
    "Build-up",
    "Rising Energy",
    "Tension Lift",
    "Dynamic Increase",
    "Momentum Shift",
    "Intensity Growth",
    "Lead-in",
    "Anticipation",
    "Pre-drop Pause",
    "Drum Lift",
    "Vocal Push",
    "Final Lift"
  ],
  "Main Theme": [
    "Main Theme",
    "Hook Emphasis",
    "Anthemic",
    "Lead Melody",
    "Motif",
    "Wide Impact",
    "Full Arrangement",
    "Strong Hook",
    "Emotional Peak",
    "Singalong Hook",
    "Layered Vocals",
    "Power Drive"
  ],
  "Climax": [
    "Climax",
    "Peak Section",
    "Explosive",
    "Full Arrangement",
    "High Energy",
    "Wide Impact",
    "Powerful Delivery",
    "Final Lift",
    "Big Drums",
    "Last Hook",
    "Bright Release",
    "Emotional Peak"
  ],
};
export const INSTRUMENT_TAGS = [
  "Piano",
  "Acoustic Guitar",
  "Electric Guitar",
  "Synth",
  "Pad",
  "Strings",
  "Bass",
  "Drums",
  "Percussion",
  "Pluck",
  "Brass",
  "FX"
] as const;

export const INSTRUMENTAL_SOLO_TAGS = [
  "Piano",
  "Acoustic Guitar",
  "Electric Guitar",
  "Strings",
  "Synth Lead",
  "Pluck",
  "Gayageum",
  "Haegeum",
  "Taepyeongso",
  "Saxophone",
  "Flute",
  "Cello"
] as const;

export const INSTRUMENT_TAG_DESCRIPTIONS: Record<string, string> = {
  "Piano": "피아노를 중심에 둡니다.",
  "Acoustic Guitar": "어쿠스틱 기타를 둡니다.",
  "Electric Guitar": "일렉 기타를 앞세웁니다.",
  "Strings": "스트링을 강조합니다.",
  "Synth Lead": "신스 리드를 세웁니다.",
  "Pluck": "플럭 사운드를 씁니다.",
  "Gayageum": "가야금을 강조합니다.",
  "Haegeum": "해금을 강조합니다.",
  "Taepyeongso": "태평소를 강조합니다.",
  "Saxophone": "색소폰을 앞세웁니다.",
  "Flute": "플루트를 앞세웁니다.",
  "Cello": "첼로를 앞세웁니다.",
  "Synth": "신스를 중심에 둡니다.",
  "Pad": "패드로 공간을 채웁니다.",
  "Bass": "베이스를 강조합니다.",
  "Drums": "드럼을 강조합니다.",
  "Percussion": "퍼커션을 더합니다.",
  "Brass": "브라스를 더합니다.",
  "FX": "효과음을 더합니다."
};
export const TAG_DESCRIPTIONS = {
  "Minimal": "소리를 덜어 여백을 만듭니다.",
  "Ambient Start": "공간감 있게 시작합니다.",
  "Soft Entry": "부드럽게 들어옵니다.",
  "Instrumental Opening": "연주로 문을 엽니다.",
  "Gradual Layering": "소리가 차례로 쌓입니다.",
  "Teaser Opening": "짧게 분위기를 던집니다.",
  "Hook-first": "처음부터 훅을 보여줍니다.",
  "Fade-in": "서서히 나타납니다.",
  "Cold Open": "바로 시작합니다.",
  "Spoken Intro": "말하듯 시작합니다.",
  "Atmosphere Intro": "분위기를 먼저 만듭니다.",
  "Muted Opening": "눌린 톤으로 시작합니다.",
  "Low Energy": "차분하게 낮춥니다.",
  "Story Focused": "이야기를 또렷하게 둡니다.",
  "Rhythmic Flow": "리듬을 살려 흐릅니다.",
  "Sparse Arrangement": "구성을 비워 둡니다.",
  "Groove Driven": "그루브가 중심입니다.",
  "Laid-back": "느긋하게 밀고 갑니다.",
  "Steady Pace": "일정하게 이어갑니다.",
  "Subtle Build": "조용히 쌓아갑니다.",
  "Intimate Delivery": "가깝게 들려줍니다.",
  "Conversational": "대화하듯 전개합니다.",
  "Melodic Verse": "멜로디로 절을 이끕니다.",
  "Tension Hint": "긴장을 살짝 남깁니다.",
  "Build-up": "점점 고조됩니다.",
  "Rising Energy": "에너지가 올라갑니다.",
  "Tension Lift": "긴장을 끌어올립니다.",
  "Dynamic Increase": "밀도를 키웁니다.",
  "Momentum Shift": "다음 흐름을 준비합니다.",
  "Intensity Growth": "강도를 높입니다.",
  "Lead-in": "다음 구간으로 잇습니다.",
  "Anticipation": "기대감을 만듭니다.",
  "Pre-drop Pause": "드롭 전 멈칫합니다.",
  "Harmony Lift": "화성으로 들어올립니다.",
  "Drum Lift": "드럼으로 밀어올립니다.",
  "Vocal Push": "보컬을 앞으로 냅니다.",
  "High Energy": "에너지를 강하게 냅니다.",
  "Explosive": "강하게 터뜨립니다.",
  "Full Arrangement": "편곡을 꽉 채웁니다.",
  "Peak Section": "정점처럼 만듭니다.",
  "Anthemic": "떼창감 있게 만듭니다.",
  "Wide Impact": "넓고 크게 퍼집니다.",
  "Powerful Delivery": "강하게 전달합니다.",
  "Hook Emphasis": "훅을 강조합니다.",
  "Singalong Hook": "따라 부르게 만듭니다.",
  "Layered Vocals": "보컬을 겹칩니다.",
  "Big Drums": "드럼을 크게 냅니다.",
  "Bright Release": "밝게 풀어냅니다.",
  "Final Lift": "마지막으로 들어올립니다.",
  "Last Hook": "마지막 훅을 강조합니다.",
  "Catchy Repeat": "짧게 반복해 각인합니다.",
  "Short Phrase": "짧은 구절을 씁니다.",
  "Loop Hook": "반복되는 훅을 만듭니다.",
  "Call-and-response": "주고받는 훅입니다.",
  "Rhythmic Hook": "리듬 훅을 만듭니다.",
  "Earworm": "귀에 남게 만듭니다.",
  "Minimal Hook": "작게 반복합니다.",
  "Vocal Chop Hook": "보컬 조각을 훅으로 씁니다.",
  "Sassy Hook": "도도한 훅으로 갑니다.",
  "Punchline Hook": "한 줄 훅을 꽂습니다.",
  "Chant Hook": "구호처럼 반복합니다.",
  "Bass Drop": "베이스로 떨어집니다.",
  "Beat Drop": "비트가 터집니다.",
  "Dance Break": "댄스 구간으로 엽니다.",
  "Impact Hit": "강한 타격을 줍니다.",
  "Synth Burst": "신스를 터뜨립니다.",
  "Drum Drop": "드럼으로 떨어집니다.",
  "Energy Drop": "에너지를 낮춥니다.",
  "Contrast Section": "대비를 만듭니다.",
  "Minimal Reset": "최소 구성으로 리셋합니다.",
  "Unexpected Shift": "예상 밖으로 전환합니다.",
  "Dynamic Change": "흐름을 크게 바꿉니다.",
  "Rebuild Start": "다시 쌓기 시작합니다.",
  "Transition Focused": "전환을 분명히 합니다.",
  "Emotional Turn": "감정을 뒤집습니다.",
  "Mood Shift": "분위기를 전환합니다.",
  "Half-time Feel": "박자를 넓게 느끼게 합니다.",
  "Space Open": "공간을 넓힙니다.",
  "Soft Collapse": "부드럽게 무너집니다.",
  "Breakdown": "구성을 분해합니다.",
  "Stripped Down": "소리를 걷어냅니다.",
  "Drum Break": "드럼만 부각합니다.",
  "Bass Focus": "베이스를 앞세웁니다.",
  "Silence Gap": "짧은 정적을 둡니다.",
  "Glitch Break": "글리치로 끊습니다.",
  "Percussion Break": "퍼커션을 세웁니다.",
  "Tension Hold": "긴장을 붙잡습니다.",
  "Short Break": "짧게 끊어갑니다.",
  "Stop Moment": "잠깐 멈춥니다.",
  "Drum Fill": "드럼 필로 넘깁니다.",
  "Breath Pause": "숨 쉴 틈을 둡니다.",
  "Impact Cut": "강하게 잘라냅니다.",
  "Quick Reset": "빠르게 리셋합니다.",
  "Vocal Drop": "보컬을 잠시 뺍니다.",
  "Beat Cut": "비트를 끊습니다.",
  "Re-entry": "다시 들어옵니다.",
  "Hard Stop": "딱 멈춥니다.",
  "Sound Cut": "소리를 잘라냅니다.",
  "Freeze": "얼어붙듯 멈춥니다.",
  "Dead Stop": "완전히 정지합니다.",
  "One-beat Pause": "한 박자 쉽니다.",
  "Dropout": "소리를 확 뺍니다.",
  "Clean Stop": "깔끔하게 멈춥니다.",
  "Instrumental": "연주 중심으로 갑니다.",
  "Guitar Solo": "기타 솔로를 둡니다.",
  "Piano Solo": "피아노 솔로를 둡니다.",
  "Sax Solo": "색소폰 솔로를 둡니다.",
  "Lead Melody": "리드 멜로디를 세웁니다.",
  "Expressive Solo": "표현적인 솔로입니다.",
  "Short Solo": "짧은 솔로를 넣습니다.",
  "Wide Lead": "넓은 리드를 냅니다.",
  "Rap": "랩 구간을 만듭니다.",
  "Fast Rap": "빠르게 랩합니다.",
  "Off-beat Flow": "박자를 비껴 탑니다.",
  "Punchy Reply": "짧고 세게 답합니다.",
  "Dry Spoken Rap": "건조하게 말하듯 랩합니다.",
  "Character Switch": "화자를 바꿉니다.",
  "Low Voice Rap": "낮은 톤 랩입니다.",
  "Sassy Rap": "도도하게 랩합니다.",
  "Fade-out": "서서히 사라집니다.",
  "Soft Ending": "부드럽게 끝냅니다.",
  "Gradual Exit": "천천히 빠집니다.",
  "Echo Finish": "잔향을 남깁니다.",
  "Energy Release": "쌓인 힘을 풉니다.",
  "Minimal Ending": "간결하게 끝냅니다.",
  "Calm Closure": "차분히 닫습니다.",
  "Loop-friendly Ending": "반복 연결을 남깁니다.",
  "Final Breath": "마지막 숨결처럼 닫습니다.",
  "Last Chord": "마지막 코드로 끝냅니다.",
  "Ambient Fade": "공간감으로 사라집니다.",
  "Soft Closure": "부드럽게 정리합니다.",
  "Main Theme": "주요 테마를 세웁니다.",
  "Motif": "짧은 동기를 반복합니다.",
  "Character Theme": "캐릭터 테마를 둡니다.",
  "Melodic Theme": "멜로디 테마를 세웁니다.",
  "Warm Theme": "따뜻한 테마로 갑니다.",
  "Dark Theme": "어두운 테마로 갑니다.",
  "Repeat Motif": "동기를 다시 꺼냅니다.",
  "Strong Hook": "강한 훅을 세웁니다.",
  "Emotional Peak": "감정을 정점에 둡니다.",
  "Power Drive": "힘 있게 밀어붙입니다.",
  "Climax": "최고조로 갑니다."
};

// --- Variant Lookups for Keyword Resolution ---

export const STYLE_VARIANT_LOOKUP = (STYLE_CYCLES as readonly any[]).flatMap((cycle) => cycle.variants).filter((variant: any) => variant.kind !== 'separator').reduce<Record<string, any>>((acc, variant: any) => {
  acc[variant.id] = variant;
  return acc;
}, {});

export const STYLE_LABEL_TO_ID = (STYLE_CYCLES as readonly any[]).flatMap((cycle) => cycle.variants).filter((variant: any) => variant.kind !== 'separator').reduce<Record<string, string>>((acc, variant: any) => {
  acc[variant.label] = variant.id;
  return acc;
}, {});

export const SOUND_VARIANT_LOOKUP = (SOUND_TEXTURE_CYCLES as readonly any[]).flatMap((cycle) => cycle.variants).filter((variant: any) => variant.kind !== 'separator').reduce<Record<string, any>>((acc, variant: any) => {
  acc[variant.id] = variant;
  return acc;
}, {});

export const SOUND_LABEL_TO_ID = (SOUND_TEXTURE_CYCLES as readonly any[]).flatMap((cycle) => cycle.variants).filter((variant: any) => variant.kind !== 'separator').reduce<Record<string, string>>((acc, variant: any) => {
  acc[variant.label] = variant.id;
  return acc;
}, {});






// --- Genre Instrument Profiles for 2-Genre Fusion Prompting ---
// Used by geminiService to make the selected genre(s) bring real sound materials,
// not just genre names. Keep each list short so the final Suno prompt stays compact.
export type GenreInstrumentProfile = {
  instruments: string[];
  rhythm?: string[];
  texture?: string[];
};

export const GENRE_INSTRUMENT_PROFILES: Record<string, GenreInstrumentProfile> = {
  pop: { instruments: ['clean pop drums', 'round bass', 'polished synth', 'bright piano'], rhythm: ['steady pop groove'], texture: ['radio-ready polish'] },
  'dance-pop': { instruments: ['punchy kick', 'dance bass', 'bright synth stabs', 'clap layers'], rhythm: ['four-on-the-floor pulse'], texture: ['glossy club-pop mix'] },
  'synth-pop': { instruments: ['analog synth', 'warm pad', 'sequenced bass', 'electronic drums'], rhythm: ['steady synth pulse'], texture: ['retro-futuristic sheen'] },
  'teen-pop': { instruments: ['bright synth', 'clean guitar', 'snappy drums', 'pop bass'], rhythm: ['light upbeat groove'], texture: ['fresh glossy texture'] },
  kpop: { instruments: ['punchy pop drums', 'wide synth layers', 'tight bass', 'hook stabs'], rhythm: ['sharp section-switch groove'], texture: ['polished Korean pop mix'] },
  jpop: { instruments: ['bright electric guitar', 'sparkling piano', 'melodic bass', 'anime-style synth lead'], rhythm: ['driving pop-rock pulse'], texture: ['wide melodic lift'] },
  citypop: { instruments: ['groovy bass', 'clean funk guitar', 'DX7-style electric piano', 'warm synth'], rhythm: ['smooth urban groove'], texture: ['night-drive retro sheen'] },
  'piano-ballad': { instruments: ['emotional piano', 'soft strings', 'warm bass', 'gentle drums'], rhythm: ['slow emotional build'], texture: ['intimate ballad space'] },
  'adult-contemporary': { instruments: ['soft piano', 'smooth electric guitar', 'warm bass', 'light strings'], rhythm: ['steady mid-tempo flow'], texture: ['clean mature polish'] },
  'indie-pop': { instruments: ['jangly guitar', 'soft synth', 'simple drum kit', 'warm bass'], rhythm: ['loose indie groove'], texture: ['natural handmade texture'] },
  'chamber-pop': { instruments: ['pizzicato strings', 'chamber strings', 'soft piano', 'woodwind color'], rhythm: ['delicate orchestral movement'], texture: ['ornate intimate space'] },

  grunge: { instruments: ['distorted guitar', 'heavy bass', 'raw drums'], rhythm: ['sludgy rock drive'], texture: ['gritty garage distortion'] },
  britpop: { instruments: ['jangly electric guitar', 'melodic bass', 'live drums', 'organ color'], rhythm: ['confident band groove'], texture: ['90s British guitar sheen'] },
  shoegaze: { instruments: ['wall-of-sound guitars', 'washed pads', 'reverb drums'], rhythm: ['slow blurred pulse'], texture: ['dreamy reverb haze'] },
  'post-rock': { instruments: ['delayed guitar', 'cinematic drums', 'ambient pads', 'swelling bass'], rhythm: ['gradual instrumental build'], texture: ['wide cinematic space'] },
  'punk-rock': { instruments: ['fast power chords', 'driving bass', 'raw drums'], rhythm: ['straight punk drive'], texture: ['rough live energy'] },
  'heavy-metal': { instruments: ['distorted riffs', 'double-kick drums', 'heavy bass'], rhythm: ['aggressive metal drive'], texture: ['dense high-gain wall'] },
  'thrash-metal': { instruments: ['palm-muted guitar', 'rapid drums', 'cutting bass'], rhythm: ['fast thrash attack'], texture: ['sharp metallic edge'] },
  'death-metal': { instruments: ['low distorted guitars', 'blast drums', 'sub-heavy bass'], rhythm: ['extreme blast movement'], texture: ['dark abrasive density'] },
  'progressive-rock': { instruments: ['complex guitar lines', 'synth keys', 'dynamic drums', 'melodic bass'], rhythm: ['shifting odd-meter feel'], texture: ['layered progressive depth'] },
  'psychedelic-rock': { instruments: ['phased guitar', 'organ', 'loose drums', 'fuzzy bass'], rhythm: ['trippy rolling groove'], texture: ['swirling analog haze'] },
  rock: { instruments: ['electric guitar', 'live drums', 'driving bass'], rhythm: ['band-driven pulse'], texture: ['live amp energy'] },
  metal: { instruments: ['high-gain guitar', 'double-kick drums', 'heavy bass'], rhythm: ['hard metallic drive'], texture: ['dense distorted wall'] },

  'boom-bap': { instruments: ['sampled drums', 'dusty vinyl chops', 'warm bass'], rhythm: ['head-nod boom-bap swing'], texture: ['dusty sample texture'] },
  trap: { instruments: ['808 bass', 'rapid hi-hats', 'dark synth lead', 'snare rolls'], rhythm: ['half-time trap bounce'], texture: ['cold sub-heavy space'] },
  drill: { instruments: ['sliding 808', 'drill hats', 'dark piano', 'sparse strings'], rhythm: ['syncopated drill bounce'], texture: ['icy street tension'] },
  'gangsta-rap': { instruments: ['G-funk synth', 'thick bass', 'hard drums'], rhythm: ['laid-back rap groove'], texture: ['streetwise analog color'] },
  'lofi-hiphop': { instruments: ['dusty keys', 'soft vinyl drums', 'mellow bass', 'sample chops'], rhythm: ['lazy swung beat'], texture: ['vinyl crackle warmth'] },
  'contemporary-rnb': { instruments: ['silky keys', 'sub bass', 'minimal drums', 'smooth pads'], rhythm: ['slow R&B pocket'], texture: ['glossy late-night space'] },
  motown: { instruments: ['soul bass', 'handclaps', 'brass hits', 'upright piano'], rhythm: ['classic soul backbeat'], texture: ['vintage tape warmth'] },
  gospel: { instruments: ['gospel piano', 'organ', 'choir pads', 'live drums'], rhythm: ['churchy uplift groove'], texture: ['spiritual hall warmth'] },
  'funk-rnb': { instruments: ['slap bass', 'wah guitar', 'tight drums', 'clavinet'], rhythm: ['syncopated funk groove'], texture: ['dry rhythmic pocket'] },
  'pb-rnb': { instruments: ['dark pads', 'sub bass', 'minimal percussion', 'processed keys'], rhythm: ['slow shadowy groove'], texture: ['nocturnal alternative R&B haze'] },
  'jazz-hiphop': { instruments: ['jazz piano', 'upright bass', 'dusty drums', 'saxophone color'], rhythm: ['laid-back jazz-hop swing'], texture: ['smoky sample warmth'] },
  'neo-soul': { instruments: ['Rhodes piano', 'warm bass', 'live drums', 'soul guitar'], rhythm: ['deep pocket groove'], texture: ['organic velvet warmth'] },
  hiphop: { instruments: ['hard drums', '808 or sampled bass', 'sample chops'], rhythm: ['rap-forward groove'], texture: ['beat-centered punch'] },
  rnb: { instruments: ['smooth keys', 'sub bass', 'soft drums', 'lush pads'], rhythm: ['slow pocket groove'], texture: ['velvet vocal space'] },

  house: { instruments: ['four-on-the-floor kick', 'piano stabs', 'deep bass', 'hi-hat loops'], rhythm: ['steady house pulse'], texture: ['club-room movement'] },
  techno: { instruments: ['analog kick', 'acid synth', 'modular pulses', 'industrial hats'], rhythm: ['hypnotic techno loop'], texture: ['mechanical warehouse space'] },
  trance: { instruments: ['supersaw lead', 'rolling bass', 'uplifting pads', 'riser FX'], rhythm: ['driving trance pulse'], texture: ['wide euphoric lift'] },
  dubstep: { instruments: ['wobble bass', 'half-time drums', 'growl synth', 'impact FX'], rhythm: ['half-time drop movement'], texture: ['aggressive bass pressure'] },
  'drum-and-bass': { instruments: ['fast breakbeats', 'reese bass', 'rolling hats', 'atmospheric pads'], rhythm: ['rapid breakbeat flow'], texture: ['high-speed low-end pressure'] },
  'future-bass': { instruments: ['sidechained chords', 'sub bass', 'vocal chops', 'bright synth lead'], rhythm: ['bouncy future groove'], texture: ['wide emotional drop'] },
  'ambient-electronic': { instruments: ['soft drones', 'granular pads', 'slow pulses', 'field ambience'], rhythm: ['minimal slow movement'], texture: ['deep atmospheric space'] },
  vaporwave: { instruments: ['slowed synths', 'retro keys', 'soft drum machine', 'tape wobble'], rhythm: ['slowed nostalgic pulse'], texture: ['hazy digital nostalgia'] },
  'electro-pop': { instruments: ['bright synth bass', 'electronic drums', 'arpeggiated synth', 'pop stabs'], rhythm: ['crisp electro-pop bounce'], texture: ['clean neon polish'] },
  eurobeat: { instruments: ['fast synth brass', 'driving bass', 'pumping drums', 'bright leads'], rhythm: ['high-speed dance pulse'], texture: ['flashy energetic sheen'] },
  edm: { instruments: ['festival kick', 'big synth lead', 'sidechain bass', 'riser FX'], rhythm: ['drop-centered dance pulse'], texture: ['wide festival impact'] },

  swing: { instruments: ['walking bass', 'swing drums', 'brass section', 'jazz piano'], rhythm: ['swinging jazz groove'], texture: ['vintage ballroom warmth'] },
  bebop: { instruments: ['upright bass', 'ride cymbal', 'bebop piano', 'horn lines'], rhythm: ['fast bebop swing'], texture: ['small-club jazz clarity'] },
  'cool-jazz': { instruments: ['muted trumpet', 'soft piano', 'upright bass', 'brush drums'], rhythm: ['relaxed cool swing'], texture: ['smoky late-night space'] },
  'hard-bop': { instruments: ['hard-bop horns', 'walking bass', 'soulful piano', 'driving drums'], rhythm: ['soul-jazz swing'], texture: ['warm club energy'] },
  'free-jazz': { instruments: ['free saxophone', 'loose drums', 'prepared piano', 'upright bass'], rhythm: ['unfixed improvisational motion'], texture: ['raw exploratory space'] },
  'fusion-jazz': { instruments: ['electric piano', 'jazz-funk bass', 'fusion guitar', 'tight drums'], rhythm: ['jazz-funk fusion groove'], texture: ['slick electric jazz color'] },
  bossanova: { instruments: ['nylon guitar', 'soft percussion', 'upright bass', 'gentle piano'], rhythm: ['bossa nova sway'], texture: ['warm seaside intimacy'] },
  'acid-jazz': { instruments: ['funk bass', 'Rhodes keys', 'brass stabs', 'breakbeat drums'], rhythm: ['acid-jazz groove'], texture: ['club-jazz warmth'] },
  'delta-blues': { instruments: ['slide guitar', 'foot stomp', 'raw acoustic guitar'], rhythm: ['slow blues shuffle'], texture: ['dusty porch realism'] },
  'chicago-blues': { instruments: ['electric blues guitar', 'harmonica', 'walking bass', 'shuffle drums'], rhythm: ['electric blues shuffle'], texture: ['smoky bar-room grit'] },
  jazz: { instruments: ['jazz piano', 'upright bass', 'brush drums', 'horn color'], rhythm: ['swinging jazz movement'], texture: ['smoky club space'] },
  classical: { instruments: ['strings', 'piano', 'woodwinds', 'orchestral percussion'], rhythm: ['orchestral dynamic movement'], texture: ['cinematic concert-hall depth'] },

  'modern-folk': { instruments: ['acoustic guitar', 'warm bass', 'light percussion', 'soft strings'], rhythm: ['gentle folk strum'], texture: ['honest acoustic warmth'] },
  'anti-folk': { instruments: ['raw acoustic guitar', 'loose percussion', 'room noise'], rhythm: ['rough conversational strum'], texture: ['unpolished indie realism'] },
  'folk-rock': { instruments: ['acoustic guitar', 'electric guitar', 'live drums', 'melodic bass'], rhythm: ['folk-rock band drive'], texture: ['rootsy live warmth'] },
  'singer-songwriter': { instruments: ['intimate acoustic guitar', 'soft piano', 'warm bass'], rhythm: ['lyric-led gentle pulse'], texture: ['close room intimacy'] },
  'world-music': { instruments: ['hand percussion', 'ethnic strings', 'flutes', 'drone textures'], rhythm: ['organic world rhythm'], texture: ['earthy global color'] },
  'country-pop': { instruments: ['acoustic guitar', 'banjo color', 'lap steel', 'pop drums'], rhythm: ['country-pop shuffle'], texture: ['bright Nashville polish'] },
  bluegrass: { instruments: ['banjo', 'mandolin', 'fiddle', 'upright bass'], rhythm: ['fast bluegrass picking'], texture: ['live string-band energy'] },
  americana: { instruments: ['acoustic guitar', 'organ', 'roots bass', 'brush drums'], rhythm: ['rootsy Americana sway'], texture: ['dusty road warmth'] },
  'honky-tonk': { instruments: ['honky-tonk piano', 'twang guitar', 'upright bass', 'shuffle drums'], rhythm: ['bar-room country bounce'], texture: ['vintage saloon color'] },
  'southern-rock': { instruments: ['slide guitar', 'organ', 'big drums', 'southern bass'], rhythm: ['southern rock swagger'], texture: ['warm amp grit'] },
  acoustic_folk: { instruments: ['acoustic guitar', 'soft strings', 'light percussion'], rhythm: ['gentle acoustic strum'], texture: ['warm folk intimacy'] },
  world_music_folk: { instruments: ['traditional strings', 'hand percussion', 'wood flute'], rhythm: ['folk-world pulse'], texture: ['organic traditional color'] },
  pansori_fusion: { instruments: ['janggu rhythm', 'gayageum plucks', 'piri breath line', 'haegeum color', 'modern bass'], rhythm: ['janggu-driven traditional pulse'], texture: ['Korean gugak breath in modern crossover space'] },
  'pansori-fusion': { instruments: ['janggu rhythm', 'gayageum plucks', 'piri breath line', 'haegeum color', 'modern bass'], rhythm: ['janggu-driven traditional pulse'], texture: ['Korean gugak breath in modern crossover space'] },
  gugak_fusion: { instruments: ['gayageum plucks', 'haegeum line', 'janggu percussion', 'daegeum breath'], rhythm: ['Korean traditional pulse'], texture: ['gugak instrumental breath with modern space'] },
  'gugak-fusion': { instruments: ['gayageum plucks', 'haegeum line', 'janggu percussion', 'daegeum breath'], rhythm: ['Korean traditional pulse'], texture: ['gugak instrumental breath with modern space'] },

  'traditional-trot': { instruments: ['accordion', 'brass section', 'trot rhythm guitar', 'classic drum kit'], rhythm: ['traditional trot bounce'], texture: ['nostalgic Korean stage color'] },
  'semi-trot': { instruments: ['bright brass', 'dance drums', 'accordion accents', 'electric bass'], rhythm: ['modern trot two-beat'], texture: ['festive stage polish'] },
  trot: { instruments: ['accordion', 'brass accents', 'trot guitar', 'live drums'], rhythm: ['trot bounce'], texture: ['Korean popular-stage warmth'] },
  '7080_gayo': { instruments: ['analog electric piano', 'clean guitar', 'warm bass', 'vintage drums'], rhythm: ['70s-80s gayo groove'], texture: ['analog Korean retro warmth'] },
  ost: { instruments: ['cinematic piano', 'strings', 'soft percussion', 'ambient pad'], rhythm: ['scene-led emotional flow'], texture: ['drama-like cinematic space'] },

  'film-score': { instruments: ['orchestral strings', 'cinematic brass', 'taiko-like percussion', 'piano motifs'], rhythm: ['cinematic scene movement'], texture: ['wide film-score depth'] },
  'game-bgm': { instruments: ['loopable synth lead', 'hybrid drums', 'game pads', 'motif plucks'], rhythm: ['loop-friendly game pulse'], texture: ['clear interactive texture'] },
  'drama-theme': { instruments: ['emotional piano', 'strings', 'soft guitar', 'ambient pad'], rhythm: ['drama-theme build'], texture: ['warm OST atmosphere'] },
  'piano-instrumental': { instruments: ['solo piano', 'felt piano resonance', 'soft pedal noise'], rhythm: ['rubato piano flow'], texture: ['intimate room tone'] },
  'guitar-instrumental': { instruments: ['solo guitar', 'fingerstyle patterns', 'warm string resonance'], rhythm: ['natural fingerpicked pulse'], texture: ['close acoustic texture'] },
  'lofi-instrumental': { instruments: ['lo-fi keys', 'soft vinyl drums', 'warm bass', 'tape hiss'], rhythm: ['lazy lo-fi loop'], texture: ['dusty cassette warmth'] },
  'healing-music': { instruments: ['soft piano', 'warm pads', 'gentle bells', 'nature ambience'], rhythm: ['slow calming movement'], texture: ['healing spacious air'] },
  'meditation-music': { instruments: ['drone pads', 'singing bowls', 'soft bells', 'breath-like ambience'], rhythm: ['near-still meditative flow'], texture: ['deep calm space'] },
  'ambient-newage': { instruments: ['new-age pads', 'soft piano', 'airy bells', 'distant strings'], rhythm: ['slow floating movement'], texture: ['peaceful ambient glow'] },
};


// ==========================================
// Vocal Character Builder Data
// ==========================================
// UI 원칙:
// - 창법은 실제 명칭 + 쉬운 설명 + 용도 태그를 공개한다.
// - 실제 프롬프트에는 창법명만 쓰지 않고 자연어 묘사까지 함께 넣는다.
// - 기본 창법/실험 창법 모두 [Vocals]의 전체 보컬 정체성으로 사용 가능하다.
// - Lyrics 대괄호 강조는 별도 단계에서 특정 구간 강조용으로만 사용한다.

export const VOCAL_TECHNIQUES = [
  // 1. 발성 및 성구 — 소리의 기본 위치와 무게
  {
    id: 'chest_voice',
    category: 'basic',
    groupKo: '발성 및 성구',
    label: 'Chest Voice',
    labelKo: '흉성',
    descriptionKo: '가슴 울림으로 낮고 단단하게 내는 소리',
    usageKo: ['안정감', '무게감', '진심', '낮은 감정'],
    promptCore: 'low chest voice',
    promptNatural: 'low chest voice with solid grounded resonance, like an everyday voice carrying trust and weight',
  },
  {
    id: 'head_voice',
    category: 'basic',
    groupKo: '발성 및 성구',
    label: 'Head Voice',
    labelKo: '두성',
    descriptionKo: '머리 울림으로 맑고 시원하게 뻗는 고음',
    usageKo: ['청량함', '해방감', '고음 피크', '밝은 감정'],
    promptCore: 'clear head voice',
    promptNatural: 'clear head voice with bright open high notes that feel transparent and lifted',
  },
  {
    id: 'mixed_voice',
    category: 'basic',
    groupKo: '발성 및 성구',
    label: 'Mixed Voice',
    labelKo: '믹스보이스',
    descriptionKo: '고음에서도 얇아지지 않게 힘을 섞는 소리',
    usageKo: ['현대 보컬', '단단한 고음', '연결감', '후렴'],
    promptCore: 'connected mixed voice',
    promptNatural: 'connected mixed voice that keeps high notes strong without thinning out',
  },
  {
    id: 'falsetto',
    category: 'basic',
    groupKo: '발성 및 성구',
    label: 'Falsetto',
    labelKo: '팔세토',
    descriptionKo: '가볍고 여리게 빠지는 가성',
    usageKo: ['여림', '공기감', '상처', '얇은 고음'],
    promptCore: 'light falsetto',
    promptNatural: 'light airy falsetto that feels fragile like glass on high notes',
  },
  {
    id: 'belting',
    category: 'basic',
    groupKo: '발성 및 성구',
    label: 'Belting',
    labelKo: '벨팅',
    descriptionKo: '고음을 진성처럼 강하게 밀어 올리는 창법',
    usageKo: ['폭발감', '클라이맥스', '감정 분출', '강한 후렴'],
    promptCore: 'powerful belting',
    promptNatural: 'powerful chest-like belting that pushes high notes forward with explosive emotion',
  },

  // 2. 질감과 공기 — 소리의 표면 처리와 분위기
  {
    id: 'breathy',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Breathy',
    labelKo: '브레시',
    descriptionKo: '숨을 섞어 속삭이듯 부르는 소리',
    usageKo: ['고백', '비밀', '섬세함', '가까운 거리감'],
    promptCore: 'breathy vocal',
    promptNatural: 'breathy vocal with air-mixed soft delivery, leaving a small sigh after phrases',
  },
  {
    id: 'airy',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Airy',
    labelKo: '에어리',
    descriptionKo: '입김처럼 가볍고 멀게 퍼지는 공기감',
    usageKo: ['몽환', '공간감', '가벼움', '희미함'],
    promptCore: 'airy vocal',
    promptNatural: 'airy vocal that feels light, distant, and almost like breath more than voice',
  },
  {
    id: 'vocal_fry',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Vocal Fry',
    labelKo: '보컬 프라이',
    descriptionKo: '낮게 지글거리는 질감으로 무게를 주는 소리',
    usageKo: ['낮은 무게', '피로감', '건조함', '말끝'],
    promptCore: 'vocal fry',
    promptNatural: 'low crackling vocal fry at phrase starts or endings, adding dry weight',
  },
  {
    id: 'edge_voice',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Edge Voice',
    labelKo: '엣지 보이스',
    descriptionKo: '성대 끝을 붙여 날카로운 감정을 내는 소리',
    usageKo: ['긴장감', '분노', '절박함', '강한 표현'],
    promptCore: 'edge voice',
    promptNatural: 'subtle edge voice with a sharp emotional bite, like a feeling catching on the throat',
  },
  {
    id: 'creaky_voice',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Creaky Voice',
    labelKo: '크리키 보이스',
    descriptionKo: '자다 깬 듯 목소리가 드르륵 갈라지는 소리',
    usageKo: ['위태로움', '억누름', '불안', '터지기 직전'],
    promptCore: 'creaky voice',
    promptNatural: 'creaky voice with cracked sleepy edges, as if emotion is held back right before breaking',
  },
  {
    id: 'husky',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Husky',
    labelKo: '허스키',
    descriptionKo: '거칠고 탁한 마찰이 있는 목소리',
    usageKo: ['진한 감정', '성숙함', '상처', '거친 결'],
    promptCore: 'husky vocal',
    promptNatural: 'husky textured vocal with a rough human edge and lonely grain',
  },
  {
    id: 'growling',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Growling',
    labelKo: '그로울링',
    descriptionKo: '목을 긁어 짐승처럼 거칠게 내는 소리',
    usageKo: ['거친 분노', '락', '소울', '폭발감'],
    promptCore: 'growling vocal',
    promptNatural: 'rough growling vocal texture that scratches the throat with raw force',
  },
  {
    id: 'nasal',
    category: 'basic',
    groupKo: '질감과 공기',
    label: 'Nasal',
    labelKo: '비성',
    descriptionKo: '코의 울림을 섞어 앞쪽으로 모으는 소리',
    usageKo: ['선명함', '감미로움', '앞쪽 울림', '발라드'],
    promptCore: 'nasal resonance',
    promptNatural: 'focused nasal resonance that brings the voice forward with sweet clarity',
  },

  // 3. 선율 기교 — 음정과 떨림의 예술
  {
    id: 'vibrato',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Vibrato',
    labelKo: '비브라토',
    descriptionKo: '음을 흔들어 감정을 남기는 창법',
    usageKo: ['여운', '애절함', '고백', '긴 호흡'],
    promptCore: 'controlled vibrato',
    promptNatural: 'controlled vibrato that leaves emotion on sustained notes',
  },
  {
    id: 'bending',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Bending',
    labelKo: '벤딩',
    descriptionKo: '음을 끌어올리거나 눌러 쫀득하게 만드는 기교',
    usageKo: ['블루지함', '질척임', '소울', '감정 끌림'],
    promptCore: 'vocal bending',
    promptNatural: 'soft vocal bending that pulls the note with a sticky emotional feel',
  },
  {
    id: 'glissando',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Glissando',
    labelKo: '글리산도',
    descriptionKo: '한 음에서 다음 음으로 미끄러지듯 이어가는 창법',
    usageKo: ['부드러움', '몽환', '이어짐', '흐름'],
    promptCore: 'smooth glissando',
    promptNatural: 'smooth glissando sliding gently between notes like walking through clouded air',
  },
  {
    id: 'trill',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Trill',
    labelKo: '트릴',
    descriptionKo: '두 음을 빠르게 교차시키는 화려한 떨림',
    usageKo: ['화려함', '고전적', '숙련도', '장식음'],
    promptCore: 'vocal trill',
    promptNatural: 'quick vocal trill, rapidly alternating nearby notes with ornate tension',
  },
  {
    id: 'voice_flip',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Voice Flip',
    labelKo: '보이스 플립',
    descriptionKo: '진성과 가성이 순간적으로 툭 뒤집히는 소리',
    usageKo: ['울컥함', '애틋함', '찰나', '감정 흔들림'],
    promptCore: 'voice flip',
    promptNatural: 'sudden voice flip between full voice and falsetto, like emotion briefly catches and cracks',
  },
  {
    id: 'yodeling',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Yodeling',
    labelKo: '요들링',
    descriptionKo: '진성과 가성을 리듬 있게 반복해 튀는 소리',
    usageKo: ['컨트리', '인디팝', '리듬감', '독특함'],
    promptCore: 'yodeling flip',
    promptNatural: 'rhythmic yodeling flips between chest voice and falsetto for a playful broken lift',
  },
  {
    id: 'quarter_tone_bending',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Quarter-tone Bending',
    labelKo: '쿼터톤 벤딩',
    descriptionKo: '반음보다 좁은 음을 흔들어 본능적인 슬픔을 주는 기교',
    usageKo: ['본능적 슬픔', '동양적 결', '미세한 흔들림', '불안'],
    promptCore: 'quarter-tone bending',
    promptNatural: 'quarter-tone bending with tiny pitch bends that feel almost out of tune in a human, sorrowful way',
  },
  {
    id: 'blue_note',
    category: 'basic',
    groupKo: '선율 기교',
    label: 'Blue Note',
    labelKo: '블루 노트',
    descriptionKo: '음을 살짝 낮게 잡아 우울한 색을 입히는 창법',
    usageKo: ['재즈', '미련', '블루지함', '세련된 우울'],
    promptCore: 'blue-note inflection',
    promptNatural: 'blue-note inflection, slightly lowering notes to give the vocal a refined lingering sadness',
  },

  // 4. 박자와 발음 — 서사와 심리의 변칙
  {
    id: 'layback',
    category: 'basic',
    groupKo: '박자와 발음',
    label: 'Lay-back',
    labelKo: '레이백',
    descriptionKo: '박자 뒤에 살짝 기대어 여유롭게 부르는 방식',
    usageKo: ['그루브', '여유', '소울', '느긋함'],
    promptCore: 'laid-back phrasing',
    promptNatural: 'laid-back vocal timing that leans slightly behind the beat',
  },
  {
    id: 'anticipation',
    category: 'basic',
    groupKo: '박자와 발음',
    label: 'Anticipation',
    labelKo: '안티시페이션',
    descriptionKo: '박자보다 살짝 먼저 내뱉어 조급함을 드러내는 방식',
    usageKo: ['조급함', '긴장감', '설렘', '앞서는 마음'],
    promptCore: 'anticipated phrasing',
    promptNatural: 'anticipated phrasing that enters slightly before the beat, revealing hidden urgency',
  },
  {
    id: 'slurring',
    category: 'basic',
    groupKo: '박자와 발음',
    label: 'Slurring',
    labelKo: '슬러링',
    descriptionKo: '단어와 음을 끈적하게 이어 붙이는 방식',
    usageKo: ['질척임', '몽롱함', '술 취한 느낌', '흐림'],
    promptCore: 'slurred phrasing',
    promptNatural: 'slurred phrasing that lets words stick and melt into each other',
  },
  {
    id: 'muted_pronunciation',
    category: 'basic',
    groupKo: '박자와 발음',
    label: 'Muted Pronunciation',
    labelKo: '뮤트 발음',
    descriptionKo: '받침을 길게 눌러 웅얼거리듯 내면으로 가라앉는 발음',
    usageKo: ['내면', '침잠', '깊은 슬픔', '웅얼거림'],
    promptCore: 'muted pronunciation',
    promptNatural: 'muted pronunciation that presses final consonants inward, making the words sink quietly',
  },
  {
    id: 'detonation',
    category: 'basic',
    groupKo: '박자와 발음',
    label: 'Detonation',
    labelKo: '데토네이션',
    descriptionKo: '의도적으로 음정을 살짝 빗겨나가 무기력하게 부르는 방식',
    usageKo: ['무기력', '허무함', '피로', '위태로움'],
    promptCore: 'slightly detuned vocal',
    promptNatural: 'slightly detuned vocal delivery, as if the singer is too tired to hold the pitch perfectly',
  },
  {
    id: 'sprechgesang',
    category: 'basic',
    groupKo: '박자와 발음',
    label: 'Sprechgesang',
    labelKo: '스프레히슈티메',
    descriptionKo: '말과 노래 사이처럼 읊조리듯 부르는 방식',
    usageKo: ['독백', '대화형 가사', '담담함', '현실감'],
    promptCore: 'half-spoken half-sung delivery',
    promptNatural: 'half-spoken and half-sung delivery like a private confession',
  },
  {
    id: 'ghost_note',
    category: 'basic',
    groupKo: '박자와 발음',
    label: 'Ghost Note',
    labelKo: '고스트 노트',
    descriptionKo: '가사를 거의 발음하지 않고 스치듯 남기는 소리',
    usageKo: ['여운', '속삭임', '빈자리', '들릴 듯 말 듯'],
    promptCore: 'ghost-note vocal accents',
    promptNatural: 'ghost-note vocal accents where syllables barely appear, leaving a quiet afterimage',
  },

  // 5. 호흡과 공간 — 실험적이고 감각적인 장치
  {
    id: 'reverse_breath',
    category: 'basic',
    groupKo: '호흡과 공간',
    label: 'Reverse Breath',
    labelKo: '리버스 브레스',
    descriptionKo: '내뱉다 급히 들이마셔 말을 삼키는 숨',
    usageKo: ['망설임', '삼킴', '못 한 말', '불안'],
    promptCore: 'reverse breath',
    promptNatural: 'reverse breath that pulls air inward mid-phrase, like swallowing words that cannot be said',
  },
  {
    id: 'double_breath',
    category: 'basic',
    groupKo: '호흡과 공간',
    label: 'Double Breath',
    labelKo: '더블 브레스',
    descriptionKo: '문장 끝에 숨을 한 번 더 몰아쉬어 벅찬 감정을 주는 방식',
    usageKo: ['벅참', '가쁜 숨', '극적 감정', '울컥함'],
    promptCore: 'double breath',
    promptNatural: 'double breath at the end of phrases, as if the emotion is too full to finish cleanly',
  },
  {
    id: 'half_air_stop',
    category: 'basic',
    groupKo: '호흡과 공간',
    label: 'Half-Air Stop',
    labelKo: '하프 에어 스톱',
    descriptionKo: '소리 끝을 숨과 함께 훅 던지듯 멈추는 방식',
    usageKo: ['허탈함', '공허함', '마지막 숨', '멈춤'],
    promptCore: 'half-air stop',
    promptNatural: 'half-air stop that lets phrase endings fall away with a small empty breath',
  },
  {
    id: 'vocal_sigh',
    category: 'basic',
    groupKo: '호흡과 공간',
    label: 'Vocal Sigh',
    labelKo: '보컬 사이',
    descriptionKo: '한숨의 주파수를 노래에 섞어 바닥으로 떨어지는 소리',
    usageKo: ['상실감', '포기', '한숨', '낮게 꺼짐'],
    promptCore: 'vocal sigh',
    promptNatural: 'vocal sigh woven into the line, with the sound dropping to the floor at the phrase end',
  },
  {
    id: 'vocal_hiccup',
    category: 'basic',
    groupKo: '호흡과 공간',
    label: 'Vocal Hiccup',
    labelKo: '보컬 힉업',
    descriptionKo: '딸꾹질하듯 힉 하고 뒤집히는 소리',
    usageKo: ['울컥함', '리듬감', '귀여운 흔들림', '감정 튐'],
    promptCore: 'vocal hiccup',
    promptNatural: 'small vocal hiccup where the voice flips with a caught-breath feeling',
  },
  {
    id: 'staccato_breath',
    category: 'basic',
    groupKo: '호흡과 공간',
    label: 'Staccato Breath',
    labelKo: '스태카토 브레스',
    descriptionKo: '당황한 듯 짧게 흡 하고 들리는 숨',
    usageKo: ['충격', '당황', '이별 직후', '짧은 숨'],
    promptCore: 'staccato breath',
    promptNatural: 'staccato breath bursts, short shocked inhales between lines',
  },
  {
    id: 'off_mic',
    category: 'basic',
    groupKo: '호흡과 공간',
    label: 'Off-Mic',
    labelKo: '오프 마이크',
    descriptionKo: '마이크에서 멀어지며 생기는 물리적 거리감',
    usageKo: ['멀어짐', '거리감', '혼잣말', '이별감'],
    promptCore: 'off-mic vocal distance',
    promptNatural: 'off-mic vocal distance, like the singer turns away from the microphone while singing',
  },

  // 6. 실험 창법 — 비인간적 질감과 언어 해체
  {
    id: 'inward_singing',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'Inward Singing',
    labelKo: '인워드 싱잉',
    descriptionKo: '숨을 들이마시며 내는 조여진 소리',
    usageKo: ['공포', '질식감', '귀신 같은 숨', '위태로움'],
    promptCore: 'inward-inhaled singing',
    promptNatural: 'ghostly inward-inhaled singing, like a suffocated breath pulled backward into the chest',
  },
  {
    id: 'multiphonics',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'Multiphonics',
    labelKo: '멀티포닉스',
    descriptionKo: '한 목소리에서 여러 음이 갈라지는 소리',
    usageKo: ['초현실', '무속', '불협', '갈라진 감정'],
    promptCore: 'dual-tone multiphonics',
    promptNatural: 'dual-tone multiphonics, like a voice splitting into broken-glass harmonies',
  },
  {
    id: 'glottal_clicks',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'Glottal Clicks',
    labelKo: '글로탈 클릭',
    descriptionKo: '목과 혀로 딱딱 치는 타악성 발음',
    usageKo: ['주술', '원시 리듬', '타악감', '비트박스'],
    promptCore: 'percussive throat clicks',
    promptNatural: 'percussive throat clicks and rhythmic tongue clicking integrated with singing',
  },
  {
    id: 'overtone_singing',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'Overtone Singing',
    labelKo: '배음 창법',
    descriptionKo: '낮은 드론 위에 높은 배음이 떠오르는 소리',
    usageKo: ['명상', '샤먼', '고대감', '드론'],
    promptCore: 'overtone throat singing',
    promptNatural: 'ancient throat singing with whistling overtones, a deep drone with high harmonic resonance',
  },
  {
    id: 'death_growl_pig_squeal',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'Death Growl / Pig Squeal',
    labelKo: '그로울 / 피그 스퀄',
    descriptionKo: '짐승처럼 긁거나 비명처럼 찢는 극단 보컬',
    usageKo: ['공포', '괴물성', '극단 분노', '메탈'],
    promptCore: 'death growl and pig squeal vocals',
    promptNatural: 'abyssal demonic growling with high-pitched animalistic pig squeal distortion',
  },
  {
    id: 'white_noise_vocals',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'White Noise Vocals',
    labelKo: '화이트 노이즈 보컬',
    descriptionKo: '라디오 잡음처럼 지지직거리는 목소리',
    usageKo: ['디스토피아', '고장난 기억', '불안', '로파이 공포'],
    promptCore: 'static noise vocals',
    promptNatural: 'static noise vocals, like radio interference with sandpaper texture and almost no pitch',
  },
  {
    id: 'glossolalia',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'Glossolalia',
    labelKo: '글로솔라리아',
    descriptionKo: '뜻 없는 음절로 감정만 쏟는 방언 창법',
    usageKo: ['의식', '광기', '주술', '몰입'],
    promptCore: 'glossolalia vocals',
    promptNatural: 'speaking in tongues style, nonsensical emotional syllables and abstract chanting',
  },
  {
    id: 'microtonal_slurring',
    category: 'experimental',
    groupKo: '실험 창법',
    label: 'Microtonal Slurring',
    labelKo: '마이크로토널 슬러링',
    descriptionKo: '음 사이를 미세하게 미끄러지는 불안한 소리',
    usageKo: ['불안', '몽롱함', '초현실', '어긋난 감정'],
    promptCore: 'microtonal slurring',
    promptNatural: 'dizzying microtonal sliding, as if the pitch is slowly melting out of tune',
  },
] as const;

export const VOCAL_VOICE_TONES = [
  { id: 'calm', label: 'Calm Tone', labelKo: '차분한 톤', promptCore: 'calm vocal tone' },
  { id: 'heavy', label: 'Heavy Tone', labelKo: '묵직한 톤', promptCore: 'deep heavy vocal tone' },
  { id: 'first_love', label: 'First-love Tone', labelKo: '첫사랑 톤', promptCore: 'clear fragile first-love tone' },
  { id: 'clear', label: 'Clear Tone', labelKo: '맑은 톤', promptCore: 'clear clean vocal tone' },
  { id: 'hollow', label: 'Hollow Tone', labelKo: '공허한 톤', promptCore: 'hollow distant vocal tone' },
  { id: 'husky_tone', label: 'Husky Tone', labelKo: '허스키 톤', promptCore: 'husky textured tone' },
  { id: 'lazy', label: 'Lazy Tone', labelKo: '나른한 톤', promptCore: 'lazy relaxed vocal tone' },
  { id: 'bright', label: 'Bright Tone', labelKo: '밝은 톤', promptCore: 'bright lively vocal tone' },
  { id: 'wet', label: 'Wet Tone', labelKo: '젖은 톤', promptCore: 'wet emotional vocal tone' },
  { id: 'dry', label: 'Dry Tone', labelKo: '마른 톤', promptCore: 'dry plain vocal tone' },
] as const;

export const VOCAL_PERSONALITIES = [
  { id: 'relaxed', label: 'Relaxed', labelKo: '느긋함', promptCore: 'relaxed attitude' },
  { id: 'cool', label: 'Cool', labelKo: '쿨함', promptCore: 'cool understated attitude' },
  { id: 'plain', label: 'Plain', labelKo: '덤덤함', promptCore: 'plain restrained attitude' },
  { id: 'frustrated', label: 'Frustrated', labelKo: '답답함', promptCore: 'frustrated bottled-up feeling' },
  { id: 'stubborn', label: 'Stubborn', labelKo: '고집스러움', promptCore: 'stubborn emotional stance' },
  { id: 'bouncy', label: 'Bouncy', labelKo: '톡톡튐', promptCore: 'bouncy playful attitude' },
  { id: 'cute', label: 'Cute', labelKo: '귀여움', promptCore: 'cute innocent attitude' },
  { id: 'clingy', label: 'Clingy', labelKo: '질척임', promptCore: 'pleading attachment that cannot let go' },
  { id: 'sensitive', label: 'Sensitive', labelKo: '예민함', promptCore: 'sensitive easily-wounded attitude' },
  { id: 'sly', label: 'Sly', labelKo: '능청스러움', promptCore: 'sly teasing attitude' },
  { id: 'proud', label: 'Proud', labelKo: '자존심 셈', promptCore: 'proud attitude hiding vulnerability' },
  { id: 'unable_to_let_go', label: 'Unable to let go', labelKo: '못 놓음', promptCore: 'unable to let go, lingering attachment' },
] as const;
