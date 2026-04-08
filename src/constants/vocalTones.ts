import { VocalTone } from '../types';

export const VOCAL_TONES: VocalTone[] = [
  // --- 기존 리스트 (1~8번) ---
  {
    id: "male_husky",
    label: "Male Husky",
    labelKo: "호소력 짙은 허스키",
    description: "Husky male vocal tone with textured low-mid presence and emotional grit.",
    descriptionKo: "거칠고 허스키한 남성 톤입니다. 중저음의 질감과 감정적인 호소력이 특징입니다.",
    genderTarget: "male",
    promptCore: "Husky male vocal tone, textured low-mid, emotional grit.",
    isActive: true, isDefault: false, sortOrder: 1, genreTags: []
  },
  {
    id: "male_soft",
    label: "Male Soft",
    labelKo: "따뜻하고 부드러운 톤",
    description: "Soft and warm male vocal tone with smooth delivery and emotional subtlety.",
    descriptionKo: "부드럽고 따뜻한 남성 톤입니다. 매끄러운 전달력과 섬세한 감정 표현이 특징입니다.",
    genderTarget: "male",
    promptCore: "Soft warm male vocal, smooth delivery, emotional subtlety.",
    isActive: true, isDefault: false, sortOrder: 2, genreTags: []
  },
  {
    id: "male_sharp",
    label: "Male Sharp",
    labelKo: "선명하고 날카로운 톤",
    description: "Sharp and clear male vocal tone with crisp articulation and bright presence.",
    descriptionKo: "날카롭고 선명한 남성 톤입니다. 또렷한 발음과 밝은 존재감이 특징입니다.",
    genderTarget: "male",
    promptCore: "Sharp clear male vocal, crisp articulation, bright presence.",
    isActive: true, isDefault: false, sortOrder: 3, genreTags: []
  },
  {
    id: "male_breathy",
    label: "Male Breathy",
    labelKo: "촉촉한 숨소리 톤",
    description: "Breathy male vocal tone with airy texture and intimate delivery.",
    descriptionKo: "숨소리가 섞인 공기 반 소리 반 남성 톤입니다. 친밀하고 부드러운 느낌을 줍니다.",
    genderTarget: "male",
    promptCore: "Breathy male vocal, airy texture, intimate delivery.",
    isActive: true, isDefault: false, sortOrder: 4, genreTags: []
  },
  {
    id: "female_airy",
    label: "Female Airy",
    labelKo: "몽환적인 에어리 톤",
    description: "Airy and light female vocal tone with floating softness and gentle expression.",
    descriptionKo: "공기감이 느껴지는 가벼운 여성 톤입니다. 부드럽게 떠다니는 듯한 섬세한 표현이 특징입니다.",
    genderTarget: "female",
    promptCore: "Airy light female vocal, floating softness, gentle expression.",
    isActive: true, isDefault: false, sortOrder: 5, genreTags: []
  },
  {
    id: "female_sweet",
    label: "Female Sweet",
    labelKo: "달콤하고 맑은 고음",
    description: "Sweet and bright female vocal tone with clear melodic charm.",
    descriptionKo: "달콤하고 밝은 여성 톤입니다. 맑고 매력적인 멜로디 표현에 적합합니다.",
    genderTarget: "female",
    promptCore: "Sweet bright female vocal, clear melodic charm.",
    isActive: true, isDefault: false, sortOrder: 6, genreTags: []
  },
  {
    id: "female_clear",
    label: "Female Clear",
    labelKo: "깨끗하고 선명한 톤",
    description: "Clear and clean female vocal tone with balanced brightness and clarity.",
    descriptionKo: "깨끗하고 선명한 여성 톤입니다. 균형 잡힌 밝기와 명료함이 특징입니다.",
    genderTarget: "female",
    promptCore: "Clear clean female vocal, balanced brightness, clarity.",
    isActive: true, isDefault: false, sortOrder: 7, genreTags: []
  },
  {
    id: "balanced_group",
    label: "Balanced Group",
    labelKo: "조화로운 그룹 보컬",
    description: "Balanced group vocal blend with well-mixed harmonies and cohesive ensemble sound.",
    descriptionKo: "균형 잡힌 그룹 보컬 블렌드입니다. 조화로운 화음과 일관된 앙상블 사운드를 제공합니다.",
    genderTarget: "group",
    promptCore: "Balanced group vocal blend, well-mixed harmonies, cohesive sound.",
    isActive: true, isDefault: true, sortOrder: 8, genreTags: []
  },
  // --- 새로운 추가 리스트 (9~20번) ---
  {
    id: "male_deep_soul",
    label: "Male Deep Soul",
    labelKo: "묵직하고 풍부한 성량",
    description: "Deep, resonant baritone with rich soul and emotional weight.",
    descriptionKo: "깊고 풍부한 성량을 가진 바리톤 톤입니다. 소울풀하고 묵직한 감성을 표현합니다.",
    genderTarget: "male",
    promptCore: "Deep resonant baritone, soul-heavy, thick vocal texture.",
    isActive: true, isDefault: false, sortOrder: 9, genreTags: []
  },
  {
    id: "male_rock_grit",
    label: "Male Rock Grit",
    labelKo: "강력한 록 샤우팅",
    description: "Powerful and raspy rock vocal with high-energy shouting and distortion.",
    descriptionKo: "파워풀하고 거친 록 보컬입니다. 강력한 샤우팅과 자연스러운 왜곡이 특징입니다.",
    genderTarget: "male",
    promptCore: "Powerful raspy rock vocal, gritty edge, aggressive belting.",
    isActive: true, isDefault: false, sortOrder: 10, genreTags: []
  },
  {
    id: "male_trot_vibrato",
    label: "Male Trot Vibrato",
    labelKo: "남성 트로트 전문",
    description: "Traditional Korean Trot style with unique vibrato and emotional inflection.",
    descriptionKo: "전통적인 트로트 스타일입니다. 특유의 꺾기와 깊은 바이브레이션이 특징입니다.",
    genderTarget: "male",
    promptCore: "Korean Trot style, heavy vibrato, emotional ggeok-gi technique.",
    isActive: true, isDefault: false, sortOrder: 11, genreTags: []
  },
  {
    id: "female_power_belter",
    label: "Female Power Belter",
    labelKo: "시원한 파워 고음",
    description: "High-energy, powerful female vocal with strong high notes and belting.",
    descriptionKo: "폭발적인 고음과 성량을 가진 여성 톤입니다. 시원하게 내지르는 스타일입니다.",
    genderTarget: "female",
    promptCore: "High-energy powerful belting, crystal clear high notes.",
    isActive: true, isDefault: false, sortOrder: 12, genreTags: []
  },
  {
    id: "female_jazz_velvet",
    label: "Female Jazz Velvet",
    labelKo: "매혹적인 재즈 톤",
    description: "Smoky, velvety female voice with sophisticated jazz phrasing.",
    descriptionKo: "스모키하고 부드러운 벨벳 질감의 음색입니다. 세련된 재즈 감성을 전달합니다.",
    genderTarget: "female",
    promptCore: "Smoky velvety tone, dark jazz phrasing, intimate low-mid.",
    isActive: true, isDefault: false, sortOrder: 13, genreTags: []
  },
  {
    id: "female_anime_sparkle",
    label: "Female Anime Sparkle",
    labelKo: "여자 애니 캐릭터 톤",
    description: "High-pitched, energetic anime-style female vocal with bright and cute character.",
    descriptionKo: "밝고 귀여운 캐릭터의 애니메이션 스타일 톤입니다. 톡톡 튀는 에너지가 특징입니다.",
    genderTarget: "female",
    promptCore: "High-pitched cute anime character, energetic J-Pop idol tone.",
    isActive: true, isDefault: false, sortOrder: 14, genreTags: []
  },
  {
    id: "female_trot_queen",
    label: "Female Trot Queen",
    labelKo: "여성 트로트 전문",
    description: "Elegant yet soulful female Trot vocal with masterful 'Ggeok-gi' technique.",
    descriptionKo: "우아하면서도 한이 담긴 여성 트로트 톤입니다. 숙련된 꺾기 기교가 특징입니다.",
    genderTarget: "female",
    promptCore: "Elegant soulful trot vocal, masterful sorrowful vibrato.",
    isActive: true, isDefault: false, sortOrder: 15, genreTags: []
  },
  {
    id: "male_rnb_silky",
    label: "Male R&B Silky",
    labelKo: "매끄러운 R&B 보이스",
    description: "Smooth, silky male R&B tone with melodic runs and falsetto transitions.",
    descriptionKo: "매끄럽고 부드러운 R&B 톤입니다. 화려한 기교와 가성 전환이 특징입니다.",
    genderTarget: "male",
    promptCore: "Smooth silky R&B runs, agile riffs, seamless falsetto.",
    isActive: true, isDefault: false, sortOrder: 16, genreTags: []
  },
  {
    id: "male_folk_earnest",
    label: "Male Folk Earnest",
    labelKo: "담백한 포크 보이스",
    description: "Honest and raw male vocal with acoustic folk sensitivity.",
    descriptionKo: "솔직하고 꾸밈없는 남성 포크 톤입니다. 담백한 감성을 전달하기에 적합합니다.",
    genderTarget: "male",
    promptCore: "Raw earnest folk delivery, warm mid-range, storytelling style.",
    isActive: true, isDefault: false, sortOrder: 17, genreTags: []
  },
  {
    id: "female_indie_dreamy",
    label: "Female Indie Dreamy",
    labelKo: "신비로운 인디 감성",
    description: "Whimsical and dreamy indie-pop female voice with a unique aesthetic.",
    descriptionKo: "신비롭고 몽환적인 인디 팝 톤입니다. 독특한 음색으로 묘한 분위기를 만듭니다.",
    genderTarget: "female",
    promptCore: "Whimsical dreamy indie-pop, unique ethereal breathy tone.",
    isActive: true, isDefault: false, sortOrder: 18, genreTags: []
  },
  {
    id: "male_rap_aggressive",
    label: "Male Rap Aggressive",
    labelKo: "강렬한 랩 타격감",
    description: "Tight, rhythmic male rap vocal with aggressive punch and clear flow.",
    descriptionKo: "타이트하고 리드미컬한 랩 톤입니다. 공격적인 타격감과 선명한 플로우가 특징입니다.",
    genderTarget: "male",
    promptCore: "Aggressive rhythmic flow, punchy delivery, sharp rap consonants.",
    isActive: true, isDefault: false, sortOrder: 19, genreTags: []
  },
  {
    id: "female_rap_swagger",
    label: "Female Rap Swagger",
    labelKo: "스타일리시한 랩 스웨그",
    description: "Confident female rap vocal with stylish swagger and rhythmic versatility.",
    descriptionKo: "자신감 넘치는 여성 랩 톤입니다. 스타일리시한 스웨그와 리듬감이 특징입니다.",
    genderTarget: "female",
    promptCore: "Confident female swagger, stylish rhythmic flow, sassy rap.",
    isActive: true, isDefault: false, sortOrder: 20, genreTags: []
  }
];
