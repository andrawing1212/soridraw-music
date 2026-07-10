import React, { DragEvent, useMemo, useState } from 'react';
import { FlaskConical, Grip, Music2, Network, Sparkles } from 'lucide-react';

type IngredientType = 'prompt' | 'lyric';

type LabIngredient = {
  id: string;
  label: string;
  type: IngredientType;
};

type PromptZone = {
  id: string;
  label: string;
  guide: string;
  max: number;
  items: string[];
};

type LyricZone = {
  id: string;
  label: string;
  guide: string;
  max: number;
  items: string[];
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

const initialPromptZones: PromptZone[] = [
  { id: 'genreLine', label: 'Genre', guide: '곡의 뼈대', max: 3, items: ['장르'] },
  { id: 'soundLine', label: 'Sound', guide: '악기와 질감', max: 4, items: ['사운드'] },
  { id: 'moodLine', label: 'Mood', guide: '장면과 공기', max: 4, items: ['분위기', '주제'] },
  { id: 'vocalsLine', label: 'Vocals', guide: '누가 어떻게 부르는지', max: 3, items: ['보컬'] },
  { id: 'productionLine', label: 'Production', guide: '템포와 전개', max: 4, items: ['템포', '곡 구조'] },
];

const initialLyricZones: LyricZone[] = [
  { id: 'verse', label: 'Verse', guide: '장면 시작', max: 4, items: ['장면', '화자'] },
  { id: 'preChorus', label: 'Pre-Chorus', guide: '감정 상승', max: 3, items: ['욕망'] },
  { id: 'chorus', label: 'Chorus', guide: '기억되는 훅', max: 4, items: ['반복 훅', '말투'] },
  { id: 'bridge', label: 'Bridge', guide: '반전 또는 고백', max: 3, items: ['결함'] },
  { id: 'outro', label: 'Outro', guide: '여운', max: 3, items: ['밀도'] },
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

function FillBar({ count, max, tone = 'prompt' }: { count: number; max: number; tone?: IngredientType }) {
  const percent = Math.min(100, Math.round((count / Math.max(max, 1)) * 100));
  const fillClass = tone === 'lyric'
    ? 'bg-gradient-to-r from-[#86B6F6]/15 via-[#BBA8CA]/25 to-[#BBA8CA]/45'
    : 'bg-gradient-to-r from-[#BBA8CA]/12 via-[#BBA8CA]/25 to-[#D8C5E8]/45';

  return (
    <div className="absolute inset-x-0 bottom-0 h-1.5 overflow-hidden rounded-b-[1.4rem] bg-white/[0.025]">
      <div className={`h-full ${fillClass} transition-all duration-700 ease-out`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function IngredientChip({ ingredient }: { ingredient: LabIngredient }) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-soridraw-lab', JSON.stringify(ingredient));
        event.dataTransfer.effectAllowed = 'copy';
      }}
      className="group inline-flex cursor-grab select-none items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-2 text-xs font-black text-white/78 shadow-sm transition-all hover:bg-[#BBA8CA]/18 hover:text-white active:cursor-grabbing"
    >
      <Grip className="h-3.5 w-3.5 text-white/35 transition group-hover:text-[#BBA8CA]" />
      {ingredient.label}
    </div>
  );
}

function PlacedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      title="누르면 제거"
      className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-black text-white/75 transition-all hover:bg-[#BBA8CA]/20 hover:text-white"
    >
      {label}
    </button>
  );
}

