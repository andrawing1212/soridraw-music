export type LanguageArrangementStrategy =
  | 'hook-recall'
  | 'progressive-expansion'
  | 'role-contrast'
  | 'arc-balance'
  | 'balanced-blocks'
  | 'target-led-balance'
  | 'target-dominant';

export type LanguageGenreBlendProfile =
  | 'k-idol-dance'
  | 'k-ballad'
  | 'k-indie-folk'
  | 'k-band-rock'
  | 'k-hiphop-rap'
  | 'k-rnb-soul'
  | 'global-pop';

export interface LanguageArrangementDirectorInput {
  requestedRatio: number;
  targetLanguages: string[];
  structureMode?: string;
  hookPatterns?: string[];
  rapMode?: 'auto' | 'off' | 'on' | string;
  hasRapperRole?: boolean;
  vocalCount?: number;
  genreText?: string;
}

export interface LanguageArrangementSectionJob {
  section: string;
  languageRole: string;
  musicalPurpose: string;
  prosodyFocus: string;
}

export interface LanguageArrangementPlan {
  strategy: LanguageArrangementStrategy;
  genreProfile: LanguageGenreBlendProfile;
  arcSummary: string;
  sectionJobs: LanguageArrangementSectionJob[];
  minTargetSections: number;
  maxTargetSections: number;
  requiredTimelineZones: number;
  preferredBlockLength: string;
  sectionCoverageIsReference: true;
  easySingActive: boolean;
  promptInstruction: string;
}

const MIX_RATIOS = [10, 20, 30, 40, 50, 60, 70] as const;

const clampRatio = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return MIX_RATIOS.reduce((best, candidate) => (
    Math.abs(candidate - numeric) < Math.abs(best - numeric) ? candidate : best
  ), MIX_RATIOS[0]);
};

const hasPattern = (patterns: string[], pattern: string) => patterns.some((item) => String(item || '').toLowerCase() === pattern);

function resolveStrategy(ratio: number): LanguageArrangementStrategy {
  if (ratio <= 10) return 'hook-recall';
  if (ratio <= 20) return 'progressive-expansion';
  if (ratio <= 30) return 'role-contrast';
  if (ratio <= 40) return 'arc-balance';
  if (ratio <= 50) return 'balanced-blocks';
  if (ratio <= 60) return 'target-led-balance';
  return 'target-dominant';
}

function resolveGenreProfile(genreText: string): LanguageGenreBlendProfile {
  const text = String(genreText || '').toLowerCase();
  if (/r&b|rnb|neo\s*soul|soul|알앤비|소울/.test(text)) return 'k-rnb-soul';
  if (/hip[-\s]?hop|melodic\s*rap|\brap\b|trap|drill|boom[-\s]?bap|힙합|랩|트랩|드릴/.test(text)) return 'k-hiphop-rap';
  if (/band|rock|punk|metal|emo|post[-\s]?rock|밴드|록|펑크|메탈/.test(text)) return 'k-band-rock';
  if (/indie|folk|acoustic|singer[-\s]?songwriter|인디|포크|어쿠스틱/.test(text)) return 'k-indie-folk';
  if (/ballad|slow\s*ballad|발라드/.test(text)) return 'k-ballad';
  if (/k[-\s]?pop|idol|dance\s*pop|electropop|synth\s*pop|j[-\s]?idol|아이돌|댄스/.test(text)) return 'k-idol-dance';
  return 'global-pop';
}

function ratioSectionReference(ratio: number): {
  min: number;
  max: number;
  zones: number;
  block: string;
} {
  if (ratio <= 10) return { min: 1, max: 3, zones: 2, block: 'one compact hook cell plus one late recall when musically useful' };
  if (ratio <= 20) return { min: 2, max: 4, zones: 2, block: 'one-to-two-line phrases or one compact development block' };
  if (ratio <= 30) return { min: 2, max: 5, zones: 2, block: 'short woven phrases plus one role-specific development block' };
  if (ratio <= 40) return { min: 3, max: 6, zones: 2, block: 'one-to-three-line phrase cells with a coherent whole-song arc' };
  if (ratio <= 50) return { min: 3, max: 7, zones: 2, block: 'balanced phrase weaving with occasional coherent blocks' };
  if (ratio <= 60) return { min: 4, max: 8, zones: 2, block: 'target-led phrasing with matrix-language identity anchors' };
  return { min: 4, max: 9, zones: 2, block: 'target-language body with deliberate matrix-language hook and story anchors' };
}

