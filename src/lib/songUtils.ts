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

const CUSTOM_KEYWORD_PREFIX_RE = /^__custom_(?:genre|style|sound|mood|theme)__:(.*)$/;

const decodeSoridrawCustomKeyword = (value: unknown): string => {
  const raw = String(value || '').trim();
  const match = raw.match(CUSTOM_KEYWORD_PREFIX_RE);
  if (!match) return raw;
  try {
    return decodeURIComponent(match[1] || '').trim();
  } catch {
    return String(match[1] || '').trim();
  }
};

const isSoridrawCustomKeyword = (value: unknown): boolean => CUSTOM_KEYWORD_PREFIX_RE.test(String(value || '').trim());

/**
 * Resolves a label from a raw ID or label string using metadata.
 */
export const getKeywordLabel = (idOrLabel: string): string => {
  if (!idOrLabel) return '';

  const decodedCustom = decodeSoridrawCustomKeyword(idOrLabel);
  if (decodedCustom && decodedCustom !== idOrLabel) return decodedCustom;

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

const pickPrimaryGenreValue = (value: any): string => {
  if (Array.isArray(value)) {
    const first = value.find((item) => String(item || '').trim());
    return pickPrimaryGenreValue(first || '');
  }

  const text = decodeSoridrawCustomKeyword(value);
  if (!text) return '';

  const bracketMatch = text.match(/^\[([^\]]+)\]/);
  const genreText = bracketMatch?.[1] || text;
  const first = genreText
    .split(/\s*(?:,|·|\+)\s*/)
    .map((part) => part.trim())
    .find(Boolean);

  return first || genreText;
};

export const normalizeDisplayGenreLabel = (label: string): string => {
  const normalized = String(label || '')
    .replace(/^\[|\]$/g, '')
    .replace(/\bRnb\b/gi, 'R&B')
    .replace(/\bR\s*&\s*B\b/gi, 'R&B')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^Contemporary R&B$/i.test(normalized)) return 'R&B';
  return normalized;
};

const normalizeGenreKeywordLabel = (label: string): string => {
  return String(label || '')
    .replace(/^\[|\]$/g, '')
    .replace(/\bRnb\b/gi, 'R&B')
    .replace(/\bR\s*&\s*B\b/gi, 'R&B')
    .replace(/\s+/g, ' ')
    .trim();
};

