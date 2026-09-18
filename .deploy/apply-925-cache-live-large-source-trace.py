from pathlib import Path

MARKER = 'SORIDRAW_925_CACHE_LIVE_LARGE_SOURCE_TRACE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'925 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# 1) Persist SDK read/write counts by top Firestore collection/path source.
# -----------------------------------------------------------------------------
diag_path = Path('src/lib/cacheDiagnostics.ts')
diag = diag_path.read_text(encoding='utf-8')
if MARKER not in diag:
    diag = replace_once(
        diag,
        """export type FirestoreActualState = {
  reads: number;
  writes: number;
  cacheHits: number;
  lastReads: number;
  lastWrites: number;
  updatedAt: number;
};""",
        """export type FirestoreActualState = {
  reads: number;
  writes: number;
  cacheHits: number;
  lastReads: number;
  lastWrites: number;
  readSources: Record<string, number>;
  writeSources: Record<string, number>;
  updatedAt: number;
};""",
        'actual state type',
    )
    diag = replace_once(
        diag,
        """const makeEmptyFirestoreActualState = (updatedAt = 0): FirestoreActualState => ({
  reads: 0,
  writes: 0,
  cacheHits: 0,
  lastReads: 0,
  lastWrites: 0,
  updatedAt,
});""",
        """const makeEmptyFirestoreActualState = (updatedAt = 0): FirestoreActualState => ({
  reads: 0,
  writes: 0,
  cacheHits: 0,
  lastReads: 0,
  lastWrites: 0,
  readSources: {},
  writeSources: {},
  updatedAt,
});

const normalizeFirestoreSourceMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || 'unknown').trim().slice(0, 96) || 'unknown';
    const count = Number(rawValue || 0);
    if (Number.isFinite(count) && count > 0) next[key] = Math.floor(count);
  });
  return next;
};

const addFirestoreSourceCount = (map: Record<string, number>, source: string, count: number) => {
  const key = String(source || 'unknown').trim().slice(0, 96) || 'unknown';
  return { ...map, [key]: Number(map[key] || 0) + count };
};""",
        'actual empty state',
    )
    diag = replace_once(
        diag,
        """      lastReads: normalize(parsed?.lastReads),
      lastWrites: normalize(parsed?.lastWrites),
      updatedAt: normalize(parsed?.updatedAt),""",
        """      lastReads: normalize(parsed?.lastReads),
      lastWrites: normalize(parsed?.lastWrites),
      readSources: normalizeFirestoreSourceMap(parsed?.readSources),
      writeSources: normalizeFirestoreSourceMap(parsed?.writeSources),
      updatedAt: normalize(parsed?.updatedAt),""",
        'actual state hydration',
    )
    diag = replace_once(
        diag,
        """export function markFirestoreActualRead(reads = 1): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;
  const count = Number.isFinite(reads) && reads > 0 ? Math.floor(reads) : 0;
  if (count <= 0) return;
  const previous = readFirestoreActual();
  writeFirestoreActual({
    ...previous,
    reads: previous.reads + count,
    lastReads: count,
    lastWrites: 0,
    updatedAt: Date.now(),
  });
}""",
        """export function markFirestoreActualRead(reads = 1, source = 'unknown'): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;
  const count = Number.isFinite(reads) && reads > 0 ? Math.floor(reads) : 0;
  if (count <= 0) return;
  const previous = readFirestoreActual();
  writeFirestoreActual({
    ...previous,
    reads: previous.reads + count,
    lastReads: count,
    lastWrites: 0,
    readSources: addFirestoreSourceCount(previous.readSources || {}, source, count),
    updatedAt: Date.now(),
  });
}""",
        'mark actual read',
    )
    diag = replace_once(
        diag,
        """export function markFirestoreActualWrite(writes = 1): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;
  const count = Number.isFinite(writes) && writes > 0 ? Math.floor(writes) : 0;
  if (count <= 0) return;
  const previous = readFirestoreActual();
  writeFirestoreActual({
    ...previous,
    writes: previous.writes + count,
    lastReads: 0,
    lastWrites: count,
    updatedAt: Date.now(),
  });
}""",
        """export function markFirestoreActualWrite(writes = 1, source = 'unknown'): void {
  if (!readCacheDiagnosticsGloballyEnabled()) return;
  const count = Number.isFinite(writes) && writes > 0 ? Math.floor(writes) : 0;
  if (count <= 0) return;
  const previous = readFirestoreActual();
  writeFirestoreActual({
    ...previous,
    writes: previous.writes + count,
    lastReads: 0,
    lastWrites: count,
    writeSources: addFirestoreSourceCount(previous.writeSources || {}, source, count),
    updatedAt: Date.now(),
  });
}""",
        'mark actual write',
    )
    diag = diag.replace(
        "export function markCacheDiagnosticWrite(domain: CacheDiagnosticDomain, writes = 1): void {",
        f"const {MARKER} = true;\n\nexport function markCacheDiagnosticWrite(domain: CacheDiagnosticDomain, writes = 1): void {{",
        1,
    )
    diag_path.write_text(diag, encoding='utf-8')


