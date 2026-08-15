import { getV1SectionBlueprint, type V1SectionEngineParams } from './sectionBlueprint';
import { normalizeV1SectionName } from './sectionRegistry';

export type V1HookRoleFamily = 'chorus' | 'hook' | 'main-theme' | 'refrain' | 'theme' | 'none';
export type V1DropHookPlacementMode = 'existing-drop' | 'embedded-hook' | 'target-missing';

export interface V1HookRolePlan {
  mode: 'recommended' | 'stable' | 'experimental' | 'custom';
  profile: string;
  family: V1HookRoleFamily;
  hookSectionNames: string[];
  hookSectionLabels: string[];
  finalHookSectionName: string;
  preparationSectionNames: string[];
  introSectionNames: string[];
  outroSectionNames: string[];
  refrainSectionNames: string[];
  circularSectionNames: string[];
  circularSectionLabels: string[];
  dropSectionNames: string[];
  embeddedDropSectionNames: string[];
  embeddedDropSectionLabels: string[];
  dropPlacementMode: V1DropHookPlacementMode;
  targetSectionsText: string;
  structureCondition: string;
  dropCondition: string;
  circularCondition: string;
}

function labelOccurrences(values: string[]): string[] {
  const totals = new Map<string, number>();
  values.forEach((value) => {
    const key = sectionKey(value);
    totals.set(key, (totals.get(key) || 0) + 1);
  });
  const seen = new Map<string, number>();
  return values.map((value) => {
    const key = sectionKey(value);
    if ((totals.get(key) || 0) <= 1) return value;
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    return `${value} ${occurrence}`;
  });
}

