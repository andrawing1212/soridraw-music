import type { V1SectionBlueprint, V1SectionBlueprintEntry } from './sectionBlueprint';
import {
  cleanV1SectionCue,
  isV1SoundOrProductionCue,
  isV1StandaloneCueLine,
  getV1SectionDefinition,
  normalizeV1SectionName,
  parseV1SectionTagLine,
  type ParsedV1SectionTag,
} from './sectionRegistry';

export interface V1LyricBlock {
  originalSection: ParsedV1SectionTag | null;
  standaloneCues: string[];
  bodyLines: string[];
}

const hasConcreteBody = (block: V1LyricBlock): boolean => block.bodyLines.some((line) => {
  const trimmed = String(line || '').trim();
  return Boolean(trimmed && !/^\[[^\]]+\]$/.test(trimmed));
});

const cleanLines = (lines: string[]): string[] => {
  const out: string[] = [];
  for (const line of lines) {
    const value = String(line || '').replace(/\s+$/g, '');
    if (!value.trim()) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    out.push(value.trim());
  }
  while (out[0] === '') out.shift();
  while (out[out.length - 1] === '') out.pop();
  return out;
};


const VOCAL_FIRST_TAG_LABEL = /^(?:(?:Male|Female)\s+[A-Z](?:\s+(?:Main|Lead|Sub|Rap|Rapper)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*)?|Vocal\s+[A-Z](?:\s+(?:Male|Female))?(?:\s+(?:Main|Lead|Sub|Rap|Rapper)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*)?|(?:Male|Female)\s+(?:Main|Lead|Sub|Rap|Rapper)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*|(?:Main|Lead|Sub|Rap|Rapper)\s+(?:Vocal|Rapper))$/i;

function embeddedSectionCandidates(blueprint: V1SectionBlueprint): string[] {
  const defaults = [
    'Final Chorus', 'Final Hook', 'Pre-Chorus', 'Rap Section', 'Rap Verse', 'Build-Up',
    'Main Theme', 'Post-Chorus', 'Breakdown', 'Instrumental', 'Interlude', 'Climax',
    'Chorus', 'Refrain', 'Bridge', 'Verse', 'Hook', 'Drop', 'Outro', 'Intro', 'Opening',
  ];
  return [...blueprint.entries.map((entry) => entry.name), ...blueprint.customNames, ...defaults]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index)
    .sort((a, b) => b.length - a.length);
}

function findEmbeddedSectionMention(value: string, blueprint: V1SectionBlueprint): { name: string; start: number; end: number } | null {
  const source = String(value || '').trim();
  const lower = source.toLowerCase();
  for (const candidate of embeddedSectionCandidates(blueprint)) {
    const candidateLower = candidate.toLowerCase();
    const start = lower.lastIndexOf(candidateLower);
    if (start < 0) continue;
    const before = start > 0 ? source[start - 1] : '';
    const after = start + candidate.length < source.length ? source[start + candidate.length] : '';
    if ((before && /[a-z0-9]/i.test(before)) || (after && /[a-z0-9]/i.test(after))) continue;
    const normalized = /^opening$/i.test(candidate)
      ? 'Intro'
      : normalizeV1SectionName(candidate, blueprint.customNames);
    if (!normalized) continue;
    let end = start + candidate.length;
    // Gemini often writes the repeat number after a generic embedded name
    // (e.g. "Building Pre-Chorus 1"). Consume that structural suffix so it
    // cannot leak back as a meaningless local cue such as "Building 1".
    const repeatSuffix = source.slice(end).match(/^\s+(?:\d+|[A-Z])\b/i);
    if (repeatSuffix && !/\d+$/.test(candidate)) end += repeatSuffix[0].length;
    return { name: normalized, start, end };
  }
  return null;
}

/**
 * Gemini occasionally reverses a composite structural tag into singer-first form,
 * e.g. [Male A Main : Conversational Verse]. Recover the embedded section without
 * allowing an invented solo member identity to survive.
 */
