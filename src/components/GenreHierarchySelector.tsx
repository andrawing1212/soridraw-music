import React, { useMemo, useState } from 'react';
import { GENRE_HIERARCHY } from '../constants';
import { ChevronDown, ChevronUp, RotateCcw, Dices, X, Check, ArrowLeft } from 'lucide-react';

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
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeGroup, setActiveGroup] = useState<GroupItem | null>(null);
  const [activeMain, setActiveMain] = useState<MainGenreItem | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>('main');

  // committed selections from parent
  const committedGenre = selectedGenre ?? [];
  const committedSubGenre = selectedSubGenre ?? [];

  // pending selections inside modal
  const [pendingMainId, setPendingMainId] = useState<string | null>(null);
  const [pendingSubId, setPendingSubId] = useState<string | null>(null);

  const groups = useMemo<GroupItem[]>(() => {
    return GENRE_HIERARCHY.map((group) => ({
      id: group.id,
      label: group.label,
      description: (group as any).description ?? DEFAULT_GROUP_DESCRIPTION,
      children: group.children.map((main) => ({
        id: main.id,
        label: main.label,
        description: (main as any).description ?? DEFAULT_MAIN_DESCRIPTION,
        children: main.children.map((sub) => ({
          id: sub.id,
          label: sub.label,
          description: (sub as any).description ?? DEFAULT_SUB_DESCRIPTION,
        })),
      })),
    }));
  }, []);

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
  };

  const closeModal = () => {
    setActiveGroup(null);
    setActiveMain(null);
    setPendingMainId(null);
    setPendingSubId(null);
    setModalStep('main');
  };

  const handleBack = () => {
    if (modalStep === 'sub') {
      setModalStep('main');
      setActiveMain(null);
      return;
    }
    closeModal();
  };

  const handleMainClick = (main: MainGenreItem) => {
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
  };

  const handleSubClick = (subId: string) => {
    setPendingSubId((prev) => (prev === subId ? null : subId));
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
    closeModal();
  };

  const applySub = () => {
    if (!pendingMainId) return;
    commitSelection(pendingMainId, pendingSubId);
    closeModal();
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

  return (
    <div className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--border-color)] flex flex-col h-full relative group shadow-[var(--shadow-md)]">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full bg-[var(--card-bg)] border border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shadow-[0_4px_12px_rgba(255,130,0,0.2)] flex items-center justify-center"
        title={isExpanded ? '접기' : '펼치기'}
      >
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="w-1.5 h-6 bg-brand-orange rounded-full" />
            장르
            <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-2">({selectedCount}/{totalCount})</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRandom}
            className="p-2.5 rounded-xl bg-white/10 text-[var(--text-secondary)] hover:bg-white/20 transition-all"
            title="랜덤 선택"
          >
            <Dices className="w-4 h-4" />
          </button>
          <button
            onClick={onClear}
            className="p-2.5 rounded-xl bg-white/10 text-[var(--text-secondary)] hover:bg-white/20 transition-all border border-white/10"
            title="초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="grid grid-cols-2 gap-2 md:gap-2.5">
            {groups.map((group) => {
              const hasSelectedMain = group.children.some((main) => committedGenre.includes(main.id));
              return (
                <button
                  key={group.id}
                  onClick={() => openMainModal(group)}
                  title={group.description || DEFAULT_GROUP_DESCRIPTION}
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

          <div className="mt-4 min-h-[44px] rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-3 flex items-center justify-center text-center">
            {selectedMainLabel ? (
              <p className="text-sm font-semibold text-brand-orange">
                {selectedMainLabel}
                {selectedSubLabels.length > 0 ? ` · ${selectedSubLabels.join(', ')}` : ''}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                대분류를 눌러 메인 장르를 선택하세요.
              </p>
            )}
          </div>
        </>
      )}

      {activeGroup && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden"
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
                onClick={closeModal}
                className="w-9 h-9 rounded-xl border border-[var(--border-color)] bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                        <div className="flex items-start justify-between gap-3">
                          <button
                            onClick={() => handleMainClick(main)}
                            className={[
                              'flex-1 text-left rounded-xl border px-4 py-3 transition-all',
                              isActiveVisual
                                ? 'bg-brand-orange border-orange-400 text-white shadow-lg shadow-brand-orange/20'
                                : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)]',
                            ].join(' ')}
                            title={main.description || DEFAULT_MAIN_DESCRIPTION}
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

                          {isActiveVisual && (
                            <div className="shrink-0 flex flex-col gap-2">
                              <button
                                onClick={applyMain}
                                className="px-3 py-3 rounded-xl border border-brand-orange bg-brand-orange text-white hover:brightness-110 transition-all text-xs font-bold whitespace-nowrap"
                                title="적용"
                              >
                                적용
                              </button>
                              {main.children.length > 0 && (
                                <button
                                  onClick={() => handleOpenSub(main)}
                                  className="px-3 py-3 rounded-xl border border-brand-orange/30 text-brand-orange hover:bg-brand-orange/10 transition-all text-xs font-bold leading-tight"
                                  title="세부장르 더보기"
                                >
                                  세부장르
                                  <br />
                                  더보기
                                </button>
                              )}
                            </div>
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
                          className={[
                            'px-4 py-3 rounded-2xl font-bold text-sm transition-all border text-left',
                            isActiveVisual
                              ? 'bg-brand-orange text-white border-brand-orange'
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

                  <div className="pt-1">
                    <button
                      onClick={applySub}
                      className="w-full px-4 py-3 rounded-xl border border-brand-orange bg-brand-orange text-white hover:brightness-110 transition-all text-sm font-bold"
                    >
                      적용
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