function buildGenreInstruction(profile: LanguageGenreBlendProfile, ratio: number, hasRap: boolean): string {
  switch (profile) {
    case 'k-idol-dance':
      return `K-idol / K-dance weaving: use short global hook cells, member handoffs, chantable tags, and polished mixed phrases. Do not hand an entire Chorus to a separate foreign-language "character". At ${ratio}% keep the languages interlocked around the same topline identity; target-only runs in a Chorus are usually 1–3 lines, not 5–6 lines.`;
    case 'k-ballad':
      return `K-ballad weaving: Korean-style emotional narration and natural speech remain the emotional spine. Use the target language at a title phrase, emotional opening, Bridge turn, Chorus lift, or Outro recall, with matched breath and vowel release. Avoid generic English-pop paragraphs that interrupt the confession.`;
    case 'k-indie-folk':
      return `K-indie / folk weaving: preserve the writer's specific voice, awkward humanity, and image continuity. Code-switch at a real thought turn or sonic phrase, not for polish alone. Avoid stock phrases such as find my way, shining tonight, or generic global-pop filler unless the Story Context truly calls for them.`;
    case 'k-band-rock':
      return `K-band / rock weaving: place target language where the riff, shout, gang line, or lift needs a strong consonant attack or open-vowel release. Favor short crowd-ready phrases and refrain callbacks; avoid long explanatory target-language blocks that weaken the live-band momentum.`;
    case 'k-hiphop-rap':
      return `K-hip-hop / melodic rap weaving: allow natural intra-line code-switching, internal rhyme, punch words, and beat-locked stress. A longer target-language run may occur inside an actual Rap section, but not as a sudden 5–6 line takeover in a sung Chorus. ${hasRap ? 'Use the rapper handoff as one intentional contrast point.' : 'Do not invent a rapper-only language block.'}`;
    case 'k-rnb-soul':
      return `K-R&B / soul weaving: use vowel-rich responses, ad-libs, internal echoes, and soft phrase overlap. Let Korean carry emotional detail while the target language colors release, intimacy, and hook resonance. Avoid subtitle alternation and hard language handoffs.`;
    default:
      return `Global-pop weaving: make both languages sound like one topline written at the same desk. Use phrase-level integration, shared cadence, and motif recall; avoid treating the languages as separate performers or separate songs.`;
  }
}

function buildSectionJobs(ratio: number, hasRap: boolean): LanguageArrangementSectionJob[] {
  if (ratio <= 10) {
    return [
      { section: 'Hook / Chorus or Post-hook tag', languageRole: 'one concise target-language sound motif', musicalPurpose: 'create a global memory point without interrupting the story', prosodyFocus: 'one clear stress peak, open or sonorous ending, easy recall' },
      { section: 'Final Chorus or Outro', languageRole: 'exact or lightly intensified motif recall', musicalPurpose: 'prove the switch was intentional', prosodyFocus: 'same cadence and rhyme family with a stronger final landing' },
    ];
  }
  if (ratio <= 20) {
    return [
      { section: 'Pre-Chorus / Chorus family', languageRole: 'one woven target phrase or compact hook cell', musicalPurpose: 'open the language door at a musical lift', prosodyFocus: 'complete syntax and matched breath' },
      { section: hasRap ? 'Verse 2 / Rap' : 'Verse 2 or Bridge', languageRole: 'one development phrase with genuinely new meaning', musicalPurpose: 'expand the song instead of translating the hook', prosodyFocus: hasRap ? 'internal rhyme and beat-locked consonants' : 'natural phrase cadence' },
      { section: 'Final Chorus / Outro', languageRole: 'phonetic or lyrical recall', musicalPurpose: 'close the language arc', prosodyFocus: 'shared ending sound or vowel color' },
    ];
  }
  if (ratio <= 30) {
    return [
      { section: 'Pre-Chorus / Chorus family', languageRole: 'mixed hook cell and one supporting phrase', musicalPurpose: 'establish a public-facing identity without target-language takeover', prosodyFocus: 'short matched lines, one rhyme family, memorable cadence' },
      { section: hasRap ? 'Verse 2 / Rap' : 'Verse 2', languageRole: 'role-specific development', musicalPurpose: 'change viewpoint or energy', prosodyFocus: hasRap ? 'internal rhyme and compact stress cells' : 'one-to-three connected lines' },
      { section: 'Bridge / Final Chorus / Outro', languageRole: 'transformed return', musicalPurpose: 'turn contrast into unity', prosodyFocus: 'phonetic callback without literal translation' },
    ];
  }
  if (ratio <= 50) {
    return [
      { section: 'Early phase', languageRole: 'small seed or woven phrase, not a separate-language monologue', musicalPurpose: 'prepare the listener before the main hook', prosodyFocus: 'natural syntax and cadence continuity' },
      { section: 'Chorus family', languageRole: 'bilingual hook architecture around one identity', musicalPurpose: 'make both languages share one melodic center', prosodyFocus: 'matched breath, rhyme family, vowel color, and stress' },
      { section: hasRap ? 'Verse 2 / Rap' : 'Middle phase', languageRole: 'contrast block or intra-line weave', musicalPurpose: 'add energy or perspective without subtitle repetition', prosodyFocus: hasRap ? 'internal rhyme and consonant drive' : 'phrase-level symmetry' },
      { section: 'Bridge / Final Chorus / Outro', languageRole: 'reset, integration, and recall', musicalPurpose: 'resolve both language identities as one song', prosodyFocus: 'return earlier sound motifs with the clearest final cadence' },
    ];
  }
  return [
    { section: 'Verse / Pre-Chorus / Chorus', languageRole: 'target language leads but remains woven into the same song identity', musicalPurpose: 'make the target language feel native rather than pasted on', prosodyFocus: 'native syntax, genre cadence, and smooth handoffs' },
    { section: 'Matrix-language anchors', languageRole: 'story, emotion, and identity phrases', musicalPurpose: 'retain Korean-style specificity and contrast', prosodyFocus: 'compact complete phrases with strong emotional weight' },
    { section: 'Final Chorus / Outro', languageRole: 'integrated climax with one recognisable matrix-language callback', musicalPurpose: 'finish with unity and recognition', prosodyFocus: 'shared sound motif, not direct translation' },
  ];
}

