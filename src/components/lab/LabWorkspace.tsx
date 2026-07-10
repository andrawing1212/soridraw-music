import React, { DragEvent, useMemo, useState } from 'react';
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
  { id: 'genreLine', label: 'Genre', max: 3, items: ['장르'], x: 22, y: 20 },
  { id: 'soundLine', label: 'Sound', max: 4, items: ['사운드'], x: 78, y: 20 },
  { id: 'moodLine', label: 'Mood', max: 4, items: ['분위기', '주제'], x: 20, y: 58 },
  { id: 'vocalsLine', label: 'Vocals', max: 3, items: ['보컬'], x: 80, y: 58 },
  { id: 'productionLine', label: 'Production', max: 4, items: ['템포', '곡 구조'], x: 50, y: 82 },
];

const initialLyricZones: MapZone[] = [
  { id: 'verse', label: 'Verse', max: 4, items: ['장면', '화자'], x: 15, y: 50 },
  { id: 'preChorus', label: 'Pre-Chorus', max: 3, items: ['욕망'], x: 34, y: 28 },
  { id: 'chorus', label: 'Chorus', max: 4, items: ['반복 훅', '말투'], x: 54, y: 50 },
  { id: 'bridge', label: 'Bridge', max: 3, items: ['결함'], x: 73, y: 28 },
  { id: 'outro', label: 'Outro', max: 3, items: ['밀도'], x: 88, y: 50 },
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

function IngredientChip({ ingredient }: { ingredient: LabIngredient }) {
  const toneClass = ingredient.type === 'lyric'
    ? 'hover:bg-[#86B6F6]/16 hover:text-[#D7E8FF]'
    : 'hover:bg-[#BBA8CA]/16 hover:text-[#F2E7FF]';

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-soridraw-lab', JSON.stringify(ingredient));
        event.dataTransfer.effectAllowed = 'copy';
      }}
      className={`inline-flex cursor-grab select-none items-center gap-1.5 rounded-full bg-white/[0.055] px-3 py-2 text-xs font-black text-white/72 transition-all active:cursor-grabbing ${toneClass}`}
    >
      <Grip className="h-3.5 w-3.5 text-white/28" />
      {ingredient.label}
    </div>
  );
}

