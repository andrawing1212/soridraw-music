export type LanguageArrangementStrategy =
  | 'accent-recall'
  | 'hook-orbit'
  | 'progressive-expansion'
  | 'role-contrast'
  | 'balanced-blocks'
  | 'target-dominant'
  | 'identity-anchor';

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
  arcSummary: string;
  sectionJobs: LanguageArrangementSectionJob[];
  promptInstruction: string;
}

const clampRatio = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const allowed = [0, 5, 10, 20, 30, 50, 70, 90];
  return allowed.reduce((best, candidate) => Math.abs(candidate - numeric) < Math.abs(best - numeric) ? candidate : best, 0);
};

const hasPattern = (patterns: string[], pattern: string) => patterns.some((item) => String(item || '').toLowerCase() === pattern);

function resolveStrategy(ratio: number): LanguageArrangementStrategy {
  if (ratio <= 5) return 'accent-recall';
  if (ratio <= 10) return 'hook-orbit';
  if (ratio <= 20) return 'progressive-expansion';
  if (ratio <= 30) return 'role-contrast';
  if (ratio <= 50) return 'balanced-blocks';
  if (ratio <= 70) return 'target-dominant';
  return 'identity-anchor';
}

function buildSectionJobs(ratio: number, hasRap: boolean): LanguageArrangementSectionJob[] {
  if (ratio <= 5) {
    return [
      { section: 'Chorus/Hook', languageRole: 'one compact target-language accent', musicalPurpose: 'listener entry point', prosodyFocus: 'short open vowels and a clean stressed landing' },
      { section: 'Final Chorus or Outro', languageRole: 'exact or lightly transformed recall', musicalPurpose: 'close the language motif', prosodyFocus: 'same rhyme family and similar breath length' },
    ];
  }
  if (ratio <= 10) {
    return [
      { section: 'Chorus/Hook', languageRole: 'main target-language motif', musicalPurpose: 'memorability without breaking the matrix-language story', prosodyFocus: '3–8 singable syllables, clear stress, no redundant wording' },
      { section: 'Final Chorus or Outro', languageRole: 'motif recall or emotional completion', musicalPurpose: 'make the foreign phrase feel intentional rather than inserted', prosodyFocus: 'same vowel color or end rhyme as the first motif' },
    ];
  }
  if (ratio <= 20) {
    return [
      { section: 'Chorus/Hook', languageRole: 'short target-language hook block', musicalPurpose: 'identity and memorability', prosodyFocus: 'open vowels, compact phrasing, repeatable cadence' },
      { section: hasRap ? 'Verse 2/Rap' : 'Verse 2 or Bridge', languageRole: 'one distinct contrast block', musicalPurpose: 'expand meaning instead of translating the hook', prosodyFocus: hasRap ? 'internal rhyme, consonant rhythm, stress-to-beat alignment' : 'natural syntax and matched breath length' },
      { section: 'Final Chorus/Outro', languageRole: 'return and resolve the motif', musicalPurpose: 'unify the whole arc', prosodyFocus: 'rhyme or vowel callback with a stronger final landing' },
    ];
  }
  if (ratio <= 30) {
    return [
      { section: 'Pre-Chorus or Chorus', languageRole: 'transition phrase leading into a target-language hook', musicalPurpose: 'make the switch feel musically earned', prosodyFocus: 'rising vowel openness and complete syntax' },
      { section: 'Chorus/Hook', languageRole: 'central target-language hook block', musicalPurpose: 'main public-facing motif', prosodyFocus: 'memorable stress pattern, end rhyme, strong vowel landing' },
      { section: hasRap ? 'Verse 2/Rap' : 'Verse 2', languageRole: 'new target-language content block', musicalPurpose: 'develop the story rather than repeat or translate', prosodyFocus: hasRap ? 'internal rhyme and rhythmic consonants' : 'two-to-three connected lines with stable breath' },
      { section: 'Bridge or Final Chorus', languageRole: 'contrast or transformed recall', musicalPurpose: 'create variation and final unity', prosodyFocus: 'motif transformation while preserving the phonetic family' },
    ];
  }
  if (ratio <= 50) {
    return [
      { section: 'Verse 1', languageRole: 'matrix-language story block or target-language opening block', musicalPurpose: 'establish one clear language perspective', prosodyFocus: 'continuous syntax, no subtitle-like line alternation' },
      { section: 'Chorus', languageRole: 'bilingual hook architecture', musicalPurpose: 'join both languages around one melodic identity', prosodyFocus: 'matched line lengths, rhyme-family continuity, clear stressed words' },
      { section: hasRap ? 'Verse 2/Rap' : 'Verse 2', languageRole: 'contrasting language block', musicalPurpose: 'change energy and viewpoint', prosodyFocus: hasRap ? 'internal rhyme and beat-locked stress' : 'phrase-block balance' },
      { section: 'Bridge', languageRole: 'one-language emotional contrast', musicalPurpose: 'reset before the final lift', prosodyFocus: 'longer vowels and direct emotional diction' },
      { section: 'Final Chorus', languageRole: 'integrated bilingual payoff', musicalPurpose: 'resolve both language identities as one song', prosodyFocus: 'reprise the hook sounds with a stronger cadence' },
    ];
  }
  if (ratio <= 70) {
    return [
      { section: 'Verse/Pre-Chorus/Chorus', languageRole: 'target language as the main lyric body', musicalPurpose: 'make the selected language feel native to the song', prosodyFocus: 'natural target-language syntax and section-specific phrasing' },
      { section: 'Matrix-language anchor sections', languageRole: 'compact identity or emotional anchor', musicalPurpose: 'retain the original cultural and narrative signature', prosodyFocus: 'short high-impact phrases, not alternating subtitles' },
      { section: 'Final Chorus/Outro', languageRole: 'target-language resolution with one matrix-language callback', musicalPurpose: 'close the arc with contrast and recognition', prosodyFocus: 'shared rhyme/vowel motif across both languages' },
    ];
  }
  return [
    { section: 'Most sections', languageRole: 'target language as the complete song body', musicalPurpose: 'near-total immersion', prosodyFocus: 'native syntax, natural rhyme, genre-appropriate cadence' },
    { section: 'One hook or final callback', languageRole: 'one short matrix-language identity anchor', musicalPurpose: 'signature contrast only', prosodyFocus: 'highly memorable sound shape and exact recurrence' },
  ];
}

