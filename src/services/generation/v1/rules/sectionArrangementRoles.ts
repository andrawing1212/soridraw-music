/**
 * V1 section-role and section-by-section arrangement contract.
 *
 * This module contains structural music roles only. It must never contain
 * topic-specific mappings, story examples, named places, objects, or fixed
 * emotional plots.
 */

export interface V1SectionRoleDefinition {
  label: string;
  role: string;
}

export interface V1ProducerDirectionContext {
  tempo?: string;
  grooveHint?: string;
  productionTextureHint?: string;
  identityHint?: string;
  transitionHint?: string;
  payoffHint?: string;
  genre?: string;
  instruments?: string;
  vocals?: string;
  atmosphere?: string;
  vocalMode?: 'solo' | 'duo' | 'group';
  isInstrumental?: boolean;
}

const ROLE_DEFINITIONS: Array<{ pattern: RegExp; definition: V1SectionRoleDefinition }> = [
  {
    pattern: /^intro$/i,
    definition: {
      label: 'Intro',
      role: 'establish the song world, spatial scale, and one recognizable sound before the story fully starts',
    },
  },
  {
    pattern: /^verse(?:\s+\d+|\s+[a-z])?$/i,
    definition: {
      label: 'Verse',
      role: 'carry scene detail, character action, and the main rhythmic or vocal baseline without spending the full payoff',
    },
  },
  {
    pattern: /^rap(?:\s+section|\s+verse)?$/i,
    definition: {
      label: 'Rap Section',
      role: 'increase rhythmic diction, narrative pressure, or viewpoint contrast while staying inside the same scene',
    },
  },
  {
    pattern: /^pre[-\s]?chorus$/i,
    definition: {
      label: 'Pre-Chorus',
      role: 'raise tension by changing density, harmony, rhythm, vocal distance, or space before the main release',
    },
  },
  {
    pattern: /^chorus$/i,
    definition: {
      label: 'Chorus',
      role: 'deliver the central desire or hook with the clearest genre identity and a stronger sound state',
    },
  },
  {
    pattern: /^final[-\s]?chorus$/i,
    definition: {
      label: 'Final Chorus',
      role: 'return the main hook with a clearly changed scale, vocal state, arrangement density, or emotional meaning',
    },
  },
  {
    pattern: /^post[-\s]?chorus$/i,
    definition: {
      label: 'Post-Chorus',
      role: 'extend the chorus afterimage through a short motif, rhythm, sound, or vocal fragment without starting a new story',
    },
  },
  {
    pattern: /^hook$/i,
    definition: {
      label: 'Hook',
      role: 'foreground the single most memorable phrase, melodic shape, rhythmic cell, or signature sound',
    },
  },
  {
    pattern: /^refrain$/i,
    definition: {
      label: 'Refrain',
      role: 'return the same short lyric and melodic idea so the listener recognizes it immediately',
    },
  },
  {
    pattern: /^build[-\s]?up$/i,
    definition: {
      label: 'Build-Up',
      role: 'stack rhythm, texture, range, or vocal urgency toward the next impact without delivering that impact early',
    },
  },
  {
    pattern: /^pre[-\s]?drop$/i,
    definition: {
      label: 'Pre-Drop',
      role: 'remove or narrow key layers for one unmistakable anticipation moment immediately before the drop',
    },
  },
  {
    pattern: /^drop$/i,
    definition: {
      label: 'Drop',
      role: 'shift the main impact to rhythm, bass, signature sound, body movement, or a compact vocal hook',
    },
  },
  {
    pattern: /^breakdown$/i,
    definition: {
      label: 'Breakdown',
      role: 'remove density and expose one emotional, harmonic, vocal, or instrumental core before rebuilding',
    },
  },
  {
    pattern: /^bridge$/i,
    definition: {
      label: 'Bridge',
      role: 'change perspective, harmony, vocal attitude, texture, or section ownership before the final return',
    },
  },
  {
    pattern: /^(?:instrumental|solo)$/i,
    definition: {
      label: 'Instrumental',
      role: 'let the selected instruments and sound design carry the scene without lyric exposition',
    },
  },
  {
    pattern: /^interlude$/i,
    definition: {
      label: 'Interlude',
      role: 'connect two song states through a concise no-vocal musical transition',
    },
  },
  {
    pattern: /^dance[-\s]?break$/i,
    definition: {
      label: 'Dance Break',
      role: 'prioritize body rhythm, performance motion, and the most physical selected sound',
    },
  },
  {
    pattern: /^break$/i,
    definition: {
      label: 'Break',
      role: 'create a short interruption, reset, cut, or contrast that clearly prepares the next section',
    },
  },
  {
    pattern: /^stop$/i,
    definition: {
      label: 'Stop',
      role: 'use intentional silence or a hard cut as a structural event, not as an empty accidental gap',
    },
  },
  {
    pattern: /^theme\s*a$/i,
    definition: {
      label: 'Theme A',
      role: 'state the first recognizable melodic or rhythmic motif clearly',
    },
  },
  {
    pattern: /^theme\s*b$/i,
    definition: {
      label: 'Theme B',
      role: 'answer or contrast Theme A with a distinct but related motif',
    },
  },
  {
    pattern: /^main\s*theme$/i,
    definition: {
      label: 'Main Theme',
      role: 'present the core melodic or rhythmic identity at full clarity',
    },
  },
  {
    pattern: /^climax$/i,
    definition: {
      label: 'Climax',
      role: 'deliver the highest justified energy and emotional pressure by combining previously established elements',
    },
  },
  {
    pattern: /^outro$/i,
    definition: {
      label: 'Outro',
      role: 'resolve or deliberately leave the scene with a distinct ending texture, gesture, or final vocal state',
    },
  },
];

const clean = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim();

function stripStructureAnnotations(value: string): string {
  return clean(value)
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*:\s*.*$/g, '')
    .trim();
}

function stripOccurrenceSuffix(value: string): string {
  return clean(value).replace(/\s+\d+$/g, '').trim();
}

function resolveBaseRoleDefinition(sectionName: string): V1SectionRoleDefinition {
  const cleaned = stripOccurrenceSuffix(
    stripStructureAnnotations(sectionName)
      .replace(/\bRap\s+Verse\b/gi, 'Rap Section')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );
  const found = ROLE_DEFINITIONS.find(({ pattern }) => pattern.test(cleaned));
  if (found) return found.definition;
  return {
    label: cleaned || 'Section',
    role: 'give this section one clear musical function that advances or contrasts the surrounding sections',
  };
}

