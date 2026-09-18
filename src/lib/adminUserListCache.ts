import type { AppUserInfo } from '../types';
import {
  readSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from './soridrawPersistentCache';

export type AdminUserSort = 'createdAt' | 'lastLoginAt';

export type AdminUserListCacheData = {
  users: AppUserInfo[];
  hasMoreUsers: boolean;
  lastUserUid: string | null;
};

const ADMIN_USER_LIST_CACHE_SCHEMA_VERSION = 1;
const ADMIN_USER_LIST_CACHE_DATA_VERSION = 1;
const ADMIN_USER_LIST_CACHE_SOURCE_TYPE = 'admin-user-list';

const getAdminUserListCacheKey = (sortBy: AdminUserSort) => `admin-user-list:${sortBy}`;

export const readAdminUserListCache = (
  adminUid: string,
  sortBy: AdminUserSort,
): AdminUserListCacheData | null => {
  if (!adminUid) return null;
  const envelope = readSoridrawPersistentCache<AdminUserListCacheData>({
    cacheKey: getAdminUserListCacheKey(sortBy),
    sourceType: ADMIN_USER_LIST_CACHE_SOURCE_TYPE,
    schemaVersion: ADMIN_USER_LIST_CACHE_SCHEMA_VERSION,
    uid: adminUid,
  });
  if (!envelope || !Array.isArray(envelope.data?.users)) return null;
  return {
    users: envelope.data.users,
    hasMoreUsers: Boolean(envelope.data.hasMoreUsers),
    lastUserUid: envelope.data.lastUserUid || null,
  };
};

export const writeAdminUserListCache = (
  adminUid: string,
  sortBy: AdminUserSort,
  data: AdminUserListCacheData,
) => {
  if (!adminUid) return;
  writeSoridrawPersistentCache<AdminUserListCacheData>({
    cacheKey: getAdminUserListCacheKey(sortBy),
    sourceType: ADMIN_USER_LIST_CACHE_SOURCE_TYPE,
    schemaVersion: ADMIN_USER_LIST_CACHE_SCHEMA_VERSION,
    dataVersion: ADMIN_USER_LIST_CACHE_DATA_VERSION,
    uid: adminUid,
    data: {
      users: Array.isArray(data.users) ? data.users : [],
      hasMoreUsers: Boolean(data.hasMoreUsers),
      lastUserUid: data.lastUserUid || null,
    },
  });
};
