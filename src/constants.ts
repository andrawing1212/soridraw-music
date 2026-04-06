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
  { id: 'j-pop', label: 'J-Pop', labelKo: 'J-팝', description: '일본 대중음악 특유의 멜로디와 편곡이 특징입니다.' },
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

  { id: 'traditional-trot', label: 'Traditional Trot', labelKo: '정통 트로트', description: '전통 트로트의 깊은 감성이 살아 있는 스타일입니다.' },
  { id: 'semi-trot', label: 'Semi-Trot', labelKo: '세미 트로트', description: '현대적으로 다듬어진 대중적 트로트 스타일입니다.' },

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
      'pop','dance-pop','synth-pop','teen-pop','kpop','j-pop','citypop','piano-ballad','adult-contemporary','indie-pop','chamber-pop',
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

export const STYLE_CYCLES: SoundStyleCycle[] = [
  {
    id: 'ballad-family',
    title: 'Ballad',
    titleKo: '발라드',
    variants: [
      { id: 'ballad', label: 'Ballad', labelKo: '발라드', description: '감정 중심의 기본 발라드 전개', promptCore: 'Style layer: emotional ballad pacing with clear melodic focus and vocal-forward development.' },
      { id: 'classic-ballad', label: 'Classic Ballad', labelKo: '클래식 발라드', description: '전통적인 발라드 감성', promptCore: 'Style layer: classic ballad writing with timeless chord flow, heartfelt delivery, and elegant melodic rise.' },
    ],
  },
  {
    id: 'dance-family',
    title: 'Dance',
    titleKo: '댄스',
    variants: [
      { id: 'dance', label: 'Dance', labelKo: '댄스', description: '리듬과 퍼포먼스 중심의 기본 댄스 스타일', promptCore: 'Style layer: dance-focused pulse with immediate energy and performance-ready momentum.' },
      { id: 'classic-disco', label: 'Classic Disco', labelKo: '클래식 디스코', description: '디스코 기반의 클래식 그루브', promptCore: 'Style layer: classic disco groove with four-on-the-floor motion, bright rhythm guitar, and uplifting movement.' },
      { id: 'modern-edm', label: 'Modern EDM', labelKo: '모던 EDM', description: '현대적인 EDM 감각', promptCore: 'Style layer: modern EDM dynamics with sharp builds, polished drops, and sleek electronic impact.' },
    ],
  },
  {
    id: 'rnb-family',
    title: 'R&B',
    titleKo: 'R&B',
    variants: [
      { id: 'rnb', label: 'R&B', labelKo: 'R&B', description: '그루브와 보컬 중심의 기본 R&B', promptCore: 'Style layer: contemporary R&B groove with smooth phrasing, sensual rhythm, and polished vocal emphasis.' },
      { id: 'neo-soul-style', label: 'Neo Soul', labelKo: '네오 소울', description: '네오소울 특유의 유연한 감성', promptCore: 'Style layer: neo-soul warmth with rich harmony, laid-back pocket, and expressive vocal nuance.' },
      { id: 'pb-rnb-style', label: 'PB R&B', labelKo: 'PB R&B', description: '몽환적이고 어두운 PBR&B 질감', promptCore: 'Style layer: PBR&B mood with dark atmosphere, airy spacing, and intimate modern texture.' },
    ],
  },
  {
    id: 'rock-family',
    title: 'Rock',
    titleKo: '록',
    variants: [
      { id: 'rock', label: 'Rock', labelKo: '록', description: '밴드 중심의 기본 록 에너지', promptCore: 'Style layer: modern rock foundation with band energy, guitar drive, and direct emotional lift.' },
      { id: 'classic-rock', label: 'Classic Rock', labelKo: '클래식 록', description: '전통적인 클래식 록 감성', promptCore: 'Style layer: classic rock character with sturdy riffs, live-band punch, and timeless anthem flow.' },
      { id: 'modern-rock', label: 'Modern Rock', labelKo: '모던 록', description: '현대적인 록 프로덕션', promptCore: 'Style layer: modern rock production with cleaner impact, wider choruses, and current radio-ready force.' },
    ],
  },
  {
    id: 'jazz-family',
    title: 'Jazz',
    titleKo: '재즈',
    variants: [
      { id: 'jazz', label: 'Jazz', labelKo: '재즈', description: '재즈 화성과 유연한 흐름', promptCore: 'Style layer: jazz-influenced harmony, fluid phrasing, and refined rhythmic sophistication.' },
      { id: 'classic-jazz', label: 'Classic Jazz', labelKo: '클래식 재즈', description: '전통 재즈 기반의 감각', promptCore: 'Style layer: classic jazz sensibility with elegant chord language, live interplay, and timeless swing-aware detail.' },
      { id: 'jazzhop-style', label: 'Jazzhop', labelKo: '재즈힙합', description: '재즈와 힙합의 결합', promptCore: 'Style layer: jazzhop blend with mellow groove, dusty rhythm feel, and jazzy melodic color.' },
    ],
  },
  {
    id: 'soul-family',
    title: 'Soul',
    titleKo: '소울',
    variants: [
      { id: 'soul', label: 'Soul', labelKo: '소울', description: '보컬과 감정 표현 중심의 기본 소울', promptCore: 'Style layer: soulful vocal emphasis with emotional depth, warm groove, and heartfelt melodic pull.' },
      { id: 'classic-soul', label: 'Classic Soul', labelKo: '클래식 소울', description: '클래식 소울의 진한 감성', promptCore: 'Style layer: classic soul feeling with vintage groove, expressive lead vocals, and rich emotional conviction.' },
      { id: 'neo-soul', label: 'Neo Soul', labelKo: '네오 소울', description: '현대적 감각의 네오소울', promptCore: 'Style layer: neo-soul character with nuanced harmony, soft pocket, and contemporary elegance.' },
    ],
  },
  {
    id: 'hiphop-family',
    title: 'Hip-Hop',
    titleKo: '힙합',
    variants: [
      { id: 'hip-hop', label: 'Hip-Hop', labelKo: '힙합', description: '비트 중심의 기본 힙합 결', promptCore: 'Style layer: hip-hop attitude with beat-led motion, urban edge, and rhythmic vocal emphasis.' },
      { id: 'boom-bap-style', label: 'Boom Bap', labelKo: '붐뱁', description: '클래식 붐뱁 질감', promptCore: 'Style layer: boom bap rhythm with classic drum knock, head-nod groove, and sample-minded movement.' },
      { id: 'trap-style', label: 'Trap', labelKo: '트랩', description: '현대 트랩 중심의 강한 리듬감', promptCore: 'Style layer: trap energy with heavy low-end, crisp hats, and modern street-level intensity.' },
      { id: 'lofi-hip-hop-style', label: 'Lofi Hip-hop', labelKo: '로파이 힙합', description: '로파이 힙합의 부드러운 빈티지 감성', promptCore: 'Style layer: lo-fi hip-hop mood with soft beat texture, warm dust, and relaxed groove.' },
    ],
  },
  {
    id: 'funk-family',
    title: 'Funk',
    titleKo: '펑크',
    variants: [
      { id: 'funk', label: 'Funk', labelKo: '펑크', description: '그루브 중심의 기본 펑크 스타일', promptCore: 'Style layer: funk groove with syncopated rhythm, lively bass interplay, and contagious motion.' },
      { id: 'g-funk', label: 'G-Funk', labelKo: 'G-펑크', description: 'G-Funk 특유의 느긋한 웨스트코스트 감성', promptCore: 'Style layer: G-funk glide with smooth synth leads, lowrider groove, and laid-back swagger.' },
      { id: 'p-funk', label: 'P-Funk', labelKo: 'P-펑크', description: 'P-Funk 특유의 확장된 펑크 감성', promptCore: 'Style layer: P-funk bounce with playful bass, psychedelic color, and larger-than-life groove energy.' },
    ],
  },
  {
    id: 'punk-family',
    title: 'Punk',
    titleKo: '펑크',
    variants: [
      { id: 'punk', label: 'Punk', labelKo: '펑크', description: '거칠고 빠른 기본 펑크 에너지', promptCore: 'Style layer: punk urgency with brisk tempo, stripped-down drive, and raw directness.' },
      { id: 'pop-punk', label: 'Pop-Punk', labelKo: '팝 펑크', description: '멜로디와 훅이 강한 팝펑크', promptCore: 'Style layer: pop-punk punch with melodic hooks, youthful energy, and fast band-driven choruses.' },
    ],
  },
  {
    id: 'blues-family',
    title: 'Blues',
    titleKo: '블루스',
    variants: [
      { id: 'blues', label: 'Blues', labelKo: '블루스', description: '블루스 특유의 감정선과 흐름', promptCore: 'Style layer: blues phrasing with expressive bends, earthy groove, and emotionally grounded movement.' },
      { id: 'roots-blues', label: 'Roots Blues', labelKo: '루츠 블루스', description: '루츠 블루스 기반의 원초적 감성', promptCore: 'Style layer: roots blues tone with raw feel, traditional phrasing, and earthy instrumental honesty.' },
    ],
  },
  {
    id: 'electronic-family',
    title: 'Electronic',
    titleKo: '일렉트로닉',
    variants: [
      { id: 'electronic', label: 'Electronic', labelKo: '일렉트로닉', description: '전자 사운드 중심의 기본 일렉트로닉 스타일', promptCore: 'Style layer: electronic production focus with sculpted synth texture and precise rhythmic architecture.' },
      { id: 'techno-style', label: 'Techno', labelKo: '테크노', description: '반복적 몰입감이 강한 테크노 감성', promptCore: 'Style layer: techno pulse with hypnotic repetition, controlled tension, and club-focused momentum.' },
      { id: 'house-style', label: 'House', labelKo: '하우스', description: '하우스 특유의 4/4 그루브', promptCore: 'Style layer: house groove with four-on-the-floor rhythm, smooth lift, and dancefloor clarity.' },
    ],
  },
  {
    id: 'latin-family',
    title: 'Latin',
    titleKo: '라틴',
    variants: [
      { id: 'latin', label: 'Latin', labelKo: '라틴', description: '라틴 리듬 중심의 기본 스타일', promptCore: 'Style layer: Latin rhythmic color with lively percussion motion and warm danceable energy.' },
      { id: 'salsa', label: 'Salsa', labelKo: '살사', description: '살사 특유의 생동감과 타악 리듬', promptCore: 'Style layer: salsa motion with bright brass interplay, agile percussion, and celebratory movement.' },
      { id: 'reggaeton', label: 'Reggaeton', labelKo: '레게톤', description: '레게톤 특유의 리듬과 현대적 감각', promptCore: 'Style layer: reggaeton bounce with infectious rhythm, urban flavor, and club-ready body movement.' },
    ],
  },
  {
    id: 'reggae-family',
    title: 'Reggae',
    titleKo: '레게',
    variants: [
      { id: 'reggae', label: 'Reggae', labelKo: '레게', description: '엇박자와 여유로운 기본 레게 흐름', promptCore: 'Style layer: reggae groove with offbeat emphasis, laid-back pacing, and warm relaxed flow.' },
      { id: 'roots-reggae', label: 'Roots Reggae', labelKo: '루츠 레게', description: '루츠 레게의 묵직하고 깊은 감성', promptCore: 'Style layer: roots reggae tone with earthy groove, steady pulse, and spiritually grounded warmth.' },
      { id: 'dancehall', label: 'Dancehall', labelKo: '댄스홀', description: '댄스홀 특유의 강한 리듬과 텐션', promptCore: 'Style layer: dancehall energy with sharper rhythmic snap, club movement, and bold Caribbean flavor.' },
    ],
  },
  {
    id: 'global-family',
    title: 'Global pop style',
    titleKo: '글로벌 팝 스타일',
    variants: [
      { id: 'global-pop-style', label: 'Global Style', labelKo: '글로벌 스타일', description: '국가를 넘나드는 글로벌 팝 감각', promptCore: 'Style layer: global pop approach with broad mainstream appeal, clean hooks, and international polish.' },
      { id: 'k-style', label: 'K-Style', labelKo: 'K-스타일', description: 'K-Pop 감성의 세련된 전개', promptCore: 'Style layer: K-style polish with sharp sections, addictive hooks, and sleek Korean pop sensibility.' },
      { id: 'anime-style', label: 'Anime Style', labelKo: '애니 스타일', description: '애니메이션 OST 같은 상승감과 드라마', promptCore: 'Style layer: anime-style melodic drama with emotional lift, vivid progression, and soaring payoff.' },
      { id: 'game-bgm-style', label: 'Game BGM', labelKo: '게임 BGM', description: '게임 BGM 같은 장면감과 몰입감', promptCore: 'Style layer: game-BGM flavor with scene-driven pacing, vivid motif focus, and immersive motion.' },
    ],
  },
] as const;

