import { SongResult } from '../types';
import { 
  GENRE_HIERARCHY, 
  GENRES, 
  MOODS, 
  THEMES, 
  SOUND_STYLES, 
  INSTRUMENT_SOUNDS,
  STYLE_VARIANT_LOOKUP,
  STYLE_LABEL_TO_ID,
  SOUND_VARIANT_LOOKUP,
  SOUND_LABEL_TO_ID
} from '../constants';

export interface DisplayKeywordItem {
  id: string;
  label: string;
  description?: string;
  isRandom?: boolean;
}

export interface DisplayKeywordSection {
  key: string;
  title: string;
  items: DisplayKeywordItem[];
  accent: 'default' | 'violet' | 'sky';
}

/**
 * Resolves a label from a raw ID or label string using metadata.
 */
export const getKeywordLabel = (idOrLabel: string): string => {
  if (!idOrLabel) return '';

  // 1. Check GENRE_HIERARCHY (recursive search for main and sub genres)
  for (const group of GENRE_HIERARCHY) {
    for (const main of group.children) {
      if (main.id === idOrLabel || main.label === idOrLabel) return main.label;
      if (main.children) {
        for (const sub of main.children) {
          if (sub.id === idOrLabel || sub.label === idOrLabel) return sub.label;
        }
      }
    }
  }

  // 2. Check standard flat lists
  const allItems = [...GENRES, ...MOODS, ...THEMES, ...SOUND_STYLES, ...INSTRUMENT_SOUNDS];
  const matched = allItems.find(item => item.id === idOrLabel || item.label === idOrLabel);
  if (matched) return matched.label;

  // 3. Fallback: Format raw string (e.g., "tropical-house" -> "Tropical House")
  return String(idOrLabel)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Resolves full metadata for a keyword.
 */
export const getKeywordMeta = (idOrLabel: string) => {
  const allItems = [
    ...GENRES, 
    ...MOODS, 
    ...THEMES, 
    ...SOUND_STYLES, 
    ...INSTRUMENT_SOUNDS
  ];
  
  // Try style/sound variants first as they are more specific
  const styleItem = STYLE_VARIANT_LOOKUP[STYLE_LABEL_TO_ID[idOrLabel] ?? idOrLabel];
  if (styleItem) return styleItem;
  
  const soundItem = SOUND_VARIANT_LOOKUP[SOUND_LABEL_TO_ID[idOrLabel] ?? idOrLabel];
  if (soundItem) return soundItem;

  // Check genre hierarchy
  for (const group of GENRE_HIERARCHY) {
    for (const main of group.children) {
      if (main.id === idOrLabel || main.label === idOrLabel) return main;
      const sub = main.children?.find(s => s.id === idOrLabel || s.label === idOrLabel);
      if (sub) return sub;
    }
  }

  return allItems.find(i => i.id === idOrLabel || i.label === idOrLabel);
};

/**
 * Resolves all keywords for display, following the Home screen logic.
 */
export const resolveKeywordsForDisplay = (song: Partial<SongResult> | any): DisplayKeywordSection[] => {
  if (!song?.appliedKeywords) return [];
  const ak = song.appliedKeywords;
  const rk = song.randomKeywords ?? [];

  const sections: DisplayKeywordSection[] = [
    {
      key: 'genre',
      title: 'genre',
      accent: 'default',
      items: ((ak.subGenre?.length > 0) ? ak.subGenre : (ak.genre ?? [])).map((kw: string) => {
        const meta = getKeywordMeta(kw);
        return {
          id: kw,
          label: meta?.label ?? kw,
          description: meta?.description,
          isRandom: rk.includes(meta?.label) || rk.includes(kw)
        };
      })
    },
    {
      key: 'theme',
      title: 'theme',
      accent: 'default',
      items: (ak.theme ?? []).map((kw: string) => {
        const meta = THEMES.find(i => i.id === kw || i.label === kw);
        return {
          id: kw,
          label: meta?.label ?? kw,
          description: meta?.description,
          isRandom: rk.includes(meta?.label) || rk.includes(kw)
        };
      })
    },
    {
      key: 'style',
      title: 'style',
      accent: 'violet',
      items: (ak.style ?? []).map((kw: string) => {
        const meta = STYLE_VARIANT_LOOKUP[STYLE_LABEL_TO_ID[kw] ?? kw];
        return {
          id: kw,
          label: meta?.label ?? kw,
          description: meta?.description,
          isRandom: rk.includes(meta?.label) || rk.includes(kw)
        };
      })
    },
    {
      key: 'mood',
      title: 'mood',
      accent: 'default',
      items: (ak.mood ?? []).map((kw: string) => {
        const meta = MOODS.find(i => i.id === kw || i.label === kw);
        return {
          id: kw,
          label: meta?.label ?? kw,
          description: meta?.description,
          isRandom: rk.includes(meta?.label) || rk.includes(kw)
        };
      })
    },
    {
      key: 'sound',
      title: 'sound / texture',
      accent: 'sky',
      items: (ak.instrumentSound ?? []).map((kw: string) => {
        const meta = SOUND_VARIANT_LOOKUP[SOUND_LABEL_TO_ID[kw] ?? kw];
        return {
          id: kw,
          label: meta?.label ?? kw,
          description: meta?.description,
          isRandom: rk.includes(meta?.label) || rk.includes(kw)
        };
      })
    }
  ];

  return sections.filter(s => s.items.length > 0);
};

/**
 * Extracts and resolves the most specific genre (Sub Genre) label.
 * Priority: subGenre > midGenre > genre > appliedKeywords (sub > mid > genre)
 */
export const getResolvedGenre = (song: Partial<SongResult> | any): string => {
  if (!song) return 'Song';

  const raw =
    song.subGenre ||
    song.midGenre ||
    song.genre ||
    song.appliedKeywords?.subGenre?.[0] ||
    song.appliedKeywords?.subGenreIds?.[0] ||
    song.appliedKeywords?.midGenre?.[0] ||
    song.appliedKeywords?.midGenreIds?.[0] ||
    song.appliedKeywords?.genre?.[0] ||
    '';

  if (!raw) {
    // Final fallback from title string if keywords are missing (legacy)
    const titleMatch = song.title?.match(/^\[([^\]]+)\]/);
    if (titleMatch?.[1]) return titleMatch[1];
    return 'Song';
  }

  const label = getKeywordLabel(raw);
  return label || 'Song';
};

