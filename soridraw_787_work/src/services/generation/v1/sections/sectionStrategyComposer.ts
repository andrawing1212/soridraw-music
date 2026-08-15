import type { V1SectionProfile } from './sectionBlueprint';

interface V1ExperimentalGrammar {
  openings: string[][];
  developments: string[][];
  secondActs: string[][];
  contrasts: string[][];
  payoffs: string[][];
  preferred: string[];
}

const GRAMMARS: Record<V1SectionProfile, V1ExperimentalGrammar> = {
  mainstream: {
    openings: [['Intro'], ['Intro', 'Hook']],
    developments: [['Verse', 'Pre-Chorus', 'Chorus'], ['Verse', 'Chorus'], ['Verse', 'Refrain', 'Verse', 'Refrain']],
    secondActs: [['Verse', 'Pre-Chorus', 'Chorus'], ['Verse', 'Break', 'Chorus'], ['Verse', 'Breakdown']],
    contrasts: [['Bridge'], ['Break', 'Bridge'], ['Breakdown', 'Bridge']],
    payoffs: [['Final Chorus', 'Outro'], ['Chorus', 'Final Chorus', 'Outro']],
    preferred: ['Verse', 'Chorus', 'Hook', 'Bridge', 'Final Chorus'],
  },
  rap: {
    openings: [['Intro'], ['Intro', 'Hook']],
    developments: [['Rap Section', 'Hook'], ['Rap Section', 'Build-Up', 'Drop']],
    secondActs: [['Rap Section', 'Hook'], ['Rap Section', 'Breakdown', 'Hook'], ['Rap Section', 'Break', 'Hook']],
    contrasts: [['Bridge'], ['Breakdown', 'Bridge'], ['Stop', 'Bridge']],
    payoffs: [['Final Hook', 'Outro'], ['Hook', 'Final Hook', 'Outro']],
    preferred: ['Rap Section', 'Hook', 'Breakdown', 'Final Hook'],
  },
  dance: {
    openings: [['Intro'], ['Intro', 'Hook']],
    developments: [['Verse', 'Build-Up', 'Drop'], ['Verse', 'Pre-Chorus', 'Chorus', 'Drop']],
    secondActs: [['Verse', 'Build-Up', 'Drop'], ['Verse', 'Chorus'], ['Hook', 'Build-Up', 'Drop']],
    contrasts: [['Breakdown'], ['Breakdown', 'Bridge'], ['Break', 'Bridge']],
    payoffs: [['Final Chorus', 'Outro'], ['Drop', 'Final Chorus', 'Outro']],
    preferred: ['Build-Up', 'Drop', 'Breakdown', 'Final Chorus'],
  },
  band: {
    openings: [['Intro'], ['Intro', 'Hook']],
    developments: [['Verse', 'Pre-Chorus', 'Chorus'], ['Verse', 'Chorus']],
    secondActs: [['Verse', 'Pre-Chorus', 'Chorus'], ['Verse', 'Break', 'Chorus'], ['Verse', 'Refrain', 'Verse', 'Refrain']],
    contrasts: [['Bridge'], ['Break', 'Bridge'], ['Breakdown', 'Bridge']],
    payoffs: [['Final Chorus', 'Outro'], ['Chorus', 'Final Chorus', 'Outro']],
    preferred: ['Verse', 'Chorus', 'Break', 'Bridge', 'Final Chorus'],
  },
  narrative: {
    openings: [['Intro'], ['Intro', 'Refrain']],
    developments: [['Verse', 'Chorus'], ['Verse', 'Refrain'], ['Verse', 'Refrain', 'Verse', 'Refrain']],
    secondActs: [['Verse', 'Chorus'], ['Verse', 'Refrain'], ['Verse']],
    contrasts: [['Bridge'], ['Instrumental', 'Bridge'], ['Break', 'Bridge']],
    payoffs: [['Final Chorus', 'Outro'], ['Refrain', 'Final Chorus', 'Outro']],
    preferred: ['Verse', 'Refrain', 'Bridge', 'Final Chorus'],
  },
  spacious: {
    openings: [['Intro'], ['Intro', 'Refrain']],
    developments: [['Verse', 'Pre-Chorus', 'Chorus'], ['Verse', 'Refrain'], ['Verse', 'Instrumental']],
    secondActs: [['Verse', 'Refrain'], ['Verse', 'Chorus'], ['Instrumental', 'Verse']],
    contrasts: [['Bridge'], ['Instrumental', 'Bridge'], ['Breakdown', 'Bridge']],
    payoffs: [['Final Chorus', 'Outro'], ['Refrain', 'Final Chorus', 'Outro']],
    preferred: ['Verse', 'Refrain', 'Instrumental', 'Bridge', 'Final Chorus'],
  },
  cinematic: {
    openings: [['Intro', 'Theme A'], ['Intro']],
    developments: [['Theme A', 'Verse', 'Theme B'], ['Verse', 'Theme B'], ['Theme A', 'Instrumental', 'Theme B']],
    secondActs: [['Verse', 'Chorus'], ['Instrumental', 'Verse'], ['Theme A', 'Theme B']],
    contrasts: [['Bridge'], ['Instrumental', 'Bridge'], ['Breakdown', 'Bridge']],
    payoffs: [['Climax', 'Outro'], ['Main Theme', 'Climax', 'Outro']],
    preferred: ['Theme A', 'Theme B', 'Instrumental', 'Bridge', 'Climax'],
  },
};

function simpleHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function base(value: string): string {
  return String(value || '')
    .replace(/^Final\s+Chorus$/i, 'Chorus')
    .replace(/^Final\s+Hook$/i, 'Hook')
    .replace(/\s+\d+$/i, '')
    .trim();
}

function isLyricFree(value: string): boolean {
  return /^(?:Break|Stop|Instrumental|Interlude)$/i.test(base(value));
}

function validSequence(sequence: string[]): boolean {
  if (sequence[0] !== 'Intro' || sequence[sequence.length - 1] !== 'Outro') return false;
  if (sequence.length < 7 || sequence.length > 11) return false;
  if (!sequence.some((name) => /^(?:Verse|Rap Section|Theme A)$/i.test(base(name)))) return false;
  if (!sequence.some((name) => /^(?:Final Chorus|Final Hook|Climax)$/i.test(name))) return false;
  if (!sequence.some((name) => /^(?:Bridge|Breakdown|Break|Stop|Instrumental|Theme B)$/i.test(base(name)))) return false;

  for (let index = 1; index < sequence.length; index += 1) {
    if (base(sequence[index]) === base(sequence[index - 1])) return false;
    if (isLyricFree(sequence[index]) && isLyricFree(sequence[index - 1])) return false;
  }

  const refrainCount = sequence.filter((name) => base(name) === 'Refrain').length;
  if (refrainCount !== 0 && refrainCount !== 2) return false;
  return true;
}

function scoreSequence(sequence: string[], grammar: V1ExperimentalGrammar): number {
  let score = 0;
  score += sequence.filter((name) => grammar.preferred.includes(base(name)) || grammar.preferred.includes(name)).length * 3;
  score -= Math.abs(sequence.length - 9);
  const unique = new Set(sequence.map(base)).size;
  score += Math.min(unique, 8);
  if (sequence.some((name) => /^Refrain$/i.test(base(name)))) score += 1;
  if (sequence.some((name) => /^(?:Breakdown|Break|Stop|Instrumental)$/i.test(base(name)))) score += 1;
  return score;
}

export function composeV1ExperimentalSections(
  profile: V1SectionProfile,
  entropy: string,
): string[] {
  const grammar = GRAMMARS[profile];
  const candidates: string[][] = [];
  grammar.openings.forEach((opening) => {
    grammar.developments.forEach((development) => {
      grammar.secondActs.forEach((secondAct) => {
        grammar.contrasts.forEach((contrast) => {
          grammar.payoffs.forEach((payoff) => {
            const sequence = [...opening, ...development, ...secondAct, ...contrast, ...payoff];
            if (validSequence(sequence)) candidates.push(sequence);
          });
        });
      });
    });
  });

  if (!candidates.length) return ['Intro', 'Verse', 'Chorus', 'Verse', 'Bridge', 'Final Chorus', 'Outro'];
  const ranked = candidates
    .map((sequence) => ({ sequence, score: scoreSequence(sequence, grammar), tie: simpleHash(`${entropy}|${sequence.join('>')}`) }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, Math.min(18, candidates.length));
  const picked = ranked[simpleHash(`${entropy}|pick`) % ranked.length];
  return [...picked.sequence];
}