export const SOUND_STYLES: SoundStyleItem[] = STYLE_CYCLES.flatMap((cycle) =>
  cycle.variants.map((variant) => ({
    ...variant,
    _ts: Date.now(),
  }))
);

export const SOUND_TEXTURE_CYCLES: InstrumentSoundCycle[] = [
  {
    id: 'band-family',
    title: 'Band',
    titleKo: '밴드',
    variants: [
      { id: 'band', label: 'Band', labelKo: '밴드', description: '기본 밴드 편성 중심', promptCore: 'Sound/texture layer: balanced live band foundation with drums, bass, guitar, and keys supporting the arrangement.' },
      { id: 'pop-band', label: 'Pop Band', labelKo: '팝 밴드', description: '대중적인 팝 밴드 편성', promptCore: 'Sound/texture layer: pop-band arrangement with clean ensemble balance and hook-friendly support.' },
      { id: 'funk-band', label: 'Funk Band', labelKo: '펑크 밴드', description: '펑크 밴드의 그루브 중심 편성', promptCore: 'Sound/texture layer: funk-band interplay with tight rhythm section and groove-led movement.' },
      { id: 'rock-band', label: 'Rock Band', labelKo: '록 밴드', description: '록 밴드 중심의 에너지', promptCore: 'Sound/texture layer: rock-band drive with live drums, electric guitar push, and band-sized impact.' },
      { id: 'jazz-band', label: 'Jazz Band', labelKo: '재즈 밴드', description: '재즈 밴드 중심의 유기적 편성', promptCore: 'Sound/texture layer: jazz-band interaction with live rhythm section and flexible musical conversation.' },
    ],
  },
  {
    id: 'bass-family',
    title: 'Bass',
    titleKo: '베이스',
    variants: [
      { id: 'bass', label: 'Bass', labelKo: '베이스', description: '기본 베이스 중심감', promptCore: 'Sound/texture layer: defined bass foundation supporting harmony and pulse.' },
      { id: '808-bass', label: '808 Bass', labelKo: '808 베이스', description: '808 중심의 저역', promptCore: 'Sound/texture layer: 808 bass weight with modern sub impact and sustained low-end pressure.' },
      { id: 'smooth-bass', label: 'Smooth Bass', labelKo: '스무스 베이스', description: '부드럽고 매끈한 베이스', promptCore: 'Sound/texture layer: smooth bass flow with rounded tone and melodic support.' },
      { id: 'funky-bassline', label: 'Funky Bassline', labelKo: '펑키 베이스라인', description: '리듬을 주도하는 펑키 베이스라인', promptCore: 'Sound/texture layer: funky bassline movement with rhythmic articulation and playful groove.' },
      { id: 'sharp-synth-bass', label: 'Sharp Synth Bass', labelKo: '샤프 신스 베이스', description: '선명한 신스 베이스', promptCore: 'Sound/texture layer: sharp synth bass with defined attack and modern electronic contour.' },
    ],
  },
  {
    id: 'drums-family',
    title: 'Drums',
    titleKo: '드럼',
    variants: [
      { id: 'drums', label: 'Drums', labelKo: '드럼', description: '기본 드럼 중심', promptCore: 'Sound/texture layer: steady drum backbone shaping the groove and arrangement energy.' },
      { id: 'brushed-drums', label: 'Brushed drums', labelKo: '브러시 드럼', description: '브러시 드럼의 부드러운 질감', promptCore: 'Sound/texture layer: brushed drums with soft attack and intimate live feel.' },
      { id: 'double-time', label: 'Double-time', labelKo: '더블 타임', description: '더블타임 리듬감', promptCore: 'Sound/texture layer: double-time rhythmic motion creating urgency and forward momentum.' },
      { id: 'half-time', label: 'Half-time', labelKo: '하프 타임', description: '하프타임 리듬감', promptCore: 'Sound/texture layer: half-time pocket with heavier space and deeper weight.' },
      { id: 'driving-rhythm', label: 'Driving rhythm', labelKo: '드라이빙 리듬', description: '밀어주는 추진형 리듬', promptCore: 'Sound/texture layer: driving rhythm with clear forward push and energetic pulse.' },
    ],
  },
  {
    id: 'pad-family',
    title: 'Pad',
    titleKo: '패드',
    variants: [
      { id: 'pad', label: 'Pad', labelKo: '패드', description: '기본 패드 레이어', promptCore: 'Sound/texture layer: supportive pad bed adding width and harmonic atmosphere.' },
      { id: 'glassy-pad', label: 'Glassy Pad', labelKo: '글래시 패드', description: '투명하고 맑은 패드', promptCore: 'Sound/texture layer: glassy pad shimmer with airy high-end and transparent lift.' },
      { id: 'warm-pad', label: 'Warm Pad', labelKo: '웜 패드', description: '따뜻한 패드 질감', promptCore: 'Sound/texture layer: warm pad support with soft body and comforting width.' },
      { id: 'ethereal-pad', label: 'Ethereal Pad', labelKo: '에테리얼 패드', description: '몽환적인 패드', promptCore: 'Sound/texture layer: ethereal pad bloom with floating atmosphere and dreamlike space.' },
      { id: 'deep-pad', label: 'Deep Pad', labelKo: '딥 패드', description: '깊게 깔리는 패드', promptCore: 'Sound/texture layer: deep pad foundation with darker ambience and immersive depth.' },
    ],
  },
  {
    id: 'synths-family',
    title: 'Synths',
    titleKo: '신스',
    variants: [
      { id: 'synths', label: 'Synths', labelKo: '신스', description: '기본 신스 레이어', promptCore: 'Sound/texture layer: synth presence shaping the melodic color and modern tone.' },
      { id: 'bright-synth', label: 'Bright Synth', labelKo: '브라이트 신스', description: '밝고 선명한 신스', promptCore: 'Sound/texture layer: bright synth tone with vivid top-end and catchy presence.' },
      { id: 'dreamy-synth', label: 'Dreamy Synth', labelKo: '드리미 신스', description: '몽환적인 신스', promptCore: 'Sound/texture layer: dreamy synth wash with soft blur and floating melodic glow.' },
      { id: 'dark-synth', label: 'Dark Synth', labelKo: '다크 신스', description: '어두운 신스 질감', promptCore: 'Sound/texture layer: dark synth color with moody tone and shadowed atmosphere.' },
      { id: 'deep-synth', label: 'Deep Synth', labelKo: '딥 신스', description: '깊고 묵직한 신스', promptCore: 'Sound/texture layer: deep synth body with rich weight and immersive depth.' },
    ],
  },
  {
    id: 'snare-family',
    title: 'Snare',
    titleKo: '스네어',
    variants: [
      { id: 'snare', label: 'Snare', labelKo: '스네어', description: '기본 스네어 톤', promptCore: 'Sound/texture layer: clear snare definition anchoring the backbeat.' },
      { id: 'sharp-snare', label: 'Sharp snare', labelKo: '샤프 스네어', description: '날카로운 스네어', promptCore: 'Sound/texture layer: sharp snare crack with precise transient edge.' },
      { id: 'warm-snare', label: 'Warm snare', labelKo: '웜 스네어', description: '따뜻한 스네어', promptCore: 'Sound/texture layer: warm snare body with rounded tone and softer edge.' },
      { id: 'hard-hitting-snare', label: 'Hard-hitting snare', labelKo: '하드 히팅 스네어', description: '강하게 치는 스네어', promptCore: 'Sound/texture layer: hard-hitting snare impact with bold attack and punch.' },
      { id: 'big-reverb-snare', label: 'Big reverb snare', labelKo: '빅 리버브 스네어', description: '큰 리버브가 걸린 스네어', promptCore: 'Sound/texture layer: big reverb snare with wide tail and dramatic space.' },
    ],
  },
  {
    id: 'hihats-family',
    title: 'Hi-hats',
    titleKo: '하이햇',
    variants: [
      { id: 'hi-hats', label: 'Hi-hats', labelKo: '하이햇', description: '기본 하이햇 패턴', promptCore: 'Sound/texture layer: hi-hat detail maintaining rhythmic definition and motion.' },
      { id: 'crisp-hi-hats', label: 'Crisp hi-hats', labelKo: '크리스프 하이햇', description: '또렷한 하이햇', promptCore: 'Sound/texture layer: crisp hi-hats adding clarity and fast rhythmic sparkle.' },
      { id: 'soft-hi-hats', label: 'Soft hi-hats', labelKo: '소프트 하이햇', description: '부드러운 하이햇', promptCore: 'Sound/texture layer: soft hi-hats with smoother articulation and lighter touch.' },
      { id: 'fast-triplet-hi-hats', label: 'Fast triplet hi-hats', labelKo: '패스트 트리플렛 하이햇', description: '빠른 트리플렛 하이햇', promptCore: 'Sound/texture layer: fast triplet hi-hats creating agile, rolling rhythmic tension.' },
      { id: 'distanced-hi-hats', label: 'Distanced hi-hats', labelKo: '디스턴스 하이햇', description: '멀리 있는 하이햇 질감', promptCore: 'Sound/texture layer: distanced hi-hats with softened presence and atmospheric placement.' },
    ],
  },
  {
    id: 'guitar-family',
    title: 'Guitar',
    titleKo: '기타',
    variants: [
      { id: 'guitar', label: 'Guitar', labelKo: '기타', description: '기본 기타 레이어', promptCore: 'Sound/texture layer: guitar support adding rhythmic shape and harmonic texture.' },
      { id: 'acoustic', label: 'Acoustic', labelKo: '어쿠스틱', description: '어쿠스틱 기타 중심', promptCore: 'Sound/texture layer: acoustic guitar warmth with natural strum texture and organic support.' },
      { id: 'electric', label: 'Electric', labelKo: '일렉트릭', description: '일렉 기타 중심', promptCore: 'Sound/texture layer: electric guitar presence with modern bite and clear rhythmic edge.' },
      { id: 'overdriven', label: 'Overdriven', labelKo: '오버드라이브', description: '오버드라이브 기타', promptCore: 'Sound/texture layer: overdriven guitar tone with grit, sustain, and emotional push.' },
      { id: 'ambient-electric', label: 'Ambient Electric', labelKo: '앰비언트 일렉트릭', description: '공간감 있는 일렉 기타', promptCore: 'Sound/texture layer: ambient electric guitar with spacious tails and atmospheric motion.' },
    ],
  },
  {
    id: 'trumpet-family',
    title: 'Trumpet',
    titleKo: '트럼펫',
    variants: [
      { id: 'trumpet', label: 'Trumpet', labelKo: '트럼펫', description: '기본 트럼펫 컬러', promptCore: 'Sound/texture layer: trumpet color adding melodic accent and brass brightness.' },
      { id: 'bright-trumpet', label: 'Bright Trumpet', labelKo: '브라이트 트럼펫', description: '밝게 치고 나오는 트럼펫', promptCore: 'Sound/texture layer: bright trumpet accent with vivid tone and energetic lift.' },
      { id: 'muted-trumpet', label: 'Muted Trumpet', labelKo: '뮤트 트럼펫', description: '뮤트 트럼펫의 차분한 색감', promptCore: 'Sound/texture layer: muted trumpet character with restrained, intimate brass color.' },
      { id: 'soft-trumpet-solo', label: 'Soft Trumpet solo', labelKo: '소프트 트럼펫 솔로', description: '부드러운 트럼펫 솔로', promptCore: 'Sound/texture layer: soft trumpet solo phrasing with lyrical warmth and airy elegance.' },
      { id: 'funky-trumpet-hits', label: 'Funky Trumpet hits', labelKo: '펑키 트럼펫 히트', description: '펑키한 트럼펫 히트', promptCore: 'Sound/texture layer: funky trumpet hits delivering rhythmic brass punches and groove accents.' },
    ],
  },
  {
    id: 'heritage-plucks-family',
    title: 'Gayageum',
    titleKo: '가야금',
    variants: [
      { id: 'gayageum', label: 'Gayageum', labelKo: '가야금', description: '가야금의 섬세한 전통 현악 질감', promptCore: 'Sound/texture layer: gayageum texture with delicate Korean plucked-string expression.' },
      { id: 'haegeum', label: 'Haegeum', labelKo: '해금', description: '해금의 애절한 선율감', promptCore: 'Sound/texture layer: haegeum voice with expressive bowed Korean timbre and emotional contour.' },
      { id: 'kalimba-pluck', label: 'Kalimba pluck', labelKo: '칼림바 플럭', description: '칼림바의 맑고 또렷한 플럭 질감', promptCore: 'Sound/texture layer: kalimba pluck sparkle with clean transient charm and intimate detail.' },
    ],
  },
  {
    id: 'strings-family',
    title: 'Strings',
    titleKo: '스트링',
    variants: [
      { id: 'strings', label: 'Strings', labelKo: '스트링', description: '기본 스트링 레이어', promptCore: 'Sound/texture layer: strings adding lift, warmth, and emotional contour.' },
      { id: 'full-orchestral-strings', label: 'Full Orchestral Strings', labelKo: '풀 오케스트라 스트링', description: '풍성한 오케스트라 스트링', promptCore: 'Sound/texture layer: full orchestral strings creating cinematic breadth and dramatic support.' },
      { id: 'soft-legato-strings', label: 'Soft legato strings', labelKo: '소프트 레가토 스트링', description: '부드럽게 이어지는 레가토 스트링', promptCore: 'Sound/texture layer: soft legato strings with flowing sustained warmth.' },
      { id: 'pizzicato-strings', label: 'Pizzicato strings', labelKo: '피치카토 스트링', description: '피치카토 스트링의 경쾌한 질감', promptCore: 'Sound/texture layer: pizzicato strings adding plucked motion and playful articulation.' },
      { id: 'staccato-strings', label: 'Staccato strings', labelKo: '스타카토 스트링', description: '스타카토 스트링의 분명한 어택', promptCore: 'Sound/texture layer: staccato strings delivering rhythmic precision and pointed emphasis.' },
    ],
  },
  {
    id: 'texture-family',
    title: 'Minimalist texture',
    titleKo: '미니멀 텍스쳐',
    variants: [
      { id: 'minimalist-texture', label: 'Minimalist texture', labelKo: '미니멀 텍스쳐', description: '절제된 텍스쳐 중심', promptCore: 'Sound/texture layer: minimalist texture with wide spacing and deliberate restraint.' },
      { id: 'rich-texture', label: 'Rich texture', labelKo: '리치 텍스쳐', description: '풍성하고 조밀한 텍스쳐', promptCore: 'Sound/texture layer: rich texture with layered detail and dense harmonic support.' },
      { id: 'evolving-texture', label: 'Evolving texture', labelKo: '이볼빙 텍스쳐', description: '시간에 따라 변화하는 텍스쳐', promptCore: 'Sound/texture layer: evolving texture that gradually shifts and blooms across sections.' },
      { id: 'granular-texture', label: 'Granular texture', labelKo: '그래뉼러 텍스쳐', description: '입자감 있는 실험적 텍스쳐', promptCore: 'Sound/texture layer: granular texture with fragmented detail and experimental atmosphere.' },
    ],
  },
  {
    id: 'ambience-family',
    title: 'Nature textures',
    titleKo: '자연 텍스쳐',
    variants: [
      { id: 'nature-textures', label: 'Nature textures', labelKo: '자연 텍스쳐', description: '자연스러운 환경 질감', promptCore: 'Sound/texture layer: subtle nature textures adding organic ambience and breathing space.' },
      { id: 'rainy-textures', label: 'Rainy textures', labelKo: '우천 텍스쳐', description: '비 오는 듯한 서정적 질감', promptCore: 'Sound/texture layer: rainy textures with gentle droplets and reflective ambience.' },
      { id: 'urban-ambience', label: 'Urban ambience', labelKo: '어반 앰비언스', description: '도시적 공간감', promptCore: 'Sound/texture layer: urban ambience with modern environmental depth and nocturnal color.' },
      { id: 'mechanical-textures', label: 'Mechanical textures', labelKo: '기계적 텍스쳐', description: '기계적이고 산업적인 질감', promptCore: 'Sound/texture layer: mechanical textures with industrial pulse and cold textural detail.' },
    ],
  },
] as const;

