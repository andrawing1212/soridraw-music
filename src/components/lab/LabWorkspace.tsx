import React, { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Grip, Move, Network, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

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

type CanvasNode = MapNode & {
  x: number;
  y: number;
};

type MaterialNodeKind = 'middle' | 'styleDetail';

type MaterialNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: MaterialNodeKind;
  parentId?: string;
  parentBigNodeId?: string;
  connected?: boolean;
  detached?: boolean;
};

type CanvasConnection = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
};

type HierarchyConnection = {
  id: string;
  fromKind: 'big' | 'middle';
  fromId: string;
  toId: string;
};

type CanvasPoint = { x: number; y: number };

type BoardSize = { width: number; height: number };
type ViewportTransform = { x: number; y: number; scale: number };

type DragState =
  | {
      kind: 'ingredient';
      ingredient: LabIngredient;
      x: number;
      y: number;
      overNodeId: string | null;
      offsetX: number;
      offsetY: number;
      width: number;
      height: number;
    }
  | { kind: 'node'; nodeId: string; x: number; y: number; boardRect: DOMRect }
  | { kind: 'canvasNode'; nodeId: string; offsetX: number; offsetY: number; startClientX: number; startClientY: number; moved: boolean }
  | { kind: 'materialNode'; materialId: string; offsetX: number; offsetY: number; startClientX: number; startClientY: number; moved: boolean; x?: number; y?: number }
  | { kind: 'connection'; fromNodeId: string; pointerX: number; pointerY: number; overNodeId: string | null; overMaterialId: string | null }
  | { kind: 'materialConnection'; fromMaterialId: string; pointerX: number; pointerY: number; overMaterialId: string | null }
  | { kind: 'pan'; startX: number; startY: number; originX: number; originY: number };

const CENTER_NODE_SIZE = 164;
const MAP_NODE_SIZE = 136;
const NODE_MOVE_PADDING = 74;
const STYLE_CANVAS_WIDTH = 3200;
const STYLE_CANVAS_HEIGHT = 2200;
const STYLE_CENTER = { x: STYLE_CANVAS_WIDTH / 2, y: 1000 };
const STYLE_NODE_SIZE = 138;
const STYLE_CENTER_SIZE = 174;
const STYLE_MATERIAL_NODE_SIZE = 82;
const STYLE_DETAIL_NODE_SIZE = 58;
const STYLE_LINE_WIDTH = 1.25;
const MIDDLE_ORBIT_RADIUS = 188;
const SMALL_ORBIT_RADIUS = 112;
const SMALL_DEFAULT_VISIBLE_COUNT = 4;
const MIDDLE_ORBIT_START_ANGLE = -Math.PI / 2 + Math.PI / 8;
const SMALL_ORBIT_START_ANGLE = -Math.PI / 2 + Math.PI / 5;
const STYLE_INITIAL_VIEW_CENTER = { x: 1600, y: 1000 };
const STYLE_INITIAL_VIEW_WIDTH = 1850;
const STYLE_INITIAL_VIEW_HEIGHT = 1540;

const styleIngredients: LabIngredient[] = [
  { id: 'genre', label: '장르', type: 'style' },
  { id: 'style', label: '스타일', type: 'style' },
  { id: 'sound', label: '사운드', type: 'style' },
  { id: 'mood', label: '분위기', type: 'style' },
  { id: 'theme', label: '주제', type: 'style' },
  { id: 'vocal', label: '보컬', type: 'style' },
  { id: 'tempo', label: '템포', type: 'style' },
  { id: 'structure', label: '곡 구조', type: 'style' },
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

const initialStyleNodes: CanvasNode[] = [
  { id: 'genreLine', label: 'Genre', max: 3, items: [], x: 1764, y: 506 },
  { id: 'soundLine', label: 'Sound', max: 4, items: [], x: 2142, y: 981 },
  { id: 'vocalsLine', label: 'Vocals', max: 3, items: [], x: 1720, y: 1420 },
  { id: 'productionLine', label: 'Production', max: 4, items: [], x: 1087, y: 1268 },
  { id: 'moodLine', label: 'Mood', max: 4, items: [], x: 1013, y: 721 },
];


const initialStyleMaterialNodes: MaterialNode[] = [
  { id: 'material-tempo', label: '템포', x: 1680, y: 610, kind: 'middle' },
  { id: 'material-genre', label: '장르', x: 850, y: 840, kind: 'middle' },
  { id: 'material-sound', label: '사운드', x: 2235, y: 840, kind: 'middle' },
  { id: 'material-mood', label: '분위기', x: 690, y: 1135, kind: 'middle' },
  { id: 'material-style', label: '스타일', x: 2290, y: 1135, kind: 'middle' },
  { id: 'material-theme', label: '주제', x: 840, y: 1450, kind: 'middle' },
  { id: 'material-vocal', label: '보컬', x: 2085, y: 1490, kind: 'middle' },
  { id: 'material-structure', label: '곡 구조', x: 1680, y: 1515, kind: 'middle' },
  { id: 'style-detail-hybrid', label: '하이브리드', x: 1040, y: 1655, kind: 'styleDetail' },
  { id: 'style-detail-vocal-line', label: '보컬 라인', x: 1190, y: 1735, kind: 'styleDetail' },
  { id: 'style-detail-special-effect', label: '특수 효과', x: 1340, y: 1655, kind: 'styleDetail' },
  { id: 'style-detail-era-texture', label: '시대 질감', x: 1490, y: 1735, kind: 'styleDetail' },
  { id: 'style-detail-transition', label: '전환 연출', x: 1640, y: 1655, kind: 'styleDetail' },
  { id: 'style-detail-space-texture', label: '공간 질감', x: 1790, y: 1735, kind: 'styleDetail' },
  { id: 'style-detail-narrative', label: '서사 연출', x: 1940, y: 1655, kind: 'styleDetail' },
  { id: 'style-detail-chorus-line', label: '후렴 라인', x: 2090, y: 1735, kind: 'styleDetail' },
  { id: 'style-detail-rhythm', label: '리듬감', x: 2240, y: 1655, kind: 'styleDetail' },
];

const styleMiddleMenuNodes = [
  { id: 'middle-genre', label: '장르' },
  { id: 'middle-tempo', label: '템포' },
  { id: 'middle-sound', label: '사운드' },
  { id: 'middle-structure', label: '곡 구조' },
  { id: 'middle-style', label: '스타일' },
  { id: 'middle-mood', label: '분위기' },
  { id: 'middle-theme', label: '주제' },
  { id: 'middle-vocal', label: '보컬' },
];

const styleSmallDetailNodesByMiddle = {
  genre: [
    { id: 'small-main-genre', label: '메인 장르' },
    { id: 'small-sub-genre', label: '세부 장르' },
    { id: 'small-fusion-genre', label: '퓨전 장르' },
    { id: 'small-era-genre', label: '시대 장르' },
    { id: 'small-region-color', label: '지역 색' },
    { id: 'small-genre-strength', label: '장르 강도' },
  ],
  sound: [
    { id: 'small-instrument', label: '악기' },
    { id: 'small-drums', label: '드럼' },
    { id: 'small-bass', label: '베이스' },
    { id: 'small-synth', label: '신스' },
    { id: 'small-space-texture', label: '공간 질감' },
    { id: 'small-special-effect', label: '특수 효과' },
    { id: 'small-era-texture', label: '시대 질감' },
    { id: 'small-mix-tone', label: '믹스톤' },
  ],
  mood: [
    { id: 'small-emotion', label: '감정' },
    { id: 'small-temperature', label: '온도' },
    { id: 'small-time', label: '시간대' },
    { id: 'small-season', label: '계절감' },
    { id: 'small-space', label: '공간감' },
    { id: 'small-tension', label: '긴장감' },
    { id: 'small-energy', label: '에너지' },
    { id: 'small-tone', label: '톤' },
  ],
  theme: [
    { id: 'small-theme-target', label: '대상' },
    { id: 'small-theme-emotion', label: '감정' },
    { id: 'small-theme-relationship', label: '관계' },
    { id: 'small-theme-place', label: '장소' },
    { id: 'small-theme-material', label: '소재' },
    { id: 'small-theme-situation', label: '상황' },
    { id: 'small-theme-time', label: '시간' },
    { id: 'small-theme-story', label: '스토리' },
  ],
  vocal: [
    { id: 'small-gender', label: '성별' },
    { id: 'small-count', label: '인원' },
    { id: 'small-role', label: '역할' },
    { id: 'small-range', label: '음역' },
    { id: 'small-vocalization', label: '발성' },
    { id: 'small-diction', label: '딕션' },
    { id: 'small-expression', label: '감정표현' },
    { id: 'small-harmony', label: '화음' },
  ],
  tempo: [
    { id: 'small-bpm', label: 'BPM' },
    { id: 'small-speed', label: '속도감' },
    { id: 'small-groove', label: '그루브' },
    { id: 'small-rhythm', label: '리듬감' },
    { id: 'small-free-time', label: '자유박자' },
    { id: 'small-off-beat', label: '박자이탈' },
    { id: 'small-rush', label: '성급함' },
  ],
  structure: [
    { id: 'small-intro', label: 'Intro' },
    { id: 'small-verse', label: 'Verse' },
    { id: 'small-chorus', label: 'Chorus' },
    { id: 'small-bridge', label: 'Bridge' },
    { id: 'small-outro', label: 'Outro' },
    { id: 'small-hook', label: 'Hook' },
    { id: 'small-drop', label: 'Drop' },
    { id: 'small-final', label: 'Final' },
  ],
  style: [
    { id: 'small-hybrid', label: '하이브리드' },
    { id: 'small-vocal-line', label: '보컬 라인' },
    { id: 'small-chorus-line', label: '후렴 라인' },
    { id: 'small-transition', label: '전환 연출' },
    { id: 'small-narrative', label: '서사 연출' },
    { id: 'small-space-texture', label: '공간 질감' },
    { id: 'small-era-texture', label: '시대 질감' },
    { id: 'small-special-effect', label: '특수 효과' },
  ],
} satisfies Record<string, { id: string; label: string }[]>;

const defaultStyleSmallDetailNodes = styleSmallDetailNodesByMiddle.style;

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

function getMaterialNodeSize(material: MaterialNode) {
  return material.kind === 'styleDetail' ? STYLE_DETAIL_NODE_SIZE : STYLE_MATERIAL_NODE_SIZE;
}

function getMaterialNodeTone(material: MaterialNode) {
  return material.kind === 'styleDetail'
    ? {
        coreA: '#FFD66B',
        coreB: '#FF9C5E',
        glow: '#FFD66B',
        bg: 'rgba(18, 12, 9, 0.96)',
        text: '#FFF5DB',
      }
    : {
        coreA: '#FF8B83',
        coreB: '#C85F86',
        glow: '#FF7AAE',
        bg: 'rgba(15, 12, 16, 0.97)',
        text: '#FFF1F5',
      };
}


function getConnectionGlow(level: number) {
  const safeLevel = Math.min(16, Math.max(0, Math.round(level)));
  return {
    level: safeLevel,
    percent: safeLevel / 16,
  };
}

function getStyleNodeLineTone(index: number) {
  const tones = [
    ['#FFD66B', '#FF7AAE'],
    ['#FF9C5E', '#FF6FAE'],
    ['#F8C66A', '#B76DFF'],
    ['#FF7AAE', '#8BE4FF'],
    ['#F8A75E', '#FF85B6'],
  ];
  return tones[index % tones.length];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCircleEdgePoint(from: CanvasPoint, to: CanvasPoint, radius: number): CanvasPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return {
    x: from.x + (dx / distance) * radius,
    y: from.y + (dy / distance) * radius,
  };
}

function getSoftLinePath(start: CanvasPoint, end: CanvasPoint) {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function getVisibleStraightLinePath(from: CanvasPoint, to: CanvasPoint, fromRadius: number, toRadius: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const visiblePadding = -6;
  const safeFromRadius = Math.max(0, Math.min(fromRadius + visiblePadding, distance / 2 - 2));
  const safeToRadius = Math.max(0, Math.min(toRadius + visiblePadding, distance / 2 - 2));
  const start = {
    x: from.x + (dx / distance) * safeFromRadius,
    y: from.y + (dy / distance) * safeFromRadius,
  };
  const end = {
    x: to.x - (dx / distance) * safeToRadius,
    y: to.y - (dy / distance) * safeToRadius,
  };
  return getSoftLinePath(start, end);
}

function getCanvasDistance(a: CanvasPoint, b: CanvasPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCircularChildren<T extends { id: string; label: string }>(
  items: T[],
  center: CanvasPoint,
  radius: number,
  startAngle: number,
  kind: MaterialNodeKind,
  parentId: string,
  parentBigNodeId: string,
): MaterialNode[] {
  const step = (Math.PI * 2) / Math.max(items.length, 1);
  return items.map((item, index) => {
    const angle = startAngle + step * index;
    return {
      id: `${parentId}-${item.id}`,
      label: item.label,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      kind,
      parentId,
      parentBigNodeId,
    };
  });
}

function getMiddleMenuKey(material: Pick<MaterialNode, 'id' | 'label'> | { id: string; label: string }) {
  const id = material.id;
  if (id.includes('middle-genre') || material.label === '장르') return 'genre';
  if (id.includes('middle-sound') || material.label === '사운드') return 'sound';
  if (id.includes('middle-mood') || material.label === '분위기') return 'mood';
  if (id.includes('middle-theme') || material.label === '주제') return 'theme';
  if (id.includes('middle-vocal') || material.label === '보컬') return 'vocal';
  if (id.includes('middle-tempo') || material.label === '템포') return 'tempo';
  if (id.includes('middle-structure') || material.label === '곡 구조') return 'structure';
  if (id.includes('middle-style') || material.label === '스타일') return 'style';
  return 'style';
}

function getStyleSmallDetailNodesForMiddle(material: Pick<MaterialNode, 'id' | 'label'> | { id: string; label: string }) {
  const key = getMiddleMenuKey(material);
  return styleSmallDetailNodesByMiddle[key] ?? defaultStyleSmallDetailNodes;
}

function getDisplayStyleSmallDetailNodesForMiddle(material: Pick<MaterialNode, 'id' | 'label'> | { id: string; label: string }, expanded: boolean) {
  const items = getStyleSmallDetailNodesForMiddle(material);
  if (items.length <= SMALL_DEFAULT_VISIBLE_COUNT) return items;
  if (expanded) return [...items, { id: 'small-detail-less-toggle', label: '간단히' }];
  return [...items.slice(0, SMALL_DEFAULT_VISIBLE_COUNT), { id: 'small-detail-more-toggle', label: '+ 더보기' }];
}

function isSmallDetailMenuToggleNode(material: Pick<MaterialNode, 'id' | 'label'> | { id: string; label: string }) {
  return material.id.includes('small-detail-more-toggle') || material.id.includes('small-detail-less-toggle');
}

function getMiddleOrbitNode(parentNode: CanvasNode, materialId: string): MaterialNode | null {
  return getCircularChildren(
    styleMiddleMenuNodes,
    parentNode,
    MIDDLE_ORBIT_RADIUS,
    MIDDLE_ORBIT_START_ANGLE,
    'middle',
    parentNode.id,
    parentNode.id,
  ).find((material) => material.id === materialId) ?? null;
}

function getSmallOrbitNode(parentMaterial: MaterialNode, materialId: string, expanded = false): MaterialNode | null {
  return getCircularChildren(
    getDisplayStyleSmallDetailNodesForMiddle(parentMaterial, expanded),
    parentMaterial,
    SMALL_ORBIT_RADIUS,
    SMALL_ORBIT_START_ANGLE,
    'styleDetail',
    parentMaterial.id,
    parentMaterial.parentBigNodeId ?? parentMaterial.parentId ?? '',
  ).find((material) => material.id === materialId) ?? null;
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
    const curve = Math.min(distance * 0.22, 118);
    const c1X = cx + ux * curve;
    const c1Y = cy + uy * curve;
    const c2X = nx - ux * curve;
    const c2Y = ny - uy * curve;
    return `M ${cx} ${cy} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${nx} ${ny}`;
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
          strokeWidth={node.items.length ? 2.8 : 2.1}
          strokeLinecap="round"
          opacity={node.items.length ? 0.54 : 0.24}
        />
      ))}
    </svg>
  );
}