function parseVocalFirstSectionTagLine(line: string, blueprint: V1SectionBlueprint): ParsedV1SectionTag | null {
  const match = String(line || '').trim().match(/^\[([^\]\n]{1,220})\]$/);
  if (!match) return null;
  const inside = String(match[1] || '').trim();
  const colonIndex = inside.search(/\s*[:：]\s*/);
  if (colonIndex < 0) return null;

  const rawOwner = inside.slice(0, colonIndex).trim();
  const rawCue = inside.slice(colonIndex).replace(/^\s*[:：]\s*/, '').trim();
  if (!VOCAL_FIRST_TAG_LABEL.test(rawOwner) || !rawCue) return null;

  const mention = findEmbeddedSectionMention(rawCue, blueprint);
  if (!mention) return null;

  const localCue = cleanV1SectionCue(`${rawCue.slice(0, mention.start)} ${rawCue.slice(mention.end)}`);
  const owner = normalizeVocalAnchorCue(rawOwner, blueprint);
  const validAnchors = blueprint.vocalCount > 1 ? owner.anchors : [];
  const cue = [...validAnchors, ...(localCue ? [localCue] : [])]
    .filter(Boolean)
    .join(', ');
  return { raw: match[0], name: mention.name, cue };
}

function splitBodyParagraphs(lines: string[]): string[][] {
  const paragraphs: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    const clean = cleanLines(current);
    if (clean.some((line) => line.trim())) paragraphs.push(clean);
    current = [];
  };
  cleanLines(lines).forEach((line) => {
    if (!line.trim()) flush();
    else current.push(line);
  });
  flush();
  return paragraphs;
}

function coalesceEmptyDuplicateHeaders(blocks: V1LyricBlock[]): V1LyricBlock[] {
  const out: V1LyricBlock[] = [];
  blocks.forEach((block) => {
    const previous = out[out.length - 1];
    const sameSection = previous?.originalSection && block.originalSection
      && previous.originalSection.name.toLowerCase() === block.originalSection.name.toLowerCase();
    if (sameSection && !hasConcreteBody(previous) && !hasConcreteBody(block)) {
      previous.standaloneCues = [...previous.standaloneCues, ...block.standaloneCues]
        .filter((value, index, all) => all.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index);
      if (!previous.originalSection?.cue && block.originalSection?.cue) previous.originalSection = { ...block.originalSection };
      return;
    }
    out.push(block);
  });
  return out;
}

/**
 * Repair the catastrophic "all headers first, all lyrics afterward" shape. This is
 * deterministic only when paragraph boundaries closely match the stacked sung headers;
 * otherwise normal validation/retry remains responsible for regeneration.
 */
function redistributeStackedHeaderBody(blocks: V1LyricBlock[]): V1LyricBlock[] {
  const compacted = coalesceEmptyDuplicateHeaders(blocks);
  const firstBodyIndex = compacted.findIndex(hasConcreteBody);
  if (firstBodyIndex < 3) return compacted;
  if (compacted.slice(0, firstBodyIndex).some(hasConcreteBody)) return compacted;

  const bodyOwner = compacted[firstBodyIndex];
  const targetIndexes = compacted
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => index <= firstBodyIndex
      && Boolean(block.originalSection)
      && getV1SectionDefinition(block.originalSection!.name).allowsLyrics)
    .map(({ index }) => index);
  if (targetIndexes.length < 4) return compacted;

  const paragraphs = splitBodyParagraphs(bodyOwner.bodyLines);
  const requiredTargetIndexes = targetIndexes.filter((index) =>
    getV1SectionDefinition(compacted[index].originalSection?.name || '').requiresLyrics,
  );
  const assignTargets = paragraphs.length >= targetIndexes.length - 1
    ? targetIndexes
    : paragraphs.length >= requiredTargetIndexes.length - 1
      ? requiredTargetIndexes
      : [];
  if (paragraphs.length < 3 || !assignTargets.length) return compacted;
  if (Math.abs(paragraphs.length - assignTargets.length) > 2) return compacted;

  targetIndexes.forEach((index) => { compacted[index].bodyLines = []; });
  assignTargets.forEach((targetIndex, paragraphIndex) => {
    if (paragraphIndex >= paragraphs.length) return;
    const isLastTarget = paragraphIndex === assignTargets.length - 1;
    const payload = isLastTarget
      ? paragraphs.slice(paragraphIndex).flatMap((paragraph, index) => index ? ['', ...paragraph] : paragraph)
      : paragraphs[paragraphIndex];
    compacted[targetIndex].bodyLines = cleanLines(payload);
  });
  return compacted;
}


