import type { V1SectionBlueprint, V1SectionBlueprintEntry } from '../sections/sectionBlueprint';

export type V1LyricArchitectureProfile =
  | 'balanced'
  | 'spacious'
  | 'rhythmic'
  | 'hook-led'
  | 'band'
  | 'narrative'
  | 'cinematic';

export type V1LyricPhraseLength = 'short' | 'mixed' | 'long';
export type V1LyricBreathSpace = 'wide' | 'normal' | 'tight';
export type V1LyricPriority = 'low' | 'medium' | 'high';
export type V1LanguageMixShape =
  | 'base-only'
  | 'word-short-phrase'
  | 'mixed-length'
  | 'target-led-with-base-anchors';

export interface V1LyricArchitectureInput {
  genre?: string | null;
  subGenre?: string[];
  styles?: string[];
  moods?: string[];
  themes?: string[];
  tempo?: string;
  lyricsLength?: string;
  userInput?: string;
  customGenreInput?: string;
  customStyleInput?: string;
  englishMixRatio?: number;
  languageMixActive?: boolean;
  vocal?: {
    rap?: boolean;
    rapMode?: string;
    members?: Array<{ roles?: string[] }>;
  };
}

export interface V1GenreProsodyProfile {
  narrativeAmount: number;
  rhythmicDensity: number;
  melodicSustain: number;
  hookRepetition: number;
  phraseCompression: number;
  breathSpace: number;
  rhymePriority: number;
  conversationality: number;
}

export interface V1LyricSectionArchitecture {
  sectionId: string;
  sectionName: string;
  roleFamily: string;
  narrativeJob: string;
  genreInfluence: V1LyricArchitectureProfile;
  fusionRole: 'primary-global' | 'secondary-local';
  density: number;
  phraseLength: V1LyricPhraseLength;
  breathSpace: V1LyricBreathSpace;
  repetition: V1LyricPriority;
  melodicSustain: V1LyricPriority;
  rhymePriority: V1LyricPriority;
  languageMixShape: V1LanguageMixShape;
}

export interface V1LyricArchitecturePlan {
  version: 'v1-active-2';
  mode: 'active';
  primaryProfile: V1LyricArchitectureProfile;
  secondaryProfiles: V1LyricArchitectureProfile[];
  genreProsody: V1GenreProsodyProfile;
  densityCurve: Array<{ section: string; density: number }>;
  sections: V1LyricSectionArchitecture[];
  safeguards: string[];
}

const PROFILE_PATTERNS: Array<[V1LyricArchitectureProfile, RegExp]> = [
  ['rhythmic', /(?:^|[^a-z])(?:rap|hip[-\s]?hop|drill|trap|boom[-\s]?bap|phonk|grime|g[-\s]?funk)(?:$|[^a-z])|랩|래퍼|힙합|드릴|트랩/i],
  ['hook-led', /(?:^|[^a-z])(?:k[-\s]?pop|j[-\s]?pop|dance\s*pop|edm|house|disco|idol|club|electro|reggaeton)(?:$|[^a-z])|케이팝|아이돌|댄스/i],
  ['band', /(?:^|[^a-z])(?:rock|band|punk|metal|emo|shoegaze|post[-\s]?rock|j[-\s]?rock|k[-\s]?band)(?:$|[^a-z])|록|밴드|펑크|메탈/i],
  ['narrative', /(?:^|[^a-z])(?:folk|country|trot|musical|opera|singer[-\s]?songwriter|enka|pansori)(?:$|[^a-z])|포크|컨트리|트로트|뮤지컬|판소리/i],
  ['spacious', /(?:^|[^a-z])(?:ballad|dream\s*pop|ambient|lo[-\s]?fi|jazz\s*ballad|city\s*pop|acoustic|slow\s*jam|minimal)(?:$|[^a-z])|발라드|드림팝|앰비언트|로파이|시티팝|어쿠스틱/i],
  ['cinematic', /(?:^|[^a-z])(?:cinematic|orchestra|orchestral|score|soundtrack|epic|symphonic)(?:$|[^a-z])|시네마틱|오케스트라|사운드트랙/i],
];

