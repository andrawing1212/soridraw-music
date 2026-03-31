import { CategoryItem, GenreGroup, SoundStyleItem } from './types';

/**
 * 기존 화면 / FavoritesPage 호환용 평면 장르 목록
 * - FavoritesPage, 기존 appliedKeywords 표시용
 * - 새 App 구조에서도 선택 결과 표시용 fallback 으로 유지
 */
export const GENRES: CategoryItem[] = [
  { id: 'dance-pop', label: 'Dance Pop', description: '강한 훅과 리듬감이 있는 대중적인 댄스 팝입니다.' },
  { id: 'synth-pop', label: 'Synth Pop', description: '신디사이저 중심의 세련된 팝 사운드입니다.' },
  { id: 'teen-pop', label: 'Teen Pop', description: '밝고 접근성이 높은 틴 팝 스타일입니다.' },
  { id: 'k-pop', label: 'K-Pop', description: '한국 대중음악 기반의 세련된 사운드입니다.' },
  { id: 'j-pop', label: 'J-Pop', description: '일본 대중음악 특유의 멜로디와 편곡이 특징입니다.' },
  { id: 'latin-pop', label: 'Latin Pop', description: '라틴 리듬이 가미된 대중적인 팝 스타일입니다.' },
  { id: 'soulful-pop', label: 'Soulful Pop', description: '소울 감성이 섞인 보컬 중심 팝입니다.' },
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

  { id: 'film-score', label: 'Film Score', description: '영화 음악 스타일의 서사적 구성입니다.' },
  { id: 'game-bgm', label: 'Game BGM', description: '게임 배경음악 스타일입니다.' },
  { id: 'drama-theme', label: 'Drama Theme', description: '드라마 OST 스타일의 감성적인 테마곡입니다.' },
  { id: 'piano-instrumental', label: 'Piano', description: '피아노 중심의 연주곡입니다.' },
  { id: 'guitar-instrumental', label: 'Guitar', description: '기타 중심의 연주곡입니다.' },
  { id: 'lofi-instrumental', label: 'Lo-fi', description: '로파이 질감 중심의 연주곡입니다.' },
  { id: 'healing-music', label: 'Healing Music', description: '휴식과 안정감을 위한 기능성 음악입니다.' },
  { id: 'meditation-music', label: 'Meditation Music', description: '명상과 집중을 위한 기능성 음악입니다.' },
  { id: 'ambient-newage', label: 'Ambient New Age', description: '앰비언트/뉴에이지 계열의 평온한 음악입니다.' },
  { id: 'traditional-trot', label: 'Traditional Trot', description: '전통 트로트의 깊은 감성이 살아 있는 스타일입니다.' },
  { id: 'semi-trot', label: 'Semi-Trot', description: '현대적으로 다듬어진 대중적 트로트 스타일입니다.' },
];

/**
 * 새 장르 선택 UI용
 * - 대분류 7개를 먼저 노출
 * - 클릭하면 실제 장르(중분류) 목록을 보여줌
 */
