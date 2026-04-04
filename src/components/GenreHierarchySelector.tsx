import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CategoryItem, GenreGroupItem } from '../types';
import { GENRE_HIERARCHY, GENRES } from '../constants';
import { ChevronDown, ChevronUp, RotateCcw, Dices, X, Check, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ModalStep = 'main' | 'sub';

type SubGenreItem = {
  id: string;
  label: string;
  description?: string;
};

type MainGenreItem = {
  id: string;
  label: string;
  description?: string;
  children: SubGenreItem[];
};

type GroupItem = {
  id: string;
  label: string;
  description?: string;
  children: MainGenreItem[];
};

interface Props {
  selectedGenre: string[];
  selectedSubGenre: string[];
  onSelectGenre: (id: string) => void;
  onSelectSubGenre: (id: string) => void;
  onClear: () => void;
  onRandom: () => void;
  onHover: (item: CategoryItem | null) => void;
}

const DEFAULT_GROUP_DESCRIPTION = '대분류를 선택한 뒤 메인 장르와 세부 장르를 고를 수 있습니다.';
const DEFAULT_MAIN_DESCRIPTION = '메인 장르를 선택한 뒤 세부장르를 더 구체적으로 고를 수 있습니다.';
const DEFAULT_SUB_DESCRIPTION = '세부 장르를 선택해 장르의 방향을 더 구체적으로 설정하세요.';

export default function GenreHierarchySelector({
  selectedGenre,
  selectedSubGenre,
  onSelectGenre,
  onSelectSubGenre,
  onClear,
  onHover,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeGroup, setActiveGroup] = useState<GroupItem | null>(null);
  const [activeMain, setActiveMain] = useState<MainGenreItem | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>('main');
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);

  const modalHistoryDepthRef = useRef(0);
  const modalScrollYRef = useRef(0);

  // committed selections from parent
  const committedGenre = selectedGenre ?? [];
  const committedSubGenre = selectedSubGenre ?? [];

  // pending selections inside modal
  const [pendingMainId, setPendingMainId] = useState<string | null>(null);
  const [pendingSubId, setPendingSubId] = useState<string | null>(null);

  const groups = useMemo<GroupItem[]>(() => {
    const genreDescMap = new Map(GENRES.map(g => [g.id, g.description]));

    return GENRE_HIERARCHY.map((group) => ({
      id: group.id,
      label: group.label,
      description: (group as any).description ?? DEFAULT_GROUP_DESCRIPTION,
      children: group.children.map((main) => ({
        id: main.id,
        label: main.label,
        description: (main as any).description ?? genreDescMap.get(main.id) ?? DEFAULT_MAIN_DESCRIPTION,
        children: main.children.map((sub) => ({
          id: sub.id,
          label: sub.label,
          description: (sub as any).description ?? genreDescMap.get(sub.id) ?? DEFAULT_SUB_DESCRIPTION,
        })),
      })),
    }));
  }, []);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [groups, isExpanded]);

  const totalCount = useMemo(() => {
    return groups.reduce((count, group) => {
      return count + group.children.length + group.children.reduce((subCount, main) => subCount + main.children.length, 0);
    }, 0);
  }, [groups]);

  const selectedCount = committedGenre.length + committedSubGenre.length;

  const selectedMainLabel = useMemo(() => {
    for (const group of groups) {
      const matched = group.children.find((main) => committedGenre.includes(main.id));
      if (matched) return matched.label;
    }
    return null;
  }, [groups, committedGenre]);

  const selectedSubLabels = useMemo(() => {
    const labels: string[] = [];
    for (const group of groups) {
      for (const main of group.children) {
        for (const sub of main.children) {
          if (committedSubGenre.includes(sub.id)) labels.push(sub.label);
        }
      }
    }
    return labels;
  }, [groups, committedSubGenre]);

  const closeModalStateOnly = () => {
    setActiveGroup(null);
    setActiveMain(null);
    setPendingMainId(null);
    setPendingSubId(null);
    setModalStep('main');
  };

  const openMainModal = (group: GroupItem) => {
    const currentMainId = committedGenre[0] ?? null;
    const currentMain =
      group.children.find((main) => main.id === currentMainId) ?? null;

    const currentSubId =
      currentMain?.children.find((sub) => committedSubGenre.includes(sub.id))?.id ?? null;

    setActiveGroup(group);
    setActiveMain(null);
    setModalStep('main');
    setPendingMainId(currentMainId);
    setPendingSubId(currentSubId);

    window.history.pushState({ genreModal: 'main' }, '');
    modalHistoryDepthRef.current = 1;
  };

  const closeModal = (source: 'ui' | 'history' = 'ui') => {
    if (source === 'ui' && modalHistoryDepthRef.current > 0) {
      window.history.back();
      return;
    }
    closeModalStateOnly();
    modalHistoryDepthRef.current = 0;
  };

  const handleBack = () => {
    if (modalHistoryDepthRef.current > 0) {
      window.history.back();
      return;
    }

    if (modalStep === 'sub') {
      setModalStep('main');
      setActiveMain(null);
      return;
    }

    closeModalStateOnly();
  };

  const handleMainClick = (main: MainGenreItem) => {
    if (pendingMainId === main.id) {
      applyMain();
      return;
    }
    setPendingMainId(main.id);
    setPendingSubId(null);
  };

  const handleOpenSub = (main: MainGenreItem) => {
    setPendingMainId(main.id);
    if (!main.children.some((sub) => sub.id === pendingSubId)) {
      setPendingSubId(null);
    }
    setActiveMain(main);
    setModalStep('sub');

    window.history.pushState({ genreModal: 'sub' }, '');
    modalHistoryDepthRef.current = 2;
  };

  const handleSubClick = (subId: string) => {
    if (pendingSubId === subId) {
      applySub();
      return;
    }
    setPendingSubId(subId);
  };

  const commitSelection = (mainId: string | null, subId: string | null) => {
    committedGenre.forEach((genreId) => onSelectGenre(genreId));
    committedSubGenre.forEach((subGenreId) => onSelectSubGenre(subGenreId));

    if (mainId) onSelectGenre(mainId);
    if (subId) onSelectSubGenre(subId);
  };

  const applyMain = () => {
    if (!pendingMainId) return;
    commitSelection(pendingMainId, null);
    closeModalStateOnly();
    modalHistoryDepthRef.current = 0;
  };

  const applySub = () => {
    if (!pendingMainId) return;
    commitSelection(pendingMainId, pendingSubId);
    closeModalStateOnly();
    modalHistoryDepthRef.current = 0;
  };

  const handleRandom = () => {
    const allMainGenres = groups.flatMap((group) => group.children);
    if (allMainGenres.length === 0) return;

    const randomMain = allMainGenres[Math.floor(Math.random() * allMainGenres.length)];
    const randomSub = randomMain.children.length > 0
      ? randomMain.children[Math.floor(Math.random() * randomMain.children.length)]
      : null;

    commitSelection(randomMain.id, randomSub?.id ?? null);
  };

  useEffect(() => {
    if (!activeGroup) return;

    modalScrollYRef.current = window.scrollY;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyTouchAction = document.body.style.touchAction;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${modalScrollYRef.current}px`;
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.touchAction = originalBodyTouchAction;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;

      window.scrollTo(0, modalScrollYRef.current);
    };
  }, [activeGroup]);

  useEffect(() => {
    const handlePopState = () => {
      if (!activeGroup) return;

      if (modalStep === 'sub') {
        setModalStep('main');
        setActiveMain(null);
        modalHistoryDepthRef.current = 1;
        return;
      }

      closeModalStateOnly();
      modalHistoryDepthRef.current = 0;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeGroup, modalStep]);

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full relative group shadow-[var(--shadow-md)] pb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <h3 
              onMouseEnter={() => setShowTitleTooltip(true)}
              onMouseLeave={() => setShowTitleTooltip(false)}
              className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help"
            >
              <span className="w-1.5 h-6 bg-brand-orange rounded-full" />
              장르
              <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-2">({selectedCount}/{totalCount})</span>
            </h3>
            <AnimatePresence>
              {showTitleTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border border-brand-orange/30 shadow-[var(--shadow-md)] w-56 pointer-events-none"
                >
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                    곡의 핵심 장르와 세부 스타일을 결정합니다. 대분류를 선택하고 메인 장르와 세부 장르를 조합하여 원하는 음악적 색깔을 만드세요.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRandom}
            onMouseEnter={() => onHover({ id: 'genre-random', label: '랜덤 선택', description: '장르를 무작위로 선택합니다.', _ts: Date.now() })}
            onMouseLeave={() => onHover(null)}
            className="p-2.5 rounded-xl bg-white/10 text-[var(--text-secondary)] hover:bg-white/20 transition-all"
            title="랜덤 선택"
          >
            <Dices className="w-4 h-4" />
          </button>
          <button
            onClick={onClear}
            onMouseEnter={() => onHover({ id: 'genre-clear', label: '초기화', description: '선택한 장르를 초기화합니다.', _ts: Date.now() })}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "p-2.5 rounded-xl transition-all border",
              selectedCount > 0 
                ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30 hover:bg-brand-orange/30" 
                : "bg-white/10 text-[var(--text-secondary)] border-white/10 hover:bg-white/20"
            )}
            title="초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ 
          height: isExpanded ? contentHeight : 48,
          opacity: 1
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div ref={contentRef} className="grid grid-cols-2 gap-2 md:gap-2.5">
          {groups.map((group) => {
            const hasSelectedMain = group.children.some((main) => committedGenre.includes(main.id));
            return (
              <button
                key={group.id}
                onClick={() => openMainModal(group)}
                onMouseEnter={() => onHover({ id: group.id, label: group.label, description: group.description || DEFAULT_GROUP_DESCRIPTION, _ts: Date.now() })}
                onMouseLeave={() => onHover(null)}
                className={[
                  'min-h-[48px] rounded-xl border px-3 py-2 text-left transition-all flex items-center justify-center',
                  hasSelectedMain
                    ? 'bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20'
                    : 'bg-white/5 border-white/10 text-[var(--text-primary)] hover:bg-white/10',
                ].join(' ')}
              >
                <span className="text-[12px] md:text-[13px] font-bold leading-tight text-center whitespace-nowrap tracking-[-0.01em]">
                  {group.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-4 min-h-[44px] rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-3 flex items-center justify-center text-center">
        {selectedMainLabel ? (
          <p className="text-sm font-semibold text-brand-orange">
            {selectedMainLabel}
            {selectedSubLabels.length > 0 ? ` · ${selectedSubLabels.join(', ')}` : ''}
          </p>
        ) : (
          <p className="text-xs text-brand-orange font-medium">
            대분류를 눌러 메인 장르를 선택하세요.
          </p>
        )}
      </div>

      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full bg-[var(--card-bg)] border border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shadow-[0_4px_12px_rgba(255,130,0,0.2)] flex items-center justify-center"
        title={isExpanded ? '접기' : '펼치기'}
      >
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {activeGroup && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 overscroll-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => closeModal()}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
              className="w-full max-w-md rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={handleBack}
                    className="w-9 h-9 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center shrink-0"
                    title="뒤로가기"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
                      {modalStep === 'main' ? activeGroup.label : activeMain?.label}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {modalStep === 'main'
                        ? activeGroup.description || DEFAULT_GROUP_DESCRIPTION
                        : activeMain?.description || DEFAULT_SUB_DESCRIPTION}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => closeModal()}
                  className="w-9 h-9 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center"
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className="p-4 space-y-3 max-h-[70vh] overflow-y-auto overscroll-contain custom-scrollbar"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {modalStep === 'main' && (
                  <div className="space-y-2">
                    {activeGroup.children.map((main) => {
                      const isCommitted = committedGenre.includes(main.id);
                      const isPending = pendingMainId === main.id;
                      const isActiveVisual = pendingMainId ? isPending : isCommitted;

                      return (
                        <div
                          key={main.id}
                          className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 p-3"
                          title={main.description || DEFAULT_MAIN_DESCRIPTION}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleMainClick(main)}
                              onMouseEnter={() => onHover({ id: main.id, label: main.label, description: main.description || DEFAULT_MAIN_DESCRIPTION, _ts: Date.now() })}
                              onMouseLeave={() => onHover(null)}
                              className={[
                                'flex-1 text-left rounded-xl border px-4 py-3 transition-all',
                                isActiveVisual
                                  ? 'bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20'
                                  : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)]',
                              ].join(' ')}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-bold text-sm">{main.label}</div>
                                  <div className={['text-xs mt-1', isActiveVisual ? 'text-white/80' : 'text-[var(--text-secondary)]'].join(' ')}>
                                    {main.description || DEFAULT_MAIN_DESCRIPTION}
                                  </div>
                                </div>
                                {isActiveVisual && <Check className="w-4 h-4 shrink-0" />}
                              </div>
                            </button>

                            {main.children.length > 0 && (
                              <button
                                onClick={() => handleOpenSub(main)}
                                onMouseEnter={() => onHover({ id: `${main.id}-sub`, label: `${main.label} 세부장르`, description: DEFAULT_SUB_DESCRIPTION, _ts: Date.now() })}
                                onMouseLeave={() => onHover(null)}
                                className={[
                                  'shrink-0 px-3 py-3 rounded-xl border transition-all text-xs font-bold leading-tight flex flex-col items-center justify-center gap-1 min-w-[70px]',
                                  isActiveVisual
                                    ? 'border-brand-orange/30 text-brand-orange hover:bg-brand-orange/10'
                                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                                ].join(' ')}
                                title="세부장르 더보기"
                              >
                                <span>세부장르</span>
                                <span>더보기</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {modalStep === 'sub' && activeMain && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {activeMain.children.map((sub) => {
                        const isCommitted = committedSubGenre.includes(sub.id) && committedGenre.includes(activeMain.id);
                        const isPending = pendingSubId === sub.id;
                        const isActiveVisual = pendingSubId !== null ? isPending : isCommitted;

                        return (
                          <button
                            key={sub.id}
                            onClick={() => handleSubClick(sub.id)}
                            onMouseEnter={() => onHover({ id: sub.id, label: sub.label, description: sub.description || DEFAULT_SUB_DESCRIPTION, _ts: Date.now() })}
                            onMouseLeave={() => onHover(null)}
                            className={[
                              'px-4 py-3 rounded-2xl font-bold text-sm transition-all border text-left',
                              isActiveVisual
                                ? 'bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/20'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]',
                            ].join(' ')}
                            title={sub.description || DEFAULT_SUB_DESCRIPTION}
                          >
                            <div className="font-bold text-sm">{sub.label}</div>
                            <div className={['text-[11px] mt-1 leading-snug', isActiveVisual ? 'text-white/80' : 'text-[var(--text-secondary)]'].join(' ')}>
                              {sub.description || DEFAULT_SUB_DESCRIPTION}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}