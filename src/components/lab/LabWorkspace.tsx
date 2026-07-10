import React, { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Grip, Network, Sparkles } from 'lucide-react';

type LabMode = 'style' | 'lyrics';
type IngredientType = 'style' | 'lyrics';

type LabIngredient = {
  id: string;
  label: string;
  type: IngredientType;
};

type MapNode = {
  id: string;
  label: string;
  max: number;
  items: string[];
  x: number;
  y: number;
};

type DragState =
  | { kind: 'ingredient'; ingredient: LabIngredient; x: number; y: number; overNodeId: string | null }
  | { kind: 'node'; nodeId: string; x: number; y: number; boardRect: DOMRect };

type BoardSize = { width: number; height: number };

const CENTER_RADIUS = 82;
const NODE_RADIUS = 68;

const styleIngredients: LabIngredient[] = [
  { id: 'genre', label: '장르', type: 'style' },
  { id: 'style', label: '스타일', type: 'style' },
  { id: 'sound', label: '사운드', type: 'style' },
  { id: 'mood', label: '분위기', type: 'style' },
  { id: 'theme', label: '주제', type: 'style' },
  { id: 'vocal', label: '보컬', type: 'style' },
  { id: 'tempo', label: '템포', type: 'style' },
  { id: 'structure', label: '곡 구조', type: 'style' },
  { id: 'director', label: '직접입력', type: 'style' },
];

const lyricsIngredients: LabIngredient[] = [
  { id: 'speaker', label: '화자', type: 'lyrics' },
  { id: 'scene', label: '장면', type: 'lyrics' },
  { id: 'desire', label: '욕망', type: 'lyrics' },
  { id: 'flaw', label: '결함', type: 'lyrics' },
  { id: 'tone', label: '말투', type: 'lyrics' },
  { id: 'hook', label: '반복 훅', type: 'lyrics' },
  { id: 'density', label: '밀도', type: 'lyrics' },
  { id: 'vocalSplit', label: '보컬 분리', type: 'lyrics' },
  { id: 'englishPoint', label: '영어 포인트', type: 'lyrics' },
];

const initialStyleNodes: MapNode[] = [
  { id: 'genreLine', label: 'Genre', max: 3, items: ['장르'], x: 24, y: 30 },
  { id: 'soundLine', label: 'Sound', max: 4, items: ['사운드'], x: 78, y: 28 },
  { id: 'moodLine', label: 'Mood', max: 4, items: ['분위기', '주제'], x: 18, y: 66 },
  { id: 'vocalsLine', label: 'Vocals', max: 3, items: ['보컬'], x: 80, y: 68 },
  { id: 'productionLine', label: 'Production', max: 4, items: ['템포', '곡 구조'], x: 50, y: 82 },
];

const initialLyricsNodes: MapNode[] = [
  { id: 'verse', label: 'Verse', max: 4, items: ['장면', '화자'], x: 22, y: 28 },
  { id: 'preChorus', label: 'Pre-Chorus', max: 3, items: ['욕망'], x: 78, y: 28 },
  { id: 'chorus', label: 'Chorus', max: 4, items: ['반복 훅', '말투'], x: 78, y: 66 },
  { id: 'bridge', label: 'Bridge', max: 3, items: ['결함'], x: 22, y: 66 },
  { id: 'outro', label: 'Outro', max: 3, items: ['밀도'], x: 50, y: 84 },
];

