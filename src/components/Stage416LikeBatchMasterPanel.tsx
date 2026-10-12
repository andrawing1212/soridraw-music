import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { auth, functions, httpsCallable } from '../firebase';
import { normalizeStaffRole } from '../constants/adminPermissions';
import {
  USER_PROFILE_CACHE_EVENT, isUserProfileCacheStorageKey, readUserProfileCache,
} from '../lib/userProfileCache';
import {
  CACHE_DIAGNOSTICS_TOGGLE_EVENT, readCacheDiagnosticsEnabled,
} from '../lib/cacheDiagnostics';
import {
  readStage416PrivateAcceptanceDiagnostic416,
  STAGE416_PRIVATE_ACCEPTANCE_DIAGNOSTIC_EVENT,
  type Stage416PrivateAcceptanceDiagnostic416,
} from '../services/exploreLikePrivateDiagnostic416';

// Stage416 Master-only section: both settings are independent, not the
// Stage420 abuse/lock panel. Server checks Master on each get/set.
type Timing416 = {
  privateMinutes: number;
  publicMinutes: number;
  version: number;
  updatedAtMs: number;
};
const OPTIONS = [1, 3, 5, 10, 20] as const;
const DEFAULT: Timing416 = { privateMinutes: 5, publicMinutes: 5, version: 0, updatedAtMs: 0 };
const isMaster = () => {
  const uid = auth.currentUser?.uid || '';
  return !!uid && normalizeStaffRole(readUserProfileCache(uid)) === 'master';
};
const formatDiagnosticTime416 = (updatedAt: number) => {
  if (!updatedAt) return '-';
  try { return new Date(updatedAt).toLocaleTimeString('ko-KR', { hour12: false }); }
  catch { return '-'; }
};

