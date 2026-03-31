export type Category = 'genre' | 'style' | 'mood';
export type LyricsLength = 'very-short' | 'short' | 'normal';
export type SongDuration = '1' | '2' | '3' | '4' | '5' | '6';

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

export interface SoundStyleItem {
  id: string;
  label: string;
  description: string;
  promptCore: string;
}

export interface SoundStyleCycle {
  id: string;
  title: string;
  variants: SoundStyleItem[];
}

export interface InstrumentSoundItem {
  id: string;
  label: string;
  description: string;
  promptCore: string;
}

export interface InstrumentSoundCycle {
  id: string;
  title: string;
  variants: InstrumentSoundItem[];
}

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
  songDuration?: SongDuration;
  maleCount?: number;
  femaleCount?: number;
  rapEnabled?: boolean;
  kpopMode?: 0 | 1 | 2;
  citypopMode?: 0 | 1 | 2;
  drumStyle?: string;
  isBallad?: boolean;
  customStructure?: string[];
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
