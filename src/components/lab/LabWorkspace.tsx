import React, { PointerEvent, useEffect, useRef, useState } from 'react';
import { Grip, Music2, Network, Sparkles } from 'lucide-react';

type IngredientType = 'prompt' | 'lyric';

type LabIngredient = {
  id: string;
  label: string;
  type: IngredientType;
};

type MapZone = {
  id: string;
  label: string;
  max: number;
  items: string[];
  x: number;
  y: number;
};

type IngredientDragState = {
  kind: 'ingredient';
  ingredient: LabIngredient;
  x: number;
  y: number;
  overZoneId: string | null;
};

type ZoneDragState = {
  kind: 'zone';
  tone: IngredientType;
  zoneId: string;
  x: number;
  y: number;
  boardRect: DOMRect;
};

type DragState = IngredientDragState | ZoneDragState;

type BoardSize = {
  width: number;
  height: number;
};

const NODE_WIDTH = 206;
const NODE_HEIGHT = 116;
const CENTER_SIZE = 112;

const promptIngredients: LabIngredient[] = [
  { id: 'genre', label: '장르', type: 'prompt' },
  { id: 'style', label: '스타일', type: 'prompt' },
  { id: 'sound', label: '사운드', type: 'prompt' },
  { id: 'mood', label: '분위기', type: 'prompt' },
  { id: 'theme', label: '주제', type: 'prompt' },
  { id: 'vocal', label: '보컬', type: 'prompt' },
  { id: 'tempo', label: '템포', type: 'prompt' },
  { id: 'structure', label: '곡 구조', type: 'prompt' },
  { id: 'director', label: '직접입력', type: 'prompt' },
];

const lyricIngredients: LabIngredient[] = [
  { id: 'speaker', label: '화자', type: 'lyric' },
  { id: 'scene', label: '장면', type: 'lyric' },
  { id: 'desire', label: '욕망', type: 'lyric' },
  { id: 'flaw', label: '결함', type: 'lyric' },
  { id: 'tone', label: '말투', type: 'lyric' },
  { id: 'hook', label: '반복 훅', type: 'lyric' },
  { id: 'density', label: '밀도', type: 'lyric' },
  { id: 'vocalSplit', label: '보컬 분리', type: 'lyric' },
  { id: 'englishPoint', label: '영어 포인트', type: 'lyric' },
];

const initialPromptZones: MapZone[] = [
  { id: 'genreLine', label: 'Genre', max: 3, items: ['장르'], x: 24, y: 20 },
  { id: 'soundLine', label: 'Sound', max: 4, items: ['사운드'], x: 76, y: 20 },
  { id: 'moodLine', label: 'Mood', max: 4, items: ['분위기', '주제'], x: 22, y: 63 },
  { id: 'vocalsLine', label: 'Vocals', max: 3, items: ['보컬'], x: 78, y: 63 },
  { id: 'productionLine', label: 'Production', max: 4, items: ['템포', '곡 구조'], x: 50, y: 84 },
];

const initialLyricZones: MapZone[] = [
  { id: 'verse', label: 'Verse', max: 4, items: ['장면', '화자'], x: 24, y: 22 },
  { id: 'preChorus', label: 'Pre-Chorus', max: 3, items: ['욕망'], x: 76, y: 22 },
  { id: 'chorus', label: 'Chorus', max: 4, items: ['반복 훅', '말투'], x: 78, y: 63 },
  { id: 'bridge', label: 'Bridge', max: 3, items: ['결함'], x: 24, y: 72 },
  { id: 'outro', label: 'Outro', max: 3, items: ['밀도'], x: 52, y: 86 },
];

