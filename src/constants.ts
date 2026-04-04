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
  { id: 'pop', label: 'Pop', description: '가장 보편적이고 대중적인 팝 사운드입니다.' },
  { id: 'dance-pop', label: 'Dance Pop', description: '강한 훅과 리듬감이 있는 대중적인 댄스 팝입니다.' },
  { id: 'synth-pop', label: 'Synth Pop', description: '신디사이저 중심의 세련된 팝 사운드입니다.' },
  { id: 'teen-pop', label: 'Teen Pop', description: '밝고 접근성이 높은 틴 팝 스타일입니다.' },
  { id: 'kpop', label: 'K-Pop', description: '한국 대중음악 기반의 세련된 사운드입니다.' },
  { id: 'j-pop', label: 'J-Pop', description: '일본 대중음악 특유의 멜로디와 편곡이 특징입니다.' },
  { id: 'citypop', label: 'City Pop', description: '도시적인 레트로 감성과 세련된 그루브가 중심인 시티팝입니다.' },
  { id: 'piano-ballad', label: 'Piano Ballad', description: '피아노 중심의 감성적인 발라드입니다.' },
  { id: 'adult-contemporary', label: 'Adult Contemporary', description: '부드럽고 안정적인 성인 취향의 팝입니다.' },
  { id: 'indie-pop', label: 'Indie Pop', description: '감각적인 인디 팝 스타일입니다.' },
  { id: 'chamber-pop', label: 'Chamber Pop', description: '현악기와 섬세한 편곡이 특징인 팝입니다.' },

  { id: 'grunge', label: 'Grunge', description: '거칠고 무거운 얼터너티브 록 스타일입니다.' },
  { id: 'britpop', label: 'Britpop', description: '영국식 멜로디와 밴드 감성이 특징입니다.' },
  { id: 'shoegaze', label: 'Shoegaze', description: '공간감 있는 기타 레이어가 중심인 록입니다.' },
  { id: 'post-rock', label: 'Post Rock', description: '서사적 전개와 질감 중심의 록입니다.' },
  { id: 'punk-rock', label: 'Punk Rock', description: '빠르고 직선적인 밴드 에너지가 특징입니다.' },
  { id: 'heavy-metal', label: 'Heavy Metal', description: '강한 기타 리프와 묵직한 에너지의 메탈입니다.' },
  { id: 'thrash-metal', label: 'Thrash Metal', description: '빠르고 공격적인 메탈 스타일입니다.' },
  { id: 'death-metal', label: 'Death Metal', description: '극단적으로 무겁고 강렬한 메탈입니다.' },
  { id: 'progressive-rock', label: 'Progressive Rock', description: '복잡한 구성과 전개가 특징인 록입니다.' },
  { id: 'psychedelic-rock', label: 'Psychedelic Rock', description: '몽환적이고 실험적인 록 스타일입니다.' },

  { id: 'boom-bap', label: 'Boom Bap', description: '클래식한 힙합 드럼과 샘플 기반 스타일입니다.' },
  { id: 'trap', label: 'Trap', description: '묵직한 808과 빠른 하이햇이 특징인 힙합입니다.' },
  { id: 'drill', label: 'Drill', description: '어둡고 공격적인 리듬 중심 힙합입니다.' },
  { id: 'gangsta-rap', label: 'Gangsta Rap', description: '강한 태도와 직설적인 에너지가 특징입니다.' },
  { id: 'lofi-hiphop', label: 'Lo-fi Hip-Hop', description: '질감 있는 빈티지 톤의 로파이 힙합입니다.' },
  { id: 'contemporary-rnb', label: 'Contemporary R&B', description: '현대적인 R&B 보컬과 그루브가 중심입니다.' },
  { id: 'motown', label: 'Motown', description: '클래식 소울과 그루브 중심의 스타일입니다.' },
  { id: 'gospel', label: 'Gospel', description: '복음성가 기반의 감정적인 보컬 음악입니다.' },
  { id: 'funk-rnb', label: 'Funk', description: '리듬과 베이스가 살아 있는 펑크 기반 음악입니다.' },
  { id: 'pb-rnb', label: 'PBR&B', description: '어둡고 몽환적인 질감의 현대적 R&B입니다.' },
  { id: 'jazz-hiphop', label: 'Jazz Hip-Hop', description: '재즈 화성과 힙합 리듬이 결합된 스타일입니다.' },
  { id: 'neo-soul', label: 'Neo Soul', description: 'R&B, 소울, 재즈가 섞인 깊이 있는 그루브입니다.' },

  { id: 'house', label: 'House', description: '4/4 클럽 그루브 중심의 전자 음악입니다.' },
  { id: 'techno', label: 'Techno', description: '반복적이고 몰입감 있는 전자 리듬이 특징입니다.' },
  { id: 'trance', label: 'Trance', description: '상승감과 몰입감이 강한 전자 음악입니다.' },
  { id: 'dubstep', label: 'Dubstep', description: '강한 드롭과 베이스 변형이 특징입니다.' },
  { id: 'drum-and-bass', label: 'Drum & Bass', description: '빠른 브레이크비트와 베이스가 중심입니다.' },
  { id: 'future-bass', label: 'Future Bass', description: '현대적 신스와 감성적인 드롭이 특징입니다.' },
  { id: 'ambient-electronic', label: 'Ambient', description: '공간감과 질감 중심의 전자 음악입니다.' },
  { id: 'vaporwave', label: 'Vaporwave', description: '레트로하고 몽환적인 디지털 감성이 특징입니다.' },
  { id: 'electro-pop', label: 'Electro Pop', description: '팝 감성과 전자 사운드가 결합된 스타일입니다.' },
  { id: 'eurobeat', label: 'Eurobeat', description: '고속 비트와 강한 멜로디가 특징입니다.' },

  { id: 'swing', label: 'Swing', description: '스윙 리듬이 살아 있는 전통 재즈입니다.' },
  { id: 'bebop', label: 'Bebop', description: '복잡한 즉흥성과 빠른 전개가 특징입니다.' },
  { id: 'cool-jazz', label: 'Cool Jazz', description: '차분하고 세련된 재즈 스타일입니다.' },
  { id: 'hard-bop', label: 'Hard Bop', description: '블루스와 소울 감성이 섞인 재즈입니다.' },
  { id: 'free-jazz', label: 'Free Jazz', description: '자유롭고 실험적인 재즈입니다.' },
  { id: 'fusion-jazz', label: 'Fusion Jazz', description: '록/전자 요소가 섞인 현대적 재즈입니다.' },
  { id: 'bossanova', label: 'Bossanova', description: '브라질 리듬과 재즈가 결합된 부드러운 스타일입니다.' },
  { id: 'acid-jazz', label: 'Acid Jazz', description: '재즈와 펑크/그루브가 결합된 스타일입니다.' },
  { id: 'delta-blues', label: 'Delta Blues', description: '전통적인 블루스 루츠 스타일입니다.' },
  { id: 'chicago-blues', label: 'Chicago Blues', description: '전기 블루스 중심의 도시적 블루스입니다.' },

  { id: 'modern-folk', label: 'Modern Folk', description: '현대적으로 다듬어진 포크 스타일입니다.' },
  { id: 'anti-folk', label: 'Anti-Folk', description: '거칠고 솔직한 감성의 포크 스타일입니다.' },
  { id: 'folk-rock', label: 'Folk Rock', description: '포크와 록이 결합된 밴드 기반 스타일입니다.' },
  { id: 'singer-songwriter', label: 'Singer-Songwriter', description: '서사적 가사와 자전적 감성이 중심입니다.' },
  { id: 'world-music', label: 'World Music', description: '세계 각국의 전통 음악 요소가 반영된 스타일입니다.' },
  { id: 'country-pop', label: 'Country Pop', description: '컨트리 감성과 팝 감성이 결합된 스타일입니다.' },
  { id: 'bluegrass', label: 'Bluegrass', description: '빠른 현악기 중심의 전통 컨트리 스타일입니다.' },
  { id: 'americana', label: 'Americana', description: '미국 루츠 음악 전반을 포괄하는 스타일입니다.' },
  { id: 'honky-tonk', label: 'Honky-Tonk', description: '경쾌한 피아노와 컨트리 감성이 특징입니다.' },
  { id: 'southern-rock', label: 'Southern Rock', description: '남부 록 감성과 블루스가 결합된 스타일입니다.' },

  { id: 'traditional-trot', label: 'Traditional Trot', description: '전통 트로트의 깊은 감성이 살아 있는 스타일입니다.' },
  { id: 'semi-trot', label: 'Semi-Trot', description: '현대적으로 다듬어진 대중적 트로트 스타일입니다.' },

  { id: 'film-score', label: 'Film Score', description: '영화 음악 스타일의 서사적 구성입니다.' },
  { id: 'game-bgm', label: 'Game BGM', description: '게임 배경음악 스타일입니다.' },
  { id: 'drama-theme', label: 'Drama Theme', description: '드라마 OST 스타일의 감성적인 테마곡입니다.' },
  { id: 'piano-instrumental', label: 'Piano', description: '피아노 중심의 연주곡입니다.' },
  { id: 'guitar-instrumental', label: 'Guitar', description: '기타 중심의 연주곡입니다.' },
  { id: 'lofi-instrumental', label: 'Lo-fi', description: '로파이 질감 중심의 연주곡입니다.' },
  { id: 'healing-music', label: 'Healing Music', description: '휴식과 안정감을 위한 기능성 음악입니다.' },
  { id: 'meditation-music', label: 'Meditation Music', description: '명상과 집중을 위한 기능성 음악입니다.' },
  { id: 'ambient-newage', label: 'Ambient New Age', description: '앰비언트/뉴에이지 계열의 평온한 음악입니다.' },
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
    description: '가장 대중적이며 상업적인 성공을 목적으로 하는 음악군입니다.',
    children: groupChildren([
      'pop','dance-pop','synth-pop','teen-pop','kpop','j-pop','citypop','piano-ballad','adult-contemporary','indie-pop','chamber-pop',
    ]),
  },
  {
    id: 'rock',
    label: 'Rock & Metal',
    description: '기타, 베이스, 드럼의 강렬한 사운드와 저항 정신을 기반으로 합니다.',
    children: groupChildren([
      'grunge','britpop','shoegaze','post-rock','punk-rock','heavy-metal','thrash-metal','death-metal','progressive-rock','psychedelic-rock',
    ]),
  },
  {
    id: 'hiphop',
    label: 'Hip-hop & R&B',
    description: '리듬과 그루브, 라임과 비트를 강조하는 블랙 뮤직의 핵심입니다.',
    children: groupChildren([
      'boom-bap','trap','drill','gangsta-rap','lofi-hiphop','contemporary-rnb','motown','gospel','funk-rnb','pb-rnb','jazz-hiphop','neo-soul',
    ]),
  },
  {
    id: 'electronic',
    label: 'Electronic / EDM',
    description: '컴퓨터와 신디사이저를 활용한 사운드 디자인 중심의 음악입니다.',
    children: groupChildren([
      'house','techno','trance','dubstep','drum-and-bass','future-bass','ambient-electronic','vaporwave','electro-pop','eurobeat',
    ]),
  },
  {
    id: 'jazz-blues',
    label: 'Jazz & Blues',
    description: '즉흥 연주와 독특한 화성 체계를 가진 현대 대중음악의 뿌리입니다.',
    children: groupChildren([
      'swing','bebop','cool-jazz','hard-bop','free-jazz','fusion-jazz','bossanova','acid-jazz','delta-blues','chicago-blues',
    ]),
  },
  {
    id: 'folk-country',
    label: 'Folk & Country',
    description: '전통적인 악기와 서사적인 가사를 중시하는 음악군입니다.',
    children: groupChildren([
      'modern-folk','anti-folk','folk-rock','singer-songwriter','world-music','country-pop','bluegrass','americana','honky-tonk','southern-rock',
    ]),
  },
  {
    id: 'trot',
    label: 'Trot',
    description: '트로트 고유의 꺾기와 감정선, 대중적인 흥을 중심으로 한 음악군입니다.',
    children: groupChildren(['traditional-trot','semi-trot']),
  },
  {
    id: 'soundtrack-ost',
    label: 'Soundtrack / OST',
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
    variants: [
      { id: 'ballad', label: 'Ballad', description: '감정 중심의 기본 발라드 전개', promptCore: 'Style layer: emotional ballad pacing with clear melodic focus and vocal-forward development.' },
      { id: 'classic-ballad', label: 'Classic Ballad', description: '전통적인 발라드 감성', promptCore: 'Style layer: classic ballad writing with timeless chord flow, heartfelt delivery, and elegant melodic rise.' },
    ],
  },
  {
    id: 'dance-family',
    title: 'Dance',
    variants: [
      { id: 'dance', label: 'Dance', description: '리듬과 퍼포먼스 중심의 기본 댄스 스타일', promptCore: 'Style layer: dance-focused pulse with immediate energy and performance-ready momentum.' },
      { id: 'classic-disco', label: 'Classic Disco', description: '디스코 기반의 클래식 그루브', promptCore: 'Style layer: classic disco groove with four-on-the-floor motion, bright rhythm guitar, and uplifting movement.' },
      { id: 'modern-edm', label: 'Modern EDM', description: '현대적인 EDM 감각', promptCore: 'Style layer: modern EDM dynamics with sharp builds, polished drops, and sleek electronic impact.' },
    ],
  },
  {
    id: 'rnb-family',
    title: 'R&B',
    variants: [
      { id: 'rnb', label: 'R&B', description: '그루브와 보컬 중심의 기본 R&B', promptCore: 'Style layer: contemporary R&B groove with smooth phrasing, sensual rhythm, and polished vocal emphasis.' },
      { id: 'neo-soul-style', label: 'Neo Soul', description: '네오소울 특유의 유연한 감성', promptCore: 'Style layer: neo-soul warmth with rich harmony, laid-back pocket, and expressive vocal nuance.' },
      { id: 'pb-rnb-style', label: 'PB R&B', description: '몽환적이고 어두운 PBR&B 질감', promptCore: 'Style layer: PBR&B mood with dark atmosphere, airy spacing, and intimate modern texture.' },
    ],
  },
  {
    id: 'rock-family',
    title: 'Rock',
    variants: [
      { id: 'rock', label: 'Rock', description: '밴드 중심의 기본 록 에너지', promptCore: 'Style layer: modern rock foundation with band energy, guitar drive, and direct emotional lift.' },
      { id: 'classic-rock', label: 'Classic Rock', description: '전통적인 클래식 록 감성', promptCore: 'Style layer: classic rock character with sturdy riffs, live-band punch, and timeless anthem flow.' },
      { id: 'modern-rock', label: 'Modern Rock', description: '현대적인 록 프로덕션', promptCore: 'Style layer: modern rock production with cleaner impact, wider choruses, and current radio-ready force.' },
    ],
  },
  {
    id: 'jazz-family',
    title: 'Jazz',
    variants: [
      { id: 'jazz', label: 'Jazz', description: '재즈 화성과 유연한 흐름', promptCore: 'Style layer: jazz-influenced harmony, fluid phrasing, and refined rhythmic sophistication.' },
      { id: 'classic-jazz', label: 'Classic Jazz', description: '전통 재즈 기반의 감각', promptCore: 'Style layer: classic jazz sensibility with elegant chord language, live interplay, and timeless swing-aware detail.' },
      { id: 'jazzhop-style', label: 'Jazzhop', description: '재즈와 힙합의 결합', promptCore: 'Style layer: jazzhop blend with mellow groove, dusty rhythm feel, and jazzy melodic color.' },
    ],
  },
  {
    id: 'soul-family',
    title: 'Soul',
    variants: [
      { id: 'soul', label: 'Soul', description: '보컬과 감정 표현 중심의 기본 소울', promptCore: 'Style layer: soulful vocal emphasis with emotional depth, warm groove, and heartfelt melodic pull.' },
      { id: 'classic-soul', label: 'Classic Soul', description: '클래식 소울의 진한 감성', promptCore: 'Style layer: classic soul feeling with vintage groove, expressive lead vocals, and rich emotional conviction.' },
      { id: 'neo-soul', label: 'Neo Soul', description: '현대적 감각의 네오소울', promptCore: 'Style layer: neo-soul character with nuanced harmony, soft pocket, and contemporary elegance.' },
    ],
  },
  {
    id: 'hiphop-family',
    title: 'Hip-Hop',
    variants: [
      { id: 'hip-hop', label: 'Hip-Hop', description: '비트 중심의 기본 힙합 결', promptCore: 'Style layer: hip-hop attitude with beat-led motion, urban edge, and rhythmic vocal emphasis.' },
      { id: 'boom-bap-style', label: 'Boom Bap', description: '클래식 붐뱁 질감', promptCore: 'Style layer: boom bap rhythm with classic drum knock, head-nod groove, and sample-minded movement.' },
      { id: 'trap-style', label: 'Trap', description: '현대 트랩 중심의 강한 리듬감', promptCore: 'Style layer: trap energy with heavy low-end, crisp hats, and modern street-level intensity.' },
      { id: 'lofi-hip-hop-style', label: 'Lofi Hip-hop', description: '로파이 힙합의 부드러운 빈티지 감성', promptCore: 'Style layer: lo-fi hip-hop mood with soft beat texture, warm dust, and relaxed groove.' },
    ],
  },
  {
    id: 'funk-family',
    title: 'Funk',
    variants: [
      { id: 'funk', label: 'Funk', description: '그루브 중심의 기본 펑크 스타일', promptCore: 'Style layer: funk groove with syncopated rhythm, lively bass interplay, and contagious motion.' },
      { id: 'g-funk', label: 'G-Funk', description: 'G-Funk 특유의 느긋한 웨스트코스트 감성', promptCore: 'Style layer: G-funk glide with smooth synth leads, lowrider groove, and laid-back swagger.' },
      { id: 'p-funk', label: 'P-Funk', description: 'P-Funk 특유의 확장된 펑크 감성', promptCore: 'Style layer: P-funk bounce with playful bass, psychedelic color, and larger-than-life groove energy.' },
    ],
  },
  {
    id: 'punk-family',
    title: 'Punk',
    variants: [
      { id: 'punk', label: 'Punk', description: '거칠고 빠른 기본 펑크 에너지', promptCore: 'Style layer: punk urgency with brisk tempo, stripped-down drive, and raw directness.' },
      { id: 'pop-punk', label: 'Pop-Punk', description: '멜로디와 훅이 강한 팝펑크', promptCore: 'Style layer: pop-punk punch with melodic hooks, youthful energy, and fast band-driven choruses.' },
    ],
  },
  {
    id: 'blues-family',
    title: 'Blues',
    variants: [
      { id: 'blues', label: 'Blues', description: '블루스 특유의 감정선과 흐름', promptCore: 'Style layer: blues phrasing with expressive bends, earthy groove, and emotionally grounded movement.' },
      { id: 'roots-blues', label: 'Roots Blues', description: '루츠 블루스 기반의 원초적 감성', promptCore: 'Style layer: roots blues tone with raw feel, traditional phrasing, and earthy instrumental honesty.' },
    ],
  },
  {
    id: 'electronic-family',
    title: 'Electronic',
    variants: [
      { id: 'electronic', label: 'Electronic', description: '전자 사운드 중심의 기본 일렉트로닉 스타일', promptCore: 'Style layer: electronic production focus with sculpted synth texture and precise rhythmic architecture.' },
      { id: 'techno-style', label: 'Techno', description: '반복적 몰입감이 강한 테크노 감성', promptCore: 'Style layer: techno pulse with hypnotic repetition, controlled tension, and club-focused momentum.' },
      { id: 'house-style', label: 'House', description: '하우스 특유의 4/4 그루브', promptCore: 'Style layer: house groove with four-on-the-floor rhythm, smooth lift, and dancefloor clarity.' },
    ],
  },
  {
    id: 'latin-family',
    title: 'Latin',
    variants: [
      { id: 'latin', label: 'Latin', description: '라틴 리듬 중심의 기본 스타일', promptCore: 'Style layer: Latin rhythmic color with lively percussion motion and warm danceable energy.' },
      { id: 'salsa', label: 'Salsa', description: '살사 특유의 생동감과 타악 리듬', promptCore: 'Style layer: salsa motion with bright brass interplay, agile percussion, and celebratory movement.' },
      { id: 'reggaeton', label: 'Reggaeton', description: '레게톤 특유의 리듬과 현대적 감각', promptCore: 'Style layer: reggaeton bounce with infectious rhythm, urban flavor, and club-ready body movement.' },
    ],
  },
  {
    id: 'reggae-family',
    title: 'Reggae',
    variants: [
      { id: 'reggae', label: 'Reggae', description: '엇박자와 여유로운 기본 레게 흐름', promptCore: 'Style layer: reggae groove with offbeat emphasis, laid-back pacing, and warm relaxed flow.' },
      { id: 'roots-reggae', label: 'Roots Reggae', description: '루츠 레게의 묵직하고 깊은 감성', promptCore: 'Style layer: roots reggae tone with earthy groove, steady pulse, and spiritually grounded warmth.' },
      { id: 'dancehall', label: 'Dancehall', description: '댄스홀 특유의 강한 리듬과 텐션', promptCore: 'Style layer: dancehall energy with sharper rhythmic snap, club movement, and bold Caribbean flavor.' },
    ],
  },
  {
    id: 'global-family',
    title: 'Global pop style',
    variants: [
      { id: 'global-pop-style', label: 'Global Style', description: '국가를 넘나드는 글로벌 팝 감각', promptCore: 'Style layer: global pop approach with broad mainstream appeal, clean hooks, and international polish.' },
      { id: 'k-style', label: 'K-Style', description: 'K-Pop 감성의 세련된 전개', promptCore: 'Style layer: K-style polish with sharp sections, addictive hooks, and sleek Korean pop sensibility.' },
      { id: 'anime-style', label: 'Anime Style', description: '애니메이션 OST 같은 상승감과 드라마', promptCore: 'Style layer: anime-style melodic drama with emotional lift, vivid progression, and soaring payoff.' },
      { id: 'game-bgm-style', label: 'Game BGM', description: '게임 BGM 같은 장면감과 몰입감', promptCore: 'Style layer: game-BGM flavor with scene-driven pacing, vivid motif focus, and immersive motion.' },
    ],
  },
] as const;