function PlacedChip({ label, tone, onRemove }: { label: string; tone: IngredientType; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={`rounded-full px-2.5 py-1 text-[11px] font-black transition-all ${tone === 'lyric' ? 'bg-[#86B6F6]/12 text-[#D7E8FF] hover:bg-[#86B6F6]/22' : 'bg-[#BBA8CA]/13 text-[#F2E7FF] hover:bg-[#BBA8CA]/24'}`}
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
  const glowClass = tone === 'lyric'
    ? 'shadow-[0_0_26px_rgba(134,182,246,0.08)]'
    : 'shadow-[0_0_26px_rgba(187,168,202,0.09)]';
  const fillClass = tone === 'lyric'
    ? 'bg-gradient-to-r from-[#86B6F6]/20 via-[#86B6F6]/10 to-transparent'
    : 'bg-gradient-to-r from-[#BBA8CA]/22 via-[#BBA8CA]/10 to-transparent';

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
      className={`absolute min-h-[96px] w-[178px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white/[0.055] p-3.5 transition-all duration-300 ${glowClass} ${active ? 'scale-[1.04] bg-white/[0.08]' : ''}`}
      style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
    >
      <div className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-700 ease-out ${fillClass}`} style={{ width: `${percent}%` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-white">[{zone.label}]</p>
          <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black text-white/38">{zone.items.length}/{zone.max}</span>
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

function ConnectorLines({ zones, tone, flow = false }: { zones: MapZone[]; tone: IngredientType; flow?: boolean }) {
  const stroke = tone === 'lyric' ? 'rgba(134,182,246,0.24)' : 'rgba(187,168,202,0.25)';
  const activeStroke = tone === 'lyric' ? 'rgba(134,182,246,0.55)' : 'rgba(187,168,202,0.55)';

  if (flow) {
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {zones.slice(0, -1).map((zone, index) => {
          const next = zones[index + 1];
          return (
            <path
              key={`${zone.id}-${next.id}`}
              d={`M ${zone.x} ${zone.y} C ${(zone.x + next.x) / 2} ${zone.y - 20}, ${(zone.x + next.x) / 2} ${next.y + 20}, ${next.x} ${next.y}`}
              fill="none"
              stroke={zone.items.length || next.items.length ? activeStroke : stroke}
              strokeWidth="0.45"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {zones.map((zone) => (
        <path
          key={zone.id}
          d={`M 50 50 C ${(50 + zone.x) / 2} ${zone.y}, ${(50 + zone.x) / 2} ${50}, ${zone.x} ${zone.y}`}
          fill="none"
          stroke={zone.items.length ? activeStroke : stroke}
          strokeWidth="0.45"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export default function LabWorkspace() {
  const [promptZones, setPromptZones] = useState<MapZone[]>(initialPromptZones);
  const [lyricZones, setLyricZones] = useState<MapZone[]>(initialLyricZones);

  const promptPreview = useMemo(
    () => promptZones.map((zone) => `[${zone.label}] ${zone.items.join(' + ')}`).join('\n'),
    [promptZones]
  );

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
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] bg-[var(--card-bg)]/65 p-4 shadow-xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <Network className="h-4 w-4 text-[#BBA8CA]" /> 재료
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">Prompt</p>
              <div className="flex flex-wrap gap-2">
                {promptIngredients.map((ingredient) => <IngredientChip key={ingredient.id} ingredient={ingredient} />)}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">Lyrics</p>
              <div className="flex flex-wrap gap-2">
                {lyricIngredients.map((ingredient) => <IngredientChip key={ingredient.id} ingredient={ingredient} />)}
              </div>
            </div>
          </div>
        </aside>

        <div className="grid gap-5 2xl:grid-cols-2">
          <section className="rounded-[2rem] bg-[var(--card-bg)]/65 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Sparkles className="h-4 w-4 text-[#BBA8CA]" /> 프롬프트
              </div>
              <span className="rounded-full bg-[#BBA8CA]/10 px-3 py-1 text-[11px] font-black text-[#D8C5E8]">Mind Map</span>
            </div>

            <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] bg-black/15">
              <ConnectorLines zones={promptZones} tone="prompt" />
              <div className="absolute left-1/2 top-1/2 z-10 flex h-[94px] w-[94px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#BBA8CA]/15 text-sm font-black text-[#F2E7FF] shadow-[0_0_36px_rgba(187,168,202,0.16)]">
                PROMPT
              </div>
              {promptZones.map((zone) => (
                <MapNode
                  key={zone.id}
                  zone={zone}
                  tone="prompt"
                  active={false}
                  onDropItem={addPromptItem}
                  onRemoveItem={removePromptItem}
                />
              ))}
            </div>

            <div className="mt-3 rounded-2xl bg-black/18 p-3">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-white/55">{promptPreview}</pre>
            </div>
          </section>

          <section className="rounded-[2rem] bg-[var(--card-bg)]/65 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Music2 className="h-4 w-4 text-[#86B6F6]" /> 가사
              </div>
              <span className="rounded-full bg-[#86B6F6]/10 px-3 py-1 text-[11px] font-black text-[#BFD8FF]">Flow Map</span>
            </div>

            <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] bg-black/15">
              <ConnectorLines zones={lyricZones} tone="lyric" flow />
              <div className="absolute left-1/2 top-[74%] z-10 flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#86B6F6]/13 text-sm font-black text-[#D7E8FF] shadow-[0_0_36px_rgba(134,182,246,0.14)]">
                LYRICS
              </div>
              {lyricZones.map((zone) => (
                <MapNode
                  key={zone.id}
                  zone={zone}
                  tone="lyric"
                  active={false}
                  onDropItem={addLyricItem}
                  onRemoveItem={removeLyricItem}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