/**
 * Formats a given raw title into a standard display string.
 * Result: [Genre] 'Title'
 */
export const formatDisplayTitle = (genre: string, rawTitle: string | undefined): string => {
  if (!rawTitle) return genre ? `[${genre}] 'Untitled'` : `'Untitled'`;
  
  let cleaned = rawTitle.replace(/^\[[^\]]+\]\s*/, '').trim();
  cleaned = cleaned.replace(/^['"]+|['"]+$/g, '').trim();
  
  if (!cleaned) cleaned = 'Untitled';
  
  if (genre) return `[${genre}] '${cleaned}'`;
  return `'${cleaned}'`;
};

/**
 * Extracts and resolves the most specific genre (Sub Genre) label.
 * @deprecated Use getResolvedGenre instead for clearer intent.
 */
export const getSubGenre = getResolvedGenre;

/**
 * Formats: "[장르] '한글제목'"
 */
export const formatKoreanTitle = (song: Partial<SongResult> | any): string => {
  const genre = getSubGenre(song);
  const rawKo = song.koreanTitle || (song.title?.includes('│') ? song.title.split('│')[1]?.trim() : song.title?.includes('|') ? song.title.split('|')[1]?.trim() : song.title);
  return formatDisplayTitle(genre, rawKo);
};

/**
 * Formats: "[장르] '영어제목'"
 */
export const formatEnglishTitle = (song: Partial<SongResult> | any): string => {
  const genre = getSubGenre(song);
  const rawEn = song.englishTitle || (song.title?.includes('│') ? song.title.split('│')[0]?.trim() : song.title?.includes('|') ? song.title.split('|')[0]?.trim() : song.title);
  return formatDisplayTitle(genre, rawEn);
};

/**
 * Formats: "[장르] '한글제목 | 영어제목'"
 */
export const formatInlineTitle = (song: Partial<SongResult> | any): string => {
  const genre = getSubGenre(song);
  const rawKo = song.koreanTitle || (song.title?.includes('│') ? song.title.split('│')[1]?.trim() : song.title?.includes('|') ? song.title.split('|')[1]?.trim() : song.title);
  const rawEn = song.englishTitle || (song.title?.includes('│') ? song.title.split('│')[0]?.trim() : song.title?.includes('|') ? song.title.split('|')[0]?.trim() : song.title);
  
  const ko = rawKo?.replace(/^\[[^\]]+\]\s*/, '').replace(/^['"]+|['"]+$/g, '').trim();
  const en = rawEn?.replace(/^\[[^\]]+\]\s*/, '').replace(/^['"]+|['"]+$/g, '').trim();
  
  if (ko && en && ko !== en) {
    return `[${genre}] '${ko} | ${en}'`;
  }
  return formatDisplayTitle(genre, ko || en || song.title);
};