function CanvasConnectorLines({ nodes }: { nodes: CanvasNode[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 z-20" width={STYLE_CANVAS_WIDTH} height={STYLE_CANVAS_HEIGHT} viewBox={`0 0 ${STYLE_CANVAS_WIDTH} ${STYLE_CANVAS_HEIGHT}`}>
      <defs>
        {nodes.map((node, index) => {
          const [start, end] = getStyleNodeLineTone(index);
          return (
            <linearGradient key={node.id} id={`style-canvas-line-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={start} />
              <stop offset="100%" stopColor={end} />
            </linearGradient>
          );
        })}
      </defs>
      {nodes.map((node, index) => {
        const d = getVisibleStraightLinePath(STYLE_CENTER, node, STYLE_CENTER_SIZE / 2, STYLE_NODE_SIZE / 2);
        return (
          <path
            key={node.id}
            className="lab-line-visual"
            d={d}
            fill="none"
            stroke={`url(#style-canvas-line-${node.id})`}
            strokeWidth={STYLE_LINE_WIDTH}
            strokeLinecap="round"
            opacity={node.items.length ? 0.54 : 0.38}
          />
        );
      })}
    </svg>
  );
}


function CanvasRelationLines({ nodes, materials, connections, draft, selectedConnectionId, onSelectConnection }: { nodes: CanvasNode[]; materials: MaterialNode[]; connections: CanvasConnection[]; draft: Extract<DragState, { kind: 'connection' }> | null; selectedConnectionId: string | null; onSelectConnection: (connectionId: string) => void }) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);

  const getNodeLine = (from: CanvasNode, toPoint: CanvasPoint, targetRadius = STYLE_NODE_SIZE / 2) => {
    return getVisibleStraightLinePath(from, toPoint, STYLE_NODE_SIZE / 2, targetRadius);
  };

  return (
    <svg className="pointer-events-none absolute inset-0 z-20" width={STYLE_CANVAS_WIDTH} height={STYLE_CANVAS_HEIGHT} viewBox={`0 0 ${STYLE_CANVAS_WIDTH} ${STYLE_CANVAS_HEIGHT}`}>
      <defs>
        <linearGradient id="style-relation-line" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD66B" />
          <stop offset="100%" stopColor="#FF72B6" />
        </linearGradient>
      </defs>

      {connections.map((connection) => {
        const from = nodeMap.get(connection.fromNodeId);
        const to = nodeMap.get(connection.toNodeId);
        if (!from || !to) return null;
        const d = getNodeLine(from, to);
        const selected = selectedConnectionId === connection.id;
        return (
          <g key={connection.id} className="lab-line-group">
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              strokeLinecap="round"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectConnection(connection.id);
              }}
            />
            <path
              className="lab-line-visual"
              d={d}
              fill="none"
              stroke={selected ? '#FFF0A0' : 'url(#style-relation-line)'}
              strokeWidth={STYLE_LINE_WIDTH}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
              opacity={selected ? 0.98 : 0.72}
            />
          </g>
        );
      })}

      {draft && (() => {
        const from = nodeMap.get(draft.fromNodeId);
        if (!from) return null;
        const targetMaterial = draft.overMaterialId ? materialMap.get(draft.overMaterialId) : null;
        const targetNode = !targetMaterial && draft.overNodeId ? nodeMap.get(draft.overNodeId) : null;
        const pointer = targetMaterial ?? targetNode ?? { x: draft.pointerX, y: draft.pointerY };
        const targetRadius = targetMaterial ? getMaterialNodeSize(targetMaterial) / 2 : targetNode ? STYLE_NODE_SIZE / 2 : 0;
        const d = getNodeLine(from, pointer, targetRadius);
        return (
          <path d={d} fill="none" stroke="url(#style-relation-line)" strokeWidth={STYLE_LINE_WIDTH} strokeLinecap="round" vectorEffect="non-scaling-stroke" shapeRendering="geometricPrecision" opacity={(targetMaterial || targetNode) ? 0.95 : 0.72} />
        );
      })()}
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
  return (
    <div
      data-lab-node-id={node.id}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => onStartMove(node.id, event)}
      className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 cursor-move select-none flex-col items-center justify-center overflow-hidden rounded-full p-3 text-center shadow-2xl transition-[box-shadow,filter,transform] duration-300"
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: MAP_NODE_SIZE,
        height: MAP_NODE_SIZE,
        WebkitUserDrag: 'none',
        background: `linear-gradient(135deg, ${tone.coreA}${Math.round((0.055 + percent / 520) * 255).toString(16).padStart(2, '0')}, ${tone.coreB}${Math.round((0.075 + percent / 430) * 255).toString(16).padStart(2, '0')}), rgba(18,18,22,0.98)`,
        filter: `brightness(${1 + percent / 330}) saturate(${1 + percent / 420})`,
        boxShadow: active || moving
          ? `0 0 0 2px ${tone.coreA}B8, 0 0 54px ${tone.coreB}4A, 0 20px 68px rgba(0,0,0,0.5)`
          : `0 0 0 1px rgba(255,255,255,0.07), 0 0 ${14 + percent * 0.28}px ${tone.coreB}1F, 0 18px 52px rgba(0,0,0,0.44)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          opacity: 0.18 + percent / 190,
          background: `linear-gradient(135deg, rgba(255,255,255,0.18), transparent 42%), linear-gradient(180deg, ${tone.coreA}16, ${tone.coreB}12)`,
        }}
      />
      {isComplete && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-full"
          style={{
            animation: 'labNodeGlowPulse 1.65s ease-in-out infinite',
            background: `linear-gradient(135deg, ${tone.coreA}36, ${tone.coreB}42)`,
            boxShadow: `0 0 34px ${tone.coreA}28, 0 0 58px ${tone.coreB}24`,
          }}
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="text-sm font-black text-white">{node.label}</span>
      </div>
    </div>
  );
}

function CanvasNodeView({ node, active, moving, connecting, connectionCount, onRemoveItem, onStartMove }: {
  node: CanvasNode;
  active: boolean;
  moving: boolean;
  connecting: boolean;
  connectionCount: number;
  onRemoveItem: (nodeId: string, label: string) => void;
  onStartMove: (nodeId: string, event: PointerEvent<HTMLDivElement>) => void;
}) {
  const tone = getTone('style');
  const percent = Math.min(100, Math.round((node.items.length / Math.max(node.max, 1)) * 100));
  const connectionGlow = getConnectionGlow(connectionCount);
  const glowPercent = connectionGlow.percent;
  const isComplete = node.items.length >= node.max;
  return (
    <div
      data-lab-node-id={node.id}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('button')) return;
        onStartMove(node.id, event);
      }}
      className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 cursor-move select-none flex-col items-center justify-center overflow-hidden rounded-full p-3 text-center shadow-2xl transition-[box-shadow,filter] duration-300"
      style={{
        left: node.x,
        top: node.y,
        width: STYLE_NODE_SIZE,
        height: STYLE_NODE_SIZE,
        WebkitUserDrag: 'none',
        background: `linear-gradient(135deg, ${tone.coreA}${Math.round((0.055 + percent / 520 + glowPercent * 0.16) * 255).toString(16).padStart(2, '0')}, ${tone.coreB}${Math.round((0.075 + percent / 430 + glowPercent * 0.18) * 255).toString(16).padStart(2, '0')}), rgba(18,18,22,0.98)`,
        filter: `brightness(${1 + percent / 330 + glowPercent * 0.16}) saturate(${1 + percent / 420 + glowPercent * 0.14})`,
        boxShadow: active || moving || connecting
          ? `0 0 0 2px ${tone.coreA}B8, 0 0 54px ${tone.coreB}4A, 0 20px 68px rgba(0,0,0,0.5)`
          : `0 0 0 1px rgba(255,255,255,0.07), 0 0 ${14 + percent * 0.28}px ${tone.coreB}1F, 0 18px 52px rgba(0,0,0,0.44)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          opacity: 0.18 + percent / 190,
          background: `linear-gradient(135deg, rgba(255,255,255,0.18), transparent 42%), linear-gradient(180deg, ${tone.coreA}16, ${tone.coreB}12)`,
        }}
      />
      {connectionCount > 0 && (
        <div
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            animation: 'labConnectionPulse 1.9s ease-in-out infinite',
            background: `linear-gradient(135deg, ${tone.coreA}${Math.round(24 + connectionGlow.level * 12).toString(16).padStart(2, '0')}, ${tone.coreB}${Math.round(28 + connectionGlow.level * 13).toString(16).padStart(2, '0')})`,
            boxShadow: `0 0 ${22 + connectionGlow.level * 6}px ${tone.coreA}24, 0 0 ${34 + connectionGlow.level * 8}px ${tone.coreB}18`,
          }}
        />
      )}
      {connecting && (
        <div
          className="pointer-events-none absolute -inset-3 rounded-full"
          style={{
            background: `radial-gradient(circle, transparent 58%, ${tone.coreA}2E 60%, ${tone.coreB}34 70%, transparent 72%)`,
          }}
        />
      )}
      {isComplete && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-full"
          style={{
            animation: 'labNodeGlowPulse 1.65s ease-in-out infinite',
            background: `linear-gradient(135deg, ${tone.coreA}36, ${tone.coreB}42)`,
            boxShadow: `0 0 34px ${tone.coreA}28, 0 0 58px ${tone.coreB}24`,
          }}
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="text-sm font-black text-white">{node.label}</span>
      </div>
    </div>
  );
}