export const GENRE_GROUPS: GenreGroup[] = [
  {
    id: 'pop',
    label: 'Pop',
    description: '가장 대중적이며 상업적인 성공을 목적으로 하는 음악군입니다.',
    children: [
      { id: 'dance-pop', label: 'Dance Pop', description: '강한 훅과 리듬감의 팝', promptCore: 'A dance-pop track with strong hooks, polished production, and mainstream energy.' },
      { id: 'synth-pop', label: 'Synth Pop', description: '신스 중심 팝', promptCore: 'A synth-pop track with bright synthesizers, catchy melody, and sleek pop arrangement.' },
      { id: 'teen-pop', label: 'Teen Pop', description: '밝은 틴 팝', promptCore: 'A teen-pop track with youthful energy, catchy chorus, and clean mainstream arrangement.' },
      { id: 'k-pop', label: 'K-Pop', description: '한국형 팝', promptCore: 'A polished K-pop track with strong hook design, sleek production, and dynamic pop structure.' },
      { id: 'j-pop', label: 'J-Pop', description: '일본형 팝', promptCore: 'A melodic J-pop track with expressive phrasing, colorful arrangement, and polished pop structure.' },
      { id: 'latin-pop', label: 'Latin Pop', description: '라틴 팝', promptCore: 'A Latin pop track with rhythmic vitality, catchy vocals, and a bright commercial pop feel.' },
      { id: 'soulful-pop', label: 'Soulful Pop', description: '소울풀 팝', promptCore: 'A soulful pop track with expressive vocals, warm harmony, and polished mainstream accessibility.' },
      { id: 'piano-ballad', label: 'Piano Ballad', description: '피아노 발라드', promptCore: 'A piano ballad with emotional pacing, strong vocal focus, and heartfelt melodic flow.' },
      { id: 'adult-contemporary', label: 'Adult Contemporary', description: '어덜트 컨템포러리', promptCore: 'An adult contemporary track with polished vocals, emotional clarity, and refined mainstream softness.' },
      { id: 'indie-pop', label: 'Indie Pop', description: '인디 팝', promptCore: 'An indie-pop track with tasteful restraint, melodic charm, and an intimate modern feel.' },
      { id: 'chamber-pop', label: 'Chamber Pop', description: '챔버 팝', promptCore: 'A chamber pop track with refined orchestration, delicate textures, and elegant melodic writing.' },
    ],
  },
  {
    id: 'rock',
    label: 'Rock & Metal',
    description: '기타, 베이스, 드럼의 강렬한 사운드와 저항 정신을 기반으로 합니다.',
    children: [
      { id: 'grunge', label: 'Grunge', description: '거칠고 무거운 록', promptCore: 'A grunge track with raw guitar texture, heavy band energy, and emotionally rough-edged movement.' },
      { id: 'britpop', label: 'Britpop', description: '영국식 팝 록', promptCore: 'A Britpop track with melodic guitar hooks, confident attitude, and bright band-led momentum.' },
      { id: 'shoegaze', label: 'Shoegaze', description: '공간감 중심 록', promptCore: 'A shoegaze track with layered guitars, dreamy haze, and immersive wall-of-sound atmosphere.' },
      { id: 'post-rock', label: 'Post Rock', description: '서사적 록', promptCore: 'A post-rock track with gradual cinematic build, expansive texture, and instrumental emotional lift.' },
      { id: 'punk-rock', label: 'Punk Rock', description: '펑크 록', promptCore: 'A punk rock track with brisk momentum, rebellious energy, and stripped-down band force.' },
      { id: 'heavy-metal', label: 'Heavy Metal', description: '헤비 메탈', promptCore: 'A heavy metal track with strong guitar riffs, forceful rhythm, and intense heavy energy.' },
      { id: 'thrash-metal', label: 'Thrash Metal', description: '스래시 메탈', promptCore: 'A thrash metal track with aggressive speed, sharp riffing, and relentless power.' },
      { id: 'death-metal', label: 'Death Metal', description: '데스 메탈', promptCore: 'A death metal track with crushing heaviness, dark aggression, and extreme sonic density.' },
      { id: 'progressive-rock', label: 'Progressive Rock', description: '프로그레시브 록', promptCore: 'A progressive rock track with complex structure, dynamic transitions, and ambitious musical scope.' },
      { id: 'psychedelic-rock', label: 'Psychedelic Rock', description: '사이키델릭 록', promptCore: 'A psychedelic rock track with swirling textures, altered-space atmosphere, and exploratory guitar movement.' },
    ],
  },
  {
    id: 'hiphop',
    label: 'Hip-hop & R&B',
    description: '리듬과 그루브, 라임과 비트를 강조하는 블랙 뮤직의 핵심입니다.',
    children: [
      { id: 'boom-bap', label: 'Boom Bap', description: '클래식 힙합', promptCore: 'A boom bap track with classic drum groove, sample-led texture, and grounded hip-hop attitude.' },
      { id: 'trap', label: 'Trap', description: '트랩', promptCore: 'A trap track with deep 808 bass, tight hi-hat rolls, and modern rhythmic aggression.' },
      { id: 'drill', label: 'Drill', description: '드릴', promptCore: 'A drill track with dark pulse, tense rhythm, and sharp urban energy.' },
      { id: 'gangsta-rap', label: 'Gangsta Rap', description: '갱스터 랩', promptCore: 'A gangsta rap track with direct attitude, heavy groove, and hard-edged rhythmic flow.' },
      { id: 'lofi-hiphop', label: 'Lo-fi Hip-Hop', description: '로파이 힙합', promptCore: 'A lo-fi hip-hop track with dusty texture, mellow beat, and relaxed head-nod groove.' },
      { id: 'contemporary-rnb', label: 'Contemporary R&B', description: '컨템포러리 R&B', promptCore: 'A contemporary R&B track with smooth vocals, refined groove, and modern urban polish.' },
      { id: 'motown', label: 'Motown', description: '모타운', promptCore: 'A Motown-inspired track with classic soul rhythm, melodic warmth, and rich vocal energy.' },
      { id: 'gospel', label: 'Gospel', description: '가스펠', promptCore: 'A gospel-inspired track with uplifting harmony, emotional vocal power, and spiritual warmth.' },
      { id: 'funk-rnb', label: 'Funk', description: '펑크', promptCore: 'A funk-driven track with tight bass groove, syncopated rhythm, and lively movement.' },
      { id: 'pb-rnb', label: 'PBR&B', description: 'PBR&B', promptCore: 'A PBR&B track with dark atmospheric texture, moody space, and modern alternative R&B mood.' },
      { id: 'jazz-hiphop', label: 'Jazz Hip-Hop', description: '재즈 힙합', promptCore: 'A jazz hip-hop track with laid-back groove, jazzy harmony, and refined rhythmic flow.' },
      { id: 'neo-soul', label: 'Neo Soul', description: '네오 소울', promptCore: 'A neo-soul track with warm harmony, deep groove, and soulful modern sophistication.' },
    ],
  },
  {
    id: 'electronic',
    label: 'Electronic / EDM',
    description: '컴퓨터와 신디사이저를 활용한 사운드 디자인 중심의 음악입니다.',
    children: [
      { id: 'house', label: 'House', description: '하우스', promptCore: 'A house track with four-on-the-floor pulse, polished club groove, and dance-floor energy.' },
      { id: 'techno', label: 'Techno', description: '테크노', promptCore: 'A techno track with repetitive drive, hypnotic pulse, and sleek mechanical intensity.' },
      { id: 'trance', label: 'Trance', description: '트랜스', promptCore: 'A trance track with uplifting progression, immersive build, and expansive electronic emotion.' },
      { id: 'dubstep', label: 'Dubstep', description: '덥스텝', promptCore: 'A dubstep track with aggressive bass motion, strong drops, and high-impact electronic tension.' },
      { id: 'drum-and-bass', label: 'Drum & Bass', description: '드럼 앤 베이스', promptCore: 'A drum and bass track with fast breakbeats, driving low-end, and kinetic momentum.' },
      { id: 'future-bass', label: 'Future Bass', description: '퓨처 베이스', promptCore: 'A future bass track with emotional synth swells, modern drops, and vibrant melodic lift.' },
      { id: 'ambient-electronic', label: 'Ambient', description: '앰비언트 일렉트로닉', promptCore: 'An ambient electronic track with spacious texture, slow movement, and immersive atmosphere.' },
      { id: 'vaporwave', label: 'Vaporwave', description: '베이퍼웨이브', promptCore: 'A vaporwave track with nostalgic digital haze, retro texture, and dreamy synthetic drift.' },
      { id: 'electro-pop', label: 'Electro Pop', description: '일렉트로 팝', promptCore: 'An electro-pop track with catchy melody, crisp synth production, and radio-friendly energy.' },
      { id: 'eurobeat', label: 'Eurobeat', description: '유로비트', promptCore: 'A eurobeat track with fast tempo, dramatic melodic drive, and high-octane dance energy.' },
    ],
  },
  {
    id: 'jazz-blues',
    label: 'Jazz & Blues',
    description: '즉흥 연주와 독특한 화성 체계를 가진 현대 대중음악의 뿌리입니다.',
    children: [
      { id: 'swing', label: 'Swing', description: '스윙', promptCore: 'A swing track with lively rhythm, brass-friendly momentum, and classic jazz elegance.' },
      { id: 'bebop', label: 'Bebop', description: '비밥', promptCore: 'A bebop-inspired track with brisk harmonic motion, agile phrasing, and sophisticated jazz attitude.' },
      { id: 'cool-jazz', label: 'Cool Jazz', description: '쿨 재즈', promptCore: 'A cool jazz track with understated sophistication, smooth phrasing, and relaxed elegance.' },
      { id: 'hard-bop', label: 'Hard Bop', description: '하드 밥', promptCore: 'A hard bop track with soulful intensity, rich rhythm section interplay, and jazz drive.' },
      { id: 'free-jazz', label: 'Free Jazz', description: '프리 재즈', promptCore: 'A free jazz-inspired track with open structure, experimental movement, and expressive unpredictability.' },
      { id: 'fusion-jazz', label: 'Fusion Jazz', description: '퓨전 재즈', promptCore: 'A fusion jazz track with modern energy, rhythmic sophistication, and expanded instrumental color.' },
      { id: 'bossanova', label: 'Bossanova', description: '보사노바', promptCore: 'A bossa nova track with soft Brazilian rhythm, gentle jazz harmony, and intimate elegance.' },
      { id: 'acid-jazz', label: 'Acid Jazz', description: '애시드 재즈', promptCore: 'An acid jazz track with groove-forward rhythm, jazzy color, and stylish urban motion.' },
      { id: 'delta-blues', label: 'Delta Blues', description: '델타 블루스', promptCore: 'A delta blues track with raw roots feeling, earthy phrasing, and stripped emotional weight.' },
      { id: 'chicago-blues', label: 'Chicago Blues', description: '시카고 블루스', promptCore: 'A Chicago blues track with electric blues energy, soulful phrasing, and urban grit.' },
    ],
  },
  {
    id: 'folk-country',
    label: 'Folk & Country',
    description: '전통적인 악기와 서사적인 가사를 중시하는 음악군입니다.',
    children: [
      { id: 'modern-folk', label: 'Modern Folk', description: '모던 포크', promptCore: 'A modern folk track with organic warmth, narrative intimacy, and natural acoustic flow.' },
      { id: 'anti-folk', label: 'Anti-Folk', description: '안티 포크', promptCore: 'An anti-folk track with rough honesty, direct storytelling, and unpolished charm.' },
      { id: 'folk-rock', label: 'Folk Rock', description: '포크 록', promptCore: 'A folk rock track with acoustic roots, band support, and narrative melodic lift.' },
      { id: 'singer-songwriter', label: 'Singer-Songwriter', description: '싱어송라이터', promptCore: 'A singer-songwriter track with intimate lyric focus, organic arrangement, and personal emotional clarity.' },
      { id: 'world-music', label: 'World Music', description: '월드 뮤직', promptCore: 'A world-music-inspired track with global rhythmic color, organic texture, and cross-cultural flavor.' },
      { id: 'country-pop', label: 'Country Pop', description: '컨트리 팝', promptCore: 'A country pop track with accessible melody, warm roots texture, and broad mainstream appeal.' },
      { id: 'bluegrass', label: 'Bluegrass', description: '블루그래스', promptCore: 'A bluegrass track with lively string work, acoustic drive, and traditional rural energy.' },
      { id: 'americana', label: 'Americana', description: '아메리카나', promptCore: 'An Americana track with roots authenticity, warm storytelling, and earthy instrumental character.' },
      { id: 'honky-tonk', label: 'Honky-Tonk', description: '혼키통크', promptCore: 'A honky-tonk track with rhythmic bounce, classic country piano flavor, and lively barroom energy.' },
      { id: 'southern-rock', label: 'Southern Rock', description: '서던 록', promptCore: 'A southern rock track with bluesy guitar spirit, grounded swagger, and band-led drive.' },
    ],
  },
  {
    id: 'functional',
    label: 'Functional / OST / Trot',
    description: '용도나 제작 방식에 따른 분류입니다.',
    children: [
      { id: 'film-score', label: 'Film Score', description: '영화 음악', promptCore: 'A film score-style track with cinematic pacing, emotional lift, and strong visual storytelling tone.' },
      { id: 'game-bgm', label: 'Game BGM', description: '게임 BGM', promptCore: 'A game BGM-style track with loop-friendly movement, immersive atmosphere, and supportive energy.' },
      { id: 'drama-theme', label: 'Drama Theme', description: '드라마 테마', promptCore: 'A drama theme track with emotional pacing, strong motif, and cinematic television-style mood.' },
      { id: 'piano-instrumental', label: 'Piano', description: '피아노 연주곡', promptCore: 'A piano instrumental track with clear melodic focus, expressive dynamics, and emotional intimacy.' },
      { id: 'guitar-instrumental', label: 'Guitar', description: '기타 연주곡', promptCore: 'A guitar instrumental track with organic warmth, melodic clarity, and natural expressive movement.' },
      { id: 'lofi-instrumental', label: 'Lo-fi', description: '로파이 연주곡', promptCore: 'A lo-fi instrumental track with dusty texture, mellow looped groove, and cozy atmosphere.' },
      { id: 'healing-music', label: 'Healing Music', description: '힐링 음악', promptCore: 'A healing track with calm flow, soothing texture, and restful emotional atmosphere.' },
      { id: 'meditation-music', label: 'Meditation Music', description: '명상 음악', promptCore: 'A meditation track with minimal movement, spacious calm, and deeply restorative stillness.' },
      { id: 'ambient-newage', label: 'Ambient New Age', description: '뉴에이지/앰비언트', promptCore: 'An ambient new-age track with serene flow, meditative pacing, and peaceful spacious tone.' },
      { id: 'traditional-trot', label: 'Traditional Trot', description: '전통 트로트', promptCore: 'A traditional trot track with dramatic Korean melodic phrasing, emotional vocal style, and classic sentiment.' },
      { id: 'semi-trot', label: 'Semi-Trot', description: '세미 트로트', promptCore: 'A semi-trot track with bright mainstream trot energy, lively rhythm, and accessible modern polish.' },
    ],
  },
];

