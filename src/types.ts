export type Category = 'genre' | 'mood' | 'theme';
export type LyricsLength = 'very-short' | 'short' | 'normal';
export type DrumStyle = 'none' | 'half-time' | 'double-time';
export type VocalType = string;

export interface SongResult {
  title: string;
  lyrics: {
    english: string;
    korean: string;
  };
  prompt: string;
  createdAt?: number;
  appliedKeywords: {
    genre: string[];
    mood: string[];
    theme: string[];
    tempo?: string;
    vocalType?: VocalType;
    lyricsLength?: LyricsLength;
    drumStyle?: DrumStyle;
    maleCount?: number;
    femaleCount?: number;
    rapEnabled?: boolean;
    tempoConfig?: {
      enabled: boolean;
      min: number;
      max: number;
    };
  };
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