function canonicalizeSectionLabel(sectionName: string): string {
  const cleaned = stripStructureAnnotations(sectionName)
    .replace(/\bRap\s+Verse\b/gi, 'Rap Section')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const suffix = cleaned.match(/\s+(\d+)$/)?.[1] || '';
  const base = resolveBaseRoleDefinition(cleaned).label;
  return suffix ? `${base} ${suffix}` : base;
}

function resolveRoleDefinition(sectionName: string): V1SectionRoleDefinition {
  const canonicalLabel = canonicalizeSectionLabel(sectionName);
  const base = resolveBaseRoleDefinition(canonicalLabel);
  return { ...base, label: canonicalLabel || base.label };
}

export function extractV1ArrangementSections(exactStructureText: string): V1SectionRoleDefinition[] {
  const rawSections = String(exactStructureText || '')
    .split(/\s*(?:→|>|\n)\s*/)
    .map(stripStructureAnnotations)
    .filter(Boolean);

  if (!rawSections.length) return [];

  const baseResolved = rawSections.map(resolveBaseRoleDefinition);
  const totals = new Map<string, number>();
  for (const item of baseResolved) {
    const key = item.label.toLowerCase();
    totals.set(key, (totals.get(key) || 0) + 1);
  }

  const seen = new Map<string, number>();
  return baseResolved.map((item) => {
    const key = item.label.toLowerCase();
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    const total = totals.get(key) || 1;

    if (item.label === 'Chorus' && total >= 2 && occurrence === total) {
      return { ...resolveBaseRoleDefinition('Final Chorus'), label: 'Final Chorus' };
    }

    if (total >= 2) {
      return { ...item, label: `${item.label} ${occurrence}` };
    }

    return { ...item };
  });
}

export function buildV1CommonSectionRoleReference(exactStructureText = ''): string {
  const active = extractV1ArrangementSections(exactStructureText);
  const definitions = active.length
    ? active
    : ROLE_DEFINITIONS.map((item) => item.definition).filter((item, index, all) => all.findIndex((other) => other.label === item.label) === index);
  return definitions.map((item) => `- ${item.label}: ${item.role}.`).join('\n');
}

export function buildV1ArrangementSectionPlanInstruction(
  exactStructureText: string,
  directUserDirectives = '',
  vocalModeContext = '',
): string {
  const active = extractV1ArrangementSections(exactStructureText);
  const activeText = active.length ? active.map((item) => item.label).join(' → ') : 'Use the generated song structure';
  const directDirectiveText = clean(directUserDirectives) || 'None';
  const vocalContextText = clean(vocalModeContext) || 'Infer from the current vocal configuration';

  return `V1 PRODUCER DIRECTION MAP RULE (MANDATORY):
- [Arrangement] is a concise producer direction map, not a checklist that describes every section.
- Current song structure: ${activeText}. Use it as timing context, but mention only sections where a meaningful musical change happens.
- Current vocal arrangement context: ${vocalContextText}.
- Build the line in this priority: tempo and groove → one signature identity → two or three decisive contrast moves → final payoff.
- The signature identity must be one memorable production behavior derived from the current Genre, selected Style, Sound, Vocals, Story Context, and user direction. Do not merely repeat keyword labels.
- Convert selected styles into roles instead of copying all style names: rhythm-oriented styles may shape groove; transition-oriented styles may shape a decisive turn; hook-oriented styles may shape Chorus or final payoff; spatial/era textures belong mainly in [Instruments] or [Atmosphere] unless they cause an audible arrangement move.
- For a solo, prioritize vocal space, register/dynamic arc, and one instrument-to-vocal response.
- For a duet, prioritize meaningful lead handoff, register/tone contrast, and only one compact shared-harmony payoff.
- For three or more vocalists, summarize role rotation and group payoff; never list every member in every section.
- Protect explicit user production instructions. Named-section instructions, instrumental/vocal-only requests, silence, repetition, shortness, entry/exit timing, and ending behavior outrank automatic choices.
- V1 STABILITY BOUNDARY: do not output score symbols, exact note chains, exact keys, octave targets, p/mf/f markings, crescendo, diminuendo, or other experimental notation. Those controls belong to v2. When such text appears in a broad user note, keep only its safe musical intent in ordinary relative language.
- Keep all directions inside the same Story Context and emotional progression. [Arrangement] controls musical movement; it must not invent a second story.
- For a solo, prefer 3 compact event clauses after tempo: signature identity, decisive transition, and final payoff. For a duet or group, allow up to 4 event clauses when a vocal handoff or shared payoff genuinely needs its own slot. Do not force generic Verse/Pre-Chorus/Chorus descriptions merely to fill space.
- Avoid vague filler such as “raise tension,” “release the hook,” or “clear contrast” unless the clause also states the audible action that creates it.
- Format: <tempo and groove>; <signature identity>; <decisive transition>; <final payoff>.
- [Arrangement] sets the whole-song map. Lyric section tags execute only the local change for their own section, so do not duplicate the same full sentence in both places.

DIRECT USER PRODUCTION / SECTION INSTRUCTIONS TO PROTECT:
${directDirectiveText}`.trim();
}

const KNOWN_SECTION_BASE_PATTERN = '(?:Final\\s+Chorus|Post[-\\s]?Chorus|Pre[-\\s]?Chorus|Rap\\s+Section|Rap\\s+Verse|Build[-\\s]?Up|Pre[-\\s]?Drop|Dance[-\\s]?Break|Main\\s+Theme|Theme\\s+[AB]|Intro|Verse|Chorus|Hook|Refrain|Drop|Breakdown|Bridge|Instrumental|Interlude|Climax|Break|Stop|Outro|Solo)';
const KNOWN_SECTION_LABEL_PATTERN = `${KNOWN_SECTION_BASE_PATTERN}(?:\\s+\\d+)?`;
const SECTION_DIRECTIVE_REGEX = new RegExp(`(?:^|[;,|])\\s*${KNOWN_SECTION_LABEL_PATTERN}\\s*:`, 'i');

export function isV1SectionStructuredArrangement(value: string): boolean {
  return SECTION_DIRECTIVE_REGEX.test(String(value || ''));
}

function splitStructuredArrangement(value: string): string[] {
  let cleaned = clean(value)
    .replace(/\s*[|\n]+\s*/g, '; ')
    .replace(new RegExp(`,\\s*(?=${KNOWN_SECTION_LABEL_PATTERN}\\s*:)`, 'gi'), '; ')
    .replace(/;\s*;/g, '; ')
    .replace(/^;+|;+$/g, '')
    .trim();

  const parts = cleaned.split(/\s*;\s*/).map(clean).filter(Boolean);
  if (parts.length > 1) return parts;
  cleaned = cleaned.replace(new RegExp(`\\s+(?=${KNOWN_SECTION_LABEL_PATTERN}\\s*:)`, 'gi'), '; ');
  return cleaned.split(/\s*;\s*/).map(clean).filter(Boolean);
}

