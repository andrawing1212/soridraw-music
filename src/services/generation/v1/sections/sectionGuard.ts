import type { V1SectionEngineParams, V1SectionBlueprint, V1SectionBlueprintEntry } from './sectionBlueprint';
import { getV1SectionBlueprint } from './sectionBlueprint';
import { baseV1SectionName, normalizeV1SectionName } from './sectionRegistry';
import { getV1SectionRolePolicy, v1SectionMassRank } from './sectionRoleEngine';
import { blockHasConcreteLyrics, parseV1LyricBlocks, renderV1SectionBlocks, type V1LyricBlock } from './sectionRenderer';

export interface V1SectionValidationIssue {
  code: 'missing-section' | 'extra-block' | 'empty-sung-section' | 'lyrics-in-instrumental' | 'duplicate-nonhook-body' | 'unexpected-consecutive-section';
  message: string;
}

export interface V1SectionRoleIssue {
  code:
    | 'intro-overdeveloped'
    | 'humming-intro-lexical-overflow'
    | 'final-payoff-underdeveloped'
    | 'role-body-duplicate'
    | 'refrain-missing-return'
    | 'refrain-overdeveloped'
    | 'refrain-identity-lost'
    | 'compact-role-overdeveloped'
    | 'outro-restarts-story'
    | 'vocal-coverage-missing'
    | 'vocal-anchor-undefined'
    | 'vocal-direction-leak'
    | 'shared-final-voice-missing'
    | 'main-core-ownership-missing'
    | 'lead-flow-ownership-missing'
    | 'rap-section-owner-missing';
  message: string;
}

function explicitSectionInstructionText(params: V1SectionEngineParams): string {
  const custom = (params.customStructure || []).flatMap((item) => [item.section, ...(item.tags || [])]);
  return [params.userInput || '', ...custom]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
}

const USER_OVERRIDE_INTENT = /(?:\blong(?:er)?\b|\bextended\b|\bfull[-\s]?length\b|\bshort(?:er)?\b|\bbrief\b|\bminimal\b|\bone[-\s]?line\b|\bonce\b|\bonly\s+once\b|\bno\s+repeat\b|\brepeat\b|\bexact(?:ly)?\b|\bsame\b|\bcopy\b|\bmonologue\b|\bdialogue\b|\bstory\b|\bnarrative\b|\blyric[-\s]?free\b|\bno\s+lyrics?\b|\binstrumental\b|\bsolo\b|\bonly\s+(?:one|a|male|female|vocal|voice)\b|\bshared\b|\brestart\b|\bcontinue\b|\bnew\s+(?:story|scene|verse)\b|길게|더\s*길게|짧게|더\s*짧게|한\s*줄|한\s*번만|한번만|한\s*번|반복\s*(?:하지\s*마|금지|없이)?|그대로|똑같이|동일하게|복사|독백|대화|이야기|서사|가사\s*(?:없이|없게)|연주만|인스트루멘탈|솔로|한\s*명만|한명만|함께|합창|새\s*(?:이야기|장면|벌스)|이어(?:서|가)|계속)/i;
const USER_GENERIC_SECTION_OVERRIDE = /(?:사용자|내|직접|명령창|디렉터)\s*(?:의\s*)?(?:섹션\s*)?(?:명령|지시|설계).{0,24}(?:우선|그대로|따라)|(?:섹션\s*)?(?:역할|구조).{0,24}(?:사용자|직접|명령창|디렉터).{0,24}(?:우선|그대로)|\buser\s+(?:section\s+)?(?:instruction|directive|design).{0,24}\b(?:override|priority|first)\b|\bignore\s+(?:the\s+)?(?:default\s+)?section\s+role\b/i;

function hasUserOverrideFor(text: string, sectionPattern: RegExp, intentPattern: RegExp = USER_OVERRIDE_INTENT): boolean {
  const flags = sectionPattern.flags.includes('g') ? sectionPattern.flags : `${sectionPattern.flags}g`;
  const matcher = new RegExp(sectionPattern.source, flags);
  const matches = Array.from(text.matchAll(matcher));
  return matches.some((match) => {
    const start = Math.max(0, (match.index || 0) - 72);
    const end = Math.min(text.length, (match.index || 0) + String(match[0] || '').length + 72);
    intentPattern.lastIndex = 0;
    return intentPattern.test(text.slice(start, end));
  });
}

/**
 * Section Role Engine rules are defaults, not a reason to erase an intentional user exception.
 * Keep technical syntax/voice errors active, but suppress only the role-shape issue that the
 * direct instruction explicitly overrides.
 */
