import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CategoryItem, GenreGroupItem } from "../types";
import { GENRE_HIERARCHY, GENRES } from "../constants";
import {
  Trash2,
  Dices,
  X,
  Check,
  ChevronRight,
  Info,
  Lock,
  Unlock,
  Edit2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


const genreAccent = {
  bar: 'bg-[rgb(var(--soridraw-menu-amber-rgb)/0.95)]',
  text: 'text-[var(--soridraw-menu-amber-soft)]',
  softText: 'text-[rgb(var(--soridraw-menu-amber-soft-rgb)/0.58)]',
  selected: 'bg-[var(--soridraw-menu-amber)] border-black/20 text-[var(--soridraw-selected-text)] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  selectedSoft: 'bg-[rgb(var(--soridraw-menu-amber-rgb)/0.14)] border-black/20 text-[var(--soridraw-menu-amber-soft)] hover:bg-[rgb(var(--soridraw-menu-amber-rgb)/0.20)]',
  summaryActive: 'bg-[rgb(var(--soridraw-menu-amber-rgb)/0.035)] border-[rgb(var(--soridraw-menu-amber-rgb)/0.15)] text-[var(--soridraw-menu-amber-soft)]',
  summaryHover: 'hover:border-[rgb(var(--soridraw-menu-amber-rgb)/0.20)] hover:bg-[rgb(var(--soridraw-menu-amber-rgb)/0.035)]',
  summaryBorder: 'rgb(var(--soridraw-menu-amber-rgb) / 0.14)',
  summaryBorderHover: 'rgb(var(--soridraw-menu-amber-rgb) / 0.24)',
  summaryActiveBg: 'rgb(var(--soridraw-menu-amber-rgb) / 0.035)',
  selectedBorder: 'border-black/20',
};

const SORIDRAW_CLOSE_STUDIO_MODALS_EVENT = 'soridraw:close-studio-modals';


const INSTRUMENTAL_BGM_GENRE_IDS = new Set([
  'instrumental_bgm',
  'lofi_study',
  'cafe_bgm',
  'nature_ambience',
  'healing_piano',
  'ambient',
  'minimalism',
  'piano_solo',
  'string_ensemble',
]);

const isInstrumentalBgmGenreId = (id?: string | null) => Boolean(id && INSTRUMENTAL_BGM_GENRE_IDS.has(id));


function keepExpandableSectionInView(_trigger: HTMLElement, _wasExpanded: boolean) {
  // Mood/Theme sections open without scroll anchoring. Keep Genre the same way so
  // top-row expansion does not fight browser scroll anchoring during height animation.
}

function handleExpandableToggle(
  event: React.MouseEvent<HTMLElement>,
  isExpanded: boolean,
  onToggleExpand?: () => void
) {
  event.preventDefault();

  const section = event.currentTarget.closest('[data-expand-section]') as HTMLElement | null;
  const beforeTop = section?.getBoundingClientRect().top ?? null;

  onToggleExpand?.();
  keepExpandableSectionInView(event.currentTarget, isExpanded);

  if (!section || beforeTop === null) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const afterTop = section.getBoundingClientRect().top;
      const delta = afterTop - beforeTop;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
      }
    });
  });
}

type ModalStep = "main" | "sub";

type SubGenreItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
};

type MainGenreItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  children: SubGenreItem[];
};

type GroupItem = {
  id: string;
  label: string;
  labelKo?: string;
  description?: string;
  descriptionKo?: string;
  children: MainGenreItem[];
};

interface Props {
  selectedGenre: string[];
  selectedSubGenre: string[];
  onSelectGenre: (id: string) => void;
  onSelectSubGenre: (id: string) => void;
  onClear: () => void;
  onRandom: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onHover: (item: CategoryItem | null) => void;
  onCommitSelection?: (mainId: string | null, subId: string | null, meta?: { removeMainId?: string | null; removeSubId?: string | null }) => void;
  onCommitSelectionList?: (subIds: string[]) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isRandomized?: boolean;
  onHeightChange?: (height: number) => void;
  forcedHeight?: number;
  onModalStateChange?: (isOpen: boolean) => void;
  directInput?: {
    selectedText?: string;
    onApply: (value: string) => void;
    onCancelSelected?: () => void;
  };
}

const DEFAULT_GROUP_DESCRIPTION =
  "대분류를 선택한 뒤 메인 장르와 세부 장르를 고를 수 있습니다.";
const DEFAULT_MAIN_DESCRIPTION =
  "메인 장르를 선택한 뒤 세부장르를 더 구체적으로 고를 수 있습니다.";
const DEFAULT_SUB_DESCRIPTION =
  "세부 장르를 선택해 장르의 방향을 더 구체적으로 설정하세요.";

const GENRE_TITLE_MAP: Record<string, string> = {
  group_pop_global: "Pop & Global",
  group_hiphop_rnb: "Hip-hop & R&B",
  group_rock_band: "Rock & Metal",
  group_edm_dance: "Electronic",
  group_jazz_classical: "Jazz & Folk",
  group_folk_world: "World Music",
  group_trot_adult: "Trot & Adult",
  group_cinematic_bgm: "Classical & Theme Music",
  pop: "Pop",
  kpop: "K-Pop",
  jpop_style: "J-Style",
  hiphop: "Hip-hop",
  rnb: "R&B",
  rock: "Rock",
  metal: "Metal",
  edm: "Club / EDM",
  bass_synth: "Synth / Bass",
  global_rhythm: "Global Rhythm",
  italian_pop: "Italian Pop",
  underground_hiphop: "Underground Hip-Hop",
  comedy_hiphop: "Comedy Hip-Hop",
  baroque_hiphop: "Baroque Hip-Hop",
  chill_trap: "Chill Trap",
  acoustic_rnb: "Acoustic R&B",
  soul_blues: "Soul Blues",
  pop_punk: "Pop Punk",
  romantic_rock: "Romantic Rock",
  medieval_rock: "Medieval Rock",
  opera_rock: "Opera Rock",
  retro_punk: "Retro Punk",
  slow_metal: "Slow Metal",
  djent_metal: "Djent Metal",
  beatdown_hardcore: "Beatdown Hardcore",
  crunkcore: "Crunkcore",
  epic_edm: "Epic EDM",
  retrowave: "Retrowave",
  tech_house: "Tech House",
  microhouse: "Microhouse",
  underground_techno: "Underground Techno",
  goa_psytrance: "Goa Psytrance",
  hard_dubstep: "Hard Dubstep",
  funk_carioca: "Funk Carioca",
  jazz_blues: "Jazz Blues",
  acoustic_jazz: "Acoustic Jazz",
  p_funk_jazz: "P-Funk Jazz",
  slow_country_pop: "Slow Country Pop",
  traditional_folk_music: "Traditional Folk Music",
  balkan_folk: "Balkan Folk",
  sarod: "Sarod",
  chacha: "Cha-cha-cha",
  church_hymn: "Church Hymn",
  gothic_opera: "Gothic Opera",
  cinematic_ballad: "Cinematic Ballad",
  battle_theme: "Battle Theme",
  video_game_music: "Video Game Music",
  jazz: "Jazz",
  classical: "Classical / Vocal",
  acoustic_folk: "Folk & Country",
  world_music_folk: "World / Traditional",
  trot: "Trot",
  "7080_gayo": "7080 Gayo",
  ost: "Theme / BGM",
  dance_pop: "Dance Pop",
  synth_pop: "Synth Pop",
  teen_pop: "Teen Pop",
  ballad_pop: "Ballad Pop",
  city_pop: "Classic City Pop",
  modern_city_pop: "Modern City Pop",
  k_city_pop: "K-City Pop",
  j_city_pop: "J-City Pop",
  indie_pop: "Indie Pop",
  boom_bap: "Boom Bap",
  trap: "Trap",
  drill: "Drill",
  lofi_hiphop: "Lo-fi Hip-hop",
  contemporary_rnb: "Contemporary R&B",
  neo_soul: "Neo Soul",
  alternative_rock: "Alternative Rock",
  punk_rock: "Punk Rock",
  heavy_metal: "Heavy Metal",
  house: "House",
  techno: "Techno",
  trance: "Trance",
  swing_jazz: "Swing Jazz",
  bossa_nova: "Bossa Nova",
  traditional_folk: "Traditional Folk",
  country: "Country",
  reggae: "Reggae",
  traditional_trot: "Traditional Trot",
  semi_trot: "Semi Trot",
  orchestral_score: "Orchestral Score",
  piano_solo: "Piano Solo",
  ambient: "Ambient",
};