export function buildLanguageArrangementPlan(input: LanguageArrangementDirectorInput): LanguageArrangementPlan {
  const ratio = clampRatio(input.requestedRatio);
  const patterns = Array.from(new Set((input.hookPatterns || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
  const hasRap = input.rapMode === 'on' || (input.rapMode === 'auto' && Boolean(input.hasRapperRole));
  const strategy = resolveStrategy(ratio);
  const sectionJobs = buildSectionJobs(ratio, hasRap);
  const fixedHook = hasPattern(patterns, 'fixed-chorus') || hasPattern(patterns, 'circular-refrain');
  const callResponse = hasPattern(patterns, 'call-response');
  const targetCount = Math.max(1, (input.targetLanguages || []).filter(Boolean).length);
  const structureContext = String(input.structureMode || '1');
  const vocalContext = Math.max(0, Number(input.vocalCount || 0));
  const genreContext = String(input.genreText || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'genre-adaptive';

  const arcSummary = ratio <= 10
    ? 'Introduce one foreign-language sound motif, then recall it later; do not scatter unrelated foreign lines.'
    : ratio <= 30
      ? 'Build a clear language arc: entry signal → hook identity → contrasting development block → final recall.'
      : ratio <= 50
        ? 'Balance languages by coherent section or phrase blocks while preserving one hook identity.'
        : ratio <= 70
          ? 'Use the target language as the main body and the matrix language as deliberate identity anchors.'
          : 'Use the target language almost throughout, preserving only one short matrix-language signature.';

  const sectionJobText = sectionJobs
    .map((job) => `  - ${job.section}: ${job.languageRole}; purpose=${job.musicalPurpose}; prosody=${job.prosodyFocus}.`)
    .join('\n');

  const promptInstruction = `LANGUAGE ARRANGEMENT DIRECTOR — WHOLE-SONG MUSICAL ARC:
- Strategy: ${strategy}. ${arcSummary}
- Active context: structure=${structureContext}; vocal ensemble=${vocalContext || 'unspecified'}; genre cues=${genreContext}.
- Treat language as part of the arrangement, not as a word-count overlay. Every switch must create one of these musical functions: hook entry, emotional lift, vocal handoff, rap contrast, bridge reset, or final recall.
- Section jobs for this song:
${sectionJobText}
- Hook ownership: ${fixedHook ? 'The chosen hook/refrain language and exact motif are protected. Reuse or transform it intentionally; never let ratio repair randomly translate it.' : 'Choose one phonetic hook motif and preserve its stress/rhyme identity across returns.'}
- ${callResponse ? 'Call-response may use alternating languages only inside the explicit response event; the call and response must carry different semantic roles.' : 'Do not use mechanical A/B/A/B line alternation.'}
- Phonetic/prosody requirements: match breath length, syllable density, stress placement, rhyme family, vowel color, and consonant rhythm to the section. Chorus favors open vowels and memorable stressed endings; Rap favors internal rhyme and beat-locked consonants; Pre-Chorus should open vowels as tension rises; Bridge may prioritize emotional clarity; Final Chorus must transform or intensify an earlier sound motif.
- Cross-language rhyme may use approximate sung rhyme when it sounds natural, but never force an unrelated word only to rhyme. Meaning, character voice, and singability must all survive.
- Korean-language classification: Korean-script everyday loanwords and established Konglish (for example 버스, 커피, 핸드폰, 셀카, 파이팅) belong to the Korean matrix language and must not be counted as English. Latin-script English phrases count as English. Do not insert romanized Konglish to fake the mix ratio.
- Short ad-libs such as yeah, baby, okay, ooh, or let's go may color performance but cannot carry the language budget by themselves.
- With ${targetCount} target language${targetCount > 1 ? 's' : ''}, assign each target a distinct musical job. Do not rotate languages every line.
- Preserve the exact section skeleton and vocalist ownership. Language arrangement may replace sung wording inside a section, but may not add, remove, merge, rename, or relocate sections.`;

  return { strategy, arcSummary, sectionJobs, promptInstruction };
}