export const SOUND_STYLES: SoundStyleItem[] = STYLE_CYCLES.flatMap((cycle) =>
  cycle.variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    description: variant.description,
    promptCore: variant.promptCore,
  }))
);

export const SOUND_TEXTURE_CYCLES: InstrumentSoundCycle[] = [
  {
    id: 'band-family',
    title: 'Band',
    variants: [
      { id: 'band', label: 'Band', description: '기본 밴드 편성 중심', promptCore: 'Sound/texture layer: balanced live band foundation with drums, bass, guitar, and keys supporting the arrangement.' },
      { id: 'pop-band', label: 'Pop Band', description: '대중적인 팝 밴드 편성', promptCore: 'Sound/texture layer: pop-band arrangement with clean ensemble balance and hook-friendly support.' },
      { id: 'funk-band', label: 'Funk Band', description: '펑크 밴드의 그루브 중심 편성', promptCore: 'Sound/texture layer: funk-band interplay with tight rhythm section and groove-led movement.' },
      { id: 'rock-band', label: 'Rock Band', description: '록 밴드 중심의 에너지', promptCore: 'Sound/texture layer: rock-band drive with live drums, electric guitar push, and band-sized impact.' },
      { id: 'jazz-band', label: 'Jazz Band', description: '재즈 밴드 중심의 유기적 편성', promptCore: 'Sound/texture layer: jazz-band interaction with live rhythm section and flexible musical conversation.' },
    ],
  },
  {
    id: 'bass-family',
    title: 'Bass',
    variants: [
      { id: 'bass', label: 'Bass', description: '기본 베이스 중심감', promptCore: 'Sound/texture layer: defined bass foundation supporting harmony and pulse.' },
      { id: '808-bass', label: '808 Bass', description: '808 중심의 저역', promptCore: 'Sound/texture layer: 808 bass weight with modern sub impact and sustained low-end pressure.' },
      { id: 'smooth-bass', label: 'Smooth Bass', description: '부드럽고 매끈한 베이스', promptCore: 'Sound/texture layer: smooth bass flow with rounded tone and melodic support.' },
      { id: 'funky-bassline', label: 'Funky Bassline', description: '리듬을 주도하는 펑키 베이스라인', promptCore: 'Sound/texture layer: funky bassline movement with rhythmic articulation and playful groove.' },
      { id: 'sharp-synth-bass', label: 'Sharp Synth Bass', description: '선명한 신스 베이스', promptCore: 'Sound/texture layer: sharp synth bass with defined attack and modern electronic contour.' },
    ],
  },
  {
    id: 'drums-family',
    title: 'Drums',
    variants: [
      { id: 'drums', label: 'Drums', description: '기본 드럼 중심', promptCore: 'Sound/texture layer: steady drum backbone shaping the groove and arrangement energy.' },
      { id: 'brushed-drums', label: 'Brushed drums', description: '브러시 드럼의 부드러운 질감', promptCore: 'Sound/texture layer: brushed drums with soft attack and intimate live feel.' },
      { id: 'double-time', label: 'Double-time', description: '더블타임 리듬감', promptCore: 'Sound/texture layer: double-time rhythmic motion creating urgency and forward momentum.' },
      { id: 'half-time', label: 'Half-time', description: '하프타임 리듬감', promptCore: 'Sound/texture layer: half-time pocket with heavier space and deeper weight.' },
      { id: 'driving-rhythm', label: 'Driving rhythm', description: '밀어주는 추진형 리듬', promptCore: 'Sound/texture layer: driving rhythm with clear forward push and energetic pulse.' },
    ],
  },
  {
    id: 'pad-family',
    title: 'Pad',
    variants: [
      { id: 'pad', label: 'Pad', description: '기본 패드 레이어', promptCore: 'Sound/texture layer: supportive pad bed adding width and harmonic atmosphere.' },
      { id: 'glassy-pad', label: 'Glassy Pad', description: '투명하고 맑은 패드', promptCore: 'Sound/texture layer: glassy pad shimmer with airy high-end and transparent lift.' },
      { id: 'warm-pad', label: 'Warm Pad', description: '따뜻한 패드 질감', promptCore: 'Sound/texture layer: warm pad support with soft body and comforting width.' },
      { id: 'ethereal-pad', label: 'Ethereal Pad', description: '몽환적인 패드', promptCore: 'Sound/texture layer: ethereal pad bloom with floating atmosphere and dreamlike space.' },
      { id: 'deep-pad', label: 'Deep Pad', description: '깊게 깔리는 패드', promptCore: 'Sound/texture layer: deep pad foundation with darker ambience and immersive depth.' },
    ],
  },
  {
    id: 'synths-family',
    title: 'Synths',
    variants: [
      { id: 'synths', label: 'Synths', description: '기본 신스 레이어', promptCore: 'Sound/texture layer: synth presence shaping the melodic color and modern tone.' },
      { id: 'bright-synth', label: 'Bright Synth', description: '밝고 선명한 신스', promptCore: 'Sound/texture layer: bright synth tone with vivid top-end and catchy presence.' },
      { id: 'dreamy-synth', label: 'Dreamy Synth', description: '몽환적인 신스', promptCore: 'Sound/texture layer: dreamy synth wash with soft blur and floating melodic glow.' },
      { id: 'dark-synth', label: 'Dark Synth', description: '어두운 신스 질감', promptCore: 'Sound/texture layer: dark synth color with moody tone and shadowed atmosphere.' },
      { id: 'deep-synth', label: 'Deep Synth', description: '깊고 묵직한 신스', promptCore: 'Sound/texture layer: deep synth body with rich weight and immersive depth.' },
    ],
  },
  {
    id: 'snare-family',
    title: 'Snare',
    variants: [
      { id: 'snare', label: 'Snare', description: '기본 스네어 톤', promptCore: 'Sound/texture layer: clear snare definition anchoring the backbeat.' },
      { id: 'sharp-snare', label: 'Sharp snare', description: '날카로운 스네어', promptCore: 'Sound/texture layer: sharp snare crack with precise transient edge.' },
      { id: 'warm-snare', label: 'Warm snare', description: '따뜻한 스네어', promptCore: 'Sound/texture layer: warm snare body with rounded tone and softer edge.' },
      { id: 'hard-hitting-snare', label: 'Hard-hitting snare', description: '강하게 치는 스네어', promptCore: 'Sound/texture layer: hard-hitting snare impact with bold attack and punch.' },
      { id: 'big-reverb-snare', label: 'Big reverb snare', description: '큰 리버브가 걸린 스네어', promptCore: 'Sound/texture layer: big reverb snare with wide tail and dramatic space.' },
    ],
  },
  {
    id: 'hihats-family',
    title: 'Hi-hats',
    variants: [
      { id: 'hi-hats', label: 'Hi-hats', description: '기본 하이햇 패턴', promptCore: 'Sound/texture layer: hi-hat detail maintaining rhythmic definition and motion.' },
      { id: 'crisp-hi-hats', label: 'Crisp hi-hats', description: '또렷한 하이햇', promptCore: 'Sound/texture layer: crisp hi-hats adding clarity and fast rhythmic sparkle.' },
      { id: 'soft-hi-hats', label: 'Soft hi-hats', description: '부드러운 하이햇', promptCore: 'Sound/texture layer: soft hi-hats with smoother articulation and lighter touch.' },
      { id: 'fast-triplet-hi-hats', label: 'Fast triplet hi-hats', description: '빠른 트리플렛 하이햇', promptCore: 'Sound/texture layer: fast triplet hi-hats creating agile, rolling rhythmic tension.' },
      { id: 'distanced-hi-hats', label: 'Distanced hi-hats', description: '멀리 있는 하이햇 질감', promptCore: 'Sound/texture layer: distanced hi-hats with softened presence and atmospheric placement.' },
    ],
  },
  {
    id: 'guitar-family',
    title: 'Guitar',
    variants: [
      { id: 'guitar', label: 'Guitar', description: '기본 기타 레이어', promptCore: 'Sound/texture layer: guitar support adding rhythmic shape and harmonic texture.' },
      { id: 'acoustic', label: 'Acoustic', description: '어쿠스틱 기타 중심', promptCore: 'Sound/texture layer: acoustic guitar warmth with natural strum texture and organic support.' },
      { id: 'electric', label: 'Electric', description: '일렉 기타 중심', promptCore: 'Sound/texture layer: electric guitar presence with modern bite and clear rhythmic edge.' },
      { id: 'overdriven', label: 'Overdriven', description: '오버드라이브 기타', promptCore: 'Sound/texture layer: overdriven guitar tone with grit, sustain, and emotional push.' },
      { id: 'ambient-electric', label: 'Ambient Electric', description: '공간감 있는 일렉 기타', promptCore: 'Sound/texture layer: ambient electric guitar with spacious tails and atmospheric motion.' },
    ],
  },
  {
    id: 'trumpet-family',
    title: 'Trumpet',
    variants: [
      { id: 'trumpet', label: 'Trumpet', description: '기본 트럼펫 컬러', promptCore: 'Sound/texture layer: trumpet color adding melodic accent and brass brightness.' },
      { id: 'bright-trumpet', label: 'Bright Trumpet', description: '밝게 치고 나오는 트럼펫', promptCore: 'Sound/texture layer: bright trumpet accent with vivid tone and energetic lift.' },
      { id: 'muted-trumpet', label: 'Muted Trumpet', description: '뮤트 트럼펫의 차분한 색감', promptCore: 'Sound/texture layer: muted trumpet character with restrained, intimate brass color.' },
      { id: 'soft-trumpet-solo', label: 'Soft Trumpet solo', description: '부드러운 트럼펫 솔로', promptCore: 'Sound/texture layer: soft trumpet solo phrasing with lyrical warmth and airy elegance.' },
      { id: 'funky-trumpet-hits', label: 'Funky Trumpet hits', description: '펑키한 트럼펫 히트', promptCore: 'Sound/texture layer: funky trumpet hits delivering rhythmic brass punches and groove accents.' },
    ],
  },
  {
    id: 'heritage-plucks-family',
    title: 'Gayageum',
    variants: [
      { id: 'gayageum', label: 'Gayageum', description: '가야금의 섬세한 전통 현악 질감', promptCore: 'Sound/texture layer: gayageum texture with delicate Korean plucked-string expression.' },
      { id: 'haegeum', label: 'Haegeum', description: '해금의 애절한 선율감', promptCore: 'Sound/texture layer: haegeum voice with expressive bowed Korean timbre and emotional contour.' },
      { id: 'kalimba-pluck', label: 'Kalimba pluck', description: '칼림바의 맑고 또렷한 플럭 질감', promptCore: 'Sound/texture layer: kalimba pluck sparkle with clean transient charm and intimate detail.' },
    ],
  },
  {
    id: 'strings-family',
    title: 'Strings',
    variants: [
      { id: 'strings', label: 'Strings', description: '기본 스트링 레이어', promptCore: 'Sound/texture layer: strings adding lift, warmth, and emotional contour.' },
      { id: 'full-orchestral-strings', label: 'Full Orchestral Strings', description: '풍성한 오케스트라 스트링', promptCore: 'Sound/texture layer: full orchestral strings creating cinematic breadth and dramatic support.' },
      { id: 'soft-legato-strings', label: 'Soft legato strings', description: '부드럽게 이어지는 레가토 스트링', promptCore: 'Sound/texture layer: soft legato strings with flowing sustained warmth.' },
      { id: 'pizzicato-strings', label: 'Pizzicato strings', description: '피치카토 스트링의 경쾌한 질감', promptCore: 'Sound/texture layer: pizzicato strings adding plucked motion and playful articulation.' },
      { id: 'staccato-strings', label: 'Staccato strings', description: '스타카토 스트링의 분명한 어택', promptCore: 'Sound/texture layer: staccato strings delivering rhythmic precision and pointed emphasis.' },
    ],
  },
  {
    id: 'texture-family',
    title: 'Minimalist texture',
    variants: [
      { id: 'minimalist-texture', label: 'Minimalist texture', description: '절제된 텍스쳐 중심', promptCore: 'Sound/texture layer: minimalist texture with wide spacing and deliberate restraint.' },
      { id: 'rich-texture', label: 'Rich texture', description: '풍성하고 조밀한 텍스쳐', promptCore: 'Sound/texture layer: rich texture with layered detail and dense harmonic support.' },
      { id: 'evolving-texture', label: 'Evolving texture', description: '시간에 따라 변화하는 텍스쳐', promptCore: 'Sound/texture layer: evolving texture that gradually shifts and blooms across sections.' },
      { id: 'granular-texture', label: 'Granular texture', description: '입자감 있는 실험적 텍스쳐', promptCore: 'Sound/texture layer: granular texture with fragmented detail and experimental atmosphere.' },
    ],
  },
  {
    id: 'ambience-family',
    title: 'Nature textures',
    variants: [
      { id: 'nature-textures', label: 'Nature textures', description: '자연스러운 환경 질감', promptCore: 'Sound/texture layer: subtle nature textures adding organic ambience and breathing space.' },
      { id: 'rainy-textures', label: 'Rainy textures', description: '비 오는 듯한 서정적 질감', promptCore: 'Sound/texture layer: rainy textures with gentle droplets and reflective ambience.' },
      { id: 'urban-ambience', label: 'Urban ambience', description: '도시적 공간감', promptCore: 'Sound/texture layer: urban ambience with modern environmental depth and nocturnal color.' },
      { id: 'mechanical-textures', label: 'Mechanical textures', description: '기계적이고 산업적인 질감', promptCore: 'Sound/texture layer: mechanical textures with industrial pulse and cold textural detail.' },
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
  { id: 'emotional', label: 'Emotional', description: '깊고 진한 감정 표현이 중심이 되는 분위기입니다.' },
  { id: 'sad', label: 'Sad', description: '슬픔과 상실감이 짙게 느껴지는 감정선입니다.' },
  { id: 'warm', label: 'Warm', description: '따뜻하고 포근하게 감싸는 정서입니다.' },
  { id: 'calm', label: 'Calm', description: '차분하고 고요하게 가라앉는 감정 흐름입니다.' },
  { id: 'dark', label: 'Dark', description: '어둡고 무게감 있는 정서를 담은 분위기입니다.' },
  { id: 'bright', label: 'Bright', description: '밝고 환하게 펼쳐지는 긍정적인 감정입니다.' },
  { id: 'hopeful', label: 'Hopeful', description: '앞을 향해 나아가는 희망과 기대의 정서입니다.' },
  { id: 'lonely', label: 'Lonely', description: '혼자 남겨진 듯한 외로움과 여백의 감정입니다.' },
  { id: 'nostalgic', label: 'Nostalgic', description: '지나간 시간과 기억을 떠올리게 하는 향수입니다.' },
  { id: 'dreamy', label: 'Dreamy', description: '몽환적이고 흐릿하게 번지는 감성입니다.' },
  { id: 'tense', label: 'Tense', description: '긴장감과 불안감이 서서히 높아지는 정서입니다.' },
  { id: 'peaceful', label: 'Peaceful', description: '평온하고 안정된 마음 상태를 담은 분위기입니다.' },
];

export const THEMES: CategoryItem[] = [
  { id: 'love', label: 'Love', description: '사랑에 빠지거나 사랑을 바라보는 이야기입니다.' },
  { id: 'breakup', label: 'Breakup', description: '이별 이후의 감정과 남겨진 마음을 다룹니다.' },
  { id: 'comfort', label: 'Comfort', description: '누군가를 위로하거나 위로받는 상황을 담습니다.' },
  { id: 'healing', label: 'Healing', description: '상처를 회복하고 마음을 다독이는 흐름입니다.' },
  { id: 'youth', label: 'Youth', description: '청춘의 순간과 성장통, 반짝이는 시간을 그립니다.' },
  { id: 'dream', label: 'Dream', description: '꿈꾸는 미래와 바람, 이상을 향한 이야기를 담습니다.' },
  { id: 'daily-life', label: 'Daily Life', description: '평범한 일상 속 작은 장면과 감정을 담습니다.' },
  { id: 'travel', label: 'Travel', description: '어딘가로 떠나는 길 위의 장면과 감정을 표현합니다.' },
  { id: 'night', label: 'Night', description: '밤이라는 시간대가 주는 분위기와 사건을 그립니다.' },
  { id: 'memories', label: 'Memories', description: '지나간 추억과 되돌아보는 마음을 중심으로 합니다.' },
  { id: 'growth', label: 'Growth', description: '변화와 성숙, 앞으로 나아가는 과정을 담습니다.' },
  { id: 'loneliness', label: 'Loneliness', description: '홀로 남겨진 순간과 내면의 독백을 이야기합니다.' },
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
    label: '팝 & 글로벌',
    description: '전 세계적으로 사랑받는 대중적인 팝 사운드와 K-Pop, J-Pop 등 글로벌 스타일을 포함합니다.',
    children: [
      {
        id: 'pop',
        label: '팝',
        children: [
          { id: 'synth_pop', label: '신스팝' },
          { id: 'disco', label: '디스코' },
          { id: 'electropop', label: '일렉트로팝' },
          { id: 'teen_pop', label: '틴팝' },
          { id: 'britpop', label: '브릿팝' },
          { id: 'indie_pop', label: '인디팝' },
          { id: 'city_pop', label: '시티팝' },
          { id: 'funk_pop', label: '펑크팝' },
          { id: 'dance_pop', label: '댄스팝' },
          { id: 'acoustic_pop', label: '어쿠스틱팝' },
        ]
      },
      {
        id: 'kpop',
        label: 'K-Pop',
        children: [
          { id: 'idol_dance', label: '아이돌 댄스' },
          { id: 'k_ballad', label: 'K-발라드' },
          { id: 'k_synth_pop', label: 'K-신스팝' },
          { id: 'k_trap', label: 'K-트랩' },
          { id: 'k_new_jack_swing', label: 'K-뉴잭스윙' },
          { id: 'k_indie', label: 'K-인디' },
          { id: 'k_folk', label: 'K-포크' },
          { id: 'k_rock', label: 'K-록' },
          { id: 'gugak_fusion', label: '국악 퓨전' },
        ]
      },
      {
        id: 'jpop_style',
        label: 'J-스타일 (J-Pop)',
        children: [
          { id: 'j_idol_pop', label: 'J-아이돌 팝' },
          { id: 'shibuya_kei', label: '시부야계' },
          { id: 'anime_rock', label: '애니메이션 록' },
          { id: 'j_city_pop', label: 'J-시티팝' },
          { id: 'visual_kei', label: '비주얼계' },
          { id: 'utaite_style', label: '우타이테 스타일' },
          { id: 'vocaloid_style', label: '보컬로이드 스타일' },
          { id: 'j_jazz_pop', label: 'J-재즈팝' },
          { id: 'j_electro', label: 'J-일렉트로' },
          { id: 'j_ballad', label: 'J-발라드' },
        ]
      }
    ]
  },
  {
    id: 'group_hiphop_rnb',
    label: '힙합 & 알앤비',
    description: '강렬한 비트의 힙합과 감미로운 그루브의 R&B, 소울 음악을 아우르는 카테고리입니다.',
    children: [
      {
        id: 'hiphop',
        label: '힙합',
        children: [
          { id: 'trap', label: '트랩' },
          { id: 'drill', label: '드릴' },
          { id: 'boombap', label: '붐뱁' },
          { id: 'lofi', label: '로파이' },
          { id: 'jazz_hiphop', label: '재즈힙합' },
          { id: 'emo_rap', label: '이모랩' },
          { id: 'old_school', label: '올드스쿨' },
          { id: 'g_funk', label: 'G-펑크' },
          { id: 'cloud_rap', label: '클라우드 랩' },
        ]
      },
      {
        id: 'rnb',
        label: '알앤비',
        children: [
          { id: 'contemporary_rnb', label: '컨템퍼러리 R&B' },
          { id: 'neo_soul', label: '네오 소울' },
          { id: 'soul', label: '소울' },
          { id: 'funk', label: '펑크' },
          { id: 'alternative_rnb', label: '얼터너티브 R&B' },
          { id: 'new_jack_swing', label: '뉴잭스윙' },
        ]
      }
    ]
  },
  {
    id: 'group_rock_band',
    label: '록 & 밴드',
    description: '에너지 넘치는 록 사운드부터 묵직한 메탈까지, 밴드 악기 중심의 강렬한 음악들을 제공합니다.',
    children: [
      {
        id: 'rock',
        label: '록',
        children: [
          { id: 'alternative_rock', label: '얼터너티브 록' },
          { id: 'modern_rock', label: '모던 록' },
          { id: 'punk_rock', label: '펑크 록' },
          { id: 'hard_rock', label: '하드 록' },
          { id: 'soft_rock', label: '소프트 록' },
          { id: 'garage_rock', label: '개러지 록' },
          { id: 'shoegazing', label: '슈게이징' },
          { id: 'folk_rock', label: '포크 록' },
          { id: 'blues_rock', label: '블루스 록' },
        ]
      },
      {
        id: 'metal',
        label: '메탈',
        children: [
          { id: 'heavy_metal', label: '헤비메탈' },
          { id: 'death_metal', label: '데스메탈' },
          { id: 'thrash_metal', label: '스래시메탈' },
          { id: 'metalcore', label: '메탈코어' },
          { id: 'nu_metal', label: '뉴메탈' },
          { id: 'symphonic_metal', label: '심포닉 메탈' },
          { id: 'power_metal', label: '파워 메탈' },
        ]
      }
    ]
  },
  {
    id: 'group_edm_dance',
    label: '전자음악 & 댄스',
    description: '신디사이저와 디지털 비트가 주도하는 클럽 사운드와 현대적인 일렉트로닉 댄스 음악입니다.',
    children: [
      {
        id: 'edm',
        label: 'EDM',
        children: [
          { id: 'house', label: '하우스' },
          { id: 'techno', label: '테크노' },
          { id: 'trance', label: '트랜스' },
          { id: 'future_bass', label: '퓨처 베이스' },
          { id: 'dubstep', label: '덥스텝' },
          { id: 'deep_house', label: '딥 하우스' },
          { id: 'tropical_house', label: '트로피컬 하우스' },
          { id: 'eurobeat', label: '유로비트' },
          { id: 'drum_and_bass', label: '드럼앤베이스' },
        ]
      }
    ]
  },
  {
    id: 'group_jazz_classical',
    label: '재즈 & 클래식',
    description: '예술적 깊이가 있는 재즈의 즉흥성과 클래식의 우아한 선율을 담은 고품격 음악 카테고리입니다.',
    children: [
      {
        id: 'jazz',
        label: '재즈',
        children: [
          { id: 'swing_jazz', label: '스윙 재즈' },
          { id: 'bossa_nova', label: '보사노바' },
          { id: 'fusion_jazz', label: '퓨전 재즈' },
          { id: 'cool_jazz', label: '쿨 재즈' },
          { id: 'big_band', label: '빅밴드' },
          { id: 'latin_jazz', label: '라틴 재즈' },
          { id: 'jazz_vocal', label: '재즈 보컬' },
          { id: 'hard_bop', label: '하드 밥' },
        ]
      },
      {
        id: 'classical',
        label: '클래식',
        children: [
          { id: 'full_orchestra', label: '풀 오케스트라' },
          { id: 'piano_solo_classical', label: '피아노 독주' },
          { id: 'string_ensemble_classical', label: '현악 합주' },
          { id: 'choral', label: '합창' },
          { id: 'baroque', label: '바로크' },
          { id: 'opera', label: '오페라' },
        ]
      }
    ]
  },
  {
    id: 'group_folk_world',
    label: '포크 & 월드',
    description: '어쿠스틱 악기의 따뜻한 감성과 세계 각국의 전통적인 색채를 담은 이국적인 음악들입니다.',
    children: [
      {
        id: 'acoustic_folk',
        label: '어쿠스틱/포크',
        children: [
          { id: 'traditional_folk', label: '정통 포크' },
          { id: 'country', label: '컨트리' },
          { id: 'bluegrass', label: '블루그래스' },
          { id: 'singer_songwriter', label: '싱어송라이터' },
          { id: 'acoustic_session', label: '어쿠스틱 세션' },
          { id: 'fingerstyle', label: '핑거스타일' },
        ]
      },
      {
        id: 'world_music_folk',
        label: '월드 뮤직',
        children: [
          { id: 'reggae', label: '레게' },
          { id: 'afrobeat', label: '아프로비트' },
          { id: 'celtic', label: '켈틱' },
          { id: 'latin_salsa', label: '라틴(살사)' },
          { id: 'flamenco', label: '플라멩코' },
        ]
      }
    ]
  },
  {
    id: 'group_trot_adult',
    label: '트로트 & 성인가요',
    description: '한국 특유의 정서와 흥이 담긴 트로트와 전 세대가 즐길 수 있는 성인 가요 스타일입니다.',
    children: [
      {
        id: 'trot',
        label: '트로트',
        children: [
          { id: 'traditional_trot', label: '정통 트로트' },
          { id: 'semi_trot', label: '세미 트로트' },
          { id: 'disco_trot', label: '디스코 트로트' },
          { id: 'rock_trot', label: '락 트로트' },
          { id: 'ballad_trot', label: '발라드 트로트' },
          { id: 'blues_trot', label: '블루스 트로트' },
          { id: 'shuffle_trot', label: '셔플 트로트' },
          { id: 'gugak_trot', label: '국악 트로트' },
        ]
      },
      {
        id: '7080_gayo',
        label: '7080 가요',
        children: [
          { id: '7080_folk', label: '7080 포크' },
          { id: 'adult_ballad', label: '성인 발라드' },
          { id: 'campus_band_sound', label: '캠퍼스 밴드 사운드' },
          { id: 'enka_style', label: '엔카 스타일' },
        ]
      }
    ]
  },
  {
    id: 'group_cinematic_bgm',
    label: '시네마틱 & 배경음악',
    description: '영화나 드라마의 서사를 완성하는 배경음악과 공간의 분위기를 채우는 기능성 사운드입니다.',
    children: [
      {
        id: 'ost',
        label: 'OST',
        children: [
          { id: 'orchestral_score', label: '오케스트럴 스코어' },
          { id: 'hybrid_epic', label: '하이브리드 에픽' },
          { id: 'synth_score', label: '신시사이저 스코어' },
          { id: 'piano_solo', label: '피아노 솔로' },
          { id: 'string_ensemble', label: '스트링 합주' },
          { id: 'chiptune', label: '칩튠' },
          { id: 'world_music', label: '월드 뮤직' },
          { id: 'minimalism', label: '미니멀리즘' },
          { id: 'ambient', label: '앰비언트' },
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
    style: "Modern Pop", // 세련된 현대 팝의 정석
    sound: "Layered synths, Electric guitar", // 화려한 신스와 팝 기타 사운드
    vocal: "Melodic delivery", // 멜로디 위주의 깔끔한 가창
  },
  kpop: {
    style: "Modern Korean Pop", // 아이돌부터 인디까지 아우르는 한국 대중음악
    sound: "Polished production, Hybrid beats", // 정교한 믹싱과 전자음/리얼 사운드의 조화
    vocal: "Expressive vocals", // 한국적 감성이 담긴 풍부한 가창력
  },
  jpop: {
    style: "Modern Japanese Pop", // J-팝 특유의 청량하고 속도감 있는 느낌
    sound: "Bright digital synths, Electric guitar", // 밝은 디지털 신스와 찰랑거리는 기타
    vocal: "Clear J-pop style tone", // 맑고 선명한 일본 팝 특유의 발성
  },
  hiphop: {
    style: "Hiphop, Urban", // 리듬과 비트 중심의 거리 감성
    sound: "Heavy 808 bass, Punchy snare", // 가슴을 울리는 베이스와 타격감 있는 스네어
    vocal: "Rhythmic rap flow", // 박자감이 살아있는 랩 전달력
  },
  rnb: {
    style: "R&B, Soul", // 부드럽고 그루비한 도심형 사운드
    sound: "Electric piano, Silky bass", // 따뜻한 건반과 매끄러운 베이스 라인
    vocal: "Soulful, Smooth", // 소울풀하고 기교 섞인 부드러운 목소리
  },
  trot: {
    style: "Trot", // 한국 성인가요의 흥과 한
    sound: "Accordion, Bright brass", // 트로트의 상징인 아코디언과 화려한 관악기
    vocal: "Trot vibrato phrasing", // 특유의 꺾기와 기교가 섞인 창법
  },
  "7080_gayo": {
    style: "7080 Korean Retro Pop", // 70~80년대 그리운 그 시절의 감성
    sound: "Acoustic guitar, Vintage Organ, Analog texture", // 아날로그 질감의 통기타와 오르간
    vocal: "Warm, Nostalgic storyteller tone", // 서사적이고 따뜻한 이야기꾼의 목소리
  },
  ost: {
    style: "Cinematic Score", // 영화나 드라마 속 서사적인 배경 음악
    sound: "Orchestral strings, Dramatic piano", // 웅장한 현악기와 극적인 피아노 선율
    vocal: "Atmospheric textures", // 몽환적이고 공간감 있는 보컬 질감
  },
  rockmetal: {
    style: "Rock, Metal", // 강렬한 밴드 사운드의 에너지
    sound: "Distorted guitar, Power drums", // 거친 일렉 기타와 파워풀한 드럼 사운드
    vocal: "Powerful, Raw tone", // 꾸밈없는 거칠고 폭발적인 가창
  },
  edm: {
    style: "EDM, Electronic", // 클럽과 페스티벌의 화려한 전자 음악
    sound: "Lead synths, Sub-bass drop", // 강렬한 리드 신스와 저음역대 드랍
    vocal: "Processed texture", // 기계적인 효과가 가미된 전자적 질감
  },
  jazz: {
    style: "Jazz", // 고급스럽고 자유로운 즉흥 음악의 느낌
    sound: "Upright bass, Jazz piano", // 콘트라베이스와 재즈 피아노의 조화
    vocal: "Jazzy phrasing", // 박자를 밀고 당기는 특유의 재즈 가창
  },
  classical: {
    style: "Classical", // 정통 서양 고전 음악의 품격
    sound: "Symphonic orchestra, Grand piano", // 풀 오케스트라와 그랜드 피아노의 협연
    vocal: "Classical technique", // 성악적 기교가 담긴 클래식 발성
  },
  acoustic: {
    style: "Acoustic, Folk", // 인위적이지 않은 자연스러운 소리
    sound: "Steel-string acoustic guitar", // 쇠줄 통기타 특유의 찰랑거리는 울림
    vocal: "Natural, Pure tone", // 꾸밈없고 맑은 자연스러운 목소리
  },
  world: {
    style: "World Music", // 전 세계 각지의 전통과 리듬
    sound: "Traditional ethnic instruments", // 민속 악기 특유의 독특한 음색
    vocal: "Native phrasing", // 특정 문화권의 독특한 창법과 느낌
  },
};