/**
 * 스타일 = 장르에 추가로 입히는 중간 레이어
 * - 최대 2개 선택 권장
 * - FavoritesPage 호환을 위해 theme에도 함께 기록 예정
 */
export const SOUND_STYLES: SoundStyleItem[] = [
  { id: 'ballad', label: 'Ballad', description: '느린 전개와 감정 중심 구조', promptCore: 'The track follows a ballad-style structure with slower pacing, emotional focus, and a vocal-centered arrangement.' },
  { id: 'dance', label: 'Dance', description: '리듬과 퍼포먼스 중심', promptCore: 'The track emphasizes danceable rhythm, performance energy, and clear beat-driven motion.' },
  { id: 'hiphop', label: 'Hip-Hop', description: '비트와 랩 감성', promptCore: 'The track incorporates hip-hop rhythmic attitude, beat focus, and urban motion.' },
  { id: 'jazz', label: 'Jazz', description: '재즈 화성과 스윙 감성', promptCore: 'The track incorporates jazz harmony, fluid phrasing, and sophisticated rhythmic feel.' },
  { id: 'acoustic', label: 'Acoustic', description: '자연 악기 중심', promptCore: 'The arrangement is acoustic-centered, using organic instruments and warm natural texture.' },
  { id: 'lofi', label: 'Lo-fi', description: '빈티지 질감과 편안함', promptCore: 'The track uses lo-fi texture, softened transients, and a warm slightly dusty atmosphere.' },
  { id: 'orchestral', label: 'Orchestral', description: '현악/오케스트라 확장감', promptCore: 'The arrangement includes orchestral color, cinematic lift, and expanded instrumental depth.' },
  { id: 'synth', label: 'Synth', description: '신스 중심 질감', promptCore: 'The arrangement is synth-led, with electronic textures shaping the song identity.' },
  { id: 'funk', label: 'Funk', description: '그루브 중심 리듬감', promptCore: 'The arrangement emphasizes tight funk groove, syncopation, and rhythmic movement.' },
  { id: 'punk', label: 'Punk', description: '거칠고 빠른 에너지', promptCore: 'The track carries punk-like urgency, speed, and direct raw energy.' },
  { id: 'latin', label: 'Latin', description: '라틴 리듬 컬러', promptCore: 'The track incorporates Latin rhythmic flavor, lively percussion motion, and colorful energy.' },
  { id: 'reggae', label: 'Reggae', description: '엇박자와 여유로운 흐름', promptCore: 'The track incorporates reggae-style offbeat rhythm and laid-back motion.' },
  { id: 'opera', label: 'Opera', description: '극적이고 성악적인 웅장함', promptCore: 'The track includes operatic drama, grand emotional projection, and theatrical scale.' },
  { id: 'anime', label: 'Anime', description: '애니메이션 OST 같은 전개감', promptCore: 'The track carries anime-style emotional intensity, melodic drama, and dynamic theme-song energy.' },
];

