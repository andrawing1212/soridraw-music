export type Category = 'genre' | 'style' | 'mood';
export type LyricsLength = 'very-short' | 'short' | 'normal' | 'long';
export type SongDuration = '1' | '2' | '3' | '4' | '5' | '6';

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
