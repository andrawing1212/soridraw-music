import {
  extractV1TargetLanguageTokens,
  measureV1LineLanguageOccupancy,
  measureV1SungLanguageOccupancy,
  type V1LanguageMeasurementCode,
} from './languageMixMeasurement';
import { getLanguageMixRatioBand, normalizeLanguageMixRatioOption } from '../../../../constants/languageMixRatios';

export type V1LanguageMixCode = V1LanguageMeasurementCode;

export type V1WholeRewriteSemanticRole =
  | 'hook-core'
  | 'story-anchor'
  | 'narrative-turn'
  | 'emotional-payoff'
  | 'connector';

export interface V1LockedLyricLine {
  id: string;
  lineIndex: number;
  section: string;
  text: string;
  normalizedText: string;
  timelineZone: 'early' | 'middle' | 'late';
}

export interface V1LockedLyricDocument {
  original: string;
  rawLines: string[];
  lockedLineCount: number;
  sungLines: V1LockedLyricLine[];
  structuralSections: string[];
}

export type V1KpopMixForm = 'keyword-anchor' | 'short-phrase' | 'extended-phrase';
export type V1AdaptiveMixForm = V1KpopMixForm | 'complete-target-line';
export type V1LanguageSwitchPosition = 'base-first' | 'target-first' | 'internal-switch' | 'full-line';

export interface V1LanguageMixPlannedBlock {
  id: string;
  section: string;
  timelineZone: 'early' | 'middle' | 'late';
  lineIds: string[];
  lineIndexes: number[];
  mixForm?: V1KpopMixForm;
  hookFamily?: string;
  hookLineSlot?: number;
  mirrorPolicy?: 'same-target-anchor';
  candidateRole?: 'primary' | 'backup';
  targetUnitGuide?: { minimum: number; ideal: number; maximum: number };
}

export interface V1LanguageMixBlockPlan {
  requestedRatio: number;
  totalSungLineCount: number;
  targetLineCount: number;
  plannedLineCount: number;
  candidateLineCount?: number;
  backupBlockCount?: number;
  mode: 'within-line-rhyme' | 'adaptive-arrangement' | 'complete-line-blocks';
  targetShareGuide: { minimum: number; ideal: number; maximum: number };
  blocks: V1LanguageMixPlannedBlock[];
}

export interface V1WholeRewriteResponseLine {
  id: string;
  finalText: string;
  baseText?: string;
  semanticRole: V1WholeRewriteSemanticRole | string;
  semanticPriority: number;
  suitable: boolean;
  meaningConnection?: string;
  phoneticConnection?: string;
  mixForm?: V1AdaptiveMixForm;
  switchPosition?: V1LanguageSwitchPosition;
  arrangementPriority?: number;
  motifFamily?: string;
}

export interface V1WholeRewritePlacement {
  id: string;
  section: string;
  lineIndex: number;
  sourceText: string;
  finalText: string;
  semanticRole: string;
  semanticPriority: number;
  timelineZone: 'early' | 'middle' | 'late';
  occurrences: number;
  meaningConnection?: string;
  phoneticConnection?: string;
  targetShare?: number;
  mixForm?: V1AdaptiveMixForm;
  hookFamily?: string;
  hookLineSlot?: number;
  mirroredHook?: boolean;
  switchPosition?: V1LanguageSwitchPosition;
  arrangementPriority?: number;
  motifFamily?: string;
}

export interface V1WholeRewriteResult {
  status: 'applied' | 'preserved';
  lyrics: string;
  requestedRatio: number;
  actualRatio: number;
  lowerBound: number;
  upperBound: number;
  providedLineCount: number;
  validCandidateCount: number;
  appliedPlacementCount: number;
  targetTimelineZoneCount: number;
  selectedPlacements: V1WholeRewritePlacement[];
  rejectedDiagnostics: Array<{ id: string; reason: string }>;
  plannedBlockCount?: number;
  plannedLineCount?: number;
  completedBlockCount?: number;
  candidateLineCount?: number;
  backupBlockCount?: number;
  cleanupRequiredCount?: number;
  cleanupAppliedCount?: number;
  preservedReason?: string;
  ratioBandPassed: boolean;
  warningReasons: string[];
  applicationPolicy: 'show-generated-candidate-with-warnings';
  lockedLineCount: number;
  lockedLinesPreserved: boolean;
}

export interface V1SectionIntegrityAudit {
  status: 'passed' | 'needs-review';
  expectedOrder: string[];
  actualOrder: string[];
  orderMatches: boolean;
  missingSections: string[];
  missingProductionCueSections: string[];
  emptySections: string[];
  malformedSectionTags: string[];
  duplicateAdjacentStructuralTags: string[];
  unclosedBracketLines: string[];
  lockedLinesPreserved?: boolean;
}

const STRUCTURAL_SECTION_RE = /^(?:Intro|Verse(?:\s+[A-Z0-9]+)?|Pre[-\s]?Chorus(?:\s+[A-Z0-9]+)?|Chorus(?:\s+[A-Z0-9]+)?|Final\s+Chorus|Hook(?:\s+[A-Z0-9]+)?|Refrain(?:\s+[A-Z0-9]+)?|Rap\s+Section(?:\s+[A-Z0-9]+)?|Build[-\s]?Up(?:\s+[A-Z0-9]+)?|Drop(?:\s+[A-Z0-9]+)?|Break(?:\s+[A-Z0-9]+)?|Bridge(?:\s+[A-Z0-9]+)?|Outro(?:\s+[A-Z0-9]+)?|Interlude(?:\s+[A-Z0-9]+)?|Instrumental(?:\s+[A-Z0-9]+)?|Instrumental\s+Opening|Stop)(?:\s*[:：].*)?$/i;

const LEXICAL_RE = /[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ가-힣ㄱ-ㅎㅏ-ㅣ\u3040-\u30ff\u31f0-\u31ff\u3400-\u9fff\u0400-\u04ff\u0e00-\u0e7f]/g;

function normalizeLineText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isStandaloneBracketLine(line: string): boolean {
  return /^\[[^\]\n]+\]$/.test(String(line || '').trim());
}


function normalizeV1AuditCueToken(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function isV1AuditFunctionWord(value: string): boolean {
  return /^(?:a|an|the|and|or|but|with|without|to|of|for|from|into|over|under|through|by|as|in|on|at)$/i.test(value);
}

function hasV1GenericLeadingLetterLoss(value: string, referenceTokens: string[]): boolean {
  const tokens = String(value || '').match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) || [];
  const normalizedReferences = Array.from(new Set(referenceTokens.map(normalizeV1AuditCueToken).filter(Boolean)));
  return tokens.some((token) => {
    const normalized = normalizeV1AuditCueToken(token);
    if (normalized.length < 3 || isV1AuditFunctionWord(normalized)) return false;
    return normalizedReferences.some((reference) => reference.length === normalized.length + 1 && reference.endsWith(normalized));
  });
}

interface V1KpopCodeSwitchInspection {
  passed: boolean;
  reasons: string[];
  fitScore: number;
  mixForm: V1KpopMixForm;
}

function getV1MixFormGuide(mixForm: V1KpopMixForm, requestedRatio: number): {
  minimumShare: number;
  idealShare: number;
  maximumShare: number;
  minimumTargetTokens: number;
  maximumTargetTokens: number;
  minimumTargetUnits: number;
  maximumTargetUnits: number;
} {
  if (mixForm === 'keyword-anchor') {
    if (requestedRatio === 5) {
      return {
        minimumShare: 0.02,
        idealShare: 0.12,
        maximumShare: 0.38,
        minimumTargetTokens: 1,
        maximumTargetTokens: 3,
        minimumTargetUnits: 1,
        maximumTargetUnits: 6,
      };
    }
    return {
      minimumShare: 0.02,
      idealShare: requestedRatio <= 10 ? 0.12 : 0.16,
      maximumShare: 0.42,
      minimumTargetTokens: 1,
      maximumTargetTokens: 3,
      minimumTargetUnits: 1,
      maximumTargetUnits: 8,
    };
  }
  if (mixForm === 'extended-phrase') {
    return {
      minimumShare: 0.34,
      idealShare: requestedRatio <= 10 ? 0.48 : 0.56,
      maximumShare: 0.74,
      minimumTargetTokens: 3,
      maximumTargetTokens: 8,
      minimumTargetUnits: 3,
      maximumTargetUnits: 13,
    };
  }
  if (requestedRatio === 5) {
    return {
      minimumShare: 0.18,
      idealShare: 0.4,
      maximumShare: 0.68,
      // 144차: 5% short-phrase는 단어 수가 아니라 실제 가창 단위가 본체다.
      // 2개의 다음절 단어도 targetUnitGuide를 충족하면 유효한 짧은 구절로 인정한다.
      minimumTargetTokens: 2,
      maximumTargetTokens: 8,
      minimumTargetUnits: 6,
      maximumTargetUnits: 16,
    };
  }
  return {
    minimumShare: 0.08,
    idealShare: requestedRatio <= 10 ? 0.3 : 0.38,
    maximumShare: 0.68,
    minimumTargetTokens: 2,
    maximumTargetTokens: 8,
    minimumTargetUnits: 2,
    maximumTargetUnits: 14,
  };
}

function inspectV1KpopCodeSwitchLine(args: {
  finalText: string;
  sourceText: string;
  requestedRatio: number;
  baseLanguage: V1LanguageMixCode;
  targetLanguages: V1LanguageMixCode[];
  targetShareGuide: { minimum: number; ideal: number; maximum: number };
  mixForm?: V1KpopMixForm;
  mirrorReuse?: boolean;
  targetUnitGuide?: { minimum: number; ideal: number; maximum: number };
}): V1KpopCodeSwitchInspection {
  const measured = measureV1LineLanguageOccupancy(args.finalText, args.baseLanguage, args.targetLanguages);
  const sourceMeasured = measureV1LineLanguageOccupancy(args.sourceText, args.baseLanguage, args.targetLanguages);
  const mixForm = args.mixForm || 'short-phrase';
  const baseGuide = getV1MixFormGuide(mixForm, args.requestedRatio);
  const guide = args.targetUnitGuide
    ? {
        ...baseGuide,
        minimumTargetUnits: Math.max(baseGuide.minimumTargetUnits, args.targetUnitGuide.minimum),
        maximumTargetUnits: Math.max(
          Math.max(baseGuide.minimumTargetUnits, args.targetUnitGuide.minimum),
          Math.min(baseGuide.maximumTargetUnits, args.targetUnitGuide.maximum),
        ),
      }
    : baseGuide;
  const reasons: string[] = [];
  const minimumShare = mixForm === 'keyword-anchor' && args.requestedRatio === 5
    ? Math.max(0.02, guide.minimumShare)
    : Math.max(0.04, Math.max(args.targetShareGuide.minimum, guide.minimumShare));
  const maximumShare = Math.min(0.84, Math.min(args.targetShareGuide.maximum, guide.maximumShare));
  const maximumBoundaryCount = args.requestedRatio <= 10 ? 2 : 3;
  const maximumTargetChunkCount = mixForm === 'keyword-anchor' ? 1 : args.requestedRatio <= 10 ? 1 : 2;
  const sourceUnits = Math.max(1, sourceMeasured.totalPerformanceUnits);
  const densityRatio = measured.totalPerformanceUnits / sourceUnits;
  const minimumDensity = args.requestedRatio <= 20
    ? 0.5
    : args.mirrorReuse ? 0.58 : mixForm === 'keyword-anchor' ? 0.7 : 0.62;
  const maximumDensity = args.requestedRatio <= 20
    ? (mixForm === 'keyword-anchor' ? 1.85 : 2)
    : args.mirrorReuse ? (mixForm === 'keyword-anchor' ? 1.72 : 1.82) : mixForm === 'keyword-anchor' ? 1.28 : 1.5;

  if (!measured.mixed || measured.targetOnly || !measured.hasBase || !measured.hasTarget) reasons.push('not-within-line-code-switch');
  if (measured.basePerformanceUnits < 2) reasons.push('insufficient-base-sung-material');
  if (measured.languageBoundaryCount < 1 || measured.languageBoundaryCount > maximumBoundaryCount) reasons.push('switch-boundary-overfragmented');
  if (measured.targetChunkCount < 1 || measured.targetChunkCount > maximumTargetChunkCount) reasons.push('target-phrase-overfragmented');
  // 145차: 분량 적용을 먼저 완성한다. 단어 수·가창 단위·한 줄 점유율·호흡 밀도는
  // 후보 순위와 공개 진단에는 남기되, 전체 분량 범위에 도달할 후보를 폐기하는 하드 실패로 쓰지 않는다.

  const shareDistance = Math.abs(measured.targetShare - guide.idealShare);
  const densityDistance = Math.abs(1 - densityRatio);
  const tokenCenter = (guide.minimumTargetTokens + guide.maximumTargetTokens) / 2;
  const tokenDistance = Math.abs(measured.targetTokenCount - tokenCenter) / Math.max(1, tokenCenter);
  const extraBoundaryPenalty = Math.max(0, measured.languageBoundaryCount - 1);
  const extraChunkPenalty = Math.max(0, measured.targetChunkCount - 1);
  const fitScore = Math.max(0, Math.min(100, Math.round(100
    - shareDistance * 74
    - densityDistance * 42
    - tokenDistance * 10
    - extraBoundaryPenalty * 8
    - extraChunkPenalty * 10)));

  return { passed: reasons.length === 0, reasons, fitScore, mixForm };
}