export default function LabWorkspace() {
  const [promptZones, setPromptZones] = useState<PromptZone[]>(initialPromptZones);
  const [lyricZones, setLyricZones] = useState<LyricZone[]>(initialLyricZones);
  const [activeDropId, setActiveDropId] = useState<string | null>(null);

  const promptPreview = useMemo(
    () => promptZones.map((zone) => `[${zone.label}] ${zone.items.join(' + ') || '비어 있음'}`).join('\n'),
    [promptZones]
  );

  const lyricPreview = useMemo(
    () => lyricZones.map((zone) => `[${zone.label}] ${zone.items.join(' / ') || zone.guide}`).join(' → '),
    [lyricZones]
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
    <div className="space-y-6">
      <div className="rounded-3xl bg-white/[0.025] p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#BBA8CA]/75">FREEDOM WORKSPACE</p>
            <h2 className="mt-2 text-2xl font-black">마인드맵 작업대</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
              재료를 끌어서 원하는 그릇에 넣어보는 1차 실험 화면입니다. 아직 실제 생성에는 연결하지 않았고, 구조를 눈으로 설계하는 단계입니다.
            </p>
          </div>
          <div className="rounded-2xl bg-black/20 px-4 py-3 text-xs leading-relaxed text-white/50">
            드래그해서 추가 · 추가될수록 아래 색이 채워짐 · 넣은 칩은 누르면 제거
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-3xl bg-[var(--card-bg)]/70 p-5 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Network className="h-4 w-4 text-[#BBA8CA]" /> 재료 창
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">버튼을 늘리지 않고, 필요한 재료를 작업대로 끌어다 놓는 방식입니다.</p>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">Prompt Materials</p>
            <div className="flex flex-wrap gap-2">
              {promptIngredients.map((ingredient) => <IngredientChip key={ingredient.id} ingredient={ingredient} />)}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/35">Lyric Tools</p>
            <div className="flex flex-wrap gap-2">
              {lyricIngredients.map((ingredient) => <IngredientChip key={ingredient.id} ingredient={ingredient} />)}
            </div>
          </div>
        </aside>

        <div className="grid gap-5 2xl:grid-cols-2">
          <section className="rounded-3xl bg-[var(--card-bg)]/70 p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Sparkles className="h-4 w-4 text-[#BBA8CA]" /> 프롬프트 지도
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">그릇 이름은 유지하고, 어떤 재료를 어느 줄에 넣을지 먼저 실험합니다.</p>
              </div>
              <span className="rounded-full bg-[#BBA8CA]/10 px-3 py-1 text-[11px] font-black text-[#D8C5E8]">Prompt</span>
            </div>

            <div className="relative rounded-[2rem] bg-black/15 p-4">
              <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[68%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-[#BBA8CA]/18 to-transparent md:block" />
              <div className="pointer-events-none absolute left-[12%] right-[12%] top-1/2 hidden h-px bg-gradient-to-r from-transparent via-[#BBA8CA]/18 to-transparent md:block" />
              <div className="relative z-10 mb-4 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#BBA8CA]/12 px-4 py-2 text-xs font-black text-[#D8C5E8]">
                  <FlaskConical className="h-3.5 w-3.5" /> Prompt Recipe
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {promptZones.map((zone) => {
                  const isActive = activeDropId === zone.id;
                  return (
                    <div
                      key={zone.id}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                        setActiveDropId(zone.id);
                      }}
                      onDragLeave={() => setActiveDropId((current) => current === zone.id ? null : current)}
                      onDrop={(event) => {
                        event.preventDefault();
                        const payload = getDragPayload(event);
                        if (payload) addPromptItem(zone.id, payload);
                        setActiveDropId(null);
                      }}
                      className={`relative min-h-[142px] overflow-hidden rounded-[1.4rem] bg-white/[0.04] p-4 transition-all duration-300 ${isActive ? 'scale-[1.015] bg-[#BBA8CA]/10 shadow-[0_0_0_1px_rgba(187,168,202,0.18)]' : ''}`}
                    >
                      <FillBar count={zone.items.length} max={zone.max} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">[{zone.label}]</p>
                          <p className="mt-1 text-xs text-white/38">{zone.guide}</p>
                        </div>
                        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black text-white/35">{zone.items.length}/{zone.max}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {zone.items.length ? zone.items.map((item) => (
                          <PlacedChip key={item} label={item} onRemove={() => removePromptItem(zone.id, item)} />
                        )) : <p className="text-xs text-white/25">여기로 재료를 끌어오세요</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/18 p-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/35">Preview</p>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-white/58">{promptPreview}</pre>
            </div>
          </section>

          <section className="rounded-3xl bg-[var(--card-bg)]/70 p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <Music2 className="h-4 w-4 text-[#86B6F6]" /> 가사 지도
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">가사는 시간 흐름이 중요해서 섹션을 길처럼 이어놓고, 필요한 도구를 끌어다 넣습니다.</p>
              </div>
              <span className="rounded-full bg-[#86B6F6]/10 px-3 py-1 text-[11px] font-black text-[#BFD8FF]">Lyrics</span>
            </div>

            <div className="space-y-3 rounded-[2rem] bg-black/15 p-4">
              {lyricZones.map((zone, index) => {
                const isActive = activeDropId === zone.id;
                return (
                  <div key={zone.id} className="relative">
                    {index > 0 && <div className="mx-auto mb-3 h-5 w-px bg-gradient-to-b from-[#86B6F6]/28 to-transparent" />}
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                        setActiveDropId(zone.id);
                      }}
                      onDragLeave={() => setActiveDropId((current) => current === zone.id ? null : current)}
                      onDrop={(event) => {
                        event.preventDefault();
                        const payload = getDragPayload(event);
                        if (payload) addLyricItem(zone.id, payload);
                        setActiveDropId(null);
                      }}
                      className={`relative min-h-[104px] overflow-hidden rounded-[1.4rem] bg-white/[0.04] p-4 transition-all duration-300 ${isActive ? 'scale-[1.01] bg-[#86B6F6]/10 shadow-[0_0_0_1px_rgba(134,182,246,0.18)]' : ''}`}
                    >
                      <FillBar count={zone.items.length} max={zone.max} tone="lyric" />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">[{zone.label}]</p>
                          <p className="mt-1 text-xs text-white/38">{zone.guide}</p>
                        </div>
                        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-black text-white/35">{zone.items.length}/{zone.max}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {zone.items.length ? zone.items.map((item) => (
                          <PlacedChip key={item} label={item} onRemove={() => removeLyricItem(zone.id, item)} />
                        )) : <p className="text-xs text-white/25">여기로 도구를 끌어오세요</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl bg-black/18 p-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/35">Preview</p>
              <p className="text-xs leading-relaxed text-white/58">{lyricPreview}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