# -----------------------------------------------------------------------------
# 2) Measure every browser Firestore operation with its collection/path source.
# -----------------------------------------------------------------------------
measured_path = Path('src/lib/firestoreMeasured.ts')
measured = measured_path.read_text(encoding='utf-8')
if MARKER not in measured:
    measured = r'''import * as Firestore from 'firebase/firestore';
import {
  markFirestoreActualCacheHit,
  markFirestoreActualRead,
  markFirestoreActualWrite,
} from './cacheDiagnostics';

export * from 'firebase/firestore';

const SORIDRAW_925_CACHE_LIVE_LARGE_SOURCE_TRACE = true;

const normalizeSourcePath = (value: unknown): string => {
  const raw = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  if (!raw) return 'unknown';
  const segments = raw.split('/').filter(Boolean);
  if (segments[0] === 'suno_tracks' && segments.length >= 3) return 'suno_tracks/*/tracks';
  if (segments[0] === 'user_list_caches') return 'user_list_caches';
  return segments[0] || 'unknown';
};

const getSourceLabel = (target: any): string => {
  try {
    const directPath = String(target?.path || '').trim();
    if (directPath) return normalizeSourcePath(directPath);

    const internalQuery = target?._query;
    const group = String(internalQuery?.collectionGroup || '').trim();
    if (group) return `group:${group}`;

    const internalPath = internalQuery?.path;
    if (Array.isArray(internalPath?.segments) && internalPath.segments.length > 0) {
      return normalizeSourcePath(internalPath.segments.join('/'));
    }
    if (typeof internalPath?.canonicalString === 'function') {
      const canonical = internalPath.canonicalString();
      if (canonical) return normalizeSourcePath(canonical);
    }
    const keyPath = String(target?._key?.path?.canonicalString?.() || '').trim();
    if (keyPath) return normalizeSourcePath(keyPath);
  } catch {}
  return 'unknown';
};

const countSnapshotRead = (snapshot: any, source: string) => {
  if (snapshot?.metadata?.fromCache === true) {
    markFirestoreActualCacheHit(1);
    return;
  }
  if (Array.isArray(snapshot?.docs)) {
    markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)), source);
    return;
  }
  markFirestoreActualRead(1, source);
};

export const getDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const snapshot = await (Firestore.getDoc as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDoc;

export const getDocFromServer = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const snapshot = await (Firestore.getDocFromServer as any)(...args);
  markFirestoreActualRead(1, source);
  return snapshot;
}) as typeof Firestore.getDocFromServer;

export const getDocs = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const snapshot = await (Firestore.getDocs as any)(...args);
  countSnapshotRead(snapshot, source);
  return snapshot;
}) as typeof Firestore.getDocs;

export const setDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.setDoc as any)(...args);
  markFirestoreActualWrite(1, source);
  return result;
}) as typeof Firestore.setDoc;

export const updateDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.updateDoc as any)(...args);
  markFirestoreActualWrite(1, source);
  return result;
}) as typeof Firestore.updateDoc;

export const deleteDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.deleteDoc as any)(...args);
  markFirestoreActualWrite(1, source);
  return result;
}) as typeof Firestore.deleteDoc;

export const addDoc = (async (...args: any[]) => {
  const source = getSourceLabel(args[0]);
  const result = await (Firestore.addDoc as any)(...args);
  markFirestoreActualWrite(1, source);
  return result;
}) as typeof Firestore.addDoc;

const snapshotFingerprint = (snapshot: any): string => {
  try {
    if (Array.isArray(snapshot?.docs)) {
      return JSON.stringify(snapshot.docs.map((docSnap: any) => [docSnap.id, docSnap.data?.()]));
    }
    return JSON.stringify([snapshot?.id || '', snapshot?.exists?.() ?? false, snapshot?.data?.()]);
  } catch {
    return `${Date.now()}_${Math.random()}`;
  }
};

type ListenerState = { seenServer: boolean; fingerprint: string; source: string };

const recordListenerSnapshot = (snapshot: any, state: ListenerState) => {
  if (snapshot?.metadata?.fromCache === true) {
    markFirestoreActualCacheHit(1);
    return;
  }

  if (Array.isArray(snapshot?.docs)) {
    if (!state.seenServer) {
      state.seenServer = true;
      state.fingerprint = snapshotFingerprint(snapshot);
      markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)), state.source);
      return;
    }
    let changed = 0;
    try {
      changed = snapshot.docChanges?.({ includeMetadataChanges: false })?.length || 0;
    } catch {
      try { changed = snapshot.docChanges?.()?.length || 0; } catch {}
    }
    const nextFingerprint = snapshotFingerprint(snapshot);
    if (changed > 0) markFirestoreActualRead(changed, state.source);
    else if (nextFingerprint !== state.fingerprint) {
      markFirestoreActualRead(Math.max(1, Number(snapshot?.size ?? snapshot.docs.length ?? 0)), state.source);
    }
    state.fingerprint = nextFingerprint;
    return;
  }

  const nextFingerprint = snapshotFingerprint(snapshot);
  if (!state.seenServer || nextFingerprint !== state.fingerprint) {
    markFirestoreActualRead(1, state.source);
  }
  state.seenServer = true;
  state.fingerprint = nextFingerprint;
};

export const onSnapshot = ((...rawArgs: any[]) => {
  const args = [...rawArgs];
  const state: ListenerState = {
    seenServer: false,
    fingerprint: '',
    source: getSourceLabel(args[0]),
  };

  for (let index = 1; index < args.length; index += 1) {
    const candidate = args[index];
    if (typeof candidate === 'function') {
      const originalNext = candidate;
      args[index] = (snapshot: any) => {
        recordListenerSnapshot(snapshot, state);
        return originalNext(snapshot);
      };
      break;
    }
    if (candidate && typeof candidate === 'object' && typeof candidate.next === 'function') {
      const originalNext = candidate.next.bind(candidate);
      args[index] = {
        ...candidate,
        next: (snapshot: any) => {
          recordListenerSnapshot(snapshot, state);
          return originalNext(snapshot);
        },
      };
      break;
    }
  }

  return (Firestore.onSnapshot as any)(...args);
}) as typeof Firestore.onSnapshot;

export const writeBatch = ((...args: any[]) => {
  const batch: any = (Firestore.writeBatch as any)(...args);
  const sourceWrites: Record<string, number> = {};
  const rememberWrite = (target: any) => {
    const source = getSourceLabel(target);
    sourceWrites[source] = Number(sourceWrites[source] || 0) + 1;
  };
  const measured: any = {};
  measured.set = (...setArgs: any[]) => { rememberWrite(setArgs[0]); batch.set(...setArgs); return measured; };
  measured.update = (...updateArgs: any[]) => { rememberWrite(updateArgs[0]); batch.update(...updateArgs); return measured; };
  measured.delete = (...deleteArgs: any[]) => { rememberWrite(deleteArgs[0]); batch.delete(...deleteArgs); return measured; };
  measured.commit = async () => {
    const result = await batch.commit();
    Object.entries(sourceWrites).forEach(([source, count]) => markFirestoreActualWrite(count, source));
    return result;
  };
  return measured;
}) as typeof Firestore.writeBatch;

export const runTransaction = (async (...rawArgs: any[]) => {
  const [db, updateFunction, options] = rawArgs;
  let committedWrites: Record<string, number> = {};
  const measuredUpdate = async (transaction: any) => {
    const attemptWrites: Record<string, number> = {};
    const rememberWrite = (target: any) => {
      const source = getSourceLabel(target);
      attemptWrites[source] = Number(attemptWrites[source] || 0) + 1;
    };
    const measured: any = {};
    measured.get = async (...getArgs: any[]) => {
      const snapshot = await transaction.get(...getArgs);
      markFirestoreActualRead(1, getSourceLabel(getArgs[0]));
      return snapshot;
    };
    measured.set = (...setArgs: any[]) => { rememberWrite(setArgs[0]); transaction.set(...setArgs); return measured; };
    measured.update = (...updateArgs: any[]) => { rememberWrite(updateArgs[0]); transaction.update(...updateArgs); return measured; };
    measured.delete = (...deleteArgs: any[]) => { rememberWrite(deleteArgs[0]); transaction.delete(...deleteArgs); return measured; };
    const result = await updateFunction(measured);
    committedWrites = attemptWrites;
    return result;
  };
  const result = options === undefined
    ? await (Firestore.runTransaction as any)(db, measuredUpdate)
    : await (Firestore.runTransaction as any)(db, measuredUpdate, options);
  Object.entries(committedWrites).forEach(([source, count]) => markFirestoreActualWrite(count, source));
  return result;
}) as typeof Firestore.runTransaction;
'''
    measured_path.write_text(measured, encoding='utf-8')


