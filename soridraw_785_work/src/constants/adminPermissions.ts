import type { AdminPermissionKey, AdminPermissions, StaffRole, UserRole } from '../types';

export const ADMIN_PERMISSION_DEFINITIONS = [
  { key: 'userManagement', label: '회원 관리', description: '회원 정보, 접속 상태와 계정 관리', path: '/admin/users' },
  { key: 'vocalManagement', label: '보컬 관리', description: '보컬 톤 데이터 생성·수정·삭제', path: '/admin/vocals' },
  { key: 'sectionTagManagement', label: '섹션 태그', description: '섹션 태그와 가창 큐 관리', path: '/admin/tags' },
  { key: 'sunoApiManagement', label: 'Suno API', description: 'Suno API 설정과 테스트', path: '/admin/suno-api' },
  { key: 'appSettings', label: '앱 설정', description: '메뉴 노출과 전체 앱 설정', path: '/admin/app-settings' },
  { key: 'geminiAudit', label: 'Gemini 호출', description: '이 기기의 Gemini 호출 감사 기록', path: '/admin/gemini-audit' },
] as const satisfies ReadonlyArray<{ key: AdminPermissionKey; label: string; description: string; path: string }>;

export const EMPTY_ADMIN_PERMISSIONS: AdminPermissions = {
  userManagement: false,
  vocalManagement: false,
  sectionTagManagement: false,
  sunoApiManagement: false,
  appSettings: false,
  geminiAudit: false,
};

export const FULL_ADMIN_PERMISSIONS: AdminPermissions = {
  userManagement: true,
  vocalManagement: true,
  sectionTagManagement: true,
  sunoApiManagement: true,
  appSettings: true,
  geminiAudit: true,
};

type AdminAccessSource = {
  role?: UserRole | string | null;
  staffRole?: StaffRole | string;
  adminPermissions?: Partial<AdminPermissions> | null;
};

export const normalizeStaffRole = (data: AdminAccessSource | null | undefined): StaffRole => {
  if (data?.staffRole === 'master') return 'master';
  if (data?.staffRole === 'admin') return 'admin';
  if (data?.role === 'admin' && !data?.staffRole) return 'admin';
  return null;
};

export const normalizeAdminPermissions = (data: AdminAccessSource | null | undefined): AdminPermissions => {
  const staffRole = normalizeStaffRole(data);
  if (staffRole === 'master') return { ...FULL_ADMIN_PERMISSIONS };
  if (data?.role === 'admin' && !data?.staffRole) return { ...FULL_ADMIN_PERMISSIONS };
  const raw = data?.adminPermissions || {};
  return ADMIN_PERMISSION_DEFINITIONS.reduce<AdminPermissions>((result, definition) => {
    result[definition.key] = raw[definition.key] === true;
    return result;
  }, { ...EMPTY_ADMIN_PERMISSIONS });
};

export const hasAdminPermission = (data: AdminAccessSource | null | undefined, permission: AdminPermissionKey) =>
  normalizeStaffRole(data) === 'master' || normalizeAdminPermissions(data)[permission] === true;

export const getFirstAccessibleAdminPath = (staffRole: StaffRole, permissions: AdminPermissions): string => {
  if (staffRole === 'master') return '/admin/master';
  return ADMIN_PERMISSION_DEFINITIONS.find((definition) => permissions[definition.key])?.path || '/';
};
