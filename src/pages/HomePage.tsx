import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Wand2, Library, Heart, User, ArrowRight, Music2, Mic2 } from 'lucide-react';
import type { User } from 'firebase/auth';

type HomePageProps = {
  user: User | null;
  onLogin: () => void;
  isLoggingIn?: boolean;
};

const quickCards = [
  {
    title: '스튜디오',
    desc: '가사와 5단 프롬프트를 설계하는 메인 작업실',
    path: '/studio',
    icon: Wand2,
    accent: 'from-amber-300/90 via-pink-400/85 to-violet-500/85',
  },
  {
    title: '뮤직노트',
    desc: '저장한 가사, 프롬프트, 설정값을 다시 꺼내 쓰기',
    path: '/history',
    icon: Heart,
    accent: 'from-pink-400/85 to-violet-500/85',
  },
  {
    title: '라이브러리',
    desc: 'Music API로 만든 곡과 재생 가능한 URL 확인',
    path: '/suno-library',
    icon: Library,
    accent: 'from-fuchsia-400/80 to-purple-500/85',
  },
  {
    title: '마이페이지',
    desc: 'API 연결, 플랜, 사용량, 개인 설정 관리',
    path: '/my-page',
    icon: User,
    accent: 'from-violet-400/80 to-rose-300/75',
  },
];

export default function HomePage({ user, onLogin, isLoggingIn }: HomePageProps) {
  const navigate = useNavigate();

  const go = (path: string) => {
    if (!user) {
      onLogin();
      return;
    }
    navigate(path);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#08050f] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-90">
        <div className="absolute -top-44 left-[18%] h-[440px] w-[440px] rounded-full bg-violet-600/14 blur-[120px]" />
        <div className="absolute right-[-140px] top-24 h-[420px] w-[420px] rounded-full bg-pink-500/12 blur-[120px]" />
        <div className="absolute bottom-[-180px] left-[8%] h-[460px] w-[460px] rounded-full bg-amber-300/10 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,0.08),transparent_34%),radial-gradient(circle_at_70%_18%,rgba(250,204,21,0.055),transparent_28%)]" />
      </div>

      <section className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-4 pb-16 pt-24 md:px-6 md:pt-28">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#15101e]/80 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl md:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/55 to-transparent" />
            <div className="absolute right-8 top-8 hidden h-24 w-24 rounded-full border border-white/10 bg-gradient-to-br from-amber-300/18 via-pink-400/18 to-violet-500/18 blur-sm md:block" />
            <div className="relative z-10 max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-pink-100/85">
                <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                Creative Music Workspace
              </div>
              <h1 className="text-4xl font-black leading-tight tracking-[-0.055em] text-white md:text-6xl">
                감각적인 음악 아이디어를<br className="hidden md:block" />
                <span className="bg-gradient-to-r from-amber-200 via-pink-300 to-violet-300 bg-clip-text text-transparent">완성도 있는 곡 설계</span>로.
              </h1>
              <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-zinc-300 md:text-base">
                SORIDRAW는 가사, 프롬프트, 보컬 감정, 곡 구조를 한곳에서 다듬는 AI 음악 제작 작업실입니다.
                떠오른 장면을 정리하고, 다시 꺼내 쓰기 좋은 제작 데이터로 남겨둡니다.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => go('/studio')}
                  disabled={isLoggingIn}
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 via-pink-500 to-violet-500 px-5 py-3 text-sm font-black text-white shadow-[0_16px_42px_rgba(236,72,153,0.24)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                >
                  스튜디오 시작하기
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => go('/history')}
                  disabled={isLoggingIn}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-black text-white/85 transition-all hover:bg-white/[0.09] disabled:cursor-wait disabled:opacity-70"
                >
                  <Heart className="h-4 w-4 text-pink-200" />
                  뮤직노트 보기
                </button>
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-[#15101e]/70 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">My Setup</p>
                  <h2 className="mt-1 text-xl font-black text-white">작업 준비 상태</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/20 via-pink-400/18 to-violet-500/20 text-amber-100">
                  <Music2 className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span className="text-zinc-300">Google Gemini API</span>
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-black text-zinc-200">마이페이지 확인</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span className="text-zinc-300">Music API</span>
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-black text-zinc-200">마이페이지 확인</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => go('/my-page')}
                disabled={isLoggingIn}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-300/15 bg-pink-400/10 px-4 py-3 text-xs font-black text-pink-100 transition-all hover:bg-pink-400/15 disabled:cursor-wait disabled:opacity-70"
              >
                API / 플랜 관리
              </button>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-amber-300/10 via-pink-500/10 to-violet-500/12 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-amber-100">
                  <Mic2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">감각은 남기고, 복잡함은 줄이고</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-zinc-400">떠오른 한 줄을 가사와 프롬프트, 다음 작업으로 이어가세요.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => go(card.path)}
                disabled={isLoggingIn}
                className="group rounded-[1.5rem] border border-white/10 bg-[#15101e]/62 p-5 text-left backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.065] disabled:cursor-wait disabled:opacity-70"
              >
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-[0_12px_34px_rgba(0,0,0,0.22)]`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-white">{card.title}</h3>
                <p className="mt-2 min-h-[44px] text-xs font-medium leading-5 text-zinc-400">{card.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-[11px] font-black text-pink-200/85">
                  이동하기 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>

      </section>
    </main>
  );
}
