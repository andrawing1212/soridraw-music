import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

type ReturnState = 'checking' | 'verified-current' | 'login-required' | 'error';

const clearCachedAuthHints = () => {
  try {
    localStorage.removeItem('soridraw_cached_user_role_v1');
  } catch {
    // Storage may be unavailable in restricted browser modes.
  }
};

export default function EmailVerificationReturnPage() {
  const [status, setStatus] = useState<ReturnState>('checking');
  const [message, setMessage] = useState('인증된 계정과 현재 로그인 계정을 안전하게 확인하고 있습니다.');

  useEffect(() => {
    const expectedUid = new URLSearchParams(window.location.search).get('uid') || '';
    let cancelled = false;
    let handled = false;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (handled || cancelled) return;
      handled = true;

      try {
        if (!expectedUid) {
          if (currentUser) await signOut(auth);
          clearCachedAuthHints();
          if (cancelled) return;
          setStatus('login-required');
          setMessage('이메일 인증은 완료되었습니다. 인증한 이메일 계정으로 다시 로그인해주세요.');
          return;
        }

        if (!currentUser) {
          if (cancelled) return;
          setStatus('login-required');
          setMessage('이메일 인증은 완료되었습니다. 인증한 이메일 계정으로 로그인해주세요.');
          return;
        }

        if (currentUser.uid !== expectedUid) {
          await signOut(auth);
          clearCachedAuthHints();
          if (cancelled) return;
          setStatus('login-required');
          setMessage('다른 계정이 로그인되어 있어 안전하게 로그아웃했습니다. 인증한 이메일 계정으로 로그인해주세요.');
          return;
        }

        await currentUser.reload();
        if (!currentUser.emailVerified) {
          await signOut(auth);
          clearCachedAuthHints();
          if (cancelled) return;
          setStatus('login-required');
          setMessage('인증 상태 반영을 위해 인증한 이메일 계정으로 다시 로그인해주세요.');
          return;
        }

        await currentUser.getIdToken(true);
        if (cancelled) return;
        setStatus('verified-current');
        setMessage('현재 로그인된 계정의 이메일 인증이 완료되었습니다.');
      } catch (error) {
        console.error('Email verification return check error:', error);
        if (cancelled) return;
        setStatus('error');
        setMessage('인증 계정 확인 중 오류가 발생했습니다. 로그인 화면에서 다시 로그인해주세요.');
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const continueToApp = () => {
    window.location.assign(status === 'verified-current' ? '/' : '/?auth=login');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100e0f] px-4 py-10 text-white">
      <section className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#171415] p-7 text-center shadow-[0_30px_110px_rgba(0,0,0,0.65)] md:p-9">
        <p className="text-[11px] font-black tracking-[0.28em] text-[#F2C587]">SORIDRAW</p>

        {status === 'checking' ? (
          <>
            <div className="mx-auto mt-6 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#F2C587]" />
            <h1 className="mt-6 text-2xl font-black">계정 확인 중</h1>
          </>
        ) : (
          <>
            <div className={`mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full border text-3xl font-black ${status === 'error' ? 'border-rose-300/20 bg-rose-300/10 text-rose-300' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300'}`}>
              {status === 'error' ? '!' : '✓'}
            </div>
            <h1 className="mt-6 text-2xl font-black">{status === 'error' ? '계정을 다시 확인해주세요' : '이메일 인증 완료'}</h1>
          </>
        )}

        <p className="mt-3 text-sm font-bold leading-6 text-white/60">{message}</p>

        {status !== 'checking' && (
          <button
            type="button"
            onClick={continueToApp}
            className="mt-7 h-12 w-full rounded-xl bg-gradient-to-r from-[#FFD84F] via-[#FF9B72] to-[#F06C8B] px-5 text-sm font-black text-[#151313] transition-all hover:brightness-110"
          >
            {status === 'verified-current' ? 'SORIDRAW 시작하기' : '인증한 계정으로 로그인'}
          </button>
        )}

        <p className="mt-7 text-[11px] font-bold text-white/30">SORIDRAW팀</p>
      </section>
    </main>
  );
}
