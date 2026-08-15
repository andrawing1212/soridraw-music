import { MOODS } from '../constants';
import type { CategoryItem } from '../types';

export type MoodBlendMode = 'empty' | 'single' | 'reinforcing' | 'layered';

export interface MoodIdentitySource {
  id: string;
  label: string;
  labelKo?: string;
  emotionalCharacter: string;
  movement: string;
  meaning: string;
  isCustom: boolean;
}

export interface MoodIdentity {
  sources: MoodIdentitySource[];
  blendMode: MoodBlendMode;
  coreEmotion: string;
  supportingEmotion: string;
  hiddenLayer: string;
  movement: string;
  relationship: string;
  synthesisDirective: string;
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLookupKey(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[()\[\]{}]/g, ' ')
    .replace(/[\s_\-–—/.,:;]+/g, '')
    .trim();
}

function sourceValue(value: unknown): string {
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    return cleanText(candidate.id || candidate.labelKo || candidate.label || candidate.mood);
  }
  return cleanText(value);
}

const MOOD_LOOKUP = (() => {
  const lookup = new Map<string, CategoryItem>();
  MOODS.forEach((item) => {
    [item.id, item.label, item.labelKo].forEach((value) => {
      const key = normalizeLookupKey(value);
      if (key && !lookup.has(key)) lookup.set(key, item);
    });
  });
  return lookup;
})();

function findCatalogMood(value: unknown): CategoryItem | undefined {
  const key = normalizeLookupKey(sourceValue(value));
  return key ? MOOD_LOOKUP.get(key) : undefined;
}

