import type { CustomSectionItem, SongStructure, VocalMember } from '../../../../types';
import { buildV1AdaptiveLyricFlowInstruction } from './sectionLyricFlow';
import { composeV1ExperimentalSections } from './sectionStrategyComposer';
import {
  buildV1SectionRoleText,
  describeV1SectionMass,
  getV1SectionRolePolicy,
  type V1SectionMassClass,
  type V1SectionRepeatMode,
  type V1SectionRoleFamily,
} from './sectionRoleEngine';
import {
  baseV1SectionName,
  cleanV1SectionCue,
  getV1CustomSectionNames,
  getV1SectionDefinition,
  normalizeV1SectionName,
  type V1SectionKind,
} from './sectionRegistry';
import { resolveV1VocalAnchorDescriptors, resolveV1VocalTotal } from './vocalAnchors';

export interface V1SectionEngineParams {
  songStructure?: SongStructure;
  customStructure?: CustomSectionItem[];
  genre?: string | null;
  subGenre?: string[];
  styles?: string[];
  moods?: string[];
  themes?: string[];
  instrumentSounds?: string[];
  pointSounds?: string[];
  customGenreInput?: string;
  customStyleInput?: string;
  customSoundInput?: string;
  userInput?: string;
  lyricDraft?: string;
  isLyricMode?: boolean;
  lyricMode?: 'assist' | 'preserve';
  isNoLyrics?: boolean;
  includeLyrics?: boolean;
  instrumentalBgmMode?: boolean;
  generationIndex?: number;
  tempo?: string;
  lyricsLength?: string;
  __v1SectionBlueprintContract?: V1SectionBlueprint;
  vocal?: {
    rap?: boolean;
    rapMode?: 'auto' | 'off' | 'on' | string;
    male?: number;
    female?: number;
    mode?: 'solo' | 'duo' | 'group' | string;
    members?: VocalMember[];
  };
}

export type V1SectionProfile = 'mainstream' | 'rap' | 'dance' | 'band' | 'narrative' | 'spacious' | 'cinematic';

export interface V1SectionBlueprintEntry {
  id: string;
  name: string;
  baseName: string;
  occurrence: number;
  kind: V1SectionKind;
  requiresLyrics: boolean;
  allowsLyrics: boolean;
  lyricRole: string;
  roleFamily: V1SectionRoleFamily;
  massClass: V1SectionMassClass;
  repeatMode: V1SectionRepeatMode;
  customTags: string[];
}

export interface V1SectionBlueprint {
  contractId: string;
  mode: 'recommended' | 'stable' | 'experimental' | 'custom';
  profile: V1SectionProfile | 'custom' | 'instrumental';
  entries: V1SectionBlueprintEntry[];
  exactOrderText: string;
  roleInstruction: string;
  customNames: string[];
  vocalCount: number;
  vocalAnchors: string[];
  roleOwnershipInstruction: string;
}

function signalText(params: V1SectionEngineParams): string {
  return [
    params.genre || '',
    ...(params.subGenre || []),
    ...(params.styles || []),
    ...(params.moods || []),
    ...(params.themes || []),
    ...(params.instrumentSounds || []),
    ...(params.pointSounds || []),
    params.customGenreInput || '',
    params.customStyleInput || '',
    params.customSoundInput || '',
    params.userInput || '',
  ].join(' ').toLowerCase();
}

function normalizedRapMode(params: V1SectionEngineParams): 'auto' | 'off' | 'on' {
  const raw = String(params.vocal?.rapMode || '').toLowerCase();
  if (raw === 'off' || raw === 'on' || raw === 'auto') return raw;
  return params.vocal?.rap ? 'on' : 'auto';
}

function hasSelectedRapRole(params: V1SectionEngineParams): boolean {
  return (params.vocal?.members || []).some((member) =>
    (member?.roles || []).some((role) => /rap|rapper/i.test(String(role || ''))),
  );
}

function rapStructureSignalText(params: V1SectionEngineParams): string {
  return [
    params.genre || '',
    ...(params.subGenre || []),
    ...(params.styles || []),
    params.customGenreInput || '',
    params.customStyleInput || '',
    params.userInput || '',
  ].join(' ').toLowerCase();
}

