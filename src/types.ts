export type Category = 'genre' | 'mood' | 'theme';
export type LyricsLength = 'very-short' | 'short' | 'normal';
export type SongDuration = '1' | '2' | '3' | '4' | '5' | '6';
export type DrumStyle = 'none' | 'half-time' | 'double-time';
export type VocalType = string;

export interface GenreSubItem {
  id: string;
  label: string;
  description: string;
  promptCore: string;
}

export interface GenreGroup {
  id: string;
  label: string;
  description: string;
  children: GenreSubItem[];
}

export interface SoundStyleItem {
  id: string;
  label: string;
  description: string;
  promptCore: string;
}

export interface VocalConfig {
  male: number;
  female: number;
  rap: boolean;
}

export interface AppliedKeywords {
  genre: string[];
  mood: string[];
  theme: string[];
  style?: string[];
  tempo?: string;
  vocalType?: VocalType;
  lyricsLength?: LyricsLength;
  songDuration?: SongDuration;
  drumStyle?: DrumStyle;
  maleCount?: number;
  femaleCount?: number;
  rapEnabled?: boolean;
  vocal?: VocalConfig;
  isBallad?: boolean;
  soundStyle?: string | null;
  tempoConfig?: {
    enabled: boolean;
    min: number;
    max: number;
  };
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

export interface FavoriteSong extends SongResult {
  id: string;
  userId: string;
  createdAt: any;
}

export interface CategoryItem {
  id: string;
  label: string;
  description: string;
  _ts?: number;
}