function getTone(mode: LabMode) {
  return mode === 'lyrics'
    ? {
        coreA: '#5EF2D6',
        coreB: '#FF7AAE',
        nodeA: '#5EF2D6',
        nodeB: '#A7F7FF',
        text: '#EFFFFB',
        bg: 'rgba(7, 17, 20, 0.74)',
      }
    : {
        coreA: '#FFD66B',
        coreB: '#FF6FAE',
        nodeA: '#FFD66B',
        nodeB: '#FF7AAE',
        text: '#FFF6EA',
        bg: 'rgba(18, 13, 17, 0.74)',
      };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function IngredientChip({ ingredient, onStartDrag }: { ingredient: LabIngredient; onStartDrag: (ingredient: LabIngredient, event: PointerEvent<HTMLDivElement>) => void }) {
  const tone = getTone(ingredient.type === 'lyrics' ? 'lyrics' : 'style');

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => onStartDrag(ingredient, event)}
      className="inline-flex cursor-grab select-none items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5"
      style={{
        color: tone.text,
        WebkitUserDrag: 'none',
        background: `linear-gradient(135deg, ${tone.coreA}18, ${tone.coreB}18), rgba(255,255,255,0.055)`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 24px ${tone.coreB}12`,
      }}
    >
      <Grip className="h-3.5 w-3.5 text-white/26" />
      <span draggable={false}>{ingredient.label}</span>
    </div>
  );
}

function PlacedChip({ label, mode, onRemove }: { label: string; mode: LabMode; onRemove: () => void }) {
  const tone = getTone(mode);
  return (
    <button
      type="button"
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onRemove}
      className="select-none rounded-full px-2.5 py-1 text-[10px] font-black transition-all hover:-translate-y-0.5"
      style={{
        color: tone.text,
        background: `linear-gradient(135deg, ${tone.coreA}24, ${tone.coreB}2B), rgba(0,0,0,0.18)`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.055)',
      }}
    >
      {label}
    </button>
  );
}

function ConnectorLines({ nodes, mode, boardSize }: { nodes: MapNode[]; mode: LabMode; boardSize: BoardSize }) {
  const tone = getTone(mode);
  const width = Math.max(boardSize.width, 1);
  const height = Math.max(boardSize.height, 1);
  const cx = width / 2;
  const cy = height / 2;

  const line = (node: MapNode) => {
    const nx = (node.x / 100) * width;
    const ny = (node.y / 100) * height;
    const dx = nx - cx;
    const dy = ny - cy;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const startX = cx + ux * CENTER_RADIUS;
    const startY = cy + uy * CENTER_RADIUS;
    const endX = nx - ux * NODE_RADIUS;
    const endY = ny - uy * NODE_RADIUS;
    const curve = Math.min(distance * 0.25, 132);
    const c1X = startX + ux * curve;
    const c1Y = startY + uy * curve;
    const c2X = endX - ux * curve;
    const c2Y = endY - uy * curve;
    return `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
  };

  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`lab-line-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={tone.coreA} />
          <stop offset="100%" stopColor={tone.coreB} />
        </linearGradient>
      </defs>
      {nodes.map((node) => (
        <path
          key={node.id}
          d={line(node)}
          fill="none"
          stroke={`url(#lab-line-${mode})`}
          strokeWidth={node.items.length ? 3.2 : 2.1}
          strokeLinecap="round"
          opacity={node.items.length ? 0.72 : 0.28}
        />
      ))}
    </svg>
  );
}

