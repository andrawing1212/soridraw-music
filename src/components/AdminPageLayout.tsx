import React from 'react';
import { Home, Users, Key } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

type AdminPageLayoutProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const ADMIN_TABS = [
  { path: '/admin/users', label: '회원 관리', icon: Users },
  { path: '/admin/suno-api', label: 'Suno API', icon: Key },
];

export default function AdminPageLayout({ title, description, actions, children }: AdminPageLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-16">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0',
                  active
                    ? 'bg-brand-orange text-white border-brand-orange shadow-[0_8px_18px_rgba(249,115,22,0.18)]'
                    : 'bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover hover:text-[var(--text-primary)] shadow-btn'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 md:gap-4 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-btn-bg border border-btn-border text-[var(--text-secondary)] hover:text-brand-orange hover:bg-btn-hover transition-all flex items-center justify-center shadow-btn shrink-0"
              aria-label="홈으로 이동"
            >
              <Home className="w-5 h-5" />
            </button>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-2xl md:text-4xl font-black text-[var(--text-primary)] tracking-tight">{title}</h1>
              {description && (
                <p className="mt-1 text-sm md:text-base text-[var(--text-secondary)] break-keep">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>

        {children}
      </div>
    </div>
  );
}