function CanvasMaterialNodeView({ material, active, connectionCount, onToggle, onStartMove }: {
  material: MaterialNode;
  active: boolean;
  connectionCount: number;
  onToggle: (materialId: string) => void;
  onStartMove: (materialId: string, event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const nodeTone = getMaterialNodeTone(material);
  const size = getMaterialNodeSize(material);
  const isSmall = material.kind === 'styleDetail';
  const isMenuToggle = isSmallDetailMenuToggleNode(material);
  const canMove = !isMenuToggle && material.connected && (material.kind === 'middle' || material.kind === 'styleDetail');
  const connectionGlow = getConnectionGlow(connectionCount);
  const glowPercent = connectionGlow.percent;
  return (
    <button
      type="button"
      data-lab-material-node="true"
      data-lab-material-id={material.id}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onStartMove(material.id, event);
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className="absolute z-[35] flex -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-full text-center font-black shadow-2xl transition-[box-shadow,filter,transform,opacity] duration-200 hover:brightness-110"
      style={{
        left: material.x,
        top: material.y,
        width: size,
        height: size,
        fontSize: isSmall ? 10 : 12,
        cursor: isMenuToggle ? 'pointer' : canMove ? 'move' : 'grab',
        WebkitUserDrag: 'none',
        background: `linear-gradient(135deg, ${nodeTone.coreA}${Math.round((isSmall ? 0.16 : 0.14) * 255 + glowPercent * 42).toString(16).padStart(2, '0')}, ${nodeTone.coreB}${Math.round((isSmall ? 0.19 : 0.18) * 255 + glowPercent * 48).toString(16).padStart(2, '0')}), ${nodeTone.bg}`,
        filter: `brightness(${1 + glowPercent * 0.18}) saturate(${1 + glowPercent * 0.14})`,
        boxShadow: active
          ? `0 0 0 2px ${nodeTone.coreA}C8, 0 0 ${isSmall ? 28 : 42}px ${nodeTone.glow}42, 0 16px 44px rgba(0,0,0,0.48)`
          : material.connected
            ? `0 0 0 1.5px ${nodeTone.coreA}88, 0 0 ${isSmall ? 18 : 28}px ${nodeTone.glow}24, 0 12px 34px rgba(0,0,0,0.42)`
            : `0 0 0 1px rgba(255,255,255,0.07), 0 0 ${isSmall ? 14 : 22}px ${nodeTone.glow}17, 0 12px 34px rgba(0,0,0,0.42)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.14), transparent 44%), radial-gradient(circle at 45% 40%, ${nodeTone.coreA}${isSmall ? '16' : '18'}, transparent 54%)`,
        }}
      />
      {connectionCount > 0 && !isSmall && (
        <div
          className="pointer-events-none absolute -inset-1.5 rounded-full"
          style={{
            animation: 'labConnectionPulse 1.9s ease-in-out infinite',
            background: `linear-gradient(135deg, ${nodeTone.coreA}${Math.round(22 + connectionGlow.level * 12).toString(16).padStart(2, '0')}, ${nodeTone.coreB}${Math.round(25 + connectionGlow.level * 13).toString(16).padStart(2, '0')})`,
            boxShadow: `0 0 ${18 + connectionGlow.level * 5}px ${nodeTone.glow}22`,
          }}
        />
      )}
      <span className="relative z-10 leading-tight" style={{ color: nodeTone.text, maxWidth: isSmall ? 48 : 64 }}>
        {material.label}
      </span>
    </button>
  );
}


function CanvasHierarchyLines({ nodes, materials, connections, draft }: { nodes: CanvasNode[]; materials: MaterialNode[]; connections: HierarchyConnection[]; draft: Extract<DragState, { kind: 'materialConnection' }> | null }) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);

  const getPoint = (kind: 'big' | 'middle', id: string) => {
    if (kind === 'big') return nodeMap.get(id) ?? null;
    return materialMap.get(id) ?? null;
  };

  const getRadius = (kind: 'big' | 'middle' | 'styleDetail', target: CanvasNode | MaterialNode) => {
    if (kind === 'big') return STYLE_NODE_SIZE / 2;
    if ('kind' in target) return getMaterialNodeSize(target) / 2;
    return STYLE_NODE_SIZE / 2;
  };

  const lineFor = (from: CanvasPoint, to: CanvasPoint, fromRadius: number, toRadius: number) => {
    // 계층 연결선은 원 위로 덮지 않고, 부모/자식 원 사이의 빈 공간에만 보이도록 가장자리 기준 직선으로 그린다.
    return getVisibleStraightLinePath(from, to, fromRadius, toRadius);
  };

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 28 }}
      width={STYLE_CANVAS_WIDTH}
      height={STYLE_CANVAS_HEIGHT}
      viewBox={`0 0 ${STYLE_CANVAS_WIDTH} ${STYLE_CANVAS_HEIGHT}`}
    >
      <defs>
        <linearGradient id="style-hierarchy-big-middle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7AAE" />
          <stop offset="100%" stopColor="#FFD66B" />
        </linearGradient>
        <linearGradient id="style-hierarchy-middle-small" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD66B" />
          <stop offset="100%" stopColor="#FF9C5E" />
        </linearGradient>
      </defs>

      {connections.map((connection) => {
        const from = getPoint(connection.fromKind, connection.fromId);
        const to = materialMap.get(connection.toId);
        if (!from || !to) return null;
        const fromRadius = getRadius(connection.fromKind, from);
        const toRadius = getRadius(to.kind, to);
        const d = lineFor(from, to, fromRadius, toRadius);
        const isSmallLink = connection.fromKind === 'middle';
        return (
          <g key={connection.id} className="lab-line-group">

            <path
              className="lab-line-visual"
              d={d}
              fill="none"
              stroke={isSmallLink ? 'url(#style-hierarchy-middle-small)' : 'url(#style-hierarchy-big-middle)'}
              strokeWidth={STYLE_LINE_WIDTH}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
              opacity={0.82}
            />
          </g>
        );
      })}


    </svg>
  );
}

