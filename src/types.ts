export interface CategoryItem {
  id: string;
  label: string;
  description: string;
  promptCore?: string;
  _ts?: number;
}

export interface GenreGroup {
  id: string;
  label: string;
  description: string;
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
  variants: SoundStyleItem[];
}

export interface InstrumentSoundCycle {
  id: string;
  title: string;
  variants: InstrumentSoundItem[];
}

export type Category = 'genre' | 'style' | 'mood' | 'theme';
export type LyricsLength = 'very-short' | 'short' | 'normal' | 'long';
export type SongStructure = '1' | '2' | '3' | 'custom';

export interface VocalConfig {
  male: number;
  female: number;
  rap: boolean;
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

export interface AppliedKeywords {
  genre: string[];
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
  citypopMode?: 0 | 1 | 2;
  maleCount?: number;
  femaleCount?: number;
  rapEnabled?: boolean;
  drumStyle?: string;
  isBallad?: boolean;
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