const stripGenreDescription = (value: string): string => {
  const text = normalizeGenreKeywordLabel(value)
    .replace(/^genre\s*[:：-]\s*/i, '')
    .trim();

  if (!text) return '';

  const primary = text
    .split(/\s*(?:,|·|\+)\s*/)
    .map((part) => part.trim())
    .find(Boolean) || text;

  return primary
    .replace(/\s+(?:with|featuring|feat\.?|blended with|mixed with)\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractPromptGenreText = (song: Partial<SongResult> | any): string => {
  const promptText = String(song?.prompt || song?.finalPrompt || song?.generatedPrompt || '').trim();
  if (!promptText) return '';

  const genreLineMatch = promptText.match(/^\s*\[Genre\]\s*([^\n\r]+)/im);
  if (genreLineMatch?.[1]) {
    return stripGenreDescription(genreLineMatch[1]);
  }

  const inlineMatch = promptText.match(/\[Genre\]\s*([^\n\r]+)/i);
  return inlineMatch?.[1] ? stripGenreDescription(inlineMatch[1]) : '';
};

const resolvePromptGenreItem = (song: Partial<SongResult> | any): DisplayKeywordItem[] => {
  const promptGenre = extractPromptGenreText(song);
  if (!promptGenre) return [];

  const label = normalizeGenreKeywordLabel(getKeywordLabel(promptGenre) || promptGenre);
  return label ? [{ id: `prompt-genre-${label}`, label, description: 'Prompt Genre' }] : [];
};


const resolveSituationDisplayItem = (ak: any): DisplayKeywordItem[] => {
  const summary = ak?.situationSummary || ak?.situation?.summary;
  const situation = ak?.situation;
  if (!summary && !situation) return [];

  const relation = [situation?.targetA, situation?.targetB].filter(Boolean).join(' vs ');
  const version = situation?.versionLabel || situation?.version;
  const label = String(summary || [relation, situation?.relationship, version].filter(Boolean).join(' / ') || situation?.description || 'Situation').trim();
  const description = [
    situation?.description,
    situation?.development,
    situation?.details,
  ].filter(Boolean).join(' / ');

  return label ? [{ id: 'situation', label, description }] : [];
};

/**
 * Resolves all keywords for display, following the Home screen logic.
 */
export const resolveKeywordsForDisplay = (song: Partial<SongResult> | any): DisplayKeywordSection[] => {
  const ak = song?.appliedKeywords ?? {};
  const rk = song?.randomKeywords ?? [];
  const selectedGenreItems = ((ak.subGenre?.length > 0) ? ak.subGenre : (ak.genre ?? [])).map((kw: string) => {
    const decoded = decodeSoridrawCustomKeyword(kw);
    const meta = getKeywordMeta(decoded);
    return {
      id: kw,
      label: normalizeGenreKeywordLabel(meta?.label ?? decoded),
      description: meta?.description,
      isRandom: rk.includes(meta?.label) || rk.includes(kw) || rk.includes(decoded)
    };
  });

  const sections: DisplayKeywordSection[] = [
    {
      key: 'genre',
      title: 'genre',
      accent: 'default',
      items: selectedGenreItems.length > 0 ? selectedGenreItems : resolvePromptGenreItem(song)
    },
    {
      key: 'situation',
      title: 'situation',
      accent: 'sky',
      items: resolveSituationDisplayItem(ak)
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
        const decoded = decodeSoridrawCustomKeyword(kw);
        const meta = STYLE_VARIANT_LOOKUP[STYLE_LABEL_TO_ID[decoded] ?? decoded];
        return {
          id: kw,
          label: meta?.label ?? decoded,
          description: meta?.description,
          isRandom: rk.includes(meta?.label) || rk.includes(kw) || rk.includes(decoded)
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
        const decoded = decodeSoridrawCustomKeyword(kw);
        const meta = SOUND_VARIANT_LOOKUP[SOUND_LABEL_TO_ID[decoded] ?? decoded];
        return {
          id: kw,
          label: meta?.label ?? decoded,
          description: meta?.description,
          isRandom: rk.includes(meta?.label) || rk.includes(kw) || rk.includes(decoded)
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

  const hasCustomGenreInput = Boolean(
    String(song.appliedKeywords?.customGenreInput || '').trim() ||
    isSoridrawCustomKeyword(song.genre) ||
    (Array.isArray(song.subGenre) && song.subGenre.some(isSoridrawCustomKeyword)) ||
    (Array.isArray(song.appliedKeywords?.subGenre) && song.appliedKeywords.subGenre.some(isSoridrawCustomKeyword))
  );

  const defaultCandidates = [
    song.subGenre,
    song.midGenre,
    song.genre,
    song.appliedKeywords?.subGenre?.[0],
    song.appliedKeywords?.subGenreIds?.[0],
    song.appliedKeywords?.midGenre?.[0],
    song.appliedKeywords?.midGenreIds?.[0],
    song.appliedKeywords?.genre?.[0],
    extractPromptGenreText(song),
  ];

  const rawCandidates = hasCustomGenreInput
    ? [
        extractPromptGenreText(song),
        song.appliedKeywords?.customGenreInput,
        song.subGenre,
        song.genre,
        song.appliedKeywords?.subGenre?.[0],
        song.appliedKeywords?.genre?.[0],
      ]
    : defaultCandidates;

  const raw = rawCandidates
    .map((value) => stripGenreDescription(pickPrimaryGenreValue(value)))
    .find((value) => Boolean(value));

  if (!raw) {
    // Final fallback from title string if keywords are missing (legacy)
    const titleMatch = song.title?.match(/^\[([^\]]+)\]/);
    if (titleMatch?.[1]) {
      const fallbackGenre = pickPrimaryGenreValue(titleMatch[1]);
      return normalizeDisplayGenreLabel(getKeywordLabel(fallbackGenre) || fallbackGenre) || 'Song';
    }
    return 'Song';
  }

  const label = getKeywordLabel(raw);
  return normalizeDisplayGenreLabel(label || raw) || 'Song';
};

/**
 * Formats a given raw title into a standard display string.
 * Result: [Genre] Title
 */
export const formatDisplayTitle = (genre: string, rawTitle: string | undefined): string => {
  if (!rawTitle) return genre ? `[${genre}] Untitled` : 'Untitled';
  
  let cleaned = rawTitle.replace(/^\[[^\]]+\]\s*/, '').trim();
  cleaned = cleaned.replace(/^['"]+|['"]+$/g, '').trim();
  
  if (!cleaned) cleaned = 'Untitled';
  
  if (genre) return `[${genre}] ${cleaned}`;
  return cleaned;
};

/**
 * Extracts and resolves the most specific genre (Sub Genre) label.
 * @deprecated Use getResolvedGenre instead for clearer intent.
 */
export const getSubGenre = getResolvedGenre;

/**
 * Formats: "[장르] 한글제목"
 */
export const formatKoreanTitle = (song: Partial<SongResult> | any): string => {
  const genre = getSubGenre(song);
  const rawKo = song.koreanTitle || (song.title?.includes('│') ? song.title.split('│')[1]?.trim() : song.title?.includes('|') ? song.title.split('|')[1]?.trim() : song.title);
  return formatDisplayTitle(genre, rawKo);
};

/**
 * Formats: "[장르] 영어제목"
 */
export const formatEnglishTitle = (song: Partial<SongResult> | any): string => {
  const genre = getSubGenre(song);
  const rawEn = song.englishTitle || (song.title?.includes('│') ? song.title.split('│')[0]?.trim() : song.title?.includes('|') ? song.title.split('|')[0]?.trim() : song.title);
  return formatDisplayTitle(genre, rawEn);
};

/**
 * Formats: "[장르] 한글제목 | 영어제목"
 */
export const formatInlineTitle = (song: Partial<SongResult> | any): string => {
  const genre = getSubGenre(song);
  const rawKo = song.koreanTitle || (song.title?.includes('│') ? song.title.split('│')[1]?.trim() : song.title?.includes('|') ? song.title.split('|')[1]?.trim() : song.title);
  const rawEn = song.englishTitle || (song.title?.includes('│') ? song.title.split('│')[0]?.trim() : song.title?.includes('|') ? song.title.split('|')[0]?.trim() : song.title);
  
  const ko = rawKo?.replace(/^\[[^\]]+\]\s*/, '').replace(/^['"]+|['"]+$/g, '').trim();
  const en = rawEn?.replace(/^\[[^\]]+\]\s*/, '').replace(/^['"]+|['"]+$/g, '').trim();
  
  if (ko && en && ko !== en) {
    return `[${genre}] ${ko} | ${en}`;
  }
  return formatDisplayTitle(genre, ko || en || song.title);
};

/**
 * Sanitizes a string for use as a filename.
 */
export const sanitizeFileName = (name: string) => {
  if (!name) return '';
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
};

/**
 * Extracts the audio extension from a URL.
 */
export const getAudioExtension = (url: string) => {
  if (!url) return 'mp3';
  const cleanUrl = url.split('?')[0];
  const match = cleanUrl.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i);
  return match ? match[1].toLowerCase() : 'mp3';
};

/**
 * Downloads an audio file with a specific title using fetch and blob.
 */
export const downloadAudioWithTitle = async (url: string, title?: string) => {
  if (!url) return;

  const safeTitle = sanitizeFileName(title || 'SORIDRAW') || 'SORIDRAW';
  const ext = getAudioExtension(url);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Audio download failed');

    const blob = await response.blob();
    if (!blob || blob.size <= 0) throw new Error('Audio download is empty');
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${safeTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download error:', error);
    alert('다운로드에 실패했습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.');
  }
};
