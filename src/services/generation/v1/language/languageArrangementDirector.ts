export type V1LanguageArrangementProfile =
  | 'hook-led'
  | 'rhythm-led'
  | 'groove-led'
  | 'narrative-led'
  | 'spacious-led'
  | 'band-led'
  | 'hybrid';

export interface V1LanguageArrangementBriefInput {
  requestedRatio: number;
  genre?: string | null;
  subGenres?: string[];
  moods?: string[];
  themes?: string[];
  styles?: string[];
  customGenreInput?: string;
  customMoodInput?: string;
  customThemeInput?: string;
  userInput?: string;
  storyContext?: string;
  tempo?: string;
  vocal?: unknown;
}

export interface V1LanguageArrangementBrief {
  version: 'v1-language-arrangement-arc-step10';
  requestedWholeSongRatio: number;
  primaryProfile: V1LanguageArrangementProfile;
  secondaryProfile: V1LanguageArrangementProfile | null;
  sourceSignals: {
    genre: string[];
    mood: string[];
    story: string[];
    style: string[];
    tempo: string;
    vocal: unknown;
  };
  creativePrinciples: {
    change: string;
    balance: string;
    unity: string;
  };
  genreGrammar: string[];
  sectionArcPolicy: string[];
  candidatePolicy: string[];
  ratioPolicy: string[];
}

const PROFILE_TRIGGERS: Array<{
  profile: Exclude<V1LanguageArrangementProfile, 'hybrid'>;
  patterns: RegExp[];
}> = [
  {
    profile: 'hook-led',
    patterns: [
      /\bk[-\s]?pop\b/i,
      /\bidol\b/i,
      /\bj[-\s]?pop\b/i,
      /\banisong\b/i,
      /\bdance\s*pop\b/i,
      /\bedm\b/i,
      /\bhouse\b/i,
      /\belectro\s*pop\b/i,
    ],
  },
  {
    profile: 'rhythm-led',
    patterns: [
      /\bhip[-\s]?hop\b/i,
      /\brap\b/i,
      /\bdrill\b/i,
      /\btrap\b/i,
      /\bboom\s*bap\b/i,
      /\bgarage\b/i,
      /\bbreakbeat\b/i,
      /\bgrime\b/i,
    ],
  },
  {
    profile: 'groove-led',
    patterns: [
      /\br\s*&\s*b\b/i,
      /\brnb\b/i,
      /\bsoul\b/i,
      /\bfunk\b/i,
      /\bdisco\b/i,
      /\bcity\s*pop\b/i,
      /\bafrobeat\b/i,
      /\breggaeton\b/i,
      /\bmoombahton\b/i,
    ],
  },
  {
    profile: 'narrative-led',
    patterns: [
      /\bballad\b/i,
      /\bfolk\b/i,
      /\bcountry\b/i,
      /\btrot\b/i,
      /\bmusical\b/i,
      /\bopera\b/i,
      /\bnarrative\b/i,
      /\bacoustic\b/i,
    ],
  },
  {
    profile: 'spacious-led',
    patterns: [
      /\bdream\s*pop\b/i,
      /\bambient\b/i,
      /\blo[-\s]?fi\b/i,
      /\bshoegaze\b/i,
      /\bdreamwave\b/i,
      /\bjazz\s*ballad\b/i,
      /\bminimal\b/i,
    ],
  },
  {
    profile: 'band-led',
    patterns: [
      /\brock\b/i,
      /\bpunk\b/i,
      /\bemo\b/i,
      /\bk[-\s]?band\b/i,
      /\bindie\s*rock\b/i,
      /\bpop\s*rock\b/i,
      /\bmetal\b/i,
    ],
  },
];

function compactStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)));
}

