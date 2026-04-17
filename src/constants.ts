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
    titleKo: '발라드 퓨전',
    variants: [
      { 
        id: 'ballad', 
        label: 'Emotional Ballad feeling', 
        labelKo: '발라드 느낌', 
        description: '감정 중심의 기본 발라드 전개', 
        descriptionKo: '피아노와 현악기의 부드러운 레가토가 강조된 서정적이고 투명한 공간감을 제공합니다.',
        style: 'emotional ballad pacing',
        sound: 'clear melodic focus, vocal-forward development',
        mood: 'emotional, sentimental'
      },
      { 
      id: 'wildflower_pop_ballad',
      label: 'Wildflower Pop Ballad', 
      labelKo: '야생화풍 발라드',
      description: 'Deep emotional narrative starting with minimalist piano and escalating into a grand, explosive orchestral climax.', 
      descriptionKo: '절제된 피아노로 시작해 극적인 서사를 만듭니다.', 
      style: 'Minimalist Piano Ballad, Solo Piano Accompaniment', 
      sound: 'Acoustic piano only, NO strings, NO drums, NO bass, NO synth,', 
      mood: 'Melancholic, Minimalist, pure, intimate, lonely', 
      },
      { 
        id: 'classic-ballad', 
        label: 'Classic Ballad feeling', 
        labelKo: '클래식 발라드 느낌', 
        description: '전통적인 발라드 감성', 
        descriptionKo: '전통적인 어쿠스틱 악기들의 조화로운 울림과 따뜻한 아날로그 질감이 돋보이는 사운드입니다.',
        style: 'classic ballad writing, timeless chord flow',
        sound: 'elegant melodic rise',
        mood: 'heartfelt delivery'
      },
    ],
  },
  {
    id: 'dance-family',
    title: 'Dance',
    titleKo: '댄스 리듬',
    variants: [
      { 
        id: 'dance', 
        label: 'Dance feeling', 
        labelKo: '댄스 지향적', 
        description: '리듬과 퍼포먼스 중심의 기본 댄스 스타일', 
        descriptionKo: '명확한 킥 드럼의 어택감과 에너제틱한 신스 베이스가 주도하는 추진력 있는 사운드 질감입니다.',
        style: 'dance-focused pulse',
        sound: 'immediate energy',
        mood: 'performance-ready momentum'
      },
      { 
        id: 'classic-disco', 
        label: 'with Disco Groove', 
        labelKo: '디스코 그루브', 
        description: '디스코 기반의 클래식 그루브', 
        descriptionKo: '펑키한 커팅 기타와 옥타브 베이스 라인이 만들어내는 경쾌하고 화려한 레트로 질감입니다.',
        style: 'classic disco groove, four-on-the-floor motion',
        sound: 'bright rhythm guitar',
        mood: 'uplifting movement'
      },
      { 
        id: 'modern-edm', 
        label: 'with EDM', 
        labelKo: 'EDM 추가', 
        description: '현대적인 EDM 감각', 
        descriptionKo: '날카로운 트랜지언트와 강력한 사이드체인 효과가 적용된 현대적이고 압도적인 전자음 질감입니다.',
        style: 'modern EDM dynamics, polished drops',
        sound: 'sharp builds, sleek electronic impact',
        mood: 'high energy, powerful'
      },
      { 
        id: 'nu-disco-fusion', 
        label: 'Nu-Disco Fusion', 
        labelKo: '누 디스코 퓨전', 
        description: '세련된 도시적 그루브', 
        descriptionKo: '단단한 슬랩 베이스 루프와 끊어 치는 DX7 건반, 리드미컬한 16비트 기타 커팅이 강조된 스타일입니다.',
        style: 'Nu-Disco fusion groove',
        sound: 'punchy repetitive slap bass loops, staccato DX7-style stabs, rhythmic 16th-note electric guitar cutting',
        mood: 'urban groove, sophisticated'
      },
    ],
  },
  {
    id: 'rnb-family',
    title: 'R&B',
    titleKo: 'R&B 소울',
    variants: [
      { 
        id: 'rnb', 
        label: 'R&B Groove', 
        labelKo: 'R&B 그루브', 
        description: '그루브와 보컬 중심의 기본 R&B', 
        descriptionKo: '매끄러운 보컬 프로세싱과 세련된 코드 진행이 어우러진 부드럽고 유연한 소리 질감입니다.',
        style: 'contemporary R&B groove, smooth phrasing',
        sound: 'polished vocal emphasis',
        mood: 'sensual rhythm, smooth'
      },
      { 
        id: 'neo-soul-style', 
        label: 'Neo Soul Texture', 
        labelKo: '네오 소울 질감', 
        description: '네오소울 특유의 유연한 감성', 
        descriptionKo: ' 풍부한 텐션 코드와 레이드백된 리듬감이 특징인 따뜻하고 깊이 있는 소울풀한 질감입니다.',
        style: 'neo-soul warmth, rich harmony',
        sound: 'expressive vocal nuance',
        mood: 'laid-back pocket, soulful'
      },
      { 
        id: 'pb-rnb-style', 
        label: 'PBR&B Texture', 
        labelKo: 'PBR&B 텍스처', 
        description: '몽환적이고 어두운 PBR&B 질감', 
        descriptionKo: '어둡고 몽환적인 리버브와 로우파이한 필터링이 적용된 현대적이고 실험적인 공간감입니다.',
        style: 'PBR&B flow, airy spacing',
        sound: 'intimate modern texture',
        mood: 'dark atmosphere, moody'
      },
    ],
  },
  {
    id: 'rock-family',
    title: 'Rock',
    titleKo: '록 지향적',
    variants: [
      { 
        id: 'rock', 
        label: 'Rock Energy', 
        labelKo: '록 에너지', 
        description: '밴드 중심의 기본 록 에너지', 
        descriptionKo: '디스토션 기타의 거친 배음과 라이브 드럼의 강력한 펀치감이 살아있는 에너제틱한 질감입니다.',
        style: 'modern rock foundation, band energy',
        sound: 'guitar drive',
        mood: 'direct emotional lift'
      },
      { 
        id: 'classic-rock', 
        label: 'Classic Rock Texture', 
        labelKo: '클래식 록 질감', 
        description: '전통적인 클래식 록 감성', 
        descriptionKo: '진공관 앰프의 자연스러운 오버드라이브와 빈티지한 밴드 앙상블이 조화로운 사운드입니다.',
        style: 'classic rock character, timeless anthem flow',
        sound: 'sturdy riffs, live-band punch',
        mood: 'energetic, classic'
      },
      { 
        id: 'modern-rock', 
        label: 'Modern Rock Sound', 
        labelKo: '모던 록 사운드', 
        description: '현대적인 록 프로덕션', 
        descriptionKo: '정교하게 다듬어진 기타 톤과 넓은 스테레오 이미지를 가진 깔끔하고 강력한 록 사운드입니다.',
        style: 'modern rock production, wider choruses',
        sound: 'cleaner impact, current radio-ready force',
        mood: 'powerful, polished'
      },
    ],
  },
  {
    id: 'jazz-family',
    title: 'Jazz',
    titleKo: '재즈풍의',
    variants: [
      { 
        id: 'jazz', 
        label: 'Jazz Harmony', 
        labelKo: '재즈 화성', 
        description: '재즈 화성과 유연한 흐름', 
        descriptionKo: '복잡한 화성적 텐션과 악기 간의 유기적인 인터플레이가 돋보이는 지적이고 세련된 질감입니다.',
        style: 'jazz-influenced harmony, fluid phrasing',
        sound: 'refined rhythmic sophistication',
        mood: 'sophisticated, smooth'
      },
      { 
        id: 'classic-jazz', 
        label: 'Classic Jazz', 
        labelKo: '클래식 재즈 선율', 
        description: '전통 재즈 기반의 감각', 
        descriptionKo: '어쿠스틱 악기 본연의 울림과 스윙 리듬의 유연한 흐름이 강조된 클래식한 사운드입니다.',
        style: 'classic jazz sensibility, elegant chord language',
        sound: 'live interplay, swing-aware detail',
        mood: 'timeless, elegant'
      },
      { 
        id: 'jazzhop-style', 
        label: 'Jazzhop Beat', 
        labelKo: '재즈힙합 비트', 
        description: '재즈와 힙합의 결합', 
        descriptionKo: '재즈의 따뜻한 샘플링 질감과 힙합의 묵직한 비트가 결합된 칠(Chill)한 감성의 사운드입니다.',
        style: 'jazzhop blend, mellow groove',
        sound: 'dusty rhythm feel',
        mood: 'jazzy melodic color, chill'
      },
    ],
  },
  {
    id: 'hiphop-family',
    title: 'Hip-Hop',
    titleKo: '힙합 비트',
    variants: [
      { 
        id: 'hip-hop', 
        label: 'Hip-Hop Edge', 
        labelKo: '힙합 엣지', 
        description: '비트 중심의 기본 힙합 결', 
        descriptionKo: '선명한 스네어 어택과 도시적인 긴장감이 느껴지는 날카롭고 리드미컬한 소리 질감입니다.',
        style: 'hip-hop attitude, beat-led motion',
        sound: 'rhythmic vocal emphasis',
        mood: 'urban edge, confident'
      },
      { 
        id: 'boom-bap-style', 
        label: 'Boom Bap Texture', 
        labelKo: '붐뱁 질감', 
        description: '클래식 붐뱁 질감', 
        descriptionKo: '거친 질감의 드럼 샘플과 묵직한 킥이 주도하는 클래식하고 투박한 힙합 사운드입니다.',
        style: 'boom bap rhythm, head-nod groove',
        sound: 'classic drum knock, sample-minded movement',
        mood: 'raw, classic'
      },
      { 
        id: 'trap-style', 
        label: 'Trap Beat', 
        labelKo: '트랩 비트', 
        description: '현대 트랩 중심의 강한 리듬감', 
        descriptionKo: '빠른 하이햇 롤과 깊은 서브 베이스의 대비가 돋보이는 강력하고 어두운 트랩 질감입니다.',
        style: 'trap energy, modern street-level intensity',
        sound: 'heavy low-end, crisp hats',
        mood: 'aggressive, dark'
      },
      { 
        id: 'lofi-hip-hop-style', 
        label: 'Lo-fi Texture', 
        labelKo: '로파이 질감', 
        description: '로파이 힙합의 부드러운 빈티지 감성', 
        descriptionKo: '아날로그 특유의 따뜻하고 먼지 낀 듯한 빈티지 사운드와 편안한 공간감을 제공합니다.',
        style: 'lo-fi hip-hop mood, relaxed groove',
        sound: 'soft beat texture, warm dust',
        mood: 'chill, nostalgic'
      },
    ],
  },
  {
    id: 'electronic-family',
    title: 'Electronic',
    titleKo: '전자적 질감',
    variants: [
      { 
        id: 'electronic', 
        label: 'Electronic Texture', 
        labelKo: '일렉트로닉 텍스처', 
        description: '전자 사운드 중심의 기본 일렉트로닉 스타일', 
        descriptionKo: '정교하게 설계된 신디사이저 레이어와 디지털적인 선명함이 돋보이는 전자적 질감입니다.',
        style: 'electronic production focus, precise rhythmic architecture',
        sound: 'sculpted synth texture',
        mood: 'digital, clean'
      },
      { 
        id: 'techno-style', 
        label: 'Techno Pulse', 
        labelKo: '테크노 펄스', 
        description: '반복적 몰입감이 강한 테크노 감성', 
        descriptionKo: '반복적인 리듬 패턴과 미니멀한 사운드 디자인이 만들어내는 최면적인 전자음 질감입니다.',
        style: 'techno pulse, hypnotic repetition',
        sound: 'controlled tension',
        mood: 'club-focused momentum, dark'
      },
      { 
        id: 'house-style', 
        label: 'House Groove', 
        labelKo: '하우스 그루브', 
        description: '하우스 특유의 4/4 그루브', 
        descriptionKo: '일정한 4/4 박자의 킥과 세련된 피아노/신스 라인이 조화로운 댄서블한 질감입니다.',
        style: 'house groove, four-on-the-floor rhythm',
        sound: 'dancefloor clarity',
        mood: 'smooth lift, energetic'
      },
    ],
  },
  {
    id: 'texture-rhythm',
    title: 'Groove & Impact',
    titleKo: '그루브 & 타격감',
    variants: [
      { 
        id: 'funky-bounce', 
        label: 'Funky Bounce', 
        labelKo: '펑키한 탄력', 
        description: '통통 튀는 베이스 라인과 리드미컬한 그루브',
        descriptionKo: '통통 튀는 베이스 라인과 리드미컬한 악기 배열로 경쾌한 탄성감을 줍니다.',
        style: 'syncopated rhythmic bounce',
        sound: 'elastic bass groove, upbeat percussive snap',
        mood: 'funky, energetic'
      },
      { 
        id: 'heavy-lowend', 
        label: 'Heavy Impact', 
        labelKo: '묵직한 타격감', 
        description: '웅장한 서브 베이스와 묵직한 타격음',
        descriptionKo: '웅장한 서브 베이스와 가슴을 울리는 단단하고 묵직한 타격음을 강조합니다.',
        style: 'high-impact sonic weight',
        sound: 'powerful sub-bass presence, heavy thumping kicks',
        mood: 'heavy, powerful'
      },
    ],
  },
  {
    id: 'OST-family',
    title: 'OST & BGM',
    titleKo: '주제가 질감',
    variants: [
      { 
        id: 'anime-style', 
        label: 'Anime Style', 
        labelKo: '애니메이션 감성', 
        description: '애니메이션 OST 같은 상승감과 드라마', 
        descriptionKo: '드라마틱한 곡 전개와 화려한 오케스트레이션이 어우러진 서사적이고 밝은 질감입니다.',
        style: 'anime-style melodic drama, vivid progression',
        sound: 'soaring payoff',
        mood: 'emotional lift, bright'
      },
      { 
        id: 'game-bgm-style', 
        label: 'Game BGM Texture', 
        labelKo: '게임 BGM 질감', 
        description: '게임 BGM 같은 장면감과 몰입감', 
        descriptionKo: '장면의 몰입감을 극대화하는 선명한 멜로디와 테마 중심의 입체적인 사운드입니다.',
        style: 'game-BGM flavor, scene-driven pacing',
        sound: 'vivid motif focus',
        mood: 'immersive motion, adventurous'
      },
      { id: 'Magical-bgm', 
      label: 'BGM style', 
      labelKo: '마법같은 감성', 
      description: '마법요정 같은 몽환적 질감', 
      style: 'fairy-tale vibe, polished production',
      sound: 'airy textures, soft pads',
      mood: 'magical, high-fidelity' },
    ],
  },
    {
    id: 'global-family',
    title: 'Global pop style',
    titleKo: '글로벌 팝 스타일',
    variants: [
      { 
        id: 'global-pop-style', 
        label: 'Global Style', 
        labelKo: '글로벌 팝 감각', 
        description: '국가를 넘나드는 글로벌 팝 감각', 
        descriptionKo: '세련된 팝 프로덕션과 전 세계적인 트렌드가 반영된 깔끔하고 대중적인 질감입니다.',
        style: 'global pop approach, broad mainstream appeal',
        sound: 'clean hooks, international polish',
        mood: 'modern, catchy'
      },
      { 
        id: 'k-style', 
        label: 'K-Style Polish', 
        labelKo: 'K-팝 세련미', 
        description: 'K-Pop 감성의 세련된 전개', 
        descriptionKo: '정교한 트랙 메이킹과 중독성 있는 훅이 돋보이는 화려하고 세련된 K-팝 질감입니다.',
        style: 'K-style polish, sleek Korean pop sensibility',
        sound: 'sharp sections, addictive hooks',
        mood: 'vibrant, polished'
      },
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
      { 
        id: 'band', 
        label: 'Band', 
        labelKo: '밴드', 
        description: '드럼, 베이스, 기타, 건반이 함께 어우러지는 기본 밴드 구성입니다. 가장 균형 잡힌 라이브 합주 감각을 만들며, 장르에 따라 안정적인 중심 사운드를 형성합니다.', 
        promptCore: 'Live band, drums, bass, guitar, keys.' 
      },
      { 
        id: 'pop-band', 
        label: 'Pop Band', 
        labelKo: '팝 밴드', 
        description: '깔끔하고 대중적인 팝 밴드 구성입니다. 부담 없이 듣기 좋은 균형 잡힌 악기 배치와 세련된 리듬감으로 현대적인 팝 사운드에 잘 어울립니다.', 
        promptCore: 'Clean pop ensemble.' 
      },
      { 
        id: 'funk-band', 
        label: 'Funk Band', 
        labelKo: '펑크 밴드', 
        description: '리듬감과 그루브가 살아 있는 밴드 구성입니다. 베이스와 기타의 타이트한 리듬이 중심이 되며, 몸을 타는 듯한 탄력 있는 사운드를 만듭니다.', 
        promptCore: 'Tight funk rhythm, groove.' 
      },
      { 
        id: 'rock-band', 
        label: 'Rock Band', 
        labelKo: '록 밴드', 
        description: '일렉 기타와 드럼의 존재감이 강한 밴드 사운드입니다. 에너지와 추진력이 뚜렷하며, 강한 전개와 라이브한 질감을 원하는 곡에 적합합니다.', 
        promptCore: 'Energetic rock, electric guitar.' 
      },
      { 
        id: 'jazz-band', 
        label: 'Jazz Band', 
        labelKo: '재즈 밴드', 
        description: '악기 간의 유기적인 호흡과 여유로운 연주감이 중심인 재즈 밴드 구성입니다. 섬세한 인터플레이와 부드러운 그루브를 강조할 때 적합합니다.', 
        promptCore: 'Jazz ensemble, interaction.' 
      },
    ],
  },
  {
    id: 'bass-family',
    title: 'Bass',
    titleKo: '베이스',
    variants: [
      { 
        id: 'bass', 
        label: 'Bass', 
        labelKo: '베이스', 
        description: '곡의 저음을 받쳐주는 기본 베이스입니다. 전체 사운드의 중심과 안정감을 만들어주며, 리듬과 화성을 자연스럽게 연결합니다.', 
        promptCore: 'Bass foundation, pulse.' 
      },
      { 
        id: '808-bass', 
        label: '808 Bass', 
        labelKo: '808 베이스', 
        description: '강한 저음 압력과 묵직한 존재감이 특징인 베이스입니다. 힙합, 트랩, 강한 전자음악에서 바닥을 울리는 듯한 저역 에너지를 만들 때 적합합니다.', 
        promptCore: '808 sub, low-end pressure.' 
      },
      { 
        id: 'smooth-bass', 
        label: 'Smooth Bass', 
        labelKo: '스무스 베이스', 
        description: '부드럽고 둥근 톤의 베이스입니다. 지나치게 튀지 않으면서도 곡의 흐름을 매끄럽게 이어주며, 감성적이거나 안정적인 사운드에 잘 어울립니다.', 
        promptCore: 'Smooth bass, rounded tone.' 
      },
      { 
        id: 'funky-bassline', 
        label: 'Funky Bassline', 
        labelKo: '펑키 베이스라인', 
        description: '리듬감이 강하고 움직임이 느껴지는 베이스라인입니다. 그루브 중심의 곡에서 탄력 있고 리드미컬한 에너지를 만들어냅니다.', 
        promptCore: 'Funky bass, rhythmic groove.' 
      },
      { 
        id: 'sharp-synth-bass', 
        label: 'Sharp Synth Bass', 
        labelKo: '샤프 신스 베이스', 
        description: '어택감이 분명하고 선명하게 치고 나오는 신스 베이스입니다. 팝, 댄스, 전자 계열에서 날카롭고 현대적인 저역 캐릭터를 줄 때 적합합니다.', 
        promptCore: 'Sharp synth bass, sharp attack.' 
      },
    ],
  },
  {
    id: 'drums-family',
    title: 'Drums',
    titleKo: '드럼',
    variants: [
      { 
        id: 'drums', 
        label: 'Drums', 
        labelKo: '드럼', 
        description: '곡의 기본 박자와 에너지를 만드는 중심 리듬 악기입니다. 전체 템포감과 추진력을 안정적으로 잡아주는 가장 기본적인 드럼 선택입니다.', 
        promptCore: 'Steady drum, groove.' 
      },
      { 
        id: 'brushed-drums', 
        label: 'Brushed drums', 
        labelKo: '브러시 드럼', 
        description: '브러시로 부드럽게 긁어내듯 연주되는 드럼입니다. 재즈, 발라드, 잔잔한 곡에서 섬세하고 따뜻한 리듬감을 만들 때 잘 어울립니다.', 
        promptCore: 'Brushed drums, soft feel.' 
      },
      { 
        id: 'double-time', 
        label: 'Double-time', 
        labelKo: '더블 타임', 
        description: '체감 속도를 빠르게 느끼게 하는 리듬 패턴입니다. 곡에 긴장감과 몰아치는 에너지를 더하고 싶을 때 효과적입니다.', 
        promptCore: 'Fast double-time, momentum.' 
      },
      { 
        id: 'half-time', 
        label: 'Half-time', 
        labelKo: '하프 타임', 
        description: '체감 속도를 절반처럼 느끼게 하는 느리고 묵직한 리듬입니다. 무게감, 공간감, 여유 있는 그루브를 강조할 때 적합합니다.', 
        promptCore: 'Heavy half-time, deep space.' 
      },
      { 
        id: 'driving-rhythm', 
        label: 'Driving rhythm', 
        labelKo: '드라이빙 리듬', 
        description: '앞으로 밀고 나가는 추진력이 강한 드럼 패턴입니다. 에너지와 속도감을 살리고 싶을 때 매우 효과적인 선택입니다.', 
        promptCore: 'Driving rhythm, energetic pulse.' 
      },
    ],
  },
  {
    id: 'pad-family',
    title: 'Pad',
    titleKo: '패드',
    variants: [
      { 
        id: 'pad', 
        label: 'Pad', 
        labelKo: '패드', 
        description: '곡의 배경을 부드럽게 채워주는 기본 패드입니다. 전면에 튀기보다 뒤에서 공간감과 안정감을 형성하는 역할을 합니다.', 
        promptCore: 'Supportive pad, atmosphere.' 
      },
      { 
        id: 'glassy-pad', 
        label: 'Glassy Pad', 
        labelKo: '글래시 패드', 
        description: '맑고 반짝이는 질감의 패드입니다. 공기감 있고 투명한 분위기를 만들며, 선명하고 깨끗한 감성에 잘 어울립니다.', 
        promptCore: 'Glassy pad, airy shimmer.' 
      },
      { 
        id: 'warm-pad', 
        label: 'Warm Pad', 
        labelKo: '웜 패드', 
        description: '포근하고 따뜻한 배경을 만들어주는 패드입니다. 차갑지 않은 감성적 분위기, 부드럽고 안정적인 곡 전개에 적합합니다.', 
        promptCore: 'Warm pad, soft body.' 
      },
      { 
        id: 'ethereal-pad', 
        label: 'Ethereal Pad', 
        labelKo: '에테리얼 패드', 
        description: '몽환적이고 떠다니는 듯한 분위기를 만드는 패드입니다. 현실감이 흐려지는 듯한 부유감과 신비로운 감성을 강조합니다.', 
        promptCore: 'Ethereal bloom, dreamlike.' 
      },
      { 
        id: 'deep-pad', 
        label: 'Deep Pad', 
        labelKo: '딥 패드', 
        description: '깊고 어두운 배경층을 형성하는 패드입니다. 무게감 있고 차분한 분위기, 어두운 감정선이나 영화적인 공간감에 잘 어울립니다.', 
        promptCore: 'Deep pad, dark ambience.' 
      },
    ],
  },
  {
    id: 'synths-family',
    title: 'Synths',
    titleKo: '신스',
    variants: [
      { 
        id: 'synths', 
        label: 'Synths', 
        labelKo: '신스', 
        description: '현대적인 음악의 핵심이 되는 기본 신스입니다. 멜로디, 배경, 훅 등 다양한 역할을 담당하며 전자적인 색채를 자연스럽게 더합니다.', 
        promptCore: 'Modern synth, melodic.' 
      },
      { 
        id: 'bright-synth', 
        label: 'Bright Synth', 
        labelKo: '브라이트 신스', 
        description: '밝고 선명하며 캐치한 존재감을 가진 신스입니다. 팝, 댄스, 경쾌한 곡에서 귀에 잘 꽂히는 멜로디와 화사한 분위기를 만듭니다.', 
        promptCore: 'Bright synth, catchy.' 
      },
      { 
        id: 'dreamy-synth', 
        label: 'Dreamy Synth', 
        labelKo: '드리미 신스', 
        description: '부드럽고 몽글몽글한 감정을 만드는 신스입니다. 몽환적이고 감성적인 곡, 밤이나 추억 같은 이미지에 잘 어울립니다.', 
        promptCore: 'Dreamy synth, floating.' 
      },
      { 
        id: 'dark-synth', 
        label: 'Dark Synth', 
        labelKo: '다크 신스', 
        description: '어둡고 무디한 분위기를 만드는 신스입니다. 긴장감, 차가움, 깊은 감정선이 필요한 곡에서 효과적으로 사용됩니다.', 
        promptCore: 'Dark synth, moody.' 
      },
      { 
        id: 'deep-synth', 
        label: 'Deep Synth', 
        labelKo: '딥 신스', 
        description: '무게감 있고 깊게 가라앉는 질감의 신스입니다. 풍성한 저중역대와 깊은 공간감을 통해 곡의 밀도를 높여줍니다.', 
        promptCore: 'Deep synth, rich weight.' 
      },
    ],
  },
  {
    id: 'snare-family',
    title: 'Snare',
    titleKo: '스네어',
    variants: [
      { 
        id: 'snare', 
        label: 'Snare', 
        labelKo: '스네어', 
        description: '비트의 중심을 잡아주는 기본 스네어입니다. 곡의 리듬감을 또렷하게 만들어주며, 박자감을 선명하게 전달합니다.', 
        promptCore: 'Clear snare, backbeat.' 
      },
      { 
        id: 'sharp-snare', 
        label: 'Sharp snare', 
        labelKo: '샤프 스네어', 
        description: '날카롭고 선명하게 튀는 타격감을 가진 스네어입니다. 비트의 어택을 강조하고 리듬의 윤곽을 또렷하게 만들고 싶을 때 적합합니다.', 
        promptCore: 'Sharp snare, precise crack.' 
      },
      { 
        id: 'warm-snare', 
        label: 'Warm snare', 
        labelKo: '웜 스네어', 
        description: '부드럽고 둥근 질감을 가진 스네어입니다. 너무 공격적이지 않으면서도 자연스럽게 리듬을 받쳐주는 따뜻한 느낌을 줍니다.', 
        promptCore: 'Warm snare, rounded.' 
      },
      { 
        id: 'hard-hitting-snare', 
        label: 'Hard-hitting snare', 
        labelKo: '하드 히팅 스네어', 
        description: '강하게 꽂히는 파워풀한 스네어입니다. 에너지, 존재감, 박력 있는 비트를 강조하고 싶을 때 적합합니다.', 
        promptCore: 'Punchy snare, bold attack.' 
      },
      { 
        id: 'big-reverb-snare', 
        label: 'Big reverb snare', 
        labelKo: '빅 리버브 스네어', 
        description: '넓은 공간에서 울리는 듯한 리버브가 강조된 스네어입니다. 시원하고 웅장한 공간감, 드라마틱한 타격감을 만들 때 효과적입니다.', 
        promptCore: 'Reverb snare, wide tail.' 
      },
    ],
  },
  {
    id: 'hihats-family',
    title: 'Hi-hats',
    titleKo: '하이햇',
    variants: [
      { 
        id: 'hi-hats', 
        label: 'Hi-hats', 
        labelKo: '하이햇', 
        description: '곡의 세밀한 리듬과 흐름을 조절하는 기본 하이햇입니다. 전체 박자의 질감을 정리하고 리듬의 움직임을 자연스럽게 만들어줍니다.', 
        promptCore: 'Steady hi-hat, rhythm.' 
      },
      { 
        id: 'crisp-hi-hats', 
        label: 'Crisp hi-hats', 
        labelKo: '크리스프 하이햇', 
        description: '선명하고 또렷한 질감의 하이햇입니다. 리듬의 디테일을 명확하게 드러내고 전체 사운드를 더 깨끗하게 느끼게 합니다.', 
        promptCore: 'Crisp hi-hats, sparkle.' 
      },
      { 
        id: 'soft-hi-hats', 
        label: 'Soft hi-hats', 
        labelKo: '소프트 하이햇', 
        description: '부드럽고 가벼운 질감의 하이햇입니다. 리듬을 과하게 밀지 않고 자연스럽고 편안한 흐름을 만들 때 적합합니다.', 
        promptCore: 'Soft hi-hats, light.' 
      },
      { 
        id: 'fast-triplet-hi-hats', 
        label: 'Fast triplet hi-hats', 
        labelKo: '패스트 하이햇', 
        description: '빠르고 촘촘한 움직임으로 긴장감과 속도감을 주는 하이햇입니다. 트랩, 힙합, 강한 전자음악에서 에너지를 끌어올릴 때 효과적입니다.', 
        promptCore: 'Triplet hi-hats, tension.' 
      },
      { 
        id: 'distanced-hi-hats', 
        label: 'Distanced hi-hats', 
        labelKo: '디스턴스 하이햇', 
        description: '멀리서 들리는 듯한 공간감이 있는 하이햇입니다. 직접적인 타격감보다 분위기와 거리감을 강조할 때 잘 어울립니다.', 
        promptCore: 'Distanced hi-hats, atmospheric.' 
      },
    ],
  },
  {
    id: 'guitar-family',
    title: 'Guitar',
    titleKo: '기타',
    variants: [
      { 
        id: 'guitar', 
        label: 'Guitar', 
        labelKo: '기타', 
        description: '곡의 리듬과 분위기를 동시에 잡아주는 기본 기타입니다. 장르에 따라 담백한 반주부터 존재감 있는 리프까지 폭넓게 활용됩니다.', 
        promptCore: 'Guitar, rhythmic texture.' 
      },
      { 
        id: 'acoustic', 
        label: 'Acoustic', 
        labelKo: '어쿠스틱', 
        description: '자연스럽고 따뜻한 울림을 가진 기타입니다. 감성적이고 친밀한 분위기, 포크나 발라드 같은 곡에 잘 어울립니다.', 
        promptCore: 'Acoustic guitar, natural.' 
      },
      { 
        id: 'electric', 
        label: 'Electric', 
        labelKo: '일렉트릭', 
        description: '선명한 존재감과 리듬감을 더해주는 기타입니다. 팝, 록, 시티팝 등에서 에너지와 캐릭터를 만들어주는 핵심 악기입니다.', 
        promptCore: 'Electric guitar, rhythmic.' 
      },
      { 
        id: 'overdriven', 
        label: 'Overdriven', 
        labelKo: '오버드라이브', 
        description: '적당히 거칠고 밀도 있는 드라이브 톤의 기타입니다. 록적인 에너지, 감정의 강도, 거친 질감을 추가하고 싶을 때 적합합니다.', 
        promptCore: 'Gritty guitar, grit.' 
      },
      { 
        id: 'ambient-electric', 
        label: 'Ambient Electric', 
        labelKo: '앰비언트 기타', 
        description: '공간감과 여운이 강조된 전기 기타입니다. 직접적인 리프보다는 넓은 배경과 감성적인 잔향을 만드는 데 적합합니다.', 
        promptCore: 'Ambient guitar, spacious.' 
      },
    ],
  },
  {
    id: 'trumpet-family',
    title: 'Trumpet',
    titleKo: '트럼펫',
    variants: [
      { 
        id: 'trumpet', 
        label: 'Trumpet', 
        labelKo: '트럼펫', 
        description: '밝고 강한 존재감을 가진 기본 트럼펫입니다. 멜로디를 돋보이게 하거나 브라스 특유의 화려한 인상을 줄 때 효과적입니다.', 
        promptCore: 'Trumpet, brass accent.' 
      },
      { 
        id: 'bright-trumpet', 
        label: 'Bright Trumpet', 
        labelKo: '브라이트 트럼펫', 
        description: '더 밝고 화사한 톤의 트럼펫입니다. 힘차고 시원한 인상을 만들며, 곡에 생동감과 활력을 더해줍니다.', 
        promptCore: 'Bright trumpet, vivid.' 
      },
      { 
        id: 'muted-trumpet', 
        label: 'Muted Trumpet', 
        labelKo: '뮤트 트럼펫', 
        description: '부드럽고 절제된 톤의 트럼펫입니다. 날카로운 존재감보다 섬세하고 재즈적인 감성, 조용한 분위기를 만들 때 적합합니다.', 
        promptCore: 'Muted trumpet, intimate.' 
      },
      { 
        id: 'soft-trumpet-solo', 
        label: 'Soft Trumpet solo', 
        labelKo: '트럼펫 솔로', 
        description: '부드럽고 우아하게 선율을 이끄는 트럼펫 솔로입니다. 과하지 않으면서도 감정선을 섬세하게 끌어올릴 때 좋습니다.', 
        promptCore: 'Soft trumpet, elegance.' 
      },
      { 
        id: 'funky-trumpet-hits', 
        label: 'Funky Trumpet hits', 
        labelKo: '펑키 트럼펫', 
        description: '짧고 경쾌하게 치고 들어오는 브라스 히트입니다. 펑크, 디스코, 그루브 중심 곡에서 리듬감을 강조할 때 효과적입니다.', 
        promptCore: 'Funk trumpet, brass hits.' 
      },
    ],
  },
  {
    id: 'heritage-plucks-family',
    title: 'Gayageum',
    titleKo: '가야금',
    variants: [
      { 
        id: 'gayageum', 
        label: 'Gayageum', 
        labelKo: '가야금', 
        description: '맑고 섬세하게 튕기는 울림이 특징인 한국 전통 현악기입니다. 동양적인 정서와 우아한 결을 곡에 더할 수 있습니다.', 
        promptCore: 'Gayageum, Korean pluck.' 
      },
      { 
        id: 'haegeum', 
        label: 'Haegeum', 
        labelKo: '해금', 
        description: '감정선이 짙고 사람 목소리처럼 울리는 한국 전통 찰현악기입니다. 애절하고 서정적인 분위기를 강조할 때 잘 어울립니다.', 
        promptCore: 'Haegeum, Korean bowed.' 
      },
      { 
        id: 'kalimba-pluck', 
        label: 'Kalimba pluck', 
        labelKo: '칼림바', 
        description: '맑고 귀여운 울림이 특징인 플럭 악기입니다. 아기자기하고 순수한 분위기, 반짝이는 감성을 만들 때 적합합니다.', 
        promptCore: 'Kalimba, clean pluck.' 
      },
    ],
  },
  {
    id: 'strings-family',
    title: 'Strings',
    titleKo: '스트링',
    variants: [
      { 
        id: 'strings', 
        label: 'Strings', 
        labelKo: '스트링', 
        description: '곡의 감정선과 서사를 풍성하게 채워주는 기본 스트링입니다. 부드럽고 넓은 울림으로 몰입감과 깊이를 더해줍니다.', 
        promptCore: 'Warm strings, contour.' 
      },
      { 
        id: 'full-orchestral-strings', 
        label: 'Full Orchestral Strings', 
        labelKo: '오케스트라', 
        description: '웅장하고 영화적인 스케일을 가진 오케스트라 스트링입니다. 클라이맥스, 감정 폭발, 서사적인 장면 연출에 매우 효과적입니다.', 
        promptCore: 'Orchestral strings, breadth.' 
      },
      { 
        id: 'soft-legato-strings', 
        label: 'Soft legato strings', 
        labelKo: '레가토 스트링', 
        description: '부드럽게 이어지는 선율 중심의 스트링입니다. 자연스럽고 감성적인 흐름을 만들며 발라드나 서정적인 곡에 잘 어울립니다.', 
        promptCore: 'Legato strings, warmth.' 
      },
      { 
        id: 'pizzicato-strings', 
        label: 'Pizzicato strings', 
        labelKo: '피치카토', 
        description: '현을 퉁기듯 연주하는 경쾌한 스트링입니다. 귀엽고 리듬감 있는 분위기, 가벼운 긴장감이나 장난스러운 느낌을 줄 때 적합합니다.', 
        promptCore: 'Pizzicato strings, plucked.' 
      },
      { 
        id: 'staccato-strings', 
        label: 'Staccato strings', 
        labelKo: '스타카토', 
        description: '짧고 또렷하게 끊어지는 스트링입니다. 리듬감, 긴장감, 명확한 악센트를 주고 싶을 때 효과적입니다.', 
        promptCore: 'Staccato strings, precision.' 
      },
    ],
  },
  {
    id: 'texture-family',
    title: 'Minimalist texture',
    titleKo: '미니멀 텍스쳐',
    variants: [
      { 
        id: 'minimalist-texture', 
        label: 'Minimalist texture', 
        labelKo: '미니멀 텍스쳐', 
        description: '불필요한 요소를 줄이고 여백을 살리는 질감입니다. 단순하지만 집중도 높은 사운드를 만들고 싶을 때 적합합니다.', 
        promptCore: 'Minimal texture, space.' 
      },
      { 
        id: 'rich-texture', 
        label: 'Rich texture', 
        labelKo: '리치 텍스쳐', 
        description: '레이어가 풍성하게 쌓인 밀도 높은 질감입니다. 공간을 가득 채우는 풍부한 사운드와 존재감을 만들고 싶을 때 좋습니다.', 
        promptCore: 'Rich texture, layered.' 
      },
      { 
        id: 'evolving-texture', 
        label: 'Evolving texture', 
        labelKo: '이볼빙 텍스쳐', 
        description: '시간이 흐르면서 미세하게 변화하는 질감입니다. 정적인 곡에도 움직임과 생명감을 부여할 수 있습니다.', 
        promptCore: 'Evolving texture, shifts.' 
      },
      { 
        id: 'granular-texture', 
        label: 'Granular texture', 
        labelKo: '그래뉼러 텍스쳐', 
        description: '잘게 부서진 입자감과 디테일이 느껴지는 질감입니다. 실험적이거나 섬세한 소리 결을 강조하고 싶을 때 적합합니다.', 
        promptCore: 'Granular texture, detail.' 
      },
    ],
  },
  {
    id: 'Magic-family',
    title: 'Magic textures',
    titleKo: '마법 사운드',
    variants: [
      { 
        id: 'star_candy_sound', 
        label: 'Star Candy Sound', 
        labelKo: '별사탕 사운드', 
        description: '반짝이는 플럭과 부드러운 패드가 어우러진 판타지 계열 사운드입니다. 동화적이고 꿈같은 분위기, 귀엽고 마법 같은 감성을 표현할 때 적합합니다.', 
        promptCore: 'shimmering synth pluck melodies reminiscent of star candy, soft pads, gentle synthesizer, minimal instrumentation' 
      },
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
  { 
    id: 'chill', label: 'Chill', labelKo: '편안한', 
    description: '긴장을 풀고 자연스럽게 흘러가는 편안한 무드와 질감을 만듭니다.', 
    mood: 'Relaxed, gentle flow', 
    arrangement: 'smooth, effortless progression' 
  },
  { 
    id: 'calm', label: 'Calm', labelKo: '차분한', 
    description: '잔잔하고 정돈된 감정선으로 고요한 무드와 텍스처를 형성합니다.', 
    mood: 'Settled, quiet depth', 
    arrangement: 'minimal movement, subtle shifts' 
  },
  { 
    id: 'peaceful', label: 'Peaceful', labelKo: '평화로운', 
    description: '안정감 있고 평온하게 퍼지는 분위기로 부드러운 무드감을 만듭니다.', 
    mood: 'Soft layers, calm vibe', 
    arrangement: 'stable structure, gentle transitions' 
  },
  { 
    id: 'relaxing', label: 'Relaxing', labelKo: '릴렉스', 
    description: '부담 없이 이완되는 흐름으로 편히 머물 수 있는 무드와 질감을 더합니다.', 
    mood: 'Effortless, soothing sonic', 
    arrangement: 'seamless, relaxed pacing' 
  },
  { 
    id: 'zen', label: 'Zen', labelKo: '정적인', 
    description: '비움과 정적이 느껴지는 절제된 분위기로 맑고 고요한 질감을 만듭니다.', 
    mood: 'Spacious, meditative stillness', 
    arrangement: 'minimalist, significant space' 
  },
  { 
    id: 'tense', label: 'Tense', labelKo: '긴장된', 
    description: '서서히 조여오는 긴장감으로 날카롭고 불안정한 무드감을 형성합니다.', 
    mood: 'Sharp, anxious, high-tension', 
    arrangement: 'tight pacing, sudden shifts' 
  },
  { 
    id: 'cheerful', label: 'Cheerful', labelKo: '쾌활한', 
    description: '밝고 경쾌하게 튀어 오르는 에너지로 생기 있는 무드를 만듭니다.', 
    mood: 'Bouncy, playful energy', 
    arrangement: 'energetic flow, lively accents' 
  },
  { 
    id: 'bright', label: 'Bright', labelKo: '밝은', 
    description: '환하게 열리는 인상으로 선명하고 가벼운 분위기를 형성합니다.', 
    mood: 'Clear, airy, luminous', 
    arrangement: 'uplifting, forward structure' 
  },
  { 
    id: 'dark', label: 'Dark', labelKo: '어두운', 
    description: '묵직하고 짙게 가라앉는 분위기로 어둡고 깊은 무드를 만듭니다.', 
    mood: 'Heavy, somber, shadows', 
    arrangement: 'slow-drag, weighted sections' 
  },
  { 
    id: 'hopeful', label: 'Hopeful', labelKo: '희망찬', 
    description: '앞으로 나아가는 기대감이 느껴지는 밝고 상승감 있는 무드를 형성합니다.', 
    mood: 'Rising shimmer, optimistic', 
    arrangement: 'gradual build, bright resolution' 
  },
  { 
    id: 'healing', label: 'Healing', labelKo: '치유되는', 
    description: '상처를 감싸듯 부드럽게 스며드는 분위기로 위로감 있는 무드를 만듭니다.', 
    mood: 'Warm, comforting, therapeutic', 
    arrangement: 'gentle flow, nurturing transitions' 
  },
  { 
    id: 'nostalgic', label: 'Nostalgic', labelKo: '향수적', 
    description: '지나간 시간의 기억을 떠올리게 하는 아련하고 따뜻한 무드를 더합니다.', 
    mood: 'Vintage, misty, faded', 
    arrangement: 'bittersweet pacing, longing feel' 
  },
  { 
    id: 'melancholic', label: 'Melancholic', labelKo: '우울한', 
    description: '쓸쓸하고 가라앉은 감정선을 중심으로 무게감 있는 분위기를 만듭니다.', 
    mood: 'Lonely, fragile, blue', 
    arrangement: 'slow flow, lingering notes' 
  },
  { 
    id: 'bittersweet', label: 'Bittersweet', labelKo: '달콤씁쓸', 
    description: '따뜻함과 쓸쓸함이 함께 남는 복합적인 무드와 질감을 형성합니다.', 
    mood: 'Complex, mixed colors', 
    arrangement: 'balanced, contrasting dynamics' 
  },
  { 
    id: 'loneliness', label: 'Loneliness', labelKo: '고독한', 
    description: '깊은 여백과 거리감이 느껴지는 분위기로 고독한 무드를 강조합니다.', 
    mood: 'Thin, isolated, cold', 
    arrangement: 'minimalist, sparse instruments' 
  },
  { 
    id: 'sad', label: 'Sad', labelKo: '슬픈', 
    description: '슬픔과 상실감이 또렷하게 느껴지는 감정 중심의 무드를 만듭니다.', 
    mood: 'Fragile mourning, heavy weight', 
    arrangement: 'slow, minimal ornaments' 
  },
  { 
    id: 'romantic', label: 'Romantic', labelKo: '낭만적', 
    description: '감미롭고 설레는 정서가 흐르는 분위기로 로맨틱한 무드를 만듭니다.', 
    mood: 'Lush, sweet, intimate', 
    arrangement: 'smooth flow, graceful builds' 
  },
  { 
    id: 'emotional', label: 'Emotional', labelKo: '감성적', 
    description: '섬세하고 진한 감정 표현이 살아나는 분위기로 몰입감 있는 무드를 형성합니다.', 
    mood: 'Rich, immersive, raw depth', 
    arrangement: 'dynamic build, expressive peaks' 
  },
  { 
    id: 'groovy', label: 'Groovy', labelKo: '그루비한', 
    description: '리듬의 탄력과 흐름이 살아 있는 질감으로 자연스럽게 몸을 타는 무드를 만듭니다.', 
    mood: 'Elastic, rhythmic, pocketed', 
    arrangement: 'groovy pocket, consistent drive' 
  },
  { 
    id: 'funky', label: 'Funky', labelKo: '펑키한', 
    description: '톡톡 튀는 리듬감과 개성 있는 질감으로 활기찬 분위기를 형성합니다.', 
    mood: 'Sharp, funky, rhythmic snap', 
    arrangement: 'syncopated, energetic drive' 
  },
  { 
    id: 'upbeat', label: 'Upbeat', labelKo: '업비트', 
    description: '경쾌하게 밀고 나가는 에너지로 가볍고 활발한 무드를 만듭니다.', 
    mood: 'Crisp, driving, high-energy', 
    arrangement: 'energetic pulse, forward momentum' 
  },
  { 
    id: 'powerful', label: 'Powerful', labelKo: '강력한', 
    description: '강한 추진력과 존재감으로 힘 있게 밀어붙이는 분위기를 만듭니다.', 
    mood: 'Bold, grand, massive', 
    arrangement: 'high-impact, strong emphasis' 
  },
  { 
    id: 'infectious', label: 'Infectious', labelKo: '중독성', 
    description: '한 번 들으면 귀에 맴도는 강한 인상으로 반복적인 몰입감을 형성합니다.', 
    mood: 'Catchy, repetitive, magnetic', 
    arrangement: 'infectious, memorable hooks' 
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
    id: 'minimalist', label: 'Minimalist', labelKo: '미니멀한', 
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
    id: 'warm', label: 'Warm', labelKo: '따뜻한', 
    description: '온기 있게 감싸는 질감으로 부드럽고 포근한 분위기를 만듭니다.', 
    mood: 'Soft, thick, cozy', 
    arrangement: 'warm structure, harmonic support' 
  },
  { 
    id: 'mellow', label: 'Mellow', labelKo: '부드러운', 
    description: '자극 없이 유연하게 흐르는 감촉으로 편안한 무드와 텍스처를 형성합니다.', 
    mood: 'Liquid, smooth, rounded', 
    arrangement: 'easy transitions, fluid movement' 
  },
  { 
    id: 'coziness', label: 'Coziness', labelKo: '아늑한', 
    description: '작고 포근한 공간에 머무는 듯한 따뜻하고 친밀한 분위기를 만듭니다.', 
    mood: 'Close-up, warm, intimate', 
    arrangement: 'small-space, close-mic feel' 
  },
  { 
    id: 'cinematic', label: 'Cinematic', labelKo: '시네마틱', 
    description: '장면이 그려지듯 입체적으로 펼쳐지는 무드와 스케일감을 더합니다.', 
    mood: 'Epic, grand, wide-screen', 
    arrangement: 'dynamic arc, narrative' 
  },
  { 
    id: 'atmospheric', label: 'Atmospheric', labelKo: '공간감', 
    description: '공기와 여운이 느껴지는 넓은 질감으로 공간감 있는 분위기를 형성합니다.', 
    mood: 'Airy, spacious, ethereal', 
    arrangement: 'vast reverb, open space' 
  },
  { 
    id: 'dreamy', label: 'Dreamy', labelKo: '몽환적', 
    description: '현실감이 흐려지듯 부유하는 감촉으로 몽환적인 무드를 만듭니다.', 
    mood: 'Floating, hazy, dreamlike', 
    arrangement: 'ethereal flow, blurred transitions' 
  },
  { 
    id: 'urban', label: 'Urban', labelKo: '도시적', 
    description: '차갑고 세련된 도시의 결을 담아 현대적 분위기를 형성합니다.', 
    mood: 'Sleek, urban, metropolitan', 
    arrangement: 'modern pulse, sharp transitions' 
  },
  { 
    id: 'moody', label: 'Moody', labelKo: '무디한', 
    description: '감정의 결이 짙게 배어 있는 분위기로 깊고 미묘한 무드를 만듭니다.', 
    mood: 'Thick, moody, shifting', 
    arrangement: 'shifting structure, emotive turns' 
  },
  { 
    id: 'Sorrowful', label: 'Sorrowful', labelKo: '비통한', 
    description: '가슴이 찢어질 듯한 슬픔과 비통한 분위기를 만듭니다.', 
    mood: 'Grieving, heartbreaking', 
    arrangement: 'no climaxes, mourning pace' 
  }, 
  { 
    id: 'rainy_ambience', label: 'Rainy ambience', labelKo: '비소리', 
    description: '잔잔히 내리는 비의 질감을 더해 촉촉하고 감성적인 분위기를 만듭니다.', 
    mood: 'Wet, rainy, reflective', 
    arrangement: 'reflective flow, rain-pacing' 
  },
  { 
    id: 'forest_ambience', label: 'Forest ambience', labelKo: '숲소리', 
    description: '자연의 숨결이 느껴지는 질감으로 맑고 편안한 분위기를 형성합니다.', 
    mood: 'Organic, breathing space', 
    arrangement: 'natural space, breathing' 
  },
  { 
    id: 'beach_ambience', label: 'Beach ambience', labelKo: '해변소리', 
    description: '파도와 바람이 스치는 질감으로 여유롭고 시원한 무드를 만듭니다.', 
    mood: 'Sandy, coastal resonance', 
    arrangement: 'wave-like flow, breezy' 
  }
];

export const THEMES: CategoryItem[] = [
  { id: 'love', label: 'Love', labelKo: '사랑', description: '사랑이 시작되거나 깊어지는 감정과 관계를 중심으로 한 이야기입니다.' },
  { id: 'crush', label: 'Crush', labelKo: '짝사랑', description: '혼자만 간직한 마음과 조심스러운 감정을 담은 이야기입니다.' },
  { id: 'encounter', label: 'Encounter', labelKo: '만남', description: '새로운 인연과 시작의 순간을 그리는 이야기입니다.' },
  { id: 'breakup', label: 'Breakup', labelKo: '이별', description: '이별의 순간과 그 이후 남겨진 감정을 중심으로 한 이야기입니다.' },
  { id: 'identity', label: 'Identity', labelKo: '자아', description: '자신을 돌아보고 정체성을 찾아가는 내면의 이야기입니다.' },
  { id: 'small_happiness', label: 'Small Happiness', labelKo: '소확행', description: '일상 속 작은 행복과 소소한 만족을 담은 이야기입니다.' },
  { id: 'weekend', label: 'Weekend', labelKo: '주말', description: '여유롭고 자유로운 주말의 순간을 그린 이야기입니다.' },
  { id: 'walk', label: 'Walk', labelKo: '산책', description: '가볍게 걸으며 떠오르는 생각과 감정을 담은 이야기입니다.' },
  { id: 'drive', label: 'Drive', labelKo: '드라이브', description: '이동하는 시간 속에서 느껴지는 감정과 풍경을 담습니다.' },
  { id: 'freedom', label: 'Freedom', labelKo: '자유', description: '속박에서 벗어나 자유를 느끼는 순간을 표현합니다.' },
  { id: 'hobby', label: 'Hobby', labelKo: '취미', description: '좋아하는 일을 하며 느끼는 즐거움과 몰입의 순간입니다.' },
  { id: 'city', label: 'City', labelKo: '도시', description: '도시 속 삶과 그 안에서의 감정과 장면을 담습니다.' },
  { id: 'cafe', label: 'Cafe', labelKo: '카페', description: '카페에서의 여유롭고 감성적인 순간을 그린 이야기입니다.' },
  { id: 'after_work', label: 'After Work', labelKo: '퇴근', description: '하루를 마치고 돌아가는 길에서 느껴지는 감정을 담습니다.' },
  { id: 'gift', label: 'Gift', labelKo: '선물', description: '주고받는 마음과 의미를 담은 따뜻한 이야기입니다.' },
  { id: 'alcohol', label: 'Alcohol', labelKo: '술', description: '술과 함께 풀어지는 감정과 솔직한 마음을 표현합니다.' },
  { id: 'longing', label: 'Longing', labelKo: '그리움', description: '보고 싶은 마음과 잊지 못하는 감정을 중심으로 합니다.' },
  { id: 'loneliness', label: 'Loneliness', labelKo: '외로움', description: '혼자 남겨진 듯한 감정과 공허함을 담습니다.' },
  { id: 'fear', label: 'Fear', labelKo: '두려움', description: '불확실함과 두려움 속에서의 감정을 표현합니다.' },
  { id: 'curiosity', label: 'Curiosity', labelKo: '호기심', description: '새로운 것에 대한 관심과 탐색의 순간을 담습니다.' },
  { id: 'regret', label: 'Regret', labelKo: '후회', description: '지나간 선택과 행동에 대한 아쉬움과 감정을 표현합니다.' },
  { id: 'reminiscence', label: 'Reminiscence', labelKo: '회상', description: '과거를 떠올리며 되짚는 기억의 흐름을 담습니다.' },
  { id: 'obsession', label: 'Obsession', labelKo: '집착', description: '강하게 매달리는 감정과 그로 인한 갈등을 표현합니다.' },
  { id: 'resistance', label: 'Resistance', labelKo: '저항', description: '무언가에 맞서 싸우는 의지와 감정을 담습니다.' },
  { id: 'anger', label: 'Anger', labelKo: '분노', description: '억눌린 감정이 터져 나오는 강렬한 순간을 표현합니다.' },
  { id: 'anxiety', label: 'Anxiety', labelKo: '불안', description: '미래에 대한 불안과 흔들리는 감정을 담습니다.' },
  { id: 'hope', label: 'Hope', labelKo: '희망', description: '앞으로 나아가려는 기대와 긍정적인 감정을 표현합니다.' },
  { id: 'fate', label: 'Fate', labelKo: '운명', description: '정해진 인연과 흐름 속에서의 이야기를 담습니다.' },
  { id: 'friendship', label: 'Friendship', labelKo: '우정', description: '친구와의 관계와 소중한 순간을 표현합니다.' },
  { id: 'travel', label: 'Travel', labelKo: '여행', description: '새로운 장소에서의 경험과 감정을 담습니다.' },
  { id: 'reunion', label: 'Reunion', labelKo: '재회', description: '다시 만나는 순간의 감정과 변화를 표현합니다.' },
  { id: 'comfort', label: 'Comfort', labelKo: '위로', description: '지친 마음을 달래고 위로하는 이야기를 담습니다.' },
  { id: 'night', label: 'Night', labelKo: '밤', description: '밤이라는 시간 속에서 일어나는 감정과 사건을 담습니다.' },
  { id: 'dawn', label: 'Dawn', labelKo: '새벽', description: '조용하고 고요한 새벽의 감정과 분위기를 표현합니다.' },
  { id: 'time', label: 'Time', labelKo: '시간', description: '흐르는 시간 속에서 변화하는 감정을 담습니다.' },
  { id: 'season', label: 'Season', labelKo: '계절', description: '계절의 변화와 그에 따른 감정의 흐름을 표현합니다.' },
  { id: 'rain', label: 'Rain', labelKo: '비', description: '비와 함께 떠오르는 감정과 분위기를 담습니다.' },
  { id: 'memory', label: 'Memory', labelKo: '추억', description: '지나간 기억과 그 속의 감정을 중심으로 합니다.' },
  { id: 'growth', label: 'Growth', labelKo: '성장', description: '변화하고 발전해가는 과정을 담은 이야기입니다.' },
  { id: 'safe_place', label: 'Safe Place', labelKo: '안식처', description: '편안하게 쉴 수 있는 공간과 마음을 표현합니다.' },
  { id: 'family', label: 'Family', labelKo: '가족', description: '가족과의 관계와 따뜻한 순간을 담습니다.' },
  { id: 'childhood', label: 'Childhood', labelKo: '어린시절', description: '어린 시절의 기억과 순수한 감정을 표현합니다.' },
  { id: 'youth', label: 'Youth', labelKo: '청춘', description: '청춘의 빛나는 순간과 고민을 담습니다.' },
  { id: 'hometown', label: 'Hometown', labelKo: '고향', description: '고향에 대한 기억과 그리움을 표현합니다.' },
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
          { id: 'city_pop', label: 'City Pop', labelKo: '클래식 시티팝', description: '도회적이고 세련된 80년대 라운지 감성과 그루브가 중심인 음악입니다.' },
          { id: 'funk_pop', label: 'Funk Pop', labelKo: '펑크팝', description: '리듬감 넘치는 베이스와 경쾌한 기타 커팅이 조화로운 팝 스타일입니다.' },
          { id: 'dance_pop', label: 'Dance Pop', labelKo: '댄스팝', description: '클럽 지향의 강렬한 비트와 화려한 코러스가 돋보이는 댄스 음악입니다.' },
          { id: 'acoustic_pop', label: 'Acoustic Pop', labelKo: '어쿠스틱팝', description: '어쿠스틱 기타와 피아노 중심의 담백하고 진솔한 감성을 담은 팝입니다.' },
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
          { id: 'k_trap', label: 'K-Trap', labelKo: 'K-트랩', description: '트랩 비트 위에 K-Pop 특유의 멜로디와 랩이 결합된 트렌디한 장르입니다.' },
          { id: 'k_new_jack_swing', label: 'K-New Jack Swing', labelKo: 'K-뉴잭스윙', description: '90년대 한국 가요의 향수를 불러일으키는 경쾌한 스윙 리듬의 음악입니다.' },
          { id: 'k_indie', label: 'K-Indie', labelKo: 'K-인디', description: '한국 인디 씬 특유의 담백한 감성과 독특한 음악적 색채가 돋보이는 스타일입니다.' },
          { id: 'k_folk', label: 'K-Folk', labelKo: 'K-포크', description: '통기타 중심의 서정적인 선율과 진솔한 가사가 담긴 한국적 포크 음악입니다.' },
          { id: 'k_rock', label: 'K-Rock', labelKo: 'K-록', description: '시원한 밴드 사운드와 한국적인 멜로디가 결합된 에너제틱한 록 스타일입니다.' },
          { id: 'gugak_fusion', label: 'Gugak Fusion', labelKo: '국악 퓨전', description: '전통 국악기와 현대적인 사운드가 만나 새로운 조화를 이루는 퓨전 장르입니다.' },
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
          { id: 'alternative_rnb', label: 'Alternative R&B', labelKo: '얼터너티브 R&B', description: '몽환적인 공간감과 실험적인 사운드 디자인이 돋보이는 현대적 R&B입니다.' },
          { id: 'new_jack_swing', label: 'New Jack Swing', labelKo: '뉴잭스윙', description: '힙합 비트와 알앤비 멜로디가 섞인 경쾌하고 리드미컬한 90년대 스타일입니다.' },
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
          { id: 'ambient', label: 'Ambient', labelKo: '앰비언트', description: '공간감 있는 사운드와 질감으로 편안하거나 신비로운 배경을 형성합니다.' },
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
};

export type TagTier = 'free' | 'basic' | 'pro';

export const SECTION_META: Record<string, { tier: TagTier, descriptionKo?: string }> = {
  'Intro': { 
    tier: 'pro', 
    descriptionKo: "곡의 시작을 여는 구간. 분위기와 톤을 설정하며, 청자의 몰입을 유도합니다." 
  },
  'Verse 1': { 
    tier: 'pro', 
    descriptionKo: "첫 번째 이야기 전개 구간. 가사와 분위기의 방향을 제시합니다." 
  },
  'Verse 2': { 
    tier: 'pro', 
    descriptionKo: "두 번째 전개 구간. 감정이나 내용을 확장하고 변화를 줍니다." 
  },
  'Pre-Chorus': { 
    tier: 'pro', 
    descriptionKo: "코러스로 넘어가기 전 긴장감을 쌓는 구간. 에너지 상승과 기대감을 형성합니다." 
  },
  'Chorus': { 
    tier: 'pro', 
    descriptionKo: "곡의 핵심 후렴구. 가장 강한 감정과 멜로디가 반복되며 기억에 남는 부분입니다." 
  },
  'Hook': { 
    tier: 'pro', 
    descriptionKo: "귀에 꽂히는 핵심 포인트. 짧지만 강한 반복 요소로 곡의 중독성을 만듭니다." 
  },
  'Drop': { 
    tier: 'pro', 
    descriptionKo: "비트나 사운드가 폭발하는 구간. 에너지 중심의 전개가 강조됩니다." 
  },
  'Bridge': { 
    tier: 'pro', 
    descriptionKo: "곡의 흐름을 전환하는 구간. 새로운 분위기나 변화를 통해 후반부를 준비합니다." 
  },
  'Breakdown': { 
    tier: 'pro',
    descriptionKo: "곡의 에너지를 낮추고 리듬을 쪼개어 변화를 주는 구간입니다."
  },
  'Instrumental': { 
    tier: 'pro',
    descriptionKo: "보컬 없이 악기 연주만으로 구성된 구간입니다."
  },
  'Solo': { 
    tier: 'pro',
    descriptionKo: "특정 악기의 독주가 강조되는 구간입니다."
  },
  'Rap Verse': { 
    tier: 'pro',
    descriptionKo: "랩으로 구성된 전개 구간입니다."
  },
  'Final Chorus': { 
    tier: 'pro',
    descriptionKo: "곡의 대미를 장식하는 마지막 후렴구입니다."
  },
  'Outro': { 
    tier: 'pro', 
    descriptionKo: "곡을 마무리하는 구간. 감정을 정리하고 자연스럽게 끝맺습니다." 
  },
  'Theme A': { 
    tier: 'pro',
    descriptionKo: "곡의 주요 테마 A를 정의하는 구간입니다."
  },
  'Theme B': { 
    tier: 'pro',
    descriptionKo: "곡의 주요 테마 B를 정의하는 구간입니다."
  },
  'Build-up': { 
    tier: 'pro',
    descriptionKo: "에너지를 점진적으로 고조시키는 구간입니다."
  },
  'Main Theme': { 
    tier: 'pro',
    descriptionKo: "곡의 가장 핵심적인 테마가 연주되는 구간입니다."
  },
  'Climax': { 
    tier: 'pro',
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
  "Minimal": { tier: 'free' },
  "Ambient Start": { tier: 'pro' },
  "Slow Build": { tier: 'pro' },
  "Hook-first": { tier: 'pro' },
  "Soft Entry": { tier: 'free' },
  "Instrumental Opening": { tier: 'pro' },
  "Gradual Layering": { tier: 'pro' },
  "Teaser Opening": { tier: 'pro' },
  "Low Energy": { tier: 'free' },
  "Story Focused": { tier: 'pro' },
  "Rhythmic Flow": { tier: 'pro' },
  "Sparse Arrangement": { tier: 'pro' },
  "Groove Driven": { tier: 'pro' },
  "Laid-back": { tier: 'pro' },
  "Steady Pace": { tier: 'free' },
  "Subtle Build": { tier: 'pro' },
  "Build-up": { tier: 'pro' },
  "Rising Energy": { tier: 'pro' },
  "Tension Lift": { tier: 'pro' },
  "Dynamic Increase": { tier: 'pro' },
  "Momentum Shift": { tier: 'pro' },
  "Intensity Growth": { tier: 'pro' },
  "Lead-in": { tier: 'free' },
  "Anticipation": { tier: 'pro' },
  "High Energy": { tier: 'pro' },
  "Explosive": { tier: 'pro' },
  "Full Arrangement": { tier: 'pro' },
  "Peak Section": { tier: 'pro' },
  "Anthemic": { tier: 'pro' },
  "Wide Impact": { tier: 'pro' },
  "Powerful Delivery": { tier: 'pro' },
  "Hook Emphasis": { tier: 'pro' },
  "Breakdown": { tier: 'pro' },
  "Contrast Section": { tier: 'pro' },
  "Energy Drop": { tier: 'pro' },
  "Minimal Reset": { tier: 'pro' },
  "Unexpected Shift": { tier: 'pro' },
  "Dynamic Change": { tier: 'pro' },
  "Rebuild Start": { tier: 'pro' },
  "Transition Focused": { tier: 'pro' },
  "Fade-out": { tier: 'free' },
  "Soft Ending": { tier: 'free' },
  "Gradual Exit": { tier: 'pro' },
  "Echo Finish": { tier: 'pro' },
  "Energy Release": { tier: 'pro' },
  "Minimal Ending": { tier: 'pro' },
  "Calm Closure": { tier: 'pro' },
  "Loop-friendly Ending": { tier: 'pro' }
};


export const ALLOWED_TAGS_BY_SECTION: Record<string, string[]> = {
  'Intro': [
    "Minimal",
    "Ambient Start",
    "Slow Build",
    "Hook-first",
    "Soft Entry",
    "Instrumental Opening",
    "Gradual Layering",
    "Teaser Opening"
  ],

  'Verse 1': [
    "Low Energy",
    "Story Focused",
    "Rhythmic Flow",
    "Sparse Arrangement",
    "Groove Driven",
    "Laid-back",
    "Steady Pace",
    "Subtle Build"
  ],

  'Verse 2': [
    "Low Energy",
    "Story Focused",
    "Rhythmic Flow",
    "Sparse Arrangement",
    "Groove Driven",
    "Laid-back",
    "Steady Pace",
    "Subtle Build"
  ],

  'Pre-Chorus': [
    "Build-up",
    "Rising Energy",
    "Tension Lift",
    "Dynamic Increase",
    "Momentum Shift",
    "Intensity Growth",
    "Lead-in",
    "Anticipation"
  ],

  'Chorus': [
    "High Energy",
    "Explosive",
    "Full Arrangement",
    "Peak Section",
    "Anthemic",
    "Wide Impact",
    "Powerful Delivery",
    "Hook Emphasis"
  ],

  'Final Chorus': [
    "High Energy",
    "Explosive",
    "Full Arrangement",
    "Peak Section",
    "Anthemic",
    "Wide Impact",
    "Powerful Delivery",
    "Hook Emphasis"
  ],

  'Hook': [
    "High Energy",
    "Explosive",
    "Full Arrangement",
    "Peak Section",
    "Anthemic",
    "Wide Impact",
    "Powerful Delivery",
    "Hook Emphasis"
  ],

  'Drop': [
    "High Energy",
    "Explosive",
    "Full Arrangement",
    "Peak Section",
    "Anthemic",
    "Wide Impact",
    "Powerful Delivery",
    "Hook Emphasis"
  ],

  'Bridge': [
    "Breakdown",
    "Contrast Section",
    "Energy Drop",
    "Minimal Reset",
    "Unexpected Shift",
    "Dynamic Change",
    "Rebuild Start",
    "Transition Focused"
  ],

  'Breakdown': [
    "Breakdown",
    "Contrast Section",
    "Energy Drop",
    "Minimal Reset",
    "Unexpected Shift",
    "Dynamic Change",
    "Rebuild Start",
    "Transition Focused"
  ],

  'Solo': [
    "Breakdown",
    "Contrast Section",
    "Energy Drop",
    "Minimal Reset",
    "Unexpected Shift",
    "Dynamic Change",
    "Rebuild Start",
    "Transition Focused"
  ],

  'Rap Verse': [
    "Low Energy",
    "Story Focused",
    "Rhythmic Flow",
    "Sparse Arrangement",
    "Groove Driven",
    "Laid-back",
    "Steady Pace",
    "Subtle Build"
  ],

  'Outro': [
    "Fade-out",
    "Soft Ending",
    "Gradual Exit",
    "Echo Finish",
    "Energy Release",
    "Minimal Ending",
    "Calm Closure",
    "Loop-friendly Ending"
  ],
  'Theme A': [
    "Low Energy", "Story Focused", "Rhythmic Flow", "Sparse Arrangement", "Groove Driven", "Laid-back", "Steady Pace", "Subtle Build"
  ],
  'Theme B': [
    "Low Energy", "Story Focused", "Rhythmic Flow", "Sparse Arrangement", "Groove Driven", "Laid-back", "Steady Pace", "Subtle Build"
  ],
  'Build-up': [
    "Build-up", "Rising Energy", "Tension Lift", "Dynamic Increase", "Momentum Shift", "Intensity Growth", "Lead-in", "Anticipation"
  ],
  'Main Theme': [
    "High Energy", "Explosive", "Full Arrangement", "Peak Section", "Anthemic", "Wide Impact", "Powerful Delivery", "Hook Emphasis"
  ],
  'Climax': [
    "High Energy", "Explosive", "Full Arrangement", "Peak Section", "Anthemic", "Wide Impact", "Powerful Delivery", "Hook Emphasis"
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
  "Taepyeongso"
] as const;

export const INSTRUMENT_TAG_DESCRIPTIONS: Record<string, string> = {
  "Piano": "피아노 중심으로 선율과 감정을 또렷하게 잡아줍니다.",
  "Acoustic Guitar": "어쿠스틱 기타의 자연스럽고 따뜻한 질감을 더합니다.",
  "Electric Guitar": "일렉 기타의 선명하고 힘있는 존재감을 더합니다.",
  "Synth": "신스 중심의 현대적이고 전자적인 질감을 만듭니다.",
  "Synth Lead": "선명하고 화려한 신스 리드로 멜로디를 강조합니다.",
  "Pad": "뒤를 채우는 패드로 공간감과 분위기를 넓혀줍니다.",
  "Strings": "스트링으로 감정선과 스케일을 풍부하게 만듭니다.",
  "Bass": "저음을 단단하게 받쳐 곡의 중심을 잡아줍니다.",
  "Drums": "드럼 중심의 리듬과 추진력을 분명하게 만듭니다.",
  "Percussion": "퍼커션으로 리듬의 디테일과 움직임을 더합니다.",
  "Pluck": "플럭 사운드로 또렷하고 경쾌한 포인트를 만듭니다.",
  "Brass": "브라스로 화려하고 힘있는 인상을 더합니다.",
  "FX": "효과음과 질감 요소로 연출감을 강화합니다.",
  "Gayageum": "가야금의 우아하고 섬세한 선율이 돋보입니다.",
  "Haegeum": "해금의 애절하고 독특한 음색이 강조됩니다.",
  "Taepyeongso": "태평소의 강렬하고 시원한 소리가 에너지를 더합니다."
};
export const TAG_DESCRIPTIONS = {
  "Minimal": "소리가 최소화되어 여백이 크게 느껴집니다.",
  "Ambient Start": "잔잔하고 부드러운 분위기로 시작됩니다.",
  "Slow Build": "시간이 지날수록 점점 풍부해집니다.",
  "Hook-first": "처음부터 핵심 멜로디가 강하게 인상 남깁니다.",
  "Soft Entry": "부드럽고 자연스럽게 시작됩니다.",
  "Instrumental Opening": "보컬 없이 연주 중심으로 시작됩니다.",
  "Gradual Layering": "악기가 하나씩 추가되며 점점 쌓입니다.",
  "Teaser Opening": "짧고 인상적인 도입으로 호기심을 자극합니다.",

  "Low Energy": "차분하고 안정된 흐름이 유지됩니다.",
  "Story Focused": "가사 전달이 또렷하게 들립니다.",
  "Rhythmic Flow": "리듬감이 자연스럽게 이어집니다.",
  "Sparse Arrangement": "악기 구성이 단순하고 여유롭게 들립니다.",
  "Groove Driven": "리듬 중심의 흐름이 강조됩니다.",
  "Laid-back": "느긋하고 여유로운 분위기가 유지됩니다.",
  "Steady Pace": "일정한 흐름이 안정적으로 이어집니다.",
  "Subtle Build": "눈에 띄지 않게 서서히 변화가 쌓입니다.",

  "Build-up": "점점 긴장감이 높아집니다.",
  "Rising Energy": "에너지가 점진적으로 상승합니다.",
  "Tension Lift": "긴장감이 서서히 끌어올려집니다.",
  "Dynamic Increase": "사운드의 밀도가 점점 커집니다.",
  "Momentum Shift": "흐름이 다음 단계로 넘어갈 준비를 합니다.",
  "Intensity Growth": "강도가 점차 강해집니다.",
  "Lead-in": "다음 구간으로 자연스럽게 이어집니다.",
  "Anticipation": "기대감이 점점 커집니다.",

  "High Energy": "강하고 활기찬 분위기가 강조됩니다.",
  "Explosive": "강하게 터지듯 에너지가 폭발합니다.",
  "Full Arrangement": "모든 요소가 꽉 찬 사운드로 들립니다.",
  "Peak Section": "곡에서 가장 강한 구간으로 느껴집니다.",
  "Anthemic": "웅장하고 따라 부르기 쉬운 느낌이 강조됩니다.",
  "Wide Impact": "사운드가 넓게 퍼지며 크게 느껴집니다.",
  "Powerful Delivery": "보컬과 사운드가 강하게 전달됩니다.",
  "Hook Emphasis": "핵심 멜로디가 강하게 반복되어 기억에 남습니다.",

  "Breakdown": "구성이 단순해지며 힘이 빠집니다.",
  "Contrast Section": "이전과 다른 분위기로 전환됩니다.",
  "Energy Drop": "에너지가 잠시 낮아집니다.",
  "Minimal Reset": "최소 구성으로 리셋되는 느낌이 납니다.",
  "Unexpected Shift": "예상과 다른 전개가 나타납니다.",
  "Dynamic Change": "전체적인 흐름이 크게 바뀝니다.",
  "Rebuild Start": "다시 상승하기 위한 준비가 시작됩니다.",
  "Transition Focused": "다음 구간으로 넘어가는 흐름이 강조됩니다.",

  "Fade-out": "점점 작아지며 자연스럽게 끝납니다.",
  "Soft Ending": "부드럽고 잔잔하게 마무리됩니다.",
  "Gradual Exit": "천천히 사라지듯 마무리됩니다.",
  "Echo Finish": "잔향이 남으며 여운이 이어집니다.",
  "Energy Release": "쌓였던 에너지가 풀리며 마무리됩니다.",
  "Minimal Ending": "간결하게 정리되며 끝납니다.",
  "Calm Closure": "안정적으로 마무리됩니다.",
  "Loop-friendly Ending": "다시 반복되어도 자연스럽게 이어집니다."
};