export const INSTRUMENT_SOUNDS: InstrumentSoundItem[] = SOUND_TEXTURE_CYCLES.flatMap((cycle) =>
  cycle.variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    description: variant.description,
    promptCore: variant.promptCore,
  }))
);

export const MOODS: CategoryItem[] = [
  { id: 'emotional', label: 'Emotional', labelKo: '감성적인', description: '깊고 진한 감정 표현이 중심이 되는 분위기입니다.' },
  { id: 'sad', label: 'Sad', labelKo: '슬픈', description: '슬픔과 상실감이 짙게 느껴지는 감정선입니다.' },
  { id: 'warm', label: 'Warm', labelKo: '따뜻한', description: '따뜻하고 포근하게 감싸는 정서입니다.' },
  { id: 'calm', label: 'Calm', labelKo: '차분한', description: '차분하고 고요하게 가라앉는 감정 흐름입니다.' },
  { id: 'dark', label: 'Dark', labelKo: '어두운', description: '어둡고 무게감 있는 정서를 담은 분위기입니다.' },
  { id: 'bright', label: 'Bright', labelKo: '밝은', description: '밝고 환하게 펼쳐지는 긍정적인 감정입니다.' },
  { id: 'hopeful', label: 'Hopeful', labelKo: '희망찬', description: '앞을 향해 나아가는 희망과 기대의 정서입니다.' },
  { id: 'lonely', label: 'Lonely', labelKo: '외로운', description: '혼자 남겨진 듯한 외로움과 여백의 감정입니다.' },
  { id: 'nostalgic', label: 'Nostalgic', labelKo: '향수 어린', description: '지나간 시간과 기억을 떠올리게 하는 향수입니다.' },
  { id: 'dreamy', label: 'Dreamy', labelKo: '몽환적인', description: '몽환적이고 흐릿하게 번지는 감성입니다.' },
  { id: 'tense', label: 'Tense', labelKo: '긴장된', description: '긴장감과 불안감이 서서히 높아지는 정서입니다.' },
  { id: 'peaceful', label: 'Peaceful', labelKo: '평화로운', description: '평온하고 안정된 마음 상태를 담은 분위기입니다.' },
];

