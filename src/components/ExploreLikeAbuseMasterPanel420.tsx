import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { auth, functions, httpsCallable } from '../firebase';
import { normalizeStaffRole } from '../constants/adminPermissions';
import {
  USER_PROFILE_CACHE_EVENT,
  isUserProfileCacheStorageKey,
  readUserProfileCache,
} from '../lib/userProfileCache';

// Stage420: isolated Master-only section. The backend repeats Master auth on
// every operation. Client role and buttons are presentation, NOT enforcement.
type LikePolicy420 = {
  warningPerMinute: number;
  limitPerMinute: number;
  suspensionMinutes: number;
};
type LikeGuardStatus420 = {
  ok: boolean;
  acceptedInWindow: number;
  lockedUntilMs: number;
  targetUid: string;
};
const DEFAULT_POLICY420: LikePolicy420 = {
  warningPerMinute: 30,
  limitPerMinute: 40,
  suspensionMinutes: 120,
};
const WARN_OPTIONS = [10, 20, 30, 40, 50, 60];
const LIMIT_OPTIONS = [20, 30, 40, 50, 60, 80, 100];
const SUSPEND_OPTIONS = [30, 60, 120, 240, 360, 720];
const getMaster = () => {
  const uid = auth.currentUser?.uid;
  return Boolean(uid && normalizeStaffRole(readUserProfileCache(uid)) === 'master');
};
const cssInput = 'rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[#BBA8CA]/70 disabled:opacity-50';
const cssButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#BBA8CA] px-4 py-2 text-xs font-black text-[#1b161d] disabled:cursor-not-allowed disabled:opacity-50';