function cleanStructuredCue(cue: string): string {
  return clean(cue)
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .replace(/\b(?:and|with|then|into)\s*$/i, '')
    .trim();
}

export function normalizeV1SectionStructuredArrangement(value: string): string {
  const raw = clean(value);
  if (!raw) return '';
  const tempoMatch = raw.match(/\b\d{2,3}\s*(?:–|-|~)\s*\d{2,3}\s*BPM\b|\b\d{2,3}\s*BPM\b/i);
  const parts = splitStructuredArrangement(raw.replace(tempoMatch?.[0] || '', '').replace(/^[,;:\s]+/, ''));
  const output: string[] = [];
  const seen = new Set<string>();
  if (tempoMatch) output.push(tempoMatch[0].replace(/\s*~\s*/, '–'));
  for (const part of parts) {
    const match = part.match(new RegExp(`^\\s*(${KNOWN_SECTION_LABEL_PATTERN})\\s*:\\s*(.+)$`, 'i'));
    if (!match) continue;
    const role = resolveRoleDefinition(match[1]);
    const cue = cleanStructuredCue(match[2]);
    if (!cue) continue;
    const key = `${role.label.toLowerCase()}::${cue.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(`${role.label}: ${cue}`);
  }
  return output.join('; ');
}

function cueFamily(cue: string): string {
  const value = clean(cue).toLowerCase();
  if (/\b(?:final|last|climax|peak|return|reprise|ending|outro)\b.*\b(?:higher|wider|widens?|widened|fuller|expanded|unison|harmony|choir|register|scale|release|strip|fade|collapse|change|exchange)\b|\b(?:higher|wider|widens?|widened|fuller|expanded)\b.*\b(?:final|last|return|reprise|chorus|hook)\b/.test(value)) return 'payoff';
  if (/answer|respond|counterline|recurring|signature|motif|riff|ostinato|phrase exchange|vocal exchange|lead exchange/.test(value)) return 'identity';
  if (/break|silence|strip|fall away|remove|sparse|empty|collapse|pause|stop|cut|expose|narrow/.test(value)) return 'break';
  if (/turn|contrast|transition|switch|shift|change|handoff|exchange|enter|exit|open|expand|rebuild/.test(value)) return 'transition';
  if (/build|rise|rising|tension|lift|climb|register/.test(value)) return 'build';
  if (/drop|impact|808|sub[-\s]?bass|heavy beat/.test(value)) return 'drop';
  if (/hook|chorus|refrain|chant|singalong|catchy|memorable/.test(value)) return 'hook';
  if (/space|room|reverb|echo|ambient|atmosphere|haze|texture|wide/.test(value)) return 'space';
  if (/rhythm|groove|pulse|beat|swing|bounce|flow|syncop/.test(value)) return 'rhythm';
  if (/vocal|phrase|sing|rap|spoken|whisper|delivery|choir|harmony|octave|unison|overlap/.test(value)) return 'vocal';
  if (/instrument|guitar|piano|synth|drum|string|brass|percussion|melody|accordion|bass/.test(value)) return 'instrument';
  return 'other';
}

function compactCueWords(cue: string, wordBudget = 16): string {
  const cleaned = cleanStructuredCue(cue).replace(/\b(?:with|and|then|into)\s*$/i, '').trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= wordBudget) return cleaned;
  return cleanStructuredCue(words.slice(0, wordBudget).join(' '));
}

function isGenericProducerCue(cue: string): boolean {
  const value = cleanStructuredCue(cue);
  return /^(?:establish the scene and core sound|hold narrative detail over restrained motion|raise tension through one clear change|release the central hook with fuller energy|return the hook with a clearly changed scale|change perspective or texture before the return|resolve the scene with a distinct ending texture|give this section one clear musical function|clear sectional contrast|focused hook(?: release)?|refreshing section lift|large-scale narrative expansion|genre-led section flow|story-shaped section flow|custom section flow|emotional build|controlled emotional turn|section lift|narrative expansion|cinematic development|emotional progression|dynamic progression)$/i.test(value)
    || /^(?:focused|refreshing|emotional|narrative|large-scale|clear|controlled|genre-led|story-shaped|cinematic|dynamic)\s+(?:hook|lift|build|turn|flow|expansion|contrast|development|progression)$/i.test(value);
}

function stripAbstractProducerTail(value: string): string {
  let output = cleanStructuredCue(value);
  const tail = /(?:[,;]\s*|\s+)(?:focused hook(?: release)?|refreshing section lift|large-scale narrative expansion|genre-led section flow|story-shaped section flow|custom section flow|emotional build|controlled emotional turn|section lift|narrative expansion|cinematic development|emotional progression|dynamic progression)\s*$/i;
  while (tail.test(output)) output = cleanStructuredCue(output.replace(tail, ''));
  return isGenericProducerCue(output) ? '' : output;
}

function isPrecisionProducerCue(cue: string): boolean {
  const value = clean(cue);
  return /(?:\b[A-G](?:#|b)?\d?\b\s*(?:→|->|–|~)\s*\b[A-G](?:#|b)?\d?\b)|(?:\b[A-G](?:#|b)?\s+(?:major|minor)\b)|(?:\b(?:major|minor)\s+(?:key|harmony)\b)|(?:\b(?:pp|mp|mf|ff)\b)|(?:\bcrescendo\b|\bdiminuendo\b|\bdecrescendo\b)|(?:장조|단조|옥타브|octave|정확한\s*음|note\s*pattern|음들을?\s*반복|정확한\s*화음)/i.test(value);
}

function isLockedProducerCue(cue: string): boolean {
  return /\b(?:no|without|only|instrumental|vocal-only|short|repeat|repeated|silence|silent|hard cut|stop|pause|fade|end|ending|intro|outro)\b|(?:없이|금지|반복|짧게|멈춤|정지|무보컬|보컬만|악기만|인트로|아웃트로|마지막)/i.test(clean(cue));
}

type ProducerCueEntry = { label: string; cue: string; family: string; order: number };

function parseProducerCueEntries(value: string): { tempo: string; entries: ProducerCueEntry[] } {
  const raw = clean(value);
  const tempo = raw.match(/\b\d{2,3}\s*(?:–|-|~)\s*\d{2,3}\s*BPM\b|\b\d{2,3}\s*BPM\b/i)?.[0]?.replace(/\s*~\s*/, '–') || '';
  const withoutTempo = raw.replace(tempo, '').replace(/^[,;:\s]+/, '');
  const chunks = isV1SectionStructuredArrangement(withoutTempo)
    ? splitStructuredArrangement(withoutTempo)
    : withoutTempo.split(/\s*;\s*|\s*,\s*/).map(clean).filter(Boolean);
  const entries: ProducerCueEntry[] = [];
  chunks.forEach((chunk, order) => {
    const match = chunk.match(new RegExp(`^\\s*(${KNOWN_SECTION_LABEL_PATTERN})\\s*:\\s*(.+)$`, 'i'));
    const label = match ? resolveRoleDefinition(match[1]).label : '';
    const cue = stripAbstractProducerTail(match ? match[2] : chunk);
    if (!cue || isGenericProducerCue(cue)) return;
    entries.push({ label, cue, family: cueFamily(cue), order });
  });

  const looseVocalEntries = entries.filter((entry) => !entry.label && /^Vocal\s+[A-Z]\b/i.test(entry.cue));
  if (looseVocalEntries.length >= 2) {
    const selected = looseVocalEntries.slice(0, 3);
    const combinedCue = selected.map((entry) => entry.cue).join(' while ');
    const mergedOrders = new Set(selected.map((entry) => entry.order));
    const merged = entries.filter((entry) => !mergedOrders.has(entry.order));
    merged.push({ label: '', cue: combinedCue, family: 'vocal', order: selected[0].order });
    merged.sort((a, b) => a.order - b.order);
    return { tempo, entries: merged };
  }
  return { tempo, entries };
}

function producerCueKey(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9가-힣#]+/g, ' ').trim();
}

function chooseProducerEntry(entries: ProducerCueEntry[], used: Set<number>, predicate: (entry: ProducerCueEntry) => boolean): ProducerCueEntry | undefined {
  const found = entries.find((entry) => !used.has(entry.order) && predicate(entry));
  if (found) used.add(found.order);
  return found;
}

function formatProducerEntry(entry: ProducerCueEntry, budget = 16): string {
  const cue = isPrecisionProducerCue(entry.cue) ? cleanStructuredCue(entry.cue) : compactCueWords(entry.cue, budget);
  if (!cue) return '';
  if (!entry.label) return cue;
  const base = resolveBaseRoleDefinition(entry.label).label;
  if (/^(?:Pre-Chorus|Bridge|Breakdown|Build-Up|Pre-Drop|Break|Stop|Chorus|Final Chorus|Climax|Drop)$/i.test(base)) return `${entry.label}: ${cue}`;
  return cue;
}

function compactV1ProducerDirectionMap(value: string, maxClauses = 4): string {
  const clauseLimit = Math.max(2, Math.min(4, Math.floor(maxClauses || 4)));
  const { tempo, entries } = parseProducerCueEntries(value);
  const stableEntries = entries.filter((entry) => !isPrecisionProducerCue(entry.cue));
  if (!tempo && !stableEntries.length) return '';
  const used = new Set<number>();

  const rhythm = chooseProducerEntry(stableEntries, used, (entry) => entry.family === 'rhythm');
  const identity = chooseProducerEntry(stableEntries, used, (entry) => {
    const base = resolveBaseRoleDefinition(entry.label).label;
    if (!entry.label || /\b(?:no\s+rap|rap\s+section|rap\s+delivery)\b/i.test(entry.cue)) return false;
    return !/^(?:Pre-Chorus|Bridge|Breakdown|Build-Up|Pre-Drop|Break|Stop|Final Chorus|Climax|Outro)$/i.test(base)
      && ['identity', 'instrument', 'vocal', 'hook', 'drop', 'other', 'transition', 'space'].includes(entry.family);
  });
  const transition = chooseProducerEntry(stableEntries, used, (entry) => {
    const base = resolveBaseRoleDefinition(entry.label).label;
    return /^(?:Pre-Chorus|Bridge|Breakdown|Build-Up|Pre-Drop|Break|Stop)$/i.test(base);
  }) || chooseProducerEntry(stableEntries, used, (entry) => ['build', 'break', 'transition', 'space'].includes(entry.family));
  const payoff = chooseProducerEntry(stableEntries, used, (entry) => {
    const base = resolveBaseRoleDefinition(entry.label).label;
    return entry.family === 'payoff' || /^(?:Final Chorus|Climax|Outro)$/i.test(base) || /\b(?:final|last)\s+(?:chorus|refrain)|\bclimax\b/i.test(entry.cue);
  }) || chooseProducerEntry(stableEntries, used, (entry) => {
    const base = resolveBaseRoleDefinition(entry.label).label;
    return /^(?:Chorus|Drop)$/i.test(base) || ['hook', 'build', 'drop', 'vocal'].includes(entry.family);
  });

  // In the compact three-clause map, fold groove into the tempo clause so the three visible
  // event slots remain identity -> decisive transition -> final payoff. This prevents the final
  // payoff from being dropped merely because a separate groove clause consumed one slot.
  const chosen: ProducerCueEntry[] = [];
  const add = (entry?: ProducerCueEntry) => {
    if (!entry) return;
    const key = producerCueKey(entry.cue);
    if (!key || chosen.some((item) => producerCueKey(item.cue) === key)) return;
    chosen.push(entry);
  };
  if (clauseLimit >= 4) add(rhythm);
  add(identity);
  add(transition);
  add(payoff);

  stableEntries.filter((entry) => isLockedProducerCue(entry.cue)).forEach((entry) => {
    if (chosen.length < clauseLimit) add(entry);
  });
  stableEntries.forEach((entry) => {
    if (chosen.length >= clauseLimit || used.has(entry.order)) return;
    add(entry);
  });

  const clauses = chosen.slice(0, clauseLimit)
    .map((entry) => formatProducerEntry(entry, clauseLimit >= 4 ? 14 : 13))
    .filter(Boolean);
  const compactGroove = clauseLimit <= 3 && rhythm ? formatProducerEntry(rhythm, 10) : '';
  const tempoAndGroove = [tempo, compactGroove].filter(Boolean).join(', ');
  return [tempoAndGroove, ...clauses].filter(Boolean).join('; ');
}

export function compactV1SectionStructuredArrangement(value: string, maxClauses = 4): string {
  return compactV1ProducerDirectionMap(value, maxClauses);
}

export function ensureV1ArrangementSectionCoverage(value: string, _exactStructureText: string): string {
  return compactV1ProducerDirectionMap(value) || clean(value);
}

export function buildV1ArrangementSectionSkeleton(_exactStructureText: string, sourceLine: string): string {
  return compactV1ProducerDirectionMap(sourceLine) || clean(sourceLine);
}

function stripProducerLabel(value: string): string {
  return cleanStructuredCue(
    clean(value)
      .replace(new RegExp(`^\\s*${KNOWN_SECTION_LABEL_PATTERN}\\s*:\\s*`, 'i'), '')
      .replace(/^\[?Arrangement\]?\s*/i, ''),
  );
}

function isAudibleProducerAction(value: string): boolean {
  const cue = stripProducerLabel(value).toLowerCase();
  if (!cue || isGenericProducerCue(cue) || isPrecisionProducerCue(cue)) return false;
  const action = /\b(?:answer|respond|echo|return|recur|repeat|trade|frame|mark|anchor|carry|drop|strip|pull|fall|thin|narrow|open|expand|widen|switch|shift|handoff|exchange|rotate|overlap|unison|harmon|enter|exit|cut|pause|stop|fade|collapse|rebuild|build|rise|swell|expose|double|support|reinforce)\w*\b/i.test(cue);
  const target = /\b(?:drums?|percussion|bass|low end|synth|guitar|piano|keys?|strings?|brass|horn|accordion|instrument|voice|vocal|lead|harmony|choir|ensemble|texture|mix|rhythm|groove|pulse|hook|chorus|refrain|motif|riff|phrase|line|register|space|section|beat)\b/i.test(cue);
  return action && target;
}

function compactProducerClause(value: string, budget = 15): string {
  return compactCueWords(
    stripProducerLabel(value)
      .replace(/^[,;\s]+|[,;\s]+$/g, '')
      .replace(/\s*,\s*;/g, ';')
      .replace(/\s{2,}/g, ' '),
    budget,
  );
}

function extractGenreCore(value: string): string {
  const head = clean(value)
    .split(/\s+with\s+|,|\bedge\b|\bcolor\b/i)[0]
    .replace(/\bfusion\b/gi, ' ')
    .replace(/\b(?:sorrowful|sad|dark|bright|cool|warm|strange|urban|subtle|mystic|mild|heavy|soft|open|breezy|emotional|dreamy|melancholic|playful|intense|calm|modern|vintage)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!head) return '';
  return head.split(/\s+/).slice(-4).join(' ');
}

function deriveGrooveFromGenre(value: string): string {
  const core = extractGenreCore(value);
  if (!core) return 'genre-shaped rhythmic flow';
  const lower = core.toLowerCase();
  const suffix = /(?:ballad|opera|classical|ambient|drone|score|folk)/i.test(lower)
    ? 'flow'
    : /(?:rock|band|edm|techno|trance|drill|breakbeat)/i.test(lower)
      ? 'pulse'
      : 'groove';
  return `${core} ${suffix}`;
}

function pickGrooveCue(value: string, context: V1ProducerDirectionContext): string {
  const candidates = [value, context.grooveHint || '']
    .flatMap((source) => parseProducerCueEntries(source).entries)
    .filter((entry) => entry.family === 'rhythm')
    .map((entry) => compactProducerClause(entry.cue, 11))
    .filter((cue) => cue && !isGenericProducerCue(cue));
  const specific = candidates.find((cue) => /\b(?:swing|afrobeat|funk|trot|garage|house|rock|band|drill|trap|reggae|jazz|soul|disco|pulse|groove|rhythm|pocket|bounce)\b/i.test(cue));
  return specific || candidates[0] || deriveGrooveFromGenre(context.genre || '');
}

function instrumentKey(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/\b(?:warm|bright|dark|soft|heavy|complex|sparkling|driving|vintage|retro|modern|clean|distorted|melodic|traditional|full|symphonic|funky|steady)\b/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ProducerResourceKind = 'melodic' | 'rhythmic' | 'low' | 'ensemble' | 'spatial' | 'other';

type ProducerResource = {
  text: string;
  key: string;
  kind: ProducerResourceKind;
  score: number;
  order: number;
};

type ProducerSlot = 'identity' | 'transition' | 'payoff';

type ProducerCandidate = {
  text: string;
  slot: ProducerSlot;
  source: 'existing' | 'generated';
  locked: boolean;
  resources: string[];
  actions: string[];
};

function stableTextHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function classifyProducerResource(value: string): ProducerResourceKind {
  const text = clean(value).toLowerCase();
  if (/\b(?:808|sub[-\s]?bass|bass|low end|low-end)\b/.test(text)) return 'low';
  if (/\b(?:drums?|percussion|rhythm|beat|kick|snare|hi-hat|hihat|cowbell|clap|shaker|janggu|tambourine)\b/.test(text)) return 'rhythmic';
  if (/\b(?:orchestra|orchestral|ensemble|strings?|brass section|choir|full band|horn section)\b/.test(text)) return 'ensemble';
  if (/\b(?:pad|ambient|ambience|reverb|echo|noise|drone|texture|haze|room tone|field recording)\b/.test(text)) return 'spatial';
  if (/\b(?:synth|guitar|piano|keys?|organ|accordion|horn|brass|flute|sax|trumpet|trombone|violin|cello|harp|gayageum|haegeum|kkwaenggwari|taepyeongso|shakuhachi|sampler|melody|riff|lead)\b/.test(text)) return 'melodic';
  return 'other';
}

function extractProducerResources(value: string): ProducerResource[] {
  const raw = clean(value)
    .split(/\s*,\s*|\s*;\s*/)
    .map((item) => compactProducerClause(item, 6))
    .filter(Boolean)
    .filter((item) => !/\b(?:no vocals?|no humming|instrumental only|supporting the topline|without overcrowding|shadowed weight|room tone|audio quality)\b/i.test(item));

  const resources = raw.map((item, order) => {
    const kind = classifyProducerResource(item);
    let score = 1;
    if (kind === 'melodic') score += 5;
    if (kind === 'ensemble') score += 4;
    if (kind === 'rhythmic') score += 3;
    if (kind === 'low') score += 3;
    if (kind === 'spatial') score += 2;
    if (/\b(?:lead|melody|counter|riff|motif|signature)\b/i.test(item)) score += 2;
    return {
      text: item.toLowerCase(),
      key: instrumentKey(item),
      kind,
      score,
      order,
    } satisfies ProducerResource;
  }).filter((resource) => resource.key);

  const deduped: ProducerResource[] = [];
  for (const resource of resources) {
    if (deduped.some((old) => old.key === resource.key || old.key.includes(resource.key) || resource.key.includes(old.key))) continue;
    deduped.push(resource);
  }
  return deduped.slice(0, 10);
}

function producerActionFamilies(value: string): string[] {
  const cue = clean(value).toLowerCase();
  const result: string[] = [];
  if (/\b(?:answer|respond|echo|trade|counterline|frame|mark|reinforce)\w*\b/.test(cue)) result.push('response');
  if (/\b(?:drop|strip|pull|fall|thin|narrow|remove|withdraw|cut|pause|stop|clear)\w*\b/.test(cue)) result.push('reduce');
  if (/\b(?:open|expand|widen|swell|build|rise|rebuild|broaden)\w*\b/.test(cue)) result.push('expand');
  if (/\b(?:handoff|exchange|rotate|overlap|switch|shift)\w*\b/.test(cue)) result.push('exchange');
  if (/\b(?:return|recur|repeat|reprise)\w*\b|\bbring(?:s)? back\b/.test(cue)) result.push('return');
  if (/\b(?:unison|harmony|harmonize|double|stack)\w*\b/.test(cue)) result.push('combine');
  if (/\b(?:fade|collapse|end|ending|resolve)\w*\b/.test(cue)) result.push('ending');
  return Array.from(new Set(result));
}

function mentionedResourceKeys(value: string, resources: ProducerResource[]): string[] {
  const cueKey = instrumentKey(value);
  if (!cueKey) return [];
  return resources
    .filter((resource) => {
      if (cueKey.includes(resource.key) || resource.key.includes(cueKey)) return true;
      const tokens = resource.key.split(/\s+/).filter((token) => token.length >= 4);
      return tokens.some((token) => cueKey.includes(token));
    })
    .map((resource) => resource.key);
}

function chooseResource(
  resources: ProducerResource[],
  preferredKinds: ProducerResourceKind[],
  usedResources: Set<string>,
  seed: string,
  allowReuse = false,
): ProducerResource | undefined {
  const unused = resources.filter((resource) => !usedResources.has(resource.key));
  const preferredUnused = unused.filter((resource) => preferredKinds.includes(resource.kind));
  const preferredAll = resources.filter((resource) => preferredKinds.includes(resource.kind));
  const pool = preferredUnused.length
    ? preferredUnused
    : unused.length
      ? unused
      : allowReuse
        ? (preferredAll.length ? preferredAll : resources)
        : [];
  return [...pool].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftHash = stableTextHash(`${seed}:${left.key}`);
    const rightHash = stableTextHash(`${seed}:${right.key}`);
    return leftHash - rightHash || left.order - right.order;
  })[0];
}

function producerResourceVerb(resource: ProducerResource, singular: string, plural: string): string {
  const text = resource.text.toLowerCase();
  const last = text.split(/\s+/).filter(Boolean).pop() || '';
  const isPlural = /\b(?:drums|strings|keys|claps|stabs|hits|guitars|horns|voices|leads|pads|shakers|samples)\b/.test(text)
    || (/s$/.test(last) && !/(?:bass|brass|glass)$/.test(last));
  return isPlural ? plural : singular;
}

function createProducerCandidate(
  text: string,
  slot: ProducerSlot,
  source: 'existing' | 'generated',
  resources: ProducerResource[],
  locked = false,
): ProducerCandidate | undefined {
  const cleaned = compactProducerClause(stripAbstractProducerTail(text), 20);
  if (!cleaned || isGenericProducerCue(cleaned) || isPrecisionProducerCue(cleaned)) return undefined;
  return {
    text: cleaned,
    slot,
    source,
    locked,
    resources: mentionedResourceKeys(cleaned, resources),
    actions: producerActionFamilies(cleaned),
  };
}

function existingCandidatesForSlot(value: string, slot: ProducerSlot, resources: ProducerResource[]): ProducerCandidate[] {
  const entries = parseProducerCueEntries(value).entries;
  return entries.flatMap((entry) => {
    const base = resolveBaseRoleDefinition(entry.label).label;
    const isMatch = slot === 'identity'
      ? ['identity', 'instrument', 'vocal', 'hook', 'other'].includes(entry.family)
        && !/^(?:Pre-Chorus|Bridge|Breakdown|Build-Up|Pre-Drop|Break|Stop|Final Chorus|Climax|Outro)$/i.test(base)
      : slot === 'transition'
        ? ['break', 'transition', 'build', 'space'].includes(entry.family)
          || /^(?:Pre-Chorus|Bridge|Breakdown|Build-Up|Pre-Drop|Break|Stop)$/i.test(base)
        : entry.family === 'payoff'
          || /^(?:Final Chorus|Climax|Outro)$/i.test(base)
          || /\b(?:final|last)\s+(?:chorus|refrain|hook|section)|\bclimax\b/i.test(entry.cue);
    if (!isMatch || !isAudibleProducerAction(entry.cue)) return [];
    const candidate = createProducerCandidate(entry.cue, slot, 'existing', resources, isLockedProducerCue(entry.cue));
    return candidate ? [candidate] : [];
  });
}

function producerCandidateScore(
  candidate: ProducerCandidate,
  resources: ProducerResource[],
  usedResources: Set<string>,
  usedActions: Set<string>,
): number {
  if (!candidate.text || isGenericProducerCue(candidate.text) || isPrecisionProducerCue(candidate.text)) return -1000;
  let score = 0;
  if (candidate.locked) score += 50;
  if (isAudibleProducerAction(candidate.text)) score += 12;
  if (candidate.source === 'existing') score += 2;
  score += Math.min(candidate.resources.length, 2) * 5;
  if (resources.length && candidate.resources.length === 0) score -= 5;
  candidate.resources.forEach((resource) => {
    if (usedResources.has(resource)) score -= 7;
  });
  candidate.actions.forEach((action) => {
    if (usedActions.has(action)) score -= 4;
  });
  const family = cueFamily(candidate.text);
  if (candidate.slot === 'identity' && ['identity', 'instrument', 'vocal', 'hook'].includes(family)) score += 4;
  if (candidate.slot === 'transition' && ['break', 'transition', 'build', 'space'].includes(family)) score += 4;
  if (candidate.slot === 'payoff' && (family === 'payoff' || /\b(?:final|last|return|unison|harmony|ending)\b/i.test(candidate.text))) score += 4;
  const words = candidate.text.split(/\s+/).filter(Boolean).length;
  if (words >= 6 && words <= 20) score += 2;
  if (words > 22) score -= 3;
  return score;
}

function pickProducerCandidate(
  candidates: ProducerCandidate[],
  resources: ProducerResource[],
  usedResources: Set<string>,
  usedActions: Set<string>,
  seed: string,
): ProducerCandidate | undefined {
  return [...candidates].sort((left, right) => {
    const scoreDiff = producerCandidateScore(right, resources, usedResources, usedActions)
      - producerCandidateScore(left, resources, usedResources, usedActions);
    if (scoreDiff) return scoreDiff;
    return stableTextHash(`${seed}:${left.text}`) - stableTextHash(`${seed}:${right.text}`);
  })[0];
}

function registerProducerCandidate(
  candidate: ProducerCandidate | undefined,
  usedResources: Set<string>,
  usedActions: Set<string>,
): string {
  if (!candidate) return '';
  candidate.resources.forEach((resource) => usedResources.add(resource));
  candidate.actions.forEach((action) => usedActions.add(action));
  return candidate.text;
}

function buildIdentityCandidates(
  context: V1ProducerDirectionContext,
  resources: ProducerResource[],
  usedResources: Set<string>,
  seed: string,
): ProducerCandidate[] {
  const primary = chooseResource(resources, ['melodic', 'ensemble', 'spatial'], usedResources, `${seed}:identity:primary`, true);
  const secondaryUsed = new Set(usedResources);
  if (primary) secondaryUsed.add(primary.key);
  const secondary = chooseResource(resources, ['melodic', 'ensemble', 'spatial'], secondaryUsed, `${seed}:identity:secondary`, true);
  const generated: string[] = [];

  if (context.isInstrumental) {
    if (primary && secondary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'carries', 'carry')} the recurring motif while ${secondary.text} ${producerResourceVerb(secondary, 'answers', 'answer')} each return`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'states', 'state')} the motif and ${secondary.text} ${producerResourceVerb(secondary, 'reshapes', 'reshape')} it on each return`);
    } else if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'carries', 'carry')} one recurring motif across the song`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'returns', 'return')} as the recognizable instrumental signature`);
    }
  } else if (context.vocalMode === 'duo') {
    if (primary && secondary) generated.push(`${primary.text} ${producerResourceVerb(primary, 'frames', 'frame')} each lead handoff while ${secondary.text} ${producerResourceVerb(secondary, 'shapes', 'shape')} the reply`);
    if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'answers', 'answer')} the changing lead roles with a recurring counterline`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'returns', 'return')} between the two lead handoffs as the song signature`);
    }
  } else if (context.vocalMode === 'group') {
    if (primary && secondary) generated.push(`${primary.text} ${producerResourceVerb(primary, 'anchors', 'anchor')} the rotating leads while ${secondary.text} ${producerResourceVerb(secondary, 'reinforces', 'reinforce')} the shared hook`);
    if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'returns', 'return')} between lead changes as the group signature`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'frames', 'frame')} the rotating leads with one recurring response`);
    }
  } else {
    if (primary && secondary) generated.push(`${primary.text} ${producerResourceVerb(primary, 'carries', 'carry')} a recurring counterline while ${secondary.text} ${producerResourceVerb(secondary, 'marks', 'mark')} the hook`);
    if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'answers', 'answer')} the lead vocal in short recurring phrases`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'returns', 'return')} as the song's recognizable response`);
    }
  }

  if (!generated.length) generated.push(context.isInstrumental
    ? 'one recurring instrumental motif anchors the song identity'
    : 'one recurring counterline answers the lead vocal');
  return generated
    .map((text) => createProducerCandidate(text, 'identity', 'generated', resources))
    .filter((candidate): candidate is ProducerCandidate => Boolean(candidate));
}

