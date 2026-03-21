export type Category = 'genre' | 'mood' | 'theme';
export type LyricsLength = 'very-short' | 'short' | 'normal';
export type DrumStyle = 'none' | 'half-time' | 'double-time';
export type VocalGender = 'male' | 'female';

export interface SongResult {
  title: string;
  lyrics: {
    english: string;
    korean: string;
  };
  prompt: string;
  appliedKeywords: {
    genre: string[];
    mood: string[];
    theme: string[];
    tempo?: string;
    vocalGender?: string;
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
}