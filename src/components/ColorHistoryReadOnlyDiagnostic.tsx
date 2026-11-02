import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDocsFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { collection, limit, query, where } from '../lib/firestoreMeasured';
import { markFirestoreActualRead } from '../lib/cacheDiagnostics';
import { favoritesStore } from '../hooks/useFavoritesStore';
import { readCatalogSnapshotFromLocalCache } from '../lib/userDataEngine';

// Admin CACHE LIVE only. Nothing is read from the server until the signed-in
// owner explicitly clicks once; no document, cache, or backup is ever written.
type Color = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
type ColorArea = '뮤직노트' | '라이브러리 음악' | '라이브러리 폴더';
type Hit = { area: ColorArea; color: Color; title: string; provenance: '현재 필드' | '과거 필드' };
type Stats = { examined: number; current: number; legacy: number; resetConflict: number; byColor: Record<Color, number> };
type AuditResult = {
  local: { musicNoteMap: number; workspaceMap: number; playlistMap: number; visibleNote: number; catalogNote: number };
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      generationRef.current++;
      runRef.current = false;
      setBusy(false);
      setFinished(false);
      setProgress('');
      setReport(null);
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
    const result: AuditResult = {
      local: { musicNoteMap: 0, workspaceMap: 0, playlistMap: 0, visibleNote: 0, catalogNote: 0 },
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
      try {
        const catalog = await readCatalogSnapshotFromLocalCache('musicNote', uid);
        if (!current()) return;
        result.local.catalogNote = (catalog?.items || [])
          .filter((song: any) => Boolean(classifyNote(song).color)).length;
      } catch {
        result.errors.push('기기 Catalog 캐시 확인 실패 (서버 원본 유실을 의미하지 않음)');
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
          if (candidate.conflict) result.server.note.resetConflict++;
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
          for (const field of ['colorTags', 'favoriteColorTags']) {
            const values = data[field];
            if (!values || typeof values !== 'object') continue;
            for (const color of Object.values(values)) {
              result.server.workspace.examined++;
              if (isColor(color)) {
                pushHit(result, result.server.workspace, '라이브러리 음악',
                  data.title || data.koreanTitle || data.englishTitle,
                  color, '현재 필드');
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
          <div>라이브러리 음악: 색상 항목 {sourceSummary(report.server.workspace)}</div>
          <div>라이브러리 폴더: {sourceSummary(report.server.playlist)}</div>
          <div className="text-white/50">서버 조회 문서 약 {report.server.documentsRead}건 · 쓰기 0 · 캐시 변경 0</div>
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