function hasNoRapSignal(params: V1SectionEngineParams): boolean {
  return /\b(?:no|without|exclude|remove|avoid)\s+(?:any\s+)?rap\b|\brap[-\s]?free\b|랩(?:은|을|도)?\s*(?:없이|빼|제외|금지|없게|하지\s*마)|래퍼(?:는|를|도)?\s*(?:없이|제외)/i.test(rapStructureSignalText(params));
}

function hasRapSignal(params: V1SectionEngineParams): boolean {
  return /(?:^|[^a-z])(?:rap|rapper|hip[-\s]?hop|drill|trap|boom[-\s]?bap|phonk|grime|g[-\s]?funk)(?:$|[^a-z])|랩|래퍼|힙합|드릴|트랩/i.test(rapStructureSignalText(params));
}

function hasExplicitRapSectionRequest(params: V1SectionEngineParams): boolean {
  const text = String(params.userInput || '').toLowerCase();
  return /(?:랩|rap)(?:\s*section|\s*파트|\s*구간)?[^\r\n]{0,20}(?:넣|추가|포함|사용|include|add|use)|(?:include|add|use)[^\r\n]{0,20}(?:rap|랩)/i.test(text);
}

function shouldUseRapSection(params: V1SectionEngineParams): boolean {
  const mode = normalizedRapMode(params);
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  if (params.songStructure === 'custom') {
    return (params.customStructure || []).some((item) => /rap|랩/i.test(String(item?.section || '')));
  }
  if (hasNoRapSignal(params)) return false;
  // AUTO means "use the selected rapper role automatically". A rap-like genre alone must not
  // silently rewrite the user's visible section structure. Explicit director-note requests remain valid.
  return hasSelectedRapRole(params) || hasExplicitRapSectionRequest(params);
}

function scoreProfiles(params: V1SectionEngineParams): Array<[V1SectionProfile, number]> {
  const text = signalText(params);
  const score: Record<V1SectionProfile, number> = {
    mainstream: 1,
    // Rap mode ON means "include a rap part", not "turn the whole song into a rap song".
    // Genre/style signals decide whether rap is the dominant structural profile.
    rap: hasSelectedRapRole(params) ? 1 : 0,
    dance: 0,
    band: 0,
    narrative: 0,
    spacious: 0,
    cinematic: 0,
  };

  const add = (profile: V1SectionProfile, value: number, pattern: RegExp) => {
    if (pattern.test(text)) score[profile] += value;
  };

  add('rap', 6, /(?:\b(?:rap|hip[-\s]?hop|drill|trap|boom[-\s]?bap|phonk|grime|jersey|g[-\s]?funk)\b|힙합|드릴|트랩)/i);
  add('dance', 5, /\b(?:edm|house|techno|trance|dance|club|disco|garage|breakbeat|future\s*bass|dubstep|electro|moombahton|reggaeton)\b/i);
  add('band', 5, /\b(?:rock|band|punk|metal|emo|shoegaze|post[-\s]?rock|math[-\s]?rock|j[-\s]?rock|k[-\s]?band|anime\s*rock)\b/i);
  add('narrative', 5, /\b(?:trot|folk|country|musical|opera|story|narrative|singer[-\s]?songwriter|enka|pansori|판소리|트로트|뮤지컬|오페라)\b/i);
  add('spacious', 5, /\b(?:ballad|dream\s*pop|ambient|lo[-\s]?fi|jazz\s*ballad|city\s*pop|acoustic|slow\s*jam|healing|minimal)\b/i);
  add('cinematic', 5, /\b(?:cinematic|orchestra|orchestral|score|soundtrack|epic|symphonic|theme\s*a|theme\s*b|climax)\b/i);
  add('mainstream', 3, /\b(?:pop|k[-\s]?pop|j[-\s]?pop|r&b|rnb|soul|new[-\s]?jack|synth[-\s]?pop|city\s*pop|idol)\b/i);

  if (/\b(?:calm|peaceful|dreamy|lonely|nostalgic|warm|sad)\b/i.test(text)) score.spacious += 2;
  if (/\b(?:energetic|powerful|intense|anthem|uplifting)\b/i.test(text)) {
    score.dance += 1;
    score.band += 1;
    score.mainstream += 1;
  }

  return (Object.entries(score) as Array<[V1SectionProfile, number]>).sort((a, b) => b[1] - a[1]);
}