export const MOODS: CategoryItem[] = [
  { id: 'cool', label: 'Cool', description: '시원하고 세련된 분위기입니다.' },
  { id: 'chill', label: 'Chill', description: '느긋하고 편안한 무드입니다.' },
  { id: 'calm', label: 'Calm', description: '차분하고 고요한 느낌을 줍니다.' },
  { id: 'cheerful', label: 'Cheerful', description: '밝고 쾌활하며 즐거운 분위기입니다.' },
  { id: 'cinematic', label: 'Cinematic', description: '영화의 한 장면 같은 웅장하거나 서사적인 느낌입니다.' },
  { id: 'mellow', label: 'Mellow', description: '부드럽고 풍부하며 편안한 사운드입니다.' },
  { id: 'coziness', label: 'Coziness', description: '포근하고 아늑한 느낌을 줍니다.' },
  { id: 'nostalgic', label: 'Nostalgic', description: '과거에 대한 향수와 그리움을 불러일으킵니다.' },
  { id: 'dreamy', label: 'Dreamy', description: '꿈결 같은 몽환적이고 신비로운 분위기입니다.' },
  { id: 'romantic', label: 'Romantic', description: '낭만적이고 사랑스러운 감정을 담았습니다.' },
  { id: 'peaceful', label: 'Peaceful', description: '평화롭고 고요한 마음의 안정을 줍니다.' },
  { id: 'healing', label: 'Healing', description: '지친 마음을 달래주는 치유의 사운드입니다.' },
  { id: 'bright', label: 'Bright', description: '빛나고 화사하며 긍정적인 에너지입니다.' },
  { id: 'emotional', label: 'Emotional', description: '깊은 감동과 풍부한 감정 표현이 특징입니다.' },
  { id: 'minimalist', label: 'Minimalist', description: '단순함의 미학을 살린 절제된 사운드입니다.' },
  { id: 'melancholic', label: 'Melancholic', description: '애수 어린 슬픔과 깊은 성찰의 분위기입니다.' },
  { id: 'bittersweet', label: 'Bittersweet', description: '달콤하면서도 쌉싸름한 복합적인 감정입니다.' },
  { id: 'groovy', label: 'Groovy', description: '리드미컬하고 몸을 들썩이게 하는 그루브입니다.' },
  { id: 'upbeat', label: 'Upbeat', description: '박동감 넘치고 활기찬 리듬입니다.' },
  { id: 'funky', label: 'Funky', description: '강렬한 리듬감과 개성 있는 사운드입니다.' },
  { id: 'powerful', label: 'Powerful', description: '강력하고 힘 있는 에너지의 사운드입니다.' },
  { id: 'urban', label: 'Urban', description: '세련된 도시적 감성과 현대적인 바이브입니다.' },
  { id: 'sophisticated', label: 'Sophisticated', description: '교양 있고 세련된 고품격 사운드입니다.' },
  { id: 'atmospheric', label: 'Atmospheric', description: '공간감과 분위기가 강조된 오묘한 느낌입니다.' },
  { id: 'moody', label: 'Moody', description: '변덕스럽거나 깊은 분위기를 자아내는 무드입니다.' },
  { id: 'infectious', label: 'Infectious', description: '한 번 들으면 잊히지 않는 중독성 있는 사운드입니다.' },
  { id: 'hypnotic', label: 'Hypnotic', description: '최면에 걸린 듯 빠져드는 반복적인 매력입니다.' },
  { id: 'zen', label: 'Zen', description: '명상적이고 정신적인 평온함을 주는 사운드입니다.' },
  { id: 'loneliness', label: 'Loneliness', description: '고독하고 쓸쓸한 감정의 깊이를 담았습니다.' },
  { id: 'rainy-ambience', label: 'Rainy ambience', description: '비 오는 날의 차분하고 서정적인 분위기입니다.' },
  { id: 'forest-ambience', label: 'Forest ambience', description: '숲속의 평화롭고 자연적인 사운드입니다.' },
  { id: 'beach-ambience', label: 'Beach ambience', description: '해변의 시원하고 여유로운 파도 소리 같은 분위기입니다.' },
  { id: 'relaxing', label: 'Relaxing', description: '긴장을 풀고 편안하게 쉴 수 있는 휴식의 사운드입니다.' },
];

/**
 * 기존 FavoritesPage 호환용 유지
 * - 새로운 구조에서는 스타일 표시를 theme에도 같이 저장
 */
export const THEMES: CategoryItem[] = SOUND_STYLES.map((style) => ({
  id: style.id,
  label: style.label,
  description: style.description,
}));

export const BASE_PROMPTS = [
  "Create a musically coherent, commercially usable song prompt with clear genre identity, tasteful arrangement, and emotionally consistent songwriting.",
  "Keep the arrangement intentional and avoid keyword dumping. The final prompt should read like a real production direction.",
  "Use the selected genre as the root identity, selected styles as transformation layers, and moods as emotional color."
];

export const BASIC_STRUCTURE =
  "Intro → Verse 1 → Pre-Chorus → Chorus / Drop → Verse 2 → Pre-Chorus → Chorus / Drop → Bridge → Final Chorus / Drop → Outro";