export function collapseV1WrappedBracketTags(lyrics: string): string {
  const lines = String(lyrics || '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let pendingOrphanClose = false;

  const isLikelyStructuralFragment = (value: string): boolean => {
    const clean = String(value || '').trim().replace(/^\[/, '');
    return /^(?:Intro|Verse|Pre[-\s]?Chorus|Chorus|Post[-\s]?Chorus|Bridge|Final\s+(?:Chorus|Hook)|Hook|Rap\s+Section|Refrain|Outro|Drop|Build[-\s]?Up|Breakdown|Break|Stop|Instrumental|Interlude|Theme\s+[A-Z]|Climax|Main\s+Theme)\b/i.test(clean);
  };
  const isLikelyOrphanTagTail = (value: string): boolean => {
    const clean = String(value || '').trim();
    if (!clean || clean.includes('[') || !clean.endsWith(']')) return false;
    if (/^[가-힣\s]+\]$/.test(clean)) return false;
    return /(?:\bVocal\s+[A-Z]\b|\b(?:Male|Female)\s+[A-Z]\b|\bAll\s+(?:Vocals|Voices)\b|\b(?:Main|Lead|Sub|Rapper|harmony|unison|whisper|murmur|delivery|phrasing|register|pressure|restraint|swell|build|fade|fading|emotional|conversational|airy|dry|quiet|soft|tense|rising|layered|grand|powerful|explosive)\b)/i.test(clean);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = String(lines[index] || '');
    const start = raw.trim();

    if (pendingOrphanClose && isLikelyOrphanTagTail(start)) {
      pendingOrphanClose = false;
      continue;
    }

    if (!/^\[[^\]\n]*$/.test(start) || start.includes(']')) {
      out.push(raw);
      continue;
    }

    const parts = [start];
    let repaired = '';
    let endIndex = index;
    let nestedBracketIndex = -1;
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 7); cursor += 1) {
      const next = String(lines[cursor] || '').trim();
      if (!next) continue;
      // A second opening bracket before a closing bracket means the first tag fragment is stale.
      // Drop that stale opening and its continuation; the nested real section is processed next.
      if (next.includes('[')) {
        nestedBracketIndex = cursor;
        break;
      }
      parts.push(next);
      if (!next.includes(']')) continue;

      const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
      const match = joined.match(/^\[([^\[\]]{1,220})\](.*)$/);
      if (match) {
        repaired = `[${String(match[1] || '').trim()}]${String(match[2] || '')}`;
        endIndex = cursor;
      }
      break;
    }

    if (repaired) {
      out.push(repaired);
      index = endIndex;
      continue;
    }

    if (nestedBracketIndex >= 0 && isLikelyStructuralFragment(start)) {
      // Consume only the stale fragment lines. The nested opening bracket remains for the next pass.
      index = nestedBracketIndex - 1;
      pendingOrphanClose = true;
      continue;
    }

    out.push(raw);
  }

  return out.join('\n');
}

export function parseV1LyricBlocks(lyrics: string, blueprint: V1SectionBlueprint): V1LyricBlock[] {
  const lines = collapseV1WrappedBracketTags(lyrics).split('\n');
  const blocks: V1LyricBlock[] = [];
  let current: V1LyricBlock | null = null;

  const ensureCurrent = () => {
    if (!current) current = { originalSection: null, standaloneCues: [], bodyLines: [] };
    return current;
  };
  const flush = () => {
    if (!current) return;
    current.bodyLines = cleanLines(current.bodyLines);
    if (current.originalSection || current.standaloneCues.length || current.bodyLines.some((line) => line.trim())) {
      blocks.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    const section = parseV1SectionTagLine(line, blueprint.customNames)
      || parseVocalFirstSectionTagLine(line, blueprint);
    if (section) {
      flush();
      current = { originalSection: section, standaloneCues: [], bodyLines: [] };
      continue;
    }

    if (isV1StandaloneCueLine(line, blueprint.customNames)) {
      if (current && hasConcreteBody(current)) flush();
      ensureCurrent().standaloneCues.push(line);
      continue;
    }

    ensureCurrent().bodyLines.push(line);
  }
  flush();

  // A final cue such as [recorder fades out] belongs to the preceding Outro/body,
  // not to a new structural section. Merge cue-only orphan blocks backward.
  const merged: V1LyricBlock[] = [];
  for (const block of blocks) {
    if (!block.originalSection && !hasConcreteBody(block) && block.standaloneCues.length && merged.length) {
      const previous = merged[merged.length - 1];
      previous.standaloneCues.push(...block.standaloneCues);
      continue;
    }
    merged.push(block);
  }
  return redistributeStackedHeaderBody(merged);
}

function cueParts(value: string): string[] {
  return String(value || '')
    .split(/[,，;|]+/g)
    .map(cleanV1SectionCue)
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index);
}

