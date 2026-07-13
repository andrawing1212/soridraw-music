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
  fallbackCue: string;
}

const ROLE_DEFINITIONS: Array<{ pattern: RegExp; definition: V1SectionRoleDefinition }> = [
  {
    pattern: /^intro$/i,
    definition: {
      label: 'Intro',
      role: 'establish the song world, spatial scale, and one recognizable sound before the story fully starts',
      fallbackCue: 'establish the scene and core sound',
    },
  },
  {
    pattern: /^verse(?:\s+\d+|\s+[a-z])?$/i,
    definition: {
      label: 'Verse',
      role: 'carry scene detail, character action, and the main rhythmic or vocal baseline without spending the full payoff',
      fallbackCue: 'hold narrative detail over restrained motion',
    },
  },
  {
    pattern: /^rap(?:\s+section|\s+verse)?$/i,
    definition: {
      label: 'Rap Section',
      role: 'increase rhythmic diction, narrative pressure, or viewpoint contrast while staying inside the same scene',
      fallbackCue: 'tighten rhythmic diction and narrative pressure',
    },
  },
  {
    pattern: /^pre[-\s]?chorus$/i,
    definition: {
      label: 'Pre-Chorus',
      role: 'raise tension by changing density, harmony, rhythm, vocal distance, or space before the main release',
      fallbackCue: 'raise tension through one clear change',
    },
  },
  {
    pattern: /^chorus$/i,
    definition: {
      label: 'Chorus',
      role: 'deliver the central desire or hook with the clearest genre identity and a stronger sound state',
      fallbackCue: 'release the central hook with fuller energy',
    },
  },
  {
    pattern: /^final[-\s]?chorus$/i,
    definition: {
      label: 'Final Chorus',
      role: 'return the main hook with a clearly changed scale, vocal state, arrangement density, or emotional meaning',
      fallbackCue: 'return the hook with a clearly changed scale',
    },
  },
  {
    pattern: /^post[-\s]?chorus$/i,
    definition: {
      label: 'Post-Chorus',
      role: 'extend the chorus afterimage through a short motif, rhythm, sound, or vocal fragment without starting a new story',
      fallbackCue: 'extend the chorus with a short afterimage',
    },
  },
  {
    pattern: /^hook$/i,
    definition: {
      label: 'Hook',
      role: 'foreground the single most memorable phrase, melodic shape, rhythmic cell, or signature sound',
      fallbackCue: 'foreground the most memorable phrase or motif',
    },
  },
  {
    pattern: /^refrain$/i,
    definition: {
      label: 'Refrain',
      role: 'return the same short lyric and melodic idea so the listener recognizes it immediately',
      fallbackCue: 'return the same short phrase and melody',
    },
  },
  {
    pattern: /^build[-\s]?up$/i,
    definition: {
      label: 'Build-Up',
      role: 'stack rhythm, texture, range, or vocal urgency toward the next impact without delivering that impact early',
      fallbackCue: 'stack rhythm and texture toward the next impact',
    },
  },
  {
    pattern: /^pre[-\s]?drop$/i,
    definition: {
      label: 'Pre-Drop',
      role: 'remove or narrow key layers for one unmistakable anticipation moment immediately before the drop',
      fallbackCue: 'strip the mix for one clear anticipation',
    },
  },
  {
    pattern: /^drop$/i,
    definition: {
      label: 'Drop',
      role: 'shift the main impact to rhythm, bass, signature sound, body movement, or a compact vocal hook',
      fallbackCue: 'shift impact to rhythm and signature sound',
    },
  },
  {
    pattern: /^breakdown$/i,
    definition: {
      label: 'Breakdown',
      role: 'remove density and expose one emotional, harmonic, vocal, or instrumental core before rebuilding',
      fallbackCue: 'remove density and expose one core element',
    },
  },
  {
    pattern: /^bridge$/i,
    definition: {
      label: 'Bridge',
      role: 'change perspective, harmony, vocal attitude, texture, or section ownership before the final return',
      fallbackCue: 'change perspective or texture before the return',
    },
  },
  {
    pattern: /^(?:instrumental|solo)$/i,
    definition: {
      label: 'Instrumental',
      role: 'let the selected instruments and sound design carry the scene without lyric exposition',
      fallbackCue: 'let the selected instruments carry the scene',
    },
  },
  {
    pattern: /^interlude$/i,
    definition: {
      label: 'Interlude',
      role: 'connect two song states through a concise no-vocal musical transition',
      fallbackCue: 'connect sections with a no-vocal transition',
    },
  },
  {
    pattern: /^dance[-\s]?break$/i,
    definition: {
      label: 'Dance Break',
      role: 'prioritize body rhythm, performance motion, and the most physical selected sound',
      fallbackCue: 'prioritize body rhythm and performance movement',
    },
  },
  {
    pattern: /^break$/i,
    definition: {
      label: 'Break',
      role: 'create a short interruption, reset, cut, or contrast that clearly prepares the next section',
      fallbackCue: 'create a short reset before the next section',
    },
  },
  {
    pattern: /^stop$/i,
    definition: {
      label: 'Stop',
      role: 'use intentional silence or a hard cut as a structural event, not as an empty accidental gap',
      fallbackCue: 'use one intentional silence or hard cut',
    },
  },
  {
    pattern: /^theme\s*a$/i,
    definition: {
      label: 'Theme A',
      role: 'state the first recognizable melodic or rhythmic motif clearly',
      fallbackCue: 'state the first recognizable motif',
    },
  },
  {
    pattern: /^theme\s*b$/i,
    definition: {
      label: 'Theme B',
      role: 'answer or contrast Theme A with a distinct but related motif',
      fallbackCue: 'answer the first motif with a clear contrast',
    },
  },
  {
    pattern: /^main\s*theme$/i,
    definition: {
      label: 'Main Theme',
      role: 'present the core melodic or rhythmic identity at full clarity',
      fallbackCue: 'present the core musical identity clearly',
    },
  },
  {
    pattern: /^climax$/i,
    definition: {
      label: 'Climax',
      role: 'deliver the highest justified energy and emotional pressure by combining previously established elements',
      fallbackCue: 'combine established elements at peak intensity',
    },
  },
  {
    pattern: /^outro$/i,
    definition: {
      label: 'Outro',
      role: 'resolve or deliberately leave the scene with a distinct ending texture, gesture, or final vocal state',
      fallbackCue: 'resolve the scene with a distinct ending texture',
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
    fallbackCue: 'give this section one clear musical function',
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
): string {
  const active = extractV1ArrangementSections(exactStructureText);
  const activeText = active.length ? active.map((item) => item.label).join(' → ') : 'Use every section that appears in the generated structure';
  const roleReference = buildV1CommonSectionRoleReference(exactStructureText);
  const directDirectiveText = clean(directUserDirectives) || 'None';

  return `V1 SECTION-BY-SECTION ARRANGEMENT RULE (MANDATORY):
- [Arrangement] is the production timeline of the song, not a 3–4 item summary list.
- Active arrangement sections: ${activeText}.
- Give every active section a real function. Each section directive must contain 1–2 high-priority details chosen from the current Genre, Style, Sound, Mood, Vocals, scene, and story development.
- Treat user-authored section instructions as locked production requirements. Parse positive instructions, negative instructions, duration/shortness, repetition count or return behavior, instrumental-only or vocal-only requests, entry/exit timing, silence, humming/ad-lib restrictions, and ending behavior without relying on any fixed example phrase.
- Bind a section-specific instruction to that named section. Apply a general production instruction only to the sections it logically controls. Explicit user instructions outrank automatic section-role defaults and must not disappear during compaction or validation.
- Convert selections into audible actions: what enters or disappears, what grows or narrows, which rhythm changes, which instrument or vocal state leads, how space changes, and where tension or release happens.
- Keep all section directions inside the same shared scene and emotional progression. Do not create a second story in [Arrangement].
- Do not force every selected keyword into every section. Place each important selection where it matters most, and do not leave a deliberately selected core element with no audible role anywhere.
- Do not cap the line at 3–4 cues. Length follows the actual number of active sections. Stay compact by using only 1–2 details per section and deleting exact repetition, never by deleting distinct section roles.
- Format: <tempo>; <Section>: <1–2 compact audible actions>; <Next Section>: <1–2 changed audible actions>. Do not copy this as lyric text.
- Separate sections with semicolons. Avoid commas inside each section when “and” can express the same relationship.
- Preserve repeated section occurrences as separate timeline entries. Number repeated sections in order, and treat the last repeated Chorus as Final Chorus. Every return must state its meaningful change rather than copying the earlier cue.

DIRECT USER PRODUCTION / SECTION INSTRUCTIONS TO PROTECT:
${directDirectiveText}

COMMON SECTION ROLES:
${roleReference}`.trim();
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

  // Fallback for a model that omitted semicolons but still emitted multiple
  // section labels in one sentence.
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

function resolvePerSectionWordBudget(sectionCount: number): number {
  if (sectionCount <= 4) return 15;
  if (sectionCount <= 6) return 13;
  if (sectionCount <= 8) return 11;
  if (sectionCount <= 10) return 10;
  return 8;
}

function compactCueToTwoDetails(cue: string, wordBudget = 12): string {
  const clauses = clean(cue)
    .split(/\s*,\s*|\s*\/\s*/)
    .map(cleanStructuredCue)
    .filter(Boolean)
    .slice(0, 2);
  const combined = clauses.join(' and ') || cleanStructuredCue(cue);
  const words = combined.split(/\s+/).filter(Boolean);
  if (words.length <= wordBudget) return combined;
  return cleanStructuredCue(words.slice(0, wordBudget).join(' '));
}

export function compactV1SectionStructuredArrangement(value: string): string {
  const normalized = normalizeV1SectionStructuredArrangement(value);
  if (!normalized) return '';
  const parts = normalized.split(/\s*;\s*/).filter(Boolean);
  const sectionCount = parts.filter((part) => part.includes(':')).length;
  const perSectionWordBudget = resolvePerSectionWordBudget(sectionCount);

  return parts
    .map((part) => {
      if (/\bBPM$/i.test(part) && !part.includes(':')) return part;
      const match = part.match(/^([^:]+):\s*(.+)$/);
      if (!match) return part;
      return `${match[1]}: ${compactCueToTwoDetails(match[2], perSectionWordBudget)}`;
    })
    .filter(Boolean)
    .join('; ');
}

export function ensureV1ArrangementSectionCoverage(value: string, exactStructureText: string): string {
  const active = extractV1ArrangementSections(exactStructureText);
  if (!active.length) return normalizeV1SectionStructuredArrangement(value) || clean(value);

  let normalized = normalizeV1SectionStructuredArrangement(value);
  const parts = normalized ? normalized.split(/\s*;\s*/).filter(Boolean) : [];
  const present = new Set(
    parts
      .map((part) => part.match(/^([^:]+):/)?.[1])
      .filter(Boolean)
      .map((label) => resolveRoleDefinition(label as string).label.toLowerCase()),
  );

  for (const section of active) {
    if (present.has(section.label.toLowerCase())) continue;
    parts.push(`${section.label}: ${section.fallbackCue}`);
    present.add(section.label.toLowerCase());
  }

  normalized = parts.join('; ');
  return compactV1SectionStructuredArrangement(normalized);
}

function cueFamily(cue: string): string {
  const value = cue.toLowerCase();
  if (/hook|chorus|refrain|chant|singalong|catchy|memorable/.test(value)) return 'hook';
  if (/build|rise|rising|tension|crescendo|lift/.test(value)) return 'build';
  if (/drop|impact|bass|808|sub[-\s]?bass|heavy beat/.test(value)) return 'drop';
  if (/break|silence|strip|sparse|empty|collapse|pause|stop/.test(value)) return 'break';
  if (/space|room|reverb|echo|ambient|atmosphere|haze|texture/.test(value)) return 'space';
  if (/vocal|phrase|sing|rap|spoken|whisper|delivery|choir/.test(value)) return 'vocal';
  if (/rhythm|groove|pulse|beat|swing|bounce|flow/.test(value)) return 'rhythm';
  if (/instrument|guitar|piano|synth|drum|string|brass|percussion|melody/.test(value)) return 'instrument';
  if (/turn|contrast|transition|switch|shift|change/.test(value)) return 'transition';
  return 'other';
}

function preferredFamiliesForSection(label: string): string[] {
  const baseLabel = resolveBaseRoleDefinition(label).label;
  switch (baseLabel) {
    case 'Intro': return ['space', 'instrument', 'other'];
    case 'Verse': return ['rhythm', 'vocal', 'other'];
    case 'Rap Section': return ['rhythm', 'vocal', 'other'];
    case 'Pre-Chorus': return ['build', 'transition', 'space'];
    case 'Chorus': return ['hook', 'rhythm', 'vocal'];
    case 'Final Chorus': return ['hook', 'build', 'vocal'];
    case 'Post-Chorus': return ['hook', 'rhythm', 'instrument'];
    case 'Hook': return ['hook', 'vocal', 'instrument'];
    case 'Refrain': return ['hook', 'vocal', 'rhythm'];
    case 'Build-Up': return ['build', 'rhythm', 'transition'];
    case 'Pre-Drop': return ['break', 'transition', 'space'];
    case 'Drop': return ['drop', 'rhythm', 'instrument'];
    case 'Breakdown': return ['break', 'space', 'vocal'];
    case 'Bridge': return ['transition', 'vocal', 'space'];
    case 'Instrumental': return ['instrument', 'space', 'rhythm'];
    case 'Interlude': return ['transition', 'instrument', 'space'];
    case 'Dance Break': return ['rhythm', 'drop', 'instrument'];
    case 'Climax': return ['build', 'hook', 'drop'];
    case 'Outro': return ['space', 'transition', 'instrument'];
    default: return ['other', 'transition', 'rhythm'];
  }
}

export function buildV1ArrangementSectionSkeleton(exactStructureText: string, sourceLine: string): string {
  const active = extractV1ArrangementSections(exactStructureText);
  if (!active.length) return clean(sourceLine);

  const tempo = sourceLine.match(/\b\d{2,3}\s*(?:–|-|~)\s*\d{2,3}\s*BPM\b|\b\d{2,3}\s*BPM\b/i)?.[0] || '';
  const candidates = String(sourceLine || '')
    .replace(tempo, '')
    .split(/\s*,\s*|\s*;\s*/)
    .map(cleanStructuredCue)
    .filter(Boolean)
    .filter((cue, index, all) => all.findIndex((other) => other.toLowerCase() === cue.toLowerCase()) === index);

  const used = new Set<number>();
  const directives = active.map((section) => {
    const preferred = preferredFamiliesForSection(section.label);
    let selectedIndex = -1;
    for (const family of preferred) {
      selectedIndex = candidates.findIndex((cue, index) => !used.has(index) && cueFamily(cue) === family);
      if (selectedIndex >= 0) break;
    }
    if (selectedIndex < 0) selectedIndex = candidates.findIndex((_, index) => !used.has(index));
    if (selectedIndex >= 0) used.add(selectedIndex);
    const selectedCue = selectedIndex >= 0 ? compactCueToTwoDetails(candidates[selectedIndex], 12) : '';
    const cue = selectedCue
      ? `${section.fallbackCue} with ${selectedCue}`
      : section.fallbackCue;
    return `${section.label}: ${compactCueToTwoDetails(cue, 14)}`;
  });

  return [tempo, ...directives].filter(Boolean).join('; ');
}