export function filterV1SectionRoleIssuesForUserIntent(
  issues: V1SectionRoleIssue[],
  params: V1SectionEngineParams,
): V1SectionRoleIssue[] {
  if (!issues.length) return issues;
  const text = explicitSectionInstructionText(params);
  if (!text) return issues;

  const genericOverride = USER_GENERIC_SECTION_OVERRIDE.test(text);
  const introOverride = hasUserOverrideFor(text, /\bintro\b|인트로|도입부/i);
  const refrainOnceOverride = hasUserOverrideFor(
    text,
    /\brefrain\b|리프레인|반복구/i,
    /\bonly\s+once\b|\bonce\b|\bno\s+repeat\b|한\s*번만|한번만|한\s*번|반복\s*(?:하지\s*마|금지|없이)/i,
  );
  const refrainMassOverride = hasUserOverrideFor(
    text,
    /\brefrain\b|리프레인|반복구/i,
    /\blong(?:er)?\b|\bextended\b|\bfull[-\s]?length\b|\bstory\b|\bnarrative\b|\bverse[-\s]?like\b|길게|더\s*길게|이야기|서사|벌스처럼/i,
  );
  const refrainIdentityOverride = hasUserOverrideFor(
    text,
    /\brefrain\b|리프레인|반복구/i,
    /\bdifferent\b|\bchange\b|\bvariation\b|\beach\s+time\b|매번\s*다르게|다르게|변주|변화/i,
  );
  const compactOverride = hasUserOverrideFor(
    text,
    /\bhook\b|\bbuild[-\s]?up\b|\bdrop\b|\bbreakdown\b|훅|빌드\s*업|빌드업|드롭|브레이크다운/i,
    /\blong(?:er)?\b|\bextended\b|\bfull[-\s]?length\b|\bstory\b|\bnarrative\b|\bverse[-\s]?like\b|길게|더\s*길게|이야기|서사|벌스처럼/i,
  );
  const finalPayoffOverride = hasUserOverrideFor(
    text,
    /\bfinal\s+(?:chorus|hook)\b|\blast\s+(?:chorus|hook)\b|파이널\s*(?:코러스|후렴|훅)|마지막\s*(?:코러스|후렴|훅)/i,
    /\bshort(?:er)?\b|\bbrief\b|\bminimal\b|\bone[-\s]?line\b|\bquiet\b|\bsoft\b|\bfade\b|짧게|더\s*짧게|한\s*줄|최소|조용|잔잔|페이드/i,
  );
  const outroOverride = hasUserOverrideFor(
    text,
    /\boutro\b|아웃트로|종주부|후주/i,
    /\blong(?:er)?\b|\bextended\b|\bfull[-\s]?length\b|\brestart\b|\bcontinue\b|\bnew\s+(?:story|scene|verse)\b|\bstory\b|\bnarrative\b|길게|더\s*길게|새\s*(?:이야기|장면|벌스)|이어(?:서|가)|계속|이야기|서사/i,
  );
  const duplicateOverride = hasUserOverrideFor(
    text,
    /\bverse\b|\bbridge\b|\boutro\b|\bfinal\s+(?:chorus|hook)\b|\brap\s+section\b|벌스|브릿지|아웃트로|마지막\s*(?:후렴|훅)|랩\s*섹션/i,
    /\brepeat\b|\bexact(?:ly)?\b|\bsame\b|\bcopy\b|반복|그대로|똑같이|동일하게|복사/i,
  );
  const soloFinalOverride = hasUserOverrideFor(
    text,
    /\bfinal\s+(?:chorus|hook)\b|\blast\s+(?:chorus|hook)\b|파이널\s*(?:코러스|후렴|훅)|마지막\s*(?:코러스|후렴|훅)/i,
    /\bsolo\b|\bonly\s+(?:one|a|male|female|vocal|voice)\b|솔로|한\s*명만|한명만|단독/i,
  );
  const singerOwnershipOverride = /(?:\b(?:main|lead|sub|rap|rapper|vocal\s+[a-z]|male\s+[a-z]|female\s+[a-z])\b|메인|리드|서브|래퍼|보컬\s*[A-Z]).{0,56}(?:\b(?:intro|verse|pre[-\s]?chorus|chorus|hook|rap\s+section|bridge|climax|outro)\b|인트로|벌스|프리코러스|후렴|훅|랩\s*섹션|브릿지|클라이맥스|아웃트로).{0,32}(?:\b(?:own|lead|sing|solo|only|assign)\b|담당|부르|맡|단독)|(?:\b(?:intro|verse|pre[-\s]?chorus|chorus|hook|rap\s+section|bridge|climax|outro)\b|인트로|벌스|프리코러스|후렴|훅|랩\s*섹션|브릿지|클라이맥스|아웃트로).{0,56}(?:\b(?:main|lead|sub|rap|rapper|vocal\s+[a-z]|male\s+[a-z]|female\s+[a-z])\b|메인|리드|서브|래퍼|보컬\s*[A-Z]).{0,32}(?:\b(?:own|lead|sing|solo|only|assign)\b|담당|부르|맡|단독)/i.test(text);

  return issues.filter((issue) => {
    if (genericOverride && [
      'intro-overdeveloped',
      'humming-intro-lexical-overflow',
      'final-payoff-underdeveloped',
      'role-body-duplicate',
      'refrain-missing-return',
      'refrain-overdeveloped',
      'refrain-identity-lost',
      'compact-role-overdeveloped',
      'outro-restarts-story',
      'shared-final-voice-missing',
      'main-core-ownership-missing',
      'lead-flow-ownership-missing',
      'rap-section-owner-missing',
    ].includes(issue.code)) return false;

    if ((issue.code === 'intro-overdeveloped' || issue.code === 'humming-intro-lexical-overflow') && introOverride) return false;
    if (issue.code === 'refrain-missing-return' && refrainOnceOverride) return false;
    if (issue.code === 'refrain-overdeveloped' && refrainMassOverride) return false;
    if (issue.code === 'refrain-identity-lost' && refrainIdentityOverride) return false;
    if (issue.code === 'compact-role-overdeveloped' && compactOverride) return false;
    if (issue.code === 'final-payoff-underdeveloped' && finalPayoffOverride) return false;
    if (issue.code === 'outro-restarts-story' && outroOverride) return false;
    if (issue.code === 'role-body-duplicate' && duplicateOverride) return false;
    if (issue.code === 'shared-final-voice-missing' && soloFinalOverride) return false;
    if (['main-core-ownership-missing', 'lead-flow-ownership-missing', 'rap-section-owner-missing'].includes(issue.code) && singerOwnershipOverride) return false;
    return true;
  });
}