function buildTransitionCandidates(
  context: V1ProducerDirectionContext,
  resources: ProducerResource[],
  usedResources: Set<string>,
  seed: string,
): ProducerCandidate[] {
  const source = chooseResource(resources, ['rhythmic', 'low', 'spatial'], usedResources, `${seed}:transition:source`, true);
  const sourceUsed = new Set(usedResources);
  if (source) sourceUsed.add(source.key);
  const target = chooseResource(resources, ['melodic', 'ensemble', 'other'], sourceUsed, `${seed}:transition:target`, true);
  const generated: string[] = [];

  if (source && target) {
    generated.push(`${source.text} ${producerResourceVerb(source, 'pulls', 'pull')} back to expose ${target.text} before the main hook`);
    generated.push(`${source.text} ${producerResourceVerb(source, 'thins', 'thin')} while ${target.text} ${producerResourceVerb(target, 'takes', 'take')} over the transition into the hook`);
    generated.push(`${source.text} ${producerResourceVerb(source, 'withdraws', 'withdraw')} briefly before ${target.text} ${producerResourceVerb(target, 'opens', 'open')} the hook`);
  } else if (source) {
    generated.push(`${source.text} ${producerResourceVerb(source, 'pulls', 'pull')} back to expose one lead element before the main hook`);
    generated.push(`${source.text} ${producerResourceVerb(source, 'narrows', 'narrow')} into a brief gap before the hook returns`);
  } else if (target) {
    generated.push(`${target.text} ${producerResourceVerb(target, 'moves', 'move')} from a narrow texture into the main hook`);
    generated.push(`${target.text} ${producerResourceVerb(target, 'enters', 'enter')} only after the arrangement briefly clears`);
  } else {
    generated.push('the rhythm briefly clears to expose one lead element before the main hook');
  }

  return generated
    .map((text) => createProducerCandidate(text, 'transition', 'generated', resources))
    .filter((candidate): candidate is ProducerCandidate => Boolean(candidate));
}