function hasExplicitRapStructure(params: V1SectionEngineParams): boolean {
  return shouldUseRapSection(params);
}

function resolveProfile(params: V1SectionEngineParams): V1SectionProfile {
  const scores = scoreProfiles(params);
  const first = scores[0]?.[0] || 'mainstream';
  if (first !== 'rap') return first;

  // AUTO adds one rap part while preserving the underlying song profile. Only an explicit ON
  // may promote a strongly rap-led genre into the dedicated rap structure (Recommended/Experimental).
  if (normalizedRapMode(params) === 'on' && hasRapSignal(params)) return 'rap';
  return scores.find(([profile, score]) => profile !== 'rap' && score > 0)?.[0] || 'mainstream';
}

function isInstrumentalRoute(params: V1SectionEngineParams): boolean {
  return Boolean(params.isNoLyrics || params.includeLyrics === false || params.instrumentalBgmMode);
}

const STABLE_VOCAL = ['Intro', 'Verse 1', 'Pre-Chorus 1', 'Chorus 1', 'Verse 2', 'Pre-Chorus 2', 'Chorus 2', 'Bridge', 'Final Chorus', 'Outro'];
const STABLE_RAP = ['Intro', 'Rap Section', 'Hook', 'Rap Section', 'Hook', 'Bridge', 'Final Hook', 'Outro'];
const STABLE_INSTRUMENTAL = ['Intro', 'Instrumental', 'Interlude', 'Instrumental', 'Outro'];

const RECOMMENDED_BY_PROFILE: Record<V1SectionProfile, string[]> = {
  mainstream: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'],
  rap: ['Intro', 'Rap Section', 'Hook', 'Rap Section', 'Break', 'Hook', 'Bridge', 'Final Hook', 'Outro'],
  dance: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Drop', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'],
  band: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'],
  narrative: ['Intro', 'Refrain', 'Verse', 'Chorus', 'Verse', 'Refrain', 'Bridge', 'Final Chorus', 'Outro'],
  spacious: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Instrumental', 'Verse', 'Bridge', 'Final Chorus', 'Outro'],
  cinematic: ['Intro', 'Theme A', 'Verse', 'Theme B', 'Chorus', 'Instrumental', 'Bridge', 'Climax', 'Outro'],
};

const RAP_AUGMENTED_VARIANTS: Record<Exclude<V1SectionProfile, 'rap'>, string[][]> = {
  mainstream: [
    ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Rap Section', 'Pre-Chorus', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'],
    ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Chorus', 'Rap Section', 'Bridge', 'Final Chorus', 'Outro'],
  ],
  dance: [
    ['Intro', 'Verse', 'Build-Up', 'Drop', 'Rap Section', 'Pre-Chorus', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'],
    ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Drop', 'Rap Section', 'Bridge', 'Final Chorus', 'Outro'],
  ],
  band: [
    ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Rap Section', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'],
    ['Intro', 'Verse', 'Chorus', 'Verse', 'Rap Section', 'Bridge', 'Final Chorus', 'Outro'],
  ],
  narrative: [
    ['Intro', 'Refrain', 'Verse', 'Chorus', 'Rap Section', 'Refrain', 'Bridge', 'Final Chorus', 'Outro'],
    ['Intro', 'Verse', 'Chorus', 'Verse', 'Rap Section', 'Bridge', 'Final Chorus', 'Outro'],
  ],
  spacious: [
    ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Instrumental', 'Rap Section', 'Bridge', 'Final Chorus', 'Outro'],
    ['Intro', 'Verse', 'Chorus', 'Rap Section', 'Instrumental', 'Bridge', 'Final Chorus', 'Outro'],
  ],
  cinematic: [
    ['Intro', 'Theme A', 'Verse', 'Theme B', 'Rap Section', 'Chorus', 'Bridge', 'Climax', 'Outro'],
    ['Intro', 'Theme A', 'Verse', 'Rap Section', 'Theme B', 'Instrumental', 'Bridge', 'Climax', 'Outro'],
  ],
};

function simpleSectionHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function recommendedSectionsForProfile(params: V1SectionEngineParams, profile: V1SectionProfile): string[] {
  if (profile === 'rap' || !shouldUseRapSection(params)) return RECOMMENDED_BY_PROFILE[profile];
  const variants = RAP_AUGMENTED_VARIANTS[profile];
  const entropy = `${signalText(params)}|${params.generationIndex ?? 0}|recommended-rap-position`;
  return variants[simpleSectionHash(entropy) % variants.length] || variants[0];
}

function injectRapIntoExperimentalSequence(sequence: string[], params: V1SectionEngineParams): string[] {
  if (!shouldUseRapSection(params) || sequence.some((name) => /^Rap Section(?:\s+\d+)?$/i.test(name))) return sequence;
  const next = [...sequence];
  const verseIndexes = next
    .map((name, index) => ({ name, index }))
    .filter((item) => /^Verse(?:\s+\d+)?$/i.test(item.name))
    .map((item) => item.index);
  if (verseIndexes.length >= 2) {
    next[verseIndexes[verseIndexes.length - 1]] = 'Rap Section';
    return next;
  }

  const bridgeIndex = next.findIndex((name) => /^(?:Bridge|Breakdown|Climax)$/i.test(name));
  const payoffIndex = next.findIndex((name) => /^(?:Final Chorus|Final Hook|Climax)$/i.test(name));
  const insertAt = bridgeIndex > 1 ? bridgeIndex : payoffIndex > 1 ? payoffIndex : Math.max(2, next.length - 2);
  next.splice(insertAt, 0, 'Rap Section');
  if (next.length > 11) {
    const optionalIndex = next.findIndex((name, index) => index > 0 && index < next.length - 2 && /^(?:Break|Stop|Instrumental|Interlude)$/i.test(name));
    if (optionalIndex >= 0) next.splice(optionalIndex, 1);
  }
  return next;
}


const CHRONOLOGICAL_NUMBERED_SECTION_BASES = new Set([
  'Verse',
  'Pre-Chorus',
  'Chorus',
  'Hook',
  'Refrain',
  'Rap Section',
]);

/**
 * Every chronological lyric family owns an explicit 1-based public number.
 * This applies to Recommended, Stable, Experimental, and Custom alike so a
 * generic [Chorus] can never ambiguously absorb Chorus 1/2 content later.
 * Unique payoff/closing names such as Final Chorus, Bridge, Intro, and Outro
 * remain unnumbered because they are not chronological repeat families.
 */
function numberChronologicalSections(
  rawEntries: Array<{ name: string; customTags: string[] }>,
): Array<{ name: string; customTags: string[] }> {
  const seen = new Map<string, number>();
  return rawEntries.map((item) => {
    const normalized = normalizeV1SectionName(item.name);
    if (/^Final\s+/i.test(normalized)) return { ...item, name: normalized };
    const base = baseV1SectionName(normalized);
    if (!CHRONOLOGICAL_NUMBERED_SECTION_BASES.has(base)) return { ...item, name: normalized };
    const occurrence = (seen.get(base) || 0) + 1;
    seen.set(base, occurrence);
    return { ...item, name: `${base} ${occurrence}` };
  });
}

function splitCustomTag(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.startsWith('VOCAL_ALL::')) return cleanV1SectionCue(value.split('::')[1] || 'All Voices');
  if (value.startsWith('VOCAL::')) {
    const parts = value.split('::');
    const label = cleanV1SectionCue(parts[1] || 'Vocal');
    const cue = cleanV1SectionCue(parts[2] || '');
    return `${label}${cue ? `, ${cue}` : ''}`;
  }
  return cleanV1SectionCue(value);
}

function customStructureEntries(params: V1SectionEngineParams): Array<{ name: string; customTags: string[] }> {
  const customNames = getV1CustomSectionNames(params.customStructure || []);
  return (params.customStructure || [])
    .map((item) => ({
      name: normalizeV1SectionName(String(item?.section || ''), customNames),
      customTags: (item?.tags || []).map(splitCustomTag).filter(Boolean),
    }))
    .filter((item) => Boolean(item.name));
}

