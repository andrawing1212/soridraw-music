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

export type Category = 'genre' | 'style' | 'mood';
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
  customStructure?: string[];
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
