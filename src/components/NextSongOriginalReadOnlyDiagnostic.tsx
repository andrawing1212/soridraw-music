import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDocFromServer } from '../lib/firestoreMeasured';
import {
  NEXT_SONG_ORIGINAL_PROBE_EVENT,
  readNextSongOriginalProbeSelection,
  summarizeOriginalInputPresence,
  findNextSongOriginalInRecent,
  type NextSongOriginalProbeSelection,
  type OriginalInputPresence,
} from '../lib/nextSongOriginalProbe';

type ProbeLine = { label: string; outcome: string; fields: OriginalInputPresence | null };
const EMPTY: OriginalInputPresence = { present: [], empty: [] };

// Admin-only CACHE LIVE child. A deliberate button click performs up to four
// exact own-account document reads, never a collection scan or data mutation.
export default function NextSongOriginalReadOnlyDiagnostic() {
  const [, redraw] = useState(0);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ProbeLine[] | null>(null);
  const [attempted, setAttempted] = useState(0);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const [inspectedSelection, setInspectedSelection] = useState<NextSongOriginalProbeSelection | null>(null);
  const uid = String(auth.currentUser?.uid || '').trim();
  const selection = readNextSongOriginalProbeSelection(uid);

  useEffect(() => {
    const onSource = () => {
      requestId.current += 1;
      setResults(null);
      setInspectedSelection(null);
      setAttempted(0);
      redraw((current) => current + 1);
    };
    const unsubscribe = onAuthStateChanged(auth, onSource);
    window.addEventListener(NEXT_SONG_ORIGINAL_PROBE_EVENT, onSource);
    return () => {
      requestId.current += 1;
      unsubscribe();
      window.removeEventListener(NEXT_SONG_ORIGINAL_PROBE_EVENT, onSource);
    };
  }, []);

  const inspect = async () => {
    const currentUid = String(auth.currentUser?.uid || '').trim();
    const selected = readNextSongOriginalProbeSelection(currentUid);
    if (inFlight.current || !selected || inspectedSelection === selected) return;
    const sequence = ++requestId.current;
    const isCurrent = () => sequence === requestId.current
      && auth.currentUser?.uid === currentUid
      && readNextSongOriginalProbeSelection(currentUid) === selected;
    inFlight.current = true;
    setBusy(true);
    setResults(null);
    setAttempted(0);
    const output: ProbeLine[] = [];
    let readCount = 0;
    const readExact = async (label: string, segments: string[], kind: 'normal' | 'recent') => {
      if (!isCurrent()) return;
      readCount += 1;
      try {
        const snapshot = await getDocFromServer(doc(db, segments[0], ...segments.slice(1)));
        if (!isCurrent()) return;
        if (!snapshot.exists()) {
          output.push({ label, outcome: '해당 문서 없음 (다른 저장 위치까지 없다는 뜻은 아님)', fields: null });
          return;
        }
        const data = snapshot.data() as Record<string, any>;
        const owner = String(data.uid || data.ownerUid || '').trim();
        if (kind === 'normal' && owner && owner !== currentUid) {
          output.push({ label, outcome: '소유자 불일치 · 내용 검사 제외', fields: null });
          return;
        }
        if (kind === 'recent') {
          const found = findNextSongOriginalInRecent(data, selected);
          const notes = {
            matched: '안정적인 곡 식별자 일치',
            'task-candidate': '작업번호로 찾은 후보 1건 · 동일 곡 확정은 아님',
            'not-matched': '최근 저장된 곡에 일치 없음 · 과거 원본 부재 확정 아님',
            ambiguous: '동일 후보가 여러 곡 · 판정 보류',
            invalid: '최근곡 목록 형식 또는 검사 상한 문제 · 판정 불가',
          };
          output.push({
            label, outcome: notes[found.status],
            fields: found.song ? summarizeOriginalInputPresence(found.song) : null,
          });
          return;
        }
        output.push({
          label, outcome: '본인 계정 경로에 문서 존재',
          fields: summarizeOriginalInputPresence(data),
        });
      } catch (error: unknown) {
        if (!isCurrent()) return;
        const code = String((error as {code?: string})?.code || '');
        output.push({
          label,
          outcome: code.includes('permission-denied') ? '권한 거부 · 원본 없음으로 판단 금지'
            : '서버 읽기 실패 · 원본 없음으로 판단 금지',
          fields: null,
        });
      }
    };
    try {
      if (selected.favoriteId) {
        await readExact('뮤직노트 favorites/{곡}', ['favorites', selected.favoriteId], 'normal');
      }
      if (selected.trackId) {
        await readExact('Suno Library suno_tracks/{본인}/tracks/{곡}',
          ['suno_tracks', currentUid, 'tracks', selected.trackId], 'normal');
      }
      if (selected.playlistId && selected.playlistItemId) {
        await readExact('Library 폴더 user_playlists/{본인}/lists/{폴더}/items/{곡}',
          ['user_playlists', currentUid, 'lists', selected.playlistId, 'items', selected.playlistItemId], 'normal');
      }
      if (selected.stableSongId || selected.taskId) {
        await readExact('최근 생성곡 user_recent_songs/{본인}.songs',
          ['user_recent_songs', currentUid], 'recent');
      }
      if (isCurrent()) {
        setResults(output.length ? output : [{ label: '확인 가능한 경로', outcome: '안전하게 일치시킬 곡 식별자가 없습니다. 추정 검색은 하지 않았습니다.', fields: EMPTY }]);
        setAttempted(readCount);
        setInspectedSelection(selected);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="mt-2 rounded-xl bg-white/[0.035] p-2.5 text-[11px] text-white/75">
      <div className="font-black text-white/90">마지막 ‘다음곡에 적용’ 원본 위치 찾기 · 읽기 전용</div>
      <div className="mt-1 text-[10px] leading-4 text-white/55">
        확인하려는 옛 곡에서 ‘다음곡에 적용’을 누른 뒤 이 버튼을 사용하세요.
        곡 제목이나 문서번호 입력 불필요 · 본인 계정 원본 후보 최대 4건 · 방문만으로 읽기 0.
        실제 명령문/가사는 표시하거나 복사하지 않고 필드 위치만 확인합니다.
      </div>
      <div className="mt-1 text-white/60">
        선택: {selection ? (selection.origin === 'musicNote' ? 'Music Note' : selection.origin === 'library' ? 'Library' : '재생기') : '현재 탭의 선택 기록 없음'}
      </div>
      <button type="button" disabled={!selection || busy || inspectedSelection === selection}
        onClick={() => void inspect()}
        className="mt-2 rounded-lg bg-white/[0.08] px-2.5 py-1.5 font-bold text-white/90 disabled:opacity-40">
        {busy ? '원본 경로 확인 중…' : inspectedSelection === selection ? '이번 곡 확인 완료' : '선택한 옛 곡 원본 위치 확인 (최대 R4)'}
      </button>
      {results && <div className="mt-2 space-y-2" role="status">
        <div className="font-bold">확인 시도 {attempted}개 문서 · 서버 쓰기 0 · 원본 복원 0</div>
        {results.map((item, index) => <div key={index} className="rounded-lg bg-black/20 px-2 py-1.5">
          <div className="font-bold text-white/90">{item.label}</div>
          <div>{item.outcome}</div>
          {item.fields && <>
            <div>값이 남은 원본 필드: {item.fields.present.length ? item.fields.present.join(', ') : '확인되지 않음'}</div>
            <div className="text-white/50">빈값·명시적 해제 필드: {item.fields.empty.length ? item.fields.empty.join(', ') : '확인되지 않음'}</div>
          </>}
        </div>)}
        <div className="text-white/50">생성 결과의 음악 프롬프트/완성 가사는 원본 직접입력으로 취급하지 않습니다. 일치 후보 없음은 원본 소실 증거가 아닙니다.</div>
      </div>}
    </section>
  );
}