export default function ExploreLikeAbuseMasterPanel420() {
  const [isMaster, setIsMaster] = useState(getMaster);
  const [policy, setPolicy] = useState<LikePolicy420>(DEFAULT_POLICY420);
  const [loadedPolicy, setLoadedPolicy] = useState<LikePolicy420>(DEFAULT_POLICY420);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [targetUid, setTargetUid] = useState('');
  const [status, setStatus] = useState<LikeGuardStatus420 | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const apply = () => setIsMaster(getMaster());
    const onCache = (event: Event) => {
      if ((event as CustomEvent<{ uid?: string }>).detail?.uid === uid) apply();
    };
    const onStorage = (event: StorageEvent) => {
      if (isUserProfileCacheStorageKey(event.key, uid || '')) apply();
    };
    apply();
    window.addEventListener(USER_PROFILE_CACHE_EVENT, onCache as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(USER_PROFILE_CACHE_EVENT, onCache as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!isMaster) return;
    let live = true;
    const run = async () => {
      try {
        const call = httpsCallable<{}, { ok: boolean } & LikePolicy420>(
          functions, 'masterGetExploreLikePolicy420',
        );
        const result = await call({});
        if (!live) return;
        if (!result.data.ok) throw new Error('MASTER_POLICY_UNAVAILABLE');
        const next = {
          warningPerMinute: result.data.warningPerMinute,
          limitPerMinute: result.data.limitPerMinute,
          suspensionMinutes: result.data.suspensionMinutes,
        };
        setPolicy(next);
        setLoadedPolicy(next);
      } catch {
        if (live) setNotice('서버의 좋아요 제한 설정을 확인하지 못했습니다. 현재 값을 저장하지 마세요.');
      }
    };
    void run();
    return () => { live = false; };
  }, [isMaster]);

  if (!isMaster) return null;

  const validPolicy = Number.isInteger(policy.warningPerMinute) &&
    Number.isInteger(policy.limitPerMinute) &&
    Number.isInteger(policy.suspensionMinutes) &&
    policy.warningPerMinute < policy.limitPerMinute;
  const changed = JSON.stringify(policy) !== JSON.stringify(loadedPolicy);

  const save = async () => {
    if (busy || !validPolicy || !changed) return;
    setBusy(true);
    setNotice('');
    try {
      const call = httpsCallable<LikePolicy420, { ok: boolean } & LikePolicy420>(
        functions, 'masterSetExploreLikePolicy420',
      );
      const answer = (await call(policy)).data;
      if (!answer.ok) throw new Error('MASTER_POLICY_NOT_SAVED');
      const next = {
        warningPerMinute: answer.warningPerMinute,
        limitPerMinute: answer.limitPerMinute,
        suspensionMinutes: answer.suspensionMinutes,
      };
      setPolicy(next);
      setLoadedPolicy(next);
      setNotice('좋아요 제한 설정을 저장했습니다. 이미 시작된 1분 구간은 기존 기준을 유지합니다.');
    } catch {
      setNotice('저장하지 못했습니다. Master 권한과 서버 상태를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const findLock = async () => {
    if (!targetUid.trim() || statusBusy) return;
    setStatusBusy(true);
    setStatus(null);
    setNotice('');
    try {
      const call = httpsCallable<{ targetUid: string }, LikeGuardStatus420>(
        functions, 'masterGetExploreLikeLimit420',
      );
      const found = (await call({ targetUid: targetUid.trim() })).data;
      if (!found.ok) throw new Error('MASTER_LOCK_UNAVAILABLE');
      setStatus(found);
    } catch {
      setNotice('계정 제한 상태를 조회하지 못했습니다.');
    } finally {
      setStatusBusy(false);
    }
  };
  const unlock = async () => {
    if (!status || status.lockedUntilMs <= Date.now() || statusBusy) return;
    if (!window.confirm('이 계정의 좋아요·해제 2시간 제한을 지금 해제할까요?')) return;
    setStatusBusy(true);
    try {
      const call = httpsCallable<{ targetUid: string; reason: string }, { ok: boolean; unlocked: boolean }>(
        functions, 'masterUnlockExploreLike420',
      );
      const result = (await call({ targetUid: status.targetUid, reason: 'Master 관리자 직접 해제' })).data;
      if (!result.ok) throw new Error('MASTER_UNLOCK_FAILED');
      setStatus({ ...status, lockedUntilMs: 0, acceptedInWindow: 0 });
      setNotice(result.unlocked ? '좋아요 제한을 해제하고 감사 기록을 남겼습니다.' : '이미 제한이 해제된 계정입니다.');
    } catch {
      setNotice('제한을 해제하지 못했습니다.');
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <section className="rounded-3xl bg-[var(--bg-secondary)] p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-[#BBA8CA]">
          <ShieldAlert className="h-5 w-5"/>
        </div>
        <div>
          <h3 className="text-base font-black text-[var(--text-primary)]">좋아요 남용 방지 · Master 설정</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            같은 계정의 PC·모바일 입력을 합산합니다. 정상적인 한 번 클릭은 즉시 반영합니다.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-xs font-bold text-[var(--text-secondary)]">
          1분 경고 횟수
          <select aria-label="1분 경고 횟수" className={cssInput} value={policy.warningPerMinute}
            onChange={e => setPolicy(p => ({...p, warningPerMinute: Number(e.target.value)}))} disabled={busy}>
            {WARN_OPTIONS.map(value => <option key={value} value={value}>{value}회</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-bold text-[var(--text-secondary)]">
          1분 제한 횟수
          <select aria-label="1분 제한 횟수" className={cssInput} value={policy.limitPerMinute}
            onChange={e => setPolicy(p => ({...p, limitPerMinute: Number(e.target.value)}))} disabled={busy}>
            {LIMIT_OPTIONS.map(value => <option key={value} value={value}>{value}회</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-bold text-[var(--text-secondary)]">
          2분 연속 초과 시 잠금
          <select aria-label="좋아요 잠금 시간" className={cssInput} value={policy.suspensionMinutes}
            onChange={e => setPolicy(p => ({...p, suspensionMinutes: Number(e.target.value)}))} disabled={busy}>
            {SUSPEND_OPTIONS.map(value => <option key={value} value={value}>{value}분</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button className={cssButton} type="button" onClick={save} disabled={busy || !validPolicy || !changed}>
          {busy && <Loader2 className="h-4 w-4 animate-spin"/>}
          제한 기준 저장
        </button>
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="mb-3 text-xs font-black text-[var(--text-primary)]">계정 잠금 조회 및 조기 해제</p>
        <div className="flex flex-wrap gap-2">
          <input aria-label="잠금 계정 UID" className={cssInput + ' min-w-0 flex-1'} placeholder="계정 UID"
            value={targetUid} onChange={e => setTargetUid(e.target.value)} disabled={statusBusy}/>
          <button type="button" className={cssButton} disabled={statusBusy || !targetUid.trim()}
            onClick={findLock}>
            {statusBusy && <Loader2 className="h-4 w-4 animate-spin"/>}
            제한 확인
          </button>
        </div>
        {status && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/15 p-3">
            <span className="text-xs text-[var(--text-secondary)]">
              {status.lockedUntilMs > Date.now()
                ? `제한 중 · ${new Date(status.lockedUntilMs).toLocaleString('ko-KR')} 해제 예정`
                : '현재 제한 없음'}
            </span>
            {status.lockedUntilMs > Date.now() && (
              <button type="button" className={cssButton} disabled={statusBusy} onClick={unlock}>조기 해제</button>
            )}
          </div>
        )}
      </div>
      {notice && <p role="status" className="mt-3 text-xs font-bold text-[#BBA8CA]">{notice}</p>}
    </section>
  );
}