type AlignedBlock = { entry: V1SectionBlueprintEntry; block: V1LyricBlock };

function emptyBlock(): V1LyricBlock {
  return { originalSection: null, standaloneCues: [], bodyLines: [] };
}

function cloneBlock(block: V1LyricBlock): V1LyricBlock {
  return {
    originalSection: block.originalSection ? { ...block.originalSection } : null,
    standaloneCues: [...block.standaloneCues],
    bodyLines: [...block.bodyLines],
  };
}

function compactBodyLines(lines: string[]): string[] {
  const out: string[] = [];
  lines.forEach((line) => {
    const value = String(line || '').trim();
    if (!value) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      return;
    }
    out.push(value);
  });
  while (out[0] === '') out.shift();
  while (out[out.length - 1] === '') out.pop();
  return out;
}

function mergeBlockInto(target: V1LyricBlock, source: V1LyricBlock, prepend = false): void {
  target.standaloneCues = (prepend
    ? [...source.standaloneCues, ...target.standaloneCues]
    : [...target.standaloneCues, ...source.standaloneCues])
    .filter((value, index, all) => all.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index);

  const sourceBody = compactBodyLines(source.bodyLines);
  const targetBody = compactBodyLines(target.bodyLines);
  target.bodyLines = compactBodyLines(prepend
    ? [...sourceBody, ...(sourceBody.length && targetBody.length ? [''] : []), ...targetBody]
    : [...targetBody, ...(sourceBody.length && targetBody.length ? [''] : []), ...sourceBody]);
  if (!target.originalSection && source.originalSection) target.originalSection = { ...source.originalSection };
}

function entryMatchScore(entry: V1SectionBlueprintEntry, block: V1LyricBlock): number {
  const rawName = block.originalSection?.name || '';
  if (!rawName) return -1;
  const normalized = normalizeV1SectionName(rawName);
  if (normalized.toLowerCase() === entry.name.toLowerCase()) return 4;
  if (baseV1SectionName(normalized).toLowerCase() === baseV1SectionName(entry.name).toLowerCase()) return 2;
  return -1;
}