function normalizeV1AdaptiveMixForm(
  value: unknown,
  measured: ReturnType<typeof measureV1LineLanguageOccupancy>,
): V1AdaptiveMixForm {
  const normalized = String(value || '').trim().toLowerCase();
  if (measured.targetOnly || normalized === 'complete-target-line') return 'complete-target-line';
  if (normalized === 'keyword-anchor' || normalized === 'short-phrase' || normalized === 'extended-phrase') return normalized;
  if (measured.targetTokenCount <= 2 || measured.targetShare <= 0.2) return 'keyword-anchor';
  if (measured.targetShare >= 0.55 || measured.targetPerformanceUnits >= 10) return 'extended-phrase';
  return 'short-phrase';
}

function normalizeV1SwitchPosition(
  value: unknown,
  measured: ReturnType<typeof measureV1LineLanguageOccupancy>,
): V1LanguageSwitchPosition {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'base-first' || normalized === 'target-first' || normalized === 'internal-switch' || normalized === 'full-line') return normalized;
  if (measured.targetOnly) return 'full-line';
  return 'internal-switch';
}

function buildV1MirroredHookTargetSequence(args: {
  sourceLines: V1LockedLyricLine[];
  responseById: Map<string, V1WholeRewriteResponseLine>;
  baseLanguage: V1LanguageMixCode;
  targetLanguages: V1LanguageMixCode[];
  mixForm: V1KpopMixForm;
  requestedRatio: number;
}): string {
  const candidates = args.sourceLines
    .map((sourceLine) => {
      const response = args.responseById.get(sourceLine.id);
      const finalText = String(response?.finalText || '').replace(/\r\n?/g, '\n').trim();
      const tokens = response?.suitable
        ? extractV1TargetLanguageTokens(finalText, args.baseLanguage, args.targetLanguages)
        : [];
      return {
        tokens,
        priority: Math.max(0, Math.min(100, Number(response?.semanticPriority) || 0)),
      };
    })
    .filter((candidate) => candidate.tokens.length > 0);
  if (!candidates.length) return '';

  if (args.mixForm === 'keyword-anchor') {
    if (args.requestedRatio === 5) {
      const compactSequences = candidates
        .map((candidate) => {
          const tokens = candidate.tokens.slice(0, 3);
          const sequence = tokens.join(' ').trim();
          const targetUnits = sequence
            ? measureV1LineLanguageOccupancy(sequence, args.baseLanguage, args.targetLanguages).targetPerformanceUnits
            : 0;
          return {
            sequence,
            tokenCount: tokens.length,
            targetUnits,
            priority: candidate.priority,
            functionOnly: tokens.length === 1 && isV1AuditFunctionWord(tokens[0] || ''),
          };
        })
        .filter((candidate) => candidate.sequence && candidate.tokenCount >= 1 && candidate.tokenCount <= 3)
        .sort((a, b) => Number(a.functionOnly) - Number(b.functionOnly)
          || Math.abs(a.targetUnits - 3.5) - Math.abs(b.targetUnits - 3.5)
          || b.priority - a.priority
          || b.tokenCount - a.tokenCount);
      return compactSequences[0]?.sequence || '';
    }
    const counts = new Map<string, { count: number; firstOrder: number }>();
    let order = 0;
    candidates.forEach((candidate) => candidate.tokens.forEach((token) => {
      const normalized = String(token || '').trim().toLowerCase();
      if (!normalized) return;
      const current = counts.get(normalized) || { count: 0, firstOrder: order };
      current.count += 1;
      counts.set(normalized, current);
      order += 1;
    }));
    const ranked = Array.from(counts.entries())
      .map(([token, meta]) => ({
        token,
        count: meta.count,
        firstOrder: meta.firstOrder,
        functionPenalty: isV1AuditFunctionWord(token) ? 1 : 0,
        length: Array.from(token).length,
      }))
      .sort((a, b) => a.functionPenalty - b.functionPenalty
        || b.count - a.count
        || b.length - a.length
        || a.firstOrder - b.firstOrder);
    return ranked[0]?.token || '';
  }

  const idealTokenCount = args.requestedRatio <= 10 ? 3 : 4;
  const phraseCandidates = candidates
    .filter((candidate) => candidate.tokens.length >= 2)
    .map((candidate) => ({
      ...candidate,
      distance: Math.abs(Math.min(candidate.tokens.length, 8) - idealTokenCount),
    }))
    .sort((a, b) => a.distance - b.distance || b.priority - a.priority || a.tokens.length - b.tokens.length);
  const selected = phraseCandidates[0] || candidates.sort((a, b) => a.tokens.length - b.tokens.length || b.priority - a.priority)[0];
  if (!selected) return '';
  return selected.tokens.slice(0, Math.min(6, Math.max(2, selected.tokens.length))).join(' ').trim();
}

function appendV1MirroredHookTargetSequence(sourceText: string, targetSequence: string): string {
  const source = String(sourceText || '').trim();
  const anchor = String(targetSequence || '').trim();
  if (!source || !anchor) return source;
  const punctuationMatch = source.match(/([.!?…]+)$/u);
  const punctuation = punctuationMatch?.[1] || '';
  const body = punctuation ? source.slice(0, -punctuation.length).trimEnd() : source;
  return `${body}, ${anchor}${punctuation}`;
}

function getStructuralSectionName(line: string, knownSectionNames: string[] = []): string | null {
  const trimmed = String(line || '').trim();
  if (!isStandaloneBracketLine(trimmed)) return null;
  const inside = trimmed.slice(1, -1).trim();
  const head = inside.split(/[:：]/)[0].trim().replace(/\s+/g, ' ');
  const known = new Set(knownSectionNames.map((item) => String(item || '').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean));
  if (!STRUCTURAL_SECTION_RE.test(inside) && !known.has(head.toLowerCase())) return null;
  return head;
}

function countLexicalCharacters(value: string): number {
  return (String(value || '').match(LEXICAL_RE) || []).length;
}

export function getV1LanguageMixRatioBounds(requestedRatioInput: number): { lowerBound: number; upperBound: number } {
  const requestedRatio = normalizeLanguageMixRatioOption(requestedRatioInput, { allowZero: true });
  if (requestedRatio <= 0) return { lowerBound: 0, upperBound: 0 };
  return getLanguageMixRatioBand(requestedRatio);
}

export function measureV1WholeRewriteRatio(
  lyrics: string,
  baseLanguage: V1LanguageMixCode,
  targetLanguages: V1LanguageMixCode[],
): number {
  return measureV1SungLanguageOccupancy(lyrics, baseLanguage, targetLanguages).actualMixRatio;
}

export function buildV1LockedLyricDocument(lyrics: string, knownSectionNames: string[] = []): V1LockedLyricDocument {
  const original = String(lyrics || '').replace(/\r\n?/g, '\n').trim();
  const rawLines = original ? original.split('\n') : [];
  let currentSection = 'Unscoped';
  const preliminary: Array<Omit<V1LockedLyricLine, 'timelineZone'>> = [];
  const structuralSections: string[] = [];
  let lockedLineCount = 0;

  rawLines.forEach((rawLine, lineIndex) => {
    const trimmed = rawLine.trim();
    const section = getStructuralSectionName(trimmed, knownSectionNames);
    if (section) {
      currentSection = section;
      structuralSections.push(section);
      lockedLineCount += 1;
      return;
    }
    if (!trimmed || isStandaloneBracketLine(trimmed)) {
      if (isStandaloneBracketLine(trimmed)) lockedLineCount += 1;
      return;
    }
    if (!countLexicalCharacters(trimmed)) return;
    preliminary.push({
      id: `L${preliminary.length + 1}`,
      lineIndex,
      section: currentSection,
      text: trimmed,
      normalizedText: normalizeLineText(trimmed),
    });
  });

  // Use structural-section thirds for the timeline. The public audit groups the song by
  // sections, so the selector must use the same clock instead of splitting one section across
  // two zones merely because its lyric-line index crosses a numeric boundary.
  const sectionIndexByName = new Map<string, number>();
  structuralSections.forEach((section, index) => {
    const key = section.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!sectionIndexByName.has(key)) sectionIndexByName.set(key, index);
  });
  const sectionCount = Math.max(1, structuralSections.length);
  const zoneLength = Math.max(1, Math.ceil(sectionCount / 3));
  const middleEnd = Math.max(zoneLength + 1, sectionCount - zoneLength);
  const lastLineIndex = Math.max(1, preliminary.length - 1);
  const sungLines = preliminary.map((line, index) => {
    const sectionIndex = sectionIndexByName.get(line.section.toLowerCase().replace(/\s+/g, ' ').trim());
    const fallbackRatio = index / lastLineIndex;
    const timelineZone = Number.isInteger(sectionIndex)
      ? (Number(sectionIndex) < zoneLength
          ? 'early' as const
          : Number(sectionIndex) < middleEnd
            ? 'middle' as const
            : 'late' as const)
      : fallbackRatio < 0.34
        ? 'early' as const
        : fallbackRatio < 0.67
          ? 'middle' as const
          : 'late' as const;
    return { ...line, timelineZone };
  });

  return {
    original,
    rawLines,
    lockedLineCount,
    sungLines,
    structuralSections,
  };
}

function isV1HookSection(section: string): boolean {
  const value = String(section || '');
  return !/pre[-\s]?chorus/i.test(value) && /chorus|hook|refrain|drop|climax/i.test(value);
}

function isV1PeripheralSection(section: string): boolean {
  return /intro|outro|instrumental|interlude|stop/i.test(String(section || ''));
}

function getV1HookFamily(section: string): string | null {
  const value = String(section || '');
  if (/pre[-\s]?chorus/i.test(value)) return null;
  if (/chorus/i.test(value)) return 'chorus';
  if (/hook/i.test(value)) return 'hook';
  if (/refrain/i.test(value)) return 'refrain';
  if (/drop/i.test(value)) return 'drop';
  return null;
}

/**
 * Chooses coherent lyric blocks before Gemini is called. The plan is based only on section
 * structure and timeline position; it never contains lyric words or content-specific examples.
 */
