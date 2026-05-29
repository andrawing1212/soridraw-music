import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CategoryItem, GenreGroupItem } from "../types";
import { GENRE_HIERARCHY, GENRES } from "../constants";
import {
  RotateCcw,
  Dices,
  X,
  Check,
  ChevronRight,
  Info,
  Lock,
  Unlock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


const genreAccent = {
  bar: 'bg-[#DFA05D]/95',
  text: 'text-[#E8B878]',
  softText: 'text-[#E8B878]/58',
  selected: 'bg-[#DFA05D]/72 border-black/20 text-[#171717] font-black soridraw-selected-strong shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
  selectedSoft: 'bg-[#DFA05D]/14 border-black/20 text-[#E8B878] hover:bg-[#DFA05D]/20',
  summaryActive: 'bg-[#DFA05D]/[0.035] border-[#DFA05D]/15 text-[#E8B878]',
  summaryHover: 'hover:border-[#DFA05D]/20 hover:bg-[#DFA05D]/[0.035]',
  summaryBorder: 'rgba(223, 160, 93, 0.14)',
  summaryBorderHover: 'rgba(223, 160, 93, 0.24)',
  summaryActiveBg: 'rgba(223, 160, 93, 0.035)',
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


function keepExpandableSectionInView(trigger: HTMLElement, wasExpanded: boolean) {
  if (wasExpanded || typeof window === 'undefined') return;

  const section = trigger.closest('[data-expand-section]') as HTMLElement | null;
  if (!section) return;

  const triggerRect = trigger.getBoundingClientRect();
  const sectionRect = section.getBoundingClientRect();
  const edgePadding = 96;
  const shouldAnchor =
    sectionRect.top < edgePadding ||
    triggerRect.bottom > window.innerHeight - edgePadding;

  if (!shouldAnchor) return;

  const anchorSectionTop = () => {
    const updatedRect = section.getBoundingClientRect();
    const targetTop = Math.max(0, window.scrollY + updatedRect.top - edgePadding);
    if (Math.abs(window.scrollY - targetTop) > 2) {
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  };

  window.requestAnimationFrame(() => window.setTimeout(anchorSectionTop, 80));
  window.setTimeout(anchorSectionTop, 260);
}

function handleExpandableToggle(
  event: React.MouseEvent<HTMLElement>,
  isExpanded: boolean,
  onToggleExpand?: () => void
) {
  onToggleExpand?.();
  keepExpandableSectionInView(event.currentTarget, isExpanded);
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

export default function GenreHierarchySelector({
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
}: Props) {
  const [activeGroup, setActiveGroup] = useState<GroupItem | null>(null);
  const [activeMain, setActiveMain] = useState<MainGenreItem | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>("main");
  const [showTitleTooltip, setShowTitleTooltip] = useState(false);
  const [hoveredModalItem, setHoveredModalItem] = useState<{
    label: string;
    description: string;
  } | null>(null);
  const lastSyncedGenreRef = useRef<string[]>([]);
  const lastSyncedSubGenreRef = useRef<string[]>([]);

  const modalHistoryDepthRef = useRef(0);
  const modalScrollYRef = useRef(0);

  // committed selections from parent
  const committedGenre = selectedGenre ?? [];
  const committedSubGenre = selectedSubGenre ?? [];
  const MAX_MODAL_SELECTIONS = 2;
  const normalizeSelectionList = (ids: string[]) => Array.from(new Set(ids.filter(Boolean))).slice(-MAX_MODAL_SELECTIONS);

  // pending selections inside modal
  const [pendingMainId, setPendingMainId] = useState<string | null>(null);
  const [pendingSubId, setPendingSubId] = useState<string | null>(null);
  const [pendingRemoveSubId, setPendingRemoveSubId] = useState<string | null>(null);
  const [pendingSubIds, setPendingSubIds] = useState<string[]>([]);
  const [hasChangedInModal, setHasChangedInModal] = useState(false);
  const initialModalMainIdRef = useRef<string | null>(null);
  const initialModalSubIdRef = useRef<string | null>(null);

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
    const ids = Array.from(new Set([...committedGenre, ...committedSubGenre]));
    return ids.map(resolveGenreDisplayLabel).filter(Boolean);
  }, [committedGenre, committedSubGenre, groups]);
  const isExpandSummaryActive = isExpanded;

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

    modalScrollYRef.current = window.scrollY;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyTouchAction = document.body.style.touchAction;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscroll =
      document.documentElement.style.overscrollBehavior;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finalizeAndClose(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${modalScrollYRef.current}px`;
    document.body.style.width = "100%";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.touchAction = originalBodyTouchAction;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior =
        originalHtmlOverscroll;

      window.removeEventListener("keydown", handleKeyDown);

      window.scrollTo(0, modalScrollYRef.current);
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
    <motion.div
      data-expand-section
      layout="size"
      transition={{ layout: { duration: 0.25, ease: "easeOut" } }}
      className="bg-[var(--card-bg)] rounded-3xl p-6 border border-[var(--home-card-border)] flex flex-col justify-between h-auto relative group shadow-[var(--shadow-md)] [overflow-anchor:none]"
    >
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative min-w-0">
              <h3
                onMouseEnter={() => setShowTitleTooltip(true)}
                onMouseLeave={() => setShowTitleTooltip(false)}
                className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2 cursor-help min-w-0"
              >
                <span className={cn("w-1.5 h-6 rounded-full shrink-0", genreAccent.bar)} />
                <span className="truncate">장르</span>
                <span className="text-[14px] font-normal text-[var(--text-secondary)] ml-2 shrink-0">
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

          <div className="flex items-center gap-2">
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
                  description: "장르를 무작위로 선택합니다.",
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
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{
            height: isExpanded ? forcedHeight || contentHeight || 280 : 64,
            opacity: 1
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div ref={contentRef} className="grid grid-cols-2 gap-2 md:gap-2.5">
            {groups.map((group) => {
              const hasSelectedMain = group.children.some((main) =>
                committedGenre.includes(main.id) ||
                committedSubGenre.includes(main.id) ||
                main.children.some((sub) => committedSubGenre.includes(sub.id)),
              );
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
                    "min-h-[48px] rounded-xl border px-3 py-2 text-left transition-all flex items-center justify-center shadow-btn",
                    hasSelectedMain
                      ? genreAccent.selected
                      : "bg-btn-bg border-[var(--keyword-button-border)] text-[var(--text-primary)] hover:bg-btn-hover",
                  )}
                >
                  <span className="text-[12px] md:text-[13px] font-bold leading-tight text-center whitespace-nowrap tracking-[-0.01em]">
                    {group.labelKo || group.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div
        data-expanded={isExpanded ? "true" : "false"}
        role={onToggleExpand ? "button" : undefined}
        tabIndex={onToggleExpand ? 0 : undefined}
        aria-pressed={onToggleExpand ? isExpanded : undefined}
        onClick={(event) => onToggleExpand && handleExpandableToggle(event, isExpanded, onToggleExpand)}
        onKeyDown={(event) => {
          if (!onToggleExpand) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleExpand();
            keepExpandableSectionInView(event.currentTarget, isExpanded);
          }
        }}
        className={cn(
          "soridraw-expand-summary mt-4 h-[56px] rounded-2xl border border-dashed px-4 py-3 flex items-center justify-center text-center overflow-hidden transition-all",
          isExpandSummaryActive
            ? cn(genreAccent.summaryActive, "border-dashed")
            : "border-[var(--border-color)]",
          onToggleExpand && !isExpandSummaryActive && cn("cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#DFA05D]/30", genreAccent.summaryHover),
          onToggleExpand && isExpandSummaryActive && "cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#DFA05D]/30"
        )}
        style={{
          '--soridraw-summary-border': genreAccent.summaryBorder,
          '--soridraw-summary-border-hover': genreAccent.summaryBorderHover,
          '--soridraw-summary-bg-active': genreAccent.summaryActiveBg,
        } as React.CSSProperties}
        title={onToggleExpand ? (isExpanded ? "접기" : "펼치기") : undefined}
      >
        {selectedDisplayLabels.length > 0 ? (
          <p className={cn("text-sm font-black soridraw-selected-summary leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis", genreAccent.text)}>
            {selectedDisplayLabels.join(" · ")}
          </p>
        ) : (
          <p className={cn("text-sm font-medium leading-tight w-full text-center whitespace-nowrap overflow-hidden text-ellipsis", genreAccent.softText)}>
            장르를 선택하세요.
          </p>
        )}
      </div>

      <AnimatePresence>
        {activeGroup && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 overscroll-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={applyModalChanges}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
              className="w-full max-w-md rounded-[32px] bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl overflow-hidden relative z-10"
              onClick={(e) => e.stopPropagation()}
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
                      className="h-10 px-2.5 rounded-full border border-[#A47048]/35 bg-[#A47048]/12 text-[#D9B89D] text-[10.5px] font-black hover:bg-[#A47048]/18 transition-all active:scale-95"
                      title="전체해제"
                      aria-label="선택한 장르 전체해제"
                    >
                      전체해제
                    </button>
                  )}
                  {showConfirmButton && (
                    <button
                      type="button"
                      onClick={applyModalChanges}
                      className="w-10 h-10 rounded-full border transition-all flex items-center justify-center shrink-0 shadow-btn active:scale-90 bg-[#A47048]/72 text-[#FFF7EF] border-[#C69A76]/55 hover:bg-[#A47048]/78"
                      title="변경 적용"
                      aria-label="변경 적용"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => closeModal()}
                    className="w-10 h-10 rounded-full border transition-all flex items-center justify-center shrink-0 shadow-btn active:scale-90 bg-btn-bg text-[var(--text-secondary)] border-btn-border hover:text-[#D9B89D] hover:border-[#A47048]/45"
                    title={showConfirmButton ? "변경 적용 없이 닫기" : "닫기"}
                    aria-label={showConfirmButton ? "변경 적용 없이 닫기" : "닫기"}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Selection Status Bar */}
              <div className="px-6 py-2.5 bg-[#A47048]/6 border-b border-[#A47048]/18 flex items-center justify-start gap-2 overflow-hidden text-left">
                <span className="text-[10px] font-black text-[#D9B89D] uppercase tracking-widest shrink-0">
                  Selection
                </span>
                <div className="min-w-0 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] truncate break-keep">
                  {pendingSubIds.length > 0 ? (
                    <span className="text-[#D9B89D] truncate">
                      {pendingSubIds.map(resolveGenreDisplayLabel).join(" · ")}
                    </span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">미선택</span>
                  )}
                </div>
              </div>

              <div
                className="p-5 space-y-4 max-h-[60vh] overflow-y-auto overscroll-contain custom-scrollbar"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {modalStep === "main" && (
                  <div className="grid grid-cols-1 gap-3">
                    {activeGroup.children.map((main) => {
                      const isActiveVisual =
                        committedGenre.includes(main.id) ||
                        committedSubGenre.includes(main.id) ||
                        main.children.some((sub) => committedSubGenre.includes(sub.id));

                      return (
                        <div
                          key={main.id}
                          className="group/card relative"
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
                              "w-full rounded-2xl border p-4 transition-all duration-200 flex items-center justify-center text-center hover:scale-[1.02] active:scale-[0.98]",
                              isActiveVisual
                                ? genreAccent.selected
                                : "bg-btn-bg border-btn-border hover:bg-btn-hover hover:border-[#A47048]/35 text-[var(--text-primary)] shadow-btn",
                            )}
                            title="세부 장르 열기"
                          >
                            <div className="w-full min-w-0">
                              <div className="font-bold text-lg tracking-tight break-keep truncate">
                                {main.labelKo || main.label}
                              </div>
                              <div
                                className={cn(
                                  "text-xs truncate w-full break-keep",
                                  isActiveVisual
                                    ? "text-[#171717]/75 font-black"
                                    : "text-[var(--text-secondary)]",
                                )}
                              >
                                {main.descriptionKo ||
                                  main.description ||
                                  DEFAULT_MAIN_DESCRIPTION}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {modalStep === "sub" && activeMain && (
                  <div className="grid grid-cols-2 gap-3">
                    {activeMain.children.map((item) => {
                      const isActiveVisual = pendingSubIds.includes(item.id);

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
                            "px-4 py-4 rounded-2xl font-bold text-sm transition-all duration-200 border text-center flex items-center justify-center min-h-[64px] hover:scale-[1.02] active:scale-[0.98] break-keep",
                            isActiveVisual && "font-black soridraw-selected-strong",
                            isActiveVisual
                              ? genreAccent.selected
                              : "bg-btn-bg text-[var(--text-primary)] border-btn-border hover:bg-btn-hover hover:border-[#A47048]/35 shadow-btn",
                          )}
                        >
                          {item.labelKo || item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Info Area */}
              <div className="px-6 py-5 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] h-[110px] flex items-center justify-center gap-4 overflow-hidden shadow-inner">
                <div className="p-2.5 rounded-xl bg-[#A47048]/12 text-[#D9B89D] shrink-0 shadow-inner hidden md:flex">
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
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