function stableExpectedIndexForBlock(
  block: V1LyricBlock,
  blueprint: V1SectionBlueprint,
  startIndex: number,
): number {
  if (!block.originalSection) return -1;
  const candidates = blueprint.entries
    .map((entry, index) => ({ index, score: index < startIndex ? -1 : entryMatchScore(entry, block) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.index ?? -1;
}

function stableParagraphs(lines: string[]): string[][] {
  const paragraphs: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    const clean = compactBodyLines(current);
    if (clean.some((line) => line.trim())) paragraphs.push(clean);
    current = [];
  };
  compactBodyLines(lines).forEach((line) => {
    if (!String(line || '').trim()) flush();
    else current.push(line);
  });
  flush();
  return paragraphs;
}

/**
 * Stable is an exact public contract. Gemini occasionally emits the right ten lyric
 * paragraphs but forgets several structural headers. Recover those omitted headers
 * from paragraph boundaries before alignment. This changes structure only; it never
 * invents lyric content. A selected Rap block is mapped to the next promised Stable
 * slot (normally Verse 2), preserving its singer/performance cue while keeping the
 * visible section label stable.
 */
function recoverStableParagraphSections(
  blocks: V1LyricBlock[],
  blueprint: V1SectionBlueprint,
): V1LyricBlock[] {
  if (blueprint.mode !== 'stable' || !blocks.length) return blocks;

  const explicitNames = blocks
    .filter((block) => Boolean(block.originalSection))
    .map((block) => normalizeV1SectionName(block.originalSection?.name || '').toLowerCase());
  const expectedNames = blueprint.entries.map((entry) => entry.name.toLowerCase());
  const alreadyExact = explicitNames.length === expectedNames.length
    && explicitNames.every((name, index) => name === expectedNames[index]);
  if (alreadyExact) return blocks;

  const recovered: V1LyricBlock[] = [];
  let cursor = 0;

  blocks.forEach((rawBlock, blockIndex) => {
    const block = cloneBlock(rawBlock);
    let assignedIndex = stableExpectedIndexForBlock(block, blueprint, cursor);

    // Unknown structural names (most commonly an auto-created Rap Section) must not
    // collapse backward into the previous section. They occupy the next promised
    // lyric-capable Stable slot instead.
    if (assignedIndex < 0 && block.originalSection) {
      assignedIndex = blueprint.entries.findIndex((entry, index) => index >= cursor && entry.allowsLyrics);
    }
    if (assignedIndex < 0) {
      recovered.push(block);
      return;
    }

    let nextKnownIndex = blueprint.entries.length;
    let nextKnownBlock: V1LyricBlock | null = null;
    for (let lookahead = blockIndex + 1; lookahead < blocks.length; lookahead += 1) {
      const candidate = stableExpectedIndexForBlock(blocks[lookahead], blueprint, assignedIndex + 1);
      if (candidate >= 0) {
        nextKnownIndex = candidate;
        nextKnownBlock = blocks[lookahead];
        break;
      }
    }

    const includeEmptyNextKnown = nextKnownIndex < blueprint.entries.length
      && Boolean(nextKnownBlock)
      && !blockHasConcreteLyrics(nextKnownBlock!)
      && blueprint.entries[nextKnownIndex].allowsLyrics;
    const availableEndExclusive = Math.min(
      blueprint.entries.length,
      nextKnownIndex + (includeEmptyNextKnown ? 1 : 0),
    );
    const availableIndexes = blueprint.entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry, index }) => index >= assignedIndex && index < availableEndExclusive && entry.allowsLyrics)
      .map(({ index }) => index);
    const paragraphs = stableParagraphs(block.bodyLines);
    const canRecoverMissingHeaders = paragraphs.length > 1 && availableIndexes.length > 1;

    if (!canRecoverMissingHeaders) {
      const entry = blueprint.entries[assignedIndex];
      block.originalSection = {
        raw: block.originalSection?.raw || `[${entry.name}]`,
        name: entry.name,
        cue: block.originalSection?.cue || '',
      };
      recovered.push(block);
      cursor = assignedIndex + 1;
      return;
    }

    const assignCount = Math.min(paragraphs.length, availableIndexes.length);
    for (let paragraphIndex = 0; paragraphIndex < assignCount; paragraphIndex += 1) {
      const entryIndex = availableIndexes[paragraphIndex];
      const entry = blueprint.entries[entryIndex];
      const isFirst = paragraphIndex === 0;
      const payload = paragraphIndex === assignCount - 1 && paragraphs.length > assignCount
        ? paragraphs.slice(paragraphIndex).flatMap((paragraph, index) => index ? ['', ...paragraph] : paragraph)
        : paragraphs[paragraphIndex];
      recovered.push({
        originalSection: {
          raw: isFirst ? (block.originalSection?.raw || `[${entry.name}]`) : `[${entry.name}]`,
          name: entry.name,
          cue: isFirst ? (block.originalSection?.cue || '') : '',
        },
        standaloneCues: isFirst ? [...block.standaloneCues] : [],
        bodyLines: compactBodyLines(payload),
      });
    }
    cursor = availableIndexes[Math.max(0, assignCount - 1)] + 1;
  });

  return recovered;
}