function collectMoodValues(params: any): string[] {
  const values = [
    ...(Array.isArray(params?.moods) ? params.moods : []),
    params?.mood,
    params?.customMoodInput,
    params?.customMoodText,
    params?.directMoodInput,
    params?.directMoodText,
  ]
    .map(sourceValue)
    .filter(Boolean);

  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeLookupKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitPhrases(value: unknown, limit = 5): string[] {
  return cleanText(value)
    .split(/[,;/|]+/)
    .map((part) => part.replace(/[.]+$/g, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function uniquePhrases(values: string[], limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const clean = cleanText(value);
    const key = clean
      .toLowerCase()
      .replace(/\b(?:the|a|an|and|with|of|to|for|in|on|by|as)\b/g, ' ')
      .replace(/[^a-z0-9가-힣]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }

  return result;
}

const SIMILARITY_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'with', 'without', 'of', 'to', 'for', 'in', 'on', 'by',
  'as', 'into', 'from', 'through', 'under', 'over', 'very', 'softly', 'slightly', 'quietly',
  'emotionally', 'emotional', 'feeling', 'mood', 'character', 'movement', 'section', 'progression',
]);

function semanticTokens(source: MoodIdentitySource): Set<string> {
  const text = [source.emotionalCharacter, source.meaning, source.movement]
    .join(' ')
    .toLowerCase();

  return new Set(
    text
      .replace(/[^a-z0-9가-힣]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !SIMILARITY_STOP_WORDS.has(token)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function averagePairwiseSimilarity(sources: MoodIdentitySource[]): number {
  if (sources.length < 2) return 1;
  const tokenSets = sources.map(semanticTokens);
  let sum = 0;
  let count = 0;

  for (let i = 0; i < tokenSets.length; i += 1) {
    for (let j = i + 1; j < tokenSets.length; j += 1) {
      sum += jaccardSimilarity(tokenSets[i], tokenSets[j]);
      count += 1;
    }
  }

  return count ? sum / count : 0;
}

function resolveMoodIdentitySources(params: any): MoodIdentitySource[] {
  const sources: MoodIdentitySource[] = [];

  collectMoodValues(params).forEach((value, index) => {
    const item = findCatalogMood(value);
    if (item) {
      sources.push({
        id: item.id,
        label: item.label,
        labelKo: item.labelKo,
        emotionalCharacter: cleanText(item.mood || item.label),
        movement: cleanText(item.arrangement),
        meaning: cleanText(item.description),
        isCustom: false,
      });
      return;
    }

    sources.push({
      id: `custom-${index + 1}`,
      label: value,
      emotionalCharacter: value,
      movement: '',
      meaning: value,
      isCustom: true,
    });
  });

  return sources;
}

function displaySource(source: MoodIdentitySource): string {
  return source.labelKo ? `${source.labelKo} (${source.label})` : source.label;
}

export function buildMoodIdentity(params: any): MoodIdentity {
  const sources = resolveMoodIdentitySources(params);

  if (!sources.length) {
    return {
      sources: [],
      blendMode: 'empty',
      coreEmotion: '',
      supportingEmotion: '',
      hiddenLayer: '',
      movement: '',
      relationship: '',
      synthesisDirective: 'No selected mood identity. Keep the emotional direction simple and do not invent decorative mood layers.',
    };
  }

  const primaryDescriptors = uniquePhrases(
    sources.flatMap((source) => splitPhrases(source.emotionalCharacter, 1)),
    4,
  );
  const secondaryDescriptors = uniquePhrases(
    sources.flatMap((source) => splitPhrases(source.emotionalCharacter, 4).slice(1)),
    5,
  );
  const meanings = uniquePhrases(sources.map((source) => source.meaning), 3);
  const movements = uniquePhrases(
    sources.flatMap((source) => splitPhrases(source.movement, 3)),
    5,
  );

  const similarity = averagePairwiseSimilarity(sources);
  const blendMode: MoodBlendMode = sources.length === 1
    ? 'single'
    : similarity >= 0.16
      ? 'reinforcing'
      : 'layered';

  const sourceNames = sources.map(displaySource);
  const coreEmotion = primaryDescriptors.join(' + ');
  const supportingEmotion = secondaryDescriptors.join(', ');
  const hiddenLayer = meanings.join(' / ');
  const movement = movements.join(', ');

  let relationship = '';
  let synthesisDirective = '';

  if (blendMode === 'single') {
    relationship = `One clear identity from ${sourceNames[0]}.`;
    synthesisDirective = `Keep ${coreEmotion || sourceNames[0]} as one precise mood identity. Do not broaden it into a generic neighboring mood.`;
  } else if (blendMode === 'reinforcing') {
    relationship = `The selected moods reinforce a related emotional family: ${sourceNames.join(' + ')}.`;
    synthesisDirective = `Concentrate the overlapping meaning of ${sourceNames.join(' + ')} into one stronger identity. Remove synonym repetition instead of listing near-duplicate adjectives.`;
  } else {
    relationship = `The selected moods form layered roles: ${sourceNames[0]} is the surface identity, while ${sourceNames.slice(1).join(' + ')} stay as supporting or hidden undercurrents.`;
    synthesisDirective = `Preserve the difference between ${sourceNames.join(' + ')}. Keep the first mood as the readable surface and let the others shape the undertone, pressure, or aftertaste. Do not flatten them into one vague adjective.`;
  }

  return {
    sources,
    blendMode,
    coreEmotion,
    supportingEmotion,
    hiddenLayer,
    movement,
    relationship,
    synthesisDirective,
  };
}

export function formatMoodIdentityContext(identity: MoodIdentity): string {
  if (!identity.sources.length) return identity.synthesisDirective;

  return [
    'RESOLVED MOOD IDENTITY (INTERNAL, ROLE-NEUTRAL):',
    `sources: ${identity.sources.map(displaySource).join(' / ')}`,
    `blend mode: ${identity.blendMode}`,
    `core emotion: ${identity.coreEmotion || 'none'}`,
    `supporting emotion: ${identity.supportingEmotion || 'none'}`,
    `hidden layer: ${identity.hiddenLayer || 'none'}`,
    `movement source: ${identity.movement || 'none'}`,
    `relationship: ${identity.relationship}`,
    `synthesis rule: ${identity.synthesisDirective}`,
    'Do not translate this into Genre, Atmosphere, Vocals, Arrangement, or Lyrics wording yet. Role-specific translation belongs to the next stage.',
  ].join('\n');
}