function getTone(ingredientType: IngredientType) {
  return ingredientType === 'lyric'
    ? {
        main: '#FF7AAE',
        warm: '#FFD166',
        soft: 'rgba(255, 196, 105, 0.16)',
        fill: 'rgba(255, 122, 174, 0.22)',
        glow: 'rgba(255, 154, 115, 0.20)',
        text: '#FFE9F1',
        solid: 'rgba(32, 22, 24, 0.98)',
        surface: 'rgba(30, 23, 24, 0.97)',
      }
    : {
        main: '#FF7DAF',
        warm: '#FFD36B',
        soft: 'rgba(255, 211, 107, 0.16)',
        fill: 'rgba(255, 125, 175, 0.22)',
        glow: 'rgba(255, 152, 112, 0.20)',
        text: '#FFF0E8',
        solid: 'rgba(34, 23, 24, 0.98)',
        surface: 'rgba(31, 23, 25, 0.97)',
      };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function IngredientChip({ ingredient, onStartDrag }: { ingredient: LabIngredient; onStartDrag: (ingredient: LabIngredient, event: PointerEvent<HTMLDivElement>) => void }) {
  const tone = getTone(ingredient.type);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => onStartDrag(ingredient, event)}
      className="inline-flex cursor-grab select-none items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-2 text-xs font-black text-white/80 transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5"
      style={{
        WebkitUserDrag: 'none',
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.035), 0 0 24px ${tone.soft}`,
        backgroundImage: `linear-gradient(135deg, ${tone.warm}1E, ${tone.main}20)`,
      }}
    >
      <Grip className="h-3.5 w-3.5 text-white/24" />
      <span draggable={false}>{ingredient.label}</span>
    </div>
  );
}

function PlacedChip({ label, tone, onRemove }: { label: string; tone: IngredientType; onRemove: () => void }) {
  const toneStyle = getTone(tone);

  return (
    <button
      type="button"
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onRemove}
      className="select-none rounded-full px-2.5 py-1 text-[11px] font-black transition-all hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(135deg, ${toneStyle.warm}22, ${toneStyle.main}2B)`,
        color: toneStyle.text,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.045)',
      }}
    >
      {label}
    </button>
  );
}

