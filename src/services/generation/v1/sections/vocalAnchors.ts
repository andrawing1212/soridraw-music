import type { VocalMember, VocalRole } from '../../../../types';

export interface V1VocalAnchorConfig {
  rap?: boolean;
  male?: number;
  female?: number;
  mode?: 'solo' | 'duo' | 'group' | string;
  members?: VocalMember[];
}

export interface V1VocalAnchorDescriptor {
  id: string;
  gender: 'male' | 'female';
  genderLabel: 'Male' | 'Female';
  roleLabel: string;
  promptAnchor: string;
  sectionAnchor: string;
}

function defaultRole(index: number, total: number, rapEnabled: boolean): string {
  if (total <= 2) return index === 0 ? 'Main' : (rapEnabled ? 'Rap/Lead' : 'Lead');
  if (total === 3) {
    if (index === 0) return 'Main';
    if (index === 1) return 'Lead';
    return rapEnabled ? 'Sub/Rap' : 'Sub';
  }
  if (total === 4) {
    if (index === 0) return 'Main';
    if (index === 1) return 'Lead';
    if (index === 2) return rapEnabled ? 'Rap' : 'Sub';
    return 'Sub';
  }
  if (index === 0) return 'Main';
  if (index === 1) return 'Lead';
  if (index === 2 || index === 3) return 'Rap';
  return 'Sub';
}

function normalizeRole(role: VocalRole | string): string {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('main')) return 'Main';
  if (value.includes('lead')) return 'Lead';
  if (value.includes('rapper') || value === 'rap' || value.includes('rap vocal')) return 'Rap';
  if (value.includes('sub')) return 'Sub';
  return '';
}

const ROLE_DISPLAY_PRIORITY: Record<string, number> = {
  Rap: 0,
  Main: 1,
  Lead: 2,
  Sub: 3,
};

function resolveRoleLabel(member: VocalMember | undefined, index: number, total: number, rapEnabled: boolean): string {
  const explicit = Array.isArray(member?.roles)
    ? member!.roles.map(normalizeRole).filter(Boolean)
    : [];
  const unique = Array.from(new Set(explicit))
    .sort((a, b) => (ROLE_DISPLAY_PRIORITY[a] ?? 99) - (ROLE_DISPLAY_PRIORITY[b] ?? 99));
  return unique.length ? unique.join('/') : defaultRole(index, total, rapEnabled);
}

export function resolveV1VocalTotal(vocal?: V1VocalAnchorConfig): number {
  const members = Array.isArray(vocal?.members) ? vocal!.members!.filter(Boolean) : [];
  const male = Math.max(0, Number(vocal?.male || 0));
  const female = Math.max(0, Number(vocal?.female || 0));
  const selectedCount = male + female;
  const mode = String(vocal?.mode || '').toLowerCase();

  // Explicit selected members are the source of truth. A UI group label must never inflate
  // two selected people into a synthetic third singer. Gender counts are the next-best source;
  // mode defaults are used only when no explicit population data exists.
  if (members.length > 0) return members.length;
  if (selectedCount > 0) return selectedCount;
  if (mode === 'duo') return 2;
  if (mode === 'group') return 3;
  return 1;
}

export function resolveV1VocalAnchorDescriptors(vocal?: V1VocalAnchorConfig): V1VocalAnchorDescriptor[] {
  const total = resolveV1VocalTotal(vocal);
  if (total < 2) return [];

  const members = Array.isArray(vocal?.members) ? vocal!.members! : [];
  const male = Math.max(0, Number(vocal?.male || 0));
  const female = Math.max(0, Number(vocal?.female || 0));
  const fallbackGenders: Array<'male' | 'female'> = [
    ...Array.from({ length: male }, () => 'male' as const),
    ...Array.from({ length: female }, () => 'female' as const),
  ];
  const allFemaleFallback = female > 0 && male === 0;

  return Array.from({ length: Math.min(total, 26) }, (_unused, index) => {
    const member = members[index];
    const gender: 'male' | 'female' = member?.gender
      || fallbackGenders[index]
      || (allFemaleFallback ? 'female' : 'male');
    const genderLabel = gender === 'female' ? 'Female' : 'Male';
    const id = String.fromCharCode(65 + index);
    const roleLabel = resolveRoleLabel(member, index, total, Boolean(vocal?.rap));
    return {
      id,
      gender,
      genderLabel,
      roleLabel,
      promptAnchor: `${id}: ${genderLabel} ${roleLabel}`,
      sectionAnchor: `${genderLabel} ${id} ${roleLabel}`,
    };
  });
}
