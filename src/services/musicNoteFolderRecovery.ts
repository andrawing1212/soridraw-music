import { db } from '../firebase';
import { collection, doc, getDocs, limit, orderBy, query, runTransaction } from '../lib/firestoreMeasured';
import { getPendingMusicNoteFolderStructureBatch, getMusicNoteFolderEditEpoch, type MusicNoteFolderModeKey } from './musicNoteFolderStructureBatch';
import { publishMusicNoteStructureDelta } from './userDomainSyncService';

// Loaded only when the user opens the recovery dialog. No listener, polling,
// page-open scan or bulk backfill. The Firestore Rules for this private child
// collection grant owner read ONLY; only the backend trigger can create records.
export type MusicNoteFolderRecoveryRecord = {
  id: string;
  changedModes: MusicNoteFolderModeKey[];
  beforeFolders: Partial<Record<MusicNoteFolderModeKey, unknown[]>>;
  afterFolders: Partial<Record<MusicNoteFolderModeKey, unknown[]>>;
  observedAtMs: number;
};
export const listMusicNoteFolderRecovery = async (uid: string): Promise<MusicNoteFolderRecoveryRecord[]> => {
  if (!uid?.trim()) throw new Error('로그인이 필요합니다.');
  const recovery = collection(db, 'user_structures', uid, 'legacy_recovery');
  const snapshot = await getDocs(query(recovery, orderBy('observedAtMs', 'desc'), limit(10)));
  return snapshot.docs.map(entry => {
    const value = entry.data();
    const modes = (['myNote', 'sharedNote'] as const).filter(mode =>
      Array.isArray(value?.beforeFolders?.[mode]) && Array.isArray(value?.afterFolders?.[mode])
      && Array.isArray(value?.changedModes) && value.changedModes.includes(mode),
    );
    return {
      id: entry.id,
      changedModes: modes,
      beforeFolders: value?.beforeFolders || {},
      afterFolders: value?.afterFolders || {},
      observedAtMs: Number(value?.observedAtMs || 0),
    };
  }).filter(record => record.changedModes.length > 0);
};

export const restoreMusicNoteFolderRecovery = async (
  uid: string, recordId: string, mode: MusicNoteFolderModeKey, choice: 'before' | 'after',
  isSessionCurrent: () => boolean = () => true,
): Promise<{ folders: unknown[]; version: number; changed: boolean; localEditDuringRestore: boolean }> => {
  if (!uid?.trim() || !/^[a-f0-9]{40}$/.test(recordId)
    || !['myNote', 'sharedNote'].includes(mode) || !['before', 'after'].includes(choice)) {
    throw new Error('잘못된 복원 요청입니다.');
  }
  // Never overwrite a local unsaved edit that has not reached canonical.
  if (getPendingMusicNoteFolderStructureBatch(uid)?.[mode]) {
    throw new Error('이 기기에 아직 저장되지 않은 폴더 변경이 있습니다. 먼저 저장 문제를 해결해 주세요.');
  }
  const editEpoch = getMusicNoteFolderEditEpoch(uid, mode);
  const assertNoNewLocalEdit = (): void => {
    if (!isSessionCurrent() || getMusicNoteFolderEditEpoch(uid, mode) !== editEpoch
      || getPendingMusicNoteFolderStructureBatch(uid)?.[mode]) {
      throw new Error('복원 중 계정이나 폴더 수정 상태가 바뀌었습니다. 복원을 중단했습니다.');
    }
  };
  assertNoNewLocalEdit();
  const parent = doc(db, 'user_structures', uid);
  const archived = doc(db, 'user_structures', uid, 'legacy_recovery', recordId);
  const result = await runTransaction(db, async txn => {
    // Reads come before writes, all from server; a concurrent edit retries or fails.
    const recoverySnap = await txn.get(archived);
    const canonicalSnap = await txn.get(parent);
    const history = recoverySnap.data();
    if (!recoverySnap.exists() || history?.schemaVersion !== 1
      || history?.source !== 'legacy-writer-after-modern'
      || !Array.isArray(history?.changedModes) || !history.changedModes.includes(mode)) {
      throw new Error('복구 기록을 확인할 수 없습니다.');
    }
    const expected = history?.afterFolders?.[mode];
    const selected = history?.[choice === 'before' ? 'beforeFolders' : 'afterFolders']?.[mode];
    if (!Array.isArray(expected) || !Array.isArray(selected)) {
      throw new Error('이 폴더 기록은 복원할 수 없습니다.');
    }
    // First restore: only from the archived after-state. Undo: only after
    // THIS record's previous restore, with unchanged server revision.
    const current = canonicalSnap.data()?.musicNoteFolders?.[mode];
    const canonicalVersion = Number(canonicalSnap.data()?.musicNoteStructureVersion || 0);
    const marker = canonicalSnap.data()?.musicNoteFolderRecoveryMarker;
    const undo = choice === 'after'
      && marker?.recordId === recordId && marker?.mode === mode
      && marker?.choice === 'before' && marker?.version === canonicalVersion;
    const baseline = undo ? history?.beforeFolders?.[mode] : expected;
    if (!Array.isArray(current) || JSON.stringify(current) !== JSON.stringify(baseline)) {
      throw new Error('다른 기기에서 폴더가 변경되었습니다. 복원을 중단했습니다.');
    }
    // The server read could have been held while the user made another local
    // edit or switched accounts. Check AFTER both Firestore reads, before set.
    assertNoNewLocalEdit();
    const versionRaw = Number(canonicalSnap.data()?.musicNoteStructureVersion || 0);
    const currentVersion = Number.isFinite(versionRaw) && versionRaw > 0 ? Math.floor(versionRaw) : 0;
    // 'After' may already be the current canonical state. Do not charge a
    // redundant W1 or broadcast if the user just confirmed that choice.
    if (JSON.stringify(selected) === JSON.stringify(baseline)) {
      return { folders: selected as unknown[], version: currentVersion, changed: false };
    }
    // Removing a folder ID can orphan saved songs without knowing their
    // membership. This recovery UI must NEVER silently delete folder IDs.
    const selectedIds = new Set(selected.map((item: any) => String(item?.id || '')));
    if (baseline.some((item: any) => !selectedIds.has(String(item?.id || '')))) {
      throw new Error('이 복원에는 폴더 삭제가 포함됩니다. 곡 연결을 확인하지 않아 안전을 위해 중단했습니다.');
    }
    const version = currentVersion + 1;
    txn.set(parent, {
      musicNoteFolders: { [mode]: selected },
      musicNoteStructureVersion: version,
      musicNoteFolderRecoveryMarker: { recordId, mode, choice, version },
      musicNoteStructureWriterToken: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }, { merge: true });
    return { folders: selected as unknown[], version, changed: true };
  });
  // If a local edit appeared after transaction planning, do not repaint over
  // it on this device. Preserve its pending data for explicit settlement.
  const localEditDuringRestore = !isSessionCurrent() || getMusicNoteFolderEditEpoch(uid, mode) !== editEpoch
    || Boolean(getPendingMusicNoteFolderStructureBatch(uid)?.[mode]);
  // Firestore ACK is authoritative; RTDB is just a best-effort warm-device hint.
  if (result.changed) void publishMusicNoteStructureDelta(uid, {
    musicNoteFolders: { [mode]: result.folders },
    musicNoteStructureVersion: result.version,
  }).catch(() => {});
  return { ...result, localEditDuringRestore };
};