function buildEasySingInstruction(active: boolean, ratio: number, patterns: string[]): string {
  if (!active) return '';
  const oneWord = hasPattern(patterns, 'one-word');
  const shortRepeat = hasPattern(patterns, 'short-repeat');
  const circular = hasPattern(patterns, 'circular-refrain');
  return `EASY-SING CHORUS CONTRACT (ACTIVE):
- Easy-sing controls HOOK DICTION AND PROSODY, not the whole-song language ratio. It simplifies the primary hook into one or two compact lead lines with familiar vocabulary, stable breath groups, one obvious stress peak, and open or sonorous vowel landings.
- In a bilingual hook, use one compact mixed hook cell or a short target-language response/tag that shares the Korean anchor's cadence, rhyme family, and vowel color. Do not place a 5–6 line foreign paragraph inside the Chorus.
- The foreign phrase must add a memorable global sound identity; it must not merely translate the Korean line beside it.
- Keep target-only Chorus runs generally to ${ratio >= 60 ? 'three' : 'two'} lines or fewer unless the entire song is intentionally target-language led.
- ${oneWord ? 'One-word Hook owns the micro-token; Easy-sing only makes the surrounding lead line easier to sing.' : 'Do not invent a meaningless one-word token solely for simplicity.'}
- ${shortRepeat ? 'Short Hook Repeat owns repetition count; Easy-sing keeps the repeated line compact and comfortable.' : 'Do not repeat a weak line merely to simulate singalong impact.'}
- ${circular ? 'Circular Refrain owns where the phrase returns; Easy-sing owns how pronounceable and memorable that phrase is.' : 'Final Chorus or Outro should recall the hook sound when musically useful.'}
- Reject dangling fragments, dense consonant clusters, awkward literal translation, and mismatched line lengths. Meaning, pronunciation, rhyme, and crowd singability must agree.`;
}