export default function Stage416LikeBatchMasterPanel() {
  const [allowed, setAllowed] = useState(isMaster);
  const [loaded, setLoaded] = useState<Timing416 | null>(null);
  const [draft, setDraft] = useState<Timing416>(DEFAULT);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [acceptanceDiagnostic, setAcceptanceDiagnostic] =
    useState<Stage416PrivateAcceptanceDiagnostic416 | null>(() =>
      readStage416PrivateAcceptanceDiagnostic416(auth.currentUser?.uid || ''));

  useEffect(() => {
    const uid = auth.currentUser?.uid || '';
    const refreshRole = () => setAllowed(isMaster());
    const onCache = (event: Event) => {
      if ((event as CustomEvent<{ uid?: string }>).detail?.uid === uid) refreshRole();
    };
    const onStorage = (event: StorageEvent) => {
      if (isUserProfileCacheStorageKey(event.key, uid)) refreshRole();
    };
    window.addEventListener(USER_PROFILE_CACHE_EVENT, onCache as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(USER_PROFILE_CACHE_EVENT, onCache as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const syncDiagnostic = () => setAcceptanceDiagnostic(
      readStage416PrivateAcceptanceDiagnostic416(auth.currentUser?.uid || ''),
    );
    window.addEventListener(
      STAGE416_PRIVATE_ACCEPTANCE_DIAGNOSTIC_EVENT, syncDiagnostic as EventListener);
    window.addEventListener(
      CACHE_DIAGNOSTICS_TOGGLE_EVENT, syncDiagnostic as EventListener);
    syncDiagnostic();
    return () => {
      window.removeEventListener(
        STAGE416_PRIVATE_ACCEPTANCE_DIAGNOSTIC_EVENT, syncDiagnostic as EventListener);
      window.removeEventListener(
        CACHE_DIAGNOSTICS_TOGGLE_EVENT, syncDiagnostic as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    const load = async () => {
      try {
        const call = httpsCallable<{}, { ok: boolean } & Timing416>(
          functions, 'masterGetLikeBatchTiming416',
        );
        const answer = (await call({})).data;
        if (!live) return;
        if (!answer.ok || !OPTIONS.includes(answer.privateMinutes as typeof OPTIONS[number]) ||
            !OPTIONS.includes(answer.publicMinutes as typeof OPTIONS[number]) ||
            !Number.isSafeInteger(answer.version)) throw new Error('INVALID_416_POLICY');
        const next = {
          privateMinutes: answer.privateMinutes,
          publicMinutes: answer.publicMinutes,
          version: answer.version,
          updatedAtMs: answer.updatedAtMs,
        };
        setLoaded(next);
        setDraft(next);
      } catch {
        if (live) setNotice('저장 주기 설정을 불러오지 못했습니다. 저장을 잠시 사용할 수 없습니다.');
      }
    };
    void load();
    return () => { live = false; };
  }, [allowed]);

  if (!allowed) return null;
  const changed = !!loaded && (
    loaded.privateMinutes !== draft.privateMinutes ||
    loaded.publicMinutes !== draft.publicMinutes
  );
  const save = async () => {
    if (busy || !changed || !loaded) return;
    setBusy(true);
    setNotice('');
    try {
      const call = httpsCallable<
        { privateMinutes: number; publicMinutes: number; expectedVersion: number },
        { ok: boolean } & Timing416
      >(functions, 'masterSetLikeBatchTiming416');
      const response = (await call({
        privateMinutes: draft.privateMinutes,
        publicMinutes: draft.publicMinutes,
        expectedVersion: loaded.version,
      })).data;
      if (!response.ok) throw new Error('INVALID_416_SAVED_POLICY');
      const next = {
        privateMinutes: response.privateMinutes,
        publicMinutes: response.publicMinutes,
        version: response.version,
        updatedAtMs: response.updatedAtMs,
      };
      setLoaded(next);
      setDraft(next);
      setNotice('저장했습니다. 이미 진행 중인 개인 대기·공동 집계 창은 이전 주기를 유지합니다.');
    } catch {
      // Master or stale revision must never be treated as successfully saved.
      setNotice('저장하지 못했습니다. 다른 관리자의 변경 여부를 확인하려면 화면을 다시 열어주세요.');
    } finally { setBusy(false); }
  };
  const css = 'rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-[var(--text-primary)] disabled:opacity-50';
  return (
    <section className="rounded-3xl bg-[var(--bg-secondary)] p-5 md:p-6">
      <h3 className="text-sm font-black text-[var(--text-primary)]">좋아요 저장·공개 집계 주기</h3>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        개인 좋아요는 기기 간 즉시 보이고, 원본 저장과 전체 공개 숫자는 따로 묶습니다.
        설정 변경은 각 작업의 다음 새 대기창부터 적용됩니다.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {([
          { key: 'privateMinutes' as const, label: '개인 최종상태 서버 저장' },
          { key: 'publicMinutes' as const, label: '모든 사용자 공개숫자 공동 집계' },
        ]).map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-2 text-xs font-black text-[var(--text-primary)]">
            {label}
            <select
              className={css}
              value={draft[key]}
              disabled={!loaded || busy}
              onChange={(event) => setDraft((value) => ({ ...value, [key]: Number(event.target.value) }))}
            >
              {OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes}분</option>)}
            </select>
          </label>
        ))}
      </div>
      <button type="button" onClick={() => void save()} disabled={!changed || busy}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#BBA8CA] px-4 py-2 text-xs font-black text-[#1b161d] disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 주기 저장
      </button>
      {notice && <p className="mt-3 text-xs font-bold text-[var(--text-secondary)]">{notice}</p>}
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black text-[var(--text-primary)]">Stage416 서버 접수 진단</p>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">
              캐시 진단 ON일 때 이 기기에서 받은 Callable 응답만 기록합니다.
              UID·곡 ID·요청 ID 원문과 서버 추가 조회는 사용하지 않습니다.
            </p>
          </div>
          <span className="rounded-lg bg-white/[0.055] px-2 py-1 text-[10px] font-black text-[var(--text-secondary)]">
            {readCacheDiagnosticsEnabled(auth.currentUser?.uid || '') ? '진단 ON' : '진단 OFF'}
          </span>
        </div>
        {!readCacheDiagnosticsEnabled(auth.currentUser?.uid || '') ? (
          <p className="mt-3 text-xs font-bold text-[var(--text-secondary)]">
            아래 ‘캐시 진단 표시’를 ON으로 켠 뒤 익스플로어에서 좋아요를 1회 테스트하세요.
          </p>
        ) : !acceptanceDiagnostic ? (
          <p className="mt-3 text-xs font-bold text-[var(--text-secondary)]">
            아직 이 세션에서 Stage416 서버 접수 응답을 받지 않았습니다.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 text-[11px] font-bold text-[var(--text-secondary)] sm:grid-cols-2">
            <p>요청: {acceptanceDiagnostic.operationToken} · {acceptanceDiagnostic.source === 'recovery' ? '복구 재접수' : '최초 접수'} · {acceptanceDiagnostic.attempt}회</p>
            <p>응답: {acceptanceDiagnostic.phase === 'error' ? '호출 오류' : acceptanceDiagnostic.serverAccepted ? '서버 승인' : '서버 거절'} · {acceptanceDiagnostic.reason}</p>
            <p>증명: receipt {acceptanceDiagnostic.receiptValid ? '유효' : '미확정'} · version {acceptanceDiagnostic.version ?? '-'}</p>
            <p>로컬 outbox: {acceptanceDiagnostic.outboxRegistered ? '서버 등록 완료' : '등록 대기'} · {formatDiagnosticTime416(acceptanceDiagnostic.updatedAt)}</p>
          </div>
        )}
      </div>
    </section>
  );
}