function MapNode({
  zone,
  tone,
  active,
  moving,
  onRemoveItem,
  onStartMove,
}: {
  zone: MapZone;
  tone: IngredientType;
  active: boolean;
  moving: boolean;
  onRemoveItem: (zoneId: string, label: string) => void;
  onStartMove: (zoneId: string, tone: IngredientType, event: PointerEvent<HTMLDivElement>) => void;
}) {
  const percent = Math.min(100, Math.round((zone.items.length / Math.max(zone.max, 1)) * 100));
  const isComplete = zone.items.length >= zone.max;
  const toneStyle = getTone(tone);
  const lightOpacity = 0.08 + percent / 210;
  const glowStrength = 18 + percent * 0.42;

  return (
    <div
      data-lab-zone-id={zone.id}
      data-lab-zone-type={tone}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => onStartMove(zone.id, tone, event)}
      className={`absolute z-40 h-[116px] w-[206px] -translate-x-1/2 -translate-y-1/2 cursor-move select-none overflow-hidden rounded-[1.6rem] p-3.5 shadow-xl transition-[box-shadow,filter,transform,background] duration-300 ${active ? 'scale-[1.035]' : ''}`}
      style={{
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        WebkitUserDrag: 'none',
        background: toneStyle.surface,
        animation: isComplete ? 'labNodeHeartbeat 1.35s ease-in-out infinite' : undefined,
        filter: `brightness(${1 + percent / 260})`,
        boxShadow: active || moving
          ? `0 24px 70px rgba(0,0,0,0.38), 0 0 0 1px ${toneStyle.warm}90, 0 0 44px ${toneStyle.main}3F`
          : `0 18px 46px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.045), 0 0 ${glowStrength}px ${toneStyle.main}18`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: lightOpacity,
          background: `linear-gradient(135deg, ${toneStyle.warm} 0%, ${toneStyle.main} 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: isComplete ? 0.22 : 0,
          background: `linear-gradient(135deg, ${toneStyle.warm}55, ${toneStyle.main}66)`,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-white">{zone.label}</p>
          <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black text-white/45">{zone.items.length}/{zone.max}</span>
        </div>
        <div className="mt-3 flex max-h-[56px] flex-wrap gap-1.5 overflow-hidden">
          {zone.items.map((item) => (
            <PlacedChip key={item} label={item} tone={tone} onRemove={() => onRemoveItem(zone.id, item)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ConnectorLines({ zones, tone, boardSize }: { zones: MapZone[]; tone: IngredientType; boardSize: BoardSize }) {
  const toneStyle = getTone(tone);
  const width = Math.max(boardSize.width, 1);
  const height = Math.max(boardSize.height, 1);
  const cx = width / 2;
  const cy = height / 2;

  const makePath = (zone: MapZone) => {
    const zx = (zone.x / 100) * width;
    const zy = (zone.y / 100) * height;
    const dx = zx - cx;
    const dy = zy - cy;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const centerRadius = CENTER_SIZE / 2;
    const halfW = NODE_WIDTH / 2;
    const halfH = NODE_HEIGHT / 2;
    const targetOffset = Math.min(
      Math.abs(ux) > 0.001 ? halfW / Math.abs(ux) : Number.POSITIVE_INFINITY,
      Math.abs(uy) > 0.001 ? halfH / Math.abs(uy) : Number.POSITIVE_INFINITY,
    );
    const startX = cx + ux * centerRadius;
    const startY = cy + uy * centerRadius;
    const endX = zx - ux * targetOffset;
    const endY = zy - uy * targetOffset;
    const curve = Math.min(distance * 0.28, 160);
    const c1X = startX + ux * curve;
    const c1Y = startY + uy * curve * 0.28;
    const c2X = endX - ux * curve;
    const c2Y = endY - uy * curve * 0.28;

    return `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
  };

  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {zones.map((zone) => (
        <path
          key={zone.id}
          d={makePath(zone)}
          fill="none"
          stroke={zone.items.length ? `url(#${tone}-line-gradient)` : 'rgba(255,255,255,0.12)'}
          strokeWidth={zone.items.length ? 1.25 : 1}
          strokeLinecap="butt"
          opacity={zone.items.length ? 0.34 : 0.13}
        />
      ))}
      <defs>
        <linearGradient id={`${tone}-line-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={toneStyle.warm} />
          <stop offset="100%" stopColor={toneStyle.main} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MindMapBoard({
  title,
  center,
  tone,
  zones,
  activeZoneId,
  movingZoneId,
  onRemoveItem,
  onStartMove,
}: {
  title: string;
  center: string;
  tone: IngredientType;
  zones: MapZone[];
  activeZoneId: string | null;
  movingZoneId: string | null;
  onRemoveItem: (zoneId: string, label: string) => void;
  onStartMove: (zoneId: string, tone: IngredientType, event: PointerEvent<HTMLDivElement>) => void;
}) {
  const toneStyle = getTone(tone);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<BoardSize>({ width: 760, height: 810 });

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const update = () => setBoardSize({ width: board.clientWidth, height: board.clientHeight });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="min-h-[880px] rounded-[2rem] bg-white/[0.03] p-3 shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 px-1 text-sm font-black text-white">
        {tone === 'lyric' ? <Music2 className="h-4 w-4" style={{ color: toneStyle.main }} /> : <Sparkles className="h-4 w-4" style={{ color: toneStyle.warm }} />}
        {title}
      </div>

      <div
        ref={boardRef}
        data-lab-board-type={tone}
        className="relative min-h-[820px] overflow-hidden rounded-[2rem] bg-black/[0.09]"
      >
        <ConnectorLines zones={zones} tone={tone} boardSize={boardSize} />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-50 flex h-[112px] w-[112px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black text-white shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${toneStyle.warm}30, ${toneStyle.main}34), ${toneStyle.solid}`,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 42px ${toneStyle.glow}`,
          }}
        >
          {center}
        </div>
        {zones.map((zone) => (
          <MapNode
            key={zone.id}
            zone={zone}
            tone={tone}
            active={activeZoneId === zone.id}
            moving={movingZoneId === zone.id}
            onRemoveItem={onRemoveItem}
            onStartMove={onStartMove}
          />
        ))}
      </div>
    </section>
  );
}

export default function LabWorkspace() {
  const [promptZones, setPromptZones] = useState<MapZone[]>(initialPromptZones);
  const [lyricZones, setLyricZones] = useState<MapZone[]>(initialLyricZones);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const syncDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragging(next);
  };

  const addPromptItem = (zoneId: string, ingredient: LabIngredient) => {
    setPromptZones((zones) => zones.map((zone) => {
      if (zone.id !== zoneId || zone.items.includes(ingredient.label) || zone.items.length >= zone.max) return zone;
      return { ...zone, items: [...zone.items, ingredient.label] };
    }));
  };

  const addLyricItem = (zoneId: string, ingredient: LabIngredient) => {
    setLyricZones((zones) => zones.map((zone) => {
      if (zone.id !== zoneId || zone.items.includes(ingredient.label) || zone.items.length >= zone.max) return zone;
      return { ...zone, items: [...zone.items, ingredient.label] };
    }));
  };

  const removePromptItem = (zoneId: string, label: string) => {
    setPromptZones((zones) => zones.map((zone) => zone.id === zoneId ? { ...zone, items: zone.items.filter((item) => item !== label) } : zone));
  };

  const removeLyricItem = (zoneId: string, label: string) => {
    setLyricZones((zones) => zones.map((zone) => zone.id === zoneId ? { ...zone, items: zone.items.filter((item) => item !== label) } : zone));
  };

  const handleStartIngredientDrag = (ingredient: LabIngredient, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    syncDrag({ kind: 'ingredient', ingredient, x: event.clientX, y: event.clientY, overZoneId: null });
  };

  const handleStartZoneMove = (zoneId: string, tone: IngredientType, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    const board = target.closest('[data-lab-board-type]') as HTMLElement | null;
    if (!board) return;
    event.preventDefault();
    syncDrag({ kind: 'zone', zoneId, tone, x: event.clientX, y: event.clientY, boardRect: board.getBoundingClientRect() });
  };

  useEffect(() => {
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    const getDropTarget = (clientX: number, clientY: number, activeIngredient: LabIngredient) => {
      const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const zoneElement = element?.closest('[data-lab-zone-id]') as HTMLElement | null;
      const zoneId = zoneElement?.dataset.labZoneId ?? null;
      const zoneType = zoneElement?.dataset.labZoneType as IngredientType | undefined;

      if (!zoneId || zoneType !== activeIngredient.type) return null;
      return zoneId;
    };

    const updateZonePosition = (current: ZoneDragState, clientX: number, clientY: number) => {
      const halfX = (NODE_WIDTH / 2 / current.boardRect.width) * 100;
      const halfY = (NODE_HEIGHT / 2 / current.boardRect.height) * 100;
      const nextX = clamp(((clientX - current.boardRect.left) / current.boardRect.width) * 100, halfX, 100 - halfX);
      const nextY = clamp(((clientY - current.boardRect.top) / current.boardRect.height) * 100, halfY, 100 - halfY);
      const updater = (zone: MapZone) => zone.id === current.zoneId ? { ...zone, x: nextX, y: nextY } : zone;

      if (current.tone === 'prompt') {
        setPromptZones((zones) => zones.map(updater));
      } else {
        setLyricZones((zones) => zones.map(updater));
      }
      syncDrag({ ...current, x: clientX, y: clientY });
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      event.preventDefault();
      if (current.kind === 'ingredient') {
        const overZoneId = getDropTarget(event.clientX, event.clientY, current.ingredient);
        syncDrag({ ...current, x: event.clientX, y: event.clientY, overZoneId });
        return;
      }
      updateZonePosition(current, event.clientX, event.clientY);
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      event.preventDefault();
      if (current.kind === 'ingredient') {
        const overZoneId = getDropTarget(event.clientX, event.clientY, current.ingredient);
        if (overZoneId) {
          if (current.ingredient.type === 'prompt') {
            addPromptItem(overZoneId, current.ingredient);
          } else {
            addLyricItem(overZoneId, current.ingredient);
          }
        }
      }
      syncDrag(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') syncDrag(null);
    };

    const blockContextMenu = (event: MouseEvent) => event.preventDefault();

    document.body.style.userSelect = dragging ? 'none' : previousUserSelect;
    document.body.style.cursor = dragging?.kind === 'ingredient' ? 'grabbing' : dragging?.kind === 'zone' ? 'move' : previousCursor;

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', blockContextMenu);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', blockContextMenu);
    };
  }, [dragging?.kind]);

  const movingZoneId = dragging?.kind === 'zone' ? dragging.zoneId : null;
  const activePromptZoneId = dragging?.kind === 'ingredient' && dragging.ingredient.type === 'prompt' ? dragging.overZoneId : null;
  const activeLyricZoneId = dragging?.kind === 'ingredient' && dragging.ingredient.type === 'lyric' ? dragging.overZoneId : null;

  return (
    <div
      className="select-none"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <style>{`
        @keyframes labNodeHeartbeat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          45% { transform: translate(-50%, -50%) scale(1.028); }
          62% { transform: translate(-50%, -50%) scale(0.994); }
          78% { transform: translate(-50%, -50%) scale(1.014); }
        }
        [data-lab-board-type], [data-lab-zone-id], [role='button'] {
          -webkit-user-drag: none;
          user-select: none;
        }
      `}</style>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_276px_minmax(0,1fr)]">
        <MindMapBoard
          title="프롬프트"
          center="PROMPT"
          tone="prompt"
          zones={promptZones}
          activeZoneId={activePromptZoneId}
          movingZoneId={movingZoneId}
          onRemoveItem={removePromptItem}
          onStartMove={handleStartZoneMove}
        />

        <aside className="order-first rounded-[2rem] bg-white/[0.04] p-4 shadow-xl backdrop-blur-xl xl:order-none xl:min-h-[880px]">
          <div className="mb-4 flex items-center justify-center gap-2 text-sm font-black text-white">
            <Network className="h-4 w-4 text-[#FFD36B]" /> 재료
          </div>

          <div className="space-y-5">
            <div className="space-y-2.5">
              <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-[#FFD36B]/82">Prompt</p>
              <div className="flex flex-wrap justify-center gap-2">
                {promptIngredients.map((ingredient) => (
                  <IngredientChip key={ingredient.id} ingredient={ingredient} onStartDrag={handleStartIngredientDrag} />
                ))}
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            <div className="space-y-2.5">
              <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-[#FF7DAF]/80">Lyrics</p>
              <div className="flex flex-wrap justify-center gap-2">
                {lyricIngredients.map((ingredient) => (
                  <IngredientChip key={ingredient.id} ingredient={ingredient} onStartDrag={handleStartIngredientDrag} />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <MindMapBoard
          title="가사"
          center="LYRICS"
          tone="lyric"
          zones={lyricZones}
          activeZoneId={activeLyricZoneId}
          movingZoneId={movingZoneId}
          onRemoveItem={removeLyricItem}
          onStartMove={handleStartZoneMove}
        />
      </div>

      {dragging?.kind === 'ingredient' && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-xs font-black shadow-2xl"
          style={{
            left: dragging.x,
            top: dragging.y,
            background: `linear-gradient(135deg, ${getTone(dragging.ingredient.type).warm}33, ${getTone(dragging.ingredient.type).main}44), ${getTone(dragging.ingredient.type).solid}`,
            color: getTone(dragging.ingredient.type).text,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 18px 45px rgba(0,0,0,0.34)`,
          }}
        >
          {dragging.ingredient.label}
        </div>
      )}
    </div>
  );
}
