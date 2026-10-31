import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  summarizeExactRecentLocal,
  summarizeExactRecentServer,
  type RecentLocalSummary,
  type RecentServerSummary,
} from '../lib/recentSongsExactCountDiagnostic';

type Report = { local: RecentLocalSummary; server: RecentServerSummary };
type Status = 'idle' | 'reading' | 'done' | 'failed';

// Only rendered inside the existing admin-only CACHE LIVE overlay.
// One explicit button click = at most one own UID Firestore document GET;
// no effect may read the network, and no method writes user data.
export default function RecentSongsExactCountDiagnostic() {
  const [status, setStatus] = useState<Status>('idle');
  const [report, setReport] = useState<Report | null>(null);
  const [failure, setFailure] = useState('');
  const requestGenerationRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      requestGenerationRef.current += 1;
      busyRef.current = false;
      setStatus('idle');
      setReport(null);
      setFailure('');
    });
    return () => {
      requestGenerationRef.current += 1;
      busyRef.current = false;
      unsubscribe();
    };
  }, []);

  const inspectOnce = async () => {
    const uid = String(auth.currentUser?.uid || '').trim();
    if (!uid || busyRef.current || status === 'done') return;
    const generation = ++requestGenerationRef.current;
    const isCurrent = () => generation === requestGenerationRef.current && auth.currentUser?.uid === uid;
    busyRef.current = true;
    setStatus('reading');
    setFailure('');
    setReport(null);
    // Do not clear, restore, or rewrite any user data. Count only two exact
    // UID-scoped keys; if local storage is blocked, report that distinctly.
    const local = summarizeExactRecentLocal(uid, (key) => window.localStorage.getItem(key));
    try {
      const snap = await getDocFromServer(doc(db, 'user_recent_songs', uid));
      if (!isCurrent()) return;
      const server = summarizeExactRecentServer(
        snap.exists(),
        snap.exists() ? snap.data() as Record<string, unknown> : undefined,
      );
      setReport({ local, server });
      setStatus('done');
    } catch (error: unknown) {
      if (!isCurrent()) return;
      const code = String((error as { code?: string })?.code || '');
      setFailure(code.includes('permission-denied')
        ? '권한 거부 — 서버 원본 없음으로 판단하면 안 됩니다.'
        : code.includes('unauthenticated')
          ? '인증 실패 — 다시 로그인한 뒤 확인해야 합니다.'
          : '서버 읽기 실패 — 네트워크 또는 서버 상태를 확인해야 합니다.');
      setStatus('failed');
    } finally {
      if (isCurrent()) busyRef.current = false;
    }
  };

  const label = (slot: { status: string; count: number }) => {
    if (slot.status === 'missing') return '없음';
    if (slot.status === 'invalid') return '형식 오류';
    if (slot.status === 'blocked') return '저장소 접근 불가';
    return `${slot.count}곡`;
  };

  return (
    <div className="mt-2 rounded-xl bg-white/[0.035] p-2.5 text-[11px] text-white/75">
      <div className="font-black text-white/90">최근 생성곡 원본 확인 · 읽기 전용</div>
      <div className="mt-1 text-[10px] leading-4 text-white/55">
        클릭할 때만 현재 로그인 계정의 서버 문서 1건을 읽습니다. 곡·캐시·원본을 수정하지 않습니다.
      </div>
      <button
        type="button"
        onClick={() => void inspectOnce()}
        disabled={!auth.currentUser || busyRef.current || status === 'reading' || status === 'done'}
        className="mt-2 rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-[11px] font-bold text-white/90 disabled:opacity-40"
      >
        {status === 'reading' ? '확인 중…' : status === 'done' ? '서버 원본 확인 완료' : '최근곡 원본 1건 확인'}
      </button>
      {report && (
        <div className="mt-2 space-y-1 text-[11px] font-bold text-white/75" role="status">
          <div>서버 문서: {report.server.exists ? '있음' : '없음'}</div>
          <div>서버 곡: {report.server.rawCount}개 · 화면 인식 가능한 곡: {report.server.renderableCount}개</div>
          <div>서버 songs 형식: {report.server.songsField === 'array' ? '정상 배열' : report.server.songsField === 'missing' ? '필드 없음' : '형식 다름'}</div>
          <div>현재 브라우저 캐시: {label(report.local.primary)} · 백업: {label(report.local.backup)}</div>
          <div className="text-[10px] text-white/55">곡 제목·가사·계정번호는 표시하지 않습니다. 자동 복구나 서버 쓰기는 실행하지 않았습니다.</div>
        </div>
      )}
      {failure && <div className="mt-2 text-[11px] font-semibold text-[#ffb0b0]" role="alert">{failure}</div>}
    </div>
  );
}