const PROFILE_PROSODY: Record<V1LyricArchitectureProfile, V1GenreProsodyProfile> = {
  balanced: {
    narrativeAmount: 2,
    rhythmicDensity: 2,
    melodicSustain: 2,
    hookRepetition: 2,
    phraseCompression: 2,
    breathSpace: 2,
    rhymePriority: 1,
    conversationality: 2,
  },
  spacious: {
    narrativeAmount: 2,
    rhythmicDensity: 1,
    melodicSustain: 4,
    hookRepetition: 2,
    phraseCompression: 1,
    breathSpace: 4,
    rhymePriority: 1,
    conversationality: 2,
  },
  rhythmic: {
    narrativeAmount: 3,
    rhythmicDensity: 4,
    melodicSustain: 1,
    hookRepetition: 2,
    phraseCompression: 4,
    breathSpace: 1,
    rhymePriority: 4,
    conversationality: 4,
  },
  'hook-led': {
    narrativeAmount: 2,
    rhythmicDensity: 3,
    melodicSustain: 3,
    hookRepetition: 4,
    phraseCompression: 3,
    breathSpace: 2,
    rhymePriority: 2,
    conversationality: 2,
  },
  band: {
    narrativeAmount: 2,
    rhythmicDensity: 3,
    melodicSustain: 3,
    hookRepetition: 3,
    phraseCompression: 2,
    breathSpace: 2,
    rhymePriority: 2,
    conversationality: 2,
  },
  narrative: {
    narrativeAmount: 4,
    rhythmicDensity: 2,
    melodicSustain: 2,
    hookRepetition: 2,
    phraseCompression: 2,
    breathSpace: 3,
    rhymePriority: 1,
    conversationality: 4,
  },
  cinematic: {
    narrativeAmount: 3,
    rhythmicDensity: 1,
    melodicSustain: 4,
    hookRepetition: 2,
    phraseCompression: 1,
    breathSpace: 4,
    rhymePriority: 1,
    conversationality: 1,
  },
};

const MASS_DENSITY: Record<string, number> = {
  none: 0,
  trace: 1,
  compact: 2,
  balanced: 3,
  expansive: 4,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(4, Math.round(value)));
}