function alignBlocksToBlueprint(blocks: V1LyricBlock[], blueprint: V1SectionBlueprint): AlignedBlock[] {
  if (!blueprint.entries.length) return [];
  const aligned = blueprint.entries.map((entry) => ({ entry, block: emptyBlock() }));
  const occupied = new Set<number>();
  let lastMatched = -1;

  blocks.forEach((rawBlock) => {
    const block = cloneBlock(rawBlock);
    if (!block.originalSection) {
      const targetIndex = lastMatched >= 0
        ? lastMatched
        : aligned.findIndex((item) => item.entry.allowsLyrics);
      if (targetIndex >= 0) mergeBlockInto(aligned[targetIndex].block, block);
      return;
    }

    const candidates = aligned
      .map((item, index) => ({ index, score: occupied.has(index) ? -1 : entryMatchScore(item.entry, block) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((a, b) => {
        const aForward = a.index >= lastMatched ? 1 : 0;
        const bForward = b.index >= lastMatched ? 1 : 0;
        return b.score - a.score || bForward - aForward || Math.abs(a.index - lastMatched) - Math.abs(b.index - lastMatched);
      });

    const chosen = candidates[0];
    if (chosen) {
      mergeBlockInto(aligned[chosen.index].block, block);
      occupied.add(chosen.index);
      lastMatched = chosen.index;
      return;
    }

    // Unknown or duplicate structural blocks must not shift every later section by position.
    // Preserve their body near the closest already matched lyric-capable section instead.
    const fallbackIndex = [...aligned.keys()]
      .filter((index) => aligned[index].entry.allowsLyrics)
      .sort((a, b) => Math.abs(a - Math.max(lastMatched, 0)) - Math.abs(b - Math.max(lastMatched, 0)))[0];
    if (fallbackIndex !== undefined) mergeBlockInto(aligned[fallbackIndex].block, block);
  });

  return aligned;
}

function moveLyricsOutOfNonVocalSections(aligned: AlignedBlock[]): void {
  aligned.forEach((item, index) => {
    if (item.entry.allowsLyrics || !blockHasConcreteLyrics(item.block)) return;
    const target = aligned.slice(index + 1).find((candidate) => candidate.entry.allowsLyrics)
      || [...aligned.slice(0, index)].reverse().find((candidate) => candidate.entry.allowsLyrics);
    if (!target) return;
    const moved = item.block.bodyLines.filter((line) => String(line || '').trim());
    if (moved.length) {
      if (target.block.bodyLines.length && target.block.bodyLines[target.block.bodyLines.length - 1] !== '') target.block.bodyLines.push('');
      target.block.bodyLines.push(...moved);
    }
    item.block.bodyLines = [];
  });
}

function bodyFingerprint(block: V1LyricBlock): string {
  return block.bodyLines
    .map((line) => String(line || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
    .replace(/[^\p{L}\p{N}|]+/gu, '');
}

export function inspectV1SectionBlueprintFit(aligned: AlignedBlock[]): V1SectionValidationIssue[] {
  const issues: V1SectionValidationIssue[] = [];
  const seenBodies = new Map<string, string>();

  aligned.forEach(({ entry, block }, index) => {
    const hasLyrics = blockHasConcreteLyrics(block);
    if (entry.requiresLyrics && !hasLyrics) issues.push({ code: 'empty-sung-section', message: `${entry.name} has no lyric body.` });
    if (!entry.allowsLyrics && hasLyrics) issues.push({ code: 'lyrics-in-instrumental', message: `${entry.name} unexpectedly owns lyric lines.` });

    const fingerprint = bodyFingerprint(block);
    const base = baseV1SectionName(entry.name);
    if (fingerprint && fingerprint.length > 20) {
      const previous = seenBodies.get(fingerprint);
      if (previous && !/^(?:Pre-Chorus|Chorus|Hook|Refrain)$/i.test(base)) {
        issues.push({ code: 'duplicate-nonhook-body', message: `${entry.name} repeats the same body as ${previous}.` });
      }
      if (!previous) seenBodies.set(fingerprint, entry.name);
    }

    const previousEntry = aligned[index - 1]?.entry;
    if (previousEntry && baseV1SectionName(previousEntry.name).toLowerCase() === base.toLowerCase()) {
      const expectedRepeat = /^(?:Refrain|Hook|Chorus)$/i.test(base) && previousEntry.id !== entry.id;
      if (!expectedRepeat) issues.push({ code: 'unexpected-consecutive-section', message: `${previousEntry.name} and ${entry.name} are consecutive duplicates.` });
    }
  });
  return issues;
}

function concreteBodyLines(block: V1LyricBlock): string[] {
  return compactBodyLines(block.bodyLines)
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .filter((line) => !/^\([^)]{0,60}\)$/.test(line));
}

function bodyLoad(block: V1LyricBlock): { lines: number; chars: number } {
  const lines = concreteBodyLines(block);
  return { lines: lines.length, chars: lines.join('').replace(/\s+/g, '').length };
}

function averageLoad(items: AlignedBlock[]): { lines: number; chars: number } {
  const loads = items.map((item) => bodyLoad(item.block)).filter((load) => load.lines || load.chars);
  if (!loads.length) return { lines: 0, chars: 0 };
  return {
    lines: loads.reduce((sum, load) => sum + load.lines, 0) / loads.length,
    chars: loads.reduce((sum, load) => sum + load.chars, 0) / loads.length,
  };
}

function isSubstantiallyShorter(current: { lines: number; chars: number }, reference: { lines: number; chars: number }): boolean {
  if (reference.lines < 2 || reference.chars < 16) return false;
  return current.lines * 1.6 < reference.lines || current.chars * 1.6 < reference.chars;
}

function tokens(block: V1LyricBlock): Set<string> {
  const values = concreteBodyLines(block)
    .join(' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return new Set(values);
}

function bodySimilarity(a: V1LyricBlock, b: V1LyricBlock): number {
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (!aTokens.size || !bTokens.size) return 0;
  let intersection = 0;
  aTokens.forEach((token) => { if (bTokens.has(token)) intersection += 1; });
  const union = new Set([...aTokens, ...bTokens]).size;
  return union ? intersection / union : 0;
}

function sharesExactLine(a: V1LyricBlock, b: V1LyricBlock): boolean {
  const first = new Set(concreteBodyLines(a).map((line) => line.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()).filter(Boolean));
  return concreteBodyLines(b).some((line) => first.has(line.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()));
}

function cueText(item: AlignedBlock): string {
  return String(item.block.originalSection?.cue || '').trim();
}

function expectedVocalIds(blueprint: V1SectionBlueprint): string[] {
  return blueprint.vocalAnchors
    .map((anchor) => anchor.match(/^(?:Male|Female)\s+([A-Z])\b/i)?.[1]?.toUpperCase() || '')
    .filter(Boolean);
}

function vocalIdsInText(value: string): string[] {
  const ids: string[] = [];
  const pattern = /(?:\b(?:Male|Female)\s+([A-Z])\b|\bVocal\s+([A-Z])\b)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(String(value || ''))) !== null) {
    const id = String(match[1] || match[2] || '').toUpperCase();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function hasVocalDirectiveLeak(block: V1LyricBlock): boolean {
  return block.bodyLines.some((line) => /\(\s*(?:(?:Male|Female)\s+[A-Z]|Vocal\s+[A-Z])(?:\s+(?:Main|Lead|Sub|Rap|Rapper)(?:\/(?:Main|Lead|Sub|Rap|Rapper))*)?(?:\s*,[^)]*)?\s*\)/i.test(String(line || '')));
}

function vocalAnchorsForRole(blueprint: V1SectionBlueprint, role: 'Main' | 'Lead' | 'Sub' | 'Rap'): string[] {
  const pattern = new RegExp(`\\b${role}\\b`, 'i');
  return blueprint.vocalAnchors.filter((anchor) => pattern.test(anchor));
}

function cueOwnsAnyAnchor(item: AlignedBlock, anchors: string[]): boolean {
  const cue = cueText(item).toLowerCase().replace(/\s+/g, ' ');
  return anchors.some((anchor) => cue.includes(anchor.toLowerCase().replace(/\s+/g, ' ')));
}

export function inspectV1LyricsForRoleIssues(lyrics: string, params: V1SectionEngineParams): V1SectionRoleIssue[] {
  const source = String(lyrics || '').replace(/\r\n?/g, '\n').trim();
  if (!source || params.isNoLyrics || params.includeLyrics === false || params.instrumentalBgmMode) return [];

  const blueprint = getV1SectionBlueprint(params);
  const blocks = parseV1LyricBlocks(source, blueprint);
  if (!blocks.length) return [];
  const aligned = alignBlocksToBlueprint(blocks, blueprint);
  const issues: V1SectionRoleIssue[] = [];

  const developmentItems = aligned.filter((item) => /^(?:Verse|Rap Section)$/i.test(baseV1SectionName(item.entry.name)));
  const developmentLoad = averageLoad(developmentItems);
  const intro = aligned.find((item) => /^Intro$/i.test(item.entry.name));
  const firstDevelopment = developmentItems[0];
  if (intro && firstDevelopment) {
    const introLoad = bodyLoad(intro.block);
    const reference = bodyLoad(firstDevelopment.block);
    const comparableMass = reference.chars > 0 && (
      introLoad.chars >= reference.chars * 0.72
      || (introLoad.lines >= 3 && introLoad.lines >= reference.lines && introLoad.chars >= reference.chars * 0.58)
    );
    if (introLoad.chars > 0 && comparableMass) {
      issues.push({ code: 'intro-overdeveloped', message: 'Intro carries Verse-like story mass instead of a compact opening image, ad-lib, or prologue.' });
    }
    if (/\bhum(?:ming)?\b/i.test(cueText(intro)) && introLoad.lines > 1) {
      issues.push({ code: 'humming-intro-lexical-overflow', message: 'The Intro is marked as humming but owns several ordinary lexical lyric lines; keep the hum as an ad-lib or change the delivery and move story development to Verse.' });
    }
  }

  const refrains = aligned.filter((item) => /^Refrain$/i.test(baseV1SectionName(item.entry.name)));
  if (refrains.length === 1) {
    issues.push({ code: 'refrain-missing-return', message: 'Refrain appears only once, so it cannot perform its essential recurring-phrase role.' });
  }
  if (refrains.length) {
    refrains.forEach((item) => {
      const load = bodyLoad(item.block);
      if (developmentLoad.chars > 0 && (load.chars >= developmentLoad.chars * 0.72 || load.lines >= developmentLoad.lines)) {
        issues.push({ code: 'refrain-overdeveloped', message: `${item.entry.name} carries Verse-like new story mass; Refrain should be a brief recurring phrase identity.` });
      }
    });
    for (let index = 1; index < refrains.length; index += 1) {
      if (!sharesExactLine(refrains[0].block, refrains[index].block) && bodySimilarity(refrains[0].block, refrains[index].block) < 0.18) {
        issues.push({ code: 'refrain-identity-lost', message: `${refrains[index].entry.name} does not recognisably return the phrase identity established by ${refrains[0].entry.name}.` });
      }
    }
  }

  const compactBases = /^(?:Hook|Build-Up|Drop|Breakdown)$/i;
  aligned.forEach((item) => {
    const base = baseV1SectionName(item.entry.name);
    if (!compactBases.test(base) || developmentLoad.chars <= 0) return;
    const load = bodyLoad(item.block);
    const policy = getV1SectionRolePolicy(item.entry.name);
    const limit = v1SectionMassRank(policy.massClass) <= 1 ? 0.68 : 0.95;
    if (load.chars > developmentLoad.chars * limit && load.lines >= developmentLoad.lines) {
      issues.push({ code: 'compact-role-overdeveloped', message: `${item.entry.name} is carrying full development-section mass instead of its ${policy.family} role.` });
    }
  });

  const finalHookIndex = aligned.findIndex((item) => /^(?:Final Chorus|Final Hook)$/i.test(item.entry.name));
  if (finalHookIndex >= 0) {
    const finalItem = aligned[finalHookIndex];
    const finalBase = baseV1SectionName(finalItem.entry.name);
    const earlierHook = [...aligned.slice(0, finalHookIndex)].reverse().find((item) => {
      const base = baseV1SectionName(item.entry.name);
      return base.toLowerCase() === finalBase.toLowerCase() && !/^Final\s+/i.test(item.entry.name);
    });
    if (earlierHook && isSubstantiallyShorter(bodyLoad(finalItem.block), bodyLoad(earlierHook.block))) {
      issues.push({ code: 'final-payoff-underdeveloped', message: `${finalItem.entry.name} is substantially smaller than ${earlierHook.entry.name} and reads like an Outro instead of the final payoff.` });
    }
  }

  const outro = aligned.find((item) => /^Outro$/i.test(item.entry.name));
  if (outro) {
    const previousSubstantial = [...aligned].reverse().find((item) => item !== outro && item.entry.allowsLyrics && bodyLoad(item.block).chars > 0);
    if (previousSubstantial) {
      const outroLoad = bodyLoad(outro.block);
      const previousLoad = bodyLoad(previousSubstantial.block);
      if (previousLoad.chars > 0 && outroLoad.chars >= previousLoad.chars * 0.78 && outroLoad.lines >= previousLoad.lines) {
        issues.push({ code: 'outro-restarts-story', message: 'Outro carries another full section of story instead of closing with a brief afterimage.' });
      }
    }
  }

  aligned.forEach((item) => {
    const base = baseV1SectionName(item.entry.name);
    if (!/^(?:Bridge|Verse|Rap Section|Outro|Final Chorus|Final Hook)$/i.test(base)) return;
    const earlier = aligned.filter((candidate) => candidate !== item && aligned.indexOf(candidate) < aligned.indexOf(item));
    const duplicate = earlier.find((candidate) => bodySimilarity(candidate.block, item.block) >= 0.82 && bodyLoad(item.block).chars > 20);
    if (duplicate && !/^(?:Final Chorus|Final Hook)$/i.test(item.entry.name)) {
      issues.push({ code: 'role-body-duplicate', message: `${item.entry.name} repeats ${duplicate.entry.name} without performing its own structural role.` });
    }
  });

  if (blueprint.mode !== 'custom' && blueprint.vocalAnchors.length > 1) {
    const mainAnchors = vocalAnchorsForRole(blueprint, 'Main');
    const leadAnchors = vocalAnchorsForRole(blueprint, 'Lead');
    const rapAnchors = vocalAnchorsForRole(blueprint, 'Rap');

    const corePayoffs = aligned.filter((item) =>
      !/^Final\s+/i.test(item.entry.name)
      && /^(?:Chorus|Hook|Bridge|Climax)$/i.test(baseV1SectionName(item.entry.name))
      && item.entry.allowsLyrics
      && bodyLoad(item.block).chars > 0,
    );
    if (mainAnchors.length && corePayoffs.length && !corePayoffs.some((item) => cueOwnsAnyAnchor(item, mainAnchors))) {
      issues.push({ code: 'main-core-ownership-missing', message: `Main role (${mainAnchors.join(' / ')}) never leads a core Chorus, Hook, Bridge, or Climax payoff.` });
    }

    const flowSections = aligned.filter((item) =>
      /^(?:Verse|Pre-Chorus|Build-Up)$/i.test(baseV1SectionName(item.entry.name))
      && item.entry.allowsLyrics
      && bodyLoad(item.block).chars > 0,
    );
    if (leadAnchors.length && flowSections.length && !flowSections.some((item) => cueOwnsAnyAnchor(item, leadAnchors))) {
      issues.push({ code: 'lead-flow-ownership-missing', message: `Lead role (${leadAnchors.join(' / ')}) never carries a Verse, Pre-Chorus, or Build-Up flow section.` });
    }

    const rapSections = aligned.filter((item) => /^Rap Section$/i.test(baseV1SectionName(item.entry.name)) && bodyLoad(item.block).chars > 0);
    if (rapAnchors.length && rapSections.some((item) => !cueOwnsAnyAnchor(item, rapAnchors))) {
      issues.push({ code: 'rap-section-owner-missing', message: `Rap Section is not owned by a selected Rap-capable anchor (${rapAnchors.join(' / ')}).` });
    }
  }

  const expectedIds = expectedVocalIds(blueprint);
  if (expectedIds.length > 1) {
    const usedIds = new Set<string>();
    const invalidIds = new Set<string>();
    aligned.forEach((item) => {
      vocalIdsInText(cueText(item)).forEach((id) => {
        if (expectedIds.includes(id)) usedIds.add(id);
        else invalidIds.add(id);
      });
      if (hasVocalDirectiveLeak(item.block)) {
        issues.push({ code: 'vocal-direction-leak', message: `${item.entry.name} leaks a singer/performance instruction into the lyric body instead of keeping it in the section tag.` });
      }
    });
    const missing = expectedIds.filter((id) => !usedIds.has(id));
    if (missing.length) issues.push({ code: 'vocal-coverage-missing', message: `Selected voice ${missing.join(', ')} never receives a meaningful labelled section even though [Vocals] declares it.` });
    if (invalidIds.size) issues.push({ code: 'vocal-anchor-undefined', message: `Lyrics use undefined voice ID ${[...invalidIds].join(', ')} that is not declared in [Vocals].` });

    const final = aligned.find((item) => /^(?:Final Chorus|Final Hook|Climax)$/i.test(item.entry.name));
    if (final && blueprint.mode !== 'custom') {
      const cue = cueText(final);
      const finalIds = vocalIdsInText(cue);
      const shared = /\ball\s+(?:male\s+voices|female\s+voices|voices|vocals)\b/i.test(cue) || finalIds.length >= 2;
      if (!shared) issues.push({ code: 'shared-final-voice-missing', message: `${final.entry.name} is assigned to one voice even though the group Arrangement resolves in a shared final payoff.` });
    }
  }

  return issues.filter((issue, index, all) => all.findIndex((other) => other.code === issue.code && other.message === issue.message) === index);
}

export function applyV1SectionBlueprintGuard(lyrics: string, params: V1SectionEngineParams): string {
  const source = String(lyrics || '').replace(/\r\n?/g, '\n').trim();
  if (!source || params.isNoLyrics || params.includeLyrics === false || params.instrumentalBgmMode) return source;

  const blueprint = getV1SectionBlueprint(params);
  const parsedBlocks = parseV1LyricBlocks(source, blueprint);
  if (!parsedBlocks.length) return source;
  const blocks = recoverStableParagraphSections(parsedBlocks, blueprint);

  const aligned = alignBlocksToBlueprint(blocks, blueprint);
  moveLyricsOutOfNonVocalSections(aligned);
  const issues = inspectV1SectionBlueprintFit(aligned);
  if (issues.length && typeof console !== 'undefined') console.warn('[SORIDRAW V1 Section Engine]', issues.map((issue) => issue.message));
  return renderV1SectionBlocks(aligned, blueprint);
}
