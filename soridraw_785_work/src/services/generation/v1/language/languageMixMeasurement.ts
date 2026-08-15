export type V1LanguageMeasurementCode = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'ru' | 'th';

const SCRIPT_PATTERNS: Record<V1LanguageMeasurementCode, RegExp> = {
  ko: /[가-힣ㄱ-ㅎㅏ-ㅣ]/g,
  en: /[A-Za-z]/g,
  ja: /[\u3040-\u30ff\u31f0-\u31ff]/g,
  zh: /[\u3400-\u9fff]/g,
  es: /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,
  fr: /[A-Za-zÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸàâæçéèêëîïôœùûüÿ]/g,
  de: /[A-Za-zÄÖÜẞäöüß]/g,
  ru: /[\u0400-\u04ff]/g,
  th: /[\u0e00-\u0e7f]/g,
};

const ANY_LYRIC_SCRIPT_RE = /[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ가-힣ㄱ-ㅎㅏ-ㅣ\u3040-\u30ff\u31f0-\u31ff\u3400-\u9fff\u0400-\u04ff\u0e00-\u0e7f]/;
const LATIN_WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ]+)*/g;

export interface V1LineLanguageOccupancy {
  line: string;
  targetShare: number;
  baseShare: number;
  targetOnly: boolean;
  mixed: boolean;
  hasTarget: boolean;
  hasBase: boolean;
  tokenCount: number;
  targetTokenCount: number;
  baseTokenCount: number;
  targetChunkCount: number;
  baseChunkCount: number;
  targetPerformanceUnits: number;
  basePerformanceUnits: number;
  totalPerformanceUnits: number;
  languageBoundaryCount: number;
}

export interface V1SungLanguageOccupancy {
  actualMixRatio: number;
  actualBaseRatio: number;
  totalPerformanceUnits: number;
  targetPerformanceUnits: number;
  basePerformanceUnits: number;
  sungLineCount: number;
  lines: V1LineLanguageOccupancy[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isV1LanguageDirectiveLine(line: string): boolean {
  return /^\[[^\]\n]+\]$/.test(String(line || '').trim());
}

function countMatches(value: string, pattern: RegExp): number {
  return (String(value || '').match(pattern) || []).length;
}

function estimateLatinWordSyllables(rawWord: string): number {
  const word = String(rawWord || '')
    .toLowerCase()
    .replace(/[^a-zà-öø-ÿā-žẁ-ỿ]/g, '');
  if (!word) return 0;

  const normalized = word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  if (!normalized) return 0;

  const vowelGroups = normalized.match(/[aeiouy]+/g) || [];
  let syllables = vowelGroups.length;
  if (normalized.length > 3 && /e$/.test(normalized) && !/[aeiouy]le$/.test(normalized) && syllables > 1) {
    syllables -= 1;
  }
  if (/[^aeiouy]le$/.test(normalized)) syllables += 1;
  return Math.max(1, syllables);
}

function estimateLatinUnits(value: string): number {
  const words = Array.from(String(value || '').match(LATIN_WORD_RE) || []) as string[];
  return words.reduce((sum: number, word: string) => sum + estimateLatinWordSyllables(word), 0);
}

function estimateLanguageUnits(value: string, language: V1LanguageMeasurementCode): number {
  const text = String(value || '');
  if (!text) return 0;
  switch (language) {
    case 'ko':
      return countMatches(text, /[가-힣]/g) + countMatches(text, /[ㄱ-ㅎㅏ-ㅣ]/g) * 0.5;
    case 'en':
    case 'es':
    case 'fr':
    case 'de':
      return estimateLatinUnits(text);
    case 'ja':
      return countMatches(text, /[\u3040-\u30ff\u31f0-\u31ff]/g);
    case 'zh':
      return countMatches(text, /[\u3400-\u9fff]/g);
    case 'ru': {
      const words = Array.from(text.match(/[\u0400-\u04ff]+/g) || []) as string[];
      return words.reduce((sum: number, word: string) => sum + Math.max(1, countMatches(word, /[аеёиоуыэюя]/gi)), 0);
    }
    case 'th':
      return countMatches(text, /[\u0e00-\u0e7f]/g) * 0.55;
    default:
      return countMatches(text, SCRIPT_PATTERNS[language]);
  }
}

function classifyToken(
  token: string,
  baseLanguage: V1LanguageMeasurementCode,
  targetLanguages: V1LanguageMeasurementCode[],
): 'base' | 'target' | 'mixed' | 'other' {
  const baseUnits = estimateLanguageUnits(token, baseLanguage);
  const targetUnits = targetLanguages.reduce((sum, language) => sum + estimateLanguageUnits(token, language), 0);
  if (baseUnits > 0 && targetUnits > 0) return 'mixed';
  if (targetUnits > 0) return 'target';
  if (baseUnits > 0) return 'base';
  return 'other';
}

function splitSungTokens(line: string): string[] {
  return String(line || '')
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => ANY_LYRIC_SCRIPT_RE.test(token));
}

/**
 * Estimates sung occupancy with comparable performance units instead of raw letters.
 * Korean is measured by Hangul syllables; Latin-script languages are measured by estimated
 * spoken syllables. The same estimator is used by selection and the final public audit.
 */