function resolveSequence(params: V1SectionEngineParams): { profile: V1SectionProfile | 'custom' | 'instrumental'; mode: V1SectionBlueprint['mode']; rawEntries: Array<{ name: string; customTags: string[] }> } {
  if (isInstrumentalRoute(params)) {
    return {
      profile: 'instrumental',
      mode: params.songStructure === 'custom' ? 'custom' : params.songStructure === '3' ? 'experimental' : params.songStructure === '2' ? 'stable' : 'recommended',
      rawEntries: STABLE_INSTRUMENTAL.map((name) => ({ name, customTags: [] })),
    };
  }

  if (params.songStructure === 'custom' && (params.customStructure || []).length > 0) {
    return { profile: 'custom', mode: 'custom', rawEntries: numberChronologicalSections(customStructureEntries(params)) };
  }

  const profile = resolveProfile(params);
  if (params.songStructure === '2') {
    // Stable is a visible user promise. Its exact ten-section order never changes.
    // A selected Rap role may own Verse 2 with rhythmic/rap delivery, but the structural
    // label remains Verse 2. Users who want a real Rap Section choose Recommended,
    // Experimental, or Custom instead of silently mutating Stable.
    return { profile, mode: 'stable', rawEntries: numberChronologicalSections(STABLE_VOCAL.map((name) => ({ name, customTags: [] }))) };
  }
  if (params.songStructure === '3') {
    const entropy = `${signalText(params)}|${params.generationIndex ?? 0}`;
    const experimental = composeV1ExperimentalSections(profile, entropy);
    const sections = profile === 'rap' ? experimental : injectRapIntoExperimentalSequence(experimental, params);
    const rawEntries = sections.map((name) => ({ name, customTags: [] }));
    return { profile, mode: 'experimental', rawEntries: numberChronologicalSections(rawEntries) };
  }
  const rawEntries = recommendedSectionsForProfile(params, profile).map((name) => ({ name, customTags: [] }));
  return { profile, mode: 'recommended', rawEntries: numberChronologicalSections(rawEntries) };
}

function roleForOccurrence(name: string, occurrence: number, total: number, definitionRole: string): string {
  return buildV1SectionRoleText(name, occurrence, total) || definitionRole;
}

function makeEntries(rawEntries: Array<{ name: string; customTags: string[] }>, customNames: string[]): V1SectionBlueprintEntry[] {
  const occurrenceGroup = (name: string) => {
    if (/^Final\s+/i.test(name)) return name.toLowerCase();
    return baseV1SectionName(name).toLowerCase();
  };
  const totals = new Map<string, number>();
  rawEntries.forEach((item) => {
    const normalized = normalizeV1SectionName(item.name, customNames);
    const group = occurrenceGroup(normalized);
    totals.set(group, (totals.get(group) || 0) + 1);
  });

  const seen = new Map<string, number>();
  return rawEntries.map((item, index) => {
    const name = normalizeV1SectionName(item.name, customNames);
    const definition = getV1SectionDefinition(name);
    const rolePolicy = getV1SectionRolePolicy(name);
    const group = occurrenceGroup(name);
    const occurrence = (seen.get(group) || 0) + 1;
    seen.set(group, occurrence);
    return {
      id: `slot-${index + 1}`,
      name,
      baseName: definition.canonical,
      occurrence,
      kind: definition.kind,
      requiresLyrics: definition.requiresLyrics,
      allowsLyrics: definition.allowsLyrics,
      lyricRole: roleForOccurrence(name, occurrence, totals.get(group) || 1, definition.lyricRole),
      roleFamily: rolePolicy.family,
      massClass: rolePolicy.massClass,
      repeatMode: rolePolicy.repeatMode,
      customTags: item.customTags,
    };
  });
}

function buildRoleInstruction(entries: V1SectionBlueprintEntry[]): string {
  return entries.map((entry, index) => {
    const lyricPolicy = entry.requiresLyrics
      ? 'must own real lyric/ad-lib lines'
      : entry.allowsLyrics
        ? 'may be lyric-free or use only a short fitting vocal moment'
        : 'must remain lyric-free and vocal-free';
    const custom = entry.customTags.length ? ` User-selected cues to protect: ${entry.customTags.join(', ')}.` : '';
    return `${index + 1}. ${entry.name} — ${entry.lyricRole} Relative lyric mass: ${describeV1SectionMass(entry.massClass)}. This section ${lyricPolicy}.${custom}`;
  }).join('\n');
}