export function buildLanguageArrangementPlan(input: LanguageArrangementDirectorInput): LanguageArrangementPlan {
  const ratio = clampRatio(input.requestedRatio) || 10;
  const patterns = Array.from(new Set((input.hookPatterns || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
  const hasRap = input.rapMode === 'on' || (input.rapMode === 'auto' && Boolean(input.hasRapperRole));
  const strategy = resolveStrategy(ratio);
  const sectionJobs = buildSectionJobs(ratio, hasRap);
  const contract = ratioSectionReference(ratio);
  const fixedHook = hasPattern(patterns, 'fixed-chorus') || hasPattern(patterns, 'circular-refrain');
  const callResponse = hasPattern(patterns, 'call-response');
  const easySingActive = hasPattern(patterns, 'easy-sing');
  const targetCount = Math.max(1, (input.targetLanguages || []).filter(Boolean).length);
  const structureContext = String(input.structureMode || '1');
  const vocalContext = Math.max(0, Number(input.vocalCount || 0));
  const genreContext = String(input.genreText || '').replace(/\s+/g, ' ').trim().slice(0, 180) || 'genre-adaptive';
  const genreProfile = resolveGenreProfile(genreContext);
  const genreInstruction = buildGenreInstruction(genreProfile, ratio, hasRap);
  const easySingInstruction = buildEasySingInstruction(easySingActive, ratio, patterns);

  const arcSummary = ratio <= 10
    ? 'Use one global sound motif and a late recall; do not scatter unrelated foreign lines.'
    : ratio <= 20
      ? 'Open one language doorway, develop it once, and recall it later.'
      : ratio <= 30
        ? 'Weave hook identity, role-specific development, and a transformed return.'
        : ratio <= 40
          ? 'Balance early seed, central hook, middle contrast, and final integration.'
          : ratio <= 50
            ? 'Share one topline identity through phrase-level weaving and selective coherent blocks.'
            : ratio <= 60
              ? 'Let the target language lead while Korean-style story and identity anchors remain active.'
              : 'Use the target language as the body while matrix-language hooks and story anchors preserve recognisable origin.';

  const sectionJobText = sectionJobs
    .map((job) => `  - ${job.section}: ${job.languageRole}; purpose=${job.musicalPurpose}; prosody=${job.prosodyFocus}.`)
    .join('\n');

  const promptInstruction = `LANGUAGE ARRANGEMENT DIRECTOR — WHOLE-SONG MUSICAL WEAVING:
- Strategy: ${strategy}. ${arcSummary}
- Section coverage reference only: ${contract.min}–${contract.max} real sections and about ${contract.zones} timeline zones can be useful at this ratio, but this is NOT a pass/fail quota. Fewer or more sections are valid when the musical role, concentration, transitions, and recall are convincing.
- Preferred phrase behavior: ${contract.block}.
- Active context: structure=${structureContext}; vocal ensemble=${vocalContext || 'unspecified'}; genre cues=${genreContext}; blend profile=${genreProfile}.
- Genre-specific direction: ${genreInstruction}
- Treat language as topline arrangement, vocal color, and dramaturgy—not a word-count overlay. The languages must sound written for one song, not assigned to separate Korean and foreign performers.
- Section jobs for this song:
${sectionJobText}
- Do not force every section to contain both languages. A monolingual section is allowed when it creates contrast, but no non-rap section should suddenly hand 5–6 consecutive lines to the target language after a long matrix-language run unless the song is explicitly target-language led and the transition is prepared.
- Prefer phrase weaving: compact mixed lines, paired hook cells, short response/tag phrases, and one-to-three-line development blocks. A full target-language block is allowed only when it has a clear viewpoint, vocalist, rap, bridge, or dramatic function and the surrounding song prepares and resolves it.
- Hook ownership: ${fixedHook ? 'The selected hook/refrain wording and language are protected. Build related phonetic material around it; never translate or replace it randomly.' : 'Choose one phonetic hook motif and preserve its stress, vowel color, rhyme identity, and emotional function across returns.'}
- ${callResponse ? 'Alternating languages are allowed only inside the explicit call-response event, where call and answer carry different meanings and vocal roles.' : 'Mechanical Korean/foreign A/B/A/B subtitle-style alternation is forbidden.'}
- Do not use a foreign line as a direct subtitle of the previous matrix-language line. Every switch must advance an image, decision, attitude, rhythm, or emotional angle.
- Phonetic/prosody requirements: align breath length, syllable density, stress placement, rhyme family, vowel color, consonant rhythm, and sustained-note vowels. Chorus favors memorable stress and open endings; Rap favors internal rhyme and beat-locked consonants; Pre-Chorus should make the language transition feel like a lift; Bridge may reverse the language relationship; Final Chorus should integrate or transform an earlier sound motif.
- Cross-language rhyme may be approximate when it sings naturally. Never choose an unrelated word only to rhyme.
- Korean classification: Korean-script everyday loanwords and established Konglish (버스, 커피, 핸드폰, 셀카, 파이팅, etc.) belong to the Korean matrix language. Latin-script phrases count as the target language. Never romanize Konglish to fake the ratio.
- Short ad-libs such as yeah, baby, okay, ooh, or let's go may color performance but cannot carry the language budget.
- With ${targetCount} target language${targetCount > 1 ? 's' : ''}, assign each target a distinct musical job. Do not rotate languages every line.
${easySingInstruction ? `- ${easySingInstruction.replace(/\n/g, '\n- ')}` : ''}
- Preserve the exact section skeleton and vocalist ownership. Replace only sung wording inside existing sections; never add, remove, merge, rename, or relocate structural sections.`;

  return {
    strategy,
    genreProfile,
    arcSummary,
    sectionJobs,
    minTargetSections: contract.min,
    maxTargetSections: contract.max,
    requiredTimelineZones: contract.zones,
    preferredBlockLength: contract.block,
    sectionCoverageIsReference: true,
    easySingActive,
    promptInstruction,
  };
}
