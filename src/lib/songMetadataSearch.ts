// Search ONLY fields already available in the current user-owned/publicly
// visible list item. Never hydrate every canonical Firestore document on input,
// persist a lyrics index, or forward private lyrics into a Catalog/RTDB signal.
import { getKeywordMeta } from './songUtils';

type SearchRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is SearchRecord =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const normalize = (v: string): string =>
  v.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

// A bounded memo avoids repeatedly rebuilding keyword dictionaries when the
// user types into a list with hundreds of tracks.
const keywordLabels = new Map<string, string[]>();
const aliasesForKeyword = (word: string): string[] => {
  if (!word || word.length > 120) return [];
  const saved = keywordLabels.get(word);
  if (saved) return saved;
  let labels: string[] = [];
  try {
    const meta = getKeywordMeta(word);
    labels = [meta?.label, meta?.labelKo].filter((v): v is string => typeof v === 'string' && !!v.trim());
    const custom = word.match(/^__custom_(?:genre|style|sound|mood|theme)__:(.*)$/);
    if (custom) {
      try { labels.push(decodeURIComponent(custom[1])); }
      catch { labels.push(custom[1]); }
    }
  } catch { /* An unknown/legacy keyword is still searchable by its raw value. */ }
  if (keywordLabels.size >= 700) keywordLabels.clear();
  keywordLabels.set(word, labels);
  return labels;
};

const LOOKUP_FIELDS = [
  'title', 'koreanTitle', 'englishTitle', 'displayTitle', 'genre',
  'displayGenre', 'genreLabels', 'style', 'tags', 'prompt', 'finalPrompt',
  'lyrics', 'lyricsText', 'lyricText', 'generatedLyrics', 'originalLyrics',
  'appliedKeywords', 'searchTokens', 'sunoData',
] as const;

const ITEM_FIELDS = [
  'title', 'koreanTitle', 'englishTitle', 'genre', 'style', 'tags',
  'prompt', 'lyrics', 'lyricsText', 'lyricText', 'appliedKeywords',
  'genreLabels', 'searchTokens',
] as const;

const KEYWORD_FIELDS = [
  'genre', 'subGenre', 'subGenreIds', 'style', 'instrumentSound', 'sound',
  'mood', 'theme', 'situation', 'situationSummary', 'vocalType', 'vocalTone',
  'userInput', 'customGenreInput', 'customStyleInput', 'customSoundInput',
  'customMoodInput', 'customThemeInput', 'lyricDraft',
] as const;


// The same filtered list is evaluated repeatedly while the director selects
// songs, opens a move dialog or moves the split pane. A full lyric/metadata
// walk on every unrelated React render causes noticeable input latency.
// Remember only the LAST query result per actual list item (WeakMap), and
// invalidate whenever any search-bearing field is replaced/updated.
const CACHE_FIELDS = [...new Set<string>([
  ...LOOKUP_FIELDS, ...KEYWORD_FIELDS, 'updatedAt', 'updatedAtMs',
  'keywordDetails', 'keywordSections', 'requestPayload', 'metadataVersion',
])];
type SearchHitMemo = { query: string; fields: readonly unknown[]; hit: boolean };
const lastSearchHit = new WeakMap<SearchRecord, SearchHitMemo>();
const normalizedQueryMemo = new Map<string, string>();
const normalizeSearchQuery = (input: string): string => {
  const cached = normalizedQueryMemo.get(input);
  if (cached !== undefined) return cached;
  const normalized = normalize(input);
  if (normalizedQueryMemo.size >= 24) normalizedQueryMemo.clear();
  normalizedQueryMemo.set(input, normalized);
  return normalized;
};
const sameSearchFields = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

/**
 * Case-insensitive partial phrase search across existing titles, selected
 * keywords, prompts and stored lyrics. This is a pure, bounded local filter:
 * it cannot find text missing from a compact historical Catalog summary.
 */
export const matchesStoredSongSearch = (
  source: unknown,
  search: string,
  extraFields: readonly unknown[] | (() => readonly unknown[]) = [],
): boolean => {
  const query = normalizeSearchQuery(search || '');
  if (!query) return true;
  // The optional producer is evaluated only on a cache MISS. This is
  // essential for Music Note: resolving displayed genre/keyword metadata for
  // every song on every checkbox click was the main slowdown.
  const record = isRecord(source) ? source : null;
  const searchFields = record
    ? [...CACHE_FIELDS.map(key => record[key]),
      ...(Array.isArray(extraFields) ? extraFields : [])]
    : null;
  const previous = record ? lastSearchHit.get(record) : null;
  if (previous && searchFields && previous.query === query
    && sameSearchFields(previous.fields, searchFields)) return previous.hit;
  let visited = 0;
  const matches = (value: unknown, keyword = false, depth = 0): boolean => {
    if (++visited > 650 || depth > 6 || value == null) return false;
    if (typeof value === 'string') {
      const text = value.slice(0, 100_000);
      if (normalize(text).includes(query)) return true;
      return keyword && aliasesForKeyword(text.trim()).some(label => normalize(label).includes(query));
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 90)) if (matches(item, keyword, depth + 1)) return true;
      return false;
    }
    if (!isRecord(value)) return false;
    // For keyword and lyric objects accept their nested language/variant names;
    // avoid walking unrelated URL, identity, image and API response fields.
    for (const item of Object.values(value).slice(0, 90)) {
      if (matches(item, keyword, depth + 1)) return true;
    }
    return false;
  };
  if (!record) return matches(source);
  const evaluate = (): boolean => {
    for (const field of LOOKUP_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(record, field)) continue;
      if (field === 'sunoData') {
        const items = record.sunoData;
        if (Array.isArray(items)) {
          for (const item of items.slice(0, 12)) {
            if (!isRecord(item)) continue;
            for (const name of ITEM_FIELDS) {
              if (matches(item[name], name === 'appliedKeywords' || name === 'genre' || name === 'genreLabels' || name === 'style' || name === 'tags')) return true;
            }
          }
        }
        continue;
      }
      const keyword = field === 'appliedKeywords' || field === 'genre' || field === 'genreLabels' || field === 'style' || field === 'tags';
      if (matches(record[field], keyword)) return true;
    }
    // Historical notes can also place keywords outside appliedKeywords.
    for (const field of KEYWORD_FIELDS) {
      if (matches(record[field], true)) return true;
    }
    // No per-input server IO. Check the displayed keyword fallback only when
    // the local canonical fields did not already match.
    const extra = typeof extraFields === 'function' ? extraFields() : extraFields;
    for (const value of extra) if (matches(value, true)) return true;
    return false;
  };
  const hit = evaluate();
  if (searchFields) lastSearchHit.set(record, { query, fields: searchFields, hit });
  return hit;
};
