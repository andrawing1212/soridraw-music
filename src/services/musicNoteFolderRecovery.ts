import { db } from '../firebase';
import { collection, doc, getDoc, getDocFromServer, getDocs, limit, orderBy, query, runTransaction } from '../lib/firestoreMeasured';
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
// Reassemble immutable shards on explicit recovery view / transaction only.
const recoveryParts = (history: any): string[] => {
  if (history?.schemaVersion !== 2) return [];
  const ids = history.partIds;
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 32
    || !ids.every((id: unknown) => typeof id === 'string'
      && /^(beforeFolders|afterFolders)_(myNote|sharedNote)_([0-9]{1,3})$/.test(id))
    || new Set(ids).size !== ids.length) throw new Error('복구 기록 조각이 올바르지 않습니다.');
  return ids as string[];
};
const expandRecovery = (history: any, parts: Record<string, string>): any => {
  if (history?.schemaVersion !== 2) return history;
  const ids = recoveryParts(history);
  const expanded = { ...history, schemaVersion: 1, beforeFolders: {}, afterFolders: {} };
  for (const side of ['beforeFolders', 'afterFolders'] as const) {
    for (const mode of history.changedModes || []) {
      if (mode !== 'myNote' && mode !== 'sharedNote') throw new Error('복구 기록 폴더가 올바르지 않습니다.');
      const prefix = `${side}_${mode}_`;
      const matches = ids.filter(id => id.startsWith(prefix))
        .sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));
      if (!matches.length || matches.some((id, index) => Number(id.slice(prefix.length)) !== index)) {
        throw new Error('복구 기록에 필요한 조각이 없습니다.');
      }
      const json = matches.map(id => parts[id]).join('');
      if (matches.some(id => typeof parts[id] !== 'string')) throw new Error('복구 기록을 모두 읽지 못했습니다.');
      const folders = JSON.parse(json);
      if (!Array.isArray(folders)) throw new Error('폴더 복구 형식이 잘못됐습니다.');
      expanded[side][mode] = folders;
    }
  }
  return expanded;
};
export const listMusicNoteFolderRecovery = async (uid: string): Promise<MusicNoteFolderRecoveryRecord[]> => {
  if (!uid?.trim()) throw new Error('로그인이 필요합니다.');
  const recovery = collection(db, 'user_structures', uid, 'legacy_recovery');
  const snapshot = await getDocs(query(recovery, orderBy('observedAtMs', 'desc'), limit(10)));
  const populated = await Promise.all(snapshot.docs.map(async entry => {
    let value = entry.data();
    if (value?.schemaVersion === 2) {
      const parts: Record<string, string> = {};
      await Promise.all(recoveryParts(value).map(async id => {
        const part = await getDoc(doc(db, 'user_structures', uid, 'legacy_recovery', entry.id, 'parts', id));
        if (!part.exists()) throw new Error('충돌 기록 일부를 읽을 수 없습니다.');
        parts[id] = part.data()?.payload;
      }));
      value = expandRecovery(value, parts);
    }
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
  }));
  return populated.filter(record => record.changedModes.length > 0);
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
    let history = recoverySnap.data();
    if (recoverySnap.exists() && history?.schemaVersion === 2) {
      const parts: Record<string, string> = {};
      for (const id of recoveryParts(history)) {
        const part = await txn.get(doc(db, 'user_structures', uid, 'legacy_recovery', recordId, 'parts', id));
        if (!part.exists()) throw new Error('충돌 기록 조각이 없습니다.');
        parts[id] = part.data()?.payload;
      }
      history = expandRecovery(history, parts);
    }
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
  // A newer local folder edit wins visually and in outbound RTDB traffic.
  // The server's canonical sync-version trigger handles remote convergence
  // without replaying an already-stale restoration preview.
  if (result.changed && !localEditDuringRestore) void publishMusicNoteStructureDelta(uid, {
    musicNoteFolders: { [mode]: result.folders },
    musicNoteStructureVersion: result.version,
  }).catch(() => {});
  return { ...result, localEditDuringRestore };
};


// app515: compare the old PC's last committed folder view with the
// independent modern v2 canonical, only when user presses "conflict records".
// Two exact server gets per request, no subscription, scan, or automatic replay.
export type MusicNoteLegacyFolderComparison = {
  legacyFolders: Partial<Record<MusicNoteFolderModeKey, unknown[]>>;
  modernFolders: Partial<Record<MusicNoteFolderModeKey, unknown[]>>;
  changedModes: MusicNoteFolderModeKey[];
};
const logicalFolderView = (value: unknown): string => JSON.stringify(
  Array.isArray(value) ? value.map((folder: any) => ({
    id: String(folder?.id || folder?.folderId || ''),
    title: String(folder?.title || folder?.name || ''),
    order: Number(folder?.order || 0),
    isDefault: Boolean(folder?.isDefault || folder?.id === 'default'),
  })) : null,
);