function MapNodeView({ node, mode, active, moving, onRemoveItem, onStartMove }: {
  node: MapNode;
  mode: LabMode;
  active: boolean;
  moving: boolean;
  onRemoveItem: (nodeId: string, label: string) => void;
  onStartMove: (nodeId: string, event: PointerEvent<HTMLDivElement>) => void;
}) {
  const tone = getTone(mode);
  const percent = Math.min(100, Math.round((node.items.length / Math.max(node.max, 1)) * 100));
  const isComplete = node.items.length >= node.max;
  const glow = 0.08 + percent / 170;

  return (
    <div
      data-lab-node-id={node.id}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => onStartMove(node.id, event)}
      className="absolute z-30 flex h-[136px] w-[136px] -translate-x-1/2 -translate-y-1/2 cursor-move select-none flex-col items-center justify-center overflow-hidden rounded-full p-3 text-center shadow-2xl transition-[box-shadow,filter,transform] duration-300"
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
        WebkitUserDrag: 'none',
        background: `linear-gradient(135deg, ${tone.coreA}${Math.round(glow * 255).toString(16).padStart(2, '0')}, ${tone.coreB}${Math.round((glow + 0.06) * 255).toString(16).padStart(2, '0')}), rgba(18,18,22,0.92)`,
        filter: `brightness(${1 + percent / 240})`,
        animation: isComplete ? 'labNodeHeartbeat 1.35s ease-in-out infinite' : undefined,
        boxShadow: active || moving
          ? `0 0 0 2px ${tone.coreA}AA, 0 0 60px ${tone.coreB}55, 0 20px 70px rgba(0,0,0,0.48)`
          : `0 0 0 1px rgba(255,255,255,0.06), 0 0 ${18 + percent * 0.46}px ${tone.coreB}25, 0 18px 54px rgba(0,0,0,0.44)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full opacity-70" style={{ background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.18), transparent 34%), radial-gradient(circle at 50% 55%, ${tone.coreA}${Math.round((0.04 + percent / 360) * 255).toString(16).padStart(2, '0')}, transparent 62%)` }} />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="text-sm font-black text-white">{node.label}</span>
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-black text-white/50">{node.items.length}/{node.max}</span>
        <div className="flex max-h-[44px] max-w-[112px] flex-wrap justify-center gap-1 overflow-hidden">
          {node.items.map((item) => (
            <PlacedChip key={item} label={item} mode={mode} onRemove={() => onRemoveItem(node.id, item)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LabWorkspace({ mode }: { mode: LabMode }) {
  const [nodes, setNodes] = useState<MapNode[]>(mode === 'lyrics' ? initialLyricsNodes : initialStyleNodes);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<BoardSize>({ width: 1280, height: 760 });

  const tone = getTone(mode);
  const ingredients = useMemo(() => (mode === 'lyrics' ? lyricsIngredients : styleIngredients), [mode]);
  const centerLabel = mode === 'lyrics' ? 'LYRICS' : 'STYLE';
  const title = mode === 'lyrics' ? '가사 마인드맵' : '스타일 마인드맵';

  const syncDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragging(next);
  };

  useEffect(() => {
    setNodes(mode === 'lyrics' ? initialLyricsNodes : initialStyleNodes);
  }, [mode]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const update = () => setBoardSize({ width: board.clientWidth, height: board.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const addItem = (nodeId: string, ingredient: LabIngredient) => {
    setNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.items.includes(ingredient.label) || node.items.length >= node.max) return node;
      return { ...node, items: [...node.items, ingredient.label] };
    }));
  };

  const removeItem = (nodeId: string, label: string) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, items: node.items.filter((item) => item !== label) } : node));
  };

  const handleStartIngredientDrag = (ingredient: LabIngredient, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    syncDrag({ kind: 'ingredient', ingredient, x: event.clientX, y: event.clientY, overNodeId: null });
  };

  const handleStartNodeMove = (nodeId: string, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    const board = boardRef.current;
    if (!board) return;
    event.preventDefault();
    syncDrag({ kind: 'node', nodeId, x: event.clientX, y: event.clientY, boardRect: board.getBoundingClientRect() });
  };

  useEffect(() => {
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    const getDropTarget = (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const nodeElement = element?.closest('[data-lab-node-id]') as HTMLElement | null;
      return nodeElement?.dataset.labNodeId ?? null;
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      event.preventDefault();

      if (current.kind === 'ingredient') {
        syncDrag({ ...current, x: event.clientX, y: event.clientY, overNodeId: getDropTarget(event.clientX, event.clientY) });
        return;
      }

      const radiusX = (NODE_RADIUS / current.boardRect.width) * 100;
      const radiusY = (NODE_RADIUS / current.boardRect.height) * 100;
      const nextX = clamp(((event.clientX - current.boardRect.left) / current.boardRect.width) * 100, radiusX, 100 - radiusX);
      const nextY = clamp(((event.clientY - current.boardRect.top) / current.boardRect.height) * 100, radiusY, 100 - radiusY);
      setNodes((currentNodes) => currentNodes.map((node) => node.id === current.nodeId ? { ...node, x: nextX, y: nextY } : node));
      syncDrag({ ...current, x: event.clientX, y: event.clientY });
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      event.preventDefault();
      if (current.kind === 'ingredient') {
        const nodeId = getDropTarget(event.clientX, event.clientY);
        if (nodeId) addItem(nodeId, current.ingredient);
      }
      syncDrag(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') syncDrag(null);
    };

    const blockContextMenu = (event: MouseEvent) => event.preventDefault();

    document.body.style.userSelect = dragging ? 'none' : previousUserSelect;
    document.body.style.cursor = dragging?.kind === 'ingredient' ? 'grabbing' : dragging?.kind === 'node' ? 'move' : previousCursor;

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

  const activeNodeId = dragging?.kind === 'ingredient' ? dragging.overNodeId : null;
  const movingNodeId = dragging?.kind === 'node' ? dragging.nodeId : null;

  return (
    <div className="select-none" onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
      <style>{`
        @keyframes labNodeHeartbeat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          42% { transform: translate(-50%, -50%) scale(1.026); }
          62% { transform: translate(-50%, -50%) scale(0.996); }
          78% { transform: translate(-50%, -50%) scale(1.012); }
        }
        [data-lab-node-id], [role='button'] {
          -webkit-user-drag: none;
          user-select: none;
        }
      `}</style>

      <section className="relative overflow-hidden rounded-[2.2rem] bg-[#090B10] shadow-2xl" style={{ minHeight: '760px' }}>
        <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.34) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${tone.coreA}14, transparent 28%), radial-gradient(circle at 72% 30%, ${tone.coreB}13, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.035), transparent 48%)` }} />

        <div className="relative z-20 flex items-center justify-between px-6 pt-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: tone.coreA }}>{mode === 'lyrics' ? 'LYRIC MAP' : 'STYLE MAP'}</p>
            <h2 className="mt-1 text-2xl font-black text-white">{title}</h2>
          </div>
          <div className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-white/48">입구만 준비됨</div>
        </div>

        <div ref={boardRef} className="relative z-10 mx-auto h-[620px] w-full max-w-[1320px]">
          <ConnectorLines nodes={nodes} mode={mode} boardSize={boardSize} />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 flex h-[164px] w-[164px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl font-black text-white shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${tone.coreA}, ${tone.coreB})`,
              boxShadow: `0 0 0 8px rgba(255,255,255,0.045), 0 0 70px ${tone.coreA}38, 0 0 110px ${tone.coreB}24`,
            }}
          >
            {centerLabel}
          </div>
          {nodes.map((node) => (
            <MapNodeView
              key={node.id}
              node={node}
              mode={mode}
              active={activeNodeId === node.id}
              moving={movingNodeId === node.id}
              onRemoveItem={removeItem}
              onStartMove={handleStartNodeMove}
            />
          ))}
        </div>

        <div className="relative z-30 mx-auto mb-6 max-w-[1180px] rounded-[1.7rem] bg-black/28 p-4 shadow-xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-black text-white/86">
            <Network className="h-4 w-4" style={{ color: tone.coreA }} /> 재료
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {ingredients.map((ingredient) => (
              <IngredientChip key={ingredient.id} ingredient={ingredient} onStartDrag={handleStartIngredientDrag} />
            ))}
          </div>
        </div>
      </section>

      {dragging?.kind === 'ingredient' && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-xs font-black shadow-2xl"
          style={{
            left: dragging.x,
            top: dragging.y,
            background: `linear-gradient(135deg, ${tone.coreA}33, ${tone.coreB}44), rgba(16,16,20,0.96)`,
            color: tone.text,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 18px 45px rgba(0,0,0,0.34)`,
          }}
        >
          {dragging.ingredient.label}
        </div>
      )}
    </div>
  );
}