function partitionCues(values: string[]): { performance: string[]; production: string[] } {
  const performance: string[] = [];
  const production: string[] = [];
  values.flatMap(cueParts).forEach((part) => {
    const target = isV1SoundOrProductionCue(part) ? production : performance;
    if (!target.some((item) => item.toLowerCase() === part.toLowerCase())) target.push(part);
  });
  return { performance, production };
}

function normalizeStandaloneCue(value: string): string {
  const inside = String(value || '').trim().replace(/^\[|\]$/g, '').trim();
  return inside ? `[${inside}]` : '';
}

function cueKey(value: string): string {
  return cleanV1SectionCue(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isProtectedVocalAnchor(value: string): boolean {
  return /(?:^|\+)\s*(?:(?:male|female)\s+[a-z](?:\s+(?:main|lead|sub|rap|rapper)(?:\/(?:main|lead|sub|rap|rapper))*)?\b|vocal\s+[a-z]\b|all\s+(?:voices|vocals|female\s+(?:voices|vocals)|male\s+(?:voices|vocals))\b|only\s+vocal\s+[a-z]\b)/i.test(cleanV1SectionCue(value));
}

function isStaticSoloIdentityCue(value: string): boolean {
  const cue = cleanV1SectionCue(value).toLowerCase();
  if (!cue) return false;
  const hasIdentity = /\b(?:husky|raspy|gritty|rough|deep[-\s]?voiced|deep\s+voice|male|female|solo\s+vocal|youthful|mature|seasoned|nasal|bright\s+tone|dark\s+tone|warm\s+tone|clear\s+tone|airy\s+tone)\b/.test(cue);
  const hasLocalAction = /\b(?:delivery|phrasing|register|breath|whisper|spoken|staccato|legato|stop[-\s]?start|ornament|tension|release|hook|lift|upper|lower|exposed|restrained|clipped|broken|open|attack|glide|hum|chant|aside|reflection|build|fall|rise|answer|overlap|unison|harmony|pause|hold)\b/.test(cue);
  return hasIdentity && !hasLocalAction;
}

type AnchorNormalization = {
  anchors: string[];
  localCues: string[];
  sawVocalReference: boolean;
};

function normalizeVocalAnchorCue(value: string, blueprint: V1SectionBlueprint): AnchorNormalization {
  const clean = cleanV1SectionCue(value);
  if (!clean) return { anchors: [], localCues: [], sawVocalReference: false };

  if (/^all\s+(?:voices|vocals|female\s+(?:voices|vocals)|male\s+(?:voices|vocals))\b/i.test(clean)) {
    const allLabel = clean.match(/^all\s+(?:female\s+(?:voices|vocals)|male\s+(?:voices|vocals)|voices|vocals)/i)?.[0] || 'All Voices';
    const remainder = clean.slice(allLabel.length).replace(/^\s*[-–—,:+]*\s*/, '').trim();
    return {
      anchors: [/female/i.test(allLabel) ? 'All Female Voices' : /male/i.test(allLabel) ? 'All Male Voices' : 'All Voices'],
      localCues: remainder ? [remainder] : [],
      sawVocalReference: true,
    };
  }

  const anchorsById = new Map<string, string>();
  blueprint.vocalAnchors.forEach((anchor) => {
    const match = anchor.match(/^(?:Male|Female)\s+([A-Z])\b/i) || anchor.match(/^Vocal\s+([A-Z])\b/i);
    if (match) anchorsById.set(match[1].toUpperCase(), anchor);
  });

  const foundIds: string[] = [];
  const anchorPattern = /(?:Vocal\s+([A-Z])(?:\s+(?:Male|Female))?(?:\s+(?:Main|Lead|Sub|Rap|Rapper|Rap\s+Vocal)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*)?|(?:Male|Female)\s+([A-Z])(?:\s+(?:Main|Lead|Sub|Rap|Rapper)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*)?\b)/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(clean)) !== null) {
    const id = String(match[1] || match[2] || '').toUpperCase();
    if (id && !foundIds.includes(id)) foundIds.push(id);
  }
  if (!foundIds.length) return { anchors: [], localCues: [clean], sawVocalReference: false };

  const anchors = foundIds.map((id) => anchorsById.get(id)).filter(Boolean) as string[];
  let remainder = clean
    .replace(anchorPattern, ' ')
    .replace(/\b(?:male|female)\s+(?:main|lead|sub|rap|rapper|rap\s+vocal)(?:\/(?:main|lead|sub|rap|rapper))*\b/gi, ' ')
    .replace(/^[\s+,&/:-]+|[\s+,&/:-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(?:lead|main|sub|rap|rapper)$/i.test(remainder)) remainder = '';
  return { anchors, localCues: remainder ? [remainder] : [], sawVocalReference: true };
}

function anchorForSectionRole(anchor: string, _entry: V1SectionBlueprintEntry): string {
  // The selected role combination is part of the singer's fixed identity.
  // Do not shrink Rap/Main, Rap/Lead, etc. to a single role per section.
  return String(anchor || '')
    .replace(/\bRapper\b/gi, 'Rap')
    .replace(/\s+/g, ' ')
    .trim();
}

function sharedFinalAnchor(blueprint: V1SectionBlueprint): string {
  const genders = blueprint.vocalAnchors.map((anchor) => /^Female\b/i.test(anchor) ? 'female' : /^Male\b/i.test(anchor) ? 'male' : 'other');
  if (genders.length && genders.every((gender) => gender === 'male')) return 'All Male Voices';
  if (genders.length && genders.every((gender) => gender === 'female')) return 'All Female Voices';
  return 'All Voices';
}

function cleanLeakedVocalDirections(lines: string[]): string[] {
  const directive = /\(\s*(?:(?:Male|Female)\s+[A-Z](?:\s+(?:Main|Lead|Sub|Rap|Rapper)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*)?|Vocal\s+[A-Z](?:\s+(?:Male|Female))?(?:\s+(?:Main|Lead|Sub|Rap|Rapper)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*)?)(?:\s*,[^)]*)?\s*\)/gi;
  return cleanLines(lines.map((line) => String(line || '')
    .replace(directive, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()));
}

function leastUsedAnchor(blueprint: V1SectionBlueprint, state: RenderState): string {
  return [...blueprint.vocalAnchors]
    .sort((a, b) => (state.anchorUsage.get(a) || 0) - (state.anchorUsage.get(b) || 0))[0] || '';
}

function isAmbiguousSoundDescriptionLine(value: string): boolean {
  const line = String(value || '').trim();
  if (!line || /^\(|^\[/.test(line)) return false;
  const hasPersonalMeaning = /\b(?:i|you|we|my|your|our|heart|remember|feel|want|love)\b/i.test(line)
    || /(?:나는|내가|나를|너는|네가|우리는|우리의|마음|기억|생각|느껴|원해|사랑)/.test(line);
  if (hasPersonalMeaning) return false;
  const koreanSoundDescription = /(?:소리|울림|메아리|진동|빗소리|발자국)\s*$/.test(line);
  const englishSoundDescription = /\b(?:sound|echo|ringing|tapping|rumble|rattling|dripping|footsteps?)\s*$/i.test(line);
  const onomatopoeiaOnly = /^(?:[가-힣a-z]{1,5}[,·.\s-]*){1,4}$/i.test(line) && /[,·.]/.test(line);
  return koreanSoundDescription || englishSoundDescription || onomatopoeiaOnly;
}

function normalizeVocalAdlibFragment(value: string): string {
  return String(value || '')
    .replace(/^\s*(?:sound\s*effect|vocal\s*ad[-\s]?lib|ad[-\s]?lib|humming?)\s*[:：]\s*/i, '')
    .replace(/^\(|\)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isClearVocalAdlibFragment(value: string): boolean {
  const clean = normalizeVocalAdlibFragment(value);
  if (!clean) return false;
  const compact = clean
    .toLowerCase()
    .replace(/[\s,，.·…~\-—_'"!?]+/g, '');
  if (!compact) return false;
  // Only unmistakable human vocal syllables belong here. Object/foley onomatopoeia such as
  // 툭, 쿵, 탁, 철컥 is intentionally excluded and remains a real sound cue.
  return /^(?:(?:음|흠|아|어|오|우|으|에|예|야|여|요|하|후|호|헤|히|mm+|hm+|ah+|oh+|ooh+|woo+|uh+|hey+))+$/i.test(compact);
}

function splitVocalAdlibsFromStandaloneCues(block: V1LyricBlock): V1LyricBlock {
  const clone: V1LyricBlock = {
    originalSection: block.originalSection ? { ...block.originalSection } : null,
    standaloneCues: [],
    bodyLines: [...block.bodyLines],
  };
  const adlibs: string[] = [];

  block.standaloneCues.forEach((rawCue) => {
    const inside = String(rawCue || '').trim().replace(/^\[|\]$/g, '').trim();
    const hasSoundPrefix = /^sound\s*effect\s*[:：]/i.test(inside);
    const payload = inside.replace(/^sound\s*effect\s*[:：]\s*/i, '');
    const parts = payload.split(/\s*(?:\/|\||;|；)\s*/g).map((part) => part.trim()).filter(Boolean);
    const kept: string[] = [];
    parts.forEach((part) => {
      if (isClearVocalAdlibFragment(part)) {
        const normalized = normalizeVocalAdlibFragment(part);
        if (normalized && !adlibs.some((item) => cueKey(item) === cueKey(normalized))) adlibs.push(normalized);
      } else {
        kept.push(part);
      }
    });

    if (kept.length) {
      const rebuilt = hasSoundPrefix ? `sound effect: ${kept.join(' / ')}` : kept.join(' / ');
      clone.standaloneCues.push(`[${rebuilt}]`);
    }
  });

  if (adlibs.length) {
    const adlibLines = adlibs.map((item) => `(${item})`);
    const existingKeys = new Set(clone.bodyLines.map(cueKey));
    clone.bodyLines = [
      ...adlibLines.filter((line) => !existingKeys.has(cueKey(line))),
      ...clone.bodyLines,
    ];
  }
  return clone;
}

function separateLeadingAmbiguousSoundCue(
  entry: V1SectionBlueprintEntry,
  block: V1LyricBlock,
): V1LyricBlock {
  const clone: V1LyricBlock = {
    originalSection: block.originalSection ? { ...block.originalSection } : null,
    standaloneCues: [...block.standaloneCues],
    bodyLines: [...block.bodyLines],
  };
  const sectionCue = String(block.originalSection?.cue || '').toLowerCase();
  const explicitlySpoken = /\b(?:spoken|recit|narrat|conversational|talk)\b/i.test(sectionCue);
  const nonLexicalDelivery = /\b(?:hum|humming|instrumental|no[-\s]?vocal)\b/i.test(sectionCue);
  const openingOrClosing = /^(?:Intro|Outro)$/i.test(entry.name);
  if (explicitlySpoken || (!nonLexicalDelivery && !openingOrClosing)) return clone;

  const body = cleanLines(clone.bodyLines);
  const leading: string[] = [];
  let consumed = 0;
  for (const line of body) {
    if (!line) {
      if (leading.length) consumed += 1;
      continue;
    }
    if (leading.length >= 2 || !isAmbiguousSoundDescriptionLine(line)) break;
    leading.push(line);
    consumed += 1;
  }
  if (!leading.length) return clone;

  const cueText = cleanV1SectionCue(`sound effect: ${leading.join(' / ')}`).slice(0, 180);
  clone.standaloneCues.unshift(`[${cueText}]`);
  clone.bodyLines = cleanLines(body.slice(consumed));
  return clone;
}

type AlignedSectionBlock = { entry: V1SectionBlueprintEntry; block: V1LyricBlock };

function anchorsInBlock(item: AlignedSectionBlock, blueprint: V1SectionBlueprint): string[] {
  const selected = partitionCues(item.entry.customTags || []);
  const existing = partitionCues([item.block.originalSection?.cue || '']);
  const anchors: string[] = [];
  [...selected.performance, ...existing.performance].forEach((value) => {
    normalizeVocalAnchorCue(value, blueprint).anchors.forEach((anchor) => {
      if (blueprint.vocalAnchors.includes(anchor) && !anchors.includes(anchor)) anchors.push(anchor);
    });
  });
  return anchors;
}

function hasSharedVoiceCue(item: AlignedSectionBlock): boolean {
  return [...(item.entry.customTags || []), item.block.originalSection?.cue || '']
    .some((value) => /\ball\s+(?:voices|vocals|female\s+(?:voices|vocals)|male\s+(?:voices|vocals))\b/i.test(String(value || '')));
}

function forceShortAnchorIntoBlock(item: AlignedSectionBlock, anchor: string, blueprint: V1SectionBlueprint): void {
  const existing = partitionCues([item.block.originalSection?.cue || '']);
  const localPerformance: string[] = [];
  existing.performance.forEach((value) => {
    const normalized = normalizeVocalAnchorCue(value, blueprint);
    normalized.localCues.forEach((cue) => {
      if (cue && !localPerformance.some((other) => cueKey(other) === cueKey(cue))) localPerformance.push(cue);
    });
  });
  const cue = [anchor, ...localPerformance.slice(0, 1), ...existing.production].filter(Boolean).join(', ');
  item.block.originalSection = {
    raw: item.block.originalSection?.raw || '',
    name: item.entry.name,
    cue,
  };
}

function ensureSelectedVoicesReceiveMeaningfulSections(
  aligned: AlignedSectionBlock[],
  blueprint: V1SectionBlueprint,
): AlignedSectionBlock[] {
  if (blueprint.vocalAnchors.length <= 1) return aligned;

  const cloned = aligned.map(({ entry, block }) => ({
    entry,
    block: {
      originalSection: block.originalSection ? { ...block.originalSection } : null,
      standaloneCues: [...block.standaloneCues],
      bodyLines: [...block.bodyLines],
    },
  }));
  const used = new Set(cloned.flatMap((item) => anchorsInBlock(item, blueprint)));
  const missing = blueprint.vocalAnchors.filter((anchor) => !used.has(anchor));
  if (!missing.length) return cloned;

  const candidates = cloned
    .map((item, index) => ({ item, index, anchors: anchorsInBlock(item, blueprint) }))
    .filter(({ item, anchors }) => item.entry.allowsLyrics
      && hasConcreteBody(item.block)
      && !hasSharedVoiceCue(item)
      && !item.entry.customTags.some(isProtectedVocalAnchor)
      && anchors.length <= 1);
  if (!candidates.length) return cloned;

  const selectedIndexes = new Set<number>();
  missing.slice(0, candidates.length).forEach((anchor, missingIndex, allMissing) => {
    const target = ((missingIndex + 1) * (candidates.length + 1)) / (allMissing.length + 1) - 1;
    const available = candidates.filter((candidate) => !selectedIndexes.has(candidate.index));
    const chosen = [...available].sort((a, b) => {
      const aEmpty = a.anchors.length === 0 ? -1 : 0;
      const bEmpty = b.anchors.length === 0 ? -1 : 0;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      return Math.abs(a.index - target) - Math.abs(b.index - target);
    })[0];
    if (!chosen) return;
    forceShortAnchorIntoBlock(chosen.item, anchor, blueprint);
    selectedIndexes.add(chosen.index);
  });

  return cloned;
}

type RenderState = {
  usedGeneratedPerformance: Set<string>;
  anchorUsage: Map<string, number>;
};

function fallbackPerformanceCueForSection(entry: V1SectionBlueprintEntry): string {
  // Last-resort format safety only. The generated/current-song cue remains the first choice.
  // This prevents a sung section from escaping as a bare [Chorus 1] when the model omitted
  // only the performance cue while preserving the section's real lyric body.
  const returning = entry.occurrence > 1;
  switch (entry.roleFamily) {
    case 'opening': return 'brief scene-setting entry';
    case 'development': return returning ? 'advancing narrative phrasing' : 'conversational narrative phrasing';
    case 'lift': return returning ? 'tightening rising phrasing' : 'restrained rising phrasing';
    case 'hook': return returning ? 'expanded returning hook delivery' : 'focused melodic payoff';
    case 'recurrence': return returning ? 'warmer returning refrain' : 'restrained recurring refrain';
    case 'contrast': return 'exposed contrasting delivery';
    case 'release': return 'clipped rhythmic release';
    case 'payoff': return 'full-register final payoff';
    case 'closing': return 'fading closing delivery';
    case 'space': return '';
    default: return 'section-specific delivery';
  }
}

function renderSectionTag(
  entry: V1SectionBlueprintEntry,
  block: V1LyricBlock,
  blueprint: V1SectionBlueprint,
  state: RenderState,
): { tag: string; productionCues: string[] } {
  const existing = partitionCues([block.originalSection?.cue || '']);
  const selected = partitionCues(entry.customTags || []);

  const normalizedAnchors: string[] = [];
  const generatedLocalParts: string[] = [];
  let sawVocalReference = false;
  [...selected.performance, ...existing.performance].forEach((value) => {
    const normalized = normalizeVocalAnchorCue(value, blueprint);
    sawVocalReference ||= normalized.sawVocalReference;
    normalized.anchors.forEach((anchor) => {
      if (!normalizedAnchors.includes(anchor)) normalizedAnchors.push(anchor);
    });
    normalized.localCues.forEach((cue) => generatedLocalParts.push(cue));
  });

  if (blueprint.vocalCount > 1 && !normalizedAnchors.length && entry.allowsLyrics) {
    // Final technical fallback only: an undefined/stale old Vocal label must never survive.
    // When Gemini omitted a valid owner entirely, use the least-used declared anchor rather
    // than inventing Vocal D/E or changing gender/role. The creative prompt still chooses
    // ownership first; this path only repairs invalid public output.
    const fallback = leastUsedAnchor(blueprint, state);
    if (fallback && (sawVocalReference || block.bodyLines.some((line) => String(line || '').trim()))) {
      normalizedAnchors.push(fallback);
    }
  }

  const isSharedFinal = blueprint.mode !== 'custom'
    && blueprint.vocalCount > 1
    && /^(?:Final Chorus|Final Hook|Climax)$/i.test(entry.name)
    && !entry.customTags.some(isProtectedVocalAnchor);
  if (isSharedFinal) {
    normalizedAnchors.splice(0, normalizedAnchors.length, sharedFinalAnchor(blueprint));
  }

  normalizedAnchors.forEach((anchor) => state.anchorUsage.set(anchor, (state.anchorUsage.get(anchor) || 0) + 1));

  // User-selected custom cues are explicit instructions and must be preserved.
  const selectedPerformance = selected.performance
    .filter((value) => !isProtectedVocalAnchor(value))
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((other) => cueKey(other) === cueKey(value)) === index);

  // Gemini-generated local cues may vary by section, but global singer identity belongs
  // in [Vocals], not repeated as a free-floating tone label. Repeated generated cues are
  // removed so one stale word cannot fill the whole song.
  const generatedPerformance = generatedLocalParts.filter((value) => {
    if (!value) return false;
    if (/^(?:main|lead|sub|rap|rapper)$/i.test(cleanV1SectionCue(value))) return false;
    if (blueprint.vocalCount <= 1 && isStaticSoloIdentityCue(value)) return false;
    const key = cueKey(value);
    if (!key || state.usedGeneratedPerformance.has(key)) return false;
    state.usedGeneratedPerformance.add(key);
    return true;
  });

  const localPerformance = [...selectedPerformance, ...generatedPerformance]
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((other) => cueKey(other) === cueKey(value)) === index)
    .slice(0, 1);

  const renderedAnchors = normalizedAnchors.map((anchor) => anchorForSectionRole(anchor, entry));
  const anchorText = renderedAnchors.length > 1
    ? renderedAnchors.join(' + ')
    : renderedAnchors[0] || '';
  const performance = [anchorText, ...localPerformance].filter(Boolean);
  if (!performance.length && entry.allowsLyrics && hasConcreteBody(block)) {
    const fallbackCue = cleanV1SectionCue(fallbackPerformanceCueForSection(entry));
    if (fallbackCue) performance.push(fallbackCue);
  }

  const productionCues = [...selected.production, ...existing.production]
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((other) => cueKey(other) === cueKey(value)) === index)
    .slice(0, 3);

  const tag = performance.length
    ? `[${entry.name} : ${performance.join(', ')}]`
    : `[${entry.name}]`;
  return { tag, productionCues };
}

export function renderV1SectionBlocks(
  aligned: AlignedSectionBlock[],
  blueprint: V1SectionBlueprint,
): string {
  const rendered: string[] = [];
  const state: RenderState = {
    usedGeneratedPerformance: new Set<string>(),
    anchorUsage: new Map<string, number>(),
  };

  const coverageBalanced = ensureSelectedVoicesReceiveMeaningfulSections(aligned, blueprint);

  coverageBalanced.forEach(({ entry, block }) => {
    const adlibSeparated = splitVocalAdlibsFromStandaloneCues(block);
    const preparedBlock = separateLeadingAmbiguousSoundCue(entry, adlibSeparated);
    preparedBlock.bodyLines = cleanLeakedVocalDirections(preparedBlock.bodyLines);
    // A required sung section with no body is an invalid generation artifact. Never expose
    // a trailing skeleton such as [Verse] [Chorus] [Bridge] with blank bodies.
    if (entry.requiresLyrics && !hasConcreteBody(preparedBlock)) return;
    const { tag, productionCues } = renderSectionTag(entry, preparedBlock, blueprint, state);
    rendered.push(tag);

    const standalone = [
      ...productionCues.map((cue) => `[${cue}]`),
      ...preparedBlock.standaloneCues.map(normalizeStandaloneCue),
    ]
      .filter(Boolean)
      .filter((value, index, all) => all.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index);
    rendered.push(...standalone);

    if (entry.allowsLyrics) {
      rendered.push(...cleanLines(preparedBlock.bodyLines));
    }
    rendered.push('');
  });

  return rendered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function blockHasConcreteLyrics(block: V1LyricBlock): boolean {
  return hasConcreteBody(block);
}
