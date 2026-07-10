import React, { PointerEvent, useEffect, useState } from 'react';
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

type DragState = {
  ingredient: LabIngredient;
  x: number;
  y: number;
  overZoneId: string | null;
};

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
  { id: 'genreLine', label: 'Genre', max: 3, items: ['장르'], x: 28, y: 20 },
  { id: 'soundLine', label: 'Sound', max: 4, items: ['사운드'], x: 72, y: 20 },
  { id: 'moodLine', label: 'Mood', max: 4, items: ['분위기', '주제'], x: 22, y: 60 },
  { id: 'vocalsLine', label: 'Vocals', max: 3, items: ['보컬'], x: 78, y: 60 },
  { id: 'productionLine', label: 'Production', max: 4, items: ['템포', '곡 구조'], x: 50, y: 84 },
];

const initialLyricZones: MapZone[] = [
  { id: 'verse', label: 'Verse', max: 4, items: ['장면', '화자'], x: 25, y: 23 },
  { id: 'preChorus', label: 'Pre-Chorus', max: 3, items: ['욕망'], x: 70, y: 22 },
  { id: 'chorus', label: 'Chorus', max: 4, items: ['반복 훅', '말투'], x: 78, y: 62 },
  { id: 'bridge', label: 'Bridge', max: 3, items: ['결함'], x: 28, y: 73 },
  { id: 'outro', label: 'Outro', max: 3, items: ['밀도'], x: 55, y: 88 },
];

function getTone(ingredientType: IngredientType) {
  return ingredientType === 'lyric'
    ? {
        main: '#6EF0D4',
        soft: 'rgba(110, 240, 212, 0.13)',
        fill: 'rgba(110, 240, 212, 0.23)',
        glow: 'rgba(110, 240, 212, 0.18)',
        text: '#D8FFF7',
        solid: '#12201F',
      }
    : {
        main: '#FF9BD7',
        soft: 'rgba(255, 155, 215, 0.13)',
        fill: 'rgba(255, 155, 215, 0.24)',
        glow: 'rgba(255, 155, 215, 0.18)',
        text: '#FFE5F5',
        solid: '#211720',
      };
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
      className="inline-flex cursor-grab select-none items-center gap-1.5 rounded-full bg-white/[0.055] px-3 py-2 text-xs font-black text-white/78 transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5"
      style={{ boxShadow: `inset 0 0 0 1px ${tone.soft}, 0 0 18px rgba(255,255,255,0.02)` }}
    >
      <Grip className="h-3.5 w-3.5 text-white/22" />
      {ingredient.label}
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
      onClick={onRemove}
      className="select-none rounded-full px-2.5 py-1 text-[11px] font-black transition-all hover:-translate-y-0.5"
      style={{ background: toneStyle.soft, color: toneStyle.text }}
    >
      {label}
    </button>
  );
}

