import type { AppUserInfo } from '../types';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from './soridrawPersistentCache';

export type AdminStaffListCacheData = {
  admins: AppUserInfo[];
};

const ADMIN_STAFF_LIST_CACHE_SCHEMA_VERSION = 1;
const ADMIN_STAFF_LIST_CACHE_DATA_VERSION = 1;
const ADMIN_STAFF_LIST_CACHE_SOURCE_TYPE = 'admin-staff-list';
const ADMIN_STAFF_LIST_CACHE_KEY = 'admin-staff-list';

export const readAdminStaffListCache = (masterUid: string): AdminStaffListCacheData | null => {
  if (!masterUid) return null;
  const envelope = readSoridrawPersistentCache<AdminStaffListCacheData>({
    cacheKey: ADMIN_STAFF_LIST_CACHE_KEY,
    sourceType: ADMIN_STAFF_LIST_CACHE_SOURCE_TYPE,
    schemaVersion: ADMIN_STAFF_LIST_CACHE_SCHEMA_VERSION,
    uid: masterUid,
  });
  if (!envelope || !Array.isArray(envelope.data?.admins)) return null;
  return { admins: envelope.data.admins };
};

export const writeAdminStaffListCache = (masterUid: string, admins: AppUserInfo[]) => {
  if (!masterUid) return;
  writeSoridrawPersistentCache<AdminStaffListCacheData>({
    cacheKey: ADMIN_STAFF_LIST_CACHE_KEY,
    sourceType: ADMIN_STAFF_LIST_CACHE_SOURCE_TYPE,
    schemaVersion: ADMIN_STAFF_LIST_CACHE_SCHEMA_VERSION,
    dataVersion: ADMIN_STAFF_LIST_CACHE_DATA_VERSION,
    uid: masterUid,
    data: { admins: Array.isArray(admins) ? admins : [] },
  });
};

export const removeAdminStaffListCache = (masterUid: string) => {
  if (!masterUid) return;
  removeSoridrawPersistentCache(ADMIN_STAFF_LIST_CACHE_KEY, masterUid);
};