function resolveV1VocalAnchors(params: V1SectionEngineParams): string[] {
  return resolveV1VocalAnchorDescriptors(params.vocal).map((item) => item.sectionAnchor);
}

function resolveV1VocalCount(params: V1SectionEngineParams): number {
  return resolveV1VocalTotal(params.vocal);
}

function buildRoleAwareOwnershipInstruction(anchors: string[]): string {
  if (anchors.length < 2) return '';
  const main = anchors.filter((anchor) => /\bMain\b/i.test(anchor));
  const lead = anchors.filter((anchor) => /\bLead\b/i.test(anchor));
  const sub = anchors.filter((anchor) => /\bSub\b/i.test(anchor));
  const rap = anchors.filter((anchor) => /\bRap\b/i.test(anchor));
  const lines = [
    '- Role-aware ownership is a soft musical priority, not a rigid one-section formula. Explicit user/custom singer ownership always wins.',
  ];
  if (main.length) lines.push(`- Main role priority (${main.join(' / ')}): lead at least one core payoff or emotional peak such as Chorus, Hook, Bridge, or Climax. A shared Final Chorus may include Main, but do not let every core payoff be led only by non-Main voices when Main exists.`);
  if (lead.length) lines.push(`- Lead role priority (${lead.join(' / ')}): carry at least one flow-setting or rising section such as Verse, Pre-Chorus, Build-Up, or an early Chorus entry, then hand off naturally to the payoff.`);
  if (sub.length) lines.push(`- Sub role priority (${sub.join(' / ')}): receive a meaningful support, contrast, response, or secondary-story section. Do not make Sub replace Main from all major payoffs merely to equalize line count.`);
  if (rap.length) lines.push(`- Rap role priority (${rap.join(' / ')}): own Rap Section whenever Rap Section exists. If the structure has no Rap Section, a rap-capable voice may take a rhythmic Verse, Break, or Bridge only when the genre and story support it.`);
  lines.push('- Rotate voices naturally after these priorities are satisfied. Role priority does not mean Main sings every Chorus or Lead sings every Verse.');
  return lines.join('\n');
}

function userExplicitlyRequestsLyricFreeOutro(params: V1SectionEngineParams): boolean {
  const customOutroText = (params.customStructure || [])
    .filter((item) => /^(?:outro|ending|아웃트로|종주부|후주)$/i.test(String(item?.section || '').trim()))
    .flatMap((item) => [item.section, ...(item.tags || [])])
    .join(' ');
  const directText = [params.userInput || '', customOutroText].join(' ');
  return /(?:\boutro\b|ending|아웃트로|종주부|후주).{0,48}(?:\blyric[-\s]?free\b|\bno\s+(?:lyrics?|vocals?)\b|\binstrumental(?:-only)?\b|가사\s*(?:없이|없게|제외)|보컬\s*(?:없이|없게|제외)|연주만|인스트루멘탈)|(?:\blyric[-\s]?free\b|\bno\s+(?:lyrics?|vocals?)\b|\binstrumental(?:-only)?\b|가사\s*(?:없이|없게|제외)|보컬\s*(?:없이|없게|제외)|연주만|인스트루멘탈).{0,48}(?:\boutro\b|ending|아웃트로|종주부|후주)/i.test(directText);
}


function buildBlueprintContractId(
  mode: V1SectionBlueprint['mode'],
  profile: V1SectionBlueprint['profile'],
  entries: V1SectionBlueprintEntry[],
): string {
  const source = [
    mode,
    profile,
    ...entries.map((entry) => [
      entry.id,
      entry.name,
      entry.kind,
      entry.requiresLyrics ? 'required' : entry.allowsLyrics ? 'optional' : 'forbidden',
      ...entry.customTags,
    ].join('|')),
  ].join('::');
  return `v1-${mode}-${simpleSectionHash(source).toString(36)}`;
}