function buildPayoffCandidates(
  context: V1ProducerDirectionContext,
  resources: ProducerResource[],
  usedResources: Set<string>,
  seed: string,
): ProducerCandidate[] {
  const primary = chooseResource(resources, ['ensemble', 'melodic', 'rhythmic', 'low'], usedResources, `${seed}:payoff:primary`, true);
  const secondaryUsed = new Set(usedResources);
  if (primary) secondaryUsed.add(primary.key);
  const secondary = chooseResource(resources, ['ensemble', 'melodic', 'rhythmic', 'low'], secondaryUsed, `${seed}:payoff:secondary`, true);
  const generated: string[] = [];

  if (context.isInstrumental) {
    if (primary && secondary) generated.push(`${primary.text} ${producerResourceVerb(primary, 'takes', 'take')} the final return, joined by ${secondary.text} for the widest statement`);
    if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'brings', 'bring')} the motif back at full weight before a distinct ending gesture`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'carries', 'carry')} the final motif into a clear ending state`);
    }
  } else if (context.vocalMode === 'duo') {
    if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'drives', 'drive')} a final lead exchange that resolves in compact two-part harmony`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'supports', 'support')} reversed lead roles before both voices meet in harmony`);
    }
  } else if (context.vocalMode === 'group') {
    if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'drives', 'drive')} the final unison hook before the parts widen into compact harmony`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'returns', 'return')} at full weight as the leads rotate into a shared final hook`);
    }
  } else {
    if (primary && secondary) generated.push(`${primary.text} and ${secondary.text} join the final hook as the lead broadens its range`);
    if (primary) {
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'takes', 'take')} the final hook while the lead opens into a freer upper range`);
      generated.push(`${primary.text} ${producerResourceVerb(primary, 'returns', 'return')} at full weight behind a more open final lead delivery`);
    }
  }

  if (!generated.length) {
    if (context.vocalMode === 'duo') generated.push('the final lead exchange resolves in compact two-part harmony');
    else if (context.vocalMode === 'group') generated.push('the final hook moves from unison into compact group harmony');
    else if (context.isInstrumental) generated.push('the recurring motif returns at full ensemble weight with a distinct ending gesture');
    else generated.push('the final hook opens the lead range and strengthens the backing response');
  }

  return generated
    .map((text) => createProducerCandidate(text, 'payoff', 'generated', resources))
    .filter((candidate): candidate is ProducerCandidate => Boolean(candidate));
}

function buildProducerSlot(
  slot: ProducerSlot,
  raw: string,
  context: V1ProducerDirectionContext,
  resources: ProducerResource[],
  usedResources: Set<string>,
  usedActions: Set<string>,
  seed: string,
): string {
  const existing = existingCandidatesForSlot(raw, slot, resources);
  const explicitHint = slot === 'identity'
    ? context.identityHint
    : slot === 'transition'
      ? context.transitionHint
      : context.payoffHint;
  const hinted = explicitHint
    ? createProducerCandidate(explicitHint, slot, 'existing', resources, true)
    : undefined;
  const generated = slot === 'identity'
    ? buildIdentityCandidates(context, resources, usedResources, seed)
    : slot === 'transition'
      ? buildTransitionCandidates(context, resources, usedResources, seed)
      : buildPayoffCandidates(context, resources, usedResources, seed);
  const selected = pickProducerCandidate([...(hinted ? [hinted] : []), ...existing, ...generated], resources, usedResources, usedActions, `${seed}:${slot}`);
  return registerProducerCandidate(selected, usedResources, usedActions);
}

function extractProtectedConstraints(value: string): string[] {
  const entries = parseProducerCueEntries(value).entries;
  const protectedCues: string[] = [];
  for (const entry of entries) {
    const cue = compactProducerClause(entry.cue, 10);
    if (!cue || isPrecisionProducerCue(cue) || isGenericProducerCue(cue)) continue;
    if (!/\b(?:no rap|rap section|instrumental opening|instrumental intro|vocal-only|no vocals?|without vocals?|short intro|short outro|repeat|repeated|fade ending|fade out|hard ending|abrupt ending)\b/i.test(cue)) continue;
    if (!protectedCues.some((old) => producerCueKey(old) === producerCueKey(cue))) protectedCues.push(cue);
    if (protectedCues.length >= 2) break;
  }
  return protectedCues;
}

/**
 * Final V1 boundary guard.
 *
 * Gemini may return a thin or abstract Arrangement line. This function does
 * not select from that line only: it rebuilds the four approved producer-map
 * slots from the validated Genre/Instruments/Vocals context, then preserves
 * only explicit stable constraints. It contains no topic- or scene-specific
 * creative mappings.
 */
export function buildV1GuaranteedProducerDirectionMap(
  value: string,
  context: V1ProducerDirectionContext,
): string {
  const raw = clean(value)
    .replace(/\s*,\s*;/g, '; ')
    .replace(/,\s*,+/g, ', ')
    .replace(/;\s*;/g, '; ')
    .replace(/^[,;\s]+|[,;\s]+$/g, '');
  const parsedTempo = parseProducerCueEntries(raw).tempo;
  const tempo = clean(context.tempo || parsedTempo).replace(/[,;\s]+$/g, '') || '80–110 BPM';
  const groove = compactProducerClause(stripAbstractProducerTail(pickGrooveCue(raw, context)), 11) || 'genre-shaped rhythmic flow';
  const productionTexture = compactProducerClause(stripAbstractProducerTail(context.productionTextureHint || ''), 8);
  const resources = extractProducerResources(context.instruments || '');
  const seed = [context.genre, context.instruments, context.vocals, context.atmosphere, context.productionTextureHint, context.identityHint, context.transitionHint, context.payoffHint, context.vocalMode, context.isInstrumental ? 'instrumental' : 'song']
    .filter(Boolean)
    .join('|');
  const usedResources = new Set<string>();
  const usedActions = new Set<string>();
  const identity = buildProducerSlot('identity', raw, context, resources, usedResources, usedActions, seed);
  const transition = buildProducerSlot('transition', raw, context, resources, usedResources, usedActions, seed);
  const payoff = buildProducerSlot('payoff', raw, context, resources, usedResources, usedActions, seed);

  const tempoGrooveTexture = [tempo, groove, productionTexture]
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((other) => producerCueKey(other) === producerCueKey(part)) === index)
    .join(', ');

  const core = [
    tempoGrooveTexture,
    compactProducerClause(stripAbstractProducerTail(identity), 20),
    compactProducerClause(stripAbstractProducerTail(transition), 20),
    compactProducerClause(stripAbstractProducerTail(payoff), 20),
  ].filter(Boolean);

  const seen = new Set<string>();
  const uniqueCore = core.filter((clause) => {
    const key = producerCueKey(clause);
    if (!key || seen.has(key) || isGenericProducerCue(clause)) return false;
    seen.add(key);
    return true;
  });
  const constraints = extractProtectedConstraints(raw)
    .map(stripAbstractProducerTail)
    .filter(Boolean)
    .filter((cue) => !seen.has(producerCueKey(cue)));
  return [...uniqueCore, ...constraints]
    .join('; ')
    .replace(/(?:[,;]\s*|\s+)(?:focused hook(?: release)?|refreshing section lift|large-scale narrative expansion|genre-led section flow|story-shaped section flow|custom section flow|emotional build|controlled emotional turn|section lift|narrative expansion|cinematic development|emotional progression|dynamic progression)(?=\s*(?:;|$))/gi, '')
    .replace(/\s*,\s*;/g, '; ')
    .replace(/;\s*;/g, '; ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;\s]+|[,;\s]+$/g, '')
    .trim();
}