export function buildV1LanguageMixBlockPlan(
  document: V1LockedLyricDocument,
  requestedRatioInput: number,
  baseLanguage: V1LanguageMixCode = 'ko',
  targetLanguages: V1LanguageMixCode[] = ['en'],
): V1LanguageMixBlockPlan {
  const requestedRatio = normalizeLanguageMixRatioOption(requestedRatioInput, { allowZero: true });
  const totalSungLineCount = document.sungLines.length;
  const ratioBand = getV1LanguageMixRatioBounds(requestedRatio);
  const fivePercentWithinLineMode = requestedRatio === 5;
  const adaptiveArrangementMode = requestedRatio >= 10 && requestedRatio <= 50;
  const targetShareGuide = fivePercentWithinLineMode
    ? { minimum: 0.08, ideal: 0.34, maximum: 0.68 }
    : adaptiveArrangementMode
      ? { minimum: 0.02, ideal: requestedRatio <= 20 ? 0.5 : 0.7, maximum: 1 }
      : { minimum: 0.72, ideal: 1, maximum: 1 };
  const sourceOccupancyForPlan = requestedRatio > 0 && requestedRatio <= 50
    ? measureV1SungLanguageOccupancy(document.original, baseLanguage, targetLanguages)
    : null;
  const sourcePerformanceUnits = Math.max(1, sourceOccupancyForPlan?.totalPerformanceUnits || totalSungLineCount || 1);
  const averagePerformanceUnitsPerLine = sourcePerformanceUnits / Math.max(1, totalSungLineCount);
  const targetMidpointRatio = (ratioBand.lowerBound + ratioBand.upperBound) / 2;
  const estimatedMixedLineTargetUnits = Math.max(1, averagePerformanceUnitsPerLine * Math.max(0.25, targetShareGuide.ideal));
  const estimatedRatioLineCount = Math.ceil((sourcePerformanceUnits * targetMidpointRatio / 100) / estimatedMixedLineTargetUnits);
  const targetLineCount = totalSungLineCount > 0 && requestedRatio > 0
    ? fivePercentWithinLineMode
      ? Math.min(totalSungLineCount, 4)
      : adaptiveArrangementMode
        ? requestedRatio <= 10
          ? Math.min(totalSungLineCount, Math.max(8, Math.min(14, estimatedRatioLineCount)))
          : requestedRatio <= 20
            ? Math.min(totalSungLineCount, Math.max(15, Math.min(22, estimatedRatioLineCount)))
            : Math.min(totalSungLineCount, Math.max(16, Math.ceil(totalSungLineCount * Math.min(0.82, ratioBand.upperBound / 75))))
        : Math.max(1, Math.ceil((totalSungLineCount * ratioBand.upperBound) / 100))
    : 0;
  const emptyPlan: V1LanguageMixBlockPlan = {
    requestedRatio,
    totalSungLineCount,
    targetLineCount,
    plannedLineCount: 0,
    candidateLineCount: 0,
    backupBlockCount: 0,
    mode: fivePercentWithinLineMode ? 'within-line-rhyme' : adaptiveArrangementMode ? 'adaptive-arrangement' : 'complete-line-blocks',
    targetShareGuide,
    blocks: [],
  };
  if (!targetLineCount) return emptyPlan;

  const bySection = new Map<string, V1LockedLyricLine[]>();
  document.sungLines.forEach((line) => {
    const lines = bySection.get(line.section) || [];
    lines.push(line);
    bySection.set(line.section, lines);
  });
  const sectionGroups = Array.from(bySection.entries())
    .map(([section, lines]) => ({ section, lines, timelineZone: lines[0]?.timelineZone || 'middle' as const }))
    .filter((group) => group.lines.length > 0 && !isV1PeripheralSection(group.section));

  if (fivePercentWithinLineMode) {
    const reserveCount = requestedRatio === 5 ? 1 : requestedRatio <= 10 ? 4 : 6;
    const finalPlannedLineBudget = Math.min(totalSungLineCount, targetLineCount + reserveCount);
    // 143차: 5%는 최종 5줄을 유지하되, 같은 호출 안에서 비후렴 대체 후보 2줄을 더 받는다.
    // 후보가 하나 탈락해도 새 Gemini 호출 없이 유효한 두 줄을 선택하기 위한 안전 여유다.
    const candidateLineBudget = requestedRatio === 5
      ? Math.min(totalSungLineCount, finalPlannedLineBudget + 2)
      : finalPlannedLineBudget;
    const blocks: V1LanguageMixPlannedBlock[] = [];
    const selectedIds = new Set<string>();
    const selectedLines: V1LockedLyricLine[] = [];
    const sectionUseCount = new Map<string, number>();
    const maxNonHookPlannedSections = Math.max(
      1,
      Math.min(requestedRatio === 5 ? 4 : requestedRatio <= 10 ? 3 : 4, sectionGroups.length || 1),
    );

    const hookFamilyGroups = new Map<string, Array<{ section: string; lines: V1LockedLyricLine[]; timelineZone: 'early' | 'middle' | 'late' }>>();
    sectionGroups.forEach((group) => {
      const family = getV1HookFamily(group.section);
      if (!family) return;
      const entries = hookFamilyGroups.get(family) || [];
      entries.push(group);
      hookFamilyGroups.set(family, entries);
    });
    const primaryHookFamily = Array.from(hookFamilyGroups.entries())
      .filter(([, groups]) => groups.length >= 2)
      .sort(([familyA, groupsA], [familyB, groupsB]) => {
        const familyScore = (family: string) => family === 'chorus' ? 100 : family === 'hook' ? 80 : family === 'refrain' ? 60 : 40;
        return (familyScore(familyB) + groupsB.length * 10) - (familyScore(familyA) + groupsA.length * 10);
      })[0] || null;

    if (primaryHookFamily) {
      const [hookFamily, hookSections] = primaryHookFamily;
      const minimumHookLineCount = Math.min(...hookSections.map((group) => group.lines.length));
      const desiredMirrorSlots = Math.min(requestedRatio <= 10 ? 1 : 2, minimumHookLineCount);
      const slotRanks = Array.from({ length: minimumHookLineCount }, (_, slot) => {
        const normalized = hookSections.map((group) => group.lines[slot]?.normalizedText || '').filter(Boolean);
        const repeatScore = normalized.reduce((best, value) => {
          const count = normalized.filter((candidate) => candidate === value).length;
          return Math.max(best, count);
        }, 0) * 100;
        const edgeScore = slot === 0 ? 22 : slot === minimumHookLineCount - 1 ? 20 : 8;
        const center = Math.max(0, (minimumHookLineCount - 1) / 2);
        const centerScore = Math.max(0, 12 - Math.abs(slot - center) * 3);
        const sourceTargetFree = hookSections.every((group) => {
          const line = group.lines[slot];
          return Boolean(line) && !measureV1LineLanguageOccupancy(line.text, baseLanguage, targetLanguages).hasTarget;
        });
        return {
          slot,
          score: repeatScore + edgeScore + centerScore,
          allHookTextsIdentical: normalized.length === hookSections.length && new Set(normalized).size === 1,
          sourceTargetFree,
        };
      }).filter((item) => requestedRatio !== 5 || item.sourceTargetFree)
        .sort((a, b) => b.score - a.score || a.slot - b.slot);
      const selectedSlotRanks = slotRanks.length ? [slotRanks[0]] : [];
      if (desiredMirrorSlots > 1) {
        const secondSharedSlot = slotRanks.find((item) => item.slot !== selectedSlotRanks[0]?.slot && item.allHookTextsIdentical);
        if (secondSharedSlot) selectedSlotRanks.push(secondSharedSlot);
      }

      selectedSlotRanks.forEach(({ slot }, mirrorIndex) => {
        const lines = hookSections.map((group) => group.lines[slot]).filter((line): line is V1LockedLyricLine => Boolean(line));
        if (lines.length !== hookSections.length || lines.some((line) => selectedIds.has(line.id))) return;
        const mixForm: V1KpopMixForm = mirrorIndex === 0 ? 'keyword-anchor' : 'short-phrase';
        lines.forEach((line) => {
          selectedIds.add(line.id);
          selectedLines.push(line);
          sectionUseCount.set(line.section, (sectionUseCount.get(line.section) || 0) + 1);
        });
        blocks.push({
          id: `H${blocks.length + 1}`,
          section: lines[0]?.section || hookFamily,
          timelineZone: lines[0]?.timelineZone || 'middle',
          lineIds: lines.map((line) => line.id),
          lineIndexes: lines.map((line) => line.lineIndex),
          mixForm,
          hookFamily,
          hookLineSlot: slot,
          mirrorPolicy: 'same-target-anchor',
        });
      });
    }

    const mirroredHookOccurrenceCount = blocks
      .filter((block) => block.mirrorPolicy === 'same-target-anchor')
      .reduce((sum, block) => sum + block.lineIds.length, 0);
    const sourceOccupancy = requestedRatio === 5
      ? sourceOccupancyForPlan
      : null;
    const estimatedTotalPerformanceUnits = Math.max(1, sourceOccupancy?.totalPerformanceUnits || 1);
    const fivePercentShortPhraseUnitGuide = requestedRatio === 5
      ? (() => {
          const lowerTargetUnits = Math.ceil(estimatedTotalPerformanceUnits * 0.04);
          const idealTargetUnits = Math.ceil(estimatedTotalPerformanceUnits * 0.05);
          const upperTargetUnits = Math.max(idealTargetUnits, Math.floor(estimatedTotalPerformanceUnits * 0.07));
          const hookMinimumUnits = Math.max(1, mirroredHookOccurrenceCount);
          const hookIdealUnits = Math.max(hookMinimumUnits, mirroredHookOccurrenceCount * 2);
          const minimum = Math.max(6, Math.min(16, Math.ceil((lowerTargetUnits - hookMinimumUnits) / 2)));
          const ideal = Math.max(minimum, Math.min(16, Math.ceil((idealTargetUnits - hookIdealUnits) / 2)));
          const maximum = Math.max(ideal, Math.min(16, Math.ceil((upperTargetUnits - hookMinimumUnits) / 2)));
          return { minimum, ideal, maximum };
        })()
      : undefined;
    const lowRatioShortPhraseUnitGuide = requestedRatio === 5
      ? fivePercentShortPhraseUnitGuide
      : requestedRatio <= 10
        ? { minimum: 4, ideal: 6, maximum: 10 }
        : { minimum: 5, ideal: 8, maximum: 12 };

    const sectionRoleScore = (section: string): number => {
      if (/pre[-\s]?chorus|build/i.test(section)) return 38;
      if (/verse/i.test(section)) return 34;
      if (/bridge/i.test(section)) return 32;
      if (isV1HookSection(section)) return 28;
      return 20;
    };
    const zoneOrder: Array<'early' | 'middle' | 'late'> = requestedRatio === 5
      ? ['middle', 'late']
      : requestedRatio <= 10
        ? ['early', 'late', 'middle']
        : ['early', 'middle', 'late'];
    const formPattern: V1KpopMixForm[] = requestedRatio === 5
      ? ['short-phrase', 'short-phrase']
      : requestedRatio <= 10
        ? ['short-phrase', 'keyword-anchor', 'short-phrase']
        : ['short-phrase', 'keyword-anchor', 'short-phrase', 'short-phrase', 'short-phrase'];
    let cursor = 0;
    while (selectedLines.length < candidateLineBudget) {
      const desiredZone = zoneOrder[cursor % zoneOrder.length];
      const mixForm = formPattern[cursor % formPattern.length];
      const minimumSourceUnits = requestedRatio === 5 && mixForm === 'short-phrase'
        ? Math.max(8, (fivePercentShortPhraseUnitGuide?.minimum || 6) + 3)
        : mixForm === 'keyword-anchor' ? 6 : 5;
      const usedNonHookSectionCount = Array.from(sectionUseCount.keys()).filter((section) => !getV1HookFamily(section)).length;
      const available = document.sungLines
        .filter((line) => {
          if (selectedIds.has(line.id) || isV1PeripheralSection(line.section)) return false;
          if (requestedRatio === 5 && measureV1LineLanguageOccupancy(line.text, baseLanguage, targetLanguages).hasTarget) return false;
          const family = getV1HookFamily(line.section);
          if (primaryHookFamily && family === primaryHookFamily[0]) return false;
          return usedNonHookSectionCount < maxNonHookPlannedSections || sectionUseCount.has(line.section);
        })
        .map((line) => {
          const group = sectionGroups.find((item) => item.section === line.section);
          const sectionLines = group?.lines || [];
          const localIndex = Math.max(0, sectionLines.findIndex((item) => item.id === line.id));
          const center = Math.max(0, (sectionLines.length - 1) / 2);
          const centerScore = Math.max(0, 16 - Math.abs(localIndex - center) * 3);
          const zoneScore = line.timelineZone === desiredZone ? 70 : 0;
          const usePenalty = (sectionUseCount.get(line.section) || 0) * 10;
          const adjacentPenalty = selectedLines.some((selected) =>
            selected.section === line.section && Math.abs(selected.lineIndex - line.lineIndex) === 1) ? 10 : 0;
          const sourceUnits = Math.max(1, countLexicalCharacters(line.text));
          const sourceUnitPenalty = Math.max(0, minimumSourceUnits - sourceUnits) * 18;
          return { line, score: zoneScore + sectionRoleScore(line.section) + centerScore - usePenalty - adjacentPenalty - sourceUnitPenalty };
        })
        .sort((a, b) => b.score - a.score || a.line.lineIndex - b.line.lineIndex);
      const next = available[0]?.line;
      if (!next) break;
      selectedIds.add(next.id);
      selectedLines.push(next);
      sectionUseCount.set(next.section, (sectionUseCount.get(next.section) || 0) + 1);
      blocks.push({
        id: `M${blocks.length + 1}`,
        section: next.section,
        timelineZone: next.timelineZone,
        lineIds: [next.id],
        lineIndexes: [next.lineIndex],
        mixForm,
        candidateRole: requestedRatio === 5 && cursor >= 2 ? 'backup' : 'primary',
        targetUnitGuide: mixForm === 'short-phrase'
          ? lowRatioShortPhraseUnitGuide
          : undefined,
      });
      cursor += 1;
    }

    const plannedLineCount = blocks
      .filter((block) => block.candidateRole !== 'backup')
      .reduce((sum, block) => sum + block.lineIds.length, 0);
    const candidateLineCount = blocks.reduce((sum, block) => sum + block.lineIds.length, 0);
    const backupBlockCount = blocks.filter((block) => block.candidateRole === 'backup').length;
    return {
      requestedRatio,
      totalSungLineCount,
      targetLineCount,
      plannedLineCount,
      candidateLineCount,
      backupBlockCount,
      mode: 'within-line-rhyme',
      targetShareGuide,
      blocks,
    };
  }

  if (adaptiveArrangementMode) {
    const blocks: V1LanguageMixPlannedBlock[] = [];
    const groupedIds = new Set<string>();
    const hookFamilyGroups = new Map<string, Array<{ section: string; lines: V1LockedLyricLine[]; timelineZone: 'early' | 'middle' | 'late' }>>();
    sectionGroups.forEach((group) => {
      const family = getV1HookFamily(group.section);
      if (!family) return;
      const entries = hookFamilyGroups.get(family) || [];
      entries.push(group);
      hookFamilyGroups.set(family, entries);
    });

    Array.from(hookFamilyGroups.entries())
      .filter(([, groups]) => groups.length >= 2)
      .forEach(([hookFamily, hookSections]) => {
        const sharedSlotCount = Math.min(...hookSections.map((group) => group.lines.length));
        if (sharedSlotCount <= 0) return;

        // 155차: 단일·다중 목표 언어 모두 반복 후렴 전체를 한 덩어리로 묶지 않는다.
        // 대표 훅 슬롯 1개만 연결하고 나머지 줄은 각 언어가 곡의 아크에 맞게
        // 확장·축소·전환될 수 있도록 개별 후보로 남긴다.
        // 반복 후렴의 통일감을 잡는 대표 슬롯 1개만 연결하고, 나머지 후렴 줄은
        // 개별 후보로 남겨 Chorus 2 / Final Chorus가 확장·축소·전환될 자유를 보존한다.
        const rankedSlots = Array.from({ length: sharedSlotCount }, (_, slot) => {
          const normalized = hookSections
            .map((group) => group.lines[slot]?.normalizedText || '')
            .filter(Boolean);
          const strongestRepeatCount = normalized.reduce((best, value) => {
            const count = normalized.filter((candidate) => candidate === value).length;
            return Math.max(best, count);
          }, 0);
          const edgePreference = slot === 0 ? 24 : slot === sharedSlotCount - 1 ? 18 : 8;
          return {
            slot,
            score: strongestRepeatCount * 100 + edgePreference,
          };
        }).sort((a, b) => b.score - a.score || a.slot - b.slot);

        const anchorSlot = rankedSlots[0]?.slot ?? 0;
        const lines = hookSections
          .map((group) => group.lines[anchorSlot])
          .filter((line): line is V1LockedLyricLine => Boolean(line));
        if (lines.length !== hookSections.length) return;

        lines.forEach((line) => groupedIds.add(line.id));
        blocks.push({
          id: `A-H${blocks.length + 1}`,
          section: lines[0]?.section || hookFamily,
          timelineZone: lines[0]?.timelineZone || 'middle',
          lineIds: lines.map((line) => line.id),
          lineIndexes: lines.map((line) => line.lineIndex),
          hookFamily,
          hookLineSlot: anchorSlot,
          mirrorPolicy: 'same-target-anchor',
          candidateRole: 'primary',
        });
      });

    document.sungLines.forEach((line) => {
      if (groupedIds.has(line.id)) return;
      blocks.push({
        id: `A-M${blocks.length + 1}`,
        section: line.section,
        timelineZone: line.timelineZone,
        lineIds: [line.id],
        lineIndexes: [line.lineIndex],
        candidateRole: 'primary',
      });
    });

    const candidateLineCount = blocks.reduce((sum, block) => sum + block.lineIds.length, 0);
    return {
      requestedRatio,
      totalSungLineCount,
      targetLineCount,
      plannedLineCount: targetLineCount,
      candidateLineCount,
      backupBlockCount: 0,
      mode: 'adaptive-arrangement',
      targetShareGuide,
      blocks,
    };
  }

  const desiredBlockCount = requestedRatio <= 30 ? 5 : requestedRatio <= 40 ? 6 : requestedRatio <= 50 ? 9 : 8;
  const actualBlockCount = Math.max(1, Math.min(desiredBlockCount, targetLineCount, sectionGroups.length || 1));
  const preferredZones: Array<'early' | 'middle' | 'late'> = actualBlockCount <= 2
    ? ['early', 'late']
    : actualBlockCount === 3
      ? ['early', 'middle', 'late']
      : ['early', 'middle', 'late', 'middle', 'early'];
  const blockSizes = Array.from({ length: actualBlockCount }, (_, index) =>
    Math.floor(targetLineCount / actualBlockCount) + (index < targetLineCount % actualBlockCount ? 1 : 0));
  const usedSections = new Set<string>();
  const blocks: V1LanguageMixPlannedBlock[] = [];

  const sectionRoleScore = (section: string): number => {
    if (isV1HookSection(section)) return 34;
    if (/verse/i.test(section)) return 30;
    if (/bridge/i.test(section)) return 28;
    if (/pre[-\s]?chorus|build/i.test(section)) return 25;
    return 20;
  };

  blockSizes.forEach((requestedSize, blockIndex) => {
    const preferredZone = preferredZones[blockIndex] || preferredZones[preferredZones.length - 1] || 'middle';
    const ranked = sectionGroups
      .filter((group) => !usedSections.has(group.section))
      .map((group) => ({
        group,
        score: (group.timelineZone === preferredZone ? 80 : 0)
          + sectionRoleScore(group.section)
          + Math.min(group.lines.length, requestedSize) * 4,
      }))
      .sort((a, b) => b.score - a.score || b.group.lines.length - a.group.lines.length);
    const selected = ranked[0]?.group || sectionGroups.find((group) => !usedSections.has(group.section));
    if (!selected) return;
    usedSections.add(selected.section);
    const size = Math.max(1, Math.min(requestedSize, selected.lines.length));
    const maxStart = Math.max(0, selected.lines.length - size);
    const start = Math.floor(maxStart / 2);
    const lines = selected.lines.slice(start, start + size);
    blocks.push({
      id: `B${blocks.length + 1}`,
      section: selected.section,
      timelineZone: selected.timelineZone,
      lineIds: lines.map((line) => line.id),
      lineIndexes: lines.map((line) => line.lineIndex),
    });
  });

  let plannedLineCount = blocks.reduce((sum, block) => sum + block.lineIds.length, 0);
  if (plannedLineCount < targetLineCount) {
    const plannedIds = new Set(blocks.flatMap((block) => block.lineIds));
    for (const block of blocks) {
      const sectionLines = bySection.get(block.section) || [];
      const candidates = sectionLines.filter((line) => !plannedIds.has(line.id));
      while (candidates.length && plannedLineCount < targetLineCount) {
        const next = candidates.shift();
        if (!next) continue;
        block.lineIds.push(next.id);
        block.lineIndexes.push(next.lineIndex);
        plannedIds.add(next.id);
        plannedLineCount += 1;
      }
      block.lineIds.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
      block.lineIndexes.sort((a, b) => a - b);
      if (plannedLineCount >= targetLineCount) break;
    }
  }

  return {
    requestedRatio,
    totalSungLineCount,
    targetLineCount,
    plannedLineCount,
    candidateLineCount: plannedLineCount,
    backupBlockCount: 0,
    mode: 'complete-line-blocks',
    targetShareGuide,
    blocks,
  };
}