export const getMusicNoteLegacyFolderComparison = async (
  uid: string,
): Promise<MusicNoteLegacyFolderComparison | null> => {
  if (!uid?.trim()) throw new Error('로그인이 필요합니다.');
  const [legacy, modern] = await Promise.all([
    getDocFromServer(doc(db, 'user_structures', uid)),
    getDocFromServer(doc(db, 'user_structures', uid, 'folder_state', 'v2')),
  ]);
  if (!modern.exists()) return null; // no migration; legacy remains canonical
  const legacyFolders = legacy.data()?.musicNoteFolders || {};
  const modernFolders = modern.data()?.musicNoteFolders || {};
  const changedModes = (['myNote', 'sharedNote'] as const).filter(mode =>
    Array.isArray(legacyFolders[mode]) && Array.isArray(modernFolders[mode])
    && logicalFolderView(legacyFolders[mode]) !== logicalFolderView(modernFolders[mode]));
  return {
    legacyFolders: Object.fromEntries(changedModes.map(mode => [mode, legacyFolders[mode]])),
    modernFolders: Object.fromEntries(changedModes.map(mode => [mode, modernFolders[mode]])),
    changedModes,
  };
};

// Applying old PC content is an explicit owner action to the V2 document
// ONLY. The old source is never edited. CAS checks both observed snapshots
// and protects unsaved newer local work and folder IDs used by songs.
export const restoreMusicNoteLegacyFolderChoice = async (
  uid: string, mode: MusicNoteFolderModeKey, choice: 'legacy' | 'modern',
  expected: MusicNoteLegacyFolderComparison,
  isSessionCurrent: () => boolean = () => true,
): Promise<{ folders: unknown[]; version: number; changed: boolean; localEditDuringRestore: boolean }> => {
  if (!uid?.trim() || !['myNote', 'sharedNote'].includes(mode)
    || !['legacy', 'modern'].includes(choice) || !expected.changedModes.includes(mode)) {
    throw new Error('잘못된 폴더 비교 요청입니다.');
  }
  if (getPendingMusicNoteFolderStructureBatch(uid)?.[mode]) {
    throw new Error('이 기기에 아직 저장되지 않은 폴더 변경이 있습니다. 먼저 저장 문제를 해결해 주세요.');
  }
  const epoch = getMusicNoteFolderEditEpoch(uid, mode);
  const guard = () => {
    if (!isSessionCurrent() || getMusicNoteFolderEditEpoch(uid, mode) !== epoch
      || getPendingMusicNoteFolderStructureBatch(uid)?.[mode]) {
      throw new Error('복원 중 계정이나 폴더 수정 상태가 바뀌었습니다. 복원을 중단했습니다.');
    }
  };
  guard();
  const legacyRef = doc(db, 'user_structures', uid);
  const v2Ref = doc(db, 'user_structures', uid, 'folder_state', 'v2');
  const result = await runTransaction(db, async txn => {
    const [legacy, modern] = [await txn.get(legacyRef), await txn.get(v2Ref)];
    if (!modern.exists()) throw new Error('신버전 폴더 정본이 없어 복원할 수 없습니다.');
    const legacyNow = legacy.data()?.musicNoteFolders?.[mode];
    const modernNow = modern.data()?.musicNoteFolders?.[mode];
    const legacyExpected = expected.legacyFolders[mode];
    const modernExpected = expected.modernFolders[mode];
    if (!Array.isArray(legacyNow) || !Array.isArray(modernNow)
      || !Array.isArray(legacyExpected) || !Array.isArray(modernExpected)
      || JSON.stringify(legacyNow) !== JSON.stringify(legacyExpected)
      || JSON.stringify(modernNow) !== JSON.stringify(modernExpected)) {
      throw new Error('다른 기기에서 폴더가 변경되었습니다. 비교 기록을 다시 확인해 주세요.');
    }
    guard();
    const version = Number(modern.data()?.musicNoteStructureVersion || 0);
    if (choice === 'modern') return { folders: modernNow, version, changed: false };
    if (logicalFolderView(legacyNow) === logicalFolderView(modernNow)) {
      return { folders: modernNow, version, changed: false };
    }
    const legacyIds = new Set(legacyNow.map((item: any) => String(item?.id || '')));
    if (modernNow.some((item: any) => !legacyIds.has(String(item?.id || '')))) {
      throw new Error('이 복원에는 폴더 삭제가 포함됩니다. 곡 연결을 확인하지 않아 안전을 위해 중단했습니다.');
    }
    const nextVersion = Math.max(0, Math.floor(version)) + 1;
    txn.set(v2Ref, {
      schemaVersion: 2,
      musicNoteFolders: { [mode]: legacyNow },
      musicNoteStructureVersion: nextVersion,
      musicNoteStructureWriterToken: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }, { merge: true });
    return { folders: legacyNow, version: nextVersion, changed: true };
  });
  const localEditDuringRestore = !isSessionCurrent() || getMusicNoteFolderEditEpoch(uid, mode) !== epoch
    || Boolean(getPendingMusicNoteFolderStructureBatch(uid)?.[mode]);
  if (result.changed && !localEditDuringRestore) {
    void publishMusicNoteStructureDelta(uid, {
      musicNoteFolders: { [mode]: result.folders },
      musicNoteStructureVersion: result.version,
    }).catch(() => {});
  }
  return { ...result, localEditDuringRestore };
};
