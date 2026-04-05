import { VocalTone } from '../types';

export const VOCAL_TONES: VocalTone[] = [
  {
    id: "male_husky",
    label: "Male Husky",
    labelKo: "남성 허스키",
    description: "Husky male vocal tone with textured low-mid presence and emotional grit.",
    descriptionKo: "거칠고 허스키한 남성 톤입니다. 중저음의 질감과 감정적인 호소력이 특징입니다.",
    genderTarget: "male",
    promptCore: "Husky male vocal tone with textured low-mid presence and emotional grit.",
    isActive: true,
    isDefault: false,
    sortOrder: 1,
    genreTags: []
  },
  {
    id: "male_soft",
    label: "Male Soft",
    labelKo: "남성 소프트",
    description: "Soft and warm male vocal tone with smooth delivery and emotional subtlety.",
    descriptionKo: "부드럽고 따뜻한 남성 톤입니다. 매끄러운 전달력과 섬세한 감정 표현이 특징입니다.",
    genderTarget: "male",
    promptCore: "Soft and warm male vocal tone with smooth delivery and emotional subtlety.",
    isActive: true,
    isDefault: false,
    sortOrder: 2,
    genreTags: []
  },
  {
    id: "male_sharp",
    label: "Male Sharp",
    labelKo: "남성 샤프",
    description: "Sharp and clear male vocal tone with crisp articulation and bright presence.",
    descriptionKo: "날카롭고 선명한 남성 톤입니다. 또렷한 발음과 밝은 존재감이 특징입니다.",
    genderTarget: "male",
    promptCore: "Sharp and clear male vocal tone with crisp articulation and bright presence.",
    isActive: true,
    isDefault: false,
    sortOrder: 3,
    genreTags: []
  },
  {
    id: "male_breathy",
    label: "Male Breathy",
    labelKo: "남성 브리디",
    description: "Breathy male vocal tone with airy texture and intimate delivery.",
    descriptionKo: "숨소리가 섞인 공기 반 소리 반 남성 톤입니다. 친밀하고 부드러운 느낌을 줍니다.",
    genderTarget: "male",
    promptCore: "Breathy male vocal tone with airy texture and intimate delivery.",
    isActive: true,
    isDefault: false,
    sortOrder: 4,
    genreTags: []
  },
  {
    id: "female_airy",
    label: "Female Airy",
    labelKo: "여성 에어리",
    description: "Airy and light female vocal tone with floating softness and gentle expression.",
    descriptionKo: "공기감이 느껴지는 가벼운 여성 톤입니다. 부드럽게 떠다니는 듯한 섬세한 표현이 특징입니다.",
    genderTarget: "female",
    promptCore: "Airy and light female vocal tone with floating softness and gentle expression.",
    isActive: true,
    isDefault: false,
    sortOrder: 5,
    genreTags: []
  },
  {
    id: "female_sweet",
    label: "Female Sweet",
    labelKo: "여성 스위트",
    description: "Sweet and bright female vocal tone with clear melodic charm.",
    descriptionKo: "달콤하고 밝은 여성 톤입니다. 맑고 매력적인 멜로디 표현에 적합합니다.",
    genderTarget: "female",
    promptCore: "Sweet and bright female vocal tone with clear melodic charm.",
    isActive: true,
    isDefault: false,
    sortOrder: 6,
    genreTags: []
  },
  {
    id: "female_clear",
    label: "Female Clear",
    labelKo: "여성 클리어",
    description: "Clear and clean female vocal tone with balanced brightness and clarity.",
    descriptionKo: "깨끗하고 선명한 여성 톤입니다. 균형 잡힌 밝기와 명료함이 특징입니다.",
    genderTarget: "female",
    promptCore: "Clear and clean female vocal tone with balanced brightness and clarity.",
    isActive: true,
    isDefault: false,
    sortOrder: 7,
    genreTags: []
  },
  {
    id: "balanced_group",
    label: "Balanced Group",
    labelKo: "밸런스드 그룹",
    description: "Balanced group vocal blend with well-mixed harmonies and cohesive ensemble sound.",
    descriptionKo: "균형 잡힌 그룹 보컬 블렌드입니다. 조화로운 화음과 일관된 앙상블 사운드를 제공합니다.",
    genderTarget: "group",
    promptCore: "Balanced group vocal blend with well-mixed harmonies and cohesive ensemble sound.",
    isActive: true,
    isDefault: true,
    sortOrder: 8,
    genreTags: []
  }
];
