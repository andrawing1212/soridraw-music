import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDocsFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { collection, limit, query, where } from '../lib/firestoreMeasured';
import { markFirestoreActualRead } from '../lib/cacheDiagnostics';
import { favoritesStore } from '../hooks/useFavoritesStore';
import { readCatalogSnapshotFromLocalCache } from '../lib/userDataEngine';
import { isMusicNoteItemRemoved } from '../lib/musicNoteSavedState';
import { applyInspectedColorsToDevice } from '../lib/colorLocalRecovery';

// Admin CACHE LIVE only. Nothing is read from the server until the signed-in
// owner explicitly clicks once; no document, cache, or backup is ever written.
type Color = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
type ColorArea = '뮤직노트' | '라이브러리 음악' | '라이브러리 폴더';
type Hit = { area: ColorArea; color: Color; title: string; provenance: '현재 필드' | '과거 필드' };
type Stats = { examined: number; current: number; legacy: number; resetConflict: number; byColor: Record<Color, number> };
type NoteCoverage = {
  activeSongs: number;
  inactiveSongs: number;
  activeColored: number;
  inactiveColored: number;
  activeInCatalog: number;
  activeColoredInCatalog: number;
  activeColoredMissingFromCatalog: number;
  activeCatalogRowWithoutColor: number;
};
type AuditResult = {
  local: { musicNoteMap: number; workspaceMap: number; playlistMap: number; visibleNote: number; catalogNote: number };
  noteCoverage: NoteCoverage;
  catalogAvailable: boolean;
  server: { note: Stats; workspace: Stats; playlist: Stats; documentsRead: number };
  hits: Hit[];
  truncated: boolean;
  errors: string[];
};

