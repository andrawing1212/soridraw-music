import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface AdminPageLayoutProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminPageLayout({ 
  title, 
  description, 
  actions, 
  children 
}: AdminPageLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { name: '회원 관리', path: '/admin/users' },
    { name: '보컬 관리', path: '/admin/vocals' },
    { name: '태그 관리', path: '/admin/tags' },
    { name: 'Suno API', path: '/admin/suno-api' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-16">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                location.pathname === tab.path
                  ? "bg-brand-orange text-white border-brand-orange"
                  : "bg-btn-bg border-btn-border text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn"
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2"
        >
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/')}
              className="mt-1 px-6 py-3 text-base font-bold rounded-2xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn transition-all shrink-0"
            >
              홈
            </button>
            <div>
              <h1 className="text-3xl font-black text-[var(--text-primary)]">{title}</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
            </div>
          </div>
          {actions && <div className="flex gap-2 items-center">{actions}</div>}
        </motion.div>

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
