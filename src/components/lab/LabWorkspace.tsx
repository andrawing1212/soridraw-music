import React, { DragEvent, useState } from 'react';
import { FlaskConical, Grip, Music2, Network, Sparkles } from 'lucide-react';

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
  { id: 'genreLine', label: 'Genre', max: 3, items: ['장르'], x: 20, y: 18 },
  { id: 'soundLine', label: 'Sound', max: 4, items: ['사운드'], x: 80, y: 18 },
  { id: 'moodLine', label: 'Mood', max: 4, items: ['분위기', '주제'], x: 18, y: 62 },
  { id: 'vocalsLine', label: 'Vocals', max: 3, items: ['보컬'], x: 82, y: 62 },
  { id: 'productionLine', label: 'Production', max: 4, items: ['템포', '곡 구조'], x: 50, y: 84 },
];

const initialLyricZones: MapZone[] = [
  { id: 'verse', label: 'Verse', max: 4, items: ['장면', '화자'], x: 18, y: 20 },
  { id: 'preChorus', label: 'Pre-Chorus', max: 3, items: ['욕망'], x: 50, y: 14 },
  { id: 'chorus', label: 'Chorus', max: 4, items: ['반복 훅', '말투'], x: 82, y: 24 },
  { id: 'bridge', label: 'Bridge', max: 3, items: ['결함'], x: 28, y: 78 },
  { id: 'outro', label: 'Outro', max: 3, items: ['밀도'], x: 74, y: 78 },
];

function getDragPayload(event: DragEvent<HTMLElement>): LabIngredient | null {
  try {
    const raw = event.dataTransfer.getData('application/x-soridraw-lab');
    if (!raw) return null;
    return JSON.parse(raw) as LabIngredient;
  } catch {
    return null;
  }
}

function getTone(ingredientType: IngredientType) {
  return ingredientType === 'lyric'
    ? {
        main: '#6EF0D4',
        soft: 'rgba(110,240,212,0.14)',
        glow: 'rgba(110,240,212,0.22)',
        text: '#D6FFF7',
      }
    : {
        main: '#FF9BD7',
        soft: 'rgba(255,155,215,0.15)',
        glow: 'rgba(255,155,215,0.22)',
        text: '#FFE4F4',
      };
}

function IngredientChip({ ingredient }: { ingredient: LabIngredient }) {
  const tone = getTone(ingredient.type);

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-soridraw-lab', JSON.stringify(ingredient));
        event.dataTransfer.effectAllowed = 'copy';
      }}
      className="inline-flex cursor-grab select-none items-center gap-1.5 rounded-full bg-white/[0.065] px-3 py-2 text-xs font-black text-white/74 transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5"
      style={{ boxShadow: `inset 0 0 0 1px ${tone.soft}` }}
    >
      <Grip className="h-3.5 w-3.5 text-white/24" />
      {ingredient.label}
    </div>
  );
}

function PlacedChip({ label, tone, onRemove }: { label: string; tone: IngredientType; onRemove: () => void }) {
  const toneStyle = getTone(tone);

  return (
    <button
      type="button"
      onClick={onRemove}
      className="rounded-full px-2.5 py-1 text-[11px] font-black text-white transition-all hover:-translate-y-0.5"
      style={{ background: toneStyle.soft, color: toneStyle.text, boxShadow: `0 0 16px ${toneStyle.glow}` }}
    >
      {label}
    </button>
  );
}