const COLORS: Color[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const COLOR_LABELS: Record<Color, string> = {
  red: '빨강', orange: '주황', yellow: '노랑',
  green: '초록', blue: '파랑', purple: '보라',
};
const MAX_FAVORITES = 700;
const MAX_TRACKS = 100;
const MAX_PLAYLISTS = 60;
const MAX_ITEMS_TOTAL = 400;
const MAX_ITEMS_PER_PLAYLIST = 120;
const emptyStats = (): Stats => ({
  examined: 0, current: 0, legacy: 0, resetConflict: 0,
  byColor: { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0 },
});
const isColor = (value: unknown): value is Color =>
  typeof value === 'string' && COLORS.includes(value as Color);
const has = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const classifyNote = (song: Record<string, unknown>) => {
  const primary = isColor(song.favoriteColorTag) ? song.favoriteColorTag
    : isColor(song.colorTag) ? song.colorTag : null;
  const legacy = isColor(song.favoriteColor) ? song.favoriteColor
    : isColor(song.noteColor) ? song.noteColor
      : isColor(song.color) ? song.color : null;
  const modernPresent = has(song, 'favoriteColorTag') || has(song, 'colorTag');
  return {
    color: primary || (!modernPresent ? legacy : null),
    provenance: (primary ? '현재 필드' : '과거 필드') as Hit['provenance'],
    conflict: modernPresent && !primary && Boolean(legacy),
  };
};
const countColoredMap = (uid: string, base: string): number => {
  try {
    const raw = localStorage.getItem(base + '.' + uid) || localStorage.getItem(base);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 0;
    return Object.values(parsed).filter(isColor).length;
  } catch {
    return 0;
  }
};
const pushHit = (result: AuditResult, stats: Stats, area: ColorArea,
  title: unknown, color: Color, provenance: Hit['provenance']) => {
  stats.byColor[color]++;
  if (provenance === '현재 필드') stats.current++;
  else stats.legacy++;
  // Never expose account IDs, exact document IDs, lyrics or raw song payload.
  if (result.hits.length < 24) {
    const normalized = String(title || '제목 없음').slice(0, 75);
    result.hits.push({ area, title: normalized, color, provenance });
  }
};
const sourceSummary = (stats: Stats) =>
  '확인 ' + stats.examined + '건 · 현재색 ' + stats.current
  + '건 · 과거색 ' + stats.legacy + '건'
  + (stats.resetConflict > 0 ? ' · 해제/과거색 충돌 ' + stats.resetConflict + '건' : '');

export default function ColorHistoryReadOnlyDiagnostic() {
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<AuditResult | null>(null);
  const runRef = useRef(false);
  const generationRef = useRef(0);
  const recoverableRef = useRef<{ uid: string; note: Record<string,string>; workspace: Record<string,string> } | null>(null);
  const [restored, setRestored] = useState<{ note: number; workspace: number } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      generationRef.current++;
      runRef.current = false;
      setBusy(false);
      setFinished(false);
      setProgress('');
      setReport(null);
      recoverableRef.current = null;
      setRestored(null);
    });
    return () => {
      generationRef.current++;
      runRef.current = false;
      unsubscribe();
    };
  }, []);

  const inspect = async () => {
    const uid = String(auth.currentUser?.uid || '').trim();
    if (!uid || runRef.current || finished) return;
    runRef.current = true;
    setBusy(true);
    setProgress('이 기기와 서버에서 색상 기록을 확인하는 중…');
    const generation = ++generationRef.current;
    const current = () => generation === generationRef.current && auth.currentUser?.uid === uid;
    const noteRecoverable: Record<string,string> = {};
    const workspaceRecoverable: Record<string,string> = {};
    const result: AuditResult = {
      local: { musicNoteMap: 0, workspaceMap: 0, playlistMap: 0, visibleNote: 0, catalogNote: 0 },
      noteCoverage: {
        activeSongs: 0, inactiveSongs: 0, activeColored: 0, inactiveColored: 0,
        activeInCatalog: 0, activeColoredInCatalog: 0, activeColoredMissingFromCatalog: 0,
        activeCatalogRowWithoutColor: 0,
      },
      catalogAvailable: false,
      server: { note: emptyStats(), workspace: emptyStats(), playlist: emptyStats(), documentsRead: 0 },
      hits: [], truncated: false, errors: [],
    };

    try {
      // Local hints do not imply server persistence. Never write them back.
      result.local.musicNoteMap = countColoredMap(uid, 'soridraw.favoriteColorTags');
      result.local.workspaceMap = countColoredMap(uid, 'soridraw.library.workspaceColorTags');
      result.local.playlistMap = countColoredMap(uid, 'soridraw.library.playlistColorTags');
      result.local.visibleNote = favoritesStore.getFavorites()
        .filter((song: any) => !song?.uid || String(song.uid) === uid)
        .filter((song: any) => Boolean(classifyNote(song).color)).length;
      const catalogRows = new Map<string, Record<string, unknown>>();
      const libraryCatalogRows = new Map<string, Record<string, unknown>>();
      try {
        const catalog = await readCatalogSnapshotFromLocalCache('musicNote', uid);
        if (!current()) return;
        result.catalogAvailable = Boolean(catalog);
        for (const row of catalog?.items || []) {
          if (!row || typeof row !== 'object') continue;
          const doc = row as Record<string, unknown>;
          for (const alias of [doc.id, doc.firestoreId]) {
            const id = String(alias || '').trim();
            if (id) catalogRows.set(id, doc);
          }
        }
        result.local.catalogNote = (catalog?.items || [])
          .filter((song: any) => Boolean(classifyNote(song).color)).length;
      } catch {
        result.errors.push('기기 Catalog 캐시 확인 실패 (서버 원본 유실을 의미하지 않음)');
      }

      // No network call: reuse the currently cached Library item identities.
      try {
        const catalog = await readCatalogSnapshotFromLocalCache('library', uid);
        if (!current()) return;
        for (const row of catalog?.items || []) {
          if (!row || typeof row !== 'object') continue;
          const record = row as Record<string, unknown>;
          for (const alias of [record.id, record.firestoreId]) {
            const id = String(alias || '').trim();
            if (id) libraryCatalogRows.set(id, record);
          }
        }
      } catch {
        result.errors.push('라이브러리 기기 Catalog ID 비교 실패 — 해당 영역은 복원 대상에서 제외');
      }

      // Each read is opt-in, UID-scoped and bounded. Sentinel +1 lets us
      // report partial coverage instead of falsely claiming old colors absent.
      const read = async (source: ReturnType<typeof collection>, cap: number,
        path: string, ownerOnly = false) => {
        const request = ownerOnly
          ? query(source, where('uid', '==', uid), limit(cap + 1))
          : query(source, limit(cap + 1));
        const snapshot = await getDocsFromServer(request);
        result.server.documentsRead += Math.max(1, snapshot.size);
        markFirestoreActualRead(Math.max(1, snapshot.size), 'admin:manual-color-history-' + path);
        if (snapshot.size > cap) result.truncated = true;
        return snapshot.docs.slice(0, cap);
      };

      if (!current()) return;
      try {
        const noteDocs = await read(collection(db, 'favorites'), MAX_FAVORITES, 'note', true);
        if (!current()) return;
        for (const doc of noteDocs) {
          const data = doc.data() as Record<string, unknown>;
          result.server.note.examined++;
          const candidate = classifyNote(data);
          const removed = isMusicNoteItemRemoved(data);
          if (removed) result.noteCoverage.inactiveSongs++;
          else result.noteCoverage.activeSongs++;
          const catalogRow = [doc.id, data.firestoreId, data.id]
            .map((value) => catalogRows.get(String(value || '').trim()))
            .find(Boolean);
          if (!removed && catalogRow) result.noteCoverage.activeInCatalog++;
          if (candidate.conflict) result.server.note.resetConflict++;
          if (candidate.color) {
            if (removed) result.noteCoverage.inactiveColored++;
            else {
              result.noteCoverage.activeColored++;
              if (catalogRow) {
                result.noteCoverage.activeColoredInCatalog++;
                if (!classifyNote(catalogRow).color) {
                  result.noteCoverage.activeCatalogRowWithoutColor++;
                  // Only fill an absent Catalog field, not an explicit gray/reset.
                  if (!has(catalogRow, 'favoriteColorTag') && !has(catalogRow, 'colorTag')) {
                    const key = String(catalogRow.id || '').trim();
                    if (key) noteRecoverable[key] = candidate.color;
                  }
                }
              } else if (result.catalogAvailable) {
                result.noteCoverage.activeColoredMissingFromCatalog++;
              }
            }
          }
          if (candidate.color) {
            pushHit(result, result.server.note, '뮤직노트',
              data.title || data.koreanTitle || data.englishTitle,
              candidate.color, candidate.provenance);
          }
        }
      } catch {
        result.errors.push('뮤직노트 서버 읽기 실패 — 미존재 판정 불가');
      }

      if (!current()) return;
      try {
        const tracks = await read(collection(db, 'suno_tracks', uid, 'tracks'), MAX_TRACKS, 'workspace');
        if (!current()) return;
        for (const doc of tracks) {
          const data = doc.data() as Record<string, unknown>;
          const visible = libraryCatalogRows.get(doc.id)
            || libraryCatalogRows.get(String(data.id || '').trim());
          for (const field of ['colorTags', 'favoriteColorTags']) {
            const values = data[field];
            if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
            for (const [index, color] of Object.entries(values)) {
              result.server.workspace.examined++;
              if (isColor(color)) {
                pushHit(result, result.server.workspace, '라이브러리 음악',
                  data.title || data.koreanTitle || data.englishTitle,
                  color, '현재 필드');
                if (visible) {
                  const trackField = visible[field];
                  const hasColor = trackField && typeof trackField === 'object'
                    && Object.prototype.hasOwnProperty.call(trackField, index);
                  const id = String(visible.id || '').trim();
                  if (!hasColor && id) workspaceRecoverable[`workspace:${field}:${id}:${index}`] = color;
                }
              }
            }
          }
        }
      } catch {
        result.errors.push('라이브러리 음악 서버 읽기 실패 — 미존재 판정 불가');
      }

      if (!current()) return;
      try {
        const playlists = await read(collection(db, 'user_playlists', uid, 'lists'),
          MAX_PLAYLISTS, 'playlist-folders');
        if (!current()) return;
        let budget = MAX_ITEMS_TOTAL;
        for (const folder of playlists) {
          if (!current()) return;
          if (budget <= 0) { result.truncated = true; break; }
          try {
            const maxForFolder = Math.min(MAX_ITEMS_PER_PLAYLIST, budget);
            const items = await read(collection(db, 'user_playlists', uid, 'lists', folder.id, 'items'),
              maxForFolder, 'playlist-items');
            if (!current()) return;
            budget -= items.length;
            for (const item of items) {
              const data = item.data() as Record<string, unknown>;
              result.server.playlist.examined++;
              if (isColor(data.colorTag)) {
                pushHit(result, result.server.playlist, '라이브러리 폴더',
                  data.title || data.koreanTitle || data.englishTitle,
                  data.colorTag, '현재 필드');
              }
            }
          } catch {
            result.errors.push('일부 라이브러리 폴더 읽기 실패 — 미존재 판정 불가');
            break;
          }
        }
      } catch {
        result.errors.push('라이브러리 폴더 서버 읽기 실패 — 미존재 판정 불가');
      }
      if (!current()) return;
      recoverableRef.current = { uid, note: noteRecoverable, workspace: workspaceRecoverable };
      setRestored(null);
      setReport(result);
      setFinished(true);
      setProgress('');
    } finally {
      if (current()) {
        runRef.current = false;
        setBusy(false);
      }
    }
  };

  const restoreToThisDevice = () => {
    const discovered = recoverableRef.current;
    if (!discovered || !finished || busy || restored || auth.currentUser?.uid !== discovered.uid) return;
    const note = applyInspectedColorsToDevice(
      discovered.uid, 'soridraw.favoriteColorTags', discovered.note,
    );
    const workspace = applyInspectedColorsToDevice(
      discovered.uid, 'soridraw.library.workspaceColorTags', discovered.workspace,
    );
    setRestored({ note, workspace });
  };

  return (
    <section className="mt-2 rounded-xl border border-[#a98bff]/20 bg-[#a98bff]/[0.055] p-2.5 text-[11px] text-white/80">
      <div className="font-black text-white/95">과거 지정색 자동 찾기 · 곡 제목 불필요</div>
      <p className="mt-1 text-[10px] leading-4 text-white/55">
        현재 로그인한 내 계정의 뮤직노트·라이브러리 색상 기록을 자동 집계합니다.
        서버 조회는 버튼을 누를 때 한 번만 실행하며, 기존 데이터·캐시·색상은 수정하지 않습니다.
      </p>
      <button type="button" disabled={!auth.currentUser || busy || finished}
        onClick={() => { void inspect(); }}
        className="mt-2 rounded-lg bg-[#a98bff]/25 px-3 py-2 font-bold text-white disabled:opacity-45">
        {busy ? '색상 기록 확인 중…' : finished ? '색상 기록 확인 완료' : '내 과거 색상 기록 자동 찾기 (읽기 전용)'}
      </button>
      <div className="mt-1 text-[10px] leading-4 text-white/40">
        전체 사용자 검색 0 · 원본 쓰기 0 · 서버 문서 최대 약 1,400건 수동 읽기 · 결과는 이 기기 화면에만 표시
      </div>
      {progress && <div className="mt-1 text-[10px] text-[#d8ccff]">{progress}</div>}
      {report && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-black/20 p-2" role="status">
          <div className="font-black">현재 기기에 남은 색상 흔적 (서버 조회 0)</div>
          <div>뮤직노트 로컬 색상표 {report.local.musicNoteMap}건 · 현재 목록 {report.local.visibleNote}건 · Catalog 캐시 {report.local.catalogNote}건</div>
          <div>라이브러리 음악 로컬 {report.local.workspaceMap}건 · 폴더 로컬 {report.local.playlistMap}건</div>
          <div className="mt-2 font-black">내 서버 원본의 지정색 기록</div>
          <div>뮤직노트: {sourceSummary(report.server.note)}</div>
          <div className="mt-1 rounded-md bg-white/[0.04] p-1.5 text-white/80">
            <div className="font-bold">뮤직노트 색상 원본 — 활성/과거 제외 구분</div>
            <div>서버 활성 {report.noteCoverage.activeSongs}건 · 삭제/숨김/저장해제 {report.noteCoverage.inactiveSongs}건</div>
            <div>활성곡 지정색 {report.noteCoverage.activeColored}건 · 제외된 곡의 지정색 {report.noteCoverage.inactiveColored}건</div>
            {report.catalogAvailable ? (
              <>
                <div>활성곡 중 기기 Catalog ID 일치 {report.noteCoverage.activeInCatalog}건</div>
                <div>활성 지정색 중 Catalog ID 일치 {report.noteCoverage.activeColoredInCatalog}건 · Catalog에 없는 활성 지정색 {report.noteCoverage.activeColoredMissingFromCatalog}건</div>
                <div>활성 지정색 원본이 있으나 Catalog 해당 행은 무색 {report.noteCoverage.activeCatalogRowWithoutColor}건</div>
              </>
            ) : <div>기기 Catalog 스냅샷 없음 — 원본과 Catalog의 일치 여부 판정 불가</div>}
            <div className="text-white/50">색상 조회를 추가하지 않고 이미 읽은 서버/기기 기록만 비교한 결과입니다. 제외된 곡을 자동 복원하지 않습니다.</div>
          </div>
          <div>라이브러리 음악: 색상 항목 {sourceSummary(report.server.workspace)}</div>
          <div>라이브러리 폴더: {sourceSummary(report.server.playlist)}</div>
          <div className="text-white/50">서버 조회 문서 약 {report.server.documentsRead}건 · 쓰기 0 · 캐시 변경 0</div>
          <div className="mt-2 rounded-md bg-white/[0.04] p-2">
            <div className="font-bold">서버에 남은 색상 → 이 기기 복원</div>
            <div className="text-white/55">현재 Catalog에 같은 곡 ID가 있고 색상 필드만 누락된 활성곡을 대상으로 합니다. 기존 로컬 지정색·회색 해제는 덮어쓰지 않으며, Firestore·R2 서버 쓰기는 없습니다.</div>
            <button type="button" disabled={busy || restored !== null ||
              !recoverableRef.current ||
              Object.keys(recoverableRef.current.note).length + Object.keys(recoverableRef.current.workspace).length === 0}
              onClick={restoreToThisDevice}
              className="mt-2 rounded-lg bg-[#a98bff]/25 px-3 py-2 font-bold text-white disabled:opacity-45">
              {restored ? '이 기기 복원 완료' : `기존 색상 복원 (뮤직노트 ${Object.keys(recoverableRef.current?.note || {}).length} · 라이브러리 ${Object.keys(recoverableRef.current?.workspace || {}).length})`}
            </button>
            {restored && <div className="mt-1 text-[#d8ccff]">이 기기에 보존: 뮤직노트 {restored.note}건 · 라이브러리 {restored.workspace}건. 현재 화면의 색상 재반영은 해당 페이지에서 확인하세요.</div>}
          </div>
          {report.hits.length > 0 && (
            <div className="mt-1 border-t border-white/10 pt-1">
              <div className="font-bold">찾은 지정색 곡 일부 (최대 24건)</div>
              {report.hits.map((hit, index) => (
                <div key={index} className="mt-1 flex min-w-0 gap-1.5 text-white/70">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: { red: '#ef4444', orange: '#f97316', yellow: '#eab308',
                      green: '#22c55e', blue: '#3b82f6', purple: '#a855f7' }[hit.color] }} />
                  <span className="min-w-0 break-words">{hit.area} · {hit.title} · {COLOR_LABELS[hit.color]} ({hit.provenance})</span>
                </div>
              ))}
            </div>
          )}
          {report.truncated && (
            <div className="text-[#ffcf9c]">검색 상한에 도달해 일부 데이터만 확인했습니다. 색상이 없다고 결론 내릴 수 없습니다.</div>
          )}
          {report.errors.map((error, index) => (
            <div key={index} className="text-[#ffb0b0]">{error}</div>
          ))}
          <div className="mt-1 text-white/50">
            서버에 색이 없더라도 2026년 8월 백업·다른 기기에는 남아 있을 수 있습니다.
            명시적 색상 해제와 과거 값이 충돌하는 경우 자동 복원하지 않습니다.
          </div>
        </div>
      )}
    </section>
  );
}