export function measureV1LineLanguageOccupancy(
  line: string,
  baseLanguage: V1LanguageMeasurementCode,
  targetLanguagesInput: V1LanguageMeasurementCode[],
): V1LineLanguageOccupancy {
  const targetLanguages = Array.from(new Set(targetLanguagesInput.filter((language) => language !== baseLanguage)));
  const text = String(line || '');
  const tokens = splitSungTokens(text);
  const basePerformanceUnits = estimateLanguageUnits(text, baseLanguage);
  const targetPerformanceUnits = targetLanguages.reduce((sum, language) => sum + estimateLanguageUnits(text, language), 0);
  const totalPerformanceUnits = Math.max(0, basePerformanceUnits + targetPerformanceUnits);
  const targetShare = totalPerformanceUnits > 0 ? targetPerformanceUnits / totalPerformanceUnits : 0;
  const clampedTargetShare = Math.max(0, Math.min(1, targetShare));
  const hasTarget = targetPerformanceUnits > 0;
  const hasBase = basePerformanceUnits > 0;

  const classes = tokens
    .map((token) => classifyToken(token, baseLanguage, targetLanguages))
    .filter((kind) => kind !== 'other');
  let languageBoundaryCount = 0;
  for (let index = 1; index < classes.length; index += 1) {
    const previous = classes[index - 1];
    const current = classes[index];
    if (previous !== current && previous !== 'mixed' && current !== 'mixed') languageBoundaryCount += 1;
    if (previous === 'mixed' || current === 'mixed') languageBoundaryCount += 1;
  }
  if (languageBoundaryCount === 0 && classes.some((kind) => kind === 'mixed')) languageBoundaryCount = 1;

  const targetTokenCount = classes.filter((kind) => kind === 'target' || kind === 'mixed').length;
  const baseTokenCount = classes.filter((kind) => kind === 'base' || kind === 'mixed').length;
  const targetChunkCount = classes.reduce((count, kind, index) => {
    const isTargetLike = kind === 'target' || kind === 'mixed';
    const previous = classes[index - 1];
    const previousTargetLike = previous === 'target' || previous === 'mixed';
    return count + (isTargetLike && !previousTargetLike ? 1 : 0);
  }, 0);
  const baseChunkCount = classes.reduce((count, kind, index) => {
    const isBaseLike = kind === 'base' || kind === 'mixed';
    const previous = classes[index - 1];
    const previousBaseLike = previous === 'base' || previous === 'mixed';
    return count + (isBaseLike && !previousBaseLike ? 1 : 0);
  }, 0);

  return {
    line: text,
    targetShare: clampedTargetShare,
    baseShare: 1 - clampedTargetShare,
    targetOnly: hasTarget && !hasBase && clampedTargetShare >= 0.999,
    mixed: hasTarget && hasBase && languageBoundaryCount > 0,
    hasTarget,
    hasBase,
    tokenCount: classes.length,
    targetTokenCount,
    baseTokenCount,
    targetChunkCount,
    baseChunkCount,
    targetPerformanceUnits: round1(targetPerformanceUnits),
    basePerformanceUnits: round1(basePerformanceUnits),
    totalPerformanceUnits: round1(totalPerformanceUnits),
    languageBoundaryCount,
  };
}


export function extractV1TargetLanguageTokens(
  line: string,
  baseLanguage: V1LanguageMeasurementCode,
  targetLanguagesInput: V1LanguageMeasurementCode[],
): string[] {
  const targetLanguages = Array.from(new Set(targetLanguagesInput.filter((language) => language !== baseLanguage)));
  const tokens = splitSungTokens(line);
  const output: string[] = [];

  const extractSurface = (token: string, language: V1LanguageMeasurementCode): string[] => {
    switch (language) {
      case 'ko':
        return token.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]+/g) || [];
      case 'en':
      case 'es':
      case 'fr':
      case 'de':
        return token.match(LATIN_WORD_RE) || [];
      case 'ja':
        return token.match(/[\u3040-\u30ff\u31f0-\u31ff]+/g) || [];
      case 'zh':
        return token.match(/[\u3400-\u9fff]+/g) || [];
      case 'ru':
        return token.match(/[\u0400-\u04ff]+/g) || [];
      case 'th':
        return token.match(/[\u0e00-\u0e7f]+/g) || [];
      default:
        return [];
    }
  };

  tokens.forEach((token) => {
    const kind = classifyToken(token, baseLanguage, targetLanguages);
    if (kind !== 'target' && kind !== 'mixed') return;
    const surfaces = targetLanguages.flatMap((language) => extractSurface(token, language));
    surfaces.forEach((surface) => {
      const normalized = String(surface || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
        .trim();
      if (normalized) output.push(normalized);
    });
  });

  return output;
}

export function measureV1SungLanguageOccupancy(
  lyrics: string,
  baseLanguage: V1LanguageMeasurementCode,
  targetLanguages: V1LanguageMeasurementCode[],
): V1SungLanguageOccupancy {
  const lines = String(lyrics || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !isV1LanguageDirectiveLine(line) && ANY_LYRIC_SCRIPT_RE.test(line))
    .map((line) => measureV1LineLanguageOccupancy(line, baseLanguage, targetLanguages));

  const targetPerformanceUnits = lines.reduce((sum, line) => sum + line.targetPerformanceUnits, 0);
  const basePerformanceUnits = lines.reduce((sum, line) => sum + line.basePerformanceUnits, 0);
  const totalPerformanceUnits = Math.max(0, targetPerformanceUnits + basePerformanceUnits);

  return {
    actualMixRatio: totalPerformanceUnits > 0 ? round1((targetPerformanceUnits / totalPerformanceUnits) * 100) : 0,
    actualBaseRatio: totalPerformanceUnits > 0 ? round1((basePerformanceUnits / totalPerformanceUnits) * 100) : 0,
    totalPerformanceUnits: round1(totalPerformanceUnits),
    targetPerformanceUnits: round1(targetPerformanceUnits),
    basePerformanceUnits: round1(basePerformanceUnits),
    sungLineCount: lines.length,
    lines,
  };
}
