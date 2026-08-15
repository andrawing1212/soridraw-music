export type V1SectionRoleFamily =
  | 'opening'
  | 'development'
  | 'lift'
  | 'hook'
  | 'recurrence'
  | 'contrast'
  | 'release'
  | 'space'
  | 'payoff'
  | 'closing'
  | 'custom';

export type V1SectionMassClass = 'none' | 'trace' | 'compact' | 'balanced' | 'expansive';
export type V1SectionRepeatMode = 'none' | 'advance' | 'return-core' | 'transform' | 'recurring-phrase';

export interface V1SectionRolePolicy {
  key: string;
  family: V1SectionRoleFamily;
  massClass: V1SectionMassClass;
  repeatMode: V1SectionRepeatMode;
  purpose: string;
  contentBoundary: string;
}

const POLICY: Record<string, V1SectionRolePolicy> = {
  Intro: {
    key: 'Intro', family: 'opening', massClass: 'trace', repeatMode: 'none',
    purpose: 'Open the song world with one compact image cluster, a short voice moment, or a lyric-free musical prologue.',
    contentBoundary: 'Do not spend the main story, explain the conflict, or carry a Verse-sized narrative here.',
  },
  Verse: {
    key: 'Verse', family: 'development', massClass: 'expansive', repeatMode: 'advance',
    purpose: 'Carry concrete scene, action, relationship detail, or consequence and move the story forward.',
    contentBoundary: 'A later Verse must add a new action, image, consequence, or viewpoint instead of restating the earlier Verse.',
  },
  'Pre-Chorus': {
    key: 'Pre-Chorus', family: 'lift', massClass: 'compact', repeatMode: 'transform',
    purpose: 'Compress the language, narrow the focus, and raise pressure toward the next hook or release.',
    contentBoundary: 'Use less explanation than Verse and avoid resolving the central message before the hook arrives.',
  },
  Chorus: {
    key: 'Chorus', family: 'hook', massClass: 'balanced', repeatMode: 'return-core',
    purpose: 'Deliver the central memorable emotion, desire, statement, or melodic payoff.',
    contentBoundary: 'Keep it recognisable and repeatable; do not turn it into dense new exposition.',
  },
  'Final Chorus': {
    key: 'Final Chorus', family: 'payoff', massClass: 'balanced', repeatMode: 'transform',
    purpose: 'Return the central Chorus identity as the final payoff with changed scale, ownership, harmony, wording, or perspective.',
    contentBoundary: 'It may reuse the core hook, but it must not collapse into a one-line Outro or introduce an unrelated new story.',
  },
  Hook: {
    key: 'Hook', family: 'hook', massClass: 'trace', repeatMode: 'return-core',
    purpose: 'State the most immediately memorable rhythmic or melodic phrase.',
    contentBoundary: 'Keep it short and repeatable rather than explanatory.',
  },
  'Final Hook': {
    key: 'Final Hook', family: 'payoff', massClass: 'compact', repeatMode: 'transform',
    purpose: 'Bring back the Hook identity with a definite final change or resolution.',
    contentBoundary: 'Do not replace the final payoff with an unrelated slogan or an Outro-sized fragment.',
  },
  Refrain: {
    key: 'Refrain', family: 'recurrence', massClass: 'trace', repeatMode: 'recurring-phrase',
    purpose: 'Return a brief phrase or compact lyric unit that is recognisably the same each time.',
    contentBoundary: 'A Refrain is not a second Verse: it should not carry a full new scene or several unrelated ideas.',
  },
  'Rap Section': {
    key: 'Rap Section', family: 'development', massClass: 'expansive', repeatMode: 'advance',
    purpose: 'Carry denser rhythmic detail, dialogue, attitude, or narrative motion while staying inside the same Story Context.',
    contentBoundary: 'A later Rap Section must add new information or pressure rather than repeat the first flow under a new tag.',
  },
  Bridge: {
    key: 'Bridge', family: 'contrast', massClass: 'compact', repeatMode: 'transform',
    purpose: 'Create a genuine turn in perspective, truth, relationship, harmonic feeling, or emotional meaning.',
    contentBoundary: 'Do not paste the Chorus or Verse body under a Bridge label.',
  },
  'Build-Up': {
    key: 'Build-Up', family: 'lift', massClass: 'trace', repeatMode: 'transform',
    purpose: 'Tighten fragments, breath, rhythm, or repeated language while energy rises toward a release.',
    contentBoundary: 'Do not carry Verse-sized explanation or a complete new scene.',
  },
  Drop: {
    key: 'Drop', family: 'release', massClass: 'compact', repeatMode: 'return-core',
    purpose: 'Deliver the release through a compact vocal hook, chant, refrain-like phrase, or lyric-free musical impact when the blueprint allows it.',
    contentBoundary: 'Do not turn the Drop into a long narrative section.',
  },
  Breakdown: {
    key: 'Breakdown', family: 'contrast', massClass: 'trace', repeatMode: 'transform',
    purpose: 'Strip the arrangement and create contrast with sparse, exposed, or fragmentary vocal content when lyrics are used.',
    contentBoundary: 'Do not fill the emptied space with Verse-sized explanation.',
  },
  Break: {
    key: 'Break', family: 'space', massClass: 'none', repeatMode: 'none',
    purpose: 'Create a short lyric-free transition.',
    contentBoundary: 'No lyric body.',
  },
  Stop: {
    key: 'Stop', family: 'space', massClass: 'none', repeatMode: 'none',
    purpose: 'Create a very short lyric-free interruption.',
    contentBoundary: 'No lyric body.',
  },
  Instrumental: {
    key: 'Instrumental', family: 'space', massClass: 'none', repeatMode: 'transform',
    purpose: 'Develop the selected musical motif, instrument, or texture without vocals.',
    contentBoundary: 'No lyric body and no vocal ad-lib.',
  },
  Interlude: {
    key: 'Interlude', family: 'space', massClass: 'none', repeatMode: 'none',
    purpose: 'Create a short lyric-free breathing space or transition.',
    contentBoundary: 'No lyric body and no vocal ad-lib.',
  },
  'Theme A': {
    key: 'Theme A', family: 'development', massClass: 'compact', repeatMode: 'return-core',
    purpose: 'Establish one distinct recurring melodic or lyrical identity.',
    contentBoundary: 'Keep its identity clearly different from Theme B.',
  },
  'Theme B': {
    key: 'Theme B', family: 'contrast', massClass: 'compact', repeatMode: 'transform',
    purpose: 'Introduce a contrasting second melodic, rhythmic, or lyrical identity.',
    contentBoundary: 'Do not merely rename Theme A.',
  },
  'Main Theme': {
    key: 'Main Theme', family: 'hook', massClass: 'compact', repeatMode: 'return-core',
    purpose: 'State the core musical or lyrical identity clearly and memorably.',
    contentBoundary: 'Keep it structurally central rather than explanatory.',
  },
  Climax: {
    key: 'Climax', family: 'payoff', massClass: 'balanced', repeatMode: 'transform',
    purpose: 'Deliver the highest point of intensity or meaning.',
    contentBoundary: 'Do not introduce an unrelated new plot at the peak.',
  },
  Outro: {
    key: 'Outro', family: 'closing', massClass: 'trace', repeatMode: 'none',
    purpose: 'Close the song or leave one deliberate final afterimage.',
    contentBoundary: 'Do not restart the story or carry another Verse-sized development.',
  },
};