export const THEMES: CategoryItem[] = [
  { id: 'love', label: 'Love', labelKo: '사랑', description: '사랑에 빠지거나 사랑을 바라보는 이야기입니다.' },
  { id: 'breakup', label: 'Breakup', labelKo: '이별', description: '이별 이후의 감정과 남겨진 마음을 다룹니다.' },
  { id: 'comfort', label: 'Comfort', labelKo: '위로', description: '누군가를 위로하거나 위로받는 상황을 담습니다.' },
  { id: 'healing', label: 'Healing', labelKo: '힐링', description: '상처를 회복하고 마음을 다독이는 흐름입니다.' },
  { id: 'youth', label: 'Youth', labelKo: '청춘', description: '청춘의 순간과 성장통, 반짝이는 시간을 그립니다.' },
  { id: 'dream', label: 'Dream', labelKo: '꿈', description: '꿈꾸는 미래와 바람, 이상을 향한 이야기를 담습니다.' },
  { id: 'daily-life', label: 'Daily Life', labelKo: '일상', description: '평범한 일상 속 작은 장면과 감정을 담습니다.' },
  { id: 'travel', label: 'Travel', labelKo: '여행', description: '어딘가로 떠나는 길 위의 장면과 감정을 표현합니다.' },
  { id: 'night', label: 'Night', labelKo: '밤', description: '밤이라는 시간대가 주는 분위기와 사건을 그립니다.' },
  { id: 'memories', label: 'Memories', labelKo: '추억', description: '지나간 추억과 되돌아보는 마음을 중심으로 합니다.' },
  { id: 'growth', label: 'Growth', labelKo: '성장', description: '변화와 성숙, 앞으로 나아가는 과정을 담습니다.' },
  { id: 'loneliness', label: 'Loneliness', labelKo: '고독', description: '홀로 남겨진 순간과 내면의 독백을 이야기합니다.' },
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
        children: [
          { id: 'synth_pop', label: 'Synth Pop', labelKo: '신스팝' },
          { id: 'disco', label: 'Disco', labelKo: '디스코' },
          { id: 'electropop', label: 'Electropop', labelKo: '일렉트로팝' },
          { id: 'teen_pop', label: 'Teen Pop', labelKo: '틴팝' },
          { id: 'britpop', label: 'Britpop', labelKo: '브릿팝' },
          { id: 'indie_pop', label: 'Indie Pop', labelKo: '인디팝' },
          { id: 'city_pop', label: 'City Pop', labelKo: '시티팝' },
          { id: 'funk_pop', label: 'Funk Pop', labelKo: '펑크팝' },
          { id: 'dance_pop', label: 'Dance Pop', labelKo: '댄스팝' },
          { id: 'acoustic_pop', label: 'Acoustic Pop', labelKo: '어쿠스틱팝' },
        ]
      },
      {
        id: 'kpop',
        label: 'K-Pop',
        labelKo: 'K-Pop',
        children: [
          { id: 'idol_dance', label: 'Idol Dance', labelKo: '아이돌 댄스' },
          { id: 'k_ballad', label: 'K-Ballad', labelKo: 'K-발라드' },
          { id: 'k_synth_pop', label: 'K-Synth Pop', labelKo: 'K-신스팝' },
          { id: 'k_trap', label: 'K-Trap', labelKo: 'K-트랩' },
          { id: 'k_new_jack_swing', label: 'K-New Jack Swing', labelKo: 'K-뉴잭스윙' },
          { id: 'k_indie', label: 'K-Indie', labelKo: 'K-인디' },
          { id: 'k_folk', label: 'K-Folk', labelKo: 'K-포크' },
          { id: 'k_rock', label: 'K-Rock', labelKo: 'K-록' },
          { id: 'gugak_fusion', label: 'Gugak Fusion', labelKo: '국악 퓨전' },
        ]
      },
      {
        id: 'jpop',
        label: 'J-Pop',
        labelKo: 'J-Pop',
        children: [
          { id: 'j_idol_pop', label: 'J-Idol Pop', labelKo: 'J-아이돌 팝' },
          { id: 'shibuya_kei', label: 'Shibuya-kei', labelKo: '시부야계' },
          { id: 'anime_rock', label: 'Anime Rock', labelKo: '애니메이션 록' },
          { id: 'j_city_pop', label: 'J-City Pop', labelKo: 'J-시티팝' },
          { id: 'visual_kei', label: 'Visual-kei', labelKo: '비주얼계' },
          { id: 'utaite_style', label: 'Utaite Style', labelKo: '우타이테 스타일' },
          { id: 'vocaloid_style', label: 'Vocaloid Style', labelKo: '보컬로이드 스타일' },
          { id: 'j_jazz_pop', label: 'J-Jazz Pop', labelKo: 'J-재즈팝' },
          { id: 'j_electro', label: 'J-Electro', labelKo: 'J-일렉트로' },
          { id: 'j_ballad', label: 'J-Ballad', labelKo: 'J-발라드' },
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
        children: [
          { id: 'trap', label: 'Trap', labelKo: '트랩' },
          { id: 'drill', label: 'Drill', labelKo: '드릴' },
          { id: 'boombap', label: 'Boom Bap', labelKo: '붐뱁' },
          { id: 'lofi', label: 'Lo-fi', labelKo: '로파이' },
          { id: 'jazz_hiphop', label: 'Jazz Hip-hop', labelKo: '재즈힙합' },
          { id: 'emo_rap', label: 'Emo Rap', labelKo: '이모랩' },
          { id: 'old_school', label: 'Old School', labelKo: '올드스쿨' },
          { id: 'g_funk', label: 'G-Funk', labelKo: 'G-펑크' },
          { id: 'cloud_rap', label: 'Cloud Rap', labelKo: '클라우드 랩' },
        ]
      },
      {
        id: 'rnb',
        label: 'R&B',
        labelKo: '알앤비',
        children: [
          { id: 'contemporary_rnb', label: 'Contemporary R&B', labelKo: '컨템퍼러리 R&B' },
          { id: 'neo_soul', label: 'Neo Soul', labelKo: '네오 소울' },
          { id: 'soul', label: 'Soul', labelKo: '소울' },
          { id: 'funk', label: 'Funk', labelKo: '펑크' },
          { id: 'alternative_rnb', label: 'Alternative R&B', labelKo: '얼터너티브 R&B' },
          { id: 'new_jack_swing', label: 'New Jack Swing', labelKo: '뉴잭스윙' },
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
        children: [
          { id: 'alternative_rock', label: 'Alternative Rock', labelKo: '얼터너티브 록' },
          { id: 'modern_rock', label: 'Modern Rock', labelKo: '모던 록' },
          { id: 'punk_rock', label: 'Punk Rock', labelKo: '펑크 록' },
          { id: 'hard_rock', label: 'Hard Rock', labelKo: '하드 록' },
          { id: 'soft_rock', label: 'Soft Rock', labelKo: '소프트 록' },
          { id: 'garage_rock', label: 'Garage Rock', labelKo: '개러지 록' },
          { id: 'shoegazing', label: 'Shoegazing', labelKo: '슈게이징' },
          { id: 'folk_rock', label: 'Folk Rock', labelKo: '포크 록' },
          { id: 'blues_rock', label: 'Blues Rock', labelKo: '블루스 록' },
        ]
      },
      {
        id: 'metal',
        label: 'Metal',
        labelKo: '메탈',
        children: [
          { id: 'heavy_metal', label: 'Heavy Metal', labelKo: '헤비메탈' },
          { id: 'death_metal', label: 'Death Metal', labelKo: '데스메탈' },
          { id: 'thrash_metal', label: 'Thrash Metal', labelKo: '스래시메탈' },
          { id: 'metalcore', label: 'Metalcore', labelKo: '메탈코어' },
          { id: 'nu_metal', label: 'Nu Metal', labelKo: '뉴메탈' },
          { id: 'symphonic_metal', label: 'Symphonic Metal', labelKo: '심포닉 메탈' },
          { id: 'power_metal', label: 'Power Metal', labelKo: '파워 메탈' },
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
        children: [
          { id: 'house', label: 'House', labelKo: '하우스' },
          { id: 'techno', label: 'Techno', labelKo: '테크노' },
          { id: 'trance', label: 'Trance', labelKo: '트랜스' },
          { id: 'future_bass', label: 'Future Bass', labelKo: '퓨처 베이스' },
          { id: 'dubstep', label: 'Dubstep', labelKo: '덥스텝' },
          { id: 'deep_house', label: 'Deep House', labelKo: '딥 하우스' },
          { id: 'tropical_house', label: 'Tropical House', labelKo: '트로피컬 하우스' },
          { id: 'eurobeat', label: 'Eurobeat', labelKo: '유로비트' },
          { id: 'drum_and_bass', label: 'Drum & Bass', labelKo: '드럼앤베이스' },
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
        children: [
          { id: 'swing_jazz', label: 'Swing Jazz', labelKo: '스윙 재즈' },
          { id: 'bossa_nova', label: 'Bossa Nova', labelKo: '보사노바' },
          { id: 'fusion_jazz', label: 'Fusion Jazz', labelKo: '퓨전 재즈' },
          { id: 'cool_jazz', label: 'Cool Jazz', labelKo: '쿨 재즈' },
          { id: 'big_band', label: 'Big Band', labelKo: '빅밴드' },
          { id: 'latin_jazz', label: 'Latin Jazz', labelKo: '라틴 재즈' },
          { id: 'jazz_vocal', label: 'Jazz Vocal', labelKo: '재즈 보컬' },
          { id: 'hard_bop', label: 'Hard Bop', labelKo: '하드 밥' },
        ]
      },
      {
        id: 'classical',
        label: 'Classical',
        labelKo: '클래식',
        children: [
          { id: 'full_orchestra', label: 'Full Orchestra', labelKo: '풀 오케스트라' },
          { id: 'piano_solo_classical', label: 'Piano Solo', labelKo: '피아노 독주' },
          { id: 'string_ensemble_classical', label: 'String Ensemble', labelKo: '현악 합주' },
          { id: 'choral', label: 'Choral', labelKo: '합창' },
          { id: 'baroque', label: 'Baroque', labelKo: '바로크' },
          { id: 'opera', label: 'Opera', labelKo: '오페라' },
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
        children: [
          { id: 'traditional_folk', label: 'Traditional Folk', labelKo: '정통 포크' },
          { id: 'country', label: 'Country', labelKo: '컨트리' },
          { id: 'bluegrass', label: 'Bluegrass', labelKo: '블루그래스' },
          { id: 'singer_songwriter', label: 'Singer-Songwriter', labelKo: '싱어송라이터' },
          { id: 'acoustic_session', label: 'Acoustic Session', labelKo: '어쿠스틱 세션' },
          { id: 'fingerstyle', label: 'Fingerstyle', labelKo: '핑거스타일' },
        ]
      },
      {
        id: 'world_music_folk',
        label: 'World Music',
        labelKo: '월드 뮤직',
        children: [
          { id: 'reggae', label: 'Reggae', labelKo: '레게' },
          { id: 'afrobeat', label: 'Afrobeat', labelKo: '아프로비트' },
          { id: 'celtic', label: 'Celtic', labelKo: '켈틱' },
          { id: 'latin_salsa', label: 'Latin (Salsa)', labelKo: '라틴(살사)' },
          { id: 'flamenco', label: 'Flamenco', labelKo: '플라멩코' },
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
        children: [
          { id: 'traditional_trot', label: 'Traditional Trot', labelKo: '정통 트로트' },
          { id: 'semi_trot', label: 'Semi-Trot', labelKo: '세미 트로트' },
          { id: 'disco_trot', label: 'Disco Trot', labelKo: '디스코 트로트' },
          { id: 'rock_trot', label: 'Rock Trot', labelKo: '락 트로트' },
          { id: 'ballad_trot', label: 'Ballad Trot', labelKo: '발라드 트로트' },
          { id: 'blues_trot', label: 'Blues Trot', labelKo: '블루스 트로트' },
          { id: 'shuffle_trot', label: 'Shuffle Trot', labelKo: '셔플 트로트' },
          { id: 'gugak_trot', label: 'Gugak Trot', labelKo: '국악 트로트' },
        ]
      },
      {
        id: '7080_gayo',
        label: '7080 Gayo',
        labelKo: '7080 가요',
        children: [
          { id: '7080_folk', label: '7080 Folk', labelKo: '7080 포크' },
          { id: 'adult_ballad', label: 'Adult Ballad', labelKo: '성인 발라드' },
          { id: 'campus_band_sound', label: 'Campus Band Sound', labelKo: '캠퍼스 밴드 사운드' },
          { id: 'enka_style', label: 'Enka Style', labelKo: '엔카 스타일' },
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
        children: [
          { id: 'orchestral_score', label: 'Orchestral Score', labelKo: '오케스트럴 스코어' },
          { id: 'hybrid_epic', label: 'Hybrid Epic', labelKo: '하이브리드 에픽' },
          { id: 'synth_score', label: 'Synth Score', labelKo: '신시사이저 스코어' },
          { id: 'piano_solo', label: 'Piano Solo', labelKo: '피아노 솔로' },
          { id: 'string_ensemble', label: 'String Ensemble', labelKo: '스트링 합주' },
          { id: 'chiptune', label: 'Chiptune', labelKo: '칩튠' },
          { id: 'world_music', label: 'World Music', labelKo: '월드 뮤직' },
          { id: 'minimalism', label: 'Minimalism', labelKo: '미니멀리즘' },
          { id: 'ambient', label: 'Ambient', labelKo: '앰비언트' },
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
    sound: "Polished hybrid beats, Sophisticated electronic textures", // 전자음과 리얼 악기가 결합된 입체적이고 세련된 질감
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
    sound: "Accordion, Bright brass section, Rhythmic trot beat", // 아코디언과 화려한 관악기가 주도하는 특유의 비트
    vocal: "Traditional Trot vibrato, Emotional 'Ggeok-gi' phrasing", // 정통 트로트 비브라토와 꺾기 창법 명시
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
    style: "80s Japanese City Pop, Urban", 
    sound: "DX7 Synths, Funky bass, Saxophone", 
    vocal: "Cool, Smooth, J-pop phrasing" 
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
    sound: "Synth-pop beats, Bright brass", 
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
};