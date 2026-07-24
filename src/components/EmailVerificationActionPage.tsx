import React, { useEffect, useRef, useState } from 'react';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { auth } from '../firebase';

type VerificationState = 'checking' | 'success' | 'error';

const getVerificationErrorMessage = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code || 'unknown';
  if (code === 'auth/expired-action-code') return '인증 링크의 유효시간이 지났습니다. 앱에서 인증메일을 다시 보내주세요.';
  if (code === 'auth/invalid-action-code') return '이미 사용했거나 올바르지 않은 인증 링크입니다. 앱에서 인증 상태를 확인해주세요.';
  if (code === 'auth/user-disabled') return '사용이 제한된 계정입니다. 관리자에게 문의해주세요.';
  if (code === 'auth/user-not-found') return '해당 이메일 계정을 찾을 수 없습니다.';
  return `이메일 인증을 완료하지 못했습니다. 앱에서 인증메일을 다시 보내주세요. (${code})`;
};

export default function EmailVerificationActionPage() {
  const hasHandledActionRef = useRef(false);
  const [status, setStatus] = useState<VerificationState>('checking');
  const [message, setMessage] = useState('인증 링크를 확인하고 있습니다.');

  useEffect(() => {
    if (hasHandledActionRef.current) return;
    hasHandledActionRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode !== 'verifyEmail' || !oobCode) {
      setStatus('error');
      setMessage('올바른 이메일 인증 링크가 아닙니다.');
      return;
    }

    let isCancelled = false;
    const verifyEmail = async () => {
      try {
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
        if (auth.currentUser) {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
        }
        if (isCancelled) return;
        window.history.replaceState({}, '', '/auth/action?verified=1');
        setStatus('success');
        setMessage('이메일 인증이 완료되었습니다.');
      } catch (error) {
        if (isCancelled) return;
        console.error('Email verification action error:', error);
        setStatus('error');
        setMessage(getVerificationErrorMessage(error));
      }
    };

    void verifyEmail();
    return () => {
      isCancelled = true;
    };
  }, []);

  const goHome = () => window.location.assign('/');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100e0f] px-4 py-10 text-white">
      <section className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#171415] p-7 text-center shadow-[0_30px_110px_rgba(0,0,0,0.65)] md:p-9">
        <p className="text-[11px] font-black tracking-[0.28em] text-[#F2C587]">SORIDRAW</p>

        {status === 'checking' && (
          <>
            <div className="mx-auto mt-6 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#F2C587]" />
            <h1 className="mt-6 text-2xl font-black">이메일 인증 확인 중</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-white/55">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-3xl font-black text-emerald-300">✓</div>
            <h1 className="mt-6 text-2xl font-black">이메일 인증 완료</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-white/60">{message}<br />이제 SORIDRAW를 이용할 수 있습니다.</p>
            <button
              type="button"
              onClick={goHome}
              className="mt-7 h-12 w-full rounded-xl bg-gradient-to-r from-[#FFD84F] via-[#FF9B72] to-[#F06C8B] px-5 text-sm font-black text-[#151313] transition-all hover:brightness-110"
            >
              SORIDRAW 시작하기
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full border border-rose-300/20 bg-rose-300/10 text-3xl font-black text-rose-300">!</div>
            <h1 className="mt-6 text-2xl font-black">인증을 확인해주세요</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-white/60">{message}</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
              <p className="text-xs font-bold leading-5 text-white/50">SORIDRAW 로그인 화면에서 인증메일을 다시 보낸 뒤 새 링크를 눌러주세요.</p>
            </div>
            <button
              type="button"
              onClick={goHome}
              className="mt-6 h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-5 text-sm font-black text-white transition-all hover:bg-white/[0.1]"
            >
              SORIDRAW로 돌아가기
            </button>
          </>
        )}

        <p className="mt-7 text-[11px] font-bold text-white/30">SORIDRAW팀</p>
      </section>
    </main>
  );
}