function buildLyricsFromReplacementMap(
  document: V1LockedLyricDocument,
  replacements: Map<number, string>,
): string {
  return document.rawLines
    .map((line, index) => replacements.has(index) ? String(replacements.get(index) || '').trim() : line)
    .join('\n');
}

function lockedLinesAreIdentical(source: V1LockedLyricDocument, candidateLyrics: string): boolean {
  const candidate = String(candidateLyrics || '').replace(/\r\n?/g, '\n').split('\n');
  if (candidate.length !== source.rawLines.length) return false;
  return source.rawLines.every((line, index) => {
    const trimmed = line.trim();
    if (trimmed && isStandaloneBracketLine(trimmed)) return candidate[index] === line;
    return true;
  });
}


type V1RewriteTopology = {
  isolatedTargetLineCount: number;
  alternatingSequenceCount: number;
  targetBlockCount: number;
  averageTargetBlockLength: number;
  targetLineCount: number;
  maxTargetLineRunLength: number;
  maxTargetOnlyRunLength: number;
  maxHookTargetOnlyRunLength: number;
  targetSectionCount: number;
  maxTargetSectionRatio: number;
  maxTargetSectionShare: number;
  targetTimelineZoneCount: number;
};

function inspectV1RewriteTopology(
  document: V1LockedLyricDocument,
  replacements: Map<number, string>,
  baseLanguage: V1LanguageMixCode,
  targetLanguages: V1LanguageMixCode[],
): V1RewriteTopology {
  const entries = document.sungLines.map((line) => {
    const text = replacements.has(line.lineIndex)
      ? String(replacements.get(line.lineIndex) || '')
      : line.text;
    const occupancy = measureV1LineLanguageOccupancy(text, baseLanguage, targetLanguages);
    return {
      line,
      occupancy,
      flag: occupancy.targetOnly ? 'target' as const : occupancy.mixed ? 'mixed' as const : 'base' as const,
    };
  });
  const flags = entries.map((entry) => entry.flag);

  let isolatedTargetLineCount = 0;
  let alternatingSequenceCount = 0;
  let targetBlockCount = 0;
  let targetBlockLineTotal = 0;
  let currentBlockLength = 0;
  let maxTargetLineRunLength = 0;
  let currentTargetOnlyRun = 0;
  let maxTargetOnlyRunLength = 0;
  let currentHookTargetRun = 0;
  let maxHookTargetOnlyRunLength = 0;

  entries.forEach((entry, index) => {
    const { flag, occupancy, line } = entry;
    const sectionChanged = index > 0 && entries[index - 1].line.section !== line.section;
    if (sectionChanged) {
      if (currentBlockLength > 0) {
        targetBlockCount += 1;
        targetBlockLineTotal += currentBlockLength;
        currentBlockLength = 0;
      }
      currentTargetOnlyRun = 0;
      currentHookTargetRun = 0;
    }
    if (flag !== 'base') {
      currentBlockLength += 1;
      maxTargetLineRunLength = Math.max(maxTargetLineRunLength, currentBlockLength);
      const previousTarget = flags[index - 1] !== undefined && flags[index - 1] !== 'base' && entries[index - 1]?.line.section === line.section;
      const nextTarget = flags[index + 1] !== undefined && flags[index + 1] !== 'base' && entries[index + 1]?.line.section === line.section;
      if (occupancy.targetOnly && !previousTarget && !nextTarget) isolatedTargetLineCount += 1;
      if (index === flags.length - 1) {
        targetBlockCount += 1;
        targetBlockLineTotal += currentBlockLength;
      }
    } else if (currentBlockLength > 0) {
      targetBlockCount += 1;
      targetBlockLineTotal += currentBlockLength;
      currentBlockLength = 0;
    }

    if (occupancy.targetOnly) {
      currentTargetOnlyRun += 1;
      maxTargetOnlyRunLength = Math.max(maxTargetOnlyRunLength, currentTargetOnlyRun);
      if (/chorus|hook|refrain|drop|climax/i.test(line.section)) {
        currentHookTargetRun += 1;
        maxHookTargetOnlyRunLength = Math.max(maxHookTargetOnlyRunLength, currentHookTargetRun);
      } else {
        currentHookTargetRun = 0;
      }
    } else {
      currentTargetOnlyRun = 0;
      currentHookTargetRun = 0;
    }
  });

  for (let index = 0; index <= flags.length - 4; index += 1) {
    const sectionNames = entries.slice(index, index + 4).map((entry) => entry.line.section);
    if (new Set(sectionNames).size > 1) continue;
    const sequence = flags.slice(index, index + 4).map((flag) => flag === 'target' ? 'T' : flag === 'base' ? 'B' : 'M').join('');
    if (sequence === 'BTBT' || sequence === 'TBTB') alternatingSequenceCount += 1;
  }

  const sectionTotals = new Map<string, { total: number; target: number }>();
  const targetZones = new Set<'early' | 'middle' | 'late'>();
  let totalTargetUnits = 0;
  entries.forEach(({ line, occupancy }) => {
    const detail = sectionTotals.get(line.section) || { total: 0, target: 0 };
    detail.total += 1;
    detail.target += occupancy.targetShare;
    sectionTotals.set(line.section, detail);
    totalTargetUnits += occupancy.targetShare;
    if (occupancy.hasTarget) targetZones.add(line.timelineZone);
  });
  const activeSections = Array.from(sectionTotals.values()).filter((detail) => detail.target > 0);
  const maxTargetSectionRatio = activeSections.length
    ? Math.max(...activeSections.map((detail) => (detail.target / Math.max(1, detail.total)) * 100))
    : 0;
  const maxTargetSectionUnits = activeSections.length
    ? Math.max(...activeSections.map((detail) => detail.target))
    : 0;
  const maxTargetSectionShare = totalTargetUnits > 0
    ? (maxTargetSectionUnits / totalTargetUnits) * 100
    : 0;

  const targetLineCount = flags.filter((flag) => flag !== 'base').length;
  return {
    isolatedTargetLineCount,
    alternatingSequenceCount,
    targetBlockCount,
    averageTargetBlockLength: targetBlockCount > 0 ? targetBlockLineTotal / targetBlockCount : 0,
    targetLineCount,
    maxTargetLineRunLength,
    maxTargetOnlyRunLength,
    maxHookTargetOnlyRunLength,
    targetSectionCount: activeSections.length,
    maxTargetSectionRatio,
    maxTargetSectionShare,
    targetTimelineZoneCount: targetZones.size,
  };
}

function getV1RewriteTopologyLimits(requestedRatio: number): {
  maxIsolated: number;
  minimumAverageBlockLength: number;
  maxTargetLineRunLength: number;
  maxTargetOnlyRunLength: number;
  maxHookTargetOnlyRunLength: number;
  requiredTargetSectionCount: number;
  maxTargetSectionShare: number;
  requiredTimelineZoneCount: number;
} {
  return {
    maxIsolated: requestedRatio <= 20 ? Number.MAX_SAFE_INTEGER : 1,
    minimumAverageBlockLength: requestedRatio <= 20 ? 1 : 1.6,
    maxTargetLineRunLength: requestedRatio <= 10 ? 2 : requestedRatio <= 20 ? 4 : Number.MAX_SAFE_INTEGER,
    maxTargetOnlyRunLength: requestedRatio <= 20 ? 0 : requestedRatio <= 50 ? 6 : 7,
    maxHookTargetOnlyRunLength: requestedRatio <= 20 ? 0 : requestedRatio <= 50 ? 4 : 5,
    requiredTargetSectionCount: requestedRatio <= 10 ? 2 : requestedRatio <= 20 ? 3 : 4,
    maxTargetSectionShare: requestedRatio <= 20 ? 50 : requestedRatio <= 50 ? 45 : 40,
    requiredTimelineZoneCount: requestedRatio <= 10 ? 2 : 3,
  };
}