function scoreProfiles(signals: Array<{ text: string; weight: number }>): Array<{ profile: Exclude<V1LanguageArrangementProfile, 'hybrid'>; score: number }> {
  return PROFILE_TRIGGERS
    .map(({ profile, patterns }, profileIndex) => ({
      profile,
      profileIndex,
      score: signals.reduce((signalSum, signal) => {
        const matchedPatternCount = patterns.reduce((sum, pattern) => sum + (pattern.test(signal.text) ? 1 : 0), 0);
        return signalSum + matchedPatternCount * signal.weight;
      }, 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.profileIndex - b.profileIndex)
    .map(({ profile, score }) => ({ profile, score }));
}

function guidanceForProfile(profile: V1LanguageArrangementProfile): string[] {
  switch (profile) {
    case 'hook-led':
      return [
        'Favor memorable target-language words, hook anchors, compact rhythmic phrases, and selective full-line switches when the hook or drop benefits from them.',
        'Do not reduce the whole song to isolated filler words; let hook language return as an audible motif and develop across later returns.',
      ];
    case 'rhythm-led':
      return [
        'Favor rhyme-bearing phrases, flexible phrase boundaries, target-first entries, internal switches, and complete target-language bars when the flow supports them.',
        'Let stress, cadence, internal rhyme, and character attitude decide the switch length instead of a fixed word count.',
      ];
    case 'groove-led':
      return [
        'Favor short-to-medium phrases, fluid direction changes, breath-aware code switching, and occasional complete lines that sit naturally in the pocket.',
        'Use language as part of groove and vocal phrasing, not as a translation tail attached after every base-language clause.',
      ];
    case 'narrative-led':
      return [
        'Favor semantically continuous phrases or longer target-language lines at meaningful story turns, confessions, contrasts, and payoffs.',
        'Keep the listener oriented in the story; use language changes to reveal a new layer rather than repeat the same meaning mechanically.',
      ];
    case 'spacious-led':
      return [
        'Use fewer but more resonant switches, image-bearing words, suspended phrases, or full-line contrast where silence and atmosphere give them weight.',
        'Avoid filling every available line; preserve lyrical air and let a small number of language moments carry the atmosphere.',
      ];
    case 'band-led':
      return [
        'Favor singable punch phrases, shoutable lines, call-and-response moments, and emotionally clear target-language payoffs.',
        'Let Verse, Bridge, and Chorus use different language intensity according to the band arc rather than one repeated line template.',
      ];
    case 'hybrid':
    default:
      return [
        'Blend the main and secondary genre grammars by section. The main profile controls the overall identity; the secondary profile may reshape selected sections, rhythmic passages, hooks, or transitions.',
        'Do not average the two profiles into one uniform template. Let contrasting sections keep distinct language behavior while sharing one song identity.',
      ];
  }
}

export function buildV1LanguageArrangementBrief(input: V1LanguageArrangementBriefInput): V1LanguageArrangementBrief {
  const genreSignals = compactStrings([
    input.genre,
    ...(input.subGenres || []),
    input.customGenreInput,
  ]);
  const moodSignals = compactStrings([
    ...(input.moods || []),
    input.customMoodInput,
  ]);
  const storySignals = compactStrings([
    input.storyContext,
    input.customThemeInput,
    ...(input.themes || []),
    input.userInput,
  ]);
  const styleSignals = compactStrings(input.styles || []);
  const scored = scoreProfiles([
    ...compactStrings([input.customGenreInput]).map((text) => ({ text, weight: 7 })),
    ...compactStrings([input.genre]).map((text) => ({ text, weight: 6 })),
    ...(input.subGenres || []).map((text) => ({ text: String(text || '').trim(), weight: 3 })).filter((item) => item.text),
    ...styleSignals.map((text) => ({ text, weight: 1 })),
  ]);
  const primaryRaw = scored[0]?.profile || 'hybrid';
  const secondaryRaw = scored.find((item) => item.profile !== primaryRaw)?.profile || null;
  const primaryProfile: V1LanguageArrangementProfile = primaryRaw;
  const profileGuidance = secondaryRaw
    ? [
        ...guidanceForProfile('hybrid'),
        ...guidanceForProfile(primaryRaw),
        ...guidanceForProfile(secondaryRaw),
      ]
    : guidanceForProfile(primaryProfile);

  return {
    version: 'v1-language-arrangement-arc-step10',
    requestedWholeSongRatio: Math.max(0, Math.min(90, Math.round(Number(input.requestedRatio) || 0))),
    primaryProfile,
    secondaryProfile: secondaryRaw,
    sourceSignals: {
      genre: genreSignals,
      mood: moodSignals,
      story: storySignals,
      style: styleSignals,
      tempo: String(input.tempo || '').trim(),
      vocal: input.vocal ?? null,
    },
    creativePrinciples: {
      change: 'Language intensity and switch form must evolve with the story, emotional pressure, and section function. Change comes from narrative development, not random alternation.',
      balance: 'Balance means a convincing whole-song arc. Sections may carry very different target-language intensity; never distribute the same percentage evenly across every section.',
      unity: 'Related Verse, Chorus, Hook, and Final sections must share or develop recognizable language motifs, switch functions, rhyme families, or phrasing identities without requiring exact duplication.',
    },
    genreGrammar: Array.from(new Set(profileGuidance)),
    sectionArcPolicy: [
      'Infer a relative language-intensity arc from the current story and section roles before writing candidate lines. The order may rise, fall, contrast, pause, return, or transform.',
      'A section may remain entirely in the base language, carry a few anchors, use mixed phrases, or become target-language dominant when that choice serves the narrative and genre.',
      'Intro and Outro may anchor the base-language identity, but this is an option rather than a rule. Bridge and Final sections may contrast, reveal, or resolve the earlier language behavior.',
      'Repeated sections should preserve a recognizable relationship. They may repeat, expand, reduce, reverse direction, or reframe the established language motif according to the song arc.',
    ],
    candidatePolicy: [
      'Candidate lines are opportunities, not mandatory rewrites. Mark suitable=false and preserve sourceText when changing that line would weaken the arc.',
      'Choose freely among keyword anchor, short phrase, extended phrase, complete target-language line, base-first switch, target-first switch, and internal switch.',
      'Do not use one switch direction or one phrase length throughout the song. Variation must still feel related through motif, sound, character voice, and section development.',
    ],
    ratioPolicy: [
      'The requested percentage is a whole-song sung-occupancy direction, not a per-section quota and not a required number of changed lines.',
      'First design musically convincing candidates. The application will choose a subset and make the smallest possible ratio adjustment while preserving the strongest arrangement decisions.',
    ],
  };
}
