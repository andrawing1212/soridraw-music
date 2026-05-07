import { VocalTone } from '../types';

export const VOCAL_TONES: VocalTone[] = [
  // =========================
  // MALE VOCAL TONES
  // =========================
  {
    id: "male_husky",
    label: "Male Husky",
    labelKo: "허스키한 남성 보컬",
    description: "Husky male vocal tone with textured low-mid presence and emotional grit.",
    descriptionKo: "거칠고 허스키한 남성 톤입니다. 중저음의 질감과 감정적인 호소력이 특징입니다.",
    genderTarget: "male",
    promptCore: "Husky male vocal tone, textured low-mid presence, emotional grit.",
    promptShort: "husky gritty male",
    isActive: true, isDefault: false, sortOrder: 1, genreTags: []
  },
  {
    id: "male_soft",
    label: "Male Soft",
    labelKo: "따뜻하고 부드러운 남성 보컬",
    description: "Soft and warm male vocal tone with smooth delivery and emotional subtlety.",
    descriptionKo: "부드럽고 따뜻한 남성 톤입니다. 매끄러운 전달력과 섬세한 감정 표현이 특징입니다.",
    genderTarget: "male",
    promptCore: "Soft warm male vocal, smooth delivery, emotional subtlety.",
    promptShort: "soft warm male",
    isActive: true, isDefault: false, sortOrder: 2, genreTags: []
  },
  {
    id: "male_sharp",
    label: "Male Sharp",
    labelKo: "선명하고 날카로운 남성 보컬",
    description: "Sharp and clear male vocal tone with crisp articulation and bright presence.",
    descriptionKo: "날카롭고 선명한 남성 톤입니다. 또렷한 발음과 밝은 존재감이 특징입니다.",
    genderTarget: "male",
    promptCore: "Sharp clear male vocal, crisp articulation, bright presence.",
    promptShort: "sharp clear male",
    isActive: true, isDefault: false, sortOrder: 3, genreTags: []
  },
  {
    id: "male_breathy",
    label: "Male Breathy",
    labelKo: "숨결 섞인 남성 보컬",
    description: "Breathy male vocal tone with airy texture and intimate delivery.",
    descriptionKo: "숨소리가 섞인 남성 톤입니다. 친밀하고 부드러운 느낌을 줍니다.",
    genderTarget: "male",
    promptCore: "Breathy male vocal, airy texture, intimate delivery.",
    promptShort: "breathy intimate male",
    isActive: true, isDefault: false, sortOrder: 4, genreTags: []
  },
  {
    id: "male_deep_soul",
    label: "Male Deep Soul",
    labelKo: "깊고 풍부한 남성 보컬",
    description: "Deep, resonant baritone with rich soul and emotional weight.",
    descriptionKo: "깊고 풍부한 성량을 가진 바리톤 톤입니다. 소울풀하고 묵직한 감성을 표현합니다.",
    genderTarget: "male",
    promptCore: "Deep resonant baritone, rich soul, thick vocal texture, emotional weight.",
    promptShort: "deep soulful male",
    isActive: true, isDefault: false, sortOrder: 5, genreTags: []
  },
  {
    id: "male_unique_low",
    label: "Male Unique Low",
    labelKo: "굵고 깊은 유니크 보컬",
    description: "Deep and distinctive male vocal with unique phrasing and resonant low color.",
    descriptionKo: "굵고 깊은 남성 톤에 독특한 창법이 더해진 보컬입니다. 서사적이고 강한 존재감에 적합합니다.",
    genderTarget: "male",
    promptCore: "Deep resonant male vocal tone, rich low vocal color, unique vocal phrasing, distinctive vocal tone.",
    promptShort: "deep unique male",
    isActive: true, isDefault: false, sortOrder: 6, genreTags: []
  },
  {
    id: "male_conversational",
    label: "Male Conversational",
    labelKo: "말하듯 부르는 남성 보컬",
    description: "Natural spoken-like male vocal phrasing with intimate storytelling delivery.",
    descriptionKo: "말하듯 자연스럽게 부르는 남성 톤입니다. 담담한 고백이나 스토리텔링에 잘 어울립니다.",
    genderTarget: "male",
    promptCore: "Conversational male singing style, natural spoken-like phrasing, intimate storytelling delivery.",
    promptShort: "spoken intimate male",
    isActive: true, isDefault: false, sortOrder: 7, genreTags: []
  },
  {
    id: "male_lazy_airy",
    label: "Male Lazy Airy",
    labelKo: "나른한 남성 보컬",
    description: "Relaxed and airy male vocal with lazy soft phrasing and low-pressure delivery.",
    descriptionKo: "힘을 뺀 듯 나른하게 부르는 남성 톤입니다. 시티팝, 인디, 몽환적인 곡에 적합합니다.",
    genderTarget: "male",
    promptCore: "Relaxed airy male delivery, lazy soft vocal tone, low-pressure phrasing.",
    promptShort: "relaxed airy male",
    isActive: true, isDefault: false, sortOrder: 8, genreTags: []
  },
  {
    id: "male_rnb_silky",
    label: "Male R&B Silky",
    labelKo: "매끄러운 남성 R&B 보컬",
    description: "Smooth, silky male R&B tone with melodic runs and falsetto transitions.",
    descriptionKo: "매끄럽고 부드러운 R&B 남성 톤입니다. 화려한 기교와 가성 전환이 특징입니다.",
    genderTarget: "male",
    promptCore: "Smooth silky male R&B vocal, agile melodic runs, seamless falsetto transitions.",
    promptShort: "smooth R&B male",
    isActive: true, isDefault: false, sortOrder: 9, genreTags: []
  },
  {
    id: "male_folk_earnest",
    label: "Male Folk Earnest",
    labelKo: "담백한 남성 포크 보컬",
    description: "Honest and raw male vocal with acoustic folk sensitivity.",
    descriptionKo: "솔직하고 꾸밈없는 남성 포크 톤입니다. 담백한 감성을 전달하기에 적합합니다.",
    genderTarget: "male",
    promptCore: "Raw earnest male folk delivery, warm mid-range, acoustic storytelling style.",
    promptShort: "raw folk male",
    isActive: true, isDefault: false, sortOrder: 10, genreTags: []
  },
  {
    id: "male_rock_grit",
    label: "Male Rock Grit",
    labelKo: "거친 남성 록 보컬",
    description: "Powerful and raspy rock vocal with high-energy shouting and distortion.",
    descriptionKo: "파워풀하고 거친 남성 록 보컬입니다. 강력한 샤우팅과 자연스러운 왜곡이 특징입니다.",
    genderTarget: "male",
    promptCore: "Powerful raspy male rock vocal, gritty edge, aggressive belting.",
    promptShort: "raspy rock male",
    isActive: true, isDefault: false, sortOrder: 11, genreTags: []
  },
  {
    id: "male_trot_vibrato",
    label: "Male Trot Vibrato",
    labelKo: "남성 트로트 꺾기 보컬",
    description: "Traditional Korean Trot style with unique vibrato and emotional inflection.",
    descriptionKo: "전통적인 남성 트로트 스타일입니다. 특유의 꺾기와 깊은 바이브레이션이 특징입니다.",
    genderTarget: "male",
    promptCore: "Male Korean Trot vocal style, heavy vibrato, emotional ggeok-gi technique.",
    promptShort: "trot vibrato male",
    isActive: true, isDefault: false, sortOrder: 12, genreTags: []
  },
  {
    id: "male_rap_aggressive",
    label: "Male Rap Aggressive",
    labelKo: "강렬한 남성 랩 보컬",
    description: "Tight, rhythmic male rap vocal with aggressive punch and clear flow.",
    descriptionKo: "타이트하고 리드미컬한 남성 랩 톤입니다. 공격적인 타격감과 선명한 플로우가 특징입니다.",
    genderTarget: "male",
    promptCore: "Aggressive male rhythmic rap flow, punchy delivery, sharp rap consonants.",
    promptShort: "aggressive rap male",
    isActive: true, isDefault: false, sortOrder: 13, genreTags: []
  },

  // =========================
  // FEMALE VOCAL TONES
  // =========================
  {
    id: "female_airy",
    label: "Female Airy",
    labelKo: "몽환적인 여성 에어리 보컬",
    description: "Airy and light female vocal tone with floating softness and gentle expression.",
    descriptionKo: "공기감이 느껴지는 가벼운 여성 톤입니다. 부드럽게 떠다니는 듯한 섬세한 표현이 특징입니다.",
    genderTarget: "female",
    promptCore: "Airy light female vocal, floating softness, gentle expression.",
    promptShort: "airy light female",
    isActive: true, isDefault: false, sortOrder: 14, genreTags: []
  },
  {
    id: "female_sweet",
    label: "Female Sweet",
    labelKo: "달콤하고 맑은 여성 보컬",
    description: "Sweet and bright female vocal tone with clear melodic charm.",
    descriptionKo: "달콤하고 밝은 여성 톤입니다. 맑고 매력적인 멜로디 표현에 적합합니다.",
    genderTarget: "female",
    promptCore: "Sweet bright female vocal, clear melodic charm.",
    promptShort: "sweet bright female",
    isActive: true, isDefault: false, sortOrder: 15, genreTags: []
  },
  {
    id: "female_clear",
    label: "Female Clear",
    labelKo: "깨끗하고 선명한 여성 보컬",
    description: "Clear and clean female vocal tone with balanced brightness and clarity.",
    descriptionKo: "깨끗하고 선명한 여성 톤입니다. 균형 잡힌 밝기와 명료함이 특징입니다.",
    genderTarget: "female",
    promptCore: "Clear clean female vocal, balanced brightness, clarity.",
    promptShort: "clear clean female",
    isActive: true, isDefault: false, sortOrder: 16, genreTags: []
  },
  {
    id: "female_unique_phrasing",
    label: "Female Unique Phrasing",
    labelKo: "독특한 창법의 여성 보컬",
    description: "Distinctive female vocal tone with unique phrasing and memorable character.",
    descriptionKo: "개성 있는 음색과 독특한 창법이 살아 있는 여성 보컬입니다. 곡의 캐릭터를 강하게 남깁니다.",
    genderTarget: "female",
    promptCore: "Unique female vocal phrasing, distinctive vocal tone, characterful vocal delivery.",
    promptShort: "unique phrasing female",
    isActive: true, isDefault: false, sortOrder: 17, genreTags: []
  },
  {
    id: "female_conversational",
    label: "Female Conversational",
    labelKo: "말하듯 부르는 여성 보컬",
    description: "Natural spoken-like female vocal phrasing with intimate storytelling expression.",
    descriptionKo: "말하듯 자연스럽게 부르는 여성 톤입니다. 담담하면서도 감정이 살아 있는 표현에 적합합니다.",
    genderTarget: "female",
    promptCore: "Conversational female singing style, natural spoken-like phrasing, intimate storytelling expression.",
    promptShort: "spoken intimate female",
    isActive: true, isDefault: false, sortOrder: 18, genreTags: []
  },
  {
    id: "female_lazy_airy",
    label: "Female Lazy Airy",
    labelKo: "나른한 여성 보컬",
    description: "Relaxed and airy female vocal with lazy soft phrasing and intimate tone.",
    descriptionKo: "힘을 뺀 듯 나른하게 부르는 여성 톤입니다. 시티팝, 인디, 몽환적인 곡에 적합합니다.",
    genderTarget: "female",
    promptCore: "Relaxed airy female delivery, lazy soft vocal tone, intimate low-pressure phrasing.",
    promptShort: "relaxed airy female",
    isActive: true, isDefault: false, sortOrder: 19, genreTags: []
  },
  {
    id: "female_whispery",
    label: "Female Whispery",
    labelKo: "속삭이듯 부르는 여성 보컬",
    description: "Whispery female vocal texture with breathy intimacy and delicate expression.",
    descriptionKo: "속삭이듯 가까이 들리는 여성 톤입니다. 숨결과 섬세한 감정을 강조합니다.",
    genderTarget: "female",
    promptCore: "Whispery female vocal texture, intimate breathy delivery, delicate expression.",
    promptShort: "whispery breathy female",
    isActive: true, isDefault: false, sortOrder: 20, genreTags: []
  },
  {
    id: "female_indie_dreamy",
    label: "Female Indie Dreamy",
    labelKo: "신비로운 여성 인디 보컬",
    description: "Whimsical and dreamy indie-pop female voice with a unique aesthetic.",
    descriptionKo: "신비롭고 몽환적인 인디 팝 여성 톤입니다. 독특한 음색으로 묘한 분위기를 만듭니다.",
    genderTarget: "female",
    promptCore: "Whimsical dreamy female indie-pop vocal, unique ethereal breathy tone.",
    promptShort: "dreamy indie female",
    isActive: true, isDefault: false, sortOrder: 21, genreTags: []
  },
  {
    id: "female_power_belter",
    label: "Female Power Belter",
    labelKo: "시원한 여성 파워 보컬",
    description: "High-energy, powerful female vocal with strong high notes and belting.",
    descriptionKo: "폭발적인 고음과 성량을 가진 여성 톤입니다. 시원하게 내지르는 스타일입니다.",
    genderTarget: "female",
    promptCore: "High-energy powerful female belting, open bright high notes, crystal clear high register.",
    promptShort: "powerful belting female",
    isActive: true, isDefault: false, sortOrder: 22, genreTags: []
  },
  {
    id: "female_jazz_velvet",
    label: "Female Jazz Velvet",
    labelKo: "매혹적인 여성 재즈 보컬",
    description: "Smoky, velvety female voice with sophisticated jazz phrasing.",
    descriptionKo: "스모키하고 부드러운 벨벳 질감의 여성 음색입니다. 세련된 재즈 감성을 전달합니다.",
    genderTarget: "female",
    promptCore: "Smoky velvety female tone, dark jazz phrasing, intimate low-mid color.",
    promptShort: "velvety jazz female",
    isActive: true, isDefault: false, sortOrder: 23, genreTags: []
  },
  {
    id: "female_rnb_soul",
    label: "Female R&B Soul",
    labelKo: "소울풀한 여성 R&B 보컬",
    description: "Soulful female R&B vocal with expressive runs, warm tone, and groove.",
    descriptionKo: "소울풀한 여성 R&B 톤입니다. 유연한 애드리브와 그루브 있는 표현에 적합합니다.",
    genderTarget: "female",
    promptCore: "Soulful female R&B vocal, expressive vocal runs, warm groovy phrasing.",
    promptShort: "soulful R&B female",
    isActive: true, isDefault: false, sortOrder: 24, genreTags: []
  },
  {
    id: "female_anime_sparkle",
    label: "Female Anime Sparkle",
    labelKo: "밝고 귀여운 캐릭터 보컬",
    description: "High-pitched, energetic character-style female vocal with bright and cute tone.",
    descriptionKo: "밝고 귀여운 캐릭터형 여성 톤입니다. 톡톡 튀는 에너지와 높은 톤이 특징입니다.",
    genderTarget: "female",
    promptCore: "High-pitched cute female character vocal, bright energetic J-Pop idol tone.",
    promptShort: "cute bright female",
    isActive: true, isDefault: false, sortOrder: 25, genreTags: []
  },
  {
    id: "female_trot_queen",
    label: "Female Trot Queen",
    labelKo: "여성 트로트 꺾기 보컬",
    description: "Elegant yet soulful female Trot vocal with masterful ggeok-gi technique.",
    descriptionKo: "우아하면서도 한이 담긴 여성 트로트 톤입니다. 숙련된 꺾기 기교가 특징입니다.",
    genderTarget: "female",
    promptCore: "Elegant soulful female trot vocal, sorrowful vibrato, masterful ggeok-gi technique.",
    promptShort: "elegant trot female",
    isActive: true, isDefault: false, sortOrder: 26, genreTags: []
  },
  {
    id: "female_rap_swagger",
    label: "Female Rap Swagger",
    labelKo: "스타일리시한 여성 랩 보컬",
    description: "Confident female rap vocal with stylish swagger and rhythmic versatility.",
    descriptionKo: "자신감 넘치는 여성 랩 톤입니다. 스타일리시한 스웨그와 리듬감이 특징입니다.",
    genderTarget: "female",
    promptCore: "Confident female rap swagger, stylish rhythmic flow, sassy rap delivery.",
    promptShort: "confident rap female",
    isActive: true, isDefault: false, sortOrder: 27, genreTags: []
  },

  // =========================
  // GROUP VOCAL TONES
  // =========================
  {
    id: "balanced_group",
    label: "Balanced Group",
    labelKo: "조화로운 그룹 보컬",
    description: "Balanced group vocal blend with well-mixed harmonies and cohesive ensemble sound.",
    descriptionKo: "균형 잡힌 그룹 보컬 블렌드입니다. 조화로운 화음과 일관된 앙상블 사운드를 제공합니다.",
    genderTarget: "group",
    promptCore: "Balanced group vocal blend, well-mixed harmonies, cohesive ensemble sound.",
    promptShort: "balanced group blend",
    isActive: true, isDefault: true, sortOrder: 28, genreTags: []
  },
  {
    id: "idol_group_harmony",
    label: "Idol Group Harmony",
    labelKo: "아이돌 그룹 화음",
    description: "Polished idol-style group vocals with synchronized harmonies and hook-focused delivery.",
    descriptionKo: "아이돌 스타일의 정돈된 그룹 보컬입니다. 싱크가 맞는 화음과 훅 중심의 전달력이 특징입니다.",
    genderTarget: "group",
    promptCore: "Polished idol-style group vocals, synchronized harmonies, hook-focused delivery.",
    promptShort: "polished idol group",
    isActive: true, isDefault: false, sortOrder: 29, genreTags: []
  },
  {
    id: "choir_cinematic",
    label: "Cinematic Choir",
    labelKo: "시네마틱 합창 보컬",
    description: "Large cinematic choir texture with dramatic ensemble weight and emotional scale.",
    descriptionKo: "웅장한 시네마틱 합창 톤입니다. 드라마틱한 스케일과 감정의 무게감을 더합니다.",
    genderTarget: "group",
    promptCore: "Large cinematic choir texture, dramatic ensemble weight, emotional scale.",
    promptShort: "cinematic choir",
    isActive: true, isDefault: false, sortOrder: 30, genreTags: []
  }
];