function scoreV1RewriteTopology(topology: V1RewriteTopology, requestedRatio: number): number {
  const limits = getV1RewriteTopologyLimits(requestedRatio);
  const desiredAverageBlockLength = requestedRatio <= 20 ? 1 : 1.8;
  const shortBlockPenalty = topology.targetBlockCount > 0
    ? Math.max(0, desiredAverageBlockLength - topology.averageTargetBlockLength) * 5
    : 0;
  const isolatedWeight = requestedRatio <= 20 ? 0 : 4.5;
  const sectionCoveragePenalty = Math.max(0, limits.requiredTargetSectionCount - topology.targetSectionCount) * 4;
  const timelinePenalty = Math.max(0, limits.requiredTimelineZoneCount - topology.targetTimelineZoneCount) * 5;
  const mixedRunPenalty = Math.max(0, topology.maxTargetLineRunLength - limits.maxTargetLineRunLength) * 18;
  const runPenalty = Math.max(0, topology.maxTargetOnlyRunLength - limits.maxTargetOnlyRunLength) * 35;
  const hookRunPenalty = Math.max(0, topology.maxHookTargetOnlyRunLength - limits.maxHookTargetOnlyRunLength) * 40;
  const sectionSharePenalty = Math.max(0, topology.maxTargetSectionShare - limits.maxTargetSectionShare) * 0.35;
  const lowRatioSectionTakeoverPenalty = requestedRatio <= 20 && topology.maxTargetSectionRatio >= 72 ? 45 : 0;
  return topology.isolatedTargetLineCount * isolatedWeight
    + topology.alternatingSequenceCount * 9
    + shortBlockPenalty
    + sectionCoveragePenalty
    + timelinePenalty
    + mixedRunPenalty
    + runPenalty
    + hookRunPenalty
    + sectionSharePenalty
    + lowRatioSectionTakeoverPenalty;
}

function v1RewriteTopologyCanStillPass(topology: V1RewriteTopology, requestedRatio: number): boolean {
  const limits = getV1RewriteTopologyLimits(requestedRatio);
  // These violations can only grow when more complete target-language lines are added.
  return topology.maxTargetLineRunLength <= limits.maxTargetLineRunLength
    && topology.maxTargetOnlyRunLength <= limits.maxTargetOnlyRunLength
    && topology.maxHookTargetOnlyRunLength <= limits.maxHookTargetOnlyRunLength
    && !(requestedRatio <= 20 && topology.maxTargetSectionRatio >= 72);
}

function v1RewriteTopologyPassed(topology: V1RewriteTopology, requestedRatio: number): boolean {
  const limits = getV1RewriteTopologyLimits(requestedRatio);
  return topology.alternatingSequenceCount === 0
    && topology.isolatedTargetLineCount <= limits.maxIsolated
    && (topology.targetBlockCount === 0 || topology.averageTargetBlockLength >= limits.minimumAverageBlockLength)
    && topology.maxTargetLineRunLength <= limits.maxTargetLineRunLength
    && topology.maxTargetOnlyRunLength <= limits.maxTargetOnlyRunLength
    && topology.maxHookTargetOnlyRunLength <= limits.maxHookTargetOnlyRunLength
    && topology.targetSectionCount >= limits.requiredTargetSectionCount
    && topology.maxTargetSectionShare <= limits.maxTargetSectionShare
    && topology.targetTimelineZoneCount >= limits.requiredTimelineZoneCount
    && !(requestedRatio <= 20 && topology.maxTargetSectionRatio >= 72);
}

