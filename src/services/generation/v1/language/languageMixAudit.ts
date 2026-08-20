import {
  extractV1TargetLanguageTokens,
  measureV1LineLanguageOccupancy,
  measureV1SungLanguageOccupancy,
  type V1LanguageMeasurementCode,
} from './languageMixMeasurement';
import { getLanguageMixRatioBand, normalizeLanguageMixRatioOption } from '../../../../constants/languageMixRatios';

export type V1LanguageCode = V1LanguageMeasurementCode;

export interface V1PublicLanguageMixAuditInput {
  requestedRatio: number;
  targetLanguages: V1LanguageCode[];
  koreanLyrics?: string;
  secondaryLyrics?: string;
  koreanCardLanguage?: V1LanguageCode;
  secondaryLanguage?: V1LanguageCode;
  koreanCardEnabled?: boolean;
  secondaryCardEnabled?: boolean;
}

const ALL_LANGUAGE_PATTERN = /[A-Za-zÀ-ÖØ-öø-ÿĀ-žẀ-ỿ가-힣ㄱ-ㅎㅏ-ㅣ\u3040-\u30ff\u31f0-\u31ff\u3400-\u9fff\u0400-\u04ff\u0e00-\u0e7f]/g;

interface ParsedLyricSection {
  name: string;
  lines: string[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeRatio(value: unknown): number {
  return normalizeLanguageMixRatioOption(value, { allowZero: true });
}

function isDirectiveLine(line: string): boolean {
  return /^\[[^\]]+\]$/.test(String(line || '').trim());
}

function extractSectionName(line: string): string | null {
  const trimmed = String(line || '').trim();
  if (!isDirectiveLine(trimmed)) return null;
  const inside = trimmed.slice(1, -1).trim();
  const name = inside.split(/[:：]/)[0].trim();
  if (/^(?:Intro|Verse(?:\s+\d+)?|Pre-Chorus(?:\s+\d+)?|Chorus(?:\s+\d+)?|Bridge|Final Chorus|Outro|Rap Section(?:\s+\d+)?|Hook(?:\s+\d+)?|Final Hook|Refrain(?:\s+\d+)?|Drop|Build-Up|Breakdown|Climax|Theme\s+[AB]|Main Theme)$/i.test(name)) {
    return name;
  }
  return null;
}

function parseLyricSections(lyrics: string): ParsedLyricSection[] {
  const sections: ParsedLyricSection[] = [];
  let current: ParsedLyricSection = { name: 'Unscoped', lines: [] };
  for (const rawLine of String(lyrics || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const sectionName = extractSectionName(line);
    if (sectionName) {
      if (current.lines.length || current.name !== 'Unscoped') sections.push(current);
      current = { name: sectionName, lines: [] };
      continue;
    }
    if (isDirectiveLine(line)) continue;
    if ((line.match(ALL_LANGUAGE_PATTERN) || []).length) current.lines.push(line);
  }
  if (current.lines.length || current.name !== 'Unscoped') sections.push(current);
  return sections;
}

function cardRatioBounds(targetRatio: number): { lowerBound: number; upperBound: number } {
  if (targetRatio <= 0) return { lowerBound: 0, upperBound: 0 };
  return getLanguageMixRatioBand(targetRatio);
}

function placementMode(targetRatio: number): string {
  if (targetRatio <= 20) return 'kpop-within-line-sound-switch';
  if (targetRatio <= 40) return 'distributed-clusters';
  if (targetRatio <= 60) return 'balanced-blocks';
  return 'target-dominant';
}

function isHookSectionName(section: string): boolean {
  const value = String(section || '');
  return !/pre[-\s]?chorus/i.test(value) && /chorus|hook|refrain|drop|climax/i.test(value);
}

function buildCardAudit(
  lyrics: string,
  baseLanguage: V1LanguageCode,
  targetLanguagesInput: V1LanguageCode[],
  requestedRatio: number,
): Record<string, unknown> {
  const targetLanguages = Array.from(new Set(targetLanguagesInput.filter((language) => language !== baseLanguage)));
  const sections = parseLyricSections(lyrics);
  const lineEntries = sections.flatMap((section) => section.lines.map((line) => ({ section: section.name, line })));
  const overall = measureV1SungLanguageOccupancy(lyrics, baseLanguage, targetLanguages);
  const totalLexicalUnits = overall.totalPerformanceUnits;
  const targetUnits = overall.targetPerformanceUnits;
  const actualMixRatio = overall.actualMixRatio;
  const actualBaseRatio = overall.actualBaseRatio;
  const { lowerBound, upperBound } = cardRatioBounds(requestedRatio);

  const languageUnits = {} as Record<string, number>;
  languageUnits[baseLanguage] = overall.basePerformanceUnits;
  const rawTargetWeights = targetLanguages.map((language) => ({
    language,
    units: measureV1SungLanguageOccupancy(lyrics, baseLanguage, [language]).targetPerformanceUnits,
  }));
  const rawTargetWeightTotal = rawTargetWeights.reduce((sum, item) => sum + item.units, 0);
  rawTargetWeights.forEach(({ language, units }) => {
    languageUnits[language] = rawTargetWeightTotal > 0
      ? round1(targetUnits * (units / rawTargetWeightTotal))
      : 0;
  });

  const trackedLanguages = Array.from(new Set([baseLanguage, ...targetLanguages]));
  const targetGoals = targetLanguages.reduce((acc, language) => {
    acc[language] = targetLanguages.length ? round1(requestedRatio / targetLanguages.length) : 0;
    return acc;
  }, {} as Record<string, number>);
  const languageRatios = trackedLanguages.reduce((acc, language) => {
    acc[language] = totalLexicalUnits > 0 ? round1(((languageUnits[language] || 0) / totalLexicalUnits) * 100) : 0;
    return acc;
  }, {} as Record<string, number>);
  const targetLanguageMinimums = targetLanguages.reduce((acc, language) => {
    acc[language] = targetLanguages.length > 1
      ? Math.max(2, round1((lowerBound / targetLanguages.length) * 0.4))
      : 0;
    return acc;
  }, {} as Record<string, number>);
  const missingTargetLanguages = targetLanguages.filter((language) =>
    targetLanguages.length > 1 && Number(languageRatios[language] || 0) < Number(targetLanguageMinimums[language] || 0));
  const targetLanguageCoveragePassed = missingTargetLanguages.length === 0;

  const sectionTargetRatios = sections.map((section) => {
    const measured = measureV1SungLanguageOccupancy(section.lines.join('\n'), baseLanguage, targetLanguages);
    return {
      section: section.name,
      ratio: measured.actualMixRatio,
      targetUnits: measured.targetPerformanceUnits,
      total: measured.totalPerformanceUnits,
    };
  });
  const activeTargetSections = sectionTargetRatios.filter((section) => section.targetUnits > 0);
  const maxTargetSectionRatio = activeTargetSections.length
    ? round1(Math.max(...activeTargetSections.map((section) => section.ratio)))
    : 0;
  const maxTargetSectionUnits = activeTargetSections.length
    ? Math.max(...activeTargetSections.map((section) => section.targetUnits))
    : 0;
  const maxTargetSectionShare = targetUnits > 0 ? round1((maxTargetSectionUnits / targetUnits) * 100) : 0;
  const maxAllowedTargetSectionShare = requestedRatio <= 20 ? 55 : requestedRatio <= 50 ? 45 : 40;
  const overloadedTargetSectionCount = sectionTargetRatios.filter((section) =>
    section.ratio >= Math.min(95, requestedRatio + 35)
    || (targetUnits > 0 && (section.targetUnits / targetUnits) * 100 > maxAllowedTargetSectionShare),
  ).length;

  let currentTargetLineRun = 0;
  let maxTargetLineRunLength = 0;
  let currentTargetOnlyRun = 0;
  let maxTargetOnlyRunLength = 0;
  let currentHookTargetRun = 0;
  let maxHookTargetOnlyRunLength = 0;
  let mixedLanguageLineCount = 0;
  let isolatedTargetLineCount = 0;
  const targetExpressions: string[] = [];
  const lineMeasurements = lineEntries.map(({ line }) => measureV1LineLanguageOccupancy(line, baseLanguage, targetLanguages));
  const isKeywordAnchorLine = (line: ReturnType<typeof measureV1LineLanguageOccupancy>): boolean =>
    line.mixed
    && line.targetChunkCount === 1
    && (requestedRatio === 5
      ? line.targetTokenCount >= 1 && line.targetTokenCount <= 3 && line.targetPerformanceUnits <= 6
      : line.targetTokenCount === 1 && line.targetPerformanceUnits <= 5);
  const isShortPhraseLine = (line: ReturnType<typeof measureV1LineLanguageOccupancy>): boolean =>
    line.mixed
    && line.targetChunkCount === 1
    && (requestedRatio === 5
      ? line.targetTokenCount >= 2
        && line.targetTokenCount <= 8
        && line.targetPerformanceUnits >= 6
        && line.targetPerformanceUnits <= 16
      : line.targetTokenCount >= 2
        && line.targetTokenCount <= 6
        && line.targetPerformanceUnits <= 10)
    && !isKeywordAnchorLine(line);
  const keywordAnchorLineCount = lineMeasurements.filter(isKeywordAnchorLine).length;
  const shortPhraseLineCount = lineMeasurements.filter(isShortPhraseLine).length;
  const extendedPhraseLineCount = lineMeasurements.filter((line) =>
    line.mixed
    && !isKeywordAnchorLine(line)
    && !isShortPhraseLine(line)).length;
  const lineTargetFlags = lineEntries.map(({ section, line }, index) => {
    const measured = lineMeasurements[index];
    const hookLike = isHookSectionName(section);
    const sectionChanged = index > 0 && lineEntries[index - 1].section !== section;
    if (sectionChanged) {
      currentTargetLineRun = 0;
      currentTargetOnlyRun = 0;
      currentHookTargetRun = 0;
    }
    if (measured.mixed) mixedLanguageLineCount += 1;
    if (measured.hasTarget) {
      currentTargetLineRun += 1;
      maxTargetLineRunLength = Math.max(maxTargetLineRunLength, currentTargetLineRun);
      const normalizedExpression = line
        .toLowerCase()
        .replace(/[^a-zà-öø-ÿā-žẁ-ỿ가-힣ㄱ-ㅎㅏ-ㅣ\u3040-\u30ff\u31f0-\u31ff\u3400-\u9fff\u0400-\u04ff\u0e00-\u0e7f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (normalizedExpression) targetExpressions.push(normalizedExpression);
    }
    if (!measured.hasTarget) currentTargetLineRun = 0;
    if (measured.targetOnly) {
      currentTargetOnlyRun += 1;
      maxTargetOnlyRunLength = Math.max(maxTargetOnlyRunLength, currentTargetOnlyRun);
      if (hookLike) {
        currentHookTargetRun += 1;
        maxHookTargetOnlyRunLength = Math.max(maxHookTargetOnlyRunLength, currentHookTargetRun);
      } else {
        currentHookTargetRun = 0;
      }
      return 'target';
    }
    currentTargetOnlyRun = 0;
    currentHookTargetRun = 0;
    return measured.mixed ? 'mixed' : 'base';
  });

  lineTargetFlags.forEach((flag, index) => {
    if (flag !== 'target') return;
    const previousTarget = lineTargetFlags[index - 1] !== undefined
      && lineTargetFlags[index - 1] !== 'base'
      && lineEntries[index - 1]?.section === lineEntries[index]?.section;
    const nextTarget = lineTargetFlags[index + 1] !== undefined
      && lineTargetFlags[index + 1] !== 'base'
      && lineEntries[index + 1]?.section === lineEntries[index]?.section;
    if (!previousTarget && !nextTarget) isolatedTargetLineCount += 1;
  });

  let targetBlockCount = 0;
  let targetBlockLineTotal = 0;
  let blockLength = 0;
  lineTargetFlags.forEach((flag, index) => {
    const sectionChanged = index > 0 && lineEntries[index - 1].section !== lineEntries[index].section;
    if (sectionChanged && blockLength > 0) {
      targetBlockCount += 1;
      targetBlockLineTotal += blockLength;
      blockLength = 0;
    }
    if (flag !== 'base') {
      blockLength += 1;
      if (index === lineTargetFlags.length - 1) {
        targetBlockCount += 1;
        targetBlockLineTotal += blockLength;
      }
      return;
    }
    if (blockLength > 0) {
      targetBlockCount += 1;
      targetBlockLineTotal += blockLength;
      blockLength = 0;
    }
  });
  const averageTargetBlockLength = targetBlockCount > 0 ? round1(targetBlockLineTotal / targetBlockCount) : 0;

  let alternatingSequenceCount = 0;
  for (let index = 0; index <= lineTargetFlags.length - 4; index += 1) {
    const sectionNames = lineEntries.slice(index, index + 4).map((entry) => entry.section);
    if (new Set(sectionNames).size > 1) continue;
    const sequence = lineTargetFlags.slice(index, index + 4).map((flag) => flag === 'target' ? 'T' : flag === 'base' ? 'B' : 'M').join('');
    if (sequence === 'BTBT' || sequence === 'TBTB') alternatingSequenceCount += 1;
  }
  const maxAllowedAlternatingSequences = 0;
  const duplicateTargetExpressionCount = targetExpressions.reduce((count, expression, index) =>
    count + (targetExpressions.indexOf(expression) !== index ? 1 : 0), 0);

  const zoneLength = Math.max(1, Math.ceil(sections.length / 3));
  const zoneSlices = [
    sectionTargetRatios.slice(0, zoneLength),
    sectionTargetRatios.slice(zoneLength, Math.max(zoneLength + 1, sections.length - zoneLength)),
    sectionTargetRatios.slice(Math.max(0, sections.length - zoneLength)),
  ];
  const zoneTargetUnits = zoneSlices.map((zone) => zone.reduce((sum, section) => sum + section.targetUnits, 0));
  const earlyTargetPresent = zoneTargetUnits[0] > 0;
  const middleTargetPresent = zoneTargetUnits[1] > 0;
  const lateTargetPresent = zoneTargetUnits[2] > 0;
  const targetTimelineZoneCount = zoneTargetUnits.filter((units) => units > 0).length;
  const maxTargetTimelineZoneShare = targetUnits > 0 ? round1((Math.max(...zoneTargetUnits) / targetUnits) * 100) : 0;
  const maxAllowedTargetTimelineZoneShare = requestedRatio <= 20 ? 70 : requestedRatio <= 50 ? 60 : 55;

  const requiredTargetSectionCount = requestedRatio <= 10
    ? Math.min(2, Math.max(1, sections.length))
    : requestedRatio <= 20
      ? Math.min(3, Math.max(2, sections.length))
      : Math.min(4, Math.max(2, sections.length));
  const maxTargetSectionCount = requestedRatio === 5
    ? Math.min(3, sections.length)
    : requestedRatio <= 10
      ? Math.min(4, sections.length)
      : requestedRatio <= 20
        ? Math.min(5, sections.length)
        : Math.min(8, sections.length);
  const requiredTimelineZoneCount = requestedRatio <= 10 ? 2 : 3;
  const maxAllowedTargetLineRunLength = requestedRatio <= 10 ? 2 : requestedRatio <= 20 ? 4 : Number.MAX_SAFE_INTEGER;
  const maxAllowedTargetOnlyRunLength = requestedRatio <= 20 ? 0 : requestedRatio <= 50 ? 6 : 7;
  const maxAllowedHookTargetOnlyRunLength = requestedRatio <= 20 ? 0 : requestedRatio <= 50 ? 4 : 5;
  const lowRatioIdealShare = requestedRatio <= 10 ? 0.42 : 0.52;
  const expectedLowRatioMixedLineCount = requestedRatio <= 20
    ? Math.max(1, Math.ceil(((overall.sungLineCount * requestedRatio) / 100) / lowRatioIdealShare))
    : 0;
  const maxAllowedMixedLanguageLineCount = requestedRatio === 5
    ? Math.min(5, Math.max(3, overall.sungLineCount))
    : requestedRatio <= 20
      ? Math.max(3, Math.ceil(expectedLowRatioMixedLineCount * 1.2))
      : Number.MAX_SAFE_INTEGER;

  const hookFamilyName = (section: string): string | null => {
    if (/pre[-\s]?chorus/i.test(section)) return null;
    if (/chorus/i.test(section)) return 'chorus';
    if (/hook/i.test(section)) return 'hook';
    if (/refrain/i.test(section)) return 'refrain';
    if (/drop/i.test(section)) return 'drop';
    return null;
  };
  const hookFamilySections = new Map<string, ParsedLyricSection[]>();
  sections.forEach((section) => {
    const family = hookFamilyName(section.name);
    if (!family) return;
    const list = hookFamilySections.get(family) || [];
    list.push(section);
    hookFamilySections.set(family, list);
  });
  const repeatedHookFamily = Array.from(hookFamilySections.entries())
    .filter(([, familySections]) => familySections.length >= 2)
    .sort(([familyA, sectionsA], [familyB, sectionsB]) => {
      const score = (family: string) => family === 'chorus' ? 100 : family === 'hook' ? 80 : family === 'refrain' ? 60 : 40;
      return (score(familyB) + sectionsB.length * 10) - (score(familyA) + sectionsA.length * 10);
    })[0] || null;
  let repeatedHookPatternPassed = !repeatedHookFamily;
  let repeatedHookTargetSlotCount = 0;
  let repeatedHookAnchorMismatchCount = 0;
  if (repeatedHookFamily) {
    const [, familySections] = repeatedHookFamily;
    const targetPositionsBySection = familySections.map((section) => section.lines
      .map((line, index) => measureV1LineLanguageOccupancy(line, baseLanguage, targetLanguages).hasTarget ? index : -1)
      .filter((index) => index >= 0));
    const anyHookTarget = targetPositionsBySection.some((positions) => positions.length > 0);
    if (anyHookTarget) {
      const signature = targetPositionsBySection[0].join(',');
      repeatedHookPatternPassed = targetPositionsBySection.every((positions) => positions.join(',') === signature);
      const sharedPositions = targetPositionsBySection[0];
      repeatedHookTargetSlotCount = sharedPositions.length;
      sharedPositions.forEach((position) => {
        const anchors = familySections.map((section) => extractV1TargetLanguageTokens(
          section.lines[position] || '',
          baseLanguage,
          targetLanguages,
        ).join(' '));
        const firstAnchor = anchors[0] || '';
        if (!firstAnchor || anchors.some((anchor) => anchor !== firstAnchor)) {
          repeatedHookPatternPassed = false;
          repeatedHookAnchorMismatchCount += 1;
        }
      });
    } else {
      repeatedHookPatternPassed = false;
    }
  }

  const repeatedHookSectionNames = new Set(repeatedHookFamily ? repeatedHookFamily[1].map((section) => section.name) : []);
  const activeRepeatedHookSectionCount = activeTargetSections.filter((section) => repeatedHookSectionNames.has(section.section)).length;
  const logicalTargetSectionCount = Math.max(
    0,
    activeTargetSections.length - Math.max(0, activeRepeatedHookSectionCount - 1),
  );

  const hookTargetPresent = sectionTargetRatios.some((section) => isHookSectionName(section.section) && section.targetUnits > 0);
  const finalRecallPresent = sectionTargetRatios.some((section) => /final\s+(?:chorus|hook)|outro/i.test(section.section) && section.targetUnits > 0);
  const finalHookSectionExists = sections.some((section) => /final\s+(?:chorus|hook)/i.test(section.name));
  const finalHookRecallPresent = sections.some((section) =>
    /final\s+(?:chorus|hook)/i.test(section.name)
    && measureV1SungLanguageOccupancy(section.lines.join('\n'), baseLanguage, targetLanguages).targetPerformanceUnits > 0);
  const abruptTakeoverCount = sectionTargetRatios.reduce((count, section, index) => {
    if (section.ratio < 90) return count;
    const previousRatio = sectionTargetRatios[index - 1]?.ratio ?? 0;
    const nextRatio = sectionTargetRatios[index + 1]?.ratio ?? 0;
    return count + (previousRatio <= 10 && nextRatio <= 10 ? 1 : 0);
  }, 0);

  const reasons: string[] = [];
  const ratioPassed = actualMixRatio >= lowerBound && actualMixRatio <= upperBound;
  if (!ratioPassed) reasons.push(`실제 가창 분량 비율 ${actualMixRatio}%가 권장 범위 ${lowerBound}~${upperBound}%를 벗어났습니다.`);
  if (!targetLanguageCoveragePassed) {
    reasons.push(`다중 혼합 언어 중 ${missingTargetLanguages.join(', ')}의 실제 가창 분량이 최소 기준에 미달했습니다.`);
  }
  if (requestedRatio <= 20 && maxTargetSectionRatio >= 80) reasons.push('낮은 혼합 비율인데 특정 섹션이 혼합 언어에 과도하게 점유되었습니다.');
  if (logicalTargetSectionCount < requiredTargetSectionCount) reasons.push(`반복 후렴을 하나의 패턴으로 계산했을 때 혼합 언어가 ${logicalTargetSectionCount}개 역할 구간에만 나타나 권장 분포 ${requiredTargetSectionCount}개보다 좁습니다.`);
  if (requestedRatio <= 20 && logicalTargetSectionCount > maxTargetSectionCount) reasons.push('5~20% 구간의 혼합 문장이 너무 많은 역할 구간에 흩어져 곡의 중심이 흐려질 수 있습니다.');
  if (maxTargetSectionShare > maxAllowedTargetSectionShare) reasons.push('혼합 언어 가창 분량 대부분이 한 섹션에 집중되어 있습니다.');
  if (targetTimelineZoneCount < requiredTimelineZoneCount) reasons.push('혼합 언어가 곡의 전·중·후 흐름에 충분히 분산되지 않았습니다.');
  if (maxTargetTimelineZoneShare > maxAllowedTargetTimelineZoneShare) reasons.push('혼합 언어가 곡의 한 시간 구간에 과도하게 몰려 있습니다.');
  if (alternatingSequenceCount > maxAllowedAlternatingSequences) reasons.push('한글과 혼합 언어가 한 줄씩 기계적으로 교차하는 구간이 있습니다.');
  if (isolatedTargetLineCount >= 3) reasons.push('고립된 혼합 언어 한 줄이 반복되어 기계적인 포인트처럼 들릴 수 있습니다.');
  if (requestedRatio > 20 && targetBlockCount > 0 && averageTargetBlockLength < 1.6) reasons.push('높은 혼합 비율인데 혼합 언어가 짧은 한 줄 단위로 흩어져 있습니다.');
  if (maxTargetOnlyRunLength > maxAllowedTargetOnlyRunLength) reasons.push('혼합 언어만 이어지는 구간이 선택 비율에 비해 너무 깁니다.');
  if (maxHookTargetOnlyRunLength > maxAllowedHookTargetOnlyRunLength) reasons.push('후렴에서 혼합 언어만 이어지는 길이가 과도합니다.');
  if (abruptTakeoverCount > 0) reasons.push('앞뒤 맥락 없이 한 섹션이 갑자기 혼합 언어 중심으로 바뀝니다.');
  const targetOnlyLineCount = lineMeasurements.filter((line) => line.targetOnly).length;
  if (requestedRatio <= 20 && targetOnlyLineCount > 0) reasons.push('5~20% K-pop 모드에서는 완전한 외국어 줄 대신 한 줄 내부 코드 스위칭을 사용해야 합니다.');
  if (requestedRatio <= 20 && actualMixRatio > 0 && mixedLanguageLineCount < Math.min(3, Math.max(1, activeTargetSections.length))) {
    reasons.push('5~20% K-pop 모드의 한 줄 내부 코드 스위칭 수가 부족합니다.');
  }
  if (requestedRatio <= 20 && mixedLanguageLineCount > maxAllowedMixedLanguageLineCount) {
    reasons.push('선택 비율에 비해 너무 많은 가사 줄이 언어혼합으로 바뀌어 곡 전체가 산만해질 수 있습니다.');
  }
  if (requestedRatio <= 20 && maxTargetLineRunLength > maxAllowedTargetLineRunLength) {
    reasons.push('한 섹션 안에서 언어혼합 줄이 연속으로 과도하게 이어집니다.');
  }
  if (requestedRatio <= 20 && actualMixRatio > 0 && keywordAnchorLineCount < 1) {
    reasons.push('K-pop 언어혼합에 의미·라임을 잡아주는 핵심 단어형 앵커가 없습니다.');
  }
  if (requestedRatio <= 20 && actualMixRatio > 0 && shortPhraseLineCount < 1) {
    reasons.push('K-pop 언어혼합에 짧은 구절형 코드 스위칭이 없습니다.');
  }
  if (requestedRatio <= 20 && hookTargetPresent && repeatedHookFamily && !repeatedHookPatternPassed) {
    reasons.push('반복 후렴의 언어혼합 위치 또는 핵심 외국어 앵커가 후렴마다 달라집니다.');
  }
  if (requestedRatio <= 20 && hookTargetPresent && finalHookSectionExists && !finalHookRecallPresent) {
    reasons.push('앞선 후렴에 사용한 언어혼합 앵커가 Final Chorus/Hook에서 사라졌습니다.');
  }

  const placementPassed = reasons.length === 0;
  // 145차: 이번 단계의 통과 기준은 전체 가창 분량이다. 배치 품질은 별도 진단으로 남긴다.
  const status = ratioPassed && targetLanguageCoveragePassed ? 'passed' : 'needs-review';

  return {
    active: Boolean(totalLexicalUnits && targetLanguages.length),
    baseLanguage,
    targetLanguages,
    requestedRatio,
    lowerBound,
    upperBound,
    actualMixRatio,
    actualBaseRatio,
    totalLexicalUnits,
    totalPerformanceUnits: totalLexicalUnits,
    sungLineCount: overall.sungLineCount,
    languageUnits,
    languageRatios,
    targetGoals,
    targetLanguageMinimums,
    targetLanguageCoveragePassed,
    missingTargetLanguages,
    unitPolicy: 'estimated-sung-syllable-occupancy',
    placementMode: placementMode(requestedRatio),
    targetBlockCount,
    averageTargetBlockLength,
    targetOnlyLineCount,
    targetSectionCount: activeTargetSections.length,
    logicalTargetSectionCount,
    requiredTargetSectionCount,
    maxTargetSectionCount,
    maxTargetSectionRatio,
    maxTargetSectionShare,
    maxAllowedTargetSectionShare,
    overloadedTargetSectionCount,
    targetTimelineZoneCount,
    requiredTimelineZoneCount,
    maxTargetTimelineZoneShare,
    maxAllowedTargetTimelineZoneShare,
    earlyTargetPresent,
    middleTargetPresent,
    lateTargetPresent,
    hookTargetPresent,
    finalRecallPresent,
    mixedLanguageLineCount,
    keywordAnchorLineCount,
    shortPhraseLineCount,
    extendedPhraseLineCount,
    repeatedHookPatternPassed,
    repeatedHookTargetSlotCount,
    repeatedHookAnchorMismatchCount,
    finalHookSectionExists,
    finalHookRecallPresent,
    maxAllowedMixedLanguageLineCount,
    maxTargetLineRunLength,
    maxAllowedTargetLineRunLength,
    isolatedTargetLineCount,
    maxTargetOnlyRunLength,
    maxAllowedTargetOnlyRunLength,
    maxHookTargetOnlyRunLength,
    maxAllowedHookTargetOnlyRunLength,
    abruptTakeoverCount,
    alternatingSequenceCount,
    maxAllowedAlternatingSequences,
    mirroredTranslationPairCount: 0,
    maxAllowedMirroredPairs: 0,
    duplicateTargetExpressionCount,
    repairApplied: false,
    replacedLineCount: 0,
    sectionCoverageIsReference: true,
    placementPassed,
    languageArcPassed: targetTimelineZoneCount >= requiredTimelineZoneCount,
    status,
    reasons,
  };
}

export function buildV1PublicLanguageMixAudit(input: V1PublicLanguageMixAuditInput): Record<string, unknown> {
  const requestedRatio = normalizeRatio(input.requestedRatio);
  const targetLanguages = Array.from(new Set(input.targetLanguages || []));
  const cards: Record<string, unknown> = {};

  if (input.koreanCardEnabled && String(input.koreanLyrics || '').trim()) {
    const koreanCardLanguage = input.koreanCardLanguage || 'ko';
    cards.korean = {
      card: 'korean',
      ...buildCardAudit(
        String(input.koreanLyrics || ''),
        koreanCardLanguage,
        targetLanguages.filter((language) => language !== koreanCardLanguage),
        requestedRatio,
      ),
    };
  }

  if (input.secondaryCardEnabled && String(input.secondaryLyrics || '').trim()) {
    const secondaryLanguage = input.secondaryLanguage || 'en';
    const secondaryTargets = Array.from(new Set([
      ...(targetLanguages.includes(secondaryLanguage) ? ['ko' as V1LanguageCode] : []),
      ...targetLanguages.filter((language) => language !== secondaryLanguage),
    ])).slice(0, 2);
    cards.secondary = {
      card: 'secondary',
      ...buildCardAudit(String(input.secondaryLyrics || ''), secondaryLanguage, secondaryTargets, requestedRatio),
    };
  }

  const activeCards = Object.values(cards).filter((card) => Boolean((card as Record<string, unknown>).active));
  const statuses = activeCards.map((card) => String((card as Record<string, unknown>).status || 'inactive'));
  return {
    active: activeCards.length > 0,
    requestedRatio,
    targetLanguages,
    status: !activeCards.length
      ? 'inactive'
      : statuses.every((status) => status === 'passed')
        ? 'passed'
        : 'needs-review',
    measurement: 'final-estimated-sung-syllable-occupancy-ratio',
    qualityBasis: requestedRatio <= 20 ? 'kpop-sound-rhyme-stress-breath' : 'ratio-strategy',
    grammarPolicy: requestedRatio <= 20 ? 'not-a-pass-fail-condition' : 'strategy-dependent',
    unitPolicy: 'estimated sung syllables; mixed lines use base/target performance occupancy',
    excludes: ['section tags', 'performance cues', 'production cues', 'blank lines', 'raw alphabet length'],
    cards,
  };
}