function CanvasMaterialConnectionHandles({ materials, connectingMaterialId, activeTargetMaterialId, hoverPoint, onHoverPoint, onClearHover, onStartConnect }: {
  materials: MaterialNode[];
  connectingMaterialId: string | null;
  activeTargetMaterialId: string | null;
  hoverPoint: { materialId: string; x: number; y: number } | null;
  onHoverPoint: (point: { materialId: string; x: number; y: number }) => void;
  onClearHover: (materialId: string) => void;
  onStartConnect: (materialId: string, event: PointerEvent<SVGCircleElement>) => void;
}) {
  const middleNodes = materials.filter((material) => material.kind === 'middle' && material.connected);

  const getHandlePoint = (material: MaterialNode, event: PointerEvent<SVGCircleElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      return { materialId: material.id, x: material.x, y: material.y - getMaterialNodeSize(material) / 2 - 24 };
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const canvasPoint = point.matrixTransform(matrix.inverse());
    const dx = canvasPoint.x - material.x;
    const dy = canvasPoint.y - material.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const radius = getMaterialNodeSize(material) / 2 + 24;

    return {
      materialId: material.id,
      x: material.x + (dx / distance) * radius,
      y: material.y + (dy / distance) * radius,
    };
  };

  return (
    <svg className="pointer-events-none absolute inset-0 z-[55]" width={STYLE_CANVAS_WIDTH} height={STYLE_CANVAS_HEIGHT} viewBox={`0 0 ${STYLE_CANVAS_WIDTH} ${STYLE_CANVAS_HEIGHT}`}>
      {middleNodes.map((material) => {
        const isHovering = hoverPoint?.materialId === material.id;
        const isSource = connectingMaterialId === material.id;
        const isTarget = activeTargetMaterialId === material.id;
        return (
          <g key={material.id}>
            <circle
              cx={material.x}
              cy={material.y}
              r={getMaterialNodeSize(material) / 2 + 24}
              fill="none"
              stroke="rgba(255,255,255,0.001)"
              strokeWidth={34}
              style={{ pointerEvents: 'stroke', cursor: 'default' }}
              onPointerEnter={(event) => onHoverPoint(getHandlePoint(material, event))}
              onPointerMove={(event) => onHoverPoint(getHandlePoint(material, event))}
              onPointerLeave={() => onClearHover(material.id)}
              onPointerDown={(event) => onStartConnect(material.id, event)}
            />
            {isHovering && !connectingMaterialId && hoverPoint && (
              <g style={{ pointerEvents: 'none' }}>
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={13} fill="rgba(255,214,107,0.09)" />
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={6.5} fill="#FFD66B" opacity={0.76} />
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={2.8} fill="#FFFFFF" opacity={0.68} />
              </g>
            )}
            {(isSource || isTarget) && (
              <circle cx={material.x} cy={material.y} r={getMaterialNodeSize(material) / 2 + 8} fill="none" stroke="#FFD66B" strokeWidth={1.5} opacity={isTarget ? 0.72 : 0.28} style={{ pointerEvents: 'none' }} />
            )}
          </g>
        );
      })}
    </svg>
  );
}