function sectionKey(value: string): string {
  return normalizeV1SectionName(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function matches(value: string, pattern: RegExp): boolean {
  return pattern.test(normalizeV1SectionName(String(value || '')));
}

function findPrimaryFamily(
  names: string[],
  profile: string,
): { family: V1HookRoleFamily; primary: string[] } {
  const byFamily: Record<Exclude<V1HookRoleFamily, 'none'>, string[]> = {
    chorus: names.filter((name) => matches(name, /^Chorus(?:\s+\d+)?$/i)),
    hook: names.filter((name) => matches(name, /^Hook(?:\s+\d+)?$/i)),
    'main-theme': names.filter((name) => matches(name, /^Main\s+Theme(?:\s+\d+)?$/i)),
    refrain: names.filter((name) => matches(name, /^Refrain(?:\s+\d+)?$/i)),
    theme: names.filter((name) => matches(name, /^Theme\s+A(?:\s+\d+)?$/i)),
  };

  // Recommended/Experimental profiles have different musical centers. Narrative structures
  // intentionally revolve around Refrain returns, while cinematic structures establish a
  // Theme/Main Theme and pay it off at Climax. Other profiles keep Chorus/Hook priority.
  const priority: Array<Exclude<V1HookRoleFamily, 'none'>> = profile === 'narrative'
    ? ['refrain', 'chorus', 'hook', 'main-theme', 'theme']
    : profile === 'cinematic'
      ? ['main-theme', 'theme', 'chorus', 'hook', 'refrain']
      : profile === 'rap'
        ? ['hook', 'chorus', 'refrain', 'main-theme', 'theme']
        : ['chorus', 'hook', 'refrain', 'main-theme', 'theme'];

  for (const family of priority) {
    if (byFamily[family].length) return { family, primary: byFamily[family] };
  }
  return { family: 'none', primary: [] };
}

function resolveFinalPayoff(names: string[], family: V1HookRoleFamily): string {
  const preferred = family === 'hook'
    ? [/^Final\s+Hook(?:\s+\d+)?$/i, /^Climax(?:\s+\d+)?$/i, /^Final\s+Chorus(?:\s+\d+)?$/i]
    : family === 'main-theme' || family === 'theme'
      ? [/^Climax(?:\s+\d+)?$/i, /^Final\s+Chorus(?:\s+\d+)?$/i, /^Final\s+Hook(?:\s+\d+)?$/i]
      : [/^Final\s+Chorus(?:\s+\d+)?$/i, /^Final\s+Hook(?:\s+\d+)?$/i, /^Climax(?:\s+\d+)?$/i];

  for (const pattern of preferred) {
    const found = [...names].reverse().find((name) => matches(name, pattern));
    if (found) return found;
  }
  return '';
}

function resolvePreparationNames(names: string[], firstHookName: string): string[] {
  if (!firstHookName) return [];
  const firstIndex = names.findIndex((name) => sectionKey(name) === sectionKey(firstHookName));
  if (firstIndex <= 0) return [];

  const directLift = names
    .slice(0, firstIndex)
    .filter((name) => matches(name, /^(?:Pre[-\s]?Chorus|Build[-\s]?Up)(?:\s+\d+)?$/i));
  if (directLift.length) return [directLift[directLift.length - 1]];

  const fallback = [...names.slice(0, firstIndex)].reverse().find((name) =>
    !matches(name, /^(?:Intro|Instrumental|Interlude|Break|Stop|Drop|Outro)(?:\s+\d+)?$/i),
  );
  return fallback ? [fallback] : [];
}

function resolveCircularSections(
  names: string[],
  hookNames: string[],
  refrainNames: string[],
  introNames: string[],
  outroNames: string[],
  finalHookName: string,
): string[] {
  if (!hookNames.length && !refrainNames.length) return [];
  if (refrainNames.length >= 2) {
    return [...refrainNames, finalHookName, ...outroNames].filter(Boolean);
  }
  if (refrainNames.length === 1) {
    const distinctFinal = finalHookName
      && sectionKey(finalHookName) !== sectionKey(refrainNames[0])
      ? finalHookName
      : '';
    return [...introNames, ...refrainNames, distinctFinal, ...outroNames].filter(Boolean);
  }
  return [...introNames, ...hookNames, ...outroNames].filter(Boolean);
}

function humanMode(mode: V1HookRolePlan['mode']): string {
  if (mode === 'stable') return '안정형';
  if (mode === 'recommended') return '추천';
  if (mode === 'experimental') return '실험형';
  return '커스텀';
}

function humanFamily(family: V1HookRoleFamily): string {
  if (family === 'chorus') return 'Chorus 계열';
  if (family === 'hook') return 'Hook 계열';
  if (family === 'main-theme') return 'Main Theme 계열';
  if (family === 'refrain') return 'Refrain 계열';
  if (family === 'theme') return 'Theme → Climax 계열';
  return '핵심 훅 구간 없음';
}

export function resolveV1HookRolePlan(params: V1SectionEngineParams): V1HookRolePlan {
  const blueprint = getV1SectionBlueprint(params);
  const names = blueprint.entries.map((entry) => entry.name);
  const resolvedPrimary = findPrimaryFamily(names, String(blueprint.profile));
  let family = resolvedPrimary.family;
  const primary = resolvedPrimary.primary;
  if (family === 'none') {
    if (names.some((name) => matches(name, /^Final\s+Chorus(?:\s+\d+)?$/i))) family = 'chorus';
    else if (names.some((name) => matches(name, /^Final\s+Hook(?:\s+\d+)?$/i))) family = 'hook';
    else if (names.some((name) => matches(name, /^Climax(?:\s+\d+)?$/i))) family = 'theme';
  }
  const finalHookSectionName = resolveFinalPayoff(names, family);
  const hookSectionNames = [...primary, finalHookSectionName].filter(Boolean);
  const hookSectionLabels = labelOccurrences(hookSectionNames);
  const preparationSectionNames = resolvePreparationNames(names, hookSectionNames[0] || '');
  const introSectionNames = names.filter((name) => matches(name, /^Intro(?:\s+\d+)?$/i));
  const outroSectionNames = names.filter((name) => matches(name, /^Outro(?:\s+\d+)?$/i));
  const refrainSectionNames = names.filter((name) => matches(name, /^Refrain(?:\s+\d+)?$/i));
  const dropSectionNames = names.filter((name) => matches(name, /^Drop(?:\s+\d+)?$/i));
  const circularSectionNames = resolveCircularSections(
    names,
    hookSectionNames,
    refrainSectionNames,
    introSectionNames,
    outroSectionNames,
    finalHookSectionName,
  );
  const circularSectionLabels = labelOccurrences(circularSectionNames);

  const embeddedDropSectionNames = dropSectionNames.length
    ? []
    : hookSectionNames.length
      // An embedded Drop is a single automatically chosen release point, not a forced tail
      // repeated after every hook return. The first primary target is the safest transition
      // into the next act; if only a final payoff exists, that one is used.
      ? [hookSectionNames[0]]
      : [];
  const embeddedDropSectionLabels = embeddedDropSectionNames.length
    ? [hookSectionLabels[0] || embeddedDropSectionNames[0]]
    : [];
  const dropPlacementMode: V1DropHookPlacementMode = dropSectionNames.length
    ? 'existing-drop'
    : embeddedDropSectionNames.length
      ? 'embedded-hook'
      : 'target-missing';

  const targetSectionsText = hookSectionLabels.length
    ? hookSectionLabels.join(' · ')
    : '적용 가능한 핵심 훅 구간 없음';
  const structureCondition = hookSectionNames.length
    ? `${humanMode(blueprint.mode)} 구조의 ${humanFamily(family)}에 적용`
    : `${humanMode(blueprint.mode)} 구조에 Chorus·Hook·Refrain·Main Theme·Theme/Climax 연결 대상이 없음`;
  const dropCondition = dropPlacementMode === 'existing-drop'
    ? `기존 ${labelOccurrences(dropSectionNames).join(' · ')}에 적용`
    : dropPlacementMode === 'embedded-hook'
      ? `별도 Drop을 추가하지 않고 ${embeddedDropSectionLabels.join(' · ')} 끝부분에 내장형 드롭 훅 적용`
      : 'Drop도 핵심 훅 구간도 없어 적용 대상 부족';
  const circularCondition = circularSectionLabels.length >= 2
    ? `${circularSectionLabels.join(' → ')}에서 같은 핵심 문구를 회수`
    : '순환시킬 서로 떨어진 구간이 부족함';

  return {
    mode: blueprint.mode,
    profile: String(blueprint.profile),
    family,
    hookSectionNames,
    hookSectionLabels,
    finalHookSectionName,
    preparationSectionNames,
    introSectionNames,
    outroSectionNames,
    refrainSectionNames,
    circularSectionNames,
    circularSectionLabels,
    dropSectionNames,
    embeddedDropSectionNames,
    embeddedDropSectionLabels,
    dropPlacementMode,
    targetSectionsText,
    structureCondition,
    dropCondition,
    circularCondition,
  };
}

export function isV1HookRoleSectionName(value: string, plan: V1HookRolePlan): boolean {
  const key = sectionKey(value);
  return plan.hookSectionNames.some((name) => sectionKey(name) === key);
}

export function isV1CircularRoleSectionName(value: string, plan: V1HookRolePlan): boolean {
  const key = sectionKey(value);
  return plan.circularSectionNames.some((name) => sectionKey(name) === key);
}

export function isV1EmbeddedDropRoleSectionName(value: string, plan: V1HookRolePlan): boolean {
  const key = sectionKey(value);
  return plan.embeddedDropSectionNames.some((name) => sectionKey(name) === key);
}