function MapNode({
  zone,
  tone,
  active,
  onDropItem,
  onRemoveItem,
}: {
  zone: MapZone;
  tone: IngredientType;
  active: boolean;
  onDropItem: (zoneId: string, ingredient: LabIngredient) => void;
  onRemoveItem: (zoneId: string, label: string) => void;
}) {
  const percent = Math.min(100, Math.round((zone.items.length / Math.max(zone.max, 1)) * 100));
  const toneStyle = getTone(tone);
  const nodeWidth = tone === 'lyric' ? 'w-[154px] sm:w-[168px]' : 'w-[166px] sm:w-[184px]';

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const payload = getDragPayload(event);
        if (payload) onDropItem(zone.id, payload);
      }}
      className={`absolute min-h-[92px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.7rem] bg-white/[0.07] p-3.5 shadow-xl transition-all duration-300 ${nodeWidth} ${active ? 'scale-[1.04] bg-white/[0.1]' : ''}`}
      style={{ left: `${zone.x}%`, top: `${zone.y}%`, boxShadow: `0 18px 45px rgba(0,0,0,0.26), 0 0 28px ${toneStyle.glow}` }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 transition-all duration-700 ease-out"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, ${toneStyle.glow}, ${toneStyle.soft}, transparent)`,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-white">[{zone.label}]</p>
          <span className="rounded-full bg-black/18 px-2 py-1 text-[10px] font-black text-white/45">{zone.items.length}/{zone.max}</span>
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

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {zones.map((zone) => (
        <path
          key={zone.id}
          d={`M 50 50 C ${(50 + zone.x) / 2} ${zone.y}, ${(50 + zone.x) / 2} ${50}, ${zone.x} ${zone.y}`}
          fill="none"
          stroke={zone.items.length ? toneStyle.main : 'rgba(255,255,255,0.12)'}
          strokeWidth={zone.items.length ? '0.7' : '0.45'}
          strokeLinecap="round"
          opacity={zone.items.length ? 0.62 : 0.34}
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
  onDropItem,
  onRemoveItem,
}: {
  title: string;
  center: string;
  tone: IngredientType;
  zones: MapZone[];
  onDropItem: (zoneId: string, ingredient: LabIngredient) => void;
  onRemoveItem: (zoneId: string, label: string) => void;
}) {
  const toneStyle = getTone(tone);

  return (
    <section className="rounded-[2rem] bg-white/[0.045] p-3.5 shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          {tone === 'lyric' ? <Music2 className="h-4 w-4" style={{ color: toneStyle.main }} /> : <Sparkles className="h-4 w-4" style={{ color: toneStyle.main }} />}
          {title}
        </div>
      </div>

      <div className="relative min-h-[620px] overflow-hidden rounded-[2rem] bg-black/10">
        <div
          className="pointer-events-none absolute -left-12 top-0 h-48 w-48 rounded-full blur-3xl"
          style={{ background: toneStyle.soft }}
        />
        <div
          className="pointer-events-none absolute bottom-2 right-0 h-52 w-52 rounded-full blur-3xl"
          style={{ background: toneStyle.soft }}
        />
        <ConnectorLines zones={zones} tone={tone} />
        <div
          className="absolute left-1/2 top-1/2 z-10 flex h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black text-white shadow-2xl"
          style={{ background: toneStyle.soft, boxShadow: `0 0 46px ${toneStyle.glow}` }}
        >
          {center}
        </div>
        {zones.map((zone) => (
          <MapNode
            key={zone.id}
            zone={zone}
            tone={tone}
            active={false}
            onDropItem={onDropItem}
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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] bg-white/[0.045] p-4 shadow-xl backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <Network className="h-4 w-4 text-[#FF9BD7]" /> 재료
          </div>

          <div className="space-y-5">
            <div className="space-y-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#FF9BD7]/70">Prompt</p>
              <div className="flex flex-wrap gap-2">
                {promptIngredients.map((ingredient) => <IngredientChip key={ingredient.id} ingredient={ingredient} />)}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6EF0D4]/70">Lyrics</p>
              <div className="flex flex-wrap gap-2">
                {lyricIngredients.map((ingredient) => <IngredientChip key={ingredient.id} ingredient={ingredient} />)}
              </div>
            </div>
          </div>
        </aside>

        <div className="grid gap-4 xl:grid-cols-2">
          <MindMapBoard
            title="프롬프트"
            center="PROMPT"
            tone="prompt"
            zones={promptZones}
            onDropItem={addPromptItem}
            onRemoveItem={removePromptItem}
          />

          <MindMapBoard
            title="가사"
            center="LYRICS"
            tone="lyric"
            zones={lyricZones}
            onDropItem={addLyricItem}
            onRemoveItem={removeLyricItem}
          />
        </div>
      </div>
    </div>
  );
}