function CanvasConnectionHandles({ nodes, connectingNodeId, activeTargetNodeId, hoverPoint, onHoverPoint, onClearHover, onStartConnect }: {
  nodes: CanvasNode[];
  connectingNodeId: string | null;
  activeTargetNodeId: string | null;
  hoverPoint: { nodeId: string; x: number; y: number } | null;
  onHoverPoint: (point: { nodeId: string; x: number; y: number }) => void;
  onClearHover: (nodeId: string) => void;
  onStartConnect: (nodeId: string, event: PointerEvent<SVGCircleElement>) => void;
}) {
  const getHandlePoint = (node: CanvasNode, event: PointerEvent<SVGCircleElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      return { nodeId: node.id, x: node.x, y: node.y - STYLE_NODE_SIZE / 2 - 31 };
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const canvasPoint = point.matrixTransform(matrix.inverse());
    const dx = canvasPoint.x - node.x;
    const dy = canvasPoint.y - node.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const radius = STYLE_NODE_SIZE / 2 + 31;

    return {
      nodeId: node.id,
      x: node.x + (dx / distance) * radius,
      y: node.y + (dy / distance) * radius,
    };
  };

  return (
    <svg className="pointer-events-none absolute inset-0 z-50" width={STYLE_CANVAS_WIDTH} height={STYLE_CANVAS_HEIGHT} viewBox={`0 0 ${STYLE_CANVAS_WIDTH} ${STYLE_CANVAS_HEIGHT}`}>
      {nodes.map((node) => {
        const isConnectSource = connectingNodeId === node.id;
        const isConnectTarget = activeTargetNodeId === node.id;
        const isHovering = hoverPoint?.nodeId === node.id;
        return (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={STYLE_NODE_SIZE / 2 + 31}
              fill="none"
              stroke="rgba(255,255,255,0.001)"
              strokeWidth={42}
              style={{ pointerEvents: 'stroke', cursor: 'default' }}
              onPointerEnter={(event) => onHoverPoint(getHandlePoint(node, event))}
              onPointerMove={(event) => onHoverPoint(getHandlePoint(node, event))}
              onPointerLeave={() => onClearHover(node.id)}
              onPointerDown={(event) => onStartConnect(node.id, event)}
            />
            {isHovering && !connectingNodeId && hoverPoint && (
              <g style={{ pointerEvents: 'none' }}>
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={16} fill="rgba(255,214,107,0.10)" />
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={8} fill="#FFD66B" opacity={0.82} />
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={3.5} fill="#FFFFFF" opacity={0.72} />
              </g>
            )}
            {(isConnectSource || isConnectTarget) && (
              <circle
                cx={node.x}
                cy={node.y}
                r={STYLE_NODE_SIZE / 2 + 10}
                fill="none"
                stroke={isConnectTarget ? '#FFD66B' : 'rgba(255,255,255,0.22)'}
                strokeWidth={2.2}
                opacity={isConnectTarget ? 0.62 : 0.32}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function StyleCanvasWorkspace() {
  const [nodes, setNodes] = useState<CanvasNode[]>(initialStyleNodes);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [hierarchyConnections, setHierarchyConnections] = useState<HierarchyConnection[]>([]);
  const [connectedMaterials, setConnectedMaterials] = useState<MaterialNode[]>([]);
  const [openBigNodeIds, setOpenBigNodeIds] = useState<string[]>([]);
  const [openMiddleNodeIds, setOpenMiddleNodeIds] = useState<string[]>([]);
  const [expandedSmallMenuIds, setExpandedSmallMenuIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [hoverConnectionPoint, setHoverConnectionPoint] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [hoverMaterialConnectionPoint, setHoverMaterialConnectionPoint] = useState<{ materialId: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [view, setView] = useState<ViewportTransform>({ x: 0, y: 0, scale: 0.48 });
  const [viewportReady, setViewportReady] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ViewportTransform>({ x: 0, y: 0, scale: 0.48 });
  const activeTouchPointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchRef = useRef<{ canvasX: number; canvasY: number; startDistance: number; startScale: number } | null>(null);

  const tone = getTone('style');

  const hierarchyNodes = useMemo(() => {
    const nodeById = new Map<string, CanvasNode>(nodes.map((node) => [node.id, node]));
    const visibleMap = new Map<string, MaterialNode>();

    openBigNodeIds.forEach((openBigNodeId) => {
      const openBigNode = nodeById.get(openBigNodeId);
      if (!openBigNode) return;
      getCircularChildren(
        styleMiddleMenuNodes,
        openBigNode,
        MIDDLE_ORBIT_RADIUS,
        MIDDLE_ORBIT_START_ANGLE,
        'middle',
        openBigNode.id,
        openBigNode.id,
      ).forEach((material) => visibleMap.set(material.id, material));
    });

    connectedMaterials
      .filter((material) => material.kind === 'middle')
      .forEach((material) => {
        const parentNode = material.parentBigNodeId ? nodeById.get(material.parentBigNodeId) : null;
        const shouldShowAttached = !material.detached && !!material.parentBigNodeId && openBigNodeIds.includes(material.parentBigNodeId);
        const shouldShowDetached = !!material.detached;
        if (!shouldShowAttached && !shouldShowDetached) return;
        const orbitNode = parentNode && !material.detached ? getMiddleOrbitNode(parentNode, material.id) : null;
        visibleMap.set(material.id, {
          ...material,
          ...(orbitNode ? { x: orbitNode.x, y: orbitNode.y } : {}),
          connected: true,
        });
      });

    openMiddleNodeIds.forEach((openMiddleNodeId) => {
      const openMiddleNode = visibleMap.get(openMiddleNodeId);
      // 중간 원이 부모 큰 원에 붙어 있는 기본 상태에서는 클릭이 연결/해제만 담당한다.
      // 작은 원 펼침은 중간 원을 밖으로 분리(detached)한 뒤에만 열린다.
      if (!openMiddleNode || !openMiddleNode.detached) return;
      getCircularChildren(
        getDisplayStyleSmallDetailNodesForMiddle(openMiddleNode, expandedSmallMenuIds.includes(openMiddleNode.id)),
        openMiddleNode,
        SMALL_ORBIT_RADIUS,
        SMALL_ORBIT_START_ANGLE,
        'styleDetail',
        openMiddleNode.id,
        openMiddleNode.parentBigNodeId ?? openMiddleNode.parentId ?? '',
      ).forEach((material) => {
        if (!visibleMap.has(material.id)) visibleMap.set(material.id, material);
      });
    });

    connectedMaterials
      .filter((material) => material.kind === 'styleDetail')
      .forEach((material) => {
        if (!material.parentId) return;
        const parentMaterial = visibleMap.get(material.parentId);
        if (!parentMaterial) return;
        const shouldShowAttached = !material.detached && openMiddleNodeIds.includes(material.parentId) && !!parentMaterial.detached;
        const shouldShowDetached = !!material.detached;
        if (!shouldShowAttached && !shouldShowDetached) return;
        const orbitNode = shouldShowAttached ? getSmallOrbitNode(parentMaterial, material.id, expandedSmallMenuIds.includes(parentMaterial.id)) : null;
        visibleMap.set(material.id, {
          ...material,
          ...(orbitNode ? { x: orbitNode.x, y: orbitNode.y } : {}),
          connected: true,
        });
      });

    return Array.from(visibleMap.values());
  }, [nodes, openBigNodeIds, openMiddleNodeIds, expandedSmallMenuIds, connectedMaterials]);

  const toggleBigNode = (nodeId: string) => {
    setOpenBigNodeIds((current) => {
      const isOpen = current.includes(nodeId);
      if (isOpen) {
        // 큰 원 접기는 하위 메뉴를 화면에서만 가린다.
        // 중간/작은 원의 펼침 상태는 독립적으로 유지해 다시 펼쳤을 때 그대로 보이게 한다.
        return current.filter((id) => id !== nodeId);
      }
      return [...current, nodeId];
    });
  };

  const toggleMiddleNode = (materialId: string) => {
    setOpenMiddleNodeIds((current) => current.includes(materialId) ? current.filter((id) => id !== materialId) : [...current, materialId]);
  };

  const toggleSmallMenuExpansion = (materialId: string) => {
    setExpandedSmallMenuIds((current) => current.includes(materialId) ? current.filter((id) => id !== materialId) : [...current, materialId]);
  };

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const syncDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragging(next);
  };

  const fitCanvas = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const scale = clamp(
      Math.min(viewport.clientWidth / STYLE_INITIAL_VIEW_WIDTH, viewport.clientHeight / STYLE_INITIAL_VIEW_HEIGHT) * 0.96,
      0.22,
      0.72,
    );
    setView({
      scale,
      x: viewport.clientWidth / 2 - STYLE_INITIAL_VIEW_CENTER.x * scale,
      y: viewport.clientHeight / 2 - STYLE_INITIAL_VIEW_CENTER.y * scale,
    });
  };

  useEffect(() => {
    fitCanvas();
    setViewportReady(true);
    const handleResize = () => fitCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const clientToCanvas = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  };

  const getTouchPinchMetrics = () => {
    const points = Array.from(activeTouchPointersRef.current.values());
    if (points.length < 2) return null;
    const [first, second] = points;
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    return { centerX, centerY, distance };
  };

  const beginTouchPinch = () => {
    const viewport = viewportRef.current;
    const metrics = getTouchPinchMetrics();
    if (!viewport || !metrics || metrics.distance <= 0) return;
    const currentView = viewRef.current;
    const rect = viewport.getBoundingClientRect();
    const localX = metrics.centerX - rect.left;
    const localY = metrics.centerY - rect.top;
    pinchRef.current = {
      canvasX: (localX - currentView.x) / currentView.scale,
      canvasY: (localY - currentView.y) / currentView.scale,
      startDistance: metrics.distance,
      startScale: currentView.scale,
    };
    syncDrag(null);
    setSelectedConnectionId(null);
  };

  const updateTouchPinch = () => {
    const viewport = viewportRef.current;
    const pinch = pinchRef.current;
    const metrics = getTouchPinchMetrics();
    if (!viewport || !pinch || !metrics || metrics.distance <= 0) return false;
    const rect = viewport.getBoundingClientRect();
    const localX = metrics.centerX - rect.left;
    const localY = metrics.centerY - rect.top;
    const nextScale = clamp(pinch.startScale * (metrics.distance / pinch.startDistance), 0.22, 1.9);
    setView({
      scale: nextScale,
      x: localX - pinch.canvasX * nextScale,
      y: localY - pinch.canvasY * nextScale,
    });
    return true;
  };

  const addItem = (nodeId: string, ingredient: LabIngredient) => {
    setNodes((current) => current.map((node) => {
      if (node.id !== nodeId || node.items.includes(ingredient.label) || node.items.length >= node.max) return node;
      return { ...node, items: [...node.items, ingredient.label] };
    }));
  };

  const removeItem = (nodeId: string, label: string) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, items: node.items.filter((item) => item !== label) } : node));
  };

  const removeSelectedConnection = () => {
    if (!selectedConnectionId) return;
    setConnections((current) => current.filter((connection) => connection.id !== selectedConnectionId));
    setSelectedConnectionId(null);
  };

  const clearConnections = () => {
    setConnections([]);
    setSelectedConnectionId(null);
  };

  const getDropTarget = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const nodeElement = element?.closest('[data-lab-node-id]') as HTMLElement | null;
    return nodeElement?.dataset.labNodeId ?? null;
  };

  const getConnectionTarget = (clientX: number, clientY: number, fromNodeId: string) => {
    const pointer = clientToCanvas(clientX, clientY);
    let bestNodeId: string | null = null;
    let bestDistance = Infinity;

    nodes.forEach((node) => {
      if (node.id === fromNodeId) return;
      const distance = getCanvasDistance(pointer, node);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestNodeId = node.id;
      }
    });

    return bestDistance <= STYLE_NODE_SIZE / 2 + 92 ? bestNodeId : null;
  };


  const getMaterialConnectionTarget = (clientX: number, clientY: number, targetKind: MaterialNodeKind, fromMaterialId?: string) => {
    const pointer = clientToCanvas(clientX, clientY);
    let bestMaterialId: string | null = null;
    let bestDistance = Infinity;

    hierarchyNodes.forEach((material) => {
      if (material.kind !== targetKind || material.id === fromMaterialId || isSmallDetailMenuToggleNode(material)) return;
      const distance = getCanvasDistance(pointer, material);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMaterialId = material.id;
      }
    });

    if (!bestMaterialId) return null;
    const target = hierarchyNodes.find((material) => material.id === bestMaterialId);
    return target && bestDistance <= getMaterialNodeSize(target) / 2 + 70 ? bestMaterialId : null;
  };

  const rememberConnectedMaterial = (materialId: string) => {
    const material = hierarchyNodes.find((item) => item.id === materialId);
    if (!material) return;
    setConnectedMaterials((current) => {
      if (current.some((item) => item.id === material.id)) {
        return current.map((item) => item.id === material.id ? {
          ...item,
          connected: true,
          x: material.x,
          y: material.y,
          detached: item.kind === 'middle' ? (item.detached ?? false) : item.detached,
        } : item);
      }
      return [...current, { ...material, connected: true, detached: material.kind === 'middle' ? false : material.detached }];
    });
  };

  const addHierarchyConnection = (nextConnection: Omit<HierarchyConnection, 'id'>) => {
    setHierarchyConnections((current) => {
      const alreadyLinked = current.some((connection) => (
        connection.fromKind === nextConnection.fromKind
        && connection.fromId === nextConnection.fromId
        && connection.toId === nextConnection.toId
      ));
      if (alreadyLinked) return current;
      return [...current, { ...nextConnection, id: `${nextConnection.fromKind}-${nextConnection.fromId}-${nextConnection.toId}-${Date.now()}` }];
    });
  };

  const getHierarchyLinkForMaterial = (material: MaterialNode): Omit<HierarchyConnection, 'id'> | null => {
    if (material.kind === 'middle') {
      const parentBigNodeId = material.parentBigNodeId ?? material.parentId;
      if (!parentBigNodeId) return null;
      return { fromKind: 'big', fromId: parentBigNodeId, toId: material.id };
    }
    if (!material.parentId) return null;
    return { fromKind: 'middle', fromId: material.parentId, toId: material.id };
  };

  const connectMaterialToParent = (material: MaterialNode) => {
    const link = getHierarchyLinkForMaterial(material);
    if (!link) return;
    rememberConnectedMaterial(material.id);
    addHierarchyConnection(link);
  };

  const connectMaterialToParentAt = (material: MaterialNode, point: CanvasPoint, detached = true) => {
    const link = getHierarchyLinkForMaterial(material);
    if (!link) return;
    addHierarchyConnection(link);
    setConnectedMaterials((current) => {
      const nextMaterial: MaterialNode = {
        ...material,
        x: point.x,
        y: point.y,
        connected: true,
        detached,
      };
      if (current.some((item) => item.id === material.id)) {
        return current.map((item) => item.id === material.id ? {
          ...item,
          x: point.x,
          y: point.y,
          connected: true,
          detached,
        } : item);
      }
      return [...current, nextMaterial];
    });
  };

  const disconnectMaterialFromParent = (material: MaterialNode) => {
    const link = getHierarchyLinkForMaterial(material);
    if (!link) return;
    setHierarchyConnections((current) => current.filter((connection) => !(connection.fromKind === link.fromKind && connection.fromId === link.fromId && connection.toId === link.toId)));
    setConnectedMaterials((current) => {
      if (material.kind === 'middle') {
        return current.filter((item) => item.id !== material.id && item.parentId !== material.id);
      }
      return current.filter((item) => item.id !== material.id);
    });
    // 작은 원 연결/해제는 열린 작은 원 목록을 닫지 않는다.
    // 중간 원 자체가 해제될 때만 그 중간 원의 작은 원 펼침을 닫는다.
    if (material.kind === 'middle') {
      setOpenMiddleNodeIds((current) => current.filter((id) => id !== material.id));
      setExpandedSmallMenuIds((current) => current.filter((id) => id !== material.id));
    }
  };

  const getParentDropTarget = (material: MaterialNode): CanvasPoint | null => {
    if (material.kind === 'middle') {
      return material.parentBigNodeId ? nodes.find((node) => node.id === material.parentBigNodeId) ?? null : null;
    }
    return material.parentId ? hierarchyNodes.find((item) => item.id === material.parentId) ?? null : null;
  };

  const getParentDropRadius = (material: MaterialNode, parent: CanvasPoint) => {
    if (material.kind === 'middle') return STYLE_NODE_SIZE / 2 + 12;
    const parentMaterial = parent as MaterialNode;
    return 'kind' in parentMaterial ? getMaterialNodeSize(parentMaterial) / 2 + 10 : STYLE_MATERIAL_NODE_SIZE / 2 + 10;
  };

  const handleStartIngredientDrag = (ingredient: LabIngredient, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    setSelectedConnectionId(null);
    syncDrag({
      kind: 'ingredient',
      ingredient,
      x: event.clientX,
      y: event.clientY,
      overNodeId: null,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  const handleStartNodeMove = (nodeId: string, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    event.preventDefault();
    setSelectedConnectionId(null);
    const pointer = clientToCanvas(event.clientX, event.clientY);
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    syncDrag({ kind: 'canvasNode', nodeId, offsetX: pointer.x - node.x, offsetY: pointer.y - node.y, startClientX: event.clientX, startClientY: event.clientY, moved: false });
  };



  const handleStartConnection = (nodeId: string, event: PointerEvent<SVGCircleElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    setSelectedConnectionId(null);
    const pointer = clientToCanvas(event.clientX, event.clientY);
    setHoverConnectionPoint(null);
    syncDrag({ kind: 'connection', fromNodeId: nodeId, pointerX: pointer.x, pointerY: pointer.y, overNodeId: null, overMaterialId: null });
  };

  const handleStartMaterialMove = (materialId: string, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedConnectionId(null);
    const pointer = clientToCanvas(event.clientX, event.clientY);
    const material = hierarchyNodes.find((item) => item.id === materialId);
    if (!material) return;

    // 연결 전 하위 원은 상위 원 안으로 끌어 넣어 연결할 수 있어야 한다.
    // 연결된 작은 원도 중간 원처럼 움직일 수 있다. 부모 안에 다시 넣으면 연결/해제 토글만 수행한다.
    syncDrag({ kind: 'materialNode', materialId, offsetX: pointer.x - material.x, offsetY: pointer.y - material.y, startClientX: event.clientX, startClientY: event.clientY, moved: false });
  };

  const handleStartMaterialConnection = (materialId: string, event: PointerEvent<SVGCircleElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const material = hierarchyNodes.find((item) => item.id === materialId);
    if (!material || material.kind !== 'middle') return;
    setSelectedConnectionId(null);
    const pointer = clientToCanvas(event.clientX, event.clientY);
    setHoverMaterialConnectionPoint(null);
    syncDrag({ kind: 'materialConnection', fromMaterialId: materialId, pointerX: pointer.x, pointerY: pointer.y, overMaterialId: null });
  };

  const handleViewportPointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    activeTouchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some mobile browsers can reject capture during multi-touch. Pinch tracking still works through window events.
    }
    if (activeTouchPointersRef.current.size >= 2) {
      event.preventDefault();
      beginTouchPinch();
    }
  };

  const handleStartPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.pointerType === 'touch' && activeTouchPointersRef.current.size >= 2) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-lab-node-id]') || target.closest('[data-lab-material-node]') || target.closest('[data-lab-ingredient-hub]') || target.closest('button')) return;
    event.preventDefault();
    setSelectedConnectionId(null);
    syncDrag({ kind: 'pan', startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y });
  };

  const zoomAtCenter = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const canvasX = (centerX - view.x) / view.scale;
    const canvasY = (centerY - view.y) / view.scale;
    const nextScale = clamp(view.scale * factor, 0.22, 1.9);
    setView({
      scale: nextScale,
      x: centerX - canvasX * nextScale,
      y: centerY - canvasY * nextScale,
    });
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const currentView = viewRef.current;
      const rect = viewport.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const canvasX = (localX - currentView.x) / currentView.scale;
      const canvasY = (localY - currentView.y) / currentView.scale;
      const nextScale = clamp(currentView.scale * (event.deltaY > 0 ? 0.92 : 1.08), 0.22, 1.9);

      setView({
        scale: nextScale,
        x: localX - canvasX * nextScale,
        y: localY - canvasY * nextScale,
      });
    };

    viewport.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleNativeWheel);
  }, []);

  useEffect(() => {
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'touch' && activeTouchPointersRef.current.has(event.pointerId)) {
        activeTouchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      }

      if (pinchRef.current && activeTouchPointersRef.current.size >= 2) {
        event.preventDefault();
        updateTouchPinch();
        return;
      }

      const current = dragRef.current;
      if (!current) return;
      event.preventDefault();

      if (current.kind === 'ingredient') {
        syncDrag({ ...current, x: event.clientX, y: event.clientY, overNodeId: getDropTarget(event.clientX, event.clientY) });
        return;
      }

      if (current.kind === 'canvasNode') {
        const movement = Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY);
        const moved = current.moved || movement > 5;
        if (!moved) return;
        const pointer = clientToCanvas(event.clientX, event.clientY);
        const nextX = clamp(pointer.x - current.offsetX, STYLE_NODE_SIZE / 2, STYLE_CANVAS_WIDTH - STYLE_NODE_SIZE / 2);
        const nextY = clamp(pointer.y - current.offsetY, STYLE_NODE_SIZE / 2, STYLE_CANVAS_HEIGHT - STYLE_NODE_SIZE / 2);
        setNodes((currentNodes) => currentNodes.map((node) => node.id === current.nodeId ? { ...node, x: nextX, y: nextY } : node));
        syncDrag({ ...current, moved: true });
        return;
      }

      if (current.kind === 'connection') {
        const pointer = clientToCanvas(event.clientX, event.clientY);
        const overNodeId = getConnectionTarget(event.clientX, event.clientY, current.fromNodeId);
        syncDrag({ ...current, pointerX: pointer.x, pointerY: pointer.y, overNodeId, overMaterialId: null });
        return;
      }

      if (current.kind === 'materialNode') {
        const material = hierarchyNodes.find((item) => item.id === current.materialId);
        const movement = Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY);
        const dragThreshold = material?.kind === 'styleDetail' ? 14 : 5;
        const moved = current.moved || movement > dragThreshold;
        if (!moved) return;
        const pointer = clientToCanvas(event.clientX, event.clientY);
        if (material && isSmallDetailMenuToggleNode(material)) {
          syncDrag({ ...current, moved: true });
          return;
        }
        const materialSize = material ? getMaterialNodeSize(material) : STYLE_MATERIAL_NODE_SIZE;
        const nextX = clamp(pointer.x - current.offsetX, materialSize / 2, STYLE_CANVAS_WIDTH - materialSize / 2);
        const nextY = clamp(pointer.y - current.offsetY, materialSize / 2, STYLE_CANVAS_HEIGHT - materialSize / 2);
        if (material && !material.connected) {
          const parentTarget = getParentDropTarget(material);
          const startDistance = parentTarget ? getCanvasDistance(material, parentTarget) : 0;
          const nextDistance = parentTarget ? getCanvasDistance({ x: nextX, y: nextY }, parentTarget) : 0;
          const pullAwayThreshold = material.kind === 'styleDetail' ? 28 : 10;
          const isPullingAwayFromParent = !!parentTarget && nextDistance > startDistance + pullAwayThreshold;
          if (isPullingAwayFromParent) {
            // 하위 원을 기존 펼침 위치에서 바깥으로 당기면, 놓기 전부터 연결선이 붙은 채로 분리된다.
            connectMaterialToParentAt(material, { x: nextX, y: nextY }, true);
          }
        }
        if (material?.kind === 'styleDetail') {
          if (material.connected) {
            setConnectedMaterials((materials) => materials.map((item) => (
              item.id === current.materialId ? { ...item, x: nextX, y: nextY, detached: true } : item
            )));
          }
          syncDrag({ ...current, x: nextX, y: nextY, moved: true });
          return;
        }
        if (material?.kind === 'middle' && material.connected) {
          const previousMaterial = hierarchyNodes.find((item) => item.id === current.materialId);
          const deltaX = nextX - (previousMaterial?.x ?? nextX);
          const deltaY = nextY - (previousMaterial?.y ?? nextY);
          setConnectedMaterials((materials) => materials.map((item) => {
            if (item.id === current.materialId) return { ...item, x: nextX, y: nextY, detached: true };
            if (item.kind === 'styleDetail' && item.parentId === current.materialId && item.connected && !item.detached) {
              return { ...item, x: item.x + deltaX, y: item.y + deltaY };
            }
            return item;
          }));
        }
        syncDrag({ ...current, x: nextX, y: nextY, moved: true });
        return;
      }

      if (current.kind === 'materialConnection') {
        const pointer = clientToCanvas(event.clientX, event.clientY);
        const overMaterialId = getMaterialConnectionTarget(event.clientX, event.clientY, 'styleDetail', current.fromMaterialId);
        syncDrag({ ...current, pointerX: pointer.x, pointerY: pointer.y, overMaterialId });
        return;
      }

      if (current.kind === 'pan') {
        setView((previous) => ({ ...previous, x: current.originX + event.clientX - current.startX, y: current.originY + event.clientY - current.startY }));
      }
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'touch') {
        activeTouchPointersRef.current.delete(event.pointerId);
        if (pinchRef.current) {
          event.preventDefault();
          if (activeTouchPointersRef.current.size < 2) pinchRef.current = null;
          syncDrag(null);
          setHoverConnectionPoint(null);
          setHoverMaterialConnectionPoint(null);
          return;
        }
      }

      const current = dragRef.current;
      if (!current) return;
      event.preventDefault();
      if (current.kind === 'ingredient') {
        const nodeId = getDropTarget(event.clientX, event.clientY);
        if (nodeId) addItem(nodeId, current.ingredient);
      }

      if (current.kind === 'canvasNode' && !current.moved) {
        toggleBigNode(current.nodeId);
      }

      if (current.kind === 'connection') {
        const targetId = getConnectionTarget(event.clientX, event.clientY, current.fromNodeId);
        if (targetId && targetId !== current.fromNodeId) {
          setConnections((currentConnections) => {
            const alreadyLinked = currentConnections.some((connection) => (
              (connection.fromNodeId === current.fromNodeId && connection.toNodeId === targetId)
              || (connection.fromNodeId === targetId && connection.toNodeId === current.fromNodeId)
            ));
            if (alreadyLinked) return currentConnections;
            const nextConnection = { id: `${current.fromNodeId}-${targetId}-${Date.now()}`, fromNodeId: current.fromNodeId, toNodeId: targetId };
            setSelectedConnectionId(nextConnection.id);
            return [
              ...currentConnections,
              nextConnection,
            ];
          });
        }
      }

      if (current.kind === 'materialNode' && !current.moved) {
        const clickedMaterial = hierarchyNodes.find((material) => material.id === current.materialId);
        if (clickedMaterial) {
          if (isSmallDetailMenuToggleNode(clickedMaterial) && clickedMaterial.parentId) {
            toggleSmallMenuExpansion(clickedMaterial.parentId);
          } else if (!clickedMaterial.connected) {
            connectMaterialToParent(clickedMaterial);
          } else if (clickedMaterial.kind === 'styleDetail') {
            disconnectMaterialFromParent(clickedMaterial);
          } else if (clickedMaterial.kind === 'middle') {
            if (clickedMaterial.detached) {
              // 분리된 중간 원만 클릭으로 작은 원을 펼치거나 접는다.
              toggleMiddleNode(clickedMaterial.id);
            } else {
              // 부모 큰 원에 붙어 있는 기본 중간 원은 클릭 1번 = 연결, 다시 클릭 = 해제.
              disconnectMaterialFromParent(clickedMaterial);
            }
          }
        }
      }

      if (current.kind === 'materialNode' && current.moved) {
        const movedMaterial = hierarchyNodes.find((material) => material.id === current.materialId);
        if (movedMaterial && isSmallDetailMenuToggleNode(movedMaterial)) {
          syncDrag(null);
          setHoverConnectionPoint(null);
          setHoverMaterialConnectionPoint(null);
          return;
        }
        const finalCenter = { x: current.x ?? movedMaterial?.x ?? 0, y: current.y ?? movedMaterial?.y ?? 0 };
        const parentTarget = movedMaterial ? getParentDropTarget(movedMaterial) : null;
        if (movedMaterial && parentTarget) {
          const droppedInsideParent = getCanvasDistance(finalCenter, parentTarget) <= getParentDropRadius(movedMaterial, parentTarget);
          if (droppedInsideParent) {
            if (movedMaterial.connected) {
              disconnectMaterialFromParent(movedMaterial);
            } else {
              connectMaterialToParent(movedMaterial);
            }
          } else if (!movedMaterial.connected) {
            // 하위 원을 기존 위치에서 당겨 부모 밖에 놓으면 연결된 상태로 그 위치에 고정한다.
            connectMaterialToParentAt(movedMaterial, finalCenter, true);
          } else if (movedMaterial.connected && movedMaterial.kind === 'styleDetail') {
            setConnectedMaterials((materials) => materials.map((item) => (
              item.id === movedMaterial.id ? { ...item, x: finalCenter.x, y: finalCenter.y, detached: true } : item
            )));
          }
        }
      }

      if (current.kind === 'materialConnection') {
        const targetMaterialId = getMaterialConnectionTarget(event.clientX, event.clientY, 'styleDetail', current.fromMaterialId);
        if (targetMaterialId && targetMaterialId !== current.fromMaterialId) {
          rememberConnectedMaterial(targetMaterialId);
          addHierarchyConnection({ fromKind: 'middle', fromId: current.fromMaterialId, toId: targetMaterialId });
        }
      }
      syncDrag(null);
      setHoverConnectionPoint(null);
      setHoverMaterialConnectionPoint(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        syncDrag(null);
        setSelectedConnectionId(null);
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedConnectionId) {
        event.preventDefault();
        removeSelectedConnection();
      }
    };

    const blockContextMenu = (event: MouseEvent) => event.preventDefault();

    const handlePointerCancel = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'touch') {
        activeTouchPointersRef.current.delete(event.pointerId);
        if (activeTouchPointersRef.current.size < 2) pinchRef.current = null;
      }
      if (dragRef.current) syncDrag(null);
      setHoverConnectionPoint(null);
      setHoverMaterialConnectionPoint(null);
    };

    document.body.style.userSelect = dragging ? 'none' : previousUserSelect;
    document.body.style.cursor = dragging?.kind === 'ingredient' ? 'grabbing' : dragging?.kind === 'canvasNode' ? 'move' : dragging?.kind === 'materialNode' ? 'move' : dragging?.kind === 'connection' ? 'default' : dragging?.kind === 'materialConnection' ? 'default' : dragging?.kind === 'pan' ? 'grabbing' : previousCursor;

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
    window.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', blockContextMenu);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', blockContextMenu);
    };
  }, [dragging?.kind, view.x, view.y, view.scale, nodes, hierarchyNodes, selectedConnectionId]);

  const activeNodeId = dragging?.kind === 'ingredient' ? dragging.overNodeId : dragging?.kind === 'connection' ? dragging.overNodeId : null;
  const movingNodeId = dragging?.kind === 'canvasNode' ? dragging.nodeId : null;
  const connectingNodeId = dragging?.kind === 'connection' ? dragging.fromNodeId : null;
  const connectionTargetNodeId = dragging?.kind === 'connection' ? dragging.overNodeId : null;
  const movingMaterialId = dragging?.kind === 'materialNode' ? dragging.materialId : null;
  const connectingMaterialId = dragging?.kind === 'materialConnection' ? dragging.fromMaterialId : null;
  const getBigMiddleConnectionCount = (nodeId: string) => hierarchyConnections.filter((connection) => connection.fromKind === 'big' && connection.fromId === nodeId).length;
  const getMiddleChildConnectionCount = (materialId: string) => hierarchyConnections.filter((connection) => connection.fromKind === 'middle' && connection.fromId === materialId).length;
  const getBigSmallConnectionCount = (nodeId: string) => {
    const middleIds = hierarchyConnections
      .filter((connection) => connection.fromKind === 'big' && connection.fromId === nodeId)
      .map((connection) => connection.toId);
    if (middleIds.length === 0) return 0;
    return hierarchyConnections.filter((connection) => connection.fromKind === 'middle' && middleIds.includes(connection.fromId)).length;
  };
  const getBigConnectionGlowLevel = (nodeId: string) => Math.min(16, getBigMiddleConnectionCount(nodeId) + Math.floor(getBigSmallConnectionCount(nodeId) / 2));
  const getMiddleConnectionGlowLevel = (materialId: string) => {
    const childCount = getMiddleChildConnectionCount(materialId);
    if (childCount <= 0) return 0;
    return Math.min(16, Math.ceil(childCount / 2));
  };
  const displayHierarchyNodes = hierarchyNodes.map((material) => {
    if (
      dragging?.kind === 'materialNode'
      && dragging.materialId === material.id
      && dragging.moved
      && typeof dragging.x === 'number'
      && typeof dragging.y === 'number'
    ) {
      // 드래그 중인 하위 원은 손을 따라 보이고, 놓은 위치가 연결 상태의 고정 위치로 저장된다.
      return { ...material, x: dragging.x, y: dragging.y };
    }
    return material;
  });
  const middleNodeCount = displayHierarchyNodes.filter((material) => material.kind === 'middle').length;
  const styleDetailNodeCount = displayHierarchyNodes.filter((material) => material.kind === 'styleDetail').length;

  return (
    <div className="select-none" onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
      <LabWorkspaceGlobalStyle />
      <section className="relative overflow-hidden rounded-[2.2rem] bg-[#090B10] shadow-2xl" style={{ minHeight: '940px' }}>
        <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.34) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${tone.coreA}14, transparent 28%), radial-gradient(circle at 72% 30%, ${tone.coreB}13, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.035), transparent 48%)` }} />

        <div className="relative z-20 flex items-center justify-between px-6 pt-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: tone.coreA }}>STYLE MAP</p>
            <h2 className="mt-1 text-2xl font-black text-white">스타일 마인드맵</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => zoomAtCenter(0.9)} className="rounded-full bg-white/[0.06] p-2 text-white/60 transition hover:bg-white/[0.1] hover:text-white"><ZoomOut className="h-4 w-4" /></button>
            <span className="min-w-[56px] rounded-full bg-white/[0.06] px-3 py-2 text-center text-[11px] font-black text-white/48">{Math.round(view.scale * 100)}%</span>
            <button type="button" onClick={() => zoomAtCenter(1.1)} className="rounded-full bg-white/[0.06] p-2 text-white/60 transition hover:bg-white/[0.1] hover:text-white"><ZoomIn className="h-4 w-4" /></button>
            <button type="button" onClick={fitCanvas} className="rounded-full bg-white/[0.06] p-2 text-white/60 transition hover:bg-white/[0.1] hover:text-white"><RotateCcw className="h-4 w-4" /></button>
          </div>
        </div>

        <div
          ref={viewportRef}
          onPointerDownCapture={handleViewportPointerDownCapture}
          onPointerDown={handleStartPan}
          className="relative z-10 mx-auto mt-4 h-[760px] w-[calc(100%-3rem)] cursor-grab overflow-hidden rounded-[1.8rem] bg-black/18 active:cursor-grabbing"
          style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: STYLE_CANVAS_WIDTH,
              height: STYLE_CANVAS_HEIGHT,
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${viewportReady ? view.scale : 0.48})`,
            }}
          >
            <CanvasConnectorLines nodes={nodes} />
            <CanvasHierarchyLines nodes={nodes} materials={displayHierarchyNodes} connections={hierarchyConnections} draft={null} />
            <CanvasRelationLines
              nodes={nodes}
              materials={displayHierarchyNodes}
              connections={connections}
              draft={dragging?.kind === 'connection' ? dragging : null}
              selectedConnectionId={selectedConnectionId}
              onSelectConnection={setSelectedConnectionId}
            />
            <CanvasConnectionHandles
              nodes={nodes}
              connectingNodeId={connectingNodeId}
              activeTargetNodeId={connectionTargetNodeId}
              hoverPoint={hoverConnectionPoint}
              onHoverPoint={setHoverConnectionPoint}
              onClearHover={(nodeId) => setHoverConnectionPoint((current) => current?.nodeId === nodeId ? null : current)}
              onStartConnect={handleStartConnection}
            />
            <div
              className="pointer-events-none absolute z-40 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl font-black text-white shadow-2xl"
              style={{
                left: STYLE_CENTER.x,
                top: STYLE_CENTER.y,
                width: STYLE_CENTER_SIZE,
                height: STYLE_CENTER_SIZE,
                background: `linear-gradient(135deg, ${tone.coreA}, ${tone.coreB})`,
                boxShadow: `0 0 0 8px rgba(255,255,255,0.045), 0 0 70px ${tone.coreA}38, 0 0 110px ${tone.coreB}24`,
              }}
            >
              STYLE
            </div>
            {nodes.map((node) => (
              <CanvasNodeView
                key={node.id}
                node={node}
                active={activeNodeId === node.id}
                moving={movingNodeId === node.id}
                connecting={connectingNodeId === node.id}
                connectionCount={getBigConnectionGlowLevel(node.id)}
                onRemoveItem={removeItem}
                onStartMove={handleStartNodeMove}
              />
            ))}
            {displayHierarchyNodes.map((material) => (
              <CanvasMaterialNodeView
                key={material.id}
                material={material}
                active={(material.kind === 'middle' && material.detached && openMiddleNodeIds.includes(material.id)) || movingMaterialId === material.id}
                connectionCount={getMiddleConnectionGlowLevel(material.id)}
                onToggle={toggleMiddleNode}
                onStartMove={handleStartMaterialMove}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-black/36 px-3 py-2 text-[11px] font-black text-white/42 backdrop-blur-md">
            <Move className="h-3.5 w-3.5" /> 큰 원 이동해도 펼침 유지 · 하위 원 당기기 = 연결 분리 · 클릭/넣기 = 연결/해제 · 중간 원 분리 후 작은 원 펼침
          </div>
        </div>

        {connections.length > 0 && (
          <div className="relative z-30 mx-auto mt-3 flex max-w-[1180px] flex-wrap items-center justify-center gap-2 rounded-full bg-black/22 px-4 py-3 text-xs font-black text-white/62 backdrop-blur-md">
            <span className="mr-1 text-white/38">연결선 {connections.length}개</span>
            <button
              type="button"
              onClick={removeSelectedConnection}
              disabled={!selectedConnectionId}
              className="rounded-full bg-white/[0.06] px-3 py-2 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
            >
              선택선 삭제
            </button>
            <button
              type="button"
              onClick={clearConnections}
              className="rounded-full bg-white/[0.06] px-3 py-2 transition hover:bg-white/[0.1]"
            >
              연결선 초기화
            </button>
          </div>
        )}

        <div data-lab-ingredient-hub className="relative z-30 mx-auto mb-6 mt-4 flex max-w-[1180px] flex-wrap items-center justify-center gap-2 rounded-full bg-black/22 px-4 py-3 text-xs font-black text-white/54 backdrop-blur-md">
          <Network className="h-4 w-4" style={{ color: tone.coreA }} />
          <span>중간 원 {middleNodeCount}개</span>
          <span className="text-white/30">·</span>
          <span>스타일 작은 원 {styleDetailNodeCount}개</span>
          <span className="text-white/30">·</span>
          <span className="text-white/38">큰 원 직접 클릭으로만 접기 · 하위 원 당기면 연결 분리 · 클릭/넣기로 연결/해제</span>
        </div>
      </section>

      {dragging?.kind === 'ingredient' && (
        <DragGhost dragging={dragging} tone={tone} />
      )}
    </div>
  );
}

function DragGhost({ dragging, tone }: { dragging: Extract<DragState, { kind: 'ingredient' }>; tone: ReturnType<typeof getTone> }) {
  return (
    <div
      className="pointer-events-none fixed z-[9999] flex items-center justify-center rounded-full px-3 py-2 text-xs font-black shadow-2xl"
      style={{
        left: dragging.x - dragging.offsetX,
        top: dragging.y - dragging.offsetY,
        width: dragging.width,
        height: dragging.height,
        background: `linear-gradient(135deg, ${tone.coreA}33, ${tone.coreB}44), rgba(16,16,20,0.96)`,
        color: tone.text,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 18px 45px rgba(0,0,0,0.34)`,
      }}
    >
      {dragging.ingredient.label}
    </div>
  );
}

function LabWorkspaceGlobalStyle() {
  return (
    <style>{`
      @keyframes labNodeGlowPulse {
        0%, 100% { opacity: 0.36; filter: brightness(1); }
        48% { opacity: 0.72; filter: brightness(1.18); }
        72% { opacity: 0.48; filter: brightness(1.08); }
      }
      @keyframes labConnectionPulse {
        0%, 100% { opacity: 0.18; filter: brightness(1); transform: scale(1); }
        52% { opacity: 0.46; filter: brightness(1.18); transform: scale(1.012); }
      }
      .lab-line-visual {
        transition: opacity 160ms ease, filter 160ms ease;
        vector-effect: non-scaling-stroke;
        shape-rendering: geometricPrecision;
      }
      .lab-line-group:hover .lab-line-visual {
        opacity: 0.98;
        filter: brightness(1.25);
      }
      [data-lab-node-id], [data-lab-material-node], [role='button'] {
        -webkit-user-drag: none;
        user-select: none;
      }
    `}</style>
  );
}

function LyricsMindMapWorkspace() {
  const [nodes, setNodes] = useState<MapNode[]>(initialLyricsNodes);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<BoardSize>({ width: 1280, height: 760 });

  const tone = getTone('lyrics');

  const syncDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragging(next);
  };

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
    const rect = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    syncDrag({
      kind: 'ingredient',
      ingredient,
      x: event.clientX,
      y: event.clientY,
      overNodeId: null,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    });
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

      if (current.kind !== 'node') return;
      const radiusX = (NODE_MOVE_PADDING / current.boardRect.width) * 100;
      const radiusY = (NODE_MOVE_PADDING / current.boardRect.height) * 100;
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
      <LabWorkspaceGlobalStyle />
      <section className="relative overflow-hidden rounded-[2.2rem] bg-[#090B10] shadow-2xl" style={{ minHeight: '760px' }}>
        <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.34) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${tone.coreA}14, transparent 28%), radial-gradient(circle at 72% 30%, ${tone.coreB}13, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.035), transparent 48%)` }} />

        <div className="relative z-20 flex items-center justify-between px-6 pt-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: tone.coreA }}>LYRIC MAP</p>
            <h2 className="mt-1 text-2xl font-black text-white">가사 마인드맵</h2>
          </div>
          <div className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-white/48">입구만 준비됨</div>
        </div>

        <div ref={boardRef} className="relative z-10 mx-auto h-[620px] w-full max-w-[1320px]">
          <ConnectorLines nodes={nodes} mode="lyrics" boardSize={boardSize} />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-2xl font-black text-white shadow-2xl"
            style={{
              width: CENTER_NODE_SIZE,
              height: CENTER_NODE_SIZE,
              background: `linear-gradient(135deg, ${tone.coreA}, ${tone.coreB})`,
              boxShadow: `0 0 0 8px rgba(255,255,255,0.045), 0 0 70px ${tone.coreA}38, 0 0 110px ${tone.coreB}24`,
            }}
          >
            LYRICS
          </div>
          {nodes.map((node) => (
            <MapNodeView
              key={node.id}
              node={node}
              mode="lyrics"
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
            {lyricsIngredients.map((ingredient) => (
              <IngredientChip key={ingredient.id} ingredient={ingredient} onStartDrag={handleStartIngredientDrag} />
            ))}
          </div>
        </div>
      </section>

      {dragging?.kind === 'ingredient' && (
        <DragGhost dragging={dragging} tone={tone} />
      )}
    </div>
  );
}

export default function LabWorkspace({ mode }: { mode: LabMode }) {
  return mode === 'style' ? <StyleCanvasWorkspace /> : <LyricsMindMapWorkspace />;
}