export function applyV1WholeRewriteResponse(args: {
  document: V1LockedLyricDocument;
  responseLines: V1WholeRewriteResponseLine[];
  requestedRatio: number;
  baseLanguage: V1LanguageMixCode;
  targetLanguages: V1LanguageMixCode[];
  blockPlan?: V1LanguageMixBlockPlan;
  excludedLineIds?: string[];
  restorePreexistingTargetLines?: boolean;
}): V1WholeRewriteResult {
  const { document, responseLines, baseLanguage, targetLanguages, blockPlan } = args;
  const excludedLineIdSet = new Set((args.excludedLineIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const requestedRatio = Math.max(0, Math.min(90, Math.round(Number(args.requestedRatio) || 0)));
  const { lowerBound, upperBound } = getV1LanguageMixRatioBounds(requestedRatio);
  const responseById = new Map(
    (Array.isArray(responseLines) ? responseLines : [])
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => [String(item.id).trim(), item] as const),
  );
  const rejectedDiagnostics: Array<{ id: string; reason: string }> = [];

  type Candidate = {
    key: string;
    response: V1WholeRewriteResponseLine;
    sourceLines: V1LockedLyricLine[];
    finalText: string;
    finalTexts: Map<number, string>;
    semanticPriority: number;
    semanticRole: string;
    kpopFitScore: number;
    mixForm: V1AdaptiveMixForm;
    switchPosition: V1LanguageSwitchPosition;
    arrangementPriority: number;
    motifFamily?: string;
    mirrorPolicy?: 'same-target-anchor';
    hookFamily?: string;
    hookLineSlot?: number;
    candidateRole?: 'primary' | 'backup';
    targetUnitGuide?: { minimum: number; ideal: number; maximum: number };
    zones: Set<'early' | 'middle' | 'late'>;
    sections: Set<string>;
  };

  // 150차: 정확히 두 언어를 선택한 경로에서만, 초기 카드에 잘못 섞여 들어온 상대 언어를
  // 후보 선택 전에 baseText로 정리한다. 정리된 baseText를 기본 바탕으로 깔고, 선택된 후보만
  // finalText로 다시 덮으므로 기존 영어 블록이 비율을 선점하는 문제를 막는다.
  const cleanupRequiredLines: V1LockedLyricLine[] = args.restorePreexistingTargetLines
    ? document.sungLines.filter((line) =>
        measureV1LineLanguageOccupancy(line.text, baseLanguage, targetLanguages).hasTarget)
    : [];
  const cleanupReplacements = new Map<number, string>();
  cleanupRequiredLines.forEach((sourceLine) => {
    const response = responseById.get(sourceLine.id);
    const baseText = String(response?.baseText || '').replace(/\r\n?/g, '\n').trim();
    const measured = measureV1LineLanguageOccupancy(baseText, baseLanguage, targetLanguages);
    const valid = Boolean(baseText)
      && baseText !== sourceLine.text
      && !baseText.includes('\n')
      && !/[\[\]]/.test(baseText)
      && measured.hasBase
      && !measured.hasTarget;
    if (valid) {
      cleanupReplacements.set(sourceLine.lineIndex, baseText);
      return;
    }
    rejectedDiagnostics.push({ id: sourceLine.id, reason: 'preexisting-target-cleanup-invalid' });
  });
  const cleanupComplete = cleanupReplacements.size === cleanupRequiredLines.length;

  const candidatesBySource = new Map<string, Candidate>();
  document.sungLines.forEach((sourceLine) => {
    if (excludedLineIdSet.has(sourceLine.id)) {
      rejectedDiagnostics.push({ id: sourceLine.id, reason: 'excluded-after-hard-ban-refit' });
      return;
    }
    const response = responseById.get(sourceLine.id);
    if (!response) {
      rejectedDiagnostics.push({ id: sourceLine.id, reason: 'missing-response-line' });
      return;
    }
    const finalText = String(response.finalText || '').replace(/\r\n?/g, '\n').trim();
    if (!response.suitable || !finalText || finalText === sourceLine.text) return;
    if (finalText.includes('\n') || /[\[\]]/.test(finalText)) {
      rejectedDiagnostics.push({ id: sourceLine.id, reason: 'invalid-line-shape' });
      return;
    }
    if (!measureV1LineLanguageOccupancy(finalText, baseLanguage, targetLanguages).hasTarget) {
      rejectedDiagnostics.push({ id: sourceLine.id, reason: 'target-language-missing' });
      return;
    }
    const key = sourceLine.normalizedText || sourceLine.id;
    const priority = Math.max(0, Math.min(100, Number(response.semanticPriority) || 0));
    const existing = candidatesBySource.get(key);
    if (!existing) {
      candidatesBySource.set(key, {
        key,
        response,
        sourceLines: [sourceLine],
        finalText,
        finalTexts: new Map([[sourceLine.lineIndex, finalText]]),
        semanticPriority: priority,
        semanticRole: String(response.semanticRole || 'connector'),
        kpopFitScore: 0,
        mixForm: normalizeV1AdaptiveMixForm(response.mixForm, measureV1LineLanguageOccupancy(finalText, baseLanguage, targetLanguages)),
        switchPosition: normalizeV1SwitchPosition(response.switchPosition, measureV1LineLanguageOccupancy(finalText, baseLanguage, targetLanguages)),
        arrangementPriority: Math.max(0, Math.min(100, Number(response.arrangementPriority) || priority)),
        motifFamily: String(response.motifFamily || '').trim() || undefined,
        zones: new Set([sourceLine.timelineZone]),
        sections: new Set([sourceLine.section]),
      });
      return;
    }
    existing.sourceLines.push(sourceLine);
    existing.finalTexts.set(sourceLine.lineIndex, finalText);
    existing.zones.add(sourceLine.timelineZone);
    existing.sections.add(sourceLine.section);
    if (priority > existing.semanticPriority) {
      existing.response = response;
      existing.finalText = finalText;
      existing.semanticPriority = priority;
      existing.semanticRole = String(response.semanticRole || existing.semanticRole || 'connector');
      existing.arrangementPriority = Math.max(0, Math.min(100, Number(response.arrangementPriority) || existing.arrangementPriority || priority));
      existing.motifFamily = String(response.motifFamily || existing.motifFamily || '').trim() || undefined;
    }
  });

  const fallbackCandidates = Array.from(candidatesBySource.values());
  const sourceLineById = new Map(document.sungLines.map((line) => [line.id, line] as const));
  const plannedCandidates: Candidate[] = [];
  if (blockPlan?.blocks?.length) {
    blockPlan.blocks.forEach((block) => {
      if (block.lineIds.some((id) => excludedLineIdSet.has(id))) {
        block.lineIds.forEach((id) => rejectedDiagnostics.push({ id, reason: 'excluded-after-hard-ban-refit' }));
        return;
      }
      const sourceLines = block.lineIds.map((id) => sourceLineById.get(id)).filter((line): line is V1LockedLyricLine => Boolean(line));
      const finalTexts = new Map<number, string>();
      let blockValid = sourceLines.length === block.lineIds.length && sourceLines.length > 0;
      let semanticPriority = 0;
      let semanticRole = 'connector';
      let kpopFitScore = 0;
      let arrangementPriority = 0;
      let resolvedMixForm: V1AdaptiveMixForm = block.mixForm || 'short-phrase';
      let resolvedSwitchPosition: V1LanguageSwitchPosition = 'internal-switch';
      let motifFamily: string | undefined;

      if (blockPlan.mode === 'adaptive-arrangement') {
        const proposalStates = sourceLines.map((sourceLine) => {
          const response = responseById.get(sourceLine.id);
          const finalText = String(response?.finalText || '').replace(/\r\n?/g, '\n').trim();
          return { sourceLine, response, finalText, proposed: Boolean(response?.suitable) && Boolean(finalText) && finalText !== sourceLine.text };
        });
        const proposedCount = proposalStates.filter((state) => state.proposed).length;
        if (proposedCount === 0) return;
        if (proposedCount !== proposalStates.length) {
          proposalStates.forEach(({ sourceLine }) => rejectedDiagnostics.push({
            id: sourceLine.id,
            reason: 'adaptive-linked-motif-partial-proposal',
          }));
          return;
        }
      }

      if (block.mirrorPolicy === 'same-target-anchor' && blockPlan.mode === 'within-line-rhyme') {
        const targetSequence = buildV1MirroredHookTargetSequence({
          sourceLines,
          responseById,
          baseLanguage,
          targetLanguages,
          mixForm: block.mixForm || 'short-phrase',
          requestedRatio,
        });
        if (!targetSequence || sourceLines.length !== block.lineIds.length || !sourceLines.length) {
          sourceLines.forEach((sourceLine) => rejectedDiagnostics.push({
            id: sourceLine.id,
            reason: 'hook-anchor-source-candidate-missing',
          }));
          return;
        }

        sourceLines.forEach((sourceLine) => {
          const response = responseById.get(sourceLine.id);
          const finalText = appendV1MirroredHookTargetSequence(sourceLine.text, targetSequence);
          const inspection = inspectV1KpopCodeSwitchLine({
            finalText,
            sourceText: sourceLine.text,
            requestedRatio,
            baseLanguage,
            targetLanguages,
            targetShareGuide: blockPlan.targetShareGuide,
            mixForm: block.mixForm,
            mirrorReuse: true,
          });
          if (!inspection.passed) {
            blockValid = false;
            rejectedDiagnostics.push({
              id: sourceLine.id,
              reason: `hook-anchor-reuse-invalid:${inspection.reasons.join(',')}`,
            });
            return;
          }
          finalTexts.set(sourceLine.lineIndex, finalText);
          kpopFitScore += inspection.fitScore;
          const priority = Math.max(0, Math.min(100, Number(response?.semanticPriority) || 0));
          if (priority >= semanticPriority) {
            semanticPriority = priority;
            semanticRole = String(response?.semanticRole || semanticRole);
          }
        });

        if (!blockValid) return;
        plannedCandidates.push({
          key: block.id,
          response: responseById.get(block.lineIds[0]) || { id: block.lineIds[0], finalText: '', suitable: false, semanticRole: 'hook-core', semanticPriority: 0 },
          sourceLines,
          finalText: finalTexts.get(sourceLines[0].lineIndex) || '',
          finalTexts,
          semanticPriority,
          semanticRole,
          kpopFitScore: sourceLines.length ? Math.round(kpopFitScore / sourceLines.length) : 0,
          mixForm: block.mixForm || 'short-phrase',
          switchPosition: 'base-first',
          arrangementPriority: semanticPriority,
          motifFamily: block.hookFamily,
          mirrorPolicy: block.mirrorPolicy,
          hookFamily: block.hookFamily,
          hookLineSlot: block.hookLineSlot,
          candidateRole: block.candidateRole,
          targetUnitGuide: block.targetUnitGuide,
          zones: new Set(sourceLines.map((line) => line.timelineZone)),
          sections: new Set(sourceLines.map((line) => line.section)),
        });
        return;
      }

      sourceLines.forEach((sourceLine) => {
        const response = responseById.get(sourceLine.id);
        const finalText = String(response?.finalText || '').replace(/\r\n?/g, '\n').trim();
        const measuredLine = measureV1LineLanguageOccupancy(finalText, baseLanguage, targetLanguages);
        const responseMixForm = normalizeV1AdaptiveMixForm(response?.mixForm || block.mixForm, measuredLine);
        const responseSwitchPosition = normalizeV1SwitchPosition(response?.switchPosition, measuredLine);
        const withinLineMode = blockPlan.mode === 'within-line-rhyme';
        const kpopInspection = withinLineMode
          ? inspectV1KpopCodeSwitchLine({
              finalText,
              sourceText: sourceLine.text,
              requestedRatio,
              baseLanguage,
              targetLanguages,
              targetShareGuide: blockPlan.targetShareGuide,
              mixForm: block.mixForm,
              targetUnitGuide: block.targetUnitGuide,
            })
          : null;
        const validShape = Boolean(response?.suitable)
          && Boolean(finalText)
          && finalText !== sourceLine.text
          && !finalText.includes('\n')
          && !/[\[\]]/.test(finalText)
          && measuredLine.hasTarget
          && (!withinLineMode || Boolean(kpopInspection?.passed));
        if (!validShape) {
          blockValid = false;
          const detail = withinLineMode && kpopInspection?.reasons.length
            ? `:${kpopInspection.reasons.join(',')}`
            : '';
          rejectedDiagnostics.push({ id: sourceLine.id, reason: withinLineMode ? `kpop-code-switch-candidate-invalid${detail}` : 'planned-block-line-invalid' });
          return;
        }
        finalTexts.set(sourceLine.lineIndex, finalText);
        if (kpopInspection) kpopFitScore += kpopInspection.fitScore;
        const priority = Math.max(0, Math.min(100, Number(response?.semanticPriority) || 0));
        const lineArrangementPriority = Math.max(0, Math.min(100, Number(response?.arrangementPriority) || priority));
        if (lineArrangementPriority >= arrangementPriority) {
          arrangementPriority = lineArrangementPriority;
          resolvedMixForm = responseMixForm;
          resolvedSwitchPosition = responseSwitchPosition;
          motifFamily = String(response?.motifFamily || block.hookFamily || '').trim() || undefined;
        }
        if (priority >= semanticPriority) {
          semanticPriority = priority;
          semanticRole = String(response?.semanticRole || semanticRole);
        }
      });
      if (blockValid && block.mirrorPolicy === 'same-target-anchor' && blockPlan.mode !== 'adaptive-arrangement') {
        const targetAnchors = sourceLines.map((sourceLine) =>
          extractV1TargetLanguageTokens(
            finalTexts.get(sourceLine.lineIndex) || '',
            baseLanguage,
            targetLanguages,
          ).join(' '));
        const firstAnchor = targetAnchors[0] || '';
        if (!firstAnchor || targetAnchors.some((anchor) => anchor !== firstAnchor)) {
          blockValid = false;
          sourceLines.forEach((sourceLine) => rejectedDiagnostics.push({
            id: sourceLine.id,
            reason: 'hook-mirror-target-anchor-mismatch',
          }));
        }
        const repeatedSourceGroups = new Map<string, V1LockedLyricLine[]>();
        sourceLines.forEach((sourceLine) => {
          const group = repeatedSourceGroups.get(sourceLine.normalizedText) || [];
          group.push(sourceLine);
          repeatedSourceGroups.set(sourceLine.normalizedText, group);
        });
        repeatedSourceGroups.forEach((group) => {
          if (group.length < 2) return;
          const normalizedFinals = group.map((sourceLine) => normalizeLineText(finalTexts.get(sourceLine.lineIndex) || ''));
          if (new Set(normalizedFinals).size > 1) {
            blockValid = false;
            group.forEach((sourceLine) => rejectedDiagnostics.push({
              id: sourceLine.id,
              reason: 'repeated-hook-line-final-text-mismatch',
            }));
          }
        });
      }
      if (!blockValid) return;
      plannedCandidates.push({
        key: block.id,
        response: responseById.get(block.lineIds[0]) || { id: block.lineIds[0], finalText: '', suitable: false, semanticRole: 'connector', semanticPriority: 0 },
        sourceLines,
        finalText: finalTexts.get(sourceLines[0].lineIndex) || '',
        finalTexts,
        semanticPriority,
        semanticRole,
        kpopFitScore: sourceLines.length ? Math.round(kpopFitScore / sourceLines.length) : 0,
        mixForm: resolvedMixForm,
        switchPosition: resolvedSwitchPosition,
        arrangementPriority: Math.max(arrangementPriority, semanticPriority),
        motifFamily,
        mirrorPolicy: block.mirrorPolicy,
        hookFamily: block.hookFamily,
        hookLineSlot: block.hookLineSlot,
        candidateRole: block.candidateRole,
        targetUnitGuide: block.targetUnitGuide,
        zones: new Set(sourceLines.map((line) => line.timelineZone)),
        sections: new Set(sourceLines.map((line) => line.section)),
      });
    });
  }
  const candidates = blockPlan?.blocks?.length ? plannedCandidates : fallbackCandidates;
  const withinLineRhymeMode = blockPlan?.mode === 'within-line-rhyme';
  const adaptiveArrangementMode = blockPlan?.mode === 'adaptive-arrangement';
  const adaptiveQualityMode = adaptiveArrangementMode && targetLanguages.length >= 1;
  const multiTargetAdaptiveMode = adaptiveArrangementMode && targetLanguages.length > 1;
  const completeLineBlockMode = blockPlan?.mode === 'complete-line-blocks';
  const selected: Candidate[] = [];
  const selectedKeys = new Set<string>();
  const replacements = new Map<number, string>(cleanupReplacements);
  let currentLyrics = buildLyricsFromReplacementMap(document, replacements);
  let currentRatio = measureV1WholeRewriteRatio(currentLyrics, baseLanguage, targetLanguages);
  let currentTopology = inspectV1RewriteTopology(document, replacements, baseLanguage, targetLanguages);
  const selectedZones = new Set<'early' | 'middle' | 'late'>();
  const selectedSections = new Set<string>();
  const requiredZoneCount = requestedRatio <= 10 ? 2 : 3;
  const preferredZones: Array<'early' | 'middle' | 'late'> = requestedRatio <= 10
    ? ['early', 'late']
    : ['early', 'middle', 'late'];
  const desiredClusterSize = withinLineRhymeMode ? 1 : requestedRatio <= 50 ? 3 : 4;
  const sungPositionByRawIndex = new Map(document.sungLines.map((line, index) => [line.lineIndex, index] as const));

  const candidatePositions = (candidate: Candidate): number[] => candidate.sourceLines
    .map((line) => sungPositionByRawIndex.get(line.lineIndex))
    .filter((position): position is number => Number.isInteger(position));

  const selectedPositions = (): Set<number> => new Set(
    document.sungLines
      .filter((line) => replacements.has(line.lineIndex))
      .map((line) => sungPositionByRawIndex.get(line.lineIndex))
      .filter((position): position is number => Number.isInteger(position)),
  );

  const trialCandidate = (candidate: Candidate) => {
    const trialMap = new Map(replacements);
    candidate.sourceLines.forEach((line) => {
      trialMap.set(line.lineIndex, candidate.finalTexts.get(line.lineIndex) || candidate.finalText);
    });
    const trialLyrics = buildLyricsFromReplacementMap(document, trialMap);
    return {
      map: trialMap,
      lyrics: trialLyrics,
      ratio: measureV1WholeRewriteRatio(trialLyrics, baseLanguage, targetLanguages),
      topology: inspectV1RewriteTopology(document, trialMap, baseLanguage, targetLanguages),
    };
  };

  const trialCandidateSet = (candidateSet: Candidate[]) => {
    const trialMap = new Map(cleanupReplacements);
    candidateSet.forEach((candidate) => {
      candidate.sourceLines.forEach((line) => {
        trialMap.set(line.lineIndex, candidate.finalTexts.get(line.lineIndex) || candidate.finalText);
      });
    });
    const trialLyrics = buildLyricsFromReplacementMap(document, trialMap);
    return {
      map: trialMap,
      lyrics: trialLyrics,
      ratio: measureV1WholeRewriteRatio(trialLyrics, baseLanguage, targetLanguages),
      topology: inspectV1RewriteTopology(document, trialMap, baseLanguage, targetLanguages),
    };
  };

  const measurePerTargetRatios = (lyrics: string): Record<string, number> => {
    const overall = measureV1SungLanguageOccupancy(lyrics, baseLanguage, targetLanguages);
    const totalUnits = Math.max(0, Number(overall.totalPerformanceUnits || 0));
    return targetLanguages.reduce((acc, language) => {
      const units = measureV1SungLanguageOccupancy(lyrics, baseLanguage, [language]).targetPerformanceUnits;
      acc[language] = totalUnits > 0 ? Math.round(((units / totalUnits) * 100) * 10) / 10 : 0;
      return acc;
    }, {} as Record<string, number>);
  };
  const multiTargetMinimumRatio = multiTargetAdaptiveMode
    ? Math.max(2, Math.round((((lowerBound / targetLanguages.length) * 0.4)) * 10) / 10)
    : 0;

  const selectBestRatioFitCandidateSet = (pool: Candidate[]): {
    candidates: Candidate[];
    trial: ReturnType<typeof trialCandidateSet>;
  } | null => {
    if (!pool.length) return null;
    const targetMidpoint = (lowerBound + upperBound) / 2;
    type BeamState = {
      candidates: Candidate[];
      trial: ReturnType<typeof trialCandidateSet>;
      score: number;
    };
    const scoreState = (candidateSet: Candidate[], trial: ReturnType<typeof trialCandidateSet>): number => {
      const ratioBandDistance = trial.ratio < lowerBound
        ? lowerBound - trial.ratio
        : trial.ratio > upperBound
          ? trial.ratio - upperBound
          : 0;
      const fitScore = candidateSet.reduce((sum, candidate) => sum + candidate.kpopFitScore, 0);
      const priorityScore = candidateSet.reduce((sum, candidate) => sum + candidate.semanticPriority, 0);
      const arrangementScore = candidateSet.reduce((sum, candidate) => sum + candidate.arrangementPriority, 0);
      const formCounts = new Map<string, number>();
      const directionCounts = new Map<string, number>();
      candidateSet.forEach((candidate) => {
        formCounts.set(candidate.mixForm, (formCounts.get(candidate.mixForm) || 0) + candidate.sourceLines.length);
        directionCounts.set(candidate.switchPosition, (directionCounts.get(candidate.switchPosition) || 0) + candidate.sourceLines.length);
      });
      const selectedLineCount = Math.max(1, candidateSet.reduce((sum, candidate) => sum + candidate.sourceLines.length, 0));
      const maxFormCount = Math.max(0, ...Array.from(formCounts.values()));
      const maxDirectionCount = Math.max(0, ...Array.from(directionCounts.values()));
      const repeatedFormPenalty = adaptiveQualityMode
        ? Math.max(0, maxFormCount / selectedLineCount - 0.68) * 180
        : adaptiveArrangementMode
          ? maxFormCount * 0.08
          : 0;
      const repeatedDirectionPenalty = adaptiveQualityMode
        ? Math.max(0, maxDirectionCount / selectedLineCount - 0.68) * 220
        : adaptiveArrangementMode
          ? maxDirectionCount * 0.1
          : 0;
      const hookLineCount = candidateSet.reduce((sum, candidate) =>
        sum + candidate.sourceLines.filter((line) => isV1HookSection(line.section)).length, 0);
      const hookDominancePenalty = adaptiveQualityMode
        ? Math.max(0, hookLineCount / selectedLineCount - 0.58) * 1600
        : 0;
      const standaloneFinalTextCounts = new Map<string, number>();
      candidateSet.forEach((candidate) => {
        if (candidate.mirrorPolicy === 'same-target-anchor') return;
        candidate.sourceLines.forEach((line) => {
          const normalized = normalizeLineText(candidate.finalTexts.get(line.lineIndex) || candidate.finalText);
          if (!normalized) return;
          standaloneFinalTextCounts.set(normalized, (standaloneFinalTextCounts.get(normalized) || 0) + 1);
        });
      });
      const repeatedStandaloneTextPenalty = adaptiveQualityMode
        ? Array.from(standaloneFinalTextCounts.values()).reduce((sum, count) => sum + Math.max(0, count - 1) * 35, 0)
        : 0;
      const topologyPenalty = scoreV1RewriteTopology(trial.topology, requestedRatio)
        * (adaptiveQualityMode ? 11 : adaptiveArrangementMode ? 0 : 0.01);
      const perTargetRatios = multiTargetAdaptiveMode ? measurePerTargetRatios(trial.lyrics) : {};
      const targetCoveragePenalty = multiTargetAdaptiveMode
        ? targetLanguages.reduce((sum, language) => sum + Math.max(0, multiTargetMinimumRatio - Number(perTargetRatios[language] || 0)) * 8000, 0)
        : 0;
      const targetRatioValues = multiTargetAdaptiveMode ? targetLanguages.map((language) => Number(perTargetRatios[language] || 0)) : [];
      const targetImbalancePenalty = targetRatioValues.length > 1
        ? (Math.max(...targetRatioValues) - Math.min(...targetRatioValues)) * 18
        : 0;
      return ratioBandDistance * 10000
        + Math.abs(targetMidpoint - trial.ratio) * 100
        + selectedLineCount * (adaptiveArrangementMode ? 0.18 : 0.02)
        + topologyPenalty
        + repeatedFormPenalty
        + repeatedDirectionPenalty
        + hookDominancePenalty
        + repeatedStandaloneTextPenalty
        + targetCoveragePenalty
        + targetImbalancePenalty
        - fitScore * 0.002
        - priorityScore * 0.002
        - arrangementScore * 0.004;
    };

    let states: BeamState[] = [{
      candidates: [],
      trial: trialCandidateSet([]),
      score: Number.MAX_SAFE_INTEGER,
    }];
    const beamWidth = 640;
    const perRatioBucket = 4;

    pool.forEach((candidate) => {
      const expanded: BeamState[] = [...states];
      states.forEach((state) => {
        const occupiedLineIndexes = new Set(state.candidates.flatMap((item) => item.sourceLines.map((line) => line.lineIndex)));
        if (candidate.sourceLines.some((line) => occupiedLineIndexes.has(line.lineIndex))) return;
        const candidateSet = [...state.candidates, candidate];
        const trial = trialCandidateSet(candidateSet);
        expanded.push({ candidates: candidateSet, trial, score: scoreState(candidateSet, trial) });
      });

      const bucketed = new Map<number, BeamState[]>();
      expanded.forEach((state) => {
        const ratioBucket = Math.round(state.trial.ratio * 10);
        const bucket = bucketed.get(ratioBucket) || [];
        bucket.push(state);
        bucket.sort((a, b) => a.score - b.score);
        bucketed.set(ratioBucket, bucket.slice(0, perRatioBucket));
      });
      states = Array.from(bucketed.values())
        .flat()
        .sort((a, b) => a.score - b.score)
        .slice(0, beamWidth);
    });

    const best = states
      .filter((state) => state.candidates.length > 0)
      .sort((a, b) => a.score - b.score)[0];
    return best ? { candidates: best.candidates, trial: best.trial } : null;
  };

  const applyCandidate = (candidate: Candidate, trial: ReturnType<typeof trialCandidate>): void => {
    selected.push(candidate);
    selectedKeys.add(candidate.key);
    replacements.clear();
    trial.map.forEach((value, key) => replacements.set(key, value));
    candidate.zones.forEach((zone) => selectedZones.add(zone));
    candidate.sections.forEach((section) => selectedSections.add(section));
    currentLyrics = trial.lyrics;
    currentRatio = trial.ratio;
    currentTopology = trial.topology;
  };

  const chooseCandidate = (
    pool: Candidate[],
    options: { preferAdjacent?: boolean; preferredZone?: 'early' | 'middle' | 'late'; allowUpperSlack?: number } = {},
  ): { candidate: Candidate; trial: ReturnType<typeof trialCandidate> } | null => {
    const occupied = selectedPositions();
    const upperSlack = Number(options.allowUpperSlack || 0);
    const ranked = pool
      .filter((candidate) => !selectedKeys.has(candidate.key))
      .map((candidate) => {
        const trial = trialCandidate(candidate);
        const positions = candidatePositions(candidate);
        const adjacency = positions.reduce((count, position) =>
          count + (occupied.has(position - 1) || occupied.has(position + 1) ? 1 : 0), 0);
        const zoneMatch = options.preferredZone && candidate.zones.has(options.preferredZone) ? 1 : 0;
        const newZoneCount = Array.from(candidate.zones).filter((zone) => !selectedZones.has(zone)).length;
        const newSectionCount = Array.from(candidate.sections).filter((section) => !selectedSections.has(section)).length;
        const ratioDistance = Math.abs(requestedRatio - trial.ratio);
        const overshoot = Math.max(0, trial.ratio - (upperBound + upperSlack));
        const topologyPenalty = scoreV1RewriteTopology(trial.topology, requestedRatio);
        const score = ratioDistance * 1.4
          + overshoot * 6
          + topologyPenalty
          - candidate.semanticPriority * 0.025
          - candidate.kpopFitScore * (withinLineRhymeMode ? 0.08 : 0)
          - adjacency * (options.preferAdjacent ? 5 : 2)
          - zoneMatch * 4
          - newZoneCount * 1.5
          - newSectionCount * (trial.topology.targetSectionCount < getV1RewriteTopologyLimits(requestedRatio).requiredTargetSectionCount ? 9 : 3);
        return { candidate, trial, adjacency, zoneMatch, score };
      })
      .sort((a, b) => a.score - b.score || b.adjacency - a.adjacency || b.candidate.semanticPriority - a.candidate.semanticPriority);
    return ranked[0] ? { candidate: ranked[0].candidate, trial: ranked[0].trial } : null;
  };

  const candidateHasSameSectionNeighbor = (candidate: Candidate, pool: Candidate[]): boolean => {
    const positions = candidatePositions(candidate);
    return pool.some((other) => {
      if (other.key === candidate.key) return false;
      const otherPositions = candidatePositions(other);
      return positions.some((position) => otherPositions.some((otherPosition) =>
        Math.abs(position - otherPosition) === 1
        && document.sungLines[position]?.section === document.sungLines[otherPosition]?.section));
    });
  };

  let ratioFitSelectionApplied = false;

  if (withinLineRhymeMode && requestedRatio === 5) {
    // 145차: 5%도 고정 5줄 패턴이 아니라 최종 전체 가창 분량 5~10%를 먼저 맞춘다.
    // 후렴/비후렴 후보를 하나의 후보 풀로 보고, 실제 측정 비율이 범위에 들어오는 조합을 선택한다.
    const subsetPool = candidates.slice(0, 10);
    const rankedSets: Array<{ candidates: Candidate[]; trial: ReturnType<typeof trialCandidateSet>; score: number }> = [];
    const subsetCount = 1 << subsetPool.length;
    const targetMidpoint = (lowerBound + upperBound) / 2;
    for (let mask = 1; mask < subsetCount; mask += 1) {
      const candidateSet = subsetPool.filter((_, index) => Boolean(mask & (1 << index)));
      const trial = trialCandidateSet(candidateSet);
      const ratioBandDistance = trial.ratio < lowerBound
        ? lowerBound - trial.ratio
        : trial.ratio > upperBound
          ? trial.ratio - upperBound
          : 0;
      const fitScore = candidateSet.reduce((sum, candidate) => sum + candidate.kpopFitScore, 0);
      const priorityScore = candidateSet.reduce((sum, candidate) => sum + candidate.semanticPriority, 0);
      const score = ratioBandDistance * 1000
        + Math.abs(targetMidpoint - trial.ratio) * 20
        + candidateSet.length * 0.15
        - fitScore * 0.02
        - priorityScore * 0.005;
      rankedSets.push({ candidates: candidateSet, trial, score });
    }

    const bestSet = rankedSets.sort((a, b) => a.score - b.score)[0];
    if (bestSet) {
      bestSet.candidates.forEach((candidate) => {
        const trial = trialCandidate(candidate);
        applyCandidate(candidate, trial);
      });
      ratioFitSelectionApplied = bestSet.candidates.length > 0;
    }
  }

  if (completeLineBlockMode && blockPlan?.blocks?.length) {
    // 145차: 완전 외국어 블록도 순서대로 전부 넣지 않고, 실제 전체 가창 분량이
    // 선택 범위에 가장 가깝게 들어오는 블록 조합을 고른다.
    const subsetPool = candidates.slice(0, 12);
    const subsetCount = 1 << subsetPool.length;
    const targetMidpoint = (lowerBound + upperBound) / 2;
    const rankedSets: Array<{ candidates: Candidate[]; trial: ReturnType<typeof trialCandidateSet>; score: number }> = [];
    for (let mask = 1; mask < subsetCount; mask += 1) {
      const candidateSet = subsetPool.filter((_, index) => Boolean(mask & (1 << index)));
      const trial = trialCandidateSet(candidateSet);
      const ratioBandDistance = trial.ratio < lowerBound
        ? lowerBound - trial.ratio
        : trial.ratio > upperBound
          ? trial.ratio - upperBound
          : 0;
      const score = ratioBandDistance * 1000
        + Math.abs(targetMidpoint - trial.ratio) * 20
        + candidateSet.length * 0.1
        + scoreV1RewriteTopology(trial.topology, requestedRatio) * 0.05;
      rankedSets.push({ candidates: candidateSet, trial, score });
    }
    const bestSet = rankedSets.sort((a, b) => a.score - b.score)[0];
    if (bestSet) {
      bestSet.candidates.forEach((candidate) => {
        const trial = trialCandidate(candidate);
        applyCandidate(candidate, trial);
      });
      ratioFitSelectionApplied = bestSet.candidates.length > 0;
    }
  }

  if (adaptiveArrangementMode) {
    const bestSet = selectBestRatioFitCandidateSet(candidates);
    if (bestSet) {
      bestSet.candidates.forEach((candidate) => {
        const trial = trialCandidate(candidate);
        applyCandidate(candidate, trial);
      });
      ratioFitSelectionApplied = bestSet.candidates.length > 0;
    }
  }

  if (!ratioFitSelectionApplied && adaptiveArrangementMode) {
    const firstChoice = candidates
      .slice()
      .sort((a, b) => b.arrangementPriority - a.arrangementPriority || b.semanticPriority - a.semanticPriority)[0];
    if (firstChoice) {
      applyCandidate(firstChoice, trialCandidate(firstChoice));
      ratioFitSelectionApplied = true;
    }
  }

  // Establish intentional early/middle/late anchors first. A seed that can form a real local
  // cluster is preferred; the selector never chooses an unrelated line and then merely hopes a
  // later pass will connect it.
  if (!ratioFitSelectionApplied && !completeLineBlockMode && !(withinLineRhymeMode && requestedRatio === 5)) {
  for (const zone of preferredZones) {
    if (selectedZones.has(zone)) continue;
    const zonePool = candidates.filter((candidate) => candidate.zones.has(zone));
    const clusterSeedPool = withinLineRhymeMode ? zonePool : zonePool.filter((candidate) =>
      candidateHasSameSectionNeighbor(candidate, zonePool));
    const seed = chooseCandidate(clusterSeedPool.length ? clusterSeedPool : zonePool, {
      preferredZone: zone,
      allowUpperSlack: 3,
    });
    if (!seed) continue;
    applyCandidate(seed.candidate, seed.trial);

    for (let step = 1; step < desiredClusterSize; step += 1) {
      const occupied = selectedPositions();
      const adjacentPool = zonePool.filter((candidate) => candidatePositions(candidate).some((position) => {
        const sourceSection = document.sungLines[position]?.section;
        return [position - 1, position + 1].some((neighbor) =>
          occupied.has(neighbor) && document.sungLines[neighbor]?.section === sourceSection);
      }));
      const adjacent = chooseCandidate(adjacentPool, {
        preferAdjacent: true,
        preferredZone: zone,
        allowUpperSlack: 3,
      });
      if (!adjacent) break;
      applyCandidate(adjacent.candidate, adjacent.trial);
      if (currentRatio >= lowerBound && selectedZones.size >= requiredZoneCount) break;
    }
  }

  // Fill the remaining ratio budget. Adjacent lines are preferred; a new cluster is opened only
  // when no coherent neighbor can improve the requested sung occupancy.
  while (currentRatio < Math.max(lowerBound, requestedRatio - 1) && selectedKeys.size < candidates.length) {
    const remaining = candidates.filter((candidate) => !selectedKeys.has(candidate.key));
    const adjacent = chooseCandidate(remaining, { preferAdjacent: !withinLineRhymeMode, allowUpperSlack: 2 });
    if (!adjacent) break;
    applyCandidate(adjacent.candidate, adjacent.trial);
  }

  // Final placement repair. Open a new section/zone when coverage is still narrow; otherwise
  // extend an existing block. Every trial remains inside the same irreversible run limits.
  while (!v1RewriteTopologyPassed(currentTopology, requestedRatio) && currentRatio <= upperBound) {
    const remaining = candidates.filter((candidate) => !selectedKeys.has(candidate.key));
    const limits = getV1RewriteTopologyLimits(requestedRatio);
    const needsCoverage = currentTopology.targetSectionCount < limits.requiredTargetSectionCount
      || currentTopology.targetTimelineZoneCount < limits.requiredTimelineZoneCount;
    const occupied = selectedPositions();
    const repairPool = needsCoverage
      ? remaining.filter((candidate) =>
          Array.from(candidate.sections).some((section) => !selectedSections.has(section))
          || Array.from(candidate.zones).some((zone) => !selectedZones.has(zone)))
      : remaining.filter((candidate) => candidatePositions(candidate)
          .some((position) => occupied.has(position - 1) || occupied.has(position + 1)));
    const repair = chooseCandidate(repairPool, {
      preferAdjacent: !needsCoverage,
      allowUpperSlack: 0,
    });
    if (!repair) break;
    applyCandidate(repair.candidate, repair.trial);
  }

  }

  const lockedLinesPreserved = lockedLinesAreIdentical(document, currentLyrics);
  const coveragePassed = currentTopology.targetTimelineZoneCount >= requiredZoneCount;
  const topologyPassed = v1RewriteTopologyPassed(currentTopology, requestedRatio);
  const selectedLineInspections = selected.flatMap((candidate) => candidate.sourceLines.map((line) =>
    inspectV1KpopCodeSwitchLine({
      finalText: candidate.finalTexts.get(line.lineIndex) || candidate.finalText,
      sourceText: line.text,
      requestedRatio,
      baseLanguage,
      targetLanguages,
      targetShareGuide: blockPlan?.targetShareGuide || { minimum: 0.08, ideal: 0.34, maximum: 0.62 },
      mixForm: candidate.mixForm === 'complete-target-line' ? 'extended-phrase' : candidate.mixForm,
      mirrorReuse: candidate.mirrorPolicy === 'same-target-anchor',
      targetUnitGuide: candidate.targetUnitGuide,
    })));
  const withinLineRhymePassed = !withinLineRhymeMode || (
    selectedLineInspections.length > 0
    && selectedLineInspections.every((inspection) => inspection.passed)
  );
  const selectedKeywordAnchorCount = selected.filter((candidate) => candidate.mixForm === 'keyword-anchor').length;
  const selectedShortPhraseCount = selected.filter((candidate) => candidate.mixForm === 'short-phrase').length;
  const selectedMirroredHookCount = selected.filter((candidate) => candidate.mirrorPolicy === 'same-target-anchor').length;
  const plannedMirroredHookCount = blockPlan?.blocks.filter((block) => block.mirrorPolicy === 'same-target-anchor').length || 0;
  const requiredMirroredHookCount = withinLineRhymeMode
    ? Math.min(requestedRatio <= 10 ? 1 : 2, plannedMirroredHookCount)
    : 0;
  const mixFormBalancePassed = !withinLineRhymeMode || (selectedKeywordAnchorCount >= 1 && selectedShortPhraseCount >= 1);
  const hookMirrorPassed = !withinLineRhymeMode || selectedMirroredHookCount >= requiredMirroredHookCount;
  const selectedPlacementLineCount = selected.reduce((sum, candidate) => sum + candidate.sourceLines.length, 0);
  const fivePercentPatternPassed = requestedRatio !== 5 || (
    selectedMirroredHookCount === 1
    && selectedShortPhraseCount === 2
    && selectedPlacementLineCount === 5
  );
  const ratioBandPassed = currentRatio >= lowerBound && currentRatio <= upperBound;
  const hasVisiblePlacement = selectedPlacementLineCount > 0;
  const warningReasons = [
    !ratioBandPassed ? 'whole-song-ratio-band-not-met' : '',
    !coveragePassed ? 'target-timeline-coverage-not-met' : '',
    !topologyPassed ? 'language-placement-topology-not-met' : '',
    !withinLineRhymePassed ? 'within-line-rhyme-contract-not-met' : '',
    !mixFormBalancePassed ? 'mix-form-balance-not-met' : '',
    !hookMirrorPassed ? 'hook-mirror-not-met' : '',
    !fivePercentPatternPassed ? 'five-percent-pattern-not-met' : '',
  ].filter(Boolean);

  // 146차: 비율·배치·후렴·형태 검사는 결과 폐기 조건이 아니라 사용자 확인용 경고다.
  // 실제 후보가 한 줄이라도 적용 가능하고, 원본 섹션/큐 잠금과 정리 경계가 보존되면
  // 생성된 언어혼합 가사를 그대로 반환한다. 기술적으로 재조립할 수 없는 경우만 원문을 보존한다.
  const status: 'applied' | 'preserved' = hasVisiblePlacement
    && cleanupComplete
    && lockedLinesPreserved
      ? 'applied'
      : 'preserved';
  const preservedReason = status === 'applied'
    ? undefined
    : withinLineRhymeMode && !candidates.length
      ? 'no-valid-within-line-rhyme-candidates'
      : adaptiveArrangementMode && !candidates.length
        ? 'no-suitable-adaptive-arrangement-candidates'
        : completeLineBlockMode && blockPlan?.blocks?.length && candidates.length < blockPlan.blocks.length
        ? 'planned-language-block-incomplete'
        : !candidates.length
          ? 'no-valid-complete-line-rewrite-candidates'
          : !hasVisiblePlacement
            ? 'no-applicable-language-mix-placement'
            : !cleanupComplete
              ? 'preexisting-target-cleanup-incomplete'
              : !lockedLinesPreserved
                ? 'locked-section-or-cue-lines-changed'
                : 'technical-reassembly-failed';

  return {
    status,
    lyrics: status === 'applied' ? currentLyrics : document.original,
    requestedRatio,
    actualRatio: status === 'applied' ? currentRatio : measureV1WholeRewriteRatio(document.original, baseLanguage, targetLanguages),
    lowerBound,
    upperBound,
    providedLineCount: responseById.size,
    validCandidateCount: candidates.length,
    appliedPlacementCount: status === 'applied' ? selected.reduce((sum, candidate) => sum + candidate.sourceLines.length, 0) : 0,
    targetTimelineZoneCount: status === 'applied' ? selectedZones.size : 0,
    selectedPlacements: status === 'applied'
      ? selected.flatMap((candidate) => candidate.sourceLines.map((line) => ({
          id: line.id,
          section: line.section,
          lineIndex: line.lineIndex,
          sourceText: line.text,
          finalText: candidate.finalTexts.get(line.lineIndex) || candidate.finalText,
          semanticRole: candidate.semanticRole,
          semanticPriority: candidate.semanticPriority,
          timelineZone: line.timelineZone,
          occurrences: 1,
          meaningConnection: candidate.response.meaningConnection,
          phoneticConnection: candidate.response.phoneticConnection,
          targetShare: Math.round(measureV1LineLanguageOccupancy(
            candidate.finalTexts.get(line.lineIndex) || candidate.finalText,
            baseLanguage,
            targetLanguages,
          ).targetShare * 1000) / 10,
          mixForm: normalizeV1AdaptiveMixForm(
            responseById.get(line.id)?.mixForm || candidate.mixForm,
            measureV1LineLanguageOccupancy(
              candidate.finalTexts.get(line.lineIndex) || candidate.finalText,
              baseLanguage,
              targetLanguages,
            ),
          ),
          hookFamily: candidate.hookFamily,
          hookLineSlot: candidate.hookLineSlot,
          mirroredHook: candidate.mirrorPolicy === 'same-target-anchor',
          switchPosition: normalizeV1SwitchPosition(
            responseById.get(line.id)?.switchPosition || candidate.switchPosition,
            measureV1LineLanguageOccupancy(
              candidate.finalTexts.get(line.lineIndex) || candidate.finalText,
              baseLanguage,
              targetLanguages,
            ),
          ),
          arrangementPriority: Math.max(0, Math.min(100, Number(responseById.get(line.id)?.arrangementPriority) || candidate.arrangementPriority)),
          motifFamily: String(responseById.get(line.id)?.motifFamily || candidate.motifFamily || '').trim() || undefined,
        })))
      : [],
    rejectedDiagnostics,
    plannedBlockCount: blockPlan?.blocks?.length || 0,
    plannedLineCount: blockPlan?.plannedLineCount || 0,
    completedBlockCount: blockPlan?.blocks?.length ? candidates.length : undefined,
    candidateLineCount: blockPlan?.candidateLineCount || blockPlan?.plannedLineCount || 0,
    backupBlockCount: blockPlan?.backupBlockCount || 0,
    cleanupRequiredCount: cleanupRequiredLines.length,
    cleanupAppliedCount: cleanupReplacements.size,
    preservedReason,
    ratioBandPassed,
    warningReasons,
    applicationPolicy: 'show-generated-candidate-with-warnings',
    lockedLineCount: document.lockedLineCount,
    lockedLinesPreserved,
  };
}

export function buildV1SectionIntegrityAudit(
  lyrics: string,
  expectedOrderInput: string[] = [],
  lockedLinesPreserved?: boolean,
  productionCuesRequired = true,
): V1SectionIntegrityAudit {
  const rawLines = String(lyrics || '').replace(/\r\n?/g, '\n').split('\n');
  const cueReferenceTokens = rawLines
    .map((line) => line.trim())
    .filter((line) => isStandaloneBracketLine(line))
    .flatMap((line) => {
      const inside = line.slice(1, -1);
      const cueBody = inside.includes(':') || inside.includes('：')
        ? inside.split(/[:：]/).slice(1).join(' ')
        : inside;
      return cueBody.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) || [];
    });
  const expectedOrder = expectedOrderInput.map((item) => String(item || '').trim()).filter(Boolean);
  const actualOrder: string[] = [];
  const malformedSectionTags: string[] = [];
  const duplicateAdjacentStructuralTags: string[] = [];
  const unclosedBracketLines: string[] = [];
  const details = new Map<string, { lyrics: number; cues: number }>();
  let currentSection = '';
  let previousSection = '';

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if ((line.startsWith('[') && !line.endsWith(']')) || (!line.startsWith('[') && line.endsWith(']'))) {
      unclosedBracketLines.push(line);
    }
    const section = getStructuralSectionName(line, expectedOrder);
    if (section) {
      if (previousSection === section) duplicateAdjacentStructuralTags.push(line);
      previousSection = section;
      currentSection = section;
      actualOrder.push(section);
      if (!details.has(section)) details.set(section, { lyrics: 0, cues: 0 });
      const inside = line.slice(1, -1);
      const cueBody = inside.split(/[:：]/).slice(1).join(' ').trim();
      if (cueBody && hasV1GenericLeadingLetterLoss(cueBody, cueReferenceTokens)) malformedSectionTags.push(line);
      return;
    }
    if (isStandaloneBracketLine(line)) {
      if (currentSection) {
        const detail = details.get(currentSection) || { lyrics: 0, cues: 0 };
        detail.cues += 1;
        details.set(currentSection, detail);
      }
      return;
    }
    if (currentSection && countLexicalCharacters(line) > 0) {
      const detail = details.get(currentSection) || { lyrics: 0, cues: 0 };
      detail.lyrics += 1;
      details.set(currentSection, detail);
    }
  });

  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
  const orderMatches = expectedOrder.length === 0
    ? true
    : expectedOrder.length === actualOrder.length
      && expectedOrder.every((section, index) => normalize(section) === normalize(actualOrder[index] || ''));
  const actualNormalized = new Set(actualOrder.map(normalize));
  const missingSections = expectedOrder.filter((section) => !actualNormalized.has(normalize(section)));
  const missingProductionCueSections = actualOrder.filter((section) => (details.get(section)?.cues || 0) === 0);
  const emptySections = actualOrder.filter((section) => {
    const detail = details.get(section) || { lyrics: 0, cues: 0 };
    return detail.lyrics === 0 && detail.cues === 0;
  });
  const status = orderMatches
    && missingSections.length === 0
    && malformedSectionTags.length === 0
    && duplicateAdjacentStructuralTags.length === 0
    && unclosedBracketLines.length === 0
    && (!productionCuesRequired || missingProductionCueSections.length === 0)
    && lockedLinesPreserved !== false
      ? 'passed'
      : 'needs-review';

  return {
    status,
    expectedOrder,
    actualOrder,
    orderMatches,
    missingSections,
    missingProductionCueSections,
    emptySections,
    malformedSectionTags,
    duplicateAdjacentStructuralTags,
    unclosedBracketLines,
    lockedLinesPreserved,
  };
}