# -----------------------------------------------------------------------------
# 3) Enlarge CACHE LIVE and show the SDK read-source breakdown.
# -----------------------------------------------------------------------------
overlay_path = Path('src/components/CacheDiagnosticsOverlay.tsx')
overlay = overlay_path.read_text(encoding='utf-8')
if MARKER not in overlay:
    overlay = replace_once(overlay, 'const PANEL_DEFAULT_WIDTH = 278;', 'const PANEL_DEFAULT_WIDTH = 380;', 'panel default width')
    overlay = replace_once(
        overlay,
        """  const sampledThrough = serverUsage?.sampledThroughMs
    ? new Date(serverUsage.sampledThroughMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (""",
        """  const sampledThrough = serverUsage?.sampledThroughMs
    ? new Date(serverUsage.sampledThroughMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const topReadSources = Object.entries(actual.readSources || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 6);

  return (""",
        'top read source calculation',
    )
    overlay = replace_once(
        overlay,
        'className="fixed z-[9998] w-[278px] max-w-[calc(100vw-16px)] rounded-2xl bg-black/80 px-3 py-2.5 text-white/85 shadow-2xl backdrop-blur-md"',
        'className="fixed z-[9998] w-[380px] max-w-[calc(100vw-16px)] rounded-2xl bg-black/80 px-4 py-3.5 text-white/85 shadow-2xl backdrop-blur-md"',
        'panel class width',
    )
    overlay = overlay.replace('text-[11px] font-black tracking-[0.08em]', 'text-[14px] font-black tracking-[0.08em]', 1)
    overlay = overlay.replace('text-[8px] font-bold text-white/30">드래그 이동', 'text-[10px] font-bold text-white/30">드래그 이동', 1)
    overlay = overlay.replace('mt-0.5 truncate text-[8px] font-bold text-white/55', 'mt-1 truncate text-[10px] font-bold text-white/55', 1)
    overlay = overlay.replace('px-2 py-1 text-[9px] font-black', 'px-2.5 py-1.5 text-[10px] font-black', 2)
    overlay = replace_once(
        overlay,
        """            <div className="whitespace-nowrap text-[9px] font-bold text-white/66">{formatActualUsage(actual)}</div>
            {serverUsage ? (""",
        """            <div className="whitespace-nowrap text-[11px] font-bold text-white/72">{formatActualUsage(actual)}</div>
            {topReadSources.length > 0 ? (
              <div className="mt-1.5 rounded-xl bg-white/[0.035] px-2.5 py-2">
                <div className="mb-1 text-[9px] font-black tracking-[0.05em] text-white/38">SDK READ 발생처</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {topReadSources.map(([source, count]) => (
                    <div key={source} className="flex min-w-0 items-center justify-between gap-2 text-[10px] font-bold text-white/58">
                      <span className="truncate">{source}</span>
                      <span className="shrink-0 tabular-nums text-white/82">{formatNumber(Number(count))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {serverUsage ? (""",
        'source breakdown UI',
    )
    overlay = overlay.replace('whitespace-nowrap text-[9px] font-bold text-[#9fc7ff]', 'whitespace-nowrap text-[11px] font-bold text-[#9fc7ff]', 1)
    overlay = overlay.replace('whitespace-nowrap text-[8px] font-bold text-[#9fc7ff]/75', 'whitespace-nowrap text-[10px] font-bold text-[#9fc7ff]/75', 1)
    overlay = overlay.replace('whitespace-nowrap text-[8px] font-bold text-white/42', 'whitespace-nowrap text-[10px] font-bold text-white/42', 1)
    overlay = overlay.replace('whitespace-nowrap text-[7px] font-bold text-white/28', 'whitespace-nowrap text-[9px] font-bold text-white/28', 1)
    overlay = overlay.replace('grid-cols-[50px_38px_1fr]', 'grid-cols-[70px_48px_1fr]', 1)
    overlay = overlay.replace('text-[8px] font-bold leading-5', 'text-[10px] font-bold leading-6', 1)
    overlay = overlay.replace('sm:grid-cols-[58px_42px_1fr] sm:text-[9px]', 'sm:grid-cols-[76px_52px_1fr] sm:text-[11px]', 1)
    overlay = overlay.replace(
        'export default function CacheDiagnosticsOverlay({ isAdmin }: { isAdmin: boolean }) {',
        f'const {MARKER} = true;\n\nexport default function CacheDiagnosticsOverlay({{ isAdmin }}: {{ isAdmin: boolean }}) {{',
        1,
    )
    overlay_path.write_text(overlay, encoding='utf-8')

print('Applied SORIDRAW 925: CACHE LIVE enlarged and browser SDK read sources are traced by collection/path.')