function GenreHierarchySelectorComponent({
  selectedGenre,
  selectedSubGenre,
  onSelectGenre,
  onSelectSubGenre,
  onClear,
  onRandom,
  isLocked = false,
  onToggleLock,
  onHover,
  onCommitSelection,
  onCommitSelectionList,
  isExpanded,
  onToggleExpand,
  isRandomized = false,
  onHeightChange,
  forcedHeight,
  onModalStateChange,
  directInput,
}: Props) {
  const [activeGroup, setActiveGroup] = useState<GroupItem | null>(null);
  const [activeMain, setActiveMain] = useState<MainGenreItem | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>("main");
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [isDirectInputEditing, setIsDirectInputEditing] = useState(false);
  const [directInputDraft, setDirectInputDraft] = useState(directInput?.selectedText || '');
  const [hoveredModalItem, setHoveredModalItem] = useState<{
    label: string;
    description: string;
  } | null>(null);
  const lastSyncedGenreRef = useRef<string[]>([]);
  const lastSyncedSubGenreRef = useRef<string[]>([]);

  const modalHistoryDepthRef = useRef(0);
  const modalScrollYRef = useRef(0);
  const modalTouchStartYRef = useRef<number | null>(null);

  const stopModalScrollChaining = (element: HTMLElement, deltaY: number, preventDefault: () => void) => {
    const canScroll = element.scrollHeight > element.clientHeight + 1;
    if (!canScroll) {
      preventDefault();
      return;
    }

    const atTop = element.scrollTop <= 0;
    const atBottom = Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight;
    if ((atTop && deltaY < 0) || (atBottom && deltaY > 0)) {
      preventDefault();
    }
  };

  const handleModalWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    stopModalScrollChaining(event.currentTarget, event.deltaY, () => event.preventDefault());
  };

  const handleModalTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    modalTouchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleModalTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const startY = modalTouchStartYRef.current;
    const currentY = event.touches[0]?.clientY ?? null;
    if (startY === null || currentY === null) return;
    stopModalScrollChaining(event.currentTarget, startY - currentY, () => event.preventDefault());
  };

  const blockModalOuterScroll = (event: React.WheelEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // committed selections from parent
  const committedGenre = selectedGenre ?? [];
  const committedSubGenre = selectedSubGenre ?? [];
  const MAX_MODAL_SELECTIONS = 2;
  const normalizeSelectionList = (ids: string[]) => Array.from(new Set(ids.filter(Boolean))).slice(-MAX_MODAL_SELECTIONS);

  const normalizedCommittedSubGenre = useMemo(() => {
    return normalizeSelectionList(committedSubGenre);
  }, [committedSubGenre]);

  // pending selections inside modal
  const [pendingMainId, setPendingMainId] = useState<string | null>(null);
  const [pendingSubId, setPendingSubId] = useState<string | null>(null);
  const [pendingRemoveSubId, setPendingRemoveSubId] = useState<string | null>(null);
  const [pendingSubIds, setPendingSubIds] = useState<string[]>([]);
  const [hasChangedInModal, setHasChangedInModal] = useState(false);
  const initialModalMainIdRef = useRef<string | null>(null);
  const initialModalSubIdRef = useRef<string | null>(null);

  const normalizedPendingSubIds = useMemo(() => {
    return normalizeSelectionList(pendingSubIds);
  }, [pendingSubIds]);

  const [isBackdropBlurReady, setIsBackdropBlurReady] = useState(false);

  useEffect(() => {
    if (activeGroup) {
      const handle = requestAnimationFrame(() => {
        setIsBackdropBlurReady(true);
      });
      return () => cancelAnimationFrame(handle);
    } else {
      setIsBackdropBlurReady(false);
    }
  }, [activeGroup]);

  useEffect(() => {
    onModalStateChange?.(!!activeGroup);
  }, [activeGroup, onModalStateChange]);

  useEffect(() => {
    const handleCloseStudioModals = () => {
      setActiveGroup(null);
      setActiveMain(null);
      setModalStep('main');
      setHoveredModalItem(null);
      setHasChangedInModal(false);
      modalHistoryDepthRef.current = 0;
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';
    };
    window.addEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleCloseStudioModals);
    return () => window.removeEventListener(SORIDRAW_CLOSE_STUDIO_MODALS_EVENT, handleCloseStudioModals);
  }, []);

  const groups = useMemo<GroupItem[]>(() => {
    const genreDescMap = new Map(GENRES.map((g) => [g.id, g.description]));

    return GENRE_HIERARCHY.map((group) => ({
      id: group.id,
      label: group.label,
      labelKo: group.labelKo,
      description: (group as any).description ?? DEFAULT_GROUP_DESCRIPTION,
      descriptionKo: (group as any).descriptionKo,
      children: group.children.map((main) => ({
        id: main.id,
        label: main.label,
        labelKo: main.labelKo,
        description:
          (main as any).description ??
          genreDescMap.get(main.id) ??
          DEFAULT_MAIN_DESCRIPTION,
        descriptionKo: (main as any).descriptionKo,
        children: main.children.map((sub) => ({
          id: sub.id,
          label: sub.label,
          labelKo: sub.labelKo,
          description:
            (sub as any).description ??
            genreDescMap.get(sub.id) ??
            DEFAULT_SUB_DESCRIPTION,
          descriptionKo: (sub as any).descriptionKo,
        })),
      })),
    }));
  }, []);

  useEffect(() => {
    const genreChanged =
      JSON.stringify(committedGenre) !==
      JSON.stringify(lastSyncedGenreRef.current);
    const subGenreChanged =
      JSON.stringify(committedSubGenre) !==
      JSON.stringify(lastSyncedSubGenreRef.current);

    if (genreChanged || subGenreChanged) {
      lastSyncedGenreRef.current = committedGenre;
      lastSyncedSubGenreRef.current = committedSubGenre;

      const activeIds = Array.from(new Set([...committedGenre, ...committedSubGenre]));
      const firstId = activeIds[0] ?? null;

      let foundGroup: GroupItem | null = null;
      let foundMain: MainGenreItem | null = null;
      let foundSubId: string | null = null;
      let foundMainBaseId: string | null = null;

      if (firstId) {
        for (const group of groups) {
          for (const main of group.children) {
            if (main.id === firstId) {
              foundGroup = group;
              foundMain = main;
              foundMainBaseId = main.id;
              break;
            }
            const sub = main.children.find((s) => s.id === firstId);
            if (sub) {
              foundGroup = group;
              foundMain = main;
              foundSubId = sub.id;
              break;
            }
          }
          if (foundMain) break;
        }
      }

      setPendingMainId(foundMainBaseId);
      setPendingSubId(foundSubId);
      setPendingSubIds(normalizeSelectionList(committedSubGenre));
      setPendingRemoveSubId(null);

      // Sync modal view if open
      if (activeGroup && foundGroup && activeGroup.id !== foundGroup.id) {
        setActiveGroup(foundGroup);
      }
      if (
        modalStep === "sub" &&
        foundMain &&
        activeMain?.id !== foundMain.id
      ) {
        setActiveMain(foundMain);
      }
    }
  }, [
    committedGenre,
    committedSubGenre,
    groups,
    activeGroup,
    activeMain,
    modalStep,
  ]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | string>(0);

  useLayoutEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
      if (onHeightChange) {
        onHeightChange(height);
      }
    }
  }, [groups, onHeightChange]);

  const totalCount = useMemo(() => {
    return groups.reduce((count, group) => {
      return (
        count +
        group.children.length +
        group.children.reduce(
          (subCount, main) => subCount + main.children.length,
          0,
        )
      );
    }, 0);
  }, [groups]);

  const selectedCount = committedGenre.length + committedSubGenre.length;

  const resolveGenreDisplayLabel = (id: string): string => {
    for (const group of groups) {
      for (const main of group.children) {
        if (main.id === id) return main.labelKo || main.label;
        const sub = main.children.find((item) => item.id === id);
        if (sub) return sub.labelKo || sub.label;
      }
    }
    return GENRE_TITLE_MAP[id] || id;
  };

  const selectedDisplayLabels = useMemo(() => {
    const directText = String(directInput?.selectedText || '').trim();
    const ids = Array.from(new Set([...committedGenre, ...committedSubGenre]));
    const labels = ids
      .filter((id) => !String(id || '').startsWith('__custom_genre__:'))
      .map(resolveGenreDisplayLabel)
      .filter(Boolean);
    return directText ? Array.from(new Set([directText, ...labels])) : labels;
  }, [committedGenre, committedSubGenre, groups, directInput?.selectedText]);

  const selectionRoleEntries = selectedDisplayLabels.map((label, index) => ({
    role: index === 0 ? '메인' : '서브',
    label,
  }));

  const getSelectionOrderIndex = (id: string, ids = committedSubGenre) => {
    const targetIds = ids === committedSubGenre ? normalizedCommittedSubGenre : (ids === pendingSubIds ? normalizedPendingSubIds : normalizeSelectionList(ids));
    const index = targetIds.indexOf(id);
    return index >= 0 ? index + 1 : null;
  };

  const getGroupSelectionOrderIndex = (group: GroupItem, ids = committedSubGenre) => {
    const targetIds = ids === committedSubGenre ? normalizedCommittedSubGenre : (ids === pendingSubIds ? normalizedPendingSubIds : normalizeSelectionList(ids));
    for (const main of group.children) {
      const directIndex = targetIds.indexOf(main.id);
      if (directIndex >= 0) return directIndex + 1;
      for (const sub of main.children) {
        const subIndex = targetIds.indexOf(sub.id);
        if (subIndex >= 0) return subIndex + 1;
      }
    }
    return null;
  };

  const getMainSelectionOrderIndex = (main: MainGenreItem, ids = pendingSubIds.length > 0 ? pendingSubIds : committedSubGenre) => {
    const indexes = getMainSelectionOrderIndexes(main, ids);
    return indexes[0] ?? null;
  };

  const getMainSelectionOrderIndexes = (main: MainGenreItem, ids = pendingSubIds.length > 0 ? pendingSubIds : committedSubGenre) => {
    return getMainSelectionOrderEntries(main, ids).map((entry) => entry.orderIndex);
  };

  const getMainSelectionOrderEntries = (main: MainGenreItem, ids = pendingSubIds.length > 0 ? pendingSubIds : committedSubGenre) => {
    const targetIds = ids === pendingSubIds ? normalizedPendingSubIds : (ids === committedSubGenre ? normalizedCommittedSubGenre : normalizeSelectionList(ids));
    return targetIds
      .map((id, index) => {
        const belongsToMain = id === main.id || main.children.some((sub) => sub.id === id);
        return belongsToMain ? { id, orderIndex: index + 1 } : null;
      })
      .filter((entry): entry is { id: string; orderIndex: number } => Boolean(entry));
  };

  const getGroupSelectionOrderIndexes = (group: GroupItem, ids = committedSubGenre) => {
    return getGroupSelectionOrderEntries(group, ids).map((entry) => entry.orderIndex);
  };

  const getGroupSelectionOrderEntries = (group: GroupItem, ids = committedSubGenre) => {
    const targetIds = ids === committedSubGenre ? normalizedCommittedSubGenre : (ids === pendingSubIds ? normalizedPendingSubIds : normalizeSelectionList(ids));
    return targetIds
      .map((id, index) => {
        const belongsToGroup = group.children.some((main) =>
          id === main.id || main.children.some((sub) => sub.id === id),
        );
        return belongsToGroup ? { id, orderIndex: index + 1 } : null;
      })
      .filter((entry): entry is { id: string; orderIndex: number } => Boolean(entry));
  };

  const clearCommittedGenreIds = (ids: string[], event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const removeSet = new Set(ids);
    if (removeSet.size === 0) return;

    const nextSubGenre = normalizeSelectionList(committedSubGenre).filter((id) => !removeSet.has(id));
    if (onCommitSelectionList) {
      onCommitSelectionList(nextSubGenre);
    } else {
      ids.forEach((id) => {
        if (committedSubGenre.includes(id)) onSelectSubGenre(id);
      });
    }

    ids.forEach((id) => {
      if (committedGenre.includes(id)) onSelectGenre(id);
    });
  };

  const clearPendingGenreIds = (ids: string[], event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const removeSet = new Set(ids);
    if (removeSet.size === 0) return;

    setPendingSubIds((prev) => {
      const next = normalizeSelectionList(prev).filter((id) => !removeSet.has(id));
      updateModalDirty(next);
      return next;
    });
  };

  const renderOrderBadge = (
    orderIndex: number,
    side: "left" | "right",
    onClear?: (event: React.MouseEvent<HTMLElement>) => void
  ) => {
    const isMain = orderIndex === 1;
    const backgroundColor = isMain ? '#050505' : '#FFB400';
    const textColor = isMain ? '#FFB400' : '#050505';
    const badgeClass = isMain ? 'soridraw-count-badge-main' : 'soridraw-count-badge-point';

    return (
      <span
        key={`${side}-${orderIndex}`}
        role={onClear ? "button" : undefined}
        tabIndex={onClear ? 0 : undefined}
        onClick={onClear}
        onKeyDown={(event) => {
          if (!onClear) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onClear(event as unknown as React.MouseEvent<HTMLElement>);
          }
        }}
        className={cn(
          badgeClass,
          onClear && "soridraw-clearable-badge cursor-pointer pointer-events-auto",
          !onClear && "pointer-events-none",
          "absolute top-1.5 z-20 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border px-1.5 text-[11px] font-black leading-none shadow-[0_3px_9px_rgba(0,0,0,0.32)] select-none",
          side === "right" ? "right-1.5" : "left-1.5"
        )}
        style={{
          backgroundColor,
          borderColor: isMain ? 'rgba(255, 187, 34, 0.38)' : 'rgba(5, 5, 5, 0.42)',
          color: textColor,
          fontWeight: 950,
          lineHeight: 1,
          ['--soridraw-badge-accent' as string]: '#FFB400',
        } as React.CSSProperties}
        title={onClear ? "이 버튼의 선택 해제" : isMain ? "메인 장르" : "서브 장르"}
        aria-label={onClear ? "이 버튼의 선택 해제" : isMain ? "메인 장르" : "서브 장르"}
      >
        <span
          aria-hidden="true"
          className="soridraw-badge-number block font-black leading-none"
          style={{
            color: textColor,
            fontWeight: 950,
            lineHeight: 1,
            textShadow: 'none',
            WebkitTextStroke: '0',
          }}
        >
          {orderIndex}
        </span>
        {onClear && (
          <X
            aria-hidden="true"
            className="soridraw-badge-x hidden h-3.5 w-3.5"
            strokeWidth={3}
            style={{ color: textColor }}
          />
        )}
      </span>
    );
  };

  const renderSelectionOrderBadge = (orderIndex: number | null, onClear?: (event: React.MouseEvent<HTMLElement>) => void) => {
    if (!orderIndex) return null;
    return renderOrderBadge(orderIndex, "right", onClear);
  };

  const renderCategoryOrderBadges = (entries: Array<{ id: string; orderIndex: number }>, onClear?: (event: React.MouseEvent<HTMLElement>) => void) => {
    const uniqueIndexes = Array.from(new Set(entries.map((entry) => entry.orderIndex)))
      .filter((orderIndex) => orderIndex === 1 || orderIndex === 2)
      .sort((a, b) => a - b);

    if (uniqueIndexes.length === 0) return null;

    const hasMainAndSub = uniqueIndexes.includes(1) && uniqueIndexes.includes(2);

    return (
      <>
        {uniqueIndexes.includes(2) && renderOrderBadge(2, hasMainAndSub ? "left" : "right", onClear)}
        {uniqueIndexes.includes(1) && renderOrderBadge(1, "right", onClear)}
      </>
    );
  };

  const isExpandSummaryActive = isExpanded;

  useEffect(() => {
    if (!isDirectInputEditing) setDirectInputDraft(directInput?.selectedText || '');
  }, [directInput?.selectedText, isDirectInputEditing]);

  const openDirectInput = () => {
    setDirectInputDraft(directInput?.selectedText || '');
    setIsDirectInputEditing(true);
  };

  const applyDirectInput = () => {
    const trimmed = directInputDraft.trim();
    if (!trimmed) {
      directInput?.onCancelSelected?.();
      setIsDirectInputEditing(false);
      return;
    }
    directInput?.onApply(trimmed);
    setIsDirectInputEditing(false);
  };

  const cancelDirectInput = () => {
    setDirectInputDraft(directInput?.selectedText || '');
    setIsDirectInputEditing(false);
  };

  const buildModalTooltip = (item: {
    label: string;
    labelKo?: string;
    description?: string;
    descriptionKo?: string;
  }) => ({
    label: item.labelKo || item.label,
    description:
      item.descriptionKo ||
      item.description ||
      DEFAULT_SUB_DESCRIPTION,
  });

  const finalizeAndClose = (shouldCommit = true, skipHistory = false) => {
    if (shouldCommit && hasChangedInModal) {
      commitSelection(pendingMainId, pendingSubId);
    }
    if (!skipHistory && modalHistoryDepthRef.current > 0) {
      window.history.go(-modalHistoryDepthRef.current);
    }
    setActiveGroup(null);
    setActiveMain(null);
    setPendingMainId(null);
    setPendingSubId(null);
    setPendingSubIds([]);
    setPendingRemoveSubId(null);
    setModalStep("main");
    setHasChangedInModal(false);
    initialModalMainIdRef.current = null;
    initialModalSubIdRef.current = null;
    modalHistoryDepthRef.current = 0;
  };

  const openMainModal = (group: GroupItem) => {
    setActiveGroup(group);
    setActiveMain(null);
    setHoveredModalItem(buildModalTooltip(group));
    setModalStep("main");
    setPendingMainId(null);
    setPendingSubId(null);
    setPendingSubIds(normalizeSelectionList(committedSubGenre));
    setPendingRemoveSubId(null);
    initialModalMainIdRef.current = null;
    initialModalSubIdRef.current = null;
    setHasChangedInModal(false);

    window.history.pushState({ genreModal: "main" }, "");
    modalHistoryDepthRef.current = 1;
  };

  const closeModal = () => {
    finalizeAndClose(false);
  };

  const applyModalChanges = () => {
    finalizeAndClose(true);
  };

  const updateModalDirty = (nextIds: string[]) => {
    const normalize = (ids: string[]) => JSON.stringify(normalizeSelectionList(ids).sort());
    setHasChangedInModal(normalize(nextIds) !== normalize(committedSubGenre));
  };

  const handleBack = () => {
    if (modalStep === "sub") {
      window.history.back();
      return;
    }
    finalizeAndClose(false);
  };

  const handleMainClick = (main: MainGenreItem) => {
    setHoveredModalItem(buildModalTooltip(main));
    handleOpenSub(main);
  };

  const handleOpenSub = (main: MainGenreItem) => {
    // 중분류는 선택값이 아니라 폴더/탭 역할만 한다.
    // 소분류 화면에는 실제 leaf 장르만 표시하고, 중분류 자체는 첫 번째 선택 항목으로 넣지 않는다.
    const legacyMainSelected = committedGenre.includes(main.id) || committedSubGenre.includes(main.id);

    setPendingMainId(null);
    setPendingSubId(null);
    setPendingSubIds(normalizeSelectionList(committedSubGenre));
    setPendingRemoveSubId(null);
    // 기존 저장값에 중분류가 남아 있는 경우, 사용자가 leaf 장르를 새로 선택하면 함께 제거되도록만 기록한다.
    // 같은 중분류 안에서도 leaf 장르를 2개까지 자유롭게 추가할 수 있게 기존 leaf 선택값은 자동 제거하지 않는다.
    initialModalMainIdRef.current = legacyMainSelected ? main.id : null;
    initialModalSubIdRef.current = null;
    setHasChangedInModal(false);

    setActiveMain(main);
    setHoveredModalItem(buildModalTooltip(main));
    setModalStep("sub");

    window.history.pushState({ genreModal: "sub" }, "");
    modalHistoryDepthRef.current = 2;
  };

  const handleSubClick = (itemId: string) => {
    if (!activeMain) return;

    const clickedItem = activeMain.children.find((item) => item.id === itemId);
    if (clickedItem) {
      setHoveredModalItem(buildModalTooltip(clickedItem));
    }

    setPendingMainId(null);
    setPendingSubId(null);
    setPendingRemoveSubId(null);
    setPendingSubIds((prev) => {
      const isSelected = prev.includes(itemId);
      const next = isSelected
        ? prev.filter((id) => id !== itemId)
        : normalizeSelectionList([...prev, itemId]);
      updateModalDirty(next);
      return next;
    });
  };

  const handleClearModalSelection = () => {
    setPendingMainId(null);
    setPendingSubId(null);
    setPendingRemoveSubId(null);
    setPendingSubIds([]);
    updateModalDirty([]);
  };

  const commitSelection = (mainId: string | null, subId: string | null) => {
    if (onCommitSelectionList) {
      onCommitSelectionList(normalizeSelectionList(pendingSubIds));
      return;
    }

    const initialMainId = initialModalMainIdRef.current;
    const initialSubId = initialModalSubIdRef.current;
    const meta = {
      removeMainId:
        initialMainId && initialMainId !== mainId ? initialMainId : null,
      removeSubId:
        pendingRemoveSubId ?? (initialSubId && initialSubId !== subId ? initialSubId : null),
    };

    if (onCommitSelection) {
      onCommitSelection(mainId, subId, meta);
      return;
    }

    if (meta.removeMainId) onSelectGenre(meta.removeMainId);
    if (meta.removeSubId) onSelectSubGenre(meta.removeSubId);
    if (mainId) onSelectGenre(mainId);
    if (subId) onSelectSubGenre(subId);
  };

  const applyMain = () => {
    if (!hasChangedInModal) return;
    commitSelection(pendingMainId, null);
    setPendingRemoveSubId(null);
    setHasChangedInModal(false);
    finalizeAndClose(false);
  };

  const applySub = () => {
    if (!hasChangedInModal) return;
    commitSelection(pendingMainId, pendingSubId);
    setHasChangedInModal(false);
    finalizeAndClose(false);
  };

  const handleRandom = () => {
    const randomLeafGenres = groups
      .flatMap((group) => group.children)
      .flatMap((main) => main.children || [])
      .filter((item) => !isInstrumentalBgmGenreId(item.id));
    if (randomLeafGenres.length === 0) return;

    const randomSub = randomLeafGenres[Math.floor(Math.random() * randomLeafGenres.length)];
    if (randomSub) {
      onSelectSubGenre(randomSub.id);
    }
  };

  const showConfirmButton = hasChangedInModal;
  const currentModalTooltip =
    hoveredModalItem ||
    (modalStep === "sub" && activeMain
      ? buildModalTooltip(activeMain)
      : activeGroup
        ? buildModalTooltip(activeGroup)
        : null);

  useEffect(() => {
    if (!activeGroup) return;

    // Do not lock or reposition the document body here.
    // AI Studio preview can hide the portal modal and freeze page scrolling when
    // body uses position: fixed / top: -scrollY. The modal has its own overlay and
    // inner scroll area, so Escape handling is enough.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finalizeAndClose(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
    };
  }, [activeGroup, hasChangedInModal, pendingMainId, pendingSubId, pendingRemoveSubId, pendingSubIds]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!activeGroup) return;

      const state = event.state;

      // If we landed on a state that doesn't belong to this modal, close it.
      if (!state || !state.genreModal) {
        finalizeAndClose(false, true);
        return;
      }

      // If we landed on 'main' state
      if (state.genreModal === "main") {
        setModalStep("main");
        setActiveMain(null);
        modalHistoryDepthRef.current = 1;
        return;
      }

      // If we landed on 'sub' state
      if (state.genreModal === "sub") {
        setModalStep("sub");
        modalHistoryDepthRef.current = 2;
        return;
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeGroup]);

  return (
    <div data-expand-section data-studio-menu="genre" className="soridraw-expand-card soridraw-studio-menu-card soridraw-studio-shadow-surface bg-[var(--card-bg)] rounded-[28px] p-7 flex flex-col justify-between h-auto relative group">
      <style>{`
        .soridraw-genre-desc-track {
          display: inline-flex;
          min-width: max-content;
          max-width: none;
          gap: 2rem;
          white-space: nowrap;
          transform: translateX(0);
        }
        .soridraw-genre-desc-copy {
          display: inline-block;
          white-space: nowrap;
        }
        .soridraw-genre-main-card:hover .soridraw-genre-desc-track,
        .soridraw-genre-main-card:focus-within .soridraw-genre-desc-track {
          animation: soridrawGenreDescMarquee 8s linear infinite;
        }
        @keyframes soridrawGenreDescMarquee {
          0%, 15% { transform: translateX(0); }
          85%, 100% { transform: translateX(calc(-50% - 1rem)); }
        }
      `}</style>
      <div className="flex-1">
        <div className="soridraw-card-header flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative min-w-0">
              <h3
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className="text-[22px] font-bold text-[var(--text-primary)] flex items-center gap-2.5 cursor-help min-w-0"
              >
                <span className={cn("w-1.5 h-6 rounded-full shrink-0", genreAccent.bar)} />
                <span className="truncate">장르</span>
                <span className="soridraw-menu-count text-[15px] font-normal text-[var(--text-secondary)] ml-2 shrink-0">
                  ({selectedCount}/{totalCount})
                </span>
              </h3>
              <AnimatePresence>
                {showTitleTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={cn("absolute top-full left-0 mt-2 z-50 px-3 py-2 rounded-xl bg-[var(--card-bg)] border shadow-[var(--shadow-md)] w-56 pointer-events-none", genreAccent.selectedBorder)}
                  >
                    <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                      곡의 핵심 장르와 세부 스타일을 결정합니다. 대분류를
                      선택하고 메인 장르와 세부 장르를 조합하여 원하는 음악적
                      색깔을 만드세요.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="soridraw-card-header-actions flex items-center gap-2">
            {onToggleLock && (
              <button
                type="button"
                onClick={onToggleLock}
                onMouseEnter={() =>
                  onHover({
                    id: "genre-lock",
                    label: isLocked ? "Unlock menu" : "Lock menu",
                    labelKo: isLocked ? "잠금 해제" : "메뉴 잠금",
                    description: isLocked ? "장르를 랜덤 선택에 다시 포함합니다." : "현재 장르 설정을 유지하고 랜덤 선택에서 제외합니다.",
                    _ts: Date.now(),
                  })
                }
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "p-2.5 rounded-xl transition-all shadow-btn border border-btn-border",
                  isLocked
                    ? genreAccent.selected
                    : "bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover",
                )}
                title={isLocked ? "잠금 해제" : "메뉴 잠금"}
                aria-label={isLocked ? "장르 잠금 해제" : "장르 잠금"}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={onRandom}
              onMouseEnter={() =>
                onHover({
                  id: "genre-random",
                  label: "Random Selection",
                  labelKo: "랜덤 선택",
                  description: "세부 장르를 1개 또는 2개 무작위로 선택합니다.",
                  _ts: Date.now(),
                })
              }
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2.5 rounded-xl transition-all shadow-btn border border-btn-border",
                isRandomized
                  ? genreAccent.selected
                  : "bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover",
              )}
              title="랜덤 선택"
            >
              <Dices className="w-4 h-4" />
            </button>
            <button
              onClick={onClear}
              onMouseEnter={() =>
                onHover({
                  id: "genre-clear",
                  label: "Reset",
                  labelKo: "초기화",
                  description: "선택한 장르를 초기화합니다.",
                  _ts: Date.now(),
                })
              }
              onMouseLeave={() => onHover(null)}
              className={cn(
                "p-2.5 rounded-xl transition-all border shadow-btn",
                selectedCount > 0 || isRandomized
                  ? genreAccent.selectedSoft
                  : "bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:bg-btn-hover",
              )}
              title="초기화"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="soridraw-expand-content overflow-hidden min-h-[76px] transition-[max-height,opacity] duration-300 ease-out"
          style={{
            maxHeight: isExpanded ? forcedHeight || contentHeight || 320 : 76,
            opacity: 1
          }}
        >
          <div ref={contentRef} className="grid grid-cols-2 gap-2.5 md:gap-3">
            {groups.map((group) => {
              const hasSelectedMain = group.children.some((main) =>
                committedGenre.includes(main.id) ||
                committedSubGenre.includes(main.id) ||
                main.children.some((sub) => committedSubGenre.includes(sub.id)),
              );
              const groupOrderEntries = getGroupSelectionOrderEntries(group);
              const groupSelectedIds = groupOrderEntries.map((entry) => entry.id);
              return (
                <button
                  key={group.id}
                  onClick={() => openMainModal(group)}
                  onMouseEnter={() =>
                    onHover({
                      id: group.id,
                      label: group.label,
                      labelKo: group.labelKo,
                      description:
                        group.description || DEFAULT_GROUP_DESCRIPTION,
                      descriptionKo: group.descriptionKo,
                      _ts: Date.now(),
                    } as CategoryItem)
                  }
                  onMouseLeave={() => onHover(null)}
                  className={cn(
                    "relative min-h-[58px] rounded-2xl border px-4 py-2.5 text-left transition-all flex items-center justify-center shadow-btn",
                    hasSelectedMain
                      ? genreAccent.selected
                      : "bg-btn-bg border-[var(--keyword-button-border)] text-[var(--text-primary)] hover:bg-btn-hover",
                  )}
                >
                  {renderCategoryOrderBadges(groupOrderEntries, (event) => clearCommittedGenreIds(groupSelectedIds, event))}
                  <span className="soridraw-menu-keyword-label text-[15px] md:text-[16.5px] font-bold leading-tight text-center whitespace-nowrap tracking-[-0.01em]">
                    {group.labelKo || group.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        data-expanded={isExpanded ? "true" : "false"}
        role={isDirectInputEditing ? undefined : (onToggleExpand ? "button" : undefined)}
        tabIndex={isDirectInputEditing ? undefined : (onToggleExpand ? 0 : undefined)}
        aria-pressed={isDirectInputEditing ? undefined : (onToggleExpand ? isExpanded : undefined)}
        onClick={(event) => {
          if (isDirectInputEditing) return;
          onToggleExpand && handleExpandableToggle(event, isExpanded, onToggleExpand);
        }}
        onKeyDown={(event) => {
          if (isDirectInputEditing || !onToggleExpand) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleExpand();
            keepExpandableSectionInView(event.currentTarget, isExpanded);
          }
        }}
        className={cn(
          "soridraw-expand-summary soridraw-menu-summary-box mt-5 h-[64px] rounded-2xl border border-dashed px-5 py-3 flex items-center justify-center text-center overflow-hidden transition-all relative",
          isExpandSummaryActive
            ? cn(genreAccent.summaryActive, "border-dashed")
            : "border-[var(--border-color)]",
          !isDirectInputEditing && onToggleExpand && !isExpandSummaryActive && cn("cursor-pointer focus:outline-none focus:ring-1 focus:ring-[rgb(var(--soridraw-menu-amber-rgb)/0.30)]", genreAccent.summaryHover),
          !isDirectInputEditing && onToggleExpand && isExpandSummaryActive && "cursor-pointer focus:outline-none focus:ring-1 focus:ring-[rgb(var(--soridraw-menu-amber-rgb)/0.30)]"
        )}
        style={{
          '--soridraw-summary-border': genreAccent.summaryBorder,
          '--soridraw-summary-border-hover': genreAccent.summaryBorderHover,
          '--soridraw-summary-bg-active': genreAccent.summaryActiveBg,
        } as React.CSSProperties}
        title={onToggleExpand ? (isExpanded ? "접기" : "펼치기") : undefined}
      >
        {isDirectInputEditing && directInput ? (
          <div className="flex items-center gap-2 w-full">
            <input
              value={directInputDraft}
              onChange={(event) => setDirectInputDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyDirectInput();
                if (event.key === 'Escape') cancelDirectInput();
              }}
              autoFocus
              placeholder="장르 직접 입력"
              className={cn("flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-semibold text-center", genreAccent.text, "placeholder:text-white/20")}
            />
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); applyDirectInput(); }}
              className={cn("shrink-0 w-8 h-8 bg-transparent border-0 transition-colors flex items-center justify-center", genreAccent.text)}
              aria-label="직접입력 적용"
            >
              <Check className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); cancelDirectInput(); }}
              className="shrink-0 w-8 h-8 bg-transparent border-0 text-[var(--text-secondary)] hover:text-red-400 transition-colors flex items-center justify-center"
              aria-label="직접입력 취소"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        ) : selectedDisplayLabels.length > 0 ? (
          <div
            data-item-count={selectionRoleEntries.length}
            className={cn("soridraw-menu-summary-text soridraw-menu-summary-text--selected soridraw-genre-summary-items soridraw-selected-summary flex min-w-0 w-full items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap text-[15px] font-black leading-tight", directInput ? "pr-10" : "")}
          >
            {selectionRoleEntries.map((item, index) => (
              <React.Fragment key={`${item.role}-${item.label}-${index}`}>
                {index > 0 && (
                  <span className="soridraw-genre-summary-separator shrink-0 text-[rgb(var(--soridraw-menu-amber-soft-rgb)/0.35)]">·</span>
                )}
                <span className="soridraw-genre-summary-item flex min-w-0 items-center gap-1.5">
                  <span className="soridraw-genre-summary-role shrink-0 rounded-full border border-[rgb(var(--soridraw-menu-amber-rgb)/0.24)] bg-[rgb(var(--soridraw-menu-amber-rgb)/0.12)] px-1.5 py-[2px] text-[10px] font-black leading-none tracking-tight text-[rgb(var(--soridraw-menu-amber-soft-rgb)/0.78)]">
                    {item.role}
                  </span>
                  <span className="soridraw-genre-summary-item-label min-w-0 truncate">{item.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <p className={cn("soridraw-menu-summary-text soridraw-menu-summary-text--empty text-[15px] font-medium leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis", directInput ? "pr-10" : "")}>
            장르를 설정하세요.
          </p>
        )}
        {directInput && !isDirectInputEditing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center">
            <button
              type="button"
              onPointerDown={(event) => { event.stopPropagation(); }}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); openDirectInput(); }}
              onMouseEnter={() => onHover({ id: 'direct-genre', label: 'Direct input', labelKo: '직접 입력', description: '장르 키워드를 직접 입력합니다.' } as CategoryItem)}
              onMouseLeave={() => onHover(null)}
              className="soridraw-direct-input-button soridraw-no-active-translate w-12 h-12 bg-transparent border-0 shadow-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center active:scale-95 origin-center"
              aria-label="장르 직접 입력"
            >
              <Edit2 className="w-[22px] h-[22px]" />
            </button>
          </div>
        )}
      </div>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {activeGroup && (
            <motion.div
              key="genre-hierarchy-modal"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center p-4 overscroll-none"
            >
              <div
                className={cn(
                  "absolute inset-0 bg-black/40 transition-none",
                  isBackdropBlurReady ? "backdrop-blur-sm" : "backdrop-blur-0"
                )}
                onClick={applyModalChanges}
              />
              <motion.div
                initial={{ opacity: 1, scale: 1, y: 0 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0 }}
                className="soridraw-studio-genre-modal-panel w-full max-w-md md:max-w-2xl lg:max-w-3xl rounded-[32px] bg-[var(--card-bg)] shadow-2xl overflow-hidden relative z-10"
                onClick={(e) => e.stopPropagation()}
                onWheel={blockModalOuterScroll}
                onTouchMove={blockModalOuterScroll}
              >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-center justify-between gap-3 relative bg-[var(--bg-secondary)]">
                <h3
                  className="min-w-0 flex-1 text-left text-xl md:text-2xl font-bold text-[var(--text-primary)] whitespace-nowrap truncate pr-2"
                >
                  {modalStep === "main"
                    ? activeGroup.labelKo || activeGroup.label
                    : activeMain?.labelKo || activeMain?.label}
                </h3>

                <div className="flex items-center gap-2 shrink-0">
                  {pendingSubIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearModalSelection}
                      className="soridraw-modal-reset-button"
                      title="초기화"
                      aria-label="선택한 장르 초기화"
                    >
                      초기화
                    </button>
                  )}
                  {showConfirmButton && (
                    <button
                      type="button"
                      onClick={applyModalChanges}
                      className="w-10 h-10 rounded-full border transition-all flex items-center justify-center shrink-0 shadow-btn active:scale-90 bg-[var(--soridraw-menu-amber)] text-[var(--soridraw-selected-text)] border-[rgb(var(--soridraw-menu-amber-rgb)/0.55)] hover:brightness-110"
                      title="변경 적용"
                      aria-label="변경 적용"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="w-10 h-10 rounded-full border transition-all flex items-center justify-center shrink-0 shadow-btn active:scale-90 bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:text-[var(--soridraw-menu-amber-soft)] hover:border-[rgb(var(--soridraw-menu-amber-rgb)/0.45)]"
                    title={showConfirmButton ? "변경 적용 없이 닫기" : "닫기"}
                    aria-label={showConfirmButton ? "변경 적용 없이 닫기" : "닫기"}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Selection Status Bar */}
              <div className="px-6 py-2.5 bg-[rgb(var(--soridraw-menu-amber-rgb)/0.06)] border-b border-[rgb(var(--soridraw-menu-amber-rgb)/0.18)] flex items-center justify-start gap-2 overflow-hidden text-left">
                <span className="text-[10px] font-black text-[var(--soridraw-menu-amber-soft)] uppercase tracking-widest shrink-0">
                  Selection
                </span>
                <div className="min-w-0 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] truncate break-keep">
                  {pendingSubIds.length > 0 ? (
                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
                      {pendingSubIds.map((id, index) => {
                        const role = index === 0 ? '메인' : '서브';
                        const label = resolveGenreDisplayLabel(id);
                        return (
                          <React.Fragment key={`${role}-${id}-${index}`}>
                            {index > 0 && (
                              <span className="shrink-0 text-[rgb(var(--soridraw-menu-amber-soft-rgb)/0.35)]">·</span>
                            )}
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="shrink-0 rounded-full border border-[rgb(var(--soridraw-menu-amber-rgb)/0.24)] bg-[rgb(var(--soridraw-menu-amber-rgb)/0.12)] px-1.5 py-[2px] text-[10px] font-black leading-none tracking-tight text-[rgb(var(--soridraw-menu-amber-soft-rgb)/0.78)]">
                                {role}
                              </span>
                              <span className="min-w-0 truncate text-[var(--soridraw-menu-amber-soft)]">{label}</span>
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-[var(--text-secondary)]">미선택</span>
                  )}
                </div>
              </div>

              <div
                className="p-5 md:p-6 space-y-4 max-h-[60vh] md:max-h-[62vh] overflow-y-auto overscroll-contain custom-scrollbar"
                style={{ overscrollBehavior: 'contain' }}
                onWheel={handleModalWheel}
                onTouchStart={handleModalTouchStart}
                onTouchMove={handleModalTouchMove}
              >
                {modalStep === "main" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {activeGroup.children.map((main) => {
                      const activeModalIds = pendingSubIds.length > 0 ? pendingSubIds : committedSubGenre;
                      const mainOrderEntries = getMainSelectionOrderEntries(main, activeModalIds);
                      const mainSelectedIds = mainOrderEntries.map((entry) => entry.id);
                      const isActiveVisual =
                        committedGenre.includes(main.id) ||
                        activeModalIds.includes(main.id) ||
                        main.children.some((sub) => activeModalIds.includes(sub.id));

                      const mainDescription = main.descriptionKo ||
                        main.description ||
                        DEFAULT_MAIN_DESCRIPTION;

                      return (
                        <div
                          key={main.id}
                          className="group/card soridraw-genre-main-card relative"
                          onMouseEnter={() =>
                            setHoveredModalItem({
                              label: main.labelKo || main.label,
                              description:
                                main.descriptionKo ||
                                main.description ||
                                DEFAULT_MAIN_DESCRIPTION,
                            })
                          }
                          onMouseLeave={() => setHoveredModalItem(null)}
                        >
                          <button
                            onClick={() => handleMainClick(main)}
                            className={cn(
                              "relative w-full min-h-[82px] rounded-2xl border p-4 md:p-5 transition-all duration-200 flex items-center justify-center text-center hover:scale-[1.01] active:scale-[0.99]",
                              isActiveVisual
                                ? genreAccent.selected
                                : "bg-btn-bg border-btn-border hover:bg-btn-hover hover:border-[rgb(var(--soridraw-menu-amber-rgb)/0.35)] text-[var(--text-primary)] shadow-btn",
                            )}
                            title="세부 장르 열기"
                          >
                            {renderCategoryOrderBadges(mainOrderEntries, (event) => clearPendingGenreIds(mainSelectedIds, event))}
                            <div className="w-full min-w-0">
                              <div className="font-bold text-[19px] md:text-[21px] tracking-tight break-keep truncate">
                                {main.labelKo || main.label}
                              </div>
                              <div
                                className={cn(
                                  "soridraw-genre-desc-window w-full mt-1 overflow-hidden",
                                  isActiveVisual
                                    ? "text-[rgb(23_23_23/0.75)] font-black"
                                    : "text-[var(--text-secondary)]",
                                )}
                              >
                                <span className="soridraw-genre-desc-track text-[13px] md:text-[14px] break-keep">
                                  <span className="soridraw-genre-desc-copy">{mainDescription}</span>
                                  <span className="soridraw-genre-desc-copy" aria-hidden="true">{mainDescription}</span>
                                </span>
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {modalStep === "sub" && activeMain && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {activeMain.children.map((item) => {
                      const isActiveVisual = pendingSubIds.includes(item.id);
                      const itemOrderIndex = getSelectionOrderIndex(item.id, pendingSubIds);

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSubClick(item.id)}
                          onMouseEnter={() =>
                            setHoveredModalItem({
                              label: item.labelKo || item.label,
                              description:
                                item.descriptionKo ||
                                item.description ||
                                DEFAULT_SUB_DESCRIPTION,
                            })
                          }
                          onMouseLeave={() => setHoveredModalItem(null)}
                          className={cn(
                            "relative px-4 py-4 md:px-5 md:py-5 rounded-2xl font-bold text-sm md:text-base transition-all duration-200 border text-center flex items-center justify-center min-h-[64px] md:min-h-[72px] hover:scale-[1.01] active:scale-[0.99] break-keep",
                            isActiveVisual && "font-black soridraw-selected-strong",
                            isActiveVisual
                              ? genreAccent.selected
                              : "bg-btn-bg text-[var(--text-primary)] border-btn-border hover:bg-btn-hover hover:border-[rgb(var(--soridraw-menu-amber-rgb)/0.35)] shadow-btn",
                          )}
                        >
                          {renderSelectionOrderBadge(itemOrderIndex, (event) => clearPendingGenreIds([item.id], event))}
                          {item.labelKo || item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Info Area */}
              <div className="px-6 py-5 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] h-[110px] flex items-center justify-center gap-4 overflow-hidden shadow-inner">
                <div className="p-2.5 rounded-xl bg-[rgb(var(--soridraw-menu-amber-rgb)/0.12)] text-[var(--soridraw-menu-amber-soft)] shrink-0 shadow-inner hidden md:flex">
                  <Info className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 text-center">
                  {currentModalTooltip ? (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={currentModalTooltip.label}
                      className="flex flex-col items-center"
                    >
                      <div className="text-sm font-bold text-[var(--text-primary)] mb-1 break-keep">
                        {currentModalTooltip.label}
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 font-medium break-keep">
                        {currentModalTooltip.description}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="text-xs text-[var(--text-secondary)] italic font-medium opacity-60 break-keep">
                      장르 항목에 마우스를 올리면 자세한 설명을 볼 수 있어요.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

const isArrayEqual = (a: any[] | undefined, b: any[] | undefined) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const GenreHierarchySelector = React.memo(GenreHierarchySelectorComponent, (prev, next) => {
  return prev.isLocked === next.isLocked &&
         prev.isExpanded === next.isExpanded &&
         prev.isRandomized === next.isRandomized &&
         prev.forcedHeight === next.forcedHeight &&
         prev.directInput?.selectedText === next.directInput?.selectedText &&
         isArrayEqual(prev.selectedGenre, next.selectedGenre) &&
         isArrayEqual(prev.selectedSubGenre, next.selectedSubGenre);
});

export default GenreHierarchySelector;