function MapNode({
  zone,
  tone,
  active,
  onRemoveItem,
}: {
  zone: MapZone;
  tone: IngredientType;
  active: boolean;
  onRemoveItem: (zoneId: string, label: string) => void;
}) {
  const percent = Math.min(100, Math.round((zone.items.length / Math.max(zone.max, 1)) * 100));
  const toneStyle = getTone(tone);

  return (
    <div
      data-lab-zone-id={zone.id}
      data-lab-zone-type={tone}
      onContextMenu={(event) => event.preventDefault()}
      className={`absolute z-20 min-h-[104px] w-[180px] -translate-x-1/2 -translate-y-1/2 select-none overflow-hidden rounded-[1.65rem] p-3.5 shadow-xl transition-all duration-300 sm:w-[194px] ${active ? 'scale-[1.045]' : ''}`}
      style={{
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        background: tone === 'lyric' ? 'rgba(16, 30, 29, 0.96)' : 'rgba(31, 23, 30, 0.96)',
        boxShadow: active
          ? `0 22px 60px rgba(0,0,0,0.35), 0 0 0 1px ${toneStyle.main}, 0 0 34px ${toneStyle.glow}`
          : `0 18px 46px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.035)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 transition-all duration-700 ease-out"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, ${toneStyle.fill}, ${toneStyle.soft}, transparent)`,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-white">{zone.label}</p>
          <span className="rounded-full bg-black/22 px-2 py-1 text-[10px] font-black text-white/42">{zone.items.length}/{zone.max}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {zone.items.map((item) => (
            <PlacedChip key={item} label={item} tone={tone} onRemove={() => onRemoveItem(zone.id, item)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ConnectorLines({ zones, tone }: { zones: MapZone[]; tone: IngredientType }) {
  const toneStyle = getTone(tone);

  const makePath = (zone: MapZone) => {
    const dx = zone.x - 50;
    const dy = zone.y - 50;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const centerRadius = 8.5;
    const nodePadding = 13.5;
    const startX = 50 + ux * centerRadius;
    const startY = 50 + uy * centerRadius;
    const endX = zone.x - ux * nodePadding;
    const endY = zone.y - uy * nodePadding;
    const c1X = startX + ux * 10;
    const c1Y = startY + uy * 4;
    const c2X = endX - ux * 10;
    const c2Y = endY - uy * 4;

    return `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
  };

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {zones.map((zone) => (
        <path
          key={zone.id}
          d={makePath(zone)}
          fill="none"
          stroke={zone.items.length ? toneStyle.main : 'rgba(255,255,255,0.12)'}
          strokeWidth={zone.items.length ? '0.28' : '0.22'}
          strokeLinecap="round"
          opacity={zone.items.length ? 0.34 : 0.18}
        />
      ))}
    </svg>
  );
}

function MindMapBoard({
  title,
  center,
  tone,
  zones,
  activeZoneId,
  onRemoveItem,
}: {
  title: string;
  center: string;
  tone: IngredientType;
  zones: MapZone[];
  activeZoneId: string | null;
  onRemoveItem: (zoneId: string, label: string) => void;
}) {
  const toneStyle = getTone(tone);

  return (
    <section className="min-h-[790px] rounded-[2rem] bg-white/[0.035] p-3 shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 px-1 text-sm font-black text-white">
        {tone === 'lyric' ? <Music2 className="h-4 w-4" style={{ color: toneStyle.main }} /> : <Sparkles className="h-4 w-4" style={{ color: toneStyle.main }} />}
        {title}
      </div>

      <div className="relative min-h-[740px] overflow-hidden rounded-[2rem] bg-black/[0.11]">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 flex h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black text-white shadow-2xl"
          style={{ background: toneStyle.solid, boxShadow: `0 0 0 1px ${toneStyle.soft}, 0 0 36px ${toneStyle.glow}` }}
        >
          {center}
        </div>
        <ConnectorLines zones={zones} tone={tone} />
        {zones.map((zone) => (
          <MapNode
            key={zone.id}
            zone={zone}
            tone={tone}
            active={activeZoneId === zone.id}
            onRemoveItem={onRemoveItem}
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

  const addPromptItem = (zoneId: string, ingredient: LabIngredient) => {
    setPromptZones((zones) => zones.map((zone) => {
      if (zone.id !== zoneId || zone.items.includes(ingredient.label)) return zone;
      return { ...zone, items: [...zone.items, ingredient.label] };
    }));
  };

  const addLyricItem = (zoneId: string, ingredient: LabIngredient) => {
    setLyricZones((zones) => zones.map((zone) => {
      if (zone.id !== zoneId || zone.items.includes(ingredient.label)) return zone;
      return { ...zone, items: [...zone.items, ingredient.label] };
    }));
  };

  const removePromptItem = (zoneId: string, label: string) => {
    setPromptZones((zones) => zones.map((zone) => zone.id === zoneId ? { ...zone, items: zone.items.filter((item) => item !== label) } : zone));
  };

  const removeLyricItem = (zoneId: string, label: string) => {
    setLyricZones((zones) => zones.map((zone) => zone.id === zoneId ? { ...zone, items: zone.items.filter((item) => item !== label) } : zone));
  };

  const handleStartDrag = (ingredient: LabIngredient, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setDragging({ ingredient, x: event.clientX, y: event.clientY, overZoneId: null });
  };

  useEffect(() => {
    const activeIngredient = dragging?.ingredient;
    if (!activeIngredient) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const getDropTarget = (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const zoneElement = element?.closest('[data-lab-zone-id]') as HTMLElement | null;
      const zoneId = zoneElement?.dataset.labZoneId ?? null;
      const zoneType = zoneElement?.dataset.labZoneType as IngredientType | undefined;

      if (!zoneId || zoneType !== activeIngredient.type) return null;
      return zoneId;
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const overZoneId = getDropTarget(event.clientX, event.clientY);
      setDragging((current) => current ? { ...current, x: event.clientX, y: event.clientY, overZoneId } : current);
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      const overZoneId = getDropTarget(event.clientX, event.clientY);
      if (overZoneId) {
        if (activeIngredient.type === 'prompt') {
          addPromptItem(overZoneId, activeIngredient);
        } else {
          addLyricItem(overZoneId, activeIngredient);
        }
      }
      setDragging(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDragging(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragging?.ingredient.id, dragging?.ingredient.type]);

  return (
    <div
      className="select-none"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_250px_minmax(0,1fr)]">
        <MindMapBoard
          title="프롬프트"
          center="PROMPT"
          tone="prompt"
          zones={promptZones}
          activeZoneId={dragging?.ingredient.type === 'prompt' ? dragging.overZoneId : null}
          onRemoveItem={removePromptItem}
        />

        <aside className="order-first rounded-[2rem] bg-white/[0.04] p-4 shadow-xl backdrop-blur-xl xl:order-none xl:min-h-[790px]">
          <div className="mb-4 flex items-center justify-center gap-2 text-sm font-black text-white">
            <Network className="h-4 w-4 text-[#FF9BD7]" /> 재료
          </div>

          <div className="space-y-5">
            <div className="space-y-2.5">
              <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-[#FF9BD7]/75">Prompt</p>
              <div className="flex flex-wrap justify-center gap-2">
                {promptIngredients.map((ingredient) => (
                  <IngredientChip key={ingredient.id} ingredient={ingredient} onStartDrag={handleStartDrag} />
                ))}
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            <div className="space-y-2.5">
              <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-[#6EF0D4]/75">Lyrics</p>
              <div className="flex flex-wrap justify-center gap-2">
                {lyricIngredients.map((ingredient) => (
                  <IngredientChip key={ingredient.id} ingredient={ingredient} onStartDrag={handleStartDrag} />
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
          activeZoneId={dragging?.ingredient.type === 'lyric' ? dragging.overZoneId : null}
          onRemoveItem={removeLyricItem}
        />
      </div>

      {dragging && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-xs font-black shadow-2xl"
          style={{
            left: dragging.x,
            top: dragging.y,
            background: getTone(dragging.ingredient.type).solid,
            color: getTone(dragging.ingredient.type).text,
            boxShadow: `0 0 0 1px ${getTone(dragging.ingredient.type).soft}, 0 18px 45px rgba(0,0,0,0.34)`,
          }}
        >
          {dragging.ingredient.label}
        </div>
      )}
    </div>
  );
}