function isUsableLockedBlueprint(value: unknown): value is V1SectionBlueprint {
  if (!value || typeof value !== 'object') return false;
  const blueprint = value as V1SectionBlueprint;
  return Boolean(
    blueprint.contractId
    && Array.isArray(blueprint.entries)
    && blueprint.entries.length > 0
    && blueprint.entries.every((entry) => entry && typeof entry.id === 'string' && typeof entry.name === 'string'),
  );
}

export function buildV1SectionSlotContractInstruction(params: V1SectionEngineParams): string {
  const blueprint = getV1SectionBlueprint(params);
  const slots = blueprint.entries.map((entry, index) => {
    const policy = entry.requiresLyrics
      ? 'LYRIC_BODY_REQUIRED'
      : entry.allowsLyrics
        ? 'LYRIC_BODY_OPTIONAL'
        : 'LYRIC_BODY_FORBIDDEN';
    return `${index + 1}. sectionIndex=${index + 1} | id=${entry.id} | name=${entry.name} | ${policy}`;
  }).join('\n');
  return `V1 DYNAMIC SECTION SLOT CONTRACT — ${blueprint.contractId} (ABSOLUTE):
- The structure was already resolved once for this song. Recommended, Stable, Experimental, and Custom all use the exact resolved slots below; do not reroll or reinterpret the structure while writing.
- In the V1 JSON response, lyrics.korean and lyrics.english are section-object arrays. Return one object for every slot in each requested language card, in this exact order. Never omit, merge, rename, duplicate, or append a slot. If a lyric card language is not selected, return an empty array for that card.
- sectionId, sectionIndex, and sectionName must exactly match the contract and the array position. bodyLines contains lyric/ad-lib lines only. productionCues contains real instrument, ambience, texture, effect, or transition cues only, without square brackets.
- LYRIC_BODY_REQUIRED slots must contain at least one real non-blank lyric or vocal ad-lib line. An empty array, an empty string, whitespace, or production-cue text does not satisfy a required lyric body. LYRIC_BODY_OPTIONAL slots may use an empty body when musically appropriate. LYRIC_BODY_FORBIDDEN slots must use an empty body.
- Before returning JSON, silently audit the completed card against this exact contract: object count, array order, sectionId, sectionIndex, sectionName, and every required body's non-blank content. Repair any omission inside the same response instead of ending early.
- Custom user-created section names remain exactly as resolved. This contract controls only structure; it never hard-codes story content, wording, imagery, or vocal character.
${slots}`;
}

export function createV1SectionBlueprint(params: V1SectionEngineParams): V1SectionBlueprint {
  const resolved = resolveSequence(params);
  const customNames = getV1CustomSectionNames(params.customStructure || []);
  const lyricFreeOutro = userExplicitlyRequestsLyricFreeOutro(params);
  const entries = makeEntries(resolved.rawEntries, customNames).map((entry) => (
    lyricFreeOutro && /^Outro$/i.test(entry.name)
      ? { ...entry, requiresLyrics: false, allowsLyrics: false }
      : entry
  ));
  const vocalAnchors = resolveV1VocalAnchors(params);
  const contractId = buildBlueprintContractId(resolved.mode, resolved.profile, entries);
  return {
    contractId,
    mode: resolved.mode,
    profile: resolved.profile,
    entries,
    exactOrderText: entries.map((entry) => entry.name).join(' → '),
    roleInstruction: buildRoleInstruction(entries),
    customNames,
    vocalCount: resolveV1VocalCount(params),
    vocalAnchors,
    roleOwnershipInstruction: buildRoleAwareOwnershipInstruction(vocalAnchors),
  };
}

export function getV1SectionBlueprint(params: V1SectionEngineParams): V1SectionBlueprint {
  // A generation request locks one dynamic blueprint contract before the first Gemini call.
  // Every later prompt, parser, repair, renderer, and validator must reuse that exact snapshot.
  // Outside an active generation request we still rebuild from current UI values.
  if (isUsableLockedBlueprint(params.__v1SectionBlueprintContract)) {
    return params.__v1SectionBlueprintContract;
  }
  return createV1SectionBlueprint(params);
}

export function formatV1SectionBlueprintOrder(params: V1SectionEngineParams): string {
  return getV1SectionBlueprint(params).exactOrderText;
}

