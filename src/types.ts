export interface CategoryItem {
  id: string;
  label: string;
  labelKo?: string;
  description: string;
  descriptionKo?: string;
  promptCore?: string;
  _ts?: number;
}

export interface GenreGroup {
  id: string;
  label: string;
  labelKo?: string;
  description: string;
  descriptionKo?: string;
  children: CategoryItem[];
}

export interface SoundStyleItem extends CategoryItem {
  promptCore?: string;
}

export interface InstrumentSoundItem extends CategoryItem {
  promptCore?: string;
}

export interface SoundStyleCycle {
  id: string;
  title: string;
  titleKo?: string;
  variants: SoundStyleItem[];
}

export interface InstrumentSoundCycle {
  id: string;
  title: string;
  titleKo?: string;
  variants: InstrumentSoundItem[];
}

export type Category = 'genre' | 'style' | 'mood';
export type LyricsLength = 'very-short' | 'short' | 'normal' | 'long';
export type SongStructure = '1' | '2' | '3' | 'custom';

export type VocalMode = 'solo' | 'duo' | 'group';

export type VocalRole = 'main' | 'lead' | 'sub' | 'rapper';

export interface VocalMember {
  id: string;
  gender: 'male' | 'female';
  roles: VocalRole[];
  toneId?: string;
  tonePrompt?: string;
}

export interface VocalTone {
  id: string;
  label: string;
  labelKo?: string;
  description: string;
  descriptionKo?: string;
  genderTarget: 'male' | 'female' | 'unisex' | 'group' | 'any';
  toneType?: string;
  genreTags: string[];
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  promptCore?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VocalConfig {
  male: number;
  female: number;
  rap: boolean;
  mode?: VocalMode;
  globalToneId?: string;
  tonePrompt?: string;
  isToneSelected?: boolean;
  // Future expansion fields
  members?: VocalMember[];
  isGroup?: boolean;
}

export interface TempoConfig {
  enabled: boolean;
  min: number;
  max: number;
}

export interface CustomSectionItem {
  id: string;
  section: string;
  tags: string[];
}

export type GenreSubItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  vocal?: string;
};

export type GenreMainItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  vocal?: string;
  children: GenreSubItem[];
};

export type GenreGroupItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  children: GenreMainItem[];
};

export interface AppliedKeywords {
  genre: string[];
  subGenre?: string[];
  subGenreIds?: string[];
  mood: string[];
  theme: string[];
  style?: string[];
  instrumentSound?: string[];
  tempo?: string;
  tempoConfig?: TempoConfig | null;
  vocalType?: string;
  lyricsLength?: LyricsLength;
  songStructure?: SongStructure;
  customStructure?: CustomSectionItem[];
  kpopMode?: 0 | 1 | 2;
  isKoreanEnglishMix?: boolean;
  citypopMode?: 0 | 1 | 2;
  vocal?: VocalConfig;
  maleCount?: number;
  femaleCount?: number;
  rapEnabled?: boolean;
  drumStyle?: string;
  isBallad?: boolean;
}

export interface GenerateSongParams {
  genre: string;
  subGenre: string[];
  moods: string[];
  themes: string[];
  styles: string[];
  instrumentSounds: string[];
  tempo: string;
  vocal: VocalConfig;
  userInput?: string;
  songStructure?: SongStructure;
  customStructure?: CustomSectionItem[];
  lyricsLength?: LyricsLength;
  kpopMode?: 0 | 1 | 2;
}

export interface SongResult {
  title: string;
  lyrics: {
    english: string;
    korean: string;
  };
  prompt: string;
  appliedKeywords: AppliedKeywords;
  randomKeywords?: string[];
}