function cleanName(value: string): string {
  return String(value || '')
    .replace(/[\[\]]/g, ' ')
    .split(/[:：]/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveV1SectionRoleKey(value: string): string {
  const clean = cleanName(value);
  if (/^Final\s+Chorus\b/i.test(clean)) return 'Final Chorus';
  if (/^Final\s+Hook\b/i.test(clean)) return 'Final Hook';
  if (/^Pre[-\s]?Chorus\b/i.test(clean)) return 'Pre-Chorus';
  if (/^Rap\s+(?:Section|Verse)\b/i.test(clean)) return 'Rap Section';
  if (/^Build[-\s]?Up\b/i.test(clean)) return 'Build-Up';
  if (/^Theme\s+A\b/i.test(clean)) return 'Theme A';
  if (/^Theme\s+B\b/i.test(clean)) return 'Theme B';
  if (/^Main\s+Theme\b/i.test(clean)) return 'Main Theme';
  const base = clean.replace(/\s+(?:\d+|[A-Z])$/i, '').trim();
  const match = Object.keys(POLICY).find((key) => key.toLowerCase() === base.toLowerCase());
  return match || base || 'Custom';
}

export function getV1SectionRolePolicy(value: string): V1SectionRolePolicy {
  const key = resolveV1SectionRoleKey(value);
  return POLICY[key] || {
    key,
    family: 'custom',
    massClass: 'balanced',
    repeatMode: 'transform',
    purpose: 'Follow the user-defined section name and preserve a clear musical and lyrical function.',
    contentBoundary: 'Keep the section distinct from neighbouring roles and protect the user-selected tags.',
  };
}

export function describeV1SectionMass(value: V1SectionMassClass): string {
  switch (value) {
    case 'none': return 'lyric-free';
    case 'trace': return 'one compact recurring, opening, transitional, or closing lyric unit relative to the full-content sections';
    case 'compact': return 'clearly lighter and more concentrated than a full development section';
    case 'balanced': return 'enough content to carry a memorable center or payoff without becoming exposition-heavy';
    case 'expansive': return 'the main home for new scene, action, dialogue, or narrative detail';
    default: return 'role-appropriate relative mass';
  }
}

export function v1SectionMassRank(value: V1SectionMassClass): number {
  return value === 'none' ? 0 : value === 'trace' ? 1 : value === 'compact' ? 2 : value === 'balanced' ? 3 : 4;
}

export function buildV1SectionRoleText(value: string, occurrence = 1, total = 1): string {
  const policy = getV1SectionRolePolicy(value);
  const occurrenceRule = occurrence > 1
    ? policy.repeatMode === 'advance'
      ? 'This return must advance with new content rather than repeat the earlier block.'
      : policy.repeatMode === 'recurring-phrase'
        ? 'Return the same brief phrase identity recognisably; only a small wording or singer variation is allowed.'
        : policy.repeatMode === 'return-core'
          ? 'Keep the core identity recognisable while allowing a purposeful local variation.'
          : policy.repeatMode === 'transform'
            ? 'Keep the same structural function but change the local pressure, perspective, ownership, or scale.'
            : ''
    : policy.repeatMode === 'recurring-phrase' && total > 1
      ? 'Establish a phrase compact enough to return recognisably later.'
      : '';
  return [policy.purpose, policy.contentBoundary, occurrenceRule].filter(Boolean).join(' ');
}