export function buildV1SectionBlueprintInstruction(params: V1SectionEngineParams): string {
  const blueprint = getV1SectionBlueprint(params);
  const singerAnchorInstruction = blueprint.vocalAnchors.length
    ? `- Active singer anchors for this song: ${blueprint.vocalAnchors.join(' / ')}. [Vocals] defines the same A/B/C/D identities with gender and role; lyric sections must reuse only those exact matching forms. Never introduce an undefined letter, remove its role, or change its gender inside a lyric tag.`
    : `- This is one solo voice. Never invent or print any group-member gender/letter/role identity in lyric section tags. Every tag must begin with the structural section name, for example [Verse 1: conversational phrasing] or [Rap Section 1: tight rhythmic flow]. RAP MODE changes this same solo singer's local delivery; it does not create another member.`;
  const tagOrderInstruction = blueprint.vocalAnchors.length
    ? '- Every structural tag must START with its exact section name. Never reverse the order into a singer-first tag.'
    : '- Every structural tag must START with its exact section name. Do not place any singer identity before the section name.';
  return `V1 SECTION BLUEPRINT — ${blueprint.mode.toUpperCase()} / ${String(blueprint.profile).toUpperCase()} (MANDATORY):
- Exact section order: ${blueprint.exactOrderText}
- One structural section tag must precede every lyric block. A standalone instrument, effect, ambience, or texture cue is never a structural section.
${tagOrderInstruction}
- Section tags contain only singer ownership/performance direction and the section's local function. Every sung or vocal-ad-lib section must include one short current-song performance cue. In multi-vocal songs the fixed order is exact short singer anchor first, then the performance cue. In solo songs use only the performance cue. A bare sung tag or an anchor-only sung tag is invalid. Put real instrument, sound-effect, ambience, foley, reverb, and texture-event directions on a separate square-bracket line directly below the section tag.
- Build one coherent performance arc from [Arrangement], then make each sung section audibly distinct inside that same arc. Choose the primary cue from vocal behavior, phrasing/rhythm, emotional attitude, or dynamic change. Add a second cue only when it describes another clearly audible local contrast. Preserve unity of singer identity and genre while making Verse, rise, payoff, turn, final payoff, and ending feel meaningfully different.
${singerAnchorInstruction}
${blueprint.roleOwnershipInstruction ? `ROLE-AWARE VOCAL OWNERSHIP (MANDATORY):\n${blueprint.roleOwnershipInstruction}` : ''}
- Do not create Verse A/B/C, Verse 1A/1B, Chorus 2A/2B, or similar singer-based structural suffixes. Verse, Pre-Chorus, Chorus, Hook, Refrain, and Rap Section always use 1-based chronological numbers in every mode, including Custom. User-created nonstandard section names remain unchanged; singer handoff stays inside one composite tag.
- USER SECTION OVERRIDE PRIORITY: this role/mass map supplies defaults only where the user has not explicitly designed the section. A direct user/director instruction about section length, repetition count, lyric-free status, monologue/dialogue shape, singer ownership, or story function overrides the default role and relative-mass description for that named section. Preserve explicit custom-section cues exactly; never "repair" an intentional exception back into the generic role.
- Never leave sound-imitation text ambiguous. Non-lexical human sounds such as (음, 음...), (우-), (아...) are vocal ad-libs/humming and stay in parentheses in the lyric body; they are never [sound effect] cues. Real rain, footsteps, objects, instruments, ambience, and foley use a standalone square-bracket production cue. If a sound-like phrase is meant as sung or spoken lyric, write it as an unmistakable lyric sentence and state the vocal delivery in the structural tag. A humming-only tag must not own ordinary lexical lyric lines.
- Do not omit, merge, rename, flatten, or accidentally duplicate structural sections. Keep Final Chorus and Final Hook distinct when they appear in this blueprint.
- Intro, Instrumental, Interlude, Break, and Stop may be lyric-free according to their roles. Every other required sung section must own real lyric or ad-lib lines before the next structural tag.
- The same lyrical content must not be relabeled as Verse, Chorus, and Bridge. Verse advances detail, hook sections carry the memorable center, Bridge turns perspective, and Outro closes.
SECTION-BY-SECTION CONTENT ROLES:
${blueprint.roleInstruction}

${buildV1AdaptiveLyricFlowInstruction(blueprint, params)}`;
}