function normalizeSignal(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function signalText(input: V1LyricArchitectureInput): string {
  return normalizeSignal([
    input.genre || '',
    ...(input.subGenre || []),
    ...(input.styles || []),
    ...(input.moods || []),
    ...(input.themes || []),
    input.customGenreInput || '',
    input.customStyleInput || '',
    input.userInput || '',
  ].join(' '));
}

function matchProfiles(text: string): V1LyricArchitectureProfile[] {
  return PROFILE_PATTERNS
    .map(([profile, pattern], order) => {
      const match = pattern.exec(text);
      return match ? { profile, index: match.index, order } : null;
    })
    .filter((item): item is { profile: V1LyricArchitectureProfile; index: number; order: number } => Boolean(item))
    .sort((a, b) => (a.index - b.index) || (a.order - b.order))
    .map((item) => item.profile);
}

function detectProfiles(input: V1LyricArchitectureInput): V1LyricArchitectureProfile[] {
  const primaryText = normalizeSignal([
    input.genre || '',
    ...(input.subGenre || []),
    input.customGenreInput || '',
  ].join(' '));
  const primaryMatches = matchProfiles(primaryText);
  const broadMatches = matchProfiles(signalText(input));
  const primary = primaryMatches[0] || broadMatches[0] || 'balanced';
  const secondary = broadMatches.filter((profile) => profile !== primary);
  return [primary, ...Array.from(new Set(secondary))];
}

function parseTempoBpm(tempo?: string): number | null {
  const values = String(tempo || '').match(/\d{2,3}/g)?.map(Number).filter((value) => value >= 35 && value <= 240) || [];
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hasRapRole(input: V1LyricArchitectureInput): boolean {
  if (input.vocal?.rap || String(input.vocal?.rapMode || '').toLowerCase() === 'on') return true;
  return (input.vocal?.members || []).some((member) =>
    (member.roles || []).some((role) => /rap|rapper|랩|래퍼/i.test(String(role || ''))),
  );
}

function buildProsody(input: V1LyricArchitectureInput, primaryProfile: V1LyricArchitectureProfile): V1GenreProsodyProfile {
  const result: V1GenreProsodyProfile = { ...PROFILE_PROSODY[primaryProfile || 'balanced'] };

  const bpm = parseTempoBpm(input.tempo);
  if (bpm !== null) {
    if (bpm >= 128) {
      result.rhythmicDensity = clampScore(result.rhythmicDensity + 1);
      result.phraseCompression = clampScore(result.phraseCompression + 1);
      result.breathSpace = clampScore(result.breathSpace - 1);
    } else if (bpm <= 78) {
      result.melodicSustain = clampScore(result.melodicSustain + 1);
      result.breathSpace = clampScore(result.breathSpace + 1);
      result.rhythmicDensity = clampScore(result.rhythmicDensity - 1);
    }
  }

  if (hasRapRole(input)) {
    result.rhythmicDensity = clampScore(result.rhythmicDensity + 1);
    result.rhymePriority = clampScore(result.rhymePriority + 1);
    result.conversationality = clampScore(result.conversationality + 1);
  }

  return result;
}

const LOCAL_PROFILE_ROLE_FAMILIES: Record<V1LyricArchitectureProfile, string[]> = {
  balanced: [],
  spacious: ['opening', 'contrast', 'closing', 'space'],
  rhythmic: ['development'],
  'hook-led': ['lift', 'hook', 'recurrence', 'release', 'payoff'],
  band: ['development', 'lift', 'hook', 'payoff'],
  narrative: ['development', 'contrast', 'payoff'],
  cinematic: ['opening', 'contrast', 'payoff', 'closing'],
};

function profileFitsSection(profile: V1LyricArchitectureProfile, entry: V1SectionBlueprintEntry): boolean {
  if (profile === 'rhythmic' && /rap/i.test(entry.name)) return true;
  return LOCAL_PROFILE_ROLE_FAMILIES[profile].includes(entry.roleFamily);
}

function resolveSectionGenreInfluence(
  primaryProfile: V1LyricArchitectureProfile,
  secondaryProfiles: V1LyricArchitectureProfile[],
  entry: V1SectionBlueprintEntry,
): { profile: V1LyricArchitectureProfile; fusionRole: 'primary-global' | 'secondary-local' } {
  const secondary = secondaryProfiles.find((profile) => profileFitsSection(profile, entry));
  if (!secondary) return { profile: primaryProfile, fusionRole: 'primary-global' };
  return { profile: secondary, fusionRole: 'secondary-local' };
}

function blendSectionProsody(
  globalProsody: V1GenreProsodyProfile,
  influenceProfile: V1LyricArchitectureProfile,
  primaryProfile: V1LyricArchitectureProfile,
): V1GenreProsodyProfile {
  if (influenceProfile === primaryProfile) return { ...globalProsody };
  const local = PROFILE_PROSODY[influenceProfile];
  return (Object.keys(globalProsody) as Array<keyof V1GenreProsodyProfile>).reduce((acc, key) => {
    // The main genre keeps the whole-song identity while one secondary influence receives
    // meaningful authority only in the section families where its phrasing naturally belongs.
    acc[key] = clampScore((globalProsody[key] * 0.55) + (local[key] * 0.45));
    return acc;
  }, {} as V1GenreProsodyProfile);
}

function resolveNarrativeJob(entry: V1SectionBlueprintEntry): string {
  const family = String(entry.roleFamily || 'custom');
  if (family === 'opening') return 'establish one compact image, voice state, or question without spending the main story';
  if (family === 'development') {
    return entry.occurrence > 1
      ? 'advance with a new action, consequence, image, or viewpoint rather than restating the earlier development'
      : 'establish the speaker, present situation, desire, and one concrete movement inside the Story Context';
  }
  if (family === 'lift') return 'compress the language, narrow the focus, and raise unresolved pressure toward the next hook';
  if (family === 'hook') return 'state the central desire or emotion in a memorable form with low exposition';
  if (family === 'recurrence') return 'return one recognisable phrase identity with only a purposeful local variation';
  if (family === 'contrast') return 'reveal a genuine change in truth, perspective, relationship, or emotional meaning';
  if (family === 'payoff') return 'resolve or reinterpret the established hook after the preceding turn without starting a new story';
  if (family === 'closing') return 'leave one deliberate afterimage or final emotional landing without restarting development';
  if (family === 'release') return 'deliver a compact release, chant, or hook return rather than new exposition';
  if (family === 'space') return 'preserve lyric-free or near-empty musical space according to the section contract';
  return 'follow the user-defined section role while staying distinct from neighbouring sections';
}

function resolveSectionDensity(
  entry: V1SectionBlueprintEntry,
  influenceProfile: V1LyricArchitectureProfile,
  prosody: V1GenreProsodyProfile,
  lyricsLength?: string,
): number {
  let density = MASS_DENSITY[entry.massClass] ?? 2;
  if (entry.roleFamily === 'development' && influenceProfile === 'rhythmic') density += 1;
  if (entry.roleFamily === 'development' && influenceProfile === 'narrative') density += 1;
  if (['hook', 'recurrence', 'release'].includes(entry.roleFamily)) density -= prosody.hookRepetition >= 3 ? 1 : 0;
  if (entry.roleFamily === 'contrast' && ['spacious', 'cinematic'].includes(influenceProfile)) density -= 1;
  if (entry.roleFamily === 'opening' || entry.roleFamily === 'closing') density = Math.min(density, 1);
  if (entry.roleFamily === 'space') density = 0;
  if (lyricsLength === 'very-short') density -= 1;
  if (lyricsLength === 'long' && entry.roleFamily === 'development') density += 1;
  return clampScore(density);
}

function scoreToPriority(value: number): V1LyricPriority {
  if (value >= 3) return 'high';
  if (value >= 2) return 'medium';
  return 'low';
}

function resolvePhraseLength(density: number, prosody: V1GenreProsodyProfile, entry: V1SectionBlueprintEntry): V1LyricPhraseLength {
  if (entry.roleFamily === 'hook' || entry.roleFamily === 'recurrence' || entry.roleFamily === 'release') return 'short';
  if (density >= 4 && prosody.phraseCompression <= 2) return 'long';
  if (density <= 1) return 'short';
  return 'mixed';
}

function resolveBreathSpace(density: number, prosody: V1GenreProsodyProfile): V1LyricBreathSpace {
  if (density >= 4 || prosody.breathSpace <= 1) return 'tight';
  if (density <= 1 || prosody.breathSpace >= 3) return 'wide';
  return 'normal';
}

function resolveLanguageMixShape(input: V1LyricArchitectureInput): V1LanguageMixShape {
  if (!input.languageMixActive) return 'base-only';
  const ratio = Math.max(0, Math.min(90, Number(input.englishMixRatio || 0)));
  if (ratio <= 20) return 'word-short-phrase';
  if (ratio <= 50) return 'mixed-length';
  return 'target-led-with-base-anchors';
}

export function buildV1LyricArchitecturePlan(
  input: V1LyricArchitectureInput,
  blueprint: V1SectionBlueprint | null,
): V1LyricArchitecturePlan | null {
  if (!blueprint?.entries?.length) return null;
  const profiles = detectProfiles(input);
  const primaryProfile = profiles[0] || 'balanced';
  const secondaryProfiles = profiles.slice(1, 3);
  const genreProsody = buildProsody(input, primaryProfile);
  const languageMixShape = resolveLanguageMixShape(input);

  const sections = blueprint.entries.map((entry): V1LyricSectionArchitecture => {
    const influence = resolveSectionGenreInfluence(primaryProfile, secondaryProfiles, entry);
    const localProsody = blendSectionProsody(genreProsody, influence.profile, primaryProfile);
    const density = resolveSectionDensity(entry, influence.profile, localProsody, input.lyricsLength);
    return {
      sectionId: entry.id,
      sectionName: entry.name,
      roleFamily: entry.roleFamily,
      narrativeJob: resolveNarrativeJob(entry),
      genreInfluence: influence.profile,
      fusionRole: influence.fusionRole,
      density,
      phraseLength: resolvePhraseLength(density, localProsody, entry),
      breathSpace: resolveBreathSpace(density, localProsody),
      repetition: scoreToPriority(
        ['hook', 'recurrence', 'payoff', 'release'].includes(entry.roleFamily)
          ? localProsody.hookRepetition
          : 1,
      ),
      melodicSustain: scoreToPriority(localProsody.melodicSustain),
      rhymePriority: scoreToPriority(
        entry.roleFamily === 'development' ? localProsody.rhymePriority : Math.max(0, localProsody.rhymePriority - 1),
      ),
      languageMixShape,
    };
  });

  return {
    version: 'v1-active-2',
    mode: 'active',
    primaryProfile,
    secondaryProfiles,
    genreProsody,
    densityCurve: sections.map((section) => ({ section: section.sectionName, density: section.density })),
    sections,
    safeguards: [
      'Do not use fixed syllable quotas; preserve relative density, stress, breath, and section contrast.',
      'A later development section must add new information, action, consequence, or viewpoint.',
      'A hook stays memorable and singable rather than becoming exposition-heavy.',
      'A bridge must create a real turn and the final payoff must reinterpret or resolve the established hook.',
      'Language mixing follows the available phrase space and is measured only from final sung lyric characters.',
    ],
  };
}

export function buildV1LyricArchitecturePublicSummary(plan: V1LyricArchitecturePlan | null): Record<string, unknown> | null {
  if (!plan) return null;
  return {
    version: plan.version,
    mode: plan.mode,
    primaryProfile: plan.primaryProfile,
    secondaryProfiles: plan.secondaryProfiles,
    genreProsody: plan.genreProsody,
    densityCurve: plan.densityCurve,
    sections: plan.sections.map((section) => ({
      section: section.sectionName,
      roleFamily: section.roleFamily,
      narrativeJob: section.narrativeJob,
      genreInfluence: section.genreInfluence,
      fusionRole: section.fusionRole,
      density: section.density,
      phraseLength: section.phraseLength,
      breathSpace: section.breathSpace,
      repetition: section.repetition,
      melodicSustain: section.melodicSustain,
      rhymePriority: section.rhymePriority,
      languageMixShape: section.languageMixShape,
    })),
    safeguards: plan.safeguards,
  };
}

function formatProsody(plan: V1LyricArchitecturePlan): string {
  const p = plan.genreProsody;
  return [
    `narrative=${p.narrativeAmount}/4`,
    `rhythmic-density=${p.rhythmicDensity}/4`,
    `melodic-sustain=${p.melodicSustain}/4`,
    `hook-repeat=${p.hookRepetition}/4`,
    `phrase-compression=${p.phraseCompression}/4`,
    `breath-space=${p.breathSpace}/4`,
    `rhyme=${p.rhymePriority}/4`,
    `conversation=${p.conversationality}/4`,
  ].join(', ');
}

export function buildV1LyricArchitectureInstruction(plan: V1LyricArchitecturePlan | null): string {
  if (!plan) return '';
  const fusionText = plan.secondaryProfiles.length
    ? `Primary ${plan.primaryProfile} controls the whole-song identity; secondary ${plan.secondaryProfiles.join(' + ')} may shape only the section rows marked secondary-local.`
    : `Primary ${plan.primaryProfile} controls the whole-song lyric movement.`;
  const sectionRows = plan.sections.map((section, index) => (
    `${index + 1}. ${section.sectionName} | role=${section.narrativeJob} | density=${section.density}/4 | phrase=${section.phraseLength} | breath=${section.breathSpace} | repeat=${section.repetition} | sustain=${section.melodicSustain} | rhyme=${section.rhymePriority} | influence=${section.genreInfluence}/${section.fusionRole}`
  )).join('\n');

  return `V1 ACTIVE LYRIC ARCHITECTURE — ${plan.version} (MANDATORY, DO NOT OUTPUT THIS PLAN):
- This is a relative performance-and-story map, never an exact line, word, character, or syllable quota. Natural singability and the user's direct instructions remain higher priority.
- ${fusionText}
- Global prosody: ${formatProsody(plan)}.
- Density meaning: 0=lyric-free/near-empty when the section contract permits, 1=sparse, 2=compact, 3=developed, 4=dense. Preserve contrast between neighbouring sections rather than making every section equally long.
- Keep one coherent Story Context. Later development must add a new action, consequence, image, or viewpoint; the Bridge must create a real turn; the final payoff must resolve or reinterpret the established hook.
- A memorable hook may be shorter than a Verse. Do not convert Chorus/Hook into exposition merely to increase length.
- Language mixing must fit this available phrase space, but the binding language-passage plan remains authoritative until the dedicated language-mix stage is upgraded.
SECTION ARCHITECTURE:
${sectionRows}`;
}